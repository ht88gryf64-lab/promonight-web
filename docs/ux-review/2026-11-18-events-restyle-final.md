# UX review, final build: feature/events-restyle, 2026-11-18

Run on 2026-11-18, about 16:05 to 16:45 CST (America/New_York date 2026-11-18).

**Open HIGH defects: none. Open MEDIUM defects: one (defect 1, the first Tickets button is below the fold on every stop page at 1280x800). One check could not be completed and is recorded as unverified, not as a defect (back-navigation scroll position, see "Not verified").** Everything the earlier report marks FIXED was re-measured on this build and holds.

- Branch `feature/events-restyle`, HEAD `d3c6655` ("Events stop page: the H1 scales with the screen below 470px"). `git status` in the worktree showed only the untracked `node_modules` symlink when the run started.
- Environment reviewed: the production build already served at `http://localhost:3101` with the events flag on. It carries no `promonight-deploy` meta. No server was started, stopped or rebuilt.
- Production was not rendered in this run. These page types do not exist there (flag off, 404 by design per the brief), so there is no baseline section; the 404 itself was not re-fetched.
- Pages: the 19 stop pages listed in `http://localhost:3101/sitemap.xml`, the hub `/events/monster-jam`, the index `/events`. Every one was loaded at 320x568, 360x740, 390x844, 768x1024 and 1280x800 (105 loads). Eight focus pages got screenshots and the scroll pass: us-bank-stadium, nrg-stadium, angel-stadium, caesars-superdome, golden-1-center, paycom-center, hub, index.
- Browser: Playwright 1.65 Chromium as installed, desktop Chrome User-Agent. Nothing was installed into or deleted from the browser cache. axe-core was installed in the scratchpad, not in the repo.
- Blocked: every request to a host other than localhost was aborted. Hosts seen and aborted on event pages: www.googletagmanager.com, ads.adthrive.com, us.i.posthog.com, us-assets.i.posthog.com (and img.youtube.com on the venue pages reached by the guide links). No request to a ticket, parking, hotel, merchandise or resale partner was attempted; no Tickets or Reserve parking button was tapped; hrefs were read only. monsterjam.com, feldentertainment.com and pixabay.com were not fetched.
- Screenshots (not in the repo): `/private/tmp/claude-501/-Users-mattkovalik-promonight-web/9a9089de-77d7-4b8c-add2-4b36f8d24d44/scratchpad/uxr-restyle2/`. Names: `<page>-<width>-fold.png`, `<page>-<width>-branch.png` (full page at 390, 768, 1280), `<page>-<width>-hero.png`, `<page>-<width>-tiles.png`, `clock-<page>-<moment>.png`, `walk-<page>-<width>-<anchor>.png`, and contact sheets `sheet-*.png`. Page keys: usb, nrg, angel, dome, g1c, paycom, hub, index. Raw measurements: `sweep.json`, `clock.json`, `walk.json` in the same folder.
- The mockup file `docs/events-monster-jam-mockup-v2.html` was not re-opened in this run; fidelity statements below rest on the earlier review's comparison plus the screenshots of this build.

## Show date check

Today is 2026-11-18 in every venue zone involved (offsets -05:00 to -08:00 at the time of the run).

All 19 stop pages: every Event `startDate` in the JSON-LD and every `<time datetime>` on the page is in the future. Earliest is angel-stadium 2026-12-19T16:30-08:00, latest att-stadium 2027-03-06T19:00-06:00. On each page the count of showtime rows, of Tickets links and of JSON-LD Events is the same (60 shows in total), each Event has one offer, and no row in the past exists. Verdict: no played show, no past show offered tickets. The hub and the index carry no Event with a startDate.

Because the nearest show is 31 days out, the started state was exercised with the browser clock only (section 3c). With the clock one hour after a show's start, that row's Tickets link is replaced after hydration by a grey "Started" label that is not a link. The server render for a passed show could not be tested.

## 1. H1

Rule: exactly "Monster Jam {City}", the venue on the line under it. Result: passes on all 19 stop pages. One `<h1>` per page, the served HTML and the hydrated DOM carry the same text, and the next line is "{Venue}, {City}, {State}" in bold followed by the dates.

Computed font size is the same on every stop page: 36.8px at 320, 41.4px at 360, 44.85px at 390, 54px at 768, 54px at 1280.

Word broken across lines at 320, 360 or 390: none on any of the 19 stop pages (each word of the H1 was measured as its own range; no word occupies more than one line, no word extends past the H1 box, and the H1 scrollWidth equals its clientWidth). The same holds at 768 and 1280.

