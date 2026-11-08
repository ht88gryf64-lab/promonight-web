# Per-promo pages v2: content depth

Decided 2026-11-07. Builds on promo-pipeline/docs/per-promo-pages-spec.md (v1, live 2026-10-30). v1 proved the page type indexes and ranks; v2 gives the page enough on it to deserve the position and to earn a second pageview. First 10 explainer entries approved 2026-11-07, files in content/promo-explainers/.

## The problem (observed 2026-11-07, Minnesota United Fan Appreciation)

Above the fold: H1, game line, CTAs. Below: a generated card restating the H1, a sponsor tile restating the About, an About that is one sourced sentence. Three screens, six distinct words. Nothing to read, nothing to click except out.

## Prerequisite: fix row-click interception (ship first, separately)

Team-page schedule rows carried the correct promoPageHref in markup, but only the title text was an anchor; the row itself was a role="button" whose onClick opened the shared ticket modal. The two homepage card components had the identical pattern. Crawlers got a link, a thumb anywhere but the title text got a modal, team page to promo page produced near-zero pageviews. (Earlier draft blamed a GameExpand ssr:false handler; that was wrong, the mechanism above is what shipped. Fixed 2026-11-07: RedesignPromoRow, LightHomePromoCard, TicketStubCard; test in src/components/redesign/__tests__/promo-row-click.test.tsx.)

Rule: **row click navigates; the ticket modal opens only from an explicit Tickets button.**

- Card body, title, date block render as a Link with no onClick.
- Tickets button inside the row opens the modal with stopPropagation.
- Test: render the row, click the title, assert navigation and no modal. This is the known-bad input the existing promoPageHref test cannot see.
- Audit every surface that reuses the row component: homepage ribbon / Tonight / This Week / Best Promos, 9 aggregators, venue Next giveaways here, my-teams.
- Verify after: PostHog promo_link_click by surface, team_page should go from ~0 to the largest surface within a week.
- Post-merge: re-record mlb-nfl-byte-identity goldens on main as a separate commit (PromoList HTML changed by design).
- Follow-up: my-teams rows link to the team page and never read promoPageHref from the API. Separate ticket.

## Doctrine (unchanged, restated for this build)

- Every sentence on the page is a stored field, derived from stored fields by a query, or comes from the authored explainer library. No model-generated prose at render time, ever.
- Authored library copy is general knowledge about a promo type or theme, phrased as general ("typically", "many clubs"), and visually separated from the sourced About block. It never asserts a fact about this specific game.
- A block with no data renders nothing. No placeholders, no "check back later".
- No completeness claims, no hardcoded counts.
- Venue facts render only from provenance DB fields in state `rendered`, with the observed date shown.
- Imagery: never stock, never model-generated, never hotlinked, no team or sponsor logos. Real photos only where a confirming token exists (v1 image rules) or where an affiliate API supplies them.

## Page order, mobile first (390px)

1. Breadcrumb, team color band, type badge, H1, game line, venue line
2. **Date tile** (see Visuals) beside or above the CTA row
3. CTA row (unchanged; TicketNetwork primary per 2026-11-02)
4. **Image: tier 1 photos only.** Tier 3 generated card stays as og:image and leaves the body. (Ships with the prerequisite, it is a one-line change.) Bobblehead pages without tier 1 use the eBay product image block instead.
5. **About this promo** (sourced) with sponsor folded in as a line. Renders only when there is sourced prose (a description, or the package sentence per the 2026-10-24 ruling); otherwise the source credit, read date and sponsor move to a meta line under the venue line in the header.
6. **This game** (derived): opponent with link, kickoff day and time, doors when stored, position in the home schedule ("3rd-to-last home match of 2026") with the season timeline graphic, every other promo on this date for this team listed with links (the canonical-group losers finally get a visible home), "N more giveaways at {venue} this month" linking to the venue page. Specific facts sit above the general guide on purpose.
7. **What to expect at a {type/theme}** (authored library, see below)
8. **Before you go** (provenance DB): bag policy, parking, gates, transit, each with observed date, plus forecast and map tile when available. Replaces the thin venue quick facts.
9. **Previous editions** (archive): same team + themeKey in prior seasons, date, opponent, link to archived page, past tier 1 photo when one exists. Requires rollout step 3 (archive pass).
10. **{Theme} nights across {league}, {season}** (derived table): team, date, giveaway or sponsor, link. Replaces the current Same promo other teams list.
11. **Promo rail**: the team's next 5 promos as a horizontal card rail. Replaces More team promos text links.
12. **Presented by {sponsor}** linking to /sponsors/{sponsorSlug} (new page family, below)
13. FAQs from stored fields plus library FAQ entries keyed by type/theme.

