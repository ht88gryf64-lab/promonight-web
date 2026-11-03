// MLS: the document contract of 2026-11-03, the copy for one-game rounds and
// shootouts, the club names, the live suppression and the per-league gate.
// Built on the four MLS fixtures (the real 2025 postseason on 2026 keys; see
// __fixtures__/README.md) and edits of them, each edit named where it is made.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { MLS_SHORT_NAMES, teamDisplayName, teamShortName } from '../../team-display-name';
import { mapBracketDoc } from '../map';
import { CHAMPION_WINDOW_DAYS, inboundBrackets, playoffsLinkState } from '../gate';
import { buildLeagueView, homeGamesWindow, type LeagueView, type SeriesView } from '../view';
import { gameStarts, standingLine } from '../standing';
import { clubPlayoffs, homePlayoffs, leagueCard, leagueFinalCard, leagueHeroLine, venueGames, type InboundLeague } from '../inbound';
import { DESCRIPTION_MAX, hubCopy, leagueCopy, leagueJsonLd } from '../metadata';
import { mlsHostsWithoutOneGround } from '../grounds';
import type { Bracket } from '../types';
import { FIXTURE, MLS_AT, MLS_FIXTURE, clubs, loadDoc, mlsClubs, mlsParks, mlsTeams, parks, rawText, seriesKeyIn } from './helpers';

type Doc = Record<string, unknown>;
type RawGame = Doc;
type RawSeries = Doc & { seriesKey: string; games: RawGame[]; higher: Doc; lower: Doc; wins: Doc };

const mls = (d: Doc): Bracket | null => mapBracketDoc(d, { league: 'MLS', season: 2026 });
const raw = (d: Doc, key: string): RawSeries => (d.series as RawSeries[]).find((s) => s.seriesKey === key) as RawSeries;

function bracketOf(name: string, edit?: (d: Doc) => void): Bracket {
  const d = loadDoc(name);
  if (edit) edit(d);
  const b = mls(d);
  assert.ok(b, `${name} maps`);
  return b;
}
function viewOf(name: string, now: Date, edit?: (d: Doc) => void): { b: Bracket; v: LeagueView } {
  const b = bracketOf(name, edit);
  const v = buildLeagueView(b, mlsClubs(), mlsParks(), now);
  assert.ok(v, `${name} builds`);
  return { b, v };
}
const allSeries = (v: LeagueView): SeriesView[] => v.rounds.flatMap((r) => r.groups.flatMap((g) => g.series));
const seriesById = (v: LeagueView, id: string): SeriesView => allSeries(v).find((s) => s.id === id) as SeriesView;
const inbound = (b: Bracket, v: LeagueView): InboundLeague[] => [{ league: 'MLS', href: '/playoffs/mls', view: v, bracket: b }];

// ---- Names ----

test('NAMES: the short-name map covers all 30 MLS team records, and only them', () => {
  const teams = mlsTeams();
  assert.equal(teams.length, 30);
  assert.deepEqual(Object.keys(MLS_SHORT_NAMES).sort(), teams.map((t) => t.id).sort());
  for (const t of teams) {
    const short = teamShortName(t);
    assert.notEqual(short, t.name.trim() === short ? '' : t.name, t.id);
    assert.ok(!/^the\b/i.test(short), `${t.id}: no article`);
    // The short name is never a bare fragment of the stored name.
    assert.ok(!['United', 'United FC', 'Real', 'Sporting', 'City SC', 'City FC', 'Inter CF', 'Fire FC', 'Galaxy', 'Crew', 'Union', 'Rapids', 'Dynamo FC'].includes(short), `${t.id}: ${short}`);
  }
  // The examples the brief names, spelled as the clubs spell them.
  const by = (id: string) => MLS_SHORT_NAMES[id].name;
  assert.equal(by('atlanta-united'), 'Atlanta United');
  assert.equal(by('cf-montreal'), 'CF Montréal');
  assert.equal(by('dc-united'), 'D.C. United');
  assert.equal(by('lafc'), 'LAFC');
  assert.equal(by('la-galaxy'), 'LA Galaxy');
  assert.equal(by('real-salt-lake'), 'Real Salt Lake');
  assert.equal(by('sporting-kansas-city'), 'Sporting Kansas City');
  assert.equal(by('inter-miami'), 'Inter Miami');
  assert.equal(by('st-louis-city-sc'), 'St. Louis City SC');
  // Plural brands take a plural verb; everything else singular.
  const plural = Object.entries(MLS_SHORT_NAMES).filter(([, v]) => v.plural).map(([k]) => k).sort();
  assert.deepEqual(plural, ['colorado-rapids', 'new-york-red-bulls', 'portland-timbers', 'san-jose-earthquakes', 'seattle-sounders', 'vancouver-whitecaps']);
});

test('NAMES: every other league keeps its stored nickname', () => {
  for (const c of clubs().values()) assert.equal(teamShortName(c), c.name);
});

test('NAMES: cards and prose use the short brand, the champion and club links the full name', () => {
  const { v } = viewOf(MLS_FIXTURE.final, MLS_AT.final);
  const r1 = seriesById(v, 'round_one-8');
  assert.equal(r1.higher.label, 'Minnesota United');
  assert.equal(r1.higher.fullName, 'Minnesota United FC');
  assert.equal(r1.lower.label, 'Seattle Sounders');
  assert.equal(seriesById(v, 'round_one-5').lower.label, 'Portland Timbers');
  assert.equal(v.phase.kind === 'concluded' && v.phase.championName, 'Inter Miami CF');
  for (const s of allSeries(v)) {
    for (const slot of [s.higher, s.lower]) {
      assert.ok(!/^(United|United FC|Real|Sporting|City SC|Inter CF)$/.test(slot.label), slot.label);
      if (slot.teamId) assert.equal(slot.fullName, teamDisplayName(mlsClubs().get(slot.teamId)!));
    }
  }
});

// ---- The contract, through the mapper ----

test('CONTRACT: all four fixtures map, and an MLB game gains no soccer field', () => {
  for (const name of Object.values(MLS_FIXTURE)) assert.ok(mls(loadDoc(name)), name);
  const mlb = mapBracketDoc(loadDoc(FIXTURE.mlbFinal), { league: 'MLB', season: 2025 });
  assert.ok(mlb);
  for (const s of mlb.series) for (const g of s.games) {
    for (const k of ['decidedBy', 'homeShootout', 'awayShootout']) assert.ok(!(k in g), k);
  }
  // Even when an MLB row carries the keys, they are not read.
  const d = loadDoc(FIXTURE.mlbFinal);
  const g0 = ((d.series as RawSeries[])[0].games[0]) as RawGame;
  Object.assign(g0, { decidedBy: 'nonsense', homeShootout: 'x' });
  const again = mapBracketDoc(d, { league: 'MLB', season: 2025 });
  assert.ok(again);
  assert.ok(!('decidedBy' in again.series[0].games[0]));
});

test('CONTRACT: writerVersion 3 is accepted for every league (the mapper never reads it)', () => {
  for (const [name, league, season] of [[FIXTURE.mlbFinal, 'MLB', 2025], [FIXTURE.wnbaFinal, 'WNBA', 2025], [MLS_FIXTURE.final, 'MLS', 2026]] as const) {
    const d = loadDoc(name);
    d.writerVersion = 3;
    assert.ok(mapBracketDoc(d, { league, season }), name);
  }
});

test('CONTRACT: the soccer fields come through on MLS games, and only as the contract says', () => {
  const b = bracketOf(MLS_FIXTURE.final);
  const games = b.series.flatMap((s) => s.games);
  const pens = games.filter((g) => g.decidedBy === 'penalties');
  assert.ok(pens.length >= 6, `${pens.length} shootouts`);
  for (const g of pens) {
    assert.equal(g.homeScore, g.awayScore);
    assert.ok(Number.isInteger(g.homeShootout) && Number.isInteger(g.awayShootout) && g.homeShootout !== g.awayShootout);
  }
  for (const g of games.filter((x) => x.decidedBy !== 'penalties')) {
    assert.ok(!('homeShootout' in g) && !('awayShootout' in g));
    assert.notEqual(g.homeScore, g.awayScore);
  }
  for (const g of bracketOf(MLS_FIXTURE.early).series.flatMap((s) => s.games)) assert.ok(!('decidedBy' in g));
});

