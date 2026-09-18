/**
 * Ordering for third-party ad containers injected into the team-page weave.
 *
 * Below lg the weave is a single-column grid and 13 authored `order-[n]` values
 * drive the reading sequence. The order floor in globals.css sends any UNMARKED
 * grid child to order:900, which is the correct failure mode for something
 * nobody placed deliberately but the wrong outcome for an in-content ad: every
 * unit stacks at the bottom below the FAQ instead of sitting where it was
 * anchored. This module computes the order that puts an injected container back
 * where its anchor is.
 *
 * WHY EQUAL-TO-ANCHOR AND NOT A MIDPOINT. CSS `order` takes an <integer>; there
 * is no value between 40 and 41, and the authored scale has three tight runs
 * (40-43, 60-61, 71-72) where consecutive values are adjacent. Raptive anchors
 * units inside those runs in production - Content_2 after 41 and Content_3
 * after 42 were both observed live - so a midpoint strategy has no value to
 * pick and a fixed +5 would jump the unit past two or three authored sections.
 *
 * Grid sorts by order-modified document order: items with EQUAL order fall back
 * to document order. The container is inserted `afterend` of its anchor, so it
 * is already after the anchor in the DOM. Giving it the anchor's own order
 * therefore places it immediately after the anchor and before the next authored
 * section, which is exactly the intent, with no fractional value required.
 * `isPlacementValid` is the invariant a test holds against the real authored
 * values so a future edit to those values cannot break this silently.
 */

/** Same breakpoint as the order floor in globals.css. Keep them in step. */
export const WEAVE_MOBILE_QUERY = '(max-width: 1023px)';

/** The order an injected container takes, given its anchor's order. */
export function assignedOrderFor(anchorOrder: number): number {
  return anchorOrder;
}

/** The next authored order strictly greater than `order`, or null if last. */
export function nextAuthoredAfter(
  order: number,
  authored: readonly number[],
): number | null {
  let best: number | null = null;
  for (const v of authored) {
    if (v > order && (best === null || v < best)) best = v;
  }
  return best;
}

/**
 * Does `assigned` place the container at or after its anchor and strictly
 * before the next authored section? This is the property the whole approach
 * rests on, and it only holds while authored values are UNIQUE - two sections
 * sharing a value would make the document-order tie-break ambiguous.
 */
export function isPlacementValid(
  assigned: number,
  anchorOrder: number,
  authored: readonly number[],
): boolean {
  if (!Number.isInteger(assigned)) return false;
  if (assigned < anchorOrder) return false;
  const next = nextAuthoredAfter(anchorOrder, authored);
  return next === null ? true : assigned < next;
}

export function hasUniqueOrders(authored: readonly number[]): boolean {
  return new Set(authored).size === authored.length;
}

/**
 * Is this element a third-party ad container?
 *
 * Grounded on production rather than guessed. Of the ten containers Raptive
 * injects into the weave on a desktop team page, only EIGHT carry an
 * `AdThrive_*` id or an `adthrive*` class. The other two are wrappers: one is
 * `rp-sticky-sb-wrapper` (their newer `rp-` prefix) holding Sidebar_9, and one
 * carries no class and no id at all and holds `adthrive-auto-injected-container`.
 * Matching only on the obvious id/class conventions would miss both, so the
 * descendant check is not belt-and-braces, it is load-bearing.
 */
const RAPTIVE_ID = /^(adthrive[-_]|cls-video-container-)/i;
const RAPTIVE_TOKEN = /^(adthrive|rp-)/i;
const RAPTIVE_DESCENDANT =
  '[id^="AdThrive_" i],[id^="adthrive-" i],[class~="adthrive"],[class*="adthrive-"],[class*="rp-"]';

export function isRaptiveContainer(el: Element): boolean {
  if (RAPTIVE_ID.test(el.id || '')) return true;
  for (const token of Array.from(el.classList)) {
    if (RAPTIVE_TOKEN.test(token)) return true;
  }
  return el.querySelector(RAPTIVE_DESCENDANT) !== null;
}
