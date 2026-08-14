# Affiliate Attribution Audit

Date: 2026-08-14. READ-ONLY: no source file was modified, no branch created; this report is the only artifact.
Scope: full promonight-web repo grep (709 raw domain hits), source trace of every affiliate render path, live production render verification against https://www.getpromonight.com (cache-busting curl, never web_fetch), and env var reconciliation.
Authoritative partner map used for judgment (owner-supplied, overrides code comments): Impact hosts exactly three programs (Ticketmaster, TicketNetwork, Fanatics; publisher account 7236189). Fanatics must route through the Impact click redirect. SpotHero: Partnerize per the map. Expedia: in-house. eBay: EPN resale links. Sub-ID convention: subId1={surface}_{team.id}. SeatGeek declined, StubHub never approved, Booking.com unconfirmed.

---

## Broken, ranked by estimated click volume at risk

Weighting source: docs/SITE-AUDIT.md page-type impression table (28d through Jun 10; 44,618 total impressions): MLB team pages 38,846 (87.1%), Aggregator 3,112 (7.0%), MLS 615, Homepage 600, NBA 572, Playoffs 306, WNBA 294, NFL 169, World Cup 104. Venue hubs, CFB pages, and /promos/today postdate that table and are unmeasured; they are ranked qualitatively, with CFB weighted up because its season starts in two weeks.

1. **Ticketmaster ships surface-only sub-IDs sitewide (confirmed in prod).** The Impact wrap's {SHARED_ID} slot is filled with `venueSlug ? surface_venueSlug : surface` (src/lib/affiliates.ts:270-275), so every TM link on every surface except venue hubs carries no team half at all: prod HTML ships `sharedid=web_team_page`, `sharedid=web_today`, `sharedid=web_best_promos`, `sharedid=web_cfb` with zero team or school id. TM is the second button on every ticket CTA on every surface, and team pages alone carry 87% of measured impressions. Revenue is still credited to account 7236189 (the wrap is live in prod), but partner-side per-team slicing for TM is impossible everywhere; the subId1={surface}_{team.id} convention is met by TicketNetwork, Fanatics, SpotHero, and Expedia but not by TM.
2. **SpotHero network identity conflict (sitewide, binary, unresolved).** 100% of shipped SpotHero links route through tracking.spothero.com/aff_c with hardcoded aff_id=2427 and aff_sub sub-IDs, a HasOffers-style tracker (src/lib/affiliates.ts:496-508); code comments assert HasOffers. The authoritative partner map says SpotHero runs on Partnerize; zero prf.hn or Partnerize-host URLs exist anywhere in the repo. If Partnerize is where the program actually pays out, every parking click on every surface (team pages, /promos/today, /playoffs, venue hubs, CFB, my-teams, world-cup) is at risk of non-attribution. This cannot be resolved from code; it needs an owner-side ledger or dashboard check. Reported factually, not resolved.
3. **SpotHero away-game rows mislabel into the wrong team bucket (confirmed in prod).** ParkingCTA builds `aff_sub = {surface}_{team.id}` (ParkingCTA.tsx:81) and away rows pass the OPPONENT team with the unchanged page surface (GameExpand.tsx:201-208), so the Twins page ships `aff_sub=web_team_page_san-diego-padres`. Partner-side, a team's web_team_page bucket mixes clicks from its own page with clicks made on every other team's away rows against it, indistinguishably. This corrupts per-team parking attribution on the 87% page type in both directions.
4. **The away-game key means a different team per partner on the same row (confirmed in prod).** One away-game expand emits four different keys: TN `subId1=web_away_game_{PAGE team}`, Expedia `pubref=web_away_game_{OPPONENT}`, SpotHero `aff_sub=web_team_page_{OPPONENT}`, TM `sharedid=web_team_page` (TicketmasterCTA passes the page surface, not the computed tnSurface, into buildTicketmasterUrl at TicketmasterCTA.tsx:85). Any cross-partner join on the away key mismatches teams by construction.
5. **/best-promos and /best-promos/bobbleheads collapse into one partner bucket.** Both pages hardcode surface "web_best_promos" (scored-promo-card.tsx:122, 196), so TN revenue for the two pages is inseparable partner-side, and TM collapses further into the single sharedid string web_best_promos across both pages and all teams. Aggregator pages are 7% of impressions and the best-converting family; the split exists only in PostHog placement props.
6. **CFB Ticketmaster collapses 86 school pages into one bucket (confirmed in prod).** /cfb/alabama ships `sharedid=web_cfb` while TN, Fanatics, SpotHero, and Expedia on the same page all ship web_cfb_alabama. Every TM click from every school page and every schedule modal lands in one undifferentiated web_cfb bucket. Unmeasured in the June table, but the season starts within weeks.
7. **Latent single-point failure: the TM wrap env var.** If NEXT_PUBLIC_TICKETMASTER_IMPACT_WRAP is ever unset at build, buildTicketmasterUrl silently returns bare unattributed ticketmaster.com URLs sitewide (affiliates.ts:266-268), by design as a pre-approval fallback. Prod currently has it set (evyy.net wrap confirmed shipping), but nothing fails loudly if it drops.
8. **Venue-hub slug fragility (latent, no observed instance).** Venue sub-IDs key on the stored d.slug field with no doc.id fallback (venue-hub.ts:125), while routing and the sitemap key on doc.id (venue-hub.ts:322, 354). A venue doc missing the slug field silently degrades TN/Fanatics/SpotHero/Expedia sub-IDs to team-keyed and degrades TM to the bare shared web_venue bucket (affiliates.ts:274); a doc whose slug diverges from its id would make the URL and the revenue reports name different buildings with no error anywhere.
9. **User-facing legal prose misstates the partner set.** /terms (terms/page.tsx:25) and /privacy (privacy/page.tsx:57) tell users affiliate relationships are managed through Awin, Partnerize, Impact, CJ Affiliate, and FlexOffers, and name a sportsbook partner category. No Awin, CJ, or FlexOffers relationship exists in code and no sportsbook partner exists at all. Related stale internal docs: docs/SITE-AUDIT.md:233 lists Booking.com under Approved/wiring (owner status: unconfirmed) and :234 lists StubHub as "Partnerize, pending" (owner status: never approved); both duplicated in SITE-AUDIT.generated.md.
10. **Declined and unapproved partner residue (dormant, flagged per instructions).** SeatGeek and StubHub survive as @deprecated builders, env-var gates, and analytics enum members (affiliates.ts:15-16, 25-26, 103-118, 182-216; analytics.ts:276-277). Zero live render paths and zero prod occurrences, but both builders tag IDs directly onto the retailer URL, so if re-wired without env IDs set they would emit untagged links. SeatGeek is also named in seeded Plan Your Visit parking prose on 5 MLS venues (text, no links) and appears as a club sponsor name in pipeline preview promo titles. Booking.com: zero hrefs, builders, or env vars; survives only in two code comments and the stale docs above.

