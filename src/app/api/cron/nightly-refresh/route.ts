/**
 * GET /api/cron/nightly-refresh
 *
 * Nightly refresh after midnight (WEB6 G4), in two batches (vercel.json):
 *   - no `batch` (the site batch): 04:15 and 05:15 UTC, acts in the 00:00 hour
 *     America/New_York. Team pages, venue hubs, league hubs, /teams, /promos,
 *     /best-promos, /team-rankings, /cfb and /cfb/rivalries; then the daily
 *     IndexNow ping for /promos/today.
 *   - `?batch=cfb`: 07:15 and 08:15 UTC, acts in the 03:00 hour Eastern (00:15
 *     Pacific). The CFB school and rivalry pages, which cut on the venue's day.
 * Exactly one firing of each acts every night (src/lib/nightly-refresh.ts).
 *   1. Revalidates the batch's pages through the existing fan-out,
 *      POST /api/revalidate, in batches of 100. Over HTTP on purpose: see
 *      src/lib/nightly-refresh.ts.
 *   2. Then requests each one, so the new copy, cut on the new day (Eastern for
 *      the site batch, the venue's for the cfb batch), is
 *      built before the first visitor or crawler, and requests each one again
 *      to report how many came back fresh.
 * Always against https://www.getpromonight.com in production: Vercel Cron
 * calls the deployment's own *.vercel.app host, which is behind Vercel's login.
 *
 * Auth: Vercel Cron sends `Authorization: Bearer <CRON_SECRET>`; anything else
 * is rejected, as on the other cron routes. The fan-out needs REVALIDATE_SECRET.
 */
import { isEventsPagesLive } from '@/lib/events/event-pages';
import { NextResponse } from 'next/server';
import { getAllTeams } from '@/lib/data';
import { getAllVenueHubSlugs } from '@/lib/venue-hub';
import { getAllCfbSchoolIds } from '@/lib/cfb/data';
import { getAllMatchupSlugs } from '@/lib/cfb/matchups';
import { submitToIndexNow } from '@/lib/indexnow';
import { isPromoPagesLive, promoPagePath } from '@/lib/promo-page-copy';
import { addDaysYmd, siteTodayYmd } from '@/lib/site-today';
import { ticketTestBoundary, ticketTestPromoPaths } from '@/lib/ticket-test';
import { isRevalidatePath } from '@/lib/revalidate-paths';

/** The promo pages with a game on the site day that just ended (see
 *  NightlyLoaders.promoPagesDatedYesterday). Empty while promo pages are off. */
async function promoPagesDatedYesterday(): Promise<string[]> {
  if (!isPromoPagesLive()) return [];
  const yesterday = addDaysYmd(siteTodayYmd(), -1);
  // Loaded here, not at the top: the route's other loaders stay as light as
  // before, and a load failure is the loader's failure (it adds no paths).
  const { getUpcomingPromoIndex } = await import('@/lib/promo-pages');
  const [index, teams] = await Promise.all([getUpcomingPromoIndex(yesterday), getAllTeams()]);
  const sportOf = new Map(teams.map((t) => [t.id, t.sportSlug]));
  const out = new Set<string>();
  for (const p of index) {
    const sport = sportOf.get(p.teamId);
    if (p.date === yesterday && sport) out.add(promoPagePath(sport, p.teamId, p.pageSlug));
  }
  return [...out];
}
/** TICKET PARTNER TEST (2026-11-25): on a boundary day (the test's start, its
 *  flip, its end) every upcoming promo page of the test's clubs, whose ticket
 *  button changes partner at this midnight. Null on every other night and
 *  while the switch is off. Team pages need nothing here: the site batch
 *  already refreshes every one of them tonight. */
async function ticketTestBoundaryPaths(): Promise<{ boundary: string; paths: string[] } | null> {
  const today = siteTodayYmd();
  const boundary = ticketTestBoundary(today);
  if (!boundary || !isPromoPagesLive()) return null;
  const { getUpcomingPromoIndex } = await import('@/lib/promo-pages');
  const [index, teams] = await Promise.all([getUpcomingPromoIndex(today), getAllTeams()]);
  return { boundary, paths: ticketTestPromoPaths(index, new Map(teams.map((t) => [t.id, t.sportSlug])), promoPagePath) };
}
/** The nightly Shorts sync and the promo pages whose Short changed (the
 *  social bridge, 2026-11-05; src/lib/youtube-shorts-sync.ts). Loaded on the
 *  call, as the promo pages are, so the route itself never opens Firestore. */
