/* The team-page venue card, after the `venues` corpus was silenced.
 *
 * The card has been wrong twice in the same place. It first substituted a
 * hardcoded league sentence for an absent gatesOpen and labelled it "Gate
 * times" like a sourced value. That was removed on 2026-08-29. Verifying the
 * stored fields against operators then found publicTransit defective in 16 of
 * 20 docs and 5 of 17 gate claims false, so both fields are now silenced at the
 * render layer. Firestore is untouched.
 *
 * These tests assert the DECISION (what claim reaches a reader), not the
 * markup. */
import { test } from 'node:test';
import assert from 'node:assert';
import { renderToStaticMarkup } from 'react-dom/server';
import { VenueInfoBlock } from '../venue-info-block';
import type { Venue } from '@/lib/types';

const base: Venue = {
  slug: 'test-park', name: 'Test Park', address: '1 Test Way', team: 'Testville Niners',
  sport: 'Baseball', sportIcon: '', primaryColor: '#000', accentColor: '#fff',
  lat: 0, lng: 0, hasAmenityData: false, amenityCount: 0, league: 'MLB', teamId: 't',
};
const render = (v: Venue, variant: 'dark' | 'light' = 'dark') =>
  renderToStaticMarkup(<VenueInfoBlock venue={v} league="MLB" variant={variant} />);

test('no gate-times row can be rendered, on either variant', () => {
  for (const variant of ['dark', 'light'] as const) {
    const html = render({ ...base, parkingInfo: 'Lots open early.' }, variant);
    assert.ok(!/Gate times/.test(html), `${variant}: a gate-times row rendered`);
    assert.ok(!/typically open/i.test(html), `${variant}: a manufactured cadence rendered`);
  }
});

test('no transit row can be rendered, on either variant', () => {
  for (const variant of ['dark', 'light'] as const) {
    const html = render({ ...base, parkingInfo: 'Lots open early.' }, variant);
    assert.ok(!/>Transit</.test(html), `${variant}: a transit row rendered`);
  }
});

test('the rows that survive still render, so this silenced fields and not the card', () => {
  const html = render({ ...base, parkingInfo: 'Lots open two hours early.', accessibility: 'Ramps at Gate A.', nearby: 'Bars on Main.' });
  assert.ok(/Parking/.test(html) && /Lots open two hours early/.test(html), 'parking must survive');
  assert.ok(/Accessibility/.test(html) && /Ramps at Gate A/.test(html), 'accessibility must survive');
  assert.ok(/Nearby/.test(html) && /Bars on Main/.test(html), 'nearby must survive');
});

test('a bag pointer still renders, because a link asserts nothing', () => {
  const html = render({ ...base, bagPolicyUrl: 'https://example.com/bag-policy' });
  assert.ok(/Bag policy/.test(html), 'the bag row must survive the silencing');
  assert.ok(/https:\/\/example\.com\/bag-policy/.test(html), 'the href must reach the DOM');
});

test('a venue with nothing left to say renders no card at all, not an empty one', () => {
  for (const variant of ['dark', 'light'] as const) {
    assert.equal(render(base, variant), '', `${variant}: an empty labelled card rendered`);
  }
});
