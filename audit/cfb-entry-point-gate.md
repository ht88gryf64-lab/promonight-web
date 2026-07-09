# CFB Entry Points (Part B) — gate

**Generated:** 2026-07-09 · **Branch:** cfb-phase3 (local, NOT pushed/merged) · **Committed CFB state: `live: false`** (the one-line go-live flip is the user's merge-time action).

Adds the CFB entry points across the three nav surfaces and fixes the stale "167 teams" count, all gated so the site is **byte-unchanged in production until a single flag flips**.

## What shipped

### B1 — CFB chip + conference sub-row (home browser + /teams)
- A **CFB chip** is appended after the pro-league chips in BOTH team browsers — `TeamGrid` (home, used by the live redesign home AND the gate-off home) and `TeamsBrowser` (/teams). It is **not** added to `LEAGUE_ORDER` (that array drives the pro per-league counts; a CFB entry there would render "CFB (0)").
- CFB is a **college-hub entry point, not a pro-league filter**: selecting the CFB chip reveals a **conference sub-row** (`CfbConferenceSubRow`) in place of the pro grid — 6 conference chips that DEEP-LINK to `/cfb?conf=<slug>`, plus "View the full hub →" to `/cfb`. **No CFB cards ever render in the pro promo grid, and CFB is never counted in the "All" total** (the pro grid/counts are untouched).
- The sub-row is shown **only when the CFB chip is active** (client state), and the chip only exists when the CFB hub is live.

### B2 — top-nav dropdown (desktop + mobile)
- **No component change needed — the nav is already 100% registry-driven.** `LEAGUE_HUBS = LEAGUE_HUB_REGISTRY.filter(h => h.live)`, and both `BrandBarLeagueHubs` (desktop) + `BrandBarMobileMenu` (mobile) map over it. CFB is already in the registry; flipping its `live` to `true` auto-adds it to both.
- **Single source, single flip:** the home/teams CFB chip gates on the SAME flag via `isCfbHubLive()` (new helper in `league-hubs.ts` reading the registry). So one registry edit (`CFB` `live: false → true`) lights up the desktop nav, the mobile nav, the home chip, and the /teams chip together. No second CFB-visible boolean anywhere.

### B3 — 167 → 169, derived (not re-hardcoded)
- Real Firestore pro-team count is **169** (MLB 30 · NBA 30 · NFL 32 · NHL 32 · MLS 30 · WNBA 15 — MLS 29→30 and WNBA 13→15 are the +2). Zero CFB rows in the `teams` collection, so deriving from `getAllTeams().length` naturally excludes CFB.
- **Headline surfaces DERIVE the count live** from `getAllTeams().length` (never re-hardcoded):
  - Home: `RedesignHomePage` gets a `teamCount` prop from `page.tsx`'s `allTeams.length` (hero + "Browse/View all N teams"). Gate-off home path uses `{allTeams.length}` inline.
  - /teams: hero uses `{teams.length}`; metadata converted to `generateMetadata()` deriving the count (title "All 169 Pro Sports Teams"); the "All (169)" chip already derives via `teams.length`.
- **Static SEO/marketing copy** (footer ×2, about, layout root metadata, llms.txt, promos-list leads, indie block, my-teams, team-star-picker placeholder, promo-helpers FAQ, home JSON-LD/FAQ) updated to **169** as deliberate copy — consistent with the standing "hardcode the number in SEO copy, bump deliberately" guidance. Also removed a `getFullYear()` in the /teams SEO description (hardcoded season `2026`).
- **Left at 167 intentionally:** 5 internal CODE COMMENTS (affiliates.ts ×2, types.ts, FanaticsCTA, analytics.ts) referencing the historical 167-team Firestore migration — not user-facing.

## Verification (both gate states built clean)

**Build A — CFB `live: true` (temporary, to prove the entry points):**
- `next build` → **287/287 static pages, 0 timeouts, EXIT 0.**
- Count = **169** everywhere, comment-tolerant checked: home hero "169 teams · 6 leagues", "Browse all 169 teams", "View all 169 teams"; /teams title "All 169 Pro Sports Teams", "All (169)" chip. **Zero stale "167 teams" rendered** on home or /teams.
- CFB **chip present** in home + /teams SSR HTML.
- CFB **in top-nav**: 2 `aria-label="CFB promotional schedule"` hub links on home (desktop + mobile), 2 on /teams.
- Conference sub-row correctly **absent from SSR HTML** (client-state-gated behind the chip click), `/cfb?conf=` links appear only after activating CFB.
- Slug round-trip verified: sub-row emits `/cfb?conf={sec,big-ten,acc,big-12,group-of-5,independents}`; `/cfb` reads each back to the exact hub bucket (bogus → All). `/cfb` stays STATICALLY rendered (the deep link is read client-side, no dynamic bailout, all 86 links still in the crawlable DOM).

**Build B — CFB `live: false` (the committed state):**
- `next build` → **287/287 static pages, 0 timeouts, EXIT 0.** /cfb hub + 86 school pages still build.
- **No CFB chip** in home/teams (0 `>CFB<`), **no CFB nav link** (0 `/cfb` refs) — gate-off = pro browsers unchanged.
- Count still **169** (home 19×, /teams title + "All (169)" chip) — independent of the CFB flag.

`tsc --noEmit` clean (EXIT 0) in both states.

## Adversarial checklist
- **No CFB cards in the pro promo grid?** ✅ Selecting CFB swaps the grid for the conference sub-row; the pro grid/`filtered` logic is untouched and never receives CFB data (there is none in `getAllTeams()`).
- **CFB not in the "All" count?** ✅ "All" = `teams.length` (pro only, 169); the CFB chip carries no count and adds nothing.
- **Sub-row only for CFB?** ✅ Rendered solely when `active === 'CFB'`; pro leagues render the grid exactly as before.
- **Nav live-gated + single-source?** ✅ One registry `live` flag drives nav (via `LEAGUE_HUBS`) AND the browser chips (via `isCfbHubLive()`); no duplicate visibility switch.
- **Count = league-chip sum + derived, all three surfaces?** ✅ 169 = the six pro league chip counts; headline derives from `getAllTeams().length`; home + /teams + nav all done.
- **Gate-off safety?** ✅ With `live: false` the CFB chip/sub-row/nav do not render; the live pro browsers are unchanged. Only the count (169) is always-on — that is the intended B3 fix.

## Go-live (user, at merge)
Flip **one line** in `src/lib/league-hubs.ts`: `CFB … live: false → true`. That simultaneously lights the desktop nav dropdown, the mobile nav sheet, the home CFB chip, and the /teams CFB chip (all verified in Build A). Merging cfb-phase3 → main ships the /cfb hub + 86 pages + these entry points.

---

**STOP — Part B gate. No push/merge. CFB committed `live: false`.**
