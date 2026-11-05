// The promotional-schedule team title (serp-targeting, ruling 2026-11-05),
// checked against every one of the 169 team pages. The fixture is the live
// teams collection's id/league/city/name on 2026-11-05: the only fields the
// title path reads.
//
// The assertions are written against the RULING, not against the cascade
// helper, so an edit to title-treatment.ts fails here rather than agreeing
// with itself: the shape is matched by a regex built from the ruling's four
// forms, and the chosen tier must be the first form that fits.
import { test } from 'node:test';
import assert from 'node:assert';
import { readFileSync } from 'node:fs';
import { teamDisplayName } from '../team-display-name';
import { currentSeasonLabel } from '../season-label';
import { teamMetaTitle, TEAM_TITLE_MAX } from '../title-treatment';
import type { Team } from '../types';

const TEAMS: Array<{ id: string; league: string; city: string; name: string }> = JSON.parse(
  readFileSync(new URL('./fixtures/teams-169.json', import.meta.url), 'utf8'),
);
const asTeam = (t: (typeof TEAMS)[number]) => t as unknown as Team;

/** The ruling's four forms, in order. */
function rulingForms(t: (typeof TEAMS)[number]): string[] {
  const full = teamDisplayName(t);
  const season = currentSeasonLabel(t.league);
  return [
    `${full} Promotional Schedule & Giveaways ${season}`,
    `${t.name} Promotional Schedule & Giveaways ${season}`,
    `${full} Promo Schedule & Giveaways ${season}`,
    `${t.name} Promo Schedule & Giveaways ${season}`,
  ];
}

test('the fixture is all 169 team pages across six leagues', () => {
  assert.equal(TEAMS.length, 169);
  const by: Record<string, number> = {};
  for (const t of TEAMS) by[t.league] = (by[t.league] ?? 0) + 1;
  assert.deepEqual(by, { MLB: 30, MLS: 30, NBA: 30, NFL: 32, NHL: 32, WNBA: 15 });
});

test('every team title is within 60 rendered characters and names the promotional schedule', () => {
  for (const t of TEAMS) {
    const title = teamMetaTitle(asTeam(t), teamDisplayName(t));
    assert.ok(title.length <= TEAM_TITLE_MAX, `${t.id} is ${title.length}: ${title}`);
    assert.ok(/Promotional Schedule|Promo Schedule/.test(title), `${t.id}: ${title}`);
    assert.ok(!title.includes(' | PromoNight'), `${t.id}: the title is absolute, no suffix`);
    assert.ok(!title.includes('—'), `${t.id}: no em dash`);
  }
});

test('the title is the FIRST ruling form that fits, so no word is ever cut', () => {
  const tiers = [0, 0, 0, 0];
  for (const t of TEAMS) {
    const title = teamMetaTitle(asTeam(t), teamDisplayName(t));
    const forms = rulingForms(t);
    const first = forms.findIndex((f) => f.length <= TEAM_TITLE_MAX);
    assert.ok(first >= 0, `${t.id} fits no tier of the cascade`);
    assert.equal(title, forms[first], t.id);
    tiers[first]++;
  }
  // Measured 2026-11-05: 161 full name, 8 nickname, none needing the short
  // "Promo Schedule" forms. A change here is a change in the team list or the
  // season label, and the Gate 2 report quotes these numbers.
  assert.deepEqual(tiers, [161, 8, 0, 0]);
});

test('the named low-CTR teams render the full-name form', () => {
  const want: Record<string, string> = {
    'washington-capitals': 'Washington Capitals Promotional Schedule & Giveaways 2026-27',
    'los-angeles-lakers': 'Los Angeles Lakers Promotional Schedule & Giveaways 2026-27',
    'anaheim-ducks': 'Anaheim Ducks Promotional Schedule & Giveaways 2026-27',
    'chicago-bulls': 'Chicago Bulls Promotional Schedule & Giveaways 2026-27',
    'new-york-knicks': 'New York Knicks Promotional Schedule & Giveaways 2026-27',
    'los-angeles-rams': 'Los Angeles Rams Promotional Schedule & Giveaways 2026',
  };
  for (const [id, title] of Object.entries(want)) {
    const t = TEAMS.find((x) => x.id === id)!;
    assert.equal(teamMetaTitle(asTeam(t), teamDisplayName(t)), title, id);
  }
});
