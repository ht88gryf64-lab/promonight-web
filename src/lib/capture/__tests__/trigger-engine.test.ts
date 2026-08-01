// The capture decision: which events fire, at which floor, and exactly once.
//
// The 30-second probe (capture_threshold_met) and the 45-second decision
// (shown / suppressed) are two separate floors reported from one evaluation, so
// most of what matters here is the relationship between them: the probe is a
// superset of shown, it is suppression-gated the same way, and neither can be
// reported twice for the same pathname no matter how often the caller asks.
//
// Run with:
//   node --import tsx --experimental-test-module-mocks --test <this file>

import { test } from 'node:test';
import assert from 'node:assert';
import { ENGAGED_FLOOR_MS, EngagedTimer, PROBE_FLOOR_MS } from '../engaged-timer';
import { GestureCounter, type TriggerSignal } from '../gesture-counter';
import {
  createSafeStorage,
  KEY_DISMISSED_AT,
  KEY_SESSION,
  KEY_SUBSCRIBED,
  type StorageLike,
} from '../storage';
import { readSession } from '../suppression';
import { createGuards, evaluateTrigger, isSettled } from '../trigger-engine';

const NOW = 1_800_000_000_000;
const PATH_A = '/mlb/minnesota-twins';
const PATH_B = '/mlb/chicago-cubs';

function memStorage(seed: Record<string, string> = {}): StorageLike {
  const map = new Map(Object.entries(seed));
  return {
    getItem: (k) => map.get(k) ?? null,
    setItem: (k, v) => void map.set(k, v),
    removeItem: (k) => void map.delete(k),
  };
}

interface HarnessOptions {
  localSeed?: Record<string, string>;
  sessionSeed?: Record<string, string>;
  pathname?: string;
}

/**
 * One visitor on one page, with a clock the test drives. The counter and the
 * timer take the same clock, so advancing it accrues engaged time exactly as a
 * visible tab would.
 */
function harness(opts: HarnessOptions = {}) {
  let clock = NOW;
  let pathname = opts.pathname ?? PATH_A;
  let counter = new GestureCounter({ now: () => clock });
  let timer = new EngagedTimer({ now: () => clock });

  const guards = createGuards();
  const local = createSafeStorage(memStorage(opts.localSeed));
  const session = createSafeStorage(memStorage(opts.sessionSeed));

  const h = {
    guards,
    local,
    session,
    get pathname() {
      return pathname;
    },

    /** Move the clock forward. Engaged time accrues for the whole span. */
    advance(seconds: number) {
      clock += seconds * 1000;
      return h;
    },

    /** One deliberate gesture, a full burst window clear of the previous one. */
    tap(signal: TriggerSignal = 'game_tap', gameId?: string) {
      clock += 1_000;
      counter.observe(signal, gameId);
      return h;
    },

    /** N gestures, one second apart, so none of them collapse into one burst. */
    taps(n: number, signal: TriggerSignal = 'game_tap') {
      for (let i = 0; i < n; i += 1) h.tap(signal, `g${i}`);
      return h;
    },

    hide() {
      timer.markHidden();
      return h;
    },

    show() {
      timer.markVisible();
      return h;
    },

    /**
     * The effect re-running for the SAME page: a fresh counter and a fresh
     * timer, but the guards survive. This is what StrictMode does in
     * development, and what a change to any other effect dependency does in
     * production.
     */
    remount() {
      counter = new GestureCounter({ now: () => clock });
      timer = new EngagedTimer({ now: () => clock });
      return h;
    },

    /** Same-segment navigation: a new pathname on the same component instance. */
    navigate(next: string) {
      pathname = next;
      return h.remount();
    },

    evaluate() {
      return evaluateTrigger({ pathname, guards, counter, timer, local, session, now: clock });
    },

    /** Just the event names, for the common assertion. */
    events() {
      return h.evaluate().map((e) => e.event);
    },
  };

  return h;
}

