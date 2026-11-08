# UX review: promo page, baseline mode (feature/promo-forecast vs production): the game-time forecast row (step 5b)

Date: 2026-11-08 (America/New_York). Branch: `feature/promo-forecast`, HEAD **be7d839** ("Promo pages v2 step 5b: the game-time forecast (rulings 2026-11-08)"), one commit on top of main a304d3e. The worktree was clean apart from an untracked `node_modules` and, after this run, the screenshot folder. Measurements were taken 15:58 to 16:11 CST (16:58 to 17:11 ET).

- Branch render: Next.js dev server at http://127.0.0.1:3101 (a git worktree of the branch), answered 200 on the first curl. Its HTML carries no `<meta name="promonight-deploy">`, because a dev server has no deployment id. No eBay stub this time (a scarf, not a bobblehead); no eBay block renders on either environment.
- Production render: https://www.getpromonight.com. The deploy meta read `dpl_47Rn61EmQ8VpULAXVLr1G4VhBQQU` on the curl and on all six Playwright renders. Production does not have the forecast feature. Its response headers during the run: `x-vercel-cache: HIT`, `age: 948`, `x-nextjs-prerender: 1`, `x-nextjs-stale-time: 300`.
- Tooling: the scratchpad's Playwright (1.65, headless Chromium), a desktop Chrome User-Agent on both contexts and on curl, device scale 1, viewports 390x844, 768x1024 and 1280x800, a 5 s settle after `load`, a scroll-through to trigger lazy mounts, then back to the top for the full-page capture. @axe-core/playwright 4.14 (serious and critical only), pixelmatch 8 at threshold 0.1, Node 25. Scripts in the scratchpad at `ux-review-baseline/forecast/` (compare-html.js, measure.js, diff.mjs, localize.mjs, aligned-crop.mjs, walk.js, zoom.js, secondary.js, inspect.js).
- Pixel method, as in the earlier reviews: every iframe and every Raptive container masked in both captures and the overlapping area compared; a second pass matches each `<article>` child to its counterpart by heading text and compares the pair at their own tops, dy of -2 to +2 allowed.
- The dark circle at the bottom-left of the first screen in every branch PNG is the Next.js dev-tools indicator, not page content. It is the only thing that differs inside THIS GAME at 390 (see section 1).
- The NWS data behind the row was read directly from api.weather.gov during the run (grid LOT 76,72 for Soldier Field at 41.8623,-87.6167; the IND grid for Lucas Oil) to check the row's words against its source.

One URL, given explicitly rather than resolved from the sitemap, because the feature only renders for a game within seven days: `/nfl/chicago-bears/promos/bear-down-scarf` (Soldier Field, Chicago, America/Chicago), a game **today**. Screenshots: `2026-11-08-feature-promo-forecast/bear-down-scarf/{390,768,1280}-{branch,production}.png`. Diffs: `.../{390,768,1280}-diff.png` (red marks differing pixels, light blue marks masked ad areas). Those nine PNGs and this file are the only files written inside the repo.

---

## `/nfl/chicago-bears/promos/bear-down-scarf`

### 1. Baseline differences

**Served `<article>` HTML.** After normalization (deploy meta, `/_next/static` hashes, `?v=` strings, nonces, `<script>` bodies and `<!-- -->` separators stripped) the branch article is 569 lines / 29,077 bytes and production's is 553 lines / 28,453 bytes. `diff` reports 22 lines in **two regions**, exactly the two the brief expected:

| Region | Branch | Production |
|---|---|---|
| "Also on Ticketmaster" href (line 68) | `https://www.ticketmaster.com/chicago-bears-tickets/artist/805912` | `https://ticketmaster.evyy.net/c/7236189/264167/4272?u=...&sharedid=web_promo_page_chicago-bears&subId3=bear-down-scarf` (the dev-server Impact-wrap difference, carried from every earlier review) |
| One `<div data-forecast-row="true">` of 17 normalized lines (253 to 269), inserted as the **last child of the `<dl>` inside `<section id="before-you-go">`**, after the Transit row's closing `</span></dd></div>` and before `</dl>` | `<dt class="font-rd text-[10px] uppercase tracking-[0.12em] text-rd-ink-faint">Forecast</dt>`; `<dd class="m-0">` holding a `<span class="flex items-start gap-2">` with an inline `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true" class="mt-0.5 shrink-0 text-[var(--pp-accent-text)]" data-forecast-icon="cloud-moon">` (one path) and `<span>Mostly Clear, high 61° low 42°, 0% chance of precipitation</span>`, then `<span class="block font-rd text-[11px] text-rd-ink-faint">Forecast from weather.gov, updated Nov 8, 3:46 PM CT</span>` | absent |

