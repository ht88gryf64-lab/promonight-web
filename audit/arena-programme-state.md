# NHL arena logistics programme: state as of 2026-09-06

HANDOFF DOCUMENT. Assumes no prior context. Written at a deliberate stop, not a finish.

Two repos: `promo-pipeline` (harvest, extract, guard, write) and `promonight-web` (render).
Two Firestore databases: `(default)` holds `venueHubs`; `provenance` holds
`venueHubProvenance`. The web repo builds ONE unparameterised Firestore client, so it
cannot address the provenance database at all. That is enforced by test, not convention:
`src/lib/__tests__/provenance-isolation.test.ts`.

## 1. THE TWELVE LIVE BUILDINGS

Eight carry data this programme wrote. Four more NHL-relevant slugs exist in `venueHubs`
from the earlier 222-building logistics build and were never touched by it.

WRITTEN BY THIS PROGRAMME (waves 1 and 2), all verified under the NARROW operator rule
(bag, parking and gates only) plus `independent` for transit on the agency's own page:

  td-garden                 7 stamped fields   Bruins overlay
  ball-arena                6
  american-airlines-center  7                  Stars overlay
  united-center             6                  Blackhawks overlay
  ppg-paints-arena          5
  little-caesars-arena      9
  bridgestone-arena         6
  centre-bell               6
  Plus 3 tenant gate overlays. 55 stamped fields across 11 documents.

PRESENT BUT NOT FROM THIS PROGRAMME: crypto-com-arena, madison-square-garden,
t-mobile-park, and the five held buildings below. They carry no per-field provenance.

