// Promo-to-game join for the time and opponent slots on the cross-team promo
// surfaces (/promos/today, the homepage Tonight and Best Promos rails, and
// /best-promos).
//
// WHY A JOIN. A promo doc stores `time` and `opponent` as text the scanner read
// off the club's page, and in the week of 2026-10-29 37 of the 104 promos those
// surfaces listed carried no time at all (Phase 0 audit, question 1). The games
// spine holds the same facts for every MLB, NFL, NHL and NBA home date, so a
// card whose stored slot is empty borrows the game's value instead of rendering
// nothing.
//
// RULES.
//  - Stored wins. A non-empty stored `time` or `opponent` is never replaced,
//    and the stored fields are never written. The join fills the separate
//    `displayTime` / `displayOpponent` slots only (src/lib/types.ts).
//  - Pure over already-loaded games. `resolveGameForPromo` and
//    `applyGameDisplay` take a prebuilt index. The one Firestore read per
//    surface lives in data.ts (withGameDisplay), never one per promo.
//  - Home games only. `promo.team` is the host, so the key is
//    league + date + homeTeamSlug.
//  - A doubleheader (two home games on the date) resolves the opponent only
//    when both games share it, and never resolves a time: the promo doc does
//    not say which game it belongs to, and a wrong first pitch is worse than
//    none.
//  - A kickoff flagged timeTbd resolves to '' (the stored 05:00 placeholder is
//    not a time), and so does any instant the formatter cannot resolve. NBA
//    games carry no time by ruling (mapGameDoc blanks it), so an NBA row gains
//    an opponent only.
//  - A postponed or canceled game is not a game. The MLB ingest upserts by
//    date, so a rained-out game's original-date doc stays behind reading
//    'postponed' with its old first pitch (src/lib/schedule-months.ts rule 2);
//    the join skips it rather than print a start that will not happen.
//  - The opponent is the away club's nickname (`Team.name`, "Grizzlies"), the
//    shape the scanner stores, so a joined value reads like a stored one.
//  - In-place. `applyGameDisplay` mutates the row objects it is given rather
//    than copying them: data.ts tracks ticket-package rows by object identity
//    (ticketPackageRows), and a copy would fall out of that set.
import type { Game, Promo, PromoWithTeam, Team } from './types';
import type { GameContext } from './data';
import { formatGameTime } from './format-game-time';

export interface ResolvedGame {
  /** "7:10 PM" in venue time, or '' when the join cannot state one. */
  time: string;
  /** Away club nickname, or '' when unknown or ambiguous. */
  opponent: string;
  /** The game doc's venueName, '' when absent. */
  venueName: string;
  /** Every home game on the date, doubleheader order. */
  games: Game[];
}

export type GameIndex = ReadonlyMap<string, Game[]>;

/** Leagues whose spine the join can read at all (same set as data.ts GAME_LEAGUES). */
export const JOIN_LEAGUES: readonly string[] = ['mlb', 'nfl', 'nhl', 'nba'];
/** Leagues whose spine carries a start time. NBA stores none by ruling. */
export const JOIN_TIME_LEAGUES: readonly string[] = ['mlb', 'nfl', 'nhl'];

export function gameIndexKey(league: string, date: string, homeTeamSlug: string): string {
  return `${league}|${date}|${homeTeamSlug}`;
}

function byDoubleheaderOrder(a: Game, b: Game): number {
  const adh = a.doubleheaderGame ?? 0;
  const bdh = b.doubleheaderGame ?? 0;
  if (adh !== bdh) return adh - bdh;
  return (a.gameTime || '').localeCompare(b.gameTime || '');
}

export function buildGameIndex(games: readonly Game[]): GameIndex {
  const index = new Map<string, Game[]>();
  for (const g of games) {
    if (!g.league || !g.date || !g.homeTeamSlug) continue;
    const key = gameIndexKey(g.league, g.date, g.homeTeamSlug);
    const list = index.get(key) ?? [];
    list.push(g);
    index.set(key, list);
  }
  for (const list of index.values()) list.sort(byDoubleheaderOrder);
  return index;
}

// The shape a stored promo time takes ("7:10 PM"). formatGameTime returns the
// raw "19:10" when it cannot resolve the instant; that is not a display value.
// Newer ICU builds put a narrow no-break space (U+202F) before AM/PM; the
// stored promos use a plain space, so the label is normalized to match (the
// postseason view does the same by assembling parts).
const CLOCK_RE = /^\d{1,2}:\d{2} [AP]M$/;

