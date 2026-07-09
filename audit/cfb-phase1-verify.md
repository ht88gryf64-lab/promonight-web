# CFB Phase 1 — Verify Report

**Generated:** 2026-06-13T03:07:54.906Z · **Branch:** cfb-phase1 · **Scope:** 4 spike schools only (no expansion to 25) · **Mode:** full live parse + deterministic harness corroboration _(see the "Re-gate after deterministic FIX 3" section at the bottom — that is the authoritative method and result; the auto-generated body below predates the FIX 3 rewrite)_

## Production safety (confirmed)

**Nothing in the existing site queries the `cfb*` collections.** They are brand-new (`cfbSchools`, `cfbVenues`, `cfbGames`, `cfbRivalries`, `cfbTraditions`) — no route, component, sitemap, or lib reads them. `cfbGames.verified` defaults `false` and is the production-display gate, but there is no production reader yet, so there is **zero chance a `verified=false` row renders in production**. Writes here are isolated and reversible.

## Verify-stage architecture (FIX 3: deterministic, harness-confirmed)

⚠️ _The agent-found verify stage described in older versions of this report has been **removed** from the gate. Corroboration is now pure harness code:_
- `corroborate()` (`scripts/cfb/lib/corroborate.ts`) deterministically fetches the school's Wikipedia 2026 schedule in code and **fact-matches the kickoff** against the parser's value on an independent second domain. No LLM in the verify path.
- A game reaches `verified:true` only when the kickoff is confirmed on ≥2 distinct independent domains; otherwise it is downgraded (conflict) or flagged (honest-TBD / no independent 2nd source). See the re-gate section for the determinism proof and single-source proof.

## Per-school counts (live)

| School | extracted | verified | downgraded | flagged-for-human | HIGH survived |
|---|---|---|---|---|---|
| Tennessee | 12 | 4 | 0 | 8 | 4/12 |
| Kansas State | 13 | 0 | 0 | 13 | 0/13 |
| Notre Dame | 12 | 7 | 0 | 5 | 6/11 |
| Boise State | 12 | 7 | 3 | 2 | 7/12 |
| **Total** | **49** | **18** | **3** | **28** | **17/48** |

### Extractor-HIGH survival rate (Phase 2 gate metric)
**35.4%** of parser values self-rated HIGH survived independent verification (17/48). Spike baseline ~85%.

**Decompose before reading it.** Of 49 games: 18 verified, 3 **downgraded** (the blind verifier's independently-fetched kickoff DISAGREED with the parser — correctly refused; on 2026 games this far out, kickoff times are volatile/just-announced, so two independent extractions legitimately diverge), 28 **flagged-for-human** (provenance not established: <2 distinct source domains and/or the cited URL could not be confirmed by re-fetch — official athletics sites frequently block Node fetches). Neither verdict means "schedule core is wrong"; both mean the guard declined to AUTO-verify a contested or unprovenanced value, which is the contract working.

The drop from ~85% → 35.4% reflects stricter, fully-independent verification on three axes at once (kickoff diff + 2-domain + citation), confirming the parser's HIGH self-rating is unreliable and the verify stage is load-bearing (the spec's thesis). It is **not yet a clean Phase 2 signal**: it conflates kickoff volatility and official-site fetchability with genuine value errors. Phase 2 should gate on (a) the deterministic guard proof below and (b) a survival metric scoped to the STABLE hard-data fields (date/opponent/home-away/venue), not kickoff times.

Live LLM cost this run: ~$0.52 (Haiku + web_search).

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

# Re-gate after deterministic FIX 3 (2026-06-13)

*FIX 3 redone as **harness-confirmed, code-based** corroboration — the verify AGENT is removed from the gate entirely. For each game the harness deterministically fetches the school's Wikipedia 2026 schedule (`scripts/cfb/lib/corroborate.ts`), parses the row, and FACT-MATCHES the kickoff. Selection rule: parser source = official site → corroborate vs Wikipedia; parser source = Wikipedia → no independent code-fetchable 2nd source → stay flagged (constraint 3). Numbers below are read from STORED data.*

## Determinism check — ✅ **PASS** (two back-to-back `--corroborate-only` runs over the same stored games)

