# ux-review: release/fix-round-2026-11 final gate sweep

Run: 2026-11-25 (America/New_York). Ten pages at 390x844, 768x1024 and 1280x800.

## Verdict

Nothing found in this sweep should stop a production deploy. No page overflows at any width, no console or hydration errors, no failed local requests, no 404 among the first 20 internal links of any page, CLS stays under 0.05 everywhere, and every item the release set out to change renders as described (rail absent on the homepage, "8 of 15", 203, the 2027 naming on /mlb and Giants, no Giants calendar, the single resale lines, the played state on Florida vs Georgia, the Events link from 860px). The defects below are copy, labelling and tap-size issues. The two worth fixing soon are on /promos/today: the lede says "15 games today" when the board holds 15 promos at 9 games, and no card names the home team. Neither string is in this release's diff against main, so both read as carried over, not introduced. The one place the release's own rule is not met is the small "TICKETS" pill on homepage cards and Giants rows, which does not read "Get Tickets".

## Target and limits

- Target: a LOCAL PRODUCTION BUILD (`next build` + `next start`) at http://localhost:3100. It is not the Vercel preview and not production. This is not a baseline run: no request was made to production or to any vercel.app host, so nothing here is a comparison against what is live.
- Commit: the server process runs from `/private/tmp/pn-wt/web-counts`, which is on `feature/counts-and-cta` at d741c30, not from the release worktree. `git diff d741c30 19e1c16` is empty, so the tree served is identical to the release merge commit 19e1c16. The local HTML carries no `<meta name="promonight-deploy">`, so the deployment cannot be confirmed from the page itself.
- Outside hosts: every browser request to a non-localhost host was aborted (googletagmanager.com, ads.adthrive.com, posthog, firebasestorage). Affiliate links were read from the href and never followed. `/go/fubo/...` links were not requested.

Could not be checked on this target:

- Ad fill, and where Raptive actually places units. The Raptive script was blocked; only the placed anchors were counted.
- The Ticketmaster Impact wrap. Every Ticketmaster link here is a bare ticketmaster.com URL, as the build log warned for a non-production target.
- Bot firewall and rate-limit behaviour, and the `/go/` redirect targets.
- The promo page's giveaway image (served from firebasestorage, blocked by this run's network rule; the frame shows its alt text in the screenshots for that reason only).
- Analytics events, the eBay block (needs Vercel credentials), real iOS Safari behaviour.
- Whether any defect below also exists in production today.

## Game date check

Today is 2026-11-25 in America/New_York.

| Page | Dates read | Verdict |
|---|---|---|
| /cfb/rivalries/florida-georgia | Game line "Oct 31 Saturday"; JSON-LD SportsEvent startDate 2026-10-31T15:30:00-04:00 | PLAYED. Page shows the played state. |
| /best-promos | 50 SportsEvent startDates, 2026-03-28 to 2026-08-19, none in the future | All past. Page says so ("ranked from past dates"). |
| /nhl/chicago-blackhawks/promos/spencer-knight-bobblehead | "Sunday, Nov 29, 2026 · 1:00 PM CT"; JSON-LD 2026-11-29 | Upcoming, 4 days out. "IN 4 DAYS" is right. |
| /events/monster-jam/angel-stadium | 8 showtime rows and 8 Event startDates, 2026-12-19 to 2027-02-21 | All upcoming. "24 DAYS AWAY" is right. No passed row with a button. |
| /mlb/san-francisco-giants | 20 Event startDates, 2027-03-25 to 2027-05-15 | Upcoming. |
| /promos/today | Game line "Wednesday, November 25"; no Event JSON-LD | Today. |
| /, /nba, /mlb, /events/monster-jam | No Event JSON-LD | Not applicable. |

## Three things that work

