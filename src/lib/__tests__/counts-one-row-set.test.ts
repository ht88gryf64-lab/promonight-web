// COUNTS THAT COME FROM ONE ROW SET (2026-11 fix round, items 10 and 11).
//  - The homepage Tonight lede states the pool whenever the rail is capped,
//    and the Today tile prints that same pool.
//  - Every printed venue total is the index-floor population /venues lists.
//  - The rivalry index never tags a canceled game "Played".
import { test, mock } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

mock.module('server-only', { namedExports: {} });
const read = (rel: string) => readFileSync(new URL(rel, import.meta.url), 'utf-8');
const code = (rel: string) => read(rel).split('\n').filter((l) => !/^\s*(\/\/|\*|\/\*)/.test(l)).join('\n');

const team = (id: string, league = 'NBA') => ({ id, league, name: id, city: id, abbreviation: 'X', primaryColor: '#000', secondaryColor: '#fff', sportSlug: league.toLowerCase() });
const row = (i: number, date: string, type = 'giveaway') => ({ date, time: '', opponent: 'V', type, title: `P${i}`, description: '', highlight: false, icon: '', recurring: false, team: team(`t${i}`) });

test('pickHeroBuckets reports the pool, and the lede states it only when the rail is capped', async () => {
  const { pickHeroBuckets, tonightLede } = await import('../../components/tonight-strip');
  const T = '2026-11-25';
  const fifteen = Array.from({ length: 15 }, (_, i) => row(i, T, i % 2 ? 'theme' : 'giveaway'));
  const b = pickHeroBuckets([...fifteen, row(99, '2026-11-26')] as never, T);
  assert.equal(b.tonight.length, 8, 'the rail is capped at 8');
  assert.equal(b.tonightTotal, 15, 'the pool is every row dated today');
  assert.equal(tonightLede(b.tonight.length, b.tonightTotal), '8 of 15 promos at games starting today.');
  const three = pickHeroBuckets(fifteen.slice(0, 3) as never, T);
  assert.deepEqual([three.tonight.length, three.tonightTotal], [3, 3]);
  assert.equal(tonightLede(3, 3), '3 promos at games starting today.');
  assert.equal(tonightLede(1, 1), '1 promo at games starting today.');
  assert.equal(tonightLede(8, 8), '8 promos at games starting today.', 'exactly at the cap: no pool');
  assert.equal(pickHeroBuckets([] as never, T).tonightTotal, 0);
});

test('the Today tile prints the rail pool, not its own count of a different row set', async () => {
  const { buildHomeCategoryTiles } = await import('../../components/redesign/home-category-tiles');
  const T = '2026-11-25';
  const future = Array.from({ length: 12 }, (_, i) => row(i, T));
  const today = (tiles: Array<{ key: string; count: number }>) => tiles.find((t) => t.key === 'today')?.count;
  assert.equal(today(buildHomeCategoryTiles(future as never, T, 15)), 15, 'the pool the lede states (it includes postseason rows the tile never read)');
  assert.equal(today(buildHomeCategoryTiles(future as never, T)), 12, 'without it, the old behaviour');
  assert.equal(today(buildHomeCategoryTiles(future as never, T, 0)), undefined, 'a zero tile is dropped, as before');
  // The page wires both from the one bucket result.
  const page = code('../../app/page.tsx');
  assert.match(page, /buildHomeCategoryTiles\(allFuture, today, heroBuckets\.tonightTotal\)/);
  assert.ok(page.indexOf('const heroBuckets = pickHeroBuckets') < page.indexOf('buildHomeCategoryTiles(allFuture, today, heroBuckets.tonightTotal)'));
  assert.match(code('../../components/redesign/HomePageV2.tsx'), /lede=\{tonightLede\(tonight\.length, heroBuckets\.tonightTotal \?\? tonight\.length\)\}/);
});

test('every printed venue total reads the index floor: the utility counts are subsets of what /venues lists', () => {
  const hub = code('../venue-hub.ts');
  const fn = hub.slice(hub.indexOf('export const getVenueUtilityCounts'), hub.indexOf('export const resolveTicketTeam'));
  assert.match(fn, /if \(!venueHubIsIndexable\(readIndexFloorFields\(d\)\)\) continue;\s*counts\.guideTotal\+\+;/);
  assert.doesNotMatch(fn, /d\.verified !== true/, 'no second, wider population');
  // The floor's `continue` comes before every topic increment.
  for (const k of ['parking', 'bag', 'transit', 'gates']) assert.ok(fn.indexOf('venueHubIsIndexable') < fn.indexOf(`counts.${k}++`), k);
  // The three readers of a venue population, and nothing else, call the floor on raw docs.
  assert.equal(hub.match(/venueHubIsIndexable\(readIndexFloorFields\(d\)\)/g)?.length, 4, 'team map, sitemap, /venues index, utility counts');
  assert.doesNotMatch(read('../venue-hub.ts') + read('../../app/page.tsx') + read('../../components/redesign/GamedayUtilityGrid.tsx'), /verifiedTotal/);
  assert.match(code('../../app/page.tsx'), /value: String\(venueCounts\.guideTotal\), label: 'Venue guides'/);
});

test('/venues does not say "verified" and states no listing rule', () => {
  const page = code('../../app/venues/page.tsx');
  assert.doesNotMatch(page, /verified/i);
  assert.match(page, /\{entries\.length\} gameday guides: bag/);
  // A stated rule ("at least two of ...") was false for a listed building whose page hides an excluded field.
  assert.doesNotMatch(page, /at least two|is listed here once/);
});

test('a hub naming next season early marks the clubs that have published', () => {
  for (const h of ['mlb', 'mls', 'wnba']) {
    assert.match(code(`../../app/${h}/page.tsx`), /subtitleByTeamId: Object\.fromEntries\(hubSeason\.publishedTeamIds\.map\(\(id\) => \[id, `\$\{hubSeason\.label\} promotions published`\]\)\)/, h);
  }
  // The card's accessible name carries the mark too.
  assert.match(code('../../components/hub/HubTeamGrid.tsx'), /aria-label=\{subtitle \? `\$\{name\} \$\{subtitle\}` : `\$\{name\} promotional schedule`\}/);
  const data = code('../data.ts');
  assert.match(data, /publishedTeamIds: \[\.\.\.clubs\]\.sort\(\),/);
  assert.match(data, /note: null, publishedTeamIds: \[\] \};/, 'empty when the hub has not flipped');
});