Nothing else in the article differs: not the header, the CTA block, About, This game, the three existing Before you go rows, the gameday guide link, the two rails, Questions or the disclosure line. Body text (tags and scripts stripped) is 3,425 bytes on the branch against 3,307 on production, +118, the row's words. Full documents are 388,846 bytes (154 `<script>` tags, dev) against 127,424 (63). The row read the same text on every fetch between 15:55 and 16:11 CST (the branch's one-hour fetch cache), and the normalized article fetched at 16:11 is byte-identical to the one measured.

**Article direct children:** 14 on both environments at all three viewports. The row lives inside the Before you go card, so it adds no child and Raptive placed the same five containers. Where the card sits and how it grew:

| | 390 branch | 390 production | 768 branch | 768 production | 1280 branch | 1280 production |
|---|---|---|---|---|---|---|
| BEFORE YOU GO card (top, height) | 1,216, **579** | 1,216, 495 | 1,081, **474** | 1,131, 411 | 1,081, **432** | 1,081, 369 |
| Rows in its `<dl>` | 4 (Bag policy 1,299 h53; Parking 1,361 h95; Transit 1,466 h200; **Forecast 1,675 h74**) | 3 | 4 (Forecast 1,456 h53) | 3 | 4 (Forecast 1,414 h53) | 3 |
| "Soldier Field gameday guide" link top | 1,759 | 1,675 | 1,519 | 1,506 | 1,477 | 1,414 |
| Next article child after the card | Raptive Content_2 at 1,805, then MORE CHICAGO BEARS PROMOS at 2,079 | MORE CHICAGO BEARS PROMOS at 1,735, then Content_2 at 1,971 | rail at 1,579 | rail at 1,566 | rail at 1,537 | rail at 1,474 |
| Document height | 4,936 | 4,901 | 3,863 | 3,851 | 3,797 | 3,735 |

The card grows by exactly the row plus its 10 px gap: +84 at 390 (the summary wraps to two lines) and +63 at 768 and 1280 (one line). At 768 production's card is 50 px lower because its Content_1 ad filled at 300 px where the branch's container stayed an empty 250. At 390 Raptive also swapped the order of Content_2 and the Bears rail between the two renders (ad placement follows content height), which is why the rail moves by 344 px there and not 84. Document heights move less than the card (+35 / +12 / +62) because production's Content_3 filled at 298 px against the branch's 250.

**Pixels.**

| Viewport | Branch PNG | Production PNG | Raw differing pixels (masked overlap) | Aligned by article child |
|---|---|---|---|---|
| 390 | 390x4936 | 390x4901 | 71,339 of 1,432,218 = 4.98% (25.1% masked); first differing row 785 | Children 0 to 3 (nav, header, CTA block, About) **0**. THIS GAME 105 (the top edge of the dev-tools button at x 25 to 50, y 787 to 793; the rest of it sits under the footer-ad mask). **BEFORE YOU GO 1,339** (the row). Bears rail 412, NFL rail 482 (dy +1), disclosure line 496 (dy -1), QUESTIONS **0**. Total 2,834. |
| 768 | 768x3863 | 768x3851 | 94,857 of 2,263,803 = 4.19% (23.5% masked); first row 1,024 | Children 0 to 4 **0**. **BEFORE YOU GO 1,544**. Bears rail 548, NFL rail 293, QUESTIONS 0, disclosure 0. Total 2,385. |
| 1280 | 1280x3797 | 1280x3735 | 198,385 of 3,756,955 = 5.28% (21.4% masked); first row 800 | Children 0 to 4 **0**. **BEFORE YOU GO 1,544**. Bears rail 659, NFL rail 293, QUESTIONS 0, disclosure 0. Total 2,496. |

