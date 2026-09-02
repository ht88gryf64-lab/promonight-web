import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { isPlayedGame, chicagoTodayYMD } from '../cfb/clock';

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

describe('chicagoTodayYMD', () => {
  test('returns a YYYY-MM-DD', () => {
    assert.match(chicagoTodayYMD(), /^\d{4}-\d{2}-\d{2}$/);
  });
});
