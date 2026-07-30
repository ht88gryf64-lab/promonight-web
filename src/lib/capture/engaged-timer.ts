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
