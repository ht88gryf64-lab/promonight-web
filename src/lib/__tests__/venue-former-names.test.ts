// Former names on renamed buildings (handoffs/website-former-names-spec.md,
// 2026-10-07). The pipeline writes venueHubs/{slug}.formerNames on three hubs;
// the venue page H1 reads "{current} (formerly X)", the
// StadiumOrArena node gains alternateName, and nothing else changes. The
// <title> stays the current name only (Matt's ruling, 2026-10-07).
import { test, mock } from 'node:test';
import assert from 'node:assert';
import { renderToStaticMarkup } from 'react-dom/server';
import { createElement } from 'react';

mock.module('server-only', { namedExports: {} });
mock.module(new URL('../firebase.ts', import.meta.url).href, { namedExports: { db: {} } });

import type { VenueHub } from '../venue-hub';
import { VenueHubJsonLd } from '../../components/venue-hub/VenueHubJsonLd';

const load = () => import('../venue-hub');
const SRC = 'https://www.operator.example.com/policies';

const hub = (over: Partial<VenueHub> = {}): VenueHub => ({
  slug: 'xcel-energy-center', name: 'Grand Casino Arena', formerNames: ['Xcel Energy Center'],
  city: 'Saint Paul', state: 'MN', lat: 1, lng: 2, capacity: 5,
  tenants: [{ teamId: 'minnesota-wild', league: 'NHL', tenantKey: 'minnesota-wild' }],
  parkingLots: [{ name: 'Lot A', notes: 'Opens early.' }], parkingLotMapUrl: null, officialParkingUrls: [],
  publicTransit: null, rideshareDropoff: null, accessibility: null,
  bagMaxDimensions: { w: 12, h: 12, d: 6, unit: 'in' }, clearBagRequired: false, bagsProhibited: null,
  bagPolicyUrl: SRC, bagPolicyNotes: 'Small bags only.',
  tailgating: null, venueAccessRestrictions: null, nearby: null,
  outsideFoodAllowed: null, outsideFoodRules: null, food: null,
  photoUrl: null, photoAttribution: null, verified: true,
  observedAtByField: {}, fieldStates: {},
  tenantOverlays: [],
  sources: { bagMaxDimensions: SRC, clearBagRequired: SRC, bagPolicyNotes: SRC, parkingLots: SRC },
  ...over,
}) as VenueHub;

test('the mapper keeps names only: no source URL or read time reaches the hub object', async () => {
  const { toVenueHub } = await load();
  const h = toVenueHub('xcel-energy-center', {
    name: 'Grand Casino Arena',
    formerNames: [{
      name: ' Xcel Energy Center ',
      sourceUrl: 'https://www.nhl.com/wild/news/naming-rights',
      announcementUrl: 'https://example.com/release',
      observedAt: '2026-10-07T14:00:00.000Z',
    }],
  }, []);
  assert.deepEqual(h.formerNames, ['Xcel Energy Center']);
  const serialized = JSON.stringify(h);
  for (const leak of ['nhl.com/wild', 'example.com/release', '2026-10-07T14:00']) {
    assert.ok(!serialized.includes(leak), `the hub object carries ${leak}`);
  }
});

test('absent, empty or malformed formerNames maps to an empty list', async () => {
  const { formerNamesOf } = await load();
  assert.deepEqual(formerNamesOf(undefined, 'A'), []);
  assert.deepEqual(formerNamesOf([], 'A'), []);
  assert.deepEqual(formerNamesOf('Old Name', 'A'), []);
  assert.deepEqual(formerNamesOf([{ name: '' }, { sourceUrl: 'x' }, null, { name: 'a' }], 'A'), [], 'blank, nameless and the current name are dropped');
  assert.deepEqual(formerNamesOf([{ name: 'B' }, { name: 'C' }, { name: 'B' }], 'A'), ['B', 'C']);
});

test('H1: "{current} (formerly X)" on a renamed building, the name alone otherwise', async () => {
  const { venueHubHeading } = await load();
  assert.equal(venueHubHeading(hub()), 'Grand Casino Arena (formerly Xcel Energy Center)');
  assert.equal(venueHubHeading(hub({ formerNames: [] })), 'Grand Casino Arena');
  // A hub object built without the field (an older fixture shape) is unchanged.
  assert.equal(venueHubHeading({ name: 'Target Field' } as VenueHub), 'Target Field');
  // The sponsor lockup is still stripped from the current name.
  assert.equal(venueHubHeading(hub({ name: 'GEHA Field at Arrowhead Stadium', formerNames: ['Old Park'] })), 'Arrowhead Stadium (formerly Old Park)');
});

test('title: the current name and its topic terms, never "(formerly X)" (ruling 2026-10-07)', async () => {
  const { venueHubTitle } = await load();
  const renamed = venueHubTitle(hub());
  assert.ok(!renamed.includes('formerly') && !renamed.includes('Xcel'), renamed);
  // Byte-identical to the same building with no former name.
  assert.equal(renamed, venueHubTitle(hub({ formerNames: [] })));
  assert.ok(renamed.startsWith('Grand Casino Arena Bag Policy'), renamed);
  assert.ok(renamed.endsWith(' | 2026 Gameday Guide'), renamed);
});

test('title on a held renamed building: the current name alone', async () => {
  const { venueHubTitle } = await load();
  const t = venueHubTitle(hub({ slug: 'wells-fargo-center', name: 'Xfinity Mobile Arena', formerNames: ['Wells Fargo Center'], verified: false }));
  assert.equal(t, 'Xfinity Mobile Arena | 2026 Gameday Guide');
});

test('JSON-LD: alternateName is a string for one former name, an array for several; name stays current', () => {
  const ld = (formerNames?: string[]) => {
    const html = renderToStaticMarkup(createElement(VenueHubJsonLd, {
      name: 'Grand Casino Arena', formerNames, url: 'https://www.getpromonight.com/venues/xcel-energy-center',
      city: 'Saint Paul', state: 'MN', lat: null, lng: null, faqs: [],
    }));
    const json = /<script type="application\/ld\+json">([\s\S]*?)<\/script>/.exec(html)?.[1] ?? '{}';
    return JSON.parse(json) as Record<string, unknown>;
  };
  assert.equal(ld(['Xcel Energy Center']).alternateName, 'Xcel Energy Center');
  assert.deepEqual(ld(['B', 'C']).alternateName, ['B', 'C']);
  assert.equal(ld(['Xcel Energy Center']).name, 'Grand Casino Arena');
  assert.ok(!('alternateName' in ld([])));
  assert.ok(!('alternateName' in ld(undefined)));
});
