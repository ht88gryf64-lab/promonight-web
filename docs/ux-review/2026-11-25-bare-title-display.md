# UX review: feature/bare-title-display

Run: 2026-11-25 (America/New_York). Branch `feature/bare-title-display`, tip `aaeee3a` (change commit `f3b2044`).

**Target: a LOCAL PRODUCTION BUILD of the branch** (`next build` + `next start`) at `http://localhost:3100`, started by the launching session. It carries no `promonight-deploy` meta, so the build cannot be tied to a commit from the served HTML; the prefixed titles are present in the served bytes, which is the only evidence that the build is this branch. **Not baseline mode.** No request went to production or to any outside host: every non-localhost request was aborted in the browser (four hosts asked for and blocked on every page: the tag manager, the ad loader and two analytics hosts) and DNS for everything but localhost was disabled. Affiliate hrefs were read, never followed. Because nothing was compared with production, nothing below can be labelled "regressed" by measurement; where a finding predates this change by its nature, it says so.

Screenshots: `2026-11-25-bare-title-display/<page>/<viewport>-branch.png` (full page) and `-fold.png`, plus the named crops referenced below.

## Verdict

The change does what it says and breaks nothing visually. Every card and H1 in scope shows the prefixed title ("Kraken Bobblehead", "Canadiens Bobblehead Night", "Kings Rally Towel", also "Kings Mini Tote Bag"). No title is cut mid-word, none loses a word to an ellipsis, none is doubled, no card still shows a bare item title, no page overflows horizontally at any viewport, and there are no page errors or hydration errors. The page `<title>` is unchanged.

What it leaves behind is a naming split: the same giveaway now has two names on one page. The Canadiens page prints "Canadiens Bobblehead Night" on the row and "Bobblehead Night" in the prose two scrolls down, in the game detail and in the share label; the Kraken promo page prints "KRAKEN BOBBLEHEAD" as the H1 and "Bobblehead" in five other places, one of which ("Which games is Bobblehead on?") reads as broken English. On the two team pages the prefix is redundant.

## Game date check

Page: `/nhl/seattle-kraken/promos/bobblehead`. Game lines: "Sunday, Jan 31, 2027 · 1:00 PM PT" (`2027-01-31T13:00:00-08:00`) and "Sunday, Mar 21, 2027 · 5:00 PM PT" (`2027-03-21T17:00:00-07:00`). JSON-LD Event `startDate`: `2027-01-31` and `2027-03-21`. Today in the building's zone (Pacific, stated on the page): 2026-11-25. **Verdict: both dates are ahead; not a played game.** The day tile says "IN 67 DAYS", which is correct for Jan 31. The page offers Get Tickets, Also on Ticketmaster, Stream on Fubo, Parking, Hotels, Remind me and Share, all appropriate for an upcoming game.

Also read on the pages reached by tapping: `/nhl/montreal-canadiens/promos/bobblehead-night` (Event dates 2026-12-10, 2027-01-21, 2027-03-16, 2027-03-24, all ahead) and `/nhl/los-angeles-kings/promos/rally-towel` (Jan 2, 2027, ahead).

## Three things that work

1. **The rail sizing holds.** On the homepage Best Promos rail "Kraken Bobblehead" renders at the default 27px on two lines ("Kraken" / "Bobblehead") at 390, 768 and 1280, inside the same 81px title slot as its neighbours. The neighbours step down as designed: "Cutter Gauthier Bobblehead Giveaway" and "Evgeni Malkin Talking Bobblehead" at 24px, "Native American Heritage Night Hat" (Tonight rail) at 22px. No title in either rail exceeds three lines or its clamp.
2. **Card label and destination agree, and back works.** Tapping the "Kraken Bobblehead" card on the homepage and on `/best-promos`, the "Canadiens Bobblehead Night" row on the Canadiens page and the "Kings Rally Towel" row on the Kings page each lands on a page whose H1 is the same words in uppercase. Browser back restored the vertical scroll position exactly (delta 0px) in all four cases.
3. **The game date check ran and the promo page is in its upcoming state** (above). The served `<title>` is "Bobblehead | Seattle Kraken 2026-27 | PromoNight", as expected and unchanged; og:title is the same string; the JSON-LD Event name is "Bobblehead".

