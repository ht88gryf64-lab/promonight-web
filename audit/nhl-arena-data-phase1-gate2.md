# NHL arena data, Phase 1 execute: Gate 2 report (seed writer extension)

2026-09-02. promo-pipeline branch `feature/venuehubs-confirmations`, commit feb3314 on top of main 65a4943. Not merged, not pushed. Zero verifiers, zero Firecrawl, zero plain fetches, zero Firestore writes (reads only for the control).

## What changed (three files, additive)

`lib/venuehubs-write-guard.js`: a `checkConfirmationsMap` step wired into both the building and the tenant-overlay checks. It runs only when the op carries a `confirmations` key (a legacy doc without the key passes untouched, so the map is required where the extended writer writes sources, not retroactively). When the key is present every rule is a hard failure: the map must be an object; every key must name a claim or pointer field of that doc type that the payload carries a value for and has a `sources` entry; every value must be exactly `independent` or `republish`; every sourced claim field with a value must have an entry (a sub-keyed source such as `publicTransit.lines` counts for its parent). The four URL pointer fields are exempt from the requirement, since a pointer's provenance is its URL; an entry on one is still validated. Exports the new function and the field lists.

`test/venuehubs-write-guard.test.js`: eight tests pin the map. A well-formed map passes and pointers need no entry; a legacy payload without the key passes; a value other than the two words fails; an unknown key fails; a sourced claim with no entry fails; an entry for a field with no source or no value fails; a non-object map fails and the batch guard throws; overlays are checked the same way.

`scripts/seed-venuehubs-facts.js`: the ops build is factored into `buildOps`, used by execute unchanged, and now writes `confirmations` (the record's map, or an empty map) on every building doc and overlay next to `sources`. A `--print-ops` dry-run flag builds and guards the exact ops execute would commit and prints each ref path, its written keys and its map, writing nothing. Snapshot, batch commit, read-back and the clear-bag suspect report are untouched.

## Tests

Guard file: 30 of 30 (22 existing, 8 new). Full suite: 792 tests, 792 pass, 0 fail.

## Dry run against the two WNBA hubs

The write-shape payload for the three NHL buildings (`p1/g1/nhl-g1-facts-v6-write.json`: v6 with the long-form confirmation records collapsed to the guard's two words, pointer entries dropped, and the Gate 3 Centre Bell shape applied) run through the extended writer with `--print-ops`:

- guard passed on 4 projected ops: `venueHubs/little-caesars-arena`, its `tenants/detroit-red-wings` overlay, `venueHubs/centre-bell`, `venueHubs/bridgestone-arena`;
- projected ops for `crypto-com-arena` and `climate-pledge-arena`: none;
- the two WNBA docs and their five overlays pass the guard exactly as stored, with no `confirmations` key present (16 and 14 source keys, verified true, updatedAt 2026-07-19);
- content hashes of both docs and all five overlays are identical before and after the dry run.

Projected confirmations: Little Caesars bag fields republish, transit independent, Red Wings gate republish; Centre Bell parking republish, transit independent; Bridgestone bag republish, parking republish, transit independent. All three project INDEXED.

## The write shape versus v6

Little Caesars and Bridgestone: stored values identical to v6. Centre Bell: `bagMaxDimensions` and `bagPolicyNotes` nulled and their source entries removed (`clearBagRequired` was already null, `bagPolicyUrl` and its source kept, so the bag renders as a pointer-only row), the Canadiens overlay not written (its gate stays in the held store), flag true. Nothing else moved.
