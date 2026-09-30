// The postseason promotions: the rows the playoffs pages read BY NAME, what
// each row must carry to be shown, and how a row lands on one game of the
// bracket without its keys reaching the page.
import { test, mock } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { FIELDS_AT, FIXTURE, clubs, fakeFirestore, loadDoc, parks, seriesKeyIn } from './helpers';
import { mapBracketDoc } from '../map';
import { buildLeagueView, homeGamesWindow, type PromoRow } from '../view';

type Fake = ReturnType<typeof fakeFirestore>;
const current: { db: Fake } = { db: fakeFirestore({}) };
const db = {
  collection: (name: string) => current.db.collection(name),
  getAll: (...args: unknown[]) => current.db.getAll(...args),
};
mock.module('server-only', { namedExports: {} });
mock.module(new URL('../../firebase.ts', import.meta.url).href, { namedExports: { db } });
const load = () => import('../promos');

const ROWS = (JSON.parse(readFileSync(new URL('../__fixtures__/promos.postseason-20260930.json', import.meta.url), 'utf-8')) as { rows: Record<string, Record<string, unknown>> }).rows;
const TODAY = '2026-09-30';
const quiet = <T,>(fn: () => Promise<T>): Promise<T> => {
  const original = console.error;
  console.error = () => {};
  return fn().finally(() => {
    console.error = original;
  });
};

// ---- One row ----

test('ROW: a row in the contracted shape reduces to the join key and the line, and nothing else', async () => {
  const { postseasonPromoRow } = await load();
  const row = postseasonPromoRow(ROWS['teams/golden-state-valkyries/promos/3f0c1a2b9d4e5f60'], 'WNBA', 2026, TODAY);
  assert.deepEqual(row, { seriesKey: 'R1-2v7', gameNumber: 3, title: 'Violet T-Shirt', type: 'giveaway', icon: '🎁' });
  // Nothing that names the row, its source, its game id or its opponent.
  assert.deepEqual(Object.keys(row as object).sort(), ['gameNumber', 'icon', 'seriesKey', 'title', 'type']);
});

test('ROW: refused when tombstoned, another league or season, dated before today, not postseason, or missing what the line needs', async () => {
  const { postseasonPromoRow } = await load();
  const good = ROWS['teams/houston-astros/promos/7a8b9c0d1e2f3a4b'];
  assert.ok(postseasonPromoRow(good, 'MLB', 2026, TODAY));
  assert.equal(postseasonPromoRow(good, 'MLB', 2026, '2026-10-01'), null, 'dated before a later today');
  assert.equal(postseasonPromoRow(ROWS['teams/houston-astros/promos/2d3e4f5a6b7c8d9e'], 'MLB', 2026, TODAY), null, 'tombstoned');
  assert.equal(postseasonPromoRow(ROWS['teams/houston-astros/promos/5c6d7e8f9a0b1c2d'], 'MLB', 2026, TODAY), null, 'dated yesterday');
  assert.ok(postseasonPromoRow(ROWS['teams/houston-astros/promos/5c6d7e8f9a0b1c2d'], 'MLB', 2026, '2026-09-29'), 'dated today is kept');
  assert.equal(postseasonPromoRow(ROWS['teams/houston-astros/promos/9e8d7c6b5a4f3e2d'], 'MLB', 2026, '2026-07-01'), null, 'a regular row, even in date');
  assert.equal(postseasonPromoRow(good, 'WNBA', 2026, TODAY), null, 'another league');
  assert.equal(postseasonPromoRow(good, 'MLB', 2025, TODAY), null, 'another season');
  for (const [field, value] of [['seriesKey', ''], ['seriesKey', 7], ['gameNumber', '2'], ['gameNumber', 0], ['gameNumber', 2.5], ['title', '  '], ['type', 'merch'], ['date', '2026-9-30'], ['date', null]] as const) {
    assert.equal(postseasonPromoRow({ ...good, [field]: value }, 'MLB', 2026, TODAY), null, `${field} = ${JSON.stringify(value)}`);
  }
  assert.equal(postseasonPromoRow({ ...good, isPostseason: 'true' }, 'MLB', 2026, TODAY), null, 'the marker must be the boolean');
});

