# PromoNight Events: Banana Ball brief

Drafted 2026-11-18. Status: PARKED until the Monster Jam pages launch. Written so a new session can pick it up cold. Repo copy: promonight-web/docs/events-banana-ball-brief.md. Project-knowledge copy: claude/events-banana-ball-brief.md. Companion to docs/events-monster-jam-spec.md, which holds the /events structure, analytics and Raptive notes this builds on.

## Decision so far
- Banana Ball (the Savannah Bananas tour) is the next show for /events, ahead of Disney on Ice and Supercross.
- Matt's ruling 2026-11-18: the pages carry a resale ticket button. The market exists and he wants a share of it.

## Why this show (Ahrefs US, pulled 2026-11-18; relative signal only)
| Keyword | Volume/mo | Difficulty |
|---|---|---|
| savannah bananas | 297,000 | 64 |
| savannah bananas tickets | 37,000 | 11 |
| savannah bananas schedule | 32,000 | 33 |
| savannah bananas chicago | 8,000 | 4 |
| savannah bananas denver | 7,600 | 6 |
| savannah bananas minneapolis | 3,000 | 0 |
| savannah bananas houston | 150 | 36 |
| savannah bananas bag policy | 40 | 3 |

- City demand is the highest of any candidate checked, at low difficulty.
- It plays MLB and football stadiums, where PromoNight's venue data is strongest.
- It is baseball, so it fits the brand, and the audience is all ages.
- For comparison: Disney on Ice 85,000 head term, city terms around 2,700, but arenas and a kids' brand. Supercross 19,000, city terms 400 to 1,200, about 15 of 17 rounds at stadiums already covered, Feld-owned. Hot Wheels Monster Trucks Live 8,400, small arenas.

## The 2027 tour (from news coverage of the 2026-10-15 announcement; verify every date in Phase 0)
- 79 stadiums in 74 cities: 23 MLB stadiums, 10 football stadiums, the rest minor league parks. Organizer estimate of 4.3 million fans.
- Six teams: Savannah Bananas, Party Animals, Firefighters, Texas Tailgaters, Indianapolis Clowns, Loco Beach Coconuts. Each game is a matchup between two of them.
- Season runs February to September. Reported dates include Mexico Feb 5-6 and Feb 12-13, Petco Park Apr 3-4, Dodger Stadium Apr 23-24, Notre Dame Stadium Jun 26, Rogers Centre Aug 14-15.
- Launch scope would be the 33 MLB and football stadiums. The minor league parks are not in the venue database.
- The first big-stadium dates are in April, so a January to February build catches most of the season.

## Ticket situation (researched 2026-11-18)
Official route:
- Tickets are sold only through the team's own lottery on its Fans First Tickets platform. The 2027 lottery list opened 2026-10-15 and closed 2026-10-31. The team's page says the 2027 list has closed and offers a Ticket Interest List.
- Face value is reported at $35 to $60 with no fees.
- The team runs a Fans First Ticket Marketplace where verified fans resell to other verified fans at face value with no fees.

Team's stance on other sellers:
- Its site has warned that third-party tickets are often fraudulent and will not be accepted, and it has named StubHub and Ticketmaster.
- The owner has said publicly that he cannot say any ticket on a secondary site is legitimate.

Do resold tickets get refused?
- The team's own system supports transfers: a holder sends tickets to a recipient's email and the recipient has 48 hours to accept. The official app lists transferring tickets as a feature. A resale seller uses that same transfer, so the buyer holds a genuine ticket in their own account.
- No credible report was found of a transferred, marketplace-bought ticket being turned away. The one news story about a StubHub buyer was a seating complaint; the family got in.
- The team's fraud warnings center on fakes and on unverified sources such as social media sellers.
- Two low-quality sites claim the team cancels tickets resold above face value. Nothing reliable was found behind that.
- Limits: fan forums could not be read. This rests on news coverage and the team's help pages.

