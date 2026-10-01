// The computer's bracket: the mapper, the NCAA scoring rule, the scorecard,
// and the methodology's dates and fingerprints. Every state is built from a
// stored document through the real mappers: the two locked predictedBrackets
// documents as stored, the live WNBA bracket with the Lynx out, the live MLB
// bracket mid Wild Card, and both brackets decided to the end (built from the
// live captures by helpers.decide; no 2026 bracket is finished yet).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mapBracketDoc } from '../map';
import {
  BACKTEST_2025,
  easternLongDate,
  frozenBeforeFirstGame,
  mapPredictedDoc,
  percent,
  recordText,
  scorePredictions,
  type PickSeriesView,
  type PredictionsView,
} from '../predictions';
import type { Bracket } from '../types';
import {
  FIXTURE,
  LYNX_OUT_AT,
  buildWithPredictions,
  decide,
  decidedMlb,
  decidedWnba,
  loadDoc,
  mapPredicted,
  rawText,
  seriesKeyIn,
  PREDICTED,
} from './helpers';

type Doc = Record<string, unknown>;
const DECIDED_AT = new Date('2026-11-05T12:00:00Z');

function bracketOf(doc: Doc): Bracket {
  const b = mapBracketDoc(doc, { league: doc.league as 'MLB' | 'WNBA', season: doc.season as number });
  assert.ok(b);
  return b;
}
function pickOf(v: PredictionsView, seriesId: string): PickSeriesView {
  for (const r of v.rounds) for (const g of r.groups) for (const s of g.series) if (s.seriesId === seriesId) return s;
  assert.fail(`no pick for ${seriesId}`);
}
const allPicks = (v: PredictionsView) => v.rounds.flatMap((r) => r.groups.flatMap((g) => g.series));
const state = (s: PickSeriesView) => ({ outcome: s.outcome, decided: s.decided, dimmed: s.dimmed });

// ---- The mapper ----

test('MAPPER: both locked documents map, with every series, the champion and the five fingerprints', () => {
  const w = mapPredicted(PREDICTED.wnba);
  assert.equal(w.series.length, 7);
  assert.equal(w.champion, 'golden-state-valkyries');
  assert.equal(w.simRuns, 10000);
  assert.equal(w.frozenAt, '2026-09-25T14:24:00.732Z');
  assert.equal(w.computedAt, '2026-09-30T21:17:30.014Z');
  assert.deepEqual(w.fingerprints, {
    corpus: 'e4bcaddb1f2acebf37ece2f2c8f32d136609bd93469a30c8e5da104a6bd17a8d',
    params: 'f953e58fabed3c981231b1b52761b9c22fcc3c1d4274abcac80749856ff61433',
    descriptor: '71c1700f4e5626ad049e3af83f4064efd6d2ee2255e3abceee59a16d723c6321',
    slugMap: 'b5d2e82a40cbebcca98ef745634e986c64235e851e84b46047b94ceddf1f3c26',
    reviewed: '9062bcca0613db2b716200c652fc416b08f786af6781d242fb17d62bf9f862fd',
  });
  const m = mapPredicted(PREDICTED.mlb);
  assert.equal(m.series.length, 11);
  assert.equal(m.champion, 'milwaukee-brewers');
  assert.equal(m.fingerprints.reviewed, 'f0af727db7948eacab36ece31471ded74fbcd59e78f15f4d6cdfdd3e079a79d0');
  assert.deepEqual(m.series.filter((s) => s.coinFlip).map((s) => s.seriesKey), ['AL-WC-A']);
});

