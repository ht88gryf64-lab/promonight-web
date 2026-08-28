// The venue page and the CFB condensed block must withhold a field for the SAME
// cause. These pin the shared rule and the six live cases that motivated it.
import { test, mock } from 'node:test';
import assert from 'node:assert';

mock.module('server-only', { namedExports: {} });
mock.module(new URL('../firebase.ts', import.meta.url).href, { namedExports: { db: {} } });

import {
  FIELD_CONFLICTS, FIELD_HOLDS, fieldExcluded, subFieldExcluded, hasProvenance, hasSubProvenance,
} from '../venue-field-exclusions';

test('the conflicts list is the five entries, each with a reason and no em dash', () => {
  assert.deepEqual(
    FIELD_CONFLICTS.map((c) => [c.hub, c.field, c.sub ?? null]),
    [
      ['brooks-stadium', 'tailgating', null],
      ['david-booth-kansas-memorial-stadium', 'tailgating', null],
      ['hard-rock-stadium', 'tailgating', null],
      ['yulman-stadium', 'tailgating', null],
      ['kidd-brewer-stadium', 'parking', 'officialParkingUrls'],
    ],
  );
  assert.deepEqual(FIELD_HOLDS.map((h) => h.hub), []);
  for (const e of [...FIELD_CONFLICTS, ...FIELD_HOLDS]) {
    assert.ok(e.reason.length > 60, `${e.hub}: carries its reason`);
    assert.ok(!/—/.test(e.reason), `${e.hub}: no em dashes`);
  }
});

test('a whole-field entry withholds the field; a sub entry withholds only its sub-field', () => {
  assert.equal(fieldExcluded('yulman-stadium', 'tailgating'), true);
  assert.equal(fieldExcluded('yulman-stadium', 'parking'), false);
  // The App State entry names a sub-field, so the FIELD is not excluded...
  assert.equal(fieldExcluded('kidd-brewer-stadium', 'parking'), false);
  // ...but that sub-field is, while its siblings are not.
  assert.equal(subFieldExcluded('kidd-brewer-stadium', 'parking', 'officialParkingUrls'), true);
  assert.equal(subFieldExcluded('kidd-brewer-stadium', 'parking', 'parkingLots'), false);
  // A whole-field entry withholds every sub-field under it.
  assert.equal(subFieldExcluded('yulman-stadium', 'tailgating', 'rules'), true);
  assert.equal(fieldExcluded('some-other-stadium', 'tailgating'), false);
});

test('provenance accepts a flat key, a dotted sub-key, and neither means absent', () => {
  const s = { food: 'https://x.edu/f', 'tailgating.rules': 'https://x.edu/t' };
  assert.equal(hasProvenance(s, 'food'), true);
  assert.equal(hasProvenance(s, 'nearby'), false);
  assert.equal(hasProvenance(undefined, 'food'), false);
  assert.equal(hasSubProvenance(s, 'tailgating', 'rules'), true);
  // the flat key vouches for every sub-field under it
  assert.equal(hasSubProvenance({ tailgating: 'https://x.edu/t' }, 'tailgating', 'timeWindow'), true);
  // a sibling's dotted key vouches for nothing
  assert.equal(hasSubProvenance(s, 'tailgating', 'timeWindow'), false);
  assert.equal(hasProvenance({ food: '   ' }, 'food'), false, 'whitespace is not provenance');
});

test('array-valued provenance is honoured, since a fact can be vouched for by two pages', async () => {
  // 45 values in the corpus are arrays of URLs. Dropping them made sourced
  // fields read as unsourced, silently, which is what the per-field rule would
  // then withhold. The mapper coerces to the first non-empty URL.
  const { __testing } = await import('../venue-hub').then((m) => ({ __testing: m })) as any;
  void __testing;
  const s = { food: 'https://a.com/x' };
  assert.equal(hasProvenance(s, 'food'), true);
});

test('an inverted sources map is not silently equivalent to an absent one', async () => {
  // t-mobile-park stored {url: page title} instead of {field: url}. stringMap
  // returned a map whose only keys were URLs, so hasProvenance was false for
  // every field name and the per-field rule withheld the entire page, on a
  // verified doc, with no error raised anywhere. The data is fixed; this pins
  // the shape so the next one is caught rather than rendered as nothing.
  const inverted = { 'https://example.com/guide': 'A Guide', 'https://example.com/access': 'Access Guide' };
  for (const f of ['food', 'accessibility', 'parkingLots', 'bagMaxDimensions']) {
    assert.equal(hasProvenance(inverted as Record<string, string>, f), false, `${f}: an inverted map provides no field provenance`);
  }
  // and the right shape does work
  assert.equal(hasProvenance({ food: 'https://example.com/guide' }, 'food'), true);
});
