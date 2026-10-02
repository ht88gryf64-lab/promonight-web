// "Where things stand": one test per state (a round being played, between
// rounds, champion, undeterminable), an oracle that reads every leader and
// every score straight from the stored document, and the clock words the
// line must never use.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mapBracketDoc } from '../map';
import { buildLeagueView, type LeagueView } from '../view';
import { gameStarts, standingLine } from '../standing';
import { CAPTURED_AT, FIXTURE, LYNX_OUT_AT, clubs, decidedMlb, decidedWnba, loadDoc, parks } from './helpers';

type Doc = Record<string, unknown>;
function build(doc: Doc, now: Date) {
  const b = mapBracketDoc(doc, { league: doc.league as 'MLB' | 'WNBA', season: doc.season as number });
  assert.ok(b);
  const v = buildLeagueView(b, clubs(), parks(), now);
  assert.ok(v);
  return { b, v, line: standingLine(v, gameStarts(b), now) };
}
const AT_1001 = new Date('2026-10-01T16:25:00Z');
const MIXED_AT = new Date('2025-10-08T12:00:00Z');

// ---- A round being played ----

test('ROUND PLAYED: MLB Wild Card, three series final and one tied, then the next timed game', () => {
  const { line } = build(loadDoc('MLB_2026.live-20261001T1625Z.json'), AT_1001);
  assert.equal(
    line,
    'Wild Card Series: the White Sox beat the Astros 2-0; the Yankees beat the Red Sox 2-0; the Braves and the Phillies are tied 1-1; the Padres beat the Cubs 2-0. Next game: Game 3, Phillies at Braves, Thu, Oct 1, 8:00 PM ET.',
  );
});

test('ROUND PLAYED: WNBA first round with the Lynx out, leads and a tie', () => {
  const { line } = build(loadDoc(FIXTURE.wnbaLynxOut), LYNX_OUT_AT);
  assert.equal(
    line,
    'First Round: the Liberty beat the Lynx 2-0; the Valkyries lead the Wings 1-0; the Aces and the Fever are tied 1-1; the Dream leads the Mystics 1-0. Next game: Game 2, Valkyries at Wings, Wed, Sep 30, 9:00 PM ET.',
  );
});

test('ROUND PLAYED: MLB 2025 Division Series, a later round, a 2-2 tie and a sweep in progress', () => {
  const { line } = build(loadDoc(FIXTURE.mlbMixed), MIXED_AT);
  assert.equal(
    line,
    'Division Series: the Blue Jays beat the Yankees 3-1; the Mariners and the Tigers are tied 2-2; the Brewers lead the Cubs 2-1; the Dodgers lead the Phillies 2-0. Next game: Game 3, Phillies at Dodgers, Wed, Oct 8, 9:08 PM ET.',
  );
});

test('ROUND PLAYED: a game the feed still lists as scheduled after its start is never the next game', () => {
  // Every Game 3 of the 10-01 capture is listed; at 01:00Z on Oct 2 the
  // 8:00 PM ET game has started and is not offered as next.
  const { line } = build(loadDoc('MLB_2026.live-20261001T1625Z.json'), new Date('2026-10-02T01:00:00Z'));
  assert.ok(line);
  assert.ok(!line.includes('Thu, Oct 1, 8:00 PM ET'), line);
});

test('ROUND PLAYED: singular nicknames take a singular verb, plural ones a plural verb', () => {
  const { line } = build(loadDoc(FIXTURE.wnbaLive), CAPTURED_AT);
  assert.ok(line?.startsWith('First Round: the Liberty leads the Lynx 1-0; the Valkyries lead the Wings 1-0; the Aces lead the Fever 1-0; the Dream leads the Mystics 1-0.'), line ?? '');
});

// ---- The next game is named only when it is surely next (round 1 M1, L2, L3) ----

const mixed = () => loadDoc(FIXTURE.mlbMixed);
const gameOf = (doc: Doc, key: string, n: number) => ((doc.series as Doc[]).find((s) => s.seriesKey === key)!.games as Doc[]).find((g) => g.gameNumber === n)!;

