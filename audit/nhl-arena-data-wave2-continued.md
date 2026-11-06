# NHL arena data, wave 2 continued: pipeline code, then the write

Date: 2026-09-03. Verifiers: 1 declared, 1 used (step B). Firecrawl: 0. Plain fetches: 0 so far of 12.

Rulings carried in and applied: both overlays written, American Airlines Center clearBagRequired false stored, the arena FAQ's building-level wristlet sentence appended, and v5 read before any write.

## Step A: per-field date and per-field state (promo-pipeline, MERGED and PUSHED)

Branch `feature/venuehubs-field-states`, one commit (faeccb6), merged `--no-ff` as d5b7d75 on top of 16a9d16, pushed. Main is level with origin.

### a. Per-field verifiedAt

`verifiedAtByField` is a map of field name to ISO timestamp, written by the writer at write time, one stamp per field it writes that carries a value. No doc-level date is copied onto fields: the doc keeps its own `verifiedAt`, and the per-field map is generated separately, so a field checked in wave 1 and a field checked in wave 2 never share a date because the document has one. The writer stamps it on every op, building and overlay, so the guard sees it everywhere.

Guard rules: every written claim field must have an entry; every value must be an ISO 8601 UTC string that parses; a stamp more than a minute in the future is refused, which is the only unreality the guard can detect from a date string alone.

### b. Per-field state, four values

`fieldStates` maps a claim field to exactly one of four states, and `fieldConflicts` carries the readings that one of them requires.

| State | What it asserts | Guard rule |
|---|---|---|
| rendered | a value is present and a source carries it | value present AND a sources entry exists. A rendered field with no source fails |
| operator-conflict | no value: the operator's pages disagree and rule 1.5 nulled it, the pointer stays so a reader can go read the operator | value absent AND the field's class pointer present AND `fieldConflicts[field]` holds at least two readings |
| no-operator-page | no value and no source: no operator page carries the policy | value absent AND no sources entry |
| held | the value sits in the held store, nothing renders, pointer included | value absent AND the field's class pointer absent |

The fourth state is the shape the old two-value vocabulary could not see. Ball Arena's transit is held with no URL of its own, so a test keyed on "URL present, value null" never looks at it. The state map is keyed on the field, not on a pointer, so it does.

Claim-to-pointer classes: the bag fields point at `bagPolicyUrl`, the parking fields at `officialParkingUrls` or `parkingLotMapUrl`, everything else has no pointer of its own, which makes the pointer clauses vacuous rather than unsatisfiable.

Two rules cover the "exactly one state" requirement: a field with a value or a source must have an entry, and the declared state must match the stored shape, so a held field that still carries a value fails, and so does a rendered field with no source.

Two design decisions worth your eye:

1. **The conflict readings are written to the document.** The guard can only enforce "both readings recorded" if it can see them, and the held store is stripped from the write shape. So `fieldConflicts` travels to Firestore. No reader sees it; the renderer prints the fixed conflict sentence.
2. **Both maps are checked only when present.** `verifiedAtByField` is writer-generated so it is always there, but `fieldStates` comes from the record, and the same writer serves the MLB, NFL, MLS and CFB lanes. Making a state map mandatory would fail every one of those lanes' payloads on their next run. Legacy documents and other lanes pass untouched, and every document this pipeline writes with a state map is fully checked.

### c. Tests and the dry run

| Check | Result |
|---|---|
| Guard test file | 47 of 47 (was 38) |
| Full suite | 811 of 811 (was 802) |
| States pinned | all four together in one passing payload; rendered with no source fails; held that renders fails; held that keeps its pointer fails; operator-conflict without its pointer fails; operator-conflict with one reading fails; a conflict entry on a non-conflict field fails; no-operator-page with a source fails; a field with a value and no state fails; the four words are exact; overlays checked the same way |
| Dates pinned | a missing entry for a written claim fails; a non-ISO string fails; a future stamp fails; an unknown field fails |
| WNBA control dry run | crypto-com-arena and climate-pledge-arena project no ops; both documents and all five overlays byte-identical before and after |
| Read-only guard sweep, 170 verified hubs | unchanged: the same single pre-existing t-mobile-park sources defect, no new failure from either map |

## The payload the write will use

`audit/nhl-wave2/nhl-w2-facts-v6.json`, write shape `nhl-w2-write-v6.json`. Guard passed on 11 projected ops (8 buildings, 3 overlays); every building projects indexable.

v6 is v5 plus the four rulings and the state maps:

- American Airlines Center clearBagRequired false, sourced to the arena FAQ's "Clear purses/bags are permitted but not required", confirmation operator.
- The FAQ's building-level wristlet sentence appended to the bag notes, which now cite both operator pages as an array.
- Both overlays promoted from proposed to written, the non-schema `proposed` key gone.
- `fieldStates` on all eight buildings and all three overlays; `fieldConflicts` on the two operator-conflict fields, American Airlines Center rideshare and Bridgestone clear-bag.

The state map put one thing on the record that had been implicit: Bridgestone's clear-bag row is operator-conflict, with both readings now stored. The bag-policy and arena-policies pages admit non-clear bags in the middle tier, while the screening section of arena-policies approves only clear, medical and parenting bags. That is the disagreement the brief expects that row to render.

## Step B: the v6 read

The declared verifier read every path from v4 to v6, tested each change against the harvest, and checked every state entry against the guard contract. Result: `audit/nhl-wave2/stepB-result.json`.

Verdict: 43 cells, 33 clean, **not verified end to end**. Nothing changed outside the expected set, and there were **zero field-state defects and zero value defects**. All ten findings are record text, and all ten are fixed in v7.

### What it confirmed

Every stored value the write will make survived the read:

- The clear-bag store is right. The FAQ sentence is a building-level entry, not tenant- or protocol-scoped, no other operator page contradicts it, and rule 1.6 does not force null because a clarity term is present.
- The appended wristlet sentence is byte-identical to the FAQ line, the verifier checked the quotation marks and dash at the code-point level, and it sits in the building-level Bag Policy answer.
- Both overlay rule texts are verbatim, both minute counts match their sentences, and no other operator page of either building carries a conflicting door time.
- Every state entry matches the stored shape. Ball Arena transit is legitimately held, and Pittsburgh's bag fields correctly carry no state because they have neither value nor source.
- Both conflict entries quote their pages correctly and are genuinely contradictory.
- The write shape matches the full record on every building and overlay, and no held text leaks into a published field.

### The ten findings, all record text

| Where | Finding |
|---|---|
| American Airlines Center held store | The Mavericks-protocol entry still banked the 4.5 by 6.5 wristlet allowance that the ruling just published, so it became a redundant held copy |
| American Airlines Center bag note | Still opened "fan-safety-guidelines is the only operator page that states a bag rule", which the FAQ ruling falsifies, and its tail still pointed at a held key deleted in v6 |
| American Airlines Center verify block | The bag class's operator page was replaced by the FAQ rather than added to, dropping the page that still sources the baseline block, the dimensions and the pointer |
| American Airlines Center notes | The operator-pages-read sentence still said fan-safety only; a wave-1 sentence still asserted clear-bag null under rule 1.6 in the present tense |
| American Airlines Center rideshare record | The pages-read list had shrunk to four of the five pages actually read |
| TD Garden bag note | My v5 fix replaced one wrong count with another. I counted the pages: seven bullets against seven, four byte-identical, not five of seven. The note also still called the policies page the only page stating the rule |
| TD Garden notes | The disproven "sentence for sentence" phrasing survived in verifyNotes after being removed from the confirmation note, so the record carried both accounts |
| TD Garden held store | The $65 rate was banked twice under incompatible framings, once as club-only and once as the new operator dispute |
| TD Garden gates | The status line was a template carried over from the American Airlines Center record; it claimed one operator page carries a door time while the same record quotes the policies page GA line twice |
| Dry-run artifact | My harness predates the confirmations work and never copied confirmations, pages-read or the state maps into its ops file, so that artifact was not proof of what the writer sends |

The last one is worth stating plainly. The guard checks did run: the writer's own dry run builds real ops and reported the guard passing on 11 of them with the state maps present. But the ops file a reader would take as evidence was stale. The harness now mirrors the writer, and the regenerated file carries all six maps.

### v7

`audit/nhl-wave2/nhl-w2-facts-v7.json`, write shape `nhl-w2-write-v7.json`, fix list `v6-to-v7-fixes.txt`, honest ops artifact `dry-run-ops-v7.json`. Guard passed on 11 ops; every building indexable.

Only two paths in the whole write shape changed from v6 to v7, both of them verifyNotes strings on the two buildings whose records were corrected. No stored value, source, confirmation, pages-read list or state moved. The values that go to Firestore are exactly the ones the verifier read clean.

v7's record fixes have not themselves been re-read; the declared verifier is spent.


## Step C: the write (executed 2026-09-04 01:07:17Z)

