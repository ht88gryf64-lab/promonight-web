# UX review: feature/fubo-cta, 2026-11-20

Baseline mode, branch against production, at 390x844, 768x1024 and 1280x800.

- **Branch:** `feature/fubo-cta` at `add2b55`, served by the branch dev server at http://localhost:3100 (`PROMO_PAGES_LIVE=true`). The dev server carries no `promonight-deploy` meta, so the commit comes from the worktree (`git rev-parse HEAD`).
- **Production:** https://www.getpromonight.com, `<meta name="promonight-deploy" content="dpl_C664ZyCFQswKPXRSs9d3AHRwDyGH">`. The branch base is main `d7183f4`. Nothing outside docs changed between `bc5b55b` and `d7183f4`, so production should run the same code as the branch base. This run did not map the deploy id to a commit.
- **Pages:** the promo page `/nhl/nashville-predators/promos/gold-game` (an explicit URL from the caller in place of the sitemap-resolved promo sample) and the team sample `/nhl/minnesota-wild`.
- **Run:** 2026-11-20, about 19:25 to 20:10 America/New_York.
- **Environment differences between the two renders.** These are not part of the diff:
  - `NEXT_PUBLIC_TICKETMASTER_IMPACT_WRAP` is not set on the dev server, so Ticketmaster links there are bare ticketmaster.com. Production wraps them through ticketmaster.evyy.net.
  - `NEXT_PUBLIC_EBAY_CAMPID` is not set on the dev server, so the "Missed it? Check resale on eBay" links do not render there.
  - `EVENTS_PAGES_LIVE` is off on the dev server, so the footer has no "Events" link there.
  - The Next dev-tools badge appears only in dev-server screenshots.
- **Pixel diffs** use a second render of each environment with ad hosts blocked (`<vp>-<env>-noads.png`), because Raptive fills differently on every load. The `<vp>-<env>.png` renders include ads.
- **Not covered:** the diff also changes `/promos/today` (`TodayPromoCard.tsx`). This run did not review it because the caller scoped the run to the two pages above.

---

## 1. Promo page: /nhl/nashville-predators/promos/gold-game

Screenshots are in `2026-11-20-feature-fubo-cta/promo-gold-game/`.

### Baseline differences

**Served HTML of `<article class="page-content">`** (deploy meta, build hashes, nonces and the RSC flight payload stripped). The two are **not identical**. There are two differing regions:

1. **The Fubo block (the expected change).** It is new on the branch, directly after "Also on Ticketmaster" inside the CTA `<section>` (article child 3):
   ```html
   <div data-fubo-cta="" class="flex flex-col items-center">
     <a href="/go/fubo/nhl/nhl-2026-11-21-pittsburgh-penguins-at-nashville-predators?s=web_promo_page&amp;t=nashville-predators"
        class="inline-flex min-h-11 items-center ..." target="_blank" rel="noopener noreferrer sponsored">Stream on Fubo</a>
     <p class="m-0 font-rd text-[12px] leading-[1.4] text-rd-ink-faint -mt-2">Availability varies by market.</p>
   </div>
   ```
2. **The "Also on Ticketmaster" href.** Production has `https://ticketmaster.evyy.net/c/7236189/264167/4272?u=...&sharedid=web_promo_page_nashville-predators&subId3=gold-game`. The branch has the bare `https://www.ticketmaster.com/nashville-predators-tickets/artist/805978`. This comes from the environment (the Impact wrap variable is unset on the dev server), not from the diff.

Other served-HTML findings:
- **Direct children of the article:** 11 in both environments. The diff adds no direct child.
- **Outside the article:** the footer has an "Events" link on production only (environment).
- **RSC payload:** it now also carries `gameId` and `broadcastNetwork` (`null` here) for the promo game. This is expected from the commit, and neither field is sensitive.

**Pixel comparison (ad hosts blocked)**

| Viewport | Differing px, raw | Where | After shifting the branch up 63 px below the CTA |
|---|---|---|---|
| 390 | 143,322 (8.92%) | 0 px in y 0 to 350. From y 351 down, everything below the Fubo line moves down 63 px. | 13,054 px of residue: 1 px sub-pixel row offsets, the dev-tools badge at about y 787 to 824, and the footer (Events link). No content change. |
| 768 | 180,750 (7.94%) | 202 px at y 325 to 350: the date tile's SAT/21/NOV re-centres in the taller tile. Then the 63 px shift. | 10,140 px, same causes |
| 1280 | 229,156 (6.23%) | Same as 768 | 12,963 px, same causes |

Diff images: `promo-gold-game/390-diff.png`, `promo-gold-game/768-diff.png`, `promo-gold-game/1280-diff.png`.

**Measurements that moved between the two renders**
- **CTA section height:** +63 px at every viewport.
- **Parking row:** y 391 → 454.
- **First Raptive in-content unit:** at 390, y 898 → 960. At 768 and 1280, y 801 → 863.
- **Document height without ads:** +29 px, which is +63 from the CTA section and −34 from the footer without the Events link.
- **Interactive elements at 390 without ads:** 53 in both. The branch gains the Fubo link and loses the footer Events link.
- **CLS with ads:**
  - 768: 0.0291 on the branch, 0.0575 on production.
  - 1280: 0.0002 on the branch, 0.0032 on production.
  - Without ads it is 0.0003 or less in both. The variation comes from ad fill, not from the diff.

### Game date check

- **Game line:** `<time dateTime="2026-11-21T17:00:00-06:00">Saturday, Nov 21, 2026 · 5:00 PM CT</time>`. The date tile reads "SAT 21 NOV, Tomorrow".
- **JSON-LD:** one Event, `startDate` `2026-11-21`.
- **Zone:** the page states CT (Bridgestone Arena, Nashville), so America/Chicago. Today there is **2026-11-20** (about 18:25 CST at run time).
- **Verdict:** **not played.** The game is tomorrow and the "Tomorrow" label is correct. The Fubo block is gated on `primary.date >= today`, so it will disappear once the date passes.

### First-time visitor (390, branch)

**Above the fold:**
- The breadcrumb, a THEME NIGHT pill, the "GOLD GAME" H1, "Nashville Predators vs Penguins", and "Saturday, Nov 21, 2026 · 5:00 PM CT" in bold.
- "Bridgestone Arena, Nashville".
- The CTA block: the date tile, a navy "Get tickets" button with Share, "Also on Ticketmaster", then "Stream on Fubo" with "Availability varies by market." under it, then Parking / Hotels / Remind me.
- "About this theme night" starts at the bottom of the screen.

**First scroll:** the About text, "This game" (opponent, other promos at this game, the home-game timeline), then the first in-content ad slot.

**Second scroll:** the Fan guide ("What to expect at a theme night"), an ad slot, and "Before you go" (transit, bag, parking, forecast).

