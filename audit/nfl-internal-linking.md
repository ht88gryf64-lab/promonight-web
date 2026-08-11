# NFL internal linking — Phase 0 read-only audit

**Measured 2026-08-10.** Production host `getpromonight.com`, iPhone UA, SSR HTML captured
2026-08-10. Fold positions measured in real Chrome at a true 390×844 viewport (same-origin
iframe, `getBoundingClientRect().top + scrollY`), not estimated from Tailwind classes.
Firestore read live, read-only. No repo file was modified; this file and
`audit/cfb-matchup-architecture.md` are the only two artifacts produced.

Analytics window referenced throughout: GSC/GA4/PostHog 2026-07-08 → 2026-08-05, all of which
pre-dates the 2026-08-07T16:59:27Z measurement boundary. No comparison here crosses it.

---

## PART 0 — Shared template and linking survey

### 0.1 The five templates

| # | Surface | Route file | Notes |
|---|---|---|---|
| 1 | `/nfl/[slug]` | `src/app/[sport]/[team]/page.tsx` | **There is no `src/app/nfl/[slug]` directory.** `/nfl/<team>` and `/mlb/<team>` are the *same* route; the sport segment is derived, not a separate template. Live branch is `RedesignTeamPage` (`src/app/[sport]/[team]/page.tsx:250`, returns at `:252`); the legacy JSX at `:270-469` is dead in prod. |
| 2 | `/cfb` | `src/app/cfb/page.tsx` | Hub. |
| 2b | `/cfb/[school]` | `src/app/cfb/[school]/page.tsx` → `src/components/cfb/CfbSchoolPage.tsx` | 86 pages, one template. |
| 3 | `/promos/*` | `src/app/promos/bobbleheads/page.tsx` (→ `src/components/aggregator-layout.tsx:56,60`), `src/app/promos/today/page.tsx`, `src/app/best-promos/page.tsx` | **Not one template.** Only `/promos/bobbleheads` goes through `AggregatorPage`; `/promos/today` and `/best-promos` hand-roll their layouts (`src/app/promos/today/page.tsx:14` imports only `AggregatorJsonLd`). |
| 4 | `/mlb/[slug]` | `src/app/[sport]/[team]/page.tsx` | Same file as #1. |
| 5 | `/venues/[slug]` | `src/app/venues/[slug]/page.tsx` → `src/components/venue-hub/VenueHubView.tsx` | |

Gate: `isRedesignEnabled()` at `src/lib/redesign.ts:16-21` is ON in prod. Confirmed from served
markup, not inferred — the `rd-root` wrapper from `src/components/redesign/RedesignTeamPage.tsx:143`
is present on all 11 captured pages, and the legacy footer's `All 169 teams` heading
(`src/components/footer-team-sitemap.tsx:34`) is absent from all 11.

### 0.2 Shared chrome — identical on every page, enumerated once

Verified programmatically across all 11 captured pages: the leading 21 anchor hrefs are
byte-identical in the same order on 11/11, and the trailing 18 are identical on 11/11. **Chrome is
always exactly 39 anchors: DOM 1–21 (nav) and the last 18 (footer). Body = index 22 … total−18.**
The only varying byte is the footer CTA's `?source=` query
(`src/lib/follow-surface.ts:103-118`) — path, not destination.

| DOM | Text | Destination | Rendered by | Above fold @390 |
|---|---|---|---|---|
| 1 | PROMO NIGHT (wordmark) | `/` | `src/components/redesign/BrandBar.tsx:43` | **YES** (y=19) |
| 2–4 | Today / Teams / My Teams | `/promos/today`, `/teams`, `/my-teams` | `src/components/redesign/BrandBar.tsx:55` (hrefs `:34-36`) | NO — wrapper is `hidden … md:flex` at `BrandBar.tsx:53` |
| 5 | About | `/about` | `src/components/redesign/BrandBar.tsx:60` | NO — same wrapper |
| 6–10 | MLB / WNBA / MLS / NFL / CFB | `/mlb`,`/wnba`,`/mls`,`/nfl`,`/cfb` | `src/components/redesign/BrandBarLeagueHubs.tsx:68` over `LEAGUE_HUBS` (`src/lib/league-hubs.ts:36`) | NO — `hidden md:block` at `BrandBar.tsx:68` **and** the panel carries `hidden` while closed at `BrandBarLeagueHubs.tsx:65` |
| 11 | Get the App | `/download` | `src/components/redesign/BrandBar.tsx:73` → `Button.tsx:78` | NO — `hidden md:block` at `BrandBar.tsx:72` |
| 12–21 | Full duplicate of 2–11 | same 10 hrefs | `src/components/redesign/BrandBarMobileMenu.tsx:93, :98, :108, :116` | NO — inside a closed `<dialog>`; children stay mounted per `src/components/ui/modal.tsx:27-28` |
| −18 | Get every giveaway in your inbox → | `/follow?source=…` | `src/components/follow/FollowFooterCTA.tsx:27`, mounted `Footer.tsx:100` | NO |
| −17…−11 | Promos today / Hot this week / Bobbleheads / Jersey giveaways / Theme nights / Food deals / All teams | `/promos/*`, `/teams` | `src/components/redesign/Footer.tsx:71` (BROWSE list `:23-31`) | NO |
| −10…−6 | Best promos / Team rankings / Stadium guides / World Cup 2026 / Follow your teams | `/best-promos`, `/team-rankings`, `/venues`, `/world-cup`, `/follow` | `src/components/redesign/Footer.tsx:71` (DISCOVER list `:46-52`) | NO |
| −5…−2 | About / Download / Privacy Policy / Terms of Service | `/about`,`/download`,`/privacy`,`/terms` | `src/components/redesign/Footer.tsx:71` (COMPANY list `:33-39`) | NO |
| −1 | Contact | `mailto:` | `src/components/redesign/Footer.tsx:64` | NO |

Three corrections to assumptions that were worth checking:

- **The footer team sitemap does not exist in production.** `FooterTeamSitemap` is imported by
  exactly one file, the dead-in-prod `src/components/footer.tsx:3` (mounted `:110`). `grep -l "All 169 teams"`
  matches **zero** of the 11 captured pages. Team links contributed by chrome: **0**.
  Even on the gate-off path it would emit zero team anchors in SSR, because
  `src/components/footer-team-sitemap.tsx:10` is `useState(false)` and the whole grid sits behind
  `{open && …}` at `:50`.
- **At 390px exactly one chrome anchor is visible: the wordmark.** Everything else is `display:none`.
  A crawler sees 39 chrome anchors; a phone user sees 1 and a hamburger *button*.
- Two chrome anchors are currently suppressed and would shift every index if they returned:
  `/playoffs` (`BrandBar.tsx:37`, fails closed via `layout.tsx:90-96`) and `/world-cup`
  (`BrandBar.tsx:59`; `WORLD_CUP_END` = 2026-07-20 at `src/lib/world-cup-active.ts:11-16`).

### 0.3 Body-zone inventories

Chrome is excluded below (it is identical everywhere and enumerated in 0.2). "AF" = above the fold
at a measured 390×844 viewport.

#### 1. `/nfl/[slug]` — `/nfl/dallas-cowboys` (zero-promo branch), 30 body anchors / 22 internal

