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
