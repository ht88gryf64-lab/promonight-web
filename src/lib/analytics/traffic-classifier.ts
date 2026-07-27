// Server-truth traffic classification. Pure functions, no I/O.
//
// Used by the request counter (middleware -> /api/log-request -> Firestore
// requestCounters) to split every server-observed page request into a traffic
// class and a request type. Deliberately free of firebase and next/server
// imports so it runs unchanged on the edge runtime and in node, and so it is
// unit-testable without mocks.
//
// ── READ THIS BEFORE QUOTING ANY NUMBER THIS MODULE PRODUCES ──────────────
//
// 1. `human` is a RESIDUAL bucket, never a positive match. A request is called
//    human only because it matched none of the crawler patterns. That makes
//    the human count an UPPER BOUND on human traffic, never an exact count.
//    Report it as "server-observed, bot-filtered, upper bound".
//
// 2. Automation splits into two cases and only one is catchable.
//    CATCHABLE: headless Chrome left at its DEFAULT user agent advertises the
//    `HeadlessChrome` token, which is what Puppeteer and Playwright chromium
//    send unless the operator overrides it. v2 files those as `unknown`.
//    UNCATCHABLE: a deliberately overridden clean user agent is byte-identical
//    to real Chrome, so it lands permanently in `human`. That is the hard floor
//    on precision here and no pattern list can raise it. Closing it needs a
//    different signal entirely (TLS fingerprint, behavioral, or a challenge).
//
// 3. `human_document` counts HARD page loads only, and is NOT like-for-like
//    with GA4 page_view. GA4 runs with send_page_view:false (see
//    AnalyticsProvider), so every GA4 page_view is fired by PageViewTracker,
//    which fires on initial load AND on every App Router client navigation.
//    A client navigation reaches this classifier as `soft_nav`, not `document`.
//    The nearest server-side approximation to GA4 page_view is therefore
//    `human_document + human_soft_nav`, and even that is a FLOOR: a navigation
//    to an already-prefetched route, and every back/forward navigation, is
//    served from the client router cache and makes NO server request at all
//    while still firing a GA4 page_view. Never divide `human_document` by GA4
//    page_view and call the result the human fraction.
//    `total` is NOT the Raptive number and must never be quoted as one.
//    `total` counts every server request including prefetches, which is
//    expected to run several times GA4 page_view. Comparing `total` to GA4 or
//    to a network's pageview threshold is wrong.
//
// 4. Misclassifying a human INTO a crawler class is the safe direction of
//    error: it tightens the upper bound. Misclassifying a crawler INTO
//    `human` is the unsafe direction. When a pattern is ambiguous, prefer
//    the crawler class.
//
// 5. Bump CLASSIFIER_VERSION on ANY change to the patterns below, and record
//    the change timestamp in requestCounters/_meta. Counts carrying different
//    classifier versions are not comparable.

// Bump on any pattern change. Stamped onto every counter document so a
// version straddling a change is visible rather than silently mixed. Record
// each bump with its date in requestCounters/_meta.
//   v1  initial taxonomy, never reached production data
//   v2  adds the HeadlessChrome token to `unknown`, and treats browser and
//       intermediary speculative loads (sec-purpose / purpose / x-moz) as
//       `prefetch` rather than `document`
// Both v1 and v2 predate the counter being enabled, so no v1 data exists and v2
// is the first version to write anything.
export const CLASSIFIER_VERSION = 'v2';

// The arrays are the single source of truth and the unions derive from them, so
// the runtime validators used by POST /api/log-request can never drift out of
// sync with the compile-time types. Adding a class here is the only edit needed.
export const TRAFFIC_CLASSES = [
  'ai_crawler',
  'search_crawler',
  'seo_tool',
  'unknown',
  'human',
] as const;

export const REQUEST_TYPES = ['prefetch', 'soft_nav', 'document'] as const;

export type TrafficClass = (typeof TRAFFIC_CLASSES)[number];

export type RequestType = (typeof REQUEST_TYPES)[number];

/** Runtime guard for an untrusted value arriving over HTTP. */
export function isTrafficClass(value: unknown): value is TrafficClass {
  return (
    typeof value === 'string' && (TRAFFIC_CLASSES as readonly string[]).includes(value)
  );
}

/** Runtime guard for an untrusted value arriving over HTTP. */
export function isRequestType(value: unknown): value is RequestType {
  return typeof value === 'string' && (REQUEST_TYPES as readonly string[]).includes(value);
}

// ── Patterns ──────────────────────────────────────────────────────────────
//
// One precompiled regex per class, defined at module scope. Humans are the
// common case and must not pay for thirty separate tests, so the hot path is
// exactly four regex tests (AI, search, SEO, generic) before falling through
// to `human`.
//
// NO `g` FLAG on any of these. A global regex reused with .test() carries
// lastIndex between calls and starts returning alternating false negatives.
// Case-insensitive only.

// AI and LLM crawlers, including retrieval-on-behalf-of-a-user fetchers.
// `Applebot` lives here and MUST be tested before the generic pattern below,
// which the class ordering in classifyTraffic guarantees. Note that
// `Applebot` does not match `AppleWebKit`, so ordinary Safari is unaffected.
const AI_CRAWLER =
  /GPTBot|ChatGPT-User|OAI-SearchBot|ClaudeBot|Claude-User|Claude-SearchBot|PerplexityBot|Perplexity-User|Bytespider|Amazonbot|meta-externalagent|Applebot|GoogleOther|Google-CloudVertexBot|cohere-ai|Diffbot|Timpibot|Omgilibot|YouBot/i;

