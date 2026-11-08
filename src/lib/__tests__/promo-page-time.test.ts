// The game line's <time> (ruling 2026-11-08): the offset for the venue zone
// on the game's date, the generic abbreviation after the time, and nothing
// guessed when the page lacks a time or a zone.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { gameTimeMarkup, parseDisplayTime, zoneAbbrevAt, zoneOffsetAt } from '../promo-page-time';

test('a Chicago evening in October carries -05:00 and CT; the same wall time in January carries -06:00', () => {
  assert.deepEqual(gameTimeMarkup('2026-10-29', '7:00 PM', 'America/Chicago'), { dateTime: '2026-10-29T19:00:00-05:00', zone: 'CT' });
  assert.deepEqual(gameTimeMarkup('2027-01-05', '7:00 PM', 'America/Chicago'), { dateTime: '2027-01-05T19:00:00-06:00', zone: 'CT' });
  assert.deepEqual(gameTimeMarkup('2026-11-15', '5:00 PM', 'America/Los_Angeles'), { dateTime: '2026-11-15T17:00:00-08:00', zone: 'PT' });
  assert.deepEqual(gameTimeMarkup('2026-11-15', '12:30 PM', 'America/New_York'), { dateTime: '2026-11-15T12:30:00-05:00', zone: 'ET' });
  assert.deepEqual(gameTimeMarkup('2026-11-15', '12:05 AM', 'America/Denver'), { dateTime: '2026-11-15T00:05:00-07:00', zone: 'MT' });
});

test('Arizona keeps its standard name; no time means the date alone; no zone means the local time with no offset and no label', () => {
  assert.equal(gameTimeMarkup('2026-11-15', '7:00 PM', 'America/Phoenix').zone, 'MST');
  assert.deepEqual(gameTimeMarkup('2026-11-15', null, 'America/Chicago'), { dateTime: '2026-11-15', zone: null });
  assert.deepEqual(gameTimeMarkup('2026-11-15', 'TBD', 'America/Chicago'), { dateTime: '2026-11-15', zone: null });
  assert.deepEqual(gameTimeMarkup('2026-11-15', '7:00 PM', null), { dateTime: '2026-11-15T19:00:00', zone: null });
  assert.deepEqual(gameTimeMarkup('2026-11-15', '7:00 PM', 'Mars/Olympus'), { dateTime: '2026-11-15T19:00:00', zone: null });
  assert.deepEqual(gameTimeMarkup('not a date', '7:00 PM', 'America/Chicago'), { dateTime: 'not a date', zone: null });
});

test('the parsers', () => {
  assert.deepEqual(parseDisplayTime('7:00 PM'), { h: 19, m: 0 });
  assert.deepEqual(parseDisplayTime('12:00 AM'), { h: 0, m: 0 });
  assert.deepEqual(parseDisplayTime('12:00 PM'), { h: 12, m: 0 });
  assert.equal(parseDisplayTime('13:00 PM'), null);
  assert.equal(parseDisplayTime('7 PM'), null);
  assert.equal(zoneOffsetAt('Europe/London', new Date('2026-01-10T12:00:00Z')), '+00:00');
  assert.equal(zoneOffsetAt('Europe/London', new Date('2026-07-10T12:00:00Z')), '+01:00');
  // Outside North America en-US has no short letter name (London's generic
  // name is "United Kingdom Time", its short one "GMT+1"), so the label is
  // withheld rather than guessed; the offset still rides the <time>.
  assert.equal(zoneAbbrevAt('Europe/London', new Date('2026-07-10T12:00:00Z')), null);
  assert.equal(zoneAbbrevAt('America/Chicago', new Date('2026-07-10T12:00:00Z')), 'CT');
});
