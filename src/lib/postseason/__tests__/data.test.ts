// The Firestore side: what is asked for, and what each failure turns into.
// The fake applies the field mask the way Firestore does, so a passing test
// proves the masked fields are enough to build the page.
import { test, mock } from 'node:test';
import assert from 'node:assert/strict';
import { CAPTURED_AT, FIXTURE, capturedTeams, fakeFirestore, loadDoc, parkNames, rawText, venuePages, PREDICTED } from './helpers';

type Fake = ReturnType<typeof fakeFirestore>;

// One mutable holder. The module under test imports `db` once; each test
// swaps what stands behind it.
const current: { db: Fake } = { db: fakeFirestore({}) };
const db = {
  collection: (name: string) => current.db.collection(name),
  getAll: (...args: unknown[]) => current.db.getAll(...args),
};
const venues = { fail: new Set<string>(), missing: new Set<string>(), asked: [] as string[] };
const pages = { fail: false, held: new Set<string>(), none: new Set<string>() };
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
      const name = parkNames().get(id);
      return name ? { name } : null;
    },
  },
});
mock.module(new URL('../../venue-hub.ts', import.meta.url).href, {
  namedExports: {
    getTeamVenueHubMap: async () => {
      if (pages.fail) throw new Error('venueHubs read failed');
      const map = venuePages();
      for (const id of pages.none) map.delete(id);
      for (const id of pages.held) {
        const p = map.get(id);
        if (p) map.set(id, { ...p, indexable: false });
      }
      return map;
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
  pages.fail = false;
  pages.held.clear();
  pages.none.clear();
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
const PREDICTED_MLB = () => loadDoc(PREDICTED.mlb);
const PREDICTED_WNBA = () => loadDoc(PREDICTED.wnba);

test('BRACKET READ: asks for four fields and nothing else', async () => {
  const { getBracket } = await load();
  const fake = use({ 'postseasonBrackets/MLB_2026': MLB() });
  const r = await getBracket('MLB');
  assert.equal(r.state, 'ok');
  assert.deepEqual(fake.reads, [{ path: 'postseasonBrackets/MLB_2026', fieldMask: ['league', 'season', 'series', 'lastChangedAt'] }]);
});

test('BRACKET READ: the masked document is enough to build the whole page', async () => {
  const { getLeaguePageData } = await load();
  use({ 'postseasonBrackets/MLB_2026': MLB(), 'predictedBrackets/MLB_2026': PREDICTED_MLB() });
  const page = await getLeaguePageData('MLB');
  assert.equal(page.state, 'ok');
  if (page.state !== 'ok') return;
  assert.equal(page.view.rounds.length, 4);
  assert.equal(page.view.updatedLabel, 'Sep 29, 1:10 PM ET');
  assert.ok(page.predictions);
  assert.equal(page.predictions.view.scorecard.championName, 'Milwaukee Brewers');
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

// A read that fails, and a document the web cannot read, THROW. A render
// that throws produces no page, so ISR keeps the last good one; a render
// that returned "not available" would replace it, cached and indexable.
test('BRACKET READ: a failed read throws, and so does the page data', async () => {
  const { getBracket, getLeaguePageData } = await load();
  use({ 'postseasonBrackets/MLB_2026': new Error('UNAVAILABLE: the service is down') });
  await assert.rejects(() => getBracket('MLB'), /UNAVAILABLE/);
  await assert.rejects(() => getLeaguePageData('MLB'), /UNAVAILABLE/);
});

test('BRACKET READ: a document the mapper refuses throws, naming the document', async () => {
  const { getBracket } = await load();
  const bad = MLB();
  (bad.series as Record<string, unknown>[])[0].status = 'paused';
  use({ 'postseasonBrackets/MLB_2026': bad });
  await assert.rejects(() => getBracket('MLB'), /MLB_2026 is not in a shape the web reads/);
});

test('BRACKET READ: a document stored under the wrong id throws', async () => {
  const { getBracket } = await load();
  use({ 'postseasonBrackets/MLB_2026': WNBA() });
  await assert.rejects(() => getBracket('MLB'), /not in a shape the web reads/);
});

test('PAGE DATA: a club with no team record throws, naming the document', async () => {
  const { getLeaguePageData } = await load();
  use({ 'postseasonBrackets/MLB_2026': MLB() });
  teams.drop.add('houston-astros');
  await assert.rejects(() => getLeaguePageData('MLB'), /MLB_2026 names a club with no team record/);
});

test('BRACKET READ: nothing is ever "unavailable"', async () => {
  const mod = await load();
  const text = JSON.stringify(Object.keys(mod));
  assert.ok(!text.includes('Unavailable'));
  // The type has two states, and the page turns "missing" into a 404.
  use({});
  const r = await mod.getBracket('MLB');
  assert.ok(r.state === 'missing' || r.state === 'ok');
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

test('PARK PAGE: the park links to its page only when the web has one above the indexing floor', async () => {
  const { getLeaguePageData } = await load();
  use({ 'postseasonBrackets/MLB_2026': MLB() });
  pages.held.add('houston-astros'); // a page exists, held below the floor
  pages.none.add('new-york-yankees'); // no page at all
  const page = await getLeaguePageData('MLB');
  assert.equal(page.state, 'ok');
  if (page.state !== 'ok') return;
  const of = (id: string) => page.view.homeGames.find((g) => g.hostTeamId === id);
  assert.equal(of('houston-astros')?.park, 'Daikin Park');
  assert.equal(of('houston-astros')?.parkPage, null);
  assert.equal(of('new-york-yankees')?.park, 'Yankee Stadium');
  assert.equal(of('new-york-yankees')?.parkPage, null);
  assert.deepEqual(of('atlanta-braves')?.parkPage, { href: '/venues/truist-park', buildingSlug: 'truist-park', buildingName: 'Truist Park' });
  // The page is the building's, under the building's own slug.
  assert.deepEqual(of('tampa-bay-rays')?.parkPage, { href: '/venues/tropicana-field', buildingSlug: 'tropicana-field', buildingName: 'Tropicana Field' });
});

test('PARK PAGE: a failed venue page read costs every link and no name', async () => {
  const { getLeaguePageData } = await load();
  use({ 'postseasonBrackets/MLB_2026': MLB() });
  pages.fail = true;
  const page = await quiet(() => getLeaguePageData('MLB'));
  assert.equal(page.state, 'ok');
  if (page.state !== 'ok') return;
  assert.ok(page.view.homeGames.length > 0);
  assert.ok(page.view.homeGames.every((g) => g.park !== null && g.parkPage === null));
});

test('PARK PAGE: a club with no venue record gets no name, so no link either', async () => {
  const { getLeaguePageData } = await load();
  use({ 'postseasonBrackets/MLB_2026': MLB() });
  venues.missing.add('houston-astros');
  const page = await getLeaguePageData('MLB');
  assert.equal(page.state, 'ok');
  if (page.state !== 'ok') return;
  const row = page.view.homeGames.find((g) => g.hostTeamId === 'houston-astros');
  assert.equal(row?.park, null);
  assert.equal(row?.parkPage, null);
});

const PREDICTED_MASK = [
  'league',
  'season',
  'target',
  'lockedAt',
  'simRuns',
  'computedAt',
  'reviewedSha256',
  'champion',
  'rounds',
  'titleOdds',
  'provenance.frozenAt',
  'provenance.engineCommitAtFreeze',
  'provenance.coreFiles',
  'provenance.corpusSha256',
  'provenance.paramsSha256',
  'provenance.descriptorSha256',
  'provenance.slugMapSha256',
];

test('PREDICTIONS READ: one masked read; no operator field, path list, run id or other hash is asked for', async () => {
  const { getPredictedBracket } = await load();
  const fake = use({ 'predictedBrackets/WNBA_2026': PREDICTED_WNBA() });
  const p = await getPredictedBracket('WNBA');
  assert.ok(p);
  assert.deepEqual(fake.reads, [{ path: 'predictedBrackets/WNBA_2026', fieldMask: PREDICTED_MASK }]);
  for (const f of PREDICTED_MASK) {
    assert.ok(!/By$|acks|seedFile|canonical|engineFiles|engineCommitAt(Compute|Execute)|computedBy|executedAt|info|degeneracy|seeds/.test(f), f);
  }
});

test('PREDICTIONS READ: the masked document is enough, and nothing outside the mask is in this process', async () => {
  const { getPredictedBracket } = await load();
  use({ 'predictedBrackets/MLB_2026': PREDICTED_MLB() });
  const p = await getPredictedBracket('MLB');
  assert.ok(p);
  assert.equal(p.series.length, 11);
  const out = JSON.stringify(p);
  const stored = JSON.parse(rawText(PREDICTED.mlb)) as Record<string, Record<string, unknown>>;
  for (const v of [stored.provenance.seedFileAuthoredBy, stored.provenance.seedFileSha256, stored.provenance.canonicalDescriptorSha256, stored.computedBy]) {
    assert.ok(typeof v === 'string' && !out.includes(v));
  }
});

test('PREDICTIONS READ: no document is null and the page shows no predictions; a failed read or a refused document throws', async () => {
  const { getPredictedBracket, getLeaguePageData } = await load();
  use({ 'postseasonBrackets/MLB_2026': MLB() });
  assert.equal(await getPredictedBracket('MLB'), null);
  const page = await getLeaguePageData('MLB');
  assert.equal(page.state === 'ok' && page.predictions, null);

  use({ 'postseasonBrackets/MLB_2026': MLB(), 'predictedBrackets/MLB_2026': new Error('PERMISSION_DENIED') });
  await assert.rejects(() => getPredictedBracket('MLB'), /PERMISSION_DENIED/);
  await assert.rejects(() => getLeaguePageData('MLB'), /PERMISSION_DENIED/);

  const bad = PREDICTED_MLB();
  bad.target = 'scratch';
  use({ 'postseasonBrackets/MLB_2026': MLB(), 'predictedBrackets/MLB_2026': bad });
  await assert.rejects(() => getLeaguePageData('MLB'), /predictedBrackets\/MLB_2026 is not in a shape the web reads/);
});

test('PREDICTIONS READ: a prediction that does not join the real bracket throws', async () => {
  const { getLeaguePageData } = await load();
  // The WNBA prediction against the MLB bracket, under the MLB id.
  const wrong = PREDICTED_WNBA();
  wrong.league = 'MLB';
  wrong.champion = 'golden-state-valkyries';
  use({ 'postseasonBrackets/MLB_2026': MLB(), 'predictedBrackets/MLB_2026': wrong });
  await assert.rejects(() => getLeaguePageData('MLB'), /does not join the real bracket/);
});

test('PREDICTIONS READ: one league\'s prediction says nothing about another\'s', async () => {
  const { getLeaguePageData } = await load();
  use({ 'postseasonBrackets/WNBA_2026': WNBA(), 'predictedBrackets/MLB_2026': PREDICTED_MLB() });
  const page = await getLeaguePageData('WNBA');
  assert.equal(page.state === 'ok' && page.predictions, null);
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

// ---- The inbound modules: one build, under the link gate ----

test('INBOUND: while a series is being played, every readable bracket comes back built', async () => {
  const { buildPlayoffsInbound, readCurrentBrackets } = await load();
  use({ 'postseasonBrackets/MLB_2026': MLB(), 'postseasonBrackets/WNBA_2026': WNBA() });
  const leagues = await buildPlayoffsInbound(await readCurrentBrackets(), CAPTURED_AT);
  assert.deepEqual(leagues.map((l) => [l.league, l.href, l.view.phase.kind]), [['MLB', '/playoffs/mlb', 'active'], ['WNBA', '/playoffs/wnba', 'active']]);
  assert.equal(leagues[0].view.rounds.length, 4);
  assert.ok(leagues[0].view.homeGames.every((g) => g.park !== null));
});

test('INBOUND: inside the 14 days it is still built; after them it is empty', async () => {
  const { buildPlayoffsInbound, readCurrentBrackets } = await load();
  use({ 'postseasonBrackets/MLB_2026': FINISHED() });
  const brackets = await readCurrentBrackets();
  const inside = await buildPlayoffsInbound(brackets, new Date(ENDED + 14 * DAY));
  assert.deepEqual(inside.map((l) => [l.league, l.view.phase.kind]), [['MLB', 'concluded']]);
  assert.deepEqual(await buildPlayoffsInbound(brackets, new Date(ENDED + 14 * DAY + 1)), []);
  assert.deepEqual(await buildPlayoffsInbound([], CAPTURED_AT), []);
});

test('INBOUND: a bracket naming a club with no team record is left out, and the other still builds', async () => {
  const { buildPlayoffsInbound, readCurrentBrackets } = await load();
  use({ 'postseasonBrackets/MLB_2026': MLB(), 'postseasonBrackets/WNBA_2026': WNBA() });
  teams.drop.add('houston-astros');
  const leagues = await quiet(async () => buildPlayoffsInbound(await readCurrentBrackets(), CAPTURED_AT));
  assert.deepEqual(leagues.map((l) => l.league), ['WNBA']);
});

test('INBOUND: a failed read gives a page nothing to render, and does not throw into it', async () => {
  const { getPlayoffsInboundOrNone, getPlayoffsInbound } = await load();
  use({ 'postseasonBrackets/MLB_2026': new Error('UNAVAILABLE') });
  await assert.rejects(() => getPlayoffsInbound(), /UNAVAILABLE/);
  const out = await quiet(() => getPlayoffsInboundOrNone('/mlb/houston-astros'));
  assert.deepEqual(out, []);
  await assert.doesNotReject(() => quiet(() => getPlayoffsInboundOrNone('/')));
});

// THE INBOUND READ IS NOT CACHED. The pipeline revalidates a team page, a
// venue page and a league hub when a bracket changes; the re-render must see
// the new document, not one from a five-minute process cache. Two renders
// in a row, the document changed between them, no clock moved.
test('INBOUND, uncached: a page revalidated for a bracket change is built from the new document', async () => {
  const { getPlayoffsInbound, getPlayoffsInboundOrNone, isPlayoffsLinkActive } = await load();
  const before = MLB();
  const fake = use({ 'postseasonBrackets/MLB_2026': before });
  // The nav gate reads first, on every route, and fills its own cache. (Its
  // answer here depends on what an earlier test left in that cache, which is
  // the point of the cache; only its reads are asserted below.)
  await isPlayoffsLinkActive(CAPTURED_AT);
  const first = await getPlayoffsInbound();
  const wc1 = first[0].view.rounds[0].groups[0].series[0];
  assert.equal(wc1.scoreLine, null, 'no game has been played in the document as captured');
  const readsAfterFirst = fake.reads.length;

  // The document changes: game 1 of the first series goes final.
  const after = MLB();
  const series = (after.series as Record<string, unknown>[])[0];
  const games = series.games as Record<string, unknown>[];
  Object.assign(games[0], { status: 'final', homeScore: 4, awayScore: 1, winnerSide: 'higher' });
  Object.assign(series, { status: 'live', wins: { higher: 1, lower: 0 } });
  fake.docs['postseasonBrackets/MLB_2026'] = after;

  const second = await getPlayoffsInboundOrNone('/mlb/houston-astros');
  const wc1After = second[0].view.rounds[0].groups[0].series[0];
  assert.equal(wc1After.scoreLine, 'HOU leads 1-0', 'the second render sees the change at once');
  assert.ok(fake.reads.length > readsAfterFirst, 'the second render read the document again');
  // And the nav gate still answers from its cache: it read nothing more.
  const readsBeforeGate = fake.reads.length;
  await isPlayoffsLinkActive(CAPTURED_AT);
  assert.equal(fake.reads.length, readsBeforeGate, 'the gate is the one reader that keeps the cache');
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