The resale market:
- A Gametime snapshot put the median get-in price at $255 against $27 for MLB.
- Rolling Stone (2025) listed TicketNetwork among the marketplaces carrying the games. Not yet confirmed for 2027.
- At TicketNetwork's 12.5%, four tickets at $255 is roughly $125 commission on one order.

The real risk to this revenue: the team is actively fighting resale and could restrict transfers. That would cut off resale inventory quickly. Gate refusal of real tickets looks like the smaller risk.

## Ticket block rules for the page
- Button and resale line follow the site-wide rule of 2026-11-25 (`src/lib/ticket-labels.ts`, `docs/cta-registry.md`), which replaces the earlier wording of this bullet: the button reads "Get Tickets", never "Resale tickets", and one line under the button or button group says "TicketNetwork is a resale marketplace. Prices may differ from face value." One line per group, not per button. The words come from that file, not from the page.
- The official routes are on the page too: the lottery and its status, and the team's face-value marketplace.
- The page says what a good delivery looks like: tickets arrive as a transfer into the buyer's own Fans First Tickets account. A screenshot or PDF is a warning sign.
- The page notes that scannable tickets appear about 24 hours before the game, so a late delivery is not automatically a problem.
- Never a price. Never side-by-side marketplace prices.
- Provider is the same config flag as the rest of /events.

## How it fits /events
- URLs: `/events/banana-ball` as the show hub, `/events/banana-ball/{venue}` per stop. Nothing existing changes.
- Stop doc: same shape as Monster Jam. searchCity, timezone, bagPolicy and eventPolicies carry over.
- One new field: a matchup label on each performance. Monster Jam leaves it null.
- Visits: a stadium hosts two or three games over a weekend, which the model already handles.
- Bag policy: the team's FAQ says that at road games fans should check the host stadium's bag policy, because the team follows its hosts' rules. Expect a cleaner fit than Monster Jam, but confirm per stadium whether the stored rule is a tenant rule or an all-events rule.
- Hub title must not claim completeness. Launch covers the major stadiums only and the hub says so.
- Launching a second show is the trigger to move Events into the top nav.

## Rules carried over from the Monster Jam build (settled, do not reopen)
- Event-specific facts live on the stop doc, sourced from the venue's own page for the event. The hub keeps building facts.
- A rule text may contain only what its stored quote says.
- Reviewed map files (search city, timezone, bag scope, venue events) gate every execute. An edit to a reviewed file should return it to proposed.
- Showtimes need two agreeing sources, or the row is held.
- Read the organizer's site terms before taking anything from its site. Until then, nothing is ingested from it and nothing links to it beyond what the terms allow.
- Never use a proxy, stealth mode or any other means to get past a page that refuses a request.
- Generated text card only. No team logos, mascots or artwork. Team and show names in text are fine.
- A "not affiliated with" line on every page.
- Copy is written for adults buying tickets, per Raptive's 2026-11-17 confirmation.
- Snapshot before write, dry run by default with --prod-baseline, --execute gated, adversarial review before any production write.
- Analytics as specified in the Monster Jam spec: page_type, show and venue on every pageview, events surfaces, sub-ID of surface plus show plus venue, labeled links in and out.

## Open questions for Phase 0
- Does the TicketNetwork catalog carry the 2027 games, with stable event ids and matchups?
- How does TicketNetwork deliver these tickets, and does its listing say so?
- What do the team's site terms say about automated access, reuse of content and linking?
- Which of the 33 major stadiums match a hub, and which clear the floor?
- Does each host stadium publish a page for the games, and what does it print?
- What is the search city for each stop?

## Phase 0 prompt (read-only; paste into Claude Code when this is unparked)