The Fubo line pushes "This game" 63 px lower, so on production the opponent row shows at the fold and on the branch only the heading does.

### Specific checks

**A. Get tickets above the first in-content ad (390).** Yes, on both environments.

| y (document px, 390) | Branch | Production |
|---|---|---|
| "Get tickets" (TicketNetwork) button | 298 to 350 | 298 to 350 |
| "Also on Ticketmaster" | 360 to 381 | 360 to 381 |
| "Stream on Fubo" link box | 391 to 435 | n/a |
| "Availability varies by market." | 427 to 444 | n/a |
| Parking / Hotels row top | 454 | 391 |
| Bottom of the CTA section (article child 3) | 550 | 487 |
| First in-content unit `AdThrive_Content_1_phone` | **960** (after article child 5, "This game") | **898** (after article child 5) |
| First ad anchor (`article[data-ad-region=content]`) | 57 | 57 |

Raptive put its first content unit after child 5 in both environments. The Fubo block moved it down 62 px and did not change which child it follows. "Get tickets" sits 610 px above it on the branch and is the only commerce element above the fold that comes before any ad. Note that the 960 px ad starts below the 844 px fold in both environments.

**B. How much taller the CTA section is.**

| Viewport | Production | Branch | Change |
|---|---|---|---|
| 390 | 189 | 252 | +63 |
| 768 | 137 | 200 | +63 |
| 1280 | 137 | 200 | +63 |

The 63 px is the 53 px Fubo wrapper (a 44 px link plus the 17 px line, minus the 8 px overlap) plus the 10 px flex gap.

**C. Fubo link tap target and contrast (390).**
- **Box:** 101 x 44.
- **Effective tap area:** **101 x 35.** Only rows 0 to 34 of the 44 px box hit the link (79.5% of sampled points). The "Availability varies by market." `<p>` (`-mt-2`, x 172 to 322) lies over the bottom 8 to 9 px across the link's whole width (x 197 to 297) and takes those taps. This is the same at 768 and 1280.
- **Contrast:**
  - The link, #c62a1e on #f7f3ea: **5.06:1** (pass).
  - The line, #786e60 on #f7f3ea: **4.52:1**, a pass by 0.02.

**E. Copy.**
- **Link text:** exactly "Stream on Fubo". On the promo page it has no arrow.
- **Images:** 0 img, 0 svg and 0 picture inside `[data-fubo-cta]`.
- **Wording:** no price and no "free". The only other text is "Availability varies by market."
- **Link attributes:** `rel="noopener noreferrer sponsored"`, `target="_blank"`.

### Fan walk (390)

- **Date and time:** in the H1 block, "Saturday, Nov 21, 2026 · 5:00 PM CT".
- **Venue:** "Bridgestone Arena", linking to `/venues/bridgestone-arena`.
- **Primary CTA "Get tickets":** ticketnetwork.lusg.net → 302 → www.ojrq.net (Impact). The same in both environments.
- **The Fubo tap:** localhost:3100/go/fubo/... → **307** (`private, no-store`, `x-robots-tag: noindex`) → **www.fubo.tv**/stream/nhl/?irmp=7236189&irad=409363&sharedid=USA_Hockey_NHL_Pittsburgh-Penguins-at-Nashville-Predators&subId1=web_promo_page_nashville-predators. It opens in a new tab. On production `/go/fubo/...` is 404, as expected before merge.
- **Rail card:** "FRI NOV 27 GOLD Friday" goes to `/nhl/nashville-predators/promos/gold-friday`, whose H1 is "GOLD FRIDAY". It matches.
- **Back:** the scroll position is restored exactly (2541 → 2541 on the branch, 2608 → 2608 on production).

---

## 2. Team page: /nhl/minnesota-wild

Screenshots are in `2026-11-20-feature-fubo-cta/team-minnesota-wild/`.

### Baseline differences

**Served HTML of the article** (stripped as above). It is not byte-identical, and **none of the differences come from the diff**:
1. **9 Ticketmaster hrefs:** Impact-wrapped on production, bare on the branch (environment, the TM Impact wrap variable).
2. **2 "Missed it? Check resale on eBay" links:** present only on production, on the 2026-01-24 Kaprizov and 2025-12-21 Spurgeon bobblehead rows. This is the environment (`NEXT_PUBLIC_EBAY_CAMPID` is unset on the dev server).

The string "fubo" appears **0 times** in the branch HTML, including scripts and the flight payload. The Fubo link is not in the served HTML, as intended. Outside the article, only the footer "Events" link differs (environment).

**Pixel comparison (ad hosts blocked)**

| Viewport | Differing px, raw | Where |
|---|---|---|
| 390 | 299,702 (7.05%) | Above y 4808, only the dev-tools badge band at y 787 to 824 (927 px). From y 4808, the shift from the two production-only eBay links (+130 px on production). |
| 768 | 350,988 (5.31%) | The badge band at y 967 to 1004, then the eBay shift from y 4233 |
| 1280 | 428,181 (4.76%) | The badge band at y 743 to 780, then the eBay shift from y 3171 |

Diff images: `team-minnesota-wild/390-diff.png`, `team-minnesota-wild/768-diff.png`, `team-minnesota-wild/1280-diff.png`.

**Measurements that moved** all follow from the eBay environment difference:
- **Document height:** 12635 → 12505 at 390.
- **First content unit:** 6501 → 6405 at 390, 5884 → 5820 at 768, 4863 → 4799 at 1280.
- **Interactive elements at 390:** 117 → 112 (the eBay links and the Events link).

Everything else is equal.

### Game date check

- **Game line:** none; this is a team page. The expanded game reads "Saturday, November 21, at Vancouver Canucks, 8:00 PM PST".
- **JSON-LD:** 4 Events, `startDate` from 2026-11-25 to 2026-12-22.
- **Zone:** Grand Casino Arena, St. Paul; the page states CST, so America/Chicago. Today there is **2026-11-20**.
- **Verdict:** **not played**; the JSON-LD Events are upcoming.
- **The calendar's past cells do not show a played state.** Clicking any November date before the 20th opens the game as if it were still to come. See defects 1 and P1.

### First-time visitor (390, branch)

**Above the fold:**
- The dark green hero: "NHL · CENTRAL", the "MINNESOTA WILD" H1, "Promos & Giveaways 2026-27", Grand Casino Arena.
- Category tiles: 6 Giveaways, 0 Theme Nights, 0 Food Deals, 0 Kids & Family, 84 Scheduled Games.
- "6 promotions in the 2026-27 season, 4 still to come".
- The "Still to come" filter pills. A sticky outstream video ad covers the right half of the pills.

**First scroll:** the November 2026 calendar (home cells in pink, away cells in grey, category dots) and its legend.

