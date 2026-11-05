# Venue bag data: pipeline ticket (2026-11)

Filed 2026-11-05 from promonight-web `feature/serp-targeting` (Gate 1 and Gate 2 of the
search targeting rework). Owner: OPS, promo-pipeline. **No Firestore write was made
from the web side.** Every count below is measured on the venueHubs + tenants
collections as read on 2026-11-05, after the web's own gates (verified, per-field
provenance, `fieldStates`, the exclusion lists).

Why it matters now: the venue bag-policy template renders only what the sourced
layer holds. Each gap below is a fact a high-demand page cannot show, or shows
less well, until the data carries it. Rules that apply to every item:
EXTRACTION-RULES sections 2 (sourcing) and 3 (freshness). Nothing comes from the
legacy `venues/{id}` prose or the amenities subcollection.

## 1. truist-park: a stored contradiction

`venueHubs/truist-park` stores `bagsProhibited: true`, `clearBagRequired: false`
and `bagMaxDimensions: {w: 5, h: 9, d: null}`. The 5 x 9 figure is the clutch and
clear-bag EXCEPTION size in the notes ("small single-compartment clutches or clear
bags no larger than 5 x 9 inches"), not a size limit for bags in general, which the
same notes say are not allowed at all. Source:
https://www.mlb.com/braves/ballpark/information/guide

Effect before the web fix: the fact band printed "MAX BAG 5 x 9" beside "NO BAGS
ALLOWED". The web now never labels the size on a no-bag building (chip and answer
block), but the record itself still says a 5 x 9 maximum.

Ask: decide the record shape for a no-bag building with sized exceptions. Either
null `bagMaxDimensions` and keep the size in the notes, or add a separate field for
the exception size (see item 5). Do not leave a general size limit on a building
whose policy is a bag ban.

## 2. A sourced `clearBagRequired` for united-center, yankee-stadium, ball-arena

All three carry a sourced size limit and a null `clearBagRequired`, so the page
cannot say whether a clear bag is required. They are the top-volume pages in the
measured demand (Ahrefs US monthly volume for "{venue} bag policy": united center
8,500, yankee stadium 4,200, ball arena in the 3,100 to 3,300 bracket).

- united-center: notes read "Guests are able to enter the arena with a small purse
  or personal bag up to 10x6x2." Source:
  https://www.unitedcenter.com/venue/frequently-asked-questions/
- yankee-stadium: notes read "One soft-sided MLB-compliant bag no larger than 16 x 16
  x 8 inches plus one smaller soft-sided personal item". Source:
  https://www.mlb.com/yankees/ballpark/information/policies#bag-policy
- ball-arena: notes read "Bags, purses, backpacks, briefcases, and luggage are
  prohibited. Clutches, wristlets & fanny packs 4in x 6in x 1.5in are permitted."
  Source: https://www.ballarena.com/plan-your-visit/bag-policy/ . Note that this
  reads as a bag ban with a sized exception, the same shape as item 1, so it may
  want `bagsProhibited` rather than a clear-bag boolean.

Ask: set `clearBagRequired` (or `bagsProhibited` where the policy is a ban) from the
operator's own statement, with `sources.<field>`, a confirmation type and an
`observedAtByField` stamp. Rule 2.1 applies: no inference from a league norm.

The same gap exists on 40 eligible buildings in total (a sourced size limit, no
sourced clear-bag rule, no prohibition). The three above come first by demand. The
full list: alumni-stadium, ball-arena, bridgestone-arena, busch-stadium, canada-life-centre, casino-del-sol-stadium, centre-bell, coca-cola-coliseum, coors-field, daikin-park, fiserv-forum, gainbridge-fieldhouse, gerald-j-ford-stadium, great-american-ball-park, hard-rock-stadium, husky-stadium, joan-c-edwards-stadium, jones-stadium, kaseya-center, kia-center, los-angeles-memorial-coliseum, nationwide-arena, ohio-stadium, pnc-park, ppg-paints-arena, pratt-whitney-stadium-at-rentschler-field, progressive-field, prudential-center, rogers-centre, rogers-place, sap-center, saputo-stadium, scotiabank-saddledome, smoothie-king-center, spartan-stadium-east-lansing-michigan, toyota-center, toyota-stadium, ubs-arena, united-center, yankee-stadium.

## 3. Verify spectrum-center

`venueHubs/spectrum-center` is `verified: false`, so the page shows the held state,
although its `bagMaxDimensions` (5 x 7 x 1.5), `clearBagRequired` (false) and
`bagPolicyNotes` each carry a source and an `observedAtByField` stamp of
2026-10-07. "spectrum center bag policy" is in the 3,100 to 3,300/mo bracket (Ahrefs, US). Source:
https://www.spectrumcentercharlotte.com/plan-your-visit/a-z-guide

Ask: run the verify pass. If it clears, flip `verified`. The web side needs no
change; the building becomes eligible for the bag template on the next
revalidation. The other 29 unverified buildings stay where they are.

## 4. `observedAtByField` for bag fields

The page prints "Last verified {date}" only from a bag field's own
`observedAtByField` stamp, never from the doc-level `verifiedAt` (the venue-claim
rule). Of the 164 buildings on the bag template, 26 carry a stamp on at least one
bag field and 22 show a date (the other four have their stamp on a field the
block does not show). **138 carry no bag stamp at all.** Of those, 115 are the
Gate 1 "state 1" buildings (sourced size and clear-bag rule).

