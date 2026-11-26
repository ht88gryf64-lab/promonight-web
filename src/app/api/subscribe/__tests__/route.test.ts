// Tests POST /api/subscribe against an in-memory fake Firestore with the email
// sender mocked, so the REAL route and the REAL upsertSubscriber run.
//
// The behavior under test is the delivery gate. sendEmail never throws: it
// returns {ok:false} on a missing API key, a Resend non-2xx, or a timeout. So a
// subscriber can hold a confirmToken that never reached them. These cases prove
// the route only stamps confirmationSentAt on a genuine send, that a failed send
// is visible rather than silent, and that the stranded record heals on the next
// submit including a teams-adding one.
//
// Run with:
//   node --import tsx --experimental-test-module-mocks --test <this file>

import { test, mock, beforeEach } from 'node:test';
import assert from 'node:assert';
import {
  coll,
  fakeDb,
  resetFirestore,
  state,
  writesTo,
  type Data,
} from '../../../../lib/__tests__/support/fake-firestore';

// ── mocked sender ───────────────────────────────────────────────────────────
// Mirrors the real SendResult contract from src/lib/email.ts: resolves with an
// ok flag, never rejects, unless a case explicitly opts into a throw.

type SendResult = { ok: boolean; id?: string; skipped?: boolean; error?: string };

let sendResult: SendResult = { ok: true, id: 'test-message-id' };
let sendThrows: Error | null = null;
type ReminderPromo = { title: string; teamName: string; date: string };
let sendCalls: Array<{ email: string; confirmToken: string; manageToken: string; reminder?: ReminderPromo | null }> = [];

// ── mocked reminder scheduler ───────────────────────────────────────────────
// The real one (src/lib/reminders.ts) reads the stored promo; its rules are
// covered in src/lib/__tests__/reminder-core.test.ts. Here it is a stand-in
// that keeps the one property the route depends on: one reminder per
// subscriber per promo, however many times it is asked.
type ScheduleResult = { outcome: 'scheduled' | 'too_late' | 'none'; promo?: ReminderPromo };
let scheduleResult: ScheduleResult = { outcome: 'scheduled', promo: { title: 'Winter Beanie', teamName: 'Minnesota Wild', date: '2026-12-05' } };
let scheduleThrows: Error | null = null;
let scheduleCalls: Array<{ subscriberId: string; teamId: string; promoId: string }> = [];
const reminderDocs = new Set<string>();

async function fakeScheduleReminderForSignup(input: { subscriberId: string; teamId: string; promoId: string; now: Date }): Promise<ScheduleResult> {
  scheduleCalls.push({ subscriberId: input.subscriberId, teamId: input.teamId, promoId: input.promoId });
  if (scheduleThrows) throw scheduleThrows;
  if (scheduleResult.outcome === 'scheduled') reminderDocs.add(`${input.subscriberId}_${input.promoId}`);
  return scheduleResult;
}

async function fakeSendConfirmationEmail(sub: {
  email: string;
  confirmToken: string;
  manageToken: string;
  reminder?: ReminderPromo | null;
}): Promise<SendResult> {
  sendCalls.push(sub);
  if (sendThrows) throw sendThrows;
  return sendResult;
}

mock.module('server-only', { namedExports: {} });
mock.module(new URL('../../../../lib/firebase.ts', import.meta.url).href, {
  namedExports: { db: fakeDb },
});
mock.module(new URL('../../../../lib/email.ts', import.meta.url).href, {
  namedExports: { sendConfirmationEmail: fakeSendConfirmationEmail },
});
mock.module(new URL('../../../../lib/reminders.ts', import.meta.url).href, {
  namedExports: { scheduleReminderForSignup: fakeScheduleReminderForSignup },
});

const EMAIL = 'newfan@example.com';

function post(body: unknown) {
  return new Request('https://www.getpromonight.com/api/subscribe', {
    method: 'POST',
    headers: { 'content-type': 'application/json', 'x-forwarded-for': '203.0.113.7' },
    body: JSON.stringify(body),
  });
}

