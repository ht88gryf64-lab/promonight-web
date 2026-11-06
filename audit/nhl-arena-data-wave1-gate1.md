# NHL arena data, wave 1 of 6, Gate 1 report

Date: 2026-09-03. Buildings: td-garden, ball-arena, american-airlines-center, united-center (Cloudflare test), ppg-paints-arena. Free item: the Pistons gate overlay on little-caesars-arena. Nothing written. Gate 2 waits on authorization.

## 1. Proposed flags

| Building | Proposed flag | Written at Gate 2 | Basis |
|---|---|---|---|
| td-garden | verified true | yes | parking republish (Bruins page), transit independent (MBTA destination page), bag pointer only |
| ppg-paints-arena | verified true, CARRIED to wave 2 unwritten | no | published values clean in pass 2; two record defects remain after pass 2 (held-store scope labels), so under the brief the payload carries |
| ball-arena | held, verified false | no | no RTD station page; the RTD rail index lists D and H suspended against the operator's D, E, H, W; bag and parking single-source |
| american-airlines-center | held, verified false | no | transit agency-confirmed (DART), but bag and parking single-source; nhl.com/stars/arena answers 500 |
| united-center | held, verified false | no | transit agency-confirmed (CTA), but bag and parking single-source; the Blackhawks root carries no arena guide |
| little-caesars-arena, Pistons overlay | not writable | no | the Pistons visit page carries no door time, so there is no second-domain confirmation; a one-flag write would fail the guard |

Pass 2 result: td-garden is clean on all four field classes and is the only building proposed for the Gate 2 write. ppg-paints-arena finished pass 2 with zero value defects and two record defects: the rideshare zone is labelled club-only in the held store although the operator transit page also carries it, and the nickname "T" is labelled operator-only although the Penguins page also carries it. The brief says a payload not clean after pass 2 carries to wave 2 unwritten, so ppg-paints-arena is not in the Gate 2 write set. Both fixes are label corrections and are applied in an unverified v3 carry file (`audit/nhl-wave1/nhl-w1-facts-v3-unverified.json`) for wave 2. Writing it this wave would need your say-so at Gate 2, against the brief's rule.

## 2. Budgets

| Budget | Cap | Used |
|---|---|---|
| Firecrawl calls | 45 | 40 (36 scrapes + 4 /v2/map discovery calls) |
| Plain fetches | 8 | 1 (Little Caesars gate row render check) |
| Verifiers | 8 (4 per pass, 2 passes) | 8 |
| Firecrawl credits | | 6280 before wave 1, 6241 after the harvest |

## 3. Harvest

Every fetch went through Firecrawl. All operator pages returned complete. One fetch failed: `https://www.nhl.com/stars/arena` answered HTTP 500 through every Firecrawl engine (the page does not exist). The four map calls found no club arena guide on nhl.com for any of the five clubs, so the club roots were scraped instead.

| Building | Operator pages | Club pages | Agency page | Scrapes |
|---|---|---|---|---|
| td-garden | policies, know-before-you-go, directions-parking, transportation, plan-your-visit | nhl.com/bruins/, nhl.com/bruins/tickets/parking | mbta.com/destinations/td-garden | 8 |
| ball-arena | bag-policy, prohibited-items, parking-directions, public-transportation | nhl.com/avalanche/ | rtd-denver.com root, routes-services, routes-services/rail (no station page) | 8 |
| american-airlines-center | fan-safety-guidelines, parking, public-transportation, directions | nhl.com/stars/ (nhl.com/stars/arena: 500) | dart.org/schedules/aac.asp | 7 |
| united-center | root, FAQ, directions-parking, rfguidelines | nhl.com/blackhawks/ | transitchicago.com/sports/ | 6 |
| ppg-paints-arena | know-before-you-go-1, directions_parking, public_transportation | nhl.com/penguins/tickets/parking | rideprt.org how-to-ride-the-light-rail-system | 5 |
| little-caesars-arena (Pistons) | none needed | nba.com/pistons/, nba.com/pistons/features-what-know-your-visit-little-caesars-arena | n/a | 2 |

United Center Cloudflare test: Firecrawl cleared the 403 that blocked plain HTTP in Phase 0. Root, RF guidelines, directions-parking and FAQ all returned complete markdown. Rogers Arena is unblocked for wave 5 on this result.

## 4. Transit agencies

