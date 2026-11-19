# UX review: events hub schedule (2026-11-19)

## Run 1, 2026-11-19 08:31 ET: /events/monster-jam (page type: event-hub), baseline mode

- Branch render: http://localhost:3100/events/monster-jam (production build of `feature/events-hub-schedule`, flag on). The local server carries no `promonight-deploy` meta. The worktree is at commit 3b7c57c with six uncommitted modified files, so the build under review is the working tree, not a commit.
- Production render: https://www.getpromonight.com/events/monster-jam, `promonight-deploy` = `dpl_62gDudZPUGcHoPjSGe7RGxESGYdK`.
- Viewports: 390x844 and 1280x800, both environments (768 was not requested for this run and was not rendered).
- Blocked during every render: googletagmanager, adthrive, posthog (both hosts). No partner host was requested. No ticket, parking or partner link was clicked. monsterjam.com and feldentertainment.com were never requested.
- Screenshots: `2026-11-19-events-hub-schedule/events-monster-jam/`.

### 1. Baseline differences (branch against production)

**Served HTML of `<main>`: not identical.** Five differing regions, all inside the stated change list. Everything else in `<main>` is byte-identical.

| Region | Production | Branch |
|---|---|---|
| H1 | Monster Jam 2027 dates and venue guides | Monster Jam 2027 schedule |
| Scope line under the H1 | This page lists Monster Jam stops at venues PromoNight covers. It is not the full tour schedule. Each stop page has ... | This page lists the 20 Monster Jam stops (64 shows) at venues PromoNight covers. It is not the full tour schedule. Each stop page has ... |
| New section `data-find-city` before the first month | absent | H2 "Find your city" and 20 pill links |
| New section `data-hub-questions` after the last month | absent | H2 "Questions", two H3 questions in one card |
| Month sections (4 sections, 22 rows, 44 links) | | byte-identical, section by section |

The computed counts are right: 20 distinct stop URLs on the page, and the "N shows" figures in the month rows sum to 64. The eyebrow above the H1 ("20 stops we cover · 64 shows") agrees.

**Outside `<main>`, one difference that is not in the stated change list:** the document title and description, and the og: and twitter: copies of both.

| | Production | Branch |
|---|---|---|
| title | Monster Jam 2027: Dates, Tickets and Venue Guides \| PromoNight | Monster Jam 2027 Schedule: Dates, Cities and Tickets \| PromoNight |
| description | Monster Jam 2027 stops at venues PromoNight covers, by month: dates, a ticket link for every show, and each venue's bag and transit details. | Monster Jam 2027 schedule at venues PromoNight covers: dates by city and month, with showtimes and tickets on each stop page and each venue's bag and transit details. |

Canonical, og:url, og:type, twitter:card and the BreadcrumbList JSON-LD are unchanged.

**Month sections, rendered.** All 166 elements inside the four month sections have the same position (relative to the first section), size, color, background, font size and weight in both environments, at both widths. The footer's 61 elements likewise.

**Pixel comparison** (segments aligned on their own top edge, since the new blocks move everything below them; there are no ad slots on this page):

| Segment | 390 | 1280 | Diff image |
|---|---|---|---|
| Top of page to the H1 | 0 px differ | 0 px differ | `390-diff.png`, `1280-diff.png` |
| Month sections | 11,499 of 1,102,140 px (1.0%) | 42,068 of 3,591,680 px (1.2%) | same |
| Disclaimer and footer | 9,493 of 536,640 px (1.8%) | 0 px differ | same |
| Unaligned full page | 774,521 of 1,930,500 px | 1,225,889 of 5,288,960 px | not written; meaningless once the page is 969 px (390) and 524 px (1280) taller |

The month and footer pixel differences are on glyph edges. The geometry and styles are identical (above), and the segments sit at different fractional offsets in the two renders (first month top 1323.77 against 746.67 at 390; 978.75 against 723.16 at 1280), which is what changes text antialiasing. The one segment where the fractional offsets agree (footer at 1280) differs by 0 px. This is my reading of the cause, not a separately proven fact; the element-level comparison is the evidence that the month sections are unchanged.

**Measurements that moved:** see the table in section 5. In short: page height, first month position, H1 height, link count, tab stops before the first month row.

### 2. Game date check

- Dates read: the hub has no Event JSON-LD (BreadcrumbList only, same in production) and no `<time>` elements, so the dates come from the month rows. Earliest "Anaheim: Dec 19 to 20, 2026"; latest "Portland: Mar 5 to 7, 2027" and "Dallas: Mar 6, 2027".
- Today: 2026-11-19 in America/New_York (the page states no zone of its own; the earliest stop is in California, also 2026-11-19).
- Verdict: every date is in the future. Not a played page. No showtime rows or Tickets buttons exist on the hub, so the passed-showtime check does not apply here.

### 3. Three things that work

