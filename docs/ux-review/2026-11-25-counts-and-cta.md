# ux-review: feature/counts-and-cta, baseline mode

Run of 2026-11-25 (America/New_York). Production captured about 12:30 PM ET; branch recaptured about 12:50 PM ET after the ticket labels were rebuilt.

- Branch: `feature/counts-and-cta` at `126ce9e`, worktree `/private/tmp/pn-wt/web-counts`, dev server `http://localhost:3100`. The dev server HTML carries no `promonight-deploy` meta.
- Production: `https://www.getpromonight.com`, `<meta name="promonight-deploy">` = `dpl_7FiidXwyPgvHEdC6pfXk8cpzKRUk` on all 21 loads.
- Production loads: 21 of 21 (7 pages x 3 viewports, one load each, all HTTP 200, no retries), taken once and reused. Nothing on production was loaded for the recapture. `/promos/today` and `/cfb/minnesota` were rendered on the branch only.
- An earlier pass of this review ran on `5fde2d9`, where TicketNetwork buttons read "Resale tickets". That build was reverted. Every branch number below is from `126ce9e`.
- Viewports: 390x844, 768x1024, 1280x800, plus 360x780 on the branch for `/promos/today` and the event stops.
- Ads blocked in both environments, so ad slots play no part in the pixel numbers.
- Screenshots: `2026-11-25-counts-and-cta/<slug>/<viewport>-<env>.png`, with `-fold`, `-diff` and named crops beside them.

Pages: `/` (home), `/venues`, `/mlb`, `/mlb/san-francisco-giants`, `/nhl/minnesota-wild`, `/nhl/chicago-blackhawks/promos/spencer-knight-bobblehead`, `/events/monster-jam/angel-stadium`, plus `/promos/today` (390 and 360) and `/cfb/minnesota` (390) on the branch only.

## 1. Baseline differences

### 1.1 Served HTML, main content

`<article>` where the page has one, else `<main>`; scripts, styles, comments, nonces, deploy ids, build hashes and srcset stripped.

| Page | Compared | Result | Differing regions |
|---|---|---|---|
| home | `<main>` | differs | Hero stat `213` to `203`. Tonight lede `8 promos at games starting today.` to `8 of 15 promos at games starting today.` Gameday utility counts `210 / 209 / 113 venues` to `201 / 202 / 109 venues`. Best Promos rail (3 cards) absent on branch. 8 card title class changes. |
| venues | `<main>` | 1 hunk | Intro only. Production: `203 verified gameday guides for the 2026 season: bag policies, parking, gate times, and transit, one page per building. Pick a venue for the full rundown, or jump to its league below.` Branch: `203 gameday guides: bag policies, parking, gate times, and transit, one page per building. Pick a venue for the full rundown, or jump to its league below.` |
| mlb | `<main>` | 19 hunks | H1 `MLB PROMOTIONS 2026` to `MLB PROMOTIONS 2027`. New hero note `8 of 30 clubs have published 2027 promotions so far.` Browse intro loses `full 2026`. On 8 cards the subtitle `Promotional schedule` becomes `2027 promotions published` and the aria-label becomes `{team} 2027 promotions published`. |
| mlb-giants | `<article>` | 31 hunks | Rail: resale line added under the ticket pair; aria-labels `Get tickets on Ticketmaster` to `Ticketmaster Get Tickets`, `Get tickets on TicketNetwork` to `TicketNetwork Get Tickets`; visible labels unchanged. Calendar label `November 2026` to `March 2027` and that month's grid. `Still to come` eyebrow. `UPCOMING PROMOS` to `2027 SEASON PROMOS`, count lines, pattern copy and FAQ renamed to 2027. Disclosure gains its TicketNetwork sentence. Ticketmaster href (see 1.4). |
| nhl-wild | `<article>` | 32 hunks | Resale line added under the rail pair and under each of the 9 lazily mounted game cards' pairs; the same two aria-label changes; visible labels unchanged (`Get Tickets` on both, as in production). Disclosure sentence. Ticketmaster href and two eBay rows (see 1.4). |
| promo | `<article>` | 3 hunks | Primary button `Get tickets` to `Get Tickets` (aria `Get tickets for ...` to `Get Tickets for Chicago Blackhawks vs Wild on TicketNetwork`). Resale line inserted between the button row and `Also on Ticketmaster`. Disclosure sentence. Ticketmaster href (see 1.4). |
| event stop | `<article>` | 10 hunks | All 8 buttons `Tickets` to `Get Tickets`; class `px-5 text-[16px]` to `px-3 text-[14px]` with `px-5 text-[16px]` from 420px; aria `Tickets for Monster Jam at Angel Stadium, Sat, Dec 19 at 4:30 PM` to `Get Tickets for ... on TicketNetwork`. Resale line added after the last showtime, above the disclosure. Disclosure sentence. |

