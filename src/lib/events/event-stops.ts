// Event tour-stop pages (Phase 2, 2026-11-18): the SERVER half.
//
// READS. eventStops (one collection read) and its two subcollections (one
// collection-group read each, path-guarded to eventStops/), held for five
// minutes per server instance like the other static collections. The venue
// hub is the page's own getVenueHub read, which is already the web's
// published view (src/lib/venue-published-view.ts).
//
// THE MAPPER IS THE GATE (CLAUDE.md: anything on a doc that reaches a client
// component is published). mapEventStop copies named fields only. Quotes,
// contexts, provider read times, the catalog source id and every key this
// file does not name stay on the server. A value that is not the shape the
// pipeline's write guard allows is dropped, not passed through.
//
// THE FLOOR. A stop renders only when its hub is verified, indexable and
// shows a sourced bag claim plus a sourced parking or transit claim under the
// web's own predicates with the pointer links removed (a pointer link never
// counts; ruling 2026-11-17). The pipeline applied the same floor before it
// wrote the stop; it is applied again here because a hub can change after.
import 'server-only';
import { cache } from 'react';
import { db } from '../firebase';
import { makeCollectionLoader } from '../collection-cache';
import { displayVenueName, getVenueHub, rendersTransit, venueHubIsIndexable, type VenueHub } from '../venue-hub';
import { rendersBag, rendersParking } from '../venue-field-exclusions';
import {
  EVENT_SHOWS,
  EVENTS_INDEX_PATH,
  EVENT_YMD_RE,
  eventHubPath,
  eventShowOf,
  eventStopPath,
  isEventSlug,
  stopTimeline,
  type EventBagPolicy,
  type EventGateTime,
  type EventPerformance,
  type EventPerformanceStatus,
  type EventPitParty,
  type EventRuleFact,
  type EventShowSlug,
  type EventStop,
  type EventVisit,
  type HubVenueFact,
} from './event-pages';

type Doc = Record<string, unknown>;
const isObj = (v: unknown): v is Doc => !!v && typeof v === 'object' && !Array.isArray(v);
const str = (v: unknown): string | null => (typeof v === 'string' && v.trim() ? v.trim() : null);
const HHMM_RE = /^(?:[01]\d|2[0-3]):[0-5]\d$/;
const PERF_KEY_RE = /^\d{4}-\d{2}-\d{2}T\d{4}$/;
const START_RE = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}[+-]\d{2}:\d{2}$/;
/** Nothing from the tour operator's sites is stored or linked (ruling
 *  2026-11-17). The pipeline refuses it at write; refused again at read. */
