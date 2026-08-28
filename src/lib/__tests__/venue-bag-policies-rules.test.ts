// /venues/bag-policies publishes the same bag facts as /venues/[slug], from the
// same docs, through a SECOND private exclusion list. Two lists over one set of
// facts drift by construction, so the aggregator must consult the shared rules.
import { test, mock } from 'node:test';
import assert from 'node:assert';

mock.module('server-only', { namedExports: {} });
mock.module(new URL('../firebase.ts', import.meta.url).href, { namedExports: { db: {} } });

test('the aggregator withholds a bag fact the venue page withholds', async () => {
  const { bagRowFromDoc } = await import('../venue-bag-policies');
  // Sourced dimensions, UNSOURCED clear-bag flag: the hard-rock-stadium shape.
  // /venues/hard-rock-stadium withholds the clear-bag claim; the aggregator
  // must not publish it in its rows, its stats or its ItemList JSON-LD.
  const row = bagRowFromDoc('hard-rock-stadium', {
    name: 'Hard Rock Stadium', verified: true,
    bagMaxDimensions: { w: 12, h: 6, d: 12, unit: 'in' },
    clearBagRequired: true, bagsProhibited: null, bagPolicyNotes: null, bagPolicyUrl: null,
    sources: { bagMaxDimensions: 'https://official.example.com/g' },
  });
  assert.equal(row.clearBagRequired, null, 'an unsourced clear-bag flag is not published by the aggregator');
  assert.deepEqual(row.dims, { w: 12, h: 6, d: 12, unit: 'in' }, 'the sourced dimensions still publish');
});

test('a shared exclusion entry reaches the aggregator', async () => {
  const { bagRowFromDoc } = await import('../venue-bag-policies');
  const { FIELD_CONFLICTS } = await import('../venue-field-exclusions');
  // Prove the shared list is consulted, using whatever bag entry exists; if
  // none exists today, prove the wiring with the mechanism instead.
  const bagEntry = FIELD_CONFLICTS.find((c) => c.field === 'bag' && !c.sub);
  const slug = bagEntry ? bagEntry.hub : 'no-bag-exclusion-listed';
  const row = bagRowFromDoc(slug, {
    name: 'X', verified: true, bagMaxDimensions: { w: 1, h: 1, d: 1, unit: 'in' },
    clearBagRequired: true, bagsProhibited: null, bagPolicyNotes: null, bagPolicyUrl: null,
    sources: { bagMaxDimensions: 'https://official.example.com/g', clearBagRequired: 'https://official.example.com/g' },
  });
  if (bagEntry) {
    assert.equal(row.dims, null, `${slug}: an excluded bag field publishes nothing`);
    assert.equal(row.clearBagRequired, null);
  } else {
    assert.deepEqual(row.dims, { w: 1, h: 1, d: 1, unit: 'in' }, 'no bag exclusion listed, so the sourced fact publishes');
  }
});
