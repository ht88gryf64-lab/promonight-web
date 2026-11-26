# UX review: compact ticket card, 44px minimum height

Run of 2026-11-25 (America/New_York), baseline mode, branch `fix/ticket-card-overlap`.

- Branch render: dev server at `http://localhost:3100`. It carries no `promonight-deploy` meta. The worktree is at `d5d37b5` (same commit as `origin/main`) with uncommitted changes in `src/components/affiliates/TicketmasterCTA.tsx`, its label test and `docs/known-issues.md`.
- Production render: `https://www.getpromonight.com`, `promonight-deploy` = `dpl_HuQ2KpGideAuAF15Uf9eD7GTEJSM`. I did not confirm which commit that deployment carries.
- Pages: `/nhl/minnesota-wild` (team) and `/nhl/minnesota-wild/promos/ornament` (promo, game 2026-12-12). Viewports 390x844, 768x1024, 1280x800. Real clock on both hosts.
- Screenshots: `2026-11-25-compact-ticket-card-44px/minnesota-wild/` and `2026-11-25-compact-ticket-card-44px/minnesota-wild-ornament/`. Files ending `-noads` were taken with third-party scripts blocked on both hosts, so the app's own boxes can be compared without ad fill.

## Verdict

The branch does what it says and nothing else that I could measure. Every compact ticket card reachable on the two pages is 44px tall on the branch and 43px on production, at all three widths. No defect is introduced by the branch. One baseline difference is not explained by the diff (two eBay resale links present on production, absent on the branch render); it looks like an environment difference and I could not tell.

## 1. Baseline differences

### 1.1 Served HTML, main content

| Page | Identical | Differing regions |
|---|---|---|
| Team | No | (a) 9 compact ticket card anchors: the class list gains `min-h-[44px]`, nothing else in the tag changes (same href, rel, target, aria-label). These are the cards for Nov 25, Nov 27, Dec 5, 8, 12, 15, 18, 19, 22. (b) Production has two extra blocks, each a wrapper `div` plus a link reading "Missed it? Check resale on eBay", under the completed rows "Kirill Kaprizov Bobblehead & T-shirt" and "Jared Spurgeon Bobblehead & Scarf". The branch render has neither. |
| Promo | Yes | None. 28,819 bytes of main content on both, token for token. |

On (b): the branch diff does not touch that link. The component comment in `src/components/affiliates/EbayResaleLink.tsx` says it renders only when an eBay campaign id is set, so this reads as an environment difference between the dev server and production. Observed, not confirmed: I do not read env files and could not tell. The same absence was recorded in `2026-11-25-ticket-partner-test.md`.

### 1.2 Pixels

Raw full-page comparison (`<viewport>-diff.png`) is dominated by ad fill, which differs on every load and changes the page height (team page 12,514px branch against 12,610px production at 390). Those numbers say nothing about the change, so the comparison was repeated with third-party scripts blocked on both hosts.

| Page | Width | Ads blocked: pixels differing | Where |
|---|---|---|---|
| Team, at rest | 390 | 248,785 | From y=4778 down: the first eBay link on production pushes everything below it 48px, the second another 48px. Nothing differs above y=4778. `minnesota-wild/390-diff-noads.png` |
| Team, at rest | 768 | 275,796 | From y=4186 down, same cause, 32px per link. `minnesota-wild/768-diff-noads.png` |
| Team, at rest | 1280 | 302,702 | From y=3167 down, main column only, same cause. `minnesota-wild/1280-diff-noads.png` |
| Team, at rest, production's two eBay wrappers hidden in the browser | 390, 768, 1280 | 0, 0, 0 | Exact match, same page height on both hosts (10,780 / 8,505 / 6,963). `minnesota-wild/<viewport>-diff-noads-noebay.png` |
| Promo | 390, 768, 1280 | 0, 0, 0 | Exact match, same page height (3,557 / 2,613 / 2,572). `minnesota-wild-ornament/<viewport>-diff-noads.png` |

With the page at rest the compact cards are not rendered visibly (they sit in closed dialogs and panels), so the change has no effect on the resting page. The full-size sidebar card is in the 0-pixel result.

