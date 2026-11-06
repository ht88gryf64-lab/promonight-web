# 2026 promo data report

Fact base for press outreach. **Generated 2026-08-28** by `audit/promo-data-report-2026.ts` — every number below is derived at run time; nothing is transcribed. Regenerate rather than edit.

- **Season described:** 2026 (hardcoded; the report does not roll over on Jan 1).
- **"Upcoming" means:** `date >= 2026-08-28`, the site's own `isUpcomingPromo`.
- **"Visible" means:** `tombstoned !== true`, the site's own `isVisiblePromo`, then the site's own `dedupePromos` on `(team, date, lowercased title)`.
- **Publishability basis:** origin/main:docs/SITE-AUDIT.md §3, generated 2026-08-21.

---

## 0. How SAFE / NOT SAFE was decided

One function (`classify`) labels every figure. It reads the per-league completeness scores parsed out
of section 3 and applies three tiers plus a set of disqualifiers that override them.

- **Tier A** (publishable as a promo-content figure): Overall >= 8.0 **and** Structural >= 8.0 **and** season = in-season.
- **Tier B** (publishable as coverage/inventory only): Structural >= 8.0. Structural is the season-independent subset, so it survives an offseason.
- **Tier C**: everything else — not publishable.

Why 8.0 on both. Overall is the promo half plus half of Structural, each half scored out of 5.0. Requiring
Structural >= 8.0 pins the structural half at >= 4.0 of 5.0. Requiring Overall >= 8.0 on top of that forces
the promo half to at least 8.0 - (Structural / 2), which for a league at the Structural floor means >= 4.0,
and for a structurally strong league can be less: WNBA at 8.0 Overall / 8.9 Structural carries a promo half
of 3.55, not 4.0. So the pair is not a guarantee that four clubs in five are deep — it is a floor that rises
as structural quality falls, which is the property worth having. What it does reliably exclude is the case
the rubric is most likely to flatter: a league where most clubs scraped a single row, since "has >= 1
upcoming" alone is worth 3.0 of the promo half's 5.0 and cannot on its own reach the floor.

Neither score measures ACCURACY. Every dimension is a field-presence test: none checks whether a promo's
date, opponent or title is right, and none compares our corpus against what clubs actually announced.
A Tier A pass authorises publishing a COUNT. It never authorises a claim of completeness.

Disqualifiers that override the tiers, in the order `classify` applies them:

1. **Nothing behind it.** The field or corpus does not exist. Publishing would invent data.
2. **Coverage/recall claim.** No dimension of the rubric has an external denominator, so no score can
   ever support "every", "all", or "complete".
3. **Scored-surface figure.** Rescore boundary, an unbounded-numerator hub tally, and a Nov 8 flip to
   retrospective mode that happens with no deploy.
4. **Cross-league aggregate inherits its weakest league.** A sitewide total that includes a league which
   fails on its own is not rescued by the leagues that pass.
5. **Legacy `venues` provenance.** That collection carries no source URL, no `verifiedAt` and no
   `updatedAt` on any of its documents.
6. **No section-3 row.** A corpus the rubric never measured has no basis (this is what excludes CFB).
7. **Stale basis for that league**, in a dimension the tier actually reads. If recomputing the rubric live
   disagrees with the published table on a number the tier consults, that league is disqualified. Tier B
   reads Structural alone, so a league whose Overall moved while its Structural held is not disqualified
   from a venue figure by a number that figure never used.
8. **Unscoped figure.** A figure naming no league has no completeness row to rest on.
9. **Harvest artifact.** The counts are right but their SHAPE tracks when we scraped rather than the world.
   Section 5 is the live example, and it is the most consequential single finding in this report.

### The basis is partly stale — measured, not assumed

Section 3 was generated **2026-08-21**. Re-running the same collector against live data
on **2026-08-28** gives:

| League | Published (2026-08-21) | Live (2026-08-28) | Status |
|---|---|---|---|
| MLB | 9.9 / 9.7 / in-season | 9.9 / 9.7 / in-season | unchanged |
| NBA | 3.0 / 5.9 / offseason | 3.0 / 5.9 / offseason | unchanged |
| NFL | 4.1 / 4.3 / in-season | 4.3 / 4.3 / in-season | **MOVED** |
| NHL | 2.8 / 5.6 / offseason | 5.6 / 5.6 / in-season | **MOVED** |
| MLS | 8.8 / 8.9 / in-season | 8.8 / 8.9 / in-season | unchanged |
| WNBA | 8.0 / 8.9 / in-season | 7.6 / 8.9 / in-season | **MOVED** |

A league whose row moved is disqualified below, because the published table its label would rest on is
no longer reproducible by its own generator.

### One caveat this report cannot resolve from inside this repo

A publish hold on promo-data changes is recorded in project notes as being in force since 2026-08-25,
pending work on measured model-side extraction variance. The pipeline that owns it lives in a different
checkout, and its branch-state doc records the branch as *nothing executed*, not as an explicit hold on
reporting. **SAFE below therefore means "defensible on the data as it stands", not "cleared to ship".**
Confirm the hold is lifted before any of this reaches a journalist.

---

## 1. Total promos tracked, by league

Two numbers exist for "all-time". The raw figure is 20.0% larger than the filtered one
(5,858 against 4,883; the 975 tombstoned rows are 16.6% of the raw total). The site's
homepage stat uses the raw one; this report uses the filtered one everywhere and shows the raw only to
mark it unpublishable.

**All promo documents (RAW, unfiltered): 5,858**

```
db.collectionGroup('promos').count().get()
```

- Docs behind it: 5,858
- Includes 975 soft-deleted (tombstoned) documents that no site surface renders.
- This is the number `getPromoCount()` returns and the homepage renders. Its own code comment concedes it over-counts.
- **NOT SAFE TO PUBLISH** — Aggregates leagues that are individually not publishable (NBA, NFL, NHL, WNBA). A total inherits the weakest league in it.