const OPERATOR_HOST_RE = /monsterjam[a-z0-9-]*(?:\.|%2e)[a-z]{2,}|(?<![a-z0-9])feld[a-z0-9-]*(?:\.|%2e)[a-z]{2,}/i;
const httpsUrl = (v: unknown): string | null => {
  const s = str(v);
  return s && /^https:\/\/[^\s"<>]+$/.test(s) && !OPERATOR_HOST_RE.test(s) ? s : null;
};
const cleanText = (v: unknown): string | null => {
  const s = str(v);
  return s && !OPERATOR_HOST_RE.test(s) ? s : null;
};
const isoOf = (v: unknown): string | null => {
  if (typeof v === 'string' && Number.isFinite(Date.parse(v))) return new Date(Date.parse(v)).toISOString();
  if (isObj(v) && typeof (v as { toDate?: unknown }).toDate === 'function') return ((v as { toDate: () => Date }).toDate()).toISOString();
  return null;
};

function mapBagPolicy(v: unknown): EventBagPolicy | null {
  if (!isObj(v)) return null;
  const sourceUrl = httpsUrl(v.sourceUrl);
  if (!sourceUrl) return null;
  if (v.mode === 'pointer') return { mode: 'pointer', sourceUrl };
  const text = isObj(v.rule) ? cleanText(v.rule.text) : null;
  const observedAt = isoOf(v.observedAt);
  // A rule with no verbatim quote behind it is not a rule (the pipeline's
  // guard); the quote itself stays on the server. It degrades to the pointer.
  if (!text || !observedAt || !str(v.quote)) return { mode: 'pointer', sourceUrl };
  if (v.mode === 'rule') return { mode: 'rule', text, sourceUrl, observedAt };
  const caveat = cleanText(v.caveat);
  if (v.mode === 'other-event-rule' && caveat) return { mode: 'other-event-rule', text, caveat, sourceUrl, observedAt };
  return { mode: 'pointer', sourceUrl };
}

function factBase(f: unknown): { visitId: string; sourceUrl: string; observedAt: string } | null {
  if (!isObj(f) || !str(f.quote)) return null;
  const visitId = str(f.visitId);
  const sourceUrl = httpsUrl(f.sourceUrl);
  const observedAt = isoOf(f.observedAt);
  return visitId && EVENT_YMD_RE.test(visitId) && sourceUrl && observedAt ? { visitId, sourceUrl, observedAt } : null;
}
const list = (v: unknown): unknown[] => (Array.isArray(v) ? v : []);

function mapRules(v: unknown): EventRuleFact[] {
  return list(v).flatMap((f) => {
    const b = factBase(f);
    const text = isObj(f) ? cleanText(f.text) : null;
    return b && text ? [{ ...b, text }] : [];
  });
}
function mapPitParty(v: unknown): EventPitParty[] {
  return list(v).flatMap((f) => {
    const b = factBase(f);
    if (!b || !isObj(f)) return [];
    const performance = str(f.performance); const start = str(f.start); const end = str(f.end);
    return performance && PERF_KEY_RE.test(performance) && start && end && HHMM_RE.test(start) && HHMM_RE.test(end) && start < end ? [{ ...b, performance, start, end }] : [];
  });
}
function mapGateTimes(v: unknown): EventGateTime[] {
  return list(v).flatMap((f) => {
    const b = factBase(f);
    if (!b || !isObj(f)) return [];
    const performance = str(f.performance); const opensAt = str(f['time']);
    return performance && PERF_KEY_RE.test(performance) && opensAt && HHMM_RE.test(opensAt) ? [{ ...b, performance, opensAt }] : [];
  });
}

export function mapEventVisit(id: string, d: Doc): EventVisit | null {
  const startDate = str(d.startDate); const endDate = str(d.endDate);
  if (!EVENT_YMD_RE.test(id) || !startDate || !endDate || !EVENT_YMD_RE.test(startDate) || !EVENT_YMD_RE.test(endDate) || d.tombstoned === true) return null;
  return { visitId: id, startDate, endDate };
}

export function mapEventPerformance(id: string, d: Doc): EventPerformance | null {
  if (d.tombstoned === true || !PERF_KEY_RE.test(id)) return null;
  const date = str(d.date); const startTime = str(d.startTime); const startsAt = str(d.startsAt); const visitId = str(d.visitId);
  if (!date || !startTime || !startsAt || !visitId) return null;
  if (!EVENT_YMD_RE.test(date) || !HHMM_RE.test(startTime) || !START_RE.test(startsAt) || !EVENT_YMD_RE.test(visitId)) return null;
  // The row restates itself three ways; a row that disagrees with its own id is not shown.
  if (id !== `${date}T${startTime.replace(':', '')}` || !startsAt.startsWith(`${date}T${startTime}:00`)) return null;
  const tn = isObj(d.providerEvents) && isObj(d.providerEvents.ticketnetwork) ? d.providerEvents.ticketnetwork : null;
  const eventId = tn && typeof tn.eventId === 'number' && Number.isSafeInteger(tn.eventId) && tn.eventId > 0 && tn.eventDate === date ? tn.eventId : null;
  const status: EventPerformanceStatus = tn && (tn.status === 'onsale' || tn.status === 'soldout') ? tn.status : 'unknown';
  return { key: id, date, startTime, startsAt, visitId, status, tnEventId: eventId };
}

/** The stop as a page may see it, or null for a doc that is not a stop of a known show. */
export function mapEventStop(id: string, d: Doc, visits: Array<{ id: string; data: Doc }>, performances: Array<{ id: string; data: Doc }>): EventStop | null {
  const show = str(d.show); const hubId = str(d.venueHubId); const venueSlug = str(d.pageSlug);
  if (!show || !eventShowOf(show) || !hubId || !venueSlug || !isEventSlug(hubId) || !isEventSlug(venueSlug) || id !== `${show}~${hubId}`) return null;
  const searchCity = str(d.searchCity); const timezone = str(d.timezone);
  if (!searchCity || !timezone) return null;
  const ep = isObj(d.eventPolicies) ? d.eventPolicies : {};
  const stamps = [d.updatedAt, ...visits.map((v) => v.data.updatedAt), ...performances.map((p) => p.data.updatedAt)].map(isoOf).filter((x): x is string => !!x).sort();
  return {
    show: show as EventShowSlug,
    venueSlug,
    hubId,
    previousSlugs: list(d.previousSlugs).filter(isEventSlug),
    searchCity,
    timezone,
    tombstoned: d.tombstoned === true,
    bagPolicy: mapBagPolicy(d.bagPolicy),
    bagRules: mapRules(ep.bagRule),
    pitParty: mapPitParty(ep.pitParty),
    gateTimes: mapGateTimes(ep.doorsTime),
    reEntry: mapRules(ep.reEntry),
    // The slot for event-day parking facts. The pipeline writes no such key yet, so this is always [].
    parkingFacts: mapRules(ep.parking),
    // Hub question facts (Phase 5A). childTicket is a stored slot no stop fills today; runTime is not written yet.
    childTicket: mapRules(ep.childTicket),
    runTime: mapRules(ep.runTime),
    visits: visits.flatMap((v) => { const m = mapEventVisit(v.id, v.data); return m ? [m] : []; }).sort((a, b) => a.visitId.localeCompare(b.visitId)),
    performances: performances.flatMap((p) => { const m = mapEventPerformance(p.id, p.data); return m ? [m] : []; }).sort((a, b) => a.key.localeCompare(b.key)),
    updatedAt: stamps.length ? stamps[stamps.length - 1] : null,
  };
}

/** Every stop, mapped. One collection read and two collection-group reads. */
export const loadEventStops = makeCollectionLoader<EventStop[]>(async () => {
  const [stops, visits, perfs] = await Promise.all([
    db.collection('eventStops').get(),
    db.collectionGroup('visits').get(),
    db.collectionGroup('performances').get(),
  ]);
  // THE PATH GUARD: a `visits` or `performances` subcollection anywhere else
  // in Firestore must not reach a stop.
  const childrenOf = (snap: FirebaseFirestore.QuerySnapshot, name: string) => {
    const by = new Map<string, Array<{ id: string; data: Doc }>>();
    for (const doc of snap.docs) {
      const parts = doc.ref.path.split('/');
      if (parts.length !== 4 || parts[0] !== 'eventStops' || parts[2] !== name) continue;
      by.set(parts[1], [...(by.get(parts[1]) ?? []), { id: doc.id, data: doc.data() }]);
    }
    return by;
  };
  const v = childrenOf(visits, 'visits');
  const p = childrenOf(perfs, 'performances');
  return stops.docs.flatMap((doc) => { const m = mapEventStop(doc.id, doc.data(), v.get(doc.id) ?? [], p.get(doc.id) ?? []); return m ? [m] : []; });
});

// ── the floor ───────────────────────────────────────────────────────────────

export interface EventFloor { ok: boolean; bag: boolean; parking: boolean; transit: boolean }

/** The stop floor on the web's published view of the hub. */
export function eventFloorOf(hub: VenueHub | null): EventFloor {
  if (!hub) return { ok: false, bag: false, parking: false, transit: false };
  // The same doc with every pointer link removed: what still renders is a sourced claim.
  const claim = { ...hub, bagPolicyUrl: null, officialParkingUrls: [], parkingLotMapUrl: null };
  const bag = rendersBag(claim) === true;
  const parking = rendersParking(claim) === true;
  const transit = rendersTransit(claim) === true;
  return { ok: hub.verified === true && venueHubIsIndexable(hub) && bag && (parking || transit), bag, parking, transit };
}

export interface EventStopPage { stop: EventStop; hub: VenueHub; floor: EventFloor }

/** Every stop of a show whose hub clears the floor, with its hub. Tombstoned stops included (the page decides). */
export const getEventStopPages = cache(async (show: string): Promise<EventStopPage[]> => {
  if (!eventShowOf(show)) return [];
  const stops = (await loadEventStops()).filter((s) => s.show === show);
  // In parallel: one hub read per stop (review 2026-11-18, finding 4).
  const hubs = await Promise.all(stops.map((stop) => getVenueHub(stop.hubId)));
  const out: EventStopPage[] = [];
  stops.forEach((stop, i) => {
    const hub = hubs[i];
    const floor = eventFloorOf(hub);
    if (hub && floor.ok) out.push({ stop, hub, floor });
  });
  return out.sort((a, b) => a.stop.venueSlug.localeCompare(b.stop.venueSlug));
});

/** The stop page for a slug, the current slug an old one redirects to, or null. */
export const resolveEventStop = cache(async (show: string, venue: string): Promise<{ kind: 'page'; page: EventStopPage } | { kind: 'redirect'; to: string } | null> => {
  if (!eventShowOf(show) || !isEventSlug(venue)) return null;
  const pages = await getEventStopPages(show);
  const page = pages.find((p) => p.stop.venueSlug === venue);
  if (page) return { kind: 'page', page };
  const moved = pages.find((p) => p.stop.previousSlugs.includes(venue));
  return moved ? { kind: 'redirect', to: moved.stop.venueSlug } : null;
});

// ── lists ───────────────────────────────────────────────────────────────────

export interface EventStopSummary {
  show: EventShowSlug;
  venueSlug: string;
  hubId: string;
  venueName: string;
  searchCity: string;
  /** The hub's state, for "City, State" on the show hub (as the hub stores it); null when the hub has none. */
  state: string | null;
  /** The next upcoming performance's date, and the last one's. */
  nextDate: string;
  lastDate: string;
  upcomingCount: number;
  /** The first upcoming date of each upcoming visit, oldest first. */
  visitStarts: string[];
  /** Each upcoming visit: its first and last upcoming date and its show count, oldest first. */
  visits: Array<{ start: string; end: string; shows: number }>;
  updatedAt: string | null;
}

function summaryOf(stop: EventStop, venueName: string, state: string | null, now: Date): EventStopSummary[] {
  if (stop.tombstoned) return [];
  const groups = stopTimeline(stop, now).upcoming;
  const up = groups.flatMap((g) => g.performances);
  if (!up.length) return [];
  return [{ show: stop.show, venueSlug: stop.venueSlug, hubId: stop.hubId, venueName, searchCity: stop.searchCity, state, nextDate: up[0].date, lastDate: up[up.length - 1].date, upcomingCount: up.length, visitStarts: groups.map((g) => g.performances[0].date), visits: groups.map((g) => ({ start: g.performances[0].date, end: g.performances[g.performances.length - 1].date, shows: g.performances.length })), updatedAt: stop.updatedAt }];
}

/** Stops with at least one upcoming performance, soonest first. Tombstoned stops never list. */
export async function getUpcomingStopSummaries(show: string, now: Date): Promise<EventStopSummary[]> {
  const pages = await getEventStopPages(show);
  return pages.flatMap(({ stop, hub }) => summaryOf(stop, hub.name, hub.state, now)).sort((a, b) => a.nextDate.localeCompare(b.nextDate) || a.venueSlug.localeCompare(b.venueSlug));
}

/**
 * Stored venue facts behind the show hub's run-time and kids questions: one
 * line per venue and text, for visits that still have an upcoming show. Empty
 * lists mean the question is not rendered.
 */
export async function getHubQuestionFacts(show: string, now: Date): Promise<{ runTime: HubVenueFact[]; kids: HubVenueFact[] }> {
  const pages = await getEventStopPages(show);
  return hubQuestionFactsOf(pages, now);
}
export function hubQuestionFactsOf(pages: Array<{ stop: EventStop; hub: { name: string } }>, now: Date): { runTime: HubVenueFact[]; kids: HubVenueFact[] } {
  const pick = (key: 'runTime' | 'childTicket'): HubVenueFact[] => {
    const out = new Map<string, HubVenueFact>();
    for (const { stop, hub } of pages) {
      if (stop.tombstoned) continue;
      // A stored, live visit with an upcoming show: stopTimeline synthesizes a visit for
      // performances whose visit doc is missing or tombstoned, so the stored list is checked too (review 2026-11-19).
      const stored = new Set(stop.visits.map((v) => v.visitId));
      const live = new Set(stopTimeline(stop, now).upcoming.map((g) => g.visit.visitId).filter((id) => stored.has(id)));
      const venueName = displayVenueName(hub.name);
      for (const f of stop[key]) if (live.has(f.visitId)) out.set(`${venueName}|${f.text}`, { venueName, text: f.text, sourceUrl: f.sourceUrl });
    }
    return [...out.values()].sort((a, b) => a.venueName.localeCompare(b.venueName));
  };
  return { runTime: pick('runTime'), kids: pick('childTicket') };
}

/**
 * Upcoming stops at ONE building, across every show (the venue page module
 * and the team page link). The stops are filtered to the building BEFORE any
 * hub is read, so a venue or team page reads one hub (its own, already
 * request-cached), not every stop's (review 2026-11-18, finding 4).
 */
export async function getUpcomingStopsAtHub(hubId: string, now: Date): Promise<EventStopSummary[]> {
  const stops = (await loadEventStops()).filter((x) => x.hubId === hubId && !!eventShowOf(x.show));
  if (!stops.length) return [];
  const hub = await getVenueHub(hubId);
  if (!hub || !eventFloorOf(hub).ok) return [];
  return stops.flatMap((x) => summaryOf(x, hub.name, hub.state, now)).sort((a, b) => a.nextDate.localeCompare(b.nextDate));
}

/** Sitemap entries: every indexable /events URL. Empty while the flag is off (the caller checks). */
export async function getEventSitemapEntries(now: Date): Promise<Array<{ path: string; lastModified?: string }>> {
  const out: Array<{ path: string; lastModified?: string }> = [];
  let newest: string | null = null;
  for (const show of Object.keys(EVENT_SHOWS)) {
    const stops = await getUpcomingStopSummaries(show, now);
    if (!stops.length) continue;
    const showNewest = stops.map((s) => s.updatedAt).filter((x): x is string => !!x).sort().pop() ?? null;
    if (showNewest && (!newest || showNewest > newest)) newest = showNewest;
    out.push({ path: eventHubPath(show), ...(showNewest ? { lastModified: showNewest } : {}) });
    for (const s of stops) out.push({ path: eventStopPath(show, s.venueSlug), ...(s.updatedAt ? { lastModified: s.updatedAt } : {}) });
  }
  if (out.length) out.unshift({ path: EVENTS_INDEX_PATH, ...(newest ? { lastModified: newest } : {}) });
  return out;
}