The raw percentages are everything below the card moving. The residuals outside the card are not content: side-by-side crops at matching tops show the same disclosure sentence with every glyph edge differing, only the second text line of each Bears rail card differing, and only the date digits (a 23 px column) in the NFL list differing, with 293 px identical at 768 and 1280. The cause is the row's height: 15 + 42 + 16.5 = **73.5 px** at 390 and 15 + 21 + 16.5 = 52.5 px at the wider viewports (the 11 px faint line has a 16.5 px line-height), so every line after the card sits half a pixel lower on the branch and is rasterized differently. The two aligned diffs are otherwise zero.

**Measurements that moved.** Document height (+35 / +12 / +62), the card's height (+84 / +63 / +63) and row count (4 vs 3), the position of everything after the card, body text bytes (+118). Ad-driven, both directions: contrast failures (1 vs 2, production's second being the "×" of an ad close button at 2.12:1), axe serious+critical (1 vs 7, 1 vs 7, 3 vs 5; the branch's three at 1280 are the logo plus `frame-title` and `image-alt` on ad iframes that happened to load), interactive elements (54 vs 58, 60 vs 65, 60 vs 65; production's extras at 390 are the Pause / Unmute / Volume controls of a video ad), console errors, CLS (see section 6). **Unchanged:** H1, title, canonical, no robots meta, H2 order (About this giveaway, This game, Before you go, More Chicago Bears promos, More NFL giveaways coming up, Questions), 14 article children, `/promos/` anchors 19 in the DOM / 17 visible at 390 and 19 / 18 at 768 and 1280 (the two hidden ones are the desktop nav's "Today" and the dialog's), the CTA, the 14 in-article tap targets under 44 px, the "NIGHT" logo at 4.33:1, and zero requests to weather.gov from the browser on either environment.

### 2. Game date check

- **Dates on the page (390, branch).** The header `<time datetime="2026-11-08T19:20:00-06:00">` reads "Sunday, Nov 8, 2026 · 7:20 PM CT" at 268 px. The date tile at 336 to 525 px reads "SUN 8 NOV, TONIGHT". The THIS GAME caption at 857 px reads "Nov 8 · Bear Down Scarf · home game 5 of 8". The bag row reads "Checked Nov 8, 2026"; the forecast row reads "updated Nov 8, 3:46 PM CT".
- **JSON-LD.** One Event, `startDate` "2026-11-08" (date only; the 7:20 PM is in the `<time>` but not in the Event), location Soldier Field, 1410 Special Olympics Dr, Chicago, IL 60605. Identical on both environments.
- **Venue zone.** Soldier Field, Chicago: America/Chicago, on standard time since Nov 1 (the `<time>` offset -06:00 agrees). The clock there during the run read 15:58 to 16:11 CST on 2026-11-08; kickoff was about three hours twenty minutes away.
- **Verdict: today's game, not played.** Both environments render the upcoming state: Get tickets, Share, Also on Ticketmaster, Parking, Hotels, Remind me, and the tile says TONIGHT; no played-state copy anywhere on the page. The game being today (day 0 of the seven-day window) is what makes the forecast row render.

### 3. Three things that work

