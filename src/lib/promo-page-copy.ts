// Per-promo pages (Phase 3b, 2026-10-29): the PURE half.
//
// Everything a promo page says is derived here from the stored promo fields
// and the team: the title and description, the dates, the image by tier, the
// badge and quantity line, the fact tiles, the FAQs, the category aggregator
// and the JSON-LD. Nothing here reads Firestore or the clock. The server half
// (src/lib/promo-pages.ts) resolves the rows and passes the site's day in, and
// the view (src/components/promo-page/PromoPageView.tsx) renders what this
// returns, so every rule a crawler sees is testable without a database.
//
// Spec: promonight/promo-pipeline/docs/per-promo-pages-spec.md (Page,
// Images, Metadata). Where the Phase 3b brief and the spec differ, the brief
// wins; the comments below say which.

import type { PromoType } from './types';
import { PROMO_TYPE_LABELS } from './types';
import { APPAREL_RE, BOBBLEHEAD_RE } from './promo-helpers';
import { siteYmd } from './site-today';

export const SITE_URL = 'https://www.getpromonight.com';
export const STORAGE_BUCKET = 'promonight.firebasestorage.app';
/** Google's snippet width; the brief's cap. */
export const DESCRIPTION_MAX = 155;
/** Rendered <title> budget, the layout's " | PromoNight" included. */
export const TITLE_MAX = 60;
const TITLE_SUFFIX = ' | PromoNight';
export const CARD_WIDTH = 1200;
export const CARD_HEIGHT = 630;

export const YMD_RE = /^\d{4}-\d{2}-\d{2}$/;
const SPLIT_SEASON_LEAGUES = new Set(['NHL', 'NBA']);

export type ImageTier = 1 | 3;

/** One promo document as the page reads it. The data contract (brief, 2026-10-29):
 *  every live promo carries updatedAt, pageSlug, pageSeason, themeKey and
 *  imageTier (1, 3, or absent = render the card); tier 1 carries imageRef,
 *  imageSourceUrl and imageCredit. The extraction fields below are the ones
 *  the tiles and FAQs read; absent means the tile or the FAQ does not exist. */
export interface PromoPageRow {
  promoId: string;
  /** YYYY-MM-DD, or '' when the document has no usable date (then noindex). */
  date: string;
  title: string;
  description: string;
  type: PromoType;
  /** The display slots (src/lib/promo-game-join.ts), never the stored fields. */
  displayTime: string;
  displayOpponent: string;
  highlight: boolean;
  attendanceCap: number | null;
  presentedBy: string | null;
  whileSuppliesLast: boolean | null;
  gateOpenTime: string | null;
  ageRestriction: string | null;
  redemptionLocation: string | null;
  ticketPackageRequired: boolean | null;
  ticketPackageName: string | null;
  sourceUrl: string | null;
  pageSlug: string;
  pageSeason: string | null;
  themeKey: string | null;
  imageTier: ImageTier | null;
  imageRef: string | null;
  imageSourceUrl: string | null;
  imageCredit: string | null;
  /** ISO instant of the row's last write (the writer's updatedAt). */
  updatedAt: string | null;
  tombstoned: boolean;
  /** ISO instant the row was tombstoned, when it was. */
  tombstonedAt: string | null;
}

export interface PromoPageLocation {
  name: string;
  streetAddress: string | null;
  locality: string | null;
  region: string | null;
}

// ── paths and seasons ────────────────────────────────────────────────────────

export function promoPagePath(sportSlug: string, teamId: string, pageSlug: string): string {
  return `/${sportSlug}/${teamId}/promos/${pageSlug}`;
}

/** The season label the pipeline stamps as pageSeason: the calendar year, or
 *  "2026-27" for the two split-season leagues with July 1 as the boundary.
 *  A mirror of promo-pipeline/lib/scanner/promo-page-fields.js seasonOf; the
 *  two must agree or a page resolves to the wrong season's rows. */
export function seasonLabelFor(league: string, ymd: string): string | null {
  const m = /^(\d{4})-(\d{2})-\d{2}$/.exec(ymd);
  if (!m) return null;
  const y = Number(m[1]);
  if (!SPLIT_SEASON_LEAGUES.has(String(league || '').toUpperCase())) return String(y);
  const start = m[2] >= '07' ? y : y - 1;
  return `${start}-${String(start + 1).slice(2)}`;
}

