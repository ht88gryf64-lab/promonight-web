# NHL arena data, Phase 1 dry run: three buildings through the hub pass

2026-09-02. Read-only against Firestore. Dry-run output to local files. Nothing written to venueHubs, nothing merged.

Budget as spent: 23 of 24 fetches (9 plain HTTP, 14 Firecrawl); harvest and extraction by the main agent with 0 subagents; verify fan-out 8 of the 8 cap (two passes of 4 shards, sharded by field class, never by building).

Working directory: `scratchpad/p1/` (harvest checkpoints under `logs/`, payloads `nhl-p1-facts.json` (v1), `-v2.json` (after pass 1) and `-v3.json` (after pass 2, the current proposal), the writer's exact ops in `dry-run-ops-v3.json`, verify shards in `verify-shards.json` and `verify-shards-v2.json`, the fetch ledger in `fetch-ledger.md`).

## Step 0: the Northstar line

Committed as `31c2f4a` on `fix/populate-script-northstar`, branched from main at `ff8df6e`, one file, one line: the Twins `publicTransit` value in `scripts/populate-plan-your-visit.ts` now reads "METRO Blue and Green lines stop at Target Field Station, directly connected to the stadium." which is byte-for-byte what `venues/target-field` holds today. Not pushed, not run; `tsc --noEmit` reports nothing for the file.

The overrides file carried five transit sentences over its history (Target Field, Paycom Center, Kauffman Stadium, AT&T Stadium, Rogers Centre). Grepping their service names across the three populate scripts and every seed JSON in `scripts/`:

- Northstar: only the line just removed.
- OKC Streetcar, RideKC, Trinity Railway Express, TTC Line 1, GO Transit, UP Express: all still operating; RideKC and UP Express appear in the MLB seed, which is fine.
- **One more retired service is managed the same way and was NOT removed** (outside the one-line scope): `scripts/mlb-plan-your-visit.json` line 248, Nationals Park transit, "...and the DC Circulator runs from Union Station." The DC Circulator ceased service 2024-12-31. The same script writes that JSON field to `venues/nationals-park.publicTransit` on `--execute`. The field is silenced at render since 2026-08-29, but the claim is still armed in the seed.

## Step 1 and 2: per building, per field

Verify vocabulary. **Confirmed** = the value is carried on two domains (operator and club). **Republish** = the second domain carries it word for word, so it is a copy, not an independent statement; recorded as confirmed with that caveat and left to Matt whether a republish meets the bar. **Single-source held** = one domain only. **Contradicted** = the harvest disagrees with itself in a way rule 1.5 has to resolve. All values below are from `nhl-p1-facts-v3.json`: the first verify pass refuted v1 into v2, the second pass refuted v2 into v3, and v3 itself has NOT been re-verified because the 8-shard cap is spent. Both passes are recorded in section "Verify passes".

### little-caesars-arena (Red Wings, Pistons; operator 313 Presents; 85 upcoming promos)

| Field | Value extracted | Source (operator or club) | Verify | venues prose |
|---|---|---|---|---|
| bag | none | none. The operator A-Z guide and the operator "Prohibited Items and Entry Policies" page both answer HTTP 406 to plain fetches with full browser headers (four attempts across the two). Firecrawl not spent per the brief. Club site (nhl.com/redwings) is client-rendered; no policy text in its HTML. | no source | silent (no venues prose exists for this building) |
| parking | no lot evidenced; `officialParkingUrls` pointer only | operator directions-parking-1 (plain HTTP 200). The page's lot list is JS-loaded and did not render; the only building-scoped sentence is "32 parking locations throughout The District Detroit ... within a 10-minute walk". | no lot; pointer only | silent |
| transit | QLINE, People Mover, SMART Bus, DDOT, with the page's own facts as the note; banked and held | operator all-venue transit page (plain HTTP 200). Not building-scoped: the one venue-specific sentence names Grand Circus Park for the Fox Theatre and Comerica Park. | single-source held | silent |
| gates | none | none | no source | silent |

Payload: `verified: false`, facts 1 of 15, no overlay write. Below the floor.

Finding: 313presents.com is a 406 site for its policy pages (A-Z, rules-policies, even the parking map image class), while its parking and transit pages returned 200. Phase 0 classed it "text" from a single landing-page fetch; that classification was wrong for the pages that matter. Little Caesars needs the same Firecrawl path as Bridgestone.

### centre-bell (Canadiens; operator Groupe CH, which also owns the club; 29 upcoming promos)

| Field | Value extracted | Source | Verify | venues prose |
|---|---|---|---|---|
| bag | `bagMaxDimensions` 15 x 10 x 4 cm; `clearBagRequired` null (rule 1.6, no clarity term on any page); `bagPolicyUrl` centrebell.ca/en/security; notes: backpacks, coolers and sports bags not allowed at any size; hard-covered briefcases also not allowed; bags must not exceed 15 x 10 x 4 cm; venue encourages bags that fit under the seat; policy can vary by event | operator security page (Firecrawl). The operator FAQ carries the same block word for word (one source, two pages). Club FAQ has no bag statement. | single-source held | bagPolicyUrl DISAGREES as a pointer: the stored club FAQ URL carries no bag policy |
| parking | one lot, "Centre Bell parking (1225 Saint-Antoine Street West)": open to the public; opens at noon on event nights; non-event weekdays 5:30 a.m. to 7 p.m. at $20; pickup trucks not accepted during hockey games; studded tires forbidden at all times; prices subject to change | operator getting-here (Firecrawl) + club FAQ (Firecrawl, nhl.com) | confirmed for that core (the club block is a light republish); the event-night ceiling is contradicted ($20 to $49 operator, $20 to $45 club) and omitted; operator-only details held out of the note (cards only, height limits, EV charging, advance reservation) | AGREES on address and the $20 to $45 figure; "directly beneath the arena" unsupported |
| transit | notes only (the page prints four place names with no mode or line label, so `lines[]` is empty): "By public transit: Bonaventure, Lucien-L'Allier, Gare Centrale or Gare Lucien-L'Allier. Buy your round-trip transit fare in advance and avoid the wait." | operator getting-here. Club FAQ only points back to the operator page. | single-source held | AGREES on the two Metro stations; Orange Line label, STM routes 36/61/107/150/178, Underground City and BIXI have no support in the harvest |
| gates (overlay montreal-canadiens) | 90 minutes before game time; 7:00 p.m. game opens 5:30 p.m.; applies to regular games, confirm per event; variance: CIBC VIP entrance and the M2 Marché entrance open at 5:00 p.m. on game nights | club FAQ only (nhl.com). Operator site states no door time. | single-source held. The club FAQ also shows older numbers than the operator on two adjacent facts (scoreboard fee $100 vs $200, parking ceiling $45 vs $49), which weakens a value only it carries. | AGREES on 90 minutes and the worked example (near-verbatim, so likely derived); "warmups start about 30 minutes before" unsupported |

Payload: `verified: false`, facts 5 of 15, one overlay banked with `verified: false`. Below the floor. Only parking clears the two-domain bar.

### bridgestone-arena (Predators; operator Powers Management, the club's affiliate; 51 upcoming promos)

| Field | Value extracted | Source | Verify | venues prose |
|---|---|---|---|---|
| bag | `bagMaxDimensions` 12 x 12 x 6 in; `clearBagRequired` null (rule 1.5); `bagPolicyUrl` bridgestonearena.com/plan-your-visit/bag-policy; notes limited to what survives both readings: bags discouraged; backpacks prohibited; over 12 x 12 x 6 in not allowed; clear bags up to 12 x 12 in permitted after X-ray (both readings admit them); diaper and medical bags after X-ray; no on-site storage; confirm on the arena's page | operator bag-policy page (Firecrawl), also the operator A-Z and arena-policies BAG POLICY section; club A-Z guide on nhl.com carries the same 14 lines byte for byte | confirmed by republish. Contradicted within the operator site: the arena-policies SCREENING section says "APPROVED BAGS: Medical bags, parenting bags and CLEAR 12 x 12 bags", which bans the non-clear mid-tier and small-bag classes the bag-policy page admits, so those allowances are omitted per the item-class test | bagPolicyUrl pointer to the A-Z guide AGREES |
| parking | seven lots with the operator page's own location and purchase sentences: Fifth + Broadway, 222 2nd Ave, Nashville Yards, Pinnacle at Symphony Place, Ragland Lot, Music City Center, Nissan Stadium Lot R with the free BEEP shuttle (2 hours before, every 15 to 20 minutes, until 2 hours after). The operator-only attached garage at 6th and Demonbreun is held out because the building is proposed verified | operator directions-parking (Firecrawl) + club parking-directions (Firecrawl, nhl.com) | confirmed for all seven (the club page is a near-verbatim republish); `parkingLotMapUrl` null because the map image answers 406; the club parking URL is recorded in the notes, not in `officialParkingUrls`, because the cited operator page does not carry it | AGREES (Metropolis, named garages, Lot R cadence, bridge walk) |
| rideshare | held, field null: the pages print a "Guest Drop-Off Point" (eastbound curb lane of Broadway between 6th and 5th Avenues) on both domains but never call it a rideshare point, so assigning it to `rideshareDropoff` would be an inference | operator A-Z, operator arena-policies, club A-Z | confirmed as a guest drop-off point (republish), held as a field | AGREES on Lyft as official partner (not stored; sponsorship, not a drop-off) |
| transit | WITHHELD from the payload (null); banked under `held` with the page's own labels: WeGo Public Transit; WeGo Central downtown; lines within, into and out of downtown including Route 18 to and from the airport on an express route; $2 one-way (bike share and scooters left out, the page files them under Other Ways to Arrive) | operator directions-parking only; no club page carries transit | single-source held. Withheld because the building is proposed verified and a verified building publishes transit | AGREES with the operator page on every claim (WeGo, $2, Route 18, BCycle, Lyft) |
| gates | none | none on six content pages (operator A-Z has no DOORS entry; club A-Z mirrors it; the club FAQ URL serves the A-Z byte for byte; the club arena landing page captured as a 404 shell) | no source | "Doors typically open 90 minutes before Predators games" is UNSUPPORTED on both domains |

Payload: `verified: true` proposed, facts 4 of 15, no overlay. Writer dry run projects INDEXED (geo + bag + parking). The weak point for the ruling: both cross-domain confirmations are republishes of operator text.

### Is gateTimes a field the hub pass extracts?

Yes, at the tenant level, not the building level. The facts format carries `tenants[].gatesOpen {minutesBefore, ruleText}` plus `gateVariance`, sourced per overlay (`sources.gatesOpen`), written by `seed-venuehubs-facts.js` to `venueHubs/{slug}/tenants/{teamId}`, and rendered by `rendersGates` only when that overlay is `verified` and carries sub-provenance. The lane sweeps did extract it for their own league: `climate-pledge-arena/tenants/seattle-storm` holds "For Seattle Storm games, all doors will open 60 minutes prior to tipoff" sourced to the arena guide, and the live hub page renders it in the Gates row, the FAQ and the FAQPage JSON-LD (confirmed by fetch, 2026-09-02). The Sparks overlay on crypto-com-arena is verified but has no gate time. The NHL overlays on both verified hubs (Kings, Kraken) are empty and held because Lane 2 and Lane 3a were WNBA sweeps that never touched the NHL tenant. So "renders nowhere today" is true for every NHL club and false for the Storm. In this dry run the only gate value found is Centre Bell's, on the club FAQ alone.

## Step 3: the Bridgestone question

**Firecrawl clears the 406.** All four operator pages that answer 406 to plain HTTP came back at HTTP 200 with full content through the pipeline's own fetch module: A-Z guide 27,130 chars, bag policy 13,040, directions and parking 42,149, arena policies 25,409, each in about 10 seconds and one attempt. The club pages on nhl.com (client-rendered) also came back complete.

What that unblocks, precisely:

- The 406 pair from Phase 0, bridgestone-arena and amerant-bank-arena: unblocked, same response class, evidence in hand.
- little-caesars-arena: newly identified as the same 406 class on its policy pages (and on the parking map image); unblocked by the same path.
- The Cloudflare 403 pair, united-center and rogers-arena: not tested. A Cloudflare challenge is a different mechanism from a 406 content-negotiation block, so the inference is reasonable but it is an inference. One Firecrawl scrape each would settle it.

## Step 4: the MSG and Centre Bell pointers

**Centre Bell: repoint confirmed.** `venues/centre-bell.bagPolicyUrl` is https://www.nhl.com/canadiens/fans/faq, which carries no bag statement (harvested; its Bell Centre section covers doors, parking, cameras and the scoreboard). The policy text lives at https://centrebell.ca/en/security (prohibited items list, 15 x 10 x 4 cm rule, per-event variance) and identically at https://centrebell.ca/en/faq. Proposed repoint: the security page. Not written.

**MSG: not confirmed, hold.** Three fetches: the stored picker page (Phase 0, Firecrawl: five-venue chooser), the arena-specific https://www.msg.com/plan-your-visit/visit-madison-square-garden (plain fetch is a 59-char shell; Firecrawl 7,169 chars: seat map, getting to MSG, "Entry at MSG", MSG Eats, no bag text), and the page "Entry at MSG" links to, https://www.msg.com/madison-square-garden/entrances (Firecrawl 6,565 chars: CLEAR lanes at 8th Avenue entrances B and C, no bag text). No page in the harvest carries the MSG bag policy; the repoint target is not located. The stored pointer remains a dead end and should not be trusted as a harvest seed until a policy page is found (one more scrape at a guessed URL was not spent).

## Verify passes

Fan-out declared and used: 4 shards in pass 1, 4 in pass 2, 8 total, the cap. Each shard took one field class across all three buildings, read only the harvested pages, the payload and the extraction rules, and was told to refute.

**Pass 1 (on the first payload) refuted real defects, all fixed in v2:**

- Transit, Little Caesars: two labels the page never prints ("QLINE streetcar", "Detroit People Mover") and a dropped "pilot" on D2A2. Fixed to the page's words.
- Transit, Centre Bell: a sentence about what STM publishes, on a page never fetched. Removed.
- Transit, Bridgestone (held): "is nearby" and "serve downtown" were not on the page. Fixed to "is downtown" and "Nashville is home to".
- Parking, Little Caesars: a district summary stored as a lot under an invented name, and a SpotHero promo recast as a reservation channel. Now no lot, pointer only.
- Parking, Centre Bell: "beneath the arena", "indoor" and "garage" came from the venues prose and the un-cited club page, exactly the import the rules forbid; the agreed $20 non-event rate had been dropped along with the contested ceiling; "event days" for "event nights". All fixed; the note now carries only two-domain text and names operator-only details as held.
- Parking, Bridgestone: Ragland and Music City Center notes used the club page's wording under the operator citation; the Lot R name was a composite; `rideshareDropoff` held a sponsorship line while the harvest carried an actual drop-off point on both domains; the attached on-site garage was missing from the operator-only inventory. All fixed.
- Bag, Centre Bell: an encouragement fused onto the mandate as "should"; hard-covered briefcases dropped. Fixed.
- Bag, Bridgestone: verdict contradicted. The note published the mid-tier and small-bag allowances that the arena-policies SCREENING section withholds; under the rule 1.5 item-class test an allowance any reading bans must be omitted. Trimmed to what survives both readings.
- Gates, Centre Bell: the "applies to regular games ... confirm with the organizer" qualifier was dropped from `ruleText`. Restored.
- Gates, Bridgestone: the shard found the club arena landing capture is a 404 shell and the club FAQ URL is a byte copy of the club A-Z, so the "eight pages" count was really six. Corrected in the notes.

**Pass 2 (on v2):** the second shard set re-read every page against v2. Every first-pass finding was confirmed fixed (12 of 12). Verdicts on v2: bag no-source / single-source / confirmed-by-republish; parking single-source (pointer only) / confirmed-by-republish / confirmed-by-republish; transit single-source on all three (Bridgestone published null); gates no-source / single-source / no-source. New refutations, all applied in v3 and none re-verified:

- Bag, Centre Bell: "regardless of size" had been transferred onto hard-covered briefcases, which the page lists in a separate bullet. Split into its own clause.
- Bag, Bridgestone: omitting clear bags manufactured a prohibition. Both readings admit clear bags up to 12 x 12 in (Reading B: "CLEAR 12 x 12 bags will be permitted following X-Ray screening"), so under rule 1.5 the allowance must publish. Restored.
- Transit, Little Caesars: "SMART bus" and "DDOT bus" were not the page's printed forms; the note described the source instead of stating facts; the page's own station typo ("Grand Cirus Park") had been silently corrected. Labels set to the printed forms and the note rewritten as reader copy from page facts. Still held and still not building-scoped.
- Transit, Centre Bell: four place names stored under `lines[]` asserted a label the page does not carry. Moved to `notes` with `lines[]` empty (the floor test accepts notes alone).
- Transit, Bridgestone (held): "WeGo Public Transit bus" and "WeGo Route 18 airport express" were composed labels; bike share and scooters had been folded into transit from the page's "Other Ways to Arrive" section. Held value now uses "WeGo Public Transit" and drops the non-transit modes.
- Parking, Bridgestone: "Parking at Bridgestone Arena" was a single-source lot inside a verified building; moved to `held`. "season ticket holders" replaced the page's branded "Season-Ticket Citizens ... available for purchase"; restored. The club parking URL sat in `officialParkingUrls` without a citation; moved to the notes. The verifyNotes wrongly said Pinnacle's "purchased in advance" was club-only (the operator says it too); corrected.
- Parking, Centre Bell: the club FAQ does say "Indoor parking", so the verifyNotes claim that neither page says indoor was wrong; corrected. "1225 Saint-Antoine St W" and "not accepted at any time" were paraphrases; replaced with the page's "1225 Saint-Antoine Street West" and "forbidden at all times". The club FAQ URL moved out of `officialParkingUrls` for the same citation reason.
- Rideshare, Bridgestone: the page prints a "Guest Drop-Off Point", not a rideshare point; assigning it to `rideshareDropoff` was an inference. Field set to null, value held with its three sources.

What did not move across two passes: every number (15 x 10 x 4 cm, 12 x 12 x 6 in, $20, 90 minutes, 5:00 p.m., 2 hours, 15 to 20 minutes, 5 to 7 minutes, 10 to 12 minutes), every URL in the sources maps, the three `clearBagRequired` nulls, the three verified flags, and the four no-source or single-source holds. Both passes found only wording, labelling and citation-scope defects, which is what the rules exist to catch; none of them would have been caught by a read-back.

v3 passes the pipeline write guard on all four payloads and the writer dry run still projects 1 of 3 indexable (Bridgestone, facts 4 of 15). v3 is the proposed execute payload, on the record as corrected but not re-verified.

## Fetch ledger

| # | Building | Page | Fetcher | Result |
|---|---|---|---|---|
| 1 | little-caesars-arena | 313presents.com/venue/little-caesars-arena/little-caesars-a-z-guide | plain | 406 (attempt 1) |
| 2 | little-caesars-arena | 313presents.com/venue/little-caesars-arena/directions-parking-1 | plain | 200, 6,276 chars (JS lot list unrendered) |
| 3 | little-caesars-arena | 313presents.com/plan-your-visit/public-transportation | plain | 406 (attempt 1) |
| 4 | little-caesars-arena | 313presents.com/venue/little-caesars-arena/little-caesars-a-z-guide | plain, full headers | 406 (attempt 2) |
| 5 | little-caesars-arena | 313presents.com/plan-your-visit/public-transportation | plain, full headers | 200, 16,184 chars (all-venue page) |
| 6 | little-caesars-arena | 313presents.com/venue/little-caesars-arena/little-caesars-rules-policies | plain, full headers | 406 |
| 7 | centre-bell | centrebell.ca/en/faq | Firecrawl | 200, 23,118 chars |
| 8 | centre-bell | centrebell.ca/en/getting-here | Firecrawl | 200, 7,465 chars |
| 9 | centre-bell | nhl.com/canadiens/fans/faq (club) | Firecrawl | 200, 23,076 chars |
| 10 | centre-bell | centrebell.ca/en/security | Firecrawl | 200, 7,987 chars |
| 11 | bridgestone-arena | bridgestonearena.com/a-to-z-guide | Firecrawl | 200, 27,130 chars (406 to plain HTTP in Phase 0) |
| 12 | bridgestone-arena | bridgestonearena.com/plan-your-visit/bag-policy | Firecrawl | 200, 13,040 chars |
| 13 | bridgestone-arena | bridgestonearena.com/plan-your-visit/directions-parking | Firecrawl | 200, 42,149 chars |
| 14 | bridgestone-arena | bridgestonearena.com/arena-info/arena-policies | Firecrawl | 200, 25,409 chars |
| 15 | bridgestone-arena | nhl.com/predators/arena (club) | Firecrawl | 200 but a 404 error shell, 14,809 chars of chrome |
| 16 | bridgestone-arena | nhl.com/predators/fans/a-to-z-guide (club) | Firecrawl | 200, 38,777 chars |
| 17 | bridgestone-arena | nhl.com/predators/arena/parking-directions (club) | Firecrawl | 200, 21,116 chars |
| 18 | bridgestone-arena | nhl.com/predators/fans/faq (club) | Firecrawl | 200, byte-identical to the club A-Z |
| 19 | bridgestone-arena | bridgestonearena.com/assets/img/ParkingMap-Metropolis-4167254d90.jpg | plain HEAD | 406 |
| 20 | madison-square-garden | msg.com/plan-your-visit/visit-madison-square-garden | plain | 200 shell, 59 chars |
| 21 | madison-square-garden | msg.com/plan-your-visit/visit-madison-square-garden | Firecrawl | 200, 7,169 chars, no bag text |
| 22 | madison-square-garden | msg.com/madison-square-garden/entrances | Firecrawl | 200, 6,565 chars, no bag text |
| 23 | getpromonight.com | getpromonight.com/venues/climate-pledge-arena | plain | 200; Storm gate time renders |

Totals: 23 of 24 (plain HTTP 9, Firecrawl 14). Firecrawl was spent on the two buildings plain HTTP could not read (Centre Bell JS shell, Bridgestone 406) plus two MSG scrapes for the Step 4 confirmation; Little Caesars was held to plain HTTP per the brief and lost its policy pages to 406.

## What this dry run says about the wave plan (not built)

- The hub pass works end to end for an NHL building with two domains: harvest, extraction under the rules, an independent refute pass that catches real errors, the writer's own dry run and write guard. Bridgestone would index on execute.
- Two verify passes on three buildings turned up 12 and then 9 defects in the extractor's own output, every one a wording, label or citation-scope error the values survived. Budget the wave for two passes per building, not one.
- Every cross-domain confirmation found was a republish: the club sites on nhl.com copy operator text verbatim (Bridgestone) or restructure it lightly (Centre Bell). The two-domain bar as written in the brief is met; the independence it was meant to buy is thin. That is a ruling for Matt before the wave, because it decides whether 30 buildings can reach verified at all.
- Gate times are the field NHL club pages carry and arena sites do not (Centre Bell), and sometimes neither carries (Bridgestone). The overlay path exists; the source class is club FAQs, which showed stale adjacent numbers at Montreal.
- Plain HTTP is not a reliable harvest path even on "text" sites: 313presents.com answered 200 and 406 on sibling pages within the same hour. Firecrawl should be the default fetcher for the wave, with the credit cost that implies (14 scrapes for three buildings here, about 5 per building including club pages).
