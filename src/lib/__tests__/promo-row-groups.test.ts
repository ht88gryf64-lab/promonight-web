import { strict as assert } from 'node:assert';
import { readFileSync } from 'node:fs';
import { describe, it } from 'node:test';

import { PROMO_ROWS_PER_AD_GROUP, groupPromoRows } from '../promo-row-groups';

const rows = (n: number) => Array.from({ length: n }, (_, i) => i);
const shape = (n: number) => {
  const g = groupPromoRows(rows(n));
  return { anchors: g.anchors.map((a) => a.rows.length), tail: g.tail.rows.length };
};

describe('groupPromoRows', () => {
  it('is four per group', () => assert.equal(PROMO_ROWS_PER_AD_GROUP, 4));

  it('ten visible rows: two anchor groups and a two-row tail', () => {
    assert.deepEqual(shape(10), { anchors: [4, 4], tail: 2 });
  });

  it('the last group is never an anchor, whatever its size', () => {
    assert.deepEqual(shape(9), { anchors: [4, 4], tail: 1 });
    assert.deepEqual(shape(8), { anchors: [4], tail: 4 });
    assert.deepEqual(shape(5), { anchors: [4], tail: 1 });
  });

  it('one group or fewer means no anchors at all, so no wrapper is rendered', () => {
    for (const n of [0, 1, 2, 3, 4]) assert.deepEqual(shape(n).anchors, [], `n=${n}`);
    assert.equal(shape(4).tail, 4);
    assert.equal(shape(0).tail, 0);
  });

  it('keeps every row exactly once, in order, with correct start offsets', () => {
    for (const n of [0, 1, 4, 5, 8, 9, 10]) {
      const g = groupPromoRows(rows(n));
      const all = [...g.anchors, g.tail];
      assert.deepEqual(all.flatMap((x) => x.rows), rows(n));
      for (const x of all) if (x.rows.length) assert.equal(x.start, x.rows[0]);
    }
  });
});

describe('promo-list.tsx uses the groups the way Raptive needs', () => {
  // Comments stripped: the one above the rows box names <Suspense> on purpose.
  const src = readFileSync('src/components/promo-list.tsx', 'utf8').replace(
    /\{\/\*[\s\S]*?\*\/\}|\/\*[\s\S]*?\*\/|^\s*\/\/.*$/gm,
    '',
  );

  it('page-content appears once, on the anchor parent, inside the rows box', () => {
    assert.equal(src.split('page-content"').length - 1, 1);
    assert.match(src, /<div className="space-y-3 page-content">/);
  });

  it('is not inside a Suspense boundary', () => {
    assert.doesNotMatch(src, /<Suspense/);
  });
});
