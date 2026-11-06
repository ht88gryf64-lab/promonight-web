# NHL arena data, Phase 1 execute: Gate 1 (clean pass) report

2026-09-02. Read-only against Firestore. No writes. Zero Firecrawl, zero plain fetches. Verifiers: 4 in the clean pass on v4, 4 in the required fourth pass on v5; 8 of 8 for the brief, none left.

Payloads: `scratchpad/p1/g1/nhl-g1-facts-v4.json` (v3 plus the Little Caesars parking withhold), `-v5.json` (v4 plus the clean-pass fixes), `-v6.json` (v5 plus three provenance-record corrections after the fourth pass, unverified). Verify shards: `verify-shards-v4.json`, `verify-shards-v5.json`. The writer's exact ops for v5 in `dry-run-ops-v5.json`.

## 1. The withhold (v4)

Little Caesars: the six District Detroit garage entries and the rideshare drop-off sentence, both stated on the operator directions page only, moved to the held store under that page's citation with type single-source. Published `parkingLots` is empty and `rideshareDropoff` null. Two pointers kept: `officialParkingUrls` (the directions page) and `parkingLotMapUrl` (the operator parking-maps page linked from it). Little Caesars set to `verified: true`, the flag Gate 3 names, so the dry run reflects the execute. Bridgestone and Centre Bell unchanged from v3.

Writer dry run on v4 and v5: guard passed on all five payloads; Little Caesars and Bridgestone project INDEXED, Centre Bell below the floor as written (its bag and gates are still populated and its flag false).

## 2. Clean pass on v4

