// Typed dual-emit analytics layer (PostHog primary, GA4 secondary).
//
// Every event in the app goes through `track(event, props)`. The function
// auto-attaches page_path, device_class and the first-party source_* triplet
// so call sites only pass event-specific properties. The source_* triplet is
// PostHog-only: the GA4 sink strips it before emitting, because a GA4 event
// parameter named `source` overrides GA4's native session attribution (see
// the comment inside track()).
//
// Legacy helpers (`event`, `pageview`, `trackInstallClick`, `trackAffiliateClick`)
// are preserved so existing dashboards keep getting data — they now also feed
// through `track()` so the canonical events start flowing immediately.

import { flattenUTMsForEvent, getStoredUTMs } from './utm-capture';
// Type-only, so there is no runtime dependency and no cycle: the capture
// modules do not import analytics. One definition each, shared.
import type { ChipSource } from './capture/chips';
import type { TriggerSignal } from './capture/gesture-counter';
import type { SuppressionReason } from './capture/suppression';
import type { CaptureVariant } from './capture/variant';
import { readAttribution } from './attribution';
import type { CaptureSurface } from './follow-surface';

// ── Types ────────────────────────────────────────────────────────────────

export const GA_MEASUREMENT_ID = process.env.NEXT_PUBLIC_GA4_MEASUREMENT_ID || '';

