// The /cfb/rivalries index derivations: display order, the Rivalry Week window
// and the FAQ. The invariant under test is the aggregator plan §4 rule — every
// count is DERIVED from the rows the DOM renders, never hardcoded, and a
// question whose count would be zero is omitted rather than shipped hollow.

import test from 'node:test';
import assert from 'node:assert/strict';
import {
  orderedIndexRows,
  rivalryWeekRows,
  buildRivalryIndexFaqs,
  rivalryWeekRange,
  rivalryWeekShort,
  rivalryWeekLong,
  rivalryIndexHeading,
  headingText,
  RIVALRY_WEEK_START,
  RIVALRY_WEEK_END,
  type RivalryIndexRow,
} from '@/lib/cfb/rivalry-index';
import { rivalryIndexTitle, rivalryIndexDescription, buildCfbRivalryIndexMetadata } from '@/lib/cfb/metadata';

const row = (slug: string, date: string | null, extra: Partial<RivalryIndexRow> = {}): RivalryIndexRow => ({
  slug,
  name: slug,
  date,
  matchup: 'A vs B',
  venueName: null,
  trophy: null,
  colors: [null, null],
  ...extra,
});

test('orderedIndexRows: dated rows soonest first, undated appended after', () => {
  const out = orderedIndexRows([
    row('late', '2026-11-28'),
    row('dormant-a', null),
    row('early', '2026-09-05'),
    row('mid', '2026-10-17'),
    row('dormant-b', null),
  ]);
  assert.deepEqual(out.map((r) => r.slug), ['early', 'mid', 'late', 'dormant-a', 'dormant-b']);
});

test('rivalryWeekRows: bounds are inclusive on both ends', () => {
  const out = rivalryWeekRows([
    row('start-edge', RIVALRY_WEEK_START),
    row('end-edge', RIVALRY_WEEK_END),
    row('day-before', '2026-11-20'),
    row('day-after', '2026-11-30'),
    row('dormant', null),
    row('mid-window', '2026-11-27'),
  ]);
  assert.deepEqual(out.map((r) => r.slug), ['start-edge', 'mid-window', 'end-edge']);
});

test('rivalryWeekRows: empty input and no-window input both return empty', () => {
  assert.deepEqual(rivalryWeekRows([]), []);
  assert.deepEqual(rivalryWeekRows([row('october', '2026-10-10'), row('dormant', null)]), []);
});

test('FAQ counts derive from the rows, not from constants', () => {
  const rows = [
    row('a', '2026-11-28', { trophy: 'Some Trophy' }),
    row('b', '2026-11-27', { trophy: 'Other Trophy' }),
    row('c', '2026-10-10'),
    row('d', null),
    row('e', null),
  ];
  const faqs = buildRivalryIndexFaqs(rows);
  const all = faqs.map((f) => `${f.question} ${f.answer}`).join('\n');
  // total 5, dated 3, rivalry week 2, trophies 2 — every number in the copy.
  assert.match(faqs[0].answer, /tracks 5 named/);
  assert.match(faqs[0].answer, /3 of them have a scheduled 2026 meeting/);
  assert.match(all, /College football Rivalry Week 2026 is Friday, November 27 and Saturday, November 28\. 2 of the 5 rivalries tracked here are played on those days/);
  assert.match(all, /2 of the 5 rivalries listed here play for a named trophy/);
});

test('FAQ omits the Rivalry Week question when no game falls in the window', () => {
  const faqs = buildRivalryIndexFaqs([row('a', '2026-10-10'), row('b', null)]);
  assert.equal(faqs.some((f) => /Rivalry Week/i.test(f.question)), false);
});

test('FAQ omits the trophy question when no row carries a trophy', () => {
  const faqs = buildRivalryIndexFaqs([row('a', '2026-11-28'), row('b', '2026-11-27')]);
  assert.equal(faqs.some((f) => /trophy/i.test(f.question)), false);
});

