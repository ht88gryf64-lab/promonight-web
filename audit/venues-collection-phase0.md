# The `venues` collection: Phase 0 audit

Read-only, 2026-08-28. No Firestore writes, no code changes, no plan. This is the corpus behind `venues.publicTransit` on the pro team pages, which is separate from `venueHubs` and received none of the per-field provenance work recorded in `audit/cfb-venue-sourcing-report.md` sections 11 to 22.

## The short version

**The corpus has no provenance of any kind, and one of its consumers manufactures a claim.** 148 docs, 20 fields, 19 of them claims and exactly one pointer. There is no sources map, no verified flag, no timestamp, no exclusion list. The venueHubs regime has nothing to attach to here: there is no second condition a field could fail.

Two findings outrank the rest.

**1. 85 of 169 team pages publish a gate time that is not data.** When `gatesOpen` is absent, `VenueInfoBlock` does not omit the row: it substitutes a hardcoded league sentence and labels it "Gate times", in the same row style as a sourced value. On 69 of those pages it is the only row in the card. The component says so in its own comment, "Venue plan always has *something* to show". This is not a stale fact or an unsourced one; it is a generated sentence presented as a fact about a specific building.

**2. The stale-transit failure mode is confirmed and systemic, and the site already knows better on its other surface.** Ten buildings whose transit text `venueHubs` now silences, because the 2026-08-27 sweep verified against the operator that the named service does not run, still publish a `venues` transit sentence on their team page. The site withholds the claim on the hub page and publishes it on the higher-traffic one.

## What the corpus holds

148 docs, 20 distinct fields, no field ever present-but-empty. 13 fields on every doc, 7 optional.

| Kind | Fields |
| --- | --- |
| CLAIM (19) | name, address, team, sport, league, lat, lng, hasAmenityData, amenityCount, parkingInfo, publicTransit, accessibility, nearby, gatesOpen, plus the presentation fields |
| POINTER (1) | `bagPolicyUrl` |

The five-field plan block (`parkingInfo`, `publicTransit`, `accessibility`, `nearby`, `bagPolicyUrl`) is strictly all-or-nothing: the **same 86 docs** carry all five and 62 carry none. `gatesOpen` (77) is a strict subset. Free-text claim prose totals roughly 15,700 words, all of it indexable page text.

**Team-page coverage:** all 169 teams resolve a venue doc, but only 99 get a plan block. NFL is the hole at **1 of 32**. So 70 team pages render a venue card with no venue data in it, which is what makes the fabricated gate-time row so visible.

## Provenance

**None.** The union of every key ever present across all 148 docs contains no sources map, no verified flag, no lastVerified or updatedAt, and no exclusion marker. The render gate is bare truthiness (`if (venue.parkingInfo) rows.push(...)`). Populated is the entire test.

The claim-versus-pointer split does apply here in principle, and cleanly: `bagPolicyUrl` is the single pointer and would gate on reachability, the other nineteen are claims. But there is nothing to gate the claims on, because no source was ever recorded.

## The consumers

| Consumer | Gates on | Reaches |
| --- | --- | --- |
| `venue-info-block.tsx` | truthiness only; the gate-times row is not gated at all | 169 of 169 team pages, via AffiliateRail, plus up to 12 host cards on /world-cup |
| `data.ts` | nothing; passes the five optional fields straight through | the Venue object every consumer reads |
| `api/my-teams/promos` | nothing; a full duplicate of the same mapping | the API response |
| `venue-overrides.ts` | nothing; a third hardcoded writer with no source or date | two of its three entries are dead code that Firestore shadows; the third is the only transit text on the site not stored in Firestore |

**669 VenueInfoBlock rows render across the live team pages, none of which passed a provenance, verification, or reachability check.** The mapping being duplicated in two places matters for any future regime: it would have to land in both, or the my-teams API keeps serving ungated text.

## Stale transit, confirmed against operators

20 of the 86 transit-bearing docs were assessed. **10 confirmed defective, 1 with strong evidence against it, 9 confirmed current. 66 not assessed.**

| Doc | What is wrong |
| --- | --- |
| loandepot-park | routes fans to "Civic Center Station", renamed **2024-07-12**, two years gone |
| nationals-park | tells fans to catch the DC Circulator, which **ceased operating entirely on 2024-12-31** |
| mercedes-benz-stadium | wrong twice: a retired station name **and** both stations on the wrong pair of lines. A fan following it boards the north-south line and never reaches the stadium |
| great-american-ball-park | "Cincinnati Bell Connector"; the operator calls it "The Connector" |
| kauffman-stadium | "RideKC 47-Broadway"; the route is "47 Martin Luther King Jr." |
| ball-arena, dicks-sporting-goods-park | name RTD services that do not exist: an "H" rail line, a "Bus Route 83" |
| dignity-health-sports-park, bmo-stadium | retired LA Metro colour names, and Avalon Station mapped to a line that runs nowhere near it |
| saputo-stadium, providence-park | a station put on a line that does not serve it. Not renames: wrong when written |

**Nine false leads were closed**, which is worth as much as the hits because it corrects two entries in this project's own rename list: SEPTA still publishes "Broad Street Line" and "Market/Frankford Line" as route names (the Metro letter rebrand is wayfinding, so **do not** "fix" these to "B"), and the TTC 509/511 replacement-bus era has ended, so the Toronto docs describing restored streetcar service are correct.

Beyond named services, the transit strings carry fares, discounts and dated offers as bare assertions. Those rot faster than station names, and no field in the schema could ever say when they were true.

## Two structural notes

**Doc ids are frozen routing keys.** The id is the building name at creation time and is never updated, so **15 of 148 ids name a sponsor the doc's own `name` field no longer carries** (`guaranteed-rate-field` is now Rate Field, `chase-stadium` is now Nu Stadium, and so on). These ids are live: `VENUE_RESOLUTION_MAP` maps 37 team slugs onto them.

**The team key is not the venueHubs key.** `venueHubs` uses full slugs; `venues` carries a `teamId` shaped `{short}-{league}` on 115 docs and a bare short code on 33, including all 30 MLB. It is also dead: no consumer reads it. The real join is `where('team', '==', "{city} {name}")`, a display string. The three oddballs (`wild`, `tmin`, `mun`) exist because MLB took the bare `min` first, which is a collision artifact rather than a convention.

## What was not assessed

66 of the 86 transit-bearing docs were not checked against an operator. The four non-transit claim fields (`parkingInfo`, `accessibility`, `nearby`, and the prose in `gatesOpen`) were not fact-checked at all. `bagPolicyUrl` reachability was not tested across the corpus. No `world-cup` host card was verified at render.
