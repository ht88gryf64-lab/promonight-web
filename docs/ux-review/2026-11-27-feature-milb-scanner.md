# UX review: feature/milb-scanner (2026-11-27)

Run 2026-11-27, about 12:10 to 12:35 America/New_York.

- **Branch under review:** `feature/milb-scanner` at `5cf56e6`, three commits on `5ddf0f6`.
- **BRANCH server:** http://127.0.0.1:3100. It serves the branch as committed, with the MiLB gate shut. As a dev server it has no `promonight-deploy` meta (`b:"development"` in the flight payload).
- **PREVIEW server:** http://127.0.0.1:3101. It serves the same commit plus an uncommitted local fixture that opens the gate and adds one MILB team doc. It has no deploy meta, and production has no version of its pages.
- **Production:** https://www.getpromonight.com, `<meta name="promonight-deploy" content="dpl_8LRaVG3cjoLEp4XWmSQo2i3KGWDP">`. `vercel inspect` gives target production, githubCommitSha `5ddf0f6feaeaf80a8cc0b440aa45e86b1d948f0c`. That is main, and it is the branch's merge base.

**How the renders were made.** Playwright Chromium used a desktop Chrome UA at 390x844, 768x1024 and 1280x800 with deviceScaleFactor 1. Each page was rendered twice per environment and viewport:
- `<vp>-<env>.png` loads ads as a fan sees them. The measurements come from this render.
- `<vp>-<env>-noads.png` blocks every request that is not same-origin, so Raptive slots stay empty. The pixel diff `<vp>-diff.png` compares the two noads renders, which keeps ad fill out of the comparison.

Before each screenshot the script scrolled the page to the bottom and back, so lazy content mounts. It also removed the Next dev-tools badge (`nextjs-portal`). Scripts are in the session scratchpad, outside the repo.

---

## 1. /mlb/minnesota-twins (baseline mode, BRANCH vs production)

### Baseline differences

**Head metadata.** Title, description, canonical, OG tags and robots are identical: 21 tags, no diff, and no robots key on either side.

**Main content HTML.** The `<main>` and first `<article>` were stripped of scripts, nonces, `/_next/static` hashes, deploy meta and Suspense markers. They are **not identical**. There is one differing region:

- The "Plan your visit" Ticketmaster `Get Tickets` link (`aria-label="Ticketmaster Get Tickets"`). The text is identical; only the href differs:
  - Branch: `https://www.ticketmaster.com/minnesota-twins-tickets/artist/805972`, a direct link with no affiliate wrapper.
  - Production: `https://ticketmaster.evyy.net/c/7236189/264167/4272?u=...805972&sharedid=web_team_page_minnesota-twins`, the Impact-wrapped link.

**Outside main.** The header nav item **Events** (1280) and the footer Discover link **Events** (all viewports) appear on production and not on the branch. `GET /events` answers 404 on the branch server and 200 on production.

**Pixel comparison (noads renders):**

| Viewport | Differing px | Share | Height branch / prod | Where |
|---|---|---|---|---|
| 390 | 17,336 | 0.30% | 14,810 / 14,844 | Only rows 14,302 and below: the footer Discover list, where Events is missing on the branch. Every row above is identical. The 508 rows below the gap are identical once shifted 34px. |
| 768 | 28,769 | 0.35% | 10,584 / 10,618 | Only rows 10,293 and below: the footer, same cause. |
| 1280 | 46,826 | 0.44% | 8,207 / 8,241 | Rows 22-32 (the header nav is missing Events) and rows 7,940 and below (the footer). |

Diff images: [390](2026-11-27-feature-milb-scanner/mlb-minnesota-twins/390-diff.png), [768](2026-11-27-feature-milb-scanner/mlb-minnesota-twins/768-diff.png), [1280](2026-11-27-feature-milb-scanner/mlb-minnesota-twins/1280-diff.png).

**Measurements that moved between the two renders:**
- Document height: -34px at every viewport, from the missing footer Events link.
- Visible interactive elements: 71 vs 72 at 390 noads, 76 vs 78 at 1280. The missing items are the Events links.
- Targets under 44px: 38 vs 39 at 390 noads.
- CLS with ads at 1280: 0.0064 vs 0.0364. Both are 0 with ads blocked, so this is ad fill, not the page.

Nothing else moved:
- Contrast failures, 3 and 3.
- axe results.
- /promos/ links, 20 in the DOM and 18 visible.
- First ad anchor, 706px.
- Back-scroll error, 2,324px.

