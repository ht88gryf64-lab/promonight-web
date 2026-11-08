// Before you go (step 4, 2026-11-08): the row builder's three rules, on a
// published hub built by hand. (a) a building with zero fields in state
// `rendered` yields no rows, however much it stores and sources; (b) a field in
// operator-conflict or held state never yields a row, pointer included;
// (c) a rendered field with no read time yields no row, and every row that
// renders carries its own read time. Plus the order, the link resolution and
// the per-tenant gate.
import { test, mock } from 'node:test';
import assert from 'node:assert/strict';

// The builder reaches venue-hub, which imports the Firestore handle; the mocks
// must be registered before that module loads, so the builder is imported
// lazily below.
mock.module('server-only', { namedExports: {} });
mock.module(new URL('../firebase.ts', import.meta.url).href, { namedExports: { db: {} } });

import type { VenueHub, VenueHubTenantOverlay } from '../venue-hub';
import { renderedReadTime, BEFORE_YOU_GO_ORDER } from '../before-you-go';

const rows = async (hub: VenueHub, teamId: string) => (await import('../before-you-go-rows')).beforeYouGoRows(hub, teamId);

const overlay = (over: Partial<VenueHubTenantOverlay> = {}): VenueHubTenantOverlay => ({
  teamId: 'minnesota-wild', league: 'NHL', displayName: 'Wild', verified: true,
  gatesOpen: { ruleText: 'Doors open 90 minutes before puck drop', minutesBefore: 90 }, gateVariance: null, tailgateWindow: null, bagPolicyException: null,
  sources: { gatesOpen: 'https://x/gates' }, observedAtByField: { gatesOpen: '2026-10-10T12:00:00.000Z' }, fieldStates: { gatesOpen: 'rendered' },
  ...over,
});

/** A hub as the published view hands it over: every value present and
 *  sourced, so only the state and the date decide. */
const hub = (over: Partial<VenueHub> = {}): VenueHub => ({
  slug: 'xcel-energy-center', name: 'Grand Casino Arena', formerNames: [], city: 'St Paul', state: 'Minnesota', lat: 44.9, lng: -93.1, capacity: null,
  tenants: [{ teamId: 'minnesota-wild', league: 'NHL', tenantKey: 'minnesota-wild' }],
  parkingLots: [{ name: 'RiverCentre Ramp', notes: null }, { name: 'Lawson Ramp', notes: null }], parkingLotMapUrl: null, officialParkingUrls: ['https://x/official-parking'],
  publicTransit: { lines: ['Green Line'], notes: 'Green Line to Central Station, two blocks east.' }, rideshareDropoff: null, accessibility: null,
  bagMaxDimensions: { w: 12, h: 12, d: 6, unit: 'in' }, clearBagRequired: false, bagsProhibited: null, bagPolicyUrl: 'https://x/bag-policy', bagPolicyNotes: 'Small clutches only. Backpacks are not permitted.',
  tailgating: null, venueAccessRestrictions: null, nearby: null, outsideFoodAllowed: null, outsideFoodRules: null, food: null, photoUrl: null, photoAttribution: null,
  verified: true,
  observedAtByField: { bagMaxDimensions: '2026-10-07T14:30:16.621Z', clearBagRequired: '2026-10-07T14:30:16.621Z', bagPolicyNotes: '2026-10-07T14:30:16.621Z', parkingLots: '2026-10-08T09:00:00.000Z', publicTransit: '2026-10-09T09:00:00.000Z' },
  fieldStates: { bagMaxDimensions: 'rendered', clearBagRequired: 'rendered', bagPolicyNotes: 'rendered', parkingLots: 'rendered', publicTransit: 'rendered' },
  tenantOverlays: [overlay()],
  sources: { bagMaxDimensions: 'https://x/bag', clearBagRequired: 'https://x/bag', bagPolicyNotes: 'https://x/bag', parkingLots: 'https://x/parking', 'publicTransit.notes': 'https://x/transit', 'publicTransit.lines': 'https://x/transit' },
  ...over,
});

test('full: four rows in the venue page order, each with its own read time and the operator page', async () => {
  const out = await rows(hub(), 'minnesota-wild');
  assert.deepEqual(out.map((r) => r.key), [...BEFORE_YOU_GO_ORDER]);
  assert.deepEqual(out.map((r) => [r.label, r.text, r.observedOn, r.sourceUrl]), [
    ['Bag policy', 'Max bag 12" x 12" x 6".', 'Oct 7, 2026', 'https://x/bag'],
    ['Gates', 'Doors open 90 minutes before puck drop.', 'Oct 10, 2026', 'https://x/gates'],
    ['Transit', 'Green Line to Central Station, two blocks east. Lines: Green Line.', 'Oct 9, 2026', 'https://x/transit'],
    ['Parking', 'Lots: RiverCentre Ramp, Lawson Ramp.', 'Oct 8, 2026', 'https://x/parking'],
  ]);
  for (const r of out) {
    assert.ok(r.observedAt && !Number.isNaN(Date.parse(r.observedAt)), `${r.key}: ISO read time`);
    assert.ok(r.observedOn, `${r.key}: formatted read time`);
    assert.equal(r.sourceHost, 'x');
  }
});

test('(a) zero rendered fields: a legacy doc with values and sources but no state map yields no rows', async () => {
  assert.deepEqual(await rows(hub({ fieldStates: {}, tenantOverlays: [overlay({ fieldStates: {} })] }), 'minnesota-wild'), []);
  assert.deepEqual(await rows(hub({ fieldStates: {}, tenantOverlays: [overlay({ fieldStates: undefined })] }), 'minnesota-wild'), []);
});

