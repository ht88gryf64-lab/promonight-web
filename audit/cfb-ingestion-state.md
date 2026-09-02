# CFB ingestion state, 2026-09-02

**Kind:** read-only audit. No writes, no code changes, no fixes proposed.
**Repos:** promonight-web (`feature/season-labels-and-cfb-week` at af318d2) and promo-pipeline (`main` at aa128f7).
**Ground truth:** direct read-only Firestore reads of the five `cfb*` collections (three query scripts, scratchpad only), git history in both repos, `gh run list` in both repos, and six cache-bypassing fetches of production (`x-vercel-cache: PRERENDER`, `age: 0` on every one).
**Execution shape:** zero subagents. Six network requests of the forty allowed.

Read alongside `audit/cfb-stream-build-spec.md` (locked spec) and `docs/cfb-phase2-decisions.md` (section 10 is the cron cadence this audit checks against).

---

## Headline

The CFB corpus is a single snapshot taken on **2026-07-07**. Every one of the 670 `cfbGames` docs carries `fetchedAt` and `verification.verifiedAt` from that day. Nothing has re-fetched a schedule since. The only writer that fetches, parses and verifies (`scripts/cfb/run-phase2.ts`) has been **quarantined since 2026-08-11** and refuses every `--execute`. Neither of the two crons resolved in the Phase 2 decision record was ever built. No CFB job exists on any scheduler in either repo, on Vercel, or on this machine.

The season started, six stored games have already been played, and the stored data does not know. The pages keep re-rendering the July snapshot every six hours under ISR and re-submitting it to IndexNow on every deploy.

---

## 1. What writes CFB data

Every script in either repo that writes `cfbSchools`, `cfbGames`, `cfbVenues`, `cfbRivalries` or `cfbTraditions`. All are manual CLI invocations; **none is on a cron or a dispatch workflow**. "Last run" is dated from Firestore `updateTime` on the docs each one touches, cross-checked against the commit that introduced the script and, where one exists, the generated audit report.

### promonight-web