**Verdict on the owner's criterion.** No difference falls in code the branch touches. The branch diff changes `team.league` to `leagueLabel(team.league)` in the hero eyebrow and its hub link. Those bytes ("MLB", `aria-label="MLB promotions and giveaways hub"`) are identical on both sides.

Every difference above sits in code the diff does not touch:
- the events nav and footer
- the Impact wrapping of Ticketmaster links

Both look like the dev server running under a different configuration from production. I could not tell which setting is involved and did not look.

This is a finding. The baseline is not clean, so this run alone cannot certify "zero visible change". It certifies zero change in every region the diff reaches.

### Game date check

- **JSON-LD:** no Event objects; the blocks are WebPage and FAQPage only.
- **Game line and schedule:** the 2026 regular season, March to September 2026. The last game on the page is Sep 27, 2026. The promos section is "COMPLETED 2026 PROMOS, 145 completed events this season".
- **Today in the venue zone:** 2026-11-27. The zone is America/Chicago, because the page states Target Field.
- **Verdict:** every date is before today. **This is a played-games page, reported as defect 1.**

### Three things that work

1. **The page shows its played state.** Promo rows carry a "Completed" tag, the section is headed "COMPLETED 2026 PROMOS", and the hero reads "145 promotions in the 2026 season". This is listed here so the record shows the game date check ran.
2. **The primary CTA works.** "ticketmaster Get Tickets" opens https://www.ticketmaster.com/minnesota-twins-tickets/artist/805972 with no redirect; host www.ticketmaster.com; title "Minnesota Twins Tickets | 2026-2027 MLB Tickets & Schedule".
3. **The rail card lands correctly.** "Bobblehead nights" in the Explore rail goes to /promos/bobbleheads, whose H1 is "UPCOMING BOBBLEHEADS".

### Defects

1. **Played games, all viewports.** Every game on the page is before today. For those played games the page still offers:
   - Ticketmaster and TicketNetwork "Get Tickets" (team-level pages, which do sell 2027)
   - SpotHero "Reserve Parking"
   - Expedia "Find hotels near Target Field"
   - the app reminder card ("A reminder the morning of every bobblehead night...")

   Nothing on the page says when the 2027 schedule or promos arrive. This is pre-existing; production is identical. [390-branch.png](2026-11-27-feature-milb-scanner/mlb-minnesota-twins/390-branch.png)
2. **Back navigation does not restore scroll, 390.** Scroll was 10,701 before tapping the rail card and 13,025 after Back, an error of 2,324px. Production is identical (2,324). Pre-existing.
3. **Targets under 44x44 at 390:**
   - Open menu: 40x40.
   - Logo: 132x17.
   - Eyebrow hub link "MLB": 28x12.
   - Source links "mlb.com ›": 50x12 (4 of them) and 50x18 (2).
   - Division "Star" buttons: 28x28 (4).
   - Row "Share" buttons: 32x32 (5).
   - Newsletter link: 266x20.
   - 21 footer links (including the two legal links): 15px tall.

   Pre-existing. [390-branch.png](2026-11-27-feature-milb-scanner/mlb-minnesota-twins/390-branch.png)
4. **Contrast below 4.5:1, all viewports:**
   - "NIGHT" in the logo: 4.33:1, #da2d20 on #f7f3ea at 18px/800. This is not large text. axe also reports it as serious.
   - The hotel card arrow "→": 2.72:1, #a78bfa on white.
   - The gameday-guide chevron "›": 3.14:1, #9a9081 on white.

   Pre-existing.
5. **axe `label-content-name-mismatch` (serious), all viewports.** The SpotHero link's accessible name is "Reserve parking on SpotHero", but it shows "SpotHero Reserve Parking". Pre-existing.
6. **Branch only, environment (not the diff), all viewports.** The Ticketmaster link is unwrapped (direct ticketmaster.com) and the Events nav/footer links are absent. See the baseline above. [1280-diff.png](2026-11-27-feature-milb-scanner/mlb-minnesota-twins/1280-diff.png)

### What a first-time visitor sees (390, branch)

- **Above the fold:** the cream header, then a navy hero:
  - eyebrow "MLB · AL CENTRAL"
  - H1 "MINNESOTA TWINS"
  - "Promos & Giveaways 2026"
  - pin "Target Field"
  - five tiles: 39 giveaways, 36 theme nights, 56 food deals, 14 kids & family, 162 games
  - "145 promotions in the 2026 season"
- **First scroll:** "2026 SEASON / Minnesota Twins 2026 Game Schedule", with closed month accordions (March to September 2026) interleaved with ad slots.
- **Second scroll:** the September accordion, then "Around the division".
- **What is missing:** nothing in the first two scrolls says the season is over or what comes next.

