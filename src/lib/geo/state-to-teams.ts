// US state code -> ordered list of in-state team slugs.
//
// Slugs match Firestore team doc ids exactly (verified against the live
// production sitemap on 2026-04-26). The ordering within each state is the
// order teams will be rendered first in the geo-aware homepage grid; the
// remaining teams keep their existing rank-by-future-promos order.
//
// State assignment is by stadium location, not brand city. Examples:
//   - Cowboys -> TX (AT&T Stadium is in Arlington, TX)
//   - Patriots -> MA (Gillette Stadium is in Foxborough, MA)
//   - Giants/Jets/Devils/Red Bulls -> NJ (MetLife / Prudential / Red Bull Arena)
//   - Commanders -> MD (FedExField is in Landover, MD; moving to DC future)
//   - Sporting KC -> KS (Children's Mercy Park is in Kansas City, KS)
//
// NY-brand NFL teams (Giants, Jets) and NY-brand MLS team (Red Bulls) are
// cross-listed in NY because their fanbase spans the metro area; a NY-IP
// visitor expects them surfaced.
//
// Ordering within a state follows the user's MN example: the most active /
// most-loved sports first (MLB and NHL in spring, NBA in winter, etc.).
// In practice we use MLB > NHL > NBA > WNBA > NFL > MLS for states with
// multiple leagues represented, with alphabetical-within-league for ties.

export const STATE_TO_TEAMS: Record<string, readonly string[]> = {
  AZ: [
    'arizona-diamondbacks',
    'phoenix-suns',
    'phoenix-mercury',
    'arizona-cardinals',
  ],
  CA: [
    'los-angeles-dodgers',
    'san-francisco-giants',
    'san-diego-padres',
    'los-angeles-angels',
    'oakland-athletics',
    'los-angeles-kings',
    'anaheim-ducks',
    'san-jose-sharks',
    'golden-state-warriors',
    'los-angeles-lakers',
    'los-angeles-clippers',
    'sacramento-kings',
    'los-angeles-sparks',
    'golden-state-valkyries',
    'san-francisco-49ers',
    'los-angeles-rams',
    'los-angeles-chargers',
    'la-galaxy',
    'lafc',
    'san-diego-fc',
    'san-jose-earthquakes',
  ],
  CO: [
    'colorado-rockies',
    'colorado-avalanche',
    'denver-nuggets',
    'denver-broncos',
    'colorado-rapids',
  ],
  CT: ['connecticut-sun'],
  DC: [
    'washington-nationals',
    'washington-capitals',
    'washington-wizards',
    'washington-mystics',
    'dc-united',
  ],
  FL: [
    'miami-marlins',
    'tampa-bay-rays',
    'tampa-bay-lightning',
    'florida-panthers',
    'miami-heat',
    'orlando-magic',
    'jacksonville-jaguars',
    'miami-dolphins',
    'tampa-bay-buccaneers',
    'inter-miami',
    'orlando-city',
  ],
  GA: [
    'atlanta-braves',
    'atlanta-hawks',
    'atlanta-dream',
    'atlanta-falcons',
    'atlanta-united',
  ],
  IL: [
    'chicago-cubs',
    'chicago-white-sox',
    'chicago-blackhawks',
    'chicago-bulls',
    'chicago-sky',
    'chicago-bears',
    'chicago-fire',
  ],
  IN: ['indiana-pacers', 'indiana-fever', 'indianapolis-colts'],
  KS: ['sporting-kansas-city'],
  LA: ['new-orleans-pelicans', 'new-orleans-saints'],
  MA: ['boston-red-sox', 'boston-bruins', 'boston-celtics', 'new-england-patriots', 'new-england-revolution'],
  MD: ['baltimore-orioles', 'baltimore-ravens', 'washington-commanders'],
  MI: ['detroit-tigers', 'detroit-red-wings', 'detroit-pistons', 'detroit-lions'],
  MN: [
    'minnesota-twins',
    'minnesota-wild',
    'minnesota-timberwolves',
    'minnesota-lynx',
    'minnesota-vikings',
    'minnesota-united',
  ],
  MO: [
    'st-louis-cardinals',
    'kansas-city-royals',
    'st-louis-blues',
    'kansas-city-chiefs',
    'st-louis-city-sc',
  ],
  NC: ['carolina-hurricanes', 'charlotte-hornets', 'carolina-panthers', 'charlotte-fc'],
  NJ: ['new-jersey-devils', 'new-york-giants', 'new-york-jets', 'new-york-red-bulls'],
  NV: ['vegas-golden-knights', 'las-vegas-aces', 'las-vegas-raiders'],
  NY: [
    'new-york-yankees',
    'new-york-mets',
    'new-york-rangers',
    'new-york-islanders',
    'buffalo-sabres',
    'new-york-knicks',
    'brooklyn-nets',
    'new-york-liberty',
    'buffalo-bills',
    'new-york-giants',
    'new-york-jets',
    'new-york-city-fc',
    'new-york-red-bulls',
  ],
  OH: [
    'cincinnati-reds',
    'cleveland-guardians',
    'columbus-blue-jackets',
    'cleveland-cavaliers',
    'cincinnati-bengals',
    'cleveland-browns',
    'columbus-crew',
    'fc-cincinnati',
  ],
  OK: ['oklahoma-city-thunder'],
  OR: ['portland-trail-blazers', 'portland-timbers'],
  PA: [
    'philadelphia-phillies',
    'pittsburgh-pirates',
    'philadelphia-flyers',
    'pittsburgh-penguins',
    'philadelphia-76ers',
    'philadelphia-eagles',
    'pittsburgh-steelers',
    'philadelphia-union',
  ],
  TN: ['nashville-predators', 'memphis-grizzlies', 'tennessee-titans', 'nashville-sc'],
  TX: [
    'houston-astros',
    'texas-rangers',
    'dallas-stars',
    'dallas-mavericks',
    'houston-rockets',
    'san-antonio-spurs',
    'dallas-wings',
    'dallas-cowboys',
    'houston-texans',
    'austin-fc',
    'fc-dallas',
    'houston-dynamo',
  ],
  UT: ['utah-hockey-club', 'utah-jazz', 'real-salt-lake'],
  WA: ['seattle-mariners', 'seattle-kraken', 'seattle-storm', 'seattle-seahawks', 'seattle-sounders'],
  WI: ['milwaukee-brewers', 'milwaukee-bucks', 'green-bay-packers'],
};

// Returns the in-state team slugs for a given Vercel-region code, or an empty
// array when the region is unknown / non-US. Region codes are the values from
// the `x-vercel-ip-country-region` header (e.g. "MN", "CA", "TX").
export function getInStateTeamSlugs(region: string | null | undefined): readonly string[] {
  if (!region) return [];
  return STATE_TO_TEAMS[region.toUpperCase()] ?? [];
}
