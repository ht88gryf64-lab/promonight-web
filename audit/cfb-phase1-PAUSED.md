# CFB Phase 1 — PAUSED (resume state)

**Paused:** 2026-06-13 · Cold-resume marker. Read this, then `audit/cfb-stream-build-spec.md` (locked spec) and `audit/cfb-phase1-verify.md` (gate report — the "Re-gate after deterministic FIX 3" section is authoritative).

---

## 1. Where we stopped

**Phase 1 is GREEN.** The deterministic, harness-confirmed verify is built and proven. Last commit **`429e32d`** on branch **`cfb-phase1`**. **No push, no merge, no Phase 2 started.** (Lineage: `cfb-phase1` off `cfb-data-spike` — both local-only.)

Key files: `src/lib/cfb/{types,rules}.ts`; `scripts/cfb/lib/{anthropic,guards,schools,pipeline,corroborate}.ts` (`corroborate.ts` is the FIX-3 deterministic second source); `scripts/cfb/run-phase1.ts` (orchestrator; `--no-llm`, `--corroborate-only`); `scripts/cfb/gate-fixtures.ts`; `audit/cfb-phase1-verify.md`.

Re-run / re-check (idempotent):
```
# full live: parse (LLM) + deterministic harness corroboration + report
npx tsx --env-file=.env.local --require ./scripts/stub-server-only.cjs scripts/cfb/run-phase1.ts
# determinism re-check (no LLM): re-corroborate the EXISTING stored games
npx tsx --env-file=.env.local --require ./scripts/stub-server-only.cjs scripts/cfb/run-phase1.ts --corroborate-only
```

## 2. Gate result (final, from stored data)

**Two back-to-back runs both `18 verified / 3 conflict / 28 non-verified`, identical, no retry.** Breakdown:
- **18 verified** — each with **2 independent domains** (official athletics site + `en.wikipedia.org`), kickoff **value** confirmed (`fieldConfirmed=kickoff`), zero one-domain verifications.
- **3 genuine timezone-boundary conflicts** — Oregon / Fresno / Washington State @ Boise (~1h, parser `PT` vs Wikipedia `MT`).
- **14 honest-unannounced TBD** — kickoff genuinely not yet announced on either source.
- **14 no-independent-2nd-source** — **13 are Kansas State** (its parser used Wikipedia, and the official site is crawler-blocked, so no independent code-fetchable second domain) + **1 is ND-Wisconsin** (neutral-site Shamrock Series row the Wikipedia parser doesn't extract).

## 3. The three hard bars

- **Determinism — PASS** (two runs match exactly, no retry).
- **Single-source proof from stored data — PASS** (every verified game shows ≥2 distinct independent domains; zero on one domain).
- **Zero tooling-driven non-verifications — PASS** (the verify agent is removed from the gate; nothing flags for harness flakiness).

The **fourth clause** ("remaining friction is just conflicts + TBDs") has the **14-game no-2nd-source residue**, which is **correct-but-conservative** — constraint 3 staying flagged rather than verifying on a single domain. **Not a bug.**

## 4. Decision deemed made

**Phase 1 is green.** The no-2nd-source residue is a **source-independence limitation to fix at the FRONT of Phase 2**, not a reason to re-gate Phase 1 a fourth time.

## 5. What Phase 2 will be (do NOT start it)

Three parts, one pass, no pages built:
- **(a) Source-independence fix.** Prefer the **official athletics site** as the parser source (frees Wikipedia as the independent corroborator); add **Sports-Reference** as a second code-parseable corroborating source so no school is stranded; teach the Wikipedia parser the **neutral-site row** (ND-Wisconsin class).
- **(b) Full 25-school anchor-list run** (schedule + venue + colors + rivalry facts), harness-confirmed verify on each. The 25-school list is fixed in `audit/cfb-stream-build-spec.md` §2.
- **(c) Per-school gate.** Report **per-school verified rate AND no-2nd-source rate**; **stop/flag any school under a minimum corroboration floor** rather than calling it covered.

## 6. Two open decisions owed by Matt before the Phase 2 draft

1. **Confirm:** fold the source-independence fix into Phase 2 (vs re-gating Phase 1 a fourth time). _Leaning yes._
2. **Set the corroboration floor:** the minimum per-school verified rate below which Phase 2 flags a school for human review rather than shipping it. _Suggested start: under 50% verified = flagged_ — Matt to confirm the number, accounting for June honest-TBD noise (many kickoffs legitimately unannounced this far out).

## 7. State hygiene (confirmed at pause)

- **Working tree clean** — `git status` empty: nothing staged, nothing uncommitted.
- **Untracked files:** none in the repo.
- **No secrets staged or committed** — only `.env.example` and `.env.local.example` (placeholder templates) are tracked; real `.env.local` and `promo-pipeline/.env.local` are gitignored. The only `ANTHROPIC_API_KEY` grep hit is the env-var *name* in `run-phase1.ts`'s runtime read-regex, not a value.
- **Not pushed, not merged** — `cfb-phase1` is local-only at `429e32d`.
