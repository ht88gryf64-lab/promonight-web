// Event tour-stop pages (Phase 2, 2026-11-18): the pure half, each rule driven
// by the input that would break it.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
import {
  EVENTS_ACCENT,
  EVENT_HERO,
  EVENT_LINK_SURFACES,
  EVENT_OUT_SURFACES,
  bagBlockFor,
  countdownAt,
  countdownLabel,
  firstUpcomingDate,
  daysUntil,
  eventCardPath,
  eventPageHref,
  eventsPageIdentity,
  formatClock,
  formatDatesLine,
  formatRange,
  cityPillLabels,
  hubDescription,
  hubFaqs,
  bagQuoteSaysPerEvent,
  pitPassLine,
  pitPassStated,
  timelineSourceLines,
  HUB_KIDS_LEAD,
  hubH1,
  hubScopeLine,
  hubTitle,
  monthVisitLine,
  isEventsPagesLive,
  performanceJsonLd,
  showTimeline,
  showsBagRule,
  showsPhrase,
  stopDescription,
  stopFaqs,
  stopH1,
  stopTimeline,
  stopTitle,
  stopYear,
  runYearLabel,
  hubYear,
  upcomingPerformances,
  weekdayLong,
  type EventPerformance,
  type EventStop,
} from '../event-pages';
import { buildEventTicketLink, eventSubId, eventTicketVendor, TN_SUBID_RE } from '../../affiliates';
import { inferSurfaceFromPath, KNOWN_SURFACE_VALUES } from '../../analytics';
import { isRevalidatePath } from '../../revalidate-paths';
import { ymdInZone } from '../../promo-date-tile';

const perf = (key: string, offset = '-06:00', over: Partial<EventPerformance> = {}): EventPerformance => {
  const date = key.slice(0, 10); const startTime = `${key.slice(11, 13)}:${key.slice(13, 15)}`;
  return { key, date, startTime, startsAt: `${date}T${startTime}:00${offset}`, visitId: '2027-02-20', status: 'onsale', tnEventId: 8258515, ...over };
};
const STOP: Pick<EventStop, 'visits' | 'performances'> = {
  visits: [{ visitId: '2027-02-20', startDate: '2027-02-20', endDate: '2027-02-21' }],
  performances: [perf('2027-02-20T1700'), perf('2027-02-21T1500', '-06:00', { tnEventId: 8258516 })],
};
const at = (iso: string) => new Date(iso);

test('the flag: only the literal "true" turns the family on', () => {
  for (const v of [undefined, '', 'false', '1', 'yes', 'TRUE ']) assert.equal(isEventsPagesLive({ EVENTS_PAGES_LIVE: v } as unknown as NodeJS.ProcessEnv), v === 'TRUE ');
  assert.equal(isEventsPagesLive({ EVENTS_PAGES_LIVE: 'true' } as unknown as NodeJS.ProcessEnv), true);
  assert.equal(isEventsPagesLive({ PROMO_PAGES_LIVE: 'true' } as unknown as NodeJS.ProcessEnv), false);
});

test('eventPageHref: null with the flag off, for an unknown show, a bad slug or an unknown surface', () => {
  assert.deepEqual(eventPageHref({ kind: 'stop', show: 'monster-jam', venue: 'us-bank-stadium' }, 'venue_events_module', true), { href: '/events/monster-jam/us-bank-stadium', surface: 'venue_events_module', show: 'monster-jam', venueSlug: 'us-bank-stadium' });
  assert.deepEqual(eventPageHref({ kind: 'hub', show: 'monster-jam' }, 'events_hub_list', true)?.href, '/events/monster-jam');
  assert.deepEqual(eventPageHref({ kind: 'index' }, 'footer_events', true)?.href, '/events');
  // The known-bad inputs.
  assert.equal(eventPageHref({ kind: 'index' }, 'footer_events', false), null);
  assert.equal(eventPageHref({ kind: 'stop', show: 'monster-jam', venue: 'us-bank-stadium' }, 'team_also_at', false), null);
  assert.equal(eventPageHref({ kind: 'hub', show: 'disney-on-ice' }, 'events_hub_list', true), null);
  assert.equal(eventPageHref({ kind: 'hub', show: 'constructor' }, 'events_hub_list', true), null);
  assert.equal(eventPageHref({ kind: 'stop', show: 'monster-jam', venue: '../venues/x' }, 'events_hub_list', true), null);
  assert.equal(eventPageHref({ kind: 'stop', show: 'monster-jam', venue: 'US Bank' }, 'events_hub_list', true), null);
  assert.equal(eventPageHref({ kind: 'index' }, 'event_to_venue' as never, true), null);
});