Open states, ads blocked, same scroll position on both hosts:

| State | Width | Pixels differing | Bounding box of the difference |
|---|---|---|---|
| Row dialog (Dec 12) | 390 | 2,688 | x 38 to 352, y 335 to 444: inside the dialog's inner panel, from the logo row down to the panel's bottom border. `minnesota-wild/390-diff-row-dialog-noads.png` |
| Row dialog (Dec 12) | 768 | 3,339 | x 154 to 614, y 358 to 449. `minnesota-wild/768-diff-row-dialog-noads.png` |
| Row dialog (Dec 12) | 1280 | 3,244 | x 410 to 870, y 340 to 432. `minnesota-wild/1280-diff-row-dialog-noads.png` |
| Calendar panel, away (Nov 29) | 390 / 768 / 1280 | 6,279 / 18,173 / 6,543 | From the logo row to the bottom of the viewport, calendar column only (at 1280 x 90 to 821; the sidebar does not move). `minnesota-wild/<viewport>-diff-calendar-away-noads.png` |
| Calendar panel, home (Dec 12) | 390 / 768 / 1280 | 11,739 / 24,697 / 7,490 | Same shape. `minnesota-wild/<viewport>-diff-calendar-home-noads.png` |

What the difference is: the card's bottom border sits 1px lower; the note, and everything after it in the same column, sits 1px lower; the logo is resampled because it moved down half a pixel to stay centred. With a calendar panel open the 1px shift carries on down the page below the calendar (the panel is in the page flow), not only inside the panel. In the row dialog the shift stops at the inner panel's bottom border; the dialog's own box does not change.

### 1.3 Measurements that moved

| Measurement | Branch | Production |
|---|---|---|
| Compact ticket card height, every placement and width | 44 | 43 |
| Calendar panel height (card container) | production + 1 | for example 747.69 away Nov 29 at 390 |
| Row dialog content height (inner scroll area) | 401 / 396 / 396 | 400 / 395 / 395 |
| Row dialog outer box | 358x717 / 512x870 / 512x680 | same |
| Interactive elements under 44px at 390, team page, non-ad | 85 | 87 (the two eBay links, 186x32) |
| Cumulative layout shift, team 1280 | 0 | 0.030 (one shift at 2.5s; ad fill) |
| Cumulative layout shift, promo 390 / 768 / 1280 | 0.0001 / 0.0002 / 0.0002 | 0.011 / 0.031 / 0.030 (ad fill) |
| axe serious and critical, promo 390 | 1 | 5 (four are inside ad creative: an unnamed button, an image with no alt, an unlabelled input, an empty link) |

Nothing else in step 2 moved: hit sizes outside the card, contrast failures, links to `/promos/` (DOM against visible), and the first ad anchor are the same on both hosts (table in section 5).

## 2. Game date check

| Page | Dates read | Today in the venue zone | Verdict |
|---|---|---|---|
| Promo `/nhl/minnesota-wild/promos/ornament` | Game line "Saturday, Dec 12, 2026 · 2:30 PM CT" (`<time datetime="2026-12-12T14:30:00-06:00">`); JSON-LD Event `startDate` "2026-12-12", status EventScheduled | 2026-11-25 (America/Chicago; the page states CT) | Upcoming, 17 days out. The date tile reads "IN 17 DAYS", which is correct. Same on both hosts. |
| Team `/nhl/minnesota-wild` | JSON-LD Event `startDate` 2026-11-25, 2026-11-27, 2026-12-12, 2026-12-22; list rows Nov 25, Nov 27, Dec 12, Dec 22 | 2026-11-25, 18:04 CST when read | None is before today. Tonight's game (7:00 PM CST) had not started. Not a played-game page. Same four Events on both hosts. |

No played-game defect on either page.

## 3. Things that work

