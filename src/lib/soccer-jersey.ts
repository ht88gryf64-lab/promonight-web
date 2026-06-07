import type { Promo } from './types';

// Soccer-jersey-night detection, shared by the /promos/soccer-jersey-nights
// aggregator, the World Cup hub teaser, and the host-card UI.
//
// A jersey/kit signal is always required. The soccer signal requirement is
// league-aware:
//   - Soccer leagues (MLS): a jersey/kit signal ALONE qualifies. Every MLS kit
//     giveaway is by definition a soccer jersey, and MLS has no non-soccer
//     jerseys, so there is zero false-positive risk.
//   - All other leagues (MLB, WNBA, NBA, NHL, NFL): the strict dual-signal rule
//     stands (jersey/kit AND an explicit soccer / futbol / World Cup / FIFA
//     word), so a generic baseball jersey giveaway is never mislabeled.
const JERSEY_SIGNAL = /\b(jersey|kit|maillot|camiseta)\b/i;
// High-precision soccer signal only. Deliberately excludes ambiguous terms like
// "pitch" (baseball "first pitch"), "FC", and "football" (NFL).
const SOCCER_SIGNAL = /\b(soccer|f[uú]tbol|world\s*cup|fifa)\b/i;

// Leagues whose jerseys are inherently soccer jerseys. MLS is the only one we
// cover today. Matched against Team.league (uppercase, e.g. "MLS").
const SOCCER_LEAGUES = new Set<string>(['MLS']);

export function isSoccerJerseyPromo(promo: Promo, league?: string): boolean {
  const text = `${promo.title} ${promo.description}`;
  if (!JERSEY_SIGNAL.test(text)) return false;
  if (league && SOCCER_LEAGUES.has(league)) return true;
  return SOCCER_SIGNAL.test(text);
}
