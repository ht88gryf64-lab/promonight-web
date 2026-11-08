# UX review: promo pages, baseline mode (fix/byg-clutch-row vs production)

Date: 2026-11-08 (America/New_York). Branch: `fix/byg-clutch-row`, HEAD 545683f (two commits on main 4c20fac: 58c15b5, the Before you go bag row; 545683f, the quick-facts bag line). The working tree was clean apart from this report; the dev server's cwd is the branch worktree.

- Branch render: Next.js 15.5.15 dev server at http://localhost:3100 (`PROMO_PAGES_LIVE=true`). Its HTML has no `<meta name="promonight-deploy">` because the dev server has no deployment id.
- Production render: https://www.getpromonight.com, `<meta name="promonight-deploy" content="dpl_2rB3PFo5UdpAzh5juvKEMGtgWQgy">` (main 4c20fac, the branch's base).
- Tooling: Playwright 1.65 (Chromium headless), a desktop Chrome User-Agent on both contexts, device scale 1, viewports 390x844, 768x1024 and 1280x800, a 5 s settle after `load`, then a scroll-through to trigger lazy mounts before each full-page capture. Also @axe-core/playwright (serious and critical only), pixelmatch at threshold 0.1, and my own contrast walker that composites backgrounds up the ancestor chain. Served HTML came from curl with the same User-Agent.
- Pixel method: every iframe, every Raptive container (`.adthrive-ad`, `AdThrive_*`), `ins` and `nextjs-portal` was masked in both captures, and the overlapping area was compared. A second pass compared each `<article>` child section on its own, aligned by that section's top (ad containers skipped, dy of -1, 0 or +1 allowed), so that ad fill heights do not show up as content differences.

Two URLs, one section each:

1. Page type `promo`, sample resolved from the sitemap: `/nhl/anaheim-ducks/promos/hockey-fights-cancer-night`.
2. Extra URL: `/mlb/atlanta-braves/promos/austin-riley-short-sleeve-hoodie-giveaway` (Truist Park, a played game).

---

## URL 1: `/nhl/anaheim-ducks/promos/hockey-fights-cancer-night` (promo sample)

**How the sample was resolved.** https://www.getpromonight.com/sitemap.xml (lastmod 2026-11-08T14:55:39Z) lists 1,354 promo URLs (`/{sport}/{team}/promos/{slug}`). I fetched each one in sitemap order with a desktop Chrome User-Agent, read the first Event `startDate` in its JSON-LD, and compared its first ten characters, as a string, with "2026-11-15" (today plus 7 days in America/New_York). Candidates 1 to 73 are earlier than that. Candidate 74 is the first on or after it: **game date 2026-11-15** (Sunday, Nov 15, 2026, 5:00 PM PT, Honda Center). This is the same page the last three reviews used. The same path was rendered on both environments.

Screenshots: `2026-11-08-fix-byg-clutch-row/hockey-fights-cancer-night/{390,768,1280}-{branch,production}.png`. Diffs: `.../{390,768,1280}-diff.png` (red marks differing pixels, light blue marks masked ad areas).

### 1.1 Baseline differences

**Expectation confirmed: this page shows no difference from the branch's change.** The page has no bag surface: no Before you go block, no quick facts, no `/venues/` link, and 0 occurrences of "Bags are not allowed", "No bags, except clutches" or "Max bag" on either environment.

- **Served `<article>` HTML.** After normalization the two sides are 566 lines each (branch 36,157 bytes, production 36,303). Normalization stripped the deploy meta, `/_next/static` hashes, `?v=` strings, nonces, `<script>` bodies (which removes the RSC flight payload) and `<!-- -->` separators. They differ in **one region**:

  | Region | Branch | Production |
  |---|---|---|
  | "Also on Ticketmaster" href | `https://www.ticketmaster.com/anaheim-ducks-tickets/artist/805893` | `https://ticketmaster.evyy.net/c/7236189/264167/4272?u=...&sharedid=web_promo_page_anaheim-ducks&subId3=hockey-fights-cancer-night` |

  This is the Impact wrap that is configured on production and not on the dev server. It shows up on every baseline run and has nothing to do with this branch. Everything else in the article is byte-identical, including the open tag (`overflow-anchor:none`), the Get tickets href, the rail, the Same promo rows, the FAQ and the Event JSON-LD.
