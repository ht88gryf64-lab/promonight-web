import type { PromoWithTeam } from '@/lib/types';
import type { SeasonEligible } from '@/lib/seasons/season-window';
import { BEST_PROMO_MIN_ROWS, isBestPromoRow } from '@/lib/scoring-weights';
import { PROMO_SCORED_LEAGUES } from '@/lib/types';

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
//
// GIVEAWAYS AT OR ABOVE THE FLOOR ONLY (2026-11-25). The rail's lede is about
// giveaways, and with no floor it showed whatever was left: that day, three
// MLS playoff fixtures typed `theme` and scoring 15 to 18. isBestPromoRow
// (src/lib/scoring-weights.ts) admits a scored giveaway at
// BEST_PROMO_SCORE_FLOOR or above and never a theme night. When nothing
// passes, the array is empty and HomePageV2 renders no section at all.
//
// THE LEAGUES ARE NAMED (2026-11 fix round). The pick used to take any row
// that carried a score, which was a league gate only by accident: NBA and NHL
// rows had none. It now reads PROMO_SCORED_LEAGUES (MLB, MLS, WNBA, NBA, NHL),
// so a league joins the rail by being added to that set, not by a write.
//
// TEN OR NOTHING (ruling 2026-11-25). With fewer than BEST_PROMO_MIN_ROWS
// qualifying rows the rail returns nothing, the same minimum /best-promos
// needs before it leaves its retrospective: a rail of three cards whose "Full
// rankings" link lands on a page that lists none of them is the mismatch this
// closes. The count is taken over the whole in-season future, before the cut
// to `n`.
export function pickBestStubPromos(
  allFuture: PromoWithTeam[],
  n: number,
  eligible: SeasonEligible,
): PromoWithTeam[] {
  const qualifying = allFuture
    .filter(
      (p) => typeof p.score === 'number' && p.scoreBreakdown != null && p.derivedSignals != null,
    )
    .filter((p) => PROMO_SCORED_LEAGUES.has(p.team.league))
    .filter(isBestPromoRow)
    .filter((p) => eligible(p.team.league, p.date));
  if (qualifying.length < BEST_PROMO_MIN_ROWS) return [];
  return qualifying
    .sort((a, b) => (b.score as number) - (a.score as number) || a.date.localeCompare(b.date))
    .slice(0, n);
}
