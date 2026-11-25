# ux-review: ticket partner test (StubHub arm vs TicketNetwork arm), baseline mode

Run of 2026-11-25 (America/New_York). Reviewer: ux-review agent. No source file was edited and nothing was committed.

| | |
|---|---|
| Branch | `feature/stubhub-test`, tip `e3b675e`, worktree `promonight-web-stubhub` |
| Branch render | dev server at `http://localhost:3100`, ticket partner test ON, server clock SIMULATED to 2026-12-02 |
| Branch deployment marker | none. The dev server HTML carries no `<meta name="promonight-deploy">` |
| Production render | `https://www.getpromonight.com`, `<meta name="promonight-deploy" content="dpl_9SWKwAtmbvqw5CZnAL51EfyGwpzz">`, real date 2026-11-25 |
| Widths | 390x844, 768x1024, 1280x800, every page on both hosts |
| Browser | Playwright Chromium, desktop Chrome User-Agent, real browser clock on both hosts |

Pages (same path on both hosts):

1. `/nhl/detroit-red-wings` (team page, StubHub arm)
2. `/nhl/detroit-red-wings/promos/ugly-sweater` (promo page, StubHub arm, game 2026-12-12)
3. `/nhl/minnesota-wild` (team page, TicketNetwork arm)
4. `/nhl/minnesota-wild/promos/ornament` (promo page, TicketNetwork arm, game 2026-12-12)

Screenshots, diff images and interaction captures are in `2026-11-25-ticket-partner-test/<slug>/`, named `<width>-<env>.png`, `<width>-diff.png`, and on the two team pages `<width>-<env>-row-expanded.png`, `<width>-<env>-calendar-home.png`, `<width>-<env>-calendar-away.png`. Slugs: `detroit-red-wings`, `detroit-red-wings-ugly-sweater`, `minnesota-wild`, `minnesota-wild-ornament`.

A note on the clock. Only the branch server is simulated. I rendered the branch once with the browser clock also set to 2026-12-02 and once with the real browser clock, on all four pages at 390: the main content text was identical, so every capture below uses the real browser clock.

## Verdict in one paragraph

The change does what it says on all four pages at all three widths. I found no defect that the change introduces to layout, overflow, contrast or tap size. There are two things to settle before merge, neither visible to a fan on the page: the Red Wings sidebar card opens one game's StubHub page although its label names no game (defect 1), and on this dev server the promo pages' served bytes carry the other arm's event URL in the flight payload, which I could not prove or disprove for a production build (defect 2). Everything else in the defect list is cosmetic or was already on production.

## 1. Baseline differences

### 1a. Expected, date driven (listed once, not defects)

The branch server believes it is 2026-12-02, production knows it is 2026-11-25. That alone produces:

- Team pages: the calendar opens on December 2026 instead of November 2026; "17 still to come" reads "15 still to come" (Red Wings); filter chip counts drop (Giveaways 2 to 1, Theme Nights 13 to 12); the Nov 25 to Dec 1 games leave the upcoming list and join the completed list; "Ticket packages (39)" reads "(37)"; one FAQ heading reads "in 2027?" where production reads "in 2026?"; JSON-LD Event lists start later (Red Wings 15 Events from 2026-12-11, production 17 from 2026-11-25; Wild 2 Events, production 4); production's "Missed it? Check resale on eBay" links for just-played games are absent.
- Promo pages: the day tile reads "In 10 days" instead of "In 17 days"; the This game label reads "This month" instead of "In December"; the two rails ("More ... promos", "More NHL ... coming up") start at Dec 2 or later instead of Nov 25. On the Wild promo page the team rail holds one card instead of three and draws it in the single-card layout ("DEC 22 Nightlight vs Kings · 7:00 PM").
- Document heights differ on every page for the same reason (table in section 5).

### 1b. Served HTML of the main content

Compared `<main>` (every page has an `<article>` inside it, and the team page sidebar sits outside the article, so `<main>` is the superset) from the HTML each host served, with scripts, styles, comments, nonces and the flight payload stripped. Not identical on any page, as expected. Regions that differ, apart from 1a:

| Page | Region | Production | Branch |
|---|---|---|---|
| Both team pages | Sidebar "Plan your visit" ticket control | two `<a>` cards, Ticketmaster then TicketNetwork | one `<a>` card inside `<div data-ticket-test="a">`: StubHub (Red Wings), TicketNetwork (Wild) |
| Both team pages | Line under the sidebar cards | `TicketNetwork is a resale marketplace. Prices may differ from face value.` | `PromoNight may earn a commission on ticket purchases made through these links. Resale prices may differ from face value.` (`<p data-ticket-test-note>`) |
| Both team pages | Each server-rendered game panel (7 on the Red Wings branch page, 9 on Wild) | two cards plus the resale line | one card plus the new line |
| Both promo pages | Primary button `href` | `https://ticketnetwork.lusg.net/c/...` | Red Wings: `https://stubhub.prf.hn/click/camref:.../pubref:web-nhl-a/destination:...stubhub.com/detroit-red-wings-detroit-tickets-12-12-2026/event/161328926/`. Wild: unchanged `https://ticketnetwork.lusg.net/c/...` |
| Both promo pages | Primary button `aria-label` | "Get Tickets for Detroit Red Wings vs Panthers on TicketNetwork" | Red Wings: "... on StubHub". Wild: unchanged |
| Both promo pages | Line under the button | `<p data-resale-note>` resale sentence | `<p data-ticket-test-note>` commission sentence, same classes |
| Both promo pages | Secondary link | `Also on Ticketmaster` (`ticketmaster.evyy.net`) | removed |
| All four pages | Affiliate disclosure at the foot of `<main>` | `PromoNight may earn a commission on purchases made through links on this page. Prices and availability are set by the listed partners. Tickets on TicketNetwork are resold by other sellers, so a price there can be above or below face value.` | the first two sentences only |

Counts in the served bytes (whole document, `grep -o | wc -l`): "may earn a commission on ticket purchases" 9, 2, 11, 2 on the four branch pages (each count is the markup instances plus one copy in the flight payload: 8, 1, 10 and 1 rendered notes) and 0 on production; "is a resale marketplace" 0 on the branch; "resold by other sellers" 0 on the branch; "Also on Ticketmaster" 0 on the branch.

