# ux-review: fix/held-parking-faq (baseline mode)

Date: 2026-11-08 (America/New_York), run 15:10 to 15:25 EST. Branch `fix/held-parking-faq`, HEAD **425dfea** ("Venue FAQ: held lots ... make no 'has on-site lots' claim, even with a lot map"), parent 481e7cf. Diff: one condition in `src/components/venue-hub/VenueHubView.tsx` (the parking FAQ no longer qualifies on a lot-map link alone when `fieldStates.parkingLots === 'held'`) plus `src/components/venue-hub/__tests__/held-fields.test.tsx`.

- **Branch render:** Next.js 15.5.15 dev server at http://localhost:3100, cwd the `web-held` worktree at 425dfea (checked with lsof), started with PROMO_PAGES_LIVE=true per the caller. Its HTML carries no `<meta name="promonight-deploy">`, because a dev server has no deployment. Its `.env.local` (a symlink to the main checkout's) defines neither `NEXT_PUBLIC_TICKETMASTER_IMPACT_WRAP` nor `NEXT_PUBLIC_EBAY_CAMPID`. I read the variable names only, not the values. Raptive did not fill any slot on the dev server in this run.
- **Production render:** https://www.getpromonight.com, deploy meta `dpl_DnECdB3tDRjEBM5XTjKzMXLh6B35` on every fetch and render. `vercel api /v13/deployments` reports that deployment as **main 481e7cf** (READY, created 20:08Z). So production is exactly the branch's parent, and the only code between the two renders is this diff.
- **Firestore:** I tried a read-only query for `venueHubs` docs with `fieldStates.parkingLots == 'held'` and the permission system refused it. Whether any doc carries a hold is therefore inferred from the served HTML (sections below), not read from the store.
- Scripts, measurement JSON and fetched HTML are in the session scratchpad (`uxr-held/`), outside the repo. Screenshots and diff images are next to this report, under `2026-11-08-fix-held-parking-faq/<slug>/`.

Pages reviewed (types from the agent file): **venue** `/venues/xcel-energy-center`, **team** `/nhl/minnesota-wild`, plus `/venues/metlife-stadium` at the caller's request. No fixed sample path was changed.

---

## 1. /venues/xcel-energy-center (venue sample)

### 1.1 Baseline differences

**Served `<main>` HTML** (no `<article>` on this page). I stripped the deploy meta, `/_next/static` hashes, `?v=` strings, nonces, `<script>` bodies (the RSC flight payload included) and `<!-- -->` separators. After that both sides are 567 lines: branch 37,787 bytes, production 38,003 bytes. **Not identical, one region, twice:** the "Get tickets on Ticketmaster" card href (the inline card at line 427 and the desktop sidebar copy at line 536). Production serves `https://ticketmaster.evyy.net/c/7236189/264167/4272?u=...&sharedid=web_venue_xcel-energy-center`; the branch serves `https://www.ticketmaster.com/minnesota-wild-tickets/artist/805974`. This is the standing Impact-wrap environment difference (the dev server lacks the wrap variable). It is not the diff. The parking FAQ, the FAQPage JSON-LD, the parking card and every other block are byte-identical.

**Pixels** (full page, ad containers masked; diffs in `2026-11-08-fix-held-parking-faq/xcel-energy-center/{390,768,1280}-diff.png`):

| Viewport | Branch size | Production size | Differing px (raw overlap) | After section alignment |
|---|---|---|---|---|
| 390 | 390x6460 | 390x6510 | 143,249 (5.69%) | 0 in every section except NEXT GIVEAWAYS HERE (16,979, the sticky-footer band at y 794 to 844, filled on production) and PLAN YOUR VISIT (9,480, y 1446 to 1471, the first in-content unit 300 px tall on production against a 250 px empty box on the branch) |
| 768 | 768x4717 | 768x4747 | 47,761 (1.32%) | Differences only in ad rectangles (sidebar x 536 to 762, the sticky footer) and the FAQ/footer tail after a 30 px taller filled unit |
| 1280 | 1280x4220 | 1280x4250 | 70,750 (1.31%) | Differences only in the right rail ad stack (x 808 to 1187) and the offset after a 280 px filled unit |

Every pixel difference traces to Raptive fill (production filled, branch empty) or to content offset below a taller filled unit. Every first-party section compares at 0 differing pixels once aligned, the parking card and the "Where do you park at Grand Casino Arena?" FAQ included.

