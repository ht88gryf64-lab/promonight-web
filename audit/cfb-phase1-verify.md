# CFB Phase 1 — Verify Report

**Generated:** 2026-06-13T02:40:00.302Z · **Branch:** cfb-phase1 · **Scope:** 4 spike schools only (no expansion to 25) · **Mode:** full live parse + blind verify

## Production safety (confirmed)

**Nothing in the existing site queries the `cfb*` collections.** They are brand-new (`cfbSchools`, `cfbVenues`, `cfbGames`, `cfbRivalries`, `cfbTraditions`) — no route, component, sitemap, or lib reads them. `cfbGames.verified` defaults `false` and is the production-display gate, but there is no production reader yet, so there is **zero chance a `verified=false` row renders in production**. Writes here are isolated and reversible.

## Verify-stage architecture (confirmed isolated)

The verify stage is **structurally** blind, not blind by convention:
- `blindVerifySchool(school, skeleton)` accepts ONLY `{ date, homeTeam, awayTeam }` per game. Its input type has **no field** for the parser's kickoff, tz, network, or conference — they cannot be passed in.
- It re-fetches the host school's official site fresh and produces its OWN kickoff/tz/network.
- The parser output and the verify output meet **only at `diffGame()`**, a pure comparison step. No `verified=true` can trace to the parser's own answer.

## Per-school counts (live)

| School | extracted | verified | downgraded | flagged-for-human | HIGH survived |
|---|---|---|---|---|---|
| Tennessee | 13 | 0 | 0 | 13 | 0/13 |
| Kansas State | 12 | 2 | 0 | 10 | 2/12 |
| Notre Dame | 12 | 0 | 1 | 11 | 0/12 |
| Boise State | 12 | 1 | 9 | 2 | 1/11 |
| **Total** | **49** | **3** | **10** | **36** | **3/48** |

### Extractor-HIGH survival rate (Phase 2 gate metric)
**6.3%** of parser values self-rated HIGH survived independent verification (3/48). Spike baseline ~85%.

**Decompose before reading it.** Of 49 games: 3 verified, 10 **downgraded** (the blind verifier's independently-fetched kickoff DISAGREED with the parser — correctly refused; on 2026 games this far out, kickoff times are volatile/just-announced, so two independent extractions legitimately diverge), 36 **flagged-for-human** (provenance not established: <2 distinct source domains and/or the cited URL could not be confirmed by re-fetch — official athletics sites frequently block Node fetches). Neither verdict means "schedule core is wrong"; both mean the guard declined to AUTO-verify a contested or unprovenanced value, which is the contract working.

The drop from ~85% → 6.3% reflects stricter, fully-independent verification on three axes at once (kickoff diff + 2-domain + citation), confirming the parser's HIGH self-rating is unreliable and the verify stage is load-bearing (the spec's thesis). It is **not yet a clean Phase 2 signal**: it conflates kickoff volatility and official-site fetchability with genuine value errors. Phase 2 should gate on (a) the deterministic guard proof below and (b) a survival metric scoped to the STABLE hard-data fields (date/opponent/home-away/venue), not kickoff times.

Live LLM cost this run: ~$1.00 (Haiku + web_search).

## The five guards fired on known-bad data (deterministic, no API)

This is the honest gate. Each guard is run against the exact bad value the spike's verify pass caught. **16/16 checks fired.**

**Guard #1 — Timezone (Boise +2h, all rated HIGH):**
  - ✅ FIRED — at Oregon 3:30 PM→1:30 PM: kickoff mismatch 2.0h: parser="3:30 PM MT" vs independent="1:30 PM MT"
  - ✅ FIRED — vs Memphis 6:00 PM→4:00 PM: kickoff mismatch 2.0h: parser="6:00 PM MT" vs independent="4:00 PM MT"
  - ✅ FIRED — vs South Dakota 10:00 PM→8:00 PM: kickoff mismatch 2.0h: parser="10:00 PM MT" vs independent="8:00 PM MT"
  - ✅ FIRED — at Colorado State 6:00 PM→4:00 PM: kickoff mismatch 2.0h: parser="6:00 PM MT" vs independent="4:00 PM MT"
  - ✅ FIRED — vs Oregon State 6:00 PM→4:00 PM: kickoff mismatch 2.0h: parser="6:00 PM MT" vs independent="4:00 PM MT"
  - ✅ FIRED — vs San Diego State 9:30 PM→7:30 PM: kickoff mismatch 2.0h: parser="9:30 PM MT" vs independent="7:30 PM MT"

