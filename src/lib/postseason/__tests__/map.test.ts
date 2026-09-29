// The mapper is the gate between a stored bracket document and everything the
// web renders or serializes. These tests hold two properties: nothing outside
// the whitelist gets through, and a document the mapper does not fully
// understand is refused whole.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mapBracketDoc } from '../map';
import type { Bracket } from '../types';
import { FIXTURE, loadDoc, rawText } from './helpers';

type Doc = Record<string, unknown>;
type Series = Record<string, unknown> & { games: Record<string, unknown>[]; higher: Doc; lower: Doc };

const expectedOf = (d: Doc) => ({ league: d.league as 'MLB' | 'WNBA', season: d.season as number });
const map = (d: Doc): Bracket | null => mapBracketDoc(d, expectedOf(d));
const seriesOf = (d: Doc, key: string): Series => {
  const s = (d.series as Series[]).find((x) => x.seriesKey === key);
  assert.ok(s, `fixture has series ${key}`);
  return s;
};

const ALL = Object.values(FIXTURE);

// Every key the mapper may emit, by level. A field added to the mapper
// without being added here fails the suite, which is the point: publishing a
// new field is a decision, not a side effect.
const BRACKET_KEYS = ['lastChangedAt', 'league', 'season', 'series'];
const SERIES_KEYS = ['bestOf', 'conference', 'games', 'higher', 'lower', 'round', 'roundLabel', 'seriesKey', 'shortLabel', 'status', 'winnerSide', 'wins'];
const CLUB_KEYS = ['kind', 'seed', 'slug'];
const PLACEHOLDER_KEYS = ['candidates', 'kind', 'label', 'seed'];
const GAME_KEYS = ['awayScore', 'date', 'gameNumber', 'homeScore', 'homeSide', 'ifNecessary', 'start', 'startTimeTBD', 'status', 'winnerSide'];
const keys = (o: object) => Object.keys(o).sort();

test('every fixture maps, series for series', () => {
  for (const f of ALL) {
    const d = loadDoc(f);
    const b = map(d);
    assert.ok(b, `${f} maps`);
    assert.equal(b.series.length, (d.series as unknown[]).length, f);
    assert.deepEqual(b.series.map((s) => s.seriesKey), (d.series as Series[]).map((s) => s.seriesKey), `${f} keeps the document's order`);
    assert.equal(b.series.reduce((n, s) => n + s.games.length, 0), (d.series as Series[]).reduce((n, s) => n + s.games.length, 0), `${f} keeps every game`);
  }
});

test('WHITELIST: the mapped bracket has exactly the named keys at every level', () => {
  for (const f of ALL) {
    const b = map(loadDoc(f)) as Bracket;
    assert.deepEqual(keys(b), BRACKET_KEYS, f);
    for (const s of b.series) {
      assert.deepEqual(keys(s), SERIES_KEYS, `${f} ${s.seriesKey}`);
      assert.deepEqual(keys(s.wins), ['higher', 'lower']);
      for (const slot of [s.higher, s.lower]) assert.deepEqual(keys(slot), slot.kind === 'club' ? CLUB_KEYS : PLACEHOLDER_KEYS, `${f} ${s.seriesKey}`);
      for (const g of s.games) assert.deepEqual(keys(g), GAME_KEYS, `${f} ${s.seriesKey} G${g.gameNumber}`);
    }
  }
});

