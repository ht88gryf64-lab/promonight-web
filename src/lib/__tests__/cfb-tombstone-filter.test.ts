// Proves the cfbGames tombstone filter through the REAL reader path:
// loadGames -> getCfbSchoolPage. A tombstoned:true doc must disappear; a
// tombstoned:false doc and a field-absent doc must both survive.
//
// This is the reader half of the contract written by
// scripts/cfb/run-phase2-reconcile.ts:130. Writer and reader must agree that
// only `true` hides, because a Firestore inequality would drop every doc that
// lacks the field.
//
// firebase + server-only are module-mocked so the real data.ts runs against an
// in-memory fake Firestore. Run with:
//   node --import tsx --experimental-test-module-mocks --test <this file>

import { test, mock } from 'node:test';
import assert from 'node:assert';

type Data = Record<string, unknown>;
function fakeDoc(id: string, data: Data) {
  return { id, exists: true, data: () => data };
}
function fakeSnap(docs: ReturnType<typeof fakeDoc>[]) {
  return { docs, empty: docs.length === 0, size: docs.length };
}

const SCHOOLS = [
  fakeDoc('alabama', {
    id: 'alabama', name: 'Alabama', shortName: 'Alabama', mascot: 'Crimson Tide',
    primaryColor: '#B30838', secondaryColor: '#FFFFFF', conferenceBySeason: { '2026': 'SEC' },
    venueId: 'bryant-denny', traditionIds: [], editorialStatus: 'auto',
  }),
  fakeDoc('auburn', {
    id: 'auburn', name: 'Auburn', shortName: 'Auburn', mascot: 'Tigers',
    primaryColor: '#0C2340', secondaryColor: '#E87722', conferenceBySeason: { '2026': 'SEC' },
    venueId: 'jordan-hare', traditionIds: [], editorialStatus: 'auto',
  }),
];

const VENUES = [
  fakeDoc('bryant-denny', { id: 'bryant-denny', name: 'Bryant-Denny Stadium', city: 'Tuscaloosa', state: 'Alabama', lat: 33.2083, lng: -87.5504 }),
];

const GAME = (over: Data): Data => ({
  season: 2026, week: 1, date: '2026-09-05', status: 'scheduled',
  homeSchoolId: 'alabama', awaySchoolId: 'auburn', neutralSite: false, venueId: 'bryant-denny',
  kickoff: { time: '3:30 PM', tz: 'ET', tbd: false, windowFlex: null },
  broadcast: { network: 'ABC', confirmed: true },
  conferenceGame: true, rivalryId: null, themeDesignations: [],
  source: 'https://rolltide.com/schedule', confidence: 'HIGH', fetchedAt: '2026-08-11T00:00:00.000Z',
  verified: true, verification: null,
  ...over,
});

// Three docs on three distinct dates so the survivors are identifiable by date.
const GAMES = [
  fakeDoc('g-true', GAME({ id: 'g-true', date: '2026-09-05', tombstoned: true })),
  fakeDoc('g-false', GAME({ id: 'g-false', date: '2026-09-12', tombstoned: false })),
  fakeDoc('g-absent', GAME({ id: 'g-absent', date: '2026-09-19' })),
];

const fakeDb = {
  collection(name: string): any {
    if (name === 'cfbSchools') return { get: async () => fakeSnap(SCHOOLS) };
    if (name === 'cfbVenues') return { get: async () => fakeSnap(VENUES) };
    if (name === 'cfbGames') return { get: async () => fakeSnap(GAMES) };
    if (name === 'cfbRivalries') return { get: async () => fakeSnap([]) };
    return { get: async () => fakeSnap([]) };
  },
};

mock.module('server-only', { namedExports: {} });
mock.module(new URL('../firebase.ts', import.meta.url).href, { namedExports: { db: fakeDb } });

test('isVisibleGame hides only true, never absent or false', async () => {
  const { isVisibleGame } = await import('../cfb/human-owned');
  assert.equal(isVisibleGame({ tombstoned: true }), false);
  assert.equal(isVisibleGame({ tombstoned: false }), true);
  assert.equal(isVisibleGame({}), true);
});

test('a tombstoned game disappears from getCfbSchoolPage output', async () => {
  const { getCfbSchoolPage } = await import('../cfb/data');
  const page = await getCfbSchoolPage('alabama');
  assert.ok(page, 'alabama page should resolve');
  const dates = page!.games.map((g) => g.date).sort();
  assert.deepEqual(dates, ['2026-09-12', '2026-09-19'], 'tombstoned:true is gone, false and absent remain');
});

test('the filter applies to the opponent page too, since one doc serves both', async () => {
  // getCfbSchoolPage matches homeSchoolId OR awaySchoolId, so a single doc feeds
  // both schools' pages. The tombstone has to hide it on both or the duplicate
  // just moves rather than disappearing.
  const { getCfbSchoolPage } = await import('../cfb/data');
  const page = await getCfbSchoolPage('auburn');
  assert.ok(page);
  const dates = page!.games.map((g) => g.date).sort();
  assert.deepEqual(dates, ['2026-09-12', '2026-09-19']);
});