test('NEXT GAME: an earlier unplayed game with no time, or postponed, or suspended, leaves the clause out', () => {
  const base = build(mixed(), MIXED_AT).line as string;
  assert.ok(base.endsWith('Next game: Game 3, Phillies at Dodgers, Wed, Oct 8, 9:08 PM ET.'), base);
  const head = base.slice(0, base.indexOf(' Next game:'));
  // The series whose next game that is: its Game 3 starts 2025-10-09T01:08Z.
  const key = (mixed().series as Doc[]).find((s) => String(gameOf(mixed(), s.seriesKey as string, 3)?.start ?? '').startsWith('2025-10-09T01:08'))!.seriesKey as string;
  for (const [why, edit] of [
    ['time TBD', (g: Doc) => (g.startTimeTBD = true)],
    ['postponed', (g: Doc) => (g.status = 'postponed')],
    ['suspended', (g: Doc) => (g.status = 'suspended')],
  ] as const) {
    const doc = mixed();
    edit(gameOf(doc, key, 3));
    assert.equal(build(doc, MIXED_AT).line, head, why);
  }
});

test('NEXT GAME: a game the feed still lists as scheduled after its start blocks the clause on its day', () => {
  // Step 11 on Oct 4 at 18:30Z: Cubs at Brewers Game 1 (18:08Z) has started
  // but is still listed as scheduled, so the round's opener is not named.
  const line = build(loadDoc('MLB_2025.replay-step-11.json'), new Date('2025-10-04T18:30:00Z')).line;
  assert.equal(line, 'Next round: Division Series.');
});

test('NEXT GAME: a timed game of a later round that is not started can be the next game', () => {
  const doc = mixed();
  // Give a Championship Series Game 1 a start before every Division Series game left.
  const cs = (doc.series as Doc[]).find((s) => s.round === 'championship_series')!;
  const g1 = (cs.games as Doc[]).find((g) => g.gameNumber === 1)!;
  Object.assign(g1, { start: '2025-10-08T16:00:00Z', startTimeTBD: false, date: '2025-10-08', status: 'scheduled' });
  const line = build(doc, MIXED_AT).line as string;
  assert.ok(line.includes('Next game: Game 1,') && line.includes('Wed, Oct 8, 12:00 PM ET'), line);
});

test('A SERIES WAITING ON AN OPPONENT is said, not skipped', () => {
  const v = build(loadDoc(FIXTURE.mlbWildCard), LYNX_OUT_AT);
  const view = structuredClone(v.v);
  const s = view.rounds[0].groups[0].series[0];
  Object.assign(s, { status: 'upcoming', games: [] });
  Object.assign(s.higher, { wins: 0 });
  Object.assign(s.lower, { kind: 'placeholder', label: 'Yankees / Red Sox winner', wins: 0, won: false });
  const line = standingLine(view, gameStarts(v.b), LYNX_OUT_AT) as string;
  assert.ok(line.includes(`the ${s.higher.label} await the Yankees / Red Sox winner`), line);
  Object.assign(s.higher, { kind: 'placeholder', label: 'TBD' });
  assert.ok((standingLine(view, gameStarts(v.b), LYNX_OUT_AT) as string).includes('one matchup is still to be set'));
});

// ---- Between rounds ----

test('BETWEEN ROUNDS: the next round by name, and its first game when one has a date and a time', () => {
  const { line } = build(loadDoc('MLB_2025.replay-step-11.json'), new Date('2025-10-02T12:00:00Z'));
  assert.equal(line, 'Next round: Division Series. It opens with Game 1, Cubs at Brewers, Sat, Oct 4, 2:08 PM ET.');
  // Before the first pitch of the first round, the same shape.
  assert.equal(build(loadDoc(FIXTURE.mlbLive), CAPTURED_AT).line, 'Next round: Wild Card Series. It opens with Game 1, Phillies at Braves, Tue, Sep 29, 2:00 PM ET.');
});