| DOM | y px | Text | Destination | Rendered by | AF | Contextual |
|---|---|---|---|---|---|---|
| 22 | 122 | NFL (hero eyebrow) | `/nfl` | `src/components/redesign/RedesignTeamPage.tsx:128` (href `:89-90`, slotted `Hero.tsx:47-51`) | **YES** | yes |
| 23 | 4018 | Get Tickets → | TicketNetwork (EXT) | `src/components/affiliates/TicketmasterCTA.tsx:165` via `tracked-affiliate-link.tsx:77` | NO | yes |
| 24 | 4087 | ticketmaster Get Tickets → | Ticketmaster (EXT) | `src/components/affiliates/TicketmasterCTA.tsx:141` | NO | yes |
| 25 | 4158 | SpotHero Reserve Parking → | SpotHero (EXT) | `src/components/affiliates/SpotHeroCTA.tsx:80` | NO | yes |
| 26 | 4225 | Find hotels near AT&T Stadium | Expedia (EXT) | `src/components/affiliates/ExpediaCTA.tsx:60` | NO | yes |
| 27 | 4298 | Fanatics Shop Fan Gear → | Fanatics (EXT) | `src/components/affiliates/FanaticsCTA.tsx:49` | NO | yes |
| 28 | 4365 | Full gameday guide | `/venues/att-stadium` | `src/components/venue-hub/VenueHubLink.tsx:63` (href `:45`), mounted `AffiliateRail.tsx:56-63` | NO | yes |
| 29 | 5100 | Official AT&T Stadium bag policy ↗ | dallascowboys.com (EXT) | `src/components/venue-info-block.tsx:68` (gate `:64`) | NO | yes |
| 30–34 | 7006–7242 | Every bobblehead / Hot this week / Jersey & apparel giveaways / Theme nights / Food deals | `/promos/bobbleheads`, `/promos/this-week`, `/promos/jersey-giveaways`, `/promos/theme-nights`, `/promos/food-deals` | `src/components/redesign/ExploreCard.tsx:51` (items `:32-36`) | NO | no |
| 35 | 7298 | All NFL teams | `/teams?league=NFL` | `src/components/redesign/ExploreCard.tsx:51` (item `:39`) | NO | query only |
| 36 | 5404 | 2026 schedule release video | YouTube (EXT) | `src/components/ScheduleReleaseVideoCard.tsx:106-107`, mounted `RedesignTeamPage.tsx:233-237` | NO | yes |
| 37–44 | 973–3164 | "New York Giants schedule", Texans, Packers, Eagles, Colts, Seahawks, Rams, Commanders | `/nfl/[opponent]` ×8 | `src/components/redesign/ScheduleRow.tsx:175`; href computed `ScheduleBlock.tsx:188-191`, passed `:220-221` | NO | yes |
| 45–47 | 3512–3810 | Giants / Eagles / Commanders (rival cards) | `/nfl/[rival]` ×3 | `src/components/team-card.tsx:72-73` via `DivisionRivals.tsx:34` | NO | yes |
| 48 | 6487 | Get the free weekly email → | `/follow?source=web_team_page&team=…` | `src/components/follow/EmailCtaLink.tsx:36` via `FollowCTA.tsx:46` | NO | query only |
| 49 | 6773 | Download for iOS | `/download` | `src/components/app-download-buttons.tsx:27-28` | NO | no |
| 50 | 6829 | Play Store badge | play.google.com (EXT) | `src/components/app-download-buttons.tsx:38-39` | NO | no |
| 51 | 7486 | Hot promos this week / All leagues | `/promos/this-week` | `src/components/team-related-aggregators.tsx:62` (item pushed unconditionally `:45-49`) | NO | no |

The Rams page (populated branch, 1 promo) is the same template with **21 body anchors / 14
internal**: identical rows 22, 23–28, 36, 45–47 (NFC West), 48–51 — but **zero schedule-opponent
anchors** and no bag-policy link. The 9-anchor Cowboys→Rams delta is exactly the 8 opponent
anchors plus 1 external bag-policy link (69 − 60 = 9). Verified independently.

#### 2. `/cfb` and `/cfb/[school]`

`/cfb` hub — 180 body anchors, 179 internal, **151 distinct internal destinations**:

| DOM | Count | Destination | Rendered by | AF (measured) |
|---|---|---|---|---|
| 22 | 1 | `#browse` (in-page) | `src/app/cfb/page.tsx:67` | YES (y=424) |
| 23 | 1 | `/promos/today` | `src/components/cfb/hub/CfbTodaySlot.tsx:23` | **YES** (y=625) |
| 24–39 | 16 | `/cfb/[school]` — weekly rail corner names | `src/components/cfb/hub/blocks.tsx:19` via `:73-74` | **YES — all 16 at y=725** |
| 40–47 | 8 | `/cfb/[school]` — 4 NationalBlocks × 2 | `src/components/cfb/hub/blocks.tsx:19` via `:53-54` | NO (y=1014+) |
| 48–51 | 4 | `/cfb/[school]` — ThemeCards | `src/components/cfb/hub/blocks.tsx:93` | NO |
| 52–137 | 86 | `/cfb/[school]` — browse-all grid | `src/components/cfb/hub/CfbHubBrowse.tsx:37`, rendered `:75` | NO |
| 138–201 | 64 | `/venues/[slug]` — stadium guides | `src/components/hub/HubVenueLinks.tsx:41` (href `:38`) | NO |

`/cfb/alabama` — 18 body anchors, **3 internal**:

| DOM | y px | Text | Destination | Rendered by | AF |
|---|---|---|---|---|---|
| 22 | 95 | ← College Football | `/cfb` | `src/components/cfb/CfbSchoolPage.tsx:82` | **YES** |
| 23–27 | 754–1053 | 5 affiliate CTAs | EXT | `AffiliateRail`-equivalent adapters, `src/lib/cfb/page-extras.ts:82-124` | NO |
| 28 | 1120 | Full gameday guide | `/venues/saban-field-at-bryant-denny-stadium` | `src/components/venue-hub/VenueHubLink.tsx:63`, gate `CfbSchoolPage.tsx:203` | NO |
| 29–38 | 1573–3013 | "Battle for Highway 82", "Alabama–Georgia", "Third Saturday in October", "Alabama–LSU", "James E. Foy, V-ODK Sportsmanship Trophy" — each rendered **twice** | **en.wikipedia.org (EXTERNAL)** | `src/components/cfb/cfb-bits.tsx:33-44` (schedule rows) and `src/components/cfb/CfbSchoolPage.tsx:262-271` (rivalry cards) | NO |
| 39 | 3334 | Contribute to this page | `/cfb/contribute?school=alabama` | `src/components/cfb/CfbSchoolPage.tsx:303` | NO |

#### 3. `/promos/*` and `/best-promos`

| Page | Body anchors | Body internal | Distinct body internal | AF internal | First contextual link |
|---|---|---|---|---|---|
| `/promos/bobbleheads` | 89 | 85 | 32 | 2 | `/mlb/los-angeles-dodgers` at y=848 |
| `/promos/today` | 156 | 42 | 19 paths / 41 hrefs | 3 | `/mlb` hub link at y=576, first card y=614 |
| `/best-promos` | 152 | 52 | 21 | 3 | `/best-promos/bobbleheads` at y=651, first card y=961 |

