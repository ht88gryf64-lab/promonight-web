# NHL arena data, wave 2, Gate 1 report: operator rule, re-flags (eight buildings), PPG

Date: 2026-09-03. No new harvest; zero Firecrawl; zero plain fetches. Verifiers: 5 declared, 5 used (4 lens verifiers on the re-flag pass, each looping every re-flagged building and field; 1 on the PPG diff read). A first launch of the re-flag verifiers, made against the four-building scope of the earlier brief, was stopped before any verifier completed when the revised eight-building brief arrived; it consumed no verifier pass. Nothing written to Firestore. Gate 2 waits on authorization.

## 1. The operator rule (promo-pipeline, MERGED to main, not pushed)

Branch `feature/venuehubs-operator-confirmation`, two commits (62c8894 the rule, bde2594 the legacy-doc pin), merged `--no-ff` into main as 48ff035 and 16a9d16 on top of afa04f7. Main is 4 ahead of origin; not pushed (pushing main is your call).

| Brief item | Done |
|---|---|
| a. Guard: exactly independent, republish, operator; operator rejected on transit; operator requires a recorded list of operator pages read (URLs) | yes: `CONFIRMATION_VALUES` is the three words; `operator` on `publicTransit` fails with "a transit fact verifies only on the transit agency's own page"; `operator` outside bag, parking and gates fails; an operator confirmation needs `operatorPagesRead[field]`, a non-empty list of absolute URLs including the field's source URL(s); a pages-read entry on a non-operator field fails |
| b. Writer stores the pages-read list alongside the confirmation entry | yes: `operatorPagesRead` written next to `confirmations` on building and overlay docs (empty map when absent); `--print-ops` prints it |
| c. Checklist item 5 updated | yes: `docs/EXTRACTION-RULES.md` section 2.4 (the three types, the two pointer-only cases) and the pre-extraction checklist, item 5 stating the rule |
| d. Tests | yes: operator accepted on bag and parking fields with pages read; accepted on a tenant gates field; rejected on publicTransit; rejected outside the three classes; missing pages-read list fails; list omitting the source URL fails; non-URL page fails; pages-read on a non-operator field fails; the three words only (agency, single-source, Operator fail); legacy docs without the operatorPagesRead key pass with or without a confirmations map, and an empty map passes. Guard file 38 of 38; full suite 802 of 802 (was 794) |
| e. Dry run against crypto-com-arena and climate-pledge-arena | yes: no projected ops for either; content hashes of both docs and all five overlays identical before and after the `--print-ops` run of the wave-2 write set |
| f. Merge to main | yes, `--no-ff`, twice (rule, then the legacy pin) |

Read-only sweep, beyond the brief: the extended guard was run over every existing verified hub as stored (170 docs, 194 overlays; 4 docs carry the confirmations key, none carry operatorPagesRead). 169 docs and all overlays pass. One doc fails on a PRE-EXISTING defect unrelated to this change: `venueHubs/t-mobile-park.sources` (verified true, updatedAt 2026-07-15) carries two inverted entries where the URL is the key and the page title is the value (`https://www.mlb.com/mariners/ballpark/information/guide` and `.../disability-access-guide`). The URL check that catches it predates this change; the doc would fail the guard on its next write. Reported for the MLB lane; not fixed here.

## 2. Re-flags from existing payloads and the held store (no re-harvest)

Payload: `audit/nhl-wave2/nhl-w2-facts-v2.json` (eight records); write shape `nhl-w2-write-v2.json`; builders `build-w2-v1.cjs`, `build-w2-v2.cjs`, `patch-w2-v2-notes.cjs`. Base records: the wave-1 v3 carry file for ball-arena, american-airlines-center, united-center and ppg-paints-arena (v2 plus the pass-2 record fixes); the wave-1 v2 record for td-garden (its held bag store); the Phase 1 v6 record and written v6 shape for centre-bell, little-caesars-arena and bridgestone-arena.

