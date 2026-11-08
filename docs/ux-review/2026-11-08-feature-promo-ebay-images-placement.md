# UX review: promo page, baseline mode (feature/promo-ebay-images vs production), second review: the placement move

Date: 2026-11-08 (America/New_York). Branch: `feature/promo-ebay-images`, base 1d3b6f2. This is the second review of the branch; the first is `docs/ux-review/2026-11-08-feature-promo-ebay-images.md` (D1 to D10, dispositions in its section 7). When the measurements were taken (13:30 to 13:36 local) HEAD was 555ec5c with the placement move **uncommitted** in the working tree (`PromoPageView.tsx`, the spec and two tests). While this review ran, the branch session committed that tree as **403cff9** ("the eBay block after This game, before the Fan guide", parent 555ec5c), together with `docs/known-issues.md` entries 88 and 89 and the first report's dispositions. The working tree is now clean apart from the two untracked screenshot folders. The branch article was fetched again after that commit and is byte-identical (normalized) to the one measured, so every number below describes 403cff9.

- Branch render: Next.js dev server at http://127.0.0.1:3101, answered 200 on the first request. Its HTML has no `<meta name="promonight-deploy">`, because a dev server has no deployment id. **No eBay Browse API keyset exists yet**, so the dev server runs with the preload stub that answers the API with four real listings read from eBay's search page on 2026-11-08 for this exact promo; the guard, now with the year rule, keeps three. The listing content below is that sample data. The dev server runs with `NEXT_PUBLIC_EBAY_CAMPID=5339999999`, which is what every listing href carries. **New since the first review: the dev server now gets partial Raptive fill** (a 320x50 sticky footer and the third in-content unit at 390, a 728x90 below-post passback at 1280, nothing at 768), where the first review saw every container empty. That is the environment, not the branch; it is what puts `frame-title`, `image-alt` and `link-name` violations and a higher console-error count in the branch column of the measurements table, and none of it is in first-party DOM.
- Production render: https://www.getpromonight.com. The deploy meta read `dpl_2qKmLvf68iH26RxUEDcv6Jj6A2BT` (main **59eeb2e**, the vendor-parking merge) on the first curl and `dpl_BXrCHQ5gDTxo3vGnr7Y3hp7D6G5Z` (main **e5e5733**, a CLAUDE.md-only commit on top of 59eeb2e; build created 18:28:51Z, ready 18:30:23Z) on the fetch used for the HTML comparison and on all six Playwright renders. Production is therefore two commits past the branch's base, neither of which touches this page: its article is the same 623 normalized lines as in the first review and differs from the branch only in the two regions listed below. **Production does not have the feature.**
- Tooling: Playwright 1.65.0 (Chromium 158.0.8127.18, headless), a desktop Chrome User-Agent on both contexts and on curl, device scale 1, viewports 390x844, 768x1024 and 1280x800, a 5 s settle after `load`, a scroll-through to trigger lazy mounts, then back to the top before each full-page capture. @axe-core/playwright 4.14.0 (serious and critical only), pixelmatch 8.0.0 at threshold 0.1, Node 25.6.1, and the same contrast walker as the first review. The first review's scripts were reused unchanged except for the output path.
- Pixel method, as in the first review: every iframe and every Raptive container (`.adthrive-ad`) masked in both captures and the overlapping area compared; a second pass matches each `<article>` child to its counterpart by heading text and compares the two at their own tops, dy of -2 to +2 allowed.
- The dark circle at the bottom-left of the first screen in every branch PNG is the Next.js dev-tools indicator, not page content.

One URL, given explicitly: `/nba/brooklyn-nets/promos/julius-erving-bobblehead` (Barclays Center, Brooklyn, America/New_York). Screenshots: `2026-11-08-feature-promo-ebay-images-placement/julius-erving-bobblehead/{390,768,1280}-{branch,production}.png`. Diffs: `.../{390,768,1280}-diff.png` (red marks differing pixels, light blue marks masked ad areas). Those nine PNGs and this file are the only files this review wrote inside the repo.

---

## `/nba/brooklyn-nets/promos/julius-erving-bobblehead`

