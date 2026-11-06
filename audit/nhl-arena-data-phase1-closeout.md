# NHL arena data, Phase 1 close-out report

2026-09-03. Zero subagents. Plain fetches 6 of 6 (Nashville, Montreal, Lightning control, Little Caesars hub, /venues index, sitemap) plus IndexNow. Every write snapshotted first and read back.

## 1. promo-pipeline

a. `lib/venuehubs-clearbag-guard.js`: little-caesars-arena added to ADJUDICATED, verdict false, on 2026-09-03, why "same-size alternative: non-clear single compartment bags, wallets, clutches, fanny packs AND clear bags all permitted at 4x6x1.5, so clear buys no extra size and is not a mandate (1.3)". New `test/venuehubs-clearbag-guard.test.js` runs the report on the doc as written: the heuristic still sees the pattern (raw 1, SUSPECT), the adjudication suppresses it (open 0, suppressed 1, no `[SUSPECT] little-caesars-arena` line, summary says "1 suppressed as adjudicated"), and a value moving to true reports DRIFT. Commit cb5dba3. Suite 794 pass, 0 fail.

b. `feature/venuehubs-confirmations` merged to main with --no-ff (afa04f7) and pushed; origin/main afa04f7. The confirmations map, its guard and the adjudication are on main.

## 2. promonight-web, branch feature/nhl-close-out, two commits

a. ff7cd83: the club page renders the old `venues` prose block only while the building's venueHub is NOT indexable. Decision is `rendersVenuesBlock(venue, hubIndexable)` in `lib/venue-index.ts` (pure, three tests); the rail calls it with the same `indexable` flag that gates the hub link. No data deleted; a building that drops below the floor gets the block back.

b. aad942c: `CLAUSE_REDACTIONS` entry for `venues/centre-bell.parkingInfo`, clause ", and downtown garages run roughly 20 to 45 dollars on event nights", reason citing the operator's 20 to 49 and the club's 20 to 45 with neither dated. Fail-safe kept: if the stored text drifts the whole field is withheld. Test added with the verbatim stored string; the pinned redaction list extended.

Merges to main, both --no-ff, from the worktree that holds main: 0b98b19 (fix/populate-script-northstar, 31c2f4a) and 03e3ca6 (feature/nhl-close-out). Pushed; origin/main 03e3ca6. Web suite 699 pass, 0 fail; tsc clean. Production deployment dpl_Egjhadwb5Cc883xX7mpdRrEV3Hx8 READY, aliased to www.getpromonight.com.

Render, production, after the deploy:

| Page | Hub link | Venues prose block | Verdict |
|---|---|---|---|
| /nhl/nashville-predators | present, to /venues/bridgestone-arena | gone (Metropolis, Fifth + Broadway, Lower Broadway sentences absent; no Game day card) | pass |
| /nhl/montreal-canadiens | present, to /venues/centre-bell | gone (garage, "20 to 45 dollars", Crescent Street absent; no Game day card) | pass |
| /nhl/tampa-bay-lightning (control) | absent (amalie-arena held) | still renders (Game day card; parking and nearby prose present; transit absent by the corpus-wide silencing) | pass |

Substitution on the control: no MLB club qualifies any more, all 30 MLB buildings are above the floor (checked in Firestore), so the Lightning, whose building is held and whose venues doc has prose, stood in.

## 3. Red Wings gate overlay

Snapshot `snapshot-lca-overlays.2026-09-03T12-51-09-791Z.json` (Red Wings verified false with the gate rule; Pistons verified false, no gate). Extended writer from main, `--overlays-only --execute`: its own snapshot, guard passed on 1 payload, 1 overlay update, read-back 1 of 1, building untouched. After: Red Wings verified true, gatesOpen, sources and confirmations byte-identical to before; Pistons untouched.

Hub render: NOT confirmed by fetch. `/venues/little-caesars-arena` came back `x-vercel-cache: HIT` with no gate row. The page was prerendered by the build that started at 12:46Z; the overlay flipped at 12:51Z, so the served page predates it, and the Gate 3 revalidation of that path also predates it. The path (with the two Detroit club pages) was revalidated at the end of this run (200). Code-level check against the live overlay: `rendersGates('little-caesars-arena', overlays)` returns true, with verified true, ruleText "Doors for Red Wings and Pistons games typically open 90 minutes prior to game time. Please note: Door times are subject to change." and the source the operator A-Z. The visual confirmation needs one fetch beyond this brief's six.

Pistons: the operator sentence covers "Red Wings and Pistons games", so the same rule, same source, supports a Pistons overlay gate. Not written; the Pistons club page was never harvested, so it has no second-domain confirmation record.

## 5. Inbound linking parity (before IndexNow)

Surfaces the 2026-08-06 build wired, and what each reads:

| Surface | Predicate | MLB hub present | NHL hubs present | How checked |
|---|---|---|---|---|
| League hub arena-guide rails (mlb, nfl, mls, wnba, nhl, cfb pages, `HubVenueLinks`) | `getVenueLinksForTeams` -> `collectVenueLinksForTeams` -> `link.indexable` = `venueHubIsIndexable`, deduped by building | yes (Target Field on /mlb, unchanged) | yes: /nhl lists Bridgestone, Centre Bell, Little Caesars with Climate Pledge and Crypto.com (Gate 3 fetch) | fetch (/nhl) and code |
| /venues index | `getVenueIndexEntries` -> `venueHubIsIndexable`, grouped by tenant league | yes (target-field) | yes, all three, in the NHL section; 162 guides | fetch |
| sitemap.xml | `getIndexableVenueHubSitemapEntries` -> `venueHubIsIndexable`, fail-loud | yes | yes after the deploy: the deploy hook walked the new sitemap and submitted 476 (473 before, plus the three); the pre-deploy fetch was a cached 159-venue copy without them | deploy-hook run 33758014054 |
| Team-page routing block (`AffiliateRail` -> `VenueHubLink`) | `getVenueHubForTeam(...).indexable` = `venueHubIsIndexable` | yes | yes on Nashville and Montreal (fetched); Detroit by the same code path | fetch and code |
| Footer and gameday utility grid links to /venues | static links, no predicate | n/a | n/a | code |

Parity gap, reported not fixed: `/venues/bag-policies` (`getMlbBagPolicyRows` in `lib/venue-bag-policies-data.ts`) selects buildings by an MLB tenant plus `verified === true`, not by `venueHubIsIndexable`, and its page is titled and scoped MLB. It is an MLB-shaped surface by design; no NHL hub appears on it, including the two WNBA hubs' NHL co-tenants. Every other surface that links crypto-com-arena links little-caesars-arena.

## 4. IndexNow

Dual-endpoint submission through the pipeline notifier for /nhl, the three hub pages and the Detroit, Nashville and Montreal club pages: 7 URLs, 200. Separately, the deploy hook submitted the full 476-URL sitemap after the deployment.

## Open after close-out

- The Little Caesars gate row visual confirmation (one fetch, after the revalidation issued here).
- The Pistons overlay gate, supported by the same operator sentence, unwritten.
- `/venues/bag-policies` remains MLB-scoped.
- Local: untracked audit docs in promonight-web (`audit/nhl-arena-data-phase*.md`); the `feature/nhl-close-out` and `fix/populate-script-northstar` branches are merged and can be deleted.