const REFUSALS: [string, (g: RawGame) => void][] = [
  ['a level final score decided in regulation', (g) => Object.assign(g, { homeScore: 1, awayScore: 1 })],
  ['a level final score decided in extra time', (g) => Object.assign(g, { homeScore: 1, awayScore: 1, decidedBy: 'extra_time' })],
  ['penalties with no shootout score', (g) => Object.assign(g, { homeScore: 1, awayScore: 1, decidedBy: 'penalties' })],
  ['penalties with a level shootout', (g) => Object.assign(g, { homeScore: 1, awayScore: 1, decidedBy: 'penalties', homeShootout: 4, awayShootout: 4 })],
  ['penalties after an unequal score', (g) => Object.assign(g, { decidedBy: 'penalties', homeShootout: 4, awayShootout: 3 })],
  ['a shootout score on a game decided in regulation', (g) => Object.assign(g, { homeShootout: 4, awayShootout: 3 })],
  ['a final game with no decidedBy', (g) => Object.assign(g, { decidedBy: null })],
  ['an unknown decidedBy', (g) => Object.assign(g, { decidedBy: 'golden_goal' })],
  ['a final game with no score', (g) => Object.assign(g, { homeScore: null })],
  ['a fractional shootout score', (g) => Object.assign(g, { homeScore: 1, awayScore: 1, decidedBy: 'penalties', homeShootout: 4.5, awayShootout: 3 })],
  ['a winner who scored fewer', (g) => Object.assign(g, { winnerSide: g.winnerSide === 'higher' ? 'lower' : 'higher' })],
  // Level, in regulation, with the winner set to the side the score check
  // would accept (the away side is not behind): only the level rule refuses it.
  ['a level regulation score whatever the winner', (g) => Object.assign(g, { homeScore: 1, awayScore: 1, winnerSide: 'lower' })],
];

for (const [what, edit] of REFUSALS) {
  test(`CONTRACT: refuses ${what}`, () => {
    const d = loadDoc(MLS_FIXTURE.final);
    // The Wild Card East: Chicago Fire 3, Orlando City 1, at Chicago.
    edit(raw(d, 'E-WC').games[0]);
    assert.equal(mls(d), null);
  });
}

test('CONTRACT: refuses a shootout won by the side the row does not name the winner', () => {
  const d = loadDoc(MLS_FIXTURE.final);
  // Vancouver 2, LAFC 2, Vancouver 4-3 on penalties, at Vancouver.
  const g = raw(d, 'W-SF-B').games[0];
  assert.equal(g.decidedBy, 'penalties');
  Object.assign(g, { homeShootout: 3, awayShootout: 4 });
  assert.equal(mls(d), null);
});

test('CONTRACT: refuses a decidedBy or a shootout score on a game that is not final', () => {
  for (const extra of [{ decidedBy: 'regulation' }, { homeShootout: 0 }, { awayShootout: 0 }]) {
    const d = loadDoc(MLS_FIXTURE.early);
    Object.assign(raw(d, 'E-WC').games[0], extra);
    assert.equal(mls(d), null, JSON.stringify(extra));
  }
});

test('CONTRACT: a stored label holding an MLS-shaped key is never shown, even a key the document does not have', () => {
  const { v } = viewOf(MLS_FIXTURE.early, MLS_AT.early, (d) => {
    Object.assign(raw(d, 'W-SF-B').higher, { placeholder: 'Winner of W-R2-3', feederSeriesKey: null, candidates: null });
  });
  assert.equal(seriesById(v, 'conference_semifinals-4').higher.label, 'To be decided');
});

// ---- One-game rounds and shootouts ----

test('SINGLE GAME: "Single game", no "Game 1", no "Best of 1", and the match score in the score line', () => {
  const { v } = viewOf(MLS_FIXTURE.final, MLS_AT.final);
  for (const s of allSeries(v)) {
    assert.ok(!/Best of 1\b/.test(s.formatLabel), s.formatLabel);
    if (s.round === 'round_one') {
      assert.equal(s.single, undefined);
      assert.match(s.formatLabel, /^Best of 3/);
      continue;
    }
    assert.equal(s.single, true, s.id);
    assert.equal(s.formatLabel, 'Single game');
    for (const g of s.games) assert.equal(g.title, '');
  }
  assert.equal(seriesById(v, 'wild_card-1').scoreLine, 'Chicago Fire beat Orlando City 3-1');
  assert.equal(seriesById(v, 'conference_finals-2').scoreLine, 'Vancouver Whitecaps beat San Diego FC 3-1');
  assert.equal(seriesById(v, 'mls_cup-1').scoreLine, 'Inter Miami beat Vancouver Whitecaps 3-1');
});

test('SHOOTOUT, one game: "beat ... on penalties after a draw", the score from the winner\'s side', () => {
  const { v } = viewOf(MLS_FIXTURE.semisDone, MLS_AT.semisDone);
  const s = seriesById(v, 'conference_semifinals-4');
  assert.equal(s.scoreLine, 'Vancouver Whitecaps beat LAFC 4-3 on penalties after a 2-2 draw');
  assert.equal(s.matchScore, '4-3 on penalties after a 2-2 draw');
  assert.equal(s.games[0].result, 'VAN 2, LAFC 2, VAN won 4-3 on penalties');
});

test('EXTRA TIME, one game: "after extra time" on the score line, the game row and the champion', () => {
  // The 2024 Western semifinal went this way (Seattle 2-1 at LAFC after extra
  // time); here the MLS Cup row is rewritten to it: Vancouver win 2-1 away.
  const { b, v } = viewOf(MLS_FIXTURE.final, MLS_AT.final, (d) => {
    const cup = raw(d, 'CUP');
    Object.assign(cup.games[0], { homeScore: 1, awayScore: 2, winnerSide: 'lower', decidedBy: 'extra_time' });
    Object.assign(cup, { winner: 'vancouver-whitecaps', wins: { higher: 0, lower: 1 } });
  });
  const s = seriesById(v, 'mls_cup-1');
  assert.equal(s.scoreLine, 'Vancouver Whitecaps beat Inter Miami 2-1 after extra time');
  assert.equal(s.games[0].result, 'VAN 2, MIA 1 after extra time');
  assert.equal(v.phase.kind === 'concluded' && v.phase.summary, 'Won the MLS Cup 2-1 after extra time');
  assert.equal(standingLine(v, gameStarts(b), MLS_AT.final), 'Vancouver Whitecaps FC won the 2026 MLS Cup, beating Inter Miami CF 2-1 after extra time.');
  assert.equal(leagueCopy(2026, 'MLS', '/playoffs/mls', v).description, 'The 2026 MLS postseason bracket, complete. Vancouver Whitecaps FC: won the MLS Cup 2-1 after extra time. Every matchup and result, round by round.');
});

test('SHOOTOUT, MLS Cup: the champion line and summary say penalties and the draw', () => {
  const { b, v } = viewOf(MLS_FIXTURE.final, MLS_AT.final, (d) => {
    const cup = raw(d, 'CUP');
    Object.assign(cup.games[0], { homeScore: 1, awayScore: 1, winnerSide: 'lower', decidedBy: 'penalties', homeShootout: 3, awayShootout: 4 });
    Object.assign(cup, { winner: 'vancouver-whitecaps', wins: { higher: 0, lower: 1 } });
  });
  assert.equal(v.phase.kind === 'concluded' && v.phase.summary, 'Won the MLS Cup 4-3 on penalties after a 1-1 draw');
  assert.equal(standingLine(v, gameStarts(b), MLS_AT.final), 'Vancouver Whitecaps FC won the 2026 MLS Cup, beating Inter Miami CF 4-3 on penalties after a 1-1 draw.');
  assert.equal(seriesById(v, 'mls_cup-1').games[0].result, 'VAN 1, MIA 1, VAN won 4-3 on penalties');
  const copy = leagueCopy(2026, 'MLS', '/playoffs/mls', v);
  assert.ok(copy.description.length <= DESCRIPTION_MAX, copy.description);
});

