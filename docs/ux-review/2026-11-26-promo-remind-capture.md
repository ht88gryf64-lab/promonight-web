# UX review: promo page email block (feature/promo-remind-capture)

Run of 2026-11-26, 07:44 to 07:55 ET. Baseline mode, promo page type, 390x844, 768x1024, 1280x800.

- Branch: `feature/promo-remind-capture`, HEAD `33a6b9e`, served by the dev server at `http://localhost:3100` from the worktree. The dev server HTML carries no `promonight-deploy` meta. The worktree had 12 uncommitted modified files at review time, none under `src/components/`, a page route, or `src/lib/promo-remind-copy.ts`.
- Production: `https://www.getpromonight.com`, `<meta name="promonight-deploy" content="dpl_5FgQ3zuwmcqcqotg5H1ruirvc8aR">`.
- Screenshots (69 PNGs, 15 MB) were not committed, as with earlier reports; they were written beside this file during the run. Names: `2026-11-26-promo-remind-capture/<slug>/<viewport>-<env>.png` (full page), `<viewport>-<env>-fold.png` (first screen), `<viewport>-diff.png`, and on the sample `<viewport>-branch-focus-input.png`, `-focus-button.png`, `-invalid.png`.

## Pages

| Slug | Path | Game date(s) | Widths | Variant on branch |
|---|---|---|---|---|
| hawks-nickeil-alexander-walker-bobblehead | /nba/atlanta-hawks/promos/nickeil-alexander-walker-bobblehead | 2026-12-03 | 390, 768, 1280 | reminder |
| wild-native-american-heritage-night-hat | /nhl/minnesota-wild/promos/native-american-heritage-night-hat | 2026-11-25 7:00 PM CT (played) | 390, 768, 1280 | weekly |
| hornets-buzz-city-kids-day | /nba/charlotte-hornets/promos/buzz-city-kids-day | 2026-11-28, 2027-01-02, 2027-03-28 (series) | 390, 768, 1280 | reminder |
| bills-thanksgiving | /nfl/buffalo-bills/promos/thanksgiving | 2026-11-26 8:20 PM ET (today) | 390 | weekly |
| islanders-sorokin-bobblehead-night | /nhl/new-york-islanders/promos/sorokin-bobblehead-night | 2026-11-27 7:30 PM ET (tomorrow) | 390 | reminder |
| sharks-player-water-bottle-giveaway | /nhl/san-jose-sharks/promos/sharks-player-water-bottle-giveaway | 2026-11-27 1:00 PM PT (tomorrow) | 390 | reminder |

The sample is the first promo URL in `sitemap.xml` (1,493 promo URLs) whose first Event `startDate` is 2026-12-03 or later, compared as a string; it was entry 76. The played page is from `sitemap-past.xml` (4,007 URLs).

## 1. Baseline differences (branch against production)

### Served HTML of `<article>`

Not identical on any page. Differing regions, with text:

| Region | Branch | Production | From this diff? |
|---|---|---|---|
| CTA section, new block | `<div id="remind" data-remind-mode="reminder">` with h2 "Get a reminder for Nickeil Alexander Walker Bobblehead", p "Atlanta Hawks vs Pacers, Thursday, Dec 3, 2026", label "Email address", input, button "Remind me", p "We’ll email you the day before. You’ll also get the weekly Atlanta Hawks promo email; unsubscribe anytime." (1,353 bytes) | absent | Yes |
| CTA section, played page | `data-remind-mode="weekly"`: h2 "Get Minnesota Wild’s next promos", button "Sign up", p "You’ll get the weekly Minnesota Wild promo email; unsubscribe anytime." (1,182 bytes). This is the only difference on the played page. | absent | Yes |
| Third button of the Parking / Hotels row | "Get the app" | "Remind me" (same href) | Yes |
| CTA section class | `mt-4 flex flex-col gap-4` wrapping a `flex items-stretch gap-3` row | `mt-4 flex items-stretch gap-3` | Yes |
| Ticket link (Hawks, Hornets) | `ticketnetwork.lusg.net` | `stubhub.prf.hn` (`pubref:web-nba-a`) | Not in this diff. Observed; could not tell why (see D9) |
| Line under the ticket button (every upcoming page) | "TicketNetwork is a resale marketplace. Prices may differ from face value." | "PromoNight may earn a commission on ticket purchases. Resale prices may differ from face value." | Not in this diff (D9) |
| "Also on Ticketmaster" link (every upcoming page, including the two where both environments link to TicketNetwork) | present, 132.7x21 | absent | Not in this diff (D9) |
| Closing disclosure paragraph | longer wording, 81.3px tall at 390 | 48.8px tall at 390 | Not in this diff (D9) |

Outside the article: production's header nav has an EVENTS item at 768 and 1280; the branch render does not (first differing pixel row 22 at 1280). Observed; could not tell why.

### Pixel comparison

Full-page diff over the common area, threshold 0.1. Everything below the block is shifted, so the count is dominated by displacement, not by restyling.

