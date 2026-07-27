// Tests POST /api/log-request against an in-memory fake Firestore, so the real
// route module runs and the EXACT write shape is asserted rather than assumed.
//
// The write shape is the whole product here: if the doc id is not the UTC hour,
// or the increment lands on the wrong key, or merge is dropped, the counter
// still looks healthy while producing a wrong number. Every one of those is
// asserted below.
//
// firebase + server-only are module-mocked, same pattern as
// src/lib/__tests__/tombstone-filter.test.ts. Run with:
//   node --import tsx --experimental-test-module-mocks --test <this file>

import { test, mock, beforeEach } from 'node:test';
import assert from 'node:assert';

// ── fake Firestore ──────────────────────────────────────────────────────────
// Captures calls instead of performing them. FieldValue.increment and
// Timestamp.fromDate come from the REAL firebase-admin, so the sentinel objects
// in the captured payload are the genuine ones.

type SetCall = { collection: string; doc: string; data: Record<string, unknown>; options: unknown };
type AddCall = { collection: string; data: Record<string, unknown> };

let setCalls: SetCall[] = [];
let addCalls: AddCall[] = [];
let failSetWith: Error | null = null;
let failAddWith: Error | null = null;

const fakeDb = {
  collection(collection: string) {
    return {
      doc(docId: string) {
        return {
          async set(data: Record<string, unknown>, options: unknown) {
            if (failSetWith) throw failSetWith;
            setCalls.push({ collection, doc: docId, data, options });
          },
        };
      },
      async add(data: Record<string, unknown>) {
        if (failAddWith) throw failAddWith;
        addCalls.push({ collection, data });
        return { id: 'fake-generated-id' };
      },
    };
  },
};

mock.module('server-only', { namedExports: {} });
mock.module(new URL('../../../../lib/firebase.ts', import.meta.url).href, {
  namedExports: { db: fakeDb },
});

const SECRET = 'test-secret-value';

function post(body: unknown, opts: { secret?: string | null } = {}) {
  const headers: Record<string, string> = { 'content-type': 'application/json' };
  const s = opts.secret === undefined ? SECRET : opts.secret;
  if (s !== null) headers['x-request-log-secret'] = s;
  return new Request('https://www.getpromonight.com/api/log-request', {
    method: 'POST',
    headers,
    body: typeof body === 'string' ? body : JSON.stringify(body),
  });
}

beforeEach(() => {
  setCalls = [];
  addCalls = [];
  failSetWith = null;
  failAddWith = null;
  process.env.REQUEST_LOG_SECRET = SECRET;
});

// ── auth and configuration ─────────────────────────────────────────────────

test('204 with a NULL body when REQUEST_LOG_SECRET is unset', async () => {
  // This branch is hit on EVERY request until the env var exists in Vercel, so
  // it is the one branch that must not throw. A 204 carrying a body throws in
  // the Response constructor ("Invalid response status code 204"), which is a
  // latent bug in the sibling /api/log-crawler-hit route. Asserting the body is
  // empty here is what stops that bug being copied back in.
  delete process.env.REQUEST_LOG_SECRET;
  const { POST } = await import('../route');
  const res = await POST(post({ traffic_class: 'human', request_type: 'document' }));
  assert.strictEqual(res.status, 204);
  assert.strictEqual(await res.text(), '', 'a 204 must carry no body');
  assert.strictEqual(setCalls.length, 0, 'nothing written when unconfigured');
});

test('401 on a wrong or missing secret, and nothing is written', async () => {
  const { POST } = await import('../route');

  const wrong = await POST(post({ traffic_class: 'human', request_type: 'document' }, { secret: 'nope' }));
  assert.strictEqual(wrong.status, 401);

  const missing = await POST(post({ traffic_class: 'human', request_type: 'document' }, { secret: null }));
  assert.strictEqual(missing.status, 401);

  assert.strictEqual(setCalls.length, 0, 'an unauthorized caller must not write');
});

