// World Cup 2026 host-city config for the /world-cup cross-sport travel guide.
//
// Every World Cup match date, round, venue, and match count below was verified
// in June 2026 against the official FIFA 2026 schedule, the official host-city
// committee sites (e.g. atlantafwc26.com, dallasfwc26.com, nynjfwc26.com,
// phillyfwc26.com), the stadium event pages, and major outlets (FIFA.com,
// FOX Sports, NBC Sports). The 11 US venues host 78 of the tournament's 104
// matches (Canada and Mexico host 13 each). The deep rounds are all in the US:
// both semi-finals (Dallas July 14, Atlanta July 15), the third-place play-off
// (Miami July 18), and the Final (New York / New Jersey, July 19).
//
// Each city pairs its World Cup venue with the nearest MLB ballpark, so a fan
// in town for the World Cup can also catch a local MLB home game. The MLB
// schedule and promos come from Firestore at request time; this file is the
// static editorial layer (which teams, which venue, how far apart).
//
// Tournament window: June 11 to July 19, 2026.

export interface WorldCupTeamRef {
  /** PromoNight team id (the Firestore team doc id and URL slug). */
  slug: string;
  /** Short display name used in the card, e.g. "Dodgers". */
  display: string;
  /** Current (2026) ballpark name. */
  ballpark: string;
  /** One-line relationship of the ballpark to the World Cup venue. */
  relationship: string;
}

/** An optional non-MLB marquee event surfaced as a special row on a city card. */
export interface WorldCupSpecialEvent {
  /** YYYY-MM-DD. */
  date: string;
  label: string;
  venue: string;
  note: string;
}

export interface WorldCupCity {
  /** Short stable key, used for React keys and in-page anchors. */
  slug: string;
  /** Display city, e.g. "Los Angeles / Inglewood". */
  city: string;
  /** Real stadium name (FIFA uses generic "City Stadium" names during the event). */
  wcVenue: string;
  /** City / state the World Cup venue sits in. */
  wcVenueLocation: string;
  /** World Cup venue coordinates. Affiliate-routing fallback only; the live
   *  ticket / parking / hotel CTAs route by the MLB ballpark venue coords. */
  wcVenueLat: number;
  wcVenueLng: number;
  /** Total World Cup matches the venue hosts. */
  totalMatches: number;
  /** The deepest (and chronologically last) round the venue hosts, for the
   *  card eyebrow. e.g. "Final", "Semi-final", "Quarter-final", "Round of 16". */
  marqueeRound: string;
  /** YYYY-MM-DD of that marquee match. */
  marqueeDate: string;
  /** YYYY-MM-DD of the venue's first World Cup match. */
  firstMatchDate: string;
  /** Human window of the venue's World Cup matches, e.g. "June 12 to July 10". */
  wcWindow: string;
  /** Optional one-line note about the venue's knockout slate (e.g. Miami). */
  roundsNote?: string;
  primaryTeam: WorldCupTeamRef;
  secondaryTeam?: WorldCupTeamRef;
  /** Optional non-MLB special event row (Philadelphia: the MLB All-Star Game). */
  specialEvent?: WorldCupSpecialEvent;
}

export const WORLD_CUP_WINDOW_START = '2026-06-11';
export const WORLD_CUP_WINDOW_END = '2026-07-19';

// MLB All-Star break: no MLB games are played league-wide across these dates,
// which overlaps the World Cup semi-finals and final. Cities will legitimately
// show no home games in this stretch.
export const MLB_ALL_STAR_BREAK_START = '2026-07-13';
export const MLB_ALL_STAR_BREAK_END = '2026-07-16';