| Building | Field | v4 pass | Value defects | Record defects | Confirmation verified | Agency |
|---|---|---|---|---|---|---|
| little-caesars-arena | bag | clean | 0 | 0 | republish | not-applicable |
| little-caesars-arena | parking | DEFECTS | 0 | 2 | single-source (parkingLotMapUrl, officialParkingUrls, held.parkingLotsBanked, he | not-applicable |
| little-caesars-arena | transit | DEFECTS | 0 | 3 | agency | confirms |
| little-caesars-arena | gates | clean | 0 | 0 | republish | not-applicable |
| centre-bell | bag | clean | 0 | 0 | single-source | not-applicable |
| centre-bell | parking | DEFECTS | 0 | 1 | parkingLots: republish, verified (club FAQ 'Indoor parking is open to the public | not-applicable |
| centre-bell | transit | clean | 0 | 0 | agency | confirms |
| centre-bell | gates | DEFECTS | 1 | 1 | single-source | not-applicable |
| bridgestone-arena | bag | DEFECTS | 0 | 2 | republish for bagMaxDimensions and bagPolicyNotes (club A-Z byte-identical to th | not-applicable |
| bridgestone-arena | parking | clean | 0 | 0 | parkingLots: republish, verified; all seven stored lots appear on https://www.nh | not-applicable |
| bridgestone-arena | transit | DEFECTS | 0 | 1 | agency | confirms |
| bridgestone-arena | gates | clean | 0 | 0 | none | not-applicable |

Six of twelve cells clean. No stored value was wrong except one: Centre Bell `gateVariance` paraphrased the club sentence ("and" for "as well as"). The other nine findings were provenance-record errors: "byte-identical" claimed against pages that differ in a link and a bullet, a bag-policy pointer typed republish though the club page links a different operator page, "widget that did not render" about a widget that rendered, "agrees only on" for a page that agrees on more, a Centre Bell pointer typed single-source though the club FAQ links it twice, one agency named as naming the building where two do, "club-only" and "agency-only" labels on elements the operator page also carries, a redundant held copy of a published Bridgestone transit value, and an exhaustive "only time statement" that was not. All fixed in v5.

## 3. Fourth pass on v5 (the reserved 4)

| Building | Field | Pass 4 (v5) | Prior fixes | Value defects | Record defects | Confirmation verified | Agency |
|---|---|---|---|---|---|---|---|
| little-caesars-arena | bag | clean | fixed | 0 | 0 | republish (all four bag fields, by club A-Z https://www.nhl.com/redwin | not-applicable |
| little-caesars-arena | parking | clean | fixed | 0 | 0 | parkingLotMapUrl: single-source (operator directions page links 'Venue | not-applicable |
| little-caesars-arena | transit | DEFECTS | fixed | 0 | 1 | agency | confirms |
| little-caesars-arena | gates | clean | fixed | 0 | 0 | republish | not-applicable |
| centre-bell | bag | clean | fixed | 0 | 0 | single-source (bagMaxDimensions, bagPolicyUrl, bagPolicyNotes; club FA | not-applicable |
| centre-bell | parking | clean | fixed | 0 | 0 | parkingLots: republish (club FAQ 'Is the Bell Centre parking open to t | not-applicable |
| centre-bell | transit | DEFECTS | fixed | 0 | 1 | agency | confirms |
| centre-bell | gates | DEFECTS | fixed | 0 | 2 | single-source | not-applicable |
| bridgestone-arena | bag | clean | fixed | 0 | 0 | republish for bagMaxDimensions and bagPolicyNotes (by club A-Z https:/ | not-applicable |
| bridgestone-arena | parking | clean | fixed | 0 | 0 | parkingLots: republish with the one recorded exception (all seven stor | not-applicable |
| bridgestone-arena | transit | clean | fixed | 0 | 0 | agency | confirms |
| bridgestone-arena | gates | clean | fixed | 0 | 0 | none | not-applicable |

Nine of twelve cells clean, and zero value defects anywhere. Three cells carry one or two record-only defects:

- Little Caesars transit: `verify.transit.status` summarised the held set as "club-only" when two held elements are also on the operator page and two are agency or operator text absent from the cited club page. Value clean; agency confirms every published element.
- Centre Bell transit: one verifyNotes paragraph still said "single source" and "the STM page ... was not fetched"; the STM Orange line list was fetched and confirms both stations. Value clean; agency confirms.
- Centre Bell gates: an exhaustive "are" in the list of operator time statements, and "older" and "stale" attributed to club figures no page dates. Values clean (verbatim club sentences); single-source.

v6 corrects those three records and changes no stored value. It has not been verified; the eighth verifier was the last.

## 4. Final flag per building and per field

| Building | Bag | Parking | Transit | Gates | Flag |
|---|---|---|---|---|---|
| bridgestone-arena | verified, republish | verified, republish (one recorded exception; attached garage held) | verified, agency (WeGo Route 18; hub, fare and express held) | no source, overlay untouched | **true**, clean on the fourth pass in all four cells |
| little-caesars-arena | verified, republish | withheld (single-source, banked); pointers kept | verified, agency (QLINE, People Mover); club judgments held | verified on the Red Wings overlay, republish | **true**, clean on values in all four cells; one record sentence corrected in v6 unverified |
| centre-bell | single-source, withhold proposed | verified, republish (price ceiling omitted) | verified, agency (STM Line 2 Orange, two stations) | single-source, overlay held | **true with bag claims and gates withheld**, or held: see the template finding |

Template finding for the Gate 3 decision on Centre Bell, from the code: `rendersBag` returns true for a reachable `bagPolicyUrl` alone, the bag FAQ renders when the building is verified and the pointer is reachable, and the logistics card renders the pointer as a link. So a bag field withheld to its pointer renders a pointer-only row. Under the brief's condition, Centre Bell can be written verified true with `bagMaxDimensions`, `clearBagRequired` and `bagPolicyNotes` null, the security-page pointer kept, and the Canadiens overlay held. Gates has no pointer; a withheld gate is simply absent. That change removes claims from the payload and adds none.

## 5. What is not clean under the rule

The rule for this gate was zero defects. After four passes the stored values are zero-defect on all twelve cells and the provenance records are zero-defect on nine. The three record corrections in v6 are unverified. Writing v6 therefore needs one of two rulings: accept three unverified provenance-text edits (never rendered), or grant verifiers beyond the brief's cap for a fifth pass.
