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
