# The social bridge

**What it is.** The video pipeline (promo-video, hooks v3) prints two short
links on every Short and Reel. This site resolves them. Built 2026-11-05 on
`feature/social-bridge`; preview only until the pipeline branch ships.

| Link | Printed where | Resolves to | How |
| --- | --- | --- | --- |
| `getpromonight.com/{teamShort}` | the end card: "Full details: getpromonight.com/islanders" | `/{league}/{teamId}` (teams), `/cfb/{schoolId}` (schools) | a `next.config.ts` redirect per slug, 307, query string carried |
| `getpromonight.com/p/{code}?utm_source={platform}&utm_medium=social&utm_campaign=gameday&utm_content={promoId}` | the META caption's "Details:" line; the TikTok bio link | the promo's page `/{league}/{teamId}/promos/{pageSlug}` | `src/app/p/[code]/route.ts`, 307, query string carried |

**The team map is generated.** `src/config/social-bridge.json` is written by
`npm run export-social-bridge -- --to <this file>` in promo-video, from its
`config/team-short.json` and the Firestore team docs (a team's page is its
league, lowercased, and its doc id). Never edit it here; regenerate it when a
team or a slug changes, and commit the result. The unit test pins its shape:
169 team links, 87 school links, slugs of 2 to 14 lowercase letters or digits,
no slug equal to a real top-level route.

**The promo code.** `code` is the first six characters of the promo's 16-hex
Firestore id; `utm_content` carries the whole id. The route looks the code up
in the upcoming promo index (`getUpcomingPromoIndex`: every visible promo
dated today or later with a page slug, already held for the promo pages) and
redirects to the page. Two upcoming promos sharing a prefix are settled by
the whole id; without it the route refuses to guess.

**Fallbacks, never a 404.** A caption outlives its game, so a code that
matches nothing upcoming (the game is over, the promo was pulled, or
`PROMO_PAGES_LIVE` is off and no promo carries a slug) lands on
`/promos/today` with its UTMs. The redirect is `noindex` and `no-store`.

**Attribution.** Nothing new: the UTMs reach the promo page, where the
first-party attribution cookie (`src/lib/attribution.ts`) and PostHog read
them as they read any arrival. `utm_campaign=gameday` is the videos' mark.

**Tests.** `src/lib/__tests__/social-bridge.test.ts` (the map, the
redirects, the resolver) and `src/app/p/[code]/__tests__/route.test.ts` (the
route with the index and the team loader mocked).
