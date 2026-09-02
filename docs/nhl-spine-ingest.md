# NHL season spine: ingest and offline join measurement

Status date: 2026-09-02. Branch `feature/nhl-spine-ingest`. **The `games` write
was EXECUTED 2026-09-02 02:16Z under a separate authorization** (step B1 of the
2026-09-01 brief); see the Executed section at the end. Everything above that
section describes the dry-run build and still holds.

Why this exists: `promo-pipeline/docs/scanner-framework.md` 6e and the
2026-09-01 ruling make the season spine a hard gate for the NHL full-league
execute. The pipeline's season gate (`lib/scanner/season-gate.js`) joins every
extracted promo date to a home game in the `games` collection and holds any
row that does not join exactly once. NHL had zero rows in that collection, so
the gate could not run for NHL at all. This branch builds the rows.

## Files

| file | role |
|---|---|
| `src/lib/ingest-nhl.ts` | ingestion core: 32 NHL API fetches, dedupe by game id, doc build, gated execute path |
| `scripts/ingest-nhl-schedule.ts` | CLI: dry-run writes the doc array to a local JSON file; `--execute` needs `--snapshot=` |
| `scripts/measure-nhl-spine-join.ts` | offline join of stored upcoming NHL promos against a dry-run games file |
| `src/lib/types.ts` | `Game` gains optional `nhlGameId`, `nhlSeasonCode`, `neutralSite` |

Run (dry-run, 32 fetches, or 0 with a warm payload cache):

```
npx tsx --env-file=.env.local --require ./scripts/stub-server-only.cjs \
  scripts/ingest-nhl-schedule.ts --out=/path/nhl-games-2026.json \
  --cache-dir=/path/payloads [--use-cache]

npx tsx --env-file=.env.local --require ./scripts/stub-server-only.cjs \
  scripts/measure-nhl-spine-join.ts --games=/path/nhl-games-2026.json --today=2026-09-01
```

## Source and doc shape

Source: `https://api-web.nhle.com/v1/club-schedule-season/{ABBREV}/20262027`,
one fetch per club. The payload carries `gameType` (1 preseason, 2 regular, 3
playoffs), `gameDate`, `startTimeUTC`, `venueUTCOffset`, `venueTimezone`,
`neutralSite`, and home and away tri-codes. Every game appears in two clubs'
payloads and is deduped by the NHL game id.

Doc shape, matching what `indexSpine` and `joinPromo` read:

| field | value |
|---|---|
| `id` | `nhl-{date}-{awaySlug}-at-{homeSlug}`, the NFL id convention |
| `league` | `"nhl"` |
| `season` | `2026` (Number) |
| `nhlSeasonCode` | `20262027` |
| `seasonType` | `"preseason"` for gameType 1, `"regular"` for gameType 2; other types skipped and counted |
| `date` | the API `gameDate`, which is the venue-local calendar day (EXTRACTION-RULES 7.3.3) |
| `gameTime` | UTC HH:MM |
| `gameTimeTz` | the API `venueTimezone` |
| `homeTeamSlug`, `awayTeamSlug` | Firestore team doc ids via `NHL_ABBREV_TO_SLUG` |
| `venueName`, `neutralSite`, `status`, `nhlGameId` | as read |
| `week` | absent. NHL has no weeks; the gate's week cross-check goes inert as `weekCheck: "join-only"` |

**Season convention.** `season` is the calendar year the season starts, so
2026-27 is `season: 2026`. The pipeline must call
`loadSeasonSpine({ league: "nhl", season: 2026 })`. The NHL's own code is kept
alongside as `nhlSeasonCode` so neither is derived from the other.

**Venue-local dates without a hand-built map.** ESPN returns no timezone, which
is why the NFL ingest carries `ESPN_VENUE_ID_TO_INFO`. The NHL API states the
venue zone per game. The ingest still recomputes the local day two ways, from
`startTimeUTC` plus `venueUTCOffset` and through `venueTimezone` with Intl, and
reports every disagreement with `gameDate`. Both counts were 0 on 1,409 games.

**Abbreviation map.** 32 entries, verified with one read-only query against
`teams` where `league == "NHL"`: 32 live docs, 32 map entries, 0 missing, 0
unmapped. `UTA` maps to `utah-hockey-club`; the Mammoth rename is deferred by
decision (`promo-pipeline/team-configs/nhl.js`), never `utah-mammoth`. The map
check runs before the first fetch so a miss costs no network.

**Non-NHL opponents.** A preseason exhibition against a non-NHL side would
carry an unknown tri-code. Such games are skipped and listed, not fatal; only
a regular-season game with an unknown side aborts. None occurred in 2026-27.

## Dry-run result, 2026-09-01

