/**
 * GET /api/cron/nightly-refresh
 *
 * Nightly refresh after Eastern midnight (WEB6 G4). Scheduled in vercel.json at
 * 04:15 and 05:15 UTC; acts only in the 00:00 hour America/New_York, which is
 * exactly one of the two firings every night (src/lib/nightly-refresh.ts).
 *   1. Revalidates every team page, venue hub, league hub, /teams and /promos
 *      page through the existing fan-out, POST /api/revalidate, in batches of
 *      100. Over HTTP on purpose: see src/lib/nightly-refresh.ts.
 *   2. Then requests each one, so the new copy, cut on the new Eastern day, is
 *      built before the first visitor or crawler.
 *
 * Auth: Vercel Cron sends `Authorization: Bearer <CRON_SECRET>`; anything else
 * is rejected, as on the other cron routes. The fan-out needs REVALIDATE_SECRET.
 */
import { NextResponse } from 'next/server';
import { getAllTeams } from '@/lib/data';
import { getAllVenueHubSlugs } from '@/lib/venue-hub';
import { isNightlyRefreshWindow, nightlyRefreshPaths, revalidateViaFanOut, siteHour, warmPaths } from '@/lib/nightly-refresh';

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

  const fanOutSecret = process.env.REVALIDATE_SECRET;
  if (!fanOutSecret) {
    return NextResponse.json({ ok: false, reason: 'fanout_not_configured' }, { status: 503 });
  }

  const now = new Date();
  if (!isNightlyRefreshWindow(now)) {
    // The other of the two UTC firings: an hour before or after Eastern midnight.
    return NextResponse.json({ ok: true, skipped: 'outside_window', siteHour: siteHour(now) });
  }

  const started = Date.now();
  const paths = await nightlyRefreshPaths({ teams: getAllTeams, venueHubSlugs: getAllVenueHubSlugs });
  const origin = new URL(request.url).origin;
  const revalidated = await revalidateViaFanOut(origin, paths, fanOutSecret);
  const warmed = await warmPaths(origin, paths);
  const ms = Date.now() - started;

  console.log(
    `[cron:nightly-refresh] paths=${paths.length} revalidated=${revalidated.revalidated} warmed=${warmed.ok} failed=${warmed.failed.length} ms=${ms}`,
  );
  return NextResponse.json({
    ok: true,
    paths: paths.length,
    revalidated: revalidated.revalidated,
    revalidateFailedBatches: revalidated.failedBatches,
    warmed: warmed.ok,
    warmFailed: warmed.failed,
    ms,
  });
}
