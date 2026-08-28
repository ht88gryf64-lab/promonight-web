# CFB venue wiring check: what venueHubs already holds for the 86 resolved schools

Read-only, 2026-08-27, against Firestore (venueHubs 223 docs and their tenants subcollections, cfbVenues 86, cfbSchools 87), production HTML (cache-busting curls of all 87 school pages, four venue pages), the live sitemap, and Google Search Console through the Ahrefs project (2026-05-29 to 2026-08-24). No writes, no code changes, no plan.

Context that prompted this: /venues/beaver-stadium renders full Penn State gameday logistics sourced to gopsusports.com and map.psu.edu and links to /cfb/penn-state, while the CFB school page renders none of it. The Phase 0 report counted parking, transit, gatesOpenRule and tailgating at 0 of 86 because it read cfbVenues; that content lives in venueHubs.

## 1. The join

**86 of 86 resolved cfbVenues docs have a venueHubs doc, and three join keys all work, because the two collections use the same document ids.**

| key | matches of 86 | note |
|---|---|---|
| venueHubs.tenants[] entry with league CFB and teamId == cfbSchools.id | 86 | the key the code uses (getTeamVenueHubMap, src/lib/venue-hub.ts) |
| venueHubs.legacyVenueIds contains "cfbVenues/{cfbVenues id}" | 86 | provenance pointer written when the hub was built from the cfbVenues doc |
| venueHubs doc id == cfbVenues doc id | 86 | same slug on both sides for every one of the 86 |

cfbSchools.venueId points at cfbVenues only; no venueId names a venueHubs id that is not also a cfbVenues id. The two collections describe the same 86 stadiums under the same ids: every CFB hub carries sourceCollections ["cfbVenues"], so the hub was derived from the cfbVenues doc and kept its id. Five of the 86 buildings are shared with a pro tenant on the same hub doc: hard-rock-stadium (NFL/CFB), acrisure-stadium (NFL/CFB), snapdragon-stadium (MLS/CFB), raymond-james-stadium (NFL/CFB), allegiant-stadium (NFL/CFB). Washington State has no cfbVenues doc and no hub, so it is the 87th school with nothing to join. Total CFB-tenant hubs in venueHubs: 86, exactly the resolved set; the tenants subcollections hold 91 tenant docs across those 86 hubs (the five shared buildings carry a pro tenant doc too).

## 2. Field population, one row per venue

Field mapping onto the venueHubs schema (src/lib/venue-hub.ts): parking = any of parkingLotMapUrl, officialParkingUrls, parkingLots; parkingLots = the lot array; transit = publicTransit lines or notes; rideshare = rideshareDropoff; gateTimes = the CFB tenant overlay gatesOpen (ruleText or minutesBefore, from the tenants subcollection, which is where the pro pages read it too); tailgating = tailgating.allowed, rules or timeWindow; accessibility; bagPolicy = any of clearBagRequired, bagMaxDimensions, bagPolicyUrl, bagPolicyNotes, bagsProhibited; outsideFood = outsideFoodAllowed or outsideFoodRules; concessions = food; neighborhood = nearby; capacity numeric; sources = a non-empty sources map. Beaver Stadium first; then by logistics count.

Counts of 86: parking 84, parkingLots 73, transit 53, rideshare 37, gateTimes 74, tailgating 79, accessibility 75, bagPolicy 82, outsideFood 70, concessions 64, neighborhood 11, capacity 73, sources 85. verified true on 73; above the index floor (coords, verified, two of bag/parking/transit) on 64.

