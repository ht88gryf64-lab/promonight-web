// Event tour-stop pages (/events, Phase 2, 2026-11-18): the PURE half.
// Client-safe: no Firestore, no clock of its own (every function that needs
// "now" takes it), no env read except the flag.
//
// THE FLAG. EVENTS_PAGES_LIVE gates every /events route, the card route, the
// sitemap section, the nightly refresh paths and every inbound link, the way
// PROMO_PAGES_LIVE gates the promo family. Unset or anything but "true":
// each route is a 404 before any read, and eventPageHref returns null, so no
// module, footer link or sitemap entry renders.
//
// WHAT A PAGE MAY SAY. Only what is stored on the stop (eventStops, written
// by the pipeline from the ticket source and from each venue's own page) and
// what the venue hub already publishes under the web's own predicates.
// Nothing here is read from, quoted from or linked to the tour operator's
// sites (ruling 2026-11-17). No price, no image of any kind but the
// generated text card. Copy is written for adults buying tickets.

import { ymdInZone } from '../promo-date-tile';

export function isEventsPagesLive(env: NodeJS.ProcessEnv = process.env): boolean {
  return String(env.EVENTS_PAGES_LIVE ?? '').trim().toLowerCase() === 'true';
}

export const EVENTS_SITE_URL = 'https://www.getpromonight.com';

/** The shows that have pages. The key is the URL segment and the eventStops
 *  doc id prefix. A show is never a league and never enters the league nav. */
export const EVENT_SHOWS = {
  'monster-jam': { slug: 'monster-jam', name: 'Monster Jam' },
} as const;
export type EventShowSlug = keyof typeof EVENT_SHOWS;
export interface EventShow { slug: EventShowSlug; name: string }

export function eventShowOf(slug: string): EventShow | null {
  return Object.prototype.hasOwnProperty.call(EVENT_SHOWS, slug) ? (EVENT_SHOWS as Record<string, EventShow>)[slug] : null;
}

/** The line every /events page carries in its footer. */
export const EVENTS_NOT_AFFILIATED = 'PromoNight is not affiliated with Monster Jam or Feld Entertainment.';

const SLUG_RE = /^[a-z0-9][a-z0-9-]{0,79}$/;
export const isEventSlug = (s: unknown): s is string => typeof s === 'string' && SLUG_RE.test(s);

// ── paths and the ONE inbound helper ────────────────────────────────────────

export const EVENTS_INDEX_PATH = '/events';
export const eventHubPath = (show: string) => `/events/${show}`;
export const eventStopPath = (show: string, venue: string) => `/events/${show}/${venue}`;

/** Where a link INTO /events sits. Every inbound anchor names one. */
export const EVENT_LINK_SURFACES = ['venue_events_module', 'team_also_at', 'footer_events', 'events_hub_list'] as const;
export type EventLinkSurface = (typeof EVENT_LINK_SURFACES)[number];
/** Where a link OUT of /events to the rest of the site sits. */
export const EVENT_OUT_SURFACES = ['event_to_venue', 'event_to_team'] as const;
export type EventOutSurface = (typeof EVENT_OUT_SURFACES)[number];

export type EventPageTarget = { kind: 'index' } | { kind: 'hub'; show: string } | { kind: 'stop'; show: string; venue: string };

export interface EventPageLinkTarget {
  href: string;
  surface: EventLinkSurface;
  show: string | null;
  venueSlug: string | null;
}

/**
 * The ONE helper every link into /events goes through (the events twin of
 * promoPageHref). Null while the flag is off, for an unknown show, or for a
 * slug that is not a slug: the caller then renders nothing. The surface rides
 * with the href so the anchor (EventPageLink) reports it on the click.
 * `live` defaults to the flag; a server caller passes nothing.
 */
export function eventPageHref(target: EventPageTarget, surface: EventLinkSurface, live: boolean = isEventsPagesLive()): EventPageLinkTarget | null {
  if (!live || !EVENT_LINK_SURFACES.includes(surface)) return null;
  if (target.kind === 'index') return { href: EVENTS_INDEX_PATH, surface, show: null, venueSlug: null };
  if (!eventShowOf(target.show)) return null;
  if (target.kind === 'hub') return { href: eventHubPath(target.show), surface, show: target.show, venueSlug: null };
  if (!isEventSlug(target.venue)) return null;
  return { href: eventStopPath(target.show, target.venue), surface, show: target.show, venueSlug: target.venue };
}

/** Team pages that do NOT get the "Also at {venue}" link, because the link
 *  would take the page's server HTML past the 950,000-byte cap the live
 *  battery enforces (CLAUDE.md). Measured on the branch with the flag on
 *  (docs/events-monster-jam-spec.md, Build notes); empty means every team
 *  page at a stop's building has room. */