function subscriberDoc(): Data {
  const docs = [...coll('subscribers').values()];
  assert.strictEqual(docs.length, 1, 'expected exactly one subscriber doc');
  return docs[0];
}

beforeEach(() => {
  resetFirestore();
  sendResult = { ok: true, id: 'test-message-id' };
  sendThrows = null;
  sendCalls = [];
  scheduleResult = { outcome: 'scheduled', promo: { title: 'Winter Beanie', teamName: 'Minnesota Wild', date: '2026-12-05' } };
  scheduleThrows = null;
  scheduleCalls = [];
  reminderDocs.clear();
});

// ── the happy path stamps delivery ──────────────────────────────────────────

test('a successful send stamps confirmationSentAt with a targeted write', async () => {
  const { POST } = await import('../route');

  const res = await POST(post({ email: EMAIL, teams: ['twins'], source: 'web_team_page' }));

  assert.strictEqual(res.status, 200);
  assert.deepStrictEqual(await res.json(), {
    ok: true,
    status: 'pending',
    created: true,
    team_count: 1,
    confirmation: 'sent',
    // No reminder was asked for (the field exists since 2026-11-26).
    reminder: 'none',
  });
  assert.strictEqual(sendCalls.length, 1, 'exactly one confirmation email');
  assert.ok(subscriberDoc().confirmationSentAt != null, 'delivery stamped');

  const stamp = writesTo('subscribers').filter((w) => w.data.confirmationSentAt != null).pop();
  assert.ok(stamp, 'expected a stamp write');
  assert.strictEqual(stamp.op, 'update');
  assert.deepStrictEqual(
    Object.keys(stamp.data).sort(),
    ['confirmationSentAt', 'confirmationSentFor'],
    'the delivery pair, written together, and still targeted so it cannot clobber a teams merge',
  );
  assert.strictEqual(
    stamp.data.confirmationSentFor,
    subscriberDoc().confirmToken,
    'the stamp names the token that was actually sent',
  );
});

// ── a failed send must not stamp, must be loud, must not fail the request ───

for (const [label, result] of [
  ['a provider error', { ok: false, error: 'resend_429' }],
  ['a skipped send with no API key', { ok: false, skipped: true }],
] as const) {
  test(`${label} leaves confirmationSentAt unset and still returns success`, async () => {
    sendResult = result;
    const { POST } = await import('../route');

    const res = await POST(post({ email: EMAIL, teams: ['twins'], source: 'web_team_page' }));

    assert.strictEqual(res.status, 200, 'the signup itself must still succeed');
    assert.strictEqual((await res.json()).ok, true);
    assert.strictEqual(
      subscriberDoc().confirmationSentAt,
      null,
      'no link was delivered, so nothing may be stamped',
    );
  });
}

test('a send that throws leaves confirmationSentAt unset and still returns success', async () => {
  sendThrows = new Error('socket hang up');
  const { POST } = await import('../route');

  const res = await POST(post({ email: EMAIL, teams: ['twins'], source: 'web_team_page' }));

  assert.strictEqual(res.status, 200);
  assert.strictEqual(subscriberDoc().confirmationSentAt, null);
});

test('the stamp write failing does not fail the request', async () => {
  const { POST } = await import('../route');
  // The upsert runs in a transaction, which the fake does not gate; only the
  // non-transactional stamp update is made to reject.
  state.failNextUpdate = new Error('firestore unavailable');

  const res = await POST(post({ email: EMAIL, teams: ['twins'], source: 'web_team_page' }));

  assert.strictEqual(res.status, 200, 'a failed stamp must never surface to the client');
  assert.strictEqual((await res.json()).ok, true);
  assert.strictEqual(sendCalls.length, 1);
});

// ── the stranding heals ─────────────────────────────────────────────────────

