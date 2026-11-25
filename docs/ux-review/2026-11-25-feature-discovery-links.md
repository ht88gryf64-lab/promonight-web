# ux-review: feature/discovery-links, 2026-11-25

Baseline mode. Branch `feature/discovery-links` at `b5c53e2` beside production `https://www.getpromonight.com`.

## Run conditions

- **The branch side is a local dev build fed dry-run scores, not a deployed preview.** It is `next dev` on `http://localhost:3100`, started by the caller from `/private/tmp/pn-wt/web-scoring-preview`: commit `b5c53e2` plus one uncommitted shim (`src/lib/dev-score-overlay.ts` and two lines in `src/lib/data.ts`) that lays the pipeline's dry-run NBA and NHL scores over the live promo rows, with `EVENTS_PAGES_LIVE=true`. It shows the state the site reaches after those scores are written. I did not start or stop it.
- Production deploy: `<meta name="promonight-deploy" content="dpl_7FiidXwyPgvHEdC6pfXk8cpzKRUk">`. The dev server HTML carries no such meta. Production is today's data on old code: `origin/main` is `7905626`, and the branch also carries `feature/best-promos-stopgap` and `feature/nba-nhl-scoring`, which are not in production, so their effects (the 8-card Best Promos rail, the upcoming bobblehead list) show up in the differences below alongside this branch's own.
- Today in America/New_York: 2026-11-25 (Wednesday). Renders ran 09:29 to 09:52 CST.
- Playwright (Chromium), desktop Chrome User-Agent, viewports 390x844, 768x1024, 1280x800. Measurement renders ran with the ad scripts blocked so pixels compare; `/nba` and `/nhl` were rendered a second time with ads on for the slot count and order.
- **Uncommitted edits appeared in `/private/tmp/pn-wt/web-discovery` during the run, between 09:40 and 09:42 CST** (18 tracked files modified plus a new `src/components/hub/HubPromoLink.tsx`; they touch `BrandBar.tsx`, `HubThisWeek.tsx`, `HubTodayPromos.tsx`, `stub-title.ts`, `hub-rail.ts`, `bobbleheads/page.tsx`, `cfb/metadata.ts`, `RivalryMatchupPage.tsx`, tests and docs). **They are not in my renders.** The server's worktree was still `b5c53e2` plus the shim when checked at 09:44. Every finding below describes `b5c53e2`. Some of those edits look aimed at findings in this report (an Events breakpoint in the header, the stub title tiers, the bobblehead answers); none of them has been rendered or verified here.
- Dev-server instability seen once: the first two requests to `/nhl/minnesota-wild` answered 500 (`TypeError: __webpack_modules__[moduleId] is not a function` in the server log, while another client was compiling other routes), then 200 on every later request. Treated as a dev-build artifact; every render used below was a 200 on the first try.
- Screenshots, diff images and crops are outside the repo, in `/private/tmp/claude-501/-Users-mattkovalik-promonight-web/676ea55e-f348-4c03-b169-739a63237614/scratchpad/uxr3/`. Per page: `<slug>/<viewport>-branch.png`, `<viewport>-production.png`, `<viewport>-diff.png` (full page), `<viewport>-<env>-fold.png` (above the fold). Slugs: `nba`, `nhl`, `mlb`, `home`, `best-promos-bobbleheads`, `team-wild`, `venue-target-center`, `cfb-paul-bunyans-axe`, `cfb-florida-georgia`. Crops are in `crops/`, tap screenshots in `walk/`.

## 1. Baseline differences

### Served HTML of the main content (normalised: scripts, nonces, build hashes, deploy id and flight payload stripped)

