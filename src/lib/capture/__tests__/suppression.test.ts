// Suppression: one reason per case, plus the precedence that makes the
// suppression_reason distribution readable rather than order-dependent.
//
// Run with:
//   node --import tsx --experimental-test-module-mocks --test <this file>

import { test } from 'node:test';
import assert from 'node:assert';
import {
  createSafeStorage,
  KEY_DISMISSED_AT,
  KEY_SESSION,
  KEY_SUBSCRIBED,
  type SafeStorage,
  type StorageLike,
} from '../storage';
import {
  DISMISSAL_WINDOW_MS,
  EXCLUDED_PATHS,
  SUPPRESSION_ORDER,
  evaluateSuppression,
  isExcludedPath,
  markShown,
  markSignup,
  readSession,
  recordPageview,
  type SuppressionReason,
} from '../suppression';

const NOW = 1_800_000_000_000;

function memStorage(seed: Record<string, string> = {}): StorageLike {
  const map = new Map(Object.entries(seed));
  return {
    getItem: (k) => map.get(k) ?? null,
    setItem: (k, v) => void map.set(k, v),
    removeItem: (k) => void map.delete(k),
  };
}

/** A store that throws on every operation, including the write probe. */
function hostileStorage(): StorageLike {
  return {
    getItem() {
      throw new Error('denied');
    },
    setItem() {
      throw new Error('denied');
    },
    removeItem() {
      throw new Error('denied');
    },
  };
}

function setup(
  opts: {
    pathname?: string;
    localSeed?: Record<string, string>;
    sessionSeed?: Record<string, string>;
    local?: SafeStorage;
    session?: SafeStorage;
  } = {},
) {
  const local = opts.local ?? createSafeStorage(memStorage(opts.localSeed));
  const session = opts.session ?? createSafeStorage(memStorage(opts.sessionSeed));
  return {
    local,
    session,
    evaluate: () =>
      evaluateSuppression({
        pathname: opts.pathname ?? '/mlb/minnesota-twins',
        local,
        session,
        now: NOW,
      }),
  };
}

/** Session JSON for a visitor already past their first pageview. */
const ELIGIBLE_SESSION = JSON.stringify({ pageviews: 2, shown: false, signup: false });

// ── the eligible baseline ───────────────────────────────────────────────────

test('nothing suppresses an eligible visitor', () => {
  const { evaluate } = setup({ sessionSeed: { [KEY_SESSION]: ELIGIBLE_SESSION } });
  assert.strictEqual(evaluate(), null);
});

// ── one test per reason ─────────────────────────────────────────────────────

for (const path of EXCLUDED_PATHS) {
  test(`excluded_path on ${path}`, () => {
    const { evaluate } = setup({
      pathname: path,
      sessionSeed: { [KEY_SESSION]: ELIGIBLE_SESSION },
    });
    assert.strictEqual(evaluate(), 'excluded_path');
  });
}

test('excluded_path covers subpaths and query-bearing routes, not lookalikes', () => {
  assert.strictEqual(isExcludedPath('/preferences'), true);
  assert.strictEqual(isExcludedPath('/preferences/anything'), true);
  assert.strictEqual(isExcludedPath('/about'), true);
  assert.strictEqual(isExcludedPath('/aboutface'), false, 'prefix must not over-match');
  assert.strictEqual(isExcludedPath('/downloads-guide'), false);
  assert.strictEqual(isExcludedPath('/mlb/minnesota-twins'), false);
});

test('storage_unavailable when localStorage throws', () => {
  const { evaluate } = setup({
    local: createSafeStorage(hostileStorage()),
    sessionSeed: { [KEY_SESSION]: ELIGIBLE_SESSION },
  });
  assert.strictEqual(evaluate(), 'storage_unavailable');
});

test('storage_unavailable when sessionStorage throws', () => {
  const { evaluate } = setup({ session: createSafeStorage(hostileStorage()) });
  assert.strictEqual(evaluate(), 'storage_unavailable');
});

