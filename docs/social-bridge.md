# The social bridge

**What it is.** The video pipeline (promo-video, hooks v3) prints two short
links on every Short and Reel, and the PromoNight profiles carry bio links.
This site resolves them, carries the visit's UTMs into the app store links
and the click events, and shows a promo's Short on its page. Built
2026-11-05 on `feature/social-bridge`; preview only until the pipeline branch
ships.

## The links

| Link | Printed where | Resolves to | How |
| --- | --- | --- | --- |
| `getpromonight.com/{teamShort}` | the end card: "Full details: getpromonight.com/islanders" | `/{league}/{teamId}` (teams), `/cfb/{schoolId}` (schools) | the middleware (`src/middleware.ts`), 307, query string carried, `X-Robots-Tag: noindex` |
| `getpromonight.com/p/{code}?utm_source={platform}&utm_medium=social&utm_campaign=gameday&utm_content={promoId}` | the META caption's "Details:" line; the TikTok bio link | the promo's page `/{league}/{teamId}/promos/{pageSlug}` | `src/app/p/[code]/route.ts`, 307, query string carried, noindex |
| `getpromonight.com/yt` `/tt` `/ig` `/fb` | the profile bios | `/?utm_source=youtube|tiktok|instagram|facebook&utm_medium=social&utm_campaign=bio` | the middleware, 307, noindex |

None is a page: no sitemap entry, every response noindex, and the hop is
answered before the request counter, so only the destination counts as a
visit. `src/lib/__tests__/social-bridge.test.ts` pins all of it.

**The team map is generated.** `src/config/social-bridge.json` is written by
promo-video from its `config/team-short.json` and the Firestore team docs (a
team's page is its league, lowercased, and its doc id). Never edit it here.
**After editing `config/team-short.json` in promo-video, run
`npm run export-social-bridge -- --to ../promonight-web/src/config/social-bridge.json`
there and commit the result here.** The export carries `sourceSha256`, the
hash of the file it was made from; `src/lib/__tests__/social-bridge-source.test.ts`
recomputes it from the promo-video checkout (`PROMO_VIDEO_DIR`, else
`../code/promo-video`) and fails when the map is stale. The slugs `yt`,
`tt`, `ig`, `fb` and `p` are reserved on both sides, and the bridge test
reads `src/app` so no slug can shadow a real route.

**The promo code.** `code` is the first six characters of the promo's 16-hex
Firestore id; `utm_content` carries the whole id. The route looks the code up
in the upcoming promo index (`getUpcomingPromoIndex`) and redirects to the
page. Two upcoming promos sharing a prefix are settled by the whole id;
without it the route refuses to guess. A code that matches nothing upcoming
(the game is over, the promo was pulled, `PROMO_PAGES_LIVE` is off) lands on
`/promos/today` with its UTMs, never a 404: a caption outlives its game.

## Attribution

- The session's **first-touch UTMs** are kept in `sessionStorage` (`pn_utm`,
  `src/lib/utm-capture.ts`); a later tagged URL in the same session never
  overwrites them. The 90-day first-party cookie (`src/lib/attribution.ts`)
  is unchanged.
- `promo_link_click`, `app_download_click` and `web_app_cta_click` carry
  `utm_source`, `utm_campaign` and `utm_content` from that first touch
  (`utmTriplet`).
- On `/download`, a social visit's store links name the visit: the App Store
  link gets `ct={utm_source}_{utm_campaign}` (the source alone without a
  campaign; lowercased, Apple's alphabet, 30 characters), plus `pt` when
  `APPLE_PROVIDER_TOKEN` is set in the environment (else the public token,
  else no `pt`); the Play link gets
  `referrer=utm_source%3D{src}%26utm_campaign%3D{camp}`. The UTMs reach
  `/download` in its query: a link can bring them, and `DownloadSessionUtm`
  (`src/components/download-session-utm.tsx`) puts the session's first touch
  there when a social visitor arrives without them, so the buttons and the
  QR codes are built on the server from the same values. Without UTMs the
  surface tokens (`pc`, `tc`, `dl`) and the `utm_source=web` referrer stay as
  they were.

## Shorts on promo pages

- The nightly refresh's site batch runs the Shorts sync
  (`src/lib/youtube-shorts-sync.ts`, a loader beside
  `promoPagesDatedYesterday`): the PromoNight channel's last 200 uploads
  through the YouTube Data API's `playlistItems` (one quota unit a page, the
  uploads playlist `UURU8aBU0662tBrGAHg-OE7Q`), the `pn:{promoId}` marker
  parsed from each description, the map `promoId -> {videoId, title,
  publishedAt}` written to `socialVideos/youtube`. The promo pages whose
  Short changed join the batch's paths, so they are revalidated, warmed and
  verified with the rest.
- **`YOUTUBE_API_KEY`** must be set in Vercel (a read-only Data API key).
  Without it the sync logs `skipped` and the map stays as it is. The key is
  never logged. To run the sync once by hand, with the key in the shell's
  environment (never in a file that is committed):
  `npx tsx --env-file=.env.local --require ./scripts/stub-server-only.cjs scripts/sync-youtube-shorts.ts --dry-run`
  reports the match count and writes nothing; without `--dry-run` it writes
  the map. Pages are not revalidated by the hand run.
- A promo page whose id (the primary's or any row's) is in the map renders
  the Short below the hero image as a click-to-load box
  (`src/components/promo-page/PromoShort.tsx`): a fixed 236x420 thumbnail
  with a play badge, swapped for the privacy-enhanced YouTube iframe at the
  same size on the click, so nothing on the page moves. It is one more
  direct child of the article (one more ad anchor); the CTA row and the image
  above it keep their places. The page's JSON-LD gains a `VideoObject`.
- The map is read once per server instance per five minutes
  (`src/lib/youtube-shorts-store.ts`); a read failure is no Short, never a
  failed page.

## Tests

`src/lib/__tests__/social-bridge.test.ts` (the map, the hop, the resolver,
noindex, the sitemap), `social-bridge-source.test.ts` (freshness against
promo-video), `store-utm.test.ts` and `utm-capture.test.ts` (attribution),
`youtube-shorts.test.ts` and `youtube-shorts-sync.test.ts` (the sync against
the fake Firestore), `src/components/promo-page/__tests__/promo-short.test.tsx`
(the embed), `src/app/p/[code]/__tests__/route.test.ts` (the route).