| Page | Width | Differing px | First differing row | What is at that row |
|---|---|---|---|---|
| Hawks | 390 | 293,233 (12.0%) | 476 | line under the ticket button (D9) |
| Hawks | 768 | 593,861 (15.0%) | 400 | same |
| Hawks | 1280 | 615,936 (9.7%) | 22 | header nav, EVENTS item |
| Wild (played) | 390 | 205,058 (9.1%) | 554 | top rule of the new block (block top 553.5) |
| Wild (played) | 768 | 552,589 (15.8%) | 478 | top rule of the new block (477.5) |
| Wild (played) | 1280 | 651,377 (11.3%) | 22 | header nav |
| Hornets (series) | 390 | 234,628 (12.2%) | 489 | line under the ticket button |
| Hornets (series) | 768 | 244,555 (7.7%) | 451 | same |
| Hornets (series) | 1280 | 331,177 (6.4%) | 22 | header nav |
| Bills (today) | 390 | 231,684 (12.0%) | 362 | line under the ticket button |
| Islanders | 390 | 247,856 (10.7%) | 438 | same |
| Sharks | 390 | 240,206 (13.1%) | 438 | same |

On the played page, which has no ticket row, the two renders are pixel-identical from the top of the article down to the block's top rule at 390 and 768.

### Measurements that moved

- Top of the first content section ("About this ..."), the push. No sampled page has an image in the article on either environment, so the first content section is the reference.

| Page | Width | Production | Branch | Push | Block height + 16px gap | Remainder (D9) |
|---|---|---|---|---|---|---|
| Hawks | 390 | 716.9 | 935.4 | 218.5 | 204.3 | 14.2 |
| Hawks | 768 | 572.1 | 751.1 | 179.0 | 164.8 | 14.2 |
| Hawks | 1280 | 555.3 | 751.1 | 195.8 | 164.8 | 31.0 |
| Wild (played) | 390 | 561.5 | 715.4 | 153.9 | 153.9 | 0 |
| Wild (played) | 768 | 485.5 | 622.0 | 136.5 | 136.5 | 0 |
| Wild (played) | 1280 | 485.5 | 622.0 | 136.5 | 136.5 | 0 |
| Hornets (series) | 390 | 729.9 | 926.3 | 196.4 | 182.2 | 14.2 |
| Hornets (series) | 768 | 637.8 | 802.5 | 164.7 | 164.8 | 0 |
| Hornets (series) | 1280 | 637.8 | 802.5 | 164.7 | 164.8 | 0 |
| Bills (today, weekly) | 390 | 602.9 | 771.0 | 168.1 | 153.9 | 14.2 |
| Islanders | 390 | 678.9 | 875.3 | 196.4 | 182.2 | 14.2 |
| Sharks | 390 | 678.9 | 897.4 | 218.5 | 204.3 | 14.2 |

  The block itself costs 204.3px (two-line heading) or 182.2px (one-line heading) in reminder mode at 390, 153.9px in weekly mode at 390, 164.8px in reminder mode and 136.5px in weekly mode at 768 and 1280.
