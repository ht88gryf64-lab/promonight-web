# CFB Thin-Content Remediation Plan

Date: 2026-08-14. PLANNING ONLY: no page content written, no templates changed.
Problem set (from audit/raptive-page-mix.md, full-sitemap crawl 2026-08-14): 86 /cfb/[school] pages at median 267 words with 26.8% shared word 5-grams in the sampled pairs, and 32 /cfb/rivalries/[slug] pages at 101 to 115 words.
Evidence base for this plan: a fresh crawl of all 86 school and all 32 rivalry pages with exact verbatim-sentence and 5-gram document-frequency counts; read-only Firestore field-population stats over cfbSchools, cfbVenues, cfbRivalries, cfbGames, cfbTraditions; and a source-level inventory of every rendered block in both templates.

---

## 6a. What is driving the 26.8% overlap on school pages

Exact-sentence counting across all 86 pages finds only TWO full sentences carried verbatim on 86/86:

1. "Tap any game for its venue, kickoff, and gameday links. Kickoff times show once announced and confirmed on a second source; until then, Kickoff TBA." (the 25-word schedule legend, CfbSchoolPage.tsx:266; measured on 86/86, with the lead clause on 80/86 because 6 pages order content differently)
2. The contributor CTA block: "Know this place? Help us tell the story of a {shortName} Saturday, the traditions, the tailgate, why you go. Written by people who actually go. Contribute to this page." (CfbSchoolPage.tsx:368-379; about 27 of its 30 words identical on 86/86, only {shortName} varies)

Everything else shared is NOT full-sentence boilerplate. The 5-gram document-frequency pass shows where the remaining overlap lives:

| Shared material | Carriage | Source |
|---|---|---|
| Section scaffold and labels ("Plan your gameday", "2026 Schedule", "About the venue", "Location", "Capacity", "Rivalry Games", "Rivalry guides", back link) | 86/86 | hardcoded literals across CfbSchoolPage.tsx |
| Affiliate CTA copy ("Get Tickets" x2, "SpotHero", "Reserve Parking", "Find hotels near {stadium}", "2 guests via Expedia", "Shop Fan Gear", "Full gameday guide, parking, bag policy and gameday info for {building}") | 64-86/86 depending on which CTAs render | shared affiliate components |
| Rivalry sentence skeleton "The {A} vs {B} rivalry, known as {X}, is played on Saturday, {Month D} at {venue}" | 48-54/86 | buildRivalrySentences template, page-extras.ts:35-60 |
| Schedule-row micro-patterns ("Kickoff TBA" on most rows, "Sep 5 vs" week-1 alignment on 43/86, broadcast lines) | 43-80/86 | cfbGames rows; only 267/670 games are kickoff-verified so "Kickoff TBA" repeats |

Decomposition of a median page (about 250-267 words): roughly 55-65 words are byte-identical scaffold, legend, and CTA copy; another 30-60 words are field-templated skeletons (rivalry sentences, venue panel, gameday line) where only nouns and dates vary; the genuinely per-school remainder is the schedule table plus a handful of names and numbers.

**Answer to the ranked-fix question:** rewriting the handful of boilerplate strings will NOT meaningfully fix similarity. The two verbatim sentences plus labels are about a quarter of the page, but they read as UI chrome, and rewording them per school would be cosmetic. The overlap ratio is high because the DENOMINATOR is small: there is almost no per-school prose for the scaffold to dilute into. The fix is adding genuinely per-school content. (Side observation: the contributor CTA carries an em dash in user-facing copy, against the house rule; fix opportunistically whenever that string is next touched.)

## 6b. School pages: what existing data can support more content today

Live Firestore reads, 2026-08-14:

