# UX review: events hub city pills (Monster Jam show hub)

Run: 2026-11-19 (America/New_York), baseline mode, one page.

- Page: `/events/monster-jam` (page type event-hub)
- Branch render: http://localhost:3100/events/monster-jam, a production build of `feature/events-hub-city-pills`. The local server carries no `promonight-deploy` meta. The worktree is at commit 3ff2060 with the change uncommitted in the working tree (`src/components/events/EventListViews.tsx`, `src/lib/events/event-pages.ts`, and its test), so this report describes the build that was running at 09:24 to 09:50 EST.
- Production render: https://www.getpromonight.com/events/monster-jam, `promonight-deploy` = `dpl_7r6wBcyShk6Ruafk5jZfWtozXpf6`, HTTP 200 (flag on).
- Viewports: 390x844 and 1280x800 on both; 1024x800 and 768x1024 also rendered on both for the pill block; phone widths 320 to 430 on the branch for the edge cue.
- Engine: Chromium (Playwright 1.65.0 from the shared checkout, headless), desktop Chrome User-Agent, touch and mobile emulation at 390. No WebKit build is installed and none was added, so iOS Safari behavior (momentum, rubber banding, scrollbar hiding) is NOT verified here.
- Blocked at the network layer for every render: every host other than the two origins, which covers ticketnetwork, lusg.net, spothero, expedia, ticketmaster, posthog, google-analytics, googletagmanager, doubleclick, raptive, adthrive, monsterjam.com and feldentertainment.com. Hosts the page tried to reach and that were aborted: www.googletagmanager.com, ads.adthrive.com, us-assets.i.posthog.com, us.i.posthog.com. No partner link was clicked. The hub's main content holds no outbound link at all (every `<a>` in `<main>` is same-origin).
- Screenshots and diff images were kept out of the repo by instruction. They are in the session scratchpad (temporary): `/private/tmp/claude-501/-Users-mattkovalik-promonight-web/9a9089de-77d7-4b8c-add2-4b36f8d24d44/scratchpad/ux/shots/`, named `<viewport>-<env>.png`, `<viewport>-<env>-fold.png`, `<viewport>-diff-above.png`, `<viewport>-diff-below.png`, plus `edge-428.png`, `focus-390-detroit.png`, `crop-1280-branch.png`.

## 1. Baseline differences (branch vs production)

### Served HTML of `<main>`

Not identical, and the difference is confined to one region.

| Region of `<main>` | Result |
|---|---|
| Everything before the "Find your city" section (breadcrumb JSON-LD, hero, H1, intro, photo credit, hazard stripe): 3,310 bytes | byte-identical |
| The "Find your city" `<section>` | differs (below) |
| Everything after it (four month sections, Questions, not-affiliated note): 18,915 bytes | byte-identical |

Inside the section, after normalising the `<ul>` and `<li>` attributes, the class strings and the ", State" suffix, the two are identical: same 20 `<li>`, same 20 hrefs in the same order, same `data-event-link`. The differing text:

- `<ul>`: production `m-0 flex list-none flex-wrap gap-2 p-0`; branch adds `data-city-pills`, an inline `grid-template-columns:repeat(10, max-content)`, and the scroller and grid classes.
- `<li>`: branch adds `class="shrink-0"`.
- `<a>`: branch class string changes (`px-3`, `whitespace-nowrap`, `lg:min-h-8 lg:px-2 lg:text-[12px]`).
- Labels: production "Anaheim, California | Cleveland, Ohio | Dallas, Texas | Denver, Colorado | Detroit, Michigan | Houston, Texas | Indianapolis, Indiana | Long Island, New York | Miami, Florida | Milwaukee, Wisconsin | Minneapolis, Minnesota | Nashville, Tennessee | New Orleans, Louisiana | Oklahoma City, Oklahoma | Pittsburgh, Pennsylvania | Portland, Oregon | Sacramento, California | Salt Lake City, Utah | San Diego, California | Tampa, Florida"; branch the same 20 with the state removed.

