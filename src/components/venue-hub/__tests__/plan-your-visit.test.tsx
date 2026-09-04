// Plan-your-visit sits two cards above the Getting-in card on the same page.
// A field withheld from one for cause must not reappear in the other.
import { test, mock } from 'node:test';
import assert from 'node:assert';

mock.module('server-only', { namedExports: {} });
mock.module(new URL('../../../lib/firebase.ts', import.meta.url).href, { namedExports: { db: {} } });

import type { VenueHub } from '../../../lib/venue-hub';
const load = () => import('../venue-logistics');
const SRC = 'https://official.example.edu/guide';

function hub(slug: string): VenueHub {
  return {
    slug, name: 'X Stadium', city: 'T', state: 'ST', lat: 1, lng: 2, capacity: 5,
    tenants: [{ teamId: 'x', league: 'CFB', tenantKey: 'x' }],
    parkingLots: [], parkingLotMapUrl: null, officialParkingUrls: [],
    publicTransit: null, rideshareDropoff: null, accessibility: null,
    bagMaxDimensions: null, clearBagRequired: null, bagsProhibited: null, bagPolicyUrl: null, bagPolicyNotes: null,
    tailgating: { allowed: true, rules: 'Stay in your space.', timeWindow: 'Lots open at 7am.', grillRules: null, rvPolicy: null },
    venueAccessRestrictions: null, nearby: null, outsideFoodAllowed: null, outsideFoodRules: null, food: null,
    photoUrl: null, photoAttribution: null, verified: true,
    tenantOverlays: [{ teamId: 'x', league: 'CFB', displayName: 'X', gatesOpen: null, gateVariance: null, tailgateWindow: 'Lots open 5 hours before kickoff.', bagPolicyException: null, verified: true, sources: { tailgateWindow: SRC }, verifiedAtByField: {} }],
    sources: { tailgating: SRC },
    verifiedAtByField: {},
    fieldStates: {},
  } as VenueHub;
}

test('a building whose Tailgating row is withheld for conflict does not republish a tailgate window', async () => {
  const { buildGettingInRows, planYourVisitTailgateTenants } = await load() as any;
  for (const slug of ['yulman-stadium', 'hard-rock-stadium']) {
    const h = hub(slug);
    const rows = buildGettingInRows(h, (t: any) => t.displayName).map((r: any) => r.label);
    assert.ok(!rows.includes('Tailgating'), `${slug}: the Getting-in Tailgating row is withheld for conflict`);
    assert.equal(
      planYourVisitTailgateTenants(h).length, 0,
      `${slug}: Plan-your-visit republishes the tailgate window the Getting-in card withholds`,
    );
  }
  // a building on no list still shows both
  const ok = hub('some-other-stadium');
  assert.ok(buildGettingInRows(ok, (t: any) => t.displayName).map((r: any) => r.label).includes('Tailgating'));
  assert.equal(planYourVisitTailgateTenants(ok).length, 1);
});

test('an overlay tailgate window with no provenance never renders', async () => {
  const { planYourVisitTailgateTenants } = await load() as any;
  const h = hub('some-other-stadium');
  const noSrc = { ...h, tenantOverlays: [{ ...h.tenantOverlays[0], sources: {} }] } as VenueHub;
  assert.equal(planYourVisitTailgateTenants(noSrc).length, 0);
});