```
Read docs/events-banana-ball-brief.md and docs/events-monster-jam-spec.md in promonight-web. This turn is PHASE 0 ONLY for Banana Ball on /events: a read-only audit. No file edits, no commits, no Firestore writes, no deploys.

Subagents: 0. Network ceiling: 40 fetches, then stop and report. Never use a proxy or stealth mode to get past a page that refuses a request.

Answer these numbered questions and nothing else:

1. TicketNetwork catalog. Through lib/tn/tn-catalog-fetch.js, does the Impact catalog return 2027 Savannah Bananas or Banana Ball games? Report the item count, venue count, date range, and for 3 sample stops the raw fields: event id, venue, the two teams if present, and the date field. Do the venue-scoped TicketNetwork pages print showtimes and availability as they did for Monster Jam?

2. Delivery. Does any TicketNetwork listing or help page state how these tickets are delivered (for example by transfer into a Fans First Tickets account)? Quote it or say it is not stated.

3. Organizer terms. Find the site terms for bananaball.com and the Fans First Tickets platform from each site's footer. Quote the clauses on automated access, reuse of site content and linking. Ingest nothing from those sites.

4. Venue coverage. From the catalog's venue list, which stadiums match a venueHubs doc, and which of those clear the events floor under the web's own predicates? List matched venues with their state. List unmatched venues by name only. One script, not a fetch per venue.

5. Bag scope. For the matched stadiums, using the stored hub records only and zero fetches, classify each bag rule as all-events, tenant-only, varies, or not stated, quoting the stored sentence that decides it.

6. Host pages. For 3 sample stadiums, find the host's own page for the Banana Ball games and report what it prints: showtimes, gate times, bag rule, re-entry, child ticket rule. Quote each.

7. Second source. For the same 3 stops, does a second allowed source print the same clock time as TicketNetwork?

8. Model. What changes does the eventStops shape need for this show: the matchup label per performance, any difference in visit grouping, and anything in the planner or guard that assumes Monster Jam?

9. Search city. Propose a searchCity value per matched stadium for review.

Output: answers 1 to 9 with evidence, a proposed phase plan with a gate at the end of each phase, a deferred list with one line per finding outside these questions, and the fetch count. No em dashes. Then stop.
```

## Sources
- AP via CTV News, 2027 tour announcement: https://www.ctvnews.ca/winnipeg/article/savannah-bananas-and-banana-ball-are-going-international-with-dates-in-canada-and-mexico-in-2027/
- Todo Canada, 2027 lottery dates: https://www.todocanada.ca/savannah-bananas-banana-ball-is-coming-to-toronto-and-winnipeg-in-2027-heres-how-to-get-tickets/amp/
- Banana Ball tickets page: https://bananaball.com/tickets/
- Banana Ball Help, ticket transfers: https://help.bananaball.com/knowledge-base/how-to-transfer-tickets-to-someone-else/
- Front Office Sports, face-value resale market: https://frontofficesports.com/savannah-bananas-ticket-resales/
- WJCL, Fans First Marketplace: https://www.wjcl.com/article/savannah-bananas-to-begin-offering-option-for-resale-of-tickets-at-face-value/69535928
- CBS Pittsburgh, team's third-party warning: https://www.cbsnews.com/amp/pittsburgh/news/savannah-bananas-pittsburgh-tickets
- CBS Colorado, scam warnings: https://www.cbsnews.com/colorado/news/savannah-bananas-tickets-scams-buy-from-trusted-sources
- WMAR, StubHub buyer's seating complaint: https://www.wmar2news.com/sports/family-frustrated-over-lack-of-seating-at-oversold-savannah-bananas-game
- Gametime, resale price data: https://gametime.co/blog/savannah-bananas-tickets-are-outpricing-mlb-by-nearly-10x-gametime-data-shows
- Rolling Stone, marketplaces carrying games: https://www.rollingstone.com/product-recommendations/tickets/get-savannah-bananas-tickets-online-where-to-buy-banana-ball-tickets-1235395234/
- Savannah Bananas FAQ, bag policy on tour: https://thesavannahbananas.com/?p=22
- Ultimate Motorcycling, 2027 Supercross schedule: https://ultimatemotorcycling.com/2026/10/03/2027-supercross-schedule-17-rounds-dates-venues-tickets/
