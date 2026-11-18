# PromoNight Events: Monster Jam test spec

Drafted 2026-11-17. Status: BUILT on branch feature/events-pages (2026-11-18), behind EVENTS_PAGES_LIVE, off in production, not merged. Where this spec and the build prompt of 2026-11-18 disagreed, the prompt won and the spec was changed here; see "As built" at the end. Project-knowledge copy: claude/events-monster-jam-brief.md.

## Decision
Extend PromoNight beyond sports with touring family events, starting with a single test: Monster Jam. Individual pages that work like the per-promo pages, linked in and out of venue pages. Concerts are out of scope. Disney on Ice and Paw Patrol Live are follow-ons only if the test passes.

## Positioning
Not a pivot. It is "more game days at venues we already cover."
- The venue is the anchor, not the event. A Monster Jam page is the venue's logistics plus one show.
- Monster Jam is a scored motorsport with a season, standings and a World Finals, the smallest step away from sports.
- Six-plus-CFB framing stays intact. Monster Jam is never presented as a seventh league and never enters the league nav.

## Why (Ahrefs US, pulled 2026-11-17)
| Keyword | Volume/mo | KD |
|---|---|---|
| monster jam | 154,000 | 42 |
| monster jam tickets | 12,000 | 33 |
| monster jam ear protection | 250 | 0 |
| disney on ice | 85,000 | 53 |
| disney on ice minneapolis | 500 | 8 |
| disney on ice bag policy | 150 | 0 |
| paw patrol live | 6,800 | 2 |

Parents search logistics ("[show] [city]", bag policy, ear protection, toddler tickets). The venue data already answers those. Concerts were rejected: "concerts near me" is 227K/mo but owned by Ticketmaster, SeatGeek, Bandsintown and Songkick, and API-fed listings read as scaled thin content.

## Season and scale
- Runs year-round; competitive season January to May, ending at World Finals. Peak is late January to April.
- 350+ performances a year across roughly 100 tour stops (98 events in 2024). Most stops are multi-show weekends.
- 2027 (35th anniversary) is on sale now. Examples found 2026-11-17, all to be verified against the source of truth: Capital One Arena Jan 30-31; U.S. Bank Stadium Feb 20 and 21 (confirmed in Phase 0); PPL Center Feb 26-28 (five shows); Lincoln Financial Field Apr 17.
- Ship by mid-December. Parents buy December through February.

## Scope
- Only stops at venues already in the database with verified venue data (absence beats wrong). No new venues.
- Unit is the stop, not the performance.
- THE FLOOR, as built: the venue hub is verified, indexable, and shows a sourced bag claim plus a sourced parking or transit claim under the web's own predicates with the pointer links removed. A pointer link never counts. The pipeline applies it before it writes a stop and the web applies it again before it renders one.
- LAUNCH SET, as built (2026-11-18): 19 stops, 24 visits, 60 performances: angel-stadium, att-stadium, ball-arena, bridgestone-arena, caesars-superdome, delta-center, fiserv-forum, ford-field, golden-1-center, loandepot-park, lucas-oil-stadium, nrg-stadium, paycom-center, ppg-paints-arena, raymond-james-stadium, rocket-arena, snapdragon-stadium, ubs-arena, us-bank-stadium. Not in the set: gillette-stadium and metlife-stadium (their April showtimes are held until a second allowed source prints the clock time), moda-center (joins when its transit suppression is removed, which this branch does), capital-one-arena (out of the launch set).

## URL and page model
- `/events/monster-jam/{venue}`. Evergreen, no year in the URL, same slug discipline as per-promo pages (minted once, never recomputed).
- One page per venue. Two visits in one season stay on the same page, rows grouped by visit.
- Same city, different building (arena vs stadium) = separate pages.
- `/events/monster-jam` is the show hub: every stop by month, linking to stop pages and venue pages. It states plainly that it lists stops at venues PromoNight covers, not the full tour. No general guide: run time, noise and ticket ages are not stored facts (see "As built"). It must exist as a page, since that path otherwise falls through to `[sport]/[team]`.
- `/events` lists shows and links to the hub. With one show at launch it can be a thin index.