| Script | Collections written | Trigger | Last run (UTC) | What it wrote |
|---|---|---|---|---|
| `scripts/cfb/run-phase1.ts` | cfbGames, cfbSchools, cfbVenues, cfbRivalries, **cfbTraditions** | manual | 2026-06-13 03:07 (report `audit/cfb-phase1-verify.md`) | 4 spike schools. The only writer of `cfbTraditions` ever: the 2 docs (`checker-neyland`, `shamrock-series`) still carry this timestamp. Everything else it seeded was wiped and rebuilt by Phase 2. |
| `scripts/cfb/run-phase2.ts` | cfbGames, cfbSchools, cfbVenues, cfbRivalries | manual | Full run 2026-07-07 16:40 to 20:15 (670 games, 212 rivalries, 85 schools). One **scoped** run on `notre-dame` 2026-08-11 14:00 to 14:01 (12 game docs, the school doc, the venue doc). | The whole corpus. Firecrawl fetch of the official site, Haiku parse, corroboration against Wikipedia in harness code, venue and colors, rivalry tags. **QUARANTINED 2026-08-11 (commit 18fa467):** every `--execute` exits 1 unless `--force-unsafe-write` is passed, because a full dry run measured 80 game docs losing `rivalryId` (74.1% of tags) from an undiagnosed `tagRivalry` regression. The 08-11 Notre Dame docs still carry `fetchedAt` 2026-07-07, so that scoped write did not re-fetch. |
| `scripts/cfb/run-phase2-reconcile.ts` | cfbGames (`tombstoned`, `verified`, `verification`) | manual | 2026-07-07 (all game `updateTime` values that day) | Tombstoned placeholder opponents and duplicates, re-corroborated shared-with-G5 games. |
| `scripts/cfb/run-phase2-gate.ts` | none (writes `audit/cfb-phase2-gate.md`) | manual | 2026-07-07 17:24 | Report only. Reads stored games and re-corroborates in memory. |
| `scripts/cfb/repair-neutral-and-dupes.ts` | cfbGames (`tombstoned`, `neutralVenueHubSlug`) | manual | 2026-08-11 13:51 (16 docs) and 13:58 (1 doc, Cotton Bowl slug after the hub doc existed) | 8 tombstones, 9 neutral-site slugs. Commit 7d60eb4. |
| `scripts/cfb/backfill-venue-capacity.ts` | cfbVenues (`capacity*`) | manual | 2026-07-08 (14 venue docs that day, 1 on 07-09) | 64 of 77 capacities, two-source corroborated. Commit f4d0f35. |
| `scripts/cfb/seed-washington-state.ts` | cfbSchools | manual | 2026-08-17 02:50 | One school doc. No venue doc, no games (its 6 games already existed from opponents' parses). Commit 04707da. |
| `scripts/repair-notre-dame-city.ts` | cfbVenues (`city` on one doc) | manual | 2026-08-14 15:49 | `notre-dame-stadium.city` from leaked wikitext to "South Bend". Commit 457003b. |
| `scripts/cfb/create-cotton-bowl-hub.ts` | **venueHubs** only | manual | 2026-08-11 | Not a `cfb*` writer. Listed because it is in `scripts/cfb/`. |
| `scripts/populate-cfb-venue-data.ts` | **venueHubs** and `venueHubs/*/tenants` only | manual | 2026-08-27 | **Not a `cfb*` writer.** The prompt names it as a known writer of CFB data; it writes CFB stadium logistics into the venueHubs corpus and never touches the five collections. |
| `src/app/api/cfb/contribute/route.ts` | `cfbContributions`, `cfbContributionsFlagged` | HTTP | live | Contributor form queue. Neither is one of the five collections. |

### promo-pipeline

| Script | Collections written | Trigger | Last run (UTC) | What it wrote |
|---|---|---|---|---|
| `scripts/cleanup-cfb-venue-delimiters.js` | cfbVenues (`city`, `state`) | manual | 2026-07-13 14:08 (snapshot in `logs/`) | 15 field offenses on 14 docs, Wikipedia pipe leakage. |
| `scripts/fill-cfb-city-state.js` | cfbVenues (`city` on 86, `state` on 14) + venueHubs | manual | 2026-07-13 14:44 | Overwrote every city from the hand-verified `venue-cities.ts`. |
| `scripts/fill-cfb-state-from-school.js` | cfbVenues (`state` on 86) + venueHubs | manual | 2026-07-14 02:51 | State from the school's known location. |
| `scripts/seed-venue-hubs.js`, `scripts/seed-venuehubs-facts.js`, `scripts/seed-venuehubs-cfb-facts.js`, `scripts/write-cfb-phase3b.js`, `scripts/fix-cfb-source-artifacts.js`, `scripts/gen-cfb-evergreen-seeds.js`, `scripts/sweep-cfb-evergreen.js` | **read** cfbVenues; write venueHubs only | manual | various, Jul 13 to Aug 12 | The venue-logistics build. None writes a `cfb*` collection. |

Those three pipeline scripts account for the 65 `cfbVenues` docs with `updateTime` on 2026-07-13 and 07-14. Nothing in promo-pipeline writes `cfbGames`, `cfbSchools`, `cfbRivalries` or `cfbTraditions`. `league-registry.json` has no CFB entry; there is no `scan-cfb.js`.

### Schedulers checked

- promo-pipeline GitHub workflows (11): MLB, MLS, NHL, WNBA scans, staleness check, watchdog, tests, and three disabled. None mentions CFB (`grep -i cfb` hits one comment in the WNBA file about a college-hat night).
- promonight-web GitHub workflows (1): IndexNow after deploy.
- `vercel.json` crons (3): `mlb-schedule`, `weekly-digest`, `indexnow-daily`.
- No crontab, no launchd job.

---

## 2. The cron that was designed

Decision record section 10 resolved two layers:

1. **Wednesday weekly full sweep** across covered schools for newly announced theme designations.
2. **Near-term in-season sweep, 2 to 3 times a week**, over the next 2 to 3 weeks' games, for kickoff and TV reveals on the rolling ~12-day window.

**Neither was ever built.** There is no workflow file, no script, no cron entry, and no season-gated CFB descriptor in the multi-league runner, in either repo. The spec's third layer (event-driven re-fetch on official-site news) and its rule "verify stage runs on every write" were likewise never given a runner: the verify logic exists only inline inside the quarantined Phase 2 writer.

The nearest things that exist, listed so they are not mistaken for the cron: `sweep-cfb-evergreen.js` in the pipeline sweeps **venue logistics pages** into venueHubs (last log 2026-07-31) and never reads a schedule; the hub's "UPDATES MONDAY AM" label is a pure display-window cutover with no scrape behind it (`hub-data.ts` header comment says so).

---

## 3. Freshness against a live season

Corpus-wide, all 670 game docs (662 live, 8 tombstoned duplicates):

| Measure | Value |
|---|---|
| `fetchedAt` | 670 of 670 on **2026-07-07** |
| `verification.verifiedAt` | 670 of 670 on 2026-07-07 |
| Kickoff, live 2026 games | 323 real time, 339 TBD, 0 `windowFlex` |
| Broadcast, live 2026 games | 322 with a network (319 `confirmed`), 340 TBD |
| Games dated before today (Aug 29 slate) | 6 stored, **0 marked `completed`**, all still `scheduled` |
| Newest `updateTime`, cfbGames | 2026-08-11 14:01 (repair + scoped Notre Dame run) |
| Newest `updateTime`, cfbSchools | 2026-08-17 02:50 (Washington State seed) |
| Newest `updateTime`, cfbVenues | 2026-08-14 15:49 (Notre Dame city repair) |
| Newest `updateTime`, cfbRivalries | 2026-07-07 20:15 |
| Newest `updateTime`, cfbTraditions | 2026-06-13 03:07 |

The near-term window, which is where the designed sweep would be doing its work right now:

| Window | Games | Kickoff stored | Kickoff TBD | Verified | Renders "Kickoff TBA" | Network renders |
|---|---|---|---|---|---|---|
| Week 1, Sep 3 to 7 | 65 | 64 | 1 | 50 | **15** | 60 |
| Week 2, Sep 8 to 14 | 65 | 64 | 1 | 49 | **16** | 60 |
| Week 3, Sep 15 to 21 | 59 | 57 | 2 | 46 | 13 | 55 |
| Sep 22 onward | 467 | 132 | 335 | 111 | 356 | 138 |

Weeks 1 to 3 kickoffs were already public in July, which is why they are stored. From Week 4 on, 335 of 467 kickoffs are TBD in the corpus, and each of them is announced roughly 12 days before the game. Nothing will pick them up.

**Verdict: frozen at the July 7 load.** No schedule has been re-fetched in 57 days. The August writes were structural repairs (tombstones, neutral-site slugs, one city, one school doc) and carried the July `fetchedAt` forward.

### Per school (87 tracked; games counted once per school, so a game appears under both schools)

Columns: games stored for 2026 (live, not tombstoned) / kickoff real / kickoff TBD / network stored / verified / newest game `updateTime` / school doc `updatedAt`. `maxFetched` is 2026-07-07 for every school and is omitted.

| School | Conf | Games | Kick real | Kick TBD | Network | Verified | Newest game write | School updatedAt |
|---|---|---|---|---|---|---|---|---|
| air-force | MWC | 12 | 11 | 1 | 12 | 11 | 07-07 | 07-07 |
| alabama | SEC | 12 | 4 | 8 | 4 | 1 | 07-07 | 07-07 |
| appalachian-state | Sun Belt | 12 | 6 | 6 | 6 | 6 | 07-07 | 07-07 |
| arizona | Big 12 | 12 | 5 | 7 | 5 | 2 | 07-07 | 07-07 |
| arizona-state | Big 12 | 12 | 3 | 9 | 3 | **0** | 07-07 | 07-07 |
| arkansas | SEC | 12 | 1 | 11 | 1 | 1 | 07-07 | 07-07 |
| army | AAC | 13 | 10 | 3 | 10 | 9 | 08-11 | 07-07 |
| auburn | SEC | 12 | 6 | 6 | 5 | 3 | 08-11 | 07-07 |
| baylor | Big 12 | 12 | 4 | 8 | 4 | 4 | 08-11 | 07-07 |
| boise-state | Pac-12 | 11 | 10 | 1 | 10 | 7 | 07-07 | 07-07 |
| boston-college | ACC | 12 | 4 | 8 | 3 | 4 | 08-11 | 07-07 |
| byu | Big 12 | 12 | 4 | 8 | 4 | 3 | 08-11 | 07-07 |
| california | ACC | 12 | 5 | 7 | 5 | 4 | 07-07 | 07-07 |
| cincinnati | Big 12 | 12 | 3 | 9 | 0 | 3 | 08-11 | 07-07 |
| clemson | ACC | 13 | 5 | 8 | 5 | 5 | 07-07 | 07-07 |
| coastal-carolina | Sun Belt | 15 | 6 | 9 | 13 | 6 | 07-07 | 07-07 |
| colorado | Big 12 | 12 | 4 | 8 | 4 | 2 | 07-07 | 07-07 |
| duke | ACC | 12 | 6 | 6 | 6 | 4 | 07-07 | 07-07 |
| florida | SEC | 12 | 5 | 7 | 5 | 4 | 08-11 | 07-07 |
| florida-state | ACC | 12 | 6 | 6 | 5 | 4 | 07-07 | 07-07 |
| fresno-state | Pac-12 | 12 | 10 | 2 | 11 | 10 | 07-07 | 07-07 |
| georgia | SEC | 12 | 3 | 9 | 3 | 3 | 08-11 | 07-07 |
| georgia-tech | ACC | 12 | 2 | 10 | 2 | 1 | 07-07 | 07-07 |
| houston | Big 12 | 12 | 4 | 8 | 4 | 4 | 07-07 | 07-07 |
| illinois | Big Ten | 12 | 5 | 7 | 5 | **0** | 07-07 | 07-07 |
| indiana | Big Ten | 12 | 5 | 7 | 3 | 5 | 07-07 | 07-07 |
| iowa | Big Ten | 12 | 5 | 7 | 5 | 5 | 07-07 | 07-07 |
| iowa-state | Big 12 | 12 | 5 | 7 | 5 | 3 | 07-07 | 07-07 |
| james-madison | Sun Belt | 12 | 7 | 5 | 7 | 4 | 07-07 | 07-07 |
| kansas | Big 12 | 12 | 3 | 9 | 3 | **0** | 07-07 | 07-07 |
| kansas-state | Big 12 | 12 | 3 | 9 | 3 | 1 | 07-07 | 07-07 |
| kentucky | SEC | 12 | 4 | 8 | 3 | 3 | 07-07 | 07-07 |
| liberty | CUSA | 12 | 12 | 0 | 12 | 12 | 07-07 | 07-07 |
| louisville | ACC | 12 | 4 | 8 | 2 | 4 | 08-11 | 07-07 |
| lsu | SEC | 12 | 5 | 7 | 5 | 5 | 07-07 | 07-07 |
| marshall | Sun Belt | 13 | 5 | 8 | 5 | 1 | 07-07 | 07-07 |
| maryland | Big Ten | 12 | 3 | 9 | 3 | 3 | 07-07 | 07-07 |
| memphis | AAC | 12 | 8 | 4 | 8 | 5 | 07-07 | 07-07 |
| miami | ACC | 12 | 5 | 7 | 3 | 5 | 08-11 | 07-07 |
| michigan | Big Ten | 12 | 4 | 8 | 4 | 4 | 07-07 | 07-07 |
| michigan-state | Big Ten | 12 | 4 | 8 | 4 | 3 | 08-11 | 07-07 |
| minnesota | Big Ten | 12 | 4 | 8 | 4 | 4 | 07-07 | 07-07 |
| mississippi-state | SEC | 12 | 5 | 7 | 4 | 5 | 07-07 | 07-07 |
| missouri | SEC | 12 | 3 | 9 | 2 | 2 | 07-07 | 07-07 |
| navy | AAC | 12 | 9 | 3 | 10 | 9 | 08-11 | 07-07 |
| nc-state | ACC | 12 | 4 | 8 | 4 | 3 | 07-07 | 07-07 |
| nebraska | Big Ten | 12 | 5 | 7 | 5 | 4 | 07-07 | 07-07 |
| north-carolina | ACC | 12 | 4 | 8 | 4 | 4 | 08-11 | 07-07 |
| northern-illinois | MWC | 12 | 7 | 5 | 11 | 4 | 07-07 | 07-07 |
| northwestern | Big Ten | 12 | 3 | 9 | 1 | 2 | 07-07 | 07-07 |
| notre-dame | Independent | 12 | 8 | 4 | 8 | 8 | 08-11 | 08-11 |
| ohio-state | Big Ten | 12 | 4 | 8 | 4 | 3 | 07-07 | 07-07 |
| oklahoma | SEC | 12 | 4 | 8 | 4 | 4 | 08-11 | 07-07 |
| oklahoma-state | Big 12 | 12 | 3 | 9 | 4 | 3 | 07-07 | 07-07 |
| ole-miss | SEC | 12 | 6 | 6 | 5 | 5 | 08-11 | 07-07 |
| oregon | Big Ten | 12 | 4 | 8 | 4 | 2 | 07-07 | 07-07 |
| penn-state | Big Ten | 12 | 3 | 9 | 3 | 3 | 07-07 | 07-07 |
| pittsburgh | ACC | 12 | 6 | 6 | 6 | 6 | 07-07 | 07-07 |
| purdue | Big Ten | 12 | 4 | 8 | 4 | 3 | 08-11 | 07-07 |
| rutgers | Big Ten | 12 | 5 | 7 | 4 | 5 | 07-07 | 07-07 |
| san-diego-state | Pac-12 | 11 | 10 | 1 | 10 | 10 | 07-07 | 07-07 |
| smu | ACC | 13 | 5 | 8 | 5 | 4 | 08-11 | 07-07 |
| south-carolina | SEC | 12 | 3 | 9 | 2 | 3 | 07-07 | 07-07 |
| south-florida | AAC | 12 | 7 | 5 | 6 | 5 | 07-07 | 07-07 |
| stanford | ACC | 12 | 7 | 5 | 7 | 7 | 08-11 | 07-07 |
| syracuse | ACC | 13 | 5 | 8 | 5 | 3 | 08-11 | 07-07 |
| tcu | Big 12 | 12 | 5 | 7 | 5 | 4 | 07-07 | 07-07 |
| tennessee | SEC | 12 | 3 | 9 | 3 | 3 | 07-07 | 07-07 |
| texas | SEC | 12 | 6 | 6 | 6 | 5 | 08-11 | 07-07 |
| texas-am | SEC | 12 | 5 | 7 | 5 | 3 | 07-07 | 07-07 |
| texas-tech | Big 12 | 12 | 4 | 8 | 4 | 4 | 07-07 | 07-07 |
| toledo | MAC | 12 | 5 | 7 | 4 | 1 | 07-07 | 07-07 |
| tulane | AAC | 12 | 7 | 5 | 6 | 3 | 07-07 | 07-07 |
| ucf | Big 12 | 15 | 6 | 9 | 6 | 5 | 07-07 | 07-07 |
| ucla | Big Ten | 12 | 4 | 8 | 4 | 3 | 07-07 | 07-07 |
| uconn | Independent | 12 | 9 | 3 | 9 | 8 | 07-07 | 07-07 |
| unlv | MWC | 14 | 13 | 1 | 14 | 13 | 07-07 | 07-07 |
| usc | Big Ten | 12 | 4 | 8 | 4 | 4 | 07-07 | 07-07 |
| utah | Big 12 | 12 | 4 | 8 | 4 | 3 | 07-07 | 07-07 |
| vanderbilt | SEC | 12 | 3 | 9 | 3 | 2 | 07-07 | 07-07 |
| virginia | ACC | 13 | 4 | 9 | 4 | 4 | 08-11 | 07-07 |
| virginia-tech | ACC | 13 | 5 | 8 | 5 | 5 | 07-07 | 07-07 |
| wake-forest | ACC | 13 | 3 | 10 | 3 | 1 | 07-07 | 07-07 |
| washington | Big Ten | 12 | 5 | 7 | 5 | 5 | 07-07 | 07-07 |
| washington-state | Pac-12 | **6** | 6 | 0 | 6 | 3 | 07-07 | 08-17 |
| west-virginia | Big 12 | 12 | 4 | 8 | 5 | 3 | 08-11 | 07-07 |
| wisconsin | Big Ten | 12 | 4 | 8 | 4 | 4 | 08-11 | 07-07 |

Editorial status: 87 of 87 `auto`, 0 `destination`. Verification buckets: 3 schools at 0 verified, 70 below 50%, 14 at or above 50%.

Data-shape notes surfaced while counting, not the audit's subject: `kickoff.tz` is stored as `ET`/`CT`/`MT`/`PT`/`TBD`, not the IANA zone the spec and `types.ts` require; `kickoff.time` arrives in twelve different shapes ("7:00 PM", "8 PM", "Noon", "3:30 p.m."); doc ids are `2026-2026-08-29-<home>-<away>` (season prefix doubled, date not week, unlike the spec's `{season}-w{week}-...`); one id carries a mangled slug (`usc-san-jos-state`).

