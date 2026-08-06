# Venue inbound linking, slice 1

Branch: `feature/venue-inbound-links` (2026-08-06). Goal is POSITION on the
/venues/* pages (the GSC page 1 cliff at position 10), via internal PageRank.
Not a pages/session play: venue sessions run below site average depth, so no
depth gains are expected or claimed from this slice.

## What shipped in this slice

1. P0: the sitemap's venue read no longer fails closed. `sitemap.ts` used to
   wrap `getIndexableVenueHubSitemapEntries()` in `.catch(() => [])`, which on
   ANY Firestore error (unavailable, deadline, permission, credential parse)
   served a complete-looking sitemap silently missing every venue URL, and the
   IndexNow deploy hook (which walks the same `sitemap()` function via
   `getAllSitemapUrls`) silently skipped them too. The set comes from a single
   collection read, so partial success is impossible; the read now logs
   `[sitemap] venueHubs read failed` and rethrows, so a failure is a failed
   render (build failure at deploy time, stale-but-complete sitemap at runtime)
   instead of a silent 150-URL hole.
   Sibling instance NOT changed in this slice: the CFB school-id read at
   `sitemap.ts` (`getAllCfbSchoolIds().catch(() => [])`) has the same silent
   drop shape for the 86 CFB team pages.
2. League hubs link their venues: /mlb, /wnba, /mls (HubVenueLinks section
   between the team grid and the second in-content ad slot) and /cfb (dark
   variant, STADIUM GUIDES section after browse). Only indexable buildings
   render; deduped per building; anchors are server-rendered.
3. /venues index page (was a 404): every indexable building, grouped BY LEAGUE
   (matches the site's league-first information architecture and the hub links
   in item 2; multi-league buildings appear once per hosting league section).
   Linked sitewide from both footers ("Stadium guides"), so every indexable
   venue page is now two clicks from any page on the site.
4. Sitemap: venue URLs bumped 0.7 -> 0.8, /venues index added at 0.8.

New pure logic lives in `src/lib/venue-index.ts` (unit-tested without module
mocks); the cached Firestore readers live in `src/lib/venue-hub.ts`
(`getVenueLinksForTeams`, `getVenueIndexEntries`).

## RISK REGISTER: the redesign flag carries the entire venue inbound structure

`NEXT_PUBLIC_REDESIGN_V2` (gate: `lib/redesign.ts`) is a single point of
failure for venue inbound links. When the flag is ON (prod today), the
redesign chrome and team template render every inbound path. When it is OFF:

- Team pages fall back to the legacy dark template, which contains NO
  VenueHubLink at all (the AffiliateRail that hosts it is redesign-only).
- The layout swaps to the legacy footer. The legacy footer now also carries
  the Stadium guides link (added in this slice), so the /venues path survives
  a flag flip, but the per-team inbound links (the strongest, most relevant
  anchors) all disappear at once.

One flag flip therefore removes the team-page layer of venue inbound linking
sitewide in a single deploy, silently, with no error. Any rollback of the
redesign flag must be treated as an SEO event for the venue cluster, not just
a UI rollback.

## Deferred by design (do not resurrect without the trigger condition)

- Other-venues-in-city block: slice 2. Links weak nodes to weak nodes;
  circulates authority rather than injecting it.
- Away-row venue anchors in ScheduleRow: WAITS on the team_tile_tap from_tab
  split showing schedule_away_row drives taps. The anchors would have to live
  in the always-SSR row (the GameExpand lazy mount is load-bearing), which is
  real layout work; do not start it without the data.
