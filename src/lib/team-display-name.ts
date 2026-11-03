// The name a reader sees for a club. PURE, and dependency-free so client
// components can import it without pulling promo-helpers into their bundle.
//
// The teams collection stores `city` and `name` separately, and a plain
// `${city} ${name}` is wrong for two kinds of club:
//   1. the name already carries the city ("FC Cincinnati", "Toronto FC",
//      "CF Montréal"): the name alone is the brand. The city match ignores
//      case and accents, so "Montreal" matches "Montréal".
//   2. the stored name is a fragment whose brand puts the city in the middle
//      or drops it: those are listed below by their exact stored pair.
// Measured 2026-11-03 against every MLS team record: before this, live pages
// read "Salt Lake Real", "Miami Inter CF", "Kansas City Sporting", "Los Angeles
// LAFC", "Montreal CF Montréal", "Austin Austin FC" and "San Diego San Diego FC".
const BRAND_BY_STORED_PAIR: Readonly<Record<string, string>> = {
  'Salt Lake|Real': 'Real Salt Lake',
  'Miami|Inter CF': 'Inter Miami CF',
  'Kansas City|Sporting': 'Sporting Kansas City',
  'Los Angeles|LAFC': 'LAFC',
  'Los Angeles|Galaxy': 'LA Galaxy',
};

const fold = (s: string): string => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();

export function teamDisplayName(team: { city?: string | null; name?: string | null }): string {
  const city = team.city?.trim() ?? '';
  const name = team.name?.trim() ?? '';
  if (!city) return name;
  if (!name) return city;
  const brand = BRAND_BY_STORED_PAIR[`${city}|${name}`];
  if (brand) return brand;
  const escaped = fold(city).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  if (new RegExp(`(^|[^a-z0-9])${escaped}($|[^a-z0-9])`).test(fold(name))) return name;
  return `${city} ${name}`;
}

// The big line of a card that stacks the city (small) over the club (big).
// The nickname alone when city + nickname is the club's name ("Kansas City" /
// "Royals"); otherwise the full brand, so the pair never spells a false name
// ("Salt Lake" / "Real Salt Lake", "Austin" / "Austin FC", not "Real", not
// "Austin FC" read as "Austin Austin FC").
export function teamMainLine(team: { city?: string | null; name?: string | null }): string {
  const city = team.city?.trim() ?? '';
  const name = team.name?.trim() ?? '';
  if (!city) return name;
  const display = teamDisplayName(team);
  return display === `${city} ${name}` ? name : display;
}

// The short name an MLS club goes by in a sentence: "Minnesota United leads
// the series 1-0", "LAFC beat Vancouver Whitecaps 2-1". The stored nickname
// cannot do this for MLS: it is a fragment ("United", "Real", "Sporting",
// "City SC", "Inter CF") and three clubs store "United" or "United FC". Each
// entry is the club's common short brand, keyed by team id (read from the 30
// MLS team records on 2026-11-03), with whether the brand reads as a plural
// noun ("Seattle Sounders lead"; "Inter Miami leads"). No entry takes "the".
// Reviewed by hand; the test checks all 30 records against it.
export const MLS_SHORT_NAMES: Readonly<Record<string, { name: string; plural: boolean }>> = {
  'atlanta-united': { name: 'Atlanta United', plural: false },
  'austin-fc': { name: 'Austin FC', plural: false },
  'cf-montreal': { name: 'CF Montréal', plural: false },
  'charlotte-fc': { name: 'Charlotte FC', plural: false },
  'chicago-fire': { name: 'Chicago Fire', plural: false },
  'colorado-rapids': { name: 'Colorado Rapids', plural: true },
  'columbus-crew': { name: 'Columbus Crew', plural: false },
  'dc-united': { name: 'D.C. United', plural: false },
  'fc-cincinnati': { name: 'FC Cincinnati', plural: false },
  'fc-dallas': { name: 'FC Dallas', plural: false },
  'houston-dynamo': { name: 'Houston Dynamo', plural: false },
  'inter-miami': { name: 'Inter Miami', plural: false },
  'la-galaxy': { name: 'LA Galaxy', plural: false },
  lafc: { name: 'LAFC', plural: false },
  'minnesota-united': { name: 'Minnesota United', plural: false },
  'nashville-sc': { name: 'Nashville SC', plural: false },
  'new-england-revolution': { name: 'New England Revolution', plural: false },
  'new-york-city-fc': { name: 'New York City FC', plural: false },
  'new-york-red-bulls': { name: 'New York Red Bulls', plural: true },
  'orlando-city': { name: 'Orlando City', plural: false },
  'philadelphia-union': { name: 'Philadelphia Union', plural: false },
  'portland-timbers': { name: 'Portland Timbers', plural: true },
  'real-salt-lake': { name: 'Real Salt Lake', plural: false },
  'san-diego-fc': { name: 'San Diego FC', plural: false },
  'san-jose-earthquakes': { name: 'San Jose Earthquakes', plural: true },
  'seattle-sounders': { name: 'Seattle Sounders', plural: true },
  'sporting-kansas-city': { name: 'Sporting Kansas City', plural: false },
  'st-louis-city-sc': { name: 'St. Louis City SC', plural: false },
  'toronto-fc': { name: 'Toronto FC', plural: false },
  'vancouver-whitecaps': { name: 'Vancouver Whitecaps', plural: true },
};

/** The name a club goes by in short prose and on a bracket card: the MLS
 *  short brand for an MLS club, the stored nickname for every other club
 *  ("Brewers", "Liberty"), exactly as before. */
export function teamShortName(team: { id: string; name?: string | null }): string {
  return MLS_SHORT_NAMES[team.id]?.name ?? team.name?.trim() ?? '';
}