---

## 4. The verify stage

| Verdict | Docs |
|---|---|
| `verified: true` (verdict `verified`) | **267** |
| `verified: false`, verdict `downgraded` | 29 |
| `verified: false`, verdict `flagged-for-human` | 374 |

**What ran it:** the corroboration step inside `scripts/cfb/run-phase2.ts` (harness code, Wikipedia as the independent second domain, no LLM), then `run-phase2-reconcile.ts` re-corroborating shared-with-G5 games, both on **2026-07-07**. `verifiedAt` is that day on all 670 docs.

**Does it run on new writes?** No. It ran once. The verify logic has no standalone entry point; it lives inside the Phase 2 writer, which is quarantined. The four writers that touched the corpus after July 7 (`repair-neutral-and-dupes`, `repair-notre-dame-city`, `seed-washington-state`, the scoped Notre Dame run) do not invoke it. The spec's "verify stage runs on every write, no exceptions" has no mechanism behind it.

**Why 403 are unverified** (flag text bucketed, numbers masked):

| Reason | Docs |
|---|---|
| honest-TBD: kickoff unannounced on both the parser source and Wikipedia | 310 |
| no fetchable Wikipedia for either team (pending-publish G5) | 34 |
| could not normalize a kickoff for fact-match (shapes like "8 PM") | 19 |
| kickoff conflict, parser vs Wikipedia, mostly a timezone-label mismatch | 28 |
| Wikipedia has an announced kickoff the parser left TBD | 7 |
| game not found on Wikipedia | 2 |

