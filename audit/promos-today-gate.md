# /promos/today — Phase 3 verification gate

Branch: `feature/promos-today` (off `main` @ `939c9c5`). Status: **built + verified, holding for merge decision. NOT pushed, NOT merged.**

Verified 2026-07-18 against a local `next dev` build with live Firestore data (today = Saturday, July 18; MLB + WNBA in season, MLS none today). Headless checks driven by `puppeteer-core` against the installed Chrome (installed `--no-save`; `package.json`/lockfile untouched).

## Build / type

| Check | Result |
|---|---|
| `tsc --noEmit` | **PASS** (exit 0) |
| `next build` | **PASS** (exit 0, 512/512 static pages) |
| `/promos/today` render mode | Static + ISR `revalidate=3600` (1h) |

## Page rendering (cache-busting curl)

| Check | Result |
|---|---|
| H1 exact match | `Sports Promos Today` ✅ |
| Date in brand red, Chicago-anchored | `Saturday, July 18` ✅ |
| Hero answer generated from real promo set | "24 games today have promotions across MLB and WNBA: Kids Free Weekend at Arizona Diamondbacks, ... and 21 more." ✅ |
| League grouping + counts | `MLB · 20 promos`, `WNBA · 4 promos` (20+4 = 24, matches hero + JSON-LD) ✅ |
| Multiple promos per team preserved | 2 distinct Diamondbacks promos both shown (dedupe collapses only exact team+date+title) ✅ |
| Deep-link anchors on cards | `/mlb/arizona-diamondbacks#promo-2026-07-18-geraldo-perdomo-audio-bobble` ✅ |
| Section hub links | `MLB hub → /mlb`, `WNBA hub → /wnba` ✅ |
| Game times | 12-hour (`1:10 PM`, `3:10 PM`) ✅ |
| this-week crosslink footer | present ✅ |

## Schema (JSON-LD)

`CollectionPage` + `ItemList` (`numberOfItems: 24`) + `dateModified: "2026-07-18"` (Chicago today, advances on daily regeneration). ✅

## CTA row — inline, no-wrap (headless at 390px AND 360px)

Both widths, all sampled rows:

Row order: **TicketNetwork, Ticketmaster, SpotHero** (TN-first on every surface, matching the stacked layout and the live "TN on top" revenue test).

| Check | 360px | 390px |
|---|---|---|
| Exactly 3 buttons | PASS | PASS |
| Single line, no wrap | PASS | PASS |
| TicketNetwork leftmost | PASS | PASS |
| SpotHero rightmost | PASS | PASS |
| Tap height ≥ 40px | PASS (48px) | PASS (48px) |
| No horizontal page scroll | PASS | PASS |

Verified order at 360px: `['TicketNetwork', 'Ticketmaster', 'SpotHero']`. Screenshots (`scratchpad/card-360.png`, `card-390.png`) confirm legible brand-mark compression: TicketNetwork logo / `ticketmaster` wordmark / "P SpotHero" with descriptors hidden at 360; at wider widths the "Get Tickets" / "Reserve Parking" descriptors reveal via container query. Structural no-wrap guarantee: `flex-nowrap` + `flex-1 basis-0 min-w-0` + `overflow-hidden` (fixed a grid `min-width:auto` overflow that initially pushed the page to 408px).

## Card interaction (headless, real mouse input)

| Check | Result |
|---|---|
| Card body click → team page promo anchor | Landed on `/mlb/arizona-diamondbacks#promo-2026-07-18-geraldo-perdomo-audio-bobble` ✅ |
| CTA click → affiliate out, NOT card nav | Leftmost (TicketNetwork) opened `ticketnetwork.com/...` popup; page stayed on `/promos/today` ✅ |

Implemented with a stretched-link `::after` (card body) + `relative z-10` CTA row (independent affiliate links), so no nested anchors and no JS propagation handling.

## Tracking — web_today dual-emit (headless, stubbed posthog + gtag)

Firing all three CTAs: **3 PostHog `affiliate_click` + 3 GA4 `affiliate_click`**, `surface = web_today` on both, partners `ticketmaster` / `ticketnetwork` / `spothero`. ✅ `web_today` added to both the `AnalyticsSurface` union and `KNOWN_SURFACES`.

## Deep-link arrival highlight (headless)

Loading a team page at `#promo-…`: target id found in SSR DOM, `promo-arrival-flash` class applied, element scrolled into view. ✅ (Today/tomorrow promos are the earliest upcoming, so always in the server-rendered first-10 rows — the `LazyPromoRows` collapse never hides them.)

## Per-league hub today-module (real data, both states)

