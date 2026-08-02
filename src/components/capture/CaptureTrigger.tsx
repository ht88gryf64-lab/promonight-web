'use client';

import { useEffect, useRef, useState } from 'react';
import { usePathname } from 'next/navigation';
import {
  subscribeToAnalytics,
  track,
  type CapturePageType,
  type CapturePromptContext,
} from '@/lib/analytics';
import type { CaptureChipPool, CaptureTeamRef } from '@/lib/capture/chips';
import { CaptureCard } from './CaptureCard';
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

// The trigger engine's WIRING. Its job is to decide when a prompt fires, say so
// in telemetry, and, in variant_a only, put the sheet on screen.
//
// CONTROL STILL RENDERS NOTHING, and that is the entire basis of the
// experiment. It runs the same counter, the same timer and the same suppression
// check, and emits capture_prompt_shown at the same instant on the same terms;
// it simply stops there. Nothing below may make control behave differently from
// the way it behaved through the whole telemetry-only phase.
//
// That symmetry is in WHEN the event fires, not in how many times a browser can
// fire it: only variant_a writes the dismissal and subscribed suppressors, so raw
// shown counts drift apart over a multi-session window. The documented
// per-person read is unaffected. See the note above CapturePromptShownProperties
// in lib/analytics.ts before writing any arm comparison.
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
  /**
   * The page team, or null on aggregators, which have no page-level team.
   *
   * Widened from a bare slug when the sheet arrived: rendering needs the display
   * name for the heading, and starring needs the league and sport the star
   * events carry. `team_id` on every capture event is still exactly `team?.id`,
   * so nothing about the existing telemetry moved.
   */
  team: CaptureTeamRef | null;
  /**
   * Chip candidates, resolved on the server. Empty on surfaces that have none.
   */
  pool: CaptureChipPool;
}

/** Slugs kept for chip sourcing. A bound, not a tuning knob: three are ever used. */
const MAX_REMEMBERED_OPPONENTS = 8;

/** What the sheet needs, captured at the instant it is shown. */
interface OpenSheet {
  context: CapturePromptContext;
  expandedOpponentIds: string[];
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

export function CaptureTrigger({ pageType, team, pool }: CaptureTriggerProps) {
  const pathname = usePathname();
  const teamId = team?.id ?? null;

  // Everything the ENGINE needs lives in refs, not state. This component renders
  // exactly once more than it used to, when variant_a is shown; nothing the
  // counter, the timer or the guards do may cause a render, because a render per
  // tracked event on a page the visitor is reading is a cost with no benefit.
  //
  // The guards must OUTLIVE the effect, which is the whole reason they are a ref
  // rather than a local. StrictMode re-runs the effect for the same path in
  // development, and a fresh set of guards each time would report every event
  // twice. See trigger-engine.ts for why they are keyed by pathname.
  const guardsRef = useRef<CaptureGuards>(createGuards());

  // Opponents of games expanded on THIS page, most recent first. Read from the
  // opponent_slug that game_tap and away_game_expanded already carry, so the
  // calendar needed no new prop and no new event to make chips possible.
  const opponentsRef = useRef<string[]>([]);

  // Non-null only while variant_a has a sheet up. Null for control, always.
  const [sheet, setSheet] = useState<OpenSheet | null>(null);

  useEffect(() => {
    // The kill switch. OFF means nothing below runs: no subscriber, no timer,
    // no storage access, no events.
    if (!isCaptureTriggerEnabledClient()) return;

    // A new page is a new set of expansions, and a new page cannot keep showing
    // the previous page's sheet: the App Router reuses this instance between two
    // team pages, so without these the sheet would sit there naming the team the
    // visitor just navigated away from.
    opponentsRef.current = [];
    setSheet(null);

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

        // THE ONLY BEHAVIORAL DIFFERENCE BETWEEN THE ARMS, and it is downstream
        // of the event rather than upstream of it: the arm is decided, reported
        // and settled by the block above regardless, so control emits the same
        // shown event at the same instant on the same terms. All this adds is a
        // render for the arm that has something to render.
        //
        // The opponent list is COPIED here rather than passed by reference. It
        // keeps mutating for as long as the page is up, and the chips are meant
        // to describe what the visitor had done by the time the sheet appeared.
        if (e.event === 'capture_prompt_shown' && variant === 'variant_a') {
          setSheet({ context, expandedOpponentIds: [...opponentsRef.current] });
        }
      }

      // Nothing further can change for this page once it is shown or suppressed.
      if (isSettled(guards, pathname)) stopTicking();
    };

    const unsubscribe = subscribeToAnalytics((eventName, props) => {
      const gameId = typeof props.game_id === 'string' ? props.game_id : undefined;
      counter.observe(eventName, gameId);
      rememberOpponent(opponentsRef, eventName, props);
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

  if (!sheet) return null;

  return (
    <CaptureCard
      context={sheet.context}
      team={team}
      pool={pool}
      expandedOpponentIds={sheet.expandedOpponentIds}
    />
  );
}

/**
 * Remember the opponent of a game the visitor just opened, most recent first and
 * deduped.
 *
 * Both events that carry an opponent count, not only the away expansion. A home
 * game's opponent is the visiting club, and someone who opened that cell looked
 * at that matchup just as deliberately.
 *
 * Runs for BOTH ARMS. It writes a ref and nothing else: no event, no render, no
 * storage. Making it conditional on the arm would put an `if` on the hot path
 * for no gain and one more place for the arms to diverge.
 */
function rememberOpponent(
  ref: { current: string[] },
  eventName: string,
  props: Record<string, unknown>,
): void {
  if (eventName !== 'game_tap' && eventName !== 'away_game_expanded') return;
  const slug = typeof props.opponent_slug === 'string' ? props.opponent_slug.trim() : '';
  if (!slug) return;
  ref.current = [slug, ...ref.current.filter((s) => s !== slug)].slice(
    0,
    MAX_REMEMBERED_OPPONENTS,
  );
}
