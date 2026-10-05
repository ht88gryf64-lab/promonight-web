// Ticket packages in the data layer (WEB6 addendum, 2026-10-05).
//
//  1. getTeamPromoPartition splits an NHL or NBA team's rows on the stored
//     ticketPackageRequired === true, and on every other league returns what
//     getTeamPromos returns, with no package group. (Inside a request React's
//     cache() makes it the same array; outside one, as here, each call reads
//     again, so these tests compare rows. partitionTicketPackages' identity
//     return is pinned in the render test.)
//  2. The flag never rides on a Promo: no partitioned row gains a key.
//  3. An opponent's packages stay off this team's away-game rows on NHL and
//     NBA (getTeamPromosOnDates, through enrichGamesForTeam), and stay on for
//     MLB, where the field is the extractor's raw guess.
//  4. Round 1: mapGameDoc reads neutralSite on NHL and NBA only.
//
// Run with: node --import tsx --experimental-test-module-mocks --test <this file>
import { test, mock } from 'node:test';
import assert from 'node:assert/strict';

type Data = Record<string, unknown>;
function fakeDoc(id: string, data: Data) {
  return { id, exists: true, data: () => data, get: (f: string) => data[f] };
}
type Doc = ReturnType<typeof fakeDoc>;
function query(docs: Doc[]): any {
  let rows = docs;
  const q: any = {
    where: (field: string, op: string, value: any) => {
      const v = (d: Doc) => d.data()[field] as any;
      if (op === '==') rows = rows.filter((d) => v(d) === value);
      if (op === '>=') rows = rows.filter((d) => v(d) >= value);
      if (op === '<=') rows = rows.filter((d) => v(d) <= value);
      return q;
    },
    orderBy: (field: string) => {
      rows = [...rows].sort((a, b) => String(a.data()[field]).localeCompare(String(b.data()[field])));
      return q;
    },
    limit: () => q,
    get: async () => ({ docs: rows, empty: rows.length === 0, size: rows.length, forEach: (fn: (d: Doc) => void) => rows.forEach(fn) }),
  };
  return q;
}

const row = (id: string, date: string, title: string, type: string, gated?: boolean) =>
  fakeDoc(id, { date, title, type, description: `${title} description`, opponent: 'Visitors', ...(gated === undefined ? {} : { ticketPackageRequired: gated }) });

// Warriors shape: 3 plain theme nights, 4 special-ticket rows across types, one
// explicit false, and one tombstoned package (hidden as any row is).
const WARRIORS = [
  row('w1', '2026-11-01', 'Healthcare Heroes Night', 'theme', true),
  row('w2', '2026-11-10', 'Educators Night', 'theme'),
  row('w3', '2026-12-01', 'Lunch Box Night', 'food', true),
  row('w4', '2026-12-05', 'Hat Night Package', 'giveaway', true),
  row('w5', '2027-03-05', "Women's Empowerment Month", 'theme', false),
  row('w6', '2027-03-09', 'Asian Heritage Night', 'theme', true),
  row('w7', '2027-04-01', 'Sustainability Night', 'theme'),
  fakeDoc('w8', { date: '2027-04-02', title: 'Gone Package', type: 'theme', ticketPackageRequired: true, tombstoned: true }),
];
// The same shape on an MLB club: the flag there is the raw extractor guess.
const TWINS = WARRIORS.map((d) => fakeDoc(`t-${d.id}`, { ...d.data() }));
// An away game for the Knicks at the Warriors on a package date.
const GAMES = [
  fakeDoc('nba-2026-11-01-knicks-at-warriors', { league: 'nba', season: 2026, seasonType: 'regular', date: '2026-11-01', homeTeamSlug: 'golden-state-warriors', awayTeamSlug: 'new-york-knicks', status: 'scheduled' }),
  fakeDoc('nba-2026-11-10-knicks-at-warriors', { league: 'nba', season: 2026, seasonType: 'regular', date: '2026-11-10', homeTeamSlug: 'golden-state-warriors', awayTeamSlug: 'new-york-knicks', status: 'scheduled' }),
  fakeDoc('mlb-2026-11-01-yankees-at-twins', { league: 'mlb', date: '2026-11-01', homeTeamSlug: 'minnesota-twins', awayTeamSlug: 'new-york-yankees', status: 'scheduled' }),
  // Neutral sites: read on NHL and NBA, never on another league.
  fakeDoc('nba-2027-01-14-pelicans-at-spurs', { league: 'nba', season: 2026, seasonType: 'regular', date: '2027-01-14', homeTeamSlug: 'san-antonio-spurs', awayTeamSlug: 'new-orleans-pelicans', venueName: 'Accor Arena', neutralSite: true, status: 'scheduled' }),
  fakeDoc('mlb-neutral', { league: 'mlb', date: '2026-06-14', homeTeamSlug: 'san-antonio-spurs', awayTeamSlug: 'x', venueName: 'Somewhere', neutralSite: true, status: 'scheduled' }),
];

