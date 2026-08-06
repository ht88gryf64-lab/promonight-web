import type { Team } from './types';
import type { GameContext } from './data';

// Same-division siblings derived from the schedule, not from a teams query.
// enrichGamesForTeam already fetches the FULL Team doc of every distinct
// opponent into GameContext.opponentTeam, and in both leagues that carry game
// docs (MLB, NFL) every division rival is an opponent, so the rivals set is
// recoverable from data the page has already paid for: zero extra Firestore
// reads. Leagues without game docs get [] here and render no module; wiring
// them means a getAllTeams() scan and belongs to a later slice (cache()-wrap
// getAllTeams first).
//
// opponentTeam is null when an opponent's team doc is missing (enrichGames
// only sets resolved teams), so the null-check is load-bearing, not defensive
// decoration. Sorted by city so the grid is deterministic across renders
// regardless of schedule order.
export function getDivisionRivals(team: Team, gameContexts?: GameContext[]): Team[] {
  if (!gameContexts || gameContexts.length === 0) return [];
  const rivals = new Map<string, Team>();
  for (const ctx of gameContexts) {
    const opp = ctx.opponentTeam;
    if (!opp || opp.id === team.id) continue;
    if (opp.league !== team.league || opp.division !== team.division) continue;
    if (!rivals.has(opp.id)) rivals.set(opp.id, opp);
  }
  return [...rivals.values()].sort((a, b) => a.city.localeCompare(b.city));
}