| # | school | venueHubs doc | anchor | parking | parkingLots | transit | rideshare | gateTimes | tailgating | accessibility | bagPolicy | outsideFood | concessions | neighborhood | capacity | sources | logistics n/11 | verified | indexable | in sitemap | school links to it |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| 1 | penn-state | beaver-stadium | yes | y | y | y | y | y | y | y | y | y | y | y | y | y | 11 | y | y | y | y |
| 2 | rutgers | shi-stadium |  | y | y | y | y | y | y | y | y | y | y | y | y | y | 11 | y | y | y | y |
| 3 | san-diego-state | snapdragon-stadium |  | y | y | y | y | y | y | y | y | y | y | y | y | y | 11 | y | y | y | y |
| 4 | west-virginia | milan-puskar-stadium |  | y | y | y | y | y | y | y | y | y | y | y | y | y | 11 | y | y | y | y |
| 5 | alabama | saban-field-at-bryant-denny-stadium | yes | y | y | y | y | y | y | y | y | y | y | . | y | y | 10 | y | y | y | y |
| 6 | arizona | casino-del-sol-stadium |  | y | y | y | y | y | y | y | y | y | y | . | y | y | 10 | y | y | y | y |
| 7 | arkansas | donald-w-reynolds-razorback-stadium |  | y | y | y | y | y | y | y | y | y | y | . | . | y | 10 | y | y | y | y |
| 8 | boston-college | alumni-stadium |  | y | y | y | y | y | y | y | y | y | y | . | y | y | 10 | y | y | y | y |
| 9 | georgia | sanford-stadium | yes | y | y | y | . | y | y | y | y | y | y | y | y | y | 10 | . | . | . | . |
| 10 | houston | space-city-financial-stadium |  | y | y | y | y | y | y | y | y | y | y | . | y | y | 10 | y | y | y | y |
| 11 | james-madison | bridgeforth-stadium-and-zane-showker-field |  | y | y | y | y | y | y | y | y | y | y | . | y | y | 10 | . | . | . | . |
| 12 | memphis | simmons-bank-liberty-stadium |  | y | y | y | y | y | y | y | y | y | y | . | . | y | 10 | . | . | . | . |
| 13 | nebraska | memorial-stadium-lincoln | yes | y | y | y | y | y | y | y | y | y | y | . | . | y | 10 | y | y | y | y |
| 14 | north-carolina | kenan-stadium | yes | y | y | y | y | y | y | y | y | y | y | . | y | y | 10 | y | y | y | y |
| 15 | notre-dame | notre-dame-stadium | yes | y | y | y | y | y | y | y | y | y | y | . | . | y | 10 | y | y | y | y |
| 16 | syracuse | jma-wireless-dome |  | y | y | y | y | y | y | y | y | y | y | . | . | y | 10 | y | y | y | y |
| 17 | tcu | amon-g-carter-stadium |  | y | y | y | y | y | y | y | y | y | y | . | y | y | 10 | y | y | y | y |
| 18 | tennessee | neyland-stadium | yes | y | y | y | y | y | y | y | y | y | y | . | y | y | 10 | y | y | y | y |
| 19 | texas | darrell-k-royal-texas-memorial-stadium | yes | y | y | y | y | y | y | y | y | y | y | . | y | y | 10 | y | y | y | y |
| 20 | texas-am | kyle-field | yes | y | y | y | y | y | y | y | y | y | y | . | y | y | 10 | y | y | y | y |
| 21 | texas-tech | jones-stadium |  | y | y | y | . | y | y | y | y | y | y | y | . | y | 10 | y | y | y | y |
| 22 | ucla | rose-bowl-stadium |  | y | y | y | y | y | y | y | y | y | y | . | y | y | 10 | y | y | y | y |
| 23 | uconn | pratt-whitney-stadium-at-rentschler-field |  | y | y | y | y | y | y | y | y | y | y | . | y | y | 10 | y | y | y | y |
| 24 | unlv | allegiant-stadium |  | y | y | y | y | . | y | y | y | y | y | y | y | y | 10 | y | y | y | y |
| 25 | washington | husky-stadium |  | y | y | y | y | y | y | y | y | y | y | . | y | y | 10 | y | y | y | y |
| 26 | wisconsin | camp-randall-stadium | yes | y | y | y | . | y | y | y | y | y | y | y | y | y | 10 | y | y | y | y |
| 27 | arizona-state | mountain-america-stadium |  | y | y | y | y | y | y | y | y | . | y | . | y | y | 9 | y | y | y | y |
| 28 | boise-state | albertsons-stadium |  | y | y | y | y | y | y | y | y | . | y | . | y | y | 9 | y | y | y | y |
| 29 | cincinnati | nippert-stadium |  | y | y | y | . | y | y | y | y | y | y | . | y | y | 9 | y | y | y | y |
| 30 | clemson | memorial-stadium-clemson | yes | y | y | y | . | y | y | y | y | y | y | . | y | y | 9 | y | y | y | y |
| 31 | fresno-state | valley-childrens-stadium |  | y | y | y | . | . | y | y | y | y | y | y | y | y | 9 | y | y | y | y |
| 32 | georgia-tech | bobby-dodd-stadium |  | y | y | y | y | y | y | y | y | y | . | . | y | y | 9 | y | y | y | y |
| 33 | kentucky | kroger-field |  | y | y | y | . | y | y | y | y | y | y | . | y | y | 9 | y | y | y | y |
| 34 | maryland | secu-stadium |  | y | y | y | . | y | y | y | y | y | y | . | y | y | 9 | y | y | y | y |
| 35 | michigan | michigan-stadium | yes | y | y | y | . | y | y | y | y | y | y | . | y | y | 9 | . | . | . | . |
| 36 | minnesota | huntington-bank-stadium |  | y | y | y | . | y | y | y | y | y | y | . | y | y | 9 | y | y | y | y |
| 37 | northwestern | martin-stadium-northwestern-university |  | y | y | y | . | y | y | y | y | y | y | . | y | y | 9 | . | . | . | . |
| 38 | ohio-state | ohio-stadium | yes | y | y | y | y | y | y | y | y | y | . | . | y | y | 9 | y | y | y | y |
| 39 | oklahoma-state | boone-pickens-stadium | yes | y | y | y | . | y | y | y | y | y | y | . | y | y | 9 | y | y | y | y |
| 40 | ole-miss | vaught-hemingway-stadium | yes | y | y | . | y | y | y | y | y | y | y | . | y | y | 9 | y | y | y | y |
| 41 | purdue | ross-ade-stadium |  | y | y | y | . | y | y | y | y | y | y | . | y | y | 9 | y | y | y | y |
| 42 | virginia | scott-stadium |  | y | y | y | . | y | y | y | y | y | y | . | y | y | 9 | y | y | y | y |
| 43 | virginia-tech | lane-stadium |  | y | y | y | . | y | y | y | y | y | y | . | y | y | 9 | y | y | y | y |
| 44 | wake-forest | allegacy-federal-credit-union-stadium |  | y | y | . | y | y | y | y | y | y | y | . | y | y | 9 | y | y | y | y |
| 45 | baylor | mclane-stadium |  | y | y | . | . | y | y | y | y | y | y | . | y | y | 8 | y | y | y | y |
| 46 | colorado | folsom-field |  | y | y | y | . | y | y | y | y | . | y | . | y | y | 8 | y | y | y | y |
| 47 | duke | wallace-wade-stadium |  | y | y | . | . | y | y | y | y | y | y | . | y | y | 8 | y | y | y | y |
| 48 | florida | ben-hill-griffin-stadium | yes | y | y | . | . | y | y | y | y | y | y | . | y | y | 8 | y | y | y | y |
| 49 | florida-state | doak-campbell-stadium | yes | y | y | . | . | y | y | y | y | y | y | . | y | y | 8 | . | . | . | . |
| 50 | illinois | gies-memorial-stadium |  | y | y | . | . | y | y | y | y | y | y | . | y | y | 8 | y | y | y | y |
| 51 | iowa | kinnick-stadium |  | y | . | . | . | y | y | y | y | y | y | y | y | y | 8 | y | . | . | . |
| 52 | iowa-state | jack-trice-stadium |  | y | y | y | y | y | y | y | y | . | . | . | y | y | 8 | y | y | y | y |
| 53 | liberty | williams-stadium |  | y | y | . | . | y | y | y | y | y | y | . | y | y | 8 | y | y | y | y |
| 54 | lsu | tiger-stadium-louisiana | yes | y | y | . | . | y | y | y | y | y | y | . | y | y | 8 | y | y | y | y |
| 55 | michigan-state | spartan-stadium-east-lansing-michigan |  | y | y | . | . | y | y | y | y | y | y | . | y | y | 8 | y | y | y | y |
| 56 | mississippi-state | davis-wade-stadium |  | y | y | y | . | y | y | y | y | y | . | . | y | y | 8 | y | y | y | y |
| 57 | navy | navy-marine-corps-memorial-stadium |  | y | y | . | . | y | y | y | y | y | y | . | y | y | 8 | . | . | . | . |
| 58 | northern-illinois | huskie-stadium |  | y | y | y | . | y | y | y | y | y | . | . | . | y | 8 | . | . | . | . |
| 59 | pittsburgh | acrisure-stadium |  | y | . | y | . | y | y | y | y | y | y | . | y | y | 8 | y | y | y | y |
| 60 | south-florida | raymond-james-stadium |  | y | y | . | . | y | y | y | y | y | y | . | . | y | 8 | y | y | y | y |
| 61 | stanford | stanford-stadium |  | y | y | y | . | y | y | y | y | . | y | . | y | y | 8 | y | y | y | y |
| 62 | tulane | yulman-stadium |  | y | y | . | . | y | y | y | y | y | y | . | y | y | 8 | y | y | y | y |
| 63 | utah | rice-eccles-stadium | yes | y | y | y | y | y | y | . | y | . | y | . | y | y | 8 | y | y | y | y |
| 64 | vanderbilt | firstbank-stadium |  | y | y | . | y | y | y | y | y | y | . | . | . | y | 8 | y | y | y | y |
| 65 | california | california-memorial-stadium |  | y | . | . | y | y | y | y | y | y | . | . | . | y | 7 | y | . | . | . |
| 66 | kansas-state | bill-snyder-family-football-stadium | yes | y | y | . | y | y | y | y | . | y | . | . | y | y | 7 | y | . | . | . |
| 67 | louisville | ln-federal-credit-union-stadium |  | y | y | . | y | . | y | y | y | . | y | . | y | y | 7 | . | . | . | . |
| 68 | miami | hard-rock-stadium | yes | y | y | y | y | . | y | y | y | . | . | . | y | y | 7 | y | y | y | y |
| 69 | nc-state | carter-finley-stadium |  | y | y | y | . | y | y | y | y | . | . | . | y | y | 7 | y | y | y | y |
| 70 | oklahoma | gaylord-family-oklahoma-memorial-stadium | yes | y | . | . | . | y | y | y | y | y | y | . | y | y | 7 | y | y | y | y |
| 71 | smu | gerald-j-ford-stadium |  | y | . | y | . | . | . | y | y | y | y | y | y | y | 7 | y | y | y | y |
| 72 | south-carolina | williams-brice-stadium |  | y | y | . | . | y | y | y | y | y | . | . | y | y | 7 | y | y | y | y |
| 73 | usc | los-angeles-memorial-coliseum | yes | y | y | y | . | y | y | . | y | . | y | . | y | y | 7 | y | y | y | y |
| 74 | air-force | falcon-stadium |  | y | y | . | . | y | y | . | . | y | y | . | y | y | 6 | y | . | . | . |
| 75 | marshall | joan-c-edwards-stadium |  | y | . | . | . | y | . | y | y | y | y | . | . | y | 6 | y | . | . | . |
| 76 | missouri | faurot-field |  | y | y | . | . | y | y | y | y | . | . | . | y | y | 6 | y | y | y | y |
| 77 | auburn | jordan-hare-stadium | yes | y | y | . | . | . | . | y | y | y | . | . | y | y | 5 | y | y | y | y |
| 78 | byu | lavell-edwards-stadium |  | y | . | . | . | y | . | y | y | y | . | . | y | y | 5 | y | y | y | y |
| 79 | coastal-carolina | brooks-stadium |  | y | . | . | . | y | y | . | y | y | . | . | . | y | 5 | . | . | . | . |
| 80 | indiana | memorial-stadium-indiana-university |  | y | y | . | y | y | y | . | . | . | . | . | y | y | 5 | y | . | . | . |
| 81 | toledo | glass-bowl |  | y | . | . | . | . | y | . | y | y | . | . | y | y | 4 | y | . | . | . |
| 82 | ucf | acrisure-bounce-house |  | y | y | . | . | . | y | . | y | . | . | . | y | y | 4 | . | . | . | . |
| 83 | kansas | david-booth-kansas-memorial-stadium |  | y | . | . | . | . | y | . | y | . | . | . | y | y | 3 | y | . | . | . |
| 84 | appalachian-state | kidd-brewer-stadium |  | y | . | . | . | . | . | . | y | . | . | . | y | y | 2 | y | . | . | . |
| 85 | oregon | autzen-stadium | yes | . | . | . | . | . | . | . | y | y | . | . | y | y | 2 | . | . | . | . |
| 86 | army | michie-stadium |  | . | . | . | . | . | . | . | . | . | . | . | . | . | 0 | . | . | . | . |

