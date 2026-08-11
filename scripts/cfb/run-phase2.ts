/* eslint-disable no-console */
// CFB Phase 2 orchestrator — the 86-school hard-data run (decision record §6/§7).
//
//   npx tsx --require ./scripts/stub-server-only.cjs scripts/cfb/run-phase2.ts
//   ... --only=lsu,notre-dame                # DRY, scoped
//   ... --limit=5                            # DRY, first 5
//
// THIS WRITER IS QUARANTINED. EVERY --execute IS REFUSED.
//
// A full 86-school dry run, with no scoping of any kind, measured the rebuild
// dropping 74.1% of the rivalry tags in the corpus: 80 game docs across 79
// rivalries, against 108 currently tagged. The run assembled rivalries=28. Nine
// of the 32 registry matchup pages would silently empty, because the whole
// /cfb/rivalries family keys on rivalryId.
//
// The cause is tagRivalry returning null for most pairs. It is UNDIAGNOSED and
// deliberately out of scope here: it is its own piece of work with its own gate.
// Until it is understood, no write is safe, so the refusal covers --execute,
// --execute --resume and --execute --only alike. An earlier guard refused only a
// scoped execute and pointed at --resume as safe; the full-run measurement
// proved that pointer wrong, which is why the quarantine is now total.
//
// Override with --force-unsafe-write, which logs the measured damage loudly and
// expects you to repair the tags afterwards.
//
// A DRY RUN IS ALWAYS SAFE and is how the numbers above were produced: it parses,
// reports both tripwire tiers, and writes nothing.
//
// The wipe guard is still in force underneath all of that: clearCollections()
// REFUSES when any doc carries a human-owned field (tombstoned,
// neutralVenueHubSlug) and needs --force-wipe, because those cannot be rebuilt
// from any source.
//
// Field ownership lives in src/lib/cfb/human-owned.ts:
//   HUMAN_OWNED_FIELDS      carried across a rebuild
//   MACHINE_OWNED_CRITICAL  tripwired as LOSS, never preserved (a stale machine
//                           value is worse than an absent one)
//   MACHINE_OWNED_DEGRADE   tripwired as DEGRADE, a different non-null value
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
import {
  pickHumanOwned, assertWipeSafe, findFieldDrift,
  HUMAN_OWNED_FIELDS, MACHINE_OWNED_CRITICAL, MACHINE_OWNED_DEGRADE,
} from './lib/human-owned';

const args = process.argv.slice(2);
const EXECUTE = args.includes('--execute');
const RESUME = args.includes('--resume');
const FORCE_WIPE = args.includes('--force-wipe');
const FORCE_UNSAFE_WRITE = args.includes('--force-unsafe-write');

