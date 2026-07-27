# Server-truth request counter: standing notes

Working notes for the counter built on `feature/request-counter`. Phase 3
(validation) should read this before designing its checks.

## What the counter is for

Establish a third traffic number, server-observed human page requests, to
determine what fraction of GA4's `page_view` is human. GA4 recorded 5,291
`page_view` over 2026-07-20 to 2026-07-26; PostHog recorded 3,122 over the same
window. Neither is truth. The counter produces the third number.

### Which bucket compares to GA4, and why it is not `human_document` alone

This corrects the framing this build was specified under. `human_document`
counts HARD page loads only, and GA4 `page_view` does not.

GA4 runs with `send_page_view: false`
(`src/components/analytics/AnalyticsProvider.tsx:83`), so every GA4 `page_view`
is fired by `PageViewTracker`, which is mounted in the root layout and fires on
initial load AND on every App Router client navigation
(`src/components/analytics/PageViewTracker.tsx:16-55`). A client navigation
reaches the counter carrying `rsc: 1` and is filed as `human_soft_nav`, never as
`human_document`.

So the nearest server-side approximation to GA4 `page_view` is
**`human_document + human_soft_nav`**, and even that is a **floor**, because two
populations fire a GA4 `page_view` with no server request at all:

- a navigation to a route already in the client router cache (Next's
  `staleTimes.static` default is 300s), and
- every back and forward navigation, which changes `pathname` and so fires the
  tracker.

Practical consequence for Phase 3: dividing `human_document` by GA4 `page_view`
produces a number well under 1.0 for a purely structural reason and would be
misread as evidence of large-scale bot inflation in GA4. Report
`human_document` as "hard page loads", report
`human_document + human_soft_nav` as the GA4 comparator and label it a floor.

`total` is NOT the Raptive number and must never be quoted as one.

## Phase 3: the 10x reconciliation check no longer holds

An earlier plan said Phase 3 should reconcile `requestCounters` crawler classes
against roughly 10x the `ai_crawler_hits` document count, since the crawler
logger samples at 10 percent. **That comparison cannot hold as a clean multiple
and Phase 3 must not treat a deviation from 10x as a failure.**

The two classifiers deliberately measure different populations, and they diverge
in BOTH directions:

Counter counts MORE than 10x ai_crawler_hits, because the new classifier catches
traffic the legacy `detectBot()` misses entirely:

- Googlebot and every `Googlebot-*` variant. The legacy list matches only
  `Googlebot-(News|Image|Video)?.*Gemini`, `GoogleOther`, and `Gemini`, so plain
  Googlebot matched nothing. Zero Googlebot hits exist in `ai_crawler_hits`
  across 18,198 documents despite roughly 35,500 monthly Google impressions.
  This is expected to be the single largest term.
- All ten SEO tools (AhrefsBot, SemrushBot, DotBot, MJ12bot, BLEXBot,
  DataForSeoBot, Screaming Frog, SerpstatBot, ZoominfoBot, Barkrowler).
- Link unfurlers (facebookexternalhit, Twitterbot, Slackbot, LinkedInBot,
  WhatsApp, TelegramBot).
- Generic self-identifying bots and scripted HTTP clients, which land in
  `unknown` rather than a crawler class.
- Yahoo Slurp, DuckDuckBot, YandexBot, Baiduspider, Sogou, PetalBot, Bytespider,
  Amazonbot, meta-externalagent, Applebot, and the remaining named AI crawlers.

Counter counts LESS than 10x ai_crawler_hits for one population:

- `GeminiiOS`, the Gemini iOS app WebView. The legacy list matches it on a bare
  `/Gemini/i` and labels it a crawler. It is a real person tapping a link inside
  an app, so the new classifier calls it `human`. 7 hits in the observed sample.

One further reason a clean multiple is unavailable:

- The 10 percent sample is `Math.random() < 0.1` per request, so the implied
  count carries sampling error. At the observed volume (116 sampled documents in
  24 hours) the 95 percent interval on the implied total is roughly plus or minus
  18 percent.

The 410 trap is NOT a reason, despite being an easy one to assume. It returns at
`src/middleware.ts:112`, ahead of both `countRequest()` at line 133 and the
`/api/log-crawler-hit` fetch at line 163, so a 410-path request reaches neither
collection and its volume cancels out of this comparison entirely. It is only a
subtraction against Vercel middleware invocation counts, below.

**Recommended Phase 3 framing.** State a direction, not a ratio. Assert that
`ai_crawler + search_crawler + seo_tool` in the counter EXCEEDS
`10 x ai_crawler_hits` for the same window, and that the excess is dominated by
`search_crawler` (Googlebot). A counter total at or below 10x would mean the new
classifier is failing to catch what the legacy one catches, which is the actual
failure worth testing for. Do not assert a two-sided tolerance around 10x.

## Reconciling `total` against Vercel

`total` should track Vercel's edge-middleware invocation count for the same
window (7,776 in a measured 24 hour baseline, and 7,867 in a second read), with
two known subtractions:

- **410 trap.** Requests matching `FANATICS_LEAK_PATH` return before the counter
  runs, deliberately, because a leaked catalog path is not a page request. This
  was 1 request in 24 hours, negligible but non-zero.
- **Counter-disabled window.** Any period where `REQUEST_LOG_SECRET` is unset in
  the environment produces zero counter writes while middleware still runs. The
  counter skips silently in that case by design, so an unexplained shortfall
  should check the env var first.

There is no additive term: `/api/log-request` is excluded by the middleware
matcher (verified against the compiled regex in
`.next/server/middleware-manifest.json`), so the counter cannot count itself.

## The human diurnal curve is the real acceptance test

If `human_document` does not show a clear US-hours day/night cycle while the
crawler classes stay comparatively flat, the human bucket is still full of bots
and the number is not usable no matter how clean the code is. This gates the
NUMBER, not the deploy.

## Standing items, out of scope for this build

- **`ai_crawler_hits` TTL is not enforced.** The route writes an `expiresAt`
  field but no Firestore TTL policy is active on the collection. Proven by an
  18,198-document collection whose oldest document is dated 2026-04-20, which is
  98 days old against a stated 90 day retention. `src/lib/rate-limit.ts` carries
  the same write-a-field-and-hope pattern with a comment calling the policy
  "optional". Deliberately not fixed here.
- **`requestCounters` and `unknownUserAgents` TTL.** Both write `expiresAt` (400
  and 90 days). Neither policy is enabled either, for the same reason. Enabling
  all three is one console task and should be verified as actually deleting
  rather than assumed from the field's presence.
- **Latent bug in `/api/log-crawler-hit`.** Its unconfigured branch returns
  `NextResponse.json(body, { status: 204 })`. A 204 carrying a body throws in the
  Response constructor ("Invalid response status code 204"), verified locally, so
  that branch would 500 if `CRAWLER_LOG_SECRET` were ever unset. It never has
  been, so the bug is dormant. `/api/log-request` deliberately does NOT copy it
  and returns a null body, which matters because its own unconfigured branch is
  hit on every request until the env var is set.