Guard outcomes across the 403: `secondSource` false on 403, `citation` false on 403 (coupled), `timezone` false on 29. Every verified game carries the school's Wikipedia season page in `sourcesChecked`.

**What a school page shows for an unverified game.** The row still renders (date, `Wk N`, VS/AT, opponent, stadium, trophy tag). The kickoff cell reads **"Kickoff TBA"** in dimmed text and no network line appears, regardless of whether a time is stored (`src/lib/cfb/data.ts` `kickoffDisplay`: a time shows only when `verified && !tbd`). Theme designations are gated the same way. Net effect this week: **15 of the 65 Week 1 games render "Kickoff TBA" although 64 of the 65 have a stored kickoff**, because the July verify pass flagged them and nothing has re-run it. Arizona State is the extreme: 3 stored kickoffs, 0 verified, all 12 rows TBA including this Saturday's opener.

---

## 5. themeDesignations[]

**The attach path was never built.** Across both repos the only code that touches `themeDesignations` on the write side is the literal `themeDesignations: []` in `run-phase1.ts:132` and `run-phase2.ts:129`. There is no context extractor: `scripts/cfb/lib/anthropic.ts` defines `SONNET` solely as the schedule parser's fallback model, and the spec's `announcedFor2026 ∈ {yes, no-historical-only, NF}` disambiguation appears nowhere in code. promo-pipeline has zero references to the field.

