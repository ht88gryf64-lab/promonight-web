# Raptive page mix, visible unique words

Generated: 2026-08-14T16:21:55.802Z
Sibling of audit/raptive-page-mix.ts; raw counts use the identical method for comparability.
Corrections applied here: 4+ word text segments deduplicated within each document; seasonal in-week promo rails (section aria-labelledby promos-this-week / {league}-this-week / {league}-today) measured separately and excluded from the corrected count. JSON-LD is stripped before counting in BOTH scripts, so it never inflated word counts.

Total sitemap URLs 468; HTTP 200 468; failures 0.

## Per route type

| route type | count | raw median | unique median | dup delta median | rail median | corrected median | corrected mean |
|---|---|---|---|---|---|---|---|
| mlb-team | 30 | 3761 | 3084 | 689 | 0 | 3084 | 3092 |
| nfl-team | 32 | 1019 | 1019 | 0 | 0 | 1019 | 1118 |
| nba-team | 30 | 995 | 976 | 43 | 0 | 976 | 1200 |
| nhl-team | 32 | 1847 | 1658 | 199 | 0 | 1658 | 1520 |
| mls-team | 30 | 1848 | 1621 | 229 | 0 | 1621 | 1614 |
| wnba-team | 15 | 1703 | 1510 | 223 | 0 | 1510 | 1540 |
| cfb-school | 86 | 300 | 300 | 0 | 0 | 300 | 305 |
| venue | 156 | 857 | 819 | 32 | 0 | 786 | 789 |
| aggregator | 10 | 1529 | 1316 | 253 | 0 | 1316 | 1469 |
| hub | 7 | 1005 | 998 | 49 | 159 | 789 | 865 |
| other | 40 | 150 | 150 | 0 | 0 | 150 | 373 |

## Sitewide thresholds

- Raw (original method): >=1000 198 of 468 (42.3%); >=1500 107 (22.9%)
- Unique (deduped, rails included): >=1000 189 (40.4%); >=1500 92 (19.7%)
- Corrected (deduped, rails excluded; off-season baseline): >=1000 177 (37.8%); >=1500 92 (19.7%)

## Rail (seasonal) words per route type

| route type | pages with a rail | rail words median (those pages) | rail words max |
|---|---|---|---|
| venue | 52 | 71 | 648 |
| hub | 4 | 194 | 360 |
