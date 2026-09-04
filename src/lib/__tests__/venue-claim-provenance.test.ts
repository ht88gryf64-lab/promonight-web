// Per-claim provenance and the four field states.
//
// Before wave 2 a venue page printed a fact with no way to check it and a
// hub-level verified flag that said nothing about WHICH fact was checked or
// WHEN. These pin the three rules that replaced that: a claim renders with its
// own source and its own date, a nulled claim explains itself instead of
// vanishing, and a held claim renders nothing at all.
import { test, mock } from 'node:test';
import assert from 'node:assert';

mock.module('server-only', { namedExports: {} });
mock.module(new URL('../firebase.ts', import.meta.url).href, { namedExports: { db: {} } });

import type { VenueHub } from '../venue-hub';
import {
  CLAIM_STATE_REASON,
  claimRow,
  claimSourceHost,
  claimSourceUrl,
  claimState,
  claimSourceReadOn,
} from '../venue-claim';

const load = () => import('../venue-hub');
const SRC = 'https://www.operator.example.com/policies';
const FAQ = 'https://www.operator.example.com/arena-faq';

const facts = (over: Partial<Pick<VenueHub, 'sources' | 'fieldStates' | 'observedAtByField'>> = {}) => ({
  sources: { bagPolicyNotes: SRC, parkingLots: SRC, 'publicTransit.lines': SRC, rideshareDropoff: SRC },
  fieldStates: {},
  observedAtByField: { bagPolicyNotes: '2026-09-04T01:07:18.000Z', parkingLots: '2026-08-01T00:00:00.000Z' },
  ...over,
}) as Pick<VenueHub, 'sources' | 'fieldStates' | 'observedAtByField'>;

test('a rendered claim carries its own source and its own date', () => {
  const f = facts({ fieldStates: { bagPolicyNotes: 'rendered' } });
  const row = claimRow(f, 'bagPolicyNotes', true);
  assert.equal(row.show, true);
  assert.equal(row.reason, null);
  assert.equal(row.sourceUrl, SRC);
  assert.equal(row.verifiedOn, 'Sep 4, 2026');
  // Two fields checked in different waves keep different dates: the whole point
  // of a per-field map is that a page cannot print one date for everything.
  assert.equal(claimSourceReadOn(f, 'parkingLots'), 'Aug 1, 2026');
  assert.notEqual(claimSourceReadOn(f, 'bagPolicyNotes'), claimSourceReadOn(f, 'parkingLots'));
  assert.equal(claimSourceHost(SRC), 'operator.example.com');
});

test('a date never falls back to anything: no per-field entry means no date printed', () => {
  const f = facts({ observedAtByField: {} });
  assert.equal(claimSourceReadOn(f, 'bagPolicyNotes'), null);
  assert.equal(claimRow(f, 'bagPolicyNotes', true).verifiedOn, null);
  assert.equal(claimSourceReadOn(facts({ observedAtByField: { bagPolicyNotes: 'not-a-date' } }), 'bagPolicyNotes'), null);
});

test('operator-conflict shows the reason and keeps the pointer, and never the claim', () => {
  const f = facts({ fieldStates: { rideshareDropoff: 'operator-conflict' } });
  const row = claimRow(f, 'rideshareDropoff', true);
  assert.equal(row.show, false, 'a conflicted field must not render its claim even when the old gate would allow it');
  assert.equal(row.reason, 'The operator publishes conflicting answers.');
  assert.equal(row.sourceUrl, SRC, 'the pointer stays so a reader can go read the operator');
  assert.equal(row.verifiedOn, null);
});

test('no-operator-page shows the reason and no pointer', () => {
  const f = facts({ fieldStates: { rideshareDropoff: 'no-operator-page' } });
  const row = claimRow(f, 'rideshareDropoff', true);
  assert.equal(row.show, false);
  assert.equal(row.reason, 'No official policy page found.');
  assert.equal(row.sourceUrl, null);
});

test('held renders nothing at all: no claim, no reason, no pointer', () => {
  const f = facts({ fieldStates: { publicTransit: 'held' } });
  const row = claimRow(f, 'publicTransit', true);
  assert.deepEqual(row, { show: false, reason: null, sourceUrl: null, verifiedOn: null });
  // ball-arena's shape: transit has no URL of its own, so a pointer-based test
  // never sees it. The state does.
  assert.equal(claimState(f, 'publicTransit'), 'held');
});

