// Tests GET /api/cron/weekly-digest: the send safety ceiling and the operator
// alert. The REAL route and the REAL lib/digest-alert run; the subscriber
// store, window data and sender are module-mocked, so nothing here reads or
// writes Firestore or reaches Resend.
//
// The alert path is observed at sendEmail: every call addressed to the
// operator inbox is one notification. The digest senders are separate mocks,
// so a recipient send is never miscounted as an alert.
//
// Run with:
//   node --import tsx --experimental-test-module-mocks --test <this file>

import { test, mock, beforeEach } from 'node:test';
import assert from 'node:assert';

type SendResult = { ok: boolean; id?: string; skipped?: boolean; error?: string };
type Sub = { id: string; email: string; teams: string[]; manageToken: string; updatedAt?: string };

const OPERATOR = 'kovalikdigital@gmail.com';
const CEILING = 5000;

// ── mocked state ────────────────────────────────────────────────────────────
let subscribers: Sub[] = [];
let claimResult = true;
let claimThrows: Error | null = null;
let claimCalls = 0;
let digestSends = 0;
let digestSendResult: SendResult = { ok: true, id: 'digest-id' };
let emailCalls: Array<{ to: string; subject: string; text: string; html?: string }> = [];
let alertSendThrows: Error | null = null;

function makeSubs(n: number): Sub[] {
  return Array.from({ length: n }, (_, i) => ({
    id: `id${i}`,
    email: `fan${i}@example.com`,
    teams: [],
    manageToken: `tok${i}`,
  }));
}

const digestSender = async () => {
  digestSends++;
  return digestSendResult;
};

mock.module('server-only', { namedExports: {} });
mock.module(new URL('../../../../../lib/subscribers.ts', import.meta.url).href, {
  namedExports: {
    getConfirmedSubscribers: async () => subscribers,
    // Identity: dedupe is not under test here and must not hide the count.
    dedupeByDeliveryInbox: (s: Sub[]) => s,
    claimDigestRun: async () => {
      claimCalls++;
      if (claimThrows) throw claimThrows;
      return claimResult;
    },
    subscriberDocId: (e: string) => `hash(${e})`,
  },
});
mock.module(new URL('../../../../../lib/digest.ts', import.meta.url).href, {
  namedExports: {
    digestWindow: () => ({ start: '2026-11-10', end: '2026-11-16' }),
    fetchWindowPromos: async () => [],
    personalizedFor: () => ({ promos: [], total: 0 }),
    genericFeatured: () => [],
    DIGEST_COLLECTIONS: [],
  },
});
mock.module(new URL('../../../../../lib/data.ts', import.meta.url).href, {
  namedExports: {
    getAllTeams: async () => [],
    getTeamVenueCoords: async () => new Map(),
    getSchemaLocationsForTeams: async () => new Map(),
  },
});
mock.module(new URL('../../../../../lib/geo/local-promos.ts', import.meta.url).href, {
  namedExports: {
    resolveLocalAnchor: () => ({ anchor: { city: null }, localPromos: [], level: 'national-fallback' }),
    buildTeamCityMap: () => new Map(),
  },
});
mock.module(new URL('../../../../../lib/team-display-name.ts', import.meta.url).href, {
  namedExports: { teamDisplayName: (t: { name?: string }) => t.name ?? '' },
});
mock.module(new URL('../../../../../lib/email.ts', import.meta.url).href, {
  namedExports: {
    isSenderConfigured: () => true,
    sendPersonalizedDigest: digestSender,
    sendGenericDigest: digestSender,
    sendEmptyWindowDigest: digestSender,
    // Used only by lib/digest-alert.ts.
    sendEmail: async (args: { to: string; subject: string; text: string; html?: string }) => {
      emailCalls.push(args);
      if (alertSendThrows) throw alertSendThrows;
      return { ok: true, id: 'alert-id' } satisfies SendResult;
    },
  },
});

const alerts = () => emailCalls.filter((c) => c.to === OPERATOR);

function get(query = '?execute=true') {
  return new Request(`https://www.getpromonight.com/api/cron/weekly-digest${query}`, {
    headers: { authorization: 'Bearer test-secret' },
  });
}

beforeEach(() => {
  process.env.CRON_SECRET = 'test-secret';
  process.env.RESEND_API_KEY = 're_test';
  subscribers = makeSubs(114);
  claimResult = true;
  claimThrows = null;
  claimCalls = 0;
  digestSends = 0;
  digestSendResult = { ok: true, id: 'digest-id' };
  emailCalls = [];
  alertSendThrows = null;
});

// ── the ceiling ─────────────────────────────────────────────────────────────

test('above the ceiling, execute aborts 409 without claiming the window or sending', async () => {
  subscribers = makeSubs(CEILING + 1);
  const { GET } = await import('../route');
  const res = await GET(get());
  const body = await res.json();
  assert.strictEqual(res.status, 409);
  assert.strictEqual(body.reason, 'exceeds_send_ceiling');
  assert.strictEqual(body.total, CEILING + 1);
  assert.strictEqual(body.sendCeiling, CEILING);
  assert.strictEqual(body.withinCeiling, false);
  assert.strictEqual(claimCalls, 0, 'must abort before the idempotency claim');
  assert.strictEqual(digestSends, 0);
});

