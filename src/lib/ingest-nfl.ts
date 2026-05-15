import 'server-only';
import { FieldValue } from 'firebase-admin/firestore';
import { db } from './firebase';
import type { GameStatus } from './types';

// Shared NFL ingestion core. CLI script in scripts/ingest-nfl-schedule.ts
// calls this; there is no scheduled cron for NFL today. The 2026 schedule
// is released once in May with sporadic flex revisions during the season;
// the script is run manually after each revision.
//
// NFL flex scheduling typically announces late-season game times in
// waves through Nov-Jan. Games with timeTbd: true should be re-ingested
// after each announcement window. No cron for now; rerun --execute
// manually when flex windows are announced (these are public news
// events). ESPN's `timeValid` boolean drives timeTbd: when false, the
// kickoff time in the API is a placeholder (typically 05:00Z = midnight
// Eastern), and Phase 3 renders "TBD" rather than the placeholder time.

// ── ESPN team id → PromoNight team slug ────────────────────────────────
// Reference: https://site.api.espn.com/apis/site/v2/sports/football/nfl/teams
// IDs are stable. Verified 2026-05-15 by extracting every
// competitor.team.id seen in the 18-week 2026 regular-season scoreboard
// pull (ids 1 through 34, skipping 31 and 32 which are unused).
export const ESPN_TEAM_ID_TO_SLUG: Record<string, string> = {
  '1': 'atlanta-falcons',
  '2': 'buffalo-bills',
  '3': 'chicago-bears',
  '4': 'cincinnati-bengals',
  '5': 'cleveland-browns',
  '6': 'dallas-cowboys',
  '7': 'denver-broncos',
  '8': 'detroit-lions',
  '9': 'green-bay-packers',
  '10': 'tennessee-titans',
  '11': 'indianapolis-colts',
  '12': 'kansas-city-chiefs',
  '13': 'las-vegas-raiders',
  '14': 'los-angeles-rams',
  '15': 'miami-dolphins',
  '16': 'minnesota-vikings',
  '17': 'new-england-patriots',
  '18': 'new-orleans-saints',
  '19': 'new-york-giants',
  '20': 'new-york-jets',
  '21': 'philadelphia-eagles',
  '22': 'arizona-cardinals',
  '23': 'pittsburgh-steelers',
  '24': 'los-angeles-chargers',
  '25': 'san-francisco-49ers',
  '26': 'seattle-seahawks',
  '27': 'tampa-bay-buccaneers',
  '28': 'washington-commanders',
  '29': 'carolina-panthers',
  '30': 'jacksonville-jaguars',
  '33': 'baltimore-ravens',
  '34': 'houston-texans',
};

// ── ESPN venue id → { tz, displayCity } ────────────────────────────────
// ESPN's scoreboard response does not include a venue timezone, so the
// venue → IANA TZ mapping lives here. displayCity is the
// `internationalLocation` label rendered as a small badge on the team
// page game cell; null for domestic venues.
//
// Why fail-loud on missing entry: ESPN occasionally adds neutral-site
// venues (international games, hurricane relocations). An unknown id
// must not silently default to America/New_York; the script aborts so a
// human adds the entry and reviews.
//
// Edge cases worth NOT "simplifying":
//   - State Farm Stadium (Cardinals, 3970): America/Phoenix. Arizona
//     does not observe DST; using America/Denver would drift by 1 hour
//     for half the year.
//   - Lucas Oil Stadium (Colts, 3812): America/Indiana/Indianapolis.
//     Indiana has a TZ split; Indianapolis follows Eastern with DST.
//   - Ford Field (Lions, 3727): America/Detroit. Equates to
//     America/New_York observationally, but the IANA name reflects the
//     city and keeps the intent obvious to future readers.
//
// International display strings: city-only, normalized for an American
// audience. ESPN returns "Saint-Denis" as venue.address.city for Stade
// de France; we render "Paris" instead because the audience recognizes
// it. Other international cities are already familiar.
interface VenueInfo {
  tz: string;
  displayCity: string | null;
}