test('MAPPER: a whitelist. Operator fields, paths, blobs, run ids and every other hash are dropped', () => {
  for (const name of [PREDICTED.wnba, PREDICTED.mlb]) {
    const out = JSON.stringify(mapPredicted(name));
    const stored = JSON.parse(rawText(name)) as Doc;
    const prov = stored.provenance as Doc;
    const banned = [
      prov.seedFileAuthoredBy,
      prov.seedFileSourceUrl,
      prov.seedFileSha256,
      prov.canonicalDescriptorSha256,
      prov.frozenBy,
      prov.engineCommitAtFreeze,
      prov.engineCommitAtCompute,
      stored.computedBy,
      stored.engineCommitAtExecute,
      ...(prov.coreFiles as Doc[]).flatMap((f) => [f.path, f.blobAtFreeze]),
      ...(prov.engineFiles as Doc[]).flatMap((f) => [f.path, f.blobAtCompute]),
    ];
    for (const b of banned) assert.ok(typeof b === 'string' && !out.includes(b), `${name}: ${String(b)} leaked`);
    for (const k of ['acks', 'computedBy', 'frozenBy', 'seedFile', 'slot', 'runsSupporting', 'rating', 'degeneracy', 'info', 'node']) {
      assert.ok(!out.includes(`"${k}`), `${name}: field ${k} leaked`);
    }
  }
});

function refuses(name: string, edit: (d: Doc) => void, why: string) {
  const d = loadDoc(name);
  edit(d);
  assert.equal(mapPredictedDoc(d, { league: d.league as 'MLB' | 'WNBA', season: 2026 }), null, why);
}
const rounds = (d: Doc) => d.rounds as Doc[];
const prov = (d: Doc) => d.provenance as Doc;

test('MAPPER: refuses what the page cannot state as fact', () => {
  const W = PREDICTED.wnba;
  assert.equal(mapPredictedDoc(loadDoc(W), { league: 'MLB', season: 2026 }), null, 'another league');
  assert.equal(mapPredictedDoc(loadDoc(W), { league: 'WNBA', season: 2027 }), null, 'another season');
  refuses(W, (d) => (d.target = 'scratch'), 'not a lock');
  refuses(W, (d) => delete d.lockedAt, 'never locked');
  refuses(W, (d) => ((prov(d).coreFiles as Doc[])[1].identical = false), 'core file changed: the page says the code did not');
  refuses(W, (d) => ((prov(d).coreFiles as Doc[])[0].blobAtCompute = '0'.repeat(40)), 'core blobs differ');
  refuses(W, (d) => (prov(d).coreFiles = []), 'no core files to check');
  refuses(W, (d) => delete prov(d).engineCommitAtFreeze, 'no freeze commit');
  refuses(W, (d) => (prov(d).corpusSha256 = 'E4BC'), 'a fingerprint that is not a sha256');
  refuses(W, (d) => delete d.reviewedSha256, 'no reviewed sha256');
  refuses(W, (d) => (prov(d).frozenAt = '2026-10-01T00:00:00Z'), 'frozen after it was computed');
  refuses(W, (d) => (prov(d).frozenAt = '2026-09-25'), 'a bare date is not an instant');
  refuses(W, (d) => (rounds(d)[0].pick = 'dallas-wings'), 'a pick outside its matchup');
  refuses(W, (d) => (rounds(d)[0].pickProbability = 0.49), 'a pick the simulations favoured less');
  refuses(W, (d) => (rounds(d)[0].pickProbability = 1), 'a certain pick');
  refuses(W, (d) => (rounds(d)[0].modalSeriesLength = 1), 'a length no series of three can end in');
  refuses(W, (d) => (rounds(d)[6].modalSeriesLength = 8), 'longer than the series');
  refuses(W, (d) => delete rounds(d)[0].coinFlip, 'coin flip unstated');
  refuses(W, (d) => (rounds(d)[1].seriesKey = 'R1-1v8'), 'a key twice');
  refuses(W, (d) => (rounds(d)[0].higher = rounds(d)[0].lower), 'a club against itself');
  refuses(W, (d) => (d.champion = 'minnesota-lynx'), 'a champion that is not the last pick');
  refuses(W, (d) => ((d.titleOdds as Doc[])[0].odds = 1.2), 'odds above one');
  refuses(W, (d) => (d.simRuns = 0), 'no simulations');
});

