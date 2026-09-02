import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { CFB_VENUE_TIMEZONES, CFB_NEUTRAL_HUB_TIMEZONES, CFB_UNTRACKED_HOME_TIMEZONES, cfbVenueTimezone, cfbNeutralHubTimezone, cfbUntrackedHomeTimezone } from '../cfb/venue-timezones';

// Every zone must be one Intl accepts, and the map must cover the whole
// 2026 corpus: 86 campus stadiums and the 8 neutral buildings cfbGames reference.
// The coordinate check reads the lat/lng the generator left in the source
// comments, so a hand edit that moves a stadium a zone away trips here.

const ALL = { ...CFB_VENUE_TIMEZONES, ...CFB_NEUTRAL_HUB_TIMEZONES, ...CFB_UNTRACKED_HOME_TIMEZONES };

describe('CFB venue time zones', () => {
  test('86 campus venues, 8 neutral hubs, 50 untracked home schools plus venueless Washington State', () => {
    assert.equal(Object.keys(CFB_VENUE_TIMEZONES).length, 86);
    assert.equal(Object.keys(CFB_NEUTRAL_HUB_TIMEZONES).length, 8);
    assert.equal(Object.keys(CFB_UNTRACKED_HOME_TIMEZONES).length, 51);
  });

  test('every zone is a real IANA zone', () => {
    for (const [id, zone] of Object.entries(ALL)) {
      assert.doesNotThrow(() => new Intl.DateTimeFormat('en-US', { timeZone: zone }), `${id}: ${zone}`);
      assert.match(zone, /^(America|Pacific)\//, id);
    }
  });

  test('the zones that are NOT what longitude alone would say', () => {
    assert.equal(cfbVenueTimezone('albertsons-stadium'), 'America/Boise'); // Boise, Mountain
    assert.equal(cfbVenueTimezone('mountain-america-stadium'), 'America/Phoenix'); // Tempe, no DST
    assert.equal(cfbVenueTimezone('casino-del-sol-stadium'), 'America/Phoenix'); // Tucson, no DST
    assert.equal(cfbVenueTimezone('firstbank-stadium'), 'America/Chicago'); // Nashville, Central
    assert.equal(cfbVenueTimezone('jordan-hare-stadium'), 'America/Chicago'); // Auburn, Central
    assert.equal(cfbVenueTimezone('saban-field-at-bryant-denny-stadium'), 'America/Chicago'); // Tuscaloosa
    assert.equal(cfbVenueTimezone('neyland-stadium'), 'America/New_York'); // Knoxville, Eastern
    assert.equal(cfbNeutralHubTimezone('lambeau-field'), 'America/Chicago');
    assert.equal(cfbNeutralHubTimezone('nissan-stadium'), 'America/Chicago'); // Nashville
    assert.equal(cfbUntrackedHomeTimezone('hawaii'), 'Pacific/Honolulu'); // UNLV at Hawaii is stored "7:00 PM PT"
    assert.equal(cfbUntrackedHomeTimezone('texas-state'), 'America/Chicago');
    assert.equal(cfbUntrackedHomeTimezone('washington-state'), 'America/Los_Angeles'); // tracked, no venue doc
  });

  test('longitude sanity: nothing east of -85 is Central except the four named, nothing west of -114 is Pacific-or-Mountain except Boise', () => {
    const src = require('node:fs').readFileSync(require('node:path').join(__dirname, '../cfb/venue-timezones.ts'), 'utf8') as string;
    const rows = [...src.matchAll(/'([a-z0-9-]+)': '(America\/[A-Za-z_]+)', \/\/ [^(]*\(([-\d.]+), ([-\d.]+)\)/g)];
    assert.ok(rows.length >= 94, `parsed ${rows.length} rows from the source comments`);
    const centralEastOf85 = rows.filter((r) => r[2] === 'America/Chicago' && Number(r[4]) > -87.6).map((r) => r[1]).sort();
    assert.deepEqual(centralEastOf85, ['firstbank-stadium', 'jordan-hare-stadium', 'nissan-stadium', 'saban-field-at-bryant-denny-stadium']);
    const easternWestOf87 = rows.filter((r) => r[2] === 'America/New_York' && Number(r[4]) < -87.6);
    assert.deepEqual(easternWestOf87, []);
    const pacificEastOf114 = rows.filter((r) => r[2] === 'America/Los_Angeles' && Number(r[4]) > -114.5);
    assert.deepEqual(pacificEastOf114, []);
  });

  test('unmapped ids resolve to null, never a guess', () => {
    assert.equal(cfbVenueTimezone('not-a-venue'), null);
    assert.equal(cfbVenueTimezone(''), null);
    assert.equal(cfbNeutralHubTimezone(null), null);
    assert.equal(cfbUntrackedHomeTimezone('furman'), null);
  });
});
