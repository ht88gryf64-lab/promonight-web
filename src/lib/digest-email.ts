// The weekly digest renderer (redesign 2026-11-05). The build reference is
// docs/digest-redesign/digest-redesign-spec.md; the mockup beside it is the
// visual reference only (it uses flex and web fonts, this is table markup on
// a system stack).
//
// ONE RENDERER, THREE VARIANTS. Personalized, generic and empty-window all
// come through renderDigest; the variants differ only in the input (title,
// subline, the promo set, the followed teams, the footer lead). The senders
// in src/lib/email.ts build the input and send the result.
//
// PURE. No env, no clock, no Firestore: the ticket gate arrives as
// `ticketsApproved` (the sender reads TICKETNETWORK_EMAIL_APPROVED at send
// time), so the tests drive every branch directly.
//
// LINKS. Every promo link is a promo page reached through promoPageHref
// (DigestPromo.href and DigestUpcoming.href are built there), made absolute
// and tagged with the surface's subId1 exactly as before the redesign. No
// partner domain appears anywhere unless the gate is on, and then only on the
// hero's one button (spec section 3).

import type { DigestContext, DigestPromo, DigestTeam, DigestUpcoming } from './digest';
import { buildTicketNetworkLink, ticketNetworkForGame, type EmailTnSubIdSurface } from './affiliates';
import { shareCardPath, themeLabel } from './promo-page-copy';

// ── Palette (spec "Container"). Every text tone clears 4.5:1 on the ground it
// renders on; guarded by src/lib/__tests__/digest-email-contrast.test.ts. ──
const DIGEST_INK = '#141413';
const DIGEST_MUTED = '#6B6861';
const DIGEST_BODY = '#3D3B37';
const DIGEST_RULE = '#E6E3DC';
const DIGEST_PANEL = '#F3F2EE';
const DIGEST_WHITE = '#FFFFFF';
/** The one accent constant. */
const DIGEST_ACCENT = '#1D4ED8';
const DIGEST_OUTLINE = '#D6D3CC';

const FONT = "-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif";
const CONTAINER = 600;
const SIDE = 32;
/** Hero image per spec: 552x290. The share card is 1200x630, the same shape. */
const HERO_W = 552;
const HERO_H = 290;
/** Spec asks 96x60; the card is 1.905:1, so 96 wide is 50 tall undistorted. */
const THUMB_W = 96;
const THUMB_H = 50;
/** Gmail clips a message body past 102KB. */
export const GMAIL_CLIP_BYTES = 102 * 1024;

export type DigestVariant = 'personalized' | 'generic' | 'empty';

export interface DigestEmailInput {
  variant: DigestVariant;
  /** subId1 surface: web_email_personalized / web_email_generic / web_email_empty. */
  surface: EmailTnSubIdSurface;
  siteUrl: string;
  manageToken: string;
  title: string;
  subline: string;
  /** The set the hero rule reads and the rows render, date-ascending. */
  promos: DigestPromo[];
  /** Promos dropped by the personalized cap (the "and N more" line). */
  overflow: number;
  /** "Coming up" reads these; empty for the generic variant. */
  followedTeamIds: string[];
  context: DigestContext;
  /** TICKETNETWORK_EMAIL_APPROVED === 'true', read by the sender. */
  ticketsApproved: boolean;
  /** False suppresses the hero whatever the set holds: the empty-window
   *  variant on national-fallback content (spec v2, "Empty-window variant"). */
  heroAllowed: boolean;
  /** Muted line directly above the first row (empty-window only, spec v2):
   *  tells the reader the rows are not their teams. Null renders nothing. */
  leadIn: string | null;
  postalAddress: string;
}

export interface RenderedDigest {
  html: string;
  text: string;
  hero: DigestPromo | null;
}

// ── small helpers ────────────────────────────────────────────────────────────

