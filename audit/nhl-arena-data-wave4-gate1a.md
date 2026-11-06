# NHL arena data, wave 4, Gate 1a: cold re-derive

Date: 2026-09-04. Three build subagents, no verifiers, no writes, nothing merged. Deriver A, Deriver B and Differ C exactly as specified in section 2a of the wave 4 plan.

## 1. Budgets

| Budget | Cap | Used |
|---|---|---|
| Firecrawl scrapes | 34 (15 delta-center, 15 lenovo-center, 4 spare) | 23: delta-center 10, lenovo-center 13. 11 spare unspent |
| Firecrawl map calls | uncapped, not counted against scrapes | 16, eight searches per site |
| Plain fetches | 0 | 0 |
| Build subagents | 3 | 3 |
| Verifiers | 0 | 0 |
| Credits | | 6193 before, 6155 after |

## 2. What discovery found that wave 3 never read

This is the result the brief asked to be reported on its own, and it is the clearest argument for uncapping map discovery.

| Site | Map calls | Unique links | Candidate pages after dropping events, news, tickets, premium, shop and file assets | Wave 3 read | Wave 4 read | New |
|---|---|---|---|---|---|---|
| deltacenter.com | 8 | 139 | 66 | 6 | 10 | 4 |
| lenovocenter.com | 8 | 111 | 25 | 7 | 13 | 6 |

**Delta Center, 4 pages wave 3 never read:** `/about-us`, `/arena`, `/experience`, `/maps`. Discovery confirms the site is genuinely thin on logistics: across 139 unique links only two pages match a logistics keyword, `/arena-policies-faq` and `/parking`, which are the two wave 3 read. The four new pages are general-interest pages harvested to close the gap rather than because discovery flagged them, so wave 3's coverage of this site looks to have been close to complete.

**Lenovo Center, 6 pages wave 3 never read:** `/accessibility`, `/arena-info`, `/plan-your-visit`, `/plan-your-visit/directions`, `/plan-your-visit/parking-guide/parking-faq`, `/plan-your-visit/parking-guide/parking-pricing`.

Two of those six are the ones to look at. **A dedicated parking FAQ and a dedicated parking pricing page existed for the whole of wave 3 and were never opened**, on a building whose parking record wave 3 wrote, verified twice, and repaired three times. Wave 3 also mischaracterised the pages it did read on this exact field. A third page, `/plan-your-visit/directions`, sits directly on the route a reader takes to the parking guide.

The pattern from wave 3 holds: the expensive misses are not misreadings, they are pages that exist and are never found. Wave 3 spent 9 map calls across five buildings. Wave 4 spent 16 across two.

## 3. Method and isolation

Both rule documents were leak-checked before the derivers started. `EXTRACTION-RULES.md` and `venuehubs-write-guard.js` contain no mention of either building, either operator, either club, either city or either transit agency, so neither carries a wave 3 conclusion into an isolated derivation. The only near-hit was an unrelated `carolina-panthers` example about page length.

The harvest was written to a directory containing nothing else, and the fetch manifests carry no wave 3 reference.

Deriver A and Deriver B were given the harvest directory for their own building and the rules file, and nothing else. They were instructed that the restriction is load-bearing rather than procedural, that a leak cannot be detected afterwards, that they must not search the repository or open any path containing audit, wave, w1, w2, w3, facts-v, pass or gate, and that on encountering a file stating a prior conclusion they must stop reading it and report it. Each returns a `leaks` field.

Differ C was given both cold payloads, both wave 3 records and both harvests, with nothing withheld, and was told to propose dispositions and decide none.

Both derivers returned `leaks: []`. Neither reports encountering an out-of-scope file.

## 4. The two cold derivations

| | delta-center | lenovo-center |
|---|---|---|
| Pages read | 11: 7 operator, 2 agency, 1 club, 1 manifest | 14: 12 operator, 1 club, 1 manifest |
| Fields with a state | 13 | 14 |
| Rule 1.5 applied | 0 | 2 |
| Left unestablished | 7 | 6 |
| Overlays | 1 written (utah-hockey-club, 90 minutes), 1 declined (utah-jazz, NHL-only instruction) | 0 written; the club door times held |

