// The PromoNight Predicts line on a team page: every state, in both leagues,
// on the real locked brackets, and the guards that hide it.
//
// TODAY is the two bracket documents read 2026-10-01T16:25Z, the state the
// served pages showed that day; the 20-club table below is every club in
// both brackets, with the line each one gets. The other states are built from
// those documents with decide() (helpers.ts), which sets the stored fields
// the pipeline sets when a series ends. The outcomes are chosen to reach every
// state, not predicted.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { PREDICTED, buildWithPredictions, clubs, decide, loadDoc, mapPredicted } from './helpers';
import { mapBracketDoc } from '../map';
import { decidesLine, teamPick, type TeamPickView } from '../team-pick';
import type { Bracket } from '../types';

type Doc = Record<string, unknown>;
const TODAY = { mlb: 'MLB_2026.live-20261001T1625Z.json', wnba: 'WNBA_2026.live-20261001T1625Z.json' } as const;
const AT = new Date('2026-10-01T16:25:27Z');

function bracketOf(d: Doc): Bracket {
  const b = mapBracketDoc(d, { league: d.league as 'MLB' | 'WNBA', season: d.season as number });
  assert.ok(b, 'the bracket maps');
  return b;
}
const predicted = { mlb: () => mapPredicted(PREDICTED.mlb), wnba: () => mapPredicted(PREDICTED.wnba) };

/** The line for a club on a stored document, through the real assembly first
 *  (so the two documents are known to join), as loadTeamPick runs it. */
function line(doc: Doc, league: 'mlb' | 'wnba', club: string): TeamPickView {
  const built = buildWithPredictions(doc, PREDICTED[league], AT);
  const v = teamPick(built.bracket, built.predicted, club, clubs());
  assert.ok(typeof v !== 'string', `${club}: ${String(v)}`);
  return v;
}
const today = (league: 'mlb' | 'wnba') => loadDoc(TODAY[league]);

// ---- The 20 clubs, as of the documents read 2026-10-01T16:25Z ----

const TABLE: [string, 'mlb' | 'wnba', string, string, string][] = [
  ['houston-astros', 'mlb', 'busted', "PromoNight's pick: Astros to lose the Division Series to the Guardians.", 'Pick busted: the Astros went out earlier than picked, losing to the White Sox 2-0 in the Wild Card Series.'],
  ['chicago-white-sox', 'mlb', 'busted', "PromoNight's pick: White Sox to lose the Wild Card Series to the Astros.", 'Pick busted: the White Sox went further than picked, beating the Astros 2-0 in the Wild Card Series.'],
  ['new-york-yankees', 'mlb', 'decides', "PromoNight's pick: Yankees to lose the Division Series to the Rays.", 'The Division Series decides this pick.'],
  ['boston-red-sox', 'mlb', 'correct', "PromoNight's pick: Red Sox to lose the Wild Card Series to the Yankees.", 'Pick correct: the Yankees beat the Red Sox 2-0 in the Wild Card Series.'],
  ['atlanta-braves', 'mlb', 'alive', "PromoNight's pick: Braves to lose the Division Series to the Dodgers.", 'Pick still alive.'],
  ['philadelphia-phillies', 'mlb', 'decides', "PromoNight's pick: Phillies to lose the Wild Card Series to the Braves.", 'The Wild Card Series decides this pick.'],
  ['san-diego-padres', 'mlb', 'decides', "PromoNight's pick: Padres to lose the Division Series to the Brewers.", 'The Division Series decides this pick.'],
  ['chicago-cubs', 'mlb', 'correct', "PromoNight's pick: Cubs to lose the Wild Card Series to the Padres.", 'Pick correct: the Padres beat the Cubs 2-0 in the Wild Card Series.'],
  ['tampa-bay-rays', 'mlb', 'alive', "PromoNight's pick: Rays to lose the World Series to the Brewers.", 'Pick still alive.'],
  ['cleveland-guardians', 'mlb', 'alive', "PromoNight's pick: Guardians to lose the Championship Series to the Rays.", 'Pick still alive.'],
  ['milwaukee-brewers', 'mlb', 'alive', "PromoNight's pick: Brewers to win the World Series.", 'Pick still alive.'],
  ['los-angeles-dodgers', 'mlb', 'alive', "PromoNight's pick: Dodgers to lose the Championship Series to the Brewers.", 'Pick still alive.'],
  ['minnesota-lynx', 'wnba', 'busted', "PromoNight's pick: Lynx to lose the WNBA Finals to the Valkyries.", 'Pick busted: the Lynx went out earlier than picked, losing to the Liberty 2-0 in the First Round.'],
  ['new-york-liberty', 'wnba', 'busted', "PromoNight's pick: Liberty to lose the First Round to the Lynx.", 'Pick busted: the Liberty went further than picked, beating the Lynx 2-0 in the First Round.'],
  ['golden-state-valkyries', 'wnba', 'alive', "PromoNight's pick: Valkyries to win the WNBA Finals.", 'Pick still alive.'],
  ['dallas-wings', 'wnba', 'decides', "PromoNight's pick: Wings to lose the First Round to the Valkyries.", 'The First Round decides this pick.'],
  ['las-vegas-aces', 'wnba', 'alive', "PromoNight's pick: Aces to lose the Semifinals to the Valkyries.", 'Pick still alive.'],
  ['indiana-fever', 'wnba', 'decides', "PromoNight's pick: Fever to lose the First Round to the Aces.", 'The First Round decides this pick.'],
  ['atlanta-dream', 'wnba', 'decides', "PromoNight's pick: Dream to lose the Semifinals to the Lynx.", 'The Semifinals decide this pick. The Dream face the Liberty, not the Lynx as picked.'],
  ['washington-mystics', 'wnba', 'correct', "PromoNight's pick: Mystics to lose the First Round to the Dream.", 'Pick correct: the Dream beat the Mystics 2-0 in the First Round.'],
];