| | verified | downgraded | flagged | per-school |
|---|---|---|---|---|
| **Run A** | 18 | 3 | 28 | TN 4/0/8 · KSU 0/0/13 · ND 7/0/5 · BSU 7/3/2 |
| **Run B** | 18 | 3 | 28 | TN 4/0/8 · KSU 0/0/13 · ND 7/0/5 · BSU 7/3/2 |

**Identical.** No re-run was needed to get a match (the first two matched). The gate is deterministic because corroboration is pure code over a deterministic source — no LLM in the verify path.

## Single-source proof — ✅ **PASS** (from stored data; field each 2nd domain confirmed)

All **18** verified games carry **2 distinct independent domains**, and the 2nd domain confirmed the **kickoff** value (not mere game presence — constraint 2). **Zero one-domain verifications.**

- Tennessee (4): `utsports.com` + `en.wikipedia.org`
- Boise State (7): `broncosports.com` + `en.wikipedia.org`
- Notre Dame (7): `fightingirish.com`/`irishsportsdaily.com` + `en.wikipedia.org`

Independence holds: an official athletics site and Wikipedia are genuinely independent sources, not mirrors (the corroborator rejects same-domain and known Wikipedia-mirror hosts — constraint 1).

## Friction breakdown (recomputed, 49 games)

| Bucket | Count | Honest? |
|---|---|---|
| **verified** (kickoff confirmed on 2 independent domains) | 18 | — |
| **value-conflict** (genuine, ~1h) | **3** | the expected timezone-boundary games: Oregon/Fresno/Washington-State @ Boise (parser `PT` vs Wikipedia `MT`, true 1.0h — not 11h) |
| **honest-TBD** (kickoff unannounced on parser source AND Wikipedia) | 14 | ✅ honest, resolves as season nears |
| **no-independent-2nd-source** (constraint 3) | 14 | ✅ honest/conservative — **13 are Kansas State** (its parser used Wikipedia, so there is no independent code-fetchable 2nd source; official site is crawler-blocked) + **1 is ND-Wisconsin** (neutral-site Shamrock Series row the Wikipedia parser doesn't extract) |

**Zero tooling-driven non-verifications** in the prior sense (agent single-domain capture / fabricated junk) — the agent is gone. The 14 "no-2nd-source" are the constraint-3 conservative flags the brief explicitly blessed ("Conservative is correct. Do not relax this to inflate the verified count.") — I did not relax it; verified rose 3→18 purely from genuine code fact-matches.

## Guards still fire
- Boise timezone: the genuine conflicts now surface at their **true ~1h** (PT/MT boundary), not 11h; the 16/16 deterministic fixtures still fire (above).
- Notre Dame `conferenceGame`: independently re-checked from stored data — **all 12 ND games `null`**.

## Adversarial self-check
1. **Corroboration is HARNESS CODE**, not the agent — `corroborate()` is a pure function; `blindVerifySchool` is no longer in the gate path. ✅
2. **The 2nd domain carries the VALUE** — `fieldConfirmed=kickoff` on all 18; the fact-match compares normalized kickoff *times*, not game existence. ✅
3. **No mirror/syndication** — all 2nd domains are `en.wikipedia.org` paired with an official athletics site; mirror hosts are rejected. ✅
4. **The two determinism runs matched exactly** (18/3/28), no retry to force a match. ✅
5. **Verified did NOT rise by relaxing constraint 3** — the 14 no-2nd-source stayed flagged (Kansas State is 0-verified precisely because constraint 3 was enforced). ✅

## Verdict
The three hard bars are **met**: determinism runs match exactly, the single-source proof passes from stored data, and agent-tooling non-verifications are zero. The remaining friction is **3 genuine timezone conflicts + 14 honest-TBD + 14 honest "no-independent-2nd-source"** — none of it is the old tooling.

**The one residue worth your call before greening Phase 2:** the deterministic corroborator code-parses **Wikipedia** as its independent source, so a school whose **parser** also used Wikipedia (Kansas State, 13 games) has no second code-fetchable independent source → 0 verified, flagged honestly. That is correct-but-conservative, not a bug. To give those schools coverage, the clean Phase-2-prep fix is to make the **parser prefer the official site** (freeing Wikipedia to corroborate) and/or add a second code-parseable independent source (e.g. Sports-Reference); also extend the Wikipedia parser to the neutral-site row (ND-Wisconsin). With those, the no-2nd-source bucket collapses toward zero. **Flagging for your decision; not starting Phase 2.**
