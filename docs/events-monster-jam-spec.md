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
- BAG PRECEDENCE on a stop page, the first that exists and nothing else: (a) the venue's rule for this event; (b) the operator's all-events rule; (c) the operator's rule for other events, with its caveat; (d) a pointer linking the operator's bag page: "Bag policy at {Venue} depends on the event." only where the operator's stored quote says the policy varies by event (decided from the quote's words, Phase 6B and 7, 2026-11-19), and "Check {Venue}'s bag policy before you go." everywhere else. The hub's own bag rule never renders on a stop page.
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
- Stop page H1: "Monster Jam {City}" (ruling 2026-11-18, Phase 3A; it was "Monster Jam {City} at {Venue}" until then). The venue is on the line under the H1. Title tags, descriptions and JSON-LD still name the venue as before.
- {City} is the city fans search, which is not always the venue's postal city (Anaheim, Arlington, Foxborough, East Rutherford, Elmont). Store it as an explicit field per stop; do not derive it from the address.
- Hub title: "Monster Jam {Year} Schedule: Dates, Cities and Tickets | PromoNight". Hub H1: "Monster Jam {Year} schedule" (ruling 2026-11-19, Phase 5A). {Year} is computed as before: the year of the last upcoming performance among the listed stops. "Schedule" is now allowed because the scope line carries the limit: directly under the H1 the page says it lists the stops at venues PromoNight covers, with the stop and show counts computed from the stored stops, and that it is not the full tour schedule. Nothing else on the page may imply the full tour. From 2026-11-18 until this ruling the title was "Monster Jam {Year}: Dates, Tickets and Venue Guides" and avoided the word.
- Hub meta description: built by `hubDescription`; it says "schedule", "dates" and "tickets" and names the limit ("at venues PromoNight covers").
- Hub "Find your city" block, above the month sections: every listed stop's search city with its venue hub's state, alphabetical, each linking to its stop page through `eventPageHref` with the `events_hub_list` surface.
- Hub Questions block, below the months, in the stop pages' Questions markup (no FAQPage JSON-LD, as on the stop pages). "What is Monster Jam?" is two sentences in our own words. "How long is a Monster Jam show?" renders only from a stored venue fact under `eventPolicies.runTime` (a key the pipeline does not write yet) and "Is Monster Jam good for kids?" only from `eventPolicies.childTicket` (a stored slot no stop fills today); each fact prints as stored, attributed "per {Venue}" with a link to the venue's own page. A question with no stored fact is not rendered, and no answer is written from general knowledge. The last question points to the stop pages and venue guides.
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

### Hero photo (ruling 2026-11-18, Phase 2D)

A RULED EXCEPTION to the never-stock rule, for decorative show heroes only. It does not extend to a stop, a venue, a truck or any page outside /events.

- File: `public/events/monster-jam-hero.jpg` (2576 by 1717), served through next/image at responsive sizes as the priority image, on the show hub and on every stop page. It is the only fetched image on an /events page.
- Source: https://pixabay.com/photos/stunt-monster-truck-vehicles-6711478/
- License: Pixabay Content License. Downloaded by Matt on 2026-11-18.
- Credit line, printed under the hero wherever the photo shows: "Photo: Marion Wellmann / Pixabay. Not a truck from this show."
- NO CROP (ruling 2026-11-18): the full truck, grille included, the crushed cars and the sky above it stay in frame at every width. The page gives the photo its natural 3:2 box (no object-fit, no fixed height), so nothing is cut at any width; the box stops at 640px (440px on a desktop, so the first Tickets button stays on the first screen of a 1280x800 laptop) and the dark band fills the sides.
- The generated text card stays the og:image and the JSON-LD image. It is no longer repeated inside the page.

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

## Restyle (2026-11-18, branch feature/events-restyle, preview only)

Design target: `docs/events-monster-jam-mockup-v2.html`. It supersedes the first mockup for look and section order. The site header and footer are unchanged (the mockup's dark header and footer are illustration only). The events accent is #f5c518; buttons stay PromoNight red.

- Hero: a dark band holding the breadcrumb, the photo, the "Live event" badge, the countdown, the H1 and the dates, then the credit line and a hazard stripe. The hero and "Pick your show" are one child of the article, so no ad can land between them.
- Countdown: days to the first upcoming show on the venue's calendar ("94 days away"; "Tomorrow"; "Today"). The server prints it and a client leaf recomputes it in the venue's zone on load and each minute; the page is also regenerated hourly and by the nightly refresh. None when nothing is upcoming.
- "Pick your show": one card per show (date tile, time, day part, Tickets). Where the venue's Pit Party time is stored for a show it prints as a strip on that show's card.
- Hour by hour: a card only for a show with at least one stored Pit Party or gate time. Its entries are stored times only (Pit Party opens, Pit Party closes, Gates open, Show starts), each venue time attributed with its source link. No invented step.
- Before you go: one card, a row each for bags (the existing precedence, unchanged), transit and parking, plus a re-entry row when the venue printed one.
  - Transit: the hub's structured lines as a plain list and a link to the venue guide's Transit row (`/venues/{slug}#transit`). No notes prose. The transit sentence filter and its tests are deleted. A hub with no structured lines shows the link alone. The row exists exactly when the venue page prints its own Transit row (`transitRowModel`).
  - Parking: as built in Phase 2C (one line, the venue guide link, Reserve parking). The separate "Parking" button under the showtimes is gone; the row's button is the page's one parking CTA.
- "Also at {Venue}": tiles (the venue guide and each home team). "More Monster Jam stops": dark tiles with dates; link text "See all stops we cover".
- Hub: the same photo heads it. A multi-visit stop appears under each month with only that month's visit dates and show count. No promise of parking details. Counts read "N stops we cover".
- Flag-independent change: the venue page's Transit row carries `id="transit"` (the link's target), like the `#parking` anchor of Phase 2C.

