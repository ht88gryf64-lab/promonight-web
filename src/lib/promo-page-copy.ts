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

/** THE FLAG. PROMO_PAGES_LIVE gates the route, the card route, the sitemap
 *  section and (Phase 3c) the page fields the mapper attaches, so the inbound
 *  links appear and disappear with the pages. Lives here, in the pure half,
 *  so the data layer can read it without importing the server half. */
export function isPromoPagesLive(env: NodeJS.ProcessEnv = process.env): boolean {
  return String(env.PROMO_PAGES_LIVE ?? '').trim().toLowerCase() === 'true';
}

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

/** The generated card's date line for a series: "8 home games · Oct 29 to Mar 20, 2027". */
export function seriesLine(dates: readonly string[]): string {
  const valid = [...new Set(dates.filter((d) => YMD_RE.test(d)))].sort();
  if (valid.length === 0) return '';
  if (valid.length === 1) return formatLongDate(valid[0]);
  const first = valid[0];
  const last = valid[valid.length - 1];
  const sameYear = first.slice(0, 4) === last.slice(0, 4);
  return `${valid.length} home games \u00b7 ${sameYear ? formatMonDay(first) : formatMonDayYear(first)} to ${formatMonDayYear(last)}`;
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

// A terminator that ends a sentence: . ! or ? followed by a space or the end,
// unless the word before it is an abbreviation or an initial ("St. Paul",
// "7 p.m.", "J. Smith"), which is a dot inside a sentence, not its end.
const ABBREVIATIONS = new Set(['st', 'mt', 'ft', 'dr', 'mr', 'mrs', 'ms', 'jr', 'sr', 'vs', 'no', 'inc', 'co', 'ltd', 'p.m', 'a.m', 'pm', 'am', 'u.s', 'e.g', 'i.e']);
function sentenceEnds(s: string): number[] {
  const ends: number[] = [];
  const re = /[.!?]+(?=\s|$)/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(s)) !== null) {
    const end = m.index + m[0].length;
    const before = s.slice(0, m.index);
    const word = (before.match(/(\S+)$/) ?? ['', ''])[1].toLowerCase();
    if (/^[a-z]$/.test(word) || ABBREVIATIONS.has(word) || ABBREVIATIONS.has(word.replace(/\.$/, ''))) continue;
    ends.push(end);
  }
  return ends;
}

/**
 * Trim to the last sentence boundary at or before `max` (Gate A ruling,
 * 2026-10-29): a description never ends in a fragment. Only when the FIRST
 * sentence alone is longer than `max` is there no boundary to cut at, and
 * then the word boundary inside it is the cut.
 */
export function truncateAtSentence(s: string, max: number): string {
  if (s.length <= max) return s;
  const ends = sentenceEnds(s).filter((e) => e <= max);
  if (ends.length === 0) return truncateAtWord(s, max);
  return s.slice(0, ends[ends.length - 1]).trimEnd();
}

function sentence(s: string): string {
  const t = cleanText(s);
  if (!t) return '';
  return /[.!?]$/.test(t) ? t : `${t}.`;
}

// ── title and description (brief B.6) ───────────────────────────────────────

/**
 * The bare <title> (the root layout's template appends " | PromoNight"): the
 * first shape whose rendered length does not pass 60 wins (ruling
 * 2026-10-30), in this order:
 *   1. `{Promo} | {Team} {Mon D, YYYY}`   the full team name with the year
 *   2. `{Promo} | {Team} {Mon D}`         the full team name, no year
 *   3. `{Promo} | {Nickname} {Mon D}`     the club's nickname with the date
 *   4. `{Promo} | {Nickname}`             the nickname alone
 *   5. `{Promo}`                          the promo name alone
 * A multi-date slug runs the same cascade with the season in place of the
 * date (`{Promo} | {Team} {Season}`, then without the season, then the
 * nickname with and without it, then the name). A page with no date runs it
 * from shape 2. The nickname shapes are skipped when no nickname is given.
 * The last shape is taken even when it passes 60: the name is the title.
 */