- First filled in-content ad unit moved down by the same amount and stayed in the same position in the order: Hawks 390 from 1,122 to 1,340; 768 from 914 to 1,093; 1280 from 897 to 1,093. Wild 390 from 943 to 1,097.
- The "Get Tickets" button did not move: identical top, bottom, width and height on both environments on every page and width (table in section 5).
- Under-44 targets inside the article at 390: Hawks 14 on production, 15 on the branch. The one added is "Also on Ticketmaster" (D9), not the block.
- Cumulative layout shift: no increase. Hawks 390: 0.0112 production, 0.0000 branch.
- Controls labelled "Remind me": production one (an `<a>` to /download); branch one (the form's `<button>`) on reminder pages, none on weekly pages.

## 2. Game date check

Today is 2026-11-26 in America/New_York, America/Chicago and America/Los_Angeles (run at 07:44 to 07:55 ET).

| Page | Game line | JSON-LD Event startDate | Zone | Verdict |
|---|---|---|---|---|
| Hawks | Thursday, Dec 3, 2026 (no time shown) | 2026-12-03 | ET (page states none) | upcoming, 7 days out |
| Wild | Wednesday, Nov 25, 2026 · 7:00 PM CT | 2026-11-25 | CT | PLAYED. See D1 |
| Hornets | Saturday, Nov 28, 2026; Saturday, Jan 2, 2027; Sunday, Mar 28, 2027 | 2026-11-28, 2027-01-02, 2027-03-28 | ET | upcoming |
| Bills | Thursday, Nov 26, 2026 · 8:20 PM ET | 2026-11-26 | ET | today, not played; tile reads TONIGHT |
| Islanders | Friday, Nov 27, 2026 · 7:30 PM ET | 2026-11-27 | ET | tomorrow |
| Sharks | Friday, Nov 27, 2026 · 1:00 PM PT | 2026-11-27 | PT | tomorrow |

Variant against the rule (weekly on a played page; weekly from 10:00 venue time on the day before; reminder before that):

| Page | Loaded at | `data-remind-mode` | Expected | Match |
|---|---|---|---|---|
| Hawks, game 12-03 | 07:44 ET | reminder | reminder | yes |
| Wild, played 11-25 | 06:46 CT | weekly | weekly | yes |
| Hornets, next date 11-28 | 07:47 ET | reminder | reminder | yes |
| Bills, game day | 07:48 ET | weekly | weekly | yes |
| Islanders, game tomorrow | 07:49 ET, before 10:00 ET | reminder | reminder | yes |
| Sharks, game tomorrow | 04:49 PT, before 10:00 PT | reminder | reminder | yes |

Not observed: the switch itself at 10:00 venue time on the day before. No page in the sitemap was past that hour with its game still a day away at run time.

## 3. Things that work

1. The ticket button is untouched and clears the fold. At 390 its box is 144.5x52 at top 411.8, bottom 463.8 on the Hawks page on both environments; bottom 425.8 (Islanders, Sharks), 349.8 (Bills), 476.8 (Hornets). All above 844.
2. The article's authored direct children are identical in count and order on every page and width, so no `.page-content > *` anchor moved. The block is inside child 2. The first in-content unit lands after child 4 on both environments on every page, two sections below the block, never between the ticket row and the form.
3. Tap targets and fit. Input 48px tall, button 48px tall at every width. At 390 the row is 358 wide with scrollWidth 358 and clientWidth 358, input and button on one line, button label on one line (button scrollWidth 110, clientWidth 110). Document scrollWidth equals clientWidth at 390, 768 and 1280. Input font-size 16px, so no iOS zoom.
4. An invalid address makes no request. Typing "abc" and tapping the button, pressing Enter on "abc@", and submitting empty each show "Enter a valid email address." with `aria-invalid="true"`, and zero requests to /api/subscribe (a route trap on the context recorded none). The typed text appeared in no Google Analytics request; PostHog was blocked in that pass, so it was not checked there.
5. Exactly one `id="remind"` in the served HTML and in the DOM on every page. Reminder pages carry exactly one control labelled "Remind me", the form's button. The app link reads "Get the app" and points at `/download?src=promo_cta_{team}&promoId=...&pageSlug=...`, same href as production's "Remind me".
6. The played page shows its played state and the weekly variant (recorded here so the record shows the check ran): "This game has been played", no tickets, parking, hotels or app link.
7. Fan walk on the sample at 390: date and venue are in the header; "Get Tickets" goes to ticketnetwork.lusg.net and one hop on to www.ojrq.net (302); the rail card "Holiday Beanie" opens a page whose H1 is "HOLIDAY BEANIE"; browser back restored scroll to within 11px (2,850 before, 2,861 after). Loading the URL with `#remind` puts the block 80px from the top, clear of the 57px header.
8. No hydration warning or React error in the console on any branch load. No em dash, superlative or count in the block on any of the six pages. The flight payload carries only `mode`, `teamId`, `teamName`, `league`, `promoId`, `consent` for the form.

## 4. Defects

**D1. Played game page (Wild, 2026-11-25). Severity: none, reported by rule.** All widths. Every date on the page is before today in CT. The page is in its played state and offers "Next Minnesota Wild promo", "Share", and on the branch the weekly sign-up; it offers no tickets, parking, hotels or reminder. Chosen on purpose as the weekly sample. `wild-native-american-heritage-night-hat/390-branch.png`.

**D2. At 390 the block takes the giveaway description off the first screen and its own input lands at or under the sticky footer ad. Severity: medium.** 390 only. On production the first screen of the Hawks page ends with the "About this giveaway" heading and the first line of what the giveaway is (section top 716.9). On the branch that section starts at 935.4, 91px below the fold. What replaces it is the block's heading; the input row sits at 820.6 to 868.6, and the footer band covers the screen from about 794 down. Input top at first paint: Hawks 820.6, Hornets 811.5, Sharks 782.6, Islanders 760.5 (bottom 808.5, so 14px under the band). First content section top on the branch: Hawks 935.4, Hornets 926.3, Sharks 897.4, Islanders 875.3, all below 844; on production all four were above it (716.9, 729.9, 678.9, 678.9). A first-time visitor's first screen now ends on a form heading with no visible field and no description of the item. Bills (771.0) and the played Wild page (715.4) keep the section above the fold. `hawks-nickeil-alexander-walker-bobblehead/390-branch-fold.png` against `390-production-fold.png`.

**D3. Two filled team-colour buttons in one section. Severity: low to medium.** All widths. "Remind me" (109.7x48) and "Sign up" (84x48) use the same filled accent as "Get Tickets" (144.5x52 at 390), 357px below it at 390. On the played page "Next Minnesota Wild promo" and "Sign up" are both filled green, 105px apart. Production had one filled button in this section. `hawks-nickeil-alexander-walker-bobblehead/390-branch.png`, `wild-native-american-heritage-night-hat/390-branch.png`.

**D4. The input is oversized at 1280. Severity: low.** 1280, and to a lesser degree 768. The row spans the whole column: input 618.3px beside a 109.7px button at 1280 (644 beside 84 in weekly mode); 490.3px at 768 (516 weekly). At 768 it lines up with the ticket row above and reads as part of it. At 1280 a 618px field for an email address is the widest control on the page, wider than the ticket button (522.5). `hawks-nickeil-alexander-walker-bobblehead/1280-branch.png`.

**D5. The invalid state marks the message, not the field. Severity: low.** All widths. After an invalid submit the field's border is unchanged (`rgba(33, 29, 24, 0.16)`), focus stays on the button, and the error paragraph has no id, so `aria-describedby` still names only the consent line. The message is `role="alert"`, 13px, `rgb(198, 42, 30)`. `hawks-nickeil-alexander-walker-bobblehead/390-branch-invalid.png`.

**D6. Thin margins on two contrasts. Severity: low.** All widths. Consent line: 12px, 4.52:1 (`rgb(120,110,96)` on `rgb(247,243,234)`), a pass by 0.02. Input boundary: border against the page is 1.38:1, and the white fill against the cream page is close to 1:1, under the 3:1 expected of a control boundary; the Parking and Hotels buttons share that treatment. Placeholder 5.0:1.

**D7. The reminder heading and subline restate the header. Severity: low.** 390 mostly. "Get a reminder for Nickeil Alexander Walker Bobblehead" plus "Atlanta Hawks vs Pacers, Thursday, Dec 3, 2026" repeat the H1 and the game line about 330px above; at 390 the promo name is on screen three times in the first 800px (crumb, H1, block). Long names wrap the heading to two lines at 390 (Hawks, Sharks), which costs 22px. On the series page the subline does new work: it says which date the reminder is for (Nov 28).

**D8. "Get the app" and "Get the App" on one screen. Severity: low.** 768 and 1280. The row link reads "Get the app"; the header button reads "Get the App". Two app links are visible at once at these widths.

**D9. Ticket-row differences that are not in this diff. Severity: not rated; observed, could not tell.** All widths, every upcoming page. The branch render shows the TicketNetwork line and an "Also on Ticketmaster" link (132.7x21, under 44) and links Hawks and Hornets tickets to TicketNetwork; production shows the commission line, no "Also on" link, and StubHub for those two clubs. The header EVENTS item is also missing on the branch render. None of this is in the branch's JSX diff. It looks like an environment difference between the dev server and production and I could not tell; I did not look. It adds 14.2px to the push at 390 and 768 and 31.0px on the Hawks page at 1280, so the push on production after merge should be the "block + gap" column, not the "push" column.

**D10. One more in-content unit on the played page at 768 and 1280. Severity: not rated; observed, could not tell.** Branch: six units, the third after "Before you go". Production: five, the third one section later. Ad sequences were identical on the other five pages at every width. Ads fill differently per load, so this may be load variance and may be the extra 136.5px; one load per environment cannot separate them.

Present on both environments, not from this branch: axe `color-contrast` on the header logo word "NIGHT" (4.33:1); per-date "Get Tickets" links on the series header at 67.8x14; the Hawks page shows no game time.

## 5. Measurements

Sample page (Hawks, reminder mode). Branch against production.

| Measure | 390 branch | 390 prod | 768 branch | 768 prod | 1280 branch | 1280 prod |
|---|---|---|---|---|---|---|
| `id="remind"` count | 1 | 0 | 1 | 0 | 1 | 0 |
| Block box (w x h), top | 358 x 188.3, 723.1 | n/a | 608 x 148.8, 578.3 | n/a | 736 x 148.8, 578.3 | n/a |
| Heading | h2, 2 lines, 15.13:1 | n/a | h2, 1 line | n/a | h2, 1 line | n/a |
| Input (w x h), font | 240.3 x 48, 16px | n/a | 490.3 x 48, 16px | n/a | 618.3 x 48, 16px | n/a |
| Button (w x h), label | 109.7 x 48, "Remind me" | n/a | 109.7 x 48 | n/a | 109.7 x 48 | n/a |
| Button scrollWidth / clientWidth | 110 / 110 | n/a | 110 / 110 | n/a | 110 / 110 | n/a |
| Row scrollWidth / clientWidth | 358 / 358 | n/a | 608 / 608 | n/a | 736 / 736 | n/a |
| Document scrollWidth / clientWidth | 390 / 390 | 390 / 390 | 768 / 768 | 768 / 768 | 1280 / 1280 | 1280 / 1280 |
| "Get Tickets" top, bottom, size | 411.8, 463.8, 144.5 x 52 | 411.8, 463.8, 144.5 x 52 | 335.8, 387.8, 394.5 x 52 | same | 335.8, 387.8, 522.5 x 52 | same |
| CTA section height | 499.7 | 281.2 | 391.4 | 212.4 | 391.4 | 195.6 |
| First content section top | 935.4 | 716.9 | 751.1 | 572.1 | 751.1 | 555.3 |
| First filled ad unit top | 1,340 | 1,122 | 1,093 | 914 | 1,093 | 897 |
| First ad anchor (the article, `data-ad-region="content"`) | 57 | 57 | 57 | 57 | 57 | 57 |
| Authored article children | 11 | 11 | 11 | 11 | 11 | 11 |
| Children plus ad units, in order | cccccAcAcAccAcAcA | same | same | same | same | same |
| Under-44 targets, page / article | 39 / 15 | 40 / 14 | 44 / 15 | 45 / 14 | 44 / 15 | 46 / 14 |
| `<a>` to /promos/, DOM / visible | 19 / 17 | 19 / 17 | 19 / 18 | 19 / 18 | 19 / 18 | 19 / 18 |
| CLS during load | 0.0000 | 0.0112 | 0.0003 | 0.0191 | 0.0001 | 0.0002 |
| axe serious or critical, own markup | color-contrast 1 (logo) | color-contrast 1 (logo) | same | same | same | same |
| Text under 4.5:1 inside the article | 0 | 0 | 0 | 0 | 0 | 0 |
| Document height | 6,506 | 6,289 | 5,144 | 5,144 | 5,096 | 4,918 |

Article direct children, branch and production (identical; only the content of the third differs):

`nav > header (H1) > section (CTA) > section "About this giveaway" > section "This game" > section "What to expect at a bobblehead giveaway" > section#before-you-go > section "More Atlanta Hawks promos" > section "More NBA giveaways coming up" > section "Questions" > p (disclosure)`

Wild (played): `nav > header > section (CTA) > About this giveaway > This game > What to expect at a hat giveaway > #before-you-go > More Minnesota Wild giveaways > More NHL giveaways coming up > Questions > p`, 11 and 11. Hornets (series): `nav > header > section (CTA) > About this promotion > Next game > #before-you-go > More Charlotte Hornets ... > Same promo, other teams > Questions > p`, 10 and 10. Bills 10 and 10, Islanders 11 and 11, Sharks 9 and 9.

The block on the other pages (branch):

| Page | Width | Mode | Heading | Input w x h | Button w x h, label | Block h | Button text contrast |
|---|---|---|---|---|---|---|---|
| Wild | 390 | weekly | "Get Minnesota Wild’s next promos", 1 line | 266 x 48 | 84 x 48, "Sign up" | 137.9 | 10.59:1 on rgb(21,71,52) |
| Wild | 768 | weekly | 1 line | 516 x 48 | 84 x 48 | 120.5 | 10.59:1 |
| Wild | 1280 | weekly | 1 line | 644 x 48 | 84 x 48 | 120.5 | 10.59:1 |
| Hornets | 390 | reminder | "Get a reminder for Buzz City Kids Day", 1 line; "Charlotte Hornets vs Nets, Saturday, Nov 28, 2026" | 240.3 x 48 | 109.7 x 48, "Remind me" | 166.2 | 16.14:1 on rgb(29,17,96) |
| Hornets | 768 | reminder | 1 line | 490.3 x 48 | 109.7 x 48 | 148.8 | 16.14:1 |
| Hornets | 1280 | reminder | 1 line | 618.3 x 48 | 109.7 x 48 | 148.8 | 16.14:1 |
| Bills | 390 | weekly | "Get Buffalo Bills’ next promos", 1 line | 266 x 48 | 84 x 48, "Sign up" | 137.9 | 11.30:1 on rgb(0,51,141) |
| Islanders | 390 | reminder | "Get a reminder for Sorokin Bobblehead Night", 1 line | 240.3 x 48 | 109.7 x 48 | 166.2 | 7.75:1 on rgb(0,83,155) |
| Sharks | 390 | reminder | "Get a reminder for Sharks Player Water Bottle Giveaway", 2 lines | 240.3 x 48 | 109.7 x 48 | 188.3 | 6.10:1 on rgb(0,109,117) |
| Hawks | 390 | reminder | 2 lines | 240.3 x 48 | 109.7 x 48 | 188.3 | 4.80:1 on rgb(218,45,32) |

Contrast inside the block (same on every page): heading 15.13:1, subline 8.10:1 (14px), consent 4.52:1 (12px), placeholder 5.00:1, typed text 16.75:1. Button text on the team colour ranged from 4.80:1 (Hawks) to 16.14:1 (Hornets) on the six clubs sampled; the other clubs were not measured.

Does it read as content or as an ad: content. Computed style of `#remind`: transparent background, no border except a 1px top rule at `rgba(33,29,24,0.1)`, no radius, no shadow, 16px top padding, page fonts. The nearest ad unit is 429px below the block's bottom edge at 390 on the Hawks page (block bottom 911.4, unit top 1,340), with two content sections between.

Keyboard and focus (sample, same at all three widths):

- Tab order: Get Tickets, Share, Also on Ticketmaster, Stream on Fubo, Parking, Hotels, Get the app, email input, Remind me, then the next section's first link. Ticket row first, then the block.
- Label: `<label class="sr-only" for=...>Email address</label>` matches the input id; `aria-describedby` points at the consent line.
- Input focus: border and 2px ring in `rgb(33,29,24)`, clearly visible (`390-branch-focus-input.png`).
- Button focus: no authored style; the browser's default ring shows (`outline: auto 1px rgb(0,95,204)`), visible on the red button (`390-branch-focus-button.png`). Same as "Get Tickets".
- Headings: H1, then the block's H2, then the section H2s. No level skipped.

Console on load: no hydration or React warning on either environment. Branch-only lines are dev-server ones: `[venue-hub] sources map is partially inverted: 2 of 15 keys are URLs` on every page, and `[ebay-browse] ... no block (missing credentials)` on the Islanders page, plus CORS errors from ad partners against the localhost origin. Production's lines are ad-partner noise.

## 6. Not verified

- A removed (tombstoned) page: none was loaded, so "no block" there is unchecked.
- The success state and any real submit: not exercised, by instruction. No request to /api/subscribe or /api/cron/ was made.
- A cached page whose mode has gone stale (rendered "reminder", loaded after 10:00 on the day before): the dev server does not cache, so the fan-facing sequence of an offer followed by "It is too late for a day-before email" was not seen.
- Real iOS Safari. Desktop Chrome emulation only.
- Side effects of this run: focusing the field sent `email_cta_click` and Google's `form_start` to analytics from the dev server (debug mode), a handful of times; PostHog requests were blocked during the interaction pass only. One GET was made to the TicketNetwork affiliate link to read its redirect.

## 7. Recommendation

Settle D2 before merge: at 390 the block costs 154 to 204px directly under the button row, which moves the description of the giveaway off the first screen on four of the five upcoming pages sampled and leaves the block's own field at or under the footer ad. Either fix it, or waive it here with the reason. Everything else in the list is low severity or not attributable to this diff.


## Dispositions (added by the build session, 2026-11-26)

Every defect above is fixed, deferred with a known-issues entry (docs/known-issues.md, entry 136), or waived with its reason. The fixes were made AFTER this review ran and were not re-measured in a browser; they are covered by the page and form tests.

- **D1 (played page shown on purpose):** not a defect of this diff. The played page is one of the two variants the review was asked to cover.
- **D2 (medium, 390: the block moves the first content section below the fold, and its input sits at or under the sticky footer ad at first paint):** RULED at Gate 2 (2026-11-26). The matchup and date line is dropped on single-date pages (a series keeps it, where it names the date the reminder is for), which takes 28.3px off the block there; the rest of D2 is WAIVED: the placement directly under the ticket row is Gate 1's ruling, and the ticket button is unmoved and clears the fold on every page. The re-check below measures what remains.
- **D3 (two filled team-colour buttons in one section):** FIXED. The form's button is an ink outline; "Get Tickets" (and "Next {team} promo" on a played page) is the section's one filled action.
- **D4 (input oversized at 1280):** FIXED. The form is capped at 520px from the `lg` breakpoint; 390 and 768 are unchanged.
- **D5 (invalid state marks the message, not the field):** FIXED. The field takes the error colour on its border, `aria-describedby` names the error, and focus returns to the field.
- **D6 (consent line 4.52:1 at 12px; input border 1.38:1):** WAIVED. Both pass or match the page's existing treatment (the consent line clears 4.5:1; the border is the Parking and Hotels buttons' own).
- **D7 (heading and subline restate the H1 and game line):** WAIVED. They are the brief's copy, and on a series page the subline is what names the date the reminder is for.
- **D8 ("Get the app" in the row and "Get the App" in the header at 768 and 1280):** DEFERRED (known-issues 136). The row label is Gate 1 ruling 1.
- **D9 (ticket row and header differences between the branch render and production):** not this diff. The dev server runs without production's `NEXT_PUBLIC_TICKET_TEST` and `EVENTS_PAGES_LIVE` values, which is what selects StubHub, drops "Also on Ticketmaster" and shows the EVENTS nav item in production.
- **D10 (one more in-content unit on the played page at 768 and 1280, on a single load):** DEFERRED (known-issues 136) to the first production read after deploy: one load per environment cannot tell load variance from the added height.