export const TEAM_ALSO_AT_SKIP: ReadonlySet<string> = new Set<string>([]);

/** page_type, show and venue slug for a pathname under /events, else null.
 *  Read by PageViewTracker for the page_view event. */
export type EventsPageType = 'events_index' | 'event_hub' | 'event_stop';
export function eventsPageIdentity(pathname: string): { page_type: EventsPageType; show?: string; venue_slug?: string; content_group: 'events' } | null {
  const m = /^\/events(?:\/([a-z0-9-]+)(?:\/([a-z0-9-]+))?)?\/?$/.exec(pathname);
  if (!m) return null;
  if (!m[1]) return { page_type: 'events_index', content_group: 'events' };
  if (!m[2]) return { page_type: 'event_hub', show: m[1], content_group: 'events' };
  return { page_type: 'event_stop', show: m[1], venue_slug: m[2], content_group: 'events' };
}

// ── the stop, as the mapper hands it to a page ──────────────────────────────

export type EventPerformanceStatus = 'onsale' | 'soldout' | 'unknown';

export interface EventPerformance {
  /** {date}T{HHmm}, the doc id. */
  key: string;
  date: string;
  /** HH:mm, the venue's wall clock. */
  startTime: string;
  /** ISO with the venue's UTC offset. */
  startsAt: string;
  visitId: string;
  status: EventPerformanceStatus;
  /** The ticket source's event id, or null when the row carries none. */
  tnEventId: number | null;
}

export interface EventVisit {
  visitId: string;
  startDate: string;
  endDate: string;
}

/** A fact the venue prints for this event. `sourceUrl` is the venue's own page. */
export interface EventRuleFact { visitId: string; text: string; sourceUrl: string; observedAt: string }
export interface EventPitParty { visitId: string; performance: string; start: string; end: string; sourceUrl: string; observedAt: string }
/** `opensAt` is HH:mm, the venue's wall clock (the stored gate-time entry of the stop's eventPolicies). */
export interface EventGateTime { visitId: string; performance: string; opensAt: string; sourceUrl: string; observedAt: string }

export type EventBagPolicy =
  | { mode: 'rule'; text: string; sourceUrl: string; observedAt: string }
  | { mode: 'other-event-rule'; text: string; caveat: string; sourceUrl: string; observedAt: string }
  | { mode: 'pointer'; sourceUrl: string };

export interface EventStop {
  show: EventShowSlug;
  /** The page slug (minted once) and the venue hub id. */
  venueSlug: string;
  hubId: string;
  previousSlugs: string[];
  searchCity: string;
  timezone: string;
  tombstoned: boolean;
  bagPolicy: EventBagPolicy | null;
  bagRules: EventRuleFact[];
  pitParty: EventPitParty[];
  gateTimes: EventGateTime[];
  reEntry: EventRuleFact[];
  visits: EventVisit[];
  /** Live (not tombstoned) performances, oldest first. */
  performances: EventPerformance[];
  /** ISO of the latest write under the stop, or null. */
  updatedAt: string | null;
}

// ── time ────────────────────────────────────────────────────────────────────

const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const WEEKDAYS_LONG = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const MONTHS_LONG = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
export const EVENT_YMD_RE = /^\d{4}-\d{2}-\d{2}$/;

function ymdParts(ymd: string): { y: number; m: number; d: number; dow: number } {
  const y = Number(ymd.slice(0, 4)); const m = Number(ymd.slice(5, 7)); const d = Number(ymd.slice(8, 10));
  return { y, m, d, dow: new Date(Date.UTC(y, m - 1, d)).getUTCDay() };
}
/** "17:00" -> "5:00 PM". */
export function formatClock(hhmm: string): string {
  const m = /^(\d{2}):(\d{2})$/.exec(hhmm);
  if (!m) return '';
  const h = Number(m[1]);
  return `${h % 12 === 0 ? 12 : h % 12}:${m[2]} ${h < 12 ? 'AM' : 'PM'}`;
}
/** "Sat, Feb 20". */
export function formatShortDay(ymd: string): string {
  const p = ymdParts(ymd);
  return `${WEEKDAYS[p.dow]}, ${MONTHS[p.m - 1]} ${p.d}`;
}
/** "Saturday, February 20, 2027". */
export function formatLongDay(ymd: string): string {
  const p = ymdParts(ymd);
  return `${WEEKDAYS_LONG[p.dow]}, ${MONTHS_LONG[p.m - 1]} ${p.d}, ${p.y}`;
}
export function dayTile(ymd: string): { weekday: string; day: string; month: string } {
  const p = ymdParts(ymd);
  return { weekday: WEEKDAYS[p.dow].toUpperCase(), day: String(p.d), month: MONTHS[p.m - 1].toUpperCase() };
}
export const monthLabel = (ym: string) => `${MONTHS_LONG[Number(ym.slice(5, 7)) - 1]} ${ym.slice(0, 4)}`;
/** "Feb 20 to 21", "Jan 30 to Feb 1", "Feb 20". Year appended by the caller. */
export function formatRange(startYmd: string, endYmd: string): string {
  const a = ymdParts(startYmd); const b = ymdParts(endYmd);
  if (startYmd === endYmd) return `${MONTHS[a.m - 1]} ${a.d}`;
  if (a.m === b.m && a.y === b.y) return `${MONTHS[a.m - 1]} ${a.d} to ${b.d}`;
  return `${MONTHS[a.m - 1]} ${a.d} to ${MONTHS[b.m - 1]} ${b.d}`;
}
/** A range with its year: "Feb 20 to 21, 2027"; across New Year,
 *  "Dec 19, 2026 to Feb 21, 2027". */
