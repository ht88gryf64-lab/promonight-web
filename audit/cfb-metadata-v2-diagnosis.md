# CFB Metadata v2 — Phase 1 Diagnosis (read-only)

**Generated:** 2026-07-16 · **Branch:** `main` (diagnosis only, no code changes) · **Scope:** Ahrefs-grounded (Jul 12) re-optimization of CFB team-page + `/cfb` hub metadata and the rivalry body-content gap. **STOP-and-report gate — no implementation until A/B/C approved.**

Grounded in real Firestore data via a read-only probe (imported the live `selectFeaturedRivalry`, char-counted a proposed template against all 86 school docs; no writes).

---

## Why (the keyword data)

- `"[school] football schedule 2026"` is the volume prize: Ohio State 10,000/mo (KD 6), Alabama 8,300 (KD 10), Notre Dame 7,800 (KD 12), Michigan 3,600 (KD 8), Penn State 3,300 (KD 7).
- Current titles for schools **with** a marquee trophy **dropped the word "Schedule"** (live: `Ohio State Football 2026: The Game & Gameday`). That omits the exact 10k query term — the biggest available win.
- The rivalry term with volume **names both schools**: `"ohio state michigan rivalry"` = 900/mo (KD 12). The generic phrase the launch pass targeted, `"ohio state football rivalry games"`, is 10/mo. Fix the phrasing → name the rival.
- Logistics long-tail is KD 0–1: `"[school] football parking"` 500, `"[stadium] parking"` 300, `"[stadium] bag policy"` 200.
- Hub term `"college football rivalries"` = 1,200/mo (KD 0) — hub stays rivalry-first (correct).
- Google flagged **"Missing: rivalry"** on the Ohio State SERP result: the word never appears in the rendered page body. Metadata promises rivalry; content does not deliver it.

---

## Branch-state correction

The `cfb-phase3` "PREVIEW-ONLY / unmerged" memory is **stale**. CFB is **merged to `main`**: `src/app/cfb/**`, `src/components/cfb/**`, `src/lib/cfb/**` are all tracked. `feature/cfb-metadata-v2` branches cleanly off current `main`.

## Where the code lives

| Concern | File |
|---|---|
| **Title + description generation** | `src/lib/cfb/metadata.ts` — `buildCfbTeamMetadata()`, `buildCfbHubMetadata()`, `selectFeaturedRivalry()` |
| Team route wiring + **SportsTeam JSON-LD** | `src/app/cfb/[school]/page.tsx` (`generateMetadata` → builder; JSON-LD lines 48–59) |
| Hub route wiring | `src/app/cfb/page.tsx:20` → `export const metadata = buildCfbHubMetadata()` |
| **Body template (the ONE template)** | `src/components/cfb/CfbSchoolPage.tsx` |
| Rivalry tag pill | `src/components/cfb/cfb-bits.tsx` → `TrophyTag` |
| Data shaping / rival resolution | `src/lib/cfb/data.ts` → `getCfbSchoolPage`, `CfbGameView.rivalry`, `.opponentName` |
| Launch gate | `audit/cfb-metadata-gate.md` (full 86-school table, PASS 2026-07-08) |

---

## Finding 1 — Titles drop "Schedule" for trophy schools (CONFIRMED)

`metadata.ts:97–109`. For a school **with** a rivalry, the candidate chain leads with the trophy; "Schedule" only appears in the last-resort fallback:

```
`${name} Football 2026: ${feat.token} & Gameday`   ← LIVE  ("Ohio State Football 2026: The Game & Gameday")
`${name} Football 2026: ${feat.token}`
`${name} Football 2026: Rivalries & Gameday`
`${name} Football 2026: Rivalries`
`${name} Football 2026 Schedule`                   ← "Schedule" only reachable here
```

Per the launch gate, **80/86 titles feature a trophy and omit "Schedule" entirely.**

### The hard constraint: 47-char field budget

The root layout (`src/app/layout.tsx:54`) applies `title.template: '%s | PromoNight'`, appending **13 chars to every rendered `<title>`**. House standard = **rendered ≤60**, so the title **field budget is 47** (`TITLE_MAX = 60 − 13`). The spec's "≤60 hard limit" = the **rendered** title (field + brand); the field must stay ≤47. All numbers below are measured this way.

