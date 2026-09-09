import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { selectNextHomeGame } from '@/lib/cfb/next-home-game';

const g = (o: Partial<{ id: string; isHome: boolean; neutralSite: boolean; played: boolean }> = {}) =>
  ({ id: 'x', isHome: true, neutralSite: false, played: false, ...o });

describe('selectNextHomeGame', () => {
  test('skips a played home game and picks the next one', () => {
    // The live 2026-09-09 shape: Ohio State's opener against Ball State was
    // played on Sept 5 and the page still advertised it, with ticket CTAs.
    const games = [g({ id: 'ball-state', played: true }), g({ id: 'ohio' })];
    assert.equal(selectNextHomeGame(games)?.id, 'ohio');
  });
  test('is the FIRST unplayed home game, not merely any unplayed one', () => {
    assert.equal(selectNextHomeGame([g({ id: 'a', played: true }), g({ id: 'b' }), g({ id: 'c' })])?.id, 'b');
  });
  test('ignores road games', () => {
    assert.equal(selectNextHomeGame([g({ id: 'road', isHome: false }), g({ id: 'home' })])?.id, 'home');
  });
  test('ignores neutral-site games: the block sells parking at the school\'s own venue', () => {
    assert.equal(selectNextHomeGame([g({ id: 'neutral', neutralSite: true }), g({ id: 'home' })])?.id, 'home');
  });
  test('returns null when every home game is played, so the label is omitted not stale', () => {
    assert.equal(selectNextHomeGame([g({ played: true }), g({ played: true })]), null);
  });
  test('returns null for a school with no home games', () => {
    assert.equal(selectNextHomeGame([]), null);
  });
  test('the old selector would have failed the first case', () => {
    // Pins the regression: `games.find(g => g.isHome && !g.neutralSite)` with no
    // played filter returns the opener forever.
    const games = [g({ id: 'ball-state', played: true }), g({ id: 'ohio' })];
    const old = games.find((x) => x.isHome && !x.neutralSite);
    assert.equal(old?.id, 'ball-state');
    assert.notEqual(selectNextHomeGame(games)?.id, old?.id);
  });
});
