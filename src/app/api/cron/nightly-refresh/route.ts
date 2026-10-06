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
 *      built before the first visitor or crawler, and requests each one again
 *      to report how many came back fresh.
 * Always against https://www.getpromonight.com in production: Vercel Cron
 * calls the deployment's own *.vercel.app host, which is behind Vercel's login.
 *
 * Auth: Vercel Cron sends `Authorization: Bearer <CRON_SECRET>`; anything else
 * is rejected, as on the other cron routes. The fan-out needs REVALIDATE_SECRET.
 */
import { NextResponse } from 'next/server';
import { getAllTeams } from '@/lib/data';
import { getAllVenueHubSlugs } from '@/lib/venue-hub';
import {
  isNightlyRefreshWindow,
  nightlyRefreshPaths,
  refreshOrigin,
  retryUntaken,
  revalidateViaFanOut,
  SETTLE_MS as DEFAULT_SETTLE_MS,
  siteHour,
  VERIFY_BUDGET_MS,
  VERIFY_DELAY_MS as DEFAULT_VERIFY_DELAY_MS,
  VERIFY_ROUND_MS as DEFAULT_VERIFY_ROUND_MS,
  verifyFresh,
  WARM_BUDGET_MS,
  warmPaths,
} from '@/lib/nightly-refresh';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
// Must equal MAX_DURATION_S in src/lib/nightly-refresh.ts (a test pins both).
export const maxDuration = 800;

// Waits around the warm-up (src/lib/nightly-refresh.ts, HOW). The env
// overrides exist only so tests do not sleep; production uses the defaults.
const SETTLE_MS = Number(process.env.NIGHTLY_REFRESH_SETTLE_MS ?? DEFAULT_SETTLE_MS);
const VERIFY_DELAY_MS = Number(process.env.NIGHTLY_REFRESH_VERIFY_MS ?? DEFAULT_VERIFY_DELAY_MS);
const VERIFY_ROUND_MS = Number(process.env.NIGHTLY_REFRESH_ROUND_MS ?? DEFAULT_VERIFY_ROUND_MS);
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

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
  const { paths, dropped } = await nightlyRefreshPaths({ teams: getAllTeams, venueHubSlugs: getAllVenueHubSlugs });
  const origin = refreshOrigin(request.url);
  const revalidated = await revalidateViaFanOut(origin, paths, fanOutSecret);
  await sleep(SETTLE_MS);
  const warmed = await warmPaths(origin, paths, { deadline: started + WARM_BUDGET_MS });
  // A warm HIT or PRERENDER is ambiguous (see warmTookRevalidation): send those
  // paths through the fan-out once more and ask again.
  const retried = await retryUntaken(origin, warmed, fanOutSecret, { deadline: started + WARM_BUDGET_MS, settleMs: SETTLE_MS });
  const warmMs = Date.now() - started;
  await sleep(VERIFY_DELAY_MS);
  const verified = await verifyFresh(origin, warmed, paths, { deadline: started + VERIFY_BUDGET_MS, roundDelayMs: VERIFY_ROUND_MS });
  const ms = Date.now() - started;

  // Judged on the end state: every path revalidated, and every path came back
  // fresh. A warm-up timeout that rendered anyway is reported in warmFailed but
  // is not a failure.
  const ok =
    dropped.length === 0 &&
    revalidated.failedBatches.length === 0 &&
    revalidated.revalidated === paths.length &&
    verified.notFresh.length === 0 &&
    verified.fresh === paths.length;
  console.log(
    `[cron:nightly-refresh] ok=${ok} paths=${paths.length} revalidated=${revalidated.revalidated} warmed=${warmed.ok} fresh=${verified.fresh} notFresh=${verified.notFresh.length} rounds=${verified.rounds} retried=${retried.retried} warmFailed=${warmed.failed.length} cache=${JSON.stringify(warmed.cache)} warmMs=${warmMs} ms=${ms}`,
  );
  return NextResponse.json(
    {
      ok,
      origin,
      paths: paths.length,
      dropped,
      revalidated: revalidated.revalidated,
      revalidateFailedBatches: revalidated.failedBatches,
      warmed: warmed.ok,
      warmCache: warmed.cache,
      warmFailed: warmed.failed.slice(0, 20),
      warmSkipped: warmed.skipped,
      retried: retried.retried,
      retryFailedBatches: retried.failedBatches,
      fresh: verified.fresh,
      notFresh: verified.notFresh.slice(0, 20),
      verifyRounds: verified.rounds,
      warmMs,
      ms,
    },
    // A red line in the Cron Jobs log when anything did not land.
    { status: ok ? 200 : 500 },
  );
}
