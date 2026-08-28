// The per-field provenance rule for the condensed logistics block: a field
// renders only when it is populated AND the hub's sources map (or, for gates,
// the tenant overlay's sources map) names that field. Not the index floor, not
// the doc-level verified flag, not the tenant's verified flag.
import { test, mock } from 'node:test';
import assert from 'node:assert';

mock.module('server-only', { namedExports: {} });
mock.module(new URL('../firebase.ts', import.meta.url).href, { namedExports: { db: {} } });

import type { VenueHub as Hub } from '../venue-hub';
import type { CondensedField } from '../venue-hub-condensed';
import { transitSuppressed } from '../venue-transit-suppression';

// Loaded inside each test: the module under test imports venue-hub, which
// imports the firebase client, so the mocks above must be registered first
// and the test runner compiles to CommonJS (no top-level await).
const load = () => import('../venue-hub-condensed');

function hub(over: Partial<Hub> = {}): Hub {
  return {
    slug: 'x-stadium', name: 'X Stadium', city: 'Town', state: 'ST', lat: 1, lng: 2, capacity: 50000,
    tenants: [{ teamId: 'x', league: 'CFB', tenantKey: 'x' }],
    parkingLots: [{ name: 'Lot A', notes: null }, { name: 'Lot B', notes: 'notes' }],
    parkingLotMapUrl: 'https://x.edu/map', officialParkingUrls: ['https://x.edu/parking'],
    publicTransit: { lines: ['Route 1'], notes: 'Take the bus. Then walk.' },
    rideshareDropoff: 'Drop at Gate C. Pickup same place.',
    accessibility: 'ADA entrances at Gate A. Elevators inside.',
    bagMaxDimensions: { w: 12, h: 6, d: 12, unit: 'in' }, clearBagRequired: true, bagsProhibited: null,
    bagPolicyUrl: 'https://x.edu/bags', bagPolicyNotes: 'Small clutches allowed. Nothing else.',
    tailgating: { allowed: true, rules: 'Stay in your space. No open flames.', timeWindow: 'Lots open at 7am.', grillRules: null, rvPolicy: null },
    venueAccessRestrictions: null, nearby: 'Block party on the plaza. Food trucks.', outsideFoodAllowed: false, outsideFoodRules: 'No outside food.',
    food: 'Pizza near section 1. Tacos near 2.', photoUrl: null, photoAttribution: null,
    // doc-level verified is FALSE on purpose: the rule must not read it.
    verified: false,
    tenantOverlays: [{ teamId: 'x', league: 'CFB', displayName: 'X', gatesOpen: { ruleText: 'Gates open 2 hours before kickoff.', minutesBefore: 120 }, gateVariance: null, tailgateWindow: null, bagPolicyException: null, verified: false, sources: { gatesOpen: 'https://x.edu/gameday' } }],
    sources: { parkingLots: 'https://x.edu/parking', parkingLotMapUrl: 'https://x.edu/map', publicTransit: 'https://x.edu/transit', rideshareDropoff: 'https://x.edu/ride', accessibility: 'https://x.edu/ada', bagMaxDimensions: 'https://x.edu/bags', clearBagRequired: 'https://x.edu/bags', bagPolicyUrl: 'https://x.edu/bags', tailgating: 'https://x.edu/tailgate', outsideFoodRules: 'https://x.edu/food', food: 'https://x.edu/food', nearby: 'https://x.edu/nearby' },
    ...over,
  } as Hub;
}

