import { test } from 'node:test';
import assert from 'node:assert/strict';
import { MACHINE_OWNED_CRITICAL, findCriticalLosses } from '../cfb/human-owned';
import { HUMAN_OWNED_FIELDS } from '../cfb/human-owned';

// The tripwire exists because a scoped run-phase2 run was measured nulling
// rivalryId on 5 of 14 notre-dame docs. Two of those back registry matchup
// pages, and the whole /cfb/rivalries family keys on the field.

test('the critical list is exactly rivalryId', () => {
  assert.deepEqual([...MACHINE_OWNED_CRITICAL], ['rivalryId']);
});

test('rivalryId is NOT in the human-owned allowlist', () => {
  // Preserving it would carry a stale tag the fresh parse disagrees with, which
  // is worse than an absent one. It is tripwired, never preserved.
  assert.equal((HUMAN_OWNED_FIELDS as readonly string[]).includes('rivalryId'), false);
});

test('flags a populated field about to go null', () => {
  const losses = findCriticalLosses(
    { rivalryId: 'notre-dame--stanford' },
    { rivalryId: null },
  );
  assert.deepEqual(losses, [{ field: 'rivalryId', was: 'notre-dame--stanford' }]);
});

test('flags a populated field about to go absent', () => {
  const losses = findCriticalLosses({ rivalryId: 'michigan-state--notre-dame' }, {});
  assert.deepEqual(losses, [{ field: 'rivalryId', was: 'michigan-state--notre-dame' }]);
});

test('does not flag null to null, which loses nothing', () => {
  assert.deepEqual(findCriticalLosses({ rivalryId: null }, { rivalryId: null }), []);
});

test('does not flag null to populated, which is a gain', () => {
  assert.deepEqual(findCriticalLosses({ rivalryId: null }, { rivalryId: 'army--navy' }), []);
});

test('does not flag an unchanged populated field', () => {
  assert.deepEqual(
    findCriticalLosses({ rivalryId: 'army--navy' }, { rivalryId: 'army--navy' }),
    [],
  );
});

test('does not flag a CHANGED populated field, only a lost one', () => {
  // A different non-null value is a re-tag, not a loss. The tripwire is scoped
  // to disappearance so it stays a signal rather than noise.
  assert.deepEqual(
    findCriticalLosses({ rivalryId: 'army--navy' }, { rivalryId: 'navy--notre-dame' }),
    [],
  );
});

test('a doc that did not exist before loses nothing', () => {
  assert.deepEqual(findCriticalLosses(undefined, { rivalryId: null }), []);
  assert.deepEqual(findCriticalLosses(null, { rivalryId: null }), []);
});

test('reproduces the five notre-dame losses measured at the 1A gate', () => {
  const stored = [
    ['2026-2026-09-19-notre-dame-michigan-state', 'michigan-state--notre-dame'],
    ['2026-2026-09-26-purdue-notre-dame', 'notre-dame--purdue'],
    ['2026-2026-10-10-notre-dame-stanford', 'notre-dame--stanford'],
    ['2026-2026-10-31-navy-notre-dame', 'navy--notre-dame'],
    ['2026-2026-11-14-notre-dame-boston-college', 'boston-college--notre-dame'],
  ];
  // A scoped run reports rivalries=0, so every incoming doc carries null.
  const flagged = stored.filter(([, rid]) => findCriticalLosses({ rivalryId: rid }, { rivalryId: null }).length === 1);
  assert.equal(flagged.length, 5);
});
