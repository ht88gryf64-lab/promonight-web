# CFB render fixes, Tier 1 (before Saturday 2026-09-05)

**Branch:** `fix/cfb-render-tier1`, off `main` at ca2c5aa. **No Firestore writes.** Items 1 to 3 are code; items 4 and 5 are reports only.
**Reads:** `audit/cfb-ingestion-state.md` (on `feature/season-labels-and-cfb-week`) for the state this branch responds to.
**Baseline:** HEAD ran 662 tests, 0 failures. The four new test files were run before any implementation existed and failed (`Cannot find module '../cfb/kickoff'`, `'../cfb/clock'`, no `cfbGameWeek` export, `renderedKickoff` returning the stored label). After implementation: 693 tests, 0 failures; `tsc --noEmit` clean.

---

## 1. Past games render as played

`cfbGames.status` is `scheduled` on every doc and nothing transitions it, so "played" is derived from the date: a game dated strictly before today (America/Chicago, the same anchor the hub rail and homepage use) is played. A game dated today is not.

**What the played row shows** (verified on `/cfb/florida-state`, the Aug 29 New Mexico State game):

```
AUG 29
New Mexico State
Doak Campbell Stadium · Tallahassee · Home
Played
```

- The right-hand cell reads **Played** instead of a kickoff time or "Kickoff TBA". No score, no result, no "Final": nothing is known, so nothing is claimed.
- The row is a `<div>` with `data-cfb-played="true"` and `aria-label="<opponent>, played"`, not the `<button>` that opens the gameday modal. Tickets, hotels and parking for a game that has happened are not offered. The chevron is gone.
- The row dims (`opacity-50`). Date, opponent, venue line and trophy tag stay.
- No week label on the Aug 29 slate (Week 0 is unlabelled, see item 2).
- The schedule footer now reads: "Tap an upcoming game for its gameday links. Kickoff times are shown in the stadium's local time once announced and confirmed on a second source; until then, Kickoff TBA. Played games show no score."
- The school page's rivalry prose flips tense on the same flag: "The X vs Y rivalry ... **was** played on ..." for a played game, "is played on" otherwise.
- Hub weekly rail: a game earlier in the Monday-to-Sunday window (a Saturday game viewed on Sunday) read **TODAY** because the countdown treated any non-positive day count as today. It now reads **PLAYED**; day 0 stays TODAY.

**Not changed:** matchup pages (`/cfb/rivalries/<slug>`) still describe their game in the present tense with its kickoff. The first registry matchups to be played are California-UCLA and James Madison-Liberty on Sep 5, then the Apple Cup on Sep 6. Their lede and meta description are built by `buildMatchupDescription`, which has its own length-budget tests; changing its tense is a separate change.

Files: `src/lib/cfb/clock.ts` (new: `chicagoTodayYMD`, `isPlayedGame`), `src/lib/cfb/data.ts` (`CfbGameView.played`), `src/components/cfb/CfbSchedule.tsx`, `src/components/cfb/CfbSchoolPage.tsx`, `src/lib/cfb/page-extras.ts`, `src/components/cfb/hub/blocks.tsx`, `src/lib/cfb/hub-data.ts` (now imports the shared clock). Tests: `src/lib/__tests__/cfb-played.test.ts`.

## 2. Week labels from the date

The stored `cfbGames.week` is the parsing school's game ordinal (`rules.ts computeWeeks`, byes consume nothing) written onto a doc both schools share, so the away school inherits the home school's count. The row now renders `cfbGameWeek(date)`: the existing `week.ts` counter shifted one day, because a college football week runs Thursday to Monday and the rail counter is Monday-anchored to match its own Monday-to-Sunday window. Week 0 (Aug 29) stays unlabelled, as on the rail. The stored field is still on the view (`week`) but is not rendered.

**Confirmed at render:**

| Page | Before (stored ordinal) | After (date) |
|---|---|---|
| Tennessee Oct 17 (Alabama) | Wk 7 | Wk 7 |
| Tennessee Oct 24 (at South Carolina) | **Wk 7** | **Wk 8** |
| Tennessee Nov 7 (Kentucky) | Wk 9 | Wk 10 (Oct 31 is a bye) |
| Washington State Sep 6, 12, 26, Oct 3, 24, 31 | 1, 2, 4, 5, **7**, 9 | 1, 2, 4, 5, **8**, 9 |
| Florida State Sep 7 (Monday, SMU) | 1 | 1 |