Also changed after the review, from the adversarial code review: the email input has no `name`, so a submit before hydration cannot put an address in the page URL; the form and its result sit inside one `aria-live` region so the result is announced.


## Re-check at 390 (2026-11-26, after the Gate 2 changes)

Run of 2026-11-26, 08:02 to 08:08 ET. 390x844 only, a narrow re-check of four changes to `<div id="remind">`; not a full review. Written by the ux-review agent.

- Branch: `feature/promo-remind-capture`, HEAD `fbb4990`, dev server at `http://localhost:3100` (no `promonight-deploy` meta). The worktree had 13 uncommitted modified files at run time, one of them `src/components/promo-page/PromoPageView.tsx`: the subline removal (change 4) is in the working tree, not in a commit. The outline button, the 520px cap and the invalid-field focus are in `fbb4990`.
- Production: `https://www.getpromonight.com`, `dpl_5FgQ3zuwmcqcqotg5H1ruirvc8aR` (same deployment as the review above).
- Pages: Hawks (single date), Hornets (series), Islanders (single date), Sharks (single date). All four rendered `data-remind-mode="reminder"` on the branch.
- No screenshot was written into the repo. No request to `/api/subscribe` or `/api/cron/` was made (a route trap on every context recorded none); no valid-looking address was typed.

