// The shared page/referrer record behind every page_view's page_location and
// page_referrer. These pin the four things the production measurement of
// 2026-10-20 got wrong from GA4's own dl/dr: card click, header nav, Back, and
// a query-only change on /teams.
//
// Run with:
//   node --import tsx --experimental-test-module-mocks --test <this file>

import { test, beforeEach } from 'node:test';
import assert from 'node:assert';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import {
  enterPage,
  resetPageHistoryForTests,
  samePath,
  settlePendingPageView,
  syncPageUrl,
} from '../page-history';

const ORIGIN = 'https://www.getpromonight.com';

beforeEach(resetPageHistoryForTests);

test('first page of the load takes document.referrer', () => {
  const p = enterPage('/teams', `${ORIGIN}/teams`, 'https://www.google.com/');
  assert.strictEqual(p.url, `${ORIGIN}/teams`);
  assert.strictEqual(p.referrer, 'https://www.google.com/');
});

test('a direct first load has an empty referrer, not undefined', () => {
  assert.strictEqual(enterPage('/teams', `${ORIGIN}/teams`, '').referrer, '');
});

test('card click, header nav, Back: each referrer is the page just left', () => {
  enterPage('/teams', `${ORIGIN}/teams`, '');
  const team = enterPage('/mlb/arizona-diamondbacks', `${ORIGIN}/mlb/arizona-diamondbacks`, 'ignored');
  assert.strictEqual(team.referrer, `${ORIGIN}/teams`);
  const today = enterPage('/promos/today', `${ORIGIN}/promos/today`, 'ignored');
  assert.strictEqual(today.referrer, `${ORIGIN}/mlb/arizona-diamondbacks`);
  const back = enterPage('/mlb/arizona-diamondbacks', `${ORIGIN}/mlb/arizona-diamondbacks`, 'ignored');
  assert.strictEqual(back.referrer, `${ORIGIN}/promos/today`, 'Back is a page change like any other');
});

test('a second call for the current page returns it unchanged (two emitters, StrictMode)', () => {
  enterPage('/', `${ORIGIN}/`, '');
  const first = enterPage('/best-promos', `${ORIGIN}/best-promos?league=MLB`, '');
  const second = enterPage('/best-promos', `${ORIGIN}/best-promos?league=MLB`, '');
  assert.strictEqual(second, first);
  assert.strictEqual(second.referrer, `${ORIGIN}/`, 'never overwritten with the page itself');
});

test('a query-only change updates the URL the next page reports as its referrer', () => {
  enterPage('/teams', `${ORIGIN}/teams`, '');
  syncPageUrl('/teams', `${ORIGIN}/teams?league=NBA`);
  const next = enterPage('/nba/boston-celtics', `${ORIGIN}/nba/boston-celtics`, '');
  assert.strictEqual(next.referrer, `${ORIGIN}/teams?league=NBA`);
});

test('a query-only change does not mint a new page', () => {
  const p = enterPage('/teams', `${ORIGIN}/teams`, 'https://www.google.com/');
  syncPageUrl('/teams', `${ORIGIN}/teams?league=MLB`);
  const again = enterPage('/teams', `${ORIGIN}/teams?league=MLB`, '');
  assert.strictEqual(again, p);
  assert.strictEqual(again.referrer, 'https://www.google.com/');
});

test('syncPageUrl for a different pathname is ignored', () => {
  enterPage('/teams', `${ORIGIN}/teams`, '');
  syncPageUrl('/mlb/minnesota-twins', `${ORIGIN}/mlb/minnesota-twins`);
  assert.strictEqual(enterPage('/x', `${ORIGIN}/x`, '').referrer, `${ORIGIN}/teams`);
});

test('samePath tolerates percent-encoding on one side only', () => {
  assert.ok(samePath('/venues/estadio-de-béisbol', '/venues/estadio-de-b%C3%A9isbol'));
  assert.ok(!samePath('/teams', '/teams/'));
  assert.ok(samePath('/%E0%A4%A', '/%E0%A4%A'), 'malformed escape compares raw, never throws');
});

test('enterPage records origin + pathname when the location has already moved on', () => {
  // Back pressed before a just-committed page flushed its effects: the
  // location is the previous page by the time this page registers.
  enterPage('/teams', `${ORIGIN}/teams?league=NBA`, '');
  const p = enterPage('/nhl/boston-bruins', `${ORIGIN}/teams?league=NBA`, '');
  assert.strictEqual(p.url, `${ORIGIN}/nhl/boston-bruins`, 'never labelled with the page it left');
  assert.strictEqual(p.referrer, `${ORIGIN}/teams?league=NBA`);
});

test('enterPage keeps the full href, query included, when it matches the page', () => {
  const p = enterPage('/teams', `${ORIGIN}/teams?league=MLB`, '');
  assert.strictEqual(p.url, `${ORIGIN}/teams?league=MLB`);
});

function fakePending() {
  const calls: string[] = [];
  return { calls, flush: () => calls.push('flush'), cancel: () => calls.push('cancel') };
}

test('settle: left for another pathname flushes the pending view, exactly once', () => {
  const pending = fakePending();
  assert.strictEqual(settlePendingPageView(pending, '/promos/today', '/nhl/buffalo-sabres'), 'flush');
  assert.deepStrictEqual(pending.calls, ['flush']);
});

test('settle: still on the page (StrictMode re-run, unmount) cancels, never flushes', () => {
  const pending = fakePending();
  assert.strictEqual(settlePendingPageView(pending, '/nhl/buffalo-sabres', '/nhl/buffalo-sabres'), 'cancel');
  assert.deepStrictEqual(pending.calls, ['cancel']);
});

test('settle: an encoding-only difference is the same page', () => {
  const pending = fakePending();
  assert.strictEqual(settlePendingPageView(pending, '/venues/b%C3%A9isbol', '/venues/béisbol'), 'cancel');
});

test("Next's HistoryUpdater still writes history from useInsertionEffect", () => {
  // settlePendingPageView reads "left" from window.location at passive-cleanup
  // time. That is only true because Next writes pushState/replaceState in a
  // useInsertionEffect (mutation phase, before passive cleanups). If a Next
  // upgrade moves the write to a layout or passive effect, cleanup sees the
  // OLD location, cancels, and fast-leave page_views are dropped silently.
  // This test is the tripwire for that upgrade.
  const require = createRequire(import.meta.url);
  const src = readFileSync(require.resolve('next/dist/client/components/app-router.js'), 'utf8');
  const start = src.indexOf('function HistoryUpdater(');
  assert.ok(start >= 0, 'HistoryUpdater not found in next/dist/client/components/app-router.js');
  const next = src.indexOf('\nfunction ', start + 1);
  const body = src.slice(start, next === -1 ? undefined : next);
  const effectAt = body.search(/\.useInsertionEffect\)?\(/);
  assert.ok(effectAt >= 0, 'HistoryUpdater no longer uses useInsertionEffect: re-check settlePendingPageView');
  const afterEffect = body.slice(effectAt);
  assert.ok(afterEffect.includes('window.history.pushState('), 'pushState is not written from the insertion effect');
  assert.ok(afterEffect.includes('window.history.replaceState('), 'replaceState is not written from the insertion effect');
  for (const later of ['useLayoutEffect', 'useEffect)(']) {
    assert.ok(!body.includes(later) || body.indexOf(later) > body.indexOf('window.history.replaceState('),
      `HistoryUpdater gained a ${later} before its history write: re-check settlePendingPageView`);
  }
});
