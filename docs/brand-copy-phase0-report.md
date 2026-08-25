# Brand copy Phase 0: read-only inventory

Branch: feature/brand-copy (cut from main at 5ad534b, identical). Nothing edited. No git writes. Firestore read-only. Production curled read-only on 2026-08-25.

Method: six finder agents (tagline, route metadata, JSON-LD, DOM/FAQ/footer/manifest/llms/email/capture, true CFB coverage, discoverability), each followed by an adversarial critic or fact verifier, then a cross-cutting missed-surface sweep. 222 inventory rows after dedupe. Every file:line in the appendix was re-read by a second agent; the corrections the critics made are folded in below. Every CFB number was reproduced from live Firestore by a second, independent probe.

Headline: no surface anywhere says "seven leagues" or folds the 87 schools into 169. The framing error you are worried about does not exist in the repo today. What does exist is the same error run backwards: promo vocabulary applied to the promo-less college corpus, in four places, two of them on every production page.

---

## PART 1: TAGLINE

### Q1. Where "Every promo at every game" appears

| Where | Gate | Element | Note |
|---|---|---|---|
| src/components/redesign/HomeHero.tsx:54 | redesign (what prod serves) | hero eyebrow `<p>` above the h1 | THE tagline slot |
| src/app/page.tsx:350 | legacy (gate-off) | the page `<h1>`: `EVERY PROMO AT EVERY GAME.` | on legacy the tagline IS the h1; there is no eyebrow |
| docs/homepage-redesign-target.html:59, :539 | n/a | design mock title + eyebrow | docs only; :784 has "Every promo at tonight's games" |

No test pins the string. Changing HomeHero.tsx:54 breaks nothing in the suite.

The h1s: redesign HomeHero.tsx:57 is `Find the games worth going to.` and is a separate element from the eyebrow, so "h1 stays, tagline replaced" is clean on the served variant. On legacy the two constraints collide (see decision 1).

Observation, not a defect: the new tagline and the redesign h1 will sit one line apart and both open with "Find the game(s)". The eyebrow renders at 11px mono uppercase and the h1 at display size, so it reads as a kicker, but you will see the repetition on the page.

### The old tagline is a family, not one string

Four old variants coexist, and only one of them is in the place you named:

1. "Every promo at every game" (HomeHero eyebrow, legacy h1).
2. "PromoNight: Every giveaway, every team" as og:image alt text, five literals in two spellings: src/app/layout.tsx:71, src/lib/og.ts:18 (`PromoNight - every giveaway, every team`, hyphen lowercase), src/app/[sport]/[team]/page.tsx:167, src/app/playoffs/page.tsx:94, src/lib/cfb/metadata.ts:25 (applies to /cfb, all 87 school pages, all 32 rivalry pages).
3. "PROMONIGHT / Every promo. Every team. / Free on iOS and Android" baked into public/og-image.png, the one static social card every route references. None of the five alt strings matches what the image says.
4. "Every giveaway, theme night & food deal" in src/app/api/og/route.tsx:32, a live next/og generator (default card; per-team card at :108 says "2026 PROMO SCHEDULE"). Nothing in src references /api/og, but prod serves it with a one-year immutable cache.

And a fifth, title-case, in src/app/manifest.json:4: "Every Giveaway, Theme Night & Food Deal at Your Team's Games".

### Q2. Every other tagline or brand-line surface