Guard on the write set: passed on 9 projected ops (8 building docs, 1 overlay). Writer `--print-ops` on main: every building projects INDEXED.

The writer carries no `bagsProhibited` field, so Ball Arena's bagsProhibited true sits in the held store; the prohibition is stated in bagPolicyNotes.

### Per building: proposed flag, fields moved, operator pages read per field, 1.5 nulls

| Building | Proposed flag | Fields moved to operator | Operator pages read per field | 1.5 applied | Unchanged / not written |
|---|---|---|---|---|---|
| td-garden | verified true (already) | bagMaxDimensions 6x4x1.5 in, clearBagRequired false (rule 1.3), bagPolicyNotes: pointer-only becomes rendered claims | bag: policies (statement), know-before-you-go and plan-your-visit (bag image and pointer), directions-parking and transportation (no bag term) | none needed (one statement) | parking republish, transit independent; gates held (GA doors line scoped to certain shows) |
| little-caesars-arena | verified true (already) | parkingLots (six garages: Comerica, McLaren, Tigers, Temple West, Trinity Health, UWM, with their entries and the closest-accessible-parking line), rideshareDropoff | parking and rideshare: directions-parking-1 (statements), A-Z guide (general lines; a VIP entry "from the Little Caesars Arena Garage"), rules-policies and public-transportation (general lines; ride-hailing service names, no location) | none needed (no disagreement) | bag republish, transit independent, Red Wings gate overlay |
| bridgestone-arena | verified true (already) | parkingLots gains "Parking at Bridgestone Arena" (attached, 6th Avenue South and Demonbreun St.) as the first entry; the field is typed operator with the club republish of the other seven recorded | parking: directions-parking (statements), A-Z guide and arena-policies (elevator line naming the 6th Avenue parking garage entrance; a parking pointer block), bag-policy (nav link only) | none needed | bag republish, transit independent |
| centre-bell | verified true (already) | bagMaxDimensions 15x10x4 cm, bagPolicyNotes: pointer-only becomes rendered claims | bag: security and faq (identical forbidden-items block), getting-here (no bag term) | coat check: the security page contradicts itself, not stored | parking republish, transit independent; gates held (club FAQ is the only source) |
| ball-arena | verified true | bagMaxDimensions, bagPolicyNotes, parkingLots (six lots incl. Corolla), rideshareDropoff | bag: prohibited-items and bag-policy (statements), parking-directions and public-transportation (nav link only); parking and rideshare: parking-directions (statements), public-transportation (rideshare sentence verbatim, bicycle racks), bag-policy and prohibited-items (nav link only) | bag check: the two operator pages disagree ("no check-in areas or lockers" against "Bag Check with Binbox Lockers"), not stored | publicTransit HELD, null in the write (RTD rail index lists D and H suspended; no agency station page); bagsProhibited in held |
| american-airlines-center | verified true | bagMaxDimensions 14x14x6 in, bagPolicyNotes (the building-level Bag Policy block, nothing more), parkingLots, rideshareDropoff | bag: fan-safety-guidelines (statements; the sized wristlet sentence sits under the Mavericks Covid-19 protocols accordion and is held under that scope, rule 1.7), parking, public-transportation, directions (no bag term); parking: parking and fan-safety-guidelines (statements; agree on cards-only and pre-purchase), directions (Platinum pass route note), public-transportation (nav link only) | none (the two bag blocks do not disagree; baseline stored per 1.7) | publicTransit independent (DART) |
| united-center | verified true | bagPolicyNotes, parkingLots, rideshareDropoff; chicago-blackhawks overlay gatesOpen 90 minutes ("Doors for Chicago Bulls and Chicago Blackhawks games open 90 minutes prior to the event start time ...") | bag: FAQ (statements, twice), directions-parking, root, RF guidelines (no bag term); parking and rideshare: directions-parking and FAQ (statements; agree on 2.5 hours and on the Uber Zone at Madison and Wood), root and RF guidelines (nav link only); gates: FAQ (two statements, agree at 90 minutes), directions-parking (lot and Uber Zone times only), root, RF guidelines | none | publicTransit republish (the operator copies the CTA page; the CTA page is not the cited source); bagMaxDimensions null (unitless figure); chicago-bulls overlay not written |
| ppg-paints-arena | verified true | none re-flagged; v3 carried (rideshareDropoff independent added, two labels corrected) | n/a | n/a | bag pointer-only (held single-source, not in this wave's re-flag list) |

### Verify pass (4 lenses: values, pages-and-agreement, records, checklist-and-write-shape)

Result file: `audit/nhl-wave2/gate1-verify-result.json`. Every lens looped every re-flagged building and field (23 cells; the pages lens scoped 20, dropping the three unchanged transit cells).

| Lens | Cells | Clean | Not clean |
|---|---|---|---|
| values | 23 | 22 | ball-arena rideshareDropoff: the stored sentence drops the page's closing "ONLY!" qualifier (the location, streets and lot name are carried by both operator pages) |
| pages-and-agreement | 20 | 17 | centre-bell bagMaxDimensions and bagPolicyNotes: stale Phase 1 per-field entries in confirmationsFull still typed single-source beside the operator typing; bridgestone-arena parkingLots: verify status says the directions page "lists eight lots" when it lists ten (eight stored, two named as operator-only elsewhere in the record) |
| records | 23 | 18 | ball-arena bagPolicyNotes: the held store banked bagsProhibited, a duplicate of the prohibition published in bagPolicyNotes (checklist 7); united-center Blackhawks gatesOpen: the wave-1 GATES sentence still said "held" in the present tense; centre-bell (the same stale entries, plus the heading "LIST OF FORBIDDEN ITEMS" attributed to both pages when only the security page carries it); bridgestone-arena (the "each carried on two domains" wave-1 sentence contradicts the operator-only attached garage; a parking pointer block attributed to arena-policies sits on the A-Z guide only) |
| checklist-and-write-shape | 23 | 19 | the same four record items (ball-arena held duplicate, centre-bell stale entries, bridgestone lot count); write shape identical to the full record on every building; no banked text in any published field; pointer-only and held fields all carry their reason |

Every operator-rule check passed on every cell: the pages listed in operatorPagesRead cover every harvested operator page that mentions the field, each includes the source URL, the agreement or rule 1.5 statements held on every cell, no operator confirmation sits on transit, and ball-arena's transit is null in the write with the RTD contradiction recorded.

Fully clean on all four lenses: td-garden (3 cells), american-airlines-center (5 cells), little-caesars-arena (2 cells), and the united-center bag, parking and rideshare cells. One value defect in the whole pass (one dropped word, the page's own); every other finding is a record sentence.

Caveat from the pages lens, applied as a note rather than a defect because the rule was checked against harvested pages: four operator sites expose unharvested pages that plausibly mention a re-flagged field (united-center /venue/uber-zone/, the TD Garden A-Z guide, the American Airlines Center arena FAQ, the Little Caesars parking-maps page). "Every operator page that mentions the field" was satisfied over the harvest, not over the site. Closing it costs four Firecrawl fetches in wave 3; whether Gate 2 writes those four buildings on the harvested-set reading is your call.

### v3: the fixes applied after the pass (no verifier has re-read them)

The brief allows one pass, so the fixes are applied as v3 (`audit/nhl-wave2/nhl-w2-facts-v3.json`, write shape `nhl-w2-write-v3.json`, list in `v2-to-v3-changes.txt`) and reported, not re-verified:

- ball-arena rideshareDropoff: "only" appended, the page's word (the only change to any written value between v2 and v3, confirmed by a flat diff of the two write shapes); held.bagsProhibited removed as a duplicate.
- united-center: the wave-1 GATES sentence now states the overlay is published.
- centre-bell: the two stale per-field entries now read operator with the Phase 1 reading kept as a note; the heading attributed to the security page only.
- bridgestone-arena: ten lots on the page, eight stored, two operator-only named; the two-domains sentence and the pointer-block attribution corrected.
- ppg-paints-arena: the one label string the wave-1 relabel missed now says the nickname is on the operator and club pages; the held key renamed to what it holds.

Guard on the v3 write set: passed on 9 projected ops; writer dry run on main: guard passed, every building INDEXED.

## 3. PPG Paints v3 diff read (1 verifier)

Eleven cells: nine clean. Every v2-to-v3 difference falls inside the expected set (the rideshare zone leaving the club-only held text, the nickname relabel, the new rideshareDropoff with its source and independent confirmation by the Penguins page, the record sentences, the revision); nothing else changed; every changed value and sentence is carried by its cited page; no operator confirmation is used. One defect: `verify.transit.status` still carried the wave-1 label "nickname ... held as operator-only", contradicting v3's own confirmationsFull and the Penguins page ("U.S. Steel Plaza T Station"). So v3 was NOT verified end to end as delivered; the one string is corrected in the wave-2 v3 record (above) without a verifier re-read.

## 4. Proposed flags for all eight

| Building | Proposed flag | Pass state | Post-pass fixes (unverified) |
|---|---|---|---|
| td-garden | verified true; bag rendered (operator) | clean on every lens | none |
| american-airlines-center | verified true | clean on every lens | none |
| little-caesars-arena | verified true; six garages and rideshare rendered (operator) | clean on every lens | none |
| united-center | verified true; Blackhawks gate overlay (operator) | values, pages, checklist clean; one record sentence | record only |
| ball-arena | verified true (bag and parking operator; transit held) | one dropped word in rideshareDropoff; one held duplicate | one word restored; duplicate removed |
| centre-bell | verified true; bag rendered (operator) | stale per-field record entries; one heading attribution | record only |
| bridgestone-arena | verified true; attached garage rendered (parkingLots operator) | three record sentences | record only |
| ppg-paints-arena | verified true (v3) | one stale record string | record only |

Recommendation for Gate 2: write all eight. Every published value was clean on the values lens except one word, and that word is now the page's own. If you want the four record-only buildings and ball-arena held to a verifier re-read instead, that is one verifier in wave 3 and the write set shrinks to td-garden, american-airlines-center and little-caesars-arena.

## 5. Notes for Gate 2 (design points the brief needs a ruling on)

- Per-claim "verified [date] from the field's stored timestamp": the doc carries one `verifiedAt` (doc level). Rendering a per-field date needs either a per-field timestamp map written by the extended writer (for example `verifiedAtByField`) and guarded, or the doc-level `verifiedAt` shown on every claim. Recommend the doc-level date this wave, since every re-flagged field is written in one batch, and a per-field map from wave 3.
- Pointer-only reason text ("the operator publishes conflicting answers" or "no official policy page found"): nothing stored says which case applies. Recommend a per-field `pointerReason` map (values `conflict`, `no-page`) written by the extended writer and guarded to those two words, with the web reading it; until then the two pointer-only rows in this wave's set (ball-arena transit is held not pointer; Bridgestone clear-bag row is the 1.5 case; PPG bag is a single-page case that the operator rule would clear in a later wave) need hand-assigned reasons.
- Bridgestone clear-bag row: the brief expects it pointer-only with the disagreement reason; the operator's two readings (Reading A tiered clear bags, Reading B "CLEAR 12 x 12 bags will be permitted") are recorded in the Phase 1 record; clearBagRequired is null on the doc, which the web renders as the pointer row.

## 6. Budgets

| Budget | Cap | Used |
|---|---|---|
| Verifiers | 5 | 5 (a stopped first launch completed none) |
| Firecrawl | 0 | 0 |
| Plain fetches | 12 (Gate 2 renders) | 0 |