---

## 2. /nhl/minnesota-wild (baseline mode, BRANCH vs production; standard team sample)

### Baseline differences

**Head metadata.** Identical: 21 tags, no diff.

**Main content HTML.** Not identical. The differing regions, with their text:

1. **The "Plan your visit" ticket box.**
   - Branch:
     - Ticketmaster "Get Tickets" (direct `ticketmaster.com/minnesota-wild-tickets/artist/805974`)
     - TicketNetwork "Get Tickets" (performer page `/e/performers/minnesota-wild-tickets`)
     - the note "TicketNetwork is a resale marketplace. Prices may differ from face value."
   - Production:
     - a wrapper `data-ticket-test="a"`
     - TicketNetwork "Get Tickets" only, linking to tonight's event (`/tickets/8139701/minnesota-wild-vs-colorado-avalanche-tickets-fri-nov-27-2026-grand-casino-arena`)
     - the note "PromoNight may earn a commission on ticket purchases. Resale prices may differ from face value."
2. **The same swap in the 9 per-game ticket sheets** (`flex w-full flex-col gap-2` blocks). Each shows Ticketmaster + TicketNetwork + the resale note on the branch, and TicketNetwork only + the commission note on production.
3. **Two "Missed it? Check resale on eBay" links** under past rows appear on production and not on the branch. They are under "2026 Wild Kirill Kaprizov & T-shirt bobblehead" and "2025 Wild Jared Spurgeon & Scarf bobblehead".
4. **The disclosure paragraph at the foot of main.** The branch adds "Tickets on TicketNetwork are resold by other sellers, so a price there can be above or below face value."

**Outside main.** The Events nav and footer links are missing on the branch, as on the Twins page.

**Pixel comparison (noads):**

| Viewport | Differing px | Share | Height branch / prod | Where |
|---|---|---|---|---|
| 390 | 323,777 | 7.84% | 10,575 / 10,587 | Rows from 1,275 down. The ticket box has two buttons on the branch and one on production, so everything below shifts. The eBay links and the footer come later. |
| 768 | 334,099 | 5.21% | 8,345 / 8,357 | From row 1,450, same cause. |
| 1280 | 440,071 | 5.05% | 6,733 / 6,815 | Rows 22-32 (the header Events item), and from row 571 (the ticket box in the right column). |

Diff images: [390](2026-11-27-feature-milb-scanner/nhl-minnesota-wild/390-diff.png), [768](2026-11-27-feature-milb-scanner/nhl-minnesota-wild/768-diff.png), [1280](2026-11-27-feature-milb-scanner/nhl-minnesota-wild/1280-diff.png). Side by side at 390: [branch](2026-11-27-feature-milb-scanner/nhl-minnesota-wild/390-branch-noads.png) vs [production](2026-11-27-feature-milb-scanner/nhl-minnesota-wild/390-production-noads.png).

**Measurements that moved:**
- Document height: -12px at 390 and 768, -82px at 1280.
- Visible interactive elements: 106 vs 108 at 390 noads.
- Targets under 44px: 82 vs 85 at 390 noads.
- Contrast elements checked: 260 vs 259. Failures are 3 and 3.
- CLS with ads: 0 vs 0.0003 at 390, 0 vs 0.0008 at 1280. Both are 0 with ads blocked.

Nothing else moved:
- /promos/ links, 36 in the DOM and 25 visible.
- First ad anchor, 672px.
- axe, `color-contrast` 1 and `label-content-name-mismatch` 5.
- Back-scroll error, 723 vs 722.

**Verdict.** As with the Twins: the diff's own output, the eyebrow "NHL · CENTRAL" and the hub link aria-label, is byte-identical. Every difference sits in code the diff does not touch:
- the ticket test arm
- the eBay past-promo links
- Impact wrapping
- the events flag

They look like configuration differences between the dev server and production. I could not tell which and did not look. The baseline is not clean; that is a finding.

### Game date check

- **JSON-LD Event `startDate`s:**
  - 2026-11-27, Hometown Remix Jersey Towel
  - 2026-12-12, Ornament
  - 2026-12-22, Nightlight
- **Game line:** today's row reads "FRIDAY, NOVEMBER 27 HOME GAME vs Colorado Avalanche 3:00 PM CST".
- **Today in the venue zone:** 2026-11-27. The zone is America/Chicago (Grand Casino Arena, St Paul, and the page says CST), and it was 11:31 CST at the check.
- **Verdict:** not played. One game is today, still about 3.5 hours away, and two are upcoming.