The emitters:

| Slot | Count | Destination | Rendered by |
|---|---|---|---|
| bobbleheads: 79 promo rows | 79 | `/[sportSlug]/[teamId]` → **29 distinct team pages** (MLB 24, MLS 2, WNBA 2, NFL 1) | `src/components/redesign/RedesignAggregatorList.tsx:147` |
| bobbleheads: "Earlier this season" | 3 | 3 MLB team pages | `src/components/redesign/PastBobbleheadsSection.tsx:42` (`LIFT_VISIBLE=3` at `:17`, applied `:84`) |
| today: league section headers | 3 | `/mlb` ×2, `/wnba` | `src/components/promos-today/TodayLeagueSection.tsx:39-40`, gated on `group.hubHref` (`:38`, computed `helpers.ts:50`) |
| today: promo cards | 38 | `/[sport]/[team]#promo-…` → **16 distinct team pages** | `src/components/redesign/RedesignPromoRow.tsx:132`, href built `src/components/promos-today/TodayPromoCard.tsx:29` |
| today: planning-ahead card | 1 | `/promos/this-week` | `src/app/promos/today/page.tsx:211` |
| best-promos: scored cards | 50 | `/[sport]/[team]` → **19 distinct team pages**, all MLB | `src/components/scoring/scored-promo-card.tsx:68`, mounted `best-promos-browser.tsx:232` |
| best-promos: sibling collection | 1 | `/best-promos/bobbleheads` | `src/app/best-promos/page.tsx:210` |
| bobbleheads only: breadcrumb / app CTA / follow CTA | 3 | `/`, `/download`, `/follow` | `aggregator-layout.tsx:87`, `:142`, `:160` |

#### 4. `/mlb/[slug]` — `/mlb/los-angeles-dodgers`, 111 body anchors / **27 internal, 84 external**

| DOM | y px | Slot | Destination | Rendered by | AF |
|---|---|---|---|---|---|
| 22 | 122 | Hero eyebrow | `/mlb` | `RedesignTeamPage.tsx:128` | **YES** |
| 28 | 1684 | Full gameday guide | `/venues/dodger-stadium` | `VenueHubLink.tsx:63` | NO |
| 30–35 | — | ExploreCard ×6 | `/promos/*` ×5 + `/teams?league=MLB` | `ExploreCard.tsx:51` | NO |
| 54,59,64,75,80,85,90,95,100 | 5437+ | 9 "View … full schedule" | `/mlb/colorado-rockies` ×3, `/mlb/atlanta-braves` ×3, `/mlb/detroit-tigers` ×3 | `src/components/redesign/GameExpand.tsx:221-222`, reached via `CalendarGrid.tsx:437` | NO |
| 122–125 | 6317–6764 | 4 rival cards (NL West) | `/mlb/[rival]` | `team-card.tsx:72-73` via `DivisionRivals.tsx:34` | NO |
| 126–127 | 7214+ | Follow / Download | `/follow`, `/download` | `EmailCtaLink.tsx:36`, `app-download-buttons.tsx:27` | NO |
| 129–132 | — | TeamRelatedAggregators ×4 | `/promos/bobbleheads`, `/promos/jersey-giveaways`, `/promos/theme-nights`, `/promos/this-week` | `team-related-aggregators.tsx:62` | NO |
| — | — | 84 external | 29× TicketNetwork + 29× Ticketmaster + 10× SpotHero + 10× Expedia + 3× eBay + Fanatics + mlb.com + Play Store | `GameExpand.tsx:191-217`, `AffiliateRail.tsx:41-47`, `promo-list.tsx:208` | — |

**The Dodgers' largest content block — a 46-promo `PromoList` — emits zero internal anchors.**
`RedesignTeamPage.tsx:318-332` mounts `PromoList` without an `href` prop, so every row takes
`RedesignPromoRow`'s modal-opener branch (`openable = interactive && !!team && !href`, `:95`) and
the stretched `<Link>` at `:131-137` never renders. 103 of the Dodgers' 150 anchors have zero
rendered height at 390px (collapsed schedule rows plus the mobile-menu duplicate).

#### 5. `/venues/[slug]` — `/venues/acrisure-stadium`, 14 body anchors / **3 internal**

| DOM | y px | Text | Destination | Rendered by | AF |
|---|---|---|---|---|---|
| 22 | 380 | Official bag policy › | pittsburghpanthers.com (EXT) | `src/components/venue-hub/VenueHubView.tsx:296` | YES |
| 23 | 454 | (promo card overlay) | `/nfl/pittsburgh-steelers#promo-…` | `RedesignPromoRow.tsx:132`, href `VenueHubPromoCard.tsx:39` | **YES** |
| 24 | 679 | Steelers promos & giveaways | `/nfl/pittsburgh-steelers` | `src/components/venue-hub/HubTeamLink.tsx:68`, mounted `VenueHubView.tsx:311-329` | **YES** |
| 25 | 760 | Pittsburgh gameday guide | `/cfb/pittsburgh` | `src/components/venue-hub/HubTeamLink.tsx:68` | **YES** |
| 26–35 | 890–1913 | 10 external (5 unique, each rendered twice — mobile copies `VenueHubView.tsx:509,:513`, desktop rail `:520-521`) | EXT | — | NO |

Tenant hrefs are built by `resolveTenantTeamLinks` (`src/lib/venue-hub.ts:400-415`): pro → `/{sportSlug}/{id}` (`:411`), CFB → `/cfb/{id}` (`:408`); unresolvable tenants are skipped (`:406-412`), so there are no dead links. **Venue→venue links: ABSENT** — grep of `src/components/venue-hub/` finds five href sites (`VenueHubView.tsx:296,:320,:354,:381`; `HubTeamLink.tsx:69`; `VenueHubPromoCard.tsx:98`) and none targets `/venues/…`. `src/lib/venue-index.ts:81-94` *does* contain venue-to-venue logic but `src/app/venues/[slug]/page.tsx:4-13` never imports it.

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

1. **Every content row is itself an anchor.** `src/components/redesign/RedesignAggregatorList.tsx:147`
   (79 anchors → 29 team pages), `src/components/scoring/scored-promo-card.tsx:68` (50 → 19),
   `src/components/redesign/RedesignPromoRow.tsx:132` driven by
   `src/components/promos-today/TodayPromoCard.tsx:29` (38 → 16). A team page mounts the *same
   component* without an `href` (`src/components/promo-list.tsx:252` and `:311`), and
   `RedesignPromoRow` renders its stretched `<Link>` only when `href` is set
   (`RedesignPromoRow.tsx:131-137`). **This is a one-prop difference in a shared component and it
   is the single largest structural gap in the survey.**
2. **A dense contextual grid above the fold.** `/cfb` puts 16 school anchors at y=725
   (`src/components/cfb/hub/blocks.tsx:19` via `:73-74`) and `/nfl` (the hub) puts 65 at y=740
   (`src/components/hub/HubTeamGrid.tsx`). A team page's first contextual link is at y=973
   (Cowboys) / y=1684 (Dodgers) / y=1734 (Rams).
3. **Per-promo fragment deep links.** `TodayPromoCard.tsx:29` builds `/{sport}/{team}#promo-{id}`
   using the shared formula at `src/lib/promo-helpers.ts:27`, which the team-page row reproduces
   as its DOM id (`promo-list.tsx:259`). No team page emits an outbound deep link of this shape.
