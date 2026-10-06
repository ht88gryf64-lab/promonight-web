// The nightly refresh after Eastern midnight (WEB6 G4, 2026-10-06).
//
// WHY. Every page cuts upcoming from past on the site's Eastern day
// (src/lib/site-today.ts), but cached copies live 24h (team pages, venue hubs,
// /teams), 6h (league hubs, most /promos aggregators) or 1h (/promos/today). A hub rendered at 9 PM and a
// team page regenerated after midnight disagree until the older copy expires:
// the hub card links to a row the team page has already moved to its archive.
// Revalidating the day-dependent pages just after midnight, and then
// requesting each one so the new copy exists before visitors arrive, puts the
// team pages and every page that links into their rows on the same day.
//
// WHEN. Vercel cron runs in UTC. Eastern midnight is 04:00 UTC in EDT and
// 05:00 UTC in EST, so the cron fires at both 04:15 and 05:15 UTC and the route
// acts only when it is the 00:00 hour in America/New_York. Exactly one of the
// two firings acts on every night of the year, the two DST change nights
// included (tests pin it).
//
// WHAT. Every team page, every venue hub, the league hubs, /teams, the /promos
// pages, /best-promos (both), /team-rankings, and the CFB pages (the /cfb hub,
// every school page, /cfb/rivalries and every rivalry page; added by Matt's
// G4 approval, 2026-10-06). NOT refreshed here: the homepage ("/" is rejected
// by the fan-out's path pattern by ruling; it keeps its 6h window).
// /promos/today is covered here; its old 05:10 UTC cron is retired.
//
// HOW, AND WHY OVER HTTP. Through the existing fan-out, POST /api/revalidate,
// in batches of its 100-path cap, and only then a GET of each path. Next
// applies revalidatePath when the request that called it FINISHES, so a route
// that revalidated and then fetched its own pages in the same request got the
// old cached copies back and regenerated nothing (measured on a local
// production build, 2026-10-06). A completed POST makes the next GET a cache
// MISS that renders fresh on the new Eastern day. On Vercel an on-demand
// revalidation can instead serve the old copy once (STALE) and regenerate it in
// the background, and the endpoint's invalidations finish in waitUntil after
// its response; so the job waits a few seconds after the last batch, warms,
// then re-asks, in rounds, every page whose copy is still regenerating, and
// reports how many came back fresh (warmTookRevalidation, verifyVerdict).
import { SITE_TIME_ZONE } from './site-today';
import { PATH_RE } from './revalidate-paths';
import { REFRESH_USER_AGENT } from './refresh-agent';
export { REFRESH_USER_AGENT };

/** Fixed day-dependent pages outside the team and venue routes. */
export const NIGHTLY_FIXED_PATHS: readonly string[] = [
  '/nhl',
  '/mlb',
  '/nfl',
  '/wnba',
  '/mls',
  '/teams',
  '/promos/today',
  '/promos/this-week',
  '/promos/theme-nights',
  '/promos/food-deals',
  '/promos/bobbleheads',
  '/promos/jersey-giveaways',
  '/promos/soccer-jersey-nights',
  // Also cut on the site day (siteYmd), 24h copies: cheap to include.
  '/best-promos',
  '/best-promos/bobbleheads',
  '/team-rankings',
  // CFB: the hub and the rivalries index (the school and matchup pages come
  // from their loaders). Played/upcoming there is the venue's day, with the
  // site day as fallback; 6h windows.
  '/cfb',
  '/cfb/rivalries',
];

const SITE_HOUR = new Intl.DateTimeFormat('en-US', { timeZone: SITE_TIME_ZONE, hour: '2-digit', hourCycle: 'h23' });

/** The hour (0 to 23) on the site's clock at an instant. */
export function siteHour(instant: Date): number {
  return Number(SITE_HOUR.formatToParts(instant).find((p) => p.type === 'hour')?.value ?? NaN);
}

