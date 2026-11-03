# CTA Registry

Single source of truth for click/tap CTAs and the analytics events they emit.
Doctrine columns: cta_id, page_type, position, label, destination, event_name,
created_date, status.

Every row corresponds to an instrumented user-facing CTA. New rows go below
this table. Don't edit existing rows; add follow-up rows with `status: deprecated`
when retiring a CTA.

| cta_id | page_type | position | label | destination | event_name | created_date | status |
|---|---|---|---|---|---|---|---|
| tonight_card | homepage | hero_tonight_strip | (promo title) | /[sport]/[team] | tonight_card_tap | 2026-04-25 | active |
| browse_all_teams_hero | homepage | hero_secondary | Browse all 167 teams | /teams | browse_all_teams_tap | 2026-04-25 | active |
| this_week_card | homepage | this_week_section | (promo title) | /[sport]/[team] | this_week_card_tap | 2026-04-25 | active |
| this_week_see_all | homepage | this_week_section_header | See all | /promos/this-week | this_week_see_all_tap | 2026-04-25 | active |
| collection_tile_bobbleheads | homepage | browse_collections | BOBBLEHEADS | /promos/bobbleheads | collection_tile_tap | 2026-04-25 | active |
| collection_tile_jerseys | homepage | browse_collections | JERSEYS & APPAREL | /promos/jersey-giveaways | collection_tile_tap | 2026-04-25 | active |
| collection_tile_theme_nights | homepage | browse_collections | THEME NIGHTS | /promos/theme-nights | collection_tile_tap | 2026-04-25 | active |
| collection_tile_fireworks | homepage | browse_collections | FIREWORKS NIGHTS | /promos/theme-nights | collection_tile_tap | 2026-04-25 | active |
| team_picker_tab | homepage | find_your_team_tabs | (league name) | (in-page state) | team_picker_tab_change | 2026-04-25 | active |
| team_tile_homepage | homepage | find_your_team_grid | (team name) | /[sport]/[team] | team_tile_tap | 2026-04-25 | active |
| app_download_homepage_section | homepage | promo_push_section | Download for iOS / Get it on Google Play | App Store / Play Store | app_download_click | 2026-04-25 | active |
| app_download_nav | global | nav_top_right | Get the App | /download | app_download_click | 2026-04-25 | active |
| ticketmaster_get_tickets_team_hero | team_page | tickets_block_hero | ticketmaster Get Tickets → | ticketmaster.com (Impact wrap when env set) | affiliate_click | 2026-05-03 | active |
| ticketmaster_get_tickets_promo_card | team_page | tickets_block_promo_card | ticketmaster Get Tickets → | ticketmaster.com (Impact wrap when env set) | affiliate_click | 2026-05-03 | active |
| ticketmaster_get_tickets_playoffs_card | playoffs_hub | tickets_block_playoffs_card | ticketmaster Get Tickets → | ticketmaster.com (Impact wrap when env set) | affiliate_click | 2026-05-03 | active |
| ticketmaster_get_tickets_game_modal | team_page | tickets_block_game_modal | ticketmaster Get Tickets → | ticketmaster.com (Impact wrap when env set) | affiliate_click | 2026-05-03 | active |
| ticketnetwork_tickets_team_hero | team_page | tickets_block_hero | TicketNetwork logo → | ticketnetwork.com (Impact tracked) | affiliate_click | 2026-06-28 | active |
| ticketnetwork_tickets_promo_card | team_page | tickets_block_promo_card | TicketNetwork logo → | ticketnetwork.com (Impact tracked) | affiliate_click | 2026-06-28 | active |
| ticketnetwork_tickets_playoffs_card | playoffs_hub | tickets_block_playoffs_card | TicketNetwork logo → | ticketnetwork.com (Impact tracked) | affiliate_click | 2026-06-28 | active |
| ticketnetwork_tickets_game_modal | team_page | tickets_block_game_modal | TicketNetwork logo → | ticketnetwork.com (Impact tracked) | affiliate_click | 2026-06-28 | active |
| app_push_pitch_team | team_page | conversion_pairing_after_promo_list | Download for iOS / Get it on Google Play | /download (iOS) / Play Store | app_download_click | 2026-10-11 | deprecated (replaced by app_alert_card_team, app funnel G1) |
| app_alert_card_team | team_page | inside_promo_list_after_upcoming_rows | Get the app | App Store on iOS, Play Store on Android, /download?src=team_cta_{teamId} elsewhere (src/lib/app-link.ts) | app_download_click (surface team_cta) | 2026-10-11 | active |
| app_download_page_buttons | download | per_store_section | Download for iOS / Get it on Google Play | App Store / Play Store (src/lib/app-link.ts) | app_download_click (surface download) | 2026-10-11 | active |
| promo_link_team_row | team_page | promo_list_row_title | (promo title) | /[sport]/[team]/promos/[slug] | promo_link_click (surface web_team_page_promolist) | 2026-10-30 | active |
| promo_link_today_card | aggregator | today_card_overlay | (promo title, sr-only) | /[sport]/[team]/promos/[slug] | promo_link_click (surface web_today) | 2026-10-30 | active |
| promo_link_aggregator_row | aggregator | collection_row | (promo title) | /[sport]/[team]/promos/[slug] | promo_link_click (surface web_article) | 2026-10-30 | active |
| promo_link_home_tonight | homepage | tonight_rail_card_title + tonight_ribbon | (promo title) | /[sport]/[team]/promos/[slug] | promo_link_click (surface web_home_tonight) | 2026-10-30 | active |
| promo_link_home_this_week | homepage | this_week_card_title | (promo title) | /[sport]/[team]/promos/[slug] | promo_link_click (surface web_home_this_week) | 2026-10-30 | active |
| promo_link_home_best | homepage | best_promos_rail_card_title | (promo title) | /[sport]/[team]/promos/[slug] | promo_link_click (surface web_home_best) | 2026-10-30 | active |
| promo_link_venue_next_giveaways | venue_page | next_giveaways_here | (promo title) | /[sport]/[team]/promos/[slug] | promo_link_click (surface web_venue) | 2026-10-30 | active |
| promo_link_venue_week_card | venue_page | promos_this_week_card_overlay | (promo title, sr-only) | /[sport]/[team]/promos/[slug] | promo_link_click (surface web_venue) + venue_hub_promo_click | 2026-10-30 | active |
| promo_link_best_promos_card | best_promos | scored_card | (card) | /[sport]/[team]/promos/[slug] | promo_link_click (surface web_best_promos / web_best_promos_bobbleheads) + scored_promo_card_tap | 2026-10-30 | active |
| promo_link_team_package_row | team_page | ticket_packages_group_row_title (NBA and NHL only) | (promo title) | /[sport]/[team]/promos/[slug] | promo_link_click (surface web_team_page_promolist) | 2026-10-31 | active |
| app_remind_promo_page | promo_page | cta_row_secondary | Remind me | /download?src=promo_cta_{teamId}&promoId={promoId}&pageSlug={pageSlug}; on /download every App Store ct is pc (amended 2026-10-31, see App Store campaign tokens below) and Play utm_content is {teamId}_{promoId}_{pageSlug} (src/lib/app-link.ts) | web_app_cta_click (surface promo_cta) + app_download_click (surface promo_cta) | 2026-10-31 | active |
| ticketnetwork_promo_page_primary | promo_page | cta_row_primary | Get tickets | TicketNetwork event page of the next date's game when the pipeline matched it (games.tnEventUrl), else the team performer page; Impact tracked, subId1 web_promo_page_{team} | affiliate_click (surface web_promo_page, placement promo_page_primary, ticket_link_level event / team) | 2026-11-02 | active |
| ticketmaster_promo_page_secondary | promo_page | cta_row_primary_text_link | Also on Ticketmaster | ticketmaster.com team page (Impact wrap when env set) | affiliate_click (surface web_promo_page, placement promo_page_ticketmaster, ticket_link_level team) | 2026-11-02 | active |
| ticketnetwork_promo_page_date | promo_page | series_date_row (upcoming dates only) | Tickets | TicketNetwork event page of that date's game when matched, else the team performer page; Impact tracked, subId1 web_promo_date_{team} | affiliate_click (surface web_promo_page, placement promo_page_date, ticket_link_level event / team) | 2026-11-02 | active |
| share_promo_page_row | promo_page | cta_row_primary_right (same row as Get tickets, right of it) | Share (icon only below 340px) | navigator.share sheet where it exists, else a popover: Copy link, Text (sms:), Email (mailto:), X intent, Facebook sharer. Shared URL = canonical + utm_source=share, utm_medium={native,copy,sms,email,x,facebook}, utm_campaign=promo_page, s={8-char share id} | share_click (placement cta_row) + share_complete | 2026-11-03 | active |
| share_promo_page_image | promo_page | promo_image_top_right_overlay | (share icon, aria-label "Share this promo") | same as share_promo_page_row | share_click (placement image) + share_complete | 2026-11-03 | active |