export function promoPageTitle(title: string, teamName: string, dates: readonly string[], season: string | null, teamNickname?: string | null): string {
  const name = cleanText(title);
  const series = dates.length > 1;
  const date = dates.length === 1 ? dates[0] : null;
  // Shape 1's tail: the year form of the date, or the season on a series.
  // Shape 2's tail: the short date; a series (and a dateless page) has none,
  // the full name stands alone. Shape 3's tail: the short date, or the season.
  const long = series ? season : date ? formatMonDayYear(date) : null;
  const short = series ? null : date ? formatMonDay(date) : null;
  const nickTail = series ? season : short;
  const nick = teamNickname && teamNickname.trim() && teamNickname.trim() !== teamName ? teamNickname.trim() : null;
  const shapes: string[] = [];
  if (long) shapes.push(`${name} | ${teamName} ${long}`);
  shapes.push(short ? `${name} | ${teamName} ${short}` : `${name} | ${teamName}`);
  if (nick) {
    if (nickTail) shapes.push(`${name} | ${nick} ${nickTail}`);
    shapes.push(`${name} | ${nick}`);
  }
  shapes.push(name);
  return shapes.find((s) => renderedTitleLength(s) <= TITLE_MAX) ?? name;
}

/** The rendered length of a bare title, suffix included, for the report. */
export function renderedTitleLength(bareTitle: string): number {
  return (bareTitle + TITLE_SUFFIX).length;
}

/**
 * The meta description: the source text (the stored description, which the
 * About section shows verbatim), then the game line, cut at the last sentence
 * boundary under 155 (a word boundary only when the first sentence alone is
 * longer than that). A promo with no source text gets its name and the game
 * line. A removed promo says so first.
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
  else out = `${source} ${tail}`;
  return truncateAtSentence(out, DESCRIPTION_MAX);
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

/** The noun a page uses for its own kind ("About this giveaway"), and the
 *  plural a cross-team heading uses ("More NHL theme nights coming up").
 *  A kids row is a promotion: "kidss" is not a word (review finding 4). */