**Second scroll:** the promo rows (Nov 25 Native American Heritage Night Hat, and others).

This is identical to production.

### Specific check D: the away-game expand (2026-11-21, at Vancouver)

The tray (`mt-4 space-y-4`) has these children in this order at all three viewports:

| Child | 390 | 768 | 1280 |
|---|---|---|---|
| GET TICKETS card (Ticketmaster 45 px, then TicketNetwork 43 px) | y 1368 to 1489 | 1509 to 1629 | 1457 to 1577 |
| `[data-fubo-cta]` "Stream on Fubo →" / "Availability varies by market." | 1505 to 1557 | 1645 to 1698 | 1593 to 1646 |
| FIND PARKING (SpotHero) | 1573 to 1638 | 1714 to 1779 | 1662 to 1727 |
| BOOK A HOTEL | 1654 to 1729 | 1795 to 1870 | 1743 to 1818 |
| View Vancouver Canucks full schedule | 1750 to 1783 | 1891 to 1908 | 1839 to 1855 |

- **Order:** tickets, then Fubo, then parking, at every viewport.
- **Spacing:** 16 px between every block, the same as the existing rhythm.
- **Overflow and wrap:**
  - The tray's scrollWidth equals its clientWidth: 266, 628 and 644.
  - The document scrollWidth equals the viewport width.
  - No descendant extends past the tray.
  - The link is one line (21 px text line inside a 44 px box) at 390, where the tray is 266 px wide.
- **The link:**
  - Box 120 x 44, but the **effective tap area is 120 x 35**, because the availability line (x 62 to 211) covers the bottom 9 rows across the link's whole width (x 62 to 182).
  - Contrast is 5.6:1 for the link and 5.0:1 for the line, on white.
  - Copy: "Stream on Fubo" plus an `aria-hidden` "→". No image, no price, no "free".
- **Home rows:** 2026-11-17 (vs Nashville) and 2026-11-25 (vs Utah) show no Fubo. The 2026-11-06 and 2026-11-07 cells show none either.
- **Production:** shows no Fubo on any row (`390-production-expand.png`).
- **The hop:** `/go/fubo/nhl/nhl-2026-11-21-minnesota-wild-at-vancouver-canucks?s=web_team_page&t=minnesota-wild` → 307 → www.fubo.tv/stream/nhl/ with `subId1=web_away_game_minnesota-wild_at_vancouver-canucks`.

Screenshots:
- `team-minnesota-wild/390-branch-expand-2026-11-21.png`
- `team-minnesota-wild/768-branch-expand.png`
- `team-minnesota-wild/1280-branch-expand.png`
- `team-minnesota-wild/390-branch-expand-2026-11-25.png` (home)
- `team-minnesota-wild/390-branch-expand-2026-11-17.png` (home)
- `team-minnesota-wild/390-branch-expand-2026-11-23.png` (an upcoming away game at San Jose, which shows Fubo correctly)

### Fan walk (390)

- **Primary CTA (the first visible "Get Tickets"):** ticketnetwork.lusg.net → 302 → www.ojrq.net. The same in both environments.
- **Promo row:** "Native American Heritage Night Hat" (Nov 25) goes to `/nhl/minnesota-wild/promos/native-american-heritage-night-hat`, whose H1 is "NATIVE AMERICAN HERITAGE NIGHT HAT". It matches.
- **Back:** scroll goes 2634 → 2816, **182 px off**, in both environments. This is pre-existing; see P2.

---

## Three things that work

1. **The promo placement is ad-neutral.**
   - The Fubo block lives inside article child 3, and the article keeps 11 direct children in both environments.
   - The first Raptive content unit still follows child 5 in both environments.
   - "Get tickets" (y 298) stays above the fold and 610 px above the first ad.
   - The only change in served article HTML that comes from the diff is the Fubo block.
2. **The team-page tray is clean at every width.**
   - The order is tickets, Fubo, parking, with a uniform 16 px rhythm, no overflow and no wrap.
   - Home rows never show the link, and the team page's served HTML is identical to production apart from environment noise, with 0 "fubo" bytes.
3. **The hop and the copy follow the rules.**
   - The hop is one 307 to www.fubo.tv with `private, no-store` and `noindex`.
   - The copy is text only, "Stream on Fubo" with "Availability varies by market.", with no logo, no price and no "free".
   - Contrast passes in both hosts: link 5.06:1 and 5.6:1, line 4.52:1 and 5.0:1.
   - Promo page: the game-date check ran and found the game upcoming, the "Tomorrow" tile is correct, and the Fubo block is gated on today. The rail card's H1 matches and the back-scroll is exact.

## Defects

Severity runs High, Medium, Low. Items 1 to 4 come from this diff. P1 to P5 are pre-existing and identical on production.

1. **HIGH: "Stream on Fubo" is offered on played away games (team page).**
   - Opening any past away cell shows "Stream on Fubo →" under the ticket card. Verified at 390 for 2026-11-01 (at Washington), 2026-11-03 (at Philadelphia), 2026-11-10 (at Montreal) and 2026-11-12 (at Toronto). Today is 2026-11-20.
   - The row guard is `game.status === 'scheduled'`. Every game in the team page's payload carries `status: "scheduled"`, including all 28 games dated before 2026-11-20 (18 of them away games), so the guard never excludes a played game.
   - The hop also answers 307 for a played game (`/go/fubo/nhl/nhl-2026-11-12-minnesota-wild-at-toronto-maple-leafs` → www.fubo.tv).
   - This sends a fan to stream a game that ended days ago, through an affiliate link.
   - Screenshots: `team-minnesota-wild/390-branch-expand-2026-11-12.png`; production for comparison: `team-minnesota-wild/390-production-expand-2026-11-12.png`.
2. **MEDIUM: the effective tap area of the Fubo link is 35 px, not 44.**
   - The "Availability varies by market." line is pulled up 8 px (`-mt-2`), lies over the bottom of the 44 px link box across its full width, and takes those taps.
   - Measured: promo 101 x 35 at all viewports; team tray 120 x 35 at all viewports. Only 79.5% of the box hits the link.
   - Screenshots: `promo-gold-game/390-branch.png`, `team-minnesota-wild/390-branch-expand-2026-11-21.png`.
3. **LOW: on the promo page the Fubo line reads as a detached block, and the date tile grows with it.**
   - There are 25 px from the bottom of the "Also on Ticketmaster" text to the top of the "Stream on Fubo" text, against 10 px between "Get tickets" and "Also on Ticketmaster". The 44 px box centres a 15 px line.
   - The date tile stretches 63 px, and at 768 and 1280 its SAT/21/NOV contents visibly re-centre (202 px diff at y 325 to 350), leaving the tile mostly empty.
   - All viewports. Screenshots: `promo-gold-game/768-branch.png` against `promo-gold-game/768-production.png`.
