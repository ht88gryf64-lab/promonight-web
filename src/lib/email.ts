import 'server-only';
import type { DigestPromo, DigestCollection } from './digest';

// Transactional email via the Resend REST API. Intentionally dependency-free
// (a single POST), so there is no SDK to add. RESEND_API_KEY is piped to Vercel
// production; it is absent locally, so send() no-ops with a warning instead of
// throwing, which keeps local dev and the build green and lets the Phase B
// verification exercise the token endpoints directly.

// Verified Resend sending domain + from address.
export const SENDER_FROM = 'PromoNight <promos@mail.getpromonight.com>';

// CAN-SPAM requires a visible physical postal address in every commercial email.
// Single source of truth, rendered in the HTML and text footers of all three
// emails (confirmation, personalized digest, generic digest).
export const SENDER_POSTAL_ADDRESS =
  'Kovalik Digital LLC, 1250 Wayzata Blvd E, Unit #1856, Wayzata, MN 55391';

// True once SENDER_FROM has been changed off the placeholder. The cron execute
// path refuses to send until this is true so we never attempt a live send from
// the unverified placeholder address.
export function isSenderConfigured(): boolean {
  return !SENDER_FROM.includes('REPLACE') && !SENDER_FROM.includes('example.com');
}

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
  // Resend takes Reply-To as a top-level `reply_to` field and IGNORES it when
  // passed inside `headers`, so it gets a first-class arg.
  replyTo?: string;
  // Abort the send after this many ms. Callers on a user-facing request path
  // MUST set this: a degraded Resend otherwise holds the response open until
  // the platform kills the function. Omitted (cron/background) = unbounded,
  // which is the long-standing digest behavior.
  timeoutMs?: number;
}