test('a legacy doc with no state map leaves the old gates in charge', () => {
  const f = facts();
  assert.equal(claimState(f, 'bagPolicyNotes'), null);
  assert.equal(claimRow(f, 'bagPolicyNotes', true).show, true);
  assert.equal(claimRow(f, 'bagPolicyNotes', false).show, false, 'the state map can never grant a row the old gate refused');
});

test('a claim sourced to two operator pages links the first', () => {
  const f = facts({ sources: { bagPolicyNotes: [SRC, FAQ] as unknown as string } });
  assert.equal(claimSourceUrl(f, 'bagPolicyNotes'), SRC);
  assert.equal(CLAIM_STATE_REASON['operator-conflict'], 'The operator publishes conflicting answers.');
});

// ── the mapper gate ─────────────────────────────────────────────────────────

test('the mapper nulls a field whose state is not rendered, whatever the doc stores', async () => {
  const { toVenueHub } = await load();
  const mapped = toVenueHub(
    'x-arena',
    {
      name: 'X Arena',
      publicTransit: { lines: ['Line 2'], notes: 'Held text that must never reach a page.' },
      rideshareDropoff: 'Conflicted street address.',
      bagPolicyNotes: 'A real bag rule.',
      sources: { bagPolicyNotes: SRC, publicTransit: SRC },
      fieldStates: { publicTransit: 'held', rideshareDropoff: 'operator-conflict', bagPolicyNotes: 'rendered' },
      observedAtByField: { bagPolicyNotes: '2026-09-04T01:07:18.000Z' },
      verified: true,
    },
    [],
  );
  assert.equal(mapped.publicTransit, null, 'a held value must not survive the mapper');
  assert.equal(mapped.rideshareDropoff, null, 'a conflicted value must not survive the mapper');
  assert.equal(mapped.bagPolicyNotes, 'A real bag rule.');
  assert.equal(mapped.fieldStates.publicTransit, 'held');
  assert.equal(mapped.observedAtByField.bagPolicyNotes, '2026-09-04T01:07:18.000Z');
});

test('the mapper drops a state value it does not understand rather than trusting it', async () => {
  const { fieldStateMap } = await load();
  assert.deepEqual(fieldStateMap({ a: 'rendered', b: 'pointer-only', c: 'held', d: 7 }), { a: 'rendered', c: 'held' });
  assert.deepEqual(fieldStateMap(undefined), {});
  assert.deepEqual(fieldStateMap(['rendered']), {});
});

// ── the title and the rail card stop promising what the doc does not carry ───

const titleHub = (over: Partial<VenueHub> = {}): VenueHub => ({
  slug: 'x-arena', name: 'X Arena', city: 'Town', state: 'ST', lat: 1, lng: 2, capacity: 5,
  tenants: [{ teamId: 'x', league: 'NHL', tenantKey: 'x' }],
  parkingLots: [{ name: 'Lot A', notes: 'Opens early.' }], parkingLotMapUrl: null, officialParkingUrls: [],
  publicTransit: null, rideshareDropoff: null, accessibility: null,
  bagMaxDimensions: { w: 6, h: 4, d: 1.5, unit: 'in' }, clearBagRequired: false, bagsProhibited: null,
  bagPolicyUrl: 'https://www.operator.example.com/policies', bagPolicyNotes: 'Small bags only.',
  tailgating: null, venueAccessRestrictions: null, nearby: null,
  outsideFoodAllowed: null, outsideFoodRules: null, food: null,
  photoUrl: null, photoAttribution: null, verified: true,
  observedAtByField: {}, fieldStates: {},
  tenantOverlays: [],
  sources: { bagMaxDimensions: SRC, clearBagRequired: SRC, bagPolicyNotes: SRC, parkingLots: SRC },
  ...over,
}) as VenueHub;

test('the title names only the topics the building publishes', async () => {
  const { venueHubTitle } = await load();
  // Bag and parking, no gates, no food: the old template said "Bag Policy,
  // Parking & Food" on every building in the corpus.
  const t = venueHubTitle(titleHub());
  assert.ok(/Bag Policy/.test(t) && /Parking/.test(t), t);
  assert.ok(!/Food/.test(t), `title promises food the page does not carry: ${t}`);
  assert.ok(!/Gate Times/.test(t), `title promises gate times the page does not carry: ${t}`);
});

