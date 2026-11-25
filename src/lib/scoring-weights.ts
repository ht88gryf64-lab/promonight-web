// THE PROMO SCORER'S CONSTANTS, MIRRORED FOR COPY. Pure and client-safe: no
// clock, no Firestore, no env.
//
// The scorer itself lives in the pipeline (promo-pipeline/lib/scoring/
// score-promo.js, scorePromo) and writes `score` and `scoreBreakdown` onto each
// promo document. The web never computes a score. It only DESCRIBES the scorer,
// in the FAQ answers on /best-promos, and those answers drifted: on 2026-11-25
// the page gave two different definitions of a perfect 100, neither of them the
// rule the code applies, and quoted item weights the scorer does not use. So
// the numbers the copy states come from here, and
// src/lib/__tests__/scoring-weights.test.ts compares every one of them against
// the pipeline's own file (PROMO_PIPELINE_DIR; see CLAUDE.md, worktrees).
//
// CHANGING A NUMBER HERE DOES NOT CHANGE A SCORE. Change the pipeline first;
// that test then fails until this file follows.

export const SCORE_MAX = 100;

/** Points for the promo's type. */
export const BASE_TYPE_WEIGHT = {
  giveaway: 40,
  kids: 30,
  food: 20,
  theme: 15,
} as const;

/** Points for the item named in the title or description. A generic item
 *  (a magnet, a poster) and no item both add nothing. */
export const ITEM_TYPE_WEIGHT = {
  bobblehead: 30,
  jersey: 25,
  premium: 25,
  hat: 12,
  towel: 10,
  tee: 8,
} as const;

/** The team marks the promo as a highlight. */
export const HIGHLIGHT_POINTS = 15;
/** Limited quantity: "first N fans", "while supplies last", "limited edition". */
export const LIMITED_QUANTITY_POINTS = 10;
/** A stated cap under this many fans adds CAP_POINTS. */
export const CAP_THRESHOLD_HIGH = 5000;
/** A stated cap under this many fans adds CAP_POINTS again, on top. */
export const CAP_THRESHOLD_LOW = 1000;
export const CAP_POINTS = 5;
/** A named "presented by" sponsor. */
export const SPONSOR_POINTS = 3;
/** A generic title ("Theme Night", "Fan Appreciation") loses this many. */
export const GENERIC_TITLE_PENALTY = 10;

// ── the ranked surfaces' floor ──────────────────────────────────────────────

/** The homepage Best Promos rail and /best-promos in upcoming mode list
 *  giveaway rows at or above this score, and nothing else.
 *  2026-11-25 distribution, 1,198 scored 2026 giveaways: 28 rows sit at 60 to 64 and 282 at 65 to 69, so 65 sits at the top of the gap: a giveaway (40) needs 25 more points of signal to reach it, which no plain hat, towel or T-shirt has on its own (819 rows pass, 68%). */
export const BEST_PROMO_SCORE_FLOOR = 65;

/** A row the ranked "best" surfaces may show: a scored giveaway at or above
 *  the floor. A theme night never qualifies, whatever it scores (on
 *  2026-11-25 the rail's only rows were three MLS playoff fixtures typed
 *  `theme`, scoring 15 to 18, under a lede about giveaways). */
export function isBestPromoRow(p: { type?: string | null; score?: number | null }): boolean {
  return p.type === 'giveaway' && typeof p.score === 'number' && p.score >= BEST_PROMO_SCORE_FLOOR;
}

// ── the copy, built from the numbers above ──────────────────────────────────

const n = (x: number) => x.toLocaleString('en-US');

/** The lowest total a perfect bobblehead giveaway needs: every signal except
 *  the second cap step and the sponsor. Asserted to be SCORE_MAX in the test,
 *  so the "perfect 100" answers below cannot outlive a weight change. */
export const PERFECT_BOBBLEHEAD_TOTAL =
  BASE_TYPE_WEIGHT.giveaway + ITEM_TYPE_WEIGHT.bobblehead + HIGHLIGHT_POINTS + LIMITED_QUANTITY_POINTS + CAP_POINTS;

/** The same promo with a cap at or over the high threshold, sponsor included. */
export const UNCAPPED_BOBBLEHEAD_CEILING =
  BASE_TYPE_WEIGHT.giveaway + ITEM_TYPE_WEIGHT.bobblehead + HIGHLIGHT_POINTS + LIMITED_QUANTITY_POINTS + SPONSOR_POINTS;

/** The most a promo with a generic title can score: every signal, less the penalty. */
export const GENERIC_TITLE_CEILING =
  BASE_TYPE_WEIGHT.giveaway + ITEM_TYPE_WEIGHT.bobblehead + HIGHLIGHT_POINTS + LIMITED_QUANTITY_POINTS + CAP_POINTS + CAP_POINTS + SPONSOR_POINTS - GENERIC_TITLE_PENALTY;

