import 'server-only';
import type { DigestContext, DigestPromo } from './digest';
import { renderDigest, teamListLabel, windowLabel, type DigestEmailInput } from './digest-email';
import type { CascadeLevel } from './geo/local-promos';

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
  // Optional so ops notices (lib/digest-alert.ts) can go out as plain text.
  // Resend accepts a text-only send; an undefined html drops out of the JSON.
  html?: string;
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

// ── Email text ramp ─────────────────────────────────────────────────────────
//
// THIS IS DELIBERATELY A SEPARATE PALETTE FROM THE SITE'S INK RAMP, and it has
// to be. Email cannot read CSS custom properties: Gmail strips <style>, Outlook
// renders through Word, and var() is unsupported across the major clients, so
// every color here has to be an inline literal hex. There is no mechanism by
// which this file could consume --color-rd-ink-soft at render time.
//
// What is shared is the STANDARD, not the token. Every tone below clears WCAG
// 1.4.3 (4.5:1) against EMAIL_CARD, which is the only ground any text in this
// file renders on: the beige frame is a gutter with no text in it, and the dark
// bar carries only the wordmark. The quietest tier borrows the site's
// ink-faint value outright, because it is the same job and that value is
// already the proven floor.
//
//   const              value     on the white card
//   EMAIL_INK          #1d1714   17.72   headings, promo titles
//   EMAIL_INK_BODY     #4b463f    9.35   body prose
//   EMAIL_INK_SOFT     #6b6459    5.85   sub-headlines, overflow lines
//   EMAIL_INK_FAINT    #786e60    5.00   dates, meta, footers, postal line
//   EMAIL_RED          #d31145    5.34   links and the CTA fill
//
// These were literals scattered across 28 sites, which is how the two failing
// tones drifted below AA without anyone noticing. Guarded by
// src/lib/__tests__/email-contrast.test.ts.
const EMAIL_CARD = '#ffffff';
const EMAIL_INK = '#1d1714';
const EMAIL_INK_BODY = '#4b463f';
const EMAIL_INK_SOFT = '#6b6459';
const EMAIL_INK_FAINT = '#786e60';
const EMAIL_RED = '#d31145';
/** Only ever used on the dark bar, where they are 17.72:1 and 5.76:1. */
const EMAIL_ON_DARK = '#ffffff';
const EMAIL_ACCENT_ON_DARK = '#ff5a4d';

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
  return `<div style="margin-top:10px;font-size:11px;line-height:1.5;color:${EMAIL_INK_FAINT};">${esc(SENDER_POSTAL_ADDRESS)}</div>`;
}

function confirmationHtml(email: string, confirm: string, manageUnsub: string): string {
  return `<!doctype html>
<html lang="en">
<body style="margin:0;padding:0;background:#f4f1ea;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f4f1ea;">
    <tr><td align="center" style="padding:32px 16px;">
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:480px;background:#ffffff;border-radius:16px;overflow:hidden;border:1px solid #e6e1d6;">
        <tr><td style="background:#1d1714;padding:28px 32px;">
          <span style="font-size:22px;font-weight:800;letter-spacing:-0.5px;color:${EMAIL_ON_DARK};">PROMO<span style="color:${EMAIL_ACCENT_ON_DARK};">NIGHT</span></span>
        </td></tr>
        <tr><td style="padding:32px;">
          <h1 style="margin:0 0 12px;font-size:22px;line-height:1.25;color:${EMAIL_INK};">Confirm your subscription</h1>
          <p style="margin:0 0 8px;font-size:15px;line-height:1.6;color:${EMAIL_INK_BODY};">
            Tap below to confirm <strong>${esc(email)}</strong> and start getting one weekly
            email with every giveaway, theme night, and food deal for the teams you follow.
          </p>
          <table role="presentation" cellpadding="0" cellspacing="0" style="margin:24px 0;">
            <tr><td style="border-radius:12px;background:#d31145;">
              <a href="${confirm}" style="display:inline-block;padding:14px 28px;font-size:16px;font-weight:600;color:${EMAIL_ON_DARK};text-decoration:none;">Confirm my email</a>
            </td></tr>
          </table>
          <p style="margin:0;font-size:13px;line-height:1.6;color:${EMAIL_INK_FAINT};">
            If the button does not work, paste this link into your browser:<br>
            <a href="${confirm}" style="color:${EMAIL_RED};word-break:break-all;">${confirm}</a>
          </p>
        </td></tr>
        <tr><td style="padding:20px 32px;border-top:1px solid #e6e1d6;">
          <p style="margin:0;font-size:12px;line-height:1.6;color:${EMAIL_INK_FAINT};">
            You received this because someone entered this address on getpromonight.com. If that
            was not you, ignore this email or <a href="${manageUnsub}" style="color:${EMAIL_INK_FAINT};">unsubscribe</a>.
          </p>
          ${postalHtml()}
        </td></tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`;
}