| Page | `<main>` | `<header>` |
|---|---|---|
| /mlb | **identical** (1,209 lines each) | 2 regions: the Events link in the desktop bar and in the menu sheet |
| /cfb/rivalries/florida-georgia | **identical** | same 2 Events regions |
| /venues/target-center | 2 regions, both the same Ticketmaster link: production wraps it (`ticketmaster.evyy.net/...`), the dev build serves the bare `www.ticketmaster.com/minnesota-lynx-tickets/...` URL. Dev artifact. | same 2 |
| /nhl/minnesota-wild | 14 regions: 12 are the same unwrapped Ticketmaster link; 2 are "Missed it? Check resale on eBay" links present on production and absent locally. Dev artifacts (no affiliate env locally). No other text differs. | same 2 |
| /cfb/rivalries/paul-bunyans-axe | 3 regions, all the H1: production `<h1>Paul Bunyan's Axe 2026</h1><p>Minnesota vs Wisconsin</p>`; branch one `<h1 class="flex flex-col-reverse">` holding the matchup span (with a screen-reader-only ": ") then the name span. The "vs" span padding went from `px-2` to `px-1` plus literal spaces. | same 2 |
| /nba | 62 regions: Today cards' hrefs (3), the whole This week rail (new card structure, "Showing 8 of 13 teams", 8 teams in place of 8 rows) | same 2 |
| /nhl | 62 regions: Today cards' hrefs (12), the This week rail ("Showing 8 of 21 teams") | same 2 |
| / | Text differs only inside the Best Promos rail: production 3 cards (Audi 2026 MLS Cup Playoffs x2, 2026 Audi MLS Cup Playoffs - Match 3); branch 8 bobblehead cards (Fred VanVleet, Ryan O'Reilly, Cutter Gauthier, Jalen Johnson, Dunkstronaut, Evgeni Malkin Talking, Neemias Queta, "Bobblehead"). Two Tonight titles change class only (size tier). | same 2 |
| /best-promos/bobbleheads | 674 regions: different list (production 280 past rows from MLB, MLS, WNBA; branch 76 upcoming rows from NBA and NHL), title, H1, eyebrow, stamp, intro, chips. | same 2 |

Title tags that moved: `/cfb/rivalries/paul-bunyans-axe` "Paul Bunyan's Axe 2026 | PromoNight" to "Minnesota vs Wisconsin: Paul Bunyan's Axe 2026 | PromoNight"; `/best-promos/bobbleheads` "Best Bobblehead Nights of 2026: Ranked by Score | PromoNight" to "Best Bobblehead Nights of 2026-27: Ranked by Score | PromoNight". Florida-Georgia's title is unchanged ("Florida vs Georgia 2026 | PromoNight").

### Pixel comparison (ads blocked; differing pixels and the y bands that hold them)

| Page | 390 | 768 | 1280 |
|---|---|---|---|
| /mlb | 0 px | 3,435 px, y 1 to 55 (header only) | 658 px, y 22 to 32 (header only) |
| /venues/target-center | 0 px | 3,435 px, header only | 658 px, header only |
| /cfb/rivalries/florida-georgia | 0 px | 3,435 px, header only | 658 px, header only |
| /cfb/rivalries/paul-bunyans-axe | 153 px, y 150 to 164 (the "vs Wisconsin" text, 0.7px to the right) | 3,588 px: header plus the same 153 | 811 px: header plus the same 153 |
| /nhl/minnesota-wild | 0 px above y 4,803; below it everything is shifted 96px by the two missing eBay links (dev artifact) | header, then the same shift from y 4,228 | header, then the same shift from y 3,166 |
| /nba | 16.9%, from y 1,050 (the This week rail) to the end; page 604px taller | 20.3%: header, then from y 913; page 517px taller | 19.8%: header, then from y 856; 516px taller |
| /nhl | 15.0%, from y 2,186; 573px taller | 17.9%: header, then from y 1,431; 742px taller | 17.4%: header, then from y 1,374; 741px taller |
| / | 6.6%: the Best Promos rail (y 2,420 to 2,646), then everything below shifted 8px up | 5.5%: header, Tonight card 2 (y 897 to 971), Best Promos rail, then the 8px shift | 4.4%: header, Tonight cards 2 and 4, rail, shift |
| /best-promos/bobbleheads | 18.7%, whole page (different list); 1,460px shorter | 11.5%; 600px shorter | 9.5%; 583px shorter |

At 390 the header is pixel-identical on every page (wordmark plus hamburger). The hubs and the homepage have no horizontal overflow on either side at any width with ads blocked (`scrollWidth` equals `clientWidth`: 390, 768, 1280).

### Measurements that moved

- Hub page height: see the table above; the This week rail grew on both hubs at every width (section 4, h6).
- Hub interactive elements at 390: /nba 134 (production 116); /nhl 144 (127). Hit targets under 44x44 at 390: /nba 90 (64); /nhl 89 (64). The additions are the new team, promo title and "more promo days" links (h4).
- `<a>` to `/promos/` in the DOM versus visible at 390: /nba 29/27 (production 13/11); /nhl 38/36 (13/11); / 55/37 (50/32); bobbleheads 57/55 (58/56). The two hidden on every page are the desktop bar and the closed menu sheet.
- CLS at 390: bobbleheads 0.0593 (production 0.0294). Every other page within 0.001 of production (hubs 0.027, homepage 0.025, team 0, venue 0.0006, rivalry 0).
- Header at 768: three items wrap on the branch (section 3, D2).
- Homepage Best Promos card height: 220.3 (production 227.8). Explained under r3: it is the category chip, not the title.
- Homepage contrast failures listed at 390: 23 (production 12). The 11 extra are 8 decorative rank numerals behind the new rail cards, the white date text my script cannot resolve over the spine's gradient, and two league chips in "Find your team", whose order differs by geo (dev artifact).
- axe serious or critical at 390: hubs unchanged (`color-contrast` 13 on /nba and 11 on /nhl, `label-content-name-mismatch` 62 and 66, both sides). Homepage `color-contrast` 15 nodes (production 8; the 7 extra are the rank numerals on the 5 extra cards and the chips above). Bobbleheads `color-contrast` 74 nodes (production 51).

## 2. Game date check

Today is 2026-11-25 in America/New_York. No page under review states a building zone except the rivalry pages (CT and ET on their kickoff lines).

| Page | Dates read | Verdict |
|---|---|---|
| /cfb/rivalries/florida-georgia (both sides) | Game line "Oct 31, Saturday, 3:30 PM ET"; JSON-LD SportsEvent `startDate` 2026-10-31T15:30:00-04:00 | **Played game, 25 days ago. Defect D1.** |
| /best-promos/bobbleheads, production | 50 ItemList `startDate`s, 2026-03-28 to 2026-08-19; row dates all past | **Every date is past. Production says so in words and still sells tickets. Defect D1b (production only).** |
| /best-promos/bobbleheads, branch | 49 ItemList `startDate`s, 2026-11-27 to 2027-02-20; all 76 rows dated 2026-11-27 or later | Upcoming. Pass. |
| /cfb/rivalries/paul-bunyans-axe | "Nov 27, Friday, 6:30 PM CT"; `startDate` 2026-11-27T18:30:00-06:00 | Upcoming (2 days). Pass. |
| /nba, /nhl | No Event JSON-LD. Today cards are dated today (earliest start 5:00 PM, not yet begun at render time); rail days Nov 25 to Nov 29 | Not past. Pass. |
| /mlb | No dated game on the page ("No MLB promos today") | Nothing to check. |
| / | No Event JSON-LD. Tonight rail NOV 25; This week Nov 27 to 29; Best Promos Dec 1 to Jan 31 (branch), Nov 27 to Dec 2 (production) | Not past. Pass. |
| /nhl/minnesota-wild | Event `startDate`s 2026-11-25, 11-27, 12-12, 12-22 | Not all past. Pass. The page also carries a past-promos section, by design. |
| /venues/target-center | No Event JSON-LD; `<time>` 2026-12-16, 2027-01-20, 2027-01-29 | Upcoming. Pass. |

## 3. Three things that work

1. **The hub links do what the branch says, and the browser's back button holds its place.** Real taps at 390 (touch context): on /nba the first This week title "Warriors Cup Games Shirt" went to `/nba/golden-state-warriors/promos/warriors-cup-games-shirt` (200, H1 "WARRIORS CUP GAMES SHIRT", no error screen); back restored scrollY 814 to 814. From the Today card: same page, 200, scrollY 0 to 0. On /nhl "Sabres Salt and Pepper Shakers": 200, H1 matches, scrollY 1,950 to 1,950; "Thanksgiving Eve" (second promo in the same card): 200, H1 matches, 2,012 to 2,012. Team name taps landed on `/nba/golden-state-warriors` (H1 "GOLDEN STATE WARRIORS", 753 to 753) and `/nhl/buffalo-sabres` (1,889 to 1,889). Every link in both sections was also fetched: /nhl 25 of 25 answer 200 with an H1 equal to the link text; /nba 16 of 16 answer 200 and 13 of 16 match (the 3 that do not are D4).
2. **One card per team, and the count is honest.** /nba: 8 cards, 8 distinct teams, "Showing 8 of 13 teams" under the heading, hero "13 teams with a promo this week". /nhl: 8 cards, 8 teams, "Showing 8 of 21 teams", hero 21. Same at 390, 768 and 1280.
3. **The rivalry H1 change is invisible on screen.** /cfb/rivalries/paul-bunyans-axe: one `<h1>`, `textContent` exactly "Minnesota vs Wisconsin: Paul Bunyan's Axe 2026"; the hero region differs from production by 153 pixels of 608,400 at 390 (0.025%), all in one 117x15 box where "vs Wisconsin" sits 0.7px further right. The name line is the same box at every width (34px at 390, 48px at 768 and 1280), Minnesota is still a link to `/cfb/minnesota` in rgb(255,183,30) and Wisconsin to `/cfb/wisconsin` in rgb(250,71,78). Florida-Georgia is byte-identical in `<main>` and pixel-identical below the header.

Also working, for the record: the game date check ran on every page (section 2); /mlb is identical to production apart from the header; the menu sheet at 390 lists Events in order and the tap closes it; "Evgeni Malkin Talking Bobblehead" and "Cutter Gauthier Bobblehead Giveaway" print whole; the bobblehead chips, date ranges, deep link and "Show 26 more" all work; the ItemList on the branch's bobblehead page declares 49 items and the default view serves 49 cards.

## 4. Check by check

### Hubs

**h1. Today cards link to promo pages, not fragments: YES.** /nba: 3 cards, 3 promo-page hrefs, 0 fragments (production: 3 fragments such as `/nba/golden-state-warriors#promo-2026-11-25-warriors-cup-games-shirt`). /nhl: 12 cards, 12 promo-page hrefs, 0 fragments (production: 12 fragments). Same counts at 390, 768, 1280. One caveat, D4: on /nba two of the three cards share one href.

**h2. One card per team, count line matches the hero stat: YES.**

| Hub | Cards | Teams (promos listed in the card) | Count line | Hero stat |
|---|---|---|---|---|
| /nba | 8 | Golden State Warriors (1), Philadelphia 76ers (2), Detroit Pistons (3), Charlotte Hornets (2), Chicago Bulls (1), Houston Rockets (1), Cleveland Cavaliers (2), Memphis Grizzlies (1) | Showing 8 of 13 teams | 13 teams with a promo this week |
| /nhl | 8 | Buffalo Sabres (2), Columbus Blue Jackets (1), Detroit Red Wings (2), Minnesota Wild (1), Pittsburgh Penguins (2), Tampa Bay Lightning (2), Washington Capitals (2), Anaheim Ducks (1) | Showing 8 of 21 teams | 21 teams with a promo this week |

Production for comparison: /nba 8 cards from 4 teams (Warriors 1, 76ers 2, Pistons 3, Hornets 2); /nhl 8 cards from 5 teams, all on Wednesday.

**h3. Card layout: YES with two cosmetic notes (D6).** No overlap and no clipping in any card at any width (`scrollHeight` equals `clientHeight` on all 16 cards). The 3-promo card (Pistons) is intact at 404.5px tall. No live title wraps today (the longest, "Thanksgiving Salt & Pepper Shakers", is 266px in a 300px column at 390); with a long title injected into the DOM it wraps to three lines inside the card and pushes the rest down cleanly (`crops/nba-390-branch-long-title-injected.png`). At 768 and 1280 the grid is two columns (352px and 544px) and card tops in a row are equal (for example /nba y 1,006 for Warriors and 76ers). Chips are 20.5px tall and the "Hot" flag is centred on its chip in all 6 cards that carry one. Notes: paired cards of different promo counts end with their ticket blocks at different heights and dead space under the shorter one, and 2 of 5 rows on each hub hold a single card.

**h4. Hit targets: promo title links PASS the 24px line exactly; the team name link and the "more promo days" link FAIL it (D5).**

| Element | Rendered size (all widths) | Under 24px tall | Nearest neighbour |
|---|---|---|---|
| Promo title link | 82 to 266 wide x 24 tall | no (exactly 24, from `min-h-[24px]`) | 38 to 39px to the next title link in the same card (the chip row sits between) |
| Team name link | 83 to 141 wide x **14 tall** | **yes** | 42px above the first title link |
| "N more promo days this week" link | 166 to 173 wide x **19.5 tall** | **yes** | 12px below the last title link |
| Ticket buttons | 300 x 44.5 and 300 x 43 at 390 | n/a (43 is under the 44 rule; same on production) | 8.5px apart |

No two adjacent links are closer than 8px. On production the whole card top was one 340x114 link.

**h5. Real taps: YES.** Detailed under "things that work". All destinations 200, real pages, scroll restored exactly (delta 0 in all 8 taps). The "more promo days" link also lands on the team page (848 to 848 on /nba, 2,046 to 2,046 on /nhl). Screenshots: `walk/nba-390-branch-tap-thisweek1.png`, `walk/nba-390-branch-tap-thisweek-multi2.png`, `walk/nba-390-branch-tap-today1.png`, `walk/nba-390-branch-tap-team.png`, and the same four under `walk/nhl-390-branch-*`. The one tap that did not land on a page titled as tapped is "76ers Cup Games" (D4).

**h6. Height, CLS, overflow, ads.**

| | /nba 390 | /nba 768 | /nba 1280 | /nhl 390 | /nhl 768 | /nhl 1280 |
|---|---|---|---|---|---|---|
| Page height, branch (production) | 11,190 (10,586) | 6,685 (6,168) | 6,112 (5,596) | 12,318 (11,745) | 7,654 (6,912) | 6,987 (6,246) |
| This week rail height, branch (production) | 3,156 (2,552) | 2,173 (1,656) | 2,156 (1,640) | 3,035 (2,463) | 2,021 (1,280) | 2,005 (1,263) |
| Rail change | **+604** | **+517** | **+516** | **+573** | **+742** | **+741** |
| CLS, branch (production) | 0.0271 (0.0271) | 0.0012 (0.0009) | 0.0006 (0.0005) | 0.0270 (0.0270) | 0.0012 (0.0009) | 0.0006 (0.0005) |
| scrollWidth / clientWidth, branch | 390 / 390 | 768 / 768 | 1280 / 1280 | 390 / 390 | 768 / 768 | 1280 / 1280 |
| Ad anchors (`data-ad-region`, `data-ad-item`), branch and production | 4 and 4, same order | 4 and 4 | 4 and 4 | 4 and 4 | 4 and 4 | 4 and 4 |

The rail is **taller, not shorter**, at every width on both hubs: eight team cards with up to three promos each, more date groups, and at 768 and up more half-empty rows than production's eight single-promo cards. The first three ad anchors are at the same y on both sides (/nba 390: 57, 561, 1,022); the fourth, the section after the rail, moves down by the rail's growth (3,638 to 4,242 on /nba 390; 4,684 to 5,257 on /nhl 390). Ads-on results are in the measurements table.

**h7. /mlb identical to production apart from the header: YES.** `<main>` identical; 0 differing pixels at 390; at 768 and 1280 the only differing band is the header. "No MLB promos today" and no This week rail on both sides, as expected.

### Header

**n1. One line at 1280: YES. One line at 768: NO (D2).**

| | Branch | Production |
|---|---|---|
| Bar height, 768 and 1280 | 57 (56 plus border) | 57 |
| Items at 1280 | PROMONIGHT, Today, Teams, My Teams, Events, About, League hubs, Get the App; all on one line, link tops equal | same without Events |
| Gap, last nav link (About) to League hubs | 24.0 at both widths | 24.0 |
| Free space in the bar at 1280 (wordmark to first link, beyond the 16px gap) | 320.8 | 401.7 |
| Free space in the bar at 768 | **0.0, and 63px short** | 17.7 |
| Items that wrap at 768 | **"My Teams" (2 lines, 36px), "League hubs" (2 lines, 36px, chevron pushed off the label), "Get the App" (2 lines, a 55px button in a 56px bar)** | none |
| Narrowest width at which nothing wraps | **832** | 768 |

Exactly what breaks at 768: the natural width of the bar's contents is 831px (wordmark 131.8, five links 276 plus four 24px gaps, League hubs 118.4, Get the App 97, two more 24px gaps, the 16px gap and 48px of padding). The bar does not grow or scroll; flex shrinks the multi-word items until they wrap. Nothing is clipped or pushed out (`scrollWidth` 768), and nothing overlaps, but three of eight items are two lines and the red button touches the top and bottom of the bar. The same on the homepage, the team page, the venue page and the hubs, since it is one component. It holds from 768 through 831, which covers the iPad portrait widths 768, 810 and 820; 834 fits with 2.8px to spare. Evidence: `crops/header-768-home-team-venue-hub-branch-then-production.png`, `crops/header-mlb-768-branch-over-production.png`, `crops/header-810-branch.png`, `crops/header-820-branch.png`; 1280: `crops/header-1280-home-team-venue-hub-branch-then-production.png`.

**n2. 390: YES.** The bar is wordmark plus hamburger, pixel-identical to production. The sheet lists, in order: Today, Teams, My Teams, **Events**, About; then League hubs (MLB, WNBA, MLS, NBA, NHL, NFL, College football); then Get the App. Rows are 312x47 (league rows 312x54). Tapping Events reached `/events` (200, H1 "EVENTS AT VENUES WE COVER"), the sheet closed and `aria-expanded` returned to false. `walk/menu-sheet-390-branch.png`, `walk/events-after-menu-tap-390-branch.png`. Production's sheet has no Events row.

**n3. Desktop bar: YES.** Clicking Events at 768 and at 1280 reached `/events` (200). The League hubs dropdown still opens with its seven hubs at both widths and causes no overflow. `/events` is also live on production today (200, same H1), so the link has somewhere to go on deploy.

**n4. Playoffs and World Cup.** Neither link is present right now on either side. Estimate, made by inserting stand-in links with the bar's own classes before About and measuring (a simulation, not the real components):

| Bar contents | Branch: narrowest width that fits | Production: narrowest width that fits |
|---|---|---|
| as rendered today | 832 | 768 |
| plus Playoffs | 930 | 848 |
| plus World Cup | 942 | 860 |
| plus both | **1,038** | 958 |

So with Events and both seasonal links the bar does not fit at 768 (it does not fit at 768 with Events alone), and it does not fit at 1024 either, where four items wrap (`crops/header-sim-playoffs-worldcup-1024-branch.png`). It fits at 1280 with 114px to spare. Production already wraps at 768 whenever either seasonal link is on; that part is pre-existing.

### Homepage rails

**r1. Best Promos rail, all 8 whole with no ellipsis: YES.** Same at 390, 768 and 1280 (the cards are a fixed 274px).

| # | Title | Font size | Lines | Clamped | Mid-word break |
|---|---|---|---|---|---|
| 01 | Fred VanVleet Bobblehead | 27px | 3 | no | no |
| 02 | Ryan O'Reilly Bobblehead | 27px | 2 | no | no |
| 03 | Cutter Gauthier Bobblehead Giveaway | **19px** | 3 | no | no |
| 04 | Jalen Johnson Bobblehead | 27px | 3 | no | no |
| 05 | Dunkstronaut Bobblehead | 27px | 2 | no | no |
| 06 | Evgeni Malkin Talking Bobblehead | **22px** | 3 | no | no |
| 07 | Neemias Queta Bobblehead | 27px | 3 | no | no |
| 08 | Bobblehead | 27px | 1 | no | no |

`home/rail-best-promos-1280-branch-0.png`, `home/rail-best-promos-1280-branch-1.png`; one card per image at 390 in `home/rail-best-promos-390-branch-0.png` to `-7.png`.

**r2. Tonight rail: PARTLY. One title that fit at 27px was stepped down anyway (D3).**

| Title | Production | Branch | Did it fit before? | Reads |
|---|---|---|---|---|
| 76ers Cup Games Rally Towel | 27px, 3 lines | 27px, 3 lines | yes | unchanged |
| **Thanksgiving Salt & Pepper Shakers** | **27px, 3 lines, whole, not clamped** | **22px, 3 lines** | **yes** | **worse: same words, same line breaks, smaller for no gain** |
| Warriors Cup Games Shirt | 27px, 2 lines | 27px, 2 lines | yes | unchanged |
| Native American Heritage Night Hat | 27px, cut to "Native American Heritage..." | **19px, 2 lines**, whole | no | better (the item, "Hat", is back), but two sizes smaller than it needs: it uses 40 of the 81px title block |
| 76ers Cup Games | 27px, 2 lines | same | yes | unchanged |
| Bug Keeper Hats | 27px, 2 lines | same | yes | unchanged |
| Sabres Salt and Pepper Shakers | 27px, 3 lines | same | yes | unchanged |
| Thanksgiving Eve | 27px, 2 lines | same | yes | unchanged |

`home/rail-tonight-1280-branch-0.png` beside `home/rail-tonight-1280-production-0.png`.

**r3. Card heights equal across each rail: YES. Equal to production's: YES for Tonight, and the Best Promos difference is not the title.** Tonight: all 8 cards 227.8 on both sides. Best Promos: all 8 cards 220.3 on the branch; production's 3 cards are 227.8. Measured with the rail's stretch turned off, a card's natural height is 220.3 (or 218.8) whatever its title size, and 227.8 only when its category chip reads "THEME NIGHTS", which wraps to two lines (35px against 21.5). Tonight has two theme-night cards, production's Best Promos rail is three of them, and the branch's Best Promos rail is all giveaways. The title block is 81px at every size tier. So the tiers do not change card height.

### /best-promos/bobbleheads

**b1. "2026-27" and five leagues agree everywhere: YES.** Title "Best Bobblehead Nights of 2026-27: Ranked by Score | PromoNight"; H1 "BEST BOBBLEHEAD NIGHTS OF 2026-27"; eyebrow "BOBBLEHEADS OF 2026-27"; stamp "LAST UPDATED NOVEMBER 25, 2026 · 76 BOBBLEHEADS RANKED"; intro "The 76 top-scored bobblehead giveaways of 2026-27 are ranked below across MLB, MLS, WNBA, NBA, and NHL. ..."; meta description "Bobblehead giveaways across MLB, MLS, WNBA, NBA, and NHL in 2026-27, ranked 0 to 100 ..."; og:title and the Article JSON-LD say the same. Two notes: the H1 breaks badly at 390 (D7a), and the list holds only two of the five leagues named (D7c).

**b2. Chips: YES, all work.** League chips in order All, MLB, MLS, WNBA, NBA, NHL. NBA: 30 rows, every row "· NBA", URL `?league=NBA`. NHL: 19 rows, every row "· NHL". All: 49. MLB, MLS and WNBA each: 0 rows and "No scored promos match this filter. Try a wider date range or a different league." Date range: Next 30 days 18; Next 90 days (default) 49; Rest of season 76, with 50 shown and a "SHOW 26 MORE · 26 REMAINING" button (298x46) that takes the list to 76 and then disappears, without moving the scroll position. Combined: NHL plus Rest of season 29, NBA plus Rest of season 47 (29 + 47 = 76). The deep link `?league=NHL&range=season` opens with both chips pressed and 29 rows. Identical at 390, 768 and 1280. Tapping a row ("Dunkstronaut Bobblehead") reached its promo page (H1 matches) and back restored the scroll (1,859 to 1,859). Chips are 32px tall, under the 44 rule, as on production.

**b3. Every row a bobblehead giveaway for a game not yet played, no theme night: NO, 3 of 76 rows (D7b).** All 76 rows are dated 2026-11-27 or later, all carry the BOBBLEHEAD item tag and a ticket block, and none carries the Theme Nights chip. But: row 32 "Billy Strings Bobblehead" (Predators, Feb 18) carries the **Ticket Package** chip, is in the default view, and duplicates row 11 "Music City Billy Strings Bobblehead" for the same game and the same promo page; row 72 "Eastern Conference Finals Mystery Box" (Nets, Mar 15) and row 76 "Fan Appreciation Night" (Suns, Apr 9) are giveaway rows whose titles are not bobbleheads (Rest of season view only).

**b4. FAQ and inline answers, read against a list that is 47 NBA and 29 NHL rows with no MLB, MLS or WNBA row (D8).**

| Block | Verdict | Why |
|---|---|---|
| Inline after row 15: "Why do WNBA bobbleheads score so high?" | **Odd** | No WNBA row is on the page. The mechanism described (small caps score higher) is true of the list: the 98s are capped at 5,000 to 10,000. The heading is about a league the fan cannot find here. |
| Inline after row 30: "What separates a 98 score from a 100?" | **Odd** | No row scores 100 on this list. Scores present: 98 (20 rows), 95 (19), 88 (25), 85 (11), 83 (1). The text is accurate as scoring rules. |
| Inline after row 45: "How are recurring bobbleheads tracked?" | **False in part, and jargon** | "The team-rankings page rolls those individual scores into a single average via the averagePromoScore field." The team rankings do not cover NBA or NHL teams, which are every team on this list, and "averagePromoScore field" is a database field name. |
| FAQ 1: highest-rated bobblehead giveaways | Fine | Generic and true of the list. |
| FAQ 2: "Which MLB team gives away the most bobbleheads?" | **Odd** | "The live list above sorts by score so the best-rated entries from any team surface first": the list above has no MLB team. The Diamondbacks, Cubs and Braves claim is a point-in-time fact with no source on the page. |
| FAQ 3: "When do bobblehead giveaways usually happen?" | **Odd, and contradicted by the list** | Answers only for MLB (weekends) and WNBA. The rows shown fall on Tue 8, Wed 6, Thu 9, Fri 9, Sat 7, Sun 7, Mon 4 of the first 50: mostly weeknights. Nothing about NBA or NHL. |
| FAQ 4: "Are bobbleheads still given away if you arrive late?" | **False for this list** | "typically the first 10,000 to 25,000 ticketed fans" at "the stadium gates". Of the 40 rows that state a cap, the range is 5,000 to 10,000, 24 are under 10,000, and none is above 10,000. These are arenas. |
| FAQ 5: "How many bobbleheads does each team give away?" | **Odd, jargon, and it contradicts the inline answer** | Gives MLB (15,000 to 25,000) and WNBA (8,000 to 12,000) only; "the attendance cap field on each card" is a field name; and "WNBA bobbleheads sit around 8,000 to 12,000" disagrees with the inline answer's "a WNBA bobblehead capped in the low thousands" (production's own top rows say "First 1,500 fans"). |
| FAQ 6: "Do bobbleheads have to be claimed at the gate?" | Mostly fine | "stadium entrance" again; otherwise holds for arenas. |