| Hub | State | Result |
|---|---|---|
| `/mlb` | A (has promos) | "Today across MLB" + cards + "See all today → /promos/today" ✅ |
| `/wnba` | A (has promos) | "Today across WNBA" ✅ |
| `/mls` | B (none today) | "No MLS promos today" → /promos/today (persistent, not empty) ✅ |
| `/cfb` | positive slot | "College football's promotions are its rivalry and theme Saturdays… Today's pro promos →" — no apologetic empty state ✅ |

Shared query: both the page and the modules go through `getTodayPromos()` / `getLeagueTodayPromos(league)` (one cached `getPromosForDate(chicagoToday)` per request). No duplicated per-league logic.

## Empty states (mocked via temp edit, reverted; markers confirmed gone)

| Scenario | Result |
|---|---|
| today = 0, tomorrow > 0 | Honest hero "No sports promotional giveaways today. Here is what is on tomorrow." + tomorrow section at **full prominence** (0 dimmed cards) as primary content — never thin ✅ |
| today = 0, tomorrow = 0 | Hero "No sports promotional giveaways today or tomorrow. The next one is Monday, July 20." + pointer line "No promos scheduled tomorrow. Next up: Monday, July 20. See the full week →" + this-week crosslink; 0 cards but never blank ✅ |
| today > 0 (normal) | Tomorrow section **dimmed** (27 cards `opacity-70`), today cards full prominence ✅ |

## Freshness

- ISR `revalidate=3600`.
- Daily cron `/api/cron/indexnow-daily` @ `10 6 * * *` (just past America/Chicago midnight year-round): `revalidatePath('/promos/today')` → warm fetch → `submitToIndexNow(['https://www.getpromonight.com/promos/today'])`. Auth guard verified (503 when `CRON_SECRET` unset locally; mirrors `mlb-schedule`, returns 401 on bad bearer in prod).
- `dateModified` = Chicago today, so it advances each regeneration.

## Linking / metadata

- Nav "Today" → `/promos/today` in live `BrandBar` + `BrandBarMobileMenu` + legacy `nav.tsx`; footer in redesign `Footer` + legacy `footer.tsx` (a live team page renders 3 `/promos/today` links). 
- Sitemap: `/promos/today` at `changeFrequency: daily`, `priority: 0.9`.
- Title: `Sports Promos Today | PromoNight` = 32 chars (≤ 60 rendered); field `Sports Promos Today` = 19 (≤ 47).
- Em dashes: none in user-facing copy (matches only in code comments, which the house rule permits).

## Adversarial self-check

1. **League hardcoded anywhere?** No. Grouping iterates `LEAGUE_HUB_REGISTRY` then appends any other league present in the data; per-league filter is `p.team.league === X`. NFL/NBA/NHL auto-populate the board with zero code change when their promos are dated today. (CFB is a documented model-level exception — separate `cfbGames`, no promo concept — handled by its positive hub slot, per the agreed scope.)
2. **Empty state useful, not thin?** Yes — tomorrow becomes primary content, or a pointer line to the soonest date + this-week.
3. **Date genuinely today?** Chicago-anchored + regenerated at the day boundary by the daily cron (`revalidatePath` + warm) → never a stale date, even for the first crawler.
4. **CTA row wrap/stack at any width ≥ 360?** No — structurally impossible (`flex-nowrap` + `min-w-0`); verified at 360 and 390.
5. **CTA fires affiliate without card nav / card body navigates without firing affiliate?** Both verified (stretched `::after` + z-layered CTA row).
6. **Hub modules correct per-league + persistent both states?** Yes (MLB/WNBA State A, MLS State B, CFB positive).
7. **Em dashes / title over budget?** None in copy; title 32/19 well under budget.
8. **IndexNow fires on daily regeneration?** Yes — daily cron pings both endpoints (no-op only if `INDEXNOW_KEY` unset).
9. **CTAs tagged web_today + dual-emit PostHog + GA4?** Verified (3 + 3, surface web_today, all partners).

## Partner ordering (resolved)

TicketNetwork leads on **every** surface — stacked (top) and the today inline row (leftmost). This matches the deliberate live "TN on top" revenue test: TN's resale commissions out-earn TM's single-game ticket payouts per conversion, and TM has been converting around 1%. Keeping the order identical across surfaces avoids muddying the read on whether TN-on-top out-earns TM (a today-TM-first / everywhere-else-TN-first split would confound it). Order verified on the today board at 360px: `['TicketNetwork', 'Ticketmaster', 'SpotHero']`.

## Notes

- `data-cta-row` attribute left on the card CTA row (inert; used as a stable test hook). Removable on request.
- `puppeteer-core` was installed `--no-save` for headless verification; it is not in `package.json`/lockfile and is gitignored under `node_modules`.