test('LEVEL SCORE: the shootout winner is listed first, from winnerSide, even away from home', () => {
  const { v } = viewOf(MLS_FIXTURE.roundOne, MLS_AT.roundOne);
  // Game 2 at Dallas: 1-1, Vancouver won the shootout 4-2.
  const g2 = seriesById(v, 'round_one-6').games[1];
  assert.equal(g2.matchup, 'Vancouver Whitecaps at FC Dallas');
  assert.equal(g2.result, 'VAN 1, DAL 1, VAN won 4-2 on penalties');
  // Game 2 at New York City: 0-0, Charlotte won 7-6 away.
  assert.equal(seriesById(v, 'round_one-4').games[1].result, 'CLT 0, NYC 0, CLT won 7-6 on penalties');
  // Game 1 at Minnesota: 0-0, Minnesota won 3-2 at home.
  assert.equal(seriesById(v, 'round_one-8').games[0].result, 'MIN 0, SEA 0, MIN won 3-2 on penalties');
});

test('ROUND ONE: the series in wins, said as a series; each game its own result', () => {
  const { v } = viewOf(MLS_FIXTURE.roundOne, MLS_AT.roundOne);
  assert.equal(seriesById(v, 'round_one-8').scoreLine, 'Minnesota United leads the series 1-0');
  assert.equal(seriesById(v, 'round_one-3').scoreLine, 'Series tied 1-1');
  assert.equal(seriesById(v, 'round_one-1').scoreLine, 'Philadelphia Union won the series 2-0');
  assert.equal(seriesById(v, 'round_one-1').games[0].result, 'PHI 2, CHI 2, PHI won 4-2 on penalties');
  // A plural brand takes a plural verb.
  const { v: v2 } = viewOf(MLS_FIXTURE.roundOne, MLS_AT.roundOne, (d) => {
    const s = raw(d, 'W-R1-4');
    Object.assign(s.games[0], { winnerSide: 'lower', homeShootout: 2, awayShootout: 3 });
    s.wins = { higher: 0, lower: 1 };
  });
  assert.equal(seriesById(v2, 'round_one-8').scoreLine, 'Seattle Sounders lead the series 1-0');
});

test('GAME 3: "If necessary" while it can still be skipped; a played Game 3 is a result, never "if necessary"', () => {
  const early = viewOf(MLS_FIXTURE.roundOne, MLS_AT.roundOne).v;
  const g3 = seriesById(early, 'round_one-8').games[2];
  assert.equal(g3.stateLabel, 'If necessary');
  assert.equal(g3.ifNecessary, true);
  // 1-1: Game 3 decides it, so it is not conditional.
  assert.equal(seriesById(early, 'round_one-3').games[2].stateLabel, 'Scheduled');
  // The pipeline keeps ifNecessary true on a played Game 3.
  const done = viewOf(MLS_FIXTURE.semisDone, MLS_AT.semisDone);
  const rawG3 = raw(loadDoc(MLS_FIXTURE.semisDone), 'W-R1-4').games[2];
  assert.equal(rawG3.ifNecessary, true);
  const played = seriesById(done.v, 'round_one-8').games[2];
  assert.equal(played.state, 'final');
  assert.equal(played.stateLabel, 'Final');
  assert.equal(played.ifNecessary, false);
  assert.equal(played.result, 'MIN 3, SEA 3, MIN won 7-6 on penalties');
  // An unneeded Game 3 is omitted by the pipeline: nothing to show.
  assert.equal(seriesById(done.v, 'round_one-1').games.length, 2);
});

test('HOST from the row, never the seed: a one-game final hosted by the lower slot', () => {
  const { v } = viewOf(MLS_FIXTURE.semisDone, MLS_AT.semisDone, (d) => {
    // ESPN names the host; here the Western final at Vancouver, the lower slot.
    const g = raw(d, 'W-CF').games[0];
    Object.assign(g, { home: 'vancouver-whitecaps', away: 'san-diego-fc', homeSide: 'lower' });
  });
  const s = seriesById(v, 'conference_finals-2');
  assert.equal(s.games[0].matchup, 'San Diego FC at Vancouver Whitecaps');
  assert.equal(s.games[0].hostName, 'Vancouver Whitecaps');
  assert.equal(s.games[0].park, 'BC Place');
});

// ---- No live state for MLS ----

function inProgress(d: Doc): void {
  // The Western semifinal at Vancouver, under way: what the feed would write.
  const s = raw(d, 'W-SF-B');
  s.status = 'live';
  Object.assign(s.games[0], { status: 'live', homeScore: 1, awayScore: 0 });
}

test('NO LIVE: a game under way reads as its scheduled game, with no score, label or badge state', () => {
  const { b, v } = viewOf(MLS_FIXTURE.roundOne, new Date('2026-11-22T03:00:00Z'), inProgress);
  const s = seriesById(v, 'conference_semifinals-4');
  assert.equal(s.liveLabel, null);
  assert.equal(s.status, 'upcoming');
  assert.equal(s.games[0].state, 'scheduled');
  assert.equal(s.games[0].stateLabel, 'Scheduled');
  assert.equal(s.games[0].result, null);
  assert.equal(s.scoreLine, null);
  assert.equal(s.nextLabel, 'Sat, Nov 21 · 9:30 PM ET');
  // Every string the view carries, but the series status enum (a key, not
  // copy, and "live" on a Round One series with a final game is a fact).
  const strings: string[] = [];
  const walk = (x: unknown, key = ''): void => {
    if (typeof x === 'string') { if (key !== 'status') strings.push(x); }
    else if (Array.isArray(x)) x.forEach((y) => walk(y));
    else if (x && typeof x === 'object') for (const [k, y] of Object.entries(x)) walk(y, k);
  };
  walk(v);
  assert.ok(!strings.some((t) => /\blive\b|in progress/i.test(t)), 'no live wording anywhere in the view');
  assert.ok(!allSeries(v).flatMap((x) => x.games).some((g) => g.state === 'live'));
  const line = standingLine(v, gameStarts(b), new Date('2026-11-22T03:00:00Z')) ?? '';
  assert.ok(!/live|in progress|under way|now|currently|today/i.test(line), line);
  const card = leagueCard(inbound(b, v), 'MLS');
  assert.ok(!/\blive\b|in progress/i.test(JSON.stringify(card)));
  for (const id of ['vancouver-whitecaps', 'lafc']) assert.ok(!/\blive\b|in progress/i.test(JSON.stringify(clubPlayoffs(inbound(b, v), id))));
  // A Round One series with a result in it is "underway": no "live" token
  // for MLS anywhere, not even in a status attribute.
  assert.equal(seriesById(v, 'round_one-8').status, 'underway');
  assert.ok(!allSeries(v).some((x) => x.status === 'live'));
});

test('NO LIVE: an MLB game in progress still reads as live (unchanged)', () => {
  const d = loadDoc(FIXTURE.mlbInGame);
  const b = mapBracketDoc(d, { league: 'MLB', season: 2026 });
  assert.ok(b);
  const v = buildLeagueView(b, clubs(), parks(), new Date('2026-09-29T19:09:00Z'));
  assert.ok(v);
  assert.ok(allSeries(v).some((s) => s.liveLabel === 'Game 1 live'));
});

// ---- A final served with no score (2026-11-03 review, HIGH) ----

/** The Wild Card East (Chicago Fire 3, Orlando City 1) as the feed can leave
 *  it: final, decided, a winner, and no score. */
function blankWildCard(decidedBy: string) {
  return (d: Doc) => Object.assign(raw(d, 'E-WC').games[0], { homeScore: null, awayScore: null, decidedBy });
}

