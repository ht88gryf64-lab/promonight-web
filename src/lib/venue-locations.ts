// Tactical fallback for scored-league teams without venue docs in the
// Firestore `venues` collection. Used ONLY by the scoring discovery
// pages' JSON-LD builder when getVenueForTeam returns null. Provides
// enough Place metadata (venue name, city, state/province, country) to
// satisfy Google Rich Results validators for Event schema.
//
// Retire this file once the venues collection is complete (see Tier 3
// data-ops pass in the PromoNight Website Improvement Plan). At that
// point getVenueForTeam will resolve for every scored team and this
// fallback becomes unreachable. One-line cleanup PR removes the import
// and the file.
//
// Coverage: 24 of 73 scored teams as of 2026-05. Breakdown:
//   - 8 WNBA arenas (atlanta-dream through seattle-storm).
//   - 16 MLS stadiums (atlanta-united through toronto-fc).
//   - 2 of those 16 are Canadian (cf-montreal, toronto-fc).
// MLB has full venue-doc coverage and isn't represented here.
//
// Venue names sourced from public, well-known team-venue assignments.
// Where a recent rename / sponsorship change applies, the `note` field
// flags it so a future audit can confirm.

export type StaticVenueLocation = {
  venueName: string;
  addressLocality: string;
  // 2-letter US state code or Canadian province code.
  addressRegion: string;
  addressCountry: 'US' | 'CA';
  // Free-form annotation, surfaced for future verification (recent
  // renames, multi-venue teams, expected-move dates).
  note?: string;
};

export const VENUE_LOCATIONS_STATIC: Record<string, StaticVenueLocation> = {
  // ── WNBA ─────────────────────────────────────────────────────────────────
  'atlanta-dream': {
    venueName: 'Gateway Center Arena',
    addressLocality: 'College Park',
    addressRegion: 'GA',
    addressCountry: 'US',
    note: 'Stadium in College Park, GA (suburb of Atlanta).',
  },
  'golden-state-valkyries': {
    venueName: 'Chase Center',
    addressLocality: 'San Francisco',
    addressRegion: 'CA',
    addressCountry: 'US',
    note: 'Shares Chase Center with the Golden State Warriors.',
  },
  'indiana-fever': {
    venueName: 'Gainbridge Fieldhouse',
    addressLocality: 'Indianapolis',
    addressRegion: 'IN',
    addressCountry: 'US',
  },
  'los-angeles-sparks': {
    venueName: 'Crypto.com Arena',
    addressLocality: 'Los Angeles',
    addressRegion: 'CA',
    addressCountry: 'US',
  },
  'minnesota-lynx': {
    venueName: 'Target Center',
    addressLocality: 'Minneapolis',
    addressRegion: 'MN',
    addressCountry: 'US',
  },
  'new-york-liberty': {
    venueName: 'Barclays Center',
    addressLocality: 'Brooklyn',
    addressRegion: 'NY',
    addressCountry: 'US',
  },
  'phoenix-mercury': {
    venueName: 'Footprint Center',
    addressLocality: 'Phoenix',
    addressRegion: 'AZ',
    addressCountry: 'US',
    note: 'Renamed from Talking Stick Resort Arena in 2022. Verify if a more recent rename applies.',
  },
  'seattle-storm': {
    venueName: 'Climate Pledge Arena',
    addressLocality: 'Seattle',
    addressRegion: 'WA',
    addressCountry: 'US',
  },

  // ── MLS ──────────────────────────────────────────────────────────────────
  'atlanta-united': {
    venueName: 'Mercedes-Benz Stadium',
    addressLocality: 'Atlanta',
    addressRegion: 'GA',
    addressCountry: 'US',
  },
  'austin-fc': {
    venueName: 'Q2 Stadium',
    addressLocality: 'Austin',
    addressRegion: 'TX',
    addressCountry: 'US',
  },
  'cf-montreal': {
    venueName: 'Stade Saputo',
    addressLocality: 'Montreal',
    addressRegion: 'QC',
    addressCountry: 'CA',
  },
  'charlotte-fc': {
    venueName: 'Bank of America Stadium',
    addressLocality: 'Charlotte',
    addressRegion: 'NC',
    addressCountry: 'US',
    note: 'Shared with Carolina Panthers (NFL).',
  },
  'fc-cincinnati': {
    venueName: 'TQL Stadium',
    addressLocality: 'Cincinnati',
    addressRegion: 'OH',
    addressCountry: 'US',
  },
  'fc-dallas': {
    venueName: 'Toyota Stadium',
    addressLocality: 'Frisco',
    addressRegion: 'TX',
    addressCountry: 'US',
    note: 'Stadium in Frisco, TX (suburb of Dallas). Also in VENUE_CITY_OVERRIDES for affiliate URL building; entry duplicated here so the schema builder does not consult that table.',
  },
  'inter-miami': {
    venueName: 'Chase Stadium',
    addressLocality: 'Fort Lauderdale',
    addressRegion: 'FL',
    addressCountry: 'US',
    note: 'Renamed from DRV PNK Stadium in 2024. Long-term plan is Miami Freedom Park; using current home.',
  },
  'la-galaxy': {
    venueName: 'Dignity Health Sports Park',
    addressLocality: 'Carson',
    addressRegion: 'CA',
    addressCountry: 'US',
    note: 'Stadium in Carson, CA (LA County). Also in VENUE_CITY_OVERRIDES; entry duplicated here for the same reason as fc-dallas.',
  },
  'lafc': {
    venueName: 'BMO Stadium',
    addressLocality: 'Los Angeles',
    addressRegion: 'CA',
    addressCountry: 'US',
    note: 'Renamed from Banc of California Stadium in 2023.',
  },
  'nashville-sc': {
    venueName: 'GEODIS Park',
    addressLocality: 'Nashville',
    addressRegion: 'TN',
    addressCountry: 'US',
  },
  'new-york-city-fc': {
    venueName: 'Yankee Stadium',
    addressLocality: 'Bronx',
    addressRegion: 'NY',
    addressCountry: 'US',
    note: 'Shares Yankee Stadium for most home games; some games also at Citi Field. Etihad Park (Queens) targeted for 2027.',
  },
  'real-salt-lake': {
    venueName: 'America First Field',
    addressLocality: 'Sandy',
    addressRegion: 'UT',
    addressCountry: 'US',
    note: 'Renamed from Rio Tinto Stadium in 2022.',
  },
  'san-diego-fc': {
    venueName: 'Snapdragon Stadium',
    addressLocality: 'San Diego',
    addressRegion: 'CA',
    addressCountry: 'US',
  },
  'sporting-kansas-city': {
    venueName: "Children's Mercy Park",
    addressLocality: 'Kansas City',
    addressRegion: 'KS',
    addressCountry: 'US',
    note: 'Stadium is in Kansas City, KS (not Missouri).',
  },
  'st-louis-city-sc': {
    venueName: 'Energizer Park',
    addressLocality: 'St. Louis',
    addressRegion: 'MO',
    addressCountry: 'US',
    note: 'Renamed from CITYPARK in 2024.',
  },
  'toronto-fc': {
    venueName: 'BMO Field',
    addressLocality: 'Toronto',
    addressRegion: 'ON',
    addressCountry: 'CA',
  },
};
