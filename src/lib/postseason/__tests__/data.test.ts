// The Firestore side: what is asked for, and what each failure turns into.
// The fake applies the field mask the way Firestore does, so a passing test
// proves the masked fields are enough to build the page.
import { test, mock } from 'node:test';
import assert from 'node:assert/strict';
import { CAPTURED_AT, FIXTURE, capturedTeams, fakeFirestore, loadDoc, parks } from './helpers';

type Fake = ReturnType<typeof fakeFirestore>;

// One mutable holder. The module under test imports `db` once; each test
// swaps what stands behind it.
const current: { db: Fake } = { db: fakeFirestore({}) };
const db = {
  collection: (name: string) => current.db.collection(name),
  getAll: (...args: unknown[]) => current.db.getAll(...args),
};
const venues = { fail: new Set<string>(), missing: new Set<string>(), asked: [] as string[] };
const teams = { drop: new Set<string>() };

mock.module('server-only', { namedExports: {} });
mock.module(new URL('../../firebase.ts', import.meta.url).href, { namedExports: { db } });
mock.module(new URL('../../data.ts', import.meta.url).href, {
  namedExports: {
    getAllTeams: async () => capturedTeams().filter((t) => !teams.drop.has(t.id)),
    getVenueForTeam: async (id: string) => {
      venues.asked.push(id);
      if (venues.fail.has(id)) throw new Error('venue read failed');
      if (venues.missing.has(id)) return null;
      const name = parks().get(id);
      return name ? { name } : null;
    },
  },
});

// Loaded inside each test: a static import would be hoisted above the mocks.
const load = () => import('../data');

function use(docs: Parameters<typeof fakeFirestore>[0]): Fake {
  current.db = fakeFirestore(docs);
  venues.fail.clear();
  venues.missing.clear();
  venues.asked.length = 0;
  teams.drop.clear();
  return current.db;
}
const quiet = <T>(fn: () => Promise<T>): Promise<T> => {
  const original = console.error;
  console.error = () => {};
  return fn().finally(() => {
    console.error = original;
  });
};

const MLB = () => loadDoc(FIXTURE.mlbLive);
const WNBA = () => loadDoc(FIXTURE.wnbaLive);
const FROZEN = { league: 'MLB', season: 2026, frozenAt: { toDate: () => new Date('2026-09-29T01:05:52.350Z') }, rows: ['a corpus the web must not pull'] };

test('BRACKET READ: asks for four fields and nothing else', async () => {
  const { getBracket } = await load();
  const fake = use({ 'postseasonBrackets/MLB_2026': MLB() });
  const r = await getBracket('MLB');
  assert.equal(r.state, 'ok');
  assert.deepEqual(fake.reads, [{ path: 'postseasonBrackets/MLB_2026', fieldMask: ['league', 'season', 'series', 'lastChangedAt'] }]);
});

test('BRACKET READ: the masked document is enough to build the whole page', async () => {
  const { getLeaguePageData } = await load();
  use({ 'postseasonBrackets/MLB_2026': MLB(), 'predictionInputs/MLB_2026': FROZEN });
  const page = await getLeaguePageData('MLB');
  assert.equal(page.state, 'ok');
  if (page.state !== 'ok') return;
  assert.equal(page.view.rounds.length, 4);
  assert.equal(page.view.updatedLabel, 'Sep 29, 1:10 PM ET');
  assert.equal(page.predictionsLocked, true);
  const wc = page.view.rounds[0].groups[0].series[0];
  assert.equal(wc.higher.label, 'Astros');
  assert.equal(wc.games[0].park, 'Daikin Park');
});

test('BRACKET READ: no document is "missing", which is not an error', async () => {
  const { getBracket, getLeaguePageData } = await load();
  use({});
  assert.deepEqual(await getBracket('MLB'), { state: 'missing' });
  assert.deepEqual(await getLeaguePageData('MLB'), { state: 'missing', league: 'MLB' });
});

