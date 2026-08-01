// The capture decision: what fires, when, and exactly once.
//
// WHY THIS IS NOT INSIDE CaptureTrigger.tsx. The test command is node:test over
// src/**/*.test.ts with no DOM and no React renderer, so a rule that lives in a
// component is a rule no test can reach. Everything here is pure apart from the
// two writes it is explicitly responsible for (claiming a guard and marking the
// session shown), takes its clock as an argument, and needs neither React nor a
// browser. The component keeps only what genuinely requires them: the analytics
// subscriber, the visibilitychange listener, the tick interval, and the
// per-pathname lifetime of the counter and the timer.

import { ENGAGED_FLOOR_MS, PROBE_FLOOR_MS, type EngagedTimer } from './engaged-timer';
import type { GestureCounter, TriggerSignal } from './gesture-counter';
import type { SafeStorage } from './storage';
import { evaluateSuppression, markShown, type SuppressionReason } from './suppression';

/**
 * Which events have already been reported for which pathname.
 *
 * KEYED BY PATHNAME, not booleans, and that is load-bearing. The App Router
 * reuses the component instance when navigating between two pages of the SAME
 * route segment (one team page to another), so a boolean set on the first page
 * would still be set on the second and every page after the first in a session
 * would go unreported. Keying on the path resets each guard per page while still
 * surviving the effect re-running for the SAME path, which is what StrictMode
 * does in development.
 *
 * One object rather than three separate refs because evaluateTrigger claims them
 * together and must be able to write them.
 */
export interface CaptureGuards {
  probed: string | null;
  shown: string | null;
  suppressed: string | null;
}

export function createGuards(): CaptureGuards {
  return { probed: null, shown: null, suppressed: null };
}

/**
 * An event the caller should hand to track(). The engine returns these rather
 * than emitting them so the decision stays testable without an analytics sink.
 */
export type CaptureEmission =
  | { event: 'capture_threshold_met'; signal: TriggerSignal; count: number; seconds: number }
  | { event: 'capture_prompt_shown'; signal: TriggerSignal; count: number; seconds: number }
  | {
      event: 'capture_prompt_suppressed';
      reason: SuppressionReason;
      signal: TriggerSignal | null;
      count: number;
      seconds: number;
    };

export interface EvaluateTriggerInput {
  pathname: string;
  guards: CaptureGuards;
  counter: GestureCounter;
  timer: EngagedTimer;
  local: SafeStorage;
  session: SafeStorage;
  /** Epoch ms, for the dismissal window. The timer carries its own clock. */
  now: number;
}

/**
 * Decide what to report for the current pathname. Safe to call on every tracked
 * event and every tick; it returns an empty list until something is actually due
 * and never returns the same event twice for the same path.
 *
 * TWO FLOORS, ONE DECISION. The 45-second engaged floor still decides shown and
 * suppressed, exactly as before. The 30-second floor decides nothing: it only
 * stamps capture_threshold_met so the population that qualifies and then leaves
 * before 45 seconds can be counted, since today that population emits nothing at
 * all and is invisible in the data.
 *
 * RE-ENTRANCY. track() notifies subscribers, and this engine's caller is a
 * subscriber, so emitting an event calls back into here synchronously. Every
 * guard is therefore claimed BEFORE the emission that needs it is returned. A
 * re-entrant call finds the guard already claimed and returns nothing, which is
 * what makes each event once-per-path rather than once-per-call-stack.
 */
export function evaluateTrigger(input: EvaluateTriggerInput): CaptureEmission[] {
  const { pathname, guards, counter, timer, local, session, now } = input;

  // Terminal for this page: the decision has been reported either way.
  if (guards.shown === pathname) return [];
  if (guards.suppressed === pathname) return [];

  // Both conditions, threshold AND the probe floor, before anything is
  // reported. A visitor who has met neither is not suppressed, they are simply
  // not there yet, and reporting that would drown every chart.
  const signal = counter.triggeredSignal();
  if (!signal) return [];
  if (!timer.hasReached(PROBE_FLOOR_MS)) return [];

  const reason = evaluateSuppression({ pathname, local, session, now });

  // One reading of the clock and the counter for every event in this pass, so a
  // probe and a shown emitted together cannot disagree about the same instant.
  const count = counter.countFor(signal);
  const seconds = timer.elapsedSeconds();
  const emissions: CaptureEmission[] = [];

  // THE PROBE IS SUPPRESSION-GATED. It measures the population that would have
  // been prompted, not everyone who taps: an already_subscribed visitor was
  // never going to see anything, so counting them here would inflate the
  // numerator of a rate they are not part of.
  //
  // That gate is what lets the probe be subtracted from capture_prompt_shown at
  // all. Anyone who emits the probe is eligible by construction, and in this
  // phase nothing can suppress them in the next fifteen seconds (nothing
  // renders, so no dismissal or signup can happen, and only one trigger is
  // mounted per page). So WITHIN ONE PAGEVIEW the only way to emit the probe and
  // not the shown is to have left.
  //
  // Across a session that no longer holds, because this guard is per pathname
  // while the one-prompt-per-session cap is written by markShown at the 45s
  // floor: a visitor can probe page A, leave, and probe page B before anything
  // has marked the session. The subtraction is therefore over DISTINCT SESSIONS,
  // never over raw event counts. See CaptureThresholdMetProperties in
  // lib/analytics.ts for the full read methodology and both bias directions.
  if (!reason && guards.probed !== pathname) {
    guards.probed = pathname;
    emissions.push({ event: 'capture_threshold_met', signal, count, seconds });
  }

  if (!timer.hasReached(ENGAGED_FLOOR_MS)) return emissions;

  // Deliberately NOT an else. A visitor who crosses the gesture threshold for
  // the first time after 45 seconds meets both floors in this single pass and
  // must emit both events, because the whole point is a subtraction: if the late
  // crossers emitted shown without ever emitting the probe, the difference would
  // count them as negative bounces and understate the answer.
  if (reason) {
    guards.suppressed = pathname;
    emissions.push({ event: 'capture_prompt_suppressed', reason, signal, count, seconds });
    return emissions;
  }

  guards.shown = pathname;
  // Recorded at SHOWN, so a visitor who navigates away mid-prompt is not shown
  // it again on the next pageview.
  markShown(session);
  emissions.push({ event: 'capture_prompt_shown', signal, count, seconds });
  return emissions;
}

/** Whether the decision for this page is final, so the caller can stop ticking. */
export function isSettled(guards: CaptureGuards, pathname: string): boolean {
  return guards.shown === pathname || guards.suppressed === pathname;
}