**Measurements that moved:** document height (+50/+0/+30 px on production, ad heights); CLS at 390 (0.0224 to 0.0336, the extra 0.0112 being the AdThrive_Footer_1 container); axe serious/critical (production adds frame-title, image-alt, link-name, button-name, label, aria-command-name, frame-focusable-content, all inside Google ad iframes); small hit targets (+1 on production, Raptive's 24x22 "Close advertisement"); contrast failures (+1 on production, that button's "x" at 2.12:1); console errors (dev server 21/33/38 against production 7/15/24, dev-mode noise and ad scripts). No first-party measurement moved.

### 1.2 Game date check

- Dates read: there is no Event JSON-LD on the venue page (0 `startDate`). The NEXT GIVEAWAYS HERE rows carry `<time datetime>` values 2026-11-25 (Native American Heritage Night Hat), 2026-11-27 (Hometown Remix Jersey Towel) and 2026-12-12 (Ornament).
- Today in the building's zone (St Paul, America/Chicago): 2026-11-08.
- Verdict: **no played game on the page.** Every listed date is 17 or more days out. Identical on both environments.

### 1.3 What a fan sees (390, `390-branch.png`)

Above the fold: the dark hero "Gameday guide / Grand Casino Arena Bag Policy (formerly Xcel Energy Center) / St Paul, Minnesota", then the bag card "Max bag size: 12" x 12" x 6" / A clear bag is not required" with the policy text, "Last verified Oct 7, 2026" and the source link, then the dark MAX BAG / RIDESHARE strip. First scroll: NEXT GIVEAWAYS HERE (three rows; at scroll 0 the third, "Ornament / Dec 12", sits under the 50 px sticky-footer band), TEAMS THAT PLAY HERE (one Wild card), PLAN YOUR VISIT (SpotHero, Expedia hotels), then a 250 px empty ad box on the branch (filled on production). Second scroll: GETTING IN (rideshare at Gate 4), PARKING LOTS (RiverCentre Parking Ramp, Kellogg Parking Ramp, each with its address and source), and the start of FOOD & DRINK by section. At 768 and 1280 the booking cards move to a right rail and the FAQ runs full width; the first-party layout is identical between environments.

### 1.4 Walk

- Date and time: the venue page carries dates only (row dates), no times; that is by design for a building page.
- Venue: the H1 and hero name the building and city.
- Primary CTA, "SpotHero Reserve Parking" (334x56, new tab, `rel="noopener noreferrer sponsored"`): `tracking.spothero.com` returns 302 to `spothero.com/search?lat=44.9448&lng=-93.101`. Same on both. Ticket cards: TicketNetwork goes `ticketnetwork.lusg.net` to `www.ojrq.net` (302); Fanatics goes `fanatics.93n6tx.net` to `www.fanatics.com` (301); Ticketmaster goes `ticketmaster.evyy.net` to `www.ticketmaster.com` (301) on production and straight to `www.ticketmaster.com` (200) on the branch. Expedia answered 429 to a scripted fetch on both (bot throttling).
- Rail card: "Native American Heritage Night Hat" lands on H1 "NATIVE AMERICAN HERITAGE NIGHT HAT" on both environments.
- Back: from the "Wild promos & giveaways" team card (scrollY 475) back restores to 475 (0 px) on both. That card is above the first ad; below it, known-issues 86 still holds (measured on MetLife, section 3.4).
- Parking FAQ (the surface the diff touches): "Grand Casino Arena has on-site lots including RiverCentre Parking Ramp, Kellogg Parking Ramp. Reserve a nearby spot in advance through SpotHero on this page." Identical on both environments. Lots are shown here, so the changed condition is not reached.

### 1.5 Three things that work

1. **The parking answer matches the parking card on both environments.** Both name the same two ramps, and the card cites `grandcasinoarena.com` with "Source read Oct 7, 2026" (`390-branch.png`, 1,642 to 1,964 px).
2. **The CTA and the rail land where they say:** SpotHero opens at the arena's coordinates, and the rail row opens the promo whose H1 matches its label.
3. **No first-party layout change:** every non-ad section is pixel-identical across the three viewports (game date check: no played game, section 1.2).

### 1.6 Defects (none attributable to the diff; all present on production)

