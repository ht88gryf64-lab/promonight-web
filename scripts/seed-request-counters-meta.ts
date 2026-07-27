/* eslint-disable no-console */
// Writes requestCounters/_meta, the document that tells any future reader how to
// interpret the counter series. One-off, idempotent, never on the hot path.
//
// Usage:
//   tsx --env-file=.env.local --require ./scripts/stub-server-only.cjs \
//     scripts/seed-request-counters-meta.ts            # dry-run (default)
//   tsx --env-file=.env.local --require ./scripts/stub-server-only.cjs \
//     scripts/seed-request-counters-meta.ts --execute  # writes
//
// Re-run after any classifier bump to append a row to classifierVersionHistory.
// The script rewrites the whole doc, so edit the constants below rather than
// hand-editing Firestore.
//
// WHY THIS DOC EXISTS. The number this collection produces will be quoted to an
// ad network. Whoever reads it next will not have the build context, and the
// single most likely mistake is quoting `total` (which includes prefetches and
// soft navigations) as a pageview figure. That mistake is a factor of several,
// so the correction lives next to the data, not only in a commit message.

import { Timestamp } from 'firebase-admin/firestore';
import { db } from '../src/lib/firebase';
import { CLASSIFIER_VERSION } from '../src/lib/analytics/traffic-classifier';

const COLLECTION = 'requestCounters';
const DOC_ID = '_meta';

const CAVEAT =
  'human is a residual bucket that includes headless browsers with deliberately ' +
  'clean user agents and any crawler not in the list, and is therefore an UPPER ' +
  'BOUND on human traffic, never an exact count.';

const HEADLINE_METRIC =
  'human_document counts HARD page loads only and is NOT like-for-like with GA4 ' +
  'page_view. GA4 runs with send_page_view:false, so every GA4 page_view is ' +
  'fired by PageViewTracker on initial load AND on every client-side App Router ' +
  'navigation, and a client navigation is counted here as human_soft_nav rather ' +
  'than human_document. The nearest server-side approximation to GA4 page_view ' +
  'is human_document + human_soft_nav, and even that is a FLOOR: a navigation to ' +
  'an already-prefetched route, and every back or forward navigation, is served ' +
  'from the client router cache and makes no server request at all while still ' +
  'firing a GA4 page_view. Never divide human_document by GA4 page_view and call ' +
  'the result the human fraction. `total` is NOT the Raptive number and must ' +
  'never be quoted as one.';

const QUOTE_AS = 'server-observed, bot-filtered, upper bound';

const DIVERGENCE_NOTE =
  'This classifier INTENTIONALLY differs from the legacy detectBot() in ' +
  'src/middleware.ts, in BOTH directions. It catches Googlebot, every SEO tool, ' +
  'and link unfurlers that detectBot misses entirely. It also classifies ' +
  'GeminiiOS (the Gemini iOS app WebView, which is a real human tapping a link) ' +
  'as human, where detectBot calls it a crawler. Do NOT "fix" this classifier to ' +
  'match the legacy one. The two measure different populations on purpose: ' +
  'ai_crawler_hits is a 10 percent forensic sample of named crawlers with full ' +
  'UA strings, requestCounters is the full-rate tally of everything.';

const READER_WARNING =
  'This _meta document lives in the SAME collection as the hourly buckets. Any ' +
  'reader that ranges over requestCounters MUST exclude document id "_meta", ' +
  'or it will be parsed as an hour bucket and corrupt the aggregate.';

const BUCKET_SHAPE =
  'Hourly buckets are document id YYYY-MM-DD-HH in UTC, derived server-side in ' +
  'POST /api/log-request from that process clock, never from the caller. Fields: ' +
  'date, hour, classifierVersion, updatedAt, expiresAt (400 days), total, and a ' +
  'counts map keyed {traffic_class}_{request_type}. Hourly rather than daily for ' +
  'write-contention headroom: one document per day would put every write on a ' +
  'single Firestore document, whose sustained limit is about 1 write per second.';

