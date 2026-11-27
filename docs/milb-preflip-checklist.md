# MiLB pre-flip checklist

Everything that must be true before `appConfig/milb.milbLive` is set to `true`.
While it is false the web serves no MILB page (src/lib/milb-gate.ts) and the
pipeline sends no revalidate, IndexNow, promo-page ping or X post for MILB.
Flipping it is a ruling, never a code path. Started 2026-11-27 (MiLB Phase 1).

Each item is closed with the commit or the evidence that closes it.

## Web: hard-coded sport lists that leave out `milb`

- [ ] `src/lib/analytics.ts:1816`: the promo-page path regex
  `^/(?:mlb|nba|nhl|nfl|mls|wnba)/.../promos/...` must include `milb`, or a
  MILB promo page view is not classed `web_promo_page`.
- [ ] `src/lib/analytics.ts:1819`: the team-page sport list
  `['mlb', 'nba', 'nhl', 'nfl', 'mls', 'wnba']` must include `milb`, or a MILB
  team page view falls through to `web_other`.
- [ ] `src/lib/follow-surface.ts:133`: the same sport list (follow capture
  surface for `/[sport]/[team]`) must include `milb`.
- [ ] `src/middleware.ts:57`: the Fanatics leak guard `FANATICS_LEAK_PATH`
  (`^/(?:mlb|nba|nhl|nfl|mls|wnba)/[a-z0-9-]+/o-`) must include `milb` so a
  leaked `/milb/{team}/o-...` path gets the same 410.

Each is reviewer finding 10 (adversarial review, 2026-11-27). Verify on served
pages and in PostHog after the flip, not by a source grep (CLAUDE.md).

## Club colors

- [ ] Every MILB team doc carries `colorsPlaceholder: true` and one neutral
  pair (`0xff1f2937` / `0xffffffff`), because the Stats API has no club
  colors. Replace with each club's real primary and secondary colors and
  remove the flag. Zero MILB docs may carry `colorsPlaceholder` at the flip.

## Tests that need to be stronger (reviewer finding 11)

- [ ] The zero-upcoming MILB noindex rule is tested by a source regex on
  `src/app/[sport]/[team]/page.tsx`. Replace with a test that calls
  `generateMetadata` for a MILB team with no upcoming promotion and asserts
  `robots: { index: false, follow: true }`, and for one with an upcoming
  promotion and asserts no `robots` key.
- [ ] The closed-gate sitemap test (`src/lib/__tests__/milb-gate-closed.test.ts`)
  stubs `getPromoPageSitemapEntries` and `getPastPromoSitemap`. Both filter
  through the gated team map (read in review), but no test proves it. Add a
  test with the real `src/lib/promo-pages.ts` readers and a MILB promo doc
  carrying a `pageSlug`, asserting no MILB promo or archive URL while the gate
  is shut.

## Found at MiLB Phase 1 G2 (2026-11-27)

- [ ] The apps: MILB clubs must not reach the iOS and Android apps before this
  flip (G2 app finding; G3 seed is blocked on the chosen fix).
- [ ] The apps at the flip: `isInSeason` in `lib/services/staleness_service.dart`
  has no MILB case (`_ => false`), so a MILB team's empty screen always reads
  off-season; the apps show the raw code `MILB` wherever they print a league.
- [ ] Staleness: once a MILB scan workflow with a cron exists, zero-promo
  clubs grade CRITICAL MISSING from the 2027-02-09 lead-in, because the
  NEW_SEASON suppression covers only a cron's window-opening month. Suppress
  MILB zero-promo clubs from the lead-in until the season start, in the same
  change that adds the workflow.
- [ ] Coverage copy: `coverageFromTeams` derives the league list from the
  team docs, so "across MLB, NBA, ..." gains "MiLB" at the flip. Read the
  homepage, /about, /teams and the aggregator leads on the served pages.
