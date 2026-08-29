/* The fact-band bag chip, which was the fourth surface-escape instance.
 *
 * VenueHubView scrubbed clearBagRequired for provenance at line 149 to build
 * the bag FAQ, then read hub.clearBagRequired RAW at line 223 to decide whether
 * the chip says CLEAR BAG or MAX BAG. Same component, same value, withheld in
 * one place and published in the other, and both reads looked correct on their
 * own. Live on hard-rock-stadium in production on 2026-08-29.
 *
 * Asserts the DECISION: what claim the chip makes about the building. */
import { test, mock } from 'node:test';
import assert from 'node:assert';

mock.module('server-only', { namedExports: {} });
mock.module(new URL('../../../lib/firebase.ts', import.meta.url).href, { namedExports: { db: {} } });

import type { VenueHub } from '../../../lib/venue-hub';

const SRC = 'https://official.example.edu/guide';
const load = () => import('../venue-logistics');

function hub(over: Partial<VenueHub> = {}): VenueHub {
  return {
    slug: 'x-stadium', name: 'X Stadium', city: 'Town', state: 'ST', lat: 1, lng: 2, capacity: 5,
    tenants: [{ teamId: 'x', league: 'CFB', tenantKey: 'x' }],
    parkingLots: [], parkingLotMapUrl: null, officialParkingUrls: [],
    publicTransit: null, rideshareDropoff: null, accessibility: null,
    bagMaxDimensions: { w: 12, h: 6, d: 12, unit: 'in' },
    clearBagRequired: true, bagsProhibited: null,
    bagPolicyUrl: null, bagPolicyNotes: null, tailgating: null,
    venueAccessRestrictions: null, nearby: null, outsideFoodAllowed: null, outsideFoodRules: null,
    food: null, photoUrl: null, photoAttribution: null, verified: true, tenantOverlays: [],
    // dimensions sourced; clearBagRequired deliberately NOT
    sources: { bagMaxDimensions: SRC },
    ...over,
  } as VenueHub;
}

test('an UNSOURCED clearBagRequired cannot label the chip CLEAR BAG', async () => {
  const { bagChipFor } = await load();
  const chip = bagChipFor(hub());
  assert.ok(chip, 'the chip still renders: the DIMENSIONS are sourced');
  assert.equal(chip!.k, 'MAX BAG', 'an unsourced clear-bag flag must not become a CLEAR BAG claim');
  assert.equal(chip!.v, '12" x 6" x 12"');
});

test('a SOURCED clearBagRequired still labels the chip CLEAR BAG', async () => {
  const { bagChipFor } = await load();
  const chip = bagChipFor(hub({ sources: { bagMaxDimensions: SRC, clearBagRequired: SRC } }));
  assert.equal(chip!.k, 'CLEAR BAG', 'a sourced flag must keep publishing');
});

test('an UNSOURCED bagsProhibited publishes no BAGS chip', async () => {
  const { bagChipFor } = await load();
  const noDims = { bagMaxDimensions: null, bagsProhibited: true, sources: {} } as Partial<VenueHub>;
  assert.equal(bagChipFor(hub(noDims)), null, 'an unsourced prohibition must not render');
  const sourced = { ...noDims, sources: { bagsProhibited: SRC } } as Partial<VenueHub>;
  assert.deepEqual(bagChipFor(hub(sourced)), { k: 'BAGS', v: 'Not allowed' });
});

test('an unverified doc publishes no bag chip at all', async () => {
  const { bagChipFor } = await load();
  assert.equal(bagChipFor(hub({ verified: false })), null);
});

test('a bag field on the exclusion list publishes no chip', async () => {
  const { bagChipFor } = await load();
  // providence-park carries the only live bag entry (sub-scoped to notes), so
  // key on the mechanism rather than hardcoding a slug, which is how the App
  // State fixture went stale.
  const { FIELD_CONFLICTS } = await import('../../../lib/venue-field-exclusions');
  const wholeBag = FIELD_CONFLICTS.find((c) => c.field === 'bag' && !c.sub);
  if (wholeBag) assert.equal(bagChipFor(hub({ slug: wholeBag.hub })), null);
});


test('the VIEW uses the gated helper and holds no raw read of its own', () => {
  // These tests passed while the view failed to compile, because they exercise
  // the helper and nothing covered the wiring. Assert the wiring too.
  const src = require('node:fs').readFileSync(
    new URL('../VenueHubView.tsx', import.meta.url), 'utf8');
  assert.ok(/bagChipFor\(hub\)/.test(src), 'VenueHubView must build its bag chip from the gated helper');
  assert.ok(
    !/hub\.clearBagRequired \? 'CLEAR BAG'/.test(src),
    'the raw label read is back: an unsourced flag would publish a CLEAR BAG claim again',
  );
  assert.ok(
    !/else if \(hub\.bagsProhibited === true\) chips\.push/.test(src),
    'the raw prohibition read is back',
  );
});
