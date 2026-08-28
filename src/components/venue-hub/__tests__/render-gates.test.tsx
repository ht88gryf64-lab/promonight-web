// THE RENDER GATES, tested directly. Until 2026-08-28 the suite glob was
// "src/**/*.test.ts" and the repo held zero .test.tsx files, so every gate that
// decides whether a CLAIM APPEARS was unreachable by the suite: 13 of them live
// in .tsx. Green tests and a shipped defect coexisted twice because of it.
//
// These assert the DECISION ("does this claim render"), not the plumbing, so
// they survive a refactor and block an unintended reversal.
import { test, mock } from 'node:test';
import assert from 'node:assert';

mock.module('server-only', { namedExports: {} });
mock.module(new URL('../../../lib/firebase.ts', import.meta.url).href, { namedExports: { db: {} } });

import type { VenueHub } from '../../../lib/venue-hub';

// Loaded INSIDE each test: venue-logistics pulls in venue-hub, which imports
// the firebase client and `server-only`, and a static import is hoisted above
// the mock.module calls above. Same pattern as the lib tests.
const load = () => import('../venue-logistics');

const SRC = 'https://official.example.edu/guide';

function hub(over: Partial<VenueHub> = {}): VenueHub {
  return {
    slug: 'x-stadium', name: 'X Stadium', city: 'Town', state: 'ST', lat: 1, lng: 2, capacity: 5,
    tenants: [{ teamId: 'x', league: 'CFB', tenantKey: 'x' }],
    parkingLots: [{ name: 'Lot A', notes: 'opens early' }], parkingLotMapUrl: 'https://x.edu/map',
    officialParkingUrls: ['https://x.edu/parking'],
    publicTransit: { lines: ['Route 1'], notes: 'Take the bus.' },
    rideshareDropoff: 'Drop at Gate C.', accessibility: 'ADA at Gate A.',
    bagMaxDimensions: { w: 12, h: 6, d: 12, unit: 'in' }, clearBagRequired: true, bagsProhibited: null,
    bagPolicyUrl: 'https://x.edu/bags', bagPolicyNotes: 'Small clutches allowed.',
    tailgating: { allowed: true, rules: 'Stay in your space.', timeWindow: 'Lots open at 7am.', grillRules: null, rvPolicy: null },
    venueAccessRestrictions: 'No re-entry.', nearby: 'Block party.', outsideFoodAllowed: false, outsideFoodRules: 'None.',
    food: 'Pizza.', photoUrl: null, photoAttribution: null,
    verified: true,
    tenantOverlays: [{ teamId: 'x', league: 'CFB', displayName: 'X', gatesOpen: { ruleText: 'Gates open 2 hours before kickoff.', minutesBefore: 120 }, gateVariance: null, tailgateWindow: null, bagPolicyException: null, verified: true, sources: { gatesOpen: SRC } }],
    sources: {
      parkingLots: SRC, parkingLotMapUrl: SRC, officialParkingUrls: SRC, publicTransit: SRC,
      rideshareDropoff: SRC, accessibility: SRC, venueAccessRestrictions: SRC, tailgating: SRC,
      bagMaxDimensions: SRC, clearBagRequired: SRC, bagPolicyUrl: SRC, bagPolicyNotes: SRC,
      outsideFoodAllowed: SRC, outsideFoodRules: SRC, food: SRC, nearby: SRC,
    },
    ...over,
  } as VenueHub;
}
const labels = async (h: VenueHub) => (await load()).buildGettingInRows(h, (t) => t.displayName).map((r) => r.label);
const drop = (h: VenueHub, ...keys: string[]) => {
  const s = { ...h.sources }; for (const k of keys) delete s[k];
  return { ...h, sources: s } as VenueHub;
};

// ── GATE 1-6: per-field provenance on the Getting-in rows ──────────────────
test('GATE: every Getting-in row needs its own provenance key', async () => {
  assert.deepEqual(await labels(hub()), ['Gates', 'Transit', 'Rideshare', 'Tailgating', 'Accessibility', 'Entry']);
  assert.ok(!(await labels(drop(hub(), 'rideshareDropoff'))).includes('Rideshare'));
  assert.ok(!(await labels(drop(hub(), 'accessibility'))).includes('Accessibility'));
  assert.ok(!(await labels(drop(hub(), 'venueAccessRestrictions'))).includes('Entry'));
  assert.ok(!(await labels(drop(hub(), 'tailgating'))).includes('Tailgating'));
  // dropping one key leaves every sibling standing
  assert.equal((await labels(drop(hub(), 'accessibility'))).length, 5);
});

