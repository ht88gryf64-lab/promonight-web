# UX review: feature/events-restyle, 2026-11-18

Run on 2026-11-18, 15:27 to 15:50 CST (America/New_York date 2026-11-18).

- Branch: `feature/events-restyle`, HEAD `72c71be` ("Events hub: a month's rows sort by that month's first visit", committed 15:21:36 CST).
- Environment reviewed: the production build of the branch served at `http://localhost:3101` with the events flag on (`.next/BUILD_ID` written 15:23:05 CST). It carries no `promonight-deploy` meta.
- Production: `https://www.getpromonight.com`, `promonight-deploy` = `dpl_2DrW8tfzPgyKcC4ZQk7jf2G8QdXC`. Every `/events` path is 404 there by design, so the six events pages have no baseline and were reviewed standalone against `docs/events-monster-jam-mockup-v2.html`. Production was used only for `/venues/us-bank-stadium`.
- Viewports: 390x844, 768x1024, 1280x800. Extra width probes on the U.S. Bank stop: 320, 360, 430, 1024, 1920.
- Browser: Playwright's default Chromium build launched without `executablePath`. Desktop Chrome User-Agent.
- Blocked: every request to a host other than `localhost` and `www.getpromonight.com` was aborted (seen and aborted: `www.googletagmanager.com`, `ads.adthrive.com`, `us.i.posthog.com`, `us-assets.i.posthog.com`). No Tickets or Reserve parking button was tapped, no affiliate, monsterjam.com, feldentertainment.com or pixabay.com request was made. Affiliate hrefs were read only.
- Screenshots (not in the repo): `/private/tmp/claude-501/-Users-mattkovalik-promonight-web/9a9089de-77d7-4b8c-add2-4b36f8d24d44/scratchpad/uxr-restyle/`, named `<page>-<viewport>-branch.png` (full page), `<page>-<viewport>-fold.png`, `<page>-390-strip-a.png` (the first five 844px screens side by side), `walk-<page>-<viewport>-<anchor>.png`, `tiles-390.png`, `venue-<viewport>-<env>-aligned.png`, `venue-<viewport>-diff-aligned.png`. Page keys: `usb`, `nrg`, `angel`, `dome`, `hub`, `index`.

## Coverage gap, read this first

The worktree was not clean during the run. Five tracked files carry uncommitted edits stamped 15:29:42 CST, which is after the build under review (15:23:05) and after HEAD:

`src/components/events/EventCountdown.tsx`, `src/components/events/EventStopView.tsx`, `src/lib/events/event-pages.ts`, `src/lib/events/__tests__/event-pages.test.ts`, `src/components/venue-hub/__tests__/venue-parking-anchor.test.tsx` (40 insertions, 13 deletions).

They change the countdown leaf (it now picks the first show that has not started, and `data-event-countdown` becomes an empty attribute), the rule for the "Your Saturday, hour by hour" heading, and Pit Party strip de-duplication. None of that is in the build that was served, so none of it is covered by this report. Items 2 and 4 below describe HEAD `72c71be` only. This reviewer did not make those edits and did not touch them.

## Baseline differences: /venues/us-bank-stadium, branch build vs production (item 6)

Verdict: the Transit row is visually unchanged. The page as a whole is not identical to production, because the local build has the events flag on.

Served HTML of `<main>` (scripts, nonces, build paths stripped): not identical. 55,279 characters on the branch build, 54,511 on production. Every differing region:

| # | Region | Branch build | Production | Visible |
|---|--------|--------------|------------|---------|
| 1 | Block above "Getting in" | `<section data-venue-events>`: "Upcoming events at U.S. Bank Stadium / Monster Jam: dates and tickets / Feb 20 to 21, 2027 · 2 shows", linking to `/events/monster-jam/us-bank-stadium` | absent | Yes. 132px tall plus 12px margin at 390, 114px plus 12px at 1280. Flag-dependent. |
| 2 | Transit row of "Getting in" | `<div id="transit" class="scroll-mt-24">` | `<div>` (no id, no class) | No. Same text, same box. |
| 3 | Vikings ticket link (two anchors) | `https://www.ticketmaster.com/minnesota-vikings-tickets/artist/805973` | `https://ticketmaster.evyy.net/c/7236189/264167/4272?u=...&sharedid=web_venue_us-bank-stadium` | No. The branch diff against `origin/main` contains no line mentioning ticketmaster or evyy, so this is the local build's environment, not a code change. It was not confirmed against a preview deployment. |
| 4 | Footer | carries an "Events" link (`/events`) | no `/events` link | Yes. One extra footer row. Flag-dependent. |

`id="transit"` count: 1 on the branch build, 0 on production. `id="parking"` count: 1 on both.

Transit row box, measured in both environments:

| Viewport | Branch build | Production |
|----------|--------------|------------|
| 390 | x 28, y 1048 (events block hidden), 334 x 96.5, 13px/19.5px, rgb(33, 29, 24), child 2 of 5 | x 28, y 1048, 334 x 96.5, 13px/19.5px, rgb(33, 29, 24), child 2 of 5 |
| 1280 | x 443, y 736 (events block hidden), 325 x 96.5 | x 443, y 736, 325 x 96.5 |

Pixel comparison:

| Viewport | As served | With the branch's events block hidden in the browser (alignment only, no source change) |
|----------|-----------|-----------|
| 390 | 474,834 px differ from y 587 to the end. Document 5780 vs 5603. Everything below the events block is displaced. | 9,178 px differ, all at y 5050 or lower (the footer). 0 px differ from y 0 to y 5049, which includes the whole "Getting in" card. Document 5637 vs 5603 (34px, the one extra footer row). |
| 1280 | 619,647 px differ from y 559 to the end. Document 3597 vs 3437. | 7,462 px differ, all at y 3150 or lower (the footer). 0 px differ above. Document 3471 vs 3437 (34px). |

Measurements that moved: document height (above), `<main>` link count 23 vs 22, CLS 0.0012 vs 0 at 390 and 0.0012 vs 0.0012 at 1280. Horizontal overflow: none in either (scrollWidth equals clientWidth at both widths).

Diff images: `venue-390-diff-aligned.png`, `venue-1280-diff-aligned.png`, and the unaligned `venue-390-diff.png`, `venue-1280-diff.png`.

## Show date check

Today in the venue zones: 2026-11-18 in America/Chicago (U.S. Bank Stadium, NRG Stadium, Caesars Superdome) and 2026-11-18 in America/Los_Angeles (Angel Stadium).

| Page | Event `startDate` values in JSON-LD | Dates on the page | Verdict |
|------|-------------------------------------|-------------------|---------|
| us-bank-stadium | 2027-02-20T17:00-06:00, 2027-02-21T15:00-06:00 | `<time>` for each, same values | all upcoming |
| nrg-stadium | 2027-02-06T17:00-06:00, 2027-02-07T15:00-06:00, 2027-02-13T17:00-06:00 | same | all upcoming |
| angel-stadium | 2026-12-19T16:30-08:00, 2026-12-20T14:30-08:00, 2027-01-16, 2027-01-17, 2027-01-30, 2027-01-31, 2027-02-20T16:30-08:00, 2027-02-21T14:30-08:00 | same | all upcoming |
| caesars-superdome | 2027-02-27T19:00-06:00 | same | upcoming |
| hub, index | no Event with a `startDate` in JSON-LD | earliest stop Dec 19, 2026 | upcoming |

No show in the past is listed and none is offered tickets. Ticket cards match Events one for one (2, 3, 8, 1), each Event has one offer. Not a played-game page. The played state could not be exercised: the nearest show is 31 days out.

## Results in the order asked

### 1. Hero photo, the NO CROP ruling: passes

The full truck with its grille, both crushed cars and the sky above the truck are in frame at 390, 768 and 1280 on a stop page and on the hub (looked at `usb-390-strip-a.png`, `usb-768-fold.png`, `usb-1280-fold.png`, `hub-390-strip-a.png`).