test('WHITELIST: no operator field name and no operator value survives the mapper', () => {
  for (const f of ALL) {
    const d = loadDoc(f);
    const out = JSON.stringify(map(d));
    for (const name of ['operatorLog', 'source', 'runId', 'seeds', 'authoredBy', 'authoredOn', 'bracketSha256', 'validatedSeedSha256', 'lastRevalidatedSha256', 'unplaced', 'writerVersion', 'lastFetchedAt', 'gameId']) {
      assert.ok(!out.includes(`"${name}"`), `${f}: ${name} reached the mapped bracket`);
    }
    const seeds = d.seeds as Doc;
    const always = [d.runId, d.bracketSha256, d.lastRevalidatedSha256, seeds.file, ...((d.source as { urls: string[] }).urls)];
    // The two live captures carry an author name and a seed hash. The 2025
    // documents were built from seed files that name no author.
    const live = f === FIXTURE.mlbLive || f === FIXTURE.wnbaLive || f === FIXTURE.mlbInGame;
    const sometimes = [seeds.authoredBy, d.validatedSeedSha256];
    for (const v of always) assert.equal(typeof v, 'string', `${f}: the fixture carries the value being checked`);
    if (live) for (const v of sometimes) assert.equal(typeof v, 'string', `${f}: a live capture carries the author and the seed hash`);
    for (const v of [...always, ...sometimes]) {
      if (typeof v !== 'string') continue;
      assert.ok(!out.includes(v), `${f}: the value ${v.slice(0, 24)} reached the mapped bracket`);
    }
    for (const s of d.series as Series[]) for (const g of s.games) assert.ok(!out.includes(`"${g.gameId}"`), `${f}: a feed game id reached the mapped bracket`);
  }
});

test('WHITELIST: the fixtures do carry what the mapper drops', () => {
  // Guards the two tests above against a fixture that was cleaned by hand.
  const raw = rawText(FIXTURE.mlbLive);
  for (const name of ['operatorLog', 'source', 'runId', 'seeds', 'authoredBy', 'bracketSha256', 'validatedSeedSha256', 'lastRevalidatedSha256', 'unplaced', 'gameId']) {
    assert.ok(raw.includes(`"${name}"`), `the live MLB capture holds ${name}`);
  }
});

test('WHITELIST: a field the pipeline adds later is dropped at every level until it is named', () => {
  const clean = map(loadDoc(FIXTURE.mlbLive));
  const d = loadDoc(FIXTURE.mlbLive);
  d.internalNote = 'top';
  for (const s of d.series as Series[]) {
    s.internalNote = 'series';
    s.higher.internalNote = 'slot';
    s.lower.internalNote = 'slot';
    (s.wins as Doc).internalNote = 'wins';
    for (const g of s.games) g.internalNote = 'game';
  }
  assert.deepEqual(map(d), clean);
});

test('unplaced, operatorLog, seeds and source are never read', () => {
  for (const f of [FIXTURE.mlbLive, FIXTURE.wnbaLive]) {
    const d = loadDoc(f);
    const clean = map(loadDoc(f));
    for (const name of ['unplaced', 'operatorLog', 'seeds', 'source', 'runId', 'bracketSha256', 'validatedSeedSha256', 'lastRevalidatedSha256', 'lastFetchedAt']) {
      delete d[name];
      Object.defineProperty(d, name, {
        enumerable: true,
        get() {
          throw new Error(`the mapper read ${name}`);
        },
      });
    }
    assert.deepEqual(map(d), clean, f);
  }
});

test('the change stamp and the start instants come through as ISO strings', () => {
  const mlb = map(loadDoc(FIXTURE.mlbLive)) as Bracket;
  const raw = JSON.parse(rawText(FIXTURE.mlbLive));
  assert.equal(mlb.lastChangedAt, raw.lastChangedAt.__firestoreTimestamp);
  assert.equal(mlb.series[0].games[0].start, '2026-09-29T21:00:00.000Z');
  // ESPN writes no seconds. It is the same instant format to a reader.
  const wnba = map(loadDoc(FIXTURE.wnbaLive)) as Bracket;
  assert.equal(JSON.parse(rawText(FIXTURE.wnbaLive)).series[0].games[0].start, '2026-09-27T18:00Z');
  assert.equal(wnba.series[0].games[0].start, '2026-09-27T18:00:00.000Z');
});

