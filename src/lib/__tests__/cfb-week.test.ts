import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { cfbWeekNumber } from '../cfb/week';

// The /cfb rail printed "WEEK 2" over the Sep 5 and Sep 6 games on 2026-09-01.
// Those are Week 1. The site contradicted itself: /cfb/washington rendered
// "Wk 1" for the same Apple Cup fixture, and the school page was right.
//
// The arithmetic was never wrong. The season constant was: '2026-08-24' called
// itself "Monday of Week 1" and is the Monday of Week 0, the Aug 29 slate.
//
// 2026 season shape, which these dates encode:
//   Week 0   Saturday Aug 29
//   Week 1   Thursday Sep 3 to Monday Sep 7, first full Saturday Sep 5
//   Labor Day Sep 7, and Week 1 is the week containing Labor Day weekend,
//   so its Monday is Aug 31.

describe('cfbWeekNumber', () => {
  test('the Labor Day weekend slate is Week 1, which is what the rail got wrong', () => {
    assert.equal(cfbWeekNumber('2026-09-01'), 1); // the day the audit ran
    assert.equal(cfbWeekNumber('2026-09-05'), 1); // first full Saturday
    assert.equal(cfbWeekNumber('2026-09-06'), 1); // Apple Cup, Sunday
  });

  test('KNOWN RESIDUAL: Labor Day Monday reads Week 2, because the rail week is Monday to Sunday', () => {
    // Sep 7 2026 is Labor Day and part of college football's Week 1, which runs
    // Thursday Sep 3 to Monday Sep 7. This counter says 2, and that is not a
    // second off-by-one: it is faithful to the window it labels. The rail slices
    // its games Monday through Sunday (`backToMon` in hub-data.ts), so a Sep 7
    // game sits in the NEXT rail window, and labelling that window Week 1 would
    // put two different weeks under one number.
    //
    // The real fix is to move the rail window to Tuesday-to-Monday, which is
    // what the NFL hub already does and why Monday Night Football stays inside
    // its own week there. That changes which games the rail shows, so it is a
    // separate change from correcting the season constant. There IS a Monday
    // Sep 7 game in the 2026 corpus, so this is a live edge, not a hypothetical.
    assert.equal(cfbWeekNumber('2026-09-07'), 2);
  });

  test('the rail agrees with /cfb/washington, which renders Wk 1 for the Apple Cup', () => {
    assert.equal(cfbWeekNumber('2026-09-06'), 1);
  });

  test('the week rolls on Monday, matching the rail window it labels', () => {
    assert.equal(cfbWeekNumber('2026-08-31'), 1); // Monday, week 1 opens
    assert.equal(cfbWeekNumber('2026-09-06'), 1); // Sunday, week 1 closes
    assert.equal(cfbWeekNumber('2026-09-07'), 2); // Monday, rolls
    assert.equal(cfbWeekNumber('2026-09-12'), 2); // week 2 Saturday
    assert.equal(cfbWeekNumber('2026-09-19'), 3);
  });

  test('Week 0 is unlabelled rather than mislabelled Week 1', () => {
    assert.equal(cfbWeekNumber('2026-08-29'), null); // the Week 0 slate
    assert.equal(cfbWeekNumber('2026-08-30'), null);
    assert.equal(cfbWeekNumber('2026-08-24'), null); // the old, wrong anchor
  });

  test('the old anchor would have returned 2 for every one of these', () => {
    // Guards the specific off-by-one rather than the general shape: with
    // seasonStart '2026-08-24', Sep 1 through Sep 6 all landed in week 2.
    const oldAnchorWeek = (today: string) => {
      const [ay, am, ad] = '2026-08-24'.split('-').map(Number);
      const [by, bm, bd] = today.split('-').map(Number);
      const diff = Math.round((Date.UTC(by, bm - 1, bd) - Date.UTC(ay, am - 1, ad)) / 86400000);
      return diff < 0 ? null : Math.min(15, Math.floor(diff / 7) + 1);
    };
    for (const d of ['2026-09-01', '2026-09-05', '2026-09-06']) {
      assert.equal(oldAnchorWeek(d), 2, `old anchor should reproduce the bug on ${d}`);
      assert.equal(cfbWeekNumber(d), 1);
    }
  });

  test('deep into the season it still counts, and caps at 15', () => {
    assert.equal(cfbWeekNumber('2026-11-28'), 13); // rivalry Saturday
    assert.equal(cfbWeekNumber('2027-06-01'), 15); // far past the season, capped
  });
});
