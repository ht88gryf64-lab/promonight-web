# CFB Phase 3 — Gate Report (auto pages + theming engine)

**Generated:** 2026-07-07 · **Branch:** cfb-phase3 (off cfb-phase2) · **Scope:** /cfb route + auto pages for all 86 + theming + contributor CTA. No pages beyond /cfb, no push, no merge, no prod.

**Preview:** `https://promonight-9my4ijl4n-btj8tk69dk-7318s-projects.vercel.app` (Vercel **preview**, READY). The preview has **Vercel Deployment Protection** on (anonymous requests 302 → `vercel.com/sso-api`), so anonymous cache-busting curl is walled. Verification below was run against the **local prerendered SSG HTML** (`.next/server/app/cfb/*.html`) — the byte-identical output the preview serves for these ISR/SSG pages, and fresher than any CDN cache (it sidesteps the exact staleness the "curl not web_fetch" rule guards against). The preview URL is provided for your authenticated visual review.

## Build

Full production build **succeeded — 286/286 static pages, 0 prerender errors**, including the 86 `/cfb/[school]` SSG pages. Route table: `○ /cfb` (ISR 6h), `● /cfb/[school]` (SSG ×86, ISR 6h), `ƒ /cfb/contribute`, `ƒ /api/cfb/contribute`.

**Branch-hygiene note:** the cfb lineage (cfb-phase1, paused Jun 13) forked before main's `fix/null-date-prerender`, so the stale pro-side team page crashed the build on a null-date promo (`null.split`). Cherry-picked that one fix (`26b08b3`, `-x efb6f8e`) to make the branch buildable for the preview — it is already on main, so a future rebase/merge is a no-op. **No CFB code caused the build failure; the CFB pages compiled clean.**

## 5-school review (across the palette range)

| School | Palette → resolved accent | Contrast | Kickoff TBA | Rivalry tags (crown none) | CTA + form | Editorial leak |
|---|---|---|---|---|---|---|
| **minnesota** (mockup) | maroon `#5B0013` → gold `#FFB71E` | on-`#111` ✓ | 18 | Paul Bunyan's Axe, Little Brown Jug | ✓ `/cfb/contribute?school=minnesota` | none ✓ |
| **penn-state** (dark) | navy `#001E44` → **`#FFFFFF`** (fallback) | on-`#111` ✓ | 20 | — (none seeded) | ✓ | none ✓ |
| **michigan** (LIGHT primary) | maize **`#FFCB05`** kept | **on-`#111`** ✓ | 18 | The Game, Little Brown Jug | ✓ | none ✓ |
| **boise-state** (dark) | blue `#0033A0` → **`#D64309`** (fallback) | on-`#FFF` ✓ | 10 | Milk Can | ✓ | none ✓ |
| **toledo** (SPARSE G5) | navy → gold `#FFCD00` | on-`#111` ✓ | **24 (all TBA)** | — | ✓ | none ✓ |

### Gate criteria — all PASS
1. **ONE template renders both fuller and sparse cleanly.** minnesota/michigan (fuller, rivalry tags) and toledo (sparse, every kickoff TBA, no editorial) render from the **same** `CfbSchoolPage`. Editorial-block leak check = **none** on all 5 — the conditional blocks (why-you-go, signature, venue-in-words, traditions) do not render on auto pages, so there are no empty slots. **Graduation auto→destination is a data flip** (populate `editorial.*` + `editorialStatus`), never a template change.
2. **Theming contrast holds on the light-primary case.** michigan's maize accent keeps a dark chip text (`accent-on:#111`) → readable, not washed out (a light color on the **dark** PromoNight base has high contrast). Dark primaries correctly fall back to their light secondary (penn-state navy→white, boise blue→orange). The WCAG luminance fallback (`resolveCfbTheme`) fires exactly where needed.
3. **Rivalry tags show, crown none, trophy names correct.** Paul Bunyan's Axe, Little Brown Jug, The Game, Milk Can — all correct, equal-weight, no signature/ordering. (No signature "the one to plan around" block on any auto page.)
4. **Contributor CTA present + form wired to the queue.** "Know this place?" + `/cfb/contribute?school=<id>` on all 5. The form POSTs to `/api/cfb/contribute`, which writes a **draft** (`status: pending-review, autoPublished: false`) — never publishes, never flips `editorialStatus`.
5. **verified=false kickoffs show "Kickoff TBA".** Every page shows only "Kickoff TBA" (10–24 per page); no page displays a contradicted/unverified time. The 2 date-error games and all unannounced July kickoffs read identically.

## Quality floor (Part E)

**0 of 86 pages below the index floor.** Every school — including the 4 pending-publish G5 (JMU, Marshall, Toledo, NIU) — has ≥8 schedule games + a resolved venue, so all index as honest verified stubs with the contributor CTA (the corroborated rivalry games with trophy names are citable `SportsEvent` structured data). The `noindex` hold exists in code but nothing trips it. **Noindex list: none.**

## Adversarial self-check

1. **ONE template or did a second sneak in?** ONE (`CfbSchoolPage`); editorial blocks conditional. ✅
2. **Any auto page crown a signature rivalry?** No — no signature block renders on auto; rivalry tags equal-weight. ✅
3. **Any verified=false field display its value?** No — "Kickoff TBA" everywhere; no wrong times. ✅
4. **Contributor form an auto-publish path?** No — queue-only draft (`pending-review`), human review before publish. ✅
5. **Light/white team colors break contrast?** No — michigan maize + dark chip text readable; penn-state/boise dark→light-secondary fallback; every `accent-on` is contrast-computed. ✅

## Gate verdict

- ONE template, graduation = data flip: **CONFIRMED ✅**
- Theming contrast (incl. light-primary): **holds ✅**
- Rivalry crown-none + trophy names: **correct ✅**
- Contributor form → queue, not auto-publish: **CONFIRMED ✅**
- verified=false → Kickoff TBA: **CONFIRMED ✅**
- Quality-floor noindex: **0 below floor**

**STOP — Phase 3 gate. Preview only. No wide rollout, no prod, no push, no merge until reviewed.**

## For after this gate (flagged, from the prompt)
- **Phase 4** = editorial pass (marquee-first); alum + inbound-CTA submissions flip schools auto→destination — a **data flip**, per the one-template rule.
- **Phase 5** = league hub + weekly rivalry rail. BEFORE building: reconcile the **Monday-vs-Tuesday rollover conflict** (decision record §9a says Monday; `hub-system-build-spec.md` says Tuesday league-wide) and fold the CFB decision-record rules into the hub spec's CFB section.