1. **The card is 44px wherever it appears, and is still the same card.** 4 row dialogs, 11 home panels and 4 away panels per width per host, 19 placements, all 44 on the branch and 43 on production. Width (274 dialog and 266 panel at 390; 420 and 628 at 768; 420 and 644 at 1280), border (navy `rgb(0, 60, 113)`), 14px radius, shadow, white fill, `10px 14px` padding, 10px gap, logo box (60x15.94 at x=15), label ("Get Tickets", 14px bold, 72.8x21 at x=85), arrow (15px navy, right-aligned), href, rel, target and accessible name are identical between hosts. The note under it has the same text, font (12px / 16.8px), colour, width and line count, and sits 8px below the card on both.
2. **Logo, label and arrow stay centred.** The offset between each child's vertical centre and the card's vertical centre is 0.00px for all three on both hosts (logo top at 14.03 of 44 on the branch, 13.53 of 43 on production; label 11.5 against 11; arrow 14.5 against 14).
3. **Nothing collides, clips or overflows.** The card and its note are inside their container in every placement; the gap from the note to the next block is unchanged (16px to "Stream the game" in away panels; the note is the last item in home panels and dialogs); the dialog's inner area does not scroll (content 401 of 401 at 390); five-point hit tests on the card (left, top edge, centre, bottom edge, right) all land on the card with it in view, dialog and both panel types, all widths, both hosts. `document.documentElement.scrollWidth > clientWidth` is false at 390, 768 and 1280 on both pages, at rest, with the row dialog open and with a home or away panel open, on both hosts.

Also working: the full-size sidebar card ("Plan your visit") is 342x58 at 390, 720x58 at 768 and 336x58 at 1280 on both hosts, at the same position, with the same note. The game-date check ran and both pages are upcoming. On the promo page the primary "Get Tickets" button (144x52 at 390), Share, the note, "Stream on Fubo" (101x44), Parking, Hotels and "Remind me" have identical boxes and hrefs on both hosts. The primary CTA goes from `ticketnetwork.lusg.net` to `www.ojrq.net` in one hop (302) on both hosts, from both pages. The promo rail card "TUE DEC 22 Nightlight" opens a page whose H1 is "NIGHTLIGHT", and browser back restores the scroll position exactly (1728 to 1728 branch, 1936 to 1936 production). The team row "Ornament" opens a page whose H1 is "ORNAMENT".

## 4. Defects

### Introduced by this branch

None found.

### On production too (not introduced by this branch)

| # | Severity | Page | Width | What I saw | Evidence |
|---|---|---|---|---|---|
| 1 | Medium | Team | 390, 768, 1280 | The row ticket dialog is far taller than what is in it. The dialog box is 717px tall at 390 with 401px of content, 870px with 396px at 768, 680px with 396px at 1280: a blank cream area of 316, 474 and 284px under the card. A fan sees a half-empty sheet. | `minnesota-wild/390-branch-row-dialog.png`, `minnesota-wild/390-production-row-dialog.png`, `minnesota-wild/768-branch-row-dialog.png` |
| 2 | Medium | Team | 390 | The control that opens the dialog is under the tap floor. The row "Tickets" button is 92x27 (4 rows). The card inside is now 44px; the button a fan must hit to reach it is not. | `minnesota-wild/390-branch.png` |
| 3 | Medium | Team | 390 | Other targets under 44x44: calendar day cells 41x41 (30), month arrows 36x36, filter chips 34 tall (5), row share buttons 32x32 (9), menu button 40x40, "Show 3 more completed promos" 288x39, "Show more ticket packages" 294x20. 56 non-inline targets under the floor on the branch, 58 on production. | `minnesota-wild/390-branch.png` |
| 4 | Low | Promo | 390 | Targets under 44x44: breadcrumb links (24x18, 82x18), image share button 40x40, the three text links near the foot (21px tall), menu button 40x40. 9 non-inline, same on both hosts. | `minnesota-wild-ornament/390-branch.png` |
| 5 | Low | Team | 390 | Back navigation drifts. Tap the Ornament row, go back: the scroll position is restored at one second (2934), then ends at 3116, 182px off, and the row moves from y=365 to y=172 in the viewport. Branch 3 of 3 runs; production 1 of 3 runs (held in the other two). Recorded before in `2026-11-25-ticket-partner-test.md`, defect 7. | Scroll positions above |
| 6 | Low | Both | All | The "NIGHT" half of the header wordmark is 4.33:1 (`rgb(218, 45, 32)` on `rgb(247, 243, 234)`, 18px). The only contrast failure on either page; axe reports it as color-contrast, serious. | `minnesota-wild/390-branch.png` |
| 7 | Low | Team | All | axe label-content-name-mismatch, serious: 5 nodes at 390, 15 at 768 and 1280. Calendar day buttons are named "2026-11-01 details" while showing "1"; the SpotHero card is in the same group. | Measurement only |
| 8 | Low | Team | 390, 768, 1280 | The TicketNetwork logo in the compact card is drawn 60x16 from a 64x17 image. The wordmark is about 7px high and hard to read; the card's partner is close to unidentifiable at arm's length. Not changed by the branch (the logo box is the same size on both hosts). | `minnesota-wild/390-branch-row-dialog-card.png`, `minnesota-wild/390-production-row-dialog-card.png` |
| 9 | Low | Team | 390, 768, 1280 | Fixed ad furniture sits over content at the bottom right. At 390 on the branch render the floating video player covers the filter chips from the second one on, above the fold, and, with an away panel open, the right half of the "Find hotels" button; on production the sticky footer banner covers about the bottom 50px. At 768 with an away panel open the player covered the right end of the compact ticket card (the arrow) at one scroll position on both hosts; the card is clear after scrolling. At 1280 the player covers the sidebar ticket card at rest, which is the known issue already ruled on in `docs/known-issues.md`. | `minnesota-wild/390-branch-calendar-away.png`, `minnesota-wild/390-production-calendar-away.png` |