## Promo page share attribution (2026-11-03)

Both Share controls (`share_promo_page_row`, `share_promo_page_image`) live in
`src/components/promo-page/PromoShare.tsx`; the pure rules are
`src/lib/promo-share.ts`, the per-tab storage `src/lib/promo-share-session.ts`.

- **Share id.** 8 random characters `[a-z0-9]` from the CSPRNG, minted on the
  tap, spent by the first channel that goes out. No user data, never derived
  from the distinct_id. The shared URL carries only the share id, the channel
  and the fixed campaign. On a Vercel preview the URL is the preview host.
- **Copy.** Share text `{Promo name}: {Team} vs {Opponent}, {Day Mon D}. All
  the details:` + URL; email subject `{Promo name} at the {Team} game, {Mon
  D}`. Stored fields only; a missing opponent or date drops its part.
- **Events.** `share_click` on the tap (channel `native` or `menu`),
  `share_complete` when `navigator.share` resolves (never on AbortError) or a
  desktop option is chosen (copy only once the clipboard write succeeds).
  Properties: shareId, channel, promoId, team, league, pageSlug, placement.
- **Landing.** A URL with a valid `s` and utm_source=share sets the tab's
  share session, registers the PostHog session properties `share_id`,
  `share_channel`, `share_promo_id`, `share_self_open`, fires one
  `share_landing`, then strips `s` and every `utm_*` with
  `history.replaceState`.
