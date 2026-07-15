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
import type { CaptureSurface } from './follow-surface';

// ── Types ────────────────────────────────────────────────────────────────

export const GA_MEASUREMENT_ID = process.env.NEXT_PUBLIC_GA4_MEASUREMENT_ID || '';

export type AnalyticsEvent =
  | 'page_view'
  | 'cta_click'
  | 'browse_all_teams_tap'
  | 'this_week_see_all_tap'
  | 'collection_tile_tap'
  | 'affiliate_click'
  | 'venue_hub_click'
  | 'app_download_click'
  | 'promo_card_tap'
  | 'tonight_card_tap'
  | 'this_week_card_tap'
  | 'team_page_engaged'
  | 'team_picker_tab_change'
  | 'team_tile_tap'
  | 'email_cta_click'
  | 'follow_page_view'
  | 'teams_starred'
  | 'newsletter_signup'
  | 'search_query'
  | 'share_initiated'
  | 'game_day_view'
  | 'game_tap'
  | 'away_game_expanded'
  | 'ad_slot_viewed'
  | 'team_starred'
  | 'team_unstarred'
  | 'post_star_toast_shown'
  | 'post_star_toast_clicked'
  | 'post_star_toast_dismissed'
  | 'teams_browser_view'
  | 'my_teams_view'
  | 'my_teams_promo_tap'
  | 'score_filter_changed'
  | 'scored_promo_card_tap'
  | 'team_ranking_row_tap'
  | 'load_more_tap'
  | 'league_filter_change'
  | 'cfb_conf_nav'
  | 'resale_click';

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
  // Homepage upcoming-promo cards that open the shared game modal. Split by
  // bucket so dashboards can tell the hero "Tonight" rail from the "This Week"
  // list. game_tap / promo_card_tap carry these; the affiliate CTAs inside the
  // reused modal body attribute to them too (so a ticket click from the
  // homepage modal is not mislabeled web_team_page).
  | 'web_home_tonight'
  | 'web_home_this_week'
  | 'web_team_page'
  // Team-page "Upcoming promos" list rows (RedesignPromoRow) that open the same
  // shared game modal as the calendar. Distinct from web_team_page (the calendar
  // grid) so dashboards can separate list-driven taps from calendar-driven ones.
  | 'web_team_page_promolist'
  | 'web_promo_detail'
  | 'web_playoffs'
  | 'web_league_index'
  // College Football team pages (/cfb/[school]) and their affiliate CTAs, so
  // PostHog + GA4 can slice CFB clicks out from the pro surfaces.
  | 'web_cfb'
  // MLB league hub (/mlb) and its interactive sub-surfaces. Distinct from the
  // generic web_league_index (which covers /teams and any bare /{sport}) so
  // PostHog and GA4 can break the hub out by module: the this-week rail, the
  // browse-by-promo-type links, and the division team grid / selector.
  | 'web_mlb_hub'
  | 'web_mlb_hub_this_week'
  | 'web_mlb_hub_promo_type'
  | 'web_mlb_hub_team_card'
  // Venue logistics hub (/venues/[slug]). Per-building attribution rides in the
  // affiliate subId via promoId={buildingSlug}, so the surface stays one enum
  // value while reports still slice by building.
  | 'web_venue'
  | 'web_article'
  | 'web_my_teams'
  | 'web_best_promos'
  | 'web_world_cup'
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
  // Scoring discovery page extensions, populated only on /best-promos,
  // /best-promos/bobbleheads, and /team-rankings page views. Carry the
  // URL-derived filter state at the moment of the page view so dashboards
  // can segment URL-landed-with-params traffic (e.g. someone hitting
  // /best-promos?league=MLB&range=30d from a Reddit link) distinctly
  // from default views. Score count is the visible-list-cap at fetch time.
  // Filter-change cadence post-load rides the score_filter_changed event,
  // not a re-fired page_view.
  score_count?: number;
  league_filter?: string;
  date_range_filter?: string;
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
  // Legacy (gate-off homepage) tiles + the redesign's consolidated four-tile set
  // (gate-on homepage): giveaways / theme_nights / food_deals / hot_this_week.
  collection_name:
    | 'bobbleheads'
    | 'jerseys'
    | 'theme_nights'
    | 'fireworks'
    | 'giveaways'
    | 'food_deals'
    | 'hot_this_week';
  collection_count: number;
};

