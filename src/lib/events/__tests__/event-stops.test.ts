// Event stops, the server half (Phase 2, 2026-11-18): the mapper is the gate
// and the floor is the web's own predicates. The stop below is the stored
// shape of eventStops/monster-jam~us-bank-stadium on 2026-11-18.
import { test, mock } from 'node:test';
import assert from 'node:assert/strict';

mock.module('server-only', { namedExports: {} });
mock.module(new URL('../../firebase.ts', import.meta.url).href, { namedExports: { db: {} } });

import type { VenueHub as Hub } from '../../venue-hub';
// Loaded inside each test, after the mocks above are registered (the repo's
// pattern for a module that imports server-only and the Firestore client).
const load = () => import('../event-stops');
type Mod = Awaited<ReturnType<typeof load>>;

const STOP_DOC = {
  show: 'monster-jam', venueHubId: 'us-bank-stadium', pageSlug: 'us-bank-stadium', previousSlugs: [], searchCity: 'Minneapolis', timezone: 'America/Chicago',
  tnVenueId: '22700', tnVenueName: 'US Bank Stadium', tombstoned: false, tombstonedAt: null,
  sources: { performances: 'https://www.ticketnetwork.com/performers/monster-jam-2541/venues/minneapolis-us-bank-stadium-22700', eventIds: 'impact-catalog:1872' },
  observedAtByField: { performances: '2026-11-18T16:29:40.000Z', eventIds: '2026-11-18T16:29:30.877Z' },
  bagPolicy: { mode: 'pointer', sourceUrl: 'https://www.usbankstadium.com/plan-your-visit/safety' },
  eventPolicies: {
    bagRule: null, doorsTime: null, childTicket: null, reEntry: null,
    pitParty: [{ performance: '2027-02-20T1700', start: '12:30', end: '15:30', quote: 'Pit Party open from 12:30 p.m. - 3:30 p.m.', context: 'Saturday, February 20, 2027', sourceUrl: 'https://www.usbankstadium.com/news/detail/get-ready', observedAt: '2026-11-18T13:55:21.901Z', visitId: '2027-02-20' }],
  },
  updatedAt: '2026-11-18T16:38:38.500Z',
};
const VISIT = { id: '2027-02-20', data: { visitId: '2027-02-20', startDate: '2027-02-20', endDate: '2027-02-21', season: 2027, tourName: null, lineup: null, lineupObservedAt: null, sourceUrl: 'https://www.usbankstadium.com/events/detail/monster-jam-10', sourceReadAt: '2026-11-18T13:55:11.703Z' } };
const perfDoc = (date: string, time: string, eventId: number, over: Record<string, unknown> = {}) => ({
  id: `${date}T${time.replace(':', '')}`,
  data: { date, startTime: time, utcOffset: '-06:00', startsAt: `${date}T${time}:00-06:00`, timezone: 'America/Chicago', visitId: '2027-02-20', doorsTime: null, pitParty: null, tombstoned: false, tombstonedAt: null, providerEvents: { ticketnetwork: { eventId, eventDate: date, status: 'onsale', observedAt: '2026-11-18T16:29:40.000Z' } }, ...over },
});
const PERFS = [perfDoc('2027-02-20', '17:00', 8258515), perfDoc('2027-02-21', '15:00', 8258516)];
const mapWith = (m: Mod) => (doc: Record<string, unknown> = STOP_DOC, perfs = PERFS, visits = [VISIT]) => m.mapEventStop('monster-jam~us-bank-stadium', doc, visits, perfs);

test('the mapper copies named fields only: quotes, contexts, provider read times and source ids never reach a page', async () => {
  const m = await load();
  const { mapEventStop, mapEventPerformance, mapEventVisit, eventFloorOf } = m;
  const map = mapWith(m);
  void mapEventStop; void mapEventPerformance; void mapEventVisit; void eventFloorOf; void map;
  const stop = map()!;
  assert.deepEqual(Object.keys(stop).sort(), ['bagPolicy', 'bagRules', 'gateTimes', 'hubId', 'performances', 'pitParty', 'previousSlugs', 'reEntry', 'searchCity', 'show', 'timezone', 'tombstoned', 'updatedAt', 'venueSlug', 'visits']);
  assert.deepEqual(stop.pitParty, [{ visitId: '2027-02-20', sourceUrl: 'https://www.usbankstadium.com/news/detail/get-ready', observedAt: '2026-11-18T13:55:21.901Z', performance: '2027-02-20T1700', start: '12:30', end: '15:30' }]);
  assert.deepEqual(stop.performances[0], { key: '2027-02-20T1700', date: '2027-02-20', startTime: '17:00', startsAt: '2027-02-20T17:00:00-06:00', visitId: '2027-02-20', status: 'onsale', tnEventId: 8258515 });
  assert.deepEqual(stop.visits, [{ visitId: '2027-02-20', startDate: '2027-02-20', endDate: '2027-02-21' }]);
  assert.deepEqual(stop.bagPolicy, { mode: 'pointer', sourceUrl: 'https://www.usbankstadium.com/plan-your-visit/safety' });
  const wire = JSON.stringify(stop);
  for (const hidden of ['Pit Party open from', 'Saturday, February 20, 2027', 'impact-catalog', 'tnVenueId', '22700', 'minneapolis-us-bank-stadium', 'lineup', 'sourceReadAt', 'observedAtByField']) assert.equal(wire.includes(hidden), false, hidden);
  // A key the mapper does not name, of any kind, is not carried.
  const extra = map({ ...STOP_DOC, priceRange: '$55.20 to $3006.10', imageUrl: 'https://maps.seatics.com/x.png', internalNote: 'do not publish' })!;
  assert.equal(/55\.20|seatics|do not publish/.test(JSON.stringify(extra)), false);
});

