# Search targeting rework, 2026-11

Branch `feature/serp-targeting`, rulings of 2026-11-05 (Gates 1 to 3). This file
records the deploy, every URL it changed, and the success metrics with their
pre-deploy baselines, so the 28-day read can be run without reconstructing any of it.

## Deploy

| | |
|---|---|
| Merge commit | `3c38a92` on main (branch head `037f88e`) |
| Production deployment | `dpl_Bm3DgnGGi2t378Gg1KLzQyph2reX` |
| Build started | 2026-11-05T15:47:22Z |
| Deployment READY | **2026-11-05T15:49:05Z** |
| www serving the new build | **2026-11-05T15:49:07Z** (first poll of www.getpromonight.com/venues/united-center returning the new title) |
| Rollback target | `dpl_EiDuVGB5otYtjSkzVsocucd4vtLS` (main `0373191`, the last production build before this change) |
| test:live on production | 7 of 7 guards pass, 2026-11-05 after deploy |
| IndexNow | 333 URLs (164 venue + 169 team), api.indexnow.org 200 and bing.com 200, 2026-11-05T15:53:53Z |

**The read clock starts at 2026-11-05T15:49:07Z.** The 28-day "after" window is
2026-11-06 to 2026-12-03 (the first full UTC day after the switch). A window that
straddles 2026-11-05 mixes old and new titles and is invalid.

## What changed

- **164 venue pages** (`/venues/{slug}`, verified buildings with a sourced size
  limit or a sourced bag prohibition): absolute title in the ruled bag variant, H1
  "{Venue} Bag Policy", the answer block first in page-content, one Common
  questions section with sourced quoted answers, FAQPage JSON-LD built from that
  section, a new meta description. Variants: 91 "Clear Bag Size", 72 "Bag Size",
  1 "No Bags Allowed" (truist-park). Length tiers: 68 full, 92 drop "& What's
  Allowed", 4 also drop the clear-bag term.
- **59 venue pages unchanged**, byte-identical to main in the same environment.
- **169 team pages**: absolute title "{Name} Promotional Schedule & Giveaways
  {season}" (161 full name, 8 nickname), og/twitter titles and the JSON-LD WebPage
  name follow it; 21 meta descriptions that ran 156 to 160 now drop one whole
  clause. Both title experiments (ctr-diagnostic-sep2026,
  nfl-schedule-title-sep2026) ended without a recorded read (SITE-AUDIT section 2).

Changed venue URLs (164), each `https://www.getpromonight.com/venues/{slug}`:
acrisure-bounce-house, acrisure-stadium, albertsons-stadium, allegacy-federal-credit-union-stadium, allegiant-stadium, allianz-field, alumni-stadium, american-airlines-center, american-family-field, americas-first-field, angel-stadium, arrowhead-stadium, att-stadium, audi-field, autzen-stadium, ball-arena, bank-of-america-stadium, barclays-center, bc-place, ben-hill-griffin-stadium, bmo-field, bmo-stadium, bobby-dodd-stadium, bridgestone-arena, busch-stadium, caesars-superdome, california-memorial-stadium, camden-yards, camp-randall-stadium, canada-life-centre, carter-finley-stadium, casino-del-sol-stadium, centre-bell, chase-center, chase-field, chase-stadium, childrens-mercy-park, citi-field, citizens-bank-park, climate-pledge-arena, coca-cola-coliseum, college-park-center, comerica-park, coors-field, cotton-bowl-stadium, crypto-com-arena, daikin-park, darrell-k-royal-texas-memorial-stadium, david-booth-kansas-memorial-stadium, dicks-sporting-goods-park, dignity-health-sports-park, dodger-stadium, donald-w-reynolds-razorback-stadium, empower-field, energizer-park, entertainment-sports-arena, everbank-stadium, exploria-stadium, faurot-field, fedexforum, fenway-park, firstbank-stadium, fiserv-forum, footprint-center, ford-field, gainbridge-fieldhouse, geodis-park, gerald-j-ford-stadium, gillette-stadium, globe-life-field, great-american-ball-park, guaranteed-rate-field, hard-rock-stadium, huntington-bank-field, huntington-bank-stadium, husky-stadium, jack-trice-stadium, joan-c-edwards-stadium, jones-stadium, kaseya-center, kauffman-stadium, kenan-stadium, kia-center, kidd-brewer-stadium, kinnick-stadium, kroger-field, lambeau-field, lane-stadium, levis-stadium, lincoln-financial-field, little-caesars-arena, loandepot-park, los-angeles-memorial-coliseum, lower-com-field, lucas-oil-stadium, madison-square-garden, memorial-stadium-clemson, mercedes-benz-stadium, metlife-stadium, michelob-ultra-arena, moda-center, nationals-park, nationwide-arena, neyland-stadium, nissan-stadium, northwest-stadium, notre-dame-stadium, nrg-stadium, ohio-stadium, oracle-park, paycor-stadium, petco-park, pnc-park, ppg-paints-arena, pratt-whitney-stadium-at-rentschler-field, progressive-field, providence-park, prudential-center, q2-stadium, red-bull-arena, rice-eccles-stadium, rogers-centre, rogers-place, rose-bowl-stadium, ross-ade-stadium, saban-field-at-bryant-denny-stadium, sap-center, saputo-stadium, scotiabank-saddledome, scott-stadium, secu-stadium, shell-energy-stadium, shi-stadium, smoothie-king-center, snapdragon-stadium, sofi-stadium, soldier-field, spartan-stadium-east-lansing-michigan, state-farm-arena, state-farm-stadium, subaru-park, t-mobile-arena, t-mobile-park, target-center, target-field, td-garden, tiger-stadium-louisiana, toyota-center, toyota-stadium, tql-stadium, tropicana-field, truist-park, ubs-arena, united-center, us-bank-stadium, valley-childrens-stadium, vaught-hemingway-stadium, wallace-wade-stadium, williams-brice-stadium, wintrust-arena, wrigley-field, xcel-energy-center, yankee-stadium, yulman-stadium.

