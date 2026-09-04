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
// PROCESS.ENV.TZ IS 'UTC', AND THAT CHANGE IS THE POINT (2026-09-01).
//
// This harness ran under America/New_York from the day it was written, while
// Vercel runs every build and render under UTC. The legacy MLB branch below
// formats with NO timeZone option, so its output IS the ambient zone: the
// harness was pinning Eastern values for a code path that shipped UTC values.
// It went green for months over a bug it was pointed straight at. Running the
// harness in the same zone production runs in is the only way these pins mean
// anything, and the MLB numbers below moved by five hours when it was set.
//
// The venue path formats with an explicit timeZone option, so it is
// tz-independent and its pins are unchanged.

process.env.TZ = 'UTC';

import { formatGameTime, gameZoneAbbrev, resolveGameInstant } from '../src/lib/format-game-time';
import { resolveMlbZone } from '../src/lib/mlb-venue-tz';

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

console.log('=== LEGACY UTC branch, pinned as the DEFECT it was ===');
// These pins are no longer an invariant to preserve. They are a record of what
// shipped, kept because formatGameTime is exported and the branch still exists.
// Nothing in the app reaches it: mapGameDoc resolves a real IANA zone for every
// MLB game before it leaves the data layer.
//
// Under TZ='UTC', matching production, the anchor Date.UTC(2026, 0, 1, h, m)
// renders as h. That is the whole bug in one line: 23:10 UTC is a 7:10 PM
// Eastern first pitch and this branch printed "11:10 PM".
//
// PREVIOUS PINS, under the harness's old TZ='America/New_York':
//   '23:10' -> '6:10 PM'   '00:35' -> '7:35 PM'
//   '17:00' -> '12:00 PM'  '20:00' -> '3:00 PM'
// Every one is five hours off what production served for the same input.
assertEq("'UTC', '23:10'",          formatGameTime('UTC', '23:10'),          '11:10 PM');
assertEq("'UTC', '00:35'",          formatGameTime('UTC', '00:35'),          '12:35 AM');
assertEq("'UTC', '17:00'",          formatGameTime('UTC', '17:00'),          '5:00 PM');
assertEq("'UTC', '20:00'",          formatGameTime('UTC', '20:00'),          '8:00 PM');
assertEq("'UTC', '' (empty)",       formatGameTime('UTC', ''),               '');
assertEq("'UTC', 'bad' (no match)", formatGameTime('UTC', 'bad'),            'bad');
// The legacy branch ignores the date arg entirely.
assertEq("'UTC', '23:10', date",    formatGameTime('UTC', '23:10', '2026-07-04'), '11:10 PM');
// It also has no venue to resolve, so it can never carry a zone label.
assertEq("gameZoneAbbrev('UTC')",   String(gameZoneAbbrev('UTC', '23:10', '2026-09-01')), 'null');

