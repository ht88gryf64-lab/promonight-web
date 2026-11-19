# UX review: events kids' tickets row (Phase 5D)

Run 2026-11-19 (America/New_York), baseline mode, one stop page at one width.

- Branch: `feature/events-kids-tickets`, tip 6360f69 (same commit as origin/main) plus uncommitted working-tree changes in `src/components/events/EventStopView.tsx`, `src/lib/events/event-pages.ts` and its test. Served from a production build at `http://localhost:3100`, events flag on. The local server carries no `promonight-deploy` meta.
- Production: `https://www.getpromonight.com`, `<meta name="promonight-deploy" content="dpl_8hBtokXzURpCiPsLfbHgATqUX8SL">`.
- Page: `/events/monster-jam/ball-arena`. Viewport 390x844 only, as scoped by the request; 768 and 1280 were not rendered.
- Browser: Chromium (Playwright 1.65), mobile emulation with touch. No WebKit build is installed, so iOS Safari was not checked.
- Screenshots and diff images are in the session scratchpad, not in the repo, as requested.
- Blocked during the run: ticketnetwork, lusg.net, spothero, expedia, ticketmaster, seatgeek, posthog, google-analytics, googletagmanager, doubleclick, raptive, adthrive, monsterjam.com, feldentertainment, ballarena.com. No ticket, parking or venue source link was opened; hrefs were read only.

## 1. Baseline differences (branch against production, 390)

**Served HTML of `<main>`** (scripts, nonces and build hashes stripped): not identical. 220 leading lines and 76 trailing lines are byte-identical. Exactly two regions differ, both inside the Before you go card:

1. The Parking row wrapper gains `border-b border-rd-line` (production: no border class, because it was the last row). Its contents are unchanged.
2. One new row follows it, `data-row="kids"`, with no border class: the ticket icon, the label "Kids' tickets", the paragraph "All guests age 2 & older are required to have a ticket.", and the line "ballarena.com · read Nov 19, 2026 · source", where "source" is `<a target="_blank" rel="noopener nofollow">` to `https://www.ballarena.com/event-pages/monster-jam-freestyle-mania-presented-by-spin-master`.

Title, meta description, canonical and all JSON-LD blocks are identical. The rule text is not in the JSON-LD.

**Pixels.** Full-page height 4,568 (production) against 4,683 (branch).
- y 0 to 1,940: 0 pixels differ.
- Parking row: 27 pixels differ, all at y 2,126 to 2,132 at the card's left and right edges. These are production's rounded bottom corners, which the branch card no longer has at that height.
- New band: the divider under Parking (1px) and the new row (113.6px), 114.6px in all.
- Below the card: every section sits 114.6px lower and is otherwise the same. The shift is fractional, so a shifted screenshot comparison only shows text antialiasing noise. To settle it, the new row was hidden and the Parking divider removed in the browser on the branch render, and that full-page screenshot was compared with production: same height (4,568) and 0 differing pixels.

**Measurements that moved.**

| Measurement | Production | Branch |
|---|---|---|
| Card rows | bags, parking | bags, parking, kids |
| Parking row border-bottom | 0px | 1px, rgba(33,29,24,0.1) |
| Parking row height | 189.5 | 190.5 |
| Card height | 319.3 | 433.9 |
| Before you go section height | 352.1 | 466.7 |
| "Also at Ball Arena" top | 2,163.0 | 2,277.6 |
| "More Monster Jam stops" top | 2,436.6 | 2,551.2 |
| "Questions" top | 2,844.2 | 2,958.8 |
| Full-page height | 4,568 | 4,683 |
| Interactive elements | 43 | 44 |
| Under 44x44 | 26 (3 in main) | 27 (4 in main) |
| Visible text nodes | 137 | 142 |

Nothing else moved. Unchanged in particular: the first Tickets button (x 267.5, y 669.3, 93.5x48 in both), the card's top (y 1,819.7 in both), heading order, document clientWidth and scrollWidth (390 and 390 in both), CLS (0 in both), contrast failures, axe results.

