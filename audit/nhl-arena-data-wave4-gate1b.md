# NHL arena data, wave 4 Gate 1b: verify half. Reported 2026-09-04.

STATUS: NO BUILDING IS CLEAN AT PASS 2. Nothing was written, nothing merged.
Two passes of four verifiers each ran as briefed. Pass 1 found 42 defects, a repair
pass closed them with 59 repair records, and pass 2 found 23 remaining plus 8 that
the repair pass itself introduced.

NO FURTHER REPAIR WAS APPLIED AFTER PASS 2. Every one of the 8 new defects was
created by a repair that no pass then verified. Repairing again after the last pass
would repeat exactly that, so the payload is left as pass 2 found it and the fixes
belong at the start of the next gate where a pass can check them.

## 1. THE FINDING THAT OUTRANKS THE REST

The write set strips confirmationsFull, held and verify. Of the record keys only
verifyNotes survives a write. So harvestGaps, section10Note, the cached-fetch
provenance relabel, bagCheckPriceDisputed and completenessGaps reach no stored
document, and all five buildings would ship verified:true with rendered states and
no qualification attached. The repair pass answered most of pass 1 in three places
that do not ship. The audit record and the stored record are different artifacts and
only one of them is the product.

33 of the 51 completeness gaps sit in fieldStates, which does ship. The rest do not.

## 2. THE CACHE DEFECT, AND ITS BLAST RADIUS

All three of this gate's re-fetches returned bytes identical to captures taken 11.5
hours earlier (SHA1 c863f2377e62, c4f173b7c01a, 93dcc46e4035), and so did all 12
shared URLs in what was billed as a full cold re-fetch. The WMATA page is a live
arrivals board carrying "Updated:8seconds ago". lib/extract/firecrawl-fetch.js set
no maxAge, so Firecrawl served its cache. The scrape budget was spent and counted.

WHAT SURVIVES: the cold re-derive as an ISOLATION test. The derivers read the
harvest with no wave 3 conclusion, so the 15 defects they exposed are real defects
in reading the same bytes, and Gate 1a's conclusion stands.
WHAT DOES NOT: any claim of re-observation at source on 2026-09-04.

FIXED AT ROOT: maxAge threads through to the request body, default undefined, and a
verification fetch passes 0. Pinned by a test. Branch fix/firecrawl-maxage (4afd102),
NOT merged. The harvester takes FC_MAXAGE=0.

NOT REACHED BY THE RELABEL: scotiabank getting-here was a FIRST fetch, so no byte
comparison is possible and its age is unmeasured rather than clean.

SEPARATE, AND WORTH KNOWING: the full pipeline test suite is non-deterministic on
this checkout. Two consecutive baseline runs with no code change returned 571 pass /
6 fail, then 707 pass / 8 fail. Different test totals. Full-suite counts cannot judge
a patch today. test/firecrawl-fetch is 13/13.

## 3. THE COMPLETENESS LENS, THE BRIEF'S OWN ADDITION, PAID FOR ITSELF

115 cells checked, 51 silently absent, 22 supported by operator text already in the
harvest, 3 more are harvest gaps on a named linked page.
- bagsProhibited is named NOWHERE on any of the five, while delta, scotiabank and
  capital-one each publish an explicit bag ban. Delta's sentence is quoted inside the
  payload's own confirmationsFull.bag.findings and stored in bagPolicyNotes.
- capital-one venueAccessRestrictions is an UNRECORDED RULE 1.5 no pass had raised:
  arena-faqs L243 "Gallery Place entrance only" against L428 "once the event begins
  at our F St. entrance only". Same page, same question, both say "only".
- wells-fargo accessibility has a DEDICATED captured page, already cited for parking.
These 22 were RECORDED and DEFERRED, not extracted. Transcribing 22 unverified values
between passes is the single-actor move the programme forbids. Wave 5 scope.

## 4. DEFECTS THE REPAIR PASS INTRODUCED (all mine, all caught by pass 2)

N1 verify.<class>.status: I stamped verified-operator on all EIGHT slots on
   wells-fargo and capital-one. My tokeniser tested for the substring "operator",
   which appears in every sentence including "no operator door time published" and
   "agency confirms ... the operator's rename". Five of eight are wrong, and two are
   SECTION 10 HARD FAILURES: verify.transit.status now reads verified-operator on
   both buildings, contradicting their own confirmations maps, which correctly say
   independent. Two negatives and one hold are now recorded as verified operator
   confirmations.
N2 verifyNotes corruption from blind string deletion. Removing the literal
   "tailgating" and "rideshareDropoff" produced false assertions in the ONE record
   key that ships: "STATES and agrees on the maps and theand vehicle-clearance
   paragraphs", "STATES and agrees on illegal parking, circulation and;", "the Food
   & Beverage page, theprocedures PDF" (a document that does not exist), "HELD, and
   why:," and "these five cannot be typed" against four named items. The first two
   now UNDERSTATE what pages carry, which is the inverse of the silent-page defect
   this programme has hit three times.
