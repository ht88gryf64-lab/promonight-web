// Chip sourcing for the capture sheet's success state.
//
// Run with:
//   node --import tsx --experimental-test-module-mocks --test <this file>

import { test } from 'node:test';
import assert from 'node:assert';
import {
  MAX_CHIPS,
  selectChips,
  venueCitySiblingSlugs,
  type CaptureChipTeam,
} from '../chips';
import { VENUE_CITY_OVERRIDES } from '@/lib/venue-cities';

function team(id: string, name = id): CaptureChipTeam {
  return { id, name, displayName: `City ${name}`, league: 'MLB', sportSlug: 'mlb' };
}

// ── Venue-city siblings ─────────────────────────────────────────────────────

test('teams sharing a venue city string are siblings', () => {
  const overrides = {
    'dallas-cowboys': 'Arlington, TX',
    'texas-rangers': 'Arlington, TX',
    'la-galaxy': 'Carson, CA',
  };
  assert.deepStrictEqual(venueCitySiblingSlugs('dallas-cowboys', overrides), ['texas-rangers']);
  assert.deepStrictEqual(venueCitySiblingSlugs('texas-rangers', overrides), ['dallas-cowboys']);
});

test('a team is never its own sibling', () => {
  const overrides = { 'la-galaxy': 'Carson, CA' };
  assert.deepStrictEqual(venueCitySiblingSlugs('la-galaxy', overrides), []);
});

test('a team missing from the table has no siblings', () => {
  // The table is a hotel-link fallback holding only brand-city-differs-from-
  // stadium-city teams, so most of the 169 fall through here. That is the
  // documented ceiling on this rule, not a bug.
  assert.deepStrictEqual(venueCitySiblingSlugs('new-york-yankees', VENUE_CITY_OVERRIDES), []);
});

test('the real table pairs the known shared-suburb clubs', () => {
  // Guards against a future edit to venue-cities.ts silently emptying rule 2.
  assert.deepStrictEqual(
    venueCitySiblingSlugs('dallas-cowboys', VENUE_CITY_OVERRIDES),
    ['texas-rangers'],
  );
  assert.deepStrictEqual(
    venueCitySiblingSlugs('new-york-giants', VENUE_CITY_OVERRIDES),
    ['new-york-jets'],
  );
  assert.deepStrictEqual(
    venueCitySiblingSlugs('new-england-patriots', VENUE_CITY_OVERRIDES),
    ['new-england-revolution'],
  );
});

test('city matching is exact, so a shared state does not pair teams', () => {
  const overrides = { a: 'Arlington, TX', b: 'Frisco, TX' };
  assert.deepStrictEqual(venueCitySiblingSlugs('a', overrides), []);
});

// ── Chip selection ──────────────────────────────────────────────────────────

const POOL = {
  opponents: [team('tigers'), team('twins'), team('royals'), team('white-sox')],
  venueCity: [team('sibling-a'), team('sibling-b')],
};

test('expanded opponents lead, in the order they were expanded', () => {
  const chips = selectChips({
    pool: POOL,
    expandedOpponentIds: ['twins', 'tigers'],
    excludeIds: [],
  });
  assert.deepStrictEqual(chips.map((c) => c.id), ['twins', 'tigers', 'sibling-a']);
  assert.deepStrictEqual(chips.map((c) => c.source), ['opponent', 'opponent', 'venue_city']);
});

test('venue-city siblings only fill what opponents left', () => {
  const chips = selectChips({
    pool: POOL,
    expandedOpponentIds: ['tigers', 'twins', 'royals'],
    excludeIds: [],
  });
  assert.deepStrictEqual(chips.map((c) => c.id), ['tigers', 'twins', 'royals']);
});

test('the cap holds at three', () => {
  const chips = selectChips({
    pool: POOL,
    expandedOpponentIds: ['tigers', 'twins', 'royals', 'white-sox'],
    excludeIds: [],
  });
  assert.strictEqual(chips.length, MAX_CHIPS);
});

test('a team is never offered twice', () => {
  // A visitor who expands the same matchup twice emits the slug twice.
  const chips = selectChips({
    pool: POOL,
    expandedOpponentIds: ['tigers', 'tigers', 'twins'],
    excludeIds: [],
  });
  assert.deepStrictEqual(chips.map((c) => c.id), ['tigers', 'twins', 'sibling-a']);
});

test('excluded teams never appear', () => {
  // The page team is starred by the submit, and anything already starred would
  // make a chip a no-op dressed as an offer.
  const chips = selectChips({
    pool: POOL,
    expandedOpponentIds: ['tigers', 'twins'],
    excludeIds: ['tigers', 'sibling-a'],
  });
  assert.deepStrictEqual(chips.map((c) => c.id), ['twins', 'sibling-b']);
});

test('an opponent slug with no pool entry is skipped, not guessed at', () => {
  const chips = selectChips({
    pool: POOL,
    expandedOpponentIds: ['ghost', 'tigers'],
    excludeIds: [],
  });
  assert.deepStrictEqual(chips.map((c) => c.id), ['tigers', 'sibling-a', 'sibling-b']);
});

test('an empty pool yields no chips rather than throwing', () => {
  const chips = selectChips({
    pool: { opponents: [], venueCity: [] },
    expandedOpponentIds: ['tigers'],
    excludeIds: [],
  });
  assert.deepStrictEqual(chips, []);
});

test('an aggregator with no expansions and no siblings yields no chips', () => {
  const chips = selectChips({
    pool: { opponents: [], venueCity: [] },
    expandedOpponentIds: [],
    excludeIds: [],
  });
  assert.strictEqual(chips.length, 0);
});