// ---- Scoring: the live WNBA bracket with the Lynx out ----

test('SCORING, WNBA with the Lynx out: decided-busted, busted early, dimmed-but-alive, and plain alive', () => {
  const { predictions } = buildWithPredictions(FIXTURE.wnbaLynxOut, PREDICTED.wnba, LYNX_OUT_AT);
  const v = predictions.view;
  // R1-1v8: the Lynx were the pick and lost to the Liberty. Decided, busted.
  assert.deepEqual(state(pickOf(v, 'first_round-1')), { outcome: 'busted', decided: true, dimmed: false });
  assert.equal(pickOf(v, 'first_round-1').resultLine, 'New York Liberty won 2-0');
  // The other three first-round picks: still being played.
  for (const id of ['first_round-2', 'first_round-3', 'first_round-4']) assert.deepEqual(state(pickOf(v, id)), { outcome: 'alive', decided: false, dimmed: false }, id);
  // SF-A: Lynx over Dream. The Lynx were eliminated earlier: busted now,
  // NOT counted (its own slot is not decided), and the matchup is dimmed.
  const sfa = pickOf(v, 'semifinals-1');
  assert.deepEqual(state(sfa), { outcome: 'busted', decided: false, dimmed: true });
  assert.equal(sfa.note, 'Minnesota Lynx are out.');
  // SF-B: Valkyries over Aces. Both alive, matchup still possible.
  assert.deepEqual(state(pickOf(v, 'semifinals-2')), { outcome: 'alive', decided: false, dimmed: false });
  // Finals: Valkyries over the Lynx. The matchup cannot happen, but the
  // pick (the Valkyries) is alive, and it counts toward "still alive".
  const f = pickOf(v, 'finals-1');
  assert.deepEqual(state(f), { outcome: 'alive', decided: false, dimmed: true });
  assert.equal(f.note, 'This matchup can no longer happen.');
  // Scorecard: one decided slot, missed. Five picks alive.
  const sc = v.scorecard;
  assert.deepEqual([sc.correct, sc.decided, sc.alive], [0, 1, 5]);
  assert.equal(sc.recordLine, 'The computer is 0 for 1');
  assert.equal(sc.aliveLine, '5 picks still alive');
  assert.equal(sc.championLine, 'Golden State Valkyries, still alive');
  assert.equal(predictions.hub.record, '0 for 1');
  assert.equal(predictions.hub.href, '/playoffs/wnba#predictions');
});

// ---- Scoring: MLB mid Wild Card ----

test('SCORING, MLB mid Wild Card: nothing decided, every pick alive, nothing dimmed, the coin flip shown as one', () => {
  const { predictions } = buildWithPredictions(FIXTURE.mlbWildCard, PREDICTED.mlb, LYNX_OUT_AT);
  const v = predictions.view;
  assert.equal(allPicks(v).length, 11);
  for (const s of allPicks(v)) assert.deepEqual(state(s), { outcome: 'alive', decided: false, dimmed: false }, s.seriesId);
  assert.deepEqual([v.scorecard.correct, v.scorecard.decided, v.scorecard.alive], [0, 0, 11]);
  assert.equal(v.scorecard.recordLine, 'No series decided yet');
  assert.equal(predictions.hub.record, 'no series decided yet');
  const flip = pickOf(v, 'wild_card-1');
  assert.equal(flip.coinFlip, true);
  assert.equal(flip.chanceLabel, 'Coin flip');
  assert.equal(flip.pickName, 'Houston Astros');
  assert.equal(flip.lengthLabel, 'in 2');
  assert.equal(pickOf(v, 'wild_card-2').chanceLabel, '58%');
  assert.equal(pickOf(v, 'world_series-1').chanceLabel, '65%');
  assert.equal(pickOf(v, 'world_series-1').lengthLabel, 'in 6');
});