export const ESPN_VENUE_ID_TO_INFO: Record<string, VenueInfo> = {
  // Domestic NFL stadiums
  '3687':  { tz: 'America/Chicago',              displayCity: null }, // AT&T Stadium (Cowboys)
  '3752':  { tz: 'America/New_York',             displayCity: null }, // Acrisure Stadium (Steelers)
  '6501':  { tz: 'America/Los_Angeles',          displayCity: null }, // Allegiant Stadium (Raiders)
  '3628':  { tz: 'America/New_York',             displayCity: null }, // Bank of America Stadium (Panthers)
  '3493':  { tz: 'America/Chicago',              displayCity: null }, // Caesars Superdome (Saints)
  '3937':  { tz: 'America/Denver',               displayCity: null }, // Empower Field at Mile High (Broncos)
  '3712':  { tz: 'America/New_York',             displayCity: null }, // EverBank Stadium (Jaguars)
  '3727':  { tz: 'America/Detroit',              displayCity: null }, // Ford Field (Lions, see edge case note)
  '3622':  { tz: 'America/Chicago',              displayCity: null }, // GEHA Field at Arrowhead Stadium (Chiefs)
  '3738':  { tz: 'America/New_York',             displayCity: null }, // Gillette Stadium (Patriots)
  '3948':  { tz: 'America/New_York',             displayCity: null }, // Hard Rock Stadium (Dolphins)
  '11938': { tz: 'America/New_York',             displayCity: null }, // Highmark Stadium (Bills)
  '3679':  { tz: 'America/New_York',             displayCity: null }, // Huntington Bank Field (Browns)
  '3798':  { tz: 'America/Chicago',              displayCity: null }, // Lambeau Field (Packers)
  '4738':  { tz: 'America/Los_Angeles',          displayCity: null }, // Levi's Stadium (49ers)
  '3806':  { tz: 'America/New_York',             displayCity: null }, // Lincoln Financial Field (Eagles)
  '3812':  { tz: 'America/Indiana/Indianapolis', displayCity: null }, // Lucas Oil Stadium (Colts, see edge case note)
  '3673':  { tz: 'America/Los_Angeles',          displayCity: null }, // Lumen Field (Seahawks)
  '3814':  { tz: 'America/New_York',             displayCity: null }, // M&T Bank Stadium (Ravens)
  '5348':  { tz: 'America/New_York',             displayCity: null }, // Mercedes-Benz Stadium (Falcons)
  '3839':  { tz: 'America/New_York',             displayCity: null }, // MetLife Stadium (Giants, Jets)
  '3891':  { tz: 'America/Chicago',              displayCity: null }, // NRG Stadium (Texans)
  '3810':  { tz: 'America/Chicago',              displayCity: null }, // Nissan Stadium (Titans)
  '3719':  { tz: 'America/New_York',             displayCity: null }, // Northwest Stadium (Commanders)
  '3874':  { tz: 'America/New_York',             displayCity: null }, // Paycor Stadium (Bengals)
  '3886':  { tz: 'America/New_York',             displayCity: null }, // Raymond James Stadium (Buccaneers)
  '7065':  { tz: 'America/Los_Angeles',          displayCity: null }, // SoFi Stadium (Rams, Chargers)
  '3933':  { tz: 'America/Chicago',              displayCity: null }, // Soldier Field (Bears)
  '3970':  { tz: 'America/Phoenix',              displayCity: null }, // State Farm Stadium (Cardinals, see edge case note)
  '5239':  { tz: 'America/Chicago',              displayCity: null }, // U.S. Bank Stadium (Vikings)
  // International 2026 venues
  '9119':  { tz: 'Australia/Melbourne',          displayCity: 'Melbourne' },      // Melbourne Cricket Ground
  '11931': { tz: 'America/Sao_Paulo',            displayCity: 'Rio de Janeiro' }, // Maracanã Stadium
  '5534':  { tz: 'Europe/London',                displayCity: 'London' },         // Tottenham Hotspur Stadium
  '2455':  { tz: 'Europe/London',                displayCity: 'London' },         // Wembley Stadium
  '1781':  { tz: 'Europe/Paris',                 displayCity: 'Paris' },          // Stade de France (Saint-Denis normalized to Paris)
  '11930': { tz: 'Europe/Berlin',                displayCity: 'Munich' },         // FC Bayern Munich Stadium
  '8219':  { tz: 'America/Mexico_City',          displayCity: 'Mexico City' },    // Estadio Banorte
  '1353':  { tz: 'Europe/Madrid',                displayCity: 'Madrid' },         // Santiago Bernabéu
};

