# Postseason bracket fixtures

Every file here is a whole stored document in the shape the pipeline writes to
`postseasonBrackets/{LEAGUE}_{season}`, including the fields the web must never
publish (`operatorLog`, `source`, `runId`, `seeds`, the hashes, `unplaced`).
They are kept in so the mapper tests can prove those fields are dropped.

Firestore timestamps are stored as `{ "__firestoreTimestamp": "<ISO>" }`. The
test helper revives them into objects with a `toDate()` method, which is what
the admin SDK hands the mapper.

## Live captures

| File | What it is |
| --- | --- |
| `MLB_2026.live-20260929T1715Z.json` | `postseasonBrackets/MLB_2026` read at 2026-09-29T17:15Z, before the first pitch. Eleven series upcoming, pair placeholders (`NYY/BOS`), role placeholders, 41 games with no start time. |
| `WNBA_2026.live-20260929T1715Z.json` | `postseasonBrackets/WNBA_2026` read at the same moment. Four first-round series underway at one final game each, `TBD` placeholders, three series with no games. |
| `MLB_2026.live-ingame-20260929T1909Z.json` | `postseasonBrackets/MLB_2026` read at 2026-09-29T19:09Z, with Game 1 of Phillies at Braves in progress at 1 to 1. One series underway, ten upcoming. |

| `MLB_2026.live-20260929T2008Z.json` | `postseasonBrackets/MLB_2026` read at 2026-09-29T20:08Z, after the pipeline's writer version 2. It carries `shortLabel` on every series and, on the four Division Series visitor slots, `feederSeriesKey` and two `candidates`. One of those feeders is being played. A game is in progress. |
| `WNBA_2026.live-20260929T2008Z.json` | `postseasonBrackets/WNBA_2026` read at the same moment. `shortLabel` on every series. Its placeholder slots carry the two new fields as null. |

| `WNBA_2026.live-20261001T0017Z.json` | `postseasonBrackets/WNBA_2026` read at 2026-10-01T00:17Z. The Lynx out (lost 0-2 to the Liberty), the other three first-round series live, the semifinals and Finals still `TBD`. |
| `MLB_2026.live-20261001T0017Z.json` | `postseasonBrackets/MLB_2026` read at the same moment. All four Wild Card series live, nothing final. |
| `MLB_2026.live-20261001T1625Z.json` | `postseasonBrackets/MLB_2026` read at 2026-10-01T16:25Z (WEB3, read-only), the state the served pages showed that day (bracket stamp 05:10Z). Three Wild Card series final (White Sox, Yankees, Padres), Braves and Phillies tied 1-1; the three winners already written into their Division Series slots, the fourth slot `ATL/PHI`. The 20-club table in `team-pick.test.ts` is built on this and the next file. |
| `WNBA_2026.live-20261001T1625Z.json` | `postseasonBrackets/WNBA_2026` read at the same moment (bracket stamp 04:20Z). Liberty and Dream through, Valkyries-Wings and Aces-Fever tied 1-1; semifinal A written as Dream against Liberty, semifinal B and the Finals `TBD`. |

Nothing in a live capture is edited.

## Locked computer brackets

| File | What it is |
| --- | --- |
| `predicted.WNBA_2026.json` | `predictedBrackets/WNBA_2026`, whole, read at 2026-10-01T00:17Z. Locked 2026-09-30 by the PREDICT session; permanent. reviewedSha256 9062bcca... |
| `predicted.MLB_2026.json` | `predictedBrackets/MLB_2026`, the same. reviewedSha256 f0af727d... One coin flip (AL-WC-A). |

They hold the operator fields (`seedFileAuthoredBy`, `computedBy`, `frozenBy`, `acks`), file paths, git blobs and hashes the page must never publish, so the mapper tests can prove they are dropped. They are in `PREDICTED`, not `FIXTURE`, in the test helpers: they are not bracket documents.

No 2026 bracket was decided when these were captured. The decided states (`decidedWnba`, `decidedMlb` in `__tests__/helpers.ts`) are built from the two 10-01 captures by setting the stored fields the pipeline sets when a series ends (status, winner, wins) and, for a slot with no feeder, the club and seed. The outcomes are chosen to exercise every rule, not predicted.

## 2025 documents built by the pipeline

No 2026 series had finished when G1 was built, so the final and mixed states
come from the pipeline's own captured 2025 payloads, run through the pipeline's
own adapters and `buildDocument` by `generate-2025.cjs` (promo-pipeline at
c7961e0). The web repo computes none of these values.

| File | What it is |
| --- | --- |
| `MLB_2025.final.json` | The real final 2025 payload, normalized. All eleven series final. |
| `WNBA_2025.final.json` | The real final 2025 payload, normalized. All seven series final. |
| `MLB_2025.replay-step-24.json` | Replay step 24: Wild Card round and one Division Series final, three Division Series underway, later rounds still placeholders. |
| `WNBA_2025.replay-step-10.json` | Replay step 10: three first-round series final, one underway. |
| `MLB_2025.replay-step-11.json` | Replay step 11: the Wild Card round final, nothing else started. Between rounds. (promo-pipeline at 5e4cadb.) |
| `MLB_2025.replay-step-40.json` | Replay step 40: everything but the World Series final, the World Series not started. One round left. |
| `WNBA_2025.replay-step-11.json` | Replay step 11: the first round final, the semifinals not started. |
| `WNBA_2025.replay-step-20.json` | Replay step 20: the semifinals final, the Finals not started. |

Two caveats, both stated so nobody reads more into these than they hold:

1. A replay step is the real final payload with later games reverted to the
   unplayed shape. What is real and what is synthesized is documented at the
   top of the pipeline's `lib/postseason/replay.js`.
2. `lastChangedAt` and `lastFetchedAt` are write-time stamps the real writer
   takes from the server clock. The generator sets them to four hours after the
   start of the last final game in the document.

To regenerate, from a promo-pipeline checkout:

```bash
PIPELINE=$PWD OUT=/path/to/this/directory MLB_STEP=24 WNBA_STEP=10 \
  node /path/to/this/directory/generate-2025.cjs
```

## Postseason promotion rows

`promos.postseason-20260930.json` holds rows of `teams/{club}/promos` in the
shape the postseason scanner writes (`isPostseason: true`, keyed on a bracket
game), as the PROMOS session specified them on 2026-09-30, keyed to games in
the two 20:08Z captures. No such row existed in Firestore when it was written.
Two of its rows are made to be refused: one tombstoned, one dated before the
capture. A regular row sits beside them so the reader filter has something
to keep.

## What no capture holds yet

The two 20:08Z captures carry `series.shortLabel`, `slot.feederSeriesKey` and
`slot.candidates`, so the short labels and the "two candidates" outcome are
tested against real documents.

No captured document holds a slot whose feeder is already decided, because no
2026 series had finished. That outcome, and a stored label of the form
`Winner of AL-WC-B`, are tested by overlaying the field on a capture or a
2025 document. Each such test says so where it does it.

## The lock, from the pipeline

| File | What it is |
| --- | --- |
| `golden.reference-wnba-2026.json`, `golden.reference-mlb-2026.json` | promo-pipeline `predictions/golden/reference-{league}-2026.json` at main 67aab9f, byte for byte (sha256 1b132e45... and 80aaf73a..., the values the pipeline's golden test pins). The locked documents' picks, chances, lengths, title odds and champion are tested against them. |
| `pins.predictions-frozen.json` | promo-pipeline `predictions/frozen/pins.json` at main 67aab9f. The four input hashes the page pins (`LOCKED_FINGERPRINTS`) are tested against it. |
