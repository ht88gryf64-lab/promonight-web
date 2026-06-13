# CFB Phase 1 — Verify Report

**Generated:** 2026-06-12T22:52:11.086Z · **Branch:** cfb-phase1 · **Scope:** 4 spike schools only (no expansion to 25) · **Mode:** full live parse + blind verify

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
| Tennessee | 11 | 2 | 2 | 7 | 2/11 |
| Kansas State | 12 | 11 | 1 | 0 | 11/12 |
| Notre Dame | 12 | 7 | 1 | 4 | 7/12 |
| Boise State | 12 | 2 | 9 | 1 | 2/12 |
| **Total** | **47** | **22** | **13** | **12** | **22/47** |

### Extractor-HIGH survival rate (Phase 2 gate metric)
**46.8%** of parser values self-rated HIGH survived independent verification (22/47). Spike baseline ~85%.

**Decompose before reading it.** Of 47 games: 22 verified, 13 **downgraded** (the blind verifier's independently-fetched kickoff DISAGREED with the parser — correctly refused; on 2026 games this far out, kickoff times are volatile/just-announced, so two independent extractions legitimately diverge), 12 **flagged-for-human** (provenance not established: <2 distinct source domains and/or the cited URL could not be confirmed by re-fetch — official athletics sites frequently block Node fetches). Neither verdict means "schedule core is wrong"; both mean the guard declined to AUTO-verify a contested or unprovenanced value, which is the contract working.

The drop from ~85% → 46.8% reflects stricter, fully-independent verification on three axes at once (kickoff diff + 2-domain + citation), confirming the parser's HIGH self-rating is unreliable and the verify stage is load-bearing (the spec's thesis). It is **not yet a clean Phase 2 signal**: it conflates kickoff volatility and official-site fetchability with genuine value errors. Phase 2 should gate on (a) the deterministic guard proof below and (b) a survival metric scoped to the STABLE hard-data fields (date/opponent/home-away/venue), not kickoff times.

Live LLM cost this run: ~$0.99 (Haiku + web_search).

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
  - ✅ FIRED — Texas at Tennessee kickoff 12:00 PM ET: cited May URL carries the noon value? unfetchable → citation unverifiable (cited URL not fetchable / value not found)

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

