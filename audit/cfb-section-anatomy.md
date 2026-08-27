# Pro team page anatomy, section by section, and the CFB mirror

Read-only measurement, 2026-08-25, against production (www.getpromonight.com) and the worktree at feature/cfb-depth. No code changes, no Firestore writes. Purpose: understand how a pro team page reaches its word count so the CFB template can mirror a proven structure. The CFB substrate numbers come from audit/cfb-phase0-report.md and are not re-derived here.

Method in one paragraph. Every pro team page in the sitemap (169) was fetched with a cache-busting query string and counted with the repo's own Raptive method (audit/raptive-page-mix-visible.ts logic: outer layout `<main>`, script/style/noscript/template/iframe/svg stripped, nav stripped, tags removed, whitespace-split words). The three picks plus one supplementary page were then parsed into a DOM tree and every word inside the outer `<main>` attributed to the component that produced it, using the `order-[N]` wrapper each section gets from src/components/redesign/RedesignTeamPage.tsx as the marker (the hero sits before the grid and the affiliate disclosure after it). Attribution closes to zero unattributed words on all four pages. The static-versus-data split uses a word-level longest-common-subsequence between the same row on a second page of the same league (Cubs, LA Galaxy, Titans, Rockets): words that recur in the same order are the template skeleton, everything else is data-bearing; for repeated rows (game panels, promo rows) the skeleton is the mean LCS between adjacent instances, with team and venue name tokens moved back to derived. Data-bearing words are then split into DERIVED (computed or interpolated at render time) and STORED (text that lives in a Firestore field and renders as written) by section rule, stated per row. Rows with no reference row on any page are estimated at the sibling ratio and marked with an asterisk.

## 1. The three pages, and why

Measured distribution of the 169 pro team pages today (rendered words, Raptive method):

| league | n | min | median | max |
|---|---|---|---|---|
| MLB | 30 | 3,096 (los-angeles-angels) | 3,744 (seattle-mariners) | 4,530 (texas-rangers) |
| NHL | 32 | 677 (vancouver-canucks) | 1,866 (carolina-hurricanes) | 3,851 (detroit-red-wings) |
| MLS | 30 | 865 (cf-montreal) | 1,422 (new-york-city-fc) | 2,232 (san-diego-fc) |
| WNBA | 15 | 928 (chicago-sky) | 1,185 (phoenix-mercury) | 1,948 (seattle-storm) |
| NFL | 32 | 929 (los-angeles-rams) | 1,086 (denver-broncos) | 1,659 (chicago-bears) |
| NBA | 30 | 673 (boston-celtics) | 704 (portland-trail-blazers) | 968 (cleveland-cavaliers) |
| all | 169 | 673 | 1,281 | 4,530 |

Picks, chosen from the counts rather than by assumption:

- **Rich, in season: /mlb/seattle-mariners, 3,744 words.** The MLB median, taken instead of the 4,530-word Rangers maximum so the rich case is a typical in-season MLB page rather than the outlier. 37 upcoming promos, 77 completed, a populated venue document, one recurring deal.
- **Mid: /mls/new-york-city-fc, 1,422 words.** The MLS median, sitting at the top of the sitewide median band (sitewide median 1,281). 6 upcoming promos, a populated venue document, no game documents (MLS has no schedule feed), so no calendar panels and no rivals grid.
- **Thin: /nfl/los-angeles-rams, 929 words.** The NFL minimum and exactly the sitewide 25th percentile. One upcoming promo (the first NFL promo doc), two game panels, a venue document with name and coordinates only, so the venue block is a single fallback row.
- **Supplementary floor case: /nba/boston-celtics, 673 words.** The sitewide minimum: offseason, zero upcoming promos, no game documents, bare venue. Included because it is the structural closest analogue to a CFB page (no promo corpus) and shows what the template renders with nothing to render. Reported alongside but kept out of the three-page totals.

## 2. Section-by-section word count

Section tables per page, then sub-block detail with the class split. Component paths are relative to src/components/. "Stored" is text that lives in a Firestore field (see section 4 for the authored-versus-extracted breakdown).

### /mlb/seattle-mariners (rich, 3,744 words)

Attributed 3744 of 3744 words (0 unattributed). Static-skeleton reference page: /mlb/chicago-cubs.

