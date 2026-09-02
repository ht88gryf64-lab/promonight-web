// CFB venue -> IANA time zone (keyed by cfbVenues doc id), plus the neutral-site
// venueHubs buildings the 2026 corpus references (keyed by venueHubs slug).
//
// WHY THIS EXISTS: cfbGames.kickoff.tz is a two-letter label ("ET", "CT", "MT",
// "PT") stamped by whichever school's site the row was parsed from, so an away
// school's parse leaves the HOME venue's game labelled in the away zone
// (Tennessee vs Texas at Neyland stored as "11:00 AM CT"). The display layer
// needs the zone of the building the game is played in, and the schema's IANA
// contract for kickoff.tz was never honoured by the parser. This map is that
// zone, one entry per building, validated in src/lib/__tests__/cfb-venue-timezones.test.ts
// against the stored coordinates (longitude band) and Intl.
//
// Values mirror the pipeline's per-school venueTz (scripts/cfb/lib/schools-2026.ts),
// which is the zone the verify stage read Wikipedia times in. Arizona venues are
// America/Phoenix (no DST), Boise is America/Boise; both matter in September.
//
// Pure data, no server imports. Coordinates in the trailing comment are the
// stored cfbVenues lat/lng at generation time (2026-09-02), for the audit trail.

export const CFB_VENUE_TIMEZONES: Record<string, string> = {
  'acrisure-bounce-house': 'America/New_York', // ucf (28.61, -81.19)
  'acrisure-stadium': 'America/New_York', // pittsburgh (40.45, -80.02)
  'albertsons-stadium': 'America/Boise', // boise-state (43.60, -116.20)
  'allegacy-federal-credit-union-stadium': 'America/New_York', // wake-forest (36.13, -80.25)
  'allegiant-stadium': 'America/Los_Angeles', // unlv (36.09, -115.18)
  'alumni-stadium': 'America/New_York', // boston-college (42.34, -71.17)
  'amon-g-carter-stadium': 'America/Chicago', // tcu (32.71, -97.37)
  'autzen-stadium': 'America/Los_Angeles', // oregon (44.06, -123.07)
  'beaver-stadium': 'America/New_York', // penn-state (40.81, -77.86)
  'ben-hill-griffin-stadium': 'America/New_York', // florida (29.65, -82.35)
  'bill-snyder-family-football-stadium': 'America/Chicago', // kansas-state (39.20, -96.59)
  'bobby-dodd-stadium': 'America/New_York', // georgia-tech (33.77, -84.39)
  'boone-pickens-stadium': 'America/Chicago', // oklahoma-state (36.13, -97.07)
  'bridgeforth-stadium-and-zane-showker-field': 'America/New_York', // james-madison (38.44, -78.87)
  'brooks-stadium': 'America/New_York', // coastal-carolina (33.79, -79.02)
  'california-memorial-stadium': 'America/Los_Angeles', // california (37.87, -122.25)
  'camp-randall-stadium': 'America/Chicago', // wisconsin (43.07, -89.41)
  'carter-finley-stadium': 'America/New_York', // nc-state (35.80, -78.72)
  'casino-del-sol-stadium': 'America/Phoenix', // arizona (32.23, -110.95)
  'darrell-k-royal-texas-memorial-stadium': 'America/Chicago', // texas (30.28, -97.73)
  'david-booth-kansas-memorial-stadium': 'America/Chicago', // kansas (38.96, -95.25)
  'davis-wade-stadium': 'America/Chicago', // mississippi-state (33.46, -88.79)
  'doak-campbell-stadium': 'America/New_York', // florida-state (30.44, -84.30)
  'donald-w-reynolds-razorback-stadium': 'America/Chicago', // arkansas (36.07, -94.18)
  'falcon-stadium': 'America/Denver', // air-force (39.00, -104.84)
  'faurot-field': 'America/Chicago', // missouri (38.94, -92.33)
  'firstbank-stadium': 'America/Chicago', // vanderbilt (36.14, -86.81)
  'folsom-field': 'America/Denver', // colorado (40.01, -105.27)
  'gaylord-family-oklahoma-memorial-stadium': 'America/Chicago', // oklahoma (35.21, -97.44)
  'gerald-j-ford-stadium': 'America/Chicago', // smu (32.84, -96.78)
  'gies-memorial-stadium': 'America/Chicago', // illinois (40.10, -88.24)
  'glass-bowl': 'America/New_York', // toledo (41.66, -83.61)
  'hard-rock-stadium': 'America/New_York', // miami (25.96, -80.24)
  'huntington-bank-stadium': 'America/Chicago', // minnesota (44.98, -93.22)
  'huskie-stadium': 'America/Chicago', // northern-illinois (41.93, -88.78)
  'husky-stadium': 'America/Los_Angeles', // washington (47.65, -122.30)
  'jack-trice-stadium': 'America/Chicago', // iowa-state (42.01, -93.64)
  'jma-wireless-dome': 'America/New_York', // syracuse (43.04, -76.14)
  'joan-c-edwards-stadium': 'America/New_York', // marshall (38.42, -82.42)
  'jones-stadium': 'America/Chicago', // texas-tech (33.59, -101.87)
  'jordan-hare-stadium': 'America/Chicago', // auburn (32.60, -85.49)
  'kenan-stadium': 'America/New_York', // north-carolina (35.91, -79.05)
  'kidd-brewer-stadium': 'America/New_York', // appalachian-state (36.21, -81.69)
  'kinnick-stadium': 'America/Chicago', // iowa (41.66, -91.55)
  'kroger-field': 'America/New_York', // kentucky (38.02, -84.51)
  'kyle-field': 'America/Chicago', // texas-am (30.61, -96.34)
  'lane-stadium': 'America/New_York', // virginia-tech (37.22, -80.42)
  'lavell-edwards-stadium': 'America/Denver', // byu (40.26, -111.66)
  'ln-federal-credit-union-stadium': 'America/New_York', // louisville (38.21, -85.76)
  'los-angeles-memorial-coliseum': 'America/Los_Angeles', // usc (34.01, -118.29)
  'martin-stadium-northwestern-university': 'America/Chicago', // northwestern (42.07, -87.69)
  'mclane-stadium': 'America/Chicago', // baylor (31.56, -97.12)
  'memorial-stadium-clemson': 'America/New_York', // clemson (34.68, -82.84)
  'memorial-stadium-indiana-university': 'America/New_York', // indiana (39.18, -86.53)
  'memorial-stadium-lincoln': 'America/Chicago', // nebraska (40.82, -96.71)
  'michie-stadium': 'America/New_York', // army (41.39, -73.96)
  'michigan-stadium': 'America/New_York', // michigan (42.27, -83.75)
  'milan-puskar-stadium': 'America/New_York', // west-virginia (39.65, -79.96)
  'mountain-america-stadium': 'America/Phoenix', // arizona-state (33.43, -111.93)
  'navy-marine-corps-memorial-stadium': 'America/New_York', // navy (38.98, -76.51)
  'neyland-stadium': 'America/New_York', // tennessee (35.95, -83.92)
  'nippert-stadium': 'America/New_York', // cincinnati (39.13, -84.52)
  'notre-dame-stadium': 'America/New_York', // notre-dame (41.70, -86.23)
  'ohio-stadium': 'America/New_York', // ohio-state (40.00, -83.02)
  'pratt-whitney-stadium-at-rentschler-field': 'America/New_York', // uconn (41.76, -72.62)
  'raymond-james-stadium': 'America/New_York', // south-florida (27.98, -82.50)
  'rice-eccles-stadium': 'America/Denver', // utah (40.76, -111.85)
  'rose-bowl-stadium': 'America/Los_Angeles', // ucla (34.16, -118.17)
  'ross-ade-stadium': 'America/New_York', // purdue (40.43, -86.92)
  'saban-field-at-bryant-denny-stadium': 'America/Chicago', // alabama (33.21, -87.55)
  'sanford-stadium': 'America/New_York', // georgia (33.95, -83.37)
  'scott-stadium': 'America/New_York', // virginia (38.03, -78.51)
  'secu-stadium': 'America/New_York', // maryland (38.99, -76.95)
  'shi-stadium': 'America/New_York', // rutgers (40.51, -74.47)
  'simmons-bank-liberty-stadium': 'America/Chicago', // memphis (35.12, -89.98)
  'snapdragon-stadium': 'America/Los_Angeles', // san-diego-state (32.78, -117.12)
  'space-city-financial-stadium': 'America/Chicago', // houston (29.72, -95.35)
  'spartan-stadium-east-lansing-michigan': 'America/New_York', // michigan-state (42.73, -84.48)
  'stanford-stadium': 'America/Los_Angeles', // stanford (37.43, -122.16)
  'tiger-stadium-louisiana': 'America/Chicago', // lsu (30.41, -91.18)
  'valley-childrens-stadium': 'America/Los_Angeles', // fresno-state (36.81, -119.76)
  'vaught-hemingway-stadium': 'America/Chicago', // ole-miss (34.36, -89.53)
  'wallace-wade-stadium': 'America/New_York', // duke (36.00, -78.94)
  'williams-brice-stadium': 'America/New_York', // south-carolina (33.97, -81.02)
  'williams-stadium': 'America/New_York', // liberty (37.35, -79.17)
  'yulman-stadium': 'America/Chicago', // tulane (29.94, -90.12)
};

