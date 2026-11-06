# NHL arena data, Phase 1 execute: Gate 1 report

2026-09-02. Read-only against Firestore. No writes, no repoint, nothing merged. Gate 2 has not started.

Budget as spent: Firecrawl scrapes 15 of 20 (plus 4 map calls for URL discovery, reported separately; 19 credits total, 6,340 to 6,321). Plain HTTP fetches: 0. Verifiers: 4 in pass 1 and 4 in pass 2, sharded by field class, each looping all three buildings; 8 of the 8 cap for the brief, so Gate 2 has no verifier budget left and must not need one.

Working files: `scratchpad/p1/g1/` (harvest checkpoints under `logs/`, payload sets `nhl-g1-facts.json` (v1), `-v2.json` (after pass 1) and `-v3.json` (after pass 2, the proposed execute payload), the writer's exact ops for v3 in `dry-run-ops-v3.json`, verify shards `verify-shards-pass1.json` and `verify-shards-pass2.json`, `scrape-ledger.md`).

## 1. Little Caesars re-harvest (Firecrawl)

All four operator pages that answered 406 or rendered as shells to plain HTTP came back complete through Firecrawl: A-Z guide 143,620 chars, prohibited items and entry policies 38,541, directions and parking 61,882 (the lot list rendered this time), all-venue transit 19,000. The club side on nhl.com: A-Z guide 99,847 and parking 34,349 (found by one map call; the Red Wings, unlike the Predators, keep their arena guide under `/arena/`).

What the building carries, v1:

| Field | Value | Cited source | Second source and type |
|---|---|---|---|
| bag | max 4 x 6 x 1.5 in; clearBagRequired false (rule 1.3: non-clear small bags and clear bags are permitted at the same envelope); diaper, parenting and medical bags up to 16 x 16 x 8 in | operator prohibited-items page | club A-Z, republish (near-verbatim) |
| parking | six District Detroit garages (Comerica, McLaren, Tigers, Temple West, Trinity Health, UWM) with entries; parking map page; rideshare drop-off off westbound Fisher Service Drive by the UWM Garage | operator directions page | lot names single-source; hours (3 hours before, 2 after), 10-minute walk and SpotHero agreed on the club page in its own words but not stored as lot facts |
| gates (Red Wings overlay) | doors 90 minutes before game time for Red Wings and Pistons games; concerts 60 minutes; subject to change | operator A-Z Door Open Times | club A-Z, republish |
| transit | see section 2 | club A-Z Public Transit entry (building-scoped) | agency pages |

## 2. Transit agency confirmations

Per the brief, a transit value verifies only against the transit agency's page. Agency pages were located from the operator or club transit text, not assumed: the Bridgestone operator page names WeGo; the Centre Bell operator page links STM; the Red Wings A-Z names the QLINE stop and the People Mover transfer.

| Building | Agency page(s) | Agency says | Status for the stored value (v2) |
|---|---|---|---|
| bridgestone-arena | WeGo Route 18 timetable (wegotransit.com); WeGo fare page | Route "18 AIRPORT", direction To Downtown / From Downtown, stops NASHVILLE INTERNATIONAL AIRPORT and CENTRAL 4TH AVE / CENTRAL 5TH AVE bays; one late trip labelled DOWNTOWN EXPRESS, all others DOWNTOWN VIA ELM HILL; fare page carries no fare text | confirms the stored value (Route 18 between the airport and downtown). Silent on a Bridgestone stop, on "WeGo Central" as a name or hub, on the $2 fare, and does not describe the route as express. Those operator claims are held. |
| centre-bell | STM Line 2 Orange station list; STM station URL (rendered as the generic network page); STM Canadiens event page (403 to Firecrawl) | Station list entries 13 Lucien-L'Allier and 14 Bonaventure | confirms the two stored stations. Silent on Gare Centrale and Gare Lucien-L'Allier (held, operator-only), on the fare advice (held), and on the building. |
| little-caesars-arena | QLINE how-to-ride (stop lists), QLINE FAQ, People Mover Grand Circus Park station page; QLINE station map PDF 404 | Southbound stops include Sproat Street and Grand Circus; 13 stops from Grand Boulevard to Congress Street; the line is free; a dedicated lane near Little Caesars Arena; Grand Circus Station lists QLINE TRANSFER - GRAND CIRCUS PARK STATION | confirms the stored value (Sproat St. stop; Grand Circus Park stop with the People Mover connection; Grand Blvd. to Congress St.). Silent on "nearest" as a judgment, on the Woodward and Sproat bus stop (DDOT not fetched) and on "along Woodward". The QLINE FAQ names the arena for its dedicated lane, and the People Mover Grand Circus Station page lists LITTLE CAESARS ARENA under Destinations Nearby (found in pass 2). |

No agency contradicted anything. WeGo and STM name no stop for their buildings; the People Mover names Grand Circus Station for Little Caesars Arena. Each agency confirms the stations or route the operator or club names.

## 3. Verify pass 1 (v1 set: Bridgestone v3, Centre Bell v3, Little Caesars v1)

| Building | Field | Pass 1 | Confirmation type verified | Agency |
|---|---|---|---|---|
| little-caesars-arena | bag | clean | republish | not-applicable |
| little-caesars-arena | parking | clean | single-source for all four fields | not-applicable |
| little-caesars-arena | transit | DEFECTS 3 | agency-partial | partial |
| little-caesars-arena | gates | DEFECTS 2 | republish | not-applicable |
| centre-bell | bag | clean | single-source | not-applicable |
| centre-bell | parking | clean | republish for parkingLots (club FAQ block is a light restructure of the operator block, every stored clause present on both domains); single-source for officialParkingUrls | not-applicable |
| centre-bell | transit | DEFECTS 4 | agency-partial | partial |
| centre-bell | gates | clean | single-source | not-applicable |
| bridgestone-arena | bag | DEFECTS 2 | republish | not-applicable |
| bridgestone-arena | parking | DEFECTS 1 | republish for the seven lot names, location sentences and the other purchase/shuttle sentences (club page is a near-verbatim copy); single-source for the Ragland 'on entering the facility or online' purchase clause and the Nissan 'without a conflict at Nissan Stadium' qualifier; single-source for officialParkingUrls | not-applicable |
| bridgestone-arena | transit | DEFECTS 4 | agency-partial | partial |
| bridgestone-arena | gates | clean | none | not-applicable |

Every defect was a citation, scope or confirmation-record error; no number, URL or null moved. Fixes applied in v2:

- Little Caesars gates: the stored sentence was the club's while the citation was the operator's, and "independent" was claimed for a near-verbatim republish. v2 stores the operator sentence under the operator citation, type republish.
- Little Caesars transit: "free to ride" was cited to a club page that does not say it; "along Woodward Ave." is on no agency page; the record wrongly said no agency names Sproat St (the QLINE stop list does). v2 keeps only elements carried by both the club A-Z and an agency page.
- Centre Bell transit: Gare Centrale, Gare Lucien-L'Allier and the fare advice are on no STM page; the record asserted outside knowledge about exo. v2 stores the two STM-listed stations only.
- Bridgestone transit: "WeGo Central" and "main transit hub" are on no WeGo page and the airport-to-WeGo-Central endpoint was synthesized; the record misstated "express" (the timetable labels one late trip DOWNTOWN EXPRESS and does not describe the route as express). v2 stores "WeGo Route 18 runs between Nashville International Airport and downtown."
- Bridgestone bag: the clear-bag sentence was cited to the bag-policy page, which carries only Reading A; it is Reading B on the arena-policies page. v2 cites the arena-policies page, which carries both readings and therefore every sentence of the note, and words the clear-bag sentence from that page.
- Bridgestone parking: the field-level "republish" hid two operator-only clauses. v2 drops the Ragland purchase clause and records the Nissan "without a conflict" qualifier as an exception in the confirmation record.

## 4. Verify pass 2 (v2 set)

Pass 2 re-read every page against v2, confirmed all six pass-1 fixes, and re-tested the six cells that were already clean.

| Building | Field | Pass 2 | Pass-1 fixes | Confirmation type verified | Agency |
|---|---|---|---|---|---|
| little-caesars-arena | bag | clean | fixed | republish | not-applicable |
| little-caesars-arena | parking | clean | fixed | parkingLots: single-source (verified); parkingLotMapUrl: single-source (verified); ridesha | confirms |
| little-caesars-arena | transit | DEFECTS 1 | fixed | agency | confirms |
| little-caesars-arena | gates | clean | fixed | republish | not-applicable |
| centre-bell | bag | clean | fixed | single-source | not-applicable |
| centre-bell | parking | clean | fixed | parkingLots: republish by club FAQ (verified, agreed core only); officialParkingUrls: sing | confirms |
| centre-bell | transit | DEFECTS 1 | fixed | agency | confirms |
| centre-bell | gates | DEFECTS 1 | fixed | single-source | not-applicable |
| bridgestone-arena | bag | clean | fixed | republish (BAG POLICY block byte-identical on the club A-Z; the clear-bag sentence is oper | not-applicable |
| bridgestone-arena | parking | clean | fixed | parkingLots: republish by club parking-directions with one recorded exception (verified);  | confirms |
| bridgestone-arena | transit | DEFECTS 1 | fixed | agency | confirms |
| bridgestone-arena | gates | clean | fixed | none | not-applicable |

Eight of twelve cells clean. The four remaining defects:

- Centre Bell gates: `ruleText` paraphrased the club sentence ("event-specific", an imperative "confirm" for the page's "it is always preferable to confirm"). The only stored-value defect in pass 2. v3 stores the page sentence verbatim.
- Little Caesars transit: my confirmation record said no agency page names a stop for the building. The People Mover Grand Circus Station page lists LITTLE CAESARS ARENA under Destinations Nearby, so one agency does. Record corrected; the stored value was already clean.
- Centre Bell transit: the verifyNotes paragraph was stale against v2 (still described four names and an unfetched STM page). Record corrected; the stored value was clean.
- Bridgestone transit: the verifyNotes said WeGo "confirms the route and hub"; the hub is operator-only and held, as the same record says elsewhere. Record corrected; the stored value was clean.

Across two passes no number, URL, null or verified flag changed. Every defect found on this gate was a citation, scope, confirmation-type or record error.

**Under the gate rule, none of the three payloads is clean as of the last verifier.** All eight verifiers of the brief are spent; v3 (the four fixes applied) has not been re-verified. Three of the four fixes touch provenance text that never renders; the fourth substitutes a verbatim page sentence for a paraphrase on an overlay proposed held. The decision the rule leaves to Matt: authorize one more pass of 4 on v3, or accept v3 on the record above.

## 5. Proposed verified flags

Per field, "verified" below means the value is carried by the cited page and confirmed by the source the brief requires (a second domain for bag, parking and gates; the agency for transit), with the confirmation type recorded. "Withheld" means banked in the payload's held block and not written to the published field.

**bridgestone-arena: verified true proposed.** Bag verified (republish; clear-bag sentence operator-only, disclosed). Parking verified (republish; one recorded exception; the attached garage withheld as operator-only). Transit verified (WeGo confirms Route 18 airport to downtown; hub, $2 fare and express withheld). Gates: no source on either domain, overlay untouched. Floor: geo + bag + parking + transit. The brief's condition "Gate 1 clean AND WeGo confirmed": WeGo confirmed; clean only after the v3 record fix, which is unverified.

**little-caesars-arena: verified true proposed, with parking withheld.** Bag verified (republish). Gates verified on the Red Wings overlay (republish). Transit verified (QLINE stop list, QLINE FAQ and the People Mover station page confirm every stored element; "nearest" and the Woodward and Sproat bus stop withheld). Parking: the six garage names are operator-only and would publish single-source inside a verified building, so they are withheld to the held block along with the map URL and rideshare drop-off, on the same rule that withheld the Bridgestone attached garage; the club page agrees only on hours and the 10-minute walk. Floor: geo + bag + transit. Clean as of pass 2 on every stored value; one record fix unverified.

**centre-bell: verified true proposed with bag and gates withheld, or held whole; Matt's call.** Parking verified (republish; price ceiling contradicted and omitted; operator-only details withheld). Transit verified (STM Line 2 Orange lists both stored stations; the two Gare names and the fare advice withheld). Bag: single-source (two identical operator pages, club silent), withheld. Gates: single-source (club FAQ only, and that page carries older numbers than the operator on two adjacent facts), overlay held. Floor with bag withheld: geo + parking + transit. The alternative is to hold the building until a second bag source exists; a verified Centre Bell hub would show parking and two Metro stations and no bag policy.

Repoint (Gate 2 item 3): `venues/centre-bell.bagPolicyUrl` to https://centrebell.ca/en/security, confirmed to carry the policy in both passes. MSG untouched.

Two things Gate 2 needs that the current writer does not do: the confirmation type per field is not a field `seed-venuehubs-facts.js` writes, so the execute needs either a small writer extension (an additive `confirmations` map on the building doc and overlay) or a one-off writer that mirrors the seed script's ops, snapshot and read-back and adds the map; and withholding a field inside a verified building is a payload decision (null in the field, value in held), which the Little Caesars parking withhold still has to be applied to the payload before execute (v3 carries the lots populated, as harvested).

## 6. Scrape ledger

| # | Building | Page | Result |
|---|---|---|---|
| 1 | little-caesars-arena | https://www.313presents.com/venue/little-caesars-arena/little-caesars-a-z-guide | 200, 143,620 chars |
| 2 | little-caesars-arena | https://www.313presents.com/venue/little-caesars-arena/little-caesars-rules-policies | 200, 38,541 chars |
| 3 | little-caesars-arena | https://www.313presents.com/venue/little-caesars-arena/directions-parking-1 | 200, 61,882 chars |
| 4 | little-caesars-arena | https://www.313presents.com/plan-your-visit/public-transportation | 200, 19,000 chars |
| 5 | little-caesars-arena | https://www.nhl.com/redwings/arena/a-z-guide | 200, 99,847 chars |
| 6 | little-caesars-arena | https://www.nhl.com/redwings/arena/parking-and-directions | 200, 34,349 chars |
| 7 | little-caesars-arena | https://www.qlinedetroit.com/how-to-ride | 200, 12,302 chars |
| 8 | little-caesars-arena | https://www.thepeoplemover.com/grand-circus-park | 200, 7,763 chars |
| 9 | little-caesars-arena | https://www.qlinedetroit.com/faq/ | 200, 8,227 chars |
| 10 | little-caesars-arena | https://www.qlinedetroit.com/how-to-ride/assets/pdf/2022_qline_station_map.pdf | FAIL 404 |
| 11 | centre-bell | https://www.stm.info/en/offers-and-outings/events/canadiens-de-montreal | FAIL 403 |
| 12 | centre-bell | https://www.stm.info/en/info/networks/metro/lucien-lallier | 200, 36,853 chars |
| 13 | centre-bell | https://www.stm.info/en/info/networks/metro/ligne-2---orange | 200, 24,382 chars |
| 14 | bridgestone-arena | https://www.wegotransit.com/ride/maps-schedules/bus/18-airport | 200, 80,603 chars |
| 15 | bridgestone-arena | https://www.wegotransit.com/ride/fare-info-and-next-arrivals | 200, 11,312 chars |

Scrapes: 15 of 20. Map calls (Firecrawl /v2/map discovery, not scrapes): 4 (nhl.com/redwings, wegotransit.com, qlinedetroit.com, thepeoplemover.com). Plain HTTP fetches: 0.