test('the mapper refuses what the write guard refuses: a doc that is not a stop of a known show, and a row that disagrees with itself', async () => {
  const m = await load();
  const { mapEventStop, mapEventPerformance, mapEventVisit, eventFloorOf } = m;
  const map = mapWith(m);
  void mapEventStop; void mapEventPerformance; void mapEventVisit; void eventFloorOf; void map;
  assert.equal(mapEventStop('monster-jam~us-bank-stadium', { ...STOP_DOC, show: 'disney-on-ice' }, [VISIT], PERFS), null);
  assert.equal(mapEventStop('monster-jam~ford-field', STOP_DOC, [VISIT], PERFS), null, 'the doc id is not show~hub');
  assert.equal(map({ ...STOP_DOC, pageSlug: 'US Bank' }), null);
  assert.equal(map({ ...STOP_DOC, searchCity: '' }), null);
  assert.equal(map({ ...STOP_DOC, timezone: null }), null);
  const bad = (over: Record<string, unknown>, id = '2027-02-20T1700') => mapEventPerformance(id, { ...PERFS[0].data, ...over });
  assert.equal(bad({ tombstoned: true }), null);
  assert.equal(bad({ startTime: '17:30' }), null, 'the doc id is not the row');
  assert.equal(bad({ startsAt: '2027-02-20T18:00:00-06:00' }), null);
  assert.equal(bad({ startsAt: '2027-02-20 5pm' }), null);
  assert.equal(bad({}, '2027-02-20'), null);
  // An id that is not this date's event, or not a number, yields a row with no link (never a guess).
  assert.equal(bad({ providerEvents: { ticketnetwork: { eventId: 8258515, eventDate: '2027-02-21', status: 'onsale' } } })?.tnEventId, null);
  assert.equal(bad({ providerEvents: { ticketnetwork: { eventId: '8258515', eventDate: '2027-02-20', status: 'onsale' } } })?.tnEventId, null);
  assert.equal(bad({ providerEvents: { ticketnetwork: { eventId: 8258515, eventDate: '2027-02-20', status: 'cheap' } } })?.status, 'unknown');
  assert.equal(bad({ providerEvents: null })?.status, 'unknown');
  assert.equal(mapEventVisit('2027-02-20', { startDate: '2027-02-20', endDate: 'soon' }), null);
  assert.equal(mapEventVisit('2027-02-20', { ...VISIT.data, tombstoned: true }), null);
  // A tombstoned performance is not a row; a tombstoned stop is still mapped (its page says removed).
  assert.deepEqual(map(STOP_DOC, [PERFS[0], perfDoc('2027-02-21', '15:00', 8258516, { tombstoned: true })])!.performances.map((p) => p.key), ['2027-02-20T1700']);
  assert.equal(map({ ...STOP_DOC, tombstoned: true })!.tombstoned, true);
});

