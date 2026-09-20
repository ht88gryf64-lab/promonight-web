/**
 * Runs once per document load, in the main client chunk, BEFORE Next calls
 * hydrate() (next/dist/client/app-next.js requires this file above
 * appBootstrap). It is not a component and renders nothing, so it is not in the
 * served HTML and React has nothing of it to hydrate or to mismatch on.
 *
 * ONE JOB: count React hydration error #418 in the field. See known-issues
 * entry 50 and src/lib/hydration-mismatch.ts. This is one targeted event, not
 * error tracking. PostHog exception autocapture stays off.
 *
 * IT ONLY LISTENS. It never calls preventDefault(), never stops propagation and
 * never rethrows, so React's recovery and every other error listener run
 * exactly as they would without it. Next reports a recoverable hydration error
 * through reportError(), which dispatches an ordinary window 'error' event.
 */
import {
  AD_NODE_SELECTOR,
  buildHydrationMismatchSnapshot,
  isHydrationMismatchMessage,
  type HydrationMismatchSnapshot,
} from '@/lib/hydration-mismatch';

/** Give PostHog's lazy import time to land, then emit to whatever exists. */
const SINK_WAIT_MS = 15_000;
const SINK_POLL_MS = 250;
/** Hydration is long over by then; stop watching the DOM. */
const OBSERVE_MAX_MS = 20_000;

type SinkWindow = Window & {
  posthog?: { capture?: unknown };
  gtag?: unknown;
};

function adNodeInDom(): boolean {
  try {
    return document.querySelector(AD_NODE_SELECTOR) !== null;
  } catch {
    return false;
  }
}

function isOrHoldsAdNode(node: Node): boolean {
  if (node.nodeType !== 1) return false;
  const el = node as Element;
  try {
    return el.matches(AD_NODE_SELECTOR) || el.querySelector(AD_NODE_SELECTOR) !== null;
  } catch {
    return false;
  }
}

function start(): void {
  /**
   * "Did an ad node exist at that moment" cannot be answered AT that moment.
   * React reports #418 after it has already thrown the server DOM away, and
   * the ad containers go with it, so a DOM read inside the error handler says
   * "no ads" in exactly the case this event exists to count. The honest form
   * of the question is whether one existed at any point UP TO the error, which
   * means noticing the insertion when it happens.
   */
  let adNodeSeen = adNodeInDom();
  let observer: MutationObserver | null = null;
  let handled = false;

  const stopObserving = () => {
    observer?.disconnect();
    observer = null;
  };

  if (!adNodeSeen && typeof MutationObserver !== 'undefined') {
    observer = new MutationObserver((records) => {
      for (const r of records) {
        for (const n of Array.from(r.addedNodes)) {
          if (isOrHoldsAdNode(n)) {
            adNodeSeen = true;
            // Nothing more to learn. On an ordinary pageview this is the
            // observer's whole life: a few hundred ms, until Raptive's first
            // insertion.
            stopObserving();
            return;
          }
        }
      }
    });
    observer.observe(document.documentElement, { childList: true, subtree: true });
    window.setTimeout(stopObserving, OBSERVE_MAX_MS);
  }

  const emit = (snapshot: HydrationMismatchSnapshot) => {
    // Loaded only on the error path, so an ordinary pageview never pays for
    // analytics.ts in the main chunk.
    import('@/lib/analytics')
      .then(({ track }) => track('hydration_mismatch', snapshot))
      .catch(() => {
        // Never let the instrument become an incident.
      });
  };

  const emitWhenSinksExist = (snapshot: HydrationMismatchSnapshot) => {
    const w = window as SinkWindow;
    const wantPosthog = Boolean(process.env.NEXT_PUBLIC_POSTHOG_KEY);
    const wantGa4 = Boolean(process.env.NEXT_PUBLIC_GA4_MEASUREMENT_ID);
    const startedAt = performance.now();
    let sent = false;

    const send = () => {
      if (sent) return;
      sent = true;
      window.clearInterval(timer);
      window.removeEventListener('pagehide', send);
      emit(snapshot);
    };

    // AnalyticsProvider creates both sinks from effects, which run after the
    // very commit that reported this error. track() drops a sink that is not
    // there yet, so wait for them, bounded.
    const ready = () =>
      (!wantPosthog || typeof w.posthog?.capture === 'function') &&
      (!wantGa4 || typeof w.gtag === 'function');

    const timer = window.setInterval(() => {
      if (ready() || performance.now() - startedAt > SINK_WAIT_MS) send();
    }, SINK_POLL_MS);

    // A visitor who leaves first still counts, through whichever sink is up.
    window.addEventListener('pagehide', send);
    if (ready()) send();
  };

  window.addEventListener('error', (event: ErrorEvent) => {
    if (handled) return;
    const message =
      event.message || (event.error instanceof Error ? event.error.message : '');
    if (!isHydrationMismatchMessage(message)) return;

    // First one per document. The denominator is pageviews, and one rebuild
    // can report several boundaries.
    handled = true;
    const seen = adNodeSeen || adNodeInDom();
    stopObserving();

    emitWhenSinksExist(
      buildHydrationMismatchSnapshot({
        pathname: window.location.pathname,
        innerWidth: window.innerWidth,
        adNodeSeen: seen,
        nowMs: performance.now(),
      }),
    );
  });
}

try {
  if (typeof window !== 'undefined' && typeof document !== 'undefined') start();
} catch {
  // Same rule as above.
}
