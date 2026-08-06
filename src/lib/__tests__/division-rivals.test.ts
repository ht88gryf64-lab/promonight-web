import { test } from 'node:test';
import assert from 'node:assert/strict';
import { getDivisionRivals } from '../division-rivals';
import type { Team, Game } from '../types';
import type { GameContext } from '../data';

function makeTeam(id: string, city: string, division: string, league = 'MLB'): Team {
  return {
    id,
    city,
    name: id,
    abbreviation: id.slice(0, 3).toUpperCase(),
    primaryColor: '#000000',
    secondaryColor: '#ffffff',
    league,
    sportSlug: league.toLowerCase(),
    division,
  };
}

function makeCtx(opponentTeam: Team | null, isHome = true): GameContext {
  return {
    game: {} as Game,
    isHome,
    opponentTeam,
    opponentVenue: null,
    promos: [],
  };
}

const tigers = makeTeam('detroit-tigers', 'Detroit', 'AL Central');

test('returns empty for missing or empty gameContexts', () => {
  assert.deepEqual(getDivisionRivals(tigers, undefined), []);
  assert.deepEqual(getDivisionRivals(tigers, []), []);
});

test('keeps only same-division opponents, deduped, sorted by city', () => {
  const whiteSox = makeTeam('chicago-white-sox', 'Chicago', 'AL Central');
  const guardians = makeTeam('cleveland-guardians', 'Cleveland', 'AL Central');
  const yankees = makeTeam('new-york-yankees', 'New York', 'AL East');
  const ctxs = [
    makeCtx(guardians),
    makeCtx(whiteSox, false),
    makeCtx(yankees),
    makeCtx(guardians, false),
    makeCtx(whiteSox),
  ];
  const rivals = getDivisionRivals(tigers, ctxs);
  assert.deepEqual(
    rivals.map((t) => t.id),
    ['chicago-white-sox', 'cleveland-guardians'],
  );
});

test('null-checks missing opponent docs and excludes self', () => {
  const selfCtx = makeCtx(makeTeam('detroit-tigers', 'Detroit', 'AL Central'));
  const rivals = getDivisionRivals(tigers, [makeCtx(null), selfCtx]);
  assert.deepEqual(rivals, []);
});

test('division strings must match within the same league', () => {
  // WNBA/MLS both use bare "Eastern"/"Western" division strings; a same-name
  // division in another league must never leak through the filter.
  const lynx = makeTeam('minnesota-lynx', 'Minnesota', 'Western', 'WNBA');
  const mlsWestern = makeTeam('minnesota-united', 'Saint Paul', 'Western', 'MLS');
  const rivals = getDivisionRivals(lynx, [makeCtx(mlsWestern)]);
  assert.deepEqual(rivals, []);
});
