// Which teams the success state offers as one-tap adds, and in what order.
//
// LOCALSTORAGE ONLY. A chip tap writes the starred set and nothing else: no
// POST, no deferred write, no dismiss-triggered request. What carries a chipped
// team to Firestore is the confirm-time seed already built into PreferencesForm,
// which unions the local stars into the picker when /api/confirm redirects the
// visitor there. That path exists, so a second write path here would be a second
// source of truth for the same fact.
//
// TWO SOURCES, IN PRIORITY ORDER, AND NEITHER IS GEO.
//   1. Opponents from games the visitor actually expanded. This is the strongest
//      signal on the page: they opened that matchup themselves.
//   2. Teams sharing the venue city string in lib/venue-cities.ts.
// Geo is deliberately absent. Precise coordinates are server-only (the
// x-vercel-ip-* headers read in api/subscribe) and no client coords table
// exists, so a geo rule here would be inventing plumbing to guess at something
// rule 1 already knows for certain.
//
// COVERAGE, HONESTLY. VENUE_CITY_OVERRIDES is a fallback table for hotel links,
// not a venue-city census: it holds only the teams whose BRAND city differs from
// their stadium city, about two dozen of 167. So rule 2 fires on the handful of
// shared-suburb pairs (Cowboys/Rangers in Arlington, Giants/Jets in East
// Rutherford, Patriots/Revolution in Foxborough, Rams/Chargers in Inglewood) and
// on nothing else. It is a top-up, not the mechanism. Rule 1 is what fills the
// row on a normal team page, and it is available on every team page because the
// trigger itself is driven by the same game gestures.
//
// Pure and dependency-free so the whole ordering rule is testable without a DOM.

/** The minimum a chip needs to render, star and report itself. */
export interface CaptureChipTeam {
  id: string;
  /**
   * Short nickname (Team.name). The chip label and the confirmation line use
   * this. Three chips have to fit one row at 320px, and "Cleveland Guardians"
   * does not.
   */
  name: string;
  /**
   * City + nickname (teamDisplayName). The prompt heading and the first success
   * sentence use this, where there is room and the full name reads better.
   */
  displayName: string;
  /** Carried so a chip tap can hand useStarredTeams the same meta a star button would. */
  league: string;
  sportSlug: string;
}

/**
 * The page team, in the same shape a chip uses. It is not a chip (it is starred
 * by the submit, not by a tap) but it needs exactly the same four fields, and a
 * parallel interface would be two things to keep in step.
 */
export type CaptureTeamRef = CaptureChipTeam;

export type ChipSource = 'opponent' | 'venue_city';

export interface CaptureChip extends CaptureChipTeam {
  source: ChipSource;
}

/**
 * Everything a chip COULD be, resolved on the server and handed to the client
 * whole. The client picks from it; it never fetches.
 */
export interface CaptureChipPool {
  /** Distinct opponents across the page team's schedule. */
  opponents: CaptureChipTeam[];
  /** Teams sharing this team's venue city string. */
  venueCity: CaptureChipTeam[];
}

export const EMPTY_CHIP_POOL: CaptureChipPool = { opponents: [], venueCity: [] };

/**
 * Hard cap. Four wraps to a second row on a 320px screen, and a second row
 * pushes the success state past the height the prompt state set, which is the
 * jump the fixed container exists to prevent.
 */
export const MAX_CHIPS = 3;

/**
 * Slugs of teams whose venue city string matches this team's.
 *
 * Exact string equality on the table's own values, not a normalized or
 * geocoded comparison. The values are hand-written and already consistent
 * ("Arlington, TX"), and loosening the match would start pairing teams that
 * merely share a state.
 */
export function venueCitySiblingSlugs(
  teamId: string,
  overrides: Record<string, string>,
): string[] {
  const city = overrides[teamId];
  if (!city) return [];
  return Object.keys(overrides).filter((slug) => slug !== teamId && overrides[slug] === city);
}

export interface SelectChipsInput {
  pool: CaptureChipPool;
  /**
   * Slugs of opponents from games the visitor expanded, MOST RECENT FIRST. The
   * client collects these from the opponent_slug already carried on game_tap and
   * away_game_expanded, so nothing new has to be threaded through the calendar.
   */
  expandedOpponentIds: readonly string[];
  /**
   * Never offer these. Two groups end up here: the page team, which the submit
   * already starred, and everything the visitor has starred before, which would
   * make a chip a no-op dressed as an offer.
   */
  excludeIds: readonly string[];
}

/**
 * The chips to render, in order, capped.
 *
 * Expanded opponents first and in the order they were expanded, so the most
 * recent matchup leads. Venue-city siblings fill whatever is left. An opponent
 * slug with no entry in the pool is skipped rather than guessed at: the pool is
 * built from the same schedule the events came from, so a miss means stale data,
 * and a chip with no name is worse than one fewer chip.
 */
export function selectChips(input: SelectChipsInput): CaptureChip[] {
  const { pool, expandedOpponentIds, excludeIds } = input;

  const byId = new Map(pool.opponents.map((t) => [t.id, t]));
  const blocked = new Set(excludeIds);
  const taken = new Set<string>();
  const chips: CaptureChip[] = [];

  const push = (team: CaptureChipTeam | undefined, source: ChipSource) => {
    if (!team) return;
    if (blocked.has(team.id) || taken.has(team.id)) return;
    if (chips.length >= MAX_CHIPS) return;
    taken.add(team.id);
    chips.push({ ...team, source });
  };

  for (const id of expandedOpponentIds) push(byId.get(id), 'opponent');
  for (const team of pool.venueCity) push(team, 'venue_city');

  return chips;
}
