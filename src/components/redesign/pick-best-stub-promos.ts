import type { PromoWithTeam } from '@/lib/types';
import type { SeasonEligible } from '@/lib/seasons/season-window';

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
//
// SEASON GATE (ruling 2026-11-05). `allFuture` runs to the end of the data, so
// it holds next season's promos as soon as a club publishes them: on
// 2026-11-05, 7 of these 8 picks were Giants 2027 rows. `eligible` keeps only
// rows inside their league's current season (src/lib/seasons/season-window.ts),
// and it is applied before the cut so the rail still fills from in-season rows.
export function pickBestStubPromos(
  allFuture: PromoWithTeam[],
  n: number,
  eligible: SeasonEligible,
): PromoWithTeam[] {
  return allFuture
    .filter(
      (p) => typeof p.score === 'number' && p.scoreBreakdown != null && p.derivedSignals != null,
    )
    .filter((p) => eligible(p.team.league, p.date))
    .sort((a, b) => (b.score as number) - (a.score as number) || a.date.localeCompare(b.date))
    .slice(0, n);
}