test('FAQ always includes the kickoff/TV answer and it promises TBA, not a guess', () => {
  const faqs = buildRivalryIndexFaqs([]);
  const kickoff = faqs.find((f) => /kickoff/i.test(f.question));
  assert.ok(kickoff);
  assert.match(kickoff!.answer, /TBA/);
  assert.match(kickoff!.answer, /officially announced/);
});

test('no FAQ copy contains an em dash (house rule for user-facing copy)', () => {
  const rows = [row('a', '2026-11-28', { trophy: 'T' }), row('b', null)];
  for (const f of buildRivalryIndexFaqs(rows)) {
    assert.equal(/—/.test(f.question + f.answer), false);
  }
});

// ── presentational grouping (visual pass) ────────────────────────────────────
// The load-bearing invariant: groups PARTITION the exact arrays the DOM
// already renders. Concatenating group rows must reproduce the source arrays,
// so total row count, order, and the ItemList can never drift.

import { groupRivalryWeekByDay, groupIndexByMonth } from '@/lib/cfb/rivalry-index';

test('groupRivalryWeekByDay partitions rivalryWeekRows exactly, in order', () => {
  const rows = [
    row('sat21', '2026-11-21'),
    row('thu26', '2026-11-26'),
    row('fri27-a', '2026-11-27'),
    row('fri27-b', '2026-11-27'),
    row('sat28-a', '2026-11-28'),
    row('sat28-b', '2026-11-28'),
    row('sat28-c', '2026-11-28'),
    row('october', '2026-10-10'),
    row('dormant', null),
  ];
  const groups = groupRivalryWeekByDay(rows);
  assert.deepEqual(groups.flatMap((g) => g.rows), rivalryWeekRows(rows));
  // Nov 21 is outside the Thanksgiving-week window (ruling 2026-11-10).
  assert.deepEqual(groups.map((g) => g.key), ['2026-11-26', '2026-11-27', '2026-11-28']);
  assert.deepEqual(groups.map((g) => g.rows.length), [1, 2, 3]);
  assert.equal(groups[0].label, 'Thu');
  assert.equal(groups[0].subLabel, 'Nov 26');
});

test('groupIndexByMonth partitions the ordered list exactly; undated rows land last', () => {
  const ordered = orderedIndexRows([
    row('nov', '2026-11-28'),
    row('dormant-a', null),
    row('sep-a', '2026-09-05'),
    row('sep-b', '2026-09-19'),
    row('oct', '2026-10-31'),
    row('dormant-b', null),
  ]);
  const groups = groupIndexByMonth(ordered);
  assert.deepEqual(groups.flatMap((g) => g.rows), ordered);
  assert.deepEqual(groups.map((g) => g.key), ['2026-09', '2026-10', '2026-11', 'unscheduled']);
  assert.deepEqual(groups.map((g) => g.label), ['September', 'October', 'November', 'Not scheduled']);
  assert.equal(groups.reduce((n, g) => n + g.rows.length, 0), ordered.length);
});

test('grouping an empty row set yields no groups, not an empty header', () => {
  assert.deepEqual(groupRivalryWeekByDay([]), []);
  assert.deepEqual(groupIndexByMonth([]), []);
});

// ── Rivalry Week dates in the head (fix/gsc-cleanup-2026-11, ruling 2026-11-10) ──
// The title, H1, description and answer sentence print the STORED game days
// inside the window, never the bounds and never a typed date.

// The 2026 shape: Big Game the Saturday before, four on Friday, the rest Saturday.
const season2026 = [
  row('big-game', '2026-11-21'),
  row('egg-bowl', '2026-11-27'),
  row('heroes-trophy', '2026-11-27'),
  row('iron-bowl', '2026-11-28'),
  row('the-game', '2026-11-28'),
  row('red-river', '2026-10-10'),
  row('dormant', null),
];

test('the window is Thanksgiving week, Nov 26 to 28 (ruling 2026-11-10); Big Game sits outside it', () => {
  assert.equal(RIVALRY_WEEK_START, '2026-11-26');
  assert.equal(RIVALRY_WEEK_END, '2026-11-28');
  assert.deepEqual(rivalryWeekRows(season2026).map((r) => r.slug), ['egg-bowl', 'heroes-trophy', 'iron-bowl', 'the-game']);
  assert.ok(orderedIndexRows(season2026).some((r) => r.slug === 'big-game'), 'Big Game stays in the full list');
});

