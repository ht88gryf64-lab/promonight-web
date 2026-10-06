// The mutation harness for the WEB6 G2 site-wide honesty pass (2026-10-05):
// special-ticket rows off every cross-team surface, NHL/NBA titles naming
// 2026-27, the playoffs year from data, and no empty-upcoming sentence under a
// "haven't announced" line. A guard counts only if removing it fails a test: each
// case edits one guard out of the source, runs the tests meant to catch it,
// and expects a failure.
//
// IT NEVER TOUCHES THIS TREE. Sources, scripts and configs are copied to a
// temporary directory (node_modules linked) and every mutation is made there.
//
//   node scripts/site-honesty-mutations.mjs
//
// Not part of `npm test` (it is slow). Same runner as
// scripts/schedule-months-mutations.mjs.
import { readFileSync, writeFileSync, mkdtempSync, cpSync, symlinkSync, rmSync, realpathSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';

const REPO = resolve(new URL('..', import.meta.url).pathname);
const WORK = mkdtempSync(join(tmpdir(), 'pn-site-honesty-mutations-'));
for (const f of ['src', 'scripts', 'tsconfig.json', 'tsconfig.test.json', 'package.json']) cpSync(join(REPO, f), join(WORK, f), { recursive: true });
symlinkSync(realpathSync(join(REPO, 'node_modules')), join(WORK, 'node_modules'));
process.on('exit', () => rmSync(WORK, { recursive: true, force: true }));

const DATA = 'src/lib/data.ts';
const HUB = 'src/lib/venue-hub.ts';
const FEED = 'src/lib/social-feed/feed.ts';
const MYT = 'src/app/api/my-teams/promos/route.ts';
const TITLE = 'src/lib/title-treatment.ts';
const PLAYOFF = 'src/components/playoff-section.tsx';
const ANN = 'src/lib/announcement-status.ts';
const PAGE = 'src/components/redesign/RedesignTeamPage.tsx';
const LIST = 'src/components/promo-list.tsx';

const T_SITE = 'src/lib/__tests__/site-wide-packages.test.ts';
const T_G2 = 'src/components/redesign/__tests__/web6-g2-render.test.tsx';
const T_BYTES = 'src/components/redesign/__tests__/mlb-nfl-byte-identity.test.tsx';

/** [name, file, from, to, tests]. `from` must occur exactly once. */
const CASES = [
  // ---- (a) special-ticket rows off every cross-team surface ----
  ['package rows kept by the shared drop', DATA, '  return rows.filter((p) => !(isTicketPackageLeague(p.team.league) && ticketPackageRows.has(p)));', '  return rows;', [T_SITE]],
  ['the raw MLB flag dropped too', DATA, '  return rows.filter((p) => !(isTicketPackageLeague(p.team.league) && ticketPackageRows.has(p)));', '  return rows.filter((p) => !ticketPackageRows.has(p));', [T_SITE]],
  ['cross-team rows never noted as packages', DATA, '  if (isTicketPackageDoc(doc.data())) ticketPackageRows.add(row);\n  return row;', '  return row;', [T_SITE]],
  ['the daily board lists packages', DATA, '    return dropTicketPackageRows(dedupePromos(results.filter(isVisiblePromo), (p) => p.team.id));\n  } catch {\n    const all: PromoWithTeam[] = [];', '    return dedupePromos(results.filter(isVisiblePromo), (p) => p.team.id);\n  } catch {\n    const all: PromoWithTeam[] = [];', [T_SITE]],
  ['highlighted promos list packages', DATA, '    return dropTicketPackageRows(dedupePromos(results.filter(isVisiblePromo), (p) => p.team.id));\n  } catch {\n    // Fallback: sample', '    return dedupePromos(results.filter(isVisiblePromo), (p) => p.team.id);\n  } catch {\n    // Fallback: sample', [T_SITE]],
  ['the venue hub scroller lists packages', HUB, '      const { promos } = partitionTicketPackages(allPromos, isTicketPackagePromo, team.league);', '      const promos = allPromos;', [T_SITE]],
  ['the social feed selects packages', FEED, '(p) => p.teamId).filter((p) => !feedPackages.has(p));', '(p) => p.teamId);', [T_SITE]],
  ['an image card for a package', FEED, '      if (isTicketPackageLeague((await getTeamBySlug(teamId))?.league)) {', '      if (false) {', [T_SITE]],
  ['My Teams counts packages', MYT, '      .filter((doc) => !(dropPackages && isTicketPackageDoc(doc.data())))\n', '', [T_SITE]],
  ['My Teams drops raw MLB flags', MYT, '    const dropPackages = isTicketPackageLeague(league);', '    const dropPackages = true;', [T_SITE]],
  ['the daily board fallback lists packages', DATA, '    return dropTicketPackageRows(dedupePromos(all.filter(isVisiblePromo), (p) => p.team.id));', '    return dedupePromos(all.filter(isVisiblePromo), (p) => p.team.id);', [T_SITE]],
  ['the range/from-date fallbacks list packages', DATA, '    allPromos.sort((a, b) => a.date.localeCompare(b.date));\n    return dropTicketPackageRows(dedupePromos(allPromos.filter(isVisiblePromo), (p) => p.team.id));\n  }\n}\n\n// Returns every promo across all teams from', '    allPromos.sort((a, b) => a.date.localeCompare(b.date));\n    return dedupePromos(allPromos.filter(isVisiblePromo), (p) => p.team.id);\n  }\n}\n\n// Returns every promo across all teams from', [T_SITE]],
  ['the highlighted fallback lists packages', DATA, '    return dropTicketPackageRows(dedupePromos(allHighlighted.filter(isVisiblePromo), (p) => p.team.id)).slice(0, limit);', '    return dedupePromos(allHighlighted.filter(isVisiblePromo), (p) => p.team.id).slice(0, limit);', [T_SITE]],
  ['drop before dedupe (the unflagged twin shows)', DATA, '      if (team) {\n        results.push(promoWithTeam(doc, team));\n      }\n    }\n    return dropTicketPackageRows(dedupePromos(results.filter(isVisiblePromo), (p) => p.team.id));\n  } catch {\n    const allPromos: PromoWithTeam[] = [];\n    await Promise.all(\n      teams.map(async (team) => {\n        const snapshot = await db\n          .collection(\'teams\')\n          .doc(team.id)\n          .collection(\'promos\')\n          .where(\'date\', \'>=\', startDate)\n          .where(\'date\', \'<=\', endDate)', '      if (team) {\n        results.push(promoWithTeam(doc, team));\n      }\n    }\n    return dedupePromos(dropTicketPackageRows(results.filter(isVisiblePromo)), (p) => p.team.id);\n  } catch {\n    const allPromos: PromoWithTeam[] = [];\n    await Promise.all(\n      teams.map(async (team) => {\n        const snapshot = await db\n          .collection(\'teams\')\n          .doc(team.id)\n          .collection(\'promos\')\n          .where(\'date\', \'>=\', startDate)\n          .where(\'date\', \'<=\', endDate)', [T_SITE]],
  ['the feed drops raw MLB flags', FEED, '    if (isTicketPackageLeague(team.league) && isTicketPackageDoc(doc.data())) feedPackages.add(row);', '    if (isTicketPackageDoc(doc.data())) feedPackages.add(row);', [T_SITE]],
  ['My Teams shows the unflagged twin of a package', MYT, '    return (dropPackages ? dedupeDocsLikeTeamPage(visible) : visible)', '    return visible', [T_SITE]],
  ['highlighted promos skip the dedupe', DATA, '    return dropTicketPackageRows(dedupePromos(results.filter(isVisiblePromo), (p) => p.team.id));\n  } catch {\n    // Fallback: sample', '    return dropTicketPackageRows(results.filter(isVisiblePromo));\n  } catch {\n    // Fallback: sample', [T_SITE]],
  ['My Teams fails open when the cached team lookup misses', MYT, "    const league = team ? team.league : String((await db.collection('teams').doc(teamSlug).get()).data()?.league ?? '');", "    const league = team ? team.league : '';", [T_SITE]],
  ['an image card for the unflagged twin of a package', FEED, '        if (winner && isTicketPackageDoc(winner.data())) return null;\n', '', [T_SITE]],
  // ---- (b) titles and the playoffs year ----
  ['NHL/NBA titles name the calendar year', TITLE, '  return currentSeasonLabel(team.league);', '  return String(TITLE_SEASON_YEAR);', [T_G2]],
  ['every title names the split season', TITLE, '  return currentSeasonLabel(team.league);', "  return currentSeasonLabel('NHL');", [T_G2, T_BYTES]],
  ['the playoffs year back to a constant', PLAYOFF, "  const yearPrefix = year ? `${year} ` : '';", "  const yearPrefix = '2026 ';", [T_G2]],
  ['the playoffs year from the earliest promo', PLAYOFF, '  if (years.length) return Math.max(...years);', '  if (years.length) return Math.min(...years);', [T_G2]],
  // ---- (c) the empty-upcoming sentence ----
  ['"No upcoming ... right now" under "haven\'t announced"', PAGE, '          {...(nothingAnnounced ? { afterNothingAnnounced: true } : {})}\n', '', [T_G2]],
  ['the sentence dropped on every page', LIST, '              {afterNothingAnnounced ? (', '              {true ? (', [T_G2, T_BYTES]],
  ['the signal ignores ticket packages', ANN, '  return scheduleStatusLine(opts) !== null && nothingPublishedVerified(opts.teamId, opts.today) && !opts.hasTicketPackages;', '  return scheduleStatusLine(opts) !== null && nothingPublishedVerified(opts.teamId, opts.today);', [T_G2]],
];

const run = (files) =>
  spawnSync('node', ['--import', 'tsx', '--experimental-test-module-mocks', '--test', ...files], {
    cwd: WORK,
    env: { ...process.env, TSX_TSCONFIG_PATH: 'tsconfig.test.json' },
    encoding: 'utf-8',
    timeout: 120000,
  });

const base = run([T_SITE, T_G2, T_BYTES]);
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