One difference that is not part of this change: production's header and footer carry an "Events" link, the branch render does not (see defect 5).

### 1c. Pixel comparison (ad slots masked)

Diff images are `<slug>/<width>-diff.png`. The comparison covers the shorter of the two documents.

| Page | Width | Differing pixels | Share | First differing row |
|---|---|---|---|---|
| Red Wings team | 390 | 566,876 | 8.33% | y=657 (the "still to come" count line) |
| Red Wings team | 768 | 756,089 | 6.84% | y=551 |
| Red Wings team | 1280 | 721,302 | 4.60% | y=22 (header "Events" link) |
| Red Wings promo | 390 | 157,368 | 8.12% | y=362 (first text row of the note under the button) |
| Red Wings promo | 768 | 161,213 | 5.27% | y=362 |
| Red Wings promo | 1280 | 279,015 | 5.50% | y=22 (header "Events" link), then y=362 |
| Wild team | 390 | 587,377 | 12.70% | y=623 |
| Wild team | 768 | 661,936 | 8.65% | y=551 |
| Wild team | 1280 | 849,606 | 7.87% | y=22 (header "Events" link) |
| Wild promo | 390 | 170,179 | 9.25% | y=362 |
| Wild promo | 768 | 291,978 | 10.03% | y=362 |
| Wild promo | 1280 | 288,701 | 5.99% | y=22, then y=362 |

Where the pixels differ. On the promo pages rows 0 to 361 are pixel identical at 390 and 768, which covers the header, breadcrumb, badge, H1, game line, venue line, the Get Tickets button and the Share button. From y=362 down the difference is the note text, then every section sitting 14px higher, then the date driven rails. On the team pages the differences are the hero count line, the calendar month, the sidebar ticket control, and everything below it sitting higher. The dev-only Next.js badge (bottom left) and the sticky footer ad and floating video player, which a full-page capture paints at one viewport position, also show in the diff images and are not page content.

### 1d. Measurements that moved

- Promo pages, all widths: every section below the button sits 14 to 15px higher on the branch (H2 "About this ...", "This game", "Before you go", the team rail). Cause: "Also on Ticketmaster" (21px line plus gap) is gone and the note is one line taller. Section order is unchanged.
- Promo pages, "Stream on Fubo" link (101x44 on both hosts): Red Wings y=531 branch against 545 production at 390, 494 against 508 at 768 and 1280. Wild y=412 against 426 at 390, 395 against 410 at 768 and 1280. Same x on both hosts. It now follows the package disclosure (Red Wings) or the note (Wild) directly.
- Team pages, sidebar modules below the ticket control (SpotHero, hotels, Fanatics, Full gameday guide, "Game day at ..."): same order, 68 to 69px higher at 390 and 768, 52 to 53px higher at 1280. Cause: one card instead of two, less the extra note line at 1280. "Plan your visit" itself is at the same y on both hosts (1450 Red Wings and 1416 Wild at 390, 520 at 1280).
- Note height: promo button column 254x50 (3 lines) against 254x34 (2 lines) at 390, 34 (2 lines) against 17 (1 line) at 768 and 1280. Team sidebar 342x34 (2 lines) on both hosts at 390, 720x17 (1 line) on both at 768, 336x50 (3 lines) against 336x34 (2 lines) at 1280.
- Ticket partner links in the DOM: Red Wings team 8 against 20, Wild team 10 against 20, promo pages 1 against 2.
- First ad anchor at 390: unchanged on all four pages (706, 57, 672, 57). Ad anchor counts on the Red Wings team page are 11 on both hosts; on the Wild team page 3 against 5, which follows the shorter upcoming list.
- CLS during load: 0 to 0.0002 on the branch on every page; production 0 to 0.0314, the non-zero values coming with ad fill (table in section 5).
- Interactive elements under 44x44 at 390: one fewer class on the branch promo pages (the 133x21 "Also on Ticketmaster" link is gone). No new undersized target on any page.

## 2. Game date check

| Page | Dates read | Today in the venue zone | Verdict |
|---|---|---|---|
| Red Wings promo | Game line `<time datetime="2026-12-12T19:00:00-05:00">` "Saturday, Dec 12, 2026 · 7:00 PM ET"; JSON-LD Event `startDate` 2026-12-12 (one Event) | Branch: 2026-12-02 (simulated), Detroit, Eastern. Production: 2026-11-25 | Upcoming on both hosts. Not a played game. Day tile "In 10 days" (branch) and "In 17 days" (production) are both right for their clocks |
| Wild promo | Game line `<time datetime="2026-12-12T14:30:00-06:00">` "Saturday, Dec 12, 2026 · 2:30 PM CT"; JSON-LD Event `startDate` 2026-12-12 (one Event) | Branch: 2026-12-02 (simulated), St Paul, Central. Production: 2026-11-25 | Upcoming on both hosts. Not a played game |
| Red Wings team | 15 JSON-LD Events on the branch, 2026-12-11 through 2027-04-09 | Branch 2026-12-02 | No Event before today. Production: 17 Events from 2026-11-25, none before 2026-11-25 |
| Wild team | 2 JSON-LD Events on the branch, 2026-12-12 and 2026-12-22 | Branch 2026-12-02 | No Event before today. Production: 4 Events from 2026-11-25, none before 2026-11-25 |

The check ran on every page and found no played game.

## 3. Intended differences, each checked

All of these PASSED at 390, 768 and 1280 unless a width is named.

**a. Team pages, one card.**
- Sidebar: one card. Red Wings: text wordmark "StubHub" (a `<span>`, 17px weight 800, `#003C71`, no `<img>`, no `<svg>`), "Get Tickets", arrow. Wild: the TicketNetwork card with its logo image, as production draws it.
- Card box against production's cards, computed styles: StubHub card 342x60 at 390 (720x60, 336x60), the same box as production's Ticketmaster card; Wild's TicketNetwork card 342x58, the same box as production's TicketNetwork card. Border 1px solid rgb(0, 60, 113) (the 1.5px class at device pixel ratio 1), radius 14px, shadow `rgba(0, 60, 113, 0.12) 0 4px 16px`, white background, padding 16px 18px: identical on both hosts.
- Tapping a row's "Tickets" button opens the game dialog (it is a modal dialog, not an inline expansion, on both hosts). One card in it: StubHub 274x45 at 390 (420x45 at 768 and 1280), where production shows Ticketmaster 274x45 above TicketNetwork 274x43. Wild: one TicketNetwork card 274x43. `<slug>/390-branch-row-expanded.png`.
- Calendar, home game (2026-12-12 on both teams): one card, 266x45 StubHub or 266x43 TicketNetwork at 390. `<slug>/390-branch-calendar-home.png`.
- Calendar, AWAY game: Red Wings at Boston, 2026-12-05: one StubHub card, and its link goes to the Bruins home event (`stubhub.com/boston-bruins-boston-tickets-12-5-2026/event/...`). Wild at Los Angeles, 2026-12-03: one TicketNetwork card to the Kings vs Wild listing. `<slug>/390-branch-calendar-away.png`.