The disclosure sentence added on every page that carries one: `Tickets on TicketNetwork are resold by other sellers, so a price there can be above or below face value.`

Header differs identically on all seven pages: the branch adds an `Events` link to the desktop nav (from 860px) and to the mobile sheet. Expected from earlier branches.

### 1.2 Pixel comparison

Full-page PNGs, pixelmatch threshold 0.1, shorter image padded white. Diff images: `<slug>/<viewport>-diff.png`. Most of the area is displacement below the first changed element.

| Page | 390 | 768 | 1280 | Where |
|---|---|---|---|---|
| home | 897,246 px (20.2%); prod 11379 tall, branch 11011 | 1,450,817 (23.1%); 8173 / 7799 | 1,985,936 (22.6%); 6863 / 6490 | Hero stat row (y 656 at 390), Tonight lede (y 883), then everything below the removed Best Promos rail (y 2274 on) |
| venues | 4,507 (0.08%); 14623 / 14623 | 4,278 (0.07%); 7773 / 7773 | 4,936 (0.07%); 5754 / 5754 | The intro paragraph only (y 195 to 282 at 390). Nothing else moves. |
| mlb | 306,325 (9.3%); 8375 / 8406 | 345,070 (9.8%); 4532 / 4564 | 400,241 (7.9%); 3923 / 3955 | H1, hero note, then a 32px shift plus 8 card subtitles |
| mlb-giants | 606,176 (10.0%); 15308 / 15533 | 766,924 (8.5%); 11606 / 11733 | 1,140,624 (9.5%); 9129 / 9341 | Hero (y 102 at 390) onward |
| nhl-wild | 326,247 (7.7%); 10902 / 10898 | 392,123 (5.9%); 8611 / 8591 | 402,167 (4.5%); 7027 / 6979 | From the resale line under the rail pair (y 1390 at 390, y 686 at 1280) |
| promo | 226,752 (12.2%); 4699 / 4775 | 252,039 (9.3%); 3469 / 3512 | 302,360 (6.9%); 3363 / 3406 | From the primary button label (y 393 at 390) |
| event stop | 159,014 (9.2%); 4372 / 4431 | 197,271 (7.2%); 3507 / 3549 | 200,775 (4.7%); 3298 / 3325 | The 8 buttons in place (eight 47px bands), then everything after the last showtime (y 1483 at 390) |

At 1280 every page also differs in a 10px band at y 22 to 32: the header `Events` link.

### 1.3 Measurements that moved

| Page | Measurement | Production | Branch |
|---|---|---|---|
| home | Document height 390 / 768 / 1280 | 11379 / 8173 / 6863 | 11011 / 7799 / 6490 |
| home | Interactive elements, 390 | 126 | 116 |
| home | Hit targets under 44 in content, 390 | 59 | 52 |
| home | Contrast failures, 390 (own measure / axe) | 12 / 8 | 9 / 7 |
| home | `/promos/` links DOM / visible, 390 | 50 / 32 | 47 / 29 |
| mlb | Hero height 390 / 768 / 1280 | 510 / 453 / 396 | 542 / 485 / 428 (+32, the hero note) |
| mlb-giants | Rail ticket stack height 390 / 768 / 1280 | 127.5 / 127.5 / 127.5 | 171.1 / 154.3 / 171.1 |
| mlb-giants | First ad anchor from top 390 / 768 / 1280 | 674 / 625 / 488 | 594 / 545 / 520 |
| mlb-giants | axe label-content-name-mismatch | 2 | 1 |
| nhl-wild | Rail ticket stack height 390 / 768 / 1280 | 127.5 / 127.5 / 127.5 | 171.1 / 154.3 / 171.1 (+43.6 / +26.8 / +43.6) |
| nhl-wild | Game dialog ticket stack (TICKETS on a row) | 95.5 | 137.1 at 390; 120.3 at 768 and 1280 |
| nhl-wild | Calendar day panel card height | 138 | 179 at 390; 162 at 768 and 1280 |
| nhl-wild | axe label-content-name-mismatch 390 / 768 / 1280 | 6 / 16 / 16 | 5 / 15 / 15 |
| promo | CTA section height 390 / 768 / 1280 | 251.8 / 199.8 / 199.8 | 295.4 / 226.6 / 226.6 (+43.6 / +26.8 / +26.8) |
| promo | Promo image top, 390 | 642 | 685 |
| event stop | Showtime button width 390 / 768 / 1280 | 93.5 / 93.5 / 93.5 | 97.0 / 123.4 / 123.4 |
| event stop | Time and label column width, 390 | 158.5 | 155.0 |
| event stop | Showtime row height, all viewports | 88 | 88 |
| event stop | Show label lines, 390 | 1 | 1 |
| event stop | `Pick your show` section height 390 / 768 / 1280 | 993.0 / 977.6 / 977.6 | 1052.0 / 1019.8 / 1004.4 (+59.0 / +42.2 / +26.8) |

