/**
 * Fallback city map for <HotelsCTA>, used ONLY when a team lacks venue
 * coordinates in Firestore. Coordinates are the primary path now —
 * buildBookingUrl routes to Booking.com's lat/lng search when available,
 * which radiates ~5-10 mi around the venue and sidesteps the entire
 * brand-city-vs-stadium-city string matching problem.
 *
 * Don't expand this table — add venue coordinates to the team's Firestore
 * venue doc instead. At audit time this table was the live fallback for
 * ~26% of teams (all MLS, most NBA, most WNBA, a handful of NFL/NHL).
 *
 * Keyed by team slug (Firestore doc id, also the URL segment). Entries only
 * exist where brand city differs from stadium city.
 */
export const VENUE_CITY_OVERRIDES: Record<string, string> = {
  // NFL — brand cities rarely match stadium cities.
  'dallas-cowboys': 'Arlington, TX',
  'new-england-patriots': 'Foxborough, MA',
  'san-francisco-49ers': 'Santa Clara, CA',
  'washington-commanders': 'Landover, MD',
  'los-angeles-rams': 'Inglewood, CA',
  'los-angeles-chargers': 'Inglewood, CA',
  'new-york-giants': 'East Rutherford, NJ',
  'new-york-jets': 'East Rutherford, NJ',
  'buffalo-bills': 'Orchard Park, NY',

  // MLB — mostly matches except a handful of state-named or suburb-hosted teams.
  'texas-rangers': 'Arlington, TX',
  'los-angeles-angels': 'Anaheim, CA',
  'atlanta-braves': 'Cumberland, GA',
  // Arizona Diamondbacks brand city = "Arizona" (state) — Phoenix is more useful.
  'arizona-diamondbacks': 'Phoenix, AZ',

  // NBA
  // Utah Jazz brand city = "Utah" — Salt Lake City is the actual venue area.
  'utah-jazz': 'Salt Lake City, UT',

  // NHL
  'new-jersey-devils': 'Newark, NJ',
  'new-york-islanders': 'Elmont, NY',
  // Carolina Hurricanes brand city = "Carolina" — Raleigh is the venue area.
  'carolina-hurricanes': 'Raleigh, NC',

  // MLS — stadiums often sit outside the metro's namesake city.
  'la-galaxy': 'Carson, CA',
  'new-england-revolution': 'Foxborough, MA',
  'new-york-red-bulls': 'Harrison, NJ',
  'fc-dallas': 'Frisco, TX',
};
