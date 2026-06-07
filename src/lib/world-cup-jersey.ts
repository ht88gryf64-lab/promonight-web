import type { Promo } from './types';

// Soccer-jersey-night detection, shared by the world-cup data layer (to build
// the teaser) and the host-card UI (to highlight a qualifying game row).
//
// A promo qualifies ONLY when its text carries BOTH a jersey signal AND a
// soccer / World Cup signal. This is deliberately strict so a generic baseball
// jersey giveaway is never mislabeled as a soccer jersey night. There is no
// jersey promo type, so this is text-based.
const JERSEY_SIGNAL = /\b(jersey|kit|maillot|camiseta)\b/i;
// High-precision soccer signal only. Deliberately excludes ambiguous terms like
// "pitch" (baseball "first pitch"), "FC", and "football" (NFL) so a generic
// baseball jersey giveaway is never mislabeled as a soccer jersey night.
const SOCCER_SIGNAL = /\b(soccer|f[uú]tbol|world\s*cup|fifa)\b/i;

export function isSoccerJerseyPromo(promo: Promo): boolean {
  const text = `${promo.title} ${promo.description}`;
  return JERSEY_SIGNAL.test(text) && SOCCER_SIGNAL.test(text);
}