| Viewport | `<img data-event-hero-photo>` box | Box ratio | object-fit | Dark band |
|----------|-----------------------------------|-----------|------------|-----------|
| 320 | 320 x 213 | 1.5023 | fill | 320 |
| 360 | 360 x 239.6 | 1.5023 | fill | 360 |
| 390 | 390 x 259.6 (390 x 260 at 2x) | 1.5023 (1.5000 at 2x) | fill | 390 |
| 430 | 430 x 286.2 | 1.5023 | fill | 430 |
| 768 | 600 x 399.4 | 1.5023 | fill | 640, 20px of band each side |
| 1024, 1280, 1920 | 600 x 399.4 | 1.5023 | fill | 768 at 1280, 84px each side |

The file is 2576 x 1717 (1.5003). The box follows the ratio of the variant next/image serves (640 x 426 is 1.5023), `aspect-ratio: auto 2576 / 1717`, no fixed height, no ancestor with `overflow: hidden`. Nothing is cut on any side at any width, so even the permitted side trim does not happen. A gradient to the band colour covers the bottom 26px of the photo at 390 and the bottom 40px at 600; it darkens the dirt under the cars and does not hide them.

Credit line "Photo: Marion Wellmann / Pixabay. Not a truck from this show.": present and visible under the hero on all four stop pages and on the hub at all three widths (y 639 on us-bank, angel and superdome at 390, y 597 on nrg, y 681 on the hub). The index has no photo and no credit.

Other images: none. Each stop page and the hub has exactly one `<img>` (the hero); the index has zero. No `<picture>`, `<video>`, `<canvas>`, `<iframe>`, SVG `<image>` or CSS `background-image: url()` on any of the six pages. The og:image and the JSON-LD image are still the generated card (`/api/event-card/monster-jam~{venue}`), not the photo.

### 2. Countdown: passes on the build reviewed (HEAD 72c71be)

| Stop | First show (venue zone) | Today (venue zone) | Expected | Served HTML | After hydration |
|------|-------------------------|--------------------|----------|-------------|-----------------|
| us-bank-stadium | 2027-02-20 | 2026-11-18 | 94 | 94 days away | 94 days away |
| nrg-stadium | 2027-02-06 | 2026-11-18 | 80 | 80 days away | 80 days away |
| angel-stadium | 2026-12-19 | 2026-11-18 | 31 | 31 days away | 31 days away |
| caesars-superdome | 2027-02-27 | 2026-11-18 | 101 | 101 days away | 101 days away |

Yellow rgb(245, 197, 24), next to the badge, 10.28:1 on the band. A mutation log on the element from document start recorded no text change on any stop at any width. Its box moved once, by 1px in x and 2px in width at about 25 to 95ms, when the web font replaced the fallback; that is the font, not hydration, and the page CLS on those loads was 0.0004 or less. With the browser zone set to Asia/Tokyo and to Pacific/Honolulu the number stayed 94, so it is computed in the venue's zone. With the browser clock moved two days ahead the text went from 94 to 92 at 65ms in a box of the same size (CLS 0.0004): a stale server number is corrected in place without moving anything. The hub has no countdown (it prints "19 stops we cover · 60 shows" in the same slot).

### 3. Above the fold at 390x844

Date, first showtime and the first Tickets button are all inside the first screen on all four stops, but only just.

| Stop | H1 lines / height | Dates line y | First showtime y | First Tickets button (top to bottom) | Room left above the 844 fold |
|------|-------------------|--------------|------------------|--------------------------------------|------------------------------|
| us-bank-stadium | 4 / 167px | 615 | 749 | 751 to 799 | 45px |
| nrg-stadium | 3 | 573 | 739 | 741 to 789 | 55px |
| angel-stadium | 4 | 615 | 781 | 783 to 831 | 13px |
| caesars-superdome | 4 | 615 | 749 | 751 to 799 | 45px |