- **Pixels.**

  | Viewport | Branch PNG | Production PNG | Raw differing pixels (masked overlap) | Aligned per section |
  |---|---|---|---|---|
  | 390 | 390x5242 | 390x5292 | 52,228 of 2,044,380 = 2.55% (26.4% masked) | 0 in every section except THIS GAME, which has **102 px** at x 25-50, y 787-793. That is the top edge of the Next.js dev-tools indicator, dev only. The raw figure comes from everything below PREVIOUS EDITION sitting 50 px lower on production, because production's first content ad filled at 300 px where the empty dev container is 250 px |
  | 768 | 768x4170 | 768x4200 | 46,048 of 3,202,560 = 1.44% (25.3% masked) | 0 in every section. The raw figure is the same ad-height offset, from 3,470 px down |
  | 1280 | 1280x4085 | 1280x4085 | **0** of 5,228,800 (20.2% masked) | 0 in every section |

- **Measurements that moved.** Only those driven by ads: CLS at 768 (branch 0.0392, production 0.0704; both come from Raptive's first content container being inserted), document height at 390 and 768 (ad fill), and the interactive and under-44 counts (production adds Raptive's close, pause and unmute controls). The first-party numbers are identical: in-article targets, the `/promos/` anchor counts, the contrast failures, the H1, `<time>`, the dates and the first ad anchor.

### 1.2 Game date check

- **Dates on the page (390, branch).** The header `<time datetime="2026-11-15T17:00:00-08:00">` reads "Sunday, Nov 15, 2026 · 5:00 PM PT" at 268 px. The date tile reads "SUN 15 NOV, IN 7 DAYS". The timeline caption reads "Nov 15 · Hockey Fights Cancer Night · home game 11 of 42".
- **JSON-LD.** One Event, `startDate` "2026-11-15", with `offers` present and `eventStatus` EventScheduled. Identical on both environments.
- **Venue zone.** The page names Honda Center, Anaheim, so the zone is America/Los_Angeles. Today there is 2026-11-08, the same date as in America/New_York.
- **Verdict: upcoming, 7 days out. Not a played game.** Both environments correctly show no played state: Get tickets, Share, Also on Ticketmaster, Parking, Hotels and Remind me all render.

### 1.3 Three things that work

1. **When, where and against whom are all on the first screen.** `390-branch.png`, top. The H1 is at 149 px, "Anaheim Ducks vs Flames" sits under it, the zoned date and time is at 268 px and "Honda Center, Anaheim" is at 298 px. The 52 px Get tickets button is at 336 px, and Parking, Hotels and Remind me (44 px tall each) follow by 525 px.
2. **The primary CTA goes to this exact game.** "Get tickets" (144x52, new tab, `rel="noopener noreferrer sponsored"`) links to `ticketnetwork.lusg.net`, whose one hop is a 302 to `www.ojrq.net`. The return URL there is `goto.ticketnetwork.com/...tickets/8139280/anaheim-ducks-vs-calgary-flames-tickets-sun-nov-15-2026-honda-center`.
3. **The rail and back navigation hold.** The first rail card "SUN NOV 8 Kids' Socks Giveaway" (150x105) lands on H1 "KIDS' SOCKS GIVEAWAY". Browser back restored scrollY exactly: 1,614 to 1,614 on the branch and 1,714 to 1,714 on production, a delta of 0 px on both.

### 1.4 Defects

**H1. Honda Center is not linked and the page has no Before you go or quick facts. All viewports, both environments.** `390-branch.png` at 298 px. The page has no `/venues/` link at all, and no bag rule, gate time or parking. This is carried from the previous reviews. It also means the date-picked sample cannot show either surface this branch changes. Severity: low (carried).

