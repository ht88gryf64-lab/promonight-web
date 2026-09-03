/* HotelsCTA's card copy, after the a/an fix. See known-issues entry 42.
 *
 * This one interpolates the NICKNAME, not the display name, so it breaks on a
 * different set of teams than the FAQ did: "a Athletics game", "a Orioles
 * game", and the two numeric clubs, "a 76ers game" and "a 49ers game", which a
 * spelling-based rule gets wrong in the opposite direction by returning "an".
 *
 * The card variant is rendered on /playoffs. The team-page path reaches it
 * through GameExpand inside ScheduleRow, which is a client component with a
 * lazy-mounted expand, so that copy never appears in served HTML and cannot be
 * checked by a curl. This test is the coverage for it.
 */
import { test } from 'node:test';
import assert from 'node:assert';
import { renderToStaticMarkup } from 'react-dom/server';
import { HotelsCTA } from '../affiliates/HotelsCTA';
import type { Team, Venue } from '@/lib/types';

const team = (city: string, name: string, id: string, league = 'MLB'): Team => ({
  id, city, name, abbreviation: 'XXX', primaryColor: '#000', secondaryColor: '#fff',
  league, sportSlug: league.toLowerCase(), division: 'Test Division',
});

// lat/lng present so resolveHotelLink returns a link and the card renders.
const venue: Venue = {
  slug: 'test-arena', name: 'Test Arena', address: '1 Test Way', team: 'Test',
  sport: 'Basketball', sportIcon: '', primaryColor: '#000', accentColor: '#fff',
  lat: 39.9, lng: -75.1, hasAmenityData: false, amenityCount: 0, league: 'NBA', teamId: 't',
};

const card = (t: Team) =>
  renderToStaticMarkup(
    <HotelsCTA team={t} venue={venue} surface="web_playoffs" placement="playoffs_hub" variant="card" />,
  );

test('numeric nicknames take "a", which a spelling rule gets wrong', () => {
  assert.match(card(team('Philadelphia', '76ers', 'philadelphia-76ers', 'NBA')),
    /Traveling for a 76ers game\?/);
  assert.match(card(team('San Francisco', '49ers', 'san-francisco-49ers', 'NFL')),
    /Traveling for a 49ers game\?/);
});

test('vowel-sound nicknames take "an"', () => {
  for (const [city, name, id] of [
    ['Oakland', 'Athletics', 'oakland-athletics'],
    ['Baltimore', 'Orioles', 'baltimore-orioles'],
    ['Houston', 'Astros', 'houston-astros'],
    ['Los Angeles', 'Angels', 'los-angeles-angels'],
  ] as const) {
    assert.match(card(team(city, name, id)), new RegExp(`Traveling for an ${name} game\\?`));
  }
});

test('consonant nicknames are unchanged', () => {
  assert.match(card(team('Detroit', 'Tigers', 'detroit-tigers')), /Traveling for a Tigers game\?/);
  assert.match(card(team('Chicago', 'Cubs', 'chicago-cubs')), /Traveling for a Cubs game\?/);
});

test('no card emits an article immediately before a vowel-initial nickname', () => {
  for (const [city, name, id] of [
    ['Oakland', 'Athletics', 'oakland-athletics'], ['Baltimore', 'Orioles', 'baltimore-orioles'],
    ['Las Vegas', 'Aces', 'las-vegas-aces'], ['New York', 'Islanders', 'new-york-islanders'],
  ] as const) {
    const html = card(team(city, name, id));
    assert.ok(!/Traveling for a [AEIOU]/.test(html), `${id} emits a wrong article`);
  }
});
