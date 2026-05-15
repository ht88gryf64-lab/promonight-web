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
  // Fully-qualified canonical Fanatics team-store URL —
  // `https://www.fanatics.com/{league}/{slug}/o-N+t-N+z-N-N`. This is the
  // field FanaticsCTA renders. Stored as a full URL (not a path) on purpose:
  // the value travels on every Team object into the RSC Flight payload, and a
  // bare path there gets resolved same-origin by crawlers/preloaders → 404 on
  // getpromonight.com. An https:// URL can't be mistaken for an internal
  // link. Populated by scripts/migrate-fanatics-path-to-url.ts from the
  // legacy fanaticsPath. The CTA component (FanaticsCTA) gates render on this
  // field's presence; teams without it are omitted from the cluster rather
  // than linking to a 404.
  fanaticsUrl?: string;
  // Legacy root-relative Fanatics path — `/{league}/{slug}/o-N+t-N+z-N-N`.
  // Superseded by fanaticsUrl; kept as a read-path fallback for one deploy
  // cycle. TODO(fanatics-url-cleanup): remove this field, the mapTeamDoc
  // mapping, and the buildFanaticsUrl fallback after the deploy bakes and a
  // follow-up migration deletes it from the team docs.
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
  // Optional scoring + ingest-extended fields. Populated by the
  // promo-pipeline scoring layer (PR #19) on MLB / MLS / WNBA promos.
  // Absent on NBA / NHL promos (not in scoring scope) and on any promo
  // ingested before the scoring layer ran.
  score?: number;
  scoreBreakdown?: ScoreBreakdown;
  derivedSignals?: DerivedSignals;
  scoredAt?: string;
  attendanceCap?: number | null;
  presentedBy?: string | null;
  whileSuppliesLast?: boolean;
}

export interface PromoWithTeam extends Promo {
  team: Team;
}

// Five-component score breakdown the scoring pipeline writes alongside the
// total `score`. Component values sum to the total. Names match the
// pipeline's weight table exactly.
export interface ScoreBreakdown {
  baseType: number;
  itemType: number;
  highlight: number;
  limitedQuantity: number;
  sponsor: number;
}

// Per-promo derived signals the pipeline extracts (structured first, regex
// fallback). `limitedQuantity` is a boolean, NOT an object as an earlier
// brief draft assumed; the source ('structured' | 'regex' | 'none') lives
// on `signalSources` as a sibling. `sponsor` and `itemType` carry the
// extracted string values directly.
export interface DerivedSignals {
  itemType: string | null;
  limitedQuantity: boolean;
  quantityCap: number | null;
  sponsor: string | null;
  isGenericTitle: boolean;
  signalSources: {
    limitedQuantity: string;
    sponsor: string;
  };
}

// Promo with the scoring fields required (not optional). Use this for
// scoring-page consumers that have already filtered to scored promos.
export interface ScoredPromoWithTeam extends PromoWithTeam {
  promoId: string;
  score: number;
  scoreBreakdown: ScoreBreakdown;
  derivedSignals: DerivedSignals;
  scoredAt: string;
}

// teamScores/{teamId} document shape after the canonical-team join.
// `teamName` is intentionally NOT read from the Firestore doc because the
// scoring pipeline writes inconsistent values (slug on May 12 rescores,
// display name on May 11 backfill). We always look up the canonical
// display name via the joined `team` object instead.
export interface TeamScore {
  teamId: string;
  league: string;
  teamScore: number;
  promoCount: number;
  averagePromoScore: number;
  highlightCount: number;
  varietyCount: number;
  bonuses: { variety: number; hot: number };
  computedAt: string;
}

export interface TeamScoreWithTeam extends TeamScore {
  team: Team;
}

// Leagues currently in scope for the scoring layer. NBA and NHL are
// intentionally excluded; their promos exist in Firestore without
// score / scoreBreakdown / derivedSignals fields and don't appear in the
// teamScores collection. Filtering at this set keeps the scoring-pages
// code league-agnostic everywhere else.
export const SCORED_LEAGUES = new Set(['MLB', 'MLS', 'WNBA'] as const);
export type ScoredLeague = 'MLB' | 'MLS' | 'WNBA';

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
  // Short team ids (`{nickname}-{league}`, e.g. `lac-nfl`, `clt-mls`) of
  // other teams that play home games at this physical venue. One-way
  // pointer today: only the team that owns the suffixed venue doc
  // populates this; the canonical / unsuffixed doc does not list its
  // co-tenants. May span leagues (NFL venue docs reference MLS co-tenants
  // for stadiums like SoFi / MetLife / Soldier Field / Gillette).
  // Not load-bearing for travel CTAs, which look up by team display name.
  sharedTeams?: string[];
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
