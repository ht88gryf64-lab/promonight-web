// The display label of a league code (MiLB Phase 1 ruling, 2026-11-27).
//
// League codes are stored uppercase ("MLB", "MILB") because every key in both
// repos is: scannerState/{LEAGUE}, windows.json, team-configs. A code is shown
// as itself, except where the sport writes it otherwise: Minor League Baseball
// is "MiLB", never "MILB". Every place a team's league is RENDERED goes through
// leagueLabel; keys, URLs, filters and analytics keep the code. For every
// league but MILB this returns its input unchanged, so no existing page moves.
const LEAGUE_LABELS: Readonly<Record<string, string>> = Object.freeze({ MILB: 'MiLB' });

export function leagueLabel(league: string): string {
  return Object.prototype.hasOwnProperty.call(LEAGUE_LABELS, league) ? LEAGUE_LABELS[league] : league;
}
