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
  // ── Added 2026-08-27, second pass. Same standard as the eleven above: the
  // stale-transit sweep graded these "changed" rather than "discontinued",
  // but the classification pass judged each one would-strand, meaning a fan
  // acting on our sentence waits for something that will not serve them.
  // That grading distinction was the sweep's, not a difference in fan impact.
  {
    hub: 'albertsons-stadium',
    reason: "Boise State: the stored Downtown Bronco Shuttle is VRT's 2023 pilot, which VRT discontinued after that season; the 2026 downtown ride is VRT's Game Day Bus, every 15 minutes from 13 stops, so the stored name, frequency and entire 7-stop list have no current operator backing. Boise State's own Lincoln and Brady garage shuttle is confirmed only through the 2025 fan guide.",
  },
  {
    hub: 'amon-g-carter-stadium',
    reason: "TCU: the 2026 parking page states the Saint Stephen's Presbyterian shuttle will not run for the Sept 12, Nov 14 and Nov 21 home games, three of eight dates, and that the Hyatt Place shuttle is hotel guests only. The stored text offers both to any fan on any game day.",
  },
  {
    hub: 'barclays-center',
    reason: "Barclays Center: the stored late-night LIRR promise (service up to 2 AM) is contradicted by MTA's published timetable for Aug 26 to Nov 8 2026, which has no Atlantic Terminal departure at or after 00:30 on any of 75 service days, with the last weeknight train at 23:31. It describes a pre-2021 Islanders-era arrangement.",
  },
  {
    hub: 'carter-finley-stadium',
    reason: "NC State: the 2026 stadium guide redefines Wolfpack Express as four roaming golf carts for fans needing assistance and retains only the Indoor Practice Facility lots, dropping the stored Westchase, Practice Field, Trinity and Stadium West stops. Gate 11 is now the terminus of a separate ADA bus for placard holders, not the general drop-off the stored text promises every rider.",
  },
  {
    hub: 'citizens-bank-park',
    reason: "Philadelphia: SEPTA's dated 23 August 2026 timetable shortens Route 17 to 2nd-Market to 20th-Johnston, with Pattison Av, NRG and Packer Park absent from every weekday, Saturday and Sunday table, so the stored Route 17 clause strands anyone who boards it. Broad-Pattison and the Navy Yard are now carried by Route 45.",
  },
  {
    hub: 'darrell-k-royal-texas-memorial-stadium',
    reason: "Texas: CapMetro's rail service is Route 550 (Red Line) and does not serve the stadium at all, so the stored MetroRail Route 18 names a service that does not exist on that corridor.",
  },
  {
    hub: 'davis-wade-stadium',
    reason: "Mississippi State: SMART has no Old Main or Hwy 12 route in its current roster, system map or GTFS feed; those patterns are now Starkville Central and Starkville Campus, and the stored Davis Wade Express is not in the operator's current service.",
  },
  {
    hub: 'donald-w-reynolds-razorback-stadium',
    reason: "Arkansas: Razorback Transit runs these as Route 88 and Route 89, with Silver and Gold surviving only as legend aliases, and service starts three hours before kickoff rather than the stored four.",
  },
  {
    hub: 'empower-field',
    reason: "Denver: RTD's D and H Lines have been suspended since 7 June 2026 for the Downtown Rail Reconstruction, and the D Line is additionally proposed for permanent discontinuation. The stored text routes fans to both as transfers to the E Line.",
  },
  {
    hub: 'exploria-stadium',
    reason: "Orlando: the stored Lymmo routing is not supported by the operator's current service, and the stored source URL 301-redirects to a malformed path that returns 403, so the claim cannot be re-verified against the page it came from.",
  },
  {
    hub: 'hard-rock-stadium',
    reason: "Miami Gardens: the stored Brightline Aventura round-trip shuttle, the Lot 70 and Lot 95 park-and-ride and the Uber Shuttle are event-specific arrangements not confirmed by the operator for the 2026 season, so a fan planning around them may find no service.",
  },
  {
    hub: 'jones-stadium',
    reason: "Texas Tech: the stored Citibus Park and Ride gameday shuttle is not confirmed in the operator's current service, and the stored 2016 source URL now redirects to a 2026 page carrying different arrangements.",
  },
  {
    hub: 'kenan-stadium',
    reason: "North Carolina: the stored Tar Heel Express description no longer matches the operator's current service, and the cited 2023 article was last touched in 2024, so the stop and timing detail it carries is not current-season.",
  },
  {
    hub: 'martin-stadium-northwestern-university',
    reason: "Northwestern: the stored transit directions are for a prior hub venue and the guide is still labelled 2025 Gameday Information, so the routing does not describe how to reach the 2026 home venue.",
  },
  {
    hub: 'memorial-stadium-lincoln',
    reason: "Nebraska: the cited huskers.com page no longer carries the StarTran gameday shuttle schedule, loading location or pickup points that the stored text quotes, so none of the stored Big Red Express detail can be re-verified against the operator.",
  },
  {
    hub: 'moda-center',
    reason: "Portland: TriMet truncated the MAX Green Line to Clackamas Town Center and Gateway Transit Center on 23 August 2026, so it no longer reaches Rose Quarter Transit Center; TriMet's own Rose Quarter page now lists Blue, Red and Yellow only. Bus 77 also moved off NE 9th Ave.",
  },
  {
    hub: 'mt-bank-stadium',
    reason: "Baltimore: the stored RavensRide park-and-ride charter buses are not confirmed by the operator for the 2026 season, so fans planning to park at a listed lot and ride in may find no service.",
  },
  {
    hub: 'paycor-stadium',
    reason: "Cincinnati: the stored TANK Bengals gameday shuttle drop-off at the Riverfront Transit Center is affected by a dated closure, so the stored drop-off point does not describe where the shuttle actually sets down this season.",
  },
  {
    hub: 'sofi-stadium',
    reason: "Inglewood: the stored Torrance Transit SoFi Special Service, Culver CityBus Line 99 Express and GTrans Line 7X are event services whose current-season operation is not confirmed by the operators, and GTrans's old gtrans.org domain now redirects to a domain-for-sale lander.",
  },
  {
    hub: 'space-city-financial-stadium',
    reason: "Houston: the stored UH game-day shuttle buses on the east campus and north end routes are confirmed only for a prior season, with no current-season page from the university or the operator confirming they run in 2026.",
  },
  {
    hub: 'target-center',
    reason: "Minneapolis: the stored routing names services that no longer describe how to reach the arena this season, and the operator's current network does not carry the stops the stored text sends riders to.",
  },
  // ── Added 2026-08-27, third pass. huntington-bank-field was proposed as a
  // copy edit and silenced instead: the qualifier that makes the sentence
  // true (event-only service) lived only in the lines array, and the
  // condensed block renders a first sentence, so a surface could carry the
  // service name without the restriction. The other five were graded
  // would-mislead rather than would-strand, and are silenced by ruling
  // rather than re-sourced, pending a corrected harvest.
  {
    hub: 'huntington-bank-field',
    reason: "Cleveland: GCRTA publishes the Waterfront Line as event-only, running between Tower City and South Harbor for Browns home games and select major events, and its Blue and Green Line pages both say riders continuing to the Waterfront Line change trains at Tower City, so the stored claim that W. 3rd St. Station is served by the Blue, Green and Waterfront Lines is wrong. Silenced rather than relabelled: the event-only qualifier survives only in the lines array, and the condensed block renders a first sentence, so the restriction is structurally droppable.",
  },
  {
    hub: 'everbank-stadium',
    reason: "Jacksonville: JTA's Gameday Xpress runs for the 2026 Jaguars season, but JTA's own 2026 page publishes different park-and-ride origins and times than the stored text gives, so a fan planning around the stored pickup may find no service there.",
  },
  {
    hub: 'jack-trice-stadium',
    reason: "Iowa State: CyRide route 3 Blue still runs, but its current Saturday timetable, season-stamped 17 August 2026 to 14 May 2027, does not carry the gameday service pattern the stored text describes.",
  },
  {
    hub: 'lane-stadium',
    reason: "Virginia Tech: Blacksburg Transit's 2026 football page still reads that game-day details will be posted before the first game, so the stored expanded schedule and Two Town Trolley routing have no current-season backing from the operator.",
  },
  {
    hub: 'neyland-stadium',
    reason: "Tennessee: KAT still runs buses from the Civic Coliseum garages to Neyland in 2026, but not on the terms the stored text publishes, so the stored pickup points and timing would send a fan to the wrong place or the wrong hour.",
  },
  {
    hub: 'simmons-bank-liberty-stadium',
    reason: "Memphis: the $10 University of Memphis Park and Ride shuttle still runs, but the stored description comes from a 2024 fan-information article and Memphis Athletics has since published different terms, so the stored price, origin and timing are not the current-season arrangement.",
  },
];

const SUPPRESSED = new Set(TRANSIT_SUPPRESSED.map((t) => t.hub));

/** True when this building's transit text must not render on any surface. */
export function transitSuppressed(hubSlug: string): boolean {
  return SUPPRESSED.has(hubSlug);
}
