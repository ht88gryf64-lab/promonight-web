# Exclusion mechanisms by consumer: the whole shape

Report. 2026-08-29. **Nothing in this document is fixed.** It exists because
three surface-escape defects had been found one at a time and treated as
one-offs, and the shape mattered more than the fourth instance.

Method: every consumer file that reads a gated venue field was read in full,
independently, and its findings then verified against the live corpus. Two
claims in the first reading did not survive measurement and are corrected below.

## The short version

**28 gated fields x 11 consumers. No cell can see any other cell.** Gating is a
property of the RENDER SITE, not of the value, so each consumer re-derives "may
I publish this?" from five independent inputs. Twelve consumers render a field
with fewer gates than a sibling does. Two of those are live today; the rest are
armed and waiting for the first exclusion entry of the right shape.

**The one live, reader-visible divergence** is the venue page's own fact band:
`VenueHubView` scrubs `clearBagRequired` for provenance at line 149 for the FAQ,
then reads it RAW at line 223 for the chip. The same component publishes a bag
claim in one place that it withholds in another, and both reads look correct in
isolation.

I verified the reading against the live corpus (read-only probes against Firestore from `/Users/mattkovalik/promonight-web-esc`, branch `feature/surface-escape`, 2026-08-29; temp probe scripts deleted, worktree left as found). Two claims in the input reading do not survive measurement — noted inline.

---

# 1. MATRIX — gate coverage by field and consumer

**Consumers.** `VIEW` = `src/components/venue-hub/VenueHubView.tsx` (venue page body, chips, FAQ, JSON-LD) · `LOG` = `src/components/venue-hub/venue-logistics.tsx` (`buildGettingInRows`, `BagCard`, `ParkingLotsCard`, `VenueLogisticsBlock`) · `COND` = `src/lib/venue-hub-condensed.ts` (CFB school pages via `CfbSchoolPage.tsx:291`) · `DESC` = `venueHubDescription` (`src/lib/venue-hub.ts:951-1010`; meta + StadiumOrArena description) · `TILE` = `getVenueUtilityCounts` (`venue-hub.ts:496-527`; homepage counts) · `BAGP` = `src/lib/venue-bag-policies.ts` + `/venues/bag-policies` · `NFL` = `src/app/nfl/page.tsx:150-166` · `JSONLD` = `VenueHubJsonLd.tsx` · `MAP-H` = `getVenueHub` mapper · `VIB` = `src/components/venue-info-block.tsx` (venues corpus) · `MAP-V` = `getVenueForTeam` (`data.ts:397-458`).

`⚠` = this consumer renders the field with fewer gates than its siblings. `—` = gate does not exist for this field. `(ruling)` = COND omits `verified` on every field by an explicit, test-locked ruling (see section 3).

## A. venueHubs — claims

