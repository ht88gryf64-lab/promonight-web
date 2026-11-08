# UX review: venue and promo pages, baseline mode (feature/byg-vendor-parking vs production)

Date: 2026-11-08 (America/New_York). Branch: `feature/byg-vendor-parking`, HEAD 078c3c0. That is one commit on main 1d3b6f2, adding the optional hub field `parkingNotes` { vendor, quote } and the sentence "No venue lots; {Arena} directs fans to {vendor}." on four parking surfaces. Lots always win. The worktree was clean apart from `node_modules` and this report.

- Branch render: Next.js 15.5.15 dev server at http://localhost:3100 (`PROMO_PAGES_LIVE=true`), cwd the branch worktree. Its HTML has no `<meta name="promonight-deploy">`, because the dev server has no deployment id.
- Production render: https://www.getpromonight.com, `<meta name="promonight-deploy" content="dpl_62mKPLTaE5Qpkwjtc67NujmFmokF">`. `vercel inspect` reports it as target production, Ready, created 2026-11-08 18:11 UTC. The CLI did not return its commit. Main's two newest commits are 8110187, the clutch-row merge, and 1d3b6f2. 1d3b6f2 touches only `scripts/audit-before-you-go.ts`, so the served code is the branch's base either way.
- Tooling: Playwright 1.65 (Chromium headless) with a desktop Chrome User-Agent on both contexts, device scale 1, and viewports 390x844, 768x1024 and 1280x800. Each load got a 5 s settle after `load` and a scroll-through to trigger lazy mounts before the full-page capture. Also @axe-core/playwright (serious and critical only), pixelmatch at threshold 0.1, and a contrast walker that composites backgrounds up the ancestor chain. Served HTML came from curl with the same User-Agent.
- Pixel method: every iframe, Raptive container (`.adthrive-ad`, `AdThrive_*`), `ins` and `nextjs-portal` was masked in both captures before the raw comparison. Then each region (each `<article>` child on the promo page; each band between H2s on the venue page, whose `<main>` is one wrapper) was compared at its true offset on each side. That way, ad fill heights do not count as content differences.

Two URLs, one section each:

1. Page type `venue`, fixed sample: `/venues/xcel-energy-center`.
2. Page type `promo`, sample resolved from the sitemap: `/nhl/anaheim-ducks/promos/hockey-fights-cancer-night`.

**The expectation is confirmed on both pages.** No production venueHubs document carries `parkingNotes`. I counted over the whole served document with `grep -o`. "directs fans to" appears **0 times** on both environments on both pages, and 0 times on the team page `/nhl/minnesota-wild` (served HTML only). "No venue lots" also appears 0 times everywhere. The only trace of the diff in any served byte is a dev-only one (see 1.1). Neither sample can render the new sentence: Grand Casino Arena has two lots, so the lots win, and Honda Center has no Before you go or quick facts.

---

## URL 1: `/venues/xcel-energy-center` (venue sample)

The fixed path still serves 200 on both environments. The building is now Grand Casino Arena, and the H1 reads "Grand Casino Arena Bag Policy (formerly Xcel Energy Center)". The path was not changed.

Screenshots: `2026-11-08-feature-byg-vendor-parking/xcel-energy-center/{390,768,1280}-{branch,production}.png`. Diffs: `2026-11-08-feature-byg-vendor-parking/xcel-energy-center/{390,768,1280}-diff.png` (red marks differing pixels, light blue marks masked ad areas).

### 1.1 Baseline differences

- **Served `<main>` HTML.** The page has no `<article>`, so I compared `<main>`. After normalization each side is 567 lines (branch 37,787 bytes, production 38,003). Normalization stripped the deploy meta, `/_next/static` hashes, `?v=` strings, nonces, `<script>` bodies (which removes the RSC flight payload and the JSON-LD) and `<!-- -->` separators. The two sides differ in **one region, repeated twice**:

  | Region | Branch | Production |
  |---|---|---|
  | "Get tickets on Ticketmaster" card href, lines 427 and 536 (the inline copy and the desktop sidebar copy) | `https://www.ticketmaster.com/minnesota-wild-tickets/artist/805974` | `https://ticketmaster.evyy.net/c/7236189/264167/4272?u=...&sharedid=web_venue_xcel-energy-center` |

  This is the Impact wrap that is configured on production and not on the dev server. It is the same standing env difference as on every baseline run. Everything else in `<main>` is byte-identical, including the PARKING LOTS card (the `ParkingLotsCard` this diff edits), its two lots, its source line and its "Official parking" link. The JSON-LD blocks (StadiumOrArena plus a 7-question FAQPage) are byte-identical too (same md5 on both sides).
