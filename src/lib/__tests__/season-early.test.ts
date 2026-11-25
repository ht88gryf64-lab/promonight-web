// A SEASON NAMED EARLY, BY DATA (2026-11 fix round, ruling on item 2).
// A team page whose every upcoming row belongs to the next season names that
// season now; a league hub does once its season has ended and a club has
// published. Everything else keeps the label it had.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { hubLabelDay, nextSeasonNotYetOpen, seasonLabel, teamLabelDay } from '../seasons/season-window';
import { currentSeasonLabel } from '../season-label';
import { teamMetaTitle, teamTitleSubtitle } from '../title-treatment';

const T = '2026-11-25';

test('teamLabelDay: the next lead-in day only when every upcoming row is next season\'s', () => {
  // Giants: 42 rows from 2027-03-25. MLB 2027 opens 2027-03-24, lead-in 2027-02-07.
  assert.equal(teamLabelDay('MLB', T, ['2027-03-25', '2027-04-10', '2027-09-20']), '2027-02-07');
  assert.equal(seasonLabel('MLB', teamLabelDay('MLB', T, ['2027-03-25'])), '2027');
  // Twins: nothing ahead. No flip.
  assert.equal(teamLabelDay('MLB', T, []), T);
  // Past rows in the list are ignored (the caller passes upcoming rows, but a stray one must not flip or block).
  assert.equal(teamLabelDay('MLB', T, ['2026-09-20', '2027-03-25']), '2027-02-07');
  // One upcoming row outside the next season (an exhibition before the lead-in): no flip.
  assert.equal(teamLabelDay('MLB', T, ['2027-01-15', '2027-03-25']), T);
  // Galaxy: MLS 2026 runs to 2026-12-18, yet every upcoming row is 2027's. It flips (lead-in 2027-01-05).
  assert.equal(teamLabelDay('MLS', T, ['2027-02-20', '2027-05-08']), '2027-01-05');
  // Fire and Whitecaps: a playoff-dated 2026 row ahead keeps 2026.
  assert.equal(teamLabelDay('MLS', T, ['2026-12-02', '2027-03-06']), T);
  // NHL and NBA have no later window in the table: nothing to flip to.
  assert.equal(teamLabelDay('NHL', T, ['2027-10-10']), T);
  assert.equal(nextSeasonNotYetOpen('NHL', T), null);
  // Once the lead-in has opened the page has already moved; the day is today again.
  assert.equal(teamLabelDay('MLB', '2027-02-10', ['2027-03-25']), '2027-02-10');
  assert.equal(seasonLabel('MLB', '2027-02-10'), '2027');
  // Malformed dates are not rows of any season: no flip on them alone.
  assert.equal(teamLabelDay('MLB', T, ['2027-3-25', 'TBD']), T);
});

test('the title, the hero line and the season word all follow the one label day', () => {
  const giants = { id: 'san-francisco-giants', league: 'MLB', name: 'Giants' };
  const twins = { id: 'minnesota-twins', league: 'MLB', name: 'Twins' };
  const day = teamLabelDay('MLB', T, ['2027-03-25']);
  // Read on the real "today" of this fix round: pass the day explicitly so the test does not depend on the clock.
  assert.match(teamMetaTitle(giants, 'San Francisco Giants', day), /2027$/);
  assert.match(teamTitleSubtitle(giants, day), /2027$/);
  assert.equal(currentSeasonLabel('MLB', day), '2027');
  assert.match(teamMetaTitle(twins, 'Minnesota Twins', T), /2026$/);
  assert.match(teamTitleSubtitle(twins, T), /2026$/);
  // The page computes it once for the head and once (inside resolveClaimMode) for the body, from the same rows.
  const page = readFileSync(new URL('../../app/[sport]/[team]/page.tsx', import.meta.url), 'utf-8');
  assert.match(page, /const title = teamMetaTitle\(team, displayName, labelDay\);/);
  assert.match(page, /labelDay=\{claimMode\.labelDay\}/);
  const redesign = readFileSync(new URL('../../components/redesign/RedesignTeamPage.tsx', import.meta.url), 'utf-8');
  assert.match(redesign, /subtitle=\{teamTitleSubtitle\(team, claim\.labelDay\)\}/);
  assert.match(redesign, /labelDay=\{claim\.labelDay\}/);
  assert.match(readFileSync(new URL('../../components/json-ld.tsx', import.meta.url), 'utf-8'), /teamMetaTitle\(team, teamDisplayName\(team\), claim\.labelDay\)/);
  assert.match(readFileSync(new URL('../promo-helpers.ts', import.meta.url), 'utf-8'), /const year = currentSeasonLabel\(team\.league, claim\.labelDay\);/);
});

