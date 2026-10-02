// The two rules behind the team-page schedule's regular-season list and its
// Games tile. Pure, so both are tested as arithmetic, and shared, so the list
// and the tile can never count two different populations.
import type { GameContext } from './data';

/**
 * The regular season, one entry per game actually on the schedule.
 *
 * Three kinds of document reach a team's games and are NOT a regular-season
 * game. Each was measured on production MLB data on 2026-10-01:
 *
 * 1. POSTSEASON GAMES. MLB game docs carry `isPostseason: true` and no
 *    `seasonType`, so `isRegularSeasonGame` (which reads seasonType only) lets
 *    them through. The Braves list showed three Wild Card games under "Every
 *    game of the 2026 regular season". The playoff module covers them.
 * 2. A POSTPONED GAME'S ORIGINAL DATE. The MLB ingest keys docs on date and
 *    upserts, so a postponed game leaves its original-date doc behind, still
 *    reading 'scheduled', beside the makeup doc with the SAME mlbGameId. Most
 *    clubs carry one to five of these; the Braves carried three.
 * 3. A CANCELED GAME. Never played and never made up (the Orioles and Yankees
 *    each carry one, 2026-09-27). It is not a game of the season.
 *
 * Rules 2 and 3 apply only to documents that carry an `mlbGameId`. NFL docs
 * never do, and no NFL doc sets isPostseason (ingest-nfl writes seasonType,
 * which getGamesForTeam already filters), so this is the identity on NFL:
 * same contexts, same order. The NFL golden test holds it to that.
 *
 * Among docs sharing an mlbGameId the one kept is the most settled
 * (completed, then scheduled, then postponed), latest date on a tie. A
 * duplicate is never DROPPED for lack of a better twin: one doc per id
 * always survives unless that doc is canceled.
 */
export function regularSeasonContexts(contexts: readonly GameContext[]): GameContext[] {
  const regular = contexts.filter((c) => c.game.isPostseason !== true);
  const bestById = new Map<number, GameContext>();
  for (const c of regular) {
    const id = c.game.mlbGameId;
    if (typeof id !== 'number') continue;
    const held = bestById.get(id);
    if (!held || outranks(c, held)) bestById.set(id, c);
  }
  return regular.filter((c) => {
    const id = c.game.mlbGameId;
    if (typeof id !== 'number') return true;
    if (bestById.get(id) !== c) return false;
    return c.game.status !== 'canceled';
  });
}

const SETTLED: Record<string, number> = { completed: 3, scheduled: 2, postponed: 1, canceled: 0 };

function outranks(a: GameContext, b: GameContext): boolean {
  const ra = SETTLED[a.game.status] ?? 0;
  const rb = SETTLED[b.game.status] ?? 0;
  if (ra !== rb) return ra > rb;
  return a.game.date > b.game.date;
}

const MONTHS = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];

export interface ScheduleMonth<T> {
  /** YYYY-MM, stable across renders; used as the React key. */
  key: string;
  /** "March 2026". */
  label: string;
  rows: T[];
}

/**
 * Splits date-ordered rows into calendar months.
 *
 * THE MONTH IS THE ONE PRINTED ON THE ROW. `date` is the stored game date
 * (MLB's officialDate, the home venue's local date), which is also what the
 * row's own date label shows. For every North American start it is also the
 * Eastern date: the latest regular start, 7:10 PM Pacific, is 10:10 PM
 * Eastern on the same day. The month is NEVER derived from the UTC start
 * time, which would put a 7:10 PM Pacific game on March 31 into April under a
 * row reading "Mar 31".
 *
 * Only months that hold a row get a section; a month with no games renders
 * nothing. Order within a month is the input order (so doubleheader game 1
 * stays ahead of game 2). Returns null when any date is malformed, and the
 * caller then renders the flat list rather than guessing a month. The same
 * when a month recurs after another (input not in date order).
 */
export function groupByMonth<T>(rows: readonly T[], dateOf: (row: T) => string): ScheduleMonth<T>[] | null {
  const out: ScheduleMonth<T>[] = [];
  for (const row of rows) {
    const m = /^(\d{4})-(\d{2})-\d{2}$/.exec(dateOf(row));
    const month = m ? Number(m[2]) : 0;
    if (!m || month < 1 || month > 12) return null;
    const key = `${m[1]}-${m[2]}`;
    const last = out[out.length - 1];
    if (last && last.key === key) last.rows.push(row);
    // A month seen before and then left means the input was not in date
    // order; two sections for one month would be a wrong page, so refuse.
    else if (out.some((g) => g.key === key)) return null;
    else out.push({ key, label: `${MONTHS[month - 1]} ${m[1]}`, rows: [row] });
  }
  return out;
}

/** "1 game" / "27 games". */
export const gamesLabel = (n: number): string => `${n} ${n === 1 ? 'game' : 'games'}`;