### 1. Baseline differences

**Served `<article>` HTML.** After normalization (deploy meta, `/_next/static` hashes, `?v=` strings, nonces, `<script>` bodies and `<!-- -->` separators stripped) the branch article is 662 lines / 35,599 bytes and production's is 623 lines / 32,477 bytes. They differ in **two regions**, the same two as the first review, with the second in a new place:

| Region | Branch | Production |
|---|---|---|
| "Also on Ticketmaster" href (line 66) | `https://www.ticketmaster.com/brooklyn-nets-tickets/artist/805983` | `https://ticketmaster.evyy.net/c/7236189/264167/4272?u=...&sharedid=web_promo_page_brooklyn-nets&subId3=julius-erving-bobblehead` |
| New `<section>` of 39 normalized lines, inserted **after the THIS GAME section's closing tag and before the FAN GUIDE section** (lines 263 to 301; in the first review it followed ABOUT THIS GIVEAWAY) | H2 "On eBay"; `<p>` "Current listings for this bobblehead."; a `<ul class="m-0 grid list-none grid-cols-3 gap-2.5 p-0">` of three `<li class="min-w-0">`, each one `<a target="_blank" rel="sponsored noopener" title="{listing title}" class="block no-underline">` wrapping `<img src="https://i.ebayimg.com/images/g/.../s-l400.webp" alt="" width="400" height="400" loading="lazy" decoding="async" class="aspect-square w-full rounded-xl border border-rd-line bg-[#ebe4d6] object-contain">`, a price `<span>` and a title `<span class="line-clamp-2 text-[12px] leading-[1.35] text-rd-ink-soft">` (no `block`); then the disclosure `<p>` | absent |

The three listings are $65.00 "PRESALE 2026 Dr. J Julius Erving Brooklyn Nets SGA Bobblehead 11/18 NBA ABA 80's", $59.99 "2026 Dr. J Julius Erving Brooklyn Nets Bobblehead 11/18 NBA ABA New Jersey SGA" and $30.00 "Dr J Black Panther Bobblehead Marvel's Brooklyn Nets Julius Erving SGA". The string "2012" does not occur anywhere in the branch article; "76ers" occurs four times in both articles, in shared page copy, and in no listing title. The first region is the Impact wrap configured on production and not on the dev server; it appears on every baseline run. Nothing else differs: breadcrumb, header, date tile and CTA block, About, This game, Fan guide, Quick facts, both rails, Questions, the page-bottom disclosure and the Event JSON-LD are byte-identical.

**Article direct children:** branch 19 / 18 / 18 at 390 / 768 / 1280, production 17 / 16 / 16. The difference is now **two**, not one: the eBay section, and one more Raptive container. Raptive places a container after each content section, so the new section earned one (7 containers at 390 on the branch against 6 on production; 6 against 5 at 768 and 1280). Reading order after About, at 390:

| | Branch (top, height) | Production (top, height) |
|---|---|---|
| THIS GAME | 683, 197 | 683, 197 |
| Raptive Content_1 | 891, 250 (empty) | 891, 300 (filled) |
| ON EBAY | 1,165, 319 | absent |
| Raptive Content_2 | 1,494, 250 (empty) | (next container is at 1,676, after the fan guide) |
| FAN GUIDE | 1,768, 451 | 1,215, 451 |
| QUICK FACTS | 2,503 | 1,950 |

So THIS GAME is back at production's position at every viewport (683 / 608 / 570), Raptive's first content container is back after it at production's position (891 / 815 / 777), and everything from the FAN GUIDE down moves by +553 / +671 / +697 px.

**Pixels.**