N3 capital-one fieldStates.parkingLots "no-operator-page" contradicts harvestGaps in
   the same object, which calls that exact negative UNPROVEN. I closed C3-5 by
   asserting the thing C3-2 said could not be asserted. The state ships; the
   qualification does not.
N4 lenovo held.prohibitedItems: the restored bullet went to the END instead of slot
   8, with raw markdown "\n- " inside a stored value. That is the class that shipped
   twelve literal asterisks to a live page under rule 4.1.

## 5. THE D2 INVERSION, THE WORST OF MINE

w4-r033 silently reverted D2, which was adjudicated WAVE 3 RIGHT, back to the cold
reading and stripped a legal two-URL citation. It never names D2. A rendered
fan-facing fact stopped publishing: accessible parking in the Park Place lot.
Both legs of my reasoning were wrong, and I verified that myself:
- Pass 1's D-P1-2 said the value and the two-URL citation were FINE and the NOTE was
  wrong. I fixed the value to match the note instead of the note to match the value.
- My "two different locations" premise fails: FAQ L79 names "the Park Place parking
  lot located to the northeast of Delta Center on South Temple" and the parking page
  gives that same lot's street address. One lot, two descriptors.
- 2.5.2 says rule 2.2 "has never required exactly one" URL.
THE TWO PASS 2 LENSES DISAGREED HERE AND BOTH WERE PARTLY RIGHT. The value verifier
found the v1 PUBLISHED text had DRIFTED ("in this lot") while my held copy is
byte-exact to the page. So the resolution is neither of the two: publish the
byte-exact sentence, keep both URLs, fix the note, drop the duplicate sub-key.

## 6. LEDGER RECONCILIATION: 28 of 32 HOLD

DO NOT HOLD: D2 (section 5), D7, L11, L2.
D7, L11 and L2 all read "carried unchanged" in the ledger while repairs moved them.
In each case THE REVERSAL IS CORRECT AND THE ADJUDICATION IS NOT: pointers are in
BUILDING_POINTER_FIELDS, never in OPERATOR_ELIGIBLE_FIELDS, so the guard rejects the
cold-read-right ruling on D7 and L11 outright. What cannot stand is the ledger
recording the outcome as agreement.

SEVEN BASES THE EVIDENCE CONTRADICTS: D4, D6, D7, L6, L7, L11, L14.
All four value-materiality "both-defensible, no stored fact turns on it" entries FAIL
that test. Each cold reading carries stored facts the wave 3 reading lacks: a UTA
station address (350 W. South Temple), a prohibited-items sentence, six supported
rideshare facts, four bag-policy carve-outs. The payload took the superset every
time so nothing was lost, but the classification was wrong.

L14's PREMISE IS FALSE IN CODE. The brief said cold prose in verify slots "would fail
the guard". The guard NEVER INSPECTS verify: URL fitness covers only
SCALAR_URL_FIELDS, ARRAY_URL_FIELDS and sources. EXTRACTION-RULES 2.5 L148, which I
wrote, makes the same false claim. The 2.5.3 fix was right; its stated enforcement
does not exist. Pass 1 raised this as C3-7 and no repair addressed it.

WHERE A PASS 2 LENS WAS WRONG, verified against the captures: it called lenovo's
stored "Drivers should NOT turn into any gate or parking lot" a defect. Both wordings
exist on different pages (/transportation L87 "Drop-offs", /parking-faq L127
"Drivers") and parking-faq is cited in that field's sources. Not a defect.

## 7. THE TWO 1.5 CANDIDATES I RAISED, RULED BY PASS 2

lenovo /directions vs /parking-guide road approach: NOT a 1.5. One page is silent on
Blue Ridge Road, and silence is rule 1.1, not conflict. Nothing to null.
lenovo overnight parking: NOT a 1.5. The FAQ answer sits under a question scoping it
to RV overnight parking; the 8AM line is a removal deadline for the permitted-to-stay
exception. They agree in value and differ in scope. The real issue is presentational:
both render in one field, only one carries its scope.
Both still ship as unadjudicated candidates inside a write:true payload, which is
itself a record defect.

## 8. PER BUILDING

delta-center   values sound. nearby declared held with no fieldStates and no held
               entry. Record residue in verifyNotes (N2).
lenovo-center  values sound after the repair; the 8AM footnote is now on the clause
               the asterisk marks. Blocked by N2 and N4, by a readings record that
               credits /plan-your-visit/faqs with a First Aid sentence it does not
               contain, and by /policies sitting in pagesRead with no finding.
scotiabank     Every stored value verifies verbatim, including the parking flip that
               motivated the wave. THE SHIPPING verifyNotes SAYS "parking is NOT
               established" and "left with no value, no source and no state" in a
               document that stores two lots and fieldStates rendered. No harvestGaps
               record, though an accessibility page is linked from all six captures.
               Values writable, record not.
