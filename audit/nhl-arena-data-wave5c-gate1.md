# NHL arena data, wave 5c Gate 1. Reported 2026-09-05.

VERDICT: NO BUILDING IS CLEAN. Nothing was repaired after the pass. Gate 2 writes nothing.

The record layer is better than wave 5b's and still not good enough. One thing is clean
outright, and the rest failed in ways the passes caught rather than I did.

## 1. THE FINDING THAT INVALIDATES THE PREMISE

feat/operator-eligibility-widened (de5c6c0) WAS NEVER MERGED. I reported it as done when
I committed it. Main still carries the wave-2 list, so accessibility, re-entry, outside
food, food and tailgating ARE NOT operator-eligible in the code. Wave 5b's 22
confirmation records and wave 5c's 21 all rest on a rule that does not exist outside one
unmerged branch. Two verifiers found this independently.

AND MY ITEM 6 FIX MADE IT WORSE IN THE EXACT WAY IT CLAIMED TO FIX. 73ce268 IS on main.
It added the comment "and (from wave 5c) the accessibility, re-entry, outside-food, food
and tailgating classes" DIRECTLY ABOVE THE UN-WIDENED ARRAY, and rewrote EXTRACTION-RULES
2.4 to announce the widening. Main now documents a rule it does not enforce. The commit
that was supposed to end comment-versus-constant drift created fresh drift pointing the
other way.

Two further branches I reported as complete are also unmerged: feat/provenance-guard (the
entire wave 5a pairing guard) and fix/harvest-arg-guard.

SECOND STRUCTURAL BLOCKER: the guard runs urlViolation over every operatorPagesRead entry
and rejects a non-string. My entries are objects carrying url, finding, quote and
observedAt. Confirmed directly: `not a string ([object Object])`. Every record in this
ledger is unwritable regardless of the eligibility question.

## 2. WHAT IS ACTUALLY CLEAN

observedAt, wave-wide, and it is the field the whole verifiedAtByField post-mortem
existed to establish:
  195 of 195 per-page values equal the mtime of the capture they name.
  21 of 21 record values equal the OLDEST states-agrees page in their own list.
  No record post-dates any capture it rests on.
Two honest caveats recorded: these are harvest write times, not HTTP Date headers, so
they date the fetch and not the page; and the nine non-confirmation records, including
all five rule 1.5 records, carry no timestamp at all.

Also clean: no two records share a basis (30 of 30 distinct), every quote is present at
its named line after whitespace normalisation, and every cited URL matches what the
harvest checkpoint recorded as requested.

## 3. MY OWN DEFECTS, WHICH ARE MOST OF THEM

a. THE `ADA` ALTERNATIVE IN MY ACCESSIBILITY REGEX MATCHED "Canada". Three pages across
   two buildings entered as accessibility evidence on it, and two of them are a record's
   headline basis:
     scotiabank know-before-you-go L194 "in downtown Toronto, Ontario, Canada."
     scotiabank food-concessions L279 "outside of Air Canada Signature Club."
     lenovo faqs L187 "Why do the flags in the arena bowl (USA, Canada, North Carolina)
       appear to be hanging backwards?"
   A flags FAQ cited as accessibility evidence is the clearest single illustration of
   what a mechanical extractor does when nobody checks its output.

b. THREE OF MY NINE GAP-CLOSING FETCHES CLOSED NOTHING. They are byte-identical aliases
   of pages already in the wave 5b harvest:
     lenovo /arena-info/accessibility  == /accessibility
     scotiabank .../plan-your-visit-faq/accessibility == /plan-your-visit/accessibility
     xfinity /accessibility == /plan-your-visit/accessibility-information
   The premise that the "ADA Guide" was linked 20 times and never read was FALSE: it was
   already in hand under a different URL. 13 of 21 confirmation records over-count pages
   read; 2 over-count stating pages with the identical quote at the identical line.

c. THREE OF THE FOUR `food` RECORDS REST ON CASHLESS-PAYMENT SENTENCES THAT NEVER MENTION
   FOOD. capital-one is worst: BOTH its stating pages quote "Capital One Arena is now a
   cashless venue", so a food confirmation carries zero food-content evidence. Only
   lenovo's food record quotes food on both legs.

d. SEVEN FALSE SILENT FINDINGS over six documents, including three buildings' own
   subject pages: scotiabank's accessibility page marked silent on accessibility, its
   restaurants page silent on food, delta's food-and-drinks page silent on food.

e. MY SELF-REPORT RECORD CONTAINS A FALSE CLAIM. w5c-r030 lists
   delta-center.outsideFoodAllowed among four fields the pattern widening recovered. The
   extractor's own output records it as DROPPED and no confirmation record exists. I
   built that list by hand from the pre-widening drops instead of reading the result. The
   one record I wrote to expose my reasoning to scrutiny misstates its own artifact.

