// The page_view deferral scheduler. Extracted from PageViewTracker so the
// four-trigger lifecycle is unit-testable without React or next/navigation.
//
// WHY A DEADLINE EXISTS. The original scheduler was a bare
// requestIdleCallback: on a busy main thread an idle callback can wait
// indefinitely, and a visitor who bounces before it runs generates $pageleave
// with no page_view. That is structurally impossible in honest data and it was
// showing up daily ($pageleave exceeded page_view on 4 of the 5 days before
// this change). The 500ms ceiling keeps the original purpose of the deferral
// (let Next.js commit <title> before we read it) while bounding the loss
// window to half a second.
//
// WHY THE DEADLINE MUST SHIP WITH THE FLUSH, NOT SEPARATELY. The teardown
// flush below fires a still-pending page_view through track(), and track()
// notifies subscribeToAnalytics subscribers, and the capture trigger's
// subscriber runs its evaluate() on every event it receives. A flush with no
// deadline could therefore deliver a first-ever evaluate() at the hidden
// transition for a visitor whose thresholds were crossed since the last 5s
// tick: an invisible capture_prompt_shown at the moment of leaving, which
// inflates the shown rate and burns the once-per-session prompt. With the
// 500ms deadline the pending window closes long before the trigger's 30s/45s
// engagement floors, so by any instant at which the trigger could promote a
// prompt this page_view has long since fired and the flush is a no-op.
//
// THAT SAFETY PROPERTY IS CONTINGENT ON TWO CURRENT FACTS, not enforced by
// any code: (1) every page_view refire today coincides with a pathname
// change, which remounts the capture trigger's timer and counter, so a
// pending page_view always means a fresh page whose engagement floors are
// nowhere near crossed; and (2) no live tracked surface performs a
// searchParams-only navigation (the scoring filter chips do, and scoring
// routes are excluded from this tracker). A future surface that refires
// page_view mid-engagement on the SAME pathname would reopen the teardown
// evaluate() window; enforcing hidden-state suppression belongs inside the
// capture trigger, which this module must not touch.
export const PAGE_VIEW_DEADLINE_MS = 500;

// Kept at the original value: this path only runs where requestIdleCallback
// is absent (Safari), where the 50ms pause was already accepted title-settle
// behavior.
export const FALLBACK_DELAY_MS = 50;

type IdleCapableWindow = {
  requestIdleCallback?: (
    cb: () => void,
    opts?: { timeout: number },
  ) => number;
  cancelIdleCallback?: (handle: number) => void;
};

/**
 * Schedules `emit` to run exactly once, whichever of these comes first:
 *
 *   1. the browser goes idle (requestIdleCallback),
 *   2. the 500ms deadline expires (the {timeout} option),
 *   3. the page is being torn down (pagehide),
 *   4. the tab is backgrounded (visibilitychange to hidden), which on mobile
 *      is frequently the only teardown signal that ever fires.
 *
 * Returns a cancel function. Cancelling both releases the timers/listeners
 * and hard-latches the schedule closed, so a stale idle callback that an
 * absent cancelIdleCallback could not revoke still cannot emit. The caller
 * cancels on SPA navigation ON PURPOSE: by cleanup time the router has
 * already moved location and title to the NEW route, so firing the pending
 * OLD-route closure would emit a row whose surface disagrees with its
 * page_path and page_title. A view abandoned inside the 500ms deadline is
 * deliberately dropped instead of mislabeled.
 */
export function scheduleDeferredPageView(emit: () => void): () => void {
  // Sent-latch shared by all four triggers. The dedupe ref in the tracker
  // guards effect re-entry per route key; this guards emit re-entry per
  // schedule. Both are needed: without this latch, hidden-then-reshown fires
  // the flush AND the still-queued idle callback.
  let done = false;
  const fire = () => {
    if (done) return;
    done = true;
    emit();
  };

  const w = window as unknown as IdleCapableWindow;
  let idleHandle: number | null = null;
  let timerHandle: number | null = null;
  if (typeof w.requestIdleCallback === 'function') {
    idleHandle = w.requestIdleCallback(fire, { timeout: PAGE_VIEW_DEADLINE_MS });
  } else {
    timerHandle = window.setTimeout(fire, FALLBACK_DELAY_MS);
  }

  const flushIfHidden = () => {
    if (document.visibilityState === 'hidden') fire();
  };
  window.addEventListener('pagehide', fire);
  document.addEventListener('visibilitychange', flushIfHidden);

  return () => {
    // Latch first: if cancelIdleCallback is unavailable the queued callback
    // will still run someday, and it must find the schedule already closed.
    done = true;
    if (idleHandle !== null) w.cancelIdleCallback?.(idleHandle);
    if (timerHandle !== null) window.clearTimeout(timerHandle);
    window.removeEventListener('pagehide', fire);
    document.removeEventListener('visibilitychange', flushIfHidden);
  };
}
