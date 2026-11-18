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


## 10. Second review (2026-11-18, production build, after fixes)

Run: 2026-11-18, 13:05 to 13:40 America/New_York. Branch `feature/events-pages` at 8b33dc4, served as a production build (`next start`) at http://localhost:3100 with EVENTS_PAGES_LIVE and PROMO_PAGES_LIVE on. Production https://www.getpromonight.com, `promonight-deploy` = `dpl_65rWaCL2H7Kbyv5cGfkzHxYefeHB` (the same deployment as the first review). The local build's HTML carries no `promonight-deploy` meta.

Viewports 390x844, 768x1024, 1280x800. Screenshots are in `2026-11-18-events-pages/round2/<slug>/<viewport>-<env>.png` (full page), `<viewport>-<env>-fold.png` (first screen), `<viewport>-diff.png` (venue and team pages) and, for the five stop pages, `390-branch-before-you-go.png` (the Bag, Parking, Transit, Pit Party and Gates cards).

How the run was held:

- Every browser context aborted requests to ticketnetwork.lusg.net, ticketnetwork.com, spothero.com (all subdomains), expedia.com, ticketmaster.com, fanatics.com, *.evyy.net and *.93n6tx.net, and to posthog, google-analytics and googletagmanager hosts, from before the first navigation. Page loads made 0 requests to a partner host and 4 analytics requests each, all aborted.
- One Tickets button and the Parking button were tapped once each at 390 on the U.S. Bank Stadium stop. Each opened a new tab whose only request (a navigation to ticketnetwork.lusg.net, then to tracking.spothero.com) was aborted; the tab ended on the browser's error page. No partner page was loaded and no affiliate click was recorded. No Ticketmaster, Expedia or Fanatics link was tapped.
- Ad scripts ran as served. On 8 of 33 renders (all on the local build, none on production) the `load` event did not fire within 25s because of a third-party ad sync pixel; the pages had rendered and were measured after a further wait. Not counted as a page defect.
- The three /events page types answer 404 on production (checked again: 404, 404, 404), so they have no baseline.

### 10.1 Baseline differences: venue page /venues/us-bank-stadium

Served HTML of `<main>`: not identical. 1 line only in production, 13 only on the branch. Regions:

1. New on branch: a wrapper `div.mb-3` holding `<section data-venue-events>`, with the H2 "Upcoming events at U.S. Bank Stadium", the link "Monster Jam: dates and tickets" to `/events/monster-jam/us-bank-stadium`, and the text "Feb 20 to 21, 2027 · 2 shows". Once in the DOM, between the dark fact band and "Teams that play here".
2. New on branch, outside `<main>`: footer link "Events" to `/events`.
3. Environment, not a defect: the Ticketmaster link is unwrapped on the local build and Impact-wrapped on production.

Served HTML size: production 187,249 bytes, branch 185,504 bytes.

| Viewport | Production height | Branch height | Differing pixels | First differing row | Diff image |
|---|---|---|---|---|---|
| 390 | 7101 | 7273 | 339,927 (12.0%) | 586 (top of the module) | `2026-11-18-events-pages/round2/venue-us-bank-stadium/390-diff.png` |
| 768 | 5147 | 5307 | 503,661 (12.4%) | 558 | `2026-11-18-events-pages/round2/venue-us-bank-stadium/768-diff.png` |
| 1280 | 4429 | 4588 | 703,386 (12.0%) | 558 | `2026-11-18-events-pages/round2/venue-us-bank-stadium/1280-diff.png` |

Nothing differs above the module. Everything below it is the same content moved down, plus ad fill.

