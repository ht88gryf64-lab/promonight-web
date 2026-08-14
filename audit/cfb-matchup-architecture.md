# CFB matchup architecture — Phase 0 read-only audit

**Measured 2026-08-10.** Production host `getpromonight.com`, iPhone UA, SSR HTML captured
2026-08-10. Fold positions measured in real Chrome at a true 390×844 viewport (same-origin
iframe, `getBoundingClientRect().top + scrollY`), not estimated from Tailwind classes.
Firestore read live, read-only. No repo file was modified; this file and
`audit/nfl-internal-linking.md` are the only two artifacts produced.

Analytics window referenced throughout: GSC/GA4/PostHog 2026-07-08 → 2026-08-05, all of which
pre-dates the 2026-08-07T16:59:27Z measurement boundary. CFB's 3.69 pages/session rests on n=35
sessions and is directional only.

---

## PART 0 — Shared template and linking survey

### 0.1 The five templates

| # | Surface | Route file | Notes |
|---|---|---|---|
| 1 | `/nfl/[slug]` | `src/app/[sport]/[team]/page.tsx` | **There is no `src/app/nfl/[slug]` directory.** `/nfl/<team>` and `/mlb/<team>` are the *same* route; the sport segment is derived, not a separate template. Live branch is `RedesignTeamPage` (`src/app/[sport]/[team]/page.tsx:250`, returns at `:252`); the legacy JSX at `:270-469` is dead in prod. |
| 2 | `/cfb` | `src/app/cfb/page.tsx` | Hub. |
| 2b | `/cfb/[school]` | `src/app/cfb/[school]/page.tsx` → `src/components/cfb/CfbSchoolPage.tsx` | 86 pages, one template. |
| 3 | `/promos/*` | `src/app/promos/bobbleheads/page.tsx` (→ `src/components/aggregator-layout.tsx:56,60`), `src/app/promos/today/page.tsx`, `src/app/best-promos/page.tsx` | **Not one template.** Only `/promos/bobbleheads` goes through `AggregatorPage`; the other two hand-roll their layouts. |
| 4 | `/mlb/[slug]` | `src/app/[sport]/[team]/page.tsx` | Same file as #1. |
| 5 | `/venues/[slug]` | `src/app/venues/[slug]/page.tsx` → `src/components/venue-hub/VenueHubView.tsx` | |

