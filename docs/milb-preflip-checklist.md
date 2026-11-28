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

## From the ux-review of the MiLB page (2026-11-27, known issues 138)

- [ ] Get Tickets: real Ticketmaster links for MILB, or no Ticketmaster CTA (TicketNetwork is the default partner, G4).
- [ ] FAQ venue sentences must not state venue facts for a club with no venue doc.
- [ ] SpotHero and Expedia CTAs need a place, or are left off MILB pages.
- [ ] `/teams?league=MILB` needs a MiLB filter.
- [ ] JSON-LD Events need a `location`, or the Event is left out.
- [ ] Read a real MILB team page after the first execute: game times on cards and sheets (the preview fixture carried none).

## From MiLB G2b (milbTeams / milbPromos, 2026-11-27)

- [ ] G4: `scripts/tn-event-links.js` (pipeline) picks TicketNetwork candidate games from `collectionGroup('promos')`; MILB promos are in `milbPromos` and need their own read there.
- [ ] The apps: nothing under `milbTeams/**` is client-readable (firestore.rules has no match for it; the catch-all denies). Showing MiLB in the apps needs an app release AND a rules change, both deliberate.
- [ ] `appConfig/milb` is readable by any signed-in client (`match /appConfig/{docId}`): the flag's value is not a secret, but nothing else may be stored on that doc.
- [ ] Scored and league-hub readers (`fetchScoredPromos`, `getTopPromosPerTeam`, `getLeagueUpcomingPromoCounts`, `getLeagueHubSeason`) read the `promos` group only: MiLB has no rankings and no hub until those are built on purpose.
- [ ] Sugar Land's promotions page title is stamped "2026 Promotions"; the MILB season window drops prior-season rows (no action, ruling 2026-11-27).
- [ ] **BLOCKER: a collection-group index on `milbPromos.date`.** `firestore.indexes.json` (app repo) carries a COLLECTION_GROUP override for `promos.date` only. Without the same for `milbPromos`, every filtered `collectionGroup('milbPromos')` read fails once the gate is open. The readers fail soft (MILB rows are dropped and logged; pro leagues unaffected), so the symptom is a live gate with no MiLB on boards, feeds, promo pages or X. Add the override, deploy indexes, and confirm one filtered read before the flip (adversarial review 2026-11-27, finding 1).
- [ ] Venue hubs: `src/lib/venue-hub.ts:928` and `:981` run `getTeamBySlug` and `getTeamPromos` in one `Promise.all`, so `getTeamPromos`' synchronous league peek can run before the loader has resolved. Harmless while no venue hub lists a MILB tenant (venues are out of scope); await the team first before one does (review finding 5).
- [ ] My Teams: `fetchVenueForTeam` in `src/app/api/my-teams/promos/route.ts` reads `teams/{slug}`, so a MILB club gets no venue there (review finding 6; venues out of scope).
- [ ] A stray doc at `teams/{milbSlug}/promos` would still be read by `getTeamPromos(slug)` called directly and counted by `getPromoCount`; nothing writes there (the pipeline refuses it by name, and production held none on 2026-11-27). Re-check with one read before the flip.


## Pre-cron blocker (ruled 2026-11-27, after G3b)

- [ ] No MILB workflow may be enabled until an execute run writes exactly what
  its gating dry run showed. At G3b the gating dry run planned 354 promos with
  14 rows without a kind; the execute, which extracts again, wrote 372 with 28
  (pipeline main 4afe97b7, run 0b6d25fd). A gate read on a dry run does not
  hold for the write that follows it while that is true.