test('a fully provenanced hub renders every field, verbatim first sentences, regardless of verified flags', async () => {
  const { buildCondensedLogistics } = await load();
  const lines = buildCondensedLogistics(hub(), 'x');
  const byKey = Object.fromEntries(lines.map((l) => [l.key, l]));
  assert.deepEqual(lines.map((l) => l.key), ['gates', 'bag', 'parking', 'tailgating', 'transit', 'rideshare', 'accessibility', 'outsideFood', 'food', 'nearby']);
  assert.equal(byKey.gates.text, 'Gates open 2 hours before kickoff.');
  assert.equal(byKey.bag.text, 'Clear bag 12" x 6" x 12".');
  assert.equal(byKey.bag.href, 'https://x.edu/bags');
  assert.equal(byKey.parking.text, 'Lots: Lot A, Lot B.');
  assert.equal(byKey.parking.hrefLabel, 'Official lot map');
  assert.equal(byKey.tailgating.text, 'Stay in your space. Lots open at 7am.');
  assert.equal(byKey.transit.text, 'Take the bus. Lines: Route 1.');
  assert.equal(byKey.accessibility.text, 'ADA entrances at Gate A.');
  assert.equal(byKey.outsideFood.text, 'No outside food or drink.');
  assert.equal(byKey.food.text, 'Pizza near section 1.');
  assert.equal(byKey.nearby.text, 'Block party on the plaza.');
});

test('a populated field with no source for it stays silent', async () => {
  const { buildCondensedLogistics } = await load();
  const h = hub();
  const { tailgating: _t, publicTransit: _p, ...rest } = h.sources; void _t; void _p;
  const lines = buildCondensedLogistics({ ...h, sources: rest }, 'x');
  const keys = lines.map((l) => l.key);
  assert.ok(!keys.includes('tailgating'), 'tailgating must not render without sources.tailgating');
  assert.ok(!keys.includes('transit'), 'transit must not render without sources.publicTransit');
  assert.ok(keys.includes('parking'));
});

test('gates need the tenant overlay source, for that tenant, and nothing else', async () => {
  const { buildCondensedLogistics } = await load();
  const h = hub();
  const noSrc = { ...h, tenantOverlays: [{ ...h.tenantOverlays[0], sources: {} }] };
  assert.ok(!buildCondensedLogistics(noSrc, 'x').some((l) => l.key === 'gates'));
  assert.ok(!buildCondensedLogistics(h, 'other-tenant').some((l) => l.key === 'gates'), 'another tenant\'s gates rule never renders for this school');
});

test('parking sub-fields gate on their own keys', async () => {
  const { buildCondensedLogistics } = await load();
  const h = hub();
  const { parkingLots: _l, ...rest } = h.sources; void _l;
  const line = buildCondensedLogistics({ ...h, sources: rest }, 'x').find((l) => l.key === 'parking');
  assert.ok(line);
  assert.equal(line!.text, 'See the official parking page.');
  assert.equal(line!.href, 'https://x.edu/map');
});

test('with no provenance anywhere, only POINTERS survive: a link asserts nothing', async () => {
  const { buildCondensedLogistics } = await load();
  const h = hub({ sources: {} });
  // The overlay's own map still vouches for the gates rule, so it stands.
  // Bag and parking survive too, but ONLY as links: the fixture carries a
  // bagPolicyUrl and a parkingLotMapUrl, and a pointer gates on reachability
  // rather than provenance because rendering it asserts nothing about the
  // building. Every CLAIM is gone.
  const withOverlay = buildCondensedLogistics(h, 'x');
  assert.deepEqual(withOverlay.map((l) => l.key), ['gates', 'bag', 'parking']);
  assert.equal(withOverlay.find((l) => l.key === 'bag')!.text, 'See the official bag policy.', 'no bag FACT, just the link');
  assert.equal(withOverlay.find((l) => l.key === 'parking')!.text, 'See the official parking page.', 'no lot NAMES, just the link');
  const bare = { ...h, tenantOverlays: [{ ...h.tenantOverlays[0], sources: {} }] };
  const keys = buildCondensedLogistics(bare, 'x').map((l) => l.key);
  assert.deepEqual(keys, ['bag', 'parking'], 'gates goes with its overlay provenance; the two links remain');
  // and a hub with no links at all renders nothing
  const noLinks = { ...bare, bagPolicyUrl: null, parkingLotMapUrl: null, officialParkingUrls: [] } as typeof bare;
  assert.deepEqual(buildCondensedLogistics(noLinks, 'x'), []);
});