| Stop | H1 text | Line under it (first line) | Lines at 320, 360, 390, 768, 1280 | Title |
|---|---|---|---|---|
| angel-stadium | Monster Jam Anaheim | Angel Stadium, Anaheim, California | 2, 2, 2, 2, 1 | Monster Jam Anaheim 2027: Dates and Tickets, PromoNight |
| delta-center | Monster Jam Salt Lake City | Delta Center, Salt Lake City, Utah | 3, 3, 3, 2, 2 | Monster Jam Salt Lake City 2027: Dates and Tickets |
| bridgestone-arena | Monster Jam Nashville | Bridgestone Arena, Nashville, Tennessee | 2, 2, 2, 2, 2 | Monster Jam Nashville 2027: Dates, Tickets and Bag Policy |
| fiserv-forum | Monster Jam Milwaukee | Fiserv Forum, Milwaukee, Wisconsin | 2, 2, 2, 2, 2 | Monster Jam Milwaukee 2027: Dates and Tickets |
| snapdragon-stadium | Monster Jam San Diego | Snapdragon Stadium, San Diego, California | 2, 2, 2, 2, 2 | Monster Jam San Diego 2027: Dates, Tickets and Bag Policy |
| golden-1-center | Monster Jam Sacramento | Golden 1 Center, Sacramento, California | 2, 2, 2, 2, 2 | Monster Jam Sacramento 2027: Dates and Tickets |
| ubs-arena | Monster Jam Long Island | UBS Arena, Elmont, New York | 2, 2, 2, 2, 2 | Monster Jam Long Island 2027: Dates and Tickets |
| loandepot-park | Monster Jam Miami | loanDepot Park, Miami, Florida | 2, 2, 2, 1, 1 | Monster Jam Miami 2027: Dates and Tickets |
| lucas-oil-stadium | Monster Jam Indianapolis | Lucas Oil Stadium, Indianapolis, Indiana | 2, 2, 2, 2, 2 | Monster Jam Indianapolis 2027: Dates and Tickets |
| nrg-stadium | Monster Jam Houston | NRG Stadium, Houston, Texas | 2, 2, 2, 2, 1 | Monster Jam Houston 2027: Dates, Tickets and Bag Policy |
| ball-arena | Monster Jam Denver | Ball Arena, Denver, Colorado | 2, 2, 2, 2, 1 | Monster Jam Denver 2027: Dates and Tickets |
| ppg-paints-arena | Monster Jam Pittsburgh | PPG Paints Arena, Pittsburgh, Pennsylvania | 2, 2, 2, 2, 2 | Monster Jam Pittsburgh 2027: Dates and Tickets |
| raymond-james-stadium | Monster Jam Tampa | Raymond James Stadium, Tampa, Florida | 2, 2, 2, 2, 1 | Monster Jam Tampa 2027: Dates, Tickets and Bag Policy |
| rocket-arena | Monster Jam Cleveland | Rocket Arena, Cleveland, Ohio | 2, 2, 2, 2, 2 | Monster Jam Cleveland 2027: Dates and Tickets |
| paycom-center | Monster Jam Oklahoma City | Paycom Center, Oklahoma City, Oklahoma | 3, 3, 3, 2, 2 | Monster Jam Oklahoma City 2027: Dates and Tickets |
| us-bank-stadium | Monster Jam Minneapolis | U.S. Bank Stadium, Minneapolis, Minnesota | 2, 2, 2, 2, 2 | Monster Jam Minneapolis 2027: Dates and Tickets |
| caesars-superdome | Monster Jam New Orleans | Caesars Superdome, New Orleans, Louisiana | 2, 2, 2, 2, 2 | Monster Jam New Orleans 2027: Dates, Tickets and Bag Policy |
| ford-field | Monster Jam Detroit | Ford Field, Detroit, Michigan | 2, 2, 2, 2, 1 | Monster Jam Detroit 2027: Dates and Tickets |
| att-stadium | Monster Jam Dallas | AT&T Stadium, Arlington, Texas | 2, 2, 2, 2, 1 | Monster Jam Dallas 2027: Dates and Tickets |

Every title ends with the site suffix (a vertical bar and "PromoNight"; shown once above with a comma because of the table). All 19 match "Monster Jam {City} {Year}: Dates ..." with the same city as the H1. The titles were checked against that pattern, not byte for byte against an earlier build.

