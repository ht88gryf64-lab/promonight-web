import 'server-only';
import { sendEmail } from '@/lib/email';

// Operator notification for the weekly digest cron.
//
// WHY THIS EXISTS. From 2026-10-20 to 2026-11-03 the digest cron ran every
// Tuesday and aborted itself every Tuesday (a stale 100/day free-tier guard
// against 114 recipients). The abort was a 409 plus a console.warn, so three
// digests were lost and nobody was told. Every abort and every caught
// exception in /api/cron/weekly-digest now mails the operator before the route
// returns.
//
// Internal ops mail (owner -> owner), not commercial email: plain text, no
// CAN-SPAM footer, no unsubscribe. It never carries a subscriber address, only
// counts.
//
// CONTRACT: notifyDigestFailure NEVER THROWS. It is called on the way out of a
// failure, so an error in here must not replace the error being reported.
// sendEmail() already never throws by contract; the try/catch below covers
// building the message as well. It does not call back into the digest route,
// so it cannot recurse, and the route invokes it at most once per request.

// Same owner inbox the CFB contribution notice uses (src/lib/cfb/notify.ts).
export const DIGEST_OPERATOR_EMAIL = 'kovalikdigital@gmail.com';

// Bounded so a degraded Resend cannot hold a failing cron invocation open
// until the platform kills it (which would also drop the route's own logs).
const ALERT_SEND_TIMEOUT_MS = 8_000;

export interface DigestAlert {
  /** Machine reason, e.g. exceeds_send_ceiling, exception. */
  reason: string;
  /** Human detail: the guard's message or the exception message. */
  detail?: string;
  mode: 'execute' | 'dry-run';
  /** Null when the failure happened before the window was computed. */
  window: { start: string; end: string } | null;
  /** Planned emails this run. Null when the failure happened before the plan was built. */
  recipients: number | null;
  /** Set only when sends were attempted. */
  sent?: number;
  failed?: number;
}

/** Header-injection guard: the subject must be a single line. */
const oneLine = (s: string) => s.replace(/[\r\n]+/g, ' ').trim();

export function digestAlertMessage(a: DigestAlert): { subject: string; text: string } {
  const attempted = a.sent !== undefined || a.failed !== undefined;
  const headline = attempted
    ? 'The weekly digest finished with failed sends.'
    : 'The weekly digest did not send.';
  const lines = [
    headline,
    '',
    `Reason: ${a.reason}`,
    ...(a.detail ? [`Detail: ${a.detail}`] : []),
    `Mode: ${a.mode}`,
    `Window: ${a.window ? `${a.window.start} to ${a.window.end}` : 'unknown (failed before the window was computed)'}`,
    `Recipients: ${a.recipients ?? 'unknown (failed before the plan was built)'}`,
    ...(attempted ? [`Sent: ${a.sent ?? 0}`, `Failed: ${a.failed ?? 0}`] : []),
    'Route: /api/cron/weekly-digest',
    '',
    'Function logs for this invocation carry the full summary line ([cron:weekly-digest]).',
  ];
  const subject = oneLine(
    `[PromoNight] Weekly digest ${attempted ? 'had failed sends' : 'did not send'}: ${a.reason}`,
  );
  return { subject, text: lines.join('\n') };
}

/** Mails the operator. Resolves true when Resend accepted it. Never throws. */
export async function notifyDigestFailure(a: DigestAlert): Promise<boolean> {
  try {
    const { subject, text } = digestAlertMessage(a);
    const res = await sendEmail({
      to: DIGEST_OPERATOR_EMAIL,
      subject,
      text,
      timeoutMs: ALERT_SEND_TIMEOUT_MS,
    });
    if (!res.ok) {
      console.error(
        `[cron:weekly-digest] operator alert NOT delivered (reason=${a.reason}): ${res.skipped ? 'RESEND_API_KEY not set' : res.error ?? 'unknown'}`,
      );
    }
    return res.ok;
  } catch (e) {
    console.error(
      `[cron:weekly-digest] operator alert threw (reason=${a.reason}): ${e instanceof Error ? e.message : e}`,
    );
    return false;
  }
}
