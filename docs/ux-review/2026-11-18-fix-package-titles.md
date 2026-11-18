# UX review: fix/package-titles, 2026-11-18

Run of 2026-11-18 (America/New_York). Baseline mode, page type promo.

- Branch: `fix/package-titles` at `a4d9ea9`, one commit on top of `13b5d47`. Served as a production build at `http://localhost:3100` (already running; not started, stopped or rebuilt by this review). The local server carries no `promonight-deploy` meta, so the commit behind the served build could not be confirmed from its HTML.
- Production: `https://www.getpromonight.com`, `<meta name="promonight-deploy" content="dpl_GRUWWavtppqvWfe4yfLdsTFYNf42">`.
- Control sample, resolved from the sitemap at run time: `/nhl/buffalo-sabres/promos/sabres-salt-and-pepper-shakers`, first Event `startDate` 2026-11-25 (cutoff today plus 7 = 2026-11-25; 78 promo URLs read in sitemap order, the earlier ones dated 2026-11-18 or before).
- Viewports 390x844, 768x1024, 1280x800. 24 renders (4 pages, 3 viewports, 2 environments).

Method limits, stated so the numbers are read correctly:

- Every request off the page's own origin was aborted on both sides (seen and aborted: www.googletagmanager.com, ads.adthrive.com, us-assets.i.posthog.com, us.i.posthog.com). No request reached ticketnetwork, lusg.net, ticketmaster, evyy.net, spothero, expedia, fanatics or ebay. Ads therefore never filled, and CLS excludes ad fill.
- No affiliate link was tapped. CTA destinations are the `href` hosts as rendered; no redirect hop was followed.
- Desktop Chrome User-Agent at device scale factor 1 on all viewports, no touch emulation.
- Playwright launched with its default browser build; no `executablePath` fallback was needed.
- Screenshots and diff images are in the session scratchpad, not in the repo (launcher instruction): `/private/tmp/claude-501/-Users-mattkovalik-promonight-web/9a9089de-77d7-4b8c-add2-4b36f8d24d44/scratchpad/uxr-titles/<slug>/<viewport>-<env>.png` and `<viewport>-diff.png`.
- Head fields compared: title, og:title, twitter:title, description, og:description, twitter:description, canonical, og:url, og:image, robots, every JSON-LD block. Other head tags were not compared.

## 1. Baseline differences

### Titles (served HTML; `<title>`, og:title and twitter:title carry the same string on each side, on every page)

| Page | Production | Branch | Branch length |
|---|---|---|---|
| girls-night-out-ticket-package | Girls Night Out Ticket Package \| Braves Apr 29 \| PromoNight | Girls Night Out Ticket Package \| Braves Apr 29 | 45 |
| father-s-day-catch-on-the-field-ticket-package | Father's Day Catch on the Field Ticket Package \| PromoNight | Father's Day Catch on the Field Ticket Package \| Braves | 55 |
| military-appreciation-ticket-package | Military Appreciation Ticket Package \| Braves \| PromoNight | Military Appreciation Ticket Package \| Braves May 31 | 52 |
| sabres-salt-and-pepper-shakers (control) | Sabres Salt and Pepper Shakers \| Sabres Nov 25 \| PromoNight | identical to production | 59 |

The three changed pages follow the stated rule and drop the " | PromoNight" suffix. The Father's Day page takes the no-date form ("| Braves"); the other two carry the date. The control is unchanged.

### Rest of the head

- description, og:description, twitter:description, canonical, og:url, og:image: identical on all four pages.
- robots meta: absent on both sides on all four pages.
- JSON-LD (3 blocks per page on both sides): identical on girls-night-out and on the control. **Different on two changed pages, in `WebPage.name` only:**
  - father-s-day: production `"Father's Day Catch on the Field Ticket Package"`, branch `"Father's Day Catch on the Field Ticket Package | Braves"`.
  - military-appreciation: production `"Military Appreciation Ticket Package | Braves"`, branch `"Military Appreciation Ticket Package | Braves May 31"`.
  - `Event.name` and the BreadcrumbList names are unchanged. This is a difference outside the stated scope of the change (title, og:title, twitter:title). See defect B1.