test('a document with no change stamp still maps, with a null stamp', () => {
  const d = loadDoc(FIXTURE.mlbLive);
  delete d.lastChangedAt;
  assert.equal((map(d) as Bracket).lastChangedAt, null);
});

test('a bare date is not a start time', () => {
  const d = loadDoc(FIXTURE.mlbLive);
  seriesOf(d, 'AL-WC-A').games[0].start = '2026-09-29';
  assert.equal((map(d) as Bracket).series[0].games[0].start, null);
});

test('PLACEHOLDERS: the stored label is kept verbatim, pair form and role form', () => {
  const b = map(loadDoc(FIXTURE.mlbLive)) as Bracket;
  const slot = (key: string, which: 'higher' | 'lower') => b.series.find((s) => s.seriesKey === key)![which];
  assert.deepEqual(slot('AL-DS-A', 'lower'), { kind: 'placeholder', label: 'NYY/BOS', seed: null, candidates: null });
  assert.deepEqual(slot('AL-CS', 'higher'), { kind: 'placeholder', label: 'AL Higher Seed', seed: null, candidates: null });
  assert.deepEqual(slot('WS', 'lower'), { kind: 'placeholder', label: 'Lower Seed League Champion', seed: null, candidates: null });
  assert.deepEqual(slot('AL-DS-A', 'higher'), { kind: 'club', slug: 'tampa-bay-rays', seed: 1 });
  const w = map(loadDoc(FIXTURE.wnbaLive)) as Bracket;
  assert.deepEqual(w.series.find((s) => s.seriesKey === 'SF-A')!.higher, { kind: 'placeholder', label: 'TBD', seed: null, candidates: null });
});

// OVERLAY. No stored document carries feederSeriesKey, candidates or
// shortLabel yet. The three tests below add them to a live capture, in the
// shape the G0 rulings name, to hold the mapper's side of that contract.
test('OVERLAY: a feeder key with two candidate clubs carries the clubs; the label stays; the key is dropped', () => {
  const d = loadDoc(FIXTURE.mlbLive);
  Object.assign(seriesOf(d, 'AL-DS-A').lower, { feederSeriesKey: 'AL-WC-B', candidates: ['new-york-yankees', 'boston-red-sox'] });
  const slot = (map(d) as Bracket).series.find((s) => s.seriesKey === 'AL-DS-A')!.lower;
  assert.deepEqual(slot, { kind: 'placeholder', label: 'NYY/BOS', seed: null, candidates: ['new-york-yankees', 'boston-red-sox'] });
  assert.ok(!JSON.stringify(slot).includes('AL-WC-B'));
});

test('FEEDER KEY: never emitted on a slot, with candidates or without', () => {
  for (const extra of [
    { feederSeriesKey: 'AL-WC-B' },
    { feederSeriesKey: 'AL-WC-B', candidates: null },
    { feederSeriesKey: 'AL-WC-B', candidates: ['new-york-yankees', 'boston-red-sox'] },
  ]) {
    const d = loadDoc(FIXTURE.mlbLive);
    Object.assign(seriesOf(d, 'AL-DS-A').lower, extra);
    const b = map(d) as Bracket;
    assert.ok(b, JSON.stringify(extra));
    const slot = b.series.find((s) => s.seriesKey === 'AL-DS-A')!.lower;
    assert.equal(slot.kind, 'placeholder');
    assert.ok(!('feederSeriesKey' in slot), 'the mapped slot has no field for the feeder key');
    assert.ok(!JSON.stringify(slot).includes('AL-WC-B'), 'the feeder key is on the mapped slot');
    if (slot.kind === 'placeholder') assert.equal(slot.label, 'NYY/BOS');
  }
  // With no candidates the slot is exactly what it was before the key existed.
  const plain = (map(loadDoc(FIXTURE.mlbLive)) as Bracket).series.find((s) => s.seriesKey === 'AL-DS-A')!.lower;
  const d = loadDoc(FIXTURE.mlbLive);
  Object.assign(seriesOf(d, 'AL-DS-A').lower, { feederSeriesKey: 'AL-WC-B', candidates: null });
  assert.deepEqual((map(d) as Bracket).series.find((s) => s.seriesKey === 'AL-DS-A')!.lower, plain);
});