| measure | value |
|---|---|
| fetches | 32 (0 retries, 0 failures) |
| raw games across payloads | 2,818 |
| unique by game id | 1,409 |
| docs built | 1,409: preseason 65, regular 1,344 |
| skipped by gameType | none |
| gameDate vs offset-day mismatches | 0 |
| gameDate vs tz-day mismatches | 0 |
| missing venue zone | 0 |
| regular home games per club | 42 for all 32 clubs |
| preseason home games per club | 2 for 29 clubs; 3 for los-angeles-kings and montreal-canadiens; 1 for utah-hockey-club |
| earliest preseason date | 2026-09-19 |
| regular-season opener | 2026-09-29 (matches `NHL_REGULAR_SEASON_START` in the pipeline) |
| last regular-season date | 2027-04-10 |

The 84-game season is why regular is 1,344 rather than 1,312: 32 clubs, 84
games each, halved.

Known-truth rows, both PASS:

| row | expected | got |
|---|---|---|
| Bruins opener (pending-decisions entry 7) | 2026-09-29 NYR at BOS, id 2026020003, regular | same, doc `nhl-2026-09-29-new-york-rangers-at-boston-bruins` |
| Detroit Oct 4 (entry 8) | 2026-10-04 WPG at DET, id 2026020035, regular | same, doc `nhl-2026-10-04-winnipeg-jets-at-detroit-red-wings` |

Neutral-site games (11), kept in the spine as the listed home club's game
because the join is by home club and date, and a promo attached to one of
these dates is still that club's promo:

| date | game | venue | zone |
|---|---|---|---|
| 2026-09-19 | VGK at LAK | Toyota Arena | America/Los_Angeles |
| 2026-09-21 | PHI at WSH | GIANT Center | America/New_York |
| 2026-09-21 | OTT at MTL | Colisée Vidéotron | America/Montreal |
| 2026-09-24 | NSH at CAR | First Horizon Coliseum | America/New_York |
| 2026-10-25 | MTL at WPG | Princess Auto Stadium | America/Winnipeg |
| 2026-11-12 | CAR at SEA | Veikkaus Arena | Europe/Helsinki |
| 2026-11-14 | SEA at CAR | Veikkaus Arena | Europe/Helsinki |
| 2026-12-18 | CHI at OTT | PSD Bank Dome | Europe/Berlin |
| 2026-12-20 | OTT at CHI | PSD Bank Dome | Europe/Berlin |
| 2026-12-31 | COL at UTA | Rice-Eccles Stadium | America/Denver |
| 2027-02-20 | VGK at DAL | AT&T Stadium | US/Central |

The four European dates carry Europe zones and their `date` is the venue-local
day in Europe. No club promotions page lists an arena giveaway for a game
abroad, so a promo on those dates would be a claim worth reading, not a join
to trust blindly.

## Offline join measurement, 2026-09-01

Inputs: the dry-run games file above; the stored NHL promo docs read from
Firestore with two read-only queries (`teams` where league NHL, then one
`collectionGroup("promos")` read filtered client-side). 1,137 NHL docs, 0
tombstoned, 562 dated before 2026-09-01, **575 upcoming across 18 clubs**.

Every upcoming stored promo joins exactly one home game.

| club | upcoming | joined one | zero | many |
|---|---|---|---|---|
| anaheim-ducks | 34 | 34 | 0 | 0 |
| boston-bruins | 10 | 10 | 0 | 0 |
| buffalo-sabres | 25 | 25 | 0 | 0 |
| carolina-hurricanes | 18 | 18 | 0 | 0 |
| chicago-blackhawks | 23 | 23 | 0 | 0 |
| colorado-avalanche | 23 | 23 | 0 | 0 |
| columbus-blue-jackets | 24 | 24 | 0 | 0 |
| detroit-red-wings | 85 | 85 | 0 | 0 |
| edmonton-oilers | 13 | 13 | 0 | 0 |
| florida-panthers | 23 | 23 | 0 | 0 |
| los-angeles-kings | 79 | 79 | 0 | 0 |
| montreal-canadiens | 29 | 29 | 0 | 0 |
| nashville-predators | 49 | 49 | 0 | 0 |
| new-jersey-devils | 22 | 22 | 0 | 0 |
| san-jose-sharks | 42 | 42 | 0 | 0 |
| st-louis-blues | 28 | 28 | 0 | 0 |
| vegas-golden-knights | 17 | 17 | 0 | 0 |
| winnipeg-jets | 31 | 31 | 0 | 0 |
| **total** | **575** | **575** | **0** | **0** |

Zero of the 575 joined a preseason game, which agrees with the pipeline's
preseason-hold pass having held every preseason row before it was written.

**Opponent consistency.** The join is date-only, so the measurement adds the
one extra check the spine allows: does the stored `opponent` string name the
club the spine says visited that night? 575 rows carry an opponent; 575
match. The one string that needed a rule is Utah, stored as "Hockey Club" on
san-jose-sharks 2027-01-18 (the 2024-25 club name); the matcher accepts
"Utah", "Mammoth" and "Hockey Club" for `utah-hockey-club`.