Sizes: stripped `<main>` 29,551 bytes on the branch vs 28,188 in production (+1,363, the longer class strings). Whole document 119,847 vs 121,131 bytes.

### Pixel comparison

The pages differ in height, so each pair was compared in two aligned bands: from the top of the document to the top of the pill list (this includes the "Find your city" heading), and from 12px above the first month heading to the end of the footer.

| Viewport | Full-page height, branch / production | Band above the pills | Band below the pills |
|---|---|---|---|
| 390 | 5,483 / 6,003 (520 shorter) | 0 of 303,810 px differ | 0 of 1,812,720 px differ |
| 768 | 4,648 / 4,960 (312 shorter) | 0 of 643,584 | 0 of 2,882,304 |
| 1024 | 4,516 / 4,698 (182 shorter) | 0 of 741,376 | 0 of 3,798,016 |
| 1280 | 4,516 / 4,698 (182 shorter) | 0 of 926,720 | 0 of 4,747,520 |

The only pixels that differ are the pill block itself and the vertical offset of everything under it. There are no ad slots on this page in either environment (0 elements with `data-ad-region` or `data-ad-item`).

### Step 2 measurements that moved

| Measurement | Branch | Production |
|---|---|---|
| Find your city section height, 390 | 74.9px | 594.9px |
| Pill list height, 390 | 44px (1 row of 20) | 564px (11 rows) |
| Find your city section height, 1280 and 1024 | 100.9px (2 rows, 10 and 10) | 282.9px (5 rows: 5, 4, 4, 4, 3) |
| Find your city section height, 768 | 74.9px (1 row) | 386.9px (7 rows) |
| First date text top, 390 | 898.9px (1.065 screens) | 1,418.9px (1.681 screens) |
| First date text top, 1280 | 870.1px (1.088 of 800) | 1,052.1px (1.315) |
| Interactive elements under 44x44, 1280 | 49 | 29 (the 20 pills are the whole increase) |
| Interactive elements under 44x44, 390 | 24 | 24 |
| Pill size, 390 | 64.7 to 120.5 wide, 44 tall, 14px, gap 6px | 115.4 to 196 wide, 44 tall, 14px, gap 8px |
| Pill size, 1280 | 51.2 to 99 wide, 32 tall, 12px | 115.4 to 196 wide, 44 tall, 14px |
| CLS, 768 (single load each) | 0.0012 | 0.0536 |

Nothing else moved: contrast failures, axe violations, `/promos/` link counts, heading list, month rows, Questions text and height, the not-affiliated note and the JSON-LD are the same in both environments at every viewport. The 768 CLS figure is one load per environment and the cause of the production value was not isolated; at 390, 1024 and 1280 the two environments agree to within 0.0001.

### Month sections and Questions

Identical to production. Served HTML byte-identical, pixel-identical, and the same rendered text: December 2026 (1 stop), January 2027 (8), February 2027 (11), March 2027 (2); 22 rows, each with a stop link carrying `events_hub_list` and a venue guide link carrying `event_to_venue`. Questions block: the same two questions, 409px tall at 390 and 265px at 1280 in both.

## 2. Requirements, as measured

