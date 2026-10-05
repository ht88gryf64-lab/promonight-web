// The mutation harness for honest season labels and the NHL/NBA schedule
// (WEB6, 2026-10-05). A guard counts only if removing it fails a test: each
// case edits one guard out of the source, runs the tests meant to catch it,
// and expects a failure.
//
// IT NEVER TOUCHES THIS TREE. Sources, scripts and configs are copied to a
// temporary directory (node_modules linked) and every mutation is made there.
//
//   node scripts/season-labels-mutations.mjs
//
// Not part of `npm test` (it is slow). Same runner as
// scripts/schedule-months-mutations.mjs.
import { readFileSync, writeFileSync, mkdtempSync, cpSync, symlinkSync, rmSync, realpathSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';

const REPO = resolve(new URL('..', import.meta.url).pathname);
const WORK = mkdtempSync(join(tmpdir(), 'pn-season-labels-mutations-'));
for (const f of ['src', 'scripts', 'tsconfig.json', 'tsconfig.test.json', 'package.json']) cpSync(join(REPO, f), join(WORK, f), { recursive: true });
symlinkSync(realpathSync(join(REPO, 'node_modules')), join(WORK, 'node_modules'));
process.on('exit', () => rmSync(WORK, { recursive: true, force: true }));

const LABEL = 'src/lib/season-label.ts';
const SCOPE = 'src/lib/season-scope.ts';
const HELPERS = 'src/lib/promo-helpers.ts';
const LIST = 'src/components/promo-list.tsx';
const SB = 'src/components/redesign/ScheduleBlock.tsx';
const DATA = 'src/lib/data.ts';
const ANN = 'src/lib/announcement-status.ts';
const ZERO = 'src/components/zero-promo-fallback.tsx';
const TCS = 'src/components/team-content-sections.tsx';
const AUTH = 'src/components/authority-stats.tsx';
const PAGE = 'src/components/redesign/RedesignTeamPage.tsx';

const T_LEAGUE = 'src/lib/__tests__/season-labels-by-league.test.ts';
const T_SCOPE = 'src/lib/__tests__/season-scope.test.ts';
const T_RENDER = 'src/components/redesign/__tests__/season-labels-render.test.tsx';
const T_GAMES = 'src/lib/__tests__/nhl-nba-schedule.test.ts';
const T_BYTES = 'src/components/redesign/__tests__/mlb-nfl-byte-identity.test.tsx';
const T_MONTHS = 'src/components/redesign/__tests__/schedule-months.test.tsx';

/** [name, file, from, to, tests]. `from` must occur exactly once. */
const CASES = [
  // ---- Calendar-year scope for NHL/NBA (the ruling's core) ----
  ['calendar-year scope for NHL/NBA: the split branch skipped', SCOPE, '  if (isSplitSeasonLeague(league)) {', '  if (false) {', [T_LEAGUE, T_SCOPE]],
  ['NHL/NBA season counts every season it holds', SCOPE, '(p) => splitSeasonStartYear(p.date) === TITLE_SEASON_YEAR', '() => true', [T_LEAGUE, T_SCOPE]],
  ['the season boundary moved to January 1 (calendar year)', LABEL, 'const SPLIT_SEASON_FIRST_MONTH = 7;', 'const SPLIT_SEASON_FIRST_MONTH = 1;', [T_LEAGUE]],
  ['the season boundary moved to October', LABEL, 'const SPLIT_SEASON_FIRST_MONTH = 7;', 'const SPLIT_SEASON_FIRST_MONTH = 10;', [T_LEAGUE]],
  ['the label printed as a calendar year', SCOPE, 'buildScope(inSeason, TITLE_SEASON_YEAR, splitSeasonLabel(TITLE_SEASON_YEAR), today)', 'buildScope(inSeason, TITLE_SEASON_YEAR, String(TITLE_SEASON_YEAR), today)', [T_LEAGUE, T_SCOPE]],
  ['the claim sentence reads the year, not the label', SCOPE, 'in the ${scope.label} season`;', 'in the ${scope.year} season`;', [T_LEAGUE]],
  ['the FAQ count reads the year, not the label', HELPERS, 'have in the ${season.label} season?`', 'have in the ${season.year} season?`', [T_LEAGUE]],
  ['NBA and NHL not split leagues', LABEL, "const SPLIT_SEASON_LEAGUES = new Set(['NHL', 'NBA']);", "const SPLIT_SEASON_LEAGUES = new Set<string>([]);", [T_LEAGUE, T_RENDER]],
  ['the split check made case-sensitive', LABEL, 'SPLIT_SEASON_LEAGUES.has(league.toUpperCase())', 'SPLIT_SEASON_LEAGUES.has(league)', [T_LEAGUE, T_GAMES, T_RENDER]],
  // ---- "this season" on an archive heading ----
  ['"this season" over a past season (split archive)', LABEL, '      const subline = isCurrent\n', '      const subline = true\n', [T_LEAGUE, T_RENDER]],
  ['"this season" over an earlier calendar year', LABEL, '  if (!span.spansYears && span.years[0] === TITLE_SEASON_YEAR) return', '  if (!span.spansYears) return', [T_LEAGUE, T_BYTES]],
  ['last season headed as the current season', LABEL, '      const heading = isCurrent\n', '      const heading = true\n', [T_LEAGUE, T_RENDER]],
  ['no "LAST SEASON" heading', LABEL, '        : startYear === TITLE_SEASON_YEAR - 1\n', '        : false\n', [T_LEAGUE, T_RENDER]],
  ['seasons out of order in the archive', LABEL, '    .sort((a, b) => b - a)', '    .sort((a, b) => a - b)', [T_LEAGUE, T_RENDER]],
  ['the archive not grouped on NHL/NBA', LIST, '  const splitGroups = isSplitSeasonLeague(league)\n', '  const splitGroups = false\n', [T_RENDER]],
  ['"All N on record" counts both seasons', LIST, "splitGroups.find((g) => g.isCurrent)?.rows ?? []", 'past', [T_RENDER]],
  ['the season-complete heading takes the archive span', LIST, "  const seasonCompleteLabel = splitGroups ? currentSeasonLabel(league) : pastSpan?.yearLabel ?? '';", "  const seasonCompleteLabel = pastSpan?.yearLabel ?? '';", [T_RENDER]],
  ['the resale lift budget not shared across seasons', LIST, '      resaleLeft -= parts.resale.length;\n', '', [T_RENDER]],
  ['the archive keys renamed on calendar-year leagues', LIST, "archiveBlock(pastHeading, pastCount, { resale: pastResale, ssr: pastSsr, collapsed: pastCollapsed }, '')", "archiveBlock(pastHeading, pastCount, { resale: pastResale, ssr: pastSsr, collapsed: pastCollapsed }, 'x-')", [T_BYTES]],
  // ---- Byte identity on MLB and NFL ----
  ['a numeric year turned into a string in the content sections', TCS, '      : SEASON_YEAR;\n', '      : String(SEASON_YEAR);\n', [T_BYTES]],
  ['a numeric year turned into a string in the zero-promo heading', ZERO, 'splitSeasonLabel(SEASON_YEAR) : SEASON_YEAR;', 'splitSeasonLabel(SEASON_YEAR) : String(SEASON_YEAR);', [T_BYTES]],
  // ---- Zero-promo copy ----
  ['zero-promo heading back to the calendar year on NHL/NBA', ZERO, 'const seasonName: string | number = isSplitSeasonLeague(team.league) ? splitSeasonLabel(SEASON_YEAR) : SEASON_YEAR;', 'const seasonName: string | number = SEASON_YEAR;', [T_RENDER]],
  ['zero-promo copy claims the club has not announced', ZERO, '`PromoNight has no ${teamName} ${year} promotions listed yet. Most NBA', "`The ${teamName} haven't announced any ${year} promotional events yet. Most NBA", [T_RENDER]],
  // ---- The status line ----
  ['"haven\'t announced" for an unverified club', ANN, '  return nothingPublishedVerified(teamId, today)\n', '  return true\n', [T_RENDER]],
  ['the verification never expires', ANN, '  return today >= on && today < addDays(on, VERIFIED_FOR_DAYS);', '  return today >= on;', [T_RENDER]],
  ['the verification holds before its own date', ANN, '  return today >= on && today < addDays(on, VERIFIED_FOR_DAYS);', '  return today < addDays(on, VERIFIED_FOR_DAYS);', [T_RENDER]],
  ['a club that had published put on the verified list', ANN, "  'new-york-knicks': '2026-10-05',", "  'new-york-knicks': '2026-10-05',\n  'golden-state-warriors': '2026-10-05',", [T_RENDER]],
  ['the status line not rendered', SB, '    if (!statusLine) return list;', '    return list;', [T_RENDER]],
  ['the status line put back inside the MLB list as a slot', SB, '      <div className="mx-auto max-w-5xl">\n        <div className="font-rd text-[11px] uppercase tracking-[0.14em] text-rd-ink-faint">\n          {`${seasonName} season`}', '      <div className="mx-auto max-w-5xl">\n        {null}\n        <div className="font-rd text-[11px] uppercase tracking-[0.14em] text-rd-ink-faint">\n          {`${seasonName} season`}', [T_BYTES]],
  ['the status line on a page whose season resolved', ANN, '  if (!opts.showSchedule || opts.seasonResolved || !isSplitSeasonLeague(opts.league)) return null;', '  if (!opts.showSchedule || !isSplitSeasonLeague(opts.league)) return null;', [T_RENDER]],
  ['the status line on MLB and NFL', ANN, '  if (!opts.showSchedule || opts.seasonResolved || !isSplitSeasonLeague(opts.league)) return null;', '  if (!opts.showSchedule || opts.seasonResolved) return null;', [T_RENDER]],
  ['the page passes the wrong season flag', PAGE, '    seasonResolved: !!seasonScope,', '    seasonResolved: false,', [T_RENDER, T_MONTHS]],
  // ---- The NHL/NBA schedule ----
  ['NHL/NBA sent down the week path', SB, '  if (isSplitSeasonLeague(team.league) && !isWeekGrid) {', '  if (false) {', [T_RENDER]],
  ['"every game" claimed while the NBA has published 80 of 82', SB, '        scheduledOnly\n', '', [T_RENDER]],
  ['the schedule named for the calendar year', SB, '        seasonName={currentSeasonLabel(team.league)}\n', '', [T_RENDER]],
  ['a venue line on NHL/NBA rows', SB, "renderGameRow(row, team, teamName, { hideVenue: true })", 'renderGameRow(row, team, teamName, {})', [T_RENDER]],
  ['the ticket invitation over a played season', SB, "regular.some((c) => c.game.date >= today && c.game.status === 'scheduled');", 'true;', [T_RENDER]],
  ['the ticket invitation with no clock read', SB, "const splitRemaining = today !== undefined && regular", 'const splitRemaining = today === undefined || regular', [T_RENDER]],
  // ---- Games and times ----
  ['NHL/NBA games not read', DATA, "export const GAME_LEAGUES: readonly string[] = ['mlb', 'nfl', 'nhl', 'nba'];", "export const GAME_LEAGUES: readonly string[] = ['mlb', 'nfl'];", [T_GAMES]],
  ['a league with no games data read anyway', DATA, '  if (!GAME_LEAGUES.includes(league)) return [];', '', [T_GAMES]],
  ['NBA times not blanked', DATA, "  if (game.league === 'nba') {\n    game.gameTime = '';", "  if (false) {\n    game.gameTime = '';", [T_GAMES]],
  ['NBA zone kept', DATA, "    game.gameTimeTz = '';\n  }", '  }', [T_GAMES]],
  ['NHL times blanked too', DATA, "  if (game.league === 'nba') {\n    game.gameTime = '';", "  if (game.league === 'nba' || game.league === 'nhl') {\n    game.gameTime = '';", [T_GAMES]],
  // ---- The NHL season claim ----
  ['NHL home games back to 41', AUTH, '  NHL: 42,', '  NHL: 41,', [T_RENDER]],
];

const run = (files) =>
  spawnSync('node', ['--import', 'tsx', '--experimental-test-module-mocks', '--test', ...files], {
    cwd: WORK,
    env: { ...process.env, TSX_TSCONFIG_PATH: 'tsconfig.test.json' },
    encoding: 'utf-8',
    timeout: 120000,
  });

const base = run([T_LEAGUE, T_SCOPE, T_RENDER, T_GAMES, T_BYTES, T_MONTHS]);
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
