// What the pages outside /playoffs say. Four surfaces, and for each the four
// states the brief names: alive, eliminated, not in the playoffs, and
// postseason over. "Postseason over" is the gate: once it closes, the list
// of leagues is empty and every surface has nothing to say.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mapBracketDoc } from '../map';
import { playoffsLinkState } from '../gate';
import { clubPlayoffs, homePlayoffs, leagueCard, venueGames, type InboundLeague } from '../inbound';
import { buildLeagueView } from '../view';
import type { Bracket } from '../types';
import { CAPTURED_AT, FIELDS_AT, FIXTURE, IN_GAME_AT, clubs, loadDoc, parks } from './helpers';

type Doc = Record<string, unknown>;

function bracket(name: string, edit?: (d: Doc) => void): Bracket {
  const d = loadDoc(name);
  if (edit) edit(d);
  const b = mapBracketDoc(d, { league: d.league as 'MLB' | 'WNBA', season: d.season as number });
  assert.ok(b, `${name} maps`);
  return b;
}

/** The leagues the gate lets through at `now`, built the way the data
 *  module builds them. The data module's own build is held in data.test.ts. */
function inbound(names: readonly string[], now: Date): InboundLeague[] {
  const brackets = names.map((n) => bracket(n));
  if (playoffsLinkState(brackets, now).state === 'hidden') return [];
  return brackets.map((b) => {
    const view = buildLeagueView(b, clubs(), parks(), now);
    assert.ok(view);
    return { league: b.league, href: `/playoffs/${b.league.toLowerCase()}`, view };
  });
}

const MIXED_AT = new Date('2025-10-09T03:08:00Z');
const MLB_ENDED = Date.parse('2025-11-02T00:00:00.000Z');
const DAY = 24 * 60 * 60 * 1000;
const IN_WINDOW = new Date(MLB_ENDED + 3 * DAY);
const AFTER_WINDOW = new Date(MLB_ENDED + 15 * DAY);

// ================= A club's team page =================

test('TEAM, alive: round, opponent, series score, next game in Eastern time, and a link to the series', () => {
  const leagues = inbound([FIXTURE.mlbFields, FIXTURE.wnbaFields], FIELDS_AT);
  assert.deepEqual(clubPlayoffs(leagues, 'houston-astros'), {
    state: 'alive',
    league: 'MLB',
    season: 2026,
    leagueHref: '/playoffs/mlb',
    updatedLabel: 'Sep 29, 4:00 PM ET',
    seriesHref: '/playoffs/mlb#wild_card-1',
    roundLabel: 'Wild Card Series',
    opponent: 'White Sox',
    scoreLine: null,
    inProgress: null,
    nextLabel: 'Game 1 · Tue, Sep 29 · 5:00 PM ET',
    nextHost: 'Host: Astros · Daikin Park',
  });
  // The visitor's page names the same series, from the other side.
  const sox = clubPlayoffs(leagues, 'chicago-white-sox');
  assert.equal(sox?.state, 'alive');
  if (sox?.state === 'alive') {
    assert.equal(sox.opponent, 'Astros');
    assert.equal(sox.seriesHref, '/playoffs/mlb#wild_card-1');
    assert.equal(sox.nextHost, 'Host: Astros · Daikin Park');
  }
});

test('TEAM, alive with a series score', () => {
  const liberty = clubPlayoffs(inbound([FIXTURE.wnbaFields], FIELDS_AT), 'new-york-liberty');
  assert.equal(liberty?.state, 'alive');
  if (liberty?.state !== 'alive') return;
  assert.equal(liberty.league, 'WNBA');
  assert.equal(liberty.roundLabel, 'First Round');
  assert.equal(liberty.opponent, 'Lynx');
  assert.equal(liberty.scoreLine, 'NYL leads 1-0');
  assert.equal(liberty.nextLabel, 'Game 2 · Tue, Sep 29 · 8:30 PM ET');
  assert.equal(liberty.nextHost, 'Host: Liberty · Barclays Center');
  assert.equal(liberty.seriesHref, '/playoffs/wnba#first_round-1');
});