test('BRACKET READ: a failed read is "unavailable" and does not throw', async () => {
  const { getBracket, getLeaguePageData } = await load();
  use({ 'postseasonBrackets/MLB_2026': new Error('UNAVAILABLE: the service is down') });
  assert.deepEqual(await quiet(() => getBracket('MLB')), { state: 'unavailable' });
  assert.deepEqual(await quiet(() => getLeaguePageData('MLB')), { state: 'unavailable', league: 'MLB' });
});

test('BRACKET READ: a document the mapper refuses is "unavailable"', async () => {
  const { getBracket } = await load();
  const bad = MLB();
  (bad.series as Record<string, unknown>[])[0].status = 'paused';
  use({ 'postseasonBrackets/MLB_2026': bad });
  assert.deepEqual(await quiet(() => getBracket('MLB')), { state: 'unavailable' });
});

test('BRACKET READ: a document stored under the wrong id is refused', async () => {
  const { getBracket } = await load();
  use({ 'postseasonBrackets/MLB_2026': WNBA() });
  assert.deepEqual(await quiet(() => getBracket('MLB')), { state: 'unavailable' });
});

test('PAGE DATA: a club with no team record makes the bracket unavailable', async () => {
  const { getLeaguePageData } = await load();
  use({ 'postseasonBrackets/MLB_2026': MLB() });
  teams.drop.add('houston-astros');
  assert.deepEqual(await quiet(() => getLeaguePageData('MLB')), { state: 'unavailable', league: 'MLB' });
});

test('PAGE DATA: a host with no venue, or a venue read that fails, costs only that park line', async () => {
  const { getLeaguePageData } = await load();
  use({ 'postseasonBrackets/MLB_2026': MLB() });
  venues.missing.add('houston-astros');
  venues.fail.add('new-york-yankees');
  const page = await quiet(() => getLeaguePageData('MLB'));
  assert.equal(page.state, 'ok');
  if (page.state !== 'ok') return;
  const games = page.view.homeGames;
  assert.equal(games.find((g) => g.hostTeamId === 'houston-astros')?.park, null);
  assert.equal(games.find((g) => g.hostTeamId === 'new-york-yankees')?.park, null);
  assert.equal(games.find((g) => g.hostTeamId === 'atlanta-braves')?.park, 'Truist Park');
});

test('PAGE DATA: venues are looked up for hosts only', async () => {
  const { getLeaguePageData } = await load();
  use({ 'postseasonBrackets/MLB_2026': MLB() });
  const page = await getLeaguePageData('MLB');
  assert.equal(page.state, 'ok');
  // Eight clubs host a listed game in this capture. The four Wild Card
  // visitors host nothing, and no venue is read for them.
  assert.deepEqual([...venues.asked].sort(), [
    'atlanta-braves', 'cleveland-guardians', 'houston-astros', 'los-angeles-dodgers',
    'milwaukee-brewers', 'new-york-yankees', 'san-diego-padres', 'tampa-bay-rays',
  ]);
});

test('PREDICTIONS: the read asks for frozenAt alone, so the corpus never crosses the wire', async () => {
  const { arePredictionInputsFrozen } = await load();
  const fake = use({ 'predictionInputs/MLB_2026': FROZEN });
  assert.equal(await arePredictionInputsFrozen('MLB'), true);
  assert.deepEqual(fake.reads, [{ path: 'predictionInputs/MLB_2026', fieldMask: ['frozenAt'] }]);
});

test('PREDICTIONS: no document, no freeze stamp, or a failed read all hide the card', async () => {
  const { arePredictionInputsFrozen } = await load();
  use({});
  assert.equal(await arePredictionInputsFrozen('MLB'), false);
  use({ 'predictionInputs/MLB_2026': { league: 'MLB', season: 2026 } });
  assert.equal(await arePredictionInputsFrozen('MLB'), false);
  use({ 'predictionInputs/MLB_2026': { league: 'MLB', frozenAt: null } });
  assert.equal(await arePredictionInputsFrozen('MLB'), false);
  use({ 'predictionInputs/MLB_2026': new Error('PERMISSION_DENIED') });
  assert.equal(await quiet(() => arePredictionInputsFrozen('MLB')), false);
  // One league's freeze says nothing about another's.
  use({ 'predictionInputs/MLB_2026': FROZEN });
  assert.equal(await arePredictionInputsFrozen('WNBA'), false);
});