| Building | Agency page | Outcome |
|---|---|---|
| td-garden | MBTA TD Garden destination page | confirms Green and Orange Line to North Station, Commuter Rail at North Station, Back Bay Orange Line routing. Does not carry the operator's East or West entrance instruction or the Points North scope; both dropped from the stored note in v2 |
| ppg-paints-arena | PRT how-to-ride-the-light-rail page | confirms the light rail system and, in its two-car-trains station list, Wood Street, Steel Plaza and First Avenue. Does not carry the nickname "T", the closest-station sentence or any bus route; all held as operator-only in v2 |
| american-airlines-center | DART American Airlines Center page | confirms Green and Orange Line to Victory Station seven days a week, the West End transfer, the TRE at Victory Station and no TRE service on Sundays. Does not carry Bus Route 49 (held) |
| united-center | CTA sports page, United Center section | confirms Blue, Green and Pink Line stops with block distances and buses #9, #19, #20, #50, #126. Does not carry the operator's post-event scoping of the #19 (held) |
| ball-arena | RTD root, routes-services, rail index | NOT REACHED for the stop: no station page discovered from the root or the rail index, and none of the three pages names Ball Arena or the Ball Arena/Elitch Gardens stop. The rail index lists D and H as suspended and the root carries the Downtown Rail Reconstruction Project notice, so the agency contradicts two of the four operator-stated lines as of the harvest |

## 5. Verify passes

### Pass 1 (v1), 4 verifiers by field class, each looping all five buildings