/** The label of the season before `season`: "2026-27" -> "2025-26", "2026" -> "2025". */
export function previousSeasonLabel(season: string): string | null {
  const split = /^(\d{4})-(\d{2})$/.exec(season);
  if (split) {
    const start = Number(split[1]) - 1;
    return `${start}-${String(start + 1).slice(2)}`;
  }
  if (/^\d{4}$/.test(season)) return String(Number(season) - 1);
  return null;
}

/** The slug without the season suffix a cross-season collision adds
 *  ("star-wars-night-2025-26" in season 2025-26 -> "star-wars-night"). */
export function baseSlugOf(pageSlug: string, pageSeason: string | null): string {
  if (pageSeason && pageSlug.endsWith(`-${pageSeason}`)) return pageSlug.slice(0, -(pageSeason.length + 1));
  return pageSlug;
}

/** Season labels compare as strings: "2025-26" < "2026-27", "2025" < "2026". */
export function laterSeason(a: string | null, b: string | null): string | null {
  if (a === null) return b;
  if (b === null) return a;
  return a >= b ? a : b;
}

// ── dates ────────────────────────────────────────────────────────────────────
// Calendar math in UTC on the YYYY-MM-DD string: no wall clock, no zone, so a
// render on Vercel (UTC) and a test on a laptop print the same words.

const DAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

function dateParts(ymd: string): { y: number; m: number; d: number; dow: number } | null {
  if (!YMD_RE.test(ymd)) return null;
  const [y, m, d] = ymd.split('-').map(Number);
  return { y, m, d, dow: new Date(Date.UTC(y, m - 1, d)).getUTCDay() };
}

/** "Oct 29" */
export function formatMonDay(ymd: string): string {
  const p = dateParts(ymd);
  return p ? `${MONTHS[p.m - 1]} ${p.d}` : ymd;
}

/** "Oct 29, 2026" */
export function formatMonDayYear(ymd: string): string {
  const p = dateParts(ymd);
  return p ? `${MONTHS[p.m - 1]} ${p.d}, ${p.y}` : ymd;
}

/** "Thursday, Oct 29, 2026" */
export function formatLongDate(ymd: string): string {
  const p = dateParts(ymd);
  return p ? `${DAYS[p.dow]}, ${MONTHS[p.m - 1]} ${p.d}, ${p.y}` : ymd;
}

/** The date-block pieces a card prints: "OCT" / "29" / "THU". */
export function dateBlock(ymd: string): { month: string; day: string; weekday: string } {
  const p = dateParts(ymd);
  if (!p) return { month: '', day: ymd, weekday: '' };
  return { month: MONTHS[p.m - 1].toUpperCase(), day: String(p.d).padStart(2, '0'), weekday: DAYS[p.dow].slice(0, 3).toUpperCase() };
}

/** "Oct 5, 2026" from an ISO instant, on the site's calendar day
 *  (src/lib/site-today.ts), so the words do not depend on where the page
 *  renders and no second day formatter exists here. */
export function formatInstantDate(iso: string | null): string | null {
  if (!iso) return null;
  const t = Date.parse(iso);
  if (Number.isNaN(t)) return null;
  return formatMonDayYear(siteYmd(new Date(t)));
}

// ── text ─────────────────────────────────────────────────────────────────────

/** Whitespace-collapsed, trimmed, with any <cite> wrapper the extractor left
 *  removed (the pipeline's guard runs at ingest; this is the belt). */
export function cleanText(value: unknown): string {
  if (typeof value !== 'string') return '';
  return value.replace(/<\/?cite\b[^>]*>/gi, '').replace(/\s+/g, ' ').trim();
}

/** Trim to the last word boundary at or before `max`. Unchanged when it fits. */
export function truncateAtWord(s: string, max: number): string {
  if (s.length <= max) return s;
  const slice = s.slice(0, max);
  const lastSpace = slice.lastIndexOf(' ');
  return (lastSpace > 0 ? slice.slice(0, lastSpace) : slice).replace(/[\s,;:]+$/, '');
}