The event stop section growth is the resale line plus its gap (43.6px at 390, 26.8px at 768 and 1280) and one more line of disclosure at 390 and 768 (15.4px). The showtime rows did not grow.

Did not move on any of the seven pages: horizontal overflow (scrollWidth equals clientWidth at every viewport in both environments, no element past the right edge), cumulative layout shift (largest 0.042 on `/mlb` at 768 in both), page errors (0). `/venues` did not move at all outside the intro text: same height, same intro height (97.5 at 390, 48.8 at 768 and 1280).

### 1.4 Differences that come from the dev environment, not from the diff

- **Ticketmaster links are unwrapped on the dev server.** Production: `https://ticketmaster.evyy.net/c/7236189/264167/4272?u=...&sharedid=web_team_page_minnesota-wild` (and `...&sharedid=web_promo_page_chicago-blackhawks&subId3=spencer-knight-bobblehead` on the promo page). Branch: `https://www.ticketmaster.com/minnesota-wild-tickets/artist/805974`. `src/lib/affiliates.ts` reads the wrap from `NEXT_PUBLIC_TICKETMASTER_IMPACT_WRAP`, which the dev server evidently lacks. The Ticketmaster wrap therefore could not be confirmed on the branch render.
- **eBay rows are absent on the dev server.** Production Wild page shows `Missed it? Check resale on eBay` twice; the branch render shows neither: 2 fewer interactive elements and about 97px less height, which is why the branch Wild page is 4px shorter at 390 although the rail grew 44px and the disclosure grew.
- One dev server load of `/events/monster-jam/rocket-arena` at 360 answered 500 during the recapture and 200 on the next request, shortly after the worktree changed. Not seen again.

### 1.5 Expected from earlier branches

Present, not reviewed in depth: header `Events` link from 860px and in the mobile sheet; homepage Best Promos rail removed by the rail floor (most of the 390 height drop, 3 fewer promo links, 7 fewer small targets, 3 fewer contrast failures); card title sizing on the 8 Tonight cards; `/mlb` title, H1 and hero note naming 2027; the Giants page naming 2027 throughout (title, subhead, `2027 SEASON PROMOS`, pattern copy, FAQ), the `Still to come` eyebrow and a four tile hero; homepage gameday utility counts `201 / 202 / 109`.

## 2. Game date check

Today is Wednesday 2026-11-25. Dates read on both environments; branch re-read at 11:53 AM CST.

| Page | Dates read | Today in venue zone | Verdict |
|---|---|---|---|
| promo (Spencer Knight Bobblehead) | Game line `Sunday, Nov 29, 2026 · 1:00 PM CT`; `<time datetime="2026-11-29T13:00:00-06:00">`; JSON-LD Event `startDate` `2026-11-29`; tile `IN 4 DAYS` | 2026-11-25, America/Chicago | Upcoming. Not a played game. |
| event stop (Anaheim) | 8 showtime rows and 8 JSON-LD Events, `2026-12-19T16:30:00-08:00` to `2027-02-21T14:30:00-08:00`; hero `24 DAYS AWAY` | 2026-11-25, America/Los_Angeles | All 8 upcoming. No row with a passed start time shows a ticket button. |
| nhl-wild | 4 JSON-LD Events `2026-11-25`, `2026-11-27`, `2026-12-12`, `2026-12-22`; first row Nov 25 7:00 PM | 2026-11-25 11:53 AM, America/Chicago | All upcoming; tonight's game has not started. Oct 12 and Oct 29 sit under `COMPLETED 2026-27 PROMOS` with a COMPLETED chip and no ticket button. |
| mlb-giants | 20 JSON-LD Events `2027-03-25` to `2027-05-15` | 2026-11-25, America/Los_Angeles | All upcoming. 114 played 2026 events sit under `COMPLETED 2026 PROMOS`. |
| home | Tonight rail, 8 cards all `NOV 25`, 5:00 PM to 7:30 PM | 2026-11-25, about 1 PM ET | All later today. |
| promos/today (branch) | 15 cards `NOV 25` (5:00 PM to 7:30 PM), 1 card `NOV 26` under its own `Thursday, November 26` heading | 2026-11-25, about 1 PM ET | None played. |
| venues, mlb | No game dates, no Events | n/a | Nothing to check. `/mlb` says `No MLB promos today`, which is true. |