/** Neutral-site buildings referenced by cfbGames.neutralVenueHubSlug in 2026. */
export const CFB_NEUTRAL_HUB_TIMEZONES: Record<string, string> = {
  'mercedes-benz-stadium': 'America/New_York', // Atlanta, Georgia (33.76, -84.40)
  'lambeau-field': 'America/Chicago', // Green Bay, Wisconsin (44.50, -88.06)
  'nissan-stadium': 'America/Chicago', // Nashville, Tennessee (36.17, -86.77)
  'tql-stadium': 'America/New_York', // Cincinnati, Ohio (39.11, -84.52)
  'bank-of-america-stadium': 'America/New_York', // Charlotte, North Carolina (35.23, -80.85)
  'cotton-bowl-stadium': 'America/Chicago', // Dallas, Texas (32.78, -96.76)
  'gillette-stadium': 'America/New_York', // Foxborough, Massachusetts (42.09, -71.26)
  'metlife-stadium': 'America/New_York', // East Rutherford, New Jersey (40.81, -74.07)
};

/** Zone of the building a game is played in. THE RECORD FIRST: a `timezone`
 *  on the cfbVenues doc (campus) or the venueHubs doc (neutral site), written by
 *  scripts/cfb/populate-venue-timezones.ts. The maps below are the fallback for
 *  a doc without the field, and the only source for a home school with no doc
 *  at all. Null when nothing answers: the kickoff then keeps its stored label. */
