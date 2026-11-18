# UX review: fix/jsonld-hygiene (2026-11-18)

Run of 2026-11-18, about 15:20 to 15:30 ET. Baseline mode.

- Branch: `fix/jsonld-hygiene`, commit 6378e26 (one commit on origin/main a7367ed), served as a production build at http://localhost:3100. The local server's HTML carries no `promonight-deploy` meta.
- Production: https://www.getpromonight.com, `promonight-deploy` = `dpl_65rWaCL2H7Kbyv5cGfkzHxYefeHB`. The commit behind that deployment was not looked up; its structured data behaves as origin/main does (one Event per upcoming promo, tracked offer URLs).
- Pages: team `/nhl/minnesota-wild` and `/mlb/atlanta-braves`; promo `/nhl/buffalo-sabres/promos/sabres-salt-and-pepper-shakers` and `/nba/brooklyn-nets/promos/aba-night`.
- Promo sample resolution: 1,503 promo URLs in the production sitemap, walked in order; the first whose first Event `startDate` is 2026-11-25 or later (today in New York plus 7 days, compared as a YYYY-MM-DD string) is `/nhl/buffalo-sabres/promos/sabres-salt-and-pepper-shakers`, game date 2026-11-25.
- Method notes. Every browser context aborted requests to ticketnetwork.lusg.net, ticketnetwork.com, ticketmaster.com, spothero.com, expedia.com, fanatics.com, *.evyy.net, *.93n6tx.net, ebay.com, posthog, google-analytics and googletagmanager, and every third-party script, frame and XHR (which includes the ad loader, ads.adthrive.com) on both sides, so ad slots stayed empty in both renders. Layout shift and the pixel comparison were therefore measured without ads on either side. No partner page was loaded: each "Get tickets" tap opened a tab whose navigation was aborted.
- Screenshots and diff images: `2026-11-18-fix-jsonld-hygiene/<slug>/<viewport>-<env>.png` and `<viewport>-diff.png`.

## 1. Baseline differences, rendered page

Verdict: the branch changes nothing a fan can see or tap on any of the four pages at 390, 768 or 1280. Every difference found is an environment or data-freshness difference, listed below.

| Page | Pixels differing 390 / 768 / 1280 | Article text | Interactive elements (count, size, position) | Cause of any difference |
|---|---|---|---|---|
| /mlb/atlanta-braves | 0 / 0 / 0 | identical | identical (135 / 140 / 140) | none |
| /nhl/buffalo-sabres/promos/sabres-salt-and-pepper-shakers | 0 / 0 / 0 | identical | identical (49 / 54 / 54) | none |
| /nba/brooklyn-nets/promos/aba-night | 79 / 79 / 79 | one line differs | identical (52 / 57 / 57) | live forecast text, see below |
| /nhl/minnesota-wild | 248,832 / 275,483 / 302,466 | two lines absent on branch | branch has 2 fewer (109 vs 111 at 390) | eBay resale link, env var, see below |

Differing regions, with their text:

1. Ticketmaster link wrap (all four pages, environment). The local build has no `NEXT_PUBLIC_TICKETMASTER_IMPACT_WRAP`, so Ticketmaster links are bare. Example, Sabres promo page "Also on Ticketmaster": branch `https://www.ticketmaster.com/buffalo-sabres-tickets/artist/805906`; production `https://ticketmaster.evyy.net/c/7236189/264167/4272?u=https%3A%2F%2Fwww.ticketmaster.com%2Fbuffalo-sabres-tickets%2Fartist%2F805906&sharedid=web_promo_page_buffalo-sabres&subId3=sabres-salt-and-pepper-shakers`. Same pattern on the team pages (`sharedid=web_team_page_{team}`). No visual effect. Not a defect.
2. /nhl/minnesota-wild, eBay resale rows (environment). Production renders "Missed it? Check resale on eBay" under two past bobblehead promos (Kirill Kaprizov 2026-01-24, Jared Spurgeon 2025-12-21); the branch render has neither. The link is gated on `NEXT_PUBLIC_EBAY_CAMPID` (src/lib/ebay.ts), which the local build does not have, and the commit does not touch that code. Effect: the branch page is 96px shorter at 390 (10,772 vs 10,868) and 64px shorter at 768 and 1280; every pixel above the first missing row (y 4802 at 390, 4227 at 768, 3165 at 1280) is identical, and every interactive element below it has the same size and horizontal position, shifted up. Not a defect. See `2026-11-18-fix-jsonld-hygiene/team-minnesota-wild/390-diff.png`.
3. /nba/brooklyn-nets/promos/aba-night, forecast line (data freshness). Branch: "Mostly clear, high 63°, low 46°, 0% chance of precipitation" and "Forecast from weather.gov, updated Nov 18, 3:06 PM ET". Production: "... low 43° ..." and "updated Nov 18, 9:59 AM ET". The 79 differing pixels are those characters (390: rows 1774 to 1824). Not a defect.

