# NHL arena data, wave 4 plan

Written 2026-09-04, after the wave 3 Gate 1 report. Scope is smaller than a normal wave and deliberately so: two buildings are rebuilt from scratch, one field is finished, two claims are re-checked, and the whole wave runs under a repair-provenance rule that did not exist in waves 1 to 3.

## Why this wave looks different

Waves 1 to 3 all ran the same shape: harvest, extract, verify, fix, verify, write. That shape has a blind spot, and wave 3 hit it twice.

A verifier reports a defect. The extractor repairs it. The next pass reads only the repaired payload, so it can see whether the payload is right now, but it cannot see whether the repair did what it said, whether it answered the finding it claimed to answer, or whether it quietly undid an earlier repair. Wave 3 pass 2 caught three cases where a wave 3 pass 1 repair introduced a new defect:

- The Xfinity bag repair applied rule 1.5 to a whole clause where the dispute was one token, so the stored policy came out stricter than either operator page.
- The Xfinity rideshare value survived pass 1 untouched and turned out to be a pick-up lot filed as a drop-off.
- The Capital One transit repair rested on a misreading of the agency page, which I then wrote into the record as fact.

Each was caught by luck of a second pass with fresh eyes. A third pass over the same material has no such luck, because by then the record contains layers of repairs and nothing distinguishes a repair that answered a finding from a repair that overwrote one. That is what this wave fixes.

## 1. The repair-provenance rule

**Statement.** From wave 4, no payload path may change without a repair record, and no prior finding may leave the ledger without a disposition. A repair that reverses an earlier repair on the same path must name it.

This is the same instinct as the pages-read rule from wave 3. Pages-read made "I read these pages and they agree" an explicit, checkable assertion instead of an implicit one. Repair provenance does that for "I changed this because you told me to."

### 1a. The repair record

Every build script that produces version N+1 from version N emits `repairs.json`, one entry per changed path:

| Field | Meaning |
|---|---|
| `id` | stable, `w4-r001` |
| `path` | `lenovo-center.building.parkingLots[0].notes` |
| `answers` | the finding it responds to: `pass2.values.lenovo-center.parkingLots.V1`, or the literal `none` |
| `before` / `after` | the two values |
| `basis` | the page URL and the quoted line that licenses `after` |
| `class` | `value`, `citation`, `state`, `typing` or `record` |
| `supersedes` | the id of an earlier repair this one reverses, when it does |

`answers: none` is legal but is reported in its own section of the gate report. A change nobody asked for is not forbidden; it is just never invisible.

### 1b. The findings ledger

Every finding from the previous pass gets exactly one disposition:

- `fixed`, naming the repair id
- `carried`, with the reason and the wave it goes to
- `rejected`, with the page and the quoted line showing the finding was wrong

A finding may not be absent. Rejection is a first-class outcome, and it needs evidence at the same standard as a claim: wave 3 pass 2 was right about the WMATA badge and I was wrong, and the only way to settle that was to open the file and read it. A rejection with no quote is not a rejection.

### 1c. The checker, and what it does not catch

`check-repairs.cjs` runs before every verify pass and fails on:

1. a changed path with no repair record;
2. a repair whose `basis` carries no page URL and no quoted line;
3. a repair whose `after` equals the `before` of an earlier repair on the same path and which carries no `supersedes`;
4. a prior finding with no disposition;
5. a `rejected` disposition with no quoted evidence.

**Check 3 is exact-match only, and that limit is the important thing about it.** It compares a repair's `after` against the `before` of every earlier repair on the same path, so it catches a literal restoration and nothing else. A reworded value that means the same as the one a pass rejected, a partial undo, or an edit one level up the path that swallows an earlier repair all pass it clean. Closing that gap is not a string-comparison problem: deciding whether two differently worded values assert the same thing is the reading problem this entire programme is about, and a checker that pretended to do it would be the same false assurance the drift-check feedback already cost us once.

So the honest division of labour is this. The checker is a cheap tripwire for the cases that need no judgement: a path that moved with nobody's name on it, a basis with no quote, a finding that vanished, a literal restoration. **The repair-audit lens in pass 2 is the actual defense against pass 3 overwriting pass 2**, because it is the only part of the wave that reads the ledger against the harvest and can say that a repair reached an old rejected reading by a new route. Nothing in section 1a to 1c should be read as making that lens optional.

### 1d. Records that predate the rule

Wells Fargo Center and Capital One Arena carry wave 3 v3 records built before this rule existed. Every path in them that moved between v1, v2 and v3 has no repair record, so under check 1 they either fail the whole wave or get grandfathered, and grandfathering is how a silent edit becomes permanent.

Neither. Before pass 1, both records get a **pre-rule ledger**: one entry per path that moved during wave 3, marked `class: pre-rule`, carrying the wave 3 finding it answered where the pass 1 and pass 2 result files name one, and `answers: unrecorded` where they do not. The wave 3 fix lists (`v1-to-v2-fixes.txt`, `v2-to-v3-fixes.txt`) and the two result files supply most of it; the rest is reconstructed from the version diffs and marked as reconstructed.

