# CFB League Hub (/cfb) — Gate

**Generated:** 2026-07-08 · **Branch:** cfb-phase3 (local commit `cc91f8a`, NOT pushed) · **Preview:** deployed (protection ON). **No push, no merge.**

## Verdict

**PASS.** The `/cfb` rivalry-first league hub is built to the approved mockup (CfbHubFinal.jsx) + §14/14a/14b, on real `cfb*` data. Verified via the built/served HTML (byte-identical to the preview; Deployment Protection walls anonymous fetch).

## What shipped

Replaced the minimal Phase-3 browse index with the full hub: hero → `THIS WEEK · RIVALRY GAMES` rail → national rivalry marquee blocks → theme-games rail → browse-all-86. League-neutral gold `#FFB71E` / red `#e0492e` palette (no team colors), Instrument Serif italic drama, the §14b diagonal rivalry blocks. Files: `src/lib/cfb/hub-theme.ts`, `src/lib/cfb/hub-data.ts`, `src/components/cfb/hub/{blocks,CfbHubBrowse,CfbHubSearch}.tsx`, `src/app/cfb/page.tsx`.

## Gate checks (served HTML)

| Check | Result |
|---|---|
| **Crawlability** — all 86 team `<a href>` in DOM regardless of conference | ✅ **86 distinct `/cfb/{team}` links** in served HTML; all 6 buckets present (SEC 16, Big Ten 18, ACC 17, Big 12 16, Group of 5 17, Independents 2 = 86). Selector is inline `display:none` CSS filter — never conditional-render. |
| **Rivalry-first** | ✅ Hero = "The rivalries, the road trips, and every Saturday that matters"; first rail is rivalry games; then national rivalries; then theme; then browse. No schedule/slate lead. |
| **Weekly rail** | ✅ Diagonal week cards, both team names in top corners (as team-page links), countdown present. Offseason (July) correctly shows `NEXT UP · RIVALRY GAMES` (soonest upcoming, Sept openers) with `UPDATES MONDAY AM`; in-season shows `THIS WEEK · … · WEEK N`. |
| **National blocks** | ✅ Four-color diagonal, home-left 62/38 (neutral→alphabetical for Red River/Cocktail Party), all 4 curated (The Game, Iron Bowl, Red River, Cocktail Party) with real colors + real 2026 dates + curated blurbs. |
| **§14b divider (contrast-safety)** | ✅ Fires on close-**luminance** pairings exactly as the mockup: The Game (Δ0.025), Iron Bowl (Δ0.095), Cocktail Party (Δ0.063) → divider; Red River (Δ0.225) → none. Across **all 111** rivalry pairings: 45 dividers, **0 degenerate blocks** (no all-gray, no identical-primaries-without-divider). |
| **NATIONAL badge inline** | ✅ Structurally in the countdown flex row (`blocks.tsx:79`), guarded by `game.national`; corner names are `absolute top-3` — the badge can never cover a name. Doesn't render in July's next-up window (no national game is imminent); renders inline in-season. |
| **Hero washout** | ✅ h1 is full-opacity white + `text-shadow` over a low-alpha (~13%) gold/red wash on a near-black `#08070d` base; subhead intentionally muted (mockup `#999`) + shadowed, legible on the dark base. No reduced-opacity white over a saturated gradient. |
| **Build** | ✅ Clean; `/cfb` is SSG/ISR (`revalidate=21600`, the homepage date-rollover window). 287 pages. |

## §14a rollover (Monday, CT)

The weekly rail window is CT-anchored (`America/Chicago`, the homepage's exact anchor): current week = Monday→Sunday; on Monday AM the window advances so last weekend's games drop and the coming weekend's show. This is a **pure ISR display cutover** (date-window over already-stored data) — no scrape, no MLB-scan interaction. Countdown ("IN N DAYS") recomputes each ISR regen, resetting on rollover. Offseason (empty window) falls back to the soonest upcoming rivalry games.

## Data provenance (real, not mockup sample)

- **Rivalry slate:** real `cfbGames` (111 dated rivalry games) joined with `cfbRivalries` trophy/name (§8 corroborated tags) + real school colors.
- **National + theme:** CURATED selections (legitimate on a human-curated hub, §9) matched to **real** colors/dates. Theme cards show the well-known theme identity + real colors but **no fabricated date** (the §10 sweep attaches confirmed dates later).
- **Browse:** all 86 schools from `cfbSchools`, bucketed into the mockup's 6 conferences.
- Did NOT import CfbHubFinal.jsx or its hardcoded data/toggle — extracted the treatment only.

## Adversarial self-check

1. **Rivalry-first, or a schedule lead?** Rivalry-first — the hero and the first rail are rivalry-framed; there is no "this Saturday's slate/scores" lead anywhere.
2. **All 86 in DOM, or conditional per conference?** All 86 — grep of served HTML = 86 distinct `/cfb/{team}` links across all 6 buckets; the selector toggles inline `display:none` only (proof + a visible build note in the section).
3. **Diagonal contrast-safe on close pairings (divider fires)?** Yes — divider fires on all sub-0.12-luminance pairings; verified over all 111 rivalry pairings with 0 degenerate blocks; matches the mockup's decisions.
4. **NATIONAL badge ever over a team name?** No — it's inline in the countdown row (never a corner); structurally impossible to overlap a name.
5. **Hero/text washout?** No — h1 full-opacity + shadow; wash is low-alpha over near-black; text holds.
6. **Reused shared components + real data, or hardcoded the mockup sample?** Real `cfb*` data + shared chrome/Instrument Serif; curated national/theme layers matched to real colors/dates; mockup used as visual reference only, not imported.

## Preview

`https://promonight-3wwj5fpt8-btj8tk69dk-7318s-projects.vercel.app/cfb` — Deployment Protection ON (anonymous → 302 SSO). Review authenticated in-browser.

## Notes / follow-ups (non-blocking)

- 1 school lacks a `primaryColor` → falls to the safe dark neutral on its side of any block (still legible via scrim + white text).
- The NATIONAL badge + `THIS WEEK` header render in-season; the July preview shows the offseason `NEXT UP` state (correct, honest).
- `LEAGUE_HUB_REGISTRY` CFB stays `live:false` — flipping it (one line) adds CFB to the global nav menus; that's a launch step after the §12 metadata pass, not part of this build.

---

**STOP — gate only. Preview deployed, no push, no merge.**