## Launch record (2026-11-18, Phase 4B)

- **Launch instant, the measurement boundary:** 2026-11-19T00:10:10Z, which is Nov 18, 2026, 6:10:10 PM CST (America/Chicago). Everything measured for this family (Search Console, GA4, PostHog, affiliate clicks) is read from this instant forward. The six-week success read counts from it.
- **Deploy:** `dpl_62gDudZPUGcHoPjSGe7RGxESGYdK`, production, main at `ff00987`, with `EVENTS_PAGES_LIVE=true` set for Production. The flag is no longer set for any Preview branch.
- **Prior exposure, not the launch:** the flag was on in Production from 2026-11-18T23:54:12Z for about seven minutes (deploy `dpl_EmJn2hQHzfmJTbvromC8vmno64kd`) and was rolled back at about 2026-11-19T00:01Z (deploy `dpl_FWYCYruiMmCnT9T5t2zwMa7TU7vj`). The rollback followed a check that expected a nav link, which was an error in the check, not in the build. In that window the sitemap listed the /events URLs; nothing was submitted to IndexNow.
- **Navigation is a footer link only.** The sitewide entry point is the footer "Events" link (surface `footer_events`). There is no Events link in the header nav and none is in scope. The other entry points are the events module on a venue page (`venue_events_module`) and the "also at" block on a team page (`team_also_at`).
- **Search Console baseline:** queries containing "monster jam" returned zero for Oct 19 to Nov 17, 2026. The baseline was pulled by Claude through the Search Console connector, not read by Matt (corrected 2026-11-19). Any impression or click on such a query after the launch instant is new.
- **Launch set:** 20 stops, including moda-center (written in Phase 3B). This is the stored set at the launch instant, recorded once as history; page copy and checks still read their counts at run time.
- **At launch, as read from production:** the sitemap listed the index, the one show hub and one URL per stored live stop, and Firestore held the same set of live stops with none tombstoned. The counts are read at run time by the live battery; none is recorded here as a fixed number.
- **IndexNow:** the index, the hub and every stored stop URL were submitted once at 2026-11-19T00:14Z through `/api/indexnow/submit` (response 200, all accepted). `EVENT_STOPS_INDEXNOW_LIVE=true` is set in the pipeline operator's env file; an event-stops execute reads it from its shell.
- **Checks passed with the flag on:** the live battery (the /events guard in its flag-on branch), status, indexability and self canonical on the index, the hub and three stops, the text card as og:image, no affiliate or tracked URL in JSON-LD, the ticket link subId1 form `web_event_page_{show}_{venueSlug}`, the three entry points with their surfaces, the `div.pn-promo-page > article.page-content` wrapper, and the `page_view` payload (`page_type: event_stop`, `show`, `venue_slug`, `content_group: events`), captured in a browser because it is built client side from the path.

## Live as of 2026-11-19 (Phases 5A to 7D)

This section is the current state. Where it disagrees with an older section above, this section is right.

### Hub (/events/monster-jam)
- Title "Monster Jam {Year} Schedule: Dates, Cities and Tickets | PromoNight", H1 "Monster Jam {Year} schedule", with the scope line under the H1 carrying the limit and the computed stop and show counts.
- "Find your city": city-only pills, one sideways-scrolling row on a phone, two centered rows from 1024. A pill adds the venue name only when two listed stops share a city.
- Questions: "What is Monster Jam?" (our words), "Do kids need a ticket for Monster Jam?" and the pointer question. The kids question renders only from stored child ticket rules, each printed as stored and attributed "per {Venue}" with its source link, under the lead "Each venue sets its own rule, and other venues may differ. These venues print a rule for their shows:". The run time question renders only from a stored run time; none is stored, so it does not render.

