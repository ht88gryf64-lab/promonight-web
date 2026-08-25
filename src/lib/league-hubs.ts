// Single source of truth for league hubs. Every league carries its locked
// house-palette accent (the LeagueChip monogram background). `live` gates which
// hubs actually render in menus (MLB, WNBA, MLS, NFL and CFB today; NBA and NHL
// are ready-but-inactive), so shipping a new hub is a one-line change (flip
// `live` to true once the /{sportSlug} route exists). A future homepage league
// section and a /leagues index are meant to read this same registry.
export interface LeagueHub {
  league: string; // display league code, e.g. 'MLB'
  label: string; // short nav / monogram label, e.g. 'MLB'
  // Spelled-out menu text when the short label is not self-explanatory. The
  // monogram chip keeps `label`; the text beside it renders this. Only CFB sets
  // it: a bare "CFB" was the only nav wording for the college hub, and it was
  // the one thing on the homepage a visitor had to already understand.
  navLabel?: string;
  href: string; // hub route, e.g. '/mlb'
  sportSlug: string; // lowercased slug used in team URLs, e.g. 'mlb'
  accent: string; // locked house-palette hex for the LeagueChip background
  live: boolean; // only live hubs render in menus (the list grows as hubs ship)
  // Sitemap changefreq for the hub URL. Absent means 'daily' (promo-cadence
  // hubs turn their this-week rail over each day); CFB is 'weekly'. Lives here
  // because this registry is the single source of truth for hub go-live — the
  // sitemap iterates LEAGUE_HUBS, so flipping `live` is genuinely the whole
  // go-live edit.
  sitemapChangeFrequency?: 'daily' | 'weekly';
}

// Full house-palette registry. Accent colors are the locked set; flip `live` to
// true (one line) when a hub route ships. Order = the intended menu order.
export const LEAGUE_HUB_REGISTRY: LeagueHub[] = [
  { league: 'MLB', label: 'MLB', href: '/mlb', sportSlug: 'mlb', accent: '#7c4a3a', live: true },
  { league: 'WNBA', label: 'WNBA', href: '/wnba', sportSlug: 'wnba', accent: '#c9581f', live: true },
  { league: 'MLS', label: 'MLS', href: '/mls', sportSlug: 'mls', accent: '#3f7d5a', live: true },
  { league: 'NBA', label: 'NBA', href: '/nba', sportSlug: 'nba', accent: '#b5642e', live: false },
  { league: 'NHL', label: 'NHL', href: '/nhl', sportSlug: 'nhl', accent: '#4a4f57', live: false },
  { league: 'NFL', label: 'NFL', href: '/nfl', sportSlug: 'nfl', accent: '#5f6b57', live: true },
  { league: 'CFB', label: 'CFB', navLabel: 'College football', href: '/cfb', sportSlug: 'cfb', accent: '#9a7d2e', live: true, sitemapChangeFrequency: 'weekly' },
];

// The live hubs shown in menus (the BrandBarLeagueHubs desktop dropdown + the
// mobile sheet). Consumers import this; it grows automatically as `live` flips.
export const LEAGUE_HUBS: LeagueHub[] = LEAGUE_HUB_REGISTRY.filter((h) => h.live);

// Direct handle to a single hub by league code — for surfaces that gate their
// OWN CFB entry point on the SAME `live` flag the nav uses (the team-browser
// CFB chip + conference sub-row). Flipping CFB `live` to true lights up the nav
// AND the browser chips from this one registry edit. `getLeagueHub('CFB')?.live`
// is the single source; never hardcode a separate CFB-visible boolean.
export function getLeagueHub(league: string): LeagueHub | undefined {
  return LEAGUE_HUB_REGISTRY.find((h) => h.league === league);
}

// Convenience for the pro browsers: is the CFB hub live? (Same flag as the nav.)
export const CFB_HUB = getLeagueHub('CFB');
export const isCfbHubLive = (): boolean => CFB_HUB?.live === true;

// `label` is the SHORT visible text; hubAriaLabel derives the DESCRIPTIVE
// accessible name ('MLB promotional schedule') so a link stays descriptive for
// crawlers and screen readers while the visible text stays short. A future hub
// only sets its short label; the descriptive aria is derived the same way.
//
// CFB is the one hub that is NOT a promotional schedule: the college corpus
// carries schedules, venues and rivalries and has no promo data at all, so the
// derived name was asserting a promotional schedule that does not exist, on
// every page, in the one text a screen-reader user hears. The branch keeps the
// accessible name true to what the hub actually holds.
export function hubAriaLabel(hub: LeagueHub): string {
  if (hub.league === 'CFB') return 'College football schedules, stadiums and rivalries';
  return `${hub.label} promotional schedule`;
}

// Visible menu text beside the monogram chip: the spelled-out name when a hub
// carries one, else the short label.
export function hubNavLabel(hub: LeagueHub): string {
  return hub.navLabel ?? hub.label;
}

// The up-link from a hub's section on the /venues index. Pro hubs are promo
// hubs; the college hub is not, and "All CFB promos" was a claim about a
// corpus that has none.
export function hubIndexLinkLabel(hub: LeagueHub): string {
  if (hub.league === 'CFB') return 'College football schedules and rivalries';
  return `All ${hub.label} promos`;
}
