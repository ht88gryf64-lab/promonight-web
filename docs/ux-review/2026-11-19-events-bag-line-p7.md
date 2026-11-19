# UX review: feature/events-bag-line-p7

Run 2026-11-19 (America/New_York). Baseline mode, one page, one viewport (390x844), by request. Text only; screenshots were kept outside the repo.

- Page: `/events/monster-jam/us-bank-stadium`
- Branch: production build of `feature/events-bag-line-p7` at http://localhost:3100, `EVENTS_PAGES_LIVE` on. The local server carries no `promonight-deploy` meta.
- Production: https://www.getpromonight.com, `promonight-deploy` = `dpl_BezbE2pXD2k3YVFsQJEnZA8BCwDR`.
- Both renders: same desktop Chrome User-Agent, zone America/Chicago, same-origin requests only. Every third-party host was aborted (seen and blocked: googletagmanager, ads.adthrive, posthog). No ticket, parking, partner or venue source link was clicked or requested.

## Baseline differences

**Served HTML outside script tags: one differing text node, the intended one.**

| | Text |
|---|---|
| Production | `U.S. Bank Stadium sets its bag policy per event.` |
| Branch | `Bag policy at U.S. Bank Stadium depends on the event.` |

Same `<p>`, same classes. The only other differing lines in the whole document are the three build-asset URLs in `<head>` (the `?dpl=` suffix and the webpack chunk hash), which are deploy artifacts. The old sentence appears 0 times in the branch HTML, the new one 0 times in production. The three JSON-LD blocks are identical once the origin is normalized.

**The link under the line is unchanged:** text "U.S. Bank Stadium bag policy page", href `https://www.usbankstadium.com/plan-your-visit/safety`, rel `noopener nofollow`, 220.3x44 at x 83, y 1438.8 in both.

**Wrapping at 390.** Two lines in both environments, so nothing moves.

| | Line 1 | Line 2 |
|---|---|---|
| Production | U.S. Bank Stadium sets its bag policy per | event. |
| Branch | Bag policy at U.S. Bank Stadium depends on | the event. |

The branch ends on two words where production ended on one, so the single-word last line is gone. Line 1 on the branch ends at x 358.6 inside a paragraph box whose right edge is 359: it fits with 0.4px to spare. Any wider text rendering (a fallback font, a larger user font size) would push "on" down and leave "on the event." on line 2, still two lines and still no orphan.

**Overflow.** Paragraph clientWidth 276, scrollWidth 276 in both. Every ancestor up to the card has clientWidth equal to scrollWidth. Document clientWidth 390, scrollWidth 390 in both.

**Row height and everything below.** Paragraph 276x40.6 at y 1394.3 in both; bag row 140.1 tall in both; Before you go card 482.1 tall in both. All 243 visible elements have identical x, y, width and height in the two renders. Document height 4050 in both. The shift is zero, which matches the line-wrap difference of zero.

**Heading order.** Identical: 12 headings, same tags, same text, same y (H1 Monster Jam Minneapolis; H2 Pick your show, Your Saturday hour by hour, Before you go, Also at U.S. Bank Stadium, More Monster Jam stops, Questions with two H3s; footer H2 Browse, Discover, Company).

**Layout shift.** 0 in both, during load and after a full scroll pass.

**Pixels.** 2,438 of 1,579,500 pixels differ (0.15%), all inside x 83 to 357, y 1397 to 1429, which is the two text lines of the bag row. Nothing differs outside that box.

## Game date check

- Showtime rows and `<time>`: Sat Feb 20, 2027 5:00 PM and Sun Feb 21, 2027 3:00 PM.
- JSON-LD Event `startDate`: `2027-02-20T17:00:00-06:00` and `2027-02-21T15:00:00-06:00`, both EventScheduled.
- Today in the venue zone (America/Chicago): 2026-11-19.
- Verdict: both shows are upcoming, 93 days out, and the page says "93 days away". Not a played event. Both rows show a Tickets button, which is correct for unstarted shows.

## Things that work

1. The new bag line reads as a plain sentence, wraps cleanly to two lines and keeps the 44px-tall policy link directly under it.
2. Above the fold a first-time visitor gets the event name, the building and city, both dates, and the first showtime with a Tickets button, without scrolling.
3. Tapping the Milwaukee card under "More Monster Jam stops" lands on a page whose H1 is "Monster Jam Milwaukee"; browser back returns to scroll position 1775, exactly where the tap happened.

Fan walk notes: date, time and venue are all in the hero and the first card. The primary CTA is "Tickets" (two rows), pointing at `ticketnetwork.lusg.net` with `rel="noopener noreferrer sponsored"`; it was read from the href only and not followed, by instruction. "Reserve parking" points at `tracking.spothero.com`, also not followed.

## Defects

### New on this branch

None.

### Already in production (identical on the branch, not caused by this change)

| # | Severity | Defect |
|---|---|---|
| P1 | Low | The wordmark's red "NIGHT" (rgb 218,45,32 on the header background) measures 4.33:1, under 4.5:1. It is the page's only serious axe violation (`color-contrast`, 1 node). |
| P2 | Low | 26 of 41 interactive elements are under 44x44 at 390: the menu button (40x40), the two breadcrumb links (18px tall), the "source" link in the hour-by-hour card (33x12), the newsletter link (266x20) and the 20 footer links (15px tall), plus the wordmark link (17px tall). The list is the same in both environments. |
| P3 | Info | The 0.4px of slack on line 1 of the new bag line (see Wrapping). Not a defect today; noted because the wrap point is one sub-pixel from moving. It cannot produce an orphan. |

P3 is listed here for visibility only; it describes the new copy but nothing is broken.

No empty sections, no section restating the one above, and nothing that looks tappable but is not, at 390.

## Measurements (390x844)

| Measurement | Production | Branch |
|---|---|---|
| HTTP status | 200 | 200 |
| Document height | 4050 | 4050 |
| Document clientWidth / scrollWidth | 390 / 390 | 390 / 390 |
| Bag line lines | 2 | 2 |
| Bag line last line | "event." | "the event." |
| Bag line clientWidth / scrollWidth | 276 / 276 | 276 / 276 |
| Bag row height | 140.1 | 140.1 |
| Policy link box | 220.3x44 | 220.3x44 |
| Visible elements, with identical geometry | 243 | 243 (243 identical) |
| Headings | 12 | 12, same order |
| Cumulative layout shift | 0 | 0 |
| Interactive elements under 44x44 | 26 of 41 | 26 of 41, same list |
| Text under 4.5:1 | 1 ("NIGHT", 4.33) | 1 ("NIGHT", 4.33) |
| axe serious or critical | not run | 1 (color-contrast, the wordmark) |
| `<a>` to /promos/ in DOM / visible | 8 / 6 | 8 / 6 |
| Ad anchors inside the article | 0 found | 0 found |
| Pixel difference | baseline | 2,438 px, bag text lines only |

Notes on the table: axe was run on the branch render only. The two hidden /promos/ links are in the closed mobile menu. No `data-ad-region` or `data-ad-item` element was found inside the `<article>` in either render, so there is no first-ad distance to report; the ad host was blocked in both.

Not covered in this run, by scope: 768 and 1280 viewports, the hub and index pages, the venue and team inbound-link samples.

## Recommendation

Merge. The change is exactly the one sentence, it removes the one-word last line that production has, and nothing else on the page moves by a pixel.
