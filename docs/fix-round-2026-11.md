# Fix round 2026-11

A 13-item audit of getpromonight.com, confirmed against the live site on 2026-11-25 and shipped the same day in one production deploy. This is the record: what shipped per item, the rulings that decided it, the commits, and how to undo it.

## How it ran

Every feature branch merged `--no-ff` into `release/fix-round-2026-11` (the same name in both repos), never into main. Each branch stopped at a gate with a diff, a full suite run, an adversarial review and a ux-review. One production deploy at the end, in a fixed order because the pipeline merge is itself a Firestore write (it arms a scoring step in the weekly scans):

1. Web release merged to main and deployed.
2. Verified on production.
3. Scoring-state snapshot for five leagues.
4. Dry runs, compared against the gate counts.
5. Score write.
6. Pipeline release merged to main.
7. Revalidate, IndexNow, six URL checks, live battery.

Branches, in order: `feature/best-promos-stopgap`, `feature/nba-nhl-scoring` (both repos), `feature/discovery-links`, `feature/season-state`, `feature/counts-and-cta`, `feature/final-gate-fixes`, then `feature/live-guard-primary-button` after the deploy.

## What shipped, per item

| # | Finding | What shipped |
|---|---|---|
| 1 | Best Promos excluded NBA and NHL; the homepage block showed three MLS playoff fixtures typed as theme nights under a subhead about giveaways. | The ranked surfaces list giveaways only, at a score of 65 or more, and the homepage rail renders only with at least 10 such rows. NBA and NHL promos are scored (1,348 and 944 rows); their ticket-package rows are never scored. `/best-promos` and `/best-promos/bobbleheads` gained an upcoming mode over five leagues, titled "2026-27" when the rows cross New Year. |
| 2 | The Giants page said 2026 in its title and headings and 2027 in its body. | A team page whose every upcoming row belongs to the next season names that season in the title, hero, meta, JSON-LD and FAQs, and says "announced so far". The completed list keeps its own "COMPLETED 2026 PROMOS" heading and count. League hubs follow at league level with "N of M clubs have published". No calendar on such a page until game dates exist. |
| 3 | MLS playoff matches are stored as theme-night promos; one bobblehead appeared twice. | NOT in this round. The entity model (a `kind` field separating games from items) is its own project. Rulings recorded for it: no `isPostseason` write for MLS rows; ticket-package rows are never scored. |
| 4 | The /nba hub linked promos to team-page fragments. | Hub rails link to promo pages, one card per team, with "Showing N of M teams". |
| 5 | Events was linked only from the footer. | Events is in the top bar from 860px and in the mobile menu. |
| 6 | Past promo pages (not reproduced). | Swept clean. The same played state was added to CFB rivalry pages: "This game has been played", no ticket, hotel or parking links, EventScheduled with no offers; the rivalry index tags played games. |
| 7 | Both ticket buttons said "Get Tickets"; event stops said "Tickets"; nothing said resale. | Every ticket button reads "Get Tickets". Under each TicketNetwork button or button group, one line: "TicketNetwork is a resale marketplace. Prices may differ from face value." The page disclosure says the same in its own words where the page carries a TicketNetwork link. |
| 8 | "Monster Jam 2027" over December 2026 shows. | One year helper: "2026-27" only when the upcoming run of a stop, or of the hub across stops, crosses New Year. |
| 9 | Rivalry titles named no schools. | Titles and H1s lead with the two schools ("Minnesota vs Wisconsin: Paul Bunyan's Axe 2026"), inside 60 characters. |
| 10 | Tonight said 8 promos while Today said 15; /nba said 13 teams over a rail of 4. | The Tonight lede states its pool when capped ("8 of 15"), and the Today tile prints the same pool. Hub rails state "Showing N of M teams". |
| 11 | 213 venue guides on the homepage, 210 and 209 in the tiles, 203 on /venues. | Every venue total reads the index floor (`venueHubIsIndexable`): 203. /venues names no season and no longer says "verified". |
| 12 | /about described a league state six weeks out of date. | The league-state sentence is derived per render from the season windows and upcoming rows. Scanner counts corrected to 29 of 32 NHL clubs and 28 of 30 NBA teams and held to the pipeline config by test. |
| 13 | /best-promos defined a perfect 100 two ways. | The FAQ answers are built from one constants file (`src/lib/scoring-weights.ts`) that a test compares against the pipeline's scorer. |

## Rulings