## Defects

Numbered by what a fan trips on first. "Predates the change" means the behaviour is not something this diff could have introduced; it is listed because it was seen on a page under review.

1. **Medium. `/nhl/montreal-canadiens`, 390. One giveaway, two names on one page.** The upcoming rows read "Canadiens Bobblehead Night" (four rows: Dec 10, Jan 21, Mar 16, Mar 24). Further down the same page, the block "What giveaways are the Canadiens doing in 2026-27?" reads "Highlights include Bobblehead Night on December 10 against the Ducks" and lists "December 10 · Bobblehead Night (vs Ducks)", "January 21 · Bobblehead Night (vs Blues)", "March 16 · Bobblehead Night (vs Panthers)", "March 24 · Bobblehead Night (vs Senators)"; the FAQ answer says "The most anticipated Canadiens giveaway in 2026 is Bobblehead Night on December 10". Opening the Dec 10 game from the row's Tickets button shows "Bobblehead Night" in the game detail (observed; the launching session names this as a known deferred item, known issues 133). The row's share button is labelled "Share Bobblehead Night" for a screen reader, on a row whose visible title is "Canadiens Bobblehead Night". Screenshots: `2026-11-25-bare-title-display/nhl-canadiens/390-branch-expanded.png`, `.../nhl-canadiens/390-branch-expanded-title-0.png`, `.../nhl-canadiens/390-branch-game-detail-open.png`.
2. **Medium. `/nhl/los-angeles-kings`, 390. Same split.** Rows read "Kings Rally Towel" (Jan 2) and "Kings Mini Tote Bag" (Jan 19); the prose list on the same page reads "January 2 · Rally Towel (vs Devils)" and "January 19 · Mini Tote Bag (vs Kraken)"; the share button is labelled "Share Rally Towel". Screenshots: `.../nhl-kings/390-branch-expanded.png`, `.../nhl-kings/390-branch-expanded-title-0.png`.
3. **Medium. `/nhl/seattle-kraken/promos/bobblehead`, 390 / 768 / 1280. The H1 says "KRAKEN BOBBLEHEAD"; the rest of the page still says "Bobblehead", and one of those reads as broken.** The FAQ's first question is "Which games is Bobblehead on?", which a fan reads as a sentence about something called Bobblehead; the second is "Do I need a special ticket for the Bobblehead?". The Next game card says "Jan 31 · Bobblehead · home game 27 of 42". The date-tile tooltips say "Jan 31: Bobblehead" and "Mar 21: Bobblehead". Share hands the phone the title "Bobblehead" and the text "Bobblehead: Seattle Kraken vs Devils, Sun Jan 31. All the details:". The FAQ wording predates the change, but it is the same "bare word reads as a broken row" problem the change exists to fix, now sitting directly under a fixed H1. The breadcrumb's last crumb is "Bobblehead" and reads fine where it is ("NHL / Seattle Kraken / Bobblehead"). Screenshots: `.../promo-kraken-bobblehead/390-branch.png`, `.../promo-kraken-bobblehead/390-branch-faq-open.png`.
4. **Low. `/nhl/montreal-canadiens`, 390. The prefix is redundant on a club's own page and costs a line.** Every row on the page is a Canadiens promo under a "MONTREAL CANADIENS" H1. The title column is 154px wide at 390, so "Canadiens Bobblehead Night" wraps to two lines ("Canadiens Bobblehead" / "Night") where the neighbouring one-line titles ("Wearable Flag Night", "Mascot Party") do not. It wraps cleanly, at a word boundary. "Kings Rally Towel" and "Kings Mini Tote Bag" fit on one line. Screenshot: `.../nhl-canadiens/390-branch-expanded-title-0.png`.
5. **Low. Homepage, all viewports. Back from a rail card returns the fan to the start of the rail (predates the change).** "Kraken Bobblehead" is card 8 of 8 in Best Promos, so at 390 a fan swipes past seven cards to reach it (rail 2,340px wide in a 342px window), and it is outside the first view at 768 and 1280 too. After tapping it and pressing back, the page's vertical position is restored but the rail is back at card 1 (horizontal offset 1,998px before, 4px after). Screenshot: `.../home/390-branch-rail-kraken-in-view.png`.
6. **Low. `/nhl/los-angeles-kings` and `/nhl/montreal-canadiens`, 390. Prefixed rows sit behind "Show all N upcoming promos", and back collapses the list (predates the change).** "Kings Rally Towel" is not visible until the fan taps "SHOW ALL 45 UPCOMING PROMOS"; on the Canadiens page two of the four "Canadiens Bobblehead Night" rows (Mar 16, Mar 24) are behind "SHOW ALL 20 UPCOMING PROMOS". After expanding, tapping "Kings Rally Towel" and pressing back, the scroll offset is restored to the pixel but the list is collapsed again, so the fan is looking at the Completed section instead of the row they left. Screenshots: `.../nhl-kings/390-branch.png` (collapsed), `.../nhl-kings/390-branch-expanded.png`.
7. **Low. Homepage and `/best-promos`, 390 (homepage also 768 / 1280). The team line under the title is cut mid-word by its ellipsis (predates the change; not a title).** Homepage rails: "Nashville Predators vs Colu…", "Buffalo Sabres vs New York Ran…", "Tampa Bay Lightning vs Hurric…", "Pittsburgh Penguins vs Canu…" (six to nine lines depending on viewport). `/best-promos` at 390: 19 team lines end in an ellipsis, for example "Nashville Predators vs Columbus Blue Jac…"; none at 768 or 1280. The three prefixed cards' team lines ("Seattle Kraken vs Devils · NHL", "Montreal Canadiens vs Ducks · NHL", "Montreal Canadiens vs Blues · NHL") are not cut.
8. **Low. Homepage, all viewports. Two Tonight cards with different titles open the same page (predates the change).** "76ers Cup Games Rally Towel" and "76ers Cup Games" both link to `/nba/philadelphia-76ers/promos/76ers-cup-games-rally-towel`.
9. **Standing measurements, all pages (cannot be attributed without a baseline).** axe serious: color-contrast on every page (home 15 nodes, best-promos 72, nhl 11, promo 1, team pages 1 each); label-content-name-mismatch on `/nhl` (58, the team tiles) and on the team pages (4 and 3, calendar day buttons and the parking link); link-in-text-block on the promo page (2: "Official bag policy", "Official parking"). Failing text at 390: the "NIGHT" half of the wordmark at 4.33:1 on every page, "See all" at 4.33:1 (home), "Get tickets" at 3.76:1 and the 88 / 85 score chips at 4.36:1 (best-promos), league chips on the homepage (NHL 1.65:1, MLB 2.87:1 and 3.75:1). Hit targets under 44x44 at 390 are in the table; on the promo page the eight in the content are "Also on Ticketmaster" (133x21), "nhl.com" (43x14), "New Jersey Devils" (125x16), "Official bag policy" (109x15), "Official parking" (92x15), "Climate Pledge Arena gameday guide" (328x21), "All Seattle Kraken promos" (163x21), "Bobblehead nights across pro sports" (231x21), plus the two inline "Get Tickets" links beside the dates (68x14).

