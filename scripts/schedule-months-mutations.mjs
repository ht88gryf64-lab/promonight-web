// The mutation harness for the MLB schedule month sections and the four copy
// fixes (ADS G1). A guard counts only if removing it fails a test: each case
// edits one guard out of the source, runs the tests meant to catch it, and
// expects a failure.
//
// IT NEVER TOUCHES THIS TREE. Sources, scripts and configs are copied to a
// temporary directory (node_modules linked) and every mutation is made there.
//
//   node scripts/schedule-months-mutations.mjs
//
// Not part of `npm test` (it is slow). Same runner as
// scripts/playoffs/team-picks-mutations.mjs.
import { readFileSync, writeFileSync, mkdtempSync, cpSync, symlinkSync, rmSync, realpathSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';

const REPO = resolve(new URL('..', import.meta.url).pathname);
const WORK = mkdtempSync(join(tmpdir(), 'pn-schedule-months-mutations-'));
for (const f of ['src', 'scripts', 'tsconfig.json', 'tsconfig.test.json', 'package.json']) cpSync(join(REPO, f), join(WORK, f), { recursive: true });
symlinkSync(realpathSync(join(REPO, 'node_modules')), join(WORK, 'node_modules'));
process.on('exit', () => rmSync(WORK, { recursive: true, force: true }));

const LIB = 'src/lib/schedule-months.ts';
const SB = 'src/components/redesign/ScheduleBlock.tsx';
const PAGE = 'src/components/redesign/RedesignTeamPage.tsx';
const T_LIB = 'src/lib/__tests__/schedule-months.test.ts';
const T_RENDER = 'src/components/redesign/__tests__/schedule-months.test.tsx';
const T_NFL = 'src/components/redesign/__tests__/schedule-nfl-identity.test.tsx';

const ROWS_UL = '<ul className="mt-2 space-y-2">{m.rows.map((row) => renderRow(row))}</ul>';
const WRAP = '<div key={m.key}>{month(m)}</div>';

/** [name, file, from, to, tests]. `from` must occur exactly once. */
const CASES = [
  // ---- Fix (b): the regular season only ----
  ['postseason game in the list', LIB, '      c.game.isPostseason !== true &&', '      true &&', [T_LIB, T_RENDER]],
  ['stale postponed original kept', LIB, '    return typeof id !== \'number\' || bestById.get(id) === c;', '    return true;', [T_LIB, T_RENDER]],
  ['canceled game kept', LIB, "    if (c.game.status === 'canceled') return false;\n", '', [T_LIB, T_RENDER]],
  ['canceled ranked below a stale scheduled twin', LIB, 'const SETTLED: Record<string, number> = { completed: 4, canceled: 3, scheduled: 2, postponed: 1 };', 'const SETTLED: Record<string, number> = { completed: 4, scheduled: 3, postponed: 2, canceled: 1 };', [T_LIB]],
  ['lone postponed dropped in season', LIB, "    if (c.game.status === 'postponed') return seasonLive;", "    if (c.game.status === 'postponed') return false;", [T_LIB]],
  ['lone postponed kept with nothing ahead', LIB, "    if (c.game.status === 'postponed') return seasonLive;", '', [T_LIB]],
  ['season taken as live with no clock', LIB, '    today !== undefined && kept.some(', '    today === undefined || kept.some(', [T_LIB]],
  ['MLB rules keyed on the gamePk, not the league', LIB, "  const isMlb = (c: GameContext) => c.game.league === 'mlb';", "  const isMlb = (c: GameContext) => typeof c.game.mlbGameId === 'number';", [T_LIB]],
  ['duplicate resolved to the stale original', LIB, '  if (ra !== rb) return ra > rb;', '  if (ra !== rb) return ra < rb;', [T_LIB]],
  ['the filter dropped from the list', SB, '  const regular = regularSeasonContexts(contexts, today);', '  const regular = contexts;', [T_RENDER]],
  // ---- Fix (c): the Games tile ----
  ['tile counting postseason', PAGE, 'gamesCount={regularGames?.length}', 'gamesCount={gameContexts?.length}', [T_RENDER]],
  ['schedule gated on the raw docs', PAGE, '  const showSchedule = hasNoUpcoming && (regularGames?.length ?? 0) > 0;', '  const showSchedule = hasNoUpcoming && (gameContexts?.length ?? 0) > 0;', [T_RENDER]],
  ['today not wired to the list', PAGE, ' teamName={displayName} today={today} statusLine={statusLine} />', ' teamName={displayName} statusLine={statusLine} />', [T_RENDER]],
  ['bare group class on the month', SB, '    <details className="group/month">', '    <details className="group">', [T_RENDER]],
  ['MLB copy year hardcoded', SB, '  seasonName = TITLE_SEASON_YEAR,', '  seasonName = 2026,', [T_RENDER]],
  // ---- The month sections ----
  ['a month rendered expanded by default', SB, '    <details className="group/month">', '    <details className="group/month" open>', [T_RENDER]],
  ['rows missing from the HTML while collapsed', SB, ROWS_UL, '<ul className="mt-2 space-y-2">{m.rows.slice(0, 3).map((row) => renderRow(row))}</ul>', [T_RENDER]],
  ['rows held back until a month opens', SB, ROWS_UL, '<ul className="mt-2 space-y-2" />', [T_RENDER]],
  ['summary given a role that replaces the native one', SB, '      <summary className="block', '      <summary role="button" className="block', [T_RENDER]],
  ['header counts promos or loses the count', SB, '{`${m.label} · ${gamesLabel(m.rows.length)}`}', '{m.label}', [T_RENDER]],
  ['month taken from a malformed key', LIB, '    if (!m || month < 1 || month > 12) return null;', '    if (!m) return null;', [T_LIB]],
  ['months out of order split into two sections', LIB, '    else if (out.some((g) => g.key === key)) return null;\n', '', [T_LIB]],
  // ---- Ad placement ----
  ['a unit inside a details block (page-content on the details)', SB, '    <details className="group/month">', '    <details className="group/month page-content">', [T_RENDER]],
  ['the details itself made the anchor', SB, WRAP, '<details key={m.key}>{month(m)}</details>', [T_RENDER]],
  ['last month inside the anchor wrapper', SB, '{months.slice(0, -1).map((m) => (', '{months.map((m) => (', [T_RENDER]],
  ['a single month wrapped as an anchor', SB, '          <div className="mt-6">{month(months[0])}</div>', '          <div className="mt-6 page-content">{month(months[0])}</div>', [T_RENDER]],
  // ---- Copy fixes (a) and (d) ----
  ['"week by week" back on the date list', SB, '`${every} of the ${seasonName} regular season, by month. Open a month to see its games.`', '`${every} of the ${seasonName} regular season, week by week. Open a month to see its games.`', [T_RENDER]],
  ['ticket invitation over a fully played season', SB, "    const remaining =\n      today !== undefined && regular.some((c) => c.game.status === 'scheduled' && c.game.date >= today);", '    const remaining = true;', [T_RENDER]],
  ['no clock read treated as a game remaining', SB, "    const remaining =\n      today !== undefined && regular.some((c) => c.game.status === 'scheduled' && c.game.date >= today);", "    const remaining =\n      today === undefined || regular.some((c) => c.game.status === 'scheduled' && c.game.date >= today);", [T_RENDER]],
  ['remaining read from postseason docs', SB, "    const remaining =\n      today !== undefined && regular.some((c) => c.game.status === 'scheduled' && c.game.date >= today);", "    const remaining =\n      today !== undefined && contexts.some((c) => c.game.status === 'scheduled' && c.game.date >= today);", [T_RENDER]],
  ['another season counted', LIB, "      (!isMlb(c) || c.game.date.startsWith(`${TITLE_SEASON_YEAR}-`)),", '      true,', [T_LIB, T_RENDER]],
  ['season scope applied to NFL', LIB, "      (!isMlb(c) || c.game.date.startsWith(`${TITLE_SEASON_YEAR}-`)),", '      c.game.date.startsWith(`${TITLE_SEASON_YEAR}-`),', [T_LIB, T_NFL]],
  ['a game played today keeps the invitation', SB, "regular.some((c) => c.game.status === 'scheduled' && c.game.date >= today);", 'regular.some((c) => c.game.date >= today);', [T_RENDER]],
  ['season live only strictly after today', LIB, "c.game.status === 'scheduled' && c.game.date >= today);\n  return kept.filter", "c.game.status === 'scheduled' && c.game.date > today);\n  return kept.filter", [T_LIB]],
  ['a month hidden from assistive technology', SB, '    <details className="group/month">', '    <details className="group/month" aria-hidden="true">', [T_RENDER]],
  ['postponed row prints its original first pitch', SB, "  const kickoffLabel = opts.showPostponed && game.status === 'postponed'", '  const kickoffLabel = false', [T_RENDER]],
  ['fallback list claims months', SB, '            ? `${every} of the ${seasonName} regular season.`', '            ? `${every} of the ${seasonName} regular season, by month. Open a month to see its games.`', [T_RENDER]],
  ['NFL output drifting: the postponed label reaches the week grid', SB, '            return renderGameRow(row, team, teamName);', '            return renderGameRow(row, team, teamName, { showPostponed: true });', [T_NFL, T_RENDER]],
  // ---- NFL byte identity ----
  ['NFL output drifting: a weekless NFL slate sent down the month path', SB, "  if (team.league === 'MLB' && !isWeekGrid) {", '  if (!isWeekGrid) {', [T_RENDER]],
  ['NFL output drifting: the league gate inverted', SB, "  if (team.league === 'MLB' && !isWeekGrid) {", "  if (team.league !== 'MLB' || !isWeekGrid) {", [T_NFL]],
  ['NFL output drifting: the MLB status rules applied to every league', LIB, '  return kept.filter((c) => {\n    if (!isMlb(c)) return true;', '  return kept.filter((c) => {', [T_NFL, T_LIB]],
  ['NFL output drifting: week-grid intro edited', SB, 'Every game of the 2026 regular season, week by week.', 'Every game of the 2026 regular season, week by week, from kickoff.', [T_NFL]],
];

const run = (files) =>
  spawnSync('node', ['--import', 'tsx', '--experimental-test-module-mocks', '--test', ...files], {
    cwd: WORK,
    env: { ...process.env, TSX_TSCONFIG_PATH: 'tsconfig.test.json' },
    encoding: 'utf-8',
    timeout: 120000,
  });

const base = run([T_LIB, T_RENDER, T_NFL]);
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
