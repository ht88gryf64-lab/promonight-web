# Zero-promo discovery and NBA coverage audit, 2026-10-24

READ-ONLY. No Firestore writes, no team-config edits, no scanner runs, no issue
comments. Evidence for every row is in `docs/discovery-2026-10-24/evidence/`
(one JSON per team, plus `phase0-inventory.json` and `phase3-verification.json`).

## 1. Headline

**Counts per label**

| League | Scope | RECOVERED | THIN | BORDERLINE | GENUINELY-NONE | UNDERCOUNT | MATCH | OVER |
|---|---|---|---|---|---|---|---|---|
| NFL | 5 zero-promo clubs | 2 | 2 | 1 | 0 | n/a | n/a | n/a |
| NHL | 3 zero-promo clubs | 0 | 1 | 1 | 1 | n/a | n/a | n/a |
| NBA | all 30 clubs | 5 | 4 | 0 | 1 | 3 | 16 | 1 |

No team in any league got PUBLISHED-UNDATED as its label. Teams not reached: none.

**Top 5 by fix value**

Known GSC demand exists only for the Knicks (from the brief). The Ahrefs GSC
export for getpromonight.com is sampled and unusable for ranking: it shows the
Knicks page at 4 clicks over the same window where Search Console shows 1,137.
So items 2 to 5 are ranked by recoverable dated rows.

1. **New York Knicks** (NBA). The page has 1,137 clicks and ranks 1.85 for "knicks promotional schedule 2026", but shows 0 promos. The official site lists 7 dated 2026-27 nights, all one recurring food deal (Popcorn TWOsday, $2 popcorn every Tuesday home game). It lists no giveaways and no theme nights. Fix: add the deal, and replace the empty-state copy with copy that is true for this club (section 2).
2. **San Antonio Spurs** (NBA). 25 open dated nights, plus 21 that need a ticket package. Our count is 0. The configured URL now serves the slate. Note that the club was held deliberately on 2026-10-13 by the OPS coverage pass over its ticket-package wording, so the fix is a ruling, not a discovery. This resolves issue #54.
3. **Portland Trail Blazers** (NBA). 16 dated nights in the club's 2026-10-14 article. Our count is 0, and no URL is configured. This resolves issue #66.
4. **Washington Wizards** (NBA). 9 open giveaway rows and 45 ticket-package rows on 25 dated home nights. Our count is 0. This club was also held deliberately on 2026-10-13 over the bundle wording. This resolves issue #55.
5. **New Orleans Saints** (NFL). 7 dated items (3 of them giveaways) across one "Gameday Guide" news article per home game. Our count is 0. No fixed page carries them, so the source is news discovery.

## 2. Knicks

**Does any official source list 2026-27 Knicks promo nights?** Partly. Only one food deal is listed.

- **The deal page.** https://www.nba.com/knicks/popcorn-twosday was created 2026-10-06, one day after the 2026-10-05 check that recorded the Knicks as "nothing published". It is in the Knicks base sitemap but not in the site nav.
  - Main text: "The Knicks and DoorDash are bringing Popcorn TWOsday back, all season long! Ticketed fans can purchase popcorn for just $2 during all Tuesday Knicks home games this season."
  - Fine print: "...each Tuesday during Knicks regular season home games during the 2026-27 season... Eligible game dates as follows: 10/20/26, 10/27/26, 11/20/26, 1/26/27, 2/9/27, 3/2/27 and 3/23/27."
- **The fine print has a typo.** "11/20/26" is wrong: the Knicks have no home game that day. The page's own game card (gameId 0022600211) is Tue 2026-11-10 vs MIL. The 7 game cards match our 7 Tuesday regular-season Knicks home dates exactly: 10-20 PHI, 10-27 DET, 11-10 MIL, 01-26 PHX, 02-09 CHA, 03-02 MEM, 03-23 NOP. Any extraction must take dates from the cards, not the fine print.
- **No giveaways or theme nights anywhere official.**
  - https://www.nba.com/knicks/tickets/theme-nights, when rendered, says "Unfortunately, there are no games that match this filter combination."
  - The schedule data has an empty promotion field on every home game.
  - statement-nights and season-of-giving redirect to /tickets/single.
  - msg.com/knicks-theme-nights is a stale 2018 page.
  - The annual promo article series last ran in 2019-20.
