# Wave 5a: the provenance collection. DESIGN ONLY, nothing built. 2026-09-04.

## 0. TWO CORRECTIONS TO THE BRIEF, BEFORE THE DESIGN

SCOPE ITEM 3 SAYS "five live buildings and three overlays". IT IS EIGHT BUILDINGS AND
THREE OVERLAYS. The eight carrying wave 2 provenance are td-garden, ball-arena,
american-airlines-center, united-center, ppg-paints-arena, little-caesars-arena,
bridgestone-arena and centre-bell. The five in the brief are wave 5b's re-derive set,
which is a different list and none of them carry wave 2 provenance. The 99 entries
are spread across the eight.

THE `provenance` DATABASE DOES NOT EXIST. Probed both: `(default)` reads fine,
`provenance` returns NOT_FOUND. Creating it is a prerequisite for step 2 and is not
something this session can do from code. It needs `gcloud firestore databases create
--database=provenance --location=<same region as default>` or the console.

## 1. WHY A NAMED DATABASE IS THE "BY CONSTRUCTION" ANSWER

The web reaches Firestore through ONE handle: `src/lib/firebase.ts` line 11,
`export const db = getFirestore()`, unparameterised, so it binds to `(default)`. It is
the only `getFirestore(` call in the whole of `src/`.

A Firestore client is bound to one database for its lifetime. If provenance lives in a
database named `provenance`, then `db` CANNOT ADDRESS IT AT ALL. Not "should not":
there is no collection path on that handle that reaches another database. Reading it
would require constructing a second client with an explicit database id, which is a
visible, greppable, reviewable act rather than an accidental `db.collection(...)`.

Security rules are NOT the mechanism and cannot be: both repos authenticate with a
service account through firebase-admin, which bypasses rules entirely.

RESIDUAL, STATED PLAINLY. This prevents accidental coupling, not a determined reader.
Anyone can write `getFirestore(app, 'provenance')`. What it buys is that the render
path cannot drift into reading provenance without someone adding a second database
handle in a diff. Belt and braces: a test in the web repo that fails if the string
`provenance` appears as a database id or collection name anywhere under `src/`.

## 2. PATH AND KEY STRUCTURE

Database: `provenance`. Two levels, because the record does not fit one.

  venueHubProvenance/{slug}                     building level
  venueHubProvenance/{slug}/fields/{fieldName}  field level
  venueHubProvenance/{slug}/tenants/{teamId}    overlay level, same shape as a field doc

Keyed by slug and field as briefed, with a building-level parent for everything the
record holds that is NOT field-scoped. Section 4 explains why that parent is not
optional.

## 3. WHAT ONE FIELD ENTRY HOLDS

  {
    slug, field,
    fieldState,                 rendered | operator-conflict | no-operator-page | held
    confirmationType,           independent | republish | operator | null
    storedValue,                a COPY of what the document was written with
    sources: [url],
    observedAt,                 the field's observation time, oldest page, or null
    observedAtBasis,            how that time was established, or why it is null
    pagesRead: [
      { url,
        finding,                states-agrees | states-disagrees | silent | points-only
        quote,                  the sentence the finding rests on, verbatim
        observedAt }            when THAT page was read
    ],
    held:      { text, reason, source } | null,
    conflict:  { rule, disputedValue, readings: [ { url, text } ], survives } | null,
    harvestGaps: [ { url, namedOn, why } ],
    recordedAt, recordedBy,     wave and gate that wrote it
    supersedes                  prior entry id, when a later wave replaces one
  }

The building-level doc holds: `verify` class blocks, class-keyed confirmations,
building-scoped held entries, building-wide harvest gaps, completeness gaps, the
record revision, and the wave that wrote it.

## 4. THE BACKFILL PROBLEM, MEASURED, AND WHY IT SHAPES THE DESIGN

I checked the wave 2 record against a field-keyed collection before designing, and it
does not fit cleanly. Two mismatches, both measured:

  HELD: 0 OF 24 ENTRIES ARE KEYED BY A CONTRACT FIELD. All 24 use ad-hoc reason keys:
  bagWithheld, gatesHeld, parkingRateDisputed, rideshareDisputed,
  uberZoneOpeningDisputed, transitNotOnAgencyPage, transitNotOnCitedPage,
  transitAgencySilent, transitClubOnly, parkingClubOnly, parkingOperatorOnly,
  tailgatingOperatorOnly, publicTransitOperatorOnly, transitHeld, bagLockers,
  guestDropOffPoint, parkingGeneral, parkingLotsFaq.

  CONFIRMATIONS: 8 entries are keyed by CLASS (bag, parking, transit, gates,
  rideshare) and 35 by FIELD. Both schemes are live in the same corpus, which is
  ledger entry D13 showing up as a migration cost.

THE RULING THIS FORCES. A field-keyed collection alone would require inventing a field
association for all 24 held entries. That is fabrication of exactly the kind this
programme exists to prevent, and some of them genuinely are not field-scoped
(`bagLockers` and `guestDropOffPoint` are sub-facts, not fields). So:

  - Reason-keyed held entries move to the BUILDING doc, under their own reason key,
    unchanged.
  - Each MAY carry a `fields: []` association, populated ONLY where the record itself
    states one. Absent otherwise. No inference.
  - Class-keyed confirmations move to the building doc under their class name. They
    are NOT split across fields.
  - The 35 field-keyed confirmations become field docs.