## Finding 2 — Metadata is tier-derived (CONFIRMED)

`metadata.ts:85` → `isDestination = data.editorialStatus === 'destination'`, sourced from `CfbSchool.editorialStatus`. The description branches on it; `auto → destination` graduation auto-upgrades copy with no hand edit. **All 86 are currently `auto`** (probe-confirmed) — the `destination` branch is dormant, changes propagate on graduation.

## Finding 3 — Body copy "rivalry" gap (CONFIRMED)

Grep of rendered body copy in `src/components/cfb/`:

- The **singular word "rivalry" does NOT appear in any rendered prose** on the team page. Google's "Missing: rivalry" is accurate.
- **"Rivalries" (plural)** appears exactly twice, both as labels, never in a sentence: the hero stat-strip label (`CfbSchoolPage.tsx:60`) and `<Eyebrow>Rivalries</Eyebrow>` (`:218`).
- The **rival school name appears only as `vs {opponentName}`** in the rivalry cards (`:244`) — never paired with the word "rivalry". `"ohio state michigan rivalry"` (900/mo) has no body target.

**Where trophy/rivalry tags render + surrounding copy:** the "Rivalries" section (`:214–253`) is **pure card tags** — trophy/rivalry name (serif, linked to Wikipedia), a `vs/at {opponent}` subtitle, a tiny secondary name. Plus schedule-row `TrophyTag` pills (`CfbSchedule.tsx:38,94`) and the dormant destination signature card (`:155`). **Zero descriptive prose** — that is the gap.

---

## Feasibility proof (read-only probe, all 86 schools)

| Check | Result |
|---|---|
| "Schedule" fits (rendered ≤60) | **86/86** — 0 over; longest core ("Mississippi State"/"Northern Illinois") = 40/47 field |
| Any title missing "Schedule" | **0** |
| Trophy token **retained** in title | **41/80** rivalry schools |
| Trophy token **dropped** → `: Rivalries` / `& Gameday` | **39/80** (long names) |
| Description **names the rival school** | **80/80** has-rivalry schools |
| Description includes **"[Stadium] parking"** | **86/86** |
| Description ≤155 | **86/86** (min 107, max 155; 5 land exactly at cap: Arizona, James Madison, Penn State, South Carolina, Wake Forest) |

Proven examples:
- `Ohio State Football Schedule 2026: The Game | PromoNight` (56) — **gains Schedule AND keeps The Game.** Desc: *"Ohio State Buckeyes 2026 football schedule, The Game vs Michigan, plus tickets, Ohio Stadium parking and hotels for every home game."* (132)
- `Penn State Football Schedule 2026: Rivalries | PromoNight` (57) — gains Schedule; trophy+rival move to desc: *"Penn State Nittany Lions 2026 football schedule, Governor's Victory Bell vs Minnesota, plus tickets, Beaver Stadium parking and hotels for every home game."* (155)

**The core trade** for 39 long-token schools: title **gains "Schedule"** (e.g. 3,300/mo for Penn State), **loses the visible trophy token** (~10/mo generic), but **trophy + rival survive in the description**. The 41 short-token schools are strictly better (gain Schedule, keep trophy).

### The 39 rivalry schools that drop the trophy token from the title

App State, Arizona State, Arkansas, Baylor, Boston College, Coastal Carolina, Colorado, Florida State, Houston, Indiana, Iowa State, James Madison, Kansas State, Liberty, Louisville, LSU, Marshall, Maryland, Michigan State, Mississippi State, NC State, North Carolina, Northwestern, Notre Dame, Oklahoma State, Penn State, Pittsburgh, Rutgers, South Carolina, Syracuse, Tennessee, Texas A&M, Texas Tech, Toledo, Vanderbilt, Virginia, Virginia Tech, Wake Forest, West Virginia.

(Most land on `: Rivalries`; five land on `& Gameday` — Boston College, Michigan State, North Carolina, Oklahoma State, South Carolina; two land on bare `… Schedule 2026` — Mississippi State, Coastal Carolina.)

### The 6 no-rivalry schools (must never claim "Rivalries")

Air Force, Northern Illinois, SMU, UCF, UNLV, USF → `… Football Schedule 2026 & Gameday` (no rivalry over-claim).

