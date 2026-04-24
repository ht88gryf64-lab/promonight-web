// Recurring every-game deals — deals that happen on a weekly cadence at every
// home game, independent of the promo calendar. These live here (not in
// Firestore) as a starter list; migrate to a `recurringDeals` collection when
// cross-surface (app + web) reads are needed.
//
// Scope: flagship teams with well-known recurring concession / ticket deals.
// Long-tail teams populated separately via data-ops.

export type RecurringDealCategory = 'food' | 'drink' | 'kids' | 'ticket' | 'music';

export interface RecurringDeal {
  title: string;
  frequency: string;
  description?: string;
  category: RecurringDealCategory;
}

const ICONS: Record<RecurringDealCategory, string> = {
  food: '🌭',
  drink: '🍺',
  kids: '🍦',
  ticket: '🎟️',
  music: '🎵',
};

export function iconFor(category: RecurringDealCategory): string {
  return ICONS[category];
}

// Key: team slug (matches Firestore team doc id).
export const RECURRING_DEALS: Record<string, RecurringDeal[]> = {
  'minnesota-twins': [
    {
      title: '$1 Hot Dogs',
      frequency: 'Every Tuesday home game',
      description: 'Dollar Dog Tuesdays: $1 hot dogs at concession stands throughout Target Field.',
      category: 'food',
    },
    {
      title: '$2 Beers',
      frequency: 'Friday & Saturday Happy Hour',
      description: 'Discounted domestic drafts during the first 90 minutes after gates open.',
      category: 'drink',
    },
    {
      title: 'Value Menu',
      frequency: 'Every home game',
      description: 'Rotating menu items under $6 — hot dogs, peanuts, popcorn, soft drinks.',
      category: 'food',
    },
    {
      title: 'Kids Eat Free',
      frequency: 'Sunday home games',
      description: 'Free kids meal with a ticketed adult at select concession stands for fans 12 and under.',
      category: 'kids',
    },
  ],
  'kansas-city-royals': [
    {
      title: '$1 Hot Dogs',
      frequency: 'Every Monday home game',
      description: 'Buck Night Mondays — $1 hot dogs at Kauffman Stadium concession stands.',
      category: 'food',
    },
    {
      title: 'Buck Night Sodas',
      frequency: 'Every Monday home game',
      description: '$1 fountain drinks paired with the Monday hot-dog deal.',
      category: 'drink',
    },
    {
      title: 'Family Sunday',
      frequency: 'Every Sunday home game',
      description: 'Discounted family ticket + concession bundles — check the team site for specifics.',
      category: 'kids',
    },
  ],
  'pittsburgh-pirates': [
    {
      title: '$2 Tuesdays',
      frequency: 'Every Tuesday home game',
      description: 'Select $2 hot dogs and $2 domestic drafts at designated PNC Park concession stands.',
      category: 'food',
    },
    {
      title: 'Dollar Dog Night',
      frequency: 'Select home games',
      description: 'Dollar hot dogs at select Pirates home dates — check the monthly schedule.',
      category: 'food',
    },
  ],
  'milwaukee-brewers': [
    {
      title: '$1 Hot Dogs',
      frequency: 'Monday home games vs AL opponents',
      description: 'Select Monday games at American Family Field feature dollar hot dogs at concession stands.',
      category: 'food',
    },
  ],
  'cleveland-guardians': [
    {
      title: 'Dollar Dog Night',
      frequency: 'Select home games',
      description: '$1 hot dogs at designated Progressive Field concession stands on promo nights.',
      category: 'food',
    },
  ],
  'cincinnati-reds': [
    {
      title: '$1 Hot Dogs',
      frequency: 'Select Tuesday home games',
      description: 'Dollar hot dogs at designated concession stands during Buck Night Tuesdays.',
      category: 'food',
    },
  ],
};

export function getRecurringDealsForTeam(teamId: string): RecurringDeal[] {
  return RECURRING_DEALS[teamId] ?? [];
}
