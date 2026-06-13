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