All nine blocks exist word for word on production. They were written for the MLB, MLS and WNBA list; the branch is what puts them over an NBA and NHL list.

### CFB

**c1. YES.** Hero pixel difference against production: 153 of 608,400 px at 390 (0.025%), 153 of 1,146,624 at 768 (0.013%), 153 of 1,911,040 at 1280 (0.008%), all in the "vs Wisconsin" box. H1 `textContent` "Minnesota vs Wisconsin: Paul Bunyan's Axe 2026" exactly; one h1; both school names are links with their colours (values under "things that work"). Diff images `cfb-paul-bunyans-axe/390-hero-diff.png`, `768-hero-diff.png`, `1280-hero-diff.png`; side by side `crops/cfb-pba-390-pair.png`.

**c2. YES.** `<main>` identical to production; 0 differing pixels at 390; header only at 768 and 1280. The page's own played-game problem (D1) is on both sides.

## 5. Defects

Origin key: **branch** = introduced by this branch (or by the two unreleased branches it carries, where said); **pre-existing** = on production too; **dev** = artifact of the local build.

**D1. Played game still sold as upcoming: /cfb/rivalries/florida-georgia. High. Pre-existing (identical on production). All widths.**
Florida vs Georgia was played Saturday 2026-10-31. Today the page's lede still reads "Florida vs Georgia is Saturday, October 31, 2026. Kickoff 3:30 PM ET at Mercedes-Benz Stadium in Atlanta. Tickets, parking and hotels for the trip.", the date card shows "Oct 31, Saturday, 3:30 PM ET" with no played mark, and the page offers "Find tickets" (TicketNetwork's Florida Gators performer page via `ticketnetwork.lusg.net`, 302 to `ojrq.net`), "Find hotels" (Expedia), "Reserve parking" (SpotHero) and "Gameday guide". No reminder. One sentence lower down does say "was played on Saturday, October 31". The branch does not touch this; it is the control page and is listed first because the check requires it. `/private/tmp/claude-501/-Users-mattkovalik-promonight-web/676ea55e-f348-4c03-b169-739a63237614/scratchpad/uxr3/crops/cfb-florida-georgia-390-branch-top.png`, `/private/tmp/claude-501/-Users-mattkovalik-promonight-web/676ea55e-f348-4c03-b169-739a63237614/scratchpad/uxr3/cfb-florida-georgia/390-production.png`.

