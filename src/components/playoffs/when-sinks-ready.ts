// Send an event once both analytics sinks can take it.
//
// WHY. track() sends to whatever sink exists at the moment it is called and
// says nothing about the one that does not. Both sinks load after the page
// is interactive: GA4 from a script tag, PostHog from a dynamic import that
// puts itself on window when it has initialized. An event sent as the page
// mounts can run before PostHog is there. Measured on a cold load of
// /playoffs/mlb, the send ran about 20 ms before PostHog arrived, so the
// event reached GA4 and not PostHog, every time.
//
// This matters only for events the PAGE sends: the view of the page, and a
// series opened by the link the reader arrived on. An event the reader
// causes by pressing something comes long after both sinks are up, and is
// sent straight away.
//
// The wait is bounded. A sink that is not configured never arrives, and the
// event is then sent to whichever sink there is. A reader who leaves during
// the wait is still counted: leaving sends at once.

export const SINK_WAIT_MS = 4000;
export const SINK_POLL_MS = 50;

export interface SinkEnv {
  /** True when both sinks can take an event. */
  ready: () => boolean;
  /** Milliseconds, from any fixed origin. */
  now: () => number;
  /** Calls `fn` every `ms`. Returns a function that stops it. */
  every: (ms: number, fn: () => void) => () => void;
  /** Calls `fn` when the page is being left or put in the background.
   *  Returns a function that stops listening. */
  onLeave: (fn: () => void) => () => void;
}

type SinkWindow = {
  posthog?: { capture?: unknown };
  gtag?: unknown;
};

export function browserSinkEnv(): SinkEnv {
  const w = window as unknown as SinkWindow;
  return {
    ready: () => typeof w.posthog?.capture === 'function' && typeof w.gtag === 'function',
    now: () => Date.now(),
    every: (ms, fn) => {
      const h = window.setInterval(fn, ms);
      return () => window.clearInterval(h);
    },
    onLeave: (fn) => {
      const hidden = () => {
        if (document.visibilityState === 'hidden') fn();
      };
      window.addEventListener('pagehide', fn);
      document.addEventListener('visibilitychange', hidden);
      return () => {
        window.removeEventListener('pagehide', fn);
        document.removeEventListener('visibilitychange', hidden);
      };
    },
  };
}

/**
 * Runs `emit` exactly once: now if both sinks are ready, otherwise when they
 * become ready, when the wait runs out, or when the reader leaves, whichever
 * is first. Returns a cancel function, which stops a send that has not
 * happened and does nothing to one that has.
 */
export function whenSinksReady(emit: () => void, env: SinkEnv = browserSinkEnv()): () => void {
  let done = false;
  const stops: (() => void)[] = [];
  const finish = (send: boolean) => {
    if (done) return;
    done = true;
    for (const stop of stops) stop();
    if (send) emit();
  };
  if (env.ready()) {
    finish(true);
    return () => {};
  }
  const started = env.now();
  stops.push(
    env.every(SINK_POLL_MS, () => {
      if (env.ready() || env.now() - started >= SINK_WAIT_MS) finish(true);
    }),
  );
  stops.push(env.onLeave(() => finish(true)));
  return () => finish(false);
}
