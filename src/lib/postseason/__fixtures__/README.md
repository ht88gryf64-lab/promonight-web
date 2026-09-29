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

Nothing in a live capture is edited.

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

## What no capture holds yet

The two 20:08Z captures carry `series.shortLabel`, `slot.feederSeriesKey` and
`slot.candidates`, so the short labels and the "two candidates" outcome are
tested against real documents.

No captured document holds a slot whose feeder is already decided, because no
2026 series had finished. That outcome, and a stored label of the form
`Winner of AL-WC-B`, are tested by overlaying the field on a capture or a
2025 document. Each such test says so where it does it.
