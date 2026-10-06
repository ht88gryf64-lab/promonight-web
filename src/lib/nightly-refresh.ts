// The nightly refresh after Eastern midnight (WEB6 G4, 2026-10-06).
//
// WHY. Every page cuts upcoming from past on the site's Eastern day
// (src/lib/site-today.ts), but cached copies live 24h (team pages, venue hubs,
// /teams) or 6h (league hubs, /promos aggregators). A hub rendered at 9 PM and a
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
// pages, /best-promos (both) and /team-rankings. NOT refreshed here: the
// homepage ("/" is rejected by the fan-out's path pattern by ruling; it keeps
// its 6h window) and the CFB pages (/cfb, its 86 school pages and the rivalry
// pages, 6h windows), which are an owner decision on cost.
//
// HOW, AND WHY OVER HTTP. Through the existing fan-out, POST /api/revalidate,
// in batches of its 100-path cap, and only then a GET of each path. Next
// applies revalidatePath when the request that called it FINISHES, so a route
// that revalidated and then fetched its own pages in the same request got the
// old cached copies back and regenerated nothing (measured on a local
// production build, 2026-10-06). A completed POST makes the next GET a cache
// MISS that renders fresh on the new Eastern day. On Vercel an on-demand
// revalidation can instead serve the old copy once and regenerate it in the
// background, and the endpoint's invalidations finish in waitUntil after its
// response; so the job waits a few seconds after the last batch, warms, waits
// again and requests every path a second time to report how many are fresh.
import { SITE_TIME_ZONE } from './site-today';
import { PATH_RE } from './revalidate-paths';

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
}

/** Every path the refresh revalidates and warms, deduped, each one checked
 *  against the fan-out's path pattern. Team pages and venue hubs come from the
 *  same loaders their routes' generateStaticParams use. */
export async function nightlyRefreshPaths(loaders: NightlyLoaders): Promise<string[]> {
  const [teams, hubs] = await Promise.all([loaders.teams(), loaders.venueHubSlugs()]);
  // The fixed cross-team pages first: they are the slowest to render (each
  // reads every upcoming promo) and the most visible, so they get the most time.
  const all = [
    ...NIGHTLY_FIXED_PATHS,
    ...teams.map((t) => `/${t.sportSlug}/${t.id}`),
    ...hubs.map((slug) => `/venues/${slug}`),
  ];
  const out: string[] = [];
  const seen = new Set<string>();
  let dropped = 0;
  for (const p of all) {
    if (seen.has(p)) continue;
    if (!PATH_RE.test(p)) {
      dropped++;
      continue;
    }
    seen.add(p);
    out.push(p);
  }
  if (dropped) console.warn(`[cron:nightly-refresh] ${dropped} path(s) the fan-out would reject were left out`);
  return out;
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

/** Contains "bot", so the middleware's traffic classifier never counts the
 *  job's requests as human page loads. */
export const REFRESH_USER_AGENT = 'PromoNightRefreshBot/1.0';

/** Per-request ceiling, so one hung page cannot hold the function to its
 *  300s limit. The cross-team aggregators read every upcoming promo and took
 *  over 20s each on a local build; 60s leaves them room. A request that times
 *  out has still started the render, and the second pass reports it. */
export const FETCH_TIMEOUT_MS = 60_000;

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
): Promise<FanOutResult> {
  const result: FanOutResult = { revalidated: 0, failedBatches: [] };
  for (let i = 0; i < paths.length; i += FANOUT_BATCH) {
    const batch = paths.slice(i, i + FANOUT_BATCH);
    try {
      const res = await fetcher(`${origin}/api/revalidate`, {
        method: 'POST',
        cache: 'no-store',
        redirect: 'manual',
        signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
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

export interface WarmResult {
  /** 200 responses. */
  ok: number;
  /** Non-200, redirects, timeouts and errors. */
  failed: { path: string; status: number | string }[];
  /** Responses by cache state (x-vercel-cache on Vercel, x-nextjs-cache locally). */
  cache: Record<string, number>;
  /** 200 responses that are not a stale copy: a MISS, or a cached copy built
   *  after `freshSince` (its Age is younger than the run). */
  fresh: number;
  /** Paths not requested because the time budget ran out. */
  skipped: number;
}

/** Requests each path, a few at a time. The first pass builds the new copy (or,
 *  on Vercel, starts its background regeneration); a second pass later reports
 *  how many came back fresh. `fetcher` is injectable for tests. */
export async function warmPaths(
  origin: string,
  paths: readonly string[],
  opts: { fetcher?: Fetcher; concurrency?: number; freshSince?: number; deadline?: number; now?: () => number } = {},
): Promise<WarmResult> {
  const fetcher = opts.fetcher ?? defaultFetch;
  const now = opts.now ?? (() => Date.now());
  const result: WarmResult = { ok: 0, failed: [], cache: {}, fresh: 0, skipped: 0 };
  let next = 0;
  async function worker() {
    while (next < paths.length) {
      const path = paths[next++];
      if (opts.deadline !== undefined && now() > opts.deadline) {
        result.skipped++;
        continue;
      }
      try {
        const res = await fetcher(origin + path, {
          cache: 'no-store',
          redirect: 'manual',
          signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
          headers: { 'user-agent': REFRESH_USER_AGENT },
        });
        const state = (res.headers.get('x-vercel-cache') ?? res.headers.get('x-nextjs-cache') ?? 'NONE').toUpperCase();
        result.cache[state] = (result.cache[state] ?? 0) + 1;
        if (res.status !== 200) {
          result.failed.push({ path, status: res.status });
          continue;
        }
        result.ok++;
        const age = res.headers.get('age');
        const youngEnough = opts.freshSince === undefined || age === null || Number(age) * 1000 <= now() - opts.freshSince;
        if (state !== 'STALE' && youngEnough) result.fresh++;
      } catch (err) {
        result.failed.push({ path, status: err instanceof Error ? err.message : String(err) });
      }
    }
  }
  await Promise.all(Array.from({ length: Math.min(opts.concurrency ?? 6, paths.length) }, worker));
  return result;
}
