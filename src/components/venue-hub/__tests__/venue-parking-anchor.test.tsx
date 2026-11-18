// The #parking anchor on a venue page (events Phase 2C, 2026-11-18): the
// target of an event stop page's "Parking on the {Venue} guide" link. The
// byte-identity tests render through a fixture that removes exactly this
// string (fixtures/render-venue-view.tsx), so this file is what pins it:
// present once wherever the parking card renders, absent everywhere else,
// and the only difference between the raw render and the baseline render.
import { test, mock } from 'node:test';
import assert from 'node:assert';
import { readFileSync } from 'node:fs';

mock.module('server-only', { namedExports: {} });
mock.module(new URL('../../../lib/firebase.ts', import.meta.url).href, { namedExports: { db: {} } });

import type { VenueHub } from '../../../lib/venue-hub';

const HUBS: VenueHub[] = JSON.parse(readFileSync(new URL('./fixtures/venue-hubs-published.json', import.meta.url), 'utf8'));

test('the parking anchor: once per page where the parking card renders, never elsewhere, and nothing else differs', async () => {
  const { renderVenueView, renderVenueViewRaw, PARKING_ANCHOR } = await import('./fixtures/render-venue-view');
  const { parkingLotsModel } = await import('../venue-logistics');
  let withCard = 0;
  let without = 0;
  for (const h of HUBS) {
    const raw = renderVenueViewRaw(h);
    const count = raw.split(PARKING_ANCHOR).length - 1;
    const ids = raw.split('id="parking"').length - 1;
    const hasCard = parkingLotsModel(h) !== null;
    assert.equal(count, hasCard ? 1 : 0, `${h.slug}: ${count} anchor(s), parking card ${hasCard}`);
    assert.equal(ids, count, `${h.slug}: an id="parking" that is not the anchor`);
    // The anchor is the whole difference: 53 bytes, in one place.
    // With the transit anchor put back, the baseline render plus the parking anchor is the raw render, byte for byte.
    assert.equal(renderVenueView(h).length + count * PARKING_ANCHOR.length, raw.split('<div id="transit" class="scroll-mt-24">').join('<div>').length, h.slug);
    if (hasCard) {
      withCard += 1;
      // It opens the parking card: the card's label follows it directly.
      assert.match(raw, /<span id="parking" class="block scroll-mt-24"><\/span><h2[^>]*>Parking lots<\/h2>/, `${h.slug}: the anchor is not at the head of the parking card`);
    } else without += 1;
  }
  assert.equal(Buffer.byteLength(PARKING_ANCHOR), 53);
  assert.ok(withCard > 100 && without > 0, `${withCard} buildings with a parking card, ${without} without`);
});

test('the transit anchor: once per page where the Transit row renders, never elsewhere, and nothing else differs', async () => {
  const { renderVenueView, renderVenueViewRaw, PARKING_ANCHOR, TRANSIT_ANCHOR_OPEN } = await import('./fixtures/render-venue-view');
  const { transitRowModel } = await import('../venue-logistics');
  let withRow = 0;
  let without = 0;
  for (const h of HUBS) {
    const raw = renderVenueViewRaw(h);
    const count = raw.split(TRANSIT_ANCHOR_OPEN).length - 1;
    const ids = raw.split('id="transit"').length - 1;
    const has = transitRowModel(h).renders;
    assert.equal(count, has ? 1 : 0, `${h.slug}: ${count} anchor(s), transit row ${has}`);
    assert.equal(ids, count, `${h.slug}: an id="transit" that is not the anchor`);
    const parking = raw.split(PARKING_ANCHOR).length - 1;
    assert.equal(Buffer.byteLength(raw) - Buffer.byteLength(renderVenueView(h)), parking * Buffer.byteLength(PARKING_ANCHOR) + count * (Buffer.byteLength(TRANSIT_ANCHOR_OPEN) - Buffer.byteLength('<div>')), h.slug);
    if (has) {
      withRow += 1;
      assert.ok(raw.includes(`${TRANSIT_ANCHOR_OPEN}<strong>Transit.</strong>`), `${h.slug}: the anchor is not the Transit row`);
    } else without += 1;
  }
  assert.ok(withRow > 50 && without > 0, `${withRow} buildings with a Transit row, ${without} without`);
});