export function resolveVenueZone(g: {
  neutralSite?: boolean | null;
  neutralVenueHubSlug?: string | null;
  homeSchoolId: string;
  homeVenueId?: string | null;
  homeVenueTimezone?: string | null;
  neutralHubTimezone?: string | null;
}): string | null {
  if (g.neutralSite) return g.neutralHubTimezone || cfbNeutralHubTimezone(g.neutralVenueHubSlug);
  return g.homeVenueTimezone || cfbVenueTimezone(g.homeVenueId) || cfbUntrackedHomeTimezone(g.homeSchoolId);
}

/** The IANA zone of a cfbVenues building, or null when unmapped. Never guess:
 *  an unmapped venue leaves the kickoff in its stored label. */
export function cfbVenueTimezone(venueId: string | null | undefined): string | null {
  return venueId ? CFB_VENUE_TIMEZONES[venueId] ?? null : null;
}

/** Untracked HOME schools in the 2026 corpus (an opponent with no cfbSchools
 *  doc, so no cfbVenues doc and no coordinates), keyed by the school id the
 *  parser wrote. Several ids are drifted spellings of the same school
 *  (cal, jmu/james-madison-university, san-jos-state); every spelling present in
 *  cfbGames.homeSchoolId is listed. Campus city in the comment. */