| Measurement | Production | Branch |
|---|---|---|
| Module height at 390 / 768 / 1280 | none | 132 / 114 / 114 (first review: 167 / 138 / 138) |
| "Teams that play here" H2 y at 390 | 603 | 747 (+144) |
| "Plan your visit" H2 y at 390 | 749 | 893 (+144; below the 844 fold, waived as known-issues 100) |
| "Teams that play here" H2 y at 768 and 1280 | 575 | 701 (+126) |
| "Plan your visit" H2 y at 1280 (right rail) | 222 | 222 |
| Cumulative layout shift 390 / 768 / 1280 | 0 / 0.033 / 0.032 | 0 / 0.004 / 0.032 (the same "Getting in" and "Tickets & gear" cards move on both; none from the module) |
| First ad anchor y at 390 | 57 | 57 |
| `<a>` to /promos/ in DOM / visible at 390 | 8 / 6 | 8 / 6 |
| axe serious or critical (first-party) | color-contrast 1, label-content-name-mismatch 2, scrollable-region-focusable 1 | same |
| Horizontal overflow at 390 (clientWidth / scrollWidth) | 390 / 390 | 390 / 390 |

The module's box against its neighbours (the dark fact band above, the "Teams that play here" card below):

| Viewport | Module left / right edge | Card above left / right | Card below left / right | Gap above | Gap below |
|---|---|---|---|---|---|
| 390 | 12 / 378 | 12 / 378 | 12 / 378 | 12px | 12px |
| 768 | 32 / 736 | 32 / 736 | 32 / 736 | 12px | 12px |
| 1280 | 92 / 784 | 92 / 784 | 92 / 784 | 12px | 12px |

