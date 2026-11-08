// Vendor direction (owner ruling 2026-11-08): where the operator's parking page names
// no lots and sends fans to a vendor, every surface prints the same sentence,
// "No venue lots; {Arena} directs fans to {vendor}.", with the operator link and the
// read date where the surface shows one. Lots always win. Surfaces: the promo page's
// Before you go row, the quick-facts card, the venue page's parking card and the team
// page's parking row (the last two share parkingLotsModel).
import { test, mock } from 'node:test';
import assert from 'node:assert/strict';
import { renderToStaticMarkup } from 'react-dom/server';

mock.module('server-only', { namedExports: {} });
mock.module(new URL('../../../lib/firebase.ts', import.meta.url).href, { namedExports: { db: {} } });

import type { VenueHub } from '../../../lib/venue-hub';
import { parseParkingNotes, vendorParkingSentence } from '../../../lib/parking-vendor';

const OP = 'https://www.golden1center.com/visit/directions-and-parking';
const SENTENCE = 'No venue lots; Golden 1 Center directs fans to SacPark.';
const decode = (s: string) => s.replace(/&amp;/g, '&').replace(/&#x27;/g, "'").replace(/&quot;/g, '"');

const hub = (over: Partial<VenueHub> = {}): VenueHub => ({
  slug: 'golden-1-center', name: 'Golden 1 Center', formerNames: [], city: 'Sacramento', state: 'California', lat: 38.58, lng: -121.5, capacity: null,
  tenants: [{ teamId: 'sacramento-kings', league: 'NBA', tenantKey: 'sacramento-kings' }],
  parkingLots: [], parkingNotes: { vendor: 'SacPark', quote: 'We recommend purchasing pre-paid parking passes online through the City of Sacramento via the SacPark website.' },
  parkingLotMapUrl: null, officialParkingUrls: [],
  publicTransit: null, rideshareDropoff: null, accessibility: null,
  bagMaxDimensions: { w: 8, h: 6, d: 1, unit: 'in' }, clearBagRequired: null, bagsProhibited: false, bagPolicyUrl: 'https://www.golden1center.com/faqs', bagPolicyNotes: null,
  tailgating: null, venueAccessRestrictions: null, nearby: null, outsideFoodAllowed: null, outsideFoodRules: null, food: null, photoUrl: null, photoAttribution: null,
  verified: true,
  observedAtByField: { bagMaxDimensions: '2026-10-07T14:21:01.107Z', parkingNotes: '2026-11-08T16:11:04.591Z' },
  fieldStates: { bagMaxDimensions: 'rendered', parkingNotes: 'rendered' },
  tenantOverlays: [],
  sources: { bagMaxDimensions: 'https://www.golden1center.com/faqs', parkingNotes: OP } as VenueHub['sources'],
  ...over,
});
const withLots = (): Partial<VenueHub> => ({
  parkingLots: [{ name: 'Lot A', notes: 'Opens two hours before.' }],
  observedAtByField: { bagMaxDimensions: '2026-10-07T14:21:01.107Z', parkingNotes: '2026-11-08T16:11:04.591Z', parkingLots: '2026-11-08T16:11:04.591Z' },
  fieldStates: { bagMaxDimensions: 'rendered', parkingNotes: 'rendered', parkingLots: 'rendered' },
  sources: { bagMaxDimensions: 'https://www.golden1center.com/faqs', parkingNotes: OP, parkingLots: OP } as VenueHub['sources'],
});

test('the sentence and the stored shape', () => {
  assert.equal(vendorParkingSentence('Golden 1 Center', 'SacPark'), SENTENCE);
  assert.deepEqual(parseParkingNotes({ vendor: ' SpotHero ', quote: 'Using SpotHero.' }), { vendor: 'SpotHero', quote: 'Using SpotHero.' });
  assert.equal(parseParkingNotes({ vendor: 'SpotHero' }), null);
  assert.equal(parseParkingNotes('SpotHero'), null);
});

test('PROMO PAGE, Before you go: the vendor row with the operator link and the read date', async () => {
  const { beforeYouGoRows } = await import('../../../lib/before-you-go-rows');
  const row = beforeYouGoRows(hub(), 'sacramento-kings').find((r) => r.key === 'parking');
  assert.ok(row, 'a parking row');
  assert.equal(row.text, SENTENCE);
  assert.equal(row.sourceUrl, OP);
  assert.equal(row.observedOn, 'Nov 8, 2026');
  // A direction with no read time is not a provenance row.
  const undated = beforeYouGoRows(hub({ observedAtByField: { bagMaxDimensions: '2026-10-07T14:21:01.107Z' } }), 'sacramento-kings').find((r) => r.key === 'parking');
  assert.equal(undated, undefined);
});

test('QUICK FACTS: the same sentence, linked to the operator page', async () => {
  const { buildCondensedLogistics } = await import('../../../lib/venue-hub-condensed');
  const line = buildCondensedLogistics(hub(), 'sacramento-kings').find((l) => l.key === 'parking');
  assert.ok(line);
  assert.equal(line.text, SENTENCE);
  assert.equal(line.href, OP);
  // No provenance for the direction: it is not printed.
  const unsourced = buildCondensedLogistics(hub({ sources: { bagMaxDimensions: 'https://www.golden1center.com/faqs' } as VenueHub['sources'] }), 'sacramento-kings').find((l) => l.key === 'parking');
  assert.equal(unsourced, undefined);
});

test('VENUE PAGE and TEAM PAGE: the parking card and row print the same sentence with its source line', async () => {
  const { parkingLotsModel, ParkingLotsCard } = await import('../venue-logistics');
  const { teamVenueRows } = await import('../TeamVenueFacts');
  const m = parkingLotsModel(hub());
  assert.ok(m);
  assert.equal(m.vendorSentence, SENTENCE);
  assert.equal(m.sourceUrl, OP);
  const card = decode(renderToStaticMarkup(<ParkingLotsCard hub={hub()} />));
  assert.ok(card.includes(SENTENCE), 'the venue card prints the sentence');
  assert.ok(card.includes('golden1center.com'), 'with the operator source');
  const row = teamVenueRows(hub(), 'sacramento-kings').find((r) => r.label === 'Parking');
  assert.ok(row);
  assert.ok(decode(renderToStaticMarkup(<>{row.body}</>)).includes(SENTENCE), 'the team page row prints the sentence');
  // An unverified building prints nothing here (the doc-level gate).
  assert.equal(parkingLotsModel(hub({ verified: false })), null);
});

test('LOTS WIN: with lots and a vendor direction both present, every surface prints the lots only', async () => {
  const { beforeYouGoRows } = await import('../../../lib/before-you-go-rows');
  const { buildCondensedLogistics } = await import('../../../lib/venue-hub-condensed');
  const { parkingLotsModel, ParkingLotsCard } = await import('../venue-logistics');
  const h = hub(withLots());
  assert.equal(beforeYouGoRows(h, 'sacramento-kings').find((r) => r.key === 'parking')?.text, 'Lots: Lot A.');
  assert.equal(buildCondensedLogistics(h, 'sacramento-kings').find((l) => l.key === 'parking')?.text, 'Lots: Lot A.');
  assert.equal(parkingLotsModel(h)?.vendorSentence, null);
  const card = decode(renderToStaticMarkup(<ParkingLotsCard hub={h} />));
  assert.ok(card.includes('Lot A.') && !card.includes('directs fans to'));
});

test('PUBLISHED VIEW: the doc-level verified flag and provenance null the direction like any claim', async () => {
  const { publishedView } = await import('../../../lib/venue-published-view');
  assert.deepEqual(publishedView(hub()).parkingNotes, hub().parkingNotes);
  assert.equal(publishedView(hub({ verified: false })).parkingNotes, null);
  assert.equal(publishedView(hub({ sources: { bagMaxDimensions: 'https://www.golden1center.com/faqs' } as VenueHub['sources'] })).parkingNotes, null);
});
