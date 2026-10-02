/* The regular-season filter and the month grouping behind the team-page
 * schedule list and its Games tile. Each case is a way the list or the tile
 * printed something false on production on 2026-10-01, or a boundary the month
 * sections must hold. */
import { test } from 'node:test';
import assert from 'node:assert';
import { groupByMonth, gamesLabel, regularSeasonContexts } from '../schedule-months';
import { mlbGame, mlbCtx, PHILLIES, METS, NFL_CONTEXTS } from '../../components/redesign/__tests__/fixtures/schedule-fixtures';

test('postseason games are not regular-season games', () => {
  const reg = mlbCtx(mlbGame('2026-09-27', false, METS), METS);
  const wc = mlbCtx(mlbGame('2026-09-29', true, PHILLIES, { isPostseason: true }), PHILLIES);
  assert.deepStrictEqual(regularSeasonContexts([reg, wc]), [reg]);
});

test("a postponed game's stale original-date doc is dropped for its completed makeup", () => {
  // Braves 2026-07-28 at Mets: original doc still 'scheduled', makeup 07-29 g2 completed, same gamePk.
  const stale = mlbCtx(mlbGame('2026-07-28', false, METS, { status: 'scheduled', mlbGameId: 823598 }), METS);
  const makeup = mlbCtx(mlbGame('2026-07-29', false, METS, { status: 'completed', mlbGameId: 823598, doubleheaderGame: 2 }), METS);
  assert.deepStrictEqual(regularSeasonContexts([stale, makeup]), [makeup]);
  assert.deepStrictEqual(regularSeasonContexts([makeup, stale]), [makeup], 'order of the input does not matter');
});

test('a stale original dated AFTER its makeup is still the one dropped (Yankees 09-26 vs 09-25 g2)', () => {
  const makeup = mlbCtx(mlbGame('2026-09-25', true, METS, { status: 'completed', mlbGameId: 823489, doubleheaderGame: 2 }), METS);
  const stale = mlbCtx(mlbGame('2026-09-26', true, METS, { status: 'scheduled', mlbGameId: 823489 }), METS);
  assert.deepStrictEqual(regularSeasonContexts([makeup, stale]), [makeup]);
});

test('in season, a postponed original gives way to its scheduled makeup', () => {
  const orig = mlbCtx(mlbGame('2026-05-01', true, METS, { status: 'postponed', mlbGameId: 9 }), METS);
  const makeup = mlbCtx(mlbGame('2026-06-15', true, METS, { status: 'scheduled', mlbGameId: 9 }), METS);
  assert.deepStrictEqual(regularSeasonContexts([orig, makeup]), [makeup]);
});

test('KNOWN LIMIT (known-issues 62): two scheduled docs for one game keep the later date, and exactly one survives', () => {
  // Right when a game moves later, wrong when it moves earlier; nothing stored
  // separates them. Pinned so the behaviour is deliberate, not accidental.
  const a = mlbCtx(mlbGame('2026-05-01', true, METS, { status: 'scheduled', mlbGameId: 7 }), METS);
  const b = mlbCtx(mlbGame('2026-05-02', true, METS, { status: 'scheduled', mlbGameId: 7 }), METS);
  assert.deepStrictEqual(regularSeasonContexts([b, a]), [b]);
});

test('a canceled game is not a game of the season, alone or beside a twin', () => {
  const canceled = mlbCtx(mlbGame('2026-09-27', false, METS, { status: 'canceled' }), METS);
  const played = mlbCtx(mlbGame('2026-09-26', false, METS), METS);
  assert.deepStrictEqual(regularSeasonContexts([played, canceled]), [played]);
  const twinA = mlbCtx(mlbGame('2026-08-01', false, METS, { status: 'canceled', mlbGameId: 5 }), METS);
  const twinB = mlbCtx(mlbGame('2026-08-02', false, METS, { status: 'completed', mlbGameId: 5 }), METS);
  assert.deepStrictEqual(regularSeasonContexts([twinA, twinB]), [twinB]);
});

test('the filter is the identity on NFL docs: same objects, same order, canceled included', () => {
  const out = regularSeasonContexts(NFL_CONTEXTS);
  assert.equal(out.length, NFL_CONTEXTS.length);
  out.forEach((c, i) => assert.strictEqual(c, NFL_CONTEXTS[i]));
  assert.ok(NFL_CONTEXTS.some((c) => c.game.status === 'canceled'), 'fixture carries a canceled NFL game');
});