// ── the floors themselves ───────────────────────────────────────────────────

test('the decision floor is unchanged and the probe sits below it', () => {
  // The probe exists so the floor can be changed LATER, on evidence. Moving the
  // floor in the same phase as removing first_pageview would change two
  // variables at once and neither result could be attributed, which is the
  // entire reason the probe was built instead.
  assert.strictEqual(ENGAGED_FLOOR_MS, 45_000, 'the 45s decision floor must not move');
  assert.strictEqual(PROBE_FLOOR_MS, 30_000);
  assert.ok(PROBE_FLOOR_MS < ENGAGED_FLOOR_MS);
});

// ── the probe ───────────────────────────────────────────────────────────────

test('the probe fires when the threshold and 30 engaged seconds are both met', () => {
  const h = harness();

  h.taps(4); // game_tap threshold, crossed at 4s
  assert.deepStrictEqual(h.events(), [], 'threshold alone is not enough');

  h.advance(25); // 29s
  assert.deepStrictEqual(h.events(), [], 'one second short of the probe floor');

  h.advance(1); // 30s exactly
  const emissions = h.evaluate();
  assert.deepStrictEqual(emissions, [
    { event: 'capture_threshold_met', signal: 'game_tap', count: 4, seconds: 30 },
  ]);

  // The probe reports; it decides nothing. Marking the session here would
  // suppress the visitor's real prompt fifteen seconds later.
  assert.strictEqual(readSession(h.session).shown, false);
  assert.strictEqual(isSettled(h.guards, h.pathname), false);
});

test('30 seconds without the gesture threshold reports nothing, however long the visit', () => {
  const h = harness();
  h.taps(3); // one gesture short of the game_tap threshold of 4
  h.advance(816); // the longest suppressed visit in the first read
  assert.deepStrictEqual(h.events(), []);
});

test('the probe measures ENGAGED time, so a backgrounded tab does not reach it', () => {
  const h = harness();
  h.taps(4);
  h.hide().advance(300).show(); // five minutes in another tab
  assert.deepStrictEqual(h.events(), [], 'wall clock is not engagement');

  h.advance(26); // 30s of actual visible time
  assert.deepStrictEqual(h.events(), ['capture_threshold_met']);
});

// ── the probe is suppression-gated ──────────────────────────────────────────

const SUPPRESSED_CASES: Array<{ reason: string; opts: HarnessOptions }> = [
  { reason: 'already_subscribed', opts: { localSeed: { [KEY_SUBSCRIBED]: '1' } } },
  {
    reason: 'recently_dismissed',
    opts: { localSeed: { [KEY_DISMISSED_AT]: String(NOW - 1_000) } },
  },
  {
    reason: 'session_already_shown',
    opts: { sessionSeed: { [KEY_SESSION]: JSON.stringify({ shown: true, signup: false }) } },
  },
  {
    reason: 'session_signup',
    opts: { sessionSeed: { [KEY_SESSION]: JSON.stringify({ shown: false, signup: true }) } },
  },
  { reason: 'excluded_path', opts: { pathname: '/follow' } },
];

for (const { reason, opts } of SUPPRESSED_CASES) {
  test(`no probe for a visitor suppressed by ${reason}`, () => {
    // The probe measures the population that would have been prompted, not
    // everyone who taps. Counting a visitor who was never going to see anything
    // would inflate the numerator of a rate they are not part of.
    const h = harness(opts);
    h.taps(4).advance(26); // threshold plus 30 engaged seconds
    assert.deepStrictEqual(h.events(), []);
  });
}

