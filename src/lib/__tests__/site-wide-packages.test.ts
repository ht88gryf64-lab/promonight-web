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
      // As Firestore does: an undefined filter value is an error.
      if (value === undefined) throw new Error('Unsupported field value: undefined');
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
  fakeDoc('texas-rangers', { league: 'MLB', city: 'Texas', name: 'Rangers', abbreviation: 'TEX', primaryColor: 0, secondaryColor: 0, division: 'West', sportSlug: 'mlb' }),
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
  // A twin pair stored in the reverse of Firestore's id order (e2 before e1).
  // Firestore, and this fake, return range-query results in date then
  // document-name order, so every reader sees e1 (flagged) first and the pair
  // is a package everywhere. My Teams' own sort before its dedupe is
  // defensive and redundant with that order; this fixture does not isolate it.
  row('e2', 'detroit-red-wings', D1, 'Order Night', 'theme', false),
  row('e1', 'detroit-red-wings', D1, 'Order Night', 'theme', true),
  row('g1', 'ghost-nhl', D1, 'Ghost Pack', 'theme', true),
  row('g2', 'ghost-nhl', D1, 'Ghost Night', 'theme', false),
  // The unflagged twin has the LOWER id, so it wins the team page's dedupe and
  // is a counted promotion: its card stays (round 3).
  row('a1', 'detroit-red-wings', D2, 'Lower Night', 'theme', false),
  row('a2', 'detroit-red-wings', D2, 'Lower Night', 'theme', true),
  // A tombstoned flagged twin with the lower id is not on the team page at
  // all, so it must not take its live twin's card down (round 3).
  { ...row('b1', 'detroit-red-wings', D2, 'Tomb Night', 'theme', true), data: () => ({ date: D2, title: 'Tomb Night', type: 'theme', description: '.', opponent: 'V', highlight: true, ticketPackageRequired: true, tombstoned: true }) },
  row('b2', 'detroit-red-wings', D2, 'Tomb Night', 'theme', false),
  // An MLB same-date, same-title pair: My Teams lists both, as it always has
  // (only NHL/NBA are deduped there).
  row('m1', 'texas-rangers', D1, 'Dup Night', 'theme', false),
  row('m2', 'texas-rangers', D1, 'Dup Night', 'theme', false),
  // A dateless NHL row: its image card must 404 cleanly, never throw.
  { ...row('z1', 'detroit-red-wings', D1, 'No Date Night', 'theme', false), data: () => ({ title: 'No Date Night', type: 'theme', description: '.', opponent: 'V', highlight: false }) },
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
const COUNTED = ['Bobblehead', 'Dup Night', 'Fireworks', 'Free Night', 'Lower Night', 'Tomb Night'];

test('getPromosForDate: the NHL package is not on the daily board', async () => {
  const { getPromosForDate } = await import('../data');
  assert.deepEqual(titles(await getPromosForDate(D1)), ['Dup Night', 'Fireworks', 'Free Night']);
  assert.deepEqual(titles(await getPromosForDate(D2)), ['Bobblehead', 'Lower Night', 'Tomb Night'], 'MLB raw flag ignored; the winning unflagged twins kept');
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
  assert.deepEqual(out.map((r) => r.promo.title).sort(), COUNTED.filter((t) => t !== 'Dup Night'), 'the hub\'s two tenants only');
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
  const res = await GET(new NextRequest(`http://localhost/api/my-teams/promos?teams=detroit-red-wings,minnesota-twins,texas-rangers&start=${D1}&end=${D2}`));
  const body = (await res.json()) as { promos: { title: string }[] };
  // MLB is read as before: both Dup Night docs listed, no dedupe.
  assert.deepEqual(titles(body.promos), [...COUNTED, 'Dup Night'].sort());
});

test('the per-team fallback paths drop packages too (collection-group query unavailable)', async () => {
  const { getPromosForDate, getPromosInDateRange, getPromosFromDate, getHighlightedPromos } = await import('../data');
  groupThrows = true;
  try {
    assert.deepEqual(titles(await getPromosForDate(D1)), ['Dup Night', 'Fireworks', 'Free Night']);
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
  const picked = sel.items.map((i) => i.title);
  assert.ok(picked.every((t) => COUNTED.includes(t)), `only counted rows: ${picked}`);
  assert.ok(picked.includes('Bobblehead'), 'the MLB raw-flag row is selected (Twins: Fireworks and Bobblehead, within the per-team cap of 2)');
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

test('image cards: the winning unflagged twin keeps its card; a tombstoned flagged twin takes nothing down', async () => {
  const feed = await import('../social-feed/feed');
  assert.equal((await feed.findCardPromo('detroit-red-wings~a1'))?.title, 'Lower Night');
  assert.equal(await feed.findCardPromo('detroit-red-wings~a2'), null);
  assert.equal((await feed.findCardPromo('detroit-red-wings~b2'))?.title, 'Tomb Night');
});

test('starredTeamLeague fails closed: a throwing or missing lookup reads the doc; a failing doc read rejects', async () => {
  const { starredTeamLeague } = await import('../starred-team-league');
  const doc = async () => ({ league: 'NHL' });
  assert.equal(await starredTeamLeague('x', async () => { throw new Error('UNAVAILABLE'); }, doc), 'NHL');
  assert.equal(await starredTeamLeague('x', async () => null, doc), 'NHL');
  assert.equal(await starredTeamLeague('x', async () => ({ league: 'NBA' }), async () => { throw new Error('never read'); }), 'NBA');
  await assert.rejects(starredTeamLeague('x', async () => null, async () => { throw new Error('doc read failed'); }));
});

test('the /nhl hub card count: dedupe, then drop (the unflagged twin of a package is not counted)', async () => {
  const { getLeagueUpcomingPromoCounts } = await import('../data');
  const nhl = await getLeagueUpcomingPromoCounts('NHL');
  // Counted Detroit rows: Free Night, Lower Night (wins its pair), Tomb Night;
  // not Twin Night or Order Night (their flagged docs win), nor any package.
  assert.equal(nhl['detroit-red-wings'], 3);
});

test('a dateless NHL row: no card, and no throw', async () => {
  const feed = await import('../social-feed/feed');
  assert.equal(await feed.findCardPromo('detroit-red-wings~z1'), null);
});

test('the feed fallback path keeps the team page order (twins never selected)', async () => {
  const feed = await import('../social-feed/feed');
  groupThrows = true;
  try {
    const sel = await feed.getFeedSelection(new Date());
    const picked = sel.items.map((i) => i.title);
    assert.ok(picked.length > 0, 'the fallback path selects something');
    assert.ok(!picked.some((t) => ['Twin Night', 'Order Night', 'Hoodie Pack', 'Lunch Box'].includes(t)), `no package or package twin: ${picked}`);
  } finally {
    groupThrows = false;
  }
});

test('the /nhl hub season comes from the NHL/NBA constant', async () => {
  const { readFileSync } = await import('node:fs');
  assert.match(readFileSync(new URL('../../app/nhl/page.tsx', import.meta.url), 'utf8'), /\nconst SEASON = splitSeasonLabel\(SPLIT_SEASON_START_YEAR\);/);
});
