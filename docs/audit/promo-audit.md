# NBA + NHL promo audit vs official team pages, Phase 1 (2026-10-21)

Scope: Batch A (pitch pipeline) and Batch B (Phase 0 thin, zero-giveaway and stale-content clubs). Read-only. No Firestore writes.
Ours = Firestore rows dated 2026-07-01 or later, not tombstoned, not postseason (read 2026-10-21). Rows dated before today that rolled off an official page are noted as past, not as OURS ONLY.
Official = the club's own page as rendered (Firecrawl, browser timezone America/New_York).

Method warning: the raw server HTML of nba.com/timberwolves/promotions prints evening game dates one day late (UTC pre-render: Thu Oct 29 vs GSW where the rendered page and the league schedule both say Wed Oct 28). Fetch 1 (raw curl) showed 45 false date conflicts; fetch 2 (rendered) cleared them. Any check against nba.com club pages must use the rendered page.

Press CSV: /tmp/press/press_promos.csv did not exist at any check (start of Phase 1, after fetch 10, after fetch 32). Press-only cross-check NOT done.

Verdict key: CONFLICTS = a date, opponent or item we publish disagrees with the official page, including a purchase-only or itemless night published as a free giveaway. GAPS = official items we lack. CLEAN = every current row matches and nothing material is missing.

## Verdicts

### Batch A
- minnesota-timberwolves: CONFLICTS. AAPI Night + AAPI Baseball Jersey pack: official 2027-01-31 vs PHX, ours 2027-02-26 vs Pacers. 53 of 58 matched.
- minnesota-wild: CLEAN. 17 of 17 current rows match; the club itself publishes only 5 giveaways. Note: all 15 pack rows cite giveaway-schedule, but packs live on promotional-nights.
- los-angeles-lakers: CLEAN. 11 of 11.
- atlanta-hawks: GAPS. Ted Turner Bobblehead CONFIRMED on the release ("Wednesday, March 3 ... the Bulls"), matches ours 2027-03-03. Missing: 2 Cup Nights (11-06 WAS, 11-20 CHA); Black Excellence T-shirt not rowed as a giveaway.
- dallas-stars: GAPS. Missing Hello Kitty pack (02-08) and 2 early-arrival giveaways; one duplicate First Responders hat pack row.
- detroit-red-wings: GAPS. 84 of 90. Missing Star Wars Night theme (10-29), Family Day (12-20) and Union Day (02-21) offers; St. Patrick's Day Tailgate (03-12) is a ticket offer, ours shows a plain theme night.
- washington-capitals: CONFLICTS. Caps Holiday Party 12-17 and 12-19 typed giveaway with no item. 9 dated special ticket offers missing. All 31 nights match.
- tampa-bay-lightning (Gasparilla only): CONFLICTS. Ours "Rangers"; official card names no opponent (link slug "new-york"); NHL schedule says Islanders 2027-01-30.

### Batch B
- vegas-golden-knights: GAPS. A separate official giveaway source exists (2026-09-01 on-sale article); 4 upcoming giveaways missing (12-16, 02-13, 03-15, 04-10). Not repointed.
- calgary-flames: NO VERDICT (discovery only). No separate giveaway page found.
- colorado-avalanche: NO VERDICT (discovery only). No official giveaway page found.
- seattle-kraken: CLEAN. 6 of 6.
- boston-bruins: CLEAN. 10 of 10 (club page is theme-only).
- edmonton-oilers: CLEAN. 13 of 13 (release is theme-only).
- new-york-rangers: CONFLICTS. Essential Workers Night moved by the club: official 2027-03-18 vs Maple Leafs, ours 2027-03-21 vs Capitals.
- carolina-hurricanes: GAPS. 10 ticket packages missing; all nights match.
- florida-panthers: GAPS. 9 of 13 ticket packages missing; all theme nights match.
- denver-nuggets: GAPS. 2 ticket packages missing (11-04, 02-11).
- indiana-pacers: CLEAN. 14 of 14.
- toronto-raptors: GAPS. 2 Raptors Cup nights missing (10-30, 11-27).
- dallas-mavericks: GAPS. 19 of 19 theme nights match; 6 Promotions-filter items missing (incl. Coop Bobble Pack), dates hidden behind expanders. Page needs a render wait (first fetch returned "Loading games").
- orlando-magic: CLEAN. 19 of 19.
- houston-rockets: CONFLICTS. Space Jam jersey (11-23) is a ticket bundle, ours a giveaway.
- boston-celtics: CLEAN. 25 of 25.
- anaheim-ducks: CONFLICTS. Getzlaf Jersey Retirement (01-30) typed giveaway with no item; Jewish Heritage Pack (12-06) not on the cited page; 6 packs missing.
- columbus-blue-jackets: GAPS. 1 theme night and 6 ticket packages missing; every row we carry matches.
- pittsburgh-penguins: CONFLICTS. Holiday Sweater Game (12-22) typed giveaway with no item; 6 ticket packages missing.
- winnipeg-jets: CLEAN. 28 of 28 (note: 12-20 season-ticket-member giveaway typed as a general giveaway).

