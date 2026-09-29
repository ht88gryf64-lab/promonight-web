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
    const live = ([FIXTURE.mlbLive, FIXTURE.wnbaLive, FIXTURE.mlbInGame, FIXTURE.mlbFields, FIXTURE.wnbaFields] as string[]).includes(f);
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

// ---- The display fields, as the pipeline's writer version 2 stores them ----

test('CAPTURED: the stored slots carry a feeder key and two candidates; the mapped slots carry the candidates only', () => {
  const d = loadDoc(FIXTURE.mlbFields);
  assert.equal(d.writerVersion, 2);
  // As stored.
  assert.deepEqual(seriesOf(d, 'NL-DS-B').lower, { placeholder: 'ATL/PHI', seed: null, feederSeriesKey: 'NL-WC-A', candidates: ['atlanta-braves', 'philadelphia-phillies'] });
  assert.equal(seriesOf(d, 'NL-WC-A').status, 'live', 'the feeder is being played');
  assert.deepEqual(seriesOf(d, 'AL-CS').higher, { placeholder: 'AL Higher Seed', seed: null, feederSeriesKey: null, candidates: null });
  // As mapped.
  const b = map(d) as Bracket;
  const lower = (key: string) => b.series.find((s) => s.seriesKey === key)!.lower;
  assert.deepEqual(lower('NL-DS-B'), { kind: 'placeholder', label: 'ATL/PHI', seed: null, candidates: ['atlanta-braves', 'philadelphia-phillies'] });
  assert.deepEqual(lower('AL-DS-A'), { kind: 'placeholder', label: 'NYY/BOS', seed: null, candidates: ['new-york-yankees', 'boston-red-sox'] });
  assert.deepEqual(lower('AL-DS-B'), { kind: 'placeholder', label: 'HOU/CWS', seed: null, candidates: ['houston-astros', 'chicago-white-sox'] });
  assert.deepEqual(lower('NL-DS-A'), { kind: 'placeholder', label: 'SD/CHC', seed: null, candidates: ['san-diego-padres', 'chicago-cubs'] });
  assert.deepEqual(lower('AL-CS'), { kind: 'placeholder', label: 'AL Lower Seed', seed: null, candidates: null });
  // No feeder key came through, on any slot, game or series.
  const out = JSON.stringify(b.series.map((s) => [s.higher, s.lower, s.games]));
  for (const key of ['AL-WC-A', 'AL-WC-B', 'NL-WC-A', 'NL-WC-B']) assert.ok(!out.includes(key), key);
  assert.ok(!out.includes('feederSeriesKey'));
});

test('CAPTURED: short labels, beside the full ones', () => {
  const mlb = map(loadDoc(FIXTURE.mlbFields)) as Bracket;
  assert.deepEqual([...new Map(mlb.series.map((s) => [s.round, [s.roundLabel, s.shortLabel]])).values()], [
    ['Wild Card Series', 'Wild Card'],
    ['Division Series', 'Division'],
    ['Championship Series', 'LCS'],
    ['World Series', 'World Series'],
  ]);
  const wnba = map(loadDoc(FIXTURE.wnbaFields)) as Bracket;
  assert.deepEqual([...new Map(wnba.series.map((s) => [s.round, [s.roundLabel, s.shortLabel]])).values()], [
    ['First Round', 'First Round'],
    ['Semifinals', 'Semifinals'],
    ['WNBA Finals', 'Finals'],
  ]);
});

test('CAPTURED: the fields stored as null leave the slot as it was', () => {
  const w = map(loadDoc(FIXTURE.wnbaFields)) as Bracket;
  assert.deepEqual(w.series.find((s) => s.seriesKey === 'SF-A')!.higher, { kind: 'placeholder', label: 'TBD', seed: null, candidates: null });
});

// OVERLAY. No captured document holds a slot whose feeder is decided, since
// no 2026 series had finished. The tests below add the fields to a capture or
// to a 2025 document, to hold the mapper's side of that contract.
const slotOf = (b: Bracket, key: string, which: 'higher' | 'lower') => b.series.find((s) => s.seriesKey === key)![which];
const PAIR = ['new-york-yankees', 'boston-red-sox'];