### Stop pages
- Kids' tickets row in Before you go: only where the stop stores a child ticket rule for a stored, upcoming visit; one line per distinct rule, with its source.
- Bag pointer line, two forms. "Bag policy at {Venue} depends on the event." prints only where the operator's stored quote itself says the bag policy varies by event (decided on the server from the quote's words by `bagQuoteSaysPerEvent`; today Ball Arena and U.S. Bank Stadium). Every other pointer stop prints "Check {Venue}'s bag policy before you go." Both carry the same link to the operator's bag page. The quotes are a copy of the pipeline's reviewed bag scope file (`src/lib/events/bag-scope-quotes.json`), held equal by a pipeline-copy test, and never reach a page.
- A bag rule that covers some visits says so as a positive statement only ("{Venue} prints this for the Feb 6 to 7 shows."). The page never says what a venue has not published.
- Pit Party wording: "Separate pass." and the two pass sentences print only where the stored venue quote or its context names a pass, for every window shown (`passStated`, computed on the server). Where the quote names no pass, the entry is the window and its attribution and nothing more.
- Hour by hour sources: one line per source page. Where a venue has one page per show, each line names the show it covers ("Sat, Feb 6 gate time as listed by Lucas Oil Stadium").
- A renamed venue: the stop prints "Formerly {name}" under the venue line when the hub has a former name. The venue page keeps its ruled H1 form, "{Name} Bag Policy (formerly {FormerName})".

### Facts written in Phase 5D (2026-11-19)
Each stored with its verbatim quote, page and read time, after Matt's review stamp.
- AT&T Stadium: child ticket rule; event page address with the trailing slash.
- Ball Arena: child ticket rule.
- Lucas Oil Stadium: child ticket rule; gate times for both shows (3:30 PM Saturday, 1:30 PM Sunday, the Sunday time from the Day 2 page).
- Delta Center and Golden 1 Center: the bag rule each event page prints.
- Pipeline fields added beside the child ticket slot: run time, hearing protection note, age note (optional keys, text equal to the quote). None is stored.
- Source rule: a fact's page must be on the hub's stored host (the operator page in the reviewed bag scope file), its subdomain, or a named alternate host. Nothing from the tour operator's sites.

### Reliant Stadium (renamed from NRG Stadium), executed 2026-11-19
- Display name "Reliant Stadium" on the venue hub, the older venues doc, the Texans home game docs and the pipeline display strings. Former name "NRG Stadium" recorded on the hub with no end date, because the operator's site prints none.
- Slugs, doc ids and map keys stay `nrg-stadium`. No redirect. `/world-cup` and the street address are unchanged by ruling.
- reliantpark.com is the operator's named alternate host for nrg-stadium only. The Houston stop's source links point there.

### Weekly refresh (pipeline, `.github/workflows/event-stops-refresh.yml`)
- Runs every Monday at 13:00 UTC and by hand. Always a dry run with a production baseline. An execute under a schedule is refused by both scripts; a write stays a person's command with a record, its sha256 and named stops.
- A run ends failed, with a short summary, when it proposes any change or tombstone, when a stop is held or a stored stop could not be planned, when a stored quote, context or extra quote is gone from its page, or when a page that carries a stored fact for a show inside 30 days could not be read. No proposals is a green run. A stop with no venue page on file, or an unread page that carries no stored fact, is a printed note.
- Partial read tripwire: with at least eight future stored shows carrying catalog ids, a catalog read that holds fewer than half of them is reported as a partial read and proposes nothing.
- Venue pages: a plain request first. A page that refuses it (401, 403, 406, 429 or a 5xx) is read once through Firecrawl in basic mode; stealth, enhanced and auto are banned in code. A page on the venue's own site that a stored fact was read on, news pages included, may be re-read.
- Per-fact check: each stored fact is verified on the page it was read on, covering its quote, its context and any extra quotes.
- Matching: a stored string that starts or ends with a digit does not match inside a longer number or time ("1:30 PM" is not found in "11:30 PM"). A quote and its context must sit within 600 characters of visible page text, in the same text body.

### The floor export chore
- The refresh reads the committed `data/event-stops-floor.json` in the pipeline repo and accepts it up to 35 days old. It cannot make one itself, because the export runs the web repo's own predicates.
- Re-export at least monthly and after any venue rename, then commit and push. The staleness failure prints the command. Last export 2026-11-19; the next is due by about 2026-12-20.
- A record planned from a floor older than 48 hours cannot be executed: export a fresh floor and plan again before any execute.

## Held and parked

- Gillette Stadium and MetLife Stadium (April shows): held, not live. Gillette's hub is below the floor on the page as built; MetLife has no performances planned. Both have entries in the reviewed files and can be planned when their holds clear.
- U.S. Bank Stadium, Sunday Pit Party: the venue still prints 9:30 a.m. to 11:30 a.m. for the 3 p.m. Sunday show. Removed by ruling and not stored; it stays out unless the page prints a different window.
- Angel Stadium: the operator's bag policy does not say which events it covers, so it is not filed (ruling 2026-11-19). The stop has no venue event page on file and shows no bag rule, gate time or Pit Party.
- Run time, hearing protection and age notes: no venue page read so far prints one. The fields exist; the hub's run time question stays unrendered.
- Not filed by ruling: Rocket Arena's ear plug sentence (inside merchandise copy), Ford Field's "Backpacks are NOT permitted" (a partial rule), Rocket Arena's "Ages 2 & up require a ticket" (inside the Pit Pass item), Ball Arena's "Doors 6:00 PM" (not tied to a show).
- Block-aware matching: the proximity rule measures distance, not page structure. Tying a quote to its own heading or list block is parked; see known-issues 117.

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