**Guard #2 — Derived-field gate (Notre Dame, independent):**
  - ✅ FIRED — vs north-carolina (2026-10-03): conferenceGame=true but rule says null; a source asserted conferenceGame=true; rule overrides to null (gate held)
  - ✅ FIRED — vs miami (2026-11-07): conferenceGame=false but rule says null; week=10 but rule computes 9
  - ✅ FIRED — vs boston-college (2026-11-14): conferenceGame=false but rule says null; week=11 but rule computes 10
  - ✅ FIRED — vs smu (2026-11-21): conferenceGame=false but rule says null; week=12 but rule computes 11
  - ✅ FIRED — vs syracuse (2026-11-28): conferenceGame=false but rule says null; week=13 but rule computes 12
  - ✅ FIRED — ALL ND games conferenceGame→null (independent): rule forces null regardless of any source

**Guard #3 — Entity conflation (rivalry years):**
  - ✅ FIRED — Milk Can (Boise State–Fresno State): single originYear=1977 conflates series-start with trophy-creation; split required
  - ✅ FIRED — Governor's Trophy (Boise State–Idaho): single originYear=1971 conflates series-start with trophy-creation; split required

**Guard #4 — Second source / fabrication:**
  - ✅ FIRED — Tennessee–Vanderbilt "Dooley-Fulmer Trophy": only 1 independent source domain(s) [en.wikipedia.org]; need >= 2

**Guard #5 — Mis-citation (live re-check of the stale URL):**
  - ✅ FIRED — Texas at Tennessee kickoff 12:00 PM ET: cited May URL carries the noon value? false → stored source does NOT carry the value (mis-citation)

## Boise timezone case — before/after (run honestly)

The spike caught **6 Boise kickoffs systematically +2h**, all originally rated HIGH. The timezone guard reduces both the parser value and an independent value to an absolute UTC instant and diffs:

| Game | parser (was HIGH) | independent | guard |
|---|---|---|---|
| at Oregon | 3:30 PM MT | 1:30 PM MT | 🚩 +2h CAUGHT |
| vs Memphis | 6:00 PM MT | 4:00 PM MT | 🚩 +2h CAUGHT |
| vs South Dakota | 10:00 PM MT | 8:00 PM MT | 🚩 +2h CAUGHT |
| at Colorado State | 6:00 PM MT | 4:00 PM MT | 🚩 +2h CAUGHT |
| vs Oregon State | 6:00 PM MT | 4:00 PM MT | 🚩 +2h CAUGHT |
| vs San Diego State | 9:30 PM MT | 7:30 PM MT | 🚩 +2h CAUGHT |

All six are caught (Δ = 2.0h each). The guard does **not** depend on the live parser reproducing the bug; it fires on the documented bad values directly.

## Schema seeded (all 5 collections exercised)

