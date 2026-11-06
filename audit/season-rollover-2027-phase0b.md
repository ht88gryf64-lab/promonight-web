# Season rollover 2027: Phase 0b (read-only)

Date: 2026-11-05. Branch: `feature/season-rollover-2027` (no commits). Web main 1c27b07 (season gate live), pipeline main baf11d8a.
Gate 1 merge deadline: before 2027-01-05 (MLS 2027 lead-in opens).

Rulings already in hand (2026-11-05): team score current season = started, else most recently ended, lead-ins never feed it; new fields `seasonScore` / `seasonPromoCount`, all-time fields untouched; pipeline keeps its own `windows.json` copy plus a drift check against web raw main that fails the scoring run; ranked-page label = calendar year of the earliest row shown, off-season range and label = most recently ended window, titles via `generateMetadata` on the gated rows, `SEASON_YEAR`/`YEAR` removed from the three ranked pages.

## a. Literal years (2025, 2026, 2026-27, 26-27)

Scope: web `src/`, `scripts/`; pipeline `data/`, `lib/`, `scripts/`, `test/` and the 31 root `*.js` (the pipeline has no `src/` or `config/`; `team-configs/` is covered in section d). Per-occurrence classification is heuristic (path and line shape); per-file table: scratchpad `year_sweep.tsv`.

| | files | total | fixture | comment | config label | logic/date literal | scanner URL stamp | title/meta | rendered copy | schema | feed |
|---|---|---|---|---|---|---|---|---|---|---|---|
| web | 428 | 7,541 | 5,446 | 785 | 497 | 540 | 56 | 69 | 147 | 1 | 0 |
| pipeline | 349 | 33,942 | 24,735 | 710 | 7,631 | 212 | 529 | 118 | 7 | 0 | 0 |

Read-outs:
- Web `src/` alone: rendered 77, title/meta 8, schema 1, feed 0, config 59 (28 are `windows.json`), logic 138, comment 660, fixture 5,439.
- Of the 77 rendered-copy hits, 30 are the 2026 World Cup (an event name, correct as a literal). The rest: CFB (rivalries, matchup descriptions, school page), team-page redesign (`ScheduleBlock`, `RedesignTeamPage`, `Footer`, `AffiliateRail`), `PromoPageView`, `ScheduleReleaseVideoCard`, the four calendar-year hubs, `/promos/soccer-jersey-nights`.
- The pipeline's bulk is data: `data/backtest/mlb-2025.json` (7,430), CFB facts and seeds (URL stamps). Its 118 title/meta hits are one-off correction scripts (`scripts/*-2026-10-*.js`), not runtime.
- Feed: zero literal years in `src/lib/social-feed`, the RSS route, the digest or the email templates.

## b. Years rendered from a constant

"Per-league" = `seasonLabel(league, date)` from `windows.json` ("2026", "2026-27", "2027", later "2027-28"). "Calendar" = calendar year of the rows or record shown (never the clock).

