/* The gate-time FAQ is gone, not gated.
 *
 * History, because the same slot failed twice in different ways. It first
 * published a hardcoded league cadence that never read the stored value at all,
 * on 169 pages, inside FAQPage JSON-LD. That was replaced on 2026-08-29 by
 * verbatim publication of venues.gatesOpen. Verifying that field against
 * operators then found 5 of 17 claims outright false and 3 unverifiable, so the
 * second version was a better-sourced version of the same wrong answer.
 * The slot is removed. See audit/venues-batch-provenance-audit.md. */
import { test } from 'node:test';
import assert from 'node:assert';
import { generateTeamFAQs } from '../promo-helpers';
import type { Team, Venue, PromoType } from '../types';

const COVERAGE = { teamCount: 169, leagueList: 'six leagues', appLeagueList: 'four leagues' };
const COUNTS = { giveaway: 0, theme: 0, food: 0, other: 0 } as unknown as Record<PromoType, number>;
const team = (league: string): Team => ({
  id: 't', city: 'Testville', name: 'Niners', league,
  primaryColor: '#000', secondaryColor: '#fff',
} as unknown as Team);
const venue = (): Venue => ({
  slug: 'test-park', name: 'Test Park', address: '', team: 'Testville Niners',
  sport: 'Baseball', sportIcon: '', primaryColor: '#000', accentColor: '#fff',
  lat: 0, lng: 0, hasAmenityData: false, amenityCount: 0, league: 'MLB', teamId: 't',
});

test('no league asks the gate-time question at all', () => {
  for (const league of ['MLB', 'NBA', 'NFL', 'NHL', 'MLS', 'WNBA']) {
    for (const v of [venue(), null]) {
      const faqs = generateTeamFAQs(team(league), [], v, COUNTS, COVERAGE);
      assert.equal(
        faqs.filter((f) => /gates open/i.test(f.question)).length, 0,
        `${league}: the gate-time question is still being asked`,
      );
    }
  }
});

test('no answer anywhere carries a manufactured gate cadence', () => {
  for (const league of ['MLB', 'NBA', 'NFL', 'NHL', 'MLS', 'WNBA']) {
    for (const f of generateTeamFAQs(team(league), [], venue(), COUNTS, COVERAGE)) {
      assert.ok(!/typically open/i.test(f.answer), `${league}: "${f.question}" carries a gate cadence`);
    }
  }
});

test('the rest of the FAQ set survives, so this removed a slot and not the block', () => {
  const faqs = generateTeamFAQs(team('MLB'), [], venue(), COUNTS, COVERAGE);
  assert.ok(faqs.length >= 3, `expected the other answers to remain, got ${faqs.length}`);
  assert.ok(faqs.some((f) => /promotional events/i.test(f.question)), 'the tracking answer should remain');
});
