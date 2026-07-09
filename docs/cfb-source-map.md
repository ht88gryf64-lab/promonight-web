# CFB Source Map — 2026 Discovery Sweep (Firecrawl)

**Generated:** 2026-06-28 · **Scope:** read-only source-discovery sweep (no Firestore writes, no schema, no pages, no pipeline changes). Sits IN FRONT of the paused CFB Phase 2 (`audit/cfb-phase1-PAUSED.md`, branch `cfb-phase1` @ `429e32d`); it informs Phase 2's source-independence fix, it does not start it.

**Method:** Firecrawl Hobby tier (concurrency-controlled, `/v2/scrape` markdown + `/v2/map` discovery — same pattern as the MLS/WNBA sweep), reusing the proven `promo-pipeline/lib/extract/firecrawl-fetch.js` guards (waitFor 8s, thin-retry 15s, error-page signatures, 429 backoff). Wikipedia season/venue/rivalry page titles resolved via the free MediaWiki search API. **Render = content returned, not HTTP 200** (every verdict below is content-confirmed). Per-school dumps checkpointed; 86/86 schools were then independently re-verified by per-school agents that read the raw markdown and judged each source from content.

---

## Headline — the question this sweep exists to answer

> **82 of 86 schools can get ≥2 independent, render-confirmed sources that carry the 2026 SCHEDULE under Firecrawl. 4 are still single-source-stranded — all G5, and only because their Wikipedia 2026 season page and Sports-Reference 2026 schedule are *not yet published this far out* (a timing gap), not because anything is crawler-blocked.**

**The Phase-1 corroboration residue collapses.** Phase 1's residue was Kansas State (13 games): its parser used Wikipedia, and its official athletics site was crawler-blocked to plain `fetch`, leaving no independent code-fetchable second domain. **Under Firecrawl, Kansas State's official site renders cleanly** — and so does every other official site (86/86). Official + Wikipedia are now two independent render-confirmed schedule sources for 82 schools.

### Source availability across 86 schools

| Source type | Render-confirmed | Notes |
|---|---|---|
| **Official** 2026 schedule | **86/86** | every athletics site renders via Firecrawl, incl. the Phase-1-blocked ones |
| **Wikipedia** 2026 season | 82/86 | 4 G5 pages not yet created (confirmed via exact-title API) |
| **Sports-Reference** 2026 | **0/86** | **2026 schedules not published yet** — universal, all 404 |
| Sports-Reference *reachable* (2025 probe) | 86/86 | SR renders fine via Firecrawl; purely a publish-timing gap |
| Venue (stadium Wikipedia) | 86/86 | home stadium resolved from the season-page infobox |
| Rivalry (Wikipedia) | 86/86 | rivalry/trophy page resolved per school |
| Theme / promotions page | 48/86 | durable promo page on the official site; rest = editorial layer |