// Traditional search-index crawlers. `Googlebot` covers the bare form and
// every `Googlebot-*` variant (Image, News, Video) in one test. Googlebot was
// missing entirely from the legacy 8-entry list in middleware.ts, which is the
// single largest correctness gap this classifier closes.
const SEARCH_CRAWLER =
  /Googlebot|bingbot|Slurp|DuckDuckBot|YandexBot|Baiduspider|Sogou|PetalBot/i;

// SEO and backlink-audit tools. Entirely absent from the legacy list, so this
// traffic has been counted as human until now. `Screaming Frog SEO Spider`
// also contains "Spider", so it must be tested before the generic pattern;
// the class ordering guarantees that.
const SEO_TOOL =
  /AhrefsBot|SemrushBot|DotBot|MJ12bot|BLEXBot|DataForSeoBot|Screaming Frog|SerpstatBot|ZoominfoBot|Barkrowler/i;

// Catch-all for non-human agents that are not worth naming individually:
// generic self-identifying bots, scripted HTTP clients, link unfurlers, and
// default-UA headless browsers. Unfurlers (Twitterbot, Slackbot, LinkedInBot,
// TelegramBot) already match the bare `bot` alternative; they are listed
// explicitly so the intent is legible at the callsite rather than implied.
//
// `HeadlessChrome` belongs here rather than in a crawler class on purpose: the
// token says the client is AUTOMATED but says nothing about who is driving it
// or why, and `unknown` is exactly the bucket for "not a human, not attributable
// to a named agent". Zero false-positive risk was verified against every
// mainstream browser UA: no real browser carries the token.
//
// A rare false positive here is acceptable. `bot` as a substring can in
// principle appear inside an unrelated product name, which would move a human
// into `unknown`. That is the safe direction of error per note 4 above: it
// tightens the human upper bound rather than inflating it.
const GENERIC_NON_HUMAN =
  /bot|crawler|spider|scraper|http-client|curl|wget|python-requests|axios|Go-http-client|facebookexternalhit|Twitterbot|Slackbot|LinkedInBot|WhatsApp|TelegramBot|HeadlessChrome/i;

// ── Classification ────────────────────────────────────────────────────────

/**
 * Classify a request by user agent. First match wins, in the order
 * ai_crawler, search_crawler, seo_tool, unknown, then human as the residual.
 *
 * A null, empty, or whitespace-only user agent is `unknown`, not `human`:
 * every real browser sends one, so its absence is itself a signal.
 */
export function classifyTraffic(userAgent: string | null): TrafficClass {
  if (!userAgent) return 'unknown';
  const ua = userAgent.trim();
  if (ua.length === 0) return 'unknown';

  if (AI_CRAWLER.test(ua)) return 'ai_crawler';
  if (SEARCH_CRAWLER.test(ua)) return 'search_crawler';
  if (SEO_TOOL.test(ua)) return 'seo_tool';
  if (GENERIC_NON_HUMAN.test(ua)) return 'unknown';

  // Residual. See note 1 in the header: this is an upper bound.
  return 'human';
}

/**
 * Minimal structural interface for reading request headers. Deliberately not
 * NextRequest or Headers, so this stays runtime-agnostic and testable with a
 * plain object. A real `Headers` satisfies it, and its `get` is
 * case-insensitive per the Fetch standard.
 */
export interface HeaderGetter {
  get(name: string): string | null | undefined;
}

// Speculative-load headers sent by the BROWSER or an intermediary, not by Next.
// Chrome and Edge omnibox preloading (on by default), Google's SERP private
// prefetch proxy, and Firefox link prefetch all fetch a page nobody is looking
// at yet. Those arrive as ordinary full document requests carrying a real
// browser user agent and NEITHER of Next's router headers, so without this check
// they land in `human_document`, the very bucket the headline number is read
// from. `sec-purpose` is the current standard, `purpose` the legacy Chrome
// spelling, `x-moz` the Firefox one.
const SPECULATION_HEADERS = ['sec-purpose', 'purpose', 'x-moz'] as const;

// Substring match, not equality: the value is a token list, e.g.
// "prefetch;prerender" or "prefetch;anonymous-client-ip". An exact comparison
// (correct for Next's own '1' headers) would silently miss every real case.
const SPECULATION_VALUE = /prefetch|prerender/i;

/**
 * Split a request into document, soft navigation, or prefetch.
 *
 * Order matters twice over:
 *
 * 1. Browser and intermediary speculation is checked FIRST, because such a
 *    request is otherwise indistinguishable from a person opening the page.
 * 2. Next's own prefetch is checked before rsc, because the App Router sends
 *    both `rsc: 1` and `next-router-prefetch: 1` on a prefetch, so testing rsc
 *    first would misfile every prefetch as a soft navigation.
 *
 * Load-bearing fragility: `next-router-prefetch` is only sent for
 * PrefetchKind.AUTO, which is what a Link with the DEFAULT prefetch prop
 * resolves to. A Link that sets its prefetch prop to true resolves to
 * PrefetchKind.FULL instead, which does NOT send the header, and those
 * prefetches then arrive indistinguishable from real soft navigations. A CI
 * tripwire test guards this; see the no-link-prefetch-prop test.
 */
export function classifyRequestType(headers: HeaderGetter): RequestType {
  for (const name of SPECULATION_HEADERS) {
    const value = headers.get(name);
    if (value && SPECULATION_VALUE.test(value)) return 'prefetch';
  }
  if (headers.get('next-router-prefetch') === '1') return 'prefetch';
  if (headers.get('rsc') === '1') return 'soft_nav';
  return 'document';
}
