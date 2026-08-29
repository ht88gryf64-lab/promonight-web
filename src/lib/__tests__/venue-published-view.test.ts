/* THE PUBLISHED VIEW: the eleven armed surface-escape gaps, made unexpressible.
 *
 * Before this module, each consumer re-derived "may I publish this?" at the
 * point of use, so a consumer that forgot a gate over-published. Twelve did
 * (audit/venue-exclusion-consumer-matrix.md); one was live.
 *
 * The proof below is not "every consumer now calls every gate", which would
 * decay the moment a thirteenth consumer is written. It is that THERE IS NO
 * VALUE TO PUBLISH: a hub failing any gate carries null in that field, so a
 * consumer reading `hub.x` directly cannot render a withheld claim even if it
 * applies no gate at all. Under-gating now under-renders. */
import { test, mock } from 'node:test';
import assert from 'node:assert';
import * as fs from 'node:fs';

mock.module('server-only', { namedExports: {} });
mock.module(new URL('../firebase.ts', import.meta.url).href, { namedExports: { db: {} } });

const load = () => import('../venue-published-view');
const read = (p: string) => fs.readFileSync(new URL(`../../../${p}`, import.meta.url), 'utf8');
const SRC = 'https://official.example.edu/guide';

type Any = Record<string, unknown>;
function hub(over: Any = {}): Any {
  return {
    slug: 'x-stadium', name: 'X', city: 'T', state: 'ST', lat: 1, lng: 2, capacity: 5,
    tenants: [], parkingLots: [{ name: 'Lot A', notes: 'opens early' }],
    parkingLotMapUrl: 'https://x.edu/map', officialParkingUrls: ['https://x.edu/p'],
    publicTransit: { lines: ['Route 1'], notes: 'Take the bus.' },
    rideshareDropoff: 'Gate C.', accessibility: 'ADA at Gate A.',
    bagMaxDimensions: { w: 12, h: 6, d: 12, unit: 'in' }, clearBagRequired: true, bagsProhibited: null,
    bagPolicyUrl: 'https://x.edu/bags', bagPolicyNotes: 'Clutches allowed.',
    tailgating: { allowed: true, rules: 'Stay in your space.', timeWindow: null, grillRules: null, rvPolicy: null },
    venueAccessRestrictions: 'No re-entry.', nearby: 'Block party.',
    outsideFoodAllowed: false, outsideFoodRules: 'None.', food: 'Pizza.',
    photoUrl: null, photoAttribution: null, verified: true, tenantOverlays: [],
    sources: {
      parkingLots: SRC, parkingLotMapUrl: SRC, officialParkingUrls: SRC, publicTransit: SRC,
      rideshareDropoff: SRC, accessibility: SRC, venueAccessRestrictions: SRC, tailgating: SRC,
      bagMaxDimensions: SRC, clearBagRequired: SRC, bagsProhibited: SRC, bagPolicyUrl: SRC,
      bagPolicyNotes: SRC, outsideFoodAllowed: SRC, outsideFoodRules: SRC, food: SRC, nearby: SRC,
    },
    ...over,
  };
}
const CLAIMS = ['publicTransit', 'parkingLots', 'bagMaxDimensions', 'clearBagRequired',
  'bagPolicyNotes', 'tailgating', 'accessibility', 'nearby', 'rideshareDropoff',
  'outsideFoodRules', 'food', 'venueAccessRestrictions'] as const;
const gone = (v: unknown) => v === null || (Array.isArray(v) && v.length === 0);

test('a fully sourced, verified hub publishes everything: the view is not a blunt instrument', async () => {
  const { publishedView } = await load();
  const v = publishedView(hub() as never) as unknown as Any;
  for (const f of CLAIMS) assert.ok(!gone(v[f]), `${f} must survive on a fully sourced hub`);
  assert.equal(v.bagPolicyUrl, 'https://x.edu/bags');
  assert.deepEqual(v.officialParkingUrls, ['https://x.edu/p']);
});

test('an UNVERIFIED doc carries no claim at all, so no consumer can publish one', async () => {
  const { publishedView } = await load();
  const v = publishedView(hub({ verified: false }) as never) as unknown as Any;
  for (const f of CLAIMS) assert.ok(gone(v[f]), `${f} survived on an unverified doc`);
  // Pointers go too: an unverified building publishes no links either.
  assert.equal(v.bagPolicyUrl, null);
  assert.deepEqual(v.officialParkingUrls, []);
});

test('an UNSOURCED field is null, one field at a time, leaving its siblings alone', async () => {
  const { publishedView } = await load();
  for (const f of CLAIMS) {
    const sources = { ...(hub().sources as Any) };
    delete sources[f];
    // dotted sub-keys must not sneak it back in
    for (const k of Object.keys(sources)) if (k.startsWith(`${f}.`)) delete sources[k];
    const v = publishedView(hub({ sources }) as never) as unknown as Any;
    assert.ok(gone(v[f]), `${f} published without its own provenance key`);
    const others = CLAIMS.filter((o) => o !== f && !(f === 'bagMaxDimensions' && o === 'clearBagRequired'));
    for (const o of others) assert.ok(!gone(v[o]), `dropping ${f} wrongly took ${o} with it`);
  }
});

test('a DOTTED sub-key vouches, and an ARRAY-valued source is not scored unsourced', async () => {
  const { publishedView } = await load();
  // 45 provenance values in the corpus are arrays of URLs; stringMap collapses
  // them upstream, so by here they are flat. Assert both shapes anyway: a view
  // that scored them unsourced would silently withdraw 45 TRUE claims, which is
  // this module's own failure mode pointed the other way.
  const dotted = publishedView(hub({ sources: { 'publicTransit.notes': SRC } }) as never) as unknown as Any;
  assert.ok(!gone(dotted.publicTransit), 'a dotted sub-key must vouch for its parent');
  const flat = publishedView(hub({ sources: { publicTransit: SRC } }) as never) as unknown as Any;
  assert.ok(!gone(flat.publicTransit), 'a flat key must vouch');
});

