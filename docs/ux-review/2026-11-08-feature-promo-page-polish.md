# UX review: promo page, baseline mode (feature/promo-page-polish vs production)

Date: 2026-11-08 (America/New_York). Branch: `feature/promo-page-polish`, HEAD 1711b58 (the same commit as main; the branch has no commits of its own) with its changes uncommitted in the working tree at review time (`src/components/promo-page/PromoPageView.tsx`, `src/components/promo-page/SeasonTimeline.tsx`, `src/lib/promo-date-tile.ts`, `src/lib/promo-explainers.ts`, `src/lib/promo-page-time.ts` (new), `src/app/globals.css`, their tests, `scripts/live/team-pages.live.test.ts`, `docs/known-issues.md`); the dev server renders that working tree. Page type `promo`.

**Sample path, resolved from the sitemap at run time:** `/nhl/anaheim-ducks/promos/hockey-fights-cancer-night`, game date **Sunday, Nov 15, 2026, 5:00 PM PT at Honda Center, Anaheim** (JSON-LD Event `startDate` "2026-11-15"). Method: https://www.getpromonight.com/sitemap.xml (lastmod 2026-11-08T14:07:52Z) lists 1,354 promo page URLs (`/{sport}/{team}/promos/{slug}`; the seven `/promos/{type}` aggregators excluded); each was fetched in sitemap order with a desktop Chrome User-Agent, the first Event `startDate` in its JSON-LD read, and its first ten characters compared as a string with "2026-11-15" (today + 7). Candidates 1 to 73 carry first dates before the cutoff (the last of them Nov 14: Chicago Blackhawks Stadium Ornament, Montreal Canadiens Hockey Fights Cancer Night, Pittsburgh Penguins Hall of Fame Game, Washington Capitals Veterans Day, among others); candidate 74 is the first on or after it, so it is the sample, the same page as the previous run. The same path was rendered on both environments.

- Branch render: Next.js dev server at http://127.0.0.1:3100. Its HTML carries no `<meta name="promonight-deploy">` (the dev server has no deployment id); the served page is 392,620 bytes with 151 `<script>` tags (dev runtime). The page was warmed with curl before measuring (first compile 2.1 s).
- Production render: https://www.getpromonight.com, `<meta name="promonight-deploy" content="dpl_5Hc7BGHrrPYQkAnW8r4X9c4T4nfe">`, main 1711b58; 145,236 bytes, 64 `<script>` tags.
- Tooling: Playwright 1.65 (Chromium headless), desktop Chrome User-Agent on both contexts, device scale 1, viewports 390x844, 768x1024, 1280x800, 5 s settle after `load`, a scroll-through to trigger lazy mounts before each full-page capture, @axe-core/playwright, pixelmatch (threshold 0.1). Screenshots: `2026-11-08-feature-promo-page-polish/hockey-fights-cancer-night/<viewport>-<env>.png`, diffs `<viewport>-diff.png` (red = differing, light blue = masked ad iframes), plus `390-branch-fold-edge.png` (the bottom of the first 390 viewport, 2x) and `1280-branch-timeline-hover.png` (the timeline with a dot hovered).

## 1. Baseline differences (branch vs production)

Expected: the eight changes listed for the branch plus the Ticketmaster Impact wrap (dev server env var). Found: the HTML differs in exactly nine places, which are those eight changes and the wrap; two of the eight leave no trace on this page (the date tile and the "Checked" copy, explained below); the pixel differences align with them; nothing unexpected.

### 1a. Served HTML of `<article>`

**Open tag:** identical on both, including `overflow-anchor:none` (production carries the previous branch).

**Inner HTML:** branch 691 normalized lines (35,909 bytes), production 769 (41,304 bytes), after stripping the deploy meta, `/_next/static` hashes, `?v=` strings, `nonce` attributes and `<script>` bodies. A line diff reports 91 raw regions (72 of them are the 36 timeline dots, two regions each); they group into these nine:

| # | Region | Branch | Production | Expected change |
|---|---|---|---|---|
| 1 | Breadcrumb, last crumb | `<span aria-current="page" class="text-rd-ink-soft">Hockey Fights Cancer Night</span>` | `<a class="no-underline hover:text-rd-ink" href="/nhl/anaheim-ducks#promo-2026-11-15-hockey-fights-cancer-night">Promos</a>` | 5 |
| 1b | BreadcrumbList JSON-LD (outside the article, read from the full document) item 3 | name "Hockey Fights Cancer Night", item `https://www.getpromonight.com/nhl/anaheim-ducks/promos/hockey-fights-cancer-night` | name "Promos", item `https://www.getpromonight.com/nhl/anaheim-ducks#promo-2026-11-15-hockey-fights-cancer-night` | 5 |
| 2 | Header game line | `<strong class="text-rd-ink"><time dateTime="2026-11-15T17:00:00-08:00">Sunday, Nov 15, 2026 · 5:00 PM PT</time></strong>` | `<strong class="text-rd-ink">Sunday, Nov 15, 2026 · 5:00 PM</strong>` | 6 |
| 3 | "Also on Ticketmaster" href | `https://www.ticketmaster.com/anaheim-ducks-tickets/artist/805893` | `https://ticketmaster.evyy.net/c/7236189/264167/4272?u=...&sharedid=web_promo_page_anaheim-ducks&subId3=hockey-fights-cancer-night` | env var, every run |
| 4 | Seven text links: Also on Ticketmaster, nhl.com, Calgary Flames, Kids' Socks Giveaway, All Anaheim Ducks promos, Theme nights across pro sports, Hockey Fights Cancer Night 2025-26 | class `text-rd-link` | class `text-rd-red` | 8 |
| 5 | THIS GAME `<dl>` | Opponent, Also at this game | Opponent, **Game** "Sunday, Nov 15, 2026 · 5:00 PM", **Home schedule** "Home game 11 of 42", Also at this game | 1 |
| 6 | Timeline `<svg>` | `role="img"` | `role="group"` | 3 |
| 7 | 36 timeline dots | `<circle cx=".." cy="22" r="5" ...><title>Oct 4: Home Opener</title></circle>` | `<g role="button" tabindex="0" aria-label="Oct 4: Home Opener" aria-pressed="false" class="cursor-pointer outline-none"><title>..</title><circle .../></g>` (`role="button"` 36 times in the document; 0 on the branch) | 3 |
| 8 | Guide eyebrow | `Fan guide` | `General guide` | 7b |
| 9 | Three FAQ cards | `<details class="rounded-xl border border-rd-line bg-rd-card"><summary class="cursor-pointer px-3.5 py-3 ...">` and `<p class="m-0 px-3.5 pb-3 ...">` | `<details class="... px-3.5 py-3"><summary class="cursor-pointer ...">` and `<p class="mb-0 mt-2 ...">` | 4 |

Not visible in the HTML on this page: change 2 (the date tile) reads "IN 7 DAYS" on both, because production's old rule also counted days inside two weeks; the new rule differs only beyond 14 days ("In 23 days" where production says a weekday), tomorrow ("Tomorrow" where production says "In 1 day") and after the game (no line where production says the weekday). Change 7a ("Checked <date>" for "Source read <date>") cannot show because this page renders no Before you go block at all (0 occurrences of either string on both sides; see D4). Everything else is identical: all 21 `/promos/` anchors, the five rail cards, the five "Same promo, other teams" rows, the provenance line, the Event JSON-LD (`startDate` "2026-11-15", `offers` present), the Get tickets href.

### 1b. Pixel comparison

Every iframe and every `data-ad-*` element other than the article was masked; the overlap of the two captures was compared raw and then per article content section, aligned by each section's own top (ad containers skipped), with a second pass allowing a 1 px shift to separate sub-pixel rounding from content.