test('NO SCORE: a regulation or extra-time final with no score is read, and the page names the winner and invents no score', () => {
  for (const [by, line, row] of [
    ['regulation', 'Chicago Fire beat Orlando City', 'CHI won'],
    ['extra_time', 'Chicago Fire beat Orlando City after extra time', 'CHI won after extra time'],
  ] as const) {
    const { v } = viewOf(MLS_FIXTURE.roundOne, MLS_AT.roundOne, blankWildCard(by));
    const s = seriesById(v, 'wild_card-1');
    assert.equal(s.scoreLine, line);
    assert.equal(s.games[0].result, row);
    assert.ok(!/\d/.test(s.scoreLine ?? ''), 'no number at all');
  }
});

test('NO SCORE: refused for a penalties final, for one score without the other, and for a score that is not a number', () => {
  for (const edit of [
    (g: RawGame) => Object.assign(g, { homeScore: null, awayScore: null, decidedBy: 'penalties', homeShootout: 4, awayShootout: 3 }),
    (g: RawGame) => Object.assign(g, { homeScore: null, awayScore: null, decidedBy: 'penalties' }),
    (g: RawGame) => Object.assign(g, { homeScore: 3, awayScore: null }),
    (g: RawGame) => Object.assign(g, { homeScore: '3', awayScore: 1 }),
    (g: RawGame) => Object.assign(g, { homeScore: null, awayScore: null, winnerSide: null }),
  ]) {
    const d = loadDoc(MLS_FIXTURE.roundOne);
    edit(raw(d, 'E-WC').games[0]);
    assert.equal(mls(d), null, JSON.stringify(raw(d, 'E-WC').games[0]));
  }
});

test('NO SCORE: a Round One game, the team modules, the standing line and the champion, all without a score', () => {
  // Philadelphia's Game 2 win at Chicago (3-0) served blank.
  const r1 = viewOf(MLS_FIXTURE.roundOne, MLS_AT.roundOne, (d) => Object.assign(raw(d, 'E-R1-1').games[1], { homeScore: null, awayScore: null }));
  assert.equal(seriesById(r1.v, 'round_one-1').games[1].result, 'PHI won');
  assert.equal(seriesById(r1.v, 'round_one-1').scoreLine, 'Philadelphia Union won the series 2-0');
  // The Western semifinal at San Diego (1-0) and the MLS Cup (3-1) blank.
  const fin = viewOf(MLS_FIXTURE.final, MLS_AT.final, (d) => {
    Object.assign(raw(d, 'W-SF-A').games[0], { homeScore: null, awayScore: null });
    Object.assign(raw(d, 'CUP').games[0], { homeScore: null, awayScore: null, decidedBy: 'extra_time' });
  });
  const L = inbound(fin.b, fin.v);
  const min = clubPlayoffs(L, 'minnesota-united');
  assert.ok(min && min.state === 'eliminated');
  assert.equal(min.lostLine, 'Conference Semifinals: lost to San Diego FC');
  const van = clubPlayoffs(L, 'vancouver-whitecaps');
  assert.ok(van && van.state === 'eliminated');
  assert.equal(van.lostLine, 'MLS Cup: lost to Inter Miami after extra time');
  const mia = clubPlayoffs(L, 'inter-miami');
  assert.ok(mia && mia.state === 'champion');
  assert.equal(mia.summary, 'Won the MLS Cup after extra time');
  assert.equal(standingLine(fin.v, gameStarts(fin.b), MLS_AT.final), 'Inter Miami CF won the 2026 MLS Cup, beating Vancouver Whitecaps FC after extra time.');
  // Regulation, blank: no score and nothing after the names.
  const reg = viewOf(MLS_FIXTURE.final, MLS_AT.final, (d) => Object.assign(raw(d, 'CUP').games[0], { homeScore: null, awayScore: null }));
  assert.equal(standingLine(reg.v, gameStarts(reg.b), MLS_AT.final), 'Inter Miami CF won the 2026 MLS Cup, beating Vancouver Whitecaps FC.');
  assert.equal(reg.v.phase.kind === 'concluded' && reg.v.phase.summary, 'Won the MLS Cup');
  // Advanced with a blank one-game win: "Won", nothing invented.
  const adv = viewOf(MLS_FIXTURE.semisDone, MLS_AT.semisDone, (d) => {
    Object.assign(raw(d, 'W-SF-A').games[0], { homeScore: null, awayScore: null });
    const cf = raw(d, 'W-CF');
    cf.games = [];
    cf.higher = { placeholder: 'TBD', seed: null, feederSeriesKey: null, candidates: null };
  });
  const sd = clubPlayoffs(inbound(adv.b, adv.v), 'san-diego-fc');
  assert.ok(sd && sd.state === 'advanced');
  assert.equal(sd.wonLine, 'Won');
  // The standing line while that semifinal round is the one being reported.
  const mid = new Date('2026-11-24T12:00:00Z');
  const half = viewOf(MLS_FIXTURE.semisDone, mid, (d) => {
    Object.assign(raw(d, 'W-SF-A').games[0], { homeScore: null, awayScore: null });
    // The Eastern semifinal A not played yet, so the round is still open.
    const a = raw(d, 'E-SF-A');
    Object.assign(a, { status: 'upcoming', winner: null, wins: { higher: 0, lower: 0 } });
    Object.assign(a.games[0], { status: 'scheduled', homeScore: null, awayScore: null, winnerSide: null, decidedBy: null });
    for (const k of ['E-CF', 'W-CF']) Object.assign(raw(d, k), { games: [], higher: { placeholder: 'TBD', seed: null, feederSeriesKey: null, candidates: null }, lower: { placeholder: 'TBD', seed: null, feederSeriesKey: null, candidates: null } });
  });
  const line = standingLine(half.v, gameStarts(half.b), mid) ?? '';
  assert.ok(line.includes('San Diego FC beat Minnesota United;') || line.includes('San Diego FC beat Minnesota United.'), line);
});

// ---- The early state, as the pipeline writes it ----

test('EARLY: the seed-1 club fills its slot, the Wild Card slot reads "<A> / <B> winner", and never "TBD" beside seed 1', () => {
  const { b, v } = viewOf(MLS_FIXTURE.early, MLS_AT.early);
  for (const [id, club, wc] of [['round_one-1', 'Philadelphia Union', 'Chicago Fire / Orlando City winner'], ['round_one-5', 'San Diego FC', 'Portland Timbers / Real Salt Lake winner']] as const) {
    const s = seriesById(v, id);
    assert.equal(s.higher.kind, 'club');
    assert.equal(s.higher.label, club);
    assert.equal(s.higher.seed, 1);
    assert.equal(s.lower.label, wc);
  }
  for (const s of allSeries(v)) for (const slot of [s.higher, s.lower]) if (slot.seed !== null) assert.equal(slot.kind, 'club', `${s.id}: a seed beside "${slot.label}"`);
  // The 1 seed's team page gets its module: Round One, opponent to be decided.
  const phi = clubPlayoffs(inbound(b, v), 'philadelphia-union');
  assert.ok(phi && phi.state === 'alive');
  assert.equal(phi.roundLabel, 'Round One');
  assert.equal(phi.opponent, 'Chicago Fire / Orlando City winner');
  assert.equal(phi.nextLabel, null);
  assert.equal(phi.scoreLine, null);
});