Not found anywhere on the six pages: a title cut mid-word; a title with an ellipsis or a clamp hiding a word; a doubled club name ("Kraken Kraken" and the like, searched in the served HTML and in the rendered text); a bare item title on a card (the game detail dialog in defect 1 is the one place a bare title is shown in a card-like block); horizontal overflow; a page error; a hydration error. Console output was limited to the failed loads of the four blocked outside hosts, which this run caused, and Chrome's "preloaded but not used" notices for fonts and stylesheets.

## Is the prefix redundant? Plainly, by surface

- **Homepage Best Promos rail: no, it reads naturally.** The card says "Kraken Bobblehead" at 27px and, 12px below, "Seattle Kraken vs Devils" at 12.5px. The club is on the card twice, but so it is on "Sabres Salt and Pepper Shakers / Buffalo Sabres vs New York Rangers", "Warriors Cup Games Shirt / Golden State Warriors vs Kings" and "76ers Cup Games Rally Towel / Philadelphia 76ers vs Heat" in the rail above. It matches how clubs name their own items; a fan will not trip on it. Beside "Fred VanVleet Bobblehead" and "Neemias Queta Bobblehead" it now reads as a complete title instead of a missing one.
- **`/best-promos`: mildly redundant, not a stutter.** "Kraken Bobblehead" sits directly above "Seattle Kraken vs Devils · NHL", and "Canadiens Bobblehead Night" directly above "Montreal Canadiens vs Ducks · NHL" (and "vs Blues"). The two lines are adjacent and both start with the club, which is the closest any surface comes to a stutter. It still reads better than a bare "Bobblehead" in a list of 50 named bobbleheads.
- **Promo page H1: not redundant.** "KRAKEN BOBBLEHEAD" under the crumb "NHL / Seattle Kraken / Bobblehead" reads as a proper page heading; a bare "BOBBLEHEAD" would not.
- **Team pages (`/nhl/montreal-canadiens`, `/nhl/los-angeles-kings`): redundant.** The page is the club's, every row is the club's, and the page's own prose uses the bare name for the same promo (defects 1, 2 and 4).