**b. One line under each card or card group.**
- Text is exactly "PromoNight may earn a commission on ticket purchases made through these links. Resale prices may differ from face value." Production's "TicketNetwork is a resale marketplace..." line is absent from all four branch pages.
- Once per group: every group I opened (sidebar, row dialog, calendar home, calendar away, on both teams, three widths, 24 groups) holds 1 partner link and 1 note.
- Size 12px, line height 1.4. Contrast: 6.95:1 in the sidebar (ink at 75% opacity on the cream page), 7.35:1 in the dialog and calendar panels (white), 8.1:1 on the promo pages. All above 4.5:1.
- At 390 it does not overflow, clip or collide: right edge 366 (sidebar), 332 (dialog), 328 (calendar panel), 374 (promo) inside a 390 viewport; 10px to the SpotHero card below it in the sidebar, 16px to "Stream the game" in an away panel; `scrollWidth` equals `clientWidth` on the element.

**c. Promo pages.**
- Get Tickets button: same box, color, label and row as production. 144x52 at x=120 y=298 at 390, 394x52 at 768, 522x52 at 1280; team color background (rgb(206, 17, 38) Red Wings, rgb(21, 71, 52) Wild), white 16px weight 600 label, radius 14px; Share 102x52 on the same row at the same x. Pixel identical to production through y=361 at 390 and 768.
- "Also on Ticketmaster" is gone from both branch promo pages (0 occurrences in the served HTML and in the rendered DOM).
- The line under the button is the sentence in (b), centered, one instance.
- `href`: Red Wings starts `https://stubhub.prf.hn/click/`; one hop answers 302 from `stubhub.prf.hn` to `www.stubhub.com/detroit-red-wings-detroit-tickets-12-12-2026/event/161328926/`. Wild starts `https://ticketnetwork.lusg.net/`; one hop answers 302 from `ticketnetwork.lusg.net` to `www.ojrq.net` (the same hop production makes). Both keep `target="_blank" rel="noopener noreferrer sponsored"`.

**d. Arm isolation.**
- Red Wings team and promo pages: every `<a>` to a ticket partner in the DOM is a StubHub link (8 on the team page before interaction, 1 on the promo page), and the dialog, home and away panels add StubHub links only. No `<a>` to Ticketmaster or TicketNetwork anywhere, and neither name appears in the visible text. No ticket price: no "$" followed by a digit anywhere in the visible text of either page or of any opened panel.
- Wild team and promo pages: every partner `<a>` is TicketNetwork (10 and 1). No StubHub link and no "StubHub" in the visible text. No Ticketmaster link either.
- See defect 2 for what the page bytes, as opposed to the links, carry on this dev server.

**e. Footer affiliate disclosure.** On all four branch pages the paragraph ends at "...are set by the listed partners." The sentence about TicketNetwork tickets being resold by other sellers is gone (text in 1b).

**f. Nothing else moves.**
- Horizontal overflow at 390, measured as `document.documentElement.scrollWidth > document.documentElement.clientWidth`: 390 against 390 on all four branch pages, and still no overflow with the dialog or a calendar panel open. Also none at 768 and 1280.
- Sidebar module order and promo section order are unchanged. What does move is in 1d: sidebar modules below the ticket control rise 52 to 69px, promo sections below the button rise 14 to 15px. Both follow directly from removing one control and are the same at every width; I list them because the brief said nothing else should move.
- Fubo "Stream" link on the promo pages: same x, same 101x44 box, 14 to 15px higher, still centered above "Availability varies by market." On the Wild page its 44px box starts 2px under the note at 390 and 1px under it at 768 and 1280; the visible text keeps about 15px of air and production has the same 2px between "Also on Ticketmaster" and the Fubo box, so the rhythm is unchanged. `minnesota-wild-ornament/390-branch.png`.
- Ad slot containers: `data-ad-region` and the first ad anchor are at the same position on both hosts on every page at 390.

## 4. Things that work

1. The single card reads as the same control as before. Same box, border, radius and shadow as production's cards, the StubHub wordmark sits where the Ticketmaster wordmark sat, and at 390 the sidebar is 68px shorter, so parking and hotels come up sooner. `detroit-red-wings/390-branch.png`, `minnesota-wild/390-branch.png`.
2. The promo page's action block is calmer. One button, one note, then Fubo, with the 133x21 "Also on Ticketmaster" text link (an undersized tap target on production) gone. The button itself is pixel identical to production. `detroit-red-wings-ugly-sweater/390-branch.png`.
3. Away games follow the page team's partner and still land on the right building's event: the Red Wings at Boston panel links to the Bruins home game on StubHub, not to a Detroit page. `detroit-red-wings/390-branch-calendar-away.png`.

Also confirmed working on the branch: date and time and venue are findable above the fold on both promo pages (game line under the H1, venue line linked to the venue guide); a rail card goes where it says (Red Wings promo: "FRI DEC 11 Original Six Matchup" opens a page whose H1 is "ORIGINAL SIX MATCHUP"; Wild promo: "DEC 22 Nightlight" opens H1 "NIGHTLIGHT"); browser back on both promo pages restores the scroll position exactly (1827 to 1827, 1706 to 1706).

## 5. Defects

Severity is mine. "Introduced" means the branch shows it and production does not.

