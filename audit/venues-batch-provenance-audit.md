# The plan-your-visit batch: provenance, defect rate, and what derives from what

Read-only. 2026-08-29. No Firestore writes, no copy changed.

Commissioned after `venues/bank-of-america-stadium` was found asserting a "Bank
of America Stadium Station" that appears on no CATS roster. That sentence came
from a generated batch, and a fabricated fact in a provenance-free batch is a
batch signal, not a one-off.

## 1. What the batch is

**85 venue docs across 8 seed files and 3 writer scripts. None records provenance.**

| Seed file | Docs |
|---|---|
| `arena-plan-your-visit-batch1/2/3.json` | 4 + 4 + 4 |
| `arena-plan-your-visit-mls-east.json` | 10 |
| `arena-plan-your-visit-mls-west.json` | 14 |
| `arena-plan-your-visit-mls-nfl-shared.json` | 5 |
| `arena-plan-your-visit-wnba.json` | 5 |
| `wnba-gameday-venues.json` | 10 |
| `mlb-plan-your-visit.json` | 29 |

Fields written: `gatesOpen` (47 docs), `parkingInfo` (56), `publicTransit` (56),
`accessibility` (85), `bagPolicyUrl` (56), `nearby` (85).

Writers: `populate-arena-plan-your-visit.ts`, `populate-plan-your-visit.ts`,
`populate-wnba-gameday-venues.ts`. All three write `venues/{slug}.set(payload,
{merge: true})` and **set no `sources` map, no verifier, no date**. The only
populator in the repo that records provenance is `populate-cfb-venue-data.ts`,
which writes to `venueHubs`.

**The batch knew about the fabrication and relied on it.** `_notes` in the
mls-nfl-shared file reads: *"These five buildings OMIT gatesOpen because MLS
uses the same venue-doc fallback pattern ... (VenueInfoBlock supplies per-sport
gate cadence)."* The generator deliberately left a field empty because a
hardcoded league sentence would cover it. That sentence was removed on
2026-08-29, which is why those pages now show no gate row.

## 2. Defect rate

20 docs sampled, stratified across all 8 seed files, verified against transit
operators (GTFS feeds where obtainable, operator route pages otherwise).
`bank-of-america-stadium` was included as a **blind control**; the verifier was
not told it was known-bad. It was caught, leading with *"FABRICATED STATION
(never existed, not a rename)."*

**Integrity check: all 20 batch strings are byte-identical to live Firestore
today, so this rate describes what is being served, not a stale seed file.**

| Field | Result |
|---|---|
| `publicTransit` | **16 of 20 defective. 80% including the control, 78.9% excluding it.** 4 clean. |
| `gatesOpen` | 17 claims made: 9 true, **5 false**, 3 unverifiable. **47% not confirmed.** |
| `bagPolicyUrl` | See the correction in section 2a. The figure first recorded here, 7 hard 404s, was measured against the seed file and never described production. |

Removing the control moves the transit rate by 1.1 points. The control was not
carrying the number.

## 2a. CORRECTION, 2026-08-29: the bag-URL figure tested the wrong thing

**The "7 hard 404s" originally recorded above was measured against the SEED
FILE, not against production, and it never described what the site serves.**
Recorded here because this document will be cited later and the wrong number
must not travel with it.

What is actually true of the live corpus:

- **Every live stored `bagPolicyUrl` returns 200.** There are no unreachable bag
  links. Checked with a browser user-agent, following redirects.
- The seed values in `scripts/arena-plan-your-visit-*.json` differ from the live
  Firestore values, and `populate-arena-plan-your-visit.ts` says so in its own
  header: "Curl-verified dead links replaced with live official pages." The dead
  links were repaired after seeding. The sample read the seed.
- **The real defect is narrower and different in kind:** seven URLs resolve onto
  a hub or landing page carrying no bag policy at all. A dead end, not a broken
  link. Those seven are repointed in code at the page the operator publishes,
  each fetched and confirmed to carry bag-policy text: bmo-field, geodis-park,
  allianz-field, bc-place, bank-of-america-stadium, american-family-field,
  busch-stadium.
