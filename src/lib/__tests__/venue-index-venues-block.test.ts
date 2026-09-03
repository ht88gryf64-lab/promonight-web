/* Team page: the old `venues` prose block yields to the hub link once the
 * building's venueHub is indexable. Pure decision, tested without React. */
import { test } from 'node:test';
import assert from 'node:assert';
import { rendersVenuesBlock } from '../venue-index';

const venue = { slug: 'bridgestone-arena', name: 'Bridgestone Arena' };

test('an indexable hub retires the venues block', () => {
  assert.equal(rendersVenuesBlock(venue, true), false);
});

test('a building below the floor keeps the venues block', () => {
  assert.equal(rendersVenuesBlock(venue, false), true);
});

test('no venues doc means no block either way', () => {
  assert.equal(rendersVenuesBlock(null, false), false);
  assert.equal(rendersVenuesBlock(undefined, true), false);
});