// ── payload validation ─────────────────────────────────────────────────────

test('400 on malformed JSON', async () => {
  const { POST } = await import('../route');
  const res = await POST(post('{not json'));
  assert.strictEqual(res.status, 400);
  assert.deepStrictEqual(await res.json(), { ok: false, reason: 'bad_json' });
  assert.strictEqual(setCalls.length, 0);
});

test('400 on an invalid traffic_class, including near-misses', async () => {
  const { POST } = await import('../route');
  // A typo must not be allowed to mint a new counts key and fragment the series
  // across misspelled buckets.
  for (const bad of [
    undefined,
    null,
    '',
    'humans',
    'Human',
    'HUMAN',
    'ai-crawler',
    'bot',
    42,
    true,
    { toString: () => 'human' },
    ['human'],
  ]) {
    const res = await POST(post({ traffic_class: bad, request_type: 'document' }));
    assert.strictEqual(res.status, 400, `should reject traffic_class ${JSON.stringify(bad)}`);
    assert.deepStrictEqual(await res.json(), { ok: false, reason: 'invalid_traffic_class' });
  }
  assert.strictEqual(setCalls.length, 0);
});

test('400 on an invalid request_type', async () => {
  const { POST } = await import('../route');
  for (const bad of [undefined, null, '', 'doc', 'Document', 'softnav', 'soft-nav', 7, false]) {
    const res = await POST(post({ traffic_class: 'human', request_type: bad }));
    assert.strictEqual(res.status, 400, `should reject request_type ${JSON.stringify(bad)}`);
    assert.deepStrictEqual(await res.json(), { ok: false, reason: 'invalid_request_type' });
  }
  assert.strictEqual(setCalls.length, 0);
});

test('every valid class and type combination is accepted', async () => {
  const { POST } = await import('../route');
  const { TRAFFIC_CLASSES, REQUEST_TYPES } = await import(
    '../../../../lib/analytics/traffic-classifier'
  );
  for (const c of TRAFFIC_CLASSES) {
    for (const t of REQUEST_TYPES) {
      const res = await POST(post({ traffic_class: c, request_type: t }));
      assert.strictEqual(res.status, 200, `${c}_${t} should be accepted`);
    }
  }
  assert.strictEqual(
    setCalls.length,
    TRAFFIC_CLASSES.length * REQUEST_TYPES.length,
    'one counter write per accepted request',
  );
  // Each wrote its own composite key, and none collided.
  const keys = setCalls.map((c) => Object.keys(c.data.counts as object)[0]);
  assert.strictEqual(new Set(keys).size, keys.length, 'keys must be distinct per combination');
});

// ── the write shape, which is the actual product ───────────────────────────

test('counter write: collection, UTC hour doc id, merge, and both increments', async () => {
  const { POST } = await import('../route');
  const { FieldValue } = await import('firebase-admin/firestore');

  const before = new Date();
  const res = await POST(post({ traffic_class: 'human', request_type: 'document' }));
  const after = new Date();
  assert.strictEqual(res.status, 200);
  assert.deepStrictEqual(await res.json(), { ok: true });

  assert.strictEqual(setCalls.length, 1, 'exactly one counter write');
  const call = setCalls[0];
  assert.strictEqual(call.collection, 'requestCounters');

  // Doc id is the UTC hour bucket, derived server-side. Recompute the acceptable
  // ids from the wall clock around the call so this cannot be a tautology, and
  // so it still passes if the call straddles an hour boundary.
  const idOf = (d: Date) => {
    const iso = d.toISOString();
    return `${iso.slice(0, 10)}-${iso.slice(11, 13)}`;
  };
  assert.ok(
    call.doc === idOf(before) || call.doc === idOf(after),
    `doc id ${call.doc} should be the UTC hour bucket`,
  );
  assert.match(call.doc, /^\d{4}-\d{2}-\d{2}-\d{2}$/, 'id shape YYYY-MM-DD-HH');

  // Merge, so the first write of an hour creates the doc with no prior read.
  assert.deepStrictEqual(call.options, { merge: true });

  // Exactly two increment paths: total, and the one composite counts key.
  const data = call.data;
  assert.deepStrictEqual(data.total, FieldValue.increment(1), 'total increments by 1');
  const counts = data.counts as Record<string, unknown>;
  assert.deepStrictEqual(Object.keys(counts), ['human_document'], 'one counts key only');
  assert.deepStrictEqual(counts.human_document, FieldValue.increment(1));

  // Stamped fields.
  assert.strictEqual(data.date, call.doc.slice(0, 10), 'date agrees with the doc id');
  assert.strictEqual(data.hour, Number(call.doc.slice(11, 13)), 'hour agrees with the doc id');
  assert.ok(typeof data.hour === 'number' && data.hour >= 0 && data.hour <= 23);
  assert.ok(data.updatedAt, 'updatedAt present');
  assert.ok(data.expiresAt, 'expiresAt present');
});

