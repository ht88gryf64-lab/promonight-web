// Static config for the post-season champions celebration shown on /playoffs
// during the offseason window. Mirrors the World Cup hub pattern: a typed
// config file (like src/data/world-cup-cities.ts) drives the static editorial
// content, while the live "championship run" promo highlights are joined in
// server-side from the playoffPromos collection at render time.
//
// Team colors are the same brand hexes the rest of the site stores per team
// (decoded from the Firestore ARGB ints): Knicks #006BB6/#F58426,
// Hurricanes #CC0000/#000000. No licensed imagery is used anywhere; colors and
// typography are the only team branding.
//
// Auto-hide: the celebration clears itself once `now` passes
// CHAMPIONS_DISPLAY_UNTIL (2026-07-05), independent of any redeploy.

export type ChampionLeague = 'nba' | 'nhl';

export interface ParadeInfo {
  /** Display name of the parade / celebration. */
  name: string;
  /** ISO 8601 with timezone offset (parades are Eastern Time). */
  startDate: string;
  /** Human-readable, full location string for the visual card. */
  location: string;
  /** One-paragraph editorial description (original copy). */
  description: string;
  /** Organizing body, shown on the card and in Event schema. */
  organizer: string;
  /** Short venue name for schema.org Place.name. */
  venueName: string;
  /** PostalAddress parts for schema.org. */
  addressLocality: string;
  addressRegion: string;
}

export interface FinalsMVP {
  name: string;
  award: string;
  note: string;
}

export interface Champion {
  league: ChampionLeague;
  teamId: string;
  teamName: string;
  teamColors: { primary: string; secondary: string };
  titleYear: number;
  /** e.g. "4-1 over San Antonio Spurs". */
  seriesResult: string;
  /** e.g. "First NBA title since 1973". */
  seriesContext: string;
  finalsMVP: FinalsMVP;
  headCoach: string;
  /** Original editorial framing shown under the header. */
  framing: string;
  parade: ParadeInfo;
}

// Parent-level auto-hide. Once now > this, /playoffs drops the celebration and
// shows only the offseason placeholder.
export const CHAMPIONS_DISPLAY_UNTIL = '2026-07-05T00:00:00-04:00';

export const CHAMPIONS: Champion[] = [
  {
    league: 'nba',
    teamId: 'new-york-knicks',
    teamName: 'New York Knicks',
    teamColors: { primary: '#006BB6', secondary: '#F58426' },
    titleYear: 2026,
    seriesResult: '4-1 over San Antonio Spurs',
    seriesContext: 'First NBA title since 1973',
    finalsMVP: {
      name: 'Jalen Brunson',
      award: 'Bill Russell NBA Finals MVP',
      note: '45 points in Game 5',
    },
    headCoach: 'Mike Brown',
    framing:
      'The New York Knicks are NBA champions for the first time since 1973, ' +
      'closing out the Spurs in five games. Jalen Brunson ran the offense all ' +
      'postseason and poured in 45 to seal it in Game 5, while Mike Brown built ' +
      'a banner out of defense and depth. The celebration now heads up the ' +
      'Canyon of Heroes.',
    parade: {
      name: 'New York Knicks Championship Parade',
      startDate: '2026-06-18T10:00:00-04:00',
      location:
        'Canyon of Heroes, Broadway from Battery Park to City Hall, New York NY',
      description:
        "Ticker-tape parade up the Canyon of Heroes celebrating the Knicks' " +
        'first NBA championship since 1973, followed by a Key to the City ' +
        'ceremony at City Hall Plaza.',
      organizer: 'City of New York',
      venueName: 'Canyon of Heroes',
      addressLocality: 'New York',
      addressRegion: 'NY',
    },
  },
  {
    league: 'nhl',
    teamId: 'carolina-hurricanes',
    teamName: 'Carolina Hurricanes',
    teamColors: { primary: '#CC0000', secondary: '#000000' },
    titleYear: 2026,
    seriesResult: '4-2 over Vegas Golden Knights',
    seriesContext: 'Second Stanley Cup in franchise history',
    finalsMVP: {
      name: 'Jordan Staal',
      award: 'Conn Smythe Trophy',
      note: 'Shutdown center who anchored all four rounds',
    },
    headCoach: "Rod Brind'Amour",
    framing:
      'The Carolina Hurricanes have the second Stanley Cup in franchise ' +
      'history, taking the Final from Vegas in six. Captain Jordan Staal ' +
      'anchored every shift on the way to the Conn Smythe, and Rod ' +
      "Brind'Amour's forecheck-first system finally delivered the title. " +
      'Raleigh gets its championship celebration on Saturday.',
    parade: {
      name: 'Carolina Hurricanes Stanley Cup Championship Celebration',
      startDate: '2026-06-20T11:00:00-04:00',
      location: 'Downtown Raleigh, NC (specific route TBD)',
      description:
        'Championship Celebration presented by Spectrum honoring the ' +
        "Hurricanes' second Stanley Cup title. Specific parade route to be " +
        'announced by the team.',
      organizer: 'Carolina Hurricanes',
      venueName: 'Downtown Raleigh',
      addressLocality: 'Raleigh',
      addressRegion: 'NC',
    },
  },
];

/**
 * True while the celebration should display. Date-driven so it auto-clears at
 * CHAMPIONS_DISPLAY_UNTIL without a redeploy (same approach as
 * isWorldCupActive). The /playoffs gate ANDs this with playoffsActive === false.
 */
export function isChampionsCelebrationActive(now: Date = new Date()): boolean {
  return now.getTime() < Date.parse(CHAMPIONS_DISPLAY_UNTIL);
}

const SITE_URL = 'https://www.getpromonight.com';

/**
 * schema.org Event JSON-LD for a champion's parade. Required fields (name,
 * startDate, location) are always present; description/organizer/eventStatus/
 * eventAttendanceMode/image are included for a complete, valid rich result.
 */
export function buildParadeEventSchema(c: Champion): Record<string, unknown> {
  return {
    '@context': 'https://schema.org',
    '@type': 'Event',
    name: c.parade.name,
    startDate: c.parade.startDate,
    eventStatus: 'https://schema.org/EventScheduled',
    eventAttendanceMode: 'https://schema.org/OfflineEventAttendanceMode',
    description: c.parade.description,
    isAccessibleForFree: true,
    location: {
      '@type': 'Place',
      name: c.parade.venueName,
      address: {
        '@type': 'PostalAddress',
        addressLocality: c.parade.addressLocality,
        addressRegion: c.parade.addressRegion,
        addressCountry: 'US',
      },
    },
    organizer: { '@type': 'Organization', name: c.parade.organizer },
    about: { '@type': 'SportsTeam', name: c.teamName },
    image: [`${SITE_URL}/og-image.png`],
    url: `${SITE_URL}/playoffs`,
  };
}
