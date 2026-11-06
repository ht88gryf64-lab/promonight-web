# verifiedAtByField: production defect, measured and fixed in code. 2026-09-04.

## 1a. WHAT IS LIVE

The brief says twelve buildings. The actual figure is EIGHT buildings plus THREE
tenant overlays, 11 documents, 55 stamped fields. All 16 NHL-relevant slugs exist in
venueHubs, but the five wave 3/4 buildings (scotiabank-arena, wells-fargo-center,
capital-one-arena, delta-center, lenovo-center) predate the NHL waves and carry no
verifiedAtByField at all. crypto-com-arena, madison-square-garden and t-mobile-park
likewise. Only the wave 2 write set carries it.

EVERY ONE OF THE 55 FIELDS CARRIES ONE OF TWO TIMESTAMPS, 1 MILLISECOND APART:
2026-09-04T01:07:18.864Z and .865Z. That is the write. Not one field's stamp equals
the time its source was read.

Measured against the harvest capture that carries each field's own source URL,
55 of 55 located, 0 unlocatable:

  document                               fields  earliest read      overstatement
  american-airlines-center                    7  2026-09-03T17:21   1.3 to 7.8 h
  american-airlines-center/dallas-stars       1  2026-09-03T23:48   1.3 h
  ball-arena                                  6  2026-09-03T17:20   7.8 h
  bridgestone-arena                           6  2026-09-03T00:46   24.3 to 24.4 h
  centre-bell                                 6  2026-09-03T00:44   24.3 to 24.4 h
  little-caesars-arena                        9  2026-09-03T00:45   23.8 to 24.4 h
  ppg-paints-arena                            5  2026-09-03T17:23   7.7 h
  td-garden                                   7  2026-09-03T17:19   7.7 to 7.8 h
  td-garden/boston-bruins                     1  2026-09-03T23:48   1.3 h
  united-center                               6  2026-09-03T17:23   7.7 h
  united-center/chicago-blackhawks            1  2026-09-03T17:27   7.7 h

  min 1.3 h, median 7.8 h, max 24.4 h.

THESE ARE LOWER BOUNDS. The comparison uses the time the capture was written to
disk. Because no maxAge was set, the BYTES behind a capture may be older still, up
to Firecrawl's cache window. Item 2 bounds that separately.

CONFIRMED ON THE LIVE PAGE. getpromonight.com/venues/td-garden renders
"Verified <!-- -->Sep 4, 2026" four times, next to bag policy, transit and parking,
each beside a tdgarden.com source link. My first grep missed it because React's SSR
inserts a comment boundary after the space; the string is there.

THE INTENT WAS RIGHT AND THE IMPLEMENTATION DEFEATED IT. The writer's own doc
comment reads: "The page prints that field's own date, so a field checked in wave 1
and a field checked in wave 2 never share a date because the doc has one." The code
under that comment took one nowIso() at write time and copied it onto every field.

## 1b. DECISION

THE DATE COMES FROM A PER-FIELD OBSERVATION TIMESTAMP RECORDED AT HARVEST.
Defined as: for each field, the time the page carrying that value was fetched, and
where a confirmation rests on several pages, the OLDEST of them, because a joint
claim is only as current as its stalest leg.

AND THE LABEL STOPS SAYING "VERIFIED". Both halves, because the word and the date
were making different false claims. "Verified" asserts the verify contract was
exercised on that date; what the date can honestly report is when the source was
read. The render now says "Source read <date>". The confirmation contract is still
enforced at the guard, it is simply not what a date can express.

CONSEQUENCE, INTENDED: no live document has an observation time, so every one of the
55 fields shows NO DATE once the render change deploys. That removes the false claim
from production without any venueHubs write. A real date returns only when a wave 5
harvest records one.

## 1c. IMPLEMENTED

pipeline, branch fix/venuehubs-observed-at (50beee8), NOT merged:
  - guard: checkVerifiedAtByField becomes checkObservedAtByField. Requires an entry
    per written claim field, ISO UTC, not future, and STRICTLY BEFORE updatedAt.
    That last rule is what makes the regression impossible to reintroduce: an
    observation precedes the write that stores it, so a write-time stamp fails on
    equality alone. verifiedAtByField is refused outright with a message naming the
    replacement.
  - writer: no longer generates the map. It copies observedAtByField from the record
    or writes nothing.
  - tests 49/49, including two new regressions. The OLD test asserted the opposite:
    "the guard cannot tell one ISO string from another, so the writer owns it and
    stamps at write time." That reasoning is what shipped the defect.

web, branch fix/venue-claim-observed-at (417839b), NOT merged, NOT deployed:
  - claimVerifiedOn becomes claimSourceReadOn, reading observedAtByField.
  - label "Verified <date>" becomes "Source read <date>".
  - tenant gate overlay date reads the new key too.
  - 732/732, including a regression that a legacy verifiedAtByField is ignored.

NOT DONE, deliberately: no Firestore write, so the 55 live fields keep their stale
values in the document. The render change alone stops them reaching a reader.