## 3. Completeness tiers

Baseline: Beaver Stadium has all 11 logistics fields populated (parking, parkingLots, transit, rideshare, gateTimes, tailgating, accessibility, bagPolicy, outsideFood, concessions, neighborhood) plus capacity and a sources map, verified true, above the index floor.

| tier | definition | count | venues |
|---|---|---|---|
| at Beaver level | all 11 logistics fields | 4 | penn-state (beaver-stadium), rutgers (shi-stadium), san-diego-state (snapdragon-stadium), west-virginia (milan-puskar-stadium) |
| partial | 1 to 10 fields | 81 | see histogram |
| empty | 0 fields | 1 | army (michie-stadium) |

Histogram of logistics fields populated: 0 fields: 1; 2 fields: 2; 3 fields: 1; 4 fields: 2; 5 fields: 4; 6 fields: 3; 7 fields: 9; 8 fields: 20; 9 fields: 18; 10 fields: 22; 11 fields: 4. The centre of mass is 8 to 10 fields (60 of 86), so most venues are one to three fields short of the baseline, with rideshare (37), neighborhood (11) and transit (53) the usual gaps.

Thinnest, 5 fields or fewer: appalachian-state 2, oregon 2 ANCHOR, kansas 3, toledo 4, ucf 4, auburn 5 ANCHOR, byu 5, coastal-carolina 5, indiana 5.

