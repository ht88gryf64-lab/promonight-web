// The canonical stamp through the real loaders (Phase 3c, review finding 1,
// 2026-10-30): the cross-team readers and the social feed must see each row's
// image tier and package flag, which ride by object identity from the mapper.
// A spread before the stamp loses both and turns the page's winner into a
// loser. Executed against a fake Firestore holding one NHL club with a tier 1
// bobblehead, a theme night that nests with it, and a special-ticket twin of
// the bobblehead on one date.
//
// Run with: node --import tsx --experimental-test-module-mocks --test <this file>
import { test, mock } from 'node:test';
import assert from 'node:assert/strict';

process.env.PROMO_PAGES_LIVE = 'true';

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
      if (value === undefined) throw new Error('Unsupported field value: undefined');
      const v = (d: Doc) => d.data()[field] as any;
      if (op === '==') rows = rows.filter((d) => v(d) === value);
      if (op === '>=') rows = rows.filter((d) => v(d) >= value);
      if (op === '<=') rows = rows.filter((d) => v(d) <= value);
      return q;
    },
    orderBy: () => q,
    limit: () => q,
    count: () => ({ get: async () => snap(rows) }),
    get: async () => snap([...rows].sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0))),
  };
  return q;
}
const ymd = (offset: number) => new Date(Date.now() + offset * 86_400_000).toISOString().slice(0, 10);
const D = ymd(2);
const TEAMS = [fakeDoc('dallas-stars', { league: 'NHL', city: 'Dallas', name: 'Stars', abbreviation: 'DAL', primaryColor: 0, secondaryColor: 0, division: 'Central', sportSlug: 'nhl' })];
const row = (id: string, title: string, type: string, pageSlug: string, extra: Data = {}) =>
  fakeDoc(id, { date: D, title, type, description: `${title}.`, opponent: 'Visitors', highlight: true, pageSlug, pageSeason: '2026-27', ...extra }, 'dallas-stars');
const PROMOS = [
  // The theme night sorts first by id: a stamp that reads no tier would make
  // it the group's winner (more tokens).
  row('a-night', 'Esa Lindell Bobblehead Night', 'theme', 'esa-lindell-bobblehead-night'),
  row('b-bobble', 'Esa Lindell Bobblehead', 'giveaway', 'esa-lindell-bobblehead', { imageTier: 1 }),
  // A special-ticket twin with the longest title and a tier 1 image: never a
  // candidate on NHL, so it can win nothing.
  row('c-package', 'Esa Lindell Bobblehead Package Night', 'giveaway', 'esa-lindell-bobblehead-package-night', { imageTier: 1, ticketPackageRequired: true }),
];
const fakeDb = {
  collection(name: string): any {
    if (name === 'teams') {
      return {
        ...query(TEAMS),
        doc: (id: string) => ({
          get: async () => TEAMS.find((t) => t.id === id) ?? { exists: false, data: () => undefined },
          collection: () => ({ ...query(PROMOS.filter((d) => d.ref.parent.parent?.id === id)), doc: (pid: string) => ({ get: async () => PROMOS.find((d) => d.id === pid) ?? { exists: false, data: () => undefined } }) }),
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

test('the cross-team readers stamp the theme night as the loser and leave the tier 1 bobblehead its own page', async () => {
  const { getPromosForDate, getPromosInDateRange, getTeamPromos } = await import('../data');
  const { promoPageHref } = await import('../promo-page-href');
  for (const rows of [await getPromosForDate(D), await getPromosInDateRange(D, D)]) {
    const night = rows.find((r) => r.title === 'Esa Lindell Bobblehead Night');
    const bobble = rows.find((r) => r.title === 'Esa Lindell Bobblehead');
    assert.ok(night && bobble, 'both promotions are listed');
    assert.equal(rows.some((r) => /Package/.test(r.title)), false, 'the package is not a promotion on NHL');
    assert.equal(night.pageCanonicalSlug, 'esa-lindell-bobblehead', 'the night links to the bobblehead (its tier 1 winner)');
    assert.equal(bobble.pageCanonicalSlug, undefined, 'the bobblehead is its own page');
    assert.equal(promoPageHref(night), '/nhl/dallas-stars/promos/esa-lindell-bobblehead');
    assert.equal(promoPageHref(bobble), '/nhl/dallas-stars/promos/esa-lindell-bobblehead');
  }
  const team = await getTeamPromos('dallas-stars');
  assert.equal(team.find((r) => r.title === 'Esa Lindell Bobblehead Night')?.pageCanonicalSlug, 'esa-lindell-bobblehead');
  assert.equal(team.find((r) => r.title === 'Esa Lindell Bobblehead')?.pageCanonicalSlug, undefined);
});

test('the social feed links the theme night to the bobblehead page and never to the package', async () => {
  const { getFeedRssItems } = await import('../social-feed/feed');
  const { itemLink } = await import('../social-feed/rss');
  const { items } = await getFeedRssItems(new Date());
  const night = items.find((i) => i.title === 'Esa Lindell Bobblehead Night');
  const bobble = items.find((i) => i.title === 'Esa Lindell Bobblehead');
  assert.ok(night && bobble, `both items are in the feed: ${items.map((i) => i.title).join(', ')}`);
  assert.equal(items.some((i) => /Package/.test(i.title)), false);
  assert.equal(night.pageHref, '/nhl/dallas-stars/promos/esa-lindell-bobblehead');
  assert.equal(bobble.pageHref, '/nhl/dallas-stars/promos/esa-lindell-bobblehead');
  assert.match(itemLink(night), /^https:\/\/www\.getpromonight\.com\/nhl\/dallas-stars\/promos\/esa-lindell-bobblehead\?utm_source=promonight_feed/);
});