// This send sits on the signup request, so it is bounded, matching the CFB
// contribution notice (src/lib/cfb/notify.ts:18-20) which uses the same value
// for the same reason. Keep the two in step.
//
// The subscriber record is already committed by the time we get here, so a slow
// Resend must not hold the response open. Unbounded, a degraded Resend keeps
// the invocation alive until the platform kills it, and a killed invocation
// runs no catch, flushes no console.error, writes no request log line and
// leaves no Resend record: the signup vanishes with no trace anywhere. That is
// what silently dropped a first-ever signup on 2026-07-30
// (docs/known-issues.md entry 5). Bounded, the same failure surfaces as
// {ok:false, error:'send_timeout'}, which the route logs at error level and
// which leaves confirmationSentAt unset so the next submit re-sends.
const CONFIRMATION_SEND_TIMEOUT_MS = 8_000;

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
    timeoutMs: CONFIRMATION_SEND_TIMEOUT_MS,
  });
}

// ── Weekly digest emails ────────────────────────────────────────────────────
// Redesigned 2026-11-05 (docs/digest-redesign/digest-redesign-spec.md). The
// markup lives in src/lib/digest-email.ts, ONE renderer for all three
// variants; these senders build its input, keep the subjects and headers they
// always had, and send.
//
// Every digest is a bulk send, so each carries the RFC 8058 one-click
// List-Unsubscribe headers with the RECIPIENT'S OWN manage token (Gmail/Yahoo
// bulk-sender rules require this). The visible manage and unsubscribe links use
// the same token and point at the preferences flow.

function listUnsubHeaders(manageToken: string): Record<string, string> {
  const unsub = unsubscribeUrl(manageToken);
  return {
    'List-Unsubscribe': `<${unsub}>`,
    'List-Unsubscribe-Post': 'List-Unsubscribe=One-Click',
  };
}

// ── Email attribution surfaces ──────────────────────────────────────────────
// Per-promo links land on the promo page (or the team page when the promo has
// none). They carry the affiliate subId1 convention (`${surface}_${team.id}`,
// see lib/affiliates.ts) as a query param so email-driven sessions are
// sliceable in PostHog on the same join key the on-page CTAs stamp onto their
// outbound partner URLs. The three variants use distinct surfaces.
export const EMAIL_SURFACE_PERSONALIZED = 'web_email_personalized';
export const EMAIL_SURFACE_GENERIC = 'web_email_generic';
// The empty-window variant (a personalized subscriber whose teams are quiet).
export const EMAIL_SURFACE_EMPTY = 'web_email_empty';

/** The direct ticket link on the hero is held until TicketNetwork approves
 *  email marketing (decided 2026-11-05). Read per send, so the switch is the
 *  env var alone. Anything but the exact string "true" is off. */
export function isTicketNetworkEmailApproved(env: NodeJS.ProcessEnv = process.env): boolean {
  return env.TICKETNETWORK_EMAIL_APPROVED === 'true';
}

export interface BuiltDigest {
  subject: string;
  html: string;
  text: string;
  headers: Record<string, string>;
  hero: DigestPromo | null;
}

function baseInput(manageToken: string, context: DigestContext) {
  return {
    siteUrl: SITE_URL,
    manageToken,
    context,
    ticketsApproved: isTicketNetworkEmailApproved(),
    postalAddress: SENDER_POSTAL_ADDRESS,
  };
}

function teamNamesFor(teamIds: string[], context: DigestContext): string[] {
  return teamIds.map((id) => context.teams.get(id)?.name ?? id);
}

function built(subject: string, manageToken: string, input: DigestEmailInput): BuiltDigest {
  const { html, text, hero } = renderDigest(input);
  return { subject, html, text, headers: listUnsubHeaders(manageToken), hero };
}

export interface PersonalizedDigestArgs {
  email: string;
  manageToken: string;
  promos: DigestPromo[];
  // True pre-cap count, so the overflow note shows when the list was
  // truncated rather than silently dropping later promos.
  total: number;
  /** The subscriber's followed teams: the subline names them and "Coming up"
   *  reads their next promos past the window. */
  teamIds: string[];
  context: DigestContext;
}

