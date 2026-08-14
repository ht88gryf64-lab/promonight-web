# Raptive page mix audit

Generated: 2026-08-14T14:51:17.262Z
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
| cfb-school | 86 | 267 | 272 | 201 | 376 |
| venue | 156 | 712 | 712 | 250 | 1437 |
| aggregator | 10 | 1532 | 1778 | 472 | 4396 |
| hub | 7 | 1005 | 1017 | 698 | 1434 |
| other | 40 | 121 | 352 | 101 | 5420 |

## Word count thresholds (all HTTP 200 pages)

- At or above 1000 words: 161 of 468 (34.4%)
- At or above 1500 words: 104 of 468 (22.2%)

## Ten lowest word-count pages

| url | words | route type |
|---|---|---|
| https://www.getpromonight.com/cfb/rivalries/deep-souths-oldest-rivalry | 101 | other |
| https://www.getpromonight.com/cfb/rivalries/heroes-trophy | 102 | other |
| https://www.getpromonight.com/cfb/rivalries/big-game | 103 | other |
| https://www.getpromonight.com/cfb/rivalries/old-oaken-bucket | 105 | other |
| https://www.getpromonight.com/cfb/rivalries/clean-old-fashioned-hate | 105 | other |
| https://www.getpromonight.com/cfb/rivalries/cy-hawk-trophy | 105 | other |
| https://www.getpromonight.com/cfb/rivalries/land-of-lincoln-trophy | 105 | other |
| https://www.getpromonight.com/cfb/rivalries/florida-georgia | 113 | other |
| https://www.getpromonight.com/cfb/rivalries/governors-cup | 114 | other |
| https://www.getpromonight.com/cfb/rivalries/sunflower-showdown | 115 | other |

## Byline, date, and schema signals (all HTTP 200 pages)

- Visible author byline present: 0 (0.0%)
- Visible labeled published or updated date present: 114 (24.4%)
- Any <time> element with text in main content: 0 (0.0%)
- Person schema in JSON-LD: 1 (0.2%)
- Article-family schema in JSON-LD (Article, NewsArticle, BlogPosting, etc.): 3 (0.6%)

## Template similarity

Method: random sample of up to 5 pages per group (seeded PRNG, seed 42); actual sample and pair counts are reported per row. Sentences are extracted from main content, lowercased, stripped of punctuation, and deduplicated; sentences under 5 words are dropped. Reported numbers are the mean pairwise Jaccard overlap across all sampled page pairs, as a percentage. Two measures: exact shared sentences, and shared word 5-grams drawn from those sentences.

| group | pages sampled | pairs | shared sentences | shared word 5-grams | sampled pages |
|---|---|---|---|---|---|
| venue | 5 | 10 | 5.8% | 3.4% | /venues/empower-field, /venues/nationals-park, /venues/everbank-stadium, /venues/progressive-field, /venues/williams-stadium |
| cfb-school | 5 | 10 | 18.6% | 26.8% | /cfb/san-diego-state, /cfb/utah, /cfb/kentucky, /cfb/kansas-state, /cfb/memphis |

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