| Field | fieldExcluded | subFieldExcluded | transitSuppressed | provenance | reachability | verified | redactClause | Shortfall |
|---|---|---|---|---|---|---|---|---|
| `bagMaxDimensions` | VIEW(FAQ/card), COND, BAGP, DESC, TILE | — | — | VIEW, LOG, COND, BAGP, DESC, TILE | — | VIEW, LOG(caller), BAGP, DESC, TILE | — | ⚠ VIEW chip band (`:222-225`) no `fieldExcluded`; ⚠ `VenueLogisticsBlock` (`LOG:334-339`) no `fieldExcluded`; COND no verified (ruling) |
| `clearBagRequired` | same as above | — | — | VIEW FAQ(`:149`), LOG(`:272`), COND(`:104`), BAGP(`:296`), DESC(`:982`), TILE | — | same as above | — | **⚠ VIEW chip label (`:223`) reads it RAW — no provenance, no fieldExcluded** |
| `bagsProhibited` | same | — | — | VIEW FAQ(`:150`), LOG(`:273`), COND(`:105`), BAGP(`:299`), DESC(`:983`), TILE | — | same | — | ⚠ VIEW chip (`:224`) no provenance, no fieldExcluded |
| `bagPolicyNotes` | VIEW, LOG, COND, BAGP | VIEW(`:155`), LOG(`:277`), COND(`:107`) | — | all four | — | VIEW, LOG(caller), BAGP(loader) | — | **⚠ BAGP (`venue-bag-policies.ts:302`) no `subFieldExcluded('bag','notes')` — 4th consumer, 3 siblings apply it** |
| `gatesOpen.ruleText` (overlay) | VIEW, LOG, COND, DESC, TILE, NFL | — | — | all (overlay `sources`) | — | overlay: all. **doc-level:** LOG(`:106`), VIEW chip(`:233`), DESC(`:964`), TILE(`:496`), NFL(`:150`) | — | **⚠ VIEW gates FAQ (`:181-190`) omits doc-level `verified`**; COND omits both (ruling) |
| `gatesOpen.minutesBefore` | via gate set | — | — | via ruleText (by design) | — | VIEW(`:233`) | — | none |
| `gateVariance` (overlay) | via gate set | — | — | **nobody** | — | LOG(`:106`) | — | **⚠ LOG(`:114-117`) renders it on ruleText's provenance; no own-key test anywhere** |
| `bagPolicyException` (overlay) | inherited | — | — | **nobody** | — | VIEW(`:138`), BAGP loader(`:32`) | — | uniform bare spot, not a divergence |
| `tailgateWindow` (overlay) | VIEW via `planYourVisitTailgateTenants` | — | — | LOG(`:171`) | — | LOG(`:170`) | — | none (this is fixed defect (b)) |
| `tailgating.allowed` | LOG(`:141`), COND(`:128`) | — | — | LOG(rules OR allowed), COND(own key) | — | LOG(`:140`) | — | COND ruling only |
| `tailgating.rules` | LOG, COND | — | — | COND(`:135`, own key) | — | LOG | — | **⚠ LOG(`:148`) publishes on `rules` OR `allowed` — a sibling key vouches** |
| `tailgating.timeWindow` | LOG, COND | — | — | COND(`:137`, own key) | — | LOG | MAP-H(`:223`) both | ⚠ LOG rides on rules/allowed |
| `tailgating.grillRules`, `.rvPolicy` | LOG | — | — | **nobody** | — | LOG | — | bare spot; COND deliberately omits the fields, so no sibling |
| `parkingLots[].name` | VIEW(`:202`), LOG(`:199`), COND(`:114`), DESC/TILE(`rendersParking`) | VIEW(`:198`), LOG(`:199`), COND(`:115`), DESC/TILE | — | all | — | VIEW, LOG, DESC, TILE, NFL | — | COND ruling only |
| `parkingLots[].notes` | LOG, NFL | LOG, NFL | — | LOG, NFL | — | LOG, NFL | MAP-H(`:198-202`) | **⚠ TILE builds `facts` from the RAW doc (`venue-hub.ts:507-514`), bypassing the mapper's redaction** |
| `publicTransit.lines` / `.notes` | LOG(`:125`), COND(`:143`), DESC(`:966`), NFL(`:163`) | — | LOG, COND, DESC, NFL, VIEW, TILE | LOG(`:126-127`), COND(`:146-147`), DESC(`:967`), NFL(`:164`) | — | LOG, VIEW, DESC, TILE | — | **⚠ VIEW TRANSIT chip (`:238`) has verified+suppression only; ⚠ TILE (`:522`) has verified+suppression only** |
| `rideshareDropoff` | LOG, VIEW, COND | — | — | LOG(`:139`), VIEW(`:244`), COND(`:151`) | — | LOG, VIEW | — | COND ruling only |
| `accessibility` | LOG(`:156`), COND(`:152`) | — | — | LOG, COND | — | LOG | MAP-H(`:214`) | COND ruling only |
| `venueAccessRestrictions` | no key in the union | — | — | LOG(`:157`) | — | LOG | — | not gateable by schema |
| `outsideFoodAllowed` | VIEW, LOG, COND | — | — | all three, cross-key OR (consistent) | — | VIEW, LOG | — | COND ruling only |
| `outsideFoodRules` | VIEW, LOG, COND | — | — | COND(`:158`, own key) | — | VIEW, LOG | — | **⚠ VIEW FAQ(`:168`) publishes the prose on `outsideFoodAllowed`'s source** |
| `food` (concessions prose) | LOG(`:248`), COND(`:163`), DESC(`:969`) | — | — | all three | — | LOG, DESC | — | COND ruling only |
| `nearby` (venue prose) | LOG(`:258`), COND(`:164`) | — | — | LOG, COND | — | LOG | — | COND ruling only |
| `capacity` | no key exists | — | — | **no key exists corpus-wide** | — | VIEW chip(`:249`) | — | **⚠ JSONLD (`VIEW:395` → `VenueHubJsonLd.tsx:48-50`) ships it with no `verified`** |
| `name`, `city`, `state`, `lat/lng`, `photoUrl`, `photoAttribution` | — | — | — | — | — | — | — | ungated everywhere; corpus norm, not a gap |