export function formatRangeWithYear(startYmd: string, endYmd: string): string {
  const ys = startYmd.slice(0, 4); const ye = endYmd.slice(0, 4);
  return ys === ye ? `${formatRange(startYmd, endYmd)}, ${ye}` : `${formatRange(startYmd, startYmd)}, ${ys} to ${formatRange(endYmd, endYmd)}, ${ye}`;
}
/** "Sat, Feb 20 and Sun, Feb 21, 2027" for a short run; a range for a long one. */
export function formatDatesLine(dates: string[]): string {
  const uniq = [...new Set(dates)].sort();
  if (!uniq.length) return '';
  const year = uniq[uniq.length - 1].slice(0, 4);
  // A run that crosses New Year names both years: "Dec 19, 2026 to Feb 21, 2027".
  if (uniq[0].slice(0, 4) !== year) return `${formatRange(uniq[0], uniq[0])}, ${uniq[0].slice(0, 4)} to ${formatRange(uniq[uniq.length - 1], uniq[uniq.length - 1])}, ${year}`;
  if (uniq.length === 1) return `${formatShortDay(uniq[0])}, ${year}`;
  if (uniq.length === 2) return `${formatShortDay(uniq[0])} and ${formatShortDay(uniq[1])}, ${year}`;
  return `${formatRange(uniq[0], uniq[uniq.length - 1])}, ${year}`;
}

/**
 * How a set of showtimes reads as one line. One visit: its days ("Sat, Feb 20
 * and Sun, Feb 21, 2027"). Several visits: never one continuous range, which
 * would read as a run of weeks; a count between two dates instead ("8 shows
 * between Dec 19, 2026 and Feb 21, 2027").
 */
export function showsPhrase(dates: string[], visitCount: number): string {
  const sorted = [...dates].sort();
  if (!sorted.length) return '';
  if (visitCount <= 1) return formatDatesLine(sorted);
  const a = sorted[0]; const b = sorted[sorted.length - 1];
  const day = (ymd: string) => `${formatRange(ymd, ymd)}, ${ymd.slice(0, 4)}`;
  return `${sorted.length} shows between ${a.slice(0, 4) === b.slice(0, 4) ? formatRange(a, a) : day(a)} and ${day(b)}`;
}

// ── what is upcoming, by the clock ──────────────────────────────────────────

export interface StopTimeline {
  /** Performances whose start instant is after `now`, grouped by visit, oldest first. */
  upcoming: Array<{ visit: EventVisit; performances: EventPerformance[] }>;
  /** The most recent visit with a performance at or before `now`: the "Last visit" block. */
  lastVisit: { visit: EventVisit; performances: EventPerformance[] } | null;
  /** A stored visit dated after today that has no upcoming performance row
   *  (its dates are stored, its showtimes are not): "Returns in {year}". */
  returnsYear: number | null;
}