1. **Medium. Red Wings team page, all widths. The sidebar card names no game but opens one game.** The card reads "StubHub Get Tickets" (and `aria-label="StubHub Get Tickets"`) under "Plan your visit". Its `href` destination is `stubhub.com/detroit-red-wings-detroit-tickets-12-3-2026/event/161328922/`, the next home game on the simulated date (Dec 3 vs Colorado); one hop confirms 302 to that event page. Production's two sidebar cards go to team-level pages (`ticketmaster.com/detroit-red-wings-tickets/artist/805938`, `ticketnetwork.com/e/performers/detroit-red-wings-tickets`). A fan planning a later night taps a team-level "Get Tickets" and lands inside one game's listings with nothing on the card to say so. The Wild sidebar card on the branch still goes to the team-level TicketNetwork page, so the two arms of the test also differ in where the same control lands. Introduced. Evidence: `detroit-red-wings/390-branch.png` (y about 1479) and the `href` above.
2. **Medium, could not be settled on a dev server. Both promo pages. The other arm's event URL is in the served bytes.** The Wild promo page (TicketNetwork arm) HTML from the branch contains `"shEventUrl":"https://www.stubhub.com/minnesota-wild-saint-paul-tickets-12-12-2026/event/161350075/"`, and the Red Wings promo page (StubHub arm) contains `"tnEventUrl":"https://www.ticketnetwork.com/tickets/8138678/detroit-red-wings-vs-florida-panthers-..."`. Neither is a link and neither is visible. Production's HTML for the same two pages contains neither field name. A dev server's flight payload carries extra debugging data, so I could not tell whether a production build would ship these; the repo's rule that a doc field reaching a client component is published makes it worth one check of a production build's served HTML before merge. The team pages do not show this: the Red Wings team HTML has 57 `shEventUrl` and 0 `tnEventUrl`, the Wild team HTML 53 `tnEventUrl` and 0 `shEventUrl`.
3. **Low. Both promo pages, 390; both team pages, 390 (dialog and calendar panels) and 1280 (sidebar). The note is one line longer than the line it replaced.** Three lines at 390 in the promo button column (254x50 against 254x34), in the row dialog (274x50) and in the calendar panels (266x50); three lines in the 336px sidebar at 1280 (336x50 against 336x34). Nothing collides or clips and contrast passes; it is a taller block of small print directly under the main button. At 1280 on the promo pages the second line holds the single word "value." Introduced. `detroit-red-wings-ugly-sweater/390-branch.png`, `detroit-red-wings-ugly-sweater/1280-branch.png`.
4. **Low. All four pages. "these links" sits under one link.** Every card group now holds exactly one ticket link, and the sentence under it says "made through these links". On the promo pages the next link below it is the Fubo stream link, which the sentence is not about. Copy only. Introduced.
5. **Low, observed, could not tell the cause. All four branch pages. No "Events" link in the header (768, 1280) or footer.** Production's header reads Today, Teams, My Teams, Events, About; the branch reads Today, Teams, My Teams, About, and the footer "Events" link is also absent. This is not in the described change and looks like a difference in how the dev server was started; I did not look for the variable. It accounts for the y=22 band in every 1280 diff image. `detroit-red-wings/1280-branch.png` against `detroit-red-wings/1280-production.png`.
6. **Low, on production too. Both team pages, 1280 and 390. The floating video player covers the ticket control at the top of the page.** At 1280x800 with the page unscrolled the player (about x 975 to 1275, y 540 to 710) covers the "Get Tickets" label and arrow of the sidebar card and most of the note. Production has the same overlap across its two cards. With one card, the page's only above-the-fold ticket control is the thing covered until the fan scrolls or closes the player, which matters for a click-through test. Not introduced.
7. **Low, on production too. Both team pages, 390. Back navigation drifts after it restores.** Tapping the Kids Day row (Red Wings) or the Nightlight row (Wild) and going back restores the scroll position within 1px at one second, then moves it 182px over the next two seconds on the branch (3218 to 3400, 2658 to 2840), as a 182px slot above "Plan your visit" fills ("Plan your visit" moves from y=1258 to y=1440). Production did the same in one of two runs (3766 to 3948) and held in the other. From a link near the foot of the Red Wings page (y=10512) the branch ended 1784px off; I took no production figure for that link. Not introduced; the promo pages restore exactly.
8. **Low, on production too. Both team pages, 390. Undersized tap targets around the ticket control.** The row "Tickets" button that opens the dialog is 92x27, the row share button 32x32, calendar days 41x41, the menu button 40x40, filter chips 34px tall. The compact TicketNetwork card in the dialog and calendar panels is 43px tall (274x43, 266x43), 1px under the line, and on the Wild branch page it is the only ticket control in those panels; the StubHub compact card is 45px. Not introduced.
9. **Low, on production too. All pages. axe serious findings.** `color-contrast`: the "NIGHT" half of the header logo, rgb(218, 45, 32) on rgb(247, 243, 234), 4.33:1 at 18px. `label-content-name-mismatch` on the team pages: calendar day buttons (`aria-label="2026-12-01 details"` against visible "1 VS CGY") and the SpotHero card; 5 nodes at 390 on both hosts, 16 on the branch against 13 on production at 768 and 1280 on the Red Wings page because December has more game days than November. The StubHub card passes (its label matches its text). Production also reports `button-name`, `image-alt`, `label` and `link-name` criticals at some widths; every one of those nodes is inside an ad or the video player. Not introduced.

No defect found for: horizontal overflow, note contrast, note collision, duplicate notes, wrong partner on any card including away games, a Ticketmaster or TicketNetwork link on a StubHub page, a StubHub link on a TicketNetwork page, a ticket price, the footer sentence, the promo button's appearance.

## 6. Measurements

axe counts are serious and critical only. "Contrast failures" is my own text-node pass (ads excluded, ancestor opacity applied); the one failure everywhere is the logo. Pixel diff is the branch against production.