test("DECISION DAY: only the Wild Card posted; every seeded club in its slot, the 1 seed's module up, Round One with no games", () => {
  const { b, v } = viewOf(MLS_FIXTURE.decisionDay, MLS_AT.decisionDay);
  assert.equal(v.phase.kind === 'active' && v.phase.roundLabel, 'Wild Card');
  const r1 = allSeries(v).filter((s) => s.round === 'round_one');
  assert.equal(r1.length, 8);
  for (const s of r1) {
    assert.equal(s.games.length, 0);
    assert.equal(s.higher.kind, 'club');
  }
  assert.equal(seriesById(v, 'round_one-1').lower.label, 'Chicago Fire / Orlando City winner');
  for (const s of allSeries(v)) for (const slot of [s.higher, s.lower]) {
    assert.notEqual(slot.label, 'TBD');
    if (slot.kind === 'placeholder') assert.equal(slot.seed, null);
  }
  const L = inbound(b, v);
  for (const id of ['philadelphia-union', 'san-diego-fc', 'fc-cincinnati', 'chicago-fire']) assert.equal(clubPlayoffs(L, id)?.state, 'alive', id);
  const cin = clubPlayoffs(L, 'fc-cincinnati');
  assert.ok(cin && cin.state === 'alive');
  assert.equal(cin.opponent, 'Columbus Crew');
  assert.equal(cin.nextLabel, null);
  assert.equal(standingLine(v, gameStarts(b), MLS_AT.decisionDay), 'Wild Card: Wednesday, October 21.');
});

test('NO SEED FILE: a fixed slot left { placeholder: "TBD", seed: 1 } reads "To be decided" with no seed, never "Seed 1 TBD"', () => {
  const { v } = viewOf(MLS_FIXTURE.decisionDay, MLS_AT.decisionDay, (d) => {
    for (const s of d.series as RawSeries[]) if (/-R1-/.test(s.seriesKey)) s.higher = { placeholder: 'TBD', seed: Number(s.seriesKey.slice(-1)), feederSeriesKey: null, candidates: null };
  });
  for (const s of allSeries(v).filter((x) => x.round === 'round_one')) {
    assert.equal(s.higher.kind, 'placeholder');
    assert.equal(s.higher.label, 'To be decided');
    assert.equal(s.higher.seed, null);
  }
});

test('EARLY: a Wild Card slot with no candidates reads "Wild Card winner", not "TBD"', () => {
  const { v } = viewOf(MLS_FIXTURE.early, MLS_AT.early, (d) => Object.assign(raw(d, 'E-R1-1').lower, { candidates: null }));
  assert.equal(seriesById(v, 'round_one-1').lower.label, 'Wild Card winner');
});

// ---- Standing lines ----

test('WHERE THINGS STAND: every state, true and with no article before MLS names', () => {
  const at = (name: string, now: Date) => {
    const { b, v } = viewOf(name, now);
    return standingLine(v, gameStarts(b), now);
  };
  assert.equal(at(MLS_FIXTURE.early, MLS_AT.early), 'Wild Card: Wednesday, October 21.');
  assert.equal(
    at(MLS_FIXTURE.roundOne, MLS_AT.roundOne),
    'Round One: Philadelphia Union beat Chicago Fire 2-0 in the series; FC Cincinnati and Columbus Crew are tied 1-1 in the series; Inter Miami and Nashville SC are tied 1-1 in the series; Charlotte FC and New York City FC are tied 1-1 in the series; San Diego FC and Portland Timbers are tied 1-1 in the series; Vancouver Whitecaps beat FC Dallas 2-0 in the series; LAFC beat Austin FC 2-0 in the series; Minnesota United leads Seattle Sounders 1-0 in the series. Next game: Game 2, Minnesota United at Seattle Sounders, Mon, Nov 2, 10:45 PM ET.',
  );
  assert.equal(at(MLS_FIXTURE.semisDone, MLS_AT.semisDone), 'Conference Finals: Saturday, November 28.');
  assert.equal(at(MLS_FIXTURE.final, MLS_AT.final), 'Inter Miami CF won the 2026 MLS Cup, beating Vancouver Whitecaps FC 3-1.');
});

test('WHERE THINGS STAND: a club waiting on the Wild Card winner, with no article and a singular verb', () => {
  // Round One under way (Vancouver 3, Dallas 0 in Game 1) before the Wild
  // Card is played: the 1 seeds wait on its winner.
  const now = new Date('2026-10-21T12:00:00Z');
  const { b, v } = viewOf(MLS_FIXTURE.early, now, (d) => {
    const s = raw(d, 'W-R1-2');
    Object.assign(s.games[0], { status: 'final', homeScore: 3, awayScore: 0, winnerSide: 'higher', decidedBy: 'regulation' });
    Object.assign(s, { status: 'live', wins: { higher: 1, lower: 0 } });
  });
  const line = standingLine(v, gameStarts(b), now) ?? '';
  assert.ok(line.startsWith('Round One: Philadelphia Union awaits the Chicago Fire / Orlando City winner; '), line);
  assert.ok(line.includes('San Diego FC awaits the Portland Timbers / Real Salt Lake winner'), line);
  assert.ok(line.includes('Vancouver Whitecaps leads FC Dallas 1-0 in the series') === false && line.includes('Vancouver Whitecaps lead FC Dallas 1-0 in the series'), line);
});

test('WHERE THINGS STAND: a round not yet started is its days, never "next", and stays so while its first match is under way', () => {
  // The Conference Semifinals, all four scheduled over two days.
  const now = new Date('2026-11-20T12:00:00Z');
  const reset = (d: Doc) => {
    for (const k of ['E-SF-A', 'E-SF-B', 'W-SF-A', 'W-SF-B']) {
      const s = raw(d, k);
      Object.assign(s, { status: 'upcoming', winner: null, wins: { higher: 0, lower: 0 } });
      Object.assign(s.games[0], { status: 'scheduled', homeScore: null, awayScore: null, winnerSide: null, decidedBy: null, homeShootout: null, awayShootout: null });
    }
    for (const k of ['E-CF', 'W-CF']) Object.assign(raw(d, k), { status: 'upcoming', winner: null, wins: { higher: 0, lower: 0 }, games: [], higher: { placeholder: 'TBD', seed: null, feederSeriesKey: null, candidates: null }, lower: { placeholder: 'TBD', seed: null, feederSeriesKey: null, candidates: null } });
  };
  const before = viewOf(MLS_FIXTURE.semisDone, now, reset);
  const want = 'Conference Semifinals: Saturday, November 21, Sunday, November 22 and Monday, November 23.';
  assert.equal(standingLine(before.v, gameStarts(before.b), now), want);
  // Vancouver v LAFC under way: the same line, and no "next".
  const during = new Date('2026-11-22T03:30:00Z');
  const live = viewOf(MLS_FIXTURE.semisDone, during, (d) => {
    reset(d);
    const s = raw(d, 'W-SF-B');
    s.status = 'live';
    Object.assign(s.games[0], { status: 'live', homeScore: 1, awayScore: 0 });
  });
  const line = standingLine(live.v, gameStarts(live.b), during);
  assert.equal(line, want);
  assert.ok(!/\bnext\b/i.test(line ?? ''));
});

test('KICKOFF: MLS labels a game time "Kickoff:", true before, during and after; MLB keeps "Next:"', () => {
  const { b, v } = viewOf(MLS_FIXTURE.roundOne, MLS_AT.roundOne);
  const r8 = seriesById(v, 'round_one-8');
  assert.equal(r8.nextPrefix, 'Kickoff:');
  assert.equal(r8.nextLabel, 'Game 2 · Mon, Nov 2 · 10:45 PM ET');
  assert.equal(seriesById(v, 'conference_semifinals-4').headline, 'Kickoff: Sat, Nov 21 · 9:30 PM ET');
  const L = inbound(b, v);
  const min = clubPlayoffs(L, 'minnesota-united');
  assert.ok(min && min.state === 'alive');
  assert.equal(min.nextPrefix, 'Kickoff:');
  const early = viewOf(MLS_FIXTURE.early, MLS_AT.early);
  assert.equal(leagueCard(inbound(early.b, early.v), 'MLS')?.series[0].status, 'Kickoff: Wed, Oct 21 · 8:30 PM ET');
  const vanCard = leagueCard(inbound(b, v), 'MLS')?.series.find((s) => s.names === 'Minnesota United vs Seattle Sounders');
  assert.equal(vanCard?.status, 'Minnesota United leads the series 1-0');
  const mlb = buildLeagueView(mapBracketDoc(loadDoc(FIXTURE.mlbFields), { league: 'MLB', season: 2026 })!, clubs(), parks(), new Date('2026-09-29T20:08:00Z'))!;
  assert.ok(allSeries(mlb).every((s) => !('nextPrefix' in s)));
});