test('OVERLAY: half a pair is no pair, and the document still maps', () => {
  const cases: Doc[] = [
    { candidates: ['new-york-yankees', 'boston-red-sox'] },
    { feederSeriesKey: 'AL-WC-B' },
    { feederSeriesKey: 'AL-WC-B', candidates: null },
    { feederSeriesKey: 'AL-WC-B', candidates: ['new-york-yankees'] },
    { feederSeriesKey: 'AL-WC-B', candidates: ['new-york-yankees', 'boston-red-sox', 'houston-astros'] },
    { feederSeriesKey: 'AL-WC-B', candidates: ['new-york-yankees', 'new-york-yankees'] },
    { feederSeriesKey: 'AL-WC-B', candidates: ['new-york-yankees', 7] },
    { feederSeriesKey: '', candidates: ['new-york-yankees', 'boston-red-sox'] },
    { feederSeriesKey: 'AL-WC-B', candidates: 'new-york-yankees,boston-red-sox' },
  ];
  for (const c of cases) {
    const d = loadDoc(FIXTURE.mlbLive);
    Object.assign(seriesOf(d, 'AL-DS-A').lower, c);
    const b = map(d);
    assert.ok(b, JSON.stringify(c));
    assert.deepEqual(b.series.find((s) => s.seriesKey === 'AL-DS-A')!.lower, { kind: 'placeholder', label: 'NYY/BOS', seed: null, candidates: null }, JSON.stringify(c));
  }
});

test('OVERLAY: a short round label is carried when present and null when not', () => {
  const d = loadDoc(FIXTURE.mlbLive);
  assert.ok((map(d) as Bracket).series.every((s) => s.shortLabel === null));
  seriesOf(d, 'AL-DS-A').shortLabel = 'Division';
  const s = (map(d) as Bracket).series.find((x) => x.seriesKey === 'AL-DS-A')!;
  assert.equal(s.shortLabel, 'Division');
  assert.equal(s.roundLabel, 'Division Series');
});

test('HOST: a game row that disagrees with its series loses its host and keeps its row', () => {
  const d = loadDoc(FIXTURE.mlbLive);
  assert.equal((map(d) as Bracket).series[0].games[0].homeSide, 'higher');
  seriesOf(d, 'AL-WC-A').games[0].home = 'chicago-white-sox';
  const g = (map(d) as Bracket).series[0].games[0];
  assert.equal(g.homeSide, null);
  assert.equal(g.gameNumber, 1);
});

test('games come out in game order whatever order they were stored in', () => {
  const d = loadDoc(FIXTURE.mlbLive);
  seriesOf(d, 'AL-DS-A').games.reverse();
  assert.deepEqual((map(d) as Bracket).series.find((s) => s.seriesKey === 'AL-DS-A')!.games.map((g) => g.gameNumber), [1, 2, 3, 4, 5]);
});

test('REFUSAL: the wrong league, the wrong season, or no series', () => {
  const d = loadDoc(FIXTURE.mlbLive);
  assert.ok(mapBracketDoc(d, { league: 'MLB', season: 2026 }));
  assert.equal(mapBracketDoc(d, { league: 'WNBA', season: 2026 }), null);
  assert.equal(mapBracketDoc(d, { league: 'MLB', season: 2025 }), null);
  assert.equal(mapBracketDoc({ ...d, series: [] }, { league: 'MLB', season: 2026 }), null);
  assert.equal(mapBracketDoc({ ...d, series: undefined }, { league: 'MLB', season: 2026 }), null);
  for (const junk of [null, undefined, 'MLB_2026', 7, []]) assert.equal(mapBracketDoc(junk, { league: 'MLB', season: 2026 }), null);
});

