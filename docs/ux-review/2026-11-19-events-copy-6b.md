# UX review: feature/events-copy-6b, event stop pages, 390x844

Run: 2026-11-19 (America/New_York). Baseline mode, one viewport (390x844) by request. Text only, no screenshots in the repo by request; working screenshots stayed in the session scratchpad.

- Branch: production build of `feature/events-copy-6b` at http://localhost:3100, flag on. It carries no `promonight-deploy` meta.
- Production: https://www.getpromonight.com, `promonight-deploy` = `dpl_EYaHyeD7Tk4Kh6WapS6LM5DYJ5Uo`.
- Third-party hosts were blocked on both renders (googletagmanager, adthrive, posthog were requested and aborted), so ad slots did not fill on either side. No ticket, parking, partner or venue source link was clicked or requested.

## 1. /events/monster-jam/nrg-stadium (main subject)

### Baseline differences

Served HTML outside script tags (whole document, and `<main>` alone, with deploy meta, build hashes and nonces stripped): two differing text nodes, nothing else.

| Region | Production | Branch |
|---|---|---|
| Before you go, bag row, scope note | "NRG Stadium prints this for the Feb 6 to 7 shows. It has not published a rule for the other dates on this page." | "NRG Stadium prints this for the Feb 6 to 7 shows." |
| Questions, "What is the bag policy..." answer, last sentence(s) | same two sentences | first sentence only |

- Hero: identical. No "Formerly" string anywhere in the branch HTML or rendered text. The venue line reads "NRG Stadium, Houston, Texas" followed directly by "3 shows between Feb 6 and Feb 13, 2027".
- JSON-LD (BreadcrumbList plus 3 Event): identical.
- Headings: identical, 16 in the same order (H1 Monster Jam Houston; H2 Pick your show, Hour by hour, Before you go, Also at NRG Stadium, More Monster Jam stops, Questions, then the footer H2s).
- Element boxes: 227 visible elements in `<main>` on both, same tags and classes in the same order, zero changes in x or width. Two leaf heights changed: the scope note 61px to 41px (three lines to two) and the FAQ answer 122px to 101px (six lines to five). Everything below each moves up by that amount; document height 5110 to 5070.
- Pixels: zero differing pixels from the top of the page down to the scope note (rows 0 to 2067). Below that the page is the same content shifted up by 20.5px and then 41px; the shift is fractional, so a row-aligned pixel count below the change is not meaningful and the element boxes above are the evidence.
- Interactive elements: same set, same hrefs, same sizes.
- Overflow, layout shift, axe: unchanged (table below).

Both intended changes confirmed. Nothing else differs.

### Game date check

Showtime rows and Event `startDate`: 2027-02-06 17:00 -06:00, 2027-02-07 15:00 -06:00, 2027-02-13 17:00 -06:00. Today at the venue (America/Chicago): 2026-11-19. All three are upcoming; no row with a passed start time shows a Tickets button. Hero reads "79 days away", which matches Feb 6. Verdict: not a played event, check passes.

### Things that work

1. The shorter scope note ends cleanly: one sentence, a period, no stray space or doubled punctuation, and the source line ("nrgpark.com · read Nov 18, 2026 · source") still sits directly under it inside the bag row, above the Transit divider.
2. Above the fold a first-time visitor gets the event, the building and city, the date range, and the first showtime with a Tickets button and its Pit Party strip, without scrolling.
3. Rail card "Milwaukee, Fiserv Forum, 3 shows" lands on H1 "Monster Jam Milwaukee"; browser back restores scroll exactly (2403 before, 2403 after).

Primary CTA "Tickets" points at ticketnetwork.lusg.net (rel sponsored, new tab); "Reserve parking" at tracking.spothero.com. Read from the href only, not followed.

### Defects