1. **No horizontal overflow, clean H1 wrap.** `documentElement.clientWidth` equals `scrollWidth` at both widths (390/390, 1280/1280), body the same, and no element in `<main>` extends past the viewport. The H1 breaks only between words (each word is one line box): three lines at 390, two at 1280. It is one line shorter than production at both widths.
2. **The city pills are sound tap targets and every one lands.** 20 pills, alphabetical, all exactly 44 px tall, narrowest 115 px, 8 px gap between pills and between rows, no pill wraps onto two lines, the list does not scroll sideways (11 rows at 390, 5 at 1280). All 20 destinations answer 200 and each stop page H1 carries the pill's city ("Minneapolis, Minnesota" goes to "Monster Jam Minneapolis"). Pill text contrast is 16.75:1.
3. **Back navigation restores the scroll position exactly.** Tapped the Minneapolis pill (scrollY 380 at 390, 213 at 1280) and the Dallas month row (3641 and 3297); browser back returned to the same offset, 0 px off, all four times. Heading order is also clean: one H1, seven H2 in `<main>` (Find your city, four months, Questions), two H3 and both inside Questions; the three footer H2 are the same as production.

### 4. Defects

Severity: High = blocks a fan or breaks the page; Medium = a fan loses something they had; Low = polish or consistency.

**New on the branch**

| # | Severity | Viewport | Defect | Screenshot |
|---|---|---|---|---|
| 1 | Medium | 390 | **The first date is pushed off the first screen and most of the way down the second.** The first month heading starts at 1324 px, against 747 px in production: 577 px further down, 1.57 phone screens from the top instead of 0.88. In production a fan sees "December 2026" and "Anaheim: Dec 19 to 20, 2026" at the bottom of the first screen. On the branch the first screen ends two pill rows in and shows no date at all, on a page now titled "schedule". The Find your city block alone is 595 px tall, 70% of a phone screen, and the pills carry no dates. | `390-branch-fold.png`, `390-production-fold.png`, `390-branch.png` |
| 2 | Low | 1280 | Same effect on a laptop: the first month heading moves from 723 px (above the 800 px fold) to 979 px (below it). The fold now shows the hero, the "Find your city" heading and two of the five pill rows. | `1280-branch-fold.png`, `1280-production-fold.png` |
| 3 | Low | 390 | The H1 wraps to "MONSTER JAM / 2027 / SCHEDULE", with "2027" alone on the middle line ("2027 schedule" needs 370 px, the column is 358). No mid-word break and no overflow; it reads as a stray short line. | `390-branch-fold.png` |
| 4 | Low | 390, 1280 | The Questions block does not fully match the stop page's. The card, the rows, the H3 and the answer text have identical markup and computed styles (radius, border, padding, 15 px/600 questions, 14 px answers, divider). The H2 differs: 22 px on the hub, 24 px with a 1.05 line height on the stop page. Each page is consistent with its own other H2s, so the mismatch is between the two templates. | `390-branch-questions.png`, `390-stop-questions.png` |
| 5 | Low | 390, 1280 | Questions copy restates itself. The second answer says the stop page "has what the venue says about bags", then that the venue guide "has what the building publishes about bags, parking and transit"; a fan cannot tell from that which page to open for bags. "Linked above" points at links that are up to 3,000 px above on a phone. The second sentence of the first answer repeats the scope line under the H1. | `390-branch-questions.png` |
| 6 | Low | 390, 1280 | The page's own wording pulls two ways. The H1 says "schedule" and the next sentence says "It is not the full tour schedule". The new title promises "Dates, Cities and Tickets", and this page has no ticket link (they are one tap away on each stop page; the new description says so correctly). | `390-branch-fold.png` |
| 7 | Low | 390, 1280 | The pill outline is faint: a white pill on the cream page (about 1.1:1) with a 10% ink border (about 1.2:1 against the page). The label text passes easily and the shape is still readable in the render, but the edge is well under 3:1. The month cards use the same treatment in production. | `390-branch-find-city.png` |
| 8 | Low | 390, 1280 | Keyboard: the pills add 20 tab stops ahead of the schedule. The first month row is tab stop 24 at 390 (4 in production) and 29 at 1280 (9 in production), and there is no skip link in either environment. The order itself is correct: breadcrumb, then the pills left to right and top to bottom in alphabetical order, then the month rows; no jumps. Every pill shows a visible focus ring (the browser default, blue). | `390-branch-pill-focus.png`, `1280-branch-pill-focus.png` |

**Already in production, unchanged by the branch (listed so the record is complete)**