| Viewport | Branch PNG | Production PNG | Raw differing pixels (masked overlap) | Aligned by heading |
|---|---|---|---|---|
| 390 | 390x6357 | 390x5992 | 325,214 of 1,970,220 = 16.51% (15.7% masked); first differing row 787 | ON EBAY only on branch (1,165 px, 319 tall). Sections 0 to 3 (nav, header, CTA block, About) **0**. THIS GAME 95 (35,342 masked under the fixed overlays), QUICK FACTS **0**, QUESTIONS 91 (dy +1), FAN GUIDE 4,941 (dy -1), MORE NETS 571, MORE NBA 296, bottom disclosure 433. Total 6,427 across matched sections. |
| 768 | 768x5012 | 768x4391 | 659,592 of 2,985,491 = 22.09% (11.5% masked); first row 939 | ON EBAY only on branch (1,089 px, 386 tall). THIS GAME **0**, QUICK FACTS **0**, QUESTIONS **0**, disclosure **0**. FAN GUIDE 2,894 (dy +1), MORE NETS 464, MORE NBA 296. Total 3,654. |
| 1280 | 1280x4952 | 1280x4286 | 961,755 of 4,892,483 = 19.66% (10.8% masked); first row 720 | ON EBAY only on branch (1,051 px, 412 tall). THIS GAME **0** (100,427 masked under production's video unit), QUICK FACTS **0**. FAN GUIDE 3,408, MORE NETS 563, MORE NBA 296, QUESTIONS 128 (dy -1), disclosure 226. Total 4,621. |

The raw percentages are large because everything below the block moves. The first differing rows (787 / 939 / 720) are the fixed-position overlays that a full-page capture pins to the bottom of the first viewport: the Next dev-tools indicator on the branch, Raptive's sticky footer bar and its close button on production; neither is page content. The aligned residuals in the FAN GUIDE, both rails, QUESTIONS and the disclosure were cropped side by side at 390 (scratch `shots/crop-*.png`): the same words on the same lines in both renders, every differing pixel on a glyph edge, because the tiles' fractional heights (162.03 and 162.05 px) offset everything below them by a sub-pixel amount. Their HTML is byte-identical.

**Measurements that moved.** Document height (+365 / +621 / +666 px), article children (+2), Raptive containers (+1), FAN GUIDE and everything after it (+553 / +671 / +697), `i.ebayimg.com` requests (3 vs 0), visible disclosure sentences (2 vs 1), and the ad-tech-driven counts in both directions (interactive elements, contrast failures, axe totals, console errors; see the table). **Unchanged:** H1 and its position (149 px), THIS GAME (683 / 608 / 570 on both), the first Raptive content container (891 / 815 / 777 on both), `<time>`, every date, the Get tickets href and size, the rail cards, the `/promos/` anchor counts (20 in DOM, 18 visible at 390, 19 at 768 and 1280), the 12 in-article targets under 44 px, the first-party axe set, the JSON-LD, and CLS, which is identical on both environments at every viewport (0.0003 / 0.063 / 0.0016).

### 2. Game date check

- **Dates on the page (390, branch).** The header `<time datetime="2026-11-18">` reads "Wednesday, Nov 18, 2026" at 268 px. The date tile reads "WED 18 NOV, IN 10 DAYS". The THIS GAME caption at 806 px reads "Nov 18 · Julius Erving Bobblehead · home game 6 of 40". Two eBay titles carry "11/18".
- **JSON-LD.** One Event, `startDate` "2026-11-18" (date only, no `endDate`), location Barclays Center, 620 Atlantic Ave, Brooklyn, NY 11217. Identical on both environments.
- **Venue zone.** Barclays Center, Brooklyn: America/New_York. Today there is 2026-11-08.
- **Verdict: upcoming, 10 days out. Not a played game.** Both environments render the upcoming state: Get tickets, Share, Also on Ticketmaster, Parking, Hotels and Remind me.
- No tip-off time exists anywhere on the page, on either environment (D8, carried; known-issues 89).

### 3. Three things that work

1. **The facts of the night now come before the prices.** THIS GAME sits where production has it (683 / 608 / 570 px) with Raptive's first container after it where production has it (891 / 815 / 777). The eBay heading is below the fold at every viewport (1,180 px against an 844 px fold; 1,104 against 1,024; 1,066 against 800), and the first screen at 390 is production's first screen pixel for pixel (nav, header, CTA block and About: 0 differing pixels). The section that follows the block is the fan guide, whose sentence "Bobbleheads trade actively on eBay within hours of the game" now explains the three prices the fan has just scrolled past. `390-branch.png` at 683 to 1,768.
2. **The tiles are what the class promised.** Every listing title is 32.375 px tall, two lines of 12 px type at 1.35 line-height, at all three viewports; tile 1's natural six lines (scrollHeight 97 px) and tiles 2 and 3's five (81 px) are cut at two. Computed `-webkit-line-clamp: 2`, `overflow: hidden` (Chromium 158 reports the blockified `-webkit-box` as `display: flow-root`). The three anchors are 103x162 each at 390 (186x245 at 768, 229x288 at 1280), their bottoms aligned; the block is 319 px tall at 390 (was 384). Every image is `alt=""`, so the anchor's accessible name is the price and the title once. No new axe violation in first-party DOM, no new contrast failure (H2 16.75:1, price 16.75:1, title 8.98:1, lead 5.0:1 at 12 px, disclosure 5.0:1 at 11 px), no layout shift from the images (CLS equals production's at every viewport), and all three images arrived 200 before any scroll at every viewport. `390-branch.png` at 1,165 to 1,484.
3. **The primary CTA, the rail and back navigation hold.** "Get tickets" (144x52, new tab, `rel="noopener noreferrer sponsored"`, aria-label "Get tickets for Brooklyn Nets vs Bulls on TicketNetwork") goes to `ticketnetwork.lusg.net`, which chains 302 to `www.ojrq.net`, 302 to `goto.ticketnetwork.com`, 301 to `www.ticketnetwork.com/tickets/8205764/brooklyn-nets-vs-chicago-bulls-tickets-wed-nov-18-2026-barclays-center` (page title "Brooklyn Nets vs. Chicago Bulls in Brooklyn, NY at Barclays Center on November 18, 2026"). The first rail card "FRI DEC 18 80s Night" (150x105) lands on H1 "80S NIGHT". Browser back restored scrollY exactly: 2,815 to 2,815 on the branch (the rail now sits 195 px lower than in the first review and the restore still lands on it), 2,558 to 2,558 on production, 0 px delta on both.

