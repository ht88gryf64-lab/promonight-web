// The one derivation behind every "N teams across six leagues, plus M college
// football programs" sentence on the site. Pure, so this runs without
// Firestore.

import test from 'node:test';
import assert from 'node:assert/strict';

import { APP_LEAGUES, coverageFromTeams, joinList, leagueSplit, numberWord } from '../coverage-counts';
import type { Team } from '../types';

function team(id: string, league: string): Team {
  return { id, league, city: id, name: id } as unknown as Team;
}

const TEAMS: Team[] = [
  ...Array.from({ length: 3 }, (_, i) => team(`mlb-${i}`, 'MLB')),
  ...Array.from({ length: 2 }, (_, i) => team(`wnba-${i}`, 'WNBA')),
  ...Array.from({ length: 4 }, (_, i) => team(`nfl-${i}`, 'NFL')),
  team('nhl-0', 'NHL'),
  team('nba-0', 'NBA'),
  team('mls-0', 'MLS'),
];

test('counts, canonical order, and the college count stay separate', () => {
  const c = coverageFromTeams(TEAMS, 87);
  assert.equal(c.teamCount, 12);
  assert.equal(c.leagueCount, 6);
  assert.deepEqual(c.leagues, ['MLB', 'NBA', 'NFL', 'NHL', 'MLS', 'WNBA']);
  assert.equal(c.leagueList, 'MLB, NBA, NFL, NHL, MLS, and WNBA');
  assert.equal(c.cfbSchoolCount, 87);
  // The CFB rule: the college count never leaks into the pro totals.
  assert.equal(c.teamCount + 0, 12);
  assert.equal(c.leagueCount, 6);
});

test('ranked subset follows SCORED_LEAGUES and the app list is the constant', () => {
  const c = coverageFromTeams(TEAMS, 0);
  assert.deepEqual(c.rankedLeagues, ['MLB', 'MLS', 'WNBA']);
  assert.equal(c.rankedTeamCount, 3 + 1 + 2);
  assert.equal(c.rankedLeagueList, 'MLB, MLS, and WNBA');
  assert.deepEqual([...APP_LEAGUES], ['MLB', 'NBA', 'NHL', 'MLS']);
  assert.equal(c.appLeagueList, 'MLB, NBA, NHL, and MLS');
});

test('a league the constant does not know is appended, not dropped', () => {
  const c = coverageFromTeams([...TEAMS, team('x', 'XFL')], 0);
  assert.equal(c.leagueCount, 7);
  assert.equal(c.leagues[6], 'XFL');
  assert.equal(numberWord(c.leagueCount), 'seven');
});

test('helpers', () => {
  assert.equal(joinList([]), '');
  assert.equal(joinList(['MLB']), 'MLB');
  assert.equal(joinList(['MLB', 'NBA']), 'MLB, and NBA');
  assert.equal(numberWord(6), 'six');
  assert.equal(numberWord(42), '42');
  assert.equal(leagueSplit([['MLB', 30], ['WNBA', 15]]), '30 MLB teams, and 15 WNBA teams');
  const c = coverageFromTeams(TEAMS, 0);
  assert.equal(c.leagueNamesBySize[0], 'NFL');
});