test('SCORING, MLB: the coin flip counts like any other pick, either way it goes', () => {
  const lost = loadDoc(FIXTURE.mlbWildCard);
  decide(lost, 'AL-WC-A', { winner: 'chicago-white-sox' });
  const a = buildWithPredictions(lost, PREDICTED.mlb, LYNX_OUT_AT).predictions.view;
  assert.deepEqual(state(pickOf(a, 'wild_card-1')), { outcome: 'busted', decided: true, dimmed: false });
  assert.equal(a.scorecard.recordLine, 'The computer is 0 for 1');
  // AL-DS-B was picked Guardians over Astros. The Astros are out, so the
  // matchup is dimmed; the Guardians pick is alive and counts as alive.
  assert.deepEqual(state(pickOf(a, 'division_series-2')), { outcome: 'alive', decided: false, dimmed: true });
  assert.equal(a.scorecard.alive, 10);

  const won = loadDoc(FIXTURE.mlbWildCard);
  decide(won, 'AL-WC-A', { winner: 'houston-astros' });
  const b = buildWithPredictions(won, PREDICTED.mlb, LYNX_OUT_AT).predictions.view;
  assert.deepEqual(state(pickOf(b, 'wild_card-1')), { outcome: 'correct', decided: true, dimmed: false });
  assert.equal(b.scorecard.recordLine, 'The computer is 1 for 1');
  assert.deepEqual(state(pickOf(b, 'division_series-2')), { outcome: 'alive', decided: false, dimmed: false });
});

test('SCORING: a real slot filled by a club outside the predicted pair dims the matchup on its own', () => {
  // The White Sox are written straight into the AL-DS-B lower slot while the
  // Wild Card series is still live: nobody is eliminated, and the predicted
  // Guardians-Astros matchup is still dimmed, because the slot says so.
  const d = loadDoc(FIXTURE.mlbWildCard);
  const ds = (d.series as Doc[]).find((s) => s.seriesKey === 'AL-DS-B') as Doc;
  ds.lower = { slug: 'chicago-white-sox', seed: 6 };
  const b = bracketOf(d);
  assert.equal(b.series.filter((s) => s.status === 'final').length, 0);
  const scored = scorePredictions(b, mapPredicted(PREDICTED.mlb));
  assert.ok(scored);
  const one = scored.find((s) => s.predicted.seriesKey === 'AL-DS-B');
  assert.ok(one);
  assert.deepEqual([one.outcome, one.decided, one.dimmed], ['alive', false, true]);
  // And the matchups around it are untouched.
  assert.ok(scored.filter((s) => s.predicted.seriesKey !== 'AL-DS-B').every((s) => !s.dimmed));
});

// ---- Scoring: fully decided ----

test('SCORING, WNBA fully decided: final scorecard, a correct pick in a matchup that did not happen, champion won', () => {
  const { view: real, predictions } = buildWithPredictions(decidedWnba(), PREDICTED.wnba, DECIDED_AT);
  assert.equal(real.phase.kind, 'concluded');
  const v = predictions.view;
  const states = Object.fromEntries(allPicks(v).map((s) => [s.seriesId, state(s)]));
  assert.deepEqual(states, {
    'first_round-1': { outcome: 'busted', decided: true, dimmed: false },
    'first_round-2': { outcome: 'correct', decided: true, dimmed: false },
    'first_round-3': { outcome: 'busted', decided: true, dimmed: false },
    'first_round-4': { outcome: 'correct', decided: true, dimmed: false },
    // Lynx over Dream: Dream beat the Liberty in that slot.
    'semifinals-1': { outcome: 'busted', decided: true, dimmed: true },
    // Valkyries over Aces: the Valkyries won the slot against the Fever.
    'semifinals-2': { outcome: 'correct', decided: true, dimmed: true },
    // Valkyries over the Lynx: the Valkyries won it against the Dream.
    'finals-1': { outcome: 'correct', decided: true, dimmed: true },
  });
  assert.equal(pickOf(v, 'finals-1').note, 'This matchup did not happen.');
  assert.equal(pickOf(v, 'finals-1').resultLine, 'Golden State Valkyries won 4-3');
  assert.deepEqual([v.scorecard.correct, v.scorecard.decided, v.scorecard.alive], [4, 7, 0]);
  assert.equal(v.scorecard.recordLine, 'The computer is 4 for 7');
  assert.equal(v.scorecard.aliveLine, '0 picks still alive');
  assert.equal(v.scorecard.championLine, 'Golden State Valkyries, won the title');
  assert.equal(predictions.hub.record, '4 for 7');
});

