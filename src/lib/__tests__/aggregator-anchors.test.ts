import { strict as assert } from 'node:assert';
import { readFileSync } from 'node:fs';
import { describe, it } from 'node:test';

/**
 * In-content ad anchors on aggregator-layout pages (bobbleheads, jersey
 * giveaways, theme nights, and every other collection that renders
 * RedesignAggregatorList). The promo-list pattern, reused: rows grouped in
 * fours inside each section, the anchor parent carrying `page-content`, the
 * last group outside it. Each assertion is a way a tidy-up could put the class
 * on the wrong element, where Raptive's `.page-content > *` rule would anchor
 * on a 0px placeholder or on a 14,000px section.
 */
const LIST = 'src/components/redesign/RedesignAggregatorList.tsx';
const LAYOUT = 'src/components/aggregator-layout.tsx';
const strip = (s: string) => s.replace(/\{\/\*[\s\S]*?\*\/\}|\/\*[\s\S]*?\*\/|^\s*\/\/.*$/gm, '');

describe('RedesignAggregatorList anchors', () => {
  const code = strip(readFileSync(LIST, 'utf8'));

  it('reuses the promo-list grouping rather than copying it', () => {
    assert.match(code, /import \{ groupPromoRows \} from '@\/lib\/promo-row-groups';/);
    assert.match(code, /groupPromoRows\(group\.promos\)/);
  });

  it('puts page-content on one anchor parent inside the row container, nowhere else', () => {
    assert.equal(code.split('page-content').length - 1, 1);
    assert.match(code, /<div className="space-y-2\.5">\s*\{rowGroups\.anchors\.length > 0 && \(\s*<div className="space-y-2\.5 page-content">/);
    assert.doesNotMatch(code, /space-y-10 page-content|page-content space-y-10/);
  });

  it('keeps the last group of every section outside the anchor parent', () => {
    assert.match(code, /renderGroup\(rowGroups\.tail\.rows, rowGroups\.tail\.start/);
    assert.match(code, /: rowGroups\.tail\.rows\.map\(\(p, j\) => renderRow\(p, j\)\)/, 'single-group section renders flat');
  });

  it('is not inside a Suspense boundary and reads no clock in render', () => {
    assert.doesNotMatch(code, /<Suspense|new Date\(\)|Date\.now\(\)/);
  });
});

describe('aggregator-layout keeps the class off the wrapper', () => {
  it('the outer wrapper and its 0px AdSlot placeholders are not anchors', () => {
    const code = strip(readFileSync(LAYOUT, 'utf8'));
    assert.doesNotMatch(code, /page-content/);
  });
});