### Rendered body

- Served HTML of `<article>` (scripts, nonces, build hashes, flight payload stripped): one differing region per page, on all four pages, the "Also on Ticketmaster" link `href` (branch `https://www.ticketmaster.com/...`, production `https://ticketmaster.evyy.net/c/...`). This is the known local difference (no Ticketmaster affiliate wrap). Nothing else differs. No eBay or forecast difference appeared inside the article on these pages.
- Rendered article text (`innerText`): identical at every viewport on all four pages.
- Pixel comparison, full page, no mask, any channel delta counted: **0 differing pixels in all 12 viewport pairs**; image sizes equal in every pair. Diff images written next to the screenshots.
- Tap targets (tag, label, size, position of every interactive element): identical at every viewport on all four pages.
- Step 2 measurements that moved: none of substance. CLS on father-s-day at 1280 read 0.0002 branch against 0 production, and on the control at 768 read 0.0003 against 0; both are noise.

## 2. Game date check

| Page | Game line | Event startDate | Venue zone | Today in zone | Verdict |
|---|---|---|---|---|---|
| girls-night-out | Thursday, Apr 29, 2027 · 7:15 PM | 2027-04-29 | America/New_York (Truist Park, Atlanta; the page states no zone) | 2026-11-18 | upcoming, 162 days out |
| father-s-day | Sunday, Jun 20, 2027 · 1:35 PM | 2027-06-20 | America/New_York (no zone stated) | 2026-11-18 | upcoming, 214 days out |
| military-appreciation | Monday, May 31, 2027 · 4:10 PM | 2027-05-31 | America/New_York (no zone stated) | 2026-11-18 | upcoming, 194 days out |
| control (Sabres) | Wednesday, Nov 25, 2026 · 7:00 PM ET | 2026-11-25 | America/New_York (page states ET) | 2026-11-18 | upcoming, 7 days out |

No page is a played game. Each offers tickets, parking, hotels and a reminder. Same on both sides.

## 3. Three things that work

1. The body is untouched by the change: zero pixel difference, identical text and identical tap targets in all 12 pairs, with the control unchanged in head and body.
2. Above the fold at 390 a first-time visitor gets, in order, the breadcrumb, a "Theme night" badge, the name as H1, "Atlanta Braves vs Mets", the date and time in bold, the venue link, a day tile with the day count, and a full-width "Get tickets" button (144x52) with Share, Parking, Hotels and Remind me (44 high). Date, time and venue are found without scrolling. The first two scrolls bring the one-line description with its source and check date, the This game card, the fan guide and the venue quick facts.
3. Rail cards go where they say and back works. "Magnetic Schedule Giveaway" opens H1 "MAGNETIC SCHEDULE GIVEAWAY"; "Alumni Sunday" opens "ALUMNI SUNDAY"; "Thanksgiving Eve" (control) opens "THANKSGIVING EVE". Scroll on back: 479 to 479 (father-s-day), 394 to 394 (control), and in a clean re-test from the "More ... promos" rail 1687 to 1687 on girls-night-out (1678 at 600 ms) and 983 to 983 on the control, on both sides. A first pass had read 1636 to 1318 (girls-night-out) and 1669 to 1356 (military) on both sides; that pass ran axe and a clipped screenshot on the page before the tap, the clean re-test on girls-night-out did not reproduce it, and the cause in the harness was not isolated. Military was not re-tested.

Primary CTA, read not tapped: "Get tickets" points at ticketnetwork.lusg.net on both sides. Parking points at tracking.spothero.com, Hotels at www.expedia.com. "Also on Ticketmaster" points at ticketmaster.evyy.net on production and www.ticketmaster.com on the branch (known local difference).

## 4. Defects

Screenshot paths are relative to the scratchpad folder named above.

### Introduced by the branch

| # | Severity | Defect | Viewport | Evidence |
|---|---|---|---|---|
| B1 | Low | `WebPage.name` in the JSON-LD changes on father-s-day and military-appreciation (strings in section 1). The stated scope was title, og:title and twitter:title only. The new values match what production already does on girls-night-out (WebPage.name is the title without the brand), so this reads as the same rule reaching two more pages, but it is a structured-data change that the change description does not name. Not visible to a fan. Needs a fix or a written waiver. | all (head) | served HTML |

