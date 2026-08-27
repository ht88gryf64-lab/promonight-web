# CFB Phase 0 report (items 1, 2, 4, 5; item 6 by reference)

Read-only audit for the CFB content depth build, run 2026-08-25 against production (www.getpromonight.com) and Firestore. No code changes, no Firestore writes. Item 3 (the rivalries measurement window) is out of scope for this pass and is not read here. Item 6 (fonts, contrast, tokens) is covered by the template sweep: see audit/cfb-phase0-sweep-summary.md (61 surviving findings) and audit/cfb-phase0-sweep.json (the verbatim workflow output). The browser-measured figures that back item 6 are summarised at the end of this file so the report stands alone.

## 1. Word count per CFB school page

Method: each of the 87 school pages (86 sitemap slugs plus washington-state, which is served but noindexed) fetched with a cache-busting query string, user agent promonight-internal-audit/1.0. Counting reuses the repo's own audit/raptive-page-mix-visible.ts logic so the numbers sit on the same basis as the Raptive baseline: the main content region is the root layout <main>, which encloses the CFB template and excludes header and footer chrome; script, style, noscript, template, iframe and svg blocks are stripped, nav elements inside main are stripped, tags removed, entities decoded, whitespace-split words counted. wordsRaw equals the visible-unique corrected count on every page (no seasonal rails, no repeated 4+ word blocks), so one column is reported. An independent Python recount on Tennessee gave 360 against the script's 350; the difference is tokenisation.

| population | n | median | mean | min | max |
|---|---|---|---|---|---|
| all school pages | 87 | 299 | 303.4 | 178 (washington-state) | 402 (auburn) |
| 25 anchor schools | 25 | 327 | 327.7 | 264 (oklahoma-state) | 402 (auburn) |

Buckets, all 87: <400: 85; 400-699: 2; 700-999: 0; 1000-1499: 0; 1500+: 0.
Buckets, 25 anchors: <400: 23; 400-699: 2; 700-999: 0; 1000-1499: 0; 1500+: 0.

Deficit to bring every page to 1,000 words: **60,607** across all 87 (87 x 1,000 minus 26,393 present). Deficit for the 25 anchor schools only: **16,807** (25,000 minus 8,193 present). No page is at or above 1,000 by any measure.

### Per-school table (ascending words; anchor schools marked)