Nothing on any reviewed page presents a past game or date as upcoming.

## 3. What a first-time visitor sees (390, branch)

- **home** (`home/390-branch-fold.png`): dark hero, `FIND THE GAMES WORTH GOING TO.`, two buttons, four stats ending `203 VENUE GUIDES`. First scroll: `TONIGHT`, `8 of 15 promos at games starting today.`, `ALL TONIGHT'S PROMOS`, the ticket stub rail. Second scroll: gameday cards, then category tiles with `TODAY ... 15 promos` first.
- **venues** (`venues/390-branch-fold.png`): `STADIUM & ARENA GUIDES`, a four line intro, the MLB bag policy card, then the alphabetical MLB list.
- **mlb** (`mlb/390-branch-fold.png`): `MLB PROMOTIONS 2027`, the hero note, two all-time stats, `No MLB promos today`. `Browse by team` starts about 1,250px down.
- **mlb-giants** (`mlb-giants/390-branch-fold.png`): hero with four tiles and `42 promotions announced so far for the 2027 season`, then the calendar already on `MARCH 2027`.
- **nhl-wild** (`nhl-wild/390-branch-fold.png`): hero, five tiles, `6 promotions in the 2026-27 season, 4 still to come`, calendar on November. The ticket pair is a scroll and a half down (y 1252): two white cards, both `Get Tickets`, the resale line under the pair, then parking, hotels, gear.
- **promo** (`promo-knight-bobblehead/390-branch-top.png`): title, matchup, `Sunday, Nov 29, 2026 · 1:00 PM CT`, venue link, date tile, `Get Tickets` and `Share`, the resale line centred under them, `Also on Ticketmaster`, `Stream on Fubo`, three secondary buttons. The image starts at y 685, inside the first screen.
- **event stop** (`event-stop-anaheim/390-branch-fold.png`): photo, `MONSTER JAM ANAHEIM`, venue, `8 shows between Dec 19, 2026 and Feb 21, 2027`, `PICK YOUR SHOW`, and the first showtime card with a red `Get Tickets` button at the fold.
- **promos/today** (`promos-today/390-branch-fold.png`): `SPORTS PROMOS TODAY`, the date in red, a four line lede, league pills, the first card and its three logo tiles at the fold.

## 4. Three things that work

1. **The showtime rows hold at 390 on every Monster Jam stop.** With `Get Tickets` at 14px and 12px padding the button is 97px, 3.5px wider than production's `Tickets`. Across all 20 stops (64 rows) at 390 no time wraps, `12:00 PM` included (137.9px in a 155px column), no show label wraps, and row height stays 88. `event-stop-anaheim/390-branch-shows.png`, `event-stop-anaheim/390-branch-rocket-arena-shows.png`.
2. **The counts agree with each other and with the pages behind them.** Homepage lede `8 of 15`, 8 cards in the rail, Today tile `15 promos`, and `/promos/today` renders 15 cards dated today (NBA 3, NHL 12). Hero `203 VENUE GUIDES` equals the `/venues` intro `203` equals 203 distinct venue links. `verified` appears nowhere on `/venues`, and the listing-rule sentence is gone. All 30 `/mlb` card labels are true: the 8 marked `2027 promotions published` (Orioles, Rangers, Braves, Marlins, Phillies, Reds, Pirates, Giants) lead to pages with 8 to 73 promos dated 2027, the other 22 to pages with none; at 390 the line is one line, untruncated, card height unchanged at 68.
3. **The resale line is readable on every surface and cannot be taken for Ticketmaster's.** It opens with the word `TicketNetwork`, sits 10px under the TicketNetwork button (8px in the game dialog and day panel) and never directly under a Ticketmaster control. Contrast, 12px text: 6.95:1 on cream (team rail, `#57534d` on `#f7f3ea`), 7.35:1 on white (game dialog, day panel), 8.1:1 where the light tone is set (promo page, event stop, `/promos/today`), 11.17:1 on the dark CFB page (`#c1c1c3` on `#08070d`, `cfb-minnesota/390-branch-note-1.png`). The rewritten aria-labels cleared axe: the Ticketmaster rail button is no longer flagged, no TicketNetwork control is flagged, and the Wild count drops from 6 / 16 / 16 to 5 / 15 / 15.

