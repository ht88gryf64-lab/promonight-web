// Tests GET /api/cron/promo-reminders: auth, the dry-run default, the execute
// guards and the operator alert. The REAL route and the REAL lib/reminder-alert
// run; the run itself (src/lib/reminder-core.ts runReminders, covered on its
// own) and the Firestore adapter are module-mocked, so nothing here reads or
// writes Firestore or reaches Resend.
//
// Run with:
//   node --import tsx --experimental-test-module-mocks --test <this file>

import { test, mock, beforeEach } from 'node:test';
import assert from 'node:assert';

const OPERATOR = 'kovalikdigital@gmail.com';

type Summary = Record<string, unknown> & { scheduled: number; toSend: number; sent: number; failed: number; stuckSending: number; ceiling: number; aborted?: string };
const base = (over: Partial<Summary> = {}): Summary => ({ mode: 'dry-run', scheduled: 0, due: 0, toSend: 0, sent: 0, failed: 0, moved: 0, followed: 0, waitingUnconfirmed: 0, cancelled: {}, stuckSending: 0, ceiling: 500, withinCeiling: true, ...over });

let runCalls: Array<{ execute: boolean; overCap?: boolean }> = [];
let runResult: Summary | Error = base();
let emailCalls: Array<{ to: string; subject: string; text: string; html?: string }> = [];
let senderConfigured = true;

mock.module('server-only', { namedExports: {} });
mock.module(new URL('../../../../../lib/reminders.ts', import.meta.url).href, {
  namedExports: { firestoreReminderDeps: () => ({}) },
});
mock.module(new URL('../../../../../lib/reminder-core.ts', import.meta.url).href, {
  namedExports: {
    runReminders: async (_deps: unknown, opts: { execute: boolean; overCap?: boolean }) => {
      runCalls.push({ execute: opts.execute, overCap: opts.overCap });
      if (runResult instanceof Error) throw runResult;
      return { ...runResult, mode: opts.execute ? 'execute' : 'dry-run' };
    },
  },
});
mock.module(new URL('../../../../../lib/email.ts', import.meta.url).href, {
  namedExports: {
    isSenderConfigured: () => senderConfigured,
    sendEmail: async (a: { to: string; subject: string; text: string; html?: string }) => {
      emailCalls.push(a);
      return { ok: true, id: 'alert' };
    },
  },
});

const get = (qs = '', auth: string | null = 'Bearer s3cret') =>
  new Request(`https://www.getpromonight.com/api/cron/promo-reminders${qs}`, { headers: auth ? { authorization: auth } : {} });

beforeEach(() => {
  process.env.CRON_SECRET = 's3cret';
  process.env.RESEND_API_KEY = 'key';
  runCalls = [];
  runResult = base();
  emailCalls = [];
  senderConfigured = true;
});

test('no secret configured is a 503 and a wrong bearer a 401; neither runs anything or alerts', async () => {
  const { GET } = await import('../route');
  assert.strictEqual((await GET(get('?execute=true', 'Bearer wrong'))).status, 401);
  assert.strictEqual((await GET(get('?execute=true', null))).status, 401);
  delete process.env.CRON_SECRET;
  assert.strictEqual((await GET(get('?execute=true'))).status, 503);
  assert.strictEqual(runCalls.length, 0);
  assert.strictEqual(emailCalls.length, 0);
});

test('the default is a dry run: without ?execute=true the run is asked not to execute', async () => {
  const { GET } = await import('../route');
  const res = await GET(get());
  const json = await res.json();
  assert.strictEqual(res.status, 200);
  assert.deepStrictEqual(runCalls, [{ execute: false, overCap: false }]);
  assert.strictEqual(json.mode, 'dry-run');
  assert.strictEqual(json.ok, true);
  assert.strictEqual(json.toSend, 0);
  // execute=1, execute=TRUE and a stray param are all still dry runs.
  for (const qs of ['?execute=1', '?execute=TRUE', '?run=true']) await GET(get(qs));
  assert.ok(runCalls.every((c) => c.execute === false));
  assert.strictEqual(emailCalls.length, 0);
});