WHAT VERIFIED THEM. Confirmation types are `operator` (every operator page mentioning the
field read, and they agree, or rule 1.5 nulled the disputed value), `independent` (a
separately worded second domain; for transit the agency's own page is REQUIRED), and
`republish`. Per-field state is one of rendered, operator-conflict, no-operator-page,
held.

A KNOWN DEFECT ON ALL EIGHT. They carry `verifiedAtByField`, a date the WRITER generated
at write time, so it dates the write and not the read. Measured: 55 fields, two distinct
stamps 1 ms apart, each overstating its field's real read time by 1.3 to 24.4 hours. The
render no longer reads that key, so no date reaches a reader, but the stale values are
still in the documents. Replacement key is `observedAtByField`, and ZERO live documents
carry it. 51 of the 55 fields cannot honestly carry one until re-harvested, because no
capture in waves 1 to 4 can be shown to be a real observation (see section 5).

## 2. THE FIVE HELD BUILDINGS

scotiabank-arena, wells-fargo-center (the building is Xfinity Mobile Arena),
capital-one-arena, delta-center, lenovo-center.

Values for all five were derived twice and verified twice. THE VALUES ARE SOUND. What
blocks them is the record layer. Each is held because:

  - The confirmation records for their newly derived fields depend on an eligibility
    widening that is NOT IN THE CODE (section 6).
  - `operatorPagesRead` entries in the wave 5c ledger are objects carrying url, finding,
    quote and observedAt. The guard runs `urlViolation` on each entry and rejects a
    non-string. Every record is unwritable in that shape regardless of eligibility.
  - Twelve of thirty records were defective on audit, five of them false.

Building-specific facts worth not rediscovering:
  scotiabank    Two parking URLs, one HTTP 404 and one returning 200 with a one-line
                body. Real parking content lives under an anchor on a third page.
                Bag-check fee is $25 on one operator page and $20 on another: rule 1.5.
  wells-fargo   Its Plan Your Visit page body is SIX LINKS and two of them are dead
                (eat-drink, faqs, both 404). Guest Services desk section stated three
                ways (121 x6, 122 x2, 124 x1).
  capital-one   Publishes NO parking fact: the garage heading resolves to a contact form
                and most of the page is a booking widget. Re-entry is answered twice on
                one page with different entrances, each saying "only": rule 1.5. WMATA
                publishes the station as "Gallery Place"; the operator and club both say
                "Gallery Place/Chinatown" and "Chinatown" appears ZERO times on the
                agency page.
  delta-center  nhl.com/mammoth is a 404 shell, so no club republish exists for any
                field. Four food-brand banners on the food page are SITE CHROME,
                identical and in order on all seven captures; deriving a roster from them
                would be fabrication.
  lenovo        No transit fact exists anywhere: zero hits for GoRaleigh, GoTriangle,
                Wolfline, light rail or Amtrak across every capture, and the page the
                parking guide labels "Public Transportation" carries only rideshare,
                taxi, airport and camping. The only Hurricanes parking figure sits under
                "Effective for 2026 Stanley Cup Final": rule 1.7, do not publish it.

## 3. THE FIFTEEN UNBUILT

Of 32 NHL clubs, 8 buildings are live and 5 are held. The remaining buildings were
planned as waves 6 and 7 at five each and NONE has been started: no harvest, no
derivation, no record. Three NHL-relevant slugs exist in `venueHubs` from the earlier
logistics build (crypto-com-arena, madison-square-garden, t-mobile-park) and are not part
of that count in any meaningful sense, since they carry no provenance.

## 4. THE PROVENANCE COLLECTION

Database `provenance`, collection `venueHubProvenance`. Contains 57 documents: 8 building,
36 field, 13 tenant. Backfilled from the wave 2 record for the eight live buildings. All
99 record entries that previously reached no document are carried: 24 held entries, 8
class confirmations, 7 pointer confirmations, 32 verify blocks, 28 field-keyed
confirmations.

`observedAt` is null on every field with a stated basis, because no wave 1 to 4 capture
can be shown to be a real observation.

IS THE PAIRING GUARD ENFORCING? NO. `assertVenueHubWritesWithProvenance` and
`lib/venuehubs-provenance.js` live on `feat/provenance-guard` and are NOT MERGED. Main's
writer does not import them and does not emit provenance ops. So the rule "a document
written without its provenance entry is a hard failure" is written, tested and inert. The
backfill was performed by a scratchpad script, not by the guarded path.

Also unenforced: the standing divergence check
`scripts/check-venuehub-provenance-divergence.js` is on the same unmerged branch. Its last
run reported 36 comparisons, 36 AGREE, 0 diverged, 0 orphan, 0 uncovered.

A Firestore batch CANNOT span databases. Verified: it is accepted at build time and
rejected at commit. The design writes provenance FIRST so the survivable failure is an
orphan entry rather than a document with no provenance.

## 5. THE CACHE FINDING, WHICH BOUNDS EVERYTHING BEFORE WAVE 5b

`lib/extract/firecrawl-fetch.js` sent no `maxAge`, so Firecrawl served its own cache and
a "fresh" scrape could return bytes an earlier run had already read, invisibly.

  waves 1 to 4: 100 captures. 84 unmeasured, 16 provably identical to earlier bytes,
  ZERO demonstrably first observations.

Fixed: `maxAge` threads to the request body, default undefined, and every capture-writing
caller now passes 0. Wave 5b's harvest is the first that can claim real observation: the
WMATA page that was byte-identical at 15,562 bytes across waves 3 and 4 returned 15,493
under `maxAge 0`.

## 6. THE ELIGIBILITY WIDENING: PROPOSED, NOT IN FORCE

`OPERATOR_ELIGIBLE_FIELDS` on main is the wave-2 list of ten (bag, parking, gates
classes). A widening to accessibility, re-entry, outside food, food and tailgating is on
`feat/operator-eligibility-widened` (de5c6c0) with three tests, UNMERGED.

Main documented that widening while not implementing it, from 2026-09-05 until commit
552a32e withdrew the claim on 2026-09-06. The doc now records it as an OPEN QUESTION.

The argument FOR it stands: across five buildings roughly eight of fourteen claim fields
each derived cleanly, agreed across every operator page mentioning them, and could reach
no confirmation type at all. The argument AGAINST landing it now is that its only
application produced 43 confirmation records, none writable and twelve defective.

`publicTransit` is excluded permanently and a test pins it. The reason is not that
operators say less about transit; it is that a second authority exists and outranks the
venue, which the Gallery Place finding demonstrates.

## 7. UNMERGED BRANCHES THAT MATTER

  feat/operator-eligibility-widened   the widening plus 3 tests. 9 commits behind main;
                                      conflicts on the guard comment. Section 6.
  feat/provenance-guard               the provenance store, the pairing guard, the
                                      divergence check. 2 commits. Section 4.
  fix/harvest-arg-guard               the harvest argument guard, compare-captures.py,
                                      and framework 6b.8 instance 5. 3 commits, and it
                                      CONTAINS the two provenance commits, so merging it
                                      merges provenance too.

Main is otherwise self-consistent in both repos. The web repo has twelve unmerged
branches, none of them from this programme.

## 8. FRAMEWORK ENTRIES THIS PROGRAMME PRODUCED

All in `promo-pipeline/docs/scanner-framework.md`.

6b.8  A CHECK THAT CANNOT RUN REPORTS SUCCESS. It hands back the same artifact success
      hands back. Six instances: node --test with cwd-relative globs (pass 0, fail 0,
      exit 0); a test spawning node --test, which refuses to run recursively and prints
      nothing while exiting 0; GitHub per-step summaries copied from a blank file; a
      dry-run harness whose artifact omitted the four maps it existed to prove; npx jest
      on a node:test suite, whose totals were another runner's per-worker lines; and a
      shell capture comparison whose unmatched glob emptied the reference index so all 48
      captures reported as new. That last is the sharpest: a confidently WRONG answer
      rather than no answer.
      Control: prove the thing executed before reading its result. A zero result and a
      result of zero must not share an exit code.

6b.9  A CHECK WIDENED TO ADMIT THE ARTIFACT IT IS CHECKING. The check runs correctly and
      passes because it was authored to pass its input. Instance: a ledger tripwire whose
      pattern list contained the literal commit hash `de5c6c0` and the constant name
      `OPERATOR_ELIGIBLE`, OR-joined, written in the same session as the 22 records it
      admitted. The precursor matters: one wave earlier the same checker legitimately
      gained a rule-citation branch, and IN A DIFF THE TWO LOOK IDENTICAL. What separates
      them is whether the new alternative names a CLASS of evidence or THIS ARTIFACT.
      Control: match evidence against the corpus, never against a pattern. Ordering rule:
      write the check against a known-bad input BEFORE producing the input.
      SECOND INSTANCE, committed after the entry was written: the wave 5c evidence
      extractor's food pattern ended `|cashless venue|reverse ATM`. `reverse ATM` occurs
      in three files in the whole corpus and is the alternative that admitted the one
      page whose omission was blocking a drop. The accompanying self-report record
      asserted "No alternative names a building, a page, a slug or a specific string."
      It named two. Writing the framework entry did not prevent the behaviour.

6b.10 A CHECK COMPARING A VALUE TO ITSELF. Both operands derive from one source through
      one lossy transform, so no input can fail it. Instance: basis URLs rebuilt from
      capture filenames, where both "-" and "/" encode as "_", compared through a key
      function collapsing the same characters. Thirty records, every URL malformed, every
      one passing, none clickable.
      Tell, and it needs no example: follow both operands back. If they meet at one source
      or pass through one function, it is a tautology, callable from the code alone.
      Control: compare against what the source system recorded, and have the PRODUCER
      refuse to emit a value absent from that record.

## 9. UNRESOLVED RECORD-LAYER DEFECTS

A list, not a plan. Nothing here is scheduled.

  1. `operatorPagesRead` entries are objects; the guard requires URL strings. Findings
     and quotes need a different home.
  2. Pages are deduped by URL, not by content. Three of nine "gap-closing" fetches in
     wave 5c were byte-identical aliases of pages already held, so 13 of 21 records
     over-count pages read and 2 over-count stating pages with an identical quote.
  3. The `accessibility` pattern carries a bare `ADA` alternative and matches "Canada".
     Three pages entered as accessibility evidence on it, one of them a FAQ about flags
     hanging backwards.
  4. Matching is line-scoped, so a list whose polarity lives in its heading is invisible.
     `delta-center.outsideFoodAllowed` is held against evidence the same ledger quotes.
  5. The extractor breaks on the first match per page, so a second differently worded
     statement on the same page cannot be recorded. Xfinity says re-entry is "prohibited"
     at L266 and "restricted" at L355; only the first exists in the record.
  6. Seven silent findings are false, over six documents, including three buildings' own
     subject pages. `silent` is a regex miss reported as a fact about the page.
  7. Three of four `food` records rest on cashless-payment sentences that never mention
     food. Capital One's quotes the same cashless claim on both its stating pages.
  8. Two rule 1.5 survivors over-reach: Capital One re-entry survives as an UNQUALIFIED
     permission neither source grants, and Lenovo Guest Services imports "on the Main
     Concourse" from only one side.
  9. Confirmation records do not disclose 1.5 nulls sitting inside the same field.
 10. `class: "record"` opts an entry out of the ledger checker's page-and-quote test, and
     all three entries citing no captured page are classed `record`.
 11. The chrome guard has never fired: `chromeRejected` is 0 on all five buildings. It is
     unproven, not clean.
 12. CONDITION (a) IS ASSERTED OVER THE HARVEST, NOT OVER THE SITE. "Every operator page
     mentioning the field" is bounded by what was captured, and no record says so. This
     one survives every fix so far and is the reason the record layer needs a different
     approach rather than another iteration.

## 10. PRODUCTION IS UNAFFECTED

Confirmed 2026-09-06, four fetches, nothing assumed:

  /nhl                          136,925 bytes, 10 venue links in the rail
  /venues                       164,732 bytes, 167 venue links
  /venues/td-garden              95,516 bytes
  /venues/little-caesars-arena  101,033 bytes

"Verified" appears ZERO times on all four, and "Source read" zero times, which is the
intended state: the render reads `observedAtByField`, no live document carries it, so no
date reaches a reader. Waves 5b and 5c wrote nothing to Firestore and changed no rendered
copy.
