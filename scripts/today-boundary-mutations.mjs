// The mutation harness for WEB6 G3 (2026-10-06): one "today" site-wide, on the
// site's Eastern day (src/lib/site-today.ts), and "Promos tracked" without
// ticket packages. A guard counts only if removing it fails a test: each case
// puts one other day back (UTC, Chicago, the server's or the device's local
// day) or one package back into the count, runs the tests meant to catch it,
// and expects a failure.
//
// IT NEVER TOUCHES THIS TREE. Sources, scripts and configs are copied to a
// temporary directory (node_modules linked) and every mutation is made there.
//
//   node scripts/today-boundary-mutations.mjs
//
// Not part of `npm test` (it is slow). Same runner as
// scripts/site-honesty-mutations.mjs.
import { readFileSync, writeFileSync, mkdtempSync, cpSync, symlinkSync, rmSync, realpathSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';

const REPO = resolve(new URL('..', import.meta.url).pathname);
const WORK = mkdtempSync(join(tmpdir(), 'pn-today-boundary-mutations-'));
for (const f of ['src', 'scripts', 'tsconfig.json', 'tsconfig.test.json', 'package.json', 'vercel.json']) cpSync(join(REPO, f), join(WORK, f), { recursive: true });
symlinkSync(realpathSync(join(REPO, 'node_modules')), join(WORK, 'node_modules'));
process.on('exit', () => rmSync(WORK, { recursive: true, force: true }));

const SITE = 'src/lib/site-today.ts';
const HELPERS = 'src/lib/promo-helpers.ts';
const ROUTE = 'src/app/[sport]/[team]/page.tsx';
const DATA = 'src/lib/data.ts';
const HUB = 'src/lib/venue-hub.ts';
const GRID = 'src/components/redesign/CalendarGrid.tsx';
const LEGACY_CAL = 'src/components/team-calendar.tsx';
const MYT = 'src/components/my-teams-view.tsx';
const HOME = 'src/app/page.tsx';
const THEME = 'src/app/promos/theme-nights/page.tsx';
const BEST = 'src/app/best-promos/page.tsx';
const FEED = 'src/lib/social-feed/select.ts';
const CFB = 'src/lib/cfb/clock.ts';
const EBAY = 'src/components/affiliates/EbayResaleLink.tsx';
const HUBRAIL = 'src/components/hub/HubThisWeek.tsx';

const T_TODAY = 'src/lib/__tests__/today-boundary.test.ts';
const T_CAL = 'src/lib/__tests__/calendar-today-prop.test.ts';
const T_FEED = 'src/lib/social-feed/__tests__/select.test.ts';

const UTC_DAY = "new Date().toISOString().slice(0, 10)";
const CHICAGO_DAY = "new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Chicago' }).format(new Date())";
const DEVICE_DAY = "(() => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`; })()";

/** [name, file, from, to, tests]. `from` must occur exactly once. */
const CASES = [
  // ---- the one module ----
  ['the site zone is Chicago', SITE, "export const SITE_TIME_ZONE = 'America/New_York';", "export const SITE_TIME_ZONE = 'America/Chicago';", [T_TODAY]],
  ['the site zone is UTC', SITE, "export const SITE_TIME_ZONE = 'America/New_York';", "export const SITE_TIME_ZONE = 'UTC';", [T_TODAY]],
  ['day math off by one across a month', SITE, '  const dt = new Date(Date.UTC(y, m - 1, d + days));', '  const dt = new Date(Date.UTC(y, m - 1, d + days - 1));', [T_TODAY]],
  // ---- team pages: the hydration-safe todayStr path ----
  ['a UTC boundary sneaks back into todayYmd', HELPERS, '  return siteTodayYmd();', `  return ${UTC_DAY};`, [T_TODAY]],
  ['the route metadata cuts on the UTC day', ROUTE, '  const todayStr = todayYmd();\n  // The snippet', `  const todayStr = ${UTC_DAY};\n  // The snippet`, [T_TODAY]],
  ['the calendar ring reads the device day', GRID, '    setVisitorTodayKey(siteTodayYmd());', `    setVisitorTodayKey(${DEVICE_DAY});`, [T_CAL, T_TODAY]],
  ['the legacy calendar ring reads the device day', LEGACY_CAL, '    setVisitorTodayKey(siteTodayYmd());', `    setVisitorTodayKey(${DEVICE_DAY});`, [T_CAL, T_TODAY]],
  ['the ring read moves into render (hydration #418)', GRID, '  const ringKey = visitorTodayKey ?? todayKey;', '  const ringKey = siteTodayYmd();', [T_CAL]],
  // ---- hubs ----
  ['the hub day is Chicago again', DATA, '  return siteTodayYmd();\n}', `  return ${CHICAGO_DAY};\n}`, [T_TODAY]],
  ['the /nhl card counts on the UTC day', DATA, '    const today = hubTodayYMD();\n    const dropPackages', `    const today = ${UTC_DAY};\n    const dropPackages`, [T_TODAY]],
  ['the arena hub window starts on the UTC day', HUB, '  const start = promoBoardYMD(0);', `  const start = ${UTC_DAY};`, [T_TODAY]],
  ['the hub rail reads the Chicago day', HUBRAIL, '  const today = siteTodayYmd();', `  const today = ${CHICAGO_DAY};`, [T_TODAY]],
  // ---- aggregators and the homepage ----
  ['the daily board is on the UTC day', DATA, '  return siteTodayPlusDays(offsetDays);', `  return offsetDays ? ${UTC_DAY} : ${UTC_DAY};`, [T_TODAY]],
  ['the homepage is on the Chicago day', HOME, '  const today = siteTodayYmd();', `  const today = ${CHICAGO_DAY};`, [T_TODAY]],
  ['/promos/theme-nights is on the server day', THEME, '  return siteTodayYmd();', "  const d = new Date();\n  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;", [T_TODAY]],
  ['/best-promos is on the server day', BEST, '  return siteYmd(d);', "  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;", [T_TODAY]],
  ['playoff promo days on the Chicago day', DATA, '  return siteYmd(new Date(iso));', "  return new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Chicago' }).format(new Date(iso));", [T_TODAY]],
  ['the social feed window is on the Chicago day', FEED, '  const start = siteYmd(now);', "  const start = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Chicago' }).format(now);", [T_FEED, T_TODAY]],
  ['the CFB anchor is Chicago again', CFB, '  return siteTodayYmd();', "  return todayYMD('America/Chicago');", [T_TODAY]],
  ['the eBay resale guard cuts on the UTC day', EBAY, '  if (promo.date >= siteTodayYmd()) return null;', `  if (promo.date >= ${UTC_DAY}) return null;`, [T_TODAY]],
  // ---- review round 1: evasions the first guard missed ----
  ['the promo list (the anchors) cuts on a UTC day held in a variable', 'src/components/promo-list.tsx', '  const today = todayProp ?? todayYmd();', '  const now = new Date();\n  const today = now.toISOString().slice(0, 10);', [T_TODAY]],
  ['the promo list ignores the page\'s todayStr', 'src/components/promo-list.tsx', '  const today = todayProp ?? todayYmd();', '  const today = todayYmd();', [T_TODAY]],
  ['the route stops passing todayStr to the promo list', ROUTE, '          today={todayStr}\n          scopeLive', '          scopeLive', [T_TODAY, T_CAL]],
  ['the redesign stops passing today to the promo list', 'src/components/redesign/RedesignTeamPage.tsx', '          league={team.league}\n          today={today}\n          promos={promos}', '          league={team.league}\n          promos={promos}', [T_TODAY]],
  ['the homepage on the server day via toLocaleDateString', HOME, '  const today = siteTodayYmd();', "  const today = new Date().toLocaleDateString('en-CA');", [T_TODAY]],
  ['the calendar reads the clock in render via a lazy useState', GRID, '  const [visitorTodayKey, setVisitorTodayKey] = useState<string | null>(null);', '  const [visitorTodayKey, setVisitorTodayKey] = useState<string | null>(siteTodayYmd);', [T_CAL]],
  ['the digest window on the server day', 'src/lib/digest.ts', '  const start = siteYmd(now);', "  const start = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;", [T_TODAY]],
  // ---- review round 2: other spellings, caught by the ratchet ----
  ['E2: the homepage on the server day via sv-SE', HOME, '  const today = siteTodayYmd();', "  const today = new Date().toLocaleDateString('sv-SE');", [T_TODAY]],
  ['E3: theme-nights on the UTC day via Date.now()', THEME, '  return siteTodayYmd();', '  return new Date(Date.now()).toISOString().slice(0, 10);', [T_TODAY]],
  ['E4: the homepage on the UTC day via getUTC*', HOME, '  const today = siteTodayYmd();', "  const n = new Date();\n  const today = `${n.getUTCFullYear()}-${String(n.getUTCMonth() + 1).padStart(2, '0')}-${String(n.getUTCDate()).padStart(2, '0')}`;", [T_TODAY]],
  ['E5: the eBay guard on the UTC day via toJSON', EBAY, '  if (promo.date >= siteTodayYmd()) return null;', '  if (promo.date >= new Date().toJSON().slice(0, 10)) return null;', [T_TODAY]],
  ['E6: the hub rail on the Pacific day', HUBRAIL, '  const today = siteTodayYmd();', "  const today = new Intl.DateTimeFormat('sv-SE', { timeZone: 'America/Los_Angeles' }).format(new Date());", [T_TODAY]],
  ['E7: this-week on the UTC day, double quotes', 'src/app/promos/this-week/page.tsx', '  return siteTodayYmd();', '  return new Date().toISOString().split("T")[0];', [T_TODAY]],
  ['N4: My Teams on the device day via sv-SE', MYT, '  const todayYMD = useMemo(() => siteTodayYmd(), []);', "  const todayYMD = useMemo(() => new Date().toLocaleDateString('sv-SE'), []);", [T_TODAY]],
  // ---- My Teams ----
  ['My Teams reads the device day', MYT, '  const todayYMD = useMemo(() => siteTodayYmd(), []);', `  const todayYMD = useMemo(() => ${DEVICE_DAY}, []);`, [T_TODAY]],
  // ---- the post-midnight refresh ----
  ['the daily refresh fires before Eastern midnight in winter', 'vercel.json', '"schedule": "10 5 * * *"', '"schedule": "10 4 * * *"', [T_TODAY]],
  // ---- (a) Promos tracked ----
  ['"Promos tracked" counts ticket packages', DATA, '  return total.data().count - packages.reduce((n, s) => n + s.data().count, 0);', '  return total.data().count;', [T_TODAY]],
  ['"Promos tracked" subtracts the raw MLB flag', DATA, '  const packageClubs = teams.filter((t) => isTicketPackageLeague(t.league));', '  const packageClubs = teams;', [T_TODAY]],
];

const run = (files) =>
  spawnSync('node', ['--import', 'tsx', '--experimental-test-module-mocks', '--test', ...files], {
    cwd: WORK,
    env: { ...process.env, TSX_TSCONFIG_PATH: 'tsconfig.test.json' },
    encoding: 'utf-8',
    timeout: 120000,
  });

const base = run([T_TODAY, T_CAL, T_FEED]);
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