test('an EXCLUDED field is null, on both the whole-field and sub-key grains', async () => {
  const { publishedView } = await load();
  const { FIELD_CONFLICTS } = await import('../venue-field-exclusions');
  // Key on the live list, never a hardcoded slug: hardcoding is what let the
  // App State fixture go stale while its data had already been corrected.
  for (const c of FIELD_CONFLICTS) {
    const v = publishedView(hub({ slug: c.hub }) as never) as unknown as Any;
    if (c.field === 'tailgating' && !c.sub) assert.ok(gone(v.tailgating), `${c.hub}: tailgating survived`);
    if (c.field === 'accessibility' && !c.sub) assert.ok(gone(v.accessibility), `${c.hub}: accessibility survived`);
    if (c.field === 'bag' && c.sub === 'notes') assert.ok(gone(v.bagPolicyNotes), `${c.hub}: bag notes survived`);
    if (c.field === 'parking' && c.sub === 'parkingLots') assert.ok(gone(v.parkingLots), `${c.hub}: lots survived`);
  }
});

test('a SUPPRESSED building carries no transit value for anyone to render', async () => {
  const { publishedView } = await load();
  const { TRANSIT_SUPPRESSED } = await import('../venue-transit-suppression');
  const hubScoped = TRANSIT_SUPPRESSED.find((t) => t.applies.includes('hub'))!;
  const v = publishedView(hub({ slug: hubScoped.hub }) as never) as unknown as Any;
  assert.ok(gone(v.publicTransit), `${hubScoped.hub}: transit survived suppression`);
  assert.ok(!gone(v.parkingLots), 'suppression is transit-scoped and must not touch parking');
});

test('an UNREACHABLE pointer is dropped, and a reachable one is kept', async () => {
  const { publishedView } = await load();
  const v = publishedView(hub({
    bagPolicyUrl: 'not-a-url', parkingLotMapUrl: 'http//broken',
    officialParkingUrls: ['https://ok.example/p', 'javascript:alert(1)', ''],
  }) as never) as unknown as Any;
  assert.equal(v.bagPolicyUrl, null);
  assert.equal(v.parkingLotMapUrl, null);
  assert.deepEqual(v.officialParkingUrls, ['https://ok.example/p']);
});

test('rvPolicy alone does not make a tailgating object publishable', async () => {
  const { publishedView } = await load();
  // gerald-j-ford-stadium and joan-c-edwards-stadium carry exactly this shape,
  // and production renders no Tailgating row on either. An earlier draft of the
  // view published both, found by diffing the view against production across
  // all 223 hubs rather than by reading the code.
  const v = publishedView(hub({
    tailgating: { allowed: null, rules: null, timeWindow: null, grillRules: null, rvPolicy: 'No RVs.' },
  }) as never) as unknown as Any;
  assert.ok(gone(v.tailgating), 'an rvPolicy-only object must read as empty');
});

test('the gate rule of an UNVERIFIED overlay reaches no consumer', async () => {
  const { publishedView } = await load();
  const overlay = (verified: boolean, sources: Any) => ({
    teamId: 'x', league: 'CFB', displayName: 'X',
    gatesOpen: { ruleText: 'Gates open 2 hours before kickoff.', minutesBefore: 120 },
    gateVariance: null, tailgateWindow: null, bagPolicyException: null, verified, sources,
  });
  const ok = publishedView(hub({ tenantOverlays: [overlay(true, { 'gatesOpen.ruleText': SRC })] }) as never) as unknown as Any;
  assert.equal((ok.tenantOverlays as unknown[]).length, 1, 'a verified, sourced overlay must publish');
  const unverified = publishedView(hub({ tenantOverlays: [overlay(false, { 'gatesOpen.ruleText': SRC })] }) as never) as unknown as Any;
  assert.equal((unverified.tenantOverlays as unknown[]).length, 0, 'an unverified overlay must not');
  const unsourced = publishedView(hub({ tenantOverlays: [overlay(true, {})] }) as never) as unknown as Any;
  assert.equal((unsourced.tenantOverlays as unknown[]).length, 0, 'an unsourced overlay must not');
});

test('the view is applied at the MAPPER, so no consumer can skip it', () => {
  const src = read('src/lib/venue-hub.ts');
  assert.ok(
    /return publishedView\(toVenueHub\(/.test(src),
    'getVenueHub must return the view; gating at render sites is what produced four escapes',
  );
});

test('the ungated escape hatch has exactly the allowlisted callers', async () => {
  const { UNGATED_CONSUMERS } = await load();
  assert.deepEqual([...UNGATED_CONSUMERS], ['buildCondensedLogistics']);
  // Enumerate real readers by grepping the property, the control 6b.6 names.
  const files = ['src/lib/venue-hub-condensed.ts', 'src/components/venue-hub/VenueHubView.tsx',
    'src/components/venue-hub/venue-logistics.tsx', 'src/lib/venue-bag-policies.ts',
    'src/app/nfl/page.tsx', 'src/app/venues/bag-policies/page.tsx'];
  const readers = files.filter((f) => /\.ungated\b/.test(read(f)));
  assert.deepEqual(readers, ['src/lib/venue-hub-condensed.ts'],
    `only the allowlisted consumer may read the ungated object; found ${readers.join(', ')}`);
});
