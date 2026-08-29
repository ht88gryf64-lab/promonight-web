# Is "unprovenanced" the right word for a promo?

Report only, 2026-08-29. Written because the 2,641 figure in
`audit/unprovenanced-surface.md` put scanner-extracted promos in the same risk
class as generated venue prose. **They are not, and the earlier number was
misleading by grouping them.**

## What a promo actually carries

Measured across all 4,883 live promo documents:

| Signal | Count |
|---|---|
| `sourceUrl` present | 2,578 |
| `verified: true` | 2,578 |
| `verified` ABSENT (not `false`) | 2,305 |
| `verified: false` | **0** |

`sourceUrl` and `verified:true` are the same 2,578 documents. The complement is
not a set of rows that failed verification: **`verified: false` appears zero
times.** The 2,305 have no `verified` field at all, which is what a document
written before the field existed looks like. This is an era boundary, not a
quality judgment.

## What the pipeline guarantees for a row written today

`lib/scanner/verify-promo.js` runs before anything is published:

- **Derived fields are rule-computed, not trusted from the extractor.** `promoId`
  is computed, `recurring` is forced false, `whileSuppliesLast` is defaulted.
- **Schema and date validity.** No title or a malformed date rejects the row.
- **Title provenance** (`classifyTitleProvenance`) is a deterministic
  anti-hallucination gate: a title that is not grounded in the fetched source
  text is discarded. `docs/EXTRACTION-RULES.md` records
  `title-not-source-derived` as a live rejection reason.
- **A date not present in the source text is DISCARDED, not trusted** (the same
  discipline applied to a second field, at stage 4b).
- **Two independent sources are required on the fallback path.** `api`
  (structured verbatim) and `html` (parse of official content) are
  single-source-sufficient; a Sonnet + web_search candidate needs a second
  independent host or it is not marked verified.
- **Re-verified weekly** by the league scanners, which also revalidate on write.

So a promo written today is verified against source TEXT, not merely accompanied
by a URL. That is a stronger guarantee than any venue field has ever had: the
venueHubs regime checks that a source exists and a human read it, whereas this
checks the claim against the fetched text mechanically, every week.

## The distribution, which is the real answer

| League | verified | no source |
|---|---|---|
| MLB | 1,496 | 1,112 |
| NHL | 575 | 562 |
| NBA | **0** | 331 |
| MLS | 248 | 182 |
| WNBA | 118 | 118 |
| NFL | **141** | **0** |

**And the decisive cut: of the 2,301 dated no-source promos, only 77 are still
upcoming.** The other 2,224 are events that have already happened. They render
in "completed events this season" sections, where they are a record of the past
rather than a claim a fan can act on.

NFL at 141/0 is the newest league and sits entirely inside the regime. NBA at
0/331 sits entirely outside it: that corpus predates verification wholesale.

## The answer

**No, "unprovenanced" is not the right label for the 2,303, and the honest
number is 77.**

Three distinct populations were collapsed into one:

1. **2,224 past events with no source.** Real, but the risk is a wrong historical
   record, not a fan sent to a giveaway that is not happening. Backfilling a
   source onto a promo from 2024 buys very little.
2. **77 upcoming promos with no source.** This is the actual forward-looking
   gap, and it is small enough to verify by hand. Most are NBA and WNBA, the two
   leagues furthest from the current scanners.
3. **2,578 verified rows** that are better evidenced than any venue field on the
   site, and should not have been counted against it.

One real weakness, and it is about the RECORD rather than the data: the
pipeline's `titleProvenance` verdict and `fetchedVia` fidelity tier are computed
at write time and **not persisted to the served document**. The web side stores
only `verified` and `sourceUrl`. So the site cannot distinguish an `api`
verbatim row from a two-source fallback row, and a future audit cannot re-derive
what the gate concluded without re-running the pipeline. That is worth fixing
before any sweep, because it is what makes the corpus auditable at all.

## Correction to the earlier figure

`audit/unprovenanced-surface.md` reports 2,641 unprovenanced claims. Read with
this document, the comparable figure is **415**: 296 venues-corpus claims, 42
recurringDeals, and 77 upcoming unsourced promos. The remaining 2,226 are past
promo records, which belong in a different conversation.