1. The played state on Florida vs Georgia. "This game has been played", a past-tense lede and meta description, no trip section, no tickets, parking, hotels or reminder, no affiliate disclosure, and a "Stadium guide" link that resolves (200).
2. The resale line discipline. Anaheim: one line directly under "Pick your show" (heading bottom y 639, line y 649), above eight "Get Tickets" buttons. Promo page: Get Tickets and Share, then one line, then "Also on Ticketmaster". /promos/today: one line in the hero, none under 16 cards. /nba: one line under each of 8 Ticketmaster and TicketNetwork pairs. Giants: one under the Plan Your Visit pair, one under the pair in an opened row. Homepage ticket sheet: one under the pair.
3. Navigation holds. Homepage tile "Bobbleheads" lands on H1 "UPCOMING BOBBLEHEADS", browser back restores scroll exactly (2355 to 2355). Promo page card "Black Friday" lands on H1 "BLACK FRIDAY", back restores exactly (2098 to 2098). The header Events link is hidden at 859px and visible at 860px with no overflow at either.

## Defects

Screenshots are under `2026-11-25-release-final/<page>/<viewport>-local.png`.

1. **Recorded, working. /cfb/rivalries/florida-georgia, all viewports.** The game was played on 2026-10-31. The page offers nothing to buy or plan for it: a Stadium guide link, the two school links, three other rivalries. Residue: the JSON-LD SportsEvent still carries `eventStatus: EventScheduled` for a game 25 days in the past. `florida-georgia/390-local.png`
2. **Medium. /promos/today, all viewports.** The lede reads "15 games today have promotions across NBA and NHL". The board lists 15 promos (NBA 3, NHL 12) at 9 games. The homepage says "8 of 15 promos" and the Today tile says "15 promos" for the same number, so the site calls one figure both games and promos. Not in the release diff. `promos-today/390-local.png`
3. **Medium. /promos/today, all viewports, and the homepage ticket sheet at 390.** No card names the home team. A fan reads "Kitchen Apron, First 7,500 fans, VS FLAMES" or "Hockey Rink Butter Dish, VS FLYERS" and cannot tell whose building it is unless the promo title happens to say. The sheet a homepage "TICKETS" pill opens has the same gap ("Sorokin Bobblehead Night, VS JETS"). `promos-today/390-local.png`, `home/390-ticket-sheet-local.png`
4. **Medium, accessibility. /nba and /mlb, 390 (present at all widths).** axe `label-content-name-mismatch`, serious: 54 nodes on /nba, 60 on /mlb. Each team card shows a monogram (BOS, BAL) that is not in the card's aria-label ("Boston Celtics 22 upcoming promos"). `nba/390-local.png`, `mlb/390-local.png`
5. **Low to medium, against the release's own rule. Homepage (14 pills) and Giants (42 pills), all viewports.** The pill on each promo card and row reads "TICKETS", not "Get Tickets". It opens the ticket pair (which does read "Get Tickets"). The pill is 92x23 to 92x27 at 390. `home/390-local.png`, `giants/390-local.png`, `giants/390-ticket-row-open-local.png`
6. **Low. /promos/today, 390 only.** The inline ticket tiles show logos and an arrow, with no "Get Tickets" text (the text appears at 768 and 1280; the accessible name has it at every width). The TicketNetwork tile is a 56x15 logo. Tiles are 108x40. The one resale line sits in the hero at y 391; the first TicketNetwork tile is at y 833 and the last at y 4972, so for most of the board the line is several screens away from the button it describes. `promos-today/390-local.png`
7. **Low. Tap targets under 44px that this release introduced, 390.** "Stadium guide" 98x36 (Florida vs Georgia). "Also on Ticketmaster" 133x21 (promo page). TicketNetwork button in a stacked pair 300x43 (/nba) and 274x43 (opened Giants row), each 1px short. The Anaheim "Get Tickets" buttons pass at 97x48, the promo page "Get Tickets" passes at 144x52, "Stream on Fubo" passes at 101x44.
8. **Low. /best-promos, all viewports.** The disclosure says "PromoNight may earn a commission on purchases made through links on this page" and "Tickets on TicketNetwork are resold by other sellers". In the retrospective state the page has no ticket link, no affiliate link and no outbound link of any kind. `best-promos/390-local.png`
9. **Low. /best-promos, all viewports.** No sentence is strictly false today, but two sit badly together. The intro says an upcoming ranking "returns from 45 days before a scored league's next Opening Day". The FAQ says "The upcoming list ranks giveaways from MLB, MLS, WNBA, NBA, and NHL". NBA and NHL are mid-season with giveaways tonight, and there is no upcoming list. A fan has no way to know those two leagues carry no scores yet.
10. **Low. /best-promos.** 50 SportsEvent entries in JSON-LD, every one a past game, every one `EventScheduled`.
11. **Low. /mlb, all viewports.** (a) FAQ: "The this-week rail on this page lists the promotions scheduled at MLB ballparks over the next seven days". There is no rail on the page; it shows "No MLB promos today". (b) The team card reads "Oakland Athletics" while the ballpark list on the same page reads "Sutter Health Park, West Sacramento" and /best-promos calls the club "Athletics". (c) FAQ: "open any club full promotional schedule".
12. **Low. /nba, all viewports.** FAQ: "A team whose card below shows no upcoming promos". The cards are above the FAQ.
13. **Low. /events/monster-jam, all viewports.** The Houston stop is listed at "Reliant Stadium" with a "Reliant Stadium venue guide" link. The building has been NRG Stadium since 2014.
14. **Low. /cfb/rivalries/florida-georgia, all viewports.** (a) "The Florida vs Georgia rivalry, known as Okefenokee Oar, was played on Saturday, October 31." The Oar is the trophy, not the rivalry's name. (b) "Stadium guide" lands on a page whose H1 is "Mercedes-Benz Stadium Bag Policy". (c) "More rivalries" lists "Red River Rivalry, Oct 10" with no sign it has been played, next to two that are upcoming. (d) The page says the game was played and gives no result. (e) axe color-contrast, 9 nodes: breadcrumb links and the "The trophy" heading at 4.49:1, the "vs", the source line and its two Wikipedia links at 3.73:1.
15. **Low. Homepage, 390.** The four hero stats wrap two and two with different column widths: "6" sits directly under the "PROMOS TRACKED" label and a divider hangs after "169 TEAMS". At 768 and 1280 they sit in one row. `home/390-local.png`
16. **Low. Contrast failures (axe, serious), 390.** Every page: "NIGHT" in the header wordmark, 4.33:1. Homepage, 7: "See all" link 4.33:1, league chips on team cards at 1.65:1 (gold), 2.86:1, 3.74:1 and 4.11:1, "Download for iOS" white on red 3.76:1. /nba, 13: "See all" links 4.33:1, red eyebrow labels 3.76:1. /mlb, 2: one monogram 4.29:1. /promos/today, 11: hub links 4.33:1, date eyebrows and times 2.75:1 on the dimmed Tomorrow card, "Theme Nights" chip 3.7:1. /best-promos, 2: the bobblehead ranking link 4.33:1.
17. **Low. Layout shift, all under 0.05.** Homepage, /nba, /mlb and the promo page at 390 each shift the whole hero down 34 to 38px once in the first 150ms when the display font arrives and the H1 takes one more line. /mlb at 768 does the same by 57px (0.0414). /events/monster-jam at 1280 reflows the "Find your city" chips once (0.0439).
18. **Low. Giants (1) and /promos/today (16).** axe `label-content-name-mismatch` on the SpotHero button: visible "SpotHero Reserve Parking", accessible name "Reserve parking on SpotHero".
19. **Low. Promo page, 390.** The fan guide says teams "usually" hand out "between 10,000 and 25,000" directly under "FIRST 8,000 FANS". The date tile is a 295px-tall column holding four short lines.
20. **Low. /promos/today.** One card prints "07:00 PM" (Hockey Rink Butter Dish); every other card prints "7:00 PM". No card or homepage rail states a time zone; the promo page does ("1:00 PM CT").