Whole body stays in one article for Raptive density. CTA stays above the first in-content unit.

## Visuals (decided 2026-11-07)

Ranked by life-per-effort. All data-driven, all inside the imagery doctrine.

1. **Team-color theming.** Team primary/secondary (already stored for the tier 3 card) drive the type badge, CTA, section rules, a thin band under the breadcrumb and the date tile. Contrast-checked against the page ground; fall back to house red when a team color fails WCAG AA on text. Ships with the content floor.
2. **Date tile with live state.** Day-of-week, large day number, month, and a state line: "Tonight · gates 5:30" (doors when stored), "In 3 days", else the weekday. Series pages render a stacked date rail with the same tile shrunk. State line computed at request time in the venue timezone. Ships with the content floor.
3. **Promo rail.** Horizontal scroll, next 5 team promos, each card: type icon, name, date tile mini. Links through promoPageHref. Also the component the email digest redesign uses.
4. **Season timeline.** One SVG bar across the team's home schedule, a dot per promo colored by type, this game marked, hover/tap shows the promo name. Derived from schedule data only.
5. **Type icon set.** Full set covering every promo type (bobblehead, jersey, hat, fireworks, food deal, kids, heritage, fan appreciation, ticket package, theme night). Single SVG sprite, used in badge, rail, timeline, aggregators, email, social cards.
6. **eBay product images on bobblehead pages.** EPN Browse API, same query the tier 2 block already runs; render up to 3 listing images with price and affiliate link. Real photos of the item, affiliate-sanctioned. Applies to upcoming bobbleheads without a tier 1 image and to all archived bobbleheads. Image URLs come from the API response at render time; cache per ISR window, never store.
7. **Forecast.** NWS API (api.weather.gov, free, no key) for outdoor venues within 7 days of the game: high/low, precip chance, one condition icon in the type icon style, not NWS icons. Renders inside Before you go. Needs venue lat/lng and an indoor/outdoor flag on the venue doc.
8. **Map tile.** Static map with a venue pin (Mapbox Static or self-rendered OSM tiles) inside Before you go, linking to directions. Last in order; only worth it once the block has real facts next to it.

Explicitly out: team logos, sponsor logos, hero photography without a confirming source, any decorative stock.

## The explainer library

Repo files, versioned, reviewed by Matt before merge: `content/promo-explainers/{key}.md`. Frontmatter `{ key, kind: type|theme, title, faqs: [{q, a}] }`, body is the explainer prose.

- Keys: every promo type (bobblehead, jersey, hat, theme night, fireworks, food deal, ticket package, kids run the bases, etc.) plus the top ~35 themeKeys by page count (pride, star wars, fan appreciation, heritage nights by group, dog day, faith and family, 90s night, etc.).
- Length: 80 to 160 words body, 2 to 4 FAQs each. Short and specific beats long and generic.
- Voice: PromoNight house voice, plain, second person, no hype. No em dashes.
- Phrasing rule: general claims only. "Fan Appreciation nights typically bundle concession discounts, on-field recognition for season-ticket members and a giveaway at the gates." Never "this game includes".
- Fallback cascade: themeKey entry, else type entry, else nothing.
- Rendered under a small-caps "General guide" label.
- Library FAQs merge into the page FAQ block after the stored-field FAQs.
- Target: ~50 entries covers roughly 90% of upcoming pages. First 10 approved 2026-11-07 (bobblehead, jersey, hat, fireworks, food-deal, theme-night, fan-appreciation, pride, star-wars, hispanic-heritage).
- Next 10 by likely page count: kids-run-the-bases, dog-day, faith-and-family, 90s-night, black-heritage, aapi-heritage, irish-heritage, military-appreciation, college-night, halloween.

