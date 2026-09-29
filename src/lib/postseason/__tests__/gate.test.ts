// The Playoffs link: shown while a series is still being played, shown for
// 14 days after the last one ended, hidden otherwise. One test per state,
// then the edges of each.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mapBracketDoc } from '../map';
import { CHAMPION_WINDOW_DAYS, playoffsLinkState, playoffsLinkVisible } from '../gate';
import type { Bracket } from '../types';
import { CAPTURED_AT, FIXTURE, IN_GAME_AT, loadDoc } from './helpers';

type Doc = Record<string, unknown>;
type RawSeries = Doc & { games: Doc[] };

function bracket(name: string, edit?: (d: Doc) => void): Bracket {
  const d = loadDoc(name);
  if (edit) edit(d);
  const b = mapBracketDoc(d, { league: d.league as 'MLB' | 'WNBA', season: d.season as number });
  assert.ok(b, `${name} maps`);
  return b;
}
const DAY = 24 * 60 * 60 * 1000;
const at = (iso: string, plusMs = 0) => new Date(Date.parse(iso) + plusMs);

// The last final game in each 2025 document, read from the fixture itself.
function lastFinalStart(name: string): string {
  const d = loadDoc(name);
  let latest = '';
  for (const s of d.series as RawSeries[]) {
    for (const g of s.games) {
      if (g.status !== 'final') continue;
      const iso = new Date(Date.parse(g.start as string)).toISOString();
      if (iso > latest) latest = iso;
    }
  }
  assert.ok(latest, `${name} holds a final game`);
  return latest;
}
const MLB_ENDED = lastFinalStart(FIXTURE.mlbFinal);
const WNBA_ENDED = lastFinalStart(FIXTURE.wnbaFinal);

test('the fixtures end when the record says they did', () => {
  // World Series Game 7, Nov 1 2025, 8 PM Eastern. WNBA Finals Game 4, Oct 10 2025.
  assert.equal(MLB_ENDED, '2025-11-02T00:00:00.000Z');
  assert.equal(WNBA_ENDED.slice(0, 10), '2025-10-11');
  assert.equal(CHAMPION_WINDOW_DAYS, 14);
});

// ---- State 1: active ----

test('ACTIVE: a bracket with a series that is not final shows the link', () => {
  for (const [name, now] of [[FIXTURE.mlbLive, CAPTURED_AT], [FIXTURE.wnbaLive, CAPTURED_AT], [FIXTURE.mlbInGame, IN_GAME_AT], [FIXTURE.mlbMixed, at('2025-10-09T03:08:00Z')]] as const) {
    assert.deepEqual(playoffsLinkState([bracket(name)], now), { state: 'active' }, name);
    assert.equal(playoffsLinkVisible([bracket(name)], now), true);
  }
});

test('ACTIVE: one league still playing keeps the link up after another has finished', () => {
  const state = playoffsLinkState([bracket(FIXTURE.wnbaFinal), bracket(FIXTURE.mlbMixed)], at(WNBA_ENDED, 60 * DAY));
  assert.deepEqual(state, { state: 'active' });
});

test('ACTIVE: one series short of finished is still active, however long ago the rest ended', () => {
  const b = bracket(FIXTURE.mlbFinal, (d) => {
    const ws = (d.series as RawSeries[]).find((s) => s.seriesKey === 'WS') as RawSeries;
    ws.status = 'live';
    ws.winner = null;
  });
  assert.deepEqual(playoffsLinkState([b], at(MLB_ENDED, 400 * DAY)), { state: 'active' });
});

test('ACTIVE: the clock plays no part while a series is being played', () => {
  const b = bracket(FIXTURE.mlbLive);
  for (const now of ['2020-01-01T00:00:00Z', '2026-09-29T17:15:00Z', '2040-01-01T00:00:00Z']) {
    assert.equal(playoffsLinkVisible([b], new Date(now)), true, now);
  }
});

// ---- State 2: the champion window ----

test('CHAMPION WINDOW: every series final, and the last one within 14 days', () => {
  const b = bracket(FIXTURE.mlbFinal);
  assert.deepEqual(playoffsLinkState([b], at(MLB_ENDED, 3 * DAY)), {
    state: 'champion_window',
    lastFinalAt: '2025-11-02T00:00:00.000Z',
    closesAt: '2025-11-16T00:00:00.000Z',
  });
  assert.equal(playoffsLinkVisible([b], at(MLB_ENDED, 3 * DAY)), true);
  assert.equal(playoffsLinkVisible([b], at(MLB_ENDED)), true, 'the night it ended');
  assert.equal(playoffsLinkVisible([b], at(MLB_ENDED, 13 * DAY + 23 * 60 * 60 * 1000)), true, 'the last hour of day 14');
});

