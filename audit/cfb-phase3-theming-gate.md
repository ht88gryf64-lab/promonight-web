# CFB Phase 3 — Immersive Theming Gate (mockup match)

**Generated:** 2026-07-08 · **Branch:** `cfb-phase3` (local commits, NOT pushed) · **Preview:** deployed (protection ON). **No prod, no merge, no push to main.**

## Verdict

**PASS.** The approved immersive mockup (`CfbDestinationMockup.jsx`) is now reproduced in the **ONE** `CfbSchoolPage` template against real Firestore data: a full-bleed team-color hero wash bleeding from above the fold + secondary accent glow, Instrument Serif italic drama (kicker, oversized stat numbers, signature title, rivalry/section titles), DM Mono labels, an oversized Outfit name, a saturated signature card, accent section labels, themed schedule rivalry-rows, and themed rivalry gradient cards. It is **contrast-safe across all 86 palettes** (deterministically audited, zero failures) and **degrades cleanly on sparse/auto pages**. Affiliate CTAs stay **site-standard and unchanged** (placement-only match). This was hardened by a 5-lens adversarial review whose real findings were all fixed (below).

Verified against the **built, prerendered HTML** (byte-identical to what the preview serves; Deployment Protection walls anonymous fetch).

## What changed vs the previous (bland) version

- **theme.ts** — the wash now bleeds the **full team color** from above the fold (geometry matches the mockup: `ellipse 92% 72% at 28% -12%`, stops 34%/76%), keeping raw primary for dark teams and darkening only light primaries so white text holds. New `heroWash`/`heroGlow` gradient strings, `accentCard`, `primaryDeep`, `tint`/`rivalryFrom`/`rivalryBorder`.
- **fonts.ts** (new) — Instrument Serif (italic), scoped to the CFB wrapper.
- **CfbSchoolPage.tsx** — reskinned to the mockup's type scale, section structure, and immersive hero; affiliate CTAs reused site-standard.

## Adversarial review (5 lenses) → fixes applied

A workflow ran 5 independent lenses (hero-immersion, typography, layout/sparse, CTA-compliance, one-template/contrast-adversary). 4 returned structured verdicts; the CTA lens hit the structured-output retry cap, but the one-template lens independently confirmed CTA compliance ("render site-standard on neutral surfaces, never team-toned; only placement matches"), corroborated by a deterministic grep (0 affiliate `<a>` carry a `--cfb-*` var). Findings and resolutions:

| # | Lens | Severity | Finding | Fix |
|---|---|---|---|---|
| 1 | contrast-adversary | **blocker** | Traditions section gated on `traditions.length>0 \|\| gamedayCulture` but body only paints `gamedayCulture` → could orphan an empty labeled section | Gated **solely on `gamedayCulture`**; Phase-4 TODO left for the traditions card grid |
| 2 | hero-immersion | major | Near-neutral primary (white/black) → **gray hero** (wash derived only from primary) | Wash **hue cascades** like the accent → sources the chromatic secondary; Iowa (black) now deep-gold, not black-on-black |
| 3 | contrast-adversary | major | `accent` used as label **on the card gradient** dipped to **1.51:1** (Michigan 3.86 < AA) — audit hadn't covered accent-on-card | New **`--cfb-accent-card`** (accent lifted to read on the card); audit extended; min now **4.60** |
| 4 | typography / layout | major | Signature marquee serif rendered the bare matchup = **duplicate** of the eyebrow | Serif now takes the **evocative rivalry trophy name** (matchup falls back only for non-rivalry signatures) |
| 5 | hero-immersion | minor | Lifted-hue accents were **muted slate** (on the 4.5 floor), not the mockup's vivid blue | **Vivid HSL lift** (keep hue, boost saturation): Penn State `#2E8AFF`, Northwestern `#A27DD9` |
| — | typography | nits | eyebrow weight/size, H1 tracking, sub-AA disclaimer opacity | eyebrow 12px/400/0.166em, H1 `-0.036em`, disclaimer `white/55` |

## Exhaustive contrast audit (post-fix, all 86 pages, all layers)

Deterministic WCAG audit over every rendered page — **zero failures**. Worst cases (all ≥ AA 4.5, except the huge hero H1 which only needs AA-large 3.0 and clears 5.87):