1. **The row is server-rendered and inert.** It is in the served bytes (one `data-forecast-row` in the HTML on top of the RSC payload), the browser makes zero requests to weather.gov, it adds no tap target (no link in the row; the in-article under-44 list is the same 14 as production), no layout-shift entry names it (CLS 0 at 390 on the branch; the two 768 entries, 0.0008 at ~450 ms on the header flex and 0.0398 at ~780 ms on a `section.mt-6`, occur identically on production), and every piece of its text passes: the 10 px label at 5.0:1 and the 11 px faint line at 5.0:1 (rgb(120,110,96) on the white card, the same ink as the existing labels and the bag row's "Checked" line), the 14 px summary at 16.75:1, the glyph's stroke (#0b162a, the Bears' accent text) at 18.07:1. axe reports nothing on it; the svg is `aria-hidden`.
2. **The words are an honest transcription of the source, in the venue's clock.** api.weather.gov `gridpoints/LOT/76,72/forecast` read live at 22:07Z gave `updateTime 2026-11-08T21:46:06Z`, "This Afternoon" 61°F Sunny, "Tonight" 42°F Mostly Clear, chance of precipitation 0 on both periods; the row prints "Mostly Clear, high 61° low 42°, 0% chance of precipitation" and "updated Nov 8, 3:46 PM CT", which is 21:46Z in CST. (A first fetch at 22:00Z returned an older NWS cache copy, 20:46Z and 59°F; NWS's own CDN varies, the page did not.) The "updated" time is NWS's `updateTime`, not the render time, so a fan reading a cached page sees the forecast's real age; see D7 for the caveat. The gating also held everywhere it was tried: the Nov 22 Bears page the rail leads to (14 days out) renders no row; the Canadian page renders no row and the dev log carries zero `[forecast]` warnings; the retractable-roof page prints its note (section 7).
3. **Placement, and the fan walk on both environments.** The row is the last row of Before you go, after Bag policy, Parking and Transit, with the card's 10 px gap above it and 10 px below to "Soldier Field gameday guide"; the card grows by exactly the row and every article child above it is pixel-identical (0 px) at all three viewports. "Get tickets" (144x52, new tab, `rel="noopener noreferrer sponsored"`) goes to `ticketnetwork.lusg.net`, 302 to `www.ojrq.net`, 302 to `goto.ticketnetwork.com`, 301 to `www.ticketnetwork.com/tickets/7730278/chicago-bears-vs-tampa-bay-buccaneers-tickets-sun-nov-8-2026-soldier-field` (200, "Chicago Bears vs. Tampa Bay Buccaneers in Chicago, IL at Soldier Field on November 08, 2026"). The first rail card (150x105, "SUN NOV 22 Celebrating Women and Girls in Sports") lands on an H1 "CELEBRATING WOMEN AND GIRLS IN SPORTS"; back restores scrollY 2,079 to 2,079 (delta 0; production 1,893 to 1,893). The gameday guide link lands on `/venues/soldier-field`; back restores 1,216 to 1,216 on both.

### 4. Defects

**D1. The row describes the wrong part of the day when kickoff's period has passed: a "Game-time forecast" with a moon glyph and the night's condition for a 1:00 PM kickoff. Branch only; seen on the secondary Colts page at 390, mechanism general.** `/nfl/indianapolis-colts/promos/white-beanie` (kickoff 1:00 PM ET today) read at 4:53 PM ET shows "GAME-TIME FORECAST / Clear, high 58° low 38°, 0% chance of precipitation · retractable roof" with a crescent-moon glyph (`data-forecast-icon="moon"`). NWS's IND grid at that hour carried "This Afternoon" (4 to 6 PM, 58°F Sunny) and "Tonight" (6 PM to 6 AM, 38°F Clear); the 1 PM hour no longer had a period, so the condition and glyph fell to the night's. The label says game time; the words are tonight's weather and the low is Monday at dawn. Any early-afternoon game read after about 3 PM local, and any game whose time is unknown, gets this. Scratchpad capture: `ux-review-baseline/forecast/shots/zoom-colts-row-2x.png`.

**D2. For a 7:20 PM kickoff the two temperatures are the 3 PM high and Monday-dawn low; the kickoff temperature is not on the page. Branch; all viewports.** `390-branch.png` at 1,690 px. "high 61° low 42°" is NWS's "This Afternoon" and "Tonight" temperatures. NWS's hourly forecast for the same grid at 22:00Z: 54°F at 6 PM, **53°F at 7 PM**, 51° at 8, 49° at 9, **48°F at 10 PM**, wind 10 mph W to NW, 0% chance of precipitation. A fan dressing for Soldier Field tonight will stand in 53° falling to 48° with a lake wind; the row tells them 61° and 42°, neither of which happens while they are in the building. The condition word ("Mostly Clear") is the only game-time element.

**D3. The label is "Forecast" at an open-air stadium, so the fan is not told this is the weather at the game. Branch; all viewports.** `390-branch.png` at 1,675 px. Soldier Field has no roof flag on its hub, so the label falls to the generic word; Lucas Oil, which has one, gets "GAME-TIME FORECAST". Under the card's "Soldier Field" subhead and after a transit paragraph, a bare "FORECAST" followed by a day's high and low reads as the city's weather for the date, not what the fan will sit in at 7:20 PM. The spec puts the flag on 35 venue docs, so the generic label is the common case, and the open-air stadiums it was built for are the ones most likely to carry it.

**D4. The sentence is a forecaster's, not a fan's. Branch; all viewports.** "Mostly Clear" keeps NWS's title case in the middle of a sentence; "high 61° low 42°" has no separator between the two numbers; "0% chance of precipitation" is the longest clause in the row and, at 0%, says nothing a fan needs ("no rain expected" or nothing at all does the job; at 20%, "20% chance of rain" reads faster than "20% chance of precipitation", and NWS's own condition word already says "Snow Showers" when it is snow). The word "precipitation" is also what forces the 390 wrap (D6).

