# NHL arena data, wave 1, Gate 2 report: TD Garden only

Date: 2026-09-03. Authorized scope: write venueHubs/td-garden from `audit/nhl-wave1/nhl-w1-write-v2-td.json` through the extended writer on pipeline main. PPG Paints, Ball Arena, American Airlines Center, United Center: NOT written. Pistons overlay: not in the batch.

## Timeline (UTC)

| Time | Step | Result |
|---|---|---|
| 23:05:42 | snapshot venueHubs/td-garden, its two overlays (boston-bruins, boston-celtics), venueHubs/crypto-com-arena and its three overlays, venues/td-garden | `audit/nhl-wave1/g2/snapshot-td.2026-09-03T23-05-42-286Z.json`; td-garden was verified false with no facts, sources 0, no confirmations key |
| 23:06:00 | pre-write render baselines: /venues/crypto-com-arena, /nhl/boston-bruins, /nhl, /venues | Bruins page: no hub link; /nhl rail: no TD Garden; /venues: 162 |
| 23:06:14 | write, pipeline main afa04f7, `seed-venuehubs-facts.js --execute` | writer snapshot taken, guard passed on 1 payload, 1 update applied, writer read-back OK, indexing floor 1/1, clearBag guard 0 open |
| 23:06 | read-back diff against the write payload | 25 comparisons, 0 mismatches; overlays untouched (both verified false, gatesOpen null, no confirmations key) |
| 23:06 | banked-value leak check against the full v2 held store | 5 banked strings, 29 pieces and figures checked, 0 leaks; bagMaxDimensions, clearBagRequired, bagPolicyNotes all null on the live doc |
| 23:07:10 | revalidate /venues/td-garden, /nhl, /nhl/boston-bruins, /nba/boston-celtics, /venues, /venues/bag-policies, /venues/crypto-com-arena | 7 paths, 200 |
| 23:07:34 | post-write renders | see below |
| 23:08:38 | IndexNow /venues/td-garden and /nhl/boston-bruins | 2 urls, 200 through the site route, which posts to api.indexnow.org and www.bing.com/indexnow |

## What the live doc carries

| Key | Value |
|---|---|
| verified | true (verifiedAt 2026-09-03T23:06:15.327Z) |
| parkingLots | North Station Garage: "Located directly underneath TD Garden; open daily from 5:00 AM – 1:00 AM." |
| publicTransit.lines | Green Line, Orange Line, Commuter Rail |
| publicTransit.notes | "Green and Orange Lines: take either line to the North Station stop. Commuter Rail: North Station (TD Garden at the same location). From Back Bay, take the Orange Line to North Station." |
| bagPolicyUrl | https://www.tdgarden.com/venue-info/policies (pointer only; bag values held) |
| officialParkingUrls | https://www.tdgarden.com/plan-your-visit/directions-parking |
| sources | 4 entries, one per written field, all tdgarden.com |
| confirmations | parkingLots republish, publicTransit independent |

## Render checks

| Check | Expected | Result |
|---|---|---|
| /nhl rail lists td-garden | yes | yes: "TD Garden Boston · Bag policy, parking & gates" inserted, link to /venues/td-garden; the word-level diff shows nothing else changed |
| /venues count | 163 | 163 (was 162); TD Garden appears in the NHL section and the NBA section, as designed for a shared building |
| Bruins club page shows hub link | yes | yes: the only inserted text is "Full gameday guide Parking, bag policy and gameday info for TD Garden ›" linking /venues/td-garden |
| Bruins club page shows no venues prose block | none | none. Nothing was removed: venues/td-garden carries only address and geo fields (no prose), so no prose block rendered before the write either. The address line "100 Legends Way, Boston, MA 02114" is present before and after from a different surface |
| Negative control: /venues/crypto-com-arena visible text | byte-identical | byte-identical (cmp), both fetched today, control revalidated with the batch |
| /venues/td-garden hub | renders the written values, no held value | North Station Garage, the Green and Orange Lines sentence and the Back Bay sentence present; the policies pointer link present; no "6in", "", "GA doors" or "East or West"; no robots noindex meta |
| Celtics club page | hub link | link to /venues/td-garden present (no pre-write capture for this page) |

Hub page title as served: "TD Garden Bag Policy, Parking & Food | 2026 Gameday Guide | PromoNight". That is the shared hub template title; the bag section on this hub is the pointer only. Reported, not changed.

## Verification pass

Three read-only verifiers (read-back and blast radius, banked-value leak, render evidence) checked the saved evidence after the write; result in `audit/nhl-wave1/g2/gate2-verify-result.json`. All three passed with zero findings.

- Read-back: every fact field, the 4 sources entries, the 2 confirmations entries, verified and verifyNotes are byte-identical to the write payload. Exactly 10 top-level keys changed on the doc against the snapshot, all of them keys the writer writes (the six written fields and maps plus verified, verifiedAt, verifyNotes, updatedAt); identity, geo, capacity, tenants and the 13 null fact fields are unchanged. Both td-garden overlays and the crypto-com-arena doc with its three overlays are identical to the snapshot, Timestamps included.
- Leak: no held figure or sentence ("$65", "6in", "GA doors", "Eversource", "Proshop", "East or West", "Lost Ticket", "$15", "Bag Check") appears in any fact field, sources, confirmations, or any rendered surface; the hub's bag FAQ reads "TD Garden has not published a bag size limit we could verify" with the pointer to the official policy. verifyNotes carries "$65" and "GA doors" only as labelled held items, as a provenance record should.
- Render: every expectation in the table above holds. Two non-blocking observations: the rail-card subtitle "Bag policy, parking & gates" and the hub title "Bag Policy, Parking & Food" are the shared template copy on every card and hub (Crypto.com Arena carries the identical subtitle), while this hub has no gate-time or food content and bag is pointer-only.
- Coverage gap the verifiers named, closed afterwards with one read: venues/td-garden re-read after the write and compared to the snapshot: MATCH.

## Not written, carried

- ppg-paints-arena: v3 (`audit/nhl-wave1/nhl-w1-facts-v3-unverified.json`) carried to wave 2 for a one-verifier diff read on the two corrected labels (rideshare zone on both domains; the nickname "T" on operator and club, not agency).
- ball-arena, american-airlines-center, united-center: v2 payloads (`audit/nhl-wave1/nhl-w1-facts-v2.json`) carried unchanged to wave 2 for re-flagging under the operator rule.
- Pistons overlay: no Pistons page states a door time.

## Ruling carried into wave 2 (recorded, not implemented)

Confirmation type gains a third value, operator: for bag, parking and gates a claim verifies on the operator's own pages when every operator page that mentions the field has been read and they agree, or rule 1.5 has nulled the disputed value; a club republish is recorded when present but no longer required. Transit unchanged: agency page required. Guard, writer and checklist item 5 update accordingly, pinned by tests. Centre Bell bag re-flags under this rule; Centre Bell gates stay held (club-only source).
