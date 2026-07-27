// Proves the confirmToken lifecycle through the REAL upsertSubscriber, against
// an in-memory fake Firestore.
//
// The bug this locks down was write-side: a pending re-submit rotated
// confirmToken, orphaning the link already sitting in the user's inbox because
// confirmSubscriberByToken resolves a record BY that token. So every case here
// asserts on what was WRITTEN to the doc, not only on the returned object.
// Several cases return near-identical shapes while writing different tokens.
//
// firebase + server-only are module-mocked, same pattern as
// src/lib/__tests__/tombstone-filter.test.ts. Run with:
//   node --import tsx --experimental-test-module-mocks --test <this file>

import { test, mock, beforeEach } from 'node:test';
import assert from 'node:assert';
import { Timestamp } from 'firebase-admin/firestore';

// ── fake Firestore ──────────────────────────────────────────────────────────
// Supports the exact surface subscribers.ts uses: collection().doc(),
// runTransaction with tx.get/set/update, and where().limit().get() for the
// token lookups. Writes are applied immediately rather than buffered to a
// commit; upsertSubscriber does a single read at the top of the transaction and
// never reads back, so the difference is not observable here.

type Data = Record<string, unknown>;
type WriteCall = { op: 'set' | 'update'; collection: string; doc: string; data: Data };
type DocRef = {
  __collection: string;
  __id: string;
  id: string;
  update(data: Data): Promise<void>;
};

let store: Map<string, Map<string, Data>>;
let writes: WriteCall[];

function coll(name: string): Map<string, Data> {
  let c = store.get(name);
  if (!c) {
    c = new Map();
    store.set(name, c);
  }
  return c;
}

function record(op: 'set' | 'update', collection: string, doc: string, data: Data): void {
  writes.push({ op, collection, doc, data });
}

function applyWrite(op: 'set' | 'update', collection: string, id: string, data: Data): void {
  const c = coll(collection);
  c.set(id, op === 'set' ? { ...data } : { ...(c.get(id) ?? {}), ...data });
  record(op, collection, id, data);
}

function makeRef(collection: string, id: string): DocRef {
  return {
    __collection: collection,
    __id: id,
    id,
    async update(data: Data) {
      applyWrite('update', collection, id, data);
    },
  };
}

function snapFor(collection: string, id: string) {
  const data = coll(collection).get(id);
  return {
    id,
    exists: data !== undefined,
    data: () => data,
    ref: makeRef(collection, id),
  };
}

function makeQuery(collection: string, field: string, value: unknown) {
  let cap = Infinity;
  const q = {
    limit(n: number) {
      cap = n;
      return q;
    },
    async get() {
      const docs = [...coll(collection).entries()]
        .filter(([, d]) => d[field] === value)
        .slice(0, cap)
        .map(([id]) => snapFor(collection, id));
      return { empty: docs.length === 0, docs };
    },
  };
  return q;
}

const fakeDb = {
  collection(name: string) {
    return {
      doc(id: string) {
        return makeRef(name, id);
      },
      where(field: string, _op: string, value: unknown) {
        return makeQuery(name, field, value);
      },
    };
  },
  async runTransaction<T>(fn: (tx: FakeTx) => Promise<T>): Promise<T> {
    const tx: FakeTx = {
      async get(ref: DocRef) {
        return snapFor(ref.__collection, ref.__id);
      },
      set(ref: DocRef, data: Data) {
        applyWrite('set', ref.__collection, ref.__id, data);
      },
      update(ref: DocRef, data: Data) {
        applyWrite('update', ref.__collection, ref.__id, data);
      },
    };
    return fn(tx);
  },
};

type FakeTx = {
  get(ref: DocRef): Promise<ReturnType<typeof snapFor>>;
  set(ref: DocRef, data: Data): void;
  update(ref: DocRef, data: Data): void;
};

mock.module('server-only', { namedExports: {} });
mock.module(new URL('../firebase.ts', import.meta.url).href, { namedExports: { db: fakeDb } });

// ── fixtures ────────────────────────────────────────────────────────────────