| school | words | deficit to 1,000 | anchor |
|---|---|---|---|
| washington-state | 178 | 822 |  |
| northern-illinois | 231 | 769 |  |
| south-florida | 238 | 762 |  |
| air-force | 244 | 756 |  |
| indiana | 255 | 745 |  |
| northwestern | 256 | 744 |  |
| ucf | 257 | 743 |  |
| smu | 258 | 742 |  |
| toledo | 259 | 741 |  |
| louisville | 260 | 740 |  |
| rutgers | 263 | 737 |  |
| oklahoma-state | 264 | 736 | yes |
| nebraska | 267 | 733 | yes |
| oregon | 268 | 732 | yes |
| pittsburgh | 268 | 732 |  |
| arizona-state | 269 | 731 |  |
| byu | 270 | 730 |  |
| west-virginia | 272 | 728 |  |
| marshall | 273 | 727 |  |
| tulane | 273 | 727 |  |
| uconn | 273 | 727 |  |
| army | 274 | 726 |  |
| unlv | 275 | 725 |  |
| california | 276 | 724 |  |
| arizona | 278 | 722 |  |
| maryland | 280 | 720 |  |
| boise-state | 281 | 719 |  |
| coastal-carolina | 285 | 715 |  |
| ohio-state | 289 | 711 | yes |
| san-diego-state | 289 | 711 |  |
| south-carolina | 289 | 711 |  |
| ucla | 289 | 711 |  |
| nc-state | 291 | 709 |  |
| syracuse | 291 | 709 |  |
| colorado | 293 | 707 |  |
| kansas | 293 | 707 |  |
| houston | 294 | 706 |  |
| cincinnati | 295 | 705 |  |
| iowa-state | 296 | 704 |  |
| james-madison | 297 | 703 |  |
| appalachian-state | 298 | 702 |  |
| michigan-state | 299 | 701 |  |
| navy | 299 | 701 |  |
| washington | 299 | 701 |  |
| wake-forest | 300 | 700 |  |
| memphis | 301 | 699 |  |
| wisconsin | 301 | 699 | yes |
| miami | 302 | 698 | yes |
| usc | 302 | 698 | yes |
| boston-college | 304 | 696 |  |
| oklahoma | 304 | 696 | yes |
| stanford | 305 | 695 |  |
| tcu | 305 | 695 |  |
| kansas-state | 307 | 693 | yes |
| penn-state | 312 | 688 | yes |
| texas-tech | 313 | 687 |  |
| baylor | 314 | 686 |  |
| vanderbilt | 314 | 686 |  |
| kentucky | 318 | 682 |  |
| purdue | 318 | 682 |  |
| texas-am | 320 | 680 | yes |
| clemson | 326 | 674 | yes |
| liberty | 326 | 674 |  |
| north-carolina | 327 | 673 | yes |
| utah | 328 | 672 | yes |
| fresno-state | 331 | 669 |  |
| missouri | 331 | 669 |  |
| illinois | 332 | 668 |  |
| texas | 332 | 668 | yes |
| florida-state | 335 | 665 | yes |
| florida | 338 | 662 | yes |
| michigan | 339 | 661 | yes |
| ole-miss | 343 | 657 | yes |
| virginia | 347 | 653 |  |
| duke | 348 | 652 |  |
| tennessee | 350 | 650 | yes |
| arkansas | 353 | 647 |  |
| mississippi-state | 353 | 647 |  |
| virginia-tech | 354 | 646 |  |
| iowa | 358 | 642 |  |
| minnesota | 358 | 642 |  |
| georgia-tech | 359 | 641 |  |
| georgia | 370 | 630 | yes |
| alabama | 379 | 621 | yes |
| lsu | 388 | 612 | yes |
| notre-dame | 400 | 600 | yes |
| auburn | 402 | 598 | yes |

## 2. Venue resolution

86 of 87 schools carry a venueId that resolves to a cfbVenues document. Without one: washington-state (no venueId and no document). No school points at a missing document, no venue document is unreferenced, and no two schools share a venue.

Per field, populated, of the 86 resolved (a field counts as populated when the key is present with a non-empty value; "absent" means the key does not exist on any document):

| field | populated | note |
|---|---|---|
| parking | 0 | key absent on every doc |
| transit | 0 | key absent on every doc |
| gatesOpenRule | 0 | key absent on every doc |
| tailgating | 0 | key absent on every doc |
| capacity | 73 | numeric > 0; capacityVerified true on 64 |
| lat | 86 | coordsVerified true on 8 |
| lng | 86 | |
| source | 86 | pipeline provenance URL; proposedFrom on 86 |
| humanConfirmed | 0 | the verify gate the schema requires before a destination page trusts the venue |
| name / city / state | 86 / 86 / 85 | notre-dame-stadium has no state |

Anchor-25 venue view: parking, transit, gatesOpenRule and tailgating are empty on all 25; capacityVerified on 19 of 25; coordsVerified on 5 of 25.

## 4. Discoverability

Rendered DOM, cache-busting curl of the homepage (/) and a pro team page (/mlb/chicago-cubs), each anchor located by its ancestor landmarks; the team finder additionally exercised in headless Chrome. Both pages carry the same four /cfb anchors.