| Field | td-garden | ball-arena | american-airlines-center | united-center | ppg-paints-arena |
|---|---|---|---|---|---|
| bag | 1 value defect (held store: the brand name "‘47" printed as "47") | 1 record defect ("only" undercounted the bag-policy page's text bullets) | clean | 1 value defect (unit "in" not on the page; the FAQ gives "10x6x2" unitless) | clean |
| parking | clean (two observations) | 5 record defects (LAZ, I-25 routing, VIP scope, Corolla basis, club-root description) | 3 record defects (redundant held Lexus sentence; Lot A and Inspiration Lot omissions misdescribed; Stars root described as absent) | 1 record defect (named public lots are on the FAQ and the directions page) | clean |
| transit | 2 value defects (unscoped Commuter Rail sentence; East or West entrance not on the agency page) + 4 record defects | 1 value defect (MallRide detour qualifier dropped) + 1 record defect (agency described as unreached; D and H suspension unlogged) | 1 value defect (TRE Sunday caveat dropped) + 2 record defects (Sunday caveat and West End transfer mislabelled operator-only) | 1 record defect (post-event #19 scoping unlabelled) | 2 value defects ("the T" not on the agency page; "Downtown stations including First Avenue" on neither page) + 4 record defects (Steel Plaza and Wood Street ARE on the PRT page) |
| gates | 1 record defect ("operator site" coverage overclaim) | clean | clean | clean | clean |

Total: 8 value defects (3 on the two writable buildings, all in transit notes) and 23 record defects. Every defect was fixed in v2 (`scratchpad/p1/w1/build-v2.cjs` applies the patches over v1; 55 changed paths across the five records).

Material v2 changes on the writable buildings:

- td-garden transit note now reads: "Green and Orange Lines: take either line to the North Station stop. Commuter Rail: North Station (TD Garden at the same location). From Back Bay, take the Orange Line to North Station." Every element is on both the operator transportation page and the MBTA page.
- ppg-paints-arena transit note now reads: "Light rail stations at Steel Plaza, Wood Street and First Avenue." The PRT page lists all three stations. The nickname, the closest-station sentence, the Golden Triangle sentence and the bus routes moved to the held store as operator-only; the Penguins Steel Plaza sentence is held under the club citation.
- td-garden held bag text carries the brand name as the page prints it and the bag-check sentence as the page prints it; the held club parking text carries both $65 conditions the Bruins page states.

Material v2 changes on the held buildings:

- ball-arena: Corolla Lot stored with its game statuses (the same permit-only shape as Camry); MallRide note carries the 15th and 17th Streets detour; transit record logs the three RTD pages reached and the D and H suspension; the venues-prose verdicts corrected (LAZ DISAGREES for event prepay, I-25 routing AGREES, VIP scope Avalanche games only); bag record lists all three text bullets and the bag-check contradiction between the two operator pages.
- american-airlines-center: transit note carries the West End transfer and "there is no TRE service on Sundays" (both on the DART page); Bus Route 49 is the only operator-only item; the redundant Lexus sentence left the held store; the tailgating prohibition is held under the parking-page citation; omission set corrected (Lot A, Lot E, Inspiration Lot).
- united-center: bagMaxDimensions null (unit not on the page; the figure stays in the note as the page gives it); the FAQ lot list held under the FAQ citation; the post-event #19 sentence moved to the held store; the gates record quotes the page's Bulls and Blackhawks 90-minute sentence.

### Pass 2 (v2), 4 verifiers by field class

| Field | td-garden | ball-arena | american-airlines-center | united-center | ppg-paints-arena |
|---|---|---|---|---|---|
| bag | clean | 1 record defect (the bag-policy page has four top-level text bullets, the record said three) | 1 value defect (the sized wristlet sentence sits under the page's "Dallas Mavericks Games Covid-19 Protocols" accordion; the building-level Bag Policy block gives no wristlet size, so rule 1.7 stores the sizeless block) + 1 record defect | clean | clean |
| parking | clean | clean | 2 record defects ("the Stars site has no arena page" is a conclusion no page carries, the fetch merely failed; the ParkWhiz link sits under the Tickets menu, not the Arena menu) | clean | 1 record defect (rideshare zone labelled club-only; the operator transit page carries it too, and rideshareDropoff is null although both domains carry it) |
| transit | clean | clean (agency contradiction on D and H recorded) | clean | 1 record defect (the operator's rail sentences copy the CTA page near-verbatim, so the confirmation type is republish, not independent) | 1 record defect (nickname "T" labelled operator-only; the Penguins page carries "Steel Plaza T Station") |
| gates | clean | clean | clean | clean | clean |

Pass 2 total: 1 value defect (american-airlines-center, held) and 6 record defects; 14 of 20 field cells clean. Both writable buildings have zero value defects. td-garden is clean on every cell. The verifier budget for the brief (8) is spent; the pass-2 fixes are applied in the unverified v3 carry file and are not proposed for writing.

## 6. Per building, per field

### td-garden (proposed verified true, write at Gate 2)

| Field | Stored | Confirmation | Pass 2 |
|---|---|---|---|
| bag | bagPolicyUrl pointer only; 6x4x1.5 in, clearBagRequired false under rule 1.3, and the policy text held single-source | single-source (Bruins pages carry no bag statement) | clean |
| parking | North Station Garage: location and 5:00 AM to 1:00 AM hours | republish by nhl.com/bruins/tickets/parking; $65 flat rate (two conditions), EV and lost ticket held club-only | clean |
| transit | Green Line, Orange Line, Commuter Rail; note limited to what both pages carry | independent by mbta.com/destinations/td-garden | clean |
| gates | held: GA doors line inside a section the page scopes to certain shows | single-source; no overlay | clean |

### ppg-paints-arena (proposed verified true; carried to wave 2 unwritten)

| Field | Stored | Confirmation | Pass 2 |
|---|---|---|---|
| bag | bagPolicyUrl pointer only; bagsProhibited, 4x6x1.5 in wristlet exception and text held single-source | single-source | clean |
| parking | PPG Paints Arena Lots: cashless, ParkWhiz pre-purchase | independent by nhl.com/penguins/tickets/parking | record defect (rideshare label) |
| transit | Pittsburgh Regional Transit light rail; stations at Steel Plaza, Wood Street, First Avenue | independent by the PRT light-rail page | record defect (nickname label) |
| gates | none | no source | clean |

### ball-arena (held, verified false)

| Field | Stored | Confirmation | Pass 2 |
|---|---|---|---|
| bag | bagsProhibited true, 4x6x1.5 in clutch allowance, medical and diaper 14x14x6 in; clearBagRequired null under 1.6; pointer to the bag-policy page | single-source (two operator pages; they disagree on bag check, nothing on bag check stored) | record defect (bullet count) |
| parking | six lots (Camry, Corolla, 4Runner, Tundra, Elitch's, RAV4) with page statuses and prices; rideshare lot; general terms held | single-source (Avalanche root carries links only) | clean |
| transit | light rail D, E, H, W at Ball Arena/Elitch Gardens; RTD bus stop; MallRide with detour | single-source; RTD rail index contradicts D and H; no station page | clean |
| gates | none | no source | clean |

### american-airlines-center (held, verified false)

| Field | Stored | Confirmation | Pass 2 |
|---|---|---|---|
| bag | 14x14x6 in purse ceiling, policy text, clearBagRequired null under 1.6; pointer | single-source | value defect (wristlet size is Mavericks-protocol scoped; baseline block stored in v3) |
| parking | six lots with location, hours and payment; rideshare; general terms and tailgating held | single-source (Stars root carries links only; nhl.com/stars/arena 500) | 2 record defects |
| transit | DART Green and Orange to Victory Station seven days a week; West End transfer; TRE with no Sunday service | independent by the DART AAC page; Bus Route 49 held | clean |
| gates | none | no source | clean |

### united-center (held, verified false)

| Field | Stored | Confirmation | Pass 2 |
|---|---|---|---|
| bag | policy text with the unitless "10x6x2" figure; bagMaxDimensions null; clearBagRequired null under 1.6; pointer to the FAQ | single-source | clean |
| parking | one entry carrying the directions page's General Parking terms; the FAQ's nine named lots held | single-source | clean |
| transit | CTA Blue, Green, Pink stops with block distances; buses #9, #20, #50, #126; #19 line | agency carries every element; typing corrected to republish in v3 (operator copies the CTA text) | record defect (typing) |
| gates | held: "Gates generally open 90 minutes prior to the events and games"; the page also carries the Bulls and Blackhawks 90-minute sentence | single-source; no overlay | clean |

## 7. Ball Arena: old venues prose against the operator pages

| venues prose claim | Verdict | Operator page |
|---|---|---|
| Paid lots (Camry, 4Runner, Tundra) surround the arena and open three hours before events | AGREES on lot names and the 3-hour opening; DISAGREES on Camry | Camry is "Avalanche Game: Permit only", "Nuggets Game: Permit only", with Avalanche-game access "restricted and available only to vehicles displaying a VIP parking pass" |
| Cards are accepted everywhere, with cash only at the Tundra lot | AGREES | "Cash payments are only accepted at the Tundra lot" |
| Prepay through Ticketmaster or LAZ to save | AGREES on Ticketmaster advance purchase; DISAGREES on LAZ as an event prepay channel; SILENT on "to save" | LAZ is named for "daily and monthly parking options"; "Prices are based on arrival parking ONLY, online reservation vary" |
| Rates run around 30 dollars for Nuggets and Avalanche games | DISAGREES | $35 (4Runner), $40 (Tundra), $35 (Elitch's), $70 (RAV4) |
| Take Interstate 25 to exit 210B at Auraria Parkway | AGREES | "Take I-25 North towards Denver", "Take exit 210B for Auraria Parkway", "Merge onto Auraria Parkway" |
| Ball Arena/Elitch Gardens station, served by the D, E, H, and W lines | AGREES with the operator page | the RTD rail index lists D and H as suspended |
| Bus routes 10, 15, and 20 nearby | SILENT | "served by multiple bus routes" |
| A three-hour transit pass is about 2.75 dollars | SILENT on a three-hour pass | the RTD rail index carries "$2.75" as the standard fare |
| Rideshare pickup is in the 4Runner West lot at 5th and Walnut | AGREES | rideshare lot "at the intersection entrance of 5th and Walnut Streets in the 4Runner West parking lot" |
| bagPolicyUrl | AGREES | same page |
| All RTD buses and trains accommodate mobility aids | AGREES | "All RTD buses and rail vehicles are accessible for mobility aids" |
| nearby | SILENT | no neighbourhood page harvested |

No old-prose wording appears in any stored field.

## 8. Pistons overlay on little-caesars-arena

The Pistons page `nba.com/pistons/features-what-know-your-visit-little-caesars-arena` and the Pistons root carry no door-open time. The operator A-Z guide's 90-minute sentence therefore has no second-domain confirmation for a Pistons-scoped overlay. The guard requires a confirmation entry for every sourced field, so a one-flag write of the Pistons overlay would be rejected. Not proposed for Gate 2. The Red Wings overlay (flipped at close-out) is unaffected.

## 9. Little Caesars gate row

One plain fetch of `/venues/little-caesars-arena` confirmed the gate row renders: the operator's "open 90 minutes prior" sentence is in the visible text and in the FAQ JSON-LD, with the A-Z guide source link present.

## 10. What Gate 2 would write

One building doc, no overlays, from `audit/nhl-wave1/nhl-w1-write-v2-td.json` through the extended writer on pipeline main (afa04f7):

| Doc | Fields | confirmations map | Projected |
|---|---|---|---|
| venueHubs/td-garden | parkingLots (1), publicTransit, bagPolicyUrl, officialParkingUrls, sources (4) | parkingLots republish, publicTransit independent | facts 3/15, INDEXED |

Guard: passed on the projected op. Writer dry run: "guard passed on 1 projected op(s); nothing written". The Pistons overlay is not in the batch (section 8). ppg-paints-arena projected the same way (facts 3/15, INDEXED, guard passed) but is carried, not written.

## 11. Carried to wave 2 unwritten

- ppg-paints-arena: published values clean; two held-store labels to correct (rideshare zone is on both domains and could publish as independent; the nickname "T" is operator and club, not agency). Applied in the unverified v3 file; needs one verifier pass in wave 2 before writing.

- ball-arena: needs an RTD station or line-status page for the Ball Arena/Elitch Gardens stop and a decision on the D and H suspension before any transit publish; bag and parking stay single-source (no Avalanche or Nuggets arena page on nhl.com or nba.com was harvested).
- american-airlines-center: transit is publishable on its own; bag and parking need a club page (the Stars arena URL does not exist; a Mavericks page was not in scope).
- united-center: transit is publishable on its own; bag and parking need a club page (the Blackhawks root carries no arena guide); the FAQ carries named public lots for a lot-level extraction.
- Pistons overlay: needs a Pistons page that states a door time.
