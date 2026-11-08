# UX review: promo, team and archive pages, baseline mode (feature/promo-archive vs production)

Date: 2026-11-08 (America/New_York; the machine runs America/Chicago, times below say which). Branch: `feature/promo-archive`. When the measurements were taken (15:17 to 15:24 CST, 21:17 to 21:24 UTC) the worktree's tracked tree was the one the branch session committed during this review as **a300439** ("Promo pages v2 step 6: the archive pass", parent 098a459); the three branch pages were fetched again after that commit and their normalized `<article>` / `<main>` HTML is byte-identical to the HTML measured, so every number below describes a300439. The working tree is clean apart from `node_modules` and this report's screenshot folder.

- Branch render: Next.js dev server at http://127.0.0.1:3101 from the worktree; every page answered 200 on the first curl. Its HTML carries no `<meta name="promonight-deploy">`, because a dev server has no deployment id. It runs with the eBay Browse API stub (no keyset exists yet); none of the three sample pages is a played bobblehead page, so no eBay block rendered anywhere in this review. The dev server runs with `NEXT_PUBLIC_EBAY_CAMPID=5339999999`, which the two team-page resale links carry. As in the previous reviews today, the dev server gets partial Raptive fill: a floating video player over the first screen on the team page, a 320x50 sticky footer at 390 and empty 250 px in-content containers everywhere else. That is the environment, not the branch; it is what puts the ad-iframe axe violations, the "×" contrast failure and most console errors in the production column of the tables, and none of it is in first-party DOM. The dark circle with an "N" at the bottom-left of the first screen in every branch PNG is the Next.js dev-tools indicator, not page content.
- Production render: https://www.getpromonight.com with a desktop Chrome User-Agent on curl and on the Playwright context. **Production was redeployed during the review.** The first curl of the promo and team pages (about 21:11 UTC) read `dpl_7p1z23gmcH3GKHiM9n5Qdqfv7s1A` (main **098a459**, the branch's base, ready 20:35:44 UTC). All nine Playwright renders and the second curl (21:20 to 21:24 UTC) read `dpl_9KvV25YkNCMmZCeqJKQnkLrxH2tA` (main **272249a**, "CLAUDE.md worktree rule", a CLAUDE.md-only commit on top of 098a459, ready 21:16:40 UTC). The normalized promo `<article>` and team `<main>` are identical across the two production deploys, so one comparison stands and every production number below is from 272249a. **Production does not have the branch's features**: it has no `/promos/past` route (the archive path answers 404), no Previous editions section, no archive link, one `Sitemap:` line in robots.txt.
- Tooling: Playwright 1.65.0 (Chromium 158, headless), desktop Chrome User-Agent on both contexts, device scale 1, viewports 390x844, 768x1024, 1280x800, 4 s settle after `load`, a scroll-through to trigger lazy mounts, then back to the top before each full-page capture. @axe-core/playwright 4.14.0 (serious and critical only), pixelmatch 8.0.0 at threshold 0.1, Node 25.6.1. The contrast walker from the earlier reviews, with the color parser extended to read Tailwind's `oklch()` computed colors through a canvas (the first run crashed on them). Scripts in the session scratchpad (`ux-review-baseline/archive/`), none in the repo.
- Pixel method: every ad iframe, every Raptive container (`.adthrive-ad`, `#AdThrive_*`) and every `data-ad-item` box masked in both captures (light blue in the diff PNGs), the overlapping area compared (red marks differing pixels), then the first differing row and the differing bands located against the headings and interactive elements on each side.

Three page types. The promo sample was resolved from the production sitemap at run time: the first promo URL in sitemap order whose first Event `startDate` is 2026-11-15 or later (today plus seven days, compared as YYYY-MM-DD strings) is the **74th**, `/nhl/anaheim-ducks/promos/hockey-fights-cancer-night`, game date **2026-11-15**; the first 73 are dated 2026-10-04 to 2026-11-14 (nineteen of them today). Team: `/nhl/minnesota-wild`. Archive: `/nhl/minnesota-wild/promos/past`. Screenshots: `2026-11-08-feature-promo-archive/{promo,team,archive}/{390,768,1280}-{branch,production}.png`, diffs `.../{390,768,1280}-diff.png`. Those 27 PNGs and this file are the only files this review wrote inside the repo.

Two checks that span the pages:

- **Thumbnails.** The Previous editions row on the sample has no tier 1 photo. To see the 56 px thumbnail rendering anywhere, 220 branch promo pages (the sitemap's promo URLs, sorted to favour bobbleheads and recurring names) were fetched from the dev server: 41 render a Previous editions section, **none contains an `<img>`**. The thumbnail path has no live data yet and could not be reviewed.
- **Noindex on old played pages.** Not exercised: every played page reachable from the three samples and every one of the 3,822 URLs in the branch's `/sitemap-past.xml` is inside the index window by construction. The 2025-26 edition page reached from the sample carries no robots meta, which is correct for the previous season.

For the record, the branch's robots.txt adds `Sitemap: https://www.getpromonight.com/sitemap-index.xml` under the existing `/sitemap.xml` line (production has one line); `/sitemap-index.xml` lists `/sitemap.xml` and `/sitemap-past.xml`; `/sitemap-past.xml` has 3,822 URLs including the Wild's 14 played pages; the branch's `/sitemap.xml` lists 157 `/promos/past` archive URLs. Not reviewed as pages.

---

## `/nhl/anaheim-ducks/promos/hockey-fights-cancer-night` (promo)

### 1. Baseline differences

**Served `<article>` HTML.** After normalization (deploy meta, `/_next/static` hashes, `?v=` strings, nonces, `<script>` bodies and `<!-- -->` separators stripped) the branch article is 697 lines / 36,169 bytes and production's 691 lines / 36,087 bytes. They differ in **three regions**:

| Region | Branch (a300439) | Production (272249a) |
|---|---|---|
| "Also on Ticketmaster" href, CTA column | `https://www.ticketmaster.com/anaheim-ducks-tickets/artist/805893` | `https://ticketmaster.evyy.net/c/7236189/264167/4272?u=...&sharedid=web_promo_page_anaheim-ducks&subId3=hockey-fights-cancer-night` |
| New `<section class="mt-6 flex flex-col gap-2.5 rounded-2xl border border-rd-line bg-rd-card p-3.5">`, 18 normalized lines, inserted **directly after THIS GAME's closing tag and before the FAN GUIDE section** | H2 "Previous editions" (accent-bar span, same markup as THIS GAME's H2); `<ul class="m-0 flex list-none flex-col gap-2 p-0">` with one `<li>` holding one `<a class="flex items-center gap-3 rounded-xl text-rd-ink no-underline hover:underline" href="/nhl/anaheim-ducks/promos/hockey-fights-cancer-night-2025-26">`; inside it `<span class="block font-semibold">Hockey Fights Cancer Night 2025-26</span>` and `<span class="block text-[12px] text-rd-ink-faint">Thursday, Nov 20, 2025 · vs Ottawa Senators</span>`. No `<img>` (the 2025-26 edition has no tier 1 photo). No lead sentence. | absent |
| Old `<section class="mt-6 flex flex-col gap-2">` of 12 normalized lines between SAME PROMO, OTHER TEAMS and QUESTIONS | absent | H2 "Previous edition"; `<p>` with inline link "Hockey Fights Cancer Night 2025-26" and `<span> · Thursday, Nov 20, 2025</span>` |

The first region is the Impact wrap configured on production and not on the dev server; it appears on every baseline run. Nothing else differs: breadcrumb, header, `<time>`, date tile, CTA block, About, This game, Fan guide, both rails, Questions, the disclosure, all four JSON-LD blocks. Neither side carries a robots meta (upcoming page) or a "Next edition" line (this is the latest edition).