**Sports-Reference verdict (adversarial check #3):** SR is *not* blocked — the 2025 schedule pages render with full rows for all 86 slugs (proving slug + reachability). But the **2026** season pages (`/cfb/schools/<slug>/2026-schedule.html`) 404 across the board, and the SR school-index pages carry no 2026 schedule rows. So SR carries **zero** 2026 schedule data today; it is a latent 3rd source that will light up as the season nears, not a present corroborator.

### Stranded schools (4) — single-source under Firecrawl *today*

| School | Has now | Missing 2nd source | Why (not a tooling failure) |
|---|---|---|---|
| James Madison (G5) | official ✅ | Wikipedia 2026 ❌ + SR 2026 ❌ | Wikipedia 2026 season article not yet created; SR 2026 unpublished — both resolve as the season nears |
| Marshall (G5) | official ✅ | Wikipedia 2026 ❌ + SR 2026 ❌ | Wikipedia 2026 season article not yet created; SR 2026 unpublished — both resolve as the season nears |
| Toledo (G5) | official ✅ | Wikipedia 2026 ❌ + SR 2026 ❌ | Wikipedia 2026 season article not yet created; SR 2026 unpublished — both resolve as the season nears |
| Northern Illinois (G5) | official ✅ | Wikipedia 2026 ❌ + SR 2026 ❌ | Wikipedia 2026 season article not yet created; SR 2026 unpublished — both resolve as the season nears |

These are **honest, self-healing** gaps: each already has a fully-rendering official 2026 schedule, and both secondary sources (Wikipedia, SR) are render-confirmed *reachable* — they simply have no 2026 content yet for these lower-profile G5 programs in late June. None is crawler-blocked.

## Systematic patterns

- **All 86 official athletics sites render via Firecrawl** (the Phase-1 crawler-block is gone as a fetch-layer problem).
- **Sports-Reference has no 2026 schedules published yet** — universal across all conferences; render-confirmed reachable on 2025.
- **Sidearm-vendor official pages render as compressed lists/widgets, not clean tables** — date+time concatenation can defeat naive row counters (e.g. Miami); extraction needs tolerance for that.
- **Wikipedia 2026 season pages exist for all P4 + independents; 4 G5 lag** (not-yet-created).
- **Theme/promotions pages thin on the G5 tail** — consistent with the spec's "soft data is manual editorial" finding.

## Per-school source table (86)

Cell = render · shape · confidence. Render: ✅ content returned · ⚠️ rendered but wrong/empty/shell · ❌ not-found/blocked/unpublished. Shape: tbl/list/prose/js/mix. Confidence: H/M/L. "2nd-src" = independent render-confirmed sources carrying the **2026 schedule**.


### SEC

| School | Official | Wikipedia 2026 | Sports-Ref 2026 | Venue | Rivalry | Theme | 2nd-src |
|---|---|---|---|---|---|---|---|
| Alabama | ✅ list H | ✅ tbl H | ❌ (rchbl) | ✅ prose H | ✅ mix M | ◐ derived | 2 |
| Arkansas | ✅ list H | ✅ tbl H | ❌ (rchbl) | ✅ mix H | ✅ mix H | ◐ derived | 2 |
| Auburn | ✅ mix H | ✅ tbl H | ❌ (rchbl) | ✅ prose H | ✅ mix H | ✅ | 2 |
| Florida | ✅ list H | ✅ tbl H | ❌ (rchbl) | ✅ prose H | ✅ mix H | ◐ derived | 2 |
| Georgia | ✅ list H | ✅ tbl H | ❌ (rchbl) | ✅ mix H | ✅ mix H | ◐ derived | 2 |
| Kentucky | ✅ list H | ✅ tbl H | ❌ (rchbl) | ✅ prose H | ✅ mix H | ❌ | 2 |
| LSU | ✅ mix H | ✅ tbl H | ❌ (rchbl) | ✅ mix L ⚠wrong | ✅ mix H | ◐ derived | 2 |
| Ole Miss | ✅ list H | ✅ tbl H | ❌ (rchbl) | ✅ prose H | ✅ mix H | ◐ derived | 2 |
| Mississippi State | ✅ list H | ✅ tbl H | ❌ (rchbl) | ✅ prose H | ✅ mix H | ✅ | 2 |
| Missouri | ✅ list H | ✅ tbl H | ❌ (rchbl) | ✅ prose H | ✅ mix H | ✅ | 2 |
| Oklahoma | ✅ list H | ✅ tbl H | ❌ (rchbl) | ✅ prose H | ✅ mix H | ◐ derived | 2 |
| South Carolina | ✅ mix H | ✅ tbl H | ❌ (rchbl) | ✅ mix H | ✅ mix H | ✅ | 2 |
| Tennessee | ✅ list H | ✅ tbl H | ❌ (rchbl) | ✅ mix H | ✅ mix H | ◐ derived | 2 |
| Texas | ✅ list H | ✅ tbl H | ❌ (rchbl) | ✅ prose H | ✅ mix M | ✅ | 2 |
| Texas A&M | ✅ list H | ✅ tbl H | ❌ (rchbl) | ✅ prose L ⚠wrong | ✅ mix H | ✅ | 2 |
| Vanderbilt | ✅ mix H | ✅ tbl H | ❌ (rchbl) | ✅ prose H | ✅ prose H | ✅ | 2 |

### Big Ten

| School | Official | Wikipedia 2026 | Sports-Ref 2026 | Venue | Rivalry | Theme | 2nd-src |
|---|---|---|---|---|---|---|---|
| Illinois | ✅ mix H | ✅ tbl H | ❌ (rchbl) | ✅ mix H | ✅ mix M | ✅ | 2 |
| Indiana | ✅ list H | ✅ tbl H | ❌ (rchbl) | ✅ prose L ⚠wrong | ✅ mix M | ◐ derived | 2 |
| Iowa | ✅ mix H | ✅ tbl H | ❌ (rchbl) | ✅ mix H | ✅ mix H | ✅ | 2 |
| Maryland | ✅ mix H | ✅ tbl H | ❌ (rchbl) | ✅ mix H | ✅ mix H | ✅ | 2 |
| Michigan | ✅ mix H | ✅ tbl H | ❌ (rchbl) | ✅ prose H | ✅ prose H | ✅ | 2 |
| Michigan State | ✅ mix H | ✅ tbl H | ❌ (rchbl) | ⚠️ mix L ⚠wrong | ✅ mix H | ✅ | 2 |
| Minnesota | ✅ mix H | ✅ tbl H | ❌ (rchbl) | ✅ mix H | ✅ mix H | ✅ | 2 |
| Nebraska | ✅ mix H | ✅ tbl H | ❌ (rchbl) | ⚠️ list L ⚠wrong | ✅ mix H | ✅ | 2 |
| Northwestern | ✅ list H | ✅ tbl H | ❌ (rchbl) | ✅ list L ⚠wrong | ✅ mix M | ◐ derived | 2 |
| Ohio State | ✅ list H | ✅ tbl H | ❌ (rchbl) | ✅ mix H | ✅ mix H | ◐ derived | 2 |
| Oregon | ✅ list H | ✅ tbl H | ❌ (rchbl) | ✅ prose H | ✅ mix H | ✅ | 2 |
| Penn State | ✅ mix H | ✅ tbl H | ❌ (rchbl) | ✅ prose H | ✅ mix H | ✅ | 2 |
| Purdue | ✅ tbl H | ✅ tbl H | ❌ (rchbl) | ✅ prose H | ✅ mix M | ✅ | 2 |
| Rutgers | ✅ mix H | ✅ tbl H | ❌ (rchbl) | ✅ prose H | ✅ mix M | ✅ | 2 |
| USC | ✅ list H | ✅ tbl H | ❌ (rchbl) | ✅ mix H | ✅ prose H | ✅ | 2 |
| UCLA | ✅ list H | ✅ tbl H | ❌ (rchbl) | ✅ mix L ⚠wrong | ✅ mix M | ◐ derived | 2 |
| Washington | ✅ mix H | ✅ tbl H | ❌ (rchbl) | ✅ prose H | ✅ mix H | ✅ | 2 |
| Wisconsin | ✅ list H | ✅ tbl H | ❌ (rchbl) | ✅ prose H | ✅ mix H | ◐ derived | 2 |

### ACC

| School | Official | Wikipedia 2026 | Sports-Ref 2026 | Venue | Rivalry | Theme | 2nd-src |
|---|---|---|---|---|---|---|---|
| Boston College | ✅ mix H | ✅ tbl H | ❌ (rchbl) | ✅ prose H | ✅ prose H | ✅ | 2 |
| California | ✅ mix H | ✅ tbl H | ❌ (rchbl) | ✅ mix H | ✅ mix H | ✅ | 2 |
| Clemson | ✅ tbl H | ✅ tbl H | ❌ (rchbl) | ✅ prose L ⚠wrong | ✅ mix H | ✅ | 2 |
| Duke | ✅ list H | ✅ tbl H | ❌ (rchbl) | ✅ prose H | ✅ mix H | ◐ derived | 2 |
| Florida State | ✅ list H | ✅ tbl H | ❌ (rchbl) | ✅ mix H | ✅ mix H | ✅ | 2 |
| Georgia Tech | ✅ prose H | ✅ tbl H | ❌ (rchbl) | ✅ mix H | ✅ mix M | ❌ | 2 |
| Louisville | ✅ list H | ✅ tbl H | ❌ (rchbl) | ✅ mix H | ✅ mix H | ✅ | 2 |
| Miami | ✅ mix H | ✅ tbl H | ❌ (rchbl) | ✅ mix H | ✅ mix H | ✅ | 2 |
| North Carolina | ✅ list H | ✅ tbl H | ❌ (rchbl) | ✅ prose H | ✅ mix H | ✅ | 2 |
| NC State | ✅ mix H | ✅ tbl H | ❌ (rchbl) | ✅ prose H | ✅ mix H | ✅ | 2 |
| Pittsburgh | ✅ mix H | ✅ tbl H | ❌ (rchbl) | ✅ mix H | ✅ mix H | ✅ | 2 |
| SMU | ✅ list H | ✅ tbl H | ❌ (rchbl) | ✅ mix H | ✅ mix H | ✅ | 2 |
| Stanford | ✅ tbl H | ✅ tbl H | ❌ (rchbl) | ✅ mix H | ✅ mix H | ✅ | 2 |
| Syracuse | ✅ list H | ✅ tbl H | ❌ (rchbl) | ✅ mix H | ✅ mix H | ✅ | 2 |
| Virginia | ✅ mix H | ✅ tbl H | ❌ (rchbl) | ✅ mix H | ✅ mix H | ✅ | 2 |
| Virginia Tech | ✅ mix H | ✅ tbl H | ❌ (rchbl) | ✅ mix H | ✅ mix M | ✅ | 2 |
| Wake Forest | ✅ list H | ✅ tbl H | ❌ (rchbl) | ✅ mix H | ✅ mix H | ✅ | 2 |

### Big 12

| School | Official | Wikipedia 2026 | Sports-Ref 2026 | Venue | Rivalry | Theme | 2nd-src |
|---|---|---|---|---|---|---|---|
| Arizona | ✅ list H | ✅ tbl H | ❌ (rchbl) | ✅ prose H | ✅ prose H | ✅ | 2 |
| Arizona State | ✅ tbl H | ✅ tbl H | ❌ (rchbl) | ✅ prose H | ✅ prose H | ✅ | 2 |
| Baylor | ✅ list H | ✅ tbl H | ❌ (rchbl) | ✅ prose H | ✅ prose H | ✅ | 2 |
| BYU | ✅ list H | ✅ tbl H | ❌ (rchbl) | ✅ prose H | ✅ prose H | ❌ | 2 |
| UCF | ✅ list H | ✅ tbl H | ❌ (rchbl) | ✅ prose H ⚠wrong | ✅ prose H | ◐ derived | 2 |
| Cincinnati | ✅ mix H | ✅ tbl H | ❌ (rchbl) | ✅ prose H | ✅ prose H ⚠wrong | ✅ | 2 |
| Colorado | ✅ list H | ✅ tbl H | ❌ (rchbl) | ✅ mix H | ✅ mix M | ✅ | 2 |
| Houston | ✅ list H | ✅ tbl H | ❌ (rchbl) | ✅ prose H | ✅ mix H | ◐ derived | 2 |
| Iowa State | ✅ mix H | ✅ tbl H | ❌ (rchbl) | ✅ mix H | ✅ mix H | ✅ | 2 |
| Kansas | ✅ list H | ✅ tbl H | ❌ (rchbl) | ✅ mix H | ✅ mix H | ✅ | 2 |
| Kansas State | ✅ mix H | ✅ tbl H | ❌ (rchbl) | ✅ mix H | ✅ mix H | ✅ | 2 |
| Oklahoma State | ✅ list H | ✅ tbl H | ❌ (rchbl) | ✅ mix H | ✅ mix L ⚠wrong | ✅ | 2 |
| TCU | ✅ mix H | ✅ tbl H | ❌ (rchbl) | ✅ mix H | ✅ mix H | ✅ | 2 |
| Texas Tech | ✅ list H | ✅ tbl H | ❌ (rchbl) | ✅ prose H | ✅ mix H | ◐ derived | 2 |
| Utah | ✅ list H | ✅ tbl H | ❌ (rchbl) | ✅ mix H | ✅ mix H | ◐ derived | 2 |
| West Virginia | ✅ list H | ✅ tbl H | ❌ (rchbl) | ✅ prose H | ✅ prose M | ✅ | 2 |

### Independent

| School | Official | Wikipedia 2026 | Sports-Ref 2026 | Venue | Rivalry | Theme | 2nd-src |
|---|---|---|---|---|---|---|---|
| UConn | ✅ list H | ✅ tbl H | ❌ (rchbl) | ✅ prose H | ✅ mix H | ◐ derived | 2 |
| Notre Dame | ✅ mix H | ✅ tbl H | ❌ (rchbl) | ✅ prose H | ✅ prose H | ✅ | 2 |

### G5

| School | Official | Wikipedia 2026 | Sports-Ref 2026 | Venue | Rivalry | Theme | 2nd-src |
|---|---|---|---|---|---|---|---|
| Air Force | ✅ list H | ✅ tbl H | ❌ (rchbl) | ✅ prose H | ✅ mix H | ◐ derived | 2 |
| App State | ✅ mix H | ✅ tbl H | ❌ (rchbl) | ✅ prose H | ✅ mix H | ✅ | 2 |
| Army | ✅ list H | ✅ tbl H | ❌ (rchbl) | ✅ mix H | ✅ mix H ⚠wrong | ◐ derived | 2 |
| Boise State | ✅ list H | ✅ tbl H | ❌ (rchbl) | ✅ mix H | ✅ mix H | ◐ derived | 2 |
| Coastal Carolina | ✅ mix H | ✅ tbl H | ❌ (rchbl) | ✅ mix H | ✅ mix H | ✅ | 2 |
| Fresno State | ✅ list H | ✅ tbl H | ❌ (rchbl) | ✅ mix H | ✅ mix M | ◐ derived | 2 |
| James Madison | ✅ list H | ❌ not-yet-created | ❌ (rchbl) | ✅ prose H | ✅ mix H | ✅ | **1** ⚠️ |
| Liberty | ✅ list H | ✅ tbl H | ❌ (rchbl) | ✅ prose H | ✅ mix M | ◐ derived | 2 |
| Marshall | ✅ list H | ❌ not-yet-created | ❌ (rchbl) | ✅ mix H | ✅ mix M | ✅ | **1** ⚠️ |
| Memphis | ✅ list H | ✅ tbl H | ❌ (rchbl) | ✅ prose H | ✅ mix M | ✅ | 2 |
| Navy | ✅ mix H | ✅ tbl H | ❌ (rchbl) | ✅ prose H | ✅ prose M ⚠wrong | ✅ | 2 |
| UNLV | ✅ mix H | ✅ tbl H | ❌ (rchbl) | ✅ mix H | ✅ tbl H ⚠wrong | ✅ | 2 |
| Northern Illinois | ✅ list H | ❌ not-yet-created | ❌ (rchbl) | ✅ prose H | ✅ prose H ⚠wrong | ✅ | **1** ⚠️ |
| San Diego State | ✅ mix H | ✅ tbl H | ❌ (rchbl) | ✅ mix H | ✅ mix H | ✅ | 2 |
| USF | ✅ list H | ✅ tbl H | ❌ (rchbl) | ✅ prose H | ✅ prose H | ✅ | 2 |
| Toledo | ✅ list H | ❌ not-yet-created | ❌ (rchbl) | ✅ mix H | ✅ mix H | ✅ | **1** ⚠️ |
| Tulane | ✅ list H | ✅ tbl H | ❌ (rchbl) | ✅ prose H | ✅ mix M | ✅ | 2 |

## Traps & data-quality flags

- **Alabama** — theme: wrong-page
- **Arkansas** — theme: wrong-page
- **Georgia** — theme: landing-page
- **LSU** — venue: wrong-page; venue: resolved page may be wrong; theme: stale-year
- **Mississippi State** — theme: wrong-page
- **Missouri** — theme: wrong-page
- **Oklahoma** — theme: wrong-page
- **South Carolina** — theme: wrong-page
- **Texas A&M** — venue: wrong-page; venue: resolved page may be wrong
- **Vanderbilt** — theme: wrong-page
- **Indiana** — venue: wrong-page; venue: resolved page may be wrong; theme: wrong-page
- **Maryland** — theme: stale-year
- **Michigan** — theme: landing-page
- **Michigan State** — venue: wrong-page; venue: resolved page may be wrong
- **Minnesota** — theme: stale-year
- **Nebraska** — venue: wrong-page; venue: resolved page may be wrong; theme: landing-page
- **Northwestern** — venue: wrong-page; venue: resolved page may be wrong; theme: stale-year
- **Ohio State** — theme: wrong-page
- **Purdue** — official: none (but stale 2025 result-cards cached at top of markdown; real 2026 table is separate and clean); rivalry: none (genuine Indiana–Purdue rivalry page, but it is the multi-sport/basketball-heavy rivalry article, not the football-specific Old Oaken Bucket page); theme: landing-page (dedicated /football-promotions renders only a '2026 Season Promotions Coming Soon!' placeholder; real 2026 theme signal lives as designations on the official schedule: Homecoming vs Maryland, Shillelagh/Cannon/Old Oaken Bucket trophy games)
- **Rutgers** — theme: wrong-page
- **UCLA** — venue: wrong-page; venue: resolved page may be wrong; theme: landing-page
- **Washington** — theme: stale-year
- **Wisconsin** — theme: wrong-page
- **Boston College** — theme: wrong-page
- **California** — theme: stale-year
- **Clemson** — venue: wrong-page; venue: resolved page may be wrong
- **Duke** — rivalry: basketball-leaning page (football trophy is Victory Bell/Tobacco Road) but genuinely a Duke rivalry; theme: none — no durable football promo page; official schedule list shows no theme designations; mapSample hits are other sports (W-soccer/volleyball/W-bball)
- **Florida State** — theme: stale-year
- **Georgia Tech** — theme: wrong-page
- **Louisville** — theme: wrong-page
- **Pittsburgh** — theme: wrong-page
- **Virginia** — theme: landing-page
- **Virginia Tech** — official: none (top rows are 2025 results + radio 'Tech Talk Live' watch-parties, but full 2026 slate is present); rivalry: none (genuine VT rivalry page, but it resolved to the secondary Georgia Tech-VT rivalry, not the marquee Commonwealth Cup vs Virginia); theme: none (top ~870 lines are a generic cross-sport recent-results feed; real 2026 football promo content is lower in the page)
- **Arizona State** — theme: wrong-sport
- **Baylor** — theme: wrong-page
- **BYU** — theme: stale-year
- **UCF** — venue: wrong-page; venue: resolved page may be wrong; theme: wrong-sport
- **Cincinnati** — rivalry: wrong-page; rivalry: resolved page may be wrong; theme: wrong-sport
- **Houston** — theme: stale-year
- **Iowa State** — theme: landing-page
- **Kansas** — theme: wrong-page
- **Kansas State** — theme: wrong-page
- **Oklahoma State** — rivalry: wrong-page; rivalry: resolved page may be wrong; theme: wrong-page
- **TCU** — theme: wrong-page
- **Texas Tech** — theme: landing-page
- **Utah** — theme: wrong-page
- **West Virginia** — rivalry: secondary-rivalry; theme: derived-from-official
- **UConn** — theme: stale-year
- **Notre Dame** — theme: wrong-sport
- **Air Force** — theme: landing-page
- **Army** — rivalry: wrong-page; rivalry: resolved page may be wrong; theme: wrong-page (promotions/395/click redirects to a SeatGeek ticket-resale page) + wrong-sport (mapSample promo links are Army HOCKEY promotional schedules, not football); no durable 2026 football theme/promotions page exists
- **Boise State** — theme: neutral-rows-missing
- **Fresno State** — theme: landing-page
- **James Madison** — theme: stale-year
- **Memphis** — theme: stale-year
- **Navy** — rivalry: wrong-page; rivalry: resolved page may be wrong
- **UNLV** — rivalry: wrong-page; rivalry: resolved page may be wrong
- **Northern Illinois** — rivalry: wrong-page; rivalry: resolved page may be wrong; theme: stale-year
- **San Diego State** — theme: stale-year
- **USF** — theme: landing-page
- **Toledo** — theme: landing-page
- **Tulane** — official: none — clean 2026 12-game list view; header '2026 Football Schedule', year dropdown set to 2026, 2026 game-center IDs (23448+) and 2026-dated sponsor/TV assets. Fresh slate, not a stale-2025 default.; wikiSeason: none — genuine 2026 page (NOT the G5 not-yet-created case); clean schedule table of all 12 games plus per-game summary subsections, matching the official site opponent-for-opponent.; venue: none — infobox confirms Benson Field at Yulman Stadium: owner Tulane University, sole tenant Tulane Green Wave football (2014–present), 30,000 capacity, on the Uptown New Orleans campus. Correctly the on-campus home, NOT the Caesars Superdome it replaced and NOT an NFL venue.; rivalry: secondary-rivalry caveat — resolved to Ole Miss–Tulane, a real Tulane rivalry page, but its own lede calls it Tulane's SECOND-oldest rivalry and Ole Miss is NOT on the 2026 slate. The schedule-active rivalry is Battle for the Bell vs Southern Miss (Sep 26, the 'Hall of Fame' game, which Wikipedia's schedule tags as Battle for the Bell); the oldest is Battle for the Rag vs LSU. Defensible (Ole Miss played Tulane twice in 2025, incl. CFP first round) but not the schedule-relevant rivalry.; theme: no durable standalone 2026 football promo page — mapSample returns only stale/wrong-sport pages (2016 FB promos, 2020 baseball & WBB promotions). Theme is instead carried as designations ON the official 2026 schedule: Southern Miss 'Hall of Fame' (Sep 26), Tulsa 'Homecoming' (Nov 7), plus per-game presenting sponsors (American Safety, Mannings, Coke, LCMC, Capital One, Paretti). Dump's theme=NOT-FOUND undercounts these on-schedule, correct-sport, 2026 designations.