export const CFB_UNTRACKED_HOME_TIMEZONES: Record<string, string> = {
  'akron': 'America/New_York', // Akron, OH
  'ball-state': 'America/New_York', // Muncie, IN
  'bowling-green': 'America/New_York', // Bowling Green, OH
  'cal': 'America/Los_Angeles', // Berkeley, CA (drift of california)
  'charlotte': 'America/New_York', // Charlotte, NC
  'colorado-state': 'America/Denver', // Fort Collins, CO
  'delaware': 'America/New_York', // Newark, DE
  'east-carolina': 'America/New_York', // Greenville, NC
  'ecu': 'America/New_York', // Greenville, NC (drift of east-carolina)
  'eastern-michigan': 'America/New_York', // Ypsilanti, MI
  'fau': 'America/New_York', // Boca Raton, FL (drift of florida-atlantic)
  'florida-atlantic': 'America/New_York', // Boca Raton, FL
  'georgia-southern': 'America/New_York', // Statesboro, GA
  'georgia-southern-university': 'America/New_York', // Statesboro, GA (drift)
  'georgia-state': 'America/New_York', // Atlanta, GA
  'georgia-state-university': 'America/New_York', // Atlanta, GA (drift)
  'hawaii': 'Pacific/Honolulu', // Honolulu, HI (no DST)
  'james-madison-university': 'America/New_York', // Harrisonburg, VA (drift of james-madison)
  'jmu': 'America/New_York', // Harrisonburg, VA (drift of james-madison)
  'kennesaw-state': 'America/New_York', // Kennesaw, GA
  'louisiana': 'America/Chicago', // Lafayette, LA
  'louisiana-tech': 'America/Chicago', // Ruston, LA
  'marshall-university': 'America/New_York', // Huntington, WV (drift of marshall)
  'miami-oh': 'America/New_York', // Oxford, OH
  'missouri-state': 'America/Chicago', // Springfield, MO
  'nevada': 'America/Los_Angeles', // Reno, NV
  'new-mexico': 'America/Denver', // Albuquerque, NM
  'new-mexico-state': 'America/Denver', // Las Cruces, NM
  'north-dakota-state': 'America/Chicago', // Fargo, ND
  'north-texas': 'America/Chicago', // Denton, TX
  'ohio': 'America/New_York', // Athens, OH
  'oklahoma-st': 'America/Chicago', // Stillwater, OK (drift of oklahoma-state)
  'old-dominion': 'America/New_York', // Norfolk, VA
  'oregon-state': 'America/Los_Angeles', // Corvallis, OR
  'rice': 'America/Chicago', // Houston, TX
  'sacramento-state': 'America/Los_Angeles', // Sacramento, CA
  'san-jos-state': 'America/Los_Angeles', // San Jose, CA (mangled slug)
  'san-jose-state': 'America/Los_Angeles', // San Jose, CA
  'south-alabama': 'America/Chicago', // Mobile, AL
  'southern-miss': 'America/Chicago', // Hattiesburg, MS
  'southern-mississippi': 'America/Chicago', // Hattiesburg, MS (drift)
  'temple': 'America/New_York', // Philadelphia, PA
  'texas-state': 'America/Chicago', // San Marcos, TX
  'tulsa': 'America/Chicago', // Tulsa, OK
  'uab': 'America/Chicago', // Birmingham, AL
  'ulm': 'America/Chicago', // Monroe, LA
  'utah-state': 'America/Denver', // Logan, UT
  'utsa': 'America/Chicago', // San Antonio, TX
  'western-michigan': 'America/New_York', // Kalamazoo, MI
  'wyoming': 'America/Denver', // Laramie, WY
  // Tracked school with no cfbVenues doc (seeded 2026-08-17 without one), so the
  // campus map cannot answer; listed here so its home games still resolve.
  'washington-state': 'America/Los_Angeles', // Pullman, WA
};

/** The IANA zone of an untracked home school's campus, or null when unmapped. */
export function cfbUntrackedHomeTimezone(schoolId: string | null | undefined): string | null {
  return schoolId ? CFB_UNTRACKED_HOME_TIMEZONES[schoolId] ?? null : null;
}

/** The IANA zone of a neutral-site venueHubs building, or null when unmapped. */
export function cfbNeutralHubTimezone(slug: string | null | undefined): string | null {
  return slug ? CFB_NEUTRAL_HUB_TIMEZONES[slug] ?? null : null;
}
