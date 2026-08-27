// Buildings whose stored publicTransit text names a service a fan cannot use.
//
// WHY THIS EXISTS. The stale-transit sweep of 2026-08-27
// (audit/cfb-venue-sourcing-report.md section 11) checked every named line,
// route and shuttle on all 131 hubs carrying a transit field against the
// operator's own site, and each concern was then re-established independently.
// Eleven buildings name a service that is discontinued, withdrawn from the
// stop, or otherwise unusable this season. A fan reading our sentence and
// acting on it would wait for something that is not coming.
//
// WHAT THIS DOES. It silences the transit field on those buildings at every
// surface that renders it, the same way an unsourced field is silenced: the
// stored text is NOT edited, NOT deleted, and NOT replaced with a guess, and
// nothing here writes to Firestore. The record keeps what was harvested and
// the page stops asserting it. When a field is re-sourced from the operator,
// delete its entry and the text renders again.
//
// WHAT THIS DELIBERATELY DOES NOT DO. It does not touch the indexing floor
// (venueHubIsIndexable / readIndexFloorFields), which reads the raw doc. That
// matches how an unsourced field already behaves: it counts toward the floor
// while staying off the page. It matters for exactly one building,
// providence-park, whose floor is geo + bag + transit with no parking; folding
// suppression into the floor would drop it from the sitemap and /venues and
// flip its page to noindex. That is an indexing decision, not a copy decision,
// and it is filed as an open question rather than taken here.
//
// This module imports nothing on purpose: it is read by the mapper's
// description builder, by two server components, by the NFL hub route and by
// the CFB condensed block, so it must be free of `server-only` and of any
// dependency direction.

export interface TransitSuppression {
  /** venueHubs doc id. */
  hub: string;
  /** The service that does not run, and the operator evidence for it. */
  reason: string;
}

export const TRANSIT_SUPPRESSED: ReadonlyArray<TransitSuppression> = [
  {
    hub: 'levis-stadium',
    reason: "Levi's Stadium: the only transit source is the Super Bowl 50 gameday guide (Feb 2016), which states on its own face that regular-season shuttles do not apply to it and routes riders to a VTA.org/SB50 page that now 404s. The stored VTA / ACE / Capitol Corridor arrangement describes one 2016 event day.",
  },
  {
    hub: 'stanford-stadium',
    reason: 'Stanford Stadium: Caltrain publishes, on each dated 2026 home-game page, that Stanford Station will not be open and riders should use Palo Alto and walk. The stored text presents Caltrain game-day stops at Stanford as available.',
  },
  {
    hub: 'dodger-stadium',
    reason: 'Dodger Stadium: the stored lines name the Metro Gold Line, which no longer exists after the Regional Connector merged it into the A and E lines, and the Red and Purple Line labels are likewise off Metro’s current roster of eight lettered lines.',
  },
  {
    hub: 'loandepot-park',
    reason: 'loanDepot park: Metrobus routes 6 and 51 are absent from Miami-Dade DTPW’s live roster and current GTFS feed, route 21 still runs but its nearest stop is now about 1.7 km from the ballpark, and Civic Center station is published as UHealth | Jackson.',
  },
  {
    hub: 'providence-park',
    reason: 'Providence Park: TriMet’s own route page reads "This route is discontinued with replacement service on line 19-Glisan/Canyon Rd" for 58-Canyon Rd, which the stored lines still name.',
  },
  {
    hub: 'gerald-j-ford-stadium',
    reason: 'Gerald J. Ford Stadium: DART publishes that from September 14 2026 the Red Line does not run in either direction on weekends. SMU plays Saturdays, and the stored text names DART without that limit.',
  },
  {
    hub: 'audi-field',
    reason: 'Audi Field: Metrobus 74 and P6 do not exist in WMATA’s post-redesign network, whose 117 routes carry no bare-numeric names at all; the Buzzard Point service is now C55 and C11.',
  },
  {
    hub: 'bmo-field',
    reason: 'BMO Field: the stored routing sends riders to a TTC 509/511 replacement bus that TTC’s own notice scoped to February through Summer 2025.',
  },
  {
    hub: 'husky-stadium',
    reason: 'Husky Stadium: UW Athletics states the South Kirkland, Eastgate and Redondo Heights park-and-ride express buses no longer operate in 2026, replaced by expanded Link light rail. The stored text names King County Metro park-and-ride buses without that.',
  },
  {
    hub: 'los-angeles-memorial-coliseum',
    reason: 'Los Angeles Memorial Coliseum: the stored lines name the Metro Silver Line, discontinued in the busway restructure, and the Expo Line, renamed the E Line after the Regional Connector.',
  },
  {
    hub: 'mountain-america-stadium',
    reason: 'Mountain America Stadium: the stored text routes riders to the Dorsey/Apache Blvd park-and-ride for the streetcar connection; Valley Metro announced that lot closed permanently on 2026-05-29.',
  },
];

const SUPPRESSED = new Set(TRANSIT_SUPPRESSED.map((t) => t.hub));

/** True when this building's transit text must not render on any surface. */
export function transitSuppressed(hubSlug: string): boolean {
  return SUPPRESSED.has(hubSlug);
}
