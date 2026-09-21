/**
 * Splits the visible promo rows into the groups Raptive anchors in-content ads
 * on. Pure, so the shape can be tested without rendering anything.
 *
 * WHY GROUPS EXIST AT ALL. Raptive's Content rule is `.page-content > *`, skip
 * 2, insert after each remaining child, and its first three units are requested
 * EAGERLY on every pageview (`max: 3` is the eager count). On a team page the
 * only anchors used to be whole page sections, so the first unit landed after
 * the entire promo list: y 3,800 on desktop, 4,600 on mobile, four to six
 * viewports below the fold, and desktop Content viewability came in at 0.18.
 * Anchors inside the list put two of the three eager units where people read.
 *
 * WHY NOT THE ROWS THEMSELVES. The rule has `every: 1` and `spacing: 0`. Rows as
 * anchors would mean an ad after every row from the third on.
 *
 * FOUR PER GROUP. Three rows plus an ad is about 750px on desktop, more than one
 * ad per 900px viewport. Five leaves only one unit inside a ten-row list.
 *
 * THE TAIL IS NOT AN ANCHOR. An ad after the last group would sit directly above
 * the "Show all" button and a few hundred pixels from the unit Raptive already
 * places after the whole list. The last group therefore renders OUTSIDE the
 * `page-content` wrapper. With a single group there is no wrapper at all and the
 * markup is exactly what it was.
 */
export const PROMO_ROWS_PER_AD_GROUP = 4;

export type PromoRowGroups<T> = {
  /** Groups whose wrapper is a `.page-content` child, so an ad may follow each. */
  anchors: { start: number; rows: T[] }[];
  /** The last group. Never an anchor. */
  tail: { start: number; rows: T[] };
};

export function groupPromoRows<T>(
  rows: readonly T[],
  size: number = PROMO_ROWS_PER_AD_GROUP,
): PromoRowGroups<T> {
  const step = Math.max(1, Math.floor(size));
  const groups: { start: number; rows: T[] }[] = [];
  for (let i = 0; i < rows.length; i += step) {
    groups.push({ start: i, rows: rows.slice(i, i + step) });
  }
  if (groups.length === 0) return { anchors: [], tail: { start: 0, rows: [] } };
  return { anchors: groups.slice(0, -1), tail: groups[groups.length - 1] };
}