Washington State's labels now name calendar weeks. The gaps at 3, 6 and 7 are weeks with no stored game: the corpus holds 6 of its 12 games (the school was seeded on 2026-08-17 without a schedule parse), so the gaps are real, not a labelling defect.

**One documented divergence.** A Monday game (Labor Day, Sep 7: Florida State vs SMU) is Week 1 on the school page and Week 2 on the hub rail counter, because the rail window is Monday-to-Sunday (`cfb-week.test.ts` KNOWN RESIDUAL). The rail label only prints over its own window, so the two never appear on one surface for the same game.

Files: `src/lib/cfb/week.ts` (`cfbGameWeek`, the existing counter untouched), `src/lib/cfb/data.ts` (`CfbGameView.weekLabel`), `src/components/cfb/CfbSchedule.tsx`. Tests: `src/lib/__tests__/cfb-game-week.test.ts`.

## 3. Kickoffs in the venue's local zone

**How.** `cfbGames.kickoff.tz` is a two-letter label stamped by whichever school's site parsed the row. The verify stage corroborated each announced kickoff as an **instant**, reading that label through the pipeline's own map (`guards.ts IANA`: ET = America/New_York, CT = America/Chicago, MT = America/Denver, PT = America/Los_Angeles). The new `venueLocalKickoff` reads the same instant the same way and re-expresses it in the zone of the building the game is played in, from a per-venue map (`src/lib/cfb/venue-timezones.ts`):

- 86 campus stadiums, keyed by `cfbVenues` id, values mirroring the pipeline's per-school `venueTz` (the zone the verify stage read Wikipedia in), each carrying the stored lat/lng in a comment. The unit test parses those coordinates back and checks the longitude bands, naming the four Central buildings east of -87.6 (Nashville, Auburn, Tuscaloosa, and Nissan Stadium) and Boise as the intended exceptions. Arizona's two stadiums are America/Phoenix (no DST), Boise is America/Boise.
- 8 neutral-site venueHubs buildings referenced by `neutralVenueHubSlug`.
- 51 home schools without a venue doc: the 50 untracked home-school ids present in cfbGames (several are drifted spellings of one school, such as `jmu` and `james-madison-university`), plus Washington State, which is tracked but was seeded without a venue. Keyed by the school id the parser wrote, campus city in the comment. Hawaii is Pacific/Honolulu.

The verify gate is unchanged: a time shows only when the game is verified and the kickoff is announced and parseable. A TBD is returned before any zone arithmetic runs. An unmapped venue or an unknown label leaves the stored rendering as it was; no zone is guessed. The impossible-AM guard (1:00 to 6:00 AM) now applies to the converted time. Phoenix renders as **MST** rather than "MT" because Arizona does not observe DST and "MT" there reads as Denver time, an hour off through October.

The same converter feeds the matchup family: `renderedKickoff(game, venueZone)` and `sportsEventStartDate(game, venueZone)` take the zone from a new `MatchupPage.venueZone`, so the lede, meta description, fact card and SportsEvent `startDate` (venue offset) agree with the school pages. Without a zone both keep their pre-existing contract, which their existing tests pin.

**Every row whose displayed time or zone changes** (25 of the 262 rows that display a time; 400 render "Kickoff TBA" before and after; **none of the 25 is a TBD**, checked by the report script against `kickoff.tbd` and the stored string):