test('counter write: expiresAt is about 400 days out, updatedAt is now', async () => {
  const { POST } = await import('../route');
  await POST(post({ traffic_class: 'ai_crawler', request_type: 'prefetch' }));
  const data = setCalls[0].data as {
    updatedAt: { toDate(): Date };
    expiresAt: { toDate(): Date };
  };
  const now = Date.now();
  const updated = data.updatedAt.toDate().getTime();
  const expires = data.expiresAt.toDate().getTime();
  assert.ok(Math.abs(updated - now) < 60_000, 'updatedAt is the current time');
  const days = (expires - updated) / (24 * 60 * 60 * 1000);
  assert.ok(Math.abs(days - 400) < 0.01, `expected ~400 days retention, got ${days}`);
});

test('counter write: classifierVersion is imported, not hardcoded', async () => {
  const { POST } = await import('../route');
  const { CLASSIFIER_VERSION } = await import('../../../../lib/analytics/traffic-classifier');
  await POST(post({ traffic_class: 'seo_tool', request_type: 'soft_nav' }));
  assert.strictEqual(setCalls[0].data.classifierVersion, CLASSIFIER_VERSION);
  // Guard against the constant being inlined as a stale literal: this asserts
  // the route tracks the module, and the classifier suite asserts the value.
  assert.strictEqual(CLASSIFIER_VERSION, 'v2');
});

test('counter write: no caller-supplied timestamp or count is honored', async () => {
  const { POST } = await import('../route');
  const { FieldValue } = await import('firebase-admin/firestore');
  const res = await POST(
    post({
      traffic_class: 'human',
      request_type: 'document',
      // All of these are hostile input and must be ignored.
      total: 9999,
      count: 500,
      counts: { human_document: 9999 },
      date: '1999-01-01',
      // 99, not a plausible hour. Every value 0-23 is one the server can
      // legitimately stamp, so asserting inequality against a real hour would
      // red the suite for that one hour of every UTC day.
      hour: 99,
      updatedAt: 'whenever',
      expiresAt: 'never',
      classifierVersion: 'v999',
      id: '1999-01-01-03',
    }),
  );
  assert.strictEqual(res.status, 200);
  const call = setCalls[0];
  assert.notStrictEqual(call.doc, '1999-01-01-03', 'bucket must come from the server clock');
  assert.notStrictEqual(call.data.date, '1999-01-01');
  assert.notStrictEqual(call.data.hour, 99);
  // Positive check too, so a regression to `hour: payload.hour` is caught even
  // when the caller happens to send the current hour.
  assert.strictEqual(
    call.data.hour,
    Number(call.doc.slice(11, 13)),
    'hour must be derived from the server clock, agreeing with the doc id',
  );
  assert.notStrictEqual(call.data.classifierVersion, 'v999');
  assert.deepStrictEqual(call.data.total, FieldValue.increment(1), 'always exactly 1');
  assert.deepStrictEqual(
    (call.data.counts as Record<string, unknown>).human_document,
    FieldValue.increment(1),
    'always exactly 1',
  );
});

