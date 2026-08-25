// The CFB hub has no promo data (the college corpus is schedules, venues and
// rivalries), so its accessible name must never claim a promotional schedule.
// hubAriaLabel derives the name for every live hub from one template; without
// this guard a registry edit can quietly put the false claim back on every
// page, twice (desktop dropdown + mobile sheet).

import test from 'node:test';
import assert from 'node:assert/strict';

import { LEAGUE_HUB_REGISTRY, LEAGUE_HUBS, hubAriaLabel, hubIndexLinkLabel, hubNavLabel } from '../league-hubs';

test('the CFB hub aria-label never claims a promotional schedule', () => {
  const cfb = LEAGUE_HUB_REGISTRY.find((h) => h.league === 'CFB');
  assert.ok(cfb, 'CFB is in the registry');
  const label = hubAriaLabel(cfb);
  assert.doesNotMatch(label, /promo/i, `CFB aria-label claims promos: "${label}"`);
  assert.match(label, /college football/i, 'CFB aria-label names college football in words');
});

test('every pro hub aria-label still describes a promotional schedule', () => {
  for (const hub of LEAGUE_HUBS.filter((h) => h.league !== 'CFB')) {
    assert.equal(hubAriaLabel(hub), `${hub.label} promotional schedule`);
  }
});

test('the CFB hub is spelled out in menus and its /venues up-link never says promos', () => {
  const cfb = LEAGUE_HUB_REGISTRY.find((h) => h.league === 'CFB');
  assert.ok(cfb);
  assert.equal(hubNavLabel(cfb), 'College football');
  assert.doesNotMatch(hubIndexLinkLabel(cfb), /promo/i);
  const mlb = LEAGUE_HUB_REGISTRY.find((h) => h.league === 'MLB');
  assert.ok(mlb);
  assert.equal(hubNavLabel(mlb), 'MLB');
  assert.equal(hubIndexLinkLabel(mlb), 'All MLB promos');
});
