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
// WHAT. Through the site's one revalidation fan-out (src/lib/revalidate-paths.ts,
// the same loop POST /api/revalidate runs): every team page, every venue hub,
// the league hubs, /teams and the /promos pages. NOT the homepage: "/" is
// rejected by the fan-out's path pattern by ruling, and it regenerates on its
// own 6h window.
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
