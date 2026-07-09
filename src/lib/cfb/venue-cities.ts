// Authoritative CFB venue -> city map (keyed by cfbVenues doc id).
//
// WHY THIS EXISTS: the scraped cfbVenues `city`/`state` fields are junk for 59 of
// 86 venues (raw street addresses, "University of X"+city run-ons, wiki fragments,
// bracketed URLs, empties) e.g. ross-ade-stadium.city =
// "850 Steven Beering Drive[https://...search.cfm Find Campus Address]". The
// `name` field is always clean. Rather than render (or heuristically parse) the
// junk, this hand-verified constant is the single clean source of the city for
// every venue, so the team page shows "Ross-Ade Stadium · West Lafayette" instead
// of an address. Pure data (no server imports) so client components can use it.
//
// venueCity() NEVER returns the raw junk field: an id not in the map yields null,
// and the caller falls back to name-only.

export const CFB_VENUE_CITY: Record<string, string> = {
  'acrisure-bounce-house': 'Orlando',
  'acrisure-stadium': 'Pittsburgh',
  'albertsons-stadium': 'Boise',
  'allegacy-federal-credit-union-stadium': 'Winston-Salem',
  'allegiant-stadium': 'Las Vegas',
  'alumni-stadium': 'Chestnut Hill',
  'amon-g-carter-stadium': 'Fort Worth',
  'autzen-stadium': 'Eugene',
  'beaver-stadium': 'University Park',
  'ben-hill-griffin-stadium': 'Gainesville',
  'bill-snyder-family-football-stadium': 'Manhattan',
  'bobby-dodd-stadium': 'Atlanta',
  'boone-pickens-stadium': 'Stillwater',
  'bridgeforth-stadium-and-zane-showker-field': 'Harrisonburg',
  'brooks-stadium': 'Conway',
  'california-memorial-stadium': 'Berkeley',
  'camp-randall-stadium': 'Madison',
  'carter-finley-stadium': 'Raleigh',
  'casino-del-sol-stadium': 'Tucson',
  'darrell-k-royal-texas-memorial-stadium': 'Austin',
  'david-booth-kansas-memorial-stadium': 'Lawrence',
  'davis-wade-stadium': 'Starkville',
  'doak-campbell-stadium': 'Tallahassee',
  'donald-w-reynolds-razorback-stadium': 'Fayetteville',
  'falcon-stadium': 'Colorado Springs',
  'faurot-field': 'Columbia',
  'firstbank-stadium': 'Nashville',
  'folsom-field': 'Boulder',
  'gaylord-family-oklahoma-memorial-stadium': 'Norman',
  'gerald-j-ford-stadium': 'Dallas',
  'gies-memorial-stadium': 'Champaign',
  'glass-bowl': 'Toledo',
  'hard-rock-stadium': 'Miami Gardens',
  'huntington-bank-stadium': 'Minneapolis',
  'huskie-stadium': 'DeKalb',
  'husky-stadium': 'Seattle',
  'jack-trice-stadium': 'Ames',
  'jma-wireless-dome': 'Syracuse',
  'joan-c-edwards-stadium': 'Huntington',
  'jones-stadium': 'Lubbock',
  'jordan-hare-stadium': 'Auburn',
  'kenan-stadium': 'Chapel Hill',
  'kidd-brewer-stadium': 'Boone',
  'kinnick-stadium': 'Iowa City',
  'kroger-field': 'Lexington',
  'kyle-field': 'College Station',
  'lane-stadium': 'Blacksburg',
  'lavell-edwards-stadium': 'Provo',
  'ln-federal-credit-union-stadium': 'Louisville',
  'los-angeles-memorial-coliseum': 'Los Angeles',
  'martin-stadium-northwestern-university': 'Evanston',
  'mclane-stadium': 'Waco',
  'memorial-stadium-clemson': 'Clemson',
  'memorial-stadium-indiana-university': 'Bloomington',
  'memorial-stadium-lincoln': 'Lincoln',
  'michie-stadium': 'West Point',
  'michigan-stadium': 'Ann Arbor',
  'milan-puskar-stadium': 'Morgantown',
  'mountain-america-stadium': 'Tempe',
  'navy-marine-corps-memorial-stadium': 'Annapolis',
  'neyland-stadium': 'Knoxville',
  'nippert-stadium': 'Cincinnati',
  'notre-dame-stadium': 'South Bend',
  'ohio-stadium': 'Columbus',
  'pratt-whitney-stadium-at-rentschler-field': 'East Hartford',
  'raymond-james-stadium': 'Tampa',
  'rice-eccles-stadium': 'Salt Lake City',
  'rose-bowl-stadium': 'Pasadena',
  'ross-ade-stadium': 'West Lafayette',
  'saban-field-at-bryant-denny-stadium': 'Tuscaloosa',
  'sanford-stadium': 'Athens',
  'scott-stadium': 'Charlottesville',
  'secu-stadium': 'College Park',
  'shi-stadium': 'Piscataway',
  'simmons-bank-liberty-stadium': 'Memphis',
  'snapdragon-stadium': 'San Diego',
  'space-city-financial-stadium': 'Houston',
  'spartan-stadium-east-lansing-michigan': 'East Lansing',
  'stanford-stadium': 'Stanford',
  'tiger-stadium-louisiana': 'Baton Rouge',
  'valley-childrens-stadium': 'Fresno',
  'vaught-hemingway-stadium': 'Oxford',
  'wallace-wade-stadium': 'Durham',
  'williams-brice-stadium': 'Columbia',
  'williams-stadium': 'Lynchburg',
  'yulman-stadium': 'New Orleans',
};

/** Clean city for a venue by its cfbVenues doc id. Returns null (never the junk
 *  city field) when the venue is unknown, so callers show stadium name only. */
export function venueCity(venue: { id: string } | null | undefined): string | null {
  if (!venue) return null;
  return CFB_VENUE_CITY[venue.id] ?? null;
}
