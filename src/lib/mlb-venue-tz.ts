// Venue timezones for MLB games.
//
// WHY THIS EXISTS. MLB game docs are written by src/lib/ingest-mlb.ts, which
// until 2026-09-01 hardcoded `gameTimeTz = 'UTC'` for every game (line 104).
// The stored gameTime is the true UTC instant, so the timezone field was not
// wrong so much as absent: it recorded the encoding, not the venue. That left
// src/lib/format-game-time.ts with nothing to convert INTO, so its MLB branch
// called toLocaleTimeString with no timeZone and rendered in the runtime's own
// zone. On Vercel the runtime is UTC, so a 7:10 PM Dodgers first pitch shipped
// in the prerendered HTML as "2:10 AM", one line above the correct "7:10 PM"
// on the promo beside it. See the Phase 0 audit, 2026-09-01.
//
// The fix is a real IANA zone per game, which lets the EXISTING DST-safe branch
// of format-game-time.ts run unchanged. This module is where that zone comes
// from.
//
// WHY VENUE AND NOT CLUB. Keying on the home club would be simpler and is
// right for 32 of the 34 venue strings in the corpus, but it is wrong for
// exactly the games that are hardest to notice:
//
//   Estadio Alfredo Harp Helu  Diamondbacks "home", Mexico City   CST, not MST
//   Journey Bank Ballpark      Brewers "home", Williamsport PA    ET,  not CT
//
// Both would render an hour off under a club map, on a neutral-site game where
// a reader has no local knowledge to catch it. Las Vegas Ballpark and Field of
// Dreams happen to share their club's zone, so they are free either way.
//
// MAP MISSES. See resolveMlbZone below. A miss NEVER returns the 'UTC'
// sentinel, because doing so would silently reproduce the original bug on one
// club's pages.

/** Every distinct `venueName` in the mlb games corpus, measured 2026-09-01
 *  (34 values, 2,455 docs). Keys are the exact stored strings, not tidied:
 *  the ingest writes MLB StatsAPI's `venue.name` verbatim, so a sponsor rename
 *  lands here as a new key rather than an edit. */
export const MLB_VENUE_TO_TZ: Record<string, string> = {
  'American Family Field': 'America/Chicago', // Brewers, Milwaukee
  'Angel Stadium': 'America/Los_Angeles', // Angels, Anaheim
  'Busch Stadium': 'America/Chicago', // Cardinals, St Louis
  'Chase Field': 'America/Phoenix', // Diamondbacks, Phoenix (no DST)
  'Citi Field': 'America/New_York', // Mets, Queens
  'Citizens Bank Park': 'America/New_York', // Phillies, Philadelphia
  'Comerica Park': 'America/Detroit', // Tigers, Detroit
  'Coors Field': 'America/Denver', // Rockies, Denver
  'Daikin Park': 'America/Chicago', // Astros, Houston (was Minute Maid Park)
  'Estadio Alfredo Harp Helu': 'America/Mexico_City', // NEUTRAL: Mexico City Series
  'Fenway Park': 'America/New_York', // Red Sox, Boston
  'Field of Dreams': 'America/Chicago', // NEUTRAL: Dyersville, Iowa
  'Globe Life Field': 'America/Chicago', // Rangers, Arlington
  'Great American Ball Park': 'America/New_York', // Reds, Cincinnati (Eastern)
  'Journey Bank Ballpark': 'America/New_York', // NEUTRAL: Little League Classic, Williamsport PA
  'Kauffman Stadium': 'America/Chicago', // Royals, Kansas City
  'Las Vegas Ballpark': 'America/Los_Angeles', // ALTERNATE: Athletics, Las Vegas
  'Nationals Park': 'America/New_York', // Nationals, Washington
  'Oracle Park': 'America/Los_Angeles', // Giants, San Francisco
  'Oriole Park at Camden Yards': 'America/New_York', // Orioles, Baltimore
  'PNC Park': 'America/New_York', // Pirates, Pittsburgh
  'Petco Park': 'America/Los_Angeles', // Padres, San Diego
  'Progressive Field': 'America/New_York', // Guardians, Cleveland (Eastern)
  'Rate Field': 'America/Chicago', // White Sox, Chicago (was Guaranteed Rate Field)
  'Rogers Centre': 'America/Toronto', // Blue Jays, Toronto
  'Sutter Health Park': 'America/Los_Angeles', // Athletics, Sacramento
  'T-Mobile Park': 'America/Los_Angeles', // Mariners, Seattle
  'Target Field': 'America/Chicago', // Twins, Minneapolis
  'Tropicana Field': 'America/New_York', // Rays, St Petersburg
  'Truist Park': 'America/New_York', // Braves, Cumberland GA
  'UNIQLO Field at Dodger Stadium': 'America/Los_Angeles', // Dodgers, Los Angeles
  'Wrigley Field': 'America/Chicago', // Cubs, Chicago
  'Yankee Stadium': 'America/New_York', // Yankees, Bronx
  'loanDepot park': 'America/New_York', // Marlins, Miami
};