console.log('');
console.log('=== MLB on the venue path (the fix) ===');
// The same 23:10 UTC first pitch, now routed through the venue path the way
// mapGameDoc routes it. Dodger Stadium in September is PDT, UTC-7.
assertEq("LA, '02:10', '2026-09-01'",  formatGameTime('America/Los_Angeles', '02:10', '2026-09-01'), '7:10 PM');
assertEq("  + abbrev",                 formatGameTime('America/Los_Angeles', '02:10', '2026-09-01', gameZoneAbbrev('America/Los_Angeles', '02:10', '2026-09-01')), '7:10 PM PDT');
// White Sox, Rate Field, CDT in September.
assertEq("Chi, '23:40', '2026-09-04'", formatGameTime('America/Chicago', '23:40', '2026-09-04', gameZoneAbbrev('America/Chicago', '23:40', '2026-09-04')), '6:40 PM CDT');
// Red Sox, Fenway, EDT.
assertEq("NY, '22:45', '2026-09-05'",  formatGameTime('America/New_York', '22:45', '2026-09-05', gameZoneAbbrev('America/New_York', '22:45', '2026-09-05')), '6:45 PM EDT');
// Diamondbacks at Chase Field: Phoenix never observes DST, so the label is MST
// in September AND in January. A state-to-zone table would say MDT here.
assertEq("Phx, '01:40', '2026-09-02'", formatGameTime('America/Phoenix', '01:40', '2026-09-02', gameZoneAbbrev('America/Phoenix', '01:40', '2026-09-02')), '6:40 PM MST');
// THE CASE THAT JUSTIFIES KEYING ON VENUE, NOT CLUB. The Mexico City Series is
// a Diamondbacks home game played at Estadio Alfredo Harp Helu. Mexico dropped
// DST in 2022, so the venue is CST (UTC-6) while the club's own park is MST
// (UTC-7). Keying on the club would print this an hour early.
assertEq("venue lookup, Mexico City", resolveMlbZone('Estadio Alfredo Harp Helu', 'arizona-diamondbacks')?.tz ?? '', 'America/Mexico_City');
assertEq("club lookup, Diamondbacks", resolveMlbZone('Some Unmapped Park', 'arizona-diamondbacks')?.tz ?? '', 'America/Phoenix');
assertEq("MexCity, '23:05', '2026-04-25'", formatGameTime('America/Mexico_City', '23:05', '2026-04-25', gameZoneAbbrev('America/Mexico_City', '23:05', '2026-04-25')), '5:05 PM CST');
assertEq("  same game keyed on club", formatGameTime('America/Phoenix', '23:05', '2026-04-25', gameZoneAbbrev('America/Phoenix', '23:05', '2026-04-25')), '4:05 PM MST');
// Little League Classic at Journey Bank Ballpark: a Brewers home game in
// Williamsport PA, Eastern, while the club's park is Central.
assertEq("venue lookup, Williamsport", resolveMlbZone('Journey Bank Ballpark', 'milwaukee-brewers')?.tz ?? '', 'America/New_York');
assertEq("club lookup, Brewers",       resolveMlbZone('Some Unmapped Park', 'milwaukee-brewers')?.tz ?? '', 'America/Chicago');
// Map-miss policy: absence is null, never the sentinel and never a guess.
assertEq("unknown venue AND club", String(resolveMlbZone('Nowhere Park', 'not-a-team')), 'null');

console.log('');
console.log('=== instant resolution ===');
// The legacy sentinel carries no venue, so it resolves to no instant at all
// rather than to a Jan-1 anchor.
assertEq("resolveGameInstant('UTC')", String(resolveGameInstant('UTC', '23:10', '2026-09-01')), 'null');
assertEq("resolveGameInstant venue",  resolveGameInstant('America/Chicago', '00:15', '2026-09-14')?.toISOString() ?? '', '2026-09-15T00:15:00.000Z');

console.log('');
console.log('=== Venue path called with NO abbrev argument (formatter contract) ===');
// SECTION RENAMED 2026-09-04. This was "NFL path (real IANA tz), unchanged",
// which stopped describing production the day mapGameDoc began setting
// gameTimeZoneAbbrev for every league. The assertions below are still correct
// and still worth keeping, but what they pin is the FORMATTER CONTRACT when the
// fourth argument is absent, not what an NFL page now renders. Production NFL
// output is pinned in the labelled section further down.
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
// Absent or unresolvable abbrev still renders a bare time rather than a
// half-formed one. This is what a game whose instant cannot be resolved falls
// back to, and it is the reason gameZoneAbbrev returns null instead of a guess.
// (Until 2026-09-04 this pair also stood for "NFL never passes an abbrev".
// That is no longer true: every league passes one now. See the labelled
// section below.)
assertEq("abbrev undefined",          formatGameTime('America/Los_Angeles', '00:20', '2026-09-09', undefined), '5:20 PM');
assertEq("abbrev null",               formatGameTime('America/New_York', '17:00', '2026-09-13', null), '1:00 PM');

console.log('');
console.log('=== Zone labels, the production path for every league (2026-09-04) ===');
// mapGameDoc sets gameTimeZoneAbbrev for every league now, so these are the
// strings that actually reach a page. Each assertion pairs gameZoneAbbrev with
// formatGameTime exactly as the render does.
const lbl = (tz: string, hhmm: string, d: string) =>
  formatGameTime(tz, hhmm, d, gameZoneAbbrev(tz, hhmm, d));

// THE DEFECT THIS SHIPPED FOR. One 1:00 PM ET kickoff window, two venues, two
// different bare clock times on the same /nfl screen. The label is what tells
// a reader they are the same instant.
assertEq("hub window, Eastern venue", lbl('America/New_York', '17:00', '2026-09-13'), '1:00 PM EDT');
assertEq("hub window, Central venue", lbl('America/Chicago',  '17:00', '2026-09-13'), '12:00 PM CDT');
// The 4:25 PM ET window, which rendered as three different bare times.
assertEq("late window, Pacific",      lbl('America/Los_Angeles', '20:25', '2026-09-13'), '1:25 PM PDT');
assertEq("late window, Phoenix",      lbl('America/Phoenix',     '20:25', '2026-09-20'), '1:25 PM MST');