test('BETWEEN ROUNDS: no game with a date and a time, so no game is named', () => {
  const doc = loadDoc('MLB_2025.replay-step-11.json');
  for (const s of doc.series as Doc[]) if (s.round === 'division_series') for (const g of s.games as Doc[]) g.startTimeTBD = true;
  const { line } = build(doc, new Date('2025-10-02T12:00:00Z'));
  assert.equal(line, 'Next round: Division Series.');
});

// ---- Champion ----

test('CHAMPION: the winner, the round, the beaten club and the series score', () => {
  assert.equal(build(loadDoc(FIXTURE.mlbFinal), new Date('2025-11-03T12:00:00Z')).line, 'The Los Angeles Dodgers won the 2025 World Series, beating the Toronto Blue Jays 4-3.');
  assert.equal(build(loadDoc(FIXTURE.wnbaFinal), new Date('2025-10-20T12:00:00Z')).line, 'The Las Vegas Aces won the 2025 WNBA Finals, beating the Phoenix Mercury 4-0.');
  assert.equal(build(decidedWnba(), new Date('2026-11-05T12:00:00Z')).line, 'The Golden State Valkyries won the 2026 WNBA Finals, beating the Atlanta Dream 4-3.');
});

// ---- Undeterminable: nothing at all ----

test('UNDETERMINABLE: a series the view cannot read straight, or a phase with no round, gives null', () => {
  const base = build(loadDoc(FIXTURE.mlbWildCard), LYNX_OUT_AT);
  const starts = gameStarts(base.b);
  const withSeries = (f: (s: LeagueView['rounds'][number]['groups'][number]['series'][number]) => void): LeagueView => {
    const v = structuredClone(base.v);
    f(v.rounds[0].groups[0].series[0]);
    return v;
  };
  // Final with no winner.
  assert.equal(standingLine(withSeries((s) => { s.status = 'final'; s.higher.won = false; s.lower.won = false; }), starts, LYNX_OUT_AT), null);
  // A winner with fewer wins than the loser.
  assert.equal(standingLine(withSeries((s) => { s.status = 'final'; s.higher.won = true; s.higher.wins = 0; s.lower.wins = 1; }), starts, LYNX_OUT_AT), null);
  // A winner while the series is not final.
  assert.equal(standingLine(withSeries((s) => { s.lower.won = true; }), starts, LYNX_OUT_AT), null);
  // A phase naming a round the view does not have.
  assert.equal(standingLine({ ...base.v, phase: { kind: 'active', roundKey: 'nope', roundLabel: 'Nope' } }, starts, LYNX_OUT_AT), null);
  // A champion that is not the last series' winner.
  const fin = build(loadDoc(FIXTURE.mlbFinal), new Date('2025-11-03T12:00:00Z'));
  assert.equal(standingLine({ ...fin.v, phase: { ...(fin.v.phase as Extract<LeagueView['phase'], { kind: 'concluded' }>), championTeamId: 'toronto-blue-jays' } }, gameStarts(fin.b), new Date('2025-11-03T12:00:00Z')), null);
  // A round being played whose every series has a slot no club fills.
  const v = structuredClone(base.v);
  for (const s of v.rounds[0].groups.flatMap((g) => g.series)) s.lower.kind = 'placeholder';
  assert.equal(standingLine(v, starts, LYNX_OUT_AT), null);
});

// ---- The oracle: every leader and score from the stored document ----

function names(): Map<string, string> {
  return new Map([...clubs()].map(([id, c]) => [id, c.name]));
}

/** The clause the stored document says for one series, computed here from
 *  the raw fields only (slugs, wins, status, the winner's slug). */
function oracle(s: Doc, n: Map<string, string>): string | null {
  const hi = s.higher as Doc;
  const lo = s.lower as Doc;
  const a = n.get(hi.slug as string);
  const b = n.get(lo.slug as string);
  if (!a || !b) return null;
  const w = s.wins as { higher: number; lower: number };
  if (s.status === 'final') {
    assert.ok(s.winner === hi.slug || s.winner === lo.slug, 'a final series names its winner');
    const winHi = s.winner === hi.slug;
    return winHi ? `the ${a} beat the ${b} ${w.higher}-${w.lower}` : `the ${b} beat the ${a} ${w.lower}-${w.higher}`;
  }
  if (w.higher === w.lower) return w.higher === 0 ? null : `the ${a} and the ${b} are tied ${w.higher}-${w.lower}`;
  // Singular in form, singular verb: written out here, not imported.
  const leads = (n: string) => (['Liberty', 'Dream', 'Fever', 'Lynx', 'Mercury', 'Sky', 'Storm', 'Sun', 'Tempo', 'Fire'].includes(n) ? 'leads' : 'lead');
  return w.higher > w.lower ? `the ${a} ${leads(a)} the ${b} ${w.higher}-${w.lower}` : `the ${b} ${leads(b)} the ${a} ${w.lower}-${w.higher}`;
}