4. **LOW: the team tray's Fubo entry has no section label.**
   - Each other block in the tray has a small icon plus a mono caps label (GET TICKETS, FIND PARKING, BOOK A HOTEL). The Fubo link sits unlabelled between them, so it reads as a third line of the ticket block, not as a separate "watch it" option.
   - All viewports. Screenshot: `team-minnesota-wild/768-branch-expand.png`.

**Pre-existing (identical on production; not caused by this diff):**

- **P1 (MEDIUM): played away rows on the team page still offer Get Tickets, SpotHero parking and a hotel search** for the played date, for example 2026-11-12 at Toronto. Defect 1 adds Fubo to the same rows. Screenshot: `team-minnesota-wild/390-production-expand-2026-11-12.png`.
- **P2 (MEDIUM): team page back navigation restores scroll 182 px off** (2634 → 2816) at 390, in both environments. The allowed error is 50 px.
- **P3 (LOW): the "NIGHT" wordmark in the header is #da2d20 on #f7f3ea, 4.33:1.** axe reports it as serious color-contrast on both pages and in both environments.
- **P4 (LOW): small tap targets in the promo article at 390.** The worst cases:
  - "Also on Ticketmaster" 133 x 21
  - Breadcrumb "NHL" 24 x 18
  - "nhl.com" 43 x 14
  - "wegotransit.com ›" 91 x 12
  - "bridgestonearena.com ›" 121 x 12 (twice)
  - "Bridgestone Arena" 124 x 16
  - "Bridgestone Arena gameday guide" 328 x 21

  On the whole page, 35 of 53 interactive elements are under 44 on the branch and 36 of 53 on production.
- **P5 (LOW): team page axe and contrast findings.**
  - axe `label-content-name-mismatch` (serious): 6 nodes at 390, 16 at 768 and 1280. Among them are the hero Ticketmaster and SpotHero cards and the calendar day buttons, whose visible number is not in "2026-11-xx details".
  - Contrast failures: a purple "→" at 2.72:1 on white and a grey "›" at 3.14:1.

## Measurements

Promo page, `/nhl/nashville-predators/promos/gold-game`:

| Measure | 390 branch | 390 prod | 768 branch | 768 prod | 1280 branch | 1280 prod |
|---|---|---|---|---|---|---|
| CTA section height | 252 | 189 | 200 | 137 | 200 | 137 |
| Get tickets y | 298 to 350 | 298 to 350 | 298 to 350 | 298 to 350 | 298 to 350 | 298 to 350 |
| Fubo link box / effective | 101x44 / 101x35 | n/a | 101x44 / 101x35 | n/a | 101x44 / 101x35 | n/a |
| Fubo link y / line y | 391 to 435 / 427 to 444 | n/a | same | n/a | same | n/a |
| CTA section bottom | 550 | 487 | 498 | 435 | 498 | 435 |
| First in-content ad top | 960 | 898 | 863 | 801 | 863 | 801 |
| First ad anchor (article data-ad-region) | 57 | 57 | 57 | 57 | 57 | 57 |
| Fubo contrast link / line | 5.06 / 4.52 | n/a | 5.06 / 4.52 | n/a | 5.06 / 4.52 | n/a |
| Hit targets under 44 (no ads) | 35/53 | 36/53 | 40/58 | 41/58 | 40/58 | 41/58 |
| Text under 4.5:1 | 1 (NIGHT) | 1 | 1 | 1 | 1 | 1 |
| axe serious/critical | color-contrast x1 | same | same | same | same | same |
| CLS, with ads / without ads | 0.0001 / 0.0001 | 0.0001 / 0.0000 | 0.0291 / 0.0003 | 0.0575 / 0.0000 | 0.0002 / 0.0002 | 0.0032 / 0.0002 |
| `<a>` to /promos/, DOM / visible | 20/18 | 20/18 | 20/19 | 20/19 | 20/19 | 20/19 |
| Document height without ads | 4120 | 4091 | 2965 | 2936 | 2876 | 2847 |
| Horizontal overflow | none | none | none | none | none | none |

Team page, `/nhl/minnesota-wild`:

| Measure | 390 branch | 390 prod | 768 branch | 768 prod | 1280 branch | 1280 prod |
|---|---|---|---|---|---|---|
| First ad anchor (article data-ad-region) | 672 | 672 | 599 | 599 | 520 | 520 |
| First in-content ad top | 6405 | 6501 | 5820 | 5884 | 4799 | 4863 |
| Hit targets under 44 | 86/112 | 90/117 | 61/117 | 65/126 | 61/117 | 65/128 |
| Text under 4.5:1 | 3 | 3 | 3 | 3 | 3 | 3 |
| axe serious/critical | contrast 1, label-name 6 | same | contrast 1, label-name 16 | same | contrast 1, label-name 16 | same |
| CLS with ads | 0.0000 | 0.0000 | 0.0000 | 0.0073 | 0.0000 | 0.0101 |
| `<a>` to /promos/, DOM / visible | 37/26 | 37/26 | 37/27 | 37/27 | 37/27 | 37/27 |
| Fubo in served HTML | 0 | 0 | 0 | 0 | 0 | 0 |
| Tray order (expand 11-21) | TN/TM, Fubo, parking | no Fubo | same | no Fubo | same | no Fubo |
| Tray overflow / wrap | none / none | n/a | none / none | n/a | none / none | n/a |
| Fubo box / effective | 120x44 / 120x35 | n/a | 120x44 / 120x35 | n/a | 120x44 / 120x35 | n/a |
| Back-scroll error | 182 px | 182 px | not measured | not measured | not measured | not measured |

## Recommendation

Hold the merge until defect 1 is fixed. On the team page the link must depend on the game's date against today in the venue's zone, not on `status`, which reads "scheduled" for every played game in the payload. Until then the new affiliate link appears on every played away game in the Wild's payload (18, preseason included). The same guard runs on every NFL, NBA and NHL team page; this run verified the Wild only.

---

# Round 2: 5d97fee, 2026-11-20

Baseline mode, branch against production, at 390x844, 768x1024 and 1280x800.

- **Branch:** `feature/fubo-cta` at `5d97fee`, on the hot-reloaded dev server at http://localhost:3100. The dev server carries no deploy meta. The change from round 1 touches `FuboCTA.tsx`, `GameExpand.tsx`, `src/lib/affiliates/fubo.ts` (`fuboGamePlayed`), the `/go/fubo` route, and tests.
- **Production:** `dpl_C664ZyCFQswKPXRSs9d3AHRwDyGH`, unchanged since round 1.
- **Run time:** about 19:42 to 20:00 America/New_York.
- **Correction to round 1:** its header gives the run as "about 19:25 to 20:10". Round 1 actually ran about 19:23 to 19:40.
- **Pages:**
  - Promo `/nhl/nashville-predators/promos/gold-game`
  - Team `/nhl/minnesota-wild`
  - Aggregator `/promos/today` (new this round)
