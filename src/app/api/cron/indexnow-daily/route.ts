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
 * Schedule: see vercel.json ("crons"). 05:10 UTC daily, just past America/New_York
 * midnight year-round (04:00 UTC in EDT, 05:00 UTC in EST), so it fires after the
 * site's "today" boundary flips (src/lib/site-today.ts). It was 06:10 UTC, after
 * Chicago midnight, until WEB6 G3 (2026-10-06).
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