test('RESOLUTION 1: a feeder that is final resolves the slot to its winner, with the winner\'s own seed', () => {
  // In the mixed 2025 document AL-DS-A is final, won by Toronto, the 1 seed.
  const d = loadDoc(FIXTURE.mlbMixed);
  const feeder = seriesOf(d, 'AL-DS-A');
  assert.deepEqual([feeder.status, feeder.winner, feeder.higher], ['final', 'toronto-blue-jays', { slug: 'toronto-blue-jays', seed: 1 }]);
  assert.deepEqual(slotOf(map(d) as Bracket, 'AL-CS', 'higher'), { kind: 'placeholder', label: 'AL Higher Seed', seed: null, candidates: null });

  Object.assign(seriesOf(d, 'AL-CS').higher, { feederSeriesKey: 'AL-DS-A' });
  assert.deepEqual(slotOf(map(d) as Bracket, 'AL-CS', 'higher'), { kind: 'club', slug: 'toronto-blue-jays', seed: 1 });
});

test('RESOLUTION 1: the winner may be the lower seed, and brings its own seed', () => {
  // AL-WC-A is final, won by Detroit, the 6 seed and the lower slot.
  const d = loadDoc(FIXTURE.mlbMixed);
  assert.equal(seriesOf(d, 'AL-WC-A').winner, 'detroit-tigers');
  Object.assign(seriesOf(d, 'AL-CS').lower, { feederSeriesKey: 'AL-WC-A' });
  assert.deepEqual(slotOf(map(d) as Bracket, 'AL-CS', 'lower'), { kind: 'club', slug: 'detroit-tigers', seed: 6 });
});

test('RESOLUTION 1: a decided feeder beats candidates', () => {
  const d = loadDoc(FIXTURE.mlbMixed);
  Object.assign(seriesOf(d, 'AL-CS').higher, { feederSeriesKey: 'AL-DS-A', candidates: ['toronto-blue-jays', 'new-york-yankees'] });
  assert.deepEqual(slotOf(map(d) as Bracket, 'AL-CS', 'higher'), { kind: 'club', slug: 'toronto-blue-jays', seed: 1 });
});

test('RESOLUTION 1: it chains, round to round, in document order', () => {
  // The final document with its later slots put back to placeholders that
  // name their feeders. Each round resolves against the one before it.
  const d = loadDoc(FIXTURE.mlbFinal);
  const back = (key: string, which: 'higher' | 'lower', feeder: string) => {
    const s = seriesOf(d, key);
    const was = s[which].slug as string;
    s[which] = { placeholder: `${key} ${which}`, seed: null, feederSeriesKey: feeder };
    for (const g of s.games) {
      if (g.home === was) g.home = `${key} ${which}`;
      if (g.away === was) g.away = `${key} ${which}`;
    }
  };
  const clean = map(loadDoc(FIXTURE.mlbFinal)) as Bracket;
  back('AL-DS-A', 'lower', 'AL-WC-B'); // Yankees, 4
  back('AL-CS', 'higher', 'AL-DS-A'); // Blue Jays, 1
  back('WS', 'higher', 'AL-CS'); // Blue Jays, 1
  back('WS', 'lower', 'NL-CS'); // Dodgers, 3
  const b = map(d) as Bracket;
  assert.ok(b, 'the document maps, winners and all');
  assert.deepEqual(slotOf(b, 'AL-DS-A', 'lower'), { kind: 'club', slug: 'new-york-yankees', seed: 4 });
  assert.deepEqual(slotOf(b, 'AL-CS', 'higher'), { kind: 'club', slug: 'toronto-blue-jays', seed: 1 });
  assert.deepEqual(slotOf(b, 'WS', 'higher'), { kind: 'club', slug: 'toronto-blue-jays', seed: 1 });
  assert.deepEqual(slotOf(b, 'WS', 'lower'), { kind: 'club', slug: 'los-angeles-dodgers', seed: 3 });
  // Hosts survive: a row that names the stored label is a row for the slot.
  assert.deepEqual(b.series.map((s) => s.games.map((g) => g.homeSide)), clean.series.map((s) => s.games.map((g) => g.homeSide)));
  assert.equal(b.series.find((s) => s.seriesKey === 'WS')!.winnerSide, 'lower');
});

