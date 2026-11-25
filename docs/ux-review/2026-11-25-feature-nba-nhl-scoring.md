# ux-review: feature/nba-nhl-scoring (baseline mode against production)

Run date: 2026-11-25 (America/New_York), about 09:45 to 10:35 ET.
Pages: `/` (home), `/best-promos`, `/team-rankings`, each at 390x844, 768x1024 and 1280x800.

## Run conditions

- **Branch side: a local dev build fed dry-run scores, not a deployed preview.** `http://localhost:3100` is `next dev` (Next 15.5.15) running from the scratch worktree `/private/tmp/pn-wt/web-scoring-preview`: branch `feature/nba-nhl-scoring` at `6b2cde0` plus one uncommitted shim (`src/lib/dev-score-overlay.ts`, wired into `src/lib/data.ts`) that lays the pipeline's dry-run NBA and NHL scores over the live promo rows. It shows the state the site reaches after the scores are written. The dev server carries no `promonight-deploy` meta.
- **Production side:** `https://www.getpromonight.com`, `promonight-deploy` = `dpl_7FiidXwyPgvHEdC6pfXk8cpzKRUk` on all three pages, today's data on old code. The branch contains all of `origin/main` (`7905626`); it is 5 commits ahead.
- Playwright (Chromium) with a desktop Chrome User-Agent, timezone America/New_York. Layout measurements were taken with the ad script blocked; the ad-slot section was a separate run with ads on (two passes).
- Screenshots and diff images are outside the repo, under `/private/tmp/claude-501/-Users-mattkovalik-promonight-web/676ea55e-f348-4c03-b169-739a63237614/scratchpad/uxr2/` (called `$E` below). Scripts are in the sibling `uxr2s/` directory.
- **What was reviewed is commit `6b2cde0` plus the shim, nothing later.** During the run (about 10:00 ET) another session left uncommitted edits in `/private/tmp/pn-wt/web-scoring`: `src/app/best-promos/bobbleheads/page.tsx` (stamp and capsule now say "MLB, MLS or WNBA" and "the three leagues this page covers"), `src/lib/scoring-weights.ts` (the "Which leagues are ranked?" answer and the `/team-rankings` NBA and NHL answer reworded), `src/lib/data.ts` (NHL and NBA ticket-package rows left out of the scored read), two test files and `docs/known-issues.md`. The preview worktree that serves localhost:3100 does not have them, so none of them is in any render, quote or measurement below. They bear on D2, D3 and D11.
- **One check could not be completed on the branch render.** Every promo page on the preview server answers HTTP 500, caused by the uncommitted shim, not by the branch (see A1). Card destinations were therefore verified against production's copies of the same URLs.

## 1. Baseline differences (branch against production)

### 1.1 Served HTML of the main content

| Page | Identical | Differing regions |
|---|---|---|
| `/` | No | Only the Best Promos rail. Production: 3 cards (Audi 2026 MLS Cup Playoffs, Whitecaps, Nov 27; same title, Whitecaps, Dec 2; 2026 Audi MLS Cup Playoffs - Match 3, Chicago Fire, Dec 2), category chip "Theme Nights". Branch: 8 cards (listed in 3a), chip "Giveaways", "HOT" badge on all 8. Eyebrow, heading, lede and "Full rankings" link are byte-identical. Every other section of `<main>` is identical. |
| `/best-promos` | No | Nearly all of it. Title and H1 "Best Sports Promo Nights of 2026" become "... of 2026-27"; eyebrow "Best of 2026" becomes "Best of 2026-27"; stamp "Last updated November 24, 2026 · 3 promos ranked" becomes "Last updated November 25, 2026 · 192 promos ranked"; intro names five leagues and the 65 floor; league chips gain NBA and NHL; 3 MLS theme rows become 50 server-rendered rows (192 in total) with three inline question blocks; FAQ: "Why are NBA and NHL not included?" is replaced by "Which leagues are ranked?", and four other answers are reworded (how promos are ranked, what scores 100, how often it updates, bobblehead-only). |
| `/team-rankings` | No, one line | The answer to "Why are NBA and NHL not on this ranking?". Production: "The scoring layer rolled out for MLB, MLS, and WNBA first. NBA and NHL promo data exists in PromoNight but has not yet been processed through the structured-extraction pipeline this ranking depends on. Those leagues will join in a future release." Branch: "NBA and NHL promos are scored, and the best of them are ranked on the best promos page. Their teams are not ranked yet. An NBA or NHL season runs across two calendar years, and the team score, which weighs a schedule against a single season of home games, is not calibrated for that." The other 1,495 normalised lines are identical. |

Outside `<main>`, on all three pages: the footer's "Events" link (`/events`) is present on production and absent on the dev server (artifact, see A2). On `/`, the "Get the week's giveaways in your inbox" link carries `source=web_other` on production and `source=web_homepage` on the dev server (see P9).

