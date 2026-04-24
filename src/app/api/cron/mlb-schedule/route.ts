/**
 * GET /api/cron/mlb-schedule
 *
 * Weekly Vercel Cron: refresh the `games` Firestore collection from the MLB
 * Stats API. Picks up reschedules, status changes (postponed/canceled/
 * completed), and postseason additions as MLB publishes them.
 *
 * Schedule: see vercel.json ("crons"). Current cadence: Mondays 10:00 UTC.
 *
 * Auth: Vercel Cron invocations carry `Authorization: Bearer <CRON_SECRET>`
 * automatically when CRON_SECRET is set as an env var in the project. We
 * reject anything without a matching bearer so the route isn't public.
 */

import { NextResponse } from 'next/server';
import { ingestMlbSchedule } from '@/lib/ingest-mlb';

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

  const startedAt = Date.now();
  try {
    const stats = await ingestMlbSchedule({
      log: (m) => console.log(`[cron:mlb-schedule] ${m}`),
    });
    const durationMs = Date.now() - startedAt;
    console.log(`[cron:mlb-schedule] done in ${durationMs}ms — upserted=${stats.upserted} errors=${stats.errors}`);
    return NextResponse.json({ ok: stats.errors === 0, durationMs, ...stats });
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    console.error(`[cron:mlb-schedule] ${message}`);
    return NextResponse.json({ ok: false, reason: 'ingest_error', message }, { status: 500 });
  }
}