test('500 when the counter write fails', async () => {
  const { POST } = await import('../route');
  failSetWith = new Error('firestore unavailable');
  const res = await POST(post({ traffic_class: 'human', request_type: 'document' }));
  assert.strictEqual(res.status, 500);
  assert.deepStrictEqual(await res.json(), { ok: false, reason: 'write_failed' });
});

// ── the unknown-UA diagnostic sample ───────────────────────────────────────

test('unknown-UA sample is written only for the unknown class', async () => {
  const { POST } = await import('../route');
  const ua = 'SomeUnrecognizedAgent/1.0';

  const res = await POST(post({ traffic_class: 'unknown', request_type: 'document', userAgent: ua, path: '/mlb' }));
  assert.strictEqual(res.status, 200);
  assert.strictEqual(addCalls.length, 1);
  assert.strictEqual(addCalls[0].collection, 'unknownUserAgents');
  assert.strictEqual(addCalls[0].data.userAgent, ua);
  assert.strictEqual(addCalls[0].data.path, '/mlb');
  assert.ok(addCalls[0].data.createdAt, 'createdAt present');
  assert.ok(addCalls[0].data.expiresAt, 'expiresAt present');
  // The counter still fired too.
  assert.strictEqual(setCalls.length, 1);
});

test('a UA sent for a NON-unknown class is discarded, never stored', async () => {
  // Defense in depth. The middleware only ever attaches a UA for the unknown
  // class, but if that ever changed this route must not quietly become a log of
  // real visitors' user agents.
  const { POST } = await import('../route');
  for (const c of ['human', 'ai_crawler', 'search_crawler', 'seo_tool']) {
    const res = await POST(
      post({ traffic_class: c, request_type: 'document', userAgent: 'Mozilla/5.0 real person', path: '/x' }),
    );
    assert.strictEqual(res.status, 200);
  }
  assert.strictEqual(addCalls.length, 0, 'no UA may be stored for a non-unknown class');
  assert.strictEqual(setCalls.length, 4, 'but all four were still counted');
});

test('unknown class with no UA writes the counter and no sample', async () => {
  const { POST } = await import('../route');
  const res = await POST(post({ traffic_class: 'unknown', request_type: 'document' }));
  assert.strictEqual(res.status, 200);
  assert.strictEqual(setCalls.length, 1);
  assert.strictEqual(addCalls.length, 0);
});

test('unknown-UA sample truncates an oversized user agent and path', async () => {
  const { POST } = await import('../route');
  await POST(
    post({
      traffic_class: 'unknown',
      request_type: 'document',
      userAgent: 'A'.repeat(5000),
      path: '/' + 'b'.repeat(5000),
    }),
  );
  assert.strictEqual((addCalls[0].data.userAgent as string).length, 512);
  assert.strictEqual((addCalls[0].data.path as string).length, 512);
});

test('a failed sample write does NOT fail the request, since the count succeeded', async () => {
  const { POST } = await import('../route');
  failAddWith = new Error('sample collection unavailable');
  const res = await POST(
    post({ traffic_class: 'unknown', request_type: 'document', userAgent: 'X/1.0' }),
  );
  assert.strictEqual(res.status, 200, 'the counted request is still a success');
  assert.deepStrictEqual(await res.json(), { ok: true });
  assert.strictEqual(setCalls.length, 1, 'the counter write happened');
});

test('a non-string path on a sample is stored as null, not coerced', async () => {
  const { POST } = await import('../route');
  await POST(
    post({ traffic_class: 'unknown', request_type: 'document', userAgent: 'X/1.0', path: { evil: true } }),
  );
  assert.strictEqual(addCalls[0].data.path, null);
});
