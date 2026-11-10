# Promo duplicates: pipeline ticket (2026-11)

Filed 2026-11-10 from promonight-web `fix/gsc-cleanup-2026-11` (Gate 1 and Gate 2
rulings of 2026-11-10). Owner: OPS, promo-pipeline. **No Firestore write was made
from the web side, and nothing in promo-pipeline was edited.** The final design is
for the pipeline session to decide; this ticket describes the pattern and what the
web needs from the data.

## The pattern: two records per game

For one game, the pipeline writes one promo record for the theme night and a
second for its item or its special-ticket package. Each record gets its own
`pageSlug`, so each gets its own page at `/{league}/{team}/promos/{pageSlug}`.

| Shape | Example (team, date) | Record A | Record B |
|---|---|---|---|
| theme + giveaway item | Nets 2027-01-29 | Swamp Dragons Night (theme) | Swamp Dragons Bobblehead (giveaway) |
| theme + giveaway with no item named | Ducks 2027-01-14 | Hockey is for Everyone Night (theme) | Hockey is for Everyone Giveaway (giveaway) |
| theme + special-ticket package | Timberwolves 2026-11-02 | Noche Latina (theme) | Noche Latina Baseball Jersey (theme, `ticketPackageRequired: true`) |

The audit script `scripts/audit-promo-duplicates.ts` (read-only, committed on this
branch) scans every team's promos subcollection. On 2026-11-10 it found:

- 5,474 live promo pages, 379 likely same-game pairs (same team, page season and
  date or adjacent date, overlapping distinctive title or slug words).
- 164 pairs whose two titles reduce to the same distinctive words, 215 where one
  adds an item word.
- 145 of the 379 already handled on the web by the canonical rule of 2026-10-29
  (titles that nest: the weaker page carries rel=canonical to the stronger and
  leaves the sitemap).
- No pair shares a record. Every pair is two records, almost always with the same
  `sourceUrl` and the same `themeKey`, and the two records point at the same game
  only by date and opponent text.

## Item pages earn their own clicks: do not merge blindly

Search Console, Oct 30 to Nov 9 (clicks / impressions / average position), as
given in the 2026-11-10 ruling:

| Team | Theme page | Item or package page |
|---|---|---|
| Penguins | 90s-night 6 / 75 / 9.0 | 90s-night-t-shirt 9 / 35 / 4.0 |
| Timberwolves | nba-paint-night 24 / 182 / 5.4 | paint-night-blanket 16 / 79 / 2.8 |
| Timberwolves | military-appreciation 7 / 104 / 4.0 | military-appreciation-baseball-jersey 4 / 53 / 3.6 |
| Warriors | hello-kitty-night 25 / 334 / 4.4 | hello-kitty-giveaway 12 / 131 / 7.0 |
| Timberwolves | noche-latina 27 / 397 / 3.7 | noche-latina-baseball-jersey 6 / 341 / 7.1 |

The item page often wins its own search. **Do NOT merge item records into theme
records** (for example by folding the jersey into the night's `ticketPackageName` or
`giveawayItem` and deleting the item record): that would delete pages that earn
clicks. The real cannibalization is only where two titles say the same thing, and
the web now handles that on its side (below).

## The ask: a shared game key or a sibling link

What the web cannot do today is relate the two records reliably. It infers the pair
from the date plus overlapping title words, which is a heuristic. Please give the
web one of these (or something better), decided in the pipeline session:

1. **A shared game key** on every promo record, the same value on every record for
   one game (for example the games-spine id where one exists, else
   `{teamId}:{date}:{normalized opponent}`), or
2. **A sibling link**: on the item or package record, the promo id of the theme
   record it belongs to (and optionally a `facet` field: `theme`, `item`,
   `package`).

With either, the web can link the pair, title them apart and pick a canonical
without guessing from words.

## What the web does now (shipping with this branch)

1. Giveaway and theme on the same game, neither a package: both pages stay and link
   each other ("Also at this game"). When the giveaway's title names no item the
   night's title lacks ("Hockey is for Everyone Giveaway" / "... Night"), the
   giveaway carries rel=canonical to the night and leaves the sitemap.
2. A special-ticket package page (NBA, NHL) beside a related promotion on its game:
   its `<title>` carries " Ticket Package" (from `ticketPackageRequired`); its H1
   keeps the stored title. The theme page does not link it (WEB6 G2 stands). The
   title never drops the team: past 60 it drops the " | PromoNight" suffix, then
   a stored prefix that repeats the team or season, and runs up to 70 (Gate 2
   ruling). 35 pages carried the qualifier on 2026-11-10.
3. An old slug in `previousSlugs` whose current page is a duplicate redirects
   straight to the canonical in one hop.

## Data defects seen in the 2026-11-10 pairs

- `giveawayItem` is null on every record in the 22 pairs checked: the item name
  lives only in the title.
- Cavaliers 2026-11-14: slug `10th-anniversary-celebration-2016-championship-mini-banner-g`
  is cut off mid-word (title "... Mini Banner Giveaway"). It looks like a slug
  length cap applied to the title, a pipeline artifact. The record is a theme with
  `ticketPackageName: "10th Anniversary Plan"` beside a separate non-package
  giveaway record for the same banner. Its package title is the longest on the
  site, 96 characters ("10th Anniversary Celebration & 2016 Championship Mini
  Banner Giveaway Ticket Package | Cavaliers"): a shorter stored title would fix it.
  Re-minting the slug needs the old one in `previousSlugs` (the web redirects it).

## Verify ticketPackageRequired: the night itself is flagged

Four records where the theme night (not an item beside it) is stored as a
special-ticket package. The web applies rule 2 to them as stored (ruling
2026-11-10: the stored flag is the source of truth, and the 2026-10-24 ruling says
a package promo must never look free), so each page's title reads "... Ticket
Package". Please verify each flag against its source:

| Team | Page slug | Stored | Same-game sibling |
|---|---|---|---|
| Warriors | `hello-kitty-night` (2027-03-22) | theme, `ticketPackageRequired: true`, no `ticketPackageName` | `hello-kitty-giveaway` (giveaway, not a package) |
| Warriors | `pride-night` (2026-11-05, played) | theme, `ticketPackageRequired: true`, no `ticketPackageName` | `pride-night-fan` (giveaway, not a package) |
| Wizards | `cherry-blossom-night-2026-27` (2027-03-24) | theme, `ticketPackageRequired: true`, `ticketPackageName: "Cherry Blossom Night"` | `cherry-blossom-sakura-snow-globe` (giveaway, not a package) |
| Grizzlies | `sunday-family-funday` (2026-11-29) | theme, `ticketPackageRequired: true`, no `ticketPackageName` | `sunday-family-funday-kids-day` (kids, not a package) |

If a flag is corrected, nothing on the web needs to change: the title, the links
and the canonical are computed at render from the stored flag. The corrected page
updates on the scan's post-write revalidate (lib/promo-pages-notify.js revalidates
each written row's path); its same-game sibling, whose links and (for the
Warriors) canonical also depend on the flag, updates through its own daily ISR
(`revalidate = 86400`). A correction written outside a scan, without the
notifier, reaches both pages within a day.

- Islanders 2026-12-04: `islanders-scout-patch` (theme) and `scout-patch` (kids,
  two records under one slug) are all package records with the same
  `ticketPackageName: "Scouts Night Out"`, so the game has no non-package page at
  all. Left unchanged on the web by ruling (no rule fits a game whose every page
  is a package): both titles are as stored, no qualifier, no canonical. Two
  records under one slug is itself worth a look.