## Page content (mobile first, one `<article>`, per-promo template as the base)
Design reference: docs/events-monster-jam-mockup.html (static, 390px, example data). Section order, spacing, type and CTA shape are the target. Design canvas: "PromoNight Monster Jam Event Page Mockup".
- H1, venue, date range
- Performance rows: date, showtime, one "Tickets" button per performance deep-linked to that exact event, grouped by visit. All ticket rows sit above the image card.
- EVENT FACTS LIVE ON THE STOP, not on the hub: `bagPolicy` and `eventPolicies` (bag rule for this event, Pit Party windows, gate times, re-entry), each read from the venue's own page for this event and stored with its quote, page and read time. The hub keeps the building's facts.
- BAG PRECEDENCE on a stop page, the first that exists and nothing else: (a) the venue's rule for this event; (b) the operator's all-events rule; (c) the operator's rule for other events, with its caveat; (d) a pointer, "{Venue} sets its bag policy per event", linking the operator's bag page. The hub's own bag rule never renders on a stop page.
- Parking (ruling 2026-11-18, Phase 2C): NO lot list. The hub's lots were written for the home team's game days, and no sentence filter made them safe to print for a touring show (a permit lot or a team-only shuttle lot survived as a bare name). The page shows a Reserve parking button, one link to the venue page's parking section, and one line: "Event-day lots and prices can differ from game days." A parking card renders only from parking facts the venue printed for this event, stored on the stop (`eventPolicies`); none is stored today, so none renders. Nothing in the title, description or FAQ promises a parking list.
- Transit: the hub's lines and note, cut for an event day (no currency amount, tenant or league name, game-day word, clock time or fare).
- Pit Party per performance where the venue prints it, attributed to the venue with its source link, and one line saying it is a separate pass not sold through the buttons. U.S. Bank Stadium's Sunday window is HELD (the venue's printed window ends 3.5 hours before the show); Saturday renders.
- Nothing else renders unless it is a stored, quoted fact: no run time, no ear protection, no child ticket ages, no stroller rules, no truck lineup.
- FAQs from stored fields only
- Affiliate disclosure under ticket buttons
- Every page must answer things the official site does not. No page ships as listings only.

## Search targets (Ahrefs US, pulled 2026-11-17; relative signal only, take magnitudes from GSC)
Stop pages, primary: "monster jam {city}". Difficulty 0 to 5 except Houston (17).
| City | Volume/mo |
|---|---|
| Houston | 6,100 |
| Anaheim | 5,100 |
| Denver | 4,400 |
| Tampa | 3,900 |
| Detroit | 2,700 |
| Cleveland | 2,600 |
| Pittsburgh | 2,300 |
| San Diego | 2,300 |
| Minneapolis | 2,200 |
| Nashville | 1,900 |
| Indianapolis | 1,800 |
| Portland | 1,600 |
| New Orleans | 1,400 |
| Baltimore | 1,300 |
| Milwaukee | 1,100 |
| Buffalo | 800 |
| Arlington | 600 |

Stop pages, secondary: "monster jam {venue}" (angel stadium 400, ford field 350, gillette stadium 350, ubs arena 350, us bank stadium 200, lucas oil stadium 200; difficulty 0 to 1).

Stop page FAQ: "monster jam pit party" 800, "monster jam bag policy" 70 (traffic potential 1,100), "what to wear to monster jam" 60, "is monster jam loud" 60, "monster jam age limit" 40.

Show hub: "monster jam near me" 3,000 (difficulty 0), "monster jam schedule" 2,400 (difficulty 41), "monster jam 2027" 1,300 (difficulty 1), "how long is monster jam" 2,800 (difficulty 23).

Not targeted: "monster jam" 154,000 and "monster jam tickets" 12,000.