| # | Severity | Viewport | Defect |
|---|---|---|---|
| 9 | Low | 390, 1280 | axe-core, serious, color-contrast: the red "NIGHT" in the header wordmark is 4.33:1 (#da2d20 on #f7f3ea, 18 px bold). The only serious or critical axe violation in either environment. |
| 10 | Low | 390 | Hit sizes under 44x44: the "Events" breadcrumb link (37x18), the menu button (40x40), the wordmark link (132x17), and 21 footer links (15 to 20 px tall). Identical list in production. Nothing the branch added is under 44 px tall. |
| 11 | Low | 390, 1280 | The H1 says 2027 and the first section is December 2026 (true of the old H1 as well). |
| 12 | Info | 390, 1280 | The hub's dates are plain text: no `<time>` elements and no Event JSON-LD. Neither the hub nor the stop page marks its Questions up as FAQPage. Recorded, not judged. |

No empty or near-empty section. Nothing that looks tappable and is not.

### 5. Measurements

| Measure | Branch 390 | Production 390 | Branch 1280 | Production 1280 |
|---|---|---|---|---|
| HTTP status | 200 | 200 | 200 | 200 |
| clientWidth / scrollWidth | 390 / 390 | 390 / 390 | 1280 / 1280 | 1280 / 1280 |
| Document height | 5919 | 4950 | 4656 | 4132 |
| H1 font size, lines, height | 44 px, 3, 125 px | 44 px, 4, 167 px | 54 px, 2, 103 px | 54 px, 3, 154 px |
| Hero bottom | 671 | 713 | 638 | 689 |
| Find your city block height | 595 | none | 283 | none |
| Pill rows; pill height; gaps | 11; 44; 8 / 8 | none | 5; 44; 8 / 8 | none |
| First month section top | 1324 | 747 | 979 | 723 |
| First month top, in viewport heights | 1.57 | 0.88 | 1.22 | 0.90 |
| Questions block height | 368 | none | 244 | none |
| Interactive elements (visible) | 88 | 68 | 93 | 73 |
| Hit targets under 44x44 | 24 | 24 | 29 | 29 |
| Text contrast failures (under 4.5:1) | 1 (wordmark) | 1 (wordmark) | 1 (wordmark) | 1 (wordmark) |
| axe serious or critical | 1 (color-contrast) | 1 (color-contrast) | 1 (color-contrast) | 1 (color-contrast) |
| Cumulative layout shift | 0.019 | 0.016 | 0.001 | 0.008 |
| `<a>` to /promos/ in DOM / visible | 8 / 6 | 8 / 6 | 8 / 7 | 8 / 7 |
| First ad anchor | none on page | none on page | none on page | none on page |
| Tab stops before first month row | 23 | 3 | 28 | 8 |
| Month row links, smallest height | 44 | 44 | 44 | 44 |

The /promos/ links are header and footer navigation; the page body has none. The single layout shift at 390 is at 51 ms on the branch (hero text block) and is present in production at the same size.

### 6. Walk as a fan (branch, 390)

- Date: not on the first screen (defect 1). First date reached after about one and a half screens of scrolling: "Anaheim: Dec 19 to 20, 2026".
- Venue: named under each row ("Angel Stadium · 2 shows") with a "venue guide" link under it. The pills name the city and state only.
- Primary action: the page has no ticket button. The primary actions are the pill and the month row, both internal, both to the stop page. No redirect hop, host stays the same.
- Pill "Minneapolis, Minnesota" goes to /events/monster-jam/us-bank-stadium, H1 "Monster Jam Minneapolis". Month row "Dallas: Mar 6, 2027" goes to /events/monster-jam/att-stadium, H1 "Monster Jam Dallas".
- Back: scroll restored exactly in all four trials.

### 7. Recommendation

Get a date back onto the first phone screen. The pills work and the month sections are untouched, so the one thing the branch costs a fan is defect 1: a page now called "schedule" that shows no date until a screen and a half down. Whatever form the city block takes at 390, the first month heading should not start lower than it does in production by most of a screen.

## Dispositions (2026-11-19, Phase 5A)

The title and description change the report asks about is intended (the Phase 5A brief, B1 and B2).

| Defect | Disposition |
| --- | --- |
| 1, 2. The city block pushes the first date down (390 and 1280) | Deferred: known-issues 113. The block's place above the month sections and its content (city and state only) are set by the Phase 5A brief; moving it or adding dates is a ruling for Matt. |
| 3. H1 wraps with "2027" alone on a line at 390 | Waived: the H1 text is set by the brief, there is no mid-word break or overflow, and it is one line shorter than production. |
| 4. Questions H2 is 22px on the hub, 24px on the stop page | Waived: the hub's H2s are all 22px (the month headings, unchanged); the block matches its own page. Card, rows, H3 and answers match the stop page. |
| 5. Questions copy restates itself | Fixed in part: the second answer was rewritten after the adversarial review (it now says what a stop page and a venue guide each hold, with the conditions). "Listed above" stays; the definition's second sentence stays, since the answer must stand alone. |
| 6. "schedule" next to "not the full tour schedule"; "Tickets" in the title | Waived: both are the brief's wording. The scope line is what permits the word; ticket links are one tap away on each stop page, as the description says. |
| 7. Pill outline is faint | Waived: the same card treatment as the month cards in production; label text is 16.75:1. |
| 8. Twenty extra tab stops before the first month row | Waived: the block is twenty links by design; focus order and rings are correct. A skip link is a sitewide item, not this branch's. |
| 9 to 12 | Pre-existing in production, unchanged by the branch (11 is the year rule, kept by the brief). |

The adversarial review (one reviewer, same day) found the hub's bag and transit promises too broad and a tombstoned-visit path in the question facts; both were fixed before merge and the page was rebuilt. The screenshots this report cites were taken before those copy fixes and are not committed.
