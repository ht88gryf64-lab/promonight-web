import { strict as assert } from 'node:assert';
import { readFileSync } from 'node:fs';
import { describe, it } from 'node:test';

import {
  WEAVE_MOBILE_QUERY,
  assignedOrderFor,
  hasUniqueOrders,
  isPlacementValid,
  nextAuthoredAfter,
} from '../weave-ad-order';

const TEAM_PAGE = 'src/components/redesign/RedesignTeamPage.tsx';
const GLOBALS = 'src/app/globals.css';

/**
 * Read the authored order values out of the template rather than restating
 * them here. A test that hardcodes the list passes happily while the page it
 * describes drifts away underneath it; this one fails when the real values
 * move, which is the point.
 */
function authoredOrders(): number[] {
  const src = readFileSync(TEAM_PAGE, 'utf8');
  const out = new Set<number>();
  for (const m of src.matchAll(/\border-\[(\d+)\]/g)) out.add(Number(m[1]));
  return [...out].sort((a, b) => a - b);
}

describe('weave ad order: the authored scale it depends on', () => {
  it('finds the authored order values in the template', () => {
    const o = authoredOrders();
    assert.ok(o.length >= 13, `expected at least 13 authored orders, found ${o.length}`);
  });

  it('the DISTINCT scale is what the invariant is checked against', () => {
    // Deliberately a distinct set. The template emits the same order value in
    // both arms of several mutually-exclusive ternaries (10 and 11 on the
    // populated vs zero-promo schedule branch, and so on), so a raw source
    // scrape sees ~30 values with duplicates while any single render emits 13.
    // Source-level uniqueness is therefore NOT the property to assert here.
    //
    // What the document-order tie-break actually needs is that no two items
    // RENDERED TOGETHER share an order, which is a runtime fact this file
    // cannot see. It is measured in the browser instead, on the real page.
    const o = authoredOrders();
    assert.ok(hasUniqueOrders(o), 'the distinct set is unique by construction');
    assert.ok(o.length >= 13, `expected >= 13 distinct values, found ${o.length}`);
  });

  it('the scale still contains adjacent runs, so no midpoint strategy exists', () => {
    // Guards the reasoning, not just the output: if this ever stops being true
    // someone may reasonably revisit the equal-order approach.
    const o = authoredOrders();
    const adjacent = o.some((v, i) => i > 0 && v - o[i - 1] === 1);
    assert.equal(adjacent, true, 'expected at least one pair of consecutive integers (e.g. 40/41)');
  });
});

describe('weave ad order: placement invariant', () => {
  it('every authored anchor places its container before the next section', () => {
    const o = authoredOrders();
    for (const anchor of o) {
      const assigned = assignedOrderFor(anchor);
      assert.ok(
        isPlacementValid(assigned, anchor, o),
        `order ${assigned} assigned for anchor ${anchor} does not sit before ${nextAuthoredAfter(anchor, o)}`,
      );
    }
  });

  it('places strictly below the order floor, so a placed unit is never floored', () => {
    for (const anchor of authoredOrders()) {
      assert.ok(assignedOrderFor(anchor) < 900);
    }
  });

  it('rejects a value that would jump past the next authored section', () => {
    const authored = [10, 20, 30, 40, 41, 42, 43, 50];
    assert.equal(isPlacementValid(40, 40, authored), true);
    assert.equal(isPlacementValid(41, 40, authored), false, '41 collides with the next section');
    assert.equal(isPlacementValid(45, 40, authored), false, '45 jumps past 41, 42 and 43');
    assert.equal(isPlacementValid(39, 40, authored), false, 'never before the anchor');
  });

  it('a fixed +5 would break the tight runs, which is why it is not used', () => {
    const authored = authoredOrders();
    const broken = authored.filter((a) => !isPlacementValid(a + 5, a, authored));
    assert.ok(broken.length > 0, 'expected +5 to be invalid for the adjacent runs');
  });

  it('the last authored section has no upper bound', () => {
    const authored = [10, 20, 80];
    assert.equal(nextAuthoredAfter(80, authored), null);
    assert.equal(isPlacementValid(80, 80, authored), true);
  });

  it('a non-integer is never a valid order, per the CSS grammar', () => {
    assert.equal(isPlacementValid(40.5, 40, [40, 41]), false);
  });
});

describe('weave ad order: breakpoint agreement with the floor', () => {
  it('uses the same max-width the floor in globals.css uses', () => {
    const css = readFileSync(GLOBALS, 'utf8');
    const m = WEAVE_MOBILE_QUERY.match(/max-width:\s*(\d+)px/);
    assert.ok(m, 'query must pin a max-width');
    assert.ok(
      css.includes(`@media (max-width: ${m[1]}px)`),
      `globals.css has no floor at max-width ${m[1]}px; the two must move together`,
    );
  });
});