| # | Defect | Viewport | Severity | Screenshot |
|---|---|---|---|---|
| X1 | Booking cards whose accessible name lacks their visible text (axe label-content-name-mismatch, serious, 2 nodes: SpotHero, Ticketmaster). Known-issues 87, open. | all | P3 | `xcel-energy-center/390-branch.png` |
| X2 | The red "NIGHT" in the header wordmark is 4.33:1 (#da2d20 on #f7f3ea at 18 px regular), flagged by axe color-contrast (serious) on every page. The team-card chevron "›" (3.14:1) and the hotels-card arrow (2.72:1, #a78bfa on white) are also under 4.5:1. | all | P3 | `xcel-energy-center/390-branch.png` (top; 903 px; 1,119 px) |
| X3 | First-party tap targets under 44x44 at 390: every source link "grandcasinoarena.com ›" (135x14 and 123x12, nine of them), "Official bag policy ›" 104x14, the three NEXT GIVEAWAYS rows (20 px tall: 227x20, 201x20, 64x20), "Show all 36 stands ›" 334x34, "nhl.com ›" 47x12, the logo link 132x17, the menu button 40x40, and the footer links (15 px tall). | 390 | P3 | `xcel-energy-center/390-branch.png` |
| X4 | Load shift of 0.0224 at about 600 ms, from the hero subtitle (`P.text-white/65`, "St Paul, Minnesota") moving with its container. Under 0.1, but first party and on every load. | 390, 1280 | P3 | `xcel-energy-center/390-branch.png` (hero) |

---

## 2. /nhl/minnesota-wild (team sample)

### 2.1 Baseline differences

**Served `<article>` HTML** (normalized as above): branch 1,664 lines / 109,817 bytes; production 1,691 lines / 113,164 bytes. **Not identical, two regions:**

1. The "Get tickets on Ticketmaster" href, six times (lines 7, 596, 678, 760, 805, 850): production `ticketmaster.evyy.net/...&sharedid=web_team_page_minnesota-wild`, branch `www.ticketmaster.com/minnesota-wild-tickets/artist/805974`. This is the Impact-wrap environment difference.
2. Three "Missed it? Check resale on eBay" links (production lines 1306 to 1313, 1362 to 1369 and 1418 to 1425) on the completed-promo rows for the Kirill Kaprizov Bobblehead & T-shirt (2026-01-24), the Jared Spurgeon Bobblehead & Scarf (2025-12-21) and the third completed bobblehead row. They appear on production only, with `campid=5339156327`. The dev server has no `NEXT_PUBLIC_EBAY_CAMPID`, so it renders none. Environment, not the diff.

The team page's venue rows (bag policy, rideshare, the RiverCentre and Kellogg parking ramps) are byte-identical between the two. The team page does not render the venue FAQ.

**Pixels** (`minnesota-wild/{390,768,1280}-diff.png`): 390 = 242,582 px (4.97%; production's document is 357 px taller at measurement and its screenshot 407 px taller: the three eBay lines plus ad height); 768 = 282,585 (3.52%); 1280 = 359,327 (3.16%). After alignment the differences sit in the UPCOMING PROMOS list (the three eBay lines and everything after them shifting), the ad rectangles, and the sticky video player and sticky footer on production at the top band (y 0 to 793 at 390). Every other section is 0, or differs only inside a masked ad rectangle.

**Measurements that moved:** document height (12,507 / 10,446 / 8,870 on the branch against 12,864 / 10,542 / 8,966); hit targets under 44 (production +3 for the 186x32 eBay links, +1 for the ad close button); CLS at 1280 (0 to 0.03, ad); axe (production adds ad-iframe image-alt, frame-title, aria-command-name, button-name, label, link-name). The first-party values (promo anchors 37 DOM / 35 visible at 390, first ad anchor at 672 px, the contrast list, label-content-name-mismatch 6/16/16) are identical.

### 2.2 Game date check

- Dates read: the Event JSON-LD carries four `startDate`s: 2026-11-25 (Native American Heritage Night Hat), 2026-11-27 (Hometown Remix Jersey Towel), 2026-12-12 (Ornament) and 2026-12-22 (Nightlight). The first UPCOMING PROMOS card reads "NOV 25 WED ... 7:00 PM ... VS MAMMOTH". The hero line reads "6 promotions in the 2026-27 season, 4 still to come".
- Today in the team's zone (NHL Central, America/Chicago): 2026-11-08.
- Verdict: **no played game among the Events.** All four are upcoming, identical on both environments. Completed promos sit behind "Show 3 more completed promos", which is the intended past state.

### 2.3 What a fan sees (390, `390-branch.png`)

Above the fold: the dark hero "NHL · Central / MINNESOTA WILD / Promos & Giveaways 2026-27 / Grand Casino Arena", then five stat tiles: **6** GIVEAWAYS, **0** THEME NIGHTS, **0** FOOD DEALS, **0** KIDS & FAMILY, **84** SCHEDULED GAMES. First scroll: the "Still to come" filter chips (All, Giveaways 4, Theme Nights 0, Food Deals 0, Kids & Family 0) and the November 2026 calendar with dots and a legend; on production a Raptive sticky video player sits over the upper right of the calendar. Under the calendar is about 170 px of blank space before PLAN YOUR VISIT (an empty slot on the branch). Second scroll: PLAN YOUR VISIT (Ticketmaster, TicketNetwork, SpotHero, Expedia, Fanatics, "Full gameday guide"), then GAME DAY AT GRAND CASINO ARENA (bag policy, rideshare, the parking ramps). The 768 and 1280 renders show the same order in two columns. First-party output is identical between environments.

### 2.4 Walk

- Date and time: on the first upcoming card ("NOV 25 WED ... 7:00 PM").
- Venue: in the hero ("Grand Casino Arena") and in the GAME DAY block, which links to the venue page ("Full gameday guide", 342x76).
- Primary CTA, "Get tickets on Ticketmaster" (342x60, new tab, sponsored): production goes `ticketmaster.evyy.net` to `www.ticketmaster.com` (301, Impact click parameters); the branch goes straight to `www.ticketmaster.com` (200). Other cards: TicketNetwork `ticketnetwork.lusg.net` to `www.ojrq.net` (302); SpotHero `tracking.spothero.com` to `spothero.com` at 44.9448,-93.101 (302); Fanatics `fanatics.93n6tx.net` to `www.fanatics.com` (301); Expedia 429 (throttled).
- Rail card: the first UPCOMING PROMOS card (258x184) lands on H1 "NATIVE AMERICAN HERITAGE NIGHT HAT" on both.
- Back: **fails on both environments** (T1 below).

### 2.5 Three things that work

1. **The CTA chain is intact on production:** the Ticketmaster card carries the Impact wrap and reaches Ticketmaster in one hop; the SpotHero card searches at the arena's coordinates.
2. **The upcoming card states date, weekday, time, opponent and the giveaway in one block,** and its destination's H1 matches.
3. **The team page's parking row is unchanged by the diff and matches the venue page** (the same two ramps, same source and read date). Game date check: no played game (section 2.2).

### 2.6 Defects (none attributable to the diff; all present on production)

| # | Defect | Viewport | Severity | Screenshot |
|---|---|---|---|---|
| T1 | **Browser back from an upcoming promo card does not restore position.** I placed the card 400 px below the top of the viewport (scrollY 2,445), opened it and pressed back. scrollY came back as 2,627 (+182), and the card now sits 207 px from the top (content moved 193 px). This reproduced on both environments on two separate runs. From a footer link the overshoot is +472 (branch) and +442 (production). Known-issues 86 covers venue pages only, and there is no team-page entry. | 390 | P2 | `minnesota-wild/390-branch.png` (card at 2,828 px) |
| T2 | Three of the five hero tiles read **0** (THEME NIGHTS, FOOD DEALS, KIDS & FAMILY), and three of the five filter chips are zero-count buttons that still respond to a tap. Nearly half the hero is empty. | all | P3 | `minnesota-wild/390-branch.png` (300 to 1,000 px) |
| T3 | Two different giveaway counts sit one screen apart: the tile says "6 GIVEAWAYS" (the season) and the chip says "Giveaways 4" (still to come). The sentence "6 promotions ... 4 still to come" reconciles them, but only for a fan who reads it. | 390 | P3 | `minnesota-wild/390-branch.png` |
| T4 | First-party tap targets under 44x44 at 390: calendar day buttons 41x41 (30), previous/next month 36x36, Share buttons 32x32 (9), "TICKETS" buttons 92x27 (4), filter chips 34 px tall (5), the crumb "NHL promotions and giveaways hub" 27x12, source links 12 px tall, ticket-package links 17 px tall, "Show 10 more ticket packages" 294x20, "Show 3 more completed promos" 288x39; production adds "Missed it? Check resale on eBay" 186x32 (3). | 390 | P3 | `minnesota-wild/390-branch.png` |
| T5 | axe label-content-name-mismatch (serious): 6 nodes at 390, 16 at 768/1280. These are the booking cards and the calendar day buttons, named "2026-11-01 details" while showing "1". | all | P3 | `minnesota-wild/390-branch.png` |
| T6 | Wordmark "NIGHT" 4.33:1, the hotels-card arrow 2.72:1 and the card chevron 3.14:1, as X2. | all | P3 | `minnesota-wild/390-branch.png` |

---

## 3. /venues/metlife-stadium (first building the change matters for)

### 3.1 Baseline differences

**Served `<main>` HTML** (normalized): both 1,722 lines (branch 100,545 bytes, production 100,755). **Not identical, one region, twice:** the Ticketmaster card href (lines 1582 and 1691): production `ticketmaster.evyy.net/...&sharedid=web_venue_metlife-stadium`, branch `www.ticketmaster.com/new-york-giants-tickets/artist/805985`. This is the Impact-wrap environment difference. Nothing else differs.

**The parking FAQ today, both environments, byte-identical:**

> **Where do you park at MetLife Stadium?** MetLife Stadium has on-site lots including Lot B, Lot D, Lot E, Lot F, Lot G, Lot J, Lot K, Lot L. Reserve a nearby spot in advance through SpotHero on this page.

- "has on-site lots" appears 4 times in each document: the visible FAQ, the FAQPage JSON-LD, and the two RSC-payload copies of each.
- **"Lot B" appears in both environments.** Production has 7 occurrences: the PARKING LOTS card ("Lot B. Gold permit lot"), the FAQ, the FAQPage JSON-LD, and their flight-payload copies. The branch has 8. The extra one is a dev-server-only copy of the hub props in React's development debug payload (`"parkingLots":[{"name":"Lot B","notes":"Gold permit lot"},...]`, with `fieldStates`, `observedAtByField` and `sources` as deduped `$Y` references). Production carries 0 `parkingLots`, 0 `fieldStates` and 0 `observedAtByField` keys. So this is not a production exposure. It does mean a byte count of "Lot B" on a dev server reads one higher than production.
- Neither document contains `heldValues` or `"held"`. The page still renders the lots card, which a held `parkingLots` would empty in the mapper. **On the served evidence, metlife-stadium's lots are not held today**, which matches the caller's statement. The PARKING LOTS card renders, so `lotsShown` is true and the changed condition is never evaluated. Expected after the pipeline writes the hold: the card, the FAQ answer (with the lot-map link the page still shows, `MetLife-Stadium-Parking-Map_2026-3-2-26-21906c0f8b.pdf`) and the JSON-LD copy all disappear on production. That is what the branch is for.
- What the cited page says today: the lots card cites `https://www.metlifestadium.com/plan-your-visit/parking-tailgating/nfl-parking`. Loaded in a browser at 15:22 EST, its text contains none of "Lot B", "Lot D", "Lot F", "Lot J", "Lot K", "Lot M" or "Lot P", while "Lot E", "Lot G", "Lot L" and "Deck A" each match at least once (raw substring counts; "Lot E" may match a longer word). The first two lots the FAQ names, and five of its eight, are not on the source the page cites. This supports the drift hold the pipeline will write.

**Pixels** (`metlife-stadium/{390,768,1280}-diff.png`): 390 = 241,812 px (7.03%; production's screenshot 110 px taller, from 300/280 px filled units against 250 px empty boxes); 768 = 278,296 (5.64%; 230 px taller); 1280 = **0** differing px with the ad rectangles masked (same 1280x5692 size; production's 600 px filled sidebar units occupy the masked rail slots). A heading-aligned pass at 1280 reports large numbers in the right rail only because the rail's headings sit at different heights beside the filled units; the full-page comparison is 0. After alignment every first-party section in the main column is 0, the PARKING LOTS card and the "Where do you park at MetLife Stadium?" FAQ included (390: diff only at y 7,285 to 7,648, the unfilled ad boxes under the FAQ). At 768 the bag and FAQ entries show small diffs from 4,234 px down; they sit beside the masked in-content ad and its 100 px offset.

**Measurements that moved:** document height (+80/+100/0); CLS at 1280 (0.0296 to 0.0673, ad); production's 390 render adds the Raptive sticky video player (Pause 36x36, Unmute 36x36, "Close sticky video" 22x20) and the ad close button to the small-target list; production's axe adds ad-iframe frame-title, image-alt, link-name, aria-command-name and aria-hidden-focus; console errors 15/20/31 on the branch against 10/182/9 (production's 768 spike is ad script). First-party values are identical.

### 3.2 Game date check

- Dates read: no Event JSON-LD (0 `startDate`). NEXT GIVEAWAYS HERE `<time>` values are 2026-11-12 (Light Bands, Giants), 2026-11-22 (Military Knit Beanie, Giants) and 2026-12-27 (Rivalries Giveaway, Jets). The PROMOS THIS WEEK cards read "NOV 12 THU ... VS COMMANDERS" (two cards).
- Today in the building's zone (East Rutherford, America/New_York): 2026-11-08.
- Verdict: **no played game on the page.** The nearest date is 4 days out. Identical on both environments.

### 3.3 What a fan sees (390, `390-branch.png`)

Above the fold: the hero "Gameday guide / MetLife Stadium Bag Policy / East Rutherford, New Jersey", the bag card "Max bag size: 12" x 12" x 6" / Clear bag required" with the allowed list and two source links, then the dark CLEAR BAG / TRANSIT Rail / RIDESHARE Available strip. First scroll: NEXT GIVEAWAYS HERE (three rows), PROMOS THIS WEEK (a horizontal rail of Giants cards), TEAMS THAT PLAY HERE (Giants, Jets), then an empty 250 px ad box. On production, in the same band, a filled 320x50 casino banner and a 100 px sticky video player cover the bottom 150 px of the viewport, over the PROMOS THIS WEEK cards (`390-production.png`, 672 to 844 px). Second scroll: PLAN YOUR VISIT (SpotHero, Expedia, "Official parking lot map ›"), then GETTING IN with long Transit, Rideshare, Tailgating, Accessibility and Entry paragraphs. Further down: PARKING LOTS with twelve entries (Lot B to Lot P, Deck A, "Lots near American Dream"), every one a "Gold" or "Platinum permit lot".

### 3.4 Walk

- Date and time: rows and cards carry dates and weekdays; the cards show no game time (venue page).
- Venue: H1 and hero.
- Primary CTA, "SpotHero Reserve Parking" (334x56): `tracking.spothero.com` returns 302 to `spothero.com/search?lat=40.8135&lng=-74.0745` on both. Ticketmaster goes `ticketmaster.evyy.net` to `www.ticketmaster.com` (301) on production and direct on the branch. TicketNetwork goes to `www.ojrq.net` (302), Fanatics to `www.fanatics.com` (301). "ticketexchangebyticketmaster.com ›" is an `http://` link that 301s to its own https URL.
- Rail card: "Light Bands" lands on H1 "LIGHT BANDS" on both.
- Back: from the "Giants promos & giveaways" card (scrollY 599) back restores to 599 (0) on both. From the footer's "Stadium guides" (scrollY 7,686 branch / 7,716 production) back lands at +211 on both. **Known-issues 86 is still open**, and this is the page where the parking FAQ sits below that point.

### 3.5 Three things that work

1. **The diff is inert today, as expected.** The FAQ answer, its JSON-LD and the lots card are byte-identical between branch and production, and no first-party pixel moved.
2. **The lots card, the CTA and the rail land correctly:** SpotHero searches at the stadium's coordinates, and "Light Bands" opens the promo whose H1 matches.
3. **Game date check ran:** no played game (section 3.2). Back from the team card above the first ad is exact (0 px).

### 3.6 Defects (none attributable to the diff; all present on production)

| # | Defect | Viewport | Severity | Screenshot |
|---|---|---|---|---|
| M1 | **The parking FAQ names lots the cited source no longer lists and omits that they are permit lots.** "MetLife Stadium has on-site lots including Lot B, Lot D, ... Reserve a nearby spot in advance through SpotHero" is served visibly and in FAQPage JSON-LD. Five of the eight names (B, D, F, J, K) are absent from the cited operator page today. The page's own lots card calls every lot a Gold or Platinum permit lot, and GETTING IN says a pre-paid permit is required for every vehicle on NFL game days. A fan who reads only the answer is told to drive to a lot they cannot enter. This branch plus the pipeline hold is the remedy; it is not fixed until the hold is written. | all | P2 | `metlife-stadium/390-branch.png` (FAQ at 6,608 px; lots at 2,795 px) |
| M2 | **The same giveaway appears twice in PROMOS THIS WEEK:** "Light Bands" (Giveaways, "Wearable light bands for all fans that will light up MetLife...") and "Lightbands" (Theme Nights, "All fans receive wearable light bands that will light up..."), both Giants, both NOV 12 THU vs Commanders, each with its own Share button. The rail repeats itself. | all | P2 | `metlife-stadium/1280-branch.png` (660 to 790 px), `390-branch.png` (760 to 940 px) |
| M3 | Browser back from below the first ad lands +211 px (footer "Stadium guides"). Known-issues 86, open. | 390 | P2 | `metlife-stadium/390-branch.png` |
| M4 | About 530 px of nothing between the last FAQ answer and the footer disclaimer: a 250 px grey box, then about 290 px of blank page (two Raptive slots at 6,775 and 7,035 px, unfilled on production too in this render). | 390 | P3 | `metlife-stadium/390-branch.png` (6,775 to 7,320 px) |
| M5 | The FAQ answer lists eight of the card's twelve lots with "including", in a different order of detail than the card (no permit tiers). This restates the card above it with less information. | all | P3 | `metlife-stadium/390-branch.png` |
| M6 | First-party tap targets under 44x44 at 390: source links "metlifestadium.com ›" (116x14, 106x12, eight in all), "Official parking lot map ›" 121x12, "ticketexchangebyticketmaster.com ›" 182x17, "parkfast.com ›" 73x17, the NEXT GIVEAWAYS rows (20 px tall), Share buttons 32x32, "Show all 27 stands ›" 334x34, header and footer as X3. | 390 | P3 | `metlife-stadium/390-branch.png` |
| M7 | label-content-name-mismatch on two booking cards (known-issues 87); wordmark, chevrons (3.14:1, twice) and hotels arrow (2.72:1) under 4.5:1. | all | P3 | `metlife-stadium/390-branch.png` |

---

## 4. Measurements

At 390 unless stated. "B" is the branch dev server (425dfea); "P" is production (dpl_DnECdB3tDRjEBM5XTjKzMXLh6B35 = main 481e7cf).

| Measurement | Xcel B | Xcel P | Wild B | Wild P | MetLife B | MetLife P |
|---|---|---|---|---|---|---|
| promonight-deploy | absent (dev) | dpl_DnECdB3t... | absent (dev) | dpl_DnECdB3t... | absent (dev) | dpl_DnECdB3t... |
| HTTP status | 200 | 200 | 200 | 200 | 200 | 200 |
| Main content identical (normalized) | no: Ticketmaster href x2 (env) | | no: Ticketmaster href x6, eBay resale x3 (env) | | no: Ticketmaster href x2 (env) | |
| Document height 390 / 768 / 1280 | 6,460 / 4,717 / 4,220 | 6,510 / 4,747 / 4,250 | 12,507 / 10,446 / 8,870 | 12,864 / 10,542 / 8,966 | 8,819 / 6,425 / 5,692 | 8,899 / 6,525 / 5,692 |
| Pixel diff 390 / 768 / 1280 (raw, ads masked) | 143,249 / 47,761 / 70,750 | | 242,582 / 282,585 / 359,327 | | 241,812 / 278,296 / **0** | |
| Interactive elements visible | 45 | 46 | 120 | 124 | 53 | 57 |
| Under 44x44 (all / first party) | 39 / 39 | 40 / 39 | 96 / 96 | 100 / 99 (the 3 eBay links are first party) | 43 / 43 | 47 / 43 |
| Text under 4.5:1 (first party) | 3 | 3 (+1 ad) | 3 | 3 (+1 ad) | 4 | 4 (+1 ad) |
| axe serious+critical, first party | color-contrast 1, label-content-name-mismatch 2 | same, plus ad-iframe rules | color-contrast 1, label-content-name-mismatch 6 (16 at 768/1280) | same, plus ad-iframe rules | color-contrast 1, label-content-name-mismatch 2 | same, plus ad-iframe rules |
| CLS 390 / 768 / 1280 | 0.0224 / 0.001 / 0.0288 | 0.0336 / 0.001 / 0.0297 | 0 / 0 / 0 | 0 / 0 / 0.03 | 0.0009 / 0.0011 / 0.0296 | 0.0009 / 0.0011 / 0.0673 |
| `<a>` to /promos/ DOM / visible | 11 / 9 | 11 / 9 | 37 / 35 | 37 / 35 | 14 / 12 | 14 / 12 |
| Hidden /promos/ anchors | 2x "Today" (closed mobile menu) | same | same | same | same | same |
| First ad anchor from document top | 57 px (`data-ad-region=content` div) | 57 px | 672 px (`<article data-ad-region=content>`); first `data-ad-item=promo` 2,828 px | same | 57 px | 57 px |
| Raptive slots filled | 0 | 3 of 6 | 0 | 3 of 7 | 0 | 4 of 8 |
| Parking FAQ "has on-site lots" (served count) | 4 | 4 | n/a (no venue FAQ) | n/a | 4 | 4 |
| "Lot B" in served HTML | n/a | n/a | 0 | 0 | 8 (one dev debug copy) | 7 |
| `fieldStates` / `heldValues` in served HTML | 1 (dev debug) / 0 | 0 / 0 | 2 (dev debug) / 0 | 0 / 0 | 1 (dev debug) / 0 | 0 / 0 |
| Primary CTA hop | SpotHero 302 to spothero.com | same | Ticketmaster direct 200 | evyy.net 301 to ticketmaster.com | SpotHero 302 to spothero.com | same |
| Rail card H1 matches | yes | yes | yes | yes | yes | yes |
| Back, above first ad | 0 px | 0 px | +182 px (card) | +182 px (card) | 0 px | 0 px |
| Back, from footer | not run | not run | +472 px | +442 px | +211 px | +211 px |
| Console errors 390 | 21 | 7 | 30 | 10 | 15 | 10 |

## 5. Verdict on the diff

On all three pages, every difference between branch and production is environmental: the dev server's missing `NEXT_PUBLIC_TICKETMASTER_IMPACT_WRAP` and `NEXT_PUBLIC_EBAY_CAMPID`, Raptive fill on production only, and React's dev-mode debug payload. None of it is attributable to 425dfea. The served evidence shows no held `parkingLots` on metlife-stadium or xcel-energy-center (their lots cards render). The direct store read was refused, so I did not check the other buildings. The caller's expectation is **confirmed**: the MetLife parking FAQ reads identically on both environments and names "Lot B".

## 6. Recommendation

Merge. Once the pipeline writes the metlife-stadium drift hold, re-run this baseline on `/venues/metlife-stadium` against production. Check that "Lot B" and "has on-site lots" drop to 0 in the served HTML, the FAQPage JSON-LD included, while the "Official parking lot map" link still renders. That is the only state in which the changed condition is reached, and nothing in this run exercised it.

## Dispositions (merge rule, 2026-11-08)

Screenshots and diff images were not committed, following the other 2026-11-08 reports; they are kept outside the repo with the session's scratch files. The Firestore check the reviewer could not run is settled by the sequence: the pipeline writes no hold until this deploys, so no building is held at review time.

| Item | Disposition | Reason |
|---|---|---|
| M1 MetLife parking FAQ names lots its cited page no longer lists | **fixed by this branch plus the pipeline drift hold** | After the hold, the lots card empties and this branch stops the lot-map-only "has on-site lots" answer. Re-checked in served HTML after the pipeline write (Lot B and "has on-site lots" to 0). |
| T1 team page back from a promo card lands 182 px off (390) | deferred, known-issues 91 | Present on production; known-issues 86 covers venue pages only. |
| M2 MetLife "Promos this week" lists the same giveaway twice (Light Bands / Lightbands, Giants Nov 12) | deferred, known-issues 92 | A promo-data duplicate (pipeline), present on production. |
| M3 MetLife back below the first ad lands +211 px | known-issues 86 | Carried. |
| Wild hero tiles at 0 with tappable zero chips; "6 GIVEAWAYS" tile vs "Giveaways 4" chip | deferred, known-issues 93 | Present on production; the count mismatch is two counts of one thing disagreeing, worth fixing on its own. |
| MetLife empty space after the FAQ; FAQ repeats the lots card | waived | Present on production; venue page layout outside this diff. |
| Sub-44px tap targets | known-issues 78 | Carried. |
| Wordmark and glyph contrast | waived | Wordmark color kept by an earlier brand ruling; glyphs carried on every page. |
| Accessible names on booking cards and calendar days | known-issues 87 | Carried. |
| Xcel hero layout shift 0.0224 | known-issues 82 | Within budget; carried. |
