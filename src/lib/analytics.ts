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
  | 'affiliate_click'
  | 'app_download_click'
  | 'promo_card_tap'
  | 'team_page_engaged'
  | 'newsletter_signup'
  | 'search_query'
  | 'share_initiated'
  | 'game_day_view'
  | 'game_tap'
  | 'away_game_expanded';

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
};

export type AppDownloadClickProperties = {
  surface: AnalyticsSurface;
  store: 'ios' | 'android';
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

export type TeamPageEngagedProperties = {
  surface: AnalyticsSurface;
  team_slug: string;
  sport?: Sport;
  scroll_depth_pct: number;
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

export type EventPropertiesMap = {
  page_view: PageViewProperties;
  cta_click: CtaClickProperties;
  affiliate_click: AffiliateClickProperties;
  app_download_click: AppDownloadClickProperties;
  promo_card_tap: PromoCardTapProperties;
  team_page_engaged: TeamPageEngagedProperties;
  newsletter_signup: NewsletterSignupProperties;
  search_query: SearchQueryProperties;
  share_initiated: ShareInitiatedProperties;
  game_day_view: GameDayViewProperties;
  game_tap: GameTapProperties;
  away_game_expanded: AwayGameExpandedProperties;
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
  platform: 'ios' | 'android';
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
