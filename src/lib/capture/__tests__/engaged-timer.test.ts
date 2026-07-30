// The 45s floor must mean 45 seconds of ATTENTION, not 45 seconds of the tab
// existing. These tests are mostly about the difference.
//
// Run with:
//   node --import tsx --experimental-test-module-mocks --test <this file>

import { test } from 'node:test';
import assert from 'node:assert';
import { EngagedTimer, ENGAGED_FLOOR_MS } from '../engaged-timer';

function makeClock(start = 1_000_000) {
  let t = start;
  return {
    now: () => t,
    advance(ms: number) {
      t += ms;
    },
  };
}

test('elapsed accrues while visible', () => {
  const clock = makeClock();
  const timer = new EngagedTimer({ now: clock.now });

  clock.advance(5_000);
  assert.strictEqual(timer.elapsedMs(), 5_000);
  assert.strictEqual(timer.elapsedSeconds(), 5);
});

test('elapsed does NOT accrue while hidden', () => {
  // The whole reason this class exists instead of a wall clock.
  const clock = makeClock();
  const timer = new EngagedTimer({ now: clock.now });

  clock.advance(10_000);
  timer.markHidden();
  clock.advance(60_000); // a minute in a background tab
  assert.strictEqual(timer.elapsedMs(), 10_000, 'background time is not engagement');
  assert.strictEqual(timer.isAccruing(), false);
});

test('elapsed resumes on visible and banks across stretches', () => {
  const clock = makeClock();
  const timer = new EngagedTimer({ now: clock.now });

  clock.advance(10_000);
  timer.markHidden();
  clock.advance(60_000);
  timer.markVisible();
  clock.advance(5_000);

  assert.strictEqual(timer.elapsedMs(), 15_000);
  assert.strictEqual(timer.isAccruing(), true);
});

test('a backgrounded tab never clears the floor on wall-clock alone', () => {
  // The concrete scenario: open, switch away for two minutes, come back and
  // tap. A wall-clock timer would already be past 45s. This must not be.
  const clock = makeClock();
  const timer = new EngagedTimer({ now: clock.now });

  clock.advance(3_000);
  timer.markHidden();
  clock.advance(120_000);
  timer.markVisible();

  assert.strictEqual(timer.hasReached(ENGAGED_FLOOR_MS), false);
  assert.strictEqual(timer.elapsedMs(), 3_000);
});

test('duplicate hidden events do not double-bank', () => {
  // Browsers do emit visibilitychange more than once for one transition, and
  // pagehide overlaps it.
  const clock = makeClock();
  const timer = new EngagedTimer({ now: clock.now });

  clock.advance(10_000);
  timer.markHidden();
  clock.advance(5_000);
  timer.markHidden();
  timer.markHidden();

  assert.strictEqual(timer.elapsedMs(), 10_000);
});

test('duplicate visible events do not reset the current stretch', () => {
  const clock = makeClock();
  const timer = new EngagedTimer({ now: clock.now });

  clock.advance(10_000);
  timer.markVisible(); // already visible
  clock.advance(5_000);

  assert.strictEqual(timer.elapsedMs(), 15_000, 'the open stretch was not restarted');
});

test('starting hidden accrues nothing until visible', () => {
  // A tab restored into the background, or opened via a background link.
  const clock = makeClock();
  const timer = new EngagedTimer({ now: clock.now, startVisible: false });

  clock.advance(30_000);
  assert.strictEqual(timer.elapsedMs(), 0);
  assert.strictEqual(timer.isAccruing(), false);

  timer.markVisible();
  clock.advance(4_000);
  assert.strictEqual(timer.elapsedMs(), 4_000);
});

test('hasReached is false below the floor and true at exactly the floor', () => {
  const clock = makeClock();
  const timer = new EngagedTimer({ now: clock.now });

  clock.advance(ENGAGED_FLOOR_MS - 1);
  assert.strictEqual(timer.hasReached(ENGAGED_FLOOR_MS), false);

  clock.advance(1);
  assert.strictEqual(timer.hasReached(ENGAGED_FLOOR_MS), true);
});

test('the floor can be reached across several visible stretches', () => {
  const clock = makeClock();
  const timer = new EngagedTimer({ now: clock.now });

  for (let i = 0; i < 3; i++) {
    clock.advance(15_000);
    timer.markHidden();
    clock.advance(30_000);
    timer.markVisible();
  }

  assert.strictEqual(timer.elapsedMs(), 45_000);
  assert.strictEqual(timer.hasReached(ENGAGED_FLOOR_MS), true);
});

test('elapsedSeconds floors rather than rounds', () => {
  // Reported as seconds_on_page. Rounding up would let a 44.6s visit report 45
  // and read as having cleared a floor it did not.
  const clock = makeClock();
  const timer = new EngagedTimer({ now: clock.now });

  clock.advance(44_600);
  assert.strictEqual(timer.elapsedSeconds(), 44);
});
