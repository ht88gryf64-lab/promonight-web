// Single source of truth for LIVE league hubs. The BrandBar "League hubs" menu
// reads this, and a future homepage league section and /leagues index are meant
// to read the same array. Add an entry only when the hub route actually ships:
// there are deliberately no "coming soon" or disabled placeholders here, so the
// menu shows only what is live and grows when a hub ships.
export interface LeagueHub {
  league: string; // display league code, e.g. 'MLB'
  label: string; // short nav label, e.g. 'MLB'
  href: string; // hub route, e.g. '/mlb'
  sportSlug: string; // lowercased slug used in team URLs, e.g. 'mlb'
}

export const LEAGUE_HUBS: LeagueHub[] = [
  { league: 'MLB', label: 'MLB', href: '/mlb', sportSlug: 'mlb' },
];