**The only empty venue is Army (michie-stadium), not an anchor.** Anchor-25 tiers: 1 at Beaver level (penn-state), 24 partial, 0 empty. Five anchor hubs sit below the index floor and are therefore neither in the sitemap nor linked from the school page: florida-state (doak-campbell-stadium), georgia (sanford-stadium), kansas-state (bill-snyder-family-football-stadium), michigan (michigan-stadium), oregon (autzen-stadium). All 22 below-floor hubs: air-force, appalachian-state, army, california, coastal-carolina, florida-state ANCHOR, georgia ANCHOR, indiana, iowa, james-madison, kansas, kansas-state ANCHOR, louisville, marshall, memphis, michigan ANCHOR, navy, northern-illinois, northwestern, oregon ANCHOR, toledo, ucf.

## 4. The render path

- **Route:** src/app/venues/[slug]/page.tsx, SSG plus 24h ISR (revalidate 86400), generateStaticParams over getAllVenueHubSlugs. It calls getVenueHub(slug) (src/lib/venue-hub.ts:109), which reads the venueHubs doc AND its tenants subcollection and returns a VenueHub with tenantOverlays (gatesOpen, gateVariance, tailgateWindow, bagPolicyException, verified per tenant). It then resolves three more inputs in parallel: resolveTicketTeam(hub) (pro tenants first, CFB via toAffiliateTeam), resolveTenantTeamLinks(hub) (CFB tenants become /cfb/{id} links through getCfbSchool), and getVenueHubWeekPromos(hub) (CFB tenants skipped by design). Below-floor hubs still render, with robots noindex,follow.
- **Component:** src/components/venue-hub/VenueHubView.tsx, one component that takes { hub: VenueHub, canonicalUrl, ticketTeam: Team | null, tenantLinks, weekPromos } and renders the whole page: photo hero, the logistics cards, ticket and gear CTAs, the tenant teams card, promos this week. Its section building blocks are private (Card, CardLabel, formatMinutesBefore, transitMode); nothing below page scale is exported. Sibling exports are HubPromosThisWeek, HubTeamLink, VenueHubJsonLd, VenueHubLink, VenueHubPromoCard, VenuePhotoHero, none of which is a logistics block.
- **What the CFB school page has in scope today:** only a TeamVenueHubLink { slug, displayName, indexable, city } from getVenueHubForTeam (src/app/cfb/[school]/page.tsx:44), built from doc-level floor fields with no tenants read; CfbSchoolPage passes it to VenueHubLink (the "Full gameday guide" card). It does not hold a VenueHub. The full hub is one getVenueHub(link.slug) call away (a doc read plus a tenants read, request-cached), so the data is reachable without new extraction.
- **Reuse verdict, stated as fact not plan:** the page-scale component cannot be dropped into a school page as is (it renders its own hero, CTAs and teams card, on the cream house theme, and expects a canonical URL for a venue page), and there is no exported subset. Any school-page rendering of the logistics fields would be either a new block reading the same VenueHub, or a refactor that lifts the logistics cards out of VenueHubView. Both are outside this read.