H1 height at 390: 85px for a two-line city, 128px for Salt Lake City and Oklahoma City (three lines). It was 167px on the build the earlier report measured.

## 2. First Tickets button

Button box is 93.5 x 48 everywhere. Positions are document y at scroll 0.

| Page | Viewport | First showtime y | Tickets top to bottom | Fully above the fold | Room left |
|---|---|---|---|---|---|
| us-bank-stadium | 390x844 | 667 | 669 to 717 | yes | 127px |
| angel-stadium | 390x844 | 699 | 701 to 750 | yes | 94px |
| us-bank-stadium | 1280x800 | 851 | 853 to 901 | **no**, starts 53px below the fold | none |
| angel-stadium | 1280x800 | 832 | 834 to 882 | **no**, starts 34px below the fold | none |

Other measurements of the same thing: at 390x844 nrg 701 to 749, superdome 669 to 717, golden-1 669 to 717, paycom (three-line H1) 712 to 760, all above the fold. At 768x1024 us-bank 853 to 901 and angel 885 to 933, above the fold. At 360x740 us-bank 670 to 718 (above), paycom 687 to 735 (above), angel 702 to 750 (10px cut off by the 740 fold). At 320x568 every stop page has it between 664 and 757, below the fold. At 1280x800 the other four focus stops are also below the fold (834 to 882 on a one-line H1, 853 to 901 on a two-line H1): the first screen ends inside the hazard stripe and shows no showtime, no "Pick your show" heading and no button (`usb-1280-fold.png`, `sheet-wide.png`).

Caveat, arithmetic not measurement: 844 is the full device height. With both Safari toolbars showing, a 390x844 iPhone has roughly 664px of page visible on first load, and the button starts at y 669 to 712. This was not measured on a device; the owner has approved the page on a phone.

## 3. Fixes no reviewer had re-read

### (a) More stops tiles: passes, with one low finding

Every tile on all 19 stop pages was measured at 320, 360 and 390 (also 768 and 1280): 6 tiles per page, 114 tiles per width. No text extends past its tile's padding box (the largest value is 0.7px inside at 320), no tile has clipped content (scrollWidth equals clientWidth and scrollHeight equals clientHeight on every tile, so `overflow: hidden` hides nothing), and no page overflows sideways: `documentElement.scrollWidth` equals `clientWidth` on all 21 pages at all five widths, before and after scrolling to the bottom.

| City | 320 (tile 140px) | 360 (tile 160px) | 390 (tile 175px) |
|---|---|---|---|
| Salt Lake City | 2 lines, breaks at the space | 2 lines, breaks at the space | 2 lines, breaks at the space |
| Sacramento | 2 lines, broken mid-word: "SACRAMEN" then "TO" | 2 lines, broken mid-word: "SACRAMENT" then "O" | 1 line, 8.9px inside the padding |
| Milwaukee | 2 lines, broken mid-word: "MILWAUKE" then "E" | 1 line | 1 line |
| Long Island | 2 lines, breaks at the space | 1 line | 1 line |
| Anaheim, Nashville, San Diego | 1 line | 1 line | 1 line |

The mid-word breaks are defect 3 (`sheet-tiles.png`, `usb-320-tiles.png`, `usb-360-tiles.png`).

"Oklahoma City" and "Indianapolis" are not shown in a More stops tile on any of the 19 pages: each page shows six tiles drawn from Anaheim, Salt Lake City, Nashville, Milwaukee, San Diego, Sacramento and Long Island. Those two names could therefore not be checked inside a tile. They appear as rows on the hub, which has no overflow at any of the five widths.

### (b) Photo box: passes

| Viewport | Photo box | Dark band | Strip left, right |
|---|---|---|---|
| 320 | 320 x 213 | 320 | 0, 0 |
| 360 | 360 x 240 | 360 | 0, 0 |
| 390 | 390 x 259.6 | 390 | 0, 0 |
| 768 | 640 x 426 at x 64 | 640 at x 64 | 0, 0 |
| 1280 | 640 x 426 at x 320 | 768 at x 256 | 64, 64 |

Same on all seven pages that carry the photo. At 768 the photo is exactly as wide as the band, so there are no dark strips beside it (`usb-768-fold.png`). At 1280 the 64px strips read as a frame.

### (c) Countdown: passes

