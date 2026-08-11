// The school-page rivalry rail: what it shows, in what order, and what it
// refuses to show. The refusals are the point. A chip that links nowhere is
// worse than no chip, and the empty result is the COMMON case (41 of 86
// schools), so it has to be a normal return rather than an edge case.

import test from 'node:test';
import assert from 'node:assert/strict';
import { selectRailChips, RAIL_MAX_CHIPS } from '@/lib/cfb/rivalry-rail';
import { MATCHUP_REGISTRY } from '@/lib/cfb/matchup-registry';

const ironBowl = MATCHUP_REGISTRY.find((e) => e.slug === 'iron-bowl')!;
const theGame = MATCHUP_REGISTRY.find((e) => e.slug === 'the-game')!;
const eggBowl = MATCHUP_REGISTRY.find((e) => e.slug === 'egg-bowl')!;
const appleCup = MATCHUP_REGISTRY.find((e) => e.slug === 'apple-cup')!;
const redRiver = MATCHUP_REGISTRY.find((e) => e.slug === 'red-river-rivalry')!;

const game = (date: string, id: string | null, name = 'Some Rivalry') => ({
  date,
  rivalry: id ? { id, name } : null,
});

test('a school with no rivalry that has a page gets an empty rail, not a dead chip', () => {
  const chips = selectRailChips([
    game('2026-09-05', null),
    game('2026-09-12', 'not--a--registered--rivalry'),
    game('2026-09-19', null),
  ]);
  assert.deepEqual(chips, []);
});

test('an empty schedule is an empty rail', () => {
  assert.deepEqual(selectRailChips([]), []);
});

test('only rivalries with a matchup page become chips', () => {
  const chips = selectRailChips([
    game('2026-09-05', 'not--a--registered--rivalry'),
    game('2026-11-28', ironBowl.rivalryId),
  ]);
  assert.equal(chips.length, 1);
  assert.equal(chips[0].slug, 'iron-bowl');
});

test('chips are ordered by date, soonest first, regardless of input order', () => {
  const chips = selectRailChips([
    game('2026-11-28', ironBowl.rivalryId),
    game('2026-09-05', theGame.rivalryId),
    game('2026-10-17', eggBowl.rivalryId),
  ]);
  assert.deepEqual(chips.map((c) => c.slug), ['the-game', 'egg-bowl', 'iron-bowl']);
});

test('the input array is not mutated, since it is the rendered schedule', () => {
  const games = [
    game('2026-11-28', ironBowl.rivalryId),
    game('2026-09-05', theGame.rivalryId),
  ];
  const before = games.map((g) => g.date);
  selectRailChips(games);
  assert.deepEqual(games.map((g) => g.date), before);
});

test('the cap holds at 4, keeping the soonest four', () => {
  const chips = selectRailChips([
    game('2026-09-05', theGame.rivalryId),
    game('2026-09-12', eggBowl.rivalryId),
    game('2026-09-19', appleCup.rivalryId),
    game('2026-09-26', redRiver.rivalryId),
    game('2026-11-28', ironBowl.rivalryId),
  ]);
  assert.equal(chips.length, RAIL_MAX_CHIPS);
  assert.equal(chips.length, 4);
  assert.ok(!chips.some((c) => c.slug === 'iron-bowl'), 'the latest game is the one dropped');
  assert.deepEqual(chips.map((c) => c.slug), ['the-game', 'egg-bowl', 'apple-cup', 'red-river-rivalry']);
});

test('the same rivalry twice yields one chip, not two links to one page', () => {
  const chips = selectRailChips([
    game('2026-09-05', ironBowl.rivalryId),
    game('2026-11-28', ironBowl.rivalryId),
  ]);
  assert.equal(chips.length, 1);
  assert.equal(chips[0].date, '2026-09-05', 'the surviving chip keeps the soonest date');
});

test('a chip label uses the display-name override, so it agrees with the page H1', () => {
  const fg = MATCHUP_REGISTRY.find((e) => e.slug === 'florida-georgia')!;
  const chips = selectRailChips([game('2026-10-31', fg.rivalryId, 'Okefenokee Oar')]);
  assert.equal(chips[0].label, 'Florida vs Georgia');
  assert.notEqual(chips[0].label, 'Okefenokee Oar');
});

test('a rivalry with no override falls back to its own stored name', () => {
  const chips = selectRailChips([game('2026-11-28', ironBowl.rivalryId, 'Iron Bowl')]);
  assert.equal(chips[0].label, 'Iron Bowl');
});

test('every chip slug resolves to a real registry entry, so no chip can 404', () => {
  const slugs = new Set(MATCHUP_REGISTRY.map((e) => e.slug));
  const chips = selectRailChips(
    MATCHUP_REGISTRY.map((e, i) => game(`2026-09-${String((i % 28) + 1).padStart(2, '0')}`, e.rivalryId)),
    MATCHUP_REGISTRY.length,
  );
  assert.ok(chips.length > 0);
  for (const c of chips) assert.ok(slugs.has(c.slug), `${c.slug} is not a registry slug`);
});

test('a max of 0 returns nothing rather than throwing', () => {
  assert.deepEqual(selectRailChips([game('2026-11-28', ironBowl.rivalryId)], 0), []);
});