---

## Two things Phase 2 must handle (surfaced by the probe)

1. **Rival name must use the resolved `opponentName`, not the raw slug.** The probe printed 6 rivals as slugs (`georgia-southern`, `miami-oh`, `old-dominion`, `bowling-green`, `southern-miss`, `washington-state`) — a probe artifact (it read raw games). Production's `getCfbSchoolPage` resolves these via `nameById || prettifySlug`, so Phase 2 pulls `CfbGameView.opponentName` (already "Georgia Southern", etc.). **These 6 are explicit Phase-3 verification targets.** Minor pre-existing nit: `prettifySlug("miami-oh") → "Miami Oh"`; matches the page body already, out of scope.
2. **The 6 no-rivalry schools must never claim "Rivalries"** (adversarial #5). Handled by keeping the token-present branch distinct from the source-`none` branch.

## Hub (`/cfb`) — within limits

- Title `College Football Rivalries & Gameday 2026` → **54 rendered** ✓ (rivalry-first, keep).
- Description = **152** ✓ (≤155). **Flag:** contains em dashes (`—`) — `feedback_em_dashes` says avoid in user-facing copy. Already shipped, within limits; optional cleanup.

## Other notes

- `DESC_MAX` is **160** in code; spec sets **155** → Phase 2 tightens (all 86 already pass at 155).
- `belowIndexFloor` (`[school]/page.tsx:28`) noindexes pages with <8 games or no venue — metadata still generates for all 86; doesn't affect the template work.
- OG image (`/og-image.png`) and SportsTeam JSON-LD are independent of title/desc/body; the body prose lands in `CfbSchoolPage.tsx`, separate from the JSON-LD in `[school]/page.tsx`. Both stay undisturbed — Phase 3 re-verifies.

---

## Decisions required before Phase 2

**(A) Trophy trade-off** — confirm 39 marquee/trophy schools drop their **visible title trophy** to gain "Schedule" (trophy+rival still in description). Recommendation: **yes** (it is the point of the change).

**(B) Fallback wording for those 39** — drop to `: Rivalries` (recommended: truthful rivalry signal, differentiates from no-rivalry schools) vs. spec's literal `& Gameday`. Recommended chain: `: Rivalries` → `: Rivalries & Gameday` → `& Gameday` → bare.

**(C) Body "Rivalry Games" section** — add generated prose to the existing "Rivalries" section using the word **"rivalry"** and **naming the rival**, e.g. *"The Ohio State vs Michigan rivalry, known as The Game, is played Sat · Nov 28 at Ohio Stadium."* — one sentence per tagged rivalry game, from `cfbRivalries` + game data only (no invention; omitted when no rivalry tag). Keep eyebrow **"Rivalries"** (recommended) or rename to **"Rivalry Games"**?

---

## Templates to implement (pending A/B/C)

**Title** (field ≤47 → rendered ≤60; "Schedule" MANDATORY in every candidate):
```
has-rivalry:  `${name} Football Schedule 2026: ${token} & Gameday`
              `${name} Football Schedule 2026: ${token}`
              `${name} Football Schedule 2026: Rivalries & Gameday`
              `${name} Football Schedule 2026: Rivalries`
              `${name} Football Schedule 2026 & Gameday`
              `${name} Football Schedule 2026`
no-rivalry:   `${name} Football Schedule 2026 & Gameday`
              `${name} Football Schedule 2026`
```

**Description** (≤155; name the rival + "[Stadium] parking"; tier-aware — destination may add gameday/tailgating):
```
`${fullName} 2026 football schedule, ${rivName} vs ${rival}, plus tickets, ${stadium} parking and hotels for every home game.`
  → drop "for every home game" → drop stadium ("parking") → drop trophy-clause → bare
```

**Verification harness:** re-run the probe against the post-edit `buildCfbTeamMetadata` for a real 86-school + hub char-count table → `audit/cfb-metadata-v2-gate.md`; cache-busting curl for the "rivalry" body token on 6 spot-check schools; `tsc --noEmit`; OG + JSON-LD intact.

**Probe artifact:** `scratchpad/cfb-metadata-probe.{ts,json}` (read-only; run `npx tsx --env-file=.env.local` from repo root).
