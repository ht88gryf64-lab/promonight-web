# The write-set gap. 2026-09-04. REPORT ONLY, nothing changed. Wave 5 design input.

## 1. WHAT THE WRITE STRIPS

A record carries 15 top-level keys. The written document carries 32. They are not
subsets of each other, because the writer unpacks some and generates others.

THREE KEYS ARE UNPACKED, NOT LOST:
  building   its contents become the document's top-level claim fields
  slug       becomes the document id
  tenants    becomes the tenants subcollection

TWO ARE BOOKKEEPING, correctly absent:
  write      whether this record is written at all
  revision   the record's own version label

THREE ARE LOST, and this is the gap:

  confirmationsFull
    WHAT IT ASSERTS. Per field: the confirmation type, the full list of operator
    pages read, and a per-page finding stating whether each page STATES the value
    and agrees or is SILENT, usually with the quote. Also carries clubStatus and
    clubRepublish, section10Note, harvestGaps, completenessGaps, the rule 1.5
    readings, and the cached-fetch provenance labels.
    SURFACED DOWNSTREAM? NO. It is not in Firestore, so nothing can read it.

  held
    WHAT IT ASSERTS. Text deliberately not rendered, with its source and the reason
    it is withheld. The entry NAMES are the reasoning: bagWithheld, gatesHeld,
    parkingRateDisputed, rideshareDisputed, uberZoneOpeningDisputed,
    transitNotOnAgencyPage, transitNotOnCitedPage, transitAgencySilent,
    transitClubOnly, parkingClubOnly, parkingOperatorOnly, tailgatingOperatorOnly,
    publicTransitOperatorOnly, transitHeld, bagLockers, guestDropOffPoint,
    parkingGeneral, parkingLotsFaq.
    SURFACED DOWNSTREAM? NO.

  verify
    WHAT IT ASSERTS. Per class (bag, parking, transit, gates): a status token and
    the operator, club and agency citation URLs the class rests on.
    SURFACED DOWNSTREAM? NO.

CONFIRMED BY READING THE CONSUMER, not by assuming: src/lib/venue-hub.ts contains no
reference to confirmationsFull, held or verify. Its only "held" hits are the
VenueFieldState literal, which is a different thing.

ONE RECORD KEY SURVIVES A WRITE: verifyNotes, a single prose blob. On td-garden it is
3,658 characters. That is the entire narrative channel between the audit and the
document, which is exactly why corrupting it in wave 4 mattered so much.

## 2. WHAT THE LIVE BUILDINGS LOSE

Across the 8 live NHL buildings, entries existing ONLY in stripped keys:

  held                24 entries
  confirmationsFull   43 entries
  verify              32 class blocks
  TOTAL               99 record entries that reach no document

THE SHAPE OF THE LOSS, stated plainly: THE DOCUMENT CARRIES THE VERDICT AND NEVER THE
REASONING. fieldStates ships, so a reader of the document can see that a field is
held, or in operator-conflict, or has no operator page. Why it is held, which pages
were read, which two readings conflicted, which agency page was silent, and which
value is single-sourced all live in keys that are discarded at the write boundary.

Worked example. united-center.held.gatesHeld carries "Gates generally open 90 minutes
prior to the events and games. Family shows may vary." with its source URL and the
reason it is withheld. The document records that gates are held. It does not record
that a specific operator sentence exists, what it says, where it is, or why it was
judged insufficient. A future pass re-derives that from scratch or, worse, re-derives
it differently.

## 3. THE QUALIFICATIONS THAT EXIST ONLY IN STRIPPED KEYS

Every one of these is currently true of a live building and invisible in its document:

  - Which specific operator pages were read for a field, and what each one said.
    operatorPagesRead DOES ship, so the URL list survives; the FINDING per page,
    which is the part that has been wrong three times in this programme, does not.
  - That a transit claim rests on a club page rather than the agency's own
    (transitClubOnly, transitNotOnAgencyPage, transitAgencySilent).
  - That a parking rate or a rideshare answer was disputed between operator pages
    and nulled under rule 1.5 (parkingRateDisputed, rideshareDisputed,
    uberZoneOpeningDisputed), and what the two readings were.
  - That a value is operator-only, so it carries one domain and no corroboration
    (parkingOperatorOnly, publicTransitOperatorOnly, tailgatingOperatorOnly).
  - Every harvest gap: a named page linked from a captured page and never fetched.
  - Every cached-fetch provenance label written in wave 4.
  - The four clear-bag adjudications, which live in the pipeline guard rather than
    in any document.

## 4. THE WAVE 5 QUESTION, stated but not answered here

The audit record and the stored record are different artifacts and only one of them
ships. Three shapes are available and they are not equivalent:

  a. WIDEN THE DOCUMENT. Write confirmationsFull and held. Truthful and complete,
     but it puts internal adjudication prose one field away from fan-facing copy, on
     a collection the renderer reads. The guard's proseViolation check exists
     precisely because that boundary has been crossed before.
  b. FOLD THE SUBSTANCE INTO verifyNotes. It already ships. But it is one blob, it
     is not queryable, and wave 4 showed how easily a blind edit corrupts it.
  c. A SEPARATE PROVENANCE COLLECTION the renderer never reads, keyed by slug and
     field. Keeps adjudication away from render, stays queryable, and is the only
     shape where a drift check can compare a stored finding against a re-read page.

My reading, offered as input rather than a decision: (c) is the only one that lets a
later pass verify a claim without re-deriving it, and (a) is the one most likely to
put internal prose on a page.

## 5. NOT CLAIMED

Nothing was changed. No venueHubs write. The counts above are from the wave 2 record
that produced the live documents and from a read of the live documents themselves.
