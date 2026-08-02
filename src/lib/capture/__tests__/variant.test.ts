// A/B arm assignment. The property that matters is STABILITY: an arm that
// changes on reload puts one person in both arms and makes every rate in the
// Phase 2 read meaningless.
//
// Run with:
//   node --import tsx --experimental-test-module-mocks --test <this file>

import { test } from 'node:test';
import assert from 'node:assert';
import { createSafeStorage, KEY_VARIANT, type StorageLike } from '../storage';
import { resolveVariant, resolveBrowserVariant, isCaptureArm } from '../variant';

function memStorage(seed: Record<string, string> = {}): StorageLike {
  const map = new Map(Object.entries(seed));
  return {
    getItem: (k) => map.get(k) ?? null,
    setItem: (k, v) => void map.set(k, v),
    removeItem: (k) => void map.delete(k),
  };
}

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

/** Accepts writes but silently discards them, like a quota-exhausted store. */
function amnesiacStorage(): StorageLike {
  return {
    getItem: () => null,
    setItem: () => {},
    removeItem: () => {},
  };
}

/**
 * Point browserStorage() at an in-memory store. Node has no window, so this is
 * the only way to exercise resolveBrowserVariant's real entry point rather than
 * a paraphrase of it. Pass null for a window that has no localStorage at all,
 * and 'throws' for the managed browsers where the property access itself throws.
 */
function stubWindow(local: StorageLike | null | 'throws'): () => void {
  const g = globalThis as { window?: unknown };
  const had = 'window' in g;
  const prev = g.window;

  if (local === 'throws') {
    const w = {};
    Object.defineProperty(w, 'localStorage', {
      get() {
        throw new Error('denied');
      },
    });
    g.window = w;
  } else {
    g.window = local === null ? {} : { localStorage: local };
  }

  return () => {
    if (had) g.window = prev;
    else delete g.window;
  };
}

test('assigns control on a low flip and variant_a on a high flip', () => {
  const low = createSafeStorage(memStorage());
  assert.strictEqual(resolveVariant(low, () => 0.1), 'control');

  const high = createSafeStorage(memStorage());
  assert.strictEqual(resolveVariant(high, () => 0.9), 'variant_a');
});

test('the boundary goes to variant_a, so the split is even', () => {
  // random() is [0,1), so < 0.5 is control and exactly 0.5 is variant_a. Both
  // halves are the same width.
  const s = createSafeStorage(memStorage());
  assert.strictEqual(resolveVariant(s, () => 0.5), 'variant_a');
});

test('the assignment is persisted under the promonight key', () => {
  const raw = memStorage();
  const s = createSafeStorage(raw);
  resolveVariant(s, () => 0.9);
  assert.strictEqual(raw.getItem(KEY_VARIANT), 'variant_a');
});

test('a stored arm SURVIVES a reload and is never reassigned', () => {
  // The core property. A fresh resolveVariant call, as happens on every page
  // load, must return the stored arm even when the coin would say otherwise.
  const raw = memStorage();
  const first = resolveVariant(createSafeStorage(raw), () => 0.1);
  assert.strictEqual(first, 'control');

  for (let i = 0; i < 25; i++) {
    const again = resolveVariant(createSafeStorage(raw), () => 0.99);
    assert.strictEqual(again, first, `reload ${i + 1} must not reassign`);
  }
});

test('a stored variant_a also survives an opposing coin', () => {
  const raw = memStorage();
  const first = resolveVariant(createSafeStorage(raw), () => 0.9);
  assert.strictEqual(first, 'variant_a');
  assert.strictEqual(resolveVariant(createSafeStorage(raw), () => 0.01), 'variant_a');
});

test('a corrupt stored arm is replaced rather than trusted', () => {
  const raw = memStorage({ [KEY_VARIANT]: 'variant_zzz' });
  const s = createSafeStorage(raw);
  assert.strictEqual(resolveVariant(s, () => 0.9), 'variant_a');
  assert.strictEqual(raw.getItem(KEY_VARIANT), 'variant_a');
});

test('a hostile store yields unassigned, NOT control', () => {
  // Reporting these as control would silently inflate the control arm on the
  // balance chart, and the only defence would be every future reader
  // remembering to filter by suppression_reason first. A distinct value makes
  // the contamination impossible rather than documented.
  const s = createSafeStorage(hostileStorage());
  assert.doesNotThrow(() => resolveVariant(s, () => 0.9));
  assert.strictEqual(resolveVariant(s, () => 0.9), 'unassigned');
  assert.strictEqual(resolveVariant(s, () => 0.1), 'unassigned', 'never an arm, either way');
});

