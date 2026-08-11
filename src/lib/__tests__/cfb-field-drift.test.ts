import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  MACHINE_OWNED_CRITICAL, MACHINE_OWNED_DEGRADE, findFieldDrift, HUMAN_OWNED_FIELDS,
} from '../cfb/human-owned';

// Two tiers, on purpose. LOSS empties a page because the /cfb/rivalries family
// keys on rivalryId. DEGRADE does not. Folding them together would bury the one
// that matters under the one that does not.

const stored = {
  rivalryId: 'notre-dame--stanford',
  broadcast: { network: 'NBC and Peacock', confirmed: true },
  kickoff: { time: 'TBD', tz: 'ET', tbd: true },
};

test('the two tiers hold different fields and do not overlap', () => {
  assert.deepEqual([...MACHINE_OWNED_CRITICAL], ['rivalryId']);
  assert.deepEqual([...MACHINE_OWNED_DEGRADE], ['broadcast.network', 'kickoff.tz']);
  const overlap = MACHINE_OWNED_DEGRADE.filter((f) => (MACHINE_OWNED_CRITICAL as readonly string[]).includes(f));
  assert.deepEqual(overlap, []);
});

test('none of the tracked machine fields is in the human-owned allowlist', () => {
  for (const f of [...MACHINE_OWNED_CRITICAL, ...MACHINE_OWNED_DEGRADE]) {
    assert.equal((HUMAN_OWNED_FIELDS as readonly string[]).includes(f), false, f);
  }
});

test('a nulled rivalryId is LOSS', () => {
  const d = findFieldDrift(stored, { ...stored, rivalryId: null });
  assert.deepEqual(d, [{ field: 'rivalryId', tier: 'LOSS', was: 'notre-dame--stanford', now: null }]);
});

test('a changed broadcast network is DEGRADE, not LOSS', () => {
  const d = findFieldDrift(stored, { ...stored, broadcast: { network: 'NBC', confirmed: true } });
  assert.equal(d.length, 1);
  assert.equal(d[0].tier, 'DEGRADE');
  assert.equal(d[0].field, 'broadcast.network');
  assert.equal(d[0].was, 'NBC and Peacock');
  assert.equal(d[0].now, 'NBC');
});

test('a flipped kickoff timezone is DEGRADE', () => {
  const d = findFieldDrift(stored, { ...stored, kickoff: { time: 'TBD', tz: 'TBD', tbd: true } });
  assert.equal(d.length, 1);
  assert.equal(d[0].tier, 'DEGRADE');
  assert.equal(d[0].field, 'kickoff.tz');
});

test('nested paths resolve, so a missing parent object does not throw', () => {
  const d = findFieldDrift(stored, { rivalryId: 'notre-dame--stanford' });
  // broadcast and kickoff are absent entirely; both degrade fields report.
  assert.equal(d.every((x) => x.tier === 'DEGRADE'), true);
  assert.deepEqual(d.map((x) => x.field).sort(), ['broadcast.network', 'kickoff.tz']);
});

test('an unchanged doc reports nothing at either tier', () => {
  assert.deepEqual(findFieldDrift(stored, { ...stored }), []);
});

test('a doc that did not exist before reports nothing', () => {
  assert.deepEqual(findFieldDrift(undefined, { rivalryId: null }), []);
});

test('both tiers can fire on one doc and stay separable', () => {
  const d = findFieldDrift(stored, {
    rivalryId: null,
    broadcast: { network: 'NBC', confirmed: true },
    kickoff: { time: 'TBD', tz: 'TBD', tbd: true },
  });
  assert.equal(d.filter((x) => x.tier === 'LOSS').length, 1);
  assert.equal(d.filter((x) => x.tier === 'DEGRADE').length, 2);
});

test('a degrade field that was already null is not reported as drift', () => {
  const s = { broadcast: { network: null }, kickoff: { tz: null } };
  assert.deepEqual(findFieldDrift(s, { broadcast: { network: 'NBC' }, kickoff: { tz: 'ET' } }), []);
});