// ---- The read ----

test('READ: one equality query per host club, on the promos subcollection, and only the rows to show come back', async () => {
  const { readPostseasonPromos } = await load();
  current.db = fakeFirestore({ ...ROWS });
  const rows = await readPostseasonPromos('MLB', 2026, ['houston-astros', 'san-diego-padres', 'new-york-yankees'], TODAY);
  assert.deepEqual(
    rows.map((r) => `${r.seriesKey}#${r.gameNumber} ${r.title}`).sort(),
    ['AL-WC-A#2 Postseason Rally Towel', 'NL-WC-B#2 Two-Dollar Tacos'],
  );
  assert.deepEqual(current.db.reads.map((r) => r.path).sort(), ['teams/houston-astros/promos', 'teams/new-york-yankees/promos', 'teams/san-diego-padres/promos']);
  // The WNBA row under a club that is not an MLB host is not asked for, and
  // would be refused by league if it were.
  assert.ok(!rows.some((r) => r.title === 'Violet T-Shirt'));
});

test('READ: a club whose read fails contributes nothing; the others still come back', async () => {
  const { readPostseasonPromos } = await load();
  current.db = fakeFirestore({ ...ROWS, 'teams/houston-astros': new Error('UNAVAILABLE') });
  const rows = await quiet(() => readPostseasonPromos('MLB', 2026, ['houston-astros', 'san-diego-padres'], TODAY));
  assert.deepEqual(rows.map((r) => r.title), ['Two-Dollar Tacos']);
});

// ---- The join ----

function withPromos(name: string, now: Date, rows: PromoRow[]) {
  const d = loadDoc(name);
  const b = mapBracketDoc(d, { league: d.league as 'MLB' | 'WNBA', season: d.season as number });
  assert.ok(b);
  const v = buildLeagueView(b, clubs(), parks(), now, rows);
  assert.ok(v);
  return v;
}
const mlbRows = (): PromoRow[] => [
  { seriesKey: 'AL-WC-A', gameNumber: 2, title: 'Postseason Rally Towel', type: 'giveaway', icon: '🏟️' },
  { seriesKey: 'NL-WC-B', gameNumber: 2, title: 'Two-Dollar Tacos', type: 'food', icon: '🌮' },
];

test('JOIN: a row lands on the one game its series key and game number name, and on that game in the home games list', () => {
  const v = withPromos(FIXTURE.mlbFields, FIELDS_AT, mlbRows());
  const all = v.rounds.flatMap((r) => r.groups.flatMap((g) => g.series));
  const astros = all.find((s) => s.higher.label === 'Astros');
  assert.ok(astros);
  assert.deepEqual(astros.games.map((g) => g.promo?.title ?? null), [null, 'Postseason Rally Towel', null]);
  assert.deepEqual(astros.games[1].promo, { title: 'Postseason Rally Towel', type: 'giveaway', icon: '🏟️' });
  const padres = all.find((s) => s.higher.label === 'Padres');
  assert.deepEqual(padres?.games.map((g) => g.promo?.title ?? null), [null, 'Two-Dollar Tacos', null]);
  const withPromo = v.homeGames.filter((g) => g.promo);
  assert.deepEqual(withPromo.map((g) => [g.matchup, g.gameTitle, g.promo?.title]), [['White Sox at Astros', 'Game 2', 'Postseason Rally Towel'], ['Cubs at Padres', 'Game 2', 'Two-Dollar Tacos']]);
  // Every other game: nothing, and no claim that there is nothing.
  assert.equal(all.flatMap((s) => s.games).filter((g) => g.promo).length, 2);
});

