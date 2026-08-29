import { IconGift, IconConfetti, IconCup, IconBalloon, IconTicket } from '@tabler/icons-react';
import { isPurchaseGated } from '@/lib/promo-helpers';
import type { Promo, PromoType } from '@/lib/types';

// Redesign v2 category system. ONE Tabler icon per category, ONE color per
// category — mirrors the --color-rd-cat-* tokens in globals.css. The mapping
// intentionally flips the live hues: giveaway is ORANGE (live = green), food is
// GREEN (live = orange); theme purple and kids blue are unchanged. Jersey is a
// giveaway and uses the gift icon + orange (no separate type — jersey promos
// are typed `giveaway`).
export interface CategoryMeta {
  key: PromoType;
  label: string;
  /** Hex mirroring --color-rd-cat-{key}; used for inline dots/pills/borders. */
  color: string;
  /** Darker text ink for use ON a 10% tint of `color`. The raw token on its
   *  own tint fails WCAG AA at pill sizes (giveaway 2.53:1, food 2.95:1,
   *  kids 4.49:1); these inks clear 4.5:1 on the tint (4.71 / 6.99 / 5.94 /
   *  6.23). An ink for the existing palette, not a fifth palette: dots,
   *  borders, and tints keep `color`. */
  ink: string;
  Icon: typeof IconGift;
}

export const RD_CATEGORIES: Record<PromoType, CategoryMeta> = {
  giveaway: { key: 'giveaway', label: 'Giveaways', color: '#f97316', ink: '#a35a08', Icon: IconGift },
  theme: { key: 'theme', label: 'Theme Nights', color: '#7c3aed', ink: '#5b2fbd', Icon: IconConfetti },
  food: { key: 'food', label: 'Food Deals', color: '#16a34a', ink: '#0d6b31', Icon: IconCup },
  kids: { key: 'kids', label: 'Kids & Family', color: '#2563eb', ink: '#1d54ad', Icon: IconBalloon },
};

// DARK-CONTEXT INKS, MEASURED BUT DELIBERATELY NOT ADDED AS A FIELD.
// `ink` is darker than `color`, which is correct on the light surfaces and
// catastrophic on a dark one: on the retired dark hero the inks measured
// 2.38 / 1.69 / 1.92 / 1.90. Nothing on the site currently renders a category
// tint on a dark background (the last such surface, HeroTonightCard, was
// deleted with the homepage rebuild), so an inkDark field would have no
// consumer and would rot. The measurement is kept here so it is not lost if a
// dark category surface returns:
//   giveaway #fa934b, theme #b692f5, food #1ac459, kids #80a4f3
// Those clear 4.5:1 on a #2b2522 composite (white 6% over #1d1714). Add the
// field WITH its first consumer, not before. Note also that a computed
// variant is the wrong shape here: the tint is a hex-alpha string the browser
// composites at paint time, so JS never sees the resolved background, and
// deriving it would duplicate the compositing rule in a second place.

// Display order for chips and legends: giveaway, theme, food, kids.
export const RD_CATEGORY_ORDER: PromoType[] = ['giveaway', 'theme', 'food', 'kids'];

export function categoryFor(type: PromoType): CategoryMeta {
  return RD_CATEGORIES[type] ?? RD_CATEGORIES.giveaway;
}

// The section-8 display category. A row whose own description says a purchase
// is required is not a giveaway, so it does not get the giveaway pill and it
// does not get the HOT flame. It still renders — the event is real and a fan
// may want it — but it renders under a label that matches its own copy.
//
// Neutral slate rather than a fifth brand hue: this is deliberately the least
// eye-catching pill on the page, because the whole defect was purchasable
// inventory dressed as the most exciting thing in the list. Ink measured on the
// 10% tint of `color` at 5.6:1, clearing AA at pill size like the other four.
export const RD_TICKET_PACKAGE: CategoryMeta = {
  key: 'giveaway',
  label: 'Ticket Package',
  color: '#64748b',
  ink: '#3f4c5f',
  Icon: IconTicket,
};

/** Display category for a promo, section-8 rule applied. Use this in any
 *  renderer that shows a category pill; `categoryFor` is the raw type map. */
export function categoryForPromo(promo: Pick<Promo, 'type' | 'title' | 'description'>): CategoryMeta {
  return isPurchaseGated(promo) ? RD_TICKET_PACKAGE : categoryFor(promo.type);
}