## Per-page notes

### `/` (homepage), 390 / 768 / 1280

- Best Promos rail, card 8 of 8: date strip "JAN 31", "1:00 PM", HOT, title "Kraken Bobblehead", team line "Seattle Kraken vs Devils", Giveaways chip, Tickets. Title 27px / 27px line height, two lines, 180px wide, identical at all three viewports (the card is 272px wide at each).
- Rail title sizes, in order: Fred VanVleet Bobblehead 27px (3 lines), Ryan O'Reilly Bobblehead 27px (2), Cutter Gauthier Bobblehead Giveaway 24px (3), Jalen Johnson Bobblehead 27px (3), Dunkstronaut Bobblehead 27px (2), Evgeni Malkin Talking Bobblehead 24px (3), Neemias Queta Bobblehead 27px (3), Kraken Bobblehead 27px (2). No word is split across lines in any of them.
- The pale rank numeral ("08") sits behind the end of the title's first line, as "02" does behind "Ryan O'Reilly"; the title stays legible.
- Tap: card to `/nhl/seattle-kraken/promos/bobblehead`, H1 "KRAKEN BOBBLEHEAD". Back: vertical delta 0px; rail offset reset (defect 5).
- scrollWidth / clientWidth: 390/390, 768/768, 1280/1280.

### `/best-promos`, 390 / 768 / 1280

- "Kraken Bobblehead" (Jan 31, score 98, "Seattle Kraken vs Devils · NHL", "First 5,000 fans · Presented by Symetra") and two "Canadiens Bobblehead Night" cards (vs Ducks, vs Blues, both "Presented by RONA"). All three titles are 14px on ONE line at 390 (title column 191px), and at 768 and 1280. Longer neighbours wrap to two lines at 390 at word boundaries ("Stephen Curry Mini Bobblehead Blind Box").
- Both Canadiens cards link to the same page, `/nhl/montreal-canadiens/promos/bobblehead-night`, which lists all four dates (three shown plus "+1 more date"). That is coherent.
- No bare item title among the 50 cards. "Mystery Bobblehead" (Senators) and "LaMelo Bobblehead" are printed as stored.
- Tap "Kraken Bobblehead": H1 matches; back delta 0px.
- scrollWidth / clientWidth: equal at all three viewports. Screenshots: `.../best-promos/390-branch-title-0.png` (Kraken), `-title-1.png`, `-title-2.png` (Canadiens).

### `/nhl`, 390 / 768 / 1280

