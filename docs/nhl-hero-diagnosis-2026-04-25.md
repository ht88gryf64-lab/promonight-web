# NHL Hero Absence Diagnosis

Date: 2026-04-26 (today, America/Chicago anchor)
Scope: Read-only diagnostic, no code or data changed
Source: `promo-pipeline/prototypes/nhl-diag.ts` (gitignored, run via `npx tsx --env-file=.env.local`)

## Verdict

**Scenario: Data gap (scanner-side).** Phase 1.5's `getPlayoffPromosInDateRange()` and `pickHeroBuckets()` are working correctly. The NHL is absent from today's hero because no NHL `playoffPromos` documents exist with `date = 2026-04-26`. Only two NHL records sit anywhere inside the 14-day hero window, and both fall on 2026-04-30, which would normally land in "Coming Up". The bucket is hidden in collapsed-to-Tonight mode (today saturates with 5+ promos).

## Evidence

### `playoffPromos` collection state

| Metric | Value |
|---|---|
| Total docs | 278 |
| NHL docs | 162 |
| NBA docs | 116 |
| NHL distinct teams represented | 16 |
| NHL docs with non-null `date` | 64 |
| NHL docs dated today (`2026-04-26`, Chicago) | **0** |
| NHL docs in 14-day hero window `[2026-04-26, 2026-05-10]` | **2** (both on 2026-04-30) |
| NBA docs in same window | 10 |

### NHL date distribution

```
(null-date): 98
2026-04-12:   1
2026-04-13:   2
2026-04-15:   1
2026-04-16:   1
2026-04-17:   8
2026-04-18:  15
2026-04-19:   6
2026-04-20:  10
2026-04-21:   4
2026-04-22:   4
2026-04-23:   5
2026-04-25:   5
2026-04-30:   2   <- only future-dated NHL records
```

Coverage stops at **2026-04-25** and jumps to **2026-04-30**. The 4/26 through 4/29 window is empty for NHL, which is exactly the slot Round 1 Game 4s land in.

### `appConfig/playoffs` state

- `playoffsActive`: true
- `nbaActive`: true / `nhlActive`: true
- 30 teams in `activeTeamIds`, including all NHL home teams hosting tonight's listed Game 4s:
  - `ottawa-senators` (vs Hurricanes)
  - `philadelphia-flyers` (vs Penguins)
  - `minnesota-wild` (vs Stars)

So the bracket config is correct. The active-team filter is not the limiter.

### Filter funnel `getPlayoffPromosInDateRange()` reproduces

```
isPlayoff=true total:                   278
with non-null date:                     128
date in [today, today+14] (Chicago):     12
...AND teamId is in activeTeamIds:       12

IN-WINDOW by league:        { NHL: 2, NBA: 10 }
IN-WINDOW + active team:    { NHL: 2, NBA: 10 }
```

The data layer is letting through everything it should. There is nothing dropping NHL records that exist; the records simply aren't in Firestore.

### Why the hero showed 0 NHL despite 2 in-window records

The homepage today is in **collapsed-to-Tonight mode** because today has 5+ promos in the `tonightPool` (`pickHeroBuckets()` at `tonight-strip.tsx:106`). In that mode, only the Tonight bucket renders and Weekend / Coming Up are hidden. Today's NHL pool is `[]` because no NHL records carry `date = 2026-04-26`. The 2 records dated 2026-04-30 would have surfaced in Coming Up under non-collapsed mode, but they're elided here by design.

This is correct collapsed-mode behavior. If the spec ever changes to "always show at least one card from each league when available," that's a different feature, not a bug.

## What this is not

- Not a casing bug. NHL records use `league: "NHL"` consistently (all 162 records).
- Not a timezone bug. The Chicago anchor + ISO-to-YMD shim in `getPlayoffPromosInDateRange()` matches what the page uses for `today`. NHL records dated 2026-04-25 in Chicago are correctly excluded as "in the past" relative to today (2026-04-26).
- Not a `highlight` flag check. `getPlayoffPromosInDateRange()` does not filter on `highlight`; round-robin only prefers hot promos within a league, never excludes non-hot.
- Not the 8-card cap. Even if the cap were 16, today's NHL pool is `[]`.
- Not a league filter dropping NHL. NBA and NHL both flow through the same code path; NBA records (10 in window) all surfaced.

## Recommended next step

**Clean handoff to the scanner thread.** Suggested issue title: *NHL playoff scanner missing Game 4 window (2026-04-26 through 2026-04-29)*.

Things the scanner thread should investigate:

1. **Re-scan NHL active teams for the upcoming-week home schedule.** All 16 NHL teams that have ever appeared in `playoffPromos` are still relevant; the 30 teams in `activeTeamIds` include the 3 hosts for tonight's Game 4s.
2. **Find out why dated NHL entries cluster around 2026-04-17 to 2026-04-25 then stop.** A few hypotheses worth testing:
   - The scanner pulled team-page snapshots once at the start of Round 1 and did not refresh as Game 4 dates were posted.
   - The scanner relies on a per-team source URL that returned a stale schedule.
   - The scanner was running NBA-only since 4/25.
   - Date extraction is failing for the new postings (could land in the 98 `(null-date)` NHL records; those were intentionally excluded from the hero, but if there are 2026-04-26 entries hiding among them, that's a scanner extraction bug, not a missing-source bug). Worth sampling `(null-date)` NHL records by `scannedAt` to see if any were freshly written but didn't get a date assigned.
3. **Compare scanner cron schedule between leagues.** NBA filled out 10 future entries; NHL has 2. Cron cadence or per-league timeouts may differ.

Concrete acceptance criteria for the scanner fix: at least one `playoffPromos` document per actively-playing NHL home team with `date = 2026-04-26` (or whatever today is at the time the fix lands), `isPlayoff = true`, and `teamId` in `activeTeamIds`. With those records in place, the existing Phase 1.5 logic will surface them automatically; no code change on the homepage side.

## Null-date sampling

Source: `promo-pipeline/prototypes/nhl-null-date-sample.ts` (gitignored).

### Counts

| Metric | Value |
|---|---|
| Null-date NHL records total | 98 |
| Null-date NHL records scanned in last 7 days | 98 |
| Null-date NHL records belonging to Senators / Flyers / Wild | 19 (Senators 5, Flyers 6, Wild 8) |
| Null-date NHL records with a date-like string in title / description / gameInfo | 12 |

### `dateConfidence` distribution

```
tba:        45
(empty):    49
tentative:   3
confirmed:   1
```

The scanner is correctly flagging non-dateable content as `tba` rather than hallucinating a date. The 12 records that surfaced a date-like regex hit were almost entirely soft matches (a generic `M/D` slash, or a date range like "April 7 to 17, 2026" describing a fan tour), not a missed game date.

### `scannedAt` histogram (last 30 days, Chicago)

```
2026-04-19: 49
2026-04-21: 28
2026-04-23: 21
```

**No null-date NHL records have been scanned since 2026-04-23 (~2.8 days ago).** The scanner has not run for the 4/24 to 4/26 window, which is exactly when Game 4 dates would have been confirmed by NHL teams as Game 3 results came in.

### Sample of recently-scanned null-date NHL records (top 20 by `scannedAt` desc)

All 20 most recent records were scanned within a single ~3-minute window on 2026-04-23 18:02-18:05 UTC, and all carry `dateConfidence` of `tba` or empty. The titles describe series-level recurring promos rather than per-game events:

- Senators: Rally Towel Giveaway (entire round), 50/50 Draw, $5 Beer / $2 Hot Dog deal, Ignite the Red theme campaign
- Flyers: not in the top-20 sample, but 6 records exist for them with the same shape
- Wild: Quinn Hughes Jersey sweepstakes, Playoff Food Drive, Playoff Pull Tabs, New Playoff Food
- Plus comparable records for Lightning, Hurricanes, Avalanche, Oilers, Canadiens, etc.

These promos genuinely run at every home playoff game in the round. They were not stripped of a date by an extractor bug; they never had a single date to extract. That is appropriate scanner behavior.

### What is missing

The scanner's output for null-date NHL records is healthy in shape but stale in time. What is missing is a fresh run that captures whatever per-game Game 4 promos NHL teams have posted between 2026-04-24 and now. Those posts would land as **dated** records (with `date = 2026-04-26` and `dateConfidence = tentative` or `confirmed`), not in the null-date pool.

Searching the 98 null-date records for "April 26", "4/26", "Saturday", "Game 4", "tonight" produced zero hits in title, description, or gameInfo. The Game 4 content has not been fetched at all.

## Verdict

**Scenario B: Scanner window gap.** Today's content was never fetched, not fetched-and-broken-during-extraction.

Sub-finding: the 98 null-date NHL records are not extraction failures. They are correctly-identified series-level promotions that lack a single game date by nature (rally towels at every home game, etc.). The extractor's `tba` flag is doing the right thing.

### Recommended next step

1. **Re-enable or trigger the playoff scanner.** Most recent successful write was 2026-04-23 18:05 UTC. Anything posted by NHL teams between 4/24 and now is missing. Confirm the scanner cron is healthy first; if it's been disabled or failing silently, that's the highest-leverage fix.
2. **Increase playoff-window scan cadence.** Once every 2 days is too slow during a Round 1 with 24-48h gaps between games. Game N+1 dates are typically confirmed within hours of Game N's final whistle. A 6h cron during active rounds would catch these.
3. **Out of scope for the homepage thread.** When the scanner produces dated NHL records for today, Phase 1.5 will surface them automatically. No homepage code change.

The earlier scanner-thread handoff note in this doc still stands; this appendix sharpens the acceptance criteria to "ensure the scanner cron has run successfully within the last ~6 hours, not just that the scanner code can produce dated records in principle."

## Out of scope (Phase 1.5 thread)

- No fix here. The scanner port is its own thread.
- Not modifying the round-robin to forcibly reserve a slot per league. Current behavior matches the spec ("variety across leagues" within available pool, not "guarantee a slot for empty pools").
- Not modifying collapsed-to-Tonight to reveal Coming Up when a league is missing today. Same reason.
