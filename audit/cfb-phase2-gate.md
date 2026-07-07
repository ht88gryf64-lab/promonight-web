# CFB Phase 2 — Reason-Aware Gate Report

**Generated:** 2026-07-07T17:24:44.211Z · **Branch:** cfb-phase2 · **Scope:** 86 schools, 670 unique games (hard data, no pages)

## Headline — no-2nd-source across the run

Corroboration model: a game is 2-source-confirmed when the parser's OFFICIAL source (always the official athletics domain, post Part A) is joined by an independent Wikipedia schedule from EITHER team. **36 no-2nd-source unique games:**
- **35 deferred (pending-publish):** games of the 4 timing-stranded G5 (JMU, Marshall, Toledo, NIU) against opponents that also lack a fetchable 2026 Wikipedia page. NOT coverage holes — official schedules render; re-probe when Wikipedia/SR publish.
- **1 genuine straggler(s):** `tulane@south-florida 2026-11-27` — both teams have a fetchable Wikipedia but neither lists the game at the stored date. Root cause is a **parser off-by-one date error**: two AAC Thanksgiving-weekend games (`tulane@south-florida`, `temple@memphis`) were stored on 2026-11-27 but both teams' Wikipedia place them on 2026-11-28. The games ARE corroborated — just mis-dated by a day — so the gate correctly DECLINED to auto-verify a value a source contradicts and flagged them for human eyeball (the anti-hallucination contract working; not an independence/fetch failure).

**The Phase-1 crawler-block residue collapsed under the Firecrawl source-independence fix.** Every school with a fetchable Wikipedia corroborates its schedule on ≥2 independent domains; Kansas State (the Phase-1 stranded case) is fully corroborated.

## Reason-aware flags (decision record §6.2)

Flag only a non-TBD/non-conflict failure (tooling) OR any no-2nd-source >0. Honest-TBDs never count. **7 flagged** = **4 deferred** (pending-publish G5) + **3 coverage** + **0 tooling**.

🚩 **Coverage flags (3):** memphis (1 no-2nd-source game(s)), tulane (1 no-2nd-source game(s)), south-florida (1 no-2nd-source game(s)) — all trace to the two off-by-one AAC games above (parser stored 11-27, Wikipedia 11-28). A value discrepancy for human eyeball, not an independence gap.

✅ **Zero tooling failures.**

## Single-source proof (stored data)

Every verified game carries ≥2 distinct independent domains (official + Wikipedia). **267/267** satisfy this; **0 single-domain** ✅.

## Determinism (10-school sample, corroborated twice, no retry)

Sample: alabama, georgia, lsu, tennessee, texas, oklahoma, auburn, florida, texas-am, ole-miss
- Run A: {"verified":39,"honestTBD":77,"no2nd":0,"conflict":8}
- Run B: {"verified":39,"honestTBD":77,"no2nd":0,"conflict":8}
- **✅ IDENTICAL** — corroboration is pure code over a deterministic source (no LLM in the verify path).

## Firestore re-check (independent)

Stored verified: **267** · gate recomputed (both-teams): **267** · **✅ MATCH** — Firestore matches the report.

## Totals

verified **368** · honest-TBD **606** · no-2nd-source **38** (per-school) · value-conflict **49**

_July offseason: most kickoffs are unannounced → honest-TBD dominates and never counts against a school. Verified = an announced kickoff matched across two independent domains._

## Per-school table

