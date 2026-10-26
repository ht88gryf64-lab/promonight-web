// The status line for a club verified to publish only recurring deals
// (discovery-apply, 2026-10-24). The claim is about a real organization, so it
// is dated, expires, and yields to any playoff promo or package row.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { scheduleStatusLine, RECURRING_ONLY_PUBLISHED, VERIFIED_FOR_DAYS } from '../announcement-status';

const base = {
  league: 'NBA', showSchedule: true, seasonResolved: false, hasOtherPromos: true,
  hasPlayoffPromos: false, recurringDealCount: 1, teamId: 'new-york-knicks', displayName: 'New York Knicks', today: '2026-10-24',
};

test('a verified recurring-only club gets one dated sentence that names its deal', () => {
  assert.equal(RECURRING_ONLY_PUBLISHED['new-york-knicks'], '2026-10-24');
  assert.equal(
    scheduleStatusLine(base),
    "The New York Knicks haven't announced 2026-27 giveaways or theme nights yet (checked October 24). The recurring deal they list is on this page.",
  );
});

test('the claim never says nothing was published, and lapses with the verification window', () => {
  assert.doesNotMatch(scheduleStatusLine(base) ?? '', /haven't announced 2026-27 promotions/);
  const lapsed = new Date(Date.UTC(2026, 9, 24 + VERIFIED_FOR_DAYS)).toISOString().slice(0, 10);
  assert.equal(scheduleStatusLine({ ...base, today: lapsed }), null);
});

test('playoff promos, package rows or an unverified club keep the line off, as before', () => {
  assert.equal(scheduleStatusLine({ ...base, hasPlayoffPromos: true }), null);
  assert.equal(scheduleStatusLine({ ...base, hasTicketPackages: true }), null);
  assert.equal(scheduleStatusLine({ ...base, recurringDealCount: 0 }), null);
  assert.equal(scheduleStatusLine({ ...base, teamId: 'miami-heat', displayName: 'Miami Heat' }), null);
});