**D1b. Played games with ticket buttons: /best-promos/bobbleheads on production. High. Production only; the branch removes it. All widths.**
Production's page states "Nothing here is upcoming" and "280 promos ranked from past dates", and all 50 served rows (July 6, Aug 19, Mar 28, ...) still carry Ticketmaster and TicketNetwork "Get Tickets" buttons. On the branch every row is a future game. `/private/tmp/claude-501/-Users-mattkovalik-promonight-web/676ea55e-f348-4c03-b169-739a63237614/scratchpad/uxr3/crops/bobbleheads-390-pair-0.png` (branch left, production right).

**D2. The header does not fit on one line from 768 to 831px. High. Branch. 768 (and 810, 820); every page.**
Adding Events makes the bar's contents 831px wide. At 768 "My Teams", "League hubs" and "Get the App" each wrap to two lines; the button becomes 55px tall inside the 56px bar and the chevron separates from its label. Production fits at 768 with 17.7px spare. Measurements under n1. `/private/tmp/claude-501/-Users-mattkovalik-promonight-web/676ea55e-f348-4c03-b169-739a63237614/scratchpad/uxr3/crops/header-768-home-team-venue-hub-branch-then-production.png`; full pages `/private/tmp/claude-501/-Users-mattkovalik-promonight-web/676ea55e-f348-4c03-b169-739a63237614/scratchpad/uxr3/home/768-branch.png`, `.../uxr3/team-wild/768-branch.png`, `.../uxr3/venue-target-center/768-branch.png`, `.../uxr3/nba/768-branch.png`.