## 5. Link direction, measured on production

- **Venue page to school page:** VenueHubView renders a HubTeamLink for every resolved tenant, CFB tenants to /cfb/{school}. Verified in served HTML on beaver-stadium (/cfb/penn-state), kyle-field (/cfb/texas-am), ohio-stadium (/cfb/ohio-state) and kinnick-stadium (/cfb/iowa; that page is noindex,follow and still carries the link).
- **School page to venue page:** 64 of 87 school pages link to their venue guide (the VenueHubLink card, gated on indexable). The 64 linked schools are exactly the 64 indexable hubs, and every link points at the joined hub. The 23 without a link: the 22 below-floor hubs listed in section 3 plus washington-state (no hub). So the link is bidirectional wherever the hub clears the floor, and one-directional (venue to school only) for the 22 held buildings.

## 6. Sourcing

Sample of ten hubs (Beaver first, then the other three complete ones, then anchors and thin cases):

| venueHubs doc | verified | logistics fields populated | with a sources[] entry | fields lacking provenance | gatesOpen source (tenant) | hosts cited |
|---|---|---|---|---|---|---|
| beaver-stadium | y | 9 + gates | 9 | none | y | gopsusports.com |
| shi-stadium | y | 9 + gates | 9 | none | y | scarletknights.com |
| snapdragon-stadium | y | 9 + gates | 9 | none | y | sandiegofc.com, goaztecs.com |
| milan-puskar-stadium | y | 9 + gates | 9 | none | y | wvusports.com |
| saban-field-at-bryant-denny-stadium | y | 8 + gates | 7 | tailgating | y | rolltide.com |
| ohio-stadium | y | 7 + gates | 6 | tailgating | y | ohiostatebuckeyes.com |
| kyle-field | y | 8 + gates | 7 | tailgating | y | 12thman.com, app.12thman.com |
| falcon-stadium | y | 4 + gates | 4 | none | y | goairforcefalcons.com |
| kinnick-stadium | y | 7 + gates | 7 | none | y | hawkeyesports.com |
| michie-stadium | . | 0 | 0 | none | n/a |  |

