import 'server-only';

// Transactional email via the Resend REST API. Intentionally dependency-free
// (a single POST), so there is no SDK to add. RESEND_API_KEY is piped to Vercel
// production; it is absent locally, so send() no-ops with a warning instead of
// throwing, which keeps local dev and the build green and lets the Phase B
// verification exercise the token endpoints directly.

// =============================================================================
// TODO(user): SET THIS BEFORE SHIPPING PHASE B LIVE.
// Replace with your verified Resend sending domain + from address, e.g.
// 'PromoNight <promos@mail.getpromonight.com>'. Resend rejects sends from an
// unverified domain, so confirmation emails will fail until this is real. Do
// not invent a domain here.
export const SENDER_FROM = 'PromoNight <REPLACE_WITH_VERIFIED_SENDER@example.com>';
// =============================================================================

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || 'https://www.getpromonight.com';
const RESEND_ENDPOINT = 'https://api.resend.com/emails';

export interface SendResult {
  ok: boolean;
  id?: string;
  // True when the send was skipped because RESEND_API_KEY is not configured.
  skipped?: boolean;
  error?: string;
}

interface SendArgs {
  to: string;
  subject: string;
  html: string;
  text: string;
  headers?: Record<string, string>;
}

export async function sendEmail({ to, subject, html, text, headers }: SendArgs): Promise<SendResult> {
  const key = process.env.RESEND_API_KEY;
  if (!key) {
    console.warn(`[email] RESEND_API_KEY not set, skipping send to ${to}`);
    return { ok: false, skipped: true };
  }
  try {
    const res = await fetch(RESEND_ENDPOINT, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${key}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ from: SENDER_FROM, to, subject, html, text, headers }),
    });
    if (!res.ok) {
      const body = await res.text().catch(() => '');
      console.error(`[email] Resend send failed ${res.status}: ${body}`);
      return { ok: false, error: `resend_${res.status}` };
    }
    const data = (await res.json().catch(() => ({}))) as { id?: string };
    return { ok: true, id: data.id };
  } catch (e) {
    console.error('[email] Resend send error', e instanceof Error ? e.message : e);
    return { ok: false, error: 'send_exception' };
  }
}

// ── Absolute link builders (emails need absolute URLs) ──────────────────────

export function confirmUrl(confirmToken: string): string {
  return `${SITE_URL}/api/confirm?token=${encodeURIComponent(confirmToken)}`;
}

export function unsubscribeUrl(manageToken: string): string {
  return `${SITE_URL}/api/unsubscribe?token=${encodeURIComponent(manageToken)}`;
}

export function preferencesUrl(manageToken: string): string {
  return `${SITE_URL}/preferences?token=${encodeURIComponent(manageToken)}`;
}

// ── Confirmation email ──────────────────────────────────────────────────────

function esc(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function confirmationHtml(email: string, confirm: string, manageUnsub: string): string {
  return `<!doctype html>
<html lang="en">
<body style="margin:0;padding:0;background:#f4f1ea;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f4f1ea;">
    <tr><td align="center" style="padding:32px 16px;">
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:480px;background:#ffffff;border-radius:16px;overflow:hidden;border:1px solid #e6e1d6;">
        <tr><td style="background:#1d1714;padding:28px 32px;">
          <span style="font-size:22px;font-weight:800;letter-spacing:-0.5px;color:#ffffff;">PROMO<span style="color:#ff5a4d;">NIGHT</span></span>
        </td></tr>
        <tr><td style="padding:32px;">
          <h1 style="margin:0 0 12px;font-size:22px;line-height:1.25;color:#1d1714;">Confirm your subscription</h1>
          <p style="margin:0 0 8px;font-size:15px;line-height:1.6;color:#4b463f;">
            Tap below to confirm <strong>${esc(email)}</strong> and start getting one weekly
            email with every giveaway, theme night, and food deal for the teams you follow.
          </p>
          <table role="presentation" cellpadding="0" cellspacing="0" style="margin:24px 0;">
            <tr><td style="border-radius:12px;background:#d31145;">
              <a href="${confirm}" style="display:inline-block;padding:14px 28px;font-size:16px;font-weight:600;color:#ffffff;text-decoration:none;">Confirm my email</a>
            </td></tr>
          </table>
          <p style="margin:0;font-size:13px;line-height:1.6;color:#8a8276;">
            If the button does not work, paste this link into your browser:<br>
            <a href="${confirm}" style="color:#d31145;word-break:break-all;">${confirm}</a>
          </p>
        </td></tr>
        <tr><td style="padding:20px 32px;border-top:1px solid #e6e1d6;">
          <p style="margin:0;font-size:12px;line-height:1.6;color:#8a8276;">
            You received this because someone entered this address on getpromonight.com. If that
            was not you, ignore this email or <a href="${manageUnsub}" style="color:#8a8276;">unsubscribe</a>.
          </p>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`;
}

export async function sendConfirmationEmail(sub: {
  email: string;
  confirmToken: string;
  manageToken: string;
}): Promise<SendResult> {
  const confirm = confirmUrl(sub.confirmToken);
  // Header target: hit by RFC 8058 one-click (POST, mutates) and, if a scanner
  // GETs it, redirects harmlessly. Visible link: the preferences page, which
  // requires a human click to actually unsubscribe (no write-on-GET).
  const unsub = unsubscribeUrl(sub.manageToken);
  const manageUnsub = `${preferencesUrl(sub.manageToken)}&unsub=1`;
  const text = [
    'Confirm your PromoNight subscription:',
    confirm,
    '',
    'If you did not sign up, ignore this email or unsubscribe:',
    manageUnsub,
  ].join('\n');

  return sendEmail({
    to: sub.email,
    subject: 'Confirm your PromoNight email',
    html: confirmationHtml(sub.email, confirm, manageUnsub),
    text,
    headers: {
      // One-click unsubscribe (RFC 8058) for inbox-provider native controls.
      'List-Unsubscribe': `<${unsub}>`,
      'List-Unsubscribe-Post': 'List-Unsubscribe=One-Click',
    },
  });
}