test('the response and the alert carry counts, never an address', async () => {
  runResult = base({ scheduled: 4, due: 2, toSend: 2, sent: 1, failed: 1 });
  const { GET } = await import('../route');
  const res = await GET(get('?execute=true'));
  const json = await res.json();
  assert.strictEqual(json.ok, false, 'a run with a failed send is not ok');
  assert.ok(!JSON.stringify(json).includes('@'));
  assert.strictEqual(emailCalls.length, 1, 'one alert');
  assert.strictEqual(emailCalls[0].to, OPERATOR);
  assert.strictEqual(emailCalls[0].subject, '[PromoNight] Promo reminders: send_failures');
  assert.ok(emailCalls[0].text.includes('1 of 2 sends failed.'));
  assert.ok(emailCalls[0].text.includes('Sent: 1') && emailCalls[0].text.includes('Failed: 1'));
  assert.strictEqual(emailCalls[0].html, undefined, 'plain text ops mail');
  assert.ok(!emailCalls[0].text.replace(OPERATOR, '').includes('@'));
});

test('execute refuses with 409 and alerts when the sender is not configured, before anything runs', async () => {
  const { GET } = await import('../route');
  senderConfigured = false;
  const res = await GET(get('?execute=true'));
  assert.strictEqual(res.status, 409);
  assert.strictEqual((await res.json()).reason, 'sender_not_configured');
  assert.strictEqual(runCalls.length, 0);
  assert.strictEqual(emailCalls.length, 1);
  // A dry run does not need a sender.
  emailCalls = [];
  assert.strictEqual((await GET(get())).status, 200);
  assert.strictEqual(emailCalls.length, 0);
  // Nor without the API key.
  senderConfigured = true;
  delete process.env.RESEND_API_KEY;
  assert.strictEqual((await GET(get('?execute=true'))).status, 409);
});

test('over the per-run ceiling is a 409 and one alert; &overCap=true is passed through', async () => {
  runResult = base({ scheduled: 600, due: 600, toSend: 600, withinCeiling: false, aborted: 'exceeds_send_ceiling' });
  const { GET } = await import('../route');
  const res = await GET(get('?execute=true'));
  assert.strictEqual(res.status, 409);
  assert.strictEqual((await res.json()).reason, 'exceeds_send_ceiling');
  assert.strictEqual(emailCalls.length, 1);
  assert.ok(emailCalls[0].text.includes('600 reminders are due, above the 500 per-run ceiling.'));
  assert.ok(!emailCalls[0].text.includes('Sent:'), 'nothing was attempted');
  runResult = base({ scheduled: 600, toSend: 600, sent: 600 });
  await GET(get('?execute=true&overCap=true'));
  assert.deepStrictEqual(runCalls[1], { execute: true, overCap: true });
});

test('an exception is a 500 and one alert; a reminder stuck in sending alerts on an execute run only', async () => {
  const { GET } = await import('../route');
  runResult = new Error('firestore unavailable');
  const res = await GET(get('?execute=true'));
  assert.strictEqual(res.status, 500);
  assert.strictEqual(emailCalls.length, 1);
  assert.ok(emailCalls[0].subject.endsWith('exception') && emailCalls[0].text.includes('firestore unavailable'));
  emailCalls = [];
  runResult = base({ scheduled: 1, stuckSending: 2 });
  assert.strictEqual((await GET(get())).status, 200);
  assert.strictEqual(emailCalls.length, 0, 'a dry run reports it in the response only');
  await GET(get('?execute=true'));
  assert.strictEqual(emailCalls.length, 1);
  assert.ok(emailCalls[0].subject.endsWith('stuck_sending'));
});

test('a clean execute run alerts nobody', async () => {
  runResult = base({ scheduled: 3, due: 1, toSend: 1, sent: 1 });
  const { GET } = await import('../route');
  const res = await GET(get('?execute=true'));
  assert.strictEqual(res.status, 200);
  assert.strictEqual((await res.json()).ok, true);
  assert.strictEqual(emailCalls.length, 0);
});