**D3. The title step-down shrinks titles that already fit. Medium. Branch. All widths (fixed-width cards); homepage Tonight rail today.**
"Thanksgiving Salt & Pepper Shakers" printed whole at 27px in three lines on production and is 22px on the branch, against the stated rule that a title that fits at 27px is unchanged. "Native American Heritage Night Hat" goes to 19px and two lines when it has room for a larger size; half its title block is empty. The character budgets in `src/lib/stub-title.ts` (12 per line at 27px) are tighter than what the browser fits ("Salt & Pepper", 13 characters, fits on a line at 27px). No title is cut, so this is a legibility and consistency cost: adjacent cards now show three sizes for titles of similar length. `/private/tmp/claude-501/-Users-mattkovalik-promonight-web/676ea55e-f348-4c03-b169-739a63237614/scratchpad/uxr3/home/rail-tonight-1280-branch-0.png` beside `/private/tmp/claude-501/-Users-mattkovalik-promonight-web/676ea55e-f348-4c03-b169-739a63237614/scratchpad/uxr3/home/rail-tonight-1280-production-0.png`.

**D4. Three hub links land on a different promo's page. Medium. Branch (the links are new; the canonical rule behind them is older). All widths; /nba today, none on /nhl.**
"76ers Cup Games" (Theme Nights), in the Today card and in the This week card, links to `/nba/philadelphia-76ers/promos/76ers-cup-games-rally-towel`, whose H1 is "76ERS CUP GAMES RALLY TOWEL" under a GIVEAWAY badge. "Salute To Service" (Theme Nights, Cavaliers) links to `.../promos/salute-to-service-trucker-cap`. A fan who taps the theme night gets the giveaway's page; in the same card the giveaway title directly above goes to the same URL, so two of the card's links are one destination. In the Today section it is two separate cards for one page. `/private/tmp/claude-501/-Users-mattkovalik-promonight-web/676ea55e-f348-4c03-b169-739a63237614/scratchpad/uxr3/walk/nba-390-branch-tap-thisweek-multi2.png`.

