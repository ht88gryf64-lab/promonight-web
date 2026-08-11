import { test } from 'node:test';
import assert from 'node:assert/strict';
import { matchupKey } from '../cfb/rules';

// The defect: an ordered [home, away] key split one fixture into two whenever
// both schools' schedule pages claimed the game and each named itself home.
// These are the 7 real pairs that survived every prior reconcile pass.
const SWAP_PAIRS: Array<[string, string]> = [
  ['north-carolina', 'tcu'],
  ['auburn', 'baylor'],
  ['louisville', 'ole-miss'],
  ['notre-dame', 'wisconsin'],
  ['florida', 'georgia'],
  ['navy', 'notre-dame'],
  ['army', 'navy'],
];

test('matchupKey collapses a home/away swap to one key', () => {
  for (const [a, b] of SWAP_PAIRS) {
    assert.equal(
      matchupKey(a, b),
      matchupKey(b, a),
      `${a} vs ${b} must produce one key regardless of which school is stored as home`,
    );
  }
});

test('the 7 swap pairs collapse to exactly 7 distinct keys, not 14', () => {
  const keys = new Set<string>();
  for (const [a, b] of SWAP_PAIRS) {
    keys.add(matchupKey(a, b));
    keys.add(matchupKey(b, a));
  }
  assert.equal(keys.size, 7);
});

test('the old ordered key would have produced 14, which is the defect', () => {
  const ordered = (h: string, a: string) => [h, a].join('|');
  const keys = new Set<string>();
  for (const [a, b] of SWAP_PAIRS) {
    keys.add(ordered(a, b));
    keys.add(ordered(b, a));
  }
  assert.equal(keys.size, 14);
});

test('different fixtures still get different keys', () => {
  assert.notEqual(matchupKey('florida', 'georgia'), matchupKey('florida', 'auburn'));
  assert.notEqual(matchupKey('army', 'navy'), matchupKey('navy', 'notre-dame'));
});

test('the key is stable and sorted, so it does not depend on argument order', () => {
  assert.equal(matchupKey('georgia', 'florida'), 'florida|georgia');
  assert.equal(matchupKey('florida', 'georgia'), 'florida|georgia');
});