No fan-visible defect is introduced by the branch.

Observation, not a defect: the Father's Day page gets the title form without a date while its two siblings get a date. That is the stated fallback rule; it is noted because the three sibling pages will not read alike in a result list.

### Identical on production (not introduced by the branch)

| # | Severity | Defect | Viewport | Screenshot |
|---|---|---|---|---|
| P1 | Medium | "Also on Ticketmaster" is a 133x21 text link sitting directly under the 52 high "Get tickets" button and above Parking and Hotels; a thumb aimed at it lands on a neighbour. All four pages. | 390 | `girls-night-out-ticket-package/390-branch.png` |
| P2 | Medium | Footer: 20 links at 15 high (for example "Promos today" 87x15, "Privacy Policy" 87x15), plus the newsletter link at 266x20. All four pages. | 390 | `girls-night-out-ticket-package/390-branch.png` |
| P3 | Low | Other targets under 44x44 at 390: menu button 40x40; wordmark home link 132x17; hero venue link 71x16 (control 106x16); breadcrumb links 25x18 and 78x18; "N more giveaways at Truist Park" 212x16; "Alumni Sunday" 103x16 and "Kids Run the Bases" 132x16 (father-s-day); "Truist Park gameday guide", "All Atlanta Braves promos", "Theme nights across pro sports" at 21 high; inline source links "mlb.com" 47x14, "Official lot map" 92x15, "keybankcenter.com" 105x12 (control). Counts at 390: 33, 35, 33 and 34 of 50, 54, 50 and 49 interactive elements. | 390 | `<slug>/390-branch.png` |
| P4 | Low | axe `link-in-text-block` (serious), 2 nodes on each of the three Braves pages: "Official bag policy" and "Official lot map" inside the quick facts are told from the surrounding text by colour alone. Not present on the control. | all | `girls-night-out-ticket-package/390-branch-top.png` |
| P5 | Low | axe `color-contrast` (serious), 1 node on all four pages: the "NIGHT" half of the header wordmark, rgb(218,45,32) on rgb(247,243,234), 4.33:1 at 18px weight 800. It is the only text under 4.5:1 found on any of the pages. | all | `<slug>/390-branch.png` |
| P6 | Low | The three Braves pages give the time with no zone ("7:15 PM"; `<time datetime="2027-04-29T19:15:00">` with no offset). The control says "7:00 PM ET" with an offset. | all | `girls-night-out-ticket-package/390-branch-top.png` |
| P7 | Low | "Theme night" wording on ticket packages that are day games: the badge, "About this theme night" and "What to expect at a theme night" sit on a 1:35 PM Sunday game (father-s-day) and a 4:10 PM Monday game (military). The meta description says "Atlanta Braves theme night vs Yankees". The fan guide itself is on point for a ticket package. | all | `father-s-day-catch-on-the-field-ticket-package/390-branch-top.png` |
| P8 | Low | Near-empty "This game" card on girls-night-out and military: two rows, one of which ("Opponent: Mets") restates the "Atlanta Braves vs Mets" line in the hero. Father's Day and the control have more in it. | all | `military-appreciation-ticket-package/1280-branch.png` |
| P9 | Low | Military page, "Same promo, other teams / Military Appreciation at other clubs this season": the rows are NFL "Salute to Service" games on Nov 22, 2026 and a Cavaliers cap on Nov 29, under a Braves game in May 2027. "This season" does not mean the Braves season the page is about. | all | `military-appreciation-ticket-package/1280-branch.png` |
| P10 | Low | girls-night-out, "More MLB theme nights coming up": the first three rows are all "Opening Day", Mar 25, for three different clubs. | 390 | `girls-night-out-ticket-package/390-branch-top.png` |

Not judged: the two rows under "Previous editions" on the Father's Day page look like list rows; whether they are meant to be tappable was not established in this run.

## 5. Measurements