test('TEAM, alive with a game in progress: the game is named and nothing is "next"', () => {
  const braves = clubPlayoffs(inbound([FIXTURE.mlbInGame], IN_GAME_AT), 'atlanta-braves');
  assert.equal(braves?.state, 'alive');
  if (braves?.state !== 'alive') return;
  assert.equal(braves.inProgress, 'Game 1');
  assert.equal(braves.nextLabel, null);
  assert.equal(braves.opponent, 'Phillies');
  assert.equal(braves.nextHost, 'Host: Braves · Truist Park');
});

test('TEAM, alive against a slot no club fills yet: the opponent is the slot text', () => {
  const rays = clubPlayoffs(inbound([FIXTURE.mlbFields], FIELDS_AT), 'tampa-bay-rays');
  assert.equal(rays?.state, 'alive');
  if (rays?.state !== 'alive') return;
  assert.equal(rays.roundLabel, 'Division Series');
  assert.equal(rays.opponent, 'Yankees / Red Sox winner');
  assert.equal(rays.nextLabel, 'Game 1 · Sat, Oct 3 · Time TBD');
  assert.equal(rays.seriesHref, '/playoffs/mlb#division_series-1');
});

test('TEAM, eliminated: the league is still playing, so there is a rest to follow', () => {
  // Mixed 2025 document: Boston lost the Wild Card Series to New York, 2-1.
  const leagues = inbound([FIXTURE.mlbMixed], MIXED_AT);
  assert.deepEqual(clubPlayoffs(leagues, 'boston-red-sox'), {
    state: 'eliminated',
    league: 'MLB',
    season: 2025,
    leagueHref: '/playoffs/mlb',
    updatedLabel: 'Oct 8, 11:08 PM ET',
    leagueActive: true,
    roundLabel: 'Wild Card Series',
    opponent: 'Yankees',
    lostLine: 'Lost the Wild Card Series 2-1',
  });
  // A club that won a round and lost the next is out in the LATER round.
  const yankees = clubPlayoffs(leagues, 'new-york-yankees');
  assert.equal(yankees?.state, 'eliminated');
  if (yankees?.state === 'eliminated') {
    assert.equal(yankees.roundLabel, 'Division Series');
    assert.equal(yankees.lostLine, 'Lost the Division Series 3-1');
    assert.equal(yankees.opponent, 'Blue Jays');
  }
});

test('TEAM, not in the playoffs: nothing', () => {
  const leagues = inbound([FIXTURE.mlbFields, FIXTURE.wnbaFields], FIELDS_AT);
  for (const id of ['minnesota-twins', 'los-angeles-angels', 'seattle-storm', 'boston-celtics', 'no-such-club', '']) {
    assert.equal(clubPlayoffs(leagues, id), null, id);
  }
  // A club in the 2025 bracket and not the 2026 one.
  assert.equal(clubPlayoffs(leagues, 'toronto-blue-jays'), null);
});

test('TEAM, postseason over: the gate is closed and every club has nothing', () => {
  const leagues = inbound([FIXTURE.mlbFinal, FIXTURE.wnbaFinal], AFTER_WINDOW);
  assert.deepEqual(leagues, []);
  for (const id of ['los-angeles-dodgers', 'toronto-blue-jays', 'boston-red-sox', 'las-vegas-aces']) assert.equal(clubPlayoffs(leagues, id), null, id);
});

test('TEAM, inside the 14 days after the last game: the champion, and everyone else with no "rest" to follow', () => {
  const leagues = inbound([FIXTURE.mlbFinal], IN_WINDOW);
  assert.deepEqual(clubPlayoffs(leagues, 'los-angeles-dodgers'), {
    state: 'champion',
    league: 'MLB',
    season: 2025,
    leagueHref: '/playoffs/mlb',
    updatedLabel: 'Nov 2, 12:00 AM ET',
    summary: 'Won the World Series 4-3',
  });
  const jays = clubPlayoffs(leagues, 'toronto-blue-jays');
  assert.equal(jays?.state, 'eliminated');
  if (jays?.state === 'eliminated') {
    assert.equal(jays.leagueActive, false, 'nothing is left to follow');
    assert.equal(jays.lostLine, 'Lost the World Series 4-3');
  }
  assert.equal(clubPlayoffs(leagues, 'minnesota-twins'), null);
});

