# Raptive page mix audit

Generated: 2026-08-14T16:21:56.526Z
Source: https://www.getpromonight.com/sitemap.xml
Fetch: concurrency 5, per-worker delay 300ms, cache-busting query param, UA "promonight-internal-audit/1.0 (raptive-page-mix)"

## Totals

- Total indexed URLs in sitemap: 468
- Fetched HTTP 200: 468
- Fetch or parse failures, or non-200: 0

Word counts below cover only HTTP 200 pages. Words are counted in the main content region: the first balanced <main> element if present, otherwise the document with header, nav, and footer removed. Script, style, noscript, svg, iframe, template, comments, and nested nav are always removed.

## Per route type

| route type | count | median words | mean words | min | max |
|---|---|---|---|---|---|
| mlb-team | 30 | 3761 | 3824 | 3370 | 4752 |
| nfl-team | 32 | 1019 | 1126 | 875 | 1632 |
| nba-team | 30 | 995 | 1289 | 724 | 2426 |
| nhl-team | 32 | 1847 | 1691 | 697 | 2611 |
| mls-team | 30 | 1848 | 1846 | 844 | 2799 |
| wnba-team | 15 | 1703 | 1760 | 1072 | 2748 |
| cfb-school | 86 | 300 | 305 | 231 | 402 |
| venue | 156 | 857 | 862 | 258 | 1700 |
| aggregator | 10 | 1529 | 1775 | 467 | 4391 |
| hub | 7 | 1005 | 1017 | 698 | 1434 |
| other | 40 | 150 | 376 | 130 | 5416 |

## Word count thresholds (all HTTP 200 pages)

- At or above 1000 words: 198 of 468 (42.3%)
- At or above 1500 words: 107 of 468 (22.9%)

## Ten lowest word-count pages

| url | words | route type |
|---|---|---|
| https://www.getpromonight.com/cfb/rivalries/deep-souths-oldest-rivalry | 130 | other |
| https://www.getpromonight.com/cfb/rivalries/heroes-trophy | 131 | other |
| https://www.getpromonight.com/cfb/rivalries/old-oaken-bucket | 133 | other |
| https://www.getpromonight.com/cfb/rivalries/land-of-lincoln-trophy | 133 | other |
| https://www.getpromonight.com/cfb/rivalries/big-game | 134 | other |
| https://www.getpromonight.com/cfb/rivalries/cy-hawk-trophy | 135 | other |
| https://www.getpromonight.com/cfb/rivalries/clean-old-fashioned-hate | 136 | other |
| https://www.getpromonight.com/download | 139 | other |
| https://www.getpromonight.com/cfb/rivalries/governors-cup | 141 | other |
| https://www.getpromonight.com/cfb/rivalries/florida-georgia | 143 | other |

## Byline, date, and schema signals (all HTTP 200 pages)

- Visible author byline present: 0 (0.0%)
- Visible labeled published or updated date present: 107 (22.9%)
- Any <time> element with text in main content: 0 (0.0%)
- Person schema in JSON-LD: 1 (0.2%)
- Article-family schema in JSON-LD (Article, NewsArticle, BlogPosting, etc.): 3 (0.6%)

## Template similarity

Method: random sample of up to 5 pages per group (seeded PRNG, seed 42); actual sample and pair counts are reported per row. Sentences are extracted from main content, lowercased, stripped of punctuation, and deduplicated; sentences under 5 words are dropped. Reported numbers are the mean pairwise Jaccard overlap across all sampled page pairs, as a percentage. Two measures: exact shared sentences, and shared word 5-grams drawn from those sentences.

| group | pages sampled | pairs | shared sentences | shared word 5-grams | sampled pages |
|---|---|---|---|---|---|
| venue | 5 | 10 | 4.9% | 3.0% | /venues/empower-field, /venues/nationals-park, /venues/everbank-stadium, /venues/progressive-field, /venues/williams-stadium |
| cfb-school | 5 | 10 | 16.6% | 26.1% | /cfb/san-diego-state, /cfb/utah, /cfb/kentucky, /cfb/kansas-state, /cfb/memphis |

## Route classifier map

| pattern | route type |
|---|---|
| /mlb/{slug} | mlb-team |
| /nfl/{slug} | nfl-team |
| /nba/{slug} | nba-team |
| /nhl/{slug} | nhl-team |
| /mls/{slug} | mls-team |
| /wnba/{slug} | wnba-team |
| /cfb/{slug} except /cfb/rivalries | cfb-school |
| /venues/{slug} | venue |
| /promos/{slug}, /best-promos, /best-promos/{slug}, /team-rankings | aggregator |
| /mlb, /wnba, /mls, /nfl, /cfb, /teams, /venues | hub |
| everything else (homepage, legal, /follow, /download, /world-cup, /cfb/rivalries and matchup pages) | other |

## CONTENT MEASUREMENT BOUNDARY: 2026-08-14T16:20:33Z (data-only tier deploy READY; created 16:17:35Z)

The numbers above are the POST-tier baseline, regenerated same-day after the
feature/data-only-content-tier deploy (merge 3088cfa). Word counts, route
medians, and similarity figures are not comparable across this instant:
venue pages gained the rendered dark inventory (raw median 712 to 857, max
1467 to 1700), CFB school pages gained schedule fields (267 to 300), rivalry
pages gained ledes, and synthetic dateModified stamps disappeared sitewide.
Companion corrected baseline (visible unique words, the honest planning
number): audit/raptive-page-mix-visible.md, sitewide 1000+ = 177 of 468
(37.8 percent), up from 150 pre-tier. Venue similarity gate at this
boundary: 4.03 percent on the drift-stable 12-page sample (was 4.69
pre-tier). This boundary sits alongside the 2026-08-14T14:33:38Z affiliate
sub-ID boundary and the same-instant bobbleheads page_view surface boundary
(audit/affiliate-attribution-audit.md addendum) and the 2026-08-07T16:59:27Z
analytics measurement step-up. NOTE: regenerating this file with
audit/raptive-page-mix.ts overwrites this section; re-append it (the
canonical record also lives in the 3088cfa merge and this commit).
