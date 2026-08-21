import type { PromoWithTeam } from '@/lib/types';
import { LEAGUE_ORDER } from '@/lib/types';

// League tab order for the redesigned team finder, DERIVED from live
// inventory instead of the fixed LEAGUE_ORDER constant (the league-agnostic
// standing constraint: in August the page is MLB-heavy, in December it is
// NFL/NHL/NBA, and both must be correct without a code change).
//
// Order: upcoming-promo count per league, descending; ties (including the
// all-zero offseason leagues) fall back to the canonical LEAGUE_ORDER index
// so the result is fully deterministic and SSR/hydration-stable. Every league
// keeps its tab even at zero promos: the tab filters TEAMS, and a team page
// with no upcoming promos is still a valid destination (schedule, venue,
// rivals). Zero new reads; counts come from the corpus the homepage already
// fetches.
export function deriveLeagueOrder(allFuture: PromoWithTeam[]): string[] {
  const counts = new Map<string, number>();
  for (const p of allFuture) {
    counts.set(p.team.league, (counts.get(p.team.league) ?? 0) + 1);
  }
  return [...LEAGUE_ORDER].sort(
    (a, b) =>
      (counts.get(b) ?? 0) - (counts.get(a) ?? 0) ||
      LEAGUE_ORDER.indexOf(a) - LEAGUE_ORDER.indexOf(b),
  );
}