At other sizes, U.S. Bank stop: 360 wide, H1 5 lines, Tickets top at y 800; 320 wide, H1 6 lines, Tickets top at y 845; 768x1024, Tickets top at 849 (visible); 1280x800, Tickets top at 878 (858 on nrg and angel), below the fold. See defect 2.

### 4. Fidelity to the mockup

Section order matches on every stop. us-bank-stadium at 390: hero (H1 at y 403), Pick your show (698), Your Saturday, hour by hour (1061), Before you go (1417), Also at U.S. Bank Stadium (1956), More Monster Jam stops (2117), Questions (2550). nrg adds a date label per visit under Pick your show and one "Hour by hour" card with two dated blocks. angel and superdome have no hour-by-hour card, as specified.

- Before you go is one white card (482px on us-bank at 390) with a row each for bags, transit and parking, one Reserve parking button.
- Also at: two white tiles (venue guide, home team promos). More stops: six dark tiles (rgb(33, 29, 24)) in a two-column grid with yellow date lines, then "See all stops we cover". The mockup drew three tiles in one clipped row; the grid shows more and hides nothing.
- Accent #f5c518 is used where the mockup uses it and nowhere else: the Live event badge background, the countdown, the hazard stripe, the weekday on each date tile, the first timeline dot, the per-show label in the timeline, the "source" link inside the dark card, the date line on each dark tile.
- Tickets buttons are rgb(218, 45, 32) with white text (4.80:1), 93.5 x 48. In-text links are #c62a1e.
- Ink is the site's #211d18 and the display face is Archivo at 44px, where the mockup drew #1a1613 and Barlow Condensed at 54px. Neither hurts.

Differences that hurt are listed as defects 2, 5, 6, 7 and 8.

### 5. Usual checks

- Horizontal overflow: none at 390, 768, 1280 on all six pages (scrollWidth equals clientWidth). There is overflow at 360 and 320, see defect 1.
- CLS with a scroll to the bottom: table below. Worst 0.0267.
- Tap targets under 44x44 inside the article at 390: breadcrumb links and "source" links only, see defect 3. Tickets 93.5 x 48, Reserve parking and both guide links 44 tall, tiles and hub rows 44 or taller.
- Contrast: no failing text inside the article on any page. Table below. One failure in the site header, see defect 9.
- Heading order: one H1, then H2 per section, H3 for visit dates and questions. No skipped level on any page.
- Links: 70 distinct internal paths across the six pages, every one answers 200. No empty href, no `#`, no fragment without a target. External links, read only: `ticketnetwork.lusg.net` (rel "noopener noreferrer sponsored", new tab), `tracking.spothero.com` (sponsored), and the venue's own site (`www.usbankstadium.com`, `www.nrgpark.com`, `www.mlb.com`, `www.caesarssuperdome.com`, rel "noopener nofollow").
- axe-core, serious and critical: one rule on every page, the header wordmark (defect 9). Nothing inside the article.
- No console errors, no failed same-origin requests, no hydration warnings on any load.

In-page links to the venue guide, tapped at 390 on all four stops and at 1280 on us-bank. Sticky header bottom edge is at y 57.

| Stop | Link text | Lands on | Target | Target top in viewport | Back restores scroll |
|------|-----------|----------|--------|------------------------|----------------------|
| us-bank-stadium | Transit on the U.S. Bank Stadium guide | /venues/us-bank-stadium#transit | DIV id="transit", 97px tall, "Transit. Light rail runs directly..." | 96 | 1279 to 1279 |
| us-bank-stadium | Parking on the U.S. Bank Stadium guide | /venues/us-bank-stadium#parking | SPAN id="parking", zero height, directly above the "Parking lots" card heading | 96 | 1279 to 1279 |
| nrg-stadium | Transit on the NRG Stadium guide | /venues/nrg-stadium#transit | DIV id="transit", 116px | 96 | 1870 to 1870 |
| nrg-stadium | Parking on the NRG Stadium guide | /venues/nrg-stadium#parking | SPAN id="parking" | 96 | 1870 to 1870 |
| angel-stadium | Transit on the Angel Stadium guide | /venues/angel-stadium#transit | DIV id="transit", 194px | 96 | 1637 to 1637 |
| angel-stadium | Parking on the Angel Stadium guide | /venues/angel-stadium#parking | SPAN id="parking" | 96 | 1637 to 1637 |
| caesars-superdome | Transit on the Caesars Superdome guide | /venues/caesars-superdome#transit | DIV id="transit", 58px | 96 | 788 to 788 |
| caesars-superdome | Parking on the Caesars Superdome guide | /venues/caesars-superdome#parking | SPAN id="parking" | 96 | 788 to 788 |
| us-bank-stadium at 1280 | both | same URLs | same elements | 96 | 1321 to 1321 |

