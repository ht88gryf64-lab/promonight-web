# UX review: fix/gsc-cleanup-followup, 2026-11-10

Run section: 2026-11-10, 13:25 EST. Baseline mode, branch dev server against production.

## Run header

| | Production | Branch |
|---|---|---|
| Base URL | https://www.getpromonight.com | http://127.0.0.1:3100 (`PROMO_PAGES_LIVE=true`, `next dev`, production Firestore) |
| Deployment | `<meta name="promonight-deploy" content="dpl_BMF2Q3TDUPCqJLsFRVufTwGYmKEB">` on all five pages | No deploy meta (the dev server never carries one) |
| Commit | origin/main `53b3101` (the GSC cleanup deploy; the meta names a deployment, not a commit) | HEAD `4026616`, merge base with origin/main `53b3101`. The working tree is clean apart from the untracked `node_modules` symlink, so the render is HEAD exactly |

Pages reviewed (the caller's list):
1. `/nba/minnesota-timberwolves/promos/paint-night-blanket` (package page with a stored source URL)
2. `/nhl/pittsburgh-penguins/promos/90s-night-t-shirt` (package page)
3. `/nba/minnesota-timberwolves/promos/nba-paint-night` (non-package page, same game as 1)
4. The promo sample
5. `/cfb/rivalries`

**Promo sample:** `/nhl/chicago-blackhawks/promos/centennial-game`, game date **2026-11-17**. I fetched the sitemap fresh: it has 1,643 promo URLs, and this page is promo URL 75 in sitemap order. Today in America/New_York is 2026-11-10, so the cutoff is 2026-11-17. URLs 1 to 74 carry first-Event `startDate`s up to 2026-11-16. I compared dates as YYYY-MM-DD strings. This is the same page the earlier report today chose.

**Method.**
- Playwright Chromium with a desktop Chrome User-Agent, at 390x844, 768x1024 and 1280x800, DPR 1, in America/New_York.
- Ad-network and analytics requests were blocked in both environments for the screenshots, the diffs and the step 2 measurements, so ads never fill and the pixels compare like for like. A separate production-only run at 390 let ads load, to locate the in-content slots.
- For the full-page capture the sticky header was pinned (`position: relative`). The Next dev overlay was hidden on the branch.
- Contrast figures come from axe-core.
- **Screenshots and diff images are in the session scratchpad, outside the repo**, at the caller's instruction (the same as the 2026-11-08 and 2026-11-10 reports): `/private/tmp/claude-501/-Users-mattkovalik-promonight-web/0a7fba2d-ec9c-40db-a7fb-3d1a4827dab4/scratchpad/ux-screens-followup/<slug>/<viewport>-<env>.png`, abbreviated below as `SHOTS/<slug>/...`.
- Side-by-side crops (production, branch, diff) are in `.../scratchpad/uxfu/crops/`. Scripts and raw data are in `.../scratchpad/uxfu/`.

### Defect index

| ID | Page | Severity | New on branch / also on production |
|---|---|---|---|
| P1 | both package pages | Low | **New on branch** (the team-site link is under 44 tall and sits 10px above `Also on Ticketmaster`) |
| P2 | both package pages | Low | **New on branch** (the disclosure says "may not include it"; the page's FAQ and meta say "does not include it") |
| P3 | both package pages | Low | **New on branch** (the day tile stretches to 285px with 91px of content) |
| P4 | both package pages | Low | **New on branch** (`Also on Ticketmaster` now reads as part of the package line, not as the alternative to `Get tickets`) |
| P5 | both package pages | Low | **New on branch** (the first screen now states the package fact four times) |
| T2 | both package pages | Low (was Medium) | Also on production, mitigated on the branch: the primary CTA still sells a ticket without the item |
| T3 | both package pages | Low | Also on production |
| T4 | paint-night-blanket, nba-paint-night | Low | Also on production (game time has no zone) |
| N1 | nba-paint-night | Low | Also on production (CLS 0.031 at 390) |
| G1 | all four promo pages | Low | Also on production (header logo `NIGHT` 4.33:1; small header, crumb and footer targets) |
| R1 | /cfb/rivalries | Low | Also on production (carried over from this morning's report, now merged) |
| R4 | /cfb/rivalries | Low | Also on production (70 contrast nodes) |
| R5 | /cfb/rivalries | Low | Also on production (23 small targets) |

Nothing is High or Medium. Five defects are new on the branch: P1 to P5, all Low, all on package pages. The non-package page, the promo sample and /cfb/rivalries are unchanged apart from the environment-only Ticketmaster wrapper.

### Process notes

- Ticketmaster links on the branch are bare `www.ticketmaster.com` URLs, without the `ticketmaster.evyy.net` Impact wrapper, because `NEXT_PUBLIC_TICKETMASTER_IMPACT_WRAP` is unset on the dev server. This is environment only. It is the only main-content HTML difference on nba-paint-night and centennial-game.
- The TicketNetwork `Get tickets` href, including `subId1` and `subId3`, is byte-identical between the environments on every promo page. The package change does not touch CTA tagging.
- Neither package page exercises the no-stored-URL path, where the disclosure renders without the link. Both reviewed rows store a source URL. That path is not reviewed here.
- `/cfb/rivalries` past tense switches on only after 2026-11-28 (the `today > RIVALRY_WEEK_END` check). The served HTML cannot show it today, so this run confirms only that today's output is unchanged. The past-tense output is verified by unit tests alone, not by served bytes.
- In headless Chromium, `www.nba.com/timberwolves/promotions` opened with the title `Access Denied` (bot protection on the headless browser). A plain desktop-UA fetch of the same URL returns 200 (188 KB) and mentions `Paint Night` 4 times and `blanket` twice. I treat this as the test harness, not a defect.

---

## 1. /nba/minnesota-timberwolves/promos/paint-night-blanket

### Baseline differences

**Served main content (`<article>`)**: not identical. There is one differing region, inserted after the `Get tickets` / `Share` row and before `Also on Ticketmaster`:

> `<div data-package-disclosure>`
> **`This promo comes with a special ticket package from the team. Tickets bought through us may not include it.`**
> **`See the package on the team site`**: `<a href="https://www.nba.com/timberwolves/promotions" target="_blank" rel="noopener nofollow">`

Apart from that, only the environment-only Ticketmaster wrapper differs.

**Head and JSON-LD:**
- `<title>`, `og:title` and `twitter:title`: `Paint Night Blanket Ticket Package | Timberwolves` becomes **`Paint Night Blanket Ticket Package | Timberwolves Nov 19`** (49 to 56 characters, absolute, no brand suffix).
- The WebPage JSON-LD `name` changes the same way.
- Description, canonical, Event JSON-LD and FAQ JSON-LD are unchanged.

**Pixels** (no ads filled in either environment):

| Viewport | Height prod / branch | Differing pixels | Where |
|---|---|---|---|
| 390 | 3431 / 3527 (+96) | 147,590 (10.73%) | From y=389, directly under `Get tickets`, down. Rows 0 to 330 are identical. Below the CTA block, production shifted by 96px matches the branch with **0** differing pixels |
| 768 | 2467 / 2542 (+75) | 192,201 (9.85%) | From y=325 (the day tile re-centring) down. Below the CTA block the content matches at a shift of 75 to 76px; the residue is sub-pixel re-rasterisation, because the block is a fractional height |
| 1280 | 2443 / 2518 (+75) | 271,127 (8.41%) | Same as 768 |

Diff images: `SHOTS/paint-night-blanket/390-diff.png`, `768-diff.png`, `1280-diff.png`. Side-by-side fold: `.../scratchpad/uxfu/crops/paint-night-blanket-390-fold.png`, `pnb-768-fold.png`, `pnb-1280-fold.png`.

**Measurements that moved:**

| | Production | Branch |
|---|---|---|
| Document height 390 / 768 / 1280 | 3431 / 2467 / 2443 | 3527 / 2542 / 2518 |
| `Get tickets` box at 390 | y 336, 144x52 | **unchanged**: y 336, 144x52 |
| `Get tickets` box at 768 / 1280 | y 298, 394x52 / 522x52 | unchanged |
| Disclosure paragraph at 390 | none | y 398 to 459, 3 lines, 14px, `rgb(80,72,63)` on `rgb(247,243,234)` (8.1:1), inside the first screen |
| Disclosure at 768 / 1280 | none | 2 lines, y 360 to 400 |
| Team-site link at 390 | none | y 463, **207x21** |
| `Also on Ticketmaster` at 390 | y 398 | y 494 (+96) |
| `About this ticket package` heading at 390 / 768 | 549 / 459 | 645 / 534 |
| Day tile height 390 / 768 | 189 / 137 | **285 / 213** (text inside stays 91) |
| Hit targets < 44 at 390 | 36 | 37 (+ the team-site link) |
| First ad anchor at 390 | `article[data-ad-region=content]` at 57 | unchanged at 57 (the article is the page's only ad anchor) |
| Production in-content ads at 390, ads on | `AdThrive_Content_1_phone` after `This game` at y 930 (below the 844 fold) | not measurable on localhost. Everything after the CTA moves +96, so this slot lands about 96px lower, still after `This game` and still below the fold |
| CLS 390 / 768 / 1280 | 0.0002 / 0.001 / 0.0002 | 0.0001 / 0.0008 / 0.0002 |

### Game date check

- Game line: `Thursday, Nov 19, 2026 · 7:00 PM` (`<time dateTime="2026-11-19T19:00:00">`, no offset).
- JSON-LD Event `startDate`: `2026-11-19`, `eventStatus` EventScheduled. Identical in both environments.
- The page states no zone, so America/New_York applies: today is 2026-11-10.
- **Verdict: upcoming, IN 9 DAYS.** Not a played game.

### Three things that work

1. **The disclosure is readable at 390 without a tap.** It is server-rendered plain text at 14px and 8.1:1 contrast, three lines (y 398 to 459), directly under `Get tickets`, and the whole of it is inside the first screen (`SHOTS/paint-night-blanket/390-branch.png`). It is not collapsed and not behind a control. `Get tickets` does not move: y 336, 144x52 in both environments, at every viewport.
2. **The team-site link is a real tap target and goes where it says.** A mouse tap at its centre opens a new tab on `https://www.nba.com/timberwolves/promotions` (no redirect), a page that lists Paint Night and the blanket. The link is underlined, red `#c62a1e`, `rel="noopener nofollow"`, and carries no affiliate parameters.
3. **The fan walk still works.** The date and time are at y 268 and the venue at y 300. `Get tickets` goes to `ticketnetwork.lusg.net`, which redirects 302 to `www.ojrq.net`. The rail card `TUE NOV 17 Native American Heritage Night` lands on that H1. Browser back restores scroll at 882 (delta 0); production restores at 786 (delta 0, the same card 96px higher).

### Defects

- **P1 (Low, new on branch). The team-site link is 21px tall and sits 10px above another 21px link.** `See the package on the team site` is 207x21 at y 463 to 484. `Also on Ticketmaster` is 133x21 at y 494 to 515, and the two overlap horizontally (x 120 to 327 and x 181 to 314). A 44px fingertip aimed at either one covers both. The gap between them is dead space (a tap at y 489 hits the wrapper `DIV`), so a slightly-off tap does nothing or opens the wrong site. The same 21px height applies at 768 and 1280 (y 404 and y 435). `SHOTS/paint-night-blanket/390-branch.png`, crop `uxfu/crops/paint-night-blanket-390-fold.png`.
- **P2 (Low, new on branch). The disclosure hedges what the page states as fact.** The new line says `Tickets bought through us may not include it.` The same page's meta description says `A standard game ticket does not include it.`, and the FAQ, both visible and in the JSON-LD, says `Yes. Paint Night Blanket is required; a standard game ticket does not include it.` A fan who reads "may not" and then taps `Get tickets` still cannot tell whether the blanket comes with that ticket. Every viewport.
- **P3 (Low, new on branch). The day tile stretches into a tall, mostly empty card.** The tile (`THU 19 NOV IN 9 DAYS`) is `items-stretch` beside the CTA column. That column grew, so the tile grew from 189px to **285px at 390** (137 to 213 at 768 and 1280), while its content stays 91px. At 390 the date floats in the middle of a card that now runs from the `Get tickets` row down past `Remind me`, with about 190px of blank card. `SHOTS/paint-night-blanket/390-branch.png`, `SHOTS/paint-night-blanket/768-branch.png`.
- **P4 (Low, new on branch). `Also on Ticketmaster` is now separated from the button it is an alternative to.** The reading order is now `Get tickets`, `Share`, the package disclosure, `See the package on the team site`, then `Also on Ticketmaster`. Directly under a team-site package link, the centred `Also on Ticketmaster` reads as a second place to get the package. The disclosure's `Tickets bought through us` is also ambiguous about whether it covers the Ticketmaster link, which is affiliate-tagged on production too. All viewports.
- **P5 (Low, new on branch; it extends T3). The package fact is now stated four times on the first screen at 390.** The sequence is:
  1. The `TICKET PACKAGE` tag.
  2. The disclosure `This promo comes with a special ticket package from the team...`.
  3. `Special ticket package for paint night blanket.`
  4. `Comes with a special ticket package.`
  5. `Package: Paint Night Blanket`.

  Items 3 to 5 come right below it, under `About this ticket package`. The About block's first line now restates the disclosure 180px above it. `SHOTS/paint-night-blanket/390-branch.png`.
- **T2 (Low, also on production; was Medium this morning, mitigated on the branch).** The primary CTA `Get tickets` still sells a standard TicketNetwork ticket that, by the page's own FAQ, does not include the item. On the branch the disclosure now sits directly under it in the first screen. But it comes after the button in reading and tab order, and the button's accessible name (`Get tickets for Minnesota Timberwolves vs Knicks on TicketNetwork`) does not mention it. On production there is no disclosure at all.
- **T3 (Low, also on production).** The About block lower-cases the item mid-sentence (`Special ticket package for paint night blanket.`). The FAQ answer `Paint Night Blanket is required` reads as if the blanket were required for entry.
- **T4 (Low, also on production).** The game time has no zone: `7:00 PM`, with `dateTime="2026-11-19T19:00:00"` carrying no offset. The Penguins and Blackhawks pages print `ET` and `CT`. Every viewport.
- **G1 (Low, also on production).** The header logo `NIGHT` is `#da2d20` on `#f7f3ea`, 4.33:1 at 18px bold. This is the only axe serious violation on the page (color-contrast x1). The other 36 hit targets under 44px are the header logo (132x17), the crumbs (`NBA` 25x18, `Minnesota Timberwolves` 133x18), `Target Center` (89x16), `nba.com` (47x14), the This-game links (14 to 16px tall), three `targetcenter.com ›` source links (92x12), the rail footer links, the newsletter link and 19 footer links (15px). `Open menu` is 40x40.

### Measurements

| Measure | Production | Branch |
|---|---|---|
| HTTP | 200 | 200 |
| `<title>` | Paint Night Blanket Ticket Package \| Timberwolves | Paint Night Blanket Ticket Package \| Timberwolves Nov 19 |
| H1 | Paint Night Blanket | Paint Night Blanket |
| CLS 390 / 768 / 1280 (ads blocked) | 0.0002 / 0.001 / 0.0002 | 0.0001 / 0.0008 / 0.0002 |
| CLS 390 with ads (production only) | 0.0002 | n/a |
| `<a>` to /promos/ DOM / visible (390, 768, 1280) | 21/19, 21/20, 21/20 | 21/19, 21/20, 21/20 |
| First ad anchor at 390 | `article[data-ad-region=content]` at 57 | 57 |
| Hit targets < 44 at 390 | 36 | 37 |
| Contrast failures (axe) | 1 (`NIGHT`, 4.33:1) | 1 (same) |
| axe serious/critical | color-contrast x1 | color-contrast x1 |
| `Get tickets` at 390 | y 336, 144x52 | y 336, 144x52 |
| Disclosure at 390 | none | y 398 to 484 (text plus link), in the first screen |
| Pixel diff 390 / 768 / 1280 | | 10.73% / 9.85% / 8.41% (an insertion and a uniform shift; 0 content pixels differ below the block at 390) |

Screenshots: `SHOTS/paint-night-blanket/{390,768,1280}-{production,branch,diff}.png`.

**First-time visitor (branch, 390).**
- Above the fold: the crumb, the `TICKET PACKAGE` tag, a two-line H1 `PAINT NIGHT BLANKET`, `Minnesota Timberwolves vs Knicks`, `Thursday, Nov 19, 2026 · 7:00 PM`, `Target Center, Minneapolis`. Then the day tile beside `Get tickets` / `Share`, the three-line disclosure, the underlined `See the package on the team site`, `Also on Ticketmaster`, `Parking` / `Hotels`, `Remind me`, then `ABOUT THIS TICKET PACKAGE` with its three lines and the source line.
- First scroll: `THIS GAME` (opponent Knicks, also at this game NBA Paint Night, home game 10 of 40 timeline), then `BEFORE YOU GO` (bag 5" x 9", parking ramps, no outside food).
- Second scroll: `MORE MINNESOTA TIMBERWOLVES PROMOS` rail, the two text links, `MORE NBA THEME NIGHTS COMING UP` (five cards), `QUESTIONS`.

Production shows the same page without the disclosure block, everything 96px higher.

---

## 2. /nhl/pittsburgh-penguins/promos/90s-night-t-shirt

### Baseline differences

**Served main content (`<article>`)**: not identical. One differing region, in the same place as page 1:

> `This promo comes with a special ticket package from the team. Tickets bought through us may not include it.`
> `See the package on the team site` → `https://www.nhl.com/penguins/tickets/promotional-schedule` (`target="_blank" rel="noopener nofollow"`)

Otherwise only the environment-only Ticketmaster wrapper differs.

**Head and JSON-LD:**
- `<title>`, `og:title` and `twitter:title`: `90s Night T-Shirt Ticket Package | Penguins | PromoNight` (56, brand suffix) becomes **`90s Night T-Shirt Ticket Package | Penguins Dec 18`** (50, absolute, no suffix).
- The WebPage JSON-LD `name` changes to the same string.
- Description, canonical and the Event and FAQ JSON-LD are unchanged.

**Pixels:**

| Viewport | Height prod / branch | Differing pixels | Where |
|---|---|---|---|
| 390 | 3538 / 3633 (+95) | 148,276 (10.47%) | From y=389 down. Rows 0 to 330 are identical. Below the block, a 96px shift leaves 5,377 px of sub-pixel residue (thin bands, no content) |
| 768 | 2571 / 2647 (+76) | 193,344 (9.51%) | From y=325 (tile re-centring) down; a shift of 75 to 76px matches |
| 1280 | 2526 / 2602 (+76) | 272,213 (8.17%) | Same as 768 |

Diff images: `SHOTS/90s-night-t-shirt/{390,768,1280}-diff.png`; fold crop `uxfu/crops/90s-night-t-shirt-390-fold.png`.

**Measurements that moved:** the same geometry as page 1.
- `Get tickets` unchanged (y 336, 144x52 at 390).
- Disclosure y 398 to 459 (3 lines), link 207x21 at y 463.
- `Also on Ticketmaster` from 398 to 494.
- Hit targets under 44: 38 to 39.
- Rail scroll position before the tap: 906 to 1002.

### Game date check

- Game line: `Friday, Dec 18, 2026 · 7:00 PM ET` (`dateTime="2026-12-18T19:00:00-05:00"`).
- JSON-LD `startDate`: `2026-12-18`, EventScheduled.
- The page states ET, so America/New_York: today is 2026-11-10.
- **Verdict: upcoming, IN 38 DAYS.** Not a played game.

### Three things that work

1. The disclosure is fully visible in the first screen at 390, at the same 14px and 8.1:1 as page 1. `Get tickets` is unmoved.
2. `See the package on the team site` opens `https://www.nhl.com/penguins/tickets/promotional-schedule`, titled `Promotional Schedule | Pittsburgh Penguins` (200, no redirect). The page mentions `90s` 5 times and `ticket package` 107 times, so the fan lands where the package is sold.
3. The new title carries the game date (`... | Penguins Dec 18`), which the production title lacked. Rail card `SAT NOV 14 Hall of Fame Mystery Bag Charms` lands on that H1, and back restores scroll at 1002 (delta 0). `Get tickets` goes to `ticketnetwork.lusg.net`, which redirects 302 to `www.ojrq.net`.

### Defects

- **P1 to P5 (Low, new on branch)** apply here exactly as on page 1, with the same geometry:
  - P1: the 207x21 link 10px above the 133x21 `Also on Ticketmaster`.
  - P2: the disclosure says `may not include it`, while the FAQ says `90s Night T-Shirt Ticket Package is required; a standard game ticket does not include it.`
  - P3: the day tile (`FRI 18 DEC IN 38 DAYS`) stretches to the taller column.
  - P4: `Also on Ticketmaster` follows the team-site link.
  - P5: the About block repeats the disclosure, with `Special ticket package includes 90s Night T-Shirt.`, `Comes with a special ticket package.` and `Package: 90s Night T-Shirt Ticket Package`.

  `SHOTS/90s-night-t-shirt/390-branch.png`.
- **T2 (Low, also on production; mitigated on the branch).** As page 1.
- **T3 (Low, also on production).** `Package: 90s Night T-Shirt Ticket Package` puts the word "Package" in twice. The FAQ `90s Night T-Shirt Ticket Package is required` reads as an entry requirement.
- **G1 (Low, also on production).** `NIGHT` is 4.33:1 (the only axe serious violation). There are 38 hit targets under 44 on production and 39 on the branch (the new link).

### Measurements

| Measure | Production | Branch |
|---|---|---|
| HTTP | 200 | 200 |
| `<title>` | 90s Night T-Shirt Ticket Package \| Penguins \| PromoNight | 90s Night T-Shirt Ticket Package \| Penguins Dec 18 |
| CLS 390 / 768 / 1280 (ads blocked) | 0.0001 / 0.0008 / 0.0002 | 0.0001 / 0.0008 / 0.0002 |
| CLS 390 with ads (production only) | 0.0113 | n/a |
| `<a>` to /promos/ DOM / visible | 22/20, 22/21, 22/21 | 22/20, 22/21, 22/21 |
| First ad anchor at 390 | `article[data-ad-region=content]` at 57 | 57 |
| Production in-content ads, ads on | `Content_1` after `This game` at y 1029 | about +96, not measurable on localhost |
| Hit targets < 44 at 390 | 38 | 39 |
| axe serious/critical | color-contrast x1 | color-contrast x1 |
| `Get tickets` at 390 | y 336, 144x52 | y 336, 144x52 |
| Pixel diff 390 / 768 / 1280 | | 10.47% / 9.51% / 8.17% |

Screenshots: `SHOTS/90s-night-t-shirt/{390,768,1280}-{production,branch,diff}.png`.

**First-time visitor (branch, 390).** Same layout as page 1: the H1 `90S NIGHT T-SHIRT` (it breaks as `T-` / `SHIRT`, on production too), the game line with ET, the CTA block with the disclosure, then `ABOUT THIS TICKET PACKAGE`. The first scroll is `THIS GAME` (Kraken; also at this game 90s Night and 60th Anniversary Poster) and `BEFORE YOU GO`. The second scroll is the Penguins rail and the other-teams sections.

### Recommendation

See the single recommendation at the end of the report.

---

## 3. /nba/minnesota-timberwolves/promos/nba-paint-night (non-package, must be unchanged)

### Baseline differences

- **Served main content:** identical apart from the environment-only Ticketmaster wrapper on `Also on Ticketmaster`. There is no `data-package-disclosure` in the branch HTML.
- **Head:** identical (`NBA Paint Night | Minnesota Timberwolves Nov 19 | PromoNight`, description, canonical, og).
- **JSON-LD:** identical, all 4 blocks.
- **Pixels: 0 differing pixels at 390, 768 and 1280.** Heights are 4086 / 2937 / 2890 in both environments. Diff images: `SHOTS/nba-paint-night/{390,768,1280}-diff.png`.
- **Measurements that moved:** none.

**The non-package page is unchanged.**

### Game date check

- Game line: `Thursday, Nov 19, 2026 · 7:00 PM` (`dateTime="2026-11-19T19:00:00"`, no offset).
- JSON-LD `startDate`: `2026-11-19`.
- America/New_York today is 2026-11-10. **Verdict: upcoming, IN 9 DAYS.**

### Three things that work

1. The page is byte-identical apart from the affiliate wrapper, and pixel-identical at every viewport. The package branch logic does not leak onto the theme night at the same game.
2. `Get tickets` (144x52, y 336) goes to `ticketnetwork.lusg.net`, which redirects 302 to `www.ojrq.net`.
3. Rail card `TUE NOV 17 Native American Heritage Night` lands on that H1, and back restores scroll at 1331 (delta 0) in both environments.

### Defects

- **T4 (Low, also on production).** `7:00 PM` has no zone, and `dateTime` has no offset.
- **N1 (Low, also on production).** A layout shift of 0.031 at 390, about 0.6 s after load. Sources: the CTA section (`SECTION.mt-4 flex items-stretch`) and the sections below it. The value is identical in both environments, so it is not caused by this branch. It is below 0.1, but on this page the `Get tickets` row is what moves.
- **G1 (Low, also on production).** `NIGHT` is 4.33:1, and there are 34 hit targets under 44.

### Measurements

| Measure | Production | Branch |
|---|---|---|
| `<title>` | NBA Paint Night \| Minnesota Timberwolves Nov 19 \| PromoNight | same |
| CLS 390 / 768 / 1280 | 0.0311 / 0.0007 / 0.0002 | 0.0311 / 0.0007 / 0.0002 |
| `<a>` to /promos/ DOM / visible | 20/18, 20/19, 20/19 | same |
| First ad anchor at 390 | 57 | 57 |
| Hit targets < 44 at 390 | 34 | 34 |
| axe serious/critical | color-contrast x1 | color-contrast x1 |
| Pixel diff | | 0 / 0 / 0 |

Screenshots: `SHOTS/nba-paint-night/{390,768,1280}-{production,branch,diff}.png`.

**First-time visitor (390).**
- Above the fold: the H1 `NBA PAINT NIGHT`, the game line, the venue and the CTA block (no disclosure), then the About section.
- First and second scrolls: This game, Before you go, the rail, More NBA theme nights.

---

## 4. Promo sample: /nhl/chicago-blackhawks/promos/centennial-game

### Baseline differences

- **Main content:** identical apart from the Ticketmaster wrapper.
- **Head:** identical (`Centennial Game | Chicago Blackhawks Nov 17 | PromoNight`).
- **JSON-LD:** identical.
- **Pixels:** 0 at all three viewports. Heights are 4132 / 2921 / 2852 in both environments.
- **Measurements that moved:** none.

### Game date check

- Game line: `Tuesday, Nov 17, 2026 · 6:30 PM CT` (`dateTime="2026-11-17T18:30:00-06:00"`).
- JSON-LD `startDate`: `2026-11-17`.
- The page states CT, so America/Chicago applies: today is 2026-11-10 there too.
- **Verdict: upcoming, IN 7 DAYS.**

### Three things that work

1. The game line carries the zone (`CT`) and an offset `dateTime`.
2. `Get tickets` (144x52) goes to `ticketnetwork.lusg.net`, which redirects 302 to `www.ojrq.net`.
3. Rail card `SAT NOV 14 Stadium Ornament` lands on that H1, and back restores scroll at 1453 (delta 0) in both environments.

### Defects

- **G1 (Low, also on production).** `NIGHT` is 4.33:1, and there are 36 hit targets under 44.

### Measurements

| Measure | Production | Branch |
|---|---|---|
| CLS 390 / 768 / 1280 | 0.0001 / 0.0007 / 0.0002 | same |
| `<a>` to /promos/ DOM / visible | 19/17, 19/18, 19/18 | same |
| First ad anchor at 390 | 57 | 57 |
| Hit targets < 44 at 390 | 36 | 36 |
| axe serious/critical | color-contrast x1 | color-contrast x1 |
| Pixel diff | | 0 / 0 / 0 |

Screenshots: `SHOTS/centennial-game/{390,768,1280}-{production,branch,diff}.png`.

**First-time visitor (390).**
- Above the fold: the H1 `CENTENNIAL GAME`, Blackhawks vs Maple Leafs, the game line with CT, United Center and the CTA block, then About.
- First and second scrolls: This game, Before you go, the rail.

---

## 5. /cfb/rivalries (should be unchanged today)

### Baseline differences

- **Served main content (`<main>`, no `<article>`):** **identical**, 89,357 bytes cleaned in both environments.
- **Head:** identical. The title is `College Football Rivalry Week 2026: Nov 27-28 | PromoNight`, and the description reads `College football Rivalry Week 2026 is Friday, November 27 and Saturday, November 28. Dates and stadiums for its 16 games, plus all 32 rivalries by date.`
- **JSON-LD:** identical, all 3 blocks. The FAQ answer reads `... is Friday, November 27 and Saturday, November 28. 16 of the 32 rivalries tracked here are played on those days.` The ItemList is named `College Football Rivalries 2026`.
- **Pixels:** 0 at all three viewports. Heights are 7769 / 6803 / 6779 in both environments.
- **Measurements that moved:** none.

**Unchanged today, as expected.** The past-tense copy (`was`, `were`) cannot be seen in served HTML before 2026-11-29.

### Game date check

- There is no Event JSON-LD.
- Row dates run from Sep 19 to Nov 28. Rivalry Week is Fri Nov 27 and Sat Nov 28 (16 games).
- Today is 2026-11-10 in America/New_York (the page states no zone).
- **Verdict: not a played page.** Rivalry Week and the rest of November are upcoming. The September and October rows sit in the full date-ordered list, which is the page's purpose.

### Three things that work

1. The page is byte- and pixel-identical to production, so the tense change is inert before the window ends.
2. The H1, the lede, the meta description and the FAQ name the same two days and the same count (16).
3. The deep card `Illibuck` (Sep 26) at scroll 2360 lands on H1 `Illibuck 2026`, and back restores 2360 (delta 0) in both environments.

### Defects

All three are carried over from this morning's report and now on production. None is new on the branch.
- **R1 (Low, also on production).** The Rivalry Week dates are printed in the H1, the lede, the section subline and the day labels on one screen.
- **R4 (Low, also on production).** axe color-contrast (serious) x70: stadium names, `vs`, day counts, the section subline and `NIGHT`.
- **R5 (Low, also on production).** 23 hit targets under 44 at 390: `Open menu` 40x40, the logo, the crumb, the newsletter link and 19 footer links.

R3 from this morning (the ItemList name) is fixed on production: the list is named `College Football Rivalries 2026`.

### Measurements

| Measure | Production | Branch |
|---|---|---|
| CLS 390 / 768 / 1280 | 0 / 0.0006 / 0.0002 | same |
| `<a>` to /promos/ DOM / visible | 8/6, 8/7, 8/7 | same |
| First ad anchor at 390 | `main div[data-ad-region=content]` at 57 | 57 |
| Hit targets < 44 at 390 | 23 | 23 |
| axe serious/critical | color-contrast x70 | color-contrast x70 |
| Pixel diff | | 0 / 0 / 0 |

Screenshots: `SHOTS/cfb-rivalries/{390,768,1280}-{production,branch,diff}.png`.

**First-time visitor (390).**
- Above the fold: the crumb, the H1 `College Football Rivalry Week 2026: Nov 27-28`, the lede, `RIVALRY WEEK 2026 · 16 GAMES` with its date line, and the Fri Nov 27 group starting with the Egg Bowl.
- First and second scrolls: the rest of Nov 27, then Sat Nov 28, down to `ALL 32 RIVALRIES, IN DATE ORDER`.

---

## Recommendation

Make the disclosure say what the page already states as fact ("does not include it", not "may not"), and give its team-site link a 44px-tall hit area that is clear of `Also on Ticketmaster`. Those are the two package-page changes a fan acts on.

## Dispositions (merge rule, 2026-11-08)

Recorded by the branch session after the review. Screenshots stay outside the repo with the session's scratch files, as in the other 2026-11 reports.

| Item | Disposition | Reason |
|---|---|---|
| P1 team-site link 21px tall, 10px above "Also on Ticketmaster" | **fixed** | The link is an inline-flex box with a 44px minimum height, so its tap area no longer abuts the Ticketmaster link. |
| P2 "may not include it" while the FAQ and description say "does not include it" | waived | The disclosure is the ruled copy, word for word (ruling 2026-11-10, follow-up gate item 3). The ruling asked for no new claim beyond the card line; the wording question is the owner's, not a layout defect. |
| P3 the date tile stretches with the taller CTA column on package pages | deferred, known-issues 99 | Cosmetic; the tile's height follows the column by the section's existing items-stretch, on every page with a taller column. |
| P4 "Also on Ticketmaster" now follows the team-site link | waived | The ruling places the disclosure and its link directly under Get tickets; Also on Ticketmaster keeps its place after the block. |
| P5 the package fact stated four times in the first screen | waived | The disclosure is required by ruling under the CTA; the About block's lines are T3, present on production. |
| T2 Get tickets sells a standard ticket | resolved, known-issues 97 | The disclosure now sits under the button; the reviewer lowered it to Low. |
| T3 About block repeats itself; FAQ wording | waived | Present on production; stored package description, outside this diff. |
| T4 game time without a zone | waived | Present on production; the game-time zone work is held (2026-09-04). |
| N1 layout shift 0.031 on nba-paint-night | known-issues 82 | Present on production, identical on both; carried. |
| G1 logo contrast and sub-44px header and footer targets | known-issues 9 and 78 | Carried. |
| R1, R4, R5 on /cfb/rivalries | as dispositioned in 2026-11-10-fix-gsc-cleanup-2026-11.md | Carried; R3 is fixed on production. |