1. **First date within 1.1 screens at 390x844: PASS.** The text "Anaheim: Dec 19 to 20, 2026" starts at 898.9px from the top of the document; 898.9 / 844 = **1.065**. Production is 1.681. Headroom to the 1.1 line (928.4px) is 29.5px, which is one more line of intro copy (22px) but not two. At other phone widths on the branch the same text starts at 903 (320), 876 (360), 886 (375), 898 (393), 847 (412), 858 (428), 859 (430).
2. **At most two rows at 1280, nothing clipped: PASS.** 20 pills in exactly 2 rows of 10 (tops at 724.5 and 762.5). List `scrollWidth` 864 = `clientWidth` 864; `scrollHeight` 70 = `clientHeight` 70. The list spans x 208 to 1072, that is 48px wider than the 768px content column (256 to 1024) on each side, which is the stated 64px beyond the padded text column (272 to 1008). Same at 1024: 2 rows of 10, 864 = 864, list at x 80 to 944 inside a 1024 viewport.
3. **Every pill a tracked link, 20, alphabetical, no state: PASS.** 20 `<a>` inside `<li>`, all with `data-event-link="events_hub_list"`, hrefs `/events/monster-jam/{venue}` identical in value and order to production. Labels: Anaheim, Cleveland, Dallas, Denver, Detroit, Houston, Indianapolis, Long Island, Miami, Milwaukee, Minneapolis, Nashville, New Orleans, Oklahoma City, Pittsburgh, Portland, Sacramento, Salt Lake City, San Diego, Tampa. Alphabetical by `localeCompare`; no comma and no state in any label. Two taps confirmed the destination: Minneapolis to `/events/monster-jam/us-bank-stadium` (H1 "Monster Jam Minneapolis"), Nashville to `/events/monster-jam/bridgestone-arena` (H1 "Monster Jam Nashville").

## 3. Game date check

- Dates read from the page: the 22 stop rows run from "Anaheim: Dec 19 to 20, 2026" to "Dallas: Mar 6, 2027". The hub carries no Event JSON-LD (one BreadcrumbList only) and no `<time>` element, in either environment, so the row text is the only date source.
- Today: 2026-11-19. The hub spans several time zones and states none, so America/New_York was used; the earliest date is 30 days out, so the zone cannot change the result.
- Verdict: no date is before today. Not a played event. The hub shows no Tickets button, no parking and no hotel link; every link in `<main>` is internal.

## 4. Three things that work

1. The compaction does what it was for. On a phone the block went from 594.9px to 74.9px and the first date moved from 1.68 screens to 1.065. The page is 520px shorter at 390 and 182px shorter at 1280.
2. The phone row is a clean scroller. A 250px touch drag on the row moved the list 248px and left the page at `scrollX` 0. A vertical swipe that starts on the row scrolls the page (202px), so the row does not trap the thumb. At the end of the row the last pill sits 16px from the screen edge, and dragging past the end moves nothing. Document `clientWidth` equals `scrollWidth` at 320, 360, 375, 390, 393, 412, 414, 428 and 430 wide, and at 768, 1024 and 1280. The row runs edge to edge at 390 (x 0 to 390) with the first pill at x 16, in line with the heading.
3. Nothing outside the block changed, and the links survived intact: byte-identical HTML before and after the section, 0 differing pixels outside it at four viewports, the same 20 hrefs in the same order. Browser back from a stop page restores the page scroll exactly (350 to 350 from a pill, 1,685 to 1,685 from a month row, delta 0) in both environments. Heading order is intact: H1, then H2 "Find your city", four month H2s, H2 "Questions" with two H3s; no skipped level.

## 5. Defects

Severity is for a fan on this page. D1 to D6 are introduced by the branch. P1 to P4 exist in production today and are unchanged by it.

### D1. Medium. At 1024 and up the grid reads as a layout mistake, not a design (1024, 1280)

Screenshot: `shots/1280-branch-fold.png`, `shots/crop-1280-branch.png`, `shots/crop-1024-branch.png`.

- Uneven gaps in the top row. Each column is as wide as the longer of its two labels and each pill sits at the left of its cell, so the top row's gaps between pills are 22.1, 4, 40.1, 45, 24.2, 4, 4, 14.2 and 27.7px, while the bottom row's are 4, 8.2, 4, 4, 4, 4.4, 4.6, 4 and 4px. "Dallas" and "Denver" sit 40px apart, "Denver" and "Detroit" 45px, next to pairs that are 4px apart. It looks like pills are missing.
- Ragged right edge: the top row ends at x 1066.4, the bottom row at 1045.2.
- The block hangs outside everything else on the page. Pills run from x 213.6 to 1066.4. The "Find your city" heading directly above starts at x 272, so the first pill starts 58px to the LEFT of its own heading. The dark hero above spans 256 to 1024 and the white stop cards below span 272 to 1008, so the pills overhang the hero by 42px and the cards by 58px on each side. Nothing else on the page breaks the column, and there is no background band or rule to make the wider block look intended.