### Game date check

Today is 2026-11-26 in ET and PT. Hawks 2026-12-03 (JSON-LD and game line), Hornets 2026-11-28 / 2027-01-02 / 2027-03-28, Islanders 2026-11-27 7:30 PM ET, Sharks 2026-11-27 1:00 PM PT. All upcoming; no played page in this run.

### 1. Outline button (D3): confirmed

Same on all four pages.

| Measure | Value |
|---|---|
| Background (computed) | `rgb(255, 255, 255)`, the card colour, the same fill as Share, Parking, Hotels and Get the app |
| Border | `1px solid rgb(33, 29, 24)` |
| Text | `rgb(33, 29, 24)`, 15px / 600 |
| Text contrast | 16.75:1 on the button's white |
| Border against the button fill / against the cream page | 16.75:1 / 15.13:1 |
| Size | 111.7 x 48 (was 109.7 x 48; the 1px border adds 2px of width) |
| Label fit | scrollWidth 110, clientWidth 110, one line |
| Hover (mouse) | background `rgb(33, 29, 24)`, text `rgb(255, 255, 255)`, 16.75:1; border unchanged |
| Hover on a touch context | `(hover: hover)` is false; after a tap the button is still white with ink text. No stuck hover |
| Keyboard focus | `:focus-visible` true; `outline: solid 2px` at `2px` offset in the page's `--pp-accent-text`: `rgb(33, 29, 24)` on the Hawks page, `rgb(29, 17, 96)` on the Hornets page. Authored, where the review found the browser default (`auto 1px rgb(0, 95, 204)`) |
| Rest, no focus | `outline-style: none` |

