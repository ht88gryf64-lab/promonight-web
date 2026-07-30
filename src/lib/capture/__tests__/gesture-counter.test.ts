// Gesture collapsing. The point of these tests is that ONE TAP counts ONCE, no
// matter how many analytics events that tap emits, because the thresholds were
// calibrated on gestures and the call sites emit per game and per promo.
//
// Run with:
//   node --import tsx --experimental-test-module-mocks --test <this file>

import { test } from 'node:test';
import assert from 'node:assert';
import { GestureCounter, DEFAULT_THRESHOLDS } from '../gesture-counter';

// Controllable clock so bursts can be placed exactly.
function makeClock(start = 1_000_000) {
  let t = start;
  return {
    now: () => t,
    advance(ms: number) {
      t += ms;
    },
  };
}

const counter = (clock: ReturnType<typeof makeClock>) =>
  new GestureCounter({ now: clock.now, windowMs: 400 });

// ── the co-firing pair ──────────────────────────────────────────────────────

test('an away-game tap emits two events and counts as ONE away expansion', () => {
  // CalendarGrid fires game_tap then away_game_expanded for the same game, in
  // the same handler. Counting events would credit two signals for one tap.
  const clock = makeClock();
  const c = counter(clock);

  c.observe('game_tap', 'game-123');
  c.observe('away_game_expanded', 'game-123');

  assert.deepStrictEqual(c.getCounts(), {
    away_game_expanded: 1,
    game_tap: 0,
    promo_card_tap: 0,
  });
});

test('precedence moves the credit, it does not add a second one', () => {
  const clock = makeClock();
  const c = counter(clock);

  c.observe('game_tap', 'game-1');
  assert.strictEqual(c.getCounts().game_tap, 1, 'credited on arrival');
  c.observe('away_game_expanded', 'game-1');

  const counts = c.getCounts();
  assert.strictEqual(counts.game_tap, 0, 'credit moved off the weaker signal');
  assert.strictEqual(counts.away_game_expanded, 1);
  assert.strictEqual(
    counts.game_tap + counts.away_game_expanded + counts.promo_card_tap,
    1,
    'one gesture, one increment, total is invariant',
  );
});

test('a lower-precedence event arriving later in the burst does not steal credit back', () => {
  const clock = makeClock();
  const c = counter(clock);

  c.observe('away_game_expanded', 'game-1');
  clock.advance(10);
  c.observe('game_tap', 'game-1');

  assert.deepStrictEqual(c.getCounts(), {
    away_game_expanded: 1,
    game_tap: 0,
    promo_card_tap: 0,
  });
});

// ── multi-event single gestures ─────────────────────────────────────────────

test('a doubleheader tap emits two game_taps and counts as ONE', () => {
  // One cell, two GameContexts, one user tap.
  const clock = makeClock();
  const c = counter(clock);

  c.observe('game_tap', 'game-a');
  c.observe('game_tap', 'game-b');

  assert.strictEqual(c.getCounts().game_tap, 1);
  assert.deepStrictEqual(c.getBurstGameIds().sort(), ['game-a', 'game-b']);
});

test('a promo cell with three promos counts as ONE promo tap', () => {
  const clock = makeClock();
  const c = counter(clock);

  c.observe('promo_card_tap');
  c.observe('promo_card_tap');
  c.observe('promo_card_tap');

  assert.strictEqual(c.getCounts().promo_card_tap, 1);
});

test('the upcoming-promo modal, which emits game_tap AND promo_card_tap, counts as ONE promo tap', () => {
  // UpcomingPromoModal.open() loops contexts firing game_tap, then fires
  // promo_card_tap for the promo. Precedence puts promo above game.
  const clock = makeClock();
  const c = counter(clock);

  c.observe('game_tap', 'game-a');
  c.observe('game_tap', 'game-b');
  c.observe('promo_card_tap');

  assert.deepStrictEqual(c.getCounts(), {
    away_game_expanded: 0,
    game_tap: 0,
    promo_card_tap: 1,
  });
});

// ── separate gestures ───────────────────────────────────────────────────────

test('events beyond the window are separate gestures', () => {
  const clock = makeClock();
  const c = counter(clock);

  c.observe('game_tap', 'game-1');
  clock.advance(401);
  c.observe('game_tap', 'game-2');

  assert.strictEqual(c.getCounts().game_tap, 2);
});

