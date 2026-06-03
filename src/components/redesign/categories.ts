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
  Icon: typeof IconGift;
}

export const RD_CATEGORIES: Record<PromoType, CategoryMeta> = {
  giveaway: { key: 'giveaway', label: 'Giveaways', color: '#f97316', Icon: IconGift },
  theme: { key: 'theme', label: 'Theme Nights', color: '#7c3aed', Icon: IconConfetti },
  food: { key: 'food', label: 'Food Deals', color: '#16a34a', Icon: IconCup },
  kids: { key: 'kids', label: 'Kids & Family', color: '#2563eb', Icon: IconBalloon },
};

// Display order for chips and legends: giveaway, theme, food, kids.
export const RD_CATEGORY_ORDER: PromoType[] = ['giveaway', 'theme', 'food', 'kids'];

export function categoryFor(type: PromoType): CategoryMeta {
  return RD_CATEGORIES[type] ?? RD_CATEGORIES.giveaway;
}
