// The page_view deferral scheduler: idle callback with a 500ms deadline, a
// teardown flush, a shared sent-latch, and cancel-on-navigation semantics.
//
// These tests encode the Gate 2 behavioral guarantees that do not need a
// browser: fast bounces still record their view, a hidden-then-reshown tab
// does not double-fire, and an SPA navigation cancels rather than emitting a
// stale-route row.
//
// Run with:
//   node --import tsx --experimental-test-module-mocks --test <this file>

import { test, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert';

type Listener = () => void;

type FakeWindow = {
  requestIdleCallback?: (cb: () => void, opts?: { timeout: number }) => number;
  cancelIdleCallback?: (handle: number) => void;
  setTimeout: (cb: () => void, ms: number) => number;
  clearTimeout: (handle: number) => void;
  addEventListener: (name: string, fn: Listener) => void;
  removeEventListener: (name: string, fn: Listener) => void;
};

type FakeDocument = {
  visibilityState: 'visible' | 'hidden';
  addEventListener: (name: string, fn: Listener) => void;
  removeEventListener: (name: string, fn: Listener) => void;
};

// Per-test harness state. The scheduler only touches requestIdleCallback,
// cancelIdleCallback, setTimeout/clearTimeout, and the two listener maps, so
// the fakes hold exactly that surface and nothing else.
let idleCallbacks: Map<number, () => void>;
let cancelledIdleHandles: number[];
let timeoutCallbacks: Map<number, { cb: () => void; ms: number }>;
let windowListeners: Map<string, Listener[]>;
let documentListeners: Map<string, Listener[]>;
let fakeDocument: FakeDocument;

function listenerMapApi(store: Map<string, Listener[]>) {
  return {
    addEventListener: (name: string, fn: Listener) => {
      store.set(name, [...(store.get(name) ?? []), fn]);
    },
    removeEventListener: (name: string, fn: Listener) => {
      store.set(
        name,
        (store.get(name) ?? []).filter((f) => f !== fn),
      );
    },
  };
}

function installBrowser(opts: { idleSupported: boolean }): void {
  idleCallbacks = new Map();
  cancelledIdleHandles = [];
  timeoutCallbacks = new Map();
  windowListeners = new Map();
  documentListeners = new Map();

  let nextHandle = 1;
  const fakeWindow: FakeWindow = {
    setTimeout: (cb, ms) => {
      const h = nextHandle++;
      timeoutCallbacks.set(h, { cb, ms });
      return h;
    },
    clearTimeout: (h) => {
      timeoutCallbacks.delete(h);
    },
    ...listenerMapApi(windowListeners),
  };
  if (opts.idleSupported) {
    fakeWindow.requestIdleCallback = (cb) => {
      const h = nextHandle++;
      idleCallbacks.set(h, cb);
      return h;
    };
    fakeWindow.cancelIdleCallback = (h) => {
      cancelledIdleHandles.push(h);
      idleCallbacks.delete(h);
    };
  }

  fakeDocument = {
    visibilityState: 'visible',
    ...listenerMapApi(documentListeners),
  };

  (globalThis as unknown as { window?: FakeWindow }).window = fakeWindow;
  (globalThis as unknown as { document?: FakeDocument }).document = fakeDocument;
}

function removeBrowser(): void {
  delete (globalThis as unknown as { window?: FakeWindow }).window;
  delete (globalThis as unknown as { document?: FakeDocument }).document;
}

function runPendingIdleCallbacks(): void {
  for (const cb of [...idleCallbacks.values()]) cb();
}

function dispatchWindow(name: string): void {
  for (const fn of [...(windowListeners.get(name) ?? [])]) fn();
}

function dispatchDocument(name: string): void {
  for (const fn of [...(documentListeners.get(name) ?? [])]) fn();
}

beforeEach(() => installBrowser({ idleSupported: true }));
afterEach(removeBrowser);

test('idle callback fires the emit exactly once', async () => {
  const { scheduleDeferredPageView } = await import('../page-view-deferral');
  let emits = 0;
  scheduleDeferredPageView(() => emits++);

  assert.strictEqual(emits, 0, 'deferred, not synchronous');
  runPendingIdleCallbacks();
  assert.strictEqual(emits, 1);
  runPendingIdleCallbacks();
  assert.strictEqual(emits, 1, 'idle re-run cannot double-fire');
});

test('the idle callback is scheduled with the 500ms deadline', async () => {
  const mod = await import('../page-view-deferral');
  let seenOpts: { timeout: number } | undefined;
  (globalThis as unknown as { window: FakeWindow }).window.requestIdleCallback = (
    cb,
    opts,
  ) => {
    seenOpts = opts;
    idleCallbacks.set(999, cb);
    return 999;
  };
  mod.scheduleDeferredPageView(() => {});
  assert.deepStrictEqual(seenOpts, { timeout: mod.PAGE_VIEW_DEADLINE_MS });
  assert.strictEqual(mod.PAGE_VIEW_DEADLINE_MS, 500);
});

test('fast bounce: pagehide flushes a pending emit before idle ever ran', async () => {
  const { scheduleDeferredPageView } = await import('../page-view-deferral');
  let emits = 0;
  scheduleDeferredPageView(() => emits++);

  dispatchWindow('pagehide');
  assert.strictEqual(emits, 1, 'the bounce still records its view');

  // The queued idle callback surviving into a bfcache restore finds the
  // latch closed.
  runPendingIdleCallbacks();
  assert.strictEqual(emits, 1);
});

test('hidden then re-shown with a pending callback does not double-fire', async () => {
  const { scheduleDeferredPageView } = await import('../page-view-deferral');
  let emits = 0;
  scheduleDeferredPageView(() => emits++);

  fakeDocument.visibilityState = 'hidden';
  dispatchDocument('visibilitychange');
  assert.strictEqual(emits, 1, 'hidden transition flushes');

  fakeDocument.visibilityState = 'visible';
  dispatchDocument('visibilitychange');
  runPendingIdleCallbacks();
  dispatchWindow('pagehide');
  assert.strictEqual(emits, 1, 'reshown tab: idle callback and pagehide are both latched out');
});

test('visibilitychange while still visible does not flush', async () => {
  const { scheduleDeferredPageView } = await import('../page-view-deferral');
  let emits = 0;
  scheduleDeferredPageView(() => emits++);

  dispatchDocument('visibilitychange');
  assert.strictEqual(emits, 0, 'visible transition is not a teardown signal');
});

test('SPA navigation: cancel drops the pending emit and detaches everything', async () => {
  const { scheduleDeferredPageView } = await import('../page-view-deferral');
  let emits = 0;
  const cancel = scheduleDeferredPageView(() => emits++);

  cancel();
  assert.strictEqual(cancelledIdleHandles.length, 1, 'idle handle revoked');
  runPendingIdleCallbacks();
  dispatchWindow('pagehide');
  dispatchDocument('visibilitychange');
  assert.strictEqual(emits, 0, 'no stale-route page_view after cancel');
  assert.strictEqual((windowListeners.get('pagehide') ?? []).length, 0);
  assert.strictEqual((documentListeners.get('visibilitychange') ?? []).length, 0);
});

test('cancel latches even when cancelIdleCallback is missing', async () => {
  const { scheduleDeferredPageView } = await import('../page-view-deferral');
  delete (globalThis as unknown as { window: FakeWindow }).window.cancelIdleCallback;
  let emits = 0;
  const cancel = scheduleDeferredPageView(() => emits++);

  cancel();
  runPendingIdleCallbacks();
  assert.strictEqual(emits, 0, 'unrevokable stale callback finds the latch closed');
});

test('after the emit has fired, teardown flushes are no-ops', async () => {
  // The capture-safety property in miniature: once the deadline path has
  // emitted, a later hide/pagehide delivers NO second track() call, so the
  // capture trigger sees nothing new at teardown.
  const { scheduleDeferredPageView } = await import('../page-view-deferral');
  let emits = 0;
  scheduleDeferredPageView(() => emits++);

  runPendingIdleCallbacks();
  assert.strictEqual(emits, 1);
  fakeDocument.visibilityState = 'hidden';
  dispatchDocument('visibilitychange');
  dispatchWindow('pagehide');
  assert.strictEqual(emits, 1, 'teardown after a sent page_view emits nothing');
});

test('fallback path without requestIdleCallback uses the 50ms timer', async () => {
  removeBrowser();
  installBrowser({ idleSupported: false });
  const mod = await import('../page-view-deferral');
  let emits = 0;
  const cancel = mod.scheduleDeferredPageView(() => emits++);

  assert.strictEqual(timeoutCallbacks.size, 1, 'timer scheduled');
  const [{ cb, ms }] = [...timeoutCallbacks.values()];
  assert.strictEqual(ms, mod.FALLBACK_DELAY_MS);
  cb();
  assert.strictEqual(emits, 1);

  cancel();
  dispatchWindow('pagehide');
  assert.strictEqual(emits, 1);
});

test('fallback path: pagehide before the timer still flushes once', async () => {
  removeBrowser();
  installBrowser({ idleSupported: false });
  const { scheduleDeferredPageView } = await import('../page-view-deferral');
  let emits = 0;
  scheduleDeferredPageView(() => emits++);

  dispatchWindow('pagehide');
  assert.strictEqual(emits, 1);
  for (const { cb } of [...timeoutCallbacks.values()]) cb();
  assert.strictEqual(emits, 1, 'timer after flush is latched out');
});