export type AnalyticsEvent =
  | 'page_view'
  | 'cta_click'
  | 'browse_all_teams_tap'
  | 'this_week_see_all_tap'
  | 'rail_see_all_tap'
  | 'collection_tile_tap'
  | 'gameday_card_tap'
  | 'affiliate_click'
  | 'venue_hub_click'
  | 'hub_to_team'
  | 'venue_hub_promo_click'
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
  | 'capture_threshold_met'
  | 'capture_prompt_shown'
  | 'capture_prompt_suppressed'
  | 'capture_prompt_dismissed'
  | 'capture_prompt_submitted'
  | 'capture_prompt_team_added'
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
  // Ranked best-promos rail on the homepage (score-ordered, not date-ordered).
  | 'web_home_best'
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
  // The internal routing click FROM a CFB team page INTO that school's venue hub
  // (/venues/{slug}), fired by VenueHubLink with this surface. Split from web_cfb
  // (the CFB affiliate motions) so the team-page-to-hub internal-link thesis is
  // measured on its own, mirroring how pro pages fire venue_hub_click as
  // web_team_page.
  | 'web_cfb_venue_link'
  // CFB rivalry matchup pages (/cfb/rivalries/[slug]) and the affiliate steps in
  // their Plan the trip timeline. Split from web_cfb because the matchup family
  // is a different intent: trip planning against a single dated fixture, not a
  // season schedule. Its affiliate sub-IDs are keyed on the RIVALRY SLUG rather
  // than a team id, since a matchup has two schools and neither owns the click.
  | 'web_cfb_rivalry'
  // MLB league hub (/mlb) and its interactive sub-surfaces. Distinct from the
  // generic web_league_index (which covers /teams and any bare /{sport}) so
  // PostHog and GA4 can break the hub out by module: the this-week rail, the
  // browse-by-promo-type links, and the division team grid / selector.
  | 'web_mlb_hub'
  | 'web_mlb_hub_this_week'
  | 'web_mlb_hub_promo_type'
  | 'web_mlb_hub_team_card'
  // Venue-guide link sections: one per league hub (mirroring the per-module hub
  // split above, plus web_cfb_hub_venues below) and one for the /venues index,
  // so hub-origin and index-origin venue_hub_click volumes break out from the
  // team-page origin (web_team_page / web_cfb_venue_link).
  | 'web_mlb_hub_venues'
  // WNBA + MLS league hubs (/wnba, /mls) and their interactive sub-surfaces,
  // mirroring the MLB hub split so each league's hub taps, promo-type links, and
  // team grid / selector break out separately in PostHog + GA4.
  | 'web_wnba_hub'
  | 'web_wnba_hub_this_week'
  | 'web_wnba_hub_promo_type'
  | 'web_wnba_hub_team_card'
  | 'web_wnba_hub_venues'
  | 'web_mls_hub'
  | 'web_mls_hub_this_week'
  | 'web_mls_hub_promo_type'
  | 'web_mls_hub_team_card'
  | 'web_mls_hub_venues'
  // NFL league hub (/nfl) and its interactive sub-surfaces, mirroring the
  // MLB/WNBA/MLS hub split. The NFL hub is week-indexed, so
  // web_nfl_hub_this_week is the hero container (not a mid-page rail) and
  // web_nfl_hub_primetime is the primetime subsection inside it, split out so
  // its card taps and affiliate CTAs break out from the hero's in PostHog +
  // GA4.
  | 'web_nfl_hub'
  | 'web_nfl_hub_this_week'
  | 'web_nfl_hub_primetime'
  | 'web_nfl_hub_promo_type'
  | 'web_nfl_hub_team_card'
  | 'web_nfl_hub_venues'
  | 'web_cfb_hub_venues'
  | 'web_venue_index'
  // Venue logistics hub (/venues/[slug]). Per-building attribution rides in the
  // affiliate subId via promoId={buildingSlug}, so the surface stays one enum
  // value while reports still slice by building.
  | 'web_venue'
  // /promos/today "Daily Board" — the today + tomorrow promo cards and their
  // inline Ticketmaster / TicketNetwork / SpotHero CTAs, so today-page conversion
  // is directly comparable to web_team_page / web_team_page_promolist in PostHog
  // + GA4. Tomorrow cards share this surface (a planner buying tomorrow's tickets
  // tonight is the same funnel).
  | 'web_today'
  | 'web_article'
  | 'web_my_teams'
  | 'web_best_promos'
  // /best-promos/bobbleheads — its own surface so the bobblehead page's
  // affiliate sub-IDs (and path-inferred events) separate from /best-promos
  // partner-side instead of collapsing into one bucket.
  | 'web_best_promos_bobbleheads'
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
  // The A/B arm, on EVERY pageview rather than only on the three capture events.
  //
  // INERT AS OF THE CAPTURE-SHEET EXPERIMENT BEING DROPPED, AND RETAINED ON
  // PURPOSE. Nothing branches on this value today. It stays because a stamped,
  // balanced, browser-stable arm on the widest event in the app is the whole
  // denominator half of any future test, and because the reason it was added is
  // a mistake worth not repeating.
  //
  // WHY IT IS HERE. The arm is assigned eagerly, on a browser's first pageview,
  // but it was only ever REPORTED by the capture events, which need the gesture
  // threshold and 30 engaged seconds to fire. In the first 57 hours of Phase 1
  // that meant 117 arms visible out of 809 browsers: assignment was being judged
  // on a ninth of the flips it had actually made. It also left a
  // per-1,000-VISITORS rate uncomputable, because a denominator cannot be split
  // by an arm the visitor never reported. Stamping it here answers both from
  // traffic that already exists rather than from waiting for more.
  //
  // REQUIRED, not optional, so a future page_view call site cannot omit it and
  // leave the denominator quietly partial. There is no chart on which a missing
  // arm looks different from an arm that was never assigned.
  //
  // 'unassigned' IS EXPECTED HERE and is not a finding. The capture events can
  // barely carry it, because a storage-less browser is suppressed for
  // storage_unavailable before it ever reaches a shown event; a pageview has no
  // such filter, so those browsers now report honestly rather than not at all.
  // Exclude them from either arm when computing a rate. Never fold them into
  // control: that is the exact contamination the third value exists to prevent.
  variant: CaptureVariant;
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

/** Rail see-all link. One shell (StubRail) serves several rails, so `rail`
 *  carries the identity rather than leaning on `surface` alone. */
export type RailSeeAllTapProperties = {
  surface: AnalyticsSurface;
  rail: 'tonight' | 'best_promos';
  item_count: number;
  destination_url: string;
};

/** Gameday utility card. All five links share one destination (/venues), so
 *  without `card` they are indistinguishable in the data: same event, same
 *  surface, same page_path, same href. `all_venues` is the section see-all. */
export type GamedayCardTapProperties = {
  surface: AnalyticsSurface;
  card: 'parking' | 'bag' | 'transit' | 'gates' | 'all_venues';
  venue_count: number;
  destination_url: string;
};