test('after a failed send, a teams-ADDING resubmit re-sends rather than suppressing', async () => {
  // The Finding 2 end-to-end. Before the delivery gate this second POST hit
  // teams_only, preserved the undelivered token, sent nothing, and left the
  // subscriber pending forever with a link they never received.
  sendResult = { ok: false, error: 'resend_429' };
  const { POST } = await import('../route');

  await POST(post({ email: EMAIL, teams: ['twins'], source: 'web_team_page' }));
  assert.strictEqual(sendCalls.length, 1);
  // Loose == null on purpose: against the pre-fix module the field does not
  // exist at all, and a strict null check would fail HERE, masking the real
  // signal below. This precondition must not be the thing that trips.
  assert.ok(subscriberDoc().confirmationSentAt == null, 'nothing delivered, nothing stamped');
  const firstToken = subscriberDoc().confirmToken;

  // The provider recovers, and the user adds a team.
  sendResult = { ok: true, id: 'second-message-id' };
  const res = await POST(post({ email: EMAIL, teams: ['yankees'], source: 'web_team_page' }));

  assert.strictEqual(res.status, 200);
  assert.strictEqual(sendCalls.length, 2, 'the undelivered subscriber must get a real email');
  assert.notStrictEqual(subscriberDoc().confirmToken, firstToken, 'token rotated');
  assert.ok(subscriberDoc().confirmationSentAt != null, 'now delivered, so now stamped');
  assert.deepStrictEqual(subscriberDoc().teams, ['twins', 'yankees'], 'teams still merged');
});

test('after a successful send, a teams-ADDING resubmit suppresses and keeps the token', async () => {
  // The counterpart. Delivery happened, so the second submit must NOT re-send
  // and must NOT rotate, which is the whole point of the branch.
  const { POST } = await import('../route');

  await POST(post({ email: EMAIL, teams: ['twins'], source: 'web_team_page' }));
  const firstToken = subscriberDoc().confirmToken;
  const firstStamp = subscriberDoc().confirmationSentAt;

  const res = await POST(post({ email: EMAIL, teams: ['yankees'], source: 'web_team_page' }));

  assert.strictEqual(res.status, 200);
  assert.strictEqual(sendCalls.length, 1, 'no duplicate confirmation');
  assert.strictEqual(subscriberDoc().confirmToken, firstToken, 'the emailed link survives');
  assert.strictEqual(subscriberDoc().confirmationSentAt, firstStamp, 'stamp untouched');
  assert.deepStrictEqual(subscriberDoc().teams, ['twins', 'yankees']);
});

// ── the confirmation enum ───────────────────────────────────────────────────
// Every branch must report what actually happened, because the success copy is
// chosen from this value. A wrong value here is a lie rendered to a user.

for (const [label, result, expected] of [
  ['a provider error', { ok: false, error: 'resend_429' }, 'failed'],
  ['a timeout', { ok: false, error: 'send_timeout' }, 'failed'],
  ['a skipped send', { ok: false, skipped: true }, 'failed'],
] as const) {
  test(`${label} reports confirmation=${expected}`, async () => {
    sendResult = result;
    const { POST } = await import('../route');

    const res = await POST(post({ email: EMAIL, teams: ['twins'], source: 'web_team_page' }));

    assert.strictEqual((await res.json()).confirmation, expected);
  });
}

test('a send that throws reports confirmation=failed', async () => {
  sendThrows = new Error('socket hang up');
  const { POST } = await import('../route');

  const res = await POST(post({ email: EMAIL, teams: ['twins'], source: 'web_team_page' }));

  assert.strictEqual((await res.json()).confirmation, 'failed');
});

test('an already-confirmed re-submit reports not_needed WITH status confirmed', async () => {
  // The pair the client splits on. status is what separates this from a
  // suppressed re-submit, and it is already in the response, so no extra field
  // was needed.
  const { POST } = await import('../route');
  const { confirmSubscriberByToken } = await import('../../../../lib/subscribers');

  await POST(post({ email: EMAIL, teams: ['twins'], source: 'web_team_page' }));
  const token = subscriberDoc().confirmToken as string;
  await confirmSubscriberByToken(token);
  sendCalls = [];

  const res = await POST(post({ email: EMAIL, teams: ['yankees'], source: 'web_team_page' }));
  const body = await res.json();

  assert.strictEqual(body.confirmation, 'not_needed');
  assert.strictEqual(body.status, 'confirmed', 'this is what selects the already-subscribed copy');
  assert.strictEqual(sendCalls.length, 0, 'and nothing was sent');
});

