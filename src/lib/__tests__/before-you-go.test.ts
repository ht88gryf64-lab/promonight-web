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
import type { CondensedLine } from '../venue-hub-condensed';
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

// ── the union (ruling 2026-11-08) ────────────────────────────────────────────
const union = async (h: VenueHub, teamId: string, lines: CondensedLine[]) => (await import('../before-you-go-rows')).beforeYouGoUnion(h, teamId, lines);
const line = (key: CondensedLine['key'], label: string, text: string, href: string | null = null): CondensedLine => ({ key, label, text, href, hrefLabel: href ? 'Official' : null });
/** The card's lines for the default hub, in the condensed builder's order. */
const CARD: CondensedLine[] = [
  line('gates', 'Gates', 'Doors open 90 minutes before puck drop.'),
  line('bag', 'Bag policy', 'Max bag 12" x 12" x 6".', 'https://x/bag-policy'),
  line('parking', 'Parking', 'Lots: RiverCentre Ramp, Lawson Ramp.', 'https://x/official-parking'),
  line('transit', 'Transit', 'Green Line to Central Station, two blocks east. Lines: Green Line.'),
  line('outsideFood', 'Outside food', 'No outside food or drink.'),
];

test('union: provenance rows first in their order, then the card classes not already present, undated, with the card link or the record URL; a class in both is the provenance row only', async () => {
  // Bag and parking dated; transit never stated; the overlay undated. The
  // card shows all five classes.
  const h = hub({
    fieldStates: { bagMaxDimensions: 'rendered', clearBagRequired: 'rendered', parkingLots: 'rendered' },
    observedAtByField: { bagMaxDimensions: '2026-10-07T14:30:16.621Z', clearBagRequired: '2026-10-07T14:30:16.621Z', parkingLots: '2026-10-08T09:00:00.000Z' },
    tenantOverlays: [overlay({ observedAtByField: {} })],
    sources: { bagMaxDimensions: 'https://x/bag', clearBagRequired: 'https://x/bag', parkingLots: 'https://x/parking', 'publicTransit.notes': 'https://x/transit', outsideFoodAllowed: 'https://x/food' },
  });
  const out = await union(h, 'minnesota-wild', CARD);
  assert.deepEqual(out.map((r) => [r.key, r.observedOn, r.sourceUrl]), [
    ['bag', 'Oct 7, 2026', 'https://x/bag'],
    ['parking', 'Oct 8, 2026', 'https://x/parking'],
    // The card's order for the rest: gates, transit, outside food.
    ['gates', null, 'https://x/gates'],
    ['transit', null, 'https://x/transit'],
    ['outsideFood', null, 'https://x/food'],
  ]);
  assert.equal(new Set(out.map((r) => r.key)).size, out.length, 'nothing twice');
  // The provenance row's text and date win over the card's line for the same class.
  assert.equal(out[0].text, 'Max bag 12" x 12" x 6".');
  assert.ok(out.slice(2).every((r) => r.observedAt === null && r.observedOn === null), 'union rows carry no read time');
  assert.deepEqual(out.map((r) => r.label), ['Bag policy', 'Parking', 'Gates', 'Transit', 'Outside food']);
});

test('union: the card link stands when the card had one; a class with neither a card link nor a record URL links nothing; keys the block does not carry are dropped', async () => {
  const h = hub({ fieldStates: { parkingLots: 'rendered' }, observedAtByField: { parkingLots: '2026-10-08T09:00:00.000Z' }, tenantOverlays: [], sources: { parkingLots: 'https://x/parking' } });
  const out = await union(h, 'minnesota-wild', [
    line('bag', 'Bag policy', 'See the official bag policy.', 'https://x/bag-policy'),
    line('outsideFood', 'Outside food', 'No outside food or drink.'),
    { key: 'rideshare', label: 'Rideshare', text: 'Drop-off on 7th.', href: null, hrefLabel: null },
  ]);
  assert.deepEqual(out.map((r) => [r.key, r.observedOn, r.sourceUrl, r.sourceHost]), [
    ['parking', 'Oct 8, 2026', 'https://x/parking', 'x'],
    ['bag', null, 'https://x/bag-policy', 'x'],
    ['outsideFood', null, null, null],
  ]);
});

test('union: no provenance row, no block, whatever the card shows (the view falls back to the card)', async () => {
  assert.deepEqual(await union(hub({ fieldStates: {}, tenantOverlays: [] }), 'minnesota-wild', CARD), []);
  assert.deepEqual(await union(hub({ fieldStates: { parkingLots: 'held', bagMaxDimensions: 'operator-conflict' }, tenantOverlays: [] }), 'minnesota-wild', CARD), []);
});