- **Self-open.** A share id this browser minted (localStorage
  `pn_share_created`, id to distinct_id) opened under the same distinct_id is
  `share_self_open=true`: no subId2, and excluded from the "Promo sharing"
  dashboard. The dashboard also excludes sessions whose distinct_id made the
  share_complete, which catches what the browser record cannot.
- **subId2.** In a shared-link session (not a self-open) every Impact link
  rendered by `TrackedAffiliateLink` adds `subId2=share`: TicketNetwork,
  Ticketmaster (Impact wrap only) and Fanatics. subId1 and Ticketmaster's
  sharedid are untouched. SpotHero (HasOffers) and Expedia (in-house) are not
  Impact and are never touched. Added on the client after hydration, so no
  served HTML ever carries subId2. `affiliate_click` in a shared session
  carries `share_id` and `share_self_open`.
- **og:image.** The share card, `/api/share-card/{promoId}?team={teamId}&v={page
  stamp ms}`, on every promo page variant; the Event JSON-LD image is still the
  tier image.

## TicketNetwork subId1 (ruling 2026-11-02)

Every TicketNetwork link carries `subId1` in the Fanatics convention,
`{surface}_{slug}`, built by `buildTicketNetworkLink` in `src/lib/affiliates.ts`
from a REQUIRED `surface` argument (a type error when omitted; no default).
Lowercase, `[a-z0-9_-]` only, at most 64 characters, the slug truncated when
needed (`tnSubId`). `NEXT_PUBLIC_TN_SUBID_OVERRIDE` replaces it on a Vercel
PREVIEW build only (Gate B2 testing, `preview_tn_test`); production ignores it.
The landing is the game's TicketNetwork event page wherever the surface renders
one game and the pipeline matched it (`games.tnEventUrl`), else the team
performer page; `ticket_link_level` on `affiliate_click` says which.

| subId1 | surface | where |
|---|---|---|
| web_promo_page_{team} | web_promo_page | Promo page primary "Get tickets", and its JSON-LD `offers.url` |
| web_promo_date_{team} | web_promo_date (sub ID only; the click reports web_promo_page) | Promo page per-date "Tickets" links on a series |
| web_team_page_{team} | web_team_page | Team page tickets block and sidebar rail (AffiliateRail); team-page schedule game detail for home games (GameExpand, game-day-detail; event link when matched) |
| web_away_game_{team}_at_{opponent} | (away-game token, `awayGameSubKey`) | Team-page schedule game detail for away games (event link when matched) |
| web_home_{team} | web_home | Homepage promo modal (UpcomingPromoModal) |
| web_today_{team} | web_today | /promos/today cards |
| web_{league}_hub_this_week_{team} | web_nhl_hub_this_week, web_nba_hub_this_week, web_mlb_hub_this_week, web_wnba_hub_this_week, web_mls_hub_this_week | League hub "This week" cards |
| web_best_promos_{team} | web_best_promos | /best-promos cards |
| web_best_promos_bobbleheads_{team} | web_best_promos_bobbleheads | /best-promos/bobbleheads cards |
| web_playoffs_{team} | web_playoffs | Playoffs hub ticket buttons |
| web_playoffs_league_{team} | web_playoffs_league | Playoffs league page ticket buttons |
| web_my_teams_{team} | web_my_teams | /my-teams ticket CTAs |
| web_venue_{building} | web_venue | Venue hub tickets (keyed on the building, no team) |
| web_cfb_{school} | web_cfb | CFB school page signature game, gameday block and game modal |
| web_cfb_rivalry_{school} | web_cfb_rivalry | CFB rivalry matchup "tickets" trip step |
| web_team_page_{team} | web_team_page | /dev/affiliate-check (dev only, not linked) |