// Primetime detection set. Match is token-wise after splitting `broadcast`
// on `,` and `/`. ESPN uses "NFL Net" (not "NFL Network") in its
// scoreboard payloads; both forms are accepted. ESPN/ABC simulcasts split
// to two tokens; either matching the set flips primetime true.
// International games are explicitly excluded — London windows on NBC
// Sport or NFL Net at 9:30 AM ET are not primetime in any meaningful
// sense; the international gate is cleaner than a kickoff-hour check.
//
// Netflix is included because the NFL-Netflix deal is structured around
// showcase-window games (Christmas Day, Thanksgiving-week night). The
// platform doesn't change the framing. If Netflix expands to non-
// primetime daytime slots in future seasons (international or backup
// TNF), revisit this set.
const PRIMETIME_NETWORKS = new Set([
  'NBC',
  'ESPN',
  'ABC',
  'Prime Video',
  'Amazon Prime Video',
  'NFL Network',
  'NFL Net',
  'Netflix',
]);

// ── Types ──────────────────────────────────────────────────────────────

interface EspnTeamRef {
  homeAway: 'home' | 'away';
  team: { id: string };
}

interface EspnVenue {
  id: string;
  fullName: string;
  address?: { city?: string; state?: string; country?: string };
  indoor?: boolean;
}

interface EspnCompetition {
  venue: EspnVenue;
  competitors: EspnTeamRef[];
  broadcast?: string;
  neutralSite?: boolean;
  // ESPN flag: false when the kickoff time is a TBD placeholder (typically
  // 05:00Z = midnight Eastern). Late-season Sunday games carry false
  // until flex windows are announced.
  timeValid?: boolean;
}

interface EspnEvent {
  id: string;
  date: string;
  week?: { number: number };
  competitions: EspnCompetition[];
}

interface EspnScoreboard {
  events: EspnEvent[];
}

export interface IngestNflOptions {
  log?: (msg: string) => void;
  execute?: boolean;
  startWeek?: number;
  endWeek?: number;
  year?: number;
}

export interface IngestNflStats {
  totalFetched: number;
  prepared: number;
  upserted: number;
  skippedBadDate: number;
  international: number;
  primetime: number;
  timeTbd: number;
  mappingErrors: { teamIds: string[]; venueIds: string[] };
  errors: number;
}

// ── Helpers ────────────────────────────────────────────────────────────

function ymdInTz(utcIso: string, tz: string): string {
  const date = new Date(utcIso);
  if (Number.isNaN(date.getTime())) return '';
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
}

function utcHhmm(utcIso: string): string {
  const d = new Date(utcIso);
  if (Number.isNaN(d.getTime())) return '';
  return d.toISOString().slice(11, 16);
}

function classifyBroadcast(
  raw: string | undefined,
  isInternational: boolean,
): { network: string; isPrimetime: boolean } | null {
  const trimmed = (raw || '').trim();
  if (!trimmed) return null;
  const tokens = trimmed.split(/[,/]/).map((t) => t.trim()).filter(Boolean);
  const anyPrimetime = tokens.some((t) => PRIMETIME_NETWORKS.has(t));
  return { network: trimmed, isPrimetime: anyPrimetime && !isInternational };
}

// ── Main ───────────────────────────────────────────────────────────────

