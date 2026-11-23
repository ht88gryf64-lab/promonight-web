# ux-review: feature/fubo-subid-parity (2026-11-22)

Run at 21:31 America/New_York. Baseline mode, promo page type.

- **Page:** `/nba/atlanta-hawks/promos/kids-game` (Hawks vs Pistons, Sun 2026-11-22). The caller chose it instead of the sitemap-resolved sample.
- **Branch:** `feature/fubo-subid-parity` at 994b697, served by `next start` on http://localhost:3100 with PROMO_PAGES_LIVE=true. The dev server has no `promonight-deploy` meta.
- **Production:** https://www.getpromonight.com, `dpl_EfBmiQBQyVCahyGK6Gr4an6op4jp`.
- **Diff under review:** `FuboCTA` takes a `pageSlug` prop and `PromoPageView` passes `page.slug`. The href gets `subId3`, and `subId2=share` in a shared-link session.
- **Artifacts:** the screenshots, diff images and HTML extracts are outside the repo, in `/private/tmp/claude-501/-Users-mattkovalik-promonight-web/0d155f60-51e9-4635-86ac-1a347175841c/scratchpad/uxr-subid/`. Ads were blocked for every render.

## Baseline differences

**Served HTML of the `<article>`.** I stripped scripts, the deploy meta, nonces, build hashes and `dpl_` ids from both pages. Each page is then 560 lines, and 2 lines differ:

1. **The Fubo href (the intended change).**
   - Production: `/go/fubo/nba/nba-2026-11-22-detroit-pistons-at-atlanta-hawks?s=web_promo_page&t=atlanta-hawks`
   - Branch: the same href plus `&subId3=kids-game`.
2. **The "Also on Ticketmaster" href (environment noise).** Production serves the Impact wrap `ticketmaster.evyy.net/c/7236189/264167/4272?u=...&sharedid=web_promo_page_atlanta-hawks&subId3=kids-game`. The branch serves the bare `www.ticketmaster.com/atlanta-hawks-tickets/artist/805898`. The Ticketmaster wrap env var is not set locally. The diff does not touch this link.

Nothing else in the article differs. Outside the article, the footer differs once: production has an "Events" link (`data-event-link="footer_events"`) and the branch does not. That is environment noise from EVENTS_PAGES_LIVE, which is on in production and off locally.

**Pixel diff, ads blocked.** The article area matches exactly at every viewport. Every differing pixel is below the article: it is the footer, which is 34px shorter on the branch because the "Events" link is missing and everything under it moves up. None of it comes from the diff.

| Viewport | Production | Branch | Differing px | First diff row | Article bottom | Diff image |
|---|---|---|---|---|---|---|
| 390 | 390x3808 | 390x3774 | 17,336 | 3267 | 2536 | `/private/tmp/claude-501/-Users-mattkovalik-promonight-web/0d155f60-51e9-4635-86ac-1a347175841c/scratchpad/uxr-subid/390-diff.png` |
| 768 | 768x2843 | 768x2809 | 28,769 | 2519 | 2321 | `/private/tmp/claude-501/-Users-mattkovalik-promonight-web/0d155f60-51e9-4635-86ac-1a347175841c/scratchpad/uxr-subid/768-diff.png` |
| 1280 | 1280x2819 | 1280x2785 | 46,166 | 2519 | 2321 | `/private/tmp/claude-501/-Users-mattkovalik-promonight-web/0d155f60-51e9-4635-86ac-1a347175841c/scratchpad/uxr-subid/1280-diff.png` |

**Measurements that moved.** Document height dropped 34px, and the interactive count and the under-44 count each dropped by 1. All three come from the footer "Events" link. Nothing else moved; see the table below.

**Shared-link session on the branch.** I loaded `?utm_source=share&utm_medium=copy&utm_campaign=promo_page&s=qv7k2m9x` at 390 and waited 5s after load.

| Link | subId2 | subId3 |
|---|---|---|
| Stream on Fubo: `/go/fubo/nba/nba-2026-11-22-detroit-pistons-at-atlanta-hawks?s=web_promo_page&t=atlanta-hawks&subId3=kids-game&subId2=share` | share | kids-game |
| TicketNetwork "Get tickets" | share | kids-game |
| TicketNetwork row "Tickets" links (x3) | share | kids-game |
| Ticketmaster, bare locally (not an Impact link, so left alone) | none | none |

- **Parity:** the Fubo link and all four TicketNetwork links carry the same subId2 and subId3.
- **Same session on production:** the Fubo href carries neither sub-ID. The TicketNetwork and Ticketmaster links carry share and kids-game.
- **Plain session on the branch:** Fubo carries `subId3=kids-game` and no subId2, which matches the TicketNetwork links.
- **Console:** no hydration error, React error or page error in either session. Every console error comes from the third-party ad and identity stack: CORS refusals for the localhost origin (yahoo ups, rlcdn, optable, postrelease, raptivecdn), a redirect loop at user-sync.fwmrm.net, and some DNS failures. Our origin had no failed requests.
- **One hop to fubo.tv:** both hosts answer 307 to `www.fubo.tv`.
  - Branch: `/stream/nba/?irmp=7236189&irad=356361&sharedid=USA_Basketball_NBA_Detroit-Pistons-at-Atlanta-Hawks&subId1=web_promo_page_atlanta-hawks&subId2=share&subId3=kids-game`
  - Production: the same URL without subId2 and subId3.

## Game date check