Title and heading rules:
- Stop page title: "Monster Jam {City} {Year}: Dates, Tickets and Bag Policy | PromoNight". The year is the year of the last upcoming performance and is in the title, never in the URL. When the page prints no bag rule (pointer only) the title is "Monster Jam {City} {Year}: Dates and Tickets | PromoNight".
- Stop page H1: "Monster Jam {City} at {Venue}". City first, since the city term carries about ten times the venue term.
- {City} is the city fans search, which is not always the venue's postal city (Anaheim, Arlington, Foxborough, East Rutherford, Elmont). Store it as an explicit field per stop; do not derive it from the address.
- Hub title: "Monster Jam {Year}: Dates, Tickets and Venue Guides | PromoNight" (changed 2026-11-18: the hub lists stops at venues PromoNight covers, so it does not claim to be the schedule or every stop).
- No hardcoded counts in copy; derive from source functions.
- Expect position 4 to 8, behind the official site, Ticketmaster and the venue. Demand bunches in the weeks before each stop.

## Ticket CTA
- Launch on TicketNetwork (12.5%), single button per row, same as the leagues.
- No Ticketmaster primary link beside it: roughly 1% on primary sales, nothing during presales or the first 24 hours of an onsale, and it would pull clicks from the paying button.
- Provider is config, not hardcoded. Each performance row stores an event ID per provider; a flag picks which one the button uses. If the StubHub deal lands (pending: 60-day 50/50 test at 4%, or exclusive at 6%), events switch with everything else.
- Schedule source is separate from the ticket link, so nothing depends on StubHub API access.
- Sold out or off sale: disabled button with status. Never link a dead listing.
- Never show side-by-side marketplace prices.
- Watch item: family shows sell mostly at face value on Ticketmaster with thinner resale demand, so events may be where TicketNetwork out-earns StubHub even if StubHub wins the leagues. Track events as their own EPC line.

## Schema
One Event per performance (own startDate and offer), not one per page. The offer's url is the stop page URL: no affiliate or tracking URL appears anywhere in structured data (ruling 2026-11-18, Phase 2B). No price.

## Lifecycle
- Between seasons the page stays up. Past showtimes lose their buttons and move to a "Last visit" block; the top reads "Returns in {year}, dates TBA" until new dates arrive.
- Tombstone, never delete.
- Reuse per-promo automation: revalidate + IndexNow on write, publish verification, weekly tripwires.

## Images
- Do not scrape truck art or promotional images. They belong to Feld Entertainment and trucks like Grave Digger are trademarked characters.
- GENERATED CARD ONLY (ruling 2026-11-17): a text card per stop from the per-promo card step (PromoNight wordmark, "Monster Jam {Year}", venue, search city, date range), served at /api/event-card/{show}~{venue}. It is the page image, the og:image and the JSON-LD image. No truck art, no logos, no fetched image of any kind. No program terms on file cover TicketNetwork performer or event images, so those are never fetched or stored.
- Truck names in text are fine. Logos and art are not. Feld press media is editorial-licensed; do not use without written permission.

## Navigation and internal linking
- NOTHING FROM THE TOUR OPERATOR (ruling 2026-11-17): nothing is ingested, hand-entered or quoted from monsterjam.com or feldentertainment.com, and no page links to them. Every /events page carries the line "PromoNight is not affiliated with Monster Jam or Feld Entertainment."
- No "Events" in the top nav at launch.
- Venue pages: "Upcoming events at [venue]" module (the main bridge).
- Home-team pages for that building: "Also at [venue]" link when a stop is upcoming.
- Footer: sitewide "Events" link to `/events`.
- Hub and venue pages link both ways.
- Promote to top nav when the test passes or a second show type launches.

