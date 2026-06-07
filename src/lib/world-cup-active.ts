// Active-window gate for the World Cup announcement strip and nav link.
//
// WORLD_CUP_END is set just after the final (July 19, 2026; the constant is the
// morning after in UTC to cover the final running late ET). The strip and nav
// link auto-clear once now passes this. Evaluated server-side in app/layout.tsx
// and BrandBar; with 6h ISR they disappear within one revalidate cycle of the
// end date. The /world-cup hub page itself stays live regardless.
//
// NEXT_PUBLIC_WORLD_CUP_BANNER=off is a manual kill switch for instant removal
// without waiting on the date or a content redeploy.
export const WORLD_CUP_END = '2026-07-20T08:00:00Z';

export function isWorldCupActive(now: Date = new Date()): boolean {
  if (process.env.NEXT_PUBLIC_WORLD_CUP_BANNER === 'off') return false;
  return now.getTime() < Date.parse(WORLD_CUP_END);
}