test('SCORING, MLB fully decided: busted early then counted when its slot is decided; champion out', () => {
  const { view: real, predictions } = buildWithPredictions(decidedMlb(), PREDICTED.mlb, DECIDED_AT);
  assert.equal(real.phase.kind, 'concluded');
  const v = predictions.view;
  const outcomes = Object.fromEntries(allPicks(v).map((s) => [s.seriesId, `${s.outcome}${s.dimmed ? ' dimmed' : ''}`]));
  assert.deepEqual(outcomes, {
    'wild_card-1': 'busted',
    'wild_card-2': 'correct',
    'wild_card-3': 'busted',
    'wild_card-4': 'correct',
    'division_series-1': 'busted',
    'division_series-2': 'correct dimmed',
    'division_series-3': 'correct',
    'division_series-4': 'correct dimmed',
    'championship_series-1': 'busted dimmed',
    'championship_series-2': 'busted',
    'world_series-1': 'busted dimmed',
  });
  assert.deepEqual([v.scorecard.correct, v.scorecard.decided, v.scorecard.alive], [5, 11, 0]);
  assert.equal(v.scorecard.championLine, 'Milwaukee Brewers, eliminated');
});

test('SCORING: the Rays pick for the AL pennant is busted when the Rays go out, and counts only when the ALCS ends', () => {
  const d = loadDoc(FIXTURE.mlbWildCard);
  decide(d, 'AL-WC-B', { winner: 'new-york-yankees' });
  decide(d, 'AL-DS-A', { winner: 'new-york-yankees' });
  const before = buildWithPredictions(d, PREDICTED.mlb, LYNX_OUT_AT).predictions.view;
  assert.deepEqual(state(pickOf(before, 'championship_series-1')), { outcome: 'busted', decided: false, dimmed: true });
  assert.equal(before.scorecard.decided, 2, 'the busted ALCS pick is not counted yet');
  decide(d, 'AL-CS', { winner: 'new-york-yankees', higher: ['cleveland-guardians', 2], lower: ['new-york-yankees', 4] });
  const after = buildWithPredictions(d, PREDICTED.mlb, LYNX_OUT_AT).predictions.view;
  assert.deepEqual(state(pickOf(after, 'championship_series-1')), { outcome: 'busted', decided: true, dimmed: true });
  assert.equal(after.scorecard.decided, 3);
});

test('SCORECARD ARITHMETIC: in every state, correct <= decided, and decided + alive + busted-early = every series', () => {
  const states: [string, Doc | string, string, Date][] = [
    ['wnba lynx out', FIXTURE.wnbaLynxOut, PREDICTED.wnba, LYNX_OUT_AT],
    ['wnba decided', decidedWnba(), PREDICTED.wnba, DECIDED_AT],
    ['mlb wild card', FIXTURE.mlbWildCard, PREDICTED.mlb, LYNX_OUT_AT],
    ['mlb decided', decidedMlb(), PREDICTED.mlb, DECIDED_AT],
  ];
  for (const [name, b, p, now] of states) {
    const v = buildWithPredictions(b, p, now).predictions.view;
    const picks = allPicks(v);
    const sc = v.scorecard;
    assert.equal(sc.decided, picks.filter((s) => s.decided).length, name);
    assert.equal(sc.correct, picks.filter((s) => s.decided && s.outcome === 'correct').length, name);
    assert.equal(sc.alive, picks.filter((s) => s.outcome === 'alive').length, name);
    assert.ok(sc.correct <= sc.decided, name);
    const bustedEarly = picks.filter((s) => !s.decided && s.outcome === 'busted').length;
    assert.equal(sc.decided + sc.alive + bustedEarly, picks.length, name);
    // A decided pick is never "alive"; an undecided one is never "correct".
    assert.ok(picks.every((s) => (s.decided ? s.outcome !== 'alive' : s.outcome !== 'correct')), name);
  }
});