export type AffiliatePartner =
  | 'seatgeek'
  | 'stubhub'
  | 'fanatics'
  | 'spothero'
  | 'expedia'
  | 'ticketmaster'
  | 'ticketnetwork';

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

// ── Email capture funnel ───────────────────────────────────────────────────
// Four snake_case events dual-emitted through track() (PostHog + GA4):
//   email_cta_click → follow_page_view → teams_starred → newsletter_signup
// `surface` uses the CaptureSurface vocabulary (web_team_page / web_homepage /
// web_playoffs_hub / web_aggregator / web_other) rather than the broader
// AnalyticsSurface enum, so a funnel click joins cleanly to the
// `subscribers.source` it eventually writes. See lib/follow-surface.ts.

export type EmailCtaClickProperties = {
  surface: CaptureSurface;
  // Pre-starred team carried from a team-page CTA, so dashboards can see which
  // team drove a team-page entry without parsing the destination URL.
  team_slug?: string;
};

export type FollowPageViewProperties = {
  surface: CaptureSurface;
  // How many teams the page loaded pre-selected from entry context (1 for a
  // team-page entry, 0 for hub/homepage/aggregator).
  seeded_team_count: number;
};

export type TeamsStarredProperties = {
  surface: CaptureSurface;
  team_count: number;
  // True when the starred team is one of the visitor's geo "near you" teams,
  // i.e. membership in the server-computed near set, so the lift from geo
  // ordering is measurable. False when there is no geo signal or the team is not
  // near. Membership-based, so it stays true even if the team happened to be
  // starred via search rather than from the rendered "Teams near you" group.
  near_you: boolean;
};

export type NewsletterSignupProperties = {
  surface: CaptureSurface;
  team_count: number;
  // Retained optional fields for forward-compat with a future multi-list split.
  placement?: string;
  list_id?: string;
};

export type SearchQueryProperties = {
  surface: AnalyticsSurface;
  query: string;
  result_count?: number;
};

// Share channel the user picked inside the ShareSheet. `sms` and `x` replace
// the older `twitter`/`facebook` shape — the web share suite (src/components/
// share) standardized on these five surfaces.
export type ShareChannel = 'copy_link' | 'sms' | 'x' | 'email' | 'native';

