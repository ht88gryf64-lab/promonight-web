// The nightly refresh after Eastern midnight (WEB6 G4).
//
// Pins: the cron fires so that exactly one firing acts on every Eastern night
// of a year, both DST change nights included, at 00:15 Eastern; the path list
// is every team page, every venue hub, the league hubs, /teams and the /promos
// pages, all through the shared fan-out's path pattern; the route authenticates,
// skips outside the window, and inside it revalidates and then warms every path.
//
// Run with: node --import tsx --experimental-test-module-mocks --test <this file>
import { test, mock } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

process.env.TZ = 'UTC';
process.env.NIGHTLY_REFRESH_SETTLE_MS = '0';
process.env.NIGHTLY_REFRESH_VERIFY_MS = '0';
process.env.NIGHTLY_REFRESH_ROUND_MS = '0';
mock.timers.enable({ apis: ['Date'], now: new Date('2026-10-07T04:15:00Z') });

const revalidated: string[] = [];
mock.module('next/cache', { namedExports: { revalidatePath: (p: string) => { revalidated.push(p); } } });
mock.module('server-only', { namedExports: {} });
const TEAMS = [
  { id: 'pittsburgh-penguins', sportSlug: 'nhl' },
  { id: 'golden-state-warriors', sportSlug: 'nba' },
  { id: 'minnesota-twins', sportSlug: 'mlb' },
];
const HUBS = ['ppg-paints-arena', 'chase-center', 'target-field', 'Bad_Slug'];
// What the route's venue-hub loader returns; the route test sets it.
let routeHubs: string[] = ['ppg-paints-arena', 'chase-center', 'target-field'];
mock.module(new URL('../data.ts', import.meta.url).href, { namedExports: { getAllTeams: async () => TEAMS } });
mock.module(new URL('../venue-hub.ts', import.meta.url).href, { namedExports: { getAllVenueHubSlugs: async () => routeHubs } });

function cronSchedule(): { minute: number; hours: number[] } {
  const cfg = JSON.parse(readFileSync(new URL('../../../vercel.json', import.meta.url), 'utf8'));
  const c = cfg.crons.find((x: { path: string }) => x.path === '/api/cron/nightly-refresh');
  assert.ok(c, 'the nightly refresh is scheduled');
  const [m, h, ...rest] = c.schedule.split(' ');
  assert.deepEqual(rest, ['*', '*', '*'], 'every day');
  return { minute: Number(m), hours: h.split(',').map(Number) };
}

