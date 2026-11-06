# NHL arena data, Phase 0 read-only audit

2026-09-02. No Firestore writes, no page code, no repo commits. Zero subagents were spawned. Network budget: 38 of 40 plain fetches used (32 arena probes, 3 live PromoNight venue pages, 3 spare follow-ups), 2 of 10 Firecrawl scrapes used. Venue ids and club slugs were read from the live `teams`, `venues` and `venueHubs` collections, not from the brief.

Working files: `scratchpad/nhl-inventory.json` (full per-row dump including verbatim strings and source maps), `scratchpad/probe-arenas.json`, `scratchpad/fc-*.md` (Firecrawl markdown), `scratchpad/hub-*.html` (live page captures).

## Headline

- **All 32 clubs resolve cleanly in both corpora.** Every club hits its `venues` doc by the `{city} {name}` query (no map fallback needed, no multi-hit) and its `venueHubs` building by the tenants array (no orphan, no double tenancy).
- **venueHubs: 2 verified, 30 empty skeletons.** crypto-com-arena and climate-pledge-arena were verified by the Lane 2 / Lane 3a WNBA sweeps on 2026-07-19 (every field carries a source URL on the arena's own domain). The other 30 were seeded on 2026-07-13 with identity and geo only: no bag, parking, transit or capacity, no sources. Capacity is null on all 32. All 32 NHL tenant overlays exist and all 32 are empty and held (no gate times anywhere for the NHL).
- **venues: 11 of 32 carry prose, none carries provenance.** The 11 came from the 2026-05-23 arena batches (9) and the WNBA game-day batch (2). Zero `venues` docs anywhere in the collection have a sources map, verified flag or timestamp. Those 11 club pages publish parking, accessibility and nearby prose today from a batch whose transit field measured 79% defective; the parking and accessibility fields were never fact-checked.
- **The arena-guide rail lists exactly the 2 verified buildings**, and "verified" in code is `venueHubIsIndexable`: building doc `verified === true` AND lat/lng present AND at least two of (bag, parking, transit) populated, deduped by building.
- **11 buildings are NBA-shared and all 11 read one `venues` doc.** No duplicates. The NBA club reaches the same doc through `VENUE_RESOLUTION_MAP`, the NHL club through the name query. The C-5 divergence risk is not present today.
- **The existing pass has no verify stage.** Its only check was an HTTP status on the bag URL. The Northstar sentence was false on the day it was authored.
- **Arena sites are mostly reachable to plain HTTP: 24 of 32 render to text, 2 are JS shells, 6 are blocked** (two 406 WAF responses, two Cloudflare 403s, two certificate failures). Firecrawl got content from both JS shells. The Vegas arena site renders its bag policy to a plain fetch; the consent wall was a club-site behaviour only.
- **The game-day rule holds on web.** Three held NHL hub pages render the "still confirming" notice, noindex, no tickets card, no parking widget, no unlock affordance.

## 1. Inventory (32 rows)

Legend. venues fields: P parkingInfo, T publicTransit (stored but silenced at render), G gatesOpen (stored but silenced), B bagPolicyUrl, A accessibility, N nearby. Hub fields: B bag (any of clearBagRequired, bagMaxDimensions, bagPolicyUrl, bagPolicyNotes), P parking (lots or map URL), T transit (lines or notes), C capacity, G lat/lng. Both corpora carry lat/lng on all 32 rows. "rail" is the NHL hub arena-guide rail (`HubVenueLinks` fed by `getVenueLinksForTeams`). Upcoming = promos dated on or after 2026-09-02 under `teams/{club}/promos`.

| # | Club | venues doc (join) | venues fields P T G B A N | venues source / updatedAt | venueHubs doc | verified | hub fields B P T C G | hub sources / updatedAt | NHL overlay | rail | upcoming |
|---|---|---|---|---|---|---|---|---|---|---|---|
| 1 | anaheim-ducks | honda-center (name) | . . . . . . | none / none | honda-center | false | . . . . Y | none / 2026-07-13 | empty, held | no | 34 |
| 2 | boston-bruins (shared) | td-garden (name) | . . . . . . | none / none | td-garden | false | . . . . Y | none / 2026-07-13 | empty, held | no | 10 |
| 3 | buffalo-sabres | keybank-center (name) | . . . . . . | none / none | keybank-center | false | . . . . Y | none / 2026-07-13 | empty, held | no | 25 |
| 4 | calgary-flames | scotiabank-saddledome (name) | . . . . . . | none / none | scotiabank-saddledome | false | . . . . Y | none / 2026-07-13 | empty, held | no | 0 |
| 5 | carolina-hurricanes | lenovo-center (name) | Y Y Y Y Y Y | none / none | lenovo-center | false | . . . . Y | none / 2026-07-13 | empty, held | no | 18 |
| 6 | chicago-blackhawks (shared) | united-center (name) | . . . . . . | none / none | united-center | false | . . . . Y | none / 2026-07-13 | empty, held | no | 23 |
| 7 | colorado-avalanche (shared) | ball-arena (name) | Y Y . Y Y Y | none / none | ball-arena | false | . . . . Y | none / 2026-07-13 | empty, held | no | 23 |
| 8 | columbus-blue-jackets | nationwide-arena (name) | . . . . . . | none / none | nationwide-arena | false | . . . . Y | none / 2026-07-13 | empty, held | no | 24 |
| 9 | dallas-stars (shared) | american-airlines-center (name) | . . . . . . | none / none | american-airlines-center | false | . . . . Y | none / 2026-07-13 | empty, held | no | 28 |
| 10 | detroit-red-wings (shared) | little-caesars-arena (name) | . . . . . . | none / none | little-caesars-arena | false | . . . . Y | none / 2026-07-13 | empty, held | no | 85 |
| 11 | edmonton-oilers | rogers-place (name) | . . . . . . | none / none | rogers-place | false | . . . . Y | none / 2026-07-13 | empty, held | no | 13 |
| 12 | florida-panthers | amerant-bank-arena (name) | Y Y Y Y Y Y | none / none | amerant-bank-arena | false | . . . . Y | none / 2026-07-13 | empty, held | no | 23 |
| 13 | los-angeles-kings (shared) | crypto-com-arena (name) | Y Y . Y Y Y | none / none | crypto-com-arena | true | Y Y Y . Y | 16 fields, cryptoarena.com / 2026-07-19 | empty, held | LISTED | 80 |
| 14 | minnesota-wild | xcel-energy-center (name) | . . . . . . | none / none | xcel-energy-center | false | . . . . Y | none / 2026-07-13 | empty, held | no | 0 |
| 15 | montreal-canadiens | centre-bell (name) | Y Y Y Y Y Y | none / none | centre-bell | false | . . . . Y | none / 2026-07-13 | empty, held | no | 29 |
| 16 | nashville-predators | bridgestone-arena (name) | Y Y Y Y Y Y | none / none | bridgestone-arena | false | . . . . Y | none / 2026-07-13 | empty, held | no | 51 |
| 17 | new-jersey-devils | prudential-center (name) | . . . . . . | none / none | prudential-center | false | . . . . Y | none / 2026-07-13 | empty, held | no | 22 |
| 18 | new-york-islanders | ubs-arena (name) | . . . . . . | none / none | ubs-arena | false | . . . . Y | none / 2026-07-13 | empty, held | no | 32 |
| 19 | new-york-rangers (shared) | madison-square-garden (name) | Y Y . Y Y Y | none / none | madison-square-garden | false | . . . . Y | none / 2026-07-13 | empty, held | no | 0 |
| 20 | ottawa-senators | canadian-tire-centre (name) | . . . . . . | none / none | canadian-tire-centre | false | . . . . Y | none / 2026-07-13 | empty, held | no | 0 |
| 21 | philadelphia-flyers (shared) | wells-fargo-center (name) | . . . . . . | none / none | wells-fargo-center | false | . . . . Y | none / 2026-07-13 | empty, held | no | 0 |
| 22 | pittsburgh-penguins | ppg-paints-arena (name) | . . . . . . | none / none | ppg-paints-arena | false | . . . . Y | none / 2026-07-13 | empty, held | no | 67 |
| 23 | san-jose-sharks | sap-center (name) | . . . . . . | none / none | sap-center | false | . . . . Y | none / 2026-07-13 | empty, held | no | 43 |
| 24 | seattle-kraken | climate-pledge-arena (name) | Y Y . Y Y Y | none / none | climate-pledge-arena | true | Y Y Y . Y | 14 fields, climatepledgearena.com / 2026-07-19 | empty, held | LISTED | 4 |
| 25 | st-louis-blues | enterprise-center (name) | Y Y Y Y Y Y | none / none | enterprise-center | false | . . . . Y | none / 2026-07-13 | empty, held | no | 28 |
| 26 | tampa-bay-lightning | amalie-arena (name) | Y Y Y Y Y Y | none / none | amalie-arena | false | . . . . Y | none / 2026-07-13 | empty, held | no | 28 |
| 27 | toronto-maple-leafs (shared) | scotiabank-arena (name) | . . . . . . | none / none | scotiabank-arena | false | . . . . Y | none / 2026-07-13 | empty, held | no | 0 |
| 28 | utah-hockey-club (shared) | delta-center (name) | . . . . . . | none / none | delta-center | false | . . . . Y | none / 2026-07-13 | empty, held | no | 0 |
| 29 | vancouver-canucks | rogers-arena (name) | . . . . . . | none / none | rogers-arena | false | . . . . Y | none / 2026-07-13 | empty, held | no | 0 |
| 30 | vegas-golden-knights | t-mobile-arena (name) | Y Y Y Y Y Y | none / none | t-mobile-arena | false | . . . . Y | none / 2026-07-13 | empty, held | no | 17 |
| 31 | washington-capitals (shared) | capital-one-arena (name) | . . . . . . | none / none | capital-one-arena | false | . . . . Y | none / 2026-07-13 | empty, held | no | 0 |
| 32 | winnipeg-jets | canada-life-centre (name) | . . . . . . | none / none | canada-life-centre | false | . . . . Y | none / 2026-07-13 | empty, held | no | 32 |

Column notes.

- **venues source / updatedAt** is "none / none" on every row because no `venues` document in the collection (148 docs) carries any provenance-shaped key. Confirmed by a key sweep over the whole collection.
- **hub sources / updatedAt**: the two verified rows carry a per-field sources map (16 keys on crypto-com-arena, 14 on climate-pledge-arena, every value on the arena's own domain). The 30 held rows carry an empty map and the skeleton seed timestamp 2026-07-13.
- **NHL overlay**: `venueHubs/{slug}/tenants/{club}` exists for all 32; none has `gatesOpen`, none is verified. Even on the two verified buildings the Kings and Kraken overlays are empty, so the hub renders no gate time for either club.
- **Rail predicate, in code.** `src/lib/venue-hub.ts` `venueHubIsIndexable`: `hasGeo && twoOfThree && v.verified === true`, where twoOfThree counts bag, parking, transit. `collectVenueLinksForTeams` in `src/lib/venue-index.ts` drops any link where `indexable` is false and dedupes by building. The `verified` boolean is written only by the pipeline seed writers from the facts file's own `verified` flag; nothing on the web side can set it.
- **Club page today.** `AffiliateRail` renders the "Plan your visit" heading, then Ticketmaster, SpotHero, Expedia and Fanatics CTAs, then the hub link only when indexable (2 clubs), then `VenueInfoBlock`, which returns null when the venues doc has no renderable row (21 clubs). That is the empty heading the brief describes. The 11 clubs with venues prose render Parking, Accessibility, Bag policy link and Nearby rows from the unsourced batch.

## 2. Shared buildings

Join basis: `venueHubs.{slug}.tenants[]` (league + teamId), which the hub layer treats as the 1:1 team-to-building truth. The `venues` corpus has no link field between an NBA club and an NHL club's doc; the NBA club reaches the shared doc only because `VENUE_RESOLUTION_MAP` names it (the name query fails for co-tenants because the doc's `team` string is the NHL club). The dormant `venues.sharedTeams` arrays agree on all 11 (`bos-nba`, `chi-nba`, and so on) plus `las-wnba` on crypto-com-arena and `sea-wnba` on climate-pledge-arena.

| Building (venueHubs id) | NHL tenant | NBA tenant | Join basis | NHL club reads venues doc | NBA club reads venues doc | Same doc? |
|---|---|---|---|---|---|---|
| td-garden | boston-bruins | boston-celtics | venueHubs.tenants | td-garden (name query) | td-garden (VENUE_RESOLUTION_MAP) | yes |
| united-center | chicago-blackhawks | chicago-bulls | venueHubs.tenants | united-center (name query) | united-center (VENUE_RESOLUTION_MAP) | yes |
| ball-arena | colorado-avalanche | denver-nuggets | venueHubs.tenants | ball-arena (name query) | ball-arena (VENUE_RESOLUTION_MAP) | yes |
| american-airlines-center | dallas-stars | dallas-mavericks | venueHubs.tenants | american-airlines-center (name query) | american-airlines-center (VENUE_RESOLUTION_MAP) | yes |
| little-caesars-arena | detroit-red-wings | detroit-pistons | venueHubs.tenants | little-caesars-arena (name query) | little-caesars-arena (VENUE_RESOLUTION_MAP) | yes |
| crypto-com-arena | los-angeles-kings | los-angeles-lakers | venueHubs.tenants | crypto-com-arena (name query) | crypto-com-arena (VENUE_RESOLUTION_MAP) | yes |
| madison-square-garden | new-york-rangers | new-york-knicks | venueHubs.tenants | madison-square-garden (name query) | madison-square-garden (VENUE_RESOLUTION_MAP) | yes |
| wells-fargo-center | philadelphia-flyers | philadelphia-76ers | venueHubs.tenants | wells-fargo-center (name query) | wells-fargo-center (VENUE_RESOLUTION_MAP) | yes |
| scotiabank-arena | toronto-maple-leafs | toronto-raptors | venueHubs.tenants | scotiabank-arena (name query) | scotiabank-arena (VENUE_RESOLUTION_MAP) | yes |
| delta-center | utah-hockey-club | utah-jazz | venueHubs.tenants | delta-center (name query) | delta-center (VENUE_RESOLUTION_MAP) | yes |
| capital-one-arena | washington-capitals | washington-wizards | venueHubs.tenants | capital-one-arena (name query) | capital-one-arena (VENUE_RESOLUTION_MAP) | yes |

**Duplicates found: none.** Every NBA co-tenant reads byte-for-byte the same `venues` document its NHL partner reads, so a count or a claim cannot diverge between the two club pages today. A name-join over the whole `venues` collection (normalised name equality) found no second doc for any of the 32 NHL buildings. One coordinate near-match surfaced and is not a duplicate: `bc-place` (Whitecaps) sits about 300 m from `rogers-arena`; they are different buildings.

Two things to carry into any build: (1) the shared doc's `team` field names the NHL club, so anything keyed on that string attributes the building to hockey; (2) the shared buildings also host WNBA tenants on two of the 11 (Sparks at crypto-com-arena, Storm at climate-pledge-arena), which is why those two are the only verified NHL hubs.

## 3. The existing pass and its verify gap

The 86 `venues` docs with detail today (rendering on 100 club pages, because shared docs serve several pages) were written by three scripts in this repo, all on 2026-05-23: `scripts/populate-plan-your-visit.ts` (MLB, 30 docs, from `scripts/mlb-plan-your-visit.json` plus a hardcoded Twins block), `scripts/populate-arena-plan-your-visit.ts` (46 NBA/NHL/MLS/WNBA docs from the eight `arena-plan-your-visit-*.json` seed files) and `scripts/populate-wnba-gameday-venues.ts` (10 docs). All three write `venues/{slug}.set(payload, { merge: true })` and store no source URL, no verifier, no date. The seed JSON was authored as prose (the MLB header calls it "29 researched/verified records" with nothing behind the word), and the only check any of the three ran before writing was a curl of each `bagPolicyUrl` for an HTTP 200, replacing 404s with a live page on the same site. There is no independent verify stage: no fact in the batch was ever compared against an operator page, and nothing in the record distinguishes a true sentence from a false one. The 11 NHL docs with detail are nine from batches 1 to 3 (lenovo-center, t-mobile-arena, centre-bell, madison-square-garden, ball-arena, amalie-arena, amerant-bank-arena, bridgestone-arena, enterprise-center) and two from the WNBA game-day file (crypto-com-arena, climate-pledge-arena). The pass that verified the two NHL hubs is a different one entirely: the promo-pipeline `sweep-venue-facts.js` harvest, an extraction pass bound by `docs/EXTRACTION-RULES.md`, a verify fan-out over the cached markdown, and `seed-venuehubs-facts.js` writing per-field sources; that is the pass an NHL build should reuse.

**How Northstar got through.** The sentence "Northstar commuter rail also terminates at the stadium" was authored on 2026-04-24 in `src/lib/venue-overrides.ts` (commit 01ebf9f, "Phase 1: Team page content depth", model-authored copy). Northstar had ceased service on 2026-01-04, so the claim was already false when written. On 2026-05-23 the MLB populate script (commit 2487f58) migrated the Twins block verbatim into its `TWINS_FIELDS` constant and wrote it to `venues/target-field` under `publicTransit`; the script's Phase 2 "verification" curled the bag URL and touched nothing else. It was caught later by a human reading the page, corrected in Firestore (today the doc reads "METRO Blue and Green lines stop at Target Field Station, directly connected to the stadium." and the hub names Blue, Green and bus, all Northstar-free), and since 2026-08-29 `venues.publicTransit` is silenced at render anyway. The script on origin/main still carries the sentence and still lists `publicTransit` as a managed field, so one `--execute` re-run republishes it into Firestore (silenced, but stored). The lesson for the NHL build is exact: the value's source, not the pointer's status, is what a verify stage has to check.

## 4. Source reachability

One plain fetch per arena with a desktop Chrome user agent, redirects followed, 25 s timeout. Where a `venues` or `venueHubs` doc already stored a URL on the arena's own domain that URL was probed; otherwise the arena root. Pages discovered are same-host links harvested from the fetched HTML, not fetched. Classes: **text** = 2xx with substantive visible text; **js-only** = 2xx with a shell (under 600 chars of text); **blocked** = 4xx, WAF challenge, or TLS failure; **no-page** = 404 or DNS failure (none occurred).

Totals: text 24, js-only 2, blocked 6, no-page 0.

| Building | URL probed (basis) | HTTP | Class | Text chars | Signals | Pages discovered on the site (no extra fetch) | Note |
|---|---|---|---|---|---|---|---|
| honda-center | https://www.hondacenter.com/ (root) | 200 | text | 3,559 | onetrust | az: /plan-your-visit/parking/, /arena-info/a-z-arena-guide/; bag: /arena-info/know-before-you-go/; parking: /plan-your-visit/parking/ |  |
| td-garden | https://www.tdgarden.com/ (root) | 200 | text | 4,962 | consent-lib | az: /plan-your-visit, /plan-your-visit/seating; bag: /plan-your-visit/know-before-you-go; parking: /plan-your-visit/directions-parking, /plan-your-visit/directions-parking/directions; transit: /plan-your-visit/transportation, /plan-your-visit/transportation/jet-here |  |
| keybank-center | https://www.keybankcenter.com/ (root) | n/a | blocked (tls) | 0 | none | none harvested | www host presents a certificate for another name; apex keybankcenter.com serves the site (spare fetch, 200, 1,838 chars, nav lists Arena Guide, Know Before You Go, Parking, Transportation) |
| scotiabank-saddledome | https://www.scotiabanksaddledome.com/ (root) | 200 | text | 2,704 | consent-lib, wordpress | az: /wp-content/plugins/fusion-core/css/faqs.min.css?ver=5.7.1, /a-to-z-guide/; parking: /getting-here/, /getting-here/; transit: /getting-here/, /getting-here/ |  |
| lenovo-center | https://www.lenovocenter.com/ (root (stored URL is nhl.com club page)) | 200 | text | 6,232 | none | az: /plan-your-visit, /plan-your-visit/directions; bag: /arena-info/policies/bagpolicy; parking: /plan-your-visit/directions, /plan-your-visit/parking-guide; transit: /plan-your-visit/parking-guide/transportation |  |
| united-center | https://www.unitedcenter.com/ (root) | 403 | blocked | 774 | cloudflare-challenge | none harvested | Cloudflare challenge page to a plain fetch |
| ball-arena | https://www.ballarena.com/plan-your-visit/bag-policy/ (stored venues.bagPolicyUrl) | 200 | text | 2,588 | none | az: /plan-your-visit/attendee-health-and-safety-protocols/, /plan-your-visit/accessibility-guide/; bag: /plan-your-visit/prohibited-items/, /plan-your-visit/bag-policy/; parking: /plan-your-visit/parking-directions/, /plan-your-visit/public-transportation/; transit: /plan-your-visit/public-transportation/ |  |
| nationwide-arena | https://www.nationwidearena.com/ (root) | 200 | text | 3,018 | none | az: /guest-services, /a-z-guide; parking: /directions-parking, /plan-your-visit/directions-parking |  |
| american-airlines-center | https://www.americanairlinescenter.com/ (root) | 200 | text | 3,227 | none | az: /plan-your-visit/directions, /plan-your-visit/parking; bag: /plan-your-visit/fan-safety-guidelines; parking: /plan-your-visit/directions, /plan-your-visit/parking; transit: /plan-your-visit/public-transportation |  |
| little-caesars-arena | https://www.313presents.com/venue/little-caesars-arena (operator site (313 Presents)) | 200 | text | 29,197 | onetrust, cookie-copy-in-text, spa-root | az: /events/group-sales/group-faqs, /venue/little-caesars-arena/little-caesars-a-z-guide; bag: /venue/fox-theatre/fox-theatre-prohibited-items, /venue/pine-knob-music-theatre/pine-knob-prohibited-items-entry-policies; parking: /venue/little-caesars-arena/directions-parking-1, /venue/fox-theatre/parking-directions; transit: /plan-your-visit/public-transportation | Operator site 313presents.com; large page, arena A-Z at /venue/little-caesars-arena/little-caesars-a-z-guide |
| rogers-place | https://www.rogersplace.com/ (root) | 200 | text | 2,758 | wordpress | az: /arena-guide/accessibility/, /arena-guide/; parking: /getting-to-the-arena/parking/ |  |
| amerant-bank-arena | https://www.amerantbankarena.com/plan-your-visit/fan-safety-guidelines (stored venues.bagPolicyUrl) | 406 | blocked | 0 | none | none harvested | 406 with empty body, same class as barclays-center (WAF artifact; a browser renders it) |
| crypto-com-arena | https://www.cryptoarena.com/general-info-faq (stored venueHubs.bagPolicyUrl) | 200 | text | 11,512 | onetrust, cookie-copy-in-text | az: /events/axsmobileidfaq, /plan-your-visit/merchandise-shopping; parking: /plan-your-visit/getting-here, /plan-your-visit/getting-here/interactive-parking-map; transit: /plan-your-visit/getting-here, /plan-your-visit/getting-here/interactive-parking-map | Verified hub already sources every field to this host |
| xcel-energy-center | https://www.xcelenergycenter.com/ (root (rename check)) | 200 | text | 2,850 | none | az: /guest-services, /guest-services/about; parking: /plan-your-visit/directions, /plan-your-visit/parking | Redirects to grandcasinoarena.com; our docs already carry the new name |
| centre-bell | https://www.centrebell.ca/en/ (root (stored URL is nhl.com club FAQ)) | 200 | js-only | 456 | none | az: /en/faq | Shell only to plain HTTP (456 chars). Firecrawl: 15,716 chars of markdown, homepage; FAQ and Getting here links present, bag policy lives one level down at /en/faq |
| bridgestone-arena | https://www.bridgestonearena.com/a-to-z-guide (stored venues.bagPolicyUrl) | 406 | blocked | 0 | none | none harvested | 406 with empty body, same class as barclays-center |
| prudential-center | https://www.prucenter.com/ (root) | 200 | text | 3,680 | cookie-copy-in-text | az: /plan-your-visit, /a-z-guide; parking: /directions, /transit; transit: /transit |  |
| ubs-arena | https://www.ubsarena.com/ (root) | 200 | text | 4,259 | onetrust, wordpress | az: /about-the-arena/faqs/; bag: /know-before-you-go/, /bag-policy-prohibited-items/; parking: /parking/ | redirected to https://ubsarena.com/ |
| madison-square-garden | https://www.msg.com/plan-your-visit (stored venues.bagPolicyUrl) | 200 | js-only | 55 | onetrust, spa-root, wordpress | az: /plan-your-visit | Stored pointer is the MSG Entertainment venue picker, not the arena page (Firecrawl: 7,181 chars, mostly accessibility-widget boilerplate; the arena page is /plan-your-visit/visit-madison-square-garden). Dead-end pointer of the class the batch audit named |
| canadian-tire-centre | https://www.canadiantirecentre.com/ (root) | 200 | text | 3,283 | none | az: /plan-your-visit, /plan-your-visit-1/accessibility-guide; bag: /plan-your-visit-1/know-before-you-go-a-z-guide; parking: /plan-your-visit-1/directions-parking, /plan-your-visit-1/public-transportation; transit: /plan-your-visit-1/public-transportation |  |
| wells-fargo-center | https://www.wellsfargocenterphilly.com/ (root (rename check)) | 200 | text | 3,689 | onetrust, cookie-copy-in-text | az: /plan-your-visit/primepoint-social, /guest-services; bag: /plan-your-visit/security-policy; parking: /plan-your-visit/directions, /plan-your-visit/parking | Redirects to xfinitymobilearena.com; our docs already carry the new name |
| ppg-paints-arena | https://www.ppgpaintsarena.com/ (root) | 200 | text | 5,751 | onetrust | az: /ppg-paints-arena/faqs, /consol_energy_center/faqs; bag: /plan_your_visit/know-before-you-go-1; parking: /plan_your_visit/directions_parking, /plan_your_visit/public_transportation; transit: /plan_your_visit/public_transportation |  |
| sap-center | https://www.sapcenter.com/ (root) | 200 | text | 4,295 | none | az: /plan-your-visit, /plan-your-visit/directions-parking; bag: /plan-your-visit/bag-policy, /plan-your-visit/guest-safety/prohibited-items; parking: /plan-your-visit/directions-parking, /plan-your-visit/directions-parking/parking-pricing-and-directions; transit: /plan-your-visit/directions-parking/public-transportation-and-bicycle-parking |  |
| climate-pledge-arena | https://climatepledgearena.com/arena-guide (stored venueHubs.bagPolicyUrl) | 200 | text | 37,857 | wordpress | az: /arena-guide/, /wp-json/oembed/1.0/embed?url=https%3A%2F%2Fclimatepledgearena.com%2Farena-guide%2F; parking: /transportation, /transportation/; transit: /transportation, /transportation/ | Verified hub already sources every field to this host |
| enterprise-center | https://www.enterprisecenter.com/guest-services/arena-a-z-guide (stored venues.bagPolicyUrl) | 200 | text | 34,434 | none | az: /plan-your-visit, /guest-services; parking: /plan-your-visit/directions, /plan-your-visit/parking; transit: /plan-your-visit/metrolink |  |
| amalie-arena | https://www.amaliearena.com/ (root (rename check; stored URL is nhl.com club page)) | n/a | blocked (tls) | 0 | none | none harvested | amaliearena.com certificate expired; the building is Benchmark International Arena now. Spare fetch of the stored pointer nhl.com/lightning/arena: 200 but 1,771 chars of nav only (club site is client-rendered) |
| scotiabank-arena | https://www.scotiabankarena.com/ (root) | 200 | text | 3,614 | none | az: /plan-your-visit-1, /plan-your-visit/getting-here; bag: /know-before-you-go-1, /plan-your-visit/plan-your-visit-faq/bag-policy; parking: /plan-your-visit/getting-here, /plan-your-visit/directions-parking; transit: /plan-your-visit/getting-here |  |
| delta-center | https://www.deltacenter.com/ (root) | 200 | text | 849 | wordpress | az: /arena-policies-faq/; parking: /parking/ | Thin homepage (849 chars) but real links; treat as text |
| rogers-arena | https://rogersarena.com/ (root) | 403 | blocked | 773 | none | none harvested | 403 to a plain fetch (Cloudflare) |
| t-mobile-arena | https://www.t-mobilearena.com/plan-your-visit/bag-check-policy (stored venues.bagPolicyUrl (cookie-chrome check)) | 200 | text | 5,901 | onetrust, cookie-copy-in-text | az: /plan-your-visit, /plan-your-visit/a-z-guide; bag: /plan-your-visit/bag-check-policy; parking: /plan-your-visit/directions-parking | Arena site does NOT behave like the club site: the bag page renders the full policy to a plain fetch (small personal bags 9 x 5 x 2 in, need not be clear, Binbox bag check from $20). Only a footer "Cookie Settings" link, no consent wall |
| capital-one-arena | https://www.capitalonearena.com/ (root) | 200 | text | 2,948 | none | az: /plan-your-visit, /plan-your-visit/directions-parking; parking: /plan-your-visit/directions-parking |  |
| canada-life-centre | https://www.canadalifecentre.ca/ (root) | 200 | text | 2,042 | wordpress | az: /guest-services/party-suites/, /plan-your-visit/; parking: /plan-your-visit/directions/, /plan-your-visit/parking/; transit: /plan-your-visit/transit-information/ |  |

**Firecrawl (2 of 10 used, JS-only pages only).** centrebell.ca/en returned 15,716 chars of markdown in 19 s: a real homepage with Getting here and FAQ links, bag policy not on that page. msg.com/plan-your-visit returned 7,181 chars in 11 s, but the page is MSG Entertainment's five-venue picker; the arena-specific page is /plan-your-visit/visit-madison-square-garden, which was not fetched (budget). Firecrawl can read both hosts; the stored MSG pointer needs repointing regardless of the fetcher.

**Vegas.** The club site served consent chrome and zero rows on 2026-09-02 (NHL scan). The arena site does not: t-mobilearena.com/plan-your-visit/bag-check-policy returned the full policy to a plain fetch ("No bags or backpacks will be permitted into the venue except for small personal bags (measuring 9 x 5 x 2 max). Bags do not need to be transparent."), with a OneTrust script present but only a footer "Cookie Settings" link in the visible text.

**The 406 class.** amerantbankarena.com and bridgestonearena.com returned 406 with an empty body, the same response barclays-center gave during the venues batch audit, where it was isolated as a WAF artifact that a browser gets past. Both were left out of Firecrawl by the brief's rule (Firecrawl only for JS-rendered pages); they are the first two candidates for a browser-verify or a Firecrawl attempt when the build starts.

## 5. Transit citations in the existing docs (listed, not verified)

Eleven `venues` docs and two `venueHubs` docs name a transit line or station. The `venues` strings are silenced at render since 2026-08-29 but remain in Firestore; the two hub strings render on the hub pages and carry a source URL. No suppression entry covers any NHL building on either surface.

**carolina-hurricanes** (venues/lenovo-center, venueHubs/lenovo-center)
- venues.publicTransit (stored, silenced at render since 2026-08-29, no source): "Most fans drive, since transit options are limited. Rideshare drop-off and pickup is at Gate C off Trinity Road, and drivers should not turn into any other gate or lot. GoRaleigh buses serve the wider area but do not stop at the door."

**colorado-avalanche** (venues/ball-arena, venueHubs/ball-arena)
- venues.publicTransit (stored, silenced at render since 2026-08-29, no source): "RTD light rail drops you right beside the arena at the Ball Arena/Elitch Gardens station, served by the D, E, H, and W lines, with bus routes 10, 15, and 20 nearby. A three-hour transit pass is about 2.75 dollars through the RTD app. The Cherry Creek Trail and on-site bike racks make cycling easy, and rideshare pickup is in the 4Runner West lot at 5th and Walnut."

**florida-panthers** (venues/amerant-bank-arena, venueHubs/amerant-bank-arena)
- venues.publicTransit (stored, silenced at render since 2026-08-29, no source): "Transit options are limited out here, so most fans drive. Lyft is the arena's official rideshare partner, with marked pickup and drop-off zones. Pedestrians should enter the grounds via Gate 6 and use the sidewalk to the stairs at the front."

**los-angeles-kings** (venues/crypto-com-arena, venueHubs/crypto-com-arena)
- venues.publicTransit (stored, silenced at render since 2026-08-29, no source): "The Metro A and E lines stop at Pico Station, a 1 to 2-block walk to the arena; from downtown transfer at 7th St/Metro Center. DASH Route F and several Metro bus lines also stop near L.A. LIVE. Load your TAP card before the event to skip post-game lines."
- venueHubs.publicTransit (renders on the hub, verified): lines ["Metro A Line","Metro B Line","Metro C Line","Metro D Line","Metro E Line","Metro J Line","Metro Bus 28","Metro Bus 30","Metro Bus 81","Metro Bus 460","DASH Route F","Metrolink","Amtrak"]; source https://www.cryptoarena.com/plan-your-visit/getting-here/public-transportation

**montreal-canadiens** (venues/centre-bell, venueHubs/centre-bell)
- venues.publicTransit (stored, silenced at render since 2026-08-29, no source): "Transit is the easy choice here. The arena connects directly to the Lucien-L'Allier Metro station on the Orange Line, with Bonaventure a short walk away, and it ties into Montreal's Underground City so you can reach the gates without going outside in winter. STM bus routes 36, 61, 107, 150, and 178 stop nearby, and there are BIXI bike racks at the arena."

**nashville-predators** (venues/bridgestone-arena, venueHubs/bridgestone-arena)
- venues.publicTransit (stored, silenced at render since 2026-08-29, no source): "WeGo Public Transit runs many routes through downtown from its WeGo Central hub, with a flat 2 dollar one-way fare and a Route 18 express to the airport. Nashville BCycle e-bikes are scattered downtown, and Lyft is the official rideshare partner."

**new-york-rangers** (venues/madison-square-garden, venueHubs/madison-square-garden)
- venues.publicTransit (stored, silenced at render since 2026-08-29, no source): "This is one of the most transit-connected arenas anywhere. MSG sits on top of Penn Station, so the 1, 2, 3 and A, C, E subway lines, plus LIRR, NJ Transit, and Amtrak, all let out beneath the building. Numerous Midtown bus routes, including the M5, M7, M20, and M34-SBS, stop nearby."

**seattle-kraken** (venues/climate-pledge-arena, venueHubs/climate-pledge-arena)
- venues.publicTransit (stored, silenced at render since 2026-08-29, no source): "Every event ticket includes a free King County transit pass valid two hours before and after. The Seattle Center Monorail is a 90-second ride from Westlake downtown; Link light rail riders transfer to the Monorail at Westlake, and King County Metro buses serve the Seattle Center campus."
- venueHubs.publicTransit (renders on the hub, verified): lines ["Bus (King County Metro)","Light Rail","Seattle Center Monorail"]; source https://climatepledgearena.com/transportation

**st-louis-blues** (venues/enterprise-center, venueHubs/enterprise-center)
- venues.publicTransit (stored, silenced at render since 2026-08-29, no source): "MetroLink light rail is the easiest car-free option: exit at the Civic Center Station just off 14th and Spruce and the arena is right there, for 2.50 dollars a ride or 5 dollars a day. The Civic Center MetroBus Transfer Center one block away serves 16 routes, and Amtrak stops at nearby Union Station."

**tampa-bay-lightning** (venues/amalie-arena, venueHubs/amalie-arena)
- venues.publicTransit (stored, silenced at render since 2026-08-29, no source): "The TECO Line Streetcar stops right at the arena's door on Channelside Drive, runs to downtown and Ybor City, and has been free to ride since 2018, with extended hours on Lightning nights. HART buses 8, 19, and 30 serve the area, with route 30 stopping in front. There is also a rideshare drop-off circle on the north side along Channelside Drive."

**vegas-golden-knights** (venues/t-mobile-arena, venueHubs/t-mobile-arena)
- venues.publicTransit (stored, silenced at render since 2026-08-29, no source): "The arena is walkable from New York-New York, Park MGM, Aria, and Excalibur. The Las Vegas Monorail and the RTC Deuce bus run along the Strip, and the RTC Game Day Express offers round-trip service to Golden Knights games. Rideshare drop-off is on the ground level of the New York-New York garage, with pickup at New York-New York or Park MGM."

## 6. Game-day rule on web

App-side rule (terms page): "If a venue has no data, no unlock or purchase will be prompted." Web equivalent in `VenueHubView.tsx`: fact cards, the parking widget card and the tickets card are all gated on `hub.verified`; a held building renders the hero and one notice with a mailto. Sampled live on 2026-09-02, cache-busted:

| Page | HTTP | robots | "still confirming gameday details" | Tickets & gear card | SpotHero / Expedia | "unlock" |
|---|---|---|---|---|---|---|
| /venues/honda-center | 200 | noindex, follow | present | absent | absent | absent |
| /venues/td-garden | 200 | noindex, follow | present | absent | absent | absent |
| /venues/xcel-energy-center | 200 | noindex, follow | present | absent | absent | absent |

The rule holds. One wrinkle worth knowing before the build: the `<title>` on a held page still reads "{Arena} Bag Policy, Parking & Food | 2026 Gameday Guide", while the meta description correctly says "Parking, transit and bag details are not published yet." The body and description are honest; the title template is not conditional. Not a rule violation (nothing is monetised or claimed in the body), but it is the same shape as the description bug fixed earlier this month.

## 7. Proposed build order (not built)

Shared buildings first, then by club upcoming-promo count. 739 upcoming NHL promos across the 32 clubs today. "Club page publishes venues prose today" marks buildings where an unsourced batch claim is already live on the club page; those are exposure, not a head start, and the rule from the CFB contract applies (never seed a hub fact from `venues` prose).

Shared buildings (NBA co-tenant), by upcoming promos:

| # | Building | Tenants | Upcoming promos | Hub state | Club page publishes venues prose today | Arena site to plain HTTP |
|---|---|---|---|---|---|---|
| 1 | little-caesars-arena | NBA:detroit-pistons, NHL:detroit-red-wings | 85 | held | no | text |
| 2 | crypto-com-arena | NHL:los-angeles-kings, NBA:los-angeles-lakers, WNBA:los-angeles-sparks | 80 | verified | yes (unsourced) | text |
| 3 | american-airlines-center | NBA:dallas-mavericks, NHL:dallas-stars | 28 | held | no | text |
| 4 | united-center | NHL:chicago-blackhawks, NBA:chicago-bulls | 23 | held | no | blocked |
| 5 | ball-arena | NHL:colorado-avalanche, NBA:denver-nuggets | 23 | held | yes (unsourced) | text |
| 6 | td-garden | NHL:boston-bruins, NBA:boston-celtics | 10 | held | no | text |
| 7 | madison-square-garden | NBA:new-york-knicks, NHL:new-york-rangers | 0 | held | yes (unsourced) | js-only |
| 8 | wells-fargo-center | NBA:philadelphia-76ers, NHL:philadelphia-flyers | 0 | held | no | text |
| 9 | scotiabank-arena | NHL:toronto-maple-leafs, NBA:toronto-raptors | 0 | held | no | text |
| 10 | delta-center | NHL:utah-hockey-club, NBA:utah-jazz | 0 | held | no | text |
| 11 | capital-one-arena | NHL:washington-capitals, NBA:washington-wizards | 0 | held | no | text |

Single-tenant buildings, by upcoming promos:

| # | Building | Tenants | Upcoming promos | Hub state | Club page publishes venues prose today | Arena site to plain HTTP |
|---|---|---|---|---|---|---|
| 1 | ppg-paints-arena | NHL:pittsburgh-penguins | 67 | held | no | text |
| 2 | bridgestone-arena | NHL:nashville-predators | 51 | held | yes (unsourced) | blocked |
| 3 | sap-center | NHL:san-jose-sharks | 43 | held | no | text |
| 4 | honda-center | NHL:anaheim-ducks | 34 | held | no | text |
| 5 | ubs-arena | NHL:new-york-islanders | 32 | held | no | text |
| 6 | canada-life-centre | NHL:winnipeg-jets | 32 | held | no | text |
| 7 | centre-bell | NHL:montreal-canadiens | 29 | held | yes (unsourced) | js-only |
| 8 | enterprise-center | NHL:st-louis-blues | 28 | held | yes (unsourced) | text |
| 9 | amalie-arena | NHL:tampa-bay-lightning | 28 | held | yes (unsourced) | blocked (tls) |
| 10 | keybank-center | NHL:buffalo-sabres | 25 | held | no | blocked (tls) |
| 11 | nationwide-arena | NHL:columbus-blue-jackets | 24 | held | no | text |
| 12 | amerant-bank-arena | NHL:florida-panthers | 23 | held | yes (unsourced) | blocked |
| 13 | prudential-center | NHL:new-jersey-devils | 22 | held | no | text |
| 14 | lenovo-center | NHL:carolina-hurricanes | 18 | held | yes (unsourced) | text |
| 15 | t-mobile-arena | NHL:vegas-golden-knights | 17 | held | yes (unsourced) | text |
| 16 | rogers-place | NHL:edmonton-oilers | 13 | held | no | text |
| 17 | climate-pledge-arena | NHL:seattle-kraken, WNBA:seattle-storm | 4 | verified | yes (unsourced) | text |
| 18 | scotiabank-saddledome | NHL:calgary-flames | 0 | held | no | text |
| 19 | xcel-energy-center | NHL:minnesota-wild | 0 | held | no | text |
| 20 | canadian-tire-centre | NHL:ottawa-senators | 0 | held | no | text |
| 21 | rogers-arena | NHL:vancouver-canucks | 0 | held | no | blocked |

Notes on the order.

- crypto-com-arena and climate-pledge-arena are verified buildings; their remaining NHL work is the tenant overlay (gate times for Kings and Kraken), which the pipeline's overlay-state doc already marks "NHL overlay-ready, do not re-sweep the building".
- The nine clubs at zero upcoming promos (Flames, Wild, Rangers, Senators, Flyers, Maple Leafs, Utah, Canucks, Capitals) are the scanner's withheld or floor-guarded clubs, not clubs with no promotions; their rank will move on the next NHL scan.
- The six blocked arena sites (united-center, amerant-bank-arena, bridgestone-arena, amalie-arena, keybank-center, rogers-arena) need a fetch path decided before extraction: apex host for KeyBank, browser or Firecrawl for the 406 pair, and a domain decision for Tampa (the operator's old domain has an expired certificate and the club page is client-rendered).
- madison-square-garden and centre-bell need the stored bag pointer repointed to the arena page before it is trusted as a harvest seed.

## 8. Budget and method

- Subagents: 0 (declared 0; the work was three read-only scripts and one probe script).
- Plain fetches: 38 of 40. 32 arena probes, 3 live PromoNight pages, 3 spare (KeyBank apex, Lightning arena page, Vegas bag page body).
- Firecrawl: 2 of 10 (centrebell.ca/en, msg.com/plan-your-visit).
- Firestore: reads only (teams, venues, venueHubs and 32 tenant overlays, 32 promo count queries, target-field spot check).
- Repo: no commits, no page code. This document is the only new file.