### 1.2 Pixel comparison (ads blocked)

| Page | Width | Production size | Branch size | Differing pixels | Where | Diff image |
|---|---|---|---|---|---|---|
| `/` | 390 | 390x11379 | 390x11337 | 308,349 (6.95%) | Rail cards, then everything below shifted by 7px; Find Your Team order; footer | `$E/home/390-diff.png`, aligned `$E/home/390-diff-aligned.png` |
| `/` | 768 | 768x8173 | 768x8131 | 370,784 (5.91%) | Same | `$E/home/768-diff.png`, `$E/home/768-diff-aligned.png` |
| `/` | 1280 | 1280x6863 | 1280x6822 | 427,740 (4.87%) | Same | `$E/home/1280-diff.png`, `$E/home/1280-diff-aligned.png` |
| `/best-promos` | 390 | 390x4599 | 390x20490 | 1,296,659 | Whole page from the eyebrow down (expected) | `$E/best-promos/390-diff.png` |
| `/best-promos` | 768 | 768x3217 | 768x17090 | 1,182,575 | Same | `$E/best-promos/768-diff.png` |
| `/best-promos` | 1280 | 1280x3169 | 1280x16956 | 1,660,081 | Same | `$E/best-promos/1280-diff.png` |
| `/team-rankings` | 390 | 390x9447 | 390x9436 | 62,150 (1.69%) | Nothing above y 7489. The reworded FAQ answer (6 lines against 5, +23px), then the shifted FAQ and footer | `$E/team-rankings/390-diff.png` |
| `/team-rankings` | 768 | 768x7918 | 768x7884 | 35,836 (0.59%) | Nothing above y 6939 (the FAQ answer), then footer | `$E/team-rankings/768-diff.png` |
| `/team-rankings` | 1280 | 1280x7802 | 1280x7791 | 93,473 (0.94%) | Nothing above y 6892 (the FAQ answer), then footer | `$E/team-rankings/1280-diff.png` |

With the rail rows cut from both home renders (the "aligned" images), the remaining differences are three things, none from the branch: Find Your Team leads with six Minnesota clubs on production and with Braves, Orioles, Bulls on the dev server (geo ordering, A4; `$E/crops/home-390-findteam-side.png`), the footer is 34px shorter on the dev server (A2), and a band near y 2056 (390) where the sticky header is painted mid-page by the full-page capture (capture artifact, both environments).

### 1.3 Measurements that moved

| Measurement | Production | Branch |
|---|---|---|
| Rail card count | 3 | 8 |
| Rail card height | 228 (the "Theme Nights" chip wraps to two lines) | 220 |
| Rail section height 390 / 768 / 1280 | 416 / 390 / 390 | 409 / 382 / 382 |
| Rail scroller scrollWidth | 870 | 2340 |
| Home document height 390 / 768 / 1280 | 11379 / 8173 / 6863 | 11337 / 8131 / 6822 (rail 7 or 8px shorter, footer 34px shorter) |
| Home interactive elements (390) | 126 | 140 |
| Home hit sizes under 44 (390, outside header and footer) | 59 | 69 (5 more cards: Tickets button and star each) |
| Home `<a>` to `/promos/` DOM / visible (390) | 50 / 32 | 55 / 37 |
| Home axe color-contrast nodes | 7 | 14 (the extra rank watermarks, see P3) |
| `/best-promos` rows | 3 | 192 (50 rendered, then 50, 50, 42) |
| `/best-promos` document height 390 / 768 / 1280 | 4599 / 3217 / 3169 | 20490 / 17090 / 16956 |
| `/best-promos` CLS (390) | 0.0044 | 0.0161 |
| `/best-promos` interactive elements (390) | 41 | 182 |
| `/best-promos` axe color-contrast / label-content-name-mismatch | 5 / 3 | 72 / 50 (per-card defects multiplied by the row count, P4 and P5) |
| `/best-promos` league chips | All, MLB, MLS, WNBA | All, MLB, MLS, WNBA, NBA, NHL |
| `/team-rankings` FAQ answer at 390 | 5 lines, 114px | 6 lines, 137px |
| `/team-rankings` ranked rows | 75 | 75, same hrefs, same order, same scores |

Unchanged between the two: no horizontal page overflow anywhere (`scrollWidth` equals `clientWidth` on all 18 renders), home CLS (0.0249 / 0.0007 / 0.0004), `/team-rankings` CLS, first ad anchor position, content ad counts and the last-slot gap (section 3h).

## 2. Game date check (mandatory)

Today in America/New_York: **2026-11-25**.

