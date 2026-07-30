'use client';

import { useEffect, useRef } from 'react';
import { usePathname } from 'next/navigation';
import {
  subscribeToAnalytics,
  track,
  type CapturePageType,
} from '@/lib/analytics';
import { ENGAGED_FLOOR_MS, EngagedTimer } from '@/lib/capture/engaged-timer';
import { GestureCounter } from '@/lib/capture/gesture-counter';
import { isCaptureTriggerEnabledClient } from '@/lib/capture/gate';
import { browserStorage } from '@/lib/capture/storage';
import {
  evaluateSuppression,
  markShown,
  recordPageview,
  type SuppressionReason,
} from '@/lib/capture/suppression';
import { resolveVariant } from '@/lib/capture/variant';

// The trigger engine. RENDERS NOTHING, in this phase and in the control arm of
// every later one. Its entire job is to decide when a prompt WOULD fire and to
// say so in telemetry, so the thresholds are validated against live traffic
// before any sheet is built.
//
// Mounted per page rather than in the root layout, because it needs the page's
// team and page type, and because in the App Router a route change unmounts and
// remounts it, which is exactly the pageview boundary the session rules need.

interface CaptureTriggerProps {
  pageType: CapturePageType;
  /** Null on aggregators, which have no page-level team. */
  teamId: string | null;
}

// Re-checked on a timer as well as on every event, because the engaged-time
// floor can be the last condition to be met: a visitor can cross a threshold at
// 20 seconds and then simply keep reading. Without a tick, that visitor would
// never fire until they happened to tap again.
const TICK_MS = 5_000;

// NO BOT FILTERING, DELIBERATELY DEFERRED. The repo has a classifyTraffic
// classifier, but it lives in middleware.ts and api/log-request and is not
// reachable from client code, so using it here would mean new plumbing.
//
// More importantly, filtering now would be guessing at a problem this phase
// exists to reveal. The engine already demands 45 seconds of VISIBLE engaged
// time plus several discrete gesture bursts, which excludes essentially every
// crawler; what it does not exclude is a scripted browser that clicks four game
// cells over 45 seconds. If that traffic is material it will show up as an
// implausibly high shown rate in the Phase 2 read, and an implausible rate is
// itself the signal to act on. Read the numbers first, then filter if they
// demand it. The absence of filtering here is a decision, not an oversight.

export function CaptureTrigger({ pageType, teamId }: CaptureTriggerProps) {
  const pathname = usePathname();

  // Everything the engine needs lives in refs, not state: this component never
  // re-renders, and nothing it does should ever cause a render.
  //
  // All three are keyed by PATHNAME rather than being plain booleans, and that
  // is load-bearing rather than tidiness. The App Router reuses this component
  // instance when navigating between two pages of the SAME route segment, say
  // one team page to another, so a boolean set on the first page would still be
  // set on the second. Every second and subsequent team page in a session would
  // then have gone unreported, and the fire rate would have read low for a
  // reason that had nothing to do with the thresholds, which is precisely the
  // number this phase exists to measure. Keying on the path resets them per
  // page while still surviving the effect re-running for the SAME path, which
  // is what StrictMode does in development.
  const countedPathRef = useRef<string | null>(null);
  const firedPathRef = useRef<string | null>(null);
  const suppressedPathRef = useRef<string | null>(null);

  useEffect(() => {
    // The kill switch. OFF means nothing below runs: no subscriber, no timer,
    // no storage access, no events.
    if (!isCaptureTriggerEnabledClient()) return;

    const local = browserStorage('local');
    const session = browserStorage('session');

    // One pageview per path per mount. StrictMode remounts the same instance in
    // development, so a bare increment would double-count every page locally
    // and make the first_pageview rule untestable by hand.
    if (countedPathRef.current !== pathname) {
      countedPathRef.current = pathname;
      recordPageview(session);
    }

    const variant = resolveVariant(local);
    const counter = new GestureCounter();
    const timer = new EngagedTimer({
      startVisible: typeof document === 'undefined' || document.visibilityState !== 'hidden',
    });

    const context = {
      surface: 'web_engagement_capture' as const,
      page_type: pageType,
      team_id: teamId,
      variant,
    };

    let tickId: number | undefined;
    const stopTicking = () => {
      if (tickId !== undefined) window.clearInterval(tickId);
      tickId = undefined;
    };

    const reportSuppressed = (reason: SuppressionReason) => {
      // Once per page. The engine re-evaluates on every event and every tick,
      // and a suppressed visitor stays suppressed, so without this a single
      // page could emit hundreds of identical events.
      if (suppressedPathRef.current === pathname) return;
      suppressedPathRef.current = pathname;
      stopTicking();
      const signal = counter.triggeredSignal();
      track('capture_prompt_suppressed', {
        ...context,
        suppression_reason: reason,
        trigger_signal: signal,
        trigger_count: signal ? counter.countFor(signal) : 0,
        seconds_on_page: timer.elapsedSeconds(),
      });
    };

    const evaluate = () => {
      if (firedPathRef.current === pathname) return;
      if (suppressedPathRef.current === pathname) return;

      // Both conditions, threshold AND floor, before anything is reported. A
      // visitor who has met neither is not suppressed, they are simply not
      // there yet, and reporting that would drown the suppression chart.
      const signal = counter.triggeredSignal();
      if (!signal) return;
      if (!timer.hasReached(ENGAGED_FLOOR_MS)) return;

      const reason = evaluateSuppression({ pathname, local, session, now: Date.now() });
      if (reason) {
        reportSuppressed(reason);
        return;
      }

      firedPathRef.current = pathname;
      stopTicking();
      // Recorded at SHOWN, so a visitor who navigates away mid-prompt is not
      // shown it again on the next pageview.
      markShown(session);
      track('capture_prompt_shown', {
        ...context,
        trigger_signal: signal,
        trigger_count: counter.countFor(signal),
        seconds_on_page: timer.elapsedSeconds(),
      });
    };

    const unsubscribe = subscribeToAnalytics((eventName, props) => {
      const gameId = typeof props.game_id === 'string' ? props.game_id : undefined;
      counter.observe(eventName, gameId);
      evaluate();
    });

    const onVisibility = () => {
      if (document.visibilityState === 'hidden') timer.markHidden();
      else {
        timer.markVisible();
        evaluate();
      }
    };
    document.addEventListener('visibilitychange', onVisibility);

    tickId = window.setInterval(evaluate, TICK_MS);

    return () => {
      unsubscribe();
      document.removeEventListener('visibilitychange', onVisibility);
      stopTicking();
    };
    // pathname is the route identity. A change means a new page, which must get
    // a fresh counter, a fresh timer and its own pageview.
  }, [pathname, pageType, teamId]);

  return null;
}
