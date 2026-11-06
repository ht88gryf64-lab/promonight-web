# NHL arena data, Phase 1 execute: Gate 3 report

2026-09-03. Executed from promo-pipeline branch `feature/venuehubs-confirmations` (feb3314, unmerged, unpushed). Budget: plain fetches 8 of 8, Firecrawl 0, verifiers 0. Writes: one venueHubs batch of 4 updates, one venues field repoint, one revalidation call for 10 paths. No IndexNow submission (not in the brief).

Files under `scratchpad/p1/g1/`: `nhl-g1-facts-v6-write2.json` (the written shape), `step0-diff2.json`, `snapshot-nhl3.2026-09-03T12-31-01-895Z.json`, `snapshot-venues-centre-bell.2026-09-03T12-41-46-486Z.json`, `execute.log`, `repoint.log`, `readback.log`, `render/` (before and after captures). The writer's own snapshot: promo-pipeline `logs/venuehubs-nhl-g1-facts-v6-write2.2026-09-03T12-41-15-170Z.snapshot.json`.

## Step 0

Regenerated write shape diffed against v6: 28 differences, all in the five classes, 0 outside. Class a: 12 confirmation records collapsed (every republish to republish, every agency to independent) plus 5 single-source pointer entries dropped as unwritable; v6 carried two republish pointer entries, not three (Little Caesars `bagPolicyUrl`, Centre Bell `officialParkingUrls`), both kept and collapsed. Class b: two Centre Bell bag claims nulled with their two source and two confirmation entries removed. Class c: Canadiens overlay omitted. Class d: Centre Bell flag true. Class e: `held.bagWithheld` and `held.gatesWithheld` added. `centre-bell.revision` left as v6's.

## Gap check and step 1

Before committing, the three building docs, all four overlays under them and `venues/centre-bell` were re-read and compared byte for byte with the 12:31Z snapshot: 8 docs, 0 moved. The writer then took its own snapshot (3 buildings, 1 overlay) at 12:41:15Z before its batch; the repoint took its own snapshot of `venues/centre-bell` at 12:41:46Z.

## Step 2

Guard passed on 4 payloads. One batch: `venueHubs/little-caesars-arena`, its `tenants/detroit-red-wings` overlay, `venueHubs/centre-bell`, `venueHubs/bridgestone-arena`. Read-back: verified flags match, floor 3 of 3 indexed. The writer's clear-bag heuristic reported Little Caesars as a SUSPECT (clearBagRequired false with "clear bags" and "clutches" in the notes). That is the rule 1.3 case four verify passes adjudicated: the non-clear allowance and the clear allowance are the same 4 x 6 x 1.5 in envelope, so clear is an alternative, not a mandate, and false stands. The guard's ADJUDICATED set does not yet carry this building, so the suspect line will repeat on future runs until it is added.

## Step 3

`venues/centre-bell.bagPolicyUrl` repointed from the club FAQ to https://centrebell.ca/en/security. The prior URL is kept on the doc as `bagPolicyUrlPrior` with `bagPolicyUrlRepointedAt`; every other field unchanged. MSG untouched.

## Step 4

Read-back diff of the written docs against the write shape: 94 comparisons across every fact field, source URL, confirmation entry, verified flag and verifyNotes on the three buildings and the Red Wings overlay; 0 mismatches. Banked-value leak check: 0 (no held string appears in any written field). Overlays not written (Pistons, Canadiens, Predators) are unchanged and carry no confirmations key.

| Doc | Stored fields | Confirmations |
|---|---|---|
| little-caesars-arena | parkingLotMapUrl, publicTransit, bagMaxDimensions, clearBagRequired, bagPolicyUrl, bagPolicyNotes, officialParkingUrls | bag dims, clear-bag, bag pointer, bag notes: republish; transit: independent |
| little-caesars-arena / detroit-red-wings | gatesOpen (90 minutes) | gatesOpen: republish |
| centre-bell | parkingLots, publicTransit, bagPolicyUrl, officialParkingUrls | parking, parking pointer: republish; transit: independent |
| bridgestone-arena | parkingLots, publicTransit, bagMaxDimensions, bagPolicyUrl, bagPolicyNotes, officialParkingUrls | bag dims, bag notes, parking: republish; transit: independent |

## Step 5, production, alias-confirmed

All six fetched pages came back `x-vercel-cache: REVALIDATED` after the notification.

- `/nhl` arena-guide rail lists Bridgestone Arena, Centre Bell, Climate Pledge Arena, Crypto.com Arena and Little Caesars Arena, each linking its hub.
- `/venues/bridgestone-arena`: no held notice; bag capsule (12 x 12 x 6 in, backpacks prohibited, clear 12 x 12 permitted, official bag policy link); seven parking lots incl. Lot R; transit "WeGo Route 18 runs between Nashville International Airport and downtown"; SpotHero and Expedia CTAs; no robots meta (indexable). Banked strings absent.
- `/venues/little-caesars-arena`: bag capsule (4 x 6 x 1.5 in, does not have to be clear, official bag policy link); parking renders both pointers and nothing else ("313presents.com ›" and "Official parking lot map ›"); transit (Sproat St., Grand Circus Park, People Mover); no robots meta. Banked garage names, drop-off and club judgments absent.
- `/venues/centre-bell`: the bag row is pointer-only: "Review the official bag policy before you arrive. Official bag policy ›" linking the operator security page, with no claim beside it; parking (Saint-Antoine Street West, hours, $20); transit (Bonaventure or Lucien-L'Allier); no robots meta. Banked bag claims, Gare names, fare advice and gate times absent.
- Gates: no gate row renders on any of the three. Bridgestone and Centre Bell have none written. Little Caesars has the Red Wings rule written, but the overlay's `verified` flag is false, exactly as v6 carried it and as the write shape preserved it, so the renderer withholds it. Flipping that one flag is a single-overlay write outside this brief.
- Club pages: not fetched. The budget went to the two before-controls, the rail, the three hubs and the two after-controls. By code inspection of the live rail component: the hub link renders when the building is indexable, which all three now are. The old venues prose block is NOT retired: the rail renders the venues block unconditionally whenever the venues doc has rows, and the Bridgestone and Centre Bell venues docs still carry parking, accessibility, bag-pointer and nearby rows (Little Caesars has none). The operator-contradicted Centre Bell figure ("roughly 20 to 45 dollars on event nights", operator says 20 to 49) is NOT silenced: no entry exists for any of the three buildings in the corpus-silence, field-exclusion or transit-suppression tables. Both are web-side changes and were not made.

## Step 6

Negative control: visible text of `/venues/crypto-com-arena` (7,048 chars) and `/venues/climate-pledge-arena` (7,045 chars) byte-identical before and after the write and revalidation. Their Firestore docs and five overlays were untouched (hash-checked at Gate 2).

## Open after this gate

1. Red Wings overlay `verified` false: the 90-minute rule is stored and sourced but not rendered.
2. Little Caesars clear-bag adjudication not yet in the guard's ADJUDICATED set.
3. Nashville and Montreal club pages still render the old venues prose beside the new hub link; the Centre Bell "20 to 45 dollars" figure is unsilenced.
4. IndexNow not submitted for the three hubs and the rail.
5. promo-pipeline `feature/venuehubs-confirmations` (feb3314) unmerged and unpushed; the production write ran from it. promonight-web audit docs untracked; Step 0 Northstar commit 31c2f4a unpushed.