test('WHICH LEAGUES: one batched read of names only', async () => {
  const { readLeaguesWithBracket } = await load();
  const fake = use({ 'postseasonBrackets/MLB_2026': MLB(), 'postseasonBrackets/WNBA_2026': WNBA() });
  assert.deepEqual(await readLeaguesWithBracket(), ['MLB', 'WNBA']);
  assert.deepEqual(fake.reads, [
    { path: 'postseasonBrackets/MLB_2026', fieldMask: ['league'] },
    { path: 'postseasonBrackets/WNBA_2026', fieldMask: ['league'] },
  ]);
  use({ 'postseasonBrackets/WNBA_2026': WNBA() });
  assert.deepEqual(await readLeaguesWithBracket(), ['WNBA']);
  use({});
  assert.deepEqual(await readLeaguesWithBracket(), []);
});

test('WHICH LEAGUES: a failed read throws, so the caller decides what failure means', async () => {
  const { readLeaguesWithBracket } = await load();
  use({ 'postseasonBrackets/MLB_2026': new Error('UNAVAILABLE') });
  await assert.rejects(() => readLeaguesWithBracket(), /UNAVAILABLE/);
});

// ---- The link gate, through the real reads ----
//
// The three states are tested as a pure rule in gate.test.ts. These hold the
// read that feeds it. A finished current-season bracket does not exist yet,
// so FINISHED is the 2025 final document with its season moved to 2026; its
// games keep their 2025 dates, and the tests set the clock beside them.
const FINISHED = (): Record<string, unknown> => ({ ...loadDoc(FIXTURE.mlbFinal), season: 2026 });
const ENDED = Date.parse('2025-11-02T00:00:00.000Z');
const DAY = 24 * 60 * 60 * 1000;

test('LINK GATE: one batched read with the four-field mask', async () => {
  const { readCurrentBrackets } = await load();
  const fake = use({ 'postseasonBrackets/MLB_2026': MLB(), 'postseasonBrackets/WNBA_2026': WNBA() });
  const brackets = await readCurrentBrackets();
  assert.deepEqual(brackets.map((b) => b.league), ['MLB', 'WNBA']);
  assert.deepEqual(fake.reads, [
    { path: 'postseasonBrackets/MLB_2026', fieldMask: ['league', 'season', 'series', 'lastChangedAt'] },
    { path: 'postseasonBrackets/WNBA_2026', fieldMask: ['league', 'season', 'series', 'lastChangedAt'] },
  ]);
});

test('LINK GATE, all three states through the read: active, champion window, hidden', async () => {
  const { readCurrentBrackets } = await load();
  const { playoffsLinkState } = await import('../gate');

  use({ 'postseasonBrackets/MLB_2026': MLB(), 'postseasonBrackets/WNBA_2026': WNBA() });
  assert.deepEqual(playoffsLinkState(await readCurrentBrackets(), CAPTURED_AT), { state: 'active' });

  use({ 'postseasonBrackets/MLB_2026': FINISHED() });
  assert.equal(playoffsLinkState(await readCurrentBrackets(), new Date(ENDED + 5 * DAY)).state, 'champion_window');
  assert.deepEqual(playoffsLinkState(await readCurrentBrackets(), new Date(ENDED + 15 * DAY)), { state: 'hidden', reason: 'window_closed' });

  use({});
  assert.deepEqual(playoffsLinkState(await readCurrentBrackets(), CAPTURED_AT), { state: 'hidden', reason: 'no_bracket' });
});

