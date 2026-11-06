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
import { MLS_SHORT_NAMES } from './team-display-name';
import type { CascadeLevel } from './geo/local-promos';
import type { PromoType } from './types';

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
  /** Inbox preview text (digestPreheader): hidden at the top of the body, so
   *  the preview never falls through to the hero image's alt text. */
  preheader: string;
  postalAddress: string;
}

export interface RenderedDigest {
  html: string;
  text: string;
  /** The hero entry's lead promo. */
  hero: DigestPromo | null;
  /** Collapsed entries rendered (hero included). 0 is the no-promo week. */
  entryCount: number;
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
// ── collapsed entries (review fix 2026-11-05) ────────────────────────────────
// One entry per team per date: to a reader a giveaway and a theme night at the
// same game are one event, never a hero plus a row. The entry's LEAD promo
// gives the title, link, card and type label; the others' names append to the
// game line. Everything that renders a set (hero rule, rows, Coming up, the
// text part, the subject counts) works on entries.

/** The site's category order (src/components/redesign/categories.ts
 *  RD_CATEGORY_ORDER, guarded equal by the digest tests): a giveaway leads,
 *  then a theme night, a food deal, a kids promo. */
export const DIGEST_TYPE_ORDER: readonly PromoType[] = ['giveaway', 'theme', 'food', 'kids'];
const typeRank = (t: PromoType | undefined) => {
  const i = DIGEST_TYPE_ORDER.indexOf(t as PromoType);
  return i < 0 ? DIGEST_TYPE_ORDER.length : i;
};

export interface Entry<T> {
  lead: T;
  /** The same team's other promos on that date, in lead order. */
  others: T[];
}
export type DigestEntry = Entry<DigestPromo>;
export type UpcomingEntry = Entry<DigestUpcoming>;

/** Group by team + date (first appearance order, so a date-sorted set stays
 *  date-sorted). The lead is the first by type order; within a type a tier 1
 *  photo first (the rule canonicalWinner uses), then set order. */
export function collapseEntries<T extends { teamId: string; date: string; type: PromoType; imageTier?: number | null }>(items: readonly T[]): Entry<T>[] {
  const groups = new Map<string, { item: T; i: number }[]>();
  items.forEach((item, i) => {
    const k = `${item.teamId}|${item.date}`;
    const g = groups.get(k);
    if (g) g.push({ item, i });
    else groups.set(k, [{ item, i }]);
  });
  return [...groups.values()].map((g) => {
    const sorted = [...g].sort((a, b) =>
      typeRank(a.item.type) - typeRank(b.item.type) ||
      (b.item.imageTier === 1 ? 1 : 0) - (a.item.imageTier === 1 ? 1 : 0) ||
      a.i - b.i);
    return { lead: sorted[0].item, others: sorted.slice(1).map((x) => x.item) };
  });
}

const hasGiveaway = (e: Entry<{ type: PromoType }>) => e.lead.type === 'giveaway';
/** Entries with a giveaway (the lead is one whenever the game has one). */
export function giveawayEntryCount(entries: readonly Entry<{ type: PromoType }>[]): number {
  return entries.filter(hasGiveaway).length;
}

function gameLine(p: DigestPromo): string[] {
  return [p.opponent ? `vs ${p.opponent}` : '', p.time, p.venueName ?? '', p.quantity ?? ''].filter(Boolean);
}
/** The lead's game line, then the other promos' names. */
function entryGameLine(e: DigestEntry): string[] {
  return [...gameLine(e.lead), ...e.others.map((o) => o.title)];
}
/** The entry's theme: the lead's, else the first other promo's. */
function entryThemeKey(e: DigestEntry): string | null {
  return [e.lead, ...e.others].map((p) => p.themeKey).find((k) => themeLabel(k ?? null)) ?? null;
}

// ── the hero rule (spec section 3), on entries ───────────────────────────────

/** An entry can be the hero only when its lead has a page (the button's
 *  target and the card's key). */
const cardable = (p: DigestPromo) => p.hasPage && !!p.promoId;

/** Exactly one entry in the set, or else the earliest entry whose lead is a
 *  tier 1 photo. Deterministic on purpose (spec "Open decision"). */
export function pickHero(entries: DigestEntry[], overflow = 0): DigestEntry | null {
  if (entries.length === 1 && overflow === 0) return cardable(entries[0].lead) ? entries[0] : null;
  let pick: DigestEntry | null = null;
  for (const e of entries) {
    if (e.lead.imageTier !== 1 || !cardable(e.lead)) continue;
    if (!pick || e.lead.date < pick.lead.date) pick = e;
  }
  return pick;
}

/** "Coming up": the next two entries for the followed teams past the window. */
export function comingUp(ctx: DigestContext, teamIds: string[], n = 2): UpcomingEntry[] {
  if (teamIds.length === 0) return [];
  const set = new Set(teamIds);
  return collapseEntries(ctx.upcoming.filter((u) => set.has(u.teamId) && u.date > ctx.window.end)).slice(0, n);
}

/** "{Theme} at other clubs": the hero's theme at up to three other clubs, one
 *  row per club (so one per club and date by construction), rendered only
 *  with at least two. */
export function themeSiblings(ctx: DigestContext, hero: DigestEntry | null, n = 3): DigestUpcoming[] {
  const themeKey = hero ? entryThemeKey(hero) : null;
  if (!hero || !themeKey) return [];
  const seen = new Set<string>();
  const out: DigestUpcoming[] = [];
  for (const u of ctx.upcoming) {
    if (u.themeKey !== themeKey || u.teamId === hero.lead.teamId || seen.has(u.teamId)) continue;
    seen.add(u.teamId);
    out.push(u);
    if (out.length === n) break;
  }
  return out.length >= 2 ? out : [];
}

// ── subject lines (review fix 2026-11-05) ────────────────────────────────────
// Specific and count-bearing, so consecutive weeks never thread and the line
// reads like a schedule note. Never "hottest", "hot", "promos" or "deal".

/** "Panthers are", "Heat is": the MLS short brands say so by hand; every
 *  other nickname is plural when it ends in s or Sox. */
export function nicknameIsPlural(team: Pick<DigestTeam, 'id' | 'short'>): boolean {
  const mls = MLS_SHORT_NAMES[team.id];
  if (mls) return mls.plural;
  return /(s|sox)$/i.test(team.short.trim());
}
const plural = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`;

export type SubjectInput =
  | { variant: 'personalized'; teams: Pick<DigestTeam, 'id' | 'short'>[]; entries: number; giveawayEntries: number }
  | { variant: 'generic'; windowEntries: number; windowGiveawayEntries: number }
  | { variant: 'empty'; teams: Pick<DigestTeam, 'id' | 'short'>[]; level: CascadeLevel }
  | { variant: 'no-promos'; generic: boolean };

/** The subject's second clause, as the inbox preview line (2026-11-05):
 *  "Here is what is nearby", "22 giveaways this week", "1 promo night". The
 *  no-promo subject has no second clause, so it carries the no-promo line's. */
export function digestPreheader(s: SubjectInput): string {
  switch (s.variant) {
    case 'no-promos':
      return 'Here is what is on the calendar';
    case 'personalized': {
      const subject = digestSubject(s);
      return subject.slice(subject.indexOf(': ') + 2);
    }
    case 'generic':
      return s.windowGiveawayEntries > 0
        ? `${plural(s.windowGiveawayEntries, 'giveaway', 'giveaways')} this week`
        : `${plural(s.windowEntries, 'promo night', 'promo nights')} this week`;
    case 'empty':
      return s.level === 'team-proxy' ? 'Here is what is nearby' : 'Here is what is on around the league';
  }
}

export function digestSubject(s: SubjectInput): string {
  switch (s.variant) {
    case 'no-promos':
      return s.generic ? 'Nothing announced yet this week' : 'Nothing announced yet for your teams';
    case 'personalized': {
      if (s.teams.length === 1) {
        const nick = s.teams[0].short;
        // "games with giveaways" only counts games that have one; a week of
        // theme nights says so instead of claiming giveaways.
        return s.giveawayEntries > 0
          ? `Your ${nick} week: ${plural(s.giveawayEntries, 'game with a giveaway', 'games with giveaways')}`
          : `Your ${nick} week: ${plural(s.entries, 'promo night', 'promo nights')}`;
      }
      return `Your teams this week: ${plural(s.entries, 'promo night', 'promo nights')}`;
    }
    case 'generic':
      return s.windowGiveawayEntries > 0
        ? `${plural(s.windowGiveawayEntries, 'giveaway', 'giveaways')} across pro sports this week`
        : `${plural(s.windowEntries, 'promo night', 'promo nights')} across pro sports this week`;
    case 'empty': {
      const where = s.level === 'team-proxy' ? 'Here is what is nearby' : 'Here is what is on around the league';
      const who = s.teams.length === 1
        ? `${s.teams[0].short} ${nicknameIsPlural(s.teams[0]) ? 'are' : 'is'}`
        : 'Your teams are';
      return `${who} quiet this week. ${where}`;
    }
  }
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
function heroHtml(input: DigestEmailInput, entry: DigestEntry): string {
  const hero = entry.lead;
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
  // The team + type label sits above the title, as on the rows: on a proxy or
  // generic send the hero is often another club's, and the label says whose.
  const titleBelow = row(cell('padding:18px 24px 0;',
    eyebrowHtml(hero) +
    `<div style="margin-top:5px;font-size:19px;font-weight:600;line-height:1.25;color:${DIGEST_INK};">${esc(hero.title)}</div>` +
    `<div style="margin-top:5px;font-size:13px;line-height:1.4;color:${DIGEST_MUTED};">${esc([hero.teamName, weekdayMonthDay(hero.date), ...entryGameLine(entry)].join(' · '))}</div>`));
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

/** "SUNS · GIVEAWAY": the row and hero label. */
function eyebrowHtml(p: DigestPromo): string {
  const eyebrow = `${p.teamShort || p.teamName} · ${p.typeLabel}`.toUpperCase();
  return `<div style="font-size:11px;font-weight:600;letter-spacing:0.06em;line-height:14px;color:${DIGEST_ACCENT};">${esc(eyebrow)}</div>`;
}

// 4. Rows, grouped by date, one per entry
function promoRowHtml(input: DigestEmailInput, entry: DigestEntry, showDate: boolean): string {
  const p = entry.lead;
  const href = promoUrl(input, p.href, p.teamId);
  const d = ymdParts(p.date);
  const rail = showDate
    ? `<div style="font-size:11px;font-weight:600;letter-spacing:0.08em;line-height:14px;color:${DIGEST_MUTED};">${d.weekday.toUpperCase()}</div>` +
      `<div style="font-size:36px;font-weight:700;line-height:36px;color:${DIGEST_INK};">${d.day}</div>`
    : '&nbsp;';
  const thumb = cardUrl(input, p);
  const game = entryGameLine(entry);
  // The whole row links to the promo page, as one anchor PER CELL to the same
  // href rather than one anchor around the table: Outlook's Word engine does
  // not carry a link across a block-level table, so a wrapping anchor leaves
  // the row dead there. Anchors are never nested.
  const link = (inner: string) => `<a href="${esc(href)}" style="display:block;color:${DIGEST_INK};text-decoration:none;">${inner}</a>`;
  const inner = table(row(
    cell(`width:54px;padding:22px 0;`, showDate ? link(rail) : rail, DIGEST_WHITE, ' width="54" valign="top"') +
    cell('padding:22px 16px 22px 20px;', link(
      eyebrowHtml(p) +
      `<div style="margin-top:5px;font-size:19px;font-weight:600;line-height:1.25;color:${DIGEST_INK};">${esc(p.title)}</div>` +
      (game.length ? `<div style="margin-top:5px;font-size:13px;line-height:1.4;color:${DIGEST_MUTED};">${esc(game.join(' · '))}</div>` : '')),
      DIGEST_WHITE, ' valign="top"') +
    cell(`width:${THUMB_W}px;padding:22px 0;`,
      thumb ? link(`<img src="${esc(thumb)}" width="${THUMB_W}" height="${THUMB_H}" alt="" style="display:block;width:${THUMB_W}px;height:${THUMB_H}px;border:0;border-radius:6px;">`) : '&nbsp;',
      DIGEST_WHITE, ` width="${THUMB_W}" valign="top"`),
  ), `border-bottom:1px solid ${DIGEST_RULE};`);
  return row(cell(`padding:0 ${SIDE}px;`, inner));
}

function rowsHtml(input: DigestEmailInput, rows: DigestEntry[]): string {
  if (rows.length === 0) return '';
  let html = row(cell(`padding:32px ${SIDE}px 0;`, rule(DIGEST_INK)));
  if (input.leadIn) {
    // A section label in the COMING UP style, not a caption sentence.
    html += row(cell(`padding:16px ${SIDE}px 0;`, labelHtml(input.leadIn, DIGEST_WHITE)));
  }
  let prev = '';
  for (const e of rows) {
    html += promoRowHtml(input, e, e.lead.date !== prev);
    prev = e.lead.date;
  }
  if (input.overflow > 0) {
    html += row(cell(`padding:14px ${SIDE}px 0;font-size:13px;line-height:1.4;color:${DIGEST_MUTED};`,
      `and ${input.overflow} more this week. <a href="${esc(input.siteUrl)}" style="color:${DIGEST_ACCENT};text-decoration:none;">See all on PromoNight</a>`));
  }
  return html;
}

// No-promo week (ruling 2026-11-05): send, never skip. One muted line, then
// three collection pages in the Coming up panel's style. The generic variant
// follows no teams, so its line does not say "your teams".
export const NO_PROMOS_LINE = 'Nothing announced yet for your teams. Here is what is on the calendar.';
export const NO_PROMOS_LINE_GENERIC = 'Nothing announced yet this week. Here is what is on the calendar.';
export const NO_PROMOS_LINKS: readonly { label: string; href: string }[] = [
  { label: 'Hot this week', href: '/promos/this-week' },
  { label: 'Bobbleheads', href: '/promos/bobbleheads' },
  { label: 'Theme nights', href: '/promos/theme-nights' },
];
const noPromosLine = (input: DigestEmailInput) => (input.variant === 'generic' ? NO_PROMOS_LINE_GENERIC : NO_PROMOS_LINE);

function noPromosHtml(input: DigestEmailInput): string {
  const links = NO_PROMOS_LINKS.map((l, i) => row(
    cell(`padding-top:${i === 0 ? '0' : '10px'};font-size:14px;line-height:1.4;color:${DIGEST_INK};`,
      `<a href="${esc(input.siteUrl + l.href)}" style="color:${DIGEST_INK};font-weight:500;text-decoration:none;">${esc(l.label)}</a>`, DIGEST_PANEL, ' align="left"'),
  )).join('');
  const panel = table(row(cell('padding:18px 20px;', table(links), DIGEST_PANEL)),
    'border-collapse:separate;border-radius:10px;', ` bgcolor="${DIGEST_PANEL}"`);
  return row(cell(`padding:28px ${SIDE}px 0;font-size:13px;line-height:1.4;color:${DIGEST_MUTED};`, esc(noPromosLine(input)))) +
    row(cell(`padding:14px ${SIDE}px 0;`, panel));
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

const upcomingLine = (e: UpcomingEntry) => [`${monthDay(e.lead.date)}`, e.lead.title, ...e.others.map((o) => o.title)].join(' · ');

function comingUpHtml(input: DigestEmailInput, items: UpcomingEntry[]): string {
  if (items.length === 0) return '';
  const lines = items.map((e, i) => {
    const team = input.context.teams.get(e.lead.teamId);
    return listRow(promoUrl(input, e.lead.href, e.lead.teamId), upcomingLine(e), team?.short || team?.name || '', DIGEST_PANEL, i === 0);
  }).join('');
  const panel = table(row(cell('padding:18px 20px;', labelHtml('Coming up', DIGEST_PANEL) + table(lines), DIGEST_PANEL)),
    'border-collapse:separate;border-radius:10px;', ` bgcolor="${DIGEST_PANEL}"`);
  return row(cell(`padding:24px ${SIDE}px 0;`, panel));
}

function siblingsHtml(input: DigestEmailInput, hero: DigestEntry, items: DigestUpcoming[]): string {
  if (items.length === 0) return '';
  const lines = items.map((u, i) => {
    const team = input.context.teams.get(u.teamId);
    return listRow(promoUrl(input, u.href, u.teamId), team?.name || u.teamId, monthDay(u.date), DIGEST_WHITE, i === 0);
  }).join('');
  return row(cell(`padding:28px ${SIDE}px 0;`, labelHtml(`${themeLabel(entryThemeKey(hero))} at other clubs`, DIGEST_WHITE) + table(lines)));
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

function textPromo(input: DigestEmailInput, e: DigestEntry): string[] {
  const p = e.lead;
  const line = [`${weekdayMonthDay(p.date)}: ${p.title} (${p.teamName})`, ...entryGameLine(e)].join(' · ');
  return [`- ${line}`, `  ${promoUrl(input, p.href, p.teamId)}`];
}

function renderText(input: DigestEmailInput, hero: DigestEntry | null, rows: DigestEntry[], next: UpcomingEntry[], siblings: DigestUpcoming[]): string {
  const manage = preferencesUrl(input);
  const out: string[] = ['PROMONIGHT', '', input.title, input.subline, ''];
  if (!hero && rows.length === 0) {
    out.push(noPromosLine(input), ...NO_PROMOS_LINKS.map((l) => `- ${l.label}: ${input.siteUrl}${l.href}`));
  }
  if (hero) out.push(...textPromo(input, hero), '');
  if (input.leadIn && rows.length) out.push(input.leadIn);
  for (const p of rows) out.push(...textPromo(input, p));
  if (input.overflow > 0) out.push(`...and ${input.overflow} more this week: ${input.siteUrl}`);
  if (next.length) {
    out.push('', 'Coming up:');
    for (const e of next) out.push(`- ${upcomingLine(e)} (${input.context.teams.get(e.lead.teamId)?.name ?? e.lead.teamId})`, `  ${promoUrl(input, e.lead.href, e.lead.teamId)}`);
  }
  if (hero && siblings.length) {
    out.push('', `${themeLabel(entryThemeKey(hero))} at other clubs:`);
    for (const u of siblings) out.push(`- ${input.context.teams.get(u.teamId)?.name ?? u.teamId}, ${monthDay(u.date)}`, `  ${promoUrl(input, u.href, u.teamId)}`);
  }
  out.push('', `${APP_COPY} Get the app: ${downloadUrl(input)}`, '');
  out.push(input.variant === 'generic' ? `Star your teams to personalize: ${manage}` : `Manage your teams: ${manage}`);
  out.push(`Unsubscribe: ${manage}&unsub=1`, '', DISCLOSURE, input.postalAddress);
  return out.join('\n');
}

/** Hidden preview text, first thing in the body. The run of zero-width
 *  joiners after it keeps clients from pulling body text (or the hero's alt
 *  text) into the rest of the preview line. mso-hide covers Outlook. */
function preheaderHtml(text: string): string {
  const filler = '&#847;&zwnj;&nbsp;'.repeat(60);
  return `<div style="display:none;font-size:1px;line-height:1px;max-height:0;max-width:0;opacity:0;overflow:hidden;mso-hide:all;color:${DIGEST_WHITE};">${esc(text)}${filler}</div>`;
}

// ── the document ─────────────────────────────────────────────────────────────

export function renderDigest(input: DigestEmailInput): RenderedDigest {
  const entries = collapseEntries(input.promos);
  const hero = input.heroAllowed ? pickHero(entries, input.overflow) : null;
  const rows = hero ? entries.filter((e) => e !== hero) : entries;
  const next = comingUp(input.context, input.followedTeamIds);
  const siblings = themeSiblings(input.context, hero);

  const body =
    headerHtml(input) +
    titleHtml(input) +
    (hero ? heroHtml(input, hero) : '') +
    (!hero && rows.length === 0 ? noPromosHtml(input) : rowsHtml(input, rows)) +
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
${preheaderHtml(input.preheader)}
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" bgcolor="${DIGEST_WHITE}" style="width:100%;background:${DIGEST_WHITE};"><tr><td align="center" bgcolor="${DIGEST_WHITE}" style="padding:0;background:${DIGEST_WHITE};">
${msoOpen}
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" align="center" bgcolor="${DIGEST_WHITE}" style="width:100%;max-width:${CONTAINER}px;margin:0 auto;background:${DIGEST_WHITE};border-collapse:collapse;">
${body}
</table>
${msoClose}
</td></tr></table>
</body>
</html>`;

  return { html, text: renderText(input, hero, rows, next, siblings), hero: hero?.lead ?? null, entryCount: entries.length };
}