### Observed once, not reproduced

One branch load at 768 (ads blocked) had no row "Tickets" buttons 30 seconds after load. Five other branch loads at 768 in this run rendered all four. I did not find a cause.

### Not covered by this run

- Compact ticket cards that are not on these two pages: the college football schedule modal and school page (`CfbSchedule.tsx`, `CfbSchoolPage.tsx`), the playoff card (`playoffs/tickets.tsx`) and `/promos/today` (inline tiles with their own 40px floor). In the college football modal the ticket card is stacked with compact SpotHero and Expedia cards; I did not measure whether the three still match in height.
- The Ticketmaster and StubHub compact cards. The Wild pages show the TicketNetwork card today, so only that variant was measured.
- Keyboard focus ring on the taller card. Not tested.

## 5. Measurements

Card heights, branch / production, in px. Each cell is every card of that placement at that width.

| Placement | 390 | 768 | 1280 |
|---|---|---|---|
| Row dialog (rows Nov 25, Nov 27, Dec 12, Dec 22) | 44 / 43 | 44 / 43 | 44 / 43 |
| Calendar home panel (Nov 25, 27, Dec 5, 8, 12, 15, 18, 19, 22, 26, 28) | 44 / 43 | 44 / 43 | 44 / 43 |
| Calendar away panel (Nov 29, Dec 1, 3, 10) | 44 / 43 | 44 / 43 | 44 / 43 |
| Card width, row dialog | 274 / 274 | 420 / 420 | 420 / 420 |
| Card width, calendar panel | 266 / 266 | 628 / 628 | 644 / 644 |
| Full-size sidebar card, team page | 342x58 / 342x58 | 720x58 / 720x58 | 336x58 / 336x58 |
| Promo page primary Get Tickets (not a compact card) | 144x52 / 144x52 | same box on both hosts | same box on both hosts |

Step 2 measurements.