// International NFL. Before this change every one of these read "GMT+N".
assertEq("Melbourne, week 1",  lbl('Australia/Melbourne', '00:35', '2026-09-11'), '10:35 AM AEST');
assertEq("London, October",    lbl('Europe/London',       '13:30', '2026-10-11'), '2:30 PM BST');
assertEq("Munich, November",   lbl('Europe/Berlin',       '14:30', '2026-11-15'), '3:30 PM CET');
assertEq("Rio, September",     lbl('America/Sao_Paulo',   '20:25', '2026-09-27'), '5:25 PM BRT');
// NHL, Helsinki. The label map is not NFL-specific.
assertEq("Helsinki, November", lbl('Europe/Helsinki',     '17:00', '2026-11-12'), '7:00 PM EET');

// DST IS RESOLVED BY INTL, NOT BY THIS MAP, AND THESE PROVE IT.
// The Paris game kicks off at 13:30 UTC on 25 October 2026. European summer
// time ends at 01:00 UTC that same morning, so the correct label is CET and a
// per-venue table saying "CEST" would be wrong by an hour on exactly this
// fixture. One week earlier the same venue and the same UTC time is CEST.
assertEq("Paris, one week before the switch", lbl('Europe/Paris', '13:30', '2026-10-18'), '3:30 PM CEST');
assertEq("Paris, the day of the switch",      lbl('Europe/Paris', '13:30', '2026-10-25'), '2:30 PM CET');
// Melbourne runs the southern calendar: AEST in September, AEDT from October.
assertEq("Melbourne, southern summer",        lbl('Australia/Melbourne', '01:00', '2026-11-22'), '12:00 PM AEDT');
// London leaves BST on the same date Europe leaves CEST.
assertEq("London, after the switch",          lbl('Europe/London', '13:30', '2026-11-22'), '1:30 PM GMT');

// MEXICO CITY KEEPS "CST" DELIBERATELY. Its Intl long name is the literal
// string "Central Standard Time", identical to US Central, so the long-name
// map could not separate them; the short-name-first rule means it is never
// consulted. Mexico dropped DST in 2022, so this reads CST year round while US
// Central is CDT for half of it. Changing it would also move MLB's Mexico City
// Series output, which is out of scope for this change.
assertEq("Mexico City, NFL",   lbl('America/Mexico_City', '01:20', '2026-11-23'), '7:20 PM CST');
assertEq("Mexico City, MLB",   lbl('America/Mexico_City', '23:05', '2026-04-25'), '5:05 PM CST');

// MLB IS UNCHANGED BY CONSTRUCTION. Every MLB zone is North American, so Intl
// returns a letter abbreviation and the international map is never reached.
// Measured over the whole corpus on 2026-09-04: 4,185 game docs, 12 labels
// changed, all of them NFL or NHL international, zero MLB.
assertEq("MLB Dodgers",        lbl('America/Los_Angeles', '02:10', '2026-09-01'), '7:10 PM PDT');
assertEq("MLB Blue Jays",      lbl('America/Toronto',     '23:07', '2026-08-15'), '7:07 PM EDT');
// NHL still stores the legacy alias US/Eastern beside America/New_York for the
// same zone. Both must label identically or a schedule would disagree with
// itself across two docs.
assertEq("NHL legacy alias",   lbl('US/Eastern',      '23:00', '2026-12-18'), '6:00 PM EST');
assertEq("NHL canonical zone", lbl('America/Toronto', '23:00', '2026-12-18'), '6:00 PM EST');

// An unresolvable instant is never labelled with a guess.
assertEq("sentinel has no label", String(gameZoneAbbrev('UTC', '23:10', '2026-09-01')), 'null');
assertEq("bad tz has no label",   String(gameZoneAbbrev('Not/AZone', '23:10', '2026-09-01')), 'null');

console.log('');
if (failed === 0) {
  console.log('All assertions passed.');
  process.exit(0);
} else {
  console.log(`${failed} assertion(s) failed.`);
  process.exit(1);
}
