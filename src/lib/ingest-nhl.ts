import 'server-only';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { FieldValue } from 'firebase-admin/firestore';
import { db } from './firebase';
import type { GameStatus } from './types';

// Shared NHL ingestion core. CLI wrapper in scripts/ingest-nhl-schedule.ts.
//
// WHY THIS EXISTS. The promo-pipeline season gate (lib/scanner/season-gate.js)
// joins every extracted promo date to a real home game in the `games`
// collection and HOLDS any row that does not join exactly once. NHL has no
// rows in that collection, so the gate cannot run for NHL at all. This module
// builds the NHL spine the gate reads. The join reads exactly these fields:
// league, season, homeTeamSlug, awayTeamSlug, date (venue-local day),
// seasonType, id. There is no week field: the NHL has no week numbering and
// the gate's week cross-check goes inert as weekCheck "join-only".
//
// SOURCE. https://api-web.nhle.com/v1/club-schedule-season/{ABBREV}/{SEASON}
// One fetch per club, 32 fetches for a full season. Each game appears in
// two payloads (home and away), so games are deduped by the NHL game id.
// The payload carries gameType (1 preseason, 2 regular, 3 playoffs),
// gameDate (already the venue-local calendar day), startTimeUTC,
// venueUTCOffset and venueTimezone. Unlike ESPN there is no hand-built
// timezone map: the API states the venue zone per game, and this module
// recomputes the venue-local day from startTimeUTC plus venueUTCOffset and
// reports every disagreement with gameDate rather than trusting either alone
// (EXTRACTION-RULES 7.3.3: joins are venue-local, never UTC).
//
// SEASON CONVENTION. `season` is the calendar year the season STARTS, so the
// 2026-27 season is season 2026. That is what the pipeline's
// loadSeasonSpine({ league: "nhl", season: 2026 }) must be called with. The
// NHL's own season code (20262027) is kept alongside as nhlSeasonCode so the
// two never have to be derived from each other.
//
// WRITE DISCIPLINE. Dry-run by default: the caller receives the doc array and
// writes nothing. The execute path is present but gated twice (the flag, and a
// snapshot-before-write of every existing nhl games doc to a local file, which
// aborts the write if it cannot be written). Idempotent upserts with
// merge:true, so a re-run after a schedule change is safe.

// ── NHL tri-code -> PromoNight team slug ─────────────────────────────────
// All 32 clubs. Firestore doc ids were verified against the live teams
// collection on 2026-08-21 (team-configs/nhl.js in promo-pipeline). Utah's
// doc id stays utah-hockey-club: the Mammoth rebrand never migrated the slug
// and the rename is DEFERRED by decision, never utah-mammoth.
export const NHL_ABBREV_TO_SLUG: Record<string, string> = {
  ANA: 'anaheim-ducks',
  BOS: 'boston-bruins',
  BUF: 'buffalo-sabres',
  CAR: 'carolina-hurricanes',
  CBJ: 'columbus-blue-jackets',
  CGY: 'calgary-flames',
  CHI: 'chicago-blackhawks',
  COL: 'colorado-avalanche',
  DAL: 'dallas-stars',
  DET: 'detroit-red-wings',
  EDM: 'edmonton-oilers',
  FLA: 'florida-panthers',
  LAK: 'los-angeles-kings',
  MIN: 'minnesota-wild',
  MTL: 'montreal-canadiens',
  NJD: 'new-jersey-devils',
  NSH: 'nashville-predators',
  NYI: 'new-york-islanders',
  NYR: 'new-york-rangers',
  OTT: 'ottawa-senators',
  PHI: 'philadelphia-flyers',
  PIT: 'pittsburgh-penguins',
  SEA: 'seattle-kraken',
  SJS: 'san-jose-sharks',
  STL: 'st-louis-blues',
  TBL: 'tampa-bay-lightning',
  TOR: 'toronto-maple-leafs',
  UTA: 'utah-hockey-club',
  VAN: 'vancouver-canucks',
  VGK: 'vegas-golden-knights',
  WPG: 'winnipeg-jets',
  WSH: 'washington-capitals',
};

export const NHL_API_BASE = 'https://api-web.nhle.com/v1/club-schedule-season';