test('TODAY: the table names every club in both brackets, once', () => {
  const inBrackets = (['mlb', 'wnba'] as const).flatMap((l) => [...new Set(predicted[l]().series.flatMap((s) => [s.higher.slug, s.lower.slug]))]);
  assert.equal(inBrackets.length, 20);
  assert.deepEqual(TABLE.map((r) => r[0]).sort(), inBrackets.sort());
});

for (const [club, league, kind, pickLine, statusLine] of TABLE) {
  test(`TODAY ${club}: ${kind}`, () => {
    const v = line(today(league), league, club);
    assert.equal(v.kind, kind);
    assert.equal(v.pickLine, pickLine);
    assert.equal(v.statusLine, statusLine);
    assert.equal(v.href, `/playoffs/${league}#predictions`);
  });
}

// ---- Every state, both leagues ----

test('ALIVE, waiting: won its series, the next one does not name it yet', () => {
  // The WNBA semifinal slots name no feeder, so a first-round winner is not
  // in a semifinal until the pipeline writes it there.
  const d = today('wnba');
  decide(d, 'R1-2v7', { winner: 'golden-state-valkyries' });
  const v = line(d, 'wnba', 'golden-state-valkyries');
  assert.equal(v.kind, 'alive');
  assert.equal(v.statusLine, 'Pick still alive.');
  // MLB: the Rays are picked to win two series and have played none.
  assert.equal(line(today('mlb'), 'mlb', 'tampa-bay-rays').statusLine, 'Pick still alive.');
});

test('DECIDES, the title pick in the final round', () => {
  const d = today('mlb');
  decide(d, 'NL-WC-A', { winner: 'atlanta-braves' });
  decide(d, 'NL-DS-A', { winner: 'milwaukee-brewers' });
  decide(d, 'NL-DS-B', { winner: 'los-angeles-dodgers' });
  decide(d, 'AL-DS-A', { winner: 'tampa-bay-rays' });
  decide(d, 'AL-DS-B', { winner: 'cleveland-guardians' });
  decide(d, 'NL-CS', { winner: 'milwaukee-brewers', higher: ['milwaukee-brewers', 1], lower: ['los-angeles-dodgers', 2] });
  decide(d, 'AL-CS', { winner: 'tampa-bay-rays', higher: ['tampa-bay-rays', 1], lower: ['cleveland-guardians', 2] });
  const ws = (d.series as Doc[]).find((s) => s.seriesKey === 'WS') as Doc;
  ws.higher = { slug: 'milwaukee-brewers', seed: 1 };
  ws.lower = { slug: 'tampa-bay-rays', seed: 1 };
  ws.status = 'live';
  const brewers = line(d, 'mlb', 'milwaukee-brewers');
  assert.equal(brewers.kind, 'decides');
  assert.equal(brewers.statusLine, 'The World Series decides this pick.');
  const rays = line(d, 'mlb', 'tampa-bay-rays');
  assert.equal(rays.kind, 'decides');
  assert.equal(rays.statusLine, 'The World Series decides this pick.');
});