Main and production were not compared commit to commit; the pixel equivalence above (0 pixels once the new row is removed) shows the branch base renders as production does on this page.

## 2. Game date check

- Dates read from the game line: "Feb 12 to 14, 2027", hero tag "85 days away" (correct for Nov 19, 2026).
- Event `startDate` values in the JSON-LD (4 Events, both environments): 2027-02-12T19:00:00-07:00, 2027-02-13T12:00:00-07:00, 2027-02-13T18:00:00-07:00, 2027-02-14T12:00:00-07:00. The four `<time>` elements carry the same values.
- Today in the venue zone (America/Denver): 2026-11-19.
- Verdict: every date is in the future. Not a played game. All four showtime rows show a Tickets button and none has passed, which is correct.

## 3. Things that work

1. **The new row matches the card.** Measured against the Bag policy and Parking rows on the same page and against production rows that carry a source line (Ford Field re-entry row, Bridgestone Arena bag row):
   - Icon tile 40x40 at x 31, radius 10px, cream fill, top-aligned with the label, as on the other rows. Glyph 22x22, stroke 2, ink color.
   - Label: 11px, weight 600, uppercase, letter spacing 1.32px, rgb(120,110,96), same as "Bag policy" and "Parking".
   - Rule text: 14px, line height 20.3px, rgb(80,72,63), identical to the Bag policy paragraph. It wraps to two lines in a 276px column with no clipping (scrollWidth equals clientWidth).
   - Source line: 11px, rgb(120,110,96), link rgb(198,42,30) underlined, classes identical to production's Ford Field and Bridgestone source lines. Gap from rule text to source line 6px, the same as production.
   - Spacing: 14px padding top and bottom, 12px between tile and text, 6px between label and text, all equal to the other rows.
   - Dividers: Bag policy 1px, Parking 1px (new), Kids' tickets 0px. The card's rounded bottom and 4px bottom padding close under the new row the way they closed under Parking.
2. **Characters render correctly.** The label's apostrophe is U+0027 and shows as an apostrophe ("KIDS' TICKETS"); the served HTML escapes it as `&#x27;`, which the browser decodes. The rule shows a real ampersand ("age 2 & older"); the served HTML carries `&amp;` and no double-escaped entity appears in the rendered text or the accessibility tree.
3. **Nothing overflows and nothing shifts.** clientWidth 390, scrollWidth 390, no element extends past the viewport, CLS 0. At 320 wide (extra check) the page still does not overflow; the source line wraps to two lines there. No console errors or hydration errors on the branch.

Also working: heading order is unchanged (H1 Monster Jam Denver; H2 Pick your show, Hour by hour, Before you go, Also at Ball Arena, More Monster Jam stops, Questions; two H3 questions; the row label is a span, not a heading). The source link opens in a new tab with `rel="noopener nofollow"`, the same as every other venue link on the page, and has a visible focus outline. Screen reader order in the row: label, rule, source line, link "source".

## 4. Defects

Introduced or extended by this branch:

- **D1. Medium. The "source" link is a 33.3x12 tap target (390).** The only way to check the rule is an 11px word, 12px tall. Contrast is fine: link 5.6:1 on white, the grey line around it 5.0:1. It is the same size, color and markup as the card source links already in production on other stops (Ford Field and Bridgestone Arena: 33.3x12, rgb(198,42,30), 11px) and as the Hour by hour source link on this page (33.3x12, in both environments), so this is one more instance of an existing pattern, not a new one. The nearest other target is 78px away, so the risk is a missed tap, not a wrong one.
- **D2. Low. The ticket glyph is lighter than its neighbours (390).** The ticket outline is 9 of 24 units tall, about 8px on screen, against roughly 15 to 16px for the bag and the parking sign in the same 40px tile. The dashed perforation renders as two dots. It reads as a ticket stub up close and as a small dark bar at arm's length.
- **D3. Low. Straight apostrophe in the label.** "Kids' tickets" uses a typewriter apostrophe. The footer newsletter link on the same page uses a curly one ("the week’s giveaways"). The site is already mixed on this (the hub's Questions copy uses straight ones in production).
- **D4. Low. Two read dates for one source on the same page.** Hour by hour says "Pit Party times as listed by Ball Arena · read Nov 18, 2026 · source"; the new row says "ballarena.com · read Nov 19, 2026 · source". Both links have the same href. Each date is presumably true for its own fact, but a fan sees one venue page read on two different days, 520px apart, and the two lines name the venue differently ("Ball Arena" against "ballarena.com"). The card form matches production's other card rows.
- **D5. Low. Hub: the new lead line does not stand apart from the rules under it (390, `/events/monster-jam`).** The lead and the three venue lines are four paragraphs in the same 14px grey, 4px apart, so the block reads as one seven-line paragraph. The lead ends in a colon but what follows is not a list. See section 6.

Already in production (both environments, not caused by this branch):

- **P1.** Header wordmark "NIGHT", #da2d20 on #f7f3ea at 18px, 4.33:1. The single failing text node (1 of 142) and the single axe serious violation (`color-contrast`, 1 node).
- **P2.** Hit sizes at 390: breadcrumb "Events" 37.1x18 and "Monster Jam" 69.8x18; the Hour by hour "source" link 33.3x12; header menu button 40x40; wordmark link 17.1 tall; newsletter link 20 tall; 19 footer links 15 tall.
- **P3.** The source page for this stop is the venue's "monster-jam-freestyle-mania-presented-by-spin-master" page, while the stop page is titled "Monster Jam Denver". Production already cites that page for Pit Party times. The page was not opened in this run (by instruction), so whether its rule covers these four shows was not verified here.
- **P4.** The body font draws the ampersand in a form that resembles a reversed 3 ("2 & older", and "AT&T" on the hub). It is the correct character; some readers will pause on it.
- **P5.** Hub Questions: the venue links are inline, 15px tall; the "AT&T Stadium" link breaks across two lines.

## 5. Fan walk (branch, 390)

- Above the fold: header, breadcrumb, truck photo, "Live event" and "85 days away", the H1 "Monster Jam Denver", "Ball Arena, Denver, Colorado", "Feb 12 to 14, 2027", photo credit, hazard stripe, "Pick your show", the Friday 7:00 PM row with its Tickets button (y 669) and the top of the Saturday 12:00 PM row. Date, venue and a Tickets button are all visible at rest. Identical in production.
- First scroll: the rest of the showtimes with Pit Party lines, then Hour by hour. Second scroll: the end of Hour by hour and the Before you go card. The new row sits at y 2,135 to 2,249, about two and a half screens down.
- Primary action: "Tickets", 93.5x48, `target="_blank"`, `rel="noopener noreferrer sponsored"`, host `ticketnetwork.lusg.net`. Not tapped and no redirect followed, by instruction; the host was read from the href.
- Rail card: the first card in More Monster Jam stops ("Anaheim, Angel Stadium · 8 shows") goes to `/events/monster-jam/angel-stadium`; destination H1 "Monster Jam Anaheim". Back: scroll 2,326 before, 2,326 after (production 2,211 and 2,211).
- Nothing in the new row looks tappable and is not: the rule is plain grey text, the icon tile is not a link, and only "source" is red and underlined.

## 6. Hub Questions block (branch, 390, glance only)

- Rename confirmed: "Is Monster Jam good for kids?" is now "Do kids need a ticket for Monster Jam?". The H3 fits on one line (328px column, 22.5px tall). The only other HTML difference in `<main>` is the added lead paragraph: "Each venue sets its own rule, and other venues may differ. These venues print a rule for their shows:" (two lines).
- The three venue lines are unchanged from production in text, markup and size: each wraps to two lines; links "AT&T Stadium" (breaks across the line end), "Ball Arena" 63.9x15 and "Lucas Oil Stadium" 112.8x15, all `target="_blank" rel="noopener nofollow"`, 14px, rgb(198,42,30). The link lines are 44.6px apart center to center.
- No overflow (390 and 390), CLS 0, heading order unchanged apart from the renamed H3. Questions section height 590.2 to 634.8; page height 5,665 to 5,709.
- Finding: D5 above. Tap targets are P5, unchanged.

## 7. Measurements (390)

| Measurement | Branch | Production |
|---|---|---|
| HTTP status | 200 | 200 |
| Document clientWidth / scrollWidth | 390 / 390 | 390 / 390 |
| Full-page height | 4,683 | 4,568 |
| CLS during load | 0 | 0 |
| Interactive elements (visible) | 44 | 43 |
| Under 44x44 | 27 (4 in main) | 26 (3 in main) |
| Text nodes failing 4.5:1 | 1 of 142 ("NIGHT", 4.33) | 1 of 137 ("NIGHT", 4.33) |
| axe serious or critical | 1 (color-contrast, 1 node) | 1 (same) |
| `<a>` to /promos/ in DOM / visible | 8 / 6 | 8 / 6 |
| First ad anchor, distance from top | none on page | none on page |
| First Tickets button (x, y, size) | 267.5, 669.3, 93.5x48 | 267.5, 669.3, 93.5x48 |
| Before you go card top / height | 1,819.7 / 433.9 | 1,819.7 / 319.3 |
| Kids' tickets row (y, height) | 2,135.0, 113.6 | not present |
| Kids row: label / rule / source line size | 11px / 14px / 11px | not present |
| Kids row contrast: label, rule, source line, link | 5.0, 8.98, 5.0, 5.6 | not present |
| Kids "source" link hit size | 33.3x12 | not present (33.3x12 on Ford Field and Bridgestone Arena cards) |
| Hour by hour "source" link hit size | 33.3x12 | 33.3x12 |
| Row dividers (bags, parking, kids) | 1px, 1px, 0px | 1px, 0px |
| Rail card back: scroll before / after | 2,326 / 2,326 | 2,211 / 2,211 |
| Console errors | 0 | 0 |

## 8. Recommendation

The page does what the change says and nothing else: with the new row removed the branch is pixel-identical to production, the first Tickets button does not move, and the row is built from the same parts as its neighbours. Merge after giving D1 to D5 a disposition here. D1 is the one to decide on purpose, since it applies to every source line in the card and this branch adds another; the rest are Low. Check the row once on a real iPhone, because this run was Chromium only.

## Dispositions (2026-11-19, Phase 5D)

| Defect | Disposition |
| --- | --- |
| D1. The "source" link is a 33x12 tap target | Deferred: known-issues 114 (7). It is the card's existing source link, unchanged in size, color and markup from the rows already in production; fixing it means changing every source line in the card, which is its own change. |
| D2. The ticket glyph is small in its tile | Fixed: the glyph is redrawn to fill the tile like the bag and parking glyphs. |
| D3. Straight apostrophe in "Kids' tickets" | Waived: the site is mixed on this and the page's other labels use plain punctuation. |
| D4. Two read dates for one source URL | Waived: both are true. The Pit Party times were read on Nov 18 and the child ticket rule on Nov 19; each line carries the date its own fact was read. |
| D5. The hub lead and the venue lines read as one paragraph | Fixed: the venue rules are now a bulleted list under the lead. |
| P1 to P5 | Already in production, unchanged by the branch. |

After the review the branch also took three fixes from the adversarial review of the same build: the hour-by-hour footer names the Pit Party only where a Pit Party window is stored (Lucas Oil Stadium's card is gates only), the Kids' tickets row prints one line per distinct rule, and the Re-entry and parking-fact rows take the same stored-visit check as the new row. The page was rebuilt and its served HTML re-read after these.