**No game carries a designation.** 670 of 670 docs hold an empty array; 0 are absent.

The read path exists and is gated correctly: `data.ts:293` exposes `themes` only on verified games and `CfbSchedule.tsx` renders them as pills, so the day a designation is written it will display. `cfbTraditions` holds the 2 Phase 1 seed docs (`editoriallySeeded: false`, `updatedAt` 2026-06-13); `traditionIds` is empty on 87 of 87 schools; the hub's theme rail was removed on 2026-08-25 (commit 4a011b2) for exactly this reason.

---

## 6. Calendar literals

**The literal the prompt cites has moved.** As of commit af318d2 (2026-09-01, this branch), the hub week label is computed in `src/lib/cfb/week.ts`, not `hub-data.ts:199-204`:

```
const CFB_2026_WEEK_1_MONDAY = '2026-08-31';
cfbWeekNumber(today) = today < Aug 31 ? null : min(15, floor(days/7) + 1)
```

The previous value was `'2026-08-24'` (the Monday of Week 0) and the label ran one high; the fix moved the constant and pinned it with a test. The module's own header calls it "a hardcoded season constant with no 2027 story ... nothing fails when it is not [re-derived]."

**What happens when the season ends.** The label is only rendered when the Monday-to-Sunday window contains a rivalry game (`hub-data.ts:146-150`). After the last stored game (Army-Navy, 2026-12-12) the window is empty, the rail falls back to `next-up` over games dated on or after today, that set is also empty, and `page.tsx:89` hides the rail entirely. So the counter never prints a wrong number for the 2026 postseason; the rail simply disappears and stays gone. The failure is deferred to 2027: any 2027 game docs loaded before the constant is re-derived get labelled **WEEK 15** for the whole season, because every 2027 date is more than 15 weeks past 2026-08-31 and the counter clamps there.