4. **Contextual league-hub links that vary with data.** `TodayLeagueSection.tsx:38-46`, href from
   `helpers.ts:50`. A team page has one fixed up-link to its own hub.
5. **A conference-bucketed browse-all grid** (`CfbHubBrowse.tsx:37`, rendered `:75`, all 86 always
   in the DOM — the filter is `display:none` only, `:41`) and **a 64-item stadium-guide list**
   (`HubVenueLinks.tsx:41`). Together 150 of the hub's 179 body-internal anchors.

**What the `/promos` family conversely *lacks* versus a team page** — reported because it cuts
against the hypothesis:

- No cross-aggregator "browse other collections" grid on any of the three pages. `BrowseCollections`
  exists (`src/components/browse-collections.tsx:24`, tiles `:50`) but has exactly one caller,
  `src/app/page.tsx:393` (homepage). A team page *does* carry a 6-link contextual ExploreCard
  (`src/components/redesign/ExploreCard.tsx:32-40`).
- Category chips and league filters contribute **zero** anchors — they are `<button>` in all three
  implementations (`RedesignAggregatorList.tsx:29-53`, `TodayBoardFilter.tsx:24-48`,
  `best-promos-browser.tsx:214,:219`) toggling a `hidden` class over already-rendered rows.
  There is no crawlable `?league=` filtered URL anywhere in the family; `/best-promos` writes
  `?league=`/`?range=` via `history.replaceState` only (`best-promos-browser.tsx:151-163`).
- Pagination contributes zero links and on `/best-promos` **hides 250 team links**: the page
  declares "300 promos ranked" in the served HTML but `PAGE_SIZE=50`
  (`best-promos-browser.tsx:43,:113,:134`) means only 50 cards / 19 distinct team pages are in SSR.
- No venue link, no rivals grid, no opponent anchors. Opponent names in the aggregator family are
  plain text (`RedesignAggregatorList.tsx:172`, `RedesignPromoRow.tsx:179-183`,
  `scored-promo-card.tsx:105`).

**Verdict on the hypothesis** — *"pages/session tracks the count and placement of contextual
outbound links, not content length."*

**The code CONTRADICTS the count half and PARTIALLY SUPPORTS the placement half.** Three
measurements refuse the simple count rule:

- `/cfb/[school]` has **3** body-internal links — the thinnest page measured — and sits inside the
  best-performing section (3.69).
- `/promos/bobbleheads` has **85** body-internal links and its section runs 2.41, below CFB.
- `/venues/[slug]` has **4** internal links above the fold — more than any team page and more than
  `/promos/bobbleheads` — and runs **1.24**, the second-worst number on the site.

Content length is likewise refuted as an inverse: the Dodgers page is the *longest* document
measured (15,543px) and has the second-worst engagement, while `/cfb/[school]` is the second
*shortest* (4,660px) and sits in the best section.

What the code does support:

- **Section pages/session is dominated by which page in the section is the entry point.** CFB's
  3.69 is a hub property, not a school-page property: `/cfb` offers 151 distinct destinations with
  16 of them above the fold, while `/cfb/[school]` offers 3. The CFB figure rests on n=35 sessions
  and is directional only, as stated in the brief.
- **Among leaf pages, what separates them is whether the primary content block is itself
  navigable.** On an aggregator the answer is yes (`RedesignAggregatorList.tsx:147`); on a team
  page it is no (`promo-list.tsx:252`). NFL 1.37 > MLB 1.19 is consistent with this: the Cowboys
  page's zero-promo branch substitutes `ScheduleBlock`, which contributes 8 crawlable opponent
  anchors (`ScheduleRow.tsx:175`), whereas the Dodgers' 46-promo `PromoList` contributes zero.
  **The page with the most content to protect has the fewest cross-links, and that inversion is
  structural, not incidental.**
- **Placement matters at the margin, but distance to the first contextual link is not sufficient**
  — `/venues/[slug]` puts one at y=454 and still underperforms. Its likely limiter is that it
  offers only **3** distinct internal destinations total; a fold placement with nowhere to go does
  not compound.

---

## PART A — NFL internal linking

### A1. Destination checklist for `/nfl/[slug]`

| Destination | Verdict | Evidence |
|---|---|---|
| **The team's venue page** | **PRESENT** (conditional) | One link: `src/components/venue-hub/VenueHubLink.tsx:63` (href `:45`), mounted `src/components/redesign/AffiliateRail.tsx:56-63`. Gated by `showHubLink = hub !== null && hub.indexable` at `AffiliateRail.tsx:30-31`. Live on Cowboys (`/venues/att-stadium`) and Rams (`/venues/sofi-stadium`). Renders on **31 of 32** teams — see A2. Note the comment at `AffiliateRail.tsx:48-55`: this link exists only on the redesign path. |
| **Division rivals** | **PRESENT**, complete | `src/components/redesign/DivisionRivals.tsx:34` → `src/components/team-card.tsx:72-73`, gated on `rivals.length > 0` at `RedesignTeamPage.tsx:120`. Cowboys → all 3 of NFC East; Rams → all 3 of NFC West. Set derived from `gameContexts` with a same-league AND same-division filter at `src/lib/division-rivals.ts:23`. Mount position flips with the promo branch: `order-[12]` on zero-promo pages, `order-[41]` on populated (`RedesignTeamPage.tsx:121`, `:294`, `:338`). |
| **Conference peers** | **ABSENT** as a category | There is no NFC/AFC concept in the link layer. `src/lib/division-rivals.ts:23` reads `if (opp.league !== team.league \|\| opp.division !== team.division) continue;` — division only. A repo-wide grep for a conference-scoped href returns nothing; AFC/NFC labels exist at `src/lib/data.ts:1367-1368` but drive `HUB_GROUPING` on the `/nfl` hub, not any team-page anchor. Nearest substitutes are PARTIAL: `/teams?league=NFL` (`ExploreCard.tsx:39`) and the `/nfl` hub. |
| **Any `/promos/*` aggregator** | **PRESENT**, heavily — but the *contextual* one degrades | Body: 5 from `ExploreCard.tsx:51` (items `:32-36`) + 1 from `team-related-aggregators.tsx:62`. Footer: 6 from `Footer.tsx:71`. Nav: `/promos/today` ×2. **PARTIAL caveat:** `TeamRelatedAggregators` is count-gated on *this team's* promos — bobbleheads ≥5 (`:24`), jerseys ≥3 (`:31`), themes ≥5 (`:38`) — so on both NFL pages only the unconditional `/promos/this-week` item (`:45-49`) survives. The block degrades to one generic link on every low-promo page, which is 19 of 32 NFL teams. |
| **`/best-promos`** | **PARTIAL** | Exactly one link on the page, and it is footer chrome: `src/components/redesign/Footer.tsx:71` rendering the DISCOVER entry at `Footer.tsx:47`. No body-level or contextual link. `/best-promos/bobbleheads` exists (`src/app/best-promos/bobbleheads/page.tsx`) and is unreferenced from this template — a repo-wide grep finds it only in `sitemap.ts:220`, `llms.txt/route.ts:21` and the `/best-promos` pages themselves. |
| **The NFL league hub** | **PRESENT** — the one contextual up-link | `src/components/redesign/RedesignTeamPage.tsx:128`, href via `getLeagueHub(team.league)` gated on `?.live` at `:90` (registry row `src/lib/league-hubs.ts:30`). Renders in the hero eyebrow with `aria-label="NFL promotions and giveaways hub"`. **It is one of only two internal anchors above the fold at 390px.** Two non-contextual copies come from chrome (`BrandBarLeagueHubs.tsx:68`, `BrandBarMobileMenu.tsx:108`). |
| **A current-season hub** | **ABSENT — no such route exists** | `find src/app -name page.tsx` returns 36 routes; none is season-scoped (no `/nfl/2026`, no `/season/*`). A repo-wide grep for a season-scoped href returns zero hits. "2026" lives only in copy: `RedesignTeamPage.tsx:183`, `ScheduleBlock.tsx:154-156`, `zero-promo-fallback.tsx:129-131` — all text, no anchor. |