test('exactly one firing acts on every Eastern night for a year, DST nights included, at 00:15 Eastern', async () => {
  const { isNightlyRefreshWindow } = await import('../nightly-refresh');
  const { siteYmd } = await import('../site-today');
  const { minute, hours } = cronSchedule();
  const actedOn = new Map<string, number>();
  const start = Date.parse('2026-10-01T00:00:00Z');
  for (let d = 0; d < 366; d++) {
    for (const h of hours) {
      const t = new Date(start + d * 86_400_000 + h * 3_600_000 + minute * 60_000);
      if (!isNightlyRefreshWindow(t)) continue;
      const day = siteYmd(t);
      actedOn.set(day, (actedOn.get(day) ?? 0) + 1);
      const et = new Intl.DateTimeFormat('en-US', { timeZone: 'America/New_York', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).format(t);
      assert.equal(et, '00:15', `acts at ${et} Eastern on ${day}`);
    }
  }
  // Every Eastern date from Oct 2 2026 to Sep 30 2027 got exactly one run.
  for (let d = 1; d < 365; d++) {
    const day = new Date(start + d * 86_400_000).toISOString().slice(0, 10);
    assert.equal(actedOn.get(day), 1, `runs on ${day}`);
  }
  assert.equal(actedOn.get('2026-11-01'), 1, 'the fall-back night');
  assert.equal(actedOn.get('2027-03-14'), 1, 'the spring-forward night');
});

test('the window is the 00:00 hour Eastern and nothing else', async () => {
  const { isNightlyRefreshWindow, siteHour } = await import('../nightly-refresh');
  assert.equal(isNightlyRefreshWindow(new Date('2026-10-07T04:00:00Z')), true);
  assert.equal(isNightlyRefreshWindow(new Date('2026-10-07T04:59:59Z')), true);
  assert.equal(isNightlyRefreshWindow(new Date('2026-10-07T03:59:59Z')), false);
  assert.equal(isNightlyRefreshWindow(new Date('2026-10-07T05:15:00Z')), false, '01:15 EDT');
  assert.equal(isNightlyRefreshWindow(new Date('2026-12-02T04:15:00Z')), false, '23:15 EST');
  assert.equal(isNightlyRefreshWindow(new Date('2026-12-02T05:15:00Z')), true, '00:15 EST');
  assert.equal(siteHour(new Date('2026-10-07T00:00:00Z')), 20);
});

test('the paths: every team page, every venue hub, the hubs, /teams and the /promos pages, all valid fan-out paths', async () => {
  const { nightlyRefreshPaths, NIGHTLY_FIXED_PATHS } = await import('../nightly-refresh');
  const { PATH_RE } = await import('../revalidate-paths');
  const { paths, dropped } = await nightlyRefreshPaths({ teams: async () => [...TEAMS, TEAMS[0]], venueHubSlugs: async () => HUBS });
  assert.deepEqual(dropped, ['/venues/Bad_Slug'], 'reported, not silently lost');
  for (const t of TEAMS) assert.ok(paths.includes(`/${t.sportSlug}/${t.id}`), t.id);
  for (const h of HUBS.filter((h) => h !== 'Bad_Slug')) assert.ok(paths.includes(`/venues/${h}`), h);
  assert.ok(!paths.includes('/venues/Bad_Slug'), 'a slug the fan-out would reject is dropped, not sent');
  for (const p of ['/nhl', '/mlb', '/nfl', '/teams', '/promos/today', '/promos/this-week', '/promos/theme-nights', '/promos/food-deals', '/promos/bobbleheads', '/promos/jersey-giveaways', '/promos/soccer-jersey-nights']) {
    assert.ok(paths.includes(p), p);
  }
  assert.ok(!paths.includes('/'), 'the bare root is not a fan-out path');
  assert.equal(PATH_RE.test('/'), false, 'the fan-out still rejects the bare root, by ruling');
  assert.equal(new Set(paths).size, paths.length, 'deduped');
  assert.ok(paths.every((p) => PATH_RE.test(p)));
  assert.equal(paths.length, TEAMS.length + 3 + NIGHTLY_FIXED_PATHS.length);
  for (const p of ['/best-promos', '/best-promos/bobbleheads', '/team-rankings']) assert.ok(paths.includes(p), p);
  assert.deepEqual(paths.slice(0, NIGHTLY_FIXED_PATHS.length), [...NIGHTLY_FIXED_PATHS], 'the slow cross-team pages are warmed first');
});

test('the shared fan-out: one failing path is reported, the rest still revalidate', async () => {
  const { revalidatePaths } = await import('../revalidate-paths');
  const done: string[] = [];
  const r = revalidatePaths(['/a', '/b', '/c'], (p) => {
    if (p === '/b') throw new Error('nope');
    done.push(p);
  });
  assert.deepEqual(done, ['/a', '/c']);
  assert.equal(r.succeeded, 2);
  assert.deepEqual(r.failed, ['/b']);
});

const resp = (status: number, headers: Record<string, string> = {}, body = 'ok') => new Response(body, { status, headers });

test('warming requests every path once, records each answer, and counts redirects and errors as failures', async () => {
  const { warmPaths, REFRESH_USER_AGENT } = await import('../nightly-refresh');
  const seen: string[] = [];
  const r = await warmPaths('https://x.test', ['/a', '/b', '/c', '/d', '/e'], {
    concurrency: 2,
    fetcher: async (u, init) => {
      seen.push(u);
      assert.equal(init.redirect, 'manual', 'a redirect is never followed into a login page');
      assert.match(String((init.headers as Record<string, string>)['user-agent']), /bot/i, 'not counted as a human page load');
      if (u.endsWith('/c')) return resp(500);
      if (u.endsWith('/d')) throw new Error('boom');
      if (u.endsWith('/e')) return resp(307, { location: 'https://vercel.com/login' });
      return resp(200, { 'x-vercel-cache': u.endsWith('/a') ? 'REVALIDATED' : 'STALE' });
    },
  });
  assert.equal(REFRESH_USER_AGENT, 'PromoNightRefreshBot/1.0');
  assert.deepEqual(seen.sort(), ['/a', '/b', '/c', '/d', '/e'].map((p) => 'https://x.test' + p));
  assert.equal(r.ok, 2);
  assert.deepEqual(r.failed.map((f) => f.path).sort(), ['/c', '/d', '/e']);
  assert.deepEqual(r.states, { '/a': 'REVALIDATED', '/b': 'STALE', '/c': 'FAILED', '/d': 'FAILED', '/e': 'FAILED' });
});

test('freshness is judged from what the warm-up and verify requests answered, never from Age', async () => {
  const { warmTookRevalidation, verifyVerdict } = await import('../nightly-refresh');
  for (const s of ['MISS', 'REVALIDATED', 'STALE']) assert.equal(warmTookRevalidation(s), true, s);
  for (const s of ['HIT', 'PRERENDER', 'NONE']) assert.equal(warmTookRevalidation(s), false, `${s}: the old copy was still valid`);
  assert.equal(verifyVerdict('HIT'), 'fresh');
  assert.equal(verifyVerdict('REVALIDATED'), 'fresh');
  assert.equal(verifyVerdict('MISS'), 'fresh');
  assert.equal(verifyVerdict('STALE'), 'pending');
  assert.equal(verifyVerdict('PRERENDER'), 'failed');
  assert.equal(verifyVerdict('NONE'), 'failed');
  const lib = readFileSync(new URL('../nightly-refresh.ts', import.meta.url), 'utf8');
  assert.doesNotMatch(lib, /get\('age'\)/, 'Age is how long a copy sat in the CDN, not how old the render is');
});

test('verify: re-asks only the paths still regenerating, in rounds, and fails what cannot be fixed', async () => {
  const { verifyFresh } = await import('../nightly-refresh');
  const warm = { ok: 4, failed: [], cache: {}, skipped: 0, states: { '/a': 'MISS', '/b': 'STALE', '/c': 'HIT', '/d': 'FAILED', '/e': 'STALE' } };
  const asked: string[][] = [];
  let round = 0;
  const r = await verifyFresh('https://x.test', warm, ['/a', '/b', '/c', '/d', '/e'], {
    deadline: Date.now() + 60_000,
    roundDelayMs: 0,
    sleep: async () => { round++; },
    fetcher: async (u) => {
      const p = new URL(u).pathname;
      (asked[round] ??= []).push(p);
      if (p === '/b') return resp(200, { 'x-vercel-cache': round === 0 ? 'STALE' : 'HIT' });
      if (p === '/e') return resp(200, { 'x-vercel-cache': 'STALE' });
      return resp(200, { 'x-vercel-cache': 'HIT' });
    },
  });
  assert.deepEqual(asked[0].sort(), ['/a', '/b', '/d', '/e'], 'a warm HIT is never re-asked: the revalidation did not take');
  assert.deepEqual(asked[1].sort(), ['/b', '/e'], 'only the paths still regenerating');
  assert.equal(r.fresh, 3, '/a, /b after its regeneration, /d after its timeout');
  assert.deepEqual(r.notFresh.map((n) => n.path).sort(), ['/c', '/e']);
  assert.match(r.notFresh.find((n) => n.path === '/c')!.reason, /did not take/);
  assert.match(r.notFresh.find((n) => n.path === '/e')!.reason, /still regenerating/);
});

test('verify: a page answering non-200 twice fails with its status; no sleep starts past the deadline', async () => {
  const { verifyFresh } = await import('../nightly-refresh');
  const warm = { ok: 2, failed: [], cache: {}, skipped: 0, states: { '/broken': 'MISS', '/slow': 'STALE' } };
  let clock = 1_000_000;
  const slept: number[] = [];
  const r = await verifyFresh('https://x.test', warm, ['/broken', '/slow'], {
    deadline: clock + 50_000,
    roundDelayMs: 20_000,
    now: () => clock,
    sleep: async (ms) => { slept.push(clock); clock += ms; },
    fetcher: async (u) => (u.endsWith('/broken') ? resp(500) : resp(200, { 'x-vercel-cache': 'STALE' })),
  });
  const broken = r.notFresh.find((n) => n.path === '/broken')!;
  assert.match(broken.reason, /500 twice/, 'its status, not "still regenerating"');
  assert.equal(r.fresh, 0);
  assert.ok(slept.every((t) => t + 20_000 < 1_050_000), 'never sleeps across the deadline');
  assert.ok(clock <= 1_050_000, 'stops by the deadline');
  assert.match(r.notFresh.find((n) => n.path === '/slow')!.reason, /still regenerating/);
});

test('budgets: each pass stops in time, and a request never outlives its pass', async () => {
  const { MAX_DURATION_S, WARM_BUDGET_MS, VERIFY_BUDGET_MS, FETCH_TIMEOUT_MS, warmPaths } = await import('../nightly-refresh');
  const route = readFileSync(new URL('../../app/api/cron/nightly-refresh/route.ts', import.meta.url), 'utf8');
  assert.match(route, new RegExp(`export const maxDuration = ${MAX_DURATION_S};`));
  assert.match(route, /verifyFresh\(origin, warmed, paths, \{ deadline: started \+ VERIFY_BUDGET_MS/, 'verify runs on its own budget');
  assert.ok(MAX_DURATION_S <= 800, 'Vercel Pro with Fluid compute');
  assert.ok(WARM_BUDGET_MS < VERIFY_BUDGET_MS);
  assert.ok(VERIFY_BUDGET_MS + 30_000 < MAX_DURATION_S * 1000, 'room to answer after the last request is cut');
  const { SETTLE_MS, VERIFY_DELAY_MS, VERIFY_ROUND_MS } = await import('../nightly-refresh');
  assert.ok(SETTLE_MS >= 2_000 && VERIFY_DELAY_MS >= 5_000 && VERIFY_ROUND_MS >= 5_000, 'production waits are real waits');
  assert.match(route, /process\.env\.NIGHTLY_REFRESH_SETTLE_MS \?\? DEFAULT_SETTLE_MS/);
  assert.match(route, /process\.env\.NIGHTLY_REFRESH_VERIFY_MS \?\? DEFAULT_VERIFY_DELAY_MS/);
  assert.match(route, /process\.env\.NIGHTLY_REFRESH_ROUND_MS \?\? DEFAULT_VERIFY_ROUND_MS/);
  assert.match(route, /warmPaths\(origin, paths, \{ deadline: started \+ WARM_BUDGET_MS \}\)/, 'the warm pass has its deadline');
  assert.ok(FETCH_TIMEOUT_MS <= 60_000);
  // A request started near its pass's deadline is cut at the deadline, not at
  // the full per-request timeout.
  const t0 = performance.now();
  const r = await warmPaths('https://x.test', ['/slow'], {
    deadline: Date.now() + 50,
    fetcher: (_u, init) => new Promise((_res, rej) => init.signal!.addEventListener('abort', () => rej(new Error('aborted')))),
  });
  assert.equal(r.failed.length, 1);
  assert.ok(performance.now() - t0 < 5_000, 'cut at the deadline');
  // Past the deadline nothing new starts.
  const late = await warmPaths('https://x.test', ['/a', '/b'], { deadline: Date.now() - 1, fetcher: async () => resp(200) });
  assert.equal(late.skipped, 2);
  assert.equal(late.ok, 0);
});

test('the middleware does not count the job\'s own requests', async () => {
  const { isNightlyRefreshRequest, REFRESH_USER_AGENT } = await import('../refresh-agent');
  assert.equal(isNightlyRefreshRequest(REFRESH_USER_AGENT), true);
  assert.equal(isNightlyRefreshRequest('Mozilla/5.0'), false);
  assert.equal(isNightlyRefreshRequest(null), false);
  const mw = readFileSync(new URL('../../middleware.ts', import.meta.url), 'utf8');
  assert.match(mw, /if \(!isNightlyRefreshRequest\(userAgent\)\) countRequest\(request, event, userAgent\);/);
  assert.equal(mw.split('countRequest(request, event, userAgent)').length - 1, 1, 'no unguarded call');
});

test('the origin: always www in production (cron calls the login-protected deployment host), the request origin locally', async () => {
  const { refreshOrigin, SITE_ORIGIN } = await import('../nightly-refresh');
  assert.equal(SITE_ORIGIN, 'https://www.getpromonight.com');
  assert.equal(refreshOrigin('https://promonight-5ap8xjx4z-btj8tk69dk-7318s-projects.vercel.app/api/cron/nightly-refresh', 'production'), SITE_ORIGIN);
  assert.equal(refreshOrigin('http://localhost:3104/api/cron/nightly-refresh', undefined), 'http://localhost:3104');
});

test('the route: auth, the window, then revalidate through POST /api/revalidate on www, and only then warm and verify', async () => {
  const log: { method: string; url: string; paths?: string[] }[] = [];
  let mode: 'ok' | 'login' | 'slow-first' | 'stale' | 'fanout-down' | 'warm-hit' | 'race' = 'ok';
  let racePosted = false;
  let getCount = 0;
  const seenOnce = new Set<string>();
  const warmedOnce = new Set<string>();
  const realFetch = globalThis.fetch;
  globalThis.fetch = (async (u: string, init?: RequestInit) => {
    const method = init?.method ?? 'GET';
    if (mode === 'login') {
      log.push({ method, url: String(u) });
      return resp(307, { location: 'https://vercel.com/login' });
    }
    if (method === 'POST' && mode === 'fanout-down') {
      log.push({ method, url: String(u) });
      return resp(500);
    }
    if (method === 'POST') {
      assert.equal((init!.headers as Record<string, string>)['x-revalidate-secret'], 'r', 'the fan-out secret');
      const paths = JSON.parse(String(init!.body)).paths as string[];
      log.push({ method, url: String(u), paths });
      if (mode === 'race' && paths.length === 1 && paths[0] === '/nhl') racePosted = true;
      return new Response(JSON.stringify({ ok: true, revalidated: paths.length }), { status: 200 });
    }
    log.push({ method, url: String(u) });
    const path = new URL(String(u)).pathname;
    queueMicrotask(() => warmedOnce.add(path));
    if (mode === 'slow-first' && path === '/nhl' && !seenOnce.has(path)) {
      seenOnce.add(path);
      throw new Error('The operation was aborted due to timeout');
    }
    getCount++;
    if (mode === 'stale' && path === '/nhl') return resp(200, { 'x-vercel-cache': 'STALE' });
    if (mode === 'warm-hit' && path === '/nhl') return resp(200, { 'x-vercel-cache': 'HIT' });
    // Someone else regenerated /nhl before the warm-up: HIT until the job sends
    // it through the fan-out again, then a fresh render.
    if (mode === 'race' && path === '/nhl') return resp(200, { 'x-vercel-cache': racePosted ? 'REVALIDATED' : 'HIT' });
    // First request of a path renders it (MISS); later ones are cache HITs.
    return resp(200, { 'x-vercel-cache': warmedOnce.has(path) ? 'HIT' : 'MISS' });
  }) as typeof fetch;
  const DEPLOY = 'https://promonight-abc123-btj8tk69dk-7318s-projects.vercel.app/api/cron/nightly-refresh';
  try {
    const { GET } = await import('../../app/api/cron/nightly-refresh/route');
    const call = (auth?: string) => GET(new Request(DEPLOY, { headers: auth ? { authorization: auth } : {} }));

    delete process.env.CRON_SECRET;
    assert.equal((await call('Bearer s')).status, 503);
    process.env.CRON_SECRET = 's';
    assert.equal((await call()).status, 401);
    assert.equal((await call('Bearer wrong')).status, 401);
    delete process.env.REVALIDATE_SECRET;
    assert.equal((await call('Bearer s')).status, 503, 'no fan-out secret, no run');
    process.env.REVALIDATE_SECRET = 'r';
    process.env.VERCEL_ENV = 'production';

    // 04:15Z in October is 00:15 EDT: acts.
    mock.timers.setTime(Date.parse('2026-10-07T04:15:00Z'));
    log.length = 0;
    warmedOnce.clear();
    const res = await call('Bearer s');
    const body = await res.json();
    assert.equal(res.status, 200);
    const expected = TEAMS.length + 3 + 16;
    assert.equal(body.paths, expected);
    assert.equal(body.revalidated, expected);
    assert.equal(body.warmed, expected);
    assert.equal(body.fresh, expected);
    assert.equal(body.ok, true);
    assert.ok(log.every((e) => e.url.startsWith('https://www.getpromonight.com/')), 'every request goes to www, never the deployment host');
    const posts = log.filter((e) => e.method === 'POST');
    const gets = log.filter((e) => e.method === 'GET');
    assert.ok(posts.length >= 1 && posts.every((e) => e.url === 'https://www.getpromonight.com/api/revalidate'), 'through the existing endpoint');
    assert.ok(posts.every((e) => e.paths!.length <= 100), "within the endpoint's 100-path cap");
    const lastPost = log.map((e) => e.method).lastIndexOf('POST');
    const firstGet = log.map((e) => e.method).indexOf('GET');
    assert.ok(lastPost < firstGet, 'every invalidation is queued (its request completed) before anything is warmed');
    const posted = posts.flatMap((e) => e.paths!).sort();
    const warmedPaths = gets.map((e) => new URL(e.url).pathname).sort();
    assert.deepEqual(warmedPaths, [...posted, ...posted].sort(), 'every revalidated path is warmed, then verified once (all fresh)');
    assert.ok(posted.includes('/venues/ppg-paints-arena') && posted.includes('/nhl/pittsburgh-penguins') && posted.includes('/promos/today'));

    // The login page answers everything: red, not ok.
    mode = 'login';
    log.length = 0;
    const bad = await call('Bearer s');
    const badBody = await bad.json();
    assert.equal(bad.status, 500);
    assert.equal(badBody.ok, false);
    assert.equal(badBody.revalidated, 0);
    assert.equal(badBody.warmed, 0);
    // A first-pass timeout that rendered anyway: reported, not red.
    mode = 'slow-first';
    warmedOnce.clear();
    const slow = await call('Bearer s');
    const slowBody = await slow.json();
    assert.equal(slow.status, 200);
    assert.equal(slowBody.ok, true);
    assert.deepEqual(slowBody.warmFailed.map((f: { path: string }) => f.path), ['/nhl']);

    // The fan-out is down but every page still answers (old copies): red.
    mode = 'fanout-down';
    warmedOnce.clear();
    const down = await call('Bearer s');
    assert.equal(down.status, 500);
    assert.equal((await down.json()).revalidated, 0);

    // A revalidation that silently did not apply: the warm-up gets a HIT. Red.
    mode = 'warm-hit';
    warmedOnce.clear();
    const old = await call('Bearer s');
    const oldBody = await old.json();
    assert.equal(old.status, 500);
    assert.equal(oldBody.fresh, expected - 1);
    assert.match(oldBody.notFresh[0].reason, /did not take/);
    assert.equal(oldBody.retried, 1, 'asked once more through the fan-out before failing');

    // A venue slug the fan-out would reject: listed, and red.
    mode = 'ok';
    routeHubs = ['ppg-paints-arena', 'chase-center', 'target-field', 'Bad_Slug'];
    warmedOnce.clear();
    const withBad = await call('Bearer s');
    const withBadBody = await withBad.json();
    assert.equal(withBad.status, 500);
    assert.deepEqual(withBadBody.dropped, ['/venues/Bad_Slug']);
    routeHubs = ['ppg-paints-arena', 'chase-center', 'target-field'];

    // A visitor regenerated /nhl first: the job re-sends it once and stays green.
    mode = 'race';
    warmedOnce.clear();
    const race = await call('Bearer s');
    const raceBody = await race.json();
    assert.equal(race.status, 200);
    assert.equal(raceBody.retried, 1);
    assert.equal(raceBody.fresh, expected);
    assert.ok(racePosted, 'the ambiguous path went through the fan-out a second time');

    // A page that never finishes regenerating: re-asked in rounds, then red.
    mode = 'stale';
    warmedOnce.clear();
    const stale = await call('Bearer s');
    const staleBody = await stale.json();
    assert.equal(stale.status, 500);
    assert.equal(staleBody.fresh, expected - 1);
    assert.ok(staleBody.verifyRounds > 1, 'asked again before giving up');
    mode = 'ok';

    // 05:15Z in October is 01:15 EDT: the other firing, skipped.
    mock.timers.setTime(Date.parse('2026-10-07T05:15:00Z'));
    log.length = 0;
    const skip = await (await call('Bearer s')).json();
    assert.equal(skip.skipped, 'outside_window');
    assert.equal(log.length, 0);
  } finally {
    globalThis.fetch = realFetch;
    delete process.env.VERCEL_ENV;
  }
});

test('the fan-out batches at the endpoint cap and reports a failed or short batch without stopping', async () => {
  const { revalidateViaFanOut } = await import('../nightly-refresh');
  const paths = Array.from({ length: 205 }, (_, i) => `/p${i}`);
  const sizes: number[] = [];
  const r = await revalidateViaFanOut('https://x.test', paths, 'r', async (_u, init) => {
    assert.equal(init.redirect, 'manual');
    assert.ok(init.signal instanceof AbortSignal, 'every fan-out request has a timeout');
    const batch = JSON.parse(String(init.body)).paths as string[];
    sizes.push(batch.length);
    if (batch[0] === '/p100') return resp(500);
    if (batch[0] === '/p200') return new Response(JSON.stringify({ ok: true, revalidated: 3 }), { status: 200 });
    return new Response(JSON.stringify({ ok: true, revalidated: batch.length }), { status: 200 });
  });
  assert.deepEqual(sizes, [100, 100, 5]);
  assert.equal(r.revalidated, 100);
  assert.deepEqual(r.failedBatches, [{ first: '/p100', status: 500 }, { first: '/p200', status: 'revalidated 3 of 5' }]);
});

test('one fan-out: the endpoint uses the shared loop; the cron calls the endpoint, never revalidatePath itself', () => {
  const route = readFileSync(new URL('../../app/api/revalidate/route.ts', import.meta.url), 'utf8');
  const cron = readFileSync(new URL('../../app/api/cron/nightly-refresh/route.ts', import.meta.url), 'utf8');
  const lib = readFileSync(new URL('../nightly-refresh.ts', import.meta.url), 'utf8');
  assert.match(route, /from '@\/lib\/revalidate-paths'/);
  assert.match(route, /revalidatePaths\(paths\)/);
  for (const src of [cron, lib]) assert.doesNotMatch(src, /revalidatePath\(|revalidatePaths\(/, 'the cron never revalidates inside its own request');
  assert.match(lib, /\$\{origin\}\/api\/revalidate/);
});