### Three things that work

1. **Date, time and venue are easy to find.** The hero pin says "Grand Casino Arena", the calendar marks today (27) as a home giveaway night, and the row's ticket sheet gives the start time with its zone: "3:00 PM CST".
2. **The primary CTA works.** "ticketmaster Get Tickets" opens https://www.ticketmaster.com/minnesota-wild-tickets/artist/805974 with no redirect; host www.ticketmaster.com; title "Minnesota Wild Tickets | 2026-2027 NHL Tickets & Schedule".
3. **The rail card lands correctly.** "Bobblehead nights" goes to /promos/bobbleheads, whose H1 is "UPCOMING BOBBLEHEADS".

### Defects

1. **Back navigation does not restore scroll, 390.** 6,591 before, 7,314 after Back: a 723px error. Production is 722. Pre-existing. [390-branch.png](2026-11-27-feature-milb-scanner/nhl-minnesota-wild/390-branch.png)
2. **Targets under 44x44 at 390** (82 in total; all pre-existing):
   - The 30 calendar day buttons: 41x41.
   - Previous/next month: 36x36.
   - Five filter chips: 34px tall.
   - Source links "grandcasinoarena.com ›": 123x12 (3) and 123x18 (1).
   - "Official bag policy ›": 96x12.
   - Row "TICKETS": 92x27 (3).
   - Row "Share": 32x32 (8).
   - "Show 9 more ticket packages": 294x20.
   - Ticket-package inline links: 17px tall.
   - Eyebrow "NHL" link: 27x12.
   - Open menu: 40x40.
   - The footer links.
3. **Near-empty hero and chips, all viewports.** Three of the four category tiles read 0 (Theme Nights, Food Deals, Kids & Family). The filter row offers chips for them anyway: "Theme Nights 0", "Food Deals 0", "Kids & Family 0". Pre-existing.
4. **Contrast below 4.5:1.** The same three as on the Twins page: "NIGHT" at 4.33, the hotel arrow at 2.72, the chevron at 3.14. Pre-existing.
5. **axe `label-content-name-mismatch` (serious).** 5 at 390 and 15 at 768/1280:
   - the SpotHero link
   - calendar day buttons named "2026-11-01 details" while they show "1"

   Pre-existing.
6. **Branch only, environment (not the diff), all viewports.** Ticket-box, eBay and Events differences; see the baseline above. [390-diff.png](2026-11-27-feature-milb-scanner/nhl-minnesota-wild/390-diff.png)

### What a first-time visitor sees (390, branch)

- **Above the fold:** a dark green hero:
  - eyebrow "NHL · CENTRAL"
  - H1 "MINNESOTA WILD"
  - "Promos & Giveaways 2026-27"
  - pin "Grand Casino Arena"
  - tiles: 6 giveaways, 0, 0, 0, 84 scheduled games
  - "6 promotions in the 2026-27 season, 3 still to come"
  - the "STILL TO COME" filter chips
- **First scroll:** the November 2026 calendar, then an ad player, then "PLAN YOUR VISIT":
  - Ticketmaster, TicketNetwork, SpotHero, Expedia
- **Second scroll:**
  - Fanatics
  - Full gameday guide
  - "Game day at Grand Casino Arena": bag policy, rideshare, parking, each with a sourced link

---

## 2b. Gate check (BRANCH server)

http://127.0.0.1:3100/milb/hudson-valley-renegades answers **404**. Screenshot: [390-branch-404.png](2026-11-27-feature-milb-scanner/milb-hudson-valley-renegades/390-branch-404.png).

- **What the fan sees:** H1 "TEAM NOT FOUND", "Browse all teams" and "Home". The footer says "169 teams in MLB, NBA, NFL, NHL, MLS, and WNBA", with no MiLB.
- **Robots:** `<meta name="robots" content="noindex">`.
- **Name leak:** the team name appears in the 404 HTML only as the echoed route params (`sport: milb, team: hudson-valley-renegades`). No team doc field is in the payload.
- **Sitemap:** `/sitemap.xml` on the branch server holds 0 `/milb/` URLs.
- **Teams page:** `/teams` on the branch server shows "All (169)".
- **Production:** the same path is 404 too.

**Gate: shut, as intended.**

---

## 3. /milb/hudson-valley-renegades (full review, PREVIEW server)

**No baseline exists.** The page renders only on the PREVIEW server, from an uncommitted fixture. Production and the branch server both answer 404. Every finding below is about the branch code rendering that fixture. Where a finding follows from the fixture's data (no venue doc, no ticket URLs, placeholder colors), I say so. I cannot tell how a real MILB doc would render.

