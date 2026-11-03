// The mutation harness for the MLS guards (2026-11-03). A guard counts only
// if removing it fails a test: each case edits one guard out of the source,
// runs the tests meant to catch it, and expects a failure.
//
// IT NEVER TOUCHES THIS TREE. Sources, scripts and configs are copied to a
// temporary directory (node_modules linked) and every mutation is made there.
//
//   node scripts/playoffs/mls-mutations.mjs
//
// Not part of `npm test` (it is slow).
import { readFileSync, writeFileSync, mkdtempSync, cpSync, symlinkSync, rmSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';

const REPO = resolve(new URL('../..', import.meta.url).pathname);
const WORK = mkdtempSync(join(tmpdir(), 'pn-mls-mutations-'));
for (const f of ['src', 'scripts', 'tsconfig.json', 'tsconfig.test.json', 'package.json']) cpSync(join(REPO, f), join(WORK, f), { recursive: true });
symlinkSync(join(REPO, 'node_modules'), join(WORK, 'node_modules'));
process.on('exit', () => rmSync(WORK, { recursive: true, force: true }));

const V = 'src/lib/postseason/view.ts';
const M = 'src/lib/postseason/map.ts';
const G = 'src/lib/postseason/gate.ts';
const D = 'src/lib/postseason/data.ts';
const S = 'src/lib/postseason/standing.ts';
const I = 'src/lib/postseason/inbound.ts';
const MD = 'src/lib/postseason/metadata.ts';
const N = 'src/lib/team-display-name.ts';
const T_MLS = 'src/lib/postseason/__tests__/mls.test.ts';
const T_DATA = 'src/lib/postseason/__tests__/mls-data.test.ts';
const T_RENDER = 'src/components/playoffs/__tests__/mls-render.test.tsx';
const ALL = [T_MLS, T_DATA, T_RENDER];

/** [name, file, from, to, tests]. `from` must occur exactly once. */
const CASES = [
  ['live MLS game shown live', V, "const status: GameStatus = mls && g.status === 'live' ? 'scheduled' : g.status;", 'const status: GameStatus = g.status;', [T_MLS, T_RENDER]],
  ['MLS series status left live with nothing final', V, '    status: mls ? mlsSeriesStatus(s) : s.status,', '    status: s.status,', [T_MLS, T_RENDER]],
  ['"Game 1" on a one-game round', V, "title: s.bestOf === 1 && mls ? '' : `Game ${g.gameNumber}`,", 'title: `Game ${g.gameNumber}`,', ALL],
  ['"Best of 1" on a one-game round', V, "formatLabel: single ? 'Single game' :", 'formatLabel: false ? \'Single game\' :', [T_MLS, T_RENDER]],
  ['level score ordered by score, not winnerSide', V, 'const homeFirst = g.winnerSide !== null ? g.winnerSide === g.homeSide : g.homeScore >= g.awayScore;', 'const homeFirst = g.homeScore >= g.awayScore;', [T_MLS]],
  ['penalties left off a game line', V, "      result += `, ${winnerName} won ${ws}-${ls} on penalties`;", '', [T_MLS, T_RENDER]],
  ['extra time left off a game line', V, "if (mls && g.decidedBy === 'extra_time') result += ' after extra time';", '', [T_MLS]],
  ['shootout phrase drops the draw', V, 'return `${ws}-${ls} on penalties after a ${w}-${l} draw`;', 'return `${ws}-${ls}`;', ALL],
  ['MLS card shows the stored nickname', V, 'label: mls ? teamShortName(club) : club.name,', 'label: club.name,', ALL],
  ['MLS full name city + nickname', V, 'fullName: mls ? teamDisplayName(club) : `${club.city} ${club.name}`,', 'fullName: `${club.city} ${club.name}`,', [T_MLS]],
  ['Round One "leads 1-0" without "the series"', V, "${mlsVerb(l.teamId, 'lead', 'leads')} the series ${Math.max(hi, lo)}", "${mlsVerb(l.teamId, 'lead', 'leads')} ${Math.max(hi, lo)}", [T_MLS]],
  ['plural verb ignored', V, "return teamId && MLS_SHORT_NAMES[teamId]?.plural ? plural : singular;", 'return singular;', [T_MLS]],
  ['MLS Cup summary in wins', V, '    if (decider!.single) {', '    if (false) {', [T_MLS]],
  ['mapper: level regulation score accepted', M, '  if (!absent(hs) || !absent(as) || level) return null;', '  if (!absent(hs) || !absent(as)) return null;', [T_MLS]],
  ['mapper: shootout winner unchecked', M, '      if (shootoutWinner !== game.winnerSide) return null;', '', [T_MLS]],
  ['mapper: decidedBy on an unplayed game accepted', M, '    if (!absent(by) || !absent(hs) || !absent(as)) return null;\n    return game;', '    return game;', [T_MLS]],
  ['mapper: final with no decidedBy accepted', M, "  if (typeof by !== 'string' || !DECIDED_BY.includes(by as DecidedBy)) return null;", "  if (typeof by !== 'string') return game;", [T_MLS]],
  ['mapper: MLS key shape unknown', M, ', /^[A-Z]+-R\\d+-\\d+$/]', ']', [T_RENDER, T_MLS]],
  ['gate: inbound back to one global window', G, "    if (b.series.some((s) => s.status !== 'final')) return true;\n    const end = closesAt.get(b);\n    return end !== undefined && now.getTime() <= end;", "    return playoffsLinkState(brackets, now).state !== 'hidden';", [T_MLS, T_DATA]],
  ['gate: every finished league its own cohort', G, '    if (cohort.length > 0 && x.at - cohort[cohort.length - 1].at > window) close();', '    if (cohort.length > 0) close();', [T_MLS]],
  ['gate: a cohort closes at its first final, not its latest', G, '    const end = cohort[cohort.length - 1].at + window;', '    const end = cohort[0].at + window;', [T_MLS]],
  ['mapper: a blank final refused (hides the whole bracket)', M, '    return { ...game, decidedBy };\n  }\n  const level', '    return null;\n  }\n  const level', [T_MLS]],
  ['mapper: a blank penalties final accepted', M, "    if (decidedBy === 'penalties' || !absent(hs) || !absent(as)) return null;", '    if (!absent(hs) || !absent(as)) return null;', [T_MLS]],
  ['mapper: one score without the other accepted', M, '    if (game.homeScore !== game.awayScore) return null;\n', '', [T_MLS]],
  ['view: a blank final shows no winner', V, "    result = `${w.abbreviation ?? w.label} won${g.decidedBy === 'extra_time' ? ' after extra time' : ''}`;", '    result = null;', [T_MLS]],
  ['view: "live" token for an MLS series under way', V, "  return s.wins.higher + s.wins.lower > 0 || s.games.some((g) => g.status === 'final') ? 'underway' : 'upcoming';", "  return s.wins.higher + s.wins.lower > 0 || s.games.some((g) => g.status === 'final') ? 'live' : 'upcoming';", [T_MLS, T_RENDER]],
  ['mapper: an MLS slot with no club keeps its seed', M, "label: label === 'TBD' ? UNDECIDED_LABEL : safeLabel(label, keys), seed: null,", "label: label === 'TBD' ? UNDECIDED_LABEL : safeLabel(label, keys), seed: slot.seed,", [T_MLS]],
  ['mapper: "TBD" shown on an MLS slot', M, "label: label === 'TBD' ? UNDECIDED_LABEL : safeLabel(label, keys), seed: null,", 'label: safeLabel(label, keys), seed: null,', [T_MLS, T_RENDER]],
  ['view: no "Wild Card winner" for a slot with no candidates', V, "  if (league === 'MLS' && slot.feederRoundLabel && (slot.label === 'TBD' || slot.label === UNDECIDED_LABEL)) return `${slot.feederRoundLabel} winner`;\n", '', [T_MLS]],
  ['data: MLS reads predictions', D, '  if (!PREDICTIONS_LEAGUES.has(league)) return null;\n  let reason: PredictionsUnavailableReason;', '  let reason: PredictionsUnavailableReason;', [T_DATA]],
  ['data: MLS team line reads predictions', D, '  if (!PREDICTIONS_LEAGUES.has(l.league)) return null;', '', [T_DATA]],
  ['data: MLS reads promotions', D, 'opts.withPromos && POSTSEASON_PROMO_LEAGUES.has(bracket.league)', 'opts.withPromos', [T_DATA]],
  ['standing: "the" before MLS names', S, "mls: { mls: true, the: (c) => c.label,", 'mls: { mls: true, the: (c) => `the ${c.label}`,', [T_MLS]],
  // No case for the MLS rule in standing's `started`: the view already shows
  // an MLS series with nothing final as upcoming, so dropping that rule is an
  // equivalent mutant (it changes no output). The view's rule has its case.
  ['standing: MLS Cup champion line in wins', S, "const score = s.single ? s.matchScore : `${w.wins}-${l.wins}`;", 'const score = `${w.wins}-${l.wins}`;', [T_MLS]],
  ['inbound: MLS lost line "Lost the Round One"', I, "    if (l.league === 'MLS') {", '    if (false) {', [T_MLS, T_RENDER]],
  ['inbound: "See the series" on a one-game round', I, '      if (s.single) alive.single = true;', '', [T_MLS, T_RENDER]],
  ['card: win count on a one-game round', 'src/components/playoffs/SeriesCard.tsx', '<Slot slot={series.higher} showWins={started && !series.single} />', '<Slot slot={series.higher} showWins={started} />', [T_RENDER]],
  ['panel: "G1" on a one-game round', 'src/components/playoffs/SeriesPanel.tsx', '{g.title ? <>G{g.gameNumber}</> : null}', '<>G{g.gameNumber}</>', [T_RENDER]],
  ['metadata: MLS description says "series"', MD, '  if (league === \'MLS\') return { title, canonical, description: mlsDescription(season, view) };', '', [T_MLS]],
  ['metadata: three-league hub over 160', MD, '    if (full.length <= DESCRIPTION_MAX) return { title, canonical, description: full };', '    return { title, canonical, description: full };', [T_MLS]],
  ['metadata: hub names MLS before its document', MD, '  const title = `${season} Playoffs: ${list(withBracket.length > 0 ? withBracket : routeLeagues)} Brackets`;', '  const title = `${season} Playoffs: ${list(routeLeagues)} Brackets`;', [T_MLS]],
  ['names: one club missing from the map', N, "  'vancouver-whitecaps': { name: 'Vancouver Whitecaps', plural: true },\n", '', [T_MLS]],
  ['names: an article in a short name', N, "  'la-galaxy': { name: 'LA Galaxy', plural: false },", "  'la-galaxy': { name: 'the LA Galaxy', plural: false },", [T_MLS]],
];

const run = (files) =>
  spawnSync('node', ['--import', 'tsx', '--experimental-test-module-mocks', '--test', ...files], {
    cwd: WORK,
    env: { ...process.env, TSX_TSCONFIG_PATH: 'tsconfig.test.json' },
    encoding: 'utf-8',
    timeout: 120000,
  });

const base = run(ALL);
if (base.status !== 0) {
  console.error('the tests fail before any mutation; fix that first');
  console.error(base.stdout.slice(-2000));
  process.exit(2);
}

let caught = 0;
const missed = [];
for (const [name, rel, from, to, tests] of CASES) {
  const file = join(WORK, rel);
  const src = readFileSync(file, 'utf-8');
  const n = src.split(from).length - 1;
  if (n !== 1) {
    console.log(`STALE   ${name}: the guard text occurs ${n} times in ${rel}; update the case`);
    missed.push(name);
    continue;
  }
  writeFileSync(file, src.replace(from, to));
  try {
    const r = run(tests);
    if (r.status !== 0) {
      caught++;
      console.log(`CAUGHT  ${name}${r.error ? ' (by a hang, cut at two minutes)' : ''}`);
    } else {
      missed.push(name);
      console.log(`MISSED  ${name}`);
    }
  } finally {
    writeFileSync(file, src);
  }
}
console.log(`\n${caught} of ${CASES.length} mutations caught`);
process.exit(missed.length ? 1 : 0);