Snapshot at 01:05:25Z covered all eight buildings, their 13 overlays, the two control hubs and all ten `venues` documents (`audit/nhl-wave2/c/snapshot-w2.*.json`). The writer took its own snapshot as well.

### The harness proof the brief asked for

Two comparisons, because the artifact should predict what is actually written, not just what another dry run prints.

| Comparison | Result |
|---|---|
| Harness artifact against the writer's own `--print-ops`, field for field | 54 comparisons across 11 ops, 0 mismatches |
| Harness artifact against the live documents after the write | 227 comparisons across 11 ops, 0 mismatches |

The artifact now carries confirmations, operatorPagesRead, verifiedAtByField, fieldStates and fieldConflicts. Two harness gaps were fixed to get there: it never copied the four maps (the defect reported at step B), and it omitted `updatedAt`. One difference remains and is a printing artifact, not an op difference: the writer's printed key list filters null and empty fields, while the ops carry all 17 fact fields including nulls. The comparison applies the same filter before comparing.

### Write and read-back

| Check | Result |
|---|---|
| Writer | 8 buildings, 3 overlays, guard passed on 11 payloads, 11 updates applied, indexing floor 8 of 8 |
| Read-back on every value, source, confirmation, pages-read, verifiedAt entry and state | 473 comparisons, 0 mismatches |
| Banked-value leak check against the full held store | 0 leaks |
| Blast radius: any key outside the writer's set differing from the snapshot | 0 |
| Controls: 2 hubs, 14 untouched overlays, 10 venues documents | 0 moved |

Per-field dates landed on every written claim: 6 fields on Ball Arena, 7 on American Airlines Center, 6 on United Center, 6 on Centre Bell, 7 on TD Garden, 9 on Little Caesars, 6 on Bridgestone, 5 on Pittsburgh, and one on each of the three overlays.

### The clear-bag tripwire

The writer's clear-bag guard reports 4 open suspects, up from 0. None is a defect, and all four are the adjudications this wave already recorded:

| Building | Flag | Why it is right |
|---|---|---|
| td-garden | clearBagRequired false with clear bags and clutches in the notes | Rule 1.3: the page caps clear and non-clear bags at the same 6 by 4 by 1.5 inches, so clear is an alternative, not a mandate |
| american-airlines-center | clearBagRequired false with wristlet language | The arena FAQ says outright "Clear purses/bags are permitted but not required" |
| ball-arena | clearBagRequired null with clutch language | Rule 1.6: no clarity term on any operator page |
| united-center | clearBagRequired null with exception language | Rule 1.6: same |

They sit in the guard's open list because none is in its ADJUDICATED set. I have not added them: that set pins a verdict, and a wrong entry silences a real tripwire, so it is your call. Left as is, the tripwire reports these four on every future run.

## Step D: the web work (merged and pushed, web main 9d2825e)

Branch `feature/venue-claim-provenance`, one commit (7d64b61), merged `--no-ff` as 9d2825e and pushed. 730 tests, 0 failures, typecheck clean, production build clean.

| Brief item | What changed |
|---|---|
| a. Title, description and rail-card subtitle derive from carried fields | `venueHubTopics` computes what the page actually renders from the same predicates the body uses. The title was a template naming bag policy, parking and food on every building; it now names only what the document carries, at most three terms, and a held building gets its name and the page type alone. The rail card was a template naming bag policy, parking and gates on every card; it now lists that building's own topics, and a building with none gets "Gameday guide". The description already derived from these predicates and now shares the transit one, so the three cannot drift |
| b. Every rendered claim carries a source link and its own date | New `src/lib/venue-claim.ts` resolves a field's source URL and its own `verifiedAtByField` stamp. A `ClaimLine` renders under the bag card, the parking card, the transit row, the rideshare row and each gate row. The date never falls back to the doc-level `verifiedAt` |
| c. Rows render per state | rendered shows claim, link and date; operator-conflict shows the reason and keeps the operator pointer; no-operator-page shows the reason with no pointer; held renders nothing at all |
| Mapper gate | The state is applied in `toVenueHub`, not at each card. An exclusion at one render site is not an exclusion, because the next render site added does not inherit it. The pipeline guard already refuses to write a value onto a non-rendered field, so on today's data this changes nothing; it is the lock that holds if a future writer or a hand edit gets it wrong |

New tests pin all four states, the per-field date with no fallback, a legacy document with no maps leaving the old gates in charge, the mapper gate, an unknown state value being dropped rather than trusted, and the title naming no topic the page withholds.

## The clear-bag adjudications (promo-pipeline, MERGED and PUSHED)