**H2. The wordmark "NIGHT" is 4.33:1 (#da2d20 on #f7f3ea), 18 px / 800. All viewports, both environments.** axe `color-contrast` (serious) flags 1 node, `.text-rd-red`. It is brand red by ruling, but it is still under 4.5:1. Severity: low (ruled).

**H3. 33 of 51 interactive elements are under 44x44 at 390.** `390-branch.png`. Nine are in the article: the crumbs "NHL" 24x18 and "Anaheim Ducks" 84x18; "Also on Ticketmaster" 133x21; "nhl.com" 43x14; "Calgary Flames" 106x16; "Kids' Socks Giveaway" 149x16; "All Anaheim Ducks promos" 170x21; "Theme nights across pro sports" 198x21; "Hockey Fights Cancer Night 2025-26" 249x16. The other 24 are the header and footer (known-issues 78 to 80). Severity: low (carried).

**H4. At 768 the first Raptive container's insertion is the page's whole measured layout shift: 0.0392 on the branch, 0.0704 on production.** The page reserves no height for it. Severity: low (carried).

---

## URL 2: `/mlb/atlanta-braves/promos/austin-riley-short-sleeve-hoodie-giveaway` (played game, Truist Park)

This page is not in the sitemap (0 matches). It is canonical to itself and has no robots meta. Screenshots: `2026-11-08-fix-byg-clutch-row/austin-riley-short-sleeve-hoodie-giveaway/{390,768,1280}-{branch,production}.png`. Diffs: `.../{390,768,1280}-diff.png`. The aligned quick-facts section, branch on the left and production on the right, is in `.../{390,768,1280}-quickfacts-branch-vs-production.png`.

### 2.1 Baseline differences

**Expectation confirmed. The quick-facts surface renders on this page** as "TRUIST PARK, QUICK FACTS" (Gates, Bag policy, Parking, Transit, Outside food, then a "Truist Park gameday guide" link to `/venues/truist-park`). Its bag line reads `No bags, except clutches up to 5" x 9".` on the branch and `Bags are not allowed.` on production. That is two numbers, as stored. **The Before you go block does not render on either environment** (0 occurrences of "Before you go" and 0 of "Checked " in a bag row), so change (1) has no surface here.

- **Served `<article>` HTML.** After normalization the two sides are 767 lines each (branch 46,767 bytes, production 46,739). They differ in **exactly one region**:

  | Region | Branch | Production |
  |---|---|---|
  | Quick facts, Bag policy `<dd>` | `No bags, except clutches up to 5&quot; x 9&quot;. <a href="https://www.mlb.com/braves/ballpark/information/guide" ... class="text-rd-link">Official bag policy</a>` | `Bags are not allowed. <a href="https://www.mlb.com/braves/ballpark/information/guide" ... class="text-rd-link">Official bag policy</a>` |

  There is no Ticketmaster difference here because the played state renders no ticket links. Counted over the whole document with `grep -o`, the new sentence appears 2 times on the branch (the `<dd>` plus its RSC flight copy) and the old one 2 times on production, with 0 of the other on each side. `5&quot; x 9&quot;` appears once on the branch and 0 times on production. "Max bag" appears 0 times on both. Neither sentence is in any JSON-LD.
- **Pixels.**

  | Viewport | Branch PNG | Production PNG | Raw differing pixels (masked overlap) | Aligned per section |
  |---|---|---|---|---|
  | 390 | 390x4941 | 390x5071 | 83,990 of 1,926,990 = 4.36% (26.7% masked) | QUICK FACTS **1,372 px**, all inside x 201-353, y 1,311-1,364, the Bag policy cell. THIS GAME **59 px** at x 25-49, y 787-793, the dev-tools indicator. Every other section is 0. Everything from QUICK FACTS down sits 50 px lower on production, where the first content ad filled at 300 px against the dev's empty 250 px, and another 50 px lower from QUESTIONS down |
  | 768 | 768x3736 | 768x3916 | 112,987 of 2,869,248 = 3.94% (31.1% masked) | QUICK FACTS **1,385 px**, inside x 390-668, y 1,170-1,203, the Bag policy cell. Every other section is 0 |
  | 1280 | 1280x3668 | 1280x3748 | 141,039 of 4,695,040 = 3.00% (21.7% masked) | QUICK FACTS **1,379 px**, inside x 647-990, y 1,146-1,158, the Bag policy cell. Every other section is 0 |

  The quick-facts section is the same height on both environments at every viewport (607 / 397 / 376 px). The bag cell is taller on the branch (63 vs 42 px at 390, 42 vs 21 at 768), but the Gates cell beside it in the same grid row is taller still, so nothing below moves.
- **Measurements that moved.**

  | Measurement | Branch | Production | Why |
  |---|---|---|---|
  | Bag `<dd>` size, 390 / 768 / 1280 | 159x63 / 284x42 / 348x21 | 159x42 / 284x21 / 348x21 | the longer sentence |
  | "Official bag policy" link box at 390 | **149x36**, because the link breaks across two lines ("Official bag / policy"; at 768 "Official / bag policy") | 109x15, on one line | the longer sentence pushes the link to a line break (D6) |
  | CLS at 390 | 0.0001 | 0.0113 (a `google_ads_iframe` Footer container at 2.7 s) | ad fill, not the branch |
  | Interactive / under 44, 390 | 43 / 34 | 47 / 38 | production adds Raptive's close, pause and unmute controls; 10 in the article on both |
  | Page errors | 0 | 1 at 390 (`SecurityError` from a `safeframe.googlesyndication.com` frame), 2 at 768 | ad-tech |

### 2.2 Game date check

- **Dates on the page (390, branch and production identical).** The header `<time datetime="2026-09-22T19:15:00-04:00">` reads "Tuesday, Sep 22, 2026 · 7:15 PM ET" at 368 px. Under it, "This game has been played". The date tile reads "TUE 22 SEP", with no state line. The timeline caption reads "Sep 22 · Austin Riley Short Sleeve Hoodie Giveaway · home game 80 of 87".
- **JSON-LD.** One Event, `startDate` "2026-09-22", **no `offers`**, `eventStatus` EventScheduled.
- **Venue zone.** Truist Park, Atlanta, so America/New_York. Today there is 2026-11-08.
- **Verdict: every date is before today. This is a played game, 47 days ago.** It is reported as defect D1 below. It is also listed under things that work, because the page's played state renders correctly.

### 2.3 Three things that work

1. **The played state is plain and honest.** `390-branch.png` from 336 to 562 px. "This game has been played" sits in bold directly under the date. Tickets, Also on Ticketmaster, Parking, Hotels and Remind me are all absent from the page (the article has 0 links to `lusg.net`, `ticketmaster`, `spothero`, `expedia` or `/download`). The Event JSON-LD carries no `offers`. What remains is "Next Atlanta Braves promo" (144x52, links to `/mlb/atlanta-braves`), "Share" (102x52) and the venue facts.
2. **The new bag sentence is the one a Truist Park fan needs, and it appears once, as an exception.** `390-quickfacts-branch-vs-production.png`. The branch reads "No bags, except clutches up to 5" x 9"." beside the "Official bag policy" link to mlb.com. The 5 x 9 figure appears once in the served HTML, never as "Max bag". It agrees with the building's own hub FAQ, which says "small single-compartment clutches or clear bags no larger than 5 x 9 inches".
3. **The rail and back navigation hold.** The first card in "More giveaways across pro sports", "NOV 08 Bear Down Scarf, Chicago Bears" (358x61), lands on H1 "BEAR DOWN SCARF". Browser back restored scrollY exactly: 1,927 to 1,927 on the branch and 1,407 to 1,407 on production, 0 px on both.

### 2.4 Defects

**D1. Played game: Sep 22, 2026, 7:15 PM ET at Truist Park, 47 days before today. All viewports, both environments.** `390-branch.png`, top. For this played game the page offers no tickets, no parking, no hotels and no reminder. It offers a "This game has been played" line, a "Next Atlanta Braves promo" button, Share, the Truist Park quick facts and the Questions block. Reported first because the agent rules require it. The played state itself works (2.3, item 1). Severity: per rule; nothing on the page is wrong about the date.

**D2. "Next Atlanta Braves promo" leads to no next promo. All viewports, both environments.** `390-branch.png` at 468 px. The button links to `/mlb/atlanta-braves`, H1 "ATLANTA BRAVES". That page reads "96 promotions in the 2026 season", and its served data carries `upcomingCount: 0` and `upcomingCounts: {giveaway: 0, theme: 0, kids: 0, food: 0}`. The button promises a specific next promo, and the destination has none to show until the 2027 schedule lands. Severity: medium.

**D3. At 390 the "Next Atlanta Braves promo" label wraps onto two lines and sits flush against the button's top-left edge. 390 only, both environments.** `390-branch.png` at 468 to 520 px, and `390-production.png` at the same place. The `<a>` has `padding: 0` and inherits `text-align: start`. On one line (768, 1280) `justify-content: center` hides that. Wrapped, the two lines are left-aligned, touch the left edge and nearly the top, and look like overflow. "Get tickets" on upcoming pages is short enough never to wrap, which is why this has not shown before. Severity: medium-low (visual, first screen).

**D4. The quick-facts links fail `link-in-text-block` (axe, serious). All viewports, both environments.** 2 nodes: "Official bag policy", on the row this branch changes, and "Official lot map". Both are #c62a1e at 2.99:1 against the surrounding #211d18 text in the same `<dd>` (axe needs 3:1 between a link and its sentence when there is no underline), with `text-decoration-line: none`. The previous branch underlined the source-line links but not these. Severity: medium (serious accessibility rule; not introduced by this branch).

**D5. The new sentence reads as the only exception. All viewports, branch.** `390-quickfacts-branch-vs-production.png`. "No bags, except clutches up to 5" x 9"." says the clutch is the one thing allowed. The building's hub FAQ, served on both environments from the same data, lists more: "medical bags no larger than needed for necessary medical equipment, breast pumps for nursing mothers, diaper bags for guests with infants/toddlers, bags required for guests with ADA needs, and small single-compartment clutches or clear bags no larger than 5 x 9 inches". A parent with a diaper bag reading only this line would conclude it is refused. Production's "Bags are not allowed." is worse on the same count, so this is not a regression, but the new line is still incomplete. The "Official bag policy" link sits beside it. Severity: low.

**D6. Branch only: the "Official bag policy" link now breaks across two lines at 390 and 768.** `390-branch.png` at 1,311 to 1,370 px ("Official bag" / "policy"), and `768-quickfacts-branch-vs-production.png` ("Official" / "bag policy"). The link's box grows from 109x15 to 149x36 at 390. It still taps, but it reads as two fragments. At 1280 it stays on one line. Severity: low (introduced by the branch's longer sentence).