test('the range is the first and last stored game day inside the window, not the bounds', () => {
  const range = rivalryWeekRange(season2026)!;
  assert.deepEqual(range, { start: '2026-11-27', end: '2026-11-28', days: ['2026-11-27', '2026-11-28'] });
  assert.equal(rivalryWeekShort(range), 'Nov 27-28');
  assert.equal(rivalryWeekLong(range), 'Friday, November 27 and Saturday, November 28');
  assert.equal(rivalryWeekRange([row('a', '2026-11-21'), row('b', null)]), null, 'nothing in the window: no range');
});

test('a game that a verification moves moves every derived date with it', () => {
  const moved = season2026.map((r) => (r.slug === 'egg-bowl' ? { ...r, date: '2026-11-26' } : r));
  const range = rivalryWeekRange(moved)!;
  assert.equal(rivalryWeekShort(range), 'Nov 26-28');
  assert.equal(rivalryWeekLong(range), 'Thursday, November 26 to Saturday, November 28');
  assert.equal(rivalryIndexTitle(moved), 'College Football Rivalry Week 2026: Nov 26-28');
  const allSaturday = season2026.map((r) => (r.date === '2026-11-27' ? { ...r, date: '2026-11-28' } : r));
  assert.equal(rivalryIndexTitle(allSaturday), 'College Football Rivalry Week 2026: Nov 28');
  assert.match(rivalryIndexDescription(allSaturday), /is Saturday, November 28\./);
});

test('short form across a month boundary names both months', () => {
  assert.equal(rivalryWeekShort({ start: '2026-11-30', end: '2026-12-01', days: ['2026-11-30', '2026-12-01'] }), 'Nov 30-Dec 1');
});

test('title and H1 carry the dates: the approved title, and the H1 is the same string', () => {
  const title = rivalryIndexTitle(season2026);
  assert.equal(`${title} | PromoNight`, 'College Football Rivalry Week 2026: Nov 27-28 | PromoNight');
  assert.ok(`${title} | PromoNight`.length <= 60, 'rendered title stays inside 60');
  assert.equal(headingText(rivalryIndexHeading(season2026)), title);
  const md = buildCfbRivalryIndexMetadata(season2026);
  assert.equal(md.title, title);
  assert.equal((md.openGraph as { title: string }).title, `${title} | PromoNight`);
  assert.equal(md.alternates?.canonical, 'https://www.getpromonight.com/cfb/rivalries');
});

test('the description answers "when" with the dates, in 120 to 155 characters, counts derived', () => {
  const d = rivalryIndexDescription(season2026);
  assert.match(d, /^College football Rivalry Week 2026 is Friday, November 27 and Saturday, November 28\./);
  assert.match(d, /Dates and stadiums for its 4 games, plus all 7 rivalries by date\.$/);
  // The real corpus: 16 in the window, 32 in all.
  const full = [...Array.from({ length: 16 }, (_, i) => row(`w${i}`, i < 4 ? '2026-11-27' : '2026-11-28')), ...Array.from({ length: 16 }, (_, i) => row(`o${i}`, '2026-10-10'))];
  const real = rivalryIndexDescription(full);
  assert.ok(real.length >= 120 && real.length <= 155, `${real.length}: ${real}`);
});

test('no rows in the window: the index title and description of before, no dates', () => {
  const none = [row('a', '2026-10-10'), row('b', null)];
  assert.equal(rivalryIndexTitle(none), 'College Football Rivalries 2026');
  assert.doesNotMatch(rivalryIndexDescription(none), /Rivalry Week/);
});

test('no em or en dash in any of the derived head copy', () => {
  for (const s of [rivalryIndexTitle(season2026), rivalryIndexDescription(season2026), ...buildRivalryIndexFaqs(season2026).map((f) => f.answer)]) {
    assert.doesNotMatch(s, /[\u2013\u2014]/, s);
  }
});