Also working: the played state on the Wild and Giants pages; no horizontal overflow at any width on any page including `/promos/today` at 360 and `/cfb/minnesota`; `/promos/today` is 464px shorter at 390 than the per-card build (6747 against 7211) and its tiles are back to three 40px logo tiles.

## 5. Defects

Severity: high blocks the change as built; medium is a visible flaw a fan meets; low is polish or a carried-over issue. No high defect was found on `126ce9e`.

**1. Medium. Giants team page, all viewports. The calendar opens on March 2027 as intended, and that month looks nearly empty and does nothing.**
All 31 day cells are disabled buttons. Two cells (27 and 28) carry a red Hot dot; Opening Day on the 25th, Fiesta Gigantes on the 27th and SF State Night on the 30th carry no mark. The legend lists Home, Away, Giveaways, Theme Nights, Food Deals and Kids & Family, none of which appears on the grid. Tapping a dotted day does nothing. April shows one dot. The served HTML for the Braves (April 2027) and Orioles (February 2027) pages has the same all-disabled grid. A fan reads `42 promotions announced so far`, looks at the calendar directly under it, and sees two dots. `mlb-giants/390-branch-calendar.png`. On production the same calendar opens on an empty November 2026; its March grid was not checked. The branch's change is that this state is now the first thing shown.

**2. Medium. `/promos/today`, 390 and 360. The resale line is too far from the tiles it describes.**
It prints once at the end of each league group, after the last card's Fubo line. In the NHL group the first TicketNetwork tile is at y 1675 and the line at y 4647, about three and a half screens later; a fan who taps a TicketNetwork tile on any of the first eleven NHL cards has not passed it. Where it does appear it reads as an orphan between the last card and the next league heading, attached to nothing. `promos-today/390-branch-group-note.png`. The tiles themselves are logo only at both widths (as in production), so nothing at the tile says resale.

**3. Medium. Anaheim stop, 390. The resale line comes after all eight buttons.**
First `Get Tickets` button at y 750, line at y 1561: a full screen below the first tap target, and directly above a disclosure whose new last sentence says the same thing again, so the page ends the section with two consecutive small paragraphs about TicketNetwork resale. `event-stop-anaheim/390-branch-shows.png`. On a one show stop the line is right under the button.

**4. Medium. `/promos/today`, all viewports, branch (production not loaded). The lede calls promos games.**
`15 games today have promotions across NBA and NHL`. There are 15 promos at 9 home games. The homepage now says `8 of 15 promos at games starting today` and the tile `15 promos`; the page they lead to turns the same 15 into games. The file is not in this diff.

**5. Low. Team pages, all viewports. Two buttons with the same words, told apart by a small logo.**
Both cards read `Get Tickets`, same border, weight and arrow. The Ticketmaster wordmark is 99x26; the TicketNetwork logo is 75x20 with much finer lettering. The line under the pair names TicketNetwork, which is what tells a fan the second button is the resale one. `nhl-wild/390-branch-rail.png`. Recorded as what a fan sees, not as a comment on the wording, which is the owner's ruling.

