/* The a/an fix reaches FAQPage STRUCTURED DATA, not just visible copy.
 *
 * known-issues entry 42: promo-helpers.ts wrote a literal "a" before an
 * interpolated team name in the always-shown hotels FAQ, so 20 of 169 teams
 * rendered "For a Atlanta Braves game weekend". json-ld.tsx builds the FAQPage
 * from that same generateTeamFAQs output, so the error was in machine-readable
 * claims on 20 indexed pages, where a reader has no page to check it against.
 *
 * This asserts the fixed string in the EMITTED JSON-LD, not in the source, so a
 * future refactor that stops routing the FAQs through generateTeamFAQs fails
 * here rather than silently reintroducing the defect.
 */
import { test } from 'node:test';
import assert from 'node:assert';
import { renderToStaticMarkup } from 'react-dom/server';
import { JsonLd } from '../json-ld';
import type { Team, Venue, PromoType } from '@/lib/types';

const team = (city: string, name: string, id: string): Team => ({
  id, city, name, abbreviation: 'XXX', primaryColor: '#000', secondaryColor: '#fff',
  league: 'MLB', sportSlug: 'mlb', division: 'Test Division',
});

const venue: Venue = {
  slug: 'test-park', name: 'Test Park', address: '1 Test Way', team: 'Test',
  sport: 'Baseball', sportIcon: '', primaryColor: '#000', accentColor: '#fff',
  lat: 0, lng: 0, hasAmenityData: false, amenityCount: 0, league: 'MLB', teamId: 't',
};

const counts: Record<PromoType, number> = { giveaway: 0, theme: 0, kids: 0, food: 0 };
const coverage = { teamCount: 169, leagueList: 'MLB, NBA and NFL', appLeagueList: 'MLB and NBA' };

/** Every FAQPage answer string the component actually emits. */
function faqAnswers(t: Team): string[] {
  const html = renderToStaticMarkup(
    <JsonLd team={t} upcomingPromos={[]} venue={venue} upcomingCounts={counts} coverage={coverage} />,
  );
  const answers: string[] = [];
  for (const m of html.matchAll(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/g)) {
    // The component HTML-escapes the JSON payload; undo the entities React adds.
    const raw = m[1].replace(/&quot;/g, '"').replace(/&#x27;/g, "'").replace(/&amp;/g, '&');
    let parsed: unknown;
    try { parsed = JSON.parse(raw); } catch { continue; }
    const walk = (n: unknown): void => {
      if (Array.isArray(n)) return n.forEach(walk);
      if (!n || typeof n !== 'object') return;
      const o = n as Record<string, unknown>;
      if (o['@type'] === 'Answer' && typeof o.text === 'string') answers.push(o.text);
      Object.values(o).forEach(walk);
    };
    walk(parsed);
  }
  assert.ok(answers.length > 0, 'no FAQPage answers were emitted at all');
  return answers;
}

test('a vowel-sound team name gets "an" inside the FAQPage JSON-LD', () => {
  const answers = faqAnswers(team('Atlanta', 'Braves', 'atlanta-braves')).join(' ');
  assert.match(answers, /an Atlanta Braves game weekend/);
  assert.ok(!/\ba Atlanta Braves\b/.test(answers), 'the old literal article is still in structured data');
});

test('a consonant team name is unchanged inside the FAQPage JSON-LD', () => {
  const answers = faqAnswers(team('Detroit', 'Tigers', 'detroit-tigers')).join(' ');
  assert.match(answers, /a Detroit Tigers game weekend/);
  assert.ok(!/an Detroit Tigers/.test(answers), 'a consonant name was given "an"');
});

test('no FAQPage answer emits an article immediately before a vowel-initial word', () => {
  // The class, not just the one string: scans every emitted answer for " a "
  // followed by a vowel-sound opener.
  for (const [city, name, id] of [
    ['Atlanta', 'Braves', 'atlanta-braves'], ['Oakland', 'Athletics', 'oakland-athletics'],
    ['Arizona', 'Diamondbacks', 'arizona-diamondbacks'], ['Indiana', 'Fever', 'indiana-fever'],
  ] as const) {
    for (const ans of faqAnswers(team(city, name, id))) {
      assert.ok(!/\ba [AEIOU]/.test(ans), `"${id}" emits a wrong article: ${ans}`);
    }
  }
});

// ── the Event cap (2026-11-18) ──────────────────────────────────────────────
// One Event per upcoming promo was unbounded; the Braves' 73 promos for 2027
// took their team page over the 950,000-byte cap. The structured data names
// the next TEAM_EVENT_JSONLD_MAX, soonest first.
import { TEAM_EVENT_JSONLD_MAX } from '../json-ld';
import type { Promo } from '@/lib/types';

test('the team page names at most the next 20 upcoming promos as Events, soonest first, and no partner URL', () => {
  const day = (i: number) => new Date(Date.UTC(2027, 3, 1 + i)).toISOString().slice(0, 10);
  // The known-bad input: 73 upcoming promos, handed over in reverse order.
  const promos = Array.from({ length: 73 }, (_, i) => ({ title: `Promo ${i}`, date: day(i), type: 'giveaway', description: '' }) as unknown as Promo).reverse();
  const html = renderToStaticMarkup(
    <JsonLd team={team('Atlanta', 'Braves', 'atlanta-braves')} upcomingPromos={promos} venue={venue} upcomingCounts={counts} coverage={coverage} />,
  );
  const blocks = [...html.matchAll(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/g)].map((m) => JSON.parse(m[1].replace(/&quot;/g, '"').replace(/&amp;/g, '&').replace(/&#x27;/g, "'").replace(/&lt;/g, '<').replace(/&gt;/g, '>')));
  const events = blocks.filter((b) => b['@type'] === 'Event');
  assert.equal(TEAM_EVENT_JSONLD_MAX, 20);
  assert.equal(events.length, 20);
  assert.deepEqual(events.map((e) => e.startDate), Array.from({ length: 20 }, (_, i) => day(i)));
  // No partner URL or sub ID. (A partner's NAME in an FAQ answer is prose, not a link.)
  const hit = /lusg\.net|ticketnetwork\.com|ticketmaster\.com|spothero\.com|expedia\.com|fanatics\.com|subId\d|aff_sub|evyy\.net/i.exec(JSON.stringify(blocks));
  assert.equal(hit, null, hit?.[0]);
  // Fewer than the cap: every one is named.
  const few = renderToStaticMarkup(<JsonLd team={team('Atlanta', 'Braves', 'atlanta-braves')} upcomingPromos={promos.slice(0, 3)} venue={venue} upcomingCounts={counts} coverage={coverage} />);
  assert.equal((few.match(/"@type":"Event"|&quot;@type&quot;:&quot;Event&quot;/g) ?? []).length, 3);
});