## Raptive
- CLEARED 2026-11-17. Raptive (Emily, Policy Compliance Specialist) confirmed in writing that pages written for adults are within policy and do not violate the service agreement. She explained the clause refers to COPPA: sites directed at an audience under 13 cannot serve behavioral ads. The email described Monster Jam and named Disney on Ice and Paw Patrol Live as possible follow-ons with the same adult, ticket-buyer focus. The condition to keep true: pages stay written for adults, with no content, games or data collection aimed at children.
- After launch, send Adam Giacopuzzi a live example URL (Raptive asked for it).
- Placement: reuse the per-promo wrapper, no Raptive request needed. Per the 2026-10-30 thread with Adam Giacopuzzi (Installs Manager, ticket 485443): Raptive's default selectors picked up the new page family on their own, and the custom layout is keyed to `.pn-promo-page .page-content` (a server-rendered `div.pn-promo-page` as the direct parent of the article). Wrap event pages the same way and they inherit that layout: density-based placement, interscroller off, nothing above the image.
- Placement is density-based, so exact ad positions are not controllable; check where the first unit lands on a five-show stop.
- Verify ads on a live page on mobile after launch (the September zero-placement bug came from a `display:contents` shell).

## Success read (6 weeks after launch)
1. GSC impressions and position on "monster jam [city]" queries (GSC export, not Ahrefs, for magnitude)
2. Ticket CTA click-through per page
3. Revenue per pageview vs per-promo pages (Raptive RPM plus affiliate EPC, events as a separate line)

Pass = move to Disney on Ice and Paw Patrol Live and add Events to the top nav. Fail = pages stay up as evergreen, no further show types.

## Analytics (required scope, not a follow-up)
Goal: read /events on its own, with nothing blended into or out of the rest of the site.

Page identity:
- Every page under /events sends page_type (events_index, event_hub, event_stop), show and venue slug on the PostHog page_view event, and GA4 content_group "events". The /events/ path prefix is the fallback filter in GA4, GSC and Raptive.

Ticket and partner clicks:
- New surfaces: web_event_page (stop page) and web_event_hub. Added to AnalyticsSurface, KNOWN_SURFACES and TnSubIdSurface, docs/cta-registry.md and the prebuild verify-affiliate-tracking check.
- Sub-ID for events: subId1={surface}_{show}_{venueSlug}, since there is no team. Sales then report per stop on the partner side, separate from team sales. Same scheme for parking and hotel links.
- The click event carries surface, show, venue slug, performance key and provider.

Traffic in and out (the part that gets muddy):
- Every internal link INTO /events goes through one helper and carries a surface: venue_events_module, team_also_at, footer_events, events_hub_list. A test asserts every surface uses the helper, as promoPageHref does for promo pages.
- Every link OUT of /events to venue, team and promo pages carries a surface too (event_to_venue, event_to_team).
- Report two numbers, never one: sessions that LAND on /events (new traffic the test created) and pageviews on /events reached from inside the site (borrowed traffic).

Reads:
- Search: GSC export filtered to pages under /events/, plus queries containing "monster jam". Record the pre-launch baseline for those queries.
- Ads: Raptive per-page earnings filtered to /events/, page RPM against promo pages over the same days.
- Affiliate: partner-side sales by sub-ID, divided by clicks from the click event, as events EPC.
- Totals from GA4, channel mix from PostHog source (GA4 channel splits double-count since 2026-09-15). PostHog undercounts about 1.65x.

Boundaries:
- Record the launch instant (flag on) as a measurement boundary, like the 2026-08-07 one.
- Sitewide pages-per-session is reported with and without /events from launch day, so the test cannot move the headline metric unnoticed.
- One PostHog dashboard, "Events", filtered to page_type, built before launch.

