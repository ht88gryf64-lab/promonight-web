/**
 * GET /api/cron/promo-reminders
 *
 * The day-before promo reminders (Gate 1 rulings, 2026-11-26). Hourly. Each
 * run reconciles every scheduled reminder against its promo (a moved date, a
 * rescheduled game's new row, a removed promo), then emails the ones whose
 * moment has come: 10:00 in the venue's zone on the day before the game, to
 * confirmed subscribers only. The rules are src/lib/reminder-core.ts; the
 * reads, writes and the send are src/lib/reminders.ts.
 *
 * Auth: CRON_SECRET bearer, as /api/cron/weekly-digest.
 *
 * THE SCHEDULED RUN SENDS. vercel.json calls this path with ?execute=true.
 * Without it (a manual call) the route is a dry run: it reads, writes
 * nothing, sends nothing, and returns what an execute run would do now.
 *
 * Execute is guarded as the digest's is: it refuses (409) unless the sender
 * is configured, and refuses when the run would send more than the per-run
 * ceiling (override with &overCap=true). A reminder is claimed before its
 * send, so an overlapping run cannot send it twice. A missed hour heals on
 * the next one: a reminder stays due until its game day begins.
 *
 * NO SILENT FAILURES. A refused execute, a thrown exception, failed sends and
 * reminders left in `sending` by an earlier run each mail the operator once
 * (lib/reminder-alert.ts). The 503 and 401 exits do not alert: they are
 * reachable without the secret.
 *
 * COUNTS, NEVER ADDRESSES, in the response and in the logs.
 */

import { NextResponse } from 'next/server';
import { isSenderConfigured } from '@/lib/email';
import { firestoreReminderDeps } from '@/lib/reminders';
import { runReminders, type ReminderRunSummary } from '@/lib/reminder-core';
import { notifyReminderFailure, type ReminderAlert } from '@/lib/reminder-alert';

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

  const url = new URL(request.url);
  const execute = url.searchParams.get('execute') === 'true';
  const overCap = url.searchParams.get('overCap') === 'true';
  const mode = execute ? 'execute' : 'dry-run';
  const startedAt = Date.now();

  // At most ONE operator alert per request, whatever path fails.
  let alerted = false;
  let summary: ReminderRunSummary | null = null;
  const alert = async (a: Pick<ReminderAlert, 'reason' | 'detail'>) => {
    if (alerted) return;
    alerted = true;
    await notifyReminderFailure({
      mode,
      scheduled: summary?.scheduled ?? null,
      ...(summary ? { toSend: summary.toSend } : {}),
      ...(summary && execute && !summary.aborted ? { sent: summary.sent, failed: summary.failed } : {}),
      ...a,
    });
  };

  try {
    // Refuse to send from an unconfigured sender, rather than claiming
    // reminders and failing each one.
    if (execute && (!isSenderConfigured() || !process.env.RESEND_API_KEY)) {
      const detail = 'Set SENDER_FROM (src/lib/email.ts) to a verified Resend sender and configure RESEND_API_KEY before executing.';
      await alert({ reason: 'sender_not_configured', detail });
      return NextResponse.json({ ok: false, reason: 'sender_not_configured', detail, mode }, { status: 409 });
    }

    const now = new Date();
    summary = await runReminders(firestoreReminderDeps(now), { now, execute, overCap, clock: () => new Date() });
    const durationMs = Date.now() - startedAt;
    console.log(`[cron:promo-reminders] ${JSON.stringify({ ...summary, durationMs })}`);

    if (summary.aborted) {
      const detail = `${summary.toSend} reminders are due, above the ${summary.ceiling} per-run ceiling. Re-run with &overCap=true to send anyway.`;
      await alert({ reason: summary.aborted, detail });
      return NextResponse.json({ ok: false, reason: summary.aborted, detail, ...summary, durationMs }, { status: 409 });
    }
    if (execute && (summary.failed > 0 || summary.errored > 0)) {
      await alert({
        reason: 'send_failures',
        detail: `${summary.failed} of ${summary.sent + summary.failed} sends failed; ${summary.errored} reminder(s) could not be read or reconciled; ${summary.stuckSending} left in "sending" by an earlier run.`,
      });
    } else if (execute && summary.stuckSending > 0) {
      await alert({
        reason: 'stuck_sending',
        detail: `${summary.stuckSending} reminder(s) were claimed by an earlier run and never settled. They are not retried (a second email is the worse failure); check the promoReminders documents in state "sending".`,
      });
    }
    return NextResponse.json({ ok: !execute || (summary.failed === 0 && summary.errored === 0), ...summary, durationMs });
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    console.error(`[cron:promo-reminders] run threw: ${message}`);
    await alert({ reason: 'exception', detail: message });
    return NextResponse.json({ ok: false, reason: 'exception', detail: message, mode }, { status: 500 });
  }
}
