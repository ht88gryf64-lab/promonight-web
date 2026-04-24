export type PromoType = 'giveaway' | 'theme' | 'kids' | 'food';

export interface Team {
  id: string;
  city: string;
  name: string;
  abbreviation: string;
  primaryColor: string;
  secondaryColor: string;
  league: string;
  sportSlug: string;
  division: string;
}

export interface Promo {
  date: string;
  time: string;
  opponent: string;
  type: PromoType;
  title: string;
  description: string;
  highlight: boolean;
  icon: string;
  recurring: boolean;
}

export interface PromoWithTeam extends Promo {
  team: Team;
}

export interface Venue {
  name: string;
  address: string;
  team: string;
  sport: string;
  sportIcon: string;
  primaryColor: string;
  accentColor: string;
  lat: number;
  lng: number;
  hasAmenityData: boolean;
  amenityCount: number;
  gatesOpen?: string;
  league: string;
  teamId: string;
  // Optional venue-plan fields. Populated per-venue via data-ops; left empty
  // for most teams. Render only when present.
  parkingInfo?: string;
  publicTransit?: string;
  bagPolicyUrl?: string;
  accessibility?: string;
  nearby?: string;
}

export type GameStatus = 'scheduled' | 'postponed' | 'canceled' | 'completed';

export interface Game {
  id: string;
  league: string; // 'mlb'
  date: string; // YYYY-MM-DD (home-venue local date)
  gameTime: string; // HH:MM local, optional
  gameTimeTz: string; // IANA tz, optional
  homeTeamSlug: string;
  awayTeamSlug: string;
  venueName: string;
  status: GameStatus;
  mlbGameId: number;
  // Optional: doubleheader index (1 or 2 when two games on the same date).
  doubleheaderGame?: number;
  // True when the game is part of the postseason bracket.
  isPostseason?: boolean;
}

export const PROMO_TYPE_COLORS: Record<PromoType, string> = {
  giveaway: '#34d399',
  theme: '#a78bfa',
  kids: '#60a5fa',
  food: '#fb923c',
};

export const PROMO_TYPE_LABELS: Record<PromoType, string> = {
  giveaway: 'Giveaway',
  theme: 'Theme Night',
  kids: 'Kids',
  food: 'Food Deal',
};

export const LEAGUE_ORDER = ['MLB', 'NBA', 'NFL', 'NHL', 'MLS', 'WNBA'] as const;

export const SPORT_ICONS: Record<string, string> = {
  MLB: '⚾',
  NBA: '🏀',
  NFL: '🏈',
  NHL: '🏒',
  MLS: '⚽',
  WNBA: '🏀',
};

// ── Playoff types ──────────────────────────────────────────────────────────
// Field names match the Firestore `playoffPromos` collection exactly.
// Timestamp fields are converted to ISO strings at the data-layer boundary.
export type PlayoffPromoType = PromoType | 'event';

export interface PlayoffPromo {
  teamId: string;
  league: 'NBA' | 'NHL';
  round: string;
  title: string;
  description: string;
  date: string | null;
  gameInfo: string;
  type: PlayoffPromoType;
  recurring: boolean;
  recurringDetail: string;
  highlight: boolean;
  isPlayoff: boolean;
  teamName: string;
  teamAbbr: string;
  source: string;
  createdAt: string;
  updatedAt: string;
}

export interface PlayoffPromoWithTeam extends PlayoffPromo {
  team: Team;
  venue: Venue | null;
}

export interface PlayoffConfig {
  playoffsActive: boolean;
  nbaActive: boolean;
  nhlActive: boolean;
  nbaRound: string;
  nhlRound: string;
  activeTeamIds: string[];
  eliminatedTeamIds: string[];
  lastScanDate: string | null;
  updatedAt: string | null;
}

export interface ActivePlayoffTeam extends Team {
  round: string;
}