test('the window is measured from the first event of the burst, not the last', () => {
  // Otherwise a steady drip of events inside a loop could extend one gesture
  // indefinitely, or worse, never close it.
  const clock = makeClock();
  const c = counter(clock);

  c.observe('game_tap', 'g1');
  clock.advance(300);
  c.observe('game_tap', 'g2'); // still the first burst
  clock.advance(150); // 450ms from the burst start
  c.observe('game_tap', 'g3'); // new burst

  assert.strictEqual(c.getCounts().game_tap, 2);
});

test('an exactly-at-window event starts a new gesture', () => {
  const clock = makeClock();
  const c = counter(clock);

  c.observe('game_tap', 'g1');
  clock.advance(400);
  c.observe('game_tap', 'g2');

  assert.strictEqual(c.getCounts().game_tap, 2);
});

// ── non-trigger events ──────────────────────────────────────────────────────

test('unrelated analytics events are ignored entirely', () => {
  // The counter is fed every tracked event, so it must filter rather than
  // require the caller to.
  const clock = makeClock();
  const c = counter(clock);

  c.observe('page_view');
  c.observe('affiliate_click');
  c.observe('venue_hub_click');
  c.observe('team_page_engaged');

  assert.deepStrictEqual(c.getCounts(), {
    away_game_expanded: 0,
    game_tap: 0,
    promo_card_tap: 0,
  });
  assert.strictEqual(c.triggeredSignal(), null);
});

test('an unrelated event does not open or extend a burst', () => {
  const clock = makeClock();
  const c = counter(clock);

  c.observe('page_view');
  c.observe('game_tap', 'g1');
  clock.advance(401);
  c.observe('game_tap', 'g2');

  assert.strictEqual(c.getCounts().game_tap, 2, 'both taps counted');
});

// ── thresholds ──────────────────────────────────────────────────────────────

test('no signal is triggered below threshold', () => {
  const clock = makeClock();
  const c = counter(clock);

  for (let i = 0; i < DEFAULT_THRESHOLDS.game_tap - 1; i++) {
    c.observe('game_tap', `g${i}`);
    clock.advance(500);
  }
  assert.strictEqual(c.triggeredSignal(), null);
});

test('game_tap triggers at exactly 4 gestures, not 4 events', () => {
  const clock = makeClock();
  const c = counter(clock);

  // Four taps, each emitting two events. Event counting would trigger at tap 2.
  for (let i = 0; i < 3; i++) {
    c.observe('game_tap', `g${i}`);
    c.observe('game_tap', `g${i}-second`);
    clock.advance(500);
    assert.strictEqual(c.triggeredSignal(), null, `still below threshold after tap ${i + 1}`);
  }
  c.observe('game_tap', 'g4');
  assert.strictEqual(c.triggeredSignal(), 'game_tap');
  assert.strictEqual(c.countFor('game_tap'), 4);
});

test('away_game_expanded triggers at 2', () => {
  const clock = makeClock();
  const c = counter(clock);

  c.observe('game_tap', 'g1');
  c.observe('away_game_expanded', 'g1');
  assert.strictEqual(c.triggeredSignal(), null);

  clock.advance(500);
  c.observe('game_tap', 'g2');
  c.observe('away_game_expanded', 'g2');

  assert.strictEqual(c.triggeredSignal(), 'away_game_expanded');
  assert.strictEqual(c.countFor('away_game_expanded'), 2);
});

test('promo_card_tap triggers at 3', () => {
  const clock = makeClock();
  const c = counter(clock);

  for (let i = 0; i < 3; i++) {
    c.observe('promo_card_tap');
    clock.advance(500);
  }
  assert.strictEqual(c.triggeredSignal(), 'promo_card_tap');
});

test('when two signals cross together the stronger intent wins the attribution', () => {
  // Reported as trigger_signal, so the Phase 2 distribution is only meaningful
  // if this is deterministic.
  const clock = makeClock();
  const c = counter(clock);

  for (let i = 0; i < 3; i++) {
    c.observe('promo_card_tap');
    clock.advance(500);
  }
  for (let i = 0; i < 2; i++) {
    c.observe('away_game_expanded', `g${i}`);
    clock.advance(500);
  }

  assert.strictEqual(c.triggeredSignal(), 'away_game_expanded');
});
