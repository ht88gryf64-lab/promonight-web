// Typed dual-emit analytics layer (PostHog primary, GA4 secondary).
//
// Every event in the app goes through `track(event, props)`. The function
// auto-attaches page_path, device_class and the first-party source_* triplet
// so call sites only pass event-specific properties.
//
// Legacy helpers (`event`, `pageview`, `trackInstallClick`, `trackAffiliateClick`)
// are preserved so existing dashboards keep getting data — they now also feed
// through `track()` so the canonical events start flowing immediately.

import { flattenUTMsForEvent, getStoredUTMs } from './utm-capture';
import { readAttribution } from './attribution';

// ── Types ────────────────────────────────────────────────────────────────

export const GA_MEASUREMENT_ID = process.env.NEXT_PUBLIC_GA4_MEASUREMENT_ID || '';

export type AnalyticsEvent =
  | 'page_view'
  | 'cta_click'
  | 'browse_all_teams_tap'
  | 'this_week_see_all_tap'
  | 'collection_tile_tap'
  | 'affiliate_click'
  | 'app_download_click'
  | 'promo_card_tap'
  | 'tonight_card_tap'
  | 'this_week_card_tap'
  | 'team_page_engaged'
  | 'team_picker_tab_change'
  | 'team_tile_tap'
  | 'newsletter_signup'
  | 'search_query'
  | 'share_initiated'
  | 'game_day_view'
  | 'game_tap'
  | 'away_game_expanded'
  | 'ad_slot_viewed';

// `TONIGHT_AND_TOMORROW` is retained for backwards-compatibility with dashboards
// that already segment on it; the bucketed hero (Phase 1.5) emits TONIGHT,
// WEEKEND, and COMING_UP only.
export type EyebrowState =
  | 'TONIGHT'
  | 'TONIGHT_AND_TOMORROW'
  | 'WEEKEND'
  | 'COMING_UP';

export type AnalyticsSurface =
  | 'web_home'
  | 'web_team_page'
  | 'web_promo_detail'
  | 'web_playoffs'
  | 'web_league_index'
  | 'web_article'
  | 'web_other';

export type Sport = 'mlb' | 'nba' | 'nhl' | 'nfl' | 'mls' | 'wnba';

export type DeviceClass = 'mobile' | 'tablet' | 'desktop';

export type CommonEventProperties = {
  surface: AnalyticsSurface;
  team_slug?: string;
  sport?: Sport;
  page_path: string;
  device_class: DeviceClass;
  source: string | null;
  source_medium: string | null;
  source_campaign: string | null;
};

// Call-site property shapes. Common-auto fields (page_path, device_class, source_*)
// are injected inside track() so callers never pass them.
export type PageViewProperties = {
  surface: AnalyticsSurface;
  page_title: string;
  team_slug?: string;
  sport?: Sport;
};

export type CtaClickProperties = {
  surface: AnalyticsSurface;
  cta_id: string;
  cta_label: string;
  cta_destination?: string;
  team_slug?: string;
  sport?: Sport;
};

// Hero secondary CTA — "Browse all 167 teams →". Lives near cta_click since
// it's a generic destination CTA, but kept as its own event so dashboards
// don't have to filter cta_click by cta_id.
export type BrowseAllTeamsTapProperties = {
  surface: string; // currently always "hero"; future surfaces may differ
};

export type ThisWeekSeeAllTapProperties = {
  // No metadata beyond the implicit page_path/device_class auto-attached by track().
  // Kept as a typed shape so future fields slot in without a property migration.
  surface: AnalyticsSurface;
};

export type CollectionTileTapProperties = {
  surface: AnalyticsSurface;
  collection_name: 'bobbleheads' | 'jerseys' | 'theme_nights' | 'fireworks';
  collection_count: number;
};

export type AffiliatePartner =
  | 'seatgeek'
  | 'stubhub'
  | 'fanatics'
  | 'spothero'
  | 'booking';