**D5. The cloud-moon glyph reads as a cloud. Branch; all viewports.** `390-branch.png` at 1,692 px; 4x crop in the scratchpad at `ux-review-baseline/forecast/shots/zoom-bears-glyph-4x.png`. The svg is 18x18 CSS px on a 24-unit viewBox; the drawn path is 14.9 x 14.5 units (about 11 x 11 px), and the moon is a 4.5-unit arc (about 3.4 px) at the top right that reads as a notch. For "Mostly Clear" the fan sees a cloud, the opposite of the word beside it. The stroke is the team accent (#0b162a navy) at 18.07:1, so it is visible; it is the shape that fails at this size. The Colts' lone crescent reads clearly as a moon (but see D1 for why it is there).

**D6. At 390 the summary wraps with "precipitation" alone on its second line, and the row's height is fractional. Branch; 390 only.** `390-branch.png` at 1,690 to 1,732 px. The text column beside the glyph is 302 px at 14 px / 21 px line-height; "Mostly Clear, high 61° low 42°, 0% chance of" fills line one and "precipitation" is the orphan. The row is 73.5 px tall (the faint line's 16.5 px line-height), which puts every later line of the page on a half pixel and is the whole source of the residual diffs in section 1. Cosmetic.

**D7 (observation, not a defect). "updated Nov 8, 3:46 PM CT" is honest, with one caveat the row does not state.** The time is NWS's `updateTime`, verified above, not when the page was built. But production serves this page from a 24-hour ISR cache (`x-vercel-cache: HIT`, `age: 948` during the run, stale-time 300) over a one-hour fetch cache, so a fan on game day can be reading a row built the evening before, and the 24-hour freshness rule is applied at render only. The printed time is what keeps this honest (the fan can see "Nov 8" on Nov 9); the spec accepts the gap and compares it to the date tile's "In N days". Recorded so the acceptance is on the record next to the measurement.

**Carried, both environments, not this branch.** The "NIGHT" logo at 4.33:1 (brand ruling); 14 in-article tap targets under 44 px, from "NFL" 23x18 to "Soldier Field gameday guide" 328x21, including the three row source links at 88x12, 217x12 and 88x12 (known-issues 78); "Soldier Field gameday guide" lands on an H1 "Soldier Field Bag Policy" (label and destination H1 do not match); the JSON-LD Event is date-only while the page prints 7:20 PM CT.

### 5. Measurements