test('DECIDES, PICKED OPPONENT NOT IN THE SERIES: the club\'s own series names another club, both leagues', () => {
  // Today: the Dream play the Liberty in the semifinal the pick names; the
  // pick names the Lynx, who are out.
  const dream = line(today('wnba'), 'wnba', 'atlanta-dream');
  assert.equal(dream.kind, 'decides');
  assert.equal(dream.statusLine, 'The Semifinals decide this pick. The Dream face the Liberty, not the Lynx as picked.');
  // MLB: the Guardians are picked to lose the Championship Series to the
  // Rays; the Yankees beat the Rays and meet the Guardians there.
  const m = today('mlb');
  decide(m, 'AL-DS-A', { winner: 'new-york-yankees' });
  decide(m, 'AL-DS-B', { winner: 'cleveland-guardians' });
  const cs = (m.series as Doc[]).find((x) => x.seriesKey === 'AL-CS')!;
  cs.higher = { slug: 'cleveland-guardians', seed: 2 };
  cs.lower = { slug: 'new-york-yankees', seed: 4 };
  const g = line(m, 'mlb', 'cleveland-guardians');
  assert.equal(g.kind, 'decides');
  assert.equal(g.statusLine, 'The Championship Series decides this pick. The Guardians face the Yankees, not the Rays as picked.');
});

test('DECIDES, PLACEHOLDER OPPONENT: a slot that names nobody yet keeps the plain line', () => {
  // The Aces win their first round and are written into semifinal B, whose
  // other slot is still "TBD" (no feeder).
  const w = today('wnba');
  decide(w, 'R1-3v6', { winner: 'las-vegas-aces' });
  const sf = (w.series as Doc[]).find((x) => x.seriesKey === 'SF-B')!;
  sf.lower = { slug: 'las-vegas-aces', seed: 3 };
  const aces = line(w, 'wnba', 'las-vegas-aces');
  assert.equal(aces.kind, 'decides');
  assert.equal(aces.statusLine, 'The Semifinals decide this pick.');
});

test('DECIDES, SAME OPPONENT: the club picked is the club faced, so the plain line', () => {
  // The Yankees face the Rays, as picked; the Phillies face the Braves.
  assert.equal(line(today('mlb'), 'mlb', 'new-york-yankees').statusLine, 'The Division Series decides this pick.');
  assert.equal(line(today('mlb'), 'mlb', 'philadelphia-phillies').statusLine, 'The Wild Card Series decides this pick.');
});

test('DECIDES, TITLE PICK IN THE FINAL against a club the bracket did not have there: the plain line (its pick line names no opponent)', () => {
  const d = today('mlb');
  decide(d, 'NL-WC-A', { winner: 'atlanta-braves' });
  decide(d, 'NL-DS-A', { winner: 'milwaukee-brewers' });
  decide(d, 'NL-DS-B', { winner: 'los-angeles-dodgers' });
  decide(d, 'NL-CS', { winner: 'milwaukee-brewers', higher: ['milwaukee-brewers', 1], lower: ['los-angeles-dodgers', 2] });
  decide(d, 'AL-DS-A', { winner: 'tampa-bay-rays' });
  decide(d, 'AL-DS-B', { winner: 'chicago-white-sox' });
  decide(d, 'AL-CS', { winner: 'chicago-white-sox', higher: ['tampa-bay-rays', 1], lower: ['chicago-white-sox', 6] });
  const ws = (d.series as Doc[]).find((x) => x.seriesKey === 'WS')!;
  ws.higher = { slug: 'milwaukee-brewers', seed: 1 };
  ws.lower = { slug: 'chicago-white-sox', seed: 6 };
  ws.status = 'live';
  assert.equal(line(d, 'mlb', 'milwaukee-brewers').statusLine, 'The World Series decides this pick.');
});

test('BUSTED, TITLE PICK THAT LOST THE FINAL: its own line, both leagues', () => {
  assert.equal(line(mlbWorldSeries('tampa-bay-rays', 'tampa-bay-rays'), 'mlb', 'milwaukee-brewers').statusLine, 'Pick busted: the Brewers lost the World Series to the Rays 4-3.');
  const t = today('wnba');
  decide(t, 'R1-2v7', { winner: 'golden-state-valkyries' });
  decide(t, 'SF-A', { winner: 'new-york-liberty' });
  decide(t, 'SF-B', { winner: 'golden-state-valkyries', higher: ['golden-state-valkyries', 2], lower: ['las-vegas-aces', 3] });
  decide(t, 'F', { winner: 'new-york-liberty', higher: ['golden-state-valkyries', 2], lower: ['new-york-liberty', 8] });
  const v = line(t, 'wnba', 'golden-state-valkyries');
  assert.equal(v.kind, 'busted');
  assert.equal(v.statusLine, 'Pick busted: the Valkyries lost the WNBA Finals to the Liberty 4-3.');
  // A title pick out before the final keeps the earlier-than-picked line.
  const m = today('mlb');
  decide(m, 'NL-DS-A', { winner: 'san-diego-padres' });
  assert.match(line(m, 'mlb', 'milwaukee-brewers').statusLine, /^Pick busted: the Brewers went out earlier than picked, losing to the Padres 3-2 in the Division Series\.$/);
});