- **Screenshots:** written outside the repo, under
  `/private/tmp/claude-501/-Users-mattkovalik-promonight-web/0d155f60-51e9-4635-86ac-1a347175841c/scratchpad/uxr/round2/` (called `R2/` below). Subfolders are `promo-gold-game/`, `team-minnesota-wild/` and `promos-today/`. Each has `<vp>-<env>.png` (with ads), `<vp>-<env>-noads.png`, `<vp>-<env>-fold.png` and `<vp>-diff.png`.
- **Environment differences:** the same as round 1. The dev server has no Ticketmaster Impact wrap, no eBay campid, and `EVENTS_PAGES_LIVE` off (so no footer "Events" link). The dev-tools badge appears in dev screenshots.

## R2.1 Baseline differences

**Served HTML.** The deploy meta, hashes, nonces and flight payload are stripped. The Ticketmaster Impact wrap, which comes from the environment, is normalised away.

- **Promo article.** The Fubo block differs, now `<div data-fubo-cta="" class="-mt-2 flex flex-col items-center">` with the `<p>` carrying no `-mt-2`. The only other difference is the forecast stamp: "updated Nov 20, 2:11 PM CT" on production against "6:06 PM CT" on the branch. That stamp is a clock surface, not this diff. The article still has 11 direct children in both environments.
- **Team page.** Identical apart from the two production-only eBay links (environment). The string "fubo" appears 0 times in the branch HTML.
- **`/promos/today`** (`main`; the page has no `<article>`).
  - It differs by **16 `[data-fubo-cta]` blocks**, one under each card's CTA row: 7 NBA and 9 NHL cards. Production has 0.
  - **One difference does not come from the diff:** the Calgary Flames "NextGen Game" card (Nov 21, vs Blackhawks) reads **2:30 PM on production and 1:30 PM on the branch**. The promo page `/nhl/calgary-flames/promos/nextgen-game` and the Calgary team page show the same split.
    - Production: `<time dateTime="2026-11-21T14:30:00-06:00">… 2:30 PM MDT`.
    - Branch: `…T13:30:00-07:00 … 1:30 PM MT`.
    - Both are the same instant (20:30Z), and Calgary is UTC−7 in November. Production shows the wall-clock time an hour late, with a −06:00 offset and an "MDT" label.
    - None of those surfaces' time code is in this diff, and the diff's join change only fills an empty stored time. This is finding **O1** below.

**Pixel comparison, with ads blocked**

| Page | 390 | 768 | 1280 |
|---|---|---|---|
| Promo | 143,277 px (8.92%) | 180,723 (7.94%) | 229,169 (6.23%) |
| Team | 299,702 (7.05%) | 350,947 (5.31%) | 428,181 (4.76%) |
| /promos/today | 709,978 (28.24%) | 935,953 (21.65%) | 1,407,162 (19.89%) |

- **Promo page:**
  - At 390 rows y 0 to 350 are identical. At 768 and 1280, 202 px differ at y 325 to 350; this is the date tile re-centring.
  - Everything below y 351 moves down 63 px. After compensating for that shift, the residue is 13,129 px at 390, 10,218 at 768 and 13,051 at 1280. It is sub-pixel offset, the dev badge and the footer.
  - Diff images: `R2/promo-gold-game/{390,768,1280}-diff.png`.
- **Team page:** only the dev-badge band, until the shift from the production-only eBay rows. Diff images: `R2/team-minnesota-wild/{390,768,1280}-diff.png`.
- **/promos/today:**
  - From the first card down, each card is offset by 48 px (4 px margin plus the 44 px Fubo line), so everything below differs.
  - Document height without ads: 6447 against 5713 at 390. That is +734 px: 16 x 48 = 768, minus 34 for the footer Events link.
  - Diff images: `R2/promos-today/{390,768,1280}-diff.png`.

**Measurements that moved** (only the changes; the full numbers are in R2.7):

- **Promo page:**
  - The Fubo link moved from y 391 to 435 up to y 383 to 427.
  - The availability line stays at 427 to 444, but now sits directly under the link with no overlap.
- **Team tray:** the Fubo block grew from 53 to 84 px (eyebrow added). Every block below it moves down 31 px.
- **/promos/today:**
  - +48 px per card.
  - The first content ad drops by 768 px at every viewport: from 4200 to 4968 at 390, 4166 to 4934 at 768, and 4106 to 4874 at 1280.
  - Interactive elements without ads at 390: 124 on the branch against 109 on production.
  - axe color-contrast nodes at 390: 113 on the branch against 89 on production. All 24 extra nodes are Fubo text on dimmed cards (N1).

## R2.2 Game date check

- **Promo:** the game line `<time dateTime="2026-11-21T17:00:00-06:00">` and the JSON-LD `startDate` `2026-11-21` agree. In America/Chicago today is 2026-11-20 (18:52 CST at check time), so the game is **not played**.
- **Team:** the JSON-LD Events run 2026-11-25, 11-27, 12-12 and 12-22, so the page is **not played**.
  - Played away cells (Nov 1, 3, 10 and 12) **no longer show Fubo**.
  - They still show tickets, parking and hotel (P1, the same as production).
- **/promos/today:**
  - The page has no JSON-LD Event and no `<time>`.
  - Card dates are Nov 20 (today) and Nov 21 (tomorrow). Today in America/New_York is 2026-11-20, so it is **not played**.
  - Several of tonight's 7 PM ET games were already in progress at check time. Offering a stream for a game in progress is consistent with the "the game's own day still counts" rule.

## R2.3 Verifying each round 1 fix

**Defect 1: played games.**
- 390, branch:

  | Cell | Opponent | Fubo |
  |---|---|---|
  | 11-01 | at Washington | absent |
  | 11-03 | at Philadelphia | absent |
  | 11-10 | at Montreal | absent |
  | 11-12 | at Toronto | absent |
  | 11-21 | at Vancouver | **present** |
  | 11-23 | at San Jose | **present** |
  | 11-25 | vs Utah, home | absent |

- 768 and 1280: 11-12 absent, 11-21 present.
- Screenshots: `R2/team-minnesota-wild/390-branch-expand-2026-11-12.png`, `R2/team-minnesota-wild/390-branch-expand-2026-11-21.png`, plus the 768 and 1280 files with the same names.
- The hop for the played 11-12 game, `HEAD /go/fubo/nhl/nhl-2026-11-12-minnesota-wild-at-toronto-maple-leafs?s=web_team_page&t=minnesota-wild`, answers **307** with `cache-control: private, no-store` and `x-robots-tag: noindex`. It goes to `https://www.fubo.tv/stream/nhl/?irmp=7236189&irad=409363&subId1=web_away_game_minnesota-wild_at_toronto-maple-leafs`, the league landing, with **no `sharedid`**.
- The hop for the upcoming 11-21 game still carries `sharedid=USA_Hockey_NHL_Minnesota-Wild-at-Vancouver-Canucks`.
- **Fixed.**

