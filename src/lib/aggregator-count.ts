import type { PromoWithTeam } from './types';

// The hero's "N promos" counts each promo once. A page whose groups overlap
// (/promos/theme-nights files a night under every category it matches) showed
// the sum of the group sizes, 959, over a lead that said 938 (fixed
// 2026-10-06). Promo docs carry no id here, so identity is the object: a page
// that files one night under two groups passes the same object to both.
export function distinctPromoCount(groups: ReadonlyArray<{ promos: readonly PromoWithTeam[] }>): number {
  return new Set(groups.flatMap((g) => g.promos)).size;
}
