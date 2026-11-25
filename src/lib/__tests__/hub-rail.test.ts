// THE LEAGUE HUB RAILS (2026-11 fix round): one card per team on the
// this-week rail, a count line that agrees with the stat bar, promo links
// that go to the promo's own page, and the same fallback the today board uses.
//
// Run with: node --import tsx --test <this file>
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import type { PromoWithTeam } from '../types';
import { HUB_RAIL_TEAM_LIMIT, buildHubRail, hubRailCountLine } from '../hub-rail';
import { promoPageHref } from '../promo-page-href';
import { promoAnchorId } from '../promo-helpers';

const team = (id: string) => ({ id, league: 'NBA', sportSlug: 'nba', city: id, name: id, primaryColor: '#000' });
const promo = (teamId: string, date: string, title: string, extra: Record<string, unknown> = {}) =>
  ({ team: team(teamId), date, title, type: 'giveaway', highlight: false, ...extra }) as unknown as PromoWithTeam;

// The /nba slate of 2026-11-25, first eight rows: four teams.
const NBA = [
  promo('golden-state-warriors', '2026-11-25', 'Warriors Cup Games Shirt'),
  promo('philadelphia-76ers', '2026-11-25', '76ers Cup Games Rally Towel'),
  promo('philadelphia-76ers', '2026-11-25', '76ers Cup Games'),
  promo('detroit-pistons', '2026-11-27', 'Statement Belt Bag'),
  promo('detroit-pistons', '2026-11-27', 'Shock Night'),
  promo('detroit-pistons', '2026-11-27', 'Cup Nights'),
  promo('charlotte-hornets', '2026-11-28', 'Buzz City Kids Day'),
  promo('charlotte-hornets', '2026-11-28', 'Hugo Squish Pillow'),
  promo('charlotte-hornets', '2026-11-30', 'Teal Tuesday'),
  promo('golden-state-warriors', '2026-11-29', 'Muggsy Bogues and Manute Bol Pin'),
];

test('one card per team: its soonest day, every promo of that day, and a count of its other days', () => {
  const rail = buildHubRail(NBA);
  assert.equal(rail.teamsTotal, 4);
  assert.deepEqual(rail.cards.map((c) => [c.team.id, c.date, c.promos.length, c.moreDays]), [
    ['golden-state-warriors', '2026-11-25', 1, 1],
    ['philadelphia-76ers', '2026-11-25', 2, 0],
    ['detroit-pistons', '2026-11-27', 3, 0],
    ['charlotte-hornets', '2026-11-28', 2, 1],
  ]);
  assert.deepEqual(rail.cards[1].promos.map((p) => p.title), ['76ers Cup Games Rally Towel', '76ers Cup Games'], 'both rows of one game sit in one card');
  // No team has two cards, so a (team, date) key is unique.
  const keys = rail.cards.map((c) => `${c.team.id}-${c.date}`);
  assert.equal(new Set(keys).size, keys.length);
  assert.equal(new Set(rail.cards.map((c) => c.team.id)).size, rail.cards.length);
  assert.equal(hubRailCountLine(rail), null, 'all four teams shown: no count line');
});

test('eight teams at most, and the count line says how many of how many', () => {
  assert.equal(HUB_RAIL_TEAM_LIMIT, 8);
  const thirteen = Array.from({ length: 13 }, (_, i) => [promo(`team-${String(i).padStart(2, '0')}`, `2026-11-${25 + (i % 5)}`, 'A'), promo(`team-${String(i).padStart(2, '0')}`, `2026-11-${25 + (i % 5)}`, 'B')]).flat()
    .sort((a, b) => a.date.localeCompare(b.date));
  const rail = buildHubRail(thirteen);
  assert.equal(rail.teamsTotal, 13, 'the stat bar figure: distinct teams in the slate');
  assert.equal(rail.cards.length, 8);
  assert.equal(hubRailCountLine(rail), 'Showing 8 of 13 teams');
  // Soonest first: no shown card is later than a hidden team's first day.
  const shown = new Set(rail.cards.map((c) => c.team.id));
  const lastShown = rail.cards[rail.cards.length - 1].date;
  for (const p of thirteen) if (!shown.has(p.team.id)) assert.ok(p.date >= lastShown);
  // Exactly eight teams: no line. Nine: "8 of 9".
  assert.equal(hubRailCountLine(buildHubRail(thirteen.filter((p) => p.team.id < 'team-08'))), null);
  assert.equal(hubRailCountLine(buildHubRail(thirteen.filter((p) => p.team.id < 'team-09'))), 'Showing 8 of 9 teams');
  // An unsorted slate and a team whose soonest day is not its first row still give the soonest day.
  const shuffled = [promo('b', '2026-11-29', 'Late'), promo('a', '2026-11-27', 'A'), promo('b', '2026-11-25', 'Early'), promo('b', '2026-11-25', 'Early too')];
  assert.deepEqual(buildHubRail(shuffled).cards.map((c) => [c.team.id, c.date, c.promos.map((p) => p.title), c.moreDays]), [['b', '2026-11-25', ['Early', 'Early too'], 1], ['a', '2026-11-27', ['A'], 0]]);
  // A limit of zero shows no cards and prints no count line.
  assert.equal(hubRailCountLine(buildHubRail(shuffled, 0)), null);
  assert.deepEqual(buildHubRail([]), { cards: [], teamsTotal: 0 });
});