Checked and clean: no ticket button with visible text other than "Get Tickets" apart from items 5 and 6; no TicketNetwork button without a resale line in its group or page hero; no resale line on a page without a TicketNetwork button; the ticket buttons' accessible names contain their visible text (the trailing arrow is decorative).

## A. Homepage ad slots

What the page places. The root `div[data-ad-region="content"]` starts at y 57 at every width. The page has three `<AdSlot>` placements and they render NO element in this build (0 `[data-ad-slot]` nodes at 390, 768 and 1280); only their padded wrappers exist. There are 0 `[data-ad-item]` nodes. The anchors the ad placer targets are the 11 direct children of `div.page-content` (rule recorded in the source comment: `.page-content > *`, skip 2, insert after). Y values are the bottom edge of each child, which is where a unit would be inserted.

| # | page-content child | Role | Insert point y at 390 | at 768 | at 1280 |
|---|---|---|---|---|---|
| 1 | Tonight rail | skipped (1) | 1248 | 1123 | 1123 |
| 2 | AdSlot wrapper, header_leaderboard (empty, 32px) | skipped (2) | 1280 | 1154 | 1154 |
| 3 | This Week | FIRST content slot follows | 2299 | 2231 | 1986 |
| 4 | By What You Want | content | 3168 | 2861 | 2583 |
| 5 | Find Your Team | content | 5280 | 4045 | 3320 |
| 6 | AdSlot wrapper, recirc_native (empty, 16px) | content | 5296 | 4061 | 3336 |
| 7 | Going to the Game? | content | 5964 | 4658 | 3747 |
| 8 | App download block | content | 6684 | 5243 | 4143 |
| 9 | Never Miss a Giveaway | content | 7030 | 5552 | 4374 |
| 10 | Built by a Minnesota Sports Fan | content | 8105 | 6209 | 4940 |
| 11 | FAQ (last child) | content, last | 9622 | 7208 | 5939 |
| | Affiliate disclosure (outside page-content) | none | | | |
| | AdSlot wrapper, adhesion_footer (empty, 32px) | below-content slot | 9751 | 7289 | 6004 |

