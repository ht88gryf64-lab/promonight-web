# ux-review: feature/season-state, 2026-11-25

Run 2026-11-25, 11:19 to 11:50 America/New_York. Baseline mode, branch dev server `http://localhost:3100` against production `https://www.getpromonight.com`.

- Branch: `feature/season-state`, HEAD `749e2a9`, built on `release/fix-round-2026-11`.
- Production deployment: `dpl_7FiidXwyPgvHEdC6pfXk8cpzKRUk` (from `<meta name="promonight-deploy">` on all six pages). The dev server carries no such meta.
- Viewports: 390x844, 768x1024, 1280x800. Ad scripts blocked in both environments for the pixel comparison.
- Screenshots: `2026-11-25-season-state/<slug>/<viewport>-<env>.png`, diff images `<viewport>-diff.png`, above-the-fold shots `<viewport>-<env>-fold.png`.

## Read this first: the branch moved during the run

The dev server renders the working tree, and the working tree changed at 11:25:23 ET, partway through the first capture pass. 18 tracked files are modified and uncommitted on top of `749e2a9` (`git diff -- src | shasum` begins `055ffb4db64a`). Every branch screenshot, HTML fetch and measurement below was retaken after that change and describes the uncommitted tree, not the commit. The tree was checked again at the end of the run and had not moved further.

What the first pass (commit `749e2a9` as served at 11:19) showed and the uncommitted edits removed:

| Page | Seen at 11:19 | Seen after 11:25 |
|---|---|---|
| Giants | Hero tile "162 GAMES" under "Giveaways & Theme Nights 2027" | Tile gone, four tiles |
| Giants | Hero note "42 promotions in the 2027 season, all still to come" | "42 promotions announced so far for the 2027 season" |
| Giants | Patterns: "42 promotional events scheduled across 81 MLB home games in 2027, averaging 0.5 promos per home game. Roughly 37% of home dates at Oracle Park have at least one scheduled promotion." then "42 of those 42 events are still to come." | "The San Francisco Giants have announced 42 promotional events so far for the 2027 season." |
| Giants | FAQ: "have 42 promotional events in the 2027 season" | "have announced 42 promotional events so far for the 2027 season" |
| /mlb | "Open any team for its full 2027 promotional schedule." | "Open any team for its promotional schedule." |
| /mlb | Meta description "Every MLB team's 2027 promo schedule in one place ... refreshed through the season." | "MLB 2027 promo schedules as clubs announce them ..." |
| /about | "84 of the 124 teams there have promotions listed ahead." | "83 of the 124 teams there have promotions listed ahead this season." |

The request for this review quoted the hero note as "all still to come". That text is no longer served. The report has to be regenerated, or at least the tree hash rechecked, if the tree changes again before the commit.

One dev-server artifact: the first plain fetch of `/mlb/minnesota-twins` returned 500 (`__webpack_modules__[moduleId] is not a function`, logged while another route was compiling). The retry and all nine browser loads returned 200. Not a page defect.

## 1. Baseline differences

### Served HTML, main content (deploy meta, hashes, nonces, scripts and flight payload stripped)