| Surface | Constant today | Renders | Proposed |
|---|---|---|---|
| Team page title, control arm | `currentSeasonLabel()` = `TITLE_SEASON_YEAR` / `SPLIT_SEASON_START_YEAR` (`season-label.ts:96`) | title, og, hero subtitle | per-league: `currentSeasonLabel` becomes the `seasonLabel` seam |
| Team page title, CTR treatment arm (10 MLB clubs) | `TITLE_SEASON_YEAR` (`title-treatment.ts:50`) | "Giveaways & Theme Nights 2026" | per-league (MLB) |
| NFL schedule-title arm | `NFL_TITLE_SEASON_YEAR` (`title-treatment.ts`) | "{Club} 2026 Schedule, Promos & Giveaways" | per-league; **needs NFL windows** (none today; the 2026 season ends Feb 2027, so calendar would flip wrongly in January) |
| Team page schedule H2, completed/upcoming labels, zero-promo copy, season scope | `TITLE_SEASON_YEAR`, `SPLIT_SEASON_START_YEAR`, `SEASON_YEAR` in `team-content-sections.tsx`, `zero-promo-fallback.tsx`; `ScheduleBlock`, `promo-list`, `season-scope`, `schedule-months`, `announcement-status` | H2 "{YEAR} {TEAM} PROMO SCHEDULE", counts, FAQ | per-league |
| League hubs /mlb /mls /wnba /nfl | page-local `YEAR = 2026` | title, description, H1 "MLB PROMOTIONS 2026" | per-league |
| League hubs /nhl /nba | `splitSeasonLabel(SPLIT_SEASON_START_YEAR)` | "2026-27" | per-league (same output, windows-backed) |
| /promos category pages (theme-nights, jersey-giveaways, food-deals, bobbleheads) | `crossLeagueSeasonLabel()` = "2026-27"; bobbleheads `LIST_FROM = '2026-01-01'` | title, H1, lead | **decision**: cross-league. Either calendar year of the earliest row (ruling 4's rule) or the span of current seasons; `LIST_FROM` moves to a window start either way |
| /best-promos, /best-promos/bobbleheads, /team-rankings | `SEASON_YEAR` / `YEAR` | (ruled) | calendar year of earliest row; off-season = most recently ended window |
| /teams | `SEASON_YEAR` | meta description "...in 2026" | calendar |
| /venues, venue hubs | `SEASON_YEAR` (`venue-hub.ts:978`, `venues/page.tsx`) | "verified for the 2026 season", bag answers | calendar, from the verification record, not a season |
| /playoffs, /playoffs/{league} | `POSTSEASON_SEASON` (`postseason/data.ts:32`) | hub/league copy, doc ids `MLB_2026` | label per-league from the bracket's season key; the doc-id constant stays a data key |
| CFB (metadata, rivalry JSON-LD, llms.txt line) | `YEAR = 2026` (`cfb/metadata.ts:28`, `cfb/rivalry-jsonld.ts:21`), literal in `llms.txt/route.ts:31` | titles, JSON-LD names | per-league; **needs CFB windows** (bowls and the title game are in January) |
| Sitemap | none | lastmod only | no change |
| Social feed (`/feeds/social.xml`, cards) | none | item dates from rows | no change |
| OG / share cards | none | promo date from the row | no change |
| Email digest | none | window dates | no change |
| App API (`/api/my-teams/promos`, promo-card, share-card) | none | row dates | no change |
| World Cup pages | literal "2026" | event name | exempt (proper noun) |

## c. The 2027-01-15 runbook (`docs/runbook-2027-01-15-spansyears-season-switchoff.md`)

1. `resolveSeasonScope` publishes a season count only when a team's dated rows sit in one calendar year equal to `TITLE_SEASON_YEAR`.
2. When the first 2027 row lands beside the 2026 archive (MLB bobblehead calendars, January to February), `spansYears` turns true and the page silently falls back to the upcoming-only claim.
3. That happens in the peak publishing window for "[team] giveaways 2027", so the runbook proposes a two-season resolver: if all upcoming rows sit in the later year, claim that year.
4. It requires a census around 2027-01-15 first, because interleaved seasons (a late-2026 upcoming row beside 2027 rows) would make that rule publish wrong totals.
5. It also flags that `TITLE_SEASON_YEAR` must move to 2027 deliberately and in lockstep, and that moving it alone does not fix the guard.

**Does seasonLabel supersede it?** Yes for the mechanism, if Gate 1 reaches `resolveSeasonScope`. Window membership assigns every row to an explicit season, so the calendar-year span guard, the "all upcoming in the later year" heuristic and the interleave census all become unnecessary: a late-2026 row is in the 2026 window regardless of what else the team carries. It also retires the `TITLE_SEASON_YEAR` bump. Two things it does not settle and Gate 1 must rule on: which season a team page CLAIMS during a lead-in (the runbook's whole point is claiming 2027 in January, but MLB's lead-in opens 2027-02-07, and ruling 1 keeps lead-ins out of the score), and MLB spring-training rows, which fall before Opening Day and so outside every window.

## d. Pipeline: season-stamped fetch URLs and their guards

48 stamped URLs in `team-configs/*.js` (47) and the root `mls-teams.js` (1, duplicate of St. Louis). All stamped 2026 or 2026-27.

Guards each scanner applies (`scan-*.js` requires; `scan-core.js` is shared):

| League | URLs | firecrawl-fetch (non-200, error-page signature, thin + retry) | date-provenance (scan-core) | season-gate spine join | nhl-season-gate / preseason hold | season-stamp (URL range) |
|---|---|---|---|---|---|---|
| MLB | 6 (mlb.com schedule/2026, astros 2026-06..09 lists, angels promotions/2026) | yes | yes | no | no | no |
| MLS | 5 (Red Bulls, Union, FC Dallas, St. Louis x2) | yes | yes | no | no | no |
| WNBA | 4 (Wings, Sparks, Storm, Mystics) | yes | yes | no | no | no |
| NFL | 21 (news articles, all "2026") | yes | yes | yes | no | no (`scan-nfl.js:639`) |
| NBA | 10 (all "2026-27" / "202627" / "2026-2027") | yes | yes | yes | no | yes |
| NHL | 2 (Flames, Oilers, "2026-27") | yes | yes | yes | yes | no |

Facts that shape the proposal:
- `season-stamp.js` reads RANGES only; a bare year is ignored on purpose (a CMS can freeze a node-creation year into a path). So every MLB, MLS, WNBA and NFL stamp above is invisible to it even where it would be wired.
- It deliberately does NOT read body text: `/hornets/promotions` carried "2026-27" thirteen times in navigation while serving 2025-26 content.
- `firecrawl-fetch.js` captures Firecrawl's post-redirect URL (`finalUrl`, line 124) but `success()` (line 197) drops it, so no scanner can see that a stamped request landed somewhere else.
- The Giants 2027 rows came from a durable, unstamped URL; no stamp guard would or should stop them (the web gate handles display).

**Proposed guard: body stamp must match request (`season-stamp:request-mismatch`).**
1. Request stamp: the season read from the request URL. Ranges always; a bare year only when the config marks that URL `seasonStamped: true`, an explicit per-URL declaration that answers the frozen-node-year problem.
2. Redirect check: carry `finalUrl` through `fetchMarkdown`'s success result. A final URL with a different readable stamp than the request is a mismatch.
3. Body check without free text: the document's own title (Firecrawl `metadata.title`, else the first markdown H1) must not state a different season than the request; navigation is never read. Then the extracted, date-provenanced rows must fall inside the requested season's window from the pipeline's `windows.json` copy (start through effective end; the lead-in does not count). A source whose rows sit mostly outside it is a mismatch. The threshold is a ruling; propose "any row in a different season's window rejects the source", matching the existing reject-not-hold reasoning.
4. Mismatch REJECTS the source (no rows, no tombstone-by-absence for that run), recorded under the new reason. A URL with no request stamp passes unchanged, so durable sources stay byte-identical.
5. Known-bad (6b.6) inputs: the Pistons 2025-26 article (313 Day vs Memphis) at a 2026-27 request; a 2026 MLS URL served after the 2027 Sprint slate replaces it; a stamped NFL article that 301s to the next year's article.

## e. Proposed test: no literal year in rendered title, meta, H1, schema or feed output

Two layers, because the served output legitimately carries row dates (JSON-LD `startDate`, RSS `pubDate`):

1. Source scan (unit, runs in `npm test`), `src/lib/__tests__/no-literal-years.test.ts`: for every file under `src/app`, `src/components` and the rendering libs (`cfb/metadata`, `cfb/rivalry-jsonld`, `title-treatment`, `season-label`, `venue-hub`, `social-feed/*`, `og`, `share-card-*`, `email`, `digest`, `promo-page-copy`, `about-copy`, `postseason/*`), strip comments and fail on any `\b20\d\d\b` in code, including `const YEAR = 2026`-style constants. Exempt by path: `__tests__`, `__fixtures__`, `scripts/`, `src/lib/seasons/windows.json`. One named allowlist with a reason per entry (the World Cup event name, legal effective dates). Measured today: about 125 lines in 45 files would flag, 30 of them World Cup. Same scanner shape as `display-slots-guard.test.ts`.
2. Served check (`npm run test:live`), extending `scripts/live/team-pages.live.test.ts`: on a fixed page list (four hubs, three ranked pages, /promos category pages, sample team pages per league, /playoffs, /feeds/social.xml), extract `<title>`, meta description, og:title, `<h1>`, JSON-LD `name`/`headline`/`description` and RSS titles, and assert every `20\d\d` token is either inside an ISO date field or equals `seasonLabel()` for that page's league(s) and date (or the calendar year of the earliest row on ranked pages).