### Deferred (withheld by config, show zero promos, not audited)
NHL: toronto-maple-leafs, utah-hockey-club, vancouver-canucks. NBA: brooklyn-nets, los-angeles-clippers, miami-heat, new-york-knicks, oklahoma-city-thunder, philadelphia-76ers, portland-trail-blazers, san-antonio-spurs, utah-jazz, washington-wizards.

### Not covered this phase
Active clubs outside Batch A and the Phase 0 flags (not fetched).

## Patterns across clubs
1. Itemless or purchase-only nights typed as giveaways (5 rows: Caps x2, Ducks, Penguins, Rockets). Each inflates a club's giveaway count; the Rockets row presents a ticket-bundle jersey as free.
2. NHL ticket packages under-captured (Carolina 10, Florida 9, Caps 9, CBJ 6, Penguins 6, Ducks 6). Theme and gate-giveaway rows are complete on every one of these pages.
3. A club-side move not yet picked up (Rangers, after the 10-16 scan).

## Usage
Fetches: 32 of 40 (log below). Plus 1 approved own-page GET of /nhl/minnesota-wild, not counted.
Firecrawl credits: 34 (28 scrapes x 1, 3 searches x 2). Fetch 1 was a plain curl, 0 credits.

## Own-page check (closed)
/nhl/minnesota-wild served HTML (date: 2026-10-21 04:15:42 GMT, x-vercel-cache HIT): "Team Calendar Giveaway" renders under "Already happened / COMPLETED 2026-27 PROMOS / 1 completed event this season", labelled Completed. False alarm, no fix.

## Detail: Batch A clubs diffed by script
### minnesota-timberwolves (fetch 1 raw, fetch 2 rendered)
MATCHED 53. CONFLICTS: _id abaf30d2ea60f360 AAPI Night and _id 74a2edeab2402184 AAPI Baseball Jersey (pack): ours 2027-02-26 vs Pacers, official Sunday January 31 5 PM vs PHX (spine has a PHX home game 01-31). OFFICIAL ONLY: 2026-12-04 NBA Cup Game vs TBD (placeholder). CATEGORY: 2027-02-07 Lunch Box (official giveaway, first 5,000 kids; ours kids type, not counted as giveaway); 2027-02-28 KG Theme Night: Jersey Retirement (official celebration; ours typed giveaway, the KG Tee row is the giveaway).
### minnesota-wild (fetches 3, 4)
MATCHED 17 (5 giveaways + 12 packs). OURS ONLY: past packs rolled off the page: 10-12 SpongeBob, 10-15 Educator Appreciation, 10-18 Hockey Fights Cancer. Provenance: pack rows cite https://www.nhl.com/wild/fans/giveaway-schedule; the packs are on https://www.nhl.com/wild/tickets/promotional-nights.
### los-angeles-lakers (fetch 5)
MATCHED 11. OURS ONLY: past 2026-10-08 LGBTQ+ Pride Night with Pride T-Shirt (preseason).
### atlanta-hawks (fetch 6)
MATCHED 18. OFFICIAL ONLY: 2026-11-06 Cup Night vs WAS; 2026-11-20 Cup Night vs CHA; 2027-02-01 Black Excellence Night T-shirt (all fans), present only in the theme row description.
### detroit-red-wings (fetch 8)
MATCHED 84 of 90. OFFICIAL ONLY: 2026-10-29 Star Wars Night (theme); 2026-12-20 Family Day (offer); 2027-02-21 Union Day (offer); past: 09-24 Pickleball Paddle, 10-02 Original Six Matchup. CATEGORY: _id 8b53cb8f382044e3 2027-03-12 St. Patrick's Day Tailgate, official special ticket offer, ours theme with ticketPackageRequired null.

