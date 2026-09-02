# /nhl hub: held branch notes

Branch `feature/nhl-hub-held`, cut from `origin/main` at `6122d9d` on 2026-09-01.
Held, not merged, not pushed. It lands inside the NHL cron enable commit, per
`promo-pipeline/docs/nhl-pending-decisions.md` entry 6c, and not before.

## What the branch carries

- `src/app/nhl/page.tsx`: the hub, composed from the shared hub kit in the
  WNBA/MLS shape (today rail, this-week rail, team grid, browse tiles, arena
  guides, FAQ). Not the NFL week container: NHL has no games spine in Firestore
  yet, and the hub must not depend on one until the spine ingest executes.
- `src/lib/data.ts`: the NHL `HUB_GROUPING` spec and `getLeagueUpcomingPromoCounts`.
- `src/lib/nhl-hub.ts` plus its test: `nhlClubCardSubtitle`.
- `src/lib/analytics.ts`: the five `web_nhl_hub*` surfaces at all three edit sites.
- `src/lib/promo-helpers.ts`: NHL joins the team-page freshness sentence.

## Pre-flip behavior mirrored

`/nfl` shipped in `79d761b` with "Route exists but nothing links it: NFL stays
live:false until step 6". No `notFound()`, no `noindex`, no gate in the page.
The registry flag alone kept it out of the nav, the footer, the team-page
up-links and the sitemap. This branch does exactly that: `league-hubs.ts:34`
is untouched (`live: false`), the route renders when addressed directly, and
nothing links it. Verified on the local build: zero `href="/nhl"` on the
homepage and on `/nhl/boston-bruins`, and the sitemap lists `/nfl` but not
`/nhl`.

## Division grouping, verified

Read-only Firestore read of the 32 NHL team docs on 2026-09-01:

| division | clubs |
|---|---|
| Atlantic | 8 |
| Metropolitan | 8 |
| Central | 8 |
| Pacific | 8 |

The `division` field carries exactly those four strings. No doc carries a
`conference` field, so the Eastern and Western bands are derived from the
division in `HUB_GROUPING` rather than read. `utah-hockey-club` renders as
Utah Mammoth in Central from its own `city` and `name` fields; no fallback was
needed and none was added.

## The zero-state decision: render every club, zero as copy

14 of 32 clubs have zero upcoming promos today: 9 active clubs whose slate the
scanner has not published yet, and 5 withheld clubs (Ottawa, Toronto, Utah,
Vancouver, Washington). All 32 render as cards, in division order,
alphabetical within the division, and a zero renders as the line
**"No upcoming promos listed yet"**. A populated club reads "N upcoming promos".

Why render rather than hide: hiding 14 clubs would make the hub misstate what
the league looks like and break find-your-team, which is what a hub is for.
The NFL hub faced the same corpus shape and rendered every club with an honest
non-promo line ("9 home games"); NHL has no spine to count home games from, so
the zero line states what the site has listed instead.

Why that wording: the line is a claim about this site, not about the club.
"Not announced yet" would be a claim the data cannot back, and it would be
false today for four of the nine pending clubs (Dallas, Tampa Bay, Pittsburgh,
Seattle published between the last scan and 2026-09-01). Pending and withheld
clubs get the same line because a fan does not care why.

Why the count is "upcoming" and not "this season": the web repo has no NHL
season window, the season straddles the calendar year, and the NFL "this
season" count comes from a spine join NHL does not have. Upcoming is the one
number the site can back today and the one a fan can act on.

Guarded in code: `nhlClubCardSubtitle` is tested to never emit a bare zero, and
the served `/nhl` HTML was grepped for the literal string "0 promos" (zero hits).

## Freshness sentence, before and after

Before, on every team page with ten or more upcoming promos:

> MLB, WNBA, and MLS schedules are rechecked weekly in season.

After:

> MLB, WNBA, MLS, and NHL schedules are rechecked weekly in season.

Both the visible FAQ and the FAQPage JSON-LD render from the same `faqs`
array, so one edit covers both render paths (framework 6b.7). Verified on the
served `/nhl/boston-bruins`: the new sentence appears in the visible FAQ and
inside the FAQPage JSON-LD block, and the old sentence is gone.

