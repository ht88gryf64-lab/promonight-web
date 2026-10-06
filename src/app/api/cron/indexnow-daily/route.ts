/**
 * GET /api/cron/indexnow-daily
 *
 * Daily Vercel Cron for /promos/today. Three steps, each best-effort:
 *   1. revalidatePath('/promos/today') — invalidate the 1h ISR cache so the next
 *      render picks up the new date the moment the site's day rolls over.
 *   2. Warm the path with a fetch so the fresh (today-dated) HTML is regenerated
 *      and cached before the first visitor / crawler, closing the
 *      stale-while-revalidate gap that would otherwise show yesterday's date.
 *   3. submitToIndexNow([...]) — ping api.indexnow.org + Bing so Google/Bing
 *      re-crawl the freshly regenerated page daily.
 *
 * RETIRED FROM THE CRON CONFIG (WEB6 G4, Matt, 2026-10-06). It ran at 05:10 UTC,
 * but its warm step could not work: Next applies revalidatePath when the request
 * that called it finishes, so a fetch inside the same request got the old copy.
 * The nightly refresh (/api/cron/nightly-refresh, 00:15 Eastern) now rebuilds
 * /promos/today through POST /api/revalidate. The route stays callable by hand
 * (CRON_SECRET) for its IndexNow ping; nothing schedules it.
 *
 * Auth: Vercel Cron invocations carry `Authorization: Bearer <CRON_SECRET>`
 * automatically when CRON_SECRET is set. We reject anything without a matching
 * bearer so the route isn't public (mirrors /api/cron/mlb-schedule).
 */

import { NextResponse } from 'next/server';
import { revalidatePath } from 'next/cache';
import { submitToIndexNow } from '@/lib/indexnow';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 60;

const TODAY_URL = 'https://www.getpromonight.com/promos/today';

export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret) {
    return NextResponse.json({ ok: false, reason: 'not_configured' }, { status: 503 });
  }
  if (request.headers.get('authorization') !== `Bearer ${secret}`) {
    return NextResponse.json({ ok: false, reason: 'unauthorized' }, { status: 401 });
  }

  const result = { revalidated: false, warmed: false, submitted: false };

  try {
    revalidatePath('/promos/today');
    result.revalidated = true;
  } catch (e) {
    console.warn('[cron:indexnow-daily] revalidatePath failed:', e);
  }

  try {
    await fetch(TODAY_URL, { cache: 'no-store' });
    result.warmed = true;
  } catch (e) {
    console.warn('[cron:indexnow-daily] warm fetch failed:', e);
  }

  try {
    await submitToIndexNow([TODAY_URL]);
    result.submitted = true;
  } catch (e) {
    console.error('[cron:indexnow-daily] indexnow failed:', e);
  }

  return NextResponse.json({ ok: true, ...result });
}
