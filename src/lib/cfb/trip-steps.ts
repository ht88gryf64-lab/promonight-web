// The Plan-the-trip gating rule. Pure and Firestore-free on purpose: it is the
// only place the no-coordinates branch is exercised, since no page in the
// 32-slug registry currently lacks coordinates, so it has to be unit-testable
// without mocking Firebase.

export type TripStepKey = 'tickets' | 'hotels' | 'parking' | 'gates';

export interface TripStepVenue {
  lat: number | null;
  lng: number | null;
  city: string | null;
  hubSlug: string | null;
  hubIndexable: boolean;
}

/** Which Plan-the-trip steps may render.
 *
 *  The TIMELINE gates these, not the CTA components, because the components do
 *  not fail closed:
 *   - SpotHeroCTA NEVER returns null. With no coords it renders a tracked link
 *     to spothero.com's homepage under a "Reserve Parking" label, which is a
 *     dead end wearing a useful hat. So parking requires real coordinates.
 *   - ExpediaCTA returns null only when coords AND city are both absent, and a
 *     city-only hotel search is legitimate, so hotels needs either.
 *   - Gates and bags needs an INDEXABLE hub, or it links into an empty page.
 *   - Tickets always renders. A page with only tickets is acceptable and still
 *     shows the timeline heading. */
export function planTripSteps(input: {
  hasTicketSchool: boolean;
  venue: TripStepVenue | null;
}): TripStepKey[] {
  const steps: TripStepKey[] = [];
  if (!input.hasTicketSchool) return steps;
  steps.push('tickets');
  const v = input.venue;
  if (!v) return steps;
  const hasCoords = v.lat !== null && v.lng !== null;
  if (hasCoords || !!v.city) steps.push('hotels');
  if (hasCoords) steps.push('parking');
  if (v.hubSlug && v.hubIndexable) steps.push('gates');
  return steps;
}
