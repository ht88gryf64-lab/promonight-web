// Copy selection for the signup success card.
//
// The repo has no render-test harness (no testing-library, jsdom, happy-dom,
// vitest or jest in package.json), so the card itself is not rendered here.
// The branching is what can be wrong, so it lives in the pure successVariant()
// and is tested directly; the copy strings stay inline in the JSX.
//
// Run with:
//   node --import tsx --experimental-test-module-mocks --test <this file>

import { test } from 'node:test';
import assert from 'node:assert';
import { successVariant } from '../FollowForm';

test('a sent confirmation renders the confident copy', () => {
  assert.strictEqual(successVariant('sent', 'pending'), 'confident');
});

test('a suppressed re-submit renders the confident copy', () => {
  // not_needed + pending. A link was delivered for the token the record still
  // holds, since both suppressors require that, so it is live and usable and
  // the confident copy is true.
  assert.strictEqual(successVariant('not_needed', 'pending'), 'confident');
});

test('an already-confirmed re-submit renders the already-subscribed copy', () => {
  // not_needed + confirmed. The old copy promised a link here and every clause
  // of it was false. This split is the fix.
  assert.strictEqual(successVariant('not_needed', 'confirmed'), 'already_subscribed');
});

test('a failed send renders the failure copy regardless of status', () => {
  assert.strictEqual(successVariant('failed', 'pending'), 'failed');
  assert.strictEqual(successVariant('failed', 'confirmed'), 'failed');
});

test('a missing or unknown value degrades to the confident copy', () => {
  // A client running against an older deploy sees no confirmation field. It must
  // behave exactly as it did before rather than show a wrong failure message.
  assert.strictEqual(successVariant(undefined, 'pending'), 'confident');
  assert.strictEqual(successVariant(undefined, undefined), 'confident');
  assert.strictEqual(
    successVariant('nonsense' as unknown as 'sent', 'pending'),
    'confident',
    'an unexpected value must never invent a failure',
  );
});

test('already_subscribed requires BOTH not_needed and confirmed', () => {
  // Guards the pairing: 'sent' with a confirmed status is not the
  // already-subscribed case, it is a genuine send.
  assert.strictEqual(successVariant('sent', 'confirmed'), 'confident');
});