export async function ingestNflSchedule(opts: IngestNflOptions = {}): Promise<IngestNflStats> {
  const log = opts.log ?? (() => {});
  const startWeek = opts.startWeek ?? 1;
  const endWeek = opts.endWeek ?? 18;
  const year = opts.year ?? new Date().getUTCFullYear();
  const execute = opts.execute === true;

  const stats: IngestNflStats = {
    totalFetched: 0,
    prepared: 0,
    upserted: 0,
    skippedBadDate: 0,
    international: 0,
    primetime: 0,
    timeTbd: 0,
    mappingErrors: { teamIds: [], venueIds: [] },
    errors: 0,
  };

  // Pass 1: fetch + prepare every week. Mapping misses are collected but
  // do not abort fetching; the run aborts before any writes if any
  // mapping miss surfaced.
  const docs: Array<{ id: string; data: Record<string, unknown> }> = [];

  for (let wk = startWeek; wk <= endWeek; wk++) {
    const url = `https://site.api.espn.com/apis/site/v2/sports/football/nfl/scoreboard?seasontype=2&week=${wk}&dates=${year}`;
    log(`fetch week ${wk}: ${url}`);
    const res = await fetch(url);
    if (!res.ok) throw new Error(`ESPN API ${res.status} ${res.statusText} on week ${wk}`);
    const payload = (await res.json()) as EspnScoreboard;
    const events = payload.events ?? [];
    stats.totalFetched += events.length;
    log(`  week ${wk}: ${events.length} events`);

    for (const event of events) {
      const comp = event.competitions?.[0];
      if (!comp || !event.id || !event.date) continue;

      const venueId = comp.venue?.id;
      const venueName = comp.venue?.fullName ?? '';
      const country = comp.venue?.address?.country ?? 'USA';
      const isInternational = country !== 'USA';

      const venueInfo = ESPN_VENUE_ID_TO_INFO[venueId];
      if (!venueInfo) {
        if (!stats.mappingErrors.venueIds.includes(venueId)) {
          stats.mappingErrors.venueIds.push(`${venueId} (${venueName} / ${comp.venue?.address?.city ?? '?'}, ${country})`);
        }
        continue;
      }

      const homeC = comp.competitors.find((c) => c.homeAway === 'home');
      const awayC = comp.competitors.find((c) => c.homeAway === 'away');
      if (!homeC || !awayC) continue;
      const homeSlug = ESPN_TEAM_ID_TO_SLUG[homeC.team.id];
      const awaySlug = ESPN_TEAM_ID_TO_SLUG[awayC.team.id];
      if (!homeSlug && !stats.mappingErrors.teamIds.includes(homeC.team.id)) {
        stats.mappingErrors.teamIds.push(homeC.team.id);
      }
      if (!awaySlug && !stats.mappingErrors.teamIds.includes(awayC.team.id)) {
        stats.mappingErrors.teamIds.push(awayC.team.id);
      }
      if (!homeSlug || !awaySlug) continue;

      const localDate = ymdInTz(event.date, venueInfo.tz);
      if (!/^\d{4}-\d{2}-\d{2}$/.test(localDate)) {
        stats.skippedBadDate++;
        continue;
      }

      const gameTime = utcHhmm(event.date);
      const broadcast = classifyBroadcast(comp.broadcast, isInternational);
      const internationalLocation = isInternational ? venueInfo.displayCity : null;
      const timeTbd = comp.timeValid === false;

      if (isInternational) stats.international++;
      if (broadcast?.isPrimetime) stats.primetime++;
      if (timeTbd) stats.timeTbd++;

      const docId = `nfl-${localDate}-${awaySlug}-at-${homeSlug}`;
      const data: Record<string, unknown> = {
        id: docId,
        league: 'nfl',
        season: year,
        seasonType: 'regular',
        week: event.week?.number ?? wk,
        date: localDate,
        gameTime,
        gameTimeTz: venueInfo.tz,
        timeTbd,
        homeTeamSlug: homeSlug,
        awayTeamSlug: awaySlug,
        venueName,
        isInternational,
        internationalLocation,
        broadcast,
        status: 'scheduled' as GameStatus,
        espnGameId: event.id,
        ingestedAt: FieldValue.serverTimestamp(),
      };

      docs.push({ id: docId, data });
      stats.prepared++;
      const broadcastTag = broadcast
        ? ` | ${broadcast.network}${broadcast.isPrimetime ? ' [PRIMETIME]' : ''}`
        : '';
      const intlTag = isInternational ? ` [${internationalLocation}]` : '';
      const tbdTag = timeTbd ? ' [TBD]' : '';
      log(`  ${docId} | wk${event.week?.number ?? wk} | ${awaySlug} @ ${homeSlug} | ${venueName}${intlTag} | ${gameTime}Z ${venueInfo.tz}${tbdTag}${broadcastTag}`);
    }
  }

  // Validation. Any mapping miss aborts the run before any writes.
  if (stats.mappingErrors.teamIds.length > 0 || stats.mappingErrors.venueIds.length > 0) {
    log('');
    log('=== MAPPING ERRORS ===');
    if (stats.mappingErrors.teamIds.length > 0) {
      log(`  Unknown ESPN team ids: ${stats.mappingErrors.teamIds.join(', ')}`);
    }
    if (stats.mappingErrors.venueIds.length > 0) {
      log('  Unknown ESPN venue ids:');
      for (const v of stats.mappingErrors.venueIds) log(`    - ${v}`);
    }
    throw new Error('Mapping errors detected. Add missing ids to ESPN_TEAM_ID_TO_SLUG / ESPN_VENUE_ID_TO_INFO in src/lib/ingest-nfl.ts before re-running.');
  }

  if (!execute) {
    log('');
    log(`[ingest-nfl] DRY-RUN complete. ${docs.length} game docs would be written to collection 'games'.`);
    return stats;
  }

  // Writes. Batches of 400 mirror MLB; 272 games fits in one batch.
  const BATCH_SIZE = 400;
  for (let i = 0; i < docs.length; i += BATCH_SIZE) {
    const batch = db.batch();
    const slice = docs.slice(i, i + BATCH_SIZE);
    for (const { id, data } of slice) {
      batch.set(db.collection('games').doc(id), data, { merge: true });
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

  return stats;
}
