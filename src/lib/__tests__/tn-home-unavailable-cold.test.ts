// tnHomeUnavailable, a cold process (review M2): when the tnTeamMap read fails
// twice before this process has ever read it, the teams read FAILS rather than
// caching a generation with no club flagged (which would bake TicketNetwork
// links into SSG/ISR pages), and the next call retries and gets the flags.
// Its own file: node --test runs each file in its own process, so the module
// state here is truly cold.
import { test, mock } from 'node:test';
import assert from 'node:assert/strict';

let fail = true;
let reads = 0;
const snap = (rows: [string, Record<string, unknown>][]) => ({ docs: rows.map(([id, d]) => ({ id, exists: true, data: () => d, get: (f: string) => d[f] })) });
const fakeDb = {
  collection(name: string): any {
    if (name === 'teams') return { get: async () => snap([['toronto-maple-leafs', { league: 'NHL', city: 'Toronto', name: 'Maple Leafs', sportSlug: 'nhl' }]]) };
    if (name === 'tnTeamMap') return { where: () => ({ get: async () => { reads += 1; if (fail) throw new Error('UNAVAILABLE'); return snap([['toronto-maple-leafs', { tnHomeUnavailable: true }]]); } }) };
    throw new Error(`unexpected collection ${name}`);
  },
};
mock.module('server-only', { namedExports: {} });
mock.module(new URL('../firebase.ts', import.meta.url).href, { namedExports: { db: fakeDb } });
mock.method(console, 'error', () => {});

test('cold failure: the teams read rejects after one retry; the next call is not latched and reads the flags', async () => {
  const { getAllTeams } = await import('../data');
  await assert.rejects(() => getAllTeams(), /UNAVAILABLE/);
  assert.equal(reads, 2, 'read, then one retry');
  fail = false;
  const teams = await getAllTeams();
  assert.equal(teams[0].tnHomeUnavailable, true);
});
