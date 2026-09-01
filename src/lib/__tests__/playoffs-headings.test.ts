import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { offseasonHeadingTag } from '../playoffs-headings';

// The /playoffs offseason view and the champions celebration are two components
// that both want to own the page's h1, and only one of them can.
//
// Before 2026-09-01 the page served NO h1: the offseason early return sits above
// the live hub's heading, so the highest heading in <main> was an h2. The
// obvious fix, promote it, is wrong on its own, because ChampionsCelebration
// already renders an h1 and mounts directly above that section whenever the
// champions window is open. An unconditional promotion trades "no h1" for "two
// h1s" and only shows it next June, when nobody is looking at this file.
//
// WHAT THIS PROVES: the decision rule, and the fact that the celebration renders
// exactly one h1 today. WHAT IT DOES NOT PROVE: that the rendered DOM has one
// h1, because PlayoffsOffseason is an async server component that reads
// Firestore and this suite has no renderer. The served-HTML check at the gate
// covers the non-champions case; this covers the case the calendar will not let
// us observe until next June.

const CHAMPIONS_COMPONENT = join(
  process.cwd(),
  'src',
  'components',
  'champions',
  'champions-celebration.tsx',
);

describe('/playoffs offseason headings', () => {
  test('the offseason section takes the h1 when the celebration is not showing', () => {
    assert.equal(offseasonHeadingTag(false), 'h1');
  });

  test('the offseason section steps down to h2 when the celebration mounts above it', () => {
    assert.equal(offseasonHeadingTag(true), 'h2');
  });

  test('ChampionsCelebration renders exactly one h1, which is why the step-down exists', () => {
    const source = readFileSync(CHAMPIONS_COMPONENT, 'utf8');
    const h1s = source.match(/<h1[\s>]/g) ?? [];
    assert.equal(
      h1s.length,
      1,
      'ChampionsCelebration no longer renders exactly one h1. If it now renders ' +
        'none, offseasonHeadingTag(true) should return h1 and this coupling can go. ' +
        'If it renders two, that is its own defect.',
    );
  });

  test('the two branches never both claim h1', () => {
    const tags = [offseasonHeadingTag(true), offseasonHeadingTag(false)];
    assert.equal(tags.filter((t) => t === 'h1').length, 1);
  });
});
