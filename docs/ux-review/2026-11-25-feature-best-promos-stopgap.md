# ux-review: feature/best-promos-stopgap (2026-11-25)

Run 08:46 to 09:15 America/New_York. Baseline mode. Pages: `/` (home, the main subject), `/best-promos`, `/team-rankings`, each at 390x844, 768x1024 and 1280x800, branch beside production.

- **Branch:** `feature/best-promos-stopgap`, served by `next dev` on http://localhost:3100 from `/private/tmp/pn-wt/best-promos-stopgap` with PROMO_PAGES_LIVE=true. The dev server carries no `promonight-deploy` meta.
- **The branch moved during the run.** It was at `ae8cec8` when the run started and at `59e728c` (committed 08:53:22 ET) when it ended. Every screenshot, measurement and HTML extract in this report was taken after 08:53:22 and reflects `59e728c`; the homepage capture was repeated after the commit and matched the first one exactly (same heights, same counts).
- **Production:** https://www.getpromonight.com, `dpl_7FiidXwyPgvHEdC6pfXk8cpzKRUk`.
- **Screenshots:** in `2026-11-25-feature-best-promos-stopgap/<slug>/`, named `<viewport>-<env>.png`. Those are rendered with the ad script blocked so the two environments can be compared pixel for pixel. The homepage also has `<viewport>-<env>-ads.png`, rendered with ads on, for check (e).
- **Environment noise, not from the diff:** the footer "Events" link exists on production and not locally (EVENTS_PAGES_LIVE), which makes every branch page 34px shorter; Ticketmaster links are bare locally and Impact-wrapped on production; the homepage "Find Your Team" grid leads with six Minnesota clubs on production (geo lookup) and with the national order on localhost; unfilled ad slots on localhost.
- **One dev-server 500.** One of my requests to `/` got a 500 (`__webpack_modules__[moduleId] is not a function`) while another client's request compiled `/best-promos` at the same moment. It did not recur in about 60 later requests. I treat it as a `next dev` recompile race, not page behaviour.

---

## 1. Home `/`

### Baseline differences

**Served HTML of `<main>`** (home has no page-level `<article>`; scripts, comments, nonces, build hashes and the flight payload stripped). Production 2,333 lines, branch 2,112. One hunk: 221 lines removed, 0 added, 0 changed. The removed hunk is exactly one element, `<section class="px-6 py-4">` through its `</section>`, with this text:

> Worth planning around / Best Promos / The giveaways fans line up early for. / Full rankings / Nov 27, 10:00 PM, Audi 2026 MLS Cup Playoffs, Vancouver Whitecaps FC, Theme Nights, Tickets, 01 / Dec 2, Audi 2026 MLS Cup Playoffs, Vancouver Whitecaps FC, Theme Nights, Tickets, 02 / Dec 2, 2026 Audi MLS Cup Playoffs - Match 3, Chicago Fire FC, Theme Nights, Tickets, 03

Whole-document string counts (flight payload included): "Worth planning around" 2 on production, 0 on branch; "line up early for" 2 and 0; "Full rankings" 2 and 0; `>Best Promos<` 1 and 0; `href="/best-promos"` 2 and 1 (the footer link).

**Pixel comparison, ads blocked.**

| Viewport | Production | Branch | Raw differing px | First differing row | After removing the rail's rows from production | Diff images |
|---|---|---|---|---|---|---|
| 390 | 390x11379 | 390x10929 | 943,393 | 2274 | 31,177 | `2026-11-25-feature-best-promos-stopgap/home/390-diff.png`, `2026-11-25-feature-best-promos-stopgap/home/390-diff-aligned.png` |
| 768 | 768x8173 | 768x7749 | 1,495,484 | 2206 | 95,972 | `2026-11-25-feature-best-promos-stopgap/home/768-diff.png`, `2026-11-25-feature-best-promos-stopgap/home/768-diff-aligned.png` |
| 1280 | 1280x6863 | 1280x6440 | 2,060,503 | 1961 | 80,022 | `2026-11-25-feature-best-promos-stopgap/home/1280-diff.png`, `2026-11-25-feature-best-promos-stopgap/home/1280-diff-aligned.png` |

Nothing differs above the rail (the hero, Tonight and This Week are pixel identical). The raw count is large only because everything below the rail moved up. With the rail's rows cut out of the production image (2255 to 2671 at 390, 2187 to 2577 at 768, 1942 to 2332 at 1280), what remains is: the "Find Your Team" cards (geo order, noise), a one-pixel text rasterisation offset in places (the rail's height is fractional, so content below it sat on a different sub-pixel), and the footer "Events" link. I looked at the aligned diff and the side-by-side crops; no layout difference other than the removal.

