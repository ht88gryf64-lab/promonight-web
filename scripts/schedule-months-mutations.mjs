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
  ['postseason game in the list', LIB, '  const regular = contexts.filter((c) => c.game.isPostseason !== true);', '  const regular = [...contexts];', [T_LIB, T_RENDER]],
  ['stale postponed original kept', LIB, '    if (bestById.get(id) !== c) return false;\n', '', [T_LIB, T_RENDER]],
  ['canceled game kept', LIB, "    return c.game.status !== 'canceled';", '    return true;', [T_LIB, T_RENDER]],
  ['duplicate resolved to the stale original', LIB, '  if (ra !== rb) return ra > rb;', '  if (ra !== rb) return ra < rb;', [T_LIB]],
  ['the filter dropped from the list', SB, '  const regular = regularSeasonContexts(contexts);', '  const regular = contexts;', [T_RENDER]],
  // ---- Fix (c): the Games tile ----
  ['tile counting postseason', PAGE, 'gamesCount={gameContexts ? regularSeasonContexts(gameContexts).length : undefined}', 'gamesCount={gameContexts?.length}', [T_RENDER]],
  // ---- The month sections ----
  ['a month rendered expanded by default', SB, '    <details className="group">', '    <details className="group" open>', [T_RENDER]],
  ['rows missing from the HTML while collapsed', SB, ROWS_UL, '<ul className="mt-2 space-y-2">{m.rows.slice(0, 3).map((row) => renderRow(row))}</ul>', [T_RENDER]],
  ['rows held back until a month opens', SB, ROWS_UL, '<ul className="mt-2 space-y-2" />', [T_RENDER]],
  ['summary given a role that replaces the native one', SB, '      <summary className="block', '      <summary role="button" className="block', [T_RENDER]],
  ['header counts promos or loses the count', SB, '{`${m.label} · ${gamesLabel(m.rows.length)}`}', '{m.label}', [T_RENDER]],
  ['month taken from a malformed key', LIB, '    if (!m || month < 1 || month > 12) return null;', '    if (!m) return null;', [T_LIB]],
  ['months out of order split into two sections', LIB, '    else if (out.some((g) => g.key === key)) return null;\n', '', [T_LIB]],
  // ---- Ad placement ----
  ['a unit inside a details block (page-content on the details)', SB, '    <details className="group">', '    <details className="group page-content">', [T_RENDER]],
  ['the details itself made the anchor', SB, WRAP, '<details key={m.key}>{month(m)}</details>', [T_RENDER]],
  ['last month inside the anchor wrapper', SB, '{months.slice(0, -1).map((m) => (', '{months.map((m) => (', [T_RENDER]],
  ['a single month wrapped as an anchor', SB, '          <div className="mt-6">{month(months[0])}</div>', '          <div className="mt-6 page-content">{month(months[0])}</div>', [T_RENDER]],
  // ---- Copy fixes (a) and (d) ----
  ['"week by week" back on the date list', SB, "'Every game of the 2026 regular season, by month. Open a month to see its games.'", "'Every game of the 2026 regular season, week by week. Open a month to see its games.'", [T_RENDER]],
  ['ticket invitation over a fully played season', SB, "    const remaining = today !== undefined && regular.some((c) => c.game.date >= today);", '    const remaining = true;', [T_RENDER]],
  ['no clock read treated as a game remaining', SB, "    const remaining = today !== undefined && regular.some((c) => c.game.date >= today);", '    const remaining = today === undefined || regular.some((c) => c.game.date >= today);', [T_RENDER]],
  ['remaining read from postseason docs', SB, "    const remaining = today !== undefined && regular.some((c) => c.game.date >= today);", '    const remaining = today !== undefined && contexts.some((c) => c.game.date >= today);', [T_RENDER]],
  // ---- NFL byte identity ----
  ['NFL output drifting: week grid sent down the month path', SB, '  const isWeekGrid = rows.every((r) => r.week !== null);', '  const isWeekGrid = false;', [T_NFL]],
  ['NFL output drifting: canceled rule applied without a gamePk', LIB, "    if (typeof id !== 'number') return true;", "    if (typeof id !== 'number') return c.game.status !== 'canceled';", [T_NFL, T_LIB]],
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
