import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { isPlayedGame, chicagoTodayYMD, todayYMD, venueTodayYMD, dateRangeLabel } from '../cfb/clock';

// No status transition exists: cfbGames.status is 'scheduled' on all 670 docs,
// including the six Aug 29 games already played. "Played" is derived from the
// date against the America/Chicago calendar day the hub already anchors on.

describe('isPlayedGame', () => {
  test('a game dated before today is played', () => {
    assert.equal(isPlayedGame('2026-08-29', '2026-09-02'), true);
  });
  test('a game dated today is NOT played (it kicks off later today)', () => {
    assert.equal(isPlayedGame('2026-09-05', '2026-09-05'), false);
  });
  test('a future game is not played', () => {
    assert.equal(isPlayedGame('2026-09-05', '2026-09-02'), false);
  });
  test('a missing date is never played', () => {
    assert.equal(isPlayedGame('', '2026-09-02'), false);
  });
});

describe('today in a zone', () => {
  test('chicagoTodayYMD returns a YYYY-MM-DD', () => {
    assert.match(chicagoTodayYMD(), /^\d{4}-\d{2}-\d{2}$/);
  });
  test('the played boundary is the calendar day where the game is, not Chicago', () => {
    // Honolulu is 5 hours behind Chicago; the two can disagree on the date for
    // five hours a day. Both are valid dates and differ by at most one day.
    const chi = todayYMD('America/Chicago');
    const hnl = todayYMD('Pacific/Honolulu');
    assert.match(hnl, /^\d{4}-\d{2}-\d{2}$/);
    const diff = Math.abs((Date.parse(chi) - Date.parse(hnl)) / 86400000);
    assert.ok(diff <= 1, `${chi} vs ${hnl}`);
    assert.equal(venueTodayYMD('Pacific/Honolulu'), hnl);
  });
  test('an unmapped venue falls back to the site anchor, an invalid zone too', () => {
    assert.equal(venueTodayYMD(null), chicagoTodayYMD());
    assert.equal(venueTodayYMD('Not/AZone'), chicagoTodayYMD());
  });
});

describe('dateRangeLabel', () => {
  test('a Monday-to-Sunday rail window in the house date format', () => {
    assert.equal(dateRangeLabel('2026-08-31', '2026-09-06'), 'AUG 31 – SEP 6');
    assert.equal(dateRangeLabel('2026-11-23', '2026-11-29'), 'NOV 23 – NOV 29');
  });
  test('a single-day window is one date', () => {
    assert.equal(dateRangeLabel('2026-09-05', '2026-09-05'), 'SEP 5');
  });
  test('no week number anywhere in it', () => {
    assert.doesNotMatch(dateRangeLabel('2026-08-31', '2026-09-06'), /week|wk/i);
  });
});