- Count at each width: 3 AdSlot placements (all empty), 11 anchors, 9 of them eligible after the skip. The count and order are the same at 390, 768 and 1280.
- First content slot: after THIS WEEK. Above it, in order: the hero (707px tall at 390, 608px at 768 and 1280), the ticker, the Tonight rail, the empty leaderboard wrapper, This Week.
- Gap from the last content slot to the below-content slot: from the end of the FAQ to the top of the footer-slot wrapper is 129px at 390, 81px at 768, 65px at 1280 (the disclosure fills it). If the placer's last unit lands after the Founder block instead, the gap is 1,646px, 1,080px and 1,064px.
- Does the missing Best Promos rail leave two slots adjacent, or a slot under the hero? No to both. The rail's section is not rendered at all, so it leaves no empty anchor: the insert point after This Week and the one after By What You Want are 869px, 630px and 597px apart. No slot can sit directly under the hero: the hero is outside page-content and the first two children are skipped.
- One adjacency that exists with or without the rail: anchors 5 and 6 are 16px apart at every width (after Find Your Team, then after the empty recirc wrapper). Whether two units land there depends on the placer's own spacing rule, which could not be observed.
- When the rail returns: its `<section class="px-6 py-4">` renders between This Week and By What You Want, as the new 4th child. The first content slot is unchanged (after This Week). A new insert point appears after Best Promos, every later anchor keeps its section and moves one position down, and eligible anchors go from 9 to 10. The rail section has 16px of vertical padding where its neighbours have 64px, so the insert points after This Week and after Best Promos would be about one rail height apart (the Tonight rail is 440px at 390), the closest pair on the page after 5 and 6.

## Measurements

All values from the local build. Overflow is `scrollWidth/clientWidth` on the document element.

