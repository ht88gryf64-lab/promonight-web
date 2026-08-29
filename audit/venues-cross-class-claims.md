# Claims filed under the wrong field

Report. 2026-08-29. Only Madison Square Garden was changed; everything else here
is reported for a decision, per instruction.

## The shape

Field-scoped silencing gates a FIELD. It does not gate a CLAIM CLASS. Madison
Square Garden's `parkingInfo` ended:

> There is no official MSG parking, and nearby private garages are limited and
> expensive, so reserving ahead through a service like SpotHero is wise.
> **Transit is the better call here, since the arena sits directly above Penn
> Station.**

The bolded sentence is a transit assertion. It survived the corpus-wide transit
silencing because it lives in the parking field. That clause is now redacted;
the parking advice stands.

## The sweep

Both corpora, every prose field, matched against phrase markers that only make
sense as a claim of a given class. Bare nouns ("bus", "parking") were excluded
because they appear legitimately everywhere.

**121 raw hits across 80 docs.** Most are not defects, and saying so precisely
is the point of this report.

| Shape | Raw | Real | What the rest are |
|---|---|---|---|
| gateTime in `parkingLots` / `tailgating` | 45 | 0 | Lot opening times. "Lots open 4 hours before kickoff" is a parking fact, not a gate-time claim. Native to the field. |
| gateTime in `accessibility` | 10 | 0 | "Gates open" used as a TIME ANCHOR: "bike valet opens when gates open", "mobility shuttle operates from when gates open". These describe the accessibility service, not the gate. |
| transit in `nearby` | 22 | 1 | Soft orientation about a neighbourhood: "an easy streetcar ride away", "the SkyTrain puts all of Metro Vancouver within reach". The one real case, Charlotte's "two to three stops south", is already silenced. |
| transit in `parkingLots` | 17 | 0 | Where a lot sits, or the shuttle serving it: "adjacent to DART Fair Park Station", "served by shuttle to Vine City MARTA". Locational, native to a lot record. |
| transit in `parkingInfo` | 4 | **2** | See below. Two are false positives: "Route 1" at Gillette and SECU is a US highway in a driving direction. |
| transit in `accessibility` | 6 | **2** | See below. Also false positives: "First Aid Station" matched on "Aid Station"; "Union Station Garage" is a garage named after a station. |
| bag in `nearby` / `tailgating` / `gatesOpen` | 7 | 0 | Cooler and container rules inside tailgating, which is where they belong. |
| transit / gateTime in `bagPolicyNotes`, `publicTransit` | 6 | 0 | Cross-references inside a native field. |

**Four real instances. One fixed, three reported.**

## The three not fixed

| Doc and field | The claim | Why it matters |
|---|---|---|
| `venues/mercedes-benz-stadium.parkingInfo` | "MARTA is the recommended approach for most fans." | The sharpest of the three. This doc's `publicTransit` is ALREADY silenced venues-scoped, because it puts Vine City and GWCC/CNN Center on MARTA's north-south pair when both are on the east-west lines. We withdrew its MARTA routing as wrong and its parking field still recommends MARTA. |
| `venues/pnc-park.accessibility` | "the T light rail drops off right at the Home Plate Gate." | A routing and adjacency assertion inside an accessibility field. Unverified against Pittsburgh Regional Transit, and note this project has already found the "T" branding unbacked on PRT's own pages, which publish "light rail" and the Red, Blue and Silver lines. |
| `venueHubs/guaranteed-rate-field.accessibility` | "The CTA Red Line Sox-35th station is wheelchair accessible; arrangements can be made in advance at (312) 674-5225." | Asserts a station name, its line and an accessibility fact about it, plus a phone number. Genuinely useful if true, and entirely unverified. Note the hub id still carries the retired sponsor name while the doc's own `name` does not. |

Deliberately NOT on this list: `venues/yankee-stadium.parkingInfo` ("Most fans
skip driving and take the subway"). It names no line, station or route and
asserts nothing checkable. It is a disposition, not a claim.

## The structural point

Silencing a field is not the same as withdrawing a claim, and this corpus files
claims wherever the sentence happened to read well. Any future rebuild that
re-enables `publicTransit` per field with provenance will still leave transit
assertions sitting in `parkingInfo` and `accessibility` with no provenance at
all, because those fields were never part of the transit gate.

The durable fix is to gate on what a sentence ASSERTS rather than on which key
it is stored under. That is a larger change than this pass, and it is the reason
this report exists rather than a fix.
