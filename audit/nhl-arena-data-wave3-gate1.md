# NHL arena data, wave 3 of 6, Gate 1 report

Date: 2026-09-04. Five buildings. Verifiers: 8 declared, 8 used, 4 per pass, each looping all five buildings. Nothing written. Gate 2 waits on authorization.

## 1. Proposed flags

| Building | Clean at pass 2 | Proposed flag | Gate 2 write |
|---|---|---|---|
| scotiabank-arena | YES, 20 of 20 cells, zero defects | verified true | yes |
| delta-center | no, 22 of 25; zero value defects, 3 record defects | verified true, carries | no |
| lenovo-center | no, 14 of 20; zero value defects, 11 record defects | verified true, carries | no |
| wells-fargo-center | no, 17 of 22; 4 value defects, 8 record defects | verified true, carries | no |
| capital-one-arena | no, 12 of 17; 1 value defect, 14 record defects | verified true, carries | no |

Under the brief, only Scotiabank Arena is written at Gate 2. The other four carry to wave 4 unwritten, with every pass-2 fix already applied in an unverified v3 file.

Worth your ruling: Delta Center and Lenovo Center finished pass 2 with **zero value defects**. Every remaining problem on those two is record text, not a published claim. If you want them written this wave, the write set becomes three buildings and one overlay.

## 2. Budgets

| Budget | Cap | Used |
|---|---|---|
| Firecrawl | 45 | 45 (9 map calls, 35 scrapes, 1 of which returned 404) |
| Plain fetches | 12 | 0 (Gate 2 renders) |
| Verifiers | 8 | 8 |
| Credits | | 6237 before, 6193 after |

## 3. Harvest and agencies

33 pages. Every agency was identified from the operator page rather than assumed, and all five were correct.

| Building | Operator pages | Agency page | Agency outcome |
|---|---|---|---|
| wells-fargo-center | plan-your-visit, security-policy, parking, guest-services, accessibility-information | SEPTA B1, the page the operator links | Carries the Broad Street Line and NRG Station. Does not carry the operator's "AT&T Station is now NRG Station" or its Sports Complex sentence |
| scotiabank-arena | bag-policy, plan-your-visit FAQ, know-before-you-go, plan-your-visit, event-faqs | TTC Union Station | Carries the station, its Line 1 platforms and its Yonge and University platforms, plus GO Transit, UP Express and PATH access |
| delta-center | arena-policies FAQ, parking, root | UTA Event Service | Names Delta Center itself: "How to get there on UTA: TRAX Green Line or TRAX Blue Line to Arena Station" |
| capital-one-arena | arena-faqs, directions-parking, about | WMATA Gallery Place | Prints the station badge GYR and tags its arrivals G, Y and R. Publishes the station as "Gallery Place" and never uses "Chinatown" |
| lenovo-center | bagpolicy, policies, parking-guide, faqs, guest-services, transportation | none | No operator page names a transit service |

Two harvest facts shaped the outcome. Scotiabank's footer link to `/plan-your-visit/directions-parking` returns HTTP 404, but its body pages link a different parking page, `/plan-your-visit/getting-here`, which the Firecrawl budget did not reach. And Lenovo Center publishes a Transportation page that the parking guide links twice; fetched with the last call, it covers rideshare, buses, limousines and taxis and names no public transit service at all.

## 4. Per building and per field

### scotiabank-arena (clean at pass 2, proposed for the write)

| Field | State | Confirmation | Pages read, with the finding | 1.5 |
|---|---|---|---|---|
| bagPolicyNotes | rendered | operator | bag-policy STATES the rule and is cited; plan-your-visit FAQ and event-faqs STATE its opening sentence and POINT to it; plan-your-visit POINTS to it; know-before-you-go POINTS to it and STATES its own bag-check price | yes: bag check $25 for items against $20 for small bags. The price is not stored; the allowance survives both readings |
| publicTransit | rendered | independent (TTC Union Station) | stored from the agency page itself | no |
| parkingLots | none | none | FAQ and plan-your-visit POINT to `/plan-your-visit/getting-here`, unfetched; know-before-you-go STATES a proximity and booking paragraph, held; event-faqs SILENT | no |
| gatesOpen (Maple Leafs overlay) | rendered | operator | the FAQ STATES "Gates open 1 hour prior to puck drop or tip off for all games"; no other operator page states a door time | no |

Bag dimensions are null: the page gives two dimensions where the schema records three, and the figure is in the notes verbatim. Clear-bag is null under rule 1.6.