### 4. Defects

**P1. The third tile is still not this bobblehead. All viewports; branch only.** `390-branch.png`, third tile at 1,247 to 1,409 px; `1280-branch.png` at 1,134 px. Under the lead "Current listings for this bobblehead." the third listing is "Dr J Black Panther Bobblehead Marvel's Brooklyn Nets Julius Erving SGA", $30.00, and its 400x400 photo shows a figure in a black "NETS 32" uniform held in a hand over a wooden floor: a secondhand piece with no box. This page is an ABA-era night (About: "Era-inspired giveaway celebrating the Julius Erving-led ABA era"; THIS GAME: "ABA Night · Theme Night"); nothing on it is Marvel or Black Panther, and the Nov 18 figure cannot be in anyone's hand yet, which is why tiles 1 and 2 say PRESALE and 2026. The year rule added after the first review removed the 2012-13 76ers listing, but this title carries no year, so the rule cannot see it, and the surname rule passes it because it names Erving and the Nets. The lead therefore still makes a claim the data does not meet, and the lead still does not say that the first two listings are pre-sales of an item nobody has. Severity: medium (content accuracy); carried from D2, narrowed, not closed.

**P2. Between THIS GAME and the FAN GUIDE the fan now scrolls through a full screen of nothing but ads and resale listings. All viewports; branch only.** `390-branch.png` at 880 to 1,768; `768-branch.png` at 805 to 1,760; `1280-branch.png` at 767 to 1,748. At 390, THIS GAME ends at 880; then Raptive Content_1 (891 to 1,141), the eBay block (1,165 to 1,484), Raptive Content_2 (1,494 to 1,744), and the fan guide begins at 1,768: 888 px, 1.05 screens, with no editorial content. At 768 it is 955 px (0.93 screens), at 1280 981 px (1.23 screens). On production the same gap is one ad: 335 / 284 / 284 px. Raptive places a container after every content section, so the move created a new slot and the block landed between two of them; on the dev server those two containers are blank white 250 px boxes (second screen of `390-branch.png`), and on production they will fill, which is the point: ad, listings, ad. The first review's D3 was about the block outranking the game; the ruling fixed that, and this is what the ruling costs. Severity: medium (judgement); a consequence of the placement, for Matt.

