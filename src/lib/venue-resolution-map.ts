// Explicit team-slug -> venue-slug fallback for getVenueForTeam.
//
// The primary resolver in data.ts is `where('team','==','{city} {name}')`,
// which works for 67 of the 105 in-season (NBA/NHL/WNBA/MLS) teams. The other
// 38 don't resolve because:
//
//   - Co-tenant arenas (one physical building = one venue doc, owned by one
//     tenant). The co-tenants — most NBA playoff teams sharing an NHL building,
//     all 8 WNBA teams sharing an NBA/NHL arena, and 2 MLS clubs ground-sharing
//     an NFL/MLB stadium — have no doc of their own, so the team-name query
//     returns null. We deliberately keep ONE building doc rather than
//     duplicating building-level facts per team (single source of truth).
//
//   - Malformed `{city} {name}` display strings, mostly MLS — e.g.
//     "Austin Austin FC", "Salt Lake Real", "Toronto Toronto FC" — plus the
//     Clippers ("LA Clippers" vs "Los Angeles Clippers") and the renamed
//     Utah Mammoth. Their docs exist; the constructed name just doesn't match.
//
// This explicit map is the source of truth, chosen over (a) repairing the
// fragile name construction — the MLS breakage is wrong words, not whitespace,
// so normalization would be a pile of special cases — and (b) the dormant
// `sharedTeams` arrays on venue docs, which are already drifting (crypto's
// still listed the Clippers after they left for Intuit Dome in 2024).
//
// Keys are team-doc ids (route segments); values are venues/{id} doc ids.

export const VENUE_RESOLUTION_MAP: Record<string, string> = {
  // ── Category A: own existing doc, blocked only by a name/field mismatch ──
  'los-angeles-clippers': 'intuit-dome',        // doc team "LA Clippers"
  'utah-hockey-club': 'delta-center',           // renamed "Utah Mammoth"
  'austin-fc': 'q2-stadium',
  'cf-montreal': 'saputo-stadium',
  'charlotte-fc': 'bank-of-america-stadium',    // the MLS doc, not -panthers
  'fc-cincinnati': 'tql-stadium',
  'fc-dallas': 'toyota-stadium',
  'inter-miami': 'chase-stadium',
  'la-galaxy': 'dignity-health-sports-park',
  'lafc': 'bmo-stadium',
  'nashville-sc': 'geodis-park',
  'real-salt-lake': 'americas-first-field',
  'san-diego-fc': 'snapdragon-stadium',
  'sporting-kansas-city': 'childrens-mercy-park',
  'st-louis-city-sc': 'energizer-park',
  'toronto-fc': 'bmo-field',

  // ── Category B: co-tenant -> building owner's doc (no own doc) ──
  // NBA sharing an NHL (or NFL/MLB) building:
  'boston-celtics': 'td-garden',
  'chicago-bulls': 'united-center',
  'denver-nuggets': 'ball-arena',
  'dallas-mavericks': 'american-airlines-center',
  'detroit-pistons': 'little-caesars-arena',
  'los-angeles-lakers': 'crypto-com-arena',
  'new-york-knicks': 'madison-square-garden',
  'philadelphia-76ers': 'wells-fargo-center',
  'toronto-raptors': 'scotiabank-arena',
  'washington-wizards': 'capital-one-arena',
  'utah-jazz': 'delta-center',
  // WNBA sharing an NBA/NHL building:
  'atlanta-dream': 'state-farm-arena',
  'new-york-liberty': 'barclays-center',
  'golden-state-valkyries': 'chase-center',
  'indiana-fever': 'gainbridge-fieldhouse',
  'minnesota-lynx': 'target-center',
  'phoenix-mercury': 'footprint-center',
  'los-angeles-sparks': 'crypto-com-arena',
  'seattle-storm': 'climate-pledge-arena',
  // MLS ground-sharing an NFL/MLB stadium:
  'atlanta-united': 'mercedes-benz-stadium',    // NFL Falcons doc
  'new-york-city-fc': 'yankee-stadium',         // MLB Yankees doc

  // ── Category C: doc created in this pass (see populate-arena-venue-fixes.ts) ──
  'cleveland-cavaliers': 'rocket-arena',
};