Changed team URLs (169), each `https://www.getpromonight.com/{path}`:
mlb/arizona-diamondbacks, mlb/atlanta-braves, mlb/baltimore-orioles, mlb/boston-red-sox, mlb/chicago-cubs, mlb/chicago-white-sox, mlb/cincinnati-reds, mlb/cleveland-guardians, mlb/colorado-rockies, mlb/detroit-tigers, mlb/houston-astros, mlb/kansas-city-royals, mlb/los-angeles-angels, mlb/los-angeles-dodgers, mlb/miami-marlins, mlb/milwaukee-brewers, mlb/minnesota-twins, mlb/new-york-mets, mlb/new-york-yankees, mlb/oakland-athletics, mlb/philadelphia-phillies, mlb/pittsburgh-pirates, mlb/san-diego-padres, mlb/san-francisco-giants, mlb/seattle-mariners, mlb/st-louis-cardinals, mlb/tampa-bay-rays, mlb/texas-rangers, mlb/toronto-blue-jays, mlb/washington-nationals, mls/atlanta-united, mls/austin-fc, mls/cf-montreal, mls/charlotte-fc, mls/chicago-fire, mls/colorado-rapids, mls/columbus-crew, mls/dc-united, mls/fc-cincinnati, mls/fc-dallas, mls/houston-dynamo, mls/inter-miami, mls/la-galaxy, mls/lafc, mls/minnesota-united, mls/nashville-sc, mls/new-england-revolution, mls/new-york-city-fc, mls/new-york-red-bulls, mls/orlando-city, mls/philadelphia-union, mls/portland-timbers, mls/real-salt-lake, mls/san-diego-fc, mls/san-jose-earthquakes, mls/seattle-sounders, mls/sporting-kansas-city, mls/st-louis-city-sc, mls/toronto-fc, mls/vancouver-whitecaps, nba/atlanta-hawks, nba/boston-celtics, nba/brooklyn-nets, nba/charlotte-hornets, nba/chicago-bulls, nba/cleveland-cavaliers, nba/dallas-mavericks, nba/denver-nuggets, nba/detroit-pistons, nba/golden-state-warriors, nba/houston-rockets, nba/indiana-pacers, nba/los-angeles-clippers, nba/los-angeles-lakers, nba/memphis-grizzlies, nba/miami-heat, nba/milwaukee-bucks, nba/minnesota-timberwolves, nba/new-orleans-pelicans, nba/new-york-knicks, nba/oklahoma-city-thunder, nba/orlando-magic, nba/philadelphia-76ers, nba/phoenix-suns, nba/portland-trail-blazers, nba/sacramento-kings, nba/san-antonio-spurs, nba/toronto-raptors, nba/utah-jazz, nba/washington-wizards, nfl/arizona-cardinals, nfl/atlanta-falcons, nfl/baltimore-ravens, nfl/buffalo-bills, nfl/carolina-panthers, nfl/chicago-bears, nfl/cincinnati-bengals, nfl/cleveland-browns, nfl/dallas-cowboys, nfl/denver-broncos, nfl/detroit-lions, nfl/green-bay-packers, nfl/houston-texans, nfl/indianapolis-colts, nfl/jacksonville-jaguars, nfl/kansas-city-chiefs, nfl/las-vegas-raiders, nfl/los-angeles-chargers, nfl/los-angeles-rams, nfl/miami-dolphins, nfl/minnesota-vikings, nfl/new-england-patriots, nfl/new-orleans-saints, nfl/new-york-giants, nfl/new-york-jets, nfl/philadelphia-eagles, nfl/pittsburgh-steelers, nfl/san-francisco-49ers, nfl/seattle-seahawks, nfl/tampa-bay-buccaneers, nfl/tennessee-titans, nfl/washington-commanders, nhl/anaheim-ducks, nhl/boston-bruins, nhl/buffalo-sabres, nhl/calgary-flames, nhl/carolina-hurricanes, nhl/chicago-blackhawks, nhl/colorado-avalanche, nhl/columbus-blue-jackets, nhl/dallas-stars, nhl/detroit-red-wings, nhl/edmonton-oilers, nhl/florida-panthers, nhl/los-angeles-kings, nhl/minnesota-wild, nhl/montreal-canadiens, nhl/nashville-predators, nhl/new-jersey-devils, nhl/new-york-islanders, nhl/new-york-rangers, nhl/ottawa-senators, nhl/philadelphia-flyers, nhl/pittsburgh-penguins, nhl/san-jose-sharks, nhl/seattle-kraken, nhl/st-louis-blues, nhl/tampa-bay-lightning, nhl/toronto-maple-leafs, nhl/utah-hockey-club, nhl/vancouver-canucks, nhl/vegas-golden-knights, nhl/washington-capitals, nhl/winnipeg-jets, wnba/atlanta-dream, wnba/chicago-sky, wnba/connecticut-sun, wnba/dallas-wings, wnba/golden-state-valkyries, wnba/indiana-fever, wnba/las-vegas-aces, wnba/los-angeles-sparks, wnba/minnesota-lynx, wnba/new-york-liberty, wnba/phoenix-mercury, wnba/portland-fire, wnba/seattle-storm, wnba/toronto-tempo, wnba/washington-mystics.

