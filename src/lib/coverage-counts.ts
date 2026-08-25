import type { Team } from '@/lib/types';
import { LEAGUE_ORDER, SCORED_LEAGUES } from '@/lib/types';

/**
 * Coverage facts every surface states from ONE derivation.
 *
 * WHY. The team count, the league list and the college-program count were
 * typed by hand in more than twenty places (root description, both footers,
 * six promo collections, the team FAQs on 169 pages, llms.txt, /teams,
 * /follow, the my-teams empty state, the star picker placeholder), in three
 * different league orders, and none of them had an alarm that would fire when
 * the data moved. /about and the homepage each derived their own copy of the
 * same numbers with their own private helpers. This module is that derivation,
 * once, and the pure half is testable without Firestore.
 *
 * THE CFB RULE. The 169 teams span SIX pro leagues. The college football
 * schools are a separate collection with no promo data and no scores, so they
 * are carried as `cfbSchoolCount` and never folded into `teamCount` or
 * `leagueCount`. Copy that names both says "N teams across six leagues, plus
 * M college football programs", never "seven leagues".
 *
 * ORDER. League lists render in LEAGUE_ORDER. Three orders used to coexist
 * (canonical, NHL-before-NFL, and the /venues index order) and none of them was
 * chosen; this collapses the copy on the canonical one.
 */

/** The leagues the native app covers. A fact about the Flutter app, not about
 *  the website's data, so it is a constant here rather than a Firestore read.
 *  Every "the app covers ..." sentence renders from this list. */
export const APP_LEAGUES = ['MLB', 'NBA', 'NHL', 'MLS'] as const;

export interface CoverageCounts {
  /** Pro teams in the teams collection. Never includes college programs. */
  teamCount: number;
  /** Distinct pro leagues among those teams. */
  leagueCount: number;
  /** Pro leagues in canonical order, then any league the data carries that the
   *  constant does not, so a new league appears without a code change. */
  leagues: string[];
  /** "MLB, NBA, NFL, NHL, MLS, and WNBA" */
  leagueList: string;
  /** [league, teams] in canonical order. */
  leagueBreakdown: Array<[string, number]>;
  /** League names ordered by how many teams each contributes, alphabetical
   *  tiebreak. Kept for the one surface (the homepage founder block) that
   *  deliberately orders by size under the league-agnostic rule. */
  leagueNamesBySize: string[];
  /** College football programs in cfbSchools. Separate corpus, no promos. */
  cfbSchoolCount: number;
  /** Teams in the leagues /team-rankings scores. */
  rankedTeamCount: number;
  rankedLeagues: string[];
  /** "MLB, MLS, and WNBA" */
  rankedLeagueList: string;
  /** "MLB, NBA, NHL, and MLS" */
  appLeagueList: string;
}

/** Oxford-comma list: "a, b, and c". */
export function joinList(names: readonly string[]): string {
  if (names.length <= 1) return names[0] ?? '';
  return `${names.slice(0, -1).join(', ')}, and ${names[names.length - 1]}`;
}

// Spelled-out small numbers, so deriving a count does not silently rewrite
// "six leagues" as "6 leagues".
const NUMBER_WORDS = ['zero', 'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine', 'ten'];
export function numberWord(n: number): string {
  return NUMBER_WORDS[n] ?? String(n);
}

/** Pure derivation from the two collections' contents. */
export function coverageFromTeams(teams: readonly Team[], cfbSchoolCount: number): CoverageCounts {
  const per = new Map<string, number>();
  for (const t of teams) per.set(t.league, (per.get(t.league) ?? 0) + 1);
  const leagues: string[] = LEAGUE_ORDER.filter((l) => per.has(l));
  for (const league of per.keys()) if (!leagues.includes(league)) leagues.push(league);
  const leagueBreakdown = leagues.map((l) => [l, per.get(l) as number] as [string, number]);
  const leagueNamesBySize = [...per.keys()].sort(
    (a, b) => (per.get(b) as number) - (per.get(a) as number) || a.localeCompare(b),
  );
  const scored = SCORED_LEAGUES as ReadonlySet<string>;
  const rankedLeagues = leagues.filter((l) => scored.has(l));
  const rankedTeamCount = teams.filter((t) => scored.has(t.league)).length;
  return {
    teamCount: teams.length,
    leagueCount: leagues.length,
    leagues,
    leagueList: joinList(leagues),
    leagueBreakdown,
    leagueNamesBySize,
    cfbSchoolCount,
    rankedTeamCount,
    rankedLeagues,
    rankedLeagueList: joinList(rankedLeagues),
    appLeagueList: joinList(APP_LEAGUES),
  };
}

/** Sentence fragment for "how many teams" answers: "30 MLB teams, 30 NBA
 *  teams, ..., and 15 WNBA teams". */
export function leagueSplit(breakdown: ReadonlyArray<readonly [string, number]>): string {
  return joinList(breakdown.map(([l, n]) => `${n} ${l} teams`));
}
