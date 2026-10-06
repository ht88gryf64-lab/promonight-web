// Ticket packages in the data layer (WEB6 addendum, 2026-10-05).
//
//  1. getTeamPromos notes which rows' docs carry ticketPackageRequired === true
//     (isTicketPackagePromo), and partitionTicketPackages, as the route calls
//     it, splits on that for NHL and NBA only; every other league gets the
//     array getTeamPromos returned, itself, with no package group.
//  2. The flag never rides on a Promo: no partitioned row gains a key.
//  3. An opponent's packages stay off this team's away-game rows on NHL and
//     NBA (getTeamPromosOnDates, through enrichGamesForTeam), and stay on for
//     MLB, where the field is the extractor's raw guess.
//  4. Round 1: mapGameDoc reads neutralSite on NHL and NBA only.
//
// Run with: node --import tsx --experimental-test-module-mocks --test <this file>
import { test, mock } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

type Data = Record<string, unknown>;
function fakeDoc(id: string, data: Data, teamId?: string) {
  return { id, exists: true, data: () => data, get: (f: string) => data[f], ref: { parent: { parent: teamId ? { id: teamId } : null } } };
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

// The league hub card count (getLeagueUpcomingPromoCounts) reads the promos
// collection group. Far-future dates so the real-clock "today" never passes them.
const TEAM_DOCS = [
  fakeDoc('detroit-red-wings', { league: 'NHL', city: 'Detroit', name: 'Red Wings', abbreviation: 'DET', primaryColor: 0, secondaryColor: 0, division: 'Atlantic', sportSlug: 'nhl' }),
  fakeDoc('minnesota-twins', { league: 'MLB', city: 'Minnesota', name: 'Twins', abbreviation: 'MIN', primaryColor: 0, secondaryColor: 0, division: 'Central', sportSlug: 'mlb' }),
];
const GROUP = [
  fakeDoc('h1', { date: '2099-01-01', title: 'Free Night', type: 'theme' }, 'detroit-red-wings'),
  fakeDoc('h2', { date: '2099-01-02', title: 'Hoodie Pack', type: 'theme', ticketPackageRequired: true }, 'detroit-red-wings'),
  fakeDoc('h3', { date: '2099-01-03', title: 'Lunch Box', type: 'food', ticketPackageRequired: true }, 'detroit-red-wings'),
  fakeDoc('h4', { date: '2099-01-01', title: 'Bobblehead', type: 'giveaway', ticketPackageRequired: true }, 'minnesota-twins'),
  fakeDoc('h5', { date: '2099-01-02', title: 'Fireworks', type: 'theme' }, 'minnesota-twins'),
  // An MLB same-date, same-title pair: the MLB hub count is every visible doc,
  // as before WEB6, with no dedupe (only NHL/NBA go through the team-page path).
  fakeDoc('h6', { date: '2099-01-03', title: 'Dup Night', type: 'theme' }, 'minnesota-twins'),
  fakeDoc('h7', { date: '2099-01-03', title: 'Dup Night', type: 'theme' }, 'minnesota-twins'),
];
const fakeDb = {
  collection(name: string): any {
    if (name === 'games') return query(GAMES);
    if (name === 'teams') {
      return {
        ...query(TEAM_DOCS),
        doc: (teamId: string) => ({
          get: async () => ({ exists: false, data: () => undefined }),
          collection: () => query(promosByTeam[teamId] ?? []),
        }),
      };
    }
    return query([]);
  },
  collectionGroup(name: string): any {
    return query(name === 'promos' ? GROUP : []);
  },
};
mock.module('server-only', { namedExports: {} });
mock.module(new URL('../firebase.ts', import.meta.url).href, { namedExports: { db: fakeDb } });

const titles = (rows: { title: string }[]) => rows.map((r) => r.title);

/** The route's two lines: read, then split. */
async function routeSplit(teamId: string, league: string) {
  const { getTeamPromos, isTicketPackagePromo } = await import('../data');
  const { partitionTicketPackages } = await import('../ticket-packages');
  const all = await getTeamPromos(teamId);
  return { all, ...partitionTicketPackages(all, isTicketPackagePromo, league) };
}

test('NBA: special-ticket rows leave the counted array and form their own group', async () => {
  const { promos, ticketPackages } = await routeSplit('golden-state-warriors', 'NBA');
  assert.deepEqual(titles(promos), ['Educators Night', "Women's Empowerment Month", 'Sustainability Night']);
  assert.deepEqual(titles(ticketPackages), ['Healthcare Heroes Night', 'Lunch Box Night', 'Hat Night Package', 'Asian Heritage Night']);
  // Every type leaves the counts, not only theme nights.
  assert.deepEqual(ticketPackages.map((p) => p.type), ['theme', 'food', 'giveaway', 'theme']);
});

test('the field never rides on a Promo: no row in either array carries it', async () => {
  const { all, promos, ticketPackages } = await routeSplit('golden-state-warriors', 'NHL');
  for (const p of [...promos, ...ticketPackages, ...all]) {
    assert.equal('ticketPackageRequired' in p, false, p.title);
  }
});

test('MLB: the raw flag is ignored, and the counted array IS what getTeamPromos returned', async () => {
  for (const league of ['MLB', 'NFL', 'MLS', 'WNBA']) {
    const { all, promos, ticketPackages } = await routeSplit('minnesota-twins', league);
    assert.equal(promos, all, `${league}: the same array`);
    assert.equal(ticketPackages.length, 0, league);
    assert.equal(all.length, 7, 'every visible row, flagged or not');
  }
});

test('NBA with nothing flagged: the counted array IS what getTeamPromos returned', async () => {
  const { all, promos, ticketPackages } = await routeSplit('nobody', 'NBA');
  assert.equal(promos, all);
  assert.equal(ticketPackages.length, 0);
});

test("getTeamPromos keeps main's shape: one awaited read, no wrapper", () => {
  // A page without packages goes through the very code path it went through
  // on main: the route reads, then splits synchronously. Pin the body.
  const src = readFileSync(new URL('../data.ts', import.meta.url), 'utf-8');
  const body = src.slice(src.indexOf('export const getTeamPromos = cache('), src.indexOf('\n});\n', src.indexOf('export const getTeamPromos = cache(')));
  assert.equal(body.match(/await/g)?.length, 1);
  assert.match(body, /return dedupePromos\(snapshot\.docs\.map\(mapPromoDocNotingPackage\)\.filter\(isVisiblePromo\)\);/);
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

test('round 5: the league hub card counts what the team page counts (NHL drops packages, MLB keeps its raw flags)', async () => {
  const { getLeagueUpcomingPromoCounts } = await import('../data');
  const nhl = await getLeagueUpcomingPromoCounts('NHL');
  assert.equal(nhl['detroit-red-wings'], 1, 'the two special-ticket rows are not promotions on the team page');
  const mlb = await getLeagueUpcomingPromoCounts('MLB');
  assert.equal(mlb['minnesota-twins'], 4, 'MLB unchanged: its raw flag ignored, its duplicate pair both counted, as before');
});