## Verification reconciliation

86/86 schools were independently re-verified by a per-school agent that read the raw rendered markdown and judged each source from content; the remaining 0 rest on the deterministic content-based pass.

The agent pass **agreed** with the deterministic 2nd-source verdict on every school it checked — no school's headline count changed under content re-verification (no stale-2025-default or shell traps flipped a schedule source).

## Build-approach notes (for Phase 2)

- **Source-independence fix is satisfied by the fetch-layer swap.** Make the parser fetch the **official athletics site** via Firecrawl (renders 86/86) and keep **Wikipedia** as the independent corroborator. That alone gives 82/86 schools a render-confirmed 2-domain corroboration — the Phase-1 Kansas-State class is resolved.
- **Add Sports-Reference as a 3rd corroborator, season-gated.** SR is render-confirmed reachable but has no 2026 schedules yet; wire it as an *optional* second deterministic source that activates once `<slug>/2026-schedule.html` returns 200 (re-probe on the in-season cadence). Until then it contributes nothing — do not block on it.
- **The 4 stranded G5 schools (JMU, Marshall, Toledo, NIU)** ship on the official source alone until their Wikipedia 2026 page exists; flag them under the per-school corroboration floor and re-check weekly. This is the offseason-timing residue, not a coverage hole.
- **Official pages need widget-tolerant extraction.** Sidearm/WMT schedule pages render as compressed lists where date+time concatenate; a naive per-row date regex undercounts (Miami rendered the full 2026 slate but counted 1 "row"). Parse on month-token proximity, not strict line boundaries.
- **Venue resolution needs hardening — the agents flagged ~13 mis-resolutions.** The "most-frequent stadium phrase in the season page" heuristic beats a blind Wikipedia search (which returned *Arrowhead Stadium* for Kansas State) and handles the season-absent fallback (Toledo → Glass Bowl), but it still grabs neutral-site or namesake stadiums for ~15% of schools (see the wrong-flags in the table/traps). For the build, resolve the venue from the **infobox stadium hyperlink** on the season/program page rather than a text-frequency guess.
- **Theme designations are the manual-editorial layer** (per the locked spec). Durable promo pages exist on 48/86 official sites; the rest need official-news monitoring or editorial seeding — and the G5 tail is thinnest, matching the spike's "soft data cost rises down the fame curve."