**D7. One click away, the same fan reads a different bag rule. Branch, all viewports.** The promo page now says "No bags, except clutches up to 5" x 9"." The team page that "Next Atlanta Braves promo" leads to still says "BAG POLICY No bags. Review the official bag policy before you arrive." in GAME DAY AT TRUIST PARK, on both environments, because the diff does not touch that surface. Neither sentence is false, but they disagree on the one point a fan checks. Severity: low (outside this diff's two surfaces; recorded so the inconsistency is on file).

**D8. "More Atlanta Braves promos" is a heading over two text links. All viewports, both environments.** `390-branch.png` at 2,127 to 2,234 px. The section has no cards, only "All Atlanta Braves promos" (163x21, to the team page) and "Jersey and apparel giveaways across pro sports" (302x21, to `/promos/jersey-giveaways`, whose H1 is "UPCOMING JERSEY, HAT & APPAREL GIVEAWAYS"). The Braves have no upcoming promos, so the section is near-empty. It also restates the CTA in D2: both point at the team page. Severity: low.

**D9. Transit restates one route three ways, in a 159 px column. 390, both environments.** `390-quickfacts-branch-vs-production.png`. "Lines: CobbLinc Bus 10, CobbLinc Route 15, CobbLinc Rapid 10, CobbLinc Route 10, Cumberland Circulator (Blue/Green routes), MARTA Bus 12" follows a sentence that already names "CobbLinc Bus 10". At 390 the two-column grid gives the cell 159 px, so it runs 15 lines, the tallest block in the section. "Rapid 10", "Bus 10" and "Route 10" mean nothing to a visitor without the operator's naming scheme. Severity: low.

**D10. The wordmark "NIGHT" is 4.33:1, and 34 of 43 interactive elements are under 44x44 at 390. Both environments.** The same as H2 and H3. The 10 in the article are: "MLB" 25x18; "Atlanta Braves" 78x18; "Truist Park" 71x16; "mlb.com" 47x14; "Cincinnati Reds" 107x16; "Official bag policy" 149x36 on the branch (109x15 on production); "Official lot map" 92x15; "Truist Park gameday guide" 328x21; "All Atlanta Braves promos" 163x21; "Jersey and apparel giveaways across pro sports" 302x21. Severity: low (carried).

Not defects:
- The white full-width band across THIS GAME in every branch full-page capture (390 at y 794-844, 1280 at y 710-800) is Raptive's fixed footer, unfilled on the dev server. Playwright stitches it at the top of the document.
- The black "N" is the Next.js dev-tools indicator.
- The 250 px blank boxes in the branch captures are unfilled Raptive containers.
- On production at 390 the sticky outstream video (178x100 at 672 px) and the 50 px footer ad cover the bottom of the first viewport, with "Close sticky video" at 22x20 and a "×" at 2.12:1. This is third-party and carried.

---

## Measurements (390 unless noted)

| Measurement | URL 1 branch | URL 1 production | URL 2 branch | URL 2 production |
|---|---|---|---|---|
| HTTP status | 200 | 200 | 200 | 200 |
| `promonight-deploy` | absent (dev server) | dpl_2rB3PFo5UdpAzh5juvKEMGtgWQgy | absent (dev server) | dpl_2rB3PFo5UdpAzh5juvKEMGtgWQgy |
| Served HTML bytes | 419,354 | 139,505 | 390,630 | 148,766 |
| Article HTML, normalized | 566 lines; 1 differing region (Ticketmaster wrap, env) | 566 lines | 767 lines; 1 differing region (the bag `<dd>`) | 767 lines |
| Bag line | none on page | none on page | `No bags, except clutches up to 5" x 9".` (quick facts) | `Bags are not allowed.` (quick facts) |
| Before you go block | absent | absent | absent | absent |
| Pixel diff, raw, 390 / 768 / 1280 | 2.55% / 1.44% / 0% | (same comparison) | 4.36% / 3.94% / 3.00% | (same comparison) |
| Pixel diff, aligned per section | 0 everywhere but 102 px of dev indicator at 390 | (same comparison) | QUICK FACTS 1,372 / 1,385 / 1,379 px, all in the bag cell; 59 px of dev indicator at 390; all else 0 | (same comparison) |
| Document height, 390 / 768 / 1280 | 5,242 / 4,170 / 4,085 | 5,292 / 4,200 / 4,085 | 4,941 / 3,736 / 3,668 | 5,071 / 3,916 / 3,748 |
| Interactive / under 44x44, 390 | 51 / 33 (9 in article) | 55 / 37 (9) | 43 / 34 (10) | 47 / 38 (10) |
| Under 44x44, 768 / 1280 | 38 / 39 | 42 / 43 | 39 / 40 | 43 / 41 |
| Contrast failures < 4.5:1 (own walker; text nodes checked) | 1 of 124: "NIGHT" 4.33:1 | 2 of 125: "NIGHT", Raptive "×" 2.12:1 | 1 of 107: "NIGHT" | 2 of 108: "NIGHT", Raptive "×" |
| axe serious + critical, first party | `color-contrast` 1 node | same | `color-contrast` 1, `link-in-text-block` 2 | same |
| axe, ad-tech (in `google_ads_iframe_*`) | none (ads unfilled) | `aria-command-name`, `frame-focusable-content`, `frame-title`, `image-alt` (768 and 1280 add `button-name`, `label`, `link-name`) | none | `frame-title`, `image-alt` (1280 adds `link-name`) |
| CLS during load + 5 s, 390 / 768 / 1280 | 0.0002 / 0.0392 / 0.0016 | 0.0002 / 0.0704 / 0.0016 | 0.0001 / 0.0379 / 0.0002 | 0.0113 / 0.0379 / 0.0002 |
| `<a>` to `/promos/`: DOM / visible (390; 768 and 1280) | 21 / 19; 21 / 20 | 21 / 19; 21 / 20 | 14 / 12; 14 / 13 | 14 / 12; 14 / 13 |
| Hidden `/promos/` anchors | two "Today" links in the desktop nav and closed menu | same | same | same |
| First ad anchor from document top | `data-ad-region="content"` on `<article>` at 57 px; no `data-ad-item`; first content container at 891 px | same; first container at 891 px (filled) | `<article>` at 57 px; first content container at 962 px (empty) | same; at 962 px (filled at 300 px) |
| Game date(s) | `<time>` 2026-11-15T17:00-08:00; Event startDate 2026-11-15 | same | `<time>` 2026-09-22T19:15-04:00; Event startDate 2026-09-22 | same |
| Played-game verdict | upcoming (7 days) | upcoming | played (47 days ago) | played |
| Primary CTA | "Get tickets" 144x52, links to `ticketnetwork.lusg.net`, 302 to `www.ojrq.net` | same href | "Next Atlanta Braves promo" 144x52, links to `/mlb/atlanta-braves` (H1 "ATLANTA BRAVES", 0 upcoming) | same |
| Rail card, label vs destination H1 | "SUN NOV 8 Kids' Socks Giveaway" / "KIDS' SOCKS GIVEAWAY" (match) | same | "NOV 08 Bear Down Scarf" / "BEAR DOWN SCARF" (match) | same |
| Back: scrollY before / after 6 s | 1,614 / 1,614 (0 px) | 1,714 / 1,714 (0 px) | 1,927 / 1,927 (0 px) | 1,407 / 1,407 (0 px) |
| Console errors / page errors, 390 | 27 / 0 | 20 / 0 | 21 / 0 | 15 / 1 (safeframe SecurityError) |

## One recommendation

Merge. On both URLs the served HTML differs from production only where the branch set out to change it: one `<dd>` on the Truist Park page, and nothing on the sample beyond the standing Ticketmaster env difference. The pixels follow that `<dd>` and nothing else. The defect most worth fixing next is not in this diff. It is D2 plus D3 together: on every played page the only primary button left is "Next Atlanta Braves promo". It wraps flush-left at 390 and lands on a team page with zero upcoming promos. Until a club has a next promo, the button should not promise one.

## Dispositions (merge rule, 2026-11-08)

Screenshots and diff images were not committed, following the earlier 2026-11-08 reports (only the reports are tracked under `docs/ux-review/`); they are kept outside the repo with the session's scratch files.

| Defect | Disposition | Reason |
|---|---|---|
| D1 played game | waived | Listed by rule; the played state renders correctly in both environments. |
| D2 "Next … promo" leads to a team page with nothing upcoming | deferred, known-issues 83 | Present on production; not introduced by this diff. |
| D3 that button wraps flush at 390 | deferred, known-issues 83 | Same control as D2, same fix pass. |
| D4 red quick-facts links at 2.99:1, no underline | deferred, known-issues 85 | Present on production; the link sits on the changed row, but its color and decoration are unchanged by this diff. |
| D5 the sentence reads as if the clutch were the only exception | waived | The wording is the owner's ruling of 2026-11-08 verbatim; the building's other exceptions stay in its bag notes on the venue page. Cross-surface consistency is tracked in known-issues 84. |
| D6 "Official bag policy" wraps at 390 and 768 | waived | No overflow; the tap target grows (109x15 to 149x36), which is in the right direction for known-issues 78. |
| D7 team page still says "No bags." | deferred, known-issues 84 | The ruling scoped this change to the Before you go row and the quick-facts fallback; the team and venue bag surfaces are a separate pass. |
| D8 "More … promos" has no cards | waived | Present on production; the Braves are in the offseason, so there is nothing upcoming to card. |
| D9 CobbLinc 10 listed three ways in Transit | waived | Stored transit wording, present on production; transit is re-sourced to the agency page in pipeline step G (next session), which rewrites this field. |
| D10 logo "NIGHT" at 4.33:1; 34 of 43 targets under 44x44 | waived / known-issues 78 | The logo color is kept by an earlier brand ruling; the tap targets are known-issues 78. |
| H1 Honda Center has no Before you go or quick facts | waived | The building is held unverified by owner ruling 3 (promo-pipeline data/venuehubs-verification-holds.json, ticket T6); expected. |
| H2 logo contrast | waived | As D10. |
| H3 33 of 51 targets under 44x44 | known-issues 78 | Carried. |
| H4 Raptive first ad box is the whole layout shift at 768 | known-issues 82 | Carried. |