**Full internal-link list for `/nfl/[slug]`:** section 0.3 table 1 (Cowboys, 22 body internal +
39 chrome) and the Rams delta beneath it. Above the fold at 390×844 there are exactly **two**:
the wordmark (y=19) and the `/nfl` hero eyebrow (y=122).

**Client-lazy surfaces that do not change the answer.** `GameExpand` is lazy-mounted at
`ScheduleRow.tsx:194-205` (deliberate, per the comment at `:20-31`). Opening it adds **no internal
link on the zero-promo path**: the opponent anchor at `GameExpand.tsx:220-228` needs
`showOpponentLink`, and `ScheduleRow.tsx:202` passes `!opponentHref` (false on away rows, which
already carry the href), while home rows fail the `!isHome && opponentTeam` guard at
`GameExpand.tsx:199`. The "View full schedule" anchors (`:279-287`, `:340-350`) need
`showTeamLink`, defaulted false at `:244-245`. **Scoped correction:** on the *populated* path
(`SeasonExplorer` → `CalendarGrid.tsx:437`) `GameExpand` runs with `showOpponentLink` defaulting
true (`:245`) and does emit opponent anchors — 9 of them on the Dodgers page today. The Rams show
0 only because no away game fell inside the 30-day / 35-cap prerender window
(`CalendarGrid.tsx:100-114`) on the fetch date. This link path returns once the NFL season starts.

**Components on the tree that emit nothing** (read, not assumed): `authority-stats.tsx`,
`recurring-deals-section.tsx`, `team-content-sections.tsx`, `team-faq.tsx`, `SeasonExplorer.tsx`,
`CalendarGrid.tsx` (itself), `zero-promo-fallback.tsx`, `promo-list.tsx`. The five `AdSlot` mounts
collapse to empty divs (`AdSlot.tsx:36-41`). **`TeamFAQ` emitting zero anchors is the notable one:
its answers discuss the venue and the promo types in prose and link neither.**

### A2. Link-target availability in Firestore, all 32 NFL teams

#### Venue resolution — mechanism first

There is **no `venueId` field on any NFL team doc** (probe: `with venueId field: 0`; the union of
NFL team-doc keys is `abbreviation, city, contactUrl, division, fanaticsPath, fanaticsUrl, league,
name, primaryColor, scheduleReleaseVideo, secondaryColor, ticketmasterAttractionId,
ticketmasterSlug`). Two independent resolvers exist:

- **Resolver A — `venues` collection** (drives `VenueInfoBlock` prose and coords, *not* the link):
  `getVenueForTeam` at `src/lib/data.ts:396-449`, name match `where('team','==','{city} {name}')`
  at `:402-407`, fallback to `VENUE_RESOLUTION_MAP` at `:417-421`.
  **32/32 NFL teams match by name; `VENUE_RESOLUTION_MAP` contains zero NFL keys** — it is
  entirely NBA/NHL/WNBA/MLS (`src/lib/venue-resolution-map.ts:27-74`), so that fallback is
  unreachable for NFL.
- **Resolver B — `venueHubs` collection** (drives the `/venues/<slug>` link): `getTeamVenueHubMap`
  at `src/lib/venue-hub.ts:275-298` walks each building's `tenants` array (`:280`, `:293-295`);
  the slug is `doc.id`, not the stored `slug` field (`:284-288`). Single lookup
  `getVenueHubForTeam` at `:303-306`. The indexing floor is `venueHubIsIndexable` at
  `src/lib/venue-hub.ts:222-229`: geo AND `verified === true` AND ≥2 of (bag, parking, transit).

**32/32 resolve a building. 32/32 hub docs exist, so 0 links would 404. 31/32 render the link.**

| # | Team slug | `venues` doc | `venueHubs` slug | doc exists | indexable | `/venues` URL | Link renders |
|---|---|---|---|---|---|---|---|
| 1 | arizona-cardinals | state-farm-stadium | state-farm-stadium | yes | yes | /venues/state-farm-stadium | yes |
| 2 | atlanta-falcons | mercedes-benz-stadium | mercedes-benz-stadium | yes | yes | /venues/mercedes-benz-stadium | yes |
| 3 | baltimore-ravens | mt-bank-stadium | mt-bank-stadium | yes | yes | /venues/mt-bank-stadium | yes |
| 4 | **buffalo-bills** | highmark-stadium | highmark-stadium | yes | **NO (`verified:false`)** | /venues/highmark-stadium | **NO — suppressed** |
| 5 | carolina-panthers | bank-of-america-stadium-panthers | bank-of-america-stadium | yes | yes | /venues/bank-of-america-stadium | yes |
| 6 | chicago-bears | soldier-field-bears | soldier-field | yes | yes | /venues/soldier-field | yes |
| 7 | cincinnati-bengals | paycor-stadium | paycor-stadium | yes | yes | /venues/paycor-stadium | yes |
| 8 | cleveland-browns | huntington-bank-field | huntington-bank-field | yes | yes | /venues/huntington-bank-field | yes |
| 9 | dallas-cowboys | att-stadium | att-stadium | yes | yes | /venues/att-stadium | yes |
| 10 | denver-broncos | empower-field | empower-field | yes | yes | /venues/empower-field | yes |
| 11 | detroit-lions | ford-field | ford-field | yes | yes | /venues/ford-field | yes |
| 12 | green-bay-packers | lambeau-field | lambeau-field | yes | yes | /venues/lambeau-field | yes |
| 13 | houston-texans | nrg-stadium | nrg-stadium | yes | yes | /venues/nrg-stadium | yes |
| 14 | indianapolis-colts | lucas-oil-stadium | lucas-oil-stadium | yes | yes | /venues/lucas-oil-stadium | yes |
| 15 | jacksonville-jaguars | everbank-stadium | everbank-stadium | yes | yes | /venues/everbank-stadium | yes |
| 16 | kansas-city-chiefs | arrowhead-stadium | arrowhead-stadium | yes | yes | /venues/arrowhead-stadium | yes |
| 17 | las-vegas-raiders | allegiant-stadium | allegiant-stadium | yes | yes | /venues/allegiant-stadium | yes |
| 18 | los-angeles-chargers | sofi-stadium-chargers | sofi-stadium | yes | yes | /venues/sofi-stadium | yes |
| 19 | los-angeles-rams | sofi-stadium | sofi-stadium | yes | yes | /venues/sofi-stadium | yes |
| 20 | miami-dolphins | hard-rock-stadium | hard-rock-stadium | yes | yes | /venues/hard-rock-stadium | yes |
| 21 | minnesota-vikings | us-bank-stadium | us-bank-stadium | yes | yes | /venues/us-bank-stadium | yes |
| 22 | new-england-patriots | gillette-stadium-patriots | gillette-stadium | yes | yes | /venues/gillette-stadium | yes |
| 23 | new-orleans-saints | caesars-superdome | caesars-superdome | yes | yes | /venues/caesars-superdome | yes |
| 24 | new-york-giants | metlife-stadium | metlife-stadium | yes | yes | /venues/metlife-stadium | yes |
| 25 | new-york-jets | metlife-stadium-jets | metlife-stadium | yes | yes | /venues/metlife-stadium | yes |
| 26 | philadelphia-eagles | lincoln-financial-field | lincoln-financial-field | yes | yes | /venues/lincoln-financial-field | yes |
| 27 | pittsburgh-steelers | acrisure-stadium | acrisure-stadium | yes | yes | /venues/acrisure-stadium | yes |
| 28 | san-francisco-49ers | levis-stadium | levis-stadium | yes | yes | /venues/levis-stadium | yes |
| 29 | seattle-seahawks | lumen-field-seahawks | lumen-field | yes | yes | /venues/lumen-field | yes |
| 30 | tampa-bay-buccaneers | raymond-james-stadium | raymond-james-stadium | yes | yes | /venues/raymond-james-stadium | yes |
| 31 | tennessee-titans | nissan-stadium | nissan-stadium | yes | yes | /venues/nissan-stadium | yes |
| 32 | washington-commanders | northwest-stadium | northwest-stadium | yes | yes | /venues/northwest-stadium | yes |