const SPECULATION_NOTE =
  'Browser and intermediary speculative preloads (sec-purpose, purpose, x-moz: ' +
  'Chrome and Edge omnibox preloading, Google SERP prefetch, Firefox link ' +
  'prefetch) are EXCLUDED from human_document and human_soft_nav, the two buckets ' +
  'that form the GA4 comparator. With a browser user agent they are counted as ' +
  'human_prefetch instead, so they remain visible rather than dropped. GA4 does ' +
  'not count a pure prefetch either, because the browser fetches the bytes ' +
  'without executing any JavaScript, so the counter and GA4 agree on excluding ' +
  'it from the pageview comparison. ONE CAVEAT: a Chrome PRERENDER ' +
  '(sec-purpose: prefetch;prerender) does execute JavaScript in a hidden ' +
  'document, so it can fire a GA4 page_view while the counter files it as ' +
  'human_prefetch. Treat prerender as a known small source of GA4 running above ' +
  'the counter, not as a counter defect.';

const SAMPLING_NOTE =
  'The counter is FULL RATE with no sampling on any class. The only sampled path ' +
  'is the unknownUserAgents diagnostic collection, at 1 percent of unknown-class ' +
  'requests, which exists so classifier gaps get found rather than guessed at. ' +
  'Human user agents are never sampled or stored.';

const KNOWN_GAPS = [
  'A headless browser with a deliberately overridden clean user agent is ' +
    'indistinguishable from a person by user agent alone and lands in human. ' +
    'This is the hard floor on precision. Closing it needs TLS fingerprinting, ' +
    'behavioral analysis, or an interactive challenge.',
  'Requests to the 410 Gone trap for leaked Fanatics catalog paths are NOT ' +
    'counted, because they are not page requests. total therefore runs slightly ' +
    'below Vercel middleware invocation counts by exactly that volume.',
  'Paths excluded by the middleware matcher are not counted at all: anything ' +
    'under api/, _next/, _static/, the four literal files, and any static asset ' +
    'extension. The counter measures page requests, not all HTTP traffic.',
];

// Append a row per bump. Dates are the date the version began writing data.
const CLASSIFIER_VERSION_HISTORY = [
  {
    version: 'v1',
    date: '2026-07-27',
    note:
      'Initial taxonomy. Never reached production data: superseded by v2 before ' +
      'the counter was wired up, so no v1 documents exist.',
  },
  {
    version: 'v2',
    date: '2026-07-27',
    note:
      'Two changes, both landed before the counter was enabled so v2 is the ' +
      'first version to write any data. (a) Adds the HeadlessChrome token to ' +
      'unknown, catching the default Puppeteer and Playwright user agent, which ' +
      'v1 counted as human. (b) Treats browser and intermediary speculative ' +
      'loads (sec-purpose, purpose, x-moz) as prefetch rather than document, so ' +
      'Chrome omnibox preloading and Google SERP prefetch stop inflating ' +
      'human_document.',
  },
];

async function main() {
  const execute = process.argv.includes('--execute');
  console.log(`[seed-request-counters-meta] mode: ${execute ? 'EXECUTE' : 'DRY-RUN'}`);

  if (CLASSIFIER_VERSION_HISTORY.at(-1)?.version !== CLASSIFIER_VERSION) {
    console.error(
      `[seed-request-counters-meta] ABORT: CLASSIFIER_VERSION is ${CLASSIFIER_VERSION} ` +
        `but the last history row is ${CLASSIFIER_VERSION_HISTORY.at(-1)?.version}. ` +
        'Add a history row for the current version before seeding.',
    );
    process.exit(1);
  }

  const doc = {
    isMetaDocument: true,
    readerWarning: READER_WARNING,
    caveat: CAVEAT,
    headlineMetric: HEADLINE_METRIC,
    quoteAs: QUOTE_AS,
    divergenceFromLegacyDetectBot: DIVERGENCE_NOTE,
    bucketShape: BUCKET_SHAPE,
    speculationNote: SPECULATION_NOTE,
    samplingNote: SAMPLING_NOTE,
    knownGaps: KNOWN_GAPS,
    classifierVersion: CLASSIFIER_VERSION,
    classifierVersionHistory: CLASSIFIER_VERSION_HISTORY,
    updatedAt: Timestamp.fromDate(new Date()),
  };

  console.log(`\ntarget: ${COLLECTION}/${DOC_ID}`);
  console.log(JSON.stringify({ ...doc, updatedAt: '<server timestamp>' }, null, 2));

  if (!execute) {
    console.log('\n[seed-request-counters-meta] dry-run, nothing written. Re-run with --execute.');
    return;
  }

  await db.collection(COLLECTION).doc(DOC_ID).set(doc);
  console.log(`\n[seed-request-counters-meta] wrote ${COLLECTION}/${DOC_ID}`);
}

main().catch((err) => {
  console.error('[seed-request-counters-meta] failed:', err);
  process.exit(1);
});
