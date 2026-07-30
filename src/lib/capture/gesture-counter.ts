// Counts USER GESTURES, not analytics events. The two differ, and the gap is
// large enough to make raw event counts useless as a trigger.
//
// From the Phase 0 audit of the four call sites:
//   - An away-game cell tap emits BOTH game_tap and away_game_expanded for the
//     same game, in the same synchronous handler
//     (src/components/redesign/CalendarGrid.tsx onCellClick).
//   - game_tap fires once per GameContext on the tapped date, so a doubleheader
//     emits two from a single tap.
//   - promo_card_tap fires once per promo on the tapped cell.
//   - UpcomingPromoModal's open() emits game_tap for every context AND
//     promo_card_tap for the promo, from one click.
//
// So one tap can emit anywhere from one to five events. Thresholds calibrated
// on gestures would fire almost immediately if fed raw events.
//
// THE DEDUPE RULE. Every trigger event arriving within `windowMs` of the first
// event of the current burst belongs to the same gesture. A burst increments
// exactly one counter: the highest-precedence signal seen anywhere in it.
// Precedence is away_game_expanded > promo_card_tap > game_tap, so the pairing
// that always co-fires (game_tap plus away_game_expanded for one away game)
// resolves to the away expansion, which is the signal with real trip-planning
// intent rather than the incidental one.
//
// game_id is what makes the co-firing pair identifiable: the two events carry
// the same id, which is the proof they describe one game rather than two taps.
// The time window is the mechanism that collapses them, and the id is retained
// so the burst can be reasoned about and reported. A doubleheader's two
// different ids inside one window still collapse, correctly, because the user
// performed one tap.
//
// Pure and clock-injectable so the whole rule is testable without waiting.

export type TriggerSignal = 'away_game_expanded' | 'game_tap' | 'promo_card_tap';

export const TRIGGER_SIGNALS: readonly TriggerSignal[] = [
  'away_game_expanded',
  'game_tap',
  'promo_card_tap',
];

export function isTriggerSignal(name: string): name is TriggerSignal {
  return (TRIGGER_SIGNALS as readonly string[]).includes(name);
}

// Higher wins when a single burst carries more than one signal.
const PRECEDENCE: Record<TriggerSignal, number> = {
  away_game_expanded: 3,
  promo_card_tap: 2,
  game_tap: 1,
};

// Thresholds are per signal and the trigger is the FIRST to be met, so a
// visitor who only taps games and one who only expands away games both reach
// it, on their own scale.
export const DEFAULT_THRESHOLDS: Record<TriggerSignal, number> = {
  away_game_expanded: 2,
  game_tap: 4,
  promo_card_tap: 3,
};

// A burst is one gesture. 400ms is comfortably longer than the synchronous
// handler that emits the co-firing events (they land in the same tick) and
// comfortably shorter than a human performing two deliberate taps.
export const DEFAULT_BURST_WINDOW_MS = 400;

export interface GestureCounterOptions {
  thresholds?: Record<TriggerSignal, number>;
  windowMs?: number;
  now?: () => number;
}

export interface GestureCounts {
  away_game_expanded: number;
  game_tap: number;
  promo_card_tap: number;
}

export class GestureCounter {
  private readonly thresholds: Record<TriggerSignal, number>;
  private readonly windowMs: number;
  private readonly now: () => number;

  private counts: GestureCounts = {
    away_game_expanded: 0,
    game_tap: 0,
    promo_card_tap: 0,
  };

  // The burst in progress: when it started, the best signal seen so far, and
  // which counter that signal has already been credited to.
  private burstStartedAt: number | null = null;
  private burstSignal: TriggerSignal | null = null;
  private burstGameIds = new Set<string>();

  constructor(opts: GestureCounterOptions = {}) {
    this.thresholds = opts.thresholds ?? DEFAULT_THRESHOLDS;
    this.windowMs = opts.windowMs ?? DEFAULT_BURST_WINDOW_MS;
    this.now = opts.now ?? (() => Date.now());
  }

  /**
   * Feed one tracked event. Non-trigger events are ignored, so this can be
   * pointed straight at every analytics event without filtering upstream.
   */
  observe(eventName: string, gameId?: string | null): void {
    if (!isTriggerSignal(eventName)) return;
    const t = this.now();

    const startsNewBurst =
      this.burstStartedAt === null || t - this.burstStartedAt >= this.windowMs;

    if (startsNewBurst) {
      this.burstStartedAt = t;
      this.burstSignal = eventName;
      this.burstGameIds = new Set(gameId ? [gameId] : []);
      this.counts[eventName] += 1;
      return;
    }

    if (gameId) this.burstGameIds.add(gameId);

    // Already inside a gesture. If this event outranks what the burst was
    // credited with, move the credit rather than adding a second one: the
    // gesture is still exactly one gesture.
    const current = this.burstSignal as TriggerSignal;
    if (PRECEDENCE[eventName] > PRECEDENCE[current]) {
      this.counts[current] -= 1;
      this.counts[eventName] += 1;
      this.burstSignal = eventName;
    }
  }

  getCounts(): GestureCounts {
    return { ...this.counts };
  }

  /** Game ids seen in the burst currently open. Diagnostic only. */
  getBurstGameIds(): string[] {
    return [...this.burstGameIds];
  }

  /**
   * The first signal to reach its threshold, or null. Evaluated in precedence
   * order so a visitor who crosses two at once is attributed to the stronger
   * intent signal, which is what the Phase 2 read needs to be meaningful.
   */
  triggeredSignal(): TriggerSignal | null {
    const ordered: TriggerSignal[] = ['away_game_expanded', 'promo_card_tap', 'game_tap'];
    for (const signal of ordered) {
      if (this.counts[signal] >= this.thresholds[signal]) return signal;
    }
    return null;
  }

  /** Count for the signal that tripped, for the trigger_count property. */
  countFor(signal: TriggerSignal): number {
    return this.counts[signal];
  }
}
