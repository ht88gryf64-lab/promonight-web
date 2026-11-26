import 'server-only';
import { sendEmail } from '@/lib/email';
import { DIGEST_OPERATOR_EMAIL } from '@/lib/digest-alert';

// Operator notification for the promo reminder cron, the sibling of
// lib/digest-alert.ts with the same contract and the same inbox.
//
// Internal ops mail (owner to owner): plain text, no CAN-SPAM footer, no
// unsubscribe. It never carries a subscriber address, only counts.
//
// CONTRACT: notifyReminderFailure NEVER THROWS. It is called on the way out
// of a failure, so an error in here must not replace the error being
// reported. It does not call back into the route, and the route invokes it at
// most once per request.

const ALERT_SEND_TIMEOUT_MS = 8_000;

export interface ReminderAlert {
  /** Machine reason: exception, sender_not_configured, exceeds_send_ceiling,
   *  send_failures, stuck_sending. */
  reason: string;
  detail?: string;
  mode: 'execute' | 'dry-run';
  /** Null when the failure happened before the reminders were read. */
  scheduled: number | null;
  toSend?: number;
  sent?: number;
  failed?: number;
}

/** Header-injection guard: the subject must be a single line. */
const oneLine = (s: string) => s.replace(/[\r\n]+/g, ' ').trim();

export function reminderAlertMessage(a: ReminderAlert): { subject: string; text: string } {
  const attempted = a.sent !== undefined || a.failed !== undefined;
  const lines = [
    attempted ? 'The promo reminder run finished with a problem.' : 'The promo reminder run did not send.',
    '',
    `Reason: ${a.reason}`,
    ...(a.detail ? [`Detail: ${a.detail}`] : []),
    `Mode: ${a.mode}`,
    `Scheduled reminders: ${a.scheduled ?? 'unknown (failed before they were read)'}`,
    ...(a.toSend !== undefined ? [`Due to send: ${a.toSend}`] : []),
    ...(attempted ? [`Sent: ${a.sent ?? 0}`, `Failed: ${a.failed ?? 0}`] : []),
    'Route: /api/cron/promo-reminders',
    '',
    'The run is hourly: a reminder that did not go out is retried on the next run while it is still the day before its game.',
    'Function logs for this invocation carry the full summary line ([cron:promo-reminders]).',
  ];
  return { subject: oneLine(`[PromoNight] Promo reminders: ${a.reason}`), text: lines.join('\n') };
}

/** Mails the operator. Resolves true when Resend accepted it. Never throws. */
export async function notifyReminderFailure(a: ReminderAlert): Promise<boolean> {
  try {
    const { subject, text } = reminderAlertMessage(a);
    const res = await sendEmail({ to: DIGEST_OPERATOR_EMAIL, subject, text, timeoutMs: ALERT_SEND_TIMEOUT_MS });
    if (!res.ok) {
      console.error(`[cron:promo-reminders] operator alert NOT delivered (reason=${a.reason}): ${res.skipped ? 'RESEND_API_KEY not set' : res.error ?? 'unknown'}`);
    }
    return res.ok;
  } catch (e) {
    console.error(`[cron:promo-reminders] operator alert threw (reason=${a.reason}): ${e instanceof Error ? e.message : e}`);
    return false;
  }
}