**The `week` field games carry is not a calendar week either.** `rules.ts:99-110` computes it as the school's game ordinal by date, but a game doc is shared by two schools, so the stored value is whichever school's parse wrote the doc. Measured: 339 docs match both schools' ordinals, 179 match home only, 104 away only, 40 neither (tombstoning shifted the ordinals). On the pages, **48 of 87 tracked schools show a duplicated "Wk N" label** (68 rows), for example Tennessee's Oct 17 and Oct 24 games both read "Wk 7", and Washington State skips Wk 3, 6 and 8. Switching the hub label to the stored field would not fix the label; it would import this.

**Every other calendar literal in the CFB path** (`src/lib/cfb`, `src/components/cfb`, `src/app/cfb`; tests excluded):

| File:line | Literal | Nature |
|---|---|---|
| `src/lib/cfb/week.ts:51` | `'2026-08-31'` | Week counter anchor. Re-derive every August. |
| `src/lib/cfb/rivalry-index.ts:30-31` | `RIVALRY_WEEK_START = '2026-11-21'`, `END = '2026-11-29'` | Rivalry Week window, also baked into FAQ copy at `:72`. |
| `src/lib/cfb/rules.ts:19` | `CONFERENCE_2026` table | Season-scoped by design; the key is the literal. |
| `src/lib/cfb/metadata.ts:26`, `rivalry-jsonld.ts:20`, `RivalryMatchupPage.tsx:19` | `YEAR = 2026` / `SEASON = 2026` | House rule (never `getFullYear()` in SEO copy). Intentional, still a yearly edit. |
| `hub-data.ts:194`, `matchups.ts:143`, `matchups.ts:303`, `page-extras.ts:93`, `CfbSchoolPage.tsx:53` | `conferenceBySeason?.['2026']` | Five call sites keyed on the season string. |
| `metadata.ts:182,191,259,264`; `CfbSchoolPage.tsx:317`; `cfb/page.tsx:68`; `rivalries/page.tsx:65,171,186`; `hub/blocks.tsx:64,70`; `matchup-description.ts:99-102` | "2026" in titles, descriptions, eyebrows, aria labels, "Not in 2026", "No 2026 meeting" | Copy literals. |
| `scripts/cfb/run-phase2.ts` (`SEASON`), `scripts/cfb/lib/schools-2026.ts` | season constant and the 86-school config file | Pipeline side. |