**All promos, all-time (visible + deduped): 4,883**

```
db.collectionGroup('promos').get()
  .filter(isVisiblePromo)          // tombstoned !== true
  .then(dedupePromos(key = team.id + date + lowercased title))
```

- Docs behind it: 4,883
- Raw 5,858 minus 975 tombstoned minus 0 dedupe collisions — the dedupe stage is measurably inert on this corpus today, so it contributes nothing to this figure.
- Spans multiple seasons — it is an archive figure, not a claim about what a fan can attend.
- 5 of these rows carry no usable date (Cincinnati Reds: Thirsty Thursdays; Cincinnati Reds: Family Discount Days; Cincinnati Reds: Senior Days; Cincinnati Reds: Business Day Specials; Miami Heat: Season-long deals) and belong to neither the upcoming nor the past population, per the site's own splitPromosByDate.
- **NOT SAFE TO PUBLISH** — Aggregates leagues that are individually not publishable (NBA, NFL, NHL, WNBA). A total inherits the weakest league in it.

**Upcoming promos (date >= 2026-08-28), all leagues: 1,621**

```
visible+deduped promos, then .filter(p => p.date >= '2026-08-28')   // isUpcomingPromo
```

- Docs behind it: 1,621
- **NOT SAFE TO PUBLISH** — Aggregates leagues that are individually not publishable (NBA, NFL, NHL, WNBA). A total inherits the weakest league in it.

### Per-league breakdown

| League | Teams | All-time (visible) | 2026 dated | Upcoming (>= 2026-08-28) | Teams with >=1 upcoming | Verdict |
|---|---|---|---|---|---|---|
| MLB | 30 | 2,608 | 2,604 | 675 | 30/30 | SAFE |
| MLS | 30 | 430 | 417 | 197 | 28/30 | SAFE |
| NBA | 30 | 331 | 208 | 0 | 0/30 | NOT SAFE |
| NFL | 32 | 141 | 132 | 126 | 15/32 | NOT SAFE |
| NHL | 32 | 1,137 | 581 | 575 | 18/32 | NOT SAFE |
| WNBA | 15 | 236 | 236 | 48 | 14/15 | NOT SAFE |

Query: `db.collectionGroup('promos').get()` → resolve league via `doc.ref.parent.parent.id` → `teams/{id}.league` (promo documents carry no league field), then `isVisiblePromo` → `dedupePromos`.

- **MLB** — **SAFE TO PUBLISH** — Tier A: MLB Overall 9.9 >= 8.0, Structural 9.7 >= 8.0, in-season, and the live recompute still agrees. Publishable as a count, with its as-of date and denominator attached.
- **MLS** — **SAFE TO PUBLISH** — Tier A: MLS Overall 8.8 >= 8.0, Structural 8.9 >= 8.0, in-season, and the live recompute still agrees. Publishable as a count, with its as-of date and denominator attached.
- **NBA** — **NOT SAFE TO PUBLISH** — Tier A fails: NBA Overall 3.0 (need >= 8.0), Structural 5.9 (need >= 8.0), season offseason.
- **NFL** — **NOT SAFE TO PUBLISH** — Basis is stale for NFL. §3 (generated 2026-08-21) says 4.1/4.3 in-season; recomputing the same rubric against live data on 2026-08-28 returns 4.3/4.3 in-season. Labelling against a table its own generator no longer reproduces would publish a false premise. (Dimensions this tier consults: Overall, Structural and season.)
- **NHL** — **NOT SAFE TO PUBLISH** — Basis is stale for NHL. §3 (generated 2026-08-21) says 2.8/5.6 offseason; recomputing the same rubric against live data on 2026-08-28 returns 5.6/5.6 in-season. Labelling against a table its own generator no longer reproduces would publish a false premise. (Dimensions this tier consults: Overall, Structural and season.)
- **WNBA** — **NOT SAFE TO PUBLISH** — Basis is stale for WNBA. §3 (generated 2026-08-21) says 8.0/8.9 in-season; recomputing the same rubric against live data on 2026-08-28 returns 7.6/8.9 in-season. Labelling against a table its own generator no longer reproduces would publish a false premise. (Dimensions this tier consults: Overall, Structural and season.)

---

## 2. Teams ranked by 2026 promo count — MLB only

Query: visible+deduped promos where `teams/{id}.league == 'MLB'` and `date.startsWith('2026-')`.
Population: **2,604 promos across 30 clubs** (30 clubs with >= 1).

**SAFE TO PUBLISH** — Tier A: MLB Overall 9.9 >= 8.0, Structural 9.7 >= 8.0, in-season, and the live recompute still agrees. Publishable as a count, with its as-of date and denominator attached.

### Top 10

| # | Team | 2026 promos |
|---|---|---|
| 1 | Minnesota Twins | 144 |
| 2 | Texas Rangers | 131 |
| 3 | Miami Marlins | 118 |
| 4 | Seattle Mariners | 114 |
| 5 | San Francisco Giants | 113 |
| 6 | San Diego Padres | 106 |
| 7 | Detroit Tigers | 101 |
| 8 | Baltimore Orioles | 99 |
| 9 | Los Angeles Dodgers | 98 |
| 10 | Atlanta Braves | 96 |

### Bottom 10

| # | Team | 2026 promos |
|---|---|---|
| 21 | Milwaukee Brewers | 73 |
| 22 | Cleveland Guardians | 72 |
| 23 | Los Angeles Angels | 72 |
| 24 | Washington Nationals | 70 |
| 25 | Oakland Athletics | 69 |
| 26 | Chicago Cubs | 67 |
| 27 | Toronto Blue Jays | 65 |
| 28 | Philadelphia Phillies | 64 |
| 29 | Pittsburgh Pirates | 52 |
| 30 | New York Yankees | 42 |

### Every other league: excluded from the ranking