| surface | href and text | placement in the served DOM | reachable |
|---|---|---|---|
| site nav, desktop | /cfb "College football" (aria-label "College football schedules, stadiums and rivalries") | header > nav > div#league-hubs-menu, the League hubs dropdown; the menu carries class hidden until its button toggles it, inside a hidden md:block wrapper | one click, behind "League hubs"; same treatment as MLB, WNBA, MLS and NFL, no hub has an always-visible link; anchor is in the served HTML so it is crawlable |
| site nav, mobile | /cfb, same label | header > nav > dialog[aria-label="Site navigation"] > nav#mobile-nav-sheet | one tap, behind the menu button |
| footer | /cfb "College football" and /cfb/rivalries "College football rivalries" | footer, visible, on the homepage, the team page, and every CFB page | yes, always visible |
| homepage team finder | CFB chip present as the last league tab (All, MLB, NHL, MLS, NFL, WNBA, NBA, CFB) | 0 /cfb hrefs inside <main> in the served HTML; after clicking the chip in headless Chrome, 7 links render: /cfb?conf=sec, /cfb?conf=big-ten, /cfb?conf=acc, /cfb?conf=big-12, /cfb?conf=group-of-5, /cfb?conf=independents, and /cfb "View the full hub" | yes for a visitor, client-side only; not crawlable from the finder |

Absent: an always-visible top-level nav link to /cfb (by design, in parity with the other hubs). No other /cfb anchor exists on either page.

**Amendment, 2026-08-27 (do not re-open).** The finder row above should not be read as a crawl gap. The seven links the CFB chip reveals are /cfb itself plus six /cfb?conf= variants. The hub honours ?conf= client-side from window.location as an initial visibility filter (src/components/cfb/hub/CfbHubBrowse.tsx:24-32; no useSearchParams, no Suspense bailout), its canonical is /cfb, and its served HTML carries all 86 school links regardless of the filter. /cfb is linked from the nav dropdown and the footer on every page in served HTML. Nothing is reachable only through the chip, so no finder change was made; the client-only reveal is cosmetic, not a discoverability defect.

