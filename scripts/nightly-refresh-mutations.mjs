// The mutation harness for WEB6 G4 (2026-10-06): the nightly refresh after
// Eastern midnight. Each case breaks one guard (the schedule, the window, the
// path list, the shared fan-out, the warm-up, the auth) and expects a test to
// fail.
//
// IT NEVER TOUCHES THIS TREE. Sources, scripts and configs are copied to a
// temporary directory (node_modules linked) and every mutation is made there.
//
//   node scripts/nightly-refresh-mutations.mjs
//
// Not part of `npm test` (it is slow). Same runner as
// scripts/today-boundary-mutations.mjs.
import { readFileSync, writeFileSync, mkdtempSync, cpSync, symlinkSync, rmSync, realpathSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';

const REPO = resolve(new URL('..', import.meta.url).pathname);
const WORK = mkdtempSync(join(tmpdir(), 'pn-nightly-refresh-mutations-'));
for (const f of ['src', 'scripts', 'tsconfig.json', 'tsconfig.test.json', 'package.json', 'vercel.json']) cpSync(join(REPO, f), join(WORK, f), { recursive: true });
symlinkSync(realpathSync(join(REPO, 'node_modules')), join(WORK, 'node_modules'));
process.on('exit', () => rmSync(WORK, { recursive: true, force: true }));

const LIB = 'src/lib/nightly-refresh.ts';
const ROUTE = 'src/app/api/cron/nightly-refresh/route.ts';
const FANOUT = 'src/lib/revalidate-paths.ts';
const ENDPOINT = 'src/app/api/revalidate/route.ts';
const T = 'src/lib/__tests__/nightly-refresh.test.ts';

/** [name, file, from, to, tests]. `from` must occur exactly once. */
const CASES = [
  // ---- when ----
  ['only the EDT firing (winter nights missed)', 'vercel.json', '"schedule": "15 4,5 * * *"', '"schedule": "15 4 * * *"', [T]],
  ['only the EST firing (summer nights missed)', 'vercel.json', '"schedule": "15 4,5 * * *"', '"schedule": "15 5 * * *"', [T]],
  ['a fixed UTC hour with no window check (runs twice or an hour late)', ROUTE, '  if (!isNightlyRefreshWindow(now)) {', '  if (false) {', [T]],
  ['the window on the UTC hour', LIB, '  return siteHour(instant) === 0;', '  return instant.getUTCHours() === 4 || instant.getUTCHours() === 5;', [T]],
  ['the window on the Chicago hour', LIB, "const SITE_HOUR = new Intl.DateTimeFormat('en-US', { timeZone: SITE_TIME_ZONE, hour: '2-digit', hourCycle: 'h23' });", "const SITE_HOUR = new Intl.DateTimeFormat('en-US', { timeZone: 'America/Chicago', hour: '2-digit', hourCycle: 'h23' });", [T]],
  ['the window an hour wide too many (00:00 or 01:00)', LIB, '  return siteHour(instant) === 0;', '  return siteHour(instant) <= 1;', [T]],
  // ---- what ----
  ['venue hubs left out', LIB, "    ...hubs.map((slug) => `/venues/${slug}`),\n", '', [T]],
  ['team pages left out', LIB, '    ...teams.map((t) => `/${t.sportSlug}/${t.id}`),\n', '', [T]],
  ['/promos/today left out', LIB, "  '/promos/today',\n", '', [T]],
  ['/nhl left out', LIB, "  '/nhl',\n", '', [T]],
  ['an invalid slug sent to the fan-out', LIB, '    if (seen.has(p) || !PATH_RE.test(p)) continue;', '    if (seen.has(p)) continue;', [T]],
  ['no dedupe', LIB, '    if (seen.has(p) || !PATH_RE.test(p)) continue;', '    if (!PATH_RE.test(p)) continue;', [T]],
  // ---- how ----
  ['revalidate but never warm', ROUTE, '  const warmed = await warmPaths(new URL(request.url).origin, paths);', '  const warmed = { ok: paths.length, failed: [] as { path: string; status: number }[] };', [T]],
  ['warm only the first path of each worker', LIB, '    while (next < paths.length) {', '    if (next < paths.length) {', [T]],
  ['a private revalidatePath loop beside the fan-out', ROUTE, "  const revalidated = revalidatePaths(paths, undefined, 'cron:nightly-refresh');", "  const { revalidatePath } = await import('next/cache');\n  for (const p of paths) revalidatePath(p);\n  const revalidated = { succeeded: paths.length, failed: [] as string[] };", [T]],
  ['one failing path aborts the whole fan-out', FANOUT, '      failed.push(p);', '      throw err;', [T]],
  ['the endpoint keeps its own loop', ENDPOINT, '  const { succeeded } = revalidatePaths(paths);', "  let succeeded = 0;\n  for (const p of paths) { (await import('next/cache')).revalidatePath(p); succeeded++; }", [T]],
  ['the endpoint accepts the bare root', FANOUT, 'export const PATH_RE = /^\\/[a-z0-9-]+(?:\\/[a-z0-9-]+){0,2}$/;', 'export const PATH_RE = /^\\/(?:[a-z0-9-]+(?:\\/[a-z0-9-]+){0,2})?$/;', [T]],
  // ---- auth ----
  ['no auth', ROUTE, "  if (request.headers.get('authorization') !== `Bearer ${secret}`) {", '  if (false) {', [T]],
  ['open when the secret is unset', ROUTE, '  if (!secret) {\n    return NextResponse.json({ ok: false, reason: \'not_configured\' }, { status: 503 });\n  }', '', [T]],
];

const run = (files) =>
  spawnSync('node', ['--import', 'tsx', '--experimental-test-module-mocks', '--test', ...files], {
    cwd: WORK,
    env: { ...process.env, TSX_TSCONFIG_PATH: 'tsconfig.test.json' },
    encoding: 'utf-8',
    timeout: 120000,
  });

const base = run([T]);
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