test('(b) operator-conflict and held never render, pointer included; a sibling rendered field still does', async () => {
  const out = await rows(
    hub({
      fieldStates: { bagMaxDimensions: 'operator-conflict', clearBagRequired: 'rendered', bagPolicyNotes: 'held', parkingLots: 'held', publicTransit: 'operator-conflict' },
      tenantOverlays: [overlay({ fieldStates: { gatesOpen: 'held' } })],
    }),
    'minnesota-wild',
  );
  // The clear-bag boolean is the one rendered bag fact left, so it is the row;
  // the conflicted dimensions do not print, nor does the policy pointer stand
  // in for them.
  assert.deepEqual(out.map((r) => [r.key, r.text, r.sourceUrl]), [['bag', 'Clear bag not required.', 'https://x/bag']]);
  assert.ok(!out.some((r) => /12"/.test(r.text)), 'the conflicted dimensions never print');
  assert.ok(!out.some((r) => r.sourceUrl === 'https://x/bag-policy'), 'no pointer row for a conflicted claim');
  // A no-operator-page state is the same silence.
  assert.deepEqual(await rows(hub({ fieldStates: { parkingLots: 'no-operator-page' }, tenantOverlays: [] }), 'minnesota-wild'), []);
});

test('(c) a rendered field with no read time yields no row; a read time that does not parse is no read time', async () => {
  const out = await rows(hub({ observedAtByField: { bagMaxDimensions: '2026-10-07T14:30:16.621Z', parkingLots: 'yesterday' }, tenantOverlays: [overlay({ observedAtByField: {} })] }), 'minnesota-wild');
  assert.deepEqual(out.map((r) => r.key), ['bag']);
  assert.equal(renderedReadTime({ parkingLots: 'rendered' }, { parkingLots: 'yesterday' }, 'parkingLots'), null);
  assert.equal(renderedReadTime({ parkingLots: 'rendered' }, {}, 'parkingLots'), null);
  assert.equal(renderedReadTime({ parkingLots: 'held' }, { parkingLots: '2026-10-08T09:00:00.000Z' }, 'parkingLots'), null);
  assert.equal(renderedReadTime({ parkingLots: 'rendered' }, { parkingLots: '2026-10-08T09:00:00.000Z' }, 'parkingLots'), '2026-10-08T09:00:00.000Z');
  // Dotted sub-keys count for both maps.
  assert.equal(renderedReadTime({ 'gatesOpen.ruleText': 'rendered' }, { 'gatesOpen.ruleText': '2026-10-10T12:00:00.000Z' }, 'gatesOpen', 'ruleText'), '2026-10-10T12:00:00.000Z');
});

test('bag precedence and links: a prohibition first, then the size (clear bag only when that claim is rendered), then the boolean, then the notes; the class pointer when the field has no source', async () => {
  const prohibited = await rows(hub({ bagsProhibited: true, fieldStates: { bagsProhibited: 'rendered', bagMaxDimensions: 'rendered' }, observedAtByField: { bagsProhibited: '2026-10-01T00:00:00.000Z', bagMaxDimensions: '2026-10-07T00:00:00.000Z' }, sources: {}, tenantOverlays: [] }), 'minnesota-wild');
  assert.deepEqual(prohibited.map((r) => [r.text, r.observedOn, r.sourceUrl]), [['Bags are not allowed.', 'Oct 1, 2026', 'https://x/bag-policy']]);
  const clear = await rows(hub({ clearBagRequired: true, fieldStates: { bagMaxDimensions: 'rendered', clearBagRequired: 'rendered' } }), 'minnesota-wild');
  assert.equal(clear[0].text, 'Clear bag 12" x 12" x 6".');
  // The clear-bag claim in conflict (the value is nulled upstream): the size alone.
  const conflict = await rows(hub({ clearBagRequired: null, fieldStates: { bagMaxDimensions: 'rendered', clearBagRequired: 'operator-conflict' } }), 'minnesota-wild');
  assert.equal(conflict[0].text, 'Max bag 12" x 12" x 6".');
  const notes = await rows(hub({ bagMaxDimensions: null, clearBagRequired: null, fieldStates: { bagPolicyNotes: 'rendered' }, tenantOverlays: [] }), 'minnesota-wild');
  assert.deepEqual(notes.map((r) => r.text), ['Small clutches only.']);
  // Parking with no field source falls back to the official parking page.
  const parking = await rows(hub({ fieldStates: { parkingLots: 'rendered' }, sources: {}, tenantOverlays: [] }), 'minnesota-wild');
  assert.deepEqual(parking.map((r) => [r.key, r.sourceUrl, r.sourceHost]), [['parking', 'https://x/official-parking', 'x']]);
});

test('gates are this team\'s overlay only; another tenant\'s rendered rule is not this page\'s', async () => {
  const shared = hub({ fieldStates: {}, tenantOverlays: [overlay({ teamId: 'minnesota-lynx', displayName: 'Lynx' }), overlay({ fieldStates: {} })] });
  assert.deepEqual(await rows(shared, 'minnesota-wild'), []);
  assert.deepEqual((await rows(shared, 'minnesota-lynx')).map((r) => [r.key, r.text]), [['gates', 'Doors open 90 minutes before puck drop.']]);
  // An overlay whose source is not a URL links nothing but still prints the date.
  const unlinked = await rows(hub({ fieldStates: {}, tenantOverlays: [overlay({ sources: { gatesOpen: 'team press release' } })] }), 'minnesota-wild');
  assert.deepEqual(unlinked.map((r) => [r.key, r.sourceUrl, r.observedOn]), [['gates', null, 'Oct 10, 2026']]);
});