**Defect 2: tap target.**

| Host | Box | Effective tap area | Note |
|---|---|---|---|
| Promo | 101x44 | 43 of 44 integer rows (97.7%) at every viewport | The line's top (426.75) now equals the link's bottom (426.75); zero overlap. The one row lost is the 0.75 px sub-pixel offset the wrapper's `-mt-2` introduces. Round 1 was 35 rows (79.5%). |
| Team tray | 120x44 | 44 of 44 rows (100%) at 390, 768 and 1280 | |
| /promos/today | 111x44 | 44 of 44 rows (100%) on all 16 links at every viewport | Line on the same row, to the right (x 135 at 390) |

**Fixed.**

**Defect 3: the gap above "Stream on Fubo" and the date tile.**
- Text-to-text gap from "Also on Ticketmaster" to "Stream on Fubo": **17 px**. It was 25 px in round 1; "Get tickets" to "Also on Ticketmaster" is 10 px.
- **CTA section growth against production is still +63 px at every viewport:**

  | Viewport | Production | Branch |
  |---|---|---|
  | 390 | 189 | 252 |
  | 768 | 137 | 200 |
  | 1280 | 137 | 200 |

  The wrapper's `-mt-2` gave back the 8 px that removing the line's overlap added.
- **The date tile still stretches.** Its content is 91 px in both environments, with this padding above and below it:

  | Viewport | Tile, production | Padding, production | Tile, branch | Padding, branch |
  |---|---|---|---|---|
  | 390 | 189 | 49 / 49 | 252 | 80 / 80 |
  | 768 and 1280 | 137 | 23 / 23 | 200 | 54 / 54 |

  SAT/21/NOV still re-centres at 768 and 1280: 202 px differ at y 325 to 350.
- **Get tickets is above the first in-content ad at 390: yes.**

  | | Branch | Production |
  |---|---|---|
  | Get tickets | y 298 to 350 | y 298 to 350 |
  | `AdThrive_Content_1_phone` | y **960**, after article child 5 ("This game") | 898, after child 5 |

  The ad is 610 px below the button and below the 844 px fold.
- Screenshot: `R2/promo-gold-game/390-cta-side-by-side.png` (branch left, production right).
- **The gap is reduced but still uneven; the tile stretch is unchanged. Still open, Low.**

**Defect 4: tray eyebrow.**
- "STREAM THE GAME" matches the other eyebrows: DM Mono, 10 px, 1.5 px tracking, uppercase, weight 400, and `rgb(239,68,68)`, the same red as GET TICKETS and FIND PARKING (BOOK A HOTEL is purple).
- Eyebrow text to first-link text is 20 px, against 21 to 22 px for the others.
- The tray rhythm is still a uniform 16 px between blocks.
- Order is tickets, then STREAM THE GAME / Fubo, then FIND PARKING, then BOOK A HOTEL, at 390, 768 and 1280.
- No overflow: the tray's scroll width equals its client width (266, 628 and 644).
- **Fixed.** One residual is listed as N2.

## R2.4 /promos/today (new this round)

**First-time visitor at 390 (branch):**
- **Above the fold:** the dark hero, "LIVE · UPDATED DAILY", "SPORTS PROMOS TODAY", "Friday, November 20" in red, and "4 games today have promotions across NBA: …". Then the ALL / NBA / NHL pills, "NBA · 4 promos / NBA hub →", and the first card (Bulls Cup Night, vs Wizards). Its Ticketmaster / TicketNetwork / SpotHero row and the "Stream on Fubo → Availability varies by market." line (y 759 to 803) both fit above the fold.
- **First scroll:** the remaining NBA cards for tonight (Cup Night vs Hornets, Cup Nights vs Raptors, Shock Night vs Raptors), each with its CTA row and Fubo line. Then "TOMORROW · Saturday, November 21".
- **Second scroll:** tomorrow's NBA cards (Hispanic Heritage Night, Kings x Queen patch, Queen Night), dimmed to 70% opacity, each with its own Fubo line.
- Screenshots: `R2/promos-today/390-branch-noads-card.png`, `R2/promos-today/390-branch-noads-tomorrow-crop.png`.

**Fubo line:**

| Measure | Result |
|---|---|
| Link | "Stream on Fubo →" (arrow `aria-hidden`), 13 px semibold |
| Availability line | 12 px, on the same row to the right at every viewport (16 of 16) |
| Images in the block | none (img, svg and picture count 0) |
| Price, "free" | neither appears |
| Tap target | 111x44, 100% hit, on all 16 at 390, 768 and 1280 |
| Contrast, today's cards (full opacity) | link 5.06:1, line 4.52:1 (on #f7f3ea) |
| Contrast, tomorrow's cards (`opacity-70`, 12 of 16 lines) | **link 3.22:1 (#d5665b), line 2.64:1 (#9e9689)** per axe. Both fail (N1). |

**Spacing, the same at all three viewports:**

| Gap | Size |
|---|---|
| CTA row bottom to Fubo link box | 4 px (`mt-1`) |
| CTA row bottom to link text | 16 px |
| Fubo block bottom to next card | 16 px |

On production the CTA row bottom to the next card is also 16 px, so the rhythm between cards is kept. The 171 and 71 px values are section breaks.

**Inline CTA row:**
- On all 16 rows: one line, 40 px tall, no wrap, at every viewport and in both environments.
- Document scroll width equals the viewport.
- The diff does not change the row.

**Served HTML against production:** the 16 Fubo blocks only, plus the environment's Ticketmaster wrap, plus the O1 time difference, which does not come from the diff.

**First in-content ad at 390:**
- `AdThrive_Content_1_phone` lands after the TOMORROW section, after all 16 cards, in both environments: y **4968** on the branch against 4200 on production.
- The first card's ticket row is at y 715 to 755 in both. The ad is 4,213 px below that row on the branch, against 3,445 on production.
- First ad anchors: `div[data-ad-region=content]` at y 57 and the first `data-ad-item` at 526, the same in both environments.

**CLS with ads blocked:**

| Viewport | Branch | Production |
|---|---|---|
| 390 | 0.0001 | 0.0001 |
| 768 | 0.0002 | 0.0003 |
| 1280 | 0.0001 | 0.0001 |

With ads, branch / production: 0.0001 / 0.0001 at 390, 0.0002 / 0.0070 at 768, 0.0001 / 0.0001 at 1280.