| Surface | file:line | Gate | Current text (verbatim or summarized) |
|---|---|---|---|
| Footer brand paragraph | src/components/footer.tsx:22 | legacy | Track every giveaway, theme night, food deal, and promotion across 169 teams in MLB, NBA, NHL, NFL, MLS, and WNBA. |
| Footer brand paragraph | src/components/redesign/Footer.tsx:98-99 | redesign, every prod page | Every giveaway, theme night, food deal, and promotion across 169 teams in MLB, NBA, NHL, NFL, MLS, and WNBA. |
| Footer wordmark | Footer.tsx:93-96, footer.tsx | both | wordmark only; no short line under it in either variant |
| Hero eyebrow | HomeHero.tsx:54 | redesign | Every promo at every game |
| Hero lede | HomeHero.tsx:60-61 | redesign | Every giveaway, theme night, food deal and family event across {teamCount} teams in {leagueCount} leagues, pulled from official team sources. (derived) |
| Hero lede | src/app/page.tsx:352-353 | legacy | {allTeams.length} teams, {homepageCounts.leagueCount} leagues, from official team announcements. Find tonight's giveaways, theme nights, and food deals. (derived) |
| Hero stat row | src/app/page.tsx:325-330 via HomeHero.tsx:80-93 | redesign | 5,841 Promos tracked / 169 Teams / 6 Leagues / 166 Venue guides (all derived; note Venue guides counts CFB stadiums, its neighbours are pro-only) |
| Root title | src/app/layout.tsx:57 | both | PromoNight: Pro Sports Giveaway & Promo Night Tracker |
| Root description (also og + twitter by inheritance) | src/app/layout.tsx:61 | both | PromoNight tracks every giveaway, theme night, and food deal across 169 teams in MLB, NBA, NFL, NHL, MLS, and WNBA. Never miss bobblehead night. (hardcoded 169) |
| Root og:image alt | src/app/layout.tsx:71 | both | PromoNight: Every giveaway, every team |
| manifest.json | src/app/manifest.json:2-4 | both | name/short_name PromoNight; description "Every Giveaway, Theme Night & Food Deal at Your Team's Games" |
| llms.txt opener | src/app/llms.txt/route.ts:20 | n/a | PromoNight is a mobile app and website that tracks every promotional event ... across 169 professional sports teams in MLB, NBA, NFL, NHL, MLS, and WNBA, plus 2026 schedules, rivalry games, and gameday travel guides for ${cfbSchoolCount} college football programs. |
| Organization.description | src/components/homepage-json-ld.tsx:110 | both | PromoNight tracks every giveaway, theme night, food deal, and promotion across ${teamCount} professional sports teams in ${leagueList}. (derived) |
| Organization.slogan | homepage-json-ld.tsx:101 (absent) and about/page.tsx:157 (absent) | both | no slogan property exists on either Organization node |
| WebSite.description | homepage-json-ld.tsx:123 | both | Track every giveaway, theme night, food deal, and promotion across ${teamCount} professional sports teams. (derived) |
| /about Organization node | src/app/about/page.tsx:157 | both | same @id; legalName + founder; no description, no slogan |
| /about Person.description | about/page.tsx:152 | both | Solo developer and Minnesota sports fan. Builder of PromoNight. |
| /download meta | src/app/download/page.tsx:17 | both | Install PromoNight free on iOS or Android. Browse every giveaway ... |
| /download hero lede | download/page.tsx:34 (redesign) and :127 (legacy, byte-identical) | both | Every giveaway, theme night, and food deal across MLB, NBA, NHL, NFL, MLS, and WNBA. Free to download. Pro tier adds promo-day reminders. |
| App block eyebrow / body | src/components/redesign/AppDownloadBlock.tsx:47 / :53 | redesign | Never miss a promo night / PromoNight Pro sends a reminder the morning of every promo ... |
| App pitch, legacy | src/app/page.tsx:448 / :451 | legacy | WANT NOTIFICATIONS THE MORNING OF EVERY PROMO? / PromoNight Pro sends a reminder ... |
| Team-page app plug | src/components/team-content-sections.tsx:115 and :195; app-push-pitch.tsx:30 | both | PromoNight is a free app that tracks every {fullName} giveaway ... |
| Capture sheet | src/lib/capture/sheet-copy.ts:58-59, :64 | redesign | Never miss a giveaway / Every bobblehead, jersey night and theme night across the leagues you follow. One email a week. (pinned by sheet-copy.test.ts:27-29, 34-35; CaptureCard/CaptureSheet/CaptureTrigger carry no brand line of their own) |
| Email wordmark | src/lib/email.ts:161 (digest twin :360) | n/a | PROMO NIGHT wordmark only; no line under it; no preheader field exists |
| Email subjects | email.ts:231, :427, :491, :577 | n/a | Confirm your PromoNight email / Your teams' promos this week on PromoNight / This week's hottest pro sports promos / Your teams are quiet this week on PromoNight |
| Email sub-headings | email.ts:473, :543, :563 | n/a | ... across the leagues this week / ... across the leagues instead |
| Follow CTAs | src/components/follow/FollowFooterCTA.tsx:31, FollowCTA.tsx:52, src/app/follow/page.tsx:78 | both | Get every giveaway in your inbox / Get every giveaway, theme night, and food deal for the teams you follow ... / Never miss a giveaway (h1) |
| Founder prose | src/components/redesign/FounderBlock.tsx:82-84 (derived list, ordered by size) and src/components/indie-developer-block.tsx:40 (legacy, hardcoded list) | both | ... now tracks every giveaway, theme night, food deal, and kids event across all {teamCount} teams in {leagues} ... |
| Nav | src/components/nav.tsx:37, src/components/redesign/BrandBar.tsx:45 | both | wordmark only, aria "PromoNight home"; no tagline slot in either chrome |
| Hub hero eyebrows/subtitles | src/components/hub/HubHero.tsx:50, mlb/mls/wnba page.tsx:105, nfl/page.tsx:169, cfb/page.tsx:68 | redesign | page-scoped ("MLB League Hub", "Every giveaway ... across all 30 MLB clubs", "COLLEGE FOOTBALL · 2026") |
| Family echoes | src/components/redesign/home-category-tiles.ts:64 "Every promo at today's games"; src/components/browse-collections.tsx:43 "Every promo across pro sports" (legacy); src/lib/about-copy.ts:153 "Every promo, every team, every league" and :317 "every team, every promo, every venue guide" | mixed | same construction as the retiring line; :64 renders on the same page as the new tagline |
| Clean (no brand line) | not-found.tsx (both), error.tsx, robots.ts, package.json (no description), README (none), public/ (ads.txt only), api/* routes, digest.ts, TonightRibbon, StubRail, TicketStubCard, UpcomingPromoModal, GamedayUtilityGrid | | |

No opengraph-image.tsx or twitter-image.tsx file-convention generators exist. No route sets a separate twitter description anywhere; twitter inherits og everywhere.

### Q3. Tagline slot or description slot: what I would change and what I would leave

CHANGE, tagline slot:
- HomeHero.tsx:54 eyebrow. This is the slot. Text becomes `Find the game, plan the night.` with the period.
- src/app/page.tsx:350 legacy h1. See decision 1. My recommendation is to swap it (uppercase, house style: `FIND THE GAME, PLAN THE NIGHT.`), because the legacy variant exists only as the rollback path and a rollback should not resurrect a retired tagline. That is a change to a legacy h1, which is why it is your ruling, not mine.

CHANGE, coupled to a card decision (decision 2):
- The five og:image alt literals (layout.tsx:71, og.ts:18, [sport]/[team]/page.tsx:167, playoffs/page.tsx:94, cfb/metadata.ts:25). Alt text must describe the image; today none of them does. They should collapse into one exported constant that describes whatever public/og-image.png says after regeneration. On CFB routes the current alt also asserts "every giveaway" on a corpus with none.
- public/og-image.png itself. It is the tagline surface with the widest reach (every shared link) and it is a 1200x630 asset, not a code change.
- src/app/api/og/route.tsx: retire or align. It is an orphan but public and cached for a year.

CONSIDER, additions (not replacements):
- Organization.slogan on the homepage node (homepage-json-ld.tsx, next to :100 name). The one schema field where a tagline belongs. Add once; the /about node shares the @id and merges, so either mirror it identically or leave the /about node slogan-free. Do not touch description.
- A short line under the footer wordmark in BOTH footers (Footer.tsx:93-96, footer.tsx). Today no such line exists; the paragraph beneath is a coverage descriptor and should stay a descriptor.
- Email: the only possible slot is under the wordmark at email.ts:161 / :360. Optional. There is no preheader to fill.
- home-category-tiles.ts:64 "Every promo at today's games": decide whether the "every promo" construction survives a few hundred pixels below the new line. Same question for about-copy.ts:153 and :317 (fingerprint-guarded, see tests) and the legacy browse-collections.tsx:43.
- manifest.json:4: an app blurb, not a tagline slot. Leave, unless you want one voice; if so it gets a rewritten blurb, not the tagline.

LEAVE, description slots doing their own job (do not paste the tagline here):
- layout.tsx:57 title, :58 template, :61 description; every per-route meta/og description; Organization.description :110; WebSite.description :123; llms.txt:20; both footer paragraphs (as descriptors); both hero ledes; /download meta; hub subtitles; capture sheet copy; email subjects and bodies; founder prose; app pitches; the redesign h1 (:57); /about Person.description.

Several of the "leave" rows carry a hardcoded 169 or a six-league literal. Those are Part 2 items, not tagline items; they are listed in Q6.

---

## PART 2: CFB IN SITEWIDE COPY

### Q4/Q5. Inventory and classification

Under your rule the classification is:

- pro-only-correct, must NOT gain CFB: 120 rows. Everything describing promo coverage, promo counts, cadence, starring/follow/email, the app, rankings, scored surfaces, /promos/* collections, hub pages, team pages, the root description, both footer paragraphs, llms.txt:20 first clause and :24, /my-teams, /world-cup, /playoffs, LEAGUE_ORDER itself.
- already-correct-with-CFB: 26 rows. about-copy.ts (:99-100 meta, :107-109 lede, :192, :223/:238/:243 bullets, :332 FAQ), llms.txt (:20 second clause, :30, :40-43), venues/page.tsx:25 (names college football as its own item; venues are not promo data, nothing sums to 169), venue-index.ts:35 "College football stadium guides", redesign Footer.tsx:51 "College football rivalries", CfbConferenceSubRow.tsx:31, CfbTodaySlot.tsx:19/:28, every /cfb/* count (derived), rivalry-index FAQs.
- should-add-CFB-clause: NONE in page metadata as currently phrased, because every candidate sentence is a promo claim. The candidates below are surfaces whose JOB is overall coverage, where a separate clause in the aboutLede shape would be true. Your call (decision 3):
  - homepage WebSite.description (homepage-json-ld.tsx:123) and Organization.description (:110), as an appended sentence with a derived count. Today the only schema-level statements of the college corpus are /about, /cfb/rivalries, and llms.txt; the homepage entity nodes describe a six-league site. /cfb and /venues emit zero JSON-LD.
  - homepage FAQ "How many teams does PromoNight cover?" (homepage-json-ld.tsx:70): the question is overall coverage, the answer is 169 across six with no college mention; the /about twin (:332) adds the clause.
  - redesign hero lede HomeHero.tsx:60-61: the hero is where the new tagline names the venue/logistics half; the lede beneath it still describes six-league promo coverage only.
  - /teams meta :25 and ledes :66/:89 say "pro sports teams" explicitly, and the page carries a CFB chip that routes out. Honest as written; disputed by one critic. I would leave it.
  - terms/page.tsx:19 "for professional sports teams": legal scope sentence that predates CFB. Consider.
  - about-copy.ts:99-100 meta description: "publishes promotional schedules for 169 teams across six leagues, plus 87 college football programs" attaches the CFB clause to "promotional schedules". The lede at :107-109 has the precise shape ("covers schedules, venues and rivalries for N college football programs"). It is the reference page, so the imprecision propagates. Consider, with a fingerprint bump.
- wrong-framing under the CFB rule, reverse direction (promo words on the promo-less corpus). These are the real Part 2 defects:
  1. src/lib/league-hubs.ts:56 `hubAriaLabel` returns `${hub.label} promotional schedule`, and CFB is live (:31, label 'CFB'). Every production page ships aria-label="CFB promotional schedule" twice: desktop dropdown BrandBarLeagueHubs.tsx:71 and mobile sheet BrandBarMobileMenu.tsx:108. Prod-verified. Derived, one-line fix (branch on league, or an ariaLabel field on the registry row). CHANGE.
  2. src/app/venues/page.tsx:73 renders `All {hub.label} promos ›` under the "College football stadium guides" section, i.e. "All CFB promos ›" linking /cfb. Prod-verified. Derived from the same label. CHANGE.
  3. src/lib/cfb/metadata.ts:192 (/cfb meta, and og/twitter at :199-200): "College football rivalries, trophy games and theme nights for 2026 ..." and src/app/cfb/page.tsx:74 hero: "Trophy games, theme nights, and gameday plans for {N} teams." Both promise theme nights. The only theme-night rendering in the CFB tree is a decorative card label (src/components/cfb/hub/blocks.tsx:116) fed by the hardcoded THEME_CURATED list (hub-data.ts:74-79), plus a contributor-form field. cfbTraditions is unread. Substantiate or remove (decision 5).
  4. src/lib/cfb/metadata.ts:25 og alt "Every giveaway, every team" on /cfb, 87 school pages, 32 rivalry pages (folds into decision 2).
  5. /cfb/contribute (src/app/cfb/contribute/page.tsx:16, title-only metadata) serves the root pro-only 169-team description as meta and og:description in prod, and the served title is the root default rather than the page's own (separate anomaly). noindex, so low stakes. An unknown /cfb/{slug} returns {} (cfb/[school]/page.tsx:20) and inherits the same root description; the rivalries route handles its miss path explicitly.
  6. Minor: BrandBarMobileMenu.tsx:104 heading "League hubs" sits over a list that includes CFB. The hub says "teams" (cfb/page.tsx:74/:78/:129) where /about and llms.txt say "programs".
- wrong league, not CFB: src/app/playoffs/page.tsx:76 "Every MLB and NHL playoff promo schedule for 2026" is live in prod as meta, og and twitter description on a page whose h1 (:356), Article JSON-LD (:298), FAQs (:133-140) and champions branch (:43-46) all say NBA and NHL. CHANGE, ride-along.

### The app-scope drift family (not CFB, but the same edit pass will trip on it)

src/lib/about-copy.ts:256 and :332 say the app covers MLB, NBA, NHL and MLS. Surfaces attributing six-league or all-169 coverage to the APP:
- src/app/download/page.tsx:34 and :127 (both variants, DOM)
- src/components/homepage-json-ld.tsx:65 ("PromoNight is a free mobile app that tracks ... across [six]") and :75 ("track all teams"), both in the homepage FAQPage schema
- src/lib/promo-helpers.ts:402 ("PromoNight is a free app that tracks ... 168 other teams across MLB, NBA, NFL, NHL, MLS, and WNBA") and :436, both in FAQPage on all 169 team pages, including the 47 NFL and WNBA pages the app does not cover
- src/app/promos/this-week/page.tsx:73 ("browse all 169 teams from the PromoNight app", FAQPage)
- src/components/zero-promo-fallback.tsx:43 (WNBA zero-state: "download the free PromoNight app to browse every confirmed promo across all six leagues", shown to WNBA fans whose league is not in the app)
- src/app/llms.txt/route.ts:20 ("a mobile app and website")
The critics were unanimous: keep these classified pro-only-correct so nobody "fixes" the league list; the defect is the app claim. Decision 4.

### Q6. Derived vs hardcoded

Derived today:
- /about: getAboutCounts() at src/app/about/page.tsx:37-54 (module-private): teamCount, leagueCount, leagueList (LEAGUE_ORDER filtered plus extras, joinList), cfbSchoolCount (getAllCfbSchoolIds), rankedTeamCount, rankedLeagueList (SCORED_LEAGUES). numberWord() exported from about-copy.ts:91.
- Homepage: homepageCountsFromTeams() at src/components/homepage-json-ld.tsx:21-39: teamCount, leagueCount, leagueBreakdown, leagueNamesBySize. NO cfbSchoolCount; src/app/page.tsx does not import cfb/data. Any homepage CFB clause needs the count threaded in.
- HomeHero props, page.tsx:327 stat row, FounderBlock (derived list but size-ordered: renders "NFL, NHL, MLB, MLS, NBA, and WNBA", the only surface not in LEAGUE_ORDER), /teams teamCount, /team-rankings and /best-promos counts, llms.txt cfbSchoolCount and rivalryCount, /cfb totalTeams, rivalry-index FAQ counts, promos-today helpers.ts:75, team FAQ teamCount (promo-helpers 402/448).

Hardcoded 169 (stragglers): layout.tsx:61, footer.tsx:22, redesign/Footer.tsx:98, footer-team-sitemap.tsx:34 (has a teams prop), llms.txt/route.ts:20 and :24, promos/this-week:57 and :73, theme-nights:99, food-deals:48, my-teams-view.tsx:417 and :453, TeamStarPicker.tsx:82 (placeholder default).

Hardcoded six-league lists: layout.tsx:61, teams/page.tsx:16 LEAGUE_SET, both footers, download:34/127, follow:17, promos this-week:31/57, bobbleheads:56, food-deals:24/48, jersey-giveaways:51, theme-nights:99, promo-helpers.ts:402/436/448, indie-developer-block.tsx:40. Hardcoded number words: "six major pro leagues" bobbleheads:61 and food-deals:53, "all six leagues" zero-promo-fallback:43, "three scored leagues" best-promos:104.

Three league orders coexist: canonical LEAGUE_ORDER (MLB, NBA, NFL, NHL, MLS, WNBA: root description, /follow, about, homepage JSON-LD, promo-helpers, llms.txt); NHL-before-NFL (teams LEAGUE_SET, both footers, /download, all /promos/* leads and descriptions, indie block); /venues (MLB, NFL, MLS, WNBA, NBA, NHL); FounderBlock by size.

Helper duplication: numberWord twice (about-copy exported, homepage-json-ld private), joinList/leagueList twice (about/page.tsx:29, homepage-json-ld.tsx:48) plus FounderBlock's joinLeagues. The build should lift getAboutCounts + joinList + numberWord into a shared lib and have the homepage consume it; that is the "derived counts stay derived" path for any new clause.

Per-hub club counts are literals (30/30/32/15) and match live. YEAR = new Date().getFullYear() in promos/{bobbleheads,food-deals,jersey-giveaways,theme-nights} metadata contradicts the hardcode-the-season-year rule; out of scope, flagged.

DOM + JSON-LD pairings. One constant (edit once): homepage FAQ (buildHomepageFaqs), /about (aboutFaqs, aboutMetaDescription feeds meta + og + AboutPage), team FAQ (generateTeamFAQs, schema drops brandPromo slots), hubs (DESCRIPTION and FAQS), /promos/* (lead and faqs), bag policies, rivalry index. Separate literals of one claim (edit together): homepage Organization.description vs both hero ledes vs both footers; team-rankings :133 vs :31/:35 vs :221/:281; best-promos :218/:219 vs :52/:56 vs :225/:257/:328; best-promos/bobbleheads :187/:188 vs :53; soccer-jersey-nights :108 vs :39 vs :100 (the DOM lead is NOT fed to schema on that route); playoffs :298 vs :76 vs :356.

Tests: src/lib/__tests__/about-freshness.test.ts fingerprints about-copy.ts, so any byte change there needs ABOUT_COPY_FINGERPRINT, ABOUT_LAST_REVIEWED and ABOUT_LAST_REVIEWED_LABEL bumped (the page publishes that date). sheet-copy.test.ts pins capture copy. Nothing pins the tagline, root description, footer line, alt text, or any league list.

Other flags found on the way: em dash in user-facing copy at src/components/cfb/CfbConferenceSubRow.tsx:31 and in the og alt at src/app/team-rankings/page.tsx:43; stale "167" and "86" code comments; sitemap carries no descriptive text (grep-verified).

---

## Q7. TRUE CFB COVERAGE (live Firestore + prod, 2026-08-25, reproduced by a second probe)

Schools: 87 docs in cfbSchools. 86 indexable. washington-state is below the floor (src/lib/cfb/data.ts:222-225: fewer than 8 games or no venue; it has 6 games and venueId ""), so it serves noindex,follow and is omitted from the sitemap, but the /cfb hub still lists it ("Browse all 87"). Copy already says 87 on /about and llms.txt; code comments say 86 in nine places (data.ts:42,47,135,139,147; matchups.ts:87,240; CfbSchoolPage.tsx:8,182; CfbConferenceSubRow.tsx:4). Use 87 and the word "programs".

Venue resolved, by definition:
- 86 of 87 have a venueId, a cfbVenues doc (the collection holds exactly 86), finite coordinates, a clean city (venue-cities.ts map), a venueHubs tenant, and a Fanatics store mapping. Only washington-state has none.
- Verification depth is thinner: 8 venues coordsVerified, 64 capacityVerified (73 have capacity > 0, so the Capacity row is absent on 13 school pages), 0 humanConfirmed.
- venueHubs (223 docs, not 222): 86 carry a CFB tenant, 73 verified, 64 pass the hub index floor, 22 held. Only those 64 school pages render the /venues link (CfbSchoolPage.tsx:265). Held: air-force, appalachian-state, army, california, coastal-carolina, florida-state, georgia, indiana, iowa, james-madison, kansas, kansas-state, louisville, marshall, memphis, michigan, navy, northern-illinois, northwestern, oregon, toledo, ucf. The memory note "21 verified / 61 held" is stale.
- One venue doc has an empty state, so one school's JSON-LD address is city-only. cfb/[school]/page.tsx:60 builds that address from raw venue.city rather than venueCity(); it renders clean only because the data was cleaned on 2026-07-07.

Rivalries: 32 in the registry, 32 rendered by getMatchupIndex, 0 dropped, 32 anchors on prod /cfb/rivalries, 32 slugs plus the index in the sitemap (that is the "33-URL family"). llms.txt renders 32. Rail renders on 46 of 87 school pages. Underneath: cfbRivalries has 212 docs and 108 visible games carry a rivalryId, so "rivalries" in copy should mean the 32 pages unless it says otherwise.

Games: 670 raw, 662 visible, 262 verified. Most rows render "Kickoff TBA" (Ohio State: 9 of 12).

What a school page actually renders (src/components/cfb/CfbSchoolPage.tsx, DOM order):
1. Hero: back link to /cfb, kicker chant (55 of 87), h1 school name, mascot + conference, stat strip (home/road/rivalries). Always.
2. About the venue panel (86 of 87): name, Location, Capacity (73).
3. Rivalry rail chips (46 of 87).
4. Signature game + Why you go: never renders (editorial nulls at data.ts:311).
5. Plan your gameday: Ticketmaster/TicketNetwork and Expedia always, SpotHero (86), Fanatics (86), VenueHubLink (64).
6. 2026 Schedule, always; kickoff time only when verified, network only when confirmed.
7. Gameday & Traditions: never renders (Phase 4 TODO at :289).
8. Rivalry Games prose + cards, when rivalry-tagged games exist.
9. Venue editorial: never renders.
10. Contributor CTA "Know this place?", always.
JSON-LD: one SportsTeam with a nested StadiumOrArena. No FAQPage, no BreadcrumbList, no SportsEvent. The page has no h2 of its own (section labels are divs; the only h2s are the footer's). Trip steps live only on matchup pages; the FAQ lives only on /cfb/rivalries. /cfb and /venues emit zero JSON-LD.

Traditions: cfbTraditions has 2 docs (checker-neyland, shamrock-series), 0 of 87 schools reference them, 0 games carry themeDesignations, nothing in src reads the collection. The /cfb hub theme cards are the hardcoded THEME_CURATED list. Traditions must not be claimed, and "theme nights" on /cfb is currently unbacked.

Promos: zero. teams/{cfbSchoolId} does not exist for any of the 87; promos are keyed only by the parent path teams/{teamId}/promos (promo docs carry no teamId field, so any probe filtering on one is vacuous). Scoring: zero. SCORED_LEAGUES is MLB/MLS/WNBA; live teamScores = 75 docs, none CFB.

Still TODO (file:line): CfbSchoolPage.tsx:289 traditions grid (Phase 4); data.ts:61 and :310 editorial blocks all empty; hub-data.ts:71 cfbTraditions not seeded, theme game dates OFF until the theme sweep confirms; cfb/[school]/page.tsx:27 deferred G5 hold noindex until enriched; notify.ts:108 contributions sit pending-review, nothing published; docs/cfb-phase2-decisions.md:12 four stranded G5 schools (JMU, Marshall, Toledo, NIU); docs/known-issues.md:78 (contribute shares the subscribe rate limiter), :916, :966.

Honest one-line description of CFB today: 2026 schedules for 87 programs (kickoff and TV where announced), a venue block on 86, a gameday-planning strip, and 32 rivalry pages. Not promos, not traditions, not theme nights.

---

## Q8. DISCOVERABILITY

CFB is not orphaned. It is one link-depth click from every production page and 120 of the 470 sitemap URLs. The problem is how the entry points are labeled.

Registry: src/lib/league-hubs.ts:31 flags CFB live: true with label 'CFB'. Readers: BrandBarLeagueHubs.tsx:67 (desktop "League hubs" dropdown, SSR-rendered, hidden until click), BrandBarMobileMenu.tsx:107 (hamburger sheet), team-grid.tsx:208 (homepage CFB chip, both variants, client-only: the conference links and the /cfb link appear only after a tap, not in SSR HTML), teams-browser.tsx:153 (same on /teams), venues/page.tsx:68 up-link, sitemap.ts:64, RedesignTeamPage.tsx:98. Non-readers: legacy nav.tsx, legacy footer.tsx, redesign Footer.tsx (hardcoded DISCOVER_LINKS; :51 "College football rivalries" -> /cfb/rivalries, not the hub), HomeHero, home-category-tiles, ExploreCard.

Prod counts (unique /cfb* hrefs): / 2, /teams 2, /venues 2, /about 2, /mlb/minnesota-twins 2, /venues/albertsons-stadium 3, /cfb 93, sitemap 120 (1 hub + 86 schools + 1 index + 32 rivalries), llms.txt 4 lines. The two on every page are the nav dropdown /cfb (aria "CFB promotional schedule") and the footer /cfb/rivalries.

Paths from the homepage, redesign (what prod serves):
- Hub in 1 click, but only by opening a collapsed menu and picking a chip that says "CFB".
- Hub in 2 plain-English clicks with no menu: footer "College football rivalries" -> /cfb/rivalries -> eyebrow "College Football" up-link.
- Nothing visible in the hero, category tiles, explore cards, FAQ or founder block names college football. The word "college" appears on the homepage once, in the footer.
Legacy (gate-off): the chrome has zero CFB links. Paths are the client-only grid chip, /about body links, footer -> /venues -> "All CFB promos" -> /cfb, venue hub pages, sitemap, llms.txt.

Verdict, plainly: the copy fix is not cosmetic, but the real defect is labeling and placement, not a missing link. Bare "CFB" as the only nav label; a false "promotional schedule" aria-label on both nav entry points; "All CFB promos" on /venues; a footer link to the rivalries index instead of the hub; a hero that says "169 teams in 6 leagues" and never mentions the 87 programs; a homepage grid chip that is invisible to crawlers. The new tagline does not name college football either, so on its own it changes none of this. The navigational items are all small: registry label or display override to "College football", a CFB branch in hubAriaLabel, a /cfb link in both footers, corrected /venues up-link copy, and (your call) a college clause in the hero lede.

---

## DECISIONS NEEDED BEFORE THE BUILD

1. Legacy h1 (src/app/page.tsx:350). Replace with `FIND THE GAME, PLAN THE NIGHT.` for parity, or leave the gate-off variant untouched. Recommend replace: legacy exists as the rollback path and a rollback should not re-ship a retired tagline.
2. Social card. Regenerate public/og-image.png (it says "Every promo. Every team. / Free on iOS and Android"), collapse the five alt literals into one constant that describes the new card, and retire or align src/app/api/og/route.tsx.
3. Where the "plus 87 college football programs" clause goes: homepage WebSite/Organization descriptions (as a separate sentence), homepage FAQ "How many teams", redesign hero lede, /terms. Each needs cfbSchoolCount threaded into the homepage (lift getAboutCounts to a lib). Root layout.tsx:61 and both footer paragraphs stay pro-only either way.
4. App-scope rule. Either app-scoped copy names the four leagues, or coverage claims are attributed to the website. Seven surfaces, four of them in FAQPage schema.
5. "theme nights" on /cfb (metadata.ts:192, cfb/page.tsx:74): remove or substantiate.
6. Nav label: spell out "College football" (registry label vs display override), fix hubAriaLabel, add /cfb to both footers, fix the /venues up-link.
7. Organization.slogan: add the tagline once on the homepage node. Recommend yes.
8. The "every promo / every X" family: retire sitewide (home-category-tiles:64, about-copy 153/317, browse-collections:43) or keep next to the new line.
9. League order: consolidate on LEAGUE_ORDER or leave the three orders.
10. Ride-alongs: playoffs/page.tsx:76 MLB -> NBA; em dashes at CfbConferenceSubRow.tsx:31 and team-rankings/page.tsx:43; stale 86/167 comments.

Build constraints you set, restated against the inventory: both gate variants change together (HomeHero.tsx:54 + page.tsx:350; both footers; download :34 + :127; my-teams-view :417 + :453); DOM and JSON-LD change together (the one-constant families are safe, the separate-literal families above are the ones to watch); derived counts stay derived (cfbSchoolCount must come from getAllCfbSchoolIds, never typed); nothing hardcoded; no em dashes; about-copy.ts edits bump the fingerprint and review date.

---

## APPENDIX: full inventory (222 rows, sorted by file)

Format: file:line | route | surface | render target | gate | derived<source> | L=leagues mentioned | C=counts mentioned | classification | recommendation | which agent found it. TEXT is verbatim (truncated). Critic line-number corrections already applied where the critics supplied them; the rows they flagged as mis-anchored are: about-copy.ts:106 (text is :99-101), about-copy.ts:108 (string spans :107-109), [sport]/[team]/page.tsx:118 (template is :119-120, og at :158, twitter :176), playoffs:44 (spans :43-46), world-cup:75 (name :73), cfb/metadata.ts:262 (title :260, description :261-262), email.ts:162 (should be :161; digest twin :360), promos/today:97 (JSON-LD ItemList label, DOM copy is promos-today/helpers.ts:75).

docs/homepage-redesign-target.html:539 | n/a | design-target mock eyebrow (title tag at line 59 reads 'PromoNight · Every promo at every game'; lin | other | gate=n/a | hardcoded<> | L=none | C=none | tagline-slot | consider | by:tagline
   TEXT: <div class="eyebrow h-anim d1" style="color:rgba(248,243,238,.42)"><span class="dot" style="background:var(--red)"></span>Every promo at every game</div>
   WHY: Docs only, never rendered; HomeHero.tsx cites this file as its design target, so update it in the docs pass if the mock is meant to stay the reference, otherwise leave.
public/og-image.png:1 | n/a (every route) | default social card image, text baked into the PNG (used sitewide via layout openGraph, lib/og.ts DE | og | gate=both | hardcoded<> | L=none | C=none | tagline-slot | change | by:tagline
   TEXT: [baked into the image] PROMONIGHT / Every promo. Every team. / Free on iOS and Android
   WHY: The image carries a THIRD variant of the old tagline ('Every promo. Every team.') plus an app-first sub-line, and it is the tagline most people see on any shared link, so the tagline swap is incomplete until the card is regenerated; also, none of the alt strings in code match what the image actually says.
src/app/[sport]/[team]/page.tsx:118 | /[sport]/[team] (169 pages) | generateMetadata fallbackDescription (used when no upcoming promos) and the upcoming-promo list desc | meta | gate=both | derived<getTeamBySlug, getVenueForTeam, getTeamPromos; year = 2026 const (line> | L=none in text; branches on team.league (M | C=none | pro-only-correct | leave | by:route-meta
   TEXT: ${displayName} ${year} promotional schedule - bobbleheads, giveaways, theme nights, and food deals at ${venue.name}. ${freshnessTail} (freshnessTail line 115-117: ['MLB','WNBA','MLS'].includes(team.league) ? 'Rechecked weekly in season.' : 
   WHY: Per-team promo description built from live promos; no league list or site-wide count. Freshness tail is league-aware and matches the real cron cadences. Pro-only by construction (CFB schools are not in this route).
src/app/[sport]/[team]/page.tsx:167 | /{sport}/{team} | team page openGraph.images[0].alt | og | gate=both | hardcoded<> | L=none | C=none | other | change | by:tagline
   TEXT: alt: 'PromoNight: Every giveaway, every team',
   WHY: Third literal copy of the stale image alt on all 169 team pages; fold into the shared constant when the card is regenerated.
src/app/about/page.tsx:132 | /about | AboutPage.description (= aboutMetaDescription, also metadata.description at L60) | jsonld | gate=both | derived<getAboutCounts() src/app/about/page.tsx:37-54 (NOT exported): getAllTe> | L=six leagues | C=169 teams; six; 87 college foo | already-correct-with-cfb | leave | by:jsonld
   TEXT: src/lib/about-copy.ts:97-103: `How PromoNight finds, checks and publishes promotional schedules for ${c.teamCount} teams ` + `across ${numberWord(c.leagueCount)} leagues, plus ${c.cfbSchoolCount} college football programs. ` + `Written by M
   WHY: REFERENCE IMPLEMENTATION. One function feeds meta description, og:description (via pageOpenGraph) and AboutPage.description, so the three cannot drift. The reusable helper is getAboutCounts() at about/page.tsx:37-54; it is module-private, so a build that wants the same numbers elsewhere should lift it (and joinList/numberWord) into a shared lib rather than re-deriving. Nit only: 'publishes promotional schedules for 1
src/app/about/page.tsx:152 | /about | /about Person.description | jsonld | gate=both | hardcoded<> | L=none | C=none | other | leave | by:tagline
   TEXT: description: 'Solo developer and Minnesota sports fan. Builder of PromoNight.',
   WHY: Describes the founder, not the brand; no tagline belongs here.
src/app/about/page.tsx:157 | /about | Organization (about node): @id, name, legalName, founder, sameAs; NO description, NO slogan | jsonld | gate=both | hardcoded<ORG_ID = 'https://www.getpromonight.com/#organization' (L25)> | L=none | C=none | other | leave | by:jsonld
   TEXT: '@type': 'Organization', '@id': ORG_ID, name: 'PromoNight', legalName: 'Kovalik Digital LLC', url: 'https://www.getpromonight.com', logo: 'https://www.getpromonight.com/icon.png', email: 'hello@getpromonight.com', founder: { '@id': PERSON_I
   WHY: Second emission of the same Organization @id; the description property lives only on the homepage node (homepage-json-ld.tsx:110). AboutPage.mainEntity (L133) and Person.worksFor (L151) reference this @id. If a slogan is added to the homepage node, either mirror it here or leave this node slogan-free; do not put a different string on the two nodes.
src/app/api/og/route.tsx:32 | /api/og | dynamic default OG card sub-line under the PROMO/NIGHT wordmark (ImageResponse, no ?team param) | og | gate=n/a | hardcoded<> | L=none | C=none | tagline-slot | change | by:tagline
   TEXT: <div style={{ fontSize: 24, color: '#888', marginTop: 16 }}> Every giveaway, theme night & food deal </div>
   WHY: A live prod endpoint (curl https://www.getpromonight.com/api/og returned 200 image/png with cache-control immutable max-age=31536000) that renders a FOURTH variant of the old tagline family on a shareable 1200x630 card; grep finds zero consumers of /api/og in src, so it is an orphan, but it is public, cached for a year, and contradicts the finder's note that the static PNG is the only card; either retire the route or
src/app/api/og/route.tsx:108 | /api/og?team={slug} | dynamic per-team OG card sub-line under the city/team name (stats row 'Promos / Giveaways / Theme Ni | og | gate=n/a | mixed<team.city, team.name, team.league, splitPromosByDate(getTeamPromos(tea> | L={team.league} (derived) | C=promos.length (derived) | other | consider | by:tagline
   TEXT: <div style={{ fontSize: 32, color: '#888', marginTop: 16, letterSpacing: 1 }}> 2026 PROMO SCHEDULE </div>
   WHY: Live in prod (curl /api/og?team=minnesota-twins returned 200 image/png, immutable 1yr cache) and reads Firestore per request; no page references it, so it is an orphan card that will drift (hardcoded 2026, wordmark-only branding, no tagline); decide retire vs keep in the same pass as the static card.
src/app/best-promos/bobbleheads/page.tsx:49 | /best-promos/bobbleheads | metadata.description; title line 48 = 'Best Bobblehead Nights of ${SEASON_YEAR}: Ranked by Score' | meta | gate=both | mixed<SEASON_YEAR = 2026 (line 21)> | L=MLB, MLS, WNBA | C=none | pro-only-correct | leave | by:route-meta
   TEXT: Every bobblehead giveaway across MLB, MLS, and WNBA in ${SEASON_YEAR}, ranked 0 to 100 by attendance cap, item value, sponsor presence, and highlight tier. MLB rescored weekly; WNBA and MLS in season.
   WHY: Scored-league subset, correct.
src/app/best-promos/bobbleheads/page.tsx:53 | /best-promos/bobbleheads | openGraph.description; openGraph.title line 52 | og | gate=both | mixed<SEASON_YEAR = 2026> | L=MLB, MLS, WNBA | C=none | pro-only-correct | leave | by:route-meta
   TEXT: Every bobblehead giveaway across MLB, MLS, and WNBA in ${SEASON_YEAR}, ranked by score. MLB rescored weekly; WNBA and MLS in season.
   WHY: Scored-league subset, correct.
src/app/best-promos/bobbleheads/page.tsx:81 | /best-promos/bobbleheads | FAQPage answer: When do bobblehead giveaways usually happen? | faq-jsonld | gate=both | hardcoded<> | L=MLB, WNBA | C=none | pro-only-correct | leave | by:jsonld
   TEXT: 'Most MLB bobblehead nights run on weekend home games, especially Saturday evenings and Sunday afternoons. Teams schedule them to drive attendance for series that are not already sellouts. WNBA bobbleheads cluster around marquee dates and r
   WHY: Finder recorded only the Article.description for this route. FAQS const is shared by DOM and FAQPage (ScoredJsonLd L202). Scored-league surface, no CFB.
src/app/best-promos/bobbleheads/page.tsx:91 | /best-promos/bobbleheads | FAQPage answer: How many bobbleheads does each team give away? | faq-jsonld | gate=both | hardcoded<> | L=MLB, WNBA | C=none (quantity ranges only) | pro-only-correct | leave | by:jsonld
   TEXT: 'Quantities vary by team and event, recorded in the attendance cap field on each card above. MLB programs typically distribute 15,000 to 25,000 bobbleheads per game. WNBA bobbleheads sit around 8,000 to 12,000 to match smaller venue capacit
   WHY: Not itemized. Shared DOM + FAQPage via FAQS. The INLINE_ANSWERS block at L100-106 ('Why do WNBA bobbleheads score so high?') is DOM-only and not in the FAQPage.
src/app/best-promos/bobbleheads/page.tsx:187 | /best-promos/bobbleheads | CollectionPage JSON-LD description, retrospective branch (in-season branch at 188 is already found) | jsonld | gate=both | mixed<SEASON_YEAR> | L=MLB, MLS, WNBA | C=none | pro-only-correct | leave | by:sweep
   TEXT: ? `Every bobblehead giveaway of the completed ${SEASON_YEAR} season across MLB, MLS, and WNBA, ranked by score.`
   WHY: Scored-surface description; pro-only by rule. Sibling ternary branch of the found item at 188.
src/app/best-promos/bobbleheads/page.tsx:188 | /best-promos/bobbleheads | jsonLdDescription (upcoming branch; retrospective at line 187) fed to ScoredJsonLd Article descripti | jsonld | gate=both | mixed<SEASON_YEAR = 2026> | L=MLB, MLS, WNBA | C=none | pro-only-correct | leave | by:route-meta
   TEXT: : `Every bobblehead giveaway across MLB, MLS, and WNBA in ${SEASON_YEAR}, ranked by score.`;
   WHY: Scored-league subset; correct.
src/app/best-promos/bobbleheads/page.tsx:192 | /best-promos/bobbleheads | /best-promos/bobbleheads capsule (offseason branch) | dom | gate=both | mixed<promos.length; SEASON_YEAR> | L=MLB, MLS, WNBA | C=none | pro-only-correct | leave | by:dom-copy
   TEXT: const capsuleRetro = `The ${SEASON_YEAR} season is complete, and these are its ${promos.length} top-scored bobblehead giveaways across MLB, MLS, and WNBA. Nothing here is upcoming: the three leagues we score are between seasons, so this is 
   WHY: Offseason twin of the finder's 226 row. Scored leagues only.
src/app/best-promos/bobbleheads/page.tsx:226 | /best-promos/bobbleheads | /best-promos/bobbleheads capsule (in-season branch) | dom | gate=redesign | mixed<promos.length; SEASON_YEAR> | L=MLB, MLS, WNBA | C=none | pro-only-correct | leave | by:dom-copy
   TEXT: The {promos.length} top-scored bobblehead giveaways of {SEASON_YEAR} are ranked below across MLB, MLS, and WNBA. MLB clubs run the majority of bobblehead programs. Every listed event is scored on attendance cap, item value, sponsor presence
   WHY: Scored-leagues surface. Line 192 capsuleRetro and legacy twin at 295-297 match.
src/app/best-promos/bobbleheads/page.tsx:296 | /best-promos/bobbleheads | /best-promos/bobbleheads intro paragraph body prose (in-season branch), spans 295-299 | dom | gate=both | mixed<promos.length, SEASON_YEAR> | L=MLB, MLS, WNBA | C=promos.length (derived) | pro-only-correct | leave | by:sweep
   TEXT: ranked below across MLB, MLS, and WNBA. MLB clubs run the majority of bobblehead programs. Every listed event is scored
   WHY: Scored-surface prose; the word 'programs' here means bobblehead programs, not college programs. Pro-only, must not gain CFB.
src/app/best-promos/page.tsx:52 | /best-promos, /best-promos/bobbleheads | /best-promos metadata.description (og twin at 56; body prose at 218-219, 225, 257, 329-331; /best-pr | meta | gate=both | hardcoded<> | L=MLB, MLS, WNBA | C=none | pro-only-correct | leave | by:tagline
   TEXT: description: `Score-ranked promo nights across MLB, MLS, and WNBA in ${SEASON_YEAR}. Bobbleheads, jerseys, and theme nights ranked 0 to 100 by attendance cap, item value, sponsor presence, and highlight tier. MLB rescored weekly; WNBA and M
   WHY: Scored-surface family, three leagues by design; must NOT gain CFB; none of these appear in the finder's inventory or its handoff notes.
src/app/best-promos/page.tsx:56 | /best-promos | openGraph.description; openGraph.title line 55 = 'Best Sports Promo Nights of ${SEASON_YEAR}' | og | gate=both | hardcoded<> | L=MLB, MLS, WNBA | C=none | pro-only-correct | leave | by:route-meta
   TEXT: Score-ranked promo nights across MLB, MLS, and WNBA. MLB rescored weekly; WNBA and MLS in season.
   WHY: Scored-league subset, correct.
src/app/best-promos/page.tsx:89 | /best-promos | FAQPage answer: Why are NBA and NHL not included? | faq-jsonld | gate=both | hardcoded<> | L=MLB, MLS, WNBA, NBA, NHL | C=none | pro-only-correct | leave | by:jsonld
   TEXT: 'The scoring layer rolled out for MLB, MLS, and WNBA first. NBA and NHL promo data exists in PromoNight but has not yet been processed through the structured-extraction pipeline that this ranking depends on. Those leagues will join in a fut
   WHY: Finder mentioned this in a rationale but gave it no row. Rankings surface, CFB never. FAQS const shared by DOM and FAQPage (ScoredJsonLd L235/L301). Near-duplicate of team-rankings/page.tsx:79 with two wording differences ('not included' vs 'not on this ranking'; 'that this ranking' vs 'this ranking'), two literals to change together. NFL is not named as excluded on either page.
src/app/best-promos/page.tsx:104 | /best-promos | FAQPage answer: Can I see only bobblehead nights? | faq-jsonld | gate=both | hardcoded<'three' is hand-typed; equals SCORED_LEAGUES.size (types.ts:184)> | L=three scored leagues | C=three (league count) | pro-only-correct | leave | by:jsonld
   TEXT: 'Yes. Visit /best-promos/bobbleheads for the same ranking filtered to derivedSignals.itemType equal to "bobblehead". That page shows every scored upcoming bobblehead night across the three scored leagues with its own ranked list.'
   WHY: Not itemized by the finder. Carries a hand-typed league COUNT that would go stale if a fourth league is scored. Prod-verified in the /best-promos FAQPage. Shared DOM + FAQPage via FAQS. Also leaks an internal field path (derivedSignals.itemType) into a public FAQ answer; outside the CFB rule.
src/app/best-promos/page.tsx:218 | /best-promos | CollectionPage JSON-LD description, retrospective (offseason) branch of the ternary; the in-season b | jsonld | gate=both | mixed<promos.length, SEASON_YEAR> | L=MLB, MLS, WNBA | C=promos.length (derived) | pro-only-correct | leave | by:sweep
   TEXT: ? `Score-ranked list of the ${promos.length} best promotional events of the completed ${SEASON_YEAR} season across MLB, MLS, and WNBA.`
   WHY: Scored-surface description; scoring covers MLB/MLS/WNBA only (SCORED_LEAGUES in types.ts:184). Must not gain CFB. Only the sibling branch at 219 was inventoried.
src/app/best-promos/page.tsx:219 | /best-promos | jsonLdDescription (upcoming branch; retrospective variant at line 218) fed to ScoredJsonLd Article d | jsonld | gate=both | mixed<promos.length; SEASON_YEAR = 2026> | L=MLB, MLS, WNBA | C=${promos.length} | pro-only-correct | leave | by:route-meta
   TEXT: : `Score-ranked list of ${promos.length} top promotional events across MLB, MLS, and WNBA in ${SEASON_YEAR}.`;
   WHY: Scored-league subset in structured data; correct, CFB excluded by construction.
src/app/best-promos/page.tsx:225 | /best-promos | /best-promos capsule (offseason / retrospective branch), rendered at 255 (redesign) and 326 (legacy) | dom | gate=both | mixed<promos.length; SEASON_YEAR> | L=MLB, MLS, WNBA ("the three leagues we sc | C=none | pro-only-correct | leave | by:dom-copy
   TEXT: const capsuleRetro = `The ${SEASON_YEAR} season is complete, and these are its ${promos.length} best-scored promo nights across MLB, MLS, and WNBA. Nothing here is upcoming: the three leagues we score are between seasons, so this is the fin
   WHY: Finder only rowed the in-season branch (257). The offseason branch is the one that will render from roughly Nov 8 onward and hardcodes the three scored leagues; correct, and must never gain CFB.
src/app/best-promos/page.tsx:257 | /best-promos | /best-promos capsule (in-season branch) | dom | gate=redesign | mixed<promos.length; SEASON_YEAR> | L=MLB, MLS, WNBA | C=none | pro-only-correct | leave | by:dom-copy
   TEXT: The {promos.length} best-scored sports promo nights of {SEASON_YEAR} are ranked below from 100 down. Every entry pulls from official MLB, MLS, and WNBA team-promotion announcements and is scored 0 to 100 on attendance cap, item value, spons
   WHY: Rankings surface: scored leagues only, must never gain CFB. Line 225 capsuleRetro (offseason branch) and legacy twin at 327-331 say the same three leagues. FAQ at line 89 explicitly explains NBA/NHL exclusion.
src/app/best-promos/page.tsx:328 | /best-promos | /best-promos intro paragraph body prose (in-season branch), spans 327-331 | dom | gate=both | mixed<promos.length, SEASON_YEAR> | L=MLB, MLS, WNBA | C=promos.length (derived) | pro-only-correct | leave | by:sweep
   TEXT: ranked below from 100 down. Every entry pulls from official MLB, MLS, and WNBA team-promotion announcements and is scored 0 to 100 on attendance cap, item value, sponsor presence, and highlight tier. The list refreshes with each league's we
   WHY: Scored-surface prose naming the three scored leagues; correct and must not gain CFB. Found list covers 52/56/89/104/219/225/257 on this page but not this paragraph.
src/app/cfb/contribute/page.tsx:16 | /cfb/contribute | /cfb/contribute metadata: title only, NO description, so the root layout description (pro-only, 169  | meta | gate=both | hardcoded<inherits src/app/layout.tsx:61 description> | L=inherits MLB, NBA, NFL, NHL, MLS, WNBA | C=inherits 169 | ambiguous | consider | by:tagline
   TEXT: title: 'Contribute: College Football Gameday',
   WHY: Prod-verified 2026-08-25: the served HTML for /cfb/contribute carries <title>PromoNight: Pro Sports Giveaway & Promo Night Tracker</title> and the root 169-team six-league description (this page's own title export is not in the served head, a separate anomaly worth a look); noindex is set so search impact is nil, but any shared link previews a pro-promo claim on a college page; this is the concrete instance of the 'i
src/app/cfb/page.tsx:68 | /cfb | /cfb hub hero eyebrow (h1 at 70-72 'The rivalries, the road trips, and every Saturday that matters.' | dom | gate=n/a | mixed<data.totalTeams for the sub-line count> | L=college football | C={data.totalTeams} (87, derived | other | leave | by:tagline
   TEXT: <span className="inline-block h-px w-7" style={{ background: GOLD }} /> COLLEGE FOOTBALL · 2026
   WHY: The one hub hero the finder's HubHero sweep could not reach (CFB uses its own hero, not HubHero); page-scoped eyebrow, no brand line, count derived.
src/app/cfb/page.tsx:74 | /cfb | /cfb hub hero subtitle (DOM) | dom | gate=n/a | mixed<data.totalTeams derived from cfbSchools; 'theme nights' literal> | L=none (CFB hub) | C={data.totalTeams} (87) | ambiguous | consider | by:route-meta
   TEXT: Trophy games, theme nights, and gameday plans for {data.totalTeams} teams. Built for fans who actually go.
   WHY: Pairs with the disputed /cfb meta description at src/lib/cfb/metadata.ts:192: both promise 'theme nights' on the one collection THE CFB RULE says has no promo data. The only 'THEME NIGHT' rendering in the CFB tree is a decorative card label (src/components/cfb/hub/blocks.tsx:116) and a contributor-form field. Count is correctly derived here while the meta description deliberately dropped its count.
src/app/cfb/page.tsx:78 | /cfb | /cfb hub hero CTA | dom | gate=redesign | derived<data.totalTeams (hub-data.ts:190)> | L=none | C=87 | already-correct-with-cfb | leave | by:dom-copy
   TEXT: Browse all {data.totalTeams} →
   WHY: Derived CFB-only count; prod renders "Browse all 87". The code comment at line 127 still says 86 (comment only).
src/app/cfb/page.tsx:129 | /cfb | /cfb hub browse section label | dom | gate=redesign | derived<data.totalTeams (hub-data.ts:190)> | L=none | C=87 TEAMS | already-correct-with-cfb | leave | by:dom-copy
   TEXT: <SectionLabel sub="Pick your team for its full schedule, rivalries, and gameday plan.">BROWSE ALL {data.totalTeams} TEAMS</SectionLabel>
   WHY: Derived; prod renders "BROWSE ALL 87 TEAMS". Sub copy names schedule, rivalries, gameday plan and no promos, which is the correct CFB framing.
src/app/download/page.tsx:17 | /download | /download meta description (also og:description via pageOpenGraph) | meta | gate=both | hardcoded<> | L=none | C=none | app-copy | leave | by:tagline
   TEXT: 'Install PromoNight free on iOS or Android. Browse every giveaway, theme night, and food deal at your team\'s home games, and add Pro for morning-of reminders.',
   WHY: App store style blurb doing the download page's job; not a tagline slot.
src/app/download/page.tsx:34 | /download | /download hero sub-line under h1 'GET PROMONIGHT' (redesign; legacy twin at line 127 is byte-identic | app-copy | gate=both | hardcoded<> | L=MLB, NBA, NHL, NFL, MLS, WNBA | C=none | app-copy | consider | by:tagline
   TEXT: Every giveaway, theme night, and food deal across MLB, NBA, NHL, NFL, MLS, and WNBA. Free to download. Pro tier adds promo-day reminders.
   WHY: Not a tagline slot, but it claims the APP covers six leagues while about-copy.ts:256 states the app covers MLB, NBA, NHL and MLS only, so this line belongs to the league-list/app-copy workstream; it must not gain CFB either way.
src/app/download/page.tsx:127 | /download | /download hero lede | app-copy | gate=legacy | hardcoded<> | L=MLB, NBA, NHL, NFL, MLS, WNBA | C=none | wrong-framing | change | by:dom-copy
   TEXT: Every giveaway, theme night, and food deal across MLB, NBA, NHL, NFL, MLS, and WNBA. Free to download. Pro tier adds promo-day reminders.
   WHY: Legacy twin of line 34; same app-coverage overstatement.
src/app/follow/page.tsx:17 | /follow | /follow metadata.description | meta | gate=both | hardcoded<> | L=MLB, NBA, NFL, NHL, MLS, WNBA | C=none | pro-only-correct | leave | by:tagline
   TEXT: 'Star your favorite MLB, NBA, NFL, NHL, MLS, and WNBA teams and get one weekly email with every giveaway, theme night, and food deal coming up.',
   WHY: Email funnel description with a hardcoded six-league list; starring is pro-only (CFB schools are not followable), so it must not gain CFB; league-list workstream note only for the hardcoded list.
src/app/follow/page.tsx:22 | /follow | /follow openGraph.description (og:title at line 20 is 'Follow Your Teams on PromoNight') | og | gate=both | hardcoded<> | L=none | C=none | description-slot | leave | by:tagline
   TEXT: 'One weekly email with every giveaway, theme night, and food deal for the teams you star.',
   WHY: Page-specific OG description doing its own job; not a tagline slot.
src/app/follow/page.tsx:78 | /follow | /follow hero h1 (eyebrow 'Free weekly email' at 75; FollowCTA.tsx:47 reuses 'NEVER MISS A GIVEAWAY') | dom | gate=redesign | hardcoded<> | L=none | C=none | other | leave | by:tagline
   TEXT: Never miss a giveaway
   WHY: Page-scoped headline for the email funnel, not a brand tagline slot.
src/app/layout.tsx:57 | / | metadata.title.default (renders as <title>, og:title, twitter:title on the homepage; prod-confirmed) | meta | gate=both | hardcoded<> | L=none | C=none | other | leave | by:tagline
   TEXT: default: 'PromoNight: Pro Sports Giveaway & Promo Night Tracker',
   WHY: SEO title tuned to the winnable niche per the in-file comment; a title is not a tagline slot.
src/app/layout.tsx:58 | every route | metadata.title.template | meta | gate=both | hardcoded<> | L=none | C=none | other | leave | by:tagline
   TEXT: template: '%s | PromoNight',
   WHY: Brand suffix only; CFB title budget (47 chars) depends on its length staying 13 chars.
src/app/layout.tsx:61 | / (inherited by pages without their own description) | root metadata.description (also og:description and twitter:description by inheritance; prod homepage | meta | gate=both | hardcoded<> | L=MLB, NBA, NFL, NHL, MLS, WNBA | C=169 teams | description-slot | consider | by:tagline
   TEXT: 'PromoNight tracks every giveaway, theme night, and food deal across 169 teams in MLB, NBA, NFL, NHL, MLS, and WNBA. Never miss bobblehead night.',
   WHY: A meta description does a different job from the tagline and must not receive it; it is a pro-only promo-coverage claim that must NOT gain CFB, but the hardcoded '169' (every other homepage count is derived) belongs to the league-list workstream.
src/app/layout.tsx:71 | / (inherited sitewide) | root openGraph.images[0].alt (renders as og:image:alt on every page that inherits root OG; prod home | og | gate=both | hardcoded<> | L=none | C=none | other | change | by:tagline
   TEXT: alt: 'PromoNight: Every giveaway, every team',
   WHY: Alt text must describe the image; today it quotes a line ('Every giveaway, every team') that appears nowhere in the PNG, so it should be rewritten to match whatever text the regenerated og-image.png carries, together with the four sibling copies below.
src/app/llms.txt/route.ts:20 | /llms.txt | llms.txt opening description line | llms | gate=n/a | mixed<cfbSchoolCount from getAllCfbSchoolIds(); 169 and league list hardcode> | L=MLB, NBA, NFL, NHL, MLS, WNBA | C=169 teams, ${cfbSchoolCount} ( | description-slot | leave | by:tagline
   TEXT: PromoNight is a mobile app and website that tracks every promotional event -- giveaways, theme nights, food deals, and kids events -- across 169 professional sports teams in MLB, NBA, NFL, NHL, MLS, and WNBA, plus 2026 schedules, rivalry ga
   WHY: This is the reference framing for the CFB rule (six pro leagues plus N college programs); a description, not a tagline slot.
src/app/llms.txt/route.ts:24 | /llms.txt | llms.txt Content Categories first bullet | llms | gate=n/a | hardcoded<> | L=none | C=169 teams | pro-only-correct | consider | by:tagline
   TEXT: - Team promo schedules: Complete lists of upcoming promotional events for each of 169 teams
   WHY: Same file the finder cites as the CFB-rule reference derives the CFB count but hardcodes 169 here and on line 20; pro-only promo claim, correct framing, hardcoded-count item.
src/app/llms.txt/route.ts:30 | /llms.txt | llms.txt College football content line | llms | gate=n/a | derived<cfbSchoolCount = getAllCfbSchoolIds().length (L15); rivalryCount = get> | L=college football | C=87 programs, 33 rivalry games  | already-correct-with-cfb | leave | by:jsonld
   TEXT: - College football: 2026 schedules, kickoff and TV info once officially announced, and gameday travel plans for ${cfbSchoolCount} programs, plus ${rivalryCount} named rivalry games with date, stadium, and trophy details
   WHY: Finder itemized L20 and named L24 but not L30, the second derived CFB count line. Prod llms.txt renders '87 programs'. Correct framing: CFB carries schedules, kickoff/TV and gameday plans, never promos.
src/app/manifest.json:4 | /manifest.json | PWA manifest description (name and short_name at lines 2-3 are both 'PromoNight'; prod serves this f | manifest | gate=both | hardcoded<> | L=none | C=none | description-slot | consider | by:tagline
   TEXT: "description": "Every Giveaway, Theme Night & Food Deal at Your Team's Games",
   WHY: A manifest description is an app blurb, not a tagline slot, so do not paste the tagline here; it is however the last survivor of an older title-case brand line and the only manifest field that could be refreshed alongside the tagline work if the user wants one voice.
src/app/mlb/page.tsx:38 | /mlb | DESCRIPTION const feeding metadata.description (og/twitter via pageOpenGraph fallback); TITLE line 3 | meta | gate=both | mixed<YEAR = 2026 (line 35); '30 clubs' literal> | L=MLB | C=30 clubs (hardcoded) | pro-only-correct | leave | by:route-meta
   TEXT: Every MLB team's ${YEAR} promo schedule in one place: bobblehead nights, jersey giveaways, theme nights, and food deals across all 30 clubs, grouped by division and refreshed through the season.
   WHY: Correctly single-league hub. Club count is a literal (stable for MLB).
src/app/mlb/page.tsx:51 | /mlb | FAQPage answer: What MLB promotions are happening this week? | faq-jsonld | gate=n/a | hardcoded<> | L=MLB | C=30 MLB teams | pro-only-correct | leave | by:jsonld
   TEXT: 'PromoNight tracks every giveaway, bobblehead night, theme night, and food deal announced by all 30 MLB teams. The this-week rail on this page lists the promotions scheduled at MLB ballparks over the next seven days, and it updates as teams
   WHY: DOM SHARES IT: FAQS const is passed to both HubFaq (L156) and AggregatorJsonLd (L98), one constant.
src/app/mlb/page.tsx:105 | /mlb (twins /mls, /wnba, /nfl) | league hub hero subtitle under the h1 (HubHero subtitle prop); twins at mls/page.tsx:105, wnba/page. | dom | gate=redesign | hardcoded<> | L=MLB | C=30 clubs | other | leave | by:tagline
   TEXT: subtitle="Every giveaway, bobblehead night, theme night, and food deal across all 30 MLB clubs, grouped by division."
   WHY: League-scoped hub subtitle in the 'Every giveaway...' family; the finder inventoried HubHero's eyebrow slot but not the subtitle slot it renders at HubHero.tsx:56; page-scoped, not a tagline slot.
src/app/mls/page.tsx:38 | /mls | DESCRIPTION const feeding metadata.description; TITLE line 37 = 'MLS Promotions & Giveaways ${YEAR}' | meta | gate=both | mixed<YEAR = 2026; '30 clubs' literal> | L=MLS | C=30 clubs (hardcoded) | pro-only-correct | leave | by:route-meta
   TEXT: Every MLS club's ${YEAR} promo schedule in one place: jersey and kit giveaways, scarf nights, theme nights, and more across all 30 clubs, grouped by conference and refreshed through the season.
   WHY: Correctly single-league hub.
src/app/mls/page.tsx:51 | /mls | FAQPage answer: What MLS promotions are happening this week? | faq-jsonld | gate=n/a | hardcoded<> | L=MLS | C=30 MLS clubs | pro-only-correct | leave | by:jsonld
   TEXT: 'PromoNight tracks every giveaway, scarf night, theme night, and specialty kit announced by all 30 MLS clubs. The this-week rail on this page lists the promotions scheduled at MLS stadiums over the next seven days, and it updates as clubs a
   WHY: Same pattern as the MLB and WNBA hub FAQs; hand-typed 30 matches the probe. Note 3 of 30 MLS clubs are excluded from scanning (Toronto, Montreal, Atlanta) so 'every giveaway ... announced by all 30 MLS clubs' overstates scan coverage; outside the CFB rule. FAQS shared by HubFaq (L156) and AggregatorJsonLd (L98).
src/app/mls/page.tsx:105 | /mls | /mls hub subtitle | dom | gate=redesign | hardcoded<> | L=MLS | C=all 30 | pro-only-correct | leave | by:dom-copy
   TEXT: subtitle="Every jersey giveaway, scarf night, and theme night across all 30 MLS clubs, grouped by conference."
   WHY: Matches live (30). FAQ line 51 and intro 143 repeat it.
src/app/my-teams/page.tsx:15 | /my-teams | /my-teams metadata.description (noindex) | meta | gate=both | hardcoded<> | L=pro sports | C=none | pro-only-correct | leave | by:tagline
   TEXT: 'Your personalized promo calendar across every starred pro sports team.',
   WHY: Starring is pro-only; correct framing; not a tagline slot.
src/app/nfl/page.tsx:52 | /nfl | DESCRIPTION const feeding metadata.description; TITLE line 51 = 'NFL Promotions & Giveaways ${YEAR}' | meta | gate=both | mixed<YEAR = 2026; '32 teams' literal> | L=NFL | C=32 teams (hardcoded) | pro-only-correct | leave | by:route-meta
   TEXT: Every NFL club's ${YEAR} promo schedule, week by week: theme nights, giveaways, and kids days across all 32 teams, plus stadium guides for each week's home slate.
   WHY: Correctly single-league hub. 'Every NFL club's promo schedule' is a coverage claim on a corpus that is still nearly empty (see NFL zero-state memory), but that is a freshness/coverage question, not a league-list one.
src/app/nfl/page.tsx:169 | /nfl | /nfl hub subtitle | dom | gate=redesign | hardcoded<> | L=NFL | C=all 32 | pro-only-correct | leave | by:dom-copy
   TEXT: subtitle="Theme nights, giveaways, and kids days across all 32 clubs, organized by NFL week with the stadium guide one tap from every game."
   WHY: Matches live (32). Intro line 220 repeats "All 32 NFL clubs".
src/app/page.tsx:38 | / | homepage metadata export (canonical only; NO description, NO title: inherits root layout title, desc | meta | gate=both | hardcoded<inherits src/app/layout.tsx:61> | L=none (inherits root: MLB, NBA, NFL, NHL, | C=none (inherits root: 169 teams | pro-only-correct | consider | by:route-meta
   TEXT: export const metadata: Metadata = { alternates: { canonical: 'https://www.getpromonight.com' }, };
   WHY: Both gate variants (legacy dark page in this file, redesign HomePageV2) share this one metadata export, so there is no per-variant description to keep in parity. Prod-verified: / renders the root description as meta, og:description and twitter:description. The homepage body already derives teamCount / leagueCount from homepageCountsFromTeams (src/components/homepage-json-ld.tsx:21) while the head keeps a hardcoded 16
src/app/page.tsx:327 | / | homepage hero stat chips (Teams / Leagues), rendered by HomeHero.tsx:80-93 as a dl | dom | gate=redesign | derived<allTeams.length; homepageCountsFromTeams(allTeams).leagueCount> | L=Leagues (renders 6) | C=169 Teams, 6 Leagues (prod-ver | pro-only-correct | leave | by:dom-copy
   TEXT: { value: String(allTeams.length), label: 'Teams' }, { value: String(homepageCounts.leagueCount), label: 'Leagues' },
   WHY: Finder inventoried the hero lede but not the stat row beneath it. Pro-only and derived; correct as is. See the sibling Venue guides chip at line 329 for the mixed-population caveat.
src/app/page.tsx:329 | / | homepage hero stat chip (Venue guides) | dom | gate=redesign | derived<getVenueUtilityCounts() in src/lib/venue-hub.ts:399 counts every verif> | L=none | C=166 Venue guides (prod-verifie | ambiguous | consider | by:dom-copy
   TEXT: { value: String(venueCounts.verifiedTotal), label: 'Venue guides' },
   WHY: Sits in the same row as 169 Teams and 6 Leagues, but the 166 includes college football stadiums (venueHubs football layer covers NFL + CFB). Not a false claim, but it is the one homepage number whose population is pro-plus-CFB while its neighbours are pro-only; if the row is ever captioned, keep the CFB clause off the Teams/Leagues chips.
src/app/page.tsx:350 | / | legacy homepage hero h1 (the tagline IS the h1 on this variant) | dom | gate=legacy | hardcoded<> | L=none | C=none | tagline-slot | consider | by:tagline
   TEXT: <h1 className="font-display text-[clamp(40px,7vw,72px)] leading-[0.95] tracking-[1px] mb-4 max-w-3xl"> EVERY PROMO AT EVERY GAME. </h1>
   WHY: On the gate-off (legacy) homepage this string is not an eyebrow, it is the page h1 itself (line 349-351), with a derived sub-line beneath it; the user's two constraints collide here (the tagline is to be replaced, but the h1 is to stay), so the user must rule whether legacy parity means swapping this h1 to the new tagline or leaving the dead variant untouched; not served in prod.
src/app/page.tsx:352 | / | legacy homepage hero sub-line under the h1 | dom | gate=legacy | derived<allTeams.length, homepageCounts.leagueCount (homepageCountsFromTeams)> | L={leagueCount} leagues (derived) | C={allTeams.length} teams (deriv | description-slot | leave | by:tagline
   TEXT: <p className="text-text-secondary text-lg md:text-xl leading-relaxed max-w-2xl mb-4"> {allTeams.length} teams, {homepageCounts.leagueCount} leagues, from official team announcements. Find tonight&apos;s giveaways, theme nights, and food dea
   WHY: Promo-coverage description, pro-only and fully derived; not a tagline slot and must not gain CFB.
src/app/page.tsx:353 | / | legacy homepage hero lede | dom | gate=legacy | derived<allTeams.length; homepageCountsFromTeams(allTeams).leagueCount> | L={leagueCount} leagues | C={allTeams.length} (169) | pro-only-correct | leave | by:dom-copy
   TEXT: {allTeams.length} teams, {homepageCounts.leagueCount} leagues, from official team announcements. Find tonight&apos;s giveaways, theme nights, and food deals.
   WHY: Promo coverage claim, pro-only, derived. Legacy variant only.
src/app/page.tsx:369 | / | legacy hero secondary CTA | dom | gate=legacy | derived<allTeams.length> | L=none | C={allTeams.length} (169) | pro-only-correct | leave | by:dom-copy
   TEXT: Browse all {allTeams.length} teams
   WHY: Links to /teams, the pro browser. CFB is not in that grid by design.
src/app/page.tsx:401 | / | legacy Find Your Team section h2 | dom | gate=legacy | derived<allTeams.length; homepageCounts.leagueCount> | L={leagueCount} LEAGUES | C={allTeams.length} (169) | pro-only-correct | leave | by:dom-copy
   TEXT: {allTeams.length} TEAMS ACROSS {homepageCounts.leagueCount} LEAGUES
   WHY: Heads the pro team grid (TeamGrid). Lines 408 and 428 repeat "View all {allTeams.length} teams" derived the same way.
src/app/page.tsx:448 | / (gate-off) | legacy homepage app-pitch h2 (kicker 'Promo reminders' at 444-446), the gate-off twin of AppDownload | dom | gate=legacy | hardcoded<> | L=none | C=none | app-copy | leave | by:tagline
   TEXT: <h2 className="font-display text-2xl md:text-3xl tracking-[1px] mt-2 mb-4"> WANT NOTIFICATIONS THE MORNING OF EVERY PROMO? </h2>
   WHY: App pitch headline, not a tagline slot; the finder inventoried the redesign twin but not this one, and parity is the stated reason both variants are kept.
src/app/page.tsx:451 | / | legacy homepage app section body | app-copy | gate=legacy | hardcoded<> | L=none | C=none | pro-only-correct | leave | by:dom-copy
   TEXT: PromoNight Pro sends a reminder the morning of every promo for your starred teams. The app is free to download. Web has everything else.
   WHY: Legacy twin of AppDownloadBlock. No league or count.
src/app/playoffs/page.tsx:44 | /playoffs (champions mode, currently inactive; prod serves the in-season branch) | generateMetadata description, offseason champions branch (also og:description line 53); champTitle l | meta | gate=both | hardcoded<gated on getPlayoffConfig().playoffsActive === false && isChampionsCel> | L=NBA, NHL (title); NBA, Stanley Cup (desc | C=none | pro-only-correct | leave | by:route-meta
   TEXT: Honoring the New York Knicks (2026 NBA Champions) and Carolina Hurricanes (2026 Stanley Cup Champions). Parade details, championship moments, and every playoff giveaway from both runs.
   WHY: Correctly two-league (NBA and NHL). Note it disagrees with the in-season branch at line 76, which says MLB and NHL; the champions branch is the correct one.
src/app/playoffs/page.tsx:76 | /playoffs | generateMetadata description (in-season branch; also og:description at line 85 and twitter fallback) | meta | gate=both | hardcoded<> | L=MLB, NHL | C=none | wrong-framing | change | by:route-meta
   TEXT: Every MLB and NHL playoff promo schedule for 2026. Giveaways, bobbleheads & theme nights across all active playoff teams. See what's on tonight.
   WHY: Wrong league, not a CFB issue: the page, its H1 (line 356: '2026 NBA AND NHL PLAYOFF PROMOTIONS'), its FAQs (lines 133-140), its LEAGUE_ICONS and the champions-mode metadata (line 42) are all NBA and NHL, and the team page comment at src/app/[sport]/[team]/page.tsx:197 states MLB playoffs are not supported by the scanner. Prod-verified live today: meta, og and twitter descriptions all say 'Every MLB and NHL playoff p
src/app/playoffs/page.tsx:94 | /playoffs | playoffs page openGraph.images[0].alt (off-season branch) | og | gate=both | hardcoded<> | L=none | C=none | other | change | by:tagline
   TEXT: alt: 'PromoNight: Every giveaway, every team',
   WHY: Fourth literal copy of the stale image alt; same fix as layout.tsx:71.
src/app/playoffs/page.tsx:298 | /playoffs (in-season branch; prod currently serves the offseason 'playoffs are complete' branch with no Article) | Article JSON-LD description (articleSchema at 300-304; headline line 297 = '2026 NBA and NHL Playoff | jsonld | gate=both | mixed<totalPromos/totalTeams from playoff config> | L=NBA, NHL | C=${totalPromos}, ${totalTeams} | pro-only-correct | leave | by:route-meta
   TEXT: const description = `Every promotional event at 2026 NBA and NHL playoff games: ${totalPromos} scheduled giveaways, watch parties, and fan events across ${totalTeams} active teams. Updated hourly.`;
   WHY: This is the structured-data twin of the meta description at :76 and it says NBA and NHL, which is further evidence that :76 ('Every MLB and NHL playoff promo schedule') is the wrong one. Prod-checked: /playoffs today renders the offseason copy (lines 818-821, 'The 2026 NBA and NHL playoffs are complete') while the head still says MLB and NHL, so the wrong league is live in the head on a page whose body says NBA.
src/app/playoffs/page.tsx:818 | /playoffs | /playoffs offseason card body | dom | gate=redesign | hardcoded<> | L=NBA, NHL, MLB | C="every team" | pro-only-correct | leave | by:dom-copy
   TEXT: The 2026 NBA and NHL playoffs are complete. Postseason promo coverage picks back up in October when the MLB playoffs begin, and returns for the NBA and NHL next spring. In the meantime, browse giveaways and theme nights across every team.
   WHY: Promo surface, pro-only.
src/app/preferences/page.tsx:14 | /preferences | metadata export with title only, NO description (noindex, nofollow); inherits root description at re | meta | gate=both | hardcoded<inherits src/app/layout.tsx:61> | L=none (inherits root six-league list) | C=none (inherits root 169) | ambiguous | leave | by:route-meta
   TEXT: title: 'Manage Your Teams', openGraph: pageOpenGraph('/preferences'), robots: { index: false, follow: false },
   WHY: No description field of its own; the root six-league promo description is what renders, which is fine for a noindex utility page. Same situation on /confirm (src/app/confirm/page.tsx:18, title 'Confirm Your Subscription', noindex) and /cfb/contribute (src/app/cfb/contribute/page.tsx:13, title 'Contribute: College Football Gameday', noindex, follow). Note /cfb/contribute therefore carries a pro-league promo descriptio
src/app/privacy/page.tsx:8 | /privacy | metadata.description | meta | gate=both | hardcoded<> | L=none | C=none | pro-only-correct | leave | by:route-meta
   TEXT: PromoNight privacy policy: what we collect on web and mobile, third-party services (analytics, affiliate networks, ads), and how to opt out.
   WHY: No league list or count; recorded for completeness of the route walk. /terms (src/app/terms/page.tsx:8) is the same: no leagues, no counts.
src/app/promos/bobbleheads/page.tsx:26 | /promos/bobbleheads | metadata.description (og/twitter via pageOpenGraph fallback); title line 25 | meta | gate=both | mixed<YEAR = new Date().getFullYear() (line 22)> | L=MLB, NBA, NHL, NFL, MLS, WNBA | C=none | pro-only-correct | leave | by:route-meta
   TEXT: Every ${YEAR} bobblehead giveaway across MLB, NBA, NHL, NFL, MLS, and WNBA. Player figurines by month with team, date, and opponent. From official team announcements.
   WHY: Promo collection, six pro leagues correct, no CFB. Separate note: YEAR is getFullYear(), which contradicts the house rule that SEO copy hardcodes the season year (the team page, hubs, /teams, /best-promos all hardcode 2026). Same pattern in food-deals, jersey-giveaways, theme-nights.
src/app/promos/bobbleheads/page.tsx:56 | /promos/bobbleheads | lead: DOM intro AND CollectionPage.description (description={lead} at line 85) | jsonld | gate=both | mixed<YEAR = getFullYear()> | L=MLB, NBA, NHL, NFL, MLS, WNBA; MLB, WNBA | C=none | pro-only-correct | leave | by:route-meta
   TEXT: const lead = `Every bobblehead giveaway scheduled across MLB, NBA, NHL, NFL, MLS, and WNBA in ${YEAR}. Player name, team, date, and opponent for each bobblehead night, grouped by month. Pulled from official team sources, with MLB, WNBA, and
   WHY: Six pro leagues in CollectionPage JSON-LD; correct.
src/app/promos/bobbleheads/page.tsx:61 | /promos/bobbleheads | /promos/bobbleheads FAQ 'How many bobblehead giveaways are there in {YEAR}?' answer (visible + FAQPa | faq-jsonld | gate=both | mixed<bobbleheads.length derived; 'six' hardcoded> | L=six major pro leagues; NBA, NHL, WNBA | C=six | pro-only-correct | leave | by:tagline
   TEXT: answer: `PromoNight is tracking ${bobbleheads.length} bobblehead giveaway${bobbleheads.length !== 1 ? 's' : ''} across the six major pro leagues in ${YEAR}. MLB teams schedule the majority, with smaller counts in NBA, NHL, and WNBA.`,
   WHY: Hardcoded 'six major pro leagues' is the correct framing (pro-only promo count); the only hit for the word 'six' in a coverage claim outside about-copy and zero-promo-fallback.
src/app/promos/bobbleheads/page.tsx:84 | /promos/bobbleheads | /promos/bobbleheads h1 | dom | gate=both | mixed<YEAR constant> | L="Pro Sports" | C=none | pro-only-correct | leave | by:dom-copy
   TEXT: title={`Every Bobblehead Giveaway in Pro Sports ${YEAR}`}
   WHY: Promo aggregator h1; pro-only wording is correct.
src/app/promos/food-deals/page.tsx:24 | /promos/food-deals | metadata.description (og/twitter via pageOpenGraph fallback); title line 23 | meta | gate=both | mixed<YEAR = new Date().getFullYear() (line 20)> | L=MLB, NBA, NHL, NFL, MLS, WNBA | C=none | pro-only-correct | leave | by:route-meta
   TEXT: Every ${YEAR} food-deal promo across MLB, NBA, NHL, NFL, MLS, and WNBA. Dollar dogs, half-price concessions, and value menus by month with team, date, and opponent. From official team announcements.
   WHY: Promo collection; six pro leagues correct; CFB must not be added. Body lead at line 48 hardcodes 'across 169 teams' (Part B). getFullYear() note as for bobbleheads.
src/app/promos/food-deals/page.tsx:48 | /promos/food-deals | /promos/food-deals lead paragraph (also the aggregator JSON-LD description at line 72); metadata.des | dom | gate=both | mixed<foods.length derived; 169 and league list hardcoded> | L=MLB, NBA, NHL, NFL, MLS, WNBA | C=169 teams | pro-only-correct | consider | by:tagline
   TEXT: const lead = `Every food-deal promotion scheduled across MLB, NBA, NHL, NFL, MLS, and WNBA in ${YEAR}. Dollar-dog nights, half-price concessions, and value menus with the team, date, and opponent for each, grouped by month. ${foods.length} 
   WHY: Same pattern as theme-nights:99; pro-only, must not gain CFB; hardcoded-count item.
src/app/promos/food-deals/page.tsx:53 | /promos/food-deals | FAQPage answer (JSON-LD + DOM) | faq-jsonld | gate=both | mixed<foods.length; YEAR = getFullYear()> | L='the six major pro leagues' | C=six (hardcoded word) | pro-only-correct | leave | by:route-meta
   TEXT: answer: `PromoNight is tracking ${foods.length} food-deal promotion${foods.length !== 1 ? 's' : ''} across the six major pro leagues in ${YEAR}. These include dollar-dog nights, half-price concessions, and themed value menus.`,
   WHY: Promo count across 'the six major pro leagues': correct pro-only framing, and the one place outside about-copy/homepage-json-ld that says 'six' in words. Must not become seven.
src/app/promos/food-deals/page.tsx:71 | /promos/food-deals | /promos/food-deals h1 | dom | gate=both | mixed<YEAR constant> | L="Pro Sports" | C=none | pro-only-correct | leave | by:dom-copy
   TEXT: title={`Every Ballpark Food Deal in Pro Sports ${YEAR}`}
   WHY: Promo aggregator h1; pro-only wording is correct.
src/app/promos/jersey-giveaways/page.tsx:26 | /promos/jersey-giveaways | metadata.description (og/twitter via pageOpenGraph fallback); title line 25 | meta | gate=both | mixed<YEAR = new Date().getFullYear() (line 22)> | L='pro sports' (no explicit list) | C=none | pro-only-correct | leave | by:route-meta
   TEXT: Every ${YEAR} jersey, cap, and apparel giveaway across pro sports. First 10,000 to 25,000 fans only. Arrive early. From official team announcements.
   WHY: 'across pro sports' is the right scope for a promo collection. Body lead at line 51 spells out the six leagues. getFullYear() note applies.
src/app/promos/jersey-giveaways/page.tsx:51 | /promos/jersey-giveaways | /promos/jersey-giveaways lead paragraph (aggregator JSON-LD description at 76); metadata.description | dom | gate=both | hardcoded<> | L=MLB, NBA, NHL, NFL, MLS, WNBA | C=none | pro-only-correct | leave | by:tagline
   TEXT: const lead = `Every jersey, cap, hat, jacket, shirt, and hoodie giveaway across MLB, NBA, NHL, NFL, MLS, and WNBA in ${YEAR}. Apparel giveaway nights are typically capped at the first 10,000 to 25,000 fans through the gates, which is why ar
   WHY: Hardcoded six-league list, no count; pro-only promo claim, must not gain CFB.
src/app/promos/jersey-giveaways/page.tsx:75 | /promos/jersey-giveaways | /promos/jersey-giveaways h1 | dom | gate=both | mixed<YEAR constant> | L="Pro Sports" | C=none | pro-only-correct | leave | by:dom-copy
   TEXT: title={`Every Jersey & Apparel Giveaway in Pro Sports ${YEAR}`}
   WHY: Promo aggregator h1; pro-only wording is correct.
src/app/promos/soccer-jersey-nights/page.tsx:32 | /promos/soccer-jersey-nights | metadata.title for /promos/soccer-jersey-nights (description at 34 and og description at 39 are alre | meta | gate=both | hardcoded<> | L=MLB, WNBA, MLS | C=none | pro-only-correct | leave | by:sweep
   TEXT: title: 'Soccer Jersey Nights 2026: MLB, WNBA & MLS Giveaways',
   WHY: Promo-collection title naming the three leagues that actually run soccer-jersey nights. Promo coverage, so pro-only.
src/app/promos/soccer-jersey-nights/page.tsx:34 | /promos/soccer-jersey-nights | metadata.description; title line 32 = 'Soccer Jersey Nights 2026: MLB, WNBA & MLS Giveaways' | meta | gate=both | hardcoded<> | L=MLB, WNBA, MLS | C=none | pro-only-correct | leave | by:route-meta
   TEXT: Every upcoming soccer jersey night across pro sports in 2026. MLB, WNBA, and MLS games giving away soccer-style jerseys, many during the World Cup. Dates, teams, and how to get one.
   WHY: Correctly scoped to the three leagues that actually run the promo. Title carries the same three-league list.
src/app/promos/soccer-jersey-nights/page.tsx:37 | /promos/soccer-jersey-nights | openGraph.title for /promos/soccer-jersey-nights | og | gate=both | hardcoded<> | L=MLB, WNBA, MLS | C=none | pro-only-correct | leave | by:sweep
   TEXT: title: 'Soccer Jersey Nights 2026: MLB, WNBA & MLS Giveaways',
   WHY: Duplicate of the meta title in the og block; must be edited in lockstep with line 32 if that ever changes.
src/app/promos/soccer-jersey-nights/page.tsx:39 | /promos/soccer-jersey-nights | openGraph.description (explicit); openGraph.title line 37 repeats the page title | og | gate=both | hardcoded<> | L=MLB, WNBA, MLS | C=none | pro-only-correct | leave | by:route-meta
   TEXT: Every upcoming soccer jersey giveaway across MLB, WNBA, and MLS in 2026, many during the World Cup.
   WHY: Same three-league scope as the meta description; correct.
src/app/promos/soccer-jersey-nights/page.tsx:58 | /promos/soccer-jersey-nights | FAQPage answer: What is a soccer jersey night? | faq-jsonld | gate=n/a | hardcoded<> | L=MLB, WNBA, MLS | C=none | pro-only-correct | leave | by:jsonld
   TEXT: 'A soccer jersey night is a pro sports game where the giveaway is a soccer-style jersey rather than the usual baseball or basketball jersey. In 2026 many MLB, WNBA, and MLS teams are running them as a tie-in with the World Cup, which the Un
   WHY: Finder referenced L58 in the L108 rationale without a row. FAQS shared by DOM and FAQPage (L129).
src/app/promos/soccer-jersey-nights/page.tsx:68 | /promos/soccer-jersey-nights | FAQPage answer: When are the soccer jersey nights during the World Cup? | faq-jsonld | gate=n/a | hardcoded<> | L=WNBA, MLS | C=none | pro-only-correct | leave | by:jsonld
   TEXT: 'Most of them. Nearly every soccer jersey night on the calendar falls between June 11 and July 19, 2026, the World Cup window, since teams are timing the giveaway to the tournament. A handful of WNBA and MLS dates land later in the season. 
   WHY: Names two leagues, not three as the finder's L108 rationale states. Shared DOM + FAQPage.
src/app/promos/soccer-jersey-nights/page.tsx:100 | /promos/soccer-jersey-nights | DOM lead paragraph (third separate literal of the CollectionPage/og claim) | dom | gate=n/a | mixed<total and wcCount derived from hits; league list literal> | L=MLB, WNBA, MLS | C=N jersey nights, N during Worl | pro-only-correct | leave | by:jsonld
   TEXT: `A soccer jersey night is a pro sports game where the giveaway is a soccer-style jersey, and ${total} are on the upcoming calendar across MLB, WNBA, and MLS in 2026, ${wcCount} of them during the World Cup. ` + 'United States teams are timi
   WHY: Reported because it is the DOM half of the pairing the finder flagged at L108: unlike every AggregatorJsonLd page, this route does NOT feed its lead into CollectionPage.description; the schema (L108), og (L39) and DOM lead (L100) are three separate literals of the same three-league claim and must change together.
src/app/promos/soccer-jersey-nights/page.tsx:108 | /promos/soccer-jersey-nights | CollectionPage.description | jsonld | gate=n/a | hardcoded<> | L=MLB, WNBA, MLS | C=none | pro-only-correct | leave | by:jsonld
   TEXT: 'Every upcoming soccer jersey giveaway across MLB, WNBA, and MLS in 2026, many during the World Cup.'
   WHY: Byte-identical to openGraph.description at L39 but written as TWO separate literals (not one constant); metadata.description L34 is a third, longer literal. FAQ answers L58/L68 name the same three leagues and are shared DOM + FAQPage.
src/app/promos/theme-nights/page.tsx:58 | /promos/theme-nights | metadata.description (og/twitter via pageOpenGraph fallback); title line 57 | meta | gate=both | mixed<YEAR = new Date().getFullYear() (line 14)> | L='pro sports' (no explicit list) | C=none | pro-only-correct | leave | by:route-meta
   TEXT: Every ${YEAR} theme night across pro sports by category: Star Wars, heritage, fireworks, faith and community, and pop culture tie-ins. From official team announcements.
   WHY: Promo collection, pro-only. Body lead at line 99 lists the six leagues and hardcodes 'across 169 teams' (Part B). getFullYear() note applies.
src/app/promos/theme-nights/page.tsx:99 | /promos/theme-nights | /promos/theme-nights lead paragraph (also the aggregator JSON-LD description at line 124) | dom | gate=both | mixed<themes.length derived; 169 and league list hardcoded> | L=MLB, NBA, NHL, NFL, MLS, WNBA | C=169 teams | pro-only-correct | consider | by:tagline
   TEXT: const lead = `Every theme night scheduled across MLB, NBA, NHL, NFL, MLS, and WNBA in ${YEAR}. Grouped by theme category, from Star Wars nights and fireworks spectaculars to heritage and community celebrations. ${themes.length} theme nights
   WHY: Derived promo count next to a hardcoded 169; pro-only, must not gain CFB; hardcoded-count item.
src/app/promos/theme-nights/page.tsx:115 | /promos/theme-nights | /promos/theme-nights FAQ answer (reminders) | faq-dom | gate=both | hardcoded<> | L="all sports" | C=none | pro-only-correct | leave | by:dom-copy
   TEXT: 'Yes. PromoNight Pro schedules a reminder on your device for the morning of a promo day for every team you follow. It is $5.99 per season for a single sport or $9.99 per year for all sports.',
   WHY: App pricing copy; no league list or count. Shared FAQ array feeds DOM and JSON-LD.
src/app/promos/theme-nights/page.tsx:123 | /promos/theme-nights | /promos/theme-nights h1 | dom | gate=both | mixed<YEAR constant> | L="Pro Sports" | C=none | pro-only-correct | leave | by:dom-copy
   TEXT: title={`Every Theme Night in Pro Sports ${YEAR}`}
   WHY: Promo aggregator h1; pro-only wording is correct.
src/app/promos/this-week/page.tsx:31 | /promos/this-week | /promos/this-week metadata.description | meta | gate=both | hardcoded<> | L=MLB, NBA, NHL, NFL, MLS, WNBA | C=none | pro-only-correct | leave | by:tagline
   TEXT: 'Every promo across MLB, NBA, NHL, NFL, MLS, and WNBA in the next 7 days. Bobbleheads, jerseys, theme nights, food deals. Updated daily.',
   WHY: Promo-coverage description with a hardcoded six-league list; must not gain CFB.
src/app/promos/this-week/page.tsx:57 | /promos/this-week | /promos/this-week lead paragraph (also passed as description to the aggregator JSON-LD at line 82) | dom | gate=both | hardcoded<> | L=MLB, NBA, NHL, NFL, MLS, WNBA | C=169 teams | pro-only-correct | consider | by:tagline
   TEXT: const lead = `Every highlighted promotional event across MLB, NBA, NHL, NFL, MLS, and WNBA in the next seven days. Giveaways, theme nights, bobbleheads, and food deals at all 169 teams, grouped by day. Updated daily based on the live PromoN
   WHY: Hardcoded 169 plus hardcoded league list in prose that also feeds schema; pro-only, must not gain CFB; hardcoded-count item.
src/app/promos/this-week/page.tsx:73 | /promos/this-week | /promos/this-week FAQ 'How do I see promos for just my team?' answer (visible + FAQPage) | faq-jsonld | gate=both | hardcoded<> | L=none | C=169 teams | wrong-framing | consider | by:tagline
   TEXT: 'Visit the team page directly from any promo in the list, or browse all 169 teams from the PromoNight app. PromoNight Pro adds a reminder on the morning of a promo day.',
   WHY: Claims the APP lets you browse all 169 teams while about-copy.ts:332 says the app covers MLB, NBA, NHL and MLS only (122 teams); hardcoded 169 as well; app-copy drift, not a CFB issue.
src/app/promos/this-week/page.tsx:81 | /promos/this-week | /promos/this-week h1 (AggregatorLayout title) | dom | gate=both | hardcoded<> | L="Pro Sports" | C=none | pro-only-correct | leave | by:dom-copy
   TEXT: title="Promos This Week Across Pro Sports"
   WHY: Page h1 says pro sports, which is exactly right for a promo aggregator. Finder covered the lead paragraph but not the h1s.
src/app/promos/today/page.tsx:35 | /promos/today | /promos/today DESCRIPTION (metadata.description and the aggregator JSON-LD description at 105) | meta | gate=both | hardcoded<> | L=MLB, WNBA, MLS, pro leagues in season | C=none | pro-only-correct | leave | by:tagline
   TEXT: 'Every sports promotional giveaway happening today across MLB, WNBA, MLS, and the pro leagues in season. Bobblehead nights, theme nights, and giveaways with tickets and parking, updated daily.';
   WHY: Promo-coverage description that names the three scanned leagues and defers the rest to 'the pro leagues in season'; correct framing, must not gain CFB.
src/app/promos/today/page.tsx:97 | /promos/today | /promos/today board section label | dom | gate=redesign | hardcoded<> | L=none | C=none | pro-only-correct | leave | by:dom-copy
   TEXT: { label: 'Sports promos today', promos: hasToday ? today : tomorrow },
   WHY: Today board body carries no league list or count in the DOM (the six-league text at line 35 is the metadata description, out of scope). Line 206 "See every promo coming in the next 7 days." likewise.
src/app/sitemap.ts:1 | /sitemap.xml | sitemap.xml | sitemap | gate=n/a | derived<getAllTeams(), getAllCfbSchoolIds(), LEAGUE_HUB_REGISTRY, getMatchupIn> | L=none in output (CFB/league names appear  | C=none in output (comment at lin | pro-only-correct | leave | by:dom-copy
   TEXT: (no descriptive text; entries carry only url, lastModified, changeFrequency, priority)
   WHY: Answer to "does it carry any descriptive text": NO. Evidence: grep for name/description/title/caption/label in sitemap.ts returns zero hits; the only object keys emitted are url/lastModified/changeFrequency/priority. Nothing to reword.
src/app/team-rankings/page.tsx:31 | /team-rankings | /team-rankings metadata.description (og:description twin at 35, ItemList description at 133, body pr | meta | gate=both | mixed<teamCount derived from scored set; league list hardcoded> | L=MLB, MLS, WNBA | C=${teamCount} (75) | pro-only-correct | leave | by:tagline
   TEXT: description: `All ${teamCount} MLB, MLS, and WNBA teams ranked by ${YEAR} promo schedule strength. Each ranking factors variety, highlights, and the share of major giveaways. MLB rescored weekly; WNBA and MLS in season.`,
   WHY: Rankings surface, scored leagues only; must NOT gain CFB (never scored); the finder's only team-rankings mention was the em-dash alt at line 43.
src/app/team-rankings/page.tsx:35 | /team-rankings | openGraph.description; openGraph.title line 34; og image alt at line 43 contains an em dash ('PromoN | og | gate=both | mixed<teamCount from getAllTeamScores(); YEAR = 2026> | L=MLB, MLS, WNBA | C=${teamCount} (75) | pro-only-correct | leave | by:route-meta
   TEXT: All ${teamCount} MLB, MLS, and WNBA teams ranked by ${YEAR} promo schedule strength. MLB rescored weekly; WNBA and MLS in season.
   WHY: Scored-league subset with derived count; correct. Side note only: line 43 og alt uses an em dash, which the house rule bars in user-facing copy.
src/app/team-rankings/page.tsx:64 | /team-rankings | FAQPage answer: Which MLS team has the highest-rated promo schedule? | faq-jsonld | gate=both | hardcoded<> | L=MLS, MLB, WNBA | C=none | pro-only-correct | leave | by:jsonld
   TEXT: 'The current MLS leader is shown in the live table above, filterable by league. MLS clubs typically score below MLB and WNBA at the top of the table because MLS promo schedules run fewer bobblehead and jersey-giveaway dates per season.'
   WHY: Finder itemized only L79 and L133 for this route. FAQS const shared by DOM and FAQPage (L150). Rankings surface, CFB never. Prod-verified in the /team-rankings FAQPage.
src/app/team-rankings/page.tsx:74 | /team-rankings | FAQPage answer: Why is my team's score the same as last week? | faq-jsonld | gate=both | hardcoded<> | L=MLB, WNBA, MLS | C=none | pro-only-correct | leave | by:jsonld
   TEXT: 'Scores are recomputed in a full league sweep with each league\'s weekly scan: MLB year-round, WNBA and MLS in season. Scoring is deterministic, so a team whose schedule has not changed gets the same score back after a sweep; the Last updat
   WHY: Cadence claim inside FAQPage, mentioned in the finder's L79 rationale but not given a row. Shared DOM + FAQPage. Same cadence fact as metadata.description L31 ('MLB rescored weekly; WNBA and MLS in season'), separate literals.
src/app/team-rankings/page.tsx:79 | /team-rankings | FAQPage answer: Why are NBA and NHL not on this ranking? | faq-jsonld | gate=both | hardcoded<> | L=MLB, MLS, WNBA, NBA, NHL | C=none | pro-only-correct | leave | by:jsonld
   TEXT: 'The scoring layer rolled out for MLB, MLS, and WNBA first. NBA and NHL promo data exists in PromoNight but has not yet been processed through the structured-extraction pipeline this ranking depends on. Those leagues will join in a future r
   WHY: Rankings scope. FAQS const is shared by the DOM FAQ and the FAQPage (one constant). L74 also names 'MLB year-round, WNBA and MLS in season' cadence. NFL is not mentioned as excluded, a minor omission but not a CFB-rule issue.
src/app/team-rankings/page.tsx:133 | /team-rankings | Article JSON-LD description (articleSchema), headline at line 132 | jsonld | gate=both | mixed<teamScores from getAllTeamScores(); YEAR = 2026> | L=MLB, MLS, WNBA | C=${teamScores.length} (prod: 75 | pro-only-correct | leave | by:route-meta
   TEXT: description: `All ${teamScores.length} MLB, MLS, and WNBA teams ranked by ${YEAR} promo schedule strength.`,
   WHY: Prod-verified '"description":"All 75 MLB, MLS, and WNBA teams ranked by 2026 promo schedule strength.' Rankings surface, scored leagues only; CFB is never scored.
src/app/team-rankings/page.tsx:221 | /team-rankings | /team-rankings capsule | dom | gate=redesign | mixed<teamScores.length from getAllTeamScores() (75 live)> | L=MLB, MLS, WNBA | C={teamScores.length} (75) | pro-only-correct | leave | by:dom-copy
   TEXT: All {teamScores.length} scored teams across MLB, MLS, and WNBA are ranked below by promo schedule strength
   WHY: Rankings are pro-only and scored-league-only (75 of 169; CFB never scored). Legacy twin at 282-288. FAQ line 79 explains NBA/NHL exclusion.
src/app/team-rankings/page.tsx:281 | /team-rankings | /team-rankings intro paragraph body prose, spans 281-289 | dom | gate=both | mixed<teamScores.length> | L=MLB, MLS, WNBA | C=teamScores.length (derived, 75 | pro-only-correct | leave | by:sweep
   TEXT: All {teamScores.length} scored teams across MLB, MLS, and WNBA are ranked below by promo schedule strength
   WHY: Rankings surface; NBA/NHL/NFL/CFB are never scored, so the three-league framing is exactly right and must not gain CFB. Found list covers 31/35/64/74/79/133/221 but not this paragraph.
src/app/team-rankings/page.tsx:288 | /team-rankings | /team-rankings intro paragraph, filter sentence | dom | gate=both | hardcoded<> | L=MLB, MLS, WNBA | C=none | pro-only-correct | leave | by:sweep
   TEXT: hot-promo bonus. Filter by league to compare within MLB, MLS, or WNBA only.{offseasonNote}
   WHY: Mirrors the league-filter chip set (src/components/scoring/league-filter.tsx:7-12: All/MLB/MLS/WNBA). Pro-only rankings surface.
src/app/teams/page.tsx:16 | /teams | LEAGUE_SET constant feeding /teams metadata.title and metadata.description (found items 24/25 are bu | meta | gate=both | hardcoded<> | L=MLB, NBA, NHL, NFL, MLS, WNBA | C=none (teamCount is derived fro | pro-only-correct | leave | by:sweep
   TEXT: const LEAGUE_SET = 'MLB, NBA, NHL, NFL, MLS, and WNBA';
   WHY: This is the source constant behind the already-found /teams title/description. The page describes pro sports teams (getAllTeams() is the pro collection; CFB is a separate collection), so the six-league list is correct. Any edit to the found lines 24/25 must be made here, not inline. Prod curl confirms it renders as 'Browse all 169 pro sports teams across MLB, NBA, NHL, NFL, MLS, and WNBA in 2026.'
src/app/teams/page.tsx:24 | /teams | /teams metadata.title (renders with the '| PromoNight' template) | meta | gate=both | derived<getAllTeams().length> | L=pro sports | C=${teamCount} (169) | pro-only-correct | leave | by:tagline
   TEXT: title: `All ${teamCount} Pro Sports Teams · Promo Calendars by League`,
   WHY: Says 'Pro Sports Teams' explicitly so the 169 is honest; listed with the disputed :25 description because the page body exposes a CFB chip (teams-browser.tsx:26-30) that routes to /cfb.
src/app/teams/page.tsx:25 | /teams | /teams meta description (LEAGUE_SET constant at line 16; hero eyebrow 'Browse teams' + h1 'FIND YOUR | meta | gate=both | mixed<teamCount from getAllTeams(); LEAGUE_SET hardcoded 'MLB, NBA, NHL, NFL> | L=MLB, NBA, NHL, NFL, MLS, WNBA | C=${teamCount} (169) | description-slot | leave | by:tagline
   TEXT: description: `Browse all ${teamCount} pro sports teams across ${LEAGUE_SET} in ${SEASON_YEAR}. Star your teams and get one weekly email with their ${PROMO_TYPES}.`,
   WHY: Pro-team directory description; pro-only by design and not a tagline slot.
src/app/teams/page.tsx:66 | /teams | /teams hero lede | dom | gate=redesign | mixed<teams.length from getAllTeams(); LEAGUE_SET = 'MLB, NBA, NHL, NFL, MLS> | L=MLB, NBA, NHL, NFL, MLS, WNBA | C={teams.length} (169) | pro-only-correct | leave | by:dom-copy
   TEXT: {teams.length} teams across {LEAGUE_SET}. Star your teams to follow their promos.
   WHY: Pro team browser. CFB appears only as a chip that routes out to /cfb (teams-browser.tsx:26-29, CFB never in the All total), so the sentence is right as is.
src/app/teams/page.tsx:89 | /teams | /teams lede | dom | gate=legacy | mixed<teams.length; LEAGUE_SET> | L=MLB, NBA, NHL, NFL, MLS, WNBA | C={teams.length} (169) | pro-only-correct | leave | by:dom-copy
   TEXT: Browse {teams.length} teams across {LEAGUE_SET}. Star your teams to follow their promos.
   WHY: Legacy twin of line 66.
src/app/terms/page.tsx:19 | /terms | /terms service description paragraph | dom | gate=n/a | hardcoded<> | L="professional sports teams" | C=none | ambiguous | consider | by:dom-copy
   TEXT: <p>PromoNight is a website and mobile application that aggregates and displays promotional event information (giveaways, theme nights, food deals, and other fan experiences) for professional sports teams. The site and app are provided <stro
   WHY: Describes the service as promo information for professional sports teams only. That is right for promos, but the site now also publishes college football schedules, venues and rivalries, which this legal description does not mention. Not a CFB-rule violation (nothing is folded into a pro count); a scope-completeness question for the terms page.
src/app/venues/[slug]/page.tsx:46 | /venues/[slug] (222 buildings) | generateMetadata description = venueHubDescription(hub) (src/lib/venue-hub.ts:871); title = venueHub | meta | gate=both | derived<getVenueHub(slug); isCfbOnlyHub branch in venueHubTitle> | L=none | C=none | already-correct-with-cfb | leave | by:route-meta
   TEXT: title: `${short} Bag Policy, Parking & Food | ${SEASON_YEAR} Gameday Guide` (CFB-only hub variant: `${short} Parking, Tailgating & Bag Policy | ...`); description lead e.g. `What size bag can you bring into ${short}? ${bagAnswer(hub, dims)}
   WHY: Per-building, no league list. The title template already distinguishes CFB-only buildings (tailgating wording), which is the venue layer legitimately including CFB.
src/app/venues/bag-policies/page.tsx:173 | /venues/bag-policies | /venues/bag-policies stat sentence | dom | gate=redesign | derived<deriveBagStats(groups)> | L=none in DOM sentence (FAQs at src/lib/ve | C={stats.total} parks (MLB only) | pro-only-correct | leave | by:dom-copy
   TEXT: {stats.clearRequired + stats.noBags} of the {stats.total} parks require a clear bag or keep bags out entirely, and{' '} {stats.sizeLimited} more cap the size. Rules vary by park, so check your stadium below before you pack.
   WHY: MLB-only surface. buildBagPolicyFaqs answers ("${s.clearRequired} of the ${s.total} MLB ballparks require a clear bag...") feed both the DOM and FAQPage JSON-LD via venue-bag-jsonld.ts:45-49.
src/app/venues/page.tsx:25 | /venues | /venues metadata.description (also og:description via pageOpenGraph) | meta | gate=both | hardcoded<> | L=MLB, NFL, MLS, WNBA, NBA, NHL, college f | C=none | already-correct-with-cfb | leave | by:tagline
   TEXT: const DESCRIPTION = `Bag policies, parking, gate times, and transit for MLB, NFL, MLS, WNBA, NBA, NHL, and college football stadiums and arenas, verified for the ${SEASON_YEAR} season.`;
   WHY: A venues surface legitimately includes college football and does; note the league order (MLB, NFL, MLS, WNBA, NBA, NHL) differs from the canonical about-copy order (MLB, NBA, NFL, NHL, MLS, WNBA) if the workstream wants one ordering.
src/app/venues/page.tsx:45 | /venues | /venues index lede | dom | gate=redesign | derived<entries.length from the venue index> | L=none in lede; section headings from VENU | C={entries.length} guides | already-correct-with-cfb | leave | by:dom-copy
   TEXT: {entries.length} verified gameday guides for the {SEASON_YEAR} season: bag policies, parking, gate times, and transit, one page per building. Pick a venue for the full rundown, or jump to its league below.
   WHY: Venues is a what-the-site-covers surface where CFB legitimately belongs; it appears as its own section heading (venue-index.ts:35), never folded into a league count. The six-league + college football list at line 25 is the metadata DESCRIPTION, out of scope here.
src/app/venues/page.tsx:55 | /venues | /venues bag-policy aggregator link label | dom | gate=redesign | hardcoded<> | L=MLB | C=none | pro-only-correct | leave | by:dom-copy
   TEXT: MLB Bag Policy {BAG_SEASON}: every ballpark&apos;s rule, compared
   WHY: Single-league feature link.
src/app/wnba/page.tsx:38 | /wnba | DESCRIPTION const feeding metadata.description; TITLE line 37 = 'WNBA Promotions & Giveaways ${YEAR} | meta | gate=both | mixed<YEAR = 2026; '15 teams' literal> | L=WNBA | C=15 teams (hardcoded) | pro-only-correct | leave | by:route-meta
   TEXT: Every WNBA team's ${YEAR} promo schedule in one place: theme nights, jersey giveaways, bobblehead nights, and more across all 15 teams, grouped by conference and refreshed through the season.
   WHY: Correctly single-league hub.
src/app/wnba/page.tsx:51 | /wnba | FAQPage answer: What WNBA promotions are happening this week? | faq-jsonld | gate=n/a | hardcoded<> | L=WNBA | C=15 WNBA teams | pro-only-correct | leave | by:jsonld
   TEXT: 'PromoNight tracks every giveaway, theme night, and bobblehead announced by all 15 WNBA teams. The this-week rail on this page lists the promotions scheduled at WNBA arenas over the next seven days, and it updates as teams add dates.'
   WHY: Finder gave the MLB hub FAQ a row (mlb/page.tsx:51) but folded the WNBA and MLS equivalents into rationale. Hand-typed 15 matches the probe (WNBA 15). FAQS shared by HubFaq (L156) and AggregatorJsonLd (L98), one constant.
src/app/wnba/page.tsx:105 | /wnba | /wnba hub subtitle | dom | gate=redesign | hardcoded<> | L=WNBA | C=all 15 | pro-only-correct | leave | by:dom-copy
   TEXT: subtitle="Every theme night, jersey giveaway, and bobblehead across all 15 WNBA teams, grouped by conference."
   WHY: Matches live (15). FAQ line 51 and intro 143 repeat it; shared FAQ array feeds DOM + JSON-LD.
src/app/world-cup/page.tsx:17 | /world-cup | metadata.description; title line 15 = 'World Cup 2026: 11 US Host Cities & MLB Ballparks'; openGraph | meta | gate=both | hardcoded<> | L=MLB | C=11 host cities | pro-only-correct | leave | by:route-meta
   TEXT: A fan guide to all 11 US World Cup 2026 host cities, June 11 to July 19. Find the local MLB ballpark in each city, the home games that line up with the World Cup, giveaway and theme nights, plus tickets, parking, and hotels.
   WHY: Correctly single-league (MLB ballpark overlay on World Cup host cities). No CFB relevance.
src/app/world-cup/page.tsx:75 | /world-cup | CollectionPage.name + description | jsonld | gate=n/a | hardcoded<> | L=MLB | C=11 host cities | pro-only-correct | leave | by:jsonld
   TEXT: name: 'World Cup 2026: 11 US Host Cities & MLB Ballparks', description: 'All 11 US World Cup 2026 host cities mapped to their local MLB ballparks and home games, June 11 to July 19, 2026.'
   WHY: Count is host cities, not teams or leagues. MLB-only by design.
src/components/app-push-pitch.tsx:30 | /{sport}/{team} | team page app-reminder pitch heading (body at 33: 'The PromoNight app is a free download, and PromoN | dom | gate=both | mixed<teamName prop> | L=none | C=none | app-copy | leave | by:tagline
   TEXT: Want a reminder the morning of every {teamName} promo?
   WHY: App pitch on 169 team pages, not a tagline slot; listed because the finder's app-copy sweep stopped at team-content-sections.tsx.
src/components/browse-collections.tsx:43 | / (gate-off) | legacy homepage Browse Collections section lede under h2 'BROWSE COLLECTIONS' | dom | gate=legacy | mixed<yearSuffix prop> | L=pro sports | C=none | other | leave | by:tagline
   TEXT: Every promo across pro sports, sliced by what it is. Pick a category to see the full {yearSuffix} list.
   WHY: Section lede in the 'every promo' family on the gate-off homepage; pro-only by construction ('pro sports'); not a tagline slot.
src/components/cfb/CfbConferenceSubRow.tsx:31 | / and /teams (after tapping the CFB chip) | CFB chip sub-row lede in the pro team browser (home + /teams) | dom | gate=both | hardcoded<> | L=college football | C=none | already-correct-with-cfb | consider | by:dom-copy
   TEXT: College football lives in its own hub [em dash in source] pick a conference to jump in.
   WHY: Framing is correct (CFB separate from the pro grid). Contains an em dash in user-facing copy, which the house rule forbids; swap for a colon or period while brand copy is being touched.
src/components/cfb/hub/CfbTodaySlot.tsx:19 | /cfb | /cfb hub today-slot bridge copy | dom | gate=redesign | hardcoded<> | L="the pro leagues" (unnamed) vs college f | C=none | already-correct-with-cfb | leave | by:dom-copy
   TEXT: College football&rsquo;s promotions are its rivalry and theme Saturdays. </span>{' '} This week&rsquo;s games are below. The pro leagues run a promo board that refreshes every day.
   WHY: Prod-verified. Explicitly separates CFB (no promo board) from the pro leagues (daily promo board). Reference-quality wording for the CFB rule outside about-copy.
src/components/cfb/hub/CfbTodaySlot.tsx:28 | /cfb | /cfb hub today-slot link label | dom | gate=redesign | hardcoded<> | L="pro" | C=none | already-correct-with-cfb | leave | by:dom-copy
   TEXT: Today&rsquo;s pro promos →
   WHY: Links /promos/today and labels it pro, keeping CFB out of the promo surface.
src/components/follow/FollowCTA.tsx:52 | /, /[sport]/[team], /promos/* aggregator pages | FollowCTA generic sub line (used on HomePageV2, RedesignTeamPage and aggregator-layout); team varian | dom | gate=both | hardcoded<> | L=none | C=none | other | leave | by:sweep
   TEXT: : 'Get every giveaway, theme night, and food deal for the teams you follow in one free email a week.');
   WHY: Email-capture CTA copy in the 'every giveaway' family, not the tagline and not a league list. Not affected by the CFB rule (followed teams are pro only). Listed so the 'Every ...' family is complete; FollowFooterCTA.tsx:31 was found but this sibling was not.
src/components/follow/FollowFooterCTA.tsx:31 | every route (prod) | footer brand block email CTA (redesign footer only), eyebrow 'Free weekly email' at line 23 | dom | gate=redesign | hardcoded<> | L=none | C=none | other | leave | by:tagline
   TEXT: Get every giveaway in your inbox →
   WHY: An email-capture CTA sitting inside the footer brand block; it has its own job and is not a tagline slot.
src/components/follow/TeamStarPicker.tsx:82 | /follow, /my-teams | team star picker search placeholder default (rendered on /follow and /my-teams pickers) | dom | gate=both | hardcoded<> | L=none | C=169 teams | pro-only-correct | consider | by:tagline
   TEXT: searchPlaceholder = 'Search 169 teams…',
   WHY: Hardcoded 169 as a prop default while the component receives the teams array; pro-only by construction; hardcoded-count item.
src/components/footer-team-sitemap.tsx:34 | every route (gate-off) | legacy footer expandable team sitemap heading (footer.tsx:110 renders it with a teams prop) | dom | gate=legacy | hardcoded<> | L=none | C=169 teams | pro-only-correct | consider | by:tagline
   TEXT: All 169 teams
   WHY: Hardcoded 169 in the gate-off footer while the component receives teams as a prop it could count; pro-only by construction; league-list workstream (hardcoded-count) item.
src/components/footer.tsx:22 | every route (gate-off) | legacy footer brand descriptor paragraph under the PROMO/NIGHT wordmark | dom | gate=legacy | hardcoded<> | L=MLB, NBA, NHL, NFL, MLS, WNBA | C=169 teams | description-slot | consider | by:tagline
   TEXT: Track every giveaway, theme night, food deal, and promotion across 169 teams in MLB, NBA, NHL, NFL, MLS, and WNBA.
   WHY: The paragraph is a coverage descriptor, not a tagline; if the brand wants the tagline in the footer it should be ADDED as a short line under the wordmark rather than replacing this sentence, and the hardcoded '169' plus league list (every other homepage count is derived) belongs to the league-list workstream; pro-only promo claim, must not gain CFB.
src/components/homepage-json-ld.tsx:65 | / | homepage FAQ 'What is PromoNight?' answer (visible FAQ + FAQPage schema on both variants) | faq-jsonld | gate=both | derived<homepageCountsFromTeams(allTeams)> | L=derived list | C=${c.teamCount} (169) | description-slot | consider | by:tagline
   TEXT: `PromoNight is a free mobile app that tracks every promotional event at professional sports games across ${leagueList(c.leagueBreakdown)}. It shows giveaway nights, theme nights, food deals, and kids events for all ${c.teamCount} teams in o
   WHY: Not a tagline slot; flagged only because it frames PromoNight as 'a free mobile app' while /about (about-copy.ts) now frames the website as the product, a voice drift for the copy workstream, not the tagline one; pro-only and correct on the CFB rule.
src/components/homepage-json-ld.tsx:70 | / | homepage FAQ 'How many teams does PromoNight cover?' answer (visible FAQ + FAQPage schema, both vari | faq-jsonld | gate=both | derived<homepageCountsFromTeams(allTeams)> | L=derived six, split by league | C=${c.teamCount} (169) | ambiguous | consider | by:tagline
   TEXT: `PromoNight tracks promotional schedules for ${c.teamCount} teams across ${numberWord(c.leagueCount)} professional sports leagues: ${leagueSplit(c.leagueBreakdown)}.`,
   WHY: The QUESTION asks what PromoNight covers overall, the ANSWER is promo-scoped and omits the 87 college programs, while the /about twin (about-copy.ts:332) adds the clause; strictly pro-only-correct as written, but a user reading 'how many teams does PromoNight cover' gets 169 with no mention of CFB, so the league-list workstream should rule whether the homepage FAQ matches /about.
src/components/homepage-json-ld.tsx:75 | / | homepage FAQ answer 3 (Is PromoNight free?) rendered by homepage-faq.tsx | faq-dom | gate=both | hardcoded<> | L=none | C="all teams" | pro-only-correct | consider | by:dom-copy
   TEXT: 'Yes, PromoNight is free to download and use. The free version lets you track all teams and browse all promos. PromoNight Pro ($9.99/year or $5.99/season per sport) adds a reminder that the app schedules on your device for the morning of ea
   WHY: Same shared buildHomepageFaqs array (DOM + FAQPage JSON-LD). "track all teams" is attributed to the app, which about-copy:256 scopes to four leagues; same app-scope caveat the finder raised on answers 1 and 2, missed here.
src/components/homepage-json-ld.tsx:85 | / | homepage FAQ 'How does PromoNight get its promo data?' answer (visible FAQ + FAQPage schema) | faq-jsonld | gate=both | hardcoded<> | L=MLB, WNBA, MLS | C=none | pro-only-correct | leave | by:tagline
   TEXT: 'PromoNight aggregates promotional schedules directly from official team sources, including team websites, ticketing platforms, and press releases. MLB, WNBA, and MLS schedules are rechecked weekly in season, and other leagues are updated a
   WHY: Cadence claim naming the three scanned leagues; verified mechanisms per project memory; not a tagline slot and must not gain CFB.
src/components/homepage-json-ld.tsx:100 | / | Organization.@id / name / sameAs (homepage node) | jsonld | gate=both | hardcoded<> | L=none | C=none | other | leave | by:jsonld
   TEXT: '@id': 'https://www.getpromonight.com/#organization', name: 'PromoNight', url: 'https://www.getpromonight.com', logo: 'https://www.getpromonight.com/icon.png', ... email: 'hello@getpromonight.com', sameAs: ['https://x.com/promo_night_app', 
   WHY: The Organization node is emitted on TWO routes with the same @id: the homepage (this file, rendered by legacy src/app/page.tsx:339 and redesign HomePageV2.tsx:112) and /about (src/app/about/page.tsx:155-166, which adds legalName and founder but carries NO description). /about AboutPage.mainEntity and Person.worksFor both reference this @id, so the two nodes merge into one entity. No slogan, alternateName, or knowsAbo
src/components/homepage-json-ld.tsx:101 | / | Organization.slogan (ABSENT today) | jsonld | gate=both | hardcoded<> | L=none | C=none | tagline-slot | consider | by:jsonld
   TEXT: (no slogan property exists on either Organization node; name: 'PromoNight' is the adjacent line)
   WHY: schema.org Organization accepts slogan. This is the one JSON-LD field where the new tagline 'Find the game, plan the night.' could live without touching description. If added, add it once on the homepage node (or on both nodes identically, since they share @id and merge). Do not paste the tagline into description or the WebSite node.
src/components/homepage-json-ld.tsx:110 | / | homepage Organization.description (both gate variants render HomepageJsonLd; prod-confirmed) | jsonld | gate=both | derived<homepageCountsFromTeams(allTeams)> | L=derived list (renders MLB, NBA, NFL, NHL | C=${counts.teamCount} (169) | description-slot | leave | by:tagline
   TEXT: `PromoNight tracks every giveaway, theme night, food deal, and promotion across ${counts.teamCount} professional sports teams in ${leagueList(counts.leagueBreakdown)}.`
   WHY: Schema description, pro-only promo coverage, fully derived; not a tagline slot and must not gain CFB.
src/components/homepage-json-ld.tsx:123 | / | homepage WebSite.description | jsonld | gate=both | derived<homepageCountsFromTeams(allTeams)> | L=none | C=${counts.teamCount} (169) | description-slot | leave | by:tagline
   TEXT: `Track every giveaway, theme night, food deal, and promotion across ${counts.teamCount} professional sports teams.`
   WHY: Schema description doing its own job; derived and pro-only; not a tagline slot.
src/components/hub/HubHero.tsx:50 | /mlb, /wnba, /mls, /nfl, /promos/* | league hub / promo collection hero eyebrow slot (callers pass 'MLB League Hub', 'WNBA League Hub', ' | dom | gate=redesign | derived<eyebrow prop per route> | L=per hub | C=none | other | leave | by:tagline
   TEXT: <p className="font-rd text-[11px] font-semibold uppercase tracking-[0.14em] text-white/55"> {eyebrow} </p>
   WHY: Page-scoped eyebrows naming the hub, never the brand line; no tagline belongs in this slot.
src/components/indie-developer-block.tsx:40 | / (gate-off) | legacy homepage founder prose | dom | gate=legacy | mixed<teamCount prop derived; league list hardcoded> | L=MLB, NBA, NHL, NFL, MLS, WNBA | C={teamCount} (169) | other | leave | by:tagline
   TEXT: So I spent a few months building it. PromoNight started with just the Twins and now tracks every giveaway, theme night, food deal, and kids event across all {teamCount} teams in MLB, NBA, NHL, NFL, MLS, and WNBA. If you&apos;ve ever shown u
   WHY: Founder prose, not a tagline slot; pro-only promo coverage and correct on the CFB rule (hardcoded league list is a league-list workstream note, not a tagline one).
src/components/my-teams-view.tsx:417 | /my-teams | /my-teams empty-state CTA link to /teams (redesign; legacy twin at line 453 is byte-identical text) | dom | gate=both | hardcoded<> | L=none | C=169 teams | pro-only-correct | consider | by:tagline
   TEXT: Browse all 169 teams →
   WHY: Hardcoded 169 in a client component on both variants; pro-only by construction (starring is pro-only); hardcoded-count item for the league-list workstream.
src/components/my-teams-view.tsx:453 | /my-teams | /my-teams empty-state browse link | dom | gate=legacy | hardcoded<> | L=none | C=169 | pro-only-correct | consider | by:dom-copy
   TEXT: Browse all 169 teams →
   WHY: Legacy twin of line 417.
src/components/promos-today/helpers.ts:75 | /promos/today | /promos/today hero answer sentence (DailyBoardHero answer prop) | dom | gate=redesign | derived<buildAnswerSentence(today); leaguePart = joinList(groupPromosByLeague(> | L=only leagues with a promo today (prod to | C=today's game count | pro-only-correct | leave | by:dom-copy
   TEXT: return `${n} ${noun} today ${verb} promotions across ${leaguePart}: ${joinList(descriptors)}${tail}.`;
   WHY: This is the actual DOM league copy on the today board; the finder's today entry (page.tsx:97) points at the JSON-LD ItemList label instead. Data-driven and cannot name CFB because cfbSchools never carry promos. No change.
src/components/redesign/AppDownloadBlock.tsx:47 | / | redesign homepage app block eyebrow (mono uppercase with red dot, same styling as the HomeHero eyebr | dom | gate=redesign | hardcoded<> | L=none | C=none | app-copy | leave | by:tagline
   TEXT: <p className="flex items-center gap-2 font-mono text-[10.5px] font-semibold uppercase tracking-[0.22em] text-white/45"> <span aria-hidden className="h-1.5 w-1.5 flex-none rounded-full bg-rd-red" /> Never miss a promo night </p>
   WHY: Looks like the hero eyebrow but is the app section's own kicker above the h2 'Get promo reminders for your teams.' (line 49-51); the brand tagline does not belong on the app pitch.
src/components/redesign/AppDownloadBlock.tsx:53 | / | homepage app download block body | app-copy | gate=redesign | hardcoded<> | L=none | C=none | pro-only-correct | leave | by:dom-copy
   TEXT: PromoNight Pro sends a reminder the morning of every promo for the teams you follow. The app is a free download and everything else lives here on the web.
   WHY: No league list or count. Eyebrow at line 47 is "Never miss a promo night" and h2 at 50 is "Get promo reminders for your teams."; neither is the tagline slot.
src/components/redesign/BrandBar.tsx:45 | every route | redesign nav wordmark link (legacy twin nav.tsx:37); neither variant renders a tagline in the nav | dom | gate=both | hardcoded<> | L=none | C=none | other | leave | by:tagline
   TEXT: aria-label="PromoNight home"
   WHY: Nav carries the wordmark only; no tagline slot exists in either chrome variant and none should be added there.
src/components/redesign/BrandBarMobileMenu.tsx:104 | every page (mobile) | mobile nav sheet section heading over the hub list | dom | gate=redesign | hardcoded<> | L=none (list below it is LEAGUE_HUBS incl. | C=none | ambiguous | consider | by:dom-copy
   TEXT: League hubs
   WHY: The list under this heading includes the CFB chip, so CFB is presented as a league. Low stakes; only worth touching if the aria-label fix at league-hubs.ts:56 is being made anyway.
src/components/redesign/ExploreCard.tsx:39 | /[sport]/[team] | team page Explore card league link label | dom | gate=redesign | derived<team.league> | L=the page's own league | C=none | pro-only-correct | leave | by:dom-copy
   TEXT: { href: `/teams?league=${team.league}`, label: `All ${team.league} teams`, Icon: IconList },
   WHY: Finder said ExploreCard carries no league text; it does, derived per team. Correct.
src/components/redesign/Footer.tsx:51 | every page | footer Discover column link label | dom | gate=redesign | hardcoded<> | L=college football | C=none | already-correct-with-cfb | leave | by:dom-copy
   TEXT: { label: 'College football rivalries', href: '/cfb/rivalries' },
   WHY: CFB is presented as its own discovery link, separate from the pro brand line. Legacy footer.tsx has no CFB link at all (Browse column only).
src/components/redesign/Footer.tsx:98 | every route (prod) | redesign footer brand descriptor paragraph under the PROMO/NIGHT wordmark (prod-confirmed) | dom | gate=redesign | hardcoded<> | L=MLB, NBA, NHL, NFL, MLS, WNBA | C=169 teams | description-slot | consider | by:tagline
   TEXT: Every giveaway, theme night, food deal, and promotion across 169 teams in MLB, NBA, NHL, NFL, MLS, and WNBA.
   WHY: Same as the legacy footer: a descriptor slot, not a tagline slot; a tagline line could be added between the wordmark (line 93-96) and this paragraph, but the sentence itself is a pro-only coverage claim with a hardcoded 169 that belongs to the league-list workstream and must not gain CFB.
src/components/redesign/Footer.tsx:99 | every route (global chrome, including /cfb pages; prod curl of /cfb shows '169 teams' in the served HTML) | footer brand line, second JSX text line (continuation of found item Footer.tsx:98) | dom | gate=redesign | hardcoded<> | L=MLB, NBA, NHL, NFL, MLS, WNBA | C=169 teams (on line 98) | pro-only-correct | leave | by:sweep
   TEXT: in MLB, NBA, NHL, NFL, MLS, and WNBA.
   WHY: Continuation line of the found footer brand sentence 'Every giveaway, theme night, food deal, and promotion across 169 teams'. It describes promo coverage, so it is pro-only and must not gain the CFB clause. Listed so a dedupe by file:line does not miss that an edit to 98 also spans 99.
src/components/redesign/FounderBlock.tsx:82 | / | redesign homepage founder prose (byline at 89-94 reads 'Matt Kovalik · Founder, PromoNight · How we  | dom | gate=redesign | derived<teamCount, leagues props from homepageCounts> | L=derived list | C={teamCount} (169) | other | leave | by:tagline
   TEXT: So I spent a few months building it. PromoNight started with just the Twins and now tracks every giveaway, theme night, food deal, and kids event across all {teamCount}{' '} teams in {joinLeagues(leagues)}. If you&apos;ve ever shown up to a
   WHY: Founder prose, fully derived, pro-only; no tagline slot.
src/components/redesign/FounderBlock.tsx:83 | / | redesign homepage founder block prose (text continues on line 84) | dom | gate=redesign | derived<teamCount and leagues props from HomePageV2:249 (homepageCounts.league> | L=six leagues, derived, ordered by size | C={teamCount} | pro-only-correct | leave | by:route-meta
   TEXT: tracks every giveaway, theme night, food deal, and kids event across all {teamCount}{' '} teams in {joinLeagues(leagues)}. If you&apos;ve ever shown up to a game and found out
   WHY: Derived league list; promo coverage; correct.
src/components/redesign/Hero.tsx:48 | /{sport}/{team} | redesign team page hero eyebrow slot (RedesignTeamPage.tsx:146-160 passes '{league} · {division}' wi | dom | gate=both | derived<team.league, team.division> | L=per team | C=none | other | leave | by:tagline
   TEXT: <p className="font-rd text-[11px] uppercase tracking-[0.14em] text-white/60"> {eyebrow} </p>
   WHY: Team-scoped eyebrow, not a brand tagline slot.
src/components/redesign/HomeHero.tsx:54 | / | redesign homepage hero eyebrow (mono uppercase <p> with red dot, above the h1) | dom | gate=redesign | hardcoded<> | L=none | C=none | tagline-slot | change | by:tagline
   TEXT: <p className="flex items-center gap-2 font-mono text-[11px] uppercase tracking-[0.18em] text-white/45"> <span className="h-1.5 w-1.5 rounded-full bg-rd-red" aria-hidden /> Every promo at every game </p>
   WHY: This is the production tagline slot (prod HTML confirmed the eyebrow renders this text above a separate h1); the eyebrow is a short brand line, exactly where 'Find the game, plan the night.' belongs, and the h1 on line 56-58 is untouched by the swap.
src/components/redesign/HomeHero.tsx:57 | / | redesign homepage h1 | dom | gate=redesign | hardcoded<> | L=none | C=none | other | leave | by:tagline
   TEXT: <h1 className="rd-display mt-4 max-w-3xl text-4xl uppercase leading-[0.95] text-white md:text-6xl"> Find the games worth going to. </h1>
   WHY: The h1 is a separate element from the eyebrow tagline and stays per the brief; prod renders it verbatim.
src/components/redesign/HomeHero.tsx:60 | / | redesign homepage hero lede under the h1 | dom | gate=redesign | derived<teamCount (getAllTeams().length), leagueCount (homepageCountsFromTeams> | L={leagueCount} leagues (derived) | C={teamCount} teams (derived) | description-slot | leave | by:tagline
   TEXT: Every giveaway, theme night, food deal and family event across {teamCount} teams in{' '} {leagueCount} leagues, pulled from official team sources.
   WHY: Promo-coverage description, pro-only by construction (CFB is not in getAllTeams); not a tagline slot and must not gain CFB.
src/components/redesign/HomePageV2.tsx:122 | / | redesign homepage StubRail section eyebrow (mono red-dot kicker, same styling family as the HomeHero | dom | gate=redesign | hardcoded<> | L=none | C=none | other | leave | by:tagline
   TEXT: eyebrow="Happening now"
   WHY: Section-scoped kickers rendered by StubRail.tsx:73, not brand lines; listed so a global eyebrow sweep does not touch them.
src/components/redesign/HomePageV2.tsx:215 | / | redesign Find Your Team section lede | dom | gate=redesign | derived<teamCount prop = allTeams.length (src/app/page.tsx:322)> | L=none | C={teamCount} (169) | pro-only-correct | leave | by:dom-copy
   TEXT: Full promo calendars for all {teamCount} teams.
   WHY: "Promo calendars" is a promo-coverage claim; CFB has no promos so it must not be added here. Prod-verified rendering.
src/components/redesign/RedesignTeamPage.tsx:151 | /[sport]/[team] | team page hero league-hub link aria-label | dom | gate=redesign | derived<team.league, gated on leagueHubHref (registry live flag)> | L=the page's own league | C=none | pro-only-correct | leave | by:dom-copy
   TEXT: aria-label={`${team.league} promotions and giveaways hub`}
   WHY: Only pro team pages render this; CFB school pages use a different template, so the hub is always a promo hub here.
src/components/redesign/home-category-tiles.ts:64 | / | redesign homepage category tile blurb for the Today tile (rendered on / below the hero) | dom | gate=redesign | hardcoded<> | L=none | C=none | other | consider | by:tagline
   TEXT: blurb: "Every promo at today's games",
   WHY: Not a tagline slot, but it is the same 'Every promo at ... games' construction as the retiring eyebrow, on the same page, a few hundred pixels below where 'Find the game, plan the night.' will sit; decide whether the 'every promo' phrasing family survives next to the new line (docs/homepage-redesign-target.html:784 carries the same blurb).
src/components/scoring/league-filter.tsx:7 | /best-promos, /best-promos/bobbleheads, /team-rankings | league filter chips on /best-promos, /best-promos/bobbleheads, /team-rankings (OPTIONS array, lines  | dom | gate=both | hardcoded<> | L=MLB, MLS, WNBA | C=none | pro-only-correct | leave | by:sweep
   TEXT: const OPTIONS: readonly FilterChipOption<LeagueFilterValue>[] = [ { value: 'All', label: 'All' }, { value: 'MLB', label: 'MLB' }, { value: 'MLS', label: 'MLS' }, { value: 'WNBA', label: 'WNBA' }, ];
   WHY: Closed value set for scored leagues only; the comment at line 20 states NBA/NHL are intentionally absent. CFB must never appear here.
src/components/team-content-sections.tsx:115 | /{sport}/{team} | team page 'How do I find {fullName} promotional events?' plug paragraph (redesign; legacy twin at li | dom | gate=both | mixed<fullName, year, venueName props> | L=none | C=none | app-copy | leave | by:tagline
   TEXT: PromoNight is a free app that tracks every {fullName} giveaway, theme night, food deal, and kids event in one place. Download PromoNight on iOS or Android to browse the full {year} promo calendar for free, and add PromoNight Pro for a morni
   WHY: App plug on 169 team pages; not a tagline slot (the app-first framing versus /about is a copy-workstream note only).
src/components/team-content-sections.tsx:195 | /[sport]/[team] (imported by both legacy page.tsx and RedesignTeamPage.tsx) | team-page 'How do I find {team} promotional events?' app pitch paragraph (line 115 on this file is a | dom | gate=both | mixed<fullName, year, venueName> | L=none | C=none | app-copy | leave | by:sweep
   TEXT: PromoNight is a free app that tracks every {fullName} giveaway, theme night, food deal, and kids event in one place. Download PromoNight on iOS or Android to browse the full {year} promo calendar for free, and add PromoNight Pro for a morni
   WHY: Brand claim sentence ('PromoNight is a free app that tracks every ...') with no league list or count, so it is unaffected by the CFB rule and is not a tagline slot. Listed because it is a brand-claim surface no finder covered.
src/components/team-related-aggregators.tsx:26 | /[sport]/[team] | team page related-collections card labels | dom | gate=both | hardcoded<> | L="pro sports" | C=none | pro-only-correct | leave | by:dom-copy
   TEXT: label: 'Every bobblehead across pro sports',
   WHY: Promo collections are pro-only; line 40 "Every theme night in pro sports" and line 48 hint "All leagues" same.
src/components/team-related-aggregators.tsx:40 | /[sport]/[team] (imported by both app/[sport]/[team]/page.tsx and RedesignTeamPage.tsx) | team-page 'See it across all teams' link label (theme nights tile; line 26 bobblehead label and 58 h | dom | gate=both | hardcoded<> | L='pro sports' (no list) | C=none | pro-only-correct | leave | by:sweep
   TEXT: label: 'Every theme night in pro sports',
   WHY: Links to /promos/theme-nights, a promo collection; 'pro sports' framing is correct and must not gain CFB. Same family as found line 26.
src/components/team-related-aggregators.tsx:48 | /[sport]/[team] | team-page related-aggregators hint text under 'Hot promos this week' | dom | gate=both | hardcoded<> | L='All leagues' (no list) | C=none | ambiguous | leave | by:sweep
   TEXT: hint: 'All leagues',
   WHY: 'All leagues' on a promo link is read by the visitor as all pro leagues; since /promos/this-week has no CFB rows the phrase is not wrong today, but it is the kind of unqualified 'all' that would become misleading if a reader assumed college football was included. Flagging for awareness only.
src/components/team-related-aggregators.tsx:58 | /[sport]/[team] | team page related-collections section heading (light variant; dark twin at line 90) | dom | gate=both | hardcoded<> | L=none | C="ALL TEAMS" | pro-only-correct | leave | by:dom-copy
   TEXT: SEE IT ACROSS ALL TEAMS
   WHY: Heads links to the pro promo collections; unnamed, cannot drift.
src/components/venue-hub/VenueHubView.tsx:167 | /venues/[slug] | venue hub FAQ answers (per building) | faq-dom | gate=redesign | derived<bagFaqAnswers(hub, tenantExceptions) in src/lib/venue-hub.ts:776> | L=none | C=none | pro-only-correct | leave | by:dom-copy
   TEXT: if (bag.size) faqs.push({ question: `What size bag can I bring into ${short}?`, answer: bag.size });
   WHY: Venue FAQs are per-building facts (bag, food, gates, parking); no league list or site-wide count anywhere in them. Same faqs array goes to VenueHubJsonLd (FAQPage).
src/components/zero-promo-fallback.tsx:43 | /wnba/{team} (zero-promo state) | WNBA zero-promo team page fallback paragraph (used by both [sport]/[team]/page.tsx and RedesignTeamP | dom | gate=both | mixed<venueName prop; 'six leagues' hardcoded> | L=all six leagues | C=six | wrong-framing | consider | by:tagline
   TEXT: `When promos are announced, you'll see every giveaway, theme night, ticket pack, and family event here at ${venueName}. Check back closer to the season opener, or download the free PromoNight app to browse every confirmed promo across all s
   WHY: Not a CFB problem (pro-only is right here) but the app-coverage claim is wrong on its own terms: about-copy.ts:332 says the app covers MLB, NBA, NHL and MLS, so 'browse every confirmed promo across all six leagues' in the app is false for WNBA fans specifically, on the WNBA zero-state; belongs to the app-copy drift family.
src/components/zero-promo-fallback.tsx:50 | /nba/[team], /nhl/[team], /mls/[team], /mlb/[team] with zero promos | NBA zero-promo fallback paragraph 2 (NHL at 57, MLS at 64, MLB at 71 use the same app sentence) | dom | gate=both | mixed<LEAGUE_COPY[team.league].paragraphs(ctx)> | L=none (app scope implied per league) | C=none | pro-only-correct | leave | by:dom-copy
   TEXT: `When ${teamName} promos are confirmed at ${venueName}, they'll appear on this page. In the meantime, the free PromoNight app carries the same calendar, so confirmed events show up there too.`,
   WHY: Counterpoint to the finder's WNBA:43 row: for NBA, NHL, MLS and MLB the "free PromoNight app carries the same calendar" claim matches about-copy:256, so only the WNBA branch (which adds "all six leagues") is the outlier. NFL (line 36) makes no app claim at all.
src/lib/__tests__/about-freshness.test.ts:48 | n/a | test pinning a SHA-256 fingerprint of the entire src/lib/about-copy.ts file (the CFB reference file, | other | gate=n/a | derived<ABOUT_COPY_FINGERPRINT, ABOUT_LAST_REVIEWED, ABOUT_LAST_REVIEWED_LABEL> | L=none | C=none | other | consider | by:sweep
   TEXT: test('the /about copy fingerprint matches the copy', () => { const actual = createHash('sha256').update(fingerprintSource()).digest('hex'); assert.equal( actual, ABOUT_COPY_FINGERPRINT,
   WHY: Any byte change to about-copy.ts (including comment-only edits) breaks this test until ABOUT_COPY_FINGERPRINT, ABOUT_LAST_REVIEWED and ABOUT_LAST_REVIEWED_LABEL are all bumped; the failure message prints the new hash. The /about page publishes that date as 'Last reviewed', dateModified and sitemap lastmod, so a copy touch is also a review-date commitment.
src/lib/about-copy.ts:99 | /about | /about meta description + AboutPage.description (aboutMetaDescription) | meta | gate=both | derived<getAboutCounts() (teams collection + cfbSchools)> | L=six leagues (derived) | C=169 teams, 87 college programs | description-slot | leave | by:tagline
   TEXT: `How PromoNight finds, checks and publishes promotional schedules for ${c.teamCount} teams ` + `across ${numberWord(c.leagueCount)} leagues, plus ${c.cfbSchoolCount} college football programs. ` + `Written by Matt Kovalik in Minneapolis.`
   WHY: Reference implementation of the CFB rule; a description slot, not a tagline slot; the /about Organization node (about/page.tsx:157-165) carries no description at all.
src/lib/about-copy.ts:106 | /about | aboutMetaDescription() consumed by src/app/about/page.tsx:60 metadata.description (og/twitter fall b | meta | gate=both | derived<getAboutCounts() in src/app/about/page.tsx:38-53: teamCount from getAl> | L=six leagues (numberWord), college footba | C=${teamCount} (169), six, ${cfb | already-correct-with-cfb | leave | by:route-meta
   TEXT: How PromoNight finds, checks and publishes promotional schedules for ${c.teamCount} teams across ${numberWord(c.leagueCount)} leagues, plus ${c.cfbSchoolCount} college football programs. Written by Matt Kovalik in Minneapolis.
   WHY: The reference implementation of THE CFB RULE: 169 across six leagues, PLUS 87 college football programs, every number derived. Prod-verified: 'for 169 teams across six leagues, plus 87 college football programs'. Title at about/page.tsx:59 is { absolute: 'How PromoNight Tracks Sports Promotions' } with no league list.
src/lib/about-copy.ts:107 | /about | /about lede paragraph (aboutLede) | dom | gate=both | derived<getAboutCounts()> | L=derived list (six) | C=${c.teamCount} (169), ${c.cfbS | already-correct-with-cfb | leave | by:tagline
   TEXT: `PromoNight is a promotional calendar for professional and college sports. It tracks giveaways, ` + `theme nights, food deals and family events for ${c.teamCount} teams across ${c.leagueList}, and it ` + `covers schedules, venues and rivalr
   WHY: Second reference implementation of the CFB rule alongside aboutMetaDescription; the finder cited about-copy.ts:99 only.
src/lib/about-copy.ts:108 | /about | /about lede (reference implementation) | dom | gate=both | derived<getAboutCounts() in src/app/about/page.tsx:37-54> | L=${c.leagueList} = "MLB, NBA, NFL, NHL, M | C=${c.teamCount} (169), ${c.cfbS | already-correct-with-cfb | leave | by:dom-copy
   TEXT: `PromoNight is a promotional calendar for professional and college sports. It tracks giveaways, ` + `theme nights, food deals and family events for ${c.teamCount} teams across ${c.leagueList}, and it ` + `covers schedules, venues and rivalr
   WHY: REFERENCE wording: promos "for 169 teams across MLB, NBA, NFL, NHL, MLS, and WNBA" and separately "schedules, venues and rivalries for 87 college football programs". Meta variant at line 99-100: "for ${c.teamCount} teams across ${numberWord(c.leagueCount)} leagues, plus ${c.cfbSchoolCount} college football programs."
src/lib/about-copy.ts:153 | /about | /about prose paragraph under 'the website became the product' | dom | gate=both | hardcoded<> | L=none | C=none | other | consider | by:tagline
   TEXT: 'So the website became the product. Every promo, every team, every league, no download and no account required. [Team pages](/teams), [collections by promo type](/best-promos), [venue guides](/venues) and [weekly rankings](/team-rankings), 
   WHY: Not a tagline slot, but 'Every promo, every team, every league' is a brand-line-shaped phrase in the same family as the PNG's 'Every promo. Every team.'; if the family is being retired sitewide, this and line 317 are the two /about echoes (the page is fingerprint-guarded via ABOUT_COPY_FINGERPRINT at line 58, so any edit means a fingerprint bump).
src/lib/about-copy.ts:192 | /about | /about method section, other-leagues paragraph (reference wording for CFB-is-not-promos) | dom | gate=both | hardcoded<> | L=NBA, NHL, NFL; college football | C=none | already-correct-with-cfb | leave | by:dom-copy
   TEXT: 'NBA, [NHL](/nhl) and [NFL](/nfl) publish in bursts, mostly right before their seasons start, and they get added by hand when I run a sweep. NHL is the one I am working on next, and I will be straight about where it stands: several clubs ha
   WHY: The finder's notes omit this sentence; it is the most explicit statement of the CFB rule in user-facing copy ("those pages carry schedules, venues and rivalries, not promotions") and is reusable wording for any surface that needs the clause. Note it links /nhl, which is not a live hub in LEAGUE_HUB_REGISTRY (live: false), a separate link-target concern.
src/lib/about-copy.ts:223 | /about | /about What is here: Team pages bullet | dom | gate=both | derived<getAboutCounts().teamCount> | L=MLB, MLS, WNBA; NBA, NHL, NFL | C=${c.teamCount} (169) | pro-only-correct | leave | by:dom-copy
   TEXT: `for all ${c.teamCount} teams, carrying whatever promotional calendar the team has published, past and upcoming, plus venue details for the ballpark or arena. MLB, MLS and WNBA carry a full season. NBA, NHL and most of the NFL are still wai
   WHY: Pro-only bullet; the separate College football bullet at line 243 ("${c.cfbSchoolCount} programs: schools, venues, and the rivalries and trophies...") and Rankings bullet at 238 ("for ${c.rankedLeagueList}, covering ${c.rankedTeamCount} teams", 75 live) keep the three corpora distinct.
src/lib/about-copy.ts:238 | /about | /about What is here: Rankings bullet | dom | gate=both | derived<getAboutCounts(): rankedLeagueList = joinList(leagues.filter(SCORED_LE> | L=${c.rankedLeagueList} = "MLB, MLS, and W | C=${c.rankedTeamCount} (75) | pro-only-correct | leave | by:dom-copy
   TEXT: `for ${c.rankedLeagueList}, covering ${c.rankedTeamCount} teams. Each promotion is scored on what it actually is, a jersey outranks a magnet schedule, and on how limited it is. Team scores then reward variety: a club running bobbleheads, je
   WHY: Reference for the ranked subset. Finder cited it in a rationale only; it deserves its own row because it is the one derived source of the 75-team ranked count outside /team-rankings.
src/lib/about-copy.ts:243 | /about | /about What is here: College football bullet | dom | gate=both | derived<getAboutCounts().cfbSchoolCount = (await getAllCfbSchoolIds()).length > | L=college football | C=${c.cfbSchoolCount} (87) | already-correct-with-cfb | leave | by:dom-copy
   TEXT: `${c.cfbSchoolCount} programs: schools, venues, and the rivalries and trophies that make certain Saturdays different. [Start here](/cfb).`,
   WHY: Reference wording: CFB count sits in its own bullet, named as programs, described as schools/venues/rivalries. Cited by the finder only inside the 223 rationale.
src/lib/about-copy.ts:256 | /about | /about What the app is for, paragraph 1 | app-copy | gate=both | hardcoded<> | L=MLB, NBA, NHL, MLS (app scope) | C=none | pro-only-correct | leave | by:dom-copy
   TEXT: 'The free PromoNight app covers MLB, NBA, NHL and MLS. You can follow teams, browse their promotional calendars, and unlock one venue’s Game Day details, which is yours to keep.',
   WHY: The finder references "about-copy line 256" repeatedly as the four-league app-scope source but never rows it. This is the sentence that /download:34/127, zero-promo-fallback:43, promo-helpers:402/436, promos/this-week:73 and homepage-json-ld:65/75 contradict.
src/lib/about-copy.ts:317 | /about | /about FAQ 'Is PromoNight free?' answer (visible FAQ and FAQPage schema, about/page.tsx:169) | faq-jsonld | gate=both | hardcoded<> | L=none | C=none | other | leave | by:tagline
   TEXT: 'The website is completely free and always will be: every team, every promo, every venue guide, no account required. The app is a free download. PromoNight Pro is an optional subscription that adds promo-day reminders and unlimited Game Day
   WHY: FAQ answer, not a tagline slot; second 'every team, every promo' echo on /about, listed with line 153 for the family decision.
src/lib/about-copy.ts:327 | /about | FAQPage answer: How often is it updated? | faq-jsonld | gate=both | hardcoded<> | L=MLB, MLS, WNBA, NBA, NHL, NFL | C=none | pro-only-correct | leave | by:jsonld
   TEXT: 'MLB is rechecked weekly year round. MLS is rechecked weekly through its season, and WNBA weekly from May through September. NBA, NHL and NFL are added by hand as teams announce, which for most of them happens in a burst before the season s
   WHY: Promo cadence claim; CFB correctly absent. Shared DOM + FAQPage (one array). Fingerprint-guarded.
src/lib/about-copy.ts:332 | /about | /about FAQ 'Which leagues are covered?' answer (visible FAQ and FAQPage schema) | faq-jsonld | gate=both | mixed<getAboutCounts(); app league list hardcoded> | L=derived six (web); MLB, NBA, NHL, MLS (a | C=${c.cfbSchoolCount} (87) | already-correct-with-cfb | leave | by:tagline
   TEXT: `The website covers ${c.leagueList}, plus schedules, venues and rivalries for ${c.cfbSchoolCount} college football programs. The app currently covers MLB, NBA, NHL and MLS.`,
   WHY: The canonical answer for both the CFB rule and the app-coverage question; every 'the app covers six leagues' surface elsewhere (download/page.tsx:34 and :127, promo-helpers.ts:402 and :436, promos/this-week/page.tsx:73, zero-promo-fallback.tsx:43) contradicts this line's 'MLB, NBA, NHL and MLS'.
src/lib/capture/__tests__/sheet-copy.test.ts:34 | n/a | test fixture pinning the generic capture-sheet prompt copy (found items sheet-copy.ts:58-59) | other | gate=n/a | hardcoded<> | L='the leagues you follow' (regex) | C=none | other | consider | by:sweep
   TEXT: assert.strictEqual(copy.heading, 'Never miss a giveaway'); assert.match(copy.body, /across the leagues you follow/);
   WHY: If the found sheet-copy.ts:58-59 strings change in the brand-copy pass, this assertion (and 27-29 for the team variant) fails. Update in the same commit.
src/lib/capture/sheet-copy.ts:58 | /{sport}/{team} and aggregators (capture trigger) | capture sheet prompt heading + body (aggregator variant; team variant at 63-64 is 'Get {teamName} pr | dom | gate=redesign | hardcoded<> | L=none | C=none | other | leave | by:tagline
   TEXT: heading: 'Never miss a giveaway', body: 'Every bobblehead, jersey night and theme night across the leagues you follow. One email a week.',
   WHY: Email-capture card copy with a test suite pinned to these strings; not a brand tagline slot (CaptureCard.tsx and CaptureSheet.tsx carry no brand line of their own).
src/lib/capture/sheet-copy.ts:59 | aggregator pages (capture sheet) | capture sheet aggregator-variant body | dom | gate=redesign | hardcoded<> | L="the leagues you follow" (unnamed) | C=none | pro-only-correct | leave | by:dom-copy
   TEXT: body: 'Every bobblehead, jersey night and theme night across the leagues you follow. One email a week.',
   WHY: Only league reference in src/components/capture/* and lib/capture/sheet-copy.ts; no counts, no tagline. CaptureCard/CaptureSheet/CaptureTrigger render only sheet-copy strings.
src/lib/capture/sheet-copy.ts:64 | capture sheet overlay on team pages | capture sheet prompt copy, team variant (generic variant at 58-59 is already found); heading at line | dom | gate=both | mixed<teamName (heading only)> | L=none | C=none | other | leave | by:sweep
   TEXT: body: 'Bobbleheads, theme nights and giveaways, straight to your inbox. One email a week.',
   WHY: Sibling of the found generic prompt; no league or count. Pinned by src/lib/capture/__tests__/sheet-copy.test.ts:27-29 (heading 'Get Cleveland Guardians promos every week', body regexes), so a copy change here breaks that test.
src/lib/cfb/metadata.ts:25 | /cfb/{school}, /cfb/rivalries/{slug} | CFB school + matchup page OG image alt | og | gate=both | hardcoded<> | L=none | C=none | other | change | by:tagline
   TEXT: const OG_IMAGE = { url: '/og-image.png', width: 1200, height: 630, alt: 'PromoNight: Every giveaway, every team' };
   WHY: Fifth copy of the stale alt, and on CFB pages it also asserts 'every giveaway' on a corpus that has no promo data, so the CFB rule argues for the neutral regenerated-card alt here too.
src/lib/cfb/metadata.ts:97 | /cfb/[school] (87 pages) | buildCfbTeamMetadata (src/app/cfb/[school]/page.tsx:23): per-school title (lines 121-135) and descri | meta | gate=n/a | derived<getCfbSchoolPage(school) + selectFeaturedRivalry; YEAR = 2026 const at> | L=none (football schedule / rivalry only) | C=none | already-correct-with-cfb | leave | by:route-meta
   TEXT: title e.g. `${s.name} ${feat.token} ${YEAR}: Gameday & Football Schedule`; description e.g. `${fullName} ${YEAR} football schedule, ${rivalClause}plus tickets, ${stadClause} and hotels for every home game.`
   WHY: Per-school, no league list, no promo claim. Unknown slug returns {} (line 20 of the route), which inherits the root description with its six-league list on a shell page; the rivalries route deliberately avoids that (see cfb/rivalries/[slug]/page.tsx:18-28).
src/lib/cfb/metadata.ts:192 | /cfb | /cfb hub metadata.description (also og/twitter description at 199-200; OG image alt at line 25 appli | meta | gate=both | hardcoded<> | L=college football | C=none | other | leave | by:tagline
   TEXT: 'College football rivalries, trophy games and theme nights for 2026: The Game, Iron Bowl, Red River, plus schedules and gameday plans for every team.'; // 148 ≤ 155
   WHY: CFB-scoped description that deliberately carries no count (in-file comment explains the 86-to-87 drift); not a tagline slot; listed because the finder's cfb/metadata.ts:25 row omitted /cfb from the routes that carry the stale alt.
src/lib/cfb/metadata.ts:229 | /cfb/rivalries/[slug] (33 pages) | buildCfbMatchupMetadata (src/app/cfb/rivalries/[slug]/page.tsx:33): title `${data.displayName} ${YEA | meta | gate=n/a | derived<getMatchupPage(slug); buildMatchupDescription longestFit candidates> | L=none | C=none | already-correct-with-cfb | leave | by:route-meta
   TEXT: e.g. `${matchup} is ${when}. Kickoff ${kickoff} at ${place}. Tickets, parking, hotels and what to know before you go.`
   WHY: Per-rivalry, no league list; miss path sets 'Rivalry not found' + noindex instead of inheriting root.
src/lib/cfb/metadata.ts:262 | /cfb/rivalries | RIVALRY_INDEX_DESCRIPTION consumed by buildCfbRivalryIndexMetadata (src/app/cfb/rivalries/page.tsx:2 | meta | gate=n/a | hardcoded<RIVALRY_INDEX_DESCRIPTION const> | L=college football | C=none | already-correct-with-cfb | leave | by:route-meta
   TEXT: Every major college football rivalry in 2026: the date, the kickoff, the stadium and how to plan the trip.
   WHY: Correctly CFB-only; no pro league or count.
src/lib/cfb/rivalry-index.ts:65 | /cfb/rivalries | /cfb/rivalries FAQ question (visible FAQ and FAQPage JSON-LD; the answer at 66 is already found) | faq-jsonld | gate=both | hardcoded<> | L=college football | C=none (count is in the derived  | already-correct-with-cfb | leave | by:sweep
   TEXT: question: 'How many college football rivalries does this page track for 2026?',
   WHY: CFB-native surface; no pro league list. Listed only so the question line is in the dedupe set alongside its found answer.
src/lib/cfb/rivalry-index.ts:66 | /cfb/rivalries | FAQPage answer: How many college football rivalries does this page track for 2026? | faq-jsonld | gate=n/a | derived<getMatchupIndex() row counts (same source llms.txt uses for rivalryCou> | L=college football | C=N rivalries (33 live) | already-correct-with-cfb | leave | by:jsonld
   TEXT: `This page tracks ${total} named college football rivalries. ${dated} of them have a scheduled 2026 meeting, and every rivalry links to a page with the date, the stadium and how to plan the trip.`
   WHY: Shared DOM + FAQPage (faqs passed to both, src/app/cfb/rivalries/page.tsx:143). CFB-scoped count, no pro claim.
src/lib/cfb/rivalry-index.ts:71 | /cfb/rivalries | /cfb/rivalries FAQ question (answer at 72 is already found) | faq-jsonld | gate=both | hardcoded<> | L=college football | C=none | already-correct-with-cfb | leave | by:sweep
   TEXT: question: 'When is college football Rivalry Week in 2026?',
   WHY: CFB-native surface; no pro league list.
src/lib/cfb/rivalry-index.ts:72 | /cfb/rivalries | FAQPage answer: When is college football Rivalry Week in 2026? | faq-jsonld | gate=n/a | derived<rivalryWeekRows(rows).length and rows.length> | L=college football | C=N of N rivalries (derived) | already-correct-with-cfb | leave | by:jsonld
   TEXT: `Rivalry Week is the final weekend of the regular season. ${week} of the ${total} rivalries tracked here are played between November 21 and November 29, 2026, most of them over Thanksgiving weekend.`
   WHY: Finder itemized L66 only; L72 and L78 carry the same derived rivalry counts. CFB-scoped, no pro claim. Shared DOM + FAQPage (cfb/rivalries/page.tsx:142-143).
src/lib/cfb/rivalry-index.ts:78 | /cfb/rivalries | FAQPage answer: How many of these rivalries play for a trophy? | faq-jsonld | gate=n/a | derived<rows.filter(r => r.trophy).length and rows.length> | L=college football (implicit) | C=N of N rivalries (derived) | already-correct-with-cfb | leave | by:jsonld
   TEXT: `${trophies} of the ${total} rivalries listed here play for a named trophy. Series history and trophy details are on each rivalry page.`
   WHY: Conditional on trophies > 0. CFB-scoped derived count, shared DOM + FAQPage.
src/lib/email.ts:162 | email | confirmation email header wordmark (digest header twin at line 363); no tagline line under it, no pr | email | gate=n/a | hardcoded<> | L=none | C=none | other | consider | by:tagline
   TEXT: <span style="font-size:22px;font-weight:800;letter-spacing:-0.5px;color:${EMAIL_ON_DARK};">PROMO<span style="color:${EMAIL_ACCENT_ON_DARK};">NIGHT</span></span>
   WHY: The only place a tagline COULD be added to email is under this wordmark (there is no preheader field to fill); today no tagline renders in any email, so this is an optional addition, not a replacement.
src/lib/email.ts:167 | n/a (sent by /api/subscribe) | confirmation email body paragraph (double opt-in), HTML variant; the wordmark at 161 and subject at  | email | gate=n/a | mixed<email> | L=none | C=none | other | leave | by:sweep
   TEXT: Tap below to confirm <strong>${esc(email)}</strong> and start getting one weekly email with every giveaway, theme night, and food deal for the teams you follow.
   WHY: 'every giveaway ...' family line in the transactional email; no league list, no count, not a tagline slot. Followed teams are pro-only so the CFB rule does not apply.
src/lib/email.ts:231 | email | email subject lines (231 confirm, 427 personalized digest, 491 generic digest, 577 quiet-week digest | email | gate=n/a | hardcoded<> | L=none | C=none | other | leave | by:tagline
   TEXT: subject: 'Confirm your PromoNight email', | "Your teams' promos this week on PromoNight" | "This week's hottest pro sports promos" | 'Your teams are quiet this week on PromoNight' | body: one weekly email with every giveaway, theme night, a
   WHY: Transactional subjects and bodies do their own job; none carries the old tagline and none is a tagline slot; footers (378-390) are CAN-SPAM manage/unsubscribe lines only.
src/lib/email.ts:473 | n/a | generic digest email sub-heading | email | gate=n/a | hardcoded<> | L="the leagues" (unnamed) | C=none | pro-only-correct | leave | by:dom-copy
   TEXT: sub: 'The biggest giveaways, theme nights, and food deals across the leagues this week.',
   WHY: Promo-only surface; unnamed leagues cannot drift. No tagline present in any email.
src/lib/email.ts:491 | n/a (Resend digest) | weekly digest hot-promos email subject (sub-heading at line 473: 'The biggest giveaways, theme night | email | gate=n/a | hardcoded<> | L='pro sports' / 'the leagues' (no list) | C=none | pro-only-correct | leave | by:route-meta
   TEXT: subject: "This week's hottest pro sports promos",
   WHY: No league list or count anywhere in email.ts (grep-verified); the digest is a promo surface so pro-only is right. No tagline text in any email template either, so the brand line has no email slot today.
src/lib/email.ts:543 | n/a (weekly-digest cron) | quiet-week digest email sub heading (HTML), fallback branch when the subscriber has no local promos; | email | gate=n/a | hardcoded<> | L='the leagues' (no list) | C=none | pro-only-correct | leave | by:sweep
   TEXT: : "Here are this week's hottest promos across the leagues instead.";
   WHY: Promo-coverage phrasing with no count; the digest is built from getPromosInDateRange over pro promos only, so 'the leagues' is pro-only and correct. Not inventoried by the email finder (162/231/473/491 were).
src/lib/email.ts:563 | n/a (weekly-digest cron) | quiet-week digest email plain-text body lead line, fallback branch | email | gate=n/a | hardcoded<> | L='the leagues' (no list) | C=none | pro-only-correct | leave | by:sweep
   TEXT: : ["This week's hottest promos across the leagues:", ...hotPromosBodyText(args.featured, args.collections)];
   WHY: Plain-text twin of line 543; edit in lockstep if that line changes.
src/lib/league-hubs.ts:56 | every page | league hub nav link aria-label (desktop dropdown BrandBarLeagueHubs.tsx:71 and mobile sheet BrandBar | dom | gate=redesign | derived<hubAriaLabel(hub) over LEAGUE_HUBS = LEAGUE_HUB_REGISTRY.filter(live);> | L=MLB, WNBA, MLS, NFL, CFB (one aria-label | C=none | wrong-framing | change | by:dom-copy
   TEXT: return `${hub.label} promotional schedule`;
   WHY: Renders aria-label="CFB promotional schedule" on every production page (prod-verified: 2 occurrences in the homepage HTML, desktop menu + mobile sheet, alongside MLB/MLS/NFL/WNBA). CFB has no promo data, so the accessible name of the /cfb link claims a promotional schedule that does not exist. Fix in one place: branch on hub.league === 'CFB' (e.g. 'College football schedules and rivalries') or add an ariaLabel field 
src/lib/og.ts:18 | many static routes | DEFAULT_OG_IMAGE.alt (pageOpenGraph/canonicalOpenGraph used by /about, /download, /teams, /follow, h | og | gate=both | hardcoded<> | L=none | C=none | other | change | by:tagline
   TEXT: alt: 'PromoNight - every giveaway, every team',
   WHY: Same stale image alt as layout.tsx:71 in a second spelling (hyphen, lowercase); should be one shared constant that matches the regenerated card.
src/lib/promo-helpers.ts:402 | /{sport}/{team} | team FAQ 'How can I track {fullName} promotional events?' answer (visible FAQ and FAQPage schema on  | faq-jsonld | gate=both | mixed<teamCount derived; league list hardcoded> | L=MLB, NBA, NFL, NHL, MLS, WNBA | C=${teamCount - 1} other teams ( | description-slot | leave | by:tagline
   TEXT: `PromoNight is a free app that tracks every giveaway, theme night, food deal, and promotion for the ${fullName} and ${teamCount - 1} other teams across MLB, NBA, NFL, NHL, MLS, and WNBA. Download it on iOS or Android for a free calendar vie
   WHY: Promo-coverage FAQ, pro-only and correct on the CFB rule; not a tagline slot (the away-games twin at line 448 is brandPromo-flagged, DOM only, and reads the same way).
src/lib/promo-helpers.ts:436 | /{sport}/{team} | team FAQ 'Can I get notifications for {team.name} promos?' answer (visible FAQ AND FAQPage schema: n | faq-jsonld | gate=both | mixed<team.name; league list hardcoded> | L=MLB, NBA, NFL, NHL, MLS, WNBA | C=none | wrong-framing | consider | by:tagline
   TEXT: answer: `Yes, with PromoNight Pro. The app sends a notification on the morning of every ${team.name} promo game, covering bobblehead giveaways, theme nights, food deals, and kids events. Downloading the app and browsing every promo is free.
   WHY: States the APP lets you follow teams across all six leagues while about-copy.ts:332 says the app covers MLB, NBA, NHL and MLS; on NFL and WNBA team pages this FAQ (in schema) promises an app follow that does not exist; app-copy drift, pro-only framing is otherwise right.
src/lib/promo-helpers.ts:448 | /{sport}/{team} | team FAQ 'Does PromoNight work for away games?' answer (brandPromo: true, so visible FAQ only, filte | faq-dom | gate=both | mixed<teamCount derived; league list hardcoded> | L=MLB, NBA, NFL, NHL, MLS, WNBA | C=${teamCount} (169) | pro-only-correct | leave | by:tagline
   TEXT: answer: `PromoNight tracks home-game promotions for all ${teamCount} teams across MLB, NBA, NFL, NHL, MLS, and WNBA. If you're traveling to see the ${team.name} play on the road, browse the home team's calendar on this site to see every pro
   WHY: The finder mentioned this line inside its :402 rationale but never gave it a row; promo-coverage claim, pro-only, correct, must not gain CFB.
src/lib/promo-helpers.ts:459 | /[sport]/[team] (only teams with >= 10 upcoming promos) | FAQPage answer (team pages, conditional): How often are {team} promo schedules updated? | faq-jsonld | gate=both | mixed<upcomingPromos.length derived; the league cadence list is a literal; p> | L=MLB, WNBA, MLS | C=N scheduled events (derived) | pro-only-correct | leave | by:jsonld
   TEXT: `${team.name} promo data comes from official team announcements and is reviewed before it appears here. The current schedule reflects ${upcomingPromos.length} scheduled events. MLB, WNBA, and MLS schedules are rechecked weekly in season.`
   WHY: Missed by the finder, which listed only L402/L436/L448 from generateTeamFAQs. It is NOT brandPromo, so it ships in the FAQPage payload (json-ld.tsx:105-107) as well as the DOM (team-faq.tsx:19), one generator. Prod-verified 2026-08-25 on /mlb/minnesota-twins: the FAQPage carries 'How often are Twins promo schedules updated?' with 'MLB, WNBA, and MLS schedules are rechecked weekly in season.' Cadence claim, CFB must n
src/lib/types.ts:289 | n/a | LEAGUE_ORDER canonical six-league array (derivation source for about-copy leagueList, homepage-json- | other | gate=both | hardcoded<> | L=MLB, NBA, NFL, NHL, MLS, WNBA | C=none | pro-only-correct | leave | by:sweep
   TEXT: export const LEAGUE_ORDER = ['MLB', 'NBA', 'NFL', 'NHL', 'MLS', 'WNBA'] as const;
   WHY: Not a copy surface itself but the single source that derived league lists read from. It deliberately excludes CFB (CFB is a separate collection and its chip is gated by league-hubs.ts getLeagueHub('CFB').live). Adding CFB here would leak college football into every pro-only derived list, so it must stay six.
src/lib/venue-bag-policies.ts:228 | /venues/bag-policies | buildBagPolicyPageCopy description consumed by src/app/venues/bag-policies/page.tsx:44 generateMetad | meta | gate=both | derived<deriveBagStats(groupBagPolicyRows(await getMlbBagPolicyRows())) in src> | L=MLB | C=${s.clearRequired} of ${s.tota | pro-only-correct | leave | by:route-meta
   TEXT: ${s.clearRequired} of ${s.total} MLB ballparks require a clear bag in ${BAG_SEASON}. Every park's bag rule, size limit and clutch exception, compared side by side. (title: MLB Bag Policy ${BAG_SEASON}: All ${s.total} Ballpark Rules)
   WHY: Correctly single-league (MLB bag aggregator); counts derived from the same rows the DOM renders. No CFB relevance.
src/lib/venue-index.ts:35 | /venues | /venues index section heading (CFB block) | dom | gate=redesign | hardcoded<VENUE_INDEX_SECTIONS (lines 29-35), pro leagues first then CFB last> | L=MLB, NFL, MLS, WNBA, NBA, NHL headings a | C=none | already-correct-with-cfb | leave | by:dom-copy
   TEXT: { league: 'CFB', heading: 'College football stadium guides' },
   WHY: Prod-verified heading renders on /venues. CFB gets its own section after the six pro sections, which is the correct what-the-site-covers framing; the finder mentioned it inside the venues:45 rationale but did not row it.
