// The team page's game-day facts come from the building's venueHubs published
// view, through the venue page's own decisions (Matt, 2026-10-07). These assert
// that a team page and its venue page cannot say different things: same gates,
// same words, a withheld field is a missing row, and nothing from the old
// `venues` prose can reach a team page.
import { test, mock } from 'node:test';
import assert from 'node:assert';
import * as fs from 'node:fs';
import { renderToStaticMarkup } from 'react-dom/server';

mock.module('server-only', { namedExports: {} });
mock.module(new URL('../../../lib/firebase.ts', import.meta.url).href, { namedExports: { db: {} } });

import type { VenueHub } from '../../../lib/venue-hub';

const loadFacts = () => import('../TeamVenueFacts');
const loadLogistics = () => import('../venue-logistics');

const SRC = 'https://www.mlb.com/twins/ballpark/information';

function hub(over: Partial<VenueHub> = {}): VenueHub {
  return {
    slug: 'test-field', name: 'Test Field', formerNames: [], city: 'Minneapolis', state: 'MN', lat: 1, lng: 2, capacity: 5,
    tenants: [{ teamId: 'twins', league: 'MLB', tenantKey: 'twins' }, { teamId: 'loons', league: 'MLS', tenantKey: 'loons' }],
    parkingLots: [{ name: 'Ramp A', notes: 'Closest to Gate 34.' }, { name: 'Ramp B', notes: null }],
    parkingLotMapUrl: null,
    officialParkingUrls: ['https://www.mlb.com/twins/ballpark/parking'],
    publicTransit: null,
    rideshareDropoff: null,
    accessibility: 'Elevators at every gate.',
    bagMaxDimensions: { w: 16, h: 16, d: 8, unit: 'in' }, clearBagRequired: false, bagsProhibited: null,
    bagPolicyUrl: 'https://www.mlb.com/twins/ballpark/bag-policy',
    bagPolicyNotes: 'Bags must be soft-sided. Backpacks are not allowed. Diaper bags are allowed with a child.',
    tailgating: null,
    venueAccessRestrictions: null, nearby: 'The North Loop is a short walk.', outsideFoodAllowed: null, outsideFoodRules: null,
    food: null, photoUrl: null, photoAttribution: null,
    verified: true,
    observedAtByField: { bagPolicyNotes: '2026-10-07T14:00:00Z', parkingLots: '2026-10-07T14:00:00Z' },
    fieldStates: {},
    tenantOverlays: [
      { teamId: 'twins', league: 'MLB', displayName: 'Minnesota Twins', gatesOpen: { ruleText: 'Gates open 90 minutes before first pitch.', minutesBefore: 90 }, gateVariance: null, tailgateWindow: null, bagPolicyException: null, verified: true, sources: { gatesOpen: SRC }, observedAtByField: {} },
      { teamId: 'loons', league: 'MLS', displayName: 'Minnesota United FC', gatesOpen: { ruleText: 'Gates open 60 minutes before kickoff.', minutesBefore: 60 }, gateVariance: null, tailgateWindow: null, bagPolicyException: null, verified: true, sources: { gatesOpen: SRC }, observedAtByField: {} },
    ],
    sources: {
      parkingLots: SRC, accessibility: SRC, bagMaxDimensions: SRC, clearBagRequired: SRC,
      bagPolicyNotes: SRC, nearby: SRC,
    },
    ...over,
  } as VenueHub;
}
const html = async (h: VenueHub, teamId = 'twins') => {
  const { TeamVenueFacts } = await loadFacts();
  return renderToStaticMarkup(<TeamVenueFacts hub={h} teamId={teamId} />);
};
const labels = async (h: VenueHub, teamId = 'twins') => (await loadFacts()).teamVenueRows(h, teamId).map((r) => r.label);

test('a verified building shows bag, gates, accessibility, parking and nearby rows', async () => {
  assert.deepEqual(await labels(hub()), ['Bag policy', 'Gates', 'Accessibility', 'Parking', 'Nearby']);
});

test('an unverified building shows nothing at all, not an empty card', async () => {
  assert.equal(await html(hub({ verified: false })), '');
});

test('a withheld field is a missing row, never a placeholder', async () => {
  const s = { ...hub().sources };
  delete s.accessibility;
  delete s.nearby;
  const out = await labels(hub({ sources: s }));
  assert.deepEqual(out, ['Bag policy', 'Gates', 'Parking']);
  const page = await html(hub({ sources: s }));
  assert.ok(!/Elevators at every gate|North Loop/.test(page));
});

test('gates are this team only on a shared building', async () => {
  const twins = await html(hub(), 'twins');
  assert.match(twins, /Gates open 90 minutes before first pitch/);
  assert.doesNotMatch(twins, /60 minutes before kickoff/);
  const loons = await html(hub(), 'loons');
  assert.match(loons, /Gates open 60 minutes before kickoff/);
  assert.doesNotMatch(loons, /90 minutes/);
});

test('the bag row says what the venue page bag card says, from the same model', async () => {
  const { bagCardModel, bagGates, BagCard } = await loadLogistics();
  const h = hub();
  const m = bagCardModel(h, bagGates(h).hasBagFaq)!;
  const team = await html(h);
  const venue = renderToStaticMarkup(<BagCard hub={h} hasBagFaq={bagGates(h).hasBagFaq} />);
  // The capsule's two lead sentences, the size, and the policy link, on both.
  for (const page of [team, venue]) {
    assert.ok(page.includes(m.lead), 'lead sentences');
    assert.ok(page.includes(m.cap.dims!.replace(/"/g, '&quot;')), 'size');
    assert.ok(page.includes('https://www.mlb.com/twins/ballpark/bag-policy'), 'policy link');
  }
  assert.match(team, /Max bag size: 16&quot;/);
  // The third sentence overflows into the venue page FAQ, so neither card shows it.
  assert.ok(!team.includes('Diaper bags'));
});

test('the parking row lists the same lots and links as the venue page parking card', async () => {
  const { parkingLotsModel } = await loadLogistics();
  const m = parkingLotsModel(hub())!;
  const team = await html(hub());
  for (const l of m.lots) assert.ok(team.includes(l.name), l.name);
  assert.ok(team.includes('mlb.com'), 'official parking link');
  assert.match(team, /Source read Oct 7, 2026/);
});

test('an excluded or conflicted field stays out on the team page as on the venue page', async () => {
  // fieldStates other than "rendered" null the value at the hub mapper; the
  // view then has nothing for the row to say.
  const out = await labels(hub({ accessibility: null, fieldStates: { accessibility: 'held' } }));
  assert.ok(!out.includes('Accessibility'));
});

test('no team-page code reads the old venues prose', () => {
  const read = (p: string) => fs.readFileSync(new URL(`../../../../${p}`, import.meta.url), 'utf8');
  for (const p of ['src/components/redesign/AffiliateRail.tsx', 'src/app/[sport]/[team]/page.tsx', 'src/components/venue-hub/TeamVenueFacts.tsx']) {
    const src = read(p);
    assert.ok(!/venue\??\.(parkingInfo|bagPolicyUrl|accessibility|nearby)\b/.test(src), `${p} reads venues prose`);
    assert.ok(!/VenueInfoBlock/.test(src.replace(/\/\/.*$/gm, '')), `${p} still mounts VenueInfoBlock`);
  }
});
