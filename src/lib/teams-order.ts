// League order for the /teams sections: most upcoming promos first, so the
// busiest leagues (and the first in-content ad) sit near the top. Ties keep
// the fixed pill order. Pure, and called only on the server with counts that
// were computed there (known-issues entries 52 and 73: no clock read on the
// client decides layout). The pills themselves never reorder.
export function leaguesByUpcoming(
  pillOrder: readonly string[],
  upcomingByLeague: Readonly<Record<string, number>>,
): string[] {
  return pillOrder
    .map((league, i) => ({ league, i, n: upcomingByLeague[league] ?? 0 }))
    .sort((a, b) => b.n - a.n || a.i - b.i)
    .map((x) => x.league);
}