export type CollectionTileTapProperties = {
  surface: AnalyticsSurface;
  // Three generations of tiles share this event.
  //   legacy gate-off homepage + league hubs: bobbleheads, jerseys,
  //     soccer_jerseys, theme_nights, fireworks
  //   gate-on homepage four-tile set: giveaways, theme_nights, food_deals,
  //     hot_this_week
  //   redesigned seven-tile grid: today, this_week, bobbleheads, theme_nights,
  //     jerseys, soccer_jerseys, food_deals
  // `this_week` is deliberately NOT folded into `hot_this_week`. They share a
  // destination but not a measurement: hot_this_week counts every future
  // highlight, this_week counts highlights inside seven days. Reusing the
  // value would rebase a live series mid-flight.
  // `giveaways` and `food_deals` note: the redesigned grid has no giveaways
  // tile, so that value loses its only emitter at the homepage swap. See
  // known-issues entry 31.
  collection_name:
    | 'bobbleheads'
    | 'jerseys'
    | 'soccer_jerseys'
    | 'theme_nights'
    | 'fireworks'
    | 'giveaways'
    | 'food_deals'
    | 'hot_this_week'
    | 'today'
    | 'this_week';
  collection_count: number;
};

export type AffiliatePartner =
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
// (which team-picker did the user interact with). "homepage" and
// "teams_page" are the grid pickers; "team_page" is the internal-linking
// surfaces on a team page itself (division-rivals cards, schedule-row
// opponent links), distinguished from each other by from_tab.
export type TeamPickerTabChangeProperties = {
  surface: 'homepage' | 'teams_page' | 'team_page';
  from_league: string;
  to_league: string;
};

export type TeamTileTapProperties = {
  surface: 'homepage' | 'teams_page' | 'team_page';
  team_id: string;
  league: string;
  from_tab: string;
  is_homepage_sample: boolean;
};

// ── Email capture funnel ───────────────────────────────────────────────────
// Four snake_case events dual-emitted through track() (PostHog + GA4):
//   email_cta_click → follow_page_view → teams_starred → newsletter_signup
//
// ALL FOUR CARRY `variant`, and it has to be all four. The point of labelling
// the funnel with the arm is to see WHERE an arm loses people; a step without it
// is a hole that no step-to-step rate can be computed across, which is the one
// question the labelling exists to answer.
// `surface` uses the CaptureSurface vocabulary (web_team_page / web_homepage /
// web_playoffs_hub / web_aggregator / web_other) rather than the broader
// AnalyticsSurface enum, so a funnel click joins cleanly to the
// `subscribers.source` it eventually writes. See lib/follow-surface.ts.

export type EmailCtaClickProperties = {
  surface: CaptureSurface;
  // Pre-starred team carried from a team-page CTA, so dashboards can see which
  // team drove a team-page entry without parsing the destination URL.
  team_slug?: string;
  // The funnel's ENTRY step, so this is the arm's first observation for anyone
  // who converts. Resolved at click time inside the EmailCtaLink client leaf:
  // both call sites reach it through a server component, which cannot read
  // localStorage, and resolving during render would make a storage write a
  // render side effect.
  variant: CaptureVariant;
};

export type FollowPageViewProperties = {
  surface: CaptureSurface;
  // How many teams the page loaded pre-selected from entry context (1 for a
  // team-page entry, 0 for hub/homepage/aggregator).
  seeded_team_count: number;
  variant: CaptureVariant;
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
  variant: CaptureVariant;
};