This is bookkeeping, not verification. It does not make those paths verified, and both buildings still face the full pass 1 and pass 2. What it does is stop an unexplained path from reading as a silent edit later, which is exactly the confusion this rule exists to prevent. A path marked `pre-rule` is a known gap with a name; a path with nothing on it is not.

### 1e. What the verifiers get

Wave 4 pass 2 receives the repair ledger and the pass 1 findings as inputs, and one of its four lenses is a repair audit whose only job is:

- did each repair do what its record says it did;
- is each `basis` quote actually on the page it names;
- does any repair undo a prior repair without saying so;
- is any `rejected` finding in fact correct.

That lens reads the ledger against the harvest, not the payload against the harvest. It is the check waves 1 to 3 did not have.

## 2. Scope

### 2a. Full re-fetch and re-derive: delta-center and lenovo-center

Both finished wave 3 pass 2 with **zero value defects** and carry only on record text. That makes them the right pair to rebuild rather than patch: the values are believed good, so a fresh derivation is a genuine independent check rather than a redo of unresolved work.

**Method, and the part that matters: the re-derive is a subagent isolation boundary.**

A cold read cannot be done by anyone who already holds the warm one. I harvested these two buildings, wrote their records, argued their rule 1.5 calls and read both verifier passes on them. A re-derivation by me would reproduce my own reading with the same blind spots, and would be worth roughly nothing as a check. The isolation has to be structural, not an intention.

So the derivation is done by subagents that are never given the wave 3 record:

| Actor | Given | Never given | Produces |
|---|---|---|---|
| Deriver A | the fresh delta-center harvest, the extraction rules, the checklist, the field-state contract | any wave 3 payload, report, fix list or verdict, and any summary of them | a delta-center payload derived cold |
| Deriver B | the same for lenovo-center | the same | a lenovo-center payload derived cold |
| Differ C | both cold payloads, both wave 3 v3 records, and the harvest | nothing withheld | the difference list, with the evidence for each side and a proposed disposition |

Three properties make this worth the extra actors. The derivers cannot inherit my reading, because they never see it. The differ is not grading its own work, because it did not do the derivation. And I do not adjudicate while holding only the warm record in mind, because the differ hands me both sides with the page quotes attached.

Differ C **proposes** dispositions and does not decide them. I adjudicate each one, and every adjudication becomes a ledger entry with its basis quote, exactly like a repair. Where I side with the wave 3 record against the cold read, that entry is the one to look at hardest: it is the shape in which a warm reading survives a cold check for bad reasons.

Only after the cold derivation is complete does anything get diffed. Every difference is then one of:

- the fresh read is right and wave 3 was wrong, which is a wave 3 defect two passes missed;
- wave 3 was right and the fresh read missed something, which means a wave 3 repair captured something a cold read does not, and that is worth knowing;
- both are defensible, which is a judgement to record rather than resolve silently.

Each difference gets a disposition in the ledger. An independent re-derivation used as a check on accumulated repairs is the strongest test available without new evidence, and it costs one harvest plus three subagents.

**Map discovery on these two sites is uncapped.** Wave 3's worst misses were not misreadings; they were pages that existed and were never found. Lenovo's Transportation page turned up on the very last Firecrawl call of the wave and changed a field state and the source of a whole field. Scotiabank's real parking page was never found at all because a dead footer link looked like the answer. Discovery is where the cheap wins are, so on delta-center and lenovo-center map calls do not count against the scrape budget and are not limited: map until the site stops yielding pages that mention bag, parking, transit, gates or rideshare, then harvest what discovery found rather than what wave 3 happened to read.

### 2b. scotiabank-arena: pulled out of wave 3, written complete here

Wave 3 left parking genuinely unresolved. Its footer links `/plan-your-visit/directions-parking`, which returns 404; its body pages link `/plan-your-visit/getting-here`, which the budget never reached. One fetch settles whether parking is a rendered claim or a real no-operator-page.

**Recommendation: do not write this building at wave 3 Gate 2. Write it once, complete, here.**

The reason is a hazard that only exists if it is written twice. The extended writer sets every fact field from the payload, so a wave 4 payload carrying only parking would write nulls over the bag and transit fields wave 3 had made live. That is survivable with care: re-carry every written field and diff the read-back against the written state rather than an empty doc. But it is a hazard created entirely by splitting one building across two writes, and it is avoidable by not splitting it.

Writing it here instead costs one thing and buys three. It costs a wave of delay on one building. It buys a single write of a complete record, a read-back that diffs against a doc with no prior wave-3 state to preserve, and one fewer place where a later payload can silently blank a live field.