const promosByTeam: Record<string, Doc[]> = { 'golden-state-warriors': WARRIORS, 'minnesota-twins': TWINS };
const fakeDb = {
  collection(name: string): any {
    if (name === 'games') return query(GAMES);
    if (name === 'teams') {
      return {
        ...query([]),
        doc: (teamId: string) => ({
          get: async () => ({ exists: false, data: () => undefined }),
          collection: () => query(promosByTeam[teamId] ?? []),
        }),
      };
    }
    return query([]);
  },
  collectionGroup(): any {
    return query([]);
  },
};
mock.module('server-only', { namedExports: {} });
mock.module(new URL('../firebase.ts', import.meta.url).href, { namedExports: { db: fakeDb } });

const titles = (rows: { title: string }[]) => rows.map((r) => r.title);

test('NBA: special-ticket rows leave the counted array and form their own group', async () => {
  const { getTeamPromoPartition } = await import('../data');
  const { promos, ticketPackages } = await getTeamPromoPartition('golden-state-warriors', 'NBA');
  assert.deepEqual(titles(promos), ['Educators Night', "Women's Empowerment Month", 'Sustainability Night']);
  assert.deepEqual(titles(ticketPackages), ['Healthcare Heroes Night', 'Lunch Box Night', 'Hat Night Package', 'Asian Heritage Night']);
  // Every type leaves the counts, not only theme nights.
  assert.deepEqual(ticketPackages.map((p) => p.type), ['theme', 'food', 'giveaway', 'theme']);
});

test('the field never rides on a Promo: no row in either array carries it', async () => {
  const { getTeamPromoPartition, getTeamPromos } = await import('../data');
  const { promos, ticketPackages } = await getTeamPromoPartition('golden-state-warriors', 'NHL');
  for (const p of [...promos, ...ticketPackages, ...(await getTeamPromos('golden-state-warriors'))]) {
    assert.equal('ticketPackageRequired' in p, false, p.title);
  }
});

test('MLB: the raw flag is ignored, and the counted array is getTeamPromos, row for row', async () => {
  const { getTeamPromoPartition, getTeamPromos } = await import('../data');
  const all = await getTeamPromos('minnesota-twins');
  for (const league of ['MLB', 'NFL', 'MLS', 'WNBA']) {
    const { promos, ticketPackages } = await getTeamPromoPartition('minnesota-twins', league);
    assert.deepEqual(promos, all, `${league}: every row, in order`);
    assert.equal(ticketPackages.length, 0, league);
  }
  assert.equal(all.length, 7, 'every visible row, flagged or not');
});

test('NBA with nothing flagged: the counted array is getTeamPromos', async () => {
  const { getTeamPromoPartition, getTeamPromos } = await import('../data');
  const { promos, ticketPackages } = await getTeamPromoPartition('nobody', 'NBA');
  assert.deepEqual(promos, await getTeamPromos('nobody'));
  assert.equal(ticketPackages.length, 0);
});

test("away games: the opponent's packages stay off the row on NBA, stay on for MLB", async () => {
  const { getGamesForTeam, enrichGamesForTeam } = await import('../data');
  const knicks = await enrichGamesForTeam('new-york-knicks', await getGamesForTeam('new-york-knicks', 'nba'), []);
  const byDate = Object.fromEntries(knicks.map((c) => [c.game.date, titles(c.promos)]));
  assert.deepEqual(byDate['2026-11-01'], [], 'Healthcare Heroes Night is a package: not on the Knicks row');
  assert.deepEqual(byDate['2026-11-10'], ['Educators Night']);
  const yankees = await enrichGamesForTeam('new-york-yankees', await getGamesForTeam('new-york-yankees', 'mlb'), []);
  assert.deepEqual(titles(yankees[0].promos), ['Healthcare Heroes Night'], 'MLB unchanged');
});

test('round 1: neutralSite is read on NHL and NBA only, and only when true', async () => {
  const { getGamesForTeam } = await import('../data');
  const spurs = await getGamesForTeam('san-antonio-spurs', 'nba');
  assert.equal(spurs.find((g) => g.id === 'nba-2027-01-14-pelicans-at-spurs')?.neutralSite, true);
  const mlb = await getGamesForTeam('san-antonio-spurs', 'mlb');
  assert.equal('neutralSite' in mlb[0], false, 'no key on another league');
  const warriors = await getGamesForTeam('golden-state-warriors', 'nba');
  for (const g of warriors) assert.equal('neutralSite' in g, false, `${g.id}: no key when false`);
});