**Article direct children:** branch 15 / 15 / 15 at 390 / 768 / 1280, production 16 / 16 / 16. The branch has one more section and Raptive gave it one fewer container (3 in-content plus Below Post against production's 4 plus Below Post); Raptive's placement count is ad-tech, not the branch. Positions, 390 (branch / production):

| | Branch top, height | Production top, height |
|---|---|---|
| THIS GAME | 683, 197 | 683, 197 |
| Raptive Content_1 | 891, 250 (empty) | 891, 280 (filled) |
| PREVIOUS EDITIONS | **1,165, 109** (1.38 screens down, second screen) | absent |
| FAN GUIDE | 1,297 | 1,195 |
| MORE ANAHEIM DUCKS PROMOS | 2,056 | 2,003 |
| SAME PROMO, OTHER TEAMS | 2,306 | 2,253 |
| PREVIOUS EDITION (old) | absent | 2,950, 81 (3.5 screens down) |
| QUESTIONS | 3,003 | 3,055 |
| Document height | 5,009 | 5,352 |

At 768: THIS GAME 608 on both, PREVIOUS EDITIONS 1,089 (1.06 screens), FAN GUIDE 1,222 vs 1,119, old section at 2,595 on production (2.53 screens), QUESTIONS 2,438 vs 2,679, document 3,959 vs 4,280. At 1280: THIS GAME 570 on both, PREVIOUS EDITIONS 1,051 (1.31 screens), FAN GUIDE 1,184 vs 1,101, old section 2,584 (3.23 screens), QUESTIONS 2,377 vs 2,667, document 3,874 vs 4,166. The shifts below the insertion mix the new card (109 px plus its 24 px margin) with production's taller filled ad containers (280 and 300 against 250).

**Pixels.**

| Viewport | Branch PNG | Production PNG | Differing pixels (unmasked overlap) | Where |
|---|---|---|---|---|
| 390 | 390x5009 | 390x5352 | 170,786 of 1,383,266 = 12.35% (29.2% masked) | First differing rows 787 to 793 at x 25 to 50: the dev-tools badge (crop checked). The next difference is the new card at 1,165; everything above it is pixel-identical outside the masks. |
| 768 | 768x3959 | 768x4280 | 286,512 of 1,946,278 = 14.72% (36.0% masked) | First differing row **1,104** = the PREVIOUS EDITIONS H2. Every row above is identical. |
| 1280 | 1280x3874 | 1280x4166 | 510,792 of 3,583,294 = 14.25% (27.7% masked) | First differing row **1,077**, inside the new card (H2 at 1,066). Every row above is identical. |

The percentages are large because everything below the card moves; the bands with the most red are the footer and QUESTIONS, which sit 343 / 321 / 292 px higher on the branch.

**Measurements that moved.** Document height (-343 / -321 / -292), article children (15 vs 16), every section from FAN GUIDE down, body text bytes (4,333 vs 4,314). **Unchanged:** H1 at 149, `<time datetime="2026-11-15T17:00:00-08:00">` at 268, venue line at 298, Get tickets 144x52 at 336 (394x52 at 768, 522x52 at 1280), the rail cards, `/promos/` anchors (21 in DOM, 19 visible at 390, 20 at 768 and 1280 on both), nine in-article targets under 44 px on both (the branch swaps production's 249x16 inline edition link for the 328x39 row), first-party contrast failures (1 on both, the header logo), first-party axe (1 on both), CLS 0.0002 / 0.0345 vs 0.0383 / 0.0016.

### 2. Game date check

- **Dates on the page (390, branch).** Header `<time datetime="2026-11-15T17:00:00-08:00">` reads "Sunday, Nov 15, 2026 · 5:00 PM PT" at 268 px. Date tile "SUN 15 NOV, IN 7 DAYS". THIS GAME caption at 806 px "Nov 15 · Hockey Fights Cancer Night · home game 11 of 42". The new card's row reads "Thursday, Nov 20, 2025 · vs Ottawa Senators", which is the previous edition, not this game.
- **JSON-LD.** One Event, `startDate` "2026-11-15", location Honda Center, Anaheim. Identical on both environments.
- **Venue zone.** Honda Center, Anaheim: America/Los_Angeles. Today there is 2026-11-08.
- **Verdict: upcoming, 7 days out. Not a played game.** Both environments render the upcoming state: Get tickets, Share, Also on Ticketmaster, Parking, Hotels, Remind me.

### 3. Three things that work

1. The Previous editions card sits where a fan looks for it: right under THIS GAME, 1.38 screens down at 390 (1.06 at 768, 1.31 at 1280) instead of 3.5 screens down between the rails and the FAQ, in the same card language as THIS GAME and the FAN GUIDE (same border, radius, padding, accent-bar H2). The row is one Link, the whole row is the target, and it lands on `/nhl/anaheim-ducks/promos/hockey-fights-cancer-night-2025-26`, whose H1 is "HOCKEY FIGHTS CANCER NIGHT", whose header reads "Anaheim Ducks vs Ottawa Senators · Thursday, Nov 20, 2025 · 7:00 PM · This game has been played", and whose CTA column offers "Next edition: Hockey Fights Cancer Night 2026-27 · Sunday, Nov 15, 2026" back to the page a fan came from, plus the app download; no tickets, parking or hotels for a played game. Browser back restored the scroll exactly (1,180 to 1,180).
2. Everything above the card is untouched: `<time>`, venue, date tile, Get tickets (popup, one hop `ticketnetwork.lusg.net` to `www.ticketnetwork.com/tickets/8139280/anaheim-ducks-vs-calgary-flames-tickets-sun-nov-15-2026-honda-center`, landing title "Anaheim Ducks vs. Calgary Flames in Anaheim, CA at Honda Center on November 15, 2026", same on production), the rail's first card "SUN NOV 8 Kids' Socks Giveaway" to an H1 "KIDS' SOCKS GIVEAWAY", back to 2,056 exactly (production 1,973 to 1,973).
3. The game-date check ran and the page shows the correct upcoming state on both environments. The page is 343 px shorter at 390 with the same content, CLS is unchanged at every viewport (0.0002 / 0.0345 / 0.0016 within ad noise), and no first-party axe violation or contrast failure was added: the only failure on both is the header logo's "NIGHT" (4.33:1).

### 4. Defects

- **D1 (new, every viewport).** The Previous editions row is 39 px tall: 328x39 at 390, 578x39 at 768, 706x39 at 1280 (the Link is `flex items-center` around two stacked 14 px and 12 px lines; the card's padding is outside it). Under the 44 px floor and the only new tap target on the page. `promo/390-branch.png` at y 1,219.
- **D2 (carried, every viewport, identical on production).** Eight other in-article targets under 44 px at 390: breadcrumb "NHL" 24x18 and "Anaheim Ducks" 84x18, "Also on Ticketmaster" 133x21, "nhl.com" 43x14, "Calgary Flames" 106x16 and "Kids' Socks Giveaway" 149x16 in THIS GAME, "All Anaheim Ducks promos" 170x21, "Theme nights across pro sports" 198x21. Header logo "NIGHT" 4.33:1 (red on cream), the one first-party contrast and axe failure on every PromoNight page.

Nothing restates the section above it; the card has no lead sentence and needs none; nothing on the branch looks like a tap target and is not.

### 5. Measurements

| Measure | Branch a300439 (dev) 390 / 768 / 1280 | Production 272249a 390 / 768 / 1280 |
|---|---|---|
| Status, deploy meta | 200, absent (dev server) | 200, `dpl_9KvV25YkNCMmZCeqJKQnkLrxH2tA` |
| Document height | 5,009 / 3,959 / 3,874 | 5,352 / 4,280 / 4,166 |
| Article children | 15 / 15 / 15 | 16 / 16 / 16 |
| THIS GAME top | 683 / 608 / 570 | 683 / 608 / 570 |
| Previous editions section top, height | 1,165 / 1,089 / 1,051; 109 | 2,950 / 2,595 / 2,584 (old inline section); 81 / 60 / 60 |
| Previous edition link hit size | 328x39 / 578x39 / 706x39 (row) | 249x16 (inline text) |
| Thumbnails in the section | 0 (no tier 1 photo on the edition) | n/a |
| First ad anchor in article (`data-ad-region`/`data-ad-item`) | none inside; the article itself carries `data-ad-region="content"` at 57; Raptive Content_1 container at 891 / 815 / 777 | same; Content_1 at 891 / 815 / 777 |
| Get tickets | 144x52 at 336 / 394x52 / 522x52 at 298 | identical |
| `/promos/` anchors DOM / visible | 21/19 / 21/20 / 21/20 | 21/19 / 21/20 / 21/20 |
| Interactive targets under 44 px, in article | 9 / 9 / 9 | 9 / 9 / 9 |
| Contrast failures (first-party) | 1 ("NIGHT" 4.33:1) | 1 (+ ad "×" 2.12:1) |
| axe serious+critical (first-party) | 1 color-contrast | 1 color-contrast (+5 to 6 in ad iframes) |
| CLS after load / after scroll | 0.0002 / 0.0345 / 0.0016 | 0.0002 / 0.0383 / 0.0016 |
| Console errors (capped at 10 recorded) | 10 / 10 / 10 | 10 / 10 / 10 |
| Rail card tap, back delta | H1 match, 0 px | H1 match, 0 px |
| Previous edition tap, back delta | H1 match (label carries the season suffix the H1 drops), 0 px | H1 match, 0 px |

### 6. Recommendation

Give the Previous editions row a 44 px minimum height (the rail's full cards are 105 px; this row is the one a fan who missed last year taps).

---

## `/nhl/minnesota-wild` (team)

### 1. Baseline differences

**Served `<main>` HTML** (the team page's only `<article>` is the `.rd-weave` block, which is the ad wrapper and not the whole content, so `<main>` is compared). Normalized: branch 2,210 lines / 122,840 bytes, production 2,218 lines / 124,394 bytes. **11 hunks**:

| Hunks | Branch | Production |
|---|---|---|
| 6 | Plan your visit and the five ticket dialogs: `https://www.ticketmaster.com/minnesota-wild-tickets/artist/805974` | `https://ticketmaster.evyy.net/c/7236189/264167/4272?u=...&sharedid=web_team_page_minnesota-wild` (Impact wrap; dev-server config) |
| 2 | Kaprizov and Spurgeon "Missed it? Check resale on eBay" hrefs with `campid=5339999999` | `campid=5339156327` (the dev server's placeholder EPN campaign id; environment, not the branch) |
| 1 | Third server-rendered row under LAST SEASON (2025-26): **Xcel Energy LED Night Light**, DEC 11 THU, "TBD", no opponent line, no eBay link (`2025-26-ps-2`): the third most recent completed row in date order | **Mikko Koivu Bobblehead & Pompom**, NOV 4 TUE, 7:00 PM, vs Nashville Predators, with the eBay resale link (`2025-26-rb-2`): the third lifted bobblehead |
| 1 | New `<p class="mt-4 font-rd text-[14px] font-medium"><a class="text-rd-link no-underline hover:underline" href="/nhl/minnesota-wild/promos/past">All 8 past promos</a></p>` after the "Show 3 more completed promos" button, inside the LAST SEASON block | absent |

**Completed rows in the served HTML: 5 on both sides**, COMPLETED 2026-27 PROMOS 2 (Blaze Orange Hat, Team Calendar Giveaway) and LAST SEASON (2025-26) 3, with a "Show 3 more completed promos" button on both. For this club production's "up to eight plus up to three lifted" already resolved to 2 + 3, so the branch changes which third row is served (chronological instead of the resale lift) and not how many. Resale links in the served HTML: 2 on the branch, 3 on production. Everything above the completed section is byte-identical apart from the Ticketmaster hrefs: breadcrumb, hero and stat tiles, calendar, Plan your visit, the 9 upcoming rows (9 in DOM, 9 visible on both), the dialogs. **Served bytes**: production 372,747 (098a459) and 373,038 (272249a); branch dev server 664,717 with 226 `<script>` tags against production's 105, which is the dev bundle and not comparable. Body text with tags and scripts stripped: 10,572 vs 10,621 bytes.

**Pixels.**

| Viewport | Branch PNG | Production PNG | Differing pixels (unmasked overlap) | Where |
|---|---|---|---|---|
| 390 | 390x12598 | 390x12651 | 260,491 of 4,128,630 = 6.31% (16.0% masked) | One group above the completed section: y 691 to 793, x 25 to 379, the Raptive floating video player showing different footage on each load (surfers on the branch, a swimmer on production; crop checked). Then the row swap at about 5,000 and everything below 53 px higher on the branch. |
| 768 | 768x10521 | 768x10542 | 245,439 of 6,528,214 = 3.76% (19.2% masked) | First differing row **4,892**, the third LAST SEASON row. Every row above is identical. |
| 1280 | 1280x8945 | 1280x8966 | 263,218 of 9,415,956 = 2.80% (17.8% masked) | One pixel at y 326; then y 2,381 to 2,791 at x 878 to 1,151, the sidebar, where production's Sidebar_1 ad is 600 px tall against the dev server's empty 250 px so "All NHL teams" and "More to dig into" sit 350 px lower on production (crop checked); then the row swap from 3,871 and a 21 px shift below. |

So outside ad-driven regions every pixel above the completed section is identical at all three viewports, matching the HTML.

**Measurements that moved.** Document height (-53 / -21 / -21), `/promos/` anchors 38/36 vs 37/35 at 390 and 38/37 vs 37/36 above (+1, the archive link), resale links in the completed HTML 2 vs 3, third completed row's text. **Unchanged:** H1 at 150 / 166 / 166, UPCOMING PROMOS at 2,723 / 2,849 / 1,796, COMPLETED 2026-27 PROMOS at 4,133 / 3,974 / 2,921, LAST SEASON at 4,685 / 4,416 / 3,364, both sublines ("2 completed events this season", "6 completed events, October 2025 to January 2026"), the first ad anchor (the `.rd-weave` article with `data-ad-region="content"` at 672 / 599 / 520), in-main targets under 44 px (79 / 49 / 49 on both: the branch adds the 109x15 link and drops the 186x32 Koivu eBay link), first-party contrast failures (3 on both), first-party axe (color-contrast 1, label-content-name-mismatch 6 / 16 / 16 on both). CLS 0 / 0 / 0 on the branch, 0.0112 / 0.0312 / 0.0002 on production from an ad `div`.

### 2. Game date check

- **Dates on the page (390, branch).** Hero "Promos & Giveaways 2026-27", "6 promotions in the 2026-27 season, 4 still to come". Upcoming rows from NOV 17 (vs Nashville Predators) through DEC 22 (Nightlight), with the calendar's November dots. COMPLETED 2026-27 PROMOS: OCT 29 and OCT 12 2026. LAST SEASON (2025-26): JAN 24 2026, DEC 21 2025, DEC 11 2025 (and NOV 4, OCT 28, OCT 11 2025 behind the expander). No Event JSON-LD on the team page.
- **Venue zone.** Grand Casino Arena, St Paul: America/Chicago. Today there is 2026-11-08.
- **Verdict: a mixed page, as designed.** The played rows sit under "Already happened" eyebrows and COMPLETED headings with a Completed chip; the upcoming rows are in the future. Not a played-game page.

### 3. Three things that work

1. Everything above the completed section is byte-identical (apart from the dev server's Ticketmaster hrefs) and pixel-identical outside the ad regions at all three viewports: breadcrumb, hero, stat tiles, calendar, Plan your visit, the 9 upcoming rows and their dialogs.
2. The completed section's served HTML did not grow: 2 + 3 rows on both sides, same headings, same sublines, same "Show 3 more completed promos" pill (288x39), which still reveals all 6 of last season's rows on tap (6 visible after the click, button gone, archive link still there) on both environments.
3. "All 8 past promos" lands on a page whose H1 is "MINNESOTA WILD PAST PROMOS AND GIVEAWAYS", in the page's link red at 5.06:1, under the block it summarises; the Get tickets CTA in Plan your visit still opens Ticketmaster in a new tab (title "Minnesota Wild Tickets | 2026-2027 NHL Tickets & Schedule | Ticketmaster"), on production through one Impact hop (`ticketmaster.evyy.net`), on the dev server directly.

### 4. Defects

- **D3 (new, every viewport, the one to fix before merge).** The link says **"All 8 past promos"** and the page it opens says **"14 promotions already played"** and lists **14 rows**. The team page's 8 is the completed promo list (2 + 6), which by the page's own words excludes ticket packages ("The items below are sold as special ticket packages, so they are not counted as theme nights, giveaways, food deals or kids events on this page", under "Ticket packages (14)" two screens below the link). The archive counts and lists the 6 played ticket packs (Military Appreciation, Friends, Swedish Heritage, Hockey Fights Cancer, Educator Appreciation, SpongeBob) as promotions, first in the list, without marking them. A fan who reads 8, taps, and counts 14 has caught the site contradicting itself one tap apart; a fan who does not count is told the Wild gave away eight things in two seasons on one page and fourteen on the next. `team/390-branch.png` at y 5,637; `archive/390-branch.png` from y 278. Source of the 8: `src/components/promo-list.tsx` line 637 uses `past.length` from the list the route already stripped of packages; source of the 14: `archiveSeasons` in `src/lib/promo-editions.ts` groups every played row with a page slug.
- **D4 (new, every viewport).** "All 8 past promos" is a 14 px text link with a **109x15** hit box at every viewport, 19 px under a 288x39 pill that reads "Show 3 more completed promos". Two stacked controls that both mean "more past promos" with different scopes (3 more rows inline; a page of 14), and the smaller one is the one that leaves the page.
- **D5 (pre-existing, 390, now reached by a new path).** Browser back from the completed section does not restore the scroll position: after tapping the first completed row (Blaze Orange Hat, 258x154) the page came back at 4,315 from 4,133 (182 px low) on **both** branch and production; after tapping "All 8 past promos" it came back at 5,395 from 5,212 (183 px low) on the branch. The hidden rows that lazy-mount on return are the likely 182 px. The archive link adds a second way into this.
- **D6 (new exposure, minor).** Serving the completed rows in date order puts "Xcel Energy LED Night Light" third under LAST SEASON: a completed event whose row says "TBD" for the time and has no opponent line (its data was always like this, it was behind the expander before). The row that left the served HTML, the Koivu bobblehead, was the one carrying a resale link.
- **D7 (carried, every viewport, identical on production).** 79 in-main targets under 44 px at 390 (calendar day cells 41x41, share buttons 32x32, TICKETS 92x27, "Missed it? Check resale on eBay" 186x32, the arena policy links 123x12 and 96x12, the category chips 34 px tall); contrast "→" 2.72:1 (the purple app-card arrow) and "›" 3.14:1 (the gameday guide chevron); axe label-content-name-mismatch on 6 (390) and 16 (768, 1280) nodes; header logo 4.33:1.

### 5. Measurements

| Measure | Branch a300439 (dev) 390 / 768 / 1280 | Production 272249a 390 / 768 / 1280 |
|---|---|---|
| Status, deploy meta | 200, absent (dev server) | 200, `dpl_9KvV25YkNCMmZCeqJKQnkLrxH2tA` |
| Served HTML bytes (full document) | 664,717 (dev bundle, not comparable) | 373,038 (372,747 on 098a459) |
| `<main>` inner bytes, normalized lines | 122,840; 2,210 | 124,394; 2,218 |
| Completed rows served: 2026-27 / 2025-26 / total | 2 / 3 / 5 | 2 / 3 / 5 |
| Third 2025-26 row served | Xcel Energy LED Night Light (DEC 11, TBD, no opponent) | Mikko Koivu Bobblehead & Pompom (NOV 4, 7:00 PM, eBay link) |
| Resale links in completed HTML | 2 | 3 |
| Archive link | "All 8 past promos", 109x15 at 5,637 / 5,105 / 4,053; 5.06:1 | absent |
| "Show more" pill | 288x39 at 5,579 / 5,048 / 3,995 | 288x39 at 5,669 / 5,106 / 4,053 |
| Document height | 12,598 / 10,521 / 8,945 | 12,651 / 10,542 / 8,966 |
| First ad anchor (nearest `data-ad-region`/`data-ad-item` in main) | `article.rd-weave[data-ad-region=content]` at 672 / 599 / 520 | same |
| Upcoming rows DOM / visible | 9 / 9 | 9 / 9 |
| `/promos/` anchors DOM / visible | 38/36 / 38/37 / 38/37 | 37/35 / 37/36 / 37/36 |
| Interactive targets under 44 px, in main | 79 / 49 / 49 | 79 / 49 / 49 |
| Contrast failures (first-party) | 3 ("NIGHT", "→" 2.72:1, "›" 3.14:1) | 3 (+ ad "×", "Ad ends in 12" 4.32:1) |
| axe serious+critical (first-party) | color-contrast 1, label-content-name-mismatch 6 / 16 / 16 | same (+ ad iframes) |
| CLS after load | 0 / 0 / 0 | 0.0112 / 0.0312 / 0 |
| Completed row tap, back delta | H1 "BLAZE ORANGE HAT", 182 px | same, 182 px |
| Archive link tap, back delta | H1 "MINNESOTA WILD PAST PROMOS AND GIVEAWAYS", 183 px | n/a |

### 6. Recommendation

Make the link and the archive agree on what a past promo is before either ships: either the archive leaves ticket packages out (and its count becomes the 8 the link promises), or the link and the archive's count line say "promos and ticket packs" and the archive marks the pack rows the way the team page's package section does. One of the two surfaces is wrong today and they are one tap apart.

---

## `/nhl/minnesota-wild/promos/past` (archive)

### 1. Baseline differences

**Production answers 404** for this path at every viewport (expected: the route is new). Its page is the site's not-found boundary: H1 "TEAM NOT FOUND", "We couldn't find that team. The URL may be off, or the team isn't tracked yet.", "Browse all teams" and "Home", `<meta name="robots" content="noindex">`, 2,077 / 1,474 / 1,293 px tall. The copy says the team was not found although the team exists and the slug after `/promos/` is what is unknown; moot once the route exists. No served-HTML comparison is possible; the pixel diffs (`archive/{390,768,1280}-diff.png`: 50.98% / 38.40% / 47.76% of the unmasked overlap) record two different pages and nothing finer. The rest of this section reviews the branch alone.

### 2. Game date check

- **Dates on the page (390, branch).** 14 rows, month and day only: NOV 07, NOV 06, OCT 29, OCT 29, OCT 18, OCT 15, OCT 12, OCT 12 under "2026-27 SEASON"; JAN 24, DEC 21, DEC 11, NOV 04, OCT 28, OCT 11 under "2025-26 SEASON". No `<time>` element, no Event JSON-LD (one BreadcrumbList).
- **Venue zone.** Grand Casino Arena, St Paul: America/Chicago. Today there is 2026-11-08; the newest row is yesterday's game.
- **Verdict: every date is before today, by design.** The page says so in its count line ("14 promotions already played, newest first.") and its H1 ("past promos"), so under the rule it is a page that already shows its played state: reported as working in 3.3 below. The three row destinations tapped (Nov 7 2026, Oct 11 2025) all render the played state ("This game has been played").

### 3. Three things that work

1. Every row is one `<a>` and the whole card is the target: 358x61 at 390 (608x61 at 768, 736x61 at 1280; one row is 358x52, see D8), 10 px apart, white on cream with a 1 px border and 12 px radius. The top row and the last row of 2025-26 both landed on a promo page whose H1 equals the row title ("MILITARY APPRECIATION TICKET PACK", "OPENING NIGHT LED RALLY TOWEL"), and browser back restored the scroll exactly both times (0 to 0, 860 to 860). The breadcrumb's "Minnesota Wild" landed on the team H1 and back restored 0.
2. Hierarchy and legibility: H1 30 px / 800 uppercase (three lines at 390, two at 768 and 1280) at 15.13:1; the two season H2s at 22 px / 800 uppercase with a 40x3 accent bar in Wild green (`rgb(21,71,52)`) and 24 px above them read as section breaks, and each gets a 598 px and a 447 px block of cards under it; row title 14 px / 600 at 16.75:1, day 20 px / 900 at 16.75:1, month 10 px and opponent 12 px faint at exactly 5:1, count line 13 px at 8.1:1, breadcrumb 12 px at 4.52:1. CLS 0 at 390. The only contrast and axe failure is the header logo shared by every page.
3. The page knows what it is: breadcrumb NHL / Minnesota Wild / Past promos (links to `/nhl` and `/nhl/minnesota-wild`, "Past promos" `aria-current="page"`), a matching three-item BreadcrumbList with absolute URLs, canonical self, title "Minnesota Wild past promos and giveaways | PromoNight", a 145-character description, and a closing "All Minnesota Wild promos" link back to the team page. A club with nothing played gets a 404 rather than an empty page (by code; not exercisable on this club).

### 4. Defects

- **D3 (shared with the team page, every viewport).** The page counts and lists 6 played ticket packs among its "14 promotions already played" while the team page that links here says 8 and says packages are not counted; see the team section. On this page the packs are also the first six rows a fan sees at 390 (all of the first screen under the 2026-27 heading is ticket packs except Blaze Orange Hat), with nothing to tell them from giveaways but the word in the name. `archive/390-branch.png` from y 278.
- **D8 (new, data, 390 first and second screen).** Opponent naming changes between the two seasons: the 2026-27 rows say "vs Lightning", "vs Sharks", "vs Islanders", "vs Blue Jackets", "vs Blues", "vs Golden Knights"; the 2025-26 rows say "vs Florida Panthers", "vs Colorado Avalanche", "vs Nashville Predators", "vs Winnipeg Jets", "vs Columbus Blue Jackets". One row, DEC 11 Xcel Energy LED Night Light, has no opponent at all and is 52 px tall against 61 for the rest. The same data shows on the team page's completed rows and in the promo page's Previous editions line ("vs Ottawa Senators"), so the inconsistency is upstream, but this page puts both forms within one scroll.
- **D9 (new, minor, every viewport).** Rows carry month and day only: no year, no weekday, no `<time datetime>`. "JAN 24" under "2025-26 SEASON" is January 2026 and "NOV 07" under "2026-27 SEASON" is November 2026, which a fan must work out from the season label; nothing on the page is machine-readable as a date although the search snippet promises "each game's date and opponent".
- **D10 (new, every viewport).** Three in-article targets under 44 px: breadcrumb "NHL" 24x18 and "Minnesota Wild" 82x18 (12 px text, the same pattern as the promo page's breadcrumb), and the closing "All Minnesota Wild promos" 168x21 (14 px text, the page's only way back other than the breadcrumb).

**1280, as asked.** The page is a single 768 px column (`lg:max-w-3xl`) centred with 256 px of empty cream on each side, no sidebar, no rail, no in-content ad; each row is 736x61 with about 250 px of text at its left and about 480 px of blank white card to its right; 1,576 px of content, then the empty Below Post container at 1,333 and the footer at 1,633. It reads as an index page, sparse but not broken; the only thing on the right half of the screen at any scroll depth is the right half of each card. Not listed as a defect.

**Ad anchors.** The article is the only element carrying `data-ad-region` (`content`, top 57) and there is no `data-ad-item`; Raptive placed no in-content unit between or inside the two season sections at any viewport, only the Below Post container after the last row (1,362 at 390, 1,333 at 768 and 1280) and the sticky footer. The first ad anchor is therefore the article itself; the first ad container is after all the content.

### 5. Measurements

| Measure | Branch a300439 (dev) 390 / 768 / 1280 | Production 272249a 390 / 768 / 1280 |
|---|---|---|
| Status, deploy meta | 200, absent (dev server) | **404**, `dpl_9KvV25YkNCMmZCeqJKQnkLrxH2tA`, robots noindex |
| Title, canonical | "Minnesota Wild past promos and giveaways \| PromoNight", `https://www.getpromonight.com/nhl/minnesota-wild/promos/past` | site title, none |
| H1 | "MINNESOTA WILD PAST PROMOS AND GIVEAWAYS" 30 px / 800, 15.13:1, at 101 (86 px tall / 57 / 57) | "TEAM NOT FOUND" 36 / 48 / 48 px |
| Count line | "14 promotions already played, newest first." 13 px, 8.1:1 | n/a |
| Season H2s | "2026-27 SEASON" at 238 / 210 / 210, "2025-26 SEASON" at 860 / 831 / 831; 22 px / 800, 15.13:1, 40x3 accent bar | n/a |
| Rows (hit size) | 14: 358x61 at 390 (one 358x52) / 608x61 / 736x61; gap 10 px | 0 |
| Row text contrast | title 16.75:1, day 16.75:1, month 5:1, opponent 5:1 | n/a |
| Breadcrumb | NHL 24x18, Minnesota Wild 82x18, "Past promos" aria-current; 12 px, 4.52:1 | none |
| Closing link | "All Minnesota Wild promos" 168x21 at 1,331 / 1,302 / 1,302, 5.06:1 | none |
| Article width, gutters | 390, 0/0 / 640, 64/64 / 768, 256/256 | n/a |
| Content height, footer top, document height | 1,605, 1,662, 3,091 / 1,576, 1,633, 2,333 / 1,576, 1,633, 2,309 | document 2,077 / 1,474 / 1,293 |
| First ad anchor | the article (`data-ad-region="content"`) at 57; no `data-ad-item`; first Raptive container Below Post at 1,362 / 1,333 / 1,333 | none |
| `/promos/` anchors DOM / visible | 22/20 / 22/21 / 22/21 (14 rows + chrome) | 8/6 / 8/7 / 8/7 (chrome) |
| Interactive targets under 44 px, in article | 3 / 3 / 3 | n/a |
| Contrast failures (first-party) | 1 ("NIGHT" 4.33:1) | 1 (+ ad "×") |
| axe serious+critical (first-party) | 1 color-contrast | 1 color-contrast |
| CLS after load | 0 / 0.0006 / 0.011 | 0.0003 / 0.0011 / 0.0002 |
| Row tap (top), back delta | H1 match, 0 px | n/a |
| Row tap (last of 2025-26), back delta | H1 match, 0 px | n/a |
| Breadcrumb team tap, back delta | H1 "MINNESOTA WILD", 0 px | n/a |
| JSON-LD | BreadcrumbList, 3 items | none |

### 6. Recommendation

Put the year on each row (or a date range under each season heading) and settle the opponent on one form across seasons before this page type is indexed: it is new, 157 of its URLs enter the sitemap with this merge, and its snippet promises the date and the opponent of each game.

---

## Dispositions (branch session, 2026-11-08, before the merge)

Every defect above is fixed, deferred with a known-issues entry, or waived with its reason here, per the merge rule in CLAUDE.md. The fixes were re-measured on the worktree dev server at 390 with Playwright after the change.

| Defect | Disposition | Detail |
|---|---|---|
| D1 Previous editions row 39 px tall | **Fixed** | The row Link carries `min-h-11`: re-measured 328x44 at 390. |
| D2 carried promo-page targets, the wordmark | **Already tracked** | known-issues 78, the brand ruling. |
| D3 the team page says 8 past promos, the archive lists 14 | **Fixed** | The archive (`getPastPromoEditions`) and the editions block leave NHL and NBA special-ticket rows out, as the team page's completed list does (WEB6 G2: a package is not a promotion anywhere the site lists promotions). Re-measured on the Wild: the archive now lists 8 rows under "8 promotions already played" and the team page's link says "All 8 past promos"; no pack row on the page. The pack pages themselves stay in `/sitemap-past.xml`, as upcoming pack pages are in `/sitemap.xml`. Test: a played Wild pack is in neither the archive nor the team count. |
| D4 "All 8 past promos" 109x15 under a 288x39 pill | **Fixed** | The link is an inline-flex 44 px target: re-measured 109x44. Two controls with two scopes remain by design (3 more rows inline; the whole archive on its own page); the pill's own 39 px height is the team page's existing pattern. |
| D5 back from the completed section lands 182 px low | **Deferred**, known-issues 94 | Pre-existing on production; the archive link is a second way in. |
| D6 the third served row is a "TBD" night; the Koivu bobblehead's resale link left the served HTML | **Waived, reported** | The ruling is the five most recent completed rows in date order, no lift. The resale CTA on team pages now rides only bobbleheads among the five most recent; on the Wild that is two links instead of three. The row's missing time and opponent are known-issues 95. |
| D7 carried team-page targets, contrast, label mismatches | **Already tracked** | known-issues 78 and the earlier team-page entries. |
| D8 opponent naming differs between seasons; one row has no opponent | **Deferred**, known-issues 95 | Stored rows and the game join, not the archive. |
| D9 rows carry month and day only, no year, no `<time>` | **Fixed** | Each season heading now carries the months its rows span ("October 2025 to January 2026"), and the compact card's day tile is a `<time dateTime="YYYY-MM-DD">` on every surface that uses it (archive, cross-team block, the rail's single card). The description's "each game's date" is now machine-readable on the page. |
| D10 breadcrumb and closing link under 44 px on the archive page | **Fixed in part**, rest tracked | The closing "All Minnesota Wild promos" link is a 44 px target (re-measured 168x44). The breadcrumb's two 12 px links are the promo family's pattern, known-issues 78. |
| The 404 for a club with nothing played says "TEAM NOT FOUND" | **Fixed** | The archive route has its own not-found boundary: "No past promos yet", one line of copy, a link to all teams. Status stays 404. |

Not reviewable this run, recorded for the next: the 56 px tier 1 thumbnail in Previous editions (no edition with a tier 1 photo exists in the data yet; the view test covers the markup), and the noindex on a played page older than the previous season (none reachable from the samples; the route test covers it).