**P3 (carried D4, deferred as known-issues 88). Two of the three thumbnails are letterboxed slivers, and the row is now uneven. All viewports; branch only.** `390-branch.png` at 1,247 px. Natural sizes 146x400, 231x400 and 400x400: with `object-contain` on `#ebe4d6`, tile 1 shows a 38 px-wide strip in a 103 px tile at 390, tile 2 a 60 px strip, and tile 3, new this run, fills its square. Two beige tiles with slivers beside one full photo. Severity: low; deferred.

**P4 (carried D7, waived). The disclosure sentence appears twice, in two voices.** At 390: inside the block at 1,419 px (11 px sans, 5.0:1) and at the article's end at 4,569 px (10 px monospace, 8.8:1), verbatim identical. Unchanged from the first review; waived there.

**P5 (carried D8, deferred as known-issues 89). No tip-off time, and no admission that there is none. Both environments.** `<time>` is date-only, the Event has no time, and the fan guide and quick facts still point at "game time" and "the scheduled start time". Production behaviour, not this branch.

**P6 (carried D9). Twelve in-article tap targets under 44 px; the logo at 4.33:1; red quick-facts links with no underline. Both environments.** The same twelve as the first review ("NBA" 25x18 through "Bobblehead nights across pro sports" 231x21); "NIGHT" 4.33:1; axe `link-in-text-block` on the two red quick-facts links. known-issues 78, the brand ruling, known-issues 85.

**P7 (carried D6, waived). The listing destination still cannot be shown and the campaign id is still the dev value. Branch only.** Tile 1 opens a new tab to `https://www.ebay.com/itm/227573531786?...campid=5339999999&customid=web_promo_page_brooklyn_nets_2026_11_18_Julius_Erving_Bobblehead...`, 0 redirect hops, and eBay answers 403 "Error Page | eBay" to headless Chromium. Production's `NEXT_PUBLIC_EBAY_CAMPID` is the branch session's claim, not something this review can see.

**P8 (carried D10, environment). "Also on Ticketmaster" is unwrapped on the dev server.** Every baseline run shows it.

### 5. Measurements