- **Every cited host is an official athletics, campus, stadium-operator or team ticketing domain**: 94 distinct hosts across the 86 hubs and their tenant overlays, all of the form gopsusports.com, rolltide.com, 12thman.com, hawkeyesports.com, allegiantstadium.com, hardrockstadium.com, and the like; no fan sites, no aggregators, no Wikipedia. Beaver Stadium additionally carries pdfSources (gopsusports.com PDFs) and a verifyNotes field recording that all 22 non-null facts were confirmed against cited dumps, with verifiedAt 2026-08-03.
- **Provenance is per field** (a sources map keyed by field on the doc, and a second sources map on the tenant overlay for gatesOpen, gateVariance, parkingPrice, tailgateWindow, bagPolicyException). 85 of 86 hubs carry a sources map (Army has none, and no data).
- **Gaps, exact:** capacity has no sources entry on any hub (the map was never designed to carry it; cfbVenues carries capacityVerified and capacitySources instead, 64 and 73 of 86). tailgating is populated without a sources.tailgating entry on 17 hubs (saban-field-at-bryant-denny-stadium, brooks-stadium, folsom-field, sanford-stadium, memorial-stadium-indiana-university, david-booth-kansas-memorial-stadium, bill-snyder-family-football-stadium, secu-stadium, simmons-bank-liberty-stadium, hard-rock-stadium, spartan-stadium-east-lansing-michigan, ohio-stadium, boone-pickens-stadium, kyle-field, yulman-stadium, rose-bowl-stadium, allegacy-federal-credit-union-stadium); parking on 2 (kidd-brewer-stadium, acrisure-stadium); transit on 1 (secu-stadium). Under the "no CFB data goes live before we love it" rule those specific field-and-hub pairs are the ones that would need a citation before a school page surfaced them; everything else populated carries one. 13 hubs are verified false (Army plus the twelve partial ones flagged in the table).

