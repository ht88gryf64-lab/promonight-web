// Copy for the recurring-deals section and the one count it adds to the hero.
//
// WHY THIS EXISTS (discovery-apply, 2026-10-24). The section was headed "Every
// home game / EVERY GAME DEALS" and its lead said the deals "happen at <team>
// home games". On 2026-10-24 that heading sat over 22 records on 21 pages and
// NONE of them ran at every home game: every stored frequency was a weekday
// ("Every Tuesday home game"), a short list ("Select home games (3 dates)") or
// "Most Sunday home games". The Knicks' first recurring deal, Popcorn TWOsday,
// is Tuesdays only. So the wording is now derived from the records' own
// frequency strings and categories, and never asserted.
//
// The hero's Food Deals tile counted dated food rows only, so a page showing a
// recurring food deal could read "0 Food Deals" directly above it. A recurring
// record is a food deal by construction: the pipeline folds only food-typed rows
// into recurring records (collapse-recurring.js COLLAPSE_ELIGIBLE_TYPES), and
// splits them into food and drink by keyword. The kids category is left out:
// its stored titles are activities ("Kids Run the Bases", "KidsFest").
import type { RecurringDeal, RecurringDealCategory } from './recurring-deals';

/** Categories that count as a food deal on the hero tile. */
const FOOD_DEAL_CATEGORIES: ReadonlySet<RecurringDealCategory> = new Set(['food', 'drink']);

/** Recurring records the Food Deals tile adds to its dated count. */
export function recurringFoodDealCount(deals: readonly RecurringDeal[]): number {
  return deals.filter((d) => FOOD_DEAL_CATEGORIES.has(d.category)).length;
}

const EVERY_GAME_RE = /^every\s+home\s+game$/i;

export interface RecurringSectionCopy {
  kicker: string;
  title: string;
  lead: string;
}

const CATEGORY_NOUN: Record<RecurringDealCategory, string> = {
  food: 'food',
  drink: 'drink',
  kids: 'family',
  ticket: 'ticket',
  music: 'music',
};

/** "food", "food and drink", "food, drink and family", in a fixed order. */
function nounList(deals: readonly RecurringDeal[]): string {
  const order: RecurringDealCategory[] = ['food', 'drink', 'kids', 'ticket', 'music'];
  const present = order.filter((c) => deals.some((d) => d.category === c)).map((c) => CATEGORY_NOUN[c]);
  if (present.length <= 1) return present[0] ?? 'food';
  return `${present.slice(0, -1).join(', ')} and ${present[present.length - 1]}`;
}

/**
 * The section's kicker, heading and lead, from what the records say.
 *
 *   every record "Every home game"     the original copy, unchanged
 *   one shared frequency               that frequency as the kicker
 *   mixed frequencies                  a kicker that claims no schedule
 *
 * The lead never says when a deal runs; each card prints its own frequency.
 */
export function recurringSectionCopy(
  deals: readonly RecurringDeal[],
  teamName: string,
  venueName: string | null,
): RecurringSectionCopy {
  const at = venueName ? ` at ${venueName}` : '';
  const freqs = deals.map((d) => d.frequency.trim()).filter(Boolean);
  if (freqs.length === deals.length && freqs.length > 0 && freqs.every((f) => EVERY_GAME_RE.test(f))) {
    return {
      kicker: 'Every home game',
      title: 'EVERY GAME DEALS',
      lead: `Recurring ${nounList(deals)} deals that happen at every ${teamName} home game${at}, regardless of the promo calendar.`,
    };
  }
  const distinct = [...new Set(freqs.map((f) => f.toLowerCase()))];
  const kicker = distinct.length === 1 && freqs.length === deals.length ? freqs[0] : 'Repeats at home games';
  const lead =
    deals.length === 1
      ? `A ${nounList(deals)} deal that repeats at ${teamName} home games${at}. The card below says which games.`
      : `${capitalize(nounList(deals))} deals that repeat at ${teamName} home games${at}. Each card says which games.`;
  return { kicker, title: 'RECURRING DEALS', lead };
}

function capitalize(s: string): string {
  return s ? s[0].toUpperCase() + s.slice(1) : s;
}

/**
 * The scoreboard note's tail when the Food Deals tile carries recurring
 * records. The note names the population the tiles count ("98 promotions in
 * the 2026 season"), and that population is dated rows, so a tile that adds a
 * recurring record has to say so in the same sentence. Empty when it adds none.
 */
export function recurringNoteTail(count: number): string {
  if (count <= 0) return '';
  return `, plus ${count} recurring food ${count === 1 ? 'deal' : 'deals'}`;
}
