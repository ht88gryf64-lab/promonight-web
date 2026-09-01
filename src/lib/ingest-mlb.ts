import 'server-only';
import { db } from './firebase';
import { resolveMlbZone } from './mlb-venue-tz';
import { MLB_TEAM_ID_TO_SLUG } from './mlb-team-ids';
import type { GameStatus } from './types';

// Pure-ish ingestion core. Both the CLI script and the /api/cron/mlb-schedule
// route call this and share stats. Logging is caller-provided so the CLI gets
// progress output while the API route can stay quiet.

export interface IngestOptions {
  startDate?: string; // YYYY-MM-DD, defaults to season opener window
  endDate?: string;   // YYYY-MM-DD, defaults to end-of-postseason window
  log?: (msg: string) => void;
}

export interface IngestStats {
  totalFetched: number;
  upserted: number;
  skippedMissingSlug: number;
  skippedBadDate: number;
  postseason: number;
  doubleheaders: number;
  errors: number;
  /** Games whose venueName is not in MLB_VENUE_TO_TZ, written with the home
   *  club's market zone instead. Correct for a park rename, an hour off for
   *  a new neutral site, and never 'UTC'. */
  venueTzFallbacks: number;
  /** Games where neither the venue nor the home club resolved to a zone.
   *  Written with an empty tz, which renders no time rather than a wrong
   *  one. Should always be zero; a non-zero value is a corrupt doc. */
  venueTzUnresolved: number;
}

interface StatsApiGame {
  gamePk: number;
  gameDate: string;
  officialDate?: string;
  doubleHeader?: 'Y' | 'N' | 'S';
  gameNumber?: number;
  gameType?: string;
  status?: { detailedState?: string };
  teams: {
    home: { team: { id: number; name: string } };
    away: { team: { id: number; name: string } };
  };
  venue?: { id?: number; name?: string };
}

interface ScheduleResponse {
  dates: { date: string; games: StatsApiGame[] }[];
  totalGames?: number;
}

function normalizeStatus(raw: string | undefined): GameStatus {
  const s = (raw || '').toLowerCase();
  if (s.includes('postpon')) return 'postponed';
  if (s.includes('cancel')) return 'canceled';
  if (s.includes('final') || s.includes('completed')) return 'completed';
  return 'scheduled';
}

function docId(dateYmd: string, awaySlug: string, homeSlug: string, gameNumber: number | undefined): string {
  const base = `mlb-${dateYmd}-${awaySlug}-at-${homeSlug}`;
  return gameNumber && gameNumber > 1 ? `${base}-g${gameNumber}` : base;
}

export async function ingestMlbSchedule(opts: IngestOptions = {}): Promise<IngestStats> {
  const log = opts.log ?? (() => {});
  const year = new Date().getUTCFullYear();
  const startDate = opts.startDate ?? `${year}-03-01`;
  const endDate = opts.endDate ?? `${year}-11-30`;

  const url = new URL('https://statsapi.mlb.com/api/v1/schedule');
  url.searchParams.set('sportId', '1');
  url.searchParams.set('startDate', startDate);
  url.searchParams.set('endDate', endDate);
  url.searchParams.set('gameType', 'R,P,F,D,L,W');

  log(`fetch ${url.toString()}`);
  const res = await fetch(url.toString());
  if (!res.ok) throw new Error(`MLB Stats API ${res.status} ${res.statusText}`);
  const schedule = (await res.json()) as ScheduleResponse;

  const totalFetched = schedule.totalGames ?? schedule.dates.reduce((n, d) => n + d.games.length, 0);
  log(`api returned ${schedule.dates.length} dates / ${totalFetched} games`);

  const stats: IngestStats = {
    totalFetched,
    upserted: 0,
    skippedMissingSlug: 0,
    skippedBadDate: 0,
    postseason: 0,
    doubleheaders: 0,
    errors: 0,
    venueTzFallbacks: 0,
    venueTzUnresolved: 0,
  };

  // Distinct venue strings the timezone map did not know, reported once at the
  // end of the run. This is the earliest point a rename or a new neutral site
  // is visible, months before anyone would notice a wrong clock on a page.
  const unmappedVenues = new Set<string>();

  const docs: Array<{ id: string; data: Record<string, unknown> }> = [];
  for (const day of schedule.dates) {
    for (const g of day.games) {
      const dateYmd = g.officialDate || day.date;
      if (!/^\d{4}-\d{2}-\d{2}$/.test(dateYmd)) { stats.skippedBadDate++; continue; }
      const homeSlug = MLB_TEAM_ID_TO_SLUG[g.teams.home.team.id];
      const awaySlug = MLB_TEAM_ID_TO_SLUG[g.teams.away.team.id];
      if (!homeSlug || !awaySlug) { stats.skippedMissingSlug++; continue; }

      const venueName = g.venue?.name ?? '';

      // gameTime stays the UTC clock of the kickoff instant, unchanged. What
      // changed on 2026-09-01 is gameTimeTz: it used to be hardcoded 'UTC',
      // which recorded the ENCODING of gameTime rather than the venue, and left
      // the renderer with nothing to convert into. It now carries the real IANA
      // venue zone, the same contract ingest-nfl.ts has always written, so
      // format-game-time.ts renders venue-local for both leagues.
      let gameTime = '';
      let gameTimeTz = '';
      try {
        const d = new Date(g.gameDate);
        if (!Number.isNaN(d.getTime())) {
          gameTime = d.toISOString().slice(11, 16);
          const zone = resolveMlbZone(venueName, homeSlug);
          // A miss falls back to the home club's market and is COUNTED, not
          // swallowed: this is where a new venue string first appears, so the
          // run summary is the earliest place a rename or a new neutral site
          // can be noticed. Never write 'UTC' back, and never write a guess
          // when neither the venue nor the club is known.
          if (zone) {
            gameTimeTz = zone.tz;
            if (zone.source === 'club') {
              stats.venueTzFallbacks++;
              unmappedVenues.add(venueName);
            }
          } else {
            stats.venueTzUnresolved++;
            unmappedVenues.add(venueName);
          }
        }
      } catch { /* optional */ }

      const isPostseason = g.gameType !== 'R' && g.gameType !== undefined;
      if (isPostseason) stats.postseason++;
      if (g.doubleHeader === 'Y' || g.doubleHeader === 'S') stats.doubleheaders++;

      const id = docId(dateYmd, awaySlug, homeSlug, g.gameNumber);
      const data: Record<string, unknown> = {
        id,
        league: 'mlb',
        date: dateYmd,
        gameTime,
        gameTimeTz,
        homeTeamSlug: homeSlug,
        awayTeamSlug: awaySlug,
        venueName,
        status: normalizeStatus(g.status?.detailedState),
        mlbGameId: g.gamePk,
      };
      if (g.gameNumber && g.gameNumber > 1) data.doubleheaderGame = g.gameNumber;
      if (isPostseason) data.isPostseason = true;
      docs.push({ id, data });
    }
  }

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

  if (unmappedVenues.size > 0) {
    log(
      `VENUE TZ MISS: ${unmappedVenues.size} venue name(s) not in MLB_VENUE_TO_TZ, ` +
        `${stats.venueTzFallbacks} game(s) written with the home club's zone and ` +
        `${stats.venueTzUnresolved} with no zone at all: ` +
        `${[...unmappedVenues].map((v) => JSON.stringify(v)).join(', ')}. ` +
        'Add them to src/lib/mlb-venue-tz.ts. A club fallback is correct for a park ' +
        'rename and an hour off for a neutral site in another zone.',
    );
  }

  return stats;
}