## 7. Indexing and demand

- **Sitemap:** the live sitemap lists 158 /venues/ URLs; 64 of the 86 CFB hubs are among them, exactly the indexable set; the 22 below-floor CFB hubs are omitted and serve noindex,follow.
- **GSC, 2026-05-29 to 2026-08-24 (Ahrefs project 9957864):** a pages query filtered to URLs containing /venues/ returns no rows, and the unfiltered pages table (100 rows, down to 5 impressions) contains no /venues/ URL. **No venue page has recorded an impression in the window.** The bag, parking, gate and tailgate keyword filter returns 49 queries, all landing on MLB team pages (the "gate giveaways" family: cubs 111 impressions, guardians 66, royals 64, tigers 61) plus one NBA page; none on a venue page. For scale, the CFB school pages that do register: ole-miss 66 impressions (top query am.ticketmaster.com/promotional-page), alabama 36 (iron bowl tickets 2026), auburn 11 (auburn gameday themes 2026), usc 9, lsu 7 (magnolia trophy).
- **Indexed count:** not measurable from the tools available here (no index-coverage endpoint); impressions are the only proxy and they are zero. The venue hubs went live between 2026-08-01 and 2026-08-06, so the window covers roughly three weeks of exposure.
- **What this says for the design question, as a finding:** the venue pages have no search traction yet on the logistics queries, so the "link into them rather than absorb" case cannot rest on demand evidence today; the evidence that does exist is that logistics-shaped queries reach team pages ("gate", "what time do gates open", "parking information") rather than venue pages. The 64 bidirectional links already exist; the 22 held buildings, including five anchors, have no school-page path at all.

## 8. Next data task: fields that stay silent under the per-field provenance rule