export type AffiliateClickProperties = {
  surface: AnalyticsSurface;
  partner: AffiliatePartner;
  placement: string;
  promo_id?: string | null;
  destination_url: string;
  team_slug?: string;
  sport?: Sport;
  is_hot_promo?: boolean;
  // True when the outbound URL carries the partner's affiliate tracking ID
  // (commissionable click). False when the click routes to a bare partner
  // URL during the pre-approval phase. Lets dashboards quantify how much
  // attributable revenue is being deferred until each partner approves.
  affiliate_tracking_active?: boolean;
};

export type AppDownloadClickProperties = {
  surface: AnalyticsSurface;
  // 'unknown' is for nav links that route to /download without a platform
  // hint; the destination page disambiguates. iOS/Android are direct store
  // links from in-section CTAs.
  store: 'ios' | 'android' | 'unknown';
  placement: string;
  team_slug?: string;
  sport?: Sport;
};

export type PromoCardTapProperties = {
  surface: AnalyticsSurface;
  promo_id: string;
  team_slug: string;
  sport?: Sport;
  promo_type: string;
};

// Hero "Tonight" rail — fires when a tonight/tonight+tomorrow/coming-up card
// is tapped. eyebrow_state lets dashboards segment by which cascade variant
// the user actually saw above the cards.
export type TonightCardTapProperties = {
  surface: AnalyticsSurface;
  team_id: string;
  sport?: Sport;
  promo_id: string;
  promo_type: string;
  is_highlight: boolean;
  eyebrow_state: EyebrowState;
};

// "This Week" rail — same shape as tonight minus eyebrow_state, plus
// days_out so dashboards can see whether near-week or far-week cards
// drive more taps.
export type ThisWeekCardTapProperties = {
  surface: AnalyticsSurface;
  team_id: string;
  sport?: Sport;
  promo_id: string;
  promo_type: string;
  is_highlight: boolean;
  days_out: number;
};

export type TeamPageEngagedProperties = {
  surface: AnalyticsSurface;
  team_slug: string;
  sport?: Sport;
  scroll_depth_pct: number;
};

// Team-discovery family — these two events share a surface concept
// (which team-picker did the user interact with). Surface is "homepage"
// today; "teams_page" is reserved for when /teams gets the same picker.
export type TeamPickerTabChangeProperties = {
  surface: 'homepage' | 'teams_page';
  from_league: string;
  to_league: string;
};

export type TeamTileTapProperties = {
  surface: 'homepage' | 'teams_page';
  team_id: string;
  league: string;
  from_tab: string;
  is_homepage_sample: boolean;
};

export type NewsletterSignupProperties = {
  surface: AnalyticsSurface;
  placement: string;
  list_id?: string;
};

export type SearchQueryProperties = {
  surface: AnalyticsSurface;
  query: string;
  result_count?: number;
};

export type ShareInitiatedProperties = {
  surface: AnalyticsSurface;
  platform: 'twitter' | 'copy_link' | 'native' | 'facebook' | 'email';
  page_type: string;
  team_slug?: string;
  sport?: Sport;
};

export type GameDayViewProperties = {
  surface: AnalyticsSurface;
  team_slug: string;
  venue_name: string;
  sport?: Sport;
};

export type GameTapProperties = {
  surface: AnalyticsSurface;
  team_slug: string;
  sport?: Sport;
  game_id: string;
  is_home: boolean;
  has_promo: boolean;
  opponent_slug: string;
};

export type AwayGameExpandedProperties = {
  surface: AnalyticsSurface;
  team_slug: string;
  sport?: Sport;
  game_id: string;
  opponent_slug: string;
  has_promo: boolean;
};

// Fired the first time an ad slot enters the viewport. device_class is
// auto-attached by track() so the slot only carries its identity and the
// page context it was placed on.
export type AdSlotViewedProperties = {
  slot_id: string;
  page_type: string;
};