/** A performance past its start time is past, by the clock, whatever its date. */
export function stopTimeline(stop: Pick<EventStop, 'visits' | 'performances'> & { timezone?: string }, now: Date): StopTimeline {
  const t = now.getTime();
  const isUpcoming = (p: EventPerformance) => { const at = Date.parse(p.startsAt); return Number.isFinite(at) && at > t; };
  const visitOf = (id: string): EventVisit => stop.visits.find((v) => v.visitId === id) ?? { visitId: id, startDate: id, endDate: id };
  const byVisit = (rows: EventPerformance[]) => {
    const ids = [...new Set(rows.map((p) => p.visitId))];
    return ids.map((id) => ({ visit: visitOf(id), performances: rows.filter((p) => p.visitId === id).sort((a, b) => a.key.localeCompare(b.key)) }))
      .sort((a, b) => a.performances[0].key.localeCompare(b.performances[0].key));
  };
  const sorted = [...stop.performances].sort((a, b) => a.key.localeCompare(b.key));
  const upcoming = byVisit(sorted.filter(isUpcoming));
  const past = byVisit(sorted.filter((p) => !isUpcoming(p)));
  const lastVisit = past.length ? past[past.length - 1] : null;
  const upcomingVisitIds = new Set(upcoming.map((g) => g.visit.visitId));
  // "Today" is the venue's day, not UTC's: a visit that starts tomorrow in
  // Los Angeles is still a later visit at 6 PM Pacific the evening before.
  const todayYmd = ymdInZone(now, stop.timezone);
  const later = stop.visits.filter((v) => !upcomingVisitIds.has(v.visitId) && EVENT_YMD_RE.test(v.startDate) && v.startDate > todayYmd).sort((a, b) => a.startDate.localeCompare(b.startDate));
  return { upcoming, lastVisit, returnsYear: !upcoming.length && later.length ? Number(later[0].startDate.slice(0, 4)) : null };
}

export const upcomingPerformances = (tl: StopTimeline): EventPerformance[] => tl.upcoming.flatMap((g) => g.performances);

// ── the bag block: the first that exists, and nothing else ──────────────────

export type BagBlock =
  | { kind: 'event-rule'; label: string; rules: EventRuleFact[] }
  | { kind: 'operator-rule'; label: string; text: string; sourceUrl: string; observedAt: string }
  | { kind: 'other-event-rule'; label: string; text: string; caveat: string; sourceUrl: string; observedAt: string }
  | { kind: 'pointer'; label: string; text: string; sourceUrl: string };

/**
 * Precedence (ruling 2026-11-18): (a) the venue's rule for this event; (b) the
 * operator's all-events rule; (c) the operator's rule for other events, with
 * its caveat; (d) a pointer to the operator's bag page. The venue hub's own
 * bag rule never renders on a stop page: it was sourced for the home team's
 * game days. `visitIds` limits (a) to the visits the page is showing.
 */
export function bagBlockFor(stop: Pick<EventStop, 'bagPolicy' | 'bagRules'>, venueName: string, visitIds: string[]): BagBlock | null {
  const rules = stop.bagRules.filter((r) => visitIds.includes(r.visitId));
  // One venue page often covers two visits with the same words: print it once.
  const distinct = rules.filter((r, i) => rules.findIndex((x) => x.text === r.text) === i);
  if (distinct.length) return { kind: 'event-rule', label: `${venueName} bag rule for this event`, rules: distinct };
  const b = stop.bagPolicy;
  if (!b) return null;
  if (b.mode === 'rule') return { kind: 'operator-rule', label: `${venueName} bag policy for all events`, text: b.text, sourceUrl: b.sourceUrl, observedAt: b.observedAt };
  if (b.mode === 'other-event-rule') return { kind: 'other-event-rule', label: `${venueName} bag policy`, text: b.text, caveat: b.caveat, sourceUrl: b.sourceUrl, observedAt: b.observedAt };
  return { kind: 'pointer', label: 'Bag policy', text: `${venueName} sets its bag policy per event.`, sourceUrl: b.sourceUrl };
}
/** Whether the page prints a bag RULE (a pointer is not one). */
export const showsBagRule = (b: BagBlock | null): boolean => !!b && b.kind !== 'pointer';

// ── parking notes: what survives on an event day ────────────────────────────

const LEAGUE_WORDS = ['NFL', 'NBA', 'NHL', 'MLB', 'MLS', 'WNBA', 'NCAA'];
const GAME_WORDS_RE = /\b(?:games?|gamedays?|first pitch|kick[- ]?offs?|(?:pre|post)?-?seasons?|pre-?games?|post-?games?|tip-?offs?|puck drop|face-?offs?|final whistle|playoffs?|openers?|match(?:es)?|match ?days?|supporters?|tailgat\w*|football|baseball|basketball|hockey|soccer)\b/i;
/** Transit only (review 2026-11-18): a clock time, a fare claim, or a
 *  before-and-after service note belongs to the event it was written for. */
