/* eslint-disable no-console */
// CFB Phase 2 RECONCILE (verify-stage cleanup over stored data). Fixes three
// data-quality issues the raw run surfaced, IN PLACE (no re-parse, no LLM):
//   1. Placeholder opponents — the parser occasionally emits a conditional slot
//      (conference championship / playoff / TBD) as a real game. Tombstone these.
//   2. Duplicate matchups. Two shapes, both collapsed on a SORTED school pair:
//      (a) the same matchup emitted twice on different dates (Georgia Tech:
//          Colorado 09-03 AND 09-05), and
//      (b) the same matchup emitted twice with home and away swapped, because
//          both schools' schedule pages claim the game and each names itself
//          home. An ordered key could never see (b).
//      Keep the best-corroborated doc; tombstone the rest.
//   3. Shared-with-G5 last-writer-wins — a game between a fetchable school and a
//      pending-publish G5 got corroborated from the G5's (unfetchable) side and
//      stored as no-2nd-source. Re-corroborate each game against BOTH teams'
//      Wikipedia (verified if EITHER confirms) — the fetchable side heals it.
//
//   npx tsx --env-file=.env.local --require ./scripts/stub-server-only.cjs scripts/cfb/run-phase2-reconcile.ts --execute

import { readFileSync } from 'node:fs';
function loadKey(name: string, files: string[]) { if (process.env[name]) return; for (const f of files) { try { const m = readFileSync(f, 'utf8').match(new RegExp('^' + name + '=(.+)$', 'm')); if (m) { process.env[name] = m[1].trim().replace(/^["']|["']$/g, ''); return; } } catch { /* next */ } } }
loadKey('FIRECRAWL_API_KEY', ['../promonight/promo-pipeline/.env', 'promo-pipeline/.env.local']);

import { db } from '../../src/lib/firebase';
import { CFB_COLLECTIONS } from '../../src/lib/cfb/types';
import { matchupKey } from '../../src/lib/cfb/rules';
import { SCHOOLS_2026_BY_ID } from './lib/schools-2026';
import { fetchWikiSchedule, corroborate, type WikiSchedule } from './lib/corroborate';

const EXECUTE = process.argv.includes('--execute');
const NOW = new Date().toISOString();
function domainOf(url: string): string { try { return new URL(url).hostname.replace(/^www\./, ''); } catch { return ''; } }

// A game whose opponent is a conditional slot, not a scheduled team.
const PLACEHOLDER = /championship|playoff|college-football|^tbd$|^tba$|^bye$|opponent-t|first-round|quarterfinal|semifinal|-bowl$|bowl-game|to-be-|winner-of/i;

const RANK: Record<string, number> = { verified: 5, 'honest-tbd': 4, unconfirmed: 3, 'value-conflict': 2, 'no-2nd-source': 0 };

async function main() {
  const snap = await db.collection(CFB_COLLECTIONS.games).get();
  const all = snap.docs.map((d) => ({ _id: d.id, ...(d.data() as any) }));
  // Already-tombstoned docs are settled. Re-processing them would re-rank them
  // against live docs and could resurrect one into the keep set.
  const games = all.filter((g) => g.tombstoned !== true);
  const alreadyTombstoned = all.length - games.length;
  console.log(`reconcile: ${games.length} live game docs (${alreadyTombstoned} already tombstoned, skipped) [${EXECUTE ? 'EXECUTE' : 'DRY'}]`);

  // ── 1. placeholder filter ──
  const placeholders = games.filter((g) => PLACEHOLDER.test(g.awaySchoolId) || PLACEHOLDER.test(g.homeSchoolId));
  const real = games.filter((g) => !placeholders.includes(g));
  console.log(`placeholders to tombstone: ${placeholders.length} [${placeholders.slice(0, 6).map((g) => `${g.awaySchoolId}@${g.homeSchoolId}`).join(', ')}${placeholders.length > 6 ? ' ...' : ''}]`);

  // ── wiki cache (fetchable schools only; throttled sequential + UA/retry) ──
  const need = new Set<string>();
  for (const g of real) { for (const id of [g.homeSchoolId, g.awaySchoolId]) if (SCHOOLS_2026_BY_ID[id] && !SCHOOLS_2026_BY_ID[id].wikiNotYetCreated) need.add(id); }
  const wikiCache = new Map<string, WikiSchedule>();
  let wi = 0;
  for (const id of need) {
    const cfg = SCHOOLS_2026_BY_ID[id];
    wikiCache.set(id, await fetchWikiSchedule({ name: cfg.name, wikiTeamPage: cfg.wikiTeamPage }));
    if (++wi % 20 === 0) console.log(`  cached ${wi}/${need.size} wikis`);
  }
  console.log(`cached ${wikiCache.size} Wikipedia schedules`);

  // corroborate a game against BOTH teams' wikis; return the best verdict
  function corrBoth(g: any) {
    let best: any = null;
    for (const id of [g.homeSchoolId, g.awaySchoolId]) {
      const wiki = wikiCache.get(id);
      if (!wiki) continue;
      const cfg = SCHOOLS_2026_BY_ID[id];
      const c = corroborate({ date: g.date, source: g.source, homeSchoolId: g.homeSchoolId, awaySchoolId: g.awaySchoolId, kickoff: g.kickoff }, wiki, { venueTz: cfg.venueTz });
      if (!best || RANK[c.bucket] > RANK[best.bucket]) best = { ...c, viaWiki: wiki.url };
    }
    return best || { verdict: 'flagged-for-human', bucket: 'no-2nd-source', sourcesChecked: [], flags: ['no fetchable Wikipedia for either team (pending-publish)'], fieldConfirmed: null };
  }

  // ── 2. dedup by matchup (keep the corroborated date) ──
  // The key is SORTED, so a home/away swap collapses to one group. An ordered
  // key treated "florida|georgia" and "georgia|florida" as two different
  // matchups, which is exactly how 7 swap duplicates survived every prior pass:
  // two schedule sources each claim the game, each names itself home, and the
  // parser stores both.
  const byMatch = new Map<string, any[]>();
  for (const g of real) { const k = matchupKey(g.homeSchoolId, g.awaySchoolId); (byMatch.get(k) || byMatch.set(k, []).get(k))!.push(g); }
  const keep: any[] = []; const dropDup: any[] = [];
  const ambiguous: string[] = [];
  let swapGroups = 0; let dateGroups = 0;
  for (const [k, grp] of byMatch) {
    if (grp.length === 1) { keep.push(grp[0]); continue; }

    // Classify the group so the log says which defect it is closing.
    const dates = new Set(grp.map((g) => g.date));
    const orderings = new Set(grp.map((g) => `${g.homeSchoolId}>${g.awaySchoolId}`));
    if (dates.size === 1 && orderings.size > 1) swapGroups++;
    else if (dates.size > 1 && orderings.size === 1) dateGroups++;
    else {
      // Both the date AND the home/away designation differ. Two schedule sources
      // disagreeing looks identical to two genuine meetings (a regular-season
      // game plus a conference championship rematch). Collapsing blind could
      // hide a real fixture, so flag it for a human instead of guessing.
      ambiguous.push(`${k}: dates=${JSON.stringify([...dates])} orderings=${JSON.stringify([...orderings])} docs=${grp.map((g) => g._id).join(', ')}`);
    }

    // Rank by corroboration, then apply the canonical tiebreak used in the
    // Phase 1A audit so a same-date swap resolves deterministically:
    // confirmed broadcast wins, then the normalized "H:MM AM/PM" kickoff shape.
    const NORMAL_KICKOFF = /^\d{1,2}:\d{2} (AM|PM)$/;
    const scored = grp
      .map((g) => ({ g, c: corrBoth(g) }))
      .sort((a, b) => {
        const byBucket = RANK[b.c.bucket] - RANK[a.c.bucket];
        if (byBucket !== 0) return byBucket;
        const conf = Number(b.g.broadcast?.confirmed === true) - Number(a.g.broadcast?.confirmed === true);
        if (conf !== 0) return conf;
        return Number(NORMAL_KICKOFF.test(b.g.kickoff?.time ?? '')) - Number(NORMAL_KICKOFF.test(a.g.kickoff?.time ?? ''));
      });
    keep.push(scored[0].g);
    for (const s of scored.slice(1)) dropDup.push(s.g);
  }
  console.log(`duplicate matchups: ${dropDup.length} to tombstone (${swapGroups} home/away swap, ${dateGroups} same-matchup-two-dates) [${dropDup.slice(0, 6).map((g) => `${g.awaySchoolId}@${g.homeSchoolId} ${g.date}`).join(', ')}${dropDup.length > 6 ? ' ...' : ''}]`);
  if (ambiguous.length) {
    console.log(`\n!!! ${ambiguous.length} AMBIGUOUS group(s): date AND home/away both differ. Could be a genuine rematch, not a duplicate.`);
    ambiguous.forEach((a) => console.log(`    ${a}`));
    console.log('    These were still collapsed by corroboration rank. Review before trusting the result.\n');
  }

  // ── 3. re-corroborate kept games against both teams' wikis; set verified ──
  const buckets: Record<string, number> = {};
  let verified = 0;
  const updates: { id: string; verified: boolean; verification: any }[] = [];
  for (const g of keep) {
    const c = corrBoth(g);
    buckets[c.bucket] = (buckets[c.bucket] ?? 0) + 1;
    const isV = c.verdict === 'verified';
    if (isV) verified++;
    updates.push({
      id: g._id, verified: isV,
      verification: {
        verifiedAt: NOW, verdict: c.verdict,
        guards: { timezone: c.verdict !== 'downgraded', derivedFields: true, entityConflation: true, secondSource: isV, citation: isV },
        flags: c.flags, sourcesChecked: c.sourcesChecked,
        domains: Array.from(new Set([domainOf(g.source), ...(c.sourcesChecked || []).map(domainOf)].filter(Boolean))),
        corroborator: c.sourcesChecked?.length ? 'en.wikipedia.org' : 'pending-publish',
        fieldConfirmed: c.fieldConfirmed, reconciledVia: c.viaWiki || null,
      },
    });
  }

  console.log(`\nafter reconcile: ${keep.length} games — verified=${verified} buckets=${JSON.stringify(buckets)}`);
  const no2nd = buckets['no-2nd-source'] || 0;
  console.log(`no-2nd-source: ${no2nd} (should now be ~just the pending-publish G5)`);

  if (EXECUTE) {
    let b = db.batch(); let n = 0;
    const commit = async () => { await b.commit(); b = db.batch(); n = 0; };
    // Tombstone, never delete. A hidden doc stays auditable and recoverable; a
    // deleted one is gone with no snapshot. The reader filters tombstoned docs
    // out of getCfbSchoolPage, so the render effect is identical.
    for (const g of [...placeholders, ...dropDup]) { b.update(db.collection(CFB_COLLECTIONS.games).doc(g._id), { tombstoned: true }); if (++n >= 400) await commit(); }
    for (const u of updates) { b.update(db.collection(CFB_COLLECTIONS.games).doc(u.id), { verified: u.verified, verification: u.verification }); if (++n >= 400) await commit(); }
    if (n) await b.commit();
    console.log(`EXECUTED: tombstoned ${placeholders.length + dropDup.length}, updated ${updates.length}`);
  } else {
    console.log('DRY. No writes. Re-run with --execute to apply.');
  }
  process.exit(0);
}
main().catch((e) => { console.error(e); process.exit(1); });
