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
const T_PKG = 'src/components/redesign/__tests__/ticket-packages-render.test.tsx';
const T_PKG_DATA = 'src/lib/__tests__/ticket-packages-data.test.ts';
const T_R1 = 'src/components/redesign/__tests__/web6-review-r1.test.tsx';
const ROUTE = 'src/app/[sport]/[team]/page.tsx';
const TP = 'src/lib/ticket-packages.ts';
const TPL = 'src/components/redesign/TicketPackageList.tsx';
const MONTHS = 'src/lib/schedule-months.ts';
const EXPAND = 'src/components/redesign/GameExpand.tsx';
const SCORE = 'src/components/redesign/StatScoreboard.tsx';

/** [name, file, from, to, tests]. `from` must occur exactly once. */
const CASES = [
  // ---- Calendar-year scope for NHL/NBA (the ruling's core) ----
  ['calendar-year scope for NHL/NBA: the split branch skipped', SCOPE, '  if (isSplitSeasonLeague(league)) {', '  if (false) {', [T_LEAGUE, T_SCOPE]],
  ['NHL/NBA season counts every season it holds', SCOPE, '(p) => splitSeasonStartYear(p.date) === SPLIT_SEASON_START_YEAR', '() => true', [T_LEAGUE, T_SCOPE]],
  ['the season boundary moved to January 1 (calendar year)', LABEL, 'const SPLIT_SEASON_FIRST_MONTH = 7;', 'const SPLIT_SEASON_FIRST_MONTH = 1;', [T_LEAGUE]],
  ['the season boundary moved to October', LABEL, 'const SPLIT_SEASON_FIRST_MONTH = 7;', 'const SPLIT_SEASON_FIRST_MONTH = 10;', [T_LEAGUE]],
  ['the label printed as a calendar year', SCOPE, 'buildScope(inSeason, SPLIT_SEASON_START_YEAR, splitSeasonLabel(SPLIT_SEASON_START_YEAR), today)', 'buildScope(inSeason, SPLIT_SEASON_START_YEAR, String(SPLIT_SEASON_START_YEAR), today)', [T_LEAGUE, T_SCOPE]],
  ['the claim sentence reads the year, not the label', SCOPE, 'in the ${scope.label} season`;', 'in the ${scope.year} season`;', [T_LEAGUE]],
  ['the FAQ count reads the year, not the label', HELPERS, 'have in the ${season.label} season?`', 'have in the ${season.year} season?`', [T_LEAGUE]],
  ['NBA and NHL not split leagues', LABEL, "const SPLIT_SEASON_LEAGUES = new Set(['NHL', 'NBA']);", "const SPLIT_SEASON_LEAGUES = new Set<string>([]);", [T_LEAGUE, T_RENDER]],
  ['the split check made case-sensitive', LABEL, 'SPLIT_SEASON_LEAGUES.has(league.toUpperCase())', 'SPLIT_SEASON_LEAGUES.has(league)', [T_LEAGUE, T_GAMES, T_RENDER]],
  // ---- "this season" on an archive heading ----
  ['"this season" over a past season (split archive)', LABEL, '      const subline = isCurrent\n', '      const subline = true\n', [T_LEAGUE, T_RENDER]],
  ['"this season" over an earlier calendar year', LABEL, '  if (!span.spansYears && span.years[0] === TITLE_SEASON_YEAR) return', '  if (!span.spansYears) return', [T_LEAGUE, T_BYTES]],
  ['last season headed as the current season', LABEL, '      const heading = isCurrent\n', '      const heading = true\n', [T_LEAGUE, T_RENDER]],
  ['no "LAST SEASON" heading', LABEL, '        : startYear === SPLIT_SEASON_START_YEAR - 1\n', '        : false\n', [T_LEAGUE, T_RENDER]],
  ['seasons out of order in the archive', LABEL, '    .sort((a, b) => b - a)', '    .sort((a, b) => a - b)', [T_LEAGUE, T_RENDER]],
  ['the archive not grouped on NHL/NBA', LIST, '  const splitGroups = isSplitSeasonLeague(league)\n', '  const splitGroups = false\n', [T_RENDER]],
  ['"All N on record" counts both seasons', LIST, "splitGroups.find((g) => g.isCurrent)?.rows ?? []", 'past', [T_RENDER]],
  ['the season-complete heading takes the archive span', LIST, "  const seasonCompleteLabel = splitGroups ? currentSeasonLabel(league) : pastSpan?.yearLabel ?? '';", "  const seasonCompleteLabel = pastSpan?.yearLabel ?? '';", [T_RENDER]],
  ['the resale lift budget not shared across seasons', LIST, '      resaleLeft -= parts.resale.length;\n', '', [T_RENDER]],
  ['the archive keys renamed on calendar-year leagues', LIST, "archiveBlock(pastHeading, pastCount, { resale: pastResale, ssr: pastSsr, collapsed: pastCollapsed }, '')", "archiveBlock(pastHeading, pastCount, { resale: pastResale, ssr: pastSsr, collapsed: pastCollapsed }, 'x-')", [T_BYTES]],
  // ---- Byte identity on MLB and NFL ----
  ['a numeric year turned into a string in the content sections', TCS, '      : SEASON_YEAR;\n', '      : String(SEASON_YEAR);\n', [T_BYTES]],
  ['a numeric year turned into a string in the zero-promo heading', ZERO, 'splitSeasonLabel(SPLIT_SEASON_START_YEAR) : SEASON_YEAR;', 'splitSeasonLabel(SPLIT_SEASON_START_YEAR) : String(SEASON_YEAR);', [T_BYTES]],
  // ---- Zero-promo copy ----
  ['zero-promo heading back to the calendar year on NHL/NBA', ZERO, 'const seasonName: string | number = isSplitSeasonLeague(team.league) ? splitSeasonLabel(SPLIT_SEASON_START_YEAR) : SEASON_YEAR;', 'const seasonName: string | number = SEASON_YEAR;', [T_RENDER]],
  ['zero-promo copy claims the club has not announced', ZERO, '`Most NBA teams', "`The ${teamName} haven't announced any 2026-27 promotional events yet. Most NBA teams", [T_RENDER]],
  ['zero-promo copy repeats the status line (round 1)', ZERO, '`NHL teams typically', '`PromoNight has no ${teamName} 2026-27 promotions listed yet. NHL teams typically', [T_RENDER]],
  // ---- The status line ----
  ['"haven\'t announced" for an unverified club', ANN, '  return nothingPublishedVerified(teamId, today) && !opts.hasTicketPackages\n', '  return !opts.hasTicketPackages\n', [T_RENDER]],
  ['the verification never expires', ANN, '  return today >= on && today < addDays(on, VERIFIED_FOR_DAYS - SERVED_STALE_DAYS);', '  return today >= on;', [T_RENDER]],
  ['the verification holds before its own date', ANN, '  return today >= on && today < addDays(on, VERIFIED_FOR_DAYS - SERVED_STALE_DAYS);', '  return today < addDays(on, VERIFIED_FOR_DAYS - SERVED_STALE_DAYS);', [T_RENDER]],
  ['the claim rendered on its last day and served stale past it (round 1)', ANN, '  return today >= on && today < addDays(on, VERIFIED_FOR_DAYS - SERVED_STALE_DAYS);', '  return today >= on && today < addDays(on, VERIFIED_FOR_DAYS);', [T_RENDER]],
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
  // ---- Special-ticket items (WEB6 addendum) ----
  ['special-ticket item counted as a theme night: the partition returns everything', TP, '  return { promos: all.filter((p) => !isPackage(p)), ticketPackages };', '  return { promos: all, ticketPackages };', [T_PKG, T_PKG_DATA]],
  ['special-ticket item counted as a theme night: the flag never read', DATA, '  if (isTicketPackageDoc(doc.data())) ticketPackageRows.add(promo);\n', '', [T_PKG_DATA]],
  ['special-ticket item counted as a theme night: the route skips the split', ROUTE, '  const { promos, ticketPackages } = partitionTicketPackages(allPromos, isTicketPackagePromo, team.league);', '  const promos = allPromos;\n  const ticketPackages: Promo[] = [];', [T_PKG]],
  ['special-ticket item named in the meta description', ROUTE, '  const { promos } = partitionTicketPackages(allPromos, isTicketPackagePromo, team.league);', '  const promos = allPromos;', [T_PKG]],
  ['a wrapper await reintroduced in getTeamPromos', DATA, '  return dedupePromos(snapshot.docs.map(mapPromoDocNotingPackage).filter(isVisiblePromo));', '  await null;\n  return dedupePromos(snapshot.docs.map(mapPromoDocNotingPackage).filter(isVisiblePromo));', [T_PKG_DATA]],
  ['special-ticket item counted as a theme night: the page adds packages back into the list', PAGE, '          promos={promos}\n          teamSlug={team.id}', '          promos={[...promos, ...ticketPackages]}\n          teamSlug={team.id}', [T_PKG]],
  ['special-ticket item counted as a food deal on an away row', DATA, '  return partitionTicketPackages(dedupePromos(mapped.filter(isVisiblePromo)), isTicketPackagePromo, league)\n    .promos', '  return dedupePromos(mapped.filter(isVisiblePromo))', [T_PKG_DATA]],
  ['the raw MLB flag read as a verdict', TP, "const TICKET_PACKAGE_LEAGUES: ReadonlySet<string> = new Set(['NHL', 'NBA']);", "const TICKET_PACKAGE_LEAGUES: ReadonlySet<string> = new Set(['NHL', 'NBA', 'MLB', 'MLS', 'WNBA', 'NFL']);", [T_PKG, T_PKG_DATA]],
  ['a false flag read as a package', TP, '  return data?.ticketPackageRequired === true;', '  return data?.ticketPackageRequired !== undefined;', [T_PKG_DATA]],
  ['the package group not rendered', PAGE, '            <TicketPackageList packages={ticketPackages} />\n', '', [T_PKG]],
  ['a past package offered', TP, '  return rows.filter((p) => isUpcomingPromo(p, today)).sort((a, b) => a.date.localeCompare(b.date));', '  return [...rows].sort((a, b) => a.date.localeCompare(b.date));', [T_PKG]],
  ['a package row without the special-ticket note', TPL, '      <p className="mt-1 font-rd text-sm leading-relaxed text-rd-ink-soft">{TICKET_PACKAGE_ROW_NOTE}</p>\n', '', [T_PKG]],
  ['the group heading count off', TPL, '            {ticketPackagesHeading(packages.length)}', '            {ticketPackagesHeading(packages.length + 1)}', [T_PKG]],
  ['an ad anchor inside the group', TPL, '        <ul className="space-y-3">', '        <ul className="space-y-3 page-content">', [T_PKG]],
  ['an always-mounted group slot (a null child on every page)', PAGE, '              <div className="rd-weave-item order-[40]">{promoSlot}</div>', '              <div className="rd-weave-item order-[40]">{promoSlot}{null}</div>', [T_PKG, T_R1]],
  // ---- Review round 1 ----
  ['NHL/NBA season tied to the MLB title year', LABEL, 'export const SPLIT_SEASON_START_YEAR = 2026;', 'export const SPLIT_SEASON_START_YEAR = TITLE_SEASON_YEAR;', [T_R1]],
  ['the archive current season read from the title year', LABEL, '      const isCurrent = startYear === SPLIT_SEASON_START_YEAR;', '      const isCurrent = startYear === TITLE_SEASON_YEAR;', [T_R1]],
  ['neutral site read on every league', DATA, "  if ((d.league === 'nhl' || d.league === 'nba') && d.neutralSite === true) game.neutralSite = true;", '  if (d.neutralSite === true) game.neutralSite = true;', [T_PKG_DATA]],
  ['neutral site not read', DATA, "  if ((d.league === 'nhl' || d.league === 'nba') && d.neutralSite === true) game.neutralSite = true;", '', [T_PKG_DATA]],
  ['neutral-site game offered arena parking', EXPAND, '            {!awayFromBuildings && (\n              <ParkingCTA', '            {!game.isInternational && (\n              <ParkingCTA', [T_R1]],
  ['neutral-site game called a home game', EXPAND, '    : game.neutralSite === true\n    ? `Neutral site · ${game.venueName}`\n', '', [T_R1]],
  ['NBA Games tile unqualified', PAGE, "            {...(isSplitSeasonLeague(team.league) ? { gamesLabel: 'Scheduled games' } : {})}\n", '', [T_R1]],
  ['NHL/NBA preseason counted in the schedule', MONTHS, "(c.game.seasonType !== 'preseason' && splitSeasonStartYear(c.game.date) === SPLIT_SEASON_START_YEAR)", '(splitSeasonStartYear(c.game.date) === SPLIT_SEASON_START_YEAR)', [T_R1, T_GAMES]],
  ['another NHL/NBA season counted in the schedule', MONTHS, "(c.game.seasonType !== 'preseason' && splitSeasonStartYear(c.game.date) === SPLIT_SEASON_START_YEAR)", "(c.game.seasonType !== 'preseason')", [T_R1]],
  ['NHL/NBA preseason dropped before the calendar', DATA, "    .filter((g) => isRegularSeasonGame(g) || (keepPreseason && g.seasonType === 'preseason'));", '    .filter(isRegularSeasonGame);', [T_R1, T_GAMES]],
  ['"THE FULL SEASON" with games still to play', LIST, ' && !splitSeasonStillPlaying;', ';', [T_R1]],
  ['the meta description back to the calendar year', ROUTE, "  const closer = ` See the full ${seasonWord} schedule at PromoNight.`;", "  const closer = ` See the full ${year} schedule at PromoNight.`;", [T_R1]],
  // ---- Review round 2 ----
  ['"haven\'t announced" above the club\'s own ticket packages', ANN, '  return nothingPublishedVerified(teamId, today) && !opts.hasTicketPackages', '  return nothingPublishedVerified(teamId, today)', [T_RENDER, T_R1]],
  ['the page does not tell the status line about packages', PAGE, '    hasTicketPackages: ticketPackages.length > 0,\n', '', [T_RENDER, T_R1]],
  ['the "haven\'t announced" claim undated', ANN, " yet (checked ${checkedLabel(NOTHING_PUBLISHED[teamId])}).`", " yet.`", [T_RENDER]],
  ['/teams counts packages as promotions', 'src/app/teams/page.tsx', '      const { promos } = partitionTicketPackages(await getTeamPromos(t.id), isTicketPackagePromo, t.league);', '      const promos = await getTeamPromos(t.id);', [T_R1]],
  ['the rivals block switched on for NHL/NBA', PAGE, '  const rivals = isSplitSeasonLeague(team.league) ? [] : getDivisionRivals(team, gameContexts);', '  const rivals = getDivisionRivals(team, gameContexts);', [T_R1]],
  ['"still playing" counts another season\'s games', LIST, '        c.game.date >= today &&\n        splitSeasonStartYear(c.game.date) === SPLIT_SEASON_START_YEAR,', '        c.game.date >= today,', [T_R1]],
  ['an unplaceable archive row dropped', LABEL, '    if (y === null) {\n      unplaced.push(i);\n      return;\n    }', '    if (y === null) return;', [T_R1]],
];

const run = (files) =>
  spawnSync('node', ['--import', 'tsx', '--experimental-test-module-mocks', '--test', ...files], {
    cwd: WORK,
    env: { ...process.env, TSX_TSCONFIG_PATH: 'tsconfig.test.json' },
    encoding: 'utf-8',
    timeout: 120000,
  });

const base = run([T_LEAGUE, T_SCOPE, T_RENDER, T_GAMES, T_BYTES, T_MONTHS, T_PKG, T_PKG_DATA, T_R1]);
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