## B. venueHubs — pointers (reachability, never provenance)

| Field | fieldExcluded | subFieldExcluded | provenance | reachability | verified | Shortfall |
|---|---|---|---|---|---|---|
| `bagPolicyUrl` | VIEW(`:125`), LOG(`:284`), COND(`:109`), BAGP(`:301`), `rendersBag` | — | correctly none | VIEW, LOG, COND, BAGP, TILE | VIEW, LOG, BAGP | none in this corpus |
| `parkingLotMapUrl` | VIEW(`:339`), COND(`:116`), `rendersParking` | nobody (sub key exists in the type; shared hole, no entries) | correctly none | VIEW anchor(`:339`), COND(`:116`), `rendersParking` | VIEW, DESC | **⚠ DESC(`:989`) and ⚠ VIEW(`:309`) test bare truthiness** |
| `officialParkingUrls` | LOG(`:201`), COND(`:117`), `rendersParking` | LOG, COND, `rendersParking` | correctly none | LOG(`:203`), COND, `rendersParking` | LOG | none |

## C. venues corpus (separate collection; `VIB` on team pages, `my-teams` API, weekly digest)

`verified` and `provenance` are **structurally unavailable** here — the `venues` docs carry no `sources` map (probe: true on all 148) and the `Venue` type has no `verified` field. Only `fieldExcluded`/`reachability`/`redactClause` are claimable.

| Field | Gate applied | Sibling (venueHubs) applies | Shortfall |
|---|---|---|---|
| `parkingInfo` | `redactClause` @ MAP-V(`:449`) | hub `parking` exclusion scopes to structured fields only | none claimable |
| `accessibility` | `redactClause` @ MAP-V(`:453`) | LOG(`:156`): verified+provenance+fieldExcluded | ⚠ `fieldExcluded('accessibility')` (latent) |
| `nearby` | `nearbySilenced` (3 slugs) @ MAP-V(`:456`) | LOG(`:258`): +fieldExcluded | ⚠ `fieldExcluded('nearby')` (latent, no entries) |
| `bagPolicyUrl` | `bagPolicyUrlFor` repoint @ MAP-V(`:452`) | every hub consumer: `isReachableUrl` + `fieldExcluded` | ⚠ reachability, ⚠ fieldExcluded (both latent) |
| `address`, `name` | none | none | outside every regime; not a gap |

---

# 2. RANKED GAP LIST

Ranked by whether a stored value reaches a reader **today**. Counts are measured, not inferred.

### LIVE — a stored value is reaching a reader right now

**1. `clearBagRequired` → `VenueHubView.tsx:223`, missing `provenance` (and `fieldExcluded`).**
`{ k: hub.clearBagRequired ? 'CLEAR BAG' : 'MAX BAG', v: dimStr }` reads the raw boolean. Live on **1 of 166 verified hubs: `hard-rock-stadium`** (verified, above the index floor, fact band renders — chips are `CLEAR BAG | RIDESHARE | CAPACITY`). Its `sources` map carries `bagMaxDimensions`, `bagPolicyUrl`, `bagPolicyNotes`, `publicTransit` — and **no `clearBagRequired` key**, while the stored value is `true`.
*What the reader sees:* the page's headline bag fact reads **CLEAR BAG 12" x 6" x 12"** in the fact band, while the bag capsule below it is labeled **MAX BAG SIZE** (`bagCapsule` gets the provenance-scrubbed `null`) and the FAQ silently drops *"Does Hard Rock Stadium require a clear bag?"* — the question is omitted precisely because no source said so. One page, three surfaces, the strictest two withhold and the loudest publishes. The file's own comment at `:143-145` names this building as the unsourced case and then the chip 78 lines later reads the field raw.

**2. `capacity` → `VenueHubView.tsx:395` → `VenueHubJsonLd.tsx:48-50`, missing `verified`.**
Live on **9 held buildings**: `michigan-stadium` (107,600), `sanford-stadium` (93,033), `doak-campbell-stadium` (67,277), `autzen-stadium` (54,000), `acrisure-bounce-house` (44,206), `bridgeforth-stadium-and-zane-showker-field`, `ln-federal-credit-union-stadium`, `martin-stadium-northwestern-university`, `navy-marine-corps-memorial-stadium`. All render a page (`/venues/[slug]` `notFound`s only on a missing doc; held buildings serve `noindex, follow`).
*What the reader sees:* a page whose visible copy says *"We are still confirming gameday details"* and shows no fact band, shipping `maximumAttendeeCapacity` inside `StadiumOrArena` structured data. The identical value is withheld from the chip 146 lines earlier.