**6. Low. Event stops, 360, same as production by geometry. `12:00 PM` wraps to two lines.**
At 360 the time column is 125px (production's would be 128.5px); `12:00 PM` needs 137.9px. 12 rows on 8 stops wrap to `12:00` over `PM`, and the longer show labels wrap on 19 of 20 stops. No text falls between 125 and 128.5px, so production wraps the same rows; production was not captured at 360. `event-stop-anaheim/360-branch-rocket-arena-shows.png`. Anaheim's own times (`4:30 PM`, 119.3px) fit at 360.

**7. Low. `/mlb`, all viewports. The 8 marked cards still fail axe.**
aria-label is now `Baltimore Orioles 2027 promotions published`, so the mark reaches a screen reader. axe `label-content-name-mismatch` still flags all 30 team cards in both environments (60 nodes with the 30 venue cards): the name and subtitle are adjacent block spans with no whitespace between them, so the DOM text reads `Baltimore Orioles2027 promotions published`.

**8. Low. Team pages. Remaining label-content-name-mismatch nodes, both environments.**
SpotHero button (`Reserve parking on SpotHero` against `P SpotHero Reserve Parking`), 1 per page, and the calendar day buttons (`2026-11-25 details` against `25 VS UTA`), 4 at 390 and 14 at 768 and 1280 on the Wild page. On `/promos/today` 16, all SpotHero tiles.

**9. Low. `/promos/today`, 390 and 360. Tiles are 40px tall and two run into their padding at 390.**
All 48 tiles are 40px, under 44. At 390 the SpotHero tile's content is 132px in a 127px box and the Ticketmaster tile's 109px in 106px; the arrow sits 3px from the border, nothing is cut. At 360 the arrows drop out and everything fits. Production layout, not from this diff.

**10. Low. Promo page, 390. The CTA column is seven stacked items.**
Button row, resale line (two lines, centred), `Also on Ticketmaster`, `Stream on Fubo`, `Availability varies by market.`, Parking and Hotels, Remind me. Section height 251.8 to 295.4. One line and +27px at 768 and 1280. `promo-knight-bobblehead/390-branch-cta.png`.

**11. Low. Promo pages, both environments. Small ticket links.** `Also on Ticketmaster` is 133x21.

**12. Low. Carried over, both environments.** `/mlb` at 768: 22 of 30 team names cut with an ellipsis and every subtitle on two lines. Home hero at 390: the four stats wrap two and two with a divider left hanging after `169 TEAMS`. Game dialog ticket buttons are 43px tall. Calendar day cells are 41x41. Contrast: the `NIGHT` half of the logo at 4.33:1 everywhere, `BAL` on its orange chip 4.29:1 on `/mlb`, league chips on home (`NHL` 1.65:1), `Download for iOS` 3.76:1.

Dropped from the earlier pass because the rebuild removed them: the showtime wrapping at 390 beside the `Resale tickets` button, the wrapped show labels and 120px growth on Anaheim, the per-card resale line on `/promos/today` and its failing contrast under the dimmed card, the unreadable logo in the stacked tile, the `Get Tickets` and `Resale tickets` casing mismatch, the Ticketmaster rail button failing axe, and the left aligned line on the promo page.

## 6. Walk as a fan (branch, 390)

Navigation taps were run on `5fde2d9`; the link targets are unchanged in the `126ce9e` HTML, where the labels, dialog and day panel were re-read.

| Step | Result |
|---|---|
| Promo primary CTA | `Get Tickets`, new tab at `ticketnetwork.lusg.net`, which answered 302 to `www.ojrq.net/p/` (one hop followed, once). Event: Blackhawks vs Wild, Sun Nov 29 2026, United Center. `subId1=web_promo_page_chicago-blackhawks`, `subId3=spencer-knight-bobblehead`. |
| Promo `Also on Ticketmaster` | `www.ticketmaster.com/chicago-blackhawks-tickets/artist/805913` on the dev server (unwrapped, see 1.4). |
| Event stop first showtime | `Get Tickets`, `ticketnetwork.lusg.net` 302 to `www.ojrq.net/p/`. Each of the 8 buttons carries its own TicketNetwork event id. |
| Home Tonight card | `76ers Cup Games Rally Towel` to H1 `76ERS CUP GAMES RALLY TOWEL`. Back restored (669 to 669). |
| Home Today tile | `TODAY ... 15 promos` to H1 `SPORTS PROMOS TODAY`. First back returned to y 48 while the dev server compiled `/promos/today` for the first time; two retests restored exactly (2127). |
| `/mlb` marked card | `Baltimore Orioles 2027 promotions published` to H1 `BALTIMORE ORIOLES`, title `... Giveaways 2027`. Back restored. |
| Wild promo row | `Hometown Remix Jersey Towel` to matching H1. Back restored (2660). |
| Wild row `TICKETS` | Game dialog: `vs Utah Mammoth 7:00 PM CST`, two `Get Tickets` cards, resale line under the pair. `nhl-wild/390-branch-row-open.png`. |
| Wild calendar day Nov 27 | Inline day panel with the same pair and line. `nhl-wild/390-branch-day-panel.png`. |
| Promo rail card | `Black Friday` to H1 `BLACK FRIDAY`. Back restored (2168). |
| Event stop other-stop card | `SALT LAKE CITY Delta Center` to H1 `MONSTER JAM SALT LAKE CITY`. Back restored. |
| Giants first row | `Opening Day` to H1 `OPENING DAY`. Back restored. |
| Venues card | `Busch Stadium` to H1 `Busch Stadium Bag Policy`. Back restored. |

## 7. Measurements

390 unless a viewport is named. `u44` is interactive elements under 44x44 inside the page content (header and footer excluded). `Promo links` is `<a>` to `/promos/` in the DOM / visibly rendered. `Ad anchor` is the distance from the top of the document to the first `data-ad-region` or `data-ad-item`. `lcnm` is axe label-content-name-mismatch.

| Page | Metric | Production | Branch |
|---|---|---|---|
| home | Height 390 / 768 / 1280 | 11379 / 8173 / 6863 | 11011 / 7799 / 6490 |
| home | scrollWidth / clientWidth | 390 / 390 | 390 / 390 |
| home | CLS | 0.0249 | 0.0249 |
| home | u44 | 59 | 52 |
| home | Contrast failures; axe serious | 12; color-contrast 8 | 9; color-contrast 7 |
| home | lcnm | 0 | 0 |
| home | Promo links | 50 / 32 | 47 / 29 |
| home | Ad anchor | 57 | 57 |
| venues | Height 390 / 768 / 1280 | 14623 / 7773 / 5754 | 14623 / 7773 / 5754 |
| venues | scrollWidth / clientWidth | 390 / 390 | 390 / 390 |
| venues | CLS | 0 | 0 |
| venues | u44 | 237 (venue rows are 342x41) | 237 |
| venues | Contrast failures; axe serious | 1; color-contrast 1 | 1; color-contrast 1 |
| venues | lcnm | 231 | 231 |
| venues | Promo links | 8 / 6 | 8 / 6 |
| venues | Ad anchor | 57 | 57 |
| mlb | Height 390 / 768 / 1280 | 8375 / 4532 / 3923 | 8406 / 4564 / 3955 |
| mlb | scrollWidth / clientWidth | 390 / 390 | 390 / 390 |
| mlb | CLS 390 / 768 | 0.0261 / 0.0419 | 0.0256 / 0.0414 |
| mlb | u44 | 37 | 37 |
| mlb | Contrast failures; axe serious | 2; color-contrast 2 | 2; color-contrast 2 |
| mlb | lcnm | 60 | 60 |
| mlb | Team card height 390 / 768 / 1280 | 68 / 86.8 / 68 | 68 / 86.8 / 68 |
| mlb | Promo links | 13 / 11 | 13 / 11 |
| mlb | Ad anchor | 57 | 57 |
| mlb-giants | Height 390 / 768 / 1280 | 15308 / 11606 / 9129 | 15533 / 11733 / 9341 |
| mlb-giants | scrollWidth / clientWidth | 390 / 390 | 390 / 390 |
| mlb-giants | CLS | 0 | 0 |
| mlb-giants | u44 | 140 | 141 |
| mlb-giants | Contrast failures; axe serious | 3; color-contrast 1 | 3; color-contrast 1 |
| mlb-giants | lcnm | 2 | 1 |
| mlb-giants | Calendar month on load | November 2026 | March 2027 |
| mlb-giants | Rail ticket stack 390 / 768 / 1280 | 127.5 / 127.5 / 127.5 | 171.1 / 154.3 / 171.1 |
| mlb-giants | Promo links | 64 / 62 | 64 / 62 |
| mlb-giants | Ad anchor 390 / 768 / 1280 | 674 / 625 / 488 | 594 / 545 / 520 |
| nhl-wild | Height 390 / 768 / 1280 | 10902 / 8611 / 7027 | 10898 / 8591 / 6979 |
| nhl-wild | scrollWidth / clientWidth | 390 / 390 | 390 / 390 |
| nhl-wild | CLS | 0 | 0 |
| nhl-wild | u44 | 73 | 71 (the two eBay rows, see 1.4) |
| nhl-wild | Contrast failures; axe serious | 3; color-contrast 1 | 3; color-contrast 1 |
| nhl-wild | lcnm 390 / 768 / 1280 | 6 / 16 / 16 | 5 / 15 / 15 |
| nhl-wild | Rail ticket stack 390 / 768 / 1280 | 127.5 / 127.5 / 127.5 | 171.1 / 154.3 / 171.1 |
| nhl-wild | Rail buttons | 342x59.5, 342x58 | 342x59.5, 342x58 |
| nhl-wild | Promo links | 37 / 35 | 37 / 35 |
| nhl-wild | Ad anchor 390 / 768 / 1280 | 672 / 599 / 520 | 672 / 599 / 520 |
| promo | Height 390 / 768 / 1280 | 4699 / 3469 / 3363 | 4775 / 3512 / 3406 |
| promo | scrollWidth / clientWidth | 390 / 390 | 390 / 390 |
| promo | CLS | 0.0290 | 0.0290 |
| promo | u44 | 12 | 12 |
| promo | Contrast failures; axe serious | 1; color-contrast 1 | 1; color-contrast 1 |
| promo | lcnm | 0 | 0 |
| promo | Primary button | 144.5x52 | 144.5x52 |
| promo | CTA section 390 / 768 / 1280 | 251.8 / 199.8 / 199.8 | 295.4 / 226.6 / 226.6 |
| promo | Promo links | 19 / 17 | 19 / 17 |
| promo | Ad anchor | 57 | 57 |
| event stop | Height 390 / 768 / 1280 | 4372 / 3507 / 3298 | 4431 / 3549 / 3325 |
| event stop | scrollWidth / clientWidth | 390 / 390 | 390 / 390 |
| event stop | CLS | 0.0002 | 0.0002 |
| event stop | u44 | 0 | 0 |
| event stop | Contrast failures; axe serious | 1; color-contrast 1 | 1; color-contrast 1 |
| event stop | lcnm | 0 | 0 |
| event stop | Showtime button 390 / 768 / 1280 | 93.5x48 | 97x48 / 123.4x48 / 123.4x48 |
| event stop | Showtime row height | 88 | 88 |
| event stop | `Pick your show` section 390 / 768 / 1280 | 993.0 / 977.6 / 977.6 | 1052.0 / 1019.8 / 1004.4 |
| event stop | Promo links | 8 / 6 | 8 / 6 |
| event stop | Ad anchor | 57 | 57 |
| promos/today | Height 390 / 360 | not loaded | 6747 / 6963 |
| promos/today | scrollWidth / clientWidth at 390, at 360 | not loaded | 390 / 390, 360 / 360 |
| promos/today | CLS | not loaded | 0.0001 |
| promos/today | u44 | not loaded | 72 (48 of them the 40px tiles) |
| promos/today | axe serious | not loaded | color-contrast 11 |
| promos/today | lcnm | not loaded | 16, all SpotHero tiles |
| promos/today | Ticket row tiles 390; 360 | not loaded | 108.3x40, 108.3x40, 129.3x40; 98.3x40, 98.3x40, 119.3x40, on all 16 cards |
| promos/today | Resale lines on the page | not loaded | 3, one per league group, 8.1:1 |
| cfb/minnesota | scrollWidth / clientWidth | not loaded | 390 / 390 |
| cfb/minnesota | Resale line | not loaded | 12px, two lines, 11.17:1, 10px under the TicketNetwork button |

Resale line, every placement: 12px, line height 16.8px. Two lines at 390 everywhere and in the 336px desktop rail; one line elsewhere at 768 and 1280.

## 8. Recommendation

Merge is not blocked by anything in this list. Before it goes out, move the resale line to where the tap happens on the two pages where it is now a screen or more away from the button it explains (`/promos/today` league groups and multi-show event stops, defects 2 and 3), since a line a fan passes only after tapping does not do its job; the Giants calendar (defect 1) and the `/promos/today` lede (defect 4) each need a known-issues entry if they are not fixed with it.

## 9. Disposition (added by the build session, 2026-11-25)

The review ran at 126ce9e. One change followed it: the disclosure's TicketNetwork sentence became conditional, so the event stop no longer prints the resale line and that sentence back to back, and Ticketmaster-only club pages do not name TicketNetwork. Each defect is fixed, deferred with a line in known-issues 130, or waived with a reason.

| # | Disposition |
|---|---|
| 1 | Deferred, known-issues 130 (early team page calendar is inert: no 2027 games in the schedule yet). |
| 2 | Deferred, known-issues 130, and put to the owner at the gate. The ruling asks for one line per group; on the daily board that puts the line far from the tap. |
| 3 | Partly fixed: the duplicate sentence in the disclosure under the line is gone. The placement (one line after all eight buttons) follows the ruling; deferred, known-issues 130. |
| 4 | Deferred, known-issues 130. Not in this diff; on production too. |
| 5 | Waived: by ruling every ticket button reads "Get Tickets"; the cards differ by logo and the line under the pair. Logged in known-issues 130. |
| 6 | Deferred, known-issues 130. By geometry production wraps the same rows. |
| 7 | Deferred, known-issues 130. On production too. |
| 8 | Waived: SpotHero and the calendar day buttons are outside this diff and identical on production. |
| 9 | Waived: production layout, untouched by this diff. |
| 10 | Waived: the seventh item is the resale line the ruling requires. |
| 11 | Waived: identical on production. |
| 12 | Waived: carried over, identical on production. |

Screenshots stay local and are not committed, as with earlier reports.