Gate: `isRedesignEnabled()` at `src/lib/redesign.ts:16-21` is ON in prod, confirmed from served
markup (`rd-root` wrapper from `src/components/redesign/RedesignTeamPage.tsx:143` on all 11 pages;
the legacy footer's `All 169 teams` heading from `src/components/footer-team-sitemap.tsx:34` on none).

### 0.2 Shared chrome — identical on every page, enumerated once

Verified programmatically across all 11 captured pages: the leading 21 anchor hrefs are
byte-identical in the same order on 11/11, and the trailing 18 are identical on 11/11. **Chrome is
always exactly 39 anchors: DOM 1–21 (nav) and the last 18 (footer). Body = index 22 … total−18.**
The only varying byte is the footer CTA's `?source=` query (`src/lib/follow-surface.ts:103-118`).

| DOM | Text | Destination | Rendered by | Above fold @390 |
|---|---|---|---|---|
| 1 | PROMO NIGHT (wordmark) | `/` | `src/components/redesign/BrandBar.tsx:43` | **YES** (y=19) |
| 2–4 | Today / Teams / My Teams | `/promos/today`, `/teams`, `/my-teams` | `src/components/redesign/BrandBar.tsx:55` (hrefs `:34-36`) | NO — `hidden … md:flex` at `BrandBar.tsx:53` |
| 5 | About | `/about` | `src/components/redesign/BrandBar.tsx:60` | NO |
| 6–10 | MLB / WNBA / MLS / NFL / CFB | `/mlb`,`/wnba`,`/mls`,`/nfl`,`/cfb` | `src/components/redesign/BrandBarLeagueHubs.tsx:68` over `LEAGUE_HUBS` (`src/lib/league-hubs.ts:36`) | NO — `hidden md:block` at `BrandBar.tsx:68` **and** `hidden` while closed at `BrandBarLeagueHubs.tsx:65` |
| 11 | Get the App | `/download` | `src/components/redesign/BrandBar.tsx:73` → `Button.tsx:78` | NO |
| 12–21 | Full duplicate of 2–11 | same 10 hrefs | `src/components/redesign/BrandBarMobileMenu.tsx:93, :98, :108, :116` | NO — closed `<dialog>`; children stay mounted per `src/components/ui/modal.tsx:27-28` |
| −18 | Get every giveaway in your inbox → | `/follow?source=…` | `src/components/follow/FollowFooterCTA.tsx:27`, mounted `Footer.tsx:100` | NO |
| −17…−11 | 7 Browse links | `/promos/*`, `/teams` | `src/components/redesign/Footer.tsx:71` (list `:23-31`) | NO |
| −10…−6 | 5 Discover links | `/best-promos`, `/team-rankings`, `/venues`, `/world-cup`, `/follow` | `src/components/redesign/Footer.tsx:71` (list `:46-52`) | NO |
| −5…−2 | 4 Company links | `/about`,`/download`,`/privacy`,`/terms` | `src/components/redesign/Footer.tsx:71` (list `:33-39`) | NO |
| −1 | Contact | `mailto:` | `src/components/redesign/Footer.tsx:64` | NO |

**The CFB pages do not have different chrome.** `find src/app -name layout.tsx -o -name template.tsx`
returns exactly one file, `src/app/layout.tsx`; `src/components/cfb/` contains no nav or footer
component, and `CfbThemePersist.tsx:6-11` is a localStorage-only effect returning null. The one
thing that *looks* like CFB chrome — the "← College Football" link at DOM 22 on both school pages —
is body content emitted at `src/components/cfb/CfbSchoolPage.tsx:82`.

Two further corrections worth recording: **the footer team sitemap does not exist in production**
(`FooterTeamSitemap` is imported only by the dead-in-prod `src/components/footer.tsx:3`;
`grep -l "All 169 teams"` matches zero of the 11 captured pages), and **at 390px exactly one chrome
anchor is visible — the wordmark.**

### 0.3 Body-zone inventories

Chrome is excluded below. "AF" = above the fold at a measured 390×844 viewport.

#### 1. `/nfl/[slug]` — `/nfl/dallas-cowboys` (zero-promo branch), 30 body anchors / 22 internal

| DOM | y px | Text | Destination | Rendered by | AF |
|---|---|---|---|---|---|
| 22 | 122 | NFL (hero eyebrow) | `/nfl` | `RedesignTeamPage.tsx:128` (href `:89-90`, slot `Hero.tsx:47-51`) | **YES** |
| 23–27 | 4018–4298 | 5 affiliate CTAs | EXT | `TicketmasterCTA.tsx:165` & `:141`, `SpotHeroCTA.tsx:80`, `ExpediaCTA.tsx:60`, `FanaticsCTA.tsx:49`, all via `tracked-affiliate-link.tsx:77`, mounted `AffiliateRail.tsx:41-47` | NO |
| 28 | 4365 | Full gameday guide | `/venues/att-stadium` | `VenueHubLink.tsx:63` (href `:45`), mounted `AffiliateRail.tsx:56-63` | NO |
| 29 | 5100 | Official bag policy ↗ | EXT | `venue-info-block.tsx:68` (gate `:64`) | NO |
| 30–35 | 7006–7298 | ExploreCard ×6 | `/promos/bobbleheads`, `/promos/this-week`, `/promos/jersey-giveaways`, `/promos/theme-nights`, `/promos/food-deals`, `/teams?league=NFL` | `ExploreCard.tsx:51` (items `:32-40`) | NO |
| 36 | 5404 | Schedule-release video | YouTube (EXT) | `ScheduleReleaseVideoCard.tsx:106-107` | NO |
| 37–44 | 973–3164 | 8 "\<Team\> schedule" | `/nfl/[opponent]` | `ScheduleRow.tsx:175`, href `ScheduleBlock.tsx:188-191`, passed `:220-221` | NO |
| 45–47 | 3512–3810 | 3 rival cards | `/nfl/[rival]` | `team-card.tsx:72-73` via `DivisionRivals.tsx:34` | NO |
| 48–51 | 6487–7486 | Follow / Download / Play Store / Hot promos this week | `/follow`, `/download`, EXT, `/promos/this-week` | `EmailCtaLink.tsx:36`, `app-download-buttons.tsx:27,:38`, `team-related-aggregators.tsx:62` | NO |

Rams (populated branch): same template, **21 body / 14 internal**, with **zero** schedule-opponent
anchors and no bag-policy link. The 9-anchor delta is exactly 8 opponent anchors + 1 external link.

#### 2. `/cfb` and `/cfb/[school]`

`/cfb` hub — 180 body anchors, 179 internal, **151 distinct internal destinations**:

| DOM | Count | Destination | Rendered by | AF (measured) |
|---|---|---|---|---|
| 22 | 1 | `#browse` (in-page) | `src/app/cfb/page.tsx:67` | YES (y=424) |
| 23 | 1 | `/promos/today` | `src/components/cfb/hub/CfbTodaySlot.tsx:23` — the hub's only editorial cross-link, hard-coded | **YES** (y=625) |
| 24–39 | 16 | `/cfb/[school]` — weekly-rail corner names, 8 cards × 2 | `src/components/cfb/hub/blocks.tsx:19` (`CornerName`) via `:73-74` | **YES — all 16 at y=725** |
| 40–47 | 8 | `/cfb/[school]` — 4 NationalBlocks × 2 (The Game, Iron Bowl, Red River Rivalry, The Cocktail Party) | `src/components/cfb/hub/blocks.tsx:19` via `:53-54`; curated list `src/lib/cfb/hub-data.ts:54-59` | NO (y=1014+) |
| 48–51 | 4 | `/cfb/[school]` — ThemeCards (Penn State, Tennessee, LSU, Iowa State) | `src/components/cfb/hub/blocks.tsx:93`; curated `src/lib/cfb/hub-data.ts:66-71` | NO |
| 52–137 | 86 | `/cfb/[school]` — browse-all grid, conference-bucketed SEC 16 / Big Ten 18 / ACC 17 / Big 12 16 / G5 17 / Independents 2 | `src/components/cfb/hub/CfbHubBrowse.tsx:37` (href `:39`), all rendered at `:75` | NO |
| 138–201 | 64 | `/venues/[slug]` — stadium guides | `src/components/hub/HubVenueLinks.tsx:41` (href `:38`), gated `src/app/cfb/page.tsx:114` | NO |

Two emitters produce 150 of the 179 (`CfbHubBrowse` 86 = 48%, `HubVenueLinks` 64 = 36%). The browse
grid is deliberately never conditionally rendered — the conference selector and search box are an
inline `display:none` filter only (`CfbHubBrowse.tsx:41`, rule stated in the file header at `:3-8`).
`CfbHubSearch.tsx:38` *does* contain a `/cfb/{id}` link but only renders when
`open && matches.length > 0` (`:34`) and `matches` is `[]` for an empty query (`:16`), so it
contributes zero anchors to served HTML.

The hub anchor count is **not fixed**: the weekly rail was in its offseason branch at capture
(`upcoming.slice(0, 8)` at `src/lib/cfb/hub-data.ts:137`, and the served HTML reads
"NEXT UP · RIVALRY GAMES"). In season the branch at `:136` allows up to 12 cards / 24 anchors, so
the hub ranges 218→234 internal on the same code.

`/cfb/alabama` — 18 body anchors, **3 internal**:

| DOM | y px | Text | Destination | Rendered by | AF |
|---|---|---|---|---|---|
| 22 | 95 | ← College Football | `/cfb` | `src/components/cfb/CfbSchoolPage.tsx:82` | **YES** |
| 23–27 | 754–1053 | 5 affiliate CTAs | EXT | adapters at `src/lib/cfb/page-extras.ts:82-124` | NO |
| 28 | 1120 | Full gameday guide | `/venues/saban-field-at-bryant-denny-stadium` | `VenueHubLink.tsx:63` (href `:45`), gate `CfbSchoolPage.tsx:203`, resolved `src/app/cfb/[school]/page.tsx:45` | NO |
| 29–33 | 1573–2056 | "Battle for Highway 82", "Alabama–Georgia", "Third Saturday in October", "Alabama–LSU", "James E. Foy, V-ODK Sportsmanship Trophy" | **en.wikipedia.org (EXTERNAL)** | `src/components/cfb/cfb-bits.tsx:33-44` (`TrophyTag` in schedule rows) | NO |
| 34–38 | 2575–3013 | the same five names again | **en.wikipedia.org (EXTERNAL)** | `src/components/cfb/CfbSchoolPage.tsx:262-271` (rivalry-card titles) | NO |
| 39 | 3334 | Contribute to this page | `/cfb/contribute?school=alabama` | `src/components/cfb/CfbSchoolPage.tsx:303` (href `:304`) | NO |

#### 3. `/promos/*` and `/best-promos`

| Page | Body anchors | Body internal | Distinct body internal | AF internal | First contextual link |
|---|---|---|---|---|---|
| `/promos/bobbleheads` | 89 | 85 | 32 | 2 | `/mlb/los-angeles-dodgers` at y=848 |
| `/promos/today` | 156 | 42 | 19 paths / 41 hrefs | 3 | `/mlb` hub link at y=576, first card y=614 |
| `/best-promos` | 152 | 52 | 21 | 3 | `/best-promos/bobbleheads` at y=651, first card y=961 |

| Slot | Count | Destination | Rendered by |
|---|---|---|---|
| bobbleheads: promo rows | 79 | `/[sportSlug]/[teamId]` → **29 distinct team pages** (MLB 24, MLS 2, WNBA 2, NFL 1) | `src/components/redesign/RedesignAggregatorList.tsx:147` |
| bobbleheads: "Earlier this season" | 3 | 3 MLB team pages | `src/components/redesign/PastBobbleheadsSection.tsx:42` (`LIFT_VISIBLE=3` at `:17`, applied `:84`) |
| today: league headers | 3 | `/mlb` ×2, `/wnba` | `src/components/promos-today/TodayLeagueSection.tsx:39-40`, gated `:38` (href `helpers.ts:50`) |
| today: promo cards | 38 | `/[sport]/[team]#promo-…` → **16 distinct team pages** | `src/components/redesign/RedesignPromoRow.tsx:132`, href `src/components/promos-today/TodayPromoCard.tsx:29` |
| best-promos: scored cards | 50 | `/[sport]/[team]` → **19 distinct**, all MLB | `src/components/scoring/scored-promo-card.tsx:68`, mounted `best-promos-browser.tsx:232` |
| best-promos: sibling collection | 1 | `/best-promos/bobbleheads` | `src/app/best-promos/page.tsx:210` |
| today: planning-ahead card | 1 | `/promos/this-week` | `src/app/promos/today/page.tsx:211` |
| bobbleheads only: breadcrumb / app / follow | 3 | `/`, `/download`, `/follow` | `aggregator-layout.tsx:87`, `:142`, `:160` |

#### 4. `/mlb/[slug]` — `/mlb/los-angeles-dodgers`, 111 body anchors / **27 internal, 84 external**

| DOM | Slot | Destination | Rendered by |
|---|---|---|---|
| 22 | Hero eyebrow (y=122, **AF**) | `/mlb` | `RedesignTeamPage.tsx:128` |
| 28 | Full gameday guide (y=1684) | `/venues/dodger-stadium` | `VenueHubLink.tsx:63` |
| 30–35 | ExploreCard ×6 | `/promos/*` ×5 + `/teams?league=MLB` | `ExploreCard.tsx:51` |
| 54,59,64,75,80,85,90,95,100 | 9 "View … full schedule" | `/mlb/colorado-rockies` ×3, `/mlb/atlanta-braves` ×3, `/mlb/detroit-tigers` ×3 | `GameExpand.tsx:221-222` via `CalendarGrid.tsx:437` |
| 122–125 | 4 rival cards (NL West) | `/mlb/[rival]` | `team-card.tsx:72-73` via `DivisionRivals.tsx:34` |
| 126–127, 129–132 | Follow / Download / 4 aggregator cards | `/follow`, `/download`, `/promos/*` | `EmailCtaLink.tsx:36`, `app-download-buttons.tsx:27`, `team-related-aggregators.tsx:62` |
| — | 84 external | 29× TicketNetwork + 29× Ticketmaster + 10× SpotHero + 10× Expedia + 3× eBay + Fanatics + mlb.com + Play Store | `GameExpand.tsx:191-217`, `AffiliateRail.tsx:41-47`, `promo-list.tsx:208` |

**The Dodgers' largest content block — a 46-promo `PromoList` — emits zero internal anchors.**
`RedesignTeamPage.tsx:318-332` mounts it without an `href` prop, so every row takes
`RedesignPromoRow`'s modal-opener branch (`openable = interactive && !!team && !href`, `:95`) and
the stretched `<Link>` at `:131-137` never renders.

#### 5. `/venues/[slug]` — `/venues/acrisure-stadium`, 14 body anchors / **3 internal**

| DOM | y px | Text | Destination | Rendered by | AF |
|---|---|---|---|---|---|
| 22 | 380 | Official bag policy › | EXT | `VenueHubView.tsx:296` | YES |
| 23 | 454 | (promo card overlay) | `/nfl/pittsburgh-steelers#promo-…` | `RedesignPromoRow.tsx:132`, href `VenueHubPromoCard.tsx:39` | **YES** |
| 24 | 679 | Steelers promos & giveaways | `/nfl/pittsburgh-steelers` | `HubTeamLink.tsx:68`, mounted `VenueHubView.tsx:311-329` | **YES** |
| 25 | 760 | Pittsburgh gameday guide | `/cfb/pittsburgh` | `HubTeamLink.tsx:68` | **YES** |
| 26–35 | 890–1913 | 10 external (5 unique, doubled by the mobile/desktop copies at `VenueHubView.tsx:509,:513,:520-521`) | EXT | — | NO |

Tenant hrefs come from `resolveTenantTeamLinks` (`src/lib/venue-hub.ts:400-415`): pro →
`/{sportSlug}/{id}` (`:411`), **CFB → `/cfb/{id}` (`:408`)**; unresolvable tenants are skipped
(`:406-412`). The block is *not* gated on `hub.verified` (comment `VenueHubView.tsx:306-310`), so
held buildings still link back. **Venue→venue links: ABSENT.**

### 0.4 The comparison

| Surface | pages/session | Total anchors | Body | Body internal | Distinct body internal | **Internal links above fold @390×844** | First *contextual* internal link | Doc height |
|---|---|---|---|---|---|---|---|---|
| `/nfl` hub | — | 166 | 127 | 127 | 64 | **65** | y=740 | 8370 |
| `/cfb` hub | 3.69 (section) | 219 | 180 | 179 | 151 | **18** | y=725 | 9786 |
| `/promos/today` | 2.41 (section) | 195 | 156 | 42 | 19 | **3** | y=576 | 11372 |
| `/best-promos` | 2.41 (section) | 191 | 152 | 52 | 21 | **3** | y=651 | — |
| `/promos/bobbleheads` | 2.41 (section) | 128 | 89 | 85 | 32 | **2** | y=848 | 12237 |
| `/venues/[slug]` | 1.24 | 53 | 14 | 3 | 3 | **4** | y=454 | 3939 |
| `/cfb/[school]` | 3.69 (section) | 57 | 18 | 3 | 3 | **2** | y=1120 | 4660 |
| `/nfl/[team]` (Cowboys) | 1.37 | 69 | 30 | 22 | 18 | **2** | y=973 | 10682 |
| `/nfl/[team]` (Rams) | 1.37 | 60 | 21 | 14 | 13 | **2** | y=1734 | 8534 |
| `/mlb/[team]` (Dodgers) | 1.19 | 150 | 111 | 27 | 16 | **2** | y=1684 | 15543 |

**What `/promos` and `/cfb` carry that `/nfl` and `/mlb` do not**

1. **Every content row is itself an anchor.** `RedesignAggregatorList.tsx:147` (79 → 29 team pages),
   `scored-promo-card.tsx:68` (50 → 19), `RedesignPromoRow.tsx:132` driven by
   `TodayPromoCard.tsx:29` (38 → 16). A team page mounts the *same component* without an `href`
   (`promo-list.tsx:252`, `:311`), and `RedesignPromoRow` renders its stretched `<Link>` only when
   `href` is set (`:131-137`). **A one-prop difference in a shared component; the largest
   structural gap in the survey.**
2. **A dense contextual grid above the fold.** `/cfb` puts 16 school anchors at y=725
   (`blocks.tsx:19` via `:73-74`); `/nfl` (hub) puts 65 at y=740. A team page's first contextual
   link is at y=973 / y=1684 / y=1734.
3. **Per-promo fragment deep links** (`TodayPromoCard.tsx:29` + `src/lib/promo-helpers.ts:27`,
   mirrored as the team-page row's DOM id at `promo-list.tsx:259`). No team page emits one outbound.
4. **Contextual league-hub links that vary with data** (`TodayLeagueSection.tsx:38-46`, href from
   `helpers.ts:50`). A team page has one fixed up-link.
5. **A conference-bucketed browse-all grid** (`CfbHubBrowse.tsx:37`, rendered `:75`) and a
   **64-item stadium-guide list** (`HubVenueLinks.tsx:41`) — 150 of the hub's 179 body anchors.

**What the `/promos` family conversely lacks versus a team page** — reported because it cuts
against the hypothesis: no cross-aggregator "browse other collections" grid (`BrowseCollections`
exists at `src/components/browse-collections.tsx:24` with one caller, `src/app/page.tsx:393`);
category chips and league filters emit **zero** anchors (all `<button>`:
`RedesignAggregatorList.tsx:29-53`, `TodayBoardFilter.tsx:24-48`, `best-promos-browser.tsx:214,:219`);
pagination emits zero and on `/best-promos` **hides 250 team links** (`PAGE_SIZE=50` at
`best-promos-browser.tsx:43,:113,:134` against a declared "300 promos ranked"); no venue link, no
rivals grid, no opponent anchors.

**Verdict on the hypothesis** — *"pages/session tracks the count and placement of contextual
outbound links, not content length."*

**The code CONTRADICTS the count half and PARTIALLY SUPPORTS the placement half.**

- `/cfb/[school]` has **3** body-internal links — the thinnest page measured — and sits inside the
  best-performing section (3.69).
- `/promos/bobbleheads` has **85** and its section runs 2.41, below CFB.
- `/venues/[slug]` has **4** internal links above the fold — more than any team page and more than
  `/promos/bobbleheads` — and runs **1.24**.

Content length is likewise refuted as an inverse: the Dodgers page is the longest document
measured (15,543px) with the second-worst engagement; `/cfb/[school]` is the second shortest
(4,660px) inside the best section.

What the code does support:

- **Section pages/session is dominated by which page is the entry point.** CFB's 3.69 is a *hub*
  property, not a school-page property: `/cfb` offers 151 distinct destinations with 16 above the
  fold; `/cfb/[school]` offers 3. On n=35 sessions this is directional only.
- **Among leaf pages, what separates them is whether the primary content block is navigable.**
  Aggregators: yes (`RedesignAggregatorList.tsx:147`). Team pages: no (`promo-list.tsx:252`).
- **Placement alone is not sufficient** — `/venues/[slug]` puts a contextual link at y=454 and
  still underperforms, because it offers only 3 distinct internal destinations. A fold placement
  with nowhere to go does not compound.

---

## PART B — CFB matchup architecture

### B1. Current `/cfb` route inventory

`src/app/cfb/` contains exactly three files: `page.tsx`, `[school]/page.tsx`, `contribute/page.tsx`.

| URL pattern | `<title>` (served) | H1 (served) | Unit | Schedule/time-led? |
|---|---|---|---|---|
| `/cfb` | `College Football Rivalries & Gameday 2026 \| PromoNight` — literal at `src/lib/cfb/metadata.ts:175` + root template `%s \| PromoNight` at `src/app/layout.tsx:58` | `The rivalries, the road trips, and every Saturday that matters.` — `src/app/cfb/page.tsx:59-61` | **Hub** (index of schools) | **No.** Title leads with "Rivalries"; H1 contains no head term at all. The "COLLEGE FOOTBALL · 2026" string is a `<div>` eyebrow at `src/app/cfb/page.tsx:57`, not a heading. |
| `/cfb/[school]` ×86 | `Alabama Football Schedule 2026: Iron Bowl \| PromoNight` — candidate chain `src/lib/cfb/metadata.ts:111-124`, winning candidate `:114` (`${s.name} Football Schedule ${YEAR}: ${feat.token}`), token from the MARQUEE entry at `metadata.ts:33` selected by `selectFeaturedRivalry` at `:64-84`. Auburn: `Auburn Football Schedule 2026: Iron Bowl \| PromoNight` | `Alabama` — `src/components/cfb/CfbSchoolPage.tsx:91-96`, from `school.name` only | **School** | **FLAG — YES.** The title's head term is "Football Schedule 2026"; the rivalry token is a suffix. Description at `metadata.ts:150-155` leads "Alabama Crimson Tide 2026 football schedule, the Iron Bowl vs Auburn, plus tickets, …" (rivalClause `:136-140`). Per the brief's Ahrefs finding, schedule-intent is unwinnable against Google's own sports panel; **all 86 school pages carry a schedule-led title.** |
| `/cfb/contribute` | `Contribute: College Football Gameday \| PromoNight` — `src/app/cfb/contribute/page.tsx:16` | `Tell the story of a {shortName} Saturday` — `src/app/cfb/contribute/page.tsx:36` | **Form** (school-scoped via `?school=`) | No. `robots: { index: false, follow: true }` at `:19`; `dynamic = 'force-dynamic'` at `:11`; absent from the sitemap. **This is the in-repo precedent for a static `/cfb/*` sibling that exists but is not sitemap-listed.** |

**There is no matchup route, no trophy route and no rivalries index.** The sitemap emits only
`/cfb` (via the hub registry loop, `src/app/sitemap.ts:85-90`, `LEAGUE_HUB_REGISTRY` row
`src/lib/league-hubs.ts:31`) and `/cfb/{schoolId}` (`src/app/sitemap.ts:66`).

**Heading-structure gap, adjacent to B1.** On both CFB templates the only `<h2>` elements in served
HTML are the three footer column headings (`src/components/redesign/Footer.tsx:57`). Every CFB
section label is a `<div>`: `Eyebrow` at `src/components/cfb/cfb-bits.tsx:53` (school page) and
`SectionLabel` at `src/app/cfb/page.tsx:29` (hub). So "2026 Schedule", "Rivalry Games",
"Plan your gameday", "BROWSE ALL 86 TEAMS" and "STADIUM GUIDES" carry no heading semantics.
Neither template emits `BreadcrumbList` JSON-LD; `/cfb/[school]` emits only a `SportsTeam` object
(`src/app/cfb/[school]/page.tsx:56-62`) and `/cfb` emits none.

**Four editorial blocks in the school template never fire today**, because
`src/lib/cfb/data.ts:255` hard-codes `editorial` to all-null for every school: the signature-game
card (`CfbSchoolPage.tsx:142-170`), "Why you go" (`:171-176`), "Gameday & Traditions" (`:229-236`)
and the venue-editorial block (`:288-295`). Confirmed against served HTML — "Your signature game"
appears on neither Alabama nor Auburn. None of them would add internal links even when populated.

### B2. Can a matchup page be generated today from existing data?

#### Field-name reference (interfaces read in full)

| Interface | File:line | Fields |
|---|---|---|
| `CfbSchool` | `src/lib/cfb/types.ts:25-40` | id, name, shortName, mascot, primaryColor, secondaryColor, colorsSource, conferenceBySeason, venueId, **traditionIds (`:37`)**, editorialStatus, updatedAt |
| `CfbKickoff` | `src/lib/cfb/types.ts:85-90` | time (`:86`), tz (`:87`, spec says IANA), tbd (`:88`), windowFlex (`:89`) |
| `CfbThemeDesignation` | `src/lib/cfb/types.ts:97-103` | **traditionId (`:98`, ref into cfbTraditions)**, displayName, source, confidence, announcedAt |
| `CfbGame` | `src/lib/cfb/types.ts:122-145` | id, season, week, **date (`:126`)**, status, **homeSchoolId/awaySchoolId (`:128-129`)**, neutralSite, venueId, kickoff, broadcast, conferenceGame, **rivalryId**, themeDesignations, source, confidence, fetchedAt, **verified (`:143`, "gates production display")**, verification |
| `CfbRivalry` | `src/lib/cfb/types.ts:148-159` | id, **name (`:150`)**, **schoolIds (`:151`)**, **trophy (`:152`)**, **seriesStartYear (`:153`)**, **trophyCreatedYear (`:154`)**, **dormant (`:155`)**, **narrative? (`:156`, optional)**, source, updatedAt |
| `CfbTradition` | `src/lib/cfb/types.ts:162-173` | id, **schoolId (`:164`)**, name, kind (`:166`), **dressCode (`:167`)**, **narrative? (`:168`)**, recurring, editoriallySeeded, source, updatedAt |
| Readers | `src/lib/cfb/data.ts:167-182` | loadSchools / loadVenues / loadRivalries / loadGames — full-collection reads, TTL-cached. **No loader for `cfbTraditions`.** |

#### `cfbRivalries` full field census (n=212)

| Field | Key present | Populated | Note |
|---|---|---|---|
| `id` | 212 | 212 | equals doc id on all 212 |
| `name` | 212 | 212 | 88 carry a trophy; 27 more are genuine names; 97 are auto `SchoolA–SchoolB` pair labels |
| `schoolIds` | 212 | 212 | `length == 2` on 212/212, zero exceptions |
| `trophy` | 212 | **88** | 124 explicitly `null` |
| `seriesStartYear` | 212 | 212 | numeric on 212/212 |
| `trophyCreatedYear` | 212 | **11** | 201 explicitly `null` — of the 88 trophy-bearing rivalries only 11 have a creation year |
| `dormant` | 212 | 212 | true = 104, false = 108 |
| **`narrative`** | **0** | **0** | **the key does not exist on a single doc**; declared optional at `src/lib/cfb/types.ts:156` and never written |
| `source` | 212 | 212 | |
| `updatedAt` | 212 | 212 | |

**The one perfect predictor:** `dormant` is a 104/104 exact proxy for "no 2026 game". Every
`dormant:true` rivalry has no 2026 `cfbGames` doc, and every `dormant:false` rivalry has one. Zero
exceptions across 212 docs, cross-checked from the games side (111 games carry a non-null
`rivalryId`, resolving to 108 distinct ids; the 3 extras are duplicate home/away docs for Army-Navy,
Florida-Georgia and Navy-Notre Dame).

#### The verdict bar used, stated explicitly

**GENERATE** = (1) a 2026 `cfbGames` doc whose `{homeSchoolId, awaySchoolId}` equals the rivalry's
`schoolIds` pair, (2) a date, (3) a **resolvable** venue. Venue resolves from `cfbGames.venueId`
when non-empty, else from the home school's `cfbSchools.venueId` when `neutralSite:false` — that is
exactly the fallback the shipped reader already performs (`src/lib/cfb/data.ts:216` and `:237-238`),
so it costs zero new data.

`verified:true` and an announced kickoff are **not** blockers. The shipped display gate degrades to
"Kickoff TBA" for unverified/TBD games (`src/lib/cfb/data.ts:111-123`) and `getCfbSchoolPage`
pushes every game regardless of `verified` (`:226-247`). Production proves it: the Iron Bowl game
is `verified:false` yet renders on `/cfb/alabama` with `kickoffDisplay` "Kickoff TBA" plus the full
rivalry sentence.

**Partition declared:** NAMED = 115 (trophy non-null OR name is *not* the auto `SchoolA–SchoolB`
pair label); GENERIC = 97 (no trophy AND name is exactly the pair label). All 115 NAMED rows are
emitted in full below; the 97 GENERIC rows are rolled up by blocking reason. 88 have a trophy, 27
have a real name without a trophy, 0 have both a pair-label name and a trophy.

#### B2 table — Partition A: all 115 NAMED rivalries

| name | trophy | schoolIds | seriesStartYear | trophyCreatedYear | dormant | 2026 cfbGames doc resolves? | verified:true? | date? | venueId? | neutralSite? | kickoff.time or tbd? | narrative? | verdict |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| $5 Bits of Broken Chair Trophy | $5 Bits of Broken Chair Trophy | minnesota + nebraska | 1900 | null | true | NO | n/a | n/a | n/a | n/a | n/a | ABSENT | BLOCKED: no 2026 cfbGames doc for this schoolIds pair |
| Apple Cup | Apple Cup Trophy | washington + washington-state | 1900 | 1963 | false | YES `2026-2026-09-06-washington-washington-state` | yes | 2026-09-06 | `husky-stadium` | false | 1:00 PM PT | ABSENT | GENERATE |
| Arch Rivalry | Arch Rivalry Trophy | illinois + missouri | 1896 | null | true | NO | n/a | n/a | n/a | n/a | n/a | ABSENT | BLOCKED: no 2026 cfbGames doc for this schoolIds pair |
| Army–Navy Game | null | army + navy | 1890 | null | false | YES `2026-2026-12-12-army-navy` | yes | 2026-12-12 | EMPTY (no fallback) | true | 3:00 p.m. ET | ABSENT | BLOCKED: cfbGames.venueId (empty, neutralSite:true so no home-school fallback) |
| Backyard Brawl | null | pittsburgh + west-virginia | 1895 | null | true | NO | n/a | n/a | n/a | n/a | n/a | ABSENT | BLOCKED: no 2026 cfbGames doc for this schoolIds pair |
| Battle for Highway 82 | null | alabama + mississippi-state | 1896 | null | false | YES `2026-2026-10-03-mississippi-state-alabama` | no | 2026-10-03 | `davis-wade-stadium` | false | tbd | ABSENT | GENERATE |
| Battle for Nevada | Fremont Cannon | nevada + unlv | 1969 | null | true | NO | n/a | n/a | n/a | n/a | n/a | ABSENT | BLOCKED: no 2026 cfbGames doc for this schoolIds pair |
| Battle for the Bell | Victory Bell | cincinnati + miami-oh | 1888 | null | false | YES `2026-2026-09-19-cincinnati-miami-oh` | yes | 2026-09-19 | EMPTY (no fallback) | true | 3:30 PM ET | ABSENT | BLOCKED: cfbGames.venueId (empty, neutralSite:true so no home-school fallback) |
| Battle for the Bell | The Bell | marshall + ohio | 1905 | null | true | NO | n/a | n/a | n/a | n/a | n/a | ABSENT | BLOCKED: no 2026 cfbGames doc for this schoolIds pair |
| Battle for the Bell | The Bell | southern-miss + tulane | 1979 | null | false | YES `2026-2026-09-26-tulane-southern-miss` | no | 2026-09-26 | `yulman-stadium` | false | tbd | ABSENT | GENERATE |
| Battle for the Bones | The Bones | memphis + uab | 1997 | null | false | YES `2026-2026-10-10-memphis-uab` | no | 2026-10-10 | `simmons-bank-liberty-stadium` | false | tbd | ABSENT | GENERATE |
| Battle for the Iron Skillet | Iron Skillet | smu + tcu | 1915 | null | true | NO | n/a | n/a | n/a | n/a | n/a | ABSENT | BLOCKED: no 2026 cfbGames doc for this schoolIds pair |
| Battle for the Land Grant | Land Grant Trophy | michigan-state + penn-state | 1914 | null | true | NO | n/a | n/a | n/a | n/a | n/a | ABSENT | BLOCKED: no 2026 cfbGames doc for this schoolIds pair |
| Battle for the Rag | Tiger Rag | lsu + tulane | 1893 | null | true | NO | n/a | n/a | n/a | n/a | n/a | ABSENT | BLOCKED: no 2026 cfbGames doc for this schoolIds pair |
| Battle for the Valley | Valley Trophy | fresno-state + san-jos-state | 1921 | null | true | NO | n/a | n/a | n/a | n/a | n/a | ABSENT | BLOCKED: no 2026 cfbGames doc for this schoolIds pair |
| Battle Line Rivalry | Battle Line Trophy | arkansas + missouri | 1906 | 2015 | false | YES `2026-2026-10-31-arkansas-missouri` | no | 2026-10-31 | EMPTY (derived `donald-w-reynolds-razorback-stadium`) | false | tbd | ABSENT | GENERATE |
| Battle of I-75 Trophy | Battle of I-75 Trophy | bowling-green + toledo | 1919 | null | false | YES `2026-2026-11-20-toledo-bowling-green` | no | 2026-11-20 | `glass-bowl` | false | 7:30 PM ET | ABSENT | GENERATE |
| Battle of the Blue Ridge | null | james-madison + liberty | 1980 | null | false | YES `2026-2026-09-05-james-madison-liberty` | yes | 2026-09-05 | EMPTY (derived `bridgeforth-stadium-and-zane-showker-field`) | false | 12:00 PM ET | ABSENT | GENERATE |
| Battle of the Brazos | null | baylor + texas-am | 1899 | null | true | NO | n/a | n/a | n/a | n/a | n/a | ABSENT | BLOCKED: no 2026 cfbGames doc for this schoolIds pair |
| Battle of the Brothers | null | utah + utah-state | 1892 | null | false | YES `2026-2026-09-19-utah-utah-state` | yes | 2026-09-19 | `rice-eccles-stadium` | false | 1:30 PM MT | ABSENT | GENERATE |
| Battle of the Carolinas | null | north-carolina + south-carolina | 1903 | null | true | NO | n/a | n/a | n/a | n/a | n/a | ABSENT | BLOCKED: no 2026 cfbGames doc for this schoolIds pair |
| Bayou Bucket | Bayou Bucket | houston + rice | 1971 | null | true | NO | n/a | n/a | n/a | n/a | n/a | ABSENT | BLOCKED: no 2026 cfbGames doc for this schoolIds pair |
| Bedlam Series | Bedlam Bell | oklahoma + oklahoma-state | 1904 | null | true | NO | n/a | n/a | n/a | n/a | n/a | ABSENT | BLOCKED: no 2026 cfbGames doc for this schoolIds pair |
| Ben Schwartzwalder Trophy | Ben Schwartzwalder Trophy | syracuse + west-virginia | 1945 | null | true | NO | n/a | n/a | n/a | n/a | n/a | ABSENT | BLOCKED: no 2026 cfbGames doc for this schoolIds pair |
| Big Game | The Axe | california + stanford | 1892 | null | false | YES `2026-2026-11-21-california-stanford` | no | 2026-11-21 | EMPTY (derived `california-memorial-stadium`) | false | tbd | ABSENT | GENERATE |
| Black and Blue Bowl | null | memphis + southern-miss | 1935 | null | true | NO | n/a | n/a | n/a | n/a | n/a | ABSENT | BLOCKED: no 2026 cfbGames doc for this schoolIds pair |
| Black Diamond Trophy | Black Diamond Trophy | virginia-tech + west-virginia | 1912 | null | true | NO | n/a | n/a | n/a | n/a | n/a | ABSENT | BLOCKED: no 2026 cfbGames doc for this schoolIds pair |
| Bluebonnet Battle | Bluebonnet Shield | baylor + tcu | 1899 | null | false | YES `2026-2026-10-17-baylor-tcu` | no | 2026-10-17 | EMPTY (derived `mclane-stadium`) | false | tbd | ABSENT | GENERATE |
| Border War | Indian War Drum; Lamar Hunt Trophy | kansas + missouri | 1891 | null | false | YES `2026-2026-09-11-kansas-missouri` | no | 2026-09-11 | `david-booth-kansas-memorial-stadium` | false | 7 p.m. CT | ABSENT | GENERATE |
| Bronze Stalk Trophy | Bronze Stalk Trophy | ball-state + northern-illinois | 1941 | null | true | NO | n/a | n/a | n/a | n/a | n/a | ABSENT | BLOCKED: no 2026 cfbGames doc for this schoolIds pair |
| Chancellor's Spurs | Chancellor's Spurs | texas + texas-tech | 1928 | null | true | NO | n/a | n/a | n/a | n/a | n/a | ABSENT | BLOCKED: no 2026 cfbGames doc for this schoolIds pair |
| Clean, Old-Fashioned Hate | Governor's Cup | georgia + georgia-tech | 1893 | null | false | YES `2026-2026-11-28-georgia-georgia-tech` | no | 2026-11-28 | EMPTY (derived `sanford-stadium`) | false | tbd | ABSENT | GENERATE |
| Commonwealth Cup | Commonwealth Cup | virginia + virginia-tech | 1895 | null | false | YES `2026-2026-11-28-virginia-tech-virginia` | no | 2026-11-28 | `lane-stadium` | false | tbd | ABSENT | GENERATE |
| Crab Bowl Classic | Crab Bowl Trophy | maryland + navy | 1905 | null | true | NO | n/a | n/a | n/a | n/a | n/a | ABSENT | BLOCKED: no 2026 cfbGames doc for this schoolIds pair |
| Cy-Hawk Trophy | Cy-Hawk Trophy | iowa + iowa-state | 1894 | null | false | YES `2026-2026-09-12-iowa-iowa-state` | yes | 2026-09-12 | EMPTY (derived `kinnick-stadium`) | false | 6:30 PM CT | ABSENT | GENERATE |
| Deep South's Oldest Rivalry | null | auburn + georgia | 1892 | null | false | YES `2026-2026-10-17-georgia-auburn` | no | 2026-10-17 | EMPTY (derived `sanford-stadium`) | false | tbd | ABSENT | GENERATE |
| Deeper than Hate | null | appalachian-state + georgia-southern | 1932 | null | false | YES `2026-2026-10-31-georgia-southern-appalachian-state` | no | 2026-10-31 | EMPTY (no fallback) | false | tbd | ABSENT | BLOCKED: cfbGames.venueId (empty) + home school georgia-southern absent from cfbSchools |
| Duel in the Desert | Territorial Cup | arizona + arizona-state | 1899 | null | false | YES `2026-2026-11-28-arizona-arizona-state` | no | 2026-11-28 | EMPTY (derived `casino-del-sol-stadium`) | false | tbd | ABSENT | GENERATE |
| Egg Bowl | Golden Egg Trophy | mississippi-state + ole-miss | 1901 | null | false | YES `2026-2026-11-27-ole-miss-mississippi-state` | yes | 2026-11-27 | EMPTY (derived `vaught-hemingway-stadium`) | false | 11:00 AM CT | ABSENT | GENERATE |
| Farmageddon | null | iowa-state + kansas-state | 1917 | null | false | YES `2026-2026-11-28-iowa-state-kansas-state` | no | 2026-11-28 | `jack-trice-stadium` | false | tbd | ABSENT | GENERATE |
| Florida Cup | Florida Cup | florida + florida-state | 1958 | null | false | YES `2026-2026-11-27-florida-state-florida` | yes | 2026-11-27 | `doak-campbell-stadium` | false | 3:30 PM ET | ABSENT | GENERATE |
| Florida Cup | Florida Cup | florida + miami | 1938 | null | true | NO | n/a | n/a | n/a | n/a | n/a | ABSENT | BLOCKED: no 2026 cfbGames doc for this schoolIds pair |
| Florida Cup | Florida Cup | florida-state + miami | 1951 | null | false | YES `2026-2026-10-17-miami-florida-state` | no | 2026-10-17 | `hard-rock-stadium` | false | tbd | ABSENT | GENERATE |
| Floyd of Rosedale | Floyd of Rosedale | iowa + minnesota | 1891 | null | false | YES `2026-2026-10-24-minnesota-iowa` | no | 2026-10-24 | `huntington-bank-stadium` | false | tbd | ABSENT | GENERATE |
| Frank Leahy Memorial Bowl | Ireland Trophy | boston-college + notre-dame | 1975 | null | false | YES `2026-2026-11-14-notre-dame-boston-college` | yes | 2026-11-14 | `notre-dame-stadium` | false | 3:30 PM ET | ABSENT | GENERATE |
| Freedom Trophy | Freedom Trophy | nebraska + wisconsin | 1901 | null | true | NO | n/a | n/a | n/a | n/a | n/a | ABSENT | BLOCKED: no 2026 cfbGames doc for this schoolIds pair |
| Friends of Coal Bowl | null | marshall + west-virginia | 1911 | null | true | NO | n/a | n/a | n/a | n/a | n/a | ABSENT | BLOCKED: no 2026 cfbGames doc for this schoolIds pair |
| Gansz Trophy | Gansz Trophy | navy + smu | 1930 | null | true | NO | n/a | n/a | n/a | n/a | n/a | ABSENT | BLOCKED: no 2026 cfbGames doc for this schoolIds pair |
| George Jewitt Trophy | George Jewitt Trophy | michigan + northwestern | 1892 | null | true | NO | n/a | n/a | n/a | n/a | n/a | ABSENT | BLOCKED: no 2026 cfbGames doc for this schoolIds pair |
| Gold Cowbell | Gold Cowbell | georgia-tech + vanderbilt | 1892 | 1924 | true | NO | n/a | n/a | n/a | n/a | n/a | ABSENT | BLOCKED: no 2026 cfbGames doc for this schoolIds pair |
| Golden Boot | Golden Boot | arkansas + lsu | 1901 | 1996 | false | YES `2026-2026-11-28-arkansas-lsu` | no | 2026-11-28 | `donald-w-reynolds-razorback-stadium` | false | tbd | ABSENT | GENERATE |
| Golden Screwdriver | Golden Screwdriver | fresno-state + hawaii | 1938 | null | true | NO | n/a | n/a | n/a | n/a | n/a | ABSENT | BLOCKED: no 2026 cfbGames doc for this schoolIds pair |
| Governor's Cup | Governor's Cup | kentucky + louisville | 1912 | null | false | YES `2026-2026-11-28-kentucky-louisville` | no | 2026-11-28 | EMPTY (derived `kroger-field`) | false | tbd | ABSENT | GENERATE |
| Governor's Victory Bell | Governor's Victory Bell | minnesota + penn-state | 1993 | null | false | YES `2026-2026-11-14-penn-state-minnesota` | no | 2026-11-14 | EMPTY (derived `beaver-stadium`) | false | tbd | ABSENT | GENERATE |
| Governors' Trophy Game | The Governors' Perpetual Trophy | oregon + saint-marys | 1929 | 1929 | true | NO | n/a | n/a | n/a | n/a | n/a | ABSENT | BLOCKED: no 2026 cfbGames doc for this schoolIds pair |
| Green Line Rivalry | null | boston-college + boston-university | 1893 | null | true | NO | n/a | n/a | n/a | n/a | n/a | ABSENT | BLOCKED: no 2026 cfbGames doc for this schoolIds pair |
| Heartland Trophy | Heartland Trophy | iowa + wisconsin | 1894 | null | false | YES `2026-2026-10-31-iowa-wisconsin` | no | 2026-10-31 | `kinnick-stadium` | false | tbd | ABSENT | GENERATE |
| Heroes Trophy | Heroes Trophy | iowa + nebraska | 1891 | null | false | YES `2026-2026-11-27-iowa-nebraska` | yes | 2026-11-27 | `kinnick-stadium` | false | 11:00 AM CT | ABSENT | GENERATE |
| Holy War | null | byu + utah | 1896 | null | false | YES `2026-2026-11-07-utah-byu` | no | 2026-11-07 | EMPTY (derived `rice-eccles-stadium`) | false | tbd | ABSENT | GENERATE |
| Illibuck | Illibuck | illinois + ohio-state | 1902 | null | false | YES `2026-2026-09-26-ohio-state-illinois` | no | 2026-09-26 | EMPTY (derived `ohio-stadium`) | false | tbd | ABSENT | GENERATE |
| Iron Bowl | James E. Foy, V-ODK Sportsmanship Trophy | alabama + auburn | 1893 | null | false | YES `2026-2026-11-28-alabama-auburn` | no | 2026-11-28 | EMPTY (derived `saban-field-at-bryant-denny-stadium`) | false | tbd | ABSENT | GENERATE |
| Jefferson–Eppes Trophy | Jefferson–Eppes Trophy | florida-state + virginia | 1992 | 1995 | false | YES `2026-2026-10-03-florida-state-virginia` | no | 2026-10-03 | EMPTY (derived `doak-campbell-stadium`) | false | tbd | ABSENT | GENERATE |
| Jeweled Shillelagh | Jeweled Shillelagh | notre-dame + usc | 1926 | 1952 | true | NO | n/a | n/a | n/a | n/a | n/a | ABSENT | BLOCKED: no 2026 cfbGames doc for this schoolIds pair |
| Keystone Classic | null | penn-state + pittsburgh | 1893 | null | true | NO | n/a | n/a | n/a | n/a | n/a | ABSENT | BLOCKED: no 2026 cfbGames doc for this schoolIds pair |
| Kuter Trophy | Kuter Trophy | air-force + hawaii | 1966 | null | true | NO | n/a | n/a | n/a | n/a | n/a | ABSENT | BLOCKED: no 2026 cfbGames doc for this schoolIds pair |
| Land of Lincoln Trophy | Land of Lincoln Trophy | illinois + northwestern | 1892 | null | false | YES `2026-2026-11-28-northwestern-illinois` | no | 2026-11-28 | `martin-stadium-northwestern-university` | false | tbd | ABSENT | GENERATE |
| Legends Trophy | Legends Trophy | notre-dame + stanford | 1925 | null | false | YES `2026-2026-10-10-notre-dame-stanford` | yes | 2026-10-10 | `notre-dame-stadium` | false | 3:30 PM ET | ABSENT | GENERATE |
| Little Brown Jug | Little Brown Jug | michigan + minnesota | 1892 | null | false | YES `2026-2026-10-03-minnesota-michigan` | no | 2026-10-03 | `huntington-bank-stadium` | false | tbd | ABSENT | GENERATE |
| Lone Star Showdown | null | texas + texas-am | 1894 | null | false | YES `2026-2026-11-27-texas-am-texas` | yes | 2026-11-27 | `kyle-field` | false | 6:30 PM CT | ABSENT | GENERATE |
| Magnolia Bowl | Magnolia Bowl Trophy | lsu + ole-miss | 1894 | null | false | YES `2026-2026-09-19-ole-miss-lsu` | yes | 2026-09-19 | `vaught-hemingway-stadium` | false | 6:30 PM CT | ABSENT | GENERATE |
| Mayor's Cup | Mayor's Cup | missouri + south-carolina | 1979 | null | true | NO | n/a | n/a | n/a | n/a | n/a | ABSENT | BLOCKED: no 2026 cfbGames doc for this schoolIds pair |
| Mayor's Cup | Mayor's Cup | rice + smu | 1916 | null | true | NO | n/a | n/a | n/a | n/a | n/a | ABSENT | BLOCKED: no 2026 cfbGames doc for this schoolIds pair |
| Megaphone Trophy | Megaphone Trophy | michigan-state + notre-dame | 1897 | null | false | YES `2026-2026-09-19-notre-dame-michigan-state` | yes | 2026-09-19 | `notre-dame-stadium` | false | 7:30 PM ET | ABSENT | GENERATE |
| Mid–South Rivalry | null | memphis + ole-miss | 1921 | null | true | NO | n/a | n/a | n/a | n/a | n/a | ABSENT | BLOCKED: no 2026 cfbGames doc for this schoolIds pair |
| Milk Can | Milk Can | boise-state + fresno-state | 1977 | null | false | YES `2026-2026-10-10-fresno-state-boise-state` | yes | 2026-10-10 | `valley-childrens-stadium` | false | 7:30 PM PT | ABSENT | GENERATE |
| O'Rourke–McFadden Trophy | O'Rourke–McFadden Trophy | boston-college + clemson | 1940 | null | true | NO | n/a | n/a | n/a | n/a | n/a | ABSENT | BLOCKED: no 2026 cfbGames doc for this schoolIds pair |
| Oil Can | Oil Can | fresno-state + san-diego-state | 1923 | null | false | YES `2026-2026-10-17-san-diego-state-fresno-state` | yes | 2026-10-17 | EMPTY (derived `snapdragon-stadium`) | false | 7:30 PM PT | ABSENT | GENERATE |
| Okefenokee Oar | Okefenokee Oar | florida + georgia | 1915 | null | false | YES `2026-2026-10-31-florida-georgia` | yes | 2026-10-31 | EMPTY (no fallback) | true | 3:30 PM ET | ABSENT | BLOCKED: cfbGames.venueId (empty, neutralSite:true so no home-school fallback) |
| Old Brass Spittoon | Old Brass Spittoon | indiana + michigan-state | 1922 | null | true | NO | n/a | n/a | n/a | n/a | n/a | ABSENT | BLOCKED: no 2026 cfbGames doc for this schoolIds pair |
| Old Oaken Bucket | Old Oaken Bucket | indiana + purdue | 1891 | 1925 | false | YES `2026-2026-11-28-indiana-purdue` | no | 2026-11-28 | EMPTY (derived `memorial-stadium-indiana-university`) | false | tbd | ABSENT | GENERATE |
| Paint Bucket Bowl | null | arkansas-state + memphis | 1914 | null | false | YES `2026-2026-09-05-memphis-arkansas-state` | no | 2026-09-05 | `simmons-bank-liberty-stadium` | false | 6 p.m. CT | ABSENT | GENERATE |
| Palmetto Bowl | null | clemson + south-carolina | 1896 | null | false | YES `2026-2026-11-28-clemson-south-carolina` | no | 2026-11-28 | `memorial-stadium-clemson` | false | tbd | ABSENT | GENERATE |
| Paul Bunyan Trophy | Paul Bunyan Trophy | michigan + michigan-state | 1898 | null | false | YES `2026-2026-11-07-michigan-michigan-state` | no | 2026-11-07 | EMPTY (derived `michigan-stadium`) | false | tbd | ABSENT | GENERATE |
| Paul Bunyan's Axe | Paul Bunyan's Axe | minnesota + wisconsin | 1890 | null | false | YES `2026-2026-11-27-wisconsin-minnesota` | yes | 2026-11-27 | EMPTY (derived `camp-randall-stadium`) | false | 6:30 PM CT | ABSENT | GENERATE |
| Platypus Trophy | Platypus Trophy | oregon + oregon-state | 1894 | null | true | NO | n/a | n/a | n/a | n/a | n/a | ABSENT | BLOCKED: no 2026 cfbGames doc for this schoolIds pair |
| Purdue Cannon | Purdue Cannon | illinois + purdue | 1890 | null | false | YES `2026-2026-10-03-illinois-purdue` | no | 2026-10-03 | EMPTY (derived `gies-memorial-stadium`) | false | tbd | ABSENT | GENERATE |
| Ram–Falcon Trophy | Ram–Falcon Trophy | air-force + colorado-state | 1957 | 1980 | true | NO | n/a | n/a | n/a | n/a | n/a | ABSENT | BLOCKED: no 2026 cfbGames doc for this schoolIds pair |
| Red River Rivalry | Golden Hat | oklahoma + texas | 1900 | 1941 | false | YES `2026-2026-10-10-oklahoma-texas` | yes | 2026-10-10 | EMPTY (no fallback) | true | 2:30 PM CT | ABSENT | BLOCKED: cfbGames.venueId (empty, neutralSite:true so no home-school fallback) |
| Rip Miller Trophy | Rip Miller Trophy | navy + notre-dame | 1927 | null | false | YES `2026-2026-10-31-navy-notre-dame` | yes | 2026-10-31 | EMPTY (no fallback) | true | 12:00 PM ET | ABSENT | BLOCKED: cfbGames.venueId (empty, neutralSite:true so no home-school fallback) |
| Rocky Mountain Showdown | Centennial Cup | colorado + colorado-state | 1893 | null | true | NO | n/a | n/a | n/a | n/a | n/a | ABSENT | BLOCKED: no 2026 cfbGames doc for this schoolIds pair |
| Royal Rivalry | Royal Rivalry Trophy | james-madison + old-dominion | 2011 | null | false | YES `2026-2026-09-26-old-dominion-james-madison` | no | 2026-09-26 | EMPTY (no fallback) | false | tbd | ABSENT | BLOCKED: cfbGames.venueId (empty) + home school old-dominion absent from cfbSchools |
| Rumble in the Rockies | null | colorado + utah | 1903 | null | false | YES `2026-2026-10-17-colorado-utah` | no | 2026-10-17 | `folsom-field` | false | tbd | ABSENT | GENERATE |
| Saddle Trophy | Saddle Trophy | tcu + texas-tech | 1926 | 1961 | false | YES `2026-2026-11-26-texas-tech-tcu` | yes | 2026-11-26 | `jones-stadium` | false | 7:00 PM CT | ABSENT | GENERATE |
| Safeway Bowl | null | north-texas + smu | 1922 | null | true | NO | n/a | n/a | n/a | n/a | n/a | ABSENT | BLOCKED: no 2026 cfbGames doc for this schoolIds pair |
| Schnellenberger Trophy | Schnellenberger Trophy | louisville + miami | 1933 | null | true | NO | n/a | n/a | n/a | n/a | n/a | ABSENT | BLOCKED: no 2026 cfbGames doc for this schoolIds pair |
| Shillelagh Trophy | Shillelagh Trophy | notre-dame + purdue | 1896 | null | false | YES `2026-2026-09-26-purdue-notre-dame` | no | 2026-09-26 | EMPTY (derived `ross-ade-stadium`) | false | tbd | ABSENT | GENERATE |
| South's Oldest Rivalry | null | north-carolina + virginia | 1892 | null | false | YES `2026-2026-11-21-virginia-north-carolina` | no | 2026-11-21 | `scott-stadium` | false | tbd | ABSENT | GENERATE |
| Southwest Classic Trophy | Southwest Classic Trophy | arkansas + texas-am | 1903 | null | false | YES `2026-2026-10-03-texas-am-arkansas` | no | 2026-10-03 | EMPTY (derived `kyle-field`) | false | tbd | ABSENT | GENERATE |
| Sunflower Showdown | Governor's Cup | kansas + kansas-state | 1902 | null | false | YES `2026-2026-10-17-kansas-state-kansas` | no | 2026-10-17 | EMPTY (derived `bill-snyder-family-football-stadium`) | false | tbd | ABSENT | GENERATE |
| Techmo Bowl | null | georgia-tech + virginia-tech | 1990 | null | false | YES `2026-2026-10-17-virginia-tech-georgia-tech` | no | 2026-10-17 | EMPTY (derived `lane-stadium`) | false | tbd | ABSENT | GENERATE |
| Telephone Trophy | Telephone Trophy | iowa-state + missouri | 1896 | null | true | NO | n/a | n/a | n/a | n/a | n/a | ABSENT | BLOCKED: no 2026 cfbGames doc for this schoolIds pair |
| Textile Bowl | Textile Bowl | clemson + nc-state | 1899 | null | true | NO | n/a | n/a | n/a | n/a | n/a | ABSENT | BLOCKED: no 2026 cfbGames doc for this schoolIds pair |
| The Bourbon Barrel | The Bourbon Barrel | indiana + kentucky | 1893 | null | true | NO | n/a | n/a | n/a | n/a | n/a | ABSENT | BLOCKED: no 2026 cfbGames doc for this schoolIds pair |
| The Game | null | michigan + ohio-state | 1897 | null | false | YES `2026-2026-11-28-ohio-state-michigan` | yes | 2026-11-28 | EMPTY (derived `ohio-stadium`) | false | 12:00 PM ET | ABSENT | GENERATE |
| The Keg of Nails | The Keg of Nails | cincinnati + louisville | 1929 | null | true | NO | n/a | n/a | n/a | n/a | n/a | ABSENT | BLOCKED: no 2026 cfbGames doc for this schoolIds pair |
| The Old Mountain Feud | null | appalachian-state + marshall | 1977 | null | false | YES `2026-2026-11-14-marshall-appalachian-state` | no | 2026-11-14 | `joan-c-edwards-stadium` | false | tbd | ABSENT | GENERATE |
| The Old Wagon Wheel | The Old Wagon Wheel | byu + utah-state | 1922 | null | true | NO | n/a | n/a | n/a | n/a | n/a | ABSENT | BLOCKED: no 2026 cfbGames doc for this schoolIds pair |
| Third Saturday in October | null | alabama + tennessee | 1901 | null | false | YES `2026-2026-10-17-tennessee-alabama` | no | 2026-10-17 | `neyland-stadium` | false | tbd | ABSENT | GENERATE |
| Tiger Bowl | null | auburn + lsu | 1901 | null | false | YES `2026-2026-10-24-auburn-lsu` | yes | 2026-10-24 | `jordan-hare-stadium` | false | 11:00 AM CT | ABSENT | GENERATE |
| Tiger–Sooner Peace Pipe | Tiger–Sooner Peace Pipe | missouri + oklahoma | 1902 | null | false | YES `2026-2026-11-28-missouri-oklahoma` | no | 2026-11-28 | `faurot-field` | false | tbd | ABSENT | GENERATE |
| Victory Barrel | Victory Barrel | east-carolina + nc-state | 1970 | null | true | NO | n/a | n/a | n/a | n/a | n/a | ABSENT | BLOCKED: no 2026 cfbGames doc for this schoolIds pair |
| Victory Bell | Victory Bell | duke + north-carolina | 1888 | null | false | YES `2026-2026-10-17-duke-north-carolina` | no | 2026-10-17 | `wallace-wade-stadium` | false | tbd | ABSENT | GENERATE |
| Victory Bell | Victory Bell | missouri + nebraska | 1892 | null | true | NO | n/a | n/a | n/a | n/a | n/a | ABSENT | BLOCKED: no 2026 cfbGames doc for this schoolIds pair |
| Victory Bell | Victory Bell | ucla + usc | 1929 | null | false | YES `2026-2026-11-28-ucla-usc` | no | 2026-11-28 | `rose-bowl-stadium` | false | tbd | ABSENT | GENERATE |
| War on I–4 | War on I–4 Trophy | south-florida + ucf | 2005 | null | true | NO | n/a | n/a | n/a | n/a | n/a | ABSENT | BLOCKED: no 2026 cfbGames doc for this schoolIds pair |

#### B2 table — Partition B: the 97 GENERIC rivalries, rolled up by blocking reason

| Blocking reason | Count | Share | narrative? |
|---|---|---|---|
| BLOCKED: no 2026 `cfbGames` doc for this `schoolIds` pair (all 55 are `dormant:true`) | 55 | 57% | ABSENT on all |
| GENERATE, but `cfbGames.verified=false` so kickoff renders "Kickoff TBA" | 35 | 36% | ABSENT on all |
| GENERATE, `verified:true` + announced kickoff (California–UCLA, Coastal Carolina–Liberty, Duke–Virginia, Houston–Texas Tech, Pittsburgh–Syracuse, Syracuse–UConn) | 6 | 6% | ABSENT on all |
| BLOCKED: `cfbGames.venueId` empty + home school `tulsa` absent from `cfbSchools` (Oklahoma State–Tulsa) | 1 | 1% | ABSENT |
| **TOTAL** | **97** | 100% | **0/97 have narrative** |

#### B2 summary — how many could ship TODAY with zero new data

| Bucket | NAMED (115) | GENERIC (97) | ALL (212) |
|---|---|---|---|
| **GENERATE** | **59** | **41** | **100** |
| — of which `verified:true` + announced kickoff | 18 | 6 | 24 |
| — of which `verified:false` (kickoff renders "Kickoff TBA") | 41 | 35 | 76 |
| — of which venue comes from stored `cfbGames.venueId` | — | — | 55 |
| — of which venue is DERIVED from `cfbSchools.<home>.venueId` | — | — | 45 |
| — of which both schools exist in `cfbSchools` | 53 | 41 | 94 |
| — of which one school is NOT in the 86 `cfbSchools` (no name/colors/venue for that side) | 6 | 0 | 6 |
| **BLOCKED: no 2026 `cfbGames` doc for the pair** (100% correlate with `dormant:true`) | 49 | 55 | **104** |
| **BLOCKED: `cfbGames.venueId` empty with no fallback** | 7 | 1 | **8** |
| — sub-reason: `neutralSite:true`, so no home-school fallback | 5 | 0 | 5 |
| — sub-reason: home school absent from `cfbSchools` | 2 | 1 | 3 |
| **BLOCKED on `narrative`**, if any template requires editorial prose | 115 | 97 | **212** |
| **Highest-fidelity set** (GENERATE + verified + announced kickoff + both schools tracked) | **16** | 6 | **22** |

**Answer: 100 of 212 rivalries could ship a matchup page today with zero new data — 59 of them
NAMED.** The blocked 112 break down as 104 with no 2026 game (all dormant) and 8 with an
unresolvable venue (5 neutral-site with empty `venueId`: Army-Navy, Battle for the Bell
cincinnati/miami-oh, Okefenokee Oar, Rip Miller Trophy, Red River Rivalry; 3 where `venueId` is
empty **and** the home school is absent from `cfbSchools`: georgia-southern, old-dominion, tulsa).

**Universal gaps, excluded from the verdict because no shipped template requires them:**
`cfbRivalries.narrative` ABSENT on 212/212; `cfbGames.themeDesignations` an empty array on 670/670;
`cfbSchools.traditionIds` empty on 86/86.

#### The 16 NAMED rivalries that are fully populated today

| Date | Rivalry | Trophy | Schools | Venue resolved | Kickoff |
|---|---|---|---|---|---|
| 2026-09-05 | Battle of the Blue Ridge | null | james-madison v liberty | bridgeforth-stadium-and-zane-showker-field (derived) | 12:00 PM ET |
| 2026-09-12 | Cy-Hawk Trophy | Cy-Hawk Trophy | iowa v iowa-state | kinnick-stadium (derived) | 6:30 PM CT |
| 2026-09-19 | Magnolia Bowl | Magnolia Bowl Trophy | lsu v ole-miss | vaught-hemingway-stadium | 6:30 PM CT |
| 2026-09-19 | Megaphone Trophy | Megaphone Trophy | michigan-state v notre-dame | notre-dame-stadium | 7:30 PM ET |
| 2026-10-10 | Milk Can | Milk Can | boise-state v fresno-state | valley-childrens-stadium | 7:30 PM PT |
| 2026-10-10 | Legends Trophy | Legends Trophy | notre-dame v stanford | notre-dame-stadium | 3:30 PM ET |
| 2026-10-17 | Oil Can | Oil Can | fresno-state v san-diego-state | snapdragon-stadium (derived) | 7:30 PM PT |
| 2026-10-24 | Tiger Bowl | null | auburn v lsu | jordan-hare-stadium | 11:00 AM CT |
| 2026-11-14 | Frank Leahy Memorial Bowl | Ireland Trophy | boston-college v notre-dame | notre-dame-stadium | 3:30 PM ET |
| 2026-11-26 | Saddle Trophy | Saddle Trophy | tcu v texas-tech | jones-stadium | 7:00 PM CT |
| 2026-11-27 | Florida Cup | Florida Cup | florida v florida-state | doak-campbell-stadium | 3:30 PM ET |
| 2026-11-27 | Heroes Trophy | Heroes Trophy | iowa v nebraska | kinnick-stadium | 11:00 AM CT |
| 2026-11-27 | Paul Bunyan's Axe | Paul Bunyan's Axe | minnesota v wisconsin | camp-randall-stadium (derived) | 6:30 PM CT |
| 2026-11-27 | Egg Bowl | Golden Egg Trophy | mississippi-state v ole-miss | vaught-hemingway-stadium (derived) | 11:00 AM CT |
| 2026-11-27 | Lone Star Showdown | null | texas v texas-am | kyle-field | 6:30 PM CT |
| 2026-11-28 | The Game | null | michigan v ohio-state | ohio-stadium (derived) | 12:00 PM ET |

#### The eight high-value rivalries named in the brief

| Requested name | Found as | Trophy | schoolIds | seriesStart | trophyCreated | dormant | 2026 game? | verified | date | venueId | neutral | kickoff | narrative | Verdict |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| **Iron Bowl** | `alabama--auburn` "Iron Bowl" | James E. Foy, V-ODK Sportsmanship Trophy | alabama + auburn | 1893 | null | false | YES `2026-2026-11-28-alabama-auburn` | **no** | 2026-11-28 | EMPTY → derived `saban-field-at-bryant-denny-stadium` | false | **tbd** | ABSENT | **GENERATE** (renders "Kickoff TBA" — already proven on prod `/cfb/alabama`) |
| **Bedlam** | `oklahoma--oklahoma-state` "**Bedlam Series**" | Bedlam Bell | oklahoma + oklahoma-state | 1904 | null | **true** | **NO** | — | — | — | — | — | ABSENT | **BLOCKED: no 2026 `cfbGames` doc for the pair** |
| **Egg Bowl** | `mississippi-state--ole-miss` "Egg Bowl" | Golden Egg Trophy | mississippi-state + ole-miss | 1901 | null | false | YES | yes | 2026-11-27 | EMPTY → derived `vaught-hemingway-stadium` | false | 11:00 AM CT | ABSENT | **GENERATE** |
| **Apple Cup** | `washington--washington-state` "Apple Cup" | Apple Cup Trophy | washington + washington-state | 1900 | **1963** | false | YES | yes | 2026-09-06 | `husky-stadium` (stored) | false | 1:00 PM PT | ABSENT | **GENERATE** — caveat: `washington-state` is **not** one of the 86 `cfbSchools`, so the Cougars side has no name/colors/venue |
| **World's Largest Outdoor Cocktail Party** | **ABSENT by that name.** The pair is `florida--georgia` "**Okefenokee Oar**". The marketing name exists only as a hardcoded string at `src/lib/cfb/hub-data.ts:58` | Okefenokee Oar | florida + georgia | 1915 | null | false | YES (a duplicate home/away doc also exists) | yes | 2026-10-31 | **EMPTY, no fallback** | **true** | 3:30 PM ET | ABSENT | **BLOCKED: `cfbGames.venueId`** (empty + `neutralSite:true`) |
| **The Game** | `michigan--ohio-state` "The Game" | **null** | michigan + ohio-state | 1897 | null | false | YES | yes | 2026-11-28 | EMPTY → derived `ohio-stadium` | false | 12:00 PM ET | ABSENT | **GENERATE** |
| **Backyard Brawl** | `pittsburgh--west-virginia` "Backyard Brawl" | **null** | pittsburgh + west-virginia | 1895 | null | **true** | **NO** | — | — | — | — | — | ABSENT | **BLOCKED: no 2026 `cfbGames` doc for the pair** |
| **Sunflower Showdown** | `kansas--kansas-state` "Sunflower Showdown" | Governor's Cup | kansas + kansas-state | 1902 | null | false | YES | **no** | 2026-10-17 | EMPTY → derived `bill-snyder-family-football-stadium` | false | **tbd** | ABSENT | **GENERATE** (renders "Kickoff TBA") |

Five of the eight GENERATE. The two Ahrefs-highest-volume names in the brief — Bedlam (14,000/mo)
and Backyard Brawl (TP 12,000) — are both **dormant with no 2026 fixture**, and Georgia-Florida
(TP 15,000) is blocked on a neutral-site venue.

#### `cfbGames` full census (n=670) — the supporting corpus

| Dimension | Value | Count | Note |
|---|---|---|---|
| `season` | 2026 | **670 (100%)** | no other season in the collection |
| `status` | scheduled | 670 (100%) | zero completed/canceled |
| `verified` | true / false | **267 (39.9%) / 403** | `src/lib/cfb/types.ts:143` "gates production display" |
| `date` | non-empty, `YYYY-MM-DD` | **670 (100%)** | zero missing dates |
| `venueId` | non-empty / empty string | 381 (56.9%) / **289** | never null — always the empty string |
| venue RESOLVABLE (stored, else home school's `cfbSchools.venueId` when not neutral) | — | **578 (86.3%)** | the fallback the shipped reader already uses, `src/lib/cfb/data.ts:216` |
| venue UNRESOLVABLE | — | **92 (13.7%)** | neutral-site with empty venueId, or home school absent from cfbSchools |
| `neutralSite` | true / false | **19 (2.8%)** / 651 | all 19 have `venueId == ''` |
| `kickoff.tbd` | true / false | **339 (50.6%)** / 331 | literal TBD/TBA in `time` matches `tbd:true` on exactly 339, no drift |
| `verified:true` AND kickoff announced | — | **267** | perfectly coupled — every verified game has an announced kickoff |
| `kickoff.tz` | ET 188 / CT 134 / PT 56 / MT 32 / TBD 260 | 670 | **stores abbreviations, not the IANA zone** `src/lib/cfb/types.ts:87` specifies; the display map at `src/lib/cfb/data.ts:17-20` is keyed on IANA names so every lookup misses and falls through via `TZ_ABBR[tz] \|\| tz` at `:94` |
| `kickoff.windowFlex` | non-null | **0 (0%)** | yet two docs encode a window inside `time` ("6:30 or 6:45 PM", "12:00 PM or 3:30 PM") — schema violation vs `src/lib/cfb/types.ts:89` |
| `rivalryId` | non-null | **111 (16.6%)** | resolves to **108 distinct** rivalry ids (3 duplicate home/away pairs) |
| `conferenceGame` | true 397 / false 247 / null 26 | 670 | null is by design for independents, `src/lib/cfb/types.ts:134-135` |
| `themeDesignations` | non-empty | **0 (0%)** | empty on all 670 |
| `verification` | non-null | 670 (100%) | verdicts: verified 267, flagged-for-human 374, downgraded 29 |
| home school ids in `cfbGames` absent from `cfbSchools` | — | **51 distinct** | e.g. tulsa, hawaii, east-carolina, old-dominion, `georgia-southern-university` (note the id drift vs `georgia-southern`) |

**Reusable matchup prose already exists in code.** `buildRivalrySentences` at
`src/lib/cfb/page-extras.ts:35-60` generates one em-dash-free sentence per tagged rivalry from
`cfbRivalries.name`/`trophy` + the game date + the resolved venue, deduped by opponent+name
(template at `:57`); called at `src/components/cfb/CfbSchoolPage.tsx:51`, rendered at `:245-249`.
Venue is deliberately omitted for neutral-site games (`page-extras.ts:54-56`). Live output on prod:
*"The Alabama vs Auburn rivalry, known as Iron Bowl, is played on Saturday, November 28 at
Saban Field at Bryant–Denny Stadium."*

**`SportsEvent` structured data is currently blocked by missing venue addresses**, and the reason is
documented in the repo: `src/app/cfb/[school]/page.tsx:50-56` records that Google's Event rules
require a location with both name and address; away games have no resolved venue and home games
carry only a stadium name, so emitting events tripped a rich-results validation notice on all 86
pages. Only a standalone `SportsTeam` object is emitted.

### B3. Route collision check

#### Sitemap (`src/app/sitemap.ts`, `src/lib/sitemap-urls.ts`)

`sitemap.ts` is a single async default export returning one flat array (`:9`–`:267`), `BASE_URL`
hardcoded to `https://www.getpromonight.com` at `:7`. URL families:

| Family | Built at | Shape |
|---|---|---|
| Pro team pages | `:27-44` | `${BASE_URL}/${t.sportSlug}/${t.id}` at `:39` |
| **CFB school pages** | `:65-70` | **`${BASE_URL}/cfb/${id}` at `:66` — a literal, not a derivation** |
| League hubs | `:85-90` | `${BASE_URL}${hub.href}` over `LEAGUE_HUBS` (`src/lib/league-hubs.ts:36`) |
| Venue hubs | `:108-115` | `${BASE_URL}/venues/${v.slug}` |
| 21 hardcoded literals | `:119-266` | root, `/teams`, `/venues`, `/playoffs` (conditional), `/about`, 7× `/promos/*`, `/best-promos`, `/best-promos/bobbleheads`, `/team-rankings`, `/world-cup`, `/follow`, `/download`, `/privacy`, `/terms` |

Four Firestore reads back it, with deliberately asymmetric error handling:
`getAllTeams()` at `:11` (**unguarded** — a failure throws); `getPlayoffConfig()` at `:14`
(**fail-closed**, `.catch(() => null)`, rationale at `:12-13`); `getAllCfbSchoolIds()` at `:60`
(**fail-loud** — logs `[sitemap] cfbSchools read failed; refusing to serve a sitemap missing the
CFB set` and rethrows at `:60-63`); `getIndexableVenueHubSitemapEntries()` at `:104`
(**fail-loud**, `:104-107`). Rationale written out at `:51-57` and `:98-103`.

CFB URLs are gated twice: `cfbLive` at `:58` calls `isCfbHubLive()` (`src/lib/league-hubs.ts:49`);
when false the school-ids read is skipped entirely and `cfbSchoolIds` is `[]` (`:59-64`), so the
fail-loud rethrow only arms when the hub is live.

**Nothing in the sitemap emits any `/cfb` sub-path other than `/cfb` and `/cfb/{schoolId}`.** There
is no glob or filesystem walk; a matchup family would need its own explicit block. **There is also
no total-count variable, assertion, or expected-count guard anywhere in `sitemap.ts`** — the total
is purely the array length. The only place a count materializes at runtime is
`src/app/api/indexnow/deploy/route.ts:19` (`submitted: urls.length`), an observed value never
compared against an expectation. **Adding N matchup pages therefore changes the sitemap size
silently.**

The sitemap is the only input to the IndexNow deploy hook — `src/lib/sitemap-urls.ts:4-7` calls
`sitemap()` and maps `e.url`; `src/app/api/indexnow/deploy/route.ts:17-19` submits them. So a new
family propagates to search-engine pinging with no other edit, but `src/lib/indexnow.ts:15,:37-39`
hard-throws if any URL's host is not `www.getpromonight.com`, so a matchup URL built on the bare
apex would abort the whole submission.

#### Revalidate (`src/app/api/revalidate/route.ts`)

The validator is one module-level constant:

```
const PATH_RE = /^\/[a-z0-9-]+(?:\/[a-z0-9-]+)?$/;   // src/app/api/revalidate/route.ts:33
const MAX_PATHS = 100;                                // src/app/api/revalidate/route.ts:34
```

Character by character: `^` anchors at start; `\/` requires a literal leading slash; `[a-z0-9-]+`
requires one-or-more characters from lowercase a–z, 0–9 and hyphen only (no uppercase, underscore,
dot, percent-encoding or query string); `(?:\/[a-z0-9-]+)?` optionally allows **exactly one** more
slash-plus-segment of the same class; `$` anchors at end. Net: **one or two segments, no trailing
slash.**

| Candidate | Result | Why |
|---|---|---|
| `/cfb/rivalries/iron-bowl` | **REJECTED** | `[a-z0-9-]+` consumes `cfb` and stops at `/`; the optional group consumes `/rivalries`; `$` then faces `/iron-bowl` and fails. Backtracking cannot help — the only alternative is skipping the optional group, leaving `/rivalries/iron-bowl` before `$`. **Any three-segment path is unmatched.** |
| `/cfb/rivalries` (a two-segment index) | ACCEPTED | |
| **`/cfb/alabama-vs-auburn`** | **ACCEPTED, no code change** | every character of `alabama-vs-auburn` is in `[a-z0-9-]`; the regex has no notion of word boundaries or reserved tokens |
| `/cfb/alabama-vs-auburn-2026` | ACCEPTED | |
| `/cfb/alabama-vs-auburn/` | rejected | trailing slash |
| `/CFB/Alabama` | rejected | uppercase |
| `/cfb/alabama_auburn` | rejected | underscore |
| `/` | rejected | matches the known behaviour that bare `/` is rejected by design |

Both agents ran the literal regex from the file against this matrix in node; results are identical.

**Failure mode matters:** the `PATH_RE` test sits inside the dedupe loop at `:74-84` and a single
bad path returns HTTP 400 `{ok:false, reason:'invalid_path', path}` for the **whole batch** — the
comment at `:70-71` says this is deliberate. Auth is a static shared secret in `x-revalidate-secret`
(`:37`, `:41-43`), 503 when unset (`:38-40`), no timing-safe compare, no HMAC, no rate limit.
`MAX_PATHS=100` is checked **before** dedupe (`:63-68`), so it counts raw submitted paths.

**The regex is duplicated outside this repo.** `promo-pipeline/lib/revalidate-notify.js:18` carries
a byte-identical copy with a comment at `:14-15` saying it "matches the endpoint's PATH_RE" — but
its behaviour on a rejected path differs: it logs `[revalidate] dropping invalid path:` and
**continues** (`:36-39`). A three-segment matchup path handed to the pipeline helper would produce
a warn line and a page that never revalidates, not an HTTP error. Any widening must land in both
files.

#### `sportSlug` derivation, and how the CFB path differs

Confirmed at `src/lib/data.ts:61`, inside `mapTeamDoc` (declared `:51`): the mapper sets
`league: data.league` at `:60` and immediately `sportSlug: data.league.toLowerCase()` at `:61`.
**There is no `data.sportSlug` read anywhere in `:51-84`** — the field does not exist on the
Firestore doc and cannot be filtered with a `.where()`. A corroborating comment lives in the
components layer at `src/components/zero-promo-fallback.tsx:115`. `mapTeamDoc` is the sole shaper
for every team read (`:145`, `:153`, `:266`, `:577`).

**The CFB path does NOT derive the same way.** Every CFB URL in the codebase is a template literal
with `/cfb` typed out: `src/app/sitemap.ts:66`, `src/lib/cfb/metadata.ts:160`,
`src/components/cfb/hub/blocks.tsx:20` and `:93`, `src/components/cfb/hub/CfbHubBrowse.tsx:39`,
`src/components/cfb/hub/CfbHubSearch.tsx:38`, `src/app/cfb/contribute/page.tsx:34`,
`src/components/cfb/CfbSchoolPage.tsx:304`, `src/lib/venue-hub.ts:408`. CFB schools live in a
separate collection (`cfbSchools`, `src/lib/cfb/types.ts:176-182`) that `mapTeamDoc` never touches,
so CFB ids never acquire a `sportSlug` at all. `LEAGUE_HUB_REGISTRY` does carry `sportSlug: 'cfb'`
at `src/lib/league-hubs.ts:31`, but that drives the hub href, not `/cfb/{school}` paths.
**Practical consequence: there is no central URL builder to extend.**

**Latent collision, now measured.** Because `/cfb/[school]` is a static-`cfb`-segment route and
`/[sport]/[team]` is fully dynamic, any `teams` doc with `league === 'CFB'` would produce
`sportSlug` `cfb` at `src/lib/data.ts:61`, be emitted as `/cfb/{teamId}` by `sitemap.ts:39`, and
then be **served by `src/app/cfb/[school]/page.tsx`**, where `getCfbSchoolPage` would return null
and the page would 404 at `:38`. `Team.league` is typed as a bare `string`
(`src/lib/types.ts:10`), so nothing prevents it at the type level. **Queried live: `teams` where
`league == 'CFB'` returns an empty array; the distinct league values across all 169 docs are MLB,
MLS, NBA, NFL, NHL, WNBA. The hazard is real in principle and has zero instances today.**

#### Route collision verdicts

| Proposal | Verdict |
|---|---|
| **`/cfb/rivalries/[slug]`** | **No 404-style collision — the static segment wins.** Next.js (^15.3.1, `package.json:27`) resolves a concrete segment before a dynamic one at the same level, so `src/app/cfb/rivalries/[slug]/page.tsx` would take every `/cfb/rivalries/*` request and `/cfb/[school]` would never see them. This is not theory here: `src/app/cfb/contribute/page.tsx` already sits as a static sibling and is live in production (it appears as anchor #39 on the prod Alabama page). **Shadowing risk is real but currently empty:** live `cfbSchools` has 86 doc ids, **none** equal to `rivalries`, `contribute`, `page` or `api`, and none containing `-vs-`; the seed list `scripts/cfb/lib/schools-2026.ts` agrees. **But this shape is REJECTED by the revalidate `PATH_RE` and would force an edit to `src/app/api/revalidate/route.ts:33` *and* to the pipeline's independent copy at `promo-pipeline/lib/revalidate-notify.js:18`.** |
| **`/cfb/[school-a]-vs-[school-b]`** | **Cannot be its own route.** Next.js dynamic segments match a *whole* path segment; there is no partial-segment syntax, so `/cfb/alabama-vs-auburn` is indistinguishable at the routing layer from `/cfb/alabama` and **must be served by `src/app/cfb/[school]/page.tsx` itself**, branching on the shape of `school` after `const { school } = await params` (`:36`). Two consequences: (1) `generateStaticParams` at `:12-15` currently returns exactly `ids.map((school) => ({ school }))` from `getAllCfbSchoolIds()`, so matchup slugs would have to be UNIONed into that same return value and the prerender set stops being "the school list"; (2) the `notFound()` at `:38` fires whenever `getCfbSchoolPage(school)` returns null (`src/lib/cfb/data.ts:208-209`), so today a matchup URL 404s, and serving it means that single gate becomes a two-branch resolver. `generateMetadata` at `:17-24` has the same problem and returns bare `{}` for an unknown id at `:20`, which would silently produce a title-less page if only the body branch were updated. **This shape rides the existing revalidate contract untouched.** |
| `dynamicParams` | **At its default everywhere** — a repo-wide grep for `dynamicParams` returns zero occurrences, so Next's default `true` holds: a param not returned by `generateStaticParams` is still rendered on demand and ISR-cached. Crawlers can already reach arbitrary `/cfb/<anything>` and cause a live Firestore-backed render; the CFB reader mitigates with a module-level TTL cache pinned to the ISR window (`src/lib/cfb/data.ts:144-162`) plus `React cache()` at `:197`. |
| ISR window | A matchup page served by `/cfb/[school]` **inherits `revalidate = 21600`** (6h) from `src/app/cfb/[school]/page.tsx:10` and cannot be given a different window without splitting the route — it is a per-route constant, not per-param. `STATIC_TTL_MS` at `src/lib/cfb/data.ts:144` is deliberately pinned to the same value. (`/cfb` hub is also 21600 at `src/app/cfb/page.tsx:13`; pro team pages are 86400 at `src/app/[sport]/[team]/page.tsx:43`; venue hubs 86400 at `src/app/venues/[slug]/page.tsx:19`.) |
| Middleware / config | **Nothing intercepts `/cfb/*`.** `src/middleware.ts` contains no `NextResponse.rewrite` at all; the only redirect is scoped to `TOKEN_EXCHANGE_PATHS = new Set(['/preferences'])` (`:20`, checked `:35`); the 410-Gone trap `FANATICS_LEAK_PATH` at `:60` has a league alternation that **excludes `cfb`** (so a future `/cfb/<x>/o-…` leak would not be trapped). The matcher at `:262-267` **does** match a `/cfb` matchup path, so it inherits request counting (`:115-147`) and 1-in-10 bot sampling (`:219-247`) automatically. `next.config.ts` declares only `env` (`:4-11`) and nine literal `redirects()` (`:12-63`), none beginning `/cfb`; no `rewrites()`, no `trailingSlash`. `vercel.json` has only `$schema` and three crons. |

#### Would the "222 venue hubs + 169 team pages" revalidated count need updating?

**No — because no such expected count exists in code.** Searched both repos: nothing computes or
asserts it. The figures are collection cardinalities observed at read time — 169 is
`meta.counts.teamsDocs` in the untracked local `audit/venue-manifest.json` (generated
2026-07-12) and appears as prose in `docs/nfl-zero-state-branch-notes.md:27` and `:115`; 222 is
prose in `docs/venue-faq-and-gatetime-spec.md:127` and an inline comment at
`src/lib/venue-hub.ts:330`. The revalidate payload is fully dynamic — only teams that actually
wrote (`promo-pipeline/scan-mlb.js:199-207`, paths built as `"/" + league.toLowerCase() + "/" + slug`
at `:207`, i.e. the same derivation as `src/lib/data.ts:61`). The two existing tests assert shape,
not count (`promo-pipeline/test/scan-mlb-execute.test.js:333-344`, `:346-351`).

**The load-bearing finding here: CFB has no revalidation hook at all today.** Grepping the whole
pipeline for `revalidate` across `promo-pipeline/scripts/*.js` returns nothing, and grepping for
any `/cfb` path literal in the pipeline returns nothing. The CFB writers there
(`write-cfb-phase3b.js`, `seed-venuehubs-cfb-facts.js`, `fix-cfb-source-artifacts.js`,
`fill-cfb-city-state.js`) never require `lib/revalidate-notify.js`. **CFB pages refresh only on
their 21600s ISR window plus a full production deploy.** Adding N matchup pages requires no count
change, but the new pages inherit that same absence of a write-triggered freshness path — and any
hook added later must respect both `MAX_PATHS=100` and the two-segment `PATH_RE`. For scale: 86
schools fits in one request; a family sized per-rivalry (100 GENERATE) or per-game (670) would not,
and neither the endpoint nor `revalidate-notify.js:20-47` chunks anything.

### B4. `cfbTraditions`

**Total docs: 2.** Both dumped in full:

| Field | `checker-neyland` | `shamrock-series` |
|---|---|---|
| `id` | checker-neyland | shamrock-series |
| `schoolId` | tennessee | notre-dame |
| `name` | Checker Neyland | Shamrock Series |
| `kind` | themeGame | themeGame |
| `dressCode` | "Orange/white checkerboard by section" | **null** |
| `narrative` | **KEY ABSENT** | **KEY ABSENT** |
| `recurring` | true | true |
| `editoriallySeeded` | false | false |
| `source` | utsports.com/news/2026/6/10 | fightingirish.com |
| `updatedAt` | 2026-06-13T03:07:54.906Z | 2026-06-13T03:07:54.906Z |

| Question | Verdict |
|---|---|
| Total docs | **2** |
| `narrative` populated | **0 / 2** — key absent on both |
| `dressCode` populated | **1 / 2** |
| `kind` | `themeGame` on 2/2 — never the `'rivalry'` kind `src/lib/cfb/types.ts:166` allows |
| **Queryable by rivalry?** | **ABSENT.** `CfbTradition` carries only `schoolId` (`src/lib/cfb/types.ts:164`) and has **no `rivalryId` field** anywhere in `:162-173`. The only game-to-tradition edge in the schema is `CfbThemeDesignation.traditionId` (`:98`) inside `cfbGames.themeDesignations` — **empty on 670/670 games**. There is no path from a rivalry or a matchup to a tradition doc. |
| Queryable by school? | **PARTIAL.** `schoolId` exists on both docs, but `cfbSchools.traditionIds` is `[]` on **0 of 86** populated — all 86 are empty, written that way at `scripts/cfb/run-phase1.ts:176` and `scripts/cfb/run-phase2.ts:125`, declared at `src/lib/cfb/types.ts:37`. So the school→tradition edge exists only in the traditions doc's own `schoolId`, never as a lookup from the school. |
| Production reader | **ABSENT.** `src/lib/cfb/data.ts:52` types the field `unknown[]` ("cfbTraditions later") and `:255` hardcodes `traditions: []`. There is no `loadTraditions` alongside the four loaders at `:167-182`. The only reference to the collection outside the type file is a **write** at `scripts/cfb/run-phase1.ts:178`. `src/lib/cfb/hub-data.ts:63` states plainly: "cfbTraditions is not seeded yet"; the hub renders a hardcoded `THEME_CURATED` list at `:65-70` instead. |

### B5. Is the opponent or the rivalry linked on a `/cfb/[school]` page?

**VERDICT: PARTIAL — named everywhere, linked nowhere internally.**

| Sub-question | Verdict | Evidence |
|---|---|---|
| **Opponent school linked?** | **ABSENT** | `grep -o 'href="/cfb/[a-z-]*' cfb-school-alabama.html \| sort \| uniq -c` returns exactly one line: `1 href="/cfb/contribute`. **Zero `/cfb/auburn` anchors on `/cfb/alabama`; zero `/cfb/alabama` anchors on `/cfb/auburn`.** Re-grepped independently by a second agent: `/cfb/auburn` = 0 hits. The code that would emit it does not: every schedule row is a `<button type="button">` (`src/components/cfb/CfbSchedule.tsx:28-53`) and the opponent name is a bare `<span>` at `CfbSchedule.tsx:37`; the rivalry-card opponent line is a bare `<div>` at `src/components/cfb/CfbSchoolPage.tsx:275`; the gameday modal's opponent name is a bare `<h2>` at `CfbSchedule.tsx:91-93`. |
| **The data to build the link** | **PRESENT and unused** | `CfbGameView.opponentId` is typed at `src/lib/cfb/data.ts:28` and populated at `:241`; `awaySchool` typed `:40`, set `:237`. The RSC payload in the served Alabama HTML literally carries `"opponentId":"auburn"`. |
| **Rivalry named?** | **PRESENT** | "Iron Bowl" appears **18 times** in `cfb-school-alabama.html` — in `<title>`/`og:title`/`twitter:title`, in the meta description, in the `TrophyTag`'s `title=` attribute on the schedule row (`src/components/cfb/cfb-bits.tsx:36` builds `${title} · Wikipedia`), in the rivalry-card sub-label (`CfbSchoolPage.tsx:277`), and in the generated prose sentence (`src/lib/cfb/page-extras.ts:57`, rendered `CfbSchoolPage.tsx:245-249`). Symmetric on Auburn (×18). |
| **Rivalry linked?** | **EXTERNAL ONLY** | Every rivalry/trophy anchor points to Wikipedia and opens in a new tab: `src/components/cfb/cfb-bits.tsx:33-44` (`TrophyTag`, in schedule rows) and `src/components/cfb/CfbSchoolPage.tsx:262-271` (rivalry-card title). Alabama emits 10 such external anchors (5 rivalry games × 2 renders at y=1573–2056 and y=2575–3013); Auburn emits 14 (7 × 2). There is no rivalry route in the repo, so there is nothing internal for them to point at. |
| **Visible text ≠ the searched name** | worth flagging | The rendered tag text is the **trophy**, not the rivalry: Alabama's Auburn row reads "James E. Foy, V-ODK Sportsmanship Trophy". "Iron Bowl" appears only in the `title=` tooltip and the small mono sub-label. |
| **Other schools in the conference** | **ABSENT** on `/cfb/[school]`, **PRESENT** on `/cfb` | A school page has no conference block and no rivals grid — the only `/cfb/*` hrefs are `/cfb` (`CfbSchoolPage.tsx:82`) and `/cfb/contribute` (`:303`). On the hub, conference grouping *is* the browse structure: `src/lib/cfb/hub-data.ts:170-176` buckets all schools into the 6 conferences from `src/lib/cfb/conferences.ts:8-15` and `CfbHubBrowse` renders every one at `:75` with `data-conf` on each chip (`:40`). |
| **`/venues/[slug]` for the school's stadium** | **PRESENT** on both, conditional | School page: `src/components/venue-hub/VenueHubLink.tsx:63` (href `:45`), mounted `CfbSchoolPage.tsx:205-211` behind `venueHubLink?.indexable` at `:203`, resolved by `getVenueHubForTeam` at `src/app/cfb/[school]/page.tsx:45`. Verified live: `/cfb/alabama` → `/venues/saban-field-at-bryant-denny-stadium`; `/cfb/auburn` → `/venues/jordan-hare-stadium`. A school whose building is below the index floor (`src/lib/venue-hub.ts:282`) renders nothing there, so this is not guaranteed on all 86. Hub: 64 stadium-guide anchors from `src/components/hub/HubVenueLinks.tsx:41`. |
| **Any `/promos` aggregator** | **PARTIAL** | Hub: one in-body editorial link, `<a href="/promos/today">` at `src/components/cfb/hub/CfbTodaySlot.tsx:23`, above the fold at y=625. **School page: no in-body `/promos` link at all** — the only `/promos` anchors are the six site-wide footer entries plus the nav "Today", which are chrome and identical on every page of the site. No CFB page links to `/promos/bobbleheads`, `/promos/theme-nights` etc. from body content. |

**Things that look like CFB link sources and are not.** `src/components/cfb/CfbConferenceSubRow.tsx`
emits `/cfb?conf={slug}` chips (`:35-43`) and a `/cfb` link (`:44-50`), but it is imported only by
`src/components/team-grid.tsx:210` and `src/components/teams-browser.tsx:165` — it is an inbound
path from the homepage and `/teams` *into* `/cfb`, and appears on neither CFB template.
`src/lib/cfb/rules.ts` and `src/lib/cfb/page-extras.ts` contain no JSX and no href.
`src/lib/cfb/conferences.ts` defines the `?conf=` slugs but emits nothing.

---

## Appendix — method and reproducibility

- Prod HTML: `https://getpromonight.com/{nfl/dallas-cowboys, nfl/los-angeles-rams,
  mlb/los-angeles-dodgers, cfb, cfb/alabama, cfb/auburn, promos/bobbleheads, promos/today,
  venues/acrisure-stadium, nfl, best-promos}`, iPhone UA, 2026-08-10, all HTTP 200.
- Anchor extraction strips `<script>` first, so Next.js flight-payload hrefs are excluded.
- Fold measurement: real Chrome, same-origin iframe pinned to 390×844,
  `getBoundingClientRect().top + window.scrollY` per `a[href]`; "above fold" = top < 844 **and**
  rect height > 0. Two independent measurements (this session's iframe method and a subagent's
  headless-Chrome run at 390×844 DPR 3) agreed to the pixel where they overlapped.
- Firestore: live reads only (`.get()`, `.count().get()`, `listCollections()`); no writes.
  Root collections at capture: `teams` 169, `venues` 148, `venueHubs` 222, `games` 2776,
  `cfbGames` 670, `cfbRivalries` 212, `cfbSchools` 86, `cfbVenues` 86, `cfbTraditions` 2.
- Every numeric claim in Parts 0 and B was re-derived by a second agent from the raw artifacts.
  The `dormant` ↔ "no 2026 game" identity, the 212/104/108/88 splits, the `PATH_RE` booleans, the
  live `cfbSchools` id list and the `teams where league=='CFB'` emptiness were all independently
  reproduced.

**No code is proposed. No commits were made. Two files were created: this one and
`audit/nfl-internal-linking.md`.**

---

## Open items, logged not fixed

Recorded during the Phase 1A audit and the Phase 1B build. None of these is
addressed on `feature/cfb-matchup-pages`; they are written down so they stop
being rediscovered.

### Pipeline

**`run-phase2-reconcile.ts --execute` is not idempotent on verification state.**
Its dry run reports 263 verified against the 267 currently stored, so running it
would silently strip `verified` from 4 games. `verified` gates production
display (`src/lib/cfb/types.ts:143`). Cause not chased. Consequence: the Phase 1A
tombstones must be applied by a dedicated script, not by running reconcile.

**`scripts/cfb/run-phase1.ts:141` still does a bare `set()` with no human-owned
preservation.** It is harmless only because its id shape
(`SEASON-wWEEK-home-away`) matches nothing in the live corpus, which Phase 2
writes as `SEASON-DATE-home-away`. An inline comment now says so at that line,
since that mismatch is the only thing keeping it safe.

**`cfbGames` writers are manual `npx tsx` invocations with no CI trigger**, last
touched 2026-07-09. Nothing re-runs them on a schedule, so the durability guards
added in Phase 1B-A defend against an operator, not a cron.

### Data quality

**School-id drift, 4 pairs. A slugifier defect in the writer**, not in the app.
A source that writes the long-form university name produces an id absent from
`cfbSchools`:

| Drifted id | Source |
|---|---|
| `arizona-state-university` | kuathletics.com |
| `marshall-university` | goccusports.com |
| `appalachian-state-university` | goccusports.com |
| `james-madison-university` | goccusports.com |

Visible symptom: `/cfb/coastal-carolina` renders **15 schedule rows for a
12-game season**, showing "Marshall" and "Marshall University" as two separate
opponents on the same date. The sorted matchup key from Phase 1B-A does not
collapse these, because the two ids are genuinely different strings; the fix
belongs in `normalizeSlug`.

**`2026-2026-09-05-baylor-auburn` stores a wrong timezone.** It records
`"2:30 p.m. ET"` against a Baylor payload of `2026-09-05T14:30:00` Central, so
it is off by one hour. Same class as the Boise timezone bug that Phase 1 was
built to catch.

**Aviva Stadium (Dublin) and Wembley Stadium (London) exist in no collection.**
Not in `cfbVenues` (86 campus stadiums), not in `venueHubs` (222 buildings), not
in the 148-doc pro `venues`. They back UNC-TCU and Kansas-Arizona State, both
outside the 32-name matchup build list, so neither blocks the family.

**6 build-list rivalries have one school absent from `cfbSchools`.** Apple Cup is
the notable one: `washington-state` is not among the 86, so that side renders
with no name, colors or venue. The decision is that these ship with one school
linked and the other as plain text, no link and no color.

### Affiliate and typing defects, from the Phase 1B-B audits

**Expedia destination malforms when coords are present and city is empty.**
`affiliates.ts:570` builds `` `${opts.venueName}, ${opts.city}` ``, so an empty city
yields `"Kinnick Stadium, "` with a trailing comma, and the label at
`hotel-link.ts:63` yields a double space. `resolveHotelLink` only returns null
when coords AND city are both absent (`hotel-link.ts:61`), so this state renders
rather than hiding. CFB hits it whenever `venueCity()` misses
(`venue-cities.ts:106-109`).

**`CfbSchool.primaryColor` is typed non-nullable but is not validated.**
`types.ts:30-31` declares `primaryColor: string`, while `loadSchools`
(`data.ts:168-171`) casts Firestore documents straight through with an unchecked
`as CfbSchool`. `appalachian-state` is `null` at runtime and silently resolves to
`SAFE_ACCENT` (`theme.ts:150`), so a school themed from the fallback is
indistinguishable from one themed from its real colors.

**Ticketmaster SharedID carries no team suffix.** `affiliates.ts:274` passes the
bare surface string when there is no `venueSlug`, unlike TicketNetwork
(`affiliates.ts:351`), SpotHero (`SpotHeroCTA.tsx:63`) and Expedia
(`hotel-link.ts:67`), which all append `_{team.id}`. Ticketmaster attribution is
therefore surface-level only on every page.

**`run-phase2.ts --execute --only=<school>` is not idempotent on machine-owned
fields.** Proven on notre-dame during the Phase 1A gate: the two human-owned
fields survived, but the re-parse nulled `rivalryId` on 5 of 14 docs (including
`michigan-state--notre-dame` and `notre-dame--stanford`, which back registry
matchup pages), degraded `broadcast.network` from "NBC and Peacock" to "NBC" on
7 docs, and flipped `kickoff.tz` from ET to TBD on 4 TBD games. `rivalryDocs`
ended at size 0, so `tagRivalry` returns null in a scoped run. All 14 docs were
restored from snapshot. The preservation allowlist protects the two fields it
names; it does not make a scoped re-run safe.

### tagRivalry loses rivalry context under scoping. Open, not chased.

`scripts/cfb/run-phase2.ts` calls `tagRivalry(home, away)` at `:79` to attach
`rivalryId`. Under `--only=<school>` it returns null for every game and the run
reports `rivalries=0`, so the rebuild nulls a field the entire
`/cfb/rivalries` family keys on.

Measured on notre-dame at the Phase 1A gate, 5 of 14 docs lost `rivalryId`:

| Doc | Lost tag | Backs |
|---|---|---|
| `2026-2026-09-19-notre-dame-michigan-state` | `michigan-state--notre-dame` | `megaphone-trophy` |
| `2026-2026-10-10-notre-dame-stanford` | `notre-dame--stanford` | `legends-trophy` |
| `2026-2026-10-31-navy-notre-dame` | `navy--notre-dame` | not in the registry |
| `2026-2026-09-26-purdue-notre-dame` | `notre-dame--purdue` | not in the registry |
| `2026-2026-11-14-notre-dame-boston-college` | `boston-college--notre-dame` | not in the registry |

The same run also degraded `broadcast.network` (for example "NBC and Peacock" to
"NBC") on 7 docs and flipped `kickoff.tz` from a real zone to TBD on 4 TBD games.
All 14 docs were restored from snapshot.

WHY it happens is unknown and was deliberately not chased: it is real work and it
is not what stands between the project and the pages. Phase 1B-C contains the
blast radius instead. A scoped `--execute` now exits 1 unless `--force-scoped` is
passed, and `MACHINE_OWNED_CRITICAL` tripwires every `rivalryId` about to go from
populated to null, in dry and execute alike. `rivalryId` is deliberately NOT in
`HUMAN_OWNED_FIELDS`: preserving a stale machine-derived tag that the fresh parse
disagrees with would be worse than losing it.

### Settled: the canonical-doc rule for duplicate pairs

Amended after the Phase 1A write. The rule is now, in order:

1. `broadcast.confirmed` true wins
2. the normalized `H:MM AM/PM` kickoff shape wins
3. `verified: true` wins
4. the school the official sources designate as home wins

Adding `verified` as step 3 reproduces all 8 verdicts with no deviation. Under
the previous three-step rule, UNC vs TCU fell through to designated home (TCU),
which would have kept a `verified:false` doc storing "11:00 AM ET" for a game
that kicks at 11:00 AM CT, rendering "Kickoff TBA" and a wrong time. Step 3
changes only that pair and agrees with step 2 everywhere else.

### The Phase 2 writer is quarantined. Full 86-school evidence.

A dry run over all 86 schools, with NO scoping of any kind, cost $2.54 and wrote
nothing. It measured the rebuild dropping most of the rivalry tagging in the
corpus.

| Measure | Value |
|---|---|
| Game docs that would lose `rivalryId` | **80** |
| Distinct rivalries affected | **79** |
| Live docs currently carrying a `rivalryId` | 108 |
| Share of all rivalry tags lost | **74.1%** |
| Rivalries the run itself assembled | **28** |
| Tripwire lines emitted | 148 |

**Nine of the 32 registry matchup pages would silently empty**, because
`getMatchupPage` finds a matchup's game by `rivalryId`:

`washington--washington-state`, `lsu--ole-miss`, `texas--texas-am`,
`iowa--minnesota`, `auburn--georgia`, `michigan-state--notre-dame`,
`notre-dame--stanford`, `duke--north-carolina`, `illinois--ohio-state`

This is NOT a scoping bug. Phase 1B-C refused a scoped execute on the
notre-dame evidence and pointed at `--execute --resume` as the safe path. The
full-run measurement proved that pointer wrong: `tagRivalry` is failing broadly
and the scoped case was only where it surfaced first. Phase 1E therefore refuses
every `--execute`, with `--force-unsafe-write` as the loud override.

`tagRivalry` itself is UNDIAGNOSED and deliberately untouched. It is its own
piece of work with its own gate.

The degrade tier was added at the same time and immediately confirmed the two
fields that had been suspected but never measured. On notre-dame alone a dry run
reports 12 degradations: 8 `broadcast.network` (for example "NBC and Peacock" to
"NBC", and "ABC or ESPN" to "TBD") and 4 `kickoff.tz` (a real zone to "TBD").
These are reported as DEGRADE rather than LOSS because a different non-null value
does not empty a page, and mixing them into the LOSS tier would bury the alarm
that matters.

### Matchup page residue, logged not fixed

**8 matchup pages render 3 trip steps, all missing Gates and bags**, because the
building's `venueHubs` doc sits below the index floor. Six buildings:

| Building | Why it fails the floor | Pages affected |
|---|---|---|
| `bill-snyder-family-football-stadium` | verified, fails 2-of-3 facts | sunflower-showdown |
| `memorial-stadium-indiana-university` | verified, fails 2-of-3 facts | old-oaken-bucket |
| `california-memorial-stadium` | verified, fails 2-of-3 facts | big-game |
| `kinnick-stadium` | verified, fails 2-of-3 facts | heroes-trophy, cy-hawk-trophy |
| `sanford-stadium` | `verified:false` | clean-old-fashioned-hate, deep-souths-oldest-rivalry |
| `martin-stadium-northwestern-university` | `verified:false` | land-of-lincoln-trophy |

`sanford-stadium` backs two pages, both Georgia rivalries. This is a venueHubs
DATA gap, not a gating defect: the gate is working exactly as designed and
refusing to link into a hub with nothing in it. It belongs in a venue data pass.

**`legends-trophy` is the only page falling through to the nearest-date rail
tier**, so its heading reads "More rivalries" rather than "More rivalry week".

**`buildRivalrySentences` filters any name matching `/rivalr/i`**
(`page-extras.ts:52`), so `deep-souths-oldest-rivalry` renders without an
identifier clause: "The Auburn vs Georgia rivalry is played on Saturday, October
17 at Sanford Stadium." Flat, not wrong. The generator is deliberately untouched.

### Operational trap: zsh does not word-split an unquoted variable

`"--execute --resume"` passed as `$a` arrives as a SINGLE argument, so
`args.includes('--execute')` reads false and the run silently proceeds as a full
DRY parse of all 86 schools. This has now cost this project twice, once in
Firecrawl credits and once in a five-minute stall during the Phase 1E gate.
Always pass writer flags explicitly rather than through a loop variable, or use
`${=a}` if a loop is unavoidable.

---

## Open items, Phase 2C closeout

Logged at the final gate, before the merge to main. None of these blocked the
merge; each is a judgment call or a pre-existing condition that should not be
rediscovered later as a surprise.

### Rail placement cost, revisit with data

The rivalry rail adds a uniform **101px** and pushes the first ticket CTA below
the 844px fold on **7 of the 45** rail schools: kansas, alabama, oklahoma,
texas, mississippi-state, louisville, kansas-state. Three of those (alabama,
oklahoma, texas) are among the highest-volume schools in the corpus.

This is **accepted as a judgment call, not a measured win**. What it buys is a
matchup link at roughly y=700 instead of y=1737, and the affiliate rail plus the
matchup page's own tickets step both still persist below. What it costs is an
above-the-fold ticket CTA on seven pages.

Revisit once the matchup pages have GSC data. If they earn clicks, the rail is
justified. If they do not, moving the rail below the gameday block costs about
300px of link position and restores the CTA. The move is a single JSX
relocation in `CfbSchoolPage.tsx`; nothing else depends on the rail's position.

### The rail cap of 4 does not currently bind

`RAIL_MAX_CHIPS` bounds rivalries **with a matchup page**, not rivalries. So
Alabama shows 2 of its 5 and Auburn 2 of its 7. The widest school today is 3
chips (iowa, georgia, minnesota). The cap and its test are in place and correct;
they are simply inert until the registry grows past 4 rivalries for one school.

### The /cfb hub serves two nested `<main>` elements

The layout emits one and the page emits another. Invalid HTML, pre-existing,
unrelated to this branch. It will affect anything that selects `main`, including
measurement scripts and any future reader-mode or extraction logic. Found while
measuring the hub for Phase 2B, fixed nowhere.

### TrophyTag renders an `<a>` inside a `<button>` on schedule rows

Invalid HTML with undefined activation behaviour. Pre-existing: it was the
Wikipedia link before Phase 2 changed the href. On /cfb/alabama it affects 5 of
16 rows, of which 3 were already nested before this branch. Phase 2 changed
hrefs without adding nesting, and Phase 2B deliberately left it alone. Unpicking
it means reworking the row affordance, which belongs in a component pass over
the whole row rather than in a linking change.

### Schedule-row opponent links are permanently out of scope

Decided in Phase 2B. The row is a `<button>` that opens the gameday modal, so an
opponent anchor would nest a second `<a>` inside it, and the rivalry card
further down already carries that exact destination. The trade was a duplicate
link for invalid nesting on every row. See the comment at
`src/components/cfb/CfbSchedule.tsx:37`.

### The 32 matchup pages ship with no meta description

`generateMetadata` in `src/app/cfb/rivalries/[slug]/page.tsx` returns only a
`title`, so all 32 pages inherit the sitewide description from
`src/app/layout.tsx:60`. They are titled and indexable, but 32 brand-new URLs
share one generic description, which means Google will most likely generate its
own snippet for each. The index page `/cfb/rivalries` does set its own
description. Worth a small follow-up: the matchup data already carries both
school names, the date and the venue, which is more than enough for a truthful
per-page description.

### The revalidate PATH_RE widening has an uncommitted counterpart in promo-pipeline

`src/app/api/revalidate/route.ts` widened `PATH_RE` from two segments to three
so `/cfb/rivalries/<slug>` validates. The pipeline keeps its own copy at
`promo-pipeline/lib/revalidate-notify.js:22`, and **that change is currently an
uncommitted working-tree edit in the other repo**. The web side is safe on its
own, since widening only makes the endpoint accept more, and nothing in the CFB
rivalry family depends on pipeline-driven revalidation today. But the two copies
must be committed together or a future pipeline run from committed code will
silently drop any three-segment path with only a warn line in a log.

### `revalidate-path-re.test.ts` depends on a sibling repo checkout

Two of its five tests read
`../promonight/promo-pipeline/lib/revalidate-notify.js` to assert the two copies
have not diverged. That path only resolves on a machine with both repos checked
out as siblings, so the test throws on a fresh clone of this repo alone. It is
deliberately left as-is: making it skip when the file is absent would disable
exactly the divergence guard that matters. Note that this repo's CI does not run
the test suite (`.github/workflows/` contains only `indexnow-after-deploy.yml`),
so nothing breaks today.

### `audit/venue-manifest.json` was swept into commit 7d60eb4 and untracked again

A 7184-line generated venue manifest, unrelated to the matchup work, was picked
up by an over-broad `git add` during the Phase 1A write. It was untracked at the
start of the session, this document already described it as untracked, and no
code reads it. Removed from tracking before the merge so it does not land in
main; the file remains on disk.

---

## Title inversion outcome, HYPOTHESIS TO TEST

Logged after the Phase 2C merge went live. This is a bet with a review date, not
a settled result.

**44 of 86 school-page titles no longer contain "Football Schedule" at all.**
They fell through to the third candidate (`{school} {token} {year}`) because the
longer forms exceed the 47-character field budget once the rivalry token leads.
That is the candidate chain working exactly as designed, and it is half the
corpus rather than an edge case.

The four shapes now in production:

| shape | schools | example |
| --- | --- | --- |
| token + ": Gameday & Football Schedule" | 2 | BYU Holy War 2026: Gameday & Football Schedule |
| token + ": Football Schedule" | 39 | Kansas Border War 2026: Football Schedule |
| token only | 44 | Iowa State Cy-Hawk Trophy 2026 |
| schedule-first, no rivalry | 1 | Northern Illinois Football Schedule 2026 |

**The bet:** a rivalry term we can win beats a schedule term Google's own sports
panel owns. The supporting evidence is that schedule-intent queries sit at
position 34 to 56 while these pages already rank 3.7 to 9.3 on rivalry and
trophy queries with no deliberate targeting.

**The review:** read GSC at 2 and 4 weeks post-deploy. If impressions on those
44 fall without a matching rise in rivalry-term clicks, either the title budget
needs raising or the candidate order needs revisiting. Do not act on week-1
noise, and do not treat a fall in schedule impressions as failure on its own;
the whole point is that those impressions were not converting.

**Northern Illinois is the only school with no 2026 rivalry game**, and so the
only one that retains the schedule-first title shape. It is the control.

**The inversion changed `<title>` only.** School-page H1s remain the bare school
name ("Alabama"). Only the matchup pages carry a rivalry-named H1. Anything
verifying this work must read the title tag, not the H1.

## Metadata gaps found after the merge, fixed on feature/cfb-rivalry-metadata

The 33 URLs shipped with `generateMetadata` returning only `{ title }`. Three
consequences, none of them visible without reading the served HTML:

- **No canonical on any of the 33.** The apex/www canonical mismatch is the
  documented root cause of the May 2026 Bing deindex, and these were the newest
  and least established pages on the site.
- **`og:url` pointed at the site root** rather than the page, on all 33.
- **The description was inherited from the root layout**, which names MLB, NBA,
  NFL, NHL, MLS and WNBA, mentions no college football, and ends on bobbleheads.

A fourth, found while building the descriptions and fixed at the source:
**`getMatchupPage` read the raw `cfbVenues.city`**, which is junk for 59 of the
86 venues. Two pages were live rendering "Notre Dame Stadium | coordinates ="
in the fact card (`legends-trophy`, `megaphone-trophy`). The reader now goes
through `venueCity()` like every other CFB surface already did.

Note for anyone adding page-level Open Graph later: Next shallow-merges
metadata, so a route that sets `openGraph: { url }` REPLACES the layout's
openGraph object wholesale and silently drops `og:title` and `og:image`. Both
new builders emit the full object for that reason.

---

## Open items added after the metadata merge (63efa7b, 2026-08-12)

### CLOSED 2026-08-14: cfbVenues.city junk (was: 59 of 86 unrepaired)

The raw `city` field held street addresses, "University of X" run-ons, wiki
fragments, bracketed URLs and empties. Two examples of the shape:
`ross-ade-stadium.city` was a street address with a bracketed campus-directory
URL, and `notre-dame-stadium.city` the literal string
`| coordinates         =`, a leaked wikitext row.

Every CFB surface routes around it through `venueCity()`
(`src/lib/cfb/venue-cities.ts`), a hand-verified id-to-city map, and the last
reader that did not, `getMatchupPage`, was fixed in this merge. The map returns
null for an unmapped id so a caller falls back to the venue name alone and never
renders the raw field.

CLOSURE NOTE (2026-08-14, read-only Firestore inspection of all 86 docs):
city is populated 86/86 and clean on 85/86. One residual junk value remains:
notre-dame-stadium.city is still the wikitext row quoted above (the doc's
updatedAt predates this entry, so the field itself was never repaired there).
beaver-stadium's "University Park" is correct (that is the real Penn State
locality), not junk. Nothing user-facing renders the raw field, so the ticket
is closed; if notre-dame-stadium.city is ever repaired, that one write is the
whole remaining job.

**The underlying records are still wrong.** What exists today is a complete
read-side workaround, not a repair. The consequences of leaving it:

- Every new CFB reader is one missed `venueCity()` call away from shipping
  wikitext to a live page. That is exactly how `legends-trophy` and
  `megaphone-trophy` reached production rendering
  "Notre Dame Stadium | coordinates =".
- The map has to be hand-extended for any venue added later, and nothing fails
  loudly when it is not: an unmapped id degrades silently to name-only.
- Anything reading `cfbVenues` directly, outside the app, gets the junk.

**Group this with the venueHubs index-floor work.** Both are the same class of
problem, a venue-data pass rather than an app-code pass, both touch the same
buildings, and doing them together means one verification sweep over the venue
corpus instead of two.

### Next shallow-merges metadata, so partial openGraph objects are destructive

A route that sets `openGraph: { url }` does NOT merge that url into the layout's
Open Graph block. It REPLACES the entire object, silently dropping `og:title`
and `og:image`.

Adding only the url, which is the obvious reading of "set og:url", would have
blanked the social image on all 33 rivalry URLs, and nothing would have failed:
no type error, no build warning, no test. The only symptom is a link preview
that renders as a bare text card.

**Any future page-level Open Graph must emit the FULL object**: title,
description, siteName, url, type and images. `buildCfbMatchupMetadata` and
`buildCfbRivalryIndexMetadata` do this, matching `buildCfbTeamMetadata` and
`buildCfbHubMetadata`, which is why all four CFB surfaces are consistent. Verify
by reading served HTML for `og:title` and `og:image`, not by reading the route
file, since the destructive case looks correct in source.