### delta-center (zero value defects, carries on record text)

| Field | State | Confirmation | Pages read, with the finding |
|---|---|---|---|
| bagMaxDimensions 4x6x2 in, bagPolicyNotes | rendered | operator | the policies FAQ STATES the rule three times and agrees with itself; parking and root SILENT |
| parkingLots, eight lots | rendered | operator | the parking page STATES the lots; the FAQ AGREES and supplies the Park Place accessible sentence, so both are cited; root SILENT |
| rideshareDropoff | rendered | operator | the FAQ STATES a drop-off or pickup location three times, all on 300 West, none contradicting another; the Lyft pickup sentence is held |
| publicTransit, TRAX Green and Blue to Arena Station | rendered | independent (UTA Event Service) | the agency names the building and the route |
| gatesOpen 90 minutes (Utah overlay) | rendered | operator | v2 carried a pages-read list without a finding per page; v3 adds one |

### lenovo-center (zero value defects, carries on record text)

| Field | State | Confirmation | Pages read, with the finding |
|---|---|---|---|
| bagPolicyNotes | rendered | operator, club republish recorded | bagpolicy STATES the rule and is cited; policies STATES the same three bullets and agrees, differing in heading punctuation, one comma and the scope of the promoter sentence; four others SILENT |
| parkingLots | rendered | operator | the parking guide STATES the routes, passes, price and tailgating; the FAQ STATES the payment sentence and is cited; policies, guest-services, bagpolicy and transportation STATE the price line and agree |
| rideshareDropoff | rendered | operator | the Transportation page STATES the whole value and is cited; the FAQ STATES the same route in near-identical wording |
| publicTransit | **no-operator-page** | none | the Transportation page was fetched and names no public transit service; the other five only link it |
| gates | held | none | the operator FAQ is generic, the hockey-scoped split is club-only |

### wells-fargo-center (carries)

| Field | State | Confirmation | Pages read, with the finding |
|---|---|---|---|
| bagMaxDimensions 14x14x6 in, bagPolicyNotes | rendered | operator | security-policy STATES the rule and is cited; guest-services STATES the same rule and agrees on every figure; three others SILENT |
| parkingLots | rendered | operator | the parking page STATES the payment rule and accessible parking; the accessibility page names the locations specifically and agrees; guest-services and security-policy state lot rules of their own |
| rideshareDropoff | v2 rendered, **v3 nulled and held** | none in v3 | the only rideshare sentence is a Lyft PICK-UP lot |
| publicTransit, the line name only | rendered | independent (SEPTA B1) | the operator's rename and Sports Complex sentences are held |

### capital-one-arena (carries)

| Field | State | Confirmation | Pages read, with the finding |
|---|---|---|---|
| bagPolicyNotes | rendered | operator | the arena FAQ STATES the rule twice and agrees with itself; directions and about SILENT |
| publicTransit | rendered | independent (WMATA Gallery Place) | v2 stored the station with no lines on a misreading; v3 stores the three lines the agency badge gives and holds every proximity claim |
| parkingLots | none | none | no operator or club page states a lot fact; all three are SpotHero widgets |
| gates | held | none | the FAQ door time is generic, not scoped to hockey |

## 5. The two verify passes

Pass 1 found 8 value defects and 47 record defects. Four findings changed the shape of the wave:

- **A fabricated citation.** Lenovo Center's rideshare value was cited to the parking guide, which contains none of those words. The text is on the FAQ and, as the last fetch showed, on the Transportation page.
- **A missed rule 1.5 conflict.** Scotiabank publishes its bag-check price twice, $25 for items on the bag-policy page and $20 for small bags on know-before-you-go. v1 published one side.
- **Two field states resting on unfetched pages.** I asserted no-operator-page for Scotiabank parking and Lenovo transit having followed a dead footer link and a nav label rather than the pages the bodies link.
- **A page I mischaracterised twice.** I called the Xfinity parking page a booking widget. It carries a cash-free payment rule, accessible-parking locations, an entry procedure and a weekday commuter programme.

Pass 2 found 5 value defects and 36 record defects, all of them in v2's own repairs:

- **Xfinity bag, my 1.5 was too broad.** Both pages name three bag-entry locations and disagree only on the third's name. I dropped the location. That made the stored policy stricter than either operator reading.
- **Xfinity rideshare is a pick-up lot.** The only rideshare sentence is a Lyft Pick Up Lot in Lot D. I stored it as a drop-off, and the same wave held the identical shape at Delta Center. Now nulled and held.
- **Capital One transit, I misread the agency page.** I wrote that its only line mentions were two Red Line alerts. It prints the station badge GYR and tags every arrival G, Y or R, which corroborates all three lines the operator names. There is also one alert, not two.
- **Pages-read arrays short of their own findings.** Lenovo's arrays listed five pages where the findings resolved six.
- **Two records opened "Wave 3 v1" inside the v2 file.**

## 6. Lenovo Center: the old venues prose against the harvest

| Prose clause | Verdict | Basis |
|---|---|---|
| More than 8,000 spaces fill the lots | SILENT | no harvested page states a space count |
| Parking is cashless, pay by card or mobile wallet | AGREES | operator FAQ |
| Prepaying through Ticketmaster or ParkWhiz beats paying at the gate | AGREES on ParkWhiz and on the saving; SILENT on Ticketmaster | the FAQ says "Save when purchasing mobile parking passes prior to the day of the event at ParkWhiz.com"; Ticketmaster appears only for tickets |
| Paved lots go fast, under 30 minutes means an unpaved overflow lot | SILENT | |
| Most fans drive, since transit options are limited | SILENT | the parking guide's Public Transportation card teases "a number of transportation options", but that is a navigation teaser, and the Transportation page names no service |
| Rideshare drop-off and pickup is at Gate C off Trinity Road | AGREES | Transportation page and FAQ |
| Drivers should not turn into any other gate or lot | AGREES | both pages: drop-offs should not turn into any gate or parking lot except Gate C |
| GoRaleigh buses serve the wider area | SILENT | no harvested page names GoRaleigh |
| Parking lots open three hours before puck drop, tailgating allowed | AGREES | club page on the lot opening, operator parking guide on tailgating |
| Arena doors typically open about 90 minutes before game time | DISAGREES | the club page gives 60 minutes on weekdays and 90 at weekends; the operator FAQ gives one hour for most events |
| Earlier for big giveaway nights | SILENT | |
| The arena is fully accessible | SILENT | the phrase appears on no harvested page |
| Accessible parking by displaying a placard to lot staff | AGREES | operator FAQ |
| Free Kid Check wristband at Guest Services, main concourse, Section 127 | AGREES | operator FAQ, almost word for word |
| An ADA guide | AGREES | every operator page carries an ADA Guide navigation item |
| Elevators and escalators throughout | SILENT | |
| The arena sits beside Carter-Finley Stadium | AGREES | Transportation page and FAQ |
| Downtown Raleigh and Glenwood South for a sit-down meal | SILENT | |
| bagPolicyUrl pointing at the club gameday-procedures page | DISAGREES as a pointer | the operator publishes its own bag-policy page, which this record stores |

## 7. What Gate 2 would write

One building and one overlay, from `audit/nhl-wave3/nhl-w3-write-clean.json`:

| Doc | Fields | confirmations | states |
|---|---|---|---|
| venueHubs/scotiabank-arena | bagPolicyNotes, bagPolicyUrl, publicTransit | bagPolicyNotes operator, publicTransit independent | both rendered |
| venueHubs/scotiabank-arena/tenants/toronto-maple-leafs | gatesOpen 60 minutes | gatesOpen operator | rendered |

Guard passed on both projected ops; the building projects indexable.

Note for your Gate 2 render checks: this write set exercises **neither** pointer state. Scotiabank parking has no state at all, because the page that would settle it was not fetched. If you want operator-conflict and no-operator-page rendered this wave, the write set has to include Lenovo Center, whose transit is a no-operator-page established on a page that was read.

## 8. Carried to wave 4

- **wells-fargo-center**: v3 restores the third bag-entry location as "a premium entrance", nulls rideshareDropoff as a pick-up fact and holds it, and corrects two parking findings.
- **capital-one-arena**: v3 stores the three lines the agency gives the station and moves the proximity sentence to the held store.
- **delta-center**: v3 adds a gates entry with a finding for all three operator pages.
- **lenovo-center**: v3 completes the pages-read arrays, corrects the Transportation page finding, and fixes three prose verdicts.
- **scotiabank-arena parking**: not established. The operator parking page its body links, `/plan-your-visit/getting-here`, needs one Firecrawl call in wave 4.

All four carry files are at `audit/nhl-wave3/nhl-w3-facts-v3-unverified.json`, guard-passed on all seven ops. No verifier has read v3; the wave's budget is spent.