## Sponsor pages

`/sponsors/{sponsorSlug}`: every upcoming promo with presentedBy matching, grouped by league, plus past editions once the archive exists. Slug minted once from the normalized sponsor name, same rules as pageSlug. Noindex until a sponsor has 3+ upcoming promos, then in the sitemap. Normalize sponsor strings in the pipeline first (Target vs Target Corporation vs Target Stores) or the index fragments.

## Archive pass (rollout step 3, now in scope)

- Past pages stay indexable for two seasons back, noindex after.
- Previous edition links both directions (past page links forward to the current edition).
- eBay tier 2 block on past bobbleheads.
- Completed promos behind the team page "Show N more" toggle must be in the served markup so the links are crawlable.

## Status

- Content floor (build order step 2) built 2026-11-07 on feature/promo-pages-v2-content-floor. Team colors: single source confirmed (teams/{id} ARGB via mapTeamDoc), 169/169 stored; contrast gate sends Ducks-type palettes to house red. Opponent links resolve on 96.9% of upcoming pages; the rest are MLB 2027 and MLS dates with no games spine yet. A second, unreconciled color copy lives on venues/{slug} (primaryColor/accentColor); nothing reads it, ticket if venue hubs ever theme.

- Step 3 (icon set, promo rail, season timeline) live 2026-11-07, merge b0817c3, deploy dpl_5j7pVT3jTgqfvnpt27YFfnNKwXcL. Timeline shipped single-tone with one accent ring; category colors withdrawn until a legend earns its space. Hat glyph is weak at 16px (known-issues 77). Email rail renderer exists in src/lib/promo-rail.ts, not yet wired into the digest.
- Step 4 (Before you go) built 2026-11-08 on feature/promo-pages-v2-step4. A row renders only for a venueHubs field in state `rendered` with its own read time, dated and linked to the operator page; conflict and held render nothing. Audit (scripts/audit-before-you-go.ts, 2026-11-08): the block renders on 475 of 1,152 upcoming promo pages (NHL 292, NBA 176, NFL 7; every MLB and MLS page is without). Buildings clearing the verified + rendered + dated gate: bag 26, parking 22, gates 0, transit 0. The venue quick-facts card is retained as the fallback wherever the block has zero rows (never both), until coverage reaches 90% of upcoming pages. Pipeline tickets: (a) verify the 21 buildings that are rendered and dated but unverified, which adds 258 pages; (b) read times for transit (7 buildings in state rendered) and gates (3 overlays), currently zero renderable rows; (c) an indoor/outdoor flag on the venue docs, none exists on venueHubs, tenants or venues today, which blocks the step 5 forecast. lat/lng are numeric on all 223 venueHubs and 148 venues docs.
- Live battery (npm run test:live) runs after every production deploy, no exceptions (CLAUDE.md). Guard 8 asserts the General guide is in the bundle; guard 2 holds team pages under 950,000 bytes, Twins at 945,889 after the row trim. Issue #30 must land before the MLB 2027 ingest in January.

- 2026-11-08: ux-review agent (.claude/agents/ux-review.md) is a standing pre-merge step for any diff under src/components or a page route; reports in docs/ux-review/. Three reports to date.
- 2026-11-08 played-game state live (1711b58): past pages stop selling (no ticket/parking/hotel/reminder, no offers), show "Next {team} promo" and edition links. overflow-anchor:none on the article fixed the back-navigation jump caused by Raptive slot re-insertion; guard 9 in the live battery measures it on production.
- 2026-11-08 polish live (4c20fac): This game dropped the redundant rows; <time> with venue zone; current-page breadcrumb; timeline static on touch, caption above bar; FAQ full-card hit area; --color-rd-link #c62a1e (5.06:1); opaque header; footer white/60; "checked" wording on promo pages. First-party axe serious/critical: 0 on the promo page.
- Open pipeline tickets that unlock page content: verify 21 venueHubs buildings (+258 Before you go pages, Honda Center link); read times for transit and gates; indoor/outdoor flag (step 5 forecast). Web tickets: known-issues 78 to 82.