test('the stat bar and the rail count the same thing', () => {
  const data = readFileSync(new URL('../data.ts', import.meta.url), 'utf-8');
  assert.match(data, /const teamsWithPromosThisWeek = new Set\(slate\.map\(\(p\) => p\.team\.id\)\)\.size;/);
  assert.doesNotMatch(data, /already dedupes to one promo per team/);
  const railSrc = readFileSync(new URL('../../components/hub/HubThisWeek.tsx', import.meta.url), 'utf-8');
  assert.match(railSrc, /const rail = buildHubRail\(slate\);/);
  assert.doesNotMatch(railSrc, /RAIL_LIMIT|slate\.slice\(/);
  assert.match(railSrc, /key=\{`\$\{team\.id\}-\$\{card\.date\}`\}/);
  assert.doesNotMatch(railSrc, /key=\{p\.team\.id\}/);
});

test('hub promo links: the promo page when the row has one, else its row on the team page', () => {
  const withPage = promo('houston-rockets', '2026-12-01', 'Fred VanVleet Bobblehead', { pageSlug: 'fred-vanvleet-bobblehead', pageSeason: '2026' });
  const without = promo('houston-rockets', '2026-12-03', 'Rockets Theme Night');
  const tombstoned = promo('houston-rockets', '2026-12-05', 'Gone', { pageSlug: 'gone', tombstoned: true });
  const href = (p: PromoWithTeam) => promoPageHref(p) ?? `/${p.team.sportSlug}/${p.team.id}#promo-${promoAnchorId(p)}`;
  assert.equal(href(withPage), '/nba/houston-rockets/promos/fred-vanvleet-bobblehead');
  assert.equal(href(without), '/nba/houston-rockets#promo-2026-12-03-rockets-theme-night');
  assert.equal(href(tombstoned), '/nba/houston-rockets#promo-2026-12-05-gone');
  // Both hub components build the href exactly that way, and neither hardcodes the fragment alone.
  for (const f of ['HubTodayPromos.tsx', 'HubThisWeek.tsx']) {
    const src = readFileSync(new URL(`../../components/hub/${f}`, import.meta.url), 'utf-8');
    assert.match(src, /const pageHref = promoPageHref\(p\);/, f);
    assert.match(src, /href=\{pageHref \?\? `/, f);
    // promo_link_click fires only for a link that really goes to a promo page.
    assert.match(src, /toPromoPage=\{pageHref !== null\}/, f);
    assert.match(src, /#promo-\$\{promoAnchorId\(p\)\}/, f);
    assert.doesNotMatch(src, /href=\{`\/\$\{p\.team\.sportSlug\}\/\$\{p\.team\.id\}#promo-/, f);
  }
  // On the this-week card the team name keeps the team link and the title carries the promo link.
  const week = readFileSync(new URL('../../components/hub/HubThisWeek.tsx', import.meta.url), 'utf-8');
  assert.match(week, /<a href=\{teamHref\}[^>]*>\s*\{name\}\s*<\/a>/);
  // Both plain links in the card are at least 24px tall.
  assert.equal(week.match(/<a href=\{teamHref\} className="[^"]*min-h-\[24px\]/g)?.length, 2);
  assert.match(week, /href=\{pageHref \?\? `\$\{teamHref\}#promo-\$\{promoAnchorId\(p\)\}`\}[\s\S]{0,1400}\{p\.title\}/);
  // The hub link fires the hub's tap event always, and the shared inbound event for a promo page.
  const link = readFileSync(new URL('../../components/hub/HubPromoLink.tsx', import.meta.url), 'utf-8');
  assert.match(link, /track\('this_week_card_tap', tap\);/);
  assert.match(link, /if \(toPromoPage\) \{\s*track\('promo_link_click', \{ surface: tap\.surface, team_slug: tap\.team_id, promo_id: tap\.promo_id, destination_url: href, \.\.\.utmTriplet\(\) \}\);/);
});
