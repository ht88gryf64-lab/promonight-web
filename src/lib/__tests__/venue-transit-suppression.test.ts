// The eleven buildings whose stored transit text names a service a fan cannot
// use. The list is the single source of truth for every surface that renders
// transit; these tests pin the list itself and the one consumer that can be
// exercised without a Firestore read.
import { test, mock } from 'node:test';
import assert from 'node:assert';

mock.module('server-only', { namedExports: {} });
mock.module(new URL('../firebase.ts', import.meta.url).href, { namedExports: { db: {} } });

import { TRANSIT_SUPPRESSED, transitSuppressed, venuesTransitSuppressed } from '../venue-transit-suppression';
import type { VenueHub as Hub } from '../venue-hub';

const ELEVEN = [
  'levis-stadium', 'stanford-stadium', 'dodger-stadium', 'loandepot-park', 'providence-park',
  'gerald-j-ford-stadium', 'audi-field', 'bmo-field', 'husky-stadium',
  'los-angeles-memorial-coliseum', 'mountain-america-stadium',
];
// Second pass: the sweep graded these "changed", the classification judged each
// would-strand, which is the standard the eleven were silenced on.
const WOULD_STRAND = [
  'albertsons-stadium', 'amon-g-carter-stadium', 'barclays-center', 'carter-finley-stadium',
  'citizens-bank-park', 'darrell-k-royal-texas-memorial-stadium', 'davis-wade-stadium',
  'donald-w-reynolds-razorback-stadium', 'empower-field', 'exploria-stadium', 'hard-rock-stadium',
  'jones-stadium', 'kenan-stadium', 'martin-stadium-northwestern-university',
  'memorial-stadium-lincoln', 'moda-center', 'mt-bank-stadium', 'paycor-stadium', 'sofi-stadium',
  'space-city-financial-stadium', 'target-center',
];
// Third pass: huntington-bank-field silenced instead of relabelled (its
// event-only qualifier could not survive a first-sentence render), plus five
// would-mislead rows silenced by ruling.
const THIRD_PASS = [
  'huntington-bank-field', 'everbank-stadium', 'jack-trice-stadium', 'lane-stadium',
  'neyland-stadium', 'simmons-bank-liberty-stadium',
];
// Fourth pass: found in the `venues` collection, which the first three sweeps
// never looked at. Scoped to that corpus only, because the hub records for
// these two buildings were not the source of the finding.
const VENUES_PASS = ['nationals-park', 'mercedes-benz-stadium'];
// Fifth pass: the three of twenty already-applied renames that failed the
// re-verification against the operators. Hub-scoped: the renames were applied
// to venueHubs, and each building's `venues` string was read separately.
const RENAME_RECHECK = ['coca-cola-coliseum', 'bank-of-america-stadium', 'sanford-stadium'];
const EXPECTED = [...ELEVEN, ...WOULD_STRAND, ...THIRD_PASS, ...VENUES_PASS, ...RENAME_RECHECK];

test('the suppression list is exactly the forty-three, each with its reason and its scope', () => {
  assert.deepEqual(TRANSIT_SUPPRESSED.map((t) => t.hub), EXPECTED);
  for (const t of TRANSIT_SUPPRESSED) {
    assert.ok(t.reason.length > 80, `${t.hub}: the reason must name the service and its evidence`);
    assert.ok(!/—/.test(t.reason), `${t.hub}: no em dashes`);
    assert.ok(t.applies.length > 0, `${t.hub}: an entry that applies nowhere silences nothing`);
    for (const a of t.applies) {
      assert.ok(a === 'hub' || a === 'venues', `${t.hub}: unknown scope ${a}`);
    }
  }
});

// The scope split is the whole point of `applies`, so it gets pinned by name.
// If someone later "simplifies" this by making one accessor serve both corpora,
// these two assertions are what fails.
test('scope is recorded per entry, and the two corpora get different sets', () => {
  const hubScoped = TRANSIT_SUPPRESSED.filter((t) => t.applies.includes('hub')).map((t) => t.hub);
  const venuesScoped = TRANSIT_SUPPRESSED.filter((t) => t.applies.includes('venues')).map((t) => t.hub);
  assert.equal(hubScoped.length, 41, 'hub-scoped: the original 38 plus the three rename-recheck failures');
  assert.deepEqual(
    venuesScoped,
    ['loandepot-park', 'providence-park', 'exploria-stadium', 'nationals-park', 'mercedes-benz-stadium', 'bank-of-america-stadium'],
    'only buildings whose `venues` string was itself checked may be silenced there',
  );
});

test('a hub-scoped defect does not silence the venues corpus', () => {
  // Dodger Stadium is the clearest case: the reason on file is about Metro rail
  // line letters, and the `venues` text names no rail line at all, only the
  // Express bus from Union Station. Same building, different claim, and the
  // evidence gathered against one says nothing about the other.
  for (const slug of ['levis-stadium', 'dodger-stadium', 'citizens-bank-park', 'bmo-field', 'audi-field', 'barclays-center', 'target-center']) {
    assert.equal(transitSuppressed(slug), true, `${slug} is suppressed on the hub surface`);
    assert.equal(venuesTransitSuppressed(slug), false, `${slug} must NOT be silenced in the venues corpus on hub-only evidence`);
  }
});