test('storage_unavailable when storage is absent entirely', () => {
  const { evaluate } = setup({ local: createSafeStorage(null) });
  assert.strictEqual(evaluate(), 'storage_unavailable');
});

test('already_subscribed when the local marker is set', () => {
  const { evaluate } = setup({
    localSeed: { [KEY_SUBSCRIBED]: '1' },
    sessionSeed: { [KEY_SESSION]: ELIGIBLE_SESSION },
  });
  assert.strictEqual(evaluate(), 'already_subscribed');
});

test('an empty subscribed marker does not suppress', () => {
  const { evaluate } = setup({
    localSeed: { [KEY_SUBSCRIBED]: '' },
    sessionSeed: { [KEY_SESSION]: ELIGIBLE_SESSION },
  });
  assert.strictEqual(evaluate(), null);
});

test('recently_dismissed inside the 30 day window', () => {
  const { evaluate } = setup({
    localSeed: { [KEY_DISMISSED_AT]: String(NOW - DISMISSAL_WINDOW_MS + 1) },
    sessionSeed: { [KEY_SESSION]: ELIGIBLE_SESSION },
  });
  assert.strictEqual(evaluate(), 'recently_dismissed');
});

test('a dismissal exactly at the window boundary has expired', () => {
  const { evaluate } = setup({
    localSeed: { [KEY_DISMISSED_AT]: String(NOW - DISMISSAL_WINDOW_MS) },
    sessionSeed: { [KEY_SESSION]: ELIGIBLE_SESSION },
  });
  assert.strictEqual(evaluate(), null);
});

test('a future-dated dismissal still suppresses, so clock skew errs toward respecting it', () => {
  const { evaluate } = setup({
    localSeed: { [KEY_DISMISSED_AT]: String(NOW + 60_000) },
    sessionSeed: { [KEY_SESSION]: ELIGIBLE_SESSION },
  });
  assert.strictEqual(evaluate(), 'recently_dismissed');
});

test('an unparseable dismissal does NOT permanently silence the visitor', () => {
  const { evaluate } = setup({
    localSeed: { [KEY_DISMISSED_AT]: 'not-a-timestamp' },
    sessionSeed: { [KEY_SESSION]: ELIGIBLE_SESSION },
  });
  assert.strictEqual(evaluate(), null, 'one bad byte must not suppress forever');
});

test('session_signup once a signup fired this session', () => {
  const { evaluate } = setup({
    sessionSeed: {
      [KEY_SESSION]: JSON.stringify({ pageviews: 3, shown: false, signup: true }),
    },
  });
  assert.strictEqual(evaluate(), 'session_signup');
});

test('session_already_shown once a prompt was shown this session', () => {
  const { evaluate } = setup({
    sessionSeed: {
      [KEY_SESSION]: JSON.stringify({ pageviews: 3, shown: true, signup: false }),
    },
  });
  assert.strictEqual(evaluate(), 'session_already_shown');
});

test('first_pageview on pageview one', () => {
  const { evaluate } = setup({
    sessionSeed: {
      [KEY_SESSION]: JSON.stringify({ pageviews: 1, shown: false, signup: false }),
    },
  });
  assert.strictEqual(evaluate(), 'first_pageview');
});

test('first_pageview on a fresh session with no state at all', () => {
  const { evaluate } = setup();
  assert.strictEqual(evaluate(), 'first_pageview');
});

// ── shown is recorded at SHOWN, not at dismissed ────────────────────────────

test('a prompt shown and then abandoned still suppresses the next pageview', () => {
  // The slow reader who navigates away mid-prompt. Nothing dismissed, so a
  // dismissal-based rule would show it to them again.
  const session = createSafeStorage(memStorage());
  recordPageview(session);
  recordPageview(session);
  markShown(session);

  const local = createSafeStorage(memStorage());
  recordPageview(session); // next pageview
  assert.strictEqual(
    evaluateSuppression({ pathname: '/mlb/minnesota-twins', local, session, now: NOW }),
    'session_already_shown',
  );
});

// ── precedence ──────────────────────────────────────────────────────────────

