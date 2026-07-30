// Proves the confirmation send is BOUNDED.
//
// Unbounded, a hung Resend keeps the invocation alive until the platform kills
// it, and a killed invocation runs no catch, flushes no console.error, writes no
// request log line, and leaves no Resend record. The signup disappears with no
// trace. That happened in production on 2026-07-30. Bounded, the same hang
// surfaces as {ok:false, error:'send_timeout'}, which the route logs and which
// leaves confirmationSentAt unset so the next submit re-sends.
//
// fetch is stubbed rather than mocked at module level, because the behavior
// under test is the AbortSignal wiring inside sendEmail.
//
// Run with:
//   node --import tsx --experimental-test-module-mocks --test <this file>

import { test, mock, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert';

mock.module('server-only', { namedExports: {} });

const realFetch = globalThis.fetch;
let seenSignals: Array<AbortSignal | undefined> = [];

// A fetch that never settles on its own. It rejects with the DOMException the
// platform raises on abort, so the abort path is exercised for real rather than
// simulated with a plain Error.
function hangingFetch(): typeof globalThis.fetch {
  return ((_url: string | URL | Request, init?: RequestInit) => {
    const signal = init?.signal ?? undefined;
    seenSignals.push(signal);
    return new Promise((_resolve, reject) => {
      if (!signal) return; // never settles, which is the unbounded case
      signal.addEventListener('abort', () => {
        const err = new Error('The operation was aborted.');
        err.name = 'AbortError';
        reject(err);
      });
    });
  }) as typeof globalThis.fetch;
}

beforeEach(() => {
  seenSignals = [];
  process.env.RESEND_API_KEY = 'test-key';
  globalThis.fetch = hangingFetch();
});

afterEach(() => {
  globalThis.fetch = realFetch;
  delete process.env.RESEND_API_KEY;
});

test('sendEmail aborts on timeout and reports send_timeout', async () => {
  const { sendEmail } = await import('../email');

  const res = await sendEmail({
    to: 'fan@example.com',
    subject: 's',
    html: '<p>h</p>',
    text: 't',
    timeoutMs: 25,
  });

  assert.strictEqual(res.ok, false);
  assert.strictEqual(
    res.error,
    'send_timeout',
    'the route branches on this exact value to log the failure',
  );
  assert.notStrictEqual(res.skipped, true, 'a timeout is a failure, not a skip');
});

test('sendEmail WITHOUT a timeout never settles, which is the production hazard', async () => {
  // Documents why the timeout matters. With no timeoutMs no AbortController is
  // armed (email.ts), so a hung provider leaves the promise pending forever and
  // the platform eventually kills the invocation with no error and no log.
  const { sendEmail } = await import('../email');

  const settled = await Promise.race([
    sendEmail({ to: 'fan@example.com', subject: 's', html: '<p>h</p>', text: 't' }),
    new Promise((r) => setTimeout(() => r('STILL_PENDING'), 60)),
  ]);

  assert.strictEqual(settled, 'STILL_PENDING', 'unbounded sends do not settle on their own');
  assert.strictEqual(seenSignals[0], undefined, 'and no AbortSignal was ever attached');
});

test('sendConfirmationEmail passes an AbortSignal, so the signup send is bounded', async () => {
  // The regression guard for the actual defect. Before the fix this call passed
  // no timeoutMs, so fetch received no signal.
  const { sendConfirmationEmail } = await import('../email');

  const pending = sendConfirmationEmail({
    email: 'fan@example.com',
    confirmToken: 'seededConfirmToken0123456789abcd',
    manageToken: 'seededManageToken0123456789abcde',
  });

  // The signal is attached synchronously when fetch is invoked, so it is
  // observable without waiting out the full 8s production timeout.
  await new Promise((r) => setTimeout(r, 10));

  assert.strictEqual(seenSignals.length, 1, 'exactly one send attempt');
  assert.ok(
    seenSignals[0] instanceof AbortSignal,
    'the signup send MUST be bounded: no signal means a hang cannot be recovered or logged',
  );
  assert.strictEqual(seenSignals[0]?.aborted, false, 'not aborted yet, the timer is still running');

  // Leave no dangling handle: abort it and let the call settle.
  const res = await Promise.race([
    pending,
    new Promise((r) => setTimeout(() => r('pending'), 20)),
  ]);
  assert.strictEqual(res, 'pending', 'still in flight well inside the 8s budget');
});

test('a missing API key is still reported as skipped, not as a timeout', async () => {
  delete process.env.RESEND_API_KEY;
  const { sendEmail } = await import('../email');

  const res = await sendEmail({
    to: 'fan@example.com',
    subject: 's',
    html: '<p>h</p>',
    text: 't',
    timeoutMs: 25,
  });

  assert.strictEqual(res.ok, false);
  assert.strictEqual(res.skipped, true);
  assert.strictEqual(res.error, undefined, 'the route distinguishes these two in its log line');
});