## Detail: hand-diffed clubs
## dallas-stars (fetch 7, https://www.nhl.com/stars/tickets/promotional-schedule)
Official upcoming cards: 25 dated + College Nights (multiple dates, undated on page). Ours current: 33 (28 upcoming).
MATCHED: 27
OFFICIAL ONLY:
- 2027-02-08 vs LAK | Hello Kitty ticket offer (co-branded item) | pack
- 2026-11-12 vs WPG | military themed hats, limited, early arrivals (on Military Appreciation Night card) | giveaway, not rowed
- 2027-01-12 vs OTT | Western Night themed giveaway, early arrivals, courtesy of Visit Fort Worth | giveaway, not rowed
OURS ONLY:
- 2026-10-27 | First Responders Co-Branded Hat | pack | opponent "New Jersey Devils" | duplicate of "First Responders Hat" (same card, second row)
- 2027-02-16 | Anime Night | theme, NOT pack | official has only the Anime Night ticket bundle (we also have the pack row)
- past, rolled off page: 2026-10-02 Home Opener + Magnet Schedule, 10-05 Scout Night Hat, 10-13 Teacher Appreciation Hat, 10-13 Hockey Fights Cancer Night
CONFLICTS: none
## washington-capitals (fetch 9, https://www.nhl.com/capitals/tickets/promotions)
Official upcoming: 31 dated nights (Oct 24 to Apr 3) + 9 dated special offers + College Series (undated). Ours current: 45 (40 upcoming incl. theme+giveaway pairs).
MATCHED: all 31 nights and their giveaways
OFFICIAL ONLY (special ticket offers, pack): 10-24 Oktoberfest Stein (BUF); 11-01 Stick Tape (MIN, sold out); 11-03 Long Sleeve Shirt (DAL); 01-04 Canines Treat Bag (TOR); 01-14 Hometown Remix Cowboy Hat (CAR); 01-19 Pride Tank Top (MTL); 01-22 Beach Towel (NYI); 02-16 Dylan Strometrooper Bobblehead (ANA); 03-23 Cherry Blossom Hat (DET)
OURS ONLY: past rows only (10-07 Home Opener + Schedule Magnet, 10-14, 10-17, 10-20)
CATEGORY: 2026-12-17 (DET) and 2026-12-19 (STL) "Caps Holiday Party" typed giveaway; official card names no item (theme night)
## tampa-bay-lightning, Gasparilla only (fetch 10, https://www.nhl.com/lightning/community/theme-nights)
Official card: "Gasparilla Night", Saturday, January 30 at 7:00 PM. No opponent in the card text. Ticket link slug: tampa-bay-lightning-vs-new-york-tampa-florida-01-30-2027 ("new-york", ambiguous).
Ours: 2027-01-30 | Gasparilla Night | opponent "Rangers" | source theme-nights.
NHL schedule spine: nhl-2027-01-30-new-york-islanders-at-tampa-bay-lightning.
CONFLICT: our "Rangers" is not supported by the official page; schedule says Islanders. Correction candidate: opponent -> Islanders (awaiting approval).
Side note: the page's own Thanksgiving card reads "Sunday, November 25"; Nov 25 2026 is a Wednesday (club typo, our row is 11-25).
## Batch B discovery: theme-only NHL clubs (report only, no repointing)
- calgary-flames (search, fetch 11): no separate giveaway page found on nhl.com. Only other surface is /flames/tickets/game-theme-schedule (config DO-NOT-USE). Verdict: no giveaway source exists.
- colorado-avalanche (search, fetch 12): no official giveaway page found. avalanchetix.com/group-theme-nights is the only official promo surface returned; a third-party (Yahoo) mention of a "Book Night" ticket series has no official URL in results. Verdict: no giveaway source found.
- vegas-golden-knights (search 13 + fetch 14): SEPARATE GIVEAWAY SOURCE EXISTS. https://www.nhl.com/goldenknights/news/single-game-tickets-for-2026-27-season-on-sale-now lists the "first drop" of giveaways (first 10,000 fans):
  09-24 UTA schedule magnet (pre, past); 09-29 CHI Season X patch (past); 10-10 LAK commemorative puck (past);
  2026-12-16 SJS Vegas Born hat; 2027-02-13 CGY Misfits to Champions key chain; 2027-03-15 WPG player bobblehead; 2027-04-10 LAK Viewfinder.
  Also a special ticket offers page: https://www.nhl.com/goldenknights/tickets/special-ticket-offers (Noche de los VGK 10-27, Kids 11-28, Country 12-03, Holiday, Firefighter 01-07, Healthcare 01-09, AFC Bournemouth, Hello Kitty, UNLV 04-02).
  Ours: 0 giveaways. OFFICIAL ONLY: the 4 upcoming giveaways above. Club says more giveaways will be announced.
