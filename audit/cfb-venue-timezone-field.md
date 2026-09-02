# CFB venue time zone as data, 2026-09-02

**Branch:** `feat/cfb-venue-timezone-field`, off `main` at 4f14dd2. The dry run, the read-path change that makes the record the source, the report on what has no record to carry the field, and (at the end) the execution record.

## What the write does

`scripts/cfb/populate-venue-timezones.ts` sets `timezone` (IANA) and `timezoneSource` (a plain provenance string naming the map and its generation date) on:

- `cfbVenues/{id}` for the 86 campus stadiums, from `CFB_VENUE_TIMEZONES` (generated from the stored coordinates, mirroring the pipeline's per-school `venueTz`, validated in `cfb-venue-timezones.test.ts`).
- `venueHubs/{slug}` for the 8 neutral-site buildings the 2026 `cfbGames` reference, from `CFB_NEUTRAL_HUB_TIMEZONES`.

Discipline: dry-run default; `--execute` snapshots the full before-state of every doc it will touch to `scripts/snapshots/` before any write; merge-writes the two fields only; never touches `updatedAt` (the pipeline's cfbVenues hygiene rule); refuses to run if any doc already carries a different `timezone`; reads every written doc back and exits non-zero on a mismatch. `timezoneSource` is a sibling field, not an entry under the venueHubs `sources` map, because that map is URL provenance read by the provenance probes.

## Dry-run diff (read-only, 2026-09-02)

```
mode: DRY RUN (no writes)
cfbVenues: 86 mapped; venueHubs: 8 mapped
set=94 skip-same=0 conflict=0 missing-doc=0
```

Every one of the 94 target docs exists and none carries a `timezone` today, so all 94 are plain sets. The full row list is the script's stdout; the neutral buildings resolve as: mercedes-benz-stadium, tql-stadium, bank-of-america-stadium, gillette-stadium, metlife-stadium to America/New_York; lambeau-field, nissan-stadium, cotton-bowl-stadium to America/Chicago. Campus rows follow the map exactly (Arizona's two to America/Phoenix, Boise to America/Boise, the four Central buildings east of -87.6 to America/Chicago).

## The 51 venueless home schools

`CFB_UNTRACKED_HOME_TIMEZONES` covers 51 home-school ids that have no `cfbVenues` doc. The dry run checked each for any doc at all:

- **50 have no document in either `cfbSchools` or `cfbVenues`** (they are untracked opponents, several under drifted spellings such as `jmu` / `james-madison-university`, `san-jos-state` / `san-jose-state`, `ecu` / `east-carolina`). There is no record to carry the field; the render map remains the only source for their home games (70 stored games, 30 of them displaying a kickoff).
- **1 has a `cfbSchools` doc and no venue doc: `washington-state`** (`venueId` empty). The field could live on the school doc, but nothing reads a zone from `cfbSchools`; the honest fix is a `cfbVenues` doc for Martin Stadium, which is a separate seed with its own two-source discipline.

## Read path: record first, map as fallback

`resolveVenueZone()` in `src/lib/cfb/venue-timezones.ts` now answers in this order: the venue record's `timezone` (cfbVenues for a campus game, venueHubs for a neutral site), then the render map, then the venueless-home map, then null (stored label shown as-is). Both readers use it: `src/lib/cfb/data.ts` (school pages) and `src/lib/cfb/matchups.ts` (matchup family, which loads the hub doc and passes its `timezone`). `CfbVenue.timezone?` and `VenueHub.timezone?` are typed; `toVenueHub` maps the field when it is an IANA string. Tests pin the precedence. Until the write executes every game resolves through the map, byte-identical to what is live now.

Not in this branch: the pipeline still carries its own per-school `venueTz` in `scripts/cfb/lib/schools-2026.ts`; pointing the verify stage at `cfbVenues.timezone` is a pipeline change for when that writer comes out of quarantine.

## Executed, 2026-09-02 16:51 UTC

```
mode: EXECUTE
set=94 skip-same=0 conflict=0 missing-doc=0
snapshot: 94 docs -> scripts/snapshots/venue-timezones.2026-09-02T16-51-44-343Z.snapshot.json
wrote timezone + timezoneSource on 94 docs (merge, no updatedAt)
read-back: 94/94 carry the expected fields
```

Closing dry run immediately after:

```
mode: DRY RUN (no writes)
set=0 skip-same=94 conflict=0 missing-doc=0
```

The snapshot is the full before-state of all 94 docs, at `scripts/snapshots/venue-timezones.2026-09-02T16-51-44-343Z.snapshot.json` on this machine. `scripts/snapshots/` is gitignored (`.gitignore:54`), as for every earlier repair snapshot, so the file is local, not in the repository.

## Two records, by necessity, named

1. **The venue record: `cfbVenues/{id}.timezone` and `venueHubs/{slug}.timezone`.** 86 campus stadiums and the 8 neutral-site buildings. This is the source both repos should read; `resolveVenueZone()` reads it first.
2. **The render map: `CFB_UNTRACKED_HOME_TIMEZONES` in `src/lib/cfb/venue-timezones.ts`.** 50 home schools in the corpus have no venue doc and no school doc (untracked opponents, several under drifted ids), and Washington State has a school doc but no venue doc. There is nothing to write a field onto, so for their home games (70 stored, 30 displaying a kickoff) the map is not a fallback but the record, and stays so until each gets a `cfbVenues` doc. The campus and neutral maps in the same file are now fallbacks only, kept for a doc that loses the field.
