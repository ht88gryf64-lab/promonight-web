# UX review: events pages (feature/events-pages)

Run: 2026-11-18, 12:15 to 13:00 America/New_York. Branch `feature/events-pages` at 8a82e6d, dev server http://localhost:3100 (EVENTS_PAGES_LIVE and PROMO_PAGES_LIVE on). Production https://www.getpromonight.com, `promonight-deploy` = `dpl_65rWaCL2H7Kbyv5cGfkzHxYefeHB`. The dev server HTML carries no `promonight-deploy` meta.

Viewports 390x844, 768x1024, 1280x800. Screenshots are in `2026-11-18-events-pages/<slug>/<viewport>-<env>.png` (full page) and `<viewport>-<env>-fold.png` (first screen).

Scope notes:

- `/events`, `/events/monster-jam` and `/events/monster-jam/us-bank-stadium` answer 404 on production, so the three events page types have no production baseline. They are reviewed on their own, against the mockup `docs/events-monster-jam-mockup.html` at 390.
- The venue and team pages are reviewed in baseline mode against production.
- Ad slots are ignored. On the dev server the in-content slots render as empty 250px grey boxes and a 50px fixed footer bar covers the bottom of the first screen; both show in the screenshots as a pale band.
- On 4 of 24 branch renders the browser `load` event did not fire within 90s. The pending request each time was a third-party ad sync pixel (ads.stickyadstv.com). The pages themselves had rendered; those four were re-run waiting for DOMContentLoaded. Not counted as a page defect.
- The Tickets tap in the walk followed the whole redirect chain in a real browser tab, so one real TicketNetwork affiliate click was recorded with subId1 `web_event_page_monster-jam_us-bank-stadium`.

## 1. Baseline differences: venue page /venues/us-bank-stadium

Served HTML of `<main>` (scripts, hashes, nonces and flight payload stripped): not identical. 1 line only in production, 12 lines only on the branch. Three regions differ:

1. New on branch: `<section data-venue-events>` with the H2 "Upcoming events at U.S. Bank Stadium", one link "Monster Jam: dates and tickets" to `/events/monster-jam/us-bank-stadium`, and the text "Feb 20 to 21, 2027 · 2 shows". It appears once in the DOM, between the dark fact band and "Teams that play here".
2. New on branch: footer link "Events" to `/events`, after "Stadium guides".
3. Environment, not branch code: the "Get tickets on Ticketmaster" link is `https://www.ticketmaster.com/minnesota-vikings-tickets/artist/805973` on the dev server and the Impact wrap `https://ticketmaster.evyy.net/c/...&sharedid=web_venue_us-bank-stadium` on production. The branch diff does not touch that builder; the dev server has no `NEXT_PUBLIC_TICKETMASTER_IMPACT_WRAP`.

Pixel comparison (ads included in the counts, they could not be masked reliably):

| Viewport | Production height | Branch height | Differing pixels | First differing row | Diff image |
|---|---|---|---|---|---|
| 390 | 7096 | 7297 | 369,643 (13.0%) | 81 (header, antialiasing) then 586 on | `2026-11-18-events-pages/venue-us-bank-stadium/390-diff.png` |
| 768 | 5147 | 5319 | 578,090 (14.2%) | 89 then 558 on | `2026-11-18-events-pages/venue-us-bank-stadium/768-diff.png` |
| 1280 | 4509 | 4600 | 462,012 (7.8%) | 508 on | `2026-11-18-events-pages/venue-us-bank-stadium/1280-diff.png` |

Everything below the module is the same content moved down, so the whole page below row 586 differs. What moved, from heading positions:

