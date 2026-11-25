// THE WEB'S MIRROR OF THE PROMO SCORER (src/lib/scoring-weights.ts) AGAINST
// THE PIPELINE'S OWN FILE, and the FAQ copy built from it.
//
// The scorer is promo-pipeline/lib/scoring/score-promo.js. It exports its two
// weight tables; the other weights are literals inside scorePromo, so those
// are checked by RUNNING the pipeline's scorePromo on one-signal inputs and
// reading the breakdown it returns. The module is pure (no Firestore, no
// network, nothing at require time).
//
// Run with: PROMO_PIPELINE_DIR=/abs/path/to/promo-pipeline node --import tsx --test <this file>
import { test, type TestContext } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { join, resolve } from 'node:path';
import {
  BASE_TYPE_WEIGHT,
  BEST_PROMO_SCORE_FLOOR,
  CAP_POINTS,
  CAP_THRESHOLD_HIGH,
  CAP_THRESHOLD_LOW,
  GENERIC_TITLE_PENALTY,
  HIGHLIGHT_POINTS,
  ITEM_TYPE_WEIGHT,
  ITEM_WEIGHTS_ANSWER,
  LIMITED_QUANTITY_POINTS,
  PERFECT_BOBBLEHEAD_TOTAL,
  PERFECT_SCORE_ANSWER,
  SCORE_COMPONENTS_ANSWER,
  SCORE_MAX,
  SPONSOR_POINTS,
  UNCAPPED_BOBBLEHEAD_CEILING,
  RANKED_LEAGUES_ANSWER,
  TEAM_RANKINGS_NBA_NHL_ANSWER,
  BEST_PROMO_MIN_ROWS,
  GENERIC_TITLE_CEILING,
  PERFECT_SCORE_SHORT_ANSWER,
  NINETY_EIGHT_VS_HUNDRED_ANSWER,
  SMALL_CAP_ANSWER,
  isBestPromoRow,
} from '../scoring-weights';

// The pipeline checkout: PROMO_PIPELINE_DIR, else the sibling of the shared
// checkout (CLAUDE.md, worktrees). Absent, the pipeline-copy tests skip in
// red; they never pass by default.
const PIPELINE_DIR = process.env.PROMO_PIPELINE_DIR || '../promonight/promo-pipeline';
const SCORER = resolve(join(PIPELINE_DIR, 'lib/scoring/score-promo.js'));
let warned = false;
function pipelinePresent(t: TestContext): boolean {
  if (existsSync(SCORER)) return true;
  if (!warned) {
    warned = true;
    process.stderr.write(`\x1b[31mSKIPPED scorer pipeline-copy tests: ${SCORER} is absent; set PROMO_PIPELINE_DIR to the promo-pipeline checkout (CLAUDE.md, worktrees)\x1b[0m\n`);
  }
  t.skip(`PROMO_PIPELINE_DIR absent (${PIPELINE_DIR})`);
  return false;
}

type Breakdown = Record<string, number>;
type Scorer = {
  scorePromo: (promo: Record<string, unknown>, ds: Record<string, unknown>) => { score: number; breakdown: Breakdown };
  BASE_TYPE_WEIGHT: Record<string, number>;
  ITEM_TYPE_WEIGHT: Record<string, number>;
};
const loadScorer = (): Scorer => createRequire(import.meta.url)(SCORER) as Scorer;

test('pipeline copy: the two exported weight tables are the web mirror, key for key', (t) => {
  if (!pipelinePresent(t)) return;
  const s = loadScorer();
  assert.deepEqual({ ...BASE_TYPE_WEIGHT }, s.BASE_TYPE_WEIGHT);
  assert.deepEqual({ ...ITEM_TYPE_WEIGHT }, s.ITEM_TYPE_WEIGHT);
});

test('pipeline copy: the inline weights, read from scorePromo breakdowns', (t) => {
  if (!pipelinePresent(t)) return;
  const { scorePromo } = loadScorer();
  const bare = { type: 'giveaway' };
  assert.equal(scorePromo({ ...bare, highlight: true }, {}).breakdown.highlight, HIGHLIGHT_POINTS);
  assert.equal(scorePromo(bare, { limitedQuantity: true }).breakdown.limitedQuantity, LIMITED_QUANTITY_POINTS);
  assert.equal(scorePromo(bare, { sponsor: 'Acme' }).breakdown.sponsor, SPONSOR_POINTS);
  assert.equal(scorePromo(bare, { isGenericTitle: true }).breakdown.genericTitle, -GENERIC_TITLE_PENALTY);
  // The cap steps, at each threshold's edge: under it scores, at it does not.
  const cap = (n: number) => scorePromo(bare, { quantityCap: n }).breakdown;
  assert.deepEqual(cap(CAP_THRESHOLD_HIGH), { baseType: BASE_TYPE_WEIGHT.giveaway }, 'a cap AT the high threshold adds nothing');
  assert.deepEqual(cap(CAP_THRESHOLD_HIGH - 1), { baseType: BASE_TYPE_WEIGHT.giveaway, quantityCapUnder5000: CAP_POINTS });
  assert.deepEqual(cap(CAP_THRESHOLD_LOW), { baseType: BASE_TYPE_WEIGHT.giveaway, quantityCapUnder5000: CAP_POINTS }, 'a cap AT the low threshold adds one step');
  assert.deepEqual(cap(CAP_THRESHOLD_LOW - 1), { baseType: BASE_TYPE_WEIGHT.giveaway, quantityCapUnder5000: CAP_POINTS, quantityCapUnder1000: CAP_POINTS });
  // The breakdown keys name the thresholds; the copy states them as numbers.
  assert.equal(CAP_THRESHOLD_HIGH, 5000);
  assert.equal(CAP_THRESHOLD_LOW, 1000);
});

