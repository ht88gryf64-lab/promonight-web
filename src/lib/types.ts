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
  // Ticketmaster team-page slug. Defaults to `id` when undefined — set this
  // only when the canonical Ticketmaster URL slug differs from PromoNight's
  // internal slug. Populated for all 167 teams by
  // scripts/populate-ticketmaster-fields.ts from the merged mapping JSON.
  ticketmasterSlug?: string;
  // Ticketmaster URL artist id — the numeric segment after `/artist/` in
  // canonical team URLs (e.g. "805972" for Minnesota Twins, "2451856" for
  // LAFC). NOTE: this is NOT the Discovery API's attraction id (those are
  // K-prefixed strings like "K8vZ917p0D0") — they're different ID spaces
  // within Ticketmaster's stack that happen to share a name. The builder
  // uses this value to emit `/{slug}-tickets/artist/{id}` URLs which
  // resolve directly without redirect.
  ticketmasterAttractionId?: string;
  // Canonical Fanatics team-store path. Shape:
  // `/{league}/{slug}/o-N+t-N+z-N-N` (3 +-joined segments after the team
  // slug, no `+d-`/`+f-` modifiers, no query string). Naive URLs like
  // `fanatics.com/{league}/{slug}` 404 — only the canonical form
  // resolves. Populated for all 167 teams by
  // scripts/populate-fanatics-paths.ts from
  // scripts/fanatics-team-mapping.json. The CTA component (FanaticsCTA)
  // gates render on this field's presence; teams without a populated
  // path are omitted from the cluster rather than linking to a 404.
  fanaticsPath?: string;
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