test('a held building gets its name and the page type, and promises no content', async () => {
  const { venueHubTitle } = await load();
  const t = venueHubTitle(titleHub({ verified: false }));
  assert.equal(t, 'X Arena | 2026 Gameday Guide');
  for (const promise of ['Bag Policy', 'Parking', 'Food', 'Gate Times', 'Transit']) {
    assert.ok(!t.includes(promise), `a held hub's title promises ${promise}: ${t}`);
  }
});

test('a topic appears in the title only when the page renders it', async () => {
  const { venueHubTitle, venueHubTopics } = await load();
  const withFood = titleHub({ food: 'Great pizza.', sources: { bagMaxDimensions: SRC, clearBagRequired: SRC, bagPolicyNotes: SRC, parkingLots: SRC, food: SRC } });
  assert.equal(venueHubTopics(withFood).food, true);
  // Three terms is the head budget, so food lands only when it fits; what must
  // never happen is the reverse, a term with no content behind it.
  const t = venueHubTitle(withFood);
  assert.ok(t.startsWith('X Arena Bag Policy, Parking'), t);
  const noBag = titleHub({ bagMaxDimensions: null, clearBagRequired: null, bagPolicyNotes: null, bagPolicyUrl: null, sources: { parkingLots: SRC } });
  assert.equal(venueHubTopics(noBag).bag, false);
  assert.ok(!venueHubTitle(noBag).includes('Bag Policy'), venueHubTitle(noBag));
});

test('a field the state map holds drops out of the topics, so the title drops it too', async () => {
  const { venueHubTitle, venueHubTopics } = await load();
  const held = titleHub({
    publicTransit: { lines: ['Line 2'], notes: 'Take it.' },
    sources: { bagMaxDimensions: SRC, clearBagRequired: SRC, bagPolicyNotes: SRC, parkingLots: SRC, 'publicTransit.lines': SRC },
    fieldStates: { publicTransit: 'held' },
  });
  // The mapper empties a held field; this fixture is post-mapper, so the topic
  // predicate is what has to hold the line for a hand-built hub object.
  assert.equal(venueHubTopics({ ...held, publicTransit: null } as VenueHub).transit, false);
  assert.ok(!venueHubTitle({ ...held, publicTransit: null } as VenueHub).includes('Transit'));
});

test('a conflicted claim links its class pointer once its own source entry is gone', () => {
  // american-airlines-center's shape after the rule 1.5 null: sources.rideshareDropoff
  // is removed with the value, so the row would have had no link at all. The
  // guard requires the class pointer to be present for exactly this reason.
  const f = {
    sources: { parkingLots: SRC },
    fieldStates: { rideshareDropoff: 'operator-conflict' as const },
    observedAtByField: {},
    officialParkingUrls: ['https://www.operator.example.com/parking'],
  };
  const row = claimRow(f, 'rideshareDropoff', true);
  assert.equal(row.show, false);
  assert.equal(row.reason, 'The operator publishes conflicting answers.');
  assert.equal(row.sourceUrl, 'https://www.operator.example.com/parking', 'a conflict row must always carry a link');
  // A class with no pointer field has nothing to fall back to, and says so by
  // rendering the reason alone rather than a broken link.
  const noPointer = claimRow({ sources: {}, fieldStates: { publicTransit: 'operator-conflict' as const }, observedAtByField: {} }, 'publicTransit', true);
  assert.equal(noPointer.sourceUrl, null);
  assert.equal(noPointer.reason, 'The operator publishes conflicting answers.');
});

// THE LIVE-DOCUMENT CASE. Eight NHL buildings are in production carrying
// `verifiedAtByField`, a date the writer generated at write time and the page
// printed as "Verified <date>" beside fan-facing policy. The render must not read
// that key any more: a document written before the cutover has no observation time,
// so it shows no date at all rather than a date that means something else.
test('a legacy verifiedAtByField is ignored, so a pre-cutover doc shows no date', () => {
  const legacy = facts({} as never);
  (legacy as unknown as Record<string, unknown>).verifiedAtByField = {
    bagPolicyNotes: '2026-09-04T01:07:18.865Z',
    parkingLots: '2026-09-04T01:07:18.865Z',
  };
  (legacy as unknown as Record<string, unknown>).observedAtByField = {};
  assert.equal(claimSourceReadOn(legacy, 'bagPolicyNotes'), null);
  assert.equal(claimSourceReadOn(legacy, 'parkingLots'), null);
});