| Date | Game | Stored | Venue zone | Before | After |
|---|---|---|---|---|---|
| Sep 5 | Auburn vs Baylor (Atlanta) | 2:30 PM CT | New_York | 2:30 PM CT | 3:30 PM ET |
| Sep 5 | UNLV at Hawaii | 7:00 PM PT | Honolulu | 7:00 PM PT | 4:00 PM HST |
| Sep 5 | Clemson at LSU | 7:30 PM ET | Chicago | 7:30 PM ET | 6:30 PM CT |
| Sep 6 | Notre Dame vs Wisconsin (Lambeau) | 7:30 PM ET | Chicago | 7:30 PM ET | 6:30 PM CT |
| Sep 12 | UNLV at North Texas | 12:45 PM PT | Chicago | 12:45 PM PT | 2:45 PM CT |
| Sep 12 | Texas Tech at Oregon State | 6:30 PM CT | Los_Angeles | 6:30 PM CT | 4:30 PM PT |
| Sep 19 | Northern Illinois at Arizona | 9:30 PM CT | Phoenix | 9:30 PM CT | 7:30 PM MST |
| Sep 19 | Stanford at Duke | 1:00 PM PT | New_York | 1:00 PM PT | 4:00 PM ET |
| Sep 19 | SMU at Louisville | 2:30 PM CT | New_York | 2:30 PM CT | 3:30 PM ET |
| Sep 19 | Purdue at UCLA | 11:00 PM ET | Los_Angeles | 11:00 PM ET | 8:00 PM PT |
| Sep 25 | Northwestern at Indiana | 7:00 PM CT | New_York | 7:00 PM CT | 8:00 PM ET |
| Sep 25 | Navy at UAB | 7:00 PM ET | Chicago | 7:00 PM ET | 6:00 PM CT |
| Sep 26 | Texas at Tennessee | 11:00 AM CT | New_York | 11:00 AM CT | 12:00 PM ET |
| Oct 9 | Iowa at Washington | 8:00 PM CT | Los_Angeles | 8:00 PM CT | 6:00 PM PT |
| Oct 17 | UNLV at Air Force | 12:30 PM PT | Denver | 12:30 PM PT | 1:30 PM MT |
| Oct 23 | Army at Tulsa | 8:30 p.m. ET ET | Chicago | 8:30 PM ET | 7:30 PM CT |
| Oct 24 | San Diego State at Colorado State | 3:30 PM PT | Denver | 3:30 PM PT | 4:30 PM MT |
| Oct 31 | Northern Illinois at UNLV | 9:30 PM CT | Los_Angeles | 9:30 PM CT | 7:30 PM PT |
| Nov 6 | TCU at Arizona | 8:15 PM MT | Phoenix | 8:15 PM MT | 8:15 PM MST (zone text only) |
| Nov 7 | Air Force at Army | 5:30 PM MT | New_York | 5:30 PM MT | 7:30 PM ET |
| Nov 7 | Fresno State at Utah State | 6:30 PM PT | Denver | 6:30 PM PT | 7:30 PM MT |
| Nov 14 | UNLV at New Mexico | 4:30 PM PT | Denver | 4:30 PM PT | 5:30 PM MT |
| Nov 14 | Fresno State at Texas State | 1:00 PM PT | Chicago | 1:00 PM PT | 3:00 PM CT |
| Nov 21 | San Diego State at Boise State | 6:30 PM PT | Boise | 6:30 PM PT | 7:30 PM MT |
| Nov 27 | Appalachian State at South Alabama | 3:00 PM ET | Chicago | 3:00 PM ET | 2:00 PM CT |

The other 237 displayed rows already carried the venue's zone and are byte-identical. One displayed row has no zone in the render path: North Carolina vs TCU in Dublin (neutral, no hub slug); it was played Aug 29 and renders **Played**, so no time shows. No registry matchup page carries one of the 25 games, so no matchup page changes visibly today; the wiring is in place for when one does.

**Confirmed at render:** `/cfb/tennessee` Sep 26 Texas: `12:00 PM ET · ABC or ESPN`. `/cfb/notre-dame` Sep 6 Wisconsin: `Neutral site · 6:30 PM CT · NBC and Peacock`. `/cfb/liberty` unchanged (all ET). `/cfb/arizona-state` unchanged (0 of 12 verified, all "Kickoff TBA"; see item 4). `/cfb/washington-state` unchanged (PT rows at PT venues).

Files: `src/lib/cfb/kickoff.ts` (new), `src/lib/cfb/venue-timezones.ts` (new), `src/lib/cfb/data.ts`, `src/lib/cfb/metadata.ts`, `src/lib/cfb/rivalry-jsonld.ts`, `src/lib/cfb/matchups.ts`, `src/components/cfb/rivalry/RivalryMatchupPage.tsx`. Tests: `src/lib/__tests__/cfb-kickoff-zone.test.ts`, `src/lib/__tests__/cfb-venue-timezones.test.ts`.

## 4. Verify guard noise (report only, no doc changed)

Of the 400 unverified live games (403 in the audit included 3 tombstoned docs), 27 carry a "kickoff conflict" flag and 18 a "could not normalize a kickoff" flag. Recomputed with the pipeline's own `toUtcMinutes` over the stored docs.