Added 2026-08-27 when the condensed logistics block shipped on the school pages (src/lib/venue-hub-condensed.ts). The block renders a field only when it is populated AND the hub carries a source for that field; the fields below are populated on the hub, carry no source, and therefore do not render on the school page until a source URL is written to venueHubs.sources (or, for gates, to the tenant overlay's sources.gatesOpen). The venue page itself still renders them, because it gates on the doc-level verified flag, not per field; that asymmetry is deliberate and this list is what closes it.

**tailgating populated, no sources.tailgating (17)**: alabama (anchor) / saban-field-at-bryant-denny-stadium; coastal-carolina / brooks-stadium; colorado / folsom-field; georgia (anchor) / sanford-stadium; indiana / memorial-stadium-indiana-university; kansas / david-booth-kansas-memorial-stadium; kansas-state (anchor) / bill-snyder-family-football-stadium; maryland / secu-stadium; memphis / simmons-bank-liberty-stadium; miami (anchor) / hard-rock-stadium; michigan-state / spartan-stadium-east-lansing-michigan; ohio-state (anchor) / ohio-stadium; oklahoma-state (anchor) / boone-pickens-stadium; texas-am (anchor) / kyle-field; tulane / yulman-stadium; ucla / rose-bowl-stadium; wake-forest / allegacy-federal-credit-union-stadium.

**parking populated, no parking source (2)**: appalachian-state / kidd-brewer-stadium; pittsburgh / acrisure-stadium.

**transit populated, no sources.publicTransit (1)**: maryland / secu-stadium.

**gates rule on the CFB tenant overlay, no overlay sources.gatesOpen (3)**: boise-state / albertsons-stadium; michigan-state / spartan-stadium-east-lansing-michigan; wake-forest / allegacy-federal-credit-union-stadium.

Anchor schools in the list: alabama, georgia, kansas-state, miami, ohio-state, oklahoma-state, texas-am. Sourcing these is a data task (find the official page each fact came from and write its URL), not a template task; the block picks each field up the moment its source lands.

## 9. Transit suppression can push a hub below the indexing floor

Added 2026-08-27 when the stale-transit sweep (audit/cfb-venue-sourcing-report.md sections 11 to 13) silenced the transit field on 32 buildings whose stored text names a service a fan cannot use.

**The interaction.** The floor is `venueHubIsIndexable`: coordinates, plus the doc-level `verified` flag, plus at least two of (bag policy, parking, transit). Transit is one of the three, so a building that clears the floor on geo + bag + transit with no parking clears it *only because of a transit field*. Suppress that field at render and the page now asserts, through the sitemap and through its own `robots` tag, a substance it no longer shows.

**Deliberately not acted on.** `src/lib/venue-transit-suppression.ts` is consulted by the render surfaces only. `venueHubIsIndexable` and `readIndexFloorFields` read the raw building doc and are untouched, which is exactly how an unsourced field already behaves: it counts toward the floor while staying off the page. The suppression list therefore changes what a page says, never whether it is indexed. A test pins this (`suppression does not touch the indexing floor, so no page is de-indexed by it`), so folding the two together cannot happen by accident.

**The live case is `providence-park`.** Measured across all 32 suppressed buildings, it is the only one whose floor depends on the suppressed field:

| Building | geo | bag | parking | transit | floor now | floor if suppression fed the floor |
| --- | --- | --- | --- | --- | --- | --- |
| providence-park | yes | yes | no | yes (suppressed) | **above** | **below** |
| all other suppressed buildings | yes | yes | yes | varies | above | above |

If the floor ever consumes the suppression list, `providence-park` drops out of `sitemap.ts`, disappears from `/venues`, its page flips to `robots: noindex, follow`, and the `VenueHubLink` card stops rendering on `/mls/portland-timbers` (that card gates on `hub.indexable`). Four user-visible consequences from one hidden field.

**The rule.** The floor changes only as its own decision, taken on indexing grounds and verified against the sitemap, `/venues`, the page's `robots` tag and the team-page card together. It is not a side effect of a copy fix. Anyone re-sourcing `providence-park`'s transit from TriMet closes this by deleting its suppression entry, which is the cheapest resolution and the one to prefer.