| Measurement | Production | Branch |
|---|---|---|
| Module height added at 390 | none | 167px (section y 587 to 754) |
| "Teams that play here" H2 y at 390 | 603 | 770 |
| "Plan your visit" H2 y at 390 | 749 | 916 (now below the 844 fold; SpotHero and Expedia buttons leave the first screen) |
| Module height added at 768 | none | 138px |
| Module height added at 1280 (main column) | none | 138px; headings below move 87 to 138px; right rail unchanged (0px) |
| Cumulative layout shift 390 / 768 / 1280 | 0 / 0.034 / 0.037 | 0 / 0.002 / 0.032 |
| First ad anchor y at 390 | 57 | 57 |
| `<a>` to /promos/ in DOM / visible at 390 | 8 / 6 | 8 / 6 |
| axe serious or critical (first-party) | color-contrast 1, label-content-name-mismatch 2, scrollable-region-focusable 1 | same |
| Horizontal overflow at 390 (clientWidth vs scrollWidth) | 390 / 390 | 390 / 390 |

The module causes no layout shift during load (it is in the served HTML). New link: tap target 200x44 at 390 and 228x44 at 768 and 1280; text contrast 16.75:1 (ink on white). H2 and date text 5.0:1. Footer "Events" link: 43x15, contrast 5.9:1, the same size and colour as every other footer link.

## 2. Baseline differences: team page /nfl/minnesota-vikings

Served HTML of `<article>`: not identical. Regions that differ:

1. New on branch: one link in the Plan your visit rail, `a[data-also-at]`, text "Also at U.S. Bank Stadium: Monster Jam, Feb 20 to 21, 2027", to `/events/monster-jam/us-bank-stadium`. Present twice in the served HTML (the rail is rendered for the mobile and the desktop layout), one visible at each viewport.
2. New on branch, outside the article: footer link "Events".
3. Environment, not branch code: the two Ticketmaster links are unwrapped on the dev server (same cause as on the venue page).

Served HTML size on the branch dev server: 668,578 bytes (dev build, not comparable with the 950,000-byte production cap; production today is 289,904 bytes).

| Viewport | Production height | Branch height | Differing pixels | Diff image |
|---|---|---|---|---|
| 390 | 15979 | 15944 | 663,406 (10.6%) | `2026-11-18-events-pages/team-minnesota-vikings/390-diff.png` |
| 768 | 12783 | 12872 | 767,582 (7.8%) | `2026-11-18-events-pages/team-minnesota-vikings/768-diff.png` |
| 1280 | 10557 | 10241 | 1,203,018 (8.9%) | `2026-11-18-events-pages/team-minnesota-vikings/1280-diff.png` |

The page height differences are ad fill (production filled more slots). What the link itself moved:

| Measurement | Production | Branch |
|---|---|---|
| "Game day at U.S. Bank Stadium" H3 y at 390 | 1999 | 2053 (+54) |
| Same at 768 | 2154 | 2178 (+24) |
| Same at 1280 (right rail) | 990 | 1044 (+54); "More to dig into" in the rail +54 |
| Cumulative layout shift, all viewports | 0 | 0 |
| First ad anchor y at 390 | 706 | 706 |
| `<a>` to /promos/ in DOM / visible at 390 | 26 / 24 | 26 / 24 |
| axe serious or critical (first-party) | color-contrast 2 to 3, label-content-name-mismatch 4 | color-contrast 2, label-content-name-mismatch 4 |
| Horizontal overflow at 390 | 390 / 390 | 390 / 390 |