## As built (2026-11-18, branch feature/events-pages)
- Flag: `EVENTS_PAGES_LIVE`, modeled on `PROMO_PAGES_LIVE`. Off: every /events route and the card route answer 404, the sitemap and nightly refresh carry no /events path, and no inbound link renders (the one helper, `eventPageHref`, returns null).
- Routes: `/events` (shows and next stops), `/events/[show]` (hub by month), `/events/[show]/[venue]` (stop; unknown slug 404; `previousSlugs` 308). Stop pages only carry `div.pn-promo-page` as the direct parent of `article.page-content`.
- Data: `src/lib/events/event-stops.ts` reads eventStops with its visits and performances and joins the hub's published view; the mapper gates every field. `src/lib/events/event-pages.ts` is the pure half.
- Tickets: `buildEventTicketLink` (src/lib/affiliates.ts), provider from `eventTicketVendor()` beside `TICKET_VENDOR` with `EVENT_TICKET_VENDOR_OVERRIDE`. subId1 = `{surface}_{show}_{venueSlug}`. A performance that is not on sale shows a disabled status; never a price. A performance past its start time loses its button by the clock and moves to "Last visit".
- By the clock: the stop page is ISR (one hour). The browser drops a Tickets button at the show's start instant (ShowtimeGate); the server HTML follows at the next regeneration (known-issues 105).
- Transit: the hub's lines, and its note cut to what holds for a touring show: no price, tenant, game-day word, clock time, fare or match-day service (a hub note can carry another event's trolley times). There is no parking filter, because no hub lot is printed.
- Several visits never read as one continuous range: "8 shows between Dec 19, 2026 and Feb 21, 2027". The hub lists a stop under every month one of its visits starts in.
- A stop with nothing upcoming keeps its page (title "{Show} {City} at {Venue}", no event bag rule, "Last visit"); a removed stop renders "removed" with noindex, no card and no ticket link.
- Secondary buttons: Parking only (SpotHero). The same link appears once more as "Reserve parking" in the Before you go parking block, beside the link to the venue page's parking section (`/venues/{slug}#parking`). No Hotels. No Remind me: the reminder flow is keyed to a team and a promo.
- Raptive: CLEARED 2026-11-17 (see Raptive above). Copy is written for adults buying tickets; nothing is aimed at children.
- Mockup sections NOT built, because nothing stored backs them: the three quick tiles (run time, halftime, ear protection), "Going with kids", the stroller question and the "How long is the show?" answer.
- Team-page link byte cost: measured against the 950,000-byte cap; see the Phase 2 report. `TEAM_ALSO_AT_SKIP` lists any team page that would cross it.
- moda-center: its object was deleted from `TRANSIT_SUPPRESSED`. That changes the live Moda Center venue page at merge, independent of the flag.

## Phase 0 findings (2026-11-17)
- TicketNetwork: the Impact catalog returns 233 Monster Jam items at 71 venues with stable event ids, but no showtimes (LaunchDate is midnight UTC). Showtimes, availability and the same event id come from the venue-scoped TicketNetwork page. 47 of 71 venues have two shows on one day, so performances are keyed by date and time and the date-keyed matcher is not reused.
- Images: no program terms on file cover performer or event images. Generated card only. Never fetch or store the TicketNetwork performer image or the catalog seating-chart ImageUrl. The catalog Text1 price range must never render.
- Pit Party windows and per-stop lineups exist only on monsterjam.com stop pages, which refuse plain requests. Not ingested until Matt rules on that source. Until then pitParty, doorsTime and lineup are null and the page omits them. Pit Party is a separately priced pass sold by the primary seller; there is no TicketNetwork link for it.
- Tour-wide facts (monsterjam.com FAQ): under 2 free on a lap at most venues, ages 2 and up need a ticket, some venues ticket everyone; ear protection is sold on site and may be brought from home; run time averages two hours with a 15 to 20 minute halftime. Stroller rules are per venue.
- Routing: a static `/events` segment resolves ahead of `[sport]`. `/events/monster-jam` needs its own page. Sitemap, robots (for a new card route), nightly refresh, the live battery and the affiliate surface list all need events entries. The revalidate path regex needs no change.
- Template: PromoPageView cannot be reused whole. The layout wrapper, article shell, DateTile, AffiliateDisclosure, TrackedAffiliateLink, Before you go rows and FAQ pattern carry over. The view, head builder, JSON-LD, performance row, ticket link builder, card route, data loader and breadcrumb need events variants.
- Data: new top-level collection `eventStops/{show}~{venueHubId}` with `visits` and `performances` subcollections, written by a new pipeline script modeled on scripts/tn-event-links.js.
- Hub facts were sourced for tenant game days; event-day bag and parking rules may differ. Sampled in Phase 1A.
- Exclude non-US performances and the July World Finals rows at launch.