const EMAIL = 'fan@example.com';
// Must satisfy TOKEN_RE (/^[A-Za-z0-9_-]{16,128}$/) so the integration case can
// resolve it through confirmSubscriberByToken.
const SEEDED_CONFIRM = 'seededConfirmToken0123456789abcd';
const SEEDED_MANAGE = 'seededManageToken0123456789abcde';

const OUTSIDE_COOLDOWN = () => Timestamp.fromMillis(Date.now() - 120_000);
const INSIDE_COOLDOWN = () => Timestamp.fromMillis(Date.now() - 5_000);

function lib() {
  return import('../subscribers');
}

async function seed(overrides: Data): Promise<string> {
  const { subscriberDocId } = await lib();
  const id = subscriberDocId(EMAIL);
  coll('subscribers').set(id, {
    email: EMAIL,
    teams: ['twins'],
    status: 'pending',
    source: 'web_team_page',
    confirmToken: SEEDED_CONFIRM,
    manageToken: SEEDED_MANAGE,
    updatedAt: OUTSIDE_COOLDOWN(),
    ...overrides,
  });
  writes = [];
  return id;
}

function lastWrite(): WriteCall {
  assert.ok(writes.length > 0, 'expected at least one write');
  return writes[writes.length - 1];
}

function stored(id: string): Data {
  const d = coll('subscribers').get(id);
  assert.ok(d, 'expected a stored doc');
  return d;
}

beforeEach(() => {
  store = new Map();
  writes = [];
});

// ── the fix: suppression path ───────────────────────────────────────────────

test('pending + adds a slug + outside cooldown: token preserved, no confirmation', async () => {
  // The bug. Before the fix this rotated the token and emailed, killing the
  // link already in the user's inbox.
  const { upsertSubscriber } = await lib();
  const id = await seed({});

  const r = await upsertSubscriber({ email: EMAIL, teams: ['yankees'], source: 'web_team_page' });

  assert.strictEqual(r.confirmToken, SEEDED_CONFIRM, 'returned token must be the seeded one');
  assert.strictEqual(r.needsConfirmation, false);
  assert.strictEqual(r.suppressionReason, 'teams_only');
  assert.deepStrictEqual(r.teams, ['twins', 'yankees'], 'existing team first, new one appended');

  const w = lastWrite();
  assert.strictEqual(w.op, 'update');
  assert.strictEqual(w.data.confirmToken, SEEDED_CONFIRM, 'WRITE must not rotate the token');
  assert.deepStrictEqual(w.data.teams, ['twins', 'yankees']);
  assert.strictEqual(w.data.status, 'pending');
  assert.strictEqual(stored(id).confirmToken, SEEDED_CONFIRM);
});

test('pending + adds a slug + inside cooldown: reported as teams_only, not cooldown', async () => {
  // Locks in the precedence decision. Both suppressors hold here; the label has
  // to be the one that distinguishes an add-a-team submit, otherwise cooldown
  // absorbs exactly the fast taps the field exists to make visible.
  const { upsertSubscriber } = await lib();
  const id = await seed({ updatedAt: INSIDE_COOLDOWN() });

  const r = await upsertSubscriber({ email: EMAIL, teams: ['yankees'], source: 'web_team_page' });

  assert.strictEqual(r.suppressionReason, 'teams_only');
  assert.strictEqual(r.needsConfirmation, false);
  assert.strictEqual(r.confirmToken, SEEDED_CONFIRM);
  assert.strictEqual(lastWrite().data.confirmToken, SEEDED_CONFIRM);
  assert.strictEqual(stored(id).confirmToken, SEEDED_CONFIRM);
});

// ── preserved behavior: regression guards ───────────────────────────────────

test('pending + adds nothing + outside cooldown: still a resend, token rotates', async () => {
  // A re-submit carrying only teams the record already has is a genuine "resend
  // my link" request. This is the behavior the fix must NOT swallow.
  const { upsertSubscriber } = await lib();
  const id = await seed({});

  const r = await upsertSubscriber({ email: EMAIL, teams: ['twins'], source: 'web_team_page' });

  assert.strictEqual(r.needsConfirmation, true);
  assert.strictEqual(r.suppressionReason, null);
  assert.notStrictEqual(r.confirmToken, SEEDED_CONFIRM, 'token must rotate');
  assert.ok(r.confirmToken.length > 0);

  const w = lastWrite();
  assert.notStrictEqual(w.data.confirmToken, SEEDED_CONFIRM, 'WRITE must carry the new token');
  assert.strictEqual(w.data.confirmToken, r.confirmToken);
  assert.deepStrictEqual(w.data.teams, ['twins'], 'no growth');
  assert.strictEqual(stored(id).confirmToken, r.confirmToken);
});