/** Every human-owned field carried forward across a re-run, for the run report. */
const preserved: string[] = [];
/** Every doc where a machine-owned field is about to be lost or degraded. */
const criticalLosses: string[] = [];
const criticalDegrades: string[] = [];
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
    const stored = existingGames[i].exists ? existingGames[i].data() : undefined;
    const carried = pickHumanOwned(stored);
    if (Object.keys(carried).length) {
      carriedByGameId.set(games[i].id, carried);
      preserved.push(`${games[i].id} ${JSON.stringify(carried)}`);
      console.log(`    PRESERVE ${games[i].id} ${JSON.stringify(carried)}${EXECUTE ? '' : ' (dry, would carry forward)'}`);
    }

    // TRIPWIRE, not preservation. A machine-derived field that the fresh parse
    // could not reproduce is a real signal, and carrying the stale value forward
    // would hide it. Name every drift instead, in dry and execute alike.
    //
    // TWO TIERS on purpose. LOSS is a field going to null and it empties pages;
    // DEGRADE is a field changing to a different non-null value and it does not.
    // Folding them together would bury the one that matters.
    for (const d of findFieldDrift(stored, games[i] as unknown as Record<string, unknown>)) {
      const line = `${games[i].id} ${d.field}: ${JSON.stringify(d.was)} -> ${JSON.stringify(d.now)}`;
      if (d.tier === 'LOSS') { criticalLosses.push(line); console.log(`    !! LOSING ${line}`); }
      else { criticalDegrades.push(line); console.log(`    ~~ DEGRADING ${line}`); }
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

  // THE WRITER IS QUARANTINED. Every --execute is refused, scoped or not.
  //
  // Phase 1B-C refused only a SCOPED execute, on the notre-dame evidence, and
  // pointed at --execute --resume as the safe path. A full 86-school dry run
  // then measured the real blast radius and that pointer was wrong: a full,
  // non-scoped run drops 74.1% of the rivalry tags in the corpus. This is not a
  // scoping bug. tagRivalry is failing broadly and the scoped case was only
  // where it surfaced first.
  if (EXECUTE && !FORCE_UNSAFE_WRITE) {
    console.error([
      '',
      'REFUSING TO WRITE. The Phase 2 writer is quarantined.',
      `  invocation: --execute${RESUME ? ' --resume' : ''}${ONLY ? ` --only=${ONLY}` : ''}${LIMIT ? ` --limit=${LIMIT}` : ''}`,
      '',
      'MEASURED over a full 86-school dry run, no scoping of any kind:',
      '',
      '  80 game docs would lose rivalryId, across 79 distinct rivalries.',
      '  The corpus currently carries 108 rivalry tags, so that is 74.1% of them.',
      '  The run itself assembled rivalries=28 against those 108 tagged docs.',
      '  9 of the 32 registry matchup pages would silently empty:',
      '    washington--washington-state, lsu--ole-miss, texas--texas-am,',
      '    iowa--minnesota, auburn--georgia, michigan-state--notre-dame,',
      '    notre-dame--stanford, duke--north-carolina, illinois--ohio-state',
      '',
      'CAUSE: tagRivalry returns null for most pairs. Not diagnosed. It is its own',
      'piece of work with its own gate, and nothing here should be run until it is',
      'understood, because every write compounds the damage.',
      '',
      '--resume is NOT a safe alternative. The numbers above come from a full run.',
      'The human-owned allowlist does not help: it protects tombstoned and',
      'neutralVenueHubSlug only. rivalryId, broadcast.network and kickoff.tz are',
      'machine-owned and unprotected by design.',
      '',
      'What you CAN do safely:',
      '  Drop --execute. A dry run parses, reports both tripwire tiers, and writes',
      '  nothing. That is how the numbers above were produced.',
      '',
      'If you genuinely intend to write anyway, and to repair the tags afterwards:',
      '  --force-unsafe-write',
      '',
    ].join('\n'));
    process.exit(1);
  }

  console.log(`CFB Phase 2 run — ${EXECUTE ? 'EXECUTE (writing cfb*)' : 'DRY (no writes)'} — ${targets.length} schools — ${NOW}`);
  if (EXECUTE && FORCE_UNSAFE_WRITE) {
    console.log('');
    console.log('!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!');
    console.log('!!! --force-unsafe-write: OVERRIDING THE WRITER QUARANTINE.');
    console.log('!!! A full run was measured dropping 74.1% of rivalry tags (80 docs,');
    console.log('!!! 79 rivalries) and emptying 9 of the 32 registry matchup pages.');
    console.log('!!! tagRivalry is undiagnosed. Plan to repair the tags after this run.');
    console.log('!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!');
    console.log('');
  }
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

  if (criticalLosses.length) {
    console.log(`\n!!! ${EXECUTE ? 'LOST' : 'WOULD LOSE'} ${criticalLosses.length} machine-owned critical field(s) [${MACHINE_OWNED_CRITICAL.join(', ')}]:`);
    criticalLosses.forEach((c) => console.log(`  ${c}`));
    console.log('!!! These are NOT preserved by design: a stale machine value is worse than an absent one.');
    console.log('!!! rivalryId backs the /cfb/rivalries family, so each loss above empties a matchup page.');
  }

  if (criticalDegrades.length) {
    console.log(`\n~~~ ${EXECUTE ? 'DEGRADED' : 'WOULD DEGRADE'} ${criticalDegrades.length} machine-owned field(s) [${MACHINE_OWNED_DEGRADE.join(', ')}]:`);
    criticalDegrades.forEach((c) => console.log(`  ${c}`));
    console.log('~~~ A different non-null value, not a loss. These do not empty a page, which is');
    console.log('~~~ why they are a separate tier from the LOSING lines above.');
  }
  console.log(`state -> ${STATE_FILE}`);
  process.exit(0);
}

main().catch((e) => { console.error(e); process.exit(1); });