The link is rgb(198, 42, 30) (#c62a1e) on white, 5.6:1, 14px semibold at 390 and 16px at 768 and 1280, no underline at rest (underline on hover). Tap target 200x44 at 390, 228x44 at 768 and 1280.

### 10.2 Baseline differences: team page /nfl/minnesota-vikings

Served HTML of `<article>`: not identical. Regions:

1. New on branch: `a[data-also-at]`, "Also at U.S. Bank Stadium: Monster Jam, Feb 20 to 21, 2027", to `/events/monster-jam/us-bank-stadium`. Twice in the served HTML (mobile and desktop rail), one visible per viewport.
2. New on branch, outside the article: footer link "Events".
3. Environment: both Ticketmaster links unwrapped on the local build.

Served HTML size: production 289,904 bytes, branch 278,496 bytes (cap 950,000).

| Viewport | Production height | Branch height | Differing pixels | Diff image |
|---|---|---|---|---|
| 390 | 15856 | 15944 | 504,297 (8.1%) | `2026-11-18-events-pages/round2/team-minnesota-vikings/390-diff.png` |
| 768 | 12784 | 12872 | 628,516 (6.4%) | `2026-11-18-events-pages/round2/team-minnesota-vikings/768-diff.png` |
| 1280 | 10287 | 10241 | 629,165 (4.8%) | `2026-11-18-events-pages/round2/team-minnesota-vikings/1280-diff.png` |

At 390 and 1280 about 5,000 pixels differ in the hero (rows 125 to 669 at 390): gradient rendering only, the content is the same on both. The first content difference is the new link.

| Measurement | Production | Branch |
|---|---|---|
| "Game day at U.S. Bank Stadium" H3 y at 390 / 768 / 1280 | 1999 / 2124 / 990 | 2053 / 2178 / 1044 (+54 each) |
| Cumulative layout shift, all viewports | 0 | 0 |
| First ad anchor y at 390 | 706 | 706 |
| `<a>` to /promos/ in DOM / visible at 390 | 26 / 24 | 26 / 24 |
| axe serious or critical (first-party) | color-contrast 2, label-content-name-mismatch 4 at 390 and 7 at 768 and 1280 | same |
| Horizontal overflow at 390 | 390 / 390 | 390 / 390 |

New link: 342x44 at 390 (two lines), 720x44 at 768, 336x44 at 1280; #c62a1e on cream, 5.06:1. Unchanged from the first review.

### 10.3 Game date check

Today is 2026-11-18 in every venue zone involved.

| Page | Dates read (showtime rows, `<time datetime>` and Event startDate) | Verdict |
|---|---|---|
| /events/monster-jam/us-bank-stadium | 2027-02-20 17:00 -06:00, 2027-02-21 15:00 -06:00 | Future |
| /events/monster-jam/angel-stadium | 8 rows, 2026-12-19 16:30 -08:00 to 2027-02-21 14:30 -08:00 | Future |
| /events/monster-jam/nrg-stadium | 2027-02-06, 02-07, 02-13 | Future |
| /events/monster-jam/raymond-james-stadium | 2027-02-13 17:00 -05:00, 2027-02-14 14:00 -05:00 | Future |
| /events/monster-jam/snapdragon-stadium | 2027-01-09, 01-10, 01-23, 01-24 | Future |
| All 19 stop pages (served HTML) | 60 rows, 60 Tickets links, earliest 2026-12-19 | 0 rows on or before today |
| /nfl/minnesota-vikings | 5 Events, 2026-11-29 to 2026-12-26 | Future |

No page is a played game. Row dates, `datetime` values and JSON-LD startDates agree on the five stop pages. No played-show state exists in the data to exercise.

### 10.4 First review defects re-checked

| # | First review defect | Now | What was measured |
|---|---|---|---|
| 1 | Venue module box misaligned | fixed | Edges equal to both neighbours and 12px gaps above and below at 390, 768 and 1280 (table in 10.1). Residual card style difference is N8. |
| 2 | Venue module pushes "Plan your visit" below the fold at 390 | not fixed (waived) | 749 to 893. The module is 35px shorter than before (132 against 167). |
| 3 | Venue module link had no link affordance | fixed | #c62a1e, 5.6:1, underline on hover, 200x44. |
| 4 | Raymond James 23-lot wall | fixed in part | Six lots, then "Show all 23 lots": 328x44, opens on tap (card 449px closed, 1209px open, was about 1160px always), closes on a second tap, no overflow when open. The notes are unchanged (N6). |
| 5 | Angel Stadium transit lead was six lines of display type | fixed | The line list is 14px bold body text, 4 lines (81px). Short lists (U.S. Bank, NRG, Snapdragon) keep the 20px lead. |
| 6 | Multi-visit stops read as one date range | fixed on the stop header, description, FAQ, hub and index rows, team link and image card; not fixed on the venue module | Header "8 shows between Dec 19, 2026 and Feb 21, 2027", "3 shows between Feb 6 and Feb 13, 2027", "4 shows between Jan 9 and Jan 24, 2027". Rows "Anaheim: 4 visits, Dec 19, 2026 to Feb 21, 2027". Team link "Also at Angel Stadium: Monster Jam, from Dec 19, 2026". Card "8 SHOWS · DEC 19, 2026 TO FEB 21, 2027". Venue module: see N2. |
| 7 | Hub listed a multi-visit stop under its first month only | fixed | Anaheim is under December 2026, January 2027 and February 2027. 21 rows for 19 stops. See N3 for what each copy says. |
| 9 | Image card text too small at 390 | changed | Card shown at 356x187 (scale 0.297). Font size and measured glyph height per line at 390: wordmark 12.5px / 9.2px; "LIVE EVENT" 8.9px / 6.2px; headline 33.2px / 24.3px (one line on all five); venue line 13.6px / 10.4px; dates line 11.3px / 9.5px. First review: about 9, 6, n/a, 10 and 8px. Four lines are at or near the mockup's sizes; the label is not (N9). |
| 11 | Breadcrumb links grey and small | not fixed (waived) | 37x18 and 70x18, 4.52:1. |
| 12 | "source" links 33x12 | not fixed (deferred, 102) | 33x12; one on U.S. Bank, Raymond James and Snapdragon, three on NRG. |
| 13 | Before you go cards lack lead lines, in-card button, source lines on hub facts; NRG has no Parking card | not fixed (waived and deferred) | Unchanged. |
| 14 | Anaheim FAQ answer was one eight-date sentence | fixed | "Monster Jam has 8 shows between Dec 19, 2026 and Feb 21, 2027 at Angel Stadium. Every showtime is listed at the top of this page. Times are local to the venue." Stops with four shows or fewer still list each (San Diego: four dates, three semicolons). |
| 16 | Hub and index rows tall, repeated phrase | fixed in part | The phrase is gone. Rows are 116 to 138px with two links each; the hub is 4753px at 390 (was 4530, three more rows). |
| 17 | Index "Next stops" had no link on | fixed | "See all 19 Monster Jam stops by month", 250x44, opens the hub (H1 "Monster Jam 2027 dates and venue guides"); back restores scroll, 0px. |
| 19 | Layout shift 0.024 to 0.027 at 768 | not fixed (deferred, 103); cause confirmed | See 10.6. It is the H1 re-wrapping when the display font loads, not ads. |
| 20 | Back from a team page footer link does not restore scroll | not fixed (pre-existing) | Also seen from the rail links, on both environments (N10). |

Defects 8, 10, 15, 18 and 21 were waived or are outside the branch and are unchanged.

### 10.5 New defects

There is no high severity defect: nothing found would mislead a ticket buyer about a show, a date, a time or where a Tickets button goes, and no page is broken.

- **N1. NRG Stadium stop, the Questions answer drops the scope of the bag rule. Medium. All viewports.** `/events/monster-jam/nrg-stadium`. The Bag card now says, after the rule, "NRG Stadium prints this for the Feb 6 to 7 shows. It has not published a rule for the other dates on this page." That sentence is clear: it names the covered shows and says the rest have none. Lower on the same page (H3 at y 3092 at 390), "What is the bag policy for Monster Jam at NRG Stadium?" answers with the rule alone: "Bag policies vary per event. Backpacks and large bags that exceed 11 by 17 inches are not allowed. Necessary diaper bags and medical bags are inspected before entry." No dates, no caveat. A fan holding Feb 13 tickets who reads the Questions section gets the rule as if it covered that show. The page title ("Dates, Tickets and Bag Policy") and meta description ("plus the bag policy") carry no scope either. `2026-11-18-events-pages/round2/event-stop-nrg-stadium/390-branch.png`.
- **N2. Venue module on a multi-visit building still prints a from-to range. Medium. All viewports.** Not on the U.S. Bank Stadium sample (one visit, "Feb 20 to 21, 2027 · 2 shows"). Read from the served HTML of three other venue pages: `/venues/angel-stadium` "Dec 19, 2026 to Feb 21, 2027 · 8 shows"; `/venues/nrg-stadium` "Feb 6, 2027 to Feb 13, 2027 · 3 shows"; `/venues/snapdragon-stadium` "Jan 9, 2027 to Jan 24, 2027 · 4 shows". The show count follows, but there is no visit count and the wording differs from the hub row for the same stop ("4 visits, Dec 19, 2026 to Feb 21, 2027"). Section 9 lists the venue module among the places defect 6 was fixed.
- **N3. Hub, a multi-visit stop's row is the same under every month. Low. All viewports.** `/events/monster-jam`. Under January 2027 and under February 2027 the Anaheim row reads "Anaheim: 4 visits, Dec 19, 2026 to Feb 21, 2027 · Angel Stadium · 8 shows", word for word as under December. The row under February does not say which February dates (Feb 20 to 21). The year is also printed twice in same-year rows ("San Diego: 2 visits, Jan 9, 2027 to Jan 24, 2027", "Houston: 2 visits, Feb 6, 2027 to Feb 13, 2027"), which wraps those row links to two lines (65px against 44px) at 390; the image card does the same ("3 SHOWS · FEB 6, 2027 TO FEB 13, 2027"). `2026-11-18-events-pages/round2/event-hub-monster-jam/390-branch.png`.
- **N4. Snapdragon Stadium Parking card, two notes that are not parking information for this show. Medium. 390 and up.** `/events/monster-jam/snapdragon-stadium`. "Purple Lot: Rideshare pick-up is located here." lists a lot under Parking whose only note says it is where rideshare picks up; a fan cannot tell whether to park there. "Green Lot: Enter via Gate 1 (Friars Road). Temporary tents are not permitted in this lot." keeps a tailgating rule from the home-game note. The other three lots (gate names only) and the Transit card ("MTS Trolley Green Line. The MTS Green Line drops riders right at the stadium entrance.") read correctly; the cut transit note is short and clear. `2026-11-18-events-pages/round2/event-stop-snapdragon-stadium/390-branch-before-you-go.png`.
- **N5. Angel Stadium Parking and Transit cards, home-team remnants and a lot with only a name. Low. 390 and up.** `/events/monster-jam/angel-stadium`. "Lexus Lot: Located just west of the Home Plate Gate; reserved for Lexus vehicles, maximum capacity 100 on a first-come, first-served basis." is a team sponsor programme, with nothing saying it runs for this show. "Big A Lot" is a name with no note. Transit: "The Orange County Transportation Authority runs bus service to the ballpark (714-636-RIDE)." reads as written for a baseball game. The other sentences hold for any event. `2026-11-18-events-pages/round2/event-stop-angel-stadium/390-branch-before-you-go.png`.
- **N6. Raymond James Parking fold, what shows first and how the fold behaves. Low. 390 and up.** `/events/monster-jam/raymond-james-stadium`. The six lots shown are Lot A "Accessible parking", Lot B "Suite parking", Lot C "Accessible parking", Lot D "Suite parking", Lot 1 "General", Lot 2 "General": the first general lot is fifth. "Suite parking" (4 lots) and "Club" (4 lots) are premium-seat designations of the home team; "Lot 9", "Lot 11", "HCC", "HCC VIP" and "GEICO Lot" have no note; "Lot 14 VIP (GEICO)" is labelled "General" (notes are known-issues 101). The fold itself: the summary is red text with no chevron or marker (the browser's disclosure triangle is removed), its label stays "Show all 23 lots" after it is open, and the 17 further lots continue below the label. It reveals 17, not 23. Not in the five pages asked for, the same cut on `/events/monster-jam/loandepot-park` leaves "Home Plate Garage", "First Base Garage" and "Third Base Garage" as names only. `2026-11-18-events-pages/round2/event-stop-raymond-james-stadium/390-branch-parking-closed.png`, `390-branch-parking-open.png`.
- **N7. NRG Stadium, the Pit Party and Gates cards say nothing about the third show. Low. All viewports.** `/events/monster-jam/nrg-stadium`. Both cards and both FAQ answers list Feb 6 and Feb 7 only. Each line is dated, so nothing is wrong, but unlike the Bag card there is no line saying the venue has not listed times for Feb 13. Transit: "Exit at Stadium Park / Astrodome Station off Fannin and enter Gate 2." names an entry gate that may be a game-day arrangement; the rest of the note holds for any event. `2026-11-18-events-pages/round2/event-stop-nrg-stadium/390-branch-before-you-go.png`.
- **N8. Venue module card is drawn differently from the cards around it. Low. All viewports.** `/venues/us-bank-stadium`. Radius 16px with a 1px border and no shadow, against 12px, no border and a shadow on the cards above and below. Its heading starts 5px further in at 768 and 1280 (x 53 against 48; x 113 against 108) and 1px at 390 (29 against 28). At 1280 the card is 114px tall for one line of content. `2026-11-18-events-pages/round2/venue-us-bank-stadium/1280-branch-fold.png`.
- **N9. Image card, "LIVE EVENT" is still under 10px at 390. Low. 390.** All five stop pages. Font size 8.9px, capital height 6.2px (the mockup sets 10px). The other four lines are legible.
- **N10. Pre-existing, not introduced by this branch: back to the team page from a rail link lands 270px lower. Low for this change. 390.** `/nfl/minnesota-vikings`. Tapping the new "Also at" link and going back put the page at scrollY 1855 against 1585 at the tap, in 3 of 3 runs. The existing "Full gameday guide" link in the same rail does the same on the branch (1784 against 1514, 2 of 2) and on production (1814 against 1544 in 1 of 2 runs, exact in the other). The first review measured 0px for this link on the dev server. Same family as defect 20 (known-issues 104), which names footer links only.

Rows with no ticket link: none exist. All 60 showtime rows on all 19 stop pages carry a Tickets link, and "No link yet", "Sold out" and "Started" do not appear in any served stop page, so those labels could not be seen rendered.

### 10.6 Layout shift at 768 (defect 19): cause confirmed

The first review guessed ad script timing. That is wrong; the trace in known-issues 103 is right. Seven loads per page and viewport on the production build:

| Page at 768 | Normal (3 runs) | Fonts delayed 1.5s | Font files blocked | All third parties blocked | Third parties blocked, fonts delayed |
|---|---|---|---|---|---|
| /events/monster-jam/us-bank-stadium | 0.0241 at 54 to 86ms | 0.0241 at 1543ms | 0 | 0.0241 at 70ms | 0.0241 at 1546ms |
| /events | 0.0267 at 49 to 54ms | 0.0267 at 1542ms | 0 | 0.0267 at 52ms | 0.0267 at 1542ms |
| /events/monster-jam | 0.0002 | 0.0002 | 0 | 0.0002 | 0.0002 |

The shift follows the font, not the ads. The H1 is 76px tall (two lines) in the fallback face and 114px (three lines) once the display face loads on the U.S. Bank Stadium stop, and 38px then 76px on the index; everything below moves down 38px in one step. With the font files blocked the H1 never re-wraps and the shift is 0. With every third-party request blocked the shift is unchanged. The hub H1 is two lines in both faces and does not shift. At 390 all three pages measure 0 in every mode (the H1 line count is the same in both faces). The other four stop pages measure 0.0003 to 0.0004 at 768.

### 10.7 Measurements

Events pages, branch only.

| Measurement at 390 unless noted | Stop: U.S. Bank | Stop: Angel | Stop: NRG | Stop: Raymond James | Stop: Snapdragon | Hub | Index |
|---|---|---|---|---|---|---|---|
| HTTP status | 200 | 200 | 200 | 200 | 200 | 200 | 200 |
| Document height 390 / 768 / 1280 | 5118 / 4005 / 4011 | 5490 / 4575 / 4578 | 5617 / 4620 / 4622 | 5335 / 4247 / 4290 | 5756 / 4806 / 4569 | 4753 / 3838 / 3797 | 3381 / 2698 / 2636 |
| clientWidth / scrollWidth, all viewports | equal | equal | equal | equal | equal | equal | equal |
| Elements past the right edge | 0 | 0 | 0 | 0 | 0 | 0 | 0 |
| Cumulative layout shift 390 / 768 / 1280 | 0 / 0.0241 / 0.0002 | 0 / 0.0004 / 0.0002 | 0 / 0.0003 / 0.0002 | 0 / 0.0003 / 0.0002 | 0 / 0.0003 / 0.0002 | 0 / 0.0002 / 0.0001 | 0 / 0.0267 / 0.0001 |
| H1 bottom, dates line bottom, first Tickets button (y) | 288, 341, 405 to 449 | 250, 303, 397 to 441 | 250, 303, 397 to 441 | 288, 341, 405 to 449 | 288, 341, 435 to 479 | n/a | n/a |
| Fixed ad bar top (first screen ends) | 794 | 794 | 794 | 794 | 794 | none | none |
| Showtime rows / Tickets links | 2 / 2 | 8 / 8 | 3 / 3 | 2 / 2 | 4 / 4 | n/a | n/a |
| Last ticket row bottom, image card top | 552, 680 | 1150, 1278 | 660, 788 | 552, 680 | 784, 912 | n/a | n/a |
| Tickets button, Parking button | 86x44, 358x44 | same | same | same | same | n/a | n/a |
| Heading order | h1, h2, h3 only for FAQ | h1, h2, h3 visit dates, h2, h3 FAQ | same as Angel | as U.S. Bank | as Angel | h1, h2 x4 | h1, h2 x2 |
| Content tap targets under 44px | breadcrumb x2 (37x18, 70x18), source x1 (33x12) | breadcrumb x2 | breadcrumb x2, source x3 | breadcrumb x2, source x1 | breadcrumb x2, source x1 | breadcrumb x1 | none |
| Text under 4.5:1 in page content, all viewports | none | none | none | none | none | none | none |
| axe serious or critical | color-contrast 1 (header wordmark, 4.33:1) | same | same | same | same | same | same |
| Images in the content | 1 (generated card, 1200x630 shown 356x187) | 1 | 1 | 1 | 1 | 0 | 0 |
| Price strings | 0 | 0 | 0 | 0 | 0 | 0 | 0 |
| Links to monsterjam.com or feldentertainment.com | 0 | 0 | 0 | 0 | 0 | 0 | 0 |
| "not affiliated" line | once | once | once | once | once | once | once |
| External link hosts | ticketnetwork.lusg.net, tracking.spothero.com, usbankstadium.com | same two, mlb.com | same two, nrgpark.com | same two, raymondjamesstadium.com | same two, snapdragonstadium.com | none | none |

Contrast of the text styles, the same on every events page: ink on cream 15.13:1; ink on white 16.75:1; body on white 8.98:1; soft ink on cream 8.1:1; grey #786e60 on white 5.0:1 and on cream 4.52:1; link red #c62a1e on white 5.6:1 and on cream 5.06:1; white on the red badge and button 4.8:1; footer "Events" 5.9:1.

Fan walk at 390 (branch). Destination H1 matched the label in every tap, and back restored the scroll position to the pixel in each:

| Tap | Destination H1 | Back, scroll delta |
|---|---|---|
| Hub, Minneapolis row under February | Monster Jam Minneapolis at U.S. Bank Stadium | 0px (2262 to 2262) |
| Hub, Anaheim row under January | Monster Jam Anaheim at Angel Stadium | 0px |
| Hub, Detroit row under February (3 runs) | Monster Jam Detroit at Ford Field | 0px each |
| Hub, "Bridgestone Arena venue guide" | Bridgestone Arena Bag Policy | 0px |
| Index, "See all 19 Monster Jam stops by month" | Monster Jam 2027 dates and venue guides | 0px |
| Index, San Diego row | Monster Jam San Diego at Snapdragon Stadium | 0px |
| Stop, venue guide card | U.S. Bank Stadium Bag Policy | 0px |
| Stop, Vikings promos card | Minnesota Vikings | 0px |
| Stop, More stops row (4 runs) | Monster Jam Salt Lake City at Delta Center, Monster Jam San Diego at Snapdragon Stadium | 0px each |
| Stop, "See every stop by month" (3 runs) | Monster Jam 2027 dates and venue guides | 0px each |
| Venue page, module link | Monster Jam Minneapolis at U.S. Bank Stadium | 0px |
| Team page, "Also at" link (3 runs) | Monster Jam Minneapolis at U.S. Bank Stadium | 270px each (N10, pre-existing) |

Primary CTA: the first Tickets button is `target="_blank"`, `rel="noopener noreferrer sponsored"`, href `ticketnetwork.lusg.net/c/...` wrapping `www.ticketnetwork.com/tickets/8258515` with `subId1=web_event_page_monster-jam_us-bank-stadium`; every row on the five pages carries its own event id. Parking: `tracking.spothero.com/aff_c?...aff_sub=web_event_page_monster-jam_us-bank-stadium`, a search at the stadium coordinates, same target and rel. Both navigations were aborted; neither destination was loaded. The Event JSON-LD Offer url is the stop page itself and carries no price.

### 10.8 Checked and fine

- No horizontal overflow at 390, 768 or 1280 on any of the nine pages (clientWidth equals scrollWidth; no element past the right edge on the events pages), including with the Raymond James fold open.
- First screen at 390x844 on all five stop pages shows the H1, the dates line and the first Tickets button above the fixed ad bar.
- Every Tickets row is for a future show (60 of 60 across all 19 stops). All ticket rows are above the image card on all 19.
- No price figure on any events page or in its JSON-LD. The word "Prices" appears once, in the disclosure.
- No image other than the generated card on a stop page; none on the hub or index. No background image, no SVG art.
- No link to monsterjam.com or feldentertainment.com. "PromoNight is not affiliated with Monster Jam or Feld Entertainment." is on all three events page types, once each, and on all 19 stops.
- Nothing in the copy is aimed at children. The only family-related words are the venue's quoted bag rule on NRG Stadium ("Necessary diaper bags and medical bags are inspected before entry").
- No sales copy in any Parking or Transit card on the five stop pages; no fare, clock time, tailgate or match-day sentence survives except the ones listed in N4, N5 and N7.
- U.S. Bank Stadium Parking and Transit cards read correctly for an event day.
- One H1 per page; H2 for sections; H3 only inside a section.
- Text contrast at or above 4.5:1 for every style in the events content, the venue module and the team link, at all three viewports.
- Layout shift 0 at 390 on all seven events pages; none from the venue module or the team link.
- The NRG Stadium partial bag rule sentence in the Bag card is clear.
- The venue module and the team link are the only served-HTML differences from production besides the footer link and the unwrapped Ticketmaster link. First ad anchor and /promos/ link counts are unchanged on both pages.

### 10.9 Recommendation

Carry the bag rule's scope into the NRG Stadium Questions answer (N1) and give the venue module the same multi-visit wording as the hub rows (N2) before merge; both are places where a fix recorded in section 9 did not reach every surface. The parking and transit remnants (N4 to N7) are hub data and can follow under known-issues 101.


## 11. Dispositions of the second review (2026-11-18)

No high severity defect was reported. The fixes below are on the branch after the reviewed build (commits ae75a08 and the one that carries this section); they were checked in served HTML of a fresh production build, not re-run through this agent.

| # | Defect | Disposition |
|---|---|---|
| N1 | NRG bag FAQ answer had no scope sentence | FIXED. The FAQ answer carries the same sentence as the card ("NRG Stadium prints this for the Feb 6 to 7 shows. It has not published a rule for the other dates on this page."). The title keeps "and Bag Policy": the page does print a bag rule. |
| N2 | Venue module printed a from-to range for a multi-visit stop | FIXED in ae75a08: "4 visits, Dec 19, 2026 to Feb 21, 2027 · 8 shows". Section 9 was wrong to list this surface as fixed in the first round. |
| N3 | Hub repeats a multi-visit row under each month, year printed twice | DEFERRED (known-issues 107). |
| N4 | Snapdragon lot notes cut to a fragment | WAIVED for "Rideshare pick-up is located here." (true on an event day). Lot note quality is known-issues 101. |
| N5 | Angel Stadium: Lexus Lot, Big A Lot name alone | FIXED in ae75a08: a reserved lot, and a lot whose whole note is game-day copy, are left off the page. "bus service to the ballpark" is the hub's transit text (known-issues 101). |
| N6 | Raymond James fold: suite and club lots listed; fold label does not change | FIXED in part in ae75a08: suite, club, VIP and per-game lots are left off (9 lots remain, so the list no longer folds). The fold's label and chevron are DEFERRED (known-issues 107). |
| N7 | NRG Pit Party and Gates cards silent on Feb 13; transit note says "enter Gate 2" | WAIVED: the venue prints no Pit Party or gate time for Feb 13, and the cards list only what it prints. |
| N8 | Venue module card style differs from its neighbours | DEFERRED (known-issues 107). It matches "Next giveaways here", the module it rides with. |
| N9 | "LIVE EVENT" on the image card is small at 390 | FIXED: the label is larger. |
| N10 | Back to the team page from a rail link lands 270px lower | Pre-existing on production (known-issues 104). |