test('the block minimum is three lines', async () => {
  const { CONDENSED_MIN_FIELDS } = await load();
  assert.equal(CONDENSED_MIN_FIELDS, 3);
});

test('em dashes in stored text are stripped at render, never carried into served copy', async () => {
  const { buildCondensedLogistics, stripEmDashes } = await load();
  assert.equal(stripEmDashes('Block Party on Curtin Road each home game — live music and food trucks'), 'Block Party on Curtin Road each home game, live music and food trucks');
  assert.equal(stripEmDashes('Lots open at 7am.— tailgating allowed'), 'Lots open at 7am. tailgating allowed');
  assert.equal(stripEmDashes('Rice–Eccles Stadium'), 'Rice–Eccles Stadium', 'en dashes in building names are untouched');
  const h = hub({ nearby: 'Block party on Main St — live music. Food trucks.' });
  const line = buildCondensedLogistics(h, 'x').find((l) => l.key === 'nearby');
  assert.equal(line!.text, 'Block party on Main St, live music.');
  assert.ok(!buildCondensedLogistics(h, 'x').some((l) => /—/.test(l.text)));
});

test('dotted sub-key sources are provenance: each sub-field renders on its own key', async () => {
  const { buildCondensedLogistics } = await load();
  const h = hub();
  const { tailgating: _t, publicTransit: _p, ...rest } = h.sources; void _t; void _p;
  const dotted = {
    ...h,
    sources: { ...rest, 'tailgating.rules': 'https://x.edu/tg', 'tailgating.timeWindow': 'https://x.edu/tg', 'publicTransit.notes': 'https://x.edu/transit', 'publicTransit.lines': 'https://x.edu/transit' },
    tenantOverlays: [{ ...h.tenantOverlays[0], sources: { 'gatesOpen.ruleText': 'https://x.edu/gameday' } }],
  };
  const byKey = Object.fromEntries(buildCondensedLogistics(dotted, 'x').map((l) => [l.key, l]));
  assert.ok(byKey.gates, 'gates must render on gatesOpen.ruleText alone');
  assert.ok(byKey.tailgating, 'tailgating must render on tailgating.rules + tailgating.timeWindow');
  assert.ok(byKey.transit, 'transit must render on publicTransit.notes + publicTransit.lines');
  assert.equal(byKey.gates.text, 'Gates open 2 hours before kickoff.');
  assert.equal(byKey.tailgating.text, 'Stay in your space. Lots open at 7am.');
  assert.equal(byKey.transit.text, 'Take the bus. Lines: Route 1.');
  // A sub-field with neither its dotted key nor the flat key stays silent while its sibling renders.
  const partial = { ...dotted, sources: { ...rest, 'tailgating.rules': 'https://x.edu/tg', 'publicTransit.lines': 'https://x.edu/transit' } };
  const p = Object.fromEntries(buildCondensedLogistics(partial, 'x').map((l) => [l.key, l]));
  assert.ok(p.tailgating && p.transit, 'a sourced sub-field renders while its unsourced sibling stays silent');
  assert.equal(p.tailgating.text, 'Stay in your space.');
  assert.equal(p.transit.text, 'Lines: Route 1.');
  // A dotted key for a sub-field the block does not render vouches for nothing on the block.
  const onlyGrill = { ...dotted, sources: { ...rest, 'tailgating.grillRules': 'https://x.edu/tg', 'tailgating.rvPolicy': 'https://x.edu/tg' } };
  assert.ok(!buildCondensedLogistics(onlyGrill, 'x').some((l) => l.key === 'tailgating'));
  // The allowed flag alone needs its own key too.
  const onlyAllowed = { ...dotted, tailgating: { ...h.tailgating!, rules: null, timeWindow: null }, sources: { ...rest, 'tailgating.allowed': 'https://x.edu/tg' } };
  const allowedLine = buildCondensedLogistics(onlyAllowed, 'x').find((l) => l.key === 'tailgating');
  assert.ok(allowedLine, 'a sourced allowed flag alone renders');
  assert.equal(allowedLine.text, 'Permitted.');
});