1. Low, new on branch. With the second sentence gone, nothing in the bag row or the FAQ answer tells a Feb 13 ticket holder what applies to their date. The row heading still says "NRG Stadium bag rule for this event" while the note scopes it to Feb 6 to 7, and the page lists a third show on Feb 13. The fan now has to infer the gap that production stated outright. This is the intended copy; it is recorded so the tradeoff is on file.
2. Cosmetic, new on branch. The scope note wraps as "NRG Stadium prints this for the Feb 6 to 7" / "shows." leaving a one-word last line.
3. Low, same on production. Hit sizes under 44x44: menu button 40x40; breadcrumb links "Events" 37x18 and "Monster Jam" 70x18; the three inline "source" links 33x12; "Get the week's giveaways in your inbox" 266x20; footer links 15px tall.
4. Low, same on production. One axe serious violation: color-contrast on the header logo "NIGHT", 4.33:1 (#da2d20 on #f7f3ea).

### Measurements

| Measure | Production | Branch |
|---|---|---|
| clientWidth / scrollWidth | 390 / 390 | 390 / 390 |
| Elements past the right or left edge | 0 | 0 |
| Document height | 5110 | 5070 |
| Cumulative layout shift | 0.0005 | 0.0005 |
| axe serious or critical | 1 (logo contrast 4.33:1) | 1 (same) |
| Text under 4.5:1 | logo "NIGHT" | logo "NIGHT" |
| Links to /promos/ in DOM / visible | 8 / 6 | 8 / 6 |
| First ad anchor from top | 57px | 57px |
| Interactive elements under 44x44 | same list | same list |

## 2. /events/monster-jam/fiserv-forum (glance)

- One differing text node in the whole served document outside scripts: bag row line "Fiserv Forum sets its bag policy per event." becomes "Check Fiserv Forum's bag policy before you go."
- The link under it, "Fiserv Forum bag policy page", is unchanged: same text, same href, same size, 20px lower.
- Wrapping: the new line runs to two lines at 390 ("Check Fiserv Forum's bag policy before you" / "go."), where production fit on one. Paragraph height 20px to 41px, document height 4345 to 4365. Cosmetic defect, new on branch: a one-word last line.
- Headings, JSON-LD, element count (190), x and width of every element, overflow (390/390) and layout shift (0.0007 both) are identical. Dates 2027-01-09 and 2027-01-10, all upcoming.

## 3. /events/monster-jam/us-bank-stadium (glance)

- Two differing text nodes in the served document outside scripts:
  - Hour-by-hour card footer: "The showtime is the one on the ticket listing. Pit Party access is not sold through the ticket links on this page." becomes "The showtime is the one on the ticket listing."
  - Questions, "When is the Pit Party..." answer: the closing sentence "Pit Party access is not sold through the ticket links on this page." is removed. This one was not in the list of expected changes for this page; it is the same sentence and reads as the same edit, but confirm it was meant.
- The Pit Party strip reads "Pit Party 12:30 PM to 3:30 PM, per U.S. Bank Stadium." on the branch and is byte-identical on production; it did not change in this diff.
- The card footer looks complete: source line, then one full sentence ending in a period on a single line, with normal padding to the card edge. Not truncated. The strip also ends on its period.
- Headings, JSON-LD, element count (162), x and width of every element, overflow (390/390) and layout shift (0.0005 both) are identical. Document height 4106 to 4050. Dates 2027-02-20 and 2027-02-21, both upcoming.
- Observation, same on production: this page's bag row still reads "U.S. Bank Stadium sets its bag policy per event.", the wording Fiserv Forum just moved away from.

## Recommendation

Merge is clear on layout and regression grounds: the only differences are the stated copy edits plus the one matching FAQ sentence on U.S. Bank Stadium. Before merging, decide defect 1 on the NRG page on purpose: either accept that the Feb 13 show carries no bag guidance, or retitle the row so "for this event" does not sit over a note that covers two of the three dates.

## Dispositions (2026-11-19, Phase 6B)

- The U.S. Bank Stadium Questions answer losing the "Pit Party access is not sold..." sentence is intended (brief A3: where the quote names no pass, the entry is the window and its attribution only).
- Defect 1 (nothing tells a Feb 13 ticket holder which bag rule applies): waived by ruling. The removed sentence asserted an absence no stored fact backs; the row now says only which shows the rule is printed for. The label wording is known-issues 115 (6).
- Defect 2 (one-word last lines): waived, cosmetic.
- Defects 3 and 4: already in production, unchanged.
