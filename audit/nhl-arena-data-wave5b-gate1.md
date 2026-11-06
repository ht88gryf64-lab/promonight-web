# NHL arena data, wave 5b Gate 1. Reported 2026-09-05.

VERDICT: NO BUILDING IS CLEAN AT PASS 2. All five carry unwritten. Gate 2 writes nothing.
NOTHING WAS REPAIRED AFTER PASS 2, per the brief.

## 1. THE SHAPE OF THE RESULT

The VALUES are the best this programme has produced. Almost every one verified on
re-test, the harvest was real, and the rulings held. THE RECORD IS WHAT FAILS, and the
largest single failure is mine: a repair ledger that asserts evidence it does not carry.

## 2. THE HARVEST WAS REAL, AND THAT IS NEW

48 of 48 captured with FC_MAXAGE=0. Canary: capitalonearena arena-faqs moved 46,401 to
47,841 bytes across two fetches; the four other sites were byte-identical and therefore
inconclusive, which is stated rather than counted as a pass. The decisive control is
WMATA Gallery Place, byte-identical at 15,562 across waves 3 and 4, which came back at
15,493 under maxAge 0. Nine of 35 previously-captured URLs moved, including every
volatile one. 13 pages were captured that no earlier wave had ever fetched.

Two harvest facts I got wrong and should own. The Scotiabank parking page I called a
find is EMPTY: 220 lines, body "# Parking". Rule 7.4a, a site defect. And I dropped
lenovocenter.com/plan-your-visit/directions from my own URL list although my own map
pass returned it, which leaves the road-approach question unanswerable.

## 3. WHY EVERY BUILDING FAILED

  scotiabank-arena   food typed operator with NO VALUE; the restaurants page carrying
                     the content filed SILENT; condition (a) fails on 4 of 5 newly
                     eligible fields; parkingLots left with no state.
  wells-fargo-center food typed operator with NO VALUE; the concessions page listing
                     ~60 stands filed SILENT; /plan-your-visit/eat-drink and
                     /plan-your-visit/faqs are 2 of the 6 links that ARE that site's
                     Plan Your Visit page and were never fetched.
  capital-one-arena  food typed operator on a value never derived; the family-restroom
                     1.5 dropped from the ledger; venueAccessRestrictions omitted from
                     ruling 2 while delta's identical shape was included.
  delta-center       every value verifies and both 1.5 nulls are right. The eight-lot
                     parking page is filed SILENT; a transit false positive stands
                     uncorrected; food observedAt takes the newer of two pages.
  lenovo-center      both 1.5 nullings absent from the ledger; the 1.7 playoff-price
                     hazard unrecorded; food rests partly on footer chrome.

## 4. MY REPAIR LEDGER: 26 OF 38 RECORDS PROBLEMATIC, 9 FALSE

  a. ALL 22 CONFIRMATION RECORDS SHARE ONE BOILERPLATE BASIS citing a commit hash, not a
     page and a line. 22 fields moved from held to publishable with no evidence recorded
     for any of their values. The coverage shield in pure form.
  b. THE PASS-1 ATTRIBUTION IN IT IS FALSE. I wrote "both conditions bind and were
     checked at pass 1". Pass 1 documented the opposite: 13 harvest gaps on lenovo, 10
     more in the completeness lens. I cited as done the check whose failure pass 1 had
     recorded.
  c. EIGHT ARE DISPROVABLE FROM THE CAPTURES: an operator page naming the field, linked
     from pages I did read, never fetched. /accessibility appears in every Xfinity
     capture's header and footer (16 occurrences) and in every Capital One capture (18).
     Lenovo's "ADA Guide" appears 20 times across all 10 operator captures.
  d. NO operatorPagesRead ON ANY OF THE 22. The guard makes an operator confirmation a
     hard failure without it. None is writable as recorded.
  e. observedAtByField WAS NEVER COMPUTED, WAVE-WIDE. build-v2.py defines obs() and
     never calls it. The values exist and are correct in the draft; I did not use them.
     This is the field the whole verifiedAtByField post-mortem existed to establish.
  f. r005 IS FICTION: I recorded rejecting a draft proposal that never existed.
  g. r014's BASIS IS REFUTED: the Scotiabank $50 sits inside the Accessible Parking
     accordion, so the page does not contradict itself. Two verifiers found this
     independently. The value stands, the stated reason does not.
  h. FOUR 1.5 NULLS FOUND AT PASS 1 NEVER REACHED THE LEDGER: lenovo Guest Services and
     First Aid, capital-one family restrooms, capital-one re-entry.
  i. My "94% SpotHero widget" is 78.4%. Pass 1's "94 events" is 127.

## 5. THE 22 NEWLY ELIGIBLE FIELDS

ONE reached a confirmable state on the evidence: scotiabank venueAccessRestrictions,
where a single operator page states it and no unfetched page mentions it.
Condition (a) genuinely holds for 8 of 9 on capital-one and delta, and was simply never
performed or recorded. It FAILS outright on 9 of 10 across scotiabank and wells-fargo.
NONE is writable, because none carries operatorPagesRead.

The ruling itself is sound and I would not withdraw it. What failed is my application.

## 6. CARRIED WAVE 4 FINDINGS, EACH WITH ITS OUTCOME

  22 supported-but-absent fields   RESOLVED in ruling, UNWRITABLE as recorded
  bagsProhibited named nowhere     RESOLVED. It was missing on exactly three buildings
                                   (scotiabank, wells-fargo, lenovo); all three closed
                                   with verified quotes
  capital-one re-entry self-contradiction  CONFIRMED on fresh captures, and the newly
                                   captured arena-policies page CANNOT break the tie:
                                   zero matches for re-entry on it
  wells-fargo accessibility page   RESOLVED. Read for its own subject this wave
  scotiabank parking unresolved    VALUE CONFIRMED, BASIS REFUTED (the accordion)
  lenovo overnight parking         CONFIRMED not a 1.5, on a better basis than recorded
  lenovo clearance footnote        REFUTED. The asterisk attaches to 8AM alone, as pass
                                   1 said

## 7. TWO CODE DEFECTS FOUND BY THE PASSES, NOT FIXED

The guard's own rejection string and JSDoc still read "operator applies to bag, parking
and gates fields only" after de5c6c0 widened it, and EXTRACTION-RULES 2.4 still says the
same. A violation now prints a message misstating the rule the code enforces. Reported,
not repaired, because pass 2 has closed.

## 8. WHAT WOULD MAKE THIS CLEAN

Not a repair of this ledger. A wave 5c that re-derives the record with per-field
evidence: operatorPagesRead enumerated per field, observedAt computed from the capture
mtimes that already exist, the four missing 1.5 nulls encoded, and the ~9 unfetched
operator pages harvested so condition (a) can be performed rather than asserted. The
values from this wave are good inputs to that; the ledger is not.