What this does and does not say. It says the corpus the watched executes
wrote is consistent with the published schedule on every row, date and
opponent. It does not say the gate has been observed holding a real extracted
row (framework 6d): that needs the gate wired into `scan-nhl.js` and a run
where reached and fired counts are printed. The known-bad block below is the
6b.6 evidence that the gate can say no.

## Known-bad input: Calgary (framework 6b.6)

Calgary's live page on 2026-09-01 carries seven bare-dated theme rows whose
printed weekdays match 2026, not 2027 ("Wed, Mar 18" is a Wednesday in 2026
and a Thursday in 2027). They are last season's rows. A Sep-Dec / Jan-Jun
rollover rule reads them as 2027. Both provenance checks pass them, because
the words and the dates are on the page. Only the spine can hold them.

Flames 2027 home dates in March and April from the spine: 03-03, 03-05,
03-15, 03-17, 03-21, 03-23, 03-25, 03-27, 04-08, 04-10.

| verbatim row | forward-resolved (2027) | true date (2026) |
|---|---|---|
| Regular Season, Mar 18 vs St. Louis Blues | HELD, no home game | HELD, no home game |
| 2000's Night, Mar 20 vs Florida Panthers | HELD | HELD |
| Regular Season, Mar 22 vs Tampa Bay Lightning | HELD | HELD |
| Scratchy Tuesday, Mar 24 vs Los Angeles Kings | HELD | HELD |
| Scratchy Tuesday, Mar 26 vs Anaheim Ducks | HELD | HELD |
| South Asian Celebration, Mar 28 vs Vancouver Canucks | HELD | HELD |
| Fan Appreciation, Apr 16 vs Los Angeles Kings | HELD | HELD |

7 of 7 held under both readings; 0 joined by coincidence. A coincidental join
is a real limitation of a date-only join and would have been reported here
had one occurred; the opponent check in the measurement script is the
second line for that case.

## What a write touches (executed 2026-09-02, see below)

- `ingestNhlSchedule({ execute: true, snapshotPath })` counts existing `games`
  docs with `league == "nhl"` (expected 0 today), writes them to the snapshot
  file before the first batch, then upserts 1,409 docs with `merge: true` in
  batches of 400. The CLI refuses `--execute` without `--snapshot=`.
- `src/lib/data.ts` `getGamesForTeam` returns `[]` for any league other than
  mlb and nfl, so NHL team pages do not change when the rows land. Extending
  the reader is separate work.
- `loadSeasonSpine` in the pipeline filters `league == "nhl"` and
  `season == 2026`, equality filters only, so no composite index is needed.
- Re-ingest after schedule changes is idempotent; the NHL API is the source of
  truth and a game moved by the league updates in place because the doc id
  carries the date. A moved game leaves its old-dated doc behind, which is the
  same property the NFL ingest has and is worth a cleanup pass when it happens.

## Network and read accounting for this build

- NHL API fetches: 32, one per club, no retries.
- Firestore reads: 1 (teams check in the ingest) + 2 per measurement run
  (teams, promos collection group); the measurement ran three times while
  the opponent rule was added, so 7 reads total.
- Firestore writes: 0.
- Payload cache: the 32 payloads are in the session scratchpad; a
  `--use-cache` replay rebuilt a byte-identical dry-run file with 0 fetches.

## Executed 2026-09-02 02:16Z (step B1)

- Command: `scripts/ingest-nhl-schedule.ts --execute --snapshot=<path> --cache-dir=<payloads> --use-cache`
  from the 32 cached payloads. Fetches 0, cache hits 32.
- Pre-write assertion, run separately before the command: `games` where
  `league == "nhl"` was 0. The snapshot the CLI wrote before its first batch
  also holds 0 docs (`pre-write-snapshot-nhl-games-2026-09-01.json`, session
  scratchpad, takenAt 2026-09-02T02:16:52Z).
- Write: 4 batches (400, 400, 400, 209), upserted 1,409, errors 0.
- Read-back from Firestore, not the local file: 1,409 docs with league nhl,
  65 preseason and 1,344 regular, season 2026 on all, no doc carries a week
  field, all 1,409 carry ingestedAt; 32 clubs each at exactly 42 regular home
  games; both known-truth rows present (2026020003 Bruins 2026-09-29 vs NYR,
  2026020035 Detroit 2026-10-04 vs WPG); the four European rows store the
  Helsinki and Berlin venue-local day (2026-11-12, 2026-11-14, 2026-12-18,
  2026-12-20).
- Negative control: the production pages /mlb/new-york-yankees and
  /nfl/buffalo-bills were fetched before and after the write (2 fetches each
  side) and are byte-identical raw HTML, consistent with `getGamesForTeam`
  reading games only for mlb and nfl.
- Tombstone never delete: the writer only upserts with merge; nothing was
  deleted, and the collection had nothing NHL-scoped to delete.
- Rollback, if ever needed: delete the 1,409 doc ids in the dry-run file; the
  snapshot confirms there was nothing to restore underneath them.
