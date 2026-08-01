'use client';

import { useEffect, useRef } from 'react';
import { usePathname } from 'next/navigation';
import {
  subscribeToAnalytics,
  track,
  type CapturePageType,
} from '@/lib/analytics';
import { EngagedTimer } from '@/lib/capture/engaged-timer';
import { GestureCounter } from '@/lib/capture/gesture-counter';
import { isCaptureTriggerEnabledClient } from '@/lib/capture/gate';
import { browserStorage } from '@/lib/capture/storage';
import {
  createGuards,
  evaluateTrigger,
  isSettled,
  type CaptureGuards,
} from '@/lib/capture/trigger-engine';
import { resolveVariant } from '@/lib/capture/variant';

// The trigger engine's WIRING. RENDERS NOTHING, in this phase and in the control
// arm of every later one. Its entire job is to decide when a prompt WOULD fire
// and to say so in telemetry, so the thresholds are validated against live
// traffic before any sheet is built.
//
// The decision itself lives in lib/capture/trigger-engine.ts, where a test can
// reach it. What is left here is the part that genuinely needs React and the
// DOM: the analytics subscriber, the visibilitychange listener, the tick, and
// the per-pathname lifetime of the counter and timer.
//
// Mounted per page rather than in the root layout, because it needs the page's
// team and page type, and because in the App Router a route change unmounts and
// remounts it, which is exactly the pageview boundary the session rules need.

interface CaptureTriggerProps {
  pageType: CapturePageType;
  /** Null on aggregators, which have no page-level team. */
  teamId: string | null;
}

// Re-checked on a timer as well as on every event, because an engaged-time floor
// can be the last condition to be met: a visitor can cross a threshold at 20
// seconds and then simply keep reading. Without a tick, that visitor would never
// fire until they happened to tap again. 5s is well under the 15s gap between
// the probe floor and the decision floor, so neither is missed by more than one
// tick's worth of overshoot.
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
  // The guards must OUTLIVE the effect, which is the whole reason they are a ref
  // rather than a local. StrictMode re-runs the effect for the same path in
  // development, and a fresh set of guards each time would report every event
  // twice. See trigger-engine.ts for why they are keyed by pathname.
  const guardsRef = useRef<CaptureGuards>(createGuards());

  useEffect(() => {
    // The kill switch. OFF means nothing below runs: no subscriber, no timer,
    // no storage access, no events.
    if (!isCaptureTriggerEnabledClient()) return;

    const guards = guardsRef.current;
    const local = browserStorage('local');
    const session = browserStorage('session');

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

    const evaluate = () => {
      const emissions = evaluateTrigger({
        pathname,
        guards,
        counter,
        timer,
        local,
        session,
        now: Date.now(),
      });

      for (const e of emissions) {
        // Each event is claimed inside evaluateTrigger before it is returned, so
        // the subscriber this track() call notifies re-enters evaluate() and
        // finds nothing left to report.
        if (e.event === 'capture_prompt_suppressed') {
          track(e.event, {
            ...context,
            suppression_reason: e.reason,
            trigger_signal: e.signal,
            trigger_count: e.count,
            seconds_on_page: e.seconds,
          });
        } else {
          track(e.event, {
            ...context,
            trigger_signal: e.signal,
            trigger_count: e.count,
            seconds_on_page: e.seconds,
          });
        }
      }

      // Nothing further can change for this page once it is shown or suppressed.
      if (isSettled(guards, pathname)) stopTicking();
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
    // a fresh counter and a fresh timer. The guards deliberately do NOT reset:
    // they are keyed by path, so the new page gets its own slots out of the same
    // object that still remembers what the previous page reported.
  }, [pathname, pageType, teamId]);

  return null;
}