test('RESOLUTION 1: a feeder that is not final, not in the document, or later in it resolves nothing', () => {
  const plain = { kind: 'placeholder', label: 'NYY/BOS', seed: null, candidates: null };
  for (const feeder of ['AL-WC-B', 'AL-WC-Z', 'AL-DS-A', 'AL-CS', 'WS', '']) {
    const d = loadDoc(FIXTURE.mlbLive);
    Object.assign(seriesOf(d, 'AL-DS-A').lower, { feederSeriesKey: feeder });
    assert.deepEqual(slotOf(map(d) as Bracket, 'AL-DS-A', 'lower'), plain, `feeder "${feeder}"`);
  }
});

test('RESOLUTION 2: a feeder still being played, with two candidates, carries the two clubs', () => {
  const d = loadDoc(FIXTURE.mlbLive);
  Object.assign(seriesOf(d, 'AL-DS-A').lower, { feederSeriesKey: 'AL-WC-B', candidates: PAIR });
  assert.deepEqual(slotOf(map(d) as Bracket, 'AL-DS-A', 'lower'), { kind: 'placeholder', label: 'NYY/BOS', seed: null, candidates: PAIR });
  // Candidates stand on their own: the rule is "if candidates are present".
  const alone = loadDoc(FIXTURE.mlbLive);
  Object.assign(seriesOf(alone, 'AL-DS-A').lower, { candidates: PAIR });
  assert.deepEqual(slotOf(map(alone) as Bracket, 'AL-DS-A', 'lower'), { kind: 'placeholder', label: 'NYY/BOS', seed: null, candidates: PAIR });
});

test('RESOLUTION 3: with neither, the stored label, verbatim', () => {
  const plain = { kind: 'placeholder', label: 'NYY/BOS', seed: null, candidates: null };
  for (const extra of [{}, { feederSeriesKey: 'AL-WC-B' }, { feederSeriesKey: 'AL-WC-B', candidates: null }, { candidates: null }]) {
    const d = loadDoc(FIXTURE.mlbLive);
    Object.assign(seriesOf(d, 'AL-DS-A').lower, extra);
    assert.deepEqual(slotOf(map(d) as Bracket, 'AL-DS-A', 'lower'), plain, JSON.stringify(extra));
  }
});

test('CANDIDATES: two distinct clubs or nothing, and the document still maps', () => {
  const cases: Doc[] = [
    { candidates: ['new-york-yankees'] },
    { candidates: ['new-york-yankees', 'boston-red-sox', 'houston-astros'] },
    { candidates: ['new-york-yankees', 'new-york-yankees'] },
    { candidates: ['new-york-yankees', 7] },
    { candidates: ['new-york-yankees', ''] },
    { candidates: 'new-york-yankees,boston-red-sox' },
    { candidates: {} },
  ];
  for (const c of cases) {
    const d = loadDoc(FIXTURE.mlbLive);
    Object.assign(seriesOf(d, 'AL-DS-A').lower, { feederSeriesKey: 'AL-WC-B', ...c });
    const b = map(d);
    assert.ok(b, JSON.stringify(c));
    assert.deepEqual(slotOf(b, 'AL-DS-A', 'lower'), { kind: 'placeholder', label: 'NYY/BOS', seed: null, candidates: null }, JSON.stringify(c));
  }
});

test('FEEDER KEY: never emitted, whatever the slot resolves to', () => {
  const runs: [string, string, 'higher' | 'lower', Doc][] = [
    [FIXTURE.mlbLive, 'AL-DS-A', 'lower', { feederSeriesKey: 'AL-WC-B' }],
    [FIXTURE.mlbLive, 'AL-DS-A', 'lower', { feederSeriesKey: 'AL-WC-B', candidates: null }],
    [FIXTURE.mlbLive, 'AL-DS-A', 'lower', { feederSeriesKey: 'AL-WC-B', candidates: PAIR }],
    [FIXTURE.mlbMixed, 'AL-CS', 'higher', { feederSeriesKey: 'AL-DS-A' }],
  ];
  for (const [fixture, key, which, extra] of runs) {
    const d = loadDoc(fixture);
    Object.assign(seriesOf(d, key)[which], extra);
    const b = map(d) as Bracket;
    assert.ok(b, JSON.stringify(extra));
    const slot = slotOf(b, key, which);
    assert.ok(!('feederSeriesKey' in slot), 'the mapped slot has no field for the feeder key');
    assert.ok(!JSON.stringify(slot).includes(extra.feederSeriesKey as string), 'the feeder key is on the mapped slot');
  }
});