// Each case edits ONE value in a capture that otherwise maps. The capture is
// asserted to map first, so a refusal below is caused by the edit alone.
const REFUSALS: [string, string, (d: Doc) => void][] = [
  ['an unknown series status', FIXTURE.mlbLive, (d) => { seriesOf(d, 'AL-WC-A').status = 'paused'; }],
  ['an unknown game status', FIXTURE.mlbLive, (d) => { seriesOf(d, 'AL-WC-A').games[0].status = 'warmup'; }],
  ['a missing round label', FIXTURE.mlbLive, (d) => { delete seriesOf(d, 'AL-WC-A').roundLabel; }],
  ['an empty round label', FIXTURE.mlbLive, (d) => { seriesOf(d, 'AL-WC-A').roundLabel = '  '; }],
  ['a missing series key', FIXTURE.mlbLive, (d) => { delete seriesOf(d, 'AL-WC-A').seriesKey; }],
  ['a repeated series key', FIXTURE.mlbLive, (d) => { seriesOf(d, 'AL-WC-B').seriesKey = 'AL-WC-A'; }],
  ['a bestOf that is not a number', FIXTURE.mlbLive, (d) => { seriesOf(d, 'AL-WC-A').bestOf = '3'; }],
  ['a slot that is both a club and a placeholder', FIXTURE.mlbLive, (d) => { seriesOf(d, 'AL-WC-A').higher.placeholder = 'AL 3 Seed'; }],
  ['a slot that is neither', FIXTURE.mlbLive, (d) => { delete seriesOf(d, 'AL-WC-A').higher.slug; }],
  ['a seed that is not a whole number', FIXTURE.mlbLive, (d) => { seriesOf(d, 'AL-WC-A').higher.seed = 3.5; }],
  ['a seed of zero', FIXTURE.mlbLive, (d) => { seriesOf(d, 'AL-WC-A').higher.seed = 0; }],
  ['wins that are not numbers', FIXTURE.wnbaLive, (d) => { (seriesOf(d, 'R1-1v8').wins as Doc).lower = '1'; }],
  ['negative wins', FIXTURE.wnbaLive, (d) => { (seriesOf(d, 'R1-1v8').wins as Doc).lower = -1; }],
  ['games that are not a list', FIXTURE.mlbLive, (d) => { (seriesOf(d, 'AL-WC-A') as Doc).games = null; }],
  ['a repeated game number', FIXTURE.mlbLive, (d) => { seriesOf(d, 'AL-WC-A').games[1].gameNumber = 1; }],
  ['a game number of zero', FIXTURE.mlbLive, (d) => { seriesOf(d, 'AL-WC-A').games[0].gameNumber = 0; }],
  ['a date that is not a date', FIXTURE.mlbLive, (d) => { seriesOf(d, 'AL-WC-A').games[0].date = 'Sep 29'; }],
  ['a final game with no winner', FIXTURE.wnbaLive, (d) => { seriesOf(d, 'R1-1v8').games[0].winnerSide = null; }],
  ['a final series with no winner', FIXTURE.mlbFinal, (d) => { seriesOf(d, 'WS').winner = null; }],
  ['a winner who is not in the series', FIXTURE.mlbFinal, (d) => { seriesOf(d, 'WS').winner = 'new-york-yankees'; }],
  ['a winner on a series that is not final', FIXTURE.wnbaLive, (d) => { seriesOf(d, 'R1-1v8').winner = 'new-york-liberty'; }],
];
for (const [name, fixture, edit] of REFUSALS) {
  test(`REFUSAL: ${name} refuses the whole document`, () => {
    assert.ok(map(loadDoc(fixture)), 'the capture maps before the edit');
    const d = loadDoc(fixture);
    edit(d);
    assert.equal(map(d), null);
  });
}