const CLOCK_WORDS_RE = /\b\d{1,2}:\d{2}\s?(?:a\.?m\.?|p\.?m\.?)?|\b\d{1,2}\s?(?:a\.?m\.?|p\.?m\.?)\b|\b(?:midnight|noon)\b/i;
const TRANSIT_WORDS_RE = /\b(?:pre-event|post-event|fares?|free(?!-)|complimentary|no charge|promo(?:tion)?s?|kids?|children)\b/i;
const CURRENCY_RE = /[$£€]\s?\d|\d\s?(?:dollars?|bucks)\b|\bUSD\b|\bdollars?\b|\b\d+\s+per\s+(?:car|vehicle|space|day)\b|\b\d+(?:\.\d{2})?\s+cash\b|\bcash only\b|\b(?:flat )?rates?\b|\bfree\b(?!-)|\bcomplimentary\b|\bno charge\b|\bprepaid\b/i;
/** Words that say a LOT is reserved or conditioned: a permit, a pass, a
 *  premium seat class, members, an overflow or complimentary lot, a lot sold
 *  per game. A lot whose note carries one is not general parking and is left
 *  off an event page. A note that merely mentions the home team or a game
 *  (a game-day rate, an opening time) loses that sentence and keeps the lot. */
const LOT_CONDITION_RE = /\b(?:permits?|pass(?:es)?|pass ?holders?|season ticket\w*|suites?|club|vip|members?|reserved|overflow|complimentary|individual-game)\b/i;

/** Sentences of a hub parking note. Splits on a full stop, question mark or
 *  exclamation mark followed by a space and a capital, so "St. Paul" and
 *  "4.5 by 6.5" stay whole in the common cases. */