`hub-data.ts:25` uses `new Date()` for the America/Chicago "today" anchor (the intended ISR cutover); `data.ts:161,165` use `Date.now()` for a cache TTL. Neither is a season literal.

---

## 7. What the pages show today

Fetched 2026-09-02 15:35 UTC with a unique query string and no-cache headers. Every response came back `x-vercel-cache: PRERENDER`, `age: 0`, so these are fresh renders of the live data, not CDN copies. Schools chosen to span the range: Tennessee (anchor list), Washington State (below the index floor), Liberty (12 of 12 verified), Arizona State (0 of 12 verified), Notre Dame (independent, touched 08-11). Plus the hub.

**Tennessee** (`noindex` absent, 12 rows). Sep 5 vs Furman: `3:30 PM ET · SEC Network+/ESPN+`. Sep 12 at Georgia Tech, ten days out: **Kickoff TBA** (stored TBD, and inside the 12-day announcement window the spec describes; not re-checked against the school site in this audit). Sep 26 vs Texas at Neyland renders **`11:00 AM CT`** for a Knoxville game (stored from the Texas side; correct clock, wrong zone for the venue, and the only CT time on a page of ET rows). Oct 17 Alabama and Oct 24 at South Carolina both labelled **Wk 7**; there is no Wk 8. Nine of 12 rows read Kickoff TBA.

**Washington State** (`data-cfb-noindex="true"` and `<meta name="robots" content="noindex,follow">`, 6 rows). Apple Cup Sep 6 at Husky Stadium: `1:00 PM PT · NBC`. Three home rows show only "Home" with no stadium name (no venue doc). Week labels run 1, 2, 4, 5, 7, 9. Three rows TBA.

**Liberty** (12 rows). Every row carries a kickoff and a network. Sep 5 at James Madison `12:00 PM ET · ESPN U`. This is what the template looks like when verification succeeded; it is the best page of the five.

**Arizona State** (12 rows). **Every row reads "Kickoff TBA"**, including Sep 5 vs Morgan State this Saturday. The corpus holds real times for 3 games; none is verified, so none shows. A fan checking for Saturday's kickoff gets nothing.

**Notre Dame** (12 rows). Sep 6 Wisconsin at Lambeau: `N · Neutral site · 7:30 PM ET · NBC and Peacock`. Rice, Michigan State (Megaphone Trophy), Purdue (Shillelagh Trophy) all carry times. Four rows TBA.

**Hub `/cfb`.** "THIS WEEK · RIVALRY GAMES / UPDATES MONDAY AM · WEEK 1" over three games: California-UCLA Sep 5, James Madison-Liberty Sep 5, Apple Cup Sep 6. Consistent with the Sep 1 fix. The four curated national blocks resolve dates and trophies from Firestore.

**What reads stale or wrong to a fan this Saturday:**

