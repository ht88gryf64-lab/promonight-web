// "Before you go" (docs/per-promo-pages-v2-spec.md, page order item 8, build
// order step 4, 2026-11-08): the building's game-day facts on a promo page,
// from the venueHubs provenance record and nothing else. Replaces the quick
// facts card, which printed any sourced field.
//
// THE RULE. A row renders only for a field the pipeline marked `rendered` in
// `fieldStates` (venuehubs-write-guard FIELD_STATES) AND whose own read time
// is in `observedAtByField`; the row prints that date and links the operator
// page the provenance record names. Any other state (operator-conflict, held,
// no-operator-page) renders nothing here, pointer included: the venue page
// explains a conflict in place, a promo page does not. A legacy doc with no
// state map has no rendered field and renders no block, whatever its sources
// map says: the state is what the renderer keys on (doctrine: "Venue facts
// render only from provenance DB fields in state `rendered`, with the observed
// date shown"). A building with nothing to show renders no block at all.
//
// This module is the dependency-free half (the row type, the labels, the
// state-and-date test), so the view can import it without pulling the hub
// loader and its Firestore handle into a client-side render. The builder that
// reads a hub is src/lib/before-you-go-rows.ts.
import type { VenueFieldState } from './venue-hub';

export type BeforeYouGoKey = 'bag' | 'gates' | 'transit' | 'parking';

export interface BeforeYouGoRow {
  key: BeforeYouGoKey;
  label: string;
  /** The stored value, verbatim (dimensions, lot names) or its first sentence. */
  text: string;
  /** The field's own read time, ISO, from observedAtByField. */
  observedAt: string;
  /** The same, formatted ("Oct 7, 2026"). */
  observedOn: string;
  /** The operator page the provenance record names, when it names one. */
  sourceUrl: string | null;
  sourceHost: string | null;
}

export const BEFORE_YOU_GO_LABEL = 'Before you go';
/** The venue page's order: bag capsule, Getting in (gates, transit), parking. */
export const BEFORE_YOU_GO_ORDER: readonly BeforeYouGoKey[] = ['bag', 'gates', 'transit', 'parking'];
export const BEFORE_YOU_GO_LABELS: Record<BeforeYouGoKey, string> = { bag: 'Bag policy', gates: 'Gates', transit: 'Transit', parking: 'Parking' };

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