| section | component file(s) | words | share | static | derived | stored |
|---|---|---|---|---|---|---|
| Hero | redesign/Hero.tsx, redesign/StatScoreboard.tsx | 23 | 0.6% | 13 | 10 | 0 |
| Affiliate rail | redesign/AffiliateRail.tsx, affiliates/*CTA.tsx via AffiliateRail.tsx, venue-hub/VenueHubLink.tsx | 38 | 1.0% | 34 | 4 | 0 |
| Venue block | venue-info-block.tsx | 148 | 4.0% | 37 | 0 | 111 |
| Explore card | redesign/ExploreCard.tsx | 20 | 0.5% | 20 | 0 | 0 |
| Ad slots | ads/AdSlot.tsx | 0 | 0.0% | 0 | 0 | 0 |
| Season explorer | redesign/CategoryChip.tsx, redesign/CalendarGrid.tsx, redesign/GameExpand.tsx | 2056 | 54.9% | 824 | 716 | 516 |
| Promo list | promo-list.tsx, redesign/RedesignPromoRow.tsx | 369 | 9.9% | 172 | 68 | 129 |
| Division rivals | redesign/DivisionRivals.tsx | 38 | 1.0% | 24 | 14 | 0 |
| Email CTA | follow/FollowCTA.tsx | 32 | 0.9% | 29 | 3 | 0 |
| App pitch | app-push-pitch.tsx | 37 | 1.0% | 35 | 2 | 0 |
| Authority stats | authority-stats.tsx | 74 | 2.0% | 61 | 13 | 0 |
| Recurring deals | recurring-deals-section.tsx | 48 | 1.3% | 23 | 3 | 22 * |
| Content sections | team-content-sections.tsx | 281 | 7.5% | 160 | 121 | 0 * |
| Related aggregators | team-related-aggregators.tsx | 32 | 0.9% | 30 | 2 | 0 |
| FAQ | team-faq.tsx, team-faq.tsx (generateTeamFAQs) | 526 | 14.0% | 457 | 69 | 0 * |
| Affiliate disclosure | affiliates/AffiliateDisclosure.tsx | 22 | 0.6% | 22 | 0 | 0 |
| **total** | | **3744** | 100% | 1941 (52%) | 1025 (27%) | 778 (21%) |

Sub-block detail:

| sub-block | component | words | static | derived | stored | method |
|---|---|---|---|---|---|---|
| Hero: title, eyebrow, subtitle, venue line | redesign/Hero.tsx | 10 | 4 | 6 | 0 | word-LCS with the same row on partner page |
| Hero: stat scoreboard | redesign/StatScoreboard.tsx | 13 | 9 | 4 | 0 | word-LCS with the same row on partner page |
| Affiliate rail: heading "Plan your visit" | redesign/AffiliateRail.tsx | 3 | 3 | 0 | 0 | word-LCS with the same row on partner page |
| Affiliate rail: affiliate CTAs (tickets, parking, hotels, gear) | affiliates/*CTA.tsx via AffiliateRail.tsx | 23 | 21 | 2 | 0 | word-LCS with the same row on partner page |
| Affiliate rail: venue hub link | venue-hub/VenueHubLink.tsx | 12 | 10 | 2 | 0 | word-LCS with the same row on partner page |
| Venue block: label "Game day" | venue-info-block.tsx | 2 | 2 | 0 | 0 | word-LCS with the same row on partner page |
| Venue block: row: Gate times | venue-info-block.tsx | 21 | 11 | 0 | 10 | word-LCS with the same row on partner page |
| Venue block: row: Parking | venue-info-block.tsx | 29 | 4 | 0 | 25 | word-LCS with the same row on partner page |
| Venue block: row: Transit | venue-info-block.tsx | 34 | 4 | 0 | 30 | word-LCS with the same row on partner page |
| Venue block: row: Accessibility | venue-info-block.tsx | 22 | 7 | 0 | 15 | word-LCS with the same row on partner page |
| Venue block: row: Bag policy | venue-info-block.tsx | 7 | 5 | 0 | 2 | word-LCS with the same row on partner page |
| Venue block: row: Nearby | venue-info-block.tsx | 33 | 4 | 0 | 29 | word-LCS with the same row on partner page |
| Explore card: links | redesign/ExploreCard.tsx | 20 | 20 | 0 | 0 | word-LCS with the same row on partner page |
| Season explorer: category chips | redesign/CategoryChip.tsx | 12 | 9 | 3 | 0 | word-LCS with the same row on partner page |
| Season explorer: month header | redesign/CalendarGrid.tsx | 2 | 2 | 0 | 0 | word-LCS with the same row on partner page |
| Season explorer: weekday labels | redesign/CalendarGrid.tsx | 7 | 7 | 0 | 0 | word-LCS with the same row on partner page |
| Season explorer: visible month day cells | redesign/CalendarGrid.tsx | 85 | 39 | 46 | 0 | word-LCS with the same row on partner page |
| Season explorer: legend | redesign/CalendarGrid.tsx | 10 | 10 | 0 | 0 | word-LCS with the same row on partner page |
| Season explorer: SSR-hidden per-date detail panels (27) | redesign/GameExpand.tsx | 1940 | 757 | 667 | 516 | mean word-LCS between adjacent instances, times instances; 37 team/venue-name tokens moved static to derived |
| Promo list: header (eyebrow, H2, count line) | promo-list.tsx | 10 | 9 | 1 | 0 | word-LCS with the same row on partner page |
| Promo list: upcoming rows (10) | redesign/RedesignPromoRow.tsx | 247 | 97 | 50 | 100 | mean word-LCS between adjacent instances, times instances |
| Promo list: show-all control | promo-list.tsx | 5 | 4 | 1 | 0 | word-LCS with the same row on partner page |
| Promo list: completed header | promo-list.tsx | 10 | 9 | 1 | 0 | word-LCS with the same row on partner page |
| Promo list: completed archive rows shown (3) + show-all control | redesign/RedesignPromoRow.tsx | 97 | 53 | 15 | 29 | mean word-LCS between adjacent instances, times instances |
| Division rivals: heading, blurb, rival cards | redesign/DivisionRivals.tsx | 38 | 24 | 14 | 0 | word-LCS with the same row on partner page |
| Email CTA: card | follow/FollowCTA.tsx | 32 | 29 | 3 | 0 | word-LCS with the same row on partner page |
| App pitch: card | app-push-pitch.tsx | 37 | 35 | 2 | 0 | word-LCS with the same row on partner page |
| Authority stats: eyebrow, H2, three generated paragraphs | authority-stats.tsx | 74 | 61 | 13 | 0 | word-LCS with the same row on partner page |
| Recurring deals: header (eyebrow, H2, intro) | recurring-deals-section.tsx | 26 | 23 | 3 | 0 | estimated at the sibling-row ratio (no reference row) |
| Recurring deals: deal cards (1) | recurring-deals-section.tsx | 22 | 0 | 0 | 22 | estimated at the sibling-row ratio (no reference row) |
| Content sections: block: What giveaways are the >Mariners > doing in !-- - | team-content-sections.tsx | 88 | 38 | 50 | 0 | word-LCS with the same row on partner page |
| Content sections: block: What are the best >Mariners > theme nights in !-- | team-content-sections.tsx | 87 | 44 | 43 | 0 | word-LCS with the same row on partner page |
| Content sections: block: When are >Mariners > kids and family events in !- | team-content-sections.tsx | 49 | 27 | 22 | 0 | estimated at the sibling-row ratio (no reference row) |
| Content sections: block: How do I find >Seattle Mariners > promotional eve | team-content-sections.tsx | 57 | 51 | 6 | 0 | word-LCS with the same row on partner page |
| Related aggregators: eyebrow, H2, link cards | team-related-aggregators.tsx | 32 | 30 | 2 | 0 | word-LCS with the same row on partner page |
| FAQ: H2 | team-faq.tsx | 3 | 3 | 0 | 0 | word-LCS with the same row on partner page |
| FAQ: Q: How many promotional nights do the Mariners have in 2026? | team-faq.tsx (generateTeamFAQs) | 42 | 32 | 10 | 0 | word-LCS with the same row on partner page |
| FAQ: Q: What is the best Mariners giveaway night in 2026? | team-faq.tsx (generateTeamFAQs) | 38 | 26 | 12 | 0 | word-LCS with the same row on partner page |
| FAQ: Q: When are Mariners kids and family events in 2026? | team-faq.tsx (generateTeamFAQs) | 52 | 44 | 8 | 0 | estimated at the sibling-row ratio (no reference row) |
| FAQ: Q: How can I track Seattle Mariners promotional events? | team-faq.tsx (generateTeamFAQs) | 65 | 59 | 6 | 0 | word-LCS with the same row on partner page |
| FAQ: Q: What time do gates open at T-Mobile Park? | team-faq.tsx (generateTeamFAQs) | 56 | 50 | 6 | 0 | word-LCS with the same row on partner page |
| FAQ: Q: How do I get to T-Mobile Park? | team-faq.tsx (generateTeamFAQs) | 62 | 50 | 12 | 0 | word-LCS with the same row on partner page |
| FAQ: Q: Where should I stay near T-Mobile Park? | team-faq.tsx (generateTeamFAQs) | 59 | 51 | 8 | 0 | word-LCS with the same row on partner page |
| FAQ: Q: Can I get notifications for Mariners promos? | team-faq.tsx (generateTeamFAQs) | 58 | 55 | 3 | 0 | word-LCS with the same row on partner page |
| FAQ: Q: Does PromoNight work for away games? | team-faq.tsx (generateTeamFAQs) | 52 | 51 | 1 | 0 | word-LCS with the same row on partner page |
| FAQ: Q: How often are Mariners promo schedules updated? | team-faq.tsx (generateTeamFAQs) | 39 | 36 | 3 | 0 | word-LCS with the same row on partner page |
| Affiliate disclosure: fine print | affiliates/AffiliateDisclosure.tsx | 22 | 22 | 0 | 0 | word-LCS with the same row on partner page |

### /mls/new-york-city-fc (mid, 1,422 words)

Attributed 1422 of 1422 words (0 unattributed). Static-skeleton reference page: /mls/la-galaxy.

| section | component file(s) | words | share | static | derived | stored |
|---|---|---|---|---|---|---|
| Hero | redesign/Hero.tsx, redesign/StatScoreboard.tsx | 22 | 1.5% | 12 | 10 | 0 |
| Affiliate rail | redesign/AffiliateRail.tsx, affiliates/*CTA.tsx via AffiliateRail.tsx, venue-hub/VenueHubLink.tsx | 38 | 2.7% | 34 | 4 | 0 |
| Venue block | venue-info-block.tsx | 153 | 10.8% | 38 | 0 | 115 |
| Explore card | redesign/ExploreCard.tsx | 20 | 1.4% | 20 | 0 | 0 |
| Ad slots | ads/AdSlot.tsx | 0 | 0.0% | 0 | 0 | 0 |
| Season explorer | redesign/CategoryChip.tsx, redesign/CalendarGrid.tsx, redesign/GameExpand.tsx | 279 | 19.6% | 150 | 3 | 126 * |
| Promo list | promo-list.tsx, redesign/RedesignPromoRow.tsx | 196 | 13.8% | 67 | 34 | 95 * |
| Email CTA | follow/FollowCTA.tsx | 35 | 2.5% | 29 | 6 | 0 |
| App pitch | app-push-pitch.tsx | 39 | 2.7% | 35 | 4 | 0 |
| Authority stats | authority-stats.tsx | 0 | 0.0% | 0 | 0 | 0 |
| Content sections | team-content-sections.tsx | 176 | 12.4% | 116 | 60 | 0 |
| Related aggregators | team-related-aggregators.tsx | 14 | 1.0% | 14 | 0 | 0 |
| FAQ | team-faq.tsx, team-faq.tsx (generateTeamFAQs) | 428 | 30.1% | 350 | 78 | 0 |
| Affiliate disclosure | affiliates/AffiliateDisclosure.tsx | 22 | 1.5% | 22 | 0 | 0 |
| **total** | | **1422** | 100% | 887 (62%) | 199 (14%) | 336 (24%) |

Sub-block detail:

| sub-block | component | words | static | derived | stored | method |
|---|---|---|---|---|---|---|
| Hero: title, eyebrow, subtitle, venue line | redesign/Hero.tsx | 11 | 4 | 7 | 0 | word-LCS with the same row on partner page |
| Hero: stat scoreboard | redesign/StatScoreboard.tsx | 11 | 8 | 3 | 0 | word-LCS with the same row on partner page |
| Affiliate rail: heading "Plan your visit" | redesign/AffiliateRail.tsx | 3 | 3 | 0 | 0 | word-LCS with the same row on partner page |
| Affiliate rail: affiliate CTAs (tickets, parking, hotels, gear) | affiliates/*CTA.tsx via AffiliateRail.tsx | 23 | 21 | 2 | 0 | word-LCS with the same row on partner page |
| Affiliate rail: venue hub link | venue-hub/VenueHubLink.tsx | 12 | 10 | 2 | 0 | word-LCS with the same row on partner page |
| Venue block: label "Game day" | venue-info-block.tsx | 2 | 2 | 0 | 0 | word-LCS with the same row on partner page |
| Venue block: row: Gate times | venue-info-block.tsx | 22 | 8 | 0 | 14 | word-LCS with the same row on partner page |
| Venue block: row: Parking | venue-info-block.tsx | 38 | 8 | 0 | 30 | word-LCS with the same row on partner page |
| Venue block: row: Transit | venue-info-block.tsx | 28 | 4 | 0 | 24 | word-LCS with the same row on partner page |
| Venue block: row: Accessibility | venue-info-block.tsx | 22 | 4 | 0 | 18 | word-LCS with the same row on partner page |
| Venue block: row: Bag policy | venue-info-block.tsx | 7 | 5 | 0 | 2 | word-LCS with the same row on partner page |
| Venue block: row: Nearby | venue-info-block.tsx | 34 | 7 | 0 | 27 | word-LCS with the same row on partner page |
| Explore card: links | redesign/ExploreCard.tsx | 20 | 20 | 0 | 0 | word-LCS with the same row on partner page |
| Season explorer: category chips | redesign/CategoryChip.tsx | 12 | 9 | 3 | 0 | word-LCS with the same row on partner page |
| Season explorer: month header | redesign/CalendarGrid.tsx | 2 | 2 | 0 | 0 | word-LCS with the same row on partner page |
| Season explorer: weekday labels | redesign/CalendarGrid.tsx | 7 | 7 | 0 | 0 | word-LCS with the same row on partner page |
| Season explorer: visible month day cells | redesign/CalendarGrid.tsx | 31 | 31 | 0 | 0 | word-LCS with the same row on partner page |
| Season explorer: legend | redesign/CalendarGrid.tsx | 8 | 8 | 0 | 0 | word-LCS with the same row on partner page |
| Season explorer: SSR-hidden per-date detail panels (4) | redesign/GameExpand.tsx | 211 | 85 | 0 | 126 | mean word-LCS between adjacent instances, times instances; 2 team/venue-name tokens moved static to derived |
| Season explorer: other calendar text | redesign/CalendarGrid.tsx | 8 | 8 | 0 | 0 | estimated at the sibling-row ratio (no reference row) |
| Promo list: header (eyebrow, H2, count line) | promo-list.tsx | 7 | 5 | 2 | 0 | word-LCS with the same row on partner page |
| Promo list: upcoming rows (6) | redesign/RedesignPromoRow.tsx | 175 | 50 | 30 | 95 | mean word-LCS between adjacent instances, times instances |
| Promo list: completed header | promo-list.tsx | 10 | 9 | 1 | 0 | word-LCS with the same row on partner page |
| Promo list: completed archive rows shown (0) + show-all control | redesign/RedesignPromoRow.tsx | 4 | 3 | 1 | 0 | estimated at the sibling-row ratio (no reference row) |
| Email CTA: card | follow/FollowCTA.tsx | 35 | 29 | 6 | 0 | word-LCS with the same row on partner page |
| App pitch: card | app-push-pitch.tsx | 39 | 35 | 4 | 0 | word-LCS with the same row on partner page |
| Content sections: block: What giveaways are the >City FC > doing in | team-content-sections.tsx | 51 | 27 | 24 | 0 | word-LCS with the same row on partner page |
| Content sections: block: What are the best >City FC > theme nights in !-- | team-content-sections.tsx | 64 | 38 | 26 | 0 | word-LCS with the same row on partner page |
| Content sections: block: How do I find >New York City FC > promotional eve | team-content-sections.tsx | 61 | 51 | 10 | 0 | word-LCS with the same row on partner page |
| Related aggregators: eyebrow, H2, link cards | team-related-aggregators.tsx | 14 | 14 | 0 | 0 | word-LCS with the same row on partner page |
| FAQ: H2 | team-faq.tsx | 3 | 3 | 0 | 0 | word-LCS with the same row on partner page |
| FAQ: Q: How many promotional nights do the City FC have in 2026? | team-faq.tsx (generateTeamFAQs) | 42 | 29 | 13 | 0 | word-LCS with the same row on partner page |
| FAQ: Q: What is the best City FC giveaway night in 2026? | team-faq.tsx (generateTeamFAQs) | 33 | 19 | 14 | 0 | word-LCS with the same row on partner page |
| FAQ: Q: How can I track New York City FC promotional events? | team-faq.tsx (generateTeamFAQs) | 71 | 59 | 12 | 0 | word-LCS with the same row on partner page |
| FAQ: Q: What time do gates open at Yankee Stadium? | team-faq.tsx (generateTeamFAQs) | 41 | 33 | 8 | 0 | word-LCS with the same row on partner page |
| FAQ: Q: How do I get to Yankee Stadium? | team-faq.tsx (generateTeamFAQs) | 63 | 50 | 13 | 0 | word-LCS with the same row on partner page |
| FAQ: Q: Where should I stay near Yankee Stadium? | team-faq.tsx (generateTeamFAQs) | 61 | 51 | 10 | 0 | word-LCS with the same row on partner page |
| FAQ: Q: Can I get notifications for City FC promos? | team-faq.tsx (generateTeamFAQs) | 61 | 55 | 6 | 0 | word-LCS with the same row on partner page |
| FAQ: Q: Does PromoNight work for away games? | team-faq.tsx (generateTeamFAQs) | 53 | 51 | 2 | 0 | word-LCS with the same row on partner page |
| Affiliate disclosure: fine print | affiliates/AffiliateDisclosure.tsx | 22 | 22 | 0 | 0 | word-LCS with the same row on partner page |

### /nfl/los-angeles-rams (thin, 929 words)

Attributed 929 of 929 words (0 unattributed). Static-skeleton reference page: /nfl/tennessee-titans.

| section | component file(s) | words | share | static | derived | stored |
|---|---|---|---|---|---|---|
| Hero | redesign/Hero.tsx, redesign/StatScoreboard.tsx | 24 | 2.6% | 17 | 7 | 0 |
| Affiliate rail | redesign/AffiliateRail.tsx, affiliates/*CTA.tsx via AffiliateRail.tsx, venue-hub/VenueHubLink.tsx | 38 | 4.1% | 36 | 2 | 0 |
| Venue block | venue-info-block.tsx | 12 | 1.3% | 12 | 0 | 0 |
| Explore card | redesign/ExploreCard.tsx | 20 | 2.2% | 20 | 0 | 0 |
| Ad slots | ads/AdSlot.tsx | 0 | 0.0% | 0 | 0 | 0 |
| Schedule release video | ScheduleReleaseVideoCard.tsx | 13 | 1.4% | 11 | 2 | 0 |
| Season explorer | redesign/CategoryChip.tsx, redesign/CalendarGrid.tsx, redesign/GameExpand.tsx | 112 | 12.1% | 86 | 26 | 0 * |
| Promo list | promo-list.tsx, redesign/RedesignPromoRow.tsx | 28 | 3.0% | 5 | 7 | 16 |
| Division rivals | redesign/DivisionRivals.tsx | 35 | 3.8% | 23 | 12 | 0 |
| Email CTA | follow/FollowCTA.tsx | 33 | 3.6% | 29 | 4 | 0 |
| App pitch | app-push-pitch.tsx | 49 | 5.3% | 43 | 6 | 0 |
| Authority stats | authority-stats.tsx | 0 | 0.0% | 0 | 0 | 0 |
| Content sections | team-content-sections.tsx | 106 | 11.4% | 77 | 29 | 0 |
| Related aggregators | team-related-aggregators.tsx | 14 | 1.5% | 14 | 0 | 0 |
| FAQ | team-faq.tsx, team-faq.tsx (generateTeamFAQs) | 423 | 45.5% | 365 | 58 | 0 |
| Affiliate disclosure | affiliates/AffiliateDisclosure.tsx | 22 | 2.4% | 22 | 0 | 0 |
| **total** | | **929** | 100% | 760 (82%) | 153 (16%) | 16 (2%) |

Sub-block detail:

| sub-block | component | words | static | derived | stored | method |
|---|---|---|---|---|---|---|
| Hero: title, eyebrow, subtitle, venue line | redesign/Hero.tsx | 11 | 5 | 6 | 0 | word-LCS with the same row on partner page |
| Hero: stat scoreboard | redesign/StatScoreboard.tsx | 13 | 12 | 1 | 0 | word-LCS with the same row on partner page |
| Affiliate rail: heading "Plan your visit" | redesign/AffiliateRail.tsx | 3 | 3 | 0 | 0 | word-LCS with the same row on partner page |
| Affiliate rail: affiliate CTAs (tickets, parking, hotels, gear) | affiliates/*CTA.tsx via AffiliateRail.tsx | 23 | 22 | 1 | 0 | word-LCS with the same row on partner page |
| Affiliate rail: venue hub link | venue-hub/VenueHubLink.tsx | 12 | 11 | 1 | 0 | word-LCS with the same row on partner page |
| Venue block: label "Game day" | venue-info-block.tsx | 2 | 2 | 0 | 0 | word-LCS with the same row on partner page |
| Venue block: row: Gate times | venue-info-block.tsx | 10 | 10 | 0 | 0 | word-LCS with the same row on partner page |
| Explore card: links | redesign/ExploreCard.tsx | 20 | 20 | 0 | 0 | word-LCS with the same row on partner page |
| Schedule release video: card | ScheduleReleaseVideoCard.tsx | 13 | 11 | 2 | 0 | word-LCS with the same row on partner page |
| Season explorer: category chips | redesign/CategoryChip.tsx | 12 | 9 | 3 | 0 | word-LCS with the same row on another league page |
| Season explorer: month header | redesign/CalendarGrid.tsx | 2 | 2 | 0 | 0 | word-LCS with the same row on another league page |
| Season explorer: weekday labels | redesign/CalendarGrid.tsx | 7 | 7 | 0 | 0 | word-LCS with the same row on another league page |
| Season explorer: visible month day cells | redesign/CalendarGrid.tsx | 31 | 31 | 0 | 0 | word-LCS with the same row on another league page |
| Season explorer: legend | redesign/CalendarGrid.tsx | 10 | 10 | 0 | 0 | word-LCS with the same row on another league page |
| Season explorer: SSR-hidden per-date detail panels (2) | redesign/GameExpand.tsx | 43 | 20 | 23 | 0 | mean word-LCS between adjacent instances, times instances |
| Season explorer: other calendar text | redesign/CalendarGrid.tsx | 7 | 7 | 0 | 0 | estimated at the sibling-row ratio (no reference row) |
| Promo list: header (eyebrow, H2, count line) | promo-list.tsx | 7 | 5 | 2 | 0 | word-LCS with the same row on another league page |
| Promo list: upcoming rows (1) | redesign/RedesignPromoRow.tsx | 21 | 0 | 5 | 16 | single instance, no skeleton estimate |
| Division rivals: heading, blurb, rival cards | redesign/DivisionRivals.tsx | 35 | 23 | 12 | 0 | word-LCS with the same row on partner page |
| Email CTA: card | follow/FollowCTA.tsx | 33 | 29 | 4 | 0 | word-LCS with the same row on partner page |
| App pitch: card | app-push-pitch.tsx | 49 | 43 | 6 | 0 | word-LCS with the same row on partner page |
| Content sections: block: What giveaways are the >Rams > doing in >20 | team-content-sections.tsx | 42 | 23 | 19 | 0 | word-LCS with the same row on another league page |
| Content sections: block: How do I find >Los Angeles Rams > promotional eve | team-content-sections.tsx | 64 | 54 | 10 | 0 | word-LCS with the same row on partner page |
| Related aggregators: eyebrow, H2, link cards | team-related-aggregators.tsx | 14 | 14 | 0 | 0 | word-LCS with the same row on partner page |
| FAQ: H2 | team-faq.tsx | 3 | 3 | 0 | 0 | word-LCS with the same row on partner page |
| FAQ: Q: How many promotional nights do the Rams have in 2026? | team-faq.tsx (generateTeamFAQs) | 37 | 27 | 10 | 0 | word-LCS with the same row on another league page |
| FAQ: Q: What is the best Rams giveaway night in 2026? | team-faq.tsx (generateTeamFAQs) | 34 | 19 | 15 | 0 | word-LCS with the same row on another league page |
| FAQ: Q: How can I track Los Angeles Rams promotional events? | team-faq.tsx (generateTeamFAQs) | 71 | 62 | 9 | 0 | word-LCS with the same row on partner page |
| FAQ: Q: What time do gates open at SoFi Stadium? | team-faq.tsx (generateTeamFAQs) | 51 | 46 | 5 | 0 | word-LCS with the same row on partner page |
| FAQ: Q: How do I get to SoFi Stadium? | team-faq.tsx (generateTeamFAQs) | 62 | 52 | 10 | 0 | word-LCS with the same row on partner page |
| FAQ: Q: Where should I stay near SoFi Stadium? | team-faq.tsx (generateTeamFAQs) | 60 | 54 | 6 | 0 | word-LCS with the same row on partner page |
| FAQ: Q: Can I get notifications for Rams promos? | team-faq.tsx (generateTeamFAQs) | 53 | 51 | 2 | 0 | word-LCS with the same row on partner page |
| FAQ: Q: Does PromoNight work for away games? | team-faq.tsx (generateTeamFAQs) | 52 | 51 | 1 | 0 | word-LCS with the same row on partner page |
| Affiliate disclosure: fine print | affiliates/AffiliateDisclosure.tsx | 22 | 22 | 0 | 0 | word-LCS with the same row on partner page |

### /nba/boston-celtics (supplementary floor case, 673 words)

Attributed 673 of 673 words (0 unattributed). Static-skeleton reference page: /nba/houston-rockets.

| section | component file(s) | words | share | static | derived | stored |
|---|---|---|---|---|---|---|
| Hero | redesign/Hero.tsx, redesign/StatScoreboard.tsx | 20 | 3.0% | 15 | 5 | 0 |
| Affiliate rail | redesign/AffiliateRail.tsx, affiliates/*CTA.tsx via AffiliateRail.tsx | 26 | 3.9% | 24 | 2 | 0 |
| Venue block | venue-info-block.tsx | 11 | 1.6% | 11 | 0 | 0 |
| Explore card | redesign/ExploreCard.tsx | 20 | 3.0% | 20 | 0 | 0 |
| Ad slots | ads/AdSlot.tsx | 0 | 0.0% | 0 | 0 | 0 |
| Season explorer | redesign/CategoryChip.tsx, redesign/CalendarGrid.tsx, redesign/GameExpand.tsx | 60 | 8.9% | 60 | 0 | 0 |
| Promo list | promo-list.tsx, redesign/RedesignPromoRow.tsx | 31 | 4.6% | 24 | 7 | 0 * |
| Email CTA | follow/FollowCTA.tsx | 32 | 4.8% | 29 | 3 | 0 |
| App pitch | app-push-pitch.tsx | 37 | 5.5% | 35 | 2 | 0 |
| Authority stats | authority-stats.tsx | 0 | 0.0% | 0 | 0 | 0 |
| Content sections | team-content-sections.tsx | 57 | 8.5% | 51 | 6 | 0 |
| Related aggregators | team-related-aggregators.tsx | 14 | 2.1% | 14 | 0 | 0 |
| FAQ | team-faq.tsx, team-faq.tsx (generateTeamFAQs) | 343 | 51.0% | 308 | 35 | 0 |
| Affiliate disclosure | affiliates/AffiliateDisclosure.tsx | 22 | 3.3% | 22 | 0 | 0 |
| **total** | | **673** | 100% | 613 (91%) | 60 (9%) | 0 (0%) |

Sub-block detail:

| sub-block | component | words | static | derived | stored | method |
|---|---|---|---|---|---|---|
| Hero: title, eyebrow, subtitle, venue line | redesign/Hero.tsx | 9 | 4 | 5 | 0 | word-LCS with the same row on partner page |
| Hero: stat scoreboard | redesign/StatScoreboard.tsx | 11 | 11 | 0 | 0 | word-LCS with the same row on partner page |
| Affiliate rail: heading "Plan your visit" | redesign/AffiliateRail.tsx | 3 | 3 | 0 | 0 | word-LCS with the same row on partner page |
| Affiliate rail: affiliate CTAs (tickets, parking, hotels, gear) | affiliates/*CTA.tsx via AffiliateRail.tsx | 23 | 21 | 2 | 0 | word-LCS with the same row on partner page |
| Venue block: label "Game day" | venue-info-block.tsx | 2 | 2 | 0 | 0 | word-LCS with the same row on partner page |
| Venue block: row: Gate times | venue-info-block.tsx | 9 | 9 | 0 | 0 | word-LCS with the same row on partner page |
| Explore card: links | redesign/ExploreCard.tsx | 20 | 20 | 0 | 0 | word-LCS with the same row on partner page |
| Season explorer: category chips | redesign/CategoryChip.tsx | 12 | 12 | 0 | 0 | word-LCS with the same row on partner page |
| Season explorer: month header | redesign/CalendarGrid.tsx | 2 | 2 | 0 | 0 | word-LCS with the same row on partner page |
| Season explorer: weekday labels | redesign/CalendarGrid.tsx | 7 | 7 | 0 | 0 | word-LCS with the same row on partner page |
| Season explorer: visible month day cells | redesign/CalendarGrid.tsx | 31 | 31 | 0 | 0 | word-LCS with the same row on partner page |
| Season explorer: legend | redesign/CalendarGrid.tsx | 8 | 8 | 0 | 0 | word-LCS with the same row on partner page |
| Promo list: header (eyebrow, H2, count line) | promo-list.tsx | 4 | 4 | 0 | 0 | word-LCS with the same row on partner page |
| Promo list: completed header | promo-list.tsx | 10 | 8 | 2 | 0 | word-LCS with the same row on partner page |
| Promo list: completed archive rows shown (0) + show-all control | redesign/RedesignPromoRow.tsx | 4 | 3 | 1 | 0 | estimated at the sibling-row ratio (no reference row) |
| Promo list: other (empty-state copy etc.) | promo-list.tsx | 13 | 9 | 4 | 0 | estimated at the sibling-row ratio (no reference row) |
| Email CTA: card | follow/FollowCTA.tsx | 32 | 29 | 3 | 0 | word-LCS with the same row on partner page |
| App pitch: card | app-push-pitch.tsx | 37 | 35 | 2 | 0 | word-LCS with the same row on partner page |
| Content sections: block: How do I find >Boston Celtics > promotional event | team-content-sections.tsx | 57 | 51 | 6 | 0 | word-LCS with the same row on partner page |
| Related aggregators: eyebrow, H2, link cards | team-related-aggregators.tsx | 14 | 14 | 0 | 0 | word-LCS with the same row on partner page |
| FAQ: H2 | team-faq.tsx | 3 | 3 | 0 | 0 | word-LCS with the same row on partner page |
| FAQ: Q: How can I track Boston Celtics promotional events? | team-faq.tsx (generateTeamFAQs) | 65 | 59 | 6 | 0 | word-LCS with the same row on partner page |
| FAQ: Q: What time do gates open at TD Garden? | team-faq.tsx (generateTeamFAQs) | 45 | 39 | 6 | 0 | word-LCS with the same row on partner page |
| FAQ: Q: How do I get to TD Garden? | team-faq.tsx (generateTeamFAQs) | 61 | 50 | 11 | 0 | word-LCS with the same row on partner page |
| FAQ: Q: Where should I stay near TD Garden? | team-faq.tsx (generateTeamFAQs) | 59 | 51 | 8 | 0 | word-LCS with the same row on partner page |
| FAQ: Q: Can I get notifications for Celtics promos? | team-faq.tsx (generateTeamFAQs) | 58 | 55 | 3 | 0 | word-LCS with the same row on partner page |
| FAQ: Q: Does PromoNight work for away games? | team-faq.tsx (generateTeamFAQs) | 52 | 51 | 1 | 0 | word-LCS with the same row on partner page |
| Affiliate disclosure: fine print | affiliates/AffiliateDisclosure.tsx | 22 | 22 | 0 | 0 | word-LCS with the same row on partner page |

### Split across the three primary pages

| class | words | share |
|---|---|---|
| static template copy | 3588 | 58.9% |
| derived from data at render time | 1377 | 22.6% |
| stored field text (authored or extracted) | 1130 | 18.5% |
| total | 6095 | 100% |

Per section, summed over the three primary pages:

| section | words | static | derived | stored | pages present |
|---|---|---|---|---|---|
| Season explorer | 2447 | 1060 | 745 | 642 | 3 |
| FAQ | 1377 | 1172 | 205 | 0 | 3 |
| Promo list | 593 | 244 | 109 | 240 | 3 |
| Content sections | 563 | 353 | 210 | 0 | 3 |
| Venue block | 313 | 87 | 0 | 226 | 3 |
| App pitch | 125 | 113 | 12 | 0 | 3 |
| Affiliate rail | 114 | 104 | 10 | 0 | 3 |
| Email CTA | 100 | 87 | 13 | 0 | 3 |
| Authority stats | 74 | 61 | 13 | 0 | 3 |
| Division rivals | 73 | 47 | 26 | 0 | 2 |
| Hero | 69 | 42 | 27 | 0 | 3 |
| Affiliate disclosure | 66 | 66 | 0 | 0 | 3 |
| Explore card | 60 | 60 | 0 | 0 | 3 |
| Related aggregators | 60 | 58 | 2 | 0 | 3 |
| Recurring deals | 48 | 23 | 3 | 22 | 1 |
| Schedule release video | 13 | 11 | 2 | 0 | 1 |
| Ad slots | 0 | 0 | 0 | 0 | 3 |

Reading the tables:

- **The rich page is the calendar's hidden panels.** On the Mariners, the `order-[10]` season slot is 2,056 words, 55% of the page, and 1,940 of those are the per-date `GameExpand` panels that `CalendarGrid.tsx` server-renders with the `hidden` attribute so crawlers see every game's opponent, promos and ticket CTAs (CalendarGrid.tsx:416-436). They are invisible until a day is clicked. The Raptive-method script counts them because it strips only script, style, noscript, template, iframe and svg. Whether Raptive's own crawler counts `hidden` subtrees is not verified anywhere in the repo; if it does not, the Mariners page is 1,804 words and the NYCFC page 1,211, and the MLB "rich" case is roughly half of what the baseline says. This is the largest single uncertainty in the whole depth strategy and it predates CFB.
- **The FAQ is the thin page.** On the Rams and the Celtics the FAQ block is 423 and 343 words, 46% and 51% of the page, and it is 85 to 90% static template. The five unconditional answers (how to track, gates, directions, hotels, notifications, away games) are 45 to 65 words each and survive with no promo data at all.
- **The venue block is the only human writing on the page**, and it is 148 to 153 words when populated (Mariners, NYCFC) and 10 to 12 words when not (Rams, Celtics: the label plus the league gate-times fallback sentence).
- **Everything else is small.** Hero 20 to 24, affiliate rail 26 to 38, explore card 20, email and app cards 69 to 82, rivals 35 to 38, aggregators 14 to 32, disclosure 22. These are the same on every page and they are almost entirely static.

## 3. Data dependency per section

Fields are Firestore paths as read by the loaders in src/lib/data.ts and src/lib/recurring-deals.ts; behaviour is what the served page does when the data is absent. File:line references are from the verified section map produced for this pass (the map's full text, with every gate expression, is in the workflow output referenced at the end).

| section | component | Firestore fields read | when absent |
|---|---|---|---|
| Hero + stat scoreboard | redesign/Hero.tsx, StatScoreboard.tsx | teams.city, .name, .league, .division, .primaryColor; venues.name; upcomingCounts by type (from teams/{id}/promos.date and .type); gameContexts length | Never disappears. Division segment drops when empty; hub link falls back to plain text when the league hub is not live; venue line drops when venue is null; a promo tile still renders its label at 0 |
| Season explorer (calendar) / schedule block | redesign/SeasonExplorer.tsx, CalendarGrid.tsx, GameExpand.tsx; or ScheduleBlock.tsx | promos.date/.type/.isGiveaway/.highlight for chips and dots; promos.title/.description/.time/.gameInfo inside the hidden panels; games.date/.homeTeamSlug/.awayTeamSlug/.time and the opponent team doc via enrichGamesForTeam | Supersede: ScheduleBlock replaces the calendar only when there are zero upcoming promos AND game docs exist (RedesignTeamPage.tsx:118-124, :300-312). A zero-promo page with no game docs (NBA, NHL, MLS, WNBA) keeps the calendar as an EMPTY SHELL: chips at 0, a month grid of inert cells, no panels (Celtics: 60 words). Panels render only for dates that have a game context or a promo |
| Division rivals | redesign/DivisionRivals.tsx (src/lib/division-rivals.ts) | games.homeTeamSlug/.awayTeamSlug for the opponent set; opponent teams.league/.division/.city/.name/.primaryColor | DISAPPEARS with no wrapper when gameContexts is empty (division-rivals.ts:18), which is every league without game docs; MLB and NFL only today |
| Schedule release video | ScheduleReleaseVideoCard.tsx | teams.scheduleReleaseVideo.{url,title,publishedAt,channel} | DISAPPEARS unless league is NFL and all four fields resolve (RedesignTeamPage.tsx:255; data.ts:90-105) |
| Playoff section | playoff-section.tsx | appConfig/playoffs.playoffsActive/.activeTeamIds/.eliminatedTeamIds/round fields; playoff promo docs | DISAPPEARS unless the team is alive in an active bracket and has playoff promos (RedesignTeamPage.tsx:262) |
| Promo list | promo-list.tsx, redesign/RedesignPromoRow.tsx, LazyPromoRows.tsx | teams/{id}/promos.date/.title/.description/.type/.time/.gameInfo/.isGiveaway/.highlight; venues.name | Whole list is REPLACED by ZeroPromoFallback when the team has no promos in any season (hasNoPromosAtAll, RedesignTeamPage.tsx:123). With past promos but none upcoming it stays, prints the empty-upcoming copy and renders the completed archive (Celtics: 31 words). Served HTML holds at most 10 upcoming rows plus 3 lifted completed rows; the rest is client-rendered behind show-all |
| Zero-promo fallback | zero-promo-fallback.tsx | teams.league (LEAGUE_COPY key), teams.city/.name; venues.name | Mounts only on the zero-promo branch; an unknown league FALLS BACK to the MLB paragraph (zero-promo-fallback.tsx:116), which is the trap for any CFB reuse |
| Affiliate rail CTAs | redesign/AffiliateRail.tsx, affiliates/*CTA.tsx, venue-hub/VenueHubLink.tsx | teams.id, .ticketmasterSlug, .ticketmasterAttractionId, .ticketNetworkSlug, .fanaticsUrl; venues.name/.lat/.lng for SpotHero and Expedia; venueHubs slug for the hub link | ALWAYS mounts; the ticket CTA always resolves a URL, SpotHero and Expedia drop without coordinates, the hub link drops without a verified venueHubs building |
| Venue block ("Game day" rows) | venue-info-block.tsx (inside AffiliateRail) | venues.gatesOpen, .parkingInfo, .publicTransit, .accessibility, .bagPolicyUrl, .nearby (plus src/lib/venue-overrides.ts for a few teams) | Whole block DISAPPEARS when venue is null. Gate-times row ALWAYS renders: the field when present, else a per-league static FALLBACK sentence (venue-info-block.tsx:34, :7-10). Every other row DISAPPEARS individually when its field is empty (Rams and Celtics: one row) |
| Explore card | redesign/ExploreCard.tsx | teams.league | ALWAYS mounts; five sitewide promo links plus "All {league} teams" |
| Email CTA | follow/FollowCTA.tsx | teams.id, .name, .city | ALWAYS mounts; generic copy FALLBACK without a team |
| App pitch | app-push-pitch.tsx | teams.league against APP_LEAGUES (MLB, NBA, NHL, MLS); teams.city/.name/.id | ALWAYS mounts; leagues outside APP_LEAGUES get the weekly-email card in the same slot |
| Authority stats | authority-stats.tsx | upcoming promos.date/.type/.isGiveaway; teams.league for the home-game table; venues.name | DISAPPEARS when fewer than 15 upcoming promos (authority-stats.tsx:41): 0 words on NYCFC, Rams and Celtics |
| Recurring deals | recurring-deals-section.tsx (src/lib/recurring-deals.ts) | teams/{id}/recurringDeals.title/.frequency/.description/.category; venues.name | DISAPPEARS when the subcollection is empty or tombstoned (recurring-deals-section.tsx:31); the " at {venue}" clause drops without a venue |
| Content sections (question H2s) | team-content-sections.tsx | upcomingCounts by type; top promos per type (title, date, opponent); teams.name/.city/.league; venues.name | The section never disappears. Giveaways, theme, food and kids blocks each DISAPPEAR when their type count is 0; the "How do I find" plug always renders (57 to 64 words, static) |
| Related aggregators | team-related-aggregators.tsx | upcoming promos.title/.description regex counts and .type | Never disappears; bobblehead, jersey and theme cards need 5, 3 and 5 matches; the "Hot promos this week" card is unconditional (14 words on a zero-promo page) |
| FAQ | team-faq.tsx (generateTeamFAQs, src/lib/promo-helpers.ts:311-538; gateTimesAnswer :289-306) | teams.name/.city/.league; upcoming promos.date/.type/.title; venues.name/.gatesOpen; coverage.teamCount; playoff context | Five answers are unconditional (track, directions, hotels, notifications, away games), a sixth (gates) on the six pro leagues; count, best-giveaway, food and kids questions each gate on data; a stale-count sensitive teamCount is threaded in |
| Affiliate disclosure | affiliates/AffiliateDisclosure.tsx | none | ALWAYS mounts, 22 words |

Four patterns matter for CFB: sections that DISAPPEAR cleanly (rivals, recurring, authority, video, playoffs), sections that always mount and fall back to static copy (hero, rail, email, app, explore, disclosure, FAQ, content plug, gate-times row), one EMPTY SHELL (the calendar on a no-games no-promos page), and one REPLACE (zero-promo fallback). Nothing on the pro page renders an empty heading over missing data except the calendar shell; the CFB matchup page's unconditional "The trophy" heading (sweep summary row 3) has no pro precedent.

## 4. Derived versus authored versus static

Split across the three primary pages (Mariners, NYCFC, Rams; 6,095 words):

| class | words | share |
|---|---|---|
| static template copy | 3,588 | 58.9% |
| derived from data at render time | 1,377 | 22.6% |
| stored field text | 1,130 | 18.5% |

Per page: Mariners 52 / 27 / 21; NYCFC 62 / 14 / 24; Rams 82 / 16 / 2; Celtics (supplementary) 91 / 9 / 0. The thinner the page, the more of it is template.

The stored 18.5% is not one thing. Splitting it by where the text comes from:

| stored text | Mariners | NYCFC | Rams | source |
|---|---|---|---|---|
| venue "Game day" rows (human-authored) | 111 | 115 | 0 | venues.parkingInfo, .publicTransit, .accessibility, .nearby, .gatesOpen |
| recurring deal cards (human-curated) | 22 | 0 | 0 | teams/{id}/recurringDeals |
| promo titles and descriptions in rows and panels (pipeline-extracted) | 645 | 221 | 16 | teams/{id}/promos.title, .description |
| total stored | 778 | 336 | 16 | |

So the answer to "how much of a pro page's depth is writing" is: human-written prose is 133 words on the richest page (3.6%), 115 on the mid page (8.1%), zero on the thin page. Everything else is template skeleton, values interpolated into templates, or promo text the scanner extracted from team sites. The pro template's depth is data volume, not authorship; the writing that does exist is the venue block.

Method caveats, stated so the ratio is not over-read: the skeleton estimate for the game panels moved the team and venue name tokens back from static to derived (37 on the Mariners, 2 on NYCFC, 0 on the Rams) but still counts repeated opponent names inside a series as static (a 3-game homestand repeats "vs Twins"), so panel static is high by roughly 5 to 10 percentage points; the promo-row split assumes 5 derived words per row (date chip and opponent); FAQ interpolations of promo titles are counted as derived because they enter through a sentence template; rows with no reference row anywhere (Mariners recurring deals, the kids block and kids FAQ) are estimated at the sibling ratio and marked.

## 5. Map to CFB

Status values: DATA EXISTS TODAY (collection.field, population from the Phase 0 report), EXISTS BUT DOES NOT RENDER (blocker named), ABSENT, NEEDS EXTRACTION, NO CFB EQUIVALENT (why). "CFB renders today" is what CfbSchoolPage.tsx already puts on the page.

| pro section (words, Mariners / Rams) | CFB equivalent | status | CFB renders today |
|---|---|---|---|
| Hero + stat scoreboard (23 / 24) | hero: kicker, name, mascot, conference, home/road/rivalry strip, venue facts | DATA EXISTS TODAY: cfbSchools name, mascot and conferenceBySeason are in the Phase 0 key union but not tabulated per doc (the template falls back to an empty string, CfbSchoolPage.tsx:50, :72), CFB_KICKERS 55 of 87 in code, cfbGames 670 for the strip, cfbVenues name/city 86, capacity 73 | Yes: CfbSchoolPage.tsx:85-144 (Tennessee hero 24 words plus venue facts) |
| Season explorer, visible grid (116 / 69) | schedule list | DATA EXISTS TODAY: cfbGames per school, 12 rows typical; 339 of 662 live games kickoff TBD | Yes: CfbSchedule.tsx rows (Tennessee schedule section 155 words) |
| Season explorer, SSR-hidden game panels (1,940 / 43) | per-game detail with date, opponent, venue, kickoff, TV, rivalry, trophy, ticket/parking/hotel CTAs | EXISTS BUT DOES NOT RENDER: the data is in cfbGames and cfbVenues; CfbSchedule.tsx is `'use client'` and renders CfbGameDetail only inside a Modal after a click (CfbSchedule.tsx:160-177), so nothing is in the HTML. Rams-style no-promo panels are 20 to 23 words each | No |
| Division rivals (38 / 35) | conference siblings grid | DATA EXISTS TODAY: conferenceBySeason['2026'] on 87 of 87; hub-data.ts:182-186 already buckets by conference | No grid; the rivalry section (CfbSchoolPage.tsx:304-372) is the neighbour: data-derived rivalry sentences plus cards (Tennessee 100 words) |
| Promo list (369 / 28) | none | NO CFB EQUIVALENT: no promo corpus; themeDesignations on 0 of 670 games | The schedule list is the list-shaped surface |
| Zero-promo fallback (0 / 0) | none | NO CFB EQUIVALENT, and reuse is a trap: LEAGUE_COPY has no CFB key and falls back to the MLB paragraph | The static schedule footnote and the contribute CTA play the evergreen role |
| Affiliate rail CTAs (38 / 38) | Plan your gameday CTAs | DATA EXISTS TODAY: same TicketmasterCTA/SpotHero/Expedia/Fanatics/VenueHubLink via toAffiliateTeam/toAffiliateVenue (page-extras.ts:82-128), CFB_FANATICS_STORES 86 entries | Yes: CfbSchoolPage.tsx:240-276 (42 words) |
| Venue block rows (148 / 12) | tailgating, parking, transit, gates, bag policy | ABSENT, NEEDS EXTRACTION: cfbVenues.parking/transit/gatesOpenRule/tailgating 0 of 86 (keys absent), humanConfirmed 0 of 86; no bagPolicyUrl, accessibility or nearby field exists on CfbVenue | Only the venue facts panel (name, city, capacity); no rows |
| Explore card (20 / 20) | rivalry guides rail | DATA EXISTS TODAY: cfbGames.rivalryId + MATCHUP_REGISTRY (32 slugs) | Yes: the rivalry rail nav (CfbSchoolPage.tsx:158-195) |
| Email CTA + app pitch (69 / 82) | none today | NO CFB EQUIVALENT as built: CAPTURE_SURFACES has no CFB value and APP_LEAGUES excludes CFB; the copy promises giveaways and theme nights. A CFB-worded email card would be static copy with no data dependency | The contribute CTA (29 words) occupies the slot |
| Authority stats (74 / 0) | schedule patterns: home/road split, conference games, kickoffs announced, primetime | DATA EXISTS TODAY: cfbGames date, homeSchoolId, neutralSite, conferenceGame, kickoff.tbd, broadcast.confirmed | No |
| Recurring deals (48 / 0) | traditions | ABSENT, NEEDS EXTRACTION: cfbTraditions 2 docs, 0 narratives, referenced by 0 schools; no loader reads the collection | No |
| Content sections, four promo blocks (224 / 42) | rivalry, schedule and venue question blocks | Promo blocks: NO CFB EQUIVALENT. Rivalry and schedule questions: DATA EXISTS TODAY (cfbRivalries 212 with name/trophy/seriesStartYear; cfbGames) | Partly: buildRivalrySentences (page-extras.ts:35-60) already renders one derived sentence per rivalry game |
| Content plug "How do I find" (57 / 64) | a CFB framing paragraph | Static copy; must respect the CFB framing rule (no promo vocabulary) | The schedule footnote (CfbSchoolPage.tsx:284) is the nearest |
| Related aggregators (32 / 14) | rivalries index link | DATA EXISTS TODAY: /cfb/rivalries and the hub | Yes, inside the rivalry rail ("All rivalries") |
| FAQ (526 / 423) | a CFB FAQ generator | DATA EXISTS TODAY for schedule, venue and rivalry questions (cfbGames, cfbVenues name/city/capacity, cfbRivalries); notifications and cadence questions must not be mirrored (app rule, no CFB cron) | No: the CFB page has no FAQ and its JSON-LD is a bare SportsTeam |
| Schedule release video (0 / 13), playoffs (0 / 0) | none | NO CFB EQUIVALENT: no field, no postseason concept in the five collections | No |
| Affiliate disclosure (22 / 22) | same component | EXISTS BUT DOES NOT RENDER: league-agnostic, needs no data, not mounted on any CFB route while five partner CTAs render | No |
| Editorial blocks (signature game, why you go, gameday culture, venue in their words) | the destination-page template | EXISTS BUT DOES NOT RENDER: the template is written (CfbSchoolPage.tsx:198-230, :291-297, :376-381) and gated on fields that data.ts:311 hardcodes to null | No; see section 6 |

## 6. The read-path blocker, data.ts:310

One line-number note first: in this worktree the hardcoded literal is on data.ts:311, under the two comment lines at :309-310; the handoff and the Phase 0 report cite :310 and refer to the same statement. The rest of this section says :311 for the literal.

What it is supposed to return. `getCfbSchoolPage` (src/lib/cfb/data.ts:245-312) builds the `CfbSchoolPage` object (data.ts:53-68): school, venue, games, editorialStatus, and an `editorial` block typed as `{ signatureGameId: string | null; traditions: unknown[]; gamedayCulture: string | null; whyYouGo: string | null; venueInTheirWords: string | null; contributor: { name; credit } | null }`. The comment at :58 says "Phase 4 populates; ONE template renders them only when present". Line 311 returns the literal `{ signatureGameId: null, traditions: [], gamedayCulture: null, whyYouGo: null, venueInTheirWords: null, contributor: null }` for every school, with the comment "Phase 4 populates these as a DATA change (no template change)". Those fields map one-to-one onto the editorial seeding template in audit/cfb-stream-build-spec.md section 6 (signature game and theme narratives, why you go, venue gameday prose, contributor credit); `traditions` has no defined shape yet (CfbSchoolPage.tsx:289 "Phase 4 TODO").

What consumes it. CfbSchoolPage.tsx:68 (signature game lookup), :198-230 (signature card and the "why you go" column), :291-297 (Gameday and Traditions section, gated solely on gamedayCulture), :376-381 (venue "in their words", gated on venue and the field), :398 (contributor credit line). `editorialStatus` is consumed separately: data.ts:308 passes `school.editorialStatus || 'auto'` and src/lib/cfb/metadata.ts:101 flips the meta description to the destination tier on `'destination'`, which promises "a gameday guide and tailgating" (sweep summary, item 18).

What exists to feed it. Nothing. The four collection loaders (data.ts:153-195, one TTL cache per collection at 21600s, shared with the matchup family through getCfbCorpus) read cfbSchools, cfbVenues, cfbRivalries and cfbGames; there is no loader for cfbTraditions. No field on cfbSchools carries prose. The venue prose fields exist in the type (types.ts:66-70) at 0 of 86; cfbRivalries.narrative is 0 of 212; cfbTraditions.narrative is 0 of 2. The contribute form writes drafts to `cfbContributions` (status pending-review) and quarantines to `cfbContributionsFlagged` (src/app/api/cfb/contribute/route.ts:24-27); only src/lib/cfb/notify.ts touches the queue, to email the owner. Nothing reads it back.

Scope of wiring it, as a list, not a plan:

1. A storage decision. Two viable shapes: an `editorial` map on the cfbSchools document, or a separate `cfbEditorial/{schoolId}` document. The separate document keeps the Phase 2 schedule writer's allowlist and wipe guard (src/lib/cfb/human-owned.ts, the cfb-field-drift and cfb-wipe-guard tests) out of the blast radius; a map on cfbSchools would need those guards extended so a rebuild cannot clear it.
2. Types: a `CfbEditorial` interface replacing the inline shape at data.ts:59-67, with `traditions` given a real shape or dropped until cfbTraditions is seeded, plus a `sources: string[]` field the spec's template asks for (paraphrase provenance).
3. Loader: either one more `makeCollectionLoader` plus a join in getCfbSchoolPage, or a per-school read; the literal at :310 becomes a lookup with the same null defaults so auto pages are byte-identical.
4. Gating that stays manual by rule: `editorialStatus` flips only when the blocks exist, because metadata.ts:101 follows the flag automatically and would otherwise ship the destination description over an auto page; venueInTheirWords over a venue with humanConfirmed false (0 of 86 today) is the spec's own "never trusted for a destination page" case; the index floor (8 games and a venue) is untouched.
5. Tests: the two guard tests need the new field or collection allowlisted; a render test that the null-default path is unchanged.
6. The review side does not exist: a reviewer today would move a cfbContributions draft into the editorial store by hand or by a script that is not written.

Four structural findings from the verified read-path pass that shape the storage decision: (a) the spec's template has two competing homes for venue gameday prose, `editorial.gamedayCulture` / `editorial.venueInTheirWords` on the page object and `cfbVenues.tailgating/parking/transit/gatesOpenRule` on the venue document (types.ts:66-70), and neither is wired; (b) the editorial block has no slot for a rivalry narrative even though `cfbRivalries.narrative` exists in the type (types.ts:175); (c) `colorsHumanConfirmed`, written false by scripts/cfb/run-phase2.ts:198, is not in the `CfbSchool` type at all, so the spec's colour sanity check has no typed home; (d) docs/cfb-phase2-decisions.md refers to a `cfb-editorial-template.md` fill-in brief that does not exist in the worktree. The rivalry rail also has a population fact worth carrying: it renders only for registry-backed rivalries, which the rivalry-rail.ts:27-30 comment puts at 41 of 86 schools.

Size: four to six files (types.ts, data.ts, human-owned.ts or a new loader, one seed/admin script, two test files), on the order of 100 to 150 lines, none of it template work. The template is already written; the read path is the only missing piece between the spec's Phase 4 and a rendered destination block.

## 7. Estimate

Base: the CFB school page today. Median 299 (Phase 0 report); Tennessee, a well-populated anchor, is 350: hero 24, Plan your gameday 42, schedule 155 (12 rows at roughly 13 words), rivalry section 100 (5 rivalry sentences plus cards), contribute CTA 29.

**Projection A, every section the substrate can render today** (data exists, no extraction, no editorial, template work only), sized from the measured pro sections:

| addition | pro evidence | CFB sizing | words |
|---|---|---|---|
| SSR per-game detail panels, hidden like the pro calendar | Rams no-promo panels 20 to 23 words; Mariners with promos 43 to 167 | 12 games x 25 to 35 (venue, kickoff or TBA, TV, rivalry or trophy, three CTAs) | 300 to 420 |
| FAQ generator | Celtics 6 unconditional answers 343 words; Rams 8 answers 423 | 6 to 8 questions x 45 to 55 (schedule count and home opener, rivalry game, venue city and capacity, tickets, hotels, parking, away games); no notifications, no cadence claims | 270 to 440 |
| Question-H2 blocks | pro blocks 42 to 88 words each | 3 blocks (rivals, home schedule, where they play) x 50 to 80 | 150 to 240 |
| Schedule-pattern stats | Authority stats 74 | home/road split, conference games, kickoffs announced, primetime count | 60 to 80 |
| Conference siblings grid | Division rivals 35 to 38 | same shape | 35 to 40 |
| Affiliate disclosure | 22 everywhere | mount the existing component | 22 |
| total added | | | 837 to 1,242 |

Projected page: **1,140 to 1,540 words** from the 299 median (1,190 to 1,590 from a Tennessee-like base). Above the 1,000 line only if the hidden panels count; without them the additions are 537 to 822 and the page lands at **840 to 1,120**, straddling the line, and most schools sit in the lower half of that band because kickoff-TBA rows shorten the schedule text.

Assumptions: template shares as measured on the pro pages (roughly 60% static); no data beyond what the Phase 0 report counts; washington-state stays below the index floor; the crawler counts `hidden` subtrees the way the repo's script does (unverified, see section 2); every question and block respects the CFB framing rule and the no-unbacked-claims rule, which removes the two FAQ questions and the cadence sentence that carry the pro FAQ's easiest static words.

**Projection B, adding venue logistics extraction** (parking, transit, gate rule, tailgating, bag policy at the pro venue block's measured lengths of 21 to 34 words per row, plus the venue FAQ answers gaining specific text):

| addition | words |
|---|---|
| venue rows, 5 x 22 to 32 | 110 to 160 |
| venue FAQ answers with real content instead of template-only | 20 to 40 |
| total | 130 to 200 |

Projected page: **1,270 to 1,740 with the hidden panels, 970 to 1,320 without.** Against the line: B clears 1,000 in both readings for most schools; A clears it only in the hidden-panel reading. Against today: both are 3 to 5 times the 299 median.

What the pro anatomy says about the line itself: the pro template does not reach 1,000 words on a page without promos either. The Rams (929) and the Celtics (673) are the same template with the same FAQ, venue block, rail and cards, and they are under the line; the Mariners clear it on 1,940 hidden panel words and 369 promo rows. A CFB page built as a faithful mirror inherits the thin-page number, roughly 900 to 1,100, unless it also inherits the one thing the mirror cannot give it, a promo corpus, or replaces that volume with the two things only CFB has: rivalry content (the 212 rivalry docs, 46 schools with a matchup page) and, once extracted, venue logistics. Human-authored prose is under 4% of the richest pro page; the 1,000-word CFB page is a data and template problem first and a writing problem second.

Measurement artefacts: word counts and attribution in /private/tmp scratch (attr_*.json, tables.md); the section dependency map and CFB mapping were produced by a read-only workflow over the worktree (three finders, one verifier each, one read-path agent); the verifiers corrected line numbers throughout (the FAQ generator range, the GameExpand references, the venue-hub index floor lines) and two substantive claims (mascot/conference population is not tabulated; the editorial literal is on :311), all folded in above; the workflow's full text is not committed. The per-school CFB numbers are in audit/cfb-phase0-report.md; the template defects are in audit/cfb-phase0-sweep-summary.md.
