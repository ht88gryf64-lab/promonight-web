import test from 'node:test';
import assert from 'node:assert/strict';

import { nhlClubCardSubtitle } from '../nhl-hub';

test('nhlClubCardSubtitle never renders a bare zero count', () => {
  for (const n of [0, -1]) {
    const s = nhlClubCardSubtitle(n);
    assert.equal(s, 'No upcoming promos listed yet');
    assert.ok(!/\b0\b/.test(s), `zero leaked into card copy: ${s}`);
  }
});

test('nhlClubCardSubtitle pluralizes upcoming counts', () => {
  assert.equal(nhlClubCardSubtitle(1), '1 upcoming promo');
  assert.equal(nhlClubCardSubtitle(2), '2 upcoming promos');
  assert.equal(nhlClubCardSubtitle(85), '85 upcoming promos');
});

test('nhlClubCardSubtitle carries no em dash', () => {
  for (const n of [0, 1, 12]) assert.ok(!nhlClubCardSubtitle(n).includes('\u2014'));
});
