// "Game 1" / "Game 2" only when two rows share a date and an opponent.
import { test } from 'node:test';
import assert from 'node:assert';
import { doubleheaderLabels } from '../doubleheader-labels';
import type { GameContext } from '../data';
import type { Game } from '../types';

function ctx(date: string, away: string, over: Partial<Game> = {}): GameContext {
  const game: Game = { id: `mlb-${date}-${away}-at-home${over.doubleheaderGame ? `-g${over.doubleheaderGame}` : ''}`, league: 'mlb', date, gameTime: '17:00', gameTimeTz: 'America/New_York', homeTeamSlug: 'home', awayTeamSlug: away, venueName: 'Park', status: 'scheduled', ...over };
  return { game, isHome: true, opponentTeam: null, opponentVenue: null, promos: [] };
}

test('a doubleheader pair is labelled by gameNumber, game 1 from order', () => {
  const g1 = ctx('2026-07-19', 'dodgers', { gameTime: '16:35' });
  const g2 = ctx('2026-07-19', 'dodgers', { gameTime: '23:20', doubleheaderGame: 2 });
  const labels = doubleheaderLabels([g2, g1]);
  assert.equal(labels.get(g1.game.id), 'Game 1');
  assert.equal(labels.get(g2.game.id), 'Game 2');
});

test('single games, and two games on one date against different clubs, get no label', () => {
  const a = ctx('2026-07-19', 'dodgers');
  const b = ctx('2026-07-20', 'dodgers');
  const c = ctx('2026-07-20', 'mets');
  assert.equal(doubleheaderLabels([a, b, c]).size, 0);
});

test('an away pair keys on the home club', () => {
  const g1: GameContext = { ...ctx('2026-07-19', 'home'), isHome: false };
  g1.game = { ...g1.game, homeTeamSlug: 'dodgers', awayTeamSlug: 'home', id: 'a1' };
  const g2: GameContext = { ...ctx('2026-07-19', 'home'), isHome: false };
  g2.game = { ...g2.game, homeTeamSlug: 'dodgers', awayTeamSlug: 'home', id: 'a2', doubleheaderGame: 2 };
  const labels = doubleheaderLabels([g1, g2]);
  assert.deepEqual([labels.get('a1'), labels.get('a2')], ['Game 1', 'Game 2']);
});

test('two docs for one game (shared mlbGameId) are not a doubleheader and get no label', () => {
  const a = ctx('2026-07-19', 'dodgers', { mlbGameId: 823523 });
  const b = { ...ctx('2026-07-19', 'dodgers', { mlbGameId: 823523, doubleheaderGame: 2 }) };
  assert.equal(doubleheaderLabels([a, b]).size, 0);
});

test('a pair that shares a doubleheaderGame number gets no label rather than Game 2 twice', () => {
  const a = ctx('2026-07-19', 'dodgers', { mlbGameId: 1, doubleheaderGame: 2 });
  const b = { ...ctx('2026-07-19', 'dodgers', { mlbGameId: 2, doubleheaderGame: 2 }) };
  b.game = { ...b.game, id: 'other-g2' };
  assert.equal(doubleheaderLabels([a, b]).size, 0);
});
