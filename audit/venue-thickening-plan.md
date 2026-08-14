# Venue Page Thickening Plan

Date: 2026-08-14. PLANNING ONLY: no content written, no template edits.
Target problem (audit/raptive-page-mix.md): 156 sitemap venue pages, median 712 words (a fresh same-day crawl of all 156 measures median 743, min 269, max 1467), needing roughly 290 more words each to cross 1,000, with genuinely low cross-page similarity (3.4% shared 5-grams).
Evidence base: full crawl of all 156 pages with per-page word counts; read-only field-population stats over all 223 venueHubs docs plus tenant overlays; per-doc join of stored prose volume against rendered words; a block-by-block template inventory of VenueHubView; and a provenance and similarity analysis of every prose field, including corpus-wide shared-5-gram rates per field.

Baseline correction of scale: venueHubs holds 223 docs (166 verified), 156 in the sitemap behind the indexability floor. The page word count is essentially the stored prose: pearson r = 0.824 between a doc's prose-field characters and its rendered words, fitting words = 317 + 0.224 x proseChars. The template is not the constraint; the harvest depth per building is.

---

## 9a. Field population across the 223 docs

Well-populated (all or most docs):

| Field | Populated | Avg size | Prose-generating today? |
|---|---|---|---|
| slug, name, lat, lng, city, state, verified | 223/223 | short | identity and gates; already rendered |
| sources | 179/223 | 12 URLs avg | per-field source maps; deliberately not rendered (CFB quoted-URL incident precedent) |
| publicTransit | 167/223 | object | rendered via notes; the lines array is swallowed when notes exists (VenueHubView.tsx:226) |
| officialParkingUrls | 162/223 | 2 URLs | NOT in the VenueHub type or mapper; invisible to the web layer |
| accessibility | 160/223 | ~90 words | rendered (Getting in row) |
| parkingLots | 159/223 | 6 lots avg | only lot NAMES render, capped at 8, inside one FAQ sentence; the per-lot notes are dark |
| venueAccessRestrictions | 154/223 | ~75 words | rendered (Entry row) |
| tailgating | 152/223 | object | only .allowed and .rules render; timeWindow, grillRules, rvPolicy are dark (198 stored values) |
| outsideFoodRules | 144/223 | ~43 words | rendered (FAQ) |
| bagPolicyNotes + bag family | 135-143/223 | ~65 words | rendered (capsule lead + full text in bag FAQ) |
| food | 128/223 | ~52 words | rendered (Food card) |
| rideshareDropoff | 106/223 | ~33 words | rendered (row + chip) |

Sparse:

| Field | Populated | State |
|---|---|---|
| parkingLotMapUrl | 102/223 | rendered as a link where present |
| capacity | 73/223 | NEVER rendered anywhere, not even JSON-LD maximumAttendeeCapacity (a free schema field) |
| nearby | 47/223 | NEVER rendered; ~38 words of verified prose per doc sitting dark, 0.1% cross-venue similarity |
| photoUrl | 0/223 | every page gets the charcoal hero |

Prose-generating today without new research: the dark inventory on already-populated docs (parkingLots[].notes at 895 verified values, nearby, tailgating sub-fields, transit lines, capacity). Needing new research (harvest extension, not rendering): the missing tails of food (95 docs), rideshareDropoff (117), nearby (176), bag family (~80), and the 57 unverified docs. Provenance is uniform: all of it is pipeline-harvested from official sources and adversarially verified, not hand-written editorial and not skeleton generation; there are zero exact cross-venue duplicate values across ~2,000 stored prose values.

## 9b. What floor pages lack that ceiling pages have

The floor is thin harvest, not a different template. Bottom pages carry 1-3 of the 7 prose fields (northwest-stadium: 269 words, 2/7 fields, 317 prose chars; mt-bank-stadium: 293 words, 1/7, 165 chars). Top pages carry 5-7 (target-field: 1,467 words, 2,680 chars; citi-field: 1,343 words, 7/7, 3,746 chars). Each populated prose field also unlocks its FAQ topic and fact-band chip, so field coverage compounds: the FAQ card alone spans 70-350 visible words depending on which topics gate open. Pages with under 500 stored prose chars have a median of 293 words; pages with 1,500+ chars have a median of 834. Nothing else meaningfully separates them: chrome, CTA, and card labels are near-constant at roughly 90-120 words.

Two honest measurement caveats: the Plan-your-visit and Tickets cards render twice in served HTML (mobile block plus sticky rail), and every FAQ answer is duplicated into FAQPage JSON-LD, so raw-HTML counts overstate visible unique words by roughly 40-80 per page; and the promos-this-week scroller adds 25-45 words per promo only in-season and churns daily, so no plan should count on it.

## 9c. Realistic per-page ceiling from existing verified data, no new research

Rendering the dark inventory (all of it already verified, sourced, and sitting in the docs):

| Lever | Where | Typical add |
|---|---|---|
| Per-lot parking table using parkingLots[].notes (895 values, median 76 chars, 0.6% shared grams) | ~120 of the 156 | +40 to +90 words |
| nearby paragraph (0.1% shared grams) | ~40 of the 156 | +30 to +45 words |
| tailgating timeWindow / grillRules / rvPolicy | ~half | +10 to +40 words |
| transit lines row alongside notes | many | +5 to +15 words |
| capacity as a fact chip plus JSON-LD maximumAttendeeCapacity | 73 docs | +2 words |

