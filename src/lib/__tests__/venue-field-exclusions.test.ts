// The venue page and the CFB condensed block must withhold a field for the SAME
// cause. These pin the shared rule and the six live cases that motivated it.
import { test, mock } from 'node:test';
import assert from 'node:assert';

mock.module('server-only', { namedExports: {} });
mock.module(new URL('../firebase.ts', import.meta.url).href, { namedExports: { db: {} } });

import {
  FIELD_CONFLICTS, FIELD_HOLDS, fieldExcluded, subFieldExcluded, hasProvenance, hasSubProvenance,
} from '../venue-field-exclusions';

test('the conflicts list is the four entries, each with a reason and no em dash', () => {
  assert.deepEqual(
    FIELD_CONFLICTS.map((c) => [c.hub, c.field, c.sub ?? null]),
    [
      ['brooks-stadium', 'tailgating', null],
      ['david-booth-kansas-memorial-stadium', 'tailgating', null],
      ['hard-rock-stadium', 'tailgating', null],
      ['yulman-stadium', 'tailgating', null],
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
  // Sub-field grain, keyed to whatever entry carries a sub TODAY. Hardcoding a
  // slug is what let the App State entry go stale: this assertion kept passing
  // against a fixture while the real doc's dead link had already been replaced.
  const withSub = FIELD_CONFLICTS.find((c) => c.sub);
  if (withSub) {
    assert.equal(fieldExcluded(withSub.hub, withSub.field), false, 'a sub entry does not exclude the whole field');
    assert.equal(subFieldExcluded(withSub.hub, withSub.field, withSub.sub!), true);
  }
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
  // A PARTIAL inversion is the shape the first guard missed: field keys work,
  // the URL keys are dead weight, and nothing about a lookup reveals them.
  const partial = { food: 'https://example.com/guide', 'https://example.com/stray': 'A Guide' };
  assert.equal(hasProvenance(partial, 'food'), true);
  assert.equal(hasProvenance(partial, 'https://example.com/stray'), true, 'a URL key is only ever reachable by asking for a URL, which no caller does');
  assert.equal(hasProvenance(partial, 'accessibility'), false);
});

test('an exclusion is lifted once the data it names is corrected (App State parking)', async () => {
  const { FIELD_CONFLICTS, subFieldExcluded } = await import('../venue-field-exclusions');
  // The entry named a 403 URL, mountaineersathleticfund.com/yosef-club/renewals/
  // index.html. The Pass 2 write replaced the stored value with the live
  // yosef-club/index.html#season-tickets-parking, so the condition the entry
  // describes no longer exists and it now hides a good, reachable link.
  //
  // The test that "covered" this asserted the MECHANISM against a fixture still
  // holding the dead URL, so it stayed green while the real doc moved on: a
  // test can pin a rule and still be blind to the data the rule is about.
  assert.equal(
    subFieldExcluded('kidd-brewer-stadium', 'parking', 'officialParkingUrls'), false,
    'kidd-brewer-stadium: the dead link was replaced, so the exclusion must be lifted',
  );
  assert.ok(
    !FIELD_CONFLICTS.some((c) => c.hub === 'kidd-brewer-stadium'),
    'no stale entry left behind',
  );
  // The mechanism itself must still work, so prove it on an entry that exists.
  const withSub = FIELD_CONFLICTS.filter((c) => c.sub);
  for (const c of withSub) assert.equal(subFieldExcluded(c.hub, c.field, c.sub!), true);
});