| Measurement | Team, branch | Team, production | Promo, branch | Promo, production |
|---|---|---|---|---|
| HTTP status | 200 | 200 | 200 | 200 |
| Horizontal overflow at 390 (rest, dialog open, panel open) | none | none | none (rest) | none (rest) |
| Horizontal overflow at 768 and 1280 | none | none | none | none |
| Interactive elements at 390 | 112 | 114 | 52 | 53 |
| Under 44x44 at 390, non-ad (of which not inline text links) | 85 (56) | 87 (58) | 36 (9) | 36 (9) |
| Contrast failures under 4.5:1 (text nodes checked at 390) | 1 of 308: "NIGHT" 4.33:1 | 1 of 310: "NIGHT" 4.33:1 | 1 of 118: "NIGHT" 4.33:1 | 1 of 118: "NIGHT" 4.33:1 |
| axe serious and critical, 390 | color-contrast (1), label-content-name-mismatch (5) | same | color-contrast (1) | color-contrast (2), button-name (1), image-alt (1), label (1), link-name (1); all but the wordmark are inside ad creative |
| axe serious and critical, 768 and 1280 | color-contrast (1), label-content-name-mismatch (15) | same | color-contrast (1) | color-contrast (1) |
| Cumulative layout shift during load, 390 / 768 / 1280 | 0 / 0 / 0 | 0 / 0.001 / 0.030 | 0.0001 / 0.0002 / 0.0002 | 0.011 / 0.031 / 0.030 |
| Links to `/promos/` in the DOM / visible, 390 | 37 / 26 | 37 / 26 | 16 / 14 | 16 / 14 |
| Top of document to first ad anchor, 390 | 672px | 672px | 57px | 57px |
| Document height at 390, ads live | 12,514 | 12,610 | 4,798 | 5,139 |
| Document height at 390, ads blocked | 10,780 | 10,876 (10,780 with the two eBay links hidden) | 3,557 | 3,557 |

What a first-time visitor sees at 390. Team page: the header, a dark hero with "Minnesota Wild", "Promos & Giveaways 2026-27", the arena name and five count tiles (6 giveaways, 84 scheduled games), then "Still to come", filter chips and the top of the November calendar at the fold; first scroll shows the calendar with home, away and promo dots and its legend; second scroll shows "Plan your visit" with the full-size ticket card, its note, parking, hotels and gear cards, then the bag policy, rideshare and parking facts and the "Upcoming promos" rows with their "Tickets" buttons. Promo page: breadcrumb, a "Giveaway" tag, "Ornament", "Minnesota Wild vs Jets", the date and time in bold, the venue link, a date tile reading "In 17 days", then Get Tickets, Share, the note, "Stream on Fubo", Parking, Hotels and "Remind me", all above the fold with the top of the ornament image; the next scrolls show "About this giveaway", "This game" with its timeline, and "Before you go". At 768 and 1280 the same content is laid out wider; at 1280 the team page puts "Plan your visit" in a right-hand column beside the calendar.

## 6. Recommendation

Merge the height change as it stands; it is clean. The next thing worth fixing on this surface is the way in: the row "Tickets" button is 27px tall and opens a dialog that is half blank (defects 1 and 2), so the 44px card sits behind a smaller target than the one it replaced as the problem.

## Dispositions (added by the build session, 2026-11-25)

No defect is introduced by this branch. Every defect listed is on production too; each is deferred with a known-issues entry or waived with its reason.

| # | Disposition | Reason |
|---|---|---|
| 1 | Deferred, known-issues 135 | The row ticket dialog is about twice as tall as its content. Outside this branch's ruled scope (the 44px floor alone, no other layout change). |
| 2 | Deferred, known-issues 135 | The row "Tickets" button is 92x27 at 390. Same scope limit. |
| 3 | Deferred, known-issues 135 | Other team page targets under 44x44 at 390 (day cells, month arrows, chips, share, menu). |
| 4 | Deferred, known-issues 135 | Promo page targets under 44x44 at 390. |
| 5 | Waived | Already recorded (known-issues, the 182px back-navigation drift from the promo archive review, and defect 7 of the ticket partner test review). Not touched here. |
| 6 | Waived | Header wordmark contrast, 4.33:1; a brand colour question that predates this branch. |
| 7 | Waived | axe name mismatch on calendar day buttons; predates this branch and is not on a ticket control. |
| 8 | Deferred, known-issues 135 | The TicketNetwork logo is hard to read at 60x16 in the compact card. |
| 9 | Covered by known-issues 134 | The floating video player; ruled 2026-11-25 (Raptive is asked to move it; fallback at the 2026-12-25 flip). |

The two eBay resale links missing from the branch render are an environment difference (the eBay credentials are not in the local env); they are not part of this change. The one load without row "Tickets" buttons was not reproduced in five further loads and is noted in known-issues 135. The compact Ticketmaster and StubHub cards share the one class string and are covered by the unit test added with this change.

