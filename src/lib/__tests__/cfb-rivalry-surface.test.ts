import { test } from 'node:test';
import assert from 'node:assert/strict';
import { inferSurfaceFromPath } from '../analytics';

// Adding a CFB surface takes THREE edits. The lockstep guard in analytics.ts
// catches a missing union member or a missing KNOWN_SURFACE_VALUES entry at
// compile time. Nothing catches a missing inferSurfaceFromPath branch, and its
// failure mode is silent mis-attribution rather than a fallback to web_other,
// so it needs a test.

test('a rivalry path infers web_cfb_rivalry, not web_cfb', () => {
  assert.equal(inferSurfaceFromPath('/cfb/rivalries/iron-bowl'), 'web_cfb_rivalry');
});

test('every registry-shaped rivalry path infers the rivalry surface', () => {
  for (const p of [
    '/cfb/rivalries',
    '/cfb/rivalries/red-river-rivalry',
    '/cfb/rivalries/apple-cup',
    '/cfb/rivalries/victory-bell-ucla-usc',
    '/cfb/rivalries/the-game',
  ]) {
    assert.equal(inferSurfaceFromPath(p), 'web_cfb_rivalry', p);
  }
});

test('the branch order is right: a school page still infers web_cfb', () => {
  // /cfb/rivalries/x also startsWith('/cfb'), so ordering is the whole test.
  assert.equal(inferSurfaceFromPath('/cfb/alabama'), 'web_cfb');
  assert.equal(inferSurfaceFromPath('/cfb'), 'web_cfb');
  assert.equal(inferSurfaceFromPath('/cfb/contribute'), 'web_cfb');
});

// KNOWN_SURFACE_VALUES membership is enforced at COMPILE time by the
// MissingKnownSurface lockstep guard in analytics.ts, so it needs no runtime
// test: omitting the entry fails tsc and the build. Only the branch above is
// unguarded, which is why this file exists.

test('unrelated paths are unaffected', () => {
  assert.equal(inferSurfaceFromPath('/mlb/los-angeles-dodgers'), 'web_team_page');
  assert.equal(inferSurfaceFromPath('/promos/today'), 'web_today');
  assert.equal(inferSurfaceFromPath('/'), 'web_home');
  // /venues has no branch of its own and falls through to web_other. Asserted so
  // a future /venues branch does not land here by accident.
  assert.equal(inferSurfaceFromPath('/venues/acrisure-stadium'), 'web_other');
});