New link: tap target 342x44 at 390 (two lines of text), 720x44 at 768, 336x44 at 1280. Contrast 5.06:1 (#c62a1e on cream #f7f3ea), 14px medium, no underline until hover. Footer "Events": 43x15, 5.9:1.

## 3. Game date check

Today is 2026-11-18 in every venue zone involved (Central, Pacific, Eastern).

| Page | Dates read (showtime rows and Event startDate) | Verdict |
|---|---|---|
| /events/monster-jam/us-bank-stadium | 2 rows, 2 Events: 2027-02-20 17:00 -06:00, 2027-02-21 15:00 -06:00 | All future. Every row has a Tickets button; none is for a past show. |
| /events/monster-jam/angel-stadium | 8 rows, 8 Events: 2026-12-19 16:30 -08:00 through 2027-02-21 14:30 -08:00 | All future. |
| /events/monster-jam/nrg-stadium | 3 rows, 3 Events: 2027-02-06, 02-07, 02-13 | All future. |
| /events/monster-jam/raymond-james-stadium | 2 rows, 2 Events: 2027-02-13 17:00 -05:00, 2027-02-14 14:00 -05:00 | All future. |
| /events/monster-jam, /events | No Event JSON-LD; list dates 2026-12-19 to 2027-03-06 | All future. |
| /venues/us-bank-stadium | No Event JSON-LD; module date Feb 20 to 21, 2027 | Future. |
| /nfl/minnesota-vikings | 5 Events, 2026-11-29 to 2026-12-26; link date Feb 20 to 21, 2027 | All future. |

Row dates, `<time datetime>` values and JSON-LD startDates agree on all four stop pages. No played-show state could be exercised: no stop in the data has a past show yet.

## 4. Three things that work

1. First screen of the stop page at 390x844 (`2026-11-18-events-pages/event-stop-us-bank-stadium/390-branch-fold.png`): breadcrumb, "Live event · 2 shows", the H1, the dates line, the city, both showtime rows with both Tickets buttons (first button at y 405 to 449), the disclosure and the Parking button are all visible above the fixed ad bar. All ticket rows sit above the image card on all four stops, including the 8-row Angel Stadium page (last row ends y 1150, card starts y 1279).
2. Navigation and back: every in-page link tried on the stop, hub and index pages went to a page whose H1 matched, and browser back restored the scroll position exactly (delta 0px in 11 of 11 taps inside the events pages, the venue module and the team rail link).
3. Tap targets inside the events content: Tickets 86x44, Parking 358x44, rail cards 358x71, "More stops" rows 328x45 to 46, "See every stop by month" 157x44, the bag policy pointer link 44 high, hub and index rows 44 or more. Zero horizontal overflow and zero layout shift at 390 on all six events pages.

## 5. Defects

Severity is for a fan on a phone unless a viewport is named.

1. **Venue page, new module is misaligned with its neighbours. Medium. All viewports.** The white card is inset inside the column: x 24, width 342 at 390 against x 12, width 366 for the cards above and below (12px narrower each side); 32px each side at 768 and at 1280. The gap above it is 28px at 390 (36px at 768 and 1280) where the other cards use 12px, and the gap below it is 0px: its bottom edge touches the top of "Teams that play here". `2026-11-18-events-pages/venue-us-bank-stadium/390-branch.png`, `1280-branch-fold.png`.
2. **Venue page, the module pushes "Plan your visit" off the first screen at 390. Medium.** The module adds 167px for one event; the SpotHero and Expedia buttons move from y 749 to y 916, below the 844 fold. At 1280 the card is 114px tall for one line of content. `2026-11-18-events-pages/venue-us-bank-stadium/390-branch-fold.png` against `390-production-fold.png`.
3. **Venue page, the module's link does not look like a link. Low. All viewports.** "Monster Jam: dates and tickets" is plain bold ink text with no underline, chevron or colour, directly above a row ("Vikings promos & giveaways") that has an icon, a border and a chevron. The dates sit outside the link on their own line at 390 and are not tappable.
4. **Stop page, Raymond James parking list is a 23-item wall of unexplained lot codes. Medium. 390.** The Parking card is about 1,160px tall (roughly one and a half screens). Notes read "Club", "Suite parking", "General", which are Buccaneers game-day designations a ticket buyer for this show cannot act on; "HCC", "HCC VIP", "GEICO Lot", "Lot 9" and "Lot 11" have no note at all; "Lot 14 VIP (GEICO)" is labelled "General". There is no lead line, no grouping and no Reserve parking button in the card (the mockup has both). The card ends with "Rates and lot access on an event day can differ from game days." `2026-11-18-events-pages/event-stop-raymond-james-stadium/390-branch.png`.
5. **Stop page, Angel Stadium Transit heading is a six-line block of 20px display type. Medium. 390.** The lead reads "Amtrak Pacific Surfliner, OCTA (Orange County Transportation Authority) bus, ARTIC (Anaheim Regional Transportation Intermodal Center) - bus, train, taxi" at 20px bold with 1.1 line height. The mockup lead is one line ("METRO Blue and Green lines"). `2026-11-18-events-pages/event-stop-angel-stadium/390-branch.png`.
6. **Stop page, the header date line reads as a continuous run when the stop has separate visits. Medium. All viewports.** Angel Stadium: "Dec 19, 2026 to Feb 21, 2027" for four weekends. NRG Stadium: "Feb 6 to 13, 2027" for shows on Feb 6, 7 and 13. The same range is on the image card ("DEC 19, 2026 TO FEB 21, 2027", "FEB 6 TO 13, 2027"), in the hub and index rows ("Houston: Feb 6 to 13, 2027", "San Diego: Jan 9 to 24, 2027 · 4 shows") and in the "Also at" link text pattern.
7. **Hub, a multi-visit stop is listed only under the month of its first show. Medium.** Anaheim appears once, under December 2026. Its January and February weekends are not under January 2027 or February 2027, so a fan scanning February for Anaheim does not find it. The page's own link text elsewhere is "See every stop by month". `2026-11-18-events-pages/event-hub-monster-jam/390-branch.png`.
8. **Stop page, the image card says "MONSTER JAM 2027" on a stop whose next shows are in December 2026. Low.** Angel Stadium card and page title ("Monster Jam Anaheim 2027: Dates and Tickets") both say 2027; the first two rows are Dec 19 and Dec 20, 2026.
9. **Stop page, small text on the image card is too small to read at 390. Low.** The card is a 1200x630 PNG shown at 356x187 (scale 0.30). "LIVE EVENT" renders at about 6px, the dates at about 8px, the wordmark at about 9px and the venue line at about 10px. The mockup sets these at 10, 12, 14 and 14px. The card loads on all four stops (200, image/png, about 38 KB), is not blank, is not cropped and does not overflow. `2026-11-18-events-pages/event-stop-us-bank-stadium/390-branch.png`.
10. **Stop page, type and wrapping differ from the mockup. Low. 390.** The mockup uses a condensed face (Barlow Condensed) for the H1, H2s, times and card title; the page uses the site's wide display face. Result: the H1 is 4 lines (152px) against 3 lines (114px), "Showtimes" starts at y 359 against 316, the first Tickets button at y 405 against 369, the card title "MONSTER JAM 2027" wraps to two lines against one, and the card itself uses a third typeface. The disclosure is 3 lines against 2 (it adds "Prices and availability are set by the listed partners."). Figure height 189 against 202. Button shapes match (Tickets 86x44 against 89x44, 12px radius).
11. **Stop page, breadcrumb links are grey, not link-coloured, and small. Low. 390.** "Events" 37x18 and "Monster Jam" 70x18, in the same grey (#786e60, 4.52:1 on cream) as non-link text; the mockup draws them in the link red. Under the 44px target on both the page and the mockup.
12. **Stop page, "source" links are 33x12. Low. 390.** One on U.S. Bank Stadium, three on NRG Stadium, one on Raymond James. 11px text, contrast 5.6:1. The mockup has the same small link.
13. **Stop page, "Before you go" cards differ from the mockup beyond the intended list. Low.** No lead line on the Bag policy and Parking cards; no "Reserve parking" button inside the Parking card; no source line on the Parking and Transit cards (the Bag, Pit Party and Gates cards have one). NRG Stadium has a Parking button under the showtimes and no Parking card at all.
14. **Stop page, the Anaheim "When is Monster Jam in Anaheim?" answer is one 8-date sentence. Low.** Seven semicolons, about 8 lines at 390, restating the showtime rows above it.
15. **Stop page, "Also at" card label and destination do not match, and the sublabel is filler. Low.** "U.S. Bank Stadium guide / Venue page on PromoNight" opens a page whose H1 is "U.S. Bank Stadium Bag Policy". The mockup sublabel says what is there ("Bag policy, parking and food"). The chevron is a text "›" character, lighter than the mockup's 18px icon.
16. **Hub and index, every row repeats the same filler and two stacked links. Low. 390.** Each row is 116 to 134px: a row link whose second line ends "· dates, tickets and venue guide" on all 19 rows, then a separate "{Venue} venue guide" link. The hub's list is about 2,400px for 19 stops; on the first screen only one stop row is visible below a five-line intro. The row subline wraps to a third line for longer venue names (Bridgestone Arena, Snapdragon Stadium, Lucas Oil Stadium).
17. **Index, "Next stops" shows 12 of 19 stops with no way on. Low.** The list ends at Pittsburgh with no count and no link to the rest; the only route to the other 7 is the "Monster Jam" card above the list.
18. **Stop page at 1280, the image card is a 736x386 dark block. Low. 1280 only.** It fills the lower half of the first screen and pushes "Before you go" to about y 1000. `2026-11-18-events-pages/event-stop-us-bank-stadium/1280-branch-fold.png`.
19. **Stop and index pages, layout shift at 768. Low.** 0.024 on the U.S. Bank Stadium stop and 0.027 on the index, one shift at about 4.4s moving the sections below the header; 0 at 390 and 0.0002 at 1280. Likely ad script timing on the dev server; not confirmed.
20. **Pre-existing, not introduced by this branch: back from a footer link on the team page does not restore scroll. Low for this change.** Tapping the new footer "Events" link and going back landed 226px and, on a second run, 2,379px away. The existing "Stadium guides" footer link does the same on production (306px and 2,301px away) and on the branch (260px).
21. **Pre-existing, site-wide: header wordmark contrast and menu button size.** axe reports "NIGHT" in the header at 4.33:1 (#da2d20 on #f7f3ea, 18px bold) on every page, production included. The menu button is 40x40 (the mockup draws 44x44).

## 6. Measurements

Events pages, branch only (no production baseline exists).

| Measurement at 390 unless noted | Stop: U.S. Bank | Stop: Angel | Stop: NRG | Stop: Raymond James | Hub | Index |
|---|---|---|---|---|---|---|
| HTTP status | 200 | 200 | 200 | 200 | 200 | 200 |
| Document height 390 / 768 / 1280 | 5118 / 4005 / 4011 | 5886 / 4675 / 4657 | 5617 / 4620 / 4622 | 6046 / 4957 / 5000 | 4530 / 3604 / 3558 | 3521 / 2644 / 2582 |
| clientWidth / scrollWidth, all viewports | equal | equal | equal | equal | equal | equal |
| Elements past the right edge | 0 | 0 | 0 | 0 | 0 | 0 |
| Cumulative layout shift 390 / 768 / 1280 | 0 / 0.024 / 0.0002 | 0 / 0.0004 / 0.0002 | 0 / 0.0003 / 0.0002 | 0 / 0.0003 / 0.0002 | 0 / 0.0002 / 0.0001 | 0 / 0.027 / 0.0001 |
| H1 count | 1 | 1 | 1 | 1 | 1 | 1 |
| Heading order | h1, h2 sections, h3 only for FAQ questions | same, plus h3 visit dates inside Showtimes | same | same | h1, h2 months | h1, h2 x2 |
| Content tap targets under 44px | breadcrumb x2 (37x18, 70x18), source x1 (33x12) | breadcrumb x2 | breadcrumb x2, source x3 | breadcrumb x2, source x1 | breadcrumb x1 | none |
| Text under 4.5:1 in page content | none (lowest 4.52:1, grey #786e60 on cream) | none | none | none | none | none |
| axe serious or critical | color-contrast 1 (header wordmark) | same | same | same | same | same |
| First ad anchor y | 57 (the article) | 57 | 57 | 57 | none | none |
| In-content ad slots | 4 x 250px | 4 | 4 | 4 | 0 | 0 |
| `<a>` to /promos/ in DOM / visible | 8 / 6 (all in site chrome) | 8 / 6 | 8 / 6 | 8 / 6 | 8 / 6 | 8 / 6 |
| Images | 1 (generated card, 1200x630 shown 356x187) | 1 | 1 | 1 | 0 | 0 |
| Price strings | 0 | 0 | 0 | 0 | 0 | 0 |
| Links to monsterjam.com or feldentertainment.com | 0 | 0 | 0 | 0 | 0 | 0 |
| "not affiliated" line | present, once | present | present | present | present | present |
| External link hosts | ticketnetwork.lusg.net, tracking.spothero.com, usbankstadium.com | same two, mlb.com | same two, nrgpark.com | same two, raymondjamesstadium.com | none | none |

Contrast of the page's text styles (U.S. Bank Stadium stop, 390): H1 and H2 15.13:1; dates line 15.13:1; city line 8.1:1; breadcrumb links, "2 shows", disclosure and footer note 4.52:1; white on red badge and Tickets button 4.8:1; row sublabel, card labels and source line 5.0:1 on white; body text 8.98:1; red links 5.6:1 on white and 5.06:1 on cream.

Fan walk (390, branch):

- Date and time: in the header line and on each row. Venue: in the H1, the breadcrumb and the city line.
- Primary CTA: first Tickets button opens a new tab; `ticketnetwork.lusg.net` redirects to `www.ticketnetwork.com/tickets/8258515`. The landing page content was not read. `rel="noopener noreferrer sponsored"`. Each row has its own event id.
- Parking button: `tracking.spothero.com`, to a SpotHero search at the stadium coordinates. Not tapped.
- Rail and list taps: "Anaheim" row to H1 "Monster Jam Anaheim at Angel Stadium"; venue guide card to H1 "U.S. Bank Stadium Bag Policy" (defect 15); "Vikings promos" to H1 "Minnesota Vikings"; breadcrumb to hub and index; hub row and index card to the right H1s; venue module link and team rail link to the stop page. Back restored scroll with 0px delta in each.

Copy check: nothing on the three events page types is written for children. The only family-related words are the venue's own "Necessary diaper bags and medical bags are inspected before entry" (NRG Stadium, quoted bag rule).

## 7. Things checked that were fine

- No horizontal overflow at 390, 768 or 1280 on any events page (clientWidth equals scrollWidth; no element past the right edge).
- One H1 per page; H2 for sections; H3 only inside sections.
- Breadcrumb present on stop and hub pages with working links and a BreadcrumbList in JSON-LD; the index is the root and has none.
- Every Tickets row is for a future show; all ticket rows are above the image card.
- The image card loads, is dark with white text, shows the wordmark, "MONSTER JAM 2027", venue, city and dates, is not cropped and stays inside the column.
- No price figure anywhere, in the page or the Event JSON-LD (the Offer carries a URL and availability only). The word "Prices" appears once, in the disclosure.
- No image other than the generated card. No link to monsterjam.com or feldentertainment.com.
- "PromoNight is not affiliated with Monster Jam or Feld Entertainment." is on all three events page types, once each.
- Text contrast on cream and on white cards is at or above 4.5:1 for every text style in the events content.
- Venue and team pages: the only served-HTML differences from production are the new module, the new rail link, the footer link and the dev server's unwrapped Ticketmaster link. No layout shift from either addition; first ad anchor and /promos/ link counts unchanged.
- New team rail link: 44px tall at every viewport, 5.06:1.

## 8. Recommendation

Fix the venue module's box before merge (defect 1, with 2 and 3): it is the one change that alters a live, indexed page, and it is visibly out of line with the cards around it at every viewport. On the new pages, the item most likely to mislead a ticket buyer is the continuous-looking date range for stops with separate visits (defects 6 and 7).


## 9. Dispositions (2026-11-18, after the review; fixes are in the commit that carries this report)

| # | Defect | Disposition |
|---|---|---|
| 1 | Venue module box misaligned inside the bag answer slot | FIXED. Inside the slot the module drops its own gutter and top padding and takes the slot's 12px bottom margin (VenueHubView). |
| 2 | Venue module pushes "Plan your visit" below the fold at 390 | WAIVED. The module is the main bridge into the family by spec, and it renders only while a stop is upcoming at that building and the flag is on. Revisit with click data after launch (known-issues 100). |
| 3 | Venue module link had no link affordance | FIXED. The link is link red and underlines on hover. The dates stay outside the tap area on purpose: the anchor text names the show. |
| 4 | Raymond James parking card is a 23-item list | FIXED in part: a list longer than eight lots shows six and folds the rest under "Show all N lots". The lot notes themselves are the hub's stored words, cut by the event-day rule; improving them is a hub data task (known-issues 101). |
| 5 | Angel Stadium Transit lead is six lines of display type | FIXED. A list of lines longer than 48 characters renders as body text. |
| 6 | Multi-visit stops read as one continuous run of dates | FIXED everywhere it printed (header, description, FAQ, hub and index rows, venue module, team link, image card): several visits read as a count between two dates, never a range. |
| 7 | The hub listed a multi-visit stop only under its first month | FIXED. A stop is listed under every month one of its visits starts in. |
| 8 | "Monster Jam 2027" on a stop whose next shows are December 2026 | WAIVED by ruling: {Year} is the year of the last upcoming performance (build prompt, 2026-11-18). |
| 9 | Small text on the image card at 390 | FIXED. The wordmark, label, venue line and date line are larger. |
| 10 | Display face is the site's, not the mockup's condensed face | WAIVED. The page uses the site's rd-* tokens and fonts like the promo pages; the first Tickets button is still on the first screen. |
| 11 | Breadcrumb links are grey and under 44px tall | WAIVED. Same treatment as the promo page breadcrumb. |
| 12 | "source" links are 33x12 | DEFERRED (known-issues 102). |
| 13 | "Before you go" cards lack lead lines, an in-card Reserve parking button and source lines on Parking and Transit | WAIVED for lead lines and the in-card button (the Parking button sits in the secondary row; a lead line would need a stored summary). Source lines on hub facts are DEFERRED (known-issues 102): the stop page links the venue guide, which carries them. |
| 14 | The Anaheim FAQ answer was one eight-date sentence | FIXED. More than four shows are summarised and the answer points at the list. |
| 15 | "U.S. Bank Stadium guide" opens a page titled "... Bag Policy" | WAIVED. That is the venue page's own title rule; the card's label is the building's name. |
| 16 | Hub and index rows were tall and repeated a phrase | FIXED in part: the repeated phrase is gone. The second link per row stays (the venue guide link is a required link out). |
| 17 | Index "Next stops" had no link to the rest | FIXED. "See all N Monster Jam stops by month" follows the list. |
| 18 | At 1280 the image card is a large block | WAIVED. Same column and card ratio as the promo page. |
| 19 | Layout shift 0.024 to 0.027 at 768 | DEFERRED (known-issues 103): cause not confirmed, under the 0.1 threshold. |
| 20 | Back from a footer link on a team page does not restore scroll | Pre-existing on production; not caused by this branch (known-issues 104). |
| 21 | Header wordmark contrast and menu button size | Pre-existing, site-wide; outside this branch. |

Also from this review: one real affiliate click was made on the U.S. Bank Stadium Tickets button during the fan walk (subId1 web_event_page_monster-jam_us-bank-stadium). It will appear on the partner side as a click with no sale.
