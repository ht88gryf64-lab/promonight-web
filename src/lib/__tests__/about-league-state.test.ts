// /about's league-state sentence is derived (src/lib/about-league-state.ts):
// the calendar cannot make it false, because it is rebuilt from the season
// windows and the upcoming promo rows on every render.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { aboutLeagueStateSentence, resolveAboutLeagueState } from '../about-league-state';

const teams = [
  ...['giants', 'twins', 'braves'].map((id) => ({ id, league: 'MLB' })),
  ...['wild', 'kraken'].map((id) => ({ id, league: 'NHL' })),
  ...['wolves'].map((id) => ({ id, league: 'NBA' })),
  ...['vikings', 'ravens'].map((id) => ({ id, league: 'NFL' })),
  ...['loons', 'galaxy'].map((id) => ({ id, league: 'MLS' })),
  ...['lynx'].map((id) => ({ id, league: 'WNBA' })),
];
const up = (teamId: string, league: string, date: string) => ({ teamId, league, date });

test('2026-11-25: four leagues in season, MLB and WNBA finished, and the clubs already on next season are counted', () => {
  const rows = [up('wild', 'NHL', '2026-11-28'), up('wild', 'NHL', '2026-12-05'), up('wolves', 'NBA', '2026-12-01'), up('vikings', 'NFL', '2026-11-29'), up('loons', 'MLS', '2026-12-02'), up('giants', 'MLB', '2027-03-27'), up('braves', 'MLB', '2027-04-02'), up('galaxy', 'MLS', '2027-02-20')];
  const s = resolveAboutLeagueState('2026-11-25', teams, rows);
  assert.deepEqual(s.inSeason, ['NBA', 'NFL', 'NHL', 'MLS']);
  assert.deepEqual(s.opening, []);
  assert.deepEqual(s.finished, ['MLB', 'WNBA']);
  // Kraken and Ravens have nothing ahead; the Galaxy row is next season's but it is a row ahead.
  assert.deepEqual([s.activeTeams, s.activeTeamsAhead], [7, 5]);
  assert.equal(s.finishedClubsNextSeason, 2, 'Giants and Braves');
  assert.equal(
    aboutLeagueStateSentence(s),
    'NBA, NFL, NHL and MLS are in season: 5 of the 7 teams there have promotions listed ahead. MLB and WNBA have finished their season, and their team pages carry the record of it. 2 clubs there have already published promotions for next season.',
  );
});

test('the same rows read differently as the calendar moves, with no edit to any copy', () => {
  const rows = [up('giants', 'MLB', '2027-03-27'), up('wild', 'NHL', '2027-03-30')];
  // MLB 2027 lead-in opens 2027-02-07: MLB is about to start, no longer finished.
  const feb = resolveAboutLeagueState('2027-02-10', teams, rows);
  assert.ok(feb.opening.includes('MLB'));
  assert.ok(!feb.finished.includes('MLB'));
  assert.match(aboutLeagueStateSentence(feb), /are in season or about to start one:/);
  // Mid-July 2026 (before any of this): MLB, MLS and WNBA in season; NFL in its lead-in? It opens 2026-07-26.
  const july = resolveAboutLeagueState('2026-07-10', teams, []);
  assert.deepEqual(july.inSeason, ['MLB', 'MLS', 'WNBA']);
  assert.match(aboutLeagueStateSentence(july), /^MLB, MLS and WNBA are in season: 0 of the 6 teams there have promotions listed ahead\.$/);
});

test('grammar for one league, and nothing at all when no league has a window', () => {
  const one = { inSeason: ['NHL'], opening: [], finished: ['MLB'], activeTeams: 32, activeTeamsAhead: 29, finishedClubsNextSeason: 1 };
  assert.equal(aboutLeagueStateSentence(one), 'NHL is in season: 29 of the 32 teams there have promotions listed ahead. MLB has finished its season, and its team pages carry the record of it. 1 club there has already published promotions for next season.');
  assert.equal(aboutLeagueStateSentence({ inSeason: [], opening: ['MLB'], finished: [], activeTeams: 30, activeTeamsAhead: 8, finishedClubsNextSeason: 0 }), 'MLB is about to start a season: 8 of the 30 teams there have promotions listed ahead.');
  assert.equal(aboutLeagueStateSentence({ inSeason: [], opening: [], finished: [], activeTeams: 0, activeTeamsAhead: 0, finishedClubsNextSeason: 0 }), '');
  assert.equal(aboutLeagueStateSentence(resolveAboutLeagueState('2026-11-25', teams, [], ['XFL'])), '');
  for (const s of [aboutLeagueStateSentence(one)]) assert.doesNotMatch(s, /\u2014|\u2013|20\d\d|now|yet|soon/);
});
