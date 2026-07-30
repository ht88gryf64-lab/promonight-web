// A/B arm assignment. The property that matters is STABILITY: an arm that
// changes on reload puts one person in both arms and makes every rate in the
// Phase 2 read meaningless.
//
// Run with:
//   node --import tsx --experimental-test-module-mocks --test <this file>

import { test } from 'node:test';
import assert from 'node:assert';
import { createSafeStorage, KEY_VARIANT, type StorageLike } from '../storage';
import { resolveVariant, isCaptureVariant } from '../variant';

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

test('unavailable storage falls back to control without throwing', () => {
  const s = createSafeStorage(hostileStorage());
  assert.doesNotThrow(() => resolveVariant(s, () => 0.9));
  assert.strictEqual(resolveVariant(s, () => 0.9), 'control');
});

test('a store that silently discards writes yields control, not a fresh arm each load', () => {
  // Quota exhaustion is the realistic case. Without the read-back this would
  // hand out a new arm on every page and quietly corrupt the split.
  const s = createSafeStorage(amnesiacStorage());
  const arms = new Set<string>();
  for (let i = 0; i < 10; i++) arms.add(resolveVariant(s, () => (i % 2 === 0 ? 0.1 : 0.9)));
  assert.deepStrictEqual([...arms], ['control'], 'stable, never reassigning');
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

test('isCaptureVariant rejects anything outside the two arms', () => {
  assert.strictEqual(isCaptureVariant('control'), true);
  assert.strictEqual(isCaptureVariant('variant_a'), true);
  assert.strictEqual(isCaptureVariant('variant_b'), false);
  assert.strictEqual(isCaptureVariant(null), false);
  assert.strictEqual(isCaptureVariant(undefined), false);
  assert.strictEqual(isCaptureVariant(1), false);
});