| Measurement | Branch (dev server, 403cff9 on base 1d3b6f2) | Production (dpl_BXrCHQ5gDTxo3vGnr7Y3hp7D6G5Z = main e5e5733) |
|---|---|---|
| HTTP status | 200 | 200 |
| `promonight-deploy` | absent (dev server) | dpl_BXrCHQ5gDTxo3vGnr7Y3hp7D6G5Z (dpl_2qKmLvf68iH26RxUEDcv6Jj6A2BT = 59eeb2e on the first curl) |
| Served HTML bytes | 407,841 | 133,944 |
| Article HTML, normalized | 662 lines; 2 differing regions (Ticketmaster wrap, env; the On eBay section, 39 lines, after THIS GAME) | 623 lines |
| Article direct children, 390 / 768 / 1280 | 19 / 18 / 18 (incl. 7 / 6 / 6 Raptive containers) | 17 / 16 / 16 (incl. 6 / 5 / 5) |
| Document height, 390 / 768 / 1280 | 6,357 / 5,012 / 4,952 | 5,992 / 4,391 / 4,286 |
| Pixel diff, raw, 390 / 768 / 1280 | 16.51% / 22.09% / 19.66% | (same comparison) |
| Pixel diff, aligned by heading | eBay section only on branch; nav, header, CTA block, About, QUICK FACTS 0 px at all three; THIS GAME 95 / 0 / 0; residuals 91 to 4,941 px per section are glyph anti-aliasing (crops checked at 390), HTML identical; totals 6,427 / 3,654 / 4,621 | (same comparison) |
| Section order after About | THIS GAME, Raptive, **On eBay**, Raptive, Fan guide, Raptive, Quick facts | THIS GAME, Raptive, Fan guide, Raptive, Quick facts |
| THIS GAME top, 390 / 768 / 1280 | 683 / 608 / 570 | 683 / 608 / 570 |
| First Raptive content container top (height), 390 / 768 / 1280 | 891 (250, empty) / 815 (250) / 777 (250) | 891 (300, filled) / 815 (250) / 777 (250) |
| On eBay section: top + height (screens down), 390 / 768 / 1280 | 1,165 + 319 (1.38) / 1,089 + 386 (1.06) / 1,051 + 412 (1.31) | absent |
| On eBay H2 top vs fold | 1,180 vs 844 / 1,104 vs 1,024 / 1,066 vs 800: below the fold at all three | n/a |
| Ad-and-listings run from the end of THIS GAME to the fan guide | 888 px (1.05 screens) / 955 (0.93) / 981 (1.23) | 335 / 284 / 284 (one ad) |
| FAN GUIDE top, 390 / 768 / 1280 | 1,768 / 1,760 / 1,748 | 1,215 / 1,089 / 1,051 |
| eBay tile anchors (hit size), 390 / 768 / 1280 | 103x162 x3 / 186x245 x3 / 229x288 x3 | n/a |
| eBay title height / lines (computed clamp) | 32.375 px / 2 at every viewport (natural 6, 5, 5 at 390; 3, 3, 3 at 768; 3, 3, 2 at 1280); `-webkit-line-clamp: 2`, `overflow: hidden` | n/a |
| eBay images: natural / rendered | 146x400, 231x400, 400x400 / square 103, 186, 229 with `object-contain` on #ebe4d6 | n/a |
| eBay image alt | `""` on all three | n/a |
| Listing titles | PRESALE 2026 Dr. J ... 11/18 ($65.00); 2026 Dr. J ... 11/18 ($59.99); Dr J Black Panther Bobblehead Marvel's ... ($30.00); no "2012" in the article | n/a |
| eBay block text contrast | H2 16.75:1, price 16.75:1, title 8.98:1, lead 5.0:1 (12 px), disclosure 5.0:1 (11 px) | n/a |
| `i.ebayimg.com` requests (status; before any scroll) | 3 (200, 200, 200; all 3 before scrolling) at each viewport | 0 |
| Disclosure sentence, visible occurrences (390 tops) | 2 (1,419 and 4,569 px) | 1 (4,204 px) |
| Interactive / under 44x44, 390 | 58 / 36 (12 in article) | 66 / 45 (16 in article, 4 inside a Raptive sponsored unit) |
| Under 44x44, 768 / 1280 | 41 / 42 | 46 / 50 (1280 includes a video unit's Pause, Unmute, Volume) |
| Contrast failures < 4.5:1 (own walker), 390 / 768 / 1280 | 1 of 118 / 1 of 125 / 1 of 125: "NIGHT" 4.33:1 | 3 of 115 ("NIGHT", Raptive "×" 2.12:1, "Disney+" 2.23:1) / 2 of 117 / 2 of 117 ("NIGHT", "×") |
| axe serious + critical, first party | `color-contrast` 1 node, `link-in-text-block` 2 nodes | same |
| axe, ad-tech (inside ad iframes), 390 / 768 / 1280 | `frame-title` 6, `image-alt` 2, `link-name` 2 / none / `frame-title` 4, `image-alt` 1, `link-name` 1 (new: the dev server now gets partial fill) | `aria-command-name`, `button-name`, `frame-title`, `image-alt` 19, `label`, `link-name` / six rules / eight rules incl. `frame-focusable-content`, `scrollable-region-focusable` |
| CLS during load + 5 s, 390 / 768 / 1280 | 0.0003 / 0.063 / 0.0016 (768: 0.0247 at 453 ms from the early sections, 0.0383 at 875 ms from one `section.mt-6`) | 0.0003 / 0.063 / 0.0016 (same two entries at 294 and 380 ms) |
| `<a>` to `/promos/`: DOM / visible, 390; 768 and 1280 | 20 / 18; 20 / 19 | same |
| Hidden `/promos/` anchors | two "Today" links (desktop nav `md:flex`, closed menu dialog) | same |
| First ad anchor from document top, 390 | `data-ad-region="content"` on `<article>` at 57 px; no `data-ad-item`; first Raptive content container at 891 px (after THIS GAME, empty) | same attribute at 57 px; first container at 891 px (after THIS GAME, filled) |
| Game date(s) | `<time>` 2026-11-18 (date only, no time); Event startDate 2026-11-18 | same |
| Played-game verdict | upcoming (10 days) | upcoming |
| Primary CTA | "Get tickets" 144x52, `ticketnetwork.lusg.net` 302 to `www.ojrq.net` 302 to `goto.ticketnetwork.com` 301 to `www.ticketnetwork.com` (Nets vs Bulls, Nov 18, 2026, Barclays Center) | same href |
| eBay listing 1 destination | new tab, `www.ebay.com`, 0 hops; 403 bot page to headless Chromium; `campid=5339999999` | n/a |
| Rail card, label vs destination H1 | "FRI DEC 18 80s Night" / "80S NIGHT" (match) | same |
| Back: scrollY before / after | 2,815 / 2,815 (0 px) | 2,558 / 2,558 (0 px) |
| Console errors / page errors, 390 / 768 / 1280 | 53 / 29 / 52 (ad-tech CORS against the 127.0.0.1 origin, more than the first review's 26 because units now fill) / 0 | 14 / 24 / 13 / one page error at 1280 ("Cannot read properties of null (reading 'addEventListener')", ad-tech) |

### 6. Recommendation

Merge the placement: the ruling landed exactly as asked (THIS GAME and the first ad back where production has them, the eBay heading below the fold everywhere, nothing above the block changed by a pixel) and the two defects the first review found in the block itself, the dead clamp and the 76ers listing, are gone from the render. Do not flip production on (the Browse API keyset and the real campaign id) while the block can still show, under "Current listings for this bobblehead", a listing that is not this bobblehead (P1): the year rule narrowed D2 and did not close it, and this page's third tile is the proof. Put P2 in front of Matt with its numbers, because it is the direct cost of the ruling he made: at 390 a fan now crosses 888 px of ad, listings, ad between the game facts and the fan guide, where production has one 300 px ad.

### 7. Changes since the first review (D1 to D10)

| First review | This render |
|---|---|
| D1 dead two-line clamp | **Fixed, verified.** The title span is `line-clamp-2 text-[12px] leading-[1.35] text-rd-ink-soft` with no `block`. Every title measures 32.375 px (2 lines) at 390, 768 and 1280; computed `-webkit-line-clamp: 2`, `overflow: hidden`; tile 1's six natural lines and tiles 2 and 3's five are cut at two. Anchors 103x162 each at 390 (were 103x227 / 211 / 211), the block 319 px tall (was 384), the row's bottom edge level. The `title` tooltip now reveals truncated text, except on tile 3 at 1280, where the title fits in two lines and the tooltip repeats it. |
| D2 a 2012-13 76ers listing under "Current listings for this bobblehead" | **Narrowed, not closed.** The 76ers listing is gone ("2012" occurs nowhere in the article). The third tile is now "Dr J Black Panther Bobblehead Marvel's Brooklyn Nets Julius Erving SGA" ($30.00), a Marvel-themed secondhand Nets figure that is not the ABA-night giveaway this page is about; its title has no year, so the year rule passes it. The lead is unchanged and still over-claims, and still does not say the first two listings are pre-sales. P1 above. |
| D3 the block, and the first ad, ahead of THIS GAME | **Fixed by ruling.** The block renders after THIS GAME and before the FAN GUIDE. THIS GAME is at 683 / 608 / 570 on both environments; Raptive's first content container is at 891 / 815 / 777 on both; the eBay heading is below the fold at all three viewports (1,180 / 1,104 / 1,066). The new cost is P2: Raptive placed a second container after the block, so the block sits between two ads. |
| D4 letterboxed thumbnails | **Deferred, known-issues 88** (the committed entry is 88; the pre-commit draft of the first report I read cited 86, and the committed first report cites 88). Tiles 1 and 2 are still 38 px and 60 px strips at 390; the new tile 3 is 400x400 and fills its square, so the row is now uneven. P3. Merge note: main's known-issues 86 and 87 are the vendor-parking review's venue entries, added after this branch was cut; the branch adds 88 and 89 at the same point in the file, so the merge will meet a conflict there and should keep all of 86 to 89. |
| D5 the listing title read three times | **Fixed, verified.** All three images are `alt=""`; the anchor's accessible name is the price and the title once; the `title` attribute remains as a pointer tooltip. |
| D6 dev campaign id; eBay 403 to automated clients | **Unchanged, waived.** Every href carries `campid=5339999999`; tile 1 opens `www.ebay.com` in a new tab with 0 hops and eBay returns 403 "Error Page | eBay" to headless Chromium. Production's env value is outside this review. P7. |
| D7 the disclosure sentence twice | **Unchanged, waived.** 1,419 px in the block and 4,569 px at the article's end at 390. P4. |
| D8 no tip-off time while the arrival copy points at one | **Deferred, known-issues 89.** Still no time on either environment. P5. |
| D9 sub-44 px targets, the wordmark, red quick-facts links | **Unchanged, already tracked.** The same twelve targets, "NIGHT" 4.33:1, `link-in-text-block` 2 nodes, on both environments. P6. |
| D10 Ticketmaster wrap unwrapped on the dev server | **Unchanged, environment.** P8. |

New since the first review and not in D1 to D10: the dev server now gets partial Raptive fill (setup paragraph), which moves the branch's ad-tech axe and console numbers without touching first-party DOM; production moved from main 1d3b6f2 to 59eeb2e and then e5e5733 during the day, neither touching this page; and HEAD moved from 555ec5c to 403cff9 during the run, with the article unchanged.

### 8. Dispositions (branch session, 2026-11-08, before the merge)

| Finding | Disposition | Detail |
|---|---|---|
| P1 the third tile is not this bobblehead (a title with no year passes the surname rule) | **Waived for the merge, ruling requested before the flip** | The guard is the ruled one (surname or product token, plus the year rule Matt kept on 2026-11-08); a same-player listing with no year in its title cannot be told apart by it. Nothing renders in production until the Browse API keyset exists, so the merge ships no listing. Options for the ruling, not taken here: require the promo's year in the title of a listing shown on an upcoming page (presale listings carry it), or change the lead to "eBay listings naming this player" so the claim matches what the guard can know. |
| P2 ad, listings, ad between THIS GAME and the fan guide (888 px at 390) | **Waived, reported** | The direct cost of the placement ruling: Raptive places a container after every article child, so the new section earned one. Production fills both. If the run is too long, the options are a different slot (after the fan guide) or excluding the block from Raptive's content anchors; both are rulings. |
| P3 letterboxed thumbnails (carried D4) | **Deferred**, known-issues 88 | As before; the new third tile fills its square, so the row is uneven. |
| P4 the disclosure sentence twice (carried D7) | **Waived** | The brief asked for the line under the block. |
| P5 no tip-off time (carried D8) | **Deferred**, known-issues 89 | Production behaviour. |
| P6 sub-44 px targets, wordmark, red quick-facts links (carried D9) | **Already tracked** | known-issues 78, the brand ruling, known-issues 85. |
| P7 dev campaign id, eBay 403 (carried D6) | **Waived** | Production's `NEXT_PUBLIC_EBAY_CAMPID` is set in Vercel (Production); eBay's bot wall blocks automated clients. |
| P8 Ticketmaster wrap unwrapped on the dev server (carried D10) | **Waived** | Environment. |

Merge note acted on: main's known-issues 86 and 87 (the vendor-parking review) stay; this branch's entries are 88 and 89, and the first report's dispositions cite those numbers.

Post-merge (ruling 2026-11-08, after this report): the block's heading changed from "On eBay" with the lead "Current listings for this bobblehead." to "{word} bobbleheads on eBay", where the word is the token the guard confirmed the listings on, as the promo title spells it ("Erving bobbleheads on eBay"); the lead line left. This answers P1's claim problem without touching the guard. ux-review waived for a heading string, by ruling. P2 is tracked as known-issues 90 with a 2026-11-21 read.