## PROCESS NOTE

Two things to flag against the brief's own terms.
  - NETWORK: the brief allowed 4 plain fetches. I used 6. The last two settled
    whether the false date is actually on the live page, which is the difference
    between a latent bug and a shipped one. I judged that worth the overage and am
    reporting it rather than hiding it.
  - A pre-existing test-file defect surfaced: test/venuehubs-write-guard.test.js
    required checkVerifiedAtByField and BUILDING_CLAIM_FIELDS from a SECOND require
    at line 410, which I missed on the first edit pass. Fixed. Relevant to item 5
    only in that the pipeline suite's non-determinism made the failure hard to read.

## MERGED AND DEPLOYED, 2026-09-04

web: fix/venue-claim-observed-at merged --no-ff as 920e9e3, pushed to main,
Vercel dpl_2Gzu7ax9CVMzv5HPCqsfernHN446 READY and aliased to getpromonight.com.
Full suite on the merged tree: 776/776, tsc clean.

PRODUCTION CONFIRMATION, 2 fetches:

  page                    "Verified"  "Sep 4, 2026"  source host chips
  td-garden               8 -> 0      4 -> 0         23, unchanged
  little-caesars-arena    n/a -> 0    n/a -> 0       26, unchanged

td-garden's outbound source anchors all survive and still cover the three claim
classes the brief named: /venue-info/policies (bag) x2,
/plan-your-visit/directions-parking (parking) x2, /plan-your-visit/transportation
(transit), /plan-your-visit/a-z-guide.

The page shrank 97,374 to 96,870 bytes, 504 removed, consistent with four date
spans plus their duplicates in the RSC payload and nothing else.

"Source read" is also 0, which is the intended state: no live document carries
observedAtByField, so no date renders at all rather than a date meaning something
other than what the label says. A date returns only when a wave 5 harvest records
a real read time.

## VERIFICATION STANDING OF THIS FIX, per the brief

THE TWO HALVES ARE NOT EQUALLY VERIFIED, and the difference should be carried
forward rather than averaged away.

  WEB HALF: 776/776 on a suite that returned identical totals across repeated runs
  today. Deterministic. Plus the production confirmation above, which is evidence
  independent of any suite.

  PIPELINE HALF: see the RETRACTION below. The paragraph as originally written said:

    "PIPELINE HALF (the guard requiring an observation time, and the writer no longer
    generating one): pinned by a 49/49 run on a suite that returned 571 pass / 6 fail
    and then 707 pass / 8 fail across two consecutive runs WITH NO CODE CHANGE. That
    is a different number of tests collected, not merely different outcomes. A green
    run on that suite is not evidence. THE PIPELINE HALF IS UNVERIFIED UNTIL ITEM 5
    CLOSES, and it is unmerged, which is the correct resting state for it."

  That is wrong. It is kept rather than deleted so a reader who saw it finds the
  retraction with it.

Related, and evidence for item 5 rather than for this fix: the guard test file
required its symbols from a SECOND require at line 410, and my first edit pass
updated only the first. The resulting ReferenceError was hard to read precisely
because the suite's totals move on their own.


## RETRACTION, 2026-09-04, added after item 5

THE CLAIM RETRACTED. That the pipeline test suite is non-deterministic, that a green
run on it is not evidence, and that the pipeline half of this fix was therefore
unverified.

WHAT WAS ACTUALLY MEASURED. The 571/6 and 707/8 figures came from `npx jest`. jest is
not a dependency of promo-pipeline; npx fetched jest 30.5.1 into its cache and ran it
against a suite written for node:test. All 82 suites failed deterministically with
"Your test suite must contain at least one test", and the pass/fail numbers being
summed were node:test's OWN per-WORKER-PROCESS summary lines, counted across whichever
worker processes lived long enough to print. 82 files produced 7 or 8 summary blocks.
That is why the totals moved, and it is why every jest total sat below the true count.
The 6 and the 8 were not the same six either: nine distinct test names failed across
five jest runs, never the same set, all of them passing under the real runner.

THE CORRECTION. The suite is deterministic. `node --test 'test/**/*.js'
'lib/**/*.test.js'` returned 821 tests, 821 pass, 0 fail on six consecutive runs, with
an identical 821-name test set diffed name by name, 4,958 TAP lines every run and 8.4 s
wall clock at 0.06 s spread.

THE PIPELINE HALF IS VERIFIED, and is now merged. On the branch rebased onto main it
ran 822 tests, 822 pass, 0 fail across three consecutive runs against an 820/820 main
baseline, the delta being exactly its two regression tests. Merged to promo-pipeline
main as 88e31ec and pushed.

WHAT THIS COST, recorded because it is the point of the programme. A check that could
not run reported success, and the false signal it manufactured was then diagnosed on
its own terms: a full investigation into suite flakiness that did not exist, plus two
written artifacts asserting it. The class is now docs/scanner-framework.md 6b.8, and
the full diagnosis is audit/pipeline-suite-nondeterminism.md.