**GAP LIST (1 team): `buffalo-bills`.** `venueHubs/highmark-stadium` has geo + bag + parking +
transit but `verified: false`, so `venueHubIsIndexable` returns false at
`src/lib/venue-hub.ts:228` and `AffiliateRail.tsx:31` suppresses the link. **This is a suppressed
link, not a 404** — `/venues/[slug]` prerenders all 222 slugs
(`src/app/venues/[slug]/page.tsx:23-26` via `src/lib/venue-hub.ts:250-253`) and `notFound()`s only
on a missing doc (`:58`). Independently cross-checked from the other direction: the `/nfl` hub
carries exactly **29 unique `/venues/` hrefs** = 31 indexable teams minus the 2 shared-building
dupes (MetLife = Giants+Jets, SoFi = Rams+Chargers), and `highmark-stadium` is absent from that list.

Note: `venues` doc id and `venueHubs` doc id diverge for 7 teams (Panthers, Bears, Chargers,
Patriots, Jets, Seahawks, Giants/Jets pairing). **Only the `venueHubs` id ever appears in a URL.**

#### Division and conference

| Field | Verdict | Evidence |
|---|---|---|
| `division` | **PRESENT**, 32/32 populated | Read at `src/lib/data.ts:62`. 8 values × 4 teams: NFC/AFC × East/North/South/West. |
| `conference` | **ABSENT** — 0/32 | Probe: `with conference field: 0`. Exists only as the leading three characters of the division string ("NFC West"). Any conference rail must string-prefix `division`. |
| Queryable for a rails query? | **PRESENT for equality, ABSENT with a sort** | Executed live: `teams.where('league','==','NFL').where('division','==','NFC West').get()` → **succeeds, 4 docs** (arizona-cardinals, los-angeles-rams, san-francisco-49ers, seattle-seahawks); two equality filters are served by index merge, no composite index needed. Adding `.orderBy('city')` → **fails**: `9 FAILED_PRECONDITION: The query requires an index … create_composite=Ckhwcm9qZWN0cy9wcm9tb25pZ2h0L2RhdGFiYXNlcy8oZGVmYXVsdCkvY29sbGVjdGlvbkdyb3Vwcy90ZWFtcy9pbmRleGVzL18QARoMCghkaXZpc2lvbhABGgoKBmxlYWd1ZRABGggKBGNpdHkQARoMCghfX25hbWVfXxAB`. Both queries were re-run independently by a second agent with byte-identical results. |

