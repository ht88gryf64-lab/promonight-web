// The mutation harness for the team-page PromoNight Predicts line, the hub
// hero line, the final-bracket card and the playoffs back link. A guard
// counts only if removing it fails a test: each case below edits one guard
// out of the source, runs the tests meant to catch it, and expects a failure.
//
// IT NEVER TOUCHES THIS TREE. Sources, scripts and configs are copied to a
// temporary directory (node_modules linked) and every mutation is made there.
//
//   node scripts/playoffs/team-picks-mutations.mjs
//
// Not part of `npm test` (it is slow). Same runner as predictions-mutations.mjs.
import { readFileSync, writeFileSync, mkdtempSync, cpSync, symlinkSync, rmSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';

const REPO = resolve(new URL('../..', import.meta.url).pathname);
const WORK = mkdtempSync(join(tmpdir(), 'pn-teampick-mutations-'));
for (const f of ['src', 'scripts', 'tsconfig.json', 'tsconfig.test.json', 'package.json']) cpSync(join(REPO, f), join(WORK, f), { recursive: true });
symlinkSync(join(REPO, 'node_modules'), join(WORK, 'node_modules'));
process.on('exit', () => rmSync(WORK, { recursive: true, force: true }));

const TP = 'src/lib/postseason/team-pick.ts';
const D = 'src/lib/postseason/data.ts';
const I = 'src/lib/postseason/inbound.ts';
const M = 'src/components/playoffs/inbound/TeamPlayoffsModule.tsx';
const H = 'src/components/hub/HubHero.tsx';
const PL = 'src/components/playoffs/PlayoffsLeague.tsx';
const MLB = 'src/app/mlb/page.tsx';
const WNBA = 'src/app/wnba/page.tsx';
const ROUTE = 'src/app/[sport]/[team]/page.tsx';
const T_PICK = 'src/lib/postseason/__tests__/team-pick.test.ts';
const T_DATA = 'src/lib/postseason/__tests__/data.test.ts';
const T_RENDER = 'src/components/playoffs/inbound/__tests__/team-pick-render.test.tsx';
const T_PLACE = 'src/components/playoffs/inbound/__tests__/placement.test.ts';
const T_ROUTES = 'src/app/playoffs/__tests__/routes.test.tsx';

const TEAM_LOG = 'console.error(`${PREDICTIONS_UNAVAILABLE} league=${l.league} surface=team reason=${reason}`);';
const TEAM_CATCH = "    reason = e instanceof DisabledSignal ? 'disabled' : 'build-failed';\n  }\n  " + TEAM_LOG;

/** [name, file, from, to, tests]. `from` must occur exactly once. */
const CASES = [
  // ---- The line's state logic (team-pick.ts) ----
  ['first-series guard removed', TP, "if (real.length === 0 || real[0].seriesKey !== mine[0].seriesKey) return 'first-series-mismatch';", "if (real.length === 0) return 'first-series-mismatch';", [T_PICK, T_DATA]],
  ['club in no predicted series not refused', TP, "  if (mine.length === 0) return 'no-team-pick';\n", '', [T_PICK]],
  ['pick chain unchecked', TP, "  for (const s of mine.slice(0, -1)) if (s.pick !== teamId) return 'pick-inconsistent';\n", '', [T_PICK]],
  ['title pick and champion field may disagree', TP, "  if (toWinTitle !== (predicted.champion === teamId)) return 'pick-inconsistent';\n", '', [T_PICK]],
  ['unknown predicted round accepted', TP, "  if (mine.some((s) => rankOf(s.round) < 0)) return 'pick-inconsistent';\n", '', [T_PICK]],
  ['rounds ordered by name', TP, '  for (const s of bracket.series) if (!rank.has(s.round)) rank.set(s.round, rank.size);', '  for (const r of [...new Set(bracket.series.map((s) => s.round))].sort()) rank.set(r, rank.size);', [T_PICK]],
  ['alive and decides boundary off by one', TP, "    if (lastRankReal < exitRank) return out('alive', 'Pick still alive.');", "    if (lastRankReal <= exitRank) return out('alive', 'Pick still alive.');", [T_PICK]],
  ['a won series is always alive', TP, "    return lastRankReal < exitRank ? out('alive', 'Pick still alive.') : further();", "    return out('alive', 'Pick still alive.');", [T_PICK]],
  ['another opponent counted correct', TP, '  if (d.other === pickedOpponent) {', '  if (true) {', [T_PICK]],
  ['different-opponent line names the picked club as the winner', TP, 'lost to the ${opp} ${tally(last)} in the ${last.roundLabel}. PromoNight picked', 'lost to the ${y} ${tally(last)} in the ${last.roundLabel}. PromoNight picked', [T_PICK]],
  ['further-than-picked names the wrong series', TP, '    const through = real.find((s) => rankOf(s.round) === exitRank);', '    const through = last;', [T_PICK]],
  ['champion never detected', TP, '  const champion = last.status === \'final\' && lastRankReal === lastRank && decided(last)?.won === true;', '  const champion = false;', [T_PICK]],
  ['title pick that lost the final not busted', TP, '  if (toWinTitle) {\n    // Picked to win the final, lost it', '  if (false) {\n    // Picked to win the final, lost it', [T_PICK]],
  ['plural round takes the singular verb', TP, "  const plural = /s$/.test(roundLabel) && !/Series$/.test(roundLabel);", '  const plural = false;', [T_PICK]],
  ['series score reversed', TP, '  return `${Math.max(s.wins.higher, s.wins.lower)}-${Math.min(s.wins.higher, s.wins.lower)}`;', '  return `${Math.min(s.wins.higher, s.wins.lower)}-${Math.max(s.wins.higher, s.wins.lower)}`;', [T_PICK]],
  ['link loses the predictions anchor', TP, '  const href = `/playoffs/${bracket.league.toLowerCase()}#predictions`;', '  const href = `/playoffs/${bracket.league.toLowerCase()}`;', [T_PICK, T_RENDER]],
  // ---- Failure isolation and reads (data.ts) ----
  ['line failure rethrown', D, TEAM_CATCH, '    throw e;\n  }\n  ' + TEAM_LOG, [T_DATA]],
  ['line failure not logged', D, TEAM_LOG, '', [T_DATA]],
  ['line failure logged without surface=team', D, TEAM_LOG, 'console.error(`${PREDICTIONS_UNAVAILABLE} league=${l.league} reason=${reason}`);', [T_DATA]],
  ['line failure logged twice', D, TEAM_LOG, TEAM_LOG + '\n  ' + TEAM_LOG, [T_DATA]],
  ['line failure logged with the club', D, TEAM_LOG, 'console.error(`${PREDICTIONS_UNAVAILABLE} league=${l.league} surface=team reason=${reason} club=${teamId}`);', [T_DATA]],
  ['switch ignored by the line', D, '    if (predictionsDisabled(l.league)) throw new DisabledSignal();\n    const read = await getPredictedBracket(l.league);\n    if (read.state === \'ok\') {\n      const clubs = await clubsFor(predictionSlugs(l.bracket', '    const read = await getPredictedBracket(l.league);\n    if (read.state === \'ok\') {\n      const clubs = await clubsFor(predictionSlugs(l.bracket', [T_DATA]],
  ['assembly failure ignored by the line', D, "      if ('unavailable' in built) {\n        reason = built.unavailable;\n      } else {\n        const pick", "      if (false) {\n        reason = built.unavailable;\n      } else {\n        const pick", [T_DATA]],
  ['line scored against a second bracket read', D, '        const pick = teamPick(l.bracket, read.predicted, teamId, clubs);', "        const again = await getBracket(l.league);\n        const pick = teamPick(again.state === 'ok' ? again.bracket : l.bracket, read.predicted, teamId, clubs);", [T_DATA]],
  ['a league with no route reads', D, '  if (!postseasonLeagueFromSlug(sportSlug)) return null;\n  const inbound', '  const inbound', [T_DATA]],
  ['a club in no bracket still asks for a line', D, '  if (!club) return null;\n  const l = inbound', '  const l = inbound', [T_DATA]],
  // ---- Byte identity (the module and the hero) ----
  ['module with no line serializes a null child', M, '  if (!pick) return section;\n  return withLastChild(section, <PickLine pick={pick} teamId={teamId} />);', '  return withLastChild(section, pick ? <PickLine pick={pick} teamId={teamId} /> : null);', [T_RENDER]],
  ['line put first in the module', M, 'cloneElement(el, undefined, ...(Array.isArray(kids) ? kids : [kids]), child)', 'cloneElement(el, undefined, child, ...(Array.isArray(kids) ? kids : [kids]))', [T_RENDER]],
  ['line links somewhere else', M, '        href={pick.href}', '        href="/playoffs"', [T_RENDER]],
  ['hero with no notice serializes an extra child', H, '      {notice ? withNotice(inner, notice) : inner}', '      {withNotice(inner, notice)}', [T_RENDER]],
  ['hero notice after the stat bar', H, 'cloneElement(el, undefined, ...kids.slice(0, -1), notice, kids[kids.length - 1])', 'cloneElement(el, undefined, ...kids, notice)', [T_RENDER, T_PLACE]],
  // ---- Hero line and final card (inbound.ts) ----
  ['hero line loses its fallback', I, 'text: round ? `${head}: ${round}. Open the bracket` : `${head}. Open the bracket`', 'text: `${head}: ${round}. Open the bracket`', [T_RENDER]],
  ['hero line on a finished bracket', I, "  if (!l || l.view.phase.kind !== 'active') return null;\n  const round", "  if (!l) return null;\n  const round", [T_RENDER]],
  ['final card while the league plays', I, "  if (!l || l.view.phase.kind !== 'concluded') return null;", '  if (!l) return null;', [T_RENDER]],
  // ---- Placement and the back link ----
  ['MLB hub drops the final card', MLB, "  const finalCard = playoffs ? null : leagueFinalCard(inbound, 'MLB');", '  const finalCard = null;', [T_PLACE]],
  ['WNBA hub drops the hero line', WNBA, "        notice={heroLine ? <LeaguePlayoffsHeroLine line={heroLine} surface=\"web_wnba_hub\" /> : undefined}\n", '', [T_PLACE]],
  ['team route reads the predictions itself', ROUTE, 'pick={postseason.pick}', 'pick={null}', [T_PLACE]],
  ['back link goes elsewhere', PL, 'href={getLeagueHub(league)?.href ?? `/${league.toLowerCase()}`}', 'href="/teams"', [T_ROUTES]],
];

const run = (files) =>
  spawnSync('node', ['--import', 'tsx', '--experimental-test-module-mocks', '--test', ...files], {
    cwd: WORK,
    env: { ...process.env, TSX_TSCONFIG_PATH: 'tsconfig.test.json' },
    encoding: 'utf-8',
    timeout: 120000,
  });

const base = run([T_PICK, T_DATA, T_RENDER, T_PLACE, T_ROUTES]);
if (base.status !== 0) {
  console.error('the tests fail before any mutation; fix that first');
  console.error(base.stdout.slice(-3000));
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