Main-content HTML (`<article>`, with JSON-LD scripts, flight payload, nonces and build hashes stripped): identical on all four pages apart from the three items above. Braves and Sabres differ in exactly one line each (the Ticketmaster href).

### The "Get tickets" href

| Page | Branch | Production | Same |
|---|---|---|---|
| Sabres promo, "Get tickets" (144x52 at 390, opens a new tab, rel `noopener noreferrer sponsored`) | `https://ticketnetwork.lusg.net/c/7236189/120057/2322?u=https%3A%2F%2Fwww.ticketnetwork.com%2Ftickets%2F8138515%2Fbuffalo-sabres-vs-new-york-rangers-tickets-wed-nov-25-2026-keybank-center&partnerpropertyid=8313917&MediaPartnerPropertyId=8313917&subId1=web_promo_page_buffalo-sabres&subId3=sabres-salt-and-pepper-shakers` | the same string | yes, byte for byte |
| ABA Night promo, "Get tickets" (144x52) | `...%2Ftickets%2F8205764%2Fbrooklyn-nets-vs-chicago-bulls-tickets-wed-nov-18-2026-barclays-center&partnerpropertyid=8313917&MediaPartnerPropertyId=8313917&subId1=web_promo_page_brooklyn-nets&subId3=aba-night` | the same string | yes, byte for byte |
| Wild team page, TicketNetwork "Get Tickets" (342x58) | `...%2Fe%2Fperformers%2Fminnesota-wild-tickets&...&subId1=web_team_page_minnesota-wild` | the same string | yes |
| Braves team page, TicketNetwork "Get Tickets" (342x58) | `...%2Fe%2Fperformers%2Fatlanta-braves-tickets&...&subId1=web_team_page_atlanta-braves` | the same string | yes |

The tap, with the navigation aborted, requested exactly that href on both sides; the promo page itself did not navigate.

## 2. Structured data, from served HTML

| Page | JSON-LD blocks branch / production | Event blocks branch / production | Other blocks |
|---|---|---|---|
| /nhl/minnesota-wild | 6 / 6 | 4 / 4 | WebPage, FAQPage; identical |
| /mlb/atlanta-braves | 22 / 75 | 20 / 73 | WebPage, FAQPage; identical |
| Sabres promo | 3 / 3 | 1 / 1 | WebPage, BreadcrumbList; identical |
| ABA Night promo | 4 / 4 | 1 / 1 | WebPage, FAQPage, BreadcrumbList; identical |

- Braves: the branch's 20 Events are production's 73 sorted by `startDate` and cut at 20, same set and same order, and each of the 20 blocks is byte-identical to its production block. First: 2027-04-02 "Magnetic Schedule Giveaway". Twentieth: 2027-05-15 "Block Party". First one left out: 2027-05-16 "Kids Run the Bases", so no same-day promos are split by the cut.
- Wild: 4 upcoming promos, 4 Events on both sides, same order (2026-11-25 "Native American Heritage Night Hat" to 2026-12-22 "Nightlight"). The cap does not bite.
- Team-page Events carry no `offers` on either side.
- Promo `offers.url`:
  - Sabres, branch: `https://www.getpromonight.com/nhl/buffalo-sabres/promos/sabres-salt-and-pepper-shakers`
  - Sabres, production: `https://ticketnetwork.lusg.net/c/7236189/120057/2322?u=https%3A%2F%2Fwww.ticketnetwork.com%2Ftickets%2F8138515%2Fbuffalo-sabres-vs-new-york-rangers-tickets-wed-nov-25-2026-keybank-center&partnerpropertyid=8313917&MediaPartnerPropertyId=8313917&subId1=web_promo_page_buffalo-sabres&subId3=sabres-salt-and-pepper-shakers`
  - ABA Night, branch: `https://www.getpromonight.com/nba/brooklyn-nets/promos/aba-night`
  - ABA Night, production: `https://ticketnetwork.lusg.net/c/7236189/120057/2322?u=https%3A%2F%2Fwww.ticketnetwork.com%2Ftickets%2F8205764%2Fbrooklyn-nets-vs-chicago-bulls-tickets-wed-nov-18-2026-barclays-center&partnerpropertyid=8313917&MediaPartnerPropertyId=8313917&subId1=web_promo_page_brooklyn-nets&subId3=aba-night`
  - On both promo pages the JSON-LD is identical to production in every other field (`availability` InStock, `eventStatus` EventScheduled, name, dates, location).