function sentence(s: string): string {
  const t = cleanText(s);
  if (!t) return '';
  return /[.!?]$/.test(t) ? t : `${t}.`;
}

// ── title and description (brief B.6) ───────────────────────────────────────

/**
 * The bare <title> (the root layout's template appends " | PromoNight"):
 * `{Promo} | {Team} {Mon D, YYYY}`, the year dropped when the rendered title
 * would pass 60 characters; `{Promo} | {Team} {Season}` for a multi-date slug.
 */
export function promoPageTitle(title: string, teamName: string, dates: readonly string[], season: string | null): string {
  const name = cleanText(title);
  if (dates.length > 1) return season ? `${name} | ${teamName} ${season}` : `${name} | ${teamName}`;
  const date = dates[0];
  if (!date) return `${name} | ${teamName}`;
  const withYear = `${name} | ${teamName} ${formatMonDayYear(date)}`;
  if ((withYear + TITLE_SUFFIX).length <= TITLE_MAX) return withYear;
  return `${name} | ${teamName} ${formatMonDay(date)}`;
}

/** The rendered length of a bare title, suffix included, for the report. */
export function renderedTitleLength(bareTitle: string): number {
  return (bareTitle + TITLE_SUFFIX).length;
}

/**
 * The meta description: the source text (the stored description, which the
 * About section shows verbatim), then the game line when it still fits, cut
 * at a word boundary at 155. A promo with no source text gets its name and the
 * game line. A removed promo says so first.
 */
export function promoPageDescription(opts: {
  description: string;
  title: string;
  teamName: string;
  /** The opponent as displayed (the display slot), '' when unknown. */
  opponentName: string;
  date: string | null;
  venueName: string | null;
  removed?: boolean;
}): string {
  const source = sentence(opts.description);
  const who = opts.opponentName ? `${opts.teamName} vs ${cleanText(opts.opponentName)}` : opts.teamName;
  const when = opts.date && YMD_RE.test(opts.date) ? `, ${formatMonDayYear(opts.date)}` : '';
  const where = opts.venueName ? ` at ${opts.venueName}` : '';
  const tail = `${who}${when}${where}.`;
  let out: string;
  if (opts.removed) out = `Removed from the ${opts.teamName} schedule. ${source || sentence(opts.title)}`;
  else if (!source) out = `${sentence(opts.title)} ${tail}`;
  else out = `${source} ${tail}`.length <= DESCRIPTION_MAX ? `${source} ${tail}` : source;
  return truncateAtWord(out, DESCRIPTION_MAX);
}

// ── image by tier (spec Images; brief A.4) ───────────────────────────────────

export interface PageImage {
  kind: 'photo' | 'card';
  /** Absolute for the photo (Firebase download endpoint); site-relative for the card. */
  url: string;
  alt: string;
  credit: string | null;
  sourceUrl: string | null;
  width: number | null;
  height: number | null;
}

/** The public download URL of a stored tier 1 object, the one form the bucket
 *  serves without a token (the direct storage.googleapis.com form is 403). */
export function storageImageUrl(imageRef: string): string {
  return `https://firebasestorage.googleapis.com/v0/b/${STORAGE_BUCKET}/o/${encodeURIComponent(imageRef)}?alt=media`;
}

/** The card route for a row, keyed on the promo id and its updatedAt so the
 *  edge cache turns over with the document. The team rides as a query
 *  parameter because promo ids are unique within a team only (the social feed
 *  keys its cards "{teamId}~{promoId}" for the same reason). */
export function cardImagePath(teamId: string, promoId: string, updatedAt: string | null): string {
  const t = updatedAt ? Date.parse(updatedAt) : NaN;
  const v = Number.isNaN(t) ? '0' : String(t);
  return `/api/promo-card/${encodeURIComponent(promoId)}?team=${encodeURIComponent(teamId)}&v=${v}`;
}

/** The page's one image: the official item photo when the row is tier 1 with
 *  a stored object, else the generated card. A removed row never shows the
 *  photo: the item is no longer offered, and the card says so in words. */