"Get Tickets" is now the only control in the CTA section with a team-colour fill: `rgb(218, 45, 32)` Hawks, `rgb(29, 17, 96)` Hornets, `rgb(0, 83, 155)` Islanders, `rgb(0, 109, 117)` Sharks, 144.5 x 52 (164.5 x 52 on the Hornets page). Every other control in the section is white or transparent. It reads as the one primary action. "Remind me" reads as a secondary button whose 1px ink border is heavier than the field beside it (`rgba(33, 29, 24, 0.16)`), which is enough to tell button from field. D3 is closed on reminder pages. The played-page pair ("Next {team} promo" and "Sign up") was not re-rendered in this run.

### 2. 520px cap (D4): no effect at 390, confirmed

At 390 the form's computed `max-width` is `none` on all four pages.

| Measure | Review | Now |
|---|---|---|
| Form width | 358 | 358 |
| Input width x height | 240.3 x 48 | 238.3 x 48 |
| Button width x height | 109.7 x 48 | 111.7 x 48 |
| Row scrollWidth / clientWidth | 358 / 358 | 358 / 358 |
| Input and button on one line | yes | yes (same top, `flex-wrap: nowrap`) |
| Document scrollWidth / clientWidth | 390 / 390 | 390 / 390, also after an invalid submit |

