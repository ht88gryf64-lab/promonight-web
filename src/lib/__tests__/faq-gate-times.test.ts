/* The FAQ gate-time answer is a second, worse copy of the fabrication removed
 * from VenueInfoBlock: worse because it ships inside FAQPage JSON-LD, so the
 * invented time is a machine-readable claim to search engines and AI answers,
 * and worse because the comment at its call site read "always shown" — it never
 * consulted the stored value at all, on any of the 169 team pages. */
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

const venue = (gatesOpen?: string): Venue => ({
  slug: 'test-park', name: 'Test Park', address: '', team: 'Testville Niners',
  sport: 'Baseball', sportIcon: '', primaryColor: '#000', accentColor: '#fff',
  lat: 0, lng: 0, hasAmenityData: false, amenityCount: 0, league: 'MLB',
  teamId: 't', gatesOpen,
});

const gateFaqs = (v: Venue | null, league = 'MLB') =>
  generateTeamFAQs(team(league), [], v, COUNTS, COVERAGE)
    .filter((f) => /gates open/i.test(f.question));

test('no stored gatesOpen means no gate-times FAQ, on every league', () => {
  for (const league of ['MLB', 'NBA', 'NFL', 'NHL', 'MLS', 'WNBA']) {
    const faqs = gateFaqs(venue(undefined), league);
    assert.equal(faqs.length, 0, `${league}: a gate-time answer was invented with no stored value`);
  }
  assert.equal(gateFaqs(venue('   ')).length, 0, 'whitespace is not a gate time');
  assert.equal(gateFaqs(null).length, 0, 'no venue at all cannot yield a gate time');
});

test('a stored gatesOpen is published verbatim, not paraphrased into a range', () => {
  const stored = 'Gates open two hours before first pitch on Fridays only.';
  const faqs = gateFaqs(venue(stored));
  assert.equal(faqs.length, 1);
  assert.equal(faqs[0].answer, stored, 'the stored sentence must reach the reader unedited');
});

test('the invented league cadence appears nowhere in any answer', () => {
  for (const league of ['MLB', 'NBA', 'NFL', 'NHL', 'MLS', 'WNBA']) {
    const all = generateTeamFAQs(team(league), [], venue(undefined), COUNTS, COVERAGE);
    for (const f of all) {
      assert.ok(
        !/typically open/i.test(f.answer),
        `${league}: "${f.question}" still carries a manufactured gate time`,
      );
    }
  }
});
