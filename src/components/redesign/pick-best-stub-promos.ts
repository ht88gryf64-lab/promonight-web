import type { PromoWithTeam } from '@/lib/types';

// Top-N future promos by stored per-promo score, picked in memory over the
// corpus the homepage already fetches. mapPromoDoc carries score,
// scoreBreakdown, and derivedSignals onto every mapped promo, so this costs
// ZERO new Firestore reads; it was chosen over getScoredPromosInDateRange,
// which would re-query the same date window the homepage has already read.
//
// Honesty mirror of /best-promos: a promo ranks only when all three scoring
// fields are present. Scoring covers MLB, MLS, and WNBA, so unscored leagues
// (NBA, NHL, NFL) can never appear in this pick; when nothing in the window
// qualifies at all, the returned array is empty and StubRail renders nothing
// rather than an empty or broken section. Ordering matches fetchScoredPromos:
// score descending, date ascending as the tiebreak.
export function pickBestStubPromos(allFuture: PromoWithTeam[], n: number): PromoWithTeam[] {
  return allFuture
    .filter(
      (p) => typeof p.score === 'number' && p.scoreBreakdown != null && p.derivedSignals != null,
    )
    .sort((a, b) => (b.score as number) - (a.score as number) || a.date.localeCompare(b.date))
    .slice(0, n);
}