export function buildPersonalizedDigest(args: PersonalizedDigestArgs): BuiltDigest {
  return built("Your teams' promos this week on PromoNight", args.manageToken, {
    ...baseInput(args.manageToken, args.context),
    variant: 'personalized',
    surface: EMAIL_SURFACE_PERSONALIZED,
    title: 'This week for your teams',
    subline: [windowLabel(args.context.window), teamListLabel(teamNamesFor(args.teamIds, args.context))].filter(Boolean).join(' · '),
    promos: args.promos,
    overflow: Math.max(0, args.total - args.promos.length),
    followedTeamIds: args.teamIds,
    heroAllowed: true,
    leadIn: null,
  });
}

export async function sendPersonalizedDigest(args: PersonalizedDigestArgs & { email: string }): Promise<SendResult> {
  const b = buildPersonalizedDigest(args);
  return sendEmail({ to: args.email, subject: b.subject, html: b.html, text: b.text, headers: b.headers });
}

export interface GenericDigestArgs {
  email: string;
  manageToken: string;
  featured: DigestPromo[];
  context: DigestContext;
}

export function buildGenericDigest(args: GenericDigestArgs): BuiltDigest {
  return built("This week's hottest pro sports promos", args.manageToken, {
    ...baseInput(args.manageToken, args.context),
    variant: 'generic',
    surface: EMAIL_SURFACE_GENERIC,
    title: 'Hot promos this week',
    subline: windowLabel(args.context.window),
    promos: args.featured,
    overflow: 0,
    followedTeamIds: [],
    heroAllowed: true,
    leadIn: null,
  });
}

export async function sendGenericDigest(args: GenericDigestArgs): Promise<SendResult> {
  const b = buildGenericDigest(args);
  return sendEmail({ to: args.email, subject: b.subject, html: b.html, text: b.text, headers: b.headers });
}

// ── Empty-window variant ─────────────────────────────────────────────────────
// A personalized subscriber whose followed teams have NOTHING in the window
// (spec v2, "Empty-window variant"). The title names their team(s) and the
// subline carries the window and those teams, as the personalized email's
// does. The rows are the cascade's content: nearby promos on team-proxy, the
// national featured set on national-fallback, under a muted lead-in that says
// which. The hero fires on team-proxy content only: a subscriber whose team is
// dark gets no big card for a club across the country. "Coming up" still
// reads the subscriber's OWN teams.

// "the Minnesota Twins" / "the A and B" / "the A, B, and C". One leading "the".
function naturalTeamList(names: string[]): string {
  if (names.length === 0) return 'your teams';
  let joined: string;
  if (names.length === 1) joined = names[0];
  else if (names.length === 2) joined = `${names[0]} and ${names[1]}`;
  else joined = `${names.slice(0, -1).join(', ')}, and ${names[names.length - 1]}`;
  return `the ${joined}`;
}

/** The lead-in per cascade level (spec v2). */
export const EMPTY_WINDOW_LEAD_IN: Record<CascadeLevel, string> = {
  'team-proxy': 'Nearby this week',
  'national-fallback': 'Around the league this week',
};

export interface EmptyWindowDigestArgs {
  email: string;
  manageToken: string;
  /** The followed teams' ids, for the subline and "Coming up". */
  teamIds: string[];
  // Display names of the followed teams, for the title.
  teamNames: string[];
  /** Which cascade level produced the rows (resolveLocalAnchor). */
  level: CascadeLevel;
  // Nearby promos from the geo cascade (team-proxy).
  localPromos: DigestPromo[];
  // National featured promos, the national-fallback rows.
  featured: DigestPromo[];
  context: DigestContext;
}

export function buildEmptyWindowDigest(args: EmptyWindowDigestArgs): BuiltDigest {
  // team-proxy always carries local promos (resolveLocalAnchor); a proxy with
  // none would be national content, so it is treated as national here too.
  const proxy = args.level === 'team-proxy' && args.localPromos.length > 0;
  const level: CascadeLevel = proxy ? 'team-proxy' : 'national-fallback';
  return built('Your teams are quiet this week on PromoNight', args.manageToken, {
    ...baseInput(args.manageToken, args.context),
    variant: 'empty',
    surface: EMAIL_SURFACE_EMPTY,
    title: `Nothing on the calendar for ${naturalTeamList(args.teamNames)} this week`,
    subline: [windowLabel(args.context.window), teamListLabel(args.teamNames)].filter(Boolean).join(' · '),
    promos: proxy ? args.localPromos : args.featured,
    overflow: 0,
    followedTeamIds: args.teamIds,
    heroAllowed: proxy,
    leadIn: EMPTY_WINDOW_LEAD_IN[level],
  });
}

export async function sendEmptyWindowDigest(args: EmptyWindowDigestArgs): Promise<SendResult> {
  const b = buildEmptyWindowDigest(args);
  return sendEmail({ to: args.email, subject: b.subject, html: b.html, text: b.text, headers: b.headers });
}