test('TEAM, advanced: won its series, and the next round has not named it yet', () => {
  // Mixed 2025 document: Toronto won its Division Series, and the
  // Championship Series slots are still unfilled.
  const jays = clubPlayoffs(inbound([FIXTURE.mlbMixed], MIXED_AT), 'toronto-blue-jays');
  assert.deepEqual(jays, {
    state: 'advanced',
    league: 'MLB',
    season: 2025,
    leagueHref: '/playoffs/mlb',
    updatedLabel: 'Oct 8, 11:08 PM ET',
    seriesHref: '/playoffs/mlb#division_series-1',
    roundLabel: 'Division Series',
    opponent: 'Yankees',
    wonLine: 'Won the Division Series 3-1',
  });
});

test('TEAM: no state carries a pipeline series key', () => {
  for (const [names, now] of [[[FIXTURE.mlbFields, FIXTURE.wnbaFields], FIELDS_AT], [[FIXTURE.mlbMixed], MIXED_AT], [[FIXTURE.mlbFinal], IN_WINDOW]] as const) {
    const leagues = inbound(names, now);
    for (const c of clubs().keys()) {
      const text = JSON.stringify(clubPlayoffs(leagues, c));
      assert.ok(!/[A-Z]+-[A-Z]+-[A-Z0-9]+|\bR\d+-\d+v\d+\b|\bSF-[A-Z]\b|#[A-Z]/.test(text), `${c}: ${text}`);
    }
  }
});

// ================= A league's hub =================

test('HUB, alive: the round being played, a line and a link for each of its series', () => {
  const card = leagueCard(inbound([FIXTURE.mlbFields, FIXTURE.wnbaFields], FIELDS_AT), 'MLB');
  assert.ok(card);
  assert.equal(card.league, 'MLB');
  assert.equal(card.season, 2026);
  assert.equal(card.href, '/playoffs/mlb');
  assert.equal(card.roundLabel, 'Wild Card Series');
  assert.equal(card.updatedLabel, 'Sep 29, 4:00 PM ET');
  assert.deepEqual(card.series, [
    { id: 'wild_card-1', href: '/playoffs/mlb#wild_card-1', names: 'Astros vs White Sox', status: 'Game 1 · Tue, Sep 29 · 5:00 PM ET', inProgress: false },
    { id: 'wild_card-2', href: '/playoffs/mlb#wild_card-2', names: 'Yankees vs Red Sox', status: 'Game 1 · Tue, Sep 29 · 8:00 PM ET', inProgress: false },
    { id: 'wild_card-3', href: '/playoffs/mlb#wild_card-3', names: 'Braves vs Phillies', status: 'Game 1 in progress', inProgress: true },
    { id: 'wild_card-4', href: '/playoffs/mlb#wild_card-4', names: 'Padres vs Cubs', status: 'Game 1 · Tue, Sep 29 · 10:00 PM ET', inProgress: false },
  ]);
  const wnba = leagueCard(inbound([FIXTURE.mlbFields, FIXTURE.wnbaFields], FIELDS_AT), 'WNBA');
  assert.equal(wnba?.roundLabel, 'First Round');
  assert.equal(wnba?.series[0].status, 'NYL leads 1-0');
});

test('HUB, a later round: clubs that are out are simply not on the card', () => {
  const card = leagueCard(inbound([FIXTURE.mlbMixed], MIXED_AT), 'MLB');
  assert.equal(card?.roundLabel, 'Division Series');
  assert.deepEqual(card?.series.map((s) => s.names), ['Blue Jays vs Yankees', 'Mariners vs Tigers', 'Brewers vs Cubs', 'Phillies vs Dodgers']);
  assert.ok(!JSON.stringify(card).includes('Red Sox'));
});

test('HUB, a league with no bracket: nothing, beside one that has a card', () => {
  const leagues = inbound([FIXTURE.mlbFields], FIELDS_AT);
  assert.ok(leagueCard(leagues, 'MLB'));
  for (const league of ['WNBA', 'NBA', 'NHL', 'NFL', 'MLS', 'mlb', '']) assert.equal(leagueCard(leagues, league), null, league);
});

test('HUB, postseason over: nothing once the gate closes, and nothing inside the window either', () => {
  assert.equal(leagueCard(inbound([FIXTURE.mlbFinal], AFTER_WINDOW), 'MLB'), null);
  // The card is for a postseason being played. A finished one has no card,
  // though the Playoffs link is still up.
  const window = inbound([FIXTURE.mlbFinal], IN_WINDOW);
  assert.equal(window.length, 1);
  assert.equal(leagueCard(window, 'MLB'), null);
});

test('HUB: one league finished and one playing gives a card to the one playing', () => {
  const leagues = inbound([FIXTURE.wnbaFinal, FIXTURE.mlbMixed], MIXED_AT);
  assert.equal(leagueCard(leagues, 'WNBA'), null);
  assert.equal(leagueCard(leagues, 'MLB')?.roundLabel, 'Division Series');
});

// ================= The homepage =================

test('HOME, alive: each league being played, its round, its link', () => {
  assert.deepEqual(homePlayoffs(inbound([FIXTURE.mlbFields, FIXTURE.wnbaFields], FIELDS_AT)), {
    season: 2026,
    leagues: [
      { league: 'MLB', href: '/playoffs/mlb', roundLabel: 'Wild Card Series' },
      { league: 'WNBA', href: '/playoffs/wnba', roundLabel: 'First Round' },
    ],
  });
});

test('HOME, one league out of the two has finished: only the one still playing is listed', () => {
  assert.deepEqual(homePlayoffs(inbound([FIXTURE.wnbaFinal, FIXTURE.mlbMixed], MIXED_AT))?.leagues, [
    { league: 'MLB', href: '/playoffs/mlb', roundLabel: 'Division Series' },
  ]);
});

test('HOME, no league in the playoffs: nothing', () => {
  assert.equal(homePlayoffs([]), null);
});

test('HOME, postseason over: nothing once the gate closes, and nothing inside the window', () => {
  assert.equal(homePlayoffs(inbound([FIXTURE.mlbFinal, FIXTURE.wnbaFinal], AFTER_WINDOW)), null);
  assert.equal(homePlayoffs(inbound([FIXTURE.mlbFinal, FIXTURE.wnbaFinal], IN_WINDOW)), null);
});

test('HOME: states a round, and no score, game or time', () => {
  const text = JSON.stringify(homePlayoffs(inbound([FIXTURE.mlbFields, FIXTURE.wnbaFields], FIELDS_AT)));
  assert.ok(!/\d:\d\d|leads|tied|Game \d|\bET\b/.test(text), text);
});

// ================= The page of a park =================

test('VENUE, alive: the home games still to be played by the club that plays there', () => {
  const leagues = inbound([FIXTURE.mlbFields, FIXTURE.wnbaFields], FIELDS_AT);
  assert.deepEqual(venueGames(leagues, ['houston-astros']), {
    games: [
      { key: 'MLB-wild_card-1-g1', league: 'MLB', href: '/playoffs/mlb#wild_card-1', matchup: 'White Sox at Astros', roundLabel: 'Wild Card Series', gameTitle: 'Game 1', when: 'Tue, Sep 29 · 5:00 PM ET', ifNecessary: false },
      { key: 'MLB-wild_card-1-g2', league: 'MLB', href: '/playoffs/mlb#wild_card-1', matchup: 'White Sox at Astros', roundLabel: 'Wild Card Series', gameTitle: 'Game 2', when: 'Wed, Sep 30 · 5:00 PM ET', ifNecessary: false },
      { key: 'MLB-wild_card-1-g3', league: 'MLB', href: '/playoffs/mlb#wild_card-1', matchup: 'White Sox at Astros', roundLabel: 'Wild Card Series', gameTitle: 'Game 3', when: 'Thu, Oct 1 · 5:00 PM ET', ifNecessary: true },
    ],
    updated: [{ league: 'MLB', updatedLabel: 'Sep 29, 4:00 PM ET' }],
  });
});

test('VENUE, alive but visiting: a club with no home game left in the document has nothing here', () => {
  // The White Sox are the 6 seed: all three Wild Card games are in Houston.
  assert.equal(venueGames(inbound([FIXTURE.mlbFields], FIELDS_AT), ['chicago-white-sox']), null);
});

test('VENUE, a game under way is not listed; the ones after it are', () => {
  const v = venueGames(inbound([FIXTURE.mlbInGame], IN_GAME_AT), ['atlanta-braves']);
  assert.deepEqual(v?.games.map((g) => g.gameTitle), ['Game 2', 'Game 3']);
});

test('VENUE, a building shared by two clubs lists the games of whichever is hosting', () => {
  const leagues = inbound([FIXTURE.mlbFields, FIXTURE.wnbaFields], FIELDS_AT);
  // Barclays Center: the Liberty, and an NBA club that is in no bracket.
  const v = venueGames(leagues, ['brooklyn-nets', 'new-york-liberty']);
  assert.deepEqual(v?.games.map((g) => [g.league, g.matchup, g.gameTitle, g.when]), [['WNBA', 'Lynx at Liberty', 'Game 2', 'Tue, Sep 29 · 8:30 PM ET']]);
  assert.deepEqual(v?.updated, [{ league: 'WNBA', updatedLabel: 'Sep 29, 3:38 PM ET' }]);
});

test('VENUE, eliminated: a club that is out hosts nothing', () => {
  const leagues = inbound([FIXTURE.mlbMixed], MIXED_AT);
  assert.equal(venueGames(leagues, ['boston-red-sox']), null);
  assert.equal(venueGames(leagues, ['new-york-yankees']), null);
  // Beside one that is still in.
  assert.deepEqual(venueGames(leagues, ['seattle-mariners'])?.games.map((g) => [g.matchup, g.gameTitle, g.ifNecessary]), [['Tigers at Mariners', 'Game 5', true]]);
});

test('VENUE, not in the playoffs: nothing', () => {
  const leagues = inbound([FIXTURE.mlbFields, FIXTURE.wnbaFields], FIELDS_AT);
  for (const ids of [['minnesota-twins'], ['boston-celtics', 'boston-bruins'], [], ['no-such-club']]) assert.equal(venueGames(leagues, ids), null, ids.join());
});

test('VENUE, postseason over: nothing once the gate closes, and nothing inside the window', () => {
  assert.equal(venueGames(inbound([FIXTURE.mlbFinal], AFTER_WINDOW), ['los-angeles-dodgers']), null);
  assert.equal(venueGames(inbound([FIXTURE.mlbFinal], IN_WINDOW), ['los-angeles-dodgers']), null);
});

test('VENUE: no game is listed on a day that has passed', () => {
  const later = new Date('2026-10-01T16:00:00Z');
  const v = venueGames(inbound([FIXTURE.mlbFields], later), ['houston-astros']);
  assert.deepEqual(v?.games.map((g) => g.gameTitle), ['Game 3']);
  void CAPTURED_AT;
});

// ================= The gate, over all four =================

test('THE GATE: closed, all four surfaces are empty, whatever the documents hold', () => {
  for (const leagues of [inbound([FIXTURE.mlbFinal, FIXTURE.wnbaFinal], AFTER_WINDOW), inbound([], FIELDS_AT)]) {
    assert.deepEqual(leagues, []);
    assert.equal(clubPlayoffs(leagues, 'los-angeles-dodgers'), null);
    assert.equal(leagueCard(leagues, 'MLB'), null);
    assert.equal(homePlayoffs(leagues), null);
    assert.equal(venueGames(leagues, ['los-angeles-dodgers']), null);
  }
});