Each id exists once on its venue page. Every target sits 39px below the sticky header, fully visible (`walk-usb-390-transit.png`, `walk-usb-390-parking.png`).

Rail tile: tapped "Anaheim / Angel Stadium · 8 shows" on the us-bank stop at 390. Destination `/events/monster-jam/angel-stadium`, H1 "Monster Jam Anaheim at Angel Stadium", opened at the top. Back restored scroll 1781 to 1781.

## Three things that work

1. The hero photo. One image, never cropped at eight widths from 320 to 1920, credited on every page that shows it, and the generated card is still the share image.
2. The countdown. Right on all four stops, computed in the venue's zone whatever the browser's zone, and a stale number is replaced in place with no movement.
3. The guide links. All eight land on the right row 39px clear of the sticky header, and back returns to the exact scroll position.

Recorded as working, so the record shows the check ran: no show in the past is listed or offered tickets on any page.

## Defects

| # | Severity | Page and viewport | What was measured | Screenshot |
|---|----------|-------------------|-------------------|------------|
| 1 | medium | All four stop pages, More Monster Jam stops, 390 and narrower | The city name does not wrap or shrink and the tile does not clip. At 390 "SACRAMENTO" ends at x 376, the tile ends at x 374 and its text area at x 362: 13.6px past the padding, 2px outside the tile, so the last letter runs through the rounded edge. At 360: 28.6px past the padding (Milwaukee 3.8px), page scrollWidth 361 against clientWidth 360. At 320: Sacramento 48.6px, Milwaukee 23.8px, Nashville 15.5px, page scrollWidth 341 against clientWidth 320, a 21px sideways scroll. No page overflow at 390, 768 or 1280. 320 and 360 were measured on the us-bank stop; the tile set differs slightly per stop (angel shows Long Island in place of Anaheim). | `tiles-390.png` |
| 2 | medium | All four stop pages, 390x844 and 1280x800 | The H1 is "Monster Jam {City} at {Venue}": 4 lines and 167px at 390 where the mockup's "Monster Jam Minneapolis" is 2 lines, and the venue name is printed again on the line directly under it. The first Tickets button therefore starts at y 741 to 783; on angel-stadium its bottom edge is y 831, 13px above the fold. Any browser toolbar on a 390x844 phone puts it below the fold (not measured on a device). At 360 wide it starts at y 800 and at 320 at y 845. At 1280x800 it starts at y 858 to 878: a desktop visitor sees the dates but no showtime and no Tickets button without scrolling. | `usb-390-fold.png`, `angel-390-fold.png`, `usb-1280-fold.png` |
| 3 | medium | Stop pages and hub, 390 | Tap targets under 44x44 inside the article. "source" links: 33.3 x 12 (us-bank 1, nrg 3, superdome 1); on nrg two of them sit 20px apart (y 1839 and y 1859) at the foot of the hour-by-hour card. Breadcrumb links in the dark band: "Events" 37.1 x 18 and "Monster Jam" 69.8 x 18 on every stop, "Events" 37.1 x 18 on the hub. The mockup draws the breadcrumb at the same size. | `nrg-390-strip-a.png` |
| 4 | low | angel-stadium 390, hub 390 and 768, index 768 | CLS 0.0167 (angel 390), 0.0164 (hub 390), 0.0131 (hub 768), 0.0267 (index 768), each a single shift at about 50ms whose sources are the hero paragraph, the credit line and the section below: the headline re-wraps when the web font replaces the fallback. All under 0.1. The other loads are 0.0004 or less. | none |
| 5 | low | caesars-superdome, all viewports | The Transit row is a label and one link ("Transit on the Caesars Superdome guide") with no fact in it, next to bag and parking rows that each say something. As specified for a hub with no structured lines; it reads as an empty row. | `dome-390-strip-a.png` |
| 6 | low | Stop pages and hub, 768 | The photo is 600 wide in a 640 band, leaving a 20px dark strip on each side. It reads as a near miss rather than a frame. At 1280 the strips are 84px and read as intended. | `usb-768-fold.png` |
| 7 | low | /events, all viewports | The index carries none of the restyle: no dark band, no photo (by spec), and zero elements in the accent yellow. A fan who taps "Events" in the hub's breadcrumb goes from the dark hero to a plain cream page. | `index-390-strip-a.png` |
| 8 | low | /events/monster-jam, 390 | The hero and intro take the first 690px. The first month heading is at y 747 and the first stop row begins at about y 790, so the first screen shows one stop row, partly. | `hub-390-fold.png` |
| 9 | low, pre-existing, outside this diff | All six pages, all viewports | Site header wordmark "NIGHT": #da2d20 on #f7f3ea, 4.33:1 at 18px, the only axe-core serious finding. The header is unchanged by this branch. | any fold shot |
| 10 | medium, process | Worktree | Uncommitted edits to five files made at 15:29:42 CST, after the reviewed build. See "Coverage gap". Not reviewed. | none |