// ── every link into /events goes through the one helper ─────────────────────
const SRC = join(__dirname, '..', '..', '..');
function sources(dir: string, acc: string[] = []): string[] {
  for (const e of readdirSync(dir)) {
    const p = join(dir, e);
    if (statSync(p).isDirectory()) { if (e !== '__tests__' && e !== 'node_modules') sources(p, acc); } else if (/\.(ts|tsx)$/.test(e)) acc.push(p);
  }
  return acc;
}
test('every surface uses the helper: no file builds an /events href by hand, and each inbound surface is named at an eventPageHref call', () => {
  const files = sources(SRC);
  // The only places allowed to spell the path: the helper's own module (and
  // the analytics path inference, which reads a path, it does not link one).
  const allowed = new Set(['lib/events/event-pages.ts', 'lib/analytics.ts']);
  const offenders: string[] = [];
  const named = new Map<string, string[]>();
  for (const f of files) {
    const rel = relative(SRC, f);
    const text = readFileSync(f, 'utf8');
    // A string or template literal that starts an /events path.
    if (!allowed.has(rel) && /['"`]\/events(?:\/|['"`$])/.test(text.replace(/^\s*\/\/.*$/gm, '').replace(/\/\*[\s\S]*?\*\//g, ''))) offenders.push(rel);
    for (const m of text.matchAll(/eventPageHref\(\s*\{[^}]*\}\s*,\s*'([a-z_]+)'/g)) named.set(m[1], [...(named.get(m[1]) ?? []), rel]);
  }
  assert.deepEqual(offenders, [], 'a hand-built /events href: use eventPageHref (src/lib/events/event-pages.ts)');
  // The flag-blind path builders are for the family's own pages (canonicals,
  // JSON-LD, the sitemap). A surface outside the family that used one would
  // link in without the helper, and so without the flag or a surface.
  const family = /^(?:lib\/events\/|components\/events\/|app\/events\/|app\/api\/event-card\/)/;
  const strays = files.map((f) => relative(SRC, f)).filter((rel) => !family.test(rel) && /\b(?:eventHubPath|eventStopPath|EVENTS_INDEX_PATH)\b/.test(readFileSync(join(SRC, rel), 'utf8')));
  assert.deepEqual(strays, [], 'a path builder used outside the events family: link through eventPageHref');
  for (const s of EVENT_LINK_SURFACES) assert.ok((named.get(s) ?? []).length > 0, `no eventPageHref call names the surface ${s}`);
  assert.deepEqual([...named.keys()].filter((k) => !(EVENT_LINK_SURFACES as readonly string[]).includes(k)), []);
  // Where each renders.
  assert.ok(named.get('venue_events_module')!.includes('components/venue-hub/HubUpcomingEvents.tsx'));
  assert.ok(named.get('team_also_at')!.includes('components/redesign/AffiliateRail.tsx'));
  assert.ok(named.get('footer_events')!.includes('components/redesign/Footer.tsx') && named.get('footer_events')!.includes('components/footer.tsx'));
  // The top nav (2026-11 fix round): resolved once, on the server, in the bar;
  // the client menu is handed the href and names the same surface on its anchor.
  assert.deepEqual(named.get('nav_events'), ['components/redesign/BrandBar.tsx']);
  const menu = readFileSync(join(SRC, 'components/redesign/BrandBarMobileMenu.tsx'), 'utf8');
  assert.match(menu, /<EventPageLink href=\{eventsHref\} linkSurface="nav_events"/);
  assert.doesNotMatch(menu, /eventPageHref|isEventsPagesLive/, 'the client menu never reads the flag');
  assert.equal(eventPageHref({ kind: 'index' }, 'nav_events', true)?.href, '/events');
  assert.equal(eventPageHref({ kind: 'index' }, 'nav_events', false), null);
  // The bar shows Events only from the width it fits at, wider when Playoffs or World Cup is in the bar too.
  const bar = readFileSync(join(SRC, 'components/redesign/BrandBar.tsx'), 'utf8');
  assert.match(bar, /\['hidden min-\[860px\]:inline', 'hidden min-\[980px\]:inline', 'hidden min-\[1100px\]:inline'\]\[extras\]/);
  assert.match(bar, /className=\{`\$\{LINK_CLASS\} \$\{EVENTS_SHOW\}`\}/);
  // Links out carry their own two surfaces through EventPageLink.
  const out = files.map((f) => readFileSync(f, 'utf8')).join('\n');
  for (const s of EVENT_OUT_SURFACES) assert.ok(out.includes(`linkSurface="${s}"`), `no link out of /events carries ${s}`);
});

test('page identity and surfaces: /events paths are their own page types, never a team page', () => {
  assert.deepEqual(eventsPageIdentity('/events'), { page_type: 'events_index', content_group: 'events' });
  assert.deepEqual(eventsPageIdentity('/events/monster-jam'), { page_type: 'event_hub', show: 'monster-jam', content_group: 'events' });
  assert.deepEqual(eventsPageIdentity('/events/monster-jam/us-bank-stadium'), { page_type: 'event_stop', show: 'monster-jam', venue_slug: 'us-bank-stadium', content_group: 'events' });
  for (const p of ['/nfl/minnesota-vikings', '/venues/us-bank-stadium', '/eventsx', '/events/a/b/c', '/']) assert.equal(eventsPageIdentity(p), null, p);
  assert.equal(inferSurfaceFromPath('/events'), 'web_event_hub');
  assert.equal(inferSurfaceFromPath('/events/monster-jam'), 'web_event_hub');
  assert.equal(inferSurfaceFromPath('/events/monster-jam/us-bank-stadium'), 'web_event_page');
  assert.equal(inferSurfaceFromPath('/nfl/minnesota-vikings'), 'web_team_page');
  assert.ok((KNOWN_SURFACE_VALUES as readonly string[]).includes('web_event_page') && (KNOWN_SURFACE_VALUES as readonly string[]).includes('web_event_hub'));
  // The revalidate endpoint accepts all three path shapes with no rule change.
  for (const p of ['/events', '/events/monster-jam', '/events/monster-jam/us-bank-stadium']) assert.equal(isRevalidatePath(p), true, p);
});

test('the ticket link: one performance, its own event page, subId1 = {surface}_{show}_{venueSlug}, and never a guess', () => {
  const href = buildEventTicketLink({ provider: 'ticketnetwork', eventId: 8258515, show: 'monster-jam', venueSlug: 'us-bank-stadium', surface: 'web_event_page' });
  assert.equal(href, 'https://ticketnetwork.lusg.net/c/7236189/120057/2322?u=https%3A%2F%2Fwww.ticketnetwork.com%2Ftickets%2F8258515&partnerpropertyid=8313917&MediaPartnerPropertyId=8313917&subId1=web_event_page_monster-jam_us-bank-stadium');
  assert.equal(eventSubId('web_event_page', 'monster-jam', 'us-bank-stadium'), 'web_event_page_monster-jam_us-bank-stadium');
  assert.match(eventSubId('web_event_hub', 'monster-jam', 'raymond-james-stadium'), TN_SUBID_RE);
  // The guard, known-bad: no id, a string id, zero, a fraction, a provider events do not store, a team surface, a show or venue that is not a slug.
  const base = { provider: 'ticketnetwork' as const, eventId: 8258515, show: 'monster-jam', venueSlug: 'us-bank-stadium', surface: 'web_event_page' as const };
  // A key that would be cut at 64 characters is not built (two long slugs could share one).
  assert.equal(buildEventTicketLink({ ...{ provider: 'ticketnetwork' as const, eventId: 1, show: 'monster-jam', surface: 'web_event_page' as const }, venueSlug: 'darrell-k-royal-texas-memorial-stadium' }), null);
  for (const over of [{ eventId: null }, { eventId: '8258515' as never }, { eventId: 0 }, { eventId: 1.5 }, { eventId: -4 }, { provider: null }, { provider: 'ticketmaster' as never }, { surface: 'web_team_page' as never }, { show: 'Monster Jam' }, { venueSlug: 'us-bank-stadium/../x' }, { venueSlug: '' }]) {
    assert.equal(buildEventTicketLink({ ...base, ...over }), null, JSON.stringify(over));
  }
  assert.equal(/price|\$/.test(href ?? ''), false);
  // The provider constant: events follow the site vendor only when they store an id for it, unless the override names one.
  assert.equal(eventTicketVendor('ticketnetwork', null), 'ticketnetwork');
  assert.equal(eventTicketVendor('ticketmaster', null), null);
  assert.equal(eventTicketVendor('ticketmaster', 'ticketnetwork'), 'ticketnetwork');
});

test('the clock decides: a performance past its start time is past, whatever the date', () => {
  // 4:59 PM Central on show day: both upcoming. 5:01 PM: the first is past and moves to Last visit.
  const before = stopTimeline(STOP, at('2027-02-20T22:59:00Z'));
  assert.deepEqual(upcomingPerformances(before).map((p) => p.key), ['2027-02-20T1700', '2027-02-21T1500']);
  assert.equal(before.lastVisit, null);
  const after = stopTimeline(STOP, at('2027-02-20T23:01:00Z'));
  assert.deepEqual(upcomingPerformances(after).map((p) => p.key), ['2027-02-21T1500']);
  assert.deepEqual(after.lastVisit?.performances.map((p) => p.key), ['2027-02-20T1700']);
  // The offset is the venue's: the same wall clock in Eastern time starts an hour earlier.
  const east = { ...STOP, performances: [perf('2027-02-20T1700', '-05:00')] };
  assert.equal(upcomingPerformances(stopTimeline(east, at('2027-02-20T22:30:00Z'))).length, 0);
  // Everything played: nothing upcoming, the visit is the last visit, and no "Returns" without a later stored visit.
  const done = stopTimeline(STOP, at('2027-03-01T00:00:00Z'));
  assert.deepEqual([upcomingPerformances(done).length, done.lastVisit?.visit.visitId, done.returnsYear], [0, '2027-02-20', null]);
  // A later visit is stored (its dates, no showtimes yet): "Returns in 2028".
  const returning = stopTimeline({ ...STOP, visits: [...STOP.visits, { visitId: '2028-02-19', startDate: '2028-02-19', endDate: '2028-02-20' }] }, at('2027-03-01T00:00:00Z'));
  assert.equal(returning.returnsYear, 2028);
  // A stored visit in the past is not a return.
  assert.equal(stopTimeline({ visits: STOP.visits, performances: [] }, at('2027-03-01T00:00:00Z')).returnsYear, null);
  // Rows group by visit, oldest first.
  const two = stopTimeline({ visits: [{ visitId: '2027-01-09', startDate: '2027-01-09', endDate: '2027-01-10' }, { visitId: '2027-01-23', startDate: '2027-01-23', endDate: '2027-01-24' }], performances: [perf('2027-01-23T1700', '-08:00', { visitId: '2027-01-23' }), perf('2027-01-09T1700', '-08:00', { visitId: '2027-01-09' }), perf('2027-01-10T1500', '-08:00', { visitId: '2027-01-09' })] }, at('2026-11-18T00:00:00Z'));
  assert.deepEqual(two.upcoming.map((g) => [g.visit.visitId, g.performances.map((p) => p.key)]), [['2027-01-09', ['2027-01-09T1700', '2027-01-10T1500']], ['2027-01-23', ['2027-01-23T1700']]]);
});

test('titles: the search city leads, the year is the last upcoming performance, and "Bag Policy" needs a bag rule on the page', () => {
  const tl = stopTimeline(STOP, at('2026-11-18T00:00:00Z'));
  assert.equal(stopYear(STOP, tl), '2027');
  assert.equal(stopTitle('Monster Jam', 'Minneapolis', 2027, true), 'Monster Jam Minneapolis 2027: Dates, Tickets and Bag Policy');
  assert.equal(stopTitle('Monster Jam', 'Minneapolis', 2027, false), 'Monster Jam Minneapolis 2027: Dates and Tickets');
  assert.equal(stopTitle('Monster Jam', 'Minneapolis', null, false), 'Monster Jam Minneapolis: Dates and Tickets');
  // The H1 is the show and the search city (ruling 2026-11-18); the venue is on the line under it.
  assert.equal(stopH1('Monster Jam', 'Anaheim'), 'Monster Jam Anaheim');
  assert.equal(hubTitle('Monster Jam', 2027), 'Monster Jam 2027 Schedule: Dates, Cities and Tickets');
  assert.equal(hubTitle('Monster Jam', null), 'Monster Jam Schedule: Dates, Cities and Tickets');
  assert.equal(hubH1('Monster Jam', 2027), 'Monster Jam 2027 schedule');
  // "schedule" is allowed because the scope line under the H1 carries the limit, with computed counts.
  const scope = hubScopeLine('Monster Jam', 3, 7);
  assert.match(scope, /^This page lists the 3 Monster Jam stops \(7 shows\) at venues PromoNight covers\. It is not the full tour schedule\./);
  assert.match(hubScopeLine('Monster Jam', 1, 1), /the 1 Monster Jam stop \(1 show\) at venues/);
  const desc = hubDescription('Monster Jam', 2027);
  for (const w of ['schedule', 'dates', 'tickets', 'venues PromoNight covers']) assert.ok(desc.includes(w), w);
  for (const text of [hubTitle('Monster Jam', 2027), hubH1('Monster Jam', 2027), desc, scope]) assert.doesNotMatch(text, /\b(full|complete|every|all|entire|official)\b(?! tour schedule\.)|\d{4}.*\btour\b(?! schedule\.)/i);
  // A stop whose upcoming run crosses New Year is named like a season, "2026-27"
  // (ruling 2026-11-25); it used to take the LAST performance's year alone.
  const span = { visits: [], performances: [perf('2026-12-30T1900'), perf('2027-01-02T1900')] };
  assert.equal(stopYear(span, stopTimeline(span, at('2026-11-18T00:00:00Z'))), '2026-27');
  // Once the December show has started, the run left is January's: the single year.
  assert.equal(stopYear(span, stopTimeline(span, at('2026-12-31T06:00:00Z'))), '2027');
  // Nothing upcoming: the year of the last stored show.
  assert.equal(stopYear(span, stopTimeline(span, at('2027-03-01T00:00:00Z'))), '2027');
  assert.equal(stopYear({ performances: [] }, stopTimeline({ visits: [], performances: [] }, at('2027-03-01T00:00:00Z'))), null);
  assert.equal(stopTitle('Monster Jam', 'Anaheim', '2026-27', true), 'Monster Jam Anaheim 2026-27: Dates, Tickets and Bag Policy');
  assert.equal(formatClock('17:00'), '5:00 PM'); assert.equal(formatClock('00:30'), '12:30 AM'); assert.equal(formatClock('12:00'), '12:00 PM'); assert.equal(formatClock('5pm'), '');
  assert.equal(formatRange('2027-02-20', '2027-02-21'), 'Feb 20 to 21'); assert.equal(formatRange('2027-01-30', '2027-02-01'), 'Jan 30 to Feb 1'); assert.equal(formatRange('2027-02-27', '2027-02-27'), 'Feb 27');
  assert.equal(formatDatesLine(['2027-02-21', '2027-02-20']), 'Sat, Feb 20 and Sun, Feb 21, 2027');
  assert.equal(formatDatesLine(['2027-02-12', '2027-02-13', '2027-02-13', '2027-02-14']), 'Feb 12 to 14, 2027');
  // A stop whose visits cross New Year names both years (Angel Stadium, Dec 19 to Feb 21).
  assert.equal(formatDatesLine(['2026-12-19', '2026-12-20', '2027-02-21']), 'Dec 19, 2026 to Feb 21, 2027');
  assert.equal(formatDatesLine(['2026-12-31', '2027-01-01']), 'Dec 31, 2026 to Jan 1, 2027');
  assert.equal(eventCardPath({ show: 'monster-jam', venueSlug: 'us-bank-stadium', updatedAt: '2026-11-18T16:38:39.481Z' }), '/api/event-card/monster-jam~us-bank-stadium?v=1795019919481');
});

test('the bag block: the first that exists and nothing else, in the ruled order', () => {
  const rule = { visitId: '2027-02-20', text: 'Clear bags only.', sourceUrl: 'https://venue.example/event', observedAt: '2026-11-18T13:53:25.751Z' };
  const operatorRule = { mode: 'rule' as const, text: 'No bags at any event.', sourceUrl: 'https://venue.example/policies', observedAt: '2026-11-17T18:49:25.297Z' };
  const other = { mode: 'other-event-rule' as const, text: 'Maximum bag size is 12 by 12 by 6 inches.', caveat: 'The operator says this is subject to change.', sourceUrl: 'https://venue.example/bags', observedAt: '2026-11-17T18:47:50.646Z' };
  const pointer = { mode: 'pointer' as const, sourceUrl: 'https://venue.example/bags' };
  // (a) wins over an operator rule of any mode: the stop renders the event rule alone.
  for (const bagPolicy of [operatorRule, other, pointer]) {
    const b = bagBlockFor({ bagPolicy, bagRules: [rule] }, 'Caesars Superdome', ['2027-02-20']);
    assert.equal(b?.kind, 'event-rule');
    assert.equal(JSON.stringify(b).includes('12 by 12 by 6'), false, 'the operator rule must not ride along');
  }
  assert.equal(bagBlockFor({ bagPolicy: operatorRule, bagRules: [] }, 'V', ['2027-02-20'])?.kind, 'operator-rule');
  const c = bagBlockFor({ bagPolicy: other, bagRules: [] }, 'V', ['2027-02-20']);
  assert.deepEqual([c?.kind, c && 'caveat' in c ? c.caveat : null], ['other-event-rule', 'The operator says this is subject to change.']);
  const d = bagBlockFor({ bagPolicy: { ...pointer, perEvent: true }, bagRules: [] }, 'U.S. Bank Stadium', ['2027-02-20']);
  assert.deepEqual([d?.kind, d && 'text' in d ? d.text : null], ['pointer', 'Bag policy at U.S. Bank Stadium depends on the event.']);
  assert.equal(bagBlockFor({ bagPolicy: null, bagRules: [] }, 'V', []), null);
  // An event rule read for another visit is not this visit's; the same words for two visits print once.
  assert.equal(bagBlockFor({ bagPolicy: pointer, bagRules: [{ ...rule, visitId: '2027-01-09' }] }, 'V', ['2027-02-20'])?.kind, 'pointer');
  const twice = bagBlockFor({ bagPolicy: pointer, bagRules: [{ ...rule, visitId: '2027-01-09' }, { ...rule, visitId: '2027-01-23' }] }, 'V', ['2027-01-09', '2027-01-23']);
  assert.equal(twice?.kind === 'event-rule' ? twice.rules.length : -1, 1);
  // "and Bag Policy" in the title: a pointer is not a rule.
  assert.deepEqual([showsBagRule(d), showsBagRule(c), showsBagRule(null)], [false, true, false]);
});

test('there is no transit sentence filter: the module exports none, and a stop page prints the structured lines only (ruling 2026-11-18, Phase 2D)', () => {
  const mod = readFileSync(join(process.cwd(), 'src/lib/events/event-pages.ts'), 'utf8');
  for (const gone of ['eventSafeTransitNote', 'eventSafeTransitLines', 'tenantNameWords', 'splitSentences', 'withoutOwnNames']) assert.equal(mod.includes(`function ${gone}`), false, gone);
  const view = readFileSync(join(process.cwd(), 'src/components/events/EventStopView.tsx'), 'utf8');
  // The view never reads the hub's notes prose, and takes its transit decision from the venue page's own model.
  assert.equal(/publicTransit\??\.notes/.test(view), false, 'the stop page reads no transit notes');
  assert.ok(view.includes('transitRowModel(hub)'));
});

test('the countdown: days to the first show on the venue calendar; today and tomorrow as words; nothing once the day has passed', () => {
  assert.equal(daysUntil('2027-02-20', '2026-11-18'), 94);
  assert.equal(countdownLabel('2027-02-20', '2026-11-18'), '94 days away');
  assert.equal(countdownLabel('2027-02-20', '2027-02-18'), '2 days away');
  assert.equal(countdownLabel('2027-02-20', '2027-02-19'), 'Tomorrow');
  assert.equal(countdownLabel('2027-02-20', '2027-02-20'), 'Today');
  assert.equal(countdownLabel('2027-02-20', '2027-02-21'), null);
  assert.equal(countdownLabel(null, '2027-02-21'), null);
  assert.equal(countdownLabel('not-a-date', '2027-02-21'), null);
  // A spring-forward day is still one day (calendar days, not 24-hour blocks).
  assert.equal(daysUntil('2027-03-15', '2027-03-13'), 2);
  // The VENUE's day decides: 11:30 PM Central on Feb 19 is already Feb 20 in UTC, and the show is still tomorrow.
  assert.equal(countdownAt('2027-02-20', at('2027-02-20T05:30:00Z'), 'America/Chicago'), 'Tomorrow');
  assert.equal(countdownAt('2027-02-20', at('2027-02-20T06:30:00Z'), 'America/Chicago'), 'Today');
  assert.equal(countdownAt(null, at('2027-02-20T06:30:00Z'), 'America/Chicago'), null);
  // WHICH show is first follows the clock: an hour after Saturday's start the count runs to Sunday.
  const two = [{ date: '2027-02-20', startsAt: '2027-02-20T17:00:00-06:00' }, { date: '2027-02-21', startsAt: '2027-02-21T15:00:00-06:00' }];
  assert.equal(firstUpcomingDate(two, at('2027-02-20T22:00:00Z')), '2027-02-20');
  assert.equal(firstUpcomingDate(two, at('2027-02-21T00:00:00Z')), '2027-02-21');
  assert.equal(countdownAt(firstUpcomingDate(two, at('2027-02-21T00:00:00Z')), at('2027-02-21T00:00:00Z'), 'America/Chicago'), 'Tomorrow');
  assert.equal(firstUpcomingDate(two, at('2027-02-22T00:00:00Z')), null);
});

test('the hour-by-hour card: stored times only, in clock order, and no card for a show with neither a Pit Party nor a gate time', () => {
  const sat = perf('2027-02-20T1700'); const sun = perf('2027-02-21T1500');
  const pit = [{ visitId: '2027-02-20', performance: sat.key, start: '12:30', end: '15:30', sourceUrl: 'https://venue.example/pit', observedAt: '2026-11-18T00:00:00Z', passStated: true }];
  const gates = [{ visitId: '2027-02-20', performance: sat.key, opensAt: '15:30', sourceUrl: 'https://venue.example/gates', observedAt: '2026-11-18T00:00:00Z' }];
  assert.deepEqual(showTimeline(sat, pit, [])!.map((e) => `${e.at} ${e.text}`), ['12:30 Pit Party opens.', '15:30 Pit Party closes.', '17:00 Show starts.']);
  // A gate time at the same minute the Pit Party closes sorts after it; nothing else is added.
  assert.deepEqual(showTimeline(sat, pit, gates)!.map((e) => e.kind), ['pit-open', 'pit-close', 'gates', 'show']);
  assert.deepEqual(showTimeline(sat, [], gates)!.map((e) => `${e.at} ${e.text}`), ['15:30 Gates open.', '17:00 Show starts.']);
  // Sunday has nothing stored: no card (the showtime alone is on the show card already).
  assert.equal(showTimeline(sun, pit, gates), null);
  // Every word on the card is one of the four fixed labels: no invented step.
  for (const e of showTimeline(sat, pit, gates)!) assert.ok(['Pit Party opens.', 'Pit Party closes.', 'Gates open.', 'Show starts.'].includes(e.text));
  // A duplicate row prints once; a time that is not HH:mm is left out, never guessed.
  assert.deepEqual(showTimeline(sat, [...pit, ...pit], [{ ...gates[0], opensAt: '9:00' }])!.map((e) => e.kind), ['pit-open', 'pit-close', 'show']);
  assert.equal(showTimeline(sat, [], [{ ...gates[0], opensAt: '9:00' }]), null);
  assert.equal(weekdayLong('2027-02-20'), 'Saturday');
});

test('the hub lists a multi-visit stop under each month with only that month\'s visits', () => {
  const angel = { visits: [{ start: '2026-12-19', end: '2026-12-20', shows: 2 }, { start: '2027-01-16', end: '2027-01-17', shows: 2 }, { start: '2027-01-30', end: '2027-01-31', shows: 2 }, { start: '2027-02-20', end: '2027-02-21', shows: 2 }] };
  assert.deepEqual(monthVisitLine(angel, '2026-12'), { dates: 'Dec 19 to 20, 2026', shows: 2 });
  assert.deepEqual(monthVisitLine(angel, '2027-01'), { dates: 'Jan 16 to 17 and Jan 30 to 31, 2027', shows: 4 });
  assert.deepEqual(monthVisitLine(angel, '2027-02'), { dates: 'Feb 20 to 21, 2027', shows: 2 });
  assert.equal(monthVisitLine(angel, '2027-03'), null);
  // A visit that runs over a month end sits under the month it starts in.
  assert.deepEqual(monthVisitLine({ visits: [{ start: '2027-01-30', end: '2027-02-01', shows: 3 }] }, '2027-01'), { dates: 'Jan 30 to Feb 1, 2027', shows: 3 });
  assert.equal(monthVisitLine({ visits: [{ start: '2027-01-30', end: '2027-02-01', shows: 3 }] }, '2027-02'), null);
});

test('the hero photo: one local file per show, shown whole, with its credit; no other image host', () => {
  const hero = EVENT_HERO['monster-jam'];
  assert.equal(hero.src, '/events/monster-jam-hero.jpg');
  assert.ok(statSync(join(process.cwd(), 'public', hero.src)).size > 100_000);
  assert.equal(hero.credit, 'Photo: Marion Wellmann / Pixabay. Not a truck from this show.');
  assert.equal((hero.width / hero.height).toFixed(2), '1.50');
  const src = readFileSync(join(process.cwd(), 'src/components/events/EventHero.tsx'), 'utf8');
  // No crop: no object-fit, no fill, no fixed height on the photo.
  assert.equal(/object-cover|object-fit|\bfill\b(?!=)|objectFit/.test(src.replace(/\/\/.*$/gm, '')), false, 'the photo is never cropped to a box');
  assert.ok(src.includes('h-auto w-full'));
  // The generated card is not repeated in the page; it stays the og:image.
  const view = readFileSync(join(process.cwd(), 'src/components/events/EventStopView.tsx'), 'utf8');
  assert.equal(/<img\b/.test(view), false, 'no in-page copy of the card');
  assert.equal(EVENTS_ACCENT, '#f5c518');
});

test('several visits never read as one continuous run of dates', () => {
  const angel = ['2026-12-19', '2026-12-20', '2027-01-16', '2027-01-17', '2027-01-30', '2027-01-31', '2027-02-20', '2027-02-21'];
  assert.equal(showsPhrase(angel, 4), '8 shows between Dec 19, 2026 and Feb 21, 2027');
  assert.equal(showsPhrase(['2027-02-06', '2027-02-07', '2027-02-13'], 2), '3 shows between Feb 6 and Feb 13, 2027');
  // One visit keeps its days.
  assert.equal(showsPhrase(['2027-02-20', '2027-02-21'], 1), 'Sat, Feb 20 and Sun, Feb 21, 2027');
  assert.equal(showsPhrase([], 0), '');
  const d = stopDescription({ showName: 'Monster Jam', searchCity: 'Anaheim', venueName: 'Angel Stadium', dates: angel, visitCount: 4, bagRule: false, transit: true, pitParty: false });
  assert.equal(d, 'Monster Jam has 8 shows between Dec 19, 2026 and Feb 21, 2027 at Angel Stadium in Anaheim. Showtimes and tickets, plus transit.');
  // The description never promises parking: the page prints no parking list (ruling 2026-11-18).
  for (const flags of [{ bagRule: true, transit: true, pitParty: true }, { bagRule: false, transit: false, pitParty: false }]) assert.equal(/parking/i.test(stopDescription({ showName: 'Monster Jam', searchCity: 'Tampa', venueName: 'Raymond James Stadium', dates: ['2027-02-13'], ...flags })), false);
  // Nothing upcoming: the description promises nothing.
  assert.equal(stopDescription({ showName: 'Monster Jam', searchCity: 'Minneapolis', venueName: 'U.S. Bank Stadium', dates: [], bagRule: true, transit: true, pitParty: false }), 'Monster Jam at U.S. Bank Stadium in Minneapolis. No upcoming dates are listed right now.');
  // A long run's FAQ answer is a summary, not eight dates in a sentence.
  const up = angel.map((dt, i) => perf(`${dt}T${i % 2 ? '1430' : '1630'}`, '-08:00', { visitId: angel[i - (i % 2)] }));
  const faq = stopFaqs({ showName: 'Monster Jam', searchCity: 'Anaheim', venueName: 'Angel Stadium', upcoming: up, bag: null, pitParty: [], gateTimes: [] });
  assert.deepEqual(faq.map((f) => f.a), ['Monster Jam has 8 shows between Dec 19, 2026 and Feb 21, 2027 at Angel Stadium. Every showtime is listed at the top of this page. Times are local to the venue.']);
});

test('"today" is the venue\'s day: a visit that starts tomorrow in Los Angeles is still a later visit the evening before', () => {
  // 6 PM Pacific on Dec 30 is already Dec 31 in UTC (review 2026-11-18, finding 12).
  const now = at('2026-12-31T02:00:00Z');
  assert.equal(ymdInZone(now, 'America/Los_Angeles'), '2026-12-30');
  // The known-bad cut: the UTC date is already the visit's first day, so a UTC "today" would not call it later.
  assert.equal(now.toISOString().slice(0, 10), '2026-12-31');
  const stop = { visits: [{ visitId: '2026-12-31', startDate: '2026-12-31', endDate: '2027-01-01' }], performances: [] };
  assert.equal(stopTimeline({ ...stop, timezone: 'America/Los_Angeles' }, now).returnsYear, 2026);
  // Four hours later it is Dec 31 in Los Angeles too: the visit has begun and is no longer "later".
  assert.equal(stopTimeline({ ...stop, timezone: 'America/Los_Angeles' }, at('2026-12-31T09:00:00Z')).returnsYear, null);
});

test('JSON-LD: one Event per performance with its offset, the building, a status and an offer on the STOP PAGE, with no price and no tracking URL', () => {
  const venue = { name: 'U.S. Bank Stadium', city: 'Minneapolis', state: 'Minnesota', lat: 44.9736, lng: -93.2575 };
  const stopUrl = 'https://www.getpromonight.com/events/monster-jam/us-bank-stadium';
  const base = { showName: 'Monster Jam', stopUrl, imageUrl: 'https://www.getpromonight.com/api/event-card/monster-jam~us-bank-stadium?v=1', venue, hasTicketLink: true };
  const ld = performanceJsonLd({ ...base, performance: STOP.performances[0] }) as Record<string, any>;
  assert.equal(ld['@type'], 'Event');
  assert.equal(ld.startDate, '2027-02-20T17:00:00-06:00');
  assert.equal(ld.eventStatus, 'https://schema.org/EventScheduled');
  assert.deepEqual(ld.location.address, { '@type': 'PostalAddress', addressLocality: 'Minneapolis', addressRegion: 'Minnesota', addressCountry: 'US' });
  // Ruling 2026-11-18 (Phase 2B): the offer's url is the stop page, never the tracked affiliate link.
  assert.deepEqual(ld.offers, { '@type': 'Offer', url: stopUrl, availability: 'https://schema.org/InStock' });
  assert.equal(/"price|priceCurrency|lowPrice/.test(JSON.stringify(ld)), false);
  const sold = performanceJsonLd({ ...base, performance: { ...STOP.performances[0], status: 'soldout' } }) as Record<string, any>;
  assert.deepEqual(sold.offers, { '@type': 'Offer', url: stopUrl, availability: 'https://schema.org/SoldOut' });
  // On sale but the row has no ticket button (no event id): the page cannot sell it, so no InStock claim (review 2026-11-18, finding 6).
  assert.equal('offers' in performanceJsonLd({ ...base, hasTicketLink: false, performance: STOP.performances[0] }), false);
  // A status nobody read: no offer at all, never a guessed one.
  assert.equal('offers' in performanceJsonLd({ ...base, performance: { ...STOP.performances[0], status: 'unknown' } }), false);
  // No affiliate or tracking URL anywhere in structured data, whatever the performance carries:
  // every URL in the block is on our own domain, and no partner host or sub ID appears.
  for (const status of ['onsale', 'soldout', 'unknown'] as const) {
    const wire = JSON.stringify(performanceJsonLd({ ...base, performance: { ...STOP.performances[0], status } }));
    assert.equal(/lusg\.net|ticketnetwork|spothero|subId|aff_|impact|evyy\.net|utm_/i.test(wire), false, status);
    const urls = [...wire.matchAll(/https?:\/\/[^"\\]+/g)].map((m) => m[0]).filter((u) => !u.startsWith('https://schema.org'));
    assert.ok(urls.length >= 2 && urls.every((u) => u.startsWith('https://www.getpromonight.com/')), urls.join(' '));
  }
  // The builder has no parameter a tracked link could arrive through (a compile-time fact, pinned here by arity of its input).
  assert.equal('ticketUrl' in ({ ...base, performance: STOP.performances[0] } as Record<string, unknown>), false);
});

test('FAQs come from stored fields only: no run time, no noise, no ages, no strollers', () => {
  const upcoming = STOP.performances;
  const pit = [{ visitId: '2027-02-20', performance: '2027-02-20T1700', start: '12:30', end: '15:30', sourceUrl: 'https://venue.example/news', observedAt: '2026-11-18T13:55:21.901Z', passStated: false }];
  const faqs = stopFaqs({ showName: 'Monster Jam', searchCity: 'Minneapolis', venueName: 'U.S. Bank Stadium', upcoming, bag: bagBlockFor({ bagPolicy: { mode: 'pointer', sourceUrl: 'https://venue.example/bags' }, bagRules: [] }, 'U.S. Bank Stadium', ['2027-02-20']), pitParty: pit, gateTimes: [] });
  assert.deepEqual(faqs.map((f) => f.q), ['When is Monster Jam in Minneapolis?', 'When is the Pit Party at U.S. Bank Stadium?']);
  assert.equal(faqs[0].a, 'Saturday, February 20, 2027 at 5:00 PM and Sunday, February 21, 2027 at 3:00 PM, at U.S. Bank Stadium. Times are local to the venue.');
  assert.match(faqs[1].a, /Sat, Feb 20 \(5:00 PM show\): 12:30 PM to 3:30 PM/);
  const all = JSON.stringify(stopFaqs({ showName: 'Monster Jam', searchCity: 'Houston', venueName: 'NRG Stadium', upcoming, bag: null, pitParty: [], gateTimes: [{ visitId: '2027-02-20', performance: '2027-02-21T1500', opensAt: '13:30', sourceUrl: 'https://venue.example/e', observedAt: '2026-11-18T13:54:17.868Z' }] }));
  assert.match(all, /gates open at 1:30 PM/);
  for (const word of ['hour', 'loud', 'ear', 'stroller', 'toddler', 'under 2', 'ages', 'kids', 'children']) assert.equal(new RegExp(`\\b${word}`, 'i').test(all + JSON.stringify(faqs)), false, word);
  // An event rule the venue printed for one visit of two: the FAQ answer carries the same scope sentence as the card (ux-review N1).
  const scoped = stopFaqs({ showName: 'Monster Jam', searchCity: 'Houston', venueName: 'NRG Stadium', upcoming, bag: bagBlockFor({ bagPolicy: null, bagRules: [{ visitId: '2027-02-20', text: 'Bags over 11 by 17 inches are not allowed.', sourceUrl: 'https://venue.example/e', observedAt: '2026-11-18T13:54:17.868Z' }] }, 'NRG Stadium', ['2027-02-20']), bagAnswer: 'Bags over 11 by 17 inches are not allowed. NRG Stadium prints this for the Feb 6 to 7 shows. It has not published a rule for the other dates on this page.', pitParty: [], gateTimes: [] });
  assert.equal(scoped.find((f) => /bag policy/i.test(f.q))?.a, 'Bags over 11 by 17 inches are not allowed. NRG Stadium prints this for the Feb 6 to 7 shows. It has not published a rule for the other dates on this page.');
  // A pointer is not an answer to "what is the bag policy".
  assert.equal(faqs.some((f) => /bag policy/i.test(f.q)), false);
  // Nothing upcoming, nothing stored: no questions at all.
  assert.deepEqual(stopFaqs({ showName: 'Monster Jam', searchCity: 'X', venueName: 'Y', upcoming: [], bag: null, pitParty: pit, gateTimes: [] }), []);
});

test('hub questions: a run-time or kids question renders only from a stored venue fact', () => {
  const none = hubFaqs({ showName: 'Monster Jam', hasStops: true, runTime: [], kids: [] });
  assert.deepEqual(none.map((f) => f.q), ['What is Monster Jam?', 'Where can I find bag, parking and transit details?']);
  // The definition: two sentences, our own words, no affiliation claim.
  assert.equal(none[0].a!.split('. ').length, 2);
  assert.doesNotMatch(none.map((f) => f.a).join(' '), /\b(official|partner|hours?|minutes?|kids|children|ears?|loud|ages?)\b/i);
  const fact = { venueName: 'Example Arena', text: 'Children under 2 do not need a ticket.', sourceUrl: 'https://venue.example/event' };
  const some = hubFaqs({ showName: 'Monster Jam', hasStops: true, runTime: [{ ...fact, text: 'The show runs about two hours.' }], kids: [fact] });
  assert.deepEqual(some.map((f) => f.q), ['What is Monster Jam?', 'How long is a Monster Jam show?', 'Do kids need a ticket for Monster Jam?', 'Where can I find bag, parking and transit details?']);
  // A fact answer is the stored facts and nothing else: no prose of ours.
  assert.equal(some[1].a, undefined); assert.deepEqual(some[2].facts, [fact]);
  // The kids' ticket lead says whose rule it is and promises nothing about other venues; it states no rule itself.
  assert.equal(some[2].a, HUB_KIDS_LEAD);
  assert.match(HUB_KIDS_LEAD, /Each venue sets its own rule, and other venues may differ\./);
  assert.doesNotMatch(HUB_KIDS_LEAD, /\d|free|under|ages?\b|good for kids/i);
  assert.deepEqual(hubFaqs({ showName: 'Monster Jam', hasStops: false, runTime: [], kids: [] }).map((f) => f.q), ['What is Monster Jam?']);
});

test('hub city pills: the city alone, and the venue name added only when two listed stops share a city', () => {
  const stops = [
    { venueSlug: 'angel-stadium', searchCity: 'Anaheim', venueName: 'Angel Stadium' },
    { venueSlug: 'honda-center', searchCity: 'Anaheim', venueName: 'Honda Center' },
    { venueSlug: 'ball-arena', searchCity: 'Denver', venueName: 'Ball Arena' },
  ];
  const labels = cityPillLabels(stops);
  assert.equal(labels.get('angel-stadium'), 'Anaheim · Angel Stadium');
  assert.equal(labels.get('honda-center'), 'Anaheim · Honda Center');
  assert.equal(labels.get('ball-arena'), 'Denver');
  // No state, ever, and one stop per city stays the bare city.
  assert.deepEqual([...cityPillLabels(stops.slice(1)).values()], ['Anaheim', 'Denver']);
});

test('6B bag pointer line: "per event" only where the stored operator quote says the policy varies by event', () => {
  // Derived from the quote's words, not from venue names.
  assert.equal(bagQuoteSaysPerEvent('All permissible bags, per the policy of the event, will be permitted into the stadium'), true);
  assert.equal(bagQuoteSaysPerEvent('Items which have varying policies for concerts and special events include: bags, cameras'), true);
  assert.equal(bagQuoteSaysPerEvent('Additional bag restrictions may apply for specific events, please see the individual event page'), false);
  assert.equal(bagQuoteSaysPerEvent('For additional restrictions regarding bags or in-arena phone use, please click into your event on the'), false);
  assert.equal(bagQuoteSaysPerEvent('Concerts and other events may have different guidelines set by the artist or promoter.'), false); // never mentions bags
  assert.equal(bagQuoteSaysPerEvent('The Clear Bag Policy is implemented at all Indianapolis Colts events and other events as determined by the promoter.'), false);
  assert.equal(bagQuoteSaysPerEvent('Bags smaller than 6 x 9 x 2 are allowed.'), false);
  assert.equal(bagQuoteSaysPerEvent(null), false);
  // Negated, or the by-event wording is about something else in another sentence: not backed.
  assert.equal(bagQuoteSaysPerEvent('Bags are not subject to varying policies; one rule applies at every event.'), false);
  assert.equal(bagQuoteSaysPerEvent('Camera policies vary by event. Bags larger than 12x12 are prohibited at all events.'), false);
  assert.equal(bagQuoteSaysPerEvent('All bags are searched. Re-entry is per the policy of the event.'), false);
  assert.equal(bagQuoteSaysPerEvent('Our bag policy does not vary by event.'), false);
  assert.equal(bagQuoteSaysPerEvent('Bag policies may vary by event.'), true);
  const block = (perEvent: boolean | undefined, name: string) => { const b = bagBlockFor({ bagPolicy: { mode: 'pointer', sourceUrl: 'https://venue.example/bags', ...(perEvent === undefined ? {} : { perEvent }) }, bagRules: [] }, name, []); return b && b.kind === 'pointer' ? [b.text, b.sourceUrl] : null; };
  assert.deepEqual(block(true, 'U.S. Bank Stadium'), ['Bag policy at U.S. Bank Stadium depends on the event.', 'https://venue.example/bags']);
  assert.deepEqual(block(false, 'Fiserv Forum'), ["Check Fiserv Forum's bag policy before you go.", 'https://venue.example/bags']);
  assert.deepEqual(block(undefined, 'Some Arena'), ["Check Some Arena's bag policy before you go.", 'https://venue.example/bags']);
});

test('6B Pit Party: "pass" only where every window shown is one whose stored quote says so; otherwise nothing is added', () => {
  assert.equal(pitPassStated([{ passStated: true }, { passStated: true }]), true);
  assert.equal(pitPassStated([{ passStated: true }, { passStated: false }]), false);
  assert.equal(pitPassStated([]), false);
  assert.match(pitPassLine([{ passStated: true }]), /needs its own pass/);
  assert.equal(pitPassLine([{ passStated: false }]), '');
});

test('6A hour-by-hour sources: one source keeps the plain line; a source per show names the show it covers', () => {
  const at = '2026-11-19T14:34:15.250Z';
  const one = timelineSourceLines('Gate', [{ performance: '2027-02-06T1700', sourceUrl: 'https://v.example/a', observedAt: at }, { performance: '2027-02-07T1500', sourceUrl: 'https://v.example/a', observedAt: at }]);
  assert.deepEqual(one, [{ what: 'Gate times', url: 'https://v.example/a', observedAt: at }]);
  const two = timelineSourceLines('Gate', [{ performance: '2027-02-06T1700', sourceUrl: 'https://v.example/day-1', observedAt: at }, { performance: '2027-02-07T1500', sourceUrl: 'https://v.example/day-2', observedAt: at }]);
  assert.deepEqual(two.map((x) => [x.what, x.url]), [['Sat, Feb 6 gate time', 'https://v.example/day-1'], ['Sun, Feb 7 gate time', 'https://v.example/day-2']]);
  // A page that covers two of three shows names both.
  const mixed = timelineSourceLines('Pit Party', [{ performance: '2027-02-06T1700', sourceUrl: 'https://v.example/a', observedAt: at }, { performance: '2027-02-07T1500', sourceUrl: 'https://v.example/a', observedAt: at }, { performance: '2027-02-13T1700', sourceUrl: 'https://v.example/b', observedAt: at }]);
  assert.deepEqual(mixed.map((x) => x.what), ['Sat, Feb 6 and Sun, Feb 7 Pit Party times', 'Sat, Feb 13 Pit Party time']);
  assert.deepEqual(timelineSourceLines('Gate', []), []);
});

test('the events year: one helper, "2026-27" only when the run crosses New Year (ruling 2026-11-25)', () => {
  assert.equal(runYearLabel(['2027-01-16', '2027-02-21']), '2027');
  assert.equal(runYearLabel(['2026-12-19', '2026-12-20']), '2026');
  assert.equal(runYearLabel(['2026-12-19', '2027-02-21']), '2026-27');
  assert.equal(runYearLabel(['2027-02-21', '2026-12-19']), '2026-27', 'order does not matter');
  assert.equal(runYearLabel([]), null);
  assert.equal(runYearLabel(['soon', '']), null);
  // The hub, across stops: Anaheim opens Dec 19, 2026; every other stop is in 2027.
  const anaheim = { nextDate: '2026-12-19', lastDate: '2027-02-21' };
  const saltLake = { nextDate: '2027-01-08', lastDate: '2027-01-10' };
  assert.equal(hubYear([saltLake, anaheim]), '2026-27');
  assert.equal(hubTitle('Monster Jam', hubYear([saltLake, anaheim])), 'Monster Jam 2026-27 Schedule: Dates, Cities and Tickets');
  assert.equal(hubH1('Monster Jam', hubYear([saltLake, anaheim])), 'Monster Jam 2026-27 schedule');
  assert.match(hubDescription('Monster Jam', hubYear([saltLake, anaheim])), /^Monster Jam 2026-27 schedule at venues PromoNight covers/);
  // After Anaheim's December shows the hub's run is all 2027: the single year again.
  assert.equal(hubYear([saltLake, { nextDate: '2027-01-16', lastDate: '2027-02-21' }]), '2027');
  assert.equal(hubYear([]), null);
  // Every title is fed by it: the hub page calls hubYear, and the stop head calls stopYear.
  const hubPage = readFileSync(join(SRC, 'app/events/[show]/page.tsx'), 'utf8');
  assert.match(hubPage, /year: hubYear\(stops\)/);
  assert.doesNotMatch(hubPage, /lastYear/);
});