test('a suppressed visitor is still reported at 45 seconds, not at 30', () => {
  const h = harness({ localSeed: { [KEY_SUBSCRIBED]: '1' } });

  h.taps(4).advance(26); // 30s
  assert.deepStrictEqual(h.events(), [], 'the decision floor did not move');

  h.advance(14); // 44s
  assert.deepStrictEqual(h.events(), []);

  h.advance(1); // 45s
  assert.deepStrictEqual(h.evaluate(), [
    {
      event: 'capture_prompt_suppressed',
      reason: 'already_subscribed',
      signal: 'game_tap',
      count: 4,
      seconds: 45,
    },
  ]);
  assert.strictEqual(isSettled(h.guards, h.pathname), true);
  assert.deepStrictEqual(h.events(), [], 'suppressed is terminal for the page');
});

// ── the decision, unchanged ─────────────────────────────────────────────────

test('shown still fires at 45 seconds and is terminal', () => {
  const h = harness();

  h.taps(4).advance(26); // 30s
  assert.deepStrictEqual(h.events(), ['capture_threshold_met']);

  h.advance(14); // 44s
  assert.deepStrictEqual(h.events(), [], 'nothing between the two floors');

  h.advance(1); // 45s
  assert.deepStrictEqual(h.evaluate(), [
    { event: 'capture_prompt_shown', signal: 'game_tap', count: 4, seconds: 45 },
  ]);
  assert.strictEqual(readSession(h.session).shown, true);

  h.advance(60);
  assert.deepStrictEqual(h.events(), [], 'shown is reported once');
});

test('a visitor who crosses the threshold after 45 seconds emits BOTH, probe first', () => {
  // The read is a subtraction, so a late crosser who emitted shown without ever
  // emitting the probe would count as a negative bounce and understate the
  // answer. Both floors are met in this single pass and both must report.
  const h = harness();
  h.advance(60).taps(4); // reads for a minute, then taps: 64s

  const emissions = h.evaluate();
  assert.deepStrictEqual(emissions, [
    { event: 'capture_threshold_met', signal: 'game_tap', count: 4, seconds: 64 },
    { event: 'capture_prompt_shown', signal: 'game_tap', count: 4, seconds: 64 },
  ]);
});

test('a suppressed late crosser emits the suppression and never the probe', () => {
  const h = harness({ localSeed: { [KEY_SUBSCRIBED]: '1' } });
  h.advance(60).taps(4);
  assert.deepStrictEqual(h.events(), ['capture_prompt_suppressed']);
});

// ── once per pathname ───────────────────────────────────────────────────────

test('the probe does not fire twice when the effect re-runs for the same page', () => {
  // StrictMode in development, or any other effect dependency changing in
  // production: a fresh counter and timer, but the same component instance. A
  // guard that lived in the effect rather than in a ref would report every
  // qualifying visitor twice and double the numerator.
  const h = harness();
  h.taps(4).advance(26);
  assert.deepStrictEqual(h.events(), ['capture_threshold_met']);

  h.remount();
  h.taps(4).advance(26); // both conditions met again, from scratch
  assert.deepStrictEqual(h.events(), [], 'once per pathname, not once per effect run');

  // The probe is spent; the decision is not. They are independent guards.
  h.advance(15);
  assert.deepStrictEqual(h.events(), ['capture_prompt_shown']);
});

test('same-segment navigation reports the new page exactly once', () => {
  // The App Router reuses this component between two team pages, so the guards
  // survive the navigation. A boolean guard would silence the second page
  // entirely; an unkeyed reset would let the first page report twice.
  const h = harness();
  h.taps(4).advance(26);
  assert.deepStrictEqual(h.events(), ['capture_threshold_met']);

  h.navigate(PATH_B);
  h.taps(4).advance(26);
  assert.deepStrictEqual(h.events(), ['capture_threshold_met'], 'the new page is a new pageview');
  assert.deepStrictEqual(h.events(), [], 'and reports only once itself');

  assert.strictEqual(h.guards.probed, PATH_B);
});