test('DECIDES: a plural round takes the plural verb; a Series is singular', () => {
  assert.equal(decidesLine('Semifinals'), 'The Semifinals decide this pick.');
  assert.equal(decidesLine('WNBA Finals'), 'The WNBA Finals decide this pick.');
  assert.equal(decidesLine('First Round'), 'The First Round decides this pick.');
  for (const s of ['Wild Card Series', 'Division Series', 'Championship Series', 'World Series']) assert.equal(decidesLine(s), `The ${s} decides this pick.`);
  const d = today('wnba');
  decide(d, 'R1-2v7', { winner: 'golden-state-valkyries' });
  decide(d, 'R1-3v6', { winner: 'las-vegas-aces' });
  decide(d, 'SF-B', { winner: 'golden-state-valkyries', higher: ['golden-state-valkyries', 2], lower: ['las-vegas-aces', 3] });
  const f = (d.series as Doc[]).find((s) => s.seriesKey === 'F') as Doc;
  f.higher = { slug: 'atlanta-dream', seed: 4 };
  f.lower = { slug: 'golden-state-valkyries', seed: 2 };
  assert.equal(line(d, 'wnba', 'golden-state-valkyries').statusLine, 'The WNBA Finals decide this pick.');
});

test('CORRECT, the title pick won the title, both leagues', () => {
  const w = today('wnba');
  decide(w, 'R1-2v7', { winner: 'golden-state-valkyries' });
  decide(w, 'R1-3v6', { winner: 'las-vegas-aces' });
  decide(w, 'SF-A', { winner: 'atlanta-dream' });
  decide(w, 'SF-B', { winner: 'golden-state-valkyries', higher: ['golden-state-valkyries', 2], lower: ['las-vegas-aces', 3] });
  decide(w, 'F', { winner: 'golden-state-valkyries', higher: ['golden-state-valkyries', 2], lower: ['atlanta-dream', 4] });
  const v = line(w, 'wnba', 'golden-state-valkyries');
  assert.equal(v.kind, 'correct');
  assert.equal(v.statusLine, 'Pick correct: the Valkyries won the WNBA Finals.');

  const m = mlbWorldSeries('tampa-bay-rays', 'milwaukee-brewers');
  assert.equal(line(m, 'mlb', 'milwaukee-brewers').statusLine, 'Pick correct: the Brewers won the World Series.');
  // The Rays were picked to lose that final to the Brewers, and did.
  const rays = line(m, 'mlb', 'tampa-bay-rays');
  assert.equal(rays.kind, 'correct');
  assert.match(rays.statusLine, /^Pick correct: the Brewers beat the Rays 4-3 in the World Series\.$/);
});

test('CORRECT, out in the round named to the club named, both leagues', () => {
  assert.equal(line(today('mlb'), 'mlb', 'boston-red-sox').kind, 'correct');
  assert.equal(line(today('wnba'), 'wnba', 'washington-mystics').kind, 'correct');
});

test('DIFFERENT OPPONENT: out in the round named, to another club; never called correct or busted', () => {
  // WNBA: the Dream are picked to lose the semifinal to the Lynx, who are
  // out; the Liberty beat them instead.
  const w = today('wnba');
  decide(w, 'SF-A', { winner: 'new-york-liberty' });
  const dream = line(w, 'wnba', 'atlanta-dream');
  assert.equal(dream.kind, 'different');
  assert.equal(
    dream.statusLine,
    'Right round, different opponent: the Dream lost to the Liberty 3-2 in the Semifinals. PromoNight picked the Lynx.',
  );
  // MLB: the Guardians are picked to lose the Championship Series to the
  // Rays; the Yankees beat them there.
  const m = today('mlb');
  decide(m, 'AL-DS-A', { winner: 'new-york-yankees' });
  decide(m, 'AL-DS-B', { winner: 'cleveland-guardians' });
  decide(m, 'AL-CS', { winner: 'new-york-yankees', higher: ['cleveland-guardians', 2], lower: ['new-york-yankees', 4] });
  const g = line(m, 'mlb', 'cleveland-guardians');
  assert.equal(g.kind, 'different');
  assert.equal(
    g.statusLine,
    'Right round, different opponent: the Guardians lost to the Yankees 4-3 in the Championship Series. PromoNight picked the Rays.',
  );
  for (const v of [dream, g]) assert.ok(!/correct|busted/i.test(v.statusLine), v.statusLine);
});