test('absent storage yields unassigned', () => {
  assert.strictEqual(resolveVariant(createSafeStorage(null), () => 0.9), 'unassigned');
});

test('a store that discards writes yields unassigned, not a fresh arm each load', () => {
  // Quota exhaustion is the realistic case. Without the read-back this would
  // hand out a new arm on every page and quietly corrupt the split. With it,
  // the honest answer is that no durable assignment exists.
  const s = createSafeStorage(amnesiacStorage());
  const reported = new Set<string>();
  for (let i = 0; i < 10; i++) reported.add(resolveVariant(s, () => (i % 2 === 0 ? 0.1 : 0.9)));
  assert.deepStrictEqual([...reported], ['unassigned'], 'stable, and never an arm');
});

test('a real coin lands both arms and roughly evenly', () => {
  // Not a statistical test, just proof that nothing pins every visitor to one
  // arm. A 50/50 split is the Phase 2 sanity check on assignment.
  let control = 0;
  let treatment = 0;
  for (let i = 0; i < 2000; i++) {
    const arm = resolveVariant(createSafeStorage(memStorage()), Math.random);
    if (arm === 'control') control += 1;
    else treatment += 1;
  }
  assert.ok(control > 800 && control < 1200, `control=${control} outside a sane band`);
  assert.ok(treatment > 800 && treatment < 1200, `variant_a=${treatment} outside a sane band`);
});

// ── The pageview path ───────────────────────────────────────────────────────
// resolveBrowserVariant is what stamps the arm onto page_view and
// newsletter_signup. It runs on EVERY pageview, including pages that mount no
// trigger, so the thing worth proving is that widening the caller set cannot
// widen the set of arms a browser reports.

test('the pageview path persists under the same key and never reassigns', () => {
  const raw = memStorage();
  const restore = stubWindow(raw);
  try {
    const first = resolveBrowserVariant();
    assert.ok(isCaptureArm(first), `expected an arm, got ${first}`);
    assert.strictEqual(raw.getItem(KEY_VARIANT), first, 'same key as the trigger path');

    // A pageview fires on every route change. None of them may re-flip.
    for (let i = 0; i < 25; i++) {
      assert.strictEqual(resolveBrowserVariant(), first, `pageview ${i + 1} reassigned`);
    }
  } finally {
    restore();
  }
});

test('the pageview path and the trigger path agree, whichever assigns first', () => {
  // The ordering guarantee. page_view is deferred behind requestIdleCallback and
  // the trigger resolves on mount, so either can reach a brand-new browser first.
  // Both must still report one arm, or a single browser would appear in both arms
  // and every rate built on this would be meaningless.
  const pageviewFirst = memStorage();
  let restore = stubWindow(pageviewFirst);
  try {
    const fromPageview = resolveBrowserVariant();
    const fromTrigger = resolveVariant(createSafeStorage(pageviewFirst), () => 0.99);
    assert.strictEqual(fromTrigger, fromPageview, 'trigger must not overwrite the pageview arm');
  } finally {
    restore();
  }

  const triggerFirst = memStorage();
  restore = stubWindow(triggerFirst);
  try {
    const fromTrigger = resolveVariant(createSafeStorage(triggerFirst), () => 0.01);
    assert.strictEqual(fromTrigger, 'control');
    assert.strictEqual(resolveBrowserVariant(), 'control', 'pageview must not re-flip');
  } finally {
    restore();
  }
});

test('the pageview path degrades to unassigned instead of throwing', () => {
  // page_view fires on pages that never mount a trigger and on browsers that
  // refuse storage. Neither may break a page that merely rendered.
  const noStorage = stubWindow(null);
  try {
    assert.doesNotThrow(resolveBrowserVariant);
    assert.strictEqual(resolveBrowserVariant(), 'unassigned');
  } finally {
    noStorage();
  }

  const hostile = stubWindow('throws');
  try {
    assert.doesNotThrow(resolveBrowserVariant);
    assert.strictEqual(resolveBrowserVariant(), 'unassigned');
  } finally {
    hostile();
  }
});