test('the Braves shape: 162 completed + 3 stale originals + 3 Wild Card docs counts 162', () => {
  const rows = [];
  let day = Date.UTC(2026, 2, 26);
  for (let i = 0; i < 162; i++, day += 86_400_000) rows.push(mlbCtx(mlbGame(new Date(day).toISOString().slice(0, 10), i % 2 === 0, METS, { mlbGameId: 1000 + i }), METS));
  for (const i of [10, 50, 90]) rows.push(mlbCtx(mlbGame('2026-04-01', true, METS, { status: 'scheduled', mlbGameId: 1000 + i }), METS));
  for (const d of ['2026-09-29', '2026-09-30', '2026-10-01']) rows.push(mlbCtx(mlbGame(d, true, PHILLIES, { isPostseason: true }), PHILLIES));
  assert.equal(rows.length, 168);
  assert.equal(regularSeasonContexts(rows).length, 162);
});

// ── Month grouping ──

const g = (d: string, extra = {}) => ({ date: d, ...extra });

test('a season that starts in March gets a March section, months in order', () => {
  const out = groupByMonth([g('2026-03-26'), g('2026-03-31'), g('2026-04-01'), g('2026-09-27')], (r) => r.date);
  assert.deepStrictEqual(out?.map((m) => [m.key, m.label, m.rows.length]), [
    ['2026-03', 'March 2026', 2],
    ['2026-04', 'April 2026', 1],
    ['2026-09', 'September 2026', 1],
  ]);
});

test('the month is the printed (Eastern) date, never the UTC start: 7:10 PM PT on Mar 31 stays in March', () => {
  // 2026-03-31 19:10 PDT is 2026-04-01T02:10Z. The stored date is 03-31 and the row prints "Mar 31".
  const late = mlbCtx(mlbGame('2026-03-31', false, METS, { gameTime: '02:10', gameTimeTz: 'America/Los_Angeles' }), METS);
  const out = groupByMonth([late], (c) => c.game.date);
  assert.equal(out?.[0].label, 'March 2026');
  // And 10:10 PM ET on Apr 30 (02:10Z May 1) stays in April.
  const lateEt = mlbCtx(mlbGame('2026-04-30', true, METS, { gameTime: '02:10' }), METS);
  assert.equal(groupByMonth([lateEt], (c) => c.game.date)?.[0].label, 'April 2026');
});

test('doubleheaders stay together, game 1 ahead of game 2, both counted', () => {
  const g1 = g('2026-05-31', { n: 1 });
  const g2 = g('2026-05-31', { n: 2 });
  const out = groupByMonth([g('2026-05-30'), g1, g2, g('2026-06-01')], (r) => r.date)!;
  assert.equal(out[0].rows.length, 3);
  assert.deepStrictEqual(out[0].rows.slice(1), [g1, g2]);
});

test('an empty month renders no section', () => {
  const out = groupByMonth([g('2026-04-30'), g('2026-06-01')], (r) => r.date)!;
  assert.deepStrictEqual(out.map((m) => m.key), ['2026-04', '2026-06']);
  assert.deepStrictEqual(groupByMonth([], (r: { date: string }) => r.date), []);
});

test('a malformed date or out-of-order months refuse rather than invent a month', () => {
  assert.equal(groupByMonth([g('2026-04-01'), g('2026-13-01')], (r) => r.date), null);
  assert.equal(groupByMonth([g('2026-04-01'), g('April 2')], (r) => r.date), null);
  assert.equal(groupByMonth([g('2026-04-01'), g('2026-05-01'), g('2026-04-02')], (r) => r.date), null);
});

test('games label', () => {
  assert.equal(gamesLabel(1), '1 game');
  assert.equal(gamesLabel(27), '27 games');
});

test('a postponed doc with no makeup twin is not a row (no game is played on its date)', () => {
  const lone = mlbCtx(mlbGame('2026-09-20', true, METS, { status: 'postponed' }), METS);
  const played = mlbCtx(mlbGame('2026-09-21', true, METS), METS);
  assert.deepStrictEqual(regularSeasonContexts([lone, played]), [played]);
});

test("MLB docs from another season are not this season's games", () => {
  const now = mlbCtx(mlbGame('2026-09-27', true, METS), METS);
  const next = mlbCtx(mlbGame('2027-03-25', true, METS, { status: 'scheduled' }), METS);
  const prior = mlbCtx(mlbGame('2025-09-28', true, METS), METS);
  assert.deepStrictEqual(regularSeasonContexts([prior, now, next]), [now]);
});

test('the season scope never reaches NFL: a January game of the 2026 NFL season stays', () => {
  const jan = NFL_CONTEXTS.filter((c) => c.game.date.startsWith('2027-'));
  assert.ok(jan.length > 0, 'fixture carries January 2027 NFL games');
  for (const c of jan) assert.ok(regularSeasonContexts(NFL_CONTEXTS).includes(c));
});