test('BUSTED, out earlier than picked: a title pick out in an early round, and one that lost the final', () => {
  const m = today('mlb');
  decide(m, 'NL-DS-A', { winner: 'san-diego-padres' });
  const v = line(m, 'mlb', 'milwaukee-brewers');
  assert.equal(v.kind, 'busted');
  assert.equal(v.statusLine, 'Pick busted: the Brewers went out earlier than picked, losing to the Padres 3-2 in the Division Series.');
  const lost = mlbWorldSeries('tampa-bay-rays', 'tampa-bay-rays');
  assert.equal(
    line(lost, 'mlb', 'milwaukee-brewers').statusLine,
    'Pick busted: the Brewers lost the World Series to the Rays 4-3.',
  );
  assert.equal(line(today('wnba'), 'wnba', 'minnesota-lynx').kind, 'busted');
});

test('BUSTED, further than picked: past the round named, with the series that did it; and on to the title', () => {
  // In a later series that is not over: the line names the series it won.
  const v = line(today('mlb'), 'mlb', 'chicago-white-sox');
  assert.equal(v.kind, 'busted');
  // Waiting for the next series: the same.
  const w = today('wnba');
  assert.equal(line(w, 'wnba', 'new-york-liberty').statusLine, 'Pick busted: the Liberty went further than picked, beating the Lynx 2-0 in the First Round.');
  // Won the round it was picked to lose, and the next series does not name
  // it yet (the WNBA semifinal slots name no feeder).
  const wings = today('wnba');
  decide(wings, 'R1-2v7', { winner: 'dallas-wings' });
  assert.equal(line(wings, 'wnba', 'dallas-wings').statusLine, 'Pick busted: the Wings went further than picked, beating the Valkyries 2-1 in the First Round.');
  // Then lost a later series: still further than picked.
  decide(w, 'SF-A', { winner: 'atlanta-dream' });
  assert.equal(line(w, 'wnba', 'new-york-liberty').statusLine, 'Pick busted: the Liberty went further than picked, beating the Lynx 2-0 in the First Round.');
  // And won the title.
  const t = today('wnba');
  decide(t, 'R1-2v7', { winner: 'golden-state-valkyries' });
  decide(t, 'SF-A', { winner: 'new-york-liberty' });
  decide(t, 'SF-B', { winner: 'golden-state-valkyries', higher: ['golden-state-valkyries', 2], lower: ['las-vegas-aces', 3] });
  decide(t, 'F', { winner: 'new-york-liberty', higher: ['golden-state-valkyries', 2], lower: ['new-york-liberty', 8] });
  const champ = line(t, 'wnba', 'new-york-liberty');
  assert.equal(champ.statusLine, 'Pick busted: the Liberty went further than picked and won the WNBA Finals.');
  // The Valkyries, picked to win it, lost the final: out earlier than picked.
  assert.equal(
    line(t, 'wnba', 'golden-state-valkyries').statusLine,
    'Pick busted: the Valkyries lost the WNBA Finals to the Liberty 4-3.',
  );
  const m = mlbWorldSeries('chicago-white-sox', 'chicago-white-sox');
  assert.equal(line(m, 'mlb', 'chicago-white-sox').statusLine, 'Pick busted: the White Sox went further than picked and won the World Series.');
});

/** MLB decided through the World Series: Brewers against `al` (the Rays
 *  through the Guardians, or the White Sox through the Rays), won by
 *  `winner`. decide() gives the winner the majority, so the final is 4-3. */
function mlbWorldSeries(al: 'tampa-bay-rays' | 'chicago-white-sox', winner: string): Doc {
  const d = today('mlb');
  decide(d, 'NL-WC-A', { winner: 'atlanta-braves' });
  decide(d, 'NL-DS-A', { winner: 'milwaukee-brewers' });
  decide(d, 'NL-DS-B', { winner: 'los-angeles-dodgers' });
  decide(d, 'NL-CS', { winner: 'milwaukee-brewers', higher: ['milwaukee-brewers', 1], lower: ['los-angeles-dodgers', 2] });
  decide(d, 'AL-DS-A', { winner: 'tampa-bay-rays' });
  if (al === 'tampa-bay-rays') {
    decide(d, 'AL-DS-B', { winner: 'cleveland-guardians' });
    decide(d, 'AL-CS', { winner: 'tampa-bay-rays', higher: ['tampa-bay-rays', 1], lower: ['cleveland-guardians', 2] });
  } else {
    decide(d, 'AL-DS-B', { winner: 'chicago-white-sox' });
    decide(d, 'AL-CS', { winner: 'chicago-white-sox', higher: ['tampa-bay-rays', 1], lower: ['chicago-white-sox', 6] });
  }
  decide(d, 'WS', { winner, higher: ['milwaukee-brewers', 1], lower: [al, al === 'tampa-bay-rays' ? 1 : 6] });
  return d;
}

// ---- What the line depends on ----

