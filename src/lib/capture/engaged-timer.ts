// Time actually spent looking at the page, not time since the page loaded.
//
// EngagementTracker cannot be reused for this. It sets a single 30s setTimeout,
// flips a boolean ref and emits once (src/components/analytics/
// EngagementTracker.tsx). It records no start timestamp, computes no elapsed
// value, exposes nothing to any other component, and only mounts on pro team
// pages. There is no number in it to read.
//
// WHY VISIBILITY MATTERS HERE. The 45s floor exists to keep fast scrollers and
// bots out. A wall-clock timer would count a tab left open in the background,
// which is the exact opposite of engagement: a visitor who opens a page,
// switches away for a minute and comes back to tap twice would clear a 45s
// wall-clock floor without ever having looked at it for 45 seconds. Accruing
// only while the document is visible makes the floor mean what it claims.
//
// Pure and clock-injectable. The React wiring for visibilitychange lives with
// the component that mounts it, so this stays testable without a DOM.

export interface EngagedTimerOptions {
  now?: () => number;
  /** Whether the document is visible at construction. Defaults to visible. */
  startVisible?: boolean;
}

export class EngagedTimer {
  private readonly now: () => number;

  // Time banked from completed visible stretches.
  private accumulatedMs = 0;
  // When the current visible stretch began, or null while hidden.
  private visibleSince: number | null;

  constructor(opts: EngagedTimerOptions = {}) {
    this.now = opts.now ?? (() => Date.now());
    const visible = opts.startVisible ?? true;
    this.visibleSince = visible ? this.now() : null;
  }

  /**
   * Bank the stretch in progress and stop accruing. Idempotent: a duplicate
   * hidden event, which browsers do emit, must not bank the same stretch twice.
   */
  markHidden(): void {
    if (this.visibleSince === null) return;
    this.accumulatedMs += this.now() - this.visibleSince;
    this.visibleSince = null;
  }

  /** Resume accruing. Idempotent for the same reason. */
  markVisible(): void {
    if (this.visibleSince !== null) return;
    this.visibleSince = this.now();
  }

  /** Engaged milliseconds so far, including the stretch in progress. */
  elapsedMs(): number {
    const open = this.visibleSince === null ? 0 : this.now() - this.visibleSince;
    return this.accumulatedMs + open;
  }

  elapsedSeconds(): number {
    return Math.floor(this.elapsedMs() / 1000);
  }

  hasReached(ms: number): boolean {
    return this.elapsedMs() >= ms;
  }

  isAccruing(): boolean {
    return this.visibleSince !== null;
  }
}

// The hard floor from the spec. Both conditions must hold to fire: a threshold
// crossed AND this much engaged time. The floor is what keeps a fast scroller
// who happens to trip a counter from seeing anything.
export const ENGAGED_FLOOR_MS = 45_000;

// A MEASUREMENT FLOOR, NOT A DECISION FLOOR. Nothing is shown or suppressed at
// this mark; it only stamps capture_threshold_met, the probe that sizes how many
// otherwise-eligible visitors leave between here and ENGAGED_FLOOR_MS.
//
// The first read could not answer that question: every visitor who reached 45s
// was reported, and every visitor who did not was invisible, so the cost of the
// floor could not be separated from the cost of anything else. Two counts and a
// subtraction can answer it.
//
// The first read did say the floor is the BINDING constraint, which is what
// makes the question worth asking: median seconds_on_page was exactly 45 for
// both the shown and the suppressed events. Not near 45, exactly 45. The
// gestures were therefore already done and those visitors were being held only
// by the clock, so whoever is lost between 30 and 45 is lost to this constant
// and to nothing else.
//
// The floor itself is deliberately UNCHANGED while this is measured: moving it
// in the same phase would confound the retune with the removal of
// first_pageview and neither result could be attributed.
export const PROBE_FLOOR_MS = 30_000;