**Measurements that moved** (ads blocked):

| Measure | Production | Branch | Why |
|---|---|---|---|
| Document height 390 / 768 / 1280 | 11379 / 8173 / 6863 | 10929 / 7749 / 6440 | rail 416 / 390 / 390, plus footer link 34 |
| Interactive elements (390) | 126 | 115 | 3 cards, 3 Tickets links, 3 stars, "Full rankings", footer "Events" |
| Under 44x44 (390) | 82 | 74 | same elements |
| Contrast failures (390) | 12 | 9, of which 2 are different rows | see below |
| axe serious color-contrast nodes | 8 | 7 | the three rank numerals leave; two team badges enter (geo order) |
| `<a>` to /promos/ in DOM / visible (390) | 50 / 32 | 47 / 29 | the 3 rail cards |
| CLS, ads blocked, 390 / 768 / 1280 | 0.0249 / 0.0007 / 0.0004 | 0.0249 / 0.0007 / 0.0004 | unchanged |

Contrast rows that left with the rail: the ghost rank numerals "01", "02" (1.22:1) and "03" (1.18:1), and the vertical date labels on the stub spines (measured against a background image). Rows that appear only on the branch are team badges in the Find Your Team grid that the geo order happened to put on screen ("NHL" 1.65:1, "NBA" 4.11:1); they are on production too for any visitor who sees those teams.

### Game date check

- **Dates read:** Tonight rail, 8 promos, all "Nov 25" (5:00 PM to 7:30 PM); This Week, Fri Nov 27, Sat Nov 28, Sun Nov 29. The page has no Event JSON-LD (Organization, WebSite, FAQPage only) and no `<time>` elements.
- **Today:** 2026-11-25, America/New_York (the page states no zone). The run ended at 09:15, before the earliest listed start.
- **Verdict:** not a played-game page. Every date is today or later. On production the removed rail's dates were Nov 27 and Dec 2, also future.

### The owner's six checks

**a. No empty shell: YES, none.** On the branch, at all three widths, nothing sits between the This Week section and the category grid. `.page-content` children in order (390, ads blocked, top / height):

| # | Branch | Production |
|---|---|---|
| 1 | `section.px-6.pt-14` Tonight, 764 / 440 | same |
| 2 | `div.mx-auto.max-w-6xl.px-6.pt-8`, no children, 1204 / 32 | same |
| 3 | `section.px-6.py-16` This Week, 1236 / 1019 | same |
| 4 | `section.py-16` By What You Want, 2255 / 869 | `section.px-6.py-4` Best Promos, 2255 / 416 |
| 5 | `section.px-6.py-16` Find Your Team, 3124 / 2112 | `section.py-16` By What You Want, 2671 / 869 |

The category grid's top (2255) equals the This Week section's bottom (1236 + 1019) exactly, so there is no zero-height wrapper and no leftover padding box. The same holds at 768 (This Week ends 2187, grid starts 2187) and 1280 (1942, 1942). With ads on, the only thing between them is the ad slot, as on production. The two childless wrappers that do exist (rows 2 and a 16px one before "Going to the Game?") are on production too; see P3.

**b. No orphaned heading: YES, none.** Visible text search of the rendered body at all three widths: "Worth planning around" 0 hits, "line up early" 0 hits, "Best Promos" 1 hit, which is the footer link. No H2 "Best Promos" (production has one at y=2295 at 390). Zero occurrences in the raw served HTML as well.

**c. No doubled spacing: YES, it reads as one normal section break.** Measured from the bottom of the last This Week card (Spencer Knight Bobblehead) to the top of the "BROWSE" eyebrow of the category grid:

| Gap (content to content, ads blocked) | 390 | 768 | 1280 |
|---|---|---|---|
| Branch: This Week to category grid | 128 | 128 | 128 |
| Branch: category grid to Find Your Team | 128 | 128 | 128 |
| Branch: Built by a fan to FAQ | 128 | 128 | 125 |
| Branch: Going to the Game to Get Reminders | 88 | 88 | 88 |
| Production: This Week to Best Promos | 80 | 80 | 80 |
| Production: Best Promos to category grid | 81 | 81 | 81 |