export type ShareInitiatedProperties = {
  surface: AnalyticsSurface;
  channel: ShareChannel;
  // Where the share button lives, e.g. "promo_card", "game_card".
  placement: string;
  promo_title?: string;
  promo_type?: string;
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
  // Optional surface context. The team-page calendar omits both (the event is
  // self-describing via surface + path); the World Cup host card sets them so a
  // game-open from a city card is distinguishable in dashboards.
  placement?: string;
  city?: string;
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

// My Teams starring family. `placement` is a standardized string from the
// star-placement enum (e.g. "team_page_hero", "homepage_tonight_inline") so
// dashboards can compare star activity across surfaces without having to
// derive intent from page_path alone.
export type TeamStarEventProperties = {
  team_slug: string;
  team_name: string;
  league: string;
  sport?: Sport;
  placement: string;
};

// First-star education toast lifecycle. `placement` is the placement of the
// star that triggered the toast (the user's very first star ever) so we can
// see which surface drives initial adoption.
export type PostStarToastEventProperties = {
  placement: string;
};

// /teams browser page view. `league_filter` is the active filter at the
// moment the event fires — always "All" on initial render. Tab switches
// after that go through team_picker_tab_change rather than re-firing this.
export type TeamsBrowserViewProperties = {
  league_filter: string;
};

// /my-teams page view. `state` reflects which of the three branches
// rendered ("A" empty, "B" populated, "C" starred-but-quiet). Fires once
// per hydrated render; state transitions (e.g. starring from State A
// into State B/C) re-fire the event with the new state.
export type MyTeamsViewProperties = {
  starred_count: number;
  has_tonight_promo: boolean;
  state: 'A' | 'B' | 'C';
};

// Tap on any promo card or row inside /my-teams. `days_until` is computed
// against today's local date; 0 = tonight, positive = upcoming. Never
// negative — the page only renders forward-looking promos.
export type MyTeamsPromoTapProperties = {
  team_slug: string;
  promo_id: string;
  days_until: number;
};

// Event-level surface tag for the scoring discovery pages. Distinct from
// the typed AnalyticsSurface enum (which uses 'web_best_promos' for all
// three routes at the page-identity level); this tag is the finer-grained
// page identifier so dashboards can split the cluster.
export type ScoringPageSurface =
  | 'best_promos'
  | 'best_promos_bobbleheads'
  | 'team_rankings';

// Fires when a user toggles a league or date-range chip on /best-promos,
// /best-promos/bobbleheads, or /team-rankings. `filter_type` disambiguates
// which chip group fired, since the same event name covers both.
export type ScoreFilterChangedProperties = {
  surface: ScoringPageSurface;
  filter_type: 'league' | 'range';
  from: string;
  to: string;
};

// Fires when a user taps a ScoredPromoCard on /best-promos or
// /best-promos/bobbleheads. `team_rankings` is excluded since it has no
// ScoredPromoCard surface.
export type ScoredPromoCardTapProperties = {
  surface: Exclude<ScoringPageSurface, 'team_rankings'>;
  promo_id: string;
  team_id: string;
  league: string;
  score: number;
  item_type: string | null;
};

// Fires when a user taps a TeamRankingRow on /team-rankings. `rank`
// reflects the visible (filter-aware) rank, not the global rank.
export type TeamRankingRowTapProperties = {
  surface: 'team_rankings';
  team_id: string;
  league: string;
  team_score: number;
  rank: number;
};

// Fires when the "Show N more" button is tapped on /best-promos or
// /best-promos/bobbleheads. `current_count` is the visible count BEFORE
// the click expands it.
export type LoadMoreTapProperties = {
  surface: Exclude<ScoringPageSurface, 'team_rankings'>;
  current_count: number;
};

// Outbound resale-marketplace click (eBay) on a completed promo. Distinct from
// affiliate_click: that event covers forward-looking partner CTAs (tickets,
// merch, parking) while resale_click covers the post-event secondary market,
// so dashboards can split the two revenue motions without filtering on partner.
export type ResaleClickProperties = {
  surface: AnalyticsSurface;
  partner: 'ebay';
  placement: 'bobbleheads_hub' | 'team_page';
  promo_id: string;
  team_slug: string;
  sport?: Sport;
  destination_url: string;
};

// venue_hub_click: the INTERNAL routing click from a team page into that team's
// building hub (/venues/{slug}). Not an affiliate motion — it measures the
// team-page-to-hub internal-link thesis (pages per session), so it carries the
// team AND the destination building. Team is known here, so team_slug is the
// team (unlike the hub's own building-keyed affiliate sub-IDs).
export type VenueHubClickProperties = {
  surface: AnalyticsSurface;
  team_slug: string;
  sport?: Sport;
  placement: string;
  building_slug: string;
  building_name: string;
  destination_url: string;
};

export type EventPropertiesMap = {
  page_view: PageViewProperties;
  venue_hub_click: VenueHubClickProperties;
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
  email_cta_click: EmailCtaClickProperties;
  follow_page_view: FollowPageViewProperties;
  teams_starred: TeamsStarredProperties;
  newsletter_signup: NewsletterSignupProperties;
  search_query: SearchQueryProperties;
  share_initiated: ShareInitiatedProperties;
  game_day_view: GameDayViewProperties;
  game_tap: GameTapProperties;
  away_game_expanded: AwayGameExpandedProperties;
  ad_slot_viewed: AdSlotViewedProperties;
  team_starred: TeamStarEventProperties;
  team_unstarred: TeamStarEventProperties;
  post_star_toast_shown: PostStarToastEventProperties;
  post_star_toast_clicked: PostStarToastEventProperties;
  post_star_toast_dismissed: PostStarToastEventProperties;
  teams_browser_view: TeamsBrowserViewProperties;
  my_teams_view: MyTeamsViewProperties;
  my_teams_promo_tap: MyTeamsPromoTapProperties;
  score_filter_changed: ScoreFilterChangedProperties;
  scored_promo_card_tap: ScoredPromoCardTapProperties;
  team_ranking_row_tap: TeamRankingRowTapProperties;
  load_more_tap: LoadMoreTapProperties;
  league_filter_change: LeagueFilterChangeProperties;
  cfb_conf_nav: CfbConfNavProperties;
  resale_click: ResaleClickProperties;
};

// Fires when a user taps a conference chip (or "View the full hub") in the CFB
// sub-row of the pro team browser (home / /teams). CFB routes OUT to the /cfb
// hub, so this marks the hand-off. `conf` is a conference slug ('sec',
// 'big-ten', …) or 'all' for the full-hub link.
export type CfbConfNavProperties = {
  surface: 'homepage' | 'teams_page';
  conf: string;
};

// Redesigned collection pages (gate-on /promos/*): the league chips are newly
// interactive, so they emit this dual-emit event. `collection` is the page slug
// (e.g. 'bobbleheads'); `from_league`/`to_league` are 'All' or a league code.
export type LeagueFilterChangeProperties = {
  surface: AnalyticsSurface;
  collection: string;
  from_league: string;
  to_league: string;
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
  'web_home_tonight',
  'web_home_this_week',
  'web_team_page',
  'web_team_page_promolist',
  'web_promo_detail',
  'web_playoffs',
  'web_league_index',
  // Keep in lockstep with the AnalyticsSurface union above: adding a surface
  // there but not here makes isKnownSurface() return false and silently
  // downgrades legacy affiliate clicks to web_other.
  'web_cfb',
  'web_mlb_hub',
  'web_mlb_hub_this_week',
  'web_mlb_hub_promo_type',
  'web_mlb_hub_team_card',
  'web_article',
  'web_my_teams',
  'web_best_promos',
  'web_world_cup',
  'web_other',
]);

function isKnownSurface(s: string): s is AnalyticsSurface {
  return KNOWN_SURFACES.has(s as AnalyticsSurface);
}

export function inferSurfaceFromPath(path: string): AnalyticsSurface {
  if (!path || path === '/') return 'web_home';
  if (path.startsWith('/playoffs')) return 'web_playoffs';
  if (path.startsWith('/world-cup')) return 'web_world_cup';
  if (path.startsWith('/promos/')) return 'web_article';
  if (path.startsWith('/my-teams')) return 'web_my_teams';
  if (path.startsWith('/best-promos') || path.startsWith('/team-rankings')) return 'web_best_promos';
  if (path.startsWith('/teams')) return 'web_league_index';
  // College Football team pages — their own surface (pageviews + any path-inferred
  // click), so CFB never attributes to a pro sport surface.
  if (path.startsWith('/cfb')) return 'web_cfb';
  // The bare /mlb league hub gets its own surface. /mlb/{team} is a team page
  // and is handled by the generic sport match below (it returns web_team_page).
  if (path === '/mlb') return 'web_mlb_hub';
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