export function pageImage(row: PromoPageRow, teamId: string, teamName: string, date: string | null): PageImage {
  const title = cleanText(row.title);
  if (row.imageTier === 1 && row.imageRef && !row.tombstoned) {
    return {
      kind: 'photo',
      url: storageImageUrl(row.imageRef),
      alt: `${title}, the ${teamName} giveaway item`,
      credit: row.imageCredit ? cleanText(row.imageCredit) : null,
      sourceUrl: row.imageSourceUrl ?? null,
      width: null,
      height: null,
    };
  }
  return {
    kind: 'card',
    url: cardImagePath(teamId, row.promoId, row.updatedAt),
    alt: date ? `${title}: ${teamName}, ${formatMonDayYear(date)}` : `${title}: ${teamName}`,
    credit: null,
    sourceUrl: null,
    width: CARD_WIDTH,
    height: CARD_HEIGHT,
  };
}

// ── badge, quantity, tiles (spec Page 1 and 4) ──────────────────────────────

export function badgeLabel(row: Pick<PromoPageRow, 'type' | 'tombstoned' | 'ticketPackageRequired'>): string {
  if (row.tombstoned) return 'Removed';
  if (row.ticketPackageRequired === true) return 'Ticket package';
  return PROMO_TYPE_LABELS[row.type] ?? 'Promo';
}

const formatCount = (n: number) => n.toLocaleString('en-US');

/** "First 10,000 fans" from the cap, else "While supplies last", else nothing. */
export function quantityLine(row: Pick<PromoPageRow, 'attendanceCap' | 'whileSuppliesLast'>): string | null {
  if (typeof row.attendanceCap === 'number' && row.attendanceCap > 0) return `First ${formatCount(row.attendanceCap)} fans`;
  if (row.whileSuppliesLast === true) return 'While supplies last';
  return null;
}

export interface FactTile {
  label: string;
  value: string;
  /** Presented-by renders in the text face, the others in the numeral cut. */
  numeral: boolean;
}

/** Doors, quantity, presented by. A tile exists only when its field does: no
 *  zeros, no placeholders (spec Page 4). */
export function factTiles(row: Pick<PromoPageRow, 'gateOpenTime' | 'attendanceCap' | 'presentedBy'>): FactTile[] {
  const tiles: FactTile[] = [];
  const doors = cleanText(row.gateOpenTime);
  if (doors) tiles.push({ label: 'Doors', value: doors, numeral: true });
  if (typeof row.attendanceCap === 'number' && row.attendanceCap > 0) tiles.push({ label: 'Quantity', value: formatCount(row.attendanceCap), numeral: true });
  const by = cleanText(row.presentedBy);
  if (by) tiles.push({ label: 'Presented by', value: by, numeral: false });
  return tiles;
}

// ── category aggregator (spec Internal linking, outbound 5) ─────────────────

export interface AggregatorLink {
  href: string;
  label: string;
}

/** The aggregator for the promo's type. Jersey and apparel giveaways go to the
 *  apparel page (soccer's own for MLS), bobbleheads to theirs, other giveaways
 *  to the ranked best-promos page, theme nights and food deals to their pages,
 *  and kids promos to the week board, which has no narrower page. */
export function categoryAggregatorFor(row: Pick<PromoPageRow, 'type' | 'title'>, league: string): AggregatorLink {
  const title = cleanText(row.title);
  if (row.type === 'theme') return { href: '/promos/theme-nights', label: 'Theme nights across pro sports' };
  if (row.type === 'food') return { href: '/promos/food-deals', label: 'Food deals across pro sports' };
  if (row.type === 'kids') return { href: '/promos/this-week', label: 'This week’s promos across every league' };
  if (BOBBLEHEAD_RE.test(title)) return { href: '/promos/bobbleheads', label: 'Bobblehead nights across pro sports' };
  if (APPAREL_RE.test(title)) {
    return league.toUpperCase() === 'MLS'
      ? { href: '/promos/soccer-jersey-nights', label: 'Soccer jersey nights across MLS' }
      : { href: '/promos/jersey-giveaways', label: 'Jersey and apparel giveaways across pro sports' };
  }
  return { href: '/best-promos', label: 'The best giveaways across pro sports' };
}

