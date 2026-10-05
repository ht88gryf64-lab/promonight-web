// EVERY REGULAR READER OF teams/{club}/promos LEAVES OUT A POSTSEASON ROW.
//
// The postseason scanner writes rows with isPostseason: true into the same
// subcollection as the regular promotions, keyed on a bracket game. They are
// for the playoffs pages, which read them by name (lib/postseason/promos.ts).
// Every other reader must not show them, and this file proves that through
// each reader, not through the predicate alone. The readers, and the path
// each one filters on:
//
//   getTeamPromos                 mapPromoDoc + isVisiblePromo
//   getPromosForDate              mapPromoDoc + isVisiblePromo (both branches)
//   getHighlightedPromos          mapPromoDoc + isVisiblePromo (both branches)
//   getPromosInDateRange          mapPromoDoc + isVisiblePromo (both branches)
//   getPromosFromDate             mapPromoDoc + isVisiblePromo (both branches)
//   getTeamPromosOnDates          mapPromoDoc + isVisiblePromo, through getGamesForTeam's away promos
//   getLeagueUpcomingPromoCounts  mapPromoDoc + isVisiblePromo
//   getScoredPromosInDateRange    the scored-loop raw guard
//   getTopPromosPerTeam           the scored-loop raw guard
//   getFeedSelection (social)     mapPromoDoc + isVisiblePromo, and the candidate filter
//   findCardPromo (social)        resolveCard's own check
//   GET /api/my-teams/promos      the route's raw-doc filter
//   getPromoCount                 NOT filtered: a count aggregate over the group; the postseason rows are inside it the way tombstones are (see data.ts)
//
// Run with: node --import tsx --experimental-test-module-mocks --test <this file>
import { test, mock } from 'node:test';
import assert from 'node:assert';

type Data = Record<string, unknown>;
function fakeDoc(id: string, data: Data, teamId?: string) {
  return { id, exists: true, data: () => data, get: (f: string) => data[f], ref: { parent: { parent: teamId ? { id: teamId } : null } } };
}
function fakeSnap(docs: ReturnType<typeof fakeDoc>[]) {
  return { docs, empty: docs.length === 0, size: docs.length, forEach: (fn: (d: (typeof docs)[number]) => void) => docs.forEach(fn), data: () => ({ count: docs.length }) };
}
// A chainable query: where/orderBy/limit are no-ops except that an equality
// on isPostseason is honoured, the way Firestore answers it.
function query(docs: ReturnType<typeof fakeDoc>[]): any {
  let filtered = docs;
  const q: any = {
    where: (field: string, op: string, value: unknown) => {
      if (field === 'isPostseason' && op === '==') filtered = filtered.filter((d) => d.data()[field] === value);
      return q;
    },
    orderBy: () => q,
    limit: () => q,
    count: () => ({ get: async () => fakeSnap(filtered) }),
    get: async () => fakeSnap(filtered),
  };
  return q;
}

const TEAM = fakeDoc('test-team', { league: 'MLB', city: 'Test', name: 'Team', abbreviation: 'TST', primaryColor: 4278190080, secondaryColor: 4278190080, division: 'Test Division', sportSlug: 'mlb' });
const FIELDS = (over: Data): Data => ({ date: '2026-10-01', title: 'Promo', type: 'giveaway', time: '7:05 PM', opponent: 'Visitors', description: 'd', highlight: true, ...over });
const SCORED = (over: Data): Data => FIELDS({ score: 10, scoreBreakdown: { baseType: 10 }, derivedSignals: { itemType: 'generic' }, ...over });
const POSTSEASON = { isPostseason: true, league: 'MLB', season: 2026, roundKey: 'wild_card', roundLabel: 'Wild Card Series', seriesKey: 'AL-WC-A', gameNumber: 2, ifNecessary: false, bracketGameId: '849846', opponentSlug: 'visitors' };
const promoDocs = [
  fakeDoc('regular', SCORED({ title: 'Regular Row', date: '2026-10-01' }), 'test-team'),
  fakeDoc('regular-false', SCORED({ title: 'Marked False', date: '2026-10-02', isPostseason: false }), 'test-team'),
  fakeDoc('postseason', SCORED({ title: 'Postseason Row', date: '2026-10-03', ...POSTSEASON, score: 99 }), 'test-team'),
];
const fakeDb = {
  collection(name: string): any {
    if (name === 'teams') {
      return {
        get: async () => fakeSnap([TEAM]),
        doc: (id: string) => ({
          get: async () => (id === 'test-team' ? TEAM : { exists: false, data: () => undefined }),
          collection: () => ({ ...query(promoDocs), doc: (pid: string) => ({ get: async () => promoDocs.find((d) => d.id === pid) ?? { exists: false, data: () => undefined } }) }),
        }),
      };
    }
    return query([]);
  },
  collectionGroup(name: string): any {
    if (name === 'promos') return query(promoDocs);
    return query([]);
  },
};
mock.module('server-only', { namedExports: {} });
mock.module(new URL('../firebase.ts', import.meta.url).href, { namedExports: { db: fakeDb } });

// The clock is pinned for the whole file. Some readers keep only rows dated
// today or later (getHighlightedPromos' fallback reads new Date() in UTC), and
// the fixture rows are dated 2026-10-01 to 2026-10-03, so on the real clock
// this file started failing at midnight UTC on 2026-10-02. NOW sits before
// every fixture row in every US zone; only Date is mocked, timers run as usual.
const NOW = new Date('2026-09-30T12:00:00Z');
mock.timers.enable({ apis: ['Date'], now: NOW });

