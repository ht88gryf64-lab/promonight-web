# UX review: promo page, baseline mode (feature/promo-past-state-and-back-nav vs production)

Date: 2026-11-08 (America/New_York). Branch: `feature/promo-past-state-and-back-nav`, HEAD fe956b3 (same commit as main) with the branch's changes uncommitted in the working tree at review time (`src/components/promo-page/PromoPageView.tsx`, `src/lib/promo-page-copy.ts`, `src/lib/promo-pages.ts`, their tests, `scripts/live/team-pages.live.test.ts`); the dev server renders that working tree. Page type `promo`.

**Sample path, resolved from the sitemap at run time:** `/nhl/anaheim-ducks/promos/hockey-fights-cancer-night`, game date **Sunday, Nov 15, 2026, 5:00 PM at Honda Center, Anaheim** (JSON-LD Event `startDate` "2026-11-15"). Method: https://www.getpromonight.com/sitemap.xml (lastmod 2026-11-08T12:48:56Z) lists 1,354 promo page URLs; each was fetched in sitemap order with a desktop Chrome User-Agent and the first Event `startDate` in its JSON-LD read. Candidates 1 to 73 carry first dates between 2026-10-04 and 2026-11-14 (candidate 1, `/nhl/anaheim-ducks/promos/kids-socks-giveaway`, is a recurring promo whose first of nine Events is Oct 4). Candidate 74 is the first whose date is today + 7 or later, so it is the sample. The same path was rendered on both environments.

- Branch render: Next.js dev server at http://127.0.0.1:3100. Its HTML carries no `<meta name="promonight-deploy">` (the dev server has no `VERCEL_DEPLOYMENT_ID`); the served page is 414,841 bytes with 154 `<script>` tags (dev runtime).
- Production render: https://www.getpromonight.com, `<meta name="promonight-deploy" content="dpl_ALX6bCcbdZ5qQF5k9rm3rndZubxP">`, main fe956b3; 145,169 bytes, 64 `<script>` tags.
- Tooling: Playwright 1.65 (Chromium headless), desktop Chrome User-Agent on both contexts, device scale 1, viewports 390x844, 768x1024, 1280x800, 5 s settle after `load`, a scroll-through to trigger lazy mounts before each full-page capture, @axe-core/playwright, pixelmatch (threshold 0.1). Screenshots: `2026-11-08-feature-promo-past-state-and-back-nav/hockey-fights-cancer-night/<viewport>-<env>.png`, diffs `<viewport>-diff.png` (red = differing, light blue = masked ad iframes), plus `390-<env>-rail-before-click.png` and `390-<env>-after-back.png` for the back-navigation flow.

## 1. Baseline differences (branch vs production)

Expected: the `overflow-anchor:none` declaration on the `<article>` and the Ticketmaster Impact wrap (dev server env var). Found: exactly those two in the HTML, nothing else; zero content pixels differ; the one behavioural difference is the browser-back fix, measured in 1c and D1.

### 1a. Served HTML of `<article>`

**Open tag:** differs by exactly one declaration. Branch `style="--pp-accent:#da2d20;--pp-accent-ink:#ffffff;--pp-accent-text:#211d18;overflow-anchor:none"`, production the same string without `;overflow-anchor:none`. `class` and `data-ad-region="content"` identical.

**Inner HTML:** 769 normalized lines on each side (deploy meta, `/_next/static` hashes, `?v=` strings, `nonce` attributes and `<script>` bodies stripped). **One differing region:**

| Region | Branch | Production |
|---|---|---|
| "Also on Ticketmaster" anchor (`aria-label="Anaheim Ducks tickets, also on Ticketmaster"`) | `href="https://www.ticketmaster.com/anaheim-ducks-tickets/artist/805893"` | `href="https://ticketmaster.evyy.net/c/7236189/264167/4272?u=https%3A%2F%2Fwww.ticketmaster.com%2Fanaheim-ducks-tickets%2Fartist%2F805893&sharedid=web_promo_page_anaheim-ducks&subId3=hockey-fights-cancer-night"` |