// ── theme labels ─────────────────────────────────────────────────────────────

const THEME_WORDS: Record<string, string> = { aapi: 'AAPI', dia: 'Día', de: 'de', los: 'los', lgbtq: 'LGBTQ', and: 'and', hop: 'Hop' };

/** "hispanic-heritage" -> "Hispanic Heritage". Null for the no-theme key. */
export function themeLabel(themeKey: string | null): string | null {
  if (!themeKey || themeKey === 'none') return null;
  return themeKey
    .split('-')
    .map((w) => THEME_WORDS[w] ?? w.charAt(0).toUpperCase() + w.slice(1))
    .join(' ');
}

// ── FAQs (spec Page 12: generated only from stored fields) ───────────────────

export interface PromoFaq {
  question: string;
  answer: string;
}

/**
 * Two questions, each answered only from stored fields, taken in order from
 * the pool below: removed, the dates of a multi-date slug, the special
 * ticket, arrival, pickup, age, the presenter. A question whose fields are
 * absent does not exist; a page with fewer than two answerable questions
 * renders what it has.
 */
export function promoFaqs(opts: {
  row: PromoPageRow;
  teamName: string;
  dates: readonly string[];
  removed: boolean;
  removedOn: string | null;
}): PromoFaq[] {
  const { row, teamName, dates, removed } = opts;
  const title = cleanText(row.title);
  const item = row.type === 'theme' || row.type === 'food' ? title : `the ${title}`;
  const cap = typeof row.attendanceCap === 'number' && row.attendanceCap > 0 ? row.attendanceCap : null;
  const pool: PromoFaq[] = [];

  if (removed) {
    pool.push({
      question: `Is ${title} still happening?`,
      answer: opts.removedOn
        ? `No. The ${teamName} removed it from their schedule on ${opts.removedOn}. The game itself is unaffected.`
        : `No. The ${teamName} removed it from their schedule. The game itself is unaffected.`,
    });
  }

  if (dates.length > 1) {
    pool.push({
      question: `Which games is ${title} on?`,
      answer: `${dates.length} ${teamName} home games this season: ${dates.map(formatMonDayYear).join(', ')}.`,
    });
  }

  // Special ticket: the stored flag, the stored package name, the stored cap.
  if (row.ticketPackageRequired === true) {
    const pkg = cleanText(row.ticketPackageName);
    pool.push({
      question: `Do I need a special ticket for ${item}?`,
      answer: pkg ? `Yes. ${pkg} is required; a standard game ticket does not include it.` : 'Yes. A special ticket package is required; a standard game ticket does not include it.',
    });
  } else if (row.ticketPackageRequired === false || cap !== null || row.whileSuppliesLast === true) {
    const parts = [row.ticketPackageRequired === false ? 'No. Any game ticket counts.' : `The ${teamName} listing names no special ticket, so any game ticket should count.`];
    if (cap !== null) parts.push(`The first ${formatCount(cap)} fans through the gates receive one.`);
    else if (row.whileSuppliesLast === true) parts.push('It is handed out while supplies last.');
    pool.push({ question: `Do I need a special ticket for ${item}?`, answer: parts.join(' ') });
  }

  // Arrival: the stored door time, else the game time.
  const doors = cleanText(row.gateOpenTime);
  const time = cleanText(row.displayTime);
  if (doors || time) {
    const parts: string[] = [];
    if (doors) parts.push(`Doors open at ${doors}.`);
    if (time) parts.push(`Game time is ${time}.`);
    if (cap !== null) parts.push(`Only the first ${formatCount(cap)} fans receive one, so arrive early.`);
    else if (row.whileSuppliesLast === true) parts.push('It is while supplies last, so arrive early.');
    pool.push({ question: 'What time should I arrive?', answer: parts.join(' ') });
  }

  const where = cleanText(row.redemptionLocation);
  if (where) pool.push({ question: `Where do I pick up ${item}?`, answer: sentence(where) });

  const age = cleanText(row.ageRestriction);
  if (age) pool.push({ question: 'Is there an age limit?', answer: sentence(age) });

  const by = cleanText(row.presentedBy);
  if (by) pool.push({ question: `Who presents ${item}?`, answer: `${by}.` });

  return pool.slice(0, 2);
}