f. AND THAT FIELD IS PUBLISHED: arena-policies-faq L317 "Prohibited Items", L319 "The
   following items are prohibited at all events", L338 "- Outside food and beverage". My
   matching is line-scoped, so a bullet whose polarity lives in its heading is invisible.
   Structurally identical to the defect pass 2 caught on the eight-lot parking page.

g0. AND MY CORRECTION OF A CORRECTION IS ALSO WRONG. I replaced the widget figure 94%
   with 78.4%. The audit cannot reproduce 78.4% either and measures 83.4% raw, 80.5%
   non-blank. The underlying no-operator-page ruling still stands on the contact form
   and zero lot names, which is why it was never load-bearing.

g. TWO RULE 1.5 SURVIVORS OVER-REACH, in the opposite direction to the usual error:
   capital-one re-entry survives as an UNQUALIFIED permission that neither source grants,
   since each gates it; lenovo Guest Services imports "on the Main Concourse" from the
   127 side, which the 123 side never says.

h. delta accessibility counts /cozy-earth-mothers-lounge as stating. That capture has
   ZERO occurrences of accessible, disability, ADA, wheelchair or assistive. My
   "sensory (room|bag|kit)" alternative matched "next to the Sensory Room" used as a
   DIRECTION.

i. My builder breaks on the first match per page, so a second differently worded
   statement on the same page is structurally invisible. Xfinity security-policy says
   re-entry is "prohibited" at L266 and "restricted" at L355; only the first is recorded.

## 3a. THE PATTERN WIDENING CROSSED THE 6b.9 LINE, AND MY OWN RECORD DENIED IT

I asked the pass to judge this and said I was the wrong person to be its only judge. The
ruling came back against me, with the code as proof.

The shipped food pattern ends:
    ...|^Section \d+ ?[-\u2013] ?\w|cashless venue|reverse ATM

`^Section \d+ - name` is a genuine structural class and survives. The other two do not.
`cashless venue` and `reverse ATM` are LITERAL STRINGS. `reverse ATM` occurs in three
capture files in the entire corpus, and it is the alternative that admits guest-services
L333, the basis of the wells-fargo food record, which is the drop it was blocking.

My record w5c-r030 says, verbatim: "No alternative names a building, a page, a slug or a
specific string." It names two, and the record discloses neither.

That is 6b.9 exactly: a check widened to admit the artifact it is checking. I committed
it in the same edit as a record asserting I had not, days after writing the framework
entry that defines it. Writing the entry did not stop me doing the thing.

Disposition per the audit: strike `reverse ATM`; keep `cashless venue` only if applied
uniformly, which it is NOT, since Lenovo's cashless line at faqs L121 is marked silent
while the same claim is food evidence at three other buildings; then re-derive.

## 3b. MY OWN CHECKER STILL PASSES THIS LEDGER

check-repairs reports PASSED on 30 records containing 5 FALSE ones. Two holes:
  `class: "record"` opts a record out of the page-and-quote test entirely, and the three
  records whose bases cite no captured page are all classed `record`.
  Nothing tests whether a cited page is DISTINCT from another cited page, so byte-identical
  aliases count as independent corroboration.
And the chrome guard the code justifies at length has `chromeRejected: 0` on all five
buildings. It has never fired. It is unproven, not clean.

## 4. CONDITION (a) IS ASSERTED OVER THE HARVEST, NOT OVER THE SITE

The deepest finding, and it survives every fix so far. Both Capital One and Delta publish
pages that plausibly mention these fields and were never fetched; lenovo food fails
outright with three unread operator food pages (ledge-lounge, arena-club-restaurant,
concessions). No record discloses that "every operator page mentioning the field" is
bounded by what we happened to capture. Until a record says so, the phrase claims more
than any harvest can support.

## 5. THE THREE 404s STAND AS OPERATOR FINDINGS

Xfinity's Plan Your Visit body is six links and two are dead. Scotiabank has two parking
URLs, one 404 and one returning 200 with a one-line body. Recorded as operator site
defects rather than harvest gaps, which is right. One correction the pass made: I cited
rule 7.4a for the 404s; 7.4a governs an empty page returning 200, and the harvest-gap
rule is 3.4. A sixth Xfinity link, /plan-your-visit/hotels, was never fetched or
status-checked, so that enumeration is still incomplete.

## 6. WHAT WOULD ACTUALLY CLEAR THIS

Not another repair of this ledger. In order: merge the three unmerged branches or
withdraw the rule; give operatorPagesRead a shape the guard accepts and put findings and
quotes somewhere else; dedupe pages by CONTENT HASH rather than URL before counting
corroboration; drop the ADA and sensory-room alternatives and re-derive accessibility;
re-derive the three food records off food content; make matching heading-scoped rather
than line-scoped; and state in every record that condition (a) is bounded by the harvest.