- 2026-11-08 verification run (promo-pipeline): Before you go renders on 713 of 1,152 upcoming promo pages (475 on Friday); 208 verified buildings; 106 pages still blocked by an unverified building; 48 Firecrawl credits. Guard now refuses rendered fields without read times; unchanged-field filter makes second-dry-run-zero a real check; gates and transit rows live (transit re-sourced to agency pages). Open: T6 tenant-overlay bag fields (Honda Center), T7 transit label prefixing, and a rule decision on buildings whose operator page names no lots and directs to a vendor (capital-one, golden-1, spectrum, paycom, frost-bank).

- Step 5a (eBay product images, Visuals 6) built 2026-11-08 on feature/promo-ebay-images, held for review. The block calls the Browse API at request time (src/lib/ebay-browse.ts) with the tier 2 search link's own query (src/lib/ebay.ts resaleQuery), one 800ms deadline over the token and the search, up to three listings (image, price, EPN item link from the API's itemAffiliateWebUrl, else the item URL carrying the search link's parameters), held only inside the page's 86400s ISR window and never written anywhere. Rendered under About on a live bobblehead giveaway with no tier 1 photo and on every played bobblehead page; a tier 1 upcoming page asks eBay nothing. Guard: a listing shows only when its title carries, as a whole word, a token of the promo name that is not a category noun (IMAGE_TOKEN_STOPLIST, authored in web on 2026-11-08: no copy of that constant exists in this repo or any checkout on the build machine), not the club's own words and not a number; zero confirmed listings is no block; a name with no confirming token ("Mystery Bobblehead") makes no call. Failure (API error, 429, timeout, missing credentials) renders no block and logs once per page per window; the page never throws. Click: promo_link_click, surface web_promo_page_ebay, destination ebay; the disclosure line under the block is the site's affiliate wording. Sitemap read 2026-11-08: 81 bobblehead promo pages (the URL carries "bobblehead"), 20 with a tier 1 photo (NHL 13, NBA 7), 61 without (NBA 39, NHL 18, MLB 3, NFL 1); 4 of the 61 have no confirming token (Canadiens Bobblehead Night, Senators Mystery Bobblehead, Kraken Bobblehead, Golden Knights Player Bobblehead), so 57 upcoming pages can carry the block. BLOCKER: no Browse API keyset exists in Vercel or locally (only NEXT_PUBLIC_EBAY_CAMPID, Production); EBAY_CLIENT_ID and EBAY_CLIENT_SECRET (the production keyset's App ID and Cert ID, .env.example) must be set before the block can render in production. The review (docs/ux-review/2026-11-08-feature-promo-ebay-images.md) ran the branch dev server with a preload stub answering the API from four real listings read from eBay's search page for the Nets' Julius Erving bobblehead.

## Build order

1. Prerequisite row-click fix + drop tier 3 card from body. Same day.
2. Content floor: About merge, library (first 10 entries), This game, team-color theming, date tile. One build.
3. Promo rail, season timeline, type icon set.
4. Before you go from provenance fields (NHL arenas have data now; MLS and MLB venues are the next provenance wave, promo pages are the reason).
5. eBay product images on bobblehead pages; NWS forecast.
6. Archive pass + Previous editions.
7. League-wide theme table + sponsor pages.
8. Map tile. Library to 50 entries, ongoing.

## Measurement

- Read 2026-11-21: promo-page pages-per-session and promo_link_click by surface (PostHog), promo-page impressions and average position on the /promos/ family (GSC export, not Ahrefs), Raptive per-page RPM promo pages vs team pages (Creator API).
- Success: promo pages carry a second pageview at a higher rate than team pages, and the four early bobblehead pages hold or improve position after the content lands.

## Open

- "General guide" label: decided yes.
- Archive depth: two seasons is the default, revisit if the eBay block earns.
- Team colors: confirm every team doc has both primary and secondary stored and that the values are the ones used on the tier 3 card, not a second copy.