test('one session across two pages emits TWO probes and ONE shown', () => {
  // The reason the read is over distinct sessions rather than raw event counts.
  // The probe is guarded per pathname, but the one-prompt-per-session cap is
  // only written by markShown at the 45s floor, so a visitor who qualifies on
  // page A and leaves at 40s can qualify again on page B and be shown there.
  // Raw counts book that visitor as a loss; they were prompted anyway, and
  // lowering the floor would have gained nothing from them.
  const h = harness();

  h.taps(4).advance(26); // page A, 30s
  assert.deepStrictEqual(h.events(), ['capture_threshold_met']);
  assert.strictEqual(readSession(h.session).shown, false, 'nothing is marked at the probe');

  h.advance(10); // leaves A at 40s, before the decision floor
  h.navigate(PATH_B);
  h.taps(4).advance(26); // page B, 30s
  assert.deepStrictEqual(h.events(), ['capture_threshold_met'], 'a second probe, correctly');

  h.advance(15); // page B, 45s
  assert.deepStrictEqual(h.events(), ['capture_prompt_shown']);

  // 2 probes, 1 shown, and the visitor lost nothing. Subtract distinct sessions.
  assert.strictEqual(readSession(h.session).shown, true);
});

test('once a prompt is shown, later pages in the session emit no probe at all', () => {
  // The end-to-end version of the suppression gate, driven through the real
  // markShown write rather than a seeded session. evaluateSuppression runs
  // BEFORE the probe is emitted and the probe is gated on its result
  // (trigger-engine.ts, `const reason = ...` then `if (!reason && ...)`), so a
  // visitor shown on page A cannot probe on page B. This is what stops the
  // probe count from running away once the session cap is finally written, and
  // it is why the upward bias is bounded by one prompt per session.
  const h = harness();

  h.taps(4).advance(41); // page A, 45s
  assert.deepStrictEqual(h.events(), ['capture_threshold_met', 'capture_prompt_shown']);
  assert.strictEqual(readSession(h.session).shown, true, 'the session cap is now written');

  h.navigate(PATH_B);
  h.taps(4).advance(26); // page B, threshold plus 30s: fully qualified but capped
  assert.deepStrictEqual(h.events(), [], 'no probe once the session has been shown');
  assert.strictEqual(h.guards.probed, PATH_A, 'the probe slot never advanced to B');

  h.advance(15); // page B, 45s
  assert.deepStrictEqual(h.evaluate(), [
    {
      event: 'capture_prompt_suppressed',
      reason: 'session_already_shown',
      signal: 'game_tap',
      count: 4,
      seconds: 45,
    },
  ]);
});

test('a same-path revisit does not re-probe, so that direction understates instead', () => {
  // The opposite and much rarer error. guards.probed is a single slot, so a
  // return to a path that already probed emits shown with no matching probe.
  // Documented because it biases the other way and partly offsets the above.
  const h = harness();

  h.taps(4).advance(26); // A, 30s: probe
  assert.deepStrictEqual(h.events(), ['capture_threshold_met']);

  h.advance(5); // leaves A at 35s
  h.navigate(PATH_B); // B never qualifies, so it never claims the slot
  h.advance(60);
  assert.deepStrictEqual(h.events(), []);

  h.navigate(PATH_A); // back to A
  h.taps(4).advance(26);
  assert.deepStrictEqual(h.events(), [], 'the slot still holds A, so no second probe');

  h.advance(15);
  assert.deepStrictEqual(h.events(), ['capture_prompt_shown'], 'but the decision still fires');
});

test('repeated evaluation between the floors never re-reports the probe', () => {
  // The caller evaluates on every tracked event and every 5s tick, so this is
  // the ordinary case, not an edge case.
  const h = harness();
  h.taps(4).advance(26);
  assert.deepStrictEqual(h.events(), ['capture_threshold_met']);

  // 35s and 40s: still between the floors.
  for (const _ of [35, 40]) {
    h.advance(5);
    assert.deepStrictEqual(h.events(), [], 'a tick between the floors reports nothing');
  }

  // 45s: the tick that lands on the decision floor is the one that reports.
  h.advance(5);
  assert.deepStrictEqual(h.events(), ['capture_prompt_shown']);
});
