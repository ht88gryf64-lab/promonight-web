import 'server-only';
import { db } from './firebase';
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
  };

  const docs: Array<{ id: string; data: Record<string, unknown> }> = [];
  for (const day of schedule.dates) {
    for (const g of day.games) {
      const dateYmd = g.officialDate || day.date;
      if (!/^\d{4}-\d{2}-\d{2}$/.test(dateYmd)) { stats.skippedBadDate++; continue; }
      const homeSlug = MLB_TEAM_ID_TO_SLUG[g.teams.home.team.id];
      const awaySlug = MLB_TEAM_ID_TO_SLUG[g.teams.away.team.id];
      if (!homeSlug || !awaySlug) { stats.skippedMissingSlug++; continue; }

      let gameTime = '';
      let gameTimeTz = '';
      try {
        const d = new Date(g.gameDate);
        if (!Number.isNaN(d.getTime())) {
          gameTime = d.toISOString().slice(11, 16);
          gameTimeTz = 'UTC';
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
        venueName: g.venue?.name ?? '',
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

  return stats;
}
