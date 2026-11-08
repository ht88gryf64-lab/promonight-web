// "Before you go" (docs/per-promo-pages-v2-spec.md, page order item 8, build
// order step 4, 2026-11-08): the building's game-day facts on a promo page,
// from the venueHubs provenance record. Replaces the quick facts card, which
// printed any sourced field, wherever the record carries provenance.
//
// THE RULE. A PROVENANCE ROW renders for a field the pipeline marked
// `rendered` in `fieldStates` (venuehubs-write-guard FIELD_STATES) AND whose
// own read time is in `observedAtByField`; it prints that date and links the
// operator page the record names. Any other state (operator-conflict, held,
// no-operator-page) renders nothing, pointer included: the venue page
// explains a conflict in place, a promo page does not.
//
// THE UNION (ruling 2026-11-08). When a building has at least one provenance
// row, the block is the union of those rows, first, in the order below, and
// then every class the quick facts card would have shown for this building
// that is not already present, as a row with the operator link and no
// "Source read" line. A class present in both uses the provenance row only,
// so nothing appears twice. A building with no provenance row at all (a
// legacy doc with no state map, or one nobody signed off, whose claims the
// published view nulls) renders no block: the view falls back to the quick
// facts card exactly as it rendered before step 4.
//
// This module is the dependency-free half (the row type, the labels, the
// state-and-date test), so the view can import it without pulling the hub
// loader and its Firestore handle into a client-side render. The builder that
// reads a hub is src/lib/before-you-go-rows.ts.
import type { VenueFieldState } from './venue-hub';

/** The provenance classes (bag, gates, transit, parking) plus the one class
 *  the quick facts card shows that only ever reaches the block through the
 *  union (outside food). */
export type BeforeYouGoKey = 'bag' | 'gates' | 'transit' | 'parking' | 'outsideFood';

export interface BeforeYouGoRow {
  key: BeforeYouGoKey;
  label: string;
  /** The stored value, verbatim (dimensions, lot names) or its first sentence. */
  text: string;
  /** The field's own read time, ISO, from observedAtByField. Null on a union
   *  row: a class the quick facts card would have shown, with no dated
   *  provenance record behind it, so no "Source read" line. */
  observedAt: string | null;
  /** The same, formatted ("Oct 7, 2026"); null on a union row. */
  observedOn: string | null;
  /** The operator page: the provenance record's URL, else the pointer the
   *  card linked (the bag policy page, the official parking page). */
  sourceUrl: string | null;
  sourceHost: string | null;
}

export const BEFORE_YOU_GO_LABEL = 'Before you go';
/** The provenance rows' order, the venue page's: bag capsule, Getting in
 *  (gates, transit), parking. Union rows follow, in the card's order. */
export const BEFORE_YOU_GO_ORDER: readonly Exclude<BeforeYouGoKey, 'outsideFood'>[] = ['bag', 'gates', 'transit', 'parking'];
export const BEFORE_YOU_GO_LABELS: Record<BeforeYouGoKey, string> = { bag: 'Bag policy', gates: 'Gates', transit: 'Transit', parking: 'Parking', outsideFood: 'Outside food' };

type StateMap = Record<string, VenueFieldState> | undefined;
type DateMap = Record<string, string> | undefined;

/** The ISO read time of a field in state `rendered`, under its flat key or a
 *  dotted sub-key; null when the state is anything else or absent, or the read
 *  time is missing or unparseable. Both conditions, one answer. */
export function renderedReadTime(states: StateMap, observed: DateMap, field: string, sub?: string): string | null {
  const state = states?.[field] ?? (sub ? states?.[`${field}.${sub}`] : undefined);
  if (state !== 'rendered') return null;
  const iso = observed?.[field] ?? (sub ? observed?.[`${field}.${sub}`] : undefined);
  return typeof iso === 'string' && !Number.isNaN(Date.parse(iso)) ? iso : null;
}