Branch and production gave the same value in every cell except the two CLS readings noted in section 1, so each cell shows one value for both. Columns are the pages; "b/p" marks the one place the sides differ by design.

| Measure | girls-night-out | father-s-day | military | control (Sabres) |
|---|---|---|---|---|
| HTTP status, b and p | 200 | 200 | 200 | 200 |
| Document height 390 / 768 / 1280 | 4166 / 2850 / 2758 | 4519 / 3095 / 3004 | 4211 / 2878 / 2786 | 3299 / 2292 / 2247 |
| Horizontal overflow (scrollWidth over clientWidth) | none | none | none | none |
| CLS 390 / 768 / 1280 | 0.029 / 0.0002 / 0.013 | 0.0001 / 0.0003 / 0.0002 b, 0 p | 0.0272 / 0.0002 / 0.0001 | 0.029 / 0.0003 b, 0 p / 0.013 |
| Interactive elements at 390 | 50 | 54 | 50 | 49 |
| Under 44x44 at 390 | 33 | 35 | 33 | 34 |
| Text under 4.5:1 | 1 (wordmark "NIGHT", 4.33) | 1 | 1 | 1 |
| axe serious or critical | color-contrast x1, link-in-text-block x2 | same | same | color-contrast x1 |
| `<a>` to /promos/ in DOM / visible at 390 | 19 / 17 | 23 / 21 | 19 / 17 | 19 / 17 |
| same at 768 and 1280 | 19 / 18 | 23 / 22 | 19 / 18 | 19 / 18 |
| First ad anchor from document top at 390 | 57 px | 57 px | 57 px | 57 px |
| Pixel diff b vs p, 390 / 768 / 1280 | 0 / 0 / 0 | 0 / 0 / 0 | 0 / 0 / 0 | 0 / 0 / 0 |
| "Also on Ticketmaster" host | b www.ticketmaster.com, p ticketmaster.evyy.net | same split | same split | same split |
| Uncaught page errors | 0 | 0 | 0 | 0 |

Notes on the table: the first ad anchor is the `<article data-ad-region="content">` itself; no `data-ad-item` exists on these pages. The /promos/ links present in the DOM but not visible (2 at 390, 1 at wider viewports) were counted, not identified.

## 6. Housekeeping seen during the run

`scripts/live/team-pages.live.test.ts` became modified and uncommitted in the worktree during this review (file time 14:53:45 local; the worktree was clean apart from `node_modules` when the review began). The edit widens the package-title test in the live battery to match "ticket package" anywhere in the name. It was not made by this review and is not part of `a4d9ea9`. This review wrote only this report inside the repo; its temp script was deleted.

## 7. Recommendation

Rule on B1 before merge: either accept in writing that `WebPage.name` follows the new title on package pages (it already does on girls-night-out in production), or hold it to the stored name. Nothing a fan sees changes on this branch, so the body findings P1 to P10 do not block it; of those, P1 (the 21 high Ticketmaster link wedged between the ticket button and Parking) is the one to take first.

## Dispositions (2026-11-18)

| # | Defect | Disposition |
|---|---|---|
| B1 | `WebPage.name` in JSON-LD follows the new title on package pages | WAIVED. The WebPage name has always been the page's bare title (it already was on girls-night-out); it now follows the ruled title on every package page. Not fan-visible, and the adversarial review found the same and called it consistent. |
| P1, P2, P3 | Tap targets under 44x44 at 390, "Also on Ticketmaster" among them | DEFERRED, known-issues 110 item 2 (same finding). |
| P4 | Inline links told apart by colour alone | DEFERRED, known-issues 110 item 4. |
| P5 | Header wordmark contrast 4.33:1 | WAIVED (the brand red on cream, ruled 2026-11-08). |
| P6 to P10 | No zone on the Braves game time; "Theme night" badge on day-game packages; near-empty This game card; "Same promo, other teams" lists 2026 games under a 2027 game; three "Opening Day" rows in a row | DEFERRED, known-issues 111. |

After the reviewed build one change was added from the adversarial review: the live guard's package test now matches the page rule (the phrase anywhere in the name, any case). It touches no rendered markup.