Same cause as the 2026-11-08 main review: `NEXT_PUBLIC_TICKETMASTER_IMPACT_WRAP` is not set on the dev server. The "Get tickets" TicketNetwork href is byte-identical on both. Everything else is identical: all 21 `/promos/` anchors, the five rail cards, the five "Same promo, other teams" rows, the FAQ, the provenance line. The played-game state is correctly absent on both (no "This game has been played", no "Next Anaheim Ducks promo"; the ticket row carries Get tickets, Share, Also on Ticketmaster, Parking, Hotels, Remind me; the Event JSON-LD carries `offers` on both).

### 1b. Pixel comparison

Every iframe and every `data-ad-*` element other than the article was masked; the overlap of the two captures was compared raw and then per article child, aligned by each child's own top.

| Viewport | Branch PNG | Production PNG | Raw differing pixels (unmasked) | Where | Aligned per-section comparison |
|---|---|---|---|---|---|
| 390 | 390x5063 | 390x5250 | **0 of 1,352,909 = 0.00%** (31.5% masked: a production `gg-ad-iframe` 390x844 overlay covers the first viewport, plus five in-article ad iframes and the sticky video and anchor ad) | nothing | 15 article children on both, identical tops and heights, **0 px differ in every one**. This load's production ads filled at exactly the branch placeholder heights (250 px each), so nothing moved |
| 768 | 768x4229 | 768x4259 | 66,918 of 2,872,534 = **2.33%** | 49.8% in y 3500-3750, 39.5% in y 4000-4250, 10.7% in y 3750-4000: everything below the article, offset 30 px because the production below-post ad filled at 280 px where the branch container is 250 px | 16 children on both; **0 px** in all 15 content children, 20 px inside the first ad container |
| 1280 | 1280x4144 | 1280x4145 | 958 of 4,966,558 = **0.02%** | all within x 10-56, y 720-780 | 16 children on both; the 958 px are the Next.js dev-tools "N" indicator fixed at the bottom-left of the first viewport, which exists only on the dev server (crop checked); **0 px** elsewhere |

Diff images: `2026-11-08-feature-promo-past-state-and-back-nav/hockey-fights-cancer-night/390-diff.png`, `768-diff.png`, `1280-diff.png`. No content pixel differs on any viewport.

### 1c. Measurements that moved between the two renders (390 unless noted)

| Measurement | Branch | Production | Why |
|---|---|---|---|
| **Browser back from a rail card: scrollY before / after 6 s / delta** | **1,744 / 1,744 / 0 px, passes, 4 of 4 runs** | **1,744 / 2,264, 2,264, 2,294 / +520, +520, +550 px, fails 50 px bound, 3 of 3 runs** | The branch's `overflow-anchor: none` on the article. Both renders show Raptive removing `div.adthrive-ad.adthrive-footer` and `div.adthrive-sticky-outstream` from `<body>` about 0.5 s after back and re-adding them plus `adthrive-below-post` and three `adthrive-content` containers inside the article about 0.5 s later; production's scrollY is already 2,264 when those adds are observed, the branch's stays 1,744 |
| Document height | 5,063 / 4,229 / 4,144 (390/768/1280) | 5,250 / 4,259 / 4,145 | Ad fill |
| CLS (load + 5 s) | 0.0001 / 0.0274 / 0.0002 | 0.0001 / 0.0274 / 0.0002 in the main pass; a second 768 pass on production added 0.0312 at 2.3 s (an ad `div` growing from 1 px to 90 px) for 0.0586 | The shared 0.0265 at 768 is Raptive's first content container (250 px) inserted at 875 px between 0.3 and 0.9 s, pushing WHAT TO EXPECT AT A THEME NIGHT below the 1024 px fold. Same on both |
| Interactive elements | 88 / 94 / 94 | 96 / 99 / 99 | Production adds Raptive controls: "Pause" 36x36 (x2), "Unmute" 36x36 (x2), "Volume" 10x65 (x2), "Close advertisement" 24x22, "Close sticky video" 22x20 |
| Under 44x44 | 73 / 78 / 79 | 81 / 83 / 84 | Same Raptive controls |
| Contrast failures (< 4.5:1) | 6 | 7 | Production adds the Raptive "×" close at 2.12:1 (rgb(178,178,178) on white) |
| axe serious + critical | 2 / 2 / 2 | 5 / 9 / 9 | Production extras are all inside `#google_ads_iframe_*`: `aria-command-name`, `frame-title`, `image-alt` (critical), `button-name` (critical), `label` (critical), `link-name`, `frame-focusable-content` |
| Console errors / page errors | 23, 23, 33 / 0 | 19, 21, 16 / 0, 0, 1 | All ad-tech (CORS to yahoo, rlcdn, optable on the branch; 400, 424, DNS, a mixed-content quantserve script on production at 1280) |