Two different reasons appear below and they should not be conflated. A league that FAILS the publication
rule cannot be ranked at all. A league that PASSES it is still not ranked here, because the brief asked
for MLB and because a club-by-club ordering is the most fragile thing a promo corpus can support — it
turns a scraping outcome into a league table.

- **MLS** — §3 Overall 8.8 / Structural 8.9 (in-season). 28 of 30 clubs carry an upcoming promo (197 rows). This league PASSES the publication rule, so its counts are quotable; it is simply not ranked here. Not excluded for data quality.
- **NBA** — §3 Overall 3.0 / Structural 5.9 (offseason). 0 of 30 clubs carry an upcoming promo (0 rows). **Fails the publication rule, so a ranking would order clubs by how well we scraped them, not by how much they run.** Excluded.
- **NFL** — §3 Overall 4.1 / Structural 4.3 (in-season); live today 4.3/4.3 in-season. 15 of 32 clubs carry an upcoming promo (126 rows). **Fails the publication rule, so a ranking would order clubs by how well we scraped them, not by how much they run.** Excluded.
- **NHL** — §3 Overall 2.8 / Structural 5.6 (offseason); live today 5.6/5.6 in-season. 18 of 32 clubs carry an upcoming promo (575 rows). **Fails the publication rule, so a ranking would order clubs by how well we scraped them, not by how much they run.** Excluded.
- **WNBA** — §3 Overall 8.0 / Structural 8.9 (in-season); live today 7.6/8.9 in-season. 14 of 15 clubs carry an upcoming promo (48 rows). **Fails the publication rule, so a ranking would order clubs by how well we scraped them, not by how much they run.** Excluded.

---

## 3. Bobblehead giveaways, 2026

The codebase carries **four** different bobblehead predicates and they disagree. Each is reported
separately below rather than merged, because the gaps between them are the finding.

- **Site predicate** (`/promos/bobbleheads`): `/bobblehead/i` against **title OR description**.
- **Strict predicate** (`isBobbleheadGiveaway`, the eBay link gate): `type === 'giveaway' && /bobblehead/i.test(title)`.
- A third, scoring-based predicate (`derivedSignals.itemType === 'bobblehead'`) exists but is confined to scored leagues and is excluded here as a scored figure.
- A **fourth** lives in the render layer: `resolveIcon` matches `/bobblehead|figurine|figure|statue/` to pick the bobblehead icon, so a row can render on the site with a bobblehead icon while sitting outside every count below.

**Neither counting predicate is a clean floor, and the errors run in both directions.**

**It over-counts, because neither predicate reads distribution mechanics.** 21 of the 278 strict rows
describe an item you can only get by buying a ticket package — two are literally titled as a ticket "offer".
Those are not giveaways. Removing them leaves **257** rows that are not purchase-gated by their own
description text, and that is the closest thing to a defensible "bobblehead giveaway" count. It is a text
test on prose the scraper captured, not a confirmed distribution mechanic, so it is approximate in both
directions.

**It also under-counts, because both predicates are literal substring tests.** 15 further 2026 rows describe a
bobblehead-class item in vocabulary neither predicate covers — "bobble figurine", "bobblelegs", "bobblecard"
— and several are unambiguous first-N-fans giveaways. The inconsistency is visible inside one product class:
some bobblecard rows are counted and others are not, purely because the scraper's description happened to
use the word "bobblehead".

**The description-only rows are not what they look like either.** 45 rows match on description alone.
They are not passing mentions — in each the bobblehead is the named promotional item. The real split inside
them is 17 purchase-gated against 28 that are not, and among the latter are genuine free giveaway nights
the strict column drops entirely.

The Minnesota Twins illustrate the description-match direction: the site predicate returns 2 rows for them,
of which exactly one (Buxton Bobblehead, 2026-06-27) is a bobblehead giveaway; the other is Star Wars Night.

**Practical guidance:** publish **approximately 257** (strict, purchase-gated removed) as the 2026 bobblehead
giveaway count, always with "approximately", and do not publish 335 or 278 unqualified.

**2026 bobblehead promos, all leagues (site predicate): 335**

```
visible+deduped promos where date.startsWith('2026-')
  .filter(p => /bobblehead/i.test(p.title) || /bobblehead/i.test(p.description))
```

- Docs behind it: 335
- Strict predicate over the same population returns 278.
- **NOT SAFE TO PUBLISH** — Aggregates leagues that are individually not publishable (NBA, NFL, NHL, WNBA). A total inherits the weakest league in it.

### By league

| League | Site predicate | Strict | Strict, not gated | Description-only | Missed by both | Teams | Verdict |
|---|---|---|---|---|---|---|---|
| MLB | 262 | 218 | 199 | 35 | 12 | 30 | SAFE |
| MLS | 14 | 14 | 13 | 0 | 0 | 10 | SAFE |
| NBA | 12 | 10 | 10 | 2 | 2 | 7 | NOT SAFE |
| NFL | 1 | 1 | 1 | 0 | 0 | 1 | NOT SAFE |
| NHL | 42 | 31 | 30 | 8 | 1 | 18 | NOT SAFE |
| WNBA | 4 | 4 | 4 | 0 | 0 | 2 | NOT SAFE |

"Strict, not gated" is the column to quote. "Missed by both" counts rows using bobblehead-class vocabulary
neither predicate matches, so the true giveaway figure sits somewhere above that column, not below it.

### By team

68 of 169 teams have at least one 2026 bobblehead row.