test('OWN SERIES ONLY: deciding any series that never names a club leaves that club\'s line as it was', () => {
  // The pipeline revalidates the page of every club in a series that
  // changed. A line that moved on another club's result would stand stale.
  for (const league of ['mlb', 'wnba'] as const) {
    const base = today(league);
    const open = (base.series as Doc[]).filter((s) => s.status !== 'final');
    for (const s of open) {
      for (const side of ['higher', 'lower'] as const) {
        const slot = s[side] as { slug?: string };
        if (!slot.slug) continue;
        const after = today(league);
        decide(after, s.seriesKey as string, { winner: slot.slug });
        const b0 = bracketOf(base);
        const b1 = bracketOf(after);
        const p = predicted[league]();
        for (const club of clubs().keys()) {
          const names = (b: Bracket) => JSON.stringify(b.series.filter((x) => [x.higher, x.lower].some((y) => y.kind === 'club' && y.slug === club)));
          if (names(b0) !== names(b1)) continue;
          if (!p.series.some((x) => x.higher.slug === club || x.lower.slug === club)) continue;
          assert.deepEqual(teamPick(b1, p, club, clubs()), teamPick(b0, p, club, clubs()), `${league} ${s.seriesKey} to ${slot.slug}: ${club}`);
        }
      }
    }
  }
});

test('ROUND ORDER is the document\'s, not the alphabet\'s', () => {
  // "championship_series" sorts before "wild_card"; a string comparison
  // would put the Rays out before the Wild Card round.
  const v = line(today('mlb'), 'mlb', 'tampa-bay-rays');
  assert.equal(v.kind, 'alive');
});

// ---- The guards ----

test('GUARD: a club in no predicted series gets no line', () => {
  const b = bracketOf(today('mlb'));
  assert.equal(teamPick(b, predicted.mlb(), 'seattle-mariners', clubs()), 'no-team-pick');
});

test('GUARD: a club whose first real series is not its first predicted series gets no line', () => {
  // The Wings and the Fever trade first-round slots in the real bracket
  // (both series are still being played, so the document still maps).
  const d = today('wnba');
  const s = d.series as Doc[];
  const a = s.find((x) => x.seriesKey === 'R1-2v7') as Doc;
  const b = s.find((x) => x.seriesKey === 'R1-3v6') as Doc;
  const t = a.lower;
  a.lower = b.lower;
  b.lower = t;
  const br = bracketOf(d);
  assert.equal(teamPick(br, predicted.wnba(), 'dallas-wings', clubs()), 'first-series-mismatch');
  assert.equal(teamPick(br, predicted.wnba(), 'indiana-fever', clubs()), 'first-series-mismatch');
  // A club the trade did not touch keeps its line.
  assert.equal(typeof teamPick(br, predicted.wnba(), 'golden-state-valkyries', clubs()), 'object');
});

test('GUARD: a pick chain that does not end where it should gets no line', () => {
  const b = bracketOf(today('mlb'));
  // The Brewers picked to lose their Division Series, yet still in a later
  // predicted series: no single round to name.
  const p1 = predicted.mlb();
  const ds = p1.series.find((s) => s.seriesKey === 'NL-DS-A')!;
  ds.pick = ds.higher.slug === 'milwaukee-brewers' ? ds.lower.slug : ds.higher.slug;
  assert.equal(teamPick(b, p1, 'milwaukee-brewers', clubs()), 'pick-inconsistent');
  // The title pick and the champion field disagree.
  const p2 = predicted.mlb();
  p2.champion = 'tampa-bay-rays';
  assert.equal(teamPick(b, p2, 'milwaukee-brewers', clubs()), 'pick-inconsistent');
  assert.equal(teamPick(b, p2, 'tampa-bay-rays', clubs()), 'pick-inconsistent');
  // A predicted round the real bracket does not have, on a series the
  // club is picked to win: with no rank for it, the chain would still read
  // as alive.
  const p3 = predicted.mlb();
  p3.series.find((s) => s.seriesKey === 'NL-DS-A')!.round = 'play_in';
  assert.equal(teamPick(b, p3, 'milwaukee-brewers', clubs()), 'pick-inconsistent');
  const p4 = predicted.mlb();
  p4.series.find((s) => s.seriesKey === 'AL-WC-B')!.round = 'play_in';
  assert.equal(teamPick(b, p4, 'boston-red-sox', clubs()), 'pick-inconsistent');
});