// ── indexability (brief A.5, spec Lifecycle) ─────────────────────────────────

/** Noindex when the name or every date is missing, and when a removed page's
 *  last date has passed. A removed page before its date stays indexable: it
 *  says the promotion is gone, which is the useful answer until the game. */
export function promoPageIndexable(opts: { title: string; dates: readonly string[]; removed: boolean; today: string }): boolean {
  if (!cleanText(opts.title)) return false;
  const valid = opts.dates.filter((d) => YMD_RE.test(d));
  if (valid.length === 0) return false;
  if (opts.removed) return valid[valid.length - 1] >= opts.today;
  return true;
}

// ── JSON-LD (brief B.7) ──────────────────────────────────────────────────────

type Schema = Record<string, unknown>;

export interface PromoJsonLdInput {
  canonical: string;
  /** The bare page title (the WebPage name). */
  title: string;
  description: string;
  promoName: string;
  teamName: string;
  /** Live rows, one per date, date-ascending. Empty on a removed page, which
   *  then emits its removed rows as cancelled events. */
  rows: readonly PromoPageRow[];
  removed: boolean;
  /** Absolute image URL (the og:image). */
  imageUrl: string;
  location: PromoPageLocation | null;
  ticketUrl: string | null;
  /** The latest updatedAt across the page's rows. */
  dateModified: string | null;
  faqs: readonly PromoFaq[];
  breadcrumbs: readonly { name: string; url: string }[];
}

function placeOf(loc: PromoPageLocation | null): Schema | undefined {
  if (!loc) return undefined;
  const address: Schema = { '@type': 'PostalAddress' };
  if (loc.streetAddress) address.streetAddress = loc.streetAddress;
  if (loc.locality) address.addressLocality = loc.locality;
  if (loc.region) address.addressRegion = loc.region;
  return { '@type': 'Place', name: loc.name, address };
}

export function promoPageJsonLd(input: PromoJsonLdInput): Schema[] {
  const webPage: Schema = {
    '@context': 'https://schema.org',
    '@type': 'WebPage',
    '@id': input.canonical,
    url: input.canonical,
    name: input.title,
    description: input.description,
    isPartOf: { '@type': 'WebSite', name: 'PromoNight', url: SITE_URL },
  };
  // The verifier and the weekly tripwire read this value and compare it with
  // the document's updatedAt, so it is that instant and nothing else: never
  // the render clock. Omitted when the rows carry none.
  if (input.dateModified) webPage.dateModified = input.dateModified;

  const place = placeOf(input.location);
  const events: Schema[] = input.rows
    .filter((r) => YMD_RE.test(r.date))
    .map((r) => {
      const e: Schema = {
        '@context': 'https://schema.org',
        '@type': 'Event',
        name: input.promoName,
        startDate: r.date,
        url: input.canonical,
        image: [input.imageUrl],
        description: input.description,
        eventStatus: input.removed ? 'https://schema.org/EventCancelled' : 'https://schema.org/EventScheduled',
        eventAttendanceMode: 'https://schema.org/OfflineEventAttendanceMode',
        organizer: { '@type': 'SportsTeam', name: input.teamName },
      };
      if (place) e.location = place;
      const doors = cleanText(r.gateOpenTime);
      if (doors) e.doorTime = doors;
      if (input.ticketUrl && !input.removed) e.offers = { '@type': 'Offer', url: input.ticketUrl, availability: 'https://schema.org/InStock' };
      return e;
    });

  const faq: Schema | null = input.faqs.length
    ? {
        '@context': 'https://schema.org',
        '@type': 'FAQPage',
        mainEntity: input.faqs.map((f) => ({ '@type': 'Question', name: f.question, acceptedAnswer: { '@type': 'Answer', text: f.answer } })),
      }
    : null;

  const breadcrumbs: Schema = {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: input.breadcrumbs.map((b, i) => ({ '@type': 'ListItem', position: i + 1, name: b.name, item: b.url })),
  };

  return [webPage, ...events, ...(faq ? [faq] : []), breadcrumbs];
}