Branch `feature/clearbag-adjudicate-nhl-wave2`, one commit (c22b788), merged `--no-ff` as b56b4b4 and pushed. Suite 820.

| Building | Pinned at | Operator page | Reasoning |
|---|---|---|---|
| td-garden | false | tdgarden.com/venue-info/policies | Rule 1.3, same-size alternative: clear and non-clear bags share one 6in by 4in by 1.5in cap, so clear buys no extra size |
| american-airlines-center | false | americanairlinescenter.com/plan-your-visit/arena-faq | Rule 1.1, stated outright: "Clear purses/bags are permitted but not required", with non-clear purses at the full ceiling |
| ball-arena | null | ballarena.com/plan-your-visit/prohibited-items/ | Rule 1.6, size-only envelope: the page never uses a clarity term at all |
| united-center | null | unitedcenter.com/venue/frequently-asked-questions/ | Rule 1.6, size-only envelope: its only "clear" is about aisles staying clear |

Each entry gains a `source` key, which the drift line now names, so a re-read starts at the right URL instead of a search. Suppression is at the pinned value only, the same behaviour as the little-caesars-arena entry.

Tests cover both directions for all four: suppressed at the pinned value with the summary still counting it, and reported as drift at each of the two other values a boolean-or-null field can take. Nine new tests, guard file 11.

Live re-run over the eight written documents: 5 raw hits, 5 suppressed, 0 drifted, **0 open**.

## Step E: render and recrawl

Production deployment `dpl_8Ua5PNfSCs3JAUqvktbWr9z922vu`, commit 9d2825e, aliased to www.getpromonight.com. All 28 affected paths revalidated at 01:26:47Z before the checks.

### Step D verification (brief item d)

| Check | Result |
|---|---|
| td-garden bag: claim, link, date | "Small bags, clutches, crossbodies and wristlets are permitted." then `tdgarden.com ›` and "Verified Sep 4, 2026" |
| american-airlines-center clear-bag rendered | "do not have to be clear" renders from the stored false |
| american-airlines-center rideshare row | "Rideshare. The operator publishes conflicting answers." No street from either operator page appears anywhere on the page |
| ball-arena transit absent, not an empty row | Zero "Transit." rows. Parking renders normally. None of the held transit text leaks: no lines list, no MallRide, no stop name, no cross street |
| bridgestone-arena clear-bag row | "Clear bag. The operator publishes conflicting answers. bridgestonearena.com ›" |
| held NHL hub title | Madison Square Garden serves "Madison Square Garden | 2026 Gameday Guide" and promises no topic |
| MLB layout control | Fenway Park's visible text differs by exactly four inserted `mlb.com ›` link spans and nothing else |

### Step E checks

| Check | Result |
|---|---|
| /nhl rail lists every newly verified building | All eight present |
| /venues count | 167, up from 163, which is the four buildings that were unverified before this write |
| Ball Arena club page | Hub link present; the venues prose block retires. The diff shows the parking prose, the transit prose, the accessibility line and the neighbourhood paragraph replaced by the hub link |
| crypto-com-arena control | Visible text differs by exactly four inserted `cryptoarena.com ›` link spans. No date, correctly: that document predates the per-field map |
| Gate rows now render | Boston: "Bruins - Member Doors open two hours prior to game time. General doors open one hour prior to game time." Dallas: "Stars - Doors open to the public 90 minutes prior to puck drop." Both with source and date |
| Rail sub-lines are per building | Five distinct variants where there was one template. Ball Arena reads "Bag policy & parking", with no transit, because its transit is held |
| IndexNow | 23 URLs at 01:31:22Z through the site route, which posts to api.indexnow.org and bing.com |

### One defect found by the checks, fixed

The American Airlines Center rideshare row rendered its reason with no link. When rule 1.5 nulls a claim, the field's own source entry is removed with the value, so there was nothing to link. The pointer is exactly what a nulled claim has left, which is why the pipeline guard requires the class pointer before it accepts the state at all. The renderer now falls back to that same pointer, mirroring the guard's own claim-to-pointer map. Fixed on `fix/conflict-row-pointer`, merged as 9e8e53f and pushed, 731 tests.

Budget note: the 12 plain fetches were spent on the checks above. Confirming this fix on production takes one more, which is one over the brief's allowance.

## Budgets

| Budget | Cap | Used |
|---|---|---|
| Verifiers | 1 | 1 (step B) |
| Firecrawl | 0 | 0 |
| Plain fetches | 12 | 12, plus 1 to confirm the conflict-row fix |

