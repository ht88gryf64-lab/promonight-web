// The meta description and the StadiumOrArena JSON-LD are built from the SAME
// string, so a claim that is wrong here is wrong in structured data, where a
// consumer has no page to check it against. These pin that the description
// never asserts a fact the page withholds.
import { test, mock } from 'node:test';
import assert from 'node:assert';

mock.module('server-only', { namedExports: {} });
mock.module(new URL('../firebase.ts', import.meta.url).href, { namedExports: { db: {} } });

import type { VenueHub } from '../venue-hub';

const load = () => import('../venue-hub');
const SRC = 'https://official.example.edu/guide';

function hub(over: Partial<VenueHub> = {}): VenueHub {
  return {
    slug: 'x-stadium', name: 'X Stadium', city: 'Town', state: 'ST', lat: 1, lng: 2, capacity: 5,
    tenants: [{ teamId: 'x', league: 'NFL', tenantKey: 'x' }],
    parkingLots: [{ name: 'Lot A', notes: 'opens early' }], parkingLotMapUrl: null,
    officialParkingUrls: [], publicTransit: { lines: ['Route 1'], notes: 'Take the bus.' },
    rideshareDropoff: null, accessibility: null,
    bagMaxDimensions: { w: 12, h: 6, d: 12, unit: 'in' }, clearBagRequired: true, bagsProhibited: null,
    bagPolicyUrl: null, bagPolicyNotes: null,
    tailgating: null, venueAccessRestrictions: null, nearby: null,
    outsideFoodAllowed: null, outsideFoodRules: null, food: 'Pizza.',
    photoUrl: null, photoAttribution: null, verified: true,
    tenantOverlays: [{ teamId: 'x', league: 'NFL', displayName: 'X', gatesOpen: { ruleText: 'Gates open 2 hours before kickoff.', minutesBefore: 120 }, gateVariance: null, tailgateWindow: null, bagPolicyException: null, verified: true, sources: { gatesOpen: SRC } }],
    sources: { bagMaxDimensions: SRC, clearBagRequired: SRC, parkingLots: SRC, publicTransit: SRC, food: SRC },
    ...over,
  } as VenueHub;
}
const drop = (h: VenueHub, ...keys: string[]) => { const s = { ...h.sources }; for (const k of keys) delete s[k]; return { ...h, sources: s } as VenueHub; };

test('the lead never asserts a bag policy from an unsourced field (hard-rock-stadium shape)', async () => {
  const { venueHubDescription } = await load();
  // Sourced dimensions, UNSOURCED clear-bag flag. The page capsule withholds
  // the clear-bag claim; the description must withhold it too.
  const d = venueHubDescription(drop(hub(), 'clearBagRequired'));
  assert.ok(!/clear bag/i.test(d), `description asserts a clear-bag requirement from an unsourced field: ${d}`);
  assert.ok(/12" x 6" x 12"/.test(d), 'the sourced dimensions may still be stated');
});

test('the topic list never promises gate times the page withholds (albertsons shape)', async () => {
  const { venueHubDescription } = await load();
  const noGateSrc = { ...hub(), tenantOverlays: [{ ...hub().tenantOverlays[0], sources: {} }] } as VenueHub;
  const d = venueHubDescription(noGateSrc);
  assert.ok(!/gate times/.test(d), `description promises gate times with no gate provenance: ${d}`);
});

test('the topic list never promises parking the page withholds', async () => {
  const { venueHubDescription } = await load();
  // No sourced lots, no reachable link, no map: the Parking lots card cannot render.
  const d = venueHubDescription(drop({ ...hub(), officialParkingUrls: [], parkingLotMapUrl: null } as VenueHub, 'parkingLots'));
  assert.ok(!/parking/i.test(d), `description promises parking the page withholds: ${d}`);
});

test('the topic list never promises food the page withholds', async () => {
  const { venueHubDescription } = await load();
  const d = venueHubDescription(drop(hub(), 'food'));
  assert.ok(!/\bfood\b/i.test(d), `description promises food with no provenance: ${d}`);
});

test('a POINTER still counts: a reachable bag policy URL alone supports the bag topic', async () => {
  const { venueHubDescription } = await load();
  const linkOnly = drop({ ...hub(), bagMaxDimensions: null, clearBagRequired: null, bagPolicyUrl: 'https://x.edu/bags' } as VenueHub, 'bagMaxDimensions', 'clearBagRequired');
  const d = venueHubDescription(linkOnly);
  assert.ok(d.length > 0);
  assert.ok(!/clear bag up to/i.test(d), 'no manufactured dimension claim');
});

test('an excluded field is never advertised', async () => {
  const { venueHubDescription } = await load();
  // yulman-stadium is on FIELD_CONFLICTS for tailgating; tailgating is not a
  // description topic, so use the transit path: a suppressed building.
  const d = venueHubDescription({ ...hub(), slug: 'bmo-field' } as VenueHub);
  assert.ok(!/transit/i.test(d), `description advertises transit for a suppressed building: ${d}`);
});