/** True in the 00:00 hour, America/New_York: the one window the cron acts in. */
export function isNightlyRefreshWindow(instant: Date): boolean {
  return siteHour(instant) === 0;
}

export interface NightlyLoaders {
  teams: () => Promise<{ id: string; sportSlug: string }[]>;
  venueHubSlugs: () => Promise<string[]>;
  /** CFB school ids (getAllCfbSchoolIds) and rivalry matchup slugs
   *  (getAllMatchupSlugs), the loaders of their routes' generateStaticParams. */
  cfbSchoolIds: () => Promise<string[]>;
  cfbMatchupSlugs: () => string[] | Promise<string[]>;
}

/** Every path the refresh revalidates and warms, deduped, each one checked
 *  against the fan-out's path pattern; the ones it would reject come back as
 *  `dropped` for the route to report. Team pages and venue hubs come from the
 *  same loaders their routes' generateStaticParams use. */
export async function nightlyRefreshPaths(loaders: NightlyLoaders): Promise<{ paths: string[]; dropped: string[] }> {
  const [teams, hubs, schools, matchups] = await Promise.all([
    loaders.teams(),
    loaders.venueHubSlugs(),
    loaders.cfbSchoolIds(),
    loaders.cfbMatchupSlugs(),
  ]);
  // The fixed cross-team pages first: they are the slowest to render (each
  // reads every upcoming promo) and the most visible, so they get the most time.
  const all = [
    ...NIGHTLY_FIXED_PATHS,
    ...teams.map((t) => `/${t.sportSlug}/${t.id}`),
    ...hubs.map((slug) => `/venues/${slug}`),
    ...schools.map((id) => `/cfb/${id}`),
    ...matchups.map((slug) => `/cfb/rivalries/${slug}`),
  ];
  const out: string[] = [];
  const seen = new Set<string>();
  const dropped: string[] = [];
  for (const p of all) {
    if (seen.has(p)) continue;
    if (!PATH_RE.test(p)) {
      dropped.push(p);
      continue;
    }
    seen.add(p);
    out.push(p);
  }
  return { paths: out, dropped };
}

/** The fan-out's per-request cap (POST /api/revalidate MAX_PATHS). */
export const FANOUT_BATCH = 100;

/** The canonical host. Vercel Cron calls the per-deployment *.vercel.app host,
 *  which is behind Vercel's login (SSO) for anything but custom domains: a
 *  request there gets the login page back, so the job must never derive its
 *  origin from the incoming request in production (review round 1). */
export const SITE_ORIGIN = 'https://www.getpromonight.com';

/** Where the job sends its requests: the canonical host in production, the
 *  request's own origin anywhere else (a local production build). */
export function refreshOrigin(requestUrl: string, vercelEnv: string | undefined = process.env.VERCEL_ENV): string {
  return vercelEnv === 'production' ? SITE_ORIGIN : new URL(requestUrl).origin;
}


/** Per-request ceiling, so one hung page cannot hold a pass past its budget. The cross-team aggregators read every upcoming promo and took
 *  over 20s each on a local build; 60s leaves them room. A request that times
 *  out has still started the render, and the second pass reports it. */
export const FETCH_TIMEOUT_MS = 60_000;

/** The function may run 800s (Vercel Pro, Fluid compute). Each pass stops
 *  STARTING requests at its budget, and a request (fan-out POSTs included)
 *  never outlives the time its pass has left, so the run always answers inside
 *  maxDuration. The first fan-out runs before any budget and is bounded by its
 *  five batches at FETCH_TIMEOUT_MS. */
export const MAX_DURATION_S = 800;
export const WARM_BUDGET_MS = 480_000;
export const VERIFY_BUDGET_MS = 720_000;
/** Verify rounds at most (with 20s between rounds this is about 10 minutes). */
export const MAX_VERIFY_ROUNDS = 30;
/** Waits: after the last fan-out batch (its invalidations finish in waitUntil),
 *  before the first verify round, and between verify rounds. */