Answer to the question asked: wider than the cards looks like a mistake. The heading staying on the column while the pills leave it is what gives it away.

### D2. Medium. On some phone widths nothing shows that the row scrolls (428, 430, 360)

Screenshot: `shots/edge-428.png`, `shots/edge-430.png`, `shots/edge-360.png`; working case `shots/390-branch-fold.png`.

The only cue that more cities exist is a pill cut by the right edge. The scrollbar is hidden, there is no fade, no arrow, no count. Whether a pill is cut depends on where the screen edge lands:

| Width | Complete pills | What the edge shows |
|---|---|---|
| 320 | 3 | Denver, 45.6 of 72.6px |
| 360 | 4 | Detroit, a 7.0px sliver of 69.7 |
| 375 | 4 | Detroit, 22.0 of 69.7 |
| 390 | 4 | Detroit, 37.0 of 69.7 (reads "Detr", clear) |
| 393 | 4 | Detroit, 40.0 of 69.7 |
| 412, 414 | 4 | Detroit, 59 to 61 of 69.7 |
| 428 | 5 | NOTHING. Detroit ends at 422.6, Houston starts at 428.6 |
| 430 | 5 | Houston, 1.4px |

At 428 and 430 (the large iPhones) the row is five complete pills and a clean edge: 15 of 20 cities are hidden and the page gives no sign of them. At 360 the cue is a 7px curve. At 390 it is evident. These positions come from label widths, so they move with the font, the city list and the text-size setting; the cue is an accident of the current 20 names, not a property of the layout.

### D3. Low. Touch tablets at 1024 and wider get 32px targets 4px apart (1024, 1280)

The switch to small pills is by width, not by pointer type. An iPad in landscape (1024, 1180 or 1366 wide) gets pills 32px tall and 51.2 to 99px wide, 4px apart in a row and 6px between rows (38px pitch). That is under the 44px line this review holds phones to, though above the 24px WCAG 2.5.8 minimum. Production gives the same device 44px pills.

For a mouse or trackpad the answer to the question asked is yes: 32px tall is fine, the narrowest pill is 51.2px, the cursor is a pointer and the border darkens on hover (10 percent ink to solid ink). 12px semibold at about 16:1 contrast is legible; it is the smallest interactive text in the page body.

### D4. Low. Keyboard focus leaves 6 of 20 pills cut by the screen edge (390)

Screenshot: `shots/focus-390-detroit.png`.

Every pill is reachable by Tab (20 tab stops, in order, then the first stop row), and focus does scroll the row: `scrollLeft` steps 0, 274, 571, 863, 1,200, 1,506. But a pill that is already partly visible is focused where it sits. Focused and still cut: Detroit (37 of 70px visible), Long Island (37 of 101), Minneapolis (56 of 105), Oklahoma City (32 of 120), Sacramento (56 of 104), Tampa (34 of 69). The focus ring (1px auto, offset 1px, not clipped top or bottom) shows and the label reads "Detr". The next Tab brings the row along. Same result with and without mobile emulation. This matters at 400 percent zoom on a laptop, which lands in this layout.

### D5. Low. Back returns the row to the start (390)

With the row scrolled to 900px, tapping Nashville and pressing back restores the page scroll exactly but the row is at `scrollLeft` 0 again, showing Anaheim. A fan checking Nashville, then Oklahoma City, then Pittsburgh scrolls the row from the start each time. Production has no row to lose.

