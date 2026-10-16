import test from 'node:test';
import assert from 'node:assert/strict';

import { nbaConferenceOf } from '../nba-hub';
import { inferSurfaceFromPath } from '../analytics';

test('nbaConferenceOf bands the six NBA divisions', () => {
  for (const d of ['Atlantic', 'Central', 'Southeast']) assert.equal(nbaConferenceOf(d), 'Eastern', d);
  for (const d of ['Northwest', 'Pacific', 'Southwest']) assert.equal(nbaConferenceOf(d), 'Western', d);
});

test('nbaConferenceOf bands a bare conference string by name', () => {
  assert.equal(nbaConferenceOf('Western'), 'Western');
  assert.equal(nbaConferenceOf('Eastern'), 'Eastern');
});

test('Central is Eastern in the NBA (it is Western in the NHL)', () => {
  assert.equal(nbaConferenceOf('Central'), 'Eastern');
});

test('bare /nba is the hub surface, /nba/<team> is a team page', () => {
  assert.equal(inferSurfaceFromPath('/nba'), 'web_nba_hub');
  assert.equal(inferSurfaceFromPath('/nba/minnesota-timberwolves'), 'web_team_page');
});