| Surface | Dates read | Verdict |
|---|---|---|
| Home rail, branch (8 cards) | Card spines Dec 1, Dec 5, Jan 5, Jan 13, Jan 15, Jan 23, Jan 27, Jan 31. Years confirmed from the `/best-promos` ItemList JSON-LD on the branch and from the production promo pages' Event `startDate`: 2026-12-01, 2026-12-05, 2027-01-05, 2027-01-13, 2027-01-15, 2027-01-23, 2027-01-27, 2027-01-31 (the Kraken page also lists 2027-03-21) | All after today. No played game. |
| Home rail, production (3 cards) | Nov 27, Dec 2, Dec 2 | All after today. The Whitecaps promo page behind cards 1 and 2 also lists 2026-11-22, a played date, beside its two upcoming ones; not every date is past, so it is not a played page. |
| `/best-promos`, branch | 192 rows (all loaded), 2026-11-25 to 2027-04-11, weekday on each card checked against the calendar. ItemList JSON-LD: 50 `startDate` values, 2026-11-27 to 2027-02-20 | 0 rows before today. 4 rows are today's games (Wild 7:00 PM, Red Wings 7:30 PM, Lightning 7:00 PM, 76ers), none started at review time. They will read as upcoming with ticket buttons until the date rolls (known issue 125). |
| `/best-promos`, production | 3 rows, 2026-11-27 to 2026-12-02 | All after today. |
| `/team-rankings` | No game dates, no Event JSON-LD | Not applicable. |

Verdict: no page under review is a played game. Reported as working under section 4.

## 3. Homepage rail checks

### 3a. Eight cards, ranks 1 to 8, giveaways only: YES at 390, 768 and 1280

Same eight cards at every width. Every chip reads "Giveaways"; no theme, kids or food card; no MLS playoff fixture. All eight carry the "HOT" badge. Evidence: `$E/home/rail-390-branch.png`, `$E/home/rail-768-branch.png`, `$E/home/rail-1280-branch.png`, `$E/home/rail-scrolled-end-1280-branch.png`.

| Rank | Title as rendered | Team line | League | Date | Time on card |
|---|---|---|---|---|---|
| 01 | Fred VanVleet Bobblehead | Houston Rockets vs Raptors | NBA | Dec 1 | none |
| 02 | Ryan O'Reilly Bobblehead | Nashville Predators vs Colu... (Columbus Blue Jackets) | NHL | Dec 5 | 1:00 PM |
| 03 | Cutter Gauthier Bobblehea... (Cutter Gauthier Bobblehead Giveaway) | Anaheim Ducks vs Wild | NHL | Jan 5 | 7:00 PM |
| 04 | Jalen Johnson Bobblehead | Atlanta Hawks vs Cavaliers | NBA | Jan 13 | none |
| 05 | Dunkstronaut Bobblehead | Houston Rockets vs Wizards | NBA | Jan 15 | none |
| 06 | Evgeni Malkin Talking... (Evgeni Malkin Talking Bobblehead) | Pittsburgh Penguins vs Can... (Canucks) | NHL | Jan 23 | 7:00 PM |
| 07 | Neemias Queta Bobblehead | Boston Celtics vs Clippers | NBA | Jan 27 | none |
| 08 | Bobblehead | Seattle Kraken vs Devils | NHL | Jan 31 | 1:00 PM |

The league column is derived from the card's link; the card itself shows no league (3c). All eight score 98 on `/best-promos`; the order is the date tiebreak.

### 3b. Every card is an unplayed game: YES

See section 2. Earliest card is 2026-12-01, six days out.

### 3c. Card content: PARTLY

- Team name, date, category chip: legible, not clipped, at all three widths. YES.
- **Long titles: NO for two of eight.** The title clamps at 3 lines (81px). Card 03 measures 109px of text in 81 and renders "Cutter Gauthier Bobblehea..."; card 06 measures 109 in 81 and renders "Evgeni Malkin Talking...", which drops the word "Bobblehead" altogether (D1). "Stephen Curry Mini Bobblehead Blind Box" is rank 10 today and not on the rail; at this card width it would also clamp.
- **Rank watermark against text: collides on three of eight.** The watermark box (65x52 at x 196, y 47 inside the 274px card, 10% opacity in the team color) intersects the title's glyph boxes on cards 02 ("Reilly"), 05 ("Dunkstronaut") and 08 ("Bobblehead"). The title stays readable through it. Production's three cards all collide the same way (P3). Evidence: `$E/home/rail-1280-branch.png`, `$E/home/rail-scrolled-end-1280-branch.png`.
- **NBA and NHL team colors: YES.** Spines render Rockets `#ce1141`, Predators `#ffb81c` (dark ink on the date), Ducks `#f47a38` (dark ink), Hawks `#e03a3e`, Penguins `#211d18` (the house-ink fallback for a black primary), Celtics `#007a33`, Kraken `#001628`. Date ink flips correctly on the two light spines.
- **League chips: there is none to render.** The ticket-stub card has no league badge on either environment. The league is only inferable from the team name (P10).
- Team line truncation is clean (ellipsis) on cards 02 and 06; it removes the opponent's name.

