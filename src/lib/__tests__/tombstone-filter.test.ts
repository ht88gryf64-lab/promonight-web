// Proves tombstone visibility filtering through the THREE real shaper paths:
//   1. mapPromoDoc + isVisiblePromo  (getTeamPromos)
//   2. the scored-loop guard          (getScoredPromosInDateRange)
//   3. the API-route raw-doc filter   (GET /api/my-teams/promos)
//
// For each path: a tombstoned:true mock is EXCLUDED; a tombstoned:false mock
// and a field-absent mock are BOTH included. The point is to prove the field
// survives each shaper, not just that the predicate is correct in isolation.
//
// firebase + server-only are module-mocked so the real data.ts / route.ts run
// against an in-memory fake Firestore. Run with:
//   node --import tsx --experimental-test-module-mocks --test <this file>

import { test, mock } from 'node:test';
import assert from 'node:assert';

// ── fake Firestore ──────────────────────────────────────────────────────────
type Data = Record<string, unknown>;
function fakeDoc(id: string, data: Data, teamId?: string) {
  return {
    id,
    exists: true,
    data: () => data,
    ref: { parent: { parent: teamId ? { id: teamId } : null } },
  };
}
function fakeSnap(docs: ReturnType<typeof fakeDoc>[]) {
  return {
    docs,
    empty: docs.length === 0,
    size: docs.length,
    forEach: (fn: (d: (typeof docs)[number]) => void) => docs.forEach(fn),
    data: () => ({ count: docs.length }),
  };
}
// A chainable query whose where/orderBy/limit are no-ops; get() returns `snap`.
function query(snap: ReturnType<typeof fakeSnap>): any {
  const q: any = {
    where: () => q,
    orderBy: () => q,
    limit: () => q,
    count: () => ({ get: async () => snap }),
    get: async () => snap,
  };
  return q;
}

// One team, three promo docs: tombstoned true / false / absent.
const TEAM = fakeDoc('test-team', {
  league: 'MLB',
  city: 'Test',
  name: 'Team',
  abbreviation: 'TST',
  primaryColor: 4278190080,
  secondaryColor: 4278190080,
  division: 'Test Division',
});
const PROMO_FIELDS = (over: Data): Data => ({
  date: '2026-07-01',
  title: 'Promo',
  type: 'giveaway',
  time: '7:05 PM',
  opponent: 'Visitors',
  description: 'd',
  ...over,
});
const promoDocs = [
  fakeDoc('p-true', PROMO_FIELDS({ title: 'Tombstoned True', date: '2026-07-01', tombstoned: true }), 'test-team'),
  fakeDoc('p-false', PROMO_FIELDS({ title: 'Tombstoned False', date: '2026-07-02', tombstoned: false }), 'test-team'),
  fakeDoc('p-absent', PROMO_FIELDS({ title: 'Field Absent', date: '2026-07-03' }), 'test-team'),
];
// Scored variants carry the fields fetchScoredPromos requires (score, breakdown, signals).
const SCORED = (over: Data): Data =>
  PROMO_FIELDS({ score: 10, scoreBreakdown: { baseType: 10 }, derivedSignals: { itemType: 'generic' }, ...over });
const scoredDocs = [
  fakeDoc('s-true', SCORED({ title: 'Scored True', date: '2026-07-01', tombstoned: true }), 'test-team'),
  fakeDoc('s-false', SCORED({ title: 'Scored False', date: '2026-07-02', tombstoned: false }), 'test-team'),
  fakeDoc('s-absent', SCORED({ title: 'Scored Absent', date: '2026-07-03' }), 'test-team'),
];

const fakeDb = {
  collection(name: string): any {
    if (name === 'teams') {
      return {
        get: async () => fakeSnap([TEAM]),
        doc: (id: string) => ({
          get: async () => (id === 'test-team' ? TEAM : { exists: false, data: () => undefined }),
          collection: () => query(fakeSnap(promoDocs)),
        }),
      };
    }
    // venues / anything else: empty (route resolves venue to null, which is fine).
    return query(fakeSnap([]));
  },
  collectionGroup(name: string): any {
    if (name === 'promos') return query(fakeSnap(scoredDocs));
    return query(fakeSnap([]));
  },
};

mock.module('server-only', { namedExports: {} });
mock.module(new URL('../firebase.ts', import.meta.url).href, { namedExports: { db: fakeDb } });

// ── path 1: mapPromoDoc carry-through + isVisiblePromo ───────────────────────
test('path 1 - mapPromoDoc carries tombstoned and getTeamPromos filters it', async () => {
  const { mapPromoDoc, getTeamPromos } = await import('../data');
  const { isVisiblePromo } = await import('../promo-helpers');

  // Carry-through: the shaper must copy the field onto the mapped object.
  assert.equal(mapPromoDoc(promoDocs[0] as any).tombstoned, true, 'true survives the shaper');
  assert.equal(mapPromoDoc(promoDocs[1] as any).tombstoned, false, 'false survives the shaper');
  assert.equal(mapPromoDoc(promoDocs[2] as any).tombstoned, undefined, 'absent stays absent');
  // Predicate over the shaped objects: only true is hidden.
  assert.equal(isVisiblePromo(mapPromoDoc(promoDocs[0] as any)), false);
  assert.equal(isVisiblePromo(mapPromoDoc(promoDocs[1] as any)), true);
  assert.equal(isVisiblePromo(mapPromoDoc(promoDocs[2] as any)), true);

  // End-to-end through the real read: the tombstoned one is gone, the other two stay.
  const promos = await getTeamPromos('test-team');
  const titles = promos.map((p) => p.title).sort();
  assert.deepEqual(titles, ['Field Absent', 'Tombstoned False']);
});

// ── path 2: the scored-loop guard ────────────────────────────────────────────
test('path 2 - getScoredPromosInDateRange skips tombstoned:true, keeps false/absent', async () => {
  const { getScoredPromosInDateRange } = await import('../data');
  const scored = await getScoredPromosInDateRange('2026-01-01', '2026-12-31');
  const titles = scored.map((p) => p.title).sort();
  assert.deepEqual(titles, ['Scored Absent', 'Scored False']);
});

// ── path 3: the API-route raw-doc filter ─────────────────────────────────────
test('path 3 - GET /api/my-teams/promos filters tombstoned:true raw docs', async () => {
  const { GET } = await import('../../app/api/my-teams/promos/route');
  const { NextRequest } = await import('next/server');
  const req = new NextRequest(
    'http://localhost/api/my-teams/promos?teams=test-team&start=2026-07-01&end=2026-07-31',
  );
  const res = await GET(req);
  const body = (await res.json()) as { promos: { title: string }[] };
  const titles = body.promos.map((p) => p.title).sort();
  assert.deepEqual(titles, ['Field Absent', 'Tombstoned False']);
});
