// Single source of truth for league hubs. Every league carries its locked
// house-palette accent (the LeagueChip monogram background). `live` gates which
// hubs actually render in menus: MLB is live today, the rest are ready-but-
// inactive, so shipping a new hub is a one-line change (flip `live` to true once
// the /{sportSlug} route exists). A future homepage league section and a
// /leagues index are meant to read this same registry.
export interface LeagueHub {
  league: string; // display league code, e.g. 'MLB'
  label: string; // short nav / monogram label, e.g. 'MLB'
  href: string; // hub route, e.g. '/mlb'
  sportSlug: string; // lowercased slug used in team URLs, e.g. 'mlb'
  accent: string; // locked house-palette hex for the LeagueChip background
  live: boolean; // only live hubs render in menus (the list grows as hubs ship)
}

// Full house-palette registry. Accent colors are the locked set; flip `live` to
// true (one line) when a hub route ships. Order = the intended menu order.
export const LEAGUE_HUB_REGISTRY: LeagueHub[] = [
  { league: 'MLB', label: 'MLB', href: '/mlb', sportSlug: 'mlb', accent: '#7c4a3a', live: true },
  { league: 'WNBA', label: 'WNBA', href: '/wnba', sportSlug: 'wnba', accent: '#c9581f', live: false },
  { league: 'MLS', label: 'MLS', href: '/mls', sportSlug: 'mls', accent: '#3f7d5a', live: false },
  { league: 'NBA', label: 'NBA', href: '/nba', sportSlug: 'nba', accent: '#b5642e', live: false },
  { league: 'NHL', label: 'NHL', href: '/nhl', sportSlug: 'nhl', accent: '#4a4f57', live: false },
  { league: 'NFL', label: 'NFL', href: '/nfl', sportSlug: 'nfl', accent: '#5f6b57', live: false },
  { league: 'CFB', label: 'CFB', href: '/cfb', sportSlug: 'cfb', accent: '#9a7d2e', live: false },
];

// The live hubs shown in menus (the BrandBarLeagueHubs desktop dropdown + the
// mobile sheet). Consumers import this; it grows automatically as `live` flips.
export const LEAGUE_HUBS: LeagueHub[] = LEAGUE_HUB_REGISTRY.filter((h) => h.live);

// `label` is the SHORT visible text; hubAriaLabel derives the DESCRIPTIVE
// accessible name ('MLB promotional schedule') so a link stays descriptive for
// crawlers and screen readers while the visible text stays short. A future hub
// only sets its short label; the descriptive aria is derived the same way.
export function hubAriaLabel(hub: LeagueHub): string {
  return `${hub.label} promotional schedule`;
}