test('nothing from the tour operator, and no rule without its quote, reaches a page', async () => {
  const m = await load();
  const { mapEventStop, mapEventPerformance, mapEventVisit, eventFloorOf } = m;
  const map = mapWith(m);
  void mapEventStop; void mapEventPerformance; void mapEventVisit; void eventFloorOf; void map;
  const pit = STOP_DOC.eventPolicies.pitParty[0];
  const withPit = (over: Record<string, unknown>) => map({ ...STOP_DOC, eventPolicies: { ...STOP_DOC.eventPolicies, pitParty: [{ ...pit, ...over }] } })!.pitParty;
  assert.equal(withPit({}).length, 1);
  for (const over of [{ sourceUrl: 'https://www.monsterjam.com/en-us/events/minneapolis-mn' }, { sourceUrl: 'https://www.monsterjam.co.uk/x' }, { sourceUrl: 'https://tickets.feldentertainment.com/x' }, { sourceUrl: 'http://www.usbankstadium.com/news' }, { quote: '' }, { observedAt: null }, { end: '11:00' }, { performance: 'Saturday' }, { visitId: null }]) assert.deepEqual(withPit(over), [], JSON.stringify(over));
  const bag = (bagPolicy: unknown) => map({ ...STOP_DOC, bagPolicy })!.bagPolicy;
  const rule = { mode: 'rule', rule: { text: 'No bags at any event.' }, quote: 'A No Bag policy is in effect for all events.', sourceUrl: 'https://raymondjamesstadium.com/stadium-policies', observedAt: '2026-11-17T18:49:25.297Z' };
  assert.deepEqual(bag(rule), { mode: 'rule', text: 'No bags at any event.', sourceUrl: 'https://raymondjamesstadium.com/stadium-policies', observedAt: '2026-11-17T18:49:25.297Z' });
  // A rule with no quote behind it degrades to the pointer; so does an other-event rule with no caveat.
  assert.deepEqual(bag({ ...rule, quote: undefined }), { mode: 'pointer', sourceUrl: 'https://raymondjamesstadium.com/stadium-policies' });
  assert.deepEqual(bag({ ...rule, mode: 'other-event-rule' }), { mode: 'pointer', sourceUrl: 'https://raymondjamesstadium.com/stadium-policies' });
  assert.equal(bag({ ...rule, mode: 'other-event-rule', caveat: 'Varies per event.' })?.mode, 'other-event-rule');
  assert.equal(bag({ mode: 'pointer', sourceUrl: 'https://www.monsterjam.com/bags' }), null);
  assert.equal(bag({ ...rule, rule: { text: 'See monsterjam.com for the bag policy.' } })?.mode, 'pointer');
  assert.equal(bag(null), null);
});

// ── the floor ───────────────────────────────────────────────────────────────
const hub = (over: Partial<Hub> = {}): Hub => ({
  slug: 'test-arena', name: 'Test Arena', formerNames: [], city: 'Springfield', state: 'Illinois', lat: 39.8, lng: -89.6, capacity: null, tenants: [],
  parkingLots: [{ name: 'Lot A', notes: 'North of the arena.' }], parkingNotes: null, parkingLotMapUrl: null, officialParkingUrls: [],
  publicTransit: { lines: ['Red Line'], notes: null }, rideshareDropoff: null, accessibility: null,
  bagMaxDimensions: null, clearBagRequired: true, bagsProhibited: null, bagPolicyUrl: 'https://arena.example/bags', bagPolicyNotes: null,
  tailgating: null, venueAccessRestrictions: null, nearby: null, outsideFoodAllowed: null, outsideFoodRules: null, food: null, photoUrl: null, photoAttribution: null,
  verified: true, observedAtByField: {}, fieldStates: {}, tenantOverlays: [],
  sources: { clearBagRequired: 'https://arena.example/bags', parkingLots: 'https://arena.example/parking', 'publicTransit.lines': 'https://transit.example/red' },
  ...over,
} as unknown as Hub);

test('the floor: verified, indexable, a sourced bag claim, and a sourced parking or transit claim; a pointer link never counts', async () => {
  const m = await load();
  const { mapEventStop, mapEventPerformance, mapEventVisit, eventFloorOf } = m;
  const map = mapWith(m);
  void mapEventStop; void mapEventPerformance; void mapEventVisit; void eventFloorOf; void map;
  const ok = eventFloorOf(hub());
  assert.equal(ok.bag, true);
  assert.equal(ok.ok, ok.parking || ok.transit);
  assert.equal(eventFloorOf(null).ok, false);
  assert.equal(eventFloorOf(hub({ verified: false })).ok, false);
  assert.equal(eventFloorOf(hub({ lat: null })).ok, false, 'not indexable without coordinates');
  // The known-bad input: the only bag answer is the link to the operator's page.
  const pointerOnly = eventFloorOf(hub({ clearBagRequired: null }));
  assert.deepEqual([pointerOnly.bag, pointerOnly.ok], [false, false]);
  // A parking map link and an official parking page are pointers too.
  const noLots = eventFloorOf(hub({ parkingLots: [], parkingLotMapUrl: 'https://arena.example/map.pdf', officialParkingUrls: ['https://arena.example/parking'], publicTransit: null }));
  assert.deepEqual([noLots.parking, noLots.transit, noLots.ok], [false, false, false]);
});
