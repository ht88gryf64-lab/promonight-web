/* eslint-disable no-console */
// CFB Phase 2 orchestrator — the 86-school hard-data run (decision record §6/§7).
//
//   npx tsx --require ./scripts/stub-server-only.cjs scripts/cfb/run-phase2.ts --execute --resume
//   ... --execute --only=lsu,notre-dame     # subset
//   ... --execute --limit=5                  # first 5 (smoke)
//   ... --execute                            # FULL run: WIPES cfb* first, see below
//   (omit --execute for a DRY run: everything except Firestore writes)
//
// THE BARE --execute IS THE DESTRUCTIVE ONE. With no --resume, --only or
// --limit it calls clearCollections() and deletes cfbGames, cfbVenues,
// cfbSchools and cfbRivalries before rebuilding. Prefer --resume or --only for
// routine runs; both skip the wipe. The wipe now REFUSES when any doc carries a
// human-owned field (tombstoned, neutralVenueHubSlug) and needs --force-wipe to
// proceed, because those fields cannot be rebuilt from any schedule page.
//
// Per school: Firecrawl-fetch the OFFICIAL schedule -> Haiku parse (source =
// official domain) -> build cfbGames (verified=false) -> corroborate in HARNESS
// CODE against Wikipedia (independent 2nd domain; SR dormant) -> resolve venue
// (infobox hyperlink) + colors, all humanConfirmed:false -> rivalry tags
// (corroborated, crown none). Batched, checkpointed, resumable.

import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'node:fs';
import { join, dirname } from 'node:path';