`cfbSchools` 4 · `cfbVenues` 4 · `cfbRivalries` 2 (with `seriesStartYear`/`trophyCreatedYear` **split** — Milk Can 1977/2005, Governor's Trophy 1971/2001) · `cfbTraditions` 2 · `cfbGames` 47 (verified=false until the pass confirms).

## Gate status

- ✅ Five collections stood up; `cfbGames.verified` populating via the verify pass.
- ✅ Five anti-hallucination guards demonstrably firing on their known-bad cases (16/16).
- ✅ Verify stage structurally isolated from the parser.
- ✅ Production-safety: no reader of `cfb*` exists.

**STOP — Phase 1 gate. No UI, no expansion to 25, no push.**

---

# Owed Item 1 — Downgrade/flag breakdown BY REASON

*Appended on resume. Bucketed strictly from the stored `cfbGames.verification.flags[]` (the flag strings embed the actual values, so "real conflict vs agree" is read from the data, not guessed from the matchup). Ambiguous cases are marked **UNCLEAR** rather than forced.*

Buckets: **VALUE CONFLICT** (sources genuinely disagree on a value that exists — needs human resolution) · **PROVENANCE/TOOLING** (the second-source / citation requirement failed on a known or honest-TBD value — fixable by hardening the harness, *not* by human value-review) · **GUARD BUG** (false downgrade — the values actually agree) · **UNCLEAR** (parser asserts a value, blind verify returned TBD, stored data can't say whether it's announced). No game fell into a *pure* "honest-TBD, nothing else wrong" bucket — those all **verified** (honest-TBD kickoffs with 2-domain provenance pass).

| Game | Verdict | Bucket | Flag reason (from stored data) | Field |
|---|---|---|---|---|
| w2-boise-state-memphis | downgraded | **VALUE CONFLICT** | parser `4:00 PM MT` vs independent `5:00 p.m. MT` → real **1h** disagreement (flag says 11h — see guard bug) + mis-citation | kickoff |
| w3-boise-state-south-dakota | downgraded | **VALUE CONFLICT** | parser `8:00 PM MT` vs independent `9:00 p.m. MT` → real **1h** disagreement + mis-citation | kickoff |
| w1-kansas-state-nicholls | downgraded | **GUARD BUG** | flag "mismatch 12.0h" but values **agree** (`6:00 PM CT` vs `6:00 p.m. CT`) — `normTime` doesn't parse "p.m." (periods) → false +12h | kickoff |
| w10-boise-state-oregon-state | downgraded | PROVENANCE/TOOLING | parser time vs verify TBD + 1 domain [broncosports] + mis-citation | kickoff |
| w11-boise-state-san-diego-state | downgraded | PROVENANCE/TOOLING | parser time vs verify TBD + 1 domain [broncosports] | kickoff |
| w5-boise-state-utah-state | downgraded | PROVENANCE/TOOLING | parser time vs verify TBD + 1 domain [broncosports] | kickoff |
| w6-fresno-state-boise-state | downgraded | PROVENANCE/TOOLING | parser time vs verify TBD + 1 domain [broncosports] | kickoff |
| w7-washington-state-boise-state | downgraded | PROVENANCE/TOOLING | parser time vs verify TBD + 1 domain + mis-citation (tz MT vs PT) | kickoff |
| w8-boise-state-texas-state | downgraded | PROVENANCE/TOOLING | parser time vs verify TBD + 1 domain + mis-citation | kickoff |
| w9-colorado-state-boise-state | downgraded | PROVENANCE/TOOLING | parser time vs verify TBD + 1 domain + mis-citation | kickoff |
| w1-tennessee-furman | downgraded | **UNCLEAR** | parser `3:30 PM ET` vs verify `TBD`; no provenance flag — can't tell if 3:30 is announced | kickoff |
| w2-georgia-tech-tennessee | downgraded | **UNCLEAR** | parser `7:00 PM ET` vs verify `TBD`; no other signal | kickoff |
| w8-navy-notre-dame | downgraded | **UNCLEAR** | parser `12:00 PM ET` vs verify `TBD`; no other signal | kickoff |
| w4-purdue-notre-dame | flagged | PROVENANCE/TOOLING | kickoff TBD (honest); only 1 domain [fbschedules] | second-source |
| w5-north-carolina-notre-dame | flagged | PROVENANCE/TOOLING | kickoff TBD; 1 domain [fbschedules] | second-source |
| w7-byu-notre-dame | flagged | PROVENANCE/TOOLING | kickoff TBD; 1 domain [fbschedules] | second-source |
| w12-syracuse-notre-dame | flagged | PROVENANCE/TOOLING | kickoff TBD; 1 domain [fbschedules] | second-source |
| w5-tennessee-auburn | flagged | PROVENANCE/TOOLING | kickoff TBD; 1 domain [utsports] | second-source |
| w6-arkansas-tennessee | flagged | PROVENANCE/TOOLING | kickoff TBD; 1 domain [utsports] | second-source |
| w7-tennessee-alabama | flagged | PROVENANCE/TOOLING | kickoff TBD; 1 domain [utsports] | second-source |
| w8-south-carolina-tennessee | flagged | PROVENANCE/TOOLING | kickoff TBD; 1 domain [utsports] | second-source |
| w9-tennessee-kentucky | flagged | PROVENANCE/TOOLING | kickoff TBD; 1 domain [utsports] | second-source |
| w10-tennessee-lsu | flagged | PROVENANCE/TOOLING | kickoff TBD; 1 domain [utsports] | second-source |
| w11-vanderbilt-tennessee | flagged | PROVENANCE/TOOLING | kickoff TBD; 1 domain [utsports] | second-source |
| w12-tbd-boise-state | flagged | PROVENANCE/TOOLING | flex finale (opponent TBD); 1 domain [broncosports] | second-source |

## Totals (of 25 non-verified)

| Bucket | Count | Needs human value-review? |
|---|---|---|
| **VALUE CONFLICT** (genuine disagreement) | **2** | **Yes** — Boise memphis/south-dakota (~1h kickoff diffs) |
| PROVENANCE/TOOLING (1-domain / mis-citation; value known or honest-TBD) | **19** | **No** — harness fix, not human review |
| GUARD BUG (false downgrade, values agree) | **1** | No — fix `normTime` (nicholls) |
| UNCLEAR (parser time vs verify TBD, can't tell) | **3** | Maybe — quick manual disambiguation |
| HONEST TBD with no other issue | 0 | (all such games verified) |

**Plainly: genuine human-review load is LIGHT — 2 real value conflicts, plus 3 unclear to eyeball.** The other 20 are tooling, not data: **19 provenance failures** (the blind verify captured a single source domain and/or the Node citation re-fetch can't read crawler-blocked official sites like broncosports.com / utsports.com) and **1 guard bug** (`normTime` doesn't recognize "p.m." with periods, so `6:00 PM` vs `6:00 p.m.` reads as 12h — this also inflated the Boise memphis/south-dakota magnitudes to "11h" when the real diff is 1h). **Three harness fixes — persist all corroborating source domains, parse "p.m.", and fetch crawler-blocked official sites via `web_search` instead of raw Node fetch — should clear ~20 of the 25 with no human review.** Phase 2 should not scale to 25 until they're done, or per-school flag counts will be dominated by tooling noise.

---

# Owed Item 2 — Single-source proof

*Requirement: confirm zero games reached `verified:true` on a single source; for each verified game show ≥2 **distinct domains** (two URLs from the same domain count as one). Computed from `source` (parser) + `verification.sourcesChecked` (verify), de-duplicated by hostname.*

> ⚠️ **THIS PROOF FAILS FROM STORED DATA — flagging loudly, not papering over it.** **10 of 22** verified games show only **one distinct source domain** in the stored trail.

| Distinct domains | Verified games |
|---|---|
| **2 — proof holds** ✅ | w1-notre-dame-wisconsin [nbcsports, fightingirish]; w1-oregon-boise-state [broncosports, goducks]; w2-notre-dame-rice / w3-notre-dame-michigan-state / w6-notre-dame-stanford / w9-notre-dame-miami / w10-notre-dame-boston-college / w11-notre-dame-smu [fbschedules, fightingirish]; w2-kansas-state-washington-state / w3-kansas-state-tulane [wikipedia, kstatesports]; w4-tennessee-texas [utsports, texaslonghorns]; w4-western-michigan-boise-state [broncosports, wmubroncos] |
| **1 — proof FAILS** 🚩 | w3-tennessee-kennesaw-state [utsports only]; w4-cincinnati-kansas-state / w5-kansas-state-houston / w6-kansas-state-kansas / w7-arizona-state-kansas-state / w8-colorado-kansas-state / w9-kansas-state-oklahoma-state / w10-tcu-kansas-state / w11-kansas-state-arizona / w12-iowa-state-kansas-state [en.wikipedia.org only] |

**Root cause — an audit-trail violation, not a verification-logic violation.** `verified:true` structurally requires the second-source guard to pass (`diffGame` returns `verified` only when `guardSecondSource` saw ≥2 distinct domains across `[parser.source, verify.source, ...verify.sources]`). So at *runtime* these 10 games **did** have ≥2 domains — otherwise they'd be flagged, not verified. **But the trail persisted only `verify.source` (the verify's primary URL) into `sourcesChecked`, dropping the full `verify.sources` array the guard actually used.** When parser and the verify's primary URL share a domain (both on `en.wikipedia.org` for 9 K-State games; both on `utsports.com` for Kennesaw State), the stored evidence collapses to one domain and the ≥2-domain claim **cannot be reproduced from the audit trail.**

**Verdict on the contract:** the second-source *guard* held at runtime, but the *proof obligation* — "show ≥2 distinct domains from stored data" — is **not satisfiable for 10/22 games**. Per the brief, that is flagged as a gap, not waved through. **Required fix before Phase 2:** persist the complete set of distinct corroborating domains into `verification.sourcesChecked`, then re-run; only then is the single-source proof auditable. For the **12 games that do show ≥2 distinct domains**, the second domain is a genuinely independent source carrying the value (e.g. `fightingirish.com` corroborating an `fbschedules.com` parse) — **no mis-citation-in-disguise found** among them (the blind verify produced its own value, so agreement = independent carriage, not echoing the parser).

**Net for the Phase 2 decision:** value-level human-review load is light (≈2 + 3 unclear), but **two harness gaps must close first** — (1) the trail under-persists sources, so the second-source contract isn't auditable for ~45% of verified games, and (2) provenance / `normTime` / official-site-fetch bugs inflate the non-verified counts. Both are tooling, both are fixable, neither is a schedule-core data-quality problem.