### 3d. Horizontal scroll and snap: YES; page overflow: none

| Width | Rail clientWidth / scrollWidth | Snap | Rest positions after scrolling by 150, 300, 500 | Page scrollWidth / clientWidth |
|---|---|---|---|---|
| 390 | 342 / 2340 | `x mandatory`, `scroll-snap-align: start` | 298, 592, 1180 (each a card boundary: 4 + 294n) | 390 / 390 |
| 768 | 720 / 2340 | same | 298, 592, 1180 | 768 / 768 |
| 1280 | 1232 / 2340 | same | 298, 592, 1108 (end) | 1280 / 1280 |

Evidence: `$E/home/rail-scrolled-a-390-branch.png`, `$E/home/rail-scrolled-b-768-branch.png`. At 1280 the rail now overflows too, which production's three cards never did (D5).

### 3e. Tapping a card: NOT VERIFIABLE on the branch render (A1); the mechanics are right

| Card | What the tap does | Destination on the preview server | Same URL on production | Back |
|---|---|---|---|---|
| 01, NBA (Fred VanVleet Bobblehead), 390 / 768 / 1280 | Navigates to a promo page, no modal: `/nba/houston-rockets/promos/fred-vanvleet-bobblehead` | HTTP 500, H1 "SOMETHING WENT WRONG" (`$E/home/dest-card1-390-branch.png`) | 200, H1 "Fred VanVleet Bobblehead", `startDate` 2026-12-01, "Tuesday, Dec 1, 2026" | scrollY 2081 before, 2081 after (0px); 1910 / 1910 at 768; 1777 / 1777 at 1280 |
| 02, NHL (Ryan O'Reilly Bobblehead), all three widths | Navigates to `/nhl/nashville-predators/promos/ryan-o-reilly-bobblehead` | HTTP 500 (`$E/home/dest-card2-390-branch.png`) | 200, H1 "Ryan O'Reilly Bobblehead", `startDate` 2026-12-05, "Saturday, Dec 5, 2026 · 1:00 PM CT" | vertical 0px at all widths; the rail's horizontal position went from 298 back to 4 (P2) |
| 06, NHL (Evgeni Malkin Talking Bobblehead), 390 | Navigates to `/nhl/pittsburgh-penguins/promos/evgeni-malkin-talking-bobblehead` | HTTP 500 (`$E/home/dest-card6-390-branch.png`) | 200, H1 "Evgeni Malkin Talking Bobblehead", `startDate` 2027-01-23 | vertical 0px; rail 1474 back to 4 |

All eight rail URLs answer 200 on production with an H1 equal to the card title. Production's own card 1 (Whitecaps) opens its promo page with a matching H1 and returns to scrollY 2085 exactly. The card's "Tickets" button opens the tickets dialog without leaving the page on both environments (`$E/home/tickets-modal-390-branch.png`): Ticketmaster and TicketNetwork buttons, "View full schedule" to `/nba/houston-rockets`; closes on Escape.

The branch diff does not touch the promo page or the card component, so a matching destination is the expected result, but it has not been seen on a branch render in this run.

### 3f. "Full rankings" goes to `/best-promos`, same promos, same order: YES at all three widths

Lands on `/best-promos`, H1 "BEST SPORTS PROMO NIGHTS OF 2026-27". Rows 1 to 8 there carry the same eight hrefs in the same order as the rail, all at 98; rows 9 and 10 are Jayson Tatum Bobblehead and Stephen Curry Mini Bobblehead Blind Box. Back returns to the same scroll position (0px).

### 3g. Spacing above and below the rail: SAME as production

| Width | Gap above (last painted pixel of This Week to the rail eyebrow) | Gap below (card bottom to the next section's eyebrow) | Section padding |
|---|---|---|---|
| 390 | production 80, branch 80 | production 81, branch 81 | 16 / 16 on both |
| 768 | 80 / 80 | 81 / 81 | 16 / 16 |
| 1280 | 80 / 80 | 81 / 81 | 16 / 16 |

The section itself is 7 or 8px shorter on the branch because no chip wraps. Side by side: `$E/crops/home-390-rail-side.png` (production left, branch right).

### 3h. Ad slots: counts and the last-slot gap MATCH production at all three widths

Two passes with ads on; both gave the same counts.

| Width | Content slots, production | Content slots, branch | Below-post slot | Gap from the last content slot's bottom to the below-post slot's top, production | Same, branch |
|---|---|---|---|---|---|
| 390 | 9 | 9 | 1 on both | 10px (Content_9 follows the FAQ and sits directly above the below-post slot) | 10px |
| 768 | 6 | 6 | 1 on both | 10px (Content_6 follows the FAQ) | 10px |
| 1280 | 5 | 5 | 1 on both | 1019px (Content_5 sits above the FAQ, the below-post slot after it) | 1019px |

Slot order in `.page-content` is identical on both environments at each width; at 390 one content slot sits directly above the rail and one directly below it. So with the rail present again, 390 is back to 9 content ads and the 1280 layout no longer has a content slot 10px above the below-post slot. Note that at 390 and 768 the last content slot and the below-post slot are 10px apart on production as well (P8). On the dev server every slot stayed at its 250px placeholder height; production filled several at 300 to 408px (A5). Evidence: `$E/home/390-branch-ads.png`, `$E/home/390-production-ads.png`, and the 768 and 1280 equivalents.

## 4. Things that work

1. **The rail rule holds and the rail and the list agree.** Eight giveaway cards, ranks 1 to 8, all unplayed, and "Full rankings" lands on a page whose first eight rows are the same promos in the same order. The three-MLS-fixtures mismatch on production is gone.
2. **`/best-promos` filters, deep links and paging.** NBA gives 112 rows, all NBA; NHL gives 80, all NHL; MLB, MLS and WNBA give a clean empty card, not a broken list; Next 30 days gives 43 rows (2026-11-25 to 2026-12-23), Next 90 days 121, Rest of season 192; `?league=NHL&range=30d` loads with both chips pressed and 22 NHL rows; "Show 50 more" goes 50, 100, 150, 192 with the label counting down (142, 92, 42 remaining) and no scroll jump. No row before today, every row has a ticket button and a link to its promo page, and the list is in non-increasing score order (98 down to 65).
3. **`/team-rankings` is untouched apart from the one answer.** 75 rows, same hrefs, order and scores as production; chips are All, MLB, MLS, WNBA only; the reworded answer wraps to 6 lines at 390 with no overflow (`$E/team-rankings/faq-390-branch.png`).
4. **Game date check ran: no played game on any page** (section 2).
5. **Back navigation restores the vertical scroll position exactly** (0px) from every card tap and from "Full rankings", on both environments.
6. **No horizontal page overflow** on any of the 18 renders, including the long 192-row list at 390; the stamp line (2 lines at 390) and the intro (9 lines) wrap inside their boxes; the inline question blocks sit after cards 15, 30 and 45 with 32px above and below at every width, before and after loading more (`$E/crops/bp-390-branch-inline1.png`).

## 5. Defects

Severity: High = a fan is misled or loses the point of the element; Medium = confusing or degraded; Low = cosmetic or minor.

### Introduced by the branch, or first visible with the branch and scores

| ID | Severity | Viewport | Defect | Evidence |
|---|---|---|---|---|
| D1 | High | 390, 768, 1280 | Rail titles of four lines lose their end. Card 06 reads "Evgeni Malkin Talking..." with the word "Bobblehead" gone, so the card never says what the giveaway is; card 03 reads "Cutter Gauthier Bobblehea...". The 3-line clamp is the existing card (production's "2026 Audi MLS Cup Playoffs - Match 3" clamps too), but these are the first cards where the clamp removes the item. | `$E/home/rail-scrolled-end-1280-branch.png`, `$E/home/rail-scrolled-a-390-branch.png` |
| D2 | High | all | `/best-promos` sends a fan to a page that contradicts it. Directly under the intro, "See the bobblehead-only ranking" (and the FAQ's "Can I see only bobblehead nights?") point to `/best-promos/bobbleheads`, which on the same preview server is titled "Best Bobblehead Nights of 2026" and says "no ranked bobbleheads ahead" and "none of the three leagues we score has a ranked bobblehead still to come". The page the fan just left lists 74 upcoming rows with "bobble" in the title, its top 20 are all bobbleheads, and its FAQ says five leagues are scored. Known issue 126 defers the bobblehead page's threshold; the contradiction itself ships with this branch. The uncommitted rewording noted in the run conditions narrows the two sentences to MLB, MLS and WNBA; it was not rendered here, and it leaves the fan on a bobblehead page with none of the bobbleheads they came from. | `$E/crops/bp-390-branch-top.png`; served text of `/best-promos/bobbleheads` on localhost:3100 |
| D3 | Medium | all | The same game is ranked twice. Nashville, Feb 18: "Music City Billy Strings Bobblehead" (98) and "Billy Strings Bobblehead" (95) are separate rows that link to the same promo page; the second row has no category chip. Logged as "Unflagged package twin" in known issue 127; it is visible on the list. | `/best-promos?range=season` on the preview, rows for FEB 18 THU |
| D4 | Medium | all | The intro says the nights "are ranked below from 100 down". The top score is 98 (20 rows at 98, none at 100), and the first inline block asks "What gives a promo a perfect 100 score?" on a list with no 100. Production carries the same sentence over a list that tops out at 18, so the phrase predates the branch; it is still false on the page this branch ships. | `$E/crops/bp-390-branch-top.png` |
| D5 | Medium | 1280 | The rail gives a mouse user no way to see cards 5 to 8 that looks like one. At rest four cards are whole, the fifth is cut at the right edge, three are hidden; there are no arrows and the scrollbar is hidden (`scrollbar-width: none`); a vertical wheel over the rail scrolls the page. A horizontal wheel or trackpad swipe does scroll it (0 to 592) and keyboard focus brings a card into view. The Tonight rail has the same shell on production; this rail never overflowed at 1280 with three cards. | `$E/home/rail-1280-branch.png` |
| D6 | Medium | all | Rail card 08 is titled only "Bobblehead" (Seattle Kraken, Jan 31), under a HOT badge, ranked with the best eight. Its promo page covers two dates (2027-01-31 and 2027-03-21). The full list has the same pattern for Montreal ("Bobblehead Night", four dates, one page, 88 each) and Anaheim ("T-Shirt Giveaway", 76). Logged as "Bare item titles" in known issue 127; this is where a fan meets it. | `$E/home/rail-scrolled-end-1280-branch.png` |
| D7 | Medium | all | No game time on the four NBA rail cards (01, 04, 05, 07); the four NHL cards have one. The NBA rows on `/best-promos` and the production promo pages for those games show a date only as well, so a fan cannot find the tip-off time anywhere on the path. A data gap, not markup; new on this rail. | `$E/home/rail-1280-branch.png` |
| D8 | Low | all | Three of six league chips are dead ends: MLB, MLS and WNBA return 0 rows in every date range. The empty state says "Try a wider date range or a different league" even when Rest of season is already selected. Production today has the same for MLB and WNBA. | `$E/best-promos/empty-mlb-scrolled-390-branch.png` |
| D9 | Low | all | The meta description says "Bobbleheads, jerseys, and theme nights ranked 0 to 100"; the list admits giveaways only, and no theme night appears on it. | served HTML of `/best-promos` on the preview |
| D10 | Low | all | 15 of the 50 `SportsEvent` entries in the ItemList JSON-LD have no `location` (for example the Celtics row). Production's 3 of 3 have one. Logged in known issue 127. | served HTML of `/best-promos` on the preview |
| D11 | Low | all | The reworded `/team-rankings` answer says the best NBA and NHL promos "are ranked on the best promos page" in plain text; the page it names is not linked from the answer. | `$E/team-rankings/faq-390-branch.png` |

### Pre-existing (present on production too)

| ID | Severity | Viewport | Defect | Evidence |
|---|---|---|---|---|
| P1 | Medium | 390 mainly | Hit sizes under 44x44. Rail: Tickets button 92x26, team star 20x20, "Full rankings" 122x20. `/best-promos`: every filter chip is 32px tall (the new NBA 63x32 and NHL 61x32 included), "Get Tickets" 308x43 (48 of them on the branch against 3), breadcrumb "Home" 33x16, "See the bobblehead-only ranking" 35px tall. `/team-rankings`: the four chips and the breadcrumb. The tickets dialog's Close button is 36x36. Listed as P1 to P10 in the 2026-11-25 stopgap report and deferred in known issue 127. | measurements table |
| P2 | Low | 390, 768 | Back from a rail card returns the rail to card 1: horizontal position 298 before, 4 after on production; 1474 before, 4 after for card 06 on the branch. Vertical position is restored. With eight cards the walk back to card 6 is five swipes. | walk results |
| P3 | Low | all | The rank watermark overlaps the title text (all three production cards; cards 02, 05, 08 on the branch) and is what axe counts as the extra color-contrast nodes on the home page (7 on production, 14 on the branch). It is `aria-hidden` and decorative; the title stays readable. | `$E/home/rail-390-production.png`, `$E/home/rail-1280-branch.png` |
| P4 | Medium | all | Text contrast under 4.5:1. Home: "NIGHT" in the logo 4.33 (`#da2d20` on `#f7f3ea`), "See all" 4.33, league chips set in raw team color on a tint in Find Your Team ("NHL" in Predators gold 1.65, "MLB" 2.87 and 3.75, "NBA" 4.11), "Never miss a promo night" 4.43, "Download for iOS" 3.76. `/best-promos`: the logo, "See the bobblehead-only ranking" 4.33, the "Get tickets" eyebrow 3.76 (`#ef4444` on white, once per card, so 50 on the branch against 3), score pills for 85 and 88 at 4.36 (`#d31145` on `#fae2e9`; this tier does not occur on production's three rows but is the same pill `/team-rankings` already shows). `/team-rankings`: the logo and ten score pills at 4.36, identical on both. | measurements table |
| P5 | Low | all | axe `label-content-name-mismatch` on the Ticketmaster button of every ranked card (3 on production, 50 on the branch). | axe results |
| P6 | Low | all | The stamp says "192 promos ranked" and the count line under the chips says "121 promos match this filter", because the default range is 90 days. The intro also says 192. A fan reads two totals 300px apart. | `$E/crops/bp-390-branch-top.png` |
| P7 | Low | all | Same-day rows (4 today) keep their ticket buttons until the date rolls, including after the game has been played tonight (known issue 125). | `$E/best-promos/filter-nhl30-scrolled-390-branch.png` |
| P8 | Low | 390, 768 | After the FAQ the last content ad slot and the below-post slot are 10px apart, two ad boxes back to back. Same on production. | `$E/home/390-production-ads.png` |
| P9 | Low | all | On production the homepage's "Get the week's giveaways in your inbox" link carries `source=web_other`, in the served HTML and after hydration; the dev render gives `web_homepage`. Not from this diff. | served HTML of `/` on both |
| P10 | Low | all | The rail card shows no league. It was not needed while the rail held one league; it now mixes NBA and NHL. | `$E/home/rail-1280-branch.png` |

### Artifacts of the local dev build (not defects of the branch)

| ID | What | Cause |
|---|---|---|
| A1 | **Every promo page answers HTTP 500 on the preview server** ("Something went wrong"), so tapping any rail card or any `/best-promos` row title dead-ends there. | The uncommitted shim: `mapPromoDoc` in the preview's `src/lib/data.ts:121` reads `doc.ref.path`, and `src/lib/promo-pages.ts:133` calls `mapPromoDoc` with a plain `{ id, data }` object that has no `ref` (`TypeError: Cannot read properties of undefined (reading 'path')` in the dev log). The committed branch does not change `mapPromoDoc`. This blocks check 3e on the branch render. |
| A2 | Footer has no "Events" link; documents are 34px shorter. | `EVENTS_PAGES_LIVE` is not set in the preview's environment. |
| A3 | Ticketmaster buttons link straight to `www.ticketmaster.com/...` instead of `ticketmaster.evyy.net/c/...`. TicketNetwork links are wrapped as on production (one hop to `www.ojrq.net`). | `NEXT_PUBLIC_TICKETMASTER_IMPACT_WRAP` is not set in the preview's environment. |
| A4 | Find Your Team lists Braves, Orioles, Bulls first; production lists six Minnesota clubs first. | Geo ordering; the local server has no visitor location. |
| A5 | Ad slots stay at their 250px placeholder height. | Unfilled on localhost. |
| A6 | Stamp reads "Last updated November 25, 2026". | The overlay's `scoredAt`; the real value will be the scoring run's date. |
| A7 | No `promonight-deploy` meta. | Dev server. |

## 6. `/best-promos` checks, answered

| Check | Result |
|---|---|
| Title, H1 and intro agree on "2026-27" | Yes: title "Best Sports Promo Nights of 2026-27: Score-Ranked Giveaways", H1 and eyebrow "2026-27", intro "giveaway nights of 2026-27", meta description and Article JSON-LD headline also "2026-27". |
| Chips All, MLB, MLS, WNBA, NBA, NHL | Yes, in that order. At 390 they wrap to two rows (NBA and NHL on the second). |
| Each filters correctly | NBA 112 rows all NBA, NHL 80 all NHL, MLB / MLS / WNBA 0 with the empty state. The pressed chip, the count line and the URL (`?league=NBA`) all follow. |
| Date-range chips | 30 days: 43; 90 days (default): 121; rest of season: 192. Row dates fall inside each window. |
| Empty state | "No scored promos match this filter. Try a wider date range or a different league." Centered card, 342x154 at 390, no affiliate disclosure and no inline blocks under it. Reads sensibly except at Rest of season (D8). |
| Stamp and intro at 390 | Stamp 2 lines, intro 9 lines, H1 3 lines; nothing clipped; `scrollWidth` equals `clientWidth` on each. |
| Horizontal overflow | None at any width, in any filter state. |
| Ticket buttons only on unplayed games; no played game | 192 of 192 rows have ticket buttons; 0 rows are before today. 187 rows have both partners; 5 Ontario rows (Senators, Raptors) have Ticketmaster only. |
| Inline question blocks | After cards 15, 30, 45; 32px above and below; headings 2 lines at 390 and 768, 1 at 1280; unchanged after loading more. |
| Load more past 50 | Works: 50, 100, 150, 192; button 307x46. |

## 7. Measurements

390 unless noted. CLS, axe and contrast were measured with ads blocked.

| Measurement | `/` production | `/` branch | `/best-promos` production | `/best-promos` branch | `/team-rankings` production | `/team-rankings` branch |
|---|---|---|---|---|---|---|
| Page scrollWidth / clientWidth | 390 / 390 | 390 / 390 | 390 / 390 | 390 / 390 | 390 / 390 | 390 / 390 |
| Same at 768 and 1280 | equal | equal | equal | equal | equal | equal |
| Document height | 11379 | 11337 | 4599 | 20490 | 9447 | 9436 |
| CLS 390 / 768 / 1280 | 0.0249 / 0.0007 / 0.0004 | 0.0249 / 0.0007 / 0.0004 | 0.0044 / 0.0015 / 0.0010 | 0.0161 / 0.0016 / 0.0011 | 0.0000 / 0.0018 / 0.0012 | 0.0000 / 0.0018 / 0.0012 |
| Interactive elements | 126 | 140 | 41 | 182 | 103 | 102 |
| Hit size under 44x44, all / outside header and footer | 82 / 59 | 91 / 69 | 35 / 12 | 81 / 59 | 28 / 5 | 27 / 5 |
| Distinct failing-contrast text styles | 12 | 23 (11 are rank watermarks and spine dates on a gradient, which the color check cannot read) | 3 | 5 | 11 | 11 |
| axe serious or critical | color-contrast 7 | color-contrast 14 | color-contrast 5, label-content-name-mismatch 3 | color-contrast 72, label-content-name-mismatch 50 | color-contrast 16 | color-contrast 16 |
| `<a>` to `/promos/` in DOM / visibly rendered | 50 / 32 | 55 / 37 | 11 / 9 | 58 / 56 | 8 / 6 | 8 / 6 |
| First ad anchor from document top (`data-ad-region="content"`) | 57 | 57 | none on the page | none | none | none |
| First content ad slot from document top (ads on) | 2265 | 2265 | n/a | n/a | n/a | n/a |
| Content ad slots 390 / 768 / 1280 | 9 / 6 / 5 | 9 / 6 / 5 | n/a | n/a | n/a | n/a |
| Last content slot to below-post slot 390 / 768 / 1280 | 10 / 10 / 1019 | 10 / 10 / 1019 | n/a | n/a | n/a | n/a |
| Page errors in the console | 0 | 0 | 0 | 0 | 0 | 0 |

Fan walk, home: date and time are on each card (time missing on NBA cards, D7); the venue is not on the card and is reached through the promo page; the primary CTA "See today's promos" (200x44) goes to `/promos/today`, H1 "Sports Promos Today", same host, on both environments.

## 8. Recommendation

Do not merge on this report alone: fix the preview shim so promo pages render (A1), then rerun check 3e on the branch, because a card tap is the rail's whole purpose and it has not been seen working on a branch render. Of the branch's own findings, D2 is the one to settle before the scores are written: the day they land, `/best-promos` will list 192 upcoming NBA and NHL giveaways and link, in its second paragraph, to a bobblehead page that says nothing is upcoming. D1 (the clamp removing "Bobblehead" from a rail card) and D4 (the "from 100 down" sentence) are each one decision. D3, D6, D7 and D10 are data items already listed in known issue 127 and need either a waiver written here or a fix.

## Disposition (added by the build session, 2026-11-25)

The review rendered `6b2cde0` plus the local score overlay. The commit that carries this report holds the fixes below.

- **Check (e), card tap.** The 500 on promo pages came from the local overlay shim, which is not in the branch. With the shim repaired, the eight rail card hrefs were fetched from the local preview: each answers 200 and its H1 matches the card title (served HTML, not a browser run). Scroll restoration on back was measured by the review at 0px vertical.
- **D1, deferred.** Known-issues 127, "Rail card titles". The clamp belongs to a card shared with the Tonight rail, so a type-size change needs its own review. Owner decision.
- **D2, narrowed, decision open.** `/best-promos/bobbleheads` now says "none of the three leagues this page covers" and its stamp reads "no ranked MLB, MLS or WNBA bobbleheads ahead", so it no longer claims those are the only leagues scored. It still shows a 2026 record while `/best-promos` lists upcoming NBA and NHL bobbleheads. Widening that page to five leagues is outside this branch by ruling (known-issues 126) and is put to the owner at Gate C.
- **D3, D6, D10, waived for this branch.** Data items recorded in known-issues 127 (unflagged package twin, bare "Bobblehead" titles, missing JSON-LD location on six NBA clubs).
- **D4, fixed.** The upcoming intro reads "ranked below, highest score first", not "from 100 down".
- **D5, deferred.** Known-issues 127, "Rail at 1280". Same build as the Tonight rail.
- **D7, D8, deferred.** Known-issues 127 (NBA game times; empty league chips).
- **D9, fixed.** In upcoming mode the meta description says "Bobbleheads, jerseys, and other giveaways".
- **D11, waived.** FAQ answers are plain strings on every page; no FAQ answer carries a link.
- **P1 to P10.** Pre-existing on production, not touched.
- **Ad slots.** With the rail present the content-slot counts (9 / 6 / 5) and the last-slot gap match production at all three widths.

Screenshots are outside the repository, in the session scratchpad.
