# CFB Phase 1 — PAUSED (resume state)

**Paused:** 2026-06-12 · Cold-resume marker for the CFB stream build. Read this, then `audit/cfb-stream-build-spec.md` (the locked spec) and `audit/cfb-phase1-verify.md` (the gate report).

---

## 1. Where we stopped

**Phase 1 gate reached and held.** Schema + schedule parser + blind verify stage built and run for the 4 spike schools only.

- **Branch:** `cfb-phase1`, branched off `cfb-data-spike` (which is itself NOT merged/pushed — it holds the spike + verification pass, commits `40f266d`, `fd4bec9`).
- **3 Phase-1 commits** on top of that base:
  - `677dba8` — docs(cfb): commit locked build spec into repo (step 0)
  - `a80d534` — feat(cfb): Part A — five forked collection types + rule gates
  - `808b748` — feat(cfb): Parts B–D — schedule parser, blind verify stage, gate + report
  - _(this PAUSED note is committed on top as the resume marker)_
- **No push. No merge. No UI. No expansion to the 25-school anchor list.**

Key files: `src/lib/cfb/types.ts` (5 forked types), `src/lib/cfb/rules.ts` (derived-field gates), `scripts/cfb/lib/{anthropic,guards,schools,pipeline}.ts`, `scripts/cfb/run-phase1.ts` (orchestrator), `scripts/cfb/gate-fixtures.ts` (standalone deterministic guard proof), `audit/cfb-phase1-verify.md` (report).

Re-run the pipeline (idempotent — clears `cfbGames` first):
```
npx tsx --env-file=.env.local --require ./scripts/stub-server-only.cjs scripts/cfb/run-phase1.ts
# ANTHROPIC_API_KEY is read at runtime from promo-pipeline/.env.local (gitignored); promo-pipeline is untouched.
# --no-llm runs the gate proof + schema seed + report without live extraction.
```

## 2. Gate status

- **47 games / 22 verified / 13 downgraded / 12 flagged-for-human** (last run `bg6hagggi`).
- **Firestore independently confirmed to match the report** (queried `cfbGames`: 47 total, 22 `verified=true`, verdicts `{verified:22, downgraded:13, flagged-for-human:12}`).
- **Idempotency held** — the run logged "cleared 48 stale cfbGames"; collection no longer accumulates across runs (doc IDs shift with the parser's week assignment, so the run clears `cfbGames` before writing).
- Five collections populated: `cfbSchools` 4, `cfbVenues` 4, `cfbRivalries` 2 (with `seriesStartYear`/`trophyCreatedYear` **split**), `cfbTraditions` 2, `cfbGames` 47.
- **5/5 anti-hallucination guards proven firing on known-bad data: 16/16 deterministic checks** (`scripts/cfb/gate-fixtures.ts` and the report's guard section).
- Verify stage is **structurally** blind: `blindVerifySchool(school, skeleton)` accepts only `{date, homeTeam, awayTeam}` — no field exists for the parser's kickoff/tz/network/conference.
- **HIGH-survival rate this run: 46.8% (22/47)** vs ~85% spike baseline. NOTE: this metric is **noisy across runs** (observed 13.9% → 23.4% → 46.8% over three live runs, driven by LLM nondeterminism + transient API/official-site fetch outcomes). It is **not** a stable Phase-2 gate signal on its own — gate Phase 2 on the deterministic guard proof + a hard-data-scoped survival metric (see §3).

## 3. What the gate still owes before Phase 2 (open asks)

1. **Downgrade/flag breakdown BY REASON (not yet computed — do this first on resume).** The 25 non-verified games (13 downgraded + 12 flagged) must be split into:
   - (a) honest **"TBD because genuinely unannounced"** — parser and independent verify both returned TBD / one returned TBD conservatively (kickoff not yet officially set this far out). These are *cheap* — no human judgment needed, they resolve themselves as the season nears.
   - (b) **"flagged because sources disagreed, or the value exists but couldn't be confirmed"** — real value conflict (e.g. `kickoff mismatch 2.0h`) or unestablished provenance (`<2 source domains`, `citation unverifiable` — official sites block Node fetch). These are the *expensive* ones that gate the 25-school human-review load.
   - **Source of truth:** `cfbGames.verification.flags[]` in Firestore. Tally flag strings: `kickoff presence mismatch ...=TBD` → bucket (a); `kickoff mismatch Nh` → bucket (b, conflict); `only N independent source domain(s)` / `citation unverifiable` → bucket (b, provenance). This number decides whether the 25-school wedge human-review load is light or heavy.
   - Recommended refinement: compute the survival metric on **stable hard-data fields** (date / opponent / home-away / venue) separately from volatile kickoff times — that is the number that should actually gate Phase 2.

2. **Two load-bearing proofs to state explicitly in `audit/cfb-phase1-verify.md`:**
   - (a) **Boise timezone guard caught the +2h, with before/after** — ALREADY PRESENT in the report (section "Boise timezone case — before/after", 6/6 rows `🚩 +2h CAUGHT`). ✅ done; just confirm it stays.
   - (b) **Zero claims reached `verified:true` on a single source** — STRUCTURALLY guaranteed by `guardSecondSource` (requires ≥2 distinct source domains) + `diffGame` (returns `verified` only when that guard passes), but **not yet stated explicitly** in the report. OWED: add an explicit statement AND back it empirically (query the 22 `verified=true` games, confirm each has ≥2 distinct source domains across `source` + `verification.sourcesChecked`).

## 4. What Phase 2 will be (do NOT start it)

**Pipeline to 25 (hard data).** Run schedule + venue + colors + rivalry facts across all 25 anchor schools (build spec §2 list), verify pass on each. Produce a per-school coverage + verification report (claims / verified / downgraded / flagged-for-human, per school). **No pages built.** Stop-and-report gate (build spec §8, Phase 2).

Do not start Phase 2 in this resume without an explicit go. The 25-school list is fixed in the build spec; Phase 1 deliberately did NOT touch it.

## 5. State hygiene (confirmed at pause)

- **Working tree clean** — `git status` empty: nothing uncommitted, nothing staged.
- **Untracked files:** none in the repo (the workflow scripts used during the spike live under the session transcript dir, not the repo).
- **No secrets tracked or committed.** Only `.env.example` and `.env.local.example` (placeholder templates) are tracked; the real `.env.local` and `promo-pipeline/.env.local` are gitignored and untracked. No `sk-ant-…` or service-account literals are committed — `scripts/cfb/run-phase1.ts` reads `ANTHROPIC_API_KEY` from `promo-pipeline/.env.local` at runtime (the only grep hit is the env-var *name* inside a read-regex, not a value).
- **Not pushed, not merged.** `cfb-phase1` is local-only.
