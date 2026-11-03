// Which MLS hosts the playoffs pages may name a park for. PURE.
//
// The bracket document names a host CLUB, never a building. A park line, a
// park link and a listing on a venue page all assume the club plays at one
// ground. Some MLS clubs do not: New York City FC plays home matches at
// Yankee Stadium and at Citi Field, and its playoff ground is set match by
// match. For such a club the page names the club and no park, and the game
// is listed on no venue page (2026-11-03 review).
//
// Two sources, either one enough to withhold the park: the venue data (a
// club that is a tenant of more than one building, or of none), and this
// reviewed list of clubs whose home matches are split across grounds. On
// 2026-11-03 the venue data lists exactly one building for every MLS club,
// NYCFC included (Yankee Stadium only), so the list is what catches NYCFC.
export const MLS_CLUBS_WITH_MORE_THAN_ONE_HOME_GROUND: ReadonlySet<string> = new Set(['new-york-city-fc']);

/** The MLS host clubs that get no park line and no venue page listing. */
export function mlsHostsWithoutOneGround(hosts: readonly string[], buildingCounts: ReadonlyMap<string, number> | null): Set<string> {
  return new Set(hosts.filter((id) => MLS_CLUBS_WITH_MORE_THAN_ONE_HOME_GROUND.has(id) || !buildingCounts || buildingCounts.get(id) !== 1));
}