export function splitSentences(text: string): string[] {
  const parts = String(text || '').replace(/\s+/g, ' ').trim().split(/(?<=[.!?])\s+(?=[A-Z0-9"(])/).map((x) => x.trim()).filter(Boolean);
  // A piece that ends in an abbreviation is not the end of a sentence: "U.S."
  // "Bank Stadium", "St." "Paul", "1 a.m." "Friday" are rejoined. Without
  // this a dropped clause could leave "The Blue Line stops at U.S." behind.
  const out: string[] = [];
  for (const piece of parts) {
    if (out.length && ABBREVIATION_END_RE.test(out[out.length - 1])) out[out.length - 1] += ` ${piece}`;
    else out.push(piece);
  }
  return out;
}
const ABBREVIATION_END_RE = /(?:^|[\s(])(?:U\.S|St|Ste|Ave|Blvd|Dr|Jr|Sr|Rd|Mt|Ft|Hwy|Pkwy|No|approx|a\.m|p\.m|[A-Z])\.$/;

/**
 * The sentences of a parking note that are safe on an event page. A sentence
 * is dropped when it carries a currency amount, a tenant or league name, or
 * the words game, first pitch, kickoff or season: the hub's notes were written
 * for the home team's game days, and a rate or a game-day rule may not hold
 * for a touring show. Returns '' when nothing survives (the lot name then
 * prints alone).
 */
export function eventSafeParkingNote(note: string | null | undefined, tenantNames: string[], ownNames: string[] = []): string {
  const nameRe = tenantNameRe(tenantNames);
  return splitSentences(note ?? '')
    .filter((x) => { const t = withoutOwnNames(x, ownNames); return !CURRENCY_RE.test(t) && !GAME_WORDS_RE.test(t) && !CLOCK_WORDS_RE.test(t) && !(nameRe && nameRe.test(t)); })
    .join(' ');
}
function tenantNameRe(tenantNames: string[]): RegExp | null {
  const names = [...LEAGUE_WORDS, ...tenantNames].map((n) => n.trim()).filter((n) => n.length >= 3);
  return names.length ? new RegExp(`\\b(?:${names.map((n) => n.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('|')})\\b`, 'i') : null;
}
/** The building's own name is not a tenant: "Nationals Park" and "Union
 *  Station Garage" are places. The names passed here are removed from a
 *  sentence before it is tested for a tenant word. */
function withoutOwnNames(text: string, ownNames: string[]): string {
  let out = text;
  for (const n of ownNames.map((x) => String(x || '').trim()).filter((x) => x.length >= 4).sort((a, b) => b.length - a.length)) out = out.split(new RegExp(n.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i')).join(' ');
  return out;
}

/**
 * ONE lot for an event page, or null when the lot must not be listed.
 * A lot is LEFT OFF when:
 *   - its name carries a price, a tenant, a game-day word or a reserved class;
 *   - any sentence of its note says it is reserved or conditioned (a permit, a
 *     pass, a suite or club, members, overflow, complimentary, per-game): that
 *     sentence was the only thing saying the lot is not general parking, so
 *     cutting it and keeping the name would list a Predators-only shuttle lot
 *     or a permit lot as parking for a touring show (review 2026-11-18);
 *   - it was stored with a note and nothing of the note survives the filter.
 * A lot stored with NO note prints its name alone.
 */
export function eventLot(lot: { name?: string | null; notes?: string | null }, tenantNames: string[], ownNames: string[] = []): { name: string; note: string } | null {
  const name = eventSafeLotName(lot.name, tenantNames, ownNames);
  if (!name) return null;
  const stored = String(lot.notes ?? '').trim();
  if (!stored) return { name, note: '' };
  if (splitSentences(stored).some((x) => LOT_CONDITION_RE.test(withoutOwnNames(x, ownNames)))) return null;
  const note = eventSafeParkingNote(stored, tenantNames, ownNames);
  return note ? { name, note } : null;
}
/** A lot NAME that carries a price, a tenant, a game-day word or a reserved class is not printed at all. */
export function eventSafeLotName(name: string | null | undefined, tenantNames: string[], ownNames: string[] = []): string {
  const n = String(name ?? '').trim();
  const t = withoutOwnNames(n, ownNames);
  const nameRe = tenantNameRe(tenantNames);
  return n && !CURRENCY_RE.test(t) && !GAME_WORDS_RE.test(t) && !LOT_CONDITION_RE.test(t) && !(nameRe && nameRe.test(t)) ? n : '';
}
/**
 * The hub's transit note, cut for an event page: the parking rule plus the
 * transit words. A hub note written around a home game can carry that game's
 * trolley times, a fare offer or a match-day frequency (Snapdragon Stadium,
 * review 2026-11-18); none of that holds for a touring show.
 */
export function eventSafeTransitNote(note: string | null | undefined, tenantNames: string[], ownNames: string[] = []): string {
  const nameRe = tenantNameRe(tenantNames);
  return splitSentences(note ?? '')
    .filter((x) => { const t = withoutOwnNames(x, ownNames); return !CURRENCY_RE.test(t) && !GAME_WORDS_RE.test(t) && !CLOCK_WORDS_RE.test(t) && !TRANSIT_WORDS_RE.test(t) && !(nameRe && nameRe.test(t)); })
    .join(' ');
}
/** A transit LINE name is kept unless it carries a price, a game-day word or a tenant. */
export function eventSafeTransitLines(lines: unknown, tenantNames: string[], ownNames: string[] = []): string[] {
  const nameRe = tenantNameRe(tenantNames);
  return (Array.isArray(lines) ? lines : []).filter((l): l is string => typeof l === 'string' && !!l.trim()).map((l) => l.trim())
    .filter((l) => { const t = withoutOwnNames(l, ownNames); return !CURRENCY_RE.test(t) && !GAME_WORDS_RE.test(t) && !(nameRe && nameRe.test(t)); });
}
export function tenantNameWords(names: string[], _placeWords: string[] = []): string[] {
  // The full name, and the nickname (its last word) when the nickname is not
  // an ordinary word. "Minnesota Vikings" gives "Vikings"; "Chicago Fire",
  // "Philadelphia Union" and "Minnesota United FC" give only their full names,
  // or "Do not park in fire lanes." and "Union Station" would be silenced.
  // Place words ("New York", "Los Angeles", "San Francisco") are never added:
  // a team named for another city would otherwise silence every sentence
  // naming that city (review 2026-11-18).
  const out = new Set<string>();
  for (const n of names) {
    const clean = String(n || '').trim();
    if (!clean) continue;
    out.add(clean);
    const last = clean.split(/\s+/).pop() ?? '';
    if (last.length >= 3 && !ORDINARY_NICKNAMES.has(last.toLowerCase())) out.add(last);
  }
  return [...out];
}
const ORDINARY_NICKNAMES = new Set(['fc', 'sc', 'cf', 'city', 'united', 'club', 'real', 'sporting', 'union', 'fire', 'wild', 'heat', 'magic', 'jazz', 'stars', 'kings', 'bills', 'thunder', 'sun', 'sky', 'storm', 'wings', 'blues', 'liberty', 'dream', 'fever', 'mercury', 'lightning', 'rapids', 'revolution', 'galaxy', 'dynamo', 'spirit', 'current', 'pride', 'wave', 'reign', 'courage', 'gotham', 'giants', 'nationals', 'rangers', 'saints', 'chiefs', 'jets', 'bears', 'lions', 'reds', 'twins', 'angels', 'kraken', 'state', 'bay']);

// ── head ────────────────────────────────────────────────────────────────────

export const EVENT_CARD_WIDTH = 1200;
export const EVENT_CARD_HEIGHT = 630;

/** The generated text card: /api/event-card/{show}~{venue}?v={stamp}. */
export function eventCardPath(stop: Pick<EventStop, 'show' | 'venueSlug' | 'updatedAt'>): string {
  const stamp = stop.updatedAt && Number.isFinite(Date.parse(stop.updatedAt)) ? String(Date.parse(stop.updatedAt)) : '0';
  return `/api/event-card/${stop.show}~${stop.venueSlug}?v=${stamp}`;
}

/** The year a stop's title carries: the year of the last upcoming
 *  performance; with none upcoming, of the last stored one; else null. */
export function stopYear(stop: Pick<EventStop, 'performances'>, tl: StopTimeline): number | null {
  const up = upcomingPerformances(tl);
  const rows = up.length ? up : stop.performances;
  if (!rows.length) return null;
  return Number([...rows].sort((a, b) => a.key.localeCompare(b.key))[rows.length - 1].date.slice(0, 4));
}

export function stopH1(showName: string, searchCity: string, venueName: string): string {
  return `${showName} ${searchCity} at ${venueName}`;
}

/** Bare title; the root layout appends " | PromoNight". "and Bag Policy" is
 *  dropped when the page prints no bag rule. */
export function stopTitle(showName: string, searchCity: string, year: number | null, bagRule: boolean): string {
  const head = `${showName} ${searchCity}${year ? ` ${year}` : ''}`;
  return bagRule ? `${head}: Dates, Tickets and Bag Policy` : `${head}: Dates and Tickets`;
}

export function hubTitle(showName: string, year: number | null): string {
  return `${showName}${year ? ` ${year}` : ''}: Dates, Tickets and Venue Guides`;
}

export function stopDescription(o: { showName: string; searchCity: string; venueName: string; dates: string[]; visitCount?: number; bagRule: boolean; parking: boolean; transit: boolean; pitParty: boolean }): string {
  // Nothing upcoming: say so, and promise nothing.
  if (!o.dates.length) return `${o.showName} at ${o.venueName} in ${o.searchCity}. No upcoming dates are listed right now.`;
  const when = (o.visitCount ?? 1) > 1 ? `${o.showName} has ${showsPhrase(o.dates, o.visitCount ?? 1)} at ${o.venueName} in ${o.searchCity}.` : `${o.showName} is at ${o.venueName} in ${o.searchCity} on ${formatDatesLine(o.dates)}.`;
  const has = [o.bagRule ? 'the bag policy' : null, o.parking ? 'parking' : null, o.transit ? 'transit' : null, o.pitParty ? 'Pit Party times' : null].filter(Boolean) as string[];
  const list = has.length > 1 ? `${has.slice(0, -1).join(', ')} and ${has[has.length - 1]}` : has[0];
  return `${when} Showtimes and tickets${list ? `, plus ${list}` : ''}.`;
}

// ── JSON-LD ─────────────────────────────────────────────────────────────────

export interface EventJsonLdVenue { name: string; city: string | null; state: string | null; lat: number | null; lng: number | null }

/**
 * One Event per upcoming performance: startDate with its offset, the
 * building, the status, and an offer with a url and availability. No price.
 *
 * THE OFFER URL IS THE STOP PAGE (ruling 2026-11-18, Phase 2B). No affiliate
 * or tracking URL appears anywhere in structured data: the ticket link lives
 * on the page's button, and the page is where the offer is presented. The
 * offer is emitted only for a status the source printed (on sale or sold
 * out); a performance whose status nobody read carries no offer.
 */
export function performanceJsonLd(o: { showName: string; stopUrl: string; imageUrl: string; venue: EventJsonLdVenue; performance: EventPerformance; hasTicketLink: boolean }): Record<string, unknown> {
  const p = o.performance;
  // On sale is claimed only where the page really has a ticket button for the
  // show (a boolean, never the link itself); sold out is the stored status.
  const offer = (p.status === 'onsale' && o.hasTicketLink) || p.status === 'soldout'
    ? { offers: { '@type': 'Offer', url: o.stopUrl, availability: p.status === 'soldout' ? 'https://schema.org/SoldOut' : 'https://schema.org/InStock' } }
    : {};
  return {
    '@context': 'https://schema.org',
    '@type': 'Event',
    name: `${o.showName} at ${o.venue.name}`,
    startDate: p.startsAt,
    eventStatus: 'https://schema.org/EventScheduled',
    eventAttendanceMode: 'https://schema.org/OfflineEventAttendanceMode',
    url: o.stopUrl,
    image: [o.imageUrl],
    location: {
      '@type': 'Place',
      name: o.venue.name,
      address: { '@type': 'PostalAddress', ...(o.venue.city ? { addressLocality: o.venue.city } : {}), ...(o.venue.state ? { addressRegion: o.venue.state } : {}), addressCountry: 'US' },
      ...(o.venue.lat !== null && o.venue.lng !== null ? { geo: { '@type': 'GeoCoordinates', latitude: o.venue.lat, longitude: o.venue.lng } } : {}),
    },
    ...offer,
  };
}

export function breadcrumbJsonLd(items: Array<{ name: string; path: string }>): Record<string, unknown> {
  return {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: items.map((it, i) => ({ '@type': 'ListItem', position: i + 1, name: it.name, item: `${EVENTS_SITE_URL}${it.path}` })),
  };
}

// ── FAQs: stored fields only ────────────────────────────────────────────────

export interface EventFaq { q: string; a: string }

/** Questions the page can answer from what is stored. Nothing about run time,
 *  noise, ages or strollers: none of that is stored. */
export function stopFaqs(o: { showName: string; searchCity: string; venueName: string; upcoming: EventPerformance[]; bag: BagBlock | null; bagScope?: string; pitParty: EventPitParty[]; gateTimes: EventGateTime[] }): EventFaq[] {
  const out: EventFaq[] = [];
  const perfLine = (p: EventPerformance) => `${formatLongDay(p.date)} at ${formatClock(p.startTime)}`;
  if (o.upcoming.length) {
    const visitCount = new Set(o.upcoming.map((p) => p.visitId)).size;
    // A long run is summarised: eight dates in one sentence answer nothing.
    if (o.upcoming.length > 4) out.push({ q: `When is ${o.showName} in ${o.searchCity}?`, a: `${o.showName} has ${showsPhrase(o.upcoming.map((p) => p.date), Math.max(visitCount, 2))} at ${o.venueName}. Every showtime is listed at the top of this page. Times are local to the venue.` });
    const list = o.upcoming.length > 4 ? [] : o.upcoming.map(perfLine);
    const joined = list.length === 2 ? `${list[0]} and ${list[1]}` : list.length > 2 ? `${list.slice(0, -1).join('; ')}; and ${list[list.length - 1]}` : list[0];
    if (list.length) out.push({ q: `When is ${o.showName} in ${o.searchCity}?`, a: `${joined}, at ${o.venueName}. Times are local to the venue.` });
  }
  if (o.bag && o.bag.kind === 'event-rule') out.push({ q: `What is the bag policy for ${o.showName} at ${o.venueName}?`, a: [o.bag.rules.map((r) => r.text).join(' '), o.bagScope].filter(Boolean).join(' ') });
  else if (o.bag && o.bag.kind === 'operator-rule') out.push({ q: `What is the bag policy at ${o.venueName}?`, a: o.bag.text });
  else if (o.bag && o.bag.kind === 'other-event-rule') out.push({ q: `What is the bag policy at ${o.venueName}?`, a: `${o.bag.text} ${o.bag.caveat}` });
  const upKeys = new Set(o.upcoming.map((p) => p.key));
  const pits = o.pitParty.filter((p) => upKeys.has(p.performance));
  if (pits.length) {
    const lines = pits.map((p) => { const perf = o.upcoming.find((x) => x.key === p.performance)!; return `${formatShortDay(perf.date)} (${formatClock(perf.startTime)} show): ${formatClock(p.start)} to ${formatClock(p.end)}`; });
    out.push({ q: `When is the Pit Party at ${o.venueName}?`, a: `${o.venueName} lists these Pit Party times. ${lines.join('. ')}. The Pit Party needs its own pass, which is not sold through the ticket buttons on this page.` });
  }
  const gates = o.gateTimes.filter((g) => upKeys.has(g.performance));
  if (gates.length) {
    const lines = gates.map((g) => { const perf = o.upcoming.find((x) => x.key === g.performance)!; return `${formatShortDay(perf.date)} (${formatClock(perf.startTime)} show): gates open at ${formatClock(g.opensAt)}`; });
    out.push({ q: `What time do gates open for ${o.showName} at ${o.venueName}?`, a: `${o.venueName} lists these gate times. ${lines.join('. ')}.` });
  }
  return out;
}

/** "5:00 PM show" row sub-label: the day part, from the clock alone. */
export function showLabel(p: Pick<EventPerformance, 'date' | 'startTime'>): string {
  const h = Number(p.startTime.slice(0, 2));
  const part = h < 12 ? 'morning' : h < 17 ? 'afternoon' : 'evening';
  return `${WEEKDAYS_LONG[ymdParts(p.date).dow]} ${part} show`;
}

/** What a row with no link says. "Sold out" only for the stored sold-out
 *  status; a row whose status or event id is simply missing claims nothing
 *  about the sale. */
export const STATUS_LABEL: Record<EventPerformanceStatus, string> = { onsale: 'No link yet', soldout: 'Sold out', unknown: 'No link yet' };
export const STARTED_LABEL = 'Started';