export function esc(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

function ymdParts(ymd: string): { weekday: string; month: string; day: number } {
  const [y, m, d] = ymd.split('-').map(Number);
  const date = new Date(Date.UTC(y, m - 1, d));
  return { weekday: WEEKDAYS[date.getUTCDay()], month: MONTHS[m - 1], day: d };
}
/** "Nov 12". */
export function monthDay(ymd: string): string {
  const p = ymdParts(ymd);
  return `${p.month} ${p.day}`;
}
/** "Fri Nov 6". */
function weekdayMonthDay(ymd: string): string {
  const p = ymdParts(ymd);
  return `${p.weekday} ${p.month} ${p.day}`;
}
/** "Nov 5 to Nov 11". */
export function windowLabel(w: { start: string; end: string }): string {
  return `${monthDay(w.start)} to ${monthDay(w.end)}`;
}

/** "A", "A and B", "A, B, and C", or "A, B, C, and 2 more". */
export function teamListLabel(names: string[], max = 3): string {
  if (names.length === 0) return '';
  if (names.length === 1) return names[0];
  if (names.length === 2) return `${names[0]} and ${names[1]}`;
  if (names.length <= max) return `${names.slice(0, -1).join(', ')}, and ${names[names.length - 1]}`;
  return `${names.slice(0, max).join(', ')}, and ${names.length - max} more`;
}

function promoUrl(input: DigestEmailInput, href: string, teamId: string): string {
  return `${input.siteUrl}${href}?subId1=${input.surface}_${teamId}`;
}
function cardUrl(input: DigestEmailInput, p: DigestPromo): string | null {
  if (!p.hasPage || !p.promoId) return null;
  return `${input.siteUrl}${shareCardPath(p.teamId, p.promoId, p.updatedAt)}`;
}
function preferencesUrl(input: DigestEmailInput): string {
  return `${input.siteUrl}/preferences?token=${encodeURIComponent(input.manageToken)}`;
}
/** The app band's /download link. /download has no email form of `src`
 *  (it parses team_cta_{team} and promo_cta_{team} only), so the email uses
 *  the UTM path /download already honours (utmFromParams, src/lib/app-link.ts). */
function downloadUrl(input: DigestEmailInput): string {
  return `${input.siteUrl}/download?utm_source=email&utm_campaign=weekly_digest&utm_content=${input.surface}`;
}
function gameLine(p: DigestPromo): string[] {
  return [p.opponent ? `vs ${p.opponent}` : '', p.time, p.venueName ?? '', p.quantity ?? ''].filter(Boolean);
}

// ── the hero rule (spec section 3) ───────────────────────────────────────────

/** A promo can be the hero only when it has a page (the button's target and
 *  the card's key). */
const cardable = (p: DigestPromo) => p.hasPage && !!p.promoId;

/** Exactly one promo in the set, or else the earliest tier 1 photo.
 *  Deterministic on purpose (spec "Open decision"). */
export function pickHero(promos: DigestPromo[], overflow = 0): DigestPromo | null {
  if (promos.length === 1 && overflow === 0) return cardable(promos[0]) ? promos[0] : null;
  let pick: DigestPromo | null = null;
  for (const p of promos) {
    if (p.imageTier !== 1 || !cardable(p)) continue;
    if (!pick || p.date < pick.date) pick = p;
  }
  return pick;
}

/** "Coming up": the next two promos for the followed teams past the window. */
export function comingUp(ctx: DigestContext, teamIds: string[], n = 2): DigestUpcoming[] {
  if (teamIds.length === 0) return [];
  const set = new Set(teamIds);
  return ctx.upcoming.filter((u) => set.has(u.teamId) && u.date > ctx.window.end).slice(0, n);
}

/** "{Theme} at other clubs": the hero's theme at up to three other clubs, one
 *  row per club, rendered only with at least two. */
export function themeSiblings(ctx: DigestContext, hero: DigestPromo | null, n = 3): DigestUpcoming[] {
  if (!hero || !themeLabel(hero.themeKey)) return [];
  const seen = new Set<string>();
  const out: DigestUpcoming[] = [];
  for (const u of ctx.upcoming) {
    if (u.themeKey !== hero.themeKey || u.teamId === hero.teamId || seen.has(u.teamId)) continue;
    seen.add(u.teamId);
    out.push(u);
    if (out.length === n) break;
  }
  return out.length >= 2 ? out : [];
}

/** The gated ticket link: only with approval, a page slug, and a home club
 *  TicketNetwork lists. Null means the button stays "See this game". */
function heroTicketUrl(input: DigestEmailInput, hero: DigestPromo, team: DigestTeam | undefined): string | null {
  if (!input.ticketsApproved || !team || !ticketNetworkForGame(null, team)) return null;
  return buildTicketNetworkLink({
    team: { id: team.id, ticketNetworkSlug: team.ticketNetworkSlug },
    surface: input.surface,
    pageSlug: hero.pageSlug,
  });
}

// ── markup pieces ────────────────────────────────────────────────────────────

/** A text cell: explicit bgcolor and color, for dark-mode clients. */
function cell(style: string, inner: string, bg = DIGEST_WHITE, attrs = ''): string {
  return `<td${attrs} bgcolor="${bg}" style="background:${bg};font-family:${FONT};${style}">${inner}</td>`;
}
function row(inner: string): string {
  return `<tr>${inner}</tr>`;
}
function table(inner: string, style = '', attrs = ''): string {
  return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0"${attrs} style="width:100%;border-collapse:collapse;${style}">${inner}</table>`;
}
function rule(color: string): string {
  return table(row(`<td height="1" bgcolor="${color}" style="height:1px;line-height:1px;font-size:1px;background:${color};">&nbsp;</td>`));
}
/** Filled button: a padded cell around an anchor, 44px tap height. */
function solidButton(href: string, label: string): string {
  return `<table role="presentation" cellpadding="0" cellspacing="0" border="0"><tr><td bgcolor="${DIGEST_ACCENT}" style="background:${DIGEST_ACCENT};border-radius:8px;"><a href="${esc(href)}" style="display:inline-block;padding:13px 22px;font-family:${FONT};font-size:15px;font-weight:600;line-height:18px;color:${DIGEST_WHITE};text-decoration:none;border-radius:8px;white-space:nowrap;">${esc(label)}</a></td></tr></table>`;
}
function outlineButton(href: string, label: string): string {
  return `<table role="presentation" cellpadding="0" cellspacing="0" border="0"><tr><td bgcolor="${DIGEST_WHITE}" style="background:${DIGEST_WHITE};border:1px solid ${DIGEST_OUTLINE};border-radius:6px;"><a href="${esc(href)}" style="display:inline-block;padding:13px 16px;font-family:${FONT};font-size:13px;font-weight:600;line-height:18px;color:${DIGEST_INK};text-decoration:none;white-space:nowrap;">${esc(label)}</a></td></tr></table>`;
}

// 1. Header
function headerHtml(input: DigestEmailInput): string {
  return row(cell(`padding:26px ${SIDE}px 0;`, table(row(
    cell(`font-size:18px;font-weight:700;letter-spacing:0.08em;line-height:22px;color:${DIGEST_INK};`, 'PROMONIGHT', DIGEST_WHITE, ' align="left"') +
    cell(`font-size:12px;line-height:22px;color:${DIGEST_MUTED};`, `<a href="${esc(preferencesUrl(input))}" style="color:${DIGEST_MUTED};text-decoration:none;">Manage teams</a>`, DIGEST_WHITE, ' align="right"'),
  ))));
}

// 2. Title block
function titleHtml(input: DigestEmailInput): string {
  return row(cell(`padding:36px ${SIDE}px 0;`,
    `<h1 style="margin:0;font-family:${FONT};font-size:34px;line-height:1.05;font-weight:700;color:${DIGEST_INK};">${esc(input.title)}</h1>` +
    `<div style="margin-top:10px;font-size:15px;line-height:1.4;color:${DIGEST_MUTED};">${esc(input.subline)}</div>`,
  ));
}

// 3. Hero
function heroHtml(input: DigestEmailInput, hero: DigestPromo): string {
  const team = input.context.teams.get(hero.teamId);
  const page = promoUrl(input, hero.href, hero.teamId);
  const img = cardUrl(input, hero)!;
  const alt = `${hero.title}, ${hero.teamName}, ${weekdayMonthDay(hero.date)}`;
  const ticketUrl = heroTicketUrl(input, hero, team);
  const button = ticketUrl ? solidButton(ticketUrl, 'Get tickets') : solidButton(page, 'See this game');
  const sideLink = (label: string) => `<a href="${esc(page)}" style="color:${DIGEST_MUTED};text-decoration:underline;">${label}</a>`;
  // The title block sits below the image on EVERY hero (ruling 2026-11-05):
  // with images off, the card's drawn text is gone and the email must still
  // read whole. No text is ever laid over the image itself.
  const titleBelow = row(cell('padding:18px 24px 0;',
    `<div style="font-size:19px;font-weight:600;line-height:1.25;color:${DIGEST_INK};">${esc(hero.title)}</div>` +
    `<div style="margin-top:5px;font-size:13px;line-height:1.4;color:${DIGEST_MUTED};">${esc([hero.teamName, weekdayMonthDay(hero.date), ...gameLine(hero)].join(' · '))}</div>`));
  const card = table(
    row(`<td bgcolor="${DIGEST_WHITE}" style="padding:0;background:${DIGEST_WHITE};font-family:${FONT};font-size:13px;line-height:18px;color:${DIGEST_MUTED};"><a href="${esc(page)}" style="display:block;"><img src="${esc(img)}" width="${HERO_W}" height="${HERO_H}" alt="${esc(alt)}" style="display:block;width:100%;max-width:${HERO_W}px;height:auto;border:0;outline:none;text-decoration:none;"></a></td>`) +
    titleBelow +
    row(cell('padding:18px 24px 22px;', table(row(
      cell('', button, DIGEST_WHITE, ' align="left" valign="middle"') +
      cell(`font-size:13px;font-weight:500;line-height:18px;color:${DIGEST_MUTED};white-space:nowrap;`, `${sideLink('Parking')}&nbsp;&nbsp;&nbsp;&nbsp;${sideLink('Remind me')}`, DIGEST_WHITE, ' align="right" valign="middle"'),
    )))),
    `border:1px solid ${DIGEST_RULE};border-collapse:separate;border-radius:12px;overflow:hidden;`,
    ` bgcolor="${DIGEST_WHITE}"`,
  );
  // 600 - 2 x 23 = 554: the 552 image plus the card's two 1px borders.
  return row(cell('padding:28px 23px 0;', card));
}

// 4. Rows, grouped by date
function promoRowHtml(input: DigestEmailInput, p: DigestPromo, showDate: boolean): string {
  const href = promoUrl(input, p.href, p.teamId);
  const d = ymdParts(p.date);
  const rail = showDate
    ? `<div style="font-size:11px;font-weight:600;letter-spacing:0.08em;line-height:14px;color:${DIGEST_MUTED};">${d.weekday.toUpperCase()}</div>` +
      `<div style="font-size:36px;font-weight:700;line-height:36px;color:${DIGEST_INK};">${d.day}</div>`
    : '&nbsp;';
  const eyebrow = `${p.teamShort || p.teamName} · ${p.typeLabel}`.toUpperCase();
  const thumb = cardUrl(input, p);
  const game = gameLine(p);
  // The whole row links to the promo page, as one anchor PER CELL to the same
  // href rather than one anchor around the table: Outlook's Word engine does
  // not carry a link across a block-level table, so a wrapping anchor leaves
  // the row dead there. Anchors are never nested.
  const link = (inner: string) => `<a href="${esc(href)}" style="display:block;color:${DIGEST_INK};text-decoration:none;">${inner}</a>`;
  const inner = table(row(
    cell(`width:54px;padding:22px 0;`, showDate ? link(rail) : rail, DIGEST_WHITE, ' width="54" valign="top"') +
    cell('padding:22px 16px 22px 20px;', link(
      `<div style="font-size:11px;font-weight:600;letter-spacing:0.06em;line-height:14px;color:${DIGEST_ACCENT};">${esc(eyebrow)}</div>` +
      `<div style="margin-top:5px;font-size:19px;font-weight:600;line-height:1.25;color:${DIGEST_INK};">${esc(p.title)}</div>` +
      (game.length ? `<div style="margin-top:5px;font-size:13px;line-height:1.4;color:${DIGEST_MUTED};">${esc(game.join(' · '))}</div>` : '')),
      DIGEST_WHITE, ' valign="top"') +
    cell(`width:${THUMB_W}px;padding:22px 0;`,
      thumb ? link(`<img src="${esc(thumb)}" width="${THUMB_W}" height="${THUMB_H}" alt="" style="display:block;width:${THUMB_W}px;height:${THUMB_H}px;border:0;border-radius:6px;">`) : '&nbsp;',
      DIGEST_WHITE, ` width="${THUMB_W}" valign="top"`),
  ), `border-bottom:1px solid ${DIGEST_RULE};`);
  return row(cell(`padding:0 ${SIDE}px;`, inner));
}

function rowsHtml(input: DigestEmailInput, rows: DigestPromo[]): string {
  if (rows.length === 0) return '';
  let html = row(cell(`padding:32px ${SIDE}px 0;`, rule(DIGEST_INK)));
  if (input.leadIn) {
    html += row(cell(`padding:16px ${SIDE}px 0;font-size:13px;line-height:1.4;color:${DIGEST_MUTED};`, esc(input.leadIn)));
  }
  let prev = '';
  for (const p of rows) {
    html += promoRowHtml(input, p, p.date !== prev);
    prev = p.date;
  }
  if (input.overflow > 0) {
    html += row(cell(`padding:14px ${SIDE}px 0;font-size:13px;line-height:1.4;color:${DIGEST_MUTED};`,
      `and ${input.overflow} more this week. <a href="${esc(input.siteUrl)}" style="color:${DIGEST_ACCENT};text-decoration:none;">See all on PromoNight</a>`));
  }
  return html;
}

// 5 and 6. Two small lists of "left link, right muted" lines.
function listRow(href: string, left: string, right: string, bg: string, first: boolean): string {
  const pad = first ? '10px' : '8px';
  return row(
    cell(`padding-top:${pad};font-size:14px;line-height:1.4;color:${DIGEST_INK};`, `<a href="${esc(href)}" style="color:${DIGEST_INK};font-weight:500;text-decoration:none;">${esc(left)}</a>`, bg, ' align="left"') +
    cell(`padding-top:${pad};padding-left:12px;font-size:14px;line-height:1.4;color:${DIGEST_MUTED};white-space:nowrap;`, esc(right), bg, ' align="right"'),
  );
}
function labelHtml(text: string, bg: string): string {
  return `<div style="font-size:11px;font-weight:600;letter-spacing:0.08em;line-height:14px;color:${DIGEST_MUTED};background:${bg};">${esc(text.toUpperCase())}</div>`;
}

function comingUpHtml(input: DigestEmailInput, items: DigestUpcoming[]): string {
  if (items.length === 0) return '';
  const lines = items.map((u, i) => {
    const team = input.context.teams.get(u.teamId);
    return listRow(promoUrl(input, u.href, u.teamId), `${monthDay(u.date)} · ${u.title}`, team?.short || team?.name || '', DIGEST_PANEL, i === 0);
  }).join('');
  const panel = table(row(cell('padding:18px 20px;', labelHtml('Coming up', DIGEST_PANEL) + table(lines), DIGEST_PANEL)),
    'border-collapse:separate;border-radius:10px;', ` bgcolor="${DIGEST_PANEL}"`);
  return row(cell(`padding:24px ${SIDE}px 0;`, panel));
}

function siblingsHtml(input: DigestEmailInput, hero: DigestPromo, items: DigestUpcoming[]): string {
  if (items.length === 0) return '';
  const lines = items.map((u, i) => {
    const team = input.context.teams.get(u.teamId);
    return listRow(promoUrl(input, u.href, u.teamId), team?.name || u.teamId, monthDay(u.date), DIGEST_WHITE, i === 0);
  }).join('');
  return row(cell(`padding:28px ${SIDE}px 0;`, labelHtml(`${themeLabel(hero.themeKey)} at other clubs`, DIGEST_WHITE) + table(lines)));
}

// 7. App band
const APP_COPY = 'Want a reminder the day before each game instead of once a week?';
function appBandHtml(input: DigestEmailInput): string {
  return row(cell(`padding:28px ${SIDE}px 0;`, table(row(
    cell(`padding-top:24px;font-size:14px;line-height:1.5;color:${DIGEST_BODY};`, APP_COPY, DIGEST_WHITE, ' valign="middle"') +
    cell('padding:24px 0 0 16px;', outlineButton(downloadUrl(input), 'Get the app'), DIGEST_WHITE, ' align="right" valign="middle"'),
  ), `border-top:1px solid ${DIGEST_RULE};`)));
}

// 8. Footer: the content each variant carried before, plus the disclosure.
const DISCLOSURE = 'PromoNight may earn a commission on purchases through links in this email.';
function footerHtml(input: DigestEmailInput): string {
  const manage = preferencesUrl(input);
  const link = (href: string, label: string) => `<a href="${esc(href)}" style="color:${DIGEST_MUTED};text-decoration:underline;">${label}</a>`;
  const lead = input.variant === 'generic'
    ? `${link(manage, 'Star your teams to personalize')} this email. · ${link(`${manage}&unsub=1`, 'Unsubscribe')}`
    : `You are getting this because you follow these teams on PromoNight. ${link(manage, 'Manage your teams')} · ${link(`${manage}&unsub=1`, 'Unsubscribe')}`;
  return row(cell(`padding:28px ${SIDE}px 32px;font-size:12px;line-height:1.6;color:${DIGEST_MUTED};`,
    `<div style="color:${DIGEST_MUTED};">${lead} · ${DISCLOSURE}</div>` +
    `<div style="margin-top:8px;color:${DIGEST_MUTED};">${esc(input.postalAddress)}</div>`));
}

// ── plain text, from the same data ──────────────────────────────────────────

function textPromo(input: DigestEmailInput, p: DigestPromo): string[] {
  const line = [`${weekdayMonthDay(p.date)}: ${p.title} (${p.teamName})`, ...gameLine(p)].join(' · ');
  return [`- ${line}`, `  ${promoUrl(input, p.href, p.teamId)}`];
}

function renderText(input: DigestEmailInput, hero: DigestPromo | null, rows: DigestPromo[], next: DigestUpcoming[], siblings: DigestUpcoming[]): string {
  const manage = preferencesUrl(input);
  const out: string[] = ['PROMONIGHT', '', input.title, input.subline, ''];
  if (hero) out.push(...textPromo(input, hero), '');
  if (input.leadIn && rows.length) out.push(input.leadIn);
  for (const p of rows) out.push(...textPromo(input, p));
  if (input.overflow > 0) out.push(`...and ${input.overflow} more this week: ${input.siteUrl}`);
  if (next.length) {
    out.push('', 'Coming up:');
    for (const u of next) out.push(`- ${monthDay(u.date)}: ${u.title} (${input.context.teams.get(u.teamId)?.name ?? u.teamId})`, `  ${promoUrl(input, u.href, u.teamId)}`);
  }
  if (hero && siblings.length) {
    out.push('', `${themeLabel(hero.themeKey)} at other clubs:`);
    for (const u of siblings) out.push(`- ${input.context.teams.get(u.teamId)?.name ?? u.teamId}, ${monthDay(u.date)}`, `  ${promoUrl(input, u.href, u.teamId)}`);
  }
  out.push('', `${APP_COPY} Get the app: ${downloadUrl(input)}`, '');
  out.push(input.variant === 'generic' ? `Star your teams to personalize: ${manage}` : `Manage your teams: ${manage}`);
  out.push(`Unsubscribe: ${manage}&unsub=1`, '', DISCLOSURE, input.postalAddress);
  return out.join('\n');
}

// ── the document ─────────────────────────────────────────────────────────────

export function renderDigest(input: DigestEmailInput): RenderedDigest {
  const hero = input.heroAllowed ? pickHero(input.promos, input.overflow) : null;
  const rows = hero ? input.promos.filter((p) => p !== hero) : input.promos;
  const next = comingUp(input.context, input.followedTeamIds);
  const siblings = themeSiblings(input.context, hero);

  const body =
    headerHtml(input) +
    titleHtml(input) +
    (hero ? heroHtml(input, hero) : '') +
    rowsHtml(input, rows) +
    comingUpHtml(input, next) +
    (hero ? siblingsHtml(input, hero, siblings) : '') +
    appBandHtml(input) +
    footerHtml(input);

  // Outlook on Windows ignores max-width, so a ghost table fixes it at 600.
  const msoOpen = `<!--[if mso]><table role="presentation" align="center" width="${CONTAINER}" cellpadding="0" cellspacing="0" border="0"><tr><td width="${CONTAINER}"><![endif]-->`;
  const msoClose = `<!--[if mso]></td></tr></table><![endif]-->`;
  const html = `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="color-scheme" content="light">
<meta name="supported-color-schemes" content="light">
<title>${esc(input.title)}</title>
</head>
<body bgcolor="${DIGEST_WHITE}" style="margin:0;padding:0;width:100%;background:${DIGEST_WHITE};">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" bgcolor="${DIGEST_WHITE}" style="width:100%;background:${DIGEST_WHITE};"><tr><td align="center" bgcolor="${DIGEST_WHITE}" style="padding:0;background:${DIGEST_WHITE};">
${msoOpen}
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" align="center" bgcolor="${DIGEST_WHITE}" style="width:100%;max-width:${CONTAINER}px;margin:0 auto;background:${DIGEST_WHITE};border-collapse:collapse;">
${body}
</table>
${msoClose}
</td></tr></table>
</body>
</html>`;

  return { html, text: renderText(input, hero, rows, next, siblings), hero };
}
