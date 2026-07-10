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

// ── Email attribution surfaces ──────────────────────────────────────────────
// Per-promo links land on the team page. They carry the affiliate subId1
// convention (`${surface}_${team.id}`, see lib/affiliates.ts) as a query param
// so email-driven sessions are sliceable in PostHog on the same join key the
// on-page ticket / gear CTAs stamp onto their outbound partner URLs. The two
// digests use distinct surfaces so personalized and generic traffic separate.
// (The team page is statically generated and stamps its own web_team_page
// subId1 onto the partner links, so this tag reaches PostHog, not the partner
// reports; forwarding it into the on-page CTAs would be a separate page change.)
export const EMAIL_SURFACE_PERSONALIZED = 'web_email_personalized';
export const EMAIL_SURFACE_GENERIC = 'web_email_generic';
// The empty-window variant (a personalized subscriber whose teams are quiet):
// its promo links, whether the local section or the national fallback, carry
// this surface so its ticket clicks separate from the other two variants.
export const EMAIL_SURFACE_EMPTY = 'web_email_empty';

// Team-page URL for a promo, tagged with the email surface via the subId1
// `${surface}_${team.id}` convention. team.id already sits in the path; keeping
// it in the subId1 value too makes the token byte-identical to the affiliate
// subId1 so both join on one key. Sport slugs and team ids are lowercase-hyphen,
// so the value is already URL-safe.
function teamPromoUrl(p: DigestPromo, surface: string): string {
  return `${SITE_URL}/${p.sportSlug}/${p.teamId}?subId1=${surface}_${p.teamId}`;
}