// ── Secrets: read IN PLACE from the env files, never log/echo/copy the values ──
function loadKey(name: string, files: string[]) {
  if (process.env[name]) return;
  for (const f of files) {
    try {
      const m = readFileSync(f, 'utf8').match(new RegExp('^' + name + '=(.+)$', 'm'));
      if (m) { process.env[name] = m[1].trim().replace(/^["']|["']$/g, ''); return; }
    } catch { /* try next */ }
  }
}
loadKey('ANTHROPIC_API_KEY', ['promo-pipeline/.env.local', '../promonight/promo-pipeline/.env']);
loadKey('FIRECRAWL_API_KEY', ['../promonight/promo-pipeline/.env', 'promo-pipeline/.env.local']);

import { db } from '../../src/lib/firebase';
import { CFB_COLLECTIONS, type CfbGame } from '../../src/lib/cfb/types';
import { gateConferenceGame, computeWeeks, slugifySchool } from '../../src/lib/cfb/rules';
import { SCHOOLS_2026, SCHOOLS_2026_BY_ID, normalizeSlug, type CfbSchoolConfig2026 } from './lib/schools-2026';
import { parseSchoolSchedule } from './lib/pipeline';
import { fetchWikiSchedule, corroborate } from './lib/corroborate';
import { resolveVenue } from './lib/venue';
import { resolveColors } from './lib/colors';
import { tagRivalry, type RivalryEntry } from './lib/rivalry';
import { pickHumanOwned, assertWipeSafe, HUMAN_OWNED_FIELDS } from './lib/human-owned';

const args = process.argv.slice(2);
const EXECUTE = args.includes('--execute');
const RESUME = args.includes('--resume');
const FORCE_WIPE = args.includes('--force-wipe');

/** Every human-owned field carried forward across a re-run, for the run report. */
const preserved: string[] = [];
const LIMIT = Number((args.find((a) => a.startsWith('--limit=')) || '').replace('--limit=', '')) || 0;
const ONLY = (args.find((a) => a.startsWith('--only=')) || '').replace('--only=', '');
const onlySet = ONLY ? new Set(ONLY.split(',')) : null;
const SEASON = 2026;
const NOW = new Date().toISOString();

const STATE_DIR = '/private/tmp/claude-501/-Users-mattkovalik-promonight-web/0569d4ac-e40c-424b-bde8-6824a7b1340c/scratchpad/cfb-phase2';
const STATE_FILE = join(STATE_DIR, 'run-state.json');
function loadState(): Record<string, any> { try { return JSON.parse(readFileSync(STATE_FILE, 'utf8')); } catch { return {}; } }
function saveState(s: Record<string, any>) { mkdirSync(dirname(STATE_FILE), { recursive: true }); writeFileSync(STATE_FILE, JSON.stringify(s, null, 2)); }

function gameId(date: string, home: string, away: string) { return `${SEASON}-${date}-${home}-${away}`; }

interface Buckets { verified: number; 'honest-tbd': number; unconfirmed: number; 'no-2nd-source': number; 'value-conflict': number; }
interface SchoolResult {
  id: string; extracted: number; fetchOk: boolean; fetchReason?: string;
  buckets: Record<string, number>; verified: number; parseUsd: number;
  wikiFetched: boolean; pendingPublish: boolean; venue: string | null; error?: string;
}

const rivalryDocs = new Map<string, RivalryEntry>();

async function runSchool(cfg: CfbSchoolConfig2026): Promise<SchoolResult> {
  const res: SchoolResult = { id: cfg.id, extracted: 0, fetchOk: false, buckets: {}, verified: 0, parseUsd: 0, wikiFetched: false, pendingPublish: cfg.wikiNotYetCreated, venue: null };

  // ── PARSE: Firecrawl official -> Haiku (source = official domain) ──
  const parsed = await parseSchoolSchedule(cfg);
  res.parseUsd = parsed.usd; res.fetchOk = parsed.fetch.ok; res.fetchReason = parsed.fetch.reason;
  if (!parsed.fetch.ok) { res.error = `official fetch failed: ${parsed.fetch.reason}`; return res; }
  if (!parsed.games.length) { res.error = 'parser returned 0 games'; return res; }

  const withWeeks = computeWeeks(parsed.games);
  const games: CfbGame[] = withWeeks.map((g) => {
    const home = normalizeSlug(g.homeTeam); const away = normalizeSlug(g.awayTeam);
    const rivalry = tagRivalry(home, away); // corroborated tag, CROWN NONE (no signature)
    if (rivalry) rivalryDocs.set(rivalry.id, rivalry);
    return {
      id: gameId(g.date, home, away), season: SEASON, week: g.week, date: g.date, status: 'scheduled',
      homeSchoolId: home, awaySchoolId: away, neutralSite: g.neutralSite, venueId: '',
      kickoff: { time: g.kickoffTime, tz: g.kickoffTz, tbd: /tbd/i.test(g.kickoffTime), windowFlex: null },
      broadcast: { network: g.tvNetwork, confirmed: g.tvConfirmed },
      conferenceGame: gateConferenceGame(home, away), // RULE + safe-direction default
      rivalryId: rivalry ? rivalry.id : null, themeDesignations: [],
      source: g.source, confidence: g.confidence, fetchedAt: NOW,
      verified: false, verification: null,
    };
  });
  res.extracted = games.length;

  // ── VENUE (infobox hyperlink) + COLORS — proposed, humanConfirmed:false ──
  const venue = await resolveVenue({ id: cfg.id, name: cfg.name, nick: cfg.nick, wikiTeamPage: cfg.wikiTeamPage });
  const colors = await resolveColors({ name: cfg.name, nick: cfg.nick });
  const venueId = venue.resolved && venue.stadiumWikiTitle ? slugifySchool(venue.stadiumWikiTitle) : '';
  res.venue = venue.proposedStadium || null;
  for (const g of games) if (g.homeSchoolId === cfg.id && !g.neutralSite) g.venueId = venueId;

  // ── CORROBORATE in HARNESS CODE against Wikipedia (independent 2nd domain) ──
  const wiki = await fetchWikiSchedule({ name: cfg.name, wikiTeamPage: cfg.wikiTeamPage });
  res.wikiFetched = wiki.fetched;
  for (const g of games) {
    const c = corroborate(g, wiki, { venueTz: cfg.venueTz });
    res.buckets[c.bucket] = (res.buckets[c.bucket] ?? 0) + 1;
    if (c.verdict === 'verified') { g.verified = true; res.verified++; }
    g.verification = {
      verifiedAt: NOW, verdict: c.verdict,
      guards: { timezone: c.verdict !== 'downgraded', derivedFields: true, entityConflation: true, secondSource: c.verdict === 'verified', citation: c.verdict === 'verified' },
      flags: c.flags, sourcesChecked: c.sourcesChecked,
      // provenance domains carried on the game: parser source + the corroborator
      domains: Array.from(new Set([domainOf(g.source), ...c.sourcesChecked.map(domainOf)].filter(Boolean))),
      corroborator: c.sourcesChecked.length ? 'en.wikipedia.org' : (cfg.wikiNotYetCreated ? 'pending-publish (wiki 2026 not created; SR dormant)' : 'none'),
      fieldConfirmed: c.fieldConfirmed,
    } as any;
  }

  // Read-then-preserve, computed in BOTH modes. A bare set() replaces the whole
  // document, which is right for every machine-owned field but destroys the two
  // a human decides. Carry those forward explicitly. An allowlist, not
  // { merge: true }: merge would preserve stale machine fields forever too.
  // The read runs in DRY as well so a dry run reports exactly what a real run
  // would carry, which is the only way to see the risk before committing to it.
  const existingGames = await Promise.all(
    games.map((g) => db.collection(CFB_COLLECTIONS.games).doc(g.id).get()),
  );
  const carriedByGameId = new Map<string, Record<string, unknown>>();
  for (let i = 0; i < games.length; i++) {
    const carried = pickHumanOwned(existingGames[i].exists ? existingGames[i].data() : undefined);
    if (Object.keys(carried).length) {
      carriedByGameId.set(games[i].id, carried);
      preserved.push(`${games[i].id} ${JSON.stringify(carried)}`);
      console.log(`    PRESERVE ${games[i].id} ${JSON.stringify(carried)}${EXECUTE ? '' : ' (dry, would carry forward)'}`);
    }
  }

  if (EXECUTE) {
    // cfbSchools (colors proposed), cfbVenues (proposed), cfbGames (verified flags set)
    const b = db.batch();
    b.set(db.collection(CFB_COLLECTIONS.schools).doc(cfg.id), {
      id: cfg.id, name: cfg.name, shortName: cfg.name, mascot: cfg.nick,
      primaryColor: colors.primary, secondaryColor: colors.secondary, colorsSource: colors.source, colorsHumanConfirmed: false,
      conferenceBySeason: { '2026': cfg.conference2026 }, venueId, traditionIds: [],
      editorialStatus: 'auto', updatedAt: NOW,
    });
    if (venueId) b.set(db.collection(CFB_COLLECTIONS.venues).doc(venueId), {
      id: venueId, name: venue.proposedStadium, city: venue.city, state: venue.state, capacity: venue.capacity,
      lat: venue.lat, lng: venue.lng, homeSchoolId: cfg.id, sharedSchoolIds: [],
      humanConfirmed: false, proposedFrom: venue.proposedFrom, source: venue.source, updatedAt: NOW,
    });
    for (const g of games) {
      b.set(db.collection(CFB_COLLECTIONS.games).doc(g.id), { ...g, ...(carriedByGameId.get(g.id) ?? {}) });
    }
    await b.commit();
  }
  return res;
}

function domainOf(url: string): string { try { return new URL(url).hostname.replace(/^www\./, ''); } catch { return ''; } }

const WIPE_COLLECTIONS = [CFB_COLLECTIONS.games, CFB_COLLECTIONS.venues, CFB_COLLECTIONS.schools, CFB_COLLECTIONS.rivalries];

async function clearCollections() {
  // Preservation cannot defend a wipe: after the delete there is nothing left to
  // read the human-owned fields back from. Refuse instead, unless forced.
  await assertWipeSafe(db, WIPE_COLLECTIONS, FORCE_WIPE);
  for (const col of WIPE_COLLECTIONS) {
    const snap = await db.collection(col).get();
    let b = db.batch(); let n = 0;
    for (const d of snap.docs) { b.delete(d.ref); if (++n % 400 === 0) { await b.commit(); b = db.batch(); } }
    if (n % 400 !== 0) await b.commit();
    if (snap.size) console.log(`cleared ${snap.size} ${col}`);
  }
}

async function main() {
  let targets = SCHOOLS_2026.filter((s) => !onlySet || onlySet.has(s.id));
  if (LIMIT) targets = targets.slice(0, LIMIT);
  const state = RESUME ? loadState() : {};
  if (RESUME) targets = targets.filter((s) => !state[s.id]);

  console.log(`CFB Phase 2 run — ${EXECUTE ? 'EXECUTE (writing cfb*)' : 'DRY (no writes)'} — ${targets.length} schools — ${NOW}`);
  if (EXECUTE && !RESUME && !onlySet && !LIMIT) { await clearCollections(); }

  const results: SchoolResult[] = [];
  for (let i = 0; i < targets.length; i++) {
    const cfg = targets[i];
    let r: SchoolResult;
    try { r = await runSchool(cfg); }
    catch (e: any) { console.log(`  (error ${cfg.id}: ${e.message} — retry once)`); try { r = await runSchool(cfg); } catch (e2: any) { r = { id: cfg.id, extracted: 0, fetchOk: false, buckets: {}, verified: 0, parseUsd: 0, wikiFetched: false, pendingPublish: cfg.wikiNotYetCreated, venue: null, error: e2.message }; } }
    results.push(r);
    state[cfg.id] = { ...r, at: NOW };
    saveState(state); // CHECKPOINT after every school (resumable)
    const b = r.buckets;
    console.log(`  ${String(i + 1).padStart(2)}/${targets.length} ${cfg.id.padEnd(18)} games=${String(r.extracted).padStart(2)} verified=${String(r.verified).padStart(2)} no2nd=${b['no-2nd-source'] || 0} tbd=${(b['honest-tbd'] || 0) + (b['unconfirmed'] || 0)} conflict=${b['value-conflict'] || 0}${r.pendingPublish ? ' [pending-publish]' : ''}${r.error ? ' ERR=' + r.error : ''}`);
  }

  // ── cfbRivalries (deduped, corroborated, no signature) ──
  if (EXECUTE && rivalryDocs.size) {
    const b = db.batch();
    for (const r of rivalryDocs.values()) b.set(db.collection(CFB_COLLECTIONS.rivalries).doc(r.id), { ...r, updatedAt: NOW });
    await b.commit();
    console.log(`wrote ${rivalryDocs.size} cfbRivalries (corroborated, crown none)`);
  }

  const tot = results.reduce((a, r) => ({ e: a.e + r.extracted, v: a.v + r.verified, usd: a.usd + r.parseUsd }), { e: 0, v: 0, usd: 0 });
  const no2nd = results.reduce((a, r) => a + (r.buckets['no-2nd-source'] || 0), 0);
  console.log(`\nTOTAL games=${tot.e} verified=${tot.v} no-2nd-source=${no2nd} rivalries=${rivalryDocs.size} usd=$${tot.usd.toFixed(2)}`);
  if (preserved.length) {
    console.log(`\n${EXECUTE ? 'PRESERVED' : 'WOULD PRESERVE'} ${preserved.length} human-owned field set(s) across the rebuild [${HUMAN_OWNED_FIELDS.join(', ')}]:`);
    preserved.forEach((p) => console.log(`  ${p}`));
  } else {
    console.log(`\nPRESERVED 0 human-owned fields (none of the rewritten docs carried any).`);
  }
  console.log(`state -> ${STATE_FILE}`);
  process.exit(0);
}

main().catch((e) => { console.error(e); process.exit(1); });
