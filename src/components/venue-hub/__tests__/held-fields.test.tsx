// Held fields (pipeline drift hold, owner rule 2026-11-08): a field the pipeline moved to
// state `held` because the operator's re-read page no longer carries it renders on NO
// surface: the promo page's Before you go row and its union fallback, the quick-facts card,
// the venue page's parking card and FAQ (and its FAQPage JSON-LD), the team page row. The
// pipeline empties the stored value; this also locks the case where a doc still carries it.
import { test, mock } from 'node:test';
import assert from 'node:assert/strict';
import { renderToStaticMarkup } from 'react-dom/server';

mock.module('server-only', { namedExports: {} });
mock.module(new URL('../../../lib/firebase.ts', import.meta.url).href, { namedExports: { db: {} } });

const OP = 'https://www.metlifestadium.com/plan-your-visit/parking-tailgating/nfl-parking';
const decode = (s: string) => s.replace(/&amp;/g, '&').replace(/&#x27;/g, "'").replace(/&quot;/g, '"');

// A raw doc as Firestore might hold it: lots still stored, but the state is held.
const rawDoc = () => ({
  slug: 'metlife-stadium', name: 'MetLife Stadium', formerNames: [], city: 'East Rutherford', state: 'New Jersey', lat: 40.81, lng: -74.07, capacity: 82500,
  tenants: [{ teamId: 'new-york-giants', league: 'NFL' }],
  parkingLots: [{ name: 'Lot B', notes: 'Season permits only.' }, { name: 'Lot D', notes: null }],
  parkingLotMapUrl: 'https://www.metlifestadium.com/parking-map.pdf', officialParkingUrls: [OP],
  bagMaxDimensions: { w: 12, h: 12, d: 6, unit: 'in' }, clearBagRequired: true, bagPolicyUrl: 'https://www.metlifestadium.com/clear-bag-policy',
  verified: true,
  sources: { parkingLots: [OP], bagMaxDimensions: ['https://www.metlifestadium.com/clear-bag-policy'], clearBagRequired: ['https://www.metlifestadium.com/clear-bag-policy'] },
  observedAtByField: { bagMaxDimensions: '2026-11-08T19:43:00.000Z', clearBagRequired: '2026-11-08T19:43:00.000Z' },
  fieldStates: { parkingLots: 'held', bagMaxDimensions: 'rendered', clearBagRequired: 'rendered' },
  heldValues: { parkingLots: { kind: 'drift', reason: 'drift: the cited page no longer carries the stored value (lot names not on it: Lot B, Lot D)' } },
});

test('a held field is emptied by the mapper and printed by no surface, the venue FAQ included', async () => {
  const { toVenueHub } = await import('../../../lib/venue-hub');
  const { publishedView } = await import('../../../lib/venue-published-view');
  const hub = publishedView(toVenueHub('metlife-stadium', rawDoc(), []));
  assert.deepEqual(hub.parkingLots, [], 'the mapper empties a held field');
  const { beforeYouGoRows } = await import('../../../lib/before-you-go-rows');
  const rows = beforeYouGoRows(hub, 'new-york-giants');
  assert.ok(rows.some((r) => r.key === 'bag'), 'the bag row still renders');
  assert.ok(!rows.some((r) => r.key === 'parking'), 'no parking provenance row');
  const { buildCondensedLogistics } = await import('../../../lib/venue-hub-condensed');
  const lines = buildCondensedLogistics(hub, 'new-york-giants');
  assert.ok(!lines.some((l) => /Lot B|Lot D/.test(l.text)), 'quick facts (and the union fallback built from them) print no held lot');
  const { renderVenueView } = await import('./fixtures/render-venue-view');
  const html = decode(renderVenueView(hub));
  assert.ok(!html.includes('Lot B') && !html.includes('Lot D'), 'the venue page prints no held lot');
  assert.ok(!html.includes('has on-site lots'), 'the FAQ makes no lots claim, though a lot map is present');
  assert.ok(!html.includes('heldValues') && !html.includes('drift: the cited page'), 'the held store never reaches the page');
  const { teamVenueRows } = await import('../TeamVenueFacts');
  const team = teamVenueRows(hub, 'new-york-giants').map((r) => decode(renderToStaticMarkup(<>{r.body}</>))).join(' ');
  assert.ok(!team.includes('Lot B') && !team.includes('Lot D'), 'the team page row prints no held lot');
});