Both derivations are internally reasoned and neither is thin. Delta Center's reader made one judgement call and flagged it: it stored `bagMaxDimensions` as the 4 by 6 by 2 inch clutch rather than 14 by 14 by 6, on the ground that the building bans bags including purses outright and the larger envelope attaches only to diaper and medical bags, so publishing it would tell an ordinary fan a 14 inch tote is fine. It kept the larger figure in the notes so a reviewer can flip the call. Wave 3 reached the same 4 by 6 by 2 object independently.

## 5. Agreement, which is the more surprising half

**100 leaf paths are byte-identical**, 70 at Delta Center and 30 at Lenovo Center. A cold reader working from a superset harvest, with no sight of the earlier work, independently reproduced:

- Delta Center's eight-lot parking list, with seven of eight notes byte-identical
- the `bagMaxDimensions` object 4 by 6 by 2 inches, exactly
- `clearBagRequired` null on rule 1.6, at both buildings
- both TRAX line names and the station
- the utah-hockey-club overlay at 90 minutes, with the rule text quoted verbatim including the operator's own "prior to tipoff" for a clause covering hockey
- Lenovo's `bagMaxDimensions` null, because the operator states a two-dimensional clutch limit and neither record invented a depth
- Lenovo's empty tenants array, with no gate overlay written for the Hurricanes
- Lenovo's `publicTransit` state `no-operator-page`, established on a page that was read rather than inferred from silence

Where the two disagree, they almost never disagree about what a page says. They disagree about typing, confirmation words, where a fact is filed, and what the record records about its own work.

## 6. The difference list

32 differences. Full detail with quoted evidence for each side is in `audit/nhl-wave4/gate1a-result.json`.

### 6a. Proposed cold-read-right: 15

These are wave 3 defects that a derivation and two verifier passes did not catch.

| id | Building, path | What wave 3 has | What the cold read has |
|---|---|---|---|
| L1 | outsideFoodAllowed | null, no source, no state | **false**, independent, cited to two operator pages and the club page |
| L2 | tailgating | null, with a two-clause summary buried in a parking-lot note | the field populated, operator-confirmed from three agreeing pages |
| L3 | parkingLotMapUrl, pdfSources | null and empty | a parking-map PDF URL and five named documents, all on wave 3's own primary parking page |
| L4 | parkingLots | one entry that is a driving route with a tailgating rule attached | five entries: general, VIP, accessible, RV, EV charging |
| D11 | held store | four operator facts absent entirely | accessibility, re-entry, outside food and food, held with citations |
| D12 | gates finding | "the Mammoth club root carries no door time" | the capture is an NHL error page; no club content was ever retrieved |
| D7, L11 | bagPolicyUrl, officialParkingUrls | sources present, no confirmation entry, both buildings | confirmation and pages-read for both |
| D9, L12 | fieldStates | 5 and 4 entries, published fields only | 13 and 14, including every examined null |
| L9, L10 | fieldConflicts | absent | two rule 1.5 conflicts recorded, one of which wave 3 could have seen |
| D8 | operatorPagesRead | 3 pages per field | 7 per field |
| L8 | officialParkingUrls | one URL | four, with caveats against the cold read noted below |

The three that matter most are L1, L2 and L3, because all three turn on pages wave 3 had in hand.

**L1 is the clearest defect in either building.** The operator says "does not permit any outside food and beverage" in those words and lists it under items you may not bring; the club page states it separately on a second domain. That is rule 1.1's affirmative statement and rule 2.4's independent confirmation, both available outright. All three pages were in the wave 3 harvest, and two of them wave 3 cites for other fields. A confirmable boolean stayed null through two verifier passes.

**D12 is the subtlest.** Wave 3 wrote "the Mammoth club root carries no door time, so there is no club republish to record". That is true and misleading in one breath: it reads as evidence that the club was checked and is silent, when in fact the fetch returned an NHL not-found shell at HTTP 200 and no club content was ever seen. That is rule 7.4a's shape, an empty source page treated as a benign one. I checked the blast radius: of the eight NHL club roots harvested across waves 1 and 3, Mammoth is the only error shell, so this is isolated to Delta Center rather than a pattern.