### Every place the visible page shows the league

| Where | DOM text | On screen | Reads "MILB"? |
|---|---|---|---|
| Hero eyebrow, `<p>` above the H1 (390 y=121, 1280 y=137) | `MiLB` · South Atlantic League North | **"MILB · SOUTH ATLANTIC LEAGUE NORTH"** | **Yes.** The eyebrow has `text-transform: uppercase`, so `leagueLabel()` returns "MiLB" and CSS turns it into "MILB". The 768 view is the same. It is the only place the page shows the league as a label, and it is above the fold at every viewport. It is plain text, not a link: there is no MiLB hub. |
| Explore rail item | All MiLB teams | All MiLB teams | No |
| FAQ "How can I track..." answer | ...and 169 other teams across MLB, NBA, NFL, NHL, MLS, WNBA, and MiLB... | same | No |
| FAQ "Does PromoNight work for away games?" answer | ...170 teams across MLB, NBA, NFL, NHL, MLS, WNBA, and MiLB... | same | No |
| Footer tagline | ...for 170 teams in MLB, NBA, NFL, NHL, MLS, WNBA, and MiLB, from official team sources. | same | No |

Not visible: the rail link href `/teams?league=MILB` keeps the code, and the URL path `/milb/`. The title, meta description and OG tags never name the league.

### Game date check

- **Game line:** the cards read MAY 21 FRI, JUN 23 WED, JUL 10 SAT, AUG 10 TUE. No year is shown on the cards; the section is headed "2027 SEASON PROMOS".
- **JSON-LD Event `startDate`s:** 2027-05-21, 2027-06-23, 2027-07-10, 2027-08-10. All four weekdays match the calendar.
- **Venue zone:** the page states no building, so America/New_York. Today there is 2026-11-27.
- **Verdict:** every date is upcoming, 175 to 256 days out. Not played.

### Three things that work

1. **The gate works both ways.** With the gate shut (branch) the page is 404, noindex, and absent from the sitemap and /teams. With it open (preview) the page is 200, indexable (no robots key, 4 upcoming promos), and listed in the preview sitemap.
2. **The four promos are correct, upcoming 2027 dates with the right weekdays and opponents:**
   - Wilmington Blue Rocks
   - Bowling Green Hot Rods
   - Frederick Keys
   - Jersey Shore BlueClaws

   The hero counts them correctly: "4 promotions announced so far for the 2027 season". The prose writes the league as "MiLB" everywhere it appears: rail, two FAQ answers, footer.
3. **The rail and Back work.** "Bobblehead nights" goes to /promos/bobbleheads, whose H1 is "UPCOMING BOBBLEHEADS". Back restores scroll exactly (2,986 to 2,986). CLS is 0 at all three viewports.

### Defects

1. **The league reads "MILB" on screen, 390 / 768 / 1280.** The hero eyebrow shows "MILB · SOUTH ATLANTIC LEAGUE NORTH". The DOM holds "MiLB", but the eyebrow's `text-transform: uppercase` renders it in capitals. This is the one league label on the page, it is above the fold, and it defeats the purpose of `leagueLabel`. [390-preview.png](2026-11-27-feature-milb-scanner/milb-hudson-valley-renegades/390-preview.png), [768-preview.png](2026-11-27-feature-milb-scanner/milb-hudson-valley-renegades/768-preview.png), [1280-preview.png](2026-11-27-feature-milb-scanner/milb-hudson-valley-renegades/1280-preview.png)
2. **The primary CTA lands on a Ticketmaster 404, all viewports.** "ticketmaster Get Tickets" goes to `https://www.ticketmaster.com/hudson-valley-renegades-tickets`, host www.ticketmaster.com, HTTP 404. The page says "The page you requested could not be found."
   - The same URL is the Ticketmaster button in all 4 per-promo Tickets sheets, so 5 dead links in all. [390-preview-tickets-sheet.png](2026-11-27-feature-milb-scanner/milb-hudson-valley-renegades/390-preview-tickets-sheet.png)
   - The second CTA works but goes through an extra host: TicketNetwork redirects from `ticketnetwork.lusg.net` (302) to `www.ojrq.net` (Impact). Its target, `ticketnetwork.com/performers/hudson-valley-renegades-tickets`, answers 200 with the title "Hudson Valley Renegades Tickets 2026".
   - The fixture team doc carries no ticket URLs, so this is a guessed slug. I cannot tell what a real doc would carry.