**The conflicts are not timezone-label mismatches in the comparison. They are the label itself being wrong.** The parser stamps `kickoff.tz` with a zone family, but the digits it extracted are in the **parsing school's** zone, and for a row parsed from the away school's site the two disagree. The verify stage then reads the digits through the stamped label and compares against Wikipedia in the venue zone, and sees a one-hour (or two- or three-hour) conflict. Reading the digits in the parsing school's venue zone (source domain to school, then that school's `venueTz`) instead:

| Outcome | Games |
|---|---|
| Conflict drops to 0.0 h, would verify | **25** |
| Genuine conflict remains | 2 |

The two that remain: TCU vs Grambling State (parser 7:00 PM CT from TCU's own site, Wikipedia 6:00 p.m. CT: a real disagreement) and Auburn vs Southern Miss ("6:30 or 6:45 PM": a kickoff window, 0.25 h, needs `windowFlex`, not a zone fix). The three Arizona/Arizona State conflicts are a sub-case: the label "MT" is read as America/Denver while the school and Wikipedia are America/Phoenix, one hour apart until Nov 1.

**Consequence for the display fix in item 3:** on the 25 recoverable rows the stored label is wrong, so a display conversion of those rows would also be wrong; they are all `verified:false` and render "Kickoff TBA", so nothing wrong shows. The verify gate is doing its job. On verified rows the label was corroborated as an instant, which is why item 3 converts only those.

**The normalizer.** `normTime` requires `H:MM`. The 18 failures are all shapes without minutes: "8 PM", "7 p.m.", "11 a.m.", "12 PM", "1 PM", "6 p.m.", "5 p.m.", "Noon". Accepting a bare hour with a meridiem, and "Noon", makes all 18 comparable. Whether they then match Wikipedia needs the Wikipedia value, which the stored flag does not carry; a re-corroboration would say. Notably 9 of the 18 are Week 1 or Week 2 games.

**Per school, what the two fixes would recover** (games that leave the flagged bucket; "verifies" = conflict drops to zero, "comparable" = normalizer now produces a time to compare):

| School | Currently verified | Conflicts that verify | Normalize now comparable | Notes |
|---|---|---|---|---|
| **Arizona State** | 0 of 12 | **3** (Sep 5 Morgan State 7:00 PM, Sep 12 at Texas A&M, Sep 19 vs Kansas) | 0 | All three are the Phoenix-read-as-Denver case. The Sep 5 opener would show **7:00 PM MST**. The other 9 are honest TBDs. |
| Arizona | 2 of 12 | 3 (Sep 5 NAU, Sep 12 at BYU, Sep 26 at Washington State) | 0 | Same Phoenix case. |
| Illinois | 0 of 12 | 1 (Sep 12 Duke) | 4 (Sep 3 UAB "8 PM", Sep 19 "1 PM", Nov 6 "7 PM", Nov 13 at UCLA "8 PM") | The Sep 3 Thursday opener is a normalizer case. |
| Tulane | 3 of 12 | 3 (Sep 5 at Duke, Oct 10 at Army, Oct 30 at Charlotte) | 0 | |
| Kansas | 0 of 12 | 1 (Sep 19 Arizona State) | 2 (Sep 4 LIU "7 p.m.", Sep 11 Missouri "7 p.m.") | Both normalizer rows are in the next nine days. |
| Alabama | 1 of 12 | 1 (Sep 19 Florida State) | 2 (Sep 5 East Carolina "11 a.m.", Nov 21 Chattanooga) | The Sep 5 opener is a normalizer case. |
| Boise State | 7 of 11 | 2 (Sep 5 at Oregon, Oct 24 at Washington State) | 1 (Sep 12 Memphis "5 p.m.") | |
| Memphis | 5 of 12 | 0 | 3 (Sep 5, Sep 12 at Boise, Sep 19) | |
| Kansas State | 1 of 12 | 0 | 2 (Sep 5 Nicholls, Sep 12 Washington State, both from kstatesports.com) | |
| Wake Forest | 1 of 13 | 0 | 2 (Sep 3 Akron "7 p.m.", Sep 12 at Purdue "12 p.m.") | |
| Auburn | 3 of 12 | 1 (Sep 19 Florida) | 0 | Sep 12 Southern Miss stays: a kickoff window. |
| Colorado | 2 of 12 | 2 (Sep 3 at Georgia Tech, Sep 19 at Northwestern) | 0 | |
| Duke | 4 of 12 | 2 (Sep 5 Tulane, Sep 12 at Illinois) | 0 | |
| Florida State | 4 of 12 | 2 (Sep 7 SMU, Sep 19 at Alabama) | 0 | The Labor Day opener would show 7:30 PM ET. |
| Texas A&M | 3 of 12 | 2 (Sep 12 Arizona State, Sep 19 Kentucky) | 0 | |
| Iowa State | 3 of 12 | 1 (Nov 20 at UCF) | 1 (Sep 5 "Noon") | |
| Oregon | 2 of 12 | 1 (Sep 5 Boise State) | 1 (Nov 20 at Michigan State "8 PM") | |
| Syracuse | 3 of 13 | 1 (Sep 12 California) | 1 (Sep 5 New Hampshire "12 PM") | |
| Army | 9 of 13 | 1 (Oct 10 Tulane) | 0 | |
| BYU, California, Florida, Georgia Tech, Kentucky, NC State, Northwestern, Ohio State, SMU, South Florida, TCU (0, the Grambling row is genuine), Texas, UCF, UConn, Utah, Vanderbilt, West Virginia | | 1 each | 0 | Ohio State at Texas Sep 12 (7:30 PM CT stored from Ohio State's site, 6:30 PM CT actual) is among them. |
| Michigan State, Missouri, Nebraska, Purdue, UCLA | | 0 | 1 each | |

Totals: 25 games verify on the zone fix; 18 become comparable on the normalizer fix (their outcome depends on Wikipedia). Both are pipeline changes (`scripts/cfb/lib/guards.ts normTime`, `scripts/cfb/lib/corroborate.ts` reading the parser label via the source school's `venueTz`) followed by a re-corroboration pass over the stored docs, which is a Firestore write and out of scope here. The verify writer that would run it is quarantined; a re-corroborate-only pass (`run-phase2-reconcile.ts` shape, no re-parse) is the nearest existing vehicle.

## 5. IndexNow (report only, not changed)

**What happens today.** `.github/workflows/indexnow-after-deploy.yml` fires on every successful production deployment and POSTs to `/api/indexnow/deploy`, which calls `getAllSitemapUrls()` (the whole sitemap, every league) and submits all of it to api.indexnow.org and bing.com. The sitemap stamps every CFB team page with `lastModified: now`. Twelve successful runs since Aug 30 have each told the engines that all 87 CFB pages (plus 33 matchup pages and the hub) changed, while the underlying game docs have not been re-fetched since Jul 7. This branch will trigger another, and this time the CFB pages genuinely did change.

**What "submit only URLs whose rendered content changed" needs.**

1. **A durable fingerprint per URL that survives across deploys.** The hook runs in a fresh function; the previous deploy's state has to live somewhere: a Firestore collection (`indexnowFingerprints/{sha1(url)}` with `hash`, `submittedAt`), or Vercel Blob/KV. Firestore is already wired and needs no new integration.
2. **A fingerprint that ignores what changes on every render.** Hashing raw HTML does not work: six clock surfaces bake into the prerendered pages (the freshness lines, "today" anchors, the rail countdown) and Next emits build-scoped asset hashes, so every deploy differs byte-wise. Two viable bases:
   - **Data fingerprint** (cheap, deterministic): hash the documents a page reads (for a CFB school page, its school doc plus its games, venue, rivalries, ordered by id, with `updatedAt`/`fetchedAt` included) plus a template version constant bumped in code when the rendering changes. This never fetches a page. It misses changes that come from code alone unless the template constant is bumped, which is a discipline, not a mechanism.
   - **Rendered fingerprint** (truthful, costly): fetch each URL after deploy, strip the volatile bits (clock surfaces, nonces, `/_next/static/<buildId>` paths, the ISR timestamp), hash the remainder. 87 + 33 + hub CFB fetches plus the ~400 other sitemap URLs per deploy, against the same origin, with the risk that a partially warmed ISR cache serves the previous build for some URLs and fingerprints the wrong content.
3. **Diff and submit.** Submit the URLs whose fingerprint changed or has no record; write the new fingerprints only after a 200 from the aggregator. Also submit URLs that left the sitemap? IndexNow accepts removed URLs as "changed", so removal is a submission too.
4. **Keep an escape hatch.** A `?force=all` on the deploy route (behind the same secret) for a template-wide change where the data fingerprint cannot see it, and the daily `/promos/today` cron stays as it is (that page genuinely changes daily).
5. **Sitemap `lastModified`.** Whatever fingerprints the deploy hook, the sitemap should stop stamping `now` on CFB pages and stamp the max `fetchedAt`/`updatedAt` of the docs the page reads; that is the same data fingerprint in date form, and it fixes the signal Google reads directly.

Recommendation, not a decision: the data fingerprint, stored in Firestore, with the template version constant, and the sitemap `lastModified` change alongside it. It is deterministic, costs no fetches, and the one thing it cannot see (a render-only change) is exactly what a version bump in the same commit covers.

---

## Verification

- Red first: `cfb-game-week`, `cfb-played`, `cfb-kickoff-zone` and `cfb-venue-timezones` test files run on HEAD before implementation, failing on missing modules and on `renderedKickoff` returning the stored label.
- After: 693 tests, 0 failures (`npm test`); `tsc --noEmit` exit 0. `next lint` is not configured in this repo (interactive prompt), so no lint pass.
- Render: `next dev` on port 3111, cache-busting `curl` (`?nocache=<ts>`, `Cache-Control: no-cache`) of `/cfb/tennessee`, `/cfb/arizona-state`, `/cfb/washington-state`, `/cfb/notre-dame`, `/cfb/liberty`, plus `/cfb/florida-state` for a played row and `/cfb` for the rail. Findings are quoted in items 1 to 3. The production check happens after deploy; the dev server was stopped after the check.
- The item 3 table was produced by running the shipped modules over a read-only Firestore dump (662 live games), comparing the pre-change rendering (stored label) against the venue-local rendering row by row.

---

## Revision, 2026-09-02: CFB has no week numbers

Decision after the first pass: the site carries no CFB week numbers. The date is the label. The stored ordinal was wrong on 48 pages and the rail's counter needed a hand-set anchor every August; deriving a week from the date only moved the anchor. Both are gone. Rivalry Week stays as a named date window (`rivalry-index.ts`).

**Files touched in the revision:**

| File | Change |
|---|---|
| `src/lib/cfb/week.ts` | **Deleted**, with its `CFB_2026_WEEK_1_MONDAY` anchor and both counters. |
| `src/lib/__tests__/cfb-week.test.ts` | **Deleted** (pinned the anchor). |
| `src/lib/__tests__/cfb-game-week.test.ts` | **Deleted** (pinned the date-derived label). |
| `src/lib/__tests__/cfb-no-week-numbers.test.ts` | **New.** Scans `src/lib/cfb`, `src/components/cfb`, `src/app/cfb`: no week.ts import, no `Wk`, no `WEEK <n>`/`THIS WEEK`, no read of the stored field outside the annotated type and the writer's rule, no week-shaped property on the schedule view, the rail labelled by a date range. |
| `src/lib/__tests__/cfb-played.test.ts` | Extended: today in a venue zone, the fallback, `dateRangeLabel`. |
| `src/lib/cfb/clock.ts` | `todayYMD(zone)`, `venueTodayYMD(zone)` (falls back to the Chicago anchor when the venue is unmapped or the zone invalid), `dateRangeLabel(start, end)` in the house format ("AUG 31 – SEP 6"). |
| `src/lib/cfb/data.ts` | `CfbGameView` loses `week` and `weekLabel`; `played` is now computed against the calendar day in the game's venue zone, not America/Chicago. No read of `cfbGames.week` remains. |
| `src/lib/cfb/hub-data.ts` | No week counter. `weekly.range` is the Monday-to-Sunday window as a date-range string, null for the next-up fallback. |
| `src/app/cfb/page.tsx` | Rail heading is `RIVALRY GAMES · AUG 31 – SEP 6` (was `THIS WEEK · RIVALRY GAMES` with `UPDATES MONDAY AM · WEEK 1` on the right; the right label is now `UPDATES MONDAY AM`). |
| `src/components/cfb/CfbSchedule.tsx` | The `Wk N` line is removed; the date cell is the label. Rows carry `data-cfb-row="upcoming|played"` as an always-visible selector for the hydration check. |
| `src/lib/cfb/types.ts` | `CfbGame.week` annotated UNUSED. Left in Firestore, never rendered, never derived from. |

Not touched: `src/lib/cfb/rules.ts computeWeeks` (the pipeline writer's rule, quarantined with its writer) and `RIVALRY_WEEK_START/END`. The remaining `.week` reads in `src/components` are the pro `Game` type on NFL surfaces, not CFB.

After the revision: 691 tests, 0 failures; `tsc --noEmit` clean.