- Partner hosts and sub IDs in branch JSON-LD (lusg.net, ticketnetwork.com, ticketmaster.com, spothero, expedia, subId, aff_sub, evyy.net, 93n6tx, fanatics.com): none on either promo page. On the two team pages the only match is the words "SpotHero" and "Expedia" as plain prose in two FAQPage answers ("reserve guaranteed spots in advance through SpotHero", "searching Expedia for hotels near ..."); that FAQPage block contains no URL at all and is identical on production. No partner host, no link and no sub ID in any branch JSON-LD block.
- The copy of the Event that rides in the RSC flight payload on the promo pages also carries the page URL on the branch (occurrences of lusg.net in the whole document: 2 on the branch, the button and its flight copy; 4 on production).

## 3. Served HTML size, /mlb/atlanta-braves

| | Branch | Production |
|---|---|---|
| Bytes (uncompressed) | 880,673 | 955,720 |
| of which JSON-LD script tags | 13,215 | 38,212 |
| of which flight payload | 517,684 | 566,653 |
| everything else | 349,038 | 350,119 |

Difference 75,047 bytes; the branch is 69,327 bytes under the 950,000 cap, production is 5,720 over. About 1,100 bytes of the difference outside JSON-LD and flight is environment (two unwrapped Ticketmaster links, no deploy meta), and a little more of the same sits inside the flight payload, so the deployed page will land slightly above 880,673.

## 4. Game date check

- Sabres promo: game line "Wednesday, Nov 25, 2026 · 7:00 PM ET" (`<time datetime="2026-11-25T19:00:00-05:00">`), Event `startDate` 2026-11-25. Today in the building's zone (ET): 2026-11-18. Verdict: upcoming, 7 days out; the tile reads "IN 7 DAYS". Same on production.
- ABA Night promo: game line "Wednesday, Nov 18, 2026", Event `startDate` 2026-11-18. Today in ET: 2026-11-18. Verdict: game day, not played; the tile reads "TONIGHT" and the page still sells tickets. Same on production.
- Team pages: every Event is upcoming (Wild first 2026-11-25, Braves first 2027-04-02).

## 5. Things that work

1. The ticket button is untouched by the change: same label, same 144x52 target, same position, same tracked href with the same subId1 and subId3 as production.
2. Rail cards go where they say and back works: "Disco Night" opens a page whose H1 is "DISCO NIGHT", "80s Night" opens "80S NIGHT"; browser back restored the scroll position exactly (983 to 983, 1590 to 1590) on both sides.
3. No horizontal overflow at 390, 768 or 1280 on any page (`scrollWidth` equals `documentElement.clientWidth`), on both sides.

## 6. Defects

Introduced by this branch: none.

Present on the branch and identical on production (not caused by this diff; listed so the record is complete):

1. Medium. /nba/brooklyn-nets/promos/aba-night, all viewports: the game line gives the date with no start time for a game that is tonight; the Sabres page shows "7:00 PM ET". `2026-11-18-fix-jsonld-hygiene/promo-aba-night/390-branch.png`.
2. Medium. Tap targets under 44x44 at 390: Wild 84 of 109, Braves 97 of 135, Sabres promo 34 of 49, ABA Night 34 of 52. On the promo pages this includes "Also on Ticketmaster" (133x21), directly under the primary button.
3. Low. Contrast under 4.5:1: the red "NIGHT" in the header wordmark (4.33:1, every page); on the Braves page two team-colour pills (2.62:1 `#00a3e0` on `#eaf7fc`, 4.0:1 `#e81828` on `#fdeced`).
4. Low. ABA Night, axe serious: the Forecast `<dt>`/`<dd>` sit outside a `<dl>` (definition-list 1, dlitem 2), and two inline links ("Official bag policy", "Official parking") differ from surrounding text by 2.99:1 with no underline (link-in-text-block 2).
5. Low. Team pages, axe serious: label-content-name-mismatch (Wild 6 at 390 and 16 at 768 and 1280; Braves 2), for example the affiliate buttons whose aria-label does not contain the visible text and calendar day buttons labelled "2026-11-01 details".
6. Low. /mlb/atlanta-braves, all viewports: the hero reads "Giveaways & Theme Nights 2026" over tiles totalling 73 promos whose first date is 2027-04-02, and the calendar opens on an empty November 2026. `2026-11-18-fix-jsonld-hygiene/team-atlanta-braves/390-branch.png`.

## 7. Measurements

Values are branch / production. One figure means both sides are equal.