test('pending + adds nothing + inside cooldown: suppressed as cooldown', async () => {
  const { upsertSubscriber } = await lib();
  const id = await seed({ updatedAt: INSIDE_COOLDOWN() });

  const r = await upsertSubscriber({ email: EMAIL, teams: ['twins'], source: 'web_team_page' });

  assert.strictEqual(r.suppressionReason, 'cooldown');
  assert.strictEqual(r.needsConfirmation, false);
  assert.strictEqual(r.confirmToken, SEEDED_CONFIRM);
  assert.strictEqual(lastWrite().data.confirmToken, SEEDED_CONFIRM);
  assert.strictEqual(stored(id).confirmToken, SEEDED_CONFIRM);
});

// The Phase A hazard: preserving an unusable token while skipping the email
// would strand the subscriber with no way to confirm, permanently. All three
// malformed shapes must fall through to rotate-and-send.
for (const [label, badToken] of [
  ['missing', undefined],
  ['empty string', ''],
  ['non-string', 42],
] as const) {
  test(`pending + adds a slug + ${label} confirmToken: rotates and sends`, async () => {
    const { upsertSubscriber } = await lib();
    const id = await seed(
      badToken === undefined ? { confirmToken: undefined } : { confirmToken: badToken },
    );
    if (badToken === undefined) {
      const d = coll('subscribers').get(id) as Data;
      delete d.confirmToken;
    }

    const r = await upsertSubscriber({ email: EMAIL, teams: ['yankees'], source: 'web_team_page' });

    assert.strictEqual(r.needsConfirmation, true, 'must not skip the email');
    assert.strictEqual(r.suppressionReason, null);
    assert.ok(r.confirmToken.length >= 16, 'must mint a usable token');
    assert.strictEqual(lastWrite().data.confirmToken, r.confirmToken);
    assert.deepStrictEqual(r.teams, ['twins', 'yankees'], 'teams still merge');
    assert.strictEqual(stored(id).confirmToken, r.confirmToken);
  });
}

test('confirmed + adds a slug: merges teams, writes no confirmToken and no status', async () => {
  const { upsertSubscriber } = await lib();
  const id = await seed({ status: 'confirmed', confirmedAt: Timestamp.fromMillis(Date.now()) });

  const r = await upsertSubscriber({ email: EMAIL, teams: ['yankees'], source: 'web_homepage' });

  assert.strictEqual(r.status, 'confirmed');
  assert.strictEqual(r.needsConfirmation, false);
  assert.strictEqual(r.suppressionReason, undefined, 'confirmed branch never suppresses');
  assert.deepStrictEqual(r.teams, ['twins', 'yankees']);

  const w = lastWrite();
  assert.strictEqual(w.op, 'update');
  assert.ok(!('confirmToken' in w.data), 'must not touch confirmToken');
  assert.ok(!('status' in w.data), 'must not un-confirm');
  assert.ok(!('confirmedAt' in w.data));
  assert.strictEqual(stored(id).confirmToken, SEEDED_CONFIRM);
  assert.strictEqual(stored(id).status, 'confirmed');
});

test('unsubscribed + adds a slug + outside cooldown: resurrects, rotates, sends', async () => {
  // A resubmit here is a deliberate resubscribe, not a preferences update, so
  // the explicit status === 'pending' gate must exclude it.
  const { upsertSubscriber } = await lib();
  const id = await seed({ status: 'unsubscribed' });

  const r = await upsertSubscriber({ email: EMAIL, teams: ['yankees'], source: 'web_team_page' });

  assert.strictEqual(r.status, 'pending');
  assert.strictEqual(r.needsConfirmation, true);
  assert.strictEqual(r.suppressionReason, null);
  assert.notStrictEqual(r.confirmToken, SEEDED_CONFIRM, 'token must rotate');

  const w = lastWrite();
  assert.strictEqual(w.data.status, 'pending');
  assert.strictEqual(w.data.confirmToken, r.confirmToken);
  assert.strictEqual(stored(id).status, 'pending');
});