export const SETTLE_MS = 5_000;
export const VERIFY_DELAY_MS = 15_000;
export const VERIFY_ROUND_MS = 20_000;
/** Requests in flight at once during a pass. */
export const WARM_CONCURRENCY = 6;

type Fetcher = (url: string, init: RequestInit) => Promise<Response>;
const defaultFetch: Fetcher = (url, init) => fetch(url, init);

export interface FanOutResult {
  revalidated: number;
  failedBatches: { first: string; status: number | string }[];
}

/** Revalidates through POST /api/revalidate, one completed request per batch,
 *  so every invalidation is queued before anything is warmed. A redirect (the
 *  login page) or any non-200 is a failed batch, never a silent success. */
export async function revalidateViaFanOut(
  origin: string,
  paths: readonly string[],
  secret: string,
  fetcher: Fetcher = defaultFetch,
  deadline?: number,
  now: () => number = () => Date.now(),
): Promise<FanOutResult> {
  const result: FanOutResult = { revalidated: 0, failedBatches: [] };
  for (let i = 0; i < paths.length; i += FANOUT_BATCH) {
    const batch = paths.slice(i, i + FANOUT_BATCH);
    const left = deadline === undefined ? FETCH_TIMEOUT_MS : deadline - now();
    if (left <= 0) {
      result.failedBatches.push({ first: batch[0], status: 'past the deadline' });
      continue;
    }
    try {
      const res = await fetcher(`${origin}/api/revalidate`, {
        method: 'POST',
        cache: 'no-store',
        redirect: 'manual',
        signal: AbortSignal.timeout(Math.min(FETCH_TIMEOUT_MS, left)),
        headers: { 'content-type': 'application/json', 'x-revalidate-secret': secret, 'user-agent': REFRESH_USER_AGENT },
        body: JSON.stringify({ paths: batch }),
      });
      if (res.status !== 200) {
        result.failedBatches.push({ first: batch[0], status: res.status });
        continue;
      }
      const body = (await res.json()) as { ok?: boolean; revalidated?: number };
      if (body.ok && body.revalidated === batch.length) result.revalidated += batch.length;
      else result.failedBatches.push({ first: batch[0], status: `revalidated ${body.revalidated ?? 0} of ${batch.length}` });
    } catch (err) {
      result.failedBatches.push({ first: batch[0], status: err instanceof Error ? err.message : String(err) });
    }
  }
  return result;
}

/** What a warm response says about this run's revalidation. MISS and
 *  REVALIDATED: the new copy was rendered for this request. STALE: the old copy
 *  was served and the new one is being regenerated in the background (Vercel's
 *  on-demand ISR). Any of those means the invalidation took, and the copy that
 *  results is rendered after midnight. PRERENDER or HIT is ambiguous on a live
 *  site: either the revalidation did not apply, or a visitor, crawler or link
 *  prefetch regenerated the page between the fan-out and this request. The
 *  route therefore sends those paths through the fan-out once more and asks
 *  again (retryUntaken); only a second HIT or PRERENDER fails the path. Age is
 *  not used: on Vercel it is how long a copy has sat in the CDN, not how old
 *  the render is (review round 3). */
export function warmTookRevalidation(state: string): boolean {
  return state === 'MISS' || state === 'REVALIDATED' || state === 'STALE';
}

/** A verify response for a path whose warm-up took (or timed out after
 *  reaching the server, so its render had started): rendered now or served from
 *  cache after that render is the new copy; STALE means still regenerating, so
 *  ask again; anything else (PRERENDER, NONE) is a failure. CAVEAT, local only:
 *  under `next start`, a background regeneration that throws writes the OLD
 *  entry back for up to 30s, so a later HIT can be the old copy; on Vercel the
 *  path answers STALE again instead. A local run's "fresh" count is therefore
 *  checked against the served rows (the 12:40 AM check), not trusted alone. */