| Page | Identical | Differing regions (production text, then branch text) |
|---|---|---|
| /mlb/minnesota-twins | No, 1 region | The Ticketmaster link only: production `ticketmaster.evyy.net/c/...&sharedid=web_team_page_minnesota-twins`, branch bare `www.ticketmaster.com/minnesota-twins-tickets/artist/805972`. Environment noise (the wrap variable is not set locally). Nothing else differs. Control holds. |
| /events/monster-jam | No, 1 region | H1 "Monster Jam 2027 schedule" to "Monster Jam 2026-27 schedule". Title and og:title "Monster Jam 2027 Schedule: Dates, Cities and Tickets" to "Monster Jam 2026-27 Schedule: Dates, Cities and Tickets". Meta description the same swap. |
| /mlb | No, 3 regions | H1 "MLB PROMOTIONS 2026" to "MLB PROMOTIONS 2027". New `<p data-hub-season-note>`: "8 of 30 clubs have published 2027 promotions so far." Team grid intro "Open any team for its full 2026 promotional schedule." to "Open any team for its promotional schedule." Title 2026 to 2027, new meta description, JSON-LD CollectionPage and ItemList names 2026 to 2027. |
| /about | No, 3 regions | `<time>` 2026-10-16 "Last reviewed October 16, 2026" to 2026-11-25 "Last reviewed November 25, 2026" (JSON-LD dateModified moves with it). Scanner sentence "with 27 of the 32 clubs checked automatically, and NBA followed at the end of that month, with 20 of the 30 teams checked automatically" to "and NBA followed at the end of that month. 29 of the 32 NHL clubs and 28 of the 30 NBA teams are checked automatically." Coverage sentence "MLB, MLS and WNBA carry a full season, and NHL and NBA teams are posting theirs now. Most of the NFL is still waiting on team announcements." to "NBA, NFL, NHL and MLS are in season: 83 of the 124 teams there have promotions listed ahead this season. MLB and WNBA have finished their season, and their team pages carry the record of it. 8 clubs there have already published promotions for next season." |
| /cfb/rivalries/florida-georgia | No, 4 regions | Lede "Florida vs Georgia is Saturday, October 31, 2026. Kickoff 3:30 PM ET at Mercedes-Benz Stadium in Atlanta. Tickets, parking and hotels for the trip." to "Florida vs Georgia was played Saturday, October 31, 2026 at Mercedes-Benz Stadium in Atlanta. The rivalry, the trophy and the stadium." Fact card "3:30 PM ET" to "This game has been played" (`data-matchup-played`). The whole "Plan the trip" section removed (Find tickets, Find hotels, Reserve parking, Gameday guide). The affiliate disclosure paragraph removed. Meta description follows the lede. JSON-LD: BroadcastEvent (ABC) removed, SportsEvent startDate unchanged. |
| /mlb/san-francisco-giants | No, 28 regions | Title, og:title and WebPage name 2026 to 2027. Subhead "Giveaways & Theme Nights 2026" to "2027". "162 Games" tile removed. New hero note "42 promotions announced so far for the 2027 season". New label "Still to come" above the filter chips. H2 "UPCOMING PROMOS" to "2027 SEASON PROMOS". "42 upcoming events · full schedule below" to "42 events announced so far for the 2027 season · full schedule below". "114 completed events this season" to "114 completed events, March 2026 to September 2026" ("COMPLETED 2026 PROMOS" kept). Patterns block: three sentences reworded, "remaining" and "of what is left" dropped. Three H2 questions 2026 to 2027, each answer now "... for the 2027 season ..., N still to come" plus a new "Still to come:" line. "the same 2026 calendar" to "the same 2027 calendar". FAQ 1 "How many Giants promotional nights are still to come?" to "How many promotional nights do the Giants have in the 2027 season?", answer reworded. FAQ 3 and FAQ 9 reworded. Ticketmaster link unwrapped (environment noise). |

### Expected from earlier branches

- Header on all six pages: an "Events" link in the desktop nav from 860px and in the mobile sheet (2 regions, 6 lines). This is the only cause of the 1280 pixel band at y 22 to 32 on every page.
- Rivalry H1 carrying the pairing shows on destinations reached from the Florida vs Georgia page (branch "Alabama vs Auburn : IRON BOWL 2026", production "IRON BOWL 2026"). The Florida vs Georgia H1 itself is the same in both.
- Hub rails and the homepage rail floor do not appear on any of these six pages today (/mlb has no promo this week).
- Unwrapped Ticketmaster links on the two team pages: local environment, as in earlier reports.

### Pixel comparison (ads blocked)

| Page | 390 | 768 | 1280 | Where |
|---|---|---|---|---|
| mlb-twins | 0 px | 0 px | 658 px (0.01%) | 1280: header Events link only |
| events-monster-jam | 987 px (0.04%) | 985 px (0.03%) | 2,177 px (0.04%) | The H1 line only (y 449 to 480 at 390), plus header at 1280. Same page height. |
| mlb | 305,837 px (9.33%) | 344,774 px (9.84%) | 399,787 px (7.90%) | H1 year, the new note line, then everything below shifted down 32 px |
| about | 213,194 px (6.50%) | 217,471 px (5.61%) | 243,320 px (3.78%) | Byline date, the scanner paragraph (y 2906 to 3089 at 390), then the coverage paragraph and everything below shifted 49 px (390) or 24 px |
| cfb-florida-georgia | 421,442 px (36.77%) | 667,659 px (40.97%) | 1,234,708 px (45.98%) | Lede (y 189 to 249), the kickoff line (y 328 to 342), then everything from y 538: trip section gone, page 610 px shorter at 390 |
| mlb-giants | 614,765 px (10.20%) | 741,797 px (8.26%) | 1,103,574 px (9.25%) | From the subhead down: the hero is 80 px shorter at 390 (one tile fewer, one note more), every later block shifts |