**The consequence is worth stating plainly: wave 3 Gate 2 then writes nothing at all.** Scotiabank Arena was the only building clean at wave 3 pass 2, so pulling it empties that gate. Wave 3 becomes a wave that harvested five buildings, found and fixed a fabricated citation, a missed rule 1.5 conflict and two unsupported field states, and shipped none of it. That is an unsatisfying result and it is the correct one: the alternative is shipping four buildings whose records two passes could not get clean, plus a fifth that would need rewriting a wave later.

### 2c. Two targeted re-checks

Both are single claims on buildings that are otherwise carrying, and neither needs a rebuild.

**Xfinity third door.** Two operator pages name three bag-entry locations and disagree only on the third's name, "the NEW Premium Entrance" against "the Premium Access Entrance". Wave 3 v3 stores it as "a premium entrance", the word both pages use. Re-fetch both pages and confirm the disagreement still stands and that "premium" is still common to both. If one page has since been corrected, the name is storable and the 1.5 lifts.

**WMATA badge.** Wave 3 v3 stores three lines for Gallery Place on the strength of the station badge GYR and the arrivals board. That reading was itself a correction of a wrong reading, which makes it exactly the kind of claim the repair rule exists to protect. Re-fetch and confirm the badge, and record the quoted line as the repair basis.

### 2d. Not in this wave

Ball Arena transit stays held pending your RTD check, and nothing re-fetches RTD. Madison Square Garden, the Pistons gate overlay, the bag-policies page scope and the t-mobile-park inverted source entries all stay out, unchanged from wave 3.

Wells Fargo Center and Capital One Arena are **not** rebuilt. They carry their wave 3 v3 records, which are unverified, and wave 4 verifies them rather than re-deriving them. Rebuilding four buildings in one wave is how record debt gets replaced by harvest debt.

Both get the pre-rule ledger described in 1d before pass 1, so that every path wave 3 moved in them carries either the finding it answered or an explicit `unrecorded` mark. Neither building's paths may be treated as clean on the strength of that ledger; it exists so a reader in wave 5 can tell a gap from an edit.

## 3. Budgets

| Budget | Proposed | Reasoning |
|---|---|---|
| Firecrawl scrapes | 55 | delta-center and lenovo-center harvest whatever discovery finds rather than whatever wave 3 read, so both rebuild allowances are open-ended within the total: budget 15 each. scotiabank getting-here and whatever it links, 4. Xfinity re-check 2, WMATA re-check 1. Spare 18, which is large on purpose: wave 3 ran out on its last call and had to leave a field state unestablished |
| Firecrawl map calls | uncapped on delta-center and lenovo-center; 3 elsewhere | discovery is where wave 3 lost the most, so it is not the thing to ration. Map until the site stops yielding pages that mention bag, parking, transit, gates or rideshare |
| Plain fetches | 12 | Gate 2 renders |
| Verifiers | 8 | 4 on pass 1 over the cold derivation, 4 on pass 2 including the repair-audit lens and a reconciliation lens for the cold-versus-wave-3 diff |
| Build subagents | 3 | Deriver A, Deriver B and Differ C from 2a. Declared separately because they are not verifiers: they produce and compare payloads rather than testing them, and the derivers are under an information restriction no verifier has |
| Subagents beyond those 11 | 0 | |

## 4. Gates

**Gate 1.** Map and harvest with discovery uncapped on the two rebuild sites. Deriver A and Deriver B derive cold, under the information restriction in 2a. Fetch the Scotiabank parking page and run the two re-checks. Differ C produces the cold-versus-wave-3 difference list; I adjudicate each one into the ledger. Build the pre-rule ledger for Wells Fargo Center and Capital One Arena. Run `check-repairs.cjs`, then pass 1 (4 verifiers), repair, `check-repairs.cjs` again, pass 2 (4 verifiers, one of them the repair audit). Report per building and per field with the proposed flag, the state, the confirmation type, the pages read with the finding for each, any rule 1.5 null, and the full repair ledger with every disposition, including every place I sided with the wave 3 record against the cold read. Stop.

**Gate 2, after authorization.** Write only buildings clean at pass 2. Snapshot, guard, read-back on every value, source, confirmation, pages-read, verifiedAt and state, banked-value leak check, and the harness-versus-writer proof. Scotiabank Arena is written here as a complete record, bag, transit, parking and the Maple Leafs overlay in one op, against a doc that carries no wave 3 state to preserve.

Renders: `/nhl` rail, `/venues` count, club pages showing the hub link and no venues prose block, and **the first production render of a no-operator-page row** if Lenovo Center is written, since that state has never reached a page. The operator-conflict row is already live on Bridgestone Arena and American Airlines Center from wave 2, so both pointer states can be checked together for the first time. IndexNow every written hub and its club pages, dual endpoint. Stop and report.

## 5. What this wave is really testing

The data work is modest: two rebuilds, one field, two re-checks. The point of the wave is the ledger. If it works, a defect found in one pass cannot be silently undone in the next, a repair cannot claim a basis it does not have, and a finding cannot vanish between passes. Waves 5 and 6 then run on top of a record that can be audited backwards, which is the only way the operator rule stays trustworthy as the corpus grows.