`cfbSchools` 4 · `cfbVenues` 4 · `cfbRivalries` 2 (with `seriesStartYear`/`trophyCreatedYear` **split** — Milk Can 1977/2005, Governor's Trophy 1971/2001) · `cfbTraditions` 2 · `cfbGames` 49 (verified=false until the pass confirms).

## Gate status

- ✅ Five collections stood up; `cfbGames.verified` populating via the verify pass.
- ✅ Five anti-hallucination guards demonstrably firing on their known-bad cases (16/16).
- ✅ Verify stage structurally isolated from the parser.
- ✅ Production-safety: no reader of `cfb*` exists.

**STOP — Phase 1 gate. No UI, no expansion to 25, no push.**

---

# Re-gate after harness fixes (2026-06-13)

*The report body above was regenerated by the fixed re-run. (The prior "Owed Item 1/2" appendix is preserved in git at commit `b098938`.) Numbers below are read from the re-run's **stored** `cfbGames` data, not re-derived live.*

## The three fixes — verified effects

| Fix | Status | Evidence |
|---|---|---|
| **FIX 1 — auditable source trail** (persistence only; verification *logic* untouched) | ✅ **WORKS** | `sourcesChecked` now persists the full verify source set. Single-source proof below **passes from stored data**. |
| **FIX 2 — `normTime` "p.m."/"a.m."** | ✅ **WORKS** | Unit test 10/10; the guard-bug false downgrade (`nicholls` 6pm-vs-6p.m.) **cleared → now verified**; real conflicts read their **true ~1h**, not 11h. |
| **FIX 3 — provenance re-fetch** | ⚠️ **INSUFFICIENT** | Citation-fallback to an allowed independent domain is in place, but **38 of 46** non-verified games are still single-domain second-source failures. Making `sources` required **backfired** (Haiku filled it with non-URL junk → `(bad)` domains), so it was reverted. Prompt-based ≥2-domain capture is unreliable. |

## Re-run counts (stored): **3 verified / 10 downgraded / 36 flagged** (of 49)

Prior run was 22/13/12. The swing is **run-to-run nondeterminism** in how many domains the verify agent captures — which is exactly the FIX 3 weakness. The verified *rate* is not a stable signal; the deterministic guard proof (16/16, above) and the single-source proof (below) are.

## Single-source proof — FROM STORED DATA: ✅ **PASS**

Distinct **valid** domains per verified game (`(bad)` non-URL entries excluded; two URLs on one domain = one source):

| Verified game | Distinct independent domains | OK |
|---|---|---|
| w1-kansas-state-nicholls | `kstatesports.com` + `en.wikipedia.org` | ✅ 2 |
| w5-kansas-state-houston | `kstatesports.com` + `en.wikipedia.org` | ✅ 2 |
| w4-western-michigan-boise-state | `broncosports.com` + `wmubroncos.com` | ✅ 2 |

**Zero verified games trace to a single domain.** Each pair is genuinely independent (official site + Wikipedia, or the two schools' own athletics sites — not mirrors/syndication). **The audit-trail blocker is closed.**

## Friction breakdown (recomputed from stored flags, 46 non-verified)

| Bucket | Count | Notes |
|---|---|---|
| **GENUINE VALUE CONFLICT** | **3** | all **timezone** disagreements (~1h): Wisconsin `CT vs ET`, Oregon `PT vs MT`, Fresno `PT vs MT` — need human resolution |
| **TOOLING — single-domain (2nd-source)** | **38** | the verify captured one domain (or junk); not a data problem |
| presence-mismatch (parser time vs verify TBD) | 6 | overlaps the above; unconfirmed, not conflicting |
| mis-citation (official site Node-unfetchable) | 5 | overlaps; FIX 3b helps but doesn't fully clear |
| no independent observation | 1 | verify dropped a game |

**Target was "only ~2 conflicts + ~3 eyeballs remain." NOT met:** 3 genuine conflicts, but **the bulk (38) is still single-domain tooling**, not resolved.

## Load-bearing guards still fire
- **Boise timezone**: 16/16 deterministic fixtures fire (above); with the `normTime` fix the real ~1h conflicts now surface honestly (Wisconsin/Oregon/Fresno), and the false 12h is gone.
- **Notre Dame `conferenceGame`**: independently re-checked from stored data — **all 12 ND games `null`**, gate held.

## Firestore ↔ report match
Independently queried: `cfbGames` total **49**, verified **3**, non-verified **46**; `sourcesChecked` now carries multi-entry trails. Matches the regenerated report body. ✓

## Adversarial self-check
1. **FIX 1 changed only persistence**, not logic — `diffGame`/`guardSecondSource` untouched; only `sourcesChecked` now stores the full set. (And the logic *does* require ≥2 distinct domains — verified, no contract violation.)
2. **Single-source proof is from STORED data** (`source` + persisted `sourcesChecked`), not live re-derivation.
3. **Distinct domains only** — `(bad)` junk and same-domain duplicates excluded; that's how the 38 single-domain failures were even identified.
4. **No mirrored/syndicated 2nd source** among the 3 verified — each is two genuinely independent orgs (official + Wikipedia, or two schools' sites).
5. **`normTime` fix did not falsely equate different times** — the real Boise/tz conflicts still register ~1h (unit-tested + live), and `nicholls` 6pm-vs-6p.m. correctly reads as equal.

## Verdict: **Phase 2 is NOT green**
Single-source proof **passes**, and FIX 1/FIX 2 are solid — but the remaining friction is **still tooling-dominated** (38 single-domain), not just the 3 genuine conflicts + eyeballs. Per the brief's own bar ("green only if remaining friction is just genuine conflicts/eyeballs, not tooling"), **Phase 2 waits**. **FIX 3 must be redone as a deterministic, code-based independent 2nd source** (fetch a fetchable source distinct from each game's parser domain — Wikipedia when the parser is an official site, an official/ESPN source when the parser is Wikipedia — and confirm the schedule fact carries there), rather than relying on the verify agent's prompt compliance. That is a real design step (it changes second-source corroboration from agent-found to harness-confirmed) and is flagged for an explicit decision before re-running.