| Team | League | 2026 (site predicate) | 2026 (strict) | 2026 (strict, not gated) | Verdict |
|---|---|---|---|---|---|
| Los Angeles Dodgers | MLB | 29 | 28 | 28 | SAFE |
| Texas Rangers | MLB | 18 | 16 | 16 | SAFE |
| Atlanta Braves | MLB | 17 | 11 | 9 | SAFE |
| New York Mets | MLB | 16 | 16 | 16 | SAFE |
| San Diego Padres | MLB | 15 | 9 | 7 | SAFE |
| Chicago White Sox | MLB | 14 | 11 | 8 | SAFE |
| New York Yankees | MLB | 14 | 11 | 10 | SAFE |
| San Francisco Giants | MLB | 11 | 6 | 6 | SAFE |
| Cincinnati Reds | MLB | 10 | 9 | 9 | SAFE |
| Houston Astros | MLB | 10 | 10 | 8 | SAFE |
| Kansas City Royals | MLB | 10 | 10 | 10 | SAFE |
| Milwaukee Brewers | MLB | 9 | 6 | 3 | SAFE |
| St. Louis Cardinals | MLB | 9 | 6 | 5 | SAFE |
| Baltimore Orioles | MLB | 8 | 5 | 5 | SAFE |
| Chicago Cubs | MLB | 8 | 8 | 7 | SAFE |
| Tampa Bay Rays | MLB | 8 | 6 | 4 | SAFE |
| Seattle Mariners | MLB | 7 | 6 | 6 | SAFE |
| Toronto Blue Jays | MLB | 7 | 6 | 6 | SAFE |
| Cleveland Guardians | MLB | 6 | 6 | 4 | SAFE |
| Oakland Athletics | MLB | 6 | 4 | 4 | SAFE |
| Chicago Blackhawks | NHL | 5 | 4 | 4 | NOT SAFE |
| Detroit Pistons | NBA | 5 | 5 | 5 | NOT SAFE |
| Los Angeles Angels | MLB | 5 | 5 | 5 | SAFE |
| Washington Nationals | MLB | 5 | 5 | 5 | SAFE |
| Columbus Blue Jackets | NHL | 4 | 0 | 0 | NOT SAFE |
| Miami Marlins | MLB | 4 | 4 | 4 | SAFE |
| Nashville Predators | NHL | 4 | 4 | 4 | NOT SAFE |
| Pittsburgh Pirates | MLB | 4 | 3 | 3 | SAFE |
| Boston Red Sox | MLB | 3 | 3 | 3 | SAFE |
| Charlotte FC | MLS | 3 | 3 | 3 | SAFE |
| Colorado Avalanche | NHL | 3 | 0 | 0 | NOT SAFE |
| Detroit Red Wings | NHL | 3 | 3 | 3 | NOT SAFE |
| Edmonton Oilers | NHL | 3 | 3 | 3 | NOT SAFE |
| Montreal Canadiens | NHL | 3 | 3 | 3 | NOT SAFE |
| St. Louis Blues | NHL | 3 | 2 | 2 | NOT SAFE |
| Washington Mystics | WNBA | 3 | 3 | 3 | NOT SAFE |
| Arizona Diamondbacks | MLB | 2 | 2 | 2 | SAFE |
| Denver Nuggets | NBA | 2 | 2 | 2 | NOT SAFE |
| Detroit Tigers | MLB | 2 | 2 | 2 | SAFE |
| Los Angeles Kings | NHL | 2 | 1 | 1 | NOT SAFE |
| Minnesota Twins | MLB | 2 | 1 | 1 | SAFE |
| Nashville SC | MLS | 2 | 2 | 2 | SAFE |
| Philadelphia Phillies | MLB | 2 | 2 | 2 | SAFE |
| Pittsburgh Penguins | NHL | 2 | 2 | 2 | NOT SAFE |
| San Diego FC | MLS | 2 | 2 | 1 | SAFE |
| Vegas Golden Knights | NHL | 2 | 2 | 1 | NOT SAFE |
| Washington Capitals | NHL | 2 | 1 | 1 | NOT SAFE |
| Austin FC | MLS | 1 | 1 | 1 | SAFE |
| Boston Bruins | NHL | 1 | 1 | 1 | NOT SAFE |
| Buffalo Sabres | NHL | 1 | 1 | 1 | NOT SAFE |
| Cleveland Cavaliers | NBA | 1 | 1 | 1 | NOT SAFE |
| Colorado Rockies | MLB | 1 | 1 | 1 | SAFE |
| FC Cincinnati | MLS | 1 | 1 | 1 | SAFE |
| Golden State Valkyries | WNBA | 1 | 1 | 1 | NOT SAFE |
| Los Angeles Galaxy | MLS | 1 | 1 | 1 | SAFE |
| Los Angeles LAFC | MLS | 1 | 1 | 1 | SAFE |
| Los Angeles Clippers | NBA | 1 | 0 | 0 | NOT SAFE |
| Memphis Grizzlies | NBA | 1 | 1 | 1 | NOT SAFE |
| Minnesota Timberwolves | NBA | 1 | 1 | 1 | NOT SAFE |
| Minnesota Wild | NHL | 1 | 1 | 1 | NOT SAFE |
| New England Revolution | MLS | 1 | 1 | 1 | SAFE |
| New Jersey Devils | NHL | 1 | 1 | 1 | NOT SAFE |
| New York Islanders | NHL | 1 | 1 | 1 | NOT SAFE |
| San Antonio Spurs | NBA | 1 | 0 | 0 | NOT SAFE |
| San Francisco 49ers | NFL | 1 | 1 | 1 | NOT SAFE |
| Seattle Kraken | NHL | 1 | 1 | 1 | NOT SAFE |
| Seattle Sounders FC | MLS | 1 | 1 | 1 | SAFE |
| Kansas City Sporting | MLS | 1 | 1 | 1 | SAFE |

**Single date carrying the most bobblehead nights league-wide: 2026-05-30 — 6 bobblehead nights**

```
2026 bobblehead rows, STRICT predicate (type === 'giveaway' && /bobblehead/i.test(title))
  MINUS purchase-gated rows (description names a ticket package)
  grouped by exact date, counted as DISTINCT CLUBS (nights, not rows); whole tie groups reported
```