3. **The venue is missing from the page, all viewports.**
   - The hero has no pin line; Twins and Wild show their building there.
   - There is no "Game day at" block.
   - The page says "their home stadium" eight times, in the theme-night section and the FAQ.
   - The FAQ answer "How do I get to their home stadium?" opens in lower case: "**their home stadium is in Hudson Valley.**" Hudson Valley is a region, not a place a fan can travel to.
   - The same answer says "Most major-league venues are served by bus or rail routes on game day", which is the wrong class of club for a minor-league team.
   - "Several hotels sit within walking distance of their home stadium" has no venue behind it, so nothing supports the claim.
   - The cause is the fixture having no venue doc, but this is what any MILB club without a venue doc will show. [390-preview.png](2026-11-27-feature-milb-scanner/milb-hudson-valley-renegades/390-preview.png), sixth and seventh screens.
4. **Parking and hotel CTAs have no place, all viewports.**
   - SpotHero "Reserve Parking" goes to `spothero.com/`, the home page with no location.
   - Expedia "Find hotels near Hudson Valley Renegades" searches for the destination "Hudson Valley Renegades, Hudson Valley", which is a team name, not a place.
5. **No game time anywhere, all viewports.** The cards and the ticket sheet give only the weekday and date ("FRIDAY, MAY 21"). The Wild sheet shows "3:00 PM CST" in the same spot. A fan cannot find first pitch on this page.
6. **"All MiLB teams" leads to a page with no MiLB teams, 390.** The rail item goes to `/teams?league=MILB`. That page:
   - has no MiLB filter (All (170), MLB 30, NBA 30, NFL 32, NHL 32, MLS 30, WNBA 15, CFB)
   - opens on "All (170)"
   - renders 169 team links, without the Renegades

   A fan who taps "All MiLB teams" finds no MiLB club, not even the one they came from, and the count says 170 while 169 are shown.
7. **A section restates the cards, 390.** "What are the best Renegades theme nights in 2027?" repeats the four promos shown just above, twice:
   - a "Next up" sentence naming three of them
   - a "Still to come" list of all four

   All four are titled "Hudson Valley Mountain Gnomes", so a fan reads that name 11 times before the FAQ. The meta description also repeats it twice: "May 21 - Hudson Valley Mountain Gnomes, Jun 23 - Hudson Valley Mountain Gnomes". [390-preview.png](2026-11-27-feature-milb-scanner/milb-hudson-valley-renegades/390-preview.png), fifth and sixth screens.
8. **The hero is near-empty, all viewports.** Three of the four tiles read 0 (Giveaways, Food Deals, Kids & Family). For a club whose only promos are theme nights, most of the hero is zeros.
9. **Unverified app claims, all viewports.** I could not verify that the PromoNight app carries MiLB clubs. If it does not, both of these are false:
   - the card "Get alerts for Hudson Valley Renegades promos... A reminder the morning of every bobblehead night"
   - the FAQ answer "The free PromoNight app reminds you on the morning of each Renegades promo game"
10. **Structured data has no location (not visible).** The four Event objects carry name, startDate, description and organizer, and no `location`. The Wild Events carry a `Place` with an address. All four Event names are identical.
11. **Targets under 44x44 at 390:**
   - Row Share: 32x32 (4).
   - Row TICKETS: 92x27 (4).
   - Open menu: 40x40.
   - Logo: 132x17.
   - Newsletter link: 266x20.
   - 21 footer links (including the two legal links): 15px tall.

   These are shared components, pre-existing elsewhere.
12. **Contrast below 4.5:1.** Logo "NIGHT" at 4.33:1 (axe serious) and the hotel arrow "→" at 2.72:1. Pre-existing components.
13. **axe `label-content-name-mismatch` (serious).** The SpotHero link, as on the other pages.
14. **The Raptive video player covers ticket buttons above the fold.** At 390 the floating player covers the right half of the TicketNetwork "Get Tickets" button. At 1280 it covers the Ticketmaster and TicketNetwork buttons in the right column. This is ad behaviour seen on all pages, not this diff; it is listed because it covers the primary CTA on first view. [1280-preview.png](2026-11-27-feature-milb-scanner/milb-hudson-valley-renegades/1280-preview.png)

### What a first-time visitor sees