## Baseline window and its limits

"Before" is the Search Console export for 2026-10-07 to 2026-11-03 (28 days, Web
search, all countries; the export Matt pulled on 2026-11-05, Pages, Queries and
Chart tables). Two limits decide what it can measure:

1. **Pages and Queries are separate tables.** There is no page by query join, so
   a query metric is attributed by the query's text (it names the venue), not by
   its landing page.
2. **Queries holds only queries with at least one click** (top 1,000 by clicks).
   Zero-click queries are absent, including the venue head terms: "united center
   bag policy" had impressions on our page and no click, so it is not in the file.
   Every query-level baseline below is therefore a floor.

**To make metrics 2 and 3 real, export Queries for the same window with the page
filter "URL contains /venues/"**, and the same filter for the after window. Search
Console keeps 16 months, so the before window (fixed at 2026-10-07 to 2026-11-03)
can be exported at any time. The Ahrefs Search Console connector returned no rows
for this project and window on 2026-11-05, so it is not a substitute.

## Success metrics (not head-term CTR)

Compare the before window against 2026-11-06 to 2026-12-03.

### 1. Venue-page impressions and average position

| Scope | Pages in export | Clicks | Impressions | CTR | Avg position (impression-weighted) |
|---|---|---|---|---|---|
| The 164 changed venue pages | 117 | 116 | 47,692 | 0.24% | 9.14 |
| All venue hub pages | 139 | 138 | 54,202 | 0.25% | 9.03 |

Named buildings (clicks / impressions / position): united-center 1 / 3,911 / 9.84;
wrigley-field 0 / 692 / 9.87; chase-center 0 / 61 / 10.16; target-center 3 / 2,589
/ 9.04; truist-park 2 / 2,433 / 8.48.

### 2. Clicks on long-tail bag queries (diaper, purse, backpack, concert, clutch)

Before, from the clicked-queries table (a floor, see limits):