Ask: on the next read of each building's bag-policy page, stamp `observedAtByField`
for `bagMaxDimensions`, `clearBagRequired`, `bagsProhibited` and `bagPolicyNotes`
with the time that page was READ, from the harvest. A backfill that writes one
timestamp across fields at write time is the defect `claimSourceReadOn` exists to
refuse (eight buildings carried 55 fields sharing two stamps 1 ms apart before
2026-09-04). The 138: acrisure-stadium, albertsons-stadium, allegacy-federal-credit-union-stadium, allegiant-stadium, alumni-stadium, american-family-field, americas-first-field, angel-stadium, arrowhead-stadium, att-stadium, audi-field, bank-of-america-stadium, bc-place, ben-hill-griffin-stadium, bmo-field, bmo-stadium, bobby-dodd-stadium, busch-stadium, caesars-superdome, california-memorial-stadium, camden-yards, camp-randall-stadium, carter-finley-stadium, casino-del-sol-stadium, centre-bell, chase-center, chase-field, chase-stadium, childrens-mercy-park, citi-field, citizens-bank-park, climate-pledge-arena, coca-cola-coliseum, college-park-center, comerica-park, coors-field, cotton-bowl-stadium, crypto-com-arena, daikin-park, darrell-k-royal-texas-memorial-stadium, david-booth-kansas-memorial-stadium, dicks-sporting-goods-park, dignity-health-sports-park, dodger-stadium, donald-w-reynolds-razorback-stadium, empower-field, energizer-park, entertainment-sports-arena, everbank-stadium, exploria-stadium, faurot-field, fenway-park, firstbank-stadium, footprint-center, ford-field, gainbridge-fieldhouse, geodis-park, gerald-j-ford-stadium, gillette-stadium, globe-life-field, great-american-ball-park, guaranteed-rate-field, hard-rock-stadium, huntington-bank-field, huntington-bank-stadium, husky-stadium, jack-trice-stadium, joan-c-edwards-stadium, jones-stadium, kauffman-stadium, kenan-stadium, kidd-brewer-stadium, kinnick-stadium, kroger-field, lambeau-field, lane-stadium, levis-stadium, lincoln-financial-field, little-caesars-arena, loandepot-park, los-angeles-memorial-coliseum, lower-com-field, lucas-oil-stadium, memorial-stadium-clemson, mercedes-benz-stadium, metlife-stadium, michelob-ultra-arena, moda-center, nationals-park, neyland-stadium, nissan-stadium, northwest-stadium, notre-dame-stadium, nrg-stadium, ohio-stadium, oracle-park, paycor-stadium, petco-park, pnc-park, pratt-whitney-stadium-at-rentschler-field, progressive-field, providence-park, q2-stadium, red-bull-arena, rice-eccles-stadium, rogers-centre, rose-bowl-stadium, ross-ade-stadium, saban-field-at-bryant-denny-stadium, scott-stadium, secu-stadium, shell-energy-stadium, shi-stadium, snapdragon-stadium, sofi-stadium, soldier-field, spartan-stadium-east-lansing-michigan, state-farm-arena, state-farm-stadium, subaru-park, t-mobile-park, target-center, target-field, td-garden, tiger-stadium-louisiana, toyota-stadium, tql-stadium, tropicana-field, truist-park, us-bank-stadium, valley-childrens-stadium, vaught-hemingway-stadium, wallace-wade-stadium, williams-brice-stadium, wintrust-arena, wrigley-field, yankee-stadium, yulman-stadium.

## 5. Proposal: structured sourced fields for the bag sub-topics

Today the web answers diaper, purse, backpack, medical, camera, clutch and storage
questions by QUOTING the matching sentence of `bagPolicyNotes` or a tenant's
`bagPolicyException` verbatim (ruling 2026-11-05, item 3). That is safe, because a
quote is an exact substring of a sourced field, but it has limits a structured field
would not:

- a run-on sentence answers several topics at once and reads poorly as an answer;
- a topic the notes never mention gets no question, even where the source page
  covers it;
- the matching is lexical. Two false-positive classes were measured and excluded on
  the web side: "plastic storage bag" (an approved bag, nine buildings) read as bag
  storage, and "Yosef's Locker" (a shop) read as a locker.

Measured coverage on the 164 template buildings (topic questions rendered): clutch
88, diaper 80, medical 78, backpack 67, purse 65, storage 52, camera 27.

Proposed fields, each with `sources.<field>`, a confirmation type under rule 2.4,
and an `observedAtByField` stamp:

| Field | Type | Meaning |
|---|---|---|
| `clutchMaxDimensions` | `{w, h, d, unit}` or null | the small-bag allowance beside the main rule |
| `diaperBagRule` | short string, quoted from the source | allowed / size / inspection |
| `purseRule` | short string | as above |
| `backpackRule` | short string | as above |
| `medicalBagRule` | short string | as above |
| `cameraBagRule` | short string | as above |
| `bagStorage` | `{available: boolean, text: string}` or null | where an oversized bag can go |

The strings should be the operator's own sentence, as the notes are now, so the
web can keep the substring guarantee. When these exist, the web switches the
topic answers from sentence matching to the field and keeps the quote as the
fallback.

Concerts vs games was dropped from the web build (ruling 2026-11-05): one building's
notes mention a non-game distinction. It is not proposed as a field.
