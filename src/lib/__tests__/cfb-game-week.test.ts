import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { cfbGameWeek, cfbWeekNumber } from '../cfb/week';

// The stored cfbGames.week is the parsing school's game ORDINAL (rules.ts
// computeWeeks: byes consume nothing), written onto a doc BOTH schools share. So
// the away school inherits the home school's ordinal: on /cfb/tennessee the
// Oct 17 Alabama game and the Oct 24 South Carolina game both read "Wk 7", and
// 48 of 87 school pages carry a duplicate. The label has to come from the DATE.
//
// College football's week runs Thursday to Monday (Week 1 is Thu Sep 3 to Mon
// Sep 7, Labor Day), so a game week is Tuesday-to-Monday: the rail counter
// (cfbWeekNumber, Monday-to-Sunday to match the rail window) shifted by one day.

describe('cfbGameWeek', () => {
  test('Tennessee: Oct 17 and Oct 24 are different weeks, 7 and 8', () => {
    assert.equal(cfbGameWeek('2026-10-17'), 7);
    assert.equal(cfbGameWeek('2026-10-24'), 8);
  });

  test('Washington State: every label is the calendar week of its date', () => {
    // Stored ordinals rendered 1, 2, 4, 5, 7, 9. The dates say:
    assert.deepEqual(
      ['2026-09-06', '2026-09-12', '2026-09-26', '2026-10-03', '2026-10-24', '2026-10-31'].map(cfbGameWeek),
      [1, 2, 4, 5, 8, 9],
    );
  });

  test('a Monday game belongs to the week that ends on it (Labor Day Sep 7 is Week 1)', () => {
    assert.equal(cfbGameWeek('2026-09-07'), 1);
    assert.equal(cfbGameWeek('2026-09-05'), 1);
    assert.equal(cfbGameWeek('2026-09-03'), 1); // Thursday opener
    assert.equal(cfbGameWeek('2026-09-08'), 2); // Tuesday, the next week
    // Documented divergence from the rail: the rail window is Monday-to-Sunday,
    // so its counter calls Sep 7 Week 2 (cfb-week.test.ts KNOWN RESIDUAL).
    assert.equal(cfbWeekNumber('2026-09-07'), 2);
  });

  test('Week 0 (the Aug 29 slate) is unlabelled, matching the rail', () => {
    assert.equal(cfbGameWeek('2026-08-29'), null);
    assert.equal(cfbGameWeek('2026-08-31'), null); // Monday before Week 1 opens
  });

  test('late season still counts by date', () => {
    assert.equal(cfbGameWeek('2026-11-28'), 13); // rivalry Saturday
    assert.equal(cfbGameWeek('2026-12-12'), 15); // Army-Navy
  });
});