| Page | Overflow 390, 768, 1280 | CLS 390 / 768 / 1280 | axe serious at 390 | Under 44px / interactive at 390 | /promos/ links DOM / visible at 390 | First ad anchor y at 390 |
|---|---|---|---|---|---|---|
| / | 390/390, 768/768, 1280/1280 | 0.0249 / 0.0007 / 0.0005 | contrast 7 | 91 / 132 | 47 / 45 | 57 |
| /best-promos | none | 0.0044 / 0.0015 / 0.0011 | contrast 2 | 29 / 80 | 58 / 56 | no anchor on page |
| /nba | none | 0.0271 / 0.0009 / 0.0006 | contrast 13, name mismatch 54 | 90 / 134 | 29 / 27 | 57 |
| /mlb | none | 0.0256 / 0.0414 / 0.0004 | contrast 2, name mismatch 60 | 60 / 95 | 13 / 11 | 57 |
| /mlb/san-francisco-giants | none | 0.0000 / 0.0000 / 0.0000 | contrast 1, name mismatch 1 | 126 / 196 | 64 / 62 | 594 |
| /events/monster-jam | none | 0.0004 / 0.0012 / 0.0439 | contrast 1 | 27 / 91 | 8 / 6 | no anchor on page |
| /events/monster-jam/angel-stadium | none | 0.0001 / 0.0003 / 0.0002 | contrast 1 | 25 / 46 | 8 / 6 | 57 |
| promo page | none | 0.0290 / 0.0002 / 0.0002 | contrast 1 | 38 / 58 | 19 / 17 | 57 |
| /cfb/rivalries/florida-georgia | none | 0.0000 / 0.0002 / 0.0002 | contrast 9 | 33 / 35 | 8 / 6 | 57 |
| /promos/today | none | 0.0001 / 0.0003 / 0.0002 | contrast 11, name mismatch 16 | 95 / 127 | 25 / 23 | 57 |

Two /promos/ links on each page are in the DOM but not rendered at 390; which two was not traced. On every page 23 or 24 of the under-44px targets are header (2 or 3) and footer (21) links.

D. Largest shifts at 390: homepage 0.0249, one shift at 145ms, hero paragraph, CTA row, stats and ticker move down 34px. Giants 0.0000, no shift recorded. /promos/today 0.0001, a 3px nudge of the NFL chip.

F. Broken: 0 console errors, 0 page errors and 0 hydration errors on all 30 renders and in every interaction (the only console entries are the blocked outside hosts and unused-preload warnings for fonts and CSS). 0 local responses of 400 or above. First 20 internal links per page: all 200 (the `/go/fubo` links were not requested). Header (14) and footer (20) links: all 200. Images: all local images load; the one outside image was blocked by this run.

## Per-page notes

**/ (homepage).** Above the fold at 390: wordmark and menu, "FIND THE GAMES WORTH GOING TO.", the two buttons, the four stats (item 15). First scroll: ticker, Tonight with "8 of 15 promos at games starting today." and the stub cards. Second scroll: This Week. The Best Promos rail is absent, as expected. Today tile "15 promos" matches the lede and matches /promos/today (3 + 12). Hero "Venue guides" reads 203; the trip tiles read 201, 202, 103 and 109 venues, none above 203. A "TICKETS" pill opens a sheet with the Ticketmaster and TicketNetwork pair and one resale line; Escape closes it. The This Week tile says "22 promos" where the section above it shows 6 cards; the tile calls them "highlighted picks", so a fan may read that as a mismatch.

**/best-promos.** What a fan sees: "BEST OF 2026", H1 "BEST SPORTS PROMO NIGHTS OF 2026", "2026 SEASON RECORD · SCORES LAST COMPUTED NOVEMBER 24, 2026 · 300 PROMOS RANKED", an intro that says the list is the season's record and "not a list of what is on next", chips ALL, MLB, MLS, WNBA, the line "300 promos ranked from past dates", then 50 rows (all Giveaways; scores 100, 100, then 98) and "SHOW 50 MORE · 250 REMAINING". Chips work and agree with each other: MLB 281, MLS 14, WNBA 5, total 300. No NBA or NHL chip. The scoring arithmetic in the FAQ adds up (100, the 98 ceiling, the jersey case). Rows link to promo pages. False today: nothing outright; see items 8, 9 and 10.