| Measure | Wild | Braves | Sabres promo | ABA Night promo |
|---|---|---|---|---|
| HTTP status | 200 | 200 | 200 | 200 |
| Document height 390 | 10,772 / 10,868 | 17,213 | 3,299 | 4,124 |
| Document height 768 | 8,513 / 8,577 | 12,584 | 2,292 | 2,859 |
| Document height 1280 | 6,929 / 6,993 | 9,852 | 2,247 | 2,788 |
| Overflow at 390 (scrollWidth / clientWidth) | 390 / 390, none | 390 / 390, none | 390 / 390, none | 390 / 390, none |
| Layout shift during load, 390 | 0 | 0 | 0.029 | 0.0001 |
| Layout shift during load, 768 | 0 | 0 | 0.0003 | 0.0003 |
| Layout shift during load, 1280 | 0 | 0 | 0.013 | 0.0002 |
| Interactive elements at 390 | 109 / 111 | 135 | 49 | 52 |
| Under 44x44 at 390 | 84 / 86 | 97 | 34 | 34 |
| `<a>` to /promos/ in DOM / visible, 390 | 37 / 26 | 95 / 30 | 19 / 17 | 20 / 18 |
| First ad anchor from top, 390 (px) | 2,635 | 4,556 | no anchor in the article | no anchor in the article |
| axe serious and critical, 390 | color-contrast 1, label-content-name-mismatch 6 | color-contrast 3, label-content-name-mismatch 2 | color-contrast 1 | color-contrast 1, definition-list 1, dlitem 2, link-in-text-block 2 |
| JSON-LD blocks | 6 | 22 / 75 | 3 | 4 |
| Event blocks | 4 | 20 / 73 | 1 | 1 |
| Served HTML bytes | 364,421 / 381,434 | 880,673 / 955,720 | 125,461 / 131,217 | 128,809 / 134,450 |

The Wild differences in height, interactive count and small-target count are the two eBay resale links (186x32 at 390) that only production's environment renders. The Wild byte difference is environment too (its JSON-LD is byte-identical on both sides).

## 8. Checked and fine

- Visible text, layout and tap targets on all four pages at three viewports: no change from the branch.
- "Get tickets" href and sub IDs on both promo pages and both team pages: identical to production.
- Team-page Event cap: 20 on the Braves page, the 20 soonest, in date order; 4 of 4 on the Wild page.
- Promo `offers.url` is the page's canonical URL; no partner host or sub ID in any branch JSON-LD block or in its flight-payload copy.
- Braves page 880,673 bytes, under the 950,000 cap.
- Game dates: Sabres 7 days out, ABA Night today, neither played.
- Overflow at 390, layout shift, axe results, /promos/ link counts and first ad anchor: equal on both sides.
- Rail card destination H1 and scroll restoration on back: pass on both sides.

## 9. Recommendation

Merge. Nothing in this diff reaches the rendered page; the six items in section 6 predate it and are identical on production, so they need a waiver or a known-issues entry under the merge rule rather than a change to this branch. After the deploy, read /mlb/atlanta-braves in the live battery for its real byte count, since the local build lacks two environment variables that add a little to the page.

## 10. Scope limit: uncommitted edits made after the reviewed build

The build served at :3100 was made at 14:19 CST (`.next/BUILD_ID`) from commit 6378e26, and that is what this report covers. At 14:29 CST, while this review was running, the worktree gained uncommitted edits to 8 tracked files (not made by this review), among them `src/components/json-ld.tsx` (rows with no usable date are dropped before the sort), `src/lib/promo-page-copy.ts` and `src/components/promo-page/PromoPageView.tsx` (a played date in a series gets no offer). Those edits were not built and not rendered here. They again touch structured data only, and on reading they should not change the output of the four pages above (two single-date upcoming promos, two team pages whose promos all carry dates), but that is a reading of the diff, not a measurement. A partly played series page was not in this run's sample on either version.

## Dispositions (2026-11-18)

The review found no defect introduced by this branch. The six items it lists are present on production in the same form and are outside this diff (structured data only):

| # | Defect | Disposition |
|---|---|---|
| 1 | ABA Night: the game line shows no start time for a game tonight | DEFERRED, known-issues 110. |
| 2 | Tap targets under 44x44 on team and promo pages, "Also on Ticketmaster" among them | DEFERRED, known-issues 110. |
| 3 | Header wordmark contrast 4.33:1; two team-colour pills on the Braves page | WAIVED for the wordmark (the brand red on cream, ruled 2026-11-08: buttons and the wordmark keep rd-red). The pills are DEFERRED, known-issues 110. |
| 4 | ABA Night: Forecast dt/dd outside a dl; two inline links at 2.99:1 | DEFERRED, known-issues 110. |
| 5 | Team pages: label-content-name-mismatch on affiliate and calendar buttons | DEFERRED, known-issues 110. |
| 6 | Braves hero reads "2026" over 73 promos dated 2027; the calendar opens on an empty month | DEFERRED, known-issues 110 (season rollover for a club whose next season is the only one with promos). |

After the reviewed build, three small changes were made in response to the adversarial review and are in the merged commit: a played date in a partly played series gets no offer; a row with no usable date is not an Event; the live guard parses each block and is not vacuous. They do not touch rendered markup. They were checked by the unit tests, by the new live guard against a rebuild, and by reading the JSON-LD of a partly played series page on that rebuild.