| Viewport | Branch PNG | Production PNG | Raw differing pixels (unmasked) | Where | Aligned per content section |
|---|---|---|---|---|---|
| 390 | 390x5242 | 390x5249 | 206,995 of 1,490,217 = **13.89%** (27.1% masked: production's 390x844 `gg-ad-iframe` overlay over the first viewport, three in-article ad iframes, the sticky video and anchor ad) | everything from THIS GAME down: the branch card is 82 px shorter (197 vs 279), so every later section sits 81 px higher, and Raptive placed one more content container on the branch (five plus below-post, between THIS GAME and FAN GUIDE, FAN GUIDE and the rail, SAME PROMO and PREVIOUS EDITION, QUESTIONS and the disclosure) than on production (four plus below-post); article children 16 vs 15 | nav **413 px** (the crumb), header **45 px** (" PT"), CTA row 0, About 0, THIS GAME **1,342 px** (the two rows), FAN GUIDE **2,553 px** (the eyebrow), rail **667 px** (link colour), SAME PROMO 0, PREVIOUS EDITION **148 px** (link colour), QUESTIONS **0** (the padding move changes no pixel), disclosure 433 px (mono-font anti-aliasing; the side-by-side crop shows identical text) |
| 768 | 768x4170 | 768x4279 | 231,584 of 2,787,482 = **8.31%** (13.0% masked) | same offset (110 px here: 60 px of card plus a 300 px production ad fill against the 250 px branch container) | nav 413, header 45, CTA 0, About 0, THIS GAME 4,236, FAN GUIDE 4,858 (at dy −1), rail 946, SAME PROMO 503 at dy −1 (4,426 unshifted: sub-pixel), PREVIOUS EDITION 0, QUESTIONS 91 at dy +1 (2,251 unshifted: sub-pixel), disclosure 374 (anti-aliasing) |
| 1280 | 1280x4085 | 1280x4144 | 242,757 of 5,001,210 = **4.85%** (4.4% masked) | same offset (59 px), plus the Next.js dev-tools "N" indicator bottom-left on the branch only | nav 413, header 45, CTA 0, About 0, THIS GAME 2,360, FAN GUIDE 3,758, rail 946, SAME PROMO 293 (noise), PREVIOUS EDITION 0, QUESTIONS 0, disclosure 0 |

The red shift from #da2d20 to #c62a1e sits near pixelmatch's 0.1 threshold, so it registers only partly (the rail's two links, Previous edition at 390). At 390 the production overlay iframe covers the whole first viewport; the raw diff masks it, the aligned pass does not, and the nav and header differences then match 768 and 1280 exactly (413 and 45 px). Diff images: `2026-11-08-feature-promo-page-polish/hockey-fights-cancer-night/390-diff.png`, `768-diff.png`, `1280-diff.png`. Nothing differs that the HTML does not account for.

### 1c. Measurements that moved between the two renders (390 unless noted)

| Measurement | Branch | Production | Why |
|---|---|---|---|
| Interactive elements (`a, button, [role=button], input, summary`) | **51** (768: 57; 1280: 57); 27 in the article | 93 (99; 99); 64 in the article | 36 dots no longer carry `role="button"`; the "Promos" crumb is gone; production adds eight Raptive controls |
| Under 44x44 | **33** (38; 39); 9 in the article | 78 (83; 84); 49 in the article | the dots (5x5), the crumb (42x18) and the three FAQ summaries (328x21, now 356x45) left the list |
| Red text links, measured | **#c62a1e: 5.06:1 on the cream #f7f3ea** (Also on Ticketmaster, nhl.com, All Anaheim Ducks promos, Theme nights across pro sports, Hockey Fights Cancer Night 2025-26), **5.60:1 on the white card** (Calgary Flames, Kids' Socks Giveaway) | #da2d20: 4.33:1 on cream, 4.80:1 on white | change 8; confirmed on the rendered pixels (reddest pixel of "Also on Ticketmaster" is #c62a1e on the branch, #da2d20 on production) |
| Wordmark "NIGHT", measured | **#da2d20 on the rendered header #d3d0ca: 3.12:1** (axe: 3.11:1), 18 px / 800 | same, 3.12:1 | unchanged by design; see D1 for why the header is not cream |
| Text nodes checked / contrast failures < 4.5:1 (own walker) | 99 / **1** (the wordmark) | 104 / 7 (wordmark, five red links, Raptive "×" 2.12:1) | |
| axe `color-contrast` (serious) nodes | **6** (wordmark 3.11:1; five footer `text-white/40` texts at 3.76:1 on #211d18) | 11 (those six plus the five red links at 4.33:1) | change 8 cleared the five link nodes |
| THIS GAME card height | 197 (768 and 1280: 197) | 279 (257; 257) | change 1 |
| Timeline top | 804 (its bottom edge at 844, the fold) | 885 | the shorter card; see D2 |
| First Raptive container | 891 (768: 815; 1280: 777), 250 px, empty | 972 (875, filled at 300; 837), filled | moved up with the card; one more container on the branch at 390 |
| CLS (load + 5 s) | 0.0001 / **0.0392** / 0.0016 | 0.0113 / 0.0274 / 0.0302 | 768: the first container's insertion is the whole number on both (0.0383 at 751 ms on the branch, 0.0265 at 538 ms on production); it now lands 60 px higher in the 1024 px viewport, so it displaces more. 390 and 1280 on production: an ad `div` growing at 2.4 s and 3.0 s |
| Document height | 5,242 / 4,170 / 4,085 | 5,249 / 4,279 / 4,144 | card height, ad count and ad fill |
| `<time>` elements | 1 | 0 | change 6 |
| Browser back from a rail card: scrollY before / after 6 s / delta | **1,923 / 1,923 / 0 px, 2 of 2 runs** | **1,744 / 1,744 / 0 px, 2 of 2 runs** | both pass; production carries the previous branch's fix. The rail heading sits lower on the branch because of the extra ad container above it |
| Console errors / page errors | 34, 31, 41 / 0 | 25, 25, 19 / 1, 0, 1 | all ad-tech; production logged a minified React error #418 (hydration mismatch) once at 390 and a cross-origin frame access error at 1280 |

Unchanged between renders: the H2 list; the Get tickets href and size (144x52); the rail cards and hrefs; the Same promo rows; `/promos/` anchors 21 in DOM / 19 visible; the date tile; the venue text; the Event JSON-LD; the two PromoNight axe violations (`color-contrast` for the wordmark and `link-in-text-block` for "nhl.com").

## 2. Game date check

- Dates read on the page (390, branch): header `<time datetime="2026-11-15T17:00:00-08:00">` "Sunday, Nov 15, 2026 · 5:00 PM PT" at 268 px; date tile "SUN 15 NOV, IN 7 DAYS" at 336 px; timeline caption "Nov 15 · Hockey Fights Cancer Night · home game 11 of 42" at 850 px. THIS GAME no longer repeats the date. The only other date in the article is the PREVIOUS EDITION link to the 2025-26 edition's own page, not this game. Production shows the same date without the zone and repeats it in THIS GAME.
- JSON-LD: one Event, `startDate` "2026-11-15" (date only), `location` Honda Center, California, `offers` present. Identical on both environments.
- Venue zone: the page states the building (Honda Center, Anaheim, California), so America/Los_Angeles; the `<time>` offset −08:00 is correct for Nov 15, 2026 (daylight time ended Nov 1) and "PT" is the right label. Today there is 2026-11-08, as it is in America/New_York.
- **Verdict: upcoming, exactly seven days out. Not a played game.** The played state is correctly absent on both environments (Get tickets, Share, Also on Ticketmaster, Parking, Hotels and Remind me all render; the Event carries `offers`). The date tile's "Tomorrow" and played-date behaviour cannot be exercised on this sample.

## 3. Three things that work

1. **The first screen says when, where and against whom once, and the machine can read it.** `390-branch.png`, top. "Sunday, Nov 15, 2026 · 5:00 PM PT" is a `<time datetime="2026-11-15T17:00:00-08:00">` under the H1 at 268 px, the venue line follows at 298 px, and THIS GAME (683 to 880 px) is now Opponent "Calgary Flames", "Also at this game: Kids' Socks Giveaway · Kids", the timeline and its caption "Nov 15 · Hockey Fights Cancer Night · home game 11 of 42": 197 px instead of 279 and no sentence repeated from the header. The crumb trail ends in the page's own title as plain text ("NHL / Anaheim Ducks / Hockey Fights Cancer Night", `aria-current="page"`, rgb(80,72,63) against rgb(120,110,96) for the two links) and the BreadcrumbList's third item carries that title with the canonical URL.
2. **The season timeline is a picture that explains itself on a mouse and stays still under a thumb.** `1280-branch-timeline-hover.png`. The SVG is `role="img"` with 0 `role="button"`, 0 `tabindex` and 0 focusable nodes inside it (production: 36 of each). At 1280 with a real pointer path, hovering the dot titled "Jan 10: Kids' Socks Giveaway" renames the caption to "Jan 10 · Kids' Socks Giveaway · home game 25 of 42" with a 121x14 link to that page in #c62a1e; leaving the bar restores "Nov 15 · Hockey Fights Cancer Night · home game 11 of 42". Under touch emulation at 390 (`(hover: hover) and (pointer: fine)` false) the circles have no handler attached (`onMouseEnter` undefined, the wrapper's `onMouseLeave` undefined) and tapping the same dot changes nothing and navigates nowhere, where production's `<g role="button">` still swaps the caption on tap. Hydration completes 60 ms after `load` on the dev server.
3. **The remaining controls are real targets and the colour work lands where it was aimed.** `390-branch.png` at 3,013 to 3,170 px: each FAQ `<summary>` is now 356x45, the whole card less its 1 px border (328x21 on production), so a thumb anywhere on the card opens the answer. The seven text links measure 5.06:1 on cream and 5.60:1 on the white card (4.33:1 and 4.80:1 on production); axe's `color-contrast` count drops from 11 nodes to 6 and none of the remaining six is a promo-page link. The walk holds: "Get tickets" (144x52, `rel="noopener noreferrer sponsored"`, new tab) goes `ticketnetwork.lusg.net` → 302 → `www.ojrq.net` (first hop) → 302 `goto.ticketnetwork.com` → 301 → `www.ticketnetwork.com/tickets/8139280/anaheim-ducks-vs-calgary-flames-tickets-sun-nov-15-2026-honda-center` (200), this exact game; the first rail card "SUN NOV 8 Kids' Socks Giveaway" (150x105) lands on H1 "KIDS' SOCKS GIVEAWAY"; browser back restores scrollY 1,923 exactly, with the Raptive script running, in 3 of 3 attempts (the walk plus two timed runs), and production restores 1,744 exactly in 2 of 2.

## 4. Defects

**D1. The wordmark "NIGHT" is 3.12:1 against the header a fan actually sees, not 4.33:1. All viewports, both environments.** `390-branch.png`, top left; axe `color-contrast` serious, first node `.text-rd-red`, reports 3.11:1 (fg #da2d20, bg #d3d0c9, 18 px bold, 4.5:1 required). The header is `bg-rd-cream/85 backdrop-blur` and its parent `div.rd-root` is `display: contents`, so that div's cream never paints behind the header; what shows through the 15% is the `body` background rgb(6,8,16), and the rendered band is #d3d0ca (sampled at (300,10) in both screenshots). Earlier reports quoted 4.33:1 "on cream" for the wordmark; that is the ratio against the page, which is not what sits behind the header. The branch keeps brand red on the wordmark by ruling, so this is the one red text on the page still under 4.5:1, and it is further under than was known.

**D2. At 390x844 the timeline's dots are the last thing in the first viewport and their caption is below it. 390 only, branch only.** `390-branch-fold-edge.png` (2x crop of y 770 to 880). The shorter card puts the SVG at 804 to 844 px, its bottom edge exactly at the fold, with the caption that names the dots at 850 px. A fan who does not scroll sees a row of 36 grey dots with a red ring, unlabelled, under "ALSO AT THIS GAME". On production the whole strip starts at 885 px, below the fold. The "N" button over the leftmost dots in the crop is the Next.js dev-tools indicator, dev server only.

**D3. Five footer texts at 3.76:1. All viewports, both environments.** `390-branch.png` from 4,094 px: "FREE WEEKLY EMAIL", the BROWSE, DISCOVER and COMPANY headings and the "© 2026 PromoNight" line are `text-white/40` on #211d18 (axe: fg #7a7774, 11 and 12 px). These are five of the six `color-contrast` nodes left on the branch; previous reports folded them into the node count without naming them. Shared footer, every page.

**D4. Honda Center is never linked and the page has no Before you go. All viewports, both environments.** `390-branch.png` at 298 px. "Honda Center, Anaheim" is plain text, there is no `/venues/` link anywhere on the page, and no bag rule, gate time or lots, because the hub is not indexable and `PromoPageView.tsx` renders the venue link and the Before you go block only then. Carried from the previous two reviews. It also means change 7a ("Checked <date>") has no surface on the resolved sample; the sample is chosen by date, not by content, so a page with a Before you go block would be needed to see it.

**D5. 33 of 51 interactive elements at 390 are under 44x44.** `390-branch.png`. In the article (9): breadcrumb "NHL" 24x18 and "Anaheim Ducks" 84x18; "Also on Ticketmaster" 133x21; "nhl.com" 43x14; "Calgary Flames" 106x16; "Kids' Socks Giveaway" 149x16; "All Anaheim Ducks promos" 170x21; "Theme nights across pro sports" 198x21; "Hockey Fights Cancer Night 2025-26" 249x16. Outside it (24): the wordmark 132x17, "Open menu" 40x40, "Get the week's giveaways in your inbox →" 266x20, nineteen footer links 15 px tall, "Do not sell or share my personal information." 259x15, "Terms of Content Use" 126x15. Down from 73 of 88 on the previous branch; known-issues 78 to 80 defer the shared ones. The hovered timeline caption's link is 121x14, pointer devices only, so it is not a touch target.

**D6. The promo-specific content is one sentence; the longest block is generic. 390.** `390-branch.png`. ABOUT THIS THEME NIGHT is "Cancer awareness themed game night presented by UCI Health." (110 px); FAN GUIDE / WHAT TO EXPECT AT A THEME NIGHT is 475 px of prose that applies to every theme night on the site. "FAN GUIDE" reads better than "GENERAL GUIDE" but still does not tell a fan the block is not about this night. The provenance line "Source: nhl.com · read Oct 2, 2026" is still internal language. Carried.

**D7. Five blank grey boxes in the branch render at 390** (891, 1,649, 2,596, 3,180 and 3,513 px; 250 px each), `390-branch.png`. Raptive containers injected after load and unfilled on the dev server. The branch render received one more than production (16 article children against 15): the first sits 11 px under THIS GAME, the second between FAN GUIDE and the rail, so a fan's second screen on the branch opens on a blank box and meets another before the rail. Container placement is Raptive's and follows content height, so this will move again on production. The page reserves no height for them in its own markup; at 768 the first insertion is the whole measured CLS on both environments and is larger on the branch (0.0383 against 0.0265). Carried, with the extra container noted.

**D8. Production only, 390: Raptive's sticky outstream video and anchor ad cover the bottom 183 px of the first viewport** (`390-production.png`, top: a 178x100 player at 670 px and a 390x183 container at 661 px over "Source: nhl.com · read Oct 2, 2026" and the top of THIS GAME; a `gg-ad-iframe` 390x844 overlay sits in the DOM), with "Close sticky video" 22x20, "Close advertisement" 24x22 and a "×" at 2.12:1. Production also logged a minified React error #418 (hydration mismatch) once at 390 this run; the branch logged no page errors. Third-party and carried, but it is what a first-time visitor on a phone sees.

**D9. "nhl.com" is told apart from its sentence by colour alone. All viewports, both environments.** axe `link-in-text-block` (serious), `a[rel="noopener nofollow"]` in "Source: nhl.com · read Oct 2, 2026": no underline, and the new red does not change the rule's verdict.

Not a defect: the black "N" button at bottom-left of every branch screenshot is the Next.js dev-tools indicator; it does not exist on production.

## 5. Measurements (390 unless noted)

| Measurement | Branch (dev, working tree on 1711b58) | Production (dpl_5Hc7BGHrrPYQkAnW8r4X9c4T4nfe, main 1711b58) |
|---|---|---|
| HTTP status | 200 | 200 |
| `promonight-deploy` meta | absent (dev server) | dpl_5Hc7BGHrrPYQkAnW8r4X9c4T4nfe |
| Served HTML bytes / `<script>` tags | 392,620 / 151 | 145,236 / 64 |
| `<article>` open tag | identical (`...;overflow-anchor:none`) | identical |
| Article inner HTML, normalized | 691 lines, 35,909 bytes; 9 differing regions (section 1a) | 769 lines, 41,304 bytes |
| Pixel diff, raw (390 / 768 / 1280) | 13.89% / 8.31% / 4.85% of unmasked overlap | same comparison |
| Pixel diff, aligned per content section | differs only in nav (413 px), header (45), THIS GAME (1,342 / 4,236 / 2,360), FAN GUIDE (2,553 / 4,858 / 3,758), rail (667 / 946 / 946), Previous edition (148 / 0 / 0); the rest 0 or sub-pixel | same comparison |
| Document height (390 / 768 / 1280) | 5,242 / 4,170 / 4,085 | 5,249 / 4,279 / 4,144 |
| Interactive elements (`a, button, [role=button], input, summary`) | 51 (768: 57; 1280: 57) | 93 (99; 99) |
| Under 44x44 | 33 (38; 39); none are timeline dots; FAQ summaries 356x45 | 78 (83; 84); 36 dots 5x5, FAQ summaries 328x21 |
| Red text links, contrast | #c62a1e: 5.06:1 on cream (5 links), 5.60:1 on white (2 links) | #da2d20: 4.33:1 on cream, 4.80:1 on white |
| Wordmark "NIGHT", contrast | #da2d20 on rendered header #d3d0ca: 3.12:1 (4.33:1 would be on page cream, which is not behind the header) | 3.12:1 |
| Text nodes checked / contrast failures < 4.5:1 | 99 / 1 (wordmark) | 104 / 7 (wordmark, five red links, Raptive "×" 2.12:1) |
| axe serious + critical (390 / 768 / 1280) | 2 / 2 / 2 (`color-contrast` 6 nodes, first `.text-rd-red`; `link-in-text-block` 1 node, `a[rel="noopener nofollow"]`) | 5 / 8 / 4 (ours with `color-contrast` at 11 nodes, plus `aria-command-name`, `frame-title`, `image-alt` critical, `button-name` critical, `label` critical, `link-name`, all inside `#google_ads_iframe_*`) |
| CLS during load + 5 s (390 / 768 / 1280) | 0.0001 / 0.0392 / 0.0016 | 0.0113 / 0.0274 / 0.0302 |
| `<a>` with `/promos/` in path: DOM / visible | 21 / 19 (hidden: two "Today" nav links in `hidden md:flex` and the closed menu `dialog`); 768 and 1280: 21 / 20 | 21 / 19; 21 / 20 |
| First ad anchor | `data-ad-region="content"` on the `<article>` at 57 px; no `data-ad-item`; first Raptive container at 891 px (250 px, empty); 5 content containers + below-post | same attributes; first container at 972 px (filled); 4 + below-post |
| `<time>` elements | 1: `datetime="2026-11-15T17:00:00-08:00"` "Sunday, Nov 15, 2026 · 5:00 PM PT" at 268 px | 0 |
| THIS GAME rows | Opponent; Also at this game (card 197 px) | Opponent; Game; Home schedule; Also at this game (279 px) |
| Date tile state line | "IN 7 DAYS" | "IN 7 DAYS" |
| Breadcrumb last crumb | `<span aria-current="page">` "Hockey Fights Cancer Night" 148x18, rgb(80,72,63) | `<a>` "Promos" 42x18 → team-page anchor |
| BreadcrumbList item 3 | "Hockey Fights Cancer Night", canonical URL | "Promos", `/nhl/anaheim-ducks#promo-2026-11-15-hockey-fights-cancer-night` |
| Timeline | `role="img"`; 0 `role=button`, 0 `tabindex`, 0 focusable; hover (1280) renames caption with a link, leave restores; touch (390) static | `role="group"`; 36 `role=button`, 36 `tabindex`; tap renames caption |
| Guide eyebrow | FAN GUIDE | GENERAL GUIDE |
| "Checked" / "Source read" | 0 / 0 (no Before you go on this page) | 0 / 0 |
| Date and time found | "Sunday, Nov 15, 2026 · 5:00 PM PT" at 268 px, above the fold | "Sunday, Nov 15, 2026 · 5:00 PM" at 268 px, repeated at 768 px |
| Venue found | "Honda Center, Anaheim" at 298 px, plain text, no `/venues/` link | same |
| "Get tickets" | 144x52 at 336 px, new tab, `ticketnetwork.lusg.net` → 302 → `www.ojrq.net` (first hop); browser continued → `goto.ticketnetwork.com` (302) → `www.ticketnetwork.com/tickets/8139280/...` (301, then 200) | identical href, not clicked |
| Rail card → destination H1 | "SUN NOV 8 Kids' Socks Giveaway" → "KIDS' SOCKS GIVEAWAY", match | identical cards, not clicked |
| Back: scrollY before / after 6 s / delta | 1,923 / 1,923 / 0, passes (2 of 2 timed runs, plus the walk) | 1,744 / 1,744 / 0, passes (2 of 2) |
| Console errors / page errors | 34 / 0 (ad-tech CORS) | 25 / 1 (ad-tech 400, 404, 424, DNS; React #418 once) |

## 6. One recommendation

Merge; the served HTML differs from production in exactly the nine places the branch set out to change and the pixels follow them. Then take the wordmark off the list the way it was measured here, not from the token sheet: the header band renders #d3d0ca on every page because the cream wrapper is `display: contents` and the body's near-black shows through the 85% header, so "NIGHT" sits at 3.12:1 where the ruling assumed 4.33:1, and it is now the only red text on the page below 4.5:1. Painting the intended cream behind the header is a layout fact to check in a screenshot pixel, as above, not in a source grep.

## Addendum, 2026-11-08: five additions before ship, re-measured on the branch dev server

Same sample page (`/nhl/anaheim-ducks/promos/hockey-fights-cancer-night`), same tooling (Playwright 1.65, desktop Chrome User-Agent, 390x844, 5 s settle, @axe-core/playwright). The additions: an opaque cream site header (`bg-rd-cream`, was `bg-rd-cream/85 backdrop-blur`; `div.rd-root` untouched), the timeline caption above the bar, footer eyebrows and copyright at `text-white/60` (were `/40`), underlines on the links that sit inside running text (the source line's domain link and the figcaption's "source"), and "checked <date>" for "read <date>" in the header provenance line.

| Measurement | Before (this report above) | After |
|---|---|---|
| Header pixel sampled at (300,10) in the 390 screenshot | #d3d0ca (the dark body through the 85% header) | **#f7f3ea**; (370,50) also #f7f3ea; computed header background rgb(247,243,234) |
| Wordmark "NIGHT" #da2d20 against the sampled header | 3.12:1 | **4.33:1** |
| Footer eyebrows and copyright on #211d18 | `text-white/40` = #7a7774, 3.76:1 | `text-white/60` = #a6a5a3, **6.81:1** (white composited at 60% over the ink; the browser reports the colour in oklab with alpha 0.6, so the composite is computed, not sampled) |
| axe `color-contrast` nodes, whole page | 6 (wordmark, five footer texts) | **0** |
| axe `link-in-text-block` nodes | 1 ("nhl.com") | **0** (the link is underlined: `text-decoration-line: underline`) |
| axe serious + critical, first party | 2 rules | **none** |
| Timeline caption | below the bar; at 390 the bar sat at the fold with the caption under it (D2) | **above the bar** (the `<p>` precedes the `<svg>` in the DOM and on screen) |
| Header provenance line | "Source: nhl.com · read Oct 2, 2026" | "Source: nhl.com · **checked** Oct 2, 2026" |

D1, D2, D3 and D9 above are closed by these additions. D4 to D8 stand.