export type EventPropertiesMap = {
  page_view: PageViewProperties;
  cta_click: CtaClickProperties;
  browse_all_teams_tap: BrowseAllTeamsTapProperties;
  this_week_see_all_tap: ThisWeekSeeAllTapProperties;
  collection_tile_tap: CollectionTileTapProperties;
  affiliate_click: AffiliateClickProperties;
  app_download_click: AppDownloadClickProperties;
  promo_card_tap: PromoCardTapProperties;
  tonight_card_tap: TonightCardTapProperties;
  this_week_card_tap: ThisWeekCardTapProperties;
  team_page_engaged: TeamPageEngagedProperties;
  team_picker_tab_change: TeamPickerTabChangeProperties;
  team_tile_tap: TeamTileTapProperties;
  newsletter_signup: NewsletterSignupProperties;
  search_query: SearchQueryProperties;
  share_initiated: ShareInitiatedProperties;
  game_day_view: GameDayViewProperties;
  game_tap: GameTapProperties;
  away_game_expanded: AwayGameExpandedProperties;
  ad_slot_viewed: AdSlotViewedProperties;
};

// ── Utilities ────────────────────────────────────────────────────────────

function deviceClass(): DeviceClass {
  if (typeof window === 'undefined') return 'desktop';
  const w = window.innerWidth;
  if (w < 640) return 'mobile';
  if (w < 1024) return 'tablet';
  return 'desktop';
}

function currentPath(): string {
  if (typeof window === 'undefined') return '';
  return window.location.pathname + window.location.search;
}

function analyticsDebugEnabled(): boolean {
  return process.env.NEXT_PUBLIC_ANALYTICS_DEBUG === 'true';
}

// ── Core track() ─────────────────────────────────────────────────────────

export function track<E extends AnalyticsEvent>(
  eventName: E,
  props: EventPropertiesMap[E],
): void {
  if (typeof window === 'undefined') return;

  const attribution = readAttribution();
  const enriched = {
    ...(props as Record<string, unknown>),
    page_path: currentPath(),
    device_class: deviceClass(),
    source: attribution.source,
    source_medium: attribution.source_medium,
    source_campaign: attribution.source_campaign,
  };

  try {
    // PostHog — loaded lazily so SSR and no-key environments stay clean.
    const ph = (window as unknown as { posthog?: { capture?: (n: string, p?: unknown) => void } })
      .posthog;
    if (ph && typeof ph.capture === 'function') {
      ph.capture(eventName, enriched);
    }
  } catch {
    // Never crash the app over analytics.
  }

  try {
    if (typeof window.gtag === 'function') {
      window.gtag('event', eventName, enriched);
    }
  } catch {
    // Same — swallow.
  }

  if (analyticsDebugEnabled()) {
    // eslint-disable-next-line no-console
    console.log('[analytics]', eventName, enriched);
  }
}

// ── Legacy helpers ───────────────────────────────────────────────────────
// These existed before Phase 0. Keeping them working preserves existing GA4
// reports during the transition; each also feeds into track() so the new
// canonical events start flowing from day one.

export const isAnalyticsEnabled = () => {
  return typeof window !== 'undefined' && !!GA_MEASUREMENT_ID;
};

export const pageview = (url: string) => {
  if (!isAnalyticsEnabled()) return;
  window.gtag('config', GA_MEASUREMENT_ID, { page_path: url });
};

export const event = (
  action: string,
  params?: Record<string, string | number | boolean>,
) => {
  if (!isAnalyticsEnabled()) return;
  window.gtag('event', action, params);
};

export type InstallClickPayload = {
  // 'unknown' is for surfaces that route through /download (e.g. the nav)
  // rather than directly to a store; the destination page picks the platform.
  platform: 'ios' | 'android' | 'unknown';
  section: string;
  page: string;
  teamSlug?: string;
};