- Docs behind it: 6
- Clubs on that date: 2026-05-30: Baltimore Orioles, Chicago White Sox, Cincinnati Reds, Los Angeles Dodgers, Tampa Bay Rays, Washington Nationals
- Runners-up: 2026-03-28, 2026-04-11, 2026-05-09, 2026-05-16, 2026-06-13, 2026-07-22, 2026-09-05 (5 each)
- Counting ROWS instead of nights, and without removing purchase-gated add-ons, the answer differs — which is why the unit matters: the looser site predicate peaks at 2026-07-22 with 7.
- A "league-wide" superlative is only as sound as the weakest corpus it ranked against, which is why this one is not publishable: an under-scraped league could hold the real peak. The MLB-only version below is.
- **NOT SAFE TO PUBLISH** — Aggregates leagues that are individually not publishable (NBA, NFL, NHL, WNBA). A total inherits the weakest league in it.

**Single date carrying the most bobblehead nights — MLB only: 2026-05-30 — 6 bobblehead nights**

```
2026 MLB bobblehead rows, STRICT predicate minus purchase-gated, grouped by exact date,
  counted as distinct clubs (nights, not rows); whole tie groups reported
```

- Docs behind it: 6
- Clubs: 2026-05-30: Baltimore Orioles, Chicago White Sox, Cincinnati Reds, Los Angeles Dodgers, Tampa Bay Rays, Washington Nationals
- Runners-up: 2026-04-11, 2026-06-13 (5 each)
- **SAFE TO PUBLISH** — Tier A: MLB Overall 9.9 >= 8.0, Structural 9.7 >= 8.0, in-season, and the live recompute still agrees. Publishable as a count, with its as-of date and denominator attached.

---

## 4. Day-of-week distribution — 2026 MLB giveaways

```
visible+deduped promos where league == 'MLB' and date.startsWith('2026-') and type == 'giveaway'
  grouped by new Date(date + 'T12:00:00Z').getUTCDay()
denominator: distinct scheduled home dates per weekday, from the games collection
  db.collection('games').where('league','==','mlb')   // NOTE: lowercase in games, uppercase in teams
```

Population: **996 MLB giveaway rows** in 2026. Denominator: **2,433 scheduled home dates**.

| Day | Giveaways | Share of promos | Scheduled home dates | Giveaways per home date | Share, supply-adjusted |
|---|---|---|---|---|---|
| Sunday | 145 | 14.6% | 402 | 0.361 | 13.0% |
| Monday | 83 | 8.3% | 263 | 0.316 | 11.4% |
| Tuesday | 129 | 13.0% | 374 | 0.345 | 12.4% |
| Wednesday | 99 | 9.9% | 374 | 0.265 | 9.5% |
| Thursday | 68 | 6.8% | 226 | 0.301 | 10.9% |
| Friday | 193 | 19.4% | 391 | 0.494 | 17.8% |
| Saturday | 279 | 28.0% | 403 | 0.692 | 25.0% |

**The denominator changes the story at the bottom of the table, and not at the top.** Ranked by raw
share the busiest days are Saturday and Friday; ranked per available home date they are still
Saturday and Friday, so the weekend peak is a real behaviour and is safe to state. The quiet end is not:
Thursday looks like the quietest day on raw share (6.8%) largely because it carries the
fewest home dates (226, the league travel day). Per home date the quietest day is
**Wednesday** (0.265), not Thursday (0.301).
Publish the per-home-date column, or say explicitly that the share is a share of promotions and not of games.

Note: the giveaway tally uses the site's `countPromosByType`, whose cross-count term for the secondary
`isGiveaway` flag is currently inert — that field is carried by 0 of 5,858 promo documents, so
`type === 'giveaway'` and the site's tally agree exactly today.

**SAFE TO PUBLISH** — Tier A: MLB Overall 9.9 >= 8.0, Structural 9.7 >= 8.0, in-season, and the live recompute still agrees. Publishable as a count, with its as-of date and denominator attached. Publish the per-home-date column; the raw share column alone is not publishable, for the reason above.

---

## 5. Month-by-month promo density — 2026 MLB

```
visible+deduped promos where league == 'MLB' and date.startsWith('2026-')
  grouped by date.slice(0, 7)
denominator: distinct scheduled home dates per month, from the games collection
```

| Month | Promos | of which giveaways | Scheduled home dates | Promos per home date |
|---|---|---|---|---|
| 2026-03 | 57 | 38 | 76 | 0.75 |
| 2026-04 | 185 | 87 | 390 | 0.47 |
| 2026-05 | 251 | 114 | 424 | 0.59 |
| 2026-06 | 359 | 144 | 400 | 0.90 |
| 2026-07 | 538 | 185 | 369 | 1.46 |
| 2026-08 | 642 | 232 | 415 | 1.55 |
| 2026-09 | 572 | 196 | 359 | 1.59 |

Total 2026 MLB rows: **2,604** against **2,433** scheduled home dates.
Months absent from the table (2026-01, 2026-02, 2026-10, 2026-11, 2026-12) hold no 2026 MLB rows at all. They sit
outside the season, and they are rendered as absent rather than as a zero because "no data" and
"measured none" are different claims.

### The rise is an ingestion artifact, and this is the most important caveat in the report

The raw column climbs steeply across the season. **It should not be read as seasonality, and a
journalist's plain reading of it would be false.** The denominator settles it: the number of scheduled
home dates is close to flat month to month (359–424), while promos per home date runs from
**0.47 in 2026-04** to **1.59 in 2026-09** — a 3.4x swing in a quantity that has no
reason to move with the calendar. Clubs publish their promotional schedules before the season starts;
they do not add promotions as the year goes on.

What the curve actually tracks is when the corpus was harvested. At 2026-09's rate the season would
hold roughly **3,877** rows against the **2,604** we store, so on the order of
**33%** of the season's inventory is missing, concentrated in the early months.

**Consequence for this section:** the per-month totals are individually correct and the per-home-date
column is the honest one, but the SHAPE is not publishable. Any sentence of the form "clubs run N times
more promotions in September than in April" is an artifact of our own scraping and must not be offered.

**NOT SAFE TO PUBLISH** — Harvest artifact. The distribution is confounded by when the corpus was scraped rather than by anything about the world, so the shape a reader would take from it is false even though every individual count in it is correct.