| Measurement | 390 branch | 390 production | 768 branch | 768 production | 1280 branch | 1280 production |
|---|---|---|---|---|---|---|
| Status / deploy | 200 / none (dev, be7d839) | 200 / dpl_47Rn61EmQ8VpULAXVLr1G4VhBQQU | 200 / none | 200 / dpl_47Rn… | 200 / none | 200 / dpl_47Rn… |
| Document height | 4,936 | 4,901 | 3,863 | 3,851 | 3,797 | 3,735 |
| Article direct children | 14 | 14 | 14 | 14 | 14 | 14 |
| Before you go card top / height | 1,216 / 579 | 1,216 / 495 | 1,081 / 474 | 1,131 / 411 | 1,081 / 432 | 1,081 / 369 |
| Forecast row top (screens down) | 1,675 (1.98) | absent | 1,456 (1.42) | absent | 1,414 (1.77) | absent |
| Forecast row size / summary lines | 328x74 (73.5) / 2 | – | 578x53 / 1 | – | 706x53 / 1 | – |
| Row position in `<dl>` | 4th of 4, after Transit; 10 px above, 10 px below to the guide link | – | same | – | same | – |
| Glyph | 18x18, `cloud-moon`, #0b162a, 18.07:1 | – | same | – | same | – |
| Row text contrast (label 10 px / summary 14 px / faint 11 px) | 5.0 / 16.75 / 5.0 | – | 5.0 / 16.75 / 5.0 | – | 5.0 / 16.75 / 5.0 | – |
| Page contrast failures (< 4.5:1) | 1 ("NIGHT" 4.33) | 2 ("NIGHT"; ad "×" 2.12) | 1 | 2 | 1 | 2 |
| Interactive elements / under 44 px / under 44 in article | 54 / 38 / 14 | 58 / 42 / 17 (+ad Pause, Unmute, Volume) | 60 / 43 / 14 | 65 / 48 / 14 | 60 / 44 / 14 | 65 / 49 / 14 |
| axe serious + critical | 1 (color-contrast, logo) | 7 (ad iframes) | 1 | 7 | 3 (logo + frame-title, image-alt on ad iframes) | 5 |
| CLS at load / after scroll | 0 / 0 | 0.0112 / 0.0112 | 0.0406 / 0.0406 | 0.0718 / 0.0723 | 0.0002 / 0.0002 | 0.0301 / 0.0304 |
| CLS sources naming the forecast row | none | – | none | – | none | – |
| `/promos/` anchors DOM / visible | 19 / 17 | 19 / 17 | 19 / 18 | 19 / 18 | 19 / 18 | 19 / 18 |
| First ad anchor (data-ad-region / item inside the article) | none; the article root carries `data-ad-region="content"` at 57; Raptive's first container at 942 | same, 942 | 807 | 807 | 807 | 807 |
| Requests to weather.gov from the browser | 0 | 0 | 0 | 0 | 0 | 0 |
| Load to `load` event (ms) | 2,474 (dev) | 316 | 654 | 351 | 663 | 353 |
| Game line | `2026-11-08T19:20:00-06:00` "Sunday, Nov 8, 2026 · 7:20 PM CT" at 268 | same | same | same | same | same |

### 6. Recommendation

Make the row describe the hour the game is played, not the calendar date: the condition and glyph of the kickoff hour, the temperature at kickoff (NWS publishes it hourly for the same grid), and no row at all when NWS no longer carries that hour. That one change retires D1 and D2 together and makes "Game-time forecast" true wherever the label appears; the label, glyph and wording defects (D3 to D6) are small once the number beside them is the one the fan will feel.

---

## 7. Secondary check (branch, 390)

`/nfl/indianapolis-colts/promos/white-beanie` (Lucas Oil Stadium, retractable roof; game line "Sunday, Nov 8, 2026 · 1:00 PM ET") renders the forecast row as the fifth of five Before you go rows, after Bag policy, Gates, Parking and Outside food, at 2,221 px (2.63 screens down), 328x74. Its label is **"GAME-TIME FORECAST"**, and **" · retractable roof" does appear after the summary**: "Clear, high 58° low 38°, 0% chance of precipitation · retractable roof", then "Forecast from weather.gov, updated Nov 8, 3:45 PM ET" (NWS's IND grid read live at 22:08Z was already at 21:15:23Z, 4:15 PM ET, so the dev server's one-hour fetch cache is visible here); the glyph is the crescent `moon` in the Colts' #002c5f, which is D1 above. `/nhl/calgary-flames/promos/hockey-fights-cancer-night` (Scotiabank Saddledome, Calgary, Alberta; "Sunday, Nov 8, 2026 · 5:00 PM MT") renders **no forecast row**: zero `data-forecast-row` in the served HTML and in the DOM, Before you go carries only Bag policy and Parking, and the dev log has no `[forecast]` line, so the Canadian points 404 was swallowed as designed.