export const WORLD_CUP_CITIES: WorldCupCity[] = [
  {
    slug: 'new-york-new-jersey',
    city: 'New York / New Jersey',
    wcVenue: 'MetLife Stadium',
    wcVenueLocation: 'East Rutherford, NJ',
    wcVenueLat: 40.8135,
    wcVenueLng: -74.0745,
    totalMatches: 8,
    marqueeRound: 'Final',
    marqueeDate: '2026-07-19',
    firstMatchDate: '2026-06-13',
    wcWindow: 'June 13 to July 19',
    roundsNote: 'Five group games, a Round of 32, a Round of 16, and the Final.',
    primaryTeam: {
      slug: 'new-york-yankees',
      display: 'Yankees',
      ballpark: 'Yankee Stadium',
      relationship: 'About 12 miles from MetLife Stadium',
    },
    secondaryTeam: {
      slug: 'new-york-mets',
      display: 'Mets',
      ballpark: 'Citi Field',
      relationship: 'About 15 miles from MetLife Stadium',
    },
  },
  {
    slug: 'dallas',
    city: 'Dallas / Arlington',
    wcVenue: 'AT&T Stadium',
    wcVenueLocation: 'Arlington, TX',
    wcVenueLat: 32.7473,
    wcVenueLng: -97.0945,
    totalMatches: 9,
    marqueeRound: 'Semi-final',
    marqueeDate: '2026-07-14',
    firstMatchDate: '2026-06-14',
    wcWindow: 'June 14 to July 14',
    roundsNote: 'The busiest venue of the tournament: nine matches, through a semi-final.',
    primaryTeam: {
      slug: 'texas-rangers',
      display: 'Rangers',
      ballpark: 'Globe Life Field',
      relationship: 'Same Arlington complex as AT&T Stadium, a short walk away',
    },
  },
  {
    slug: 'atlanta',
    city: 'Atlanta',
    wcVenue: 'Mercedes-Benz Stadium',
    wcVenueLocation: 'Atlanta, GA',
    wcVenueLat: 33.7553,
    wcVenueLng: -84.4006,
    totalMatches: 8,
    marqueeRound: 'Semi-final',
    marqueeDate: '2026-07-15',
    firstMatchDate: '2026-06-15',
    wcWindow: 'June 15 to July 15',
    primaryTeam: {
      slug: 'atlanta-braves',
      display: 'Braves',
      ballpark: 'Truist Park',
      relationship: 'About 13 miles from Mercedes-Benz Stadium',
    },
  },
  {
    slug: 'miami',
    city: 'Miami',
    wcVenue: 'Hard Rock Stadium',
    wcVenueLocation: 'Miami Gardens, FL',
    wcVenueLat: 25.958,
    wcVenueLng: -80.2389,
    totalMatches: 7,
    marqueeRound: 'Third-place play-off',
    marqueeDate: '2026-07-18',
    firstMatchDate: '2026-06-15',
    wcWindow: 'June 15 to July 18',
    roundsNote: 'Hosts a quarter-final on July 11 and the third-place play-off on July 18.',
    primaryTeam: {
      slug: 'miami-marlins',
      display: 'Marlins',
      ballpark: 'loanDepot park',
      relationship: 'About 15 miles from Hard Rock Stadium',
    },
  },
  {
    slug: 'los-angeles',
    city: 'Los Angeles / Inglewood',
    wcVenue: 'SoFi Stadium',
    wcVenueLocation: 'Inglewood, CA',
    wcVenueLat: 33.9535,
    wcVenueLng: -118.3392,
    totalMatches: 8,
    marqueeRound: 'Quarter-final',
    marqueeDate: '2026-07-10',
    firstMatchDate: '2026-06-12',
    wcWindow: 'June 12 to July 10',
    primaryTeam: {
      slug: 'los-angeles-dodgers',
      display: 'Dodgers',
      ballpark: 'Dodger Stadium',
      relationship: 'About 12 miles from SoFi Stadium',
    },
  },
  {
    slug: 'boston',
    city: 'Boston / Foxborough',
    wcVenue: 'Gillette Stadium',
    wcVenueLocation: 'Foxborough, MA',
    wcVenueLat: 42.0909,
    wcVenueLng: -71.2643,
    totalMatches: 7,
    marqueeRound: 'Quarter-final',
    marqueeDate: '2026-07-09',
    firstMatchDate: '2026-06-13',
    wcWindow: 'June 13 to July 9',
    primaryTeam: {
      slug: 'boston-red-sox',
      display: 'Red Sox',
      ballpark: 'Fenway Park',
      relationship: 'About 25 miles north of Gillette Stadium in Foxborough',
    },
  },
  {
    slug: 'kansas-city',
    city: 'Kansas City',
    wcVenue: 'Arrowhead Stadium',
    wcVenueLocation: 'Kansas City, MO',
    wcVenueLat: 39.0489,
    wcVenueLng: -94.4839,
    totalMatches: 6,
    marqueeRound: 'Quarter-final',
    marqueeDate: '2026-07-11',
    firstMatchDate: '2026-06-16',
    wcWindow: 'June 16 to July 11',
    primaryTeam: {
      slug: 'kansas-city-royals',
      display: 'Royals',
      ballpark: 'Kauffman Stadium',
      relationship: 'Shares the Truman Sports Complex with Arrowhead Stadium, right next door',
    },
  },
  {
    slug: 'houston',
    city: 'Houston',
    wcVenue: 'NRG Stadium',
    wcVenueLocation: 'Houston, TX',
    wcVenueLat: 29.6847,
    wcVenueLng: -95.4107,
    totalMatches: 7,
    marqueeRound: 'Round of 16',
    marqueeDate: '2026-07-04',
    firstMatchDate: '2026-06-14',
    wcWindow: 'June 14 to July 4',
    primaryTeam: {
      slug: 'houston-astros',
      display: 'Astros',
      ballpark: 'Daikin Park',
      relationship: 'About 7 miles from NRG Stadium',
    },
  },
  {
    slug: 'seattle',
    city: 'Seattle',
    wcVenue: 'Lumen Field',
    wcVenueLocation: 'Seattle, WA',
    wcVenueLat: 47.5952,
    wcVenueLng: -122.3316,
    totalMatches: 6,
    marqueeRound: 'Round of 16',
    marqueeDate: '2026-07-06',
    firstMatchDate: '2026-06-15',
    wcWindow: 'June 15 to July 6',
    primaryTeam: {
      slug: 'seattle-mariners',
      display: 'Mariners',
      ballpark: 'T-Mobile Park',
      relationship: 'Next door to Lumen Field in the SoDo district',
    },
  },
  {
    slug: 'philadelphia',
    city: 'Philadelphia',
    wcVenue: 'Lincoln Financial Field',
    wcVenueLocation: 'Philadelphia, PA',
    wcVenueLat: 39.9008,
    wcVenueLng: -75.1675,
    totalMatches: 6,
    marqueeRound: 'Round of 16',
    marqueeDate: '2026-07-04',
    firstMatchDate: '2026-06-14',
    wcWindow: 'June 14 to July 4',
    roundsNote: 'World Cup matches run June 14 through the July 4 Round of 16, the first World Cup knockout match ever played on Independence Day.',
    primaryTeam: {
      slug: 'philadelphia-phillies',
      display: 'Phillies',
      ballpark: 'Citizens Bank Park',
      relationship: 'Same South Philadelphia sports complex as Lincoln Financial Field, steps away',
    },
    specialEvent: {
      date: '2026-07-14',
      label: 'MLB All-Star Game',
      venue: 'Citizens Bank Park',
      note: 'Ten days after the World Cup Round of 16 at the Linc, the city hosts the MLB All-Star Game next door.',
    },
  },
  {
    slug: 'san-francisco-bay-area',
    city: 'SF Bay Area / Santa Clara',
    wcVenue: "Levi's Stadium",
    wcVenueLocation: 'Santa Clara, CA',
    wcVenueLat: 37.403,
    wcVenueLng: -121.9698,
    totalMatches: 6,
    marqueeRound: 'Round of 32',
    marqueeDate: '2026-07-01',
    firstMatchDate: '2026-06-13',
    wcWindow: 'June 13 to July 1',
    primaryTeam: {
      slug: 'san-francisco-giants',
      display: 'Giants',
      ballpark: 'Oracle Park',
      relationship: "About 45 miles north of Levi's Stadium, in San Francisco",
    },
  },
];
