import { strict as assert } from 'node:assert';
import { readFileSync } from 'node:fs';
import { describe, it } from 'node:test';

/**
 * known-issues entry 46: the chip row's height must not depend on which font is
 * active. Archivo is `display: swap`, next/font's size-adjusted fallback cannot
 * match its horizontal advance widths, and before 04250ee the row's `flex-wrap`
 * turned that width difference into a HEIGHT difference: at 412px row one
 * packed to 358px on the fallback and 369px on Archivo inside a 364px
 * container, so a chip fell to a third line and everything below it moved
 * 41.5px. That was 0.0688 mobile CLS on /nhl/dallas-stars, 69% of the budget
 * spent before any ad existed.
 *
 * WHAT THIS TEST ASSERTS, and what it honestly cannot. Entry 46 asks for the
 * measured version: render under both fonts and assert the height is identical.
 * That needs real layout, and this repo's tests are `node --test` with no DOM
 * and no browser dependency; adding puppeteer here to measure one number would
 * cost more than the defect. So this asserts the PROPERTY THAT MAKES the height
 * font-independent rather than the height itself.
 *
 * The chain is deterministic, which is why the substitution is sound. A flex
 * row that cannot wrap has height = the tallest item's height, which depends on
 * line-height and padding and not on text width. Width changes then have
 * nowhere to go except horizontal overflow, which `overflow-x-auto` absorbs and
 * which moves nothing below it. Every link in that chain is a class on an
 * element, and each is asserted below with the reason attached, so a future
 * edit that breaks one fails here with an explanation instead of silently
 * reintroducing a CLS regression that only a CWV capture on the right URL would
 * ever find.
 *
 * If a browser-based test suite is ever added to this repo, replace this with
 * the measured version entry 46 actually asks for.
 */

const SOURCE = 'src/components/redesign/SeasonExplorer.tsx';
const src = () => readFileSync(SOURCE, 'utf8');

/**
 * The element that holds the chips, located STRUCTURALLY as "the div whose
 * opening tag is immediately followed by a CategoryChip".
 *
 * Deliberately not located by its classes. An earlier draft anchored on
 * `no-scrollbar`, which meant reintroducing `flex-wrap` made the locator miss
 * and the suite failed with "no chip-row scroller found" instead of naming the
 * actual regression. A locator must not depend on the property under test, or
 * the failure message points at the wrong thing exactly when it matters most.
 */
function chipRowClasses(): string {
  const m = src().match(/<div className="([^"]*)">\s*<CategoryChip/);
  assert.ok(
    m,
    `could not find the div that directly contains <CategoryChip> in ${SOURCE}. ` +
      'The chip row has been restructured; re-point this test at the new row ' +
      'rather than deleting it.',
  );
  return m![1];
}

describe('chip row: height cannot depend on the active font', () => {
  it('the row does not wrap, which is what decouples height from text width', () => {
    const cls = chipRowClasses();
    assert.ok(
      !/\bflex-wrap\b/.test(cls),
      'flex-wrap is back on the chip row. With wrapping, a font swap that ' +
        'changes advance widths changes the ROW COUNT and therefore the height, ' +
        'which is exactly the 0.0688 CLS that 04250ee fixed.',
    );
  });

  it('it is still a flex row with horizontal overflow, so extra width goes sideways', () => {
    const cls = chipRowClasses();
    assert.ok(/\bflex\b/.test(cls), 'chip row is no longer a flex row');
    assert.ok(
      /\boverflow-x-auto\b/.test(cls),
      'overflow-x-auto is gone. Without it a row that cannot wrap either clips ' +
        'or forces its container wider; the scroller is what makes "wider than ' +
        'the container" a survivable state.',
    );
  });

  it('every chip refuses to shrink or wrap its own label', () => {
    // shrink-0 stops flex from compressing chips instead of overflowing;
    // whitespace-nowrap stops a label breaking to a second line inside a chip,
    // which would change the chip's height and so the row's.
    const chipClassNames = [...src().matchAll(/className="(shrink-0[^"]*)"/g)].map((m) => m[1]);
    assert.ok(
      chipClassNames.length >= 2,
      `expected at least 2 chips carrying shrink-0, found ${chipClassNames.length}`,
    );
    for (const cls of chipClassNames) {
      assert.ok(/\bshrink-0\b/.test(cls), `chip missing shrink-0: ${cls}`);
      assert.ok(
        /\bwhitespace-nowrap\b/.test(cls),
        `chip missing whitespace-nowrap, so its label can wrap and change the row height: ${cls}`,
      );
    }
  });

  it('no chip sets an explicit height that would mask a wrap regression', () => {
    // A fixed h-* on the row would hide the symptom while leaving the cause,
    // which is worse than the bug: CLS would stay at zero and the chips would
    // silently clip instead.
    const cls = chipRowClasses();
    assert.ok(
      !/\bh-\[?\d/.test(cls),
      'the chip row has an explicit height. That hides a wrap regression rather ' +
        'than preventing one, and clipping chips is not an improvement on moving them.',
    );
  });
});