test('GUARD: a decided series whose score is not one a series ends on gets no line', () => {
  // The mapper accepts these; the line would state the score.
  const zero = bracketOf(today('mlb'));
  const wc = zero.series.find((s) => s.seriesKey === 'AL-WC-A')!;
  wc.wins = { higher: 0, lower: 0 };
  assert.equal(teamPick(zero, predicted.mlb(), 'chicago-white-sox', clubs()), 'pick-inconsistent');
  assert.equal(teamPick(zero, predicted.mlb(), 'houston-astros', clubs()), 'pick-inconsistent');
  const backwards = bracketOf(today('mlb'));
  backwards.series.find((s) => s.seriesKey === 'AL-WC-A')!.wins = { higher: 2, lower: 1 };
  assert.equal(teamPick(backwards, predicted.mlb(), 'chicago-white-sox', clubs()), 'pick-inconsistent');
  const short = bracketOf(today('mlb'));
  short.series.find((s) => s.seriesKey === 'AL-WC-B')!.wins = { higher: 1, lower: 0 };
  assert.equal(teamPick(short, predicted.mlb(), 'boston-red-sox', clubs()), 'pick-inconsistent');
});

test('GUARD: a real document whose rounds are out of order gets no line', () => {
  // The World Series moved ahead of the two Championship Series: the last
  // round would be the Championship Series, and the title pick would name it.
  const d = today('mlb');
  const all = d.series as Doc[];
  const ws = all.find((x) => x.seriesKey === 'WS')!;
  d.series = [...all.filter((x) => x !== ws && x.round !== 'championship_series'), ws, ...all.filter((x) => x.round === 'championship_series')];
  const b = bracketOf(d);
  assert.equal(teamPick(b, predicted.mlb(), 'milwaukee-brewers', clubs()), 'pick-inconsistent');
  assert.equal(teamPick(b, predicted.mlb(), 'los-angeles-dodgers', clubs()), 'pick-inconsistent');
  // The Championship Series ahead of the Division Series: the Brewers'
  // rounds no longer run in the locked document's order.
  const e = today('mlb');
  const es = e.series as Doc[];
  e.series = [...es.filter((x) => x.round === 'wild_card'), ...es.filter((x) => x.round === 'championship_series'), ...es.filter((x) => x.round === 'division_series'), ...es.filter((x) => x.round === 'world_series')];
  assert.equal(teamPick(bracketOf(e), predicted.mlb(), 'milwaukee-brewers', clubs()), 'pick-inconsistent');
});

test('GUARD: a last round that is not one series, the locked document\'s last, gets no line', () => {
  const b = bracketOf(today('mlb'));
  const ws = b.series.find((s) => s.seriesKey === 'WS')!;
  b.series.push({ ...ws, seriesKey: 'WS-2' });
  assert.equal(teamPick(b, predicted.mlb(), 'milwaukee-brewers', clubs()), 'pick-inconsistent');
  assert.equal(teamPick(b, predicted.mlb(), 'boston-red-sox', clubs()), 'pick-inconsistent');
});

test('GUARD: a title pick whose chain stops short of the final gets no line', () => {
  const b = bracketOf(today('mlb'));
  const p = predicted.mlb();
  // The Brewers taken out of the predicted final, still the champion field.
  const ws = p.series.find((s) => s.seriesKey === 'WS')!;
  ws.higher = { slug: 'los-angeles-dodgers', seed: 2 };
  ws.pick = 'los-angeles-dodgers';
  assert.equal(teamPick(b, p, 'milwaukee-brewers', clubs()), 'pick-inconsistent');
});

test('GUARD: a club listed in a later series after losing its exit series gets no line, not "beating"', () => {
  // The Yankees are picked to lose the Division Series to the Rays, lose it,
  // and are written into the Championship Series anyway.
  const d = today('mlb');
  decide(d, 'AL-DS-A', { winner: 'tampa-bay-rays' });
  const cs = (d.series as Doc[]).find((x) => x.seriesKey === 'AL-CS')!;
  cs.higher = { slug: 'tampa-bay-rays', seed: 1 };
  cs.lower = { slug: 'new-york-yankees', seed: 4 };
  assert.equal(teamPick(bracketOf(d), predicted.mlb(), 'new-york-yankees', clubs()), 'pick-inconsistent');
});

test('GUARD: an exit series the real bracket does not have gets no line', () => {
  const b = bracketOf(today('mlb'));
  const p = predicted.mlb();
  p.series.find((s) => s.seriesKey === 'AL-DS-A')!.seriesKey = 'AL-DS-Z';
  assert.equal(teamPick(b, p, 'new-york-yankees', clubs()), 'pick-inconsistent');
});

test('GUARD: a last series that is final with no winner, or with a slot that is not a club, gets no line', () => {
  const b = bracketOf(today('mlb'));
  b.series.find((s) => s.seriesKey === 'AL-WC-B')!.winnerSide = null;
  assert.equal(teamPick(b, predicted.mlb(), 'boston-red-sox', clubs()), 'pick-inconsistent');
  const c = bracketOf(today('mlb'));
  const wc = c.series.find((s) => s.seriesKey === 'AL-WC-B')!;
  wc.higher = { kind: 'placeholder', label: 'NYY', seed: 4, candidates: null };
  assert.equal(teamPick(c, predicted.mlb(), 'boston-red-sox', clubs()), 'pick-inconsistent');
});