Measurement line: Colts row 328x74 at 2,221 px, dt "GAME-TIME FORECAST", icon `moon`, note present, 5th of 5 rows; Flames rows in Before you go 2, forecast rows 0.

---

## 8. Dispositions (branch session, 2026-11-08, before the merge)

Every defect above is fixed, deferred with a known-issues entry, or waived with its reason here, per the merge rule in CLAUDE.md. The fixes were re-run on the worktree dev server at 390 after the change.

| Finding | Disposition | Detail |
|---|---|---|
| D1 a game hour the forecast no longer covers fell back to the night period under a "game-time" label | **Fixed** | `forecastFromPeriods` returns null when the game time is known and no remaining period contains it (NWS drops a period once it has passed): a 1 PM kickoff read at 5 PM renders no row. Re-run: the Colts page renders no forecast row after kickoff; the Bears page (7:20 PM, the night period still ahead) keeps its row. An evening game on the last day of the fourteen-period range, whose night period does not exist yet, also renders nothing. Unit tests cover both. |
| D2 the day's high and the night's low rather than the kickoff temperature | **Waived, ruling requested** | The brief's own words are "high/low or the period temperature", which is what the row prints, from NWS's half-day periods. The reviewer's recommendation, the hourly forecast's temperature and condition at the kickoff hour (the same grid's `forecastHourly` URL), would make "game-time" literally true and is a change to the brief: Matt to rule. Not taken here. |
| D3 "Forecast" at an open-air stadium whose roof flag is absent | **Waived by ruling** | Rulings 2026-11-08: absent flag, generic label, never suppressed. The remedy is data, not code: write `roof: open` on the open-air stadiums (Soldier Field among them) so they take "Game-time forecast". Pipeline ticket, reported. |
| D4 a forecaster's sentence | **Fixed in part** | The condition is set in sentence case ("Mostly clear") and the two temperatures are separated ("high 61°, low 42°"). "N% chance of precipitation" stays, including at 0%: the brief names the chance of precipitation as the row's third required field and NWS's condition word already says rain or snow. |
| D5 the cloud-moon glyph read as a cloud at 18 px | **Fixed** | The cloud-moon and cloud-sun glyphs were redrawn with the moon and sun given the upper right third of the box (a 5.5-unit crescent, a 3.5-unit sun with three rays) and the cloud the lower left. |
| D6 "precipitation" orphaned on the second line at 390; a 73.5 px row | **Waived** | Cosmetic. The fractional height is the faint line's 11 px / 16.5 px style, the same as the bag row's "Checked" line beside it; the wrap follows from the third field's wording, kept by the brief. |
| D7 the printed update time against the page's 24-hour ISR window | **Recorded** | The spec's step 5b entry states the acceptance: the row prints NWS's own update time, so a fan sees the forecast's real age, as the date tile's "In N days" already carries the same window. |
| Carried: the wordmark, sub-44 px source links, the gameday guide's H1 mismatch, the date-only Event | **Already tracked or outside this branch** | known-issues 78, the brand ruling; the guide link and the Event's time are not this branch's. |

### Post-merge change (ruling 2026-11-08, after this report): the kickoff hour from the hourly grid

Matt took the recommendation (D2): the row now reads the game's start hour from the grid's hourly forecast (`forecastHourly` from the points response): temperature, chance of precipitation and condition at that hour, printed as "{condition}, {temp}° at {kickoff time}, {precip}% chance of precipitation". The daily half-day period is the fallback only when the hourly grid does not reach the start hour (a game near the end of the seven-day range), and the past-kickoff rule stands: once the hour has left the hourly grid, no row. ux-review waived for this change by ruling: it is a text change inside an existing row, with no new element, position or target. Tests cover the hourly path, the daily fallback and the no-row-after-kickoff case.
