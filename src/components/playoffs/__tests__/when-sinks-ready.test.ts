// The bounded wait for the analytics sinks, on a fake clock. No browser.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { SINK_POLL_MS, SINK_WAIT_MS, whenSinksReady, type SinkEnv } from '../when-sinks-ready';

function harness(readyAt: number | null) {
  let now = 0;
  let tick: (() => void) | null = null;
  let leave: (() => void) | null = null;
  const stopped = { every: 0, onLeave: 0 };
  const env: SinkEnv = {
    ready: () => readyAt !== null && now >= readyAt,
    now: () => now,
    every: (ms, fn) => {
      assert.equal(ms, SINK_POLL_MS);
      tick = fn;
      return () => {
        stopped.every += 1;
        tick = null;
      };
    },
    onLeave: (fn) => {
      leave = fn;
      return () => {
        stopped.onLeave += 1;
        leave = null;
      };
    },
  };
  return {
    env,
    stopped,
    /** Advance the clock, running the poll at every interval it crosses. */
    advance(ms: number) {
      const end = now + ms;
      while (now + SINK_POLL_MS <= end) {
        now += SINK_POLL_MS;
        const t = tick as (() => void) | null;
        if (t) t();
      }
      now = end;
    },
    leave() {
      const l = leave as (() => void) | null;
      if (l) l();
    },
    listening: () => tick !== null || leave !== null,
  };
}

test('both sinks ready: sent at once, nothing left running', () => {
  const h = harness(0);
  let sent = 0;
  whenSinksReady(() => (sent += 1), h.env);
  assert.equal(sent, 1);
  assert.equal(h.listening(), false);
});

test('a sink that arrives late: sent when it arrives, not before, and once', () => {
  const h = harness(120);
  let sent = 0;
  whenSinksReady(() => (sent += 1), h.env);
  assert.equal(sent, 0, 'not sent into a sink that is not there');
  h.advance(100);
  assert.equal(sent, 0);
  h.advance(50);
  assert.equal(sent, 1, 'sent on the first poll after the sink arrived');
  h.advance(10_000);
  h.leave();
  assert.equal(sent, 1);
  assert.deepEqual(h.stopped, { every: 1, onLeave: 1 });
  assert.equal(h.listening(), false);
});

test('a sink that never arrives: sent when the wait runs out', () => {
  const h = harness(null);
  let sent = 0;
  whenSinksReady(() => (sent += 1), h.env);
  h.advance(SINK_WAIT_MS - SINK_POLL_MS);
  assert.equal(sent, 0);
  h.advance(SINK_POLL_MS);
  assert.equal(sent, 1);
  h.advance(SINK_WAIT_MS);
  assert.equal(sent, 1);
  assert.equal(h.listening(), false);
});

test('the reader leaves during the wait: sent at once, and once', () => {
  const h = harness(null);
  let sent = 0;
  whenSinksReady(() => (sent += 1), h.env);
  h.advance(200);
  h.leave();
  assert.equal(sent, 1);
  h.advance(SINK_WAIT_MS);
  assert.equal(sent, 1);
  assert.equal(h.listening(), false);
});

test('cancelled during the wait: never sent, nothing left running', () => {
  const h = harness(300);
  let sent = 0;
  const cancel = whenSinksReady(() => (sent += 1), h.env);
  h.advance(100);
  cancel();
  h.advance(SINK_WAIT_MS);
  h.leave();
  assert.equal(sent, 0);
  assert.deepEqual(h.stopped, { every: 1, onLeave: 1 });
});

test('cancel after the send does nothing', () => {
  const h = harness(100);
  let sent = 0;
  const cancel = whenSinksReady(() => (sent += 1), h.env);
  h.advance(150);
  assert.equal(sent, 1);
  cancel();
  cancel();
  assert.equal(sent, 1);
});