128 is 64px of bottom padding on This Week plus 64px of top padding on the grid, the same pair every `py-16` neighbour uses. It is identical to the next break down the page, so the join is not a hole. To the H2 itself the distance is 152 (the eyebrow sits between). Screenshots: `2026-11-25-feature-best-promos-stopgap/home/390-branch.png`, `2026-11-25-feature-best-promos-stopgap/home/768-branch.png`, `2026-11-25-feature-best-promos-stopgap/home/1280-branch.png`.

**d. No dead "Full rankings" link: YES, none.** 0 elements with the text "Full rankings" on the branch (production: 1, at y=2363 at 390, to /best-promos). The only link to /best-promos on the branch is the footer's "Best promos" under Discover (y=10318 at 390, 7355 at 768, 6070 at 1280). It answers 200 on the branch and 200 on production, with no redirect.

**e. Ad slots.** Order of sections and ad units with ads on (`*-ads.png`). "C1" is `AdThrive_Content_1`, "BP" is `AdThrive_Below_Post_1`.

| Width | Production | Branch |
|---|---|---|
| 390 | This Week, C1, **Best Promos**, C2, grid, C3, Find Your Team, C4, Going, C5, Reminders, C6, Never Miss, C7, Built, C8, FAQ, C9, BP | This Week, C1, grid, C2, Find Your Team, C3, Going, C4, Reminders, C5, Never Miss, C6, Built, C7, FAQ, C8, BP |
| 768 | This Week, C1, **Best Promos**, grid, C2, Find Your Team, C3, Going, Reminders, C4, Never Miss, Built, C5, FAQ, C6, BP | This Week, C1, grid, C2, Find Your Team, C3, Going, Reminders, C4, Never Miss, Built, C5, FAQ, C6, BP |
| 1280 | This Week, C1, **Best Promos**, grid, C2, Find Your Team, C3, Going, Reminders, C4, Never Miss, Built, C5, FAQ, BP | This Week, C1, grid, C2, Find Your Team, C3, Going, Reminders, Never Miss, C4, Built, FAQ, C5, BP |