/** "How does PromoNight rank promos?" */
export const SCORE_COMPONENTS_ANSWER =
  `Every scored promo gets a 0 to ${SCORE_MAX} total (a recurring deal is not scored as an event and carries 0). It starts from the promo type: ${BASE_TYPE_WEIGHT.giveaway} points for a giveaway, ${BASE_TYPE_WEIGHT.kids} for a kids event, ${BASE_TYPE_WEIGHT.food} for a food deal and ${BASE_TYPE_WEIGHT.theme} for a theme night. ` +
  `The item adds to that: ${ITEM_TYPE_WEIGHT.bobblehead} for a bobblehead, ${ITEM_TYPE_WEIGHT.jersey} for a jersey or a premium collectible, ${ITEM_TYPE_WEIGHT.hat} for a hat, ${ITEM_TYPE_WEIGHT.towel} for a towel and ${ITEM_TYPE_WEIGHT.tee} for a T-shirt. ` +
  `A promo the team highlights adds ${HIGHLIGHT_POINTS}, a limited quantity adds ${LIMITED_QUANTITY_POINTS}, a stated cap under ${n(CAP_THRESHOLD_HIGH)} fans adds ${CAP_POINTS}, a cap under ${n(CAP_THRESHOLD_LOW)} adds ${CAP_POINTS} more, and a named sponsor adds ${SPONSOR_POINTS}. ` +
  `A generic title such as "Theme Night" loses ${GENERIC_TITLE_PENALTY}. The total stops at ${SCORE_MAX}. The list sorts by this total, highest first, with the earlier date as the tiebreaker.`;

/** "What makes a promo score 100?" and "What gives a promo a perfect 100
 *  score?": one answer, so the page cannot define it two ways again. */
export const PERFECT_SCORE_ANSWER =
  `A ${SCORE_MAX} is a bobblehead giveaway (${BASE_TYPE_WEIGHT.giveaway} plus ${ITEM_TYPE_WEIGHT.bobblehead}) that the team highlights (${HIGHLIGHT_POINTS}), in limited quantity (${LIMITED_QUANTITY_POINTS}), with a stated cap under ${n(CAP_THRESHOLD_HIGH)} fans (${CAP_POINTS}). ` +
  `A sponsor is not required: it adds ${SPONSOR_POINTS} points, and the total stops at ${SCORE_MAX}. ` +
  `With a cap of ${n(CAP_THRESHOLD_HIGH)} or more, the same bobblehead tops out at ${UNCAPPED_BOBBLEHEAD_CEILING}, sponsor included, which is why most top bobbleheads sit just under ${SCORE_MAX}. ` +
  `A jersey or premium item is worth ${ITEM_TYPE_WEIGHT.bobblehead - ITEM_TYPE_WEIGHT.jersey} fewer points than a bobblehead, so it reaches ${SCORE_MAX} only with a cap under ${n(CAP_THRESHOLD_LOW)}. ` +
  `A generic title such as "Giveaway Night" takes ${GENERIC_TITLE_PENALTY} off, and a promo that carries one tops out at ${GENERIC_TITLE_CEILING}.`;

/** "How are bobbleheads and jerseys ranked?" */
export const ITEM_WEIGHTS_ANSWER =
  `Bobbleheads earn ${ITEM_TYPE_WEIGHT.bobblehead} points in the item component, jerseys and premium collectibles earn ${ITEM_TYPE_WEIGHT.jersey}, hats earn ${ITEM_TYPE_WEIGHT.hat}, towels earn ${ITEM_TYPE_WEIGHT.towel} and T-shirts earn ${ITEM_TYPE_WEIGHT.tee}. ` +
  `A highlight from the team (${HIGHLIGHT_POINTS}), a limited quantity (${LIMITED_QUANTITY_POINTS}), a stated cap under ${n(CAP_THRESHOLD_HIGH)} fans (${CAP_POINTS}, and ${CAP_POINTS} more under ${n(CAP_THRESHOLD_LOW)}) and a named sponsor (${SPONSOR_POINTS}) are added on top.`;

/** /best-promos/bobbleheads, "What separates a 98 score from a 100?" */
export const NINETY_EIGHT_VS_HUNDRED_ANSWER =
  `The cap. A highlighted, limited-quantity bobblehead giveaway with a named sponsor scores ${UNCAPPED_BOBBLEHEAD_CEILING} when its stated cap is ${n(CAP_THRESHOLD_HIGH)} fans or more, or when no cap is stated. ` +
  `A stated cap under ${n(CAP_THRESHOLD_HIGH)} adds ${CAP_POINTS} points, which takes the same bobblehead to ${SCORE_MAX} with or without a sponsor. The sponsor is worth ${SPONSOR_POINTS} points and cannot close the gap on its own.`;

/** /best-promos/bobbleheads, "Why do WNBA bobbleheads score so high?" */
export const SMALL_CAP_ANSWER =
  `Small runs score higher. A stated cap under ${n(CAP_THRESHOLD_HIGH)} fans adds ${CAP_POINTS} points and a cap under ${n(CAP_THRESHOLD_LOW)} adds ${CAP_POINTS} more, while a run of ${n(10000)} or ${n(15000)} at a larger venue earns no cap points. ` +
  `A WNBA bobblehead capped in the low thousands can therefore outscore a bobblehead from a much larger program.`;

/** "Why are NBA and NHL not included?" The reason is that they are not
 *  scored. No mechanism is cited and no date is promised. */
export const UNSCORED_LEAGUES_ANSWER =
  'NBA and NHL promos are not scored yet. PromoNight lists them on the team pages, the league hubs and the daily boards, but this ranking only includes leagues whose promos carry a score, which today is MLB, MLS, and WNBA.';
