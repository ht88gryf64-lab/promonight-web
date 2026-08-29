# The 23 claims that already expired

Report only. 2026-08-29. Nothing changed by this document; the render-layer
silencing in the same branch covers `publicTransit` and `gatesOpen` only.

Same class as the fabrications, arrived at by time rather than by generation:
`"Not available for the 2025 season"` reads in the present tense on a page a fan
loads today. The difference is that these were true once, which means removal is
sometimes enough and invention is never required.

Found by scanning every prose field in both corpora for a named year. 340
strings across 134 docs carry a clock; 23 name a year of 2025 or earlier.
**305 undated price claims across 121 docs are deliberately out of scope here.**

## Recommendation per entry

### SILENCE (9). A present-tense claim about a season that has ended, or a source too old to stand behind.

| Doc and field | The problem | Note |
|---|---|---|
| `venueHubs/allegacy-federal-credit-union-stadium.parkingLots` | The whole value is "Not available for the 2025 season". A lot listing whose only content is a past season's unavailability tells a 2026 fan nothing true. | |
| `venueHubs/chase-center.parkingLots` ×3 | Two read "Purchasable on site per Mar 2024 event-day guide"; the third says a lot is "Listed as currently closed" on the authority of that same 2024 guide, with an address from a Jan 2022 guide. "Currently closed" sourced to a document two years old is the sharpest instance in the set. | |
| `venueHubs/brooks-stadium.tailgating` ×2 | "Per 2020 gameday guide", and the value itself notes tents were prohibited "under 2020 COVID protocols". Six years old and describing an emergency posture. | Already withheld: brooks-stadium tailgating is on `FIELD_CONFLICTS`. Confirms the judgment rather than adding work. |
| `venueHubs/providence-park.bagPolicyNotes` | Source is a 2016 club page. Bag policies are among the most frequently revised venue rules, and a ten-year-old one should not be published as current. | |
| `venueHubs/albertsons-stadium.tailgating` | Sourced to a 2023 game-day guide, describing a named sponsor fan zone and its opening time. | The hub is transit-suppressed, but that entry is `publicTransit`-scoped and does not reach `tailgating`. |
| `venueHubs/sanford-stadium.accessibility` | 2021 source, and it routes disabled patrons to specific box offices and a phone number with the instruction that seating "is no longer exchanged at the gates". Wrong operational detail here has a sharper cost than most. | |

### CORRECT BY REMOVAL (3). The stale element is a severable clause; deleting it leaves a true sentence and invents nothing.

| Doc and field | Remove | What survives |
|---|---|---|
| `venueHubs/dignity-health-sports-park.parkingLots` | "passes were sold out for the 2025 season" | The pass price, the game count, the AXS purchase route and the matchday walk-up option all stand on their own. |
| `venueHubs/milan-puskar-stadium.parkingLots` | "(sold out for the 2025 Utah game)" | The lot, its location, single-game availability and the bus/RV prohibition are unaffected. |
| `venueHubs/kidd-brewer-stadium.tailgating` | "For the Nov. 6, 2025 game against Georgia Southern the lots opened at 4 p.m." | The general rule (8 a.m. for 2:30/3:30 kickoffs) and its own caveat that "tailgating times change with kickoff times as they are announced" are the durable part. The removed sentence is a worked example from a game that has been played. |

These three are the only entries where removal alone is sufficient. Everything
else either needs a source we do not hold, or needs nothing.

### LEAVE (7). Correctly tensed, or a false positive of the year scan.

- `venues/energizer-park.parkingInfo` — "2019 Market Street" is a street address. Scanner artifact, not a date.
- `venues/providence-park.accessibility` — "(renovated 2019)" is a fact about the past, correctly tensed.
- `venues/snapdragon-stadium.accessibility` — "(opened 2022)", same.
- `venueHubs/citi-field.publicTransit` — "Local Bus Q90 (formerly Q48 ... as of June 29, 2025)" documents a rename with its effective date. This is what good dating looks like.
- `venueHubs/bmo-field.bagPolicyNotes` — "MLSE Restricted Bag Policy (effective July 2021)" is an effective date, not an expiry. Worth re-sourcing on the next pass, not withdrawing.
- `venueHubs/simmons-bank-liberty-stadium.bagPolicyNotes` — the 2024 mention dates an allowance that was *added*, and the policy reads as current.
- `venueHubs/scott-stadium.tailgating` — the year sits in a trailing source note; the rules themselves are undated conduct requirements.

### MOOT (4). Already withheld, by this branch or an existing entry.

- `venues/amalie-arena.publicTransit` — silenced with the whole `venues.publicTransit` field by this branch. (Also benign: "free to ride since 2018" is correctly tensed. Its real defect is elsewhere: the sampling pass found route 30 does not serve Channelside Drive.)
- `venueHubs/paycor-stadium.publicTransit` — already on the transit suppression list.
- `venueHubs/camp-randall-stadium.publicTransit` — "Downtown loop discontinued as of 2023" is correctly tensed; the shuttle description carries a $10 price that belongs to the undated-price population, not here.
- `venueHubs/yulman-stadium.tailgating` — "the only tailgating location for the 2025 season" plus a 2025 price list. Already withheld via `FIELD_CONFLICTS`.

## The structural point

None of this was caught by a source-URL check, because every one of these cites
a real page that still loads. It was caught by reading the stored sentence for a
year. **Neither corpus has a field that can hold an expiry or a review date**,
so a claim that names a season has no mechanism to notice when that season ends.
The three CORRECT-BY-REMOVAL entries are all the same shape: a worked example
from a specific past date, frozen into guidance.

The cheapest durable fix is not a cadence. It is a rule at write time: **if a
claim is only true for a bounded period, either the boundary goes in the
sentence the reader sees, or the claim is not stored.**