Real clock, all 19 stops: the number in the served HTML, the number after hydration and the expected number (first show date minus today, both in the venue's zone) agree on every page, at every width. A mutation log from document start recorded one value per load and no change. Values: Anaheim 31, Salt Lake City 51, Nashville 52, Milwaukee 52, San Diego 52, Sacramento 65, Long Island 72, Miami 73, Indianapolis 80, Houston 80, Denver 86, Pittsburgh 86, Tampa 87, Cleveland 93, Oklahoma City 94, Minneapolis 94, New Orleans 101, Detroit 101, Dallas 108 ("N days away"). With the browser zone set to Asia/Tokyo and to Pacific/Honolulu, us-bank-stadium still reads 94.

Browser clock moved (fixed time installed before load, 390x844). The served HTML always carries the build-time number; the text is replaced once, 46 to 50ms after it first appears, and the page CLS on each of these loads was 0.0005 or less.

| Page | Browser clock | Countdown after hydration | Showtime buttons after hydration |
|---|---|---|---|
| us-bank-stadium | 2027-02-19 23:30 CT | Tomorrow | Tickets, Tickets |
| us-bank-stadium | 2027-02-20 10:00 CT | Today | Tickets, Tickets |
| us-bank-stadium | **2027-02-20 18:00 CT, one hour after the first show's start** | **Tomorrow** | **first: "Started" (grey label, not a link, 76 x 48); second: Tickets** |
| us-bank-stadium | same moment, browser zone Asia/Tokyo | Tomorrow | Started, Tickets |
| us-bank-stadium | 2027-02-21 10:00 CT | Today | Started, Tickets |
| us-bank-stadium | 2027-02-21 16:00 CT, one hour after the last show's start | empty (the element has no text and no size; the Live event badge stands alone) | Started, Started; 0 ticket links on the page |
| us-bank-stadium | 2027-02-23 12:00 CT | empty | Started, Started |
| nrg-stadium | 2027-02-07 16:00 CT, after the second of three shows | 6 days away | Started, Started, Tickets |
| caesars-superdome | 2027-02-27 20:00 CT, after its only show | empty | Started |

The expected result holds: the count runs to the next show and a started show loses its Tickets link. The "Started" label's accessible text is "Started: this show has started"; its colours are #786e60 on #f7f3ea, 4.52:1. No console error or hydration warning on any of these loads. Screenshots: `clock-usb-2027-02-20T18.png`, `sheet-clock.png`.

### (d) Hour-by-hour heading: passes

- us-bank-stadium: heading "Your Saturday, hour by hour", one block with no date label (12:30 PM Pit Party opens, 3:30 PM Pit Party closes, 5:00 PM Show starts). Saturday Feb 20 is the only show with published times and the only Saturday show.
- nrg-stadium: heading "Hour by hour", two blocks, each with its own label: "Sat, Feb 6, 5:00 PM show" and "Sun, Feb 7, 3:00 PM show" (shown in capitals). The Feb 13 show has no block.
- angel-stadium, caesars-superdome, golden-1-center, paycom-center: no hour-by-hour card.

## 4. Hero, the NO CROP ruling: passes

Looked at `sheet-hero.png`, `sheet-folds-390.png`, `sheet-folds-320.png`, `sheet-wide.png`: the whole truck with its grille, both crushed cars and the sky (with the birds) above the truck are in frame at 320, 360, 390, 768 and 1280, on the stop pages and on the hub.

Measured: the `<img>` box ratio is 1.5000 to 1.5023 at every width against 1.5023 for the variant served (640 x 426); `object-fit` is the default (fill), no fixed height, and no ancestor of the image has `overflow` other than visible or a clip-path. Nothing is cut on any side. A fade to the band colour covers the bottom 10 percent of the photo (21px at 320, 26px at 390, 43px at 640); it darkens the dirt under the cars and does not hide them.

Credit line: "Photo: Marion Wellmann / Pixabay. Not a truck from this show." is present and visible under the hero text on all six focus stop pages and the hub at all five widths (at 320 it wraps to two lines).

Other images: none. Each focus stop page and the hub has exactly one `<img>` (the hero, `/events/monster-jam-hero.jpg` through the image optimizer); the index has zero. No `<picture>`, `<video>`, `<canvas>`, `<iframe>`, SVG `<image>` or CSS `background-image: url()` (pseudo-elements included) on any of the eight focus pages at any width, with ad and analytics hosts blocked.

## 5. Usual checks

- Layout shift with a scroll to the bottom: table under Measurements. Worst 0.0267 (index at 768). Stop pages at 390 and 768 are 0.0005 or less.
- Tap targets under 44x44 inside the article at 390: breadcrumb links ("Events" 37.1 x 18, "Monster Jam" 69.8 x 18) on every stop page and "Events" on the hub; "source" links 33.3 x 12 (us-bank 1, nrg 3, superdome 1; on nrg two sit 19px apart at y 1799 and 1818). Unchanged, deferred under known-issues 112. Tickets 93.5 x 48; both guide links and Reserve parking 44 tall; hub rows 44 tall; index has none under 44.
- Contrast: no failing text inside the article on any focus page at any width. Dark band and tiles: yellow #f5c518 on #211d18 10.28:1 (smallest 10px), #d8d1c4 on #211d18 11.04:1, #e9e3d8 on #211d18 13.12:1, white on #211d18 16.75:1, #211d18 on the yellow badge 10.28:1. Elsewhere: white on the red Tickets button 4.80:1; #786e60 on #f7f3ea 4.52:1 (passes by 0.02; also the "Started" label); #786e60 on white 5.00:1; link red #c62a1e 5.06:1 on cream and 5.60:1 on white.
- axe-core, serious and critical, at 390 on the eight focus pages: one finding on each, the header wordmark (#da2d20 on #f7f3ea, 4.33:1), waived earlier. Nothing inside the article.
- Heading order: one H1, then H2 per section, H3 for visit dates and questions, on all eight focus pages. No skipped level. us-bank: Pick your show, Your Saturday hour by hour, Before you go, Also at U.S. Bank Stadium, More Monster Jam stops, Questions.
- Links: 73 distinct internal paths across the eight focus pages, all answer 200. No empty href and no bare "#". External hosts, read only: ticketnetwork.lusg.net and tracking.spothero.com (rel "noopener noreferrer sponsored", new tab) and the venue's own site (rel "noopener nofollow").
- Console: no errors on 104 of the 105 sweep loads; see defect 6 for the one.

In-page guide links. Sticky header bottom edge is at y 57. Each was tapped (internal links only).

| Stop, viewport | Link text | Lands on | Target | Target top in viewport | Visible below the header |
|---|---|---|---|---|---|
| us-bank-stadium, 390 | Transit on the U.S. Bank Stadium guide | /venues/us-bank-stadium#transit | DIV id="transit", 97px, "Transit. Light rail runs directly to the U.S. Bank Stadium Station..." | 96 | yes, 39px clear |
| us-bank-stadium, 390 | Parking on the U.S. Bank Stadium guide | /venues/us-bank-stadium#parking | SPAN id="parking", directly above "Parking lots" | 96 | yes |
| nrg-stadium, 390 | Transit on the NRG Stadium guide | /venues/nrg-stadium#transit | DIV id="transit", 116px | 96 | yes |
| nrg-stadium, 390 | Parking on the NRG Stadium guide | /venues/nrg-stadium#parking | SPAN id="parking", above "Parking lots" | 96 | yes |
| angel-stadium, 390 | Transit on the Angel Stadium guide | /venues/angel-stadium#transit | DIV id="transit", 194px | 96 | yes |
| angel-stadium, 390 | Parking on the Angel Stadium guide | /venues/angel-stadium#parking | SPAN id="parking" | 96 | yes |
| caesars-superdome, 390 | Transit on the Caesars Superdome guide | /venues/caesars-superdome#transit | DIV id="transit", 58px | 96 | yes |
| caesars-superdome, 390 | Parking on the Caesars Superdome guide | /venues/caesars-superdome#parking | SPAN id="parking" | 96 | yes |
| us-bank-stadium, 768 and 1280 | both | same URLs | same elements | 96 | yes |

Each id exists exactly once on its venue page. golden-1-center and paycom-center carry the same two links with the same href pattern (read, not tapped).

Rail tile: tapped "Anaheim" in More stops on us-bank-stadium at 390. Destination `/events/monster-jam/angel-stadium`, H1 "Monster Jam Anaheim" (matches the label), opened at the top.

## Dispositions in the earlier report, re-checked on this build

| # | Earlier disposition | This build |
|---|---|---|
| 1 | FIXED: tile clips, name 19px, wraps anywhere | Confirmed. Name is 19px, nothing leaves a tile at 320, 360 or 390, no page overflow. The "wraps anywhere" rule produces the mid-word breaks in defect 3. |
| 2 | PARTLY FIXED, wording deferred | The wording is now "Monster Jam {City}" on all 19 pages. At 390 the button moved from y 751 to 669 (us-bank) and from 783 to 701 (angel). The 1280x800 half is still open: 878 then, 853 now (defect 1). |
| 3 | DEFERRED, known-issues 112 item 2 | Unchanged measurements. |
| 4 | DEFERRED, known-issues 112 item 3 | Unchanged: hub 0.0164 at 390 and 0.0123 at 768, index 0.0267 at 768. |
| 5 | WAIVED | Unchanged. golden-1-center's Transit row is the same shape (label and link only). |
| 6 | FIXED: photo box stops at 640px | Confirmed: 640 wide at 768 and 1280, no strips at 768. |
| 7 | WAIVED | Unchanged: the index has no band, no photo, no yellow. |
| 8 | DEFERRED, known-issues 112 item 4 | Unchanged: first hub stop row starts at y 795 at 390 and is 44px tall. |
| 9 | WAIVED | Unchanged, 4.33:1. |
| 10 | Edits made after the reviewed build | They are in commit 331da3e and in this build. Countdown, started state and the hour-by-hour heading were exercised here (sections 3c and 3d) and pass. |

## Three things that work

1. The H1. "Monster Jam {City}" on all 19 stops, two lines on a phone for 17 of them, never a broken word at 320, 360 or 390, and the first Tickets button is now 94 to 127px clear of an 844 fold.
2. The countdown and the started state. Right on all 19 stops in the venue's zone, no change on hydration with a true clock, and with the clock past a show it moves to the next show and that show's button becomes a plain "Started" label with no ticket link.
3. The hero photo. One image, uncropped at five widths, exactly band-wide at 768, credited on every page that shows it.

Recorded as working, so the record shows the check ran: no show in the past is listed or offered tickets on any of the 19 stop pages.

## Defects

| # | Severity | Page and viewport | What was measured | Screenshot |
|---|---|---|---|---|
| 1 | medium | Every stop page, 1280x800 | The first Tickets button starts at y 853 (two-line H1, for example us-bank-stadium) or y 834 (one-line H1, for example angel-stadium) against a fold at 800; the first showtime is at y 851 or 832. The first screen is the header, breadcrumb, 640 x 426 photo, badge, H1, venue, dates, credit and stripe, and nothing else. This is the desktop half of earlier defect 2 (878 then). It is also below the fold at 1366x768 and cut by 1px at 1440x900, by arithmetic from the same layout. Rated medium because the page's one paid action is off the first screen on common laptop sizes; the owner's approval was given on a phone. | `usb-1280-fold.png`, `sheet-wide.png` |
| 2 | low | Stop pages, 360x740 and 320x568 | angel-stadium at 360x740: the button's bottom edge is y 750, 10px under the fold (the other five focus stops are above it). At 320x568 the button is at y 664 to 757 on every focus stop, wholly below the fold. | `sheet-folds-320.png` |
| 3 | low | Every stop page that shows the tile, More Monster Jam stops, 320 and 360 | City names break in the middle of a word: at 320 "MILWAUKE" then "E" and "SACRAMEN" then "TO"; at 360 "SACRAMENT" then "O". Nothing overflows; it reads as a typo. Clean at 390 and wider. | `sheet-tiles.png` |
| 4 | low, deferred (known-issues 112) | Stop pages and hub, 390 | Tap targets under 44x44: breadcrumb links 37.1 x 18 and 69.8 x 18; "source" links 33.3 x 12, two of them 19px apart on nrg-stadium. | `nrg-390-branch.png` |
| 5 | low, deferred (known-issues 112) | hub 390 and 768, index 768, us-bank and superdome 360, golden-1 320 | Single layout shift at font swap, 49 to 144ms: hub 0.0164 (390) and 0.0123 (768), index 0.0267 (768), us-bank-stadium and caesars-superdome 0.0084 (360), golden-1-center 0.0062 (320). All under 0.1. | none |
| 6 | low, not reproduced | caesars-superdome, 1280x800 | One load in the sweep threw "Minified React error #418" (hydration mismatch, arguments "HTML" and empty). The measurements on that load were normal (countdown 101, one Tickets link, CLS 0). Twelve further loads of the same page at 1280, eight at 390, eight of us-bank-stadium, six of the hub and twelve of two non-event pages threw nothing. Seen once in 151 event-page loads; the sweep ran five browser contexts at once. | none |
| 7 | low, simulated clock only | us-bank-stadium, 390 | With the browser clock on Sunday 2027-02-21 10:00 CT (Saturday's show marked Started, Sunday's still on sale) the card is still headed "Your Saturday, hour by hour" and still shows only Saturday's Pit Party times. After the last show the Live event badge stays, the countdown is blank, both rows say Started, and nothing on the first screen says the stop is over. What the server renders after the date could not be tested. | `clock-usb-2027-02-21T16.png` |
| 8 | low, waived earlier | caesars-superdome and golden-1-center, all viewports | The Transit row is a label and one link with no fact in it. | `dome-390-branch.png` |
| 9 | low, deferred (known-issues 112) | hub, 390 | The first stop row starts at y 795; the first screen shows the hero, the intro and the "December 2026" heading. | `hub-390-fold.png` |
| 10 | low, waived earlier, outside this diff | All pages | Header wordmark "NIGHT" 4.33:1, the only axe-core serious finding. | any fold shot |
| 11 | low, outside this diff, noted | angel-stadium title, hub H1 | The title reads "Monster Jam Anaheim 2027" and the hub H1 "Monster Jam 2027 dates and venue guides" while Anaheim's first two shows are on Dec 19 and 20, 2026. Titles were out of scope for this branch. | none |

## Not verified

- **Scroll position after browser back.** The standing procedure asks for it; this run did not get a clean answer. After each guide-link tap the script went back and read `scrollY` once, 1.2 seconds later. The readings differed from the pre-tap reading by 10 to 368px on 11 of 13 walks (us-bank 1049 to 1197 and 1144 to 1337; angel 1281 to 1555; nrg 1439 to 1429 and 1513 to 1570; caesars-superdome 674 to 306 and 788 to 447, the same on a second run; rail tile 1364 to 1323). That method is not trustworthy here: the site sets `scroll-behavior: smooth` on the root (`src/app/globals.css` line 103), the script scrolled the link into view programmatically and read the "before" value 300ms later, so that value was taken in mid-animation, and on a repeat run two of the "before" readings changed. The earlier review reported exact restoration on every walk. A stricter script (wheel scrolling, scrollY captured at the click itself, six samples up to 4 seconds after back) was written but the shell's safety check refused to run it three times, so it never ran. The caesars-superdome numbers are the ones that the mid-animation explanation does not obviously cover. Treat this as unverified, not as a regression; a person tapping "Transit on the Caesars Superdome guide" and then back on a phone settles it in ten seconds.
- A real phone and real browser toolbars (see the caveat in section 2).
- Ticket and Reserve parking destinations (hrefs read, never followed, by instruction).
- The server render of a started or finished show; only the browser clock was moved.
- Pixel fidelity against the mockup file, which was not re-opened in this run.
- "Oklahoma City" and "Indianapolis" inside a More stops tile, because no page shows them there.
- The 13 stop pages outside the six focus ones were measured (H1, title, overflow, tiles, countdown, show dates, button count) but not screenshotted or scroll-tested.

## Measurements

Branch build only; no production render exists for these pages.

| Measure | us-bank | nrg | angel | superdome | golden-1 | paycom | hub | index |
|---|---|---|---|---|---|---|---|---|
| Status | 200 | 200 | 200 | 200 | 200 | 200 | 200 | 200 |
| Document height at 390 | 4120 | 5124 | 4356 | 3674 | 3759 | 3710 | 4833 | 3422 |
| Document height at 768 | 3224 | 4047 | 3507 | 2732 | 2939 | 2867 | 4165 | 2508 |
| Document height at 1280 | 3185 | 3956 | 3432 | 2708 | 2894 | 2843 | 4148 | 2425 |
| scrollWidth minus clientWidth, all five widths | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 |
| CLS with scroll, 320 | 0.0001 | 0.0001 | 0.0001 | 0.0001 | 0.0062 | 0.0001 | 0.0001 | 0.0001 |
| CLS with scroll, 360 | 0.0084 | 0.0002 | 0.0002 | 0.0084 | 0.0006 | 0.0002 | 0 | 0.0001 |
| CLS with scroll, 390 | 0.0005 | 0.0005 | 0.0002 | 0.0001 | 0.0002 | 0.0002 | 0.0164 | 0 |
| CLS with scroll, 768 | 0.0004 | 0.0003 | 0.0003 | 0.0003 | 0.0003 | 0.0003 | 0.0123 | 0.0267 |
| CLS with scroll, 1280 | 0.0001 | 0.0001 | 0.0001 | 0 | 0.0001 | 0.0001 | 0 | 0.0001 |
| H1 lines at 390 | 2 | 2 | 2 | 2 | 2 | 3 | 4 | 3 |
| First Tickets top at 320 | 664 | 696 | 706 | 664 | 664 | 709 | n/a | n/a |
| First Tickets top at 360 | 670 | 680 | 702 | 670 | 643 | 687 | n/a | n/a |
| First Tickets top at 390 | 669 | 701 | 701 | 669 | 669 | 712 | n/a | n/a |
| First Tickets top at 768 | 853 | 885 | 885 | 853 | 853 | 853 | n/a | n/a |
| First Tickets top at 1280 | 853 | 834 | 834 | 853 | 853 | 853 | n/a | n/a |
| Tickets links | 2 | 3 | 8 | 1 | 4 | 3 | 0 | 0 |
| JSON-LD Events with startDate | 2 | 3 | 8 | 1 | 4 | 3 | 0 | 0 |
| `<img>` count | 1 | 1 | 1 | 1 | 1 | 1 | 1 | 0 |
| Targets under 44x44 in the article, 390 | 3 | 5 | 2 | 3 | 2 | 2 | 1 | 0 |
| Targets under 44x44 in header and footer, 390 (unchanged chrome) | 23 | 23 | 23 | 23 | 23 | 23 | 23 | 23 |
| Contrast failures in the article | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 |
| axe serious or critical, 390 | 1 (header) | 1 (header) | 1 (header) | 1 (header) | 1 (header) | 1 (header) | 1 (header) | 1 (header) |
| `<a>` to /promos/ in the DOM, visibly rendered (site chrome) | 8, 6 | 8, 6 | 8, 6 | 8, 6 | 8, 6 | 8, 6 | 8, 6 | 8, 6 |
| Top of the first ad anchor at 390 (the article carries data-ad-region) | 57 | 57 | 57 | 57 | 57 | 57 | none | none |
| Served HTML bytes | 99,614 | 116,612 | 129,048 | 86,622 | 102,513 | 97,345 | not read | not read |

## Recommendation

Before merge, write a disposition for defect 1 (the first Tickets button below the fold at 1280x800: fix, defer or waive, since the phone approval does not cover it), and in the same sitting have a person do the back-button check on a phone that this run could not complete.

## Dispositions (2026-11-18)

| # | Defect | Disposition |
|---|---|---|
| 1 | Medium: at 1280x800 the first Tickets button was below the fold on every stop page | FIXED after this review: the photo box is 440px wide on a desktop (640px below 1024px), still its natural 3:2 with nothing cropped. Re-measured on the rebuilt pages at 1280x800: us-bank-stadium 720 to 768, angel-stadium 701 to 749, both fully above the fold. Phone and tablet layouts are unchanged (390x844: 669 to 717 and 701 to 749). |
| 2 | Low: the button is cut by 10px on angel-stadium at 360x740 and is below the fold at 320x568 | DEFERRED, known-issues 112 item 7. |
| 3 | Low: a city name breaks mid-word in a More stops tile at 320 and 360 | FIXED after this review: the tile's city scales with the screen (4.6vw, at most 19px) and wraps on words. Re-measured at 320, 360 and 390: no tile breaks a word, none overflows. |
| 4 | Low: small tap targets (breadcrumb, source links) | DEFERRED, known-issues 112 item 2. |
| 5 | Low: font-swap layout shift on the hub and index | DEFERRED, known-issues 112 item 3. |
| 6 | Low: one React 418 hydration error on caesars-superdome, not reproduced in 12 retries | DEFERRED, known-issues 112 item 8 (watch on the preview before the flag goes on). |
| 7 | Low, simulated clock: on the Sunday the card still reads "Your Saturday, hour by hour"; after the last show the Live event badge stays | DEFERRED, known-issues 112 item 9. |
| 8 | Low: label-only Transit row; hub first row at y 795; wordmark contrast; "2027" in Anaheim's title for December 2026 shows | WAIVED or deferred as before (ruling: a hub with no structured lines shows the link alone; known-issues 112 item 4; the brand red; the title rule takes the last upcoming show's year). |
| n/a | Not verified: scroll position after browser back (the reviewer's reading was confounded by smooth scrolling) | DEFERRED, known-issues 112 item 10: a person checks it on a phone on the preview before the flag goes on. |

The two fixes above were made after the reviewed build (d3c6655) and are CSS classes on two elements. They were checked in a real browser on the rebuilt pages at 320x568, 360x740, 390x844, 768x1024 and 1280x800 (photo ratio, first Tickets button position, tile overflow and mid-word breaks, page overflow).