// The pipeline writes this label itself, once a feeder is decided and before
// the feed names the winner: `Winner of ${feederKey}` (resolveStalePairs). It
// is the one stored label that holds a series key.
//
// RULING, 2026-09-29: label text resolves nothing. A label that holds a key
// renders "To be decided". Only the feederSeriesKey FIELD resolves a winner.
function withStoredLabel(d: Doc, key: string, which: 'higher' | 'lower', label: string, extra: Doc = {}) {
  const s = seriesOf(d, key);
  const was = (s[which].placeholder ?? s[which].slug) as string;
  s[which] = { placeholder: label, seed: null, ...extra };
  for (const g of s.games) {
    if (g.home === was) g.home = label;
    if (g.away === was) g.away = label;
  }
}

test('LABEL TEXT RESOLVES NOTHING: "Winner of AL-DS-A", its feeder final, reads "To be decided"', () => {
  const d = loadDoc(FIXTURE.mlbMixed);
  assert.deepEqual([seriesOf(d, 'AL-DS-A').status, seriesOf(d, 'AL-DS-A').winner], ['final', 'toronto-blue-jays']);
  withStoredLabel(d, 'AL-CS', 'higher', 'Winner of AL-DS-A');
  const b = map(d) as Bracket;
  assert.deepEqual(slotOf(b, 'AL-CS', 'higher'), { kind: 'placeholder', label: 'To be decided', seed: null, candidates: null });
  // No club was read out of the label, anywhere in the series.
  const cs = JSON.stringify(b.series.find((s) => s.seriesKey === 'AL-CS'));
  assert.ok(!cs.includes('toronto-blue-jays'));
  assert.ok(!cs.includes('AL-DS-A'));
  // The slot still hosts what it hosted: the rows name the stored label.
  assert.deepEqual(b.series.find((s) => s.seriesKey === 'AL-CS')!.games.map((g) => g.homeSide), ['higher', 'higher', 'lower', 'lower', 'lower', 'higher', 'higher']);
});

test('THE FIELD RESOLVES: the same slot, with feederSeriesKey, is the feeder\'s winner', () => {
  // The same stored label, now beside the field. The field decides; the
  // label was never consulted.
  const d = loadDoc(FIXTURE.mlbMixed);
  withStoredLabel(d, 'AL-CS', 'higher', 'Winner of AL-DS-A', { feederSeriesKey: 'AL-DS-A' });
  assert.deepEqual(slotOf(map(d) as Bracket, 'AL-CS', 'higher'), { kind: 'club', slug: 'toronto-blue-jays', seed: 1 });
  // And with a label that disagrees with the field, the field still decides.
  const other = loadDoc(FIXTURE.mlbMixed);
  withStoredLabel(other, 'AL-CS', 'higher', 'Winner of AL-WC-A', { feederSeriesKey: 'AL-DS-A' });
  assert.deepEqual(slotOf(map(other) as Bracket, 'AL-CS', 'higher'), { kind: 'club', slug: 'toronto-blue-jays', seed: 1 });
});

test('THE FIELD, feeder not decided: candidates if there are two, else "To be decided" for a key-shaped label', () => {
  const d = loadDoc(FIXTURE.mlbLive);
  withStoredLabel(d, 'AL-DS-A', 'lower', 'Winner of AL-WC-B', { feederSeriesKey: 'AL-WC-B', candidates: ['new-york-yankees', 'boston-red-sox'] });
  assert.deepEqual(slotOf(map(d) as Bracket, 'AL-DS-A', 'lower'), { kind: 'placeholder', label: 'To be decided', seed: null, candidates: ['new-york-yankees', 'boston-red-sox'] });
  const bare = loadDoc(FIXTURE.mlbLive);
  withStoredLabel(bare, 'AL-DS-A', 'lower', 'Winner of AL-WC-B', { feederSeriesKey: 'AL-WC-B' });
  assert.deepEqual(slotOf(map(bare) as Bracket, 'AL-DS-A', 'lower'), { kind: 'placeholder', label: 'To be decided', seed: null, candidates: null });
});