test('pipeline copy: the pipeline scores the "perfect 100" promo the copy describes, and its neighbours', (t) => {
  if (!pipelinePresent(t)) return;
  const { scorePromo } = loadScorer();
  const promo = { type: 'giveaway', highlight: true };
  const bobble = { itemType: 'bobblehead', limitedQuantity: true };
  // No sponsor, cap under 5,000: the Mystics bobbleheads of 2026 (cap 1,500).
  assert.equal(scorePromo(promo, { ...bobble, quantityCap: 1500, sponsor: null }).score, SCORE_MAX);
  // Sponsor, cap of 10,000: the Mariners Naylor bobblehead, 98.
  assert.equal(scorePromo(promo, { ...bobble, quantityCap: 10000, sponsor: 'Acme' }).score, UNCAPPED_BOBBLEHEAD_CEILING);
  // Every signal at once is over the top and stops there.
  assert.equal(scorePromo(promo, { ...bobble, quantityCap: 500, sponsor: 'Acme' }).score, SCORE_MAX);
  // A jersey: 98 with a sponsor and a cap under 5,000, 100 only under 1,000.
  const jersey = { itemType: 'jersey', limitedQuantity: true };
  assert.ok(scorePromo(promo, { ...jersey, quantityCap: 4000, sponsor: 'Acme' }).score < SCORE_MAX);
  assert.equal(scorePromo(promo, { ...jersey, quantityCap: 999, sponsor: null }).score, SCORE_MAX);
});

test('pipeline copy: scorePromo writes exactly the breakdown keys the mirror knows', (t) => {
  if (!pipelinePresent(t)) return;
  // A new bonus or penalty in the scorer adds a `breakdown.<key> =` line. This
  // list is every key it writes today; a key the mirror has no constant for
  // fails here, before the FAQ copy goes stale.
  const src = readFileSync(SCORER, 'utf8');
  const keys = [...new Set([...src.matchAll(/breakdown\.([A-Za-z0-9_]+)\s*=/g)].map((m) => m[1]))].sort();
  assert.deepEqual(keys, ['baseType', 'genericTitle', 'highlight', 'itemType', 'limitedQuantity', 'quantityCapUnder1000', 'quantityCapUnder5000', 'sponsor']);
  // The two paths that write no key of their own: a recurring promo short-circuits to 0, and the total is clamped to 0..100.
  assert.match(src, /promo\.recurring === true\) \{\s*return \{ score: 0, breakdown: \{ recurring: 0 \} \};/);
  assert.match(src, /clamp\(Math\.round\(total\), 0, 100\)/);
  const { scorePromo } = loadScorer();
  assert.equal(scorePromo({ type: 'giveaway', highlight: true, recurring: true }, { itemType: 'bobblehead' }).score, 0);
  assert.equal(scorePromo({ type: 'nonsense' }, { isGenericTitle: true }).score, 0, 'clamped at zero');
  // A generic title: every other signal at once still stops short of the maximum.
  assert.equal(scorePromo({ type: 'giveaway', highlight: true }, { itemType: 'bobblehead', limitedQuantity: true, quantityCap: 500, sponsor: 'Acme', isGenericTitle: true }).score, GENERIC_TITLE_CEILING);
});