test('a suppressed re-submit reports not_needed WITH status pending', async () => {
  const { POST } = await import('../route');

  await POST(post({ email: EMAIL, teams: ['twins'], source: 'web_team_page' }));
  const res = await POST(post({ email: EMAIL, teams: ['yankees'], source: 'web_team_page' }));
  const body = await res.json();

  assert.strictEqual(body.confirmation, 'not_needed');
  assert.strictEqual(body.status, 'pending', 'which renders the confident copy, not already-subscribed');
});

test('the suppressed response is byte-identical to a sending one apart from created', async () => {
  const { POST } = await import('../route');
  await POST(post({ email: EMAIL, teams: ['twins'], source: 'web_team_page' }));

  const res = await POST(post({ email: EMAIL, teams: ['yankees'], source: 'web_team_page' }));

  assert.strictEqual(res.status, 200);
  assert.deepStrictEqual(await res.json(), {
    ok: true,
    status: 'pending',
    created: false,
    team_count: 2,
    confirmation: 'not_needed',
    reminder: 'none',
  });
});

// ── no IP-derived location is stored (2026-10-07) ──────────────────────────

test('a signup with every Vercel geo header present stores no location at all', async () => {
  const { POST } = await import('../route');
  const withGeo = new Request('https://www.getpromonight.com/api/subscribe', {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      'x-forwarded-for': '203.0.113.7',
      'x-vercel-ip-city': 'Saint%20Paul',
      'x-vercel-ip-country-region': 'MN',
      'x-vercel-ip-latitude': '44.9537',
      'x-vercel-ip-longitude': '-93.09',
    },
    body: JSON.stringify({ email: EMAIL, teams: ['twins'], source: 'web_team_page' }),
  });

  const res = await POST(withGeo);
  assert.strictEqual(res.status, 200);

  const doc = subscriberDoc();
  for (const key of ['geoCity', 'geoRegion', 'geoLat', 'geoLng']) {
    assert.ok(!(key in doc), `subscriber doc carries ${key}`);
  }
  // Belt and braces: no header value reached the record under any key.
  const written = JSON.stringify(doc);
  for (const leak of ['44.9537', '-93.09', 'Saint Paul', 'Saint%20Paul', '"MN"']) {
    assert.ok(!written.includes(leak), `subscriber doc carries ${leak}`);
  }
  // Nor did any write in the request touch a geo field.
  for (const w of writesTo('subscribers')) {
    const data = JSON.stringify(w);
    assert.ok(!/geo(City|Region|Lat|Lng)/.test(data), `a write touched a geo field: ${data}`);
  }
});

// ── the promo page's reminder (Gate 1 rulings, 2026-11-26) ───────────────────

const REMIND = { email: EMAIL, teams: ['minnesota-wild'], source: 'web_promo_page', reminder: { teamId: 'minnesota-wild', promoId: 'c7057219198efd77' } };

test('a reminder signup: subscriber upserted, the team followed, source web_promo_page, the reminder scheduled and named in the confirmation email', async () => {
  const { POST } = await import('../route');
  const res = await POST(post(REMIND));
  const json = await res.json();
  assert.strictEqual(res.status, 200);
  assert.strictEqual(json.reminder, 'scheduled');
  assert.strictEqual(json.confirmation, 'sent');
  const doc = subscriberDoc();
  assert.deepStrictEqual(doc.teams, ['minnesota-wild']);
  assert.strictEqual(doc.source, 'web_promo_page', 'stored as its own surface, not web_other');
  assert.strictEqual(doc.status, 'pending', 'still double opt-in');
  const id = [...coll('subscribers').keys()][0];
  assert.deepStrictEqual(scheduleCalls, [{ subscriberId: id, teamId: 'minnesota-wild', promoId: 'c7057219198efd77' }]);
  assert.deepStrictEqual(sendCalls[0].reminder, { title: 'Winter Beanie', teamName: 'Minnesota Wild', date: '2026-12-05' });
});