---

## 6. College football

**School documents: 87**

```
db.collection('cfbSchools').get().size
```

- Docs behind it: 87
- Every document generates a route (generateStaticParams maps the school ids with no filter).
- The site publishes this same derived number in its own copy — it comes from the cfbSchools count, not from a typed literal.
- **NOT SAFE TO PUBLISH** — CFB has no row in origin/main:docs/SITE-AUDIT.md §3. The rubric never measured this corpus, so there is no basis on which to call any figure from it publishable.

**Rivalry records: 212**

```
db.collection('cfbRivalries').get().size
```

- Docs behind it: 212
- Unique unordered school pairs among them: 212 — so these are NOT bidirectional duplicates.
- 88 carry a named trophy and 124 do not — but trophy-absence is NOT the same as being an auto-generated label. Measuring the NAME SHAPE directly: 86 are bare "SchoolA–SchoolB" pair labels, leaving 126 with a real name (The Game, the Backyard Brawl, Farmageddon and the rest carry no trophy field yet are plainly named rivalries).
- 104 are marked dormant; only 108 are attached to a 2026 game.
- The site itself publishes 32 rivalry pages (derived from the matchup registry). Publishing the raw document count would not survive scrutiny.
- **NOT SAFE TO PUBLISH** — CFB has no row in origin/main:docs/SITE-AUDIT.md §3. The rubric never measured this corpus, so there is no basis on which to call any figure from it publishable.

**Theme designations carrying verified:true: null (themeDesignations is an empty array on all 670 cfbGames documents — no theme designation has ever been written)**

```
db.collection('cfbGames').get() → sum(doc.themeDesignations.length) where doc.verified === true
```

- Docs behind it: null (no documents exist)
- cfbGames documents with verified === true: 267 of 670 (262 of 662 after the tombstone filter).
- That flag means only that a KICKOFF TIME was corroborated on a second source — not that the game record is correct.
- The only theme content anywhere is 2 cfbTraditions documents, 0 of them editorially seeded, referenced by no school and no game.
- **NOT SAFE TO PUBLISH** — Nothing to publish: themeDesignations is an empty array on all 670 cfbGames documents — no theme designation has ever been written. Stating a figure here would invent data.

**College programs carrying any promo data: null (0 of 87 cfbSchools documents have a promos subcollection — the college corpus holds schedules, venues and rivalries, and no promotions at all)**

```
for each cfbSchools doc: doc.ref.listCollections() → none contains 'promos'
```

- Docs behind it: null (no documents exist)
- **NOT SAFE TO PUBLISH** — Nothing to publish: 0 of 87 cfbSchools documents have a promos subcollection — the college corpus holds schedules, venues and rivalries, and no promotions at all. Stating a figure here would invent data.

Two different disqualifiers are at work above, and they are not interchangeable. **6.1 and 6.2 fail
because section 3 has no CFB row** — the completeness rubric groups by `teams.league` and the college
programs live in a separate collection it never reads, so there is no sanctioned basis on which to call
those numbers publishable, even though they are true and the site already states them. **6.3 and 6.4 fail
for a stronger reason: the data does not exist at all**, so no rubric could rescue them.

The practical read: the college structural counts are quotable in a general description of the product
(they are already on the site), but no college figure has a completeness basis, and the answer to "how
many verified theme designations" is zero, not a small number.

---

## 7. Minnesota cut

```
visible+deduped promos where teamId in (the six Minnesota clubs)
  2026 = date.startsWith('2026-')
  giveaways = countPromosByType(rows).giveaway     // the site's own tally
  bobbleheads = /bobblehead/i on title or description   // the site's own predicate
```

| Club | League | All-time | 2026 | Upcoming | 2026 giveaways | 2026 bobbleheads (strict) | Verdict |
|---|---|---|---|---|---|---|---|
| Minnesota Twins | MLB | 144 | 144 | 49 | 39 | 1 (2 incl. description matches) | SAFE |
| Minnesota Wild | NHL | 6 | 1 | 0 | 1 | 1 | NOT SAFE |
| Minnesota Timberwolves | NBA | 20 | 13 | 0 | 4 | 1 | NOT SAFE |
| Minnesota Vikings | NFL | 12 | 12 | 11 | 0 | 0 | NOT SAFE |
| Minnesota Lynx | WNBA | 32 | 32 | 4 | 16 | 0 | NOT SAFE |
| Minnesota United FC | MLS | 9 | 9 | 5 | 3 | 0 | SAFE |

**Read this table with its shape in mind.** The Wild carry 1 promo for the whole of 2026 and none
upcoming, which is a scraping outcome and not a statement about the club; the Timberwolves have nothing
upcoming because the NBA corpus is entirely in the past; and the Vikings' rows sit in a league that fails
the publication rule on its own score.

Clubs whose league clears the rule: **Minnesota Twins, Minnesota United FC**. Of those, only the Twins have a corpus deep
enough to carry a story on its own; Minnesota United passes the rule but on single-digit counts, so quote
it only with the number attached.

### Target Field — gate times and transit, as stored

**Target Field gate times (team page — `venues/target-field.gatesOpen`): Gates open 1 hour before first pitch for Monday through Thursday evening games, 1.5 hours before for weekday afternoon games, and 2 hours before for Friday through Sunday games.**

```
db.collection('venues').doc('target-field').get() → .gatesOpen
```

- Docs behind it: 1
- This is the string /mlb/minnesota-twins renders.
- The `venues` document carries no source URL, no verifiedAt and no updatedAt — verified across all 148 documents in that collection.
- **NOT SAFE TO PUBLISH** — Sourced from the legacy `venues` collection, which carries no source URL, no verifiedAt and no updatedAt on any document. The value may well be correct, but nothing in the record says when it was last checked or against what, so it cannot be published as a verified fact.