test('exactly at the ceiling is within it', async () => {
  subscribers = makeSubs(CEILING);
  const { GET } = await import('../route');
  const res = await GET(get(''));
  const body = await res.json();
  assert.strictEqual(body.withinCeiling, true);
});

test('below the ceiling (the 114 that the old 100 cap blocked) sends to everyone, no alert', async () => {
  const { GET } = await import('../route');
  const res = await GET(get());
  const body = await res.json();
  assert.strictEqual(res.status, 200);
  assert.strictEqual(body.ok, true);
  assert.strictEqual(body.withinCeiling, true);
  assert.strictEqual(body.sent, 114);
  assert.strictEqual(body.failed, 0);
  assert.strictEqual(digestSends, 114);
  assert.strictEqual(claimCalls, 1);
  assert.strictEqual(alerts().length, 0);
});

test('the summary no longer carries any free-tier field', async () => {
  const { GET } = await import('../route');
  const body = await (await GET(get(''))).json();
  assert.ok(!('freeTierCap' in body));
  assert.ok(!('withinFreeTier' in body));
});

// ── the alert ───────────────────────────────────────────────────────────────

test('an abort fires exactly one plain-text notification with reason, count and window', async () => {
  subscribers = makeSubs(CEILING + 1);
  const { GET } = await import('../route');
  await GET(get());
  const sent = alerts();
  assert.strictEqual(sent.length, 1);
  const [a] = sent;
  assert.strictEqual(a.html, undefined, 'plain text only');
  assert.match(a.subject, /exceeds_send_ceiling/);
  assert.match(a.text, /Reason: exceeds_send_ceiling/);
  assert.match(a.text, new RegExp(`Recipients: ${CEILING + 1}`));
  assert.match(a.text, /Window: 2026-11-10 to 2026-11-16/);
  assert.ok(!a.text.includes('@example.com'), 'never names a subscriber');
});

test('the already-executed abort also alerts exactly once', async () => {
  claimResult = false;
  const { GET } = await import('../route');
  const res = await GET(get());
  assert.strictEqual(res.status, 409);
  assert.strictEqual(digestSends, 0);
  assert.strictEqual(alerts().length, 1);
  assert.match(alerts()[0].text, /Reason: already_executed_this_window/);
});

test('a thrown exception returns 500 and alerts exactly once', async () => {
  claimThrows = new Error('firestore unavailable');
  const { GET } = await import('../route');
  const res = await GET(get());
  const body = await res.json();
  assert.strictEqual(res.status, 500);
  assert.strictEqual(body.reason, 'exception');
  assert.strictEqual(alerts().length, 1);
  assert.match(alerts()[0].text, /Detail: firestore unavailable/);
  assert.match(alerts()[0].text, /Recipients: 114/);
});

test('a failing alert send cannot mask the original abort', async () => {
  subscribers = makeSubs(CEILING + 1);
  alertSendThrows = new Error('resend down');
  const { GET } = await import('../route');
  const res = await GET(get());
  const body = await res.json();
  assert.strictEqual(res.status, 409);
  assert.strictEqual(body.reason, 'exceeds_send_ceiling');
  assert.strictEqual(alerts().length, 1, 'tried once, no retry loop');
});

test('a failing alert send on the exception path still returns the original error', async () => {
  claimThrows = new Error('firestore unavailable');
  alertSendThrows = new Error('resend down');
  const { GET } = await import('../route');
  const res = await GET(get());
  const body = await res.json();
  assert.strictEqual(res.status, 500);
  assert.strictEqual(body.detail, 'firestore unavailable');
  assert.strictEqual(alerts().length, 1);
});

test('failed recipient sends produce one alert for the run, not one per recipient', async () => {
  digestSendResult = { ok: false, error: 'resend_500' };
  const { GET } = await import('../route');
  const body = await (await GET(get())).json();
  assert.strictEqual(body.failed, 114);
  assert.strictEqual(alerts().length, 1);
  assert.match(alerts()[0].text, /Failed: 114/);
});

test('a dry run above the ceiling reports it but does not alert', async () => {
  subscribers = makeSubs(CEILING + 1);
  const { GET } = await import('../route');
  const res = await GET(get(''));
  const body = await res.json();
  assert.strictEqual(res.status, 200);
  assert.strictEqual(body.mode, 'dry-run');
  assert.strictEqual(alerts().length, 0);
  assert.strictEqual(digestSends, 0);
});

test('an unauthenticated request does not alert', async () => {
  const { GET } = await import('../route');
  const res = await GET(
    new Request('https://www.getpromonight.com/api/cron/weekly-digest?execute=true'),
  );
  assert.strictEqual(res.status, 401);
  assert.strictEqual(alerts().length, 0);
});