| Page | Width | Measure | Branch | Production |
|---|---|---|---|---|
| /nhl/detroit-red-wings | 390 | Document height (px) | 17444 | 17849 |
| /nhl/detroit-red-wings | 390 | Horizontal overflow (scrollWidth / clientWidth) | 390 / 390 none | 390 / 390 none |
| /nhl/detroit-red-wings | 390 | CLS during load | 0 | 0 |
| /nhl/detroit-red-wings | 390 | axe serious and critical | color-contrast x1, label-content-name-mismatch x5 | color-contrast x1, label-content-name-mismatch x5 |
| /nhl/detroit-red-wings | 390 | Contrast failures under 4.5:1 (text nodes checked) | 1 (397) | 1 (401) |
| /nhl/detroit-red-wings | 390 | Links to /promos/ in DOM / visible | 73 / 33 | 77 / 33 |
| /nhl/detroit-red-wings | 390 | Interactive elements / under 44x44 | 135 / 102 | 137 / 104 |
| /nhl/detroit-red-wings | 390 | First ad anchor from document top (px) | 706 | 706 |
| /nhl/detroit-red-wings | 390 | Ticket partner links visible / in DOM | 1 / 8 | 2 / 20 |
| /nhl/detroit-red-wings | 390 | Ticket note box and lines | 342x34, 2 lines | 342x34, 2 lines |
| /nhl/detroit-red-wings | 390 | Pixel diff (ads masked) | 566876 px, 8.33% of 390x17444, first differing row y=657 | reference |
| /nhl/detroit-red-wings | 768 | Document height (px) | 14359 | 14591 |
| /nhl/detroit-red-wings | 768 | Horizontal overflow (scrollWidth / clientWidth) | 768 / 768 none | 768 / 768 none |
| /nhl/detroit-red-wings | 768 | CLS during load | 0 | 0 |
| /nhl/detroit-red-wings | 768 | axe serious and critical | color-contrast x1, label-content-name-mismatch x16 | button-name x1, color-contrast x2, image-alt x1, label-content-name-mismatch x13, label x1, link-name x1 |
| /nhl/detroit-red-wings | 768 | Contrast failures under 4.5:1 (text nodes checked) | 1 (433) | 1 (431) |
| /nhl/detroit-red-wings | 768 | Links to /promos/ in DOM / visible | 73 / 34 | 77 / 34 |
| /nhl/detroit-red-wings | 768 | Ticket partner links visible / in DOM | 1 / 8 | 2 / 20 |
| /nhl/detroit-red-wings | 768 | Ticket note box and lines | 720x17, 1 lines | 720x17, 1 lines |
| /nhl/detroit-red-wings | 768 | Pixel diff (ads masked) | 756089 px, 6.84% of 768x14390, first differing row y=551 | reference |
| /nhl/detroit-red-wings | 1280 | Document height (px) | 12250 | 12384 |
| /nhl/detroit-red-wings | 1280 | Horizontal overflow (scrollWidth / clientWidth) | 1280 / 1280 none | 1280 / 1280 none |
| /nhl/detroit-red-wings | 1280 | CLS during load | 0 | 0 |
| /nhl/detroit-red-wings | 1280 | axe serious and critical | color-contrast x1, label-content-name-mismatch x16 | button-name x1, color-contrast x2, image-alt x1, label-content-name-mismatch x13, label x1, link-name x1 |
| /nhl/detroit-red-wings | 1280 | Contrast failures under 4.5:1 (text nodes checked) | 1 (433) | 1 (432) |
| /nhl/detroit-red-wings | 1280 | Links to /promos/ in DOM / visible | 73 / 34 | 77 / 34 |
| /nhl/detroit-red-wings | 1280 | Ticket partner links visible / in DOM | 1 / 8 | 2 / 20 |
| /nhl/detroit-red-wings | 1280 | Ticket note box and lines | 336x50, 3 lines | 336x34, 2 lines |
| /nhl/detroit-red-wings | 1280 | Pixel diff (ads masked) | 721302 px, 4.6% of 1280x12250, first differing row y=22 | reference |
| /nhl/detroit-red-wings/promos/ugly-sweater | 390 | Document height (px) | 4972 | 5240 |
| /nhl/detroit-red-wings/promos/ugly-sweater | 390 | Horizontal overflow (scrollWidth / clientWidth) | 390 / 390 none | 390 / 390 none |
| /nhl/detroit-red-wings/promos/ugly-sweater | 390 | CLS during load | 0.0001 | 0.0113 |
| /nhl/detroit-red-wings/promos/ugly-sweater | 390 | axe serious and critical | color-contrast x1 | button-name x1, color-contrast x2, image-alt x1, label x1, link-name x1 |
| /nhl/detroit-red-wings/promos/ugly-sweater | 390 | Contrast failures under 4.5:1 (text nodes checked) | 1 (106) | 1 (107) |
| /nhl/detroit-red-wings/promos/ugly-sweater | 390 | Links to /promos/ in DOM / visible | 20 / 18 | 20 / 18 |
| /nhl/detroit-red-wings/promos/ugly-sweater | 390 | Interactive elements / under 44x44 | 56 / 38 | 65 / 45 |
| /nhl/detroit-red-wings/promos/ugly-sweater | 390 | First ad anchor from document top (px) | 57 | 57 |
| /nhl/detroit-red-wings/promos/ugly-sweater | 390 | Ticket partner links visible / in DOM | 1 / 1 | 2 / 2 |
| /nhl/detroit-red-wings/promos/ugly-sweater | 390 | Ticket note box and lines | 254x50, 3 lines | 254x34, 2 lines |
| /nhl/detroit-red-wings/promos/ugly-sweater | 390 | Pixel diff (ads masked) | 157368 px, 8.12% of 390x4972, first differing row y=362 | reference |
| /nhl/detroit-red-wings/promos/ugly-sweater | 768 | Document height (px) | 3986 | 4050 |
| /nhl/detroit-red-wings/promos/ugly-sweater | 768 | Horizontal overflow (scrollWidth / clientWidth) | 768 / 768 none | 768 / 768 none |
| /nhl/detroit-red-wings/promos/ugly-sweater | 768 | CLS during load | 0.0002 | 0.0002 |
| /nhl/detroit-red-wings/promos/ugly-sweater | 768 | axe serious and critical | color-contrast x1 | color-contrast x1 |
| /nhl/detroit-red-wings/promos/ugly-sweater | 768 | Contrast failures under 4.5:1 (text nodes checked) | 1 (112) | 1 (113) |
| /nhl/detroit-red-wings/promos/ugly-sweater | 768 | Links to /promos/ in DOM / visible | 20 / 19 | 20 / 19 |
| /nhl/detroit-red-wings/promos/ugly-sweater | 768 | Ticket partner links visible / in DOM | 1 / 1 | 2 / 2 |
| /nhl/detroit-red-wings/promos/ugly-sweater | 768 | Ticket note box and lines | 504x34, 2 lines | 504x17, 1 lines |
| /nhl/detroit-red-wings/promos/ugly-sweater | 768 | Pixel diff (ads masked) | 161213 px, 5.27% of 768x3986, first differing row y=362 | reference |
| /nhl/detroit-red-wings/promos/ugly-sweater | 1280 | Document height (px) | 3962 | 4076 |
| /nhl/detroit-red-wings/promos/ugly-sweater | 1280 | Horizontal overflow (scrollWidth / clientWidth) | 1280 / 1280 none | 1280 / 1280 none |
| /nhl/detroit-red-wings/promos/ugly-sweater | 1280 | CLS during load | 0.0001 | 0.0002 |
| /nhl/detroit-red-wings/promos/ugly-sweater | 1280 | axe serious and critical | color-contrast x1 | button-name x1, color-contrast x2, image-alt x1, label x1, link-name x1 |
| /nhl/detroit-red-wings/promos/ugly-sweater | 1280 | Contrast failures under 4.5:1 (text nodes checked) | 1 (112) | 1 (114) |
| /nhl/detroit-red-wings/promos/ugly-sweater | 1280 | Links to /promos/ in DOM / visible | 20 / 19 | 20 / 19 |
| /nhl/detroit-red-wings/promos/ugly-sweater | 1280 | Ticket partner links visible / in DOM | 1 / 1 | 2 / 2 |
| /nhl/detroit-red-wings/promos/ugly-sweater | 1280 | Ticket note box and lines | 632x34, 2 lines | 632x17, 1 lines |
| /nhl/detroit-red-wings/promos/ugly-sweater | 1280 | Pixel diff (ads masked) | 279015 px, 5.5% of 1280x3962, first differing row y=22 | reference |
| /nhl/minnesota-wild | 390 | Document height (px) | 11859 | 12911 |
| /nhl/minnesota-wild | 390 | Horizontal overflow (scrollWidth / clientWidth) | 390 / 390 none | 390 / 390 none |
| /nhl/minnesota-wild | 390 | CLS during load | 0 | 0.0112 |
| /nhl/minnesota-wild | 390 | axe serious and critical | color-contrast x1, label-content-name-mismatch x5 | color-contrast x1, label-content-name-mismatch x5 |
| /nhl/minnesota-wild | 390 | Contrast failures under 4.5:1 (text nodes checked) | 1 (245) | 1 (274) |
| /nhl/minnesota-wild | 390 | Links to /promos/ in DOM / visible | 35 / 24 | 37 / 26 |
| /nhl/minnesota-wild | 390 | Interactive elements / under 44x44 | 106 / 83 | 116 / 90 |
| /nhl/minnesota-wild | 390 | First ad anchor from document top (px) | 672 | 672 |
| /nhl/minnesota-wild | 390 | Ticket partner links visible / in DOM | 1 / 10 | 2 / 20 |
| /nhl/minnesota-wild | 390 | Ticket note box and lines | 342x34, 2 lines | 342x34, 2 lines |
| /nhl/minnesota-wild | 390 | Pixel diff (ads masked) | 587377 px, 12.7% of 390x11859, first differing row y=623 | reference |
| /nhl/minnesota-wild | 768 | Document height (px) | 9934 | 10840 |
| /nhl/minnesota-wild | 768 | Horizontal overflow (scrollWidth / clientWidth) | 768 / 768 none | 768 / 768 none |
| /nhl/minnesota-wild | 768 | CLS during load | 0 | 0 |
| /nhl/minnesota-wild | 768 | axe serious and critical | color-contrast x1, label-content-name-mismatch x13 | color-contrast x1, label-content-name-mismatch x15 |
| /nhl/minnesota-wild | 768 | Contrast failures under 4.5:1 (text nodes checked) | 1 (275) | 1 (308) |
| /nhl/minnesota-wild | 768 | Links to /promos/ in DOM / visible | 35 / 25 | 37 / 27 |
| /nhl/minnesota-wild | 768 | Ticket partner links visible / in DOM | 1 / 10 | 2 / 20 |
| /nhl/minnesota-wild | 768 | Ticket note box and lines | 720x17, 1 lines | 720x17, 1 lines |
| /nhl/minnesota-wild | 768 | Pixel diff (ads masked) | 661936 px, 8.65% of 768x9965, first differing row y=551 | reference |
| /nhl/minnesota-wild | 1280 | Document height (px) | 8432 | 9269 |
| /nhl/minnesota-wild | 1280 | Horizontal overflow (scrollWidth / clientWidth) | 1280 / 1280 none | 1280 / 1280 none |
| /nhl/minnesota-wild | 1280 | CLS during load | 0 | 0 |
| /nhl/minnesota-wild | 1280 | axe serious and critical | color-contrast x1, label-content-name-mismatch x13 | color-contrast x1, label-content-name-mismatch x15 |
| /nhl/minnesota-wild | 1280 | Contrast failures under 4.5:1 (text nodes checked) | 1 (275) | 1 (309) |
| /nhl/minnesota-wild | 1280 | Links to /promos/ in DOM / visible | 35 / 25 | 37 / 27 |
| /nhl/minnesota-wild | 1280 | Ticket partner links visible / in DOM | 1 / 10 | 2 / 20 |
| /nhl/minnesota-wild | 1280 | Ticket note box and lines | 336x50, 3 lines | 336x34, 2 lines |
| /nhl/minnesota-wild | 1280 | Pixel diff (ads masked) | 849606 px, 7.87% of 1280x8432, first differing row y=22 | reference |
| /nhl/minnesota-wild/promos/ornament | 390 | Document height (px) | 4716 | 5058 |
| /nhl/minnesota-wild/promos/ornament | 390 | Horizontal overflow (scrollWidth / clientWidth) | 390 / 390 none | 390 / 390 none |
| /nhl/minnesota-wild/promos/ornament | 390 | CLS during load | 0.0001 | 0.0113 |
| /nhl/minnesota-wild/promos/ornament | 390 | axe serious and critical | color-contrast x1 | color-contrast x1 |
| /nhl/minnesota-wild/promos/ornament | 390 | Contrast failures under 4.5:1 (text nodes checked) | 1 (85) | 1 (91) |
| /nhl/minnesota-wild/promos/ornament | 390 | Links to /promos/ in DOM / visible | 14 / 12 | 16 / 14 |
| /nhl/minnesota-wild/promos/ornament | 390 | Interactive elements / under 44x44 | 49 / 37 | 54 / 40 |
| /nhl/minnesota-wild/promos/ornament | 390 | First ad anchor from document top (px) | 57 | 57 |
| /nhl/minnesota-wild/promos/ornament | 390 | Ticket partner links visible / in DOM | 1 / 1 | 2 / 2 |
| /nhl/minnesota-wild/promos/ornament | 390 | Ticket note box and lines | 254x50, 3 lines | 254x34, 2 lines |
| /nhl/minnesota-wild/promos/ornament | 390 | Pixel diff (ads masked) | 170179 px, 9.25% of 390x4716, first differing row y=362 | reference |
| /nhl/minnesota-wild/promos/ornament | 768 | Document height (px) | 3792 | 4265 |
| /nhl/minnesota-wild/promos/ornament | 768 | Horizontal overflow (scrollWidth / clientWidth) | 768 / 768 none | 768 / 768 none |
| /nhl/minnesota-wild/promos/ornament | 768 | CLS during load | 0.0002 | 0.0314 |
| /nhl/minnesota-wild/promos/ornament | 768 | axe serious and critical | color-contrast x1 | button-name x1, color-contrast x2, image-alt x1, label x1, link-name x1 |
| /nhl/minnesota-wild/promos/ornament | 768 | Contrast failures under 4.5:1 (text nodes checked) | 1 (91) | 1 (97) |
| /nhl/minnesota-wild/promos/ornament | 768 | Links to /promos/ in DOM / visible | 14 / 13 | 16 / 15 |
| /nhl/minnesota-wild/promos/ornament | 768 | Ticket partner links visible / in DOM | 1 / 1 | 2 / 2 |
| /nhl/minnesota-wild/promos/ornament | 768 | Ticket note box and lines | 504x34, 2 lines | 504x17, 1 lines |
| /nhl/minnesota-wild/promos/ornament | 768 | Pixel diff (ads masked) | 291978 px, 10.03% of 768x3792, first differing row y=362 | reference |
| /nhl/minnesota-wild/promos/ornament | 1280 | Document height (px) | 3768 | 4131 |
| /nhl/minnesota-wild/promos/ornament | 1280 | Horizontal overflow (scrollWidth / clientWidth) | 1280 / 1280 none | 1280 / 1280 none |
| /nhl/minnesota-wild/promos/ornament | 1280 | CLS during load | 0.0001 | 0.0301 |
| /nhl/minnesota-wild/promos/ornament | 1280 | axe serious and critical | color-contrast x1 | color-contrast x1 |
| /nhl/minnesota-wild/promos/ornament | 1280 | Contrast failures under 4.5:1 (text nodes checked) | 1 (91) | 1 (98) |
| /nhl/minnesota-wild/promos/ornament | 1280 | Links to /promos/ in DOM / visible | 14 / 13 | 16 / 15 |
| /nhl/minnesota-wild/promos/ornament | 1280 | Ticket partner links visible / in DOM | 1 / 1 | 2 / 2 |
| /nhl/minnesota-wild/promos/ornament | 1280 | Ticket note box and lines | 632x34, 2 lines | 632x17, 1 lines |
| /nhl/minnesota-wild/promos/ornament | 1280 | Pixel diff (ads masked) | 288701 px, 5.99% of 1280x3768, first differing row y=22 | reference |