test('brand new record: mints both tokens, pending, needs confirmation', async () => {
  const { upsertSubscriber, subscriberDocId } = await lib();

  const r = await upsertSubscriber({ email: EMAIL, teams: ['twins'], source: 'web_team_page' });

  assert.strictEqual(r.created, true);
  assert.strictEqual(r.status, 'pending');
  assert.strictEqual(r.needsConfirmation, true);
  assert.strictEqual(r.suppressionReason, undefined, 'new-record branch never suppresses');
  assert.ok(r.confirmToken.length >= 16);
  assert.ok(r.manageToken.length >= 16);
  assert.notStrictEqual(r.confirmToken, r.manageToken, 'tokens must be independent');

  const w = lastWrite();
  assert.strictEqual(w.op, 'set');
  assert.strictEqual(w.doc, subscriberDocId(EMAIL));
  assert.strictEqual(w.data.status, 'pending');
  assert.strictEqual(w.data.confirmedAt, null);
  assert.strictEqual(w.data.confirmToken, r.confirmToken);
});

// ── integration: the preserved token still works ────────────────────────────

test('a token preserved through a teams-only update still confirms', async () => {
  // The whole point of the fix. If the preserved token did not resolve, the
  // user would be stranded exactly as they were by the rotation.
  const { upsertSubscriber, confirmSubscriberByToken } = await lib();
  const id = await seed({});

  const r = await upsertSubscriber({ email: EMAIL, teams: ['yankees'], source: 'web_team_page' });

  // The end-to-end outcome is asserted BEFORE anything about suppressionReason,
  // so that against the pre-fix code this test fails on the dead link, which is
  // the actual regression, rather than on the absence of the new field.
  const confirmed = await confirmSubscriberByToken(SEEDED_CONFIRM);

  assert.strictEqual(confirmed.found, true, 'the emailed link must still resolve');
  assert.strictEqual(confirmed.alreadyConfirmed, false);
  assert.strictEqual(confirmed.manageToken, SEEDED_MANAGE);
  assert.strictEqual(stored(id).status, 'confirmed');
  assert.strictEqual(r.suppressionReason, 'teams_only');
});

// ── edges that must NOT suppress ────────────────────────────────────────────

test('submitted teams that sanitize away to nothing: no growth, still a resend', async () => {
  const { upsertSubscriber } = await lib();
  await seed({});

  // Only strings here on purpose: the route sanitizes body.teams before calling
  // upsertSubscriber, so a non-string can never reach it and the input type says
  // so. Non-string rejection is sanitizeTeams' own contract.
  const r = await upsertSubscriber({
    email: EMAIL,
    teams: ['BAD_SLUG!', '', 'twins'],
    source: 'web_team_page',
  });

  assert.strictEqual(r.suppressionReason, null, 'nothing was actually added');
  assert.strictEqual(r.needsConfirmation, true);
  assert.notStrictEqual(r.confirmToken, SEEDED_CONFIRM);
  assert.deepStrictEqual(r.teams, ['twins']);
});

test('merge truncated at MAX_TEAMS so length does not grow: still a resend', async () => {
  // Locks in the Phase A point B reasoning: the length comparison asks whether
  // the stored array actually grew. At the ceiling it cannot, so a submit that
  // adds nothing real must not suppress the email.
  const { upsertSubscriber } = await lib();
  const full = Array.from({ length: 200 }, (_, i) => `t${i}`);
  await seed({ teams: full });

  const r = await upsertSubscriber({ email: EMAIL, teams: ['yankees'], source: 'web_team_page' });

  assert.strictEqual(r.teams.length, 200, 'capped at MAX_TEAMS');
  assert.ok(!r.teams.includes('yankees'), 'the new slug was truncated away');
  assert.strictEqual(r.suppressionReason, null, 'no growth means no suppression');
  assert.strictEqual(r.needsConfirmation, true);
  assert.notStrictEqual(r.confirmToken, SEEDED_CONFIRM);
});