Unchanged between renders: every hit size of a PromoNight element, the six contrast-failing texts, the two PromoNight axe violations, `/promos/` anchors 21 in DOM / 19 visible, first Raptive container at 972 px, "Get tickets" href and size, the H2 list, the rail cards and hrefs, the "Same promo, other teams" rows (the walk's passive production scan reports CTA hrefs equal, rail cards equal, H2 lists equal).

## 2. Game date check

- Dates read on the page (390, branch): header `<strong>` "Sunday, Nov 15, 2026 · 5:00 PM" at 268 px; THIS GAME `<dd>` "Sunday, Nov 15, 2026 · 5:00 PM" at 768 px; timeline caption "Nov 15 · Hockey Fights Cancer Night · home game 11 of 42" at 931 px; date tile "SUN 15 NOV, IN 7 DAYS" at 336 px. No `<time>` elements. The only other date on the page is "Thursday, Nov 20, 2025" in PREVIOUS EDITION, which labels the link to the 2025-26 edition's own page, not this game.
- JSON-LD: one Event, `startDate: "2026-11-15"` (date only, no time and no offset, although the page states 5:00 PM), `location` Honda Center, 2695 E Katella Ave, Anaheim, CA 92806, `offers` present. Identical on production.
- Venue zone: the page states the building (Honda Center, Anaheim; California in the JSON-LD address), so America/Los_Angeles. Today there is 2026-11-08, as it is in America/New_York.
- **Verdict: upcoming, exactly seven days out. Not a played game.** The branch's played state is correctly absent (section 1a lists what the ticket row still offers). The "5:00 PM" carries no zone label.
- Side check, outside the sample: the same dev server's `/nhl/minnesota-wild/promos/blaze-orange-hat` (Oct 29, 2026, played) renders "This game has been played" and "Next Minnesota Wild promo", its Event has no `offers`, and the page has no Get tickets, Hotels or Remind me; the one remaining "Parking" string is the `<dt>` label of the Before you go lots fact, not the SpotHero button. The feature does what the branch says on a page that qualifies, and nothing on the page that does not.

## 3. Three things that work

1. **Browser back from a rail card now holds the fan's place on the branch, with the Raptive script running.** Flow: scroll so MORE ANAHEIM DUCKS PROMOS is at the top (scrollY 1,744), tap the first card "SUN NOV 8 Kids' Socks Giveaway" (150x105), land on a page whose H1 is "KIDS' SOCKS GIVEAWAY" at scrollY 0, browser back. The browser restores 1,744 over about 0.6 s and holds it through Raptive's teardown and re-insertion: 1,744 after 6 s in 4 of 4 runs. `390-branch-rail-before-click.png` and `390-branch-after-back.png` show the same rail cards at the top of the viewport before and after. Production on the same flow lands 520 to 550 px lower (D1).
2. **The first 390x844 viewport answers what, who, when, where and how.** THEME NIGHT badge, "HOCKEY FIGHTS CANCER NIGHT", "Anaheim Ducks vs Flames", bold "Sunday, Nov 15, 2026 · 5:00 PM" at 268 px, "Honda Center, Anaheim" at 298 px, the SUN 15 NOV tile with "IN 7 DAYS", a 144x52 "Get tickets" whose aria-label names the vendor ("on TicketNetwork", `rel="noopener noreferrer sponsored"`, new tab), Share 102x52, Parking 123x44 ("Reserve parking near Honda Center on SpotHero"), Hotels 123x44 (Expedia, Nov 15 to 16 prefilled), Remind me 254x44, then ABOUT THIS THEME NIGHT with its source line, all above 700 px. CLS 0.0001. (`390-branch.png`, top.)
3. **The ticket CTA lands on the right game and the cross-links are real targets that go where they say.** "Get tickets" opened a new tab: `ticketnetwork.lusg.net` → 302 → `www.ojrq.net` (first hop); the browser continued → 302 `goto.ticketnetwork.com` → 301 → `www.ticketnetwork.com/tickets/8139280/anaheim-ducks-vs-calgary-flames-tickets-sun-nov-15-2026-honda-center` (200), the event page for this exact game; the promo page stayed put underneath. THIS GAME adds "ALSO AT THIS GAME: Kids' Socks Giveaway · Kids" and links the opponent. SAME PROMO, OTHER TEAMS lists five dated rows at 358x61 (Nov 8 Flames, Nov 12 Senators, Nov 13 Golden Knights, Nov 14 Canadiens, Nov 15 Sharks), and the rail's five cards are 150x105.

## 4. Defects

**D1. Production only: browser back from a rail card lands 520 to 550 px below where the fan left. 390.** `390-production-rail-before-click.png` (before) and `390-production-after-back.png` (after). Same flow as item 1 above: 1,744 restored, held for 1.5 to 2.1 s, then the window jumps to 2,264 (twice) or 2,294 (once): the fan who left the rail at the top of the screen sees the SAME PROMO, OTHER TEAMS rows from Nov 8 to Nov 15 and PREVIOUS EDITION, with the rail a full screen above. The jump coincides with Raptive removing its footer and sticky containers from `<body>` and re-adding them plus the in-article containers. It depends on where the fan taps from: tapping the "Also at this game: Kids' Socks Giveaway" link with the page at 437 and coming back restored 437 on production too (1 of 1). This is the defect the branch fixes; it is still what production does today.

**D2. Honda Center is never linked and the page has no Before you go. All viewports, both environments.** `390-branch.png` at 298 px. "Honda Center, Anaheim" is plain text (`<p>Honda Center<span>, Anaheim</span></p>`); there is no `/venues/` link anywhere on the page. `/venues/honda-center` exists on production (200, H1 "Honda Center") but is served with `<meta name="robots" content="noindex, follow">` and is absent from the sitemap, and `PromoPageView.tsx:241` renders the venue link only when the hub is indexable. The venue doc (slug `honda-center`, with `clearBagRequired` and `parkingLots` fields) is in the page's RSC payload yet nothing from it reaches the fan: no bag rule, no gate time, no lots, no "gameday guide" link. What the page offers about the building is two affiliate buttons (SpotHero, Expedia).

**D3. The season timeline dots are real buttons 5x5 px. All viewports; 390 shown.** `390-branch.png` at y 903 (inside THIS GAME). 36 `<g role="button" tabindex="0" aria-pressed>` elements, 5x5 px each (the current game 7x7) at 390, about 10 px at 768 and 1280, in a strip with no visible label; the group's aria-label (the home schedule) has no visible counterpart. Each is a tap target a thumb cannot hit and nothing tells a fan the strip is interactive. Same as D2 in the 2026-11-08 main review.

**D4. 73 of 88 interactive elements at 390 are under 44x44.** `390-branch.png`. 36 are the timeline dots (D3); the other 37: "Open menu" 40x40; breadcrumb "NHL" 24x18, "Anaheim Ducks" 84x18, "Promos" 42x18; "Also on Ticketmaster" 133x21; "nhl.com" 43x14; "Calgary Flames" 106x16; "Kids' Socks Giveaway" 149x16 (the Also-at-this-game link); "All Anaheim Ducks promos" 170x21; "Theme nights across pro sports" 198x21; "Hockey Fights Cancer Night 2025-26" 249x16; the three FAQ `summary` rows 328x21 (the only way to open an answer); "Get the week's giveaways in your inbox →" 266x20; 20 footer links 15 px tall; "Do not sell or share my personal information." 259x15; "Terms of Content Use" 126x15. Only 15 meet the size: the ticket row's five controls, the five rail cards and the five Same-promo rows. 768: 78 of 94; 1280: 79 of 94.

**D5. Brand red on cream fails 4.5:1 everywhere it is used as text: 4.33:1.** All viewports, both environments. `390-branch.png`. rgb(218,45,32) on rgb(247,243,234): "NIGHT" in the wordmark (18 px/800), "Also on Ticketmaster" (14 px), "nhl.com" (12 px), "All Anaheim Ducks promos" and "Theme nights across pro sports" (14 px), "Hockey Fights Cancer Night 2025-26" (15 px). axe `color-contrast` (serious) reports 11 nodes; `link-in-text-block` (serious, 1 node) for "nhl.com", distinguished from its sentence by this colour alone. The same red on the white THIS GAME card ("Calgary Flames", "Kids' Socks Giveaway") passes.

**D6. THIS GAME restates the header. 390, `390-branch.png` y 683-962.** "Sunday, Nov 15, 2026 · 5:00 PM" at 268 px and again at 768 px; the opponent as "Anaheim Ducks vs Flames" (header) and "OPPONENT Calgary Flames" (card); "Home game 11 of 42" as a row and again in the caption under the timeline. The 279 px card adds the opponent link, the Also-at-this-game line and the strip.

**D7. The promo-specific content is one sentence; the longest block on the page is generic. 390.** `390-branch.png`. ABOUT THIS THEME NIGHT is "Cancer awareness themed game night presented by UCI Health." (110 px section). GENERAL GUIDE / WHAT TO EXPECT AT A THEME NIGHT is 475 px (1,246 to 1,721) of prose that applies to every theme night on the site and sits between THIS GAME and the rail. A fan looking for what happens at this night, what the themed item is, or how to get it, has the FAQ's "Usually not. Themed items are typically part of a theme ticket package." and nothing specific to the Ducks. Jargon on the page: the "GENERAL GUIDE" eyebrow (an internal section class), "Source: nhl.com · read Oct 2, 2026" (provenance language), the last breadcrumb "Promos" linking to the team-page anchor so the current page has no crumb, "5:00 PM" with no zone.

**D8. Four blank grey boxes in the branch render at 390** (972, 1,980, 2,782, 3,334 px; 250 px each), `390-branch.png`. These are Raptive containers injected after load and left unfilled on the dev server; the first sits directly under THIS GAME inside the second screen. On production they fill (this load at the same 250 px, so no displacement at 390; at 768 the below-post filled at 280 px and moved everything below it 30 px). At 768 the first container's insertion is the whole measured CLS (0.0265 on both environments). The page reserves no height in its own markup.

**D9. Production only, 390: Raptive's sticky outstream video and anchor ad cover the bottom 183 px of the first viewport** (`390-production.png`, top; a 178x100 player at 670 px and a 390x183 container at 661 px, over "Source: nhl.com · read Oct 2, 2026" and the top of THIS GAME; a `gg-ad-iframe` 390x844 overlay sits in the DOM). Controls "Close sticky video" 22x20, "Close advertisement" 24x22, "×" at 2.12:1. Third-party, but it is what a first-time visitor on a phone sees.

Not a defect: the black "N" button at bottom-left of every branch screenshot is the Next.js dev-tools indicator; it does not exist on production and is the only pixel difference at 1280.

## 5. Measurements (390 unless noted)

| Measurement | Branch (dev, working tree on fe956b3) | Production (dpl_ALX6bCcbdZ5qQF5k9rm3rndZubxP) |
|---|---|---|
| HTTP status | 200 | 200 |
| `promonight-deploy` meta | absent (dev server) | dpl_ALX6bCcbdZ5qQF5k9rm3rndZubxP |
| Served HTML bytes / `<script>` tags | 414,841 / 154 | 145,169 / 64 |
| `<article>` open tag | `...;overflow-anchor:none` | without it |
| Article inner HTML, normalized | 769 lines, 1 differing region ("Also on Ticketmaster" href, env var) | 769 lines |
| Pixel diff, raw (390 / 768 / 1280) | 0.00% / 2.33% / 0.02% of unmasked overlap | same comparison |
| Pixel diff, aligned per content section | 0 px / 0 px / 0 px | same comparison |
| Document height (390 / 768 / 1280) | 5,063 / 4,229 / 4,144 | 5,250 / 4,259 / 4,145 |
| Interactive elements (`a, button, [role=button], input, summary`) | 88 (768: 94; 1280: 94) | 96 (768: 99; 1280: 99) |
| Under 44x44 | 73 = 36 timeline dots + 37 others (768: 78; 1280: 79) | 81 (768: 83; 1280: 84) |
| Text nodes checked / contrast failures < 4.5:1 | 103 / 6 (all 4.33:1 brand red on cream) | 104 / 7 (+ Raptive "×" 2.12:1) |
| axe serious + critical (390 / 768 / 1280) | 2 / 2 / 2 (`color-contrast` 11 nodes, first `.text-lg > .text-rd-red`; `link-in-text-block` 1 node, `a[rel="noopener nofollow"]` "nhl.com") | 5 / 9 / 9 (ours + `aria-command-name`, `frame-title`, `image-alt` critical, `button-name` critical, `label` critical, `link-name`, `frame-focusable-content`, all inside `#google_ads_iframe_*`) |
| CLS during load + 5 s (390 / 768 / 1280) | 0.0001 / 0.0274 / 0.0002 | 0.0001 / 0.0274 / 0.0002 (second 768 pass 0.0586) |
| `<a>` with `/promos/` in path: DOM / visible | 21 / 19 (hidden: two "Today" nav links, desktop nav `hidden md:flex` and the closed menu `dialog`); 768 and 1280: 21 / 20 | 21 / 19; 768 and 1280: 21 / 20 |
| First ad anchor | `data-ad-region="content"` is on the `<article>` itself at 57 px; no `data-ad-item` exists; first Raptive container at 972 px (250 px, empty) | same attributes; first container at 972 px (250 px, filled; its `google_ads_iframe` AdThrive_Content_1 at 972 px) |
| `<time>` elements | 0 | 0 |
| Date and time found | "Sunday, Nov 15, 2026 · 5:00 PM" at 268 px, above the fold; repeated at 768 px | same |
| Venue found | "Honda Center, Anaheim" at 298 px, plain text, no link; no `/venues/` link on the page | same |
| "Get tickets" | 144x52 at 336 px, new tab, `ticketnetwork.lusg.net` → 302 → `www.ojrq.net` (first hop); browser continued → `goto.ticketnetwork.com` (302) → `www.ticketnetwork.com/tickets/8139280/anaheim-ducks-vs-calgary-flames-...` (301, then 200) | identical href, not clicked |
| Rail card → destination H1 | "SUN NOV 8 Kids' Socks Giveaway" → "KIDS' SOCKS GIVEAWAY" at scrollY 0, match | identical cards, not clicked |
| **Back: scrollY before / after 6 s / delta** | **1,744 / 1,744 / 0 px, passes (4 of 4 runs)** | **1,744 / 2,264, 2,264, 2,294 / +520, +520, +550 px, fails (3 of 3 runs)** |
| Console errors / page errors | 23 / 0 (ad-tech CORS) | 19 / 0 (ad-tech 400, 424, DNS; 1 page error at 1280) |

## 6. One recommendation

Merge this branch and verify it on production with the measurement used here, not with a source grep: rail heading at the top (scrollY 1,744 on this page), tap the first card, browser back, wait six seconds, scrollY within 50 px, with the Raptive script running. On the dev server it holds in 4 of 4 runs while production still jumps 520 to 550 px in 3 of 3; the HTML and pixel baselines show the change is confined to the one declaration. Add that flow to the live battery, because the trigger is the ad script's teardown after back, which no served-HTML check can see. The next thing to fix on this page is D2: a fan on it has no path to Honda Center and no arrival facts, although the hub page and the venue doc both exist.
