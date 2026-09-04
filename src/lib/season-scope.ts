import { seasonSpan } from './season-label';
import { countPromosByType, isPurchaseGated, isUpcomingPromo, todayYmd } from './promo-helpers';
import { TITLE_SEASON_YEAR } from './title-treatment';
import type { Promo, PromoType } from './types';

// ── Season scope ─────────────────────────────────────────────────────────────
//
// THE STANDING RULE IS "LABEL MATCHES POPULATION". See the header on
// splitPromosByDate in promo-helpers.ts. A number on a page is a claim, and the
// words around it have to name the set it counts. That rule is symmetric: an
// all-time count under "coming up" is wrong, and an upcoming-only count under
// "the 2026 season" is equally wrong. Before this module the page did the
// second on 142 of 169 pages, publishing 19 where the season held 98.
//
// This module resolves the SEASON population when, and only when, the rows can
// support a season claim. Everything else falls back to the upcoming-only
// claim the page made before, because absence beats a wrong season total.
//
// ── Why the resolution is this conservative ──────────────────────────────────
//
// `Promo` carries a `date` and NO season field (src/lib/types.ts). A season is
// therefore not representable, and no season model is invented here: the same
// reasoning as src/lib/season-label.ts, which this reuses rather than
// duplicating. What IS knowable is the calendar-year span of the rows in hand.
//
// Measured on the live corpus 2026-09-04, all 169 teams, 5,056 dated rows:
//
//   single calendar year, == 2026   90 teams   season claim resolves
//   spans calendar years            52 teams   falls back  (29 of 32 NHL clubs)
//   single year, != 2026             4 teams   falls back  (NBA, 2025-only rows)
//   no dated rows                   23 teams   falls back
//
// The multi-year clubs are the reason for the guard. Detroit's archive holds 16
// rows from the finished 2025-26 season and 123 from the 2026-27 season ahead.
// Summing them produces a number that describes NO season, which is worse than
// the understatement it would replace. Six NFL clubs whose one season straddles
// New Year fall back too: that is a known false negative, accepted because the
// alternative is a month-window heuristic, which is exactly the invented season
// model season-label.ts refuses to build.
//
// The `year === TITLE_SEASON_YEAR` guard covers the last case: four NBA clubs
// carry only 2025 rows under a page title that says 2026. Claiming "the 2025
// season" in the body of a page titled 2026 is honest but incoherent, so those
// pages keep the claim they have.

/**
 * The date the MLB slice of this change goes live.
 *
 * WHY MLB IS HELD. `ctr-diagnostic-sep2026` (src/lib/title-treatment.ts)
 * started 2026-09-03 with a four-week read on 2026-10-01, and ten of the thirty
 * MLB team pages are its treatment arm. Changing the counts, the prose and the
 * meta description on those pages mid-flight would confound the read with a
 * second variable. Every other league ships immediately.
 *
 * MECHANISM: a dated condition evaluated at render, NOT an env flag. Team pages
 * carry `revalidate = 86400`, so every MLB page picks the season scope up on its
 * next ISR revalidation within 24 hours of this date. No second build, no env
 * change, no redeploy.
 *
 * This is a ROLLOUT date, not a label. It is not the clock-derived-copy hazard
 * that the hardcoded season years elsewhere guard against: nothing user-visible
 * is derived from it, it gates only which of two truthful renderings ships, and
 * once it passes it never changes behaviour again.
 */
export const MLB_SEASON_SCOPE_START = '2026-10-01';

/**
 * Whether season-scoped claims are live for a league. True everywhere except
 * MLB before MLB_SEASON_SCOPE_START. `today` is injectable so tests pin a date
 * instead of racing the clock.
 */
export function isSeasonScopeLive(league: string, today: string = todayYmd()): boolean {
  if (league === 'MLB') return today >= MLB_SEASON_SCOPE_START;
  return true;
}

const plural = (n: number, one: string, many: string) => (n === 1 ? one : many);

/**
 * The disclosure that rides with a published season giveaway count.
 *
 * Three shapes, because "1 of the 1 giveaway requires a ticket package" is what
 * a single template produces on the degenerate case and it reads as an error.
 */
function gatedDisclosureFor(gated: number, total: number): string | null {
  if (gated === 0) return null;
  if (gated >= total) {
    return total === 1
      ? 'The only giveaway that season requires a ticket package.'
      : `All ${total} giveaways require a ticket package.`;
  }
  return `${gated} of the ${total} ${plural(total, 'giveaway', 'giveaways')} ${plural(gated, 'requires', 'require')} a ticket package.`;
}