export type NewsletterSignupProperties = {
  surface: CaptureSurface;
  team_count: number;
  // The arm on the CONVERSION itself. Retained after the A/B was dropped and
  // now purely forward-looking: nothing branches on it, but the next experiment
  // gets a labelled numerator on day one instead of having to recover the arm by
  // joining a signup back to that browser's capture events. That join drops
  // every signup from a browser that never qualified, which is most of them.
  variant: CaptureVariant;
  // WHICH PLACEMENT OF THE SHEET CONVERTED. Set only by the capture sheet, which
  // is the one surface with two placements behind a single source value: the
  // team-page sheet and the aggregator sheet both write
  // surface='web_engagement_capture', and the aggregator one carries no team and
  // no chip row, so folding them together hides a materially different product
  // inside one number. Absent on every /follow signup, where `surface` alone is
  // already unambiguous.
  page_type?: CapturePageType;
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
  // Optional emitter context, mirroring GameTapProperties.placement above. The
  // team-page calendar omits it, so its payload is unchanged and every event
  // recorded before this field existed reads as placement-unset. ScheduleBlock
  // sets it so the two team-page emitters of this event stay separable in
  // PostHog; without it both send an identical payload from the same surface
  // and the same path, and the blend cannot be undone after ingestion.
  placement?: string;
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
// moment the event fires — "All" on a bare visit, or the league a valid
// ?league= deep link pre-selected (team-page ExploreCard links arrive this
// way). Tab switches after that go through team_picker_tab_change rather
// than re-firing this.
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

// venue_hub_click: the INTERNAL routing click into a building hub
// (/venues/{slug}). Not an affiliate motion: it measures the into-hub
// internal-link thesis, so it carries the destination building plus the origin.
// team_slug is the origin team when the click starts on a team page
// (placement 'team_page_plan_your_visit'); it is ABSENT when the click starts
// on a league hub or the /venues index (placements 'league_hub_venue_links' /
// 'venues_index'), where no single team is the origin. Slice those by
// surface + placement instead.
export type VenueHubClickProperties = {
  surface: AnalyticsSurface;
  team_slug?: string;
  sport?: Sport;
  placement: string;
  building_slug: string;
  building_name: string;
  destination_url: string;
};

// hub_to_team: the RETURN routing click from a venue hub back INTO a tenant
// team's page (/{sport}/{slug} or /cfb/{slug}). The mirror of venue_hub_click:
// it measures the hub-to-team internal-link direction (closing the loop) so the
// return traffic is measured the same way the forward traffic is. building is
// known here (the hub surface); team_slug is the destination tenant. sport is
// undefined for CFB tenants (normalizeSport only covers the six pro leagues).
export type HubToTeamClickProperties = {
  surface: AnalyticsSurface;
  team_slug: string;
  sport?: Sport;
  placement: string;
  building_slug: string;
  building_name: string;
  destination_url: string;
};

// venue_hub_promo_click: a tap on a card in the venue hub "Promos this week"
// scroller. The third internal-routing event in the family, and the most
// specific: venue_hub_click measures team page -> building, hub_to_team measures
// building -> team page, and this measures building -> ONE PROMO's anchor on the
// team page. It therefore carries the promo identity on top of the building and
// destination team the other two already carry.
//
// promo_id is synthPromoId (teamSlug:date:title). The read path drops the
// Firestore promo doc id, so that composite IS the app-wide promo identity for
// analytics, and it joins cleanly to promo_card_tap / this_week_card_tap on
// other surfaces.
export type VenueHubPromoClickProperties = {
  surface: AnalyticsSurface;
  team_slug: string;
  sport?: Sport;
  placement: string;
  building_slug: string;
  building_name: string;
  promo_id: string;
  promo_type: string;
  is_highlight: boolean;
  // 0 = a promo tonight. The scroller only ever holds 0..7.
  days_out: number;
  destination_url: string;
};

// ── Engagement capture trigger ────────────────────────────────────────────
// Emitted by the trigger engine. `shown` means the trigger FIRED, which is not
// quite the same as "a sheet appeared": the event is emitted first and the
// render happens off the back of it, and it went out unchanged through the
// telemetry-only phase when nothing rendered at all. Keeping that separation is
// what makes trigger rates comparable across every phase this feature has had.
//
// `surface` is the single capture-funnel surface for this feature and is the
// same value the sheet's submit stores on the subscriber record. WHICH PAGE it
// fired on is `page_type` — an analytics dimension, not a second source tag — so
// one surface value covers the team-page sheet and the aggregator sheet, and
// page_type is the only thing that tells them apart. It therefore rides on
// newsletter_signup too; see NewsletterSignupProperties.
export type CapturePromptContext = {
  surface: 'web_engagement_capture';
  page_type: CapturePageType;
  // Null on aggregators, which have no page-level team. page_type carries the
  // distinction.
  team_id: string | null;
  variant: CaptureVariant;
};

export type CapturePageType = 'team_page' | 'aggregator' | 'venue_page';

// capture_threshold_met: a PROBE, not a decision. It fires when the gesture
// threshold and 30 engaged seconds are both met, while shown and suppressed
// remain decided at 45. Nothing about the prompt changes when it fires.
//
// It exists to size one population that the first read could not see at all:
// visitors who qualify and then leave between 30 and 45 seconds. They emitted
// nothing before, so the cost of the 45-second floor was unmeasurable, and
// lowering the floor to find out would have been a guess with no way to check
// it afterwards.
//
// THE READ IS A SUBTRACTION OVER DISTINCT SESSIONS, NOT OVER RAW EVENT COUNTS.
// Suppressed visitors never emit the probe, so they belong on neither side of
// it. But the probe is guarded per pageview, exactly like shown and suppressed,
// while only ONE prompt is ever allowed per session, so raw counts would divide
// a per-pageview numerator by a per-session denominator. A visitor who qualifies
// on page one, leaves at 40 seconds, then qualifies again on page two and is
// shown there emits two probes and one shown; a raw difference books them as a
// loss, when in truth lowering the floor would have gained nothing from them
// because they were prompted anyway. Count DISTINCT sessions that emitted a
// probe minus distinct sessions that emitted shown.
//
// That error runs UP, and removing first_pageview is what makes multi-page
// qualification possible at all, so it grows with the very change being
// measured. The opposite error exists and is far smaller: the probe guard is a
// single pathname slot, so a visitor who probes page A, visits page B without
// qualifying, and returns to A gets no second probe for A while still emitting
// shown there. Both need a multi-page session, and the first read had 1.39
// pageviews per session with 72 distinct people behind 74 qualifying events, so
// neither is material yet. The diagnostic is cheap: compare the probe event
// count against the count of distinct sessions that probed. If they diverge,
// use distinct sessions and nothing else.
export type CaptureThresholdMetProperties = CapturePromptContext & {
  trigger_signal: TriggerSignal;
  trigger_count: number;
  // Engaged seconds at the probe, so the distribution between 30 and 45 is
  // visible rather than just the count.
  seconds_on_page: number;
};

// DO NOT USE THE RAW SHOWN COUNT AS A DENOMINATOR ACROSS TIME.
//
// The arm-vs-arm version of this warning is gone with the experiment: the sheet
// now renders for every qualifying visitor, so the two durable suppressors
// (promonight:capture_dismissed_at for 30 days, promonight:subscribed
// permanently) are written by every browser that dismisses or submits rather
// than by half of them. There is no asymmetry left between arms because there
// are no arms being compared.
//
// WHAT SURVIVES IS THE SAME TRAP POINTED AT A DIFFERENT AXIS. Those suppressors
// still make shown counts decay within a cohort: a browser that dismisses once
// stops emitting for a month, so shown-per-browser falls the longer a window
// runs and falls further in a window that starts at launch than in one that
// starts later. A pre/post or over-time comparison built on COUNT(shown) is
// therefore reading the suppression schedule, not behaviour.
//
// THE DOCUMENTED READS ARE ALREADY IMMUNE, and that is not luck. They are per
// PERSON over a QUALIFYING boolean: a browser counts once if it ever emitted
// threshold_met, shown OR suppressed. A suppressed browser still emits, with
// reason recently_dismissed or already_subscribed, so it never leaves the
// denominator. The denominator is symmetric because it is a boolean per browser
// rather than a count of events.
//
// See docs/capture-telemetry-read.md before writing anything that divides by
// this event.
export type CapturePromptShownProperties = CapturePromptContext & {
  trigger_signal: TriggerSignal;
  // Gestures, not events, for the signal that tripped. See gesture-counter.ts.
  trigger_count: number;
  // Engaged seconds, which excludes time spent backgrounded.
  seconds_on_page: number;
};

export type CapturePromptSuppressedProperties = CapturePromptContext & {
  suppression_reason: SuppressionReason;
  // Null when suppression was decided before any threshold was crossed, which
  // is the common case.
  trigger_signal: TriggerSignal | null;
  trigger_count: number;
  seconds_on_page: number;
};

// ── Engagement capture sheet ───────────────────────────────────────────────
// The three events below come from the sheet, which since the A/B was dropped
// renders for every qualifying visitor rather than for one arm. They still carry
// `variant`, inherited from the shared CapturePromptContext, and it still gates
// nothing.
//
// Raw shown counts are still not a safe denominator over time; the reason is
// spelled out in full above CapturePromptShownProperties. Read it before using
// shown as a denominator.

/**
 * How the visitor got rid of the sheet.
 *
 * 'backdrop' is a tap outside the panel on mobile. There is no scrim element to
 * tap: a real backdrop would have to swallow pointer events and the sheet is
 * required to leave the page behind scrollable, so the dismissal is detected as
 * an outside tap instead. Desktop has no equivalent, by design, which is why the
 * X is the affordance that carries weight there.
 *
 * 'handle' is the grab handle at the top centre of the panel, added because the
 * X alone is not reachable at page scales above 1.02: it sits 12px from the
 * panel's right edge, and on iOS a scaled page keeps this position:fixed panel
 * at LAYOUT-viewport width while showing only part of it.
 *
 * IT IS SPLIT OUT FROM 'x' SO THE TWO CAN BE COUNTED SEPARATELY, AND THAT IS
 * ALL IT PROVES. The event carries no page scale, so a handle dismissal does
 * NOT establish that the X was unreachable for that visitor — the handle also
 * renders on desktop, where a pointer user may simply prefer it. Read the
 * handle-vs-x split as an affordance preference and split it by device before
 * inferring anything about reachability. The converse is weaker still: the
 * handle is tap-only and looks like something you drag, so a LOW handle share
 * is not evidence the X was fine. Sum 'x' and 'handle' for a considered-no
 * rate; neither one alone is a reachability metric.
 */
export type CaptureDismissMethod = 'x' | 'handle' | 'backdrop' | 'escape';

/**
 * EMITTED FROM THE PROMPT STATE ONLY, deliberately. Closing a confirmation is
 * not rejecting a prompt, and folding the two together would inflate the dismiss
 * rate by exactly the number of people who converted. A dismissal landing while
 * a submit is still in flight is skipped for the same reason: it would otherwise
 * pair with the submitted event that arrives moments later. Dismissed and
 * submitted are therefore disjoint, and shown decomposes cleanly into dismissed
 * plus submitted plus abandoned with nobody counted twice.
 */
export type CapturePromptDismissedProperties = CapturePromptContext & {
  dismiss_method: CaptureDismissMethod;
};

/**
 * A submit the API accepted. Fired after the response, not on the tap, so it
 * counts records created rather than buttons pressed.
 *
 * `email_domain` is the part after the @, lowercased. The address itself is
 * never in an event; the domain is what a read needs (disposable-domain share,
 * corporate vs consumer) and carries no identity on its own.
 *
 * The two chip fields are EXPOSURE, and they are here rather than on their own
 * event because this is the only moment chips are chosen. capture_prompt_added
 * reports which rule produced an add; without a count of what was offered, and
 * of which rules offered it, that is a numerator with no denominator and
 * "should the venue-city rule stay" cannot be answered.
 */
export type CapturePromptSubmittedProperties = CapturePromptContext & {
  email_domain: string;
  /** How many chips the success state offered. 0..3. */
  chip_count: number;
  /** Their sources in rendered order, comma joined, e.g. "opponent,opponent,venue_city". */
  chip_sources: string;
};

/**
 * A chip tapped in the success state, on the ADD only. Un-starring a chip emits
 * nothing: the funnel question is what the chips gained, and a flip back to off
 * is already visible as the absence of an add.
 *
 * `team_id` on this event is the PAGE team, unchanged from every other capture
 * event, because one property meaning two different things across a family is
 * how a dashboard silently lies. The chipped team is `added_team_id`.
 */
export type CapturePromptTeamAddedProperties = CapturePromptContext & {
  /** The team the chip added. */
  added_team_id: string;
  /** 0-based position in the rendered row, so chip order can be read against uptake. */
  chip_position: number;
  /**
   * The team this chip was derived FROM: the page team for both sourcing rules
   * today. Null on an aggregator, which has no page team to derive from.
   */
  source_team_id: string | null;
  /**
   * Which sourcing rule produced the chip. Not in the original spec and added
   * anyway, because without it the two rules are indistinguishable in the data
   * and "should we keep the venue-city rule" is unanswerable. One property, new
   * event, no back-compat cost.
   */
  chip_source: ChipSource;
};

export type EventPropertiesMap = {
  page_view: PageViewProperties;
  venue_hub_click: VenueHubClickProperties;
  hub_to_team: HubToTeamClickProperties;
  venue_hub_promo_click: VenueHubPromoClickProperties;
  cta_click: CtaClickProperties;
  browse_all_teams_tap: BrowseAllTeamsTapProperties;
  this_week_see_all_tap: ThisWeekSeeAllTapProperties;
  rail_see_all_tap: RailSeeAllTapProperties;
  collection_tile_tap: CollectionTileTapProperties;
  gameday_card_tap: GamedayCardTapProperties;
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
  capture_threshold_met: CaptureThresholdMetProperties;
  capture_prompt_shown: CapturePromptShownProperties;
  capture_prompt_suppressed: CapturePromptSuppressedProperties;
  capture_prompt_dismissed: CapturePromptDismissedProperties;
  capture_prompt_submitted: CapturePromptSubmittedProperties;
  capture_prompt_team_added: CapturePromptTeamAddedProperties;
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
// 'big-ten', …) or 'all' for the full-hub link. 'team_page' exists only
// because the sub-row inherits TeamGrid's widened surface union; no team-page
// caller renders the sub-row today.
export type CfbConfNavProperties = {
  surface: 'homepage' | 'teams_page' | 'team_page';
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

// ── Client-only event subscribers ────────────────────────────────────────
// A module-level registry so a single root client component can observe every
// tracked event without touching a single call site. The alternative, adding a
// hook call next to each track() call, would mean editing CalendarGrid,
// team-calendar, UpcomingPromoModal and VenueHubLink for a feature none of them
// know about, and re-editing them for the next observer.
//
// CLIENT ONLY, and the guard below is what enforces it: track() early-returns
// before this point when `window` is undefined, so a subscriber can never run
// during SSR and can never cause a hydration divergence. Subscribers must
// therefore register in an effect, not during render.
//
// Subscribers are notified AFTER the sinks, and each is isolated, because an
// observer must never be able to break the analytics it is observing.

export type AnalyticsSubscriber = (
  eventName: AnalyticsEvent,
  props: Record<string, unknown>,
) => void;

const subscribers = new Set<AnalyticsSubscriber>();

/** Returns an unsubscribe function, so an effect cleanup is a one-liner. */
export function subscribeToAnalytics(fn: AnalyticsSubscriber): () => void {
  subscribers.add(fn);
  return () => {
    subscribers.delete(fn);
  };
}

function notifySubscribers(eventName: AnalyticsEvent, props: Record<string, unknown>): void {
  for (const fn of subscribers) {
    try {
      fn(eventName, props);
    } catch {
      // One bad subscriber must not stop the others, and must never surface to
      // the user. Analytics is best effort in both directions.
    }
  }
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
    const ph = (window as unknown as {
      posthog?: { capture?: (n: string, p?: unknown, o?: unknown) => void };
    }).posthog;
    if (ph && typeof ph.capture === 'function') {
      if (
        typeof document !== 'undefined' &&
        document.visibilityState === 'hidden'
      ) {
        // Teardown emit (the page_view flush fires from pagehide or the
        // hidden transition, where visibilityState is already 'hidden').
        // posthog-js's OWN pagehide handler registered at init runs before
        // any per-navigation listener, captures $pageleave, and drains the
        // batch queue via sendBeacon; a plain capture() here would enqueue
        // into the drained queue behind a flush timer a dying page never
        // runs, so the event would reach GA4 and silently miss PostHog,
        // preserving the exact pageleave-without-pageview anomaly the flush
        // exists to fix. send_instantly bypasses the batch; sendBeacon
        // survives the unload.
        ph.capture(eventName, enriched, {
          transport: 'sendBeacon',
          send_instantly: true,
        });
      } else {
        ph.capture(eventName, enriched);
      }
    }
  } catch {
    // Never crash the app over analytics.
  }

  try {
    if (typeof window.gtag === 'function') {
      // GA4 gets the payload MINUS the attribution triplet, and that is the
      // whole point of this block. GA4's ingestion treats an event parameter
      // literally named `source` as manual traffic-source input (the bare
      // source/medium/campaign names are Google's cross-platform manual
      // campaign vocabulary) and stamps session_source with it VERBATIM,
      // overriding GA4's own classification. That is where the polluted
      // "www.google.com / organic" and bare "direct" session buckets came
      // from: they are this cookie's vocabulary, which native GA4 processing
      // ("google", "(direct)") can never produce. Roughly 15% of sessions
      // were misattributed. source_medium/source_campaign map to nothing
      // server-side, but they ride along in the strip so a null cookie read
      // can no longer ship gtag's null-coerced empty strings either.
      //
      // PostHog keeps all three (they are its first-party channel model),
      // and subscribers keep all three. Only the GA4 sink narrows.
      const ga4Payload: Record<string, unknown> = { ...enriched };
      delete ga4Payload.source;
      delete ga4Payload.source_medium;
      delete ga4Payload.source_campaign;
      window.gtag('event', eventName, ga4Payload);
    }
  } catch {
    // Same — swallow.
  }

  if (analyticsDebugEnabled()) {
    // eslint-disable-next-line no-console
    console.log('[analytics]', eventName, enriched);
  }

  // Last, and after both sinks, so an observer can neither delay nor prevent
  // the events it is watching.
  notifySubscribers(eventName, enriched);
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

// Every AnalyticsSurface member, in union order. Feeds KNOWN_SURFACES below,
// and the compile-time assertion after the array turns an omission into a tsc
// error (so `next build` fails) instead of what an omission used to do:
// silently downgrade that surface's canonical affiliate_click to web_other in
// trackAffiliateClick, with no runtime signal. The hand-kept pair drifted three
// times (web_cfb, web_cfb_venue_link, web_venue — the last mislabeling every
// venue-hub affiliate click from 2026-07-15 until this list was derived).
const KNOWN_SURFACE_VALUES = [
  'web_home',
  'web_home_tonight',
  'web_home_best',
  'web_home_this_week',
  'web_team_page',
  'web_team_page_promolist',
  'web_promo_detail',
  'web_playoffs',
  'web_league_index',
  'web_cfb',
  'web_cfb_venue_link',
  'web_cfb_rivalry',
  'web_mlb_hub',
  'web_mlb_hub_this_week',
  'web_mlb_hub_promo_type',
  'web_mlb_hub_team_card',
  'web_mlb_hub_venues',
  'web_wnba_hub',
  'web_wnba_hub_this_week',
  'web_wnba_hub_promo_type',
  'web_wnba_hub_team_card',
  'web_wnba_hub_venues',
  'web_mls_hub',
  'web_mls_hub_this_week',
  'web_mls_hub_promo_type',
  'web_mls_hub_team_card',
  'web_mls_hub_venues',
  'web_nfl_hub',
  'web_nfl_hub_this_week',
  'web_nfl_hub_primetime',
  'web_nfl_hub_promo_type',
  'web_nfl_hub_team_card',
  'web_nfl_hub_venues',
  'web_cfb_hub_venues',
  'web_venue_index',
  'web_venue',
  'web_today',
  'web_article',
  'web_my_teams',
  'web_best_promos',
  'web_best_promos_bobbleheads',
  'web_world_cup',
  'web_other',
] as const satisfies readonly AnalyticsSurface[];

// Compile-time lockstep guard. `satisfies` above rejects typos/non-members;
// this rejects omissions: if the union gains a member missing from the array,
// MissingKnownSurface is that literal (not never) and the assignment fails tsc
// with an error message that names it.
type MissingKnownSurface = Exclude<
  AnalyticsSurface,
  (typeof KNOWN_SURFACE_VALUES)[number]
>;
const _everySurfaceIsKnown: MissingKnownSurface extends never
  ? true
  : MissingKnownSurface = true;
void _everySurfaceIsKnown;

const KNOWN_SURFACES: ReadonlySet<AnalyticsSurface> = new Set(
  KNOWN_SURFACE_VALUES,
);

function isKnownSurface(s: string): s is AnalyticsSurface {
  return KNOWN_SURFACES.has(s as AnalyticsSurface);
}

export function inferSurfaceFromPath(path: string): AnalyticsSurface {
  if (!path || path === '/') return 'web_home';
  if (path.startsWith('/playoffs')) return 'web_playoffs';
  if (path.startsWith('/world-cup')) return 'web_world_cup';
  if (path.startsWith('/promos/today')) return 'web_today';
  if (path.startsWith('/promos/')) return 'web_article';
  if (path.startsWith('/my-teams')) return 'web_my_teams';
  // MUST precede the generic /best-promos branch below, same trap as the
  // /cfb/rivalries branch: without it the bobbleheads page path-infers into
  // the general best-promos bucket.
  if (path.startsWith('/best-promos/bobbleheads')) return 'web_best_promos_bobbleheads';
  if (path.startsWith('/best-promos') || path.startsWith('/team-rankings')) return 'web_best_promos';
  if (path.startsWith('/teams')) return 'web_league_index';
  // MUST precede the /cfb branch below. /cfb/rivalries/{slug} starts with /cfb,
  // so without this the whole matchup family mis-tags as web_cfb and the trip
  // intent is invisible. This is the third, UNTYPECHECKED edit site for a new
  // CFB surface: the lockstep guard below catches a missing union member or a
  // missing KNOWN_SURFACE_VALUES entry, but nothing catches a missing branch
  // here, which fails silently as mis-attribution rather than as web_other.
  if (path.startsWith('/cfb/rivalries')) return 'web_cfb_rivalry';
  // College Football team pages — their own surface (pageviews + any path-inferred
  // click), so CFB never attributes to a pro sport surface.
  if (path.startsWith('/cfb')) return 'web_cfb';
  // The bare league-hub paths get their own surface. /{sport}/{team} is a team
  // page and is handled by the generic sport match below (web_team_page).
  if (path === '/mlb') return 'web_mlb_hub';
  if (path === '/wnba') return 'web_wnba_hub';
  if (path === '/mls') return 'web_mls_hub';
  // Without this, bare /nfl falls through to the generic sport match below
  // (whose allowlist includes 'nfl') and infers web_league_index for hub
  // pageviews — the third, untypechecked edit site for a new hub surface.
  if (path === '/nfl') return 'web_nfl_hub';
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