test('JOIN: the two documents must describe the same bracket', () => {
  const b = bracketOf(loadDoc(FIXTURE.wnbaLynxOut));
  const p = mapPredicted(PREDICTED.wnba);
  assert.ok(scorePredictions(b, p));
  assert.equal(scorePredictions(b, { ...p, series: p.series.slice(1) }), null, 'a real series with no pick');
  assert.equal(scorePredictions(b, { ...p, series: p.series.map((s, i) => (i === 0 ? { ...s, seriesKey: 'R1-9v9' } : s)) }), null, 'a key the bracket lacks');
  assert.equal(scorePredictions(b, { ...p, series: p.series.map((s, i) => (i === 0 ? { ...s, round: 'semifinals' } : s)) }), null, 'a round that disagrees');
  assert.equal(scorePredictions(b, { ...p, league: 'MLB' }), null, 'another league');
  assert.equal(scorePredictions(bracketOf(loadDoc(FIXTURE.mlbWildCard)), p), null);
});

// ---- What reaches the client ----

test('CLIENT VIEW: no series key, no fingerprint, no hash of any kind, in any state', () => {
  const hex64 = /\b[0-9a-f]{64}\b/;
  const cases: [Doc | string, string, Date][] = [
    [FIXTURE.wnbaLynxOut, PREDICTED.wnba, LYNX_OUT_AT],
    [decidedWnba(), PREDICTED.wnba, DECIDED_AT],
    [FIXTURE.mlbWildCard, PREDICTED.mlb, LYNX_OUT_AT],
    [decidedMlb(), PREDICTED.mlb, DECIDED_AT],
  ];
  for (const [b, p, now] of cases) {
    const { predictions } = buildWithPredictions(b, p, now);
    for (const part of [predictions.view, predictions.hub]) {
      const json = JSON.stringify(part);
      assert.equal(seriesKeyIn(json), null, json.slice(0, 80));
      assert.ok(!/"(WS|F)"/.test(json), 'a short key, by name');
      assert.ok(!hex64.test(json), 'a hash');
      assert.ok(!/seriesKey|slot"|Sha256|fingerprint/i.test(json));
    }
  }
});

// ---- Methodology ----

test('METHODOLOGY: dates are the Eastern days of the stored instants; MLB was frozen on September 28 Eastern', () => {
  assert.equal(easternLongDate('2026-09-29T01:05:52.350Z'), 'September 28, 2026');
  const m = buildWithPredictions(FIXTURE.mlbWildCard, PREDICTED.mlb, LYNX_OUT_AT).predictions.methodology;
  assert.equal(m.lockedOn, 'September 28, 2026');
  assert.equal(m.computedOn, 'September 30, 2026');
  assert.equal(m.simRuns, '10,000');
  assert.equal(m.lockedBeforeGame1, true);
  const w = buildWithPredictions(FIXTURE.wnbaLynxOut, PREDICTED.wnba, LYNX_OUT_AT).predictions.methodology;
  assert.equal(w.lockedOn, 'September 25, 2026');
  assert.equal(w.computedOn, 'September 30, 2026');
  assert.equal(w.lockedBeforeGame1, true);
});

test('METHODOLOGY: "before Game 1" is proven from the real bracket, never assumed', () => {
  const b = bracketOf(loadDoc(FIXTURE.mlbWildCard));
  assert.equal(frozenBeforeFirstGame(b, '2026-09-29T01:05:52.350Z'), true);
  // The first pitch was 2026-09-29T18:00Z.
  assert.equal(frozenBeforeFirstGame(b, '2026-09-29T18:00:00.000Z'), false, 'frozen at the first pitch is not before it');
  assert.equal(frozenBeforeFirstGame(b, '2026-09-30T21:17:31.195Z'), false, 'the bracket was computed after Game 1');
  // A date-only game on the freeze's own Eastern day proves nothing.
  const sameDay: Bracket = { ...b, series: b.series.map((s) => ({ ...s, games: s.games.map((g) => ({ ...g, start: null, date: '2026-09-28' })) })) };
  assert.equal(frozenBeforeFirstGame(sameDay, '2026-09-29T01:05:52.350Z'), false);
  const none: Bracket = { ...b, series: b.series.map((s) => ({ ...s, games: [] })) };
  assert.equal(frozenBeforeFirstGame(none, '2026-09-29T01:05:52.350Z'), false, 'no dated game proves nothing');
});

test('METHODOLOGY: the backtest is the only accuracy claim, and the fingerprints are exactly the four inputs and the reviewed sha256', () => {
  assert.deepEqual(BACKTEST_2025, { WNBA: { right: 5, of: 7, champion: true }, MLB: { right: 5, of: 11, champion: false } });
  const w = buildWithPredictions(FIXTURE.wnbaLynxOut, PREDICTED.wnba, LYNX_OUT_AT).predictions.methodology;
  assert.equal(w.backtest, 'Run on the 2025 WNBA postseason with the same settings, the computer called 5 of 7 series and got the champion right.');
  const m = buildWithPredictions(FIXTURE.mlbWildCard, PREDICTED.mlb, LYNX_OUT_AT).predictions.methodology;
  assert.equal(m.backtest, 'Run on the 2025 MLB postseason with the same settings, the computer called 5 of 11 series and got the champion wrong.');
  const stored = JSON.parse(rawText(PREDICTED.mlb)) as Doc;
  const p = stored.provenance as Doc;
  assert.deepEqual(
    m.fingerprints.map((f) => f.value),
    [p.corpusSha256, p.paramsSha256, p.descriptorSha256, p.slugMapSha256, stored.reviewedSha256],
  );
  assert.deepEqual(
    m.fingerprints.map((f) => f.label),
    ['Regular-season results', 'Model settings', 'Bracket format', 'Team identifiers', 'Published bracket'],
  );
});

test('LABELS: percent and record', () => {
  assert.equal(percent(0.7774), '78%');
  assert.equal(percent(0.5001), '50%');
  assert.equal(percent(0.0098), '1%');
  assert.equal(percent(0.004), 'Under 1%');
  assert.equal(recordText(0, 0), 'no series decided yet');
  assert.equal(recordText(3, 4), '3 for 4');
});

test('TITLE ODDS: the top eight, highest first, as "at lock" percentages', () => {
  const v = buildWithPredictions(FIXTURE.mlbWildCard, PREDICTED.mlb, LYNX_OUT_AT).predictions.view;
  assert.equal(v.titleOdds.length, 8);
  assert.deepEqual(v.titleOdds.slice(0, 3), [
    { name: 'Milwaukee Brewers', oddsLabel: '28%' },
    { name: 'Los Angeles Dodgers', oddsLabel: '19%' },
    { name: 'Tampa Bay Rays', oddsLabel: '15%' },
  ]);
  const w = buildWithPredictions(FIXTURE.wnbaLynxOut, PREDICTED.wnba, LYNX_OUT_AT).predictions.view;
  assert.equal(w.titleOdds.length, 8);
  assert.equal(w.titleOdds[0].name, 'Golden State Valkyries');
  assert.equal(w.titleOdds[0].oddsLabel, '37%');
});
