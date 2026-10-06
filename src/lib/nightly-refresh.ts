// The nightly refresh after Eastern midnight (WEB6 G4, 2026-10-06).
//
// WHY. Every page cuts upcoming from past on the site's Eastern day
// (src/lib/site-today.ts), but cached copies live 24h (team pages, venue hubs,
// /teams) or 6h (league hubs, /promos aggregators). A hub rendered at 9 PM and a
// team page regenerated after midnight disagree until the older copy expires:
// the hub card links to a row the team page has already moved to its archive.
// Revalidating every day-dependent page just after midnight, and then
// requesting each one so the new copy exists before visitors arrive, puts them
// all on the same day.
//
// WHEN. Vercel cron runs in UTC. Eastern midnight is 04:00 UTC in EDT and
// 05:00 UTC in EST, so the cron fires at both 04:15 and 05:15 UTC and the route
// acts only when it is the 00:00 hour in America/New_York. Exactly one of the
// two firings acts on every night of the year, the two DST change nights
// included (tests pin it).
//
// WHAT. Every team page, every venue hub, the league hubs, /teams and the
// /promos pages. NOT the homepage: "/" is rejected by the fan-out's path pattern
// by ruling, and it regenerates on its own 6h window.
//
// HOW, AND WHY OVER HTTP. Through the existing fan-out, POST /api/revalidate,
// in batches of its 100-path cap, and only then a GET of each path. Next
// applies revalidatePath when the request that called it FINISHES, so a route
// that revalidated and then fetched its own pages in the same request got the
// old cached copies back and regenerated nothing (measured on a local
// production build, 2026-10-06). A completed POST makes the next GET a cache
// MISS that renders fresh on the new Eastern day.
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
  const all = [
    ...teams.map((t) => `/${t.sportSlug}/${t.id}`),
    ...hubs.map((slug) => `/venues/${slug}`),
    ...NIGHTLY_FIXED_PATHS,
  ];
  const out: string[] = [];
  const seen = new Set<string>();
  for (const p of all) {
    if (seen.has(p) || !PATH_RE.test(p)) continue;
    seen.add(p);
    out.push(p);
  }
  return out;
}

/** The fan-out's per-request cap (POST /api/revalidate MAX_PATHS). */
export const FANOUT_BATCH = 100;

export interface FanOutResult {
  revalidated: number;
  failedBatches: { first: string; status: number | string }[];
}

/** Revalidates through POST /api/revalidate, one completed request per batch,
 *  so every invalidation is applied before anything is warmed. `poster` is
 *  injectable for tests. */
export async function revalidateViaFanOut(
  origin: string,
  paths: readonly string[],
  secret: string,
  poster: (url: string, init: RequestInit) => Promise<{ status: number; json: () => Promise<unknown> }> = fetch,
): Promise<FanOutResult> {
  const result: FanOutResult = { revalidated: 0, failedBatches: [] };
  for (let i = 0; i < paths.length; i += FANOUT_BATCH) {
    const batch = paths.slice(i, i + FANOUT_BATCH);
    try {
      const res = await poster(`${origin}/api/revalidate`, {
        method: 'POST',
        cache: 'no-store',
        headers: { 'content-type': 'application/json', 'x-revalidate-secret': secret },
        body: JSON.stringify({ paths: batch }),
      });
      const body = (await res.json()) as { ok?: boolean; revalidated?: number };
      if (res.status === 200 && body.ok) result.revalidated += body.revalidated ?? 0;
      else result.failedBatches.push({ first: batch[0], status: res.status });
    } catch (err) {
      result.failedBatches.push({ first: batch[0], status: err instanceof Error ? err.message : String(err) });
    }
  }
  return result;
}

export interface WarmResult {
  ok: number;
  failed: { path: string; status: number | string }[];
}

/** Requests each path once, a few at a time, so the regenerated copy is built
 *  now rather than by the first visitor. `fetcher` is injectable for tests. */
export async function warmPaths(
  origin: string,
  paths: readonly string[],
  fetcher: (url: string) => Promise<{ status: number }> = (url) =>
    fetch(url, { cache: 'no-store', headers: { 'user-agent': 'PromoNightNightlyRefresh/1.0' } }),
  concurrency = 6,
): Promise<WarmResult> {
  const result: WarmResult = { ok: 0, failed: [] };
  let next = 0;
  async function worker() {
    while (next < paths.length) {
      const path = paths[next++];
      try {
        const res = await fetcher(origin + path);
        if (res.status === 200) result.ok++;
        else result.failed.push({ path, status: res.status });
      } catch (err) {
        result.failed.push({ path, status: err instanceof Error ? err.message : String(err) });
      }
    }
  }
  await Promise.all(Array.from({ length: Math.min(concurrency, paths.length) }, worker));
  return result;
}
