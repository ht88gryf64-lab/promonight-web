import { test } from 'node:test';
import assert from 'node:assert/strict';
import { resolveMatchupDisplayName, findDisplayNameCollisions } from '../cfb/display-name';
import { MATCHUP_REGISTRY } from '../cfb/matchup-registry';

// cfbRivalries.name is a data field holding the trophy or historical name. The
// H1 is a search target. When they disagree the search target wins, and the
// historical name survives in the trophy block.

test('an override wins over the rivalry name', () => {
  assert.equal(resolveMatchupDisplayName({ displayName: 'Florida vs Georgia' }, 'Okefenokee Oar'), 'Florida vs Georgia');
});

test('the rivalry name is the fallback when there is no override', () => {
  assert.equal(resolveMatchupDisplayName({}, 'Iron Bowl'), 'Iron Bowl');
  assert.equal(resolveMatchupDisplayName(undefined, 'Iron Bowl'), 'Iron Bowl');
});

test('a blank or whitespace override falls back rather than rendering empty', () => {
  assert.equal(resolveMatchupDisplayName({ displayName: '' }, 'Iron Bowl'), 'Iron Bowl');
  assert.equal(resolveMatchupDisplayName({ displayName: '   ' }, 'Iron Bowl'), 'Iron Bowl');
});

test('exactly four registry entries carry an override', () => {
  const overridden = MATCHUP_REGISTRY.filter((e) => e.displayName);
  assert.deepEqual(
    overridden.map((e) => [e.slug, e.displayName]),
    [
      ['florida-georgia', 'Florida vs Georgia'],
      ['territorial-cup', 'Territorial Cup'],
      ['victory-bell-ucla-usc', 'UCLA vs USC'],
      ['victory-bell-duke-unc', 'Duke vs North Carolina'],
    ],
  );
});

test('no override is the cocktail party name, which was rejected deliberately', () => {
  for (const e of MATCHUP_REGISTRY) {
    assert.equal(/cocktail/i.test(e.displayName ?? ''), false, e.slug);
  }
});

// ── the collision guard ──────────────────────────────────────────────────────
// This is the check that would have caught the two Victory Bell pages shipping
// an identical H1 and competing against each other on one string.

test('the collision detector finds a duplicate name', () => {
  const c = findDisplayNameCollisions([
    { slug: 'victory-bell-ucla-usc', name: 'Victory Bell' },
    { slug: 'victory-bell-duke-unc', name: 'Victory Bell' },
    { slug: 'iron-bowl', name: 'Iron Bowl' },
  ]);
  assert.equal(c.length, 1);
  assert.equal(c[0].name, 'Victory Bell');
  assert.deepEqual(c[0].slugs.sort(), ['victory-bell-duke-unc', 'victory-bell-ucla-usc']);
});

test('the detector is case and whitespace insensitive, so near-duplicates still collide', () => {
  const c = findDisplayNameCollisions([
    { slug: 'a', name: 'Victory Bell' },
    { slug: 'b', name: '  victory bell ' },
  ]);
  assert.equal(c.length, 1);
});

test('distinct names do not collide', () => {
  assert.deepEqual(findDisplayNameCollisions([
    { slug: 'a', name: 'Iron Bowl' },
    { slug: 'b', name: 'Egg Bowl' },
  ]), []);
});

test('THE GUARD: no two registry entries resolve to the same H1', () => {
  // The overrides are the only names known at compile time; the rest resolve
  // from Firestore at request time. This fixture is the live cfbRivalries name
  // for every non-overridden slug, captured 2026-08-11. If a rivalry doc is
  // renamed into a collision, the live check in the gate script catches it and
  // this fixture should be updated.
  const LIVE_NAMES: Record<string, string> = {
    'iron-bowl': 'Iron Bowl',
    'egg-bowl': 'Egg Bowl',
    'apple-cup': 'Apple Cup',
    'the-game': 'The Game',
    'red-river-rivalry': 'Red River Rivalry',
    'magnolia-bowl': 'Magnolia Bowl',
    'palmetto-bowl': 'Palmetto Bowl',
    'sunflower-showdown': 'Sunflower Showdown',
    'third-saturday-in-october': 'Third Saturday in October',
    'lone-star-showdown': 'Lone Star Showdown',
    'paul-bunyans-axe': "Paul Bunyan's Axe",
    'little-brown-jug': 'Little Brown Jug',
    'floyd-of-rosedale': 'Floyd of Rosedale',
    'old-oaken-bucket': 'Old Oaken Bucket',
    'clean-old-fashioned-hate': 'Clean, Old-Fashioned Hate',
    'deep-souths-oldest-rivalry': "Deep South's Oldest Rivalry",
    'holy-war': 'Holy War',
    'big-game': 'Big Game',
    'heroes-trophy': 'Heroes Trophy',
    'cy-hawk-trophy': 'Cy-Hawk Trophy',
    'megaphone-trophy': 'Megaphone Trophy',
    'legends-trophy': 'Legends Trophy',
    'golden-boot': 'Golden Boot',
    'commonwealth-cup': 'Commonwealth Cup',
    'land-of-lincoln-trophy': 'Land of Lincoln Trophy',
    'illibuck': 'Illibuck',
    'farmageddon': 'Farmageddon',
    'governors-cup': "Governor's Cup",
    // overridden, so the raw name never reaches an H1
    'florida-georgia': 'Okefenokee Oar',
    'territorial-cup': 'Duel in the Desert',
    'victory-bell-ucla-usc': 'Victory Bell',
    'victory-bell-duke-unc': 'Victory Bell',
  };

  const rows = MATCHUP_REGISTRY.map((e) => ({
    slug: e.slug,
    name: resolveMatchupDisplayName(e, LIVE_NAMES[e.slug]),
  }));
  assert.equal(rows.length, 32);
  assert.equal(rows.every((r) => !!r.name), true, 'every slug resolves a name');

  const collisions = findDisplayNameCollisions(rows);
  assert.deepEqual(collisions, [], `H1 collision: ${JSON.stringify(collisions)}`);
});

test('without the overrides the same fixture DOES collide, which is the regression', () => {
  const raw = [
    { slug: 'victory-bell-ucla-usc', name: 'Victory Bell' },
    { slug: 'victory-bell-duke-unc', name: 'Victory Bell' },
  ];
  assert.equal(findDisplayNameCollisions(raw).length, 1);
});