test('LINK GATE: a document the mapper refuses is left out, and opens nothing', async () => {
  const { readCurrentBrackets } = await load();
  const { playoffsLinkVisible } = await import('../gate');
  const bad = MLB();
  (bad.series as Record<string, unknown>[])[0].status = 'paused';
  use({ 'postseasonBrackets/MLB_2026': bad });
  const brackets = await quiet(() => readCurrentBrackets());
  assert.deepEqual(brackets, []);
  assert.equal(playoffsLinkVisible(brackets, CAPTURED_AT), false);
  // Beside a league that reads, the readable one decides.
  use({ 'postseasonBrackets/MLB_2026': bad, 'postseasonBrackets/WNBA_2026': WNBA() });
  assert.equal(playoffsLinkVisible(await quiet(() => readCurrentBrackets()), CAPTURED_AT), true);
});

test('LINK GATE: a failed read throws, so the layout hides the link and the sitemap fails loudly', async () => {
  const { readCurrentBrackets } = await load();
  use({ 'postseasonBrackets/MLB_2026': new Error('UNAVAILABLE') });
  await assert.rejects(() => readCurrentBrackets(), /UNAVAILABLE/);
});

// The cached gate. Order matters and is the point: a failure must not be
// remembered, a success is, and the clock is never cached with it.
test('LINK GATE, cached: a failed read is not remembered; a good one is; the clock still moves', async () => {
  const { isPlayoffsLinkActive, getPlayoffsLinkState, getPlayoffsSitemapEntries } = await load();
  use({ 'postseasonBrackets/MLB_2026': new Error('UNAVAILABLE') });
  await assert.rejects(() => isPlayoffsLinkActive(), /UNAVAILABLE/);
  await assert.rejects(() => getPlayoffsSitemapEntries(), /UNAVAILABLE/);

  const fake = use({ 'postseasonBrackets/MLB_2026': FINISHED() });
  assert.equal(await isPlayoffsLinkActive(new Date(ENDED + DAY)), true);
  assert.equal(fake.reads.length, 2, 'both documents asked for, once');
  // Served from the process cache from here on, and the clock decides.
  assert.equal((await getPlayoffsLinkState(new Date(ENDED + 14 * DAY))).state, 'champion_window');
  assert.equal(await isPlayoffsLinkActive(new Date(ENDED + 14 * DAY + 1)), false);
  assert.equal(fake.reads.length, 2, 'no second read inside the five minutes');

  // The sitemap follows the same gate.
  const open = await getPlayoffsSitemapEntries(new Date(ENDED + DAY));
  assert.deepEqual(open.map((e) => e.path), ['/playoffs', '/playoffs/mlb']);
  const stamp = (FINISHED().lastChangedAt as { toDate: () => Date }).toDate().toISOString();
  assert.deepEqual(open.map((e) => e.lastModified.toISOString()), [stamp, stamp]);
  assert.deepEqual(await getPlayoffsSitemapEntries(new Date(ENDED + 15 * DAY)), []);
});

test('WHICH LEAGUES, cached: the list for static params is its own read', async () => {
  const { getLeaguesWithBracket } = await load();
  const fake = use({ 'postseasonBrackets/MLB_2026': MLB() });
  assert.deepEqual(await getLeaguesWithBracket(), ['MLB']);
  assert.deepEqual(await getLeaguesWithBracket(), ['MLB']);
  assert.equal(fake.reads.length, 2, 'two documents asked for once; the second call was served from the process cache');
});

test('ROUTES: the league segment is lowercase and only the route table resolves', async () => {
  const { postseasonLeagueFromSlug, postseasonPath, POSTSEASON_LEAGUES, POSTSEASON_SEASON } = await load();
  assert.equal(postseasonLeagueFromSlug('mlb'), 'MLB');
  assert.equal(postseasonLeagueFromSlug('wnba'), 'WNBA');
  for (const s of ['MLB', 'Mlb', 'nba', 'nhl', '', 'mlb ', 'mlb/x']) assert.equal(postseasonLeagueFromSlug(s), null, s);
  assert.equal(postseasonPath('MLB'), '/playoffs/mlb');
  assert.equal(postseasonPath('WNBA'), '/playoffs/wnba');
  assert.deepEqual([...POSTSEASON_LEAGUES], ['MLB', 'WNBA']);
  assert.equal(POSTSEASON_SEASON, 2026);
  void CAPTURED_AT;
});
