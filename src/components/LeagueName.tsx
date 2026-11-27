// A league's display name as JSX (MiLB Phase 1, ux-review 2026-11-27).
//
// Much of the site sets league names in uppercase CSS (eyebrows, pills, card
// kickers), and `text-transform: uppercase` renders "MiLB" as "MILB": the DOM
// text was right and the screen was wrong. A label that already reads in
// capitals (every league but MILB) is returned as plain text, exactly what
// `{leagueLabel(x)}` rendered, so no existing page changes; a mixed-case label
// keeps its case through any uppercase ancestor.
import { leagueLabel } from '@/lib/league-label';

export function LeagueName({ league }: { league: string }) {
  const label = leagueLabel(league);
  return label === label.toUpperCase() ? <>{label}</> : <span className="normal-case">{label}</span>;
}