export function verifyVerdict(state: string): 'fresh' | 'pending' | 'failed' {
  if (state === 'MISS' || state === 'REVALIDATED' || state === 'HIT') return 'fresh';
  if (state === 'STALE') return 'pending';
  return 'failed';
}

export interface WarmResult {
  /** 200 responses. */
  ok: number;
  /** Non-200, redirects, timeouts and errors. */
  failed: { path: string; status: number | string }[];
  /** Responses by cache state (x-vercel-cache on Vercel, x-nextjs-cache locally). */
  cache: Record<string, number>;
  /** Each path's cache state, or "FAILED". */
  states: Record<string, string>;
  /** Paths not requested because the time budget ran out. */
  skipped: number;
}

/** Requests each path once, a few at a time, and records what each answered.
 *  `fetcher` is injectable for tests. */
export async function warmPaths(
  origin: string,
  paths: readonly string[],
  opts: { fetcher?: Fetcher; concurrency?: number; deadline?: number; now?: () => number } = {},
): Promise<WarmResult> {
  const fetcher = opts.fetcher ?? defaultFetch;
  const now = opts.now ?? (() => Date.now());
  const result: WarmResult = { ok: 0, failed: [], cache: {}, states: {}, skipped: 0 };
  let next = 0;
  async function worker() {
    while (next < paths.length) {
      const path = paths[next++];
      if (opts.deadline !== undefined && now() > opts.deadline) {
        result.skipped++;
        continue;
      }
      const left = opts.deadline === undefined ? FETCH_TIMEOUT_MS : opts.deadline - now();
      try {
        const res = await fetcher(origin + path, {
          cache: 'no-store',
          redirect: 'manual',
          signal: AbortSignal.timeout(Math.max(1, Math.min(FETCH_TIMEOUT_MS, left))),
          headers: { 'user-agent': REFRESH_USER_AGENT },
        });
        // Headers are all the job reads; let the body go.
        await res.body?.cancel().catch(() => {});
        const state = (res.headers.get('x-vercel-cache') ?? res.headers.get('x-nextjs-cache') ?? 'NONE').toUpperCase();
        result.cache[state] = (result.cache[state] ?? 0) + 1;
        if (res.status !== 200) {
          result.states[path] = 'FAILED';
          result.failed.push({ path, status: res.status });
          continue;
        }
        result.ok++;
        result.states[path] = state;
      } catch (err) {
        result.states[path] = 'FAILED';
        result.failed.push({ path, status: err instanceof Error ? err.message : String(err) });
      }
    }
  }
  await Promise.all(Array.from({ length: Math.min(opts.concurrency ?? WARM_CONCURRENCY, paths.length) }, worker));
  return result;
}

export interface VerifyResult {
  fresh: number;
  /** Paths that never came back fresh: the warm-up showed the revalidation did
   *  not take, or the copy is still regenerating at the deadline, or the page
   *  failed. */
  notFresh: { path: string; reason: string }[];
  rounds: number;
}

export interface RetryResult {
  retried: number;
  failedBatches: FanOutResult['failedBatches'];
  /** The re-warm's answers by cache state. */
  cache: Record<string, number>;
  /** True when the retry did not run because the warm budget was spent. */
  skippedForTime: boolean;
}

/** Sends every path whose warm-up answered PRERENDER, HIT or NONE through the
 *  fan-out once more and warms it again, inside the warm budget. A new answer
 *  replaces the old one in `warm.states` only when it is a real answer: a
 *  re-warm that failed or was skipped leaves the HIT in place, so the path
 *  still fails as "did not take" (review round 5). */
