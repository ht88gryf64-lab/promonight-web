import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { isRegularSeasonGame } from '../types';

// The filter that keeps preseason and postseason games off team pages.
// The cases that matter are the two absences: an MLB doc with no seasonType at
// all, and a count-based assertion that would break on the Hall of Game teams.

describe('isRegularSeasonGame', () => {
  test('keeps a doc with no seasonType, which is every MLB game', () => {
    assert.equal(isRegularSeasonGame({}), true);
    assert.equal(isRegularSeasonGame({ seasonType: undefined }), true);
  });

  test('keeps regular season', () => {
    assert.equal(isRegularSeasonGame({ seasonType: 'regular' }), true);
  });

  test('drops preseason and postseason', () => {
    assert.equal(isRegularSeasonGame({ seasonType: 'preseason' }), false);
    assert.equal(isRegularSeasonGame({ seasonType: 'postseason' }), false);
  });

  test('absent is kept, which is the opposite of a Firestore equality filter', () => {
    // A Firestore .where('seasonType','==','regular') drops field-absent docs.
    // Measured: it returns 0 of 2455 MLB games. This predicate must NOT share
    // that behaviour, so absence is asserted explicitly rather than implied.
    const mlbLike = [{}, {}, {}];
    assert.equal(mlbLike.filter(isRegularSeasonGame).length, 3);
  });

  test('filters a mixed slate by value, not by count', () => {
    // An NFL club after a preseason ingest: 3 preseason plus 17 regular. The
    // two Hall of Fame Game clubs get 4 preseason instead, so a check written
    // against a total of 20 would be wrong for them. Both shapes must reduce to
    // the same 17.
    const typical = [
      ...Array.from({ length: 3 }, () => ({ seasonType: 'preseason' as const })),
      ...Array.from({ length: 17 }, () => ({ seasonType: 'regular' as const })),
    ];
    const hallOfFame = [
      ...Array.from({ length: 4 }, () => ({ seasonType: 'preseason' as const })),
      ...Array.from({ length: 17 }, () => ({ seasonType: 'regular' as const })),
    ];
    assert.equal(typical.length, 20);
    assert.equal(hallOfFame.length, 21);
    assert.equal(typical.filter(isRegularSeasonGame).length, 17);
    assert.equal(hallOfFame.filter(isRegularSeasonGame).length, 17);
  });
});