test('GUARD: a club the line names with no team record gets no line', () => {
  const b = bracketOf(today('mlb'));
  const without = (slug: string) => new Map([...clubs()].filter(([k]) => k !== slug));
  assert.equal(teamPick(b, predicted.mlb(), 'boston-red-sox', without('boston-red-sox')), 'no-team-record');
  assert.equal(teamPick(b, predicted.mlb(), 'boston-red-sox', without('new-york-yankees')), 'no-team-record');
  assert.equal(teamPick(b, predicted.mlb(), 'houston-astros', without('chicago-white-sox')), 'no-team-record');
});

// ---- The copy ----

const ALL_LINES = (): TeamPickView[] => {
  const out: TeamPickView[] = TABLE.map(([club, league]) => line(today(league), league, club));
  const w = today('wnba');
  decide(w, 'SF-A', { winner: 'new-york-liberty' });
  out.push(line(w, 'wnba', 'atlanta-dream'));
  out.push(line(mlbWorldSeries('tampa-bay-rays', 'milwaukee-brewers'), 'mlb', 'milwaukee-brewers'));
  out.push(line(mlbWorldSeries('chicago-white-sox', 'chicago-white-sox'), 'mlb', 'chicago-white-sox'));
  out.push(line(mlbWorldSeries('tampa-bay-rays', 'tampa-bay-rays'), 'mlb', 'milwaukee-brewers'));
  return out;
};

test('COPY: the pick line names PromoNight, every status line is one of the ruled shapes', () => {
  const STATUS = [
    /^Pick still alive\.$/,
    /^The [A-Z][A-Za-z ]+ decides? this pick\.( The [A-Z][A-Za-z ]+ face the [A-Z][A-Za-z ]+, not the [A-Z][A-Za-z ]+ as picked\.)?$/,
    /^Pick busted: the [A-Z][A-Za-z ]+ lost the [A-Z][A-Za-z ]+ to the [A-Z][A-Za-z ]+ \d-\d\.$/,
    /^Pick correct: the [A-Z][A-Za-z ]+ (beat the [A-Z][A-Za-z ]+ \d-\d in|won) the [A-Z][A-Za-z ]+\.$/,
    /^Pick busted: the [A-Z][A-Za-z ]+ went (out earlier than picked, losing to|further than picked, beating) the [A-Z][A-Za-z ]+ \d-\d in the [A-Z][A-Za-z ]+\.$/,
    /^Pick busted: the [A-Z][A-Za-z ]+ went further than picked and won the [A-Z][A-Za-z ]+\.$/,
    /^Right round, different opponent: the [A-Z][A-Za-z ]+ lost to the [A-Z][A-Za-z ]+ \d-\d in the [A-Z][A-Za-z ]+\. PromoNight picked the [A-Z][A-Za-z ]+\.$/,
  ];
  for (const v of ALL_LINES()) {
    assert.match(v.pickLine, /^PromoNight's pick: [A-Z][A-Za-z ]+ to (win|lose) the [A-Z][A-Za-z ]+( to the [A-Z][A-Za-z ]+)?\.$/);
    assert.ok(STATUS.some((r) => r.test(v.statusLine)), v.statusLine);
  }
});

test('COPY: no dash, no "live", no "computer", no freshness words, nothing empty', () => {
  for (const v of ALL_LINES()) {
    const text = `${v.pickLine} ${v.statusLine}`;
    assert.ok(!/[\u2014\u2013]/.test(text), text);
    assert.ok(!/\blive\b/i.test(text), text);
    assert.ok(!/computer/i.test(text), text);
    assert.ok(!/\b(now|today|tonight|currently|latest|updated|this week|in progress|so far)\b/i.test(text), text);
    assert.ok(!/\b(undefined|null|NaN)\b/.test(text), text);
  }
});

test('COPY: the link goes to the league page\'s predictions, nowhere else', () => {
  for (const v of ALL_LINES()) assert.match(v.href, /^\/playoffs\/(mlb|wnba)#predictions$/);
});

test('NO ID LEAVES: the line carries no series key, slug or hash', () => {
  for (const v of ALL_LINES()) {
    const s = JSON.stringify(v);
    assert.ok(!/[A-Z]{2}-(WC|DS|CS)|R1-\dv\d|SF-[AB]|"WS"|"F"/.test(s), s);
    assert.ok(!/[a-z]+-[a-z]+-[a-z]+|[0-9a-f]{16}/.test(s.replace(/#predictions/g, '')), s);
    assert.deepEqual(Object.keys(v).sort(), ['href', 'kind', 'pickLine', 'statusLine']);
  }
});