export async function retryUntaken(
  origin: string,
  warm: WarmResult,
  secret: string,
  opts: { deadline: number; settleMs: number; fetcher?: Fetcher; sleep?: (ms: number) => Promise<void>; now?: () => number },
): Promise<RetryResult> {
  const sleep = opts.sleep ?? ((ms: number) => new Promise<void>((r) => setTimeout(r, ms)));
  const now = opts.now ?? (() => Date.now());
  const list = Object.keys(warm.states).filter((p) => warm.states[p] !== 'FAILED' && !warmTookRevalidation(warm.states[p]));
  const none: RetryResult = { retried: 0, failedBatches: [], cache: {}, skippedForTime: false };
  if (list.length === 0) return none;
  if (now() + opts.settleMs >= opts.deadline) return { ...none, skippedForTime: true };
  const fanned = await revalidateViaFanOut(origin, list, secret, opts.fetcher, opts.deadline, now);
  await sleep(opts.settleMs);
  const again = await warmPaths(origin, list, { fetcher: opts.fetcher, deadline: opts.deadline, now });
  for (const p of list) {
    const a = again.states[p];
    if (a !== undefined && a !== 'FAILED') warm.states[p] = a;
  }
  return { retried: list.length, failedBatches: fanned.failedBatches, cache: again.cache, skippedForTime: false };
}

/** Re-requests, in rounds, every path whose warm-up took until each comes back
 *  fresh or the deadline passes. A path whose warm-up (after retryUntaken)
 *  still showed a PRERENDER or HIT fails at once. A path whose warm-up timed
 *  out is asked like any other: its render had started. A path that answers
 *  non-200 twice in a row fails with that status. No round starts, and no
 *  sleep begins, past the deadline.
 *
 *  ACCEPTED FALSE GREEN (Matt, G4 approval, 2026-10-06): every failed warm-up
 *  is verified like a timed-out one, not only a timeout (a 5xx or network error
 *  too). If that path's invalidation ALSO silently failed, a verify HIT on the
 *  old copy counts as fresh. It needs two faults on the same path in the same
 *  run; it is documented rather than handled. */
export async function verifyFresh(
  origin: string,
  warm: WarmResult,
  paths: readonly string[],
  opts: { deadline: number; roundDelayMs: number; fetcher?: Fetcher; now?: () => number; sleep?: (ms: number) => Promise<void> },
): Promise<VerifyResult> {
  const now = opts.now ?? (() => Date.now());
  const sleep = opts.sleep ?? ((ms: number) => new Promise<void>((r) => setTimeout(r, ms)));
  const result: VerifyResult = { fresh: 0, notFresh: [], rounds: 0 };
  let pending: string[] = [];
  for (const p of paths) {
    const w = warm.states[p];
    if (w === undefined) result.notFresh.push({ path: p, reason: 'not warmed' });
    else if (w === 'FAILED' || warmTookRevalidation(w)) pending.push(p);
    else result.notFresh.push({ path: p, reason: `warm ${w}: revalidation did not take` });
  }
  const failStreak = new Map<string, number>();
  while (pending.length && now() < opts.deadline && result.rounds < MAX_VERIFY_ROUNDS) {
    if (result.rounds > 0) {
      if (now() + opts.roundDelayMs >= opts.deadline) break;
      await sleep(opts.roundDelayMs);
    }
    result.rounds++;
    const asked = await warmPaths(origin, pending, { fetcher: opts.fetcher, deadline: opts.deadline, now });
    const statusOf = new Map(asked.failed.map((f) => [f.path, f.status]));
    const still: string[] = [];
    for (const p of pending) {
      const v = asked.states[p];
      if (v === undefined || v === 'FAILED') {
        const streak = (failStreak.get(p) ?? 0) + 1;
        failStreak.set(p, streak);
        if (streak >= 2) result.notFresh.push({ path: p, reason: `verify answered ${statusOf.get(p) ?? 'nothing'} twice` });
        else still.push(p);
        continue;
      }
      failStreak.delete(p);
      const verdict = verifyVerdict(v);
      if (verdict === 'fresh') result.fresh++;
      else if (verdict === 'pending') still.push(p);
      else result.notFresh.push({ path: p, reason: `verify ${v}` });
    }
    pending = still;
  }
  for (const p of pending) result.notFresh.push({ path: p, reason: 'still regenerating when verification stopped' });
  return result;
}