test('the pageview path is SSR-safe with no window at all', () => {
  // track() already early-returns during SSR, but this must not throw even if a
  // future caller reaches it from a server render.
  assert.doesNotThrow(resolveBrowserVariant);
  assert.strictEqual(resolveBrowserVariant(), 'unassigned');
});

test('the pageview path still lands both arms roughly evenly', () => {
  // The same sanity check the trigger path gets. This is the path that will
  // produce the ~800-flip sample the assignment question is settled on, so a
  // wrapper that quietly pinned everyone to one arm would poison exactly the
  // measurement it was added to make.
  let control = 0;
  let treatment = 0;
  for (let i = 0; i < 2000; i++) {
    const restore = stubWindow(memStorage());
    try {
      if (resolveBrowserVariant() === 'control') control += 1;
      else treatment += 1;
    } finally {
      restore();
    }
  }
  assert.ok(control > 800 && control < 1200, `control=${control} outside a sane band`);
  assert.ok(treatment > 800 && treatment < 1200, `variant_a=${treatment} outside a sane band`);
});

test('the kill switch stops the pageview path from touching storage at all', () => {
  // gate.ts promises OFF means no storage touched. CaptureTrigger enforces that
  // for its own path; the pageview path runs on every route with no check of its
  // own, so the promise lives or dies on this.
  const raw = memStorage();
  const restore = stubWindow(raw);
  const prevEnv = process.env.NEXT_PUBLIC_VERCEL_ENV;
  const prevFlag = process.env.NEXT_PUBLIC_CAPTURE_TRIGGER;

  try {
    process.env.NEXT_PUBLIC_VERCEL_ENV = 'production';
    delete process.env.NEXT_PUBLIC_CAPTURE_TRIGGER;

    assert.strictEqual(resolveBrowserVariant(), 'unassigned');
    assert.strictEqual(raw.getItem(KEY_VARIANT), null, 'wrote an arm while switched off');

    // Same browser, same call, switch flipped on: it assigns normally.
    process.env.NEXT_PUBLIC_CAPTURE_TRIGGER = 'true';
    const arm = resolveBrowserVariant();
    assert.ok(isCaptureArm(arm), `expected an arm once enabled, got ${arm}`);
    assert.strictEqual(raw.getItem(KEY_VARIANT), arm);
  } finally {
    restore();
    if (prevEnv === undefined) delete process.env.NEXT_PUBLIC_VERCEL_ENV;
    else process.env.NEXT_PUBLIC_VERCEL_ENV = prevEnv;
    if (prevFlag === undefined) delete process.env.NEXT_PUBLIC_CAPTURE_TRIGGER;
    else process.env.NEXT_PUBLIC_CAPTURE_TRIGGER = prevFlag;
  }
});

test('resolveVariant itself stays ungated, so the trigger keeps its own check', () => {
  // The gate belongs to the CALLER that has no check of its own. Pushing it into
  // resolveVariant would double-gate the trigger and, worse, make the arm depend
  // on an env read from inside a pure function the tests rely on being pure.
  const prevEnv = process.env.NEXT_PUBLIC_VERCEL_ENV;
  const prevFlag = process.env.NEXT_PUBLIC_CAPTURE_TRIGGER;
  try {
    process.env.NEXT_PUBLIC_VERCEL_ENV = 'production';
    delete process.env.NEXT_PUBLIC_CAPTURE_TRIGGER;
    assert.strictEqual(resolveVariant(createSafeStorage(memStorage()), () => 0.1), 'control');
  } finally {
    if (prevEnv === undefined) delete process.env.NEXT_PUBLIC_VERCEL_ENV;
    else process.env.NEXT_PUBLIC_VERCEL_ENV = prevEnv;
    if (prevFlag === undefined) delete process.env.NEXT_PUBLIC_CAPTURE_TRIGGER;
    else process.env.NEXT_PUBLIC_CAPTURE_TRIGGER = prevFlag;
  }
});

test('isCaptureArm accepts only the two arms, and never unassigned', () => {
  assert.strictEqual(isCaptureArm('control'), true);
  assert.strictEqual(isCaptureArm('variant_a'), true);
  assert.strictEqual(isCaptureArm('unassigned'), false, 'unassigned is not an arm');
  assert.strictEqual(isCaptureArm('variant_b'), false);
  assert.strictEqual(isCaptureArm(null), false);
  assert.strictEqual(isCaptureArm(undefined), false);
  assert.strictEqual(isCaptureArm(1), false);
});