async function promoPagesWithNewShorts(): Promise<string[]> {
  const { promoPagesWithNewShorts: sync } = await import('@/lib/youtube-shorts-sync');
  return sync();
}
import {
  isNightlyRefreshWindow,
  nightlyRefreshPaths,
  parseRefreshBatch,
  refreshOrigin,
  SITE_ORIGIN,
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
// The IndexNow ping's ceiling. Verify stops at 720s; this keeps the run well
// inside maxDuration (800s) even then.
const INDEXNOW_TIMEOUT_MS = Number(process.env.NIGHTLY_REFRESH_INDEXNOW_MS ?? 10_000);

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

  const batch = parseRefreshBatch(new URL(request.url).searchParams.get('batch'));
  if (batch === null) {
    return NextResponse.json({ ok: false, reason: 'unknown_batch' }, { status: 400 });
  }

  const now = new Date();
  if (!isNightlyRefreshWindow(now, batch)) {
    // The other of the batch's two UTC firings: an hour off in Eastern time.
    return NextResponse.json({ ok: true, batch, skipped: 'outside_window', siteHour: siteHour(now) });
  }

  const started = Date.now();
  const { paths, dropped } = await nightlyRefreshPaths(
    {
      teams: getAllTeams,
      venueHubSlugs: getAllVenueHubSlugs,
      cfbSchoolIds: getAllCfbSchoolIds,
      cfbMatchupSlugs: getAllMatchupSlugs,
      promoPagesDatedYesterday,
      promoPagesWithNewShorts,
      // Loaded only while the flag is on: with it off this route reads nothing
      // of the events family, not even its module.
      eventPagePaths: async () => {
        if (!isEventsPagesLive()) return [];
        const { getEventSitemapEntries } = await import('@/lib/events/event-stops');
        return (await getEventSitemapEntries(new Date())).map((e) => e.path);
      },
    },
    batch,
  );
  const origin = refreshOrigin(request.url);
  const revalidated = await revalidateViaFanOut(origin, paths, fanOutSecret);
  // The ticket test's boundary fan-out (site batch only): revalidated in the
  // endpoint's 100-path chunks, NOT warmed and not part of this job's own
  // verdict. A promo page renders on its next request with the new partner.
  // A failure here adds nothing and never fails the batch.
  let ticketTest: { boundary: string; paths: number; revalidated: number; failedBatches: number } | null = null;
  if (batch === 'site') {
    try {
      const flip = await ticketTestBoundaryPaths();
      if (flip) {
        const sent = flip.paths.filter((p) => isRevalidatePath(p));
        const r = await revalidateViaFanOut(origin, sent, fanOutSecret);
        ticketTest = { boundary: flip.boundary, paths: sent.length, revalidated: r.revalidated, failedBatches: r.failedBatches.length };
        console.log(`[cron:nightly-refresh] ticket-test boundary=${flip.boundary} promoPaths=${sent.length} revalidated=${r.revalidated} failedBatches=${r.failedBatches.length}`);
      }
    } catch (err) {
      console.error('[cron:nightly-refresh] ticket-test boundary fan-out failed', err);
    }
  }
  await sleep(SETTLE_MS);
  const warmed = await warmPaths(origin, paths, { deadline: started + WARM_BUDGET_MS });
  // A warm HIT or PRERENDER is ambiguous (see warmTookRevalidation): send those
  // paths through the fan-out once more and ask again.
  const retried = await retryUntaken(origin, warmed, fanOutSecret, { deadline: started + WARM_BUDGET_MS, settleMs: SETTLE_MS });
  const warmMs = Date.now() - started;
  await sleep(VERIFY_DELAY_MS);
  const verified = await verifyFresh(origin, warmed, paths, { deadline: started + VERIFY_BUDGET_MS, roundDelayMs: VERIFY_ROUND_MS });
  // The daily IndexNow ping for /promos/today, which the retired 05:10 job used
  // to send: production only, best-effort, bounded to INDEXNOW_TIMEOUT_MS so a
  // stalled endpoint cannot hold the function past maxDuration, and never a
  // reason for red. "attempted": submitToIndexNow swallows endpoint errors
  // itself, so a normal return does not prove the endpoints accepted it.
  let indexnow: 'attempted' | 'skipped' | 'failed' | 'timeout' = 'skipped';
  if (batch === 'site' && process.env.VERCEL_ENV === 'production') {
    try {
      const done = await Promise.race([
        submitToIndexNow([`${SITE_ORIGIN}/promos/today`]).then(() => true),
        sleep(INDEXNOW_TIMEOUT_MS).then(() => false),
      ]);
      indexnow = done ? 'attempted' : 'timeout';
    } catch {
      indexnow = 'failed';
    }
  }
  const ms = Date.now() - started;

  // Judged on the end state: every path revalidated, and every path came back
  // fresh. A warm-up timeout that rendered anyway is reported in warmFailed but
  // is not a failure.
  const ok =
    dropped.length === 0 &&
    revalidated.failedBatches.length === 0 &&
    revalidated.revalidated === paths.length &&
    retried.failedBatches.length === 0 &&
    verified.notFresh.length === 0 &&
    verified.fresh === paths.length;
  console.log(
    `[cron:nightly-refresh] batch=${batch} ok=${ok} paths=${paths.length} revalidated=${revalidated.revalidated} warmed=${warmed.ok} fresh=${verified.fresh} notFresh=${verified.notFresh.length} rounds=${verified.rounds} retried=${retried.retried} warmFailed=${warmed.failed.length} cache=${JSON.stringify(warmed.cache)} warmMs=${warmMs} ms=${ms}`,
  );
  return NextResponse.json(
    {
      ok,
      batch,
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
      retryCache: retried.cache,
      retrySkippedForTime: retried.skippedForTime,
      fresh: verified.fresh,
      notFresh: verified.notFresh.slice(0, 20),
      verifyRounds: verified.rounds,
      warmMs,
      ticketTest,
      indexnow,
      ms,
    },
    // A red line in the Cron Jobs log when anything did not land.
    { status: ok ? 200 : 500 },
  );
}
