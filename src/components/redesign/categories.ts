import { IconGift, IconConfetti, IconCup, IconBalloon } from '@tabler/icons-react';
import type { PromoType } from '@/lib/types';

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

// Display order for chips and legends: giveaway, theme, food, kids.
export const RD_CATEGORY_ORDER: PromoType[] = ['giveaway', 'theme', 'food', 'kids'];

export function categoryFor(type: PromoType): CategoryMeta {
  return RD_CATEGORIES[type] ?? RD_CATEGORIES.giveaway;
}