This is a move, not a re-derivation, which is what the brief asked for. The cost is
that a field doc is not always self-sufficient: a reader may have to consult the
building doc too. I prefer that to an invented mapping.

## 5. WHAT THE WAVE 2 RECORD CANNOT SUPPLY

  observedAt: NULL FOR ALL 51 OF THE 55 STAMPED FIELDS. Per audit/nhl-cache-bound.md,
  no capture in waves 1 to 4 can be demonstrated to be a real observation at its
  recorded time. Backfilled entries carry observedAt null with observedAtBasis
  recording that the capture is unmeasured. The four little-caesars-arena fields whose
  capture IS provable stay null too, per the standing ruling that a date must be
  harvest-recorded and not hand-entered.

  quote: PARTIAL. Wave 2 findings are prose paragraphs, and many name a page and its
  agreement without isolating a verbatim sentence. Where no verbatim quote exists in
  the record, `quote` is null and `finding` still carries. This weakens the drift
  check for those pages, and section 6 says how much.

## 6. HOW A LATER PASS USES IT

VERIFYING A CLAIM WITHOUT RE-DERIVING IT. Today a verifier rediscovers which pages
matter, which is most of the cost and is where the pages-read assertion has been wrong
three times. With the entry, a verifier reads `pagesRead`, fetches only those URLs, and
for each one checks the recorded `quote` against the page and the recorded `finding`
against what it sees. It never has to decide which pages are relevant, and a page the
record calls SILENT is now a falsifiable claim rather than an assumption.

THE DRIFT CHECK, mechanically. For each field doc, re-fetch every `pagesRead[].url`
with maxAge 0, then per page:

  quote present, unchanged     the finding holds
  quote absent                 DRIFT: the page changed under a stored claim
  quote null                   UNCHECKABLE: wave 2 recorded no verbatim sentence
  page 404 or shell            the source is gone, rule 7.4a
  storedValue != document      the write diverged from its own provenance

That last row is the one nothing can currently detect. It is only possible because the
entry keeps a copy of what was written, so provenance and document can disagree out
loud instead of silently.

## 7. THE GUARD

`assertVenueHubWrites` gains the provenance ops and cross-checks, so that:
  - every building op has a building provenance doc;
  - every written claim field has a field doc, and every field doc names a field the
    document carries;
  - every tenant op has a tenant provenance doc;
  - `storedValue` in a field doc equals the value in the document op;
  - `fieldState` and `confirmationType` match the document's maps.
A document written without its provenance entry is a hard failure, as briefed. Both
op sets go in one batch, so the pair is atomic.

## 7a. THE STANDING DIVERGENCE CHECK (added at sign-off, 2026-09-04)

The storedValue-versus-document comparison is NOT only a row inside a drift pass. It
is its own script, run on demand against the whole corpus, reporting every field where
the provenance entry and the live document disagree.

WHY IT IS SEPARATE. A drift pass asks whether the WORLD changed under a stored claim,
and needs the network. This asks whether OUR OWN TWO RECORDS agree, and needs no
network at all. They fail for different reasons and on different schedules: drift
happens when a venue edits a page, divergence happens when a write goes wrong, a
backfill mis-maps, or a later wave rewrites a document without its provenance. Nothing
watches that class today, on eleven live documents and on every write that follows.

SHAPE. `scripts/check-venuehub-provenance-divergence.js`, read-only, both databases.
For every provenance field doc: compare `storedValue` to the document's value for that
field, `fieldState` to `fieldStates[field]`, `confirmationType` to
`confirmations[field]`, and `sources` to `sources[field]`. Report four states per
field: AGREE, DIVERGED (both present, values differ), ORPHAN PROVENANCE (entry with no
document field), UNCOVERED FIELD (document field with no entry). The last is the guard
failure of section 7 caught after the fact, which is the case where the guard was
bypassed or predates the rule.

Exit non-zero on anything but AGREE, and print the count of fields compared, so a run
that compares nothing cannot read as a pass. Framework 6b.8.

## 8. OPEN, FOR THE SIGN-OFF

  1. The `provenance` database must be created before step 2. Not doable from here.
  2. Confirm the building-level parent is acceptable, given 0 of 24 held entries can
     be field-keyed without invention.
  3. Confirm observedAt stays null on every backfilled field, including the four
     provable little-caesars ones.
  4. Confirm `quote: null` is acceptable where wave 2 recorded no verbatim sentence,
     rather than back-reading the captures to manufacture one. Back-reading would be a
     re-derivation, which this wave excludes.


## SIGN-OFF, 2026-09-04

All four section 8 items signed off. Database being created by Matt, us-central1 to
match (default). Step 2 and the backfill write are gated on that confirmation.

Proceeding meanwhile with the parts needing no database: the web-repo tripwire test,
the guard extensions tested against fixtures, and the backfill transform as a dry run.