**3. `gateVariance` → `venue-logistics.tsx:114-117`, missing own-key `provenance`.**
Live on **1 building: `notre-dame-stadium`**. The overlay's `sources` map has `gatesOpen`, `parkingPrice`, `tailgateWindow` — no `gateVariance`, although the schema documents that key.
*What the reader sees:* a second sentence appended to the Gates row (*"General stadium gates open 90 minutes before kickoff; premium and hospitality doors open 2 hours (120 minutes) before kickoff."*) vouched for only by the source behind a different field. This is a **bare spot, not an escape** — no sibling renders `gateVariance` at all — so it ranks below the two above on class, above everything below on reachability.

### ARMED — the exclusion entry exists today; only a data accident keeps the value out

**4. `bagPolicyNotes` → `venue-bag-policies.ts:302`, missing `subFieldExcluded(slug,'bag','notes')`.**
The live entry (`providence-park`, 2016 club bag rules) exists **now** and is honored by all three siblings (`VenueHubView:155`, `venue-logistics:277`, `venue-hub-condensed:107`). `fieldExcluded` cannot see it (`venue-field-exclusions.ts:102` requires `!e.sub`). Blocked only by the loader's MLB-tenant filter (`venue-bag-policies-data.ts:20-23`); Providence Park is MLS, measured `MLBtenant=false`.
*What a reader would see:* the withheld ten-year-old note re-derived by `parseClutch` into a gold **"up to 4.5" x 6.5""** clutch chip on `/venues/bag-policies` — a withheld claim republished as a *derived allowance*, which is worse than the verbatim text. Arms on any MLB-tenant `bag/notes` entry. `venue-bag-policies-rules.test.ts:29` selects only entries with `!c.sub`, finds none, and passes on its else-branch, so nothing pins it.

### LATENT — the wiring is absent, the data does not currently reach it

**5. bag facts (`bagMaxDimensions`, `clearBagRequired`, `bagsProhibited`) → VIEW chips (`:222-225`) and `VenueLogisticsBlock` (`:334-339`), missing `fieldExcluded('bag')`.** Zero whole-field `bag` entries today (the only one is sub-scoped), and `VenueLogisticsBlock` is exported but mounted nowhere in `src`. Arms the moment a whole-`bag` exclusion is filed. *Would show:* dimensions in the fact band on a building whose bag capsule was withheld for cause.

**6. `publicTransit.lines/.notes` → VIEW TRANSIT chip (`:238`) and TILE (`venue-hub.ts:522`), missing `provenance` + `fieldExcluded('transit')`.** **Measured 0 live instances** — this corrects the input reading. `secu-stadium` was re-sourced in the Pass 2 write, and the other apparent cases (`busch-stadium`, `coors-field`, `guaranteed-rate-field`, `progressive-field`) store their transit source as an **array of URLs**, which `stringMap` (`venue-hub.ts:144-155`) normalizes to the first URL — so they are sourced. *Would show:* a derived mode claim ("Rail", "Rail + bus" — `transitMode` keyword-scans the stored text) in the fact band, and a `+1` in the homepage "Transit — N venues" tile, on a building whose own Getting-in row is dark.

**7. `gatesOpen.ruleText` → VIEW gates FAQ (`:181-190`), missing doc-level `verified`.** **Measured 0 held buildings with a verified+sourced gates overlay.** Highest *structural* severity in the list and lowest reachability: it is the un-fixed copy of fixed defect (a). `verifiedGateTenants` gates the overlay, `buildGettingInRows:106` adds `verified ? gateTenants : []` for the row, `VIEW:233` adds it for the chip, `DESC:962` adds it — the FAQ, which lands in both the DOM and `FAQPage` JSON-LD, does not. *Would show:* "When do gates open at X?" answered in structured data directly beside the "still confirming gameday details" notice. `render-gates.test.tsx:137` asserts only that the rows go dark.