- **Fetching the page.** Plain curl without a browser user-agent now gets HTTP 403 from this page. With a browser user-agent it returns 200 and the full content.

**Does any official source confirm the Oct 20 Champions Night T-shirt?** Not found.

- Official sources confirm only the event name and a contest:
  - The video "Full Banner Raising and Ring Ceremony | 2025-26 NBA Champions | Champions Night" (https://www.nba.com/knicks/videos/full-banner-raising-and-ring-ceremony-2025-26-nba-champions-champions-night).
  - A sweepstakes card: "Enter for a chance to win a signed replica Championship Banner and see your name featured in our Champions Night Video." (https://www.nba.com/knicks/fans/sweepstakes). That is a contest, not a giveaway at the game.
- The shirt is reported only by nbaanalysis.net (2026-10-20): "The Knicks' T-shirt reads: '2026-27 Champions Night'". Its only cited source is an X post by a Philadelphia Inquirer reporter. That is not a Knicks or MSG source.
- Recommendation: do not add the T-shirt as a promo.

**Draft empty-state copy for the Knicks page (not shipped):**

> The Knicks have not published a 2026-27 giveaway or theme night schedule on
> their official site. The one promotion they list is Popcorn TWOsday with
> DoorDash: $2 popcorn for ticketed fans at every Tuesday home game this season.
> We will add giveaways and theme nights here when the team announces them.

This copy is a claim about a real organization. It needs a dated verification, in the same form as `NOTHING_PUBLISHED` in `src/lib/announcement-status.ts`. The Knicks entry there (2026-10-05) expired after 14 days. The page now says "PromoNight hasn't recorded any New York Knicks 2026-27 promotions yet."

**Issue #64:** enable or repoint to https://www.nba.com/knicks/popcorn-twosday (single URL) and drop the dead statement-nights URL. Keep /knicks/tickets/theme-nights as the watch URL, with revisitAfter 2026-11-16, because it was still empty on 2026-10-24. That page only fills in when JavaScript runs, so watching it needs a rendering fetch.

## 3. NBA, all 30 clubs

**How the counts work**
- **Our count** is the live page's 2026-27 season total, which leaves out rows flagged as ticket-package-only.
- **Official dated** is the number of open promo rows on 2026-27 *regular-season* home dates. Preseason and anything before 2026-07-01 are excluded by checking each date against our schedule spine.
- **Preseason adjustment.** Our counts include preseason nights by design (WEB6 ruling). So for the four clubs that carry preseason rows, the delta below compares like with like (our count minus preseason rows). Raw deltas from NBA-ALL are in the evidence files.
- **Issue resolutions** are for pipeline issues #54 to #66 (Inactive Club Watcher, 2026-10-19). Nothing was posted to GitHub.

| Team | Our count | Official source URL | Official dated | Delta | Label | Issue and resolution |
|---|---|---|---|---|---|---|
| new-york-knicks | 0 | nba.com/knicks/popcorn-twosday | 7 (one food deal) | +7 | RECOVERED | #64: see section 2 |
| san-antonio-spurs | 0 | nba.com/spurs/tickets/deals; nba.com/spurs/news/san-antonio-spurs-announce-theme-night-schedule-for-2026-27-season | 25 open (+21 ticket-package) | +25 | RECOVERED | #54: watcher's 29 confirmed. 20 real nights + 5 game references (Road to the Cup, I-35 Series) + 4 package-only dates. Enable the configured URL subject to the 10-13 package ruling |
| washington-wizards | 0 | nba.com/wizards/promotions | 9 open (+45 ticket-package) | +9 | RECOVERED | #55: page is 2026-27, not stale. 25 date headers, 25 of 25 valid with weekday and opponent (the watcher's 23 missed headers with no period after the month). The 2023-24 slate lives at /wizards/theme-night, /wizards/promotional-giveaways and /wizards/group-theme-nights-giveaways: never configure those |
| portland-trail-blazers | 0 | nba.com/blazers/news/portland-trail-blazers-announce-2026-27-celebration-and-theme-night-schedule | 16 | +16 | RECOVERED | #66: enable or repoint to this article |
| brooklyn-nets | 0 | nba.com/nets/news/brooklyn-nets-unveil-60th-season-celebration-honoring-six-decades-of-history-culture-and-reinvention | 6 | +6 | RECOVERED | #61: enable or repoint to the article (6 Eras Nights, each a bobblehead or mystery giveaway). Keep watching /nets/60 |
| los-angeles-clippers | 0 | nba.com/clippers/singlegametickets; nba.com/clippers/promotions-giveaways | 1 open (+40 ticket-pack) | +1 | THIN | #63: enable both URLs. Only Oct 28 Trunk or Treat is open |
| miami-heat | 0 | nba.com/heat/tickets/theme-nights (empty when rendered) | 1 | +1 | THIN | #57: still nothing published. Revisit 2026-11-09. The only item is the Nov 18 "Night in Vice City" article |
| philadelphia-76ers | 0 | nba.com/sixers/tickets/theme-nights (2025-26 placeholder); 2026-10-22 article | 1 | +1 | THIN | none |
| utah-jazz | 0 | none (only the opener article) | 2 (Oct 23 opener, past) | +2 | THIN | #58: still nothing published. Revisit 2026-11-16 |
| oklahoma-city-thunder | 0 | none | 0 | 0 | GENUINELY-NONE (27 links checked) | #65: still nothing published. Revisit 2026-12-01 |
| cleveland-cavaliers | 24 | nba.com/cavaliers/promo | 28 | +4 | UNDERCOUNT | #62: keep active, config URL still correct. About 4 giveaways are missing (page 11, ours 7). Five cards hide more items behind "+N more" |
| golden-state-warriors | 13 (11 regular season) | nba.com/warriors/tickets/promotions; 2026-09-30 press release | 16 | +5 | UNDERCOUNT | none. Rendered page may be cut off at Mar 19 |
| memphis-grizzlies | 43 (40 regular season) | configured 2026-09-24 press release | 42 | +2 | UNDERCOUNT | none. NBA-ALL called this MATCH on a raw -1. Our 3 preseason rows reverse it |
| sacramento-kings | 25 | nba.com/kings/promotions | 23 | -2 | OVER | none. No preseason rows, so the gap is unexplained. Needs a row-by-row check |
| los-angeles-lakers | 12 (11 regular season) | nba.com/lakers/promo-nights-and-giveaways | 11 | 0 | MATCH | none. Raw -1 is the 10-08 preseason Pride Night |
| orlando-magic | 19 (17 regular season) | nba.com/magic/theme-nights | 17 | 0 | MATCH | none. Raw -2 is the 10-13 and 10-16 preseason nights |
| dallas-mavericks | 6 | nba.com/mavs/tickets/single?theme=all | 7 (+13 special-ticket nights) | +1 | MATCH | none. The +1 is the Oct 24 opener, a real miss for today |
| indiana-pacers | 8 | nba.com/pacers/tickets/theme-nights | 8 (+6 Family Night packages) | 0 | MATCH | #56: keep active, config URL still correct. Needs a rendering fetch |
| denver-nuggets | 12 | nba.com/nuggets/promotional-schedule | 12 (+2 packages) | 0 | MATCH | #59: keep active, config URL still correct |
| new-orleans-pelicans | 28 | nba.com/pelicans/promotional-calendar | 28 | 0 | MATCH | #60: keep active, config URL still correct. Needs a rendering fetch |
| toronto-raptors | 15 | nba.com/raptors/theme-nights | 15 | 0 | MATCH | none. 2 Raptors Cup nights excluded |
| atlanta-hawks | 21 | configured press release | 21 | 0 | MATCH | none. /hawks/tickets/promotions is client-rendered and was not scraped |
| boston-celtics | 25 | configured press release | 25 | 0 | MATCH | none |
| charlotte-hornets | 22 | configured press release | 23 | +1 | MATCH | none. Same-night double row |
| chicago-bulls | 51 | nba.com/bulls/tickets/promotional-schedule | 51 | 0 | MATCH | none. Both sides include 2 Cup nights and 13 uniform labels |
| detroit-pistons | 46 | configured press release | 47 | +1 | MATCH | none. About 9 uniform-label rows on both sides |
| houston-rockets | 28 | configured press release | 28 | 0 | MATCH | none |
| milwaukee-bucks | 24 | configured press release | 24 (+5 crossover packages) | 0 | MATCH | none |
| minnesota-timberwolves | 29 | nba.com/timberwolves/promotions | 29 (+28 packages) | 0 | MATCH | none |
| phoenix-suns | 23 | /suns/promotions/theme-nights + /suns/promotions/giveaways | 25 | +2 | MATCH | none. Same-night double rows; our type split (g17/th5) differs from the page (12/13) |

A zero-credit lever found along the way:
`content-api-prod.nba.com/public/1/leagues/nba/teams/<teamId>/schedule?season=2026-27`
returns `gameInfo.eventDescription` per game. It carries 5 giveaways for the
Hornets and is empty or generic for most other clubs.

## 4. NFL and NHL zero-promo clubs

| League | Team | Source URL(s) | Shape | Dated | Label | Recommended config |
|---|---|---|---|---|---|---|
| NFL | new-orleans-saints | neworleanssaints.com/news/saints-vs-falcons-2026-nfl-week-4-gameday-guide, .../saints-vs-vikings-2026-nfl-week-5-gameday-guide, .../raiders-at-saints-entertainment-superdome-dome-foam-halftime-dj-diesel-shaq-galactic | One news article per home game with a "GAMEDAY PROMOTIONS" section, posted 2 to 4 days before kickoff | 7 (3 giveaways) | RECOVERED | multi-URL by news discovery. The Week 4 guide was missing from the news sitemap and was found only by /map |
| NFL | detroit-lions | detroitlions.com/game-day/power-hour, /game-day/entertainment, /game-day/, per-game theme news | Rolling next-game pages that overwrite themselves, plus per-game news | 3 (all 10-25 vs GB; 2 dates inferred from the page banner) | RECOVERED | multi-URL, polled weekly before each home game. The 9/13 and 9/27 promos are already overwritten |
| NFL | carolina-panthers | panthers.com/community/panthersplayyard, /gameday/guide | Configured /fans/promotions is only sponsor sweepstakes. The next-game Play Yard page carries kids activities | 1 | THIN | none. Drop /fans/promotions as the wrong source |
| NFL | dallas-cowboys | dallascowboys.com/stadium/know-before-you-go | Rolling next-game timeline | 1 (10/8 halftime Crucial Catch tribute) | THIN | single URL (next-game page) |
| NFL | washington-commanders | commanders.com/inclusion/gameday-experiences | Undated "Night Out" theme nights sold as ticket packages ("Stay tuned for more information!") | 0 | BORDERLINE | none. Keep the watch URL |
| NHL | vancouver-canucks | ticket.canucks.com/singlegame (per-game `community_night` field); nhl.com/canucks/news Diwali release | Per-game structured field plus individual theme-night releases. The Theme Nights page is an empty 2025-26 shell | 2 (11-03 Diwali Night; 01-05 Naruto Night, a ticket bundle) | THIN | multi-URL. Read the raw HTML: the field is in embedded Next.js data |
| NHL | utah-hockey-club (Utah Mammoth) | nhl.com/utah/fans/mammothwinyouwin, /tickets/value-tickets, /tickets/student-section | Season-long sponsor deals and value tickets, undated | 0 | BORDERLINE | none |
| NHL | toronto-maple-leafs | culture.mapleleafs.com/celebration-nights (watch URL) | Card grid still showing the 2025-26 set (slugs end -25 and -26) | 0 | GENUINELY-NONE (67 links checked) | none. Keep the watch URL |

**Utah's name and domain.** nhl.com/utah titles itself "Official Utah Mammoth Website". utahmammoth.com redirects there. Our slug `utah-hockey-club` is a legacy id. The page needs no change for this audit.

**Excluded for every club**
- 2025 paths and bylines, such as /gameday/2025 and the 2025 Salute to Service text.
- NFL preseason paths and "Preseason Week" guides.
- Off-site watch parties and fan fests.
- NHL dates outside 2026-27, checked against each page's own date stamps and the schedule spine.

## 5. THIN list (NFL, NHL), counts only

From discovery:
- Carolina Panthers: 1
- Dallas Cowboys: 1
- Vancouver Canucks: 2

From the Phase 0 inventory (B list, 1 or 2 current-season promos, not rediscovered):
- Tennessee Titans: 1
- Atlanta Falcons: 2
- Cincinnati Bengals: 2

No NHL club holds 1 or 2. The lowest non-zero NHL club is the Wild, at 5.

## 6. Empty-state sentence

The live NBA zero-promo copy (`src/components/zero-promo-fallback.tsx:60`) says:
"Most NBA teams release their full promo schedules at the start of the regular season."

**FALSE on timing.** Most clubs publish weeks before the season starts.

- **25 of 30 clubs have a published 2026-27 slate** as of 2026-10-24, four days into the season: the 20 we carry, plus the Nets, Spurs, Wizards, Blazers and Clippers.
- **At least 23 of those 25 were published before the 2026-10-20 opener.**
  - 15 have a stated publication date:
    - Kings 09-01
    - Rockets 09-02
    - Nets 09-02
    - Mavericks 09-09
    - Lakers 09-10
    - Hornets 09-15
    - Hawks 09-16
    - Grizzlies 09-24
    - Celtics 09-30
    - Warriors 09-30
    - Spurs 09-30
    - Pistons 10-06
    - Bucks 10-07
    - Raptors 10-09
    - Blazers 10-14
  - 8 more were already live when the pipeline verified them:
    - Bulls, Timberwolves and Suns by 09-13
    - Cavaliers, Nuggets, Pacers and Magic by 09-28
    - Wizards by 10-13
  - Unknown: the Clippers, and the date the Pelicans' full calendar went up (their opener row was live by 09-28).
- **None is known to have published on or after the opener.**
- **5 clubs have no full slate four days in:** the Knicks (one food deal), Heat, Thunder, 76ers and Jazz.
- The second clause ("then add dates throughout the year") was not tested.

A true replacement, for a separate change: "Most NBA teams publish their promo schedules in September or early October, before the regular season opens." This is false site copy, which under standing rulings OPS fixes without asking. This brief was read-only, so it has not been changed.

The 14-day `NOTHING_PUBLISHED` window in `announcement-status.ts` has also lapsed for all 10 clubs verified on 2026-10-05. Five of them carry official 2026-27 promo content today: the Bucks (published 2026-10-07), the Knicks (food deal, 10-06), the Blazers (10-14), the Nets (a 09-02 article the check missed) and the Wizards (slate live by 10-13). So any re-verification must not reuse that list.

## 7. Verification and self-review

**Phase 3 sampled verification.** The main session verified these itself; it produced none of the labels. Every check was a fresh plain curl at 0 Firecrawl credits. All 6 labels held. Detail is in `evidence/phase3-verification.json`.

| Team | Label | What was seen |
|---|---|---|
| nfl-new-orleans-saints | RECOVERED | The Week 4 guide's GAMEDAY PROMOTIONS block says "All fans in attendance at the Saints Week 4 game against the Falcons will receive a special Domecoming Rally Towel". The home-opener article, dated Sep 22, 2026, lists "a special 60th season commemorative coin for all fans" |
| nba-new-york-knicks | RECOVERED | The popcorn page served the quoted text (it returned 403 until a browser user-agent was sent). Its 7 game cards match exactly our 7 Tuesday regular-season home dates. The 11/20 typo is confirmed: there is no home game that day |
| nba-portland-trail-blazers | RECOVERED | The article is dated 2026-10-14. All 16 of its weekday-dated nights match a Blazers regular-season home date with the right weekday |
| nhl-toronto-maple-leafs | GENUINELY-NONE | The culture hub still shows only 2025-26 slugs. Three 2026-27 game-day articles have 0 hits for giveaway, "all fans", "first N fans", theme night or celebration |
| nba-oklahoma-city-thunder | GENUINELY-NONE | 35 news slugs dated July to October 2026 include no promo, theme or giveaway article. /thunder/gamenight only bans handouts |
| nfl-washington-commanders | BORDERLINE | Only 2 GENUINELY-NONE labels exist in the whole audit, so this stands in for a third to keep NFL in the sample. The page has 11 undated "Night Out" packages, each marked "Stay tuned". Its only dates are 2022 photo captions |

An extra check, because a stale Wizards slate was the riskiest RECOVERED call: 25 of 25 Wizards date headers are valid 2026-27 home dates.

**Adversarial self-review: the three most likely ways this report is wrong**

1. **Season scope, and preseason counted on one side only.** Our split-season counts include preseason nights by design; the official counts excluded them. Unadjusted, that would have produced false MATCH and OVER calls.
   - What was checked: a read-only Firestore pass counted preseason-dated rows for all 20 NBA clubs with promos. Four have them: Warriors 2, Lakers 1, Grizzlies 3, Magic 2.
   - What changed: the Warriors (raw +3 became +5) and the Grizzlies (raw -1 MATCH became +2 UNDERCOUNT) moved. The Lakers and Magic gaps are fully explained.
   - Still unexplained: the Kings' -2.
2. **Last-season or stale pages counted as current.** The riskiest cases were the Wizards (a stale slate in 2026-10-05 notes), Toronto and Vancouver (2025-26 shells), and NFL /2025 paths.
   - What was checked: the Wizards headers were tested against the 2026-27 calendar and the opponents in our spine (25 of 25). Toronto's slugs and Vancouver's edit dates were read. NFL items were counted only when tied to a 2026 home date.
   - What remains: the Lions' Power Hour and entertainment pages carry no date in the body. Their 10-25 date rests on the page banner and a matching dated article.
3. **Schedule annotations, ticket packages or sponsor tags read as promos.** This is the largest remaining risk in the RECOVERED counts.
   - What was checked: ticket-package rows are reported separately everywhere and kept out of every "official dated" number above (Wizards 9 not 54, Clippers 1 not 41, Spurs 25 not 46). Game references were stripped (Spurs Cup and I-35 Series). Vancouver's 17 presenting-sponsor tags and 13 alternate-jersey tags were excluded.
   - What remains: MATCH on the Bulls and Pistons is padded on our side by uniform and Cup labels the page also lists. MATCH means the counts agree, not that both sides are clean.
   - Ruled out: a wrong team domain. Utah was confirmed as the Mammoth on nhl.com/utah, and every NFL domain is the club's own.

**Parallel-session note (FIX).** FIX reported that ESPN scoreboard date ranges have returned 400 since about 2026-09-16. No count in this report goes through ESPN:
- Promo counts are Firestore promo subcollections read through the site's own functions.
- The home-date spine comes from api-web.nhle.com (NHL), lib/ingest/nba-schedule.js (no ESPN, per FIX) and src/lib/ingest-nfl.ts (week form, unaffected per FIX).

**Phase 0 cross-check.** 9 live pages were fetched with cache-busting curl (3 per league), and all 9 matched Firestore on giveaway, theme, food and kids. Detail is in `evidence/phase0-inventory.json`.

## 8. Credits

Firecrawl REST, one shared key. The account balance went from 784 to 743, a drop of 41. That equals the sum of the agent ledgers, so FIX spent 0 on the shared key during this run.

| Agent | Budget | Used | Calls |
|---|---|---|---|
| NFL-ZERO | 170 | 12 | 5 map, 7 scrape |
| NHL-ZERO | 170 | 8 | 4 map, 4 scrape |
| NBA-ALL | 260 | 13 | 13 scrape |
| KNICKS | 50 | 8 | 2 map, 6 scrape |
| Verification (main session) | 50 | 0 | curl only |
| **Total** | **700** | **41** | |

Every other fetch was plain curl at 0 credits: sitemaps, `__NEXT_DATA__` and robots files. No agent hit its ceiling, and no team went unreached.