Diff images: `2026-11-25-season-state/<slug>/{390,768,1280}-diff.png`.

### Measurements that moved

| Page | Measurement | Production | Branch |
|---|---|---|---|
| Giants | Document height 390 / 768 / 1280 | 15308 / 11606 / 9129 | 15457 / 11690 / 9324 |
| Giants | First ad anchor (content region) from top, 390 | 674 | 594 |
| Giants | Second ad anchor (promo list) from top, 390 | 4102 | 4079 |
| /mlb | Document height 390 / 768 / 1280 | 8375 / 4532 / 3923 | 8406 / 4564 / 3955 |
| /mlb | First hub-section ad anchor, 390 | 639 | 671 |
| Florida vs Georgia | Document height 390 / 768 / 1280 | 2939 / 2122 / 2098 | 2329 / 1604 / 1523 |
| Florida vs Georgia | Interactive elements, 390 | 38 | 34 |
| Florida vs Georgia | Contrast failures, 390 | 11 | 10 ("Plan the trip" heading gone) |
| Florida vs Georgia | Third rivalry-section anchor, 390 | 1055 | 816 |
| /about | Document height 390 / 768 / 1280 | 8364 / 5028 / 5004 | 8413 / 5052 / 5028 |
| Monster Jam | CLS at 390 | 0.0190 | 0.0004 (load noise, the markup is the same) |

Nothing else moved. Twins is identical on every measurement.

## 2. Game date check

Today is 2026-11-25 in America/New_York (and in the venue zones involved).

| Page | Dates read | Verdict |
|---|---|---|
| /cfb/rivalries/florida-georgia | Game line "Oct 31, Saturday"; lede "Saturday, October 31, 2026"; JSON-LD SportsEvent startDate `2026-10-31T15:30:00-04:00` | **Played game. Every date is before today.** Production still presents it as upcoming and sells it. Branch shows a played state. See defect 1. |
| /mlb/san-francisco-giants | 20 Event startDates, 2027-03-25 through 2027-05-15; first card Mar 25 | All ahead. The 2026 cards sit under "COMPLETED 2026 PROMOS" with a COMPLETED badge and no ticket button. |
| /mlb/minnesota-twins | No Event in JSON-LD; no upcoming list | No game presented as upcoming. Everything is under "2026 SEASON PROMOS" (eyebrow "The full season") and "COMPLETED 2026 PROMOS". |
| /mlb | No Event; "No MLB promos today" | Nothing dated. |
| /events/monster-jam | First stop "Anaheim: Dec 19 to 20, 2026"; no Event JSON-LD on the hub | All ahead. |
| /about | `<time datetime="2026-11-25">` | Not a game page. |

## 3. Three things that work

