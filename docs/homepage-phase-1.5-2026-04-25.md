# Homepage Phase 1.5 — Audit fixes

Branch: `homepage-phase-1.5`
Author: Matt + Claude
Date: 2026-04-26

Four issues from the live audit, addressed in one pass since they share files.

## Phase 1 — Cross-league hot promo surfacing

### What was wrong
The homepage hero was 100% MLB despite NBA + NHL playoffs running. Diagnosis: not a filter bug or a `hot` flag bug. The homepage data layer (`getPromosInDateRange`, `getPromosFromDate`) reads the per-team `promos` subcollection via `db.collectionGroup('promos')`. **Playoff promos for active NBA + NHL teams live in a separate top-level Firestore collection: `playoffPromos`.** That collection was wired into `/playoffs` and per-team playoff sections, but never into the homepage hero.

### What changed
- Added `getPlayoffPromosInDateRange(start, end)` to `src/lib/data.ts`. Reads `playoffPromos` filtered by `isPlayoff = true`, joins to active playoff teams via `appConfig/playoffs.activeTeamIds`, and shims dated playoff promos into the `PromoWithTeam` shape used by the rest of the page.
- Recurring playoff promos (`date === null`) are intentionally excluded — the hero is time-bucketed and only renders dated cards.
- `PlayoffPromoType` allows `'event'` (watch parties etc.) which isn't in the regular `PromoType` union; we map `'event' -> 'theme'` for visual badge purposes.
- `src/app/page.tsx` now fetches both regular and playoff windows in parallel and concatenates them into `tonightWindow` before passing to the hero pickers.

### Files
- `src/lib/data.ts` — new `getPlayoffPromosInDateRange()`, plus helper `isoToChicagoYMD()` + `extractOpponentFromGameInfo()`
- `src/app/page.tsx` — parallel fetch + merge

### Upstream gaps surfaced
None on the data side — playoff promos do exist with the `highlight` flag set on the marquee ones (rally towels, T-shirt giveaways). The previous MLB-only hero was purely a wiring gap, not a scanner gap.

## Phase 2 — Time bucket segmentation

### What changed
The hero used a single eyebrow (`TONIGHT` / `TONIGHT_AND_TOMORROW` / `COMING_UP`) and rendered all selected promos in one strip. Refactored into three concurrent buckets with separate headings:

- **Tonight** — promos for today (America/Chicago)
- **This Weekend** — Fri-Sun depending on what day it is, excluding today
- **Coming Up** — next 7 days minus the above

Empty buckets are hidden. Total cap is 8 cards across all buckets. If Tonight has 5+ promos, only Tonight renders and a "More upcoming this week" link points to `/promos/this-week`.

Within each bucket, ordering is round-robin across leagues (`LEAGUE_ORDER`) with `highlight` (hot) promos pulled forward inside each league. This delivers cross-league variety even when MLB's calendar is dense.

### Files
- `src/components/tonight-strip.tsx` — replaced `pickTonight` with `pickHeroBuckets`; replaced single-strip `<TonightStrip>` with a three-section component using a shared `<BucketSection>` primitive
- `src/lib/analytics.ts` — extended `EyebrowState` union with `'WEEKEND'` (kept `'TONIGHT_AND_TOMORROW'` for backwards-compat with existing dashboards)
- `src/app/page.tsx` — calls `pickHeroBuckets(tonightWindow, today)` and passes the buckets struct to `<TonightStrip>`

### Analytics impact
`tonight_card_tap` events still fire as before; the `eyebrow_state` field now carries one of `'TONIGHT'`, `'WEEKEND'`, `'COMING_UP'` (matching which bucket the tapped card came from). The legacy `'TONIGHT_AND_TOMORROW'` value is retained in the type union for historical dashboards but is no longer emitted.

## Phase 3 — Sport filter pills

### Status: already wired
`src/components/team-grid.tsx:36` was already implementing real client-side filtering via `useState<string>('All')` and `teams.filter((t) => t.league === activeLeague)`. The audit's "unclear if wired" finding was incorrect — the pills work. No code change needed; verified post-deploy on the preview URL.

## Phase 4 — Geo-aware team ordering

### Decision: Option A (client-side reorder)

The homepage has `export const revalidate = 3600` — it's prerendered with ISR. Reading `headers()` in a Server Component opts the entire route into per-request dynamic rendering, which kills ISR for every visit and adds a Firestore round trip to TTFB. That's a meaningful perf regression for a UX nicety.

**Picked Option A**: server keeps ISR with the existing alphabetic-by-rank order; a small `/api/geo-region` route returns the visitor's country/region from Vercel's edge headers; `<TeamGrid>` (already a client component) calls it once on mount, caches the region in `localStorage` for 24h, and reorders the team array before the existing filter logic runs.

Tradeoff: brief flash on the very first visit (typically <100ms; reorder happens before any meaningful interaction). Zero flash on subsequent visits via the localStorage cache.

### Files
- `src/lib/geo/state-to-teams.ts` — new mapping (28 states + DC, slugs verified against the production sitemap)
- `src/app/api/geo-region/route.ts` — new dynamic route, reads `x-vercel-ip-country` + `x-vercel-ip-country-region`
- `src/components/team-grid.tsx` — added `useEffect` fetch, localStorage cache, `reorderByRegion()`

### Privacy
The API route reads only the derived geo headers (country code + state code). The IP itself is not read, logged, or persisted anywhere. The state code is cached in the visitor's own `localStorage`, never sent back to a server.

## Curl verification (preview deploy)

The preview deploy confirms the geo-aware API endpoint responds correctly to forged geo headers. With Option A the homepage HTML itself is geo-blind (alphabetical-by-rank); the reorder happens client-side after the API call.

```
# placeholder — filled in below after the preview deploy goes Ready
```

## Open questions / follow-ups

- The `'event'` -> `'theme'` shim on playoff promos is a small lossy conversion. If we ever add a fifth promo color/icon for "event" specifically, update both the regular promo card and the new playoff shim.
- `localStorage` writes don't help on first visit; if first-load flash becomes a complaint, the next iteration is a cookie set by middleware on first request, which would let the server prerender per-region (with `unstable_cache` keyed by region code).
- Cross-listed teams: NY-brand NFL (Giants, Jets) and MLS (Red Bulls) play in NJ but are listed in BOTH NY and NJ. That's a deliberate UX call; revisit if it produces unexpected behavior.
- The state-to-teams mapping covers 28 states + DC. Single-team states without entries (e.g., AK, AL, AR, etc.) fall through to the alphabetical-by-rank order, which is fine since there's nothing to reorder anyway.