**Fan walk at 390:**
- **Date:** in the hero, "Friday, November 20".
- **Venue:** the card eyebrow. There is no venue name on the cards beyond the opponent line.
- **Primary CTA:** the first card's Ticketmaster. On production it goes ticketmaster.evyy.net → 301 → www.ticketmaster.com. On the branch it is bare ticketmaster.com (environment).
- **Fubo:** `/go/fubo/nba/nba-2026-11-20-washington-wizards-at-chicago-bulls?s=web_today&t=chicago-bulls` → 307 → www.fubo.tv/stream/nba/ with `sharedid=USA_Basketball_NBA_Washington-Wizards-at-Chicago-Bulls`.
- **Card:** "Bulls Cup Night" goes to `/nba/chicago-bulls/promos/bulls-cup-night`, whose H1 is "BULLS CUP NIGHT". It matches.
- **Back:** scroll restored exactly (120 → 120) in both environments.

## R2.5 Promo and team pages, other re-checks

- **Promo walk:** the rail card "GOLD Friday" has a matching H1, and the back-scroll error is 0 px.
- **Team walk:** the back-scroll is still 182 px off (2634 → 2816). This is P2, the same as production.
- **Promo, both environments:** axe still finds only the NIGHT color-contrast issue. `<a>` to /promos/ is 20/18 at 390, and there is no overflow.
- **Team, both environments:** axe finds color-contrast 1 and label-content-name-mismatch 6 at 390 (16 at 768 and 1280). `<a>` to /promos/ is 37/26.
  - Production's 768 run with ads also reported `aria-command-name`, `frame-title` and `image-alt`. All three are on Raptive iframes and absent without ads.

## R2.6 New findings this round

- **N1, MEDIUM: Fubo text fails contrast on tomorrow's dimmed cards (/promos/today).**
  - Cards in the TOMORROW section render at `opacity-70`. On those 12 cards the Fubo link is #d5665b on #f7f3ea at **3.22:1** and the availability line is #9e9689 at **2.64:1**.
  - These are 24 new axe serious nodes (113 against 89).
  - All viewports. Screenshot: `R2/promos-today/390-branch-noads-tomorrow-crop.png`.
  - The dimming fails for the cards' existing text too (P6). This is new failing text that the diff adds.
- **N2, LOW: the tray eyebrow "STREAM THE GAME" is the only one without an icon.**
  - Its text starts 19 px left of the text of GET TICKETS, FIND PARKING and BOOK A HOTEL, at the icon column, at 390, 768 and 1280.
  - Screenshot: `R2/team-minnesota-wild/390-branch-expand-2026-11-21.png`.
- **N3, LOW: the same game's Fubo line repeats on consecutive cards (/promos/today).**
  - Three games have two promos, so each gets an identical "Stream on Fubo" line: Pistons vs Raptors (Cup Nights, Shock Night), Kings vs Celtics (Kings x Queen patch, Queen Night), and Predators vs Penguins (GOLD Game, Hometown Remix Night Luggage Tag).
  - This mirrors the ticket rows, which also repeat per card.
  - Screenshots: `R2/promos-today/390-branch-noads-tomorrow-crop.png` and `R2/promos-today/390-branch.png`.
- **O1, MEDIUM, outside this diff: production shows Calgary's Nov 21 game an hour late.**
  - Production shows "2:30 PM MDT" (`2026-11-21T14:30:00-06:00`) on `/nhl/calgary-flames/promos/nextgen-game`, the Calgary team page and the `/promos/today` card.
  - The branch dev server renders "1:30 PM MT" (`T13:30:00-07:00`). That is the correct local time for the same instant; Calgary is on MST, UTC−7, in November.
  - The diff does not touch these surfaces' time code, and the cause was not determined in this run (stale cached render, data, or server environment).
- **P6, LOW, pre-existing:** tomorrow's dimmed cards on `/promos/today` fail contrast for their existing text on production and the branch alike: NOV/SAT/"vs" 2.75:1, SpotHero 2.78:1, Giveaways 2.79:1, Theme Nights 3.7:1.

## R2.7 Measurements, round 2

| Measure | 390 branch | 390 prod | 768 branch | 768 prod | 1280 branch | 1280 prod |
|---|---|---|---|---|---|---|
| Promo: CTA section height | 252 | 189 | 200 | 137 | 200 | 137 |
| Promo: Get tickets y | 298 to 350 | 298 to 350 | 298 to 350 | 298 to 350 | 298 to 350 | 298 to 350 |
| Promo: Fubo link / line y | 383 to 427 / 427 to 444 | n/a | same | n/a | same | n/a |
| Promo: Fubo effective tap | 101x43 (box 44) | n/a | 101x43 | n/a | 101x43 | n/a |
| Promo: TM text to Fubo text | 17 px | n/a | 17 | n/a | 17 | n/a |
| Promo: date tile padding above / below | 80/80 | 49/49 | 54/54 | 23/23 | 54/54 | 23/23 |
| Promo: first content ad | 960 | 898 | 863 | 801 | 863 | 801 |
| Promo: Fubo contrast link / line | 5.06 / 4.52 | n/a | same | n/a | same | n/a |
| Team: Fubo on 11-21 / 11-12 | yes / no | no / no | yes / no | n/a | yes / no | n/a |
| Team: tray Fubo block height | 84 | n/a | 84 | n/a | 84 | n/a |
| Team: Fubo effective tap | 120x44 | n/a | 120x44 | n/a | 120x44 | n/a |
| Team: Fubo contrast link / line (white) | 5.6 / 5.0 | n/a | same | n/a | same | n/a |
| Today: Fubo blocks / cards | 16/16 | 0/16 | 16/16 | 0/16 | 16/16 | 0/16 |
| Today: Fubo effective tap | 111x44 (16 of 16) | n/a | same | n/a | same | n/a |
| Today: contrast, today's cards / tomorrow's cards (link) | 5.06 / 3.22 | n/a | same | n/a | same | n/a |
| Today: row → Fubo text / Fubo → next card | 16 / 16 | n/a | 16 / 16 | n/a | 16 / 16 | n/a |
| Today: CTA row wrap / page overflow | none / none | none / none | none / none | none / none | none / none | none / none |
| Today: first ad top (first ticket row 715 to 755 at 390, 665 to 705 wider) | 4968 | 4200 | 4934 | 4166 | 4874 | 4106 |
| Today: CLS without ads | 0.0001 | 0.0001 | 0.0002 | 0.0003 | 0.0001 | 0.0001 |
| Today: axe color-contrast nodes | 113 | 89 | 113 | 89 | 113 | 89 |
| Today: `<a>` to /promos/, DOM / visible | 25/23 | 25/23 | 25/24 | 25/24 | 25/24 | 25/24 |
| Today: hit targets under 44 (no ads) | 92/124 | 93/109 | 97/129 | 98/114 | 97/129 | 98/114 |

