// Special-ticket rows across the site (WEB6 G2, 2026-10-05).
//
// An NHL or NBA row with ticketPackageRequired === true is not a promotion
// anywhere the site lists or counts promotions. Every cross-team reader leaves
// it out, executed here against a fake Firestore holding an NHL club and an MLB
// club, each with a flagged and an unflagged row on the same dates:
//   getPromosForDate (/promos/today, hub today modules), getPromosInDateRange
//   (/promos/this-week, the homepage tonight window, hub slates, the digest),
//   getPromosFromDate (/promos/theme-nights, food-deals, bobbleheads, the
//   homepage), getHighlightedPromos, the venue-hub week scroller, the social
//   feed and its image cards, and My Teams.
// The MLB flag is the extractor's raw guess and is ignored everywhere.
//
// Run with: node --import tsx --experimental-test-module-mocks --test <this file>
import { test, mock } from 'node:test';
import assert from 'node:assert/strict';

type Data = Record<string, unknown>;
type Doc = ReturnType<typeof fakeDoc>;
function fakeDoc(id: string, data: Data, teamId?: string) {
  const ref: any = { parent: { parent: teamId ? { id: teamId, get: async () => TEAMS.find((t) => t.id === teamId) } : null } };
  return { id, exists: true, data: () => data, get: (f: string) => data[f], ref };
}
function snap(docs: Doc[]) {
  return { docs, empty: docs.length === 0, size: docs.length, forEach: (fn: (d: Doc) => void) => docs.forEach(fn), data: () => ({ count: docs.length }) };
}
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
    orderBy: (f: string) => {
      rows = [...rows].sort((a, b) => String(a.data()[f]).localeCompare(String(b.data()[f])));
      return q;
    },
    limit: () => q,
    count: () => ({ get: async () => snap(rows) }),
    get: async () => snap(rows),
  };
  return q;
}

// Dates relative to the real clock, so the Chicago-anchored windows (venue hub,
// highlighted) always contain them.
const ymd = (offset: number) => {
  const d = new Date(Date.now() + offset * 86_400_000);
  return d.toISOString().slice(0, 10);
};
const D1 = ymd(2);
const D2 = ymd(3);

const TEAMS = [
  fakeDoc('detroit-red-wings', { league: 'NHL', city: 'Detroit', name: 'Red Wings', abbreviation: 'DET', primaryColor: 0, secondaryColor: 0, division: 'Atlantic', sportSlug: 'nhl' }),
  fakeDoc('minnesota-twins', { league: 'MLB', city: 'Minnesota', name: 'Twins', abbreviation: 'MIN', primaryColor: 0, secondaryColor: 0, division: 'Central', sportSlug: 'mlb' }),
];
const row = (id: string, team: string, date: string, title: string, type: string, flagged: boolean) =>
  fakeDoc(id, { date, title, type, description: `${title}.`, opponent: 'Visitors', highlight: true, ...(flagged ? { ticketPackageRequired: true } : {}) }, team);
const PROMOS = [
  row('d1', 'detroit-red-wings', D1, 'Free Night', 'theme', false),
  row('d2', 'detroit-red-wings', D1, 'Hoodie Pack', 'theme', true),
  row('d3', 'detroit-red-wings', D2, 'Lunch Box', 'food', true),
  row('t1', 'minnesota-twins', D1, 'Fireworks', 'theme', false),
  row('t2', 'minnesota-twins', D2, 'Bobblehead', 'giveaway', true),
];
const byTeam = (id: string) => PROMOS.filter((d) => d.ref.parent.parent?.id === id);

const fakeDb = {
  collection(name: string): any {
    if (name === 'teams') {
      return {
        ...query(TEAMS),
        doc: (id: string) => ({
          get: async () => TEAMS.find((t) => t.id === id) ?? { exists: false, data: () => undefined },
          collection: () => ({
            ...query(byTeam(id)),
            doc: (pid: string) => ({ get: async () => byTeam(id).find((d) => d.id === pid) ?? { exists: false, data: () => undefined } }),
          }),
        }),
      };
    }
    return query([]);
  },
  collectionGroup(name: string): any {
    return query(name === 'promos' ? PROMOS : []);
  },
};
mock.module('server-only', { namedExports: {} });
mock.module(new URL('../firebase.ts', import.meta.url).href, { namedExports: { db: fakeDb } });

const titles = (rows: { title: string }[]) => rows.map((r) => r.title).sort();
const COUNTED = ['Bobblehead', 'Fireworks', 'Free Night'];

test('getPromosForDate: the NHL package is not on the daily board', async () => {
  const { getPromosForDate } = await import('../data');
  assert.deepEqual(titles(await getPromosForDate(D1)), ['Fireworks', 'Free Night']);
  assert.deepEqual(titles(await getPromosForDate(D2)), ['Bobblehead'], 'MLB raw flag ignored');
});

test('getPromosInDateRange and getPromosFromDate: packages out, MLB untouched', async () => {
  const { getPromosInDateRange, getPromosFromDate } = await import('../data');
  assert.deepEqual(titles(await getPromosInDateRange(D1, D2)), COUNTED);
  assert.deepEqual(titles(await getPromosFromDate(D1)), COUNTED);
});

test('getHighlightedPromos: packages out', async () => {
  const { getHighlightedPromos } = await import('../data');
  assert.deepEqual(titles(await getHighlightedPromos(10)), COUNTED);
});

test('dropTicketPackageRows leaves an unflagged NHL row and every MLB row', async () => {
  const { getPromosFromDate } = await import('../data');
  const rows = await getPromosFromDate(D1);
  assert.ok(rows.some((r) => r.team.league === 'NHL' && r.title === 'Free Night'));
  assert.ok(rows.some((r) => r.team.league === 'MLB' && r.title === 'Bobblehead'));
});

test('the venue hub week scroller: packages out', async () => {
  const { getVenueHubWeekPromos } = await import('../venue-hub');
  const hub = { tenants: [{ teamId: 'detroit-red-wings', league: 'NHL' }, { teamId: 'minnesota-twins', league: 'MLB' }] } as never;
  const out = await getVenueHubWeekPromos(hub);
  assert.deepEqual(out.map((r) => r.promo.title).sort(), COUNTED);
});

test('the social feed: no package item, and no image card for one', async () => {
  const feed = await import('../social-feed/feed');
  const sel = await feed.getFeedSelection(new Date());
  assert.ok(sel.items.some((i) => i.title === 'Free Night'), 'the feed selects from this window (the check below is not vacuous)');
  assert.ok(!sel.items.some((i) => i.title === 'Hoodie Pack' || i.title === 'Lunch Box'), 'no package selected');
  assert.equal(await feed.findCardPromo('detroit-red-wings~d2'), null, 'no card for an NHL package');
  assert.equal((await feed.findCardPromo('detroit-red-wings~d1'))?.title, 'Free Night');
  assert.equal((await feed.findCardPromo('minnesota-twins~t2'))?.title, 'Bobblehead', 'MLB raw flag ignored');
});

test('My Teams: neither listed nor counted', async () => {
  const { GET } = await import('../../app/api/my-teams/promos/route');
  const { NextRequest } = await import('next/server');
  const res = await GET(new NextRequest(`http://localhost/api/my-teams/promos?teams=detroit-red-wings,minnesota-twins&start=${D1}&end=${D2}`));
  const body = (await res.json()) as { promos: { title: string }[] };
  assert.deepEqual(titles(body.promos), COUNTED);
});
