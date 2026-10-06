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
  const ref: any = { parent: { parent: teamId ? { id: teamId, get: async () => [...TEAMS, GHOST].find((t) => t.id === teamId) } : null } };
  return { id, exists: true, data: () => data, get: (f: string) => data[f], ref };
}
function snap(docs: Doc[]) {
  return { docs, empty: docs.length === 0, size: docs.length, forEach: (fn: (d: Doc) => void) => docs.forEach(fn), data: () => ({ count: docs.length }) };
}
const docName = (d: Doc) => `${d.ref.parent.parent?.id ?? ''}/${d.id}`;
const byName = (a: Doc, b: Doc) => (docName(a) < docName(b) ? -1 : docName(a) > docName(b) ? 1 : 0);
function query(docs: Doc[]): any {
  let rows = docs;
  let orderField: string | null = null;
  const q: any = {
    where: (field: string, op: string, value: any) => {
      const v = (d: Doc) => d.data()[field] as any;
      if (op === '==') rows = rows.filter((d) => v(d) === value);
      if (op === '>=') rows = rows.filter((d) => v(d) >= value);
      if (op === '<=') rows = rows.filter((d) => v(d) <= value);
      return q;
    },
    // Firestore returns documents in document-name order (team path, then id)
    // unless ordered by a field, and breaks field ties the same way. The real
    // readers' dedupe depends on it, so the fake does it too.
    orderBy: (f: string) => {
      orderField = f;
      return q;
    },
    limit: () => q,
    count: () => ({ get: async () => snap(rows) }),
    get: async () => snap([...rows].sort((a, b) => (orderField ? String(a.data()[orderField]).localeCompare(String(b.data()[orderField])) : 0) || byName(a, b))),
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
const GHOST = fakeDoc('ghost-nhl', { league: 'NHL', city: 'Ghost', name: 'Club', abbreviation: 'GHO', primaryColor: 0, secondaryColor: 0, division: 'X', sportSlug: 'nhl' });
const row = (id: string, team: string, date: string, title: string, type: string, flagged: boolean) =>
  fakeDoc(id, { date, title, type, description: `${title}.`, opponent: 'Visitors', highlight: true, ...(flagged ? { ticketPackageRequired: true } : {}) }, team);
const PROMOS = [
  // A same-date, same-title pair with the FLAGGED doc first: the team page
  // dedupes first (the flagged one survives) and then lists it as a package,
  // so no reader may show the unflagged twin either. Drop-before-dedupe would.
  row('d4', 'detroit-red-wings', D2, 'Twin Night', 'theme', true),
  row('d5', 'detroit-red-wings', D2, 'Twin Night', 'theme', false),
  // A twin pair stored so an unordered read returns the unflagged doc FIRST,
  // while Firestore's id order puts the flagged one first (e1 < e2): My Teams
  // must sort before it dedupes, or it keeps the wrong one.
  row('e2', 'detroit-red-wings', D1, 'Order Night', 'theme', false),
  row('e1', 'detroit-red-wings', D1, 'Order Night', 'theme', true),
  row('g1', 'ghost-nhl', D1, 'Ghost Pack', 'theme', true),
  row('g2', 'ghost-nhl', D1, 'Ghost Night', 'theme', false),
  row('d1', 'detroit-red-wings', D1, 'Free Night', 'theme', false),
  row('d2', 'detroit-red-wings', D1, 'Hoodie Pack', 'theme', true),
  row('d3', 'detroit-red-wings', D2, 'Lunch Box', 'food', true),
  row('t1', 'minnesota-twins', D1, 'Fireworks', 'theme', false),
  row('t2', 'minnesota-twins', D2, 'Bobblehead', 'giveaway', true),
];
const byTeam = (id: string) => PROMOS.filter((d) => d.ref.parent.parent?.id === id);
let groupThrows = false;

const fakeDb = {
  collection(name: string): any {
    if (name === 'teams') {
      return {
        ...query(TEAMS),
        doc: (id: string) => ({
          // ghost-nhl: readable by its doc, absent from the cached teams list,
          // so My Teams has to fall back to reading the league from the doc.
          get: async () => [...TEAMS, GHOST].find((t) => t.id === id) ?? { exists: false, data: () => undefined },
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
    // groupThrows: exercise every reader's per-team fallback path.
    if (groupThrows) return { where: () => { throw new Error('no index'); }, orderBy: () => { throw new Error('no index'); }, count: () => ({ get: async () => snap(PROMOS) }) };
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
  // This reader resolves teams by their doc, so the club absent from the
  // cached list (ghost-nhl) is read too: its counted row in, its package out.
  assert.deepEqual(titles(await getHighlightedPromos(10)), [...COUNTED, 'Ghost Night'].sort());
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

test('the per-team fallback paths drop packages too (collection-group query unavailable)', async () => {
  const { getPromosForDate, getPromosInDateRange, getPromosFromDate, getHighlightedPromos } = await import('../data');
  groupThrows = true;
  try {
    assert.deepEqual(titles(await getPromosForDate(D1)), ['Fireworks', 'Free Night']);
    assert.deepEqual(titles(await getPromosInDateRange(D1, D2)), COUNTED);
    assert.deepEqual(titles(await getPromosFromDate(D1)), COUNTED);
    assert.deepEqual(titles(await getHighlightedPromos(10)), COUNTED);
  } finally {
    groupThrows = false;
  }
});

test('dedupe first, then drop: the unflagged twin of a package never shows', async () => {
  const { getPromosInDateRange, getTeamPromos, isTicketPackagePromo } = await import('../data');
  const team = await getTeamPromos('detroit-red-wings');
  const twin = team.filter((p) => p.title === 'Twin Night');
  assert.equal(twin.length, 1, 'the team page keeps one Twin Night');
  assert.equal(isTicketPackagePromo(twin[0]), true, 'and it is the package');
  assert.ok(!(await getPromosInDateRange(D1, D2)).some((p) => p.title === 'Twin Night'));
});

test('the feed keeps MLB rows that carry the raw flag', async () => {
  const feed = await import('../social-feed/feed');
  const sel = await feed.getFeedSelection(new Date());
  assert.ok(!sel.items.some((i) => i.title === 'Twin Night'), 'no twin of a package');
  // Selection is ranked and capped, so read the candidates the same reader
  // returns: an MLB row with the flag is still a candidate.
  const card = await feed.findCardPromo('minnesota-twins~t2');
  assert.equal(card?.title, 'Bobblehead');
  assert.deepEqual(sel.items.map((i) => i.title).sort(), COUNTED, 'every counted row selected, the MLB raw-flag row included');
});

test('My Teams sorts in Firestore order before the dedupe, and reads the league when the cached lookup misses', async () => {
  const { GET } = await import('../../app/api/my-teams/promos/route');
  const { NextRequest } = await import('next/server');
  const res = await GET(new NextRequest(`http://localhost/api/my-teams/promos?teams=detroit-red-wings,ghost-nhl&start=${D1}&end=${D1}`));
  const got = titles(((await res.json()) as { promos: { title: string }[] }).promos);
  assert.ok(!got.includes('Order Night'), 'the flagged doc wins the dedupe (id order), so the pair is a package');
  assert.ok(!got.includes('Ghost Pack'), 'league read from the doc: the package is dropped');
  assert.ok(got.includes('Ghost Night'));
});

test('no image card for the unflagged twin of a package', async () => {
  const feed = await import('../social-feed/feed');
  assert.equal(await feed.findCardPromo('detroit-red-wings~d5'), null, 'Twin Night: the flagged d4 wins the dedupe');
  assert.equal(await feed.findCardPromo('detroit-red-wings~e2'), null, 'Order Night: the flagged e1 wins by id');
  assert.equal((await feed.findCardPromo('detroit-red-wings~d1'))?.title, 'Free Night');
});