## R2.8 Disposition

| # | Defect | Severity | Status at 5d97fee | Evidence |
|---|---|---|---|---|
| 1 | Fubo on played away games (team page) | High | **Fixed** | 11-01, 11-03, 11-10 and 11-12 show no Fubo at 390 (11-12 also at 768 and 1280). 11-21 and 11-23 do. The 11-12 hop 307s to `fubo.tv/stream/nhl/` with no `sharedid`. |
| 2 | Effective tap area 35 px | Medium | **Fixed** | Promo 101x43 of a 44 box, with line top = link bottom (0 px overlap; the 1 row is sub-pixel). Tray 120x44 at 100%. /today 111x44 at 100% on 16 of 16. |
| 3a | Gap above "Stream on Fubo" (promo) | Low | **Still open** | Reduced from 25 to 17 px text-to-text, against 10 px between Get tickets and "Also on Ticketmaster". |
| 3b | Date tile stretch (promo) | Low | **Still open** | The tile is still +63 px at every viewport (252 against 189 at 390; 200 against 137 at 768 and 1280). The 91 px of content sits in 80/80 px of padding against 49/49 at 390, and re-centres at 768 and 1280. |
| 4 | No label on the tray's Fubo block | Low | **Fixed** | "STREAM THE GAME" matches the font, size, tracking, case and color of the other eyebrows; 20 px against 21 to 22 px to the first link. |
| N1 | Fubo text on dimmed tomorrow cards fails contrast (/promos/today) | Medium | **Open (new)** | Link 3.22:1 and line 2.64:1 on 12 of 16 cards; +24 axe nodes. |
| N2 | Tray eyebrow has no icon; text 19 px left of the others | Low | **Open (new)** | All three viewports |
| N3 | Identical Fubo line repeated for the same game on consecutive cards (/promos/today) | Low | **Open (new)** | 3 games, 6 cards. Mirrors the ticket rows. |
| O1 | Production shows Calgary Nov 21 at 2:30 PM MDT (−06:00); correct is 1:30 PM MT | Medium | **Open, outside this diff** | Production and the branch differ on surfaces this diff does not touch. Needs its own investigation and a known-issues entry. |
| P1 | Played away rows offer tickets, parking and hotels | Medium | Pre-existing, identical on production, outside this diff: waived for this merge, listed on the deferred list | `R2/team-minnesota-wild/390-branch-expand-2026-11-12.png` |
| P2 | Team back-scroll 182 px off | Medium | Pre-existing, identical on production, outside this diff: waived for this merge, listed on the deferred list | 2634 → 2816 in both environments |
| P3 | "NIGHT" wordmark 4.33:1 | Low | Pre-existing, identical on production, outside this diff: waived for this merge, listed on the deferred list | All three pages, both environments |
| P4 | Small tap targets in the promo article | Low | Pre-existing, identical on production, outside this diff: waived for this merge, listed on the deferred list | The same list as round 1. The Fubo link is not among them. |
| P5 | Team axe label-content-name-mismatch and contrast on → and › | Low | Pre-existing, identical on production, outside this diff: waived for this merge, listed on the deferred list | 6 nodes at 390, 16 at 768 and 1280; 2.72 and 3.14:1 |
| P6 | Dimmed tomorrow cards' existing text fails contrast (/promos/today) | Low | Pre-existing, identical on production, outside this diff: waived for this merge, listed on the deferred list | 89 axe nodes on production |

## R2.9 Recommendation

Fix N1 before merge. The diff adds 24 failing text nodes to every `/promos/today` render whose tomorrow section has NBA, NHL or NFL cards. Either keep the Fubo line out of the dimmed layer, or show it only on today's cards. 3a, 3b, N2 and N3 are cosmetic and can be waived in this report with a reason. O1 needs its own known-issues entry whatever happens to this branch.

# Author's dispositions (after round 2)

Written by the build session, not the reviewer. The N1 fix is verified in the
served HTML and by computation, not by a third review run: its contrast
figures are the WCAG formula over the opacity-composited colour, not an axe
measurement.

| # | Disposition | Reason / evidence |
|---|---|---|
| 1 | **Fixed** (5d97fee) | Reviewer, round 2 (R2.8). |
| 2 | **Fixed** (5d97fee) | Reviewer, round 2 (R2.8). |
| 4 | **Fixed** (5d97fee) | Reviewer, round 2 (R2.8). |
| N1 | **Fixed** (commit after 5d97fee, "dimmed cards") | On a dimmed card (`opacity-70`) the Fubo link and availability line take `text-rd-ink` (#211d18) instead of `text-rd-link` / `text-rd-ink-faint`. Composited at 70% over the cream ground (#f7f3ea) that is 5.89:1 for both (the red link composites to 3.22:1, the faint line to 2.64:1). Served `/promos/today` on the dev server: 16 Fubo blocks, 12 inked (the Tomorrow cards), 4 red (today's). Today's cards are unchanged at 5.06:1 and 4.52:1. Test: `fubo-placement.test.tsx`, "a dimmed (Tomorrow) card inks...". Keeping the line inside the dimmed layer keeps it no brighter than the ticket row above it. |
| 3a | **Waived** | 17 px text-to-text against 10 px between Get tickets and "Also on Ticketmaster". The difference is the Fubo link's 44 px hit area (min-h-11), which "Also on Ticketmaster" (21 px, P4) does not have. Closing the gap further means overlapping one of the two hit areas. It also separates a streaming link from the ticket links. |
| 3b | **Waived for this merge; on the deferred list** | The date tile stretches because the CTA section is `items-stretch`. Any taller CTA column does this already: the ticket-package disclosure, for one. Changing the tile's alignment changes every promo page, which is outside this diff. Get tickets still sits above the first in-content ad at 390 (298 to 350 against 960). |
| N2 | **Waived** | The Fubo block is text only by rule (brief: no Fubo logo or wordmark), enforced by a test that rejects any `<svg>` or `<img>` in the block. An icon-shaped indent with no icon would read as a stray gap. Font, size, tracking, case and colour match the other eyebrows. |
| N3 | **Waived** | Each /promos/today card is self-contained, and the ticket row already repeats per card for the same game. Collapsing one partner's line across cards would make cards differ by position. |
| O1 | **Outside this diff; on the deferred list** | Production renders Calgary's Nov 21 game as 2:30 PM MDT (−06:00) where the branch dev server renders 1:30 PM MT (−07:00, correct). This diff touches no time code. Logged as known-issues entry 118 (2026-11-22). |
| P1 to P6 | **Waived for this merge; on the deferred list** | As recorded by the reviewer in R2.8: pre-existing and identical on production. |