The 2px moved from the input to the button is the button's border, not the cap. 768 and 1280 were not rendered, by instruction, so the cap itself is unobserved.

### 3. Invalid-field focus (D5): confirmed in the accessibility tree and in focus, not in what the fan sees (R1, R2)

"abc" typed, then submitted by tap on the button; cleared by typing; then "abcd" submitted with Enter; also Space on the focused button, and an empty submit. Hawks and Hornets with a mouse, Islanders on a touch context.

| Check | Result |
|---|---|
| Inline error | "Enter a valid email address.", `role="alert"`, 13px, `rgb(198, 42, 30)`, on every path |
| `aria-invalid` | `"true"` after each invalid submit; absent before and after typing again |
| `aria-describedby` | before: the consent line's id only. After: error id then consent id (`_R_..H2_ _R_..H1_`); both ids resolve to elements |
| Focus | `document.activeElement` is the input after tap, after Enter, after Space on the button, and after an empty submit (the review found it left on the button) |
| Requests to `/api/subscribe` | 0 on every path. No same-origin request of any kind after the submit; the URL did not change |
| Typing again | one more character removes the error paragraph, `aria-invalid` and the error id; block height returns to its resting value |
| Block height with the error showing | +27.5px (Hawks 160.0 to 187.5, Hornets 166.2 to 193.7) |
| Fit with the error showing | row 358 / 358, document 390 / 390 |

Input border colour (computed `border-top-color`):

| State | Border | Ring |
|---|---|---|
| At rest | `rgba(33, 29, 24, 0.16)` | none |
| Focused, valid | `rgb(33, 29, 24)` | 2px, `--pp-accent-text` |
| After an invalid submit (focus is on the input) | `rgb(33, 29, 24)` | 2px, `--pp-accent-text` |
| Invalid, after focus leaves the input | `rgb(198, 42, 30)` | none |

The error colour is on the field only once focus has left it. The fix returns focus to the field, and the field's focus style (`focus:border-rd-ink`) wins over the error border, so at the moment the error appears the field looks exactly as it does when focused and valid. See R1.

### 4. Subline removal (D2, D7): confirmed; the first content section is still below the fold

Children of `#remind`: Hawks, Islanders, Sharks `h2, div (the form)`: the heading is followed directly by the form, no matchup line. Hornets `h2, p "Charlotte Hornets vs Nets, Saturday, Nov 28, 2026", div (the form)`: the line is still there and still names the date the reminder is for.

Old numbers are the review's (07:44 to 07:55 ET); new numbers are this run. Document coordinates at first paint, scroll 0. The sticky footer ad (`#AdThrive_Footer_1_phone`) measured `top 794, height 50` on both environments on every page, so it covers 794 to 844.

| Page | Block height old / new | First content section top, production | Branch old / new | Push old / new | Input top old / new | Input bottom new |
|---|---|---|---|---|---|---|
| Hawks (single, 2-line heading) | 188.3 / 160.0 | 716.9 | 935.4 / 907.1 | 218.5 / 190.2 | 820.6 / 792.3 | 840.3 |
| Hornets (series, 1-line heading) | 166.2 / 166.2 | 729.9 | 926.3 / 926.3 | 196.4 / 196.4 | 811.5 / 811.5 | 859.5 |
| Islanders (single, 1-line heading) | 166.2 / 137.9 | 678.9 | 875.3 / 847.0 | 196.4 / 168.1 | 760.5 / 732.2 | 780.2 |
| Sharks (single, 2-line heading) | 188.3 / 160.0 | 678.9 | 897.4 / 869.1 | 218.5 / 190.2 | 782.6 / 754.3 | 802.3 |

The removal saves 28.3px on each single-date page and nothing on the series page. Of each push, 14.2px is the ticket-row difference between the dev server and production (D9), so the block's own cost (height plus the 16px gap) is 176.0 (Hawks, Sharks), 182.2 (Hornets) and 153.9 (Islanders).

Against the 844 fold and the footer ad:

| Page | First content section | Input against the footer ad (794 to 844) |
|---|---|---|
| Hawks | BELOW the fold, by 63.1 (was 91.4) | 46.3 of its 48px are behind the ad (792.3 to 840.3). Before: 820.6 to 868.6, behind the ad and partly below the fold. No better in practice |
| Hornets | BELOW, by 82.3 (unchanged) | 32.5px behind the ad, 15.5px below the fold (unchanged) |
| Islanders | BELOW, by 3.0 (was 31.3) | clear of the ad by 13.8px (was 14.5px behind it). The consent line (788.2 to 823) is behind the ad |
| Sharks | BELOW, by 25.1 (was 53.4) | 8.3px behind the ad (was 36.6px) |

On production all four sections were above the fold (716.9, 729.9, 678.9, 678.9); on the branch all four are still below it. Projected for production after merge, taking the 14.2px D9 remainder out (a projection, not a measurement): Hawks 892.9, Hornets 912.1, Sharks 854.9, Islanders 832.8. Only Islanders would cross above 844, and it would still start behind the footer ad at 794, so no sampled reminder page shows any of the giveaway description on the first screen. The input is fully visible at first paint on one of four pages (Islanders).

The "Get Tickets" button is unmoved: Hawks 411.8 to 463.8, Islanders and Sharks 373.8 to 425.8, identical on both environments.

### In passing

| Check | Result |
|---|---|
| `id="remind"` | exactly 1 in the served HTML and 1 in the DOM on all four branch pages; 0 on production |
| Input `name` | no `name` attribute on any page (`hasAttribute('name')` false) |
| Article direct children, branch against production | identical in count and order: Hawks 11 and 11, Hornets 10 and 10, Islanders 11 and 11, Sharks 9 and 9. Only the content of the third (the CTA section) differs |
| Input | 48px tall, 16px text, on all four |
| Console | no hydration or React warning on any branch load, before or after the interactions. A clean load of the Islanders page with nothing blocked showed no Next.js issue badge. Branch-only lines are the same as in the review: `[venue-hub] sources map is partially inverted: 2 of 15 keys are URLs`, and ad-partner CORS errors against the localhost origin |
| Caused by this run's script, not the page | where the script blocked PostHog it also blocked the dev server's PostHog chunk, which logs `[analytics] PostHog failed to load ChunkLoadError` and raises the dev overlay's "1 Issue" badge. Neither appears on the clean load |

### New defects

**R1. After an invalid submit the field does not show the error colour while it has focus, which is always, because focus is returned to it. Severity: low.** 390 (the classes are not width-dependent). Computed border after the submit is `rgb(33, 29, 24)` with the 2px focus ring, identical to a focused valid field; `rgb(198, 42, 30)` appears only after focus leaves. The D5 disposition says "the field takes the error colour on its border"; it does, but not at the moment the error is raised. The accessibility half of D5 (`aria-invalid`, `aria-describedby`, focus) is done. Seen on Hawks, Hornets (mouse) and Islanders (touch).

**R2. At the first-paint scroll position the error message appears behind the sticky footer ad. Severity: low to medium.** 390. On the Islanders page, the one page where the field can be tapped without scrolling, the message sits at about 788 to 808 (8px under the row's bottom edge at 780.2, 19.5px tall, from the 27.5px the block grows) and the ad covers 794 to 844: about 14 of its 19.5px are hidden, and the page does not scroll because focus goes to a field that is already in view. Together with R1 the fan taps "Remind me" on a bad address and nothing visible changes: same field look, message under the ad. On the other three pages the fan has to scroll to reach the field, so the message lands wherever that scroll leaves it. Desktop Chrome touch emulation; on a real phone the keyboard opens when focus returns to the field and moves the layout, which this run cannot show.

**D2 stays open, reduced.** The subline removal takes 28.3px off single-date pages and nothing off series pages. The first content section is below the fold on four of four reminder pages (by 3.0 to 82.3px) and the input is behind the footer ad on three of four.

Not re-checked in this run: 768 and 1280, the weekly variant and the played page, the success state, real iOS Safari, `--pp-accent-text` focus-ring contrast on clubs other than the four sampled.

Side effects of this run: the clean Islanders load blocked nothing but the two API paths, so its page view and one `email_cta_click` (and Google's `form_start`) went to analytics from the dev server; the other passes blocked PostHog and Google Analytics collection.

### Recommendation

Rule on D2 with these numbers rather than the review's: the subline removal did not bring the giveaway description back onto the first screen on any sampled page. R1 is a one-state styling gap and should be settled with it, since R1 and R2 together make an invalid submit look like a dead button on the page where the field is reachable without scrolling.


## Dispositions of the re-check (added by the build session, 2026-11-26)

- **R1 (low, the error colour did not show while the field had focus):** FIXED after the re-check. The invalid field keeps the error colour on its border with focus on it (`focus:border-rd-link` while invalid; the ink focus border applies only to a valid field). Covered by the form test; not re-measured in a browser.
- **R2 (low to medium, at the first-paint scroll position the error message can sit behind the sticky footer ad):** DEFERRED (known-issues 136). It is the remaining part of D2, waived at Gate 2: the block sits where the footer ad's band falls on a 390x844 first screen. With R1 fixed the field itself now shows the error colour when it is in view.
- **D2 after the subline removal:** as ruled. The first content section is still below the fold on the sampled pages (by 3 to 63px on the single-date ones); waived.