### 6b. Proposed both-defensible: 10

Trailing slash on the parking URL, transit note phrasing, single versus array citations, bag-note wording and completeness, `confirmationsFull` key naming, verify status tokens versus sentences, which operator page is named as the transit lead, and an explicit empty `fieldConflicts`. None changes a stored fact. Several are house conventions worth setting once rather than adjudicating per building.

## 7. Where wave 3 would win, flagged separately as asked

Seven: D2, D10, L5, L13, L14, L15, X1. These are the entries where a warm reading survives a cold check, so they are where a wrong warm reading would hide.

Five of the seven are record plumbing that a harvest cannot teach: `write` and `revision` keys the cold reader was never in a position to invent (X1), two held-store entries the cold read quoted as evidence and then let fall out of the record (D10, L13), and a `clubRepublish` key that wave 3 gives a slot and the cold read gives a paragraph (L15).

Two turn on the harvest itself and deserve the hardest look:

- **D2.** Wave 3 folded the operator's Park Place accessible-parking sentence into that lot with a two-page citation. The cold read demoted it into the held store, reading rule 2.2 as forbidding a two-source field, which its own practice contradicts twice in the same payload. Wave 3 published a confirmable, reader-facing fact; the cold read hid it.
- **L5.** The cold read deleted the operator's road approach to the lots because a page wave 3 never saw, the directions page, looked narrower. Those two paragraphs answer different questions for different drivers, so rule 1.5 was never engaged. This is the one place where the extra pages made the cold read worse.

**L14 is not a preference, it is a defect in the cold payload.** At Lenovo Center the cold read put prose sentences into the `verify` block's operator and club URL slots, while filling the same slots with URLs at Delta Center minutes earlier. Every one of those paths would fail the write guard's URL rule.

## 8. Checks I ran on the proposed dispositions

Differ C proposes and decides nothing, so I checked its two most consequential claims before putting them in front of you.

**D1 does not hold, and I recommend rejecting it.** Differ C proposes that wave 3's `confirmations.rideshareDropoff = "operator"` at Delta Center is a wrong confirmation word, on the reading that rule 2.4 admits operator for bag, parking and gates only and rideshare is none of the three, and that the guard cannot catch it. Both halves are wrong against the code. `lib/venuehubs-write-guard.js` lists `rideshareDropoff` in `OPERATOR_ELIGIBLE_FIELDS` and classes it as a parking-class field, with `officialParkingUrls` and `parkingLotMapUrl` as its pointers. The guard would accept it, and does: four buildings across waves 2 and 3 carry `rideshareDropoff` typed operator, two of them written to production. If D1 were adjudicated cold-read-right it would put a live field on four buildings into doubt on a misreading. The evidence for rejecting it is the guard source itself.

**D12's blast radius is bounded.** I checked all eight NHL club roots harvested in waves 1 and 3. Mammoth is the only error shell, at 8,971 bytes with three not-found markers against 28,000 to 50,000 bytes and zero markers for the other seven. The finding stands and does not generalise.

## 9. Two consistency questions the cold payload raises

Differ C flags both, and both need one ruling rather than a per-building one:

1. The cold read typed `rideshareDropoff` held at Delta Center and operator at Lenovo Center, and said so openly. Given the guard evidence above, operator is the settled answer for both.
2. The cold read used status tokens plus URL slots at Delta Center and prose in both at Lenovo Center. URLs in URL slots is the settled answer; the token-versus-sentence question for `verify.*.status` is a house convention that is genuinely open.

## 10. State at the end of Gate 1a

Nothing written, nothing merged, nothing verified. Both cold payloads, the difference list with quoted evidence per side, the map discovery output and all 23 harvest pages are under `audit/nhl-wave4/`. 11 Firecrawl scrapes remain unspent.

Gate 1b begins after you adjudicate each disposition into the ledger. Its scope is unchanged from the plan: the pre-rule ledgers for Wells Fargo Center and Capital One Arena, the Scotiabank getting-here fetch, the Xfinity and WMATA re-checks, `check-repairs`, then pass 1 and pass 2 with the repair-audit lens.
