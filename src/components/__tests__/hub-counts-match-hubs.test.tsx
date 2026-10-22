/* Counts that link to /promos/jersey-giveaways and /promos/bobbleheads must
 * count the rows those pages list (2026-10-22). Behavioural, not a source
 * grep: each surface is fed a mixed slate and its number is compared with the
 * hub predicate's own count of the same slate, so a local keyword filter, a
 * widened OR, or a lower-cased includes() all fail here.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';

import { buildHomeCategoryTiles } from '../redesign/home-category-tiles';
import { isBobbleheadHubRow, isJerseyHubRow } from '@/lib/promo-helpers';
import type { PromoWithTeam } from '@/lib/types';

const TODAY = '2026-10-22';
const team = { id: 'test-team', league: 'NHL' } as unknown as PromoWithTeam['team'];
let n = 0;
const row = (type: string, title: string, description = ''): PromoWithTeam =>
  ({ id: `p${n++}`, type, title, description, date: '2026-11-0' + ((n % 9) + 1), team }) as unknown as PromoWithTeam;

// Theme rows carry every keyword; only the giveaway rows may count.
const slate: PromoWithTeam[] = [
  row('giveaway', 'Replica Jersey'),
  row('giveaway', 'Rally Caps'),
  row('giveaway', 'Fan Night', 'First 10,000 fans receive hoodies'),
  row('giveaway', 'Kids Day', 'Mini Bobblehead for kids'),
  ...Array.from({ length: 5 }, (_, i) => row('giveaway', `Player ${i} Bobblehead`)),
  row('theme', 'Kopitar Jersey Retirement'),
  row('theme', 'Caps Holiday Party'),
  row('theme', 'Military Appreciation Night', 'First 10,000 fans receive a camo hat'),
  row('theme', 'Star Wars Night', 'Bobblehead ticket package'),
  row('theme', 'Bobblehead Bash'),
];
const jerseyCount = slate.filter(isJerseyHubRow).length;
const bobbleCount = slate.filter(isBobbleheadHubRow).length;

test('the slate separates the predicate from a keyword-only filter', () => {
  assert.equal(jerseyCount, 3);
  assert.equal(bobbleCount, 6);
});

test('homepage category tiles count the hub rows', () => {
  const tiles = buildHomeCategoryTiles(slate, TODAY);
  assert.equal(tiles.find((t) => t.href === '/promos/jersey-giveaways')?.count, jerseyCount);
  assert.equal(tiles.find((t) => t.href === '/promos/bobbleheads')?.count, bobbleCount);
});