- **390, above the fold:**
  - a near-black hero (the fixture's placeholder colors) with eyebrow "MILB · SOUTH ATLANTIC LEAGUE NORTH"
  - H1 "HUDSON VALLEY RENEGADES" and "Promos & Giveaways 2027"
  - no venue line
  - four tiles reading 0 / 4 / 0 / 0
  - "4 promotions announced so far for the 2027 season"
  - "PLAN YOUR VISIT" with Ticketmaster and TicketNetwork buttons, the second half covered by the floating video player
- **390, first scroll:**
  - SpotHero and Expedia ("Find hotels near Hudson Valley Renegades")
  - "COMING UP / 2027 SEASON PROMOS"
  - the May 21 and Jun 23 cards ("Hudson Valley Mountain Gnomes", "VS WILMINGTON BLUE ROCKS", a TICKETS pill)
- **390, second scroll:**
  - the Jul 10 card
  - the app card "Get alerts for Hudson Valley Renegades promos"
  - the Aug 10 card
- **1280:**
  - the hero spans the width, with the H1 on one line
  - promos on the left
  - "Plan your visit" and "More to dig into" in the right column

---

## Measurements

### /mlb/minnesota-twins (ads-on renders unless noted)

| Measure | 390 branch | 390 production | 768 branch | 768 production | 1280 branch | 1280 production |
|---|---|---|---|---|---|---|
| HTTP status | 200 | 200 | 200 | 200 | 200 | 200 |
| Document height (noads) | 14,810 | 14,844 | 10,584 | 10,618 | 8,207 | 8,241 |
| Visible interactive elements | 73 | 74 | 78 | 79 | 78 | 80 |
| Targets under 44x44 | 40 | 41 | 46 | 47 | 46 | 48 |
| Text below 4.5:1 (of checked) | 3 / 271 | 3 / 271 | 3 / 277 | 3 / 277 | 3 / 277 | 3 / 278 |
| axe serious/critical | color-contrast 1, label-content-name-mismatch 1 | same | same | same | same | same |
| CLS (ads on / noads) | 0 / 0 | 0 / 0 | 0.0371 / 0 | 0.0371 / 0 | 0.0064 / 0 | 0.0364 / 0 |
| /promos/ links DOM / visible | 20 / 18 | 20 / 18 | 20 / 19 | 20 / 19 | 20 / 19 | 20 / 19 |
| First ad anchor (top, px) | 706 (`data-ad-region=content`, in article) | 706 | 599 | 599 | 520 | 520 |
| Back-scroll error at 390 | 2,324px | 2,324px | | | | |
| Pixel diff (noads) | 17,336 px (0.30%) | | 28,769 px (0.35%) | | 46,826 px (0.44%) | |

### /nhl/minnesota-wild

| Measure | 390 branch | 390 production | 768 branch | 768 production | 1280 branch | 1280 production |
|---|---|---|---|---|---|---|
| HTTP status | 200 | 200 | 200 | 200 | 200 | 200 |
| Document height (noads) | 10,575 | 10,587 | 8,345 | 8,357 | 6,733 | 6,815 |
| Visible interactive elements | 108 | 110 | 113 | 115 | 113 | 117 |
| Targets under 44x44 | 84 | 87 | 59 | 62 | 59 | 64 |
| Text below 4.5:1 (of checked) | 3 / 264 | 3 / 263 | 3 / 284 | 3 / 283 | 3 / 284 | 3 / 284 |
| axe serious/critical | color-contrast 1, label-content-name-mismatch 5 | same | color-contrast 1, label-content-name-mismatch 15 | same | same | same |
| CLS (ads on / noads) | 0 / 0 | 0.0003 / 0 | 0 / 0 | 0.0010 / 0 | 0 / 0 | 0.0008 / 0 |
| /promos/ links DOM / visible | 36 / 25 | 36 / 25 | 36 / 26 | 36 / 26 | 36 / 26 | 36 / 26 |
| First ad anchor (top, px) | 672 (`data-ad-region=content`, in article) | 672 | 599 | 599 | 520 | 520 |
| Back-scroll error at 390 | 723px | 722px | | | | |
| Pixel diff (noads) | 323,777 px (7.84%) | | 334,099 px (5.21%) | | 440,071 px (5.05%) | |

### /milb/hudson-valley-renegades (PREVIEW only; no baseline)

| Measure | 390 | 768 | 1280 |
|---|---|---|---|
| HTTP status (preview / branch / production) | 200 / 404 / 404 | 200 | 200 |
| Document height | 8,768 | 6,547 | 5,944 |
| Visible interactive elements | 45 | 50 | 50 |
| Targets under 44x44 | 32 | 37 | 37 |
| Text below 4.5:1 (of checked) | 2 / 111 | 2 / 117 | 2 / 117 |
| axe serious/critical | color-contrast 1, label-content-name-mismatch 1 | same | same |
| CLS | 0 | 0 | 0 |
| /promos/ links DOM / visible | 14 / 12 | 14 / 13 | 14 / 13 |
| First ad anchor (top, px) | 566 (`data-ad-region=content`, in article) | 517 | 492 |
| Back-scroll error at 390 | 0px | | |
| Visible "MILB" | hero eyebrow | hero eyebrow | hero eyebrow |

---

## Recommendation

Keep the MiLB gate shut until the hero eyebrow reads "MiLB" on screen and "Get Tickets" lands on a live Ticketmaster page. Those are the first two things a fan sees on every MiLB page, and today one shows the spelling this branch exists to prevent and the other is a 404.

For the owner's existing-league criterion: the diff's own output is byte-identical on /mlb/minnesota-twins and /nhl/minnesota-wild. The rendered baseline is not clean, because of the dev server's configuration (events flag, ticket test, eBay links, Impact wrapping). Certifying "zero visible change" by rendering needs a comparison where only the code differs.

---

## Dispositions (session, 2026-11-27, after the run)

Every defect is fixed, deferred with a known-issues entry, or waived with a reason (CLAUDE.md merge rules).

### Baseline on existing leagues: closed by a same-configuration comparison

The run above compared the branch dev server with production and could not certify zero visible change: every difference sat in code the diff does not touch and tracked configuration (Impact wrapping of Ticketmaster links, the events flag, the ticket-test arm). The comparison was re-run branch against main under ONE configuration: the branch dev server (127.0.0.1:3100, 5cf56e6 plus the LeagueName fix below) and a main dev server (127.0.0.1:3102, origin/main 5ddf0f6) started from the same env, served HTML with scripts, `<link>` tags, `/_next/` asset paths and dev-only attributes stripped. Result: **0 differing lines** on all seven pages read: /mlb/minnesota-twins, /nhl/minnesota-wild, /teams, /promos/this-week, /team-rankings, /best-promos and /. The rendered hero eyebrow (innerText, which applies CSS text-transform) reads "MLB · AL CENTRAL" on both. Zero visible change on existing leagues.

### MiLB page (preview fixture, gate open in the local fake only)

| # | Defect | Disposition |
|---|---|---|
| 1 | Hero eyebrow renders "MILB" under `text-transform: uppercase` | **Fixed** (`src/components/LeagueName.tsx`: a mixed-case label is wrapped in `normal-case`; every all-caps label renders as plain text, byte-identical). Applied at every JSX league render, the `/teams` filter pill and the promo-page cross-team heading. Verified in a browser: the eyebrow's innerText now reads "MiLB · SOUTH ATLANTIC LEAGUE NORTH"; MLB unchanged. |
| 2 | Get Tickets goes to a Ticketmaster 404 (no `ticketmasterSlug` on the doc) | **Deferred**, known issues 138, pre-flip blocker. |
| 3 | Venue-less FAQ copy: lower-case "their home stadium is in Hudson Valley", "Most major-league venues are served by bus or rail", "Several hotels sit within walking distance" with no venue behind it | **Deferred**, known issues 138, pre-flip blocker: false copy, never served while the gate is shut. |
| 4 | SpotHero and Expedia CTAs with no place | **Deferred**, known issues 138, pre-flip. |
| 5 | No game time on cards or sheets | **Waived**: a fixture artifact. The preview fixture carried no times; the scanner maps the API's `game_time_local` to `time` (mlb-api prompt). Re-check on the first real MILB render. |
| 6 | "All MiLB teams" goes to `/teams?league=MILB`, which has no MiLB filter | **Deferred**, known issues 138, pre-flip. |
| 7 | Theme-nights section restates the four cards | **Deferred**, known issues 138: the template's behavior for a club with few promotions, seen first on MiLB. |
| 8 | Hero tiles read 0 | **Deferred**, known issues 138, as 7. |
| 9 | App reminder claims unverified for MiLB | **Deferred**, known issues 138, pre-flip blocker tied to the app ruling (G2). |
| 10 | JSON-LD Events carry no `location` | **Deferred**, known issues 138, pre-flip (venues are out of scope this phase). |
| 11 | Shared-component issues seen on every page (hit sizes, logo contrast, axe label mismatch, video player over the ticket buttons) | **Waived for this merge**: present identically on production pages this diff does not change. |

### Existing-page findings (not from this diff)

The Twins page showing a played 2026 season and back-scroll restoration missing by 2,324px (Twins) and 723px (Wild) are present on production as on the branch: **waived for this merge**, not caused by it.

Screenshots for this run stay in the worktree and are not committed: the repo carries no ux-review PNGs (0 across 34 reports).