test('JOIN: a row for a series or game the bracket does not have is ignored; two rows that disagree show neither; two that agree are one', () => {
  const stray: PromoRow[] = [
    { seriesKey: 'AL-WC-Z', gameNumber: 1, title: 'No Such Series', type: 'giveaway', icon: '' },
    { seriesKey: 'AL-WC-A', gameNumber: 9, title: 'No Such Game', type: 'giveaway', icon: '' },
    { seriesKey: 'AL-WC-A', gameNumber: 2, title: 'First Row', type: 'giveaway', icon: '' },
    { seriesKey: 'AL-WC-A', gameNumber: 2, title: 'Second Row', type: 'theme', icon: '' },
  ];
  const v = withPromos(FIXTURE.mlbFields, FIELDS_AT, stray);
  const games = v.rounds.flatMap((r) => r.groups.flatMap((g) => g.series.flatMap((s) => s.games)));
  assert.equal(games.filter((g) => g.promo).length, 0);

  // A rescan can write the same promotion twice under two ids. That is one
  // promotion, and it shows.
  const twice: PromoRow[] = [
    { seriesKey: 'AL-WC-A', gameNumber: 2, title: 'Postseason Rally Towel', type: 'giveaway', icon: '🏟️' },
    { seriesKey: 'AL-WC-A', gameNumber: 2, title: 'Postseason Rally Towel', type: 'giveaway', icon: '🏟️' },
  ];
  const v2 = withPromos(FIXTURE.mlbFields, FIELDS_AT, twice);
  const shown = v2.rounds.flatMap((r) => r.groups.flatMap((g) => g.series.flatMap((s) => s.games))).filter((g) => g.promo);
  assert.equal(shown.length, 1);
  assert.equal(shown[0].promo?.title, 'Postseason Rally Towel');
});

test('JOIN: the view carries the line and never the key it was joined on', () => {
  const v = withPromos(FIXTURE.mlbFields, FIELDS_AT, mlbRows());
  const text = JSON.stringify(v);
  assert.equal(seriesKeyIn(text), null);
  assert.ok(!text.includes('bracketGameId') && !text.includes('849846') && !text.includes('sourceUrl') && !text.includes('opponentSlug'));
  assert.ok(text.includes('Postseason Rally Towel'));
});

// ---- The lines on the page ----

test('PAGE: the series detail row and the home games row show the promotion, and the key scan passes', async () => {
  const { SeriesPanel } = await import('../../../components/playoffs/SeriesPanel');
  const { HomeGames } = await import('../../../components/playoffs/HomeGames');
  const v = withPromos(FIXTURE.mlbFields, FIELDS_AT, mlbRows());
  const astros = v.rounds[0].groups[0].series[0];
  assert.equal(astros.higher.label, 'Astros');
  const panel = renderToStaticMarkup(createElement(SeriesPanel, { series: astros, league: 'MLB', leagueSlug: 'mlb', tickets: null, open: false } as never));
  assert.equal((panel.match(/data-game-promo="giveaway"/g) ?? []).length, 1);
  const row = (n: number) => { const at = panel.indexOf(`data-game="${n}"`); return panel.slice(at, panel.indexOf('</li>', at)); };
  assert.ok(row(2).includes('Postseason Rally Towel'));
  assert.ok(!row(1).includes('Rally Towel') && !row(3).includes('Rally Towel'));
  assert.equal(seriesKeyIn(panel), null);
  assert.ok(!panel.includes('849846'));

  const games = homeGamesWindow([v], FIELDS_AT);
  const list = renderToStaticMarkup(createElement(HomeGames, { id: 'home-games', heading: 'Home games this week', games, tickets: {}, surface: 'web_playoffs_league', empty: 'none' } as never));
  assert.equal((list.match(/data-game-promo=/g) ?? []).length, 2);
  assert.ok(/White Sox at Astros[\s\S]*?Game 2[\s\S]*?Postseason Rally Towel/.test(list));
  assert.ok(!/complete|every promotion|all promotions/i.test(list), 'no completeness claim');
  assert.equal(seriesKeyIn(list), null);
});