- `amalie-arena` is left alone: reachable, its own domain does not resolve, and
  the operator's pages are client-rendered, so there is no confident target.

**The cause, which is worth more than the correction.** A drift check WAS run
before the sampling pass and returned 20 of 20 byte-identical. It compared
**`publicTransit` only.** Every other field in the same records went unchecked,
and `bagPolicyUrl` had in fact drifted. A spot check that covers one field and
is reported as though it covered the record is worse than no spot check, because
it converts an unknown into a false assurance. **A drift check must compare
every field the pass will draw a conclusion about.**

This does not disturb the transit or gate-time findings: those were compared
field-for-field and were byte-identical, which is why 78.9% stands.

## 3. Generated, not stale, and the distinction decides the remedy

**At least 11 of the 16 defective docs assert something that was never true on
any date.** A re-verification cadence fixes staleness. It cannot fix a corpus
whose facts have no source to refresh against.

| Doc | The fabrication | Why staleness cannot explain it |
|---|---|---|
| bank-of-america-stadium | "Bank of America Stadium Station" | Absent from CATS's 26-station roster; the track never comes within 0.71 km |
| america-first-field | "Draper Town Center Line", "Lehi to Downtown/Airport Line" | UTA names TRAX lines by colour only; the second welds a FrontRunner stop to the Green Line's airport terminus |
| centre-bell | STM route 178 | An unassigned number, a clean gap between 177 and 179 |
| amalie-arena | "route 30 stopping in front" | Route 30 is the Kennedy Blvd airport route and never touches Channelside Dr |
| ball-arena | D and H lines serve the arena | Both terminate on the Downtown Loop, never the Platte Valley spur. Wrong when written, and only later also suspended |
| gillette-stadium | "Providence/Stoughton Line stops at Foxboro" | Foxboro has only ever been Franklin/Foxboro plus event service |
| audi-field | Waterfront "one stop south" | 2 m of latitude and 1.0 km due west |
| geodis-park | stadium is in The Nations | The venue's own site says Wedgewood-Houston, 4.7 mi away |
| entertainment-sports-arena | "Lyft is the arena's rideshare partner" | Events DC names no partner; the Mystics page runs a "Take An Uber" section |
| Angel Stadium | "Home Plate gate opens 2 hours before" | The club states the 60-minute start is "the only exception", and it runs the other way |
| lenovo-center | doors "earlier for big giveaway nights" | No support on any operator page |

Four structural tells that decay cannot produce:

- **List-padding around a correct core.** Six unrelated venues show one shape: real station, real primary line, plus a fabricated companion. ball-arena (E/W correct, D/H added), bc-place (Expo correct, Millennium added), gillette (Foxboro correct, Providence/Stoughton added), barclays (7 of 9 trains correct, 5 and B added), centre-bell (61/150/36 correct, 178 and 107 added), amalie (19 correct, 30 added). Independent documents do not decay into the same shape.
- **"90 minutes" is a prior, not a fact.** Asserted in 11 docs. Where checkable: 4 true, 4 false, 3 unverifiable. Where the operator publishes a number that is not 90, the doc still says 90.
- **Errors track salience, not locality.** Foxboro gets the famous Providence Line instead of the line literally named Franklin/**Foxboro**. Charlotte gets a station named after the stadium. Utah gets lines named after termini, the convention most US systems use, instead of UTA's colours.
- **Error direction is one-way.** Adjacency is always inflated, never understated: "directly adjacent" at 612 m, "across the lot" for a 0.3 mi walk across a state route, "directly adjacent" for a quarter mile. And three docs assert transit ABSENCE that is false, including geodis-park, where WeGo runs a fare-free bus to every regular-season home match.

Confabulation is twice caught in the act. `audi-field`: the venue page says
"Navy Yard Station is one stop on the Green Line from the **Anacostia**
Metrorail Station"; "one stop" was lifted off Anacostia, reattached to
Waterfront, and "south" invented to make it read. `entertainment-sports-arena`
paraphrases the Mystics game-day page **including that page's own stale phone
number**, then adds a Lyft partnership present on neither source.

## 4. Second-order: fields that derive from other fields

A fabricated primitive propagates. **19 field-instances derive from
`publicTransit`** by naming an entity that only the transit sentence introduces,
or by using a stop-count that only the transit claim makes meaningful.

The commissioning case: `bank-of-america-stadium.nearby` says the South End
neighbourhood is **"two to three stops south"** — counted from the station that
does not exist. Silencing `publicTransit` alone leaves that sentence standing.

Full list, by dependency type:

- **Stop-count phrasing** (meaningless without the transit claim): `bank-of-america-stadium.nearby` ("two to three stops south"), `entertainment-sports-arena.nearby` ("three stops north"), `Citi Field.nearby` ("one stop east on the 7").
- **Shared entity** (the derived field reuses a name the transit sentence introduced): `rocket-arena.gatesOpen` (Tower City), `madison-square-garden.parkingInfo` (Penn Station), `enterprise-center.nearby` (Union Station), `red-bull-arena.nearby` + `.parkingInfo` (Harrison), `inter-co-stadium.nearby` + `.parkingInfo` (Church Street), `bmo-field.nearby` + `.parkingInfo` (Exhibition), `bank-of-america-stadium.accessibility` + `.parkingInfo`, `gillette-stadium.nearby` + `.parkingInfo` (Foxboro), `q2-stadium.nearby` (McKalla), `dignity-health-sports-park.parkingInfo` (Avalon), `allianz-field.parkingInfo` (Snelling Avenue).

Most shared-entity cases are benign (a neighbourhood name is true independently
of the transit claim). The three stop-count cases are not: they inherit the
defect directly.

## 5. Other provenance-free batch writers

Same class, previously unlooked at. Every script in `scripts/` that writes to
`venues` or `venueHubs`:

| Script | Collection | Writes claims? | Provenance |
|---|---|---|---|
| `populate-arena-plan-your-visit.ts` | venues | yes, 46 docs | **none** |
| `populate-plan-your-visit.ts` | venues | yes, 29 docs | **none** |
| `populate-wnba-gameday-venues.ts` | venues | yes, 10 docs | **none** (verified at write time, but nothing stored) |
| `backfill-nfl-venues.ts` | venues | no, structural only | n/a |
| `populate-arena-venue-fixes.ts` | venues | no, "NOT copy" by its own header | n/a |
| `remove-seatgeek-pyv-prose.ts` | venues | removal only | n/a |
| `populate-cfb-venue-data.ts` | venueHubs | yes | **records sources per field** |

The `probe-*` scripts matched a naive write-grep on `.set(` over JavaScript
Sets; all four are read-only, confirmed at zero Firestore write calls.

## 6. The honest note about the fix that preceded this

The 2026-08-29 pass removed a fabricated gate sentence and made the FAQ publish
`venues.gatesOpen` verbatim instead. That was the right direction: a stored
value beats an invented one. But this audit shows **47% of the stored gate
claims are themselves unconfirmed, and 5 of 17 are false.** Removing the
fabrication did not make the page true; it promoted an unverified corpus into
the space the fabrication occupied. Both facts belong in the same sentence.

## 7. Recommendation, for a decision not taken here

The adversarial critic's recommendation, recorded because it is well evidenced
and because the decision is not mine:

> **Silence `publicTransit` and `gatesOpen` from the `venues` collection
> site-wide**, at the render layer, rather than editing 15 of 19 docs. Nothing
> in the record distinguishes a true doc from a false one without re-verifying
> it, which is the argument against a named subset. Of the four "clean" docs,
> one is genuinely clean (`bmo-field`), one is defective by its own evidence
> (`Busch Stadium`), one is clean only on an inconsistent grading call
> (`lenovo-center`), and one is clean because it asserts nothing falsifiable
> (`American Family Field`).
>
> **Do not silence `bagPolicyUrl`** — different failure mode, cheap per-doc fix.
> 7 hard 404s and 3 dead-end 200s, with live replacements already identified.
> `barclays-center`'s 406 is a WAF artifact, isolated by a control path.
>
> **Then rebuild, do not repair.** Re-enable per field, per venue, only where a
> fact carries a live-verified operator source URL, using the pointer-vs-claim
> gating already shipped for venueHubs.

One calibration caveat on the data above: the verifier used `partly-false` for
everything from a fabricated station to a 7-minute travel-time overstatement,
and never used `false` in 20 records. **Do not triage on the verdict label**;
severity lives in the per-doc findings.

## 8. Claims on a clock

Separate shape from stale transit, and nothing watches it: neither corpus has a
field that can carry an expiry or a review date.

**340 strings across 134 docs carry a dated, promotional, priced or
season-scoped claim** (venues 46, venueHubs 294).

- **23 name a year of 2025 or earlier while reading in the present tense.** About 19 are genuinely rotting: `allegacy-federal-credit-union-stadium.parkingLots` ("Not available for the 2025 season"), `brooks-stadium.tailgating` ×2 ("per 2020 gameday guide"), `chase-center.parkingLots` ×3 ("Mar 2024 event-day guide", "Jan 2022 TOOL event-day guide"), `dignity-health-sports-park.parkingLots` ("sold out for the 2025 season"), `kidd-brewer-stadium.tailgating` ("For the Nov. 6, 2025 game against Georgia Southern"), `milan-puskar-stadium.parkingLots` ("sold out for the 2025 Utah game"), `yulman-stadium.tailgating` ("the only tailgating location for the 2025 season"), `providence-park.bagPolicyNotes` (2016), `simmons-bank-liberty-stadium.bagPolicyNotes` (2024), `albertsons-stadium.tailgating` (2023), `sanford-stadium.accessibility` (2021), `scott-stadium.tailgating` (2025), `paycor-stadium.publicTransit` (2025), `camp-randall-stadium.publicTransit` (2023). The remaining 4 are benign historical facts ("free to ride since 2018", "renovated 2019", "opened in 2022") and one address mis-parse ("2019 Market Street").
- **19 name 2026 or later and will expire on their own terms**, with no mechanism to notice. Sharpest: `crypto-com-arena.publicTransit` (a bus detour scoped "August 5 to November 5, 2026"), `venues/citi-field.publicTransit` ("New for 2026, LIRR day passes are $5 off"), `michie-stadium.bagPolicyNotes` ("Beginning September 5, 2026"), `cotton-bowl-stadium.nearby` (a specific 2026 game date inside the State Fair window).
- **1 promo code with a hard expiry**: `venues/coca-cola-coliseum.publicTransit`, "up to 15 percent off select home games with code PRESTOTEMPO". PRESTO's own terms end the offer **2026-09-20**. It renders on the Toronto Tempo team page and the corpus cannot hold that date.
- **2 more percent-off claims**: `audi-field.parkingInfo` and `target-center.parkingInfo`, both "up to 50 percent off drive-up" via a third party.
- **305 price claims across 121 docs** (fares, parking rates, passes). These rot slowly and are the least urgent, but they are the largest single population and none carries a date.

## 9. TTC 509/511: contested, deliberately unresolved

Recorded so the next person does not re-derive it. Two of this project's own
2026-08-29 verification passes disagree about whether TTC 509 and 511 currently
run as **streetcars** or as **buses** to Exhibition Loop:

- **Pass A** (rename re-verification): the replacement-bus era ended, so Toronto records describing restored streetcar service are correct. Evidence: TTC GTFS `routes.txt`, `route_type=0` for both.
- **Pass B** (venues-corpus verification): TTC's own `routedetail` API showed both operating as buses end to end to Exhibition Loop, with the bus badge on each.

GTFS describes the scheduled route; the live API describes what is running
today, and a long-running shuttle substitution would produce exactly this split.
Neither pass checked mode against an operator *statement*. Per the standing rule
a contested value with no confident source is dropped rather than picked, so
`bmo-field` stands suppressed on its own separate evidence and the mode question
is left open. **Settle it with a dated TTC service-change notice, not another
GTFS read.** The same note is recorded at the point of use, on the `bmo-field`
entry in `src/lib/venue-transit-suppression.ts`.