- **Around the removed section:** clean at every width. One ad slot sits between This Week and the category grid, where production had one between This Week and the rail. No ad touches another ad there. The slot is 74px above the "BROWSE" eyebrow (10px margin plus the grid's 64px top padding), the same distance every other slot on the page keeps from the heading below it. On production that slot was only 26px above the "Worth planning around" eyebrow, so the branch is the better of the two here.
- **390:** one content ad fewer on the page (8 instead of 9), because one section boundary is gone.
- **768:** same count (6), same positions relative to the sections.
- **1280: one new ad-to-ad adjacency, at the bottom of the page.** The page is 423px shorter, and the vendor's spacing pushed the last two content slots one boundary later: C4 moved from before "Never Miss a Giveaway" to after it, and C5 moved from before the FAQ to after it, where it now sits 10px above the Below Post slot. Read three times on the branch, same order each time. On production at 1280 the Below Post slot stood alone after the FAQ. This stacked pair already exists on production at 390 (C9 then BP) and 768 (C6 then BP); the branch brings it to 1280. See D4.

**f. Reads cleanly top to bottom at 390: YES.** Section order:

- **Branch:** hero (Find the games worth going to) > Tonight > This Week > By What You Want > Find Your Team > Going to the Game? > Get Promo Reminders for Your Teams > Never Miss a Giveaway > Built by a Minnesota Sports Fan > Frequently Asked Questions > footer (Browse, Discover, Company).
- **Production:** the same, with Best Promos between This Week and By What You Want.

Above the fold at 390 a first-time visitor sees the wordmark and menu, the dark hero with the H1, the five-line lede, "See today's promos" (200x44) and "Find your team" (145x46), and the first row of the stats. First scroll: the rest of the stats, "Tonight" with "8 promos at games starting today" and the first ticket-stub card (76ers Cup Games Rally Towel, 5:00 PM), then "This Week" with dated cards. Second scroll: the rest of This Week (Nov 28 and 29), one section break, then "By What You Want" and its six tiles. On production the second scroll instead ran into three MLS playoff fixtures scoring 15 to 18 under the lede "The giveaways fans line up early for."

### Walk (390, branch; production gave the same results)

- Date and time: on every Tonight and This Week card. Venue: not on the homepage cards (team and opponent only), same as production.
- Primary CTA "See today's promos" goes to `/promos/today`, H1 "Sports Promos Today". No external hop.
- Rail card "76ers Cup Games Rally Towel" goes to `/nba/philadelphia-76ers/promos/76ers-cup-games-rally-towel`, H1 "76ers Cup Games Rally Towel". Matches.
- Browser back: scroll 960 before, 960 after. "See all" (This Week) and back: 513 and 513.

### Things that work

1. The section is gone as a unit: one element out of the served HTML, nothing left in the DOM, the flight payload or the visible text.
2. The join between This Week and the category grid is the page's standard 128px break at all three widths.
3. No horizontal overflow (`scrollWidth` = `clientWidth` = 390 / 768 / 1280) and CLS unchanged.

### Defects on the homepage

The diff introduces one, D4. The rest are on production today.

- **D4 (low to medium, 1280 only, introduced by the branch as a side effect).** Two ad slots stacked 10px apart after the FAQ (Content 5 then Below Post), about 510px of consecutive ad space before the footer. On localhost both were unfilled, so it rendered as a blank band. The placement is the ad vendor's, not the template's, and production's fill and spacing can differ from localhost's, so confirm on production after deploy. Screenshot: `2026-11-25-feature-best-promos-stopgap/home/1280-branch-ads.png` (compare `2026-11-25-feature-best-promos-stopgap/home/1280-production-ads.png`).
- **P1 (low, pre-existing, all widths).** Contrast under 4.5:1: wordmark "NIGHT" 4.33:1; "See all" 4.33:1; team league badges in Find Your Team (MLB 3.75 and 2.87, NHL 1.65, NBA 4.11); "Never miss a promo night" eyebrow 4.43:1; "Download for iOS" white on #ef4444 3.76:1. axe: color-contrast, serious, 7 nodes on the branch.
- **P2 (low, pre-existing, 390).** 74 interactive elements under 44x44 (52 in the body): "All tonight's promos" 177x20, card "Tickets" pills 92x26 and 92x23, favourite stars 20x20 and 28x28, "See all" 62x20, league filter pills 59 to 75 by 32, "All venue guides" 146x20, the menu button 40x40, and 20 footer links at 15px tall.
- **P3 (low, pre-existing, all widths).** Two childless wrappers in `.page-content`: `div.mx-auto.max-w-6xl.px-6.pt-8` (32px, between Tonight and This Week) and `div.mx-auto.max-w-6xl.px-6.py-2` (16px, before "Going to the Game?"). They add height and nothing else. Not near the removed section and not touched by the diff.
- **P4 (low, pre-existing, 1280).** Section left edges do not line up: This Week cards start at x=99, the "By What You Want" block at x=68, "Find Your Team" at x=50. Visible in `2026-11-25-feature-best-promos-stopgap/home/1280-branch.png` around y=1900 to 2500.
- **P5 (low, pre-existing).** The Tonight rail carries two cards for the same 76ers game ("76ers Cup Games Rally Towel" and "76ers Cup Games") that both open the same promo page.

---

## 2. `/best-promos`

### Baseline differences

**Served HTML of `<main>`.** Not identical, by design: production is the upcoming list (465 lines), the branch is the retrospective (5,729 lines). Differing regions:

| Region | Production | Branch |
|---|---|---|
| Stamp line | "Last updated November 24, 2026 · 3 promos ranked" | "2026 season record · scores last computed November 24, 2026 · 300 promos ranked" |
| Intro capsule | "The 3 best-scored sports promo nights of 2026 are ranked below from 100 down. ... The list refreshes with each league's weekly scan: MLB year-round, WNBA and MLS in season." | "These are the 300 best-scored promo nights of the 2026 season across MLB, MLS, and WNBA. This list is the season's record, ranked from 100 down, not a list of what is on next. ... An upcoming ranking returns from 45 days before a scored league's next Opening Day, once at least 10 giveaways scoring 65 or more are on the schedule." |
| Date range filter | Next 30 days / Next 90 days / Rest of season | absent |
| Count line | "3 promos match this filter" | "300 promos ranked from past dates" |
| List | 3 cards: Audi 2026 MLS Cup Playoffs (Whitecaps, Nov 27 and Dec 2, score 18), 2026 Audi MLS Cup Playoffs - Match 3 (Chicago Fire, Dec 2, score 15), all Theme Nights | 50 cards, scores 100, 100, then 98s, dated Mar 28 to Aug 19, all bobblehead giveaways; "Show 50 more · 250 remaining" |
| Inline question blocks | none (they sit after cards 15, 30 and 45) | three, after cards 15, 30 and 45 |
| FAQ "How does PromoNight rank promos?" | 6 lines at 390 | rewritten with the point values, 13 lines at 390 |
| FAQ "What makes a promo score 100?" | 4 lines at 390 | rewritten, 11 lines at 390 |
| FAQ "Why are NBA and NHL not included?" | "The scoring layer rolled out ... structured-extraction pipeline ..." | "NBA and NHL promos are not scored yet. PromoNight lists them on the team pages, the league hubs and the daily boards ..." |
| FAQ "Can I see only bobblehead nights?" | "... the same ranking filtered to derivedSignals.itemType equal to "bobblehead" ..." | "... a ranking of bobblehead nights only (derivedSignals.itemType equal to "bobblehead") ..." |
| JSON-LD | ItemList of 3 SportsEvent, startDates 2026-11-27 and 2026-12-02; Article dateModified 2026-11-24 | ItemList of 50 SportsEvent, startDates 2026-03-28 to 2026-08-19; Article dateModified 2026-10-17 |

**Pixel comparison, ads blocked.** The pages are different documents below the hero, so the count says little.

| Viewport | Production | Branch | Differing px | Where | Diff image |
|---|---|---|---|---|---|
| 390 | 390x4599 | 390x21549 | 1,322,496 | stamp line (296 to 322), then everything from 440 | `2026-11-25-feature-best-promos-stopgap/best-promos/390-diff.png` |
| 768 | 768x3217 | 768x17266 | 1,232,706 | stamp line (324 to 333), then everything from 459 | `2026-11-25-feature-best-promos-stopgap/best-promos/768-diff.png` |
| 1280 | 1280x3169 | 1280x17156 | 1,715,525 | stamp line (324 to 333), then everything from 459 | `2026-11-25-feature-best-promos-stopgap/best-promos/1280-diff.png` |

The header, breadcrumb, eyebrow and H1 are pixel identical.

**Measurements that moved:** see the table at the end. All of them follow from 50 cards instead of 3.

### Game date check

- **Dates read (branch):** 50 rendered cards, Mar 28 to Aug 19, 2026 (first card Jul 6, second Aug 19, then Mar 28 onward by date within the 98s). JSON-LD: 50 SportsEvent, `startDate` 2026-03-28 to 2026-08-19.
- **Dates read (production):** Nov 27 and Dec 2, 2026, on the cards and in the JSON-LD.
- **Today:** 2026-11-25, America/New_York.
- **Verdict, branch: every date is before today. This is a page of played games.** Reported first below as D1, as the standing check requires. What it offers for those played games: a "Get tickets" block on every card with a Ticketmaster button and a TicketNetwork button. No parking, hotels or reminder. What it does right for a played list is under "Things that work".
- **Verdict, production:** not played; all three dates are ahead.

### The owner's checks

- **Intro capsule wraps cleanly at 390: YES.** 342x335, 12 lines, no clipping (`scrollWidth` 340 = `clientWidth` 340). 5 lines at 768 and 1280.
- **Stamp line wraps cleanly at 390: YES.** 2 lines, 342x33, breaking after "SCORES LAST COMPUTED". 1 line at 768 and 1280. Production's shorter stamp is also 2 lines at 390.
- **Longer FAQ answers do not overflow: YES.** All seven answers have `scrollWidth` = `clientWidth` (342 at 390, 720 at 768, 768 at 1280). Longest: 13 lines / 296px at 390.
- **Inline question blocks do not overflow or break the card rhythm: YES.** Each has 32px above and 32px below, a rule on top, and stays inside the card column (right edge 366 at 390, the same as the cards).

  | Block | Height at 390 / 768 / 1280 | Card-to-card distance across it at 390 |
  |---|---|---|
  | What gives a promo a perfect 100 score? | 333 / 208 / 179 | 397 |
  | Which teams have the highest-rated promos? | 196 / 140 / 111 | 260 |
  | How are bobbleheads and jerseys ranked? | 219 / 162 / 134 | 283 |

  Cards are 293 to 329px tall at 390 and 12px apart, so the tallest block is about one card's height. It reads as a deliberate pause, not a broken list.
- **No horizontal overflow: YES.** `document.documentElement.scrollWidth` = `clientWidth` on the branch at 390, 768 and 1280; 0 elements with a right edge beyond `clientWidth`.
- **The list is the retrospective: YES.** 300 ranked, 50 shown, all past, no date range filter, "ranked from past dates".
- **No card offers tickets for a game already played: NO. All 50 do.** See D1.

### Walk (390, branch)

- Date and time on each card; venue is not on the card (team and opponent only).
- Card 1 "Monique Currie Bobblehead" goes to `/wnba/washington-mystics/promos/monique-currie-bobblehead`, H1 "Monique Currie Bobblehead". The promo page says "This game has been played" and has no ticket links. Back: scroll 597 and 597.
- Card 5 "Drake Baldwin ROY Bobblehead" goes to its promo page, H1 matches, played state, no ticket links. Back: 1905 and 1905.
- Card 1 "Get Tickets" (Ticketmaster): `www.ticketmaster.com/washington-mystics-tickets/artist/806040`, 200, the club's general ticket page. Bare locally; production wraps it through `ticketmaster.evyy.net`.
- Card 1 "Get Tickets" (TicketNetwork): `ticketnetwork.lusg.net`, 302 to `www.ojrq.net`, returning to `goto.ticketnetwork.com` for the Mystics performer page.

### Things that work

1. The page says what it is, three times before the first card: the stamp ("2026 season record"), the capsule ("the season's record ... not a list of what is on next") and the count line ("ranked from past dates"). The date range filter is gone, so nothing invites a fan to look for "next 30 days".
2. The list finally matches its title. Two 100s and a run of 98 bobbleheads, where production today ranks three playoff fixtures at 18, 18 and 15 under "Best Sports Promo Nights".
3. The new answers agree with the cards beside them. "With a cap of 5,000 or more, the same bobblehead tops out at 98" matches the 40,000-cap Dodgers card at 98, and the 1,500-cap Mystics cards at 100.

### Defects

- **D1 (high, all widths; brought to this page by the branch; already live on production at `/best-promos/bobbleheads`). Every card for a played game offers tickets.** 50 of 50 visible cards carry a "Get tickets" label and two full-width buttons, "ticketmaster Get Tickets" and "TicketNetwork Get Tickets" (308x45 and 308x43 at 390). The first card is a July 6 Mystics bobblehead for a WNBA season that is over. The buttons go to the club's general ticket page, not to that game, but nothing on the card says so, and the card's own promo page says "This game has been played" and offers no tickets. The page ends with the affiliate disclosure, so the page reads as selling seats to finished games. Cause: the list passes `showTickets` to every card whatever the mode (`src/components/scoring/best-promos-browser.tsx`); the diff does not touch that line, but it is what puts `/best-promos` back into the retrospective today. Production's `/best-promos/bobbleheads`, which is already a retrospective, serves the same 50 "Get tickets" blocks today. I found no known-issues entry for it. Screenshots: `2026-11-25-feature-best-promos-stopgap/best-promos/390-branch.png`, `2026-11-25-feature-best-promos-stopgap/best-promos/768-branch.png`, `2026-11-25-feature-best-promos-stopgap/best-promos/1280-branch.png`.
- **D2 (medium, not viewport specific; same origin as D1).** The JSON-LD lists the 50 played games as SportsEvent with `eventStatus` `https://schema.org/EventScheduled` and startDates from March to August 2026. The retrospective ItemList is intentional per the page's comments; the "scheduled" status on games that are over is the problem. Production's `/best-promos/bobbleheads` serves the same today (50 EventScheduled, 2026-03-28 to 2026-08-19).
- **D3 (medium, all widths, introduced by the branch).** Text that no longer fits the page it is on:
  - The inline block "What gives a promo a perfect 100 score?" and the FAQ answer "What makes a promo score 100?" are now the same 110-word paragraph, word for word, twice on one page (y=5970 and y=19110 at 390). Before, they were two different texts.
  - That paragraph opens "A 100 is a bobblehead giveaway (40 plus 30) that the team highlights (15), in limited quantity (10) ...". In the inline position, 15 cards into the list, nothing has yet said the numbers in brackets are points; the explanation is in the FAQ at the bottom.
  - "How often does this list update?" still says "The Last updated date on this page reflects the most recent scoring run." The branch page has no "Last updated" date; the stamp now reads "scores last computed". (Answer unchanged by the diff; the mismatch is new because the stamp changed.)
  - "Can I see only bobblehead nights?" still says that page "shows every scored upcoming bobblehead night". That page is a retrospective today and says "Nothing here is upcoming". Still carries the field name "derivedSignals.itemType", which no fan will understand (the field name is on production too).
- **P6 (low, pre-existing on both, 50 nodes on the branch against 3 on production because of the card count).** The red "Get tickets" label is 3.76:1 (#ef4444 on white, 10px). axe: color-contrast serious, 52 nodes; label-content-name-mismatch serious, 50 nodes (the Ticketmaster button's accessible name "Get tickets on Ticketmaster" does not contain its visible text "ticketmaster Get Tickets").
- **P7 (low, pre-existing, 390).** Under 44x44: "Home" crumb 33x16, "See the bobblehead-only ranking" 323x35, league pills 59 to 75 by 32, the TicketNetwork button 308x43 on every card (one pixel short), plus the header and footer links. 78 on the branch, 35 on production.
- **P8 (low, pre-existing).** Wordmark "NIGHT" 4.33:1 and "See the bobblehead-only ranking" 4.33:1.

---

## 3. `/team-rankings`

### Baseline differences

**Served HTML of `<main>`:** 1,496 lines on each side, 1 line differs, the FAQ answer under "Why are NBA and NHL not on this ranking?".

- Production: "The scoring layer rolled out for MLB, MLS, and WNBA first. NBA and NHL promo data exists in PromoNight but has not yet been processed through the structured-extraction pipeline this ranking depends on. Those leagues will join in a future release."
- Branch: "NBA and NHL promos are not scored yet. PromoNight lists them on the team pages, the league hubs and the daily boards, but this ranking only includes leagues whose promos carry a score, which today is MLB, MLS, and WNBA."

**Pixel comparison, ads blocked:**

| Viewport | Production | Branch | Differing px | Where | Diff image |
|---|---|---|---|---|---|
| 390 | 390x9447 | 390x9413 | 23,726 | the answer (7489 to 7593), then the footer | `2026-11-25-feature-best-promos-stopgap/team-rankings/390-diff.png` |
| 768 | 768x7918 | 768x7862 | 109,561 | the answer (from 6939), one line shorter, so the rest of the FAQ moves up 22px; then the footer | `2026-11-25-feature-best-promos-stopgap/team-rankings/768-diff.png` |
| 1280 | 1280x7802 | 1280x7768 | 52,376 | the answer (6892 to 6928), then the footer | `2026-11-25-feature-best-promos-stopgap/team-rankings/1280-diff.png` |

**Measurements that moved:** document height (34px footer link at 390 and 1280; 56px at 768, of which 22 is the shorter answer) and one interactive element (the footer link). Nothing else.

### Game date check

- **Dates read:** none. The page lists teams, not games. JSON-LD: Article (dateModified 2026-11-24), FAQPage, ItemList of 75 SportsTeam; no Event and no `startDate`. Visible stamp: "Last updated November 24, 2026 · 75 teams ranked".
- **Today:** 2026-11-25, America/New_York.
- **Verdict:** not a played-game page; there is no game date on it to be past.

### Walk (390, branch)

- Row 1 "Texas Rangers" goes to `/mlb/texas-rangers`, H1 "Texas Rangers". Back: 476 and 476.
- Row 20 "Portland Timbers" goes to `/mls/portland-timbers`, H1 "Portland Timbers". Back: 1868 and 1868.
- No primary CTA on this page; the rows are the action.

### Things that work

1. The new answer is plain English. "Structured-extraction pipeline" is gone, and it tells a fan where NBA and NHL promos can be found.
2. It takes the same five lines at 390 (342x114, no clipping) and one line fewer at 768, so nothing around it shifts on a phone.
3. No horizontal overflow at any width; CLS 0.0000 / 0.0018 / 0.0012, identical to production.

### Defects

The diff introduces none.

- **P9 (low, pre-existing, all widths).** Score pills in the lower half of the table are 4.36:1 (the 88, 87, 85, 82, 80, 77, 75, 72, 71 and 70 pills); wordmark 4.33:1. axe: color-contrast serious, 16 nodes, same on production.
- **P10 (low, pre-existing, 390).** Under 44x44 in the body: "Home" crumb 33x16 and the four league pills at 32px tall; plus header and footer links (27 total, 28 on production).

---

## Measurements

Ads blocked unless noted. "P" is production, "B" is the branch.

| Measure | Home P | Home B | /best-promos P | /best-promos B | /team-rankings P | /team-rankings B |
|---|---|---|---|---|---|---|
| Document height, 390 | 11379 | 10929 | 4599 | 21549 | 9447 | 9413 |
| Document height, 768 | 8173 | 7749 | 3217 | 17266 | 7918 | 7862 |
| Document height, 1280 | 6863 | 6440 | 3169 | 17156 | 7802 | 7768 |
| scrollWidth / clientWidth, 390 | 390 / 390 | 390 / 390 | 390 / 390 | 390 / 390 | 390 / 390 | 390 / 390 |
| scrollWidth / clientWidth, 768 | 768 / 768 | 768 / 768 | 768 / 768 | 768 / 768 | 768 / 768 | 768 / 768 |
| scrollWidth / clientWidth, 1280 | 1280 / 1280 | 1280 / 1280 | 1280 / 1280 | 1280 / 1280 | 1280 / 1280 | 1280 / 1280 |
| CLS, 390 / 768 / 1280 | 0.0249 / 0.0007 / 0.0004 | 0.0249 / 0.0007 / 0.0004 | 0.0044 / 0.0015 / 0.0010 | 0.0044 / 0.0015 / 0.0010 | 0.0000 / 0.0018 / 0.0012 | 0.0000 / 0.0018 / 0.0012 |
| CLS with ads on, 390 / 768 / 1280 | 0.0112 / 0.0154 / 0.0304 | 0.0249 / 0.0007 / 0.0004 | not measured | not measured | not measured | not measured |
| Interactive elements, 390 | 126 | 115 | 41 | 179 | 103 | 102 |
| Under 44x44, 390 (body only) | 82 (59) | 74 (52) | 35 (12) | 78 (56) | 28 (5) | 27 (5) |
| Contrast failures (distinct), 390 | 12 | 9 | 3 | 3 | 11 | 11 |
| axe serious or critical | color-contrast 8 | color-contrast 7 | color-contrast 5; label-content-name-mismatch 3 | color-contrast 52; label-content-name-mismatch 50 | color-contrast 16 | color-contrast 16 |
| `<a>` to /promos/, DOM / visible, 390 | 50 / 32 | 47 / 29 | 11 / 9 | 58 / 56 | 8 / 6 | 8 / 6 |
| First ad anchor from top, 390 | 57 (`data-ad-region="content"` on the page root) | 57 | none on the page | none on the page | none on the page | none on the page |
| First ad unit from top, 390, ads on | 2265 (after This Week) | 2265 | not measured | not measured | not measured | not measured |
| Content ad units, 390 / 768 / 1280, ads on | 9 / 6 / 5, plus Below Post | 8 / 6 / 5, plus Below Post | not measured | not measured | not measured | not measured |
| Page errors (console) | 0 | 0 | 0 | 0 | 0 | 0 |

Notes on the table: the CLS figures with ads on differ because production's slots filled (some at 300px) and localhost's did not; that is fill, not layout. The visible /promos/ count is lower than the DOM count because the menu's links are closed. The branch is a `next dev` render, so its CLS is indicative only.

## Recommendation

The homepage change is clean and ready: answer yes on a, b, c, d and f, and on e apart from the stacked pair at the bottom of the 1280 page, which should be looked at on production after deploy. The thing to settle before merging is D1. Flipping `/best-promos` to the retrospective puts 100 "Get Tickets" buttons under 50 games that have been played, on a page whose first line says it is not a list of what is on next. Fix it, or defer it with a known-issues entry that also covers `/best-promos/bobbleheads` (where it is live on production now) and the EventScheduled status in D2, or waive it here with a reason. D3 is copy and can ride with it.

## Disposition (added by the build session, 2026-11-25)

The review ran against `59e728c`. The fixes below are in the commit that carries this report.

- **D1, fixed.** `BestPromosBrowser` passes `showTickets={!retrospective}`, so a retrospective card (a played game) carries no "Get tickets" label and no Ticketmaster or TicketNetwork button. The component is shared, so the same 50 ticket blocks leave `/best-promos/bobbleheads` in its retrospective too. Upcoming mode is unchanged.
- **D2, waived.** The list JSON-LD emits SportsEvent with `eventStatus` EventScheduled and no `offers`. That is the shape the promo page's played state keeps by ruling (2026-11-08: a played game keeps EventScheduled and drops its offers), so the list already matches it.
- **D3, fixed.** The inline "perfect 100" block is now a two-sentence form of the rule (`PERFECT_SCORE_SHORT_ANSWER`) and the full paragraph appears once, in the FAQ. The full answer's first bracket reads "(40 points plus 30)". "How often does this list update?" refers to the date in the line under the page title. "Can I see only bobblehead nights?" no longer promises upcoming rows and no longer prints a field name.
- **D4, deferred to the release preview.** One fewer `.page-content` child moves the last two content slots at 1280, putting Content 5 10px above Below Post after the FAQ. The slots were unfilled on localhost. To be read on the `release/fix-round-2026-11` preview and again after the production deploy; ad layout is the owner's call.
- **P1 to P10.** Pre-existing on production and not touched by this diff. P5 (two Tonight cards for one 76ers game) is the item 3 entity-model work, out of this round.

Screenshots and diff images (33 MB) are not committed. They were moved out of the worktree to the session scratchpad.