| Layer | Min ratio | Worst school | Threshold |
|---|---|---|---|
| white on hero wash-top | 5.87 | michigan (maize) | 3.0 (large) / passes 4.5 |
| accent as small label on base | 5.06 | coastal-carolina | 4.5 |
| ink on accent tag fill | 4.76 | coastal-carolina | 4.5 |
| white on signature card | 5.87 | michigan | 4.5 |
| **card-safe accent on card** | **4.60** | ucf | 4.5 |

(For reference, the *raw* accent-on-card that the review flagged bottomed at **1.51** — now unused; the sig eyebrow uses `--cfb-accent-card`.)

## Six-school spread (the review palettes)

| School | Palette case | primary | accent (team-colored) | hero wash | Verdict |
|---|---|---|---|---|---|
| **Minnesota** | maroon/gold (reference) | `#5B0013` | `#FFB71E` gold | maroon (full) | ✅ matches mockup |
| **Penn State** | dark navy | `#001E44` | `#2E8AFF` **sky blue** (was slate) | navy (full) | ✅ vivid accent, immersive |
| **Michigan** | **white/light** maize | `#FFCB05` | `#FFCB05` maize | deep maize (dark-safe) | ✅ white text holds; card-safe accent `#FFE47B` |
| **Iowa** | **very dark** black | `#000000` | `#FCD116` gold | **deep gold from secondary** | ✅ no longer black-on-black |
| **Northwestern** | **clashing** purple | `#4E2A84` | `#A27DD9` **lavender** | purple (full) | ✅ vivid, no clash |
| **Toledo** | **sparse G5** navy/gold | `#0B2240` | `#FFCD00` gold | navy (full) | ✅ immersive shell on a sparse schedule |

## Sparse / auto degradation

All 86 current pages are `auto` (no editorial), so the signature+why block, traditions, and venue-prose never render (crown none — 0 "signature game" across 86). What renders on every page: immersive hero + stat strip + Plan-your-gameday cluster + schedule + road trips (data-gated) + rivalries (data-gated) + contributor CTA. No orphaned/empty labeled sections (verified: 0 pages render an empty "Gameday & Traditions"). Section order matches the mockup.

## No regressions

- Kickoff fix intact: **0** genuinely impossible 1–6 AM renders across 86.
- Affiliate resolution: TM football slugs (host teams for road trips), resolved venue coords, surface `web_cfb`, zero `0/0` fallbacks.
- ONE template: single component; graduation is a data flip; editorial blocks conditional.

## Preview

`https://promonight-39iiq4mdh-btj8tk69dk-7318s-projects.vercel.app/cfb/<school>` — **Deployment Protection ON** (anonymous GET → 302 SSO). Review authenticated in-browser. Spread: `/cfb/minnesota`, `/cfb/penn-state`, `/cfb/michigan`, `/cfb/iowa`, `/cfb/northwestern`, `/cfb/toledo`.

## Adversarial self-check

1. **Does it actually READ immersive now, or still bland?** Immersive for chromatic teams (full-strength wash) AND for the two subsets that were bland before: light primaries get a dark-safe colored wash (maize→deep gold), and near-neutral primaries now pull the wash from a chromatic secondary (Iowa black→deep gold). The only unavoidable gray is a fully-neutral palette (white+black), which none of the 86 are.
2. **Is contrast safe across ALL 86, including the layer the first audit missed?** Yes — the review found accent-on-card (missed by v1), it's now audited and fixed (min 4.60). Every layer ≥ AA across 86, zero failures, verified deterministically not by eye.
3. **Are the CTAs genuinely site-standard?** Yes — 0 affiliate `<a>` carry a `--cfb-*` var; reused components render their own classes on neutral insets; corroborated by lens 5 after the CTA lens errored.
4. **Did the fixes introduce a regression?** No — rebuilt and re-audited: 0 impossible AM kickoffs, crown-none holds (0 signatures on auto), affiliate slugs/coords intact, ONE template.
5. **Is the mockup match real or superficial?** Structural: hero geometry/stops, type faces + scale (Instrument Serif drama, DM Mono labels, Outfit name), section order, saturated signature card, themed rivalry cards — all reproduced; the marquee serif now carries the evocative trophy name (not a duplicate matchup) as the mockup intends.

---

**STOP — gate only. Preview deployed, no prod, no merge, no push to main.**