/** Home-market zone per club, the fallback when a venue string is not yet in
 *  the map. All 30 team-collection slugs are present; the coverage test pins
 *  that. This is the RIGHT answer for the likeliest kind of miss, a sponsor
 *  rename of a club's own park, because a renamed building has not moved. */
export const MLB_CLUB_TO_TZ: Record<string, string> = {
  'arizona-diamondbacks': 'America/Phoenix',
  'atlanta-braves': 'America/New_York',
  'baltimore-orioles': 'America/New_York',
  'boston-red-sox': 'America/New_York',
  'chicago-cubs': 'America/Chicago',
  'chicago-white-sox': 'America/Chicago',
  'cincinnati-reds': 'America/New_York',
  'cleveland-guardians': 'America/New_York',
  'colorado-rockies': 'America/Denver',
  'detroit-tigers': 'America/Detroit',
  'houston-astros': 'America/Chicago',
  'kansas-city-royals': 'America/Chicago',
  'los-angeles-angels': 'America/Los_Angeles',
  'los-angeles-dodgers': 'America/Los_Angeles',
  'miami-marlins': 'America/New_York',
  'milwaukee-brewers': 'America/Chicago',
  'minnesota-twins': 'America/Chicago',
  'new-york-mets': 'America/New_York',
  'new-york-yankees': 'America/New_York',
  'oakland-athletics': 'America/Los_Angeles',
  'philadelphia-phillies': 'America/New_York',
  'pittsburgh-pirates': 'America/New_York',
  'san-diego-padres': 'America/Los_Angeles',
  'san-francisco-giants': 'America/Los_Angeles',
  'seattle-mariners': 'America/Los_Angeles',
  'st-louis-cardinals': 'America/Chicago',
  'tampa-bay-rays': 'America/New_York',
  'texas-rangers': 'America/Chicago',
  'toronto-blue-jays': 'America/Toronto',
  'washington-nationals': 'America/New_York',
};

export interface MlbZone {
  /** A real IANA zone. Never the string 'UTC'. */
  tz: string;
  /** 'venue' when the venue string was mapped; 'club' when it was not and the
   *  home club's market answered instead. Callers use this to report drift. */
  source: 'venue' | 'club';
}

/**
 * MAP-MISS POLICY, chosen 2026-09-01: option (b), fall back to the home club's
 * zone and report the miss. NOT option (a), a hard failure.
 *
 * The reasoning. The likeliest miss is a sponsor rename of an existing park,
 * three of which are already in the corpus (Daikin Park, Rate Field, Sutter
 * Health Park), and for a rename the club fallback is EXACTLY correct: the
 * building did not move. A hard build failure would block every unrelated
 * deploy over a time label that the fallback is already rendering correctly.
 * The genuinely wrong case is a new NEUTRAL site in a different zone, which is
 * rare (4 games of 2,455 today) and is caught at ingest, where the new string
 * first appears, rather than silently at render.
 *
 * ABSENCE IS NULL, NEVER A DEFAULT. An unknown venue AND an unknown club
 * returns null, and the render then shows no time at all rather than a
 * confident wrong one. Nothing here can return 'UTC': that sentinel is what
 * produced the original defect, and reproducing it on one club's pages is the
 * one outcome worth failing to render over.
 */
export function resolveMlbZone(venueName: string, homeTeamSlug: string): MlbZone | null {
  const byVenue = MLB_VENUE_TO_TZ[venueName];
  if (byVenue) return { tz: byVenue, source: 'venue' };
  const byClub = MLB_CLUB_TO_TZ[homeTeamSlug];
  if (byClub) return { tz: byClub, source: 'club' };
  return null;
}