test('a false allowed flag is terminal on either convention: sourced it says so, unsourced the line is silent', async () => {
  const { buildCondensedLogistics } = await load();
  const h = hub();
  const { tailgating: _t, ...rest } = h.sources; void _t;
  const tg = { ...h.tailgating!, allowed: false };
  const tgLine = (x: Hub) => buildCondensedLogistics(x, 'x').find((l) => l.key === 'tailgating');
  // flat key: unchanged from the old renderer
  assert.equal(tgLine({ ...h, tailgating: tg })!.text, 'Not permitted.');
  // dotted keys with the flag sourced
  assert.equal(tgLine({ ...h, tailgating: tg, sources: { ...rest, 'tailgating.allowed': 'https://x.edu/tg', 'tailgating.rules': 'https://x.edu/tg', 'tailgating.timeWindow': 'https://x.edu/tg' } })!.text, 'Not permitted.');
  // dotted keys without the flag sourced: never the rules or the window under a prohibition
  assert.equal(tgLine({ ...h, tailgating: tg, sources: { ...rest, 'tailgating.rules': 'https://x.edu/tg', 'tailgating.timeWindow': 'https://x.edu/tg' } }), undefined);
  assert.equal(tgLine({ ...h, tailgating: tg, sources: { ...rest, 'tailgating.timeWindow': 'https://x.edu/tg' } }), undefined);
});

test('a transit doc without a lines array renders the notes alone instead of throwing', async () => {
  const { buildCondensedLogistics } = await load();
  const h = hub({ publicTransit: { notes: 'Take the bus. Then walk.' } as unknown as Hub['publicTransit'] });
  const line = buildCondensedLogistics(h, 'x').find((l) => l.key === 'transit');
  assert.ok(line, 'transit renders on the notes');
  assert.equal(line.text, 'Take the bus.');
});

test('the conflicts and holds lists silence the named field on the named hub and nothing else', async () => {
  const { buildCondensedLogistics, CONDENSED_CONFLICTS, CONDENSED_HOLDS } = await load();
  assert.ok(Array.isArray(CONDENSED_CONFLICTS) && Array.isArray(CONDENSED_HOLDS), 'both exclusion lists are exported');
  const wholeLine: Array<[string, CondensedField]> = [
    ['brooks-stadium', 'tailgating'], ['david-booth-kansas-memorial-stadium', 'tailgating'], ['hard-rock-stadium', 'tailgating'], ['yulman-stadium', 'tailgating'],
  ];
  assert.deepEqual(CONDENSED_CONFLICTS.filter((c) => !c.sub).map((c) => [c.hub, c.field]), wholeLine);
  assert.deepEqual(CONDENSED_HOLDS.map((c) => [c.hub, c.field, c.sub ?? null]), [], 'no holds after the Pass 2 Maryland write');
  for (const e of [...CONDENSED_CONFLICTS, ...CONDENSED_HOLDS]) assert.ok(e.reason.length > 60, `${e.hub}: every exclusion carries its reason`);
  for (const [slug, field] of [...wholeLine, ...CONDENSED_HOLDS.map((h) => [h.hub, h.field] as [string, CondensedField])]) {
    const keys = buildCondensedLogistics(hub({ slug }), 'x').map((l) => l.key);
    assert.ok(!keys.includes(field), `${slug}: ${field} must stay silent`);
    // A hub can sit on two lists for two different fields: hard-rock-stadium
    // has a tailgating conflict AND a suppressed transit field, so it withholds
    // both. Assert on the exact withheld set rather than a bare count.
    const alsoTransit = transitSuppressed(slug) && field !== 'transit';
    assert.equal(keys.length, alsoTransit ? 8 : 9, `${slug}: only ${field}${alsoTransit ? ' and transit' : ''} is withheld`);
    if (alsoTransit) assert.ok(!keys.includes('transit'), `${slug}: transit is suppressed too`);
  }
  assert.equal(buildCondensedLogistics(hub({ slug: 'some-other-stadium' }), 'x').length, 10);
});