export function typeNoun(type: PromoType): string {
  return type === 'giveaway' ? 'giveaway' : type === 'theme' ? 'theme night' : type === 'food' ? 'food deal' : 'promotion';
}
export function typePlural(type: PromoType): string {
  return type === 'giveaway' ? 'giveaways' : type === 'theme' ? 'theme nights' : type === 'food' ? 'food deals' : 'kids promos';
}

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
      answer: opts.removedOn ? `No. The ${teamName} removed it from their schedule on ${opts.removedOn}.` : `No. The ${teamName} removed it from their schedule.`,
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

  // Arrival: only when the team lists a door time (ruling 2026-10-29); a
  // game time alone does not answer "what time should I arrive".
  const doors = cleanText(row.gateOpenTime);
  const time = cleanText(row.displayTime);
  if (doors) {
    const parts: string[] = [`Doors open at ${doors}.`];
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

// ── canonical pages (ruling 2026-10-29) ──────────────────────────────────────
// A scan often writes a theme night and its giveaway as two rows on one game
// ("Star Wars Night", "Star Wars Night Layered Hoodie"), each with a page. On
// one team and date, pages whose normalized titles nest (one is a substring
// or a token subset of the other) are ONE group with ONE canonical page: a
// tier 1 giveaway when the group has one (the most specific of several), else
// the title with the most tokens, the longest on a tie, the lower slug on a
// full tie. The others render with rel=canonical to it and leave the sitemap;
// the lists ("Also at this game") keep them. Only a single-date page can be
// the duplicate: a series page has dates its winner does not describe. The
// server half applies this at render (resolvePromoPage) and in the sitemap
// builder from the same function.

export interface CanonicalCandidate {
  pageSlug: string;
  title: string;
  type: PromoType;
  imageTier: ImageTier | null;
}

export interface CanonicalGroup<T extends CanonicalCandidate> {
  winner: T;
  members: T[];
}

/** The title as the rule compares it: diacritics folded, lowercase, every
 *  run of anything but a letter or digit one space. */
export function canonicalTitleKey(title: string): string {
  return String(title || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

/** Two titles nest: equal, one a substring of the other at word boundaries
 *  (a run of whole tokens; "Pen" is not inside "Opening Night"), or every
 *  token of the shorter in the longer. An empty title nests with nothing. */
export function titlesNest(a: string, b: string): boolean {
  const ka = canonicalTitleKey(a);
  const kb = canonicalTitleKey(b);
  if (!ka || !kb) return false;
  if (ka === kb) return true;
  const [short, long] = ka.length <= kb.length ? [ka, kb] : [kb, ka];
  if (` ${long} `.includes(` ${short} `)) return true;
  const tokens = new Set(long.split(' '));
  return short.split(' ').every((t) => tokens.has(t));
}

const tokenCount = (title: string): number => canonicalTitleKey(title).split(' ').filter(Boolean).length;

/** The most specific member: most tokens, the longest key on a tie, the
 *  lower slug on a full tie (deterministic across renders). */
function mostSpecific<T extends CanonicalCandidate>(members: readonly T[]): T {
  return [...members].sort(
    (a, b) =>
      tokenCount(b.title) - tokenCount(a.title) ||
      canonicalTitleKey(b.title).length - canonicalTitleKey(a.title).length ||
      a.pageSlug.localeCompare(b.pageSlug),
  )[0];
}

/** The canonical page of a group: a tier 1 giveaway when the group has one
 *  (the most specific of several), else the most specific title. */
export function canonicalWinner<T extends CanonicalCandidate>(members: readonly T[]): T {
  const tier1 = members.filter((m) => m.type === 'giveaway' && m.imageTier === 1);
  return mostSpecific(tier1.length ? tier1 : members);
}

/** The groups among one team's pages on ONE date, one candidate per slug
 *  (same-date twins under one slug are one page; the twin that is a tier 1
 *  giveaway stands for it, so the winner does not depend on document
 *  order): the connected components under titlesNest with two or more
 *  members, each with its winner. Pages in no group are not returned. */
export function canonicalGroups<T extends CanonicalCandidate>(candidates: readonly T[]): CanonicalGroup<T>[] {
  const bySlug = new Map<string, T>();
  const isTier1Giveaway = (c: T) => c.type === 'giveaway' && c.imageTier === 1;
  for (const c of candidates) {
    if (!c.pageSlug) continue;
    const prior = bySlug.get(c.pageSlug);
    if (!prior || (!isTier1Giveaway(prior) && isTier1Giveaway(c))) bySlug.set(c.pageSlug, c);
  }
  const pages = [...bySlug.values()];
  const grouped = new Set<number>();
  const out: CanonicalGroup<T>[] = [];
  for (let i = 0; i < pages.length; i++) {
    if (grouped.has(i)) continue;
    const comp = [i];
    grouped.add(i);
    for (let x = 0; x < comp.length; x++) {
      for (let j = 0; j < pages.length; j++) {
        if (grouped.has(j) || !titlesNest(pages[comp[x]].title, pages[j].title)) continue;
        grouped.add(j);
        comp.push(j);
      }
    }
    if (comp.length < 2) continue;
    const members = comp.map((k) => pages[k]);
    out.push({ winner: canonicalWinner(members), members });
  }
  return out;
}

/** The slug the page `pageSlug` is a duplicate of among `candidates` (the
 *  team's pages on its date), or null when it is its own canonical or in
 *  no group. */
export function canonicalSlugFor<T extends CanonicalCandidate>(pageSlug: string, candidates: readonly T[]): string | null {
  for (const g of canonicalGroups(candidates)) {
    if (g.winner.pageSlug === pageSlug) return null;
    if (g.members.some((m) => m.pageSlug === pageSlug)) return g.winner.pageSlug;
  }
  return null;
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