function promoRowHtml(p: DigestPromo, surface: string): string {
  const teamUrl = teamPromoUrl(p, surface);
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

// The digest is a white rounded card floating on a beige field. The dark brand
// header is the top of that card (rounded via the card's overflow:hidden), not
// a separate band. The card is WIDENED to dominate: it caps at DIGEST_MAX_WIDTH
// (~700px, up from the old 520 inset) and the beige is reduced to a thin, even
// frame (DIGEST_FRAME_PAD) so it reads as a slim border rather than a wide band.
const DIGEST_PAGE_BG = '#f4f1ea'; // beige outer frame
const DIGEST_CARD_BG = '#ffffff'; // white card
const DIGEST_BAR_BG = '#1d1714'; // dark header, top of the card
const DIGEST_MAX_WIDTH = 700; // card cap on wide desktop
const DIGEST_FRAME_PAD = '12px'; // thin even beige gutter around the card

/**
 * White rounded card on a beige field:
 *
 *   card top  brand header  background #1d1714, rounded via overflow:hidden
 *   card body heading / promo body / footer  on white
 *
 * The beige page shows only as a thin even DIGEST_FRAME_PAD gutter around the
 * card, so the card dominates. The card fills its container (width:100%) and
 * caps + centers at DIGEST_MAX_WIDTH on wide desktop (max-width + margin:0 auto
 * + the outer cell's align="center"); on mobile it fills the screen with the
 * beige frame collapsing to a minimal DIGEST_FRAME_PAD edge. header and card
 * share one width because the header is the card's first row.
 *
 * Outlook on Windows (the Word engine) honors `width` but IGNORES `max-width`,
 * so the card is wrapped in an mso-conditional "ghost table" fixed at
 * DIGEST_MAX_WIDTH; only Outlook reads the `[if mso]` comments, so it caps +
 * centers the card there while every other client renders the fluid card.
 * bgcolor mirrors each background as an attribute for older clients.
 */
function digestShellHtml(opts: {
  heading: string;
  sub: string;
  bodyHtml: string;
  footerHtml: string;
}): string {
  const msoOpen = `<!--[if mso]><table role="presentation" align="center" width="${DIGEST_MAX_WIDTH}" cellpadding="0" cellspacing="0" border="0"><tr><td width="${DIGEST_MAX_WIDTH}"><![endif]-->`;
  const msoClose = `<!--[if mso]></td></tr></table><![endif]-->`;
  return `<!doctype html>
<html lang="en">
<body style="margin:0;padding:0;width:100%;background:${DIGEST_PAGE_BG};font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" bgcolor="${DIGEST_PAGE_BG}" style="width:100%;background:${DIGEST_PAGE_BG};">
    <tr><td align="center" style="padding:${DIGEST_FRAME_PAD};">
      ${msoOpen}
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" align="center" bgcolor="${DIGEST_CARD_BG}" style="width:100%;max-width:${DIGEST_MAX_WIDTH}px;margin:0 auto;background:${DIGEST_CARD_BG};border-radius:16px;overflow:hidden;border:1px solid #e6e1d6;">
        <tr><td bgcolor="${DIGEST_BAR_BG}" style="background:${DIGEST_BAR_BG};padding:24px 32px;">
          <span style="font-size:20px;font-weight:800;letter-spacing:-0.5px;color:#ffffff;">PROMO<span style="color:#ff5a4d;">NIGHT</span></span>
        </td></tr>
        <tr><td style="padding:28px 32px 6px;">
          <h1 style="margin:0 0 4px;font-size:20px;line-height:1.25;color:#1d1714;">${esc(opts.heading)}</h1>
          <p style="margin:0;font-size:14px;color:#6b6459;">${esc(opts.sub)}</p>
        </td></tr>
        <tr><td style="padding:6px 32px 24px;">
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">${opts.bodyHtml}</table>
        </td></tr>
        <tr><td style="padding:20px 32px;border-top:1px solid #e6e1d6;">${opts.footerHtml}</td></tr>
      </table>
      ${msoClose}
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
    bodyHtml:
      args.promos.map((p) => promoRowHtml(p, EMAIL_SURFACE_PERSONALIZED)).join('') + overflowHtml,
    footerHtml: personalizedFooterHtml(args.manageToken),
  });
  const manage = preferencesUrl(args.manageToken);
  const text = [
    'Your teams this week on PromoNight',
    '',
    ...args.promos.map(
      (p) => `- ${formatDigestDate(p.date)}: ${p.title} (${p.teamName}) ${teamPromoUrl(p, EMAIL_SURFACE_PERSONALIZED)}`,
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

// ── Shared hot-promos body ───────────────────────────────────────────────────
// The national "hottest promos" body: featured promo rows plus the aggregator
// collection pills. Extracted so the generic digest AND the empty-window
// fallback render an identical body from one source (surface differs so ticket
// clicks attribute to the right variant).
function hotPromosBodyHtml(
  featured: DigestPromo[],
  collections: DigestCollection[],
  surface: string,
): string {
  const collectionsHtml =
    `<tr><td style="padding:16px 0 0;">` +
    collections
      .map(
        (c) =>
          `<a href="${SITE_URL}${c.href}" style="display:inline-block;margin:0 8px 8px 0;padding:7px 12px;border:1px solid #e6e1d6;border-radius:999px;color:#1d1714;text-decoration:none;font-size:13px;">${esc(c.label)}</a>`,
      )
      .join('') +
    `</td></tr>`;
  return featured.map((p) => promoRowHtml(p, surface)).join('') + collectionsHtml;
}

function hotPromosBodyText(featured: DigestPromo[], collections: DigestCollection[]): string[] {
  return [
    ...featured.map((p) => `- ${formatDigestDate(p.date)}: ${p.title} (${p.teamName})`),
    '',
    'Browse:',
    ...collections.map((c) => `- ${c.label}: ${SITE_URL}${c.href}`),
  ];
}

export async function sendGenericDigest(args: {
  email: string;
  manageToken: string;
  featured: DigestPromo[];
  collections: DigestCollection[];
}): Promise<SendResult> {
  const html = digestShellHtml({
    heading: "This week's hottest promos",
    sub: 'The biggest giveaways, theme nights, and food deals across the leagues this week.',
    bodyHtml: hotPromosBodyHtml(args.featured, args.collections, EMAIL_SURFACE_GENERIC),
    footerHtml: genericFooterHtml(args.manageToken),
  });
  const manage = preferencesUrl(args.manageToken);
  const text = [
    "This week's hottest promos on PromoNight",
    '',
    ...hotPromosBodyText(args.featured, args.collections),
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

// ── Empty-window variant ─────────────────────────────────────────────────────
// A personalized subscriber whose followed teams have NOTHING in the window.
// Instead of skipping, send a personalized opener naming their team(s), then a
// LOCAL section of nearby promos when the geo cascade found any, else the same
// national hot-promos body the generic digest uses (reused, not duplicated).

// "the Minnesota Twins" / "the A and B" / "the A, B, and C". One leading "the".
function naturalTeamList(names: string[]): string {
  if (names.length === 0) return 'your teams';
  let joined: string;
  if (names.length === 1) joined = names[0];
  else if (names.length === 2) joined = `${names[0]} and ${names[1]}`;
  else joined = `${names.slice(0, -1).join(', ')}, and ${names[names.length - 1]}`;
  return `the ${joined}`;
}

// Local section: a place-headed sub-header ("Happening around Minneapolis this
// week") over the nearby promo rows.
function localSectionHtml(city: string | null, promos: DigestPromo[], surface: string): string {
  const label = city ? `Happening around ${esc(city)} this week` : 'Happening near you this week';
  const header = `<tr><td style="padding:2px 0 10px;font-size:13px;font-weight:700;color:#1d1714;">${label}</td></tr>`;
  return header + promos.map((p) => promoRowHtml(p, surface)).join('');
}

export async function sendEmptyWindowDigest(args: {
  email: string;
  manageToken: string;
  // Display names of the followed teams, for the opener.
  teamNames: string[];
  // City label for the local section heading (null falls back to "near you").
  anchorCity: string | null;
  // Nearby promos from the geo cascade. Empty => render the national fallback.
  localPromos: DigestPromo[];
  // National hot-promos, used as the fallback body when localPromos is empty.
  featured: DigestPromo[];
  collections: DigestCollection[];
}): Promise<SendResult> {
  const surface = EMAIL_SURFACE_EMPTY;
  const teamList = naturalTeamList(args.teamNames);
  const hasLocal = args.localPromos.length > 0;
  const heading = `Nothing on the calendar for ${teamList} this week`;
  const sub = hasLocal
    ? args.anchorCity
      ? `But there is plenty happening around ${args.anchorCity}.`
      : 'But there is plenty happening near you.'
    : "Here are this week's hottest promos across the leagues instead.";

  const bodyHtml = hasLocal
    ? localSectionHtml(args.anchorCity, args.localPromos, surface)
    : hotPromosBodyHtml(args.featured, args.collections, surface);
  const html = digestShellHtml({
    heading,
    sub,
    bodyHtml,
    footerHtml: personalizedFooterHtml(args.manageToken),
  });

  const manage = preferencesUrl(args.manageToken);
  const bodyText = hasLocal
    ? [
        `Happening around ${args.anchorCity ?? 'you'} this week:`,
        ...args.localPromos.map(
          (p) => `- ${formatDigestDate(p.date)}: ${p.title} (${p.teamName}) ${teamPromoUrl(p, surface)}`,
        ),
      ]
    : ["This week's hottest promos across the leagues:", ...hotPromosBodyText(args.featured, args.collections)];
  const text = [
    `Nothing on the calendar for ${teamList} this week.`,
    '',
    ...bodyText,
    '',
    `Manage your teams: ${manage}`,
    `Unsubscribe: ${manage}&unsub=1`,
    '',
    SENDER_POSTAL_ADDRESS,
  ].join('\n');

  return sendEmail({
    to: args.email,
    subject: 'Your teams are quiet this week on PromoNight',
    html,
    text,
    headers: listUnsubHeaders(args.manageToken),
  });
}