Card groups opened on the team pages (branch against production), every width: sidebar, row dialog, calendar home game, calendar away game.

| Page | Width | Group | Branch card(s) | Production card(s) | Branch note | Production note |
|---|---|---|---|---|---|---|
| Red Wings | 390 | Sidebar | StubHub 342x60 | Ticketmaster 342x60, TicketNetwork 342x58 | 342x34, 2 lines, 6.95:1 | 342x34, 2 lines |
| Red Wings | 390 | Row dialog (Kids Day, Dec 20) | StubHub 274x45 | Ticketmaster 274x45, TicketNetwork 274x43 | 274x50, 3 lines, 7.35:1 | 274x34, 2 lines |
| Red Wings | 390 | Calendar home (Dec 12) | StubHub 266x45 | Ticketmaster 266x45, TicketNetwork 266x43 | 266x50, 3 lines | 266x34, 2 lines |
| Red Wings | 390 | Calendar away (Dec 5 at Boston) | StubHub 266x45 | Ticketmaster 266x45, TicketNetwork 266x43 | 266x50, 3 lines | 266x34, 2 lines |
| Red Wings | 768 | Sidebar | StubHub 720x60 | 720x60, 720x58 | 720x17, 1 line | 720x17, 1 line |
| Red Wings | 768 | Row dialog | StubHub 420x45 | 420x45, 420x43 | 420x34, 2 lines | 420x17, 1 line |
| Red Wings | 768 | Calendar home and away | StubHub 628x45 | 628x45, 628x43 | 628x34, 2 lines | 628x17, 1 line |
| Red Wings | 1280 | Sidebar | StubHub 336x60 | 336x60, 336x58 | 336x50, 3 lines | 336x34, 2 lines |
| Red Wings | 1280 | Row dialog | StubHub 420x45 | 420x45, 420x43 | 420x34, 2 lines | 420x17, 1 line |
| Red Wings | 1280 | Calendar home and away | StubHub 644x45 | 644x45, 644x43 | 644x34, 2 lines | 644x17, 1 line |
| Wild | 390 | Sidebar | TicketNetwork 342x58 | Ticketmaster 342x60, TicketNetwork 342x58 | 342x34, 2 lines, 6.95:1 | 342x34, 2 lines |
| Wild | 390 | Row dialog (Nightlight, Dec 22) | TicketNetwork 274x43 | 274x45, 274x43 | 274x50, 3 lines, 7.35:1 | 274x34, 2 lines |
| Wild | 390 | Calendar home (Dec 12) | TicketNetwork 266x43 | 266x45, 266x43 | 266x50, 3 lines | 266x34, 2 lines |
| Wild | 390 | Calendar away (Dec 3 at Los Angeles) | TicketNetwork 266x43 | 266x45, 266x43 | 266x50, 3 lines | 266x34, 2 lines |
| Wild | 768 | Sidebar | TicketNetwork 720x58 | 720x60, 720x58 | 720x17, 1 line | 720x17, 1 line |
| Wild | 768 | Row dialog | TicketNetwork 420x43 | 420x45, 420x43 | 420x34, 2 lines | 420x17, 1 line |
| Wild | 768 | Calendar home and away | TicketNetwork 628x43 | 628x45, 628x43 | 628x34, 2 lines | 628x17, 1 line |
| Wild | 1280 | Sidebar | TicketNetwork 336x58 | 336x60, 336x58 | 336x50, 3 lines | 336x34, 2 lines |
| Wild | 1280 | Row dialog | TicketNetwork 420x43 | 420x45, 420x43 | 420x34, 2 lines | 420x17, 1 line |
| Wild | 1280 | Calendar home and away | TicketNetwork 644x43 | 644x45, 644x43 | 644x34, 2 lines | 644x17, 1 line |