**Target Field gate times (venue hub — `venueHubs/target-field/tenants/minnesota-twins.gatesOpen.ruleText`): Target Field gates open for admittance 1 hour before scheduled first pitch for all Monday-Thursday evening games, 1.5 hours before scheduled first pitch for weekday afternoon games, and 2 hours before scheduled first pitch for all Friday-Sunday games.**

```
db.collection('venueHubs').doc('target-field').collection('tenants').doc('minnesota-twins').get() → .gatesOpen.ruleText
```

- Docs behind it: 1
- Source recorded: https://www.mlb.com/twins/ballpark/information/guide
- minutesBefore: null (deliberate — the rule is day-type-variable, so no single number is true)
- Tenant document carries verified=true but NO verifiedAt field (true of all 255 tenant documents).
- **SAFE TO PUBLISH** — Tier B: MLB Structural 9.7 >= 8.0. Structural is the season-independent subset, so it survives an offseason. Publishable as a coverage/inventory figure, not as an accuracy claim.

**Target Field public transit (team page — `venues/target-field.publicTransit`): METRO Blue and Green lines stop at Target Field Station, directly connected to the stadium.**

```
db.collection('venues').doc('target-field').get() → .publicTransit
```

- Docs behind it: 1
- **NOT SAFE TO PUBLISH** — Sourced from the legacy `venues` collection, which carries no source URL, no verifiedAt and no updatedAt on any document. The value may well be correct, but nothing in the record says when it was last checked or against what, so it cannot be published as a verified fact.

**Target Field public transit (venue hub — `venueHubs/target-field.publicTransit`): lines = [METRO Blue Line, METRO Green Line, Metro Transit bus]; notes = "The METRO Blue and Green Line light rail lines have accessible stops at Target Field Station, and several Metro Transit bus routes stop within one block of the ballpark. Target Field Station connects to hundreds of trains daily via the METRO Blue and Green lines."**

```
db.collection('venueHubs').doc('target-field').get() → .publicTransit
```

- Docs behind it: 1
- Source recorded: https://www.mlb.com/twins/ballpark/disability-access-guide
- Document verified=true, verifiedAt=2026-07-15T21:01:36.240Z (43 days old as of 2026-08-28).
- **SAFE TO PUBLISH** — Tier B: MLB Structural 9.7 >= 8.0. Structural is the season-independent subset, so it survives an offseason. Publishable as a coverage/inventory figure, not as an accuracy claim.

### Minnesota venue fields that are stale or unverified

5 buildings for 6 clubs — Target Center hosts both the Timberwolves and the Lynx.

| Venue | legacy `venues` doc | hub verified | hub verifiedAt (age) | sourced fields | verifiedAt → updatedAt gap |
|---|---|---|---|---|---|
| target-field | yes | true | 2026-07-15 (43d) | 11 | same write (+167 ms) |
| xcel-energy-center | yes | false | null | 0 | never verified |
| target-center | yes | true | 2026-07-19 (39d) | 14 | same write (+86 ms) |
| us-bank-stadium | yes | true | 2026-07-14 (45d) | 15 | same write (+154 ms) |
| allianz-field | yes | true | 2026-07-19 (39d) | 7 | same write (+143 ms) |

**Findings.**

1. **No fact on any Minnesota team page carries a last-verified date.** The `venues` collection has no
   `verifiedAt`, no `updatedAt`, and no source URL on any of its 148 documents. Every gate time, parking
   paragraph, transit sentence and bag link a visitor reads on a team page is undated and unsourced.
2. **The hub layer has provenance but never renders it.** `verifiedAt` and the per-field `sources` map
   exist on the hub documents and are not projected into the view model, so no reader can see them.
3. **The Wild's building is unverified.** Its hub doc (`xcel-energy-center`, stored name "Grand Casino Arena") has
   verified=false, verifiedAt null and an empty sources map. Its identity fields (name, city, coordinates,
   tenant) are populated; every LOGISTICS field — transit, parking, bag policy, gates, food, accessibility —
   is null. Nothing about that venue's game-day detail is publishable. Note the stored name: the building
   was renamed, which is itself an instance of the staleness this section is about.
4. **Nothing has been re-verified in weeks.** 166 of the 223 hub documents carry a verifiedAt at all;
   the 4 verified Minnesota buildings range from 39 to 45 days old, and nothing re-checks
   them on a schedule.

### The Northstar transit issue

Northstar was the commuter rail line terminating at Target Field. It ceased service **2026-01-04**, and
`docs/SITE-AUDIT.md` carries it as an open known bug ("Stale transit-data pass outstanding").

- **Is a Northstar claim live in stored data today? NO.** A scan of the Target Field
  `venues` document and the hub's transit lines and notes finds no mention. The stored copy names only the
  METRO Blue and Green lines and Metro Transit bus.
- **Is it still armed in the repo? YES.** `scripts/populate-plan-your-visit.ts` on
  origin/main still holds the sentence "Northstar commuter rail also terminates at the stadium." in its
  Target Field payload, and `publicTransit` is a managed field it writes with `{merge: true}`. One
  `--execute` re-run of that script republishes a false claim to the Twins page.

**The honest framing for press:** this is a near-miss, not a live error, and it should not be offered as a
data-quality win. What it exposes is the real finding — nothing in this system watches a venue fact for
staleness. A transit sentence does not change when a line shuts down, the scanners re-check promotions and
not logistics prose, and the `verified` flag records that a human once believed a fact, not that the fact
is still true.

---

## 8. Resale cut

**Past bobblehead promos carrying stored eBay resale figures: null (no resale field exists on any promo document, or anywhere else in the database. The complete field union across every promo document contains no resale, price, sold or valuation key)**

```
db.collectionGroup('promos').get() → union of every top-level field name
  → filter(/resale|ebay|sold|valuation|worth|price|market/i)
  → matches: (none)
```

- Docs behind it: null (no documents exist)
- **NOT SAFE TO PUBLISH** — Nothing to publish: no resale field exists on any promo document, or anywhere else in the database. The complete field union across every promo document contains no resale, price, sold or valuation key. Stating a figure here would invent data.