- **Dates read.**
  - Game lines: Sun Nov 22, 2026 3:30 PM; Sun Feb 7, 2027 3:00 PM; Sat Mar 13, 2027 3:00 PM.
  - JSON-LD Event `startDate`: 2026-11-22, 2027-02-07, 2027-03-13.
- **Today:** 2026-11-22 in the venue zone. State Farm Arena is in Atlanta, and the page states no zone, so America/New_York applies.
- **Verdict:** this is not a played-game page. One date is today and two are in the future. The run is at 21:31, six hours after the 3:30 PM tip of the Nov 22 game; that case is defect D1 below.

## Things that work

1. **The CTA cluster is unchanged.** At 390 a fan sees the date rows with their Tickets links, the venue, the date tiles, then Get tickets / Share, Also on Ticketmaster, Stream on Fubo, the "Availability varies by market." line, and Parking / Hotels / Remind me. These are the same pixels as production at every viewport. Stream on Fubo is still 101x44 at y=472, at 5.06:1 contrast, with the market line at 4.52:1. Screenshot: `/private/tmp/claude-501/-Users-mattkovalik-promonight-web/0d155f60-51e9-4635-86ac-1a347175841c/scratchpad/uxr-subid/390-branch-fold.png`.
2. **Sub-ID parity holds after hydration.** Fubo and TicketNetwork carry identical subId2 and subId3, and the hop forwards both to fubo.tv.
3. **No layout cost.** CLS is 0 at 390 and 0.0002 / 0.0001 at 768 / 1280, the same as production. There is no horizontal overflow (scrollWidth = clientWidth at every viewport).

## Defects

The diff introduces none. D1 and D2 are already in production, are carried here, and do not block this merge.

- **D1 (medium, production behaviour).** On game day after the game has started, the page still sells the game as upcoming. At 21:31 ET, six hours after the 3:30 PM tip:
  - the Nov 22 tile reads "TONIGHT";
  - "Next game" lists Detroit Pistons, Nov 22;
  - the Nov 22 row still has its "Tickets" link;
  - the primary "Get tickets" goes to the TicketNetwork listing `atlanta-hawks-vs-detroit-pistons-tickets-sun-nov-22-2026`;
  - "Stream on Fubo" goes through the hop to fubo.tv for that game.

  The played state only starts when the date is before today. A search of docs/known-issues.md found no entry for the case where the start time has passed on game day. Under the merge rule this needs a known-issues entry or a written waiver. Seen at all viewports. Screenshots: `/private/tmp/claude-501/-Users-mattkovalik-promonight-web/0d155f60-51e9-4635-86ac-1a347175841c/scratchpad/uxr-subid/390-branch.png`, `/private/tmp/claude-501/-Users-mattkovalik-promonight-web/0d155f60-51e9-4635-86ac-1a347175841c/scratchpad/uxr-subid/390-production.png`.
- **D2 (low, production behaviour, unchanged).**
  - 39 visible interactive elements are under 44x44 at 390 (production: 40, which includes its footer "Events" link). They include the three inline row "Tickets" links (43x14), "Also on Ticketmaster" (133x21), the breadcrumbs, and the `statefarmarena.com ›` source links (108x12).
  - The header wordmark "NIGHT" is 4.33:1 on #f7f3ea. It is the only contrast failure and the only serious axe violation (color-contrast, 1 node).

## Measurements

| Measure | Branch 390 | Prod 390 | Branch 768 | Prod 768 | Branch 1280 | Prod 1280 |
|---|---|---|---|---|---|---|
| HTTP status | 200 | 200 | 200 | 200 | 200 | 200 |
| Document height (px) | 3774 | 3808 | 2809 | 2843 | 2785 | 2819 |
| CLS | 0.0000 | 0.0000 | 0.0002 | 0.0002 | 0.0001 | 0.0001 |
| Interactive / under 44x44 | 57 / 39 | 58 / 40 | 62 / 44 | 63 / 45 | 62 / 44 | 63 / 45 |
| Contrast failures (<4.5:1) | 1 | 1 | 1 | 1 | 1 | 1 |
| axe serious/critical | color-contrast x1 | same | same | same | same | same |
| /promos/ links, DOM / visible | 19 / 17 | 19 / 17 | 19 / 18 | 19 / 18 | 19 / 18 | 19 / 18 |
| First ad anchor top (px) | 57 (article, `data-ad-region=content`) | 57 | 57 | 57 | 57 | 57 |
| Fubo link box / top | 101x44 / 472 | 101x44 / 472 | same | same | same | same |
| Fubo link / market-line contrast | 5.06 / 4.52 | 5.06 / 4.52 | same | same | same | same |

**Screenshots** (full page, plus `-fold` at the first viewport): `/private/tmp/claude-501/-Users-mattkovalik-promonight-web/0d155f60-51e9-4635-86ac-1a347175841c/scratchpad/uxr-subid/{390,768,1280}-{branch,production}.png`. **Diff images:** `/private/tmp/claude-501/-Users-mattkovalik-promonight-web/0d155f60-51e9-4635-86ac-1a347175841c/scratchpad/uxr-subid/{390,768,1280}-diff.png`.

## Recommendation

Merge. The only real difference is the one attribute the diff intends. Before the merge, file D1 in known-issues: on game day after the start time, the page still says "Tonight" and sends fans to tickets and streams for a game that is over.

## Author's dispositions

| # | Disposition | Reason |
|---|---|---|
| D1 | **Deferred: known-issues entry 125** | On production before this branch; the branch changes no date logic. |
| D2 | **Waived for this merge** | On production before this branch and unchanged by it; already logged as known-issues 122 (tap targets, with entry 110) and 121 (the "NIGHT" wordmark). |