**D5. Two new links are under 24px tall. Medium. Branch. All widths; 16 team links and 9 "more promo days" links across the two hubs.**
Team name link 14px tall (13px text, no padding). "N more promo days this week" 19.5px tall. Both are also well under the 44x44 mobile rule, as is the 24px promo title link; production's card top was one 340x114 target. The team name also gives no sign that it is a link (ink colour, no underline until hover), while the red "more promo days" line under it goes to the same page. `/private/tmp/claude-501/-Users-mattkovalik-promonight-web/676ea55e-f348-4c03-b169-739a63237614/scratchpad/uxr3/crops/nba-390-pair-0.png`.

**D6. The This week rail is 516 to 742px taller than production's, with uneven card interiors at 768 and up. Low. Branch. All widths.**
Heights under h6. At 768 and 1280 a one-promo card beside a two-promo card ends about 63px early and leaves that much blank under its ticket buttons, with the two "Get tickets" blocks at different heights (/nba row 1, /nhl rows 1 and 2). Two of five rows on each hub hold one card and an empty half (Pistons and Rockets on /nba; Capitals and Ducks on /nhl); production has the same single-card rows, so that part is pre-existing. On a phone the fourth ad anchor and the division lists sit about 600px further down. `/private/tmp/claude-501/-Users-mattkovalik-promonight-web/676ea55e-f348-4c03-b169-739a63237614/scratchpad/uxr3/crops/nba-768-branch-rail-a.png`, `/private/tmp/claude-501/-Users-mattkovalik-promonight-web/676ea55e-f348-4c03-b169-739a63237614/scratchpad/uxr3/crops/nhl-768-branch-rail.png`.

**D7. /best-promos/bobbleheads, the upcoming list. Branch (with the two unreleased branches it carries) and the dry-run data.**
- **a. Medium, 390.** The H1 breaks at the hyphen: "BEST / BOBBLEHEAD / NIGHTS OF 2026- / 27", four lines and 136.8px against production's three lines and 102.6px, with "27" alone on the last line. `/private/tmp/claude-501/-Users-mattkovalik-promonight-web/676ea55e-f348-4c03-b169-739a63237614/scratchpad/uxr3/crops/bobbleheads-390-branch-h1.png`.
- **b. Medium, all widths.** Three rows are not bobblehead giveaways as titled (b3): a Ticket Package row in the default view that duplicates the giveaway row for the same game, and two rows whose titles are a mystery box and a fan appreciation night.
- **c. Medium, all widths.** The intro and the meta description say the list spans MLB, MLS, WNBA, NBA and NHL, and three of the six league chips (MLB, MLS, WNBA) open an empty state. The list is NBA and NHL only. `/private/tmp/claude-501/-Users-mattkovalik-promonight-web/676ea55e-f348-4c03-b169-739a63237614/scratchpad/uxr3/best-promos-bobbleheads/390-branch-mlb-chip-empty.png`.
- **d. Low, all widths.** The stamp and the intro say 76 bobbleheads; the line above the list says "49 promos match this filter" (the default 90-day range). Production's two numbers agree (280 and 280).
- **e. Low, data.** Nine rows have titles that name nothing: "Bobblehead" (Kraken, twice), "Bobblehead Night" (Canadiens, four times, all linking to one page), "Player Bobblehead", "Mystery Bobblehead" (twice). One of them is card 08 on the homepage Best Promos rail, where the whole title is the word "Bobblehead" under a faint "08".
- **f. Low, 390.** CLS 0.0593 against production's 0.0294. Under the 0.1 line, but double.