test('a double submit is one subscriber, the team followed once, and one reminder', async () => {
  const { POST } = await import('../route');
  await POST(post(REMIND));
  const second = await (await POST(post(REMIND))).json();
  assert.strictEqual(second.reminder, 'scheduled');
  assert.strictEqual(coll('subscribers').size, 1);
  assert.deepStrictEqual(subscriberDoc().teams, ['minnesota-wild'], 'no duplicate team');
  assert.strictEqual(reminderDocs.size, 1, 'one reminder per subscriber per promo');
});

test('too late from a stale page: the signup goes through, the answer is too_late, and the confirmation email names no reminder', async () => {
  scheduleResult = { outcome: 'too_late' };
  const { POST } = await import('../route');
  const res = await POST(post(REMIND));
  const json = await res.json();
  assert.strictEqual(res.status, 200);
  assert.strictEqual(json.ok, true);
  assert.strictEqual(json.reminder, 'too_late');
  assert.strictEqual(coll('subscribers').size, 1, 'the weekly signup still happened');
  assert.strictEqual(reminderDocs.size, 0);
  assert.strictEqual(sendCalls.length, 1);
  assert.ok(!('reminder' in sendCalls[0]) || sendCalls[0].reminder == null, 'no reminder in the confirmation email');
});

test('no reminder in the body: the scheduler is never asked, the answer is none, the confirmation email is the plain one', async () => {
  const { POST } = await import('../route');
  const json = await (await POST(post({ email: EMAIL, teams: ['minnesota-wild'], source: 'web_promo_page' }))).json();
  assert.strictEqual(json.reminder, 'none');
  assert.strictEqual(scheduleCalls.length, 0);
  assert.ok(!('reminder' in sendCalls[0]));
});

test('a failing scheduler never fails the signup', async () => {
  scheduleThrows = new Error('firestore unavailable');
  const { POST } = await import('../route');
  const res = await POST(post(REMIND));
  const json = await res.json();
  assert.strictEqual(res.status, 200);
  assert.strictEqual(json.ok, true);
  assert.strictEqual(json.reminder, 'none');
  assert.strictEqual(coll('subscribers').size, 1);
});

test('a malformed reminder is ignored, never used to build a document path', async () => {
  const { POST } = await import('../route');
  for (const reminder of [
    'c7057219198efd77',
    { teamId: 'minnesota-wild' },
    { teamId: 'minnesota-wild', promoId: 'a/b' },
    { teamId: 'minnesota-wild', promoId: '../x' },
    { teamId: 'Minnesota Wild', promoId: 'c7057219198efd77' },
    { teamId: 'teams/x', promoId: 'c7057219198efd77' },
    { teamId: 'minnesota-wild', promoId: 'x'.repeat(65) },
    { teamId: 'minnesota-wild', promoId: 42 },
  ]) {
    resetFirestore();
    const json = await (await POST(post({ ...REMIND, reminder }))).json();
    assert.strictEqual(json.ok, true);
    assert.strictEqual(json.reminder, 'none', JSON.stringify(reminder));
  }
  assert.strictEqual(scheduleCalls.length, 0);
});

test('an already-confirmed subscriber gets the reminder with no confirmation email', async () => {
  const { POST } = await import('../route');
  await POST(post({ email: EMAIL, teams: [], source: 'web_homepage' }));
  const id = [...coll('subscribers').keys()][0];
  coll('subscribers').set(id, { ...coll('subscribers').get(id)!, status: 'confirmed' });
  sendCalls = [];
  const json = await (await POST(post(REMIND))).json();
  assert.strictEqual(json.status, 'confirmed');
  assert.strictEqual(json.confirmation, 'not_needed');
  assert.strictEqual(json.reminder, 'scheduled');
  assert.strictEqual(sendCalls.length, 0);
  assert.deepStrictEqual(subscriberDoc().teams, ['minnesota-wild']);
  assert.strictEqual(subscriberDoc().source, 'web_homepage', 'the first source is kept');
});