- "Today across NHL" shows 12 cards and "This week across the NHL" shows 8 of 21 teams (Nov 25 and Nov 27). **No prefixed title appears this week**, because none of the bare-title promos falls in the window, so the hub could not exercise the change on this date. **No card shows a title made only of item words**; the item titles that are present name something else ("Kitchen Apron", "Hockey Rink Butter Dish", "Bug Keeper Hats", "Sabres Salt and Pepper Shakers") and are printed as stored. All hub card titles are on one line at 16px at 390.
- scrollWidth / clientWidth: equal at all three viewports. The 12 ellipsised strings at 768 are team names in the Browse by team tiles ("Columbus Blue Jackets" and others), not promo titles.

### `/nhl/seattle-kraken/promos/bobblehead` (promo page), 390 / 768 / 1280

- Above the fold at 390: crumb "NHL / Seattle Kraken / Bobblehead", accent rule, "GIVEAWAY" and "FIRST 5,000 FANS", H1, the two dated game lines with opponents, "Climate Pledge Arena, Seattle", the two date tiles, Get Tickets and Share, the resale note, Also on Ticketmaster, Stream on Fubo, Parking, Hotels, Remind me, then the top of "About this giveaway". A first-time visitor has the what, when, where and the button without scrolling.
- H1: "KRAKEN BOBBLEHEAD", 40px, uppercase by style (the text node is "Kraken Bobblehead"). At 390 it is two lines, "KRAKEN" / "BOBBLEHEAD", 76px tall, no word split, no overflow (358px box). At 768 and 1280 it is one line. For scale, the longer "CANADIENS BOBBLEHEAD NIGHT" takes three lines (114px) at 390 and "KINGS RALLY TOWEL" two; in both the Get Tickets button is still above the fold.
- `<title>` as served: `Bobblehead | Seattle Kraken 2026-27 | PromoNight`. og:title: the same. JSON-LD Event name: "Bobblehead". Breadcrumb JSON-LD last item: "Bobblehead".
- Date and time: found in the first game line. Venue: found, linked. Primary CTA "Get Tickets" (164x52 at 390): href host `ticketnetwork.lusg.net`, deep-linking to `www.ticketnetwork.com`, `rel="sponsored"`, read and not followed. Other outbound hrefs read: Ticketmaster, a same-site `/go` link for Fubo, SpotHero, Expedia, nhl.com, climatepledgearena.com.
- Rail tap: "Squishy Toy" (More Seattle Kraken promos) lands on H1 "SQUISHY TOY". Back: delta 0px, rail offset kept.
- More Seattle Kraken promos rail prints "Squishy Toy", "Kraken Flag", "Fan Appreciation Night Item"; the page's second date (Mar 21) is in the header, not the rail.
- CLS 0.0000 at 390. scrollWidth / clientWidth equal at all three viewports.

### `/nhl/montreal-canadiens`, 390 only

- Four "Canadiens Bobblehead Night" rows, as expected: Dec 10 vs Ducks, Jan 21 vs Blues (both visible by default), Mar 16 and Mar 24 (after "Show all 20 upcoming promos"). Each is 14px, two lines in a 154px column, subline "Bobblehead giveaway. Presented by RONA.".
- Game detail for Dec 10: "Bobblehead Night" (stored title), reported as observed.
- Row tap lands on H1 "CANADIENS BOBBLEHEAD NIGHT", `<title>` "Bobblehead Night | Montreal Canadiens 2026-27 | PromoNight"; back delta 0px.
- scrollWidth / clientWidth 390/390, collapsed and expanded.

### `/nhl/los-angeles-kings`, 390 only

- "Kings Rally Towel" (Jan 2 vs Devils, "Pride rally towel giveaway.") and "Kings Mini Tote Bag" (Jan 19), each 14px on one line. Both are visible only after "Show all 45 upcoming promos". Other item titles are printed as stored ("Elf Hat", "Comic Book Poster", "Cowboy Hat", "Bandana", "Mini Plushie").
- Row tap lands on H1 "KINGS RALLY TOWEL" (two lines at 390), `<title>` "Rally Towel | Los Angeles Kings Jan 2, 2027 | PromoNight"; back delta 0px but the list is collapsed (defect 6).
- scrollWidth / clientWidth 390/390, collapsed and expanded.