**D8. Six of the nine FAQ and inline answer blocks are false or odd over an NBA and NHL list. Medium. The copy is pre-existing word for word; the branch creates the mismatch. All widths.** Table under b4.

**D9. Promo page reached from the hub leads with a played date. Low. Pre-existing (the promo page is not in this diff). 390.**
`/nba/golden-state-warriors/promos/warriors-cup-games-shirt` lists "Friday, Oct 30, 2026 vs Lakers" first, with no played mark, above tonight's "Wednesday, Nov 25, 2026 · 7:00 PM vs Kings"; its first Event `startDate` is 2026-10-30. Not all dates are past, so it is not a played-game page, but the first date a fan reads is four weeks old. `/private/tmp/claude-501/-Users-mattkovalik-promonight-web/676ea55e-f348-4c03-b169-739a63237614/scratchpad/uxr3/walk/nba-390-branch-tap-thisweek1.png`.

**D10. On /nhl the rail restates the section above it. Low. Pre-existing in kind. All widths.**
Seven of the eight This week cards are today's games, whose twelve promos are listed one section higher under "Today across NHL". Production is worse (eight of eight). A fan scrolls 1,500px of today's promos at 390 and then meets the same promos again as cards.

**D11. Standing accessibility failures, unchanged by the branch. Low to Medium. Pre-existing.**
- Text contrast under 4.5:1: the wordmark's "NIGHT" (4.33:1, #da2d20 on #f7f3ea) on every page; "See all today" and "See all" on the hubs (4.33:1, 14px); the "GET TICKETS" label above every ticket block (3.76:1, #ef4444 on white, 10px), which is where the bobblehead page's 74 axe nodes come from; "ATL" and "POR" team tiles on /nba (4.34:1); on the homepage "⚾ MLB" chips (3.75:1 and 2.87:1), "🏒 NHL" (1.65:1, #ffb81c on #fff9ec) and "🏀 NBA" (4.11:1) in Find your team, and "Never miss a promo night" (4.43:1); score badges "88" and "85" on the bobblehead page (4.36:1).
- axe `label-content-name-mismatch` (serious): 62 nodes on /nba, 66 on /nhl, 60 on /mlb (team tiles whose `aria-label` does not contain their visible text), 49 on the bobblehead page.
- Hit targets under 44x44 at 390 on both sides: the hamburger (40x40), "See all" links (20px tall), the TicketNetwork button (43px), filter chips (32px), star buttons on homepage cards (20x20 and 28x28), the sheet's "Get the App" (40px).
- The rank numeral behind each Best Promos card title overlaps the title's last characters ("Ryan O'Reilly" over "02", "Dunkstronaut" over "05"); production's cards do the same ("Cup" over "01").

**D12. Dev-build artifacts, not defects of the branch.**
Unwrapped Ticketmaster links on the venue, team and hub pages (production wraps them through `ticketmaster.evyy.net`); the two eBay resale links missing from the Wild page's past section; the two first-request 500s on `/nhl/minnesota-wild`; the order of teams in the homepage's Find your team list (geo); `EVENTS_PAGES_LIVE=true` set locally (production also serves `/events` today, 200). With ads on, production overflowed twice (/nba at 390: 414 against 390; /nhl at 768: 792 against 768) from an ad creative wider than its slot; that is the ad fill on those loads, production only.

## 6. Measurements

390 unless a width is given. Branch value first, production in brackets where it differs.

| Measure | /nba | /nhl | /mlb | / | /best-promos/bobbleheads | /nhl/minnesota-wild | /venues/target-center | paul-bunyans-axe | florida-georgia |
|---|---|---|---|---|---|---|---|---|---|
| Page height 390 | 11,190 (10,586) | 12,318 (11,745) | 8,375 | 11,371 (11,379) | 19,764 (21,224) | 10,806 (10,902, dev) | 6,830 | 2,889 | 2,939 |
| Page height 768 | 6,685 (6,168) | 7,654 (6,912) | 4,532 | 8,165 (8,173) | 16,463 (17,063) | 8,547 (8,611, dev) | 4,817 | 2,072 | 2,122 |
| Page height 1280 | 6,112 (5,596) | 6,987 (6,246) | 3,923 | 6,856 (6,863) | 16,335 (16,918) | 6,963 (7,027, dev) | 4,362 | 2,048 | 2,098 |
| CLS 390 | 0.0271 | 0.0270 | 0.0261 | 0.0249 | 0.0593 (0.0294) | 0 | 0.0006 | 0 | 0 |
| CLS 768 | 0.0012 (0.0009) | 0.0012 (0.0009) | 0.0428 (0.0419) | 0.0016 (0.0007) | 0.0016 (0.0013) | 0 | 0.0011 (0.0006) | 0.0006 (0.0002) | 0.0006 (0.0002) |
| CLS 1280 | 0.0006 (0.0005) | 0.0006 (0.0005) | 0.0004 (0.0003) | 0.0005 (0.0004) | 0.0165 (0.0153) | 0 | 0.0004 | 0.0002 (0.0001) | 0.0002 (0.0001) |
| scrollWidth = clientWidth at 390, 768, 1280 | yes | yes | yes | yes | yes | yes | yes | yes | yes |
| Interactive elements under 44x44 | 90 (64) | 89 (64) | 60 | 92 (82) | 81 (79) | 94 (96) | 36 | 32 | 32 |
| Text under 4.5:1 (distinct strings) | 6 | 4 | 2 | 23 (12) | 4 (2) | 3 | 3 | 11 | 11 |
| axe serious or critical | color-contrast 13, label-content-name-mismatch 62 | color-contrast 11, label mismatch 66 | color-contrast 2, label mismatch 60 | color-contrast 15 (8) | color-contrast 74 (51), label mismatch 49 (50) | color-contrast 1, label mismatch 6 | color-contrast 1, label mismatch 2 | color-contrast 10 | color-contrast 10 |
| `<a>` to /promos/ in DOM / visible | 29/27 (13/11) | 38/36 (13/11) | 13/11 | 55/37 (50/32) | 57/55 (58/56) | 37/35 | 11/9 | 8/6 | 8/6 |
| First ad anchor from top of document | 57 (`data-ad-region="content"`); first `hub-section` 561 | 57; first `hub-section` 585 | 57; 639 | 57 | none on the page | 672 | 57 | 57; first `rivalry-section` 269 | 57; 269 |
| Header bar height 768 / items wrapped | 57 / 3 (57 / 0) | 57 / 3 (0) | 57 / 3 (0) | 57 / 3 (0) | 57 / 3 (0) | 57 / 3 (0) | 57 / 3 (0) | 57 / 3 (0) | 57 / 3 (0) |

Ads on (hubs only, one load each; ad heights vary by fill):

| Render | Branch: filled units, in document order (y) | Production | scrollWidth/clientWidth, branch (production) | CLS, branch (production) |
|---|---|---|---|---|
| /nba 390 | 6: Content_1 7,205, Content_2 7,834, Content_3 9,500, Content_4 10,682, Below_Post_1 10,942, Footer_1 794 (fixed) | 6: Content_1 6,601, Content_2 7,229, Content_3 9,046, Content_4 10,229, Below_Post_1 10,489, Footer_1 794 (fixed) | 390/390 (414/390) | 0.0271 (0.0271) |
| /nba 768 | 6: Content_1 4,464, Content_2 5,008, Content_3 6,024, Content_4 6,926, Below_Post_1 7,186, Footer_1 934 (fixed) | 6: Content_1 3,947, Content_2 4,492, Content_3 5,538, Content_4 6,440, Below_Post_1 6,700, Footer_1 934 (fixed) | 768/768 (768/768) | 0.0012 (0.0244) |
| /nba 1280 | 5: Content_1 4,203, Content_2 5,216, Content_3 6,118, Below_Post_1 6,378, Footer_1 710 (fixed) | 6: Content_1 3,687, Content_2 4,745, Content_3 5,647, Below_Post_1 5,907, Footer_1 710 (fixed), Video_StickyOutstream_1 540 | 1280/1280 (1280/1280) | 0.0006 (0.0415) |
| /nhl 390 | 6: Content_1 8,228, Content_2 8,857, Content_3 10,628, Content_4 11,810, Below_Post_1 12,070, Footer_1 794 (fixed) | 7: Content_1 7,655, Content_2 8,284, Content_3 10,055, Content_4 11,237, Below_Post_1 11,497, Footer_1 794 (fixed), Video_StickyOutstream_1 672 | 390/390 (390/390) | 0.0270 (0.0795) |
| /nhl 768 | 6: Content_1 5,380, Content_2 5,925, Content_3 6,993, Content_4 7,895, Below_Post_1 8,155, Footer_1 934 (fixed) | 7: Content_1 4,639, Content_2 5,183, Content_3 6,252, Content_4 7,184, Below_Post_1 7,444, Footer_1 934 (fixed), Video_StickyOutstream_1 764 | 768/768 (792/768) | 0.0012 (0.0592) |
| /nhl 1280 | 5: Content_1 5,026, Content_2 6,091, Content_3 6,993, Below_Post_1 7,253, Footer_1 710 (fixed) | 6: Content_1 4,284, Content_2 5,399, Content_3 6,347, Below_Post_1 6,607, Footer_1 710 (fixed), Video_StickyOutstream_1 540 | 1280/1280 (1280/1280) | 0.0006 (0.0088) |

The in-content slots are the same set in the same order on both sides at every width: Content_1 to Content_4 (Content_1 to Content_3 at 1280), Below_Post_1 and the fixed Footer_1. Each sits lower on the branch by the rail's growth: the first in-content ad is at y 7,205 on /nba at 390 (production 6,601) and y 8,228 on /nhl (7,655). No ad sits above or inside the rail on either side. The only unit present on one side alone is Raptive's sticky outstream video, which filled on four production loads and on no local load; that is ad fill, not layout. Production's higher CLS and its two overflows with ads on (414 against 390 on /nba at 390; 792 against 768 on /nhl at 768) come from that video unit and from one oversized creative on those loads. Ads-on screenshots: `nba/<viewport>-<env>-ads.png`, `nhl/<viewport>-<env>-ads.png`.

## 7. One recommendation

Do not merge with the header as rendered at `b5c53e2`: decide what the bar drops between 768 and 831px (and what it drops when Playoffs or World Cup is on, where the shortfall reaches 1,038px), then re-render the header at 768, 810, 820 and 1024 on the homepage, a team page and a venue page before the merge, because that one component is on every page of the site and it is the only finding here that breaks a page production currently gets right. An uncommitted edit to `BrandBar.tsx` landed in the branch worktree during this run; it has not been rendered.

## Disposition (added by the build session, 2026-11-25)

The review rendered `b5c53e2` plus the local score overlay. The fixes below are in `54b37bf` and the commit that carries this report. After they landed, the local build was moved to `54b37bf` and the header and the card titles were measured again in Chrome by the build session (not by this review).

- **D1, pre-existing, deferred.** `/cfb/rivalries/florida-georgia` (played 2026-10-31) still offers tickets, hotels and parking with no played state. Not touched by this branch; known-issues 128.
- **D1b.** Production only. The release branch already removes ticket buttons from retrospective cards.
- **D2, fixed.** Six items need 831px. The Events link now shows from 860px (980 with Playoffs or World Cup in the bar, 1100 with both); under that it is absent from the bar and stays in the footer, and below 768 it is in the menu sheet. Measured after the fix on the homepage, `/nhl/minnesota-wild` and `/venues/target-center` at 768, 810, 820, 859, 860, 1024 and 1280: the bar is 57px tall, no item wraps, and Events is hidden through 859 and shown from 860. What the bar should do between 768 and 859 is put to the owner at the gate.
- **D3, fixed.** Title sizing now uses Archivo 700's measured character widths. Measured after the fix: all 16 titles on the two homepage rails fit, "Thanksgiving Salt & Pepper Shakers" is back at 27px, "Native American Heritage Night Hat" is 22px on three lines, Malkin and Gauthier are 24px on three lines. Eight further real titles the first version clipped were rendered at their assigned size and fit.
- **D4, waived.** "76ers Cup Games" linking to the Rally Towel page is the canonical-page rule (Phase 3c): two rows for one game share one page. Known-issues 128.
- **D5, fixed.** The team name and the "more promo days" link are 24px tall, and the team name is underlined.
- **D6, partly fixed.** Ticket blocks now sit level across a row. The rail is 516 to 742px taller than production's because each team's promos are listed; accepted as the cost of one card per team.
- **D7.** a fixed (the season label no longer breaks at its hyphen in either ranked page's H1). b, e are data items in known-issues 127. c, d waived: the intro names the leagues the list draws on, and the stamp and filter counts are the existing pattern (P6 in the previous report). f deferred, known-issues 128.
- **D8, partly fixed.** The quantity figures that did not describe the list are gone, the small-run question no longer names the WNBA, and the recurring-bobblehead answer says which teams the team rankings cover. The MLB-team and weekend-timing answers are about MLB and were left; known-issues 128.
- **D9, D10, D11.** Pre-existing and not touched.

Screenshots are outside the repository, in the session scratchpad.