| Source | Population | Usable for content now |
|---|---|---|
| cfbSchools identity (name, shortName, mascot, conference) | 86/86 | already rendered; nothing left to mine, and there are NO prose fields in the collection |
| cfbSchools.traditionIds | 0/86 (cfbTraditions collection holds 2 docs total, both Tennessee-adjacent) | the traditions slot is effectively empty sitewide |
| cfbVenues name, lat, lng, city | 86/86 (CORRECTION: the task premise said city missing on 59/86; the live read shows city populated on 86/86, docs updated 2026-07-07, so that constraint no longer holds) | city and name already render; no untapped words |
| cfbVenues.state | 85/86 | could join the Location row (+1 word) |
| cfbVenues.capacity | 73/86 (64 verified) | 13 missing rows suppress the Capacity line (+2 words each when backfilled) |
| cfbGames | 670 games, about 12-13 rows per rendered school; 267/670 kickoff-verified; broadcast, week, neutralSite, conferenceGame, themeDesignations, rivalryId fields exist per game | the single biggest data mass; verification progression converts "Kickoff TBA" to real times (word-neutral) and adds network lines; themeDesignations and week/conference flags are rendered thinly or not at all |
| editorial.* slots (signatureGameId, whyYouGo, gamedayCulture, venueInTheirWords, contributor) | null on all 86 (hardcoded null at src/lib/cfb/data.ts:279) | the Phase 4 graduation slots: the template ALREADY renders these sections when populated (CfbSchoolPage.tsx:186-220, 273-280, 358-365); this is where editorial words plug in with zero template work |
| 2026-07-31 evergreen harvest (all 86 schools, logs/cfb-evergreen-full + archive) | harvested but venueHubs extraction paused at 20/86 (project cfb-phase3b) | not new research, but extraction labor; primarily thickens /venues pages and unlocks the VenueHubLink card (11-13 words) on school pages, currently visible on only about 21 of 86 |

## 6c. School page word-count ceiling from existing verified data, no new editorial

Additions achievable purely from data already held:

- Kickoff/broadcast verification progression through the season: word-neutral on times, +1-2 words per confirmed-broadcast row, call it +15-25 words by mid-season, automatic via the existing verification pipeline.
- Venue panel completion (capacity x13 schools, state): +2-3 words.
- Rendering unrendered game fields (week numbers, conference-game flags, neutral-site labels, themeDesignations where present): +20-40 words, small template change.
- Extending matchup pages so the rivalry rail and rivalry sections reach the 41 schools that currently lack them (the registry holds 212 rivalries against 33 built pages): +25-60 words on those 41 pages, but this multiplies the thin-page problem unless rivalry pages are thickened first (see 6d).

**Realistic data-only ceiling: median moves from about 267 to about 330-380 words.** The scaffold share falls only modestly. No path built from existing verified data alone reaches even 500 words, because the collections simply contain no prose: every prose slot in the template is an editorial field that is null on all 86. Thickening past about 380 words is an editorial problem, not a rendering problem.

## 6d. Rivalry pages: same three questions

**Overlap driver.** Measured: 24/32 pages carry the ENTIRE 37-51 word "Plan the trip" timeline verbatim ("Rivalry games sell out. Resale is usually the route." / "Rooms near campus go early on rivalry weekend." / "Reserve ahead and walk in." / "Bag rules, gate times and transit for this stadium." plus the step labels); the 8 without the parking step carry the rest. The identical-by-design decision is documented in-code (RivalryMatchupPage.tsx:16-17). On a 101-128 word page, 40-50 words are this literal scaffold, another 25-35 are labels, breadcrumb, and stat headings, and the ONLY per-page prose is one generated 17-22 word sentence (the same buildRivalrySentences skeleton the school pages use). These pages are 70-80 percent shared material by construction.

**Available fields.** The task premise said cfbRivalries has narrative fields available. The live read corrects this: the schema slot cfbRivalries.narrative is declared (src/lib/cfb/types.ts:175) but is populated on 0 docs, has NO reader anywhere in src/, and the phase-2 seed shape omits it. What actually exists: trophy name 25/32 of the rendered family (rendered only inside the sentence, and dropped when it equals the title), trophyCreatedYear 4/32, seriesStartYear 32/32, source URL 32/32 (never rendered on matchup pages), and matchup-description.ts, a hand-written 140-160 character description per rivalry that feeds ONLY the meta tag today.

**Data-only ceiling.** Surfacing what exists with small template changes and zero new writing: the matchup description as a visible lede (+20-25 words, already written), the trophy's proper name as its own element (+2-7), a series prose line from seriesStartYear (+8-12), the source citation link (+0 words, trust signal), the gates-and-bags step wherever a venue hub goes indexable (+14). **Ceiling: roughly 160-190 words.** Still the thinnest family on the site.

