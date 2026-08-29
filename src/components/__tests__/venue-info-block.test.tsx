// VenueInfoBlock renders the `venues` corpus on all 169 pro team pages. It had
// no gate of any kind, and worse: when gatesOpen was absent it MANUFACTURED a
// league-generic sentence and labelled it "Gate times" in the same row style as
// a sourced value, on 85 of 169 pages, and on 69 of those it was the only row.
import { test, mock } from 'node:test';
import assert from 'node:assert';
import { renderToStaticMarkup } from 'react-dom/server';

mock.module('server-only', { namedExports: {} });

import type { Venue } from '@/lib/types';
import { VenueInfoBlock } from '../venue-info-block';

const venue = (over: Partial<Venue> = {}): Venue => ({
  id: 'x-stadium', name: 'X Stadium', team: 'Town X', teamId: 'x-nfl', league: 'NFL', sport: 'NFL',
  address: '1 Way', lat: 1, lng: 2, primaryColor: '#000', accentColor: '#111', sportIcon: '🏈',
  hasAmenityData: false, amenityCount: 0,
  ...over,
} as Venue);

test('an absent gatesOpen renders NO gate-times row, on either variant', () => {
  for (const variant of ['dark', 'light'] as const) {
    const html = renderToStaticMarkup(<VenueInfoBlock venue={venue()} league="NFL" variant={variant} />);
    assert.ok(!/Gate times/.test(html), `${variant}: a manufactured gate-time row rendered for a venue with no gatesOpen`);
    assert.ok(!/typically open/.test(html), `${variant}: the fabricated league sentence reached the DOM`);
  }
});

test('a real gatesOpen still renders, verbatim', () => {
  const html = renderToStaticMarkup(<VenueInfoBlock venue={venue({ gatesOpen: 'Gates open 2 hours before kickoff.' })} league="NFL" />);
  assert.ok(/Gate times/.test(html));
  assert.ok(/Gates open 2 hours before kickoff\./.test(html));
});

test('a venue with nothing to say renders no card at all, not an empty one', () => {
  for (const variant of ['dark', 'light'] as const) {
    const html = renderToStaticMarkup(<VenueInfoBlock venue={venue()} league="NFL" variant={variant} />);
    assert.equal(html, '', `${variant}: an empty labelled card is worse than no card`);
  }
});

test('a suppressed building publishes no transit sentence here either', () => {
  // venueHubs silences these buildings' transit because an operator confirmed
  // the named service does not run. The same claim must not survive on the
  // team page just because it lives in a different collection.
  const html = renderToStaticMarkup(
    <VenueInfoBlock venue={venue({ slug: 'nationals-park', publicTransit: 'Take VTA light rail to the stadium.' })} league="NFL" />,
  );
  assert.ok(!/VTA/.test(html), 'nationals-park transit is suppressed on the hub page and must be suppressed here');
});

test('a building on no list still publishes its transit', () => {
  const html = renderToStaticMarkup(
    <VenueInfoBlock venue={venue({ slug: 'target-field', publicTransit: 'METRO Blue Line stops at the ballpark.' })} league="MLB" />,
  );
  assert.ok(/METRO Blue Line/.test(html), 'the check must discriminate');
});