## seattle-kraken (fetch 15): 6/6 upcoming matched; 10-04 Charcuterie Board past. CLEAN. Club lists only 6 giveaways.
## boston-bruins (fetch 16): 10/10 matched. CLEAN. Page is theme nights only, no giveaway list.
## edmonton-oilers (fetch 17): 13/13 matched. CLEAN. Release lists theme games only.
## new-york-rangers (fetch 18, https://www.nhl.com/rangers/tickets/theme-nights)
MATCHED: 11 (theme + group nights; 10-11, 10-13 past rolled off)
CONFLICT: Essential Workers Night. Official: Thursday, March 18, 7:00 PM ET vs Maple Leafs (spine: 2027-03-18 TOR home). Ours: _id 0f01530524b1bb56 | 2027-03-21 | vs Capitals | 8:00 PM | description "when the Rangers face the Capitals". Club moved the night; our row is stale.
CATEGORY: Law Enforcement 11-05, Firefighter 11-30, Healthcare 01-25 are Group Nights; the tumbler/tote is for group ticket purchasers only. Ours: plain theme rows (no item claimed), acceptable.
Page H1 reads "2025-26 ... Theme Night Schedule" over 2026-27 dates (club error).
## carolina-hurricanes (fetch 19): theme + community nights 18/18 matched (09-29, 10-02 past). GAPS.
OFFICIAL ONLY (ticket packages, exclusive Canes item): 2026-10-27 BOS Sports Girls Club; 10-29 CBJ Grateful Dead; 12-03 CBJ Fourth Wing; 12-08 NYR Chanukah; 2027-01-05 STL Star Wars; 01-15 PHI Mystery Bag; 01-30 LAK Sports Romance Book Fair; 02-09 COL Snoopy; 03-07 UTA Challenge Coin; 03-12 CGY Margaritaville.
## florida-panthers (fetch 20): theme nights all matched (10-10, 10-15, 10-17 x3 past). Packages: 4 of 13 matched (First Responder, Salt & Pepper, Fourth Wing, Book Club). GAPS.
OFFICIAL ONLY (packages): 2026-10-30 WPG Jerry Garcia; 11-04 CHI Star Wars Night package (we have the theme row only); 11-12 DET Military Appreciation package; 12-10 PIT Hanukkah; 12-21 STL Naruto; 2027-01-24 LAK FSU Alumni; 02-13 DAL UF Alumni; 02-18 NJD UM Alumni; 04-06 MTL Squishy Dumpling.
## denver-nuggets (fetch 21): 12/12 theme nights matched. GAPS.
OFFICIAL ONLY (ticket packages): 2026-11-04 TOR Grateful Dead Ticket Package; 2027-02-11 CHI Serbian Heritage Ticket Package. "Book Nights: Coming Soon" (undated). Page lists no giveaways.
## indiana-pacers (fetch 22): 14/14 matched (6 Lucas Oil Family Night packs + 8 theme). CLEAN.
## toronto-raptors (fetch 23): 15/15 matched. GAPS (minor).
OFFICIAL ONLY: 2026-10-30 ORL Raptors Cup (NBA Cup group stage night); 2026-11-27 BKN Raptors Cup.
## dallas-mavericks (fetches 24, 25; first render empty "Loading games", second with 8s wait)
Theme nights: 19/19 matched (all special-ticket flags agree).
OFFICIAL ONLY (Promotions filter; per-game dates are behind "Expand for details", not in rendered text): Home Opener; Filipino Group Night; Educator Appreciation Group Night; Fourth Wing Ticket Pack (special ticket); Coop Bobble Pack: Rookie of the Year Edition (special ticket); Native American Group Night. Cards show "2 Promotions Available" on 11-08 BKN and "1 Promotion Available" on 12-26 PHX. GAPS; dates need an expanded-card read to row.
## orlando-magic (fetch 26): 19/19 matched (3 past). CLEAN.
## houston-rockets (fetch 27): 29/29 dates matched. CONFLICTS (item type).
CONFLICT: _id 889d34a679406dc0 | 2026-11-23 LAC | "Space Jam 30th Anniversary Commemorative Jersey" | ours type giveaway, ticketPackageRequired false | official: "a ticket bundle that includes a commemorative jersey" (purchase-only). Shown as a free giveaway.
CATEGORY: _id 5f0fe99d4b854618 | 2026-10-26 ATL | Filipino Heritage Night | official: bucket hat as part of the ticket offer; ours theme, not flagged pack (no item claimed in type, description correct).
OFFICIAL ONLY (minor): 2027-01-29 ORL "Rodeo Night" theme name (we have the bolo tie giveaway row).
## washington-capitals addendum: Holiday Party rows _id 2a642e3d12627214 (12-17) and a26375abc8bdbb17 (12-19) are type giveaway with description "Holiday-themed game" and no item: counted in the giveaway tally with no giveaway on the official page. Reclassified as CONFLICTS (item).
## boston-celtics (fetch 28): 21 specialty nights + 4 bobbleheads, 25/25 matched. CLEAN.
## anaheim-ducks (fetch 29, https://www.nhl.com/ducks/fans/promotional-schedule): all dated nights, giveaways and kids' socks dates matched. CONFLICTS (item).
CONFLICT: _id 7a6f1e2b941bfd3d | 2027-01-30 NSH | "Ryan Getzlaf No. 15 Jersey Retirement" | ours type giveaway, no item | official: theme night, not in the page's 19-night Giveaway Games list.
OURS ONLY: _id 56ba2f9ded977aec | 2026-12-06 WPG | Jewish Heritage Pack (scarf) | cites promotional-schedule, not on that page (may be on /ducks/fans/promo-packs, not fetched).
OFFICIAL ONLY (packs): 11-11 NSH Military Wearable Pack; 12-01 MIN Jackson LaCombe "Inspired by Captain America" bobble pack; 12-16 VAN Naruto x ADHC Hoodie Ticket Pack; 2027-01-01 NJD Wild Wing "Inspired by Dr. Doom" bobble pack; 03-16 CAR Beckett Sennecke "Inspired by the Human Torch" bobble pack; 03-30 COL Star Wars Button-Up Pack. Merch drops (not promos): 10-27 Los Patos, 12-22 Peanuts, Puck Punks.