test('a building can be silenced in both corpora on two separate findings', () => {
  // bank-of-america-stadium is the only entry scoped to both on independent
  // evidence: the hub text names a station CATS does not have ("Convention
  // Center" for 3rd Street), and the venues text invents a different one
  // outright ("Bank of America Stadium Station", which is on no CATS roster).
  assert.equal(transitSuppressed('bank-of-america-stadium'), true);
  assert.equal(venuesTransitSuppressed('bank-of-america-stadium'), true);
});

test('a venues-scoped defect silences the venues corpus', () => {
  for (const slug of ['nationals-park', 'mercedes-benz-stadium']) {
    assert.equal(venuesTransitSuppressed(slug), true, slug);
    assert.equal(transitSuppressed(slug), false, `${slug} was found in venues, not in the hub sweep`);
  }
  // Found in both, so silenced in both.
  for (const slug of ['loandepot-park', 'exploria-stadium', 'providence-park']) {
    assert.equal(venuesTransitSuppressed(slug), true, slug);
    assert.equal(transitSuppressed(slug), true, slug);
  }
  assert.equal(venuesTransitSuppressed('target-field'), false);
  assert.equal(venuesTransitSuppressed(''), false, 'an unslugged Venue must not match a gate');
});

test('transitSuppressed answers for every suppressed hub and for nothing else', () => {
  // EXPECTED is now every entry in the file, which is a superset of the hub
  // surface: VENUES_PASS was found in the other corpus and is not silenced here.
  const hubScoped = [...ELEVEN, ...WOULD_STRAND, ...THIRD_PASS, ...RENAME_RECHECK];
  for (const slug of hubScoped) assert.equal(transitSuppressed(slug), true, slug);
  for (const slug of VENUES_PASS) {
    assert.equal(transitSuppressed(slug), false, `${slug} is a venues-corpus finding`);
  }
  assert.equal(new Set(EXPECTED).size, EXPECTED.length, 'no slug appears twice');
  for (const slug of ['target-field', 'secu-stadium', 'ohio-stadium', 'acrisure-stadium', '']) {
    assert.equal(transitSuppressed(slug), false, `${slug} must not be suppressed`);
  }
});

test('the CFB condensed block withholds transit for a suppressed hub and keeps every other line', async () => {
  const { buildCondensedLogistics } = await import('../venue-hub-condensed');
  const hub = (slug: string): Hub => ({
    slug, name: 'X Stadium', city: 'Town', state: 'ST', lat: 1, lng: 2, capacity: 50000,
    tenants: [{ teamId: 'x', league: 'CFB', tenantKey: 'x' }],
    parkingLots: [{ name: 'Lot A', notes: null }], parkingLotMapUrl: 'https://x.edu/map', officialParkingUrls: [],
    publicTransit: { lines: ['Route 1'], notes: 'Take the bus. Then walk.' },
    rideshareDropoff: null, accessibility: 'ADA at Gate A.', bagMaxDimensions: null, clearBagRequired: true,
    bagsProhibited: null, bagPolicyUrl: null, bagPolicyNotes: null,
    tailgating: { allowed: true, rules: 'Stay in your space.', timeWindow: 'Lots open at 7am.', grillRules: null, rvPolicy: null },
    venueAccessRestrictions: null, nearby: null, outsideFoodAllowed: false, outsideFoodRules: null,
    food: null, photoUrl: null, photoAttribution: null, verified: true, tenantOverlays: [],
    sources: { parkingLots: 'https://x.edu/p', parkingLotMapUrl: 'https://x.edu/map', clearBagRequired: 'https://x.edu/b', publicTransit: 'https://x.edu/t', accessibility: 'https://x.edu/a', tailgating: 'https://x.edu/tg', outsideFoodRules: 'https://x.edu/f' },
  } as Hub);
  const open = buildCondensedLogistics(hub('some-other-stadium'), 'x').map((l) => l.key);
  assert.ok(open.includes('transit'), 'a hub not on the list still renders transit');
  const shut = buildCondensedLogistics(hub('husky-stadium'), 'x').map((l) => l.key);
  assert.ok(!shut.includes('transit'), 'a suppressed hub renders no transit line');
  assert.deepEqual(shut, open.filter((k) => k !== 'transit'), 'only transit is withheld');
});

test('suppression does not touch the indexing floor, so no page is de-indexed by it', async () => {
  const { venueHubIsIndexable } = await import('../venue-hub');
  // providence-park's floor is geo + bag + transit, with no parking: if
  // suppression fed the floor, this page would drop out of the sitemap.
  const floor = {
    lat: 45.5, lng: -122.7, verified: true, clearBagRequired: true, bagMaxDimensions: null,
    bagPolicyUrl: null, bagPolicyNotes: null, parkingLots: [], parkingLotMapUrl: null,
    publicTransit: { lines: ['MAX Blue Line'], notes: null },
  };
  assert.equal(venueHubIsIndexable(floor), true, 'the floor still counts stored transit for a suppressed building');
});