test('a sub-field exclusion withholds that sub-field only, on an entry that actually exists', async () => {
  const { buildCondensedLogistics } = await load();
  const dead = 'https://mountaineersathleticfund.com/yosef-club/renewals/index.html';
  // Keyed to whatever sub-field entry is CURRENTLY listed, not to a slug whose
  // entry may since have been lifted: the previous version pinned
  // kidd-brewer-stadium and stayed green after its exclusion was removed.
  const { FIELD_CONFLICTS } = await import('../venue-field-exclusions');
  const entry = FIELD_CONFLICTS.find((c) => c.sub === 'officialParkingUrls');
  if (!entry) return; // nothing of this shape listed today
  const h = hub({ slug: entry.hub, officialParkingUrls: [dead] });
  h.sources = { ...h.sources, officialParkingUrls: 'https://appstatesports.com/guide' };
  const parking = (x: Hub) => buildCondensedLogistics(x, 'x').find((l) => l.key === 'parking');
  const withMap = parking(h);
  assert.ok(withMap, 'lots and the lot map render');
  assert.equal(withMap.text, 'Lots: Lot A, Lot B.');
  assert.equal(withMap.href, 'https://x.edu/map');
  const lotsOnly = parking({ ...h, parkingLotMapUrl: null });
  assert.ok(lotsOnly);
  assert.equal(lotsOnly.text, 'Lots: Lot A, Lot B.');
  assert.equal(lotsOnly.href, null, 'the official link is withheld even though it is sourced');
  assert.equal(parking({ ...h, parkingLotMapUrl: null, parkingLots: [] }), undefined, 'nothing but the dead link: no parking line');
  assert.ok(!buildCondensedLogistics(h, 'x').some((l) => l.href === dead));
});

test('a period after an abbreviation is not a sentence end, so a qualifier cannot be truncated away', async () => {
  const { leadSentences } = await import('../venue-hub');
  // THE LIVE DEFECT this guards: /cfb/alabama served "Free Crimson Ride shuttle
  // service to the Quad begins at 6 a.m." from stored text that continues
  // "(11 a.m. kickoff only)". The block renders ONE lead sentence, so the split
  // decided whether the rendered claim was true.
  assert.equal(
    leadSentences('Free Crimson Ride shuttle service to the Quad begins at 6 a.m. (11 a.m. kickoff only) on game days. Off-campus shuttles run from downtown.', 1).lead,
    'Free Crimson Ride shuttle service to the Quad begins at 6 a.m. (11 a.m. kickoff only) on game days.',
  );
  assert.equal(
    leadSentences('Tailgate tents may be dropped off starting 5 a.m. Friday. All picnic areas open at 4 p.m. the day before.', 1).lead,
    'Tailgate tents may be dropped off starting 5 a.m. Friday.',
  );
  // Ordinary sentences still split.
  assert.deepEqual(leadSentences('Take the bus. Then walk.', 1), { lead: 'Take the bus.', overflow: 'Then walk.' });
  // Street-type abbreviations mid-clause no longer split.
  assert.equal(leadSentences('Drop off on 8th St. north of Gate 3. Lots close after.', 1).lead, 'Drop off on 8th St. north of Gate 3.');
  // THE DELIBERATE TRADE, stated so it is a decision and not a surprise: an
  // ambiguous abbreviation that genuinely ENDS a sentence merges it with the
  // next one, because "Ave. Garage" and "St. Food trucks." are indistinguishable
  // without parsing. Over-inclusion shows the reader more true text; truncation
  // showed a false claim. Merging is the safer failure.
  assert.equal(leadSentences('Block party on Main St. Food trucks.', 1).lead, 'Block party on Main St. Food trucks.');
});