## Measurements (branch, local production build)

| Page | Viewport | scrollWidth / clientWidth | CLS | Interactive (under 44x44) | Contrast failures (distinct text) | axe serious / critical | `/promos/` links DOM / visible | First ad anchor (px from top) |
|---|---|---|---|---|---|---|---|---|
| `/` | 390 | 390 / 390 | 0.0249 | 141 (92; 69 in content) | 23 | color-contrast 15 | 55 / 37 | 57 |
| `/` | 768 | 768 / 768 | 0.0007 | 146 (97) | 23 | color-contrast 15 | 55 / 38 | 57 |
| `/` | 1280 | 1280 / 1280 | 0.0005 | 147 (98) | 23 | color-contrast 15 | 55 / 38 | 57 |
| `/best-promos` | 390 | 390 / 390 | 0.0142 | 183 (82; 59 in content) | 5 | color-contrast 72 | 58 / 56 | none in DOM |
| `/best-promos` | 768 | 768 / 768 | 0.0016 | 188 (87) | 5 | color-contrast 72 | 58 / 57 | none in DOM |
| `/best-promos` | 1280 | 1280 / 1280 | 0.0011 | 189 (88) | 5 | color-contrast 72 | 58 / 57 | none in DOM |
| `/nhl` | 390 | 390 / 390 | 0.0270 | 144 (89; 66 in content) | 4 | color-contrast 11, label-content-name-mismatch 58 | 38 / 36 | 57 |
| `/nhl` | 768 | 768 / 768 | 0.0009 | 149 (94) | 4 | same | 38 / 37 | 57 |
| `/nhl` | 1280 | 1280 / 1280 | 0.0006 | 150 (95) | 4 | same | 38 / 37 | 57 |
| promo page | 390 | 390 / 390 | 0.0000 | 55 (36; 8 in content) | 1 | color-contrast 1, link-in-text-block 2 | 17 / 15 | 57 |
| promo page | 768 | 768 / 768 | 0.0002 | 60 (41) | 1 | same | 17 / 16 | 57 |
| promo page | 1280 | 1280 / 1280 | 0.0002 | 61 (42) | 1 | same | 17 / 16 | 57 |
| `/nhl/montreal-canadiens` | 390 | 390 / 390 | 0.0000 | 156 (114; 91 in content) | 3 | color-contrast 1, label-content-name-mismatch 4 | 41 / 39 | 706 |
| `/nhl/los-angeles-kings` | 390 | 390 / 390 | 0.0000 | 243 (174; 151 in content) | 3 | color-contrast 1, label-content-name-mismatch 3 | 75 / 73 | 706 |

Notes on the table: ad scripts were blocked with every other outside host, so no ad slot filled and CLS excludes any shift an ad would cause. The team-page counts are with the upcoming list collapsed. Page errors: 0 on every page and viewport.

## Recommendation

Give each giveaway one name per page before this merges or as its immediate follow-up: the surfaces that name the promo in a sentence or a label (the team page's "Still to come" prose and FAQ answer, the game detail, the share label and share text, and the promo page's FAQ questions and Next game line) should agree with the title printed on the row and the H1 beside them, and the club's own team page is the one surface where the agreed name can be the bare one.

## Disposition (added by the build session, 2026-11-25)

| # | Disposition |
|---|---|
| 1, 2 | Put to the owner at the gate, not fixed: the brief scoped the rule to cards and the promo page H1. Team-page prose, FAQ answers and share labels still print the stored title. Deferred, known-issues 133. |
| 3 | Put to the owner at the gate, not fixed: the promo page's FAQ questions, Next game line, tooltips and share text print the stored title under the prefixed H1. Deferred, known-issues 133. |
| 4 | Put to the owner with 1 and 2: the prefix is redundant on the club's own page. |
| 5, 6, 7, 8 | Waived: not from this change. |
| 9 | Waived: standing measurements with no baseline in this run. |
