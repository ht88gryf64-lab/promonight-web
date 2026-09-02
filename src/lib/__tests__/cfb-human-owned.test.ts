import { test } from 'node:test';
import assert from 'node:assert/strict';
import { HUMAN_OWNED_FIELDS, pickHumanOwned } from '../cfb/human-owned';

// The parser object shape from scripts/cfb/run-phase2.ts:82-90. Nothing here is
// human-owned; a re-run is entitled to replace every one of these.
const parserDoc = {
  id: '2026-2026-10-31-florida-georgia',
  season: 2026,
  week: 8,
  date: '2026-10-31',
  status: 'scheduled',
  homeSchoolId: 'florida',
  awaySchoolId: 'georgia',
  neutralSite: true,
  venueId: '',
  kickoff: { time: '3:30 PM', tz: 'ET', tbd: false, windowFlex: null },
  broadcast: { network: 'ABC', confirmed: true },
  conferenceGame: true,
  rivalryId: 'florida--georgia',
  themeDesignations: [],
  source: 'https://floridagators.com/sports/football/schedule',
  confidence: 'HIGH',
  fetchedAt: '2026-08-11T00:00:00.000Z',
  verified: true,
  verification: null,
};

test('the allowlist is exactly the four human-owned fields', () => {
  // 2026-09-02: internationalVenue (a neutral site abroad with no hub doc) and
  // humanResolved (fields settled against an official source) joined the two
  // originals. Both are written by promo-pipeline cfb-sweep/resolve.ts, never
  // by the parser, and no schedule page can rebuild them.
  assert.deepEqual([...HUMAN_OWNED_FIELDS], ['tombstoned', 'neutralVenueHubSlug', 'internationalVenue', 'humanResolved']);
});

test('picks nothing from a doc that carries no human-owned fields', () => {
  assert.deepEqual(pickHumanOwned(parserDoc), {});
});

test('picks only the human-owned fields, never machine-owned ones', () => {
  const stored = { ...parserDoc, tombstoned: true, neutralVenueHubSlug: 'mercedes-benz-stadium' };
  assert.deepEqual(pickHumanOwned(stored), {
    tombstoned: true,
    neutralVenueHubSlug: 'mercedes-benz-stadium',
  });
});

test('omits absent fields entirely so a spread never writes undefined', () => {
  const stored = { ...parserDoc, neutralVenueHubSlug: 'lambeau-field' };
  const picked = pickHumanOwned(stored);
  assert.deepEqual(picked, { neutralVenueHubSlug: 'lambeau-field' });
  assert.equal('tombstoned' in picked, false);
});

test('preserves a false tombstone, which is meaningfully different from absent', () => {
  const picked = pickHumanOwned({ ...parserDoc, tombstoned: false });
  assert.deepEqual(picked, { tombstoned: false });
});

test('handles a doc that does not exist yet', () => {
  assert.deepEqual(pickHumanOwned(undefined), {});
  assert.deepEqual(pickHumanOwned(null), {});
});

// This is the whole point: the writer does { ...parserDoc, ...carried }, so a
// rebuild replaces every machine field and keeps the two human ones.
test('the write shape replaces machine fields and keeps human fields', () => {
  const stored: Record<string, unknown> = {
    ...parserDoc,
    broadcast: { network: 'TBD', confirmed: false },
    tombstoned: true,
    neutralVenueHubSlug: 'mercedes-benz-stadium',
  };
  const freshFromParser = { ...parserDoc, broadcast: { network: 'ABC', confirmed: true } };
  const written: Record<string, unknown> = { ...freshFromParser, ...pickHumanOwned(stored) };

  assert.deepEqual(written.broadcast, { network: 'ABC', confirmed: true }, 'machine field replaced');
  assert.equal(written.tombstoned, true, 'human field survived');
  assert.equal(written.neutralVenueHubSlug, 'mercedes-benz-stadium', 'human field survived');
});