**A division-rivals rail already exists and is live** — `src/lib/division-rivals.ts:17-27`,
`src/components/redesign/DivisionRivals.tsx:15-48`, rendered by exactly one template at
`RedesignTeamPage.tsx:118-124`. It derives rivals from `gameContexts`, **not** from a teams query
(deliberately — see the header at `division-rivals.ts:4-11`: `enrichGamesForTeam` already paid for
every opponent's full Team doc). Because `getGamesForTeam` early-returns `[]` for anything but
mlb/nfl (`src/lib/data.ts:781`), the rail exists only on MLB and NFL pages.
**All 32 NFL teams yield exactly 3 rivals from live game docs, with 0 missing opponent docs.**

| # | Team | division | conference field | rivals resolvable | rival slugs |
|---|---|---|---|---|---|
| 1 | arizona-cardinals | NFC West | ABSENT | 3 | los-angeles-rams, san-francisco-49ers, seattle-seahawks |
| 2 | atlanta-falcons | NFC South | ABSENT | 3 | carolina-panthers, new-orleans-saints, tampa-bay-buccaneers |
| 3 | baltimore-ravens | AFC North | ABSENT | 3 | cincinnati-bengals, cleveland-browns, pittsburgh-steelers |
| 4 | buffalo-bills | AFC East | ABSENT | 3 | miami-dolphins, new-england-patriots, new-york-jets |
| 5 | carolina-panthers | NFC South | ABSENT | 3 | atlanta-falcons, new-orleans-saints, tampa-bay-buccaneers |
| 6 | chicago-bears | NFC North | ABSENT | 3 | detroit-lions, green-bay-packers, minnesota-vikings |
| 7 | cincinnati-bengals | AFC North | ABSENT | 3 | baltimore-ravens, cleveland-browns, pittsburgh-steelers |
| 8 | cleveland-browns | AFC North | ABSENT | 3 | baltimore-ravens, cincinnati-bengals, pittsburgh-steelers |
| 9 | dallas-cowboys | NFC East | ABSENT | 3 | new-york-giants, philadelphia-eagles, washington-commanders |
| 10 | denver-broncos | AFC West | ABSENT | 3 | kansas-city-chiefs, las-vegas-raiders, los-angeles-chargers |
| 11 | detroit-lions | NFC North | ABSENT | 3 | chicago-bears, green-bay-packers, minnesota-vikings |
| 12 | green-bay-packers | NFC North | ABSENT | 3 | chicago-bears, detroit-lions, minnesota-vikings |
| 13 | houston-texans | AFC South | ABSENT | 3 | indianapolis-colts, jacksonville-jaguars, tennessee-titans |
| 14 | indianapolis-colts | AFC South | ABSENT | 3 | houston-texans, jacksonville-jaguars, tennessee-titans |
| 15 | jacksonville-jaguars | AFC South | ABSENT | 3 | houston-texans, indianapolis-colts, tennessee-titans |
| 16 | kansas-city-chiefs | AFC West | ABSENT | 3 | denver-broncos, las-vegas-raiders, los-angeles-chargers |
| 17 | las-vegas-raiders | AFC West | ABSENT | 3 | denver-broncos, kansas-city-chiefs, los-angeles-chargers |
| 18 | los-angeles-chargers | AFC West | ABSENT | 3 | denver-broncos, kansas-city-chiefs, las-vegas-raiders |
| 19 | los-angeles-rams | NFC West | ABSENT | 3 | arizona-cardinals, san-francisco-49ers, seattle-seahawks |
| 20 | miami-dolphins | AFC East | ABSENT | 3 | buffalo-bills, new-england-patriots, new-york-jets |
| 21 | minnesota-vikings | NFC North | ABSENT | 3 | chicago-bears, detroit-lions, green-bay-packers |
| 22 | new-england-patriots | AFC East | ABSENT | 3 | buffalo-bills, miami-dolphins, new-york-jets |
| 23 | new-orleans-saints | NFC South | ABSENT | 3 | atlanta-falcons, carolina-panthers, tampa-bay-buccaneers |
| 24 | new-york-giants | NFC East | ABSENT | 3 | dallas-cowboys, philadelphia-eagles, washington-commanders |
| 25 | new-york-jets | AFC East | ABSENT | 3 | buffalo-bills, miami-dolphins, new-england-patriots |
| 26 | philadelphia-eagles | NFC East | ABSENT | 3 | dallas-cowboys, new-york-giants, washington-commanders |
| 27 | pittsburgh-steelers | AFC North | ABSENT | 3 | baltimore-ravens, cincinnati-bengals, cleveland-browns |
| 28 | san-francisco-49ers | NFC West | ABSENT | 3 | arizona-cardinals, los-angeles-rams, seattle-seahawks |
| 29 | seattle-seahawks | NFC West | ABSENT | 3 | arizona-cardinals, los-angeles-rams, san-francisco-49ers |
| 30 | tampa-bay-buccaneers | NFC South | ABSENT | 3 | atlanta-falcons, carolina-panthers, new-orleans-saints |
| 31 | tennessee-titans | AFC South | ABSENT | 3 | houston-texans, indianapolis-colts, jacksonville-jaguars |
| 32 | washington-commanders | NFC East | ABSENT | 3 | dallas-cowboys, new-york-giants, philadelphia-eagles |

#### Promo count per team — so we do not build a rail that links to empty pages

Promos live in `teams/{id}/promos`, read by `getTeamPromos` at `src/lib/data.ts:156-164`:
`orderBy('date','asc')`, then `isVisiblePromo` (`src/lib/promo-helpers.ts:165`, tombstoned !== true)
then `dedupePromos` (`:146-159`).

**Methodology note, corrected during verification:** the app applies **no date filter at all** —
neither `getTeamPromos` (`src/lib/data.ts:156-164`) nor the `promoCounts` consumer
(`src/app/[sport]/[team]/page.tsx:222-234`) tests a date. The counts below happen to be identical
under both "all visible" and ">= 2026-08-10" because the earliest NFL promo in the corpus is
2026-08-13. Read the column as **all visible promos**; the moment one past-dated NFL promo lands,
an "upcoming" framing would under-report what the page renders.

| # | Team slug | promo docs | visible | after dedupe | type mix |
|---|---|---|---|---|---|
| 1 | chicago-bears | 19 | 19 | 19 | giveaway:10 theme:8 kids:1 |
| 2 | seattle-seahawks | 15 | 15 | 15 | theme:12 giveaway:1 kids:2 |
| 3 | new-york-jets | 13 | 13 | 13 | theme:10 giveaway:2 kids:1 |
| 4 | minnesota-vikings | 12 | 12 | 12 | theme:11 kids:1 |
| 5 | arizona-cardinals | 9 | 9 | 9 | theme:8 kids:1 |
| 6 | houston-texans | 9 | 9 | 9 | theme:6 kids:3 |
| 7 | san-francisco-49ers | 9 | 9 | 9 | theme:7 giveaway:2 |
| 8 | indianapolis-colts | 8 | 8 | 8 | theme:6 kids:2 |
| 9 | las-vegas-raiders | 8 | 8 | 8 | theme:6 kids:2 |
| 10 | pittsburgh-steelers | 8 | 8 | 8 | theme:6 kids:2 |
| 11 | kansas-city-chiefs | 7 | 7 | 7 | theme:7 |
| 12 | jacksonville-jaguars | 5 | 5 | 5 | theme:3 kids:2 |
| 13 | los-angeles-rams | 1 | 1 | 1 | giveaway:1 |
| 14–32 | atlanta-falcons, baltimore-ravens, buffalo-bills, carolina-panthers, cincinnati-bengals, cleveland-browns, dallas-cowboys, denver-broncos, detroit-lions, green-bay-packers, los-angeles-chargers, miami-dolphins, new-england-patriots, new-orleans-saints, new-york-giants, philadelphia-eagles, tampa-bay-buccaneers, tennessee-titans, washington-commanders | 0 | 0 | 0 | — |

**Total 123 promo docs. 19 of 32 teams have ZERO. 0 tombstoned.**

**Rail consequence, stated plainly: NFC East, AFC North and NFC South are 4-for-4 zero-promo.**
Every division-rival card in those three divisions points at an empty-promo page today — including
every card on the Cowboys page, which is the highest-traffic NFL page in the set.

#### Schedule data

321 game docs carry `league=='nfl'`, **all** `season == 2026` (272 regular + 49 preseason).
`getGamesForTeam` (`src/lib/data.ts:780-807`) queries `homeTeamSlug` and `awayTeamSlug` separately
(`:782-791`) then filters through `isRegularSeasonGame` (`:797`, defined `src/lib/types.ts:272-273`),
so preseason never reaches the page. **Every one of the 32 teams has exactly 17 regular-season
docs, all dated ≥ 2026-08-10, 8 or 9 home games each.** A schedule-based rail has complete data
for 32/32.

### A3. Every `/nfl/` route in the repo

| Route | Backing file | Instances | Body internal links | < 3 internal? |
|---|---|---|---|---|
| `/nfl` | `src/app/nfl/page.tsx` | 1 | **127** (64 distinct) | no |
| `/nfl/[team]` | `src/app/[sport]/[team]/page.tsx` (shared with mlb/nba/nhl/mls/wnba) | 32 | 22 (Cowboys) / 14 (Rams) | no |

There are no other `/nfl/*` routes. `find src/app -name page.tsx` returns 36 files and only
`src/app/nfl/page.tsx` is nfl-scoped; team pages are served by the dynamic `[sport]/[team]` route
with the sport derived from `data.league.toLowerCase()` at `src/lib/data.ts:61`.

**No `/nfl/` route renders fewer than 3 internal links in SSR HTML.** The failure is not link
*count*, it is link *reachability*: **both `/nfl/[team]` variants render exactly 2 internal
anchors above the fold at 390×844** (wordmark + `/nfl` eyebrow), and the first contextual link
sits at y=973 on a 10,682px page (Cowboys) or y=1,734 on an 8,534px page (Rams).

One adjacent path worth recording: `src/middleware.ts:60` traps
`/^\/(?:mlb|nba|nhl|nfl|mls|wnba)\/[a-z0-9-]+\/o-/i` with a 410 Gone (applied `:178-186`). It is a
leak trap, not a page, and it does not intercept any real `/nfl` route.

### A4. Candidate link rails, ranked by expected pages/session lift

Ranking logic is tied to Part 0's finding: **what separates 2.41/3.69 surfaces from 1.19/1.37
surfaces is (a) whether the primary content block is itself navigable and (b) how many distinct
contextual destinations sit above the fold.** Both `/nfl/[team]` variants score 2 above-fold
internal links and have a non-navigable primary block. Rails are ranked on how directly they move
those two numbers, discounted by whether the destination has content.

| Rank | Rail | Why it should move the number | Buildable today? | Blocking field |
|---|---|---|---|---|
| **1** | **Make promo rows navigable on the team page** (mirror what `/promos/*` already does) | This is the single largest structural gap in the survey and it is a one-prop difference: `RedesignPromoRow` renders a stretched `<Link>` when `href` is set (`RedesignPromoRow.tsx:131-137`); aggregators set it (`TodayPromoCard.tsx:42`), team pages do not (`promo-list.tsx:252`, `:311`). Every 2.41+ surface has a navigable content block; no 1.x surface does. | **BUILDABLE** — the component, the href shape and the anchor-id formula (`src/lib/promo-helpers.ts:27`) all exist and are already used in both directions. | none. *But* the honest caveat: on an NFL team page the natural href target would be a cross-team destination that does not yet exist, and 19/32 NFL teams have zero promos, so this rail is worth far more on MLB (1.19) than on NFL today. |
| **2** | **Lift the existing division-rivals grid above the fold** | The rail already exists, is fully fed for 32/32 teams (3 rivals each, 0 missing docs), and currently paints at y=3,512 (Cowboys) / y=3,022 (Rams). `/cfb` and `/nfl` both put their contextual grid at y≈725–740 and both outperform. Mount position is already branch-aware at `RedesignTeamPage.tsx:121` (`order-[12]` vs `order-[41]`), so the placement lever is already parameterised. | **BUILDABLE** — zero new data. | none. Caveat: in NFC East / AFC North / NFC South all four rival targets are zero-promo pages today. |
| **3** | **A conference-peer rail** (AFC/NFC, 15 destinations vs the division's 3) | Directly raises distinct contextual destinations, which is the number that separates `/venues/[slug]` (3 destinations, 1.24) from `/nfl` hub (64 destinations). | **PARTIALLY BLOCKED** | **`conference` does not exist as a field** (0/32 docs). It is derivable as `division.slice(0,3)`, and the two-equality Firestore query works without a composite index — but any sorted variant needs the composite index whose creation token is quoted in A2. Also: `division-rivals.ts` derives from `gameContexts`, which only contains 14 distinct opponents per team, so a full 15-team conference rail cannot reuse that source and would need a `teams` query. |
| **4** | **Restore contextual aggregator links on low-promo pages** | `TeamRelatedAggregators` degrades to one generic `/promos/this-week` link on every page below its thresholds (bobbleheads ≥5 `:24`, jerseys ≥3 `:31`, themes ≥5 `:38`) — that is 19/32 NFL teams at zero and Rams at one. The block is doing the least work exactly where the page needs it most. | **BUILDABLE** — the thresholds are constants in `team-related-aggregators.tsx:23-49`; the ExploreCard already ships 6 unconditional links, so the destinations exist. | none. |
| **5** | **Restore schedule-opponent anchors on populated pages** | The Cowboys' 8 opponent anchors (`ScheduleRow.tsx:175`) exist *only* on the zero-promo branch (`showSchedule = hasNoPromos && gameContexts.length > 0`, `RedesignTeamPage.tsx:103`). The inversion is backwards: pages with promos — the ones worth ranking — lose 8 crawlable cross-team links. All 32 teams have the full 17-game slate. | **BUILDABLE** — 32/32 have complete schedule data; the href computation already exists at `ScheduleBlock.tsx:188-191`. | none. Note the populated branch does emit opponent anchors via `CalendarGrid` → `GameExpand` (9 on the Dodgers today), but only inside a 30-day / 35-cap window (`CalendarGrid.tsx:100-114`), which is empty for NFL in August. |
| **6** | **A body-level `/best-promos` link** | Currently exactly one link, footer chrome only. `/best-promos` is a 2.41-section page with 21 distinct body destinations; `/best-promos/bobbleheads` is entirely unreferenced from the team template. | **BUILDABLE** — both routes exist and are in the sitemap (`sitemap.ts:213-224`). | none. |
| **7** | **A team → venue-hub link on Buffalo** | One team currently loses its only `/venues` link. | **BLOCKED** | **`venueHubs/highmark-stadium.verified`** is `false`. The doc has geo + bag + parking + transit; only the `verified` flag holds it below the floor at `src/lib/venue-hub.ts:222-229`. |
| **8** | **A current-season hub** (`/nfl/2026` or similar) | Would give the hero eyebrow a second above-fold destination. | **BLOCKED** | **No route exists.** 36 `page.tsx` files, none season-scoped; zero season-scoped hrefs in the repo. This is a route to create, not a field to fill — the lowest-confidence item on the list. |

**Two things that are not rails but bound every rail above:**

- At 390px the *entire* nav is `display:none`. A crawler sees 39 chrome anchors; a phone user sees
  the wordmark and a hamburger button. Every "we already link to it from the nav/footer"
  consolation in this audit is a crawler-only statement.
- `TeamFAQ` (`src/components/team-faq.tsx`) discusses the venue and the promo types in prose and
  emits **zero** anchors. It is the largest block of on-topic text on the page with no link in it.

---

## Appendix — method and reproducibility

- Prod HTML: `https://getpromonight.com/{nfl/dallas-cowboys, nfl/los-angeles-rams,
  mlb/los-angeles-dodgers, cfb, cfb/alabama, cfb/auburn, promos/bobbleheads, promos/today,
  venues/acrisure-stadium, nfl, best-promos}`, iPhone UA, 2026-08-10, all HTTP 200.
- Anchor extraction strips `<script>` first, so Next.js flight-payload hrefs are excluded.
- Fold measurement: real Chrome, same-origin iframe pinned to 390×844,
  `getBoundingClientRect().top + window.scrollY` per `a[href]`; "above fold" = top < 844 **and**
  rect height > 0. Two independent measurements (this session's iframe method and a subagent's
  headless-Chrome run at 390×844 DPR 3) agreed to the pixel on the pages both covered
  (`/promos/today` first card y=614; `/promos/bobbleheads` first row y=848).
- Firestore: live reads only (`.get()`, `.count().get()`, `listCollections()`); no writes.
  Root collections at capture: `teams` 169, `venues` 148, `venueHubs` 222, `games` 2776,
  `cfbGames` 670, `cfbRivalries` 212, `cfbSchools` 86, `cfbVenues` 86, `cfbTraditions` 2.
- Every numeric claim in Parts 0 and A was re-derived by a second agent from the raw artifacts.
  Corrections applied: the promo-count methodology label (see A2), the `GameExpand` scope (see A1),
  the route count (36, not 35), and the `TicketmasterCTA` render-order line
  (`:198-199`, not `:200-201`).

**No code is proposed. No commits were made. Two files were created: this one and
`audit/cfb-matchup-architecture.md`.**
