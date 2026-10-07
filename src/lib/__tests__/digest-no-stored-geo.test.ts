// The weekly digest reads no subscriber location (Matt's ruling, 2026-10-07).
//
// Until then the empty-window email's "promos around you" section anchored
// first on the IP-derived coordinates stored at signup. Those fields are gone
// from every subscriber record, and nothing may read them again: the subscriber
// mapper drops them even if a record still had them, and the cascade has no
// stored-geo level, so the followed-team market is the anchor for everyone.
//
// Run with:
//   node --import tsx --experimental-test-module-mocks --test <this file>

import { test, mock, beforeEach } from 'node:test';
import assert from 'node:assert';
import { coll, fakeDb, resetFirestore } from './support/fake-firestore';
import type { DigestPromo } from '../digest';

mock.module('server-only', { namedExports: {} });
mock.module(new URL('../firebase.ts', import.meta.url).href, { namedExports: { db: fakeDb } });

beforeEach(() => resetFirestore());

const GEO_KEYS = ['geoCity', 'geoRegion', 'geoLat', 'geoLng'];

test('the subscriber mapper drops location fields a record still carries', async () => {
  const { getConfirmedSubscribers } = await import('../subscribers');
  coll('subscribers').set('legacy', {
    email: 'fan@example.com',
    teams: ['minnesota-twins'],
    status: 'confirmed',
    source: 'web_team_page',
    confirmToken: 'c'.repeat(32),
    manageToken: 'm'.repeat(32),
    geoCity: 'Saint Paul',
    geoRegion: 'MN',
    geoLat: 44.9537,
    geoLng: -93.09,
  });
  const [sub] = await getConfirmedSubscribers();
  assert.ok(sub, 'the confirmed record is read');
  for (const key of GEO_KEYS) assert.ok(!(key in sub), `the mapped subscriber carries ${key}`);
  assert.ok(!JSON.stringify(sub).includes('44.9537'));
});

// Two markets 2,000+ km apart. A promo near each, so whichever anchor the
// cascade picks is visible in the result.
const coords = new Map([
  ['minnesota-twins', { lat: 44.9817, lng: -93.2776 }],
  ['seattle-mariners', { lat: 47.5914, lng: -122.3325 }],
]);
const promo = (teamId: string): DigestPromo =>
  ({ date: '2026-10-10', title: `${teamId} night`, teamId } as unknown as DigestPromo);
const windowPromos = [promo('minnesota-twins'), promo('seattle-mariners')];
const cityByTeamId = new Map([['minnesota-twins', 'Minneapolis'], ['seattle-mariners', 'Seattle']]);

test('the anchor is the followed-team market, whatever location is passed alongside', async () => {
  const { resolveLocalAnchor } = await import('../geo/local-promos');
  // A caller that still threads old stored coordinates (Seattle) for a Twins
  // fan: the cascade must ignore them and anchor on the Twins' market.
  const resolved = resolveLocalAnchor({
    followedTeamIds: ['minnesota-twins'],
    windowPromos,
    coords,
    cityByTeamId,
    ...({ stored: { geoCity: 'Seattle', geoLat: 47.6, geoLng: -122.33 } } as object),
  });
  assert.equal(resolved.level, 'team-proxy');
  assert.equal(resolved.anchor.source, 'team-proxy');
  assert.equal(resolved.anchor.city, 'Minneapolis');
  assert.deepEqual(resolved.localPromos.map((p) => p.teamId), ['minnesota-twins']);
});

test('no followed market with nearby promos falls to national, never to a stored point', async () => {
  const { resolveLocalAnchor } = await import('../geo/local-promos');
  const resolved = resolveLocalAnchor({
    followedTeamIds: ['minnesota-twins'],
    windowPromos: [promo('seattle-mariners')],
    coords,
    cityByTeamId,
  });
  assert.equal(resolved.level, 'national-fallback');
  assert.deepEqual(resolved.localPromos, []);
  assert.equal(resolved.anchor.city, 'Minneapolis', 'the market tried is reported for context');
});