**Confirmed NOT broken** (worth stating so the above reads in proportion): Fanatics is fully Impact-wrapped on every render path with per-team adIds and subId1 convention intact; the 2026-07-09 fix is holding in prod, and the only bare fanatics.com URLs shipped are non-clickable RSC flight-payload data fields. TicketNetwork meets the convention everywhere including the away flip and the oakland-athletics override. Expedia's in-house wrapper and pubref are correct on every surface. eBay uses the correct modern EPN direct-link pattern (campid live in prod, per-promo customid, no legacy rover.ebay). The email digest embeds zero partner links by design. Zero SeatGeek, StubHub, or Booking.com URLs ship on any fetched prod page. Part 3 found no divergence from source: no ISR pre-fix HTML is being served.

---

## Part 1: Outbound affiliate link inventory

709 raw grep hits across the repo collapse into the rows below (pure data tables and doc families are grouped with counts; every rendering code site gets its own row). "Redirect" = does the user-facing link go through the correct network redirect.

### 1a. Link builders, components, and render paths (ships to users)

| File:Line | Partner | Rendered by | Redirect | Tracking ID source | Note |
|---|---|---|---|---|---|
| src/lib/affiliates.ts:22 | Ticketmaster (Impact) | TicketmasterCTA on every ticket surface (team pages, hubs, /venues, /cfb, /promos/today, /playoffs, /my-teams, /world-cup, /best-promos) | yes | env NEXT_PUBLIC_TICKETMASTER_IMPACT_WRAP | Wrap template with {TARGET}/{SHARED_ID} slots. Prod-verified: ticketmaster.evyy.net /c/7236189/264167/4272. evyy.net appears nowhere in repo source; it lives only in the env value. Var reads empty via vercel env pull (does not decrypt) but is set at build. |
| src/lib/affiliates.ts:257-276 | Ticketmaster (Impact) | buildTicketmasterUrl, same surfaces | yes (env-conditional) | same env var | Composes bare www.ticketmaster.com destination, folds into wrap as {TARGET}. When env unset it returns the bare URL by design: the only path that can ship an unattributed ticketmaster.com href. Not taken in prod today. |
| src/lib/affiliates.ts:291-297 | TicketNetwork (Impact) | buildTicketNetworkLink via TicketmasterCTA TN button (top slot, every ticket surface) + RivalryMatchupPage | yes | hardcoded Impact /c/7236189/120057/2322 prefix on ticketnetwork.lusg.net + partnerPropertyId 8313917 | No env var; always commissionable. Prod href matches source byte-for-byte. |
| src/lib/affiliates.ts:313-353 | TicketNetwork (Impact) | ticketNetworkLandingUrl + buildTicketNetworkLink + TICKETNETWORK_OVERRIDES (oakland-athletics) | yes | hardcoded prefix; subId1={surface}_{team.id} or {surface}_{venueSlug} | Landing www.ticketnetwork.com/e/performers/{slug}-tickets rides encoded in u=. Returns null when unresolvable, so no broken anchor renders. |
| src/lib/affiliates.ts:376-384 | Fanatics (Impact) | buildFanaticsUrl via FanaticsCTA (team pages, /venues, /cfb, rivalry TripStep, /my-teams, /world-cup) | yes | hardcoded Impact fanatics.93n6tx.net /c/7236189/{adId}/9663; per-team adId from FANATICS_AD_IDS, generic 586570 fallback | storeOrigin www.fanatics.com is destination-only, always inside u=. Comment documents the 2026-07-09 bare-href fix. |
| src/lib/affiliates.ts:399-475 | Fanatics (Impact) | buildFanaticsUrl + stripFanaticsRuntimeParams | yes | hardcoded; subId1={surface}_{team.id} or {surface}_{venueSlug} | Destination team.fanaticsUrl, fallback storeOrigin+fanaticsPath, defensive homepage-through-Impact on empty. Prod-verified. |
| src/lib/affiliates.ts:496-508 | SpotHero | buildSpotHeroUrl via SpotHeroCTA, ParkingCTA, RivalryMatchupPage | yes (per code's own model) | hardcoded tracking.spothero.com/aff_c, offer_id=1, aff_id=2427; sub-ID rides aff_sub | Always wraps the destination (search-by-coords or homepage). buildAffiliateUrl passthrough; isPartnerActive hardcodes true. |
| src/lib/affiliates.ts:490-495 | SpotHero (NETWORK DISCREPANCY) | comment of record above the builder | unknown | hardcoded aff_id=2427 | Code asserts HasOffers, not CJ. Owner map says Partnerize. Zero prf.hn/Partnerize URLs in the repo. Flagged, unresolved (ranked item 2). |
| src/lib/affiliates.ts:521-597 | Expedia (in-house) | buildExpediaHotelLink via hotel-link.ts, ExpediaCTA, HotelsCTA, RivalryMatchupPage | yes | hardcoded camref=1011l5KcC9, creativeref=1100l68075, adref=PZPbSQWcB2; sub-ID rides pubref | Double-encoded Hotel-Search deep link inside www.expedia.com/affiliate wrapper. Matches the partner map. |
| src/lib/hotel-link.ts:57-116 | Expedia | resolveHotelLink + resolveVenueHotelLink for all Expedia surfaces | yes | delegates to hardcoded EXPEDIA constants; pubref=web_away_game_{teamId} when dated, else {surface}_{teamId} (or {surface}_{venueSlug} building mode) | Returns null (CTA hides) when neither coords nor city resolve; never renders unwrapped. |
| src/lib/ebay.ts:11-70 | eBay (EPN) | buildEbayResaleUrl via EbayResaleLink | yes | env NEXT_PUBLIC_EBAY_CAMPID (campid); mkrid hardcoded 711-53200-19255-0, mkcid=1 | Direct www.ebay.com/sch/i.html link with EPN params: the correct modern pattern (no redirect domain; zero rover.ebay anywhere). customid = web_{placement}_{synthPromoId}, sanitized, max 256. |
| src/lib/cfb/fanatics-stores.ts:8-96 | Fanatics (Impact) | CFB_FANATICS_STORES feeding FanaticsCTA on /cfb/[school] | yes | wrapped downstream by buildFanaticsUrl; subId1=web_cfb_{id} | DATA TABLE, 87 hits: 86 bare www.fanatics.com college store deep links, one per school, destinations only, always wrapped before render. |
| src/lib/fanatics-ad-ids.ts | Fanatics (Impact) | FANATICS_AD_IDS feeding the adId segment of every Fanatics /c/ link | yes | hardcoded per-team Impact adIds (121 teams), generic 586570 fallback | Zero domain-grep hits (pure adId strings); included because it supplies the tracking-id middle segment. |
| src/lib/cfb/page-extras.ts:62-102 | TicketNetwork + Fanatics | toAffiliateTeam for the CfbSchoolPage CTA stack | yes | none here; tracking added by shared builders | ticketNetworkSlug = CFB_TN_SLUG_OVERRIDES ?? slugifySchool (6-school wrong-performer fix); threads CFB_FANATICS_STORES into fanaticsUrl. |
| src/components/affiliates/TicketmasterCTA.tsx | Ticketmaster + TicketNetwork | mounted by TicketsBlock, AffiliateRail, GameExpand, CfbSchoolPage/CfbSchedule, VenueHubView, TodayPromoCard, HubThisWeek, my-teams, playoffs, world-cup, game-day-detail, best-promos | yes | TM: env wrap (SharedID carries surface); TN: hardcoded /c/ prefix (subId1 carries surface_team.id) | 22 hits. Renders TN button top, TM second, on every ticket surface. Away rows: tnSurface flips to web_away_game for TN only; TM keeps the page surface (line 85). |
| src/components/affiliates/TicketsBlock.tsx:52 | Ticketmaster | TicketsBlock wrapper (team hero, promo cards, playoffs, game modals) | yes | none on this line (comment) | Comment documents the graceful pre-approval bare-ticketmaster.com fallback. Note: one sweep's exclusion glob ('!*lock*') initially skipped this file; caught and corrected, counts include it. |
| src/components/affiliates/FanaticsCTA.tsx:14-44 | Fanatics | AffiliateRail, VenueHubView, CfbSchoolPage, TripStep, my-teams, world-cup | yes | hardcoded via buildFanaticsUrl; no bare-URL fallback exists | Gates render on fanaticsUrl/fanaticsPath presence; comments document that a bare fanatics.com href mints no irclickid. |
| src/components/affiliates/SpotHeroCTA.tsx:60-68 | SpotHero | team-page prepare cluster, /my-teams, /promos/today inline, /world-cup, /cfb + game modal, /venues | yes | hardcoded aff_c/aff_id via builder; aff_sub={surface}_{team.id} or {surface}_{venueSlug} | Never returns null: without coords it renders a tracked link to the spothero.com homepage (upstream CFB code gates that out). rel=sponsored. |
| src/components/affiliates/ParkingCTA.tsx:63-115 | SpotHero | GameExpand away rows, game-day-detail legacy modal, /playoffs | yes | hardcoded aff_c/aff_id; aff_sub={surface}_{team.id} | Stale comment at line 71 references env state; no env var exists. Away rows receive the opponent team (ranked item 3). |
| src/components/affiliates/ExpediaCTA.tsx:10-55 | Expedia | team-page prepare cluster, /my-teams, /world-cup, /cfb + modal, /venues building mode | yes | hardcoded camref family via resolveHotelLink/resolveVenueHotelLink | STALE COMMENT lines 10-11 claims "via Partnerize" and "replaces the old Booking.com card"; the built URL is the in-house /affiliate wrapper regardless. |
| src/components/affiliates/HotelsCTA.tsx:8-77 | Expedia | GameExpand away rows (dated), game-day-detail, /playoffs | yes | hardcoded camref family; dated away games get checkIn/checkOut | STALE COMMENT line 8 also says Partnerize. Hides on null resolve rather than rendering unwrapped. |
| src/components/affiliates/EbayResaleLink.tsx:42-52 | eBay (EPN) | promo-list.tsx:217 (team pages) + PastBobbleheadsSection.tsx:64 (/promos/bobbleheads) | yes | env NEXT_PUBLIC_EBAY_CAMPID via lib/ebay.ts | Triple self-guard: campid set + strict bobblehead predicate + past date. Unset campid = no link at all, never an untagged URL. Fires resale_click, not affiliate_click. |
| src/components/redesign/AffiliateRail.tsx:41-47 | TN+TM+SpotHero+Expedia+Fanatics | RedesignTeamPage (live prod team-page path, 169 pages) | yes | component builders; surface=web_team_page | The prepare rail. |
| src/app/[sport]/[team]/page.tsx:327-382 | same five | legacy redesign-flag-off branch | yes | component builders | Reachable only if NEXT_PUBLIC_REDESIGN_V2 flips off; identical wrapping. Line 364 comment explains the Fanatics null-gate. |
| src/components/redesign/GameExpand.tsx:191-218 | TN+TM (home+away), SpotHero+Expedia (away) | team-page schedule expands + homepage/world-cup modals | yes | component builders | Away Parking/Hotels suppressed on international neutral-site games. |
| src/components/shared/game-day-detail.tsx:224-251 | TN+TM+SpotHero+Expedia | legacy team-calendar game modal | yes | component builders | Same wiring and suppression as GameExpand. |
| src/app/playoffs/page.tsx:400-755 | TN+TM+SpotHero+Expedia | /playoffs (TicketsBlock, ParkingCTA, HotelsCTA in light + dark branches) | yes | component builders; surface=web_playoffs | Currently ships zero links in prod (offseason state; see Part 3). |
| src/components/hub/HubThisWeek.tsx:145-151 | TN+TM | /mlb, /wnba, /mls hub this-week rails | yes | component builders; surface=web_{league}_hub_this_week | /nfl and /cfb hubs render no affiliate CTAs. |
| src/components/promos-today/TodayPromoCard.tsx:48-63 | TN+TM+SpotHero | /promos/today board | yes | component builders; surface=web_today | Inline CTA row, TN first (revenue test). |
| src/components/scoring/scored-promo-card.tsx:122-199 | TN+TM | /best-promos + /best-promos/bobbleheads | yes | component builders; surface hardcoded "web_best_promos" | Both pages share one token (ranked item 5). |
| src/components/my-teams-view.tsx:1650-1732 | TN+TM+Fanatics+SpotHero+Expedia | /my-teams | yes | component builders; surface=web_my_teams | Two branches (light/dark). |
| src/components/world-cup/host-card.tsx:14-89, game-rows.tsx:153-160 | TN+TM+SpotHero+Expedia+Fanatics | /world-cup host cards + game modal | yes | component builders; surface=web_world_cup | routingVenue synthesizes coords from WC city when venue doc missing. |
| src/components/cfb/CfbSchoolPage.tsx:211-237 | TN+TM+SpotHero+Expedia+Fanatics | /cfb/[school] (86 pages) | yes | component builders; surface=web_cfb | Placements cfb_signature + cfb_gameday emit identical sub-IDs. |
| src/components/cfb/CfbSchedule.tsx:131-133 | TN+TM+SpotHero+Expedia | /cfb/[school] game modal | yes | component builders; host-school keyed | Away clicks credit the host school's bucket (deliberate: host sells the tickets). |
| src/components/cfb/rivalry/RivalryMatchupPage.tsx:104-159 + TripStep.tsx:72 | TN+SpotHero+Expedia | /cfb/rivalries/[slug] (33 pages) | yes | builders called directly; slug-keyed sub-IDs | No TM, no Fanatics on this family. Ticket school = schoolIds[0] by array order (comment claims home school; code uses order). |
| src/components/venue-hub/VenueHubView.tsx:339-419 | TN+TM+Fanatics+SpotHero+Expedia | /venues/[slug] (222 buildings) | yes | component builders with venueSlug; building-keyed web_venue_{slug} | SpotHero gated by spotHeroCovers + coords; Montreal buildings degrade to honest text. |
| src/app/dev/affiliate-check/page.tsx:23-150 | TN+TM (diagnostic) | /dev/affiliate-check, notFound() in production | yes | production builders | Live commissionable URLs as plain anchors with no PostHog tracking; TN column reuses the web_team_page token, so dev clicks would pollute the team-page partner bucket. Non-prod only. |
| src/lib/email.ts:243-276 | none (internal links) | digest email | n/a | none | Embeds ZERO partner links by design; internal team-page links carry a subId1 query param as a PostHog join key that mimics the affiliate convention but never reaches a partner. |
| src/lib/venue-hub.ts:187-211, 803-808 | SpotHero (gate only) | spotHeroCovers coverage gate for venue hubs | n/a | none | US always covered; Canadian metros whitelisted so hubs never deep-link an empty SpotHero search. |
| src/middleware.ts | Fanatics (trap only) | Fanatics catalog-path 410 trap | n/a | none | No link assembly. |

### 1b. Type/analytics/comment residue (no URLs emitted)

| File:Line | Partner | Note |
|---|---|---|
| src/lib/affiliates.ts:20-495 (12 comment/union lines) | TM/TN/Fanatics mixed | AffiliatePartner union literals, TICKET_VENDOR const, descriptive comments. |
| src/lib/types.ts:26-34 | TN + Fanatics | Team field docs (ticketNetworkSlug, fanaticsUrl shape). |
| src/lib/analytics.ts:163, 276-282 | TN/SpotHero/Expedia + seatgeek/stubhub (FLAG) | AffiliatePartnerName union for affiliate_click events; seatgeek and stubhub survive as type-only members, never emitted. |
| src/lib/promo-helpers.ts:337, 344 | SpotHero + Expedia | Generated FAQ prose brand mentions, no hrefs. |
| src/lib/venue-cities.ts:4, src/lib/cfb/types.ts:60, src/lib/cfb/matchups.ts:55, src/lib/cfb/trip-steps.ts:20, src/lib/cfb/page-extras.ts:106, src/app/layout.tsx:40, TicketmasterCTA.tsx:12 comments | various | Comments and adapters; no link assembly. |
| src/lib/__tests__/fanatics-url.test.ts, cfb-trip-steps.test.ts | Fanatics, SpotHero | Byte-exactness tests for the /c/ wrap; NO-COORDS drop assertions. |
| src/app/promos/bobbleheads/page.tsx:76, src/app/llms.txt/route.ts:10 | eBay | Prose mentions, no links. |
| src/app/privacy/page.tsx:57, src/app/terms/page.tsx:25 | SpotHero, Expedia, Partnerize + Awin/CJ/FlexOffers/sportsbooks (FLAG) | User-facing disclosure text contradicting the partner map (ranked item 9). |

### 1c. Scripts, data, docs, outputs (not rendered)

| File | Partner | Note |
|---|---|---|
| scripts/fanatics-team-mapping.json (122 hits) | Fanatics | Impact TEXT_LINK export: 121 per-team trackingLink URLs, campaign 9663. Source for fanatics-ad-ids.ts. |
| scripts/ticketmaster-team-mapping.json (167 hits), .ts, populate-ticketmaster-fields.ts, audit-ticketmaster-urls.ts | Ticketmaster | Discovery API mapping data + scripts (TICKETMASTER_API_KEY is a data API key, not click tracking). |
| scripts/migrate-fanatics-path-to-url.ts, discover-missing-fanatics-urls.py | Fanatics | Bare destination URL builders; wrap applied at render. |
| audit/validate-ticketnetwork-links.ts + package.json script | TicketNetwork | HTTP-validates bare landing pages, never the tracked link. |
| docs/cta-registry.md (16), docs/ticketmaster-impact-attribution-conflict.md (4), audit/cfb-affiliate-validation.md (15), audit/promos-today-gate.md (12), audit/cfb-phase3-affiliate-venue-gate.md (10), audit/cfb-page-refinement-gate.md (7), audit/cfb-matchup-architecture.md (6), audit/nfl-internal-linking.md (5), docs/SITE-AUDIT.md + .generated.md, docs/venue-faq-and-gatetime-spec.md, docs/wnba-gameday-venue-research.md, docs/cfb-source-map.* | various | Internal docs. Note: the TM attribution-conflict doc's open question is settled by this audit's rendered-href check (prod ships the evyy.net wrap; the empty vercel env pull read was the decryption artifact it hypothesized). SITE-AUDIT partner-status lines are stale (ranked item 9). |
| scripts/mlb-plan-your-visit.json + arena/wnba PYV seed family (14 prose mentions) | SpotHero | "Reserve through SpotHero" parking copy seeded to Firestore, text only. |
| scripts/arena-plan-your-visit-mls-west.json:7-107 | SeatGeek (FLAG) | PYV prose names SeatGeek as a parking purchase channel on 5 venues (Q2, Toyota, Dignity Health, Snapdragon, PayPal Park). Text, no links; flagged because it is user-facing copy naming a declined partner. Line 51 "StubHub Center" is historical stadium naming, benign. |
| outputs/spothero-venues-cfb*.csv, outputs/cfb-coord-sanity-report.md | SpotHero | Uncommitted working-tree coordinate exports for the CFB venue list. |
| promo-pipeline/prototypes/output/*, scripts/snapshots/snapshot-2026-05-13.json, docs/cfb-source-map.* | eBay, SeatGeek, StubHub, Booking (data) | Scraped research data and keyword snapshots; never shipped. Pipeline preview promo titles include "presented by SeatGeek" sponsor naming (editorial, could surface via promo data if seeded). |
| .env.example:40-46 | SeatGeek + StubHub (FLAG) | Deprecated-vars block, both commented out; restore-on-approval comment is stale given SeatGeek is declined. |

### 1d. Flagged partners: reachability verdict

| Partner | Status | Code residue | Can a link render today? |
|---|---|---|---|
| SeatGeek | DECLINED (x2) | env gate affiliates.ts:15, @deprecated builders :103, :182, analytics union :276, dev-page prose, PYV prose (5 venues), pipeline data | NO: zero import sites, env unset, zero prod occurrences. Builders tag aid directly onto seatgeek.com (no network redirect) if ever re-wired. |
| StubHub | NEVER APPROVED | env gate :16, @deprecated builders :113, :208, analytics union :277, stale SITE-AUDIT "pending" line | NO: zero import sites, env unset, zero prod occurrences. |
| Booking.com | UNCONFIRMED | two code comments (affiliates.ts:152, ExpediaCTA.tsx:11), stale SITE-AUDIT "Approved/wiring" line, aspirational mention in audit/cfb-stream-build-spec.md:216 | NO: zero hrefs, builders, env vars, or render paths. |

---

## Part 2: Sub-ID coverage by surface

One row per route x partner. "ID expression" is the exact source of the second half of the sub-ID. Bucket = does a shared token collapse page types or teams partner-side.

| Route | Partner (param) | Surface token | ID expression | Undefined/empty risk | Bucket collapse |
|---|---|---|---|---|---|
| /[sport]/[team] (baseline) | TicketNetwork (subId1) | web_team_page | {surface}_{team.id}, affiliates.ts:351 | no (route param; null-guard hides button) | no; placements (rail, home_game_card, promo_card) share one token, split only in PostHog |
| /[sport]/[team] | Ticketmaster (sharedid) | web_team_page | surface only, affiliates.ts:274 (no venueSlug on team pages) | env-shaped: wrap unset = bare URL, zero attribution | YES: all teams, all placements, one bucket (ranked item 1) |
| /[sport]/[team] | SpotHero (aff_sub) | web_team_page | {surface}_{team.id}, SpotHeroCTA.tsx:63 | no; missing coords degrade destination to homepage, tag intact | no (rail placement) |
| /[sport]/[team] | Expedia (pubref) | web_team_page | {surface}_{team.id}, hotel-link.ts:67 undated branch | no; null resolve hides CTA | no |
| /[sport]/[team] | Fanatics (subId1) | web_team_page | {surface}_{team.id}, affiliates.ts:466-468 | no; component null-gates on missing store URL | no |
| /[sport]/[team] away rows | TicketNetwork | web_away_game | {surface}_{PAGE team.id}; tnSurface flip at TicketmasterCTA.tsx:77-78 | no | partial: one bucket per page team across all its away games; joins vs Expedia mismatch (ranked item 4) |
| /[sport]/[team] away rows | Ticketmaster | web_team_page (NOT web_away_game) | surface passed, not tnSurface (TicketmasterCTA.tsx:85) | env-shaped as above | YES: away TM clicks indistinguishable from all other team-page TM clicks |
| /[sport]/[team] away rows | SpotHero | web_team_page | {surface}_{OPPONENT team.id}, ParkingCTA.tsx:81 with team=opponentTeam | no | YES: collides with the opponent's own-page bucket by construction (ranked item 3) |
| /[sport]/[team] away rows | Expedia | web_away_game | web_away_game_{OPPONENT team.id}, hotel-link.ts:67 dated branch | no; null resolve hides | partial: opponent-keyed, mismatches TN's page-team key |
| /[sport]/[team] promolist modal | TicketNetwork | web_team_page_promolist | {surface}_{team.id} via RedesignPromoRow default surface | no | distinct page-type bucket; dashboards must union with web_team_page |
| /[sport]/[team] promolist modal | Ticketmaster | web_team_page_promolist | surface only | env-shaped | YES: one bucket for all teams |
| /[sport]/[team] past bobbleheads | eBay (customid) | web_team_page prefix | ebayCustomId('team_page', synthPromoId) = web_team_page_{teamSlug}_{date}_{title} sanitized, ebay.ts:47-53 | no; campid unset = no link at all | no: most granular sub-ID on the page (per-promo) |
| /venues/[slug] | TicketNetwork | web_venue | {surface}_{hub.slug} (venueSlug branch), affiliates.ts:351; hub.slug = stored d.slug, venue-hub.ts:125, NO doc.id fallback | YES: d.slug absent = silent team-keyed fallback web_venue_{ticketTeam.id} | fallback is team-keyed, not shared |
| /venues/[slug] | Ticketmaster | web_venue | {surface}_{hub.slug} via SharedID venueSlug branch, affiliates.ts:274 | YES, two paths: d.slug absent = bare shared web_venue; env unset = no attribution at all | YES on fallback: all 222 buildings would share one bucket |
| /venues/[slug] | Fanatics | web_venue | {surface}_{hub.slug}, affiliates.ts:466-468 | YES: same d.slug path, silent team-keyed fallback; adId stays tenant-resolved | no |
| /venues/[slug] | SpotHero | web_venue | {surface}_{hub.slug}, SpotHeroCTA.tsx:63 | YES: same d.slug path; lat/lng 0 would pass page null-gate but fail hasValidCoords, degrading destination to homepage with tag intact | no |
| /venues/[slug] | Expedia | web_venue | {surface}_{hub.slug}, hotel-link.ts:104 (resolveVenueHotelLink, always undated) | YES: d.slug absent reroutes whole CTA through the TEAM resolver (ExpediaCTA.tsx:45 gate), pubref becomes web_venue_{ticketTeam.id} and search retargets team city | no |
| /venues/[slug] promos scroller, /venues index | none | web_venue / web_venue_index (analytics only) | internal links only | n/a | n/a. NOTE: index + sitemap key doc.id, detail sub-IDs key stored d.slug: divergence would misname buildings in revenue reports (ranked item 8) |
| /cfb/[school] | TicketNetwork | web_cfb | {surface}_{school.id} via toAffiliateTeam (page-extras.ts:85) | no: route param; TN slug always resolves (override ?? slugify) | no cross-school; cfb_signature and cfb_gameday placements share one subId1 |
| /cfb/[school] | Ticketmaster | web_cfb | surface only (no venueSlug on CFB), affiliates.ts:274 | env-shaped | YES: all 86 schools + schedule modal in one web_cfb bucket (ranked item 6) |
| /cfb/[school] | SpotHero | web_cfb | {surface}_{school.id}, SpotHeroCTA.tsx:63 | token never undefined; null venue would emit a TRACKED homepage link (fail-open); currently 86/86 coords verified | no |
| /cfb/[school] | Expedia | web_cfb | {surface}_{school.id}, hotel-link.ts:67 undated | no; hides on no-coords-no-city | no |
| /cfb/[school] | Fanatics | web_cfb | {surface}_{school.id}; store URL = CFB_FANATICS_STORES[school.id] | unmapped school = card silently missing (never a bad token); 86/86 mapped today | no; all CFB shares generic adId 586570, subId1 still splits |
| /cfb/[school] game modal | TN + SpotHero + Expedia | web_cfb | {surface}_{(hostSchool ?? school).id}, CfbSchedule.tsx:89 | no (?? school fallback) | partial: away-game clicks credit the OPPONENT school's bucket, indistinguishable from clicks on the opponent's own page; TM in the modal stays bare web_cfb |
| /cfb/rivalries/[slug] | TicketNetwork | web_cfb_rivalry | keyed.id = data.slug (RivalryMatchupPage.tsx:111), so subId1 = web_cfb_rivalry_{slug} | no: registry-validated param; both-schools-untracked drops the step | no: 33 per-slug tokens; the two schools of a matchup deliberately share the slug token. Ticket school = schoolIds[0] by order, not homeSchoolId (comment vs code) |
| /cfb/rivalries/[slug] | SpotHero | web_cfb_rivalry | inline literal web_cfb_rivalry_{data.slug}, RivalryMatchupPage.tsx:142 | no: gated on non-null coords precisely to avoid the tracked-homepage dead end | no |
| /cfb/rivalries/[slug] | Expedia | web_cfb_rivalry | {surface}_{keyed.id=slug}, hotel-link.ts:67 | no; VENUE_CITY_OVERRIDES lookup by slug always misses, harmless | no. No TM or Fanatics renders on this family |
| /cfb (hub), /nfl (hub) | none | analytics-only tokens | no affiliate builder imported | n/a | hub-originated revenue structurally invisible (by design: internal nav only) |
| /promos/today | TicketNetwork | web_today | {surface}_{p.team.id}, TodayPromoCard.tsx:49 | no: data layer drops promos with no parent team doc | no |
| /promos/today | Ticketmaster | web_today | surface only | env-shaped | YES: whole board in one sharedid bucket |
| /promos/today | SpotHero | web_today | {surface}_{team.id} | no; null venue degrades destination only | no. No Expedia/Fanatics on this surface |
| /follow | none | n/a (capture-funnel tokens only, follow-surface.ts) | no affiliate CTA on the route | n/a | n/a |
| /playoffs | TicketNetwork | web_playoffs | {surface}_{g.team.id} | no: teamless playoffPromos skipped, eliminated teams filtered before grouping | no |
| /playoffs | Ticketmaster | web_playoffs | surface only | env-shaped | YES: all playoff teams in one bucket |
| /playoffs | SpotHero (ParkingCTA) | web_playoffs | {surface}_{team.id}, ParkingCTA.tsx:81 | no; frequent null venues degrade destination only | no |
| /playoffs | Expedia (HotelsCTA) | web_playoffs | {surface}_{team.id}, undated | no; hides on null resolve | no |
| /mlb, /wnba, /mls hubs | TicketNetwork | web_{league}_hub_this_week | {surface}_{team.id} | no | no |
| /mlb, /wnba, /mls hubs | Ticketmaster | web_{league}_hub_this_week | surface only | env-shaped | YES per hub |
| / (homepage modals) | TicketNetwork | web_home_tonight / web_home_this_week | {surface}_{team.id} (client-only render after card tap) | no | no; away contexts dormant (home-game feeds only) |
| / (homepage modals) | Ticketmaster | web_home_tonight / web_home_this_week | surface only | env-shaped | YES per rail |
| /best-promos + /best-promos/bobbleheads | TicketNetwork | web_best_promos | hardcoded literal, scored-promo-card.tsx:122, 196 + {team.id} | no | YES: two routes, one token (ranked item 5) |
| /best-promos + bobbleheads | Ticketmaster | web_best_promos | surface only | env-shaped | YES doubly: both pages AND all teams |
| /my-teams | TN + Fanatics + SpotHero + Expedia | web_my_teams | {surface}_{team.id} each | no | no |
| /my-teams | Ticketmaster | web_my_teams | surface only | env-shaped | YES |
| /world-cup | TN + SpotHero + Expedia + Fanatics | web_world_cup | {surface}_{host-city team.id} | no; synthesized routingVenue supplies coords | within-route: rail vs game-modal clicks share tokens (PostHog splits) |
| /world-cup | Ticketmaster | web_world_cup | surface only | env-shaped | YES: 11 host cities in one bucket |
| /promos/bobbleheads | eBay (customid) | web_article (PostHog) / customid prefix web_bobbleheads_hub | ebayCustomId('bobbleheads_hub', synthPromoId) | no; campid-gated | partner-side no (placement segment splits); note three different names for one page (route /promos/bobbleheads, PostHog web_article, customid bobbleheads_hub) |
| email digest | none | web_email_* (PostHog join key only) | internal team-page links with a mimic subId1 query param | no | no partner bucket exists by design |
| /dev/affiliate-check | TN + TM (diagnostic) | web_team_page + 3 TM surfaces | production builders, plain anchors, no PostHog | no | dev clicks would pollute the web_team_page partner bucket; page is notFound() in production |
| /team-rankings, /teams, /promos/this-week, /promos/theme-nights, /promos/food-deals, /promos/jersey-giveaways, /promos/soccer-jersey-nights, /about, /download, /preferences, /confirm, /privacy, /terms | none | n/a | no affiliate imports (rg-verified) | n/a | n/a |

---

## Part 3: Render verification (production, cache-busting curl)

Method: curl -sS -D - with a unique cb= query param per URL plus Cache-Control: no-cache and Pragma: no-cache headers, 2026-08-14. Apex getpromonight.com returns HTTP 308 to www.getpromonight.com on every path; all rows below are the followed www fetch. Bodies saved to the session scratchpad. Every affiliate href was extracted from the returned HTML with entities decoded; sub-ID values below are what actually shipped.

| Surface | URL fetched | HTTP / cache | Shipped affiliate hrefs (deduped) and sub-IDs | Divergence vs Part 2 prediction |
|---|---|---|---|---|
| Team page baseline | /mlb/minnesota-twins?cb=17551800005 | 200; x-vercel-cache HIT, age 84923 | TM evyy.net /c/7236189/264167/4272, sharedid=web_team_page (x27, no team suffix). TN lusg.net /c/7236189/120057/2322 subId1=web_team_page_minnesota-twins (x15) + subId1=web_away_game_minnesota-twins (x12). Fanatics 93n6tx.net /c/7236189/618882/9663 subId1=web_team_page_minnesota-twins (x1). SpotHero aff_c aff_id=2427: aff_sub=web_team_page_minnesota-twins (home) + aff_sub=web_team_page_{padres, athletics, tigers, white-sox} on away rows. Expedia /affiliate camref=1011l5KcC9 pubref=web_team_page_minnesota-twins (home) + pubref=web_away_game_{opponent} x12 dated night rows. eBay sch/i.html campid=5339156327 customid=web_team_page_minnesota_twins_2026_06_27_Buxton_Bobblehead | NONE: matches source exactly, including the predicted TM surface-only sharedid, the SpotHero away mislabel, and the TN-vs-Expedia away-key mismatch. 30 bare fanatics.com URLs appear ONLY as RSC flight-payload data fields, not hrefs. |
| Playoffs | /playoffs?cb=17551800006 | 200; STALE, age 27264 | ZERO affiliate URLs of any partner anywhere in the 43,582-byte body (hrefs and RSC payload both grepped) | Source wires TN/TM/SpotHero/Expedia per team card; prod ships none. State-driven (offseason/no alive playoff teams renders no cards), NOT stale pre-fix HTML. |
| Follow | /follow?cb=17551800007 | 200; MISS, dynamic never-cached | ZERO affiliate hrefs. RSC payload ships 169 bare fanatics.com URLs as per-team fanaticsUrl data fields (data, not links) | Matches: route renders no affiliate CTA. |
| Today board | /promos/today?cb=17551800008 | 200; HIT, age 1616 | 25 teams x matched trios: TM sharedid=web_today (no team suffix, all 27 anchors), TN subId1=web_today_{team.id} (25 teams incl. oakland-athletics via /performers/ override path), SpotHero aff_sub=web_today_{team.id} | NONE: matches source, including the TM collapse. Fanatics/Expedia absent from SSR HTML as predicted (not on this surface). |
| Venue hub | /venues/arrowhead-stadium?cb=175518000093 | 200; HIT, age 33142 | All five partners, every sub-ID = web_venue_arrowhead-stadium: TM sharedid, TN subId1, Fanatics subId1 (campaign 618758), SpotHero aff_sub, Expedia pubref | NONE: the one surface where even TM carries the full building-keyed token (slug rides the venueSlug branch). |
| CFB school | /cfb/alabama?cb=175518000094 | 200; HIT, age 8958 | TM sharedid=web_cfb (NO school id). TN subId1=web_cfb_alabama. Fanatics subId1=web_cfb_alabama (college campaign 586570). SpotHero aff_sub=web_cfb_alabama. Expedia pubref=web_cfb_alabama | NONE vs source, but confirms ranked item 6: TM alone drops the school id. |
| CFB rivalry | /cfb/rivalries/iron-bowl?cb=175518000095 | 200; HIT, age 8959 | TN subId1=web_cfb_rivalry_iron-bowl, SpotHero aff_sub=web_cfb_rivalry_iron-bowl, Expedia pubref=web_cfb_rivalry_iron-bowl. No TM, no Fanatics anywhere in body | NONE: matches the three-partner design. Only an Alabama TN link ships (schoolIds[0]); SpotHero/Expedia target Bryant-Denny. |
| Aggregator | /best-promos?cb=175518000096 | 200; PRERENDER, age 0 | 50 TN anchors (19 unique) all subId1=web_best_promos_{team.id}; 50 TM anchors all sharedid=web_best_promos (no team). 30 bare fanatics.com URLs in RSC payload only (incl. legacy slug cleveland-indians), zero as hrefs | NONE vs source; confirms ranked item 5 (TM single bucket) and the RSC data exposure. |
| Sitemap | /sitemap.xml?cb=175518000092 | 200; HIT | n/a (used to pick venue + rivalry slugs) | n/a |

SeatGeek, StubHub, Booking.com: zero occurrences on every fetched page. Overall Part 3 verdict: production HTML matches current source on every surface; no ISR pre-fix HTML detected. The observed subId payloads confirm the Part 2 defects (TM surface-only everywhere except venues; SpotHero away mislabel; away-key divergence) are what actually ships.

---

## Part 4: Affiliate env var reconciliation

Names only, no values. For diffing against `vercel env ls production`.

| Variable | File:Line | Usage |
|---|---|---|
| NEXT_PUBLIC_TICKETMASTER_IMPACT_WRAP | src/lib/affiliates.ts:22 | Impact wrap-link template for Ticketmaster ({TARGET} + {SHARED_ID} slots); gates isPartnerActive('ticketmaster'). Unset = bare unattributed ticketmaster.com links sitewide. Confirmed live in prod via rendered evyy.net hrefs; reads empty via vercel env pull (no decryption). |
| NEXT_PUBLIC_TICKETMASTER_IMPACT_WRAP | src/app/dev/affiliate-check/page.tsx:29 | Dev-only diagnostics display of wrap state. |
| NEXT_PUBLIC_EBAY_CAMPID | src/lib/ebay.ts:11 | EPN campaign ID for bobblehead resale links; unset = no link renders. Confirmed set in prod (campid present in shipped href). mkrid is a hardcoded constant beside it (line 13). |
| NEXT_PUBLIC_SEATGEEK_AID | src/lib/affiliates.ts:15 | Gates the @deprecated SeatGeek builders + isPartnerActive('seatgeek'). FLAG: SeatGeek declined; this var should NOT be set anywhere. |
| NEXT_PUBLIC_STUBHUB_RID | src/lib/affiliates.ts:16 | Gates the @deprecated StubHub builders + isPartnerActive('stubhub'). FLAG: StubHub never approved; should NOT be set. |
| TICKETMASTER_API_KEY | scripts/ticketmaster-team-mapping.ts:43 | Discovery API key for the offline team-mapping script (data API, not click tracking). |

Deliberately env-less (hardcoded, nothing to reconcile in Vercel):

| Partner | File:Line | Hardcoded tracking material |
|---|---|---|
| TicketNetwork | src/lib/affiliates.ts:291-297 | Impact /c/7236189/120057/2322 prefix on ticketnetwork.lusg.net; partnerPropertyId 8313917. |
| Fanatics | src/lib/affiliates.ts:376-384 + src/lib/fanatics-ad-ids.ts | Impact /c/ origin fanatics.93n6tx.net, account 7236189, campaign 9663; 121 per-team adIds, generic 586570. |
| SpotHero | src/lib/affiliates.ts:496-508 | tracking.spothero.com/aff_c, offer_id=1, aff_id=2427 (see ranked item 2 network conflict). |
| Expedia | src/lib/affiliates.ts:531-541 | camref=1011l5KcC9, creativeref=1100l68075, adref=PZPbSQWcB2, siteid=1. |

---

## Method notes

- Grep sweep covered fanatics.com, 93n6tx.net, evyy.net, lusg.net, ticketmaster.com, ticketnetwork, spothero, prf.hn, partnerize, hasoffers, aff_c, expedia, camref, ebay, rover.ebay, ebay.us, campid, seatgeek, stubhub, booking.com, plus a second-pass sweep for pxf.io, sjv.io, 7eer, ojrq, anrdoezrs, tkqlhce, dpbolvw, jdoqocy, awin, shareasale, impact.com, go2cloud, mkcid, irclickid (only hits: the known EPN builder and the terms/privacy prose).
- Completeness pass verified: all link assembly lives in lib/affiliates.ts, lib/ebay.ts, lib/hotel-link.ts, lib/cfb/fanatics-stores.ts; the only anchor-emitting primitive is tracked-affiliate-link.tsx and every caller is inventoried; no partner links in public/ (ads.txt is Google display only), next.config, middleware, sitemap, robots, JSON-LD, or any API route; Firestore-doc URL fields rendered as hrefs are all non-affiliate (bagPolicyUrl, YouTube schedule videos, rivalry editorial sourceUrls, FIFA fan-fest links); promo row hrefs are internal anchors only.
- One sweep's exclusion glob ('!*lock*') initially skipped TicketsBlock.tsx; the miss was caught and the file fully inventoried.
- Production fetches: 12 URLs total (8 pages + sitemap + apex redirects), all via curl with unique cb params; bodies retained in the session scratchpad, not in the repo.
- Prior-session context consistent with findings: the Fanatics Impact fix (2026-07-09) and the KNOWN_SURFACES web_venue mislabel fix are both live and holding.

END OF REPORT. No fixes proposed or applied; awaiting review.

---

## Addendum, 2026-08-14: correction, fixes deployed, attribution boundaries

### SpotHero correction (ranked item 2 RESOLVED, not a defect)

Owner correction received 2026-08-14: SpotHero runs its own in-house affiliate system. The tracking.spothero.com/aff_c pattern with aff_id=2427 is CORRECT and attributing. Ranked item 2 above is withdrawn as a defect; the earlier "Partnerize" line in the partner map was the error, not the code. The endpoint and aff_id were not changed; they are now pinned as blessed values by the build guard below, and SpotHero's aff_sub was unified with the other partners in the same deploy.

### Fix deploy record

Branch feature/affiliate-attribution-fixes (6 commits) merged to main with --no-ff as 5d43025 and pushed 2026-08-14. Production deployment created 2026-08-14T14:30:38Z, build duration 3m, READY at approximately 2026-08-14T14:33:38Z. The deployment baseline already contained fix/cfb-source-url-artifacts (4e33144, merged earlier as 8ccb4ff), so this deploy introduced only the affiliate changes. Gate 4 render verification ran post-deploy with cache-busting curls on the original 8 URLs plus /mlb, /best-promos/bobbleheads, and the 5 MLS venue pages: all checks passed, including character-verified identical compound away tokens across all four partners.

### AFFILIATE ATTRIBUTION BOUNDARY: 2026-08-14T14:33:38Z (deploy READY)

Partner dashboards (Impact SharedID/subId1, SpotHero aff_sub, Expedia pubref) show OLD and NEW sub-ID tokens as separate rows across this instant. Examples: Ticketmaster rows move from bare surfaces (web_team_page, web_cfb, web_today, web_best_promos, hub surfaces) to full {surface}_{id} tokens; away rows move from four divergent shapes to one compound web_away_game_{pageTeamId}_at_{opponentId}; bobbleheads rows move from web_best_promos_{team} to web_best_promos_bobbleheads_{team}. Any per-surface or per-token revenue comparison that spans this boundary is INVALID; treat pre-boundary and post-boundary token families as separate series.

### SECOND BOUNDARY, same instant: /best-promos/bobbleheads page_view surface

At the same deploy, the page_view surface for /best-promos/bobbleheads changed from web_best_promos to web_best_promos_bobbleheads (ScoringPageViewTracker surface prop). PostHog and GA4 surface-level trends for that route (pageviews, CTR joins, funnels keyed on surface) are also invalid across the boundary: pre-deploy bobbleheads pageviews live under web_best_promos, post-deploy under web_best_promos_bobbleheads. The web_best_promos series simultaneously loses bobbleheads traffic, so its own trend also steps at this instant.

### Resolution status per ranked item

1. Ticketmaster surface-only sub-IDs: FIXED. SharedID now carries the full {surface}_{id} token on every surface. Prod-verified post-deploy: sharedid=web_team_page_minnesota-twins, web_cfb_alabama, web_today_{team}, web_best_promos_{team}, web_best_promos_bobbleheads_{team}, web_mlb_hub_this_week_{team}, web_venue_arrowhead-stadium.
2. SpotHero network conflict: RESOLVED, NOT A DEFECT. In-house program confirmed by owner; aff_c + aff_id=2427 correct and untouched; constants pinned by the build guard.
3. SpotHero away-row mislabel: FIXED. Away parking now ships the shared compound token; the web_team_page_{opponent} shape is gone from away rows.
4. Away-key divergence: FIXED. One helper (awayGameSubKey) computes web_away_game_{pageTeamId}_at_{opponentId}; TN subId1, TM sharedid, SpotHero aff_sub, and Expedia pubref verified character-identical on prod (/mlb/minnesota-twins, 4 away opponents).
5. best-promos collapse: FIXED. /best-promos and /best-promos/bobbleheads emit distinct per-team tokens for both TN and TM; page_view surface split in the same deploy (see second boundary).
6. CFB Ticketmaster collapse: FIXED. sharedid=web_cfb_alabama prod-verified; schedule-modal TM keys the host school like TN.
7. TM wrap latent failure: FIXED. Prebuild guard fails production-target builds on absent/empty wrap and fails EVERY environment on a malformed value (whitespace including trailing newline rejected); 11 hardcoded constants (TN, Fanatics, SpotHero aff_c + 2427, Expedia camref family) drift-checked against an independent blessed copy. Absence on preview/dev warns instead of failing until the var is added to the Preview target (owner adding it); then tighten to unconditional.
8. Venue slug fragility: FIXED. Venue-hub sub-ID slug now keys doc.id (routing truth) whenever the stored field is missing or diverging.
9. Legal prose: FIXED for user-facing pages. /terms and /privacy name exactly the live partner set (Ticketmaster, TicketNetwork, Fanatics via Impact; eBay via eBay Partner Network; SpotHero and Expedia in-house); Awin, CJ Affiliate, FlexOffers, Partnerize, and sportsbook references removed; diff reviewed and approved before applying. STILL OPEN: the stale partner-status lines in docs/SITE-AUDIT.md:233-235 (Booking.com "Approved/wiring", StubHub "pending") and its generated sibling, a generator-managed internal doc left untouched by this fix set.
10. Declined-partner residue: FIXED. SeatGeek and StubHub builders, env gates, and both partner-union members deleted; SeatGeek removed from the seeded PYV parking prose on the 5 MLS venues in prod Firestore (snapshot-first, verified, seed JSON matched) and confirmed absent from all 5 rendered pages post-deploy. Deliberately retained: historical prose (dev affiliate-check footnote, TicketsBlock retirement comment, "StubHub Center" stadium naming) and pipeline research data.

END OF ADDENDUM.