| Topic | Query | Clicks | Impressions |
|---|---|---|---|
| diaper | audi field diaper bag policy | 1 | 6 |
| purse | braves game purse rules | 1 | 7 |
| concert | gainbridge bag policy for concerts | 2 | 43 |
| backpack | none with a click | 0 | 0 |
| clutch | none with a click | 0 | 0 |

Other clicked venue bag queries in the window: gainbridge fieldhouse bag policy
2 / 381, acrisure bounce house bag policy 2 / 65, lavell edwards stadium bag
policy 1 / 105, autzen stadium bag policy 2026 1 / 73, pacers game bag policy 1 / 2.

### 3. Non-bag venue queries (parking, gate times / what time does X open, food, smoking, cashless)

Tracked so that a loss from the bag-first titles on the 164 venues is visible.
Before, from the clicked-queries table: **one clicked non-bag venue query in 28
days**, "is camp randall cashless" (1 click, 2 impressions; camp-randall-stadium
is one of the 164). No parking, gate-time, food or smoking query naming a venue
had a click. This needs the `/venues/` filtered export to mean anything. With it,
classify each query naming one of the 164 venues by these patterns, and compare
clicks and impressions before and after, per class:

- parking: park, parking, lot
- gate times: gate, gates, what time, open, doors
- food: food, concession, eat, menu, drink
- smoking: smok, vape
- cashless: cashless, cash

A fall in non-bag clicks while bag clicks rise is the trade-off the bag-first
title makes; a fall in both is a regression.

### 4. AI Overview citations, weekly spot check

Baseline from Ahrefs SERP snapshots (US), pulled 2026-11-05:

| Query | Snapshot | AI Overview | getpromonight cited | Cited sources |
|---|---|---|---|---|
| united center bag policy | 2026-11-01 | yes | **no** (organic #9) | unitedcenter.com FAQ and premium handbook, radicalstorage, qeepl |
| wrigley field bag policy | 2026-10-30 | yes | **no** | mlb.com/cubs guide, radicalstorage, Facebook, Instagram, Pearl Jam community |
| chase center bag policy | 2026-11-02 | yes | **no** | chasecenter.com, clearbagsmarket, bagpolicies.com |
| target center bag policy | 2026-10-30 | yes | **no** | targetcenter.com (2 pages), thrillzing, bagpolicyguide, radicalstorage, Facebook, X |
| truist park bag policy | 2026-10-31 | yes | **yes** | mlb.com/braves (2 pages), radicalstorage, getpromonight.com/venues/truist-park, batteryatl, Instagram, YouTube |

Re-check weekly with the same five queries (Ahrefs serp-overview, type
`ai_overview,ai_overview_sitelink`, about 60 API units a query) and record the
snapshot date, since Ahrefs refreshes a SERP every few days rather than on demand.

### 5. Team-page CTR, the seven low-CTR teams

| Team | Clicks | Impressions | CTR | Position |
|---|---|---|---|---|
| anaheim-ducks | 88 | 10,512 | 0.84% | 7.87 |
| los-angeles-lakers | 149 | 12,025 | 1.24% | 6.58 |
| washington-capitals | 247 | 12,375 | 2.00% | 5.35 |
| los-angeles-rams | 68 | 5,689 | 1.20% | 6.74 |
| detroit-red-wings | 114 | 6,999 | 1.63% | 7.39 |
| los-angeles-kings | 100 | 5,530 | 1.81% | 7.53 |
| pittsburgh-penguins | 38 | 4,680 | 0.81% | 8.64 |
| **All seven** | **804** | **57,810** | **1.39%** | **6.92** |

CTR moves with position, so read each team's CTR at a comparable position rather
than raw: a page that drops two places loses CTR whatever its title says.

## Known data defects shipped with this change

All were live before the change and are now shown in more places. Filed for the
pipeline in `docs/ops-tickets/venue-bag-data-2026-11.md` (items 1 to 6). The web
renders the stored data faithfully; the fix is in the data.

- q2-stadium and nationwide-arena ban bags in their notes but are not stored as
  `bagsProhibited`, so the exception size renders as "Max bag size".
- audi-field and footprint-center store a `clearBagRequired: false` their source
  does not state.
- Stored `bagPolicyNotes` are the extractor's wording of the source, not the
  operator's text, and on two buildings include the extractor's own reasoning
  (truist-park, gainbridge-fieldhouse). The page quotes our field exactly and does
  not claim to quote the operator.
- t-mobile-park's storage sentence cites the wrong mlb.com page.
- Nine buildings store dimensions in a different order from their source.
