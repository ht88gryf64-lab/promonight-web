// The shared page/referrer record behind every page_view's page_location and
// page_referrer. These pin the four things the production measurement of
// 2026-10-20 got wrong from GA4's own dl/dr: card click, header nav, Back, and
// a query-only change on /teams.
//
// Run with:
//   node --import tsx --experimental-test-module-mocks --test <this file>

import { test, beforeEach } from 'node:test';
import assert from 'node:assert';
import {
  enterPage,
  resetPageHistoryForTests,
  samePath,
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