// ── API payload types (only the fields read here) ────────────────────────
interface NhlTeamRef {
  id?: number;
  abbrev: string;
}

interface NhlGame {
  id: number;
  season: number;
  gameType: number;
  gameDate: string;
  venue?: { default?: string };
  neutralSite?: boolean;
  startTimeUTC: string;
  venueUTCOffset?: string;
  venueTimezone?: string;
  gameState?: string;
  gameScheduleState?: string;
  awayTeam: NhlTeamRef;
  homeTeam: NhlTeamRef;
}

interface NhlClubSchedule {
  currentSeason?: number;
  games?: NhlGame[];
}

// ── Output types ─────────────────────────────────────────────────────────
export type NhlSeasonType = 'preseason' | 'regular';

export interface NhlGameDoc {
  id: string;
  league: 'nhl';
  season: number;
  nhlSeasonCode: number;
  seasonType: NhlSeasonType;
  date: string;
  gameTime: string;
  gameTimeTz: string;
  homeTeamSlug: string;
  awayTeamSlug: string;
  venueName: string;
  neutralSite: boolean;
  status: GameStatus;
  nhlGameId: number;
}

export interface IngestNhlOptions {
  log?: (msg: string) => void;
  execute?: boolean;
  // NHL season code, e.g. 20262027.
  seasonCode?: number;
  // Calendar year the season starts, e.g. 2026. Derived from seasonCode when
  // omitted.
  season?: number;
  // Required for execute: where the pre-write snapshot of existing nhl games
  // docs is written. The write aborts if this file cannot be written.
  snapshotPath?: string;
  // Test seam. Defaults to global fetch.
  fetchImpl?: typeof fetch;
  // When set, every club payload is written to <cacheDir>/<ABBREV>.json after
  // a successful fetch, and a later run with useCache reads from there instead
  // of fetching. Insurance against a crash after the fetch budget is spent.
  cacheDir?: string;
  useCache?: boolean;
}

export interface IngestNhlStats {
  fetches: number;
  cacheHits: number;
  retries: number;
  clubsFetched: number;
  clubsFailed: string[];
  gamesSeen: number;
  uniqueGames: number;
  byType: { preseason: number; regular: number };
  skippedByGameType: Record<string, number>;
  // gameDate versus the day recomputed from startTimeUTC + venueUTCOffset,
  // and versus the day resolved through venueTimezone with Intl.
  dateMismatchOffset: string[];
  dateMismatchTz: string[];
  neutralSite: string[];
  nonNorthAmerican: string[];
  missingVenueZone: string[];
  perClubHome: Record<string, { preseason: number; regular: number }>;
  earliestPreseason: string | null;
  regularOpener: string | null;
  regularLast: string | null;
  mappingErrors: { unknownAbbrevs: string[]; slugsMissingInFirestore: string[] };
  // Games skipped because one side is not an NHL club (preseason exhibitions
  // against non-NHL opponents). Only a REGULAR season miss aborts the run.
  skippedUnknownClub: string[];
  existingNhlGamesBeforeWrite: number | null;
  upserted: number;
  errors: number;
}

export interface IngestNhlResult {
  stats: IngestNhlStats;
  docs: NhlGameDoc[];
}

// ── Helpers ──────────────────────────────────────────────────────────────

function utcHhmm(utcIso: string): string {
  const d = new Date(utcIso);
  if (Number.isNaN(d.getTime())) return '';
  return d.toISOString().slice(11, 16);
}

// "-07:00" -> -420 minutes. Returns null when the offset is not parseable so
// the caller can report it instead of silently assuming UTC.
export function parseUtcOffsetMinutes(offset: string | undefined): number | null {
  const m = /^([+-])(\d{2}):(\d{2})$/.exec(String(offset ?? ''));
  if (!m) return null;
  const sign = m[1] === '-' ? -1 : 1;
  return sign * (Number(m[2]) * 60 + Number(m[3]));
}

// Venue-local calendar day from a UTC instant plus the venue's UTC offset.
export function localDayFromOffset(utcIso: string, offset: string | undefined): string {
  const t = Date.parse(utcIso);
  const mins = parseUtcOffsetMinutes(offset);
  if (!Number.isFinite(t) || mins == null) return '';
  return new Date(t + mins * 60000).toISOString().slice(0, 10);
}