In all 24 branch groups: no overflow with the group open, 1 partner link, 1 note, note at 12px, no clipping, no negative gap to the next element, no price text.

## 7. What a first-time visitor sees (branch)

- **Red Wings team, 390.** Above the fold: header, the red hero with "Detroit Red Wings", "Promos & Giveaways 2026-27", the arena, five count tiles and "32 promotions in the 2026-27 season, 15 still to come". First scroll: filter chips and the December calendar, with the floating video player over the right side. Second scroll: an empty reserved slot, then "Plan your visit" with the single StubHub card, the note, SpotHero, hotels, Fanatics. No ticket control is above the fold at 390 on either host.
- **Red Wings team, 1280.** The hero, then the calendar on the left and "Plan your visit" on the right at y=520, so the StubHub card is above the fold, partly under the video player (defect 6).
- **Red Wings promo, 390.** Breadcrumb, "Ticket package" badge, "UGLY SWEATER", "Detroit Red Wings vs Panthers", the date and time, the venue, then the day tile beside Get Tickets and Share, the note, the package disclosure with "See the package on the team site", Stream on Fubo, Parking, Hotels, Remind me: all above the fold. First scroll: "About this ticket package", "This game". Second scroll: an ad slot, "Before you go".
- **Wild team, 390 and 1280.** As the Red Wings page in the Wild's green, "6 promotions in the 2026-27 season, 2 still to come", the TicketNetwork card alone under "Plan your visit".
- **Wild promo, 390.** Breadcrumb, "Giveaway" badge, "ORNAMENT", the game line, the venue, the day tile, Get Tickets and Share, the note, Stream on Fubo, Parking, Hotels, Remind me, then the top of the ornament image. First scroll: the image, "About this giveaway", "This game". Second scroll: an ad slot, "Before you go".