The hub hero carries "Rechecked weekly and updated as clubs announce
promotions." (the MLB year-round variant). If the NHL workflow ends up
month-gated, switch it to the WNBA "in season" variant before the flip.

## Two sibling cadence claims that must change in the enable commit

Both currently say NHL is added by hand, which becomes false the moment the
cron fires. They are outside this branch's scope and are listed here so the
enable commit does not leave the site contradicting itself:

- `src/lib/about-copy.ts` lines 196 and 341: "NBA, NHL and NFL are added by
  hand as teams announce".
- `src/components/homepage-json-ld.tsx` line 36: "MLB, WNBA, and MLS schedules
  are rechecked weekly in season, and other leagues are updated as new
  announcements are confirmed."

## Browse tiles, from the corpus

On 2026-09-01 the 575 upcoming NHL promos were 435 theme, 98 giveaway (23
bobbleheads by title), 36 kids, 6 food, 3 jersey giveaways. Tiles: theme
nights, bobblehead giveaways, everything this week. Jerseys and food deals
cannot fill a tile and are not invented.

## Local verification, 2026-09-01

`npx next dev -p 3111` from the worktree, no push, no Vercel preview. Served
HTML fetched with curl:

| check | result |
|---|---|
| `/nhl` | 200, title "NHL Promotions & Giveaways 2026-27", canonical /nhl, og:image present |
| division headings | Atlantic, Metropolitan, Central, Pacific under Eastern and Western Conference bands |
| team card links | 32 unique `/nhl/{slug}` anchors in the server HTML |
| zero-state cards | 14 (the 9 pending plus the 5 withheld clubs) |
| populated cards | 18, each "N upcoming promos" |
| literal "0 promos" | 0 |
| em dash bytes in served `/nhl` | 0 |
| today rail | "No NHL promos today" fallback (no promo dated today) |
| this-week rail | absent (no NHL promo in the next seven days; the component returns null) |
| stat bar | absent (NHL is unscored and the slate is empty; nothing to show) |
| arena guides | 2 indexable NHL venue hubs today (Climate Pledge Arena, Crypto.com Arena) |
| `/nhl/boston-bruins` | new freshness sentence in visible FAQ and FAQPage JSON-LD, old sentence gone |
| unlinked | zero `href="/nhl"` on the homepage and the Bruins page; sitemap omits /nhl and lists /nfl |
| `npx tsc --noEmit` | clean |
| unit test | `src/lib/__tests__/nhl-hub.test.ts` 3 of 3 pass |
| eslint | not run: the repo carries no ESLint config and `next lint` prompts to create one |

Screenshot: headless Chrome capture of the local `/nhl` saved outside the repo
in the session scratchpad (`nhlhub/nhl-hub-2026-09-01.png`). The Chrome
extension was not connected, so the capture is the CLI's, not the browser tool's.

Pre-season shape to expect until late September: no today promos, no
this-week rail, no stat bar, so the hero sits directly above the team grid.
That is the truthful state, not a defect. An explicit pre-season notice (the
way `/nfl` carries an offseason block) was not added and is a candidate for
the flip if the grid alone reads too bare.

## The enable commit checklist

1. The NHL scan workflow exists on `promo-pipeline` main and has fired a
   watched execute (framework section 7 first-execute discipline, spine gate
   satisfied per the 2026-09-01 ruling).
2. Flip `live: false` to `live: true` at `src/lib/league-hubs.ts:34`. That one
   line lights the nav, the footer, the team-page up-links and the sitemap
   entry (the sitemap iterates `LEAGUE_HUBS`).
3. Merge this branch with `--no-ff` in the same change.
4. Update the two sibling cadence claims above.
5. Revalidate `/nhl` and the 32 NHL team pages; IndexNow follows the sitemap
   through the deploy hook.
6. Verify against served production HTML, all five layers (title, description,
   og tags, JSON-LD, body), per SITE-AUDIT section 9a.