Not a defect, noted: on the transit landing the row sits mid-card with the tail of the row above still showing and nothing marks the target row.

## Measurements

Per page, branch build only (no production render exists for these pages).

| Measure | us-bank | nrg | angel | superdome | hub | index |
|---------|---------|-----|-------|-----------|-----|-------|
| Status | 200 | 200 | 200 | 200 | 200 | 200 |
| Document height 390 / 768 / 1280 | 4213 / 3237 / 3209 | 5175 / 4018 / 3981 | 4463 / 3478 / 3456 | 3768 / 2745 / 2732 | 4833 / 4138 / 4121 | 3422 / 2508 / 2425 |
| scrollWidth vs clientWidth, 390 / 768 / 1280 | equal | equal | equal | equal | equal | equal |
| CLS with scroll, 390 | 0.0004 | 0.0004 | 0.0167 | 0.0001 | 0.0164 | 0 |
| CLS with scroll, 768 | 0.0004 | 0.0004 | 0.0003 | 0.0003 | 0.0131 | 0.0267 |
| CLS with scroll, 1280 | 0.0001 | 0.0001 | 0.0001 | 0.0001 | 0.0045 | 0.0001 |
| `<img>` count | 1 | 1 | 1 | 1 | 1 | 0 |
| Tickets buttons | 2 | 3 | 8 | 1 | 0 | 0 |
| First Tickets top, 390 / 768 / 1280 | 751 / 849 / 878 | 741 / 839 / 858 | 783 / 839 / 858 | 751 / 849 / 878 | n/a | n/a |
| Targets under 44x44 in the article, 390 | 3 | 5 | 2 | 3 | 1 | 0 |
| Targets under 44x44 in header and footer, 390 (unchanged chrome) | 23 | 23 | 23 | 23 | 23 | 23 |
| axe serious or critical | 1 (header) | 1 (header) | 1 (header) | 1 (header) | 1 (header) | 1 (header) |
| Contrast failures in the article | 0 | 0 | 0 | 0 | 0 | 0 |
| `<a>` to /promos/ in served HTML | 8 | 8 | 8 | 8 | 8 | 8 |
| `data-ad-region` in served HTML | 2 | 2 | 2 | 2 | 0 | 0 |
| Served HTML bytes | 98,793 | 115,717 | 127,793 | 85,849 | 96,138 | 72,771 |