**Editorial path.** Populate cfbRivalries.narrative (write the reader + render block once, about half a day of template work for the whole family) at 100-150 words per rivalry: pages reach roughly 260-330 words. A deeper treatment (history, stakes, tailgate culture at 300-400 words) reaches 450-550.

## 6e. Cost to close the gap, and the noindex comparison

Per-page hour estimates. Pipeline-generatable means template/eng work amortized across the family plus data ops with no net-new writing; editorial-required means researched, source-verified human prose (the CFB house standard: every fact carries a live-verified source).

| Work | Scope | Pipeline-generatable | Editorial-required | Result |
|---|---|---|---|---|
| School: surface unrendered game/venue fields + data backfills | 86 pages | 6-9 eng hrs total (about 0.1 hr/page) | 0 | median ~267 to ~330-380 |
| School: Phase 4 editorial slots (whyYouGo, gamedayCulture, venueInTheirWords, signature game, 2-4 traditions per school) | 86 pages | ~2 hrs total (slots already render; data entry tooling exists) | 1.5-2.5 hrs/page = 130-215 hrs | +250-400 words/page, median ~550-650 |
| School: to a 900-1000 word standard | 86 pages | included above | 3-5 hrs/page = 260-430 hrs | competitive long-form pages |
| Rivalry: surface existing fields (lede from matchup-description, trophy, series line, citation) | 32 pages | 4-6 eng hrs total | 0 | ~110 to ~160-190 |
| Rivalry: narrative field, reader + render + 100-150 words each | 32 pages | 4 eng hrs total | 0.75-1.25 hrs/page = 24-40 hrs | ~260-330 words/page |
| Rivalry: deep treatment 300-400 words | 32 pages | included | 1.5-2.5 hrs/page = 48-80 hrs | ~450-550 words/page |
| Harvest extraction resume (venue hubs 20/86 to 86/86) | 65 buildings | 20-27 hrs data ops (pipeline-assisted, human-verified) | 0 | thickens /venues pages; +11-13 words and a real logistics link on school pages |

**The two numbers demanded:**

- **Thickening path:** to a defensible mid-tier (schools at ~550-650 via Phase 4 slots, rivalries at ~260-330 via narrative), total is roughly **165-270 editorial hours plus about 20 engineering/data hours**. The cheap data-only tier alone (about 15 eng hours, no editorial) moves schools +60-110 words and rivalries +50-80 words and does NOT change the thin-content character of either family. A phased version front-loads the ~25 highest-brand schools and the ~12 marquee rivalries before the season opener (roughly 50-75 editorial hours) and finishes the tail in-season.
- **Noindex path:** noindexing all 118 pages costs zero hours and removes every thin page from the Raptive sample, but forfeits the CFB organic bet two weeks before its season, on pages already indexed and IndexNow-submitted (school family live since 2026-07-16, matchup family since 2026-08-11) with GSC evidence still accumulating. A scoped variant exists: the 32 rivalry pages are the thinnest and most-templated family (101-115 words, 70-80 percent shared) and could be noindexed alone until narrative lands, while the 86 school pages, which are thin but data-dense and improving weekly via kickoff verification, stay indexed. That variant costs the ~28-46 hour rivalry work later instead of never.

Decision inputs, not a recommendation: the thickening cost is real but front-loadable; the noindex saving is real but spends the strategic reason the pages exist. Whichever way this goes, the data-only tier (about 15 eng hours) and the rivalry lede surfacing are worth doing under every scenario, including the noindex one, because they also improve the pages users already reach from internal links.

---

Method note: sentence and 5-gram counts from a 2026-08-14 crawl of all 118 pages (main-content extraction matching audit/raptive-page-mix.ts); field stats from read-only firebase-admin queries the same day; block inventory from source at the cited file:line locations. The task premise that cfbVenues.city is missing on 59/86 no longer holds (86/86 populated as of the 2026-07-07 doc updates); the premise that cfbRivalries has narrative fields available is true of the schema but not the data (0/212 docs populated, no reader in code).