export interface SeasonScope {
  /** The single calendar year the rows resolve to. */
  year: number;
  /** Every dated row in the season, date-ascending. */
  promos: Promo[];
  /** Category counts over the whole season population. */
  counts: Record<PromoType, number>;
  /** Season rows still ahead, date-ascending. */
  upcoming: Promo[];
  /** Season rows already played, most recent first. */
  past: Promo[];
  total: number;
  upcomingCount: number;
  completedCount: number;
  /**
   * Season giveaway rows whose own copy says a purchase is required.
   *
   * The giveaway COUNT deliberately includes these (the ruling is count broad,
   * label precisely), so the number needs a disclosure beside it wherever it is
   * published. Measured corpus-wide: 268 of 1,631 giveaway rows, 16.4%.
   * Row-level disclosure already exists and is unchanged: categoryForPromo in
   * src/components/redesign/categories.ts renders a neutral "Ticket Package"
   * pill instead of the giveaway pill and withholds the HOT flame.
   */
  gatedGiveawayCount: number;
  /**
   * The disclosure sentence that rides with any published season giveaway
   * count, or null when no season giveaway requires a purchase.
   *
   * PRECOMPUTED ONTO THE OBJECT ON PURPOSE. promo-helpers.ts needs this string
   * and season-scope.ts imports promo-helpers, so a function export here would
   * be a runtime import cycle. Carrying the resolved string means promo-helpers
   * needs only `import type`, which erases at compile time.
   */
  gatedDisclosure: string | null;
}

/**
 * How a surface should word its counts. ONE value threaded to every consumer,
 * so a branch cannot be forgotten in one component and honoured in another.
 *
 *   held      the league is inside its rollout hold. Render the PRE-CHANGE
 *             wording, byte for byte. Not "the fallback wording": the fallback
 *             wording is itself new, and shipping it to MLB would change the
 *             FAQ copy and the FAQPage schema on all 30 MLB pages, ten of which
 *             are the ctr-diagnostic-sep2026 treatment arm. A hold that lets
 *             prose through is not a hold.
 *   remaining the rows cannot support a season claim. State what is left, and
 *             never borrow the season's noun.
 *   season    state the season total and how much of it is left.
 */
export type ClaimMode =
  | { kind: 'held' }
  | { kind: 'remaining' }
  | { kind: 'season'; scope: SeasonScope };

/**
 * The single entry point for consumers. Returns the mode AND, for convenience,
 * the resolved scope when there is one.
 */
export function resolveClaimMode(
  promos: Promo[],
  league: string,
  today: string = todayYmd(),
): ClaimMode {
  if (!isSeasonScopeLive(league, today)) return { kind: 'held' };
  const scope = resolveSeasonScope(promos, league, today);
  return scope ? { kind: 'season', scope } : { kind: 'remaining' };
}

/**
 * Resolve the season population for a team, or null when the rows cannot
 * support a season claim. Callers fall back to their upcoming-only claim on
 * null; they must NOT substitute the raw array.
 *
 * Takes the full visible promo array the page already fetched. No new query:
 * getTeamPromos reads the whole subcollection with no date filter.
 */
export function resolveSeasonScope(
  promos: Promo[],
  league: string,
  today: string = todayYmd(),
): SeasonScope | null {
  if (!isSeasonScopeLive(league, today)) return null;

  // Dateless rows (recurring deals, the date-in-image clubs) belong to no
  // season and no archive, exactly as splitPromosByDate treats them.
  //
  // The predicate is the FULL YMD shape, not merely a non-empty string, so this
  // population is the same set seasonSpan measures below. A looser filter here
  // would let a malformed date into `total` and `counts` while seasonSpan
  // discarded it, so a row could be counted in a season it was not allowed to
  // push into the multi-year fallback. Zero such rows exist today; the point is
  // that the guard and the count can never see different sets.
  const dated = promos.filter(
    (p) => typeof p.date === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(p.date),
  );
  if (dated.length === 0) return null;

  const span = seasonSpan(dated.map((p) => p.date));
  if (!span || span.spansYears) return null;

  const year = span.years[0];
  if (year !== TITLE_SEASON_YEAR) return null;

  const sorted = [...dated].sort((a, b) => a.date.localeCompare(b.date));
  const upcoming = sorted.filter((p) => isUpcomingPromo(p, today));
  const past = sorted.filter((p) => !isUpcomingPromo(p, today)).reverse();

  const counts = countPromosByType(sorted);
  const gatedGiveawayCount = sorted.filter(
    (p) => (p.type === 'giveaway' || p.isGiveaway) && isPurchaseGated(p),
  ).length;

  return {
    year,
    promos: sorted,
    counts,
    upcoming,
    past,
    total: sorted.length,
    upcomingCount: upcoming.length,
    completedCount: past.length,
    gatedGiveawayCount,
    gatedDisclosure: gatedDisclosureFor(gatedGiveawayCount, counts.giveaway),
  };
}

/**
 * The headline claim: "98 promotions in the 2026 season, 19 still to come."
 *
 * Both halves are stated because either alone misleads. The season total alone
 * reads as availability; the upcoming count alone is the understatement this
 * whole change exists to end.
 */
export function seasonClaimSentence(scope: SeasonScope): string {
  const head = `${scope.total} ${plural(scope.total, 'promotion', 'promotions')} in the ${scope.year} season`;
  if (scope.upcomingCount === 0) return `${head}, all completed`;
  if (scope.completedCount === 0) return `${head}, all still to come`;
  return `${head}, ${scope.upcomingCount} still to come`;
}