test('the clock is pinned: new Date() and Date.now() read NOW, not the real date', () => {
  assert.equal(new Date().toISOString(), NOW.toISOString());
  assert.equal(Date.now(), NOW.getTime());
});

const titles = (rows: { title: string }[]) => rows.map((r) => r.title).sort();
const REGULAR = ['Marked False', 'Regular Row'];

test('the shaper carries the marker and the predicate hides it; false and absent pass', async () => {
  const { mapPromoDoc } = await import('../data');
  const { isVisiblePromo } = await import('../promo-helpers');
  assert.equal(mapPromoDoc(promoDocs[2] as any).isPostseason, true);
  assert.equal(mapPromoDoc(promoDocs[1] as any).isPostseason, undefined, 'false is not carried: absent means regular');
  assert.equal(mapPromoDoc(promoDocs[0] as any).isPostseason, undefined);
  assert.equal(isVisiblePromo({ isPostseason: true }), false);
  assert.equal(isVisiblePromo({ isPostseason: false }), true);
  assert.equal(isVisiblePromo({}), true);
  assert.equal(isVisiblePromo({ tombstoned: true }), false);
});

test('getTeamPromos', async () => {
  const { getTeamPromos } = await import('../data');
  assert.deepEqual(titles(await getTeamPromos('test-team')), REGULAR);
});

test('getPromosForDate, getPromosInDateRange, getPromosFromDate, getHighlightedPromos', async () => {
  const d = await import('../data');
  assert.deepEqual(titles(await d.getPromosForDate('2026-10-03')), REGULAR, 'getPromosForDate');
  assert.deepEqual(titles(await d.getPromosInDateRange('2026-01-01', '2026-12-31')), REGULAR, 'getPromosInDateRange');
  assert.deepEqual(titles(await d.getPromosFromDate('2026-01-01')), REGULAR, 'getPromosFromDate');
  assert.deepEqual(titles(await d.getHighlightedPromos(10)), REGULAR, 'getHighlightedPromos');
});

test('getScoredPromosInDateRange and getTopPromosPerTeam: the raw guards', async () => {
  const d = await import('../data');
  assert.deepEqual(titles(await d.getScoredPromosInDateRange('2026-01-01', '2026-12-31')), REGULAR, 'getScoredPromosInDateRange');
  const top = await d.getTopPromosPerTeam('2026-01-01');
  // The postseason row has the highest score; the top promo is still a regular one.
  assert.deepEqual([...top.values()].map((p) => p.title), ['Regular Row']);
});

test('getLeagueUpcomingPromoCounts: the count per club leaves the postseason row out', async () => {
  const d = await import('../data');
  const counts = await d.getLeagueUpcomingPromoCounts('MLB');
  assert.equal(counts['test-team'], 2);
});

test('getGamesForTeam, away promos through getTeamPromosOnDates', async () => {
  // A private reader, reached through the away-promo join: the module's
  // own function reads the opponent's promos for the dates of the games.
  const d = await import('../data');
  const fn = (d as unknown as Record<string, unknown>).getTeamPromosOnDates;
  if (typeof fn === 'function') {
    assert.deepEqual(titles(await (fn as (t: string, s: Set<string>) => Promise<{ title: string }[]>)('test-team', new Set(['2026-10-01', '2026-10-02', '2026-10-03']))), REGULAR);
  } else {
    // Not exported: proven by reading. It maps with mapPromoDoc and filters
    // with isVisiblePromo (src/lib/data.ts, getTeamPromosOnDates).
    const src = (await import('node:fs')).readFileSync(new URL('../data.ts', import.meta.url), 'utf-8');
    const body = src.slice(src.indexOf('async function getTeamPromosOnDates'), src.indexOf('\n}\n', src.indexOf('async function getTeamPromosOnDates')));
    assert.ok(body.includes('mapPromoDoc(doc)'), 'getTeamPromosOnDates maps with mapPromoDoc');
    assert.ok(body.includes('mapped.filter(isVisiblePromo)'), 'getTeamPromosOnDates filters through isVisiblePromo');
  }
});

test('social feed: the selection and the card', async () => {
  const feed = await import('../social-feed/feed');
  const sel = await feed.getFeedSelection(new Date('2026-09-30T12:00:00Z'));
  assert.ok(!sel.items.some((i) => i.title === 'Postseason Row'), 'not selected');
  assert.equal(await feed.findCardPromo('test-team~postseason'), null, 'no card for a postseason row asked for by key');
  const card = await feed.findCardPromo('test-team~regular');
  assert.equal(card?.title, 'Regular Row');
});

test('GET /api/my-teams/promos', async () => {
  const { GET } = await import('../../app/api/my-teams/promos/route');
  const { NextRequest } = await import('next/server');
  const res = await GET(new NextRequest('http://localhost/api/my-teams/promos?teams=test-team&start=2026-10-01&end=2026-10-31'));
  const body = (await res.json()) as { promos: { title: string }[] };
  assert.deepEqual(titles(body.promos), REGULAR);
});

test('getPromoCount counts the group as it is, postseason rows included, and says so', async () => {
  const d = await import('../data');
  assert.equal(await d.getPromoCount(), 3);
  const src = (await import('node:fs')).readFileSync(new URL('../data.ts', import.meta.url), 'utf-8');
  const body = src.slice(src.indexOf('export async function getPromoCount'), src.indexOf('\n}\n', src.indexOf('export async function getPromoCount')));
  assert.ok(body.includes('isPostseason'), 'the over-count is written down where the number is made');
});