### D6. Low. Between 500 and 1023 wide the row ends mid-page and a mouse user has no handle (768)

Screenshot: `shots/crop-768-branch.png`.

At 768 the scroller is the 640px column (x 64 to 704), not the screen: the eighth pill is cut at x 704 with 64px of empty page beside it, and 7 of 20 cities show. The cut does give a cue here. With the scrollbar hidden, a mouse without sideways scroll has only Shift plus wheel or the Tab key to reach the other 13; a horizontal wheel or trackpad gesture does scroll the row.

### Unchanged from production (not caused by this branch)

- **P1. Contrast, all viewports, both environments.** The header wordmark "NIGHT" is #da2d20 on #f7f3ea at 18px: 4.33:1. This is the single axe serious violation (`color-contrast`, 1 node) and the single failing text out of 164 text nodes. No text in the pill block fails: pill labels are rgb(33,29,24) on white.
- **P2. Hit sizes at 390, both environments.** Breadcrumb "Events" link 37.1x18 (the only undersized target in `<main>`); header menu button 40x40; wordmark link 17.1 tall; newsletter link 20 tall; 19 footer links 15 tall.
- **P3. Pill edges are faint, both environments.** A white pill with a 10 percent ink border on the #f7f3ea page: the shape is carried by a fill difference of about 1.1:1. The labels carry the meaning, so this is cosmetic, but the smaller desktop pills lean on it more.
- **P4. No machine-readable dates on the hub, both environments.** No Event JSON-LD and no `<time>` element; the row text is the only date source (see the game date check).

## 6. Fan walk (branch, 390)

- Above the fold: header, breadcrumb, the truck photo, "Live event" and "20 stops we cover · 64 shows", the H1 "Monster Jam 2027 schedule", the scope paragraph, the photo credit, the hazard stripe, "Find your city" and the pill row (y 779 to 823, 21px above the fold). No date is visible at rest; the first date appears after a 71px scroll.
- First scroll: December 2026 with the Anaheim card, January 2027 with its first cards. Second scroll: the rest of January.
- Date and time: dates are on every row ("Anaheim: Dec 19 to 20, 2026"). Showtimes are not on the hub; the intro says they are on the stop page. Venue: named on every row ("Angel Stadium · 2 shows") with a venue guide link.
- Primary action: the stop row. It goes to `/events/monster-jam/{venue}` on the same host, no redirect. Tapped "Indianapolis: Feb 6 to 7, 2027": destination H1 "Monster Jam Indianapolis". Back: scroll 1,685 to 1,685.
- Nothing on the page looks tappable and is not. The "Live event" tag is the one pill-shaped thing that is not a link; it is yellow, small caps and in the hero, and does not read as one of the city pills.
- Phone pills: 44px tall, 64.7 to 120.5 wide, 6px apart (production 8px). Adequate.
- 1280 above the fold: hero, H1, intro, "Find your city" and both pill rows (bottom edge at 795 of 800). The first date is at 870, a 70px scroll.

## 7. Measurements