**8. `outsideFoodRules` → VIEW FAQ (`:163-172`), cross-key provenance.** **Measured 0** after `stringMap` normalization (`coors-field`'s array-valued `outsideFoodRules` source resolves). *Would show:* unsourced rules prose inside `FAQPage` JSON-LD that `venue-hub-condensed.ts:158` withholds on the school page.

**9. `tailgating.rules` / `.timeWindow` → `venue-logistics.tsx:140-148`, field-grain instead of sub-grain provenance.** **Measured 0**: 14 hubs carry dotted-only tailgating sources, none has a populated sub-field lacking its own dotted key. *Would show:* an unsourced lot-open window on the venue page that the school page withholds.

**10. `parkingLotMapUrl` → `DESC:989` and `VIEW:309`, missing `reachability`.** **Measured 0 malformed** stored values. *Would show:* a meta description and JSON-LD promising "see the official lot map", and a card sentence saying "Use the official lot map below", pointing at a link the page does not render.

**11. `parkingLots[].notes` → TILE (`venue-hub.ts:507-514`), bypassing the mapper's `redactClause`.** Both `parkingLots` redactions (`dignity-health-sports-park`, `milan-puskar-stadium`) remove a clause and leave the note non-empty, so the count is unchanged. *Would show:* a homepage count including a building whose lot facts the page no longer publishes.

**12. venues corpus → `venue-info-block.tsx` (mounted on team pages, `AffiliateRail`, world-cup host cards): `bagPolicyUrl` missing `reachability` (0 of 86 stored URLs malformed) and `fieldExcluded('bag')`; `accessibility` missing `fieldExcluded` (only entry `sanford-stadium`, a CFB building no pro page resolves); `nearby` missing `fieldExcluded` (no entries).** All latent. The cross-corpus claim is legitimate — `types.ts` documents the shared id namespace as "what lets a withholding decision recorded against a hub apply to this corpus too" — but nothing today exercises it.

---

# 3. REAL GAPS vs NON-GAPS

**Real (items 1-12 above).** Every one is a *render site* that reads a stored value and applies fewer gates than another render site reading the same field.

**Not a gap — deliberate, documented, test-locked divergence.** `venue-hub-condensed.ts` omits `verified` at both grains on **every** field. This is a ruling, not an oversight: the file header (`:5-10`) says "Not the index floor, not the doc-level verified flag, not the tenant's verified flag", `CfbSchoolPage.tsx:285` repeats it, and `venue-hub-condensed.test.ts:34-42` fixes `verified:false` on the doc *and* the overlay and asserts all ten lines still render. The input reading files ten `missingGate: verified` entries against this file; none is a defect. It matters for section 4: any parity control must allowlist this consumer **by name**, because it is the one place where "withheld there, published here" is intended.

**Not a gap — no gates because the object arriving is already gated.** `CondensedLogisticsBlock` (`venue-logistics.tsx:357-396`) renders the `CondensedLine[]` the caller built; `NflWeekContainer.tsx:171/213` renders strings `nfl/page.tsx` already gated; `GamedayUtilityGrid`, `email.ts`, `promo-helpers.ts`, `venue-overrides.ts` read no gated field. A consumer with no gates that reads an already-gated object is not a gap.

**Not a gap — mapper, not a render site.** `getVenueForTeam` (`data.ts:397-458`) and `getVenueHub` (`venue-hub.ts:160-240`) *are* the gate point that "gated-upstream-at-mapper" names. `publicTransit` and `gatesOpen` are not merely gated out of the venues corpus, they are removed from the `Venue` type (`types.ts:218-223`) so the compiler forbids reading them — which is why `venuesTransitSuppressed()` has no production caller.

**Not a gap — name collisions.** `food` (venueHubs concessions prose) is not the promo category `food`. `nearby` (venue prose) is not geo nearby-teams. `nearbySilenced` is keyed to `venues` doc ids and does not transfer to the hub field; `bagPolicyUrlFor`/`BAG_URL_REPOINTS` is a venues-corpus repoint, not a hub suppression. Neither absence is a gap.

**Not a gap — no gate exists to miss.** `venueAccessRestrictions` is not in the `FieldExclusion['field']` union. `capacity` has no provenance key anywhere in the corpus (`cfbVenues` carries `capacityVerified`/`capacitySources` instead), so only `verified` is claimable against it — which is exactly item 2. `name`, `city`, `lat/lng`, `photoUrl`, `address` are ungated on every consumer.

**Not a gap — the weekly digest's `anchorCity`.** `getSchemaLocationsForTeams` reads `venues.address` raw and the digest renders the parsed locality as "Happening around {city} this week". `address` sits outside every gating regime, and the sibling (`scored-jsonld.tsx:119`) renders `addressLocality` ungated too. Correctly filed as a second ungated door into that collection, not a divergence.

**Measurement trap worth recording.** `hasProvenance` runs on `stringMap`-normalized sources; **45 provenance values in the corpus are stored as arrays of URLs**, which `stringMap` collapses to the first URL. Any audit that reads raw Firestore docs will score those fields as unsourced and manufacture false live gaps — it produced two in the input reading (`secu-stadium` transit, `coors-field` outside-food). Audit through `stringMap`, never through `doc.data().sources`.

---

# 4. STRUCTURAL STATEMENT

**The property.** Gating is a property of the **render site**, not of the **value**. `getVenueHub` hands every consumer the raw stored values plus a `sources` map, and each consumer re-derives "may I publish this?" at the point of use from five independent inputs (`hub.verified`, `sources`, `venue-field-exclusions`, `venue-transit-suppression`/`venue-corpus-silence`, `isReachableUrl`). The number of places that must agree is fields × consumers — roughly 28 × 8 — and no cell can see any other cell. Three things compound it:

1. **The predicate has no name.** "The full gate set for `bagMaxDimensions`" is spelled out longhand at six sites across four modules. `rendersBag`/`rendersParking`/`rendersGates`/`rendersFood` are the partial extraction, but they answer only *does this building have a renderable fact* (for counts and meta), never *what value may I hand the renderer* — and only 3 of 8 consumers call them.
2. **Summaries are computed from the hub, not from the gated output.** The TRANSIT chip calls `transitMode(hub.publicTransit)` instead of reading the Getting-in row it duplicates; the utility tile re-derives `facts` from the raw doc instead of the mapped hub; the JSON-LD takes `capacity` from the hub instead of the chip set. A summary derived from the source rather than from the published view can only ever drift toward publishing more.
3. **The same field is read twice at different strengths inside one file.** `VenueHubView` scrubs `clearBagRequired` for provenance at `:149` and reads it raw at `:223`; it gates `parkingLotMapUrl` on `isReachableUrl` at `:339` and on bare truthiness at `:309`. Even file-local review does not catch this, because both reads look correct in isolation.

That is why every fix so far has been a new *site* rather than a new *rule*: card→FAQ (a), getting-in card→plan card (b), capsule→FAQ→condensed (c), and now capsule→chip in the same component.

**The single control.** Make the gate a property of the value: have `getVenueHub` return a **published view** in which every claim field is already `null` unless its full gate set passes (`verified` + own-key provenance + `fieldExcluded`/`subFieldExcluded` + suppression + `redactClause`), with the raw doc reachable only through one explicitly-named escape hatch that `buildCondensedLogistics` — the single sanctioned divergence — is the only caller of. Then "renders with fewer gates than a sibling" stops being expressible: a chip and an FAQ reading `hub.clearBagRequired` cannot disagree, because there is one value.

**If that is too large, the smaller control that would have caught all four defects and every item in section 2:** one mechanical parity test, not per-site assertions. Build a fixture hub with every claim field populated with a unique sentinel string, then fail one gate at a time (unsourced / field-excluded / sub-excluded / suppressed / unverified / malformed URL / redacted clause) and render the result through **every** entry point in one pass — `VenueHubView` server-rendered to an HTML string (which carries its FAQ and both JSON-LD blocks), `buildGettingInRows`, `buildCondensedLogistics`, `venueHubDescription`, the `getVenueUtilityCounts` predicate, and `bagRowFromDoc` — asserting the sentinel appears in **no** output, with `buildCondensedLogistics` allowlisted by name for `verified` only. Today's tests assert the positive ("it renders when sourced") and per-site negatives ("the rows go dark"); none asserts *"this withheld string appears nowhere"*, and that is the only assertion whose cost does not grow with the number of surfaces.

---

## Measurement traps found while producing this

**Provenance values can be arrays.** 45 provenance values in the corpus are
stored as arrays of URLs, which `stringMap` collapses to the first URL. Any
audit reading `doc.data().sources` directly scores those fields as unsourced and
manufactures false gaps; it produced two in the first pass of this very report
(`secu-stadium` transit, `coors-field` outside-food). **Audit through
`stringMap`, never through the raw document.**

**A grep-proximity heuristic is not an enumeration.** The first pass at this
matrix matched field names within a 14-line window of a gate call. It produced
164 pairs, most of them noise: the promo category `food` is not the venueHubs
`food` field, and geo `nearby`-teams is not the venue `nearby` prose. Every cell
above was read rather than inferred.
