// Recurring every-game deals: deals that happen on a weekly cadence at every
// home game, independent of the promo calendar. As of the 2b cutover these are
// read from Firestore (teams/{teamId}/recurringDeals), written by the
// promo-pipeline recurring writer. The previous hardcoded RECURRING_DEALS
// starter map is gone; the data source is now Firestore, mirroring how dated
// promos are read in data.ts (getTeamPromos).

import 'server-only';
import { cache } from 'react';
import { db } from './firebase';

export type RecurringDealCategory = 'food' | 'drink' | 'kids' | 'ticket' | 'music';

export interface RecurringDeal {
  id: string;
  title: string;
  frequency: string;
  description?: string;
  category: RecurringDealCategory;
  tombstoned?: boolean;
}

const ICONS: Record<RecurringDealCategory, string> = {
  food: '🌭',
  drink: '🍺',
  kids: '🍦',
  ticket: '🎟️',
  music: '🎵',
};

const VALID_CATEGORIES = new Set<RecurringDealCategory>(['food', 'drink', 'kids', 'ticket', 'music']);

export function iconFor(category: RecurringDealCategory): string {
  return ICONS[category];
}

// Map a Firestore recurringDeals doc to a RecurringDeal. Carries doc.id into id
// (cards key by it), reads the body fields, and ignores the scanner provenance
// fields (occurrences / sourceDates / recurrence / sourceUrl / price). Mirrors
// mapPromoDoc's defensive style; an unknown category falls back to 'food' so the
// icon lookup can never index undefined.
function mapRecurringDealDoc(doc: FirebaseFirestore.DocumentSnapshot): RecurringDeal {
  const d = doc.data() ?? {};
  const category = VALID_CATEGORIES.has(d.category) ? (d.category as RecurringDealCategory) : 'food';
  const deal: RecurringDeal = {
    id: doc.id,
    title: typeof d.title === 'string' ? d.title : '',
    frequency: typeof d.frequency === 'string' ? d.frequency : '',
    category,
  };
  if (typeof d.description === 'string' && d.description.trim()) deal.description = d.description;
  if (d.tombstoned === true) deal.tombstoned = true;
  return deal;
}

// Visibility predicate: the recurring equivalent of isVisiblePromo. Absent and
// false are visible; only an explicit true hides. App-side array filter (never a
// Firestore inequality, which would drop field-absent docs).
const isVisibleRecurring = (d: RecurringDeal): boolean => d.tombstoned !== true;

// Read a team's recurring deals from teams/{teamId}/recurringDeals. Async +
// wrapped in React cache() (request-deduped) and SSG/ISR-safe, the same shape as
// getTeamPromos. Tombstoned docs are filtered out app-side. Returns [] for a team
// with no recurring deals, which the section component renders as nothing.
export const getRecurringDealsForTeam = cache(
  async (teamId: string): Promise<RecurringDeal[]> => {
    const snapshot = await db
      .collection('teams')
      .doc(teamId)
      .collection('recurringDeals')
      .get();
    return snapshot.docs.map(mapRecurringDealDoc).filter(isVisibleRecurring);
  },
);