Sitemap (live https://www.getpromonight.com/sitemap.xml, 470 URLs): /cfb present (1); /cfb/rivalries present (1); rivalry detail URLs 32 of 32, the slug set identical to MATCHUP_REGISTRY; school pages 86 of 87. The omitted school is washington-state, excluded by cfbSchoolBelowIndexFloor (fewer than 8 games or no venue; it has 6 games and no venue) and served with robots noindex,follow. llms.txt lists the hub, the school URL pattern, the rivalries index and the matchup URL pattern with counts derived at render time.

## 5. Editorial status

editorialStatus across the 87 schools: auto 87. All 25 anchor schools are auto.

Where the editorial template would live: nowhere yet. src/lib/cfb/data.ts:310 returns a hardcoded editorial block of nulls for every school (signatureGameId, traditions, gamedayCulture, whyYouGo, venueInTheirWords, contributor). No Firestore field, collection, or code map feeds it, so the spec's "Phase 4 is a data change, no template change" has no data path to change. The template fields map to stores as follows, with population today:

| template field | backing store | populated |
|---|---|---|
| theme game narratives | cfbTraditions.narrative via cfbSchools.traditionIds | 0 narratives of 2 docs; traditionIds empty on 87 of 87; themeDesignations on 0 of 670 games |
| marquee rivalry narratives | cfbRivalries.narrative | 0 of 212 |
| venue gameday prose | cfbVenues tailgating, parking, transit, gatesOpenRule | 0 of 86 on every field |
| why you go paragraph | no field in any schema | 0 |
| color and brand sanity check | cfbSchools.colorsHumanConfirmed | 0 of 87 (colorsSource present on 87; primaryColor missing on appalachian-state; secondaryColor missing on appalachian-state, marshall, oklahoma, rutgers, syracuse) |
| sources logged | cfbVenues.source, cfbRivalries.source | 86 venues, 212 rivalries; pipeline provenance, not editorial provenance |

The only editorial prose live today is in code with no source field: CFB_KICKERS (src/lib/cfb/page-extras.ts:130, 55 schools), NATIONAL_CURATED blurbs and years for 4 rivalries (src/lib/cfb/hub-data.ts:63-66), THEME_CURATED for 4 schools (hub-data.ts:74-79), and the generic TripStep copy on matchup pages. The contribute form posts to a queue; contributor is null on every page, so no contribution has been published.

### Per anchor school: template fields populated versus empty, plus the hard data that does exist

Template columns (theme narrative, rivalry narrative, venue prose, why you go, colors confirmed) are empty for every anchor; they are listed once so the table reads honestly rather than repeating "empty" 125 times. The remaining columns are what an editorial pass would start from.

| school | conf | words | template fields populated | verified games / total | rivalry docs (with trophy) | matchup pages | kicker | tradition docs | capacity verified | coords verified |
|---|---|---|---|---|---|---|---|---|---|---|
| alabama | SEC | 379 | 0 of 5 | 1 / 12 | 10 (1) | 2 | yes | 0 | yes | yes |
| georgia | SEC | 370 | 0 of 5 | 3 / 12 | 8 (2) | 3 | yes | 0 | yes | yes |
| lsu | SEC | 388 | 0 of 5 | 5 / 12 | 8 (3) | 2 | yes | 0 | yes | no |
| tennessee | SEC | 350 | 0 of 5 | 3 / 12 | 7 (0) | 1 | yes | 1 | yes | no |
| texas | SEC | 332 | 0 of 5 | 5 / 12 | 7 (2) | 2 | yes | 0 | yes | yes |
| oklahoma | SEC | 304 | 0 of 5 | 4 / 12 | 4 (3) | 1 | yes | 0 | yes | no |
| auburn | SEC | 402 | 0 of 5 | 3 / 12 | 10 (1) | 2 | yes | 0 | yes | no |
| florida | SEC | 338 | 0 of 5 | 4 / 12 | 8 (3) | 1 | yes | 0 | yes | yes |
| texas-am | SEC | 320 | 0 of 5 | 3 / 12 | 6 (1) | 1 | yes | 0 | yes | no |
| ole-miss | SEC | 343 | 0 of 5 | 5 / 12 | 8 (2) | 2 | yes | 0 | no | no |
| ohio-state | Big Ten | 289 | 0 of 5 | 3 / 12 | 3 (1) | 2 | yes | 0 | yes | no |
| michigan | Big Ten | 339 | 0 of 5 | 4 / 12 | 8 (3) | 2 | yes | 0 | yes | no |
| penn-state | Big Ten | 312 | 0 of 5 | 3 / 12 | 9 (2) | 0 | yes | 0 | no | no |
| oregon | Big Ten | 268 | 0 of 5 | 2 / 12 | 5 (2) | 0 | yes | 0 | yes | no |
| usc | Big Ten | 302 | 0 of 5 | 4 / 12 | 5 (2) | 1 | yes | 0 | yes | no |
| wisconsin | Big Ten | 301 | 0 of 5 | 4 / 12 | 3 (3) | 1 | yes | 0 | yes | no |
| nebraska | Big Ten | 267 | 0 of 5 | 4 / 12 | 10 (4) | 1 | yes | 0 | no | yes |
| clemson | ACC | 326 | 0 of 5 | 5 / 13 | 8 (2) | 1 | yes | 0 | yes | no |
| florida-state | ACC | 335 | 0 of 5 | 4 / 12 | 4 (3) | 0 | yes | 0 | yes | no |
| miami | ACC | 302 | 0 of 5 | 5 / 12 | 5 (3) | 0 | yes | 0 | yes | no |
| north-carolina | ACC | 327 | 0 of 5 | 4 / 12 | 5 (1) | 1 | yes | 0 | yes | no |
| utah | Big 12 | 328 | 0 of 5 | 3 / 12 | 3 (0) | 1 | yes | 0 | no | no |
| kansas-state | Big 12 | 307 | 0 of 5 | 1 / 12 | 4 (1) | 2 | yes | 0 | no | no |
| oklahoma-state | Big 12 | 264 | 0 of 5 | 3 / 12 | 2 (1) | 0 | no | 0 | yes | no |
| notre-dame | Independent | 400 | 0 of 5 | 8 / 12 | 10 (6) | 2 | yes | 1 | no | no |

Anchor totals: matchup page for 20 of 25 (none for penn-state, oregon, florida-state, miami, oklahoma-state); kicker for 24 of 25; tradition doc for 2 of 25 (both docs have editoriallySeeded false and no narrative). Corpus-wide, verified games per school run min 0, median 1, max 13; arizona-state, illinois, kansas have zero verified games.

## 6. Sitewide passes (by reference)

Full detail: audit/cfb-phase0-sweep-summary.md. The browser-measured facts, from a headless Chrome computed-style probe over ten CFB surfaces (hub, rivalries index, a matchup page, contribute, and six school pages spanning dark, light, missing and stub palettes), with every color decoded through canvas pixels so no opacity-modified element was skipped:

- Fonts: --font-cfb-serif and --font-cfb-condensed resolve on every consumer (0 unresolved across the ten pages; Instrument Serif italic 400 and Barlow Condensed 600/700/800 report loaded). The entry-24 failure does recur for shared components that use font-rd inside CFB pages: on /cfb, 128 of 160 visible font-rd text elements render Outfit (the HubVenueLinks stadium names and sublines), school pages with a VenueHubLink card render its two lines in Outfit, and /cfb/contribute without ?school renders its 404 eyebrow in DM Sans. Cause: .font-rd compiles to var(--font-archivo), and --font-archivo is defined only by archivo.variable on redesign wrappers, which no CFB template attaches.
- Contrast on the #08070d base: text-white/25 2.11:1, /30 2.56:1, /35 3.11:1, /40 3.74:1, /45 4.48:1 (on the line), /55 and above pass. Per page, 43 to 45 of roughly 150 to 167 visible text elements fail on a school page, 72 of 342 on the hub, 113 of 397 on the rivalries index, 17 of 87 on a matchup page. The sitewide footer's text-white/40 on #211d18 measures 3.78:1 on every page and is not CFB-owned.
- Ink split: the CFB tree references nothing the split renamed or removed (it uses text-rd-ink, text-rd-ink-soft, bg/border-rd-ink, bg-rd-card, border-rd-line-strong in one light-variant component, and the legacy text-text-secondary in its dark variant).
- Every CFB route renders its own <main> inside the root layout's <main> (src/app/layout.tsx:154): two main landmarks measured on the hub, the rivalries index, matchup pages and school pages.

## Also reported in the Phase 0 pass

- cfbTraditions: 2 docs (checker-neyland, shamrock-series), editoriallySeeded false on both, no narratives, referenced by 0 schools, read by nothing in src/. The hub's THEME GAMES rail and its "theme Saturdays" sentence are the tradition claims without backing data (sweep summary rows 1, 2, 3 and 8).
- Hardcoded counts: none reach the DOM, JSON-LD, meta or llms.txt; 87, 32, 17 and 25 are all derived at render time. The hardcoded numerals that do render are years and dates in NATIONAL_CURATED, including EST. 1904 for Florida vs Georgia against a seriesStartYear of 1915 on the matchup page.
- Freshness: the hub's "UPDATES MONDAY AM" describes a date-derived rail window under 21600s ISR; no CFB refresh job exists in either repo's .github/workflows, every live cfbGames document carries fetchedAt 2026-07-07T16:40Z with verifiedAt no later than 2026-07-07T17:20Z, and 339 of 662 live games still show kickoff TBD.
- A developer note ships as visible 10px text on the hub (src/components/cfb/hub/CfbHubBrowse.tsx:78); nine em dashes sit in user-facing CFB strings; the matchup breadcrumb separator is not aria-hidden; /cfb/contribute without ?school renders a 404 view.