/** A clock label in the stored shape, or '' when the input is not one. */
export function normalizeClockLabel(label: string): string {
  const plain = label.replace(/\u202F/g, ' ');
  return CLOCK_RE.test(plain) ? plain : '';
}

function gameDisplayTime(g: Game): string {
  if (g.timeTbd === true) return '';
  if (!g.gameTime) return '';
  return normalizeClockLabel(formatGameTime(g.gameTimeTz, g.gameTime, g.date));
}

/** The home game(s) behind a promo, or null when the spine has none for that
 *  league, date and host. Pure: reads only the index and the team map. */
export function resolveGameForPromo(
  promo: { date: string; team: Pick<Team, 'id' | 'sportSlug'> },
  index: GameIndex,
  teamsById: ReadonlyMap<string, Pick<Team, 'name'>>,
): ResolvedGame | null {
  const games = (index.get(gameIndexKey(promo.team.sportSlug, promo.date, promo.team.id)) ?? []).filter(
    (g) => g.status !== 'postponed' && g.status !== 'canceled',
  );
  if (games.length === 0) return null;
  const awaySlugs = new Set(games.map((g) => g.awayTeamSlug));
  const opponent = awaySlugs.size === 1 ? (teamsById.get(games[0].awayTeamSlug)?.name ?? '') : '';
  const time = games.length === 1 ? gameDisplayTime(games[0]) : '';
  return { time, opponent, venueName: games[0].venueName ?? '', games };
}

/** True when the join could still fill a slot on this row: a games league, and
 *  an empty slot that league's spine can provide. Lets a loader skip the games
 *  read entirely when every row already carries both values. */
export function needsGameDisplay(p: Pick<PromoWithTeam, 'time' | 'opponent' | 'team'>): boolean {
  const league = p.team.sportSlug;
  if (!JOIN_LEAGUES.includes(league)) return false;
  if (!p.opponent) return true;
  return !p.time && JOIN_TIME_LEAGUES.includes(league);
}

/** Fill displayTime / displayOpponent on every row: the stored value when it
 *  is non-empty, else the resolved game value, else ''. Returns the same array. */
export function applyGameDisplay<T extends PromoWithTeam>(
  rows: T[],
  index: GameIndex,
  teamsById: ReadonlyMap<string, Pick<Team, 'name'>>,
): T[] {
  for (const p of rows) {
    const storedTime = p.time || '';
    const storedOpponent = p.opponent || '';
    p.displayTime = storedTime;
    p.displayOpponent = storedOpponent;
    if (storedTime && storedOpponent) continue;
    const resolved = resolveGameForPromo(p, index, teamsById);
    if (!resolved) continue;
    if (!storedTime && resolved.time) p.displayTime = resolved.time;
    if (!storedOpponent && resolved.opponent) p.displayOpponent = resolved.opponent;
  }
  return rows;
}

// ── Team page: the same join over the contexts the page already holds ───────
//
// A team page loads its season (getGamesForTeam) and resolves every game's
// opponent (enrichGamesForTeam) before it renders, so the join there costs no
// read at all: the index is the page's own home contexts and the opponent map
// is the `opponentTeam` each context already carries. Same resolver, same
// rules as the cross-team surfaces, so a promo shows the same time on its team
// page as it does on /promos/today.
export function applyGameDisplayForTeam(
  promos: Promo[],
  team: Pick<Team, 'id' | 'sportSlug'>,
  contexts: readonly GameContext[],
): Promo[] {
  const home = contexts.filter((c) => c.isHome);
  const index = buildGameIndex(home.map((c) => c.game));
  const teamsById = new Map<string, Pick<Team, 'name'>>();
  for (const c of home) if (c.opponentTeam) teamsById.set(c.opponentTeam.id, c.opponentTeam);
  for (const p of promos) {
    const storedTime = p.time || '';
    const storedOpponent = p.opponent || '';
    p.displayTime = storedTime;
    p.displayOpponent = storedOpponent;
    if (storedTime && storedOpponent) continue;
    const resolved = resolveGameForPromo({ date: p.date, team }, index, teamsById);
    if (!resolved) continue;
    if (!storedTime && resolved.time) p.displayTime = resolved.time;
    if (!storedOpponent && resolved.opponent) p.displayOpponent = resolved.opponent;
  }
  return promos;
}