1. **The played state on Florida vs Georgia (branch).** The lede says "was played", the fact card says "This game has been played" in white semibold 14px directly under "Oct 31", and no ticket, hotel or parking link remains anywhere in the page body (0 found, production has 3). The BroadcastEvent is gone from the JSON-LD. No orphaned heading and no hole: "The trophy" follows the school cards with the same 32px rhythm as before, and the gap from the last row to the footer is 64px at 390 and 120px at 768. `2026-11-25-season-state/cfb-florida-georgia/390-branch.png`
2. **The control holds.** Twins is pixel-identical to production at 390 and 768 (0 px), differs by the header Events link alone at 1280, and its served main content differs by one environment-only link. It keeps "Promos & Giveaways 2026", "145 promotions in the 2026 season", the 162 Games tile and "145 completed events this season". `2026-11-25-season-state/mlb-twins/390-diff.png`
3. **The new lines fit and nothing overflows.** The /mlb hero note is one line at all three widths (342px wide at 390, 13px, white at 70% on #1d1714, about 8.9:1), 12px under "Rechecked weekly" and 32px above the stat number, so it reads as part of the intro and not as a stat. The /about coverage item is 10 lines at 390 and 5 at 768 and 1280 with no awkward break. `scrollWidth` equals `clientWidth` on all 36 renders (390/390, 768/768, 1280/1280) and no element extends past the viewport. Browser back restored the scroll position exactly (0px off) on all 11 taps walked. Monster Jam reads "2026-27" on the hub H1, the hub title and the stop title reached from it ("Monster Jam Anaheim 2026-27: Dates and Tickets").

## 4. Defects

Severity: High = a fan is misled or sold something wrong. Medium = a fan is slowed, confused or sent to a dead end. Low = wording or polish.

| # | Severity | Page | Viewport | New on branch | What a fan sees | Screenshot |
|---|---|---|---|---|---|---|
| 1 | High on production, resolved on branch | /cfb/rivalries/florida-georgia | all | No (fixed) | Game date check record. The game was played 25 days ago. **Production**: "Florida vs Georgia is Saturday, October 31, 2026. Kickoff 3:30 PM ET", a "Plan the trip" section with Find tickets (ticketnetwork.lusg.net), Find hotels (expedia.com), Reserve parking (tracking.spothero.com), and a live-broadcast claim in the JSON-LD. **Branch**: played line, past-tense lede, no tickets, no hotels, no parking, no reminder. Until this ships, production keeps selling a finished game. | `cfb-florida-georgia/390-production.png`, `cfb-florida-georgia/390-branch.png` |
| 2 | Medium | /cfb/rivalries/florida-georgia | all | Yes | The lede ends "The rivalry, the trophy and the stadium." The page has nothing about the stadium beyond its name and city in the fact card, and the only link to the stadium guide ("Gameday guide" to `/venues/mercedes-benz-stadium`) left with the trip section. "Mercedes-Benz Stadium" in the card is plain text. The promise in the first paragraph is not kept. | `cfb-florida-georgia/390-branch.png` |
| 3 | Medium | /mlb | all | Yes | The H1 says "MLB PROMOTIONS 2027" and the note says 8 of 30 clubs have published, but nothing says which 8. All 30 team cards carry the same label, "Promotional schedule". A fan who taps Twins from the 2027 hub lands on a page titled 2026 with no upcoming promo. Finding the 8 means opening cards blind. | `mlb/390-branch.png` |
| 4 | Medium | /mlb/san-francisco-giants | all | No, but the 2027 label makes it worse | Directly under "Giveaways & Theme Nights 2027" and the "STILL TO COME" label, the calendar opens on November 2026 and is empty. The first promo is March 25, 2027: four taps on a 36x36 "Next month" button, through three more empty months. | `mlb-giants/390-branch-fold.png`, `mlb-giants/390-branch.png` |
| 5 | Low | /mlb/san-francisco-giants | all | Yes | The same count is stated twice in one sentence, five times: "11 giveaway nights scheduled for the 2027 season at Oracle Park, 11 still to come"; "28 theme nights ... during the 2027 season, 28 still to come"; "3 kids and family events ... in the 2027 season, 3 still to come"; "announced 42 promotional events so far ... 42 are still to come"; "holds 42 events, 42 of them still to come". Each of the first three is then followed by a line that says "Still to come:" again. | `mlb-giants/390-branch.png` (y 10545 to 12000, y 12192, y 13782) |
| 6 | Low | /mlb/san-francisco-giants | all | Yes | Mixed certainty about the same 42 events. The hero, the list line, the patterns block and FAQ 1 say "announced so far". The three question blocks say the Giants "have 11 giveaway nights scheduled for the 2027 season", and FAQ 9 says "The 2027 schedule on this page holds 42 events", which read as season totals. | `mlb-giants/390-branch.png` |
| 7 | Low | /mlb/san-francisco-giants | 390 | Yes | The count line under "2027 SEASON PROMOS" wraps to two lines and breaks as "42 events announced so far for the 2027 season · full" / "schedule below". At 768 and 1280 it is one line. At every width "announced so far" and "full schedule" sit in the same line and pull against each other, and what follows is a partial list behind a "Show all 42 upcoming promos" toggle, not a schedule. | `mlb-giants/390-branch.png` (y 4023) |
| 8 | Low | /mlb/san-francisco-giants | 390, 768 | Yes | The new "STILL TO COME" label starts at the hero's bottom edge (0px between the two boxes at 390 and 768, 16px at 1280), with 24px below it to the chips. It looks attached to the hero's rounded corner, not to the chips it labels. | `mlb-giants/390-branch-fold.png` |
| 9 | Low | /mlb/san-francisco-giants | all | No | "Every NL West rival the Giants face this season" on a page now labelled 2027. The rival pages it links to are 2026 pages (Dodgers: "Giveaways & Theme Nights 2026", "101 promotions in the 2026 season"). "This season" no longer says which. | `mlb-giants/390-branch.png` (y 8046) |
| 10 | Low | /mlb/san-francisco-giants | all | No (same on production) | "COMPLETED 2026 PROMOS, 114 completed events" and the link "All 114 past promos" lead to a page that opens "102 promotions already played, newest first." 114 on the label, 102 at the destination. | `mlb-giants/390-branch.png` (y 6735) |
| 11 | Low | /cfb/rivalries/florida-georgia | all | Partly | The page says the game was played and stops there: no score, no winner, nothing about the next meeting. Within the first screen at 390 the fan is told three times that it was played (lede, fact card, and "The Florida vs Georgia rivalry, known as Okefenokee Oar, was played on Saturday, October 31."). That third sentence is on production too and calls the rivalry by the trophy's name. | `cfb-florida-georgia/390-branch.png` |
| 12 | Low | /cfb/rivalries/florida-georgia | all | No (same on production) | "More rivalries" lists "Red River Rivalry, Oct 10" in the same style as "Iron Bowl, Nov 28" and "Egg Bowl, Nov 27", with no year and no played mark. A past date reads as an upcoming one. The destination on the branch does say it was played. Rows are 43px tall, 1px under the tap minimum. | `cfb-florida-georgia/390-branch.png` (y 816) |
| 13 | Low | /about | all | Yes | "8 clubs there have already published promotions for next season" covers MLB and WNBA together and does not say which league; "teams there" and "clubs there" in consecutive sentences read stiffly. The number agrees with the /mlb note (8 of 30). | `about/390-branch.png` (y 3709) |
| 14 | Low | /mlb | all | No (same on production) | FAQ answer: "The this-week rail on this page lists the promotions scheduled at MLB ballparks over the next seven days." There is no such rail on the page in the offseason, only "No MLB promos today". Under a 2027 H1 the answer points at something the fan cannot find. | `mlb/390-branch.png` (y 6009) |

Carried measurement failures, identical on production and branch, none introduced by this branch: the "NIGHT" wordmark at 4.33:1 on every page; on Florida vs Georgia nine grey texts between 2.12:1 and 4.49:1 (breadcrumb, "vs", section headings, source line); on /about 23 red links at 4.33:1 and "Download for iOS" at 3.76:1; on the Giants page the Expedia arrow at 2.72:1 and the guide chevron at 3.14:1. Tap targets under 44px at 390: Giants ticket buttons 92x27 (42), calendar days 41x41 (30), share buttons 32x32, filter chips 34px tall, calendar arrows 36x36, source links 50x12; /mlb division chips 34px tall, "See all today's promos" 152x20, ballpark guide rows 342x41; Florida vs Georgia breadcrumb links 14px tall, school links 24px tall; /about inline links 16px tall. axe serious: `color-contrast` and `label-content-name-mismatch` (2 on team pages, 60 on /mlb), `link-in-text-block` (17 on /about).

## 5. Fan walk (390)

| Page | Step | Result |
|---|---|---|
| Giants | Date and venue | First date "MAR 25 THU, Opening Day, vs Rockies" at y 4100, three screens below an empty calendar. Venue "Oracle Park" in the hero. |
| Giants | Primary CTA "ticketmaster Get Tickets" (342x60) | Branch: `www.ticketmaster.com` direct, 200. Production: `ticketmaster.evyy.net`, 301 to `www.ticketmaster.com`. |
| Giants | Rail card "Los Angeles Dodgers" | `/mlb/los-angeles-dodgers`, H1 "LOS ANGELES DODGERS". Matches. Back: 8134 to 8134. |
| Giants | "All 114 past promos" | `/mlb/san-francisco-giants/promos/past`, H1 "SAN FRANCISCO GIANTS PAST PROMOS AND GIVEAWAYS", "102 promotions already played". Back: 7485 to 7485. |
| Twins | Primary CTA | Same Ticketmaster pattern as Giants. Title, subhead and list headings all 2026 in both environments. |
| /mlb | Team card "San Francisco Giants" | H1 "SAN FRANCISCO GIANTS", "Giveaways & Theme Nights 2027". Back: 3667 to 3667. |
| /mlb | Team card "Minnesota Twins" | H1 "MINNESOTA TWINS", title 2026, "2026 SEASON PROMOS". Back: 1902 to 1902. |
| /mlb | "Bobblehead giveaways" | `/promos/bobbleheads`, H1 "UPCOMING BOBBLEHEADS". Back: 452 to 452. |
| Monster Jam | First stop "Anaheim" | `/events/monster-jam/angel-stadium`, H1 "MONSTER JAM ANAHEIM", title "Monster Jam Anaheim 2026-27: Dates and Tickets". Back restored. City pills 44px tall. |
| Florida vs Georgia | Date, venue | "Oct 31 Saturday", "This game has been played", "Mercedes-Benz Stadium, Atlanta, Georgia", all above the fold. No CTA in the page body, by design. |
| Florida vs Georgia | "Iron Bowl" | `/cfb/rivalries/iron-bowl`, H1 "Alabama vs Auburn : IRON BOWL 2026". Back: 447 to 447. |
| Florida vs Georgia | "Red River Rivalry" | H1 "Oklahoma vs Texas : RED RIVER RIVALRY 2026", "was played Saturday, October 10, 2026", 0 ticket links on branch (production destination still has 1). Back: 447 to 447. |
| /about | "Browse every team" | `/teams`, H1 "FIND YOUR TEAM". Back: 3518 to 3518. |

## 6. Measurements

Values at 390 unless marked. P = production, B = branch.

| Measure | Giants P | Giants B | Twins P | Twins B | /mlb P | /mlb B | Monster Jam P | Monster Jam B | FL-GA P | FL-GA B | /about P | /about B |
|---|---|---|---|---|---|---|---|---|---|---|---|---|
| scrollWidth / clientWidth, 390 | 390/390 | 390/390 | 390/390 | 390/390 | 390/390 | 390/390 | 390/390 | 390/390 | 390/390 | 390/390 | 390/390 | 390/390 |
| scrollWidth / clientWidth, 768 | 768/768 | 768/768 | 768/768 | 768/768 | 768/768 | 768/768 | 768/768 | 768/768 | 768/768 | 768/768 | 768/768 | 768/768 |
| scrollWidth / clientWidth, 1280 | 1280/1280 | 1280/1280 | 1280/1280 | 1280/1280 | 1280/1280 | 1280/1280 | 1280/1280 | 1280/1280 | 1280/1280 | 1280/1280 | 1280/1280 | 1280/1280 |
| Document height | 15308 | 15457 | 14751 | 14751 | 8375 | 8406 | 5713 | 5713 | 2939 | 2329 | 8364 | 8413 |
| CLS 390 | 0.0000 | 0.0000 | 0.0000 | 0.0000 | 0.0261 | 0.0256 | 0.0190 | 0.0004 | 0.0000 | 0.0000 | 0.0000 | 0.0000 |
| CLS 768 | 0.0000 | 0.0000 | 0.0000 | 0.0000 | 0.0419 | 0.0414 | 0.0012 | 0.0012 | 0.0002 | 0.0002 | 0.0003 | 0.0003 |
| CLS 1280 | 0.0000 | 0.0000 | 0.0000 | 0.0000 | 0.0003 | 0.0004 | 0.0424 | 0.0439 | 0.0001 | 0.0002 | 0.0002 | 0.0002 |
| Interactive elements | 233 | 233 | 315 | 315 | 95 | 95 | 91 | 91 | 38 | 34 | 48 | 48 |
| Under 44x44, all / outside header and footer | 163 / 140 | 163 / 140 | 120 / 97 | 120 / 97 | 60 / 37 | 60 / 37 | 27 / 3 | 27 / 3 | 32 / 7 | 32 / 7 | 46 / 23 | 46 / 23 |
| Contrast under 4.5:1 (distinct texts) | 3 | 3 | 5 | 5 | 2 | 2 | 1 | 1 | 11 | 10 | 25 | 25 |
| axe serious or critical (rule: nodes) | contrast 1, label-mismatch 2 | same | contrast 1, label-mismatch 2 | same | contrast 2, label-mismatch 60 | same | contrast 1 | same | contrast 10 | contrast 9 | contrast 25, link-in-text 17 | same |
| `<a>` to /promos/ in DOM / visible | 64 / 62 | 64 / 62 | 20 / 18 | 20 / 18 | 13 / 11 | 13 / 11 | 8 / 6 | 8 / 6 | 8 / 6 | 8 / 6 | 14 / 12 | 14 / 12 |
| First ad anchor from top | 674 | 594 | 706 | 706 | 57 (region), 639 (first section) | 57, 671 | none | none | 57 (region), 269 | 57, 269 | none | none |
| Page errors | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 |

Focus measurements on the new elements (branch):

| Element | 390 | 768 | 1280 |
|---|---|---|---|
| /mlb hero note | 1 line, 13px, y 370, 12px below the line above, 32px above the stat number | 1 line | 1 line |
| /mlb H1 "MLB PROMOTIONS 2027" | 3 lines, 36px | 2 lines, 60px | 2 lines |
| Giants hero note | 1 line, 13px | 1 line | 1 line |
| Giants "2027 SEASON PROMOS" H2 | 2 lines, 30px | 1 line | 1 line |
| Giants count line | 2 lines, 12px, 4.52:1 | 1 line | 1 line |
| Giants "COMPLETED 2026 PROMOS" line | 1 line: "114 completed events, March 2026 to September 2026" | 1 line | 1 line |
| Florida vs Georgia played line | 1 line, 14px, weight 600, white, y 324 (above the fold) | 1 line, y 315 | 1 line |
| Florida vs Georgia lede | 3 lines | 2 lines | 2 lines |
| /about coverage item | 10 lines, 244px tall | 5 lines | 5 lines |
| /about scanner item | 14 lines | 6 lines | 6 lines |
| Monster Jam H1 | 3 lines ("MONSTER JAM / 2026-27 / SCHEDULE"), same height as production | same | same |

## 7. Recommendation

On /mlb, show which 8 clubs have 2027 promotions, on the cards themselves. The hub now leads with 2027 and the count, and the grid under it gives a fan no way to act on either: 30 identical cards, 22 of which open a finished 2026 page. Everything else in the list is wording.

## 8. Disposition (added by the build session, 2026-11-25)

The review ran against the working tree after the adversarial reviewer's fixes. Each defect is fixed, deferred with a line in known-issues 129, or waived with a reason.

| # | Disposition |
|---|---|
| 1 | Fixed by this branch (the played state). Production keeps the old page until the final-gate deploy. |
| 2 | Fixed. A played page keeps one internal "Stadium guide" link in the fact card; render test added. |
| 3 | Deferred, known-issues 129 (hub does not say which clubs have published). Offered to the owner as a decision at the gate. |
| 4 | Deferred, known-issues 129 (calendar opens on the current month). |
| 5 | Deferred, known-issues 129 (repeated counts on an early page). |
| 6 | Deferred, known-issues 129 (mixed certainty in the question blocks). |
| 7 | Fixed. The early count line no longer carries "full schedule below". |
| 8 | Deferred, known-issues 129 (label spacing). |
| 9 | Deferred, known-issues 129. |
| 10 | Deferred, known-issues 129. On production too. |
| 11 | Deferred, known-issues 129. The page has no result data; the trophy sentence is on production too. |
| 12 | Deferred, known-issues 129. |
| 13 | Fixed. The sentence now names the leagues: "83 of their 124 teams" and "8 MLB and WNBA clubs". |
| 14 | Deferred, known-issues 129. On production too. |

Screenshots stay local and are not committed, as with earlier reports.