test('the upcoming list names the next season and counts what is announced; an unflipped page keeps "UPCOMING PROMOS"', () => {
  const list = readFileSync(new URL('../../components/promo-list.tsx', import.meta.url), 'utf-8');
  assert.match(list, /const earlySeasonLabel = labelDay && labelDay !== today \? currentSeasonLabel\(league, labelDay\) : null;/);
  assert.match(list, /earlySeasonLabel \? `\$\{earlySeasonLabel\} SEASON PROMOS` : 'UPCOMING PROMOS'/);
  assert.equal(list.match(/announced so far for the \$\{earlySeasonLabel\} season/g)?.length, 2, 'light and dark');
  // The archive's named season moves with the label day, so 2026 rows read "COMPLETED 2026 PROMOS" with their months, not "this season".
  assert.match(list, /const namedStartYear = seasonStartYear\(league, labelBy\);/);
});

test('hubLabelDay: league level, only after the season has ended and a club has published', () => {
  // MLB 2026 ended 2026-10-31; 8 clubs have 2027 rows.
  assert.equal(hubLabelDay('MLB', T, 8), '2027-02-07');
  assert.equal(seasonLabel('MLB', hubLabelDay('MLB', T, 8)), '2027');
  assert.equal(hubLabelDay('MLB', T, 0), T, 'no club has published: the hub keeps 2026');
  // MLS 2026 is still in play until 2026-12-18: the hub does not flip, whatever the Galaxy has published.
  assert.equal(hubLabelDay('MLS', T, 1), T);
  assert.equal(hubLabelDay('MLS', '2026-12-19', 1), '2027-01-05', 'the day after MLS Cup it does');
  // WNBA 2026 ended; no club has published 2027.
  assert.equal(hubLabelDay('WNBA', T, 0), T);
  // In season, and leagues with no later window: never.
  for (const lg of ['NHL', 'NBA', 'NFL']) assert.equal(hubLabelDay(lg, T, 30), T, lg);
  // Inside the lead-in the hub has already moved by itself.
  assert.equal(hubLabelDay('MLB', '2027-02-10', 8), '2027-02-10');
});

test('all six hubs read the hub season, and none reads seasonLabel directly', () => {
  for (const h of ['mlb', 'mls', 'wnba', 'nba', 'nhl', 'nfl']) {
    const src = readFileSync(new URL(`../../app/${h}/page.tsx`, import.meta.url), 'utf-8');
    const L = h.toUpperCase();
    assert.match(src, new RegExp(`hubCopy\\(\\(await getLeagueHubSeason\\('${L}'\\)\\)\\.label\\)`), `${h}: the head`);
    assert.match(src, new RegExp(`const hubSeason = await getLeagueHubSeason\\('${L}'\\);`), `${h}: the body`);
    assert.match(src, /hubSeason\.note \? <HubSeasonNote text=\{hubSeason\.note\} \/> : undefined/, `${h}: the note`);
    assert.doesNotMatch(src, /seasonLabel\(/, `${h}: no direct label read`);
  }
  const data = readFileSync(new URL('../data.ts', import.meta.url), 'utf-8');
  assert.match(data, /note: `\$\{clubs\.size\} of \$\{teams\.length\} clubs have published \$\{label\} promotions so far\.`/);
  // A league in play makes no read: the early return sits before the query.
  const fn = data.slice(data.indexOf('export const getLeagueHubSeason'), data.indexOf('// The super-header bands'));
  assert.ok(fn.indexOf("hubLabelDay(league, today, 1) === today) return same;") < fn.indexOf("db.collectionGroup('promos')"));
});