## Adversarial self-check

1. **Render confirmed from content, not status.** Every "render YES" required returned markdown above a content threshold with schedule/venue/rivalry signals; 86/86 schools were additionally re-read by an independent agent that judged each source from its content. 200-with-empty-shell does not count as YES.
2. **No Wikipedia-mirror double-counting.** The only Wikipedia source per school is `en.wikipedia.org`; the second schedule source is always a *different* domain (the official athletics site). Mirror/syndication hosts were never counted as a second domain.
3. **Sports-Reference genuinely checked for 2026 rows.** SR 2026 pages 404 and the index carries no 2026 schedule rows; the 2025 probe rendering proves the slug/reachability, so the gap is publish-timing, not a shell or a block. SR is correctly counted as 0 present 2026 sources.
4. **Checkpointing persisted per school.** Each school wrote `dumps/<slug>.json` as it completed; the collection is resumable (re-running skips finished dumps) — a crash at school 60 would not lose 1–59.
5. **Genuine coverage holes flagged loudly.** 4 schools (all G5) currently have only the official source; **0 schools** have official + Wikipedia + SR all failing. No school is a true tooling-driven coverage hole.

**Count note:** the task brief's header says 87 schools (Power-4 = 68); its explicit enumeration lists **86** (Power-4 = 67). All 86 enumerated schools were mapped — the off-by-one is in the brief's header count, not a dropped school.

---

_Artifacts: consolidated machine-readable data (deterministic + agent verification per school) in `docs/cfb-source-map.json`; the 86 per-school collection dumps in `docs/cfb-source-map.dumps.json`. Full rendered markdown (~33MB, 475 files) kept in the session scratchpad (`scratchpad/cfb-sweep/raw`), regenerable via the idempotent collection script (`collect.js`)._