test('GROUNDS: NYCFC hosting is shown with no park and listed on no venue page; a one-ground host keeps its park', () => {
  // The data layer withholds the park (mlsHostsWithoutOneGround): the view is
  // built here as the data module builds it, without NYCFC's park.
  const noNyc = new Map([...mlsParks()].filter(([id]) => !mlsHostsWithoutOneGround(['new-york-city-fc', 'inter-miami'], new Map([['new-york-city-fc', 1], ['inter-miami', 1]])).has(id)));
  const b = bracketOf(MLS_FIXTURE.roundOne);
  const v = buildLeagueView(b, mlsClubs(), noNyc, MLS_AT.roundOne)!;
  const nycHome = seriesById(v, 'round_one-4').games[1];
  assert.equal(nycHome.hostName, 'New York City FC');
  assert.equal(nycHome.park, null);
  assert.equal(seriesById(v, 'round_one-3').games[2].park, 'Nu Stadium');
  // Not on the Yankee Stadium page (or any): NYCFC hosts nothing listable.
  const r = viewOf(MLS_FIXTURE.roundOne, MLS_AT.roundOne, (d) => {
    // NYCFC to host Game 3, so a venue listing would be possible.
    const g3 = raw(d, 'E-R1-4').games[2];
    Object.assign(g3, { home: 'new-york-city-fc', away: 'charlotte-fc', homeSide: 'lower' });
  });
  const v2 = buildLeagueView(r.b, mlsClubs(), noNyc, MLS_AT.roundOne)!;
  assert.equal(venueGames(inbound(r.b, v2), ['new-york-city-fc', 'new-york-yankees']), null);
  assert.ok(venueGames(inbound(r.b, v2), ['inter-miami']));
  // The rule itself: the list, a club with two buildings, a club with none,
  // and a failed count.
  assert.deepEqual([...mlsHostsWithoutOneGround(['new-york-city-fc', 'lafc', 'la-galaxy', 'austin-fc'], new Map([['new-york-city-fc', 1], ['lafc', 1], ['la-galaxy', 2]]))].sort(), ['austin-fc', 'la-galaxy', 'new-york-city-fc']);
  assert.deepEqual([...mlsHostsWithoutOneGround(['lafc'], null)], ['lafc']);
});

test('WHERE THINGS STAND: one-game rounds state the match, and a game not yet completed says so', () => {
  // The semifinals half played: Vancouver through on penalties, the rest ahead.
  const now = new Date('2026-11-22T12:00:00Z');
  const { b, v } = viewOf(MLS_FIXTURE.semisDone, now, (d) => {
    for (const k of ['E-SF-A', 'E-SF-B', 'W-SF-A']) {
      const s = raw(d, k);
      Object.assign(s, { status: 'upcoming', winner: null, wins: { higher: 0, lower: 0 } });
      Object.assign(s.games[0], { status: 'scheduled', homeScore: null, awayScore: null, winnerSide: null, decidedBy: null });
    }
    for (const k of ['E-CF', 'W-CF']) {
      const s = raw(d, k);
      s.games = [];
      s.higher = { placeholder: 'Winner of x', seed: null, feederSeriesKey: null, candidates: null };
      s.lower = { placeholder: 'Winner of y', seed: null, feederSeriesKey: null, candidates: null };
    }
  });
  const line = standingLine(v, gameStarts(b), now) ?? '';
  assert.match(line, /^Conference Semifinals: /);
  assert.ok(line.includes('Vancouver Whitecaps beat LAFC 4-3 on penalties after a 2-2 draw'), line);
  assert.ok(line.includes('Philadelphia Union and New York City FC have not completed their game'), line);
  assert.ok(!/\bthe (Philadelphia|Vancouver|LAFC|Inter|San Diego|FC)\b/.test(line), line);
  assert.ok(!/in the series/.test(line), 'one-game rounds are not series');
});

// ---- Pages outside /playoffs ----

test('TEAM MODULE: alive in a series, alive in a one-game round, eliminated, advanced and champion', () => {
  const r1 = viewOf(MLS_FIXTURE.roundOne, MLS_AT.roundOne);
  const L1 = inbound(r1.b, r1.v);
  const min = clubPlayoffs(L1, 'minnesota-united');
  assert.ok(min && min.state === 'alive');
  assert.equal(min.opponent, 'Seattle Sounders');
  assert.equal(min.scoreLine, 'Minnesota United leads the series 1-0');
  assert.equal(min.nextLabel, 'Game 2 · Mon, Nov 2 · 10:45 PM ET');
  assert.equal(min.single, undefined);
  const van = clubPlayoffs(L1, 'vancouver-whitecaps');
  assert.ok(van && van.state === 'alive');
  assert.equal(van.single, true);
  assert.equal(van.nextLabel, 'Sat, Nov 21 · 9:30 PM ET');
  const chi = clubPlayoffs(L1, 'chicago-fire');
  assert.ok(chi && chi.state === 'eliminated');
  assert.equal(chi.lostLine, 'Round One: lost to Philadelphia Union 2-0 in the series');

  const sd = viewOf(MLS_FIXTURE.semisDone, MLS_AT.semisDone);
  const L2 = inbound(sd.b, sd.v);
  const lafc = clubPlayoffs(L2, 'lafc');
  assert.ok(lafc && lafc.state === 'eliminated');
  assert.equal(lafc.lostLine, 'Conference Semifinals: lost to Vancouver Whitecaps 4-3 on penalties after a 2-2 draw');

  // Advanced: a club through its last series whose next slot does not name it
  // yet (a feeder slot with no feederSeriesKey, written as text).
  const adv = viewOf(MLS_FIXTURE.semisDone, MLS_AT.semisDone, (d) => {
    const s = raw(d, 'W-CF');
    s.games = [];
    s.lower = { placeholder: 'West finalist', seed: null, feederSeriesKey: null, candidates: null };
  });
  const v2 = clubPlayoffs(inbound(adv.b, adv.v), 'vancouver-whitecaps');
  assert.ok(v2 && v2.state === 'advanced');
  assert.equal(v2.wonLine, 'Won 4-3 on penalties after a 2-2 draw');
  const mia = viewOf(MLS_FIXTURE.semisDone, MLS_AT.semisDone, (d) => {
    const s = raw(d, 'E-SF-B');
    s.games[0] = { ...s.games[0] };
    raw(d, 'E-CF').games = [];
    raw(d, 'E-CF').higher = { placeholder: 'East finalist', seed: null, feederSeriesKey: null, candidates: null };
  });
  const m2 = clubPlayoffs(inbound(mia.b, mia.v), 'inter-miami');
  assert.ok(m2 && m2.state === 'advanced');
  assert.equal(m2.wonLine, 'Won 4-0');
  const r1adv = viewOf(MLS_FIXTURE.roundOne, MLS_AT.roundOne, (d) => {
    raw(d, 'E-SF-A').higher = { placeholder: 'East 1 or 8', seed: null, feederSeriesKey: null, candidates: null };
  });
  const phi = clubPlayoffs(inbound(r1adv.b, r1adv.v), 'philadelphia-union');
  assert.ok(phi && phi.state === 'advanced');
  assert.equal(phi.wonLine, 'Won the series 2-0');

  const fin = viewOf(MLS_FIXTURE.final, MLS_AT.final);
  const champ = clubPlayoffs(inbound(fin.b, fin.v), 'inter-miami');
  assert.ok(champ && champ.state === 'champion');
  assert.equal(champ.summary, 'Won the MLS Cup 3-1');
  const runnerUp = clubPlayoffs(inbound(fin.b, fin.v), 'vancouver-whitecaps');
  assert.ok(runnerUp && runnerUp.state === 'eliminated');
  assert.equal(runnerUp.lostLine, 'MLS Cup: lost to Inter Miami 3-1');
  for (const id of mlsClubs().keys()) {
    const c = clubPlayoffs(inbound(fin.b, fin.v), id);
    if (!c) continue;
    const text = JSON.stringify(c);
    assert.ok(!/won the Round One|the Round One|Best of 1|\b1-0 in wins/.test(text), text);
  }
});