## Fetch log
1 timberwolves curl https://www.nba.com/timberwolves/promotions
2 timberwolves firecrawl(1cr) https://www.nba.com/timberwolves/promotions
3 wild firecrawl(1cr) https://www.nhl.com/wild/fans/giveaway-schedule
4 wild firecrawl(1cr) https://www.nhl.com/wild/tickets/promotional-nights
5 lakers firecrawl(1cr) https://www.nba.com/lakers/promo-nights-and-giveaways
6 hawks firecrawl(1cr) https://www.nba.com/hawks/news/hawks-announce-2026-27-promotional-schedule-featuring-15-signature-theme-nights
7 stars firecrawl(1cr) https://www.nhl.com/stars/tickets/promotional-schedule
8 red-wings firecrawl(1cr) https://www.nhl.com/redwings/tickets/promotions
9 capitals firecrawl(1cr) https://www.nhl.com/capitals/tickets/promotions
10 lightning firecrawl(1cr) https://www.nhl.com/lightning/community/theme-nights
11 calgary firecrawl-search(2cr) "Calgary Flames 2026-27 giveaways schedule" site nhl.com
12 colorado firecrawl-search(2cr) "Colorado Avalanche 2026-27 promotional schedule giveaways"
13 vegas firecrawl-search(2cr) "Vegas Golden Knights 2026-27 giveaway schedule" site nhl.com
14 vegas firecrawl(1cr) https://www.nhl.com/goldenknights/news/single-game-tickets-for-2026-27-season-on-sale-now
15 seattle firecrawl(1cr) https://www.nhl.com/kraken/tickets/giveaways
16 boston firecrawl(1cr) https://www.nhl.com/bruins/fans/promotions-schedule
17 edmonton firecrawl(1cr) https://www.nhl.com/oilers/news/release-oilers-announce-2026-27-promotional-schedule
18 rangers firecrawl(1cr) https://www.nhl.com/rangers/tickets/theme-nights
19 carolina firecrawl(1cr) https://www.nhl.com/hurricanes/tickets/promotional-schedule
20 florida firecrawl(1cr) https://www.nhl.com/panthers/tickets/theme-nights
21 denver firecrawl(1cr) https://www.nba.com/nuggets/promotional-schedule
22 indiana firecrawl(1cr) https://www.nba.com/pacers/tickets/theme-nights
23 raptors firecrawl(1cr) https://www.nba.com/raptors/theme-nights
24 mavs firecrawl(1cr) https://www.nba.com/mavs/tickets/single?theme=all (rendered empty: Loading games)
25 mavs firecrawl(1cr, waitFor 8s) https://www.nba.com/mavs/tickets/single?theme=all
26 orlando firecrawl(1cr) https://www.nba.com/magic/theme-nights
27 rockets firecrawl(1cr) https://www.nba.com/rockets/news/rockets-announce-2026-27-promotions-and-fan-experiences
28 celtics firecrawl(1cr) https://www.nba.com/celtics/news/press-release-20260930-boston-celtics-announce-2026-27-specialty-night-schedule-and-bobblehead-series
29 ducks firecrawl(1cr) https://www.nhl.com/ducks/fans/promotional-schedule
30 cbj firecrawl(1cr) https://www.nhl.com/bluejackets/tickets/promotional-calendar
31 penguins firecrawl(1cr) https://www.nhl.com/penguins/tickets/promotional-schedule
32 jets firecrawl(1cr) https://www.nhl.com/jets/info/promo-schedule