test('CHAMPION WINDOW: the last instant of day 14 shows, the next millisecond does not', () => {
  const b = bracket(FIXTURE.mlbFinal);
  assert.equal(playoffsLinkState([b], at(MLB_ENDED, 14 * DAY)).state, 'champion_window');
  assert.deepEqual(playoffsLinkState([b], at(MLB_ENDED, 14 * DAY + 1)), { state: 'hidden', reason: 'window_closed' });
});

test('CHAMPION WINDOW: with two finished leagues it runs from the LAST series of them all', () => {
  const both = [bracket(FIXTURE.wnbaFinal), bracket(FIXTURE.mlbFinal)];
  // 20 days after the WNBA Finals ended, 22 days before the World Series did.
  // Read against the WNBA alone the window is closed.
  const now = at(WNBA_ENDED, 20 * DAY);
  assert.equal(playoffsLinkState([bracket(FIXTURE.wnbaFinal)], now).state, 'hidden');
  const later = at(MLB_ENDED, 10 * DAY);
  const state = playoffsLinkState(both, later);
  assert.equal(state.state, 'champion_window');
  if (state.state === 'champion_window') assert.equal(state.lastFinalAt, MLB_ENDED);
  // Order of the list does not matter.
  assert.deepEqual(playoffsLinkState([...both].reverse(), later), state);
  assert.equal(playoffsLinkVisible(both, at(MLB_ENDED, 14 * DAY + 1)), false);
});

test('CHAMPION WINDOW: a later rewrite of the document does not reopen or extend it', () => {
  const b = bracket(FIXTURE.mlbFinal);
  const rewritten: Bracket = { ...b, lastChangedAt: at(MLB_ENDED, 40 * DAY).toISOString() };
  assert.deepEqual(playoffsLinkState([rewritten], at(MLB_ENDED, 41 * DAY)), { state: 'hidden', reason: 'window_closed' });
  const open = playoffsLinkState([rewritten], at(MLB_ENDED, 5 * DAY));
  assert.equal(open.state, 'champion_window');
  if (open.state === 'champion_window') assert.equal(open.lastFinalAt, MLB_ENDED);
});

test('CHAMPION WINDOW: with no start on any final game it runs from the change stamp', () => {
  const b = bracket(FIXTURE.mlbFinal, (d) => {
    for (const s of d.series as RawSeries[]) for (const g of s.games) g.start = null;
  });
  assert.ok(b.lastChangedAt);
  const stamp = b.lastChangedAt as string;
  const state = playoffsLinkState([b], at(stamp, DAY));
  assert.equal(state.state, 'champion_window');
  if (state.state === 'champion_window') assert.equal(state.lastFinalAt, stamp);
  assert.equal(playoffsLinkVisible([b], at(stamp, 14 * DAY + 1)), false);
});

// ---- State 3: hidden ----

test('HIDDEN: no current-season bracket at all', () => {
  assert.deepEqual(playoffsLinkState([], CAPTURED_AT), { state: 'hidden', reason: 'no_bracket' });
  assert.equal(playoffsLinkVisible([], CAPTURED_AT), false);
});

test('HIDDEN: every series final and the window closed', () => {
  const b = bracket(FIXTURE.mlbFinal);
  for (const days of [15, 30, 120, 330]) {
    assert.deepEqual(playoffsLinkState([b], at(MLB_ENDED, days * DAY)), { state: 'hidden', reason: 'window_closed' }, `${days} days on`);
  }
  assert.equal(playoffsLinkVisible([bracket(FIXTURE.wnbaFinal), b], at(MLB_ENDED, 15 * DAY)), false);
});

test('HIDDEN: a finished bracket that cannot say when it finished opens no window', () => {
  const b = bracket(FIXTURE.mlbFinal, (d) => {
    for (const s of d.series as RawSeries[]) for (const g of s.games) g.start = null;
    delete d.lastChangedAt;
  });
  assert.deepEqual(playoffsLinkState([b], at(MLB_ENDED, DAY)), { state: 'hidden', reason: 'no_final_time' });
  // And it closes the window for the list it is in: "the last series in all
  // brackets" cannot be dated when one of them has no date.
  assert.equal(playoffsLinkVisible([bracket(FIXTURE.wnbaFinal), b], at(WNBA_ENDED, DAY)), false);
});
