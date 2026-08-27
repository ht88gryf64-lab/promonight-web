// The per-field provenance rule for the condensed logistics block: a field
// renders only when it is populated AND the hub's sources map (or, for gates,
// the tenant overlay's sources map) names that field. Not the index floor, not
// the doc-level verified flag, not the tenant's verified flag.
import { test, mock } from 'node:test';
import assert from 'node:assert';

mock.module('server-only', { namedExports: {} });
mock.module(new URL('../firebase.ts', import.meta.url).href, { namedExports: { db: {} } });

import type { VenueHub as Hub } from '../venue-hub';

// Loaded inside each test: the module under test imports venue-hub, which
// imports the firebase client, so the mocks above must be registered first
// and the test runner compiles to CommonJS (no top-level await).
const load = () => import('../venue-hub-condensed');

function hub(over: Partial<Hub> = {}): Hub {
  return {
    slug: 'x-stadium', name: 'X Stadium', city: 'Town', state: 'ST', lat: 1, lng: 2, capacity: 50000,
    tenants: [{ teamId: 'x', league: 'CFB', tenantKey: 'x' }],
    parkingLots: [{ name: 'Lot A', notes: null }, { name: 'Lot B', notes: 'notes' }],
    parkingLotMapUrl: 'https://x.edu/map', officialParkingUrls: ['https://x.edu/parking'],
    publicTransit: { lines: ['Route 1'], notes: 'Take the bus. Then walk.' },
    rideshareDropoff: 'Drop at Gate C. Pickup same place.',
    accessibility: 'ADA entrances at Gate A. Elevators inside.',
    bagMaxDimensions: { w: 12, h: 6, d: 12, unit: 'in' }, clearBagRequired: true, bagsProhibited: null,
    bagPolicyUrl: 'https://x.edu/bags', bagPolicyNotes: 'Small clutches allowed. Nothing else.',
    tailgating: { allowed: true, rules: 'Stay in your space. No open flames.', timeWindow: 'Lots open at 7am.', grillRules: null, rvPolicy: null },
    venueAccessRestrictions: null, nearby: 'Block party on Main St. Food trucks.', outsideFoodAllowed: false, outsideFoodRules: 'No outside food.',
    food: 'Pizza near section 1. Tacos near 2.', photoUrl: null, photoAttribution: null,
    // doc-level verified is FALSE on purpose: the rule must not read it.
    verified: false,
    tenantOverlays: [{ teamId: 'x', league: 'CFB', displayName: 'X', gatesOpen: { ruleText: 'Gates open 2 hours before kickoff.', minutesBefore: 120 }, gateVariance: null, tailgateWindow: null, bagPolicyException: null, verified: false, sources: { gatesOpen: 'https://x.edu/gameday' } }],
    sources: { parkingLots: 'https://x.edu/parking', parkingLotMapUrl: 'https://x.edu/map', publicTransit: 'https://x.edu/transit', rideshareDropoff: 'https://x.edu/ride', accessibility: 'https://x.edu/ada', bagMaxDimensions: 'https://x.edu/bags', clearBagRequired: 'https://x.edu/bags', bagPolicyUrl: 'https://x.edu/bags', tailgating: 'https://x.edu/tailgate', outsideFoodRules: 'https://x.edu/food', food: 'https://x.edu/food', nearby: 'https://x.edu/nearby' },
    ...over,
  } as Hub;
}

test('a fully provenanced hub renders every field, verbatim first sentences, regardless of verified flags', async () => {
  const { buildCondensedLogistics } = await load();
  const lines = buildCondensedLogistics(hub(), 'x');
  const byKey = Object.fromEntries(lines.map((l) => [l.key, l]));
  assert.deepEqual(lines.map((l) => l.key), ['gates', 'bag', 'parking', 'tailgating', 'transit', 'rideshare', 'accessibility', 'outsideFood', 'food', 'nearby']);
  assert.equal(byKey.gates.text, 'Gates open 2 hours before kickoff.');
  assert.equal(byKey.bag.text, 'Clear bag 12" x 6" x 12".');
  assert.equal(byKey.bag.href, 'https://x.edu/bags');
  assert.equal(byKey.parking.text, 'Lots: Lot A, Lot B.');
  assert.equal(byKey.parking.hrefLabel, 'Official lot map');
  assert.equal(byKey.tailgating.text, 'Stay in your space. Lots open at 7am.');
  assert.equal(byKey.transit.text, 'Take the bus. Lines: Route 1.');
  assert.equal(byKey.accessibility.text, 'ADA entrances at Gate A.');
  assert.equal(byKey.outsideFood.text, 'No outside food or drink.');
  assert.equal(byKey.food.text, 'Pizza near section 1.');
  assert.equal(byKey.nearby.text, 'Block party on Main St.');
});

test('a populated field with no source for it stays silent', async () => {
  const { buildCondensedLogistics } = await load();
  const h = hub();
  const { tailgating: _t, publicTransit: _p, ...rest } = h.sources; void _t; void _p;
  const lines = buildCondensedLogistics({ ...h, sources: rest }, 'x');
  const keys = lines.map((l) => l.key);
  assert.ok(!keys.includes('tailgating'), 'tailgating must not render without sources.tailgating');
  assert.ok(!keys.includes('transit'), 'transit must not render without sources.publicTransit');
  assert.ok(keys.includes('parking'));
});

test('gates need the tenant overlay source, for that tenant, and nothing else', async () => {
  const { buildCondensedLogistics } = await load();
  const h = hub();
  const noSrc = { ...h, tenantOverlays: [{ ...h.tenantOverlays[0], sources: {} }] };
  assert.ok(!buildCondensedLogistics(noSrc, 'x').some((l) => l.key === 'gates'));
  assert.ok(!buildCondensedLogistics(h, 'other-tenant').some((l) => l.key === 'gates'), 'another tenant\'s gates rule never renders for this school');
});

test('parking sub-fields gate on their own keys', async () => {
  const { buildCondensedLogistics } = await load();
  const h = hub();
  const { parkingLots: _l, ...rest } = h.sources; void _l;
  const line = buildCondensedLogistics({ ...h, sources: rest }, 'x').find((l) => l.key === 'parking');
  assert.ok(line);
  assert.equal(line!.text, 'See the official parking page.');
  assert.equal(line!.href, 'https://x.edu/map');
});

test('a hub with empty sources maps renders nothing at all, whatever it holds', async () => {
  const { buildCondensedLogistics } = await load();
  const h = hub({ sources: {} });
  // The doc-level map alone leaves the gates line standing, because gates
  // provenance lives on the tenant overlay; that is the rule working, not a gap.
  assert.deepEqual(buildCondensedLogistics(h, 'x').map((l) => l.key), ['gates']);
  const bare = { ...h, tenantOverlays: [{ ...h.tenantOverlays[0], sources: {} }] };
  assert.deepEqual(buildCondensedLogistics(bare, 'x'), []);
});

test('the block minimum is three lines', async () => {
  const { CONDENSED_MIN_FIELDS } = await load();
  assert.equal(CONDENSED_MIN_FIELDS, 3);
});
