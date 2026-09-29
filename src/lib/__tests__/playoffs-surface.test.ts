import { test } from 'node:test';
import assert from 'node:assert/strict';
import { inferSurfaceFromPath, track, type EventPropertiesMap } from '../analytics';

// web_playoffs_league is the surface of a league's bracket page. The lockstep
// guard in analytics.ts catches a missing union member or a missing
// KNOWN_SURFACE_VALUES entry at compile time. Nothing catches a missing or
// misordered inferSurfaceFromPath branch, and that failure is silent: a league
// page would report under the hub's label. Same reason as about-surface and
// cfb-rivalry-surface.

test('the hub infers web_playoffs', () => {
  assert.equal(inferSurfaceFromPath('/playoffs'), 'web_playoffs');
  assert.equal(inferSurfaceFromPath('/playoffs/'), 'web_playoffs');
});

test('a league page infers web_playoffs_league', () => {
  assert.equal(inferSurfaceFromPath('/playoffs/mlb'), 'web_playoffs_league');
  assert.equal(inferSurfaceFromPath('/playoffs/wnba'), 'web_playoffs_league');
  assert.equal(inferSurfaceFromPath('/playoffs/mlb/'), 'web_playoffs_league');
});

test('branch order: the league branch took nothing from its neighbours', () => {
  assert.equal(inferSurfaceFromPath('/'), 'web_home');
  assert.equal(inferSurfaceFromPath('/mlb'), 'web_mlb_hub');
  assert.equal(inferSurfaceFromPath('/wnba'), 'web_wnba_hub');
  assert.equal(inferSurfaceFromPath('/mlb/houston-astros'), 'web_team_page');
  assert.equal(inferSurfaceFromPath('/promos/today'), 'web_today');
  assert.equal(inferSurfaceFromPath('/cfb/rivalries'), 'web_cfb_rivalry');
});

test('the three bracket events are typed, and track() is a no-op on the server', () => {
  // The assignments are the test: they fail tsc if an event leaves the union
  // or its properties drift. The calls prove nothing throws without a window.
  const view: EventPropertiesMap['playoffs_league_view'] = {
    surface: 'web_playoffs_league', league: 'mlb', season: 2026, phase: 'active', round_key: 'wild_card',
  };
  const round: EventPropertiesMap['playoffs_round_select'] = {
    surface: 'web_playoffs_league', league: 'mlb', season: 2026, round_key: 'division_series', conference: 'AL', control: 'round_pill',
  };
  const open: EventPropertiesMap['playoffs_series_open'] = {
    surface: 'web_playoffs_league', league: 'wnba', season: 2026, round_key: 'first_round', series_id: 'first_round-1', series_status: 'live',
  };
  assert.equal(typeof window, 'undefined');
  assert.doesNotThrow(() => track('playoffs_league_view', view));
  assert.doesNotThrow(() => track('playoffs_round_select', round));
  assert.doesNotThrow(() => track('playoffs_series_open', open));
  // No property is named `source`: track() fills that with attribution.
  for (const p of [view, round, open]) assert.ok(!('source' in p));
});
