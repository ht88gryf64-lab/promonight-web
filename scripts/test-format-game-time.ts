/* eslint-disable no-console */
// Tiny tsx-runnable assertion suite for src/lib/format-game-time.ts.
//
// The codebase does not have a test runner today (no jest, vitest, or
// playwright config). Pulling one in is out of scope for the NFL
// ingestion branch, so the invariant the Phase 3 spec calls out — "MLB
// output must be bit-for-bit identical when gameTimeTz === 'UTC'" — is
// pinned here instead. Run with:
//   tsx --env-file=.env.local --require ./scripts/stub-server-only.cjs \
//     scripts/test-format-game-time.ts
//
// Exits 1 on the first mismatch, 0 on green.
//
// Process.env.TZ is set to America/New_York at the top so MLB
// viewer-local renders are deterministic across machines; the NFL path
// formats with an explicit timeZone option so it's tz-independent.

process.env.TZ = 'America/New_York';

import { formatGameTime } from '../src/lib/format-game-time';

let failed = 0;

function assertEq(label: string, actual: string, expected: string) {
  if (actual === expected) {
    console.log(`  ok   ${label} -> "${actual}"`);
  } else {
    failed += 1;
    console.log(`  FAIL ${label}`);
    console.log(`         expected "${expected}"`);
    console.log(`         actual   "${actual}"`);
  }
}

console.log('=== MLB invariant (tz === "UTC") ===');
// These outputs were verified against the existing inline implementation
// in team-calendar.tsx before extraction. Any change to formatGameTime
// that breaks these means the MLB path drifted.
//
// Eastern is UTC-5 in January, so the Date.UTC(2026, 0, 1, h, m) anchor
// renders as h - 5 in ET. 23:10 UTC -> 18:10 ET. 00:35 UTC -> 19:35 ET
// (previous day, but toLocaleTimeString only shows time).
assertEq("'UTC', '23:10'",          formatGameTime('UTC', '23:10'),          '6:10 PM');
assertEq("'UTC', '00:35'",          formatGameTime('UTC', '00:35'),          '7:35 PM');
assertEq("'UTC', '17:00'",          formatGameTime('UTC', '17:00'),          '12:00 PM');
assertEq("'UTC', '20:00'",          formatGameTime('UTC', '20:00'),          '3:00 PM');
assertEq("'UTC', '' (empty)",       formatGameTime('UTC', ''),               '');
assertEq("'UTC', 'bad' (no match)", formatGameTime('UTC', 'bad'),            'bad');
// The MLB path ignores the date arg entirely; passing one must produce
// identical output to omitting it.
assertEq("'UTC', '23:10', date",    formatGameTime('UTC', '23:10', '2026-07-04'), '6:10 PM');

console.log('');
console.log('=== NFL path (real IANA tz) ===');
// Week 1 Patriots @ Seahawks: kickoff UTC 2026-09-10T00:20Z, venue-local
// date 2026-09-09 in America/Los_Angeles (PDT, UTC-7). Local time 5:20 PM.
assertEq("LA, '00:20', '2026-09-09'", formatGameTime('America/Los_Angeles', '00:20', '2026-09-09'), '5:20 PM');
// Sunday 1pm ET kickoff: UTC 17:00 on the same date. Eastern = 1:00 PM.
assertEq("NY, '17:00', '2026-09-13'", formatGameTime('America/New_York', '17:00', '2026-09-13'), '1:00 PM');
// Chicago: same UTC 17:00 -> 12:00 PM CT.
assertEq("Chi, '17:00', '2026-09-13'", formatGameTime('America/Chicago', '17:00', '2026-09-13'), '12:00 PM');
// Cardinals no-DST: in September Phoenix is on UTC-7 (same as PDT). 20:25
// UTC -> 1:25 PM in Phoenix.
assertEq("Phx, '20:25', '2026-09-20'", formatGameTime('America/Phoenix', '20:25', '2026-09-20'), '1:25 PM');
// Cardinals no-DST in January: rest of country falls back to standard
// (UTC-7 Mountain == Phoenix), so 21:05 UTC -> 2:05 PM. The point is
// the formatter never says "UTC-6" / "MDT" for Phoenix.
assertEq("Phx, '21:05', '2027-01-03'", formatGameTime('America/Phoenix', '21:05', '2027-01-03'), '2:05 PM');
// International: Melbourne, UTC 2026-09-11T00:35Z -> Friday 2026-09-11
// 10:35 AM AEST. The venue-local date stored is 2026-09-11.
assertEq("Melb, '00:35', '2026-09-11'", formatGameTime('Australia/Melbourne', '00:35', '2026-09-11'), '10:35 AM');
// International: London, UTC 13:30 -> 2:30 PM BST in October.
assertEq("Lon, '13:30', '2026-10-11'",  formatGameTime('Europe/London', '13:30', '2026-10-11'),  '2:30 PM');
// Cross-midnight UTC: Sunday night football PT, UTC 2026-09-15T00:15Z
// -> Monday 00:15 UTC, venue-local date 2026-09-14 in Chicago at 7:15
// PM CT. Important regression case for the date-offset resolver.
assertEq("Chi, '00:15', '2026-09-14'", formatGameTime('America/Chicago', '00:15', '2026-09-14'), '7:15 PM');
// Missing date arg on NFL path falls back to raw hhmm.
assertEq("LA, '00:20' (no date)",      formatGameTime('America/Los_Angeles', '00:20'),         '00:20');
// Bad date arg falls back to raw hhmm.
assertEq("LA, '00:20', 'bad'",         formatGameTime('America/Los_Angeles', '00:20', 'bad'),  '00:20');

console.log('');
if (failed === 0) {
  console.log('All assertions passed.');
  process.exit(0);
} else {
  console.log(`${failed} assertion(s) failed.`);
  process.exit(1);
}