test('the declared order matches the implementation, first match wins', () => {
  // Build a visitor matching EVERY reason, then remove them one at a time and
  // assert the reported reason walks the declared order exactly. This is what
  // makes the distribution interpretable rather than a chart of timing.
  const seedAll = {
    local: {
      [KEY_SUBSCRIBED]: '1',
      [KEY_DISMISSED_AT]: String(NOW - 1000),
    } as Record<string, string>,
    session: {
      [KEY_SESSION]: JSON.stringify({ pageviews: 1, shown: true, signup: true }),
    } as Record<string, string>,
  };

  const seen: SuppressionReason[] = [];

  // excluded_path
  seen.push(
    evaluateSuppression({
      pathname: '/follow',
      local: createSafeStorage(memStorage(seedAll.local)),
      session: createSafeStorage(memStorage(seedAll.session)),
      now: NOW,
    })!,
  );

  // storage_unavailable
  seen.push(
    evaluateSuppression({
      pathname: '/mlb/minnesota-twins',
      local: createSafeStorage(hostileStorage()),
      session: createSafeStorage(memStorage(seedAll.session)),
      now: NOW,
    })!,
  );

  // then each remaining reason, peeled one at a time
  const peels: Array<{ local: Record<string, string>; session: Record<string, string> }> = [
    seedAll,
    { local: { [KEY_DISMISSED_AT]: String(NOW - 1000) }, session: seedAll.session },
    { local: {}, session: seedAll.session },
    {
      local: {},
      session: { [KEY_SESSION]: JSON.stringify({ pageviews: 1, shown: true, signup: false }) },
    },
    {
      local: {},
      session: { [KEY_SESSION]: JSON.stringify({ pageviews: 1, shown: false, signup: false }) },
    },
  ];
  for (const p of peels) {
    seen.push(
      evaluateSuppression({
        pathname: '/mlb/minnesota-twins',
        local: createSafeStorage(memStorage(p.local)),
        session: createSafeStorage(memStorage(p.session)),
        now: NOW,
      })!,
    );
  }

  assert.deepStrictEqual(seen, [...SUPPRESSION_ORDER]);
});

test('a subscribed visitor on their first pageview reports already_subscribed', () => {
  // The concrete reason durability comes first: attributing this to
  // first_pageview would hide how much of the audience is already captured.
  const { evaluate } = setup({ localSeed: { [KEY_SUBSCRIBED]: '1' } });
  assert.strictEqual(evaluate(), 'already_subscribed');
});

// ── session bookkeeping ─────────────────────────────────────────────────────

test('recordPageview increments and persists', () => {
  const session = createSafeStorage(memStorage());
  assert.strictEqual(recordPageview(session).pageviews, 1);
  assert.strictEqual(recordPageview(session).pageviews, 2);
  assert.strictEqual(readSession(session).pageviews, 2);
});

test('markShown and markSignup preserve the rest of the session', () => {
  const session = createSafeStorage(memStorage());
  recordPageview(session);
  recordPageview(session);
  markShown(session);
  markSignup(session);

  assert.deepStrictEqual(readSession(session), { pageviews: 2, shown: true, signup: true });
});

test('malformed session JSON is treated as a new session, not a fragment', () => {
  const session = createSafeStorage(memStorage({ [KEY_SESSION]: '{not json' }));
  assert.deepStrictEqual(readSession(session), { pageviews: 0, shown: false, signup: false });
});

test('a session object with wrong-typed fields is coerced safely', () => {
  const session = createSafeStorage(
    memStorage({ [KEY_SESSION]: JSON.stringify({ pageviews: 'x', shown: 'yes', signup: 1 }) }),
  );
  assert.deepStrictEqual(readSession(session), { pageviews: 0, shown: false, signup: false });
});

test('session bookkeeping on unavailable storage does not throw', () => {
  const session = createSafeStorage(hostileStorage());
  assert.doesNotThrow(() => {
    recordPageview(session);
    markShown(session);
    markSignup(session);
    readSession(session);
  });
});