test('HUB CARD and HERO for /mls: round and status lines, no live wording', () => {
  const { b, v } = viewOf(MLS_FIXTURE.roundOne, MLS_AT.roundOne);
  const L = inbound(b, v);
  const card = leagueCard(L, 'MLS');
  assert.ok(card);
  assert.equal(card.roundLabel, 'Round One');
  assert.equal(card.series[7].names, 'Minnesota United vs Seattle Sounders');
  assert.equal(card.series[7].status, 'Minnesota United leads the series 1-0');
  assert.equal(leagueHeroLine(L, 'MLS')?.text, '2026 MLS Playoffs: Round One. Open the bracket');
  const fin = viewOf(MLS_FIXTURE.final, MLS_AT.final);
  assert.equal(leagueCard(inbound(fin.b, fin.v), 'MLS'), null);
  assert.equal(leagueFinalCard(inbound(fin.b, fin.v), 'MLS')?.text, '2026 MLS Playoffs: final bracket');
  assert.deepEqual(homePlayoffs(L), { season: 2026, leagues: [{ league: 'MLS', href: '/playoffs/mls', roundLabel: 'Round One' }] });
});

test('VENUE: a hosting stadium lists its games; a one-game round has no "Game 1"', () => {
  const { b, v } = viewOf(MLS_FIXTURE.semisDone, MLS_AT.semisDone);
  const g = venueGames(inbound(b, v), ['inter-miami']);
  assert.ok(g);
  assert.equal(g.games.length, 1);
  assert.equal(g.games[0].gameTitle, '');
  assert.equal(g.games[0].roundLabel, 'Conference Finals');
  assert.equal(g.games[0].matchup, 'New York City FC at Inter Miami');
  assert.equal(venueGames(inbound(b, v), ['lafc']), null);
});

test('HOME GAMES: one-game rows carry no game title; Round One rows keep theirs', () => {
  const r1 = viewOf(MLS_FIXTURE.roundOne, MLS_AT.roundOne).v;
  const w = homeGamesWindow([r1], MLS_AT.roundOne);
  assert.equal(w.primary[0].gameTitle, 'Game 2');
  const sd = viewOf(MLS_FIXTURE.semisDone, MLS_AT.semisDone).v;
  for (const g of homeGamesWindow([sd], MLS_AT.semisDone).primary) assert.equal(g.gameTitle, '');
});

// ---- The gate, per league ----

const mlbFinal = () => mapBracketDoc({ ...loadDoc(FIXTURE.mlbFinal), season: 2026 }, { league: 'MLB', season: 2026 }) as Bracket;
const wnbaFinal = () => mapBracketDoc({ ...loadDoc(FIXTURE.wnbaFinal), season: 2026 }, { league: 'WNBA', season: 2026 }) as Bracket;
const DAY = 24 * 60 * 60 * 1000;

test('GATE: MLB and WNBA in their offseason, MLS being played: only MLS modules, and the nav stays on', () => {
  const mlb = mlbFinal();
  const wnba = wnbaFinal();
  const live = bracketOf(MLS_FIXTURE.roundOne);
  // The 2025 finals ended in early November and October; on 2026-11-02 both
  // windows are long closed.
  const now = MLS_AT.roundOne;
  assert.equal(playoffsLinkState([mlb], now).state, 'hidden');
  assert.equal(playoffsLinkState([wnba], now).state, 'hidden');
  assert.deepEqual(inboundBrackets([mlb, wnba, live], now).map((b) => b.league), ['MLS']);
  assert.equal(playoffsLinkState([mlb, wnba, live], now).state, 'active');
});

test('GATE: all three closed: no module anywhere, no nav link', () => {
  const fin = bracketOf(MLS_FIXTURE.final);
  const now = new Date(MLS_AT.final.getTime() + (CHAMPION_WINDOW_DAYS + 1) * DAY);
  assert.deepEqual(inboundBrackets([mlbFinal(), wnbaFinal(), fin], now), []);
  assert.equal(playoffsLinkState([mlbFinal(), wnbaFinal(), fin], now).state, 'hidden');
});

test('GATE: the MLS champion window: MLS modules on for 14 days from the MLS Cup, then off', () => {
  const fin = bracketOf(MLS_FIXTURE.final);
  const cupStart = Date.parse('2026-12-05T19:30:00Z');
  const inside = new Date(cupStart + CHAMPION_WINDOW_DAYS * DAY);
  const after = new Date(cupStart + CHAMPION_WINDOW_DAYS * DAY + 1);
  assert.deepEqual(inboundBrackets([mlbFinal(), wnbaFinal(), fin], inside).map((b) => b.league), ['MLS']);
  assert.equal(playoffsLinkState([mlbFinal(), wnbaFinal(), fin], inside).state, 'champion_window');
  assert.deepEqual(inboundBrackets([mlbFinal(), wnbaFinal(), fin], after), []);
});

test('GATE: each league keeps its own window: MLB in its window while MLS is played, WNBA out', () => {
  const mlb = mlbFinal();
  const lastMlb = Math.max(...mlb.series.flatMap((s) => s.games.map((g) => (g.start ? Date.parse(g.start) : 0))));
  const now = new Date(lastMlb + 3 * DAY);
  const live = bracketOf(MLS_FIXTURE.roundOne);
  assert.deepEqual(inboundBrackets([mlb, wnbaFinal(), live], now).map((b) => b.league), ['MLB', 'MLS']);
});

// ---- The gate: finished leagues close together, by cohort ----

/** A finished bracket whose last final game kicked off at `iso`: every start
 *  in the stored document moved by the same amount. */
function finishedAt(name: string, league: 'MLB' | 'WNBA' | 'MLS', iso: string): Bracket {
  const d = loadDoc(name);
  d.season = 2026;
  const games = (d.series as RawSeries[]).flatMap((s) => s.games);
  const last = Math.max(...games.filter((g) => g.status === 'final' && typeof g.start === 'string').map((g) => Date.parse(g.start as string)));
  const by = Date.parse(iso) - last;
  for (const g of games) if (typeof g.start === 'string') g.start = new Date(Date.parse(g.start) + by).toISOString();
  const b = mapBracketDoc(d, { league, season: 2026 });
  assert.ok(b);
  return b;
}
const MLB_DONE = () => finishedAt(FIXTURE.mlbFinal, 'MLB', '2026-10-29T00:00:00Z');
const WNBA_DONE = () => finishedAt(FIXTURE.wnbaFinal, 'WNBA', '2026-11-01T00:00:00Z');
const leaguesAt = (bs: Bracket[], iso: string) => inboundBrackets(bs, new Date(iso)).map((b) => b.league);

test('COHORT: MLB (10-29) and WNBA (11-01) close together at 2026-11-15T00:00Z; MLS being played stays on throughout', () => {
  const all = () => [MLB_DONE(), WNBA_DONE(), bracketOf(MLS_FIXTURE.roundOne)];
  assert.deepEqual(leaguesAt(all(), '2026-11-03T19:30:00Z'), ['MLB', 'WNBA', 'MLS'], 'today');
  assert.deepEqual(leaguesAt(all(), '2026-11-12T12:00:00Z'), ['MLB', 'WNBA', 'MLS'], 'MLB alone would have closed 11-12');
  // The close instant is the window's last, as for the nav (inclusive, the
  // rule the MLB and WNBA tests already pin); off from the next millisecond.
  assert.deepEqual(leaguesAt(all(), '2026-11-15T00:00:00.000Z'), ['MLB', 'WNBA', 'MLS']);
  assert.deepEqual(leaguesAt(all(), '2026-11-15T00:00:00.001Z'), ['MLS'], 'both off after the close, MLS on');
  // The nav and hub keep the any-league rule: on while MLS is played.
  assert.equal(playoffsLinkState(all(), new Date('2026-11-15T00:00:00.001Z')).state, 'active');
});