**Past bobblehead giveaways eligible to carry an eBay link: 242**

```
visible+deduped promos
  .filter(isBobbleheadGiveaway)      // type === 'giveaway' && /bobblehead/i.test(title)
  .filter(p => p.date < '2026-08-28')
```

- Docs behind it: 242
- Across 63 teams.
- These are promos that COULD carry an outbound eBay search link. They carry no price data of any kind.
- Far fewer links actually ship: the render caps are 3 rows per team page and 3 on the bobblehead hub.
- **NOT SAFE TO PUBLISH** — Aggregates leagues that are individually not publishable (NBA, NHL, WNBA). A total inherits the weakest league in it.

### Does the sample support a public claim about which giveaways hold value?

**No, and not marginally — the sample size is zero.**

The eBay integration stores nothing. `src/lib/ebay.ts` is 75 lines of pure string construction: it takes a
promo's own year, team nickname and title, builds an affiliate-tagged `ebay.com/sch/i.html` **search URL**,
and returns it. It makes no network call, receives no response, and persists no field. Its only consumer
renders one line of text — "Missed it? Check resale on eBay" — with no price, no range, and no sale record.

This was checked four independent ways and all four agree: no eBay API endpoint or credential exists
anywhere in the repo; no ingestion script was ever written (git history shows only two eBay files ever
created); the complete field union across all promo documents has no resale-shaped key; and a sweep of
every collection and subcollection in the database finds only concession prices, stadium parking prices
and menu-item prices — nothing about secondary-market value.

The line in `docs/SITE-AUDIT.md` section 5 that reads "eBay Partner Network: live, past-bobblehead resale
rows" is a **monetization-surface** statement, not a data statement: "rows" are completed-promo UI rows
that carry an affiliate link. It reads like stored data and is worth rewording.

**Therefore no ranking is produced here.** A "which bobbleheads hold their value" story is a green-field
build, not a query: it needs eBay Browse/marketplace-insights credentials (none exist), an ingestion job
(none exists), and a new stored field (the schema has no slot). The only honest cut available today is a
link inventory — the 242 past bobblehead giveaways above, each with the search URL the site would
construct for it — and it must be labelled as constructed search links, never as observed resale prices.

---

## Summary — what came back NOT SAFE

18 figures or figure groups are marked NOT SAFE TO PUBLISH, in 7 distinct
categories. The category matters far more than the count — most of these are structural and will not be
cleared by a regeneration.

**Cross-league total inherits a failing league** (6)

- `1.1` All promo documents (RAW, unfiltered)
- `1.2` All promos, all-time (visible + deduped)
- `1.3` Upcoming promos (date >= 2026-08-28), all leagues
- `3.1` 2026 bobblehead promos, all leagues (site predicate)
- `3.3` Single date carrying the most bobblehead nights league-wide
- `8.2` Past bobblehead giveaways eligible to carry an eBay link

**League scores below threshold** (1)

- `1.4-NBA` NBA promo counts

**The completeness basis is stale for that league** (3)

- `1.4-NFL` NFL promo counts
- `1.4-NHL` NHL promo counts
- `1.4-WNBA` WNBA promo counts

**Shape is an ingestion artifact** (1)

- `5.1` MLB month-by-month density

**No completeness row exists (CFB)** (2)

- `6.1` School documents
- `6.2` Rivalry records

**The data does not exist** (3)

- `6.3` Theme designations carrying verified:true
- `6.4` College programs carrying any promo data
- `8.1` Past bobblehead promos carrying stored eBay resale figures

**Venue value has no provenance** (2)

- `7.1` Target Field gate times (team page — `venues/target-field.gatesOpen`)
- `7.3` Target Field public transit (team page — `venues/target-field.publicTransit`)

### What IS publishable

Tier A (promo-content figures): **MLB, MLS**.
Tier B (venue / inventory figures only): **MLB, MLS, WNBA**.

Both lists are derived by running `classify` over every league, not typed here.

In practice the defensible press figures are the MLB ones, and the list is shorter than the tier
membership suggests, because two cuts fail on grounds the league score does not capture:

- **The 2026 MLB season count and the club ranking** — quotable with their as-of date and denominator.
- **The day-of-week cut** — quotable as the per-home-date column. The weekend peak survives normalisation;
  the "quietest day" claim does not, and inverts.
- **The bobblehead count** — quotable only as "approximately 257", the strict count with purchase-gated rows
  removed, and only for the leagues that pass.
- **NOT the month-density curve.** It is the one cut in this report whose individual numbers are all correct
  and whose shape is still false. See section 5.

None of these may be dressed as completeness in any wording.

What the quick fixes would and would not unlock — measured, not assumed:

1. **Regenerate section 3.** Three leagues moved in the seven days since it was generated. Re-running
   `classify` with the live table as the basis moves **no league** into a passing tier and
   changes nothing else — the cross-league totals stay blocked because NBA fails on merit, not on staleness.
   Worth doing, but it is not the difference between having a story and not having one.
2. **Split the all-time promo bullet.** One line currently carries a tombstone-filtered upcoming count and
   an unfiltered all-time count with no marking between them.
3. **Reword the eBay line in section 5.** "past-bobblehead resale rows" reads as stored pricing data. It is
   an affiliate link on a completed-promo row.

The rest are structural and no amount of regeneration touches them: no external denominator exists for a
coverage claim, the legacy `venues` collection has no provenance to attach, the college corpus has no
completeness rubric at all, and the month curve is an artifact of our own ingestion history.

### The one thing to fix before pitching anything

The early-season promo hole in section 5 is the highest-value finding here, and it is not a reporting
problem. If roughly a third of the MLB season's inventory is genuinely missing from April to mid-June,
that is a live product gap on the most-trafficked pages, not merely a caveat on a press figure. It should
be diagnosed before any outreach that describes the corpus as thorough.