export async function sendEmail({ to, subject, html, text, headers, replyTo, timeoutMs }: SendArgs): Promise<SendResult> {
  const key = process.env.RESEND_API_KEY;
  if (!key) {
    console.warn(`[email] RESEND_API_KEY not set, skipping send to ${to}`);
    return { ok: false, skipped: true };
  }
  const controller = timeoutMs ? new AbortController() : undefined;
  const timer = controller ? setTimeout(() => controller.abort(), timeoutMs) : undefined;
  try {
    const res = await fetch(RESEND_ENDPOINT, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${key}`,
        'Content-Type': 'application/json',
      },
      // `reply_to` is dropped from the payload when undefined, so existing
      // callers that omit it are unaffected.
      body: JSON.stringify({ from: SENDER_FROM, to, subject, html, text, headers, reply_to: replyTo }),
      signal: controller?.signal,
    });
    if (!res.ok) {
      const body = await res.text().catch(() => '');
      console.error(`[email] Resend send failed ${res.status}: ${body}`);
      return { ok: false, error: `resend_${res.status}` };
    }
    const data = (await res.json().catch(() => ({}))) as { id?: string };
    return { ok: true, id: data.id };
  } catch (e) {
    const timedOut = e instanceof Error && e.name === 'AbortError';
    console.error('[email] Resend send error', e instanceof Error ? e.message : e);
    return { ok: false, error: timedOut ? 'send_timeout' : 'send_exception' };
  } finally {
    clearTimeout(timer);
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

export function esc(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

// CAN-SPAM postal-address line, shared by every email footer (HTML side).
function postalHtml(): string {
  return `<div style="margin-top:10px;font-size:11px;line-height:1.5;color:#a39b8d;">${esc(SENDER_POSTAL_ADDRESS)}</div>`;
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
          ${postalHtml()}
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
    '',
    SENDER_POSTAL_ADDRESS,
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

// ── Weekly digest emails ────────────────────────────────────────────────────
// Both the personalized and generic digests are bulk sends, so each one carries
// the RFC 8058 one-click List-Unsubscribe headers with the RECIPIENT'S OWN
// manage token (Gmail/Yahoo bulk-sender rules require this). The visible
// unsubscribe + manage links use the same token, pointing at the safe
// preferences flow. Both digests point their footer link at the preferences
// page (preferencesUrl), framed "Manage your teams" (personalized) or "Star your
// teams to personalize" (generic) per the settled architecture.

function listUnsubHeaders(manageToken: string): Record<string, string> {
  const unsub = unsubscribeUrl(manageToken);
  return {
    'List-Unsubscribe': `<${unsub}>`,
    'List-Unsubscribe-Post': 'List-Unsubscribe=One-Click',
  };
}

function formatDigestDate(ymd: string): string {
  const [y, m, d] = ymd.split('-').map(Number);
  // Format in UTC from the bare Y-M-D so the weekday/label never shifts by tz.
  const date = new Date(Date.UTC(y, m - 1, d));
  return date.toLocaleDateString('en-US', {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    timeZone: 'UTC',
  });
}

function promoRowHtml(p: DigestPromo): string {
  const teamUrl = `${SITE_URL}/${p.sportSlug}/${p.teamId}`;
  const meta = [p.opponent ? `vs ${esc(p.opponent)}` : '', p.time ? esc(p.time) : '']
    .filter(Boolean)
    .join(' &middot; ');
  return `
          <tr><td style="padding:12px 0;border-bottom:1px solid #efe9dd;">
            <table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr>
              <td width="64" valign="top" style="font-size:12px;color:#8a8276;line-height:1.35;">${esc(formatDigestDate(p.date))}</td>
              <td valign="top">
                <a href="${teamUrl}" style="color:#1d1714;text-decoration:none;font-weight:600;font-size:15px;">${esc(p.icon)} ${esc(p.title)}</a>
                <div style="font-size:12px;color:#8a8276;margin-top:3px;">${esc(p.leagueIcon)} ${esc(p.teamName)}${meta ? ` &middot; ${meta}` : ''}${p.highlight ? ' &middot; <span style="color:#d31145;font-weight:600;">Hot</span>' : ''}</div>
              </td>
            </tr></table>
          </td></tr>`;
}

function digestShellHtml(opts: {
  heading: string;
  sub: string;
  bodyHtml: string;
  footerHtml: string;
}): string {
  return `<!doctype html>
<html lang="en">
<body style="margin:0;padding:0;background:#f4f1ea;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f4f1ea;">
    <tr><td align="center" style="padding:32px 16px;">
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:520px;background:#ffffff;border-radius:16px;overflow:hidden;border:1px solid #e6e1d6;">
        <tr><td style="background:#1d1714;padding:24px 32px;">
          <span style="font-size:20px;font-weight:800;letter-spacing:-0.5px;color:#ffffff;">PROMO<span style="color:#ff5a4d;">NIGHT</span></span>
        </td></tr>
        <tr><td style="padding:28px 32px 6px;">
          <h1 style="margin:0 0 4px;font-size:20px;line-height:1.25;color:#1d1714;">${esc(opts.heading)}</h1>
          <p style="margin:0;font-size:14px;color:#6b6459;">${esc(opts.sub)}</p>
        </td></tr>
        <tr><td style="padding:6px 32px 24px;">
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0">${opts.bodyHtml}</table>
        </td></tr>
        <tr><td style="padding:20px 32px;border-top:1px solid #e6e1d6;">${opts.footerHtml}</td></tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`;
}

function personalizedFooterHtml(manageToken: string): string {
  const manage = preferencesUrl(manageToken);
  const unsub = `${manage}&unsub=1`;
  return `<p style="margin:0;font-size:12px;line-height:1.6;color:#8a8276;">You are getting this because you follow these teams on PromoNight. <a href="${manage}" style="color:#8a8276;">Manage your teams</a> &middot; <a href="${unsub}" style="color:#8a8276;">Unsubscribe</a></p>${postalHtml()}`;
}

function genericFooterHtml(manageToken: string): string {
  const manage = preferencesUrl(manageToken);
  const unsub = `${manage}&unsub=1`;
  return `<p style="margin:0;font-size:12px;line-height:1.6;color:#8a8276;"><a href="${manage}" style="color:#d31145;font-weight:600;">Star your teams to personalize</a> this email. &middot; <a href="${unsub}" style="color:#8a8276;">Unsubscribe</a></p>${postalHtml()}`;
}

export async function sendPersonalizedDigest(args: {
  email: string;
  manageToken: string;
  promos: DigestPromo[];
  // True pre-cap count, so the heading is honest and an overflow note shows
  // when the list was truncated rather than silently dropping later promos.
  total: number;
}): Promise<SendResult> {
  const overflow = Math.max(0, args.total - args.promos.length);
  const overflowHtml =
    overflow > 0
      ? `<tr><td style="padding:14px 0 0;font-size:13px;color:#6b6459;">and ${overflow} more this week. <a href="${SITE_URL}" style="color:#d31145;text-decoration:none;">See all on PromoNight</a></td></tr>`
      : '';
  const html = digestShellHtml({
    heading: 'Your teams this week',
    sub: `${args.total} promo${args.total === 1 ? '' : 's'} coming up for the teams you follow.`,
    bodyHtml: args.promos.map(promoRowHtml).join('') + overflowHtml,
    footerHtml: personalizedFooterHtml(args.manageToken),
  });
  const manage = preferencesUrl(args.manageToken);
  const text = [
    'Your teams this week on PromoNight',
    '',
    ...args.promos.map(
      (p) => `- ${formatDigestDate(p.date)}: ${p.title} (${p.teamName}) ${SITE_URL}/${p.sportSlug}/${p.teamId}`,
    ),
    ...(overflow > 0 ? [`...and ${overflow} more this week: ${SITE_URL}`] : []),
    '',
    `Manage your teams: ${manage}`,
    `Unsubscribe: ${manage}&unsub=1`,
    '',
    SENDER_POSTAL_ADDRESS,
  ].join('\n');

  return sendEmail({
    to: args.email,
    subject: "Your teams' promos this week on PromoNight",
    html,
    text,
    headers: listUnsubHeaders(args.manageToken),
  });
}

export async function sendGenericDigest(args: {
  email: string;
  manageToken: string;
  featured: DigestPromo[];
  collections: DigestCollection[];
}): Promise<SendResult> {
  const collectionsHtml =
    `<tr><td style="padding:16px 0 0;">` +
    args.collections
      .map(
        (c) =>
          `<a href="${SITE_URL}${c.href}" style="display:inline-block;margin:0 8px 8px 0;padding:7px 12px;border:1px solid #e6e1d6;border-radius:999px;color:#1d1714;text-decoration:none;font-size:13px;">${esc(c.label)}</a>`,
      )
      .join('') +
    `</td></tr>`;
  const html = digestShellHtml({
    heading: "This week's hottest promos",
    sub: 'The biggest giveaways, theme nights, and food deals across the leagues this week.',
    bodyHtml: args.featured.map(promoRowHtml).join('') + collectionsHtml,
    footerHtml: genericFooterHtml(args.manageToken),
  });
  const manage = preferencesUrl(args.manageToken);
  const text = [
    "This week's hottest promos on PromoNight",
    '',
    ...args.featured.map((p) => `- ${formatDigestDate(p.date)}: ${p.title} (${p.teamName})`),
    '',
    'Browse:',
    ...args.collections.map((c) => `- ${c.label}: ${SITE_URL}${c.href}`),
    '',
    `Star your teams to personalize: ${manage}`,
    `Unsubscribe: ${manage}&unsub=1`,
    '',
    SENDER_POSTAL_ADDRESS,
  ].join('\n');

  return sendEmail({
    to: args.email,
    subject: "This week's hottest pro sports promos",
    html,
    text,
    headers: listUnsubHeaders(args.manageToken),
  });
}
