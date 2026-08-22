import { test } from 'node:test';
import assert from 'node:assert/strict';
import { inferSurfaceFromPath } from '../analytics';

// Adding a surface takes THREE edits. The lockstep guard in analytics.ts catches
// a missing union member or a missing KNOWN_SURFACE_VALUES entry at COMPILE
// time, so those need no runtime test. Nothing catches a missing
// inferSurfaceFromPath branch, and its failure mode is silent: the page keeps
// reporting, just under the wrong label. That is why this file exists, and it
// follows cfb-rivalry-surface.test.ts, which was written for the same reason.
//
// WHAT WAS BROKEN. /about had no branch, so it fell through to web_other for
// every page_view AND for the app-download clicks fired from it, whose
// placement is 'about_cta'. The page was rewritten into the site's method page
// and there was no way to measure whether that worked.

test('/about infers web_about', () => {
  assert.equal(inferSurfaceFromPath('/about'), 'web_about');
});

test('the branch is a prefix match, so a future sub-path stays on the surface', () => {
  // If /about/editorial-policy or similar ever ships, it belongs to the same
  // surface rather than silently reverting to web_other.
  assert.equal(inferSurfaceFromPath('/about/'), 'web_about');
  assert.equal(inferSurfaceFromPath('/about/editorial-policy'), 'web_about');
});

test('branch order: nothing else was captured by the new branch', () => {
  // The obvious ordering hazard is a path that merely CONTAINS "about". None
  // exist today, and startsWith keeps it that way, but assert it so a future
  // rename cannot quietly widen the match.
  assert.equal(inferSurfaceFromPath('/'), 'web_home');
  assert.equal(inferSurfaceFromPath('/teams'), 'web_league_index');
  assert.equal(inferSurfaceFromPath('/my-teams'), 'web_my_teams');
  assert.equal(inferSurfaceFromPath('/promos/today'), 'web_today');
  assert.equal(inferSurfaceFromPath('/best-promos'), 'web_best_promos');
  assert.equal(inferSurfaceFromPath('/cfb'), 'web_cfb');
  assert.equal(inferSurfaceFromPath('/mlb/minnesota-twins'), 'web_team_page');
});

test('paths with no branch still fall through to web_other', () => {
  // Proves the new branch did not become a catch-all, and records which
  // surfaces are still unmeasured so a future pass can see them.
  assert.equal(inferSurfaceFromPath('/venues'), 'web_other');
  assert.equal(inferSurfaceFromPath('/terms'), 'web_other');
  assert.equal(inferSurfaceFromPath('/privacy'), 'web_other');
});
