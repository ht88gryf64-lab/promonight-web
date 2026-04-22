/**
 * Teams whose stadium sits in a different municipality than the team's brand
 * city. Used by <HotelsCTA> to route Booking.com searches to the actual
 * stadium area rather than the brand city a local might infer from the team
 * name (e.g. Cowboys fans need Arlington, not Dallas).
 *
 * Keyed by team slug (the Firestore doc id, also used as the URL segment).
 * Verified against the active team roster: entries where brand city already
 * equals stadium city are intentionally omitted — they would be no-ops.
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