| School | Conf | games | verified | honest-TBD | no-2nd-src | conflict | tooling | flag |
|---|---|---|---|---|---|---|---|---|
| army | AAC | 14 | 10 | 3 | 0 | 1 | 0 |  |
| memphis | AAC | 12 | 5 | 6 | 1 🚩 | 0 | 0 | coverage |
| navy | AAC | 14 | 11 | 3 | 0 | 0 | 0 |  |
| south-florida | AAC | 12 | 5 | 5 | 1 🚩 | 1 | 0 | coverage |
| tulane | AAC | 12 | 3 | 5 | 1 🚩 | 3 | 0 | coverage |
| boston-college | ACC | 12 | 4 | 8 | 0 | 0 | 0 |  |
| california | ACC | 12 | 4 | 7 | 0 | 1 | 0 |  |
| clemson | ACC | 13 | 5 | 8 | 0 | 0 | 0 |  |
| duke | ACC | 12 | 4 | 6 | 0 | 2 | 0 |  |
| florida-state | ACC | 12 | 4 | 6 | 0 | 2 | 0 |  |
| georgia-tech | ACC | 12 | 1 | 10 | 0 | 1 | 0 |  |
| louisville | ACC | 13 | 5 | 8 | 0 | 0 | 0 |  |
| miami | ACC | 12 | 5 | 7 | 0 | 0 | 0 |  |
| nc-state | ACC | 12 | 3 | 8 | 0 | 1 | 0 |  |
| north-carolina | ACC | 13 | 4 | 8 | 0 | 1 | 0 |  |
| pittsburgh | ACC | 12 | 6 | 6 | 0 | 0 | 0 |  |
| smu | ACC | 13 | 4 | 8 | 0 | 1 | 0 |  |
| stanford | ACC | 12 | 7 | 5 | 0 | 0 | 0 |  |
| syracuse | ACC | 13 | 3 | 9 | 0 | 1 | 0 |  |
| virginia | ACC | 13 | 4 | 9 | 0 | 0 | 0 |  |
| virginia-tech | ACC | 13 | 5 | 8 | 0 | 0 | 0 |  |
| wake-forest | ACC | 13 | 1 | 12 | 0 | 0 | 0 |  |
| arizona | Big 12 | 12 | 2 | 7 | 0 | 3 | 0 |  |
| arizona-state | Big 12 | 12 | 0 | 9 | 0 | 3 | 0 |  |
| baylor | Big 12 | 13 | 4 | 8 | 0 | 1 | 0 |  |
| byu | Big 12 | 12 | 3 | 8 | 0 | 1 | 0 |  |
| cincinnati | Big 12 | 12 | 3 | 9 | 0 | 0 | 0 |  |
| colorado | Big 12 | 12 | 2 | 8 | 0 | 2 | 0 |  |
| houston | Big 12 | 12 | 4 | 8 | 0 | 0 | 0 |  |
| iowa-state | Big 12 | 12 | 3 | 8 | 0 | 1 | 0 |  |
| kansas | Big 12 | 13 | 0 | 12 | 0 | 1 | 0 |  |
| kansas-state | Big 12 | 12 | 1 | 11 | 0 | 0 | 0 |  |
| oklahoma-state | Big 12 | 12 | 3 | 9 | 0 | 0 | 0 |  |
| tcu | Big 12 | 13 | 4 | 7 | 0 | 2 | 0 |  |
| texas-tech | Big 12 | 12 | 4 | 8 | 0 | 0 | 0 |  |
| ucf | Big 12 | 15 | 5 | 9 | 0 | 1 | 0 |  |
| utah | Big 12 | 12 | 3 | 8 | 0 | 1 | 0 |  |
| west-virginia | Big 12 | 12 | 3 | 8 | 0 | 1 | 0 |  |
| illinois | Big Ten | 12 | 0 | 11 | 0 | 1 | 0 |  |
| indiana | Big Ten | 12 | 5 | 7 | 0 | 0 | 0 |  |
| iowa | Big Ten | 12 | 5 | 7 | 0 | 0 | 0 |  |
| maryland | Big Ten | 12 | 3 | 9 | 0 | 0 | 0 |  |
| michigan | Big Ten | 12 | 4 | 8 | 0 | 0 | 0 |  |
| michigan-state | Big Ten | 12 | 3 | 9 | 0 | 0 | 0 |  |
| minnesota | Big Ten | 12 | 4 | 8 | 0 | 0 | 0 |  |
| nebraska | Big Ten | 12 | 4 | 8 | 0 | 0 | 0 |  |
| northwestern | Big Ten | 12 | 2 | 9 | 0 | 1 | 0 |  |
| ohio-state | Big Ten | 12 | 3 | 8 | 0 | 1 | 0 |  |
| oregon | Big Ten | 12 | 2 | 9 | 0 | 1 | 0 |  |
| penn-state | Big Ten | 12 | 3 | 9 | 0 | 0 | 0 |  |
| purdue | Big Ten | 12 | 3 | 9 | 0 | 0 | 0 |  |
| rutgers | Big Ten | 12 | 5 | 7 | 0 | 0 | 0 |  |
| ucla | Big Ten | 12 | 3 | 9 | 0 | 0 | 0 |  |
| usc | Big Ten | 12 | 4 | 8 | 0 | 0 | 0 |  |
| washington | Big Ten | 12 | 5 | 7 | 0 | 0 | 0 |  |
| wisconsin | Big Ten | 13 | 5 | 8 | 0 | 0 | 0 |  |
| liberty | CUSA | 12 | 12 | 0 | 0 | 0 | 0 |  |
| notre-dame | Independent | 14 | 10 | 4 | 0 | 0 | 0 |  |
| uconn | Independent | 12 | 8 | 3 | 0 | 1 | 0 |  |
| toledo | MAC | 12 | 1 | 1 | 10 ⏳ | 0 | 0 | deferred |
| air-force | MWC | 12 | 11 | 1 | 0 | 0 | 0 |  |
| northern-illinois | MWC | 12 | 4 | 0 | 8 ⏳ | 0 | 0 | deferred |
| unlv | MWC | 14 | 13 | 1 | 0 | 0 | 0 |  |
| boise-state | Pac-12 | 11 | 7 | 2 | 0 | 2 | 0 |  |
| fresno-state | Pac-12 | 12 | 10 | 2 | 0 | 0 | 0 |  |
| san-diego-state | Pac-12 | 11 | 10 | 1 | 0 | 0 | 0 |  |
| alabama | SEC | 12 | 1 | 10 | 0 | 1 | 0 |  |
| arkansas | SEC | 12 | 1 | 11 | 0 | 0 | 0 |  |
| auburn | SEC | 13 | 3 | 7 | 0 | 3 | 0 |  |
| florida | SEC | 13 | 5 | 7 | 0 | 1 | 0 |  |
| georgia | SEC | 13 | 4 | 9 | 0 | 0 | 0 |  |
| kentucky | SEC | 12 | 3 | 8 | 0 | 1 | 0 |  |
| lsu | SEC | 12 | 5 | 7 | 0 | 0 | 0 |  |
| mississippi-state | SEC | 12 | 5 | 7 | 0 | 0 | 0 |  |
| missouri | SEC | 12 | 2 | 10 | 0 | 0 | 0 |  |
| oklahoma | SEC | 12 | 4 | 8 | 0 | 0 | 0 |  |
| ole-miss | SEC | 13 | 6 | 7 | 0 | 0 | 0 |  |
| south-carolina | SEC | 12 | 3 | 9 | 0 | 0 | 0 |  |
| tennessee | SEC | 12 | 3 | 9 | 0 | 0 | 0 |  |
| texas | SEC | 12 | 5 | 6 | 0 | 1 | 0 |  |
| texas-am | SEC | 12 | 3 | 7 | 0 | 2 | 0 |  |
| vanderbilt | SEC | 12 | 2 | 9 | 0 | 1 | 0 |  |
| appalachian-state | Sun Belt | 12 | 6 | 6 | 0 | 0 | 0 |  |
| coastal-carolina | Sun Belt | 15 | 6 | 9 | 0 | 0 | 0 |  |
| james-madison | Sun Belt | 12 | 4 | 1 | 7 ⏳ | 0 | 0 | deferred |
| marshall | Sun Belt | 13 | 1 | 2 | 10 ⏳ | 0 | 0 | deferred |

⏳ = deferred (pending-publish G5). 🚩 = coverage/tooling flag.

## Gate verdict

- no-2nd-source coverage holes (both-fetchable): **1 🚩 (1 mis-dated AAC game, human eyeball)** — the Phase-1 residue collapsed.
- pending-publish deferred: **4** (the 4 G5, re-probe near season)
- tooling failures: **0 ✅**
- every verified game ≥2 independent domains: **PROVEN ✅**
- determinism: **PASS ✅**
- Firestore matches report: **YES ✅**

**STOP — Phase 2 gate. No pages, no push, no merge.**