test('COHORT: the MLS champion window never reopens MLB or WNBA', () => {
  const mls = finishedAt(MLS_FIXTURE.final, 'MLS', '2026-12-18T20:00:00Z');
  const all = [MLB_DONE(), WNBA_DONE(), mls];
  assert.deepEqual(leaguesAt(all, '2026-12-19T12:00:00Z'), ['MLS']);
  assert.deepEqual(leaguesAt(all, '2027-01-01T20:00:00.000Z'), ['MLS']);
  assert.deepEqual(leaguesAt(all, '2027-01-01T20:00:00.001Z'), []);
});

test('COHORT: two leagues finishing 10 days apart share one close; 15 days apart they do not', () => {
  const near = [finishedAt(FIXTURE.mlbFinal, 'MLB', '2026-10-01T00:00:00Z'), finishedAt(FIXTURE.wnbaFinal, 'WNBA', '2026-10-11T00:00:00Z')];
  assert.deepEqual(leaguesAt(near, '2026-10-20T00:00:00Z'), ['MLB', 'WNBA'], 'MLB alone would have closed 10-15');
  assert.deepEqual(leaguesAt(near, '2026-10-25T00:00:00.000Z'), ['MLB', 'WNBA']);
  assert.deepEqual(leaguesAt(near, '2026-10-25T00:00:00.001Z'), []);
  const far = [finishedAt(FIXTURE.mlbFinal, 'MLB', '2026-10-01T00:00:00Z'), finishedAt(FIXTURE.wnbaFinal, 'WNBA', '2026-10-16T00:00:00Z')];
  assert.deepEqual(leaguesAt(far, '2026-10-20T00:00:00Z'), ['WNBA']);
});

test('COHORT: a league still being played is in no cohort and holds no other league open', () => {
  const live = bracketOf(MLS_FIXTURE.roundOne);
  assert.deepEqual(leaguesAt([finishedAt(FIXTURE.mlbFinal, 'MLB', '2026-10-01T00:00:00Z'), live], '2026-10-16T00:00:00Z'), ['MLS']);
});

// ---- Metadata ----

test('METADATA: /playoffs/mls title and descriptions, every round, true and within the audit', () => {
  const SUFFIX = ' | PromoNight';
  const { v } = viewOf(MLS_FIXTURE.roundOne, MLS_AT.roundOne);
  const c = leagueCopy(2026, 'MLS', '/playoffs/mls', v);
  assert.equal(c.title, '2026 MLS Playoffs: Bracket and Schedule');
  assert.ok((c.title + SUFFIX).length <= 65);
  assert.equal(c.canonical, 'https://www.getpromonight.com/playoffs/mls');
  for (const roundLabel of ['Wild Card', 'Round One', 'Conference Semifinals', 'Conference Finals', 'MLS Cup']) {
    const d = leagueCopy(2026, 'MLS', '/playoffs/mls', { ...v, phase: { kind: 'active', roundKey: 'x', roundLabel } }).description;
    assert.ok(d.length <= DESCRIPTION_MAX, `${d.length}: ${d}`);
    assert.ok(!/series|predict|simulation|live|home game/i.test(d), d);
  }
  // The longest champion name with the longest summary still fits.
  const fin = viewOf(MLS_FIXTURE.final, MLS_AT.final).v;
  const long = { ...fin, phase: { kind: 'concluded' as const, championTeamId: 'x', championName: 'New England Revolution', championHref: '/x', summary: 'Won the MLS Cup 10-11 on penalties after a 3-3 draw' } };
  const d = leagueCopy(2026, 'MLS', '/playoffs/mls', long).description;
  assert.ok(d.length <= DESCRIPTION_MAX, `${d.length}: ${d}`);
  const ld = leagueJsonLd(c, 'MLS', v.updatedAt);
  assert.deepEqual(ld.map((s) => s['@type']), ['WebPage', 'BreadcrumbList']);
  assert.equal(seriesKeyIn(JSON.stringify(ld)), null);
});

test('METADATA: the hub with three leagues, MLB and WNBA finished and MLS being played, fits and is true', () => {
  const ROUTES = ['MLB', 'WNBA', 'MLS'] as const;
  const mlb = buildLeagueView(mlbFinal(), clubs(), parks(), MLS_AT.roundOne)!;
  const wnba = buildLeagueView(wnbaFinal(), clubs(), parks(), MLS_AT.roundOne)!;
  const live = viewOf(MLS_FIXTURE.roundOne, MLS_AT.roundOne).v;
  const ok = (v: LeagueView) => ({ league: v.league, state: 'ok' as const, view: v });
  const c = hubCopy(2026, ROUTES, [ok(mlb), ok(wnba), ok(live)]);
  assert.equal(c.title, '2026 Playoffs: MLB, WNBA and MLS Brackets');
  assert.equal(c.description, 'The 2026 MLB, WNBA and MLS playoff brackets. MLB champion: Los Angeles Dodgers. WNBA champion: Las Vegas Aces. MLS: Round One.');
  // Before the MLS document exists the title does not name an MLS bracket.
  assert.equal(hubCopy(2026, ROUTES, [ok(mlb), ok(wnba)]).title, '2026 Playoffs: MLB and WNBA Brackets');
  assert.equal(hubCopy(2026, ROUTES, [ok(mlb), ok(wnba)]).description, 'The 2026 MLB and WNBA postseason is complete, the final brackets round by round. MLB champion: Los Angeles Dodgers. WNBA champion: Las Vegas Aces.');
  // Every round label with the longest champion names of the three leagues.
  const named = (v: LeagueView, championName: string): LeagueView => ({ ...v, phase: { kind: 'concluded', championTeamId: 'x', championName, championHref: '/x', summary: 'Won' } });
  for (const roundLabel of ['Wild Card', 'Round One', 'Conference Semifinals', 'Conference Finals', 'MLS Cup']) {
    const m = { ...live, phase: { kind: 'active' as const, roundKey: 'x', roundLabel } };
    const d = hubCopy(2026, ROUTES, [ok(named(mlb, 'Philadelphia Phillies')), ok(named(wnba, 'Golden State Valkyries')), ok(m)]).description;
    assert.ok(d.length <= DESCRIPTION_MAX, `${d.length}: ${d}`);
  }
  const all = hubCopy(2026, ROUTES, [ok(named(mlb, 'Philadelphia Phillies')), ok(named(wnba, 'Golden State Valkyries')), ok(named(live, 'New England Revolution'))]).description;
  assert.ok(all.length <= DESCRIPTION_MAX, `${all.length}: ${all}`);
  assert.match(all, /MLS champion: New England Revolution/);
});

// ---- Nothing private ----

test('NO KEY, NO ID: the views, lines and copy of every state carry no series key, game id or run id', () => {
  for (const [name, now] of [[MLS_FIXTURE.early, MLS_AT.early], [MLS_FIXTURE.roundOne, MLS_AT.roundOne], [MLS_FIXTURE.semisDone, MLS_AT.semisDone], [MLS_FIXTURE.final, MLS_AT.final]] as const) {
    const { b, v } = viewOf(name, now);
    const text = JSON.stringify([v, standingLine(v, gameStarts(b), now), leagueCopy(2026, 'MLS', '/playoffs/mls', v), mlsClubs().size && [...mlsClubs().keys()].map((id) => clubPlayoffs(inbound(b, v), id))]);
    assert.equal(seriesKeyIn(text), null, name);
    assert.ok(!/"CUP"|Winner of|feederSeriesKey|gameId|runId|fixture-run|f1x7ure/.test(text), name);
    const ids = rawText(name).match(/"gameId": "(\d+)"/g) ?? [];
    assert.ok(ids.length > 0);
    for (const m of ids) assert.ok(!text.includes(m.split('"')[3]), `${name}: ${m}`);
  }
});