test('STORED KEY: every label that holds a key reads "To be decided", whatever it names', () => {
  // [series, side, stored label]
  const cases: [string, 'higher' | 'lower', string][] = [
    ['AL-DS-A', 'lower', 'Winner of AL-WC-B'],
    ['WS', 'higher', 'Winner of AL-CS'],
    ['WS', 'lower', 'Winner of NL-CS'],
    ['AL-DS-A', 'lower', 'AL-WC-B winner'],
    ['AL-DS-A', 'lower', 'Winner of AL-WC-B or AL-WC-A'],
    // Key-shaped, and in no document.
    ['AL-DS-A', 'lower', 'Winner of AL-WC-Z'],
    ['AL-DS-A', 'lower', 'Winner of R1-1v8'],
    ['AL-DS-A', 'lower', 'Winner of SF-A'],
    // A series later in the document.
    ['AL-DS-A', 'lower', 'Winner of NL-CS'],
    // A short key is a key when it is exactly a key of this document.
    ['AL-DS-A', 'lower', 'Winner of WS'],
    ['AL-DS-A', 'lower', 'WS berth'],
  ];
  for (const fixture of [FIXTURE.mlbLive, FIXTURE.mlbMixed, FIXTURE.mlbFinal]) {
    for (const [key, which, stored] of cases) {
      const d = loadDoc(fixture);
      withStoredLabel(d, key, which, stored);
      // In the final document the series has a winner, and a slot that is no
      // longer a club cannot be that winner: the mapper refuses the document,
      // which is its own correct answer. Only slots in series still open
      // are read here.
      if (seriesOf(d, key).status === 'final') continue;
      const b = map(d) as Bracket;
      assert.ok(b, `${fixture} ${stored}`);
      assert.deepEqual(slotOf(b, key, which), { kind: 'placeholder', label: 'To be decided', seed: null, candidates: null }, `${fixture} ${key} ${which}: ${stored}`);
    }
  }
  // The WNBA's own forms, in a WNBA document.
  const w = loadDoc(FIXTURE.wnbaLive);
  seriesOf(w, 'F').higher = { placeholder: 'Winner of SF-A', seed: null };
  seriesOf(w, 'F').lower = { placeholder: 'Winner of F', seed: null };
  seriesOf(w, 'SF-A').higher = { placeholder: 'Winner of R1-1v8', seed: null };
  const wb = map(w) as Bracket;
  for (const [key, which] of [['F', 'higher'], ['F', 'lower'], ['SF-A', 'higher']] as const) {
    assert.deepEqual(slotOf(wb, key, which), { kind: 'placeholder', label: 'To be decided', seed: null, candidates: null }, `${key} ${which}`);
  }
});

test('STORED KEY: a label with no key in it is left exactly as stored', () => {
  for (const stored of ['NYY/BOS', 'AL 4/5 Winner', 'AL Higher Seed', 'Higher Seed League Champion', 'TBD', 'SF/LAD', 'Winner of the AL Wild Card']) {
    const d = loadDoc(FIXTURE.mlbLive);
    seriesOf(d, 'AL-DS-A').lower = { placeholder: stored, seed: null };
    assert.deepEqual(slotOf(map(d) as Bracket, 'AL-DS-A', 'lower'), { kind: 'placeholder', label: stored, seed: null, candidates: null }, stored);
  }
});

test('NO SERIES KEY on any mapped slot or game, in any fixture', () => {
  for (const f of ALL) {
    const d = loadDoc(f);
    const b = map(d) as Bracket;
    for (const s of b.series) {
      const text = JSON.stringify([s.higher, s.lower, s.games]);
      for (const other of d.series as Series[]) {
        const key = other.seriesKey as string;
        assert.ok(!text.includes(`"${key}"`), `${f}: ${key} is a value on ${s.seriesKey}`);
        if (key.length >= 4) assert.ok(!text.includes(key), `${f}: ${key} is on ${s.seriesKey}`);
      }
    }
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