// Venue-local calendar day resolved through the IANA zone, as ingest-nfl does.
export function localDayFromTz(utcIso: string, tz: string | undefined): string {
  if (!tz) return '';
  const date = new Date(utcIso);
  if (Number.isNaN(date.getTime())) return '';
  try {
    const parts = new Intl.DateTimeFormat('en-US', {
      timeZone: tz,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    }).formatToParts(date);
    const y = parts.find((p) => p.type === 'year')?.value;
    const m = parts.find((p) => p.type === 'month')?.value;
    const d = parts.find((p) => p.type === 'day')?.value;
    if (!y || !m || !d) return '';
    return `${y}-${m}-${d}`;
  } catch {
    return '';
  }
}

export function seasonTypeForGameType(gameType: number): NhlSeasonType | null {
  if (gameType === 1) return 'preseason';
  if (gameType === 2) return 'regular';
  return null;
}

function isNorthAmericanZone(tz: string): boolean {
  return /^(America|US|Canada)\//.test(tz);
}

// ── Main ─────────────────────────────────────────────────────────────────

export async function ingestNhlSchedule(opts: IngestNhlOptions = {}): Promise<IngestNhlResult> {
  const log = opts.log ?? (() => {});
  const execute = opts.execute === true;
  const seasonCode = opts.seasonCode ?? 20262027;
  const season = opts.season ?? Math.floor(seasonCode / 10000);
  const fetchImpl = opts.fetchImpl ?? fetch;

  const stats: IngestNhlStats = {
    fetches: 0,
    cacheHits: 0,
    retries: 0,
    clubsFetched: 0,
    clubsFailed: [],
    gamesSeen: 0,
    uniqueGames: 0,
    byType: { preseason: 0, regular: 0 },
    skippedByGameType: {},
    dateMismatchOffset: [],
    dateMismatchTz: [],
    neutralSite: [],
    nonNorthAmerican: [],
    missingVenueZone: [],
    perClubHome: {},
    earliestPreseason: null,
    regularOpener: null,
    regularLast: null,
    mappingErrors: { unknownAbbrevs: [], slugsMissingInFirestore: [] },
    skippedUnknownClub: [],
    existingNhlGamesBeforeWrite: null,
    upserted: 0,
    errors: 0,
  };

  // Step 0: validate the slug map against the live teams collection BEFORE
  // spending any fetch. One read-only query. A miss aborts here, the same
  // fail-loud posture ingest-nfl takes on an unknown ESPN id.
  const teamsSnap = await db.collection('teams').where('league', '==', 'NHL').get();
  const liveSlugs = new Set(teamsSnap.docs.map((d) => d.id));
  for (const slug of Object.values(NHL_ABBREV_TO_SLUG)) {
    if (!liveSlugs.has(slug)) stats.mappingErrors.slugsMissingInFirestore.push(slug);
  }
  const extraLive = [...liveSlugs].filter((s) => !Object.values(NHL_ABBREV_TO_SLUG).includes(s));
  log(`teams check: ${liveSlugs.size} NHL team docs in Firestore, ${Object.keys(NHL_ABBREV_TO_SLUG).length} map entries, missing=${stats.mappingErrors.slugsMissingInFirestore.length}, unmapped-live=${extraLive.length}${extraLive.length ? ' (' + extraLive.join(', ') + ')' : ''}`);
  if (stats.mappingErrors.slugsMissingInFirestore.length > 0) {
    throw new Error('Slug map entries missing from Firestore teams: ' + stats.mappingErrors.slugsMissingInFirestore.join(', ') + '. Fix NHL_ABBREV_TO_SLUG in src/lib/ingest-nhl.ts before re-running.');
  }

  // Step 1: one fetch per club, sequential, one retry on failure. The count
  // is reported because the calling brief caps network use.
  const seen = new Map<number, NhlGame>();
  for (const abbrev of Object.keys(NHL_ABBREV_TO_SLUG)) {
    const url = `${NHL_API_BASE}/${abbrev}/${seasonCode}`;
    let payload: NhlClubSchedule | null = null;
    const cacheFile = opts.cacheDir ? path.join(opts.cacheDir, `${abbrev}-${seasonCode}.json`) : null;
    if (cacheFile && opts.useCache && existsSync(cacheFile)) {
      payload = JSON.parse(readFileSync(cacheFile, 'utf8')) as NhlClubSchedule;
      stats.cacheHits += 1;
    }
    for (let attempt = 1; attempt <= 2 && !payload; attempt++) {
      stats.fetches += 1;
      if (attempt === 2) stats.retries += 1;
      try {
        const res = await fetchImpl(url);
        if (!res.ok) throw new Error(`HTTP ${res.status} ${res.statusText}`);
        payload = (await res.json()) as NhlClubSchedule;
        if (cacheFile) {
          mkdirSync(path.dirname(cacheFile), { recursive: true });
          writeFileSync(cacheFile, JSON.stringify(payload));
        }
      } catch (e) {
        log(`  fetch ${abbrev} attempt ${attempt} FAILED: ${(e as Error).message}`);
      }
    }
    if (!payload) {
      stats.clubsFailed.push(abbrev);
      continue;
    }
    stats.clubsFetched += 1;
    const games = payload.games ?? [];
    stats.gamesSeen += games.length;
    let newHere = 0;
    for (const g of games) {
      if (!g || typeof g.id !== 'number') continue;
      if (!seen.has(g.id)) {
        seen.set(g.id, g);
        newHere += 1;
      }
    }
    log(`  ${abbrev}: ${games.length} games in payload, ${newHere} new by id (unique so far ${seen.size})`);
  }
  if (stats.clubsFailed.length > 0) {
    throw new Error('Fetch failed for ' + stats.clubsFailed.join(', ') + ' after one retry each. No partial spine is built.');
  }
  stats.uniqueGames = seen.size;

  // Step 2: build docs from the deduped set.
  const docs: NhlGameDoc[] = [];
  const homeCount = (slug: string, st: NhlSeasonType) => {
    if (!stats.perClubHome[slug]) stats.perClubHome[slug] = { preseason: 0, regular: 0 };
    stats.perClubHome[slug][st] += 1;
  };
  for (const g of [...seen.values()].sort((a, b) => a.id - b.id)) {
    const st = seasonTypeForGameType(g.gameType);
    if (!st) {
      const k = String(g.gameType);
      stats.skippedByGameType[k] = (stats.skippedByGameType[k] || 0) + 1;
      continue;
    }
    const homeAbbrev = g.homeTeam?.abbrev;
    const awayAbbrev = g.awayTeam?.abbrev;
    const homeSlug = NHL_ABBREV_TO_SLUG[homeAbbrev];
    const awaySlug = NHL_ABBREV_TO_SLUG[awayAbbrev];
    if (!homeSlug || !awaySlug) {
      // Preseason exhibitions can involve a non-NHL opponent. Those games are
      // not spine material (no PromoNight club on one side) and are skipped
      // with a record. A REGULAR season game with an unknown side is a map
      // error and aborts below.
      const rec = `${g.id} ${g.gameDate} ${awayAbbrev}@${homeAbbrev} gameType=${g.gameType}`;
      stats.skippedUnknownClub.push(rec);
      if (st === 'regular') {
        for (const a of [homeAbbrev, awayAbbrev]) {
          if (!NHL_ABBREV_TO_SLUG[a] && !stats.mappingErrors.unknownAbbrevs.includes(a)) stats.mappingErrors.unknownAbbrevs.push(a);
        }
      }
      continue;
    }

    const tz = g.venueTimezone ?? '';
    const label = `${g.id} ${g.gameDate} ${awayAbbrev}@${homeAbbrev}`;
    if (!tz || !g.venueUTCOffset) stats.missingVenueZone.push(label);
    const dayOffset = localDayFromOffset(g.startTimeUTC, g.venueUTCOffset);
    const dayTz = localDayFromTz(g.startTimeUTC, tz);
    if (dayOffset && dayOffset !== g.gameDate) stats.dateMismatchOffset.push(`${label} offset-day=${dayOffset} start=${g.startTimeUTC} off=${g.venueUTCOffset}`);
    if (dayTz && dayTz !== g.gameDate) stats.dateMismatchTz.push(`${label} tz-day=${dayTz} start=${g.startTimeUTC} tz=${tz}`);
    if (g.neutralSite) stats.neutralSite.push(`${label} venue=${g.venue?.default ?? '?'} tz=${tz}`);
    if (tz && !isNorthAmericanZone(tz)) stats.nonNorthAmerican.push(`${label} venue=${g.venue?.default ?? '?'} tz=${tz}`);

    // 7.3.3: the stored date is the venue-local day. The API's gameDate is
    // that day; the recomputation above is a check, never a replacement.
    const date = g.gameDate;
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) continue;

    const doc: NhlGameDoc = {
      id: `nhl-${date}-${awaySlug}-at-${homeSlug}`,
      league: 'nhl',
      season,
      nhlSeasonCode: g.season ?? seasonCode,
      seasonType: st,
      date,
      gameTime: utcHhmm(g.startTimeUTC),
      gameTimeTz: tz,
      homeTeamSlug: homeSlug,
      awayTeamSlug: awaySlug,
      venueName: g.venue?.default ?? '',
      neutralSite: g.neutralSite === true,
      status: 'scheduled',
      nhlGameId: g.id,
    };
    docs.push(doc);
    stats.byType[st] += 1;
    homeCount(homeSlug, st);
    if (st === 'preseason' && (!stats.earliestPreseason || date < stats.earliestPreseason)) stats.earliestPreseason = date;
    if (st === 'regular') {
      if (!stats.regularOpener || date < stats.regularOpener) stats.regularOpener = date;
      if (!stats.regularLast || date > stats.regularLast) stats.regularLast = date;
    }
  }

  if (stats.mappingErrors.unknownAbbrevs.length > 0) {
    throw new Error('Unknown NHL abbreviations on REGULAR season games: ' + stats.mappingErrors.unknownAbbrevs.join(', ') + '. Add them to NHL_ABBREV_TO_SLUG before re-running (cached payloads can be reused with useCache).');
  }

  // Doc ids must be unique: two games on one date between the same clubs at
  // the same venue would collide, and that never happens in the NHL, so a
  // collision is a data error worth aborting on.
  const ids = new Set<string>();
  for (const d of docs) {
    if (ids.has(d.id)) throw new Error('Duplicate doc id built: ' + d.id);
    ids.add(d.id);
  }

  if (!execute) {
    log('');
    log(`[ingest-nhl] DRY-RUN complete. ${docs.length} game docs would be written to collection 'games' (preseason ${stats.byType.preseason}, regular ${stats.byType.regular}). Nothing written.`);
    return { stats, docs };
  }

  // Execute path. Never run under the 2026-09-01 brief; present so the
  // authorization, when it comes, is a flag and not a rewrite.
  if (!opts.snapshotPath) {
    throw new Error('execute requires snapshotPath: the pre-write snapshot location must be chosen deliberately.');
  }
  const existing = await db.collection('games').where('league', '==', 'nhl').get();
  stats.existingNhlGamesBeforeWrite = existing.size;
  const snapshot = {
    takenAt: new Date().toISOString(),
    league: 'nhl',
    count: existing.size,
    docs: existing.docs.map((d) => ({ id: d.id, data: d.data() })),
  };
  // Throws if the path is not writable, which aborts before any batch.
  writeFileSync(opts.snapshotPath, JSON.stringify(snapshot, null, 1));
  log(`[ingest-nhl] snapshot of ${existing.size} existing nhl games doc(s) written to ${opts.snapshotPath} BEFORE any write`);

  const BATCH_SIZE = 400;
  for (let i = 0; i < docs.length; i += BATCH_SIZE) {
    const batch = db.batch();
    const slice = docs.slice(i, i + BATCH_SIZE);
    for (const d of slice) {
      batch.set(db.collection('games').doc(d.id), { ...d, ingestedAt: FieldValue.serverTimestamp() }, { merge: true });
    }
    try {
      await batch.commit();
      stats.upserted += slice.length;
      log(`batch ${Math.floor(i / BATCH_SIZE) + 1}: upserted ${slice.length}, total=${stats.upserted}`);
    } catch (e) {
      stats.errors++;
      log(`batch error: ${(e as Error).message}`);
    }
  }
  return { stats, docs };
}