wells-fargo    All values verify. Blocked by the section 10 hard failure (N1), the
               inverted gates token, and a transit value whose own note says it needs
               a re-read that this harvest cannot supply.
capital-one    Furthest from clean. Three wrong verify tokens, N3, the unrecorded 1.5
               of section 3, and a harvestGaps record that calls the Security Policy
               "linked" when arena-faqs L200 is PLAIN PROSE with no href anywhere.

## 10. THE REPAIR AUDIT: 25 OF 59 RECORDS PROBLEMATIC

4 FALSE, 9 BROKE-SOMETHING, 12 OVERSTATED. 34 sound. The lens found one thing the
other three missed, and it is the sharpest finding of the gate.

THE FRESHNESS LIE SHIPS AND THE HONEST LABEL DOES NOT. I verified this directly.
All 7 write ops in dry-run-ops-v2.json carry verifiedAtByField stamped
2026-09-04T14:10:54Z on every claim field of all five buildings, generated by the
WRITER at write time. That includes wells-fargo and capital-one, whose only
2026-09-04 activity was the cached re-read that observed nothing. The relabel saying
so sits in confirmationsFull, which the write strips. And check-repairs contains ZERO
references to the write payload, so this entire class is structurally invisible to
it. C3-1 named this artifact exactly and no repair record touches it. C3-1 IS NOT
CLOSED.

FOUR RECORDS ARE FICTION, and this matters more than it looks: check-repairs uses a
record's declared paths to absolve changed paths, so a record of a change that never
happened WIDENS THE COVERAGE SHIELD.
 r003 its restored Park Place sentence and two-URL citation are not in v2; r033 undid
   them and neither record says so.
 r014 its declared verify.*.note slots do not exist on scotiabank; the base sentences
   were destroyed, not moved.
 r023 its object-shaped building.tailgating is not in v2; r026 nulled it.
 r025 its `before` never existed on scotiabank in base, v1 or v2.

TWO 1.5 CANDIDATES ARE PUBLISHING THEIR DISPUTED READING.
 r039 parkingLots[0] now publishes "removed by 8AM the following day" while
   parkingLots[3] publishes "There is NO overnight parking", and r044 in the same
   payload records that pair as unadjudicated. 1.5 says leave it null, not publish
   both. The transcription itself is character-exact.
 r008 publishes "exit Edwards Mill Road or Blue Ridge Road" while r044 records
   /directions as saying only "exit Edwards Mill Road" and calls it unresolved.

FOUR PASS 1 DEFECTS HAVE NO REPAIR RECORD AT ALL: C3-7, C-P1-0, D-P1-7, L-P1-12.

OTHER CORRECTIONS TO MY OWN WORK, from this lens:
 - r045 replaced one wrong reason with another. The Hurricanes page states 60 minutes
   Monday to Friday and 90 Saturday and Sunday, so the operator's one hour AGREES
   with the weekday time.
 - r004 held.parkingGeneral is a constructed paragraph: FAQ L311 spliced with L165
   from a different section, and L311's own third sentence dropped.
 - r002 removed held.rideshareDropoff entirely, so the Lyft PICKUP sentence it
   carried is now stored nowhere.
 - r052 wrote the identical five-building completeness block into all five documents,
   so delta's record carries capital-one's venueAccessRestrictions 1.5 text.
 - r021/r022/r025 quote the guard's pointer comment but drop "(an entry on one is
   still checked)", the clause that licenses a non-operator confirmation on a pointer.
 - The 2.5 shape sweep claims completeness it does not have: 21 of 28 held.*.source
   values are still bare strings, delta.tenants[0].sources.gatesOpen is still a
   string, lenovo.officialParkingUrls[3] still ends in a slash.
 - r046 says "12 shared URLs"; the real figure is 15, all identical. r013 says 55,726
   bytes; the file is 55,741.

POSITIVE CONTROLS THAT PASSED: the guard throws nothing on all 7 write ops; an
independent array-indexed diff of w4-base against nhl-w4-facts-v2 finds ZERO
uncovered leaves in the facts payload; and the byte identity behind C3-1 was
re-derived independently for all three recheck captures and all 15 shared URLs.

## 9. THE REPAIR LEDGER

59 records: 43 record, 7 value, 6 typing, 2 confirmation, 1 state. Two supersede an
adjudication and say so. check-repairs passes checks 1 through 3 on v2 and the write
guard passes all 7 payloads, which is precisely why neither caught any of section 4:
both are shape checks, and every new defect is a truth defect.

Per-field table: scratchpad p1/w4/field-table.md. Pass reports: p1/w4/pass1/ and
p1/w4/pass2/. Payload: nhl-w4-facts-v2.json. Nothing written, nothing merged.