export const trackInstallClick = (payload: InstallClickPayload) => {
  // Legacy events — keep firing for existing dashboards.
  event('app_store_click', {
    platform: payload.platform,
    section: payload.section,
    page: payload.page,
  });
  const sourcePage =
    typeof window !== 'undefined' ? window.location.pathname : payload.page;
  event('app_install_click', {
    platform: payload.platform,
    source_page: sourcePage,
    ...flattenUTMsForEvent(getStoredUTMs()),
  });

  // New canonical event. Surface is inferred from the current pathname so call
  // sites don't have to plumb it through every tracked link.
  track('app_download_click', {
    surface: inferSurfaceFromPath(sourcePage),
    store: payload.platform,
    placement: payload.section,
    team_slug: payload.teamSlug,
  });
};

// Legacy affiliate click payload — retained so the old callsite shape still
// compiles. New callsites should construct an AffiliateClickProperties object
// and call track('affiliate_click', …) directly.
export type AffiliateSurface = AnalyticsSurface | string;

export type AffiliateClickPayload = {
  partner: AffiliatePartner;
  team_id: string;
  sport: string;
  promo_id: string | null;
  surface: AffiliateSurface;
  is_hot_promo: boolean;
  destination_url?: string;
  placement?: string;
  affiliate_tracking_active?: boolean;
};

export const trackAffiliateClick = (payload: AffiliateClickPayload) => {
  // Legacy event.
  event('outbound_affiliate_click', {
    partner: payload.partner,
    team_id: payload.team_id,
    sport: payload.sport,
    promo_id: payload.promo_id ?? '',
    surface: payload.surface,
    is_hot_promo: payload.is_hot_promo,
  });

  // Canonical event. Coerce legacy surface strings into the typed union; fall
  // back to web_other for unknown values.
  const surface: AnalyticsSurface = isKnownSurface(payload.surface)
    ? payload.surface
    : 'web_other';

  track('affiliate_click', {
    surface,
    partner: payload.partner,
    placement: payload.placement ?? String(payload.surface),
    promo_id: payload.promo_id,
    destination_url: payload.destination_url ?? '',
    team_slug: payload.team_id,
    sport: normalizeSport(payload.sport),
    is_hot_promo: payload.is_hot_promo,
    affiliate_tracking_active: payload.affiliate_tracking_active,
  });
};

// ── Surface + sport inference ────────────────────────────────────────────

const KNOWN_SURFACES: ReadonlySet<AnalyticsSurface> = new Set<AnalyticsSurface>([
  'web_home',
  'web_team_page',
  'web_promo_detail',
  'web_playoffs',
  'web_league_index',
  'web_article',
  'web_other',
]);

function isKnownSurface(s: string): s is AnalyticsSurface {
  return KNOWN_SURFACES.has(s as AnalyticsSurface);
}

export function inferSurfaceFromPath(path: string): AnalyticsSurface {
  if (!path || path === '/') return 'web_home';
  if (path.startsWith('/playoffs')) return 'web_playoffs';
  if (path.startsWith('/promos/')) return 'web_article';
  if (path.startsWith('/teams')) return 'web_league_index';
  // /[sport]/[team] — team pages. Sports are known; anything else falls through.
  const m = path.match(/^\/([a-z]+)(?:\/|$)/);
  if (m && ['mlb', 'nba', 'nhl', 'nfl', 'mls', 'wnba'].includes(m[1])) {
    // If there's a second segment it's the team slug -> team page.
    const rest = path.slice(m[0].length);
    if (rest.length > 0) return 'web_team_page';
    return 'web_league_index';
  }
  return 'web_other';
}

export function normalizeSport(raw: string | undefined): Sport | undefined {
  if (!raw) return undefined;
  const lower = raw.toLowerCase();
  if (
    lower === 'mlb' ||
    lower === 'nba' ||
    lower === 'nhl' ||
    lower === 'nfl' ||
    lower === 'mls' ||
    lower === 'wnba'
  ) {
    return lower;
  }
  return undefined;
}