- A Week 1 opener with no kickoff on 15 tracked-school rows, Arizona State's included, when the corpus itself has held the time since July 7.
- "Kickoff TBA" on Week 2 games (Sep 12) that are inside the 12-day announcement window the spec was designed around.
- The six Aug 29 games (Florida State, North Carolina, Stanford, UNLV, USC, Virginia and their opponents) still render as upcoming fixtures with a kickoff time and no result. Not curled in this sample; the renderer has no past-date branch (`CfbSchedule.tsx` has none) and Firestore `status` never leaves `scheduled`, so the code path is deterministic.
- Duplicated week numbers on 48 school pages.
- A CT kickoff on an ET home game.
- No page carries an "updated" or "rechecked" line, which is honest. The schedule footer says "Kickoff times show once announced and confirmed on a second source; until then, Kickoff TBA." The wording is true, but "once announced" describes a process that does not exist.

---

## 8. The gap list

Ordered by what a fan notices first. No fixes, no sequencing.

### Designed and not built

1. **The in-season near-term sweep** (kickoff and TV, 2 to 3 times a week, next 2 to 3 weeks, rolling 12-day window). Spec section 7 and decision record section 10. Nothing exists. This is the gap behind every "Kickoff TBA" on a game within two weeks, and behind the 335 TBD kickoffs from Week 4 on that will never fill.
2. **Game status transitions.** `status: 'scheduled' | 'completed' | 'canceled'` is in the type; no writer ever sets anything but `scheduled`. Played games render as upcoming.
3. **Verify on every write, as a runner.** The corroboration logic exists only inline inside the Phase 2 writer. No standalone re-verify pass; the 19 "could not normalize" and 28 conflict flags from July are frozen, and any future writer bypasses verification by default.
4. **The Wednesday weekly full sweep** for newly announced theme designations. Nothing exists.
5. **The themeDesignations attach path** and the Sonnet context extractor with `announcedFor2026` disambiguation. Nothing exists; 0 of 670 games carry a designation; the read path is ready and dark.
6. **Event-driven re-fetch and a season-gated CFB descriptor** in the multi-league runner. `league-registry.json` has no CFB entry.
7. **IANA timezone on kickoff** (spec section 4, `types.ts` `CfbKickoff.tz`). Stored as two-letter labels; 29 timezone-guard failures and the Tennessee CT row trace to this.
8. **Phase 4 editorial.** 0 of 87 schools are `destination`; the 2 tradition docs are unreferenced. Editorial time, not pipeline time, but the hub theme rail and the "destination page" tier both wait on it.

### Built and not running

1. **`scripts/cfb/run-phase2.ts`**, the only fetch-parse-verify writer. Quarantined 2026-08-11 over an undiagnosed `tagRivalry` regression (74.1% measured rivalry-tag loss on a full dry run). Even before the quarantine it was a manual CLI run with no schedule.
2. **`run-phase2-reconcile.ts` and `run-phase2-gate.ts`.** One-shot, 2026-07-07. Reconcile's dedupe and re-corroboration would need to re-run after any new parse.
3. **`backfill-venue-capacity.ts`.** One-shot 2026-07-08, 64 of 77; the remaining 13 were never closed.

### Running and stale

1. **ISR and IndexNow.** School and hub pages re-render every 21600 seconds and the deploy hook re-submits every CFB URL to IndexNow after each production deploy (twelve successful hook runs since Aug 30). The site continuously republishes the 2026-07-07 snapshot as if it were current. This is the only CFB thing that runs on a schedule.
2. **The hub week counter.** Correct today after the Sep 1 fix; a hardcoded constant that must be re-derived by hand each August and mislabels every week as WEEK 15 if it is not.
3. **The August structural repairs** (tombstones, neutral-site slugs, Washington State seed, Notre Dame city) are durable and correct, and they are the only writes since July. They carry `fetchedAt` 2026-07-07 forward.

---

## Method notes

- Firestore reads: three scratchpad scripts using the web app's `firebase-admin` credential, full-collection `get()` on the five collections, no writes. Counts were computed in memory from every doc returned and cross-checked against the collection sizes (87 / 86 / 670 / 212 / 2); no returned count was trusted over a diff against the doc list.
- "Last run" dates come from Firestore `updateTime` on the touched docs, not from file mtimes or commit dates, except where a generated report carries its own timestamp.
- Item 7 sampled five school pages and the hub. Past-game rendering on the Aug 29 slate is asserted from the renderer and the stored status, not from a fetch of those pages.
- Network: 6 requests of the 40 permitted.