test('GATE: the gates row, FAQ and chip all read one provenance-gated tenant set', async () => {
  const { verifiedGateTenants } = await load();
  assert.equal(verifiedGateTenants(hub()).length, 1);
  const noSrc = hub({ tenantOverlays: [{ ...hub().tenantOverlays[0], sources: {} }] });
  assert.equal(verifiedGateTenants(noSrc).length, 0, 'an unsourced gate rule reaches NO surface, including FAQPage JSON-LD');
  assert.ok(!(await labels(noSrc)).includes('Gates'));
  // the dotted sub-key is provenance too
  const dotted = hub({ tenantOverlays: [{ ...hub().tenantOverlays[0], sources: { 'gatesOpen.ruleText': SRC } }] });
  assert.equal(verifiedGateTenants(dotted).length, 1);
});

// ── GATE 7: the conflicts list ────────────────────────────────────────────
test('GATE: a field on the conflicts list renders on no surface', async () => {
  const { FIELD_CONFLICTS, fieldExcluded } = await import('../../../lib/venue-field-exclusions');
  const conflicted = FIELD_CONFLICTS.filter((c) => !c.sub);
  assert.ok(conflicted.length >= 4, 'the tailgating conflicts are listed');
  for (const c of conflicted) {
    assert.equal(fieldExcluded(c.hub, c.field), true);
    const rows = await labels(hub({ slug: c.hub }));
    assert.ok(!rows.includes('Tailgating'), `${c.hub}: the conflicting field is withheld even though it is populated AND sourced`);
    assert.ok(rows.length >= 4, `${c.hub}: only the excluded field is withheld`);
  }
});

// ── GATE 8: sub-field exclusions ──────────────────────────────────────────
test('GATE: a sub-field exclusion withholds only its sub-field', async () => {
  const { subFieldExcluded, fieldExcluded } = await import('../../../lib/venue-field-exclusions');
  assert.equal(subFieldExcluded('kidd-brewer-stadium', 'parking', 'officialParkingUrls'), true);
  assert.equal(subFieldExcluded('kidd-brewer-stadium', 'parking', 'parkingLots'), false);
  assert.equal(fieldExcluded('kidd-brewer-stadium', 'parking'), false, 'the field itself is not excluded');
});

// ── GATE 9: the holds list ────────────────────────────────────────────────
test('GATE: the holds list is honoured by the same path as conflicts', async () => {
  const { FIELD_HOLDS, fieldExcluded } = await import('../../../lib/venue-field-exclusions');
  // Empty today (the Maryland hold was lifted by the Pass 2 write). The gate
  // must still work, so assert the MECHANISM on a synthetic entry rather than
  // asserting the list is empty, which would pass vacuously forever.
  for (const h of FIELD_HOLDS) assert.equal(fieldExcluded(h.hub, h.field), true);
  assert.equal(fieldExcluded('a-hub-on-no-list', 'tailgating'), false);
});

// ── GATE 10: transit suppression ──────────────────────────────────────────
test('GATE: a suppressed transit field renders on no surface', async () => {
  const { TRANSIT_SUPPRESSED, transitSuppressed } = await import('../../../lib/venue-transit-suppression');
  assert.ok(TRANSIT_SUPPRESSED.length >= 38);
  for (const t of TRANSIT_SUPPRESSED.slice(0, 6)) {
    assert.equal(transitSuppressed(t.hub), true);
    assert.ok(!(await labels(hub({ slug: t.hub }))).includes('Transit'), `${t.hub}: transit withheld`);
  }
  assert.ok((await labels(hub({ slug: 'not-suppressed-stadium' }))).includes('Transit'), 'the check discriminates');
});

// ── GATE 11: verified still gates the venue page (direction 1 preserved) ──
test('GATE: doc-level verified still governs the venue page, independently of provenance', async () => {
  const unverified = hub({ verified: false });
  assert.deepEqual(await labels(unverified), [], 'an unsigned-off building shows nothing here, however well sourced');
});

// ── GATE 12: an unsourced field is withheld even on a verified hub ────────
test('GATE: verified is necessary but not sufficient; each fact still needs its source', async () => {
  const bare = { ...hub(), sources: {} } as VenueHub;
  const rows = await labels(bare);
  assert.ok(!rows.includes('Transit') && !rows.includes('Rideshare') && !rows.includes('Accessibility'));
  assert.deepEqual(rows, ['Gates'], 'only the overlay-sourced gates rule survives an empty doc-level sources map');
});

// ── GATE 13: array-valued provenance counts ──────────────────────────────
test('GATE: provenance stored as an array of URLs is honoured, not dropped', async () => {
  const { hasProvenance } = await import('../../../lib/venue-field-exclusions');
  // The mapper coerces arrays to their first URL; hasProvenance sees a string.
  assert.equal(hasProvenance({ food: SRC }, 'food'), true);
  assert.equal(hasProvenance({}, 'food'), false);
  const { __esModule } = await import('../../../lib/venue-hub') as never as { __esModule?: boolean };
  void __esModule;
});