Modeled per page against the actual doc contents: median gain +87 words (p25 +64, p75 +122). **Median page goes from 743 to about 837; the practical data-only ceiling for a well-populated page is roughly 950-1,100.** The stored-prose distribution caps this: only 15 docs hold 3,000+ prose chars, and the fit says clearing 1,000 words under the current content model needs roughly that much.

## 9d. How many clear 1,000, and the 235-of-468 question

Applying the per-doc modeled gains: venue pages at or above 1,000 go from 17 to about 34. Sitewide: 161 becomes about 178 of 468. **No: the data-only tier alone does not cross 235 of 468.** The gap after data-only is 57 more pages sitewide. The venue path to close it entirely: the 91st-best venue page lands at about 775 words post-data-only, so getting 74 additional venue pages over 1,000 requires roughly 150-250 more words each (median shortfall 239). That is harvest-extension territory, not rendering: deeper per-building extraction through the existing pipeline machinery (history, gameday flow, neighborhood logistics from official sources, verified like everything else). Denominator warning: resuming the CFB venue extraction (66 unbuilt buildings) ADDS pages at likely sub-1,000 depth, growing 468 toward 534 and moving the share the wrong way; sequence it after the thickening if the 50% share is the active gate.

## 9e. Similarity risk, quantified, and how it is avoided

The risk is real and measurable. Today's 3.4% comes from a few fixed template sentences (the parking FAQ's fixed second sentence, FAQ question skeletons, bag-answer case skeletons shared within a clearBagRequired class) plus genuine data convergence in league-uniform policies (bagPolicyNotes is the worst field at 6.7% corpus-shared grams; gate ruleText 6.0%; every other field 0.1-1.9%). The counterfactual is measured in this same codebase: the CFB school pages, which ARE fixed-skeleton generation, sit at 26.8%. Modeled: a naive 100-word skeleton-generated block across 156 pages roughly doubles pairwise similarity to ~8%; a 300-word skeleton block pushes toward 15-20%, the CFB regime, and hits the thin floor pages hardest. Capacity is the sharpest trap: a "seats {capacity} fans" sentence is one slot in an otherwise fixed string.

How the plan avoids it:

1. The spine is dark harvested prose, not generation: parkingLots notes, nearby, and tailgating sub-fields measure 0.1-0.8% shared grams because each was written from that building's own sources.
2. Where template sentences are unavoidable, keep every fixed word-run under 5 words so no complete 5-gram is template-only (slot-dominant sentences).
3. Key any sentence-shape variants deterministically on the data (lot-count bucket, transit mode, capacity bucket), never on randomness, so they survive rebuilds; and treat variants as a supplement to slot density, not a substitute.
4. Suppress generation entirely where the structured value is league-uniform (30 NFL buildings share identical clear-bag rules); quote the building's own bagPolicyNotes instead.
5. Thicken the body, not the FAQ: FAQ answers are deliberately skeletal for standalone-answer quality and are duplicated into JSON-LD.
6. Regression gate: the 5-gram document-frequency tool built for this audit runs after any thickening pass; a pairwise sample above ~5% on venue pages fails the pass.

## 9f. Hours, split

| Work | Type | Estimate | Outcome |
|---|---|---|---|
| Render the dark inventory (per-lot table, nearby, tailgating sub-fields, transit lines, capacity chip + schema field) | Pipeline-generatable (template eng, one-time) | 16-32 hrs | median 743 to ~837; venue >=1000 from 17 to ~34; sitewide 161 to ~178 |
| Similarity regression gate wired into the audit flow | Pipeline-generatable | ~2 hrs | protects 3.4% |
| Harvest extension on the ~74 pages nearest the line (+150-250 verified words each) | Editorial/harvest (pipeline-assisted, human-verified) | 0.75-1.5 hrs/page = 55-110 hrs | venue >=1000 to ~91; sitewide ~235 of 468, the gate |
| Full-corpus harvest extension (all 139 sub-1000 venue pages) | Editorial/harvest | 140-210 hrs | not required for the gate |

The venue path to the 235 gate is therefore roughly **20-35 pipeline hours plus 55-110 harvest-extension hours**, against the CFB alternative (audit/cfb-content-remediation.md) which cannot serve this gate at any data-only cost and needs 165-270 editorial hours to reach only 550-650 words. Venue pages are the right vehicle: the harvest machinery, verification protocol, per-field sourcing, and low-similarity house style already exist, and 74 pages need topping up rather than 86 needing creation.

---

Method note: word counts from a 2026-08-14 crawl of all 156 sitemap venue pages (extraction matching audit/raptive-page-mix.ts); field stats and per-doc joins from read-only firebase-admin queries the same day; block inventory and provenance from source at the cited file:line locations plus corpus-wide shared-5-gram probes per field. One data hygiene note found in passing: a single doc's sources map has URL-as-key rows (the Mariners guide), cosmetic but worth knowing before any script consumes sources maps programmatically.