**/nba.** "NBA PROMOTIONS 2026-27", "13 teams with a promo this week", "Showing 8 of 13 teams", 8 rail cards, one per team, each promo title linking to its promo page (all 200). 30 team cards, 4 reading "No upcoming promos listed yet". Items 4 and 12.

**/mlb.** "MLB PROMOTIONS 2027", "8 of 30 clubs have published 2027 promotions so far.", and exactly 8 cards marked "2027 promotions published" (BAL, TEX, ATL, MIA, PHI, CIN, PIT, SF). 2,931 over 30 is 97.7. No rail renders (no MLB promo this week), which is why the FAQ sentence in item 11 is wrong.

**/mlb/san-francisco-giants.** "Giveaways & Theme Nights 2027", tiles 11 + 28 + 0 + 3 = 42, "42 promotions announced so far for the 2027 season", "42 events announced" under "2027 SEASON PROMOS". No calendar anywhere (no grid, no weekday row, no view toggle); the promo list is there. "COMPLETED 2026 PROMOS" has its own heading (an H3): "114 completed events, March 2026 to September 2026", 5 shown plus "SHOW 109 MORE". Opening a row's pill shows the pair with one resale line under it. Item 5.

**/events/monster-jam.** "MONSTER JAM 2026-27 SCHEDULE", "20 stops we cover · 64 shows". The page lists 20 cities in 22 date rows and the show counts sum to 64. Header Events link from 860px. Item 13.

**/events/monster-jam/angel-stadium.** Eight showtime rows, every button "Get Tickets" with an accessible name that names the date and TicketNetwork, each href a distinct TicketNetwork event. One resale line under the heading. The disclosure here drops the TicketNetwork sentence and adds "Times are local to the venue."

**Promo page.** Date, time with zone, venue and "IN 4 DAYS" all above the fold at 390. Primary CTA "Get Tickets" goes to ticketnetwork.lusg.net wrapping a ticketnetwork.com page for this exact game (href read, not followed). "Also on Ticketmaster" goes to ticketmaster.com. "home game 15 of 42". Items 7 and 19.

**/cfb/rivalries/florida-georgia.** As described under the game date check. Items 1 and 14.

**/promos/today.** "Wednesday, November 25", one resale line in the hero under the lede, chips ALL, NBA, NHL, NFL, 15 cards for today and a dimmed Tomorrow section with one NFL card. Chips filter correctly and print "No NFL promos today." where empty. Items 2, 3, 6 and 20.

## Recommendation

Deploy. Then fix /promos/today first: make the lede count what the board counts, and put the home team on each card.

## Disposition (added by the build session, 2026-11-25)

| # | Disposition |
|---|---|
| 1 | Working as ruled (EventScheduled, no offers, ruling 2026-11-08). |
| 2 | Deferred, known-issues 130 (/promos/today lede). Not in this release's diff. |
| 3 | Deferred, known-issues 131. Not in this release's diff. |
| 4 | Deferred, known-issues 130 (hub card names). On production too. |
| 5 | Deferred, known-issues 131, and put to the owner: the "TICKETS" pill opens the pair and is not itself a ticket link. |
| 6 | Deferred, known-issues 130 (daily board tiles at phone width). |
| 7 | Deferred, known-issues 131 (tap targets under 44px introduced by the release). |
| 8 | Fixed on feature/final-gate-fixes (no TicketNetwork sentence in the retrospective state). The base disclosure remains; deferred, known-issues 131. |
| 9 | Deferred, known-issues 127 (copy between the web deploy and the score write). True after the write. |
| 10 | Deferred, known-issues 131. |
| 11 to 20 | Deferred, known-issues 131, one line; none is from this release's diff except where already listed above. |