## pittsburgh-penguins (fetch 31)
All theme nights and gate giveaways matched. CONFLICT: 2026-12-22 Holiday Sweater Game, ours type giveaway, official Theme Night with no item. OFFICIAL ONLY (packs): 10-24 Scout Night (patch); 10-24 Girl Scout Night (patch); 11-05 Military Appreciation T-Shirt; 11-19 Hockey Fights Cancer Wearable; 2027-01-12 First Responders Insulated Bottle; 01-23 Sports Matter Game. Undated monthly packs: Oktoberfest Stein (Oct), Zamboni Gravy Boat (Nov), Iceburgh Nutcracker (Dec).
## winnipeg-jets (fetch 32)
28 of 28 matched (10-02, 10-17 past). Note: 2026-12-20 "Season Ticket Member Appreciation & Jerseys Off Our Backs" typed giveaway; official giveaways are for season ticket members.
## columbus-blue-jackets (fetch 30)
All rows we carry matched. OFFICIAL ONLY: 2027-03-13 SJS For Those About to Yacht (theme); packs: 2026-12-12 MTL Educator Appreciation, 12-12 MTL Brunch & Bingo, 2027-01-02 BOS Healthcare Appreciation, 01-02 BOS Girl Scouts, 02-27 NYI Scouts, 02-27 NYI Skate & Stretch.