test('the arithmetic the "perfect 100" answer states holds in the mirror itself', () => {
  assert.equal(GENERIC_TITLE_CEILING, 98);
  assert.ok(GENERIC_TITLE_CEILING < SCORE_MAX);
  assert.equal(PERFECT_BOBBLEHEAD_TOTAL, SCORE_MAX, 'giveaway + bobblehead + highlight + limited + one cap step is exactly the maximum');
  assert.equal(UNCAPPED_BOBBLEHEAD_CEILING, 98);
  assert.ok(UNCAPPED_BOBBLEHEAD_CEILING < SCORE_MAX, 'without a cap under the high threshold a bobblehead cannot reach the maximum');
  const jerseyOneStep = BASE_TYPE_WEIGHT.giveaway + ITEM_TYPE_WEIGHT.jersey + HIGHLIGHT_POINTS + LIMITED_QUANTITY_POINTS + CAP_POINTS + SPONSOR_POINTS;
  assert.ok(jerseyOneStep < SCORE_MAX, 'a jersey with one cap step and a sponsor is short of the maximum');
  assert.ok(jerseyOneStep - SPONSOR_POINTS + CAP_POINTS >= SCORE_MAX, 'a jersey with both cap steps reaches it');
  assert.equal(ITEM_TYPE_WEIGHT.jersey, ITEM_TYPE_WEIGHT.premium, 'the copy gives jerseys and premium items one number');
});

test('the FAQ copy states the real numbers and none of the retired claims', () => {
  for (const a of [SCORE_COMPONENTS_ANSWER, PERFECT_SCORE_ANSWER, ITEM_WEIGHTS_ANSWER, RANKED_LEAGUES_ANSWER, TEAM_RANKINGS_NBA_NHL_ANSWER, NINETY_EIGHT_VS_HUNDRED_ANSWER, SMALL_CAP_ANSWER]) {
    assert.doesNotMatch(a, /—|–/, 'no dashes in user-facing copy');
    assert.doesNotMatch(a, /undefined|NaN/);
  }
  // Thresholds, limited quantity and the generic-title penalty are all stated.
  assert.match(SCORE_COMPONENTS_ANSWER, /cap under 5,000 fans adds 5, a cap under 1,000 adds 5 more/);
  assert.match(SCORE_COMPONENTS_ANSWER, /a limited quantity adds 10/);
  assert.match(SCORE_COMPONENTS_ANSWER, /A generic title such as "Theme Night" loses 10/);
  assert.match(SCORE_COMPONENTS_ANSWER, /40 points for a giveaway, 30 for a kids event, 20 for a food deal and 15 for a theme night/);
  assert.match(PERFECT_SCORE_ANSWER, /cap under 5,000 fans/);
  assert.match(PERFECT_SCORE_ANSWER, /\(40 points plus 30\)/, 'the first bracket says the numbers are points');
  // The short form states the same rule and the same two numbers.
  assert.match(PERFECT_SCORE_SHORT_ANSWER, /highlighted bobblehead giveaway in limited quantity with a stated cap under 5,000 fans/);
  assert.match(PERFECT_SCORE_SHORT_ANSWER, /A sponsor is not required, and a bobblehead capped at 5,000 or more tops out at 98/);
  assert.doesNotMatch(PERFECT_SCORE_SHORT_ANSWER, /likeness|\u2014|\u2013/);
  assert.match(PERFECT_SCORE_ANSWER, /A sponsor is not required/);
  assert.match(PERFECT_SCORE_ANSWER, /tops out at 98/);
  assert.match(PERFECT_SCORE_ANSWER, /only with a cap under 1,000/);
  assert.match(PERFECT_SCORE_ANSWER, /A generic title such as "Giveaway Night" takes 10 off, and a promo that carries one tops out at 98/);
  assert.match(SCORE_COMPONENTS_ANSWER, /a recurring deal is not scored as an event and carries 0/);
  // The bobblehead page's two answers agree with the one above: the cap, not the sponsor.
  assert.match(NINETY_EIGHT_VS_HUNDRED_ANSWER, /^The cap\./);
  assert.match(NINETY_EIGHT_VS_HUNDRED_ANSWER, /scores 98 when its stated cap is 5,000 fans or more, or when no cap is stated/);
  assert.match(NINETY_EIGHT_VS_HUNDRED_ANSWER, /with or without a sponsor/);
  assert.match(SMALL_CAP_ANSWER, /cap under 5,000 fans adds 5 points and a cap under 1,000 adds 5 more/);
  for (const a of [NINETY_EIGHT_VS_HUNDRED_ANSWER, SMALL_CAP_ANSWER]) assert.doesNotMatch(a, /likeness|miss the sponsor/i);
  assert.match(ITEM_WEIGHTS_ANSWER, /Bobbleheads earn 30 .* jerseys and premium collectibles earn 25, hats earn 12, towels earn 10 and T-shirts earn 8/);
  for (const a of [SCORE_COMPONENTS_ANSWER, PERFECT_SCORE_ANSWER, ITEM_WEIGHTS_ANSWER]) {
    assert.doesNotMatch(a, /likeness/i);
    assert.doesNotMatch(a, /requires four signals|five components/i);
  }
  // The leagues: NBA and NHL promos ARE scored now; NFL is not. No mechanism
  // cited, no date or release promised, on either page.
  assert.match(RANKED_LEAGUES_ANSWER, /The upcoming list ranks giveaways from MLB, MLS, WNBA, NBA, and NHL/);
  assert.match(RANKED_LEAGUES_ANSWER, /NFL promos are not scored/);
  assert.match(RANKED_LEAGUES_ANSWER, /that record covers MLB, MLS, and WNBA/);
  assert.match(TEAM_RANKINGS_NBA_NHL_ANSWER, /NBA and NHL promos are scored/);
  assert.match(TEAM_RANKINGS_NBA_NHL_ANSWER, /Their teams are not ranked yet/);
  assert.match(TEAM_RANKINGS_NBA_NHL_ANSWER, /runs across two calendar years/);
  assert.match(TEAM_RANKINGS_NBA_NHL_ANSWER, /not calibrated/);
  for (const a of [RANKED_LEAGUES_ANSWER, TEAM_RANKINGS_NBA_NHL_ANSWER]) {
    assert.doesNotMatch(a, /not scored yet|extraction|pipeline|future release|soon|will join|20\d\d/i);
  }
});

