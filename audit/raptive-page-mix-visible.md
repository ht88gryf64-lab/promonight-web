# Raptive page mix, visible unique words

Generated: 2026-08-14T15:36:05.522Z
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
| cfb-school | 86 | 267 | 267 | 0 | 0 | 267 | 272 |
| venue | 156 | 712 | 676 | 32 | 0 | 640 | 639 |
| aggregator | 10 | 1532 | 1318 | 253 | 0 | 1318 | 1472 |
| hub | 7 | 1005 | 998 | 49 | 159 | 789 | 865 |
| other | 40 | 121 | 121 | 0 | 0 | 121 | 350 |

## Sitewide thresholds

- Raw (original method): >=1000 161 of 468 (34.4%); >=1500 104 (22.2%)
- Unique (deduped, rails included): >=1000 156 (33.3%); >=1500 91 (19.4%)
- Corrected (deduped, rails excluded; off-season baseline): >=1000 150 (32.1%); >=1500 91 (19.4%)

## Rail (seasonal) words per route type

| route type | pages with a rail | rail words median (those pages) | rail words max |
|---|---|---|---|
| venue | 52 | 71 | 648 |
| hub | 4 | 194 | 360 |
