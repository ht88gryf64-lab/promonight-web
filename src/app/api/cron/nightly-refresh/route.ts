/**
 * GET /api/cron/nightly-refresh
 *
 * Nightly refresh after Eastern midnight (WEB6 G4). Scheduled in vercel.json at
 * 04:15 and 05:15 UTC; acts only in the 00:00 hour America/New_York, which is
 * exactly one of the two firings every night (src/lib/nightly-refresh.ts).
 *   1. Revalidates every team page, venue hub, league hub, /teams and /promos
 *      page through the shared fan-out (src/lib/revalidate-paths.ts).
 *   2. Requests each one so the new copy, cut on the new Eastern day, is built
 *      before the first visitor or crawler.
 *
 * Auth: Vercel Cron sends `Authorization: Bearer <CRON_SECRET>`; anything else
 * is rejected, as on the other cron routes.
 */
import { NextResponse } from 'next/server';
import { getAllTeams } from '@/lib/data';
import { getAllVenueHubSlugs } from '@/lib/venue-hub';
import { revalidatePaths } from '@/lib/revalidate-paths';
import { isNightlyRefreshWindow, nightlyRefreshPaths, siteHour, warmPaths } from '@/lib/nightly-refresh';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 300;

export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret) {
    return NextResponse.json({ ok: false, reason: 'not_configured' }, { status: 503 });
  }
  if (request.headers.get('authorization') !== `Bearer ${secret}`) {
    return NextResponse.json({ ok: false, reason: 'unauthorized' }, { status: 401 });
  }

  const now = new Date();
  if (!isNightlyRefreshWindow(now)) {
    // The other of the two UTC firings: an hour before or after Eastern midnight.
    return NextResponse.json({ ok: true, skipped: 'outside_window', siteHour: siteHour(now) });
  }

  const started = Date.now();
  const paths = await nightlyRefreshPaths({ teams: getAllTeams, venueHubSlugs: getAllVenueHubSlugs });
  const revalidated = revalidatePaths(paths, undefined, 'cron:nightly-refresh');
  const warmed = await warmPaths(new URL(request.url).origin, paths);
  const ms = Date.now() - started;

  console.log(
    `[cron:nightly-refresh] paths=${paths.length} revalidated=${revalidated.succeeded} warmed=${warmed.ok} failed=${warmed.failed.length} ms=${ms}`,
  );
  return NextResponse.json({
    ok: true,
    paths: paths.length,
    revalidated: revalidated.succeeded,
    revalidateFailed: revalidated.failed,
    warmed: warmed.ok,
    warmFailed: warmed.failed,
    ms,
  });
}
