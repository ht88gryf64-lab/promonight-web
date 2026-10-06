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
  ['an invalid slug sent to the fan-out', LIB, '    if (!PATH_RE.test(p)) {\n      dropped++;\n      continue;\n    }', '', [T]],
  ['no dedupe', LIB, '    if (seen.has(p)) continue;\n    if (!PATH_RE.test(p)) {', '    if (!PATH_RE.test(p)) {', [T]],
  // ---- how ----
  ['revalidate but never warm', ROUTE, '  const warmed = await warmPaths(origin, paths, { deadline });', '  const warmed = { ok: paths.length, failed: [] as { path: string; status: number | string }[] };', [T]],
  ['warm before revalidating (the old copies come back)', ROUTE, '  const revalidated = await revalidateViaFanOut(origin, paths, fanOutSecret);\n  await sleep(SETTLE_MS);\n  const warmed = await warmPaths(origin, paths, { deadline });', '  const warmed = await warmPaths(origin, paths, { deadline });\n  const revalidated = await revalidateViaFanOut(origin, paths, fanOutSecret);\n  await sleep(SETTLE_MS);', [T]],
  ['batches above the endpoint cap (every batch rejected)', LIB, 'export const FANOUT_BATCH = 100;', 'export const FANOUT_BATCH = 101;', [T]],
  ['the first failed batch stops the rest', LIB, '        result.failedBatches.push({ first: batch[0], status: res.status });\n        continue;', '        return result;', [T]],
  ['a short batch counts as complete', LIB, '      if (body.ok && body.revalidated === batch.length) result.revalidated += batch.length;', '      if (body.ok) result.revalidated += batch.length;', [T]],
  // ---- review round 1: the production origin and honest reporting ----
  ['the origin from the incoming request (the login-protected deployment host)', LIB, "  return vercelEnv === 'production' ? SITE_ORIGIN : new URL(requestUrl).origin;", '  return new URL(requestUrl).origin;', [T]],
  ['the warm-up follows redirects (login page counted as warmed)', LIB, "          redirect: 'manual',\n          signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),\n          headers: { 'user-agent': REFRESH_USER_AGENT },", "          signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),\n          headers: { 'user-agent': REFRESH_USER_AGENT },", [T]],
  ['a 3xx counted as warmed', LIB, '        if (res.status !== 200) {\n          result.failed.push({ path, status: res.status });', '        if (res.status >= 400) {\n          result.failed.push({ path, status: res.status });', [T]],
  ['the warm-up counted as human page loads', LIB, "export const REFRESH_USER_AGENT = 'PromoNightRefreshBot/1.0';", "export const REFRESH_USER_AGENT = 'PromoNightRefresh/1.0';", [T]],
  ['ok and 200 when nothing landed', ROUTE, '    revalidated.failedBatches.length === 0 &&\n    revalidated.revalidated === paths.length &&', '    true &&', [T]],
  ['ok while a page is still stale on the second pass', ROUTE, '    verified.fresh === paths.length;', '    true;', [T]],
  ['red on a first-pass timeout that rendered anyway', ROUTE, '    verified.failed.length === 0 &&', '    verified.failed.length === 0 && warmed.failed.length === 0 &&', [T]],
  ['the slow cross-team pages warmed last', LIB, '  const all = [\n    ...NIGHTLY_FIXED_PATHS,\n    ...teams.map((t) => `/${t.sportSlug}/${t.id}`),\n    ...hubs.map((slug) => `/venues/${slug}`),\n  ];', '  const all = [\n    ...teams.map((t) => `/${t.sportSlug}/${t.id}`),\n    ...hubs.map((slug) => `/venues/${slug}`),\n    ...NIGHTLY_FIXED_PATHS,\n  ];', [T]],
  ['a STALE copy counted as fresh', LIB, "        if (state !== 'STALE' && youngEnough) result.fresh++;", '        if (youngEnough) result.fresh++;', [T]],
  ['an old cached copy counted as fresh', LIB, "        const youngEnough = opts.freshSince === undefined || age === null || Number(age) * 1000 <= now() - opts.freshSince;", '        const youngEnough = true;', [T]],
  ['no deadline (the run can outlive maxDuration)', LIB, '      if (opts.deadline !== undefined && now() > opts.deadline) {', '      if (false) {', [T]],
  ['/best-promos left out', LIB, "  '/best-promos',\n", '', [T]],
  ['runs without the fan-out secret', ROUTE, "  if (!fanOutSecret) {\n    return NextResponse.json({ ok: false, reason: 'fanout_not_configured' }, { status: 503 });\n  }", '', [T]],
  ['warm only the first path of each worker', LIB, '    while (next < paths.length) {', '    if (next < paths.length) {', [T]],
  ['revalidating inside the cron request (applies too late to warm)', ROUTE, '  const revalidated = await revalidateViaFanOut(origin, paths, fanOutSecret);', "  const { revalidatePath } = await import('next/cache');\n  for (const p of paths) revalidatePath(p);\n  const revalidated = { revalidated: paths.length, failedBatches: [] as { first: string; status: number | string }[] };", [T]],
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