test('the pages take these answers from the module and carry no second copy', () => {
  const src = (p: string) => readFileSync(new URL(`../../${p}`, import.meta.url), 'utf-8');
  const best = src('app/best-promos/page.tsx');
  const teams = src('app/team-rankings/page.tsx');
  // Counted after the import line, whatever the formatting around `answer:`.
  const body = best.slice(best.indexOf('const FAQS'));
  assert.equal(body.match(/\bPERFECT_SCORE_ANSWER\b/g)?.length, 1, 'the FAQ gives the full answer once');
  assert.equal(body.match(/\bPERFECT_SCORE_SHORT_ANSWER\b/g)?.length, 1, 'the inline block gives the short form of the same rule');
  // A retrospective card is a played game: no ticket links on it.
  assert.match(src('components/scoring/best-promos-browser.tsx'), /showTickets=\{!retrospective\}/);
  assert.match(best, /SCORE_COMPONENTS_ANSWER,/);
  assert.match(best, /ITEM_WEIGHTS_ANSWER,/);
  assert.match(best, /RANKED_LEAGUES_ANSWER,/);
  assert.match(teams, /TEAM_RANKINGS_NBA_NHL_ANSWER,/);
  assert.doesNotMatch(best, /Why are NBA and NHL not included/);
  for (const s of [best, teams]) {
    assert.doesNotMatch(s, /structured-extraction|player likeness|jerseys earn 20|five components/);
  }
  // The retrospective says what the list is and never that nothing is left.
  assert.match(best, /This list is the season's record/);
  assert.doesNotMatch(best, /Nothing here is upcoming|no ranked promos ahead|has a ranked promo still to come/);
  // And it states the real condition for the upcoming list, from the constants.
  assert.match(best, /from \$\{LEAD_IN_DAYS\} days before a scored league's next Opening Day, once at least \$\{RANKED_MIN_UPCOMING_ROWS\} giveaways scoring \$\{BEST_PROMO_SCORE_FLOOR\} or more/);
  assert.doesNotMatch(best, /once clubs have announced/);
  const bobble = src('app/best-promos/bobbleheads/page.tsx');
  assert.match(bobble, /NINETY_EIGHT_VS_HUNDRED_ANSWER,/);
  assert.match(bobble, /SMALL_CAP_ANSWER,/);
  assert.doesNotMatch(bobble, /player likeness|miss the sponsor signal|capped at 10,000 covers/);
  // The bobblehead page's retrospective speaks of ranked rows, not of which leagues are scored.
  assert.doesNotMatch(bobble, /the three leagues we score|the three leagues this page covers/);
  // True before the NBA and NHL score write as well as after: it speaks of RANKED rows only.
  assert.match(bobble, /no ranked bobblehead giveaway is still to come this season/);
  assert.doesNotMatch(bobble, /no league we score has/);
  assert.match(bobble, /The team rankings page, which covers MLB, MLS, and WNBA teams/);
});

test('isBestPromoRow: a scored giveaway at the floor or above, and never a theme night', () => {
  assert.equal(BEST_PROMO_SCORE_FLOOR, 65);
  assert.equal(BEST_PROMO_MIN_ROWS, 10);
  assert.equal(isBestPromoRow({ type: 'giveaway', score: 65 }), true);
  assert.equal(isBestPromoRow({ type: 'giveaway', score: 64 }), false);
  assert.equal(isBestPromoRow({ type: 'theme', score: 100 }), false);
  assert.equal(isBestPromoRow({ type: 'kids', score: 90 }), false);
  assert.equal(isBestPromoRow({ type: 'food', score: 90 }), false);
  assert.equal(isBestPromoRow({ type: 'giveaway' }), false, 'an unscored row never qualifies');
  assert.equal(isBestPromoRow({ type: 'giveaway', score: null }), false);
});
