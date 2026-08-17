// renderedKickoff is the ONE kickoff gate for the whole matchup family: meta
// description, visible lede, fact card and SportsEvent all consume it. The
// load-bearing case is verified:false + tbd:false — a concrete stored time the
// verify pass has NOT confirmed. That state does not exist in the corpus today
// (every verified:false game is also tbd:true) but it will once the verify
// pipeline lands fall kickoffs, and the gate must already hold.

import test from 'node:test';
import assert from 'node:assert/strict';
import { renderedKickoff } from '@/lib/cfb/metadata';
import type { MatchupPage } from '@/lib/cfb/matchups';

const game = (over: Record<string, unknown> = {}) =>
  ({
    date: '2026-11-27',
    verified: false,
    kickoff: { time: 'TBD', tz: 'TBD', tbd: true, windowFlex: null },
    ...over,
  }) as unknown as NonNullable<MatchupPage['game']>;

test('verified:false + tbd:false with a concrete stored time renders NOTHING', () => {
  assert.equal(
    renderedKickoff(game({ verified: false, kickoff: { time: '11:00 AM', tz: 'CT', tbd: false, windowFlex: null } })),
    null,
  );
});

test('the same announced time on a verified game renders with its tz', () => {
  assert.equal(
    renderedKickoff(game({ verified: true, kickoff: { time: '11:00 AM', tz: 'CT', tbd: false, windowFlex: null } })),
    '11:00 AM CT',
  );
});

test('verified but unannounced (tbd, empty, or literal TBD time) renders nothing', () => {
  assert.equal(renderedKickoff(game({ verified: true })), null);
  assert.equal(renderedKickoff(game({ verified: true, kickoff: { time: '', tz: 'CT', tbd: false, windowFlex: null } })), null);
  assert.equal(renderedKickoff(game({ verified: true, kickoff: { time: 'TBD', tz: 'CT', tbd: false, windowFlex: null } })), null);
});

test('a TBD tz is dropped from the rendered string, and a null game renders nothing', () => {
  assert.equal(renderedKickoff(game({ verified: true, kickoff: { time: '7:30 PM', tz: 'TBD', tbd: false, windowFlex: null } })), '7:30 PM');
  assert.equal(renderedKickoff(null), null);
});
