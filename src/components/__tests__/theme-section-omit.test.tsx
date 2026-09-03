/* The 3.2 omit branch in ThemeSection, tested directly.
 *
 * The theme-night paragraph used to close with a sentence about entertainment,
 * merchandise and game-day experiences, byte-identical on all 30 MLB teams and
 * occupying the Google snippet on the "[team] theme nights" query. It was
 * replaced by the next three theme nights, named and dated.
 *
 * That replacement has a branch with no visible output: when the section
 * renders but no theme promo carries a usable date, the sentence is OMITTED.
 * Nothing stands in its place. A branch that emits nothing is exactly the kind
 * that regresses unnoticed into a filler sentence or a dangling "Next up:", so
 * it is pinned here.
 *
 * REACHABILITY, stated plainly so nobody reads more into a green run than is
 * there. This branch is currently UNREACHABLE from both call sites, and these
 * tests reach it only by constructing an input neither produces.
 * splitPromosByDate drops dateless promos from `upcoming` entirely, and both
 * the redesign template and the legacy team route derive promoCounts from that
 * same filtered array. So promoCounts.theme > 0 implies at least one DATED
 * theme promo is present, and the omit branch cannot fire. It is defensive
 * code, and these tests exist so it stays correct if a future caller ever
 * passes an unfiltered array.
 *
 * Assertions are scoped to the PARAGRAPH. The <ul> beneath it renders whatever
 * rows it is handed and would print an invalid date for a dateless row; that is
 * the same unreachable input and is deliberately out of scope here.
 */
import { test } from 'node:test';
import assert from 'node:assert';
import { renderToStaticMarkup } from 'react-dom/server';
import { TeamContentSections } from '../team-content-sections';
import type { Team, Promo, PromoType, Venue } from '@/lib/types';

const team: Team = {
  id: 'testville-niners', city: 'Testville', name: 'Niners', abbreviation: 'TVN',
  primaryColor: '#000', secondaryColor: '#fff', league: 'MLB', sportSlug: 'mlb',
  division: 'Test Division',
};

const venue: Venue = {
  slug: 'test-park', name: 'Test Park', address: '1 Test Way', team: 'Testville Niners',
  sport: 'Baseball', sportIcon: '', primaryColor: '#000', accentColor: '#fff',
  lat: 0, lng: 0, hasAmenityData: false, amenityCount: 0, league: 'MLB', teamId: 'testville-niners',
};

const themePromo = (over: Partial<Promo> = {}): Promo => ({
  date: '2026-09-20', time: '', opponent: 'Rivals', type: 'theme',
  title: 'Test Theme Night', description: '', highlight: false, icon: '',
  recurring: false, ...over,
});

// Only the theme count is non-zero, so ThemeSection is the only section rendered.
const counts = (theme: number): Record<PromoType, number> =>
  ({ giveaway: 0, theme, kids: 0, food: 0 });

/** The theme paragraph only. The <ul> below it is out of scope; see the header. */
function paragraph(promos: Promo[], theme: number, variant: 'dark' | 'light'): string {
  const html = renderToStaticMarkup(
    <TeamContentSections team={team} promos={promos} venue={venue} promoCounts={counts(theme)} variant={variant} />,
  );
  const m = html.match(/<p[^>]*>(The Testville Niners have[^<]*)<\/p>/);
  assert.ok(m, `${variant}: the theme paragraph did not render at all`);
  return m![1];
}

const DATELESS = [themePromo({ date: '', recurring: true, title: 'Every Friday Theme' })];

test('OMIT: no dated theme night leaves the count sentence alone and adds nothing', () => {
  for (const variant of ['dark', 'light'] as const) {
    const p = paragraph(DATELESS, 1, variant);

    assert.equal(
      p,
      'The Testville Niners have 1 theme night scheduled at Test Park during the 2026 season.',
      `${variant}: the paragraph should be the count sentence and nothing else`,
    );
    assert.ok(!/Next up/.test(p), `${variant}: a dangling "Next up" rendered`);
    assert.ok(!/none scheduled|check back|to be announced|TBA|TBD/i.test(p), `${variant}: filler rendered`);
    assert.ok(!/special entertainment|themed merchandise/i.test(p), `${variant}: the old boilerplate returned`);
    assert.ok(!/Invalid Date/.test(p), `${variant}: a dateless promo was dated`);
  }
});

test('CONTRAST: one dated theme night does emit the sentence, so the omit is a branch and not a dead path', () => {
  for (const variant of ['dark', 'light'] as const) {
    assert.match(paragraph([themePromo()], 1, variant), /Next up: Test Theme Night \(Sep 20\)\.$/);
  }
});

test('the sentence names only promos it can date, never padding to the count', () => {
  const p = paragraph([themePromo(), themePromo({ date: '', title: 'Dateless' })], 2, 'light');
  assert.match(p, /Next up: Test Theme Night \(Sep 20\)\.$/);
  assert.ok(!/Dateless/.test(p), 'a dateless promo was named in the sentence');
});