for (const [label, file, now] of [
  ['MLB Wild Card 10-01', 'MLB_2026.live-20261001T1625Z.json', AT_1001],
  ['WNBA first round 10-01', 'WNBA_2026.live-20261001T1625Z.json', AT_1001],
  ['WNBA Lynx out', FIXTURE.wnbaLynxOut, LYNX_OUT_AT],
  ['MLB 2025 Division Series', FIXTURE.mlbMixed, MIXED_AT],
] as const) {
  test(`ORACLE (${label}): every series of the round is said exactly as the stored wins and winner say`, () => {
    const doc = loadDoc(file);
    const { line, v } = build(doc, now);
    assert.ok(line);
    const round = v.phase.kind === 'active' ? v.phase.roundKey : '';
    const n = names();
    let said = 0;
    for (const s of (doc.series as Doc[]).filter((x) => x.round === round)) {
      const want = oracle(s, n);
      if (!want) continue;
      assert.ok(line.includes(want), `want "${want}" in: ${line}`);
      said++;
    }
    assert.ok(said > 0);
    // Every "N-M" in the line is a series score of the document, or a time.
    const scores = new Set((doc.series as Doc[]).flatMap((s) => {
      const w = s.wins as { higher: number; lower: number };
      return [`${w.higher}-${w.lower}`, `${w.lower}-${w.higher}`];
    }));
    for (const m of line.matchAll(/\b(\d+)-(\d+)\b/g)) assert.ok(scores.has(m[0]), `${m[0]} is no series score of the document`);
  });
}

// ---- No clock words, in any state ----

const CLOCK_WORDS = /\b(today|tonight|tomorrow|yesterday|live|latest|right now|now|currently|current|so far|this (week|morning|afternoon|evening)|updated|just)\b/i;
test('NO CLOCK WORDS in any state the fixtures hold, and no dash', () => {
  const lines = [
    build(loadDoc(FIXTURE.mlbLive), CAPTURED_AT).line,
    build(loadDoc(FIXTURE.wnbaLive), CAPTURED_AT).line,
    build(loadDoc(FIXTURE.mlbInGame), new Date('2026-09-29T19:09:00Z')).line,
    build(loadDoc(FIXTURE.mlbWildCard), LYNX_OUT_AT).line,
    build(loadDoc(FIXTURE.wnbaLynxOut), LYNX_OUT_AT).line,
    build(loadDoc('MLB_2026.live-20261001T1625Z.json'), AT_1001).line,
    build(loadDoc('WNBA_2026.live-20261001T1625Z.json'), AT_1001).line,
    build(loadDoc(FIXTURE.mlbMixed), MIXED_AT).line,
    build(loadDoc('MLB_2025.replay-step-11.json'), new Date('2025-10-02T12:00:00Z')).line,
    build(loadDoc('WNBA_2025.replay-step-11.json'), new Date('2025-09-21T12:00:00Z')).line,
    build(loadDoc(FIXTURE.mlbFinal), new Date('2025-11-03T12:00:00Z')).line,
    build(decidedMlb(), new Date('2026-11-05T12:00:00Z')).line,
  ];
  for (const l of lines) {
    assert.ok(l, 'every fixture state is determinable');
    assert.ok(!CLOCK_WORDS.test(l), `${l.match(CLOCK_WORDS)?.[0]}: ${l}`);
    assert.ok(!/[—–]/.test(l), l);
    assert.ok(!/undefined|null|NaN|\s{2,}/.test(l), l);
  }
});