The distance to the first ad anchor and the visible count of /promos/ links were not measured in this run; ad hosts were blocked and the brief did not ask for them.

Text contrast inside the article (same pairs on every page that uses them):

| Text | Background | Ratio | Smallest size | Where |
|------|------------|-------|---------------|-------|
| #f5c518 yellow | #211d18 band, timeline card, dark tiles | 10.28 | 10px | countdown, weekday on date tiles, tile dates, timeline labels, "source" |
| #d8d1c4 grey | #211d18 | 11.04 | 11px | breadcrumb, credit line, tile venue lines, timeline notes |
| #e9e3d8 | #211d18 | 13.12 | 14px | dates line, timeline text |
| #ffffff | #211d18 | 16.75 | 10px | H1, tile city names, month on date tiles |
| #211d18 | #f5c518 | 10.28 | 11px | Live event badge |
| #ffffff | #da2d20 | 4.80 | 16px | Tickets |
| #211d18 | #fbf3cf | 15.02 | 13px | Pit Party strip |
| #786e60 | #f7f3ea | 4.52 | 11px | affiliate disclosure, visit date labels, not-affiliated line. Passes by 0.02. |
| #786e60 | #ffffff | 5.00 | 11px | day-part line, stop meta |
| #c62a1e | #ffffff / #f7f3ea | 5.60 / 5.06 | 11px | links |
| #50483f | #ffffff | 8.98 | 14px | body text in cards |

## Not tested

- Ticket and Reserve parking destinations (hrefs read, never followed, by instruction).
- The uncommitted working-tree edits (see "Coverage gap").
- A played or in-progress show; the client clock was moved, the server's was not.
- A real phone. Sizes are Chromium viewports at 1x (2x for the 390 tile shot).

## Recommendation

Fix the stop-tile city name so it cannot leave its tile (defect 1), then rebuild from a committed tree that includes the 15:29 edits and re-run items 2 and 4 on that build before merge, since the countdown and the hour-by-hour heading reviewed here are not the ones in the working tree.


## Dispositions (2026-11-18)

| # | Defect | Disposition |
|---|---|---|
| 1 | A long city name leaves its More stops tile; overflow at 360 and 320 | FIXED: the tile clips, the name is 19px and wraps anywhere. Re-measured at 320, 360 and 390 on the rebuilt page. |
| 2 | The H1 runs four lines and pushes the first Tickets button to the fold | PARTLY FIXED: the H1 is 36px on a phone (48px on desktop). The wording "Monster Jam {City} at {Venue}" was held (titles and the H1 were out of scope): DEFERRED for a ruling, known-issues 112 item 1. |
| 3 | "source" and breadcrumb links under 44x44 | DEFERRED, known-issues 112 item 2 (the same pattern as promo pages, entry 110). |
| 4 | CLS 0.013 to 0.027 at font swap | DEFERRED, known-issues 112 item 3 (under the 0.1 line). |
| 5 | Caesars Superdome's Transit row is a label and a link | WAIVED: as ruled, a hub with no structured lines shows the link alone. |
| 6 | 20px dark strips beside the photo at 768 | FIXED: the photo box stops at 640px, the width of the band at 768. |
| 7 | The index carries none of the restyle | WAIVED: the photo heads the show hub and the stop pages by ruling; the index is a plain list of shows. |
| 8 | Hub: the first stop row starts near y 790 at 390 | DEFERRED, known-issues 112 item 4. |
| 9 | Header wordmark contrast 4.33:1 | WAIVED (the brand red on cream, ruled 2026-11-08; the header is unchanged). |
| 10 | Edits made after the reviewed build | They are the adversarial review's three low fixes (the countdown picks the first show by the clock; the hour-by-hour heading names a weekday only when that is unambiguous; duplicate or malformed stored times). Covered by unit tests and re-checked on the rebuilt pages in served HTML and in a browser at 390, 768 and 1280: countdown text unchanged across hydration, no overflow, the photo uncropped. |
