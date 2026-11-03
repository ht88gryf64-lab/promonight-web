// The MLS reads through the data module, against a fake Firestore that
// serves the fixtures: no predictions read and no promotions read for MLS,
// nothing logged for their absence, and the inbound modules gated per league.
import { test, mock } from 'node:test';
import assert from 'node:assert/strict';
import { FIXTURE, MLS_AT, MLS_FIXTURE, capturedTeams, fakeFirestore, loadDoc, mlsTeams, parkNames, venuePages, PREDICTED } from './helpers';
import { readFileSync } from 'node:fs';

type Fake = ReturnType<typeof fakeFirestore>;
const current: { db: Fake } = { db: fakeFirestore({}) };
const db = {
  collection: (name: string) => current.db.collection(name),
  getAll: (...args: unknown[]) => current.db.getAll(...args),
};
const mlsParks = (JSON.parse(readFileSync(new URL('../__fixtures__/clubs.mls.captured-20261103.json', import.meta.url), 'utf-8')) as { parks: Record<string, string> }).parks;

mock.module('server-only', { namedExports: {} });
mock.module(new URL('../../firebase.ts', import.meta.url).href, { namedExports: { db } });
mock.module(new URL('../../data.ts', import.meta.url).href, {
  namedExports: {
    getAllTeams: async () => [...capturedTeams(), ...mlsTeams()],
    getVenueForTeam: async (id: string) => {
      const name = parkNames().get(id) ?? mlsParks[id];
      return name ? { name } : null;
    },
  },
});
mock.module(new URL('../../venue-hub.ts', import.meta.url).href, { namedExports: { getTeamVenueHubMap: async () => venuePages() } });
mock.timers.enable({ apis: ['Date'], now: MLS_AT.roundOne });

const load = () => import('../data');
const use = (docs: Parameters<typeof fakeFirestore>[0]) => (current.db = fakeFirestore(docs));

async function logged<T>(fn: () => Promise<T>): Promise<{ value: T; lines: string[] }> {
  const original = console.error;
  const lines: string[] = [];
  console.error = (...a: unknown[]) => void lines.push(a.map(String).join(' '));
  try {
    return { value: await fn(), lines };
  } finally {
    console.error = original;
  }
}

// MLB and WNBA finished in 2025 shape, restamped 2026: both champion windows
// closed by 2026-11-02. MLS in Round One.
const docs = () => ({
  'postseasonBrackets/MLB_2026': { ...loadDoc(FIXTURE.mlbFinal), season: 2026 },
  'postseasonBrackets/WNBA_2026': { ...loadDoc(FIXTURE.wnbaFinal), season: 2026 },
  'postseasonBrackets/MLS_2026': loadDoc(MLS_FIXTURE.roundOne),
  'predictedBrackets/MLB_2026': loadDoc(PREDICTED.mlb),
  'predictedBrackets/WNBA_2026': loadDoc(PREDICTED.wnba),
  // A promotion row on an MLS host, flagged as the scanner would flag one:
  // the MLS page must not ask for it.
  'teams/seattle-sounders/promos/x1': { isPostseason: true, league: 'MLS', season: 2026, seriesKey: 'W-R1-4', gameNumber: 2, date: '2026-11-02', title: 'Scarf', type: 'giveaway' },
});

test('LEAGUE PAGE: /playoffs/mls reads its bracket and nothing else of the postseason, and logs nothing', async () => {
  const { getLeaguePageData } = await load();
  const fake = use(docs());
  const { value, lines } = await logged(() => getLeaguePageData('MLS'));
  assert.equal(value.state, 'ok');
  if (value.state !== 'ok') return;
  assert.equal(value.predictions, null);
  assert.ok(value.standing && value.standing.startsWith('Round One: '));
  assert.deepEqual(fake.reads.map((r) => r.path).filter((p) => p.startsWith('predictedBrackets/')), [], 'no predictions read');
  assert.deepEqual(fake.reads.map((r) => r.path).filter((p) => p.startsWith('teams/')), [], 'no promotions read');
  assert.deepEqual(lines.filter((l) => l.includes('[predictions-unavailable]')), []);
  assert.ok(!JSON.stringify(value.view).includes('Scarf'));
});

test('TEAM PAGE: an MLS club gets its module and no pick line, with no predictions read', async () => {
  const { getTeamPostseason } = await load();
  const fake = use(docs());
  const { value, lines } = await logged(() => getTeamPostseason('mls', 'minnesota-united'));
  assert.ok(value);
  assert.equal(value.club.state, 'alive');
  assert.equal(value.pick, null);
  assert.deepEqual(fake.reads.filter((r) => r.path.startsWith('predictedBrackets/')), []);
  assert.deepEqual(lines.filter((l) => l.includes('[predictions-unavailable]')), []);
});

test('PER-LEAGUE GATE: with MLB and WNBA past their windows, their clubs get no module while MLS clubs do', async () => {
  const { getTeamPostseason, getPlayoffsInbound, isPlayoffsLinkActive } = await load();
  use(docs());
  assert.deepEqual((await getPlayoffsInbound()).map((l) => l.league), ['MLS']);
  assert.equal(await getTeamPostseason('mlb', 'los-angeles-dodgers'), null);
  assert.equal(await getTeamPostseason('wnba', 'las-vegas-aces'), null);
  assert.ok(await getTeamPostseason('mls', 'seattle-sounders'));
  assert.equal(await isPlayoffsLinkActive(), true, 'the nav link stays while MLS is being played');
});

test('HUB: the three leagues are read; MLB and WNBA keep their predictions read; MLS does not', async () => {
  const { getLeaguePageData, POSTSEASON_LEAGUES } = await load();
  const fake = use(docs());
  await Promise.all(POSTSEASON_LEAGUES.map((l) => getLeaguePageData(l)));
  const predicted = fake.reads.map((r) => r.path).filter((p) => p.startsWith('predictedBrackets/')).sort();
  assert.deepEqual(predicted, ['predictedBrackets/MLB_2026', 'predictedBrackets/WNBA_2026']);
});

test('SITEMAP: /playoffs/mls is listed once its document exists, and not before', async () => {
  const { getPlayoffsSitemapEntries } = await load();
  use(docs());
  assert.deepEqual((await getPlayoffsSitemapEntries()).map((e) => e.path), ['/playoffs', '/playoffs/mlb', '/playoffs/wnba', '/playoffs/mls']);
  const without = docs() as Record<string, unknown>;
  delete without['postseasonBrackets/MLS_2026'];
  use(without as Parameters<typeof fakeFirestore>[0]);
  assert.deepEqual((await getPlayoffsSitemapEntries()).map((e) => e.path), ['/playoffs', '/playoffs/mlb', '/playoffs/wnba']);
});