Nothing on these pages needs the site's vocabulary to read. The only thing that looks tappable and is not: none found in the ticket area; the note is plain small print and reads as such.

## 8. One recommendation

Settle defect 1 before the test starts: decide whether the Red Wings sidebar card is a team-level control or a next-game control, and make its label and both arms agree, because as built the StubHub arm's sidebar tap lands on a single game while the TicketNetwork arm's lands on the team's listings, and the test would be comparing two different destinations as well as two partners. While that is open, read one production build's served HTML for the two promo pages to close defect 2.


## 9. Dispositions (added by the build session, 2026-11-25)

Every defect above is fixed, deferred with a known-issues entry, or waived with its reason.

| # | Disposition | Reason |
|---|---|---|
| 1 | Deferred, known-issues 134, and raised at Gate 3 for a ruling | The sidebar card belongs to no game. On a StubHub day it links the team's next home game with a matched StubHub event, because the test stores event pages only and has no StubHub team page; on a TicketNetwork day it links the team performer page as before. The two arms land on different kinds of page from the same control. The owner decides before the test starts. |
| 2 | Settled, no change needed | Checked on a production build with the switch on and the same simulated date: the Red Wings promo page and the Wild promo page carry 0 `shEventUrl` and 0 `tnEventUrl` keys, the Red Wings page has no ticketnetwork.com URL and the Wild page has no stubhub.com URL. The fields seen on the dev server were React debug rows, which a production build does not ship. |
| 3 | Waived | The sentence is the owner's ruled copy (Gate 0 ruling 4), the same on both arms. One line longer than the line it replaces; nothing collides or clips. |
| 4 | Waived | Same ruled sentence. "These links" under one link reads slightly off; recorded for the owner in known-issues 134. |
| 5 | Not a defect | The branch dev server was started without `EVENTS_PAGES_LIVE`, so the Events links were absent on it. Unrelated to this change. |
| 6 | Deferred, known-issues 134 | On production too. With one card instead of two, the floating video player covers the only above-the-fold ticket control at 1280. |
| 7 | Waived | On production too (1 of 2 runs); the slot that fills is an ad slot above the module, not part of this change. |
| 8 | Deferred, known-issues 134 | On production too. The compact TicketNetwork card is 43px tall and is now the only ticket control in the dialog and calendar panels of a TicketNetwork-day page. |
| 9 | Waived | On production too; none of the findings is on the new card. |

Checked after the review, on production builds served locally:

- **Switch off equals main.** The branch built with the switch off and main built the same way, 15 pages (six team pages, /promos/today, two league hubs, /best-promos, /my-teams, a venue hub, two promo pages, the homepage): the rendered HTML is identical on all 15, and the flight payload differs only by one more JavaScript chunk reference in the module import rows. No new key, no new element.
- **Switch on.** Multi-team pages (/promos/today, /nhl, /best-promos) and a club outside the test (Twins) carry no StubHub link and no test line. Test team pages carry one partner's links only. No config string (seed, pairs, click counts) is in any client chunk.

Gate 3 rulings (owner, 2026-11-25), applied after the table above:

- **Defect 1, fixed.** Both arms now send the team-level card to the same kind of page: the team's next upcoming home game that has a matched event for the day's partner (StubHub's event through the Partnerize link, or TicketNetwork's event page). An arm with no such game links the TicketNetwork team performer page and the click says fallback.
- **Defects 3 and 4, fixed by new copy.** The line is now "PromoNight may earn a commission on ticket purchases. Resale prices may differ from face value.", shorter than the first version and with no "these links".
- **Defects 6 and 8** are fixed on their own branch, fix/ticket-card-overlap, for every page, with its own review.