- **Outside `<main>`: one dev-only trace.** The branch HTML contains `"parkingNotes":null` once, and production contains it 0 times. It sits in flight row `151:{"name":"VenueHubView","key":null,"env":"Server","owner":"$21","stack":[...],"props":{"postseason":null,"hub":{...` (the `owner`/`stack` fields and the `webpack-internal` paths mark it as the dev build's component-props trace). This is React's dev-mode debug record of the server component's props. Production does not ship that record: the production venue page carries 0 `parkingLots` keys, although it renders both lots. The team page shows the same thing: `"parkingNotes":null` appears once on the branch and 0 times on production. Nothing publishes the new field today, and with the value null there would be nothing to publish anyway.
- **Pixels.**

  | Viewport | Branch PNG | Production PNG | Raw differing pixels (masked overlap) | Compared at true offsets |
  |---|---|---|---|---|
  | 390 | 390x6460 | 390x6520 | 148,963 of 2,519,400 = 5.91% (17.9% masked) | Hero and bag card 0. PARKING LOTS card **0** (B y1,630, P y1,660, 330 px tall). Food and drink through the FAQ 0. Footer 0 at its 60 px offset. What remains: the production first content ad filled at 280 px against the dev's empty 250 px, which shifts everything below by 30 px, then by 60 px further down. Also production's sticky outstream player (x 10-187, y 670-793) and filled fixed footer, both stitched at the top of the capture, and the dev-tools "N" |
  | 768 | 768x4717 | 768x4797 | 190,748 of 3,622,656 = 5.27% (20.1% masked) | PARKING LOTS card **0** at a 50 px offset. Everything from GETTING IN to the FAQ 0. Footer 0 at its 80 px offset. What remains is the ad offset, the fixed footer band at y 934-1024 and the sticky player at x 536-762 |
  | 1280 | 1280x4220 | 1280x4270 | 185,446 of 5,401,600 = 3.43% (19.7% masked) | Left column 0 to y 700. PARKING LOTS card **0** at a 50 px offset. Left column y 1,606 to 3,596 0. Footer 0. What remains is the ad offset and production's sticky video and leaderboard in the right column |

- **Measurements that moved.** Only ad-driven ones: document height (ad fill), interactive and under-44 counts (+4 on production: Raptive's close, pause and unmute controls), production's page error (`SecurityError` from a `safeframe.googlesyndication.com` frame, at every viewport) and CLS at 1280 (0.0288 vs 0.0294). The first-party numbers are identical: CLS at 390 and 768, the 15 under-size targets in `<main>`, the `/promos/` anchor counts, the contrast failures, the axe first-party violations, the H1, the `<time>` values and the first ad anchor.

### 1.2 Game date check

- **Dates on the page.** This is a venue page, with no game line and no Event in its JSON-LD (0 `startDate` on both environments; the types are StadiumOrArena, PostalAddress, GeoCoordinates, FAQPage, Question and Answer). The only dates are the three rows in NEXT GIVEAWAYS HERE: `<time dateTime="2026-11-25">` "Nov 25" (Native American Heritage Night Hat), `2026-11-27` "Nov 27" (Hometown Remix Jersey Towel) and `2026-12-12` "Dec 12" (Ornament). They are identical on both environments.
- **Venue zone.** The page says "St Paul, Minnesota" but states no time zone (the hub's `timezone` is null), so the zone is America/New_York by rule. Today there is 2026-11-08. It is also 2026-11-08 in America/Chicago.
- **Verdict: every date is after today (17, 19 and 34 days out). No played game.** Nothing on the page is stale.

### 1.3 Three things that work

1. **The parking card is specific and sourced, and identical on both environments.** `390-branch.png` from 1,642 to 1,964 px. It names "RiverCentre Parking Ramp. 150 West Kellogg Blvd ... skyway access ... License plate reader entry with no paper ticket" and "Kellogg Parking Ramp. 129 West Kellogg Blvd ... 7-foot vehicle height clearance", followed by "grandcasinoarena.com › · Source read Oct 7, 2026". Lots exist here, so the diff's "lots always win" path holds: there is no vendor sentence and no "No venue lots". The parking FAQ agrees with the card ("Grand Casino Arena has on-site lots including RiverCentre Parking Ramp, Kellogg Parking Ramp.").
2. **The parking CTA lands on parking at this building.** "SpotHero Reserve Parking" (334x56, new tab, `rel="noopener noreferrer sponsored"`, at 1,021 px) links to `tracking.spothero.com`. Its one hop is a 302 to `spothero.com/search?lat=44.9448&lng=-93.101`, the arena's coordinates. The ticket cards hop as expected: TicketNetwork goes `ticketnetwork.lusg.net` to `www.ojrq.net` (302), Fanatics goes `fanatics.93n6tx.net` to `www.fanatics.com` (301), and production's Ticketmaster goes `ticketmaster.evyy.net` to `www.ticketmaster.com` (301). The Expedia card answered 429 to a scripted fetch on both environments, which is bot throttling, not a page defect.
3. **The rail row and team card land where they say.** The first NEXT GIVEAWAYS HERE row, "Native American Heritage Night Hat", lands on H1 "NATIVE AMERICAN HERITAGE NIGHT HAT" on both environments. "Wild promos & giveaways" lands on H1 "MINNESOTA WILD". Back from the team card restored scrollY exactly (489 to 489, 0 px, both environments).

### 1.4 Defects

**V1. Back does not return a fan to where they were, below the first ad. 390, both environments.** I scrolled so the PARKING LOTS heading sat 120 px below the top of the viewport (scrollY 1,522 on the branch, 1,572 on production), opened the menu, tapped "Teams" (H1 "FIND YOUR TEAM") and went back. The page came back 260 px lower: scrollY 1,782 / 1,832, with the PARKING LOTS heading at -140 / -190 px, off screen. From the footer's "Get the week's giveaways in your inbox" (click-time scrollY 4,831 branch / 4,861 production), back lands at 5,538 / 5,568, in the footer's DISCOVER column. Sampled after back: the document is 5,340 px tall at 1 s (the restore clamps to its bottom), then grows to 6,382 px by 3 s while the viewport stays anchored to the footer. `main` and `body` both compute `overflow-anchor: auto`. This misses the 50 px bar on both runs. Not introduced by this branch. Severity: medium.

**V2. Two link cards fail `label-content-name-mismatch` (axe, serious). All viewports, both environments.** "SpotHero Reserve Parking" is named "Reserve parking on SpotHero", and the Ticketmaster card shows "ticketmaster Get Tickets" but is named "Get tickets on Ticketmaster". A voice-control user who says the words on screen does not hit either. The SpotHero card is the page's parking CTA. Severity: medium-low.

**V3. The NEXT GIVEAWAYS HERE rows look like tap rows, but only the title is a link. All viewports, both environments.** `390-branch.png` at 670 to 800 px. Each row is a full-width ruled row: title, team, date. The links are just the titles: 227x20, 201x20 and **64x20** ("Ornament"). The team and date text in the same row do nothing. Severity: low-medium.

**V4. The bag size is said three times on the first screen, and the band under the card adds nothing. 390, both environments.** `390-branch.png` from 270 to 600 px. The card says "Max bag size: 12" x 12" x 6"" and "Purses up to 12 x 12 x 6 inches". The dark band directly below says "MAX BAG 12" x 12" x 6"" again. Its other chip, "RIDESHARE Available", does not say where. The answer (Gate 4, 5th Street) is in GETTING IN, about 1,000 px further down. Severity: low.

**V5. The parking card ends in two links with the same label to the same page. All viewports, both environments.** `390-branch.png` at 1,881 and 1,903 px. "grandcasinoarena.com ›" (123x12, with "Source read Oct 7, 2026") and "Official parking: grandcasinoarena.com ›" (123x17) both go to `https://www.grandcasinoarena.com/plan-your-visit/directions-parking`, 22 px apart. This is the card the diff edits, though the diff does not change these two links. Severity: low.

**V6. 39 of 45 interactive elements are under 44x44 at 390 (production: 43 of 49).** 15 are in `<main>`: ten source links "grandcasinoarena.com ›" at 123-135 x 12-17, "Official bag policy ›" 104x14, "nhl.com ›" 47x12, the three giveaway titles in V3, and "Show all 36 stands ›" 334x34. The rest are the header and footer (known-issues 78 covers the same pattern on promo pages). At 768 and 1280: 44 and 45 of 51 on the branch. Severity: low (carried).

**V7. Contrast under 4.5:1. All viewports, both environments.** "NIGHT" in the wordmark is 4.33:1 (#da2d20 on #f7f3ea, axe `color-contrast` serious, 1 node, ruled brand color). The team card's "›" chevron is 3.14:1 (#9a9081 on white, 17 px), and the hotels card's "→" is 2.72:1 (#a78bfa on white, 17 px). Production adds Raptive's "×" at 2.12:1. Severity: low.

**V8. A first-party layout shift on load. Both environments.** At 390, 0.0224 at about 415 ms, sourced to the hero (`P.text-white/65`, the "St Paul, Minnesota" line, and its container). At 1280, 0.0288 / 0.0294 at 381 to 856 ms, sourced to the PLAN YOUR VISIT section's 26 px icon span. Both are inside budget, but neither is an ad. Severity: low.

**V9. The H1 calls a whole gameday guide a "Bag Policy". All viewports, both environments.** "Grand Casino Arena Bag Policy (formerly Xcel Energy Center)" sits over parking, rideshare, 36 food stands and tickets. A fan who came for parking reads a bag-policy title. Severity: low. This may be deliberate search copy; it is not changed by this diff.

**V10. Layout: NEXT GIVEAWAYS HERE is narrower than every other card, and GETTING IN leaves half its card empty at 1280. Both environments.** The giveaways card is inset on both sides (x 25-365 against 12-378 at 390; x 125-750 against 92-784 at 1280), so it reads as misaligned. At 1280 GETTING IN is a two-column grid holding one paragraph, so its right half is blank (`1280-branch.png`, 926 to 1,083 px). Severity: low.

Not defects:
- The white band across the first screen in every branch capture (390 at y 794-844, 768 at y 934-1024, 1280 at y 710-800) is Raptive's unfilled fixed footer. Playwright stitches it at the top of the document. The fade over the second and third giveaway rows at 1280 is the same band.
- The 250 px blank boxes are unfilled Raptive containers. The black "N" is the Next.js dev-tools indicator.
- On production at 390, the sticky outstream video (x 10-187, y 670-793) and the footer ad cover the NEXT GIVEAWAYS HERE rows on the first screen. This is third-party and carried.

### 1.5 First screen and two scrolls (390)

- **First screen (0-844):** the header; the dark hero with "GAMEDAY GUIDE", the H1 on three lines and "St Paul, Minnesota". Then the bag card: "WHAT SIZE BAG CAN I BRING?", "Max bag size: 12" x 12" x 6"", "A clear bag is not required.", two lines of policy, "Last verified Oct 7, 2026 · grandcasinoarena.com ›" and "Official bag policy ›". Then the dark MAX BAG / RIDESHARE band, then NEXT GIVEAWAYS HERE with its three rows.
- **Scroll 1 (844-1688):** TEAMS THAT PLAY HERE ("Wild promos & giveaways"), PLAN YOUR VISIT (SpotHero, hotels via Expedia), a 250 px ad slot, GETTING IN (Gate 4 rideshare) and the start of PARKING LOTS.
- **Scroll 2 (1688-2532):** both ramps with their source line and "Official parking" link, then FOOD & DRINK "BY SECTION" (Carvery, Tap Wall, 7 Vines Vineyard and the rest), ending in "Show all 36 stands ›".

### 1.6 Not verifiable on this sample

The new sentence never renders here, because the building has lots. One adjacent surface the diff does not touch: the venue FAQ's parking answer (`src/components/venue-hub/VenueHubView.tsx`, which is not in the diff) is published, in the visible FAQ and the FAQPage JSON-LD, when the hub has usable lots **or a reachable `parkingLotMapUrl`**. Its text is fixed: "{Arena} has on-site lots{ including …}.". So a building with no lots, a lot-map URL and a `parkingNotes` would print "No venue lots; … directs fans to …" on its parking card and "{Arena} has on-site lots." in its FAQ, on the same page. No served page shows this today. It is recorded so the first page that carries `parkingNotes` is checked for it.

---

## URL 2: `/nhl/anaheim-ducks/promos/hockey-fights-cancer-night` (promo sample)

**How the sample was resolved.** https://www.getpromonight.com/sitemap.xml lists 1,354 promo URLs (`/{sport}/{team}/promos/{slug}`). I fetched each in sitemap order with a desktop Chrome User-Agent and read the first Event `startDate` in its JSON-LD. I compared its first ten characters, as a string, with "2026-11-15" (today plus 7 days in America/New_York). Candidates 1 to 73 are earlier. Candidate 74 is the first on or after it: **game date 2026-11-15** (Sunday, Nov 15, 2026, 5:00 PM PT, Honda Center). This is the same page as the earlier 2026-11-08 reviews. The same path was rendered on both environments.

Screenshots: `2026-11-08-feature-byg-vendor-parking/hockey-fights-cancer-night/{390,768,1280}-{branch,production}.png`. Diffs: `2026-11-08-feature-byg-vendor-parking/hockey-fights-cancer-night/{390,768,1280}-diff.png`.

### 2.1 Baseline differences

**There is no difference attributable to the diff.** The page has no parking surface the diff changes. There is no Before you go, no quick facts and no `/venues/` link. The only parking element is the "Parking" pill to SpotHero, which this diff does not touch. "directs fans to", "No venue lots" and `parkingNotes` each appear 0 times on both environments.

- **Served `<article>` HTML.** After normalization each side is 566 lines (branch 36,157 bytes, production 36,303). They differ in **one region**: the "Also on Ticketmaster" href, `https://www.ticketmaster.com/anaheim-ducks-tickets/artist/805893` on the branch against `https://ticketmaster.evyy.net/c/7236189/264167/4272?u=...&sharedid=web_promo_page_anaheim-ducks&subId3=hockey-fights-cancer-night` on production. This is the standing Impact env difference. The Event JSON-LD is byte-identical (same md5).
- **Pixels.**

  | Viewport | Branch PNG | Production PNG | Raw differing pixels (masked overlap) | Aligned per section |
  |---|---|---|---|---|
  | 390 | 390x5242 | 390x5292 | 75,344 of 2,044,380 = 3.69% (27.3% masked) | 0 in every section except THIS GAME, 100 px at x 25-50, y 787-793 (the dev-tools indicator). The raw figure is everything from MORE ANAHEIM DUCKS PROMOS down sitting 50 px lower on production, where the second content ad filled at 300 px |
  | 768 | 768x4170 | 768x4420 | **0** of 3,202,560 (44.4% masked) | 0 in every section |
  | 1280 | 1280x4085 | 1280x4135 | **0** of 5,228,800 (23.0% masked) | 0 in every section, compared at the same document offsets. The production capture is 50 px taller below the last section |

- **Measurements that moved.** Ad-driven only. CLS at 768 (0.0392 vs 0.0704; production adds a `google_ads_iframe` Footer container at 2.4 s), document height, the interactive and under-44 counts (production adds Raptive controls), and console errors. In-article targets, `/promos/` anchors, contrast, H1, `<time>`, dates, CTA and first ad anchor are identical.

### 2.2 Game date check

- **Dates on the page (390, both environments).** `<time datetime="2026-11-15T17:00:00-08:00">` reads "Sunday, Nov 15, 2026 · 5:00 PM PT" at 268 px. The date tile reads "SUN 15 NOV, IN 7 DAYS".
- **JSON-LD.** One Event, `startDate` "2026-11-15", with `offers` present and `eventStatus` EventScheduled. Identical on both environments.
- **Venue zone.** The page names Honda Center, Anaheim, and states PT, so the zone is America/Los_Angeles. Today there is 2026-11-08 (10:51 PST at the time of the check).
- **Verdict: upcoming, 7 days out. Not a played game.** Both environments correctly show the live state: Get tickets, Share, Also on Ticketmaster, Parking, Hotels and Remind me.

### 2.3 Three things that work

1. **When, where and against whom are on the first screen.** `390-branch.png`, top. The H1 is at 149 px, with "Anaheim Ducks vs Flames" under it. The zoned date and time is at 268 px and "Honda Center, Anaheim" at 298 px. The 52 px Get tickets button is at 336 px. Parking (123x44, to `tracking.spothero.com` at Honda Center's coordinates), Hotels and Remind me follow by 525 px.
2. **The primary CTA goes to this exact game.** "Get tickets" (144x52, new tab, `rel="noopener noreferrer sponsored"`) links to `ticketnetwork.lusg.net`. Its one hop is a 302 to `www.ojrq.net`, whose return URL is `goto.ticketnetwork.com/...tickets/8139280/anaheim-ducks-vs-calgary-flames-tickets-sun-nov-15-2026-honda-center`. Identical on both environments.
3. **The rail and back navigation hold.** The first card in MORE ANAHEIM DUCKS PROMOS, "SUN NOV 8 Kids' Socks Giveaway" (150x105), lands on H1 "KIDS' SOCKS GIVEAWAY". That is a recurring Sunday promo whose dates include Nov 15, which matches "Also at this game". Back restored scrollY exactly: 1,614 to 1,614 on the branch and 1,700 to 1,700 on production, 0 px on both.

### 2.4 Defects

**P1. Honda Center is not linked, and the page has no Before you go or quick facts. All viewports, both environments.** `390-branch.png` at 298 px. So the date-picked promo sample cannot exercise either promo-page surface this diff changes. Severity: low (carried; previously waived because the building is held unverified).

**P2. The wordmark "NIGHT" is 4.33:1 (#da2d20 on #f7f3ea, 18 px / 800). All viewports, both environments.** axe `color-contrast` (serious), 1 node. Severity: low (ruled brand color).

**P3. 33 of 51 interactive elements are under 44x44 at 390 (production 37 of 55).** Nine are in the article: "NHL" 24x18, "Anaheim Ducks" 84x18, "Also on Ticketmaster" 133x21, "nhl.com" 43x14, "Calgary Flames" 106x16, "Kids' Socks Giveaway" 149x16, "All Anaheim Ducks promos" 170x21, "Theme nights across pro sports" 198x21 and "Hockey Fights Cancer Night 2025-26" 249x16. Severity: low (carried, known-issues 78).

**P4. At 768 the first Raptive container's insertion is the whole first-party layout shift: 0.0392 on the branch (0.0383 from `SECTION.mt-6` at 795 ms), 0.0704 on production.** Severity: low (carried, known-issues 82).

---

## Measurements (390 unless noted)

| Measurement | URL 1 venue, branch | URL 1 venue, production | URL 2 promo, branch | URL 2 promo, production |
|---|---|---|---|---|
| HTTP status | 200 | 200 | 200 | 200 |
| `promonight-deploy` | absent (dev server) | dpl_62mKPLTaE5Qpkwjtc67NujmFmokF | absent (dev server) | dpl_62mKPLTaE5Qpkwjtc67NujmFmokF |
| Served HTML bytes | 394,133 | 144,305 | 425,610 | 139,505 |
| "directs fans to" / "No venue lots" (`grep -o`, whole document) | 0 / 0 | 0 / 0 | 0 / 0 | 0 / 0 |
| `parkingNotes` in served bytes | 1 (`null`, dev-only server-component props record) | 0 | 0 | 0 |
| Team page `/nhl/minnesota-wild`, same three counts | 0 / 0 / 1 (`null`, dev-only) | 0 / 0 / 0 | n/a | n/a |
| Main content HTML, normalized | `<main>` 567 lines; 1 differing region x2 (Ticketmaster wrap, env) | 567 lines | `<article>` 566 lines; 1 differing region (Ticketmaster wrap, env) | 566 lines |
| JSON-LD | identical (md5 bd7a2fa8…) | identical | identical (md5 9875674e…) | identical |
| Parking card / row | 2 lots (RiverCentre, Kellogg), pixel-identical at 390, 768, 1280 | same | Parking pill to SpotHero only | same |
| Pixel diff, raw, 390 / 768 / 1280 | 5.91% / 5.27% / 3.43% | (same comparison) | 3.69% / 0% / 0% | (same comparison) |
| Pixel diff, first-party regions at true offsets | 0 everywhere; remainder is ads, sticky player, fixed footer, dev "N" | (same comparison) | 0 everywhere but 100 px of dev indicator at 390 | (same comparison) |
| Document height, 390 / 768 / 1280 | 6,460 / 4,717 / 4,220 | 6,490 / 4,767 / 4,270 | 5,242 / 4,170 / 4,085 | 5,292 / 4,420 / 4,135 |
| Interactive / under 44x44, 390 | 45 / 39 (15 in `<main>`) | 49 / 43 (15) | 51 / 33 (9 in article) | 55 / 37 (9) |
| Under 44x44, 768 / 1280 | 44 of 51 / 45 of 51 | 48 of 55 / 49 of 55 | 38 of 57 / 39 of 57 | 39 of 58 / 40 of 58 |
| Contrast failures < 4.5:1 (text nodes checked) | 3 of 208: "NIGHT" 4.33, "›" 3.14, "→" 2.72 | 4 of 209: same + Raptive "×" 2.12 | 1 of 124: "NIGHT" | 2 of 125: "NIGHT", Raptive "×" |
| axe serious + critical, first party | `color-contrast` 1, `label-content-name-mismatch` 2 | same | `color-contrast` 1 | same |
| axe, ad-tech (inside `google_ads_iframe_*`) | none (ads unfilled) | `frame-title`, `image-alt`, `link-name` (768 adds `aria-command-name`; 1280 adds `frame-focusable-content`) | none | `aria-command-name`, `frame-focusable-content`, `frame-title`, `image-alt`, `link-name`, ad `color-contrast` 2 (768 adds `button-name`, `label`) |
| CLS during load + 5 s, 390 / 768 / 1280 | 0.0224 / 0.0010 / 0.0288 | 0.0224 / 0.0010 / 0.0294 | 0.0002 / 0.0392 / 0.0016 | 0.0002 / 0.0704 / 0.0013 |
| `<a>` to `/promos/`, DOM / visible, 390 (768 and 1280) | 11 / 9 (11 / 10) | 11 / 9 (11 / 10) | 21 / 19 (21 / 20) | 21 / 19 (21 / 20) |
| Hidden `/promos/` anchors | two "Today" links (desktop nav, closed menu) | same | same | same |
| First ad anchor from document top | `data-ad-region="content"` on the `<main>` wrapper `<div>` at 57 px; no `data-ad-item`; first content container at 1,196 px (empty, 250 px) | same; first container at 1,196 px (filled, 280 px) | `data-ad-region="content"` on `<article>` at 57 px; first container at 891 px (empty) | same; at 891 px (filled) |
| Game date(s) | none on a game line; giveaway rows 2026-11-25, 2026-11-27, 2026-12-12; no Event JSON-LD | same | `<time>` 2026-11-15T17:00-08:00; Event startDate 2026-11-15 | same |
| Played-game verdict | n/a, all dates upcoming | same | upcoming (7 days) | upcoming |
| Primary CTA | "SpotHero Reserve Parking" 334x56: `tracking.spothero.com`, 302 to `spothero.com` | same | "Get tickets" 144x52: `ticketnetwork.lusg.net`, 302 to `www.ojrq.net` | same |
| Rail card, label vs destination H1 | "Native American Heritage Night Hat" (227x20) / "NATIVE AMERICAN HERITAGE NIGHT HAT" (match) | same | "SUN NOV 8 Kids' Socks Giveaway" (150x105) / "KIDS' SOCKS GIVEAWAY" (match) | same |
| Back: scrollY before / after 6 s | team card 489 / 489 (0); from PARKING LOTS 1,522 / 1,782 (**+260**); from footer 4,831 / 5,538 (**+707**) | 489 / 489 (0); 1,572 / 1,832 (**+260**); 4,861 / 5,568 (**+707**) | 1,614 / 1,614 (0) | 1,700 / 1,700 (0) |
| Console errors / page errors, 390 | 25 / 0 | 16 / 1 (safeframe SecurityError) | 55 / 0 | 16 / 0 |

## One recommendation

Merge. On both sample pages, and on the Wild team page's served HTML, the branch is byte-identical to production in the main content apart from the standing Ticketmaster env wrap. The parking card is pixel-identical at all three widths, and "directs fans to" appears 0 times everywhere, as expected. The diff's only served trace is a dev-only `"parkingNotes":null` in React's debug props, which production does not ship. Because no page in this run can render the new sentence, the first building the pipeline gives a `parkingNotes` needs its own review: its venue page, a promo page there and its team page. Check that the FAQ does not still say "has on-site lots" next to "No venue lots" (1.6).

## Dispositions (merge rule, 2026-11-08)

Screenshots and diff images were not committed, following the other 2026-11-08 reports; they are kept outside the repo with the session's scratch files.

| Item | Disposition | Reason |
|---|---|---|
| Section 1.6 risk: the venue FAQ said "{Arena} has on-site lots" for a building with no lots but a lot map, and would contradict a vendor direction | **fixed in this branch** | VenueHubView.tsx: with no usable lots and a sourced vendor direction, the FAQ answer (markup and FAQPage JSON-LD) carries the same sentence as the parking card; test in parking-vendor.test.tsx covers the map-URL case. |
| V1 back does not restore the scroll position past the first ad (venue) | deferred, known-issues 86 | Present on production; the promo page's fix (overflow-anchor on the article) has not been applied to the venue page. |
| V2 axe label-content-name-mismatch on the SpotHero and Ticketmaster cards (venue) | deferred, known-issues 87 | Present on production; not touched by this diff. |
| V3 giveaway rows look tappable, only the title links (venue) | waived | Present on production; a row-link change is a layout pass outside this diff. |
| V4 bag size three times on the first screen; RIDESHARE "Available" without a place | waived | Present on production; venue page copy outside this diff. |
| V5 two links to the same directions page in the parking card | waived | Present on production; the card's official-links list, unchanged here. |
| V6 39 of 45 targets under 44x44 at 390 | known-issues 78 | Carried. |
| V7 wordmark 4.33:1, chevrons below 4.5:1 | waived | The wordmark color is kept by an earlier brand ruling; the chevrons are carried on every page. |
| V8 first-party layout shift 0.0224 / 0.0288 | known-issues 82 | Within budget; the same placement work. |
| V9 the H1 says "Bag Policy" over a whole gameday guide | waived | A venue title decision (the bag-answer title ruling), outside this diff. |
| V10 giveaways card narrower; GETTING IN half empty at 1280 | waived | Present on production; desktop layout outside this diff. |
| P1 Honda Center has no Before you go or quick facts | waived | Held unverified by owner ruling 3 (ticket T6); expected. |
| P2 wordmark contrast | waived | As V7. |
| P3 33 of 51 targets under 44x44 | known-issues 78 | Carried. |
| P4 first Raptive box is the layout shift at 768 | known-issues 82 | Carried. |

Follow-up the report asks for, taken: after the pipeline writes the first parkingNotes, check a vendor building's venue page, one of its promo pages and its team page in served HTML (the FAQ included).