Ticketmaster links are not covered by this table: their sub ID rides the
Impact wrap's SharedID (`NEXT_PUBLIC_TICKETMASTER_IMPACT_WRAP`), and the
2026-11-02 Impact report showed 91 Ticketmaster raw clicks with an empty Sub
ID. That is an open follow-up, deliberately not changed with this table.

## App Store campaign tokens (ruling 2026-10-31)

Every App Store link the site builds goes through `src/lib/app-link.ts`
(`APP_STORE_CT`), and its `ct` is a short fixed token per surface, never a
team or a promo. App Store Connect hides a campaign under 5 installs, so
per-team or per-promo tokens would never report. Team and promo detail lives
in Play's `utm_content` and in PostHog (`app_download_click`,
`web_app_cta_click`).

| ct | surface | where |
|---|---|---|
| pc | promo_cta | Every App Store link on /download (button and QR) when the visitor came from a promo page's Remind me (`app_remind_promo_page`) |
| tc | team_cta | The team card's direct App Store link on iPhone and iPad, and every App Store link on /download when the visitor came from the card's desktop link (`app_alert_card_team`) |
| dl | download, download_qr | /download's button and QR on a direct visit (`app_download_page_buttons`; also where `app_download_nav` and the homepage, about and aggregator buttons land) |

The `pt` is `NEXT_PUBLIC_APPSTORE_PROVIDER_TOKEN` (set in Production
2026-10-31); unset, the link carries no parameters.

## Removed CTAs

The previous SeatGeek + StubHub dual-button ticket CTAs (rendered in
`TicketsBlock` as filled-red and outlined-secondary buttons across team
pages, playoffs cards, and game-day modals) were retired on 2026-05-03 in
favor of single-source Ticketmaster. Neither program had landed approval and
the dual-CTA had become a high-intent leak. The URL builders
(`buildSeatGeekUrl`, `buildStubHubUrl`) were kept `@deprecated` for a time and
then DELETED outright on 2026-08-14 (Gate 3c of the affiliate attribution
fixes, with the env gates and both partner-union members): SeatGeek was
declined twice and StubHub was never approved, and the dead builders tagged
IDs directly onto retailer URLs, so re-wiring them without env values would
have shipped untagged links. SG/SH rows were never registered here
(the registry post-dates their addition), so there are no row-level
deprecations to record — this paragraph is the historical note.

The `ticketmaster_get_tickets_*` rows above all share `partner: 'ticketmaster'`
and `event_name: 'affiliate_click'`. Surface and placement are passed
through `affiliate_click` event properties so dashboards can slice by
surface without needing distinct event names. The Impact wrap template is
configured via the `NEXT_PUBLIC_TICKETMASTER_IMPACT_WRAP` env var; when
unset, the CTA links direct to ticketmaster.com without commission
attribution (graceful pre-approval fallback).

## 2026-06-28 — Ticket CTA re-stacked (Ticketmaster + TicketNetwork)

The ticket CTA now renders **both vendors stacked — Ticketmaster on top,
TicketNetwork below** — across every ticket surface, via the single shared
leaf `components/affiliates/TicketmasterCTA.tsx`. Timeline:

- **2026-06-16** the CTA was flag-swapped to TicketNetwork only (the
  `TICKET_VENDOR` constant; this era was never row-registered).
- **2026-06-28** Ticketmaster was re-enabled *alongside* TicketNetwork as a
  stacked two-button CTA. `TICKET_VENDOR` no longer gates rendering — both
  vendors render; each button is independently null-guarded.

Each button fires `affiliate_click` (PostHog + GA4 dual-emit) with a distinct
`partner` value (`'ticketmaster'` / `'ticketnetwork'`) and the page `surface`
passed straight through (`web_team_page`, `web_team_page_promolist`, etc.), so
the two partners are sliceable without distinct event names. The same leaf also
renders on the live team page via `AffiliateRail` (placement
`team_page_sidebar`) — not separately row-registered here.

**Label change:** the buttons now show the **brand mark + arrow only**
(Ticketmaster wordmark / TicketNetwork logo, navy tap arrow); the literal
"Get Tickets" descriptor text was dropped. The Ticketmaster Impact wrap is set
in Production, so prod TM clicks are commissionable
(`affiliate_tracking_active: true`); preview/dev builds fall back to a bare
ticketmaster.com link. TicketNetwork is always commissionable (hardcoded
Impact prefix + property IDs).