| Measurement | Branch 390 | Production 390 | Branch 1280 | Production 1280 |
|---|---|---|---|---|
| Document clientWidth / scrollWidth | 390 / 390 | 390 / 390 | 1280 / 1280 | 1280 / 1280 |
| Full-page height | 5,483 | 6,003 | 4,516 | 4,698 |
| CLS during load | 0 | 0 | 0.0008 | 0.0008 |
| Interactive elements (visible) | 88 | 88 | 93 | 93 |
| Under 44x44 | 24 (1 in main) | 24 (1 in main) | 49 (21 in main) | 29 (1 in main) |
| Text nodes failing 4.5:1 | 1 of 164 ("NIGHT", 4.33) | 1 ("NIGHT", 4.33) | 1 ("NIGHT", 4.33) | 1 ("NIGHT", 4.33) |
| axe serious or critical | 1 (color-contrast, 1 node) | 1 (same) | 1 (same) | 1 (same) |
| `<a>` to /promos/ in DOM / visible | 8 / 6 | 8 / 6 | 8 / 7 | 8 / 7 |
| First ad anchor, distance from top | none on page | none on page | none on page | none on page |
| Pills: count / rows | 20 / 1 | 20 / 11 | 20 / 2 | 20 / 5 |
| Pill height / font size | 44 / 14px | 44 / 14px | 32 / 12px | 44 / 14px |
| Pill list clientWidth / scrollWidth | 390 / 1,947 | 358 / 358 | 864 / 864 | 736 / 736 |
| Pill list x extent | 0 to 390 | 16 to 374 | 208 to 1072 | 272 to 1008 |
| Find your city section height | 74.9 | 594.9 | 100.9 | 282.9 |
| First date text top (screens) | 898.9 (1.065) | 1,418.9 (1.681) | 870.1 (1.088) | 1,052.1 (1.315) |
| Back from a pill: page scroll delta | 0 | 0 | not run | not run |
| Back from a pill: row scrollLeft | 900 to 0 | no row | no row | no row |
| Back from a month row: scroll delta | 0 | 0 | not run | not run |
| Keyboard: pill tab stops / focused but cut | 20 / 6 | not run | 20 / 0 | not run |

Branch at 1024x800: 2 rows of 10, list 864 / 864 at x 80 to 944, pills 32 tall at 12px, CLS 0.0012, first date at 870.1.

## 8. Recommendation

Do not merge on the phone result alone: settle D1 and D2 first, by fixing them or by writing a waiver here. Both are the same question, whether the block reads as intended. On a 428 or 430 wide phone the row hides 15 cities behind a clean edge, and on a laptop the grid has 45px holes and starts 58px left of its own heading. The three numeric requirements pass and nothing outside the block moved, so these two are all that stands between this build and a clean report. Recheck the phone row on a real iPhone as well; this run was Chromium only.

## Dispositions (2026-11-19, Phase 5B)

The review ran on the first build of the branch. D1 and D2 were fixed after it and the block was re-measured (same Chromium, analytics hosts blocked); the numbers below are from the fixed build.

| Defect | Disposition |
| --- | --- |
| D1. The desktop grid reads as a mistake (uneven gaps, ragged right edge, pills left of their heading) | Fixed. The two-row column grid is gone. From 1024 the pills wrap in a centered block under a centered heading, every gap 4px. Measured at 1024 and 1280: two rows (11 and 9 pills), list scrollWidth 864 equals clientWidth 864, no page overflow. A third row would appear only when more stops are added than two rows hold (known-issues 113). |
| D2. No sign the phone row scrolls at some widths | Fixed. A 40px fade to the page color sits over the row's right edge below 1024, and the row has 40px of end padding so the last pill clears it. Measured at 360, 390 and 428: one row, no page overflow. |
| D3. 32px pills on a touch tablet in landscape | Waived: the compact desktop size is by width; the pills are 4px apart and at least 51px wide. Logged in known-issues 113 for a pointer-type rule if tablets matter here. |
| D4. Six pills take keyboard focus while partly cut by the screen edge on a phone | Waived: every pill is reachable and the row follows focus; the focused pill's name is readable in each case the review lists. |
| D5. Browser back resets the row's own scroll position | Waived: the page scroll is restored exactly; the row is twenty short names. |
| D6. Between 500 and 1023 the row ends at the column edge | Waived: the row scrolls by touch, trackpad, Shift plus wheel or Tab, and the fade now marks it. |

Requirement checks on the fixed build: at 390x844 the first date ("Anaheim: Dec 19 to 20, 2026") starts 1.06 screens from the top; at 1280 the block is two rows; all 20 pills are links carrying `events_hub_list`, alphabetical, city only. Not verified: iOS Safari (no WebKit build installed), as the review says.