- **Floor and minimum.** A ranked "best" surface lists giveaways at 65 or more and nothing else; the homepage rail needs 10 such rows or it does not render. Constants: `BEST_PROMO_SCORE_FLOOR`, `BEST_PROMO_MIN_ROWS`.
- **Promos only for NBA and NHL.** Their promo rows are scored; no `teamScores` document is ever written for them (`--promos-only`, and the script refuses regardless). Their ticket-package rows are never scored and any stored score is cleared.
- **Next-season title flip.** By data, not by date: every upcoming row in the next not-yet-open season. A club with no next-season rows keeps the season just played. Hubs flip only after the league's season has ended and at least one club has published.
- **Events year.** "2026-27" only when the upcoming run crosses New Year; otherwise the single year.
- **Tickets.** "Get Tickets" on every ticket button, both partners, every surface. No button is labelled "Resale tickets". One resale line per TicketNetwork button group, never one per button: once under the pair on a ticket card, once under the page lede on /promos/today, once under "Pick your show" on an event stop. None under Ticketmaster. Words live in `src/lib/ticket-labels.ts`; the Banana Ball pages inherit the rule (`docs/events-banana-ball-brief.md`, `docs/cta-registry.md`).
- **"Verified".** Dropped from /venues: 43 of the 203 listed buildings met the pipeline's current verification rule on 2026-11-25.
- **Preview access.** No Vercel protection-bypass secret. When the preview is behind SSO, a local production build of the release head is the pre-deploy check.

## Standing sanity numbers (2026-11-25)

- **223 venue hubs** in `venueHubs`, of which **203 are indexable** (listed on /venues and in the sitemap). The 223rd is `cotton-bowl-stadium`, created 2026-08-11 with no tenants (a neutral site); the other 222 were seeded on 2026-07-13.
- **169 team pages**: MLB 30, NFL 32, NBA 30, NHL 32, MLS 30, WNBA 15.
- A full revalidate after a deploy is 169 team paths + 223 venue paths, plus the rivalry, events and fixed paths (464 in this round). `/api/revalidate` answers ok for a path it does not know, so compare the sent count with the revalidated count.

## Commits on main

| Repo | Before | After |
|---|---|---|
| promonight-web | `7905626` | `c392180` (the release), then `a0963b0` (live guard fix) |
| promo-pipeline | `d4dc192f` | `429d6753` |

Production deploy of the release: `dpl_9X7hSh3GjLNQNFFNDmvdhMWGdJu3`.

## The score write (2026-11-25, 20:59 to 21:00 UTC)

| League | Mode | Rows scored | Packages skipped | Rows whose score changed |
|---|---|---|---|---|
| NHL | promos only | 1,348 | 179 | new |
| NBA | promos only | 944 | 234 | new |
| MLB | full | 2,931 | n/a | 17 |
| MLS | full | 446 | n/a | 6 |
| WNBA | full | 237 | n/a | 4 |

Nineteen teams moved rank on the season score. After the write `/best-promos` listed 192 NBA and NHL giveaways and `/best-promos/bobbleheads` 76.

## Snapshots

Kept in the pipeline checkout, git-ignored: `/Users/mattkovalik/promonight/promo-pipeline/captures/`

- `scoring-state-NHL-fix-round-2026-11.json`
- `scoring-state-NBA-fix-round-2026-11.json`
- `scoring-state-MLB-fix-round-2026-11.json`
- `scoring-state-MLS-fix-round-2026-11.json`
- `scoring-state-WNBA-fix-round-2026-11.json`

Each holds the four score fields of every promo doc in the league and the `teamScores` docs as they stood before the write.

## Rollback

Scores, per league, from the pipeline checkout (dry run without `--execute`):

```bash
node scripts/capture-scoring-state.js --restore=/Users/mattkovalik/promonight/promo-pipeline/captures/scoring-state-<LG>-fix-round-2026-11.json --execute
```

Web: redeploy the last production deployment of `7905626`. Restore all five snapshots in the same sitting: the old homepage rail has no floor and no league filter and would show NBA and NHL rows whose "Full rankings" link lists none.

Pipeline: `git revert -m 1 429d6753` on main. That removes the scoring step from the NHL (Friday 08:00 UTC) and NBA (Monday 08:00 UTC) scans; nothing else stays armed.

To re-score after a scorer change:

```bash
node scripts/backfill-scoring.js --league=NHL --promos-only --prod-baseline            # dry run
node scripts/backfill-scoring.js --league=NHL --promos-only --prod-baseline --execute
node scripts/backfill-scoring.js --league=MLB --prod-baseline --execute                # MLB, MLS, WNBA: full
```

## Deferred

One line each in `docs/known-issues.md`:

- **126** the bobbleheads page has no score floor or minimum row count.
- **127** scoring: thresholds and windows, scorer vocabulary gaps, package rows on MLB, clubs with no scored rows, video selection.
- **128** discovery links: Events link between 768 and 859px, hub JSON-LD, rivalry title and JSON-LD names.
- **129** season state: clubs that flip while their league plays, the schedule block on an early page, early-page wording, rivalry and events timing.
- **130** counts and tickets: "verified" on /about and per-venue pages, the `venue_count` step, daily-board tiles at phone width, the app's buttons.
- **131** the final-gate sweep: the "TICKETS" pill, tap targets, copy slips, the legacy scorer.
- **132** live guards that match literal label text; the Twins page at 935,306 bytes against the 950,000 cap.

Reports: `docs/ux-review/2026-11-25-*.md`, one per branch and one for the release.
