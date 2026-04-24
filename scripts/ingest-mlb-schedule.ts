/* eslint-disable no-console */
// Fetches the full 2026 MLB schedule from the MLB Stats API and upserts each
// game into the `games` Firestore collection.
//
// Usage: npx tsx --require ./scripts/stub-server-only.cjs scripts/ingest-mlb-schedule.ts
//
// The document id is deterministic (mlb-{date}-{away}-at-{home}[-g{n}] for
// doubleheaders) so re-running is idempotent.

import { db } from '../src/lib/firebase';
import { MLB_TEAM_ID_TO_SLUG } from '../src/lib/mlb-team-ids';
import type { GameStatus } from '../src/lib/types';

const SEASON_START = '2026-03-27'; // Earliest opener typical — Stats API will return games in this window.
const SEASON_END = '2026-11-15'; // Covers regular season + postseason window.

interface StatsApiGame {
  gamePk: number;
  gameDate: string; // ISO with time — e.g. "2026-04-24T02:10:00Z"
  officialDate?: string; // Local-date YYYY-MM-DD (when present)
  doubleHeader?: 'Y' | 'N' | 'S';
  gameNumber?: number;
  gameType?: string; // R, P, F, D, L, W, E, A, S
  status?: {
    abstractGameState?: string;
    detailedState?: string;
    codedGameState?: string;
  };
  teams: {
    home: { team: { id: number; name: string } };
    away: { team: { id: number; name: string } };
  };
  venue?: { id?: number; name?: string };
}

interface ScheduleDate {
  date: string;
  games: StatsApiGame[];
}

interface ScheduleResponse {
  dates: ScheduleDate[];
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

async function fetchSchedule(): Promise<ScheduleResponse> {
  // gameType: R (regular), P (postseason), F (wildcard), D (div series),
  // L (league championship), W (world series). Fetching R+P+F+D+L+W covers
  // the full season for our purposes.
  const url = new URL('https://statsapi.mlb.com/api/v1/schedule');
  url.searchParams.set('sportId', '1');
  url.searchParams.set('startDate', SEASON_START);
  url.searchParams.set('endDate', SEASON_END);
  url.searchParams.set('gameType', 'R,P,F,D,L,W');
  console.log(`Fetching ${url.toString()}`);
  const res = await fetch(url.toString());
  if (!res.ok) {
    throw new Error(`MLB Stats API ${res.status} ${res.statusText}`);
  }
  return (await res.json()) as ScheduleResponse;
}

async function main() {
  const schedule = await fetchSchedule();
  const totalGames = schedule.totalGames ?? schedule.dates.reduce((n, d) => n + d.games.length, 0);
  console.log(`API returned ${schedule.dates.length} dates / ${totalGames} games`);

  const stats = {
    upserted: 0,
    skippedMissingSlug: 0,
    skippedBadDate: 0,
    errors: 0,
    postseason: 0,
    doubleheaders: 0,
  };

  // Batch writes in groups of 400 (Firestore limit is 500 per batch; keep
  // headroom for safety).
  const BATCH_SIZE = 400;
  const gameDocs: Array<{ id: string; data: Record<string, unknown> }> = [];

  for (const day of schedule.dates) {
    for (const g of day.games) {
      const dateYmd = g.officialDate || day.date;
      if (!/^\d{4}-\d{2}-\d{2}$/.test(dateYmd)) {
        stats.skippedBadDate++;
        continue;
      }

      const homeSlug = MLB_TEAM_ID_TO_SLUG[g.teams.home.team.id];
      const awaySlug = MLB_TEAM_ID_TO_SLUG[g.teams.away.team.id];
      if (!homeSlug || !awaySlug) {
        stats.skippedMissingSlug++;
        console.warn(
          `skip gamePk=${g.gamePk}: unmapped team(s) home=${g.teams.home.team.id}/${g.teams.home.team.name} away=${g.teams.away.team.id}/${g.teams.away.team.name}`,
        );
        continue;
      }

      // Parse time and timezone from the ISO gameDate (UTC). We intentionally
      // do NOT convert to home-venue local — downstream code renders using the
      // home venue's timezone from the venue doc if needed. Store ISO time.
      let gameTime = '';
      let gameTimeTz = '';
      try {
        const d = new Date(g.gameDate);
        if (!Number.isNaN(d.getTime())) {
          gameTime = d.toISOString().slice(11, 16); // HH:MM UTC
          gameTimeTz = 'UTC';
        }
      } catch {
        // ignore — optional field
      }

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

      gameDocs.push({ id, data });
    }
  }

  console.log(`Prepared ${gameDocs.length} game docs for upsert`);

  for (let i = 0; i < gameDocs.length; i += BATCH_SIZE) {
    const batch = db.batch();
    const slice = gameDocs.slice(i, i + BATCH_SIZE);
    for (const { id, data } of slice) {
      batch.set(db.collection('games').doc(id), data, { merge: true });
    }
    try {
      await batch.commit();
      stats.upserted += slice.length;
      console.log(`  committed batch ${i / BATCH_SIZE + 1} (${slice.length} docs, total upserted=${stats.upserted})`);
    } catch (e) {
      stats.errors++;
      console.error(`  batch commit error:`, (e as Error).message);
    }
  }

  console.log('');
  console.log('=== Ingestion summary ===');
  console.log(`  Total fetched:         ${totalGames}`);
  console.log(`  Upserted:              ${stats.upserted}`);
  console.log(`  Postseason:            ${stats.postseason}`);
  console.log(`  Doubleheader games:    ${stats.doubleheaders}`);
  console.log(`  Skipped (bad date):    ${stats.skippedBadDate}`);
  console.log(`  Skipped (slug miss):   ${stats.skippedMissingSlug}`);
  console.log(`  Errors:                ${stats.errors}`);
  console.log('');
  process.exit(stats.errors > 0 ? 1 : 0);
}

main().catch((e) => { console.error(e); process.exit(1); });
