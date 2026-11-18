// Event tour-stop pages (Phase 2, 2026-11-18): the pure half, each rule driven
// by the input that would break it.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
import {
  EVENT_LINK_SURFACES,
  EVENT_OUT_SURFACES,
  bagBlockFor,
  eventCardPath,
  eventPageHref,
  eventLot,
  eventSafeLotName,
  eventSafeTransitLines,
  eventSafeParkingNote,
  eventSafeTransitNote,
  eventsPageIdentity,
  formatClock,
  formatDatesLine,
  formatRange,
  hubTitle,
  isEventsPagesLive,
  performanceJsonLd,
  showsBagRule,
  showsPhrase,
  stopDescription,
  splitSentences,
  stopFaqs,
  stopH1,
  stopTimeline,
  stopTitle,
  stopYear,
  tenantNameWords,
  upcomingPerformances,
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
  assert.equal(stopYear(STOP, tl), 2027);
  assert.equal(stopTitle('Monster Jam', 'Minneapolis', 2027, true), 'Monster Jam Minneapolis 2027: Dates, Tickets and Bag Policy');
  assert.equal(stopTitle('Monster Jam', 'Minneapolis', 2027, false), 'Monster Jam Minneapolis 2027: Dates and Tickets');
  assert.equal(stopTitle('Monster Jam', 'Minneapolis', null, false), 'Monster Jam Minneapolis: Dates and Tickets');
  assert.equal(stopH1('Monster Jam', 'Anaheim', 'Angel Stadium'), 'Monster Jam Anaheim at Angel Stadium');
  assert.equal(hubTitle('Monster Jam', 2027), 'Monster Jam 2027: Dates, Tickets and Venue Guides');
  // A stop that spans New Year takes the LAST upcoming performance's year.
  const span = { visits: [], performances: [perf('2026-12-30T1900'), perf('2027-01-02T1900')] };
  assert.equal(stopYear(span, stopTimeline(span, at('2026-11-18T00:00:00Z'))), 2027);
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
  const d = bagBlockFor({ bagPolicy: pointer, bagRules: [] }, 'U.S. Bank Stadium', ['2027-02-20']);
  assert.deepEqual([d?.kind, d && 'text' in d ? d.text : null], ['pointer', 'U.S. Bank Stadium sets its bag policy per event.']);
  assert.equal(bagBlockFor({ bagPolicy: null, bagRules: [] }, 'V', []), null);
  // An event rule read for another visit is not this visit's; the same words for two visits print once.
  assert.equal(bagBlockFor({ bagPolicy: pointer, bagRules: [{ ...rule, visitId: '2027-01-09' }] }, 'V', ['2027-02-20'])?.kind, 'pointer');
  const twice = bagBlockFor({ bagPolicy: pointer, bagRules: [{ ...rule, visitId: '2027-01-09' }, { ...rule, visitId: '2027-01-23' }] }, 'V', ['2027-01-09', '2027-01-23']);
  assert.equal(twice?.kind === 'event-rule' ? twice.rules.length : -1, 1);
  // "and Bag Policy" in the title: a pointer is not a rule.
  assert.deepEqual([showsBagRule(d), showsBagRule(c), showsBagRule(null)], [false, true, false]);
});

test('parking notes: a sentence with a price, a tenant, a league or a game-day word is dropped; what is left may be nothing', () => {
  const tenants = tenantNameWords(['Minnesota Vikings']);
  assert.deepEqual(tenants.sort(), ['Minnesota Vikings', 'Vikings']);
  // The full name and the nickname only: never a place word, never an ordinary-word nickname.
  assert.deepEqual(tenantNameWords(['Minnesota Vikings', 'Minnesota United FC', 'Boston Red Sox', 'New York Giants', 'Los Angeles Angels', 'Chicago Fire', 'Philadelphia Union', 'Sporting Kansas City', 'Buffalo Bills']).sort(),
    ['Boston Red Sox', 'Buffalo Bills', 'Chicago Fire', 'Los Angeles Angels', 'Minnesota United FC', 'Minnesota Vikings', 'New York Giants', 'Philadelphia Union', 'Sox', 'Sporting Kansas City', 'Vikings']);
  // The known-bad sentences of the review (finding 5): each must SURVIVE.
  const many = tenantNameWords(['New York Giants', 'New York Jets', 'Los Angeles Angels', 'Chicago Fire', 'Philadelphia Union', 'Buffalo Bills', 'Washington Nationals']);
  for (const ok of ['NJ Transit trains run from New York Penn Station to the Meadowlands.', 'Metrolink trains from Los Angeles Union Station stop at ARTIC.', 'Do not park in fire lanes.', 'The garage is beside Union Station.']) assert.equal(eventSafeTransitNote(ok, many), ok, ok);
  // The building's own name is a place: "Nationals Park" is not the tenant.
  assert.equal(eventSafeParkingNote('Garage C is across from Nationals Park.', ['Nationals'], ['Nationals Park']), 'Garage C is across from Nationals Park.');
  assert.equal(eventSafeParkingNote('Reserved for Nationals staff.', ['Nationals'], ['Nationals Park']), '');
  const note = 'Connected to the stadium by skyway. Rates start at $25 on game days. Vikings season ticket holders park here. Opens 4 hours before kickoff. Entrance on 4th Street.';
  assert.equal(eventSafeParkingNote(note, tenants), 'Connected to the stadium by skyway. Entrance on 4th Street.');
  // Phase 2B: a tailgate sentence is game-day copy.
  for (const bad of ['Bus and RV tailgate spots available; purchase in advance.', 'The only lot in which tailgating is permitted.', 'Tailgates must end at kickoff.']) assert.equal(eventSafeParkingNote(bad, tenants), '', bad);
  assert.equal(eventSafeTransitNote('Tailgating shuttles run from Lot C.', []), '');
  for (const bad of ['Costs $40.', 'Parking is 30 dollars cash.', 'Reserved for NFL games.', 'Open on game day only.', 'Lots open before first pitch.', 'Passes are sold for the season.', 'Vikings permit lot.', 'Opens at kick-off.']) assert.equal(eventSafeParkingNote(bad, tenants), '', bad);
  assert.equal(eventSafeParkingNote(null, tenants), '');
  assert.equal(eventSafeParkingNote('On the east side at St. Paul Ave. Enter from 5th.', []), 'On the east side at St. Paul Ave. Enter from 5th.');
  assert.deepEqual(splitSentences('One. Two! Three? four'), ['One.', 'Two!', 'Three? four']);
  // Review 2026-11-18, finding 2: an abbreviation is not the end of a sentence.
  assert.deepEqual(splitSentences('Light rail runs to U.S. Bank Stadium Station. Buses serve St. Paul and Minneapolis.'), ['Light rail runs to U.S. Bank Stadium Station.', 'Buses serve St. Paul and Minneapolis.']);
  assert.equal(eventSafeTransitNote('The Blue Line stops at U.S. Bank Stadium station, with extra trains on game days.', []), '');
  assert.equal(eventSafeParkingNote('On Vikings game days, ramps near U.S. Bank Stadium fill early.', tenants), '');
  assert.equal(eventSafeTransitNote('Trains run until 1 a.m. Friday and Saturday.', []), '');
  assert.equal(eventSafeParkingNote('Enter from Dr. Martin Luther King Jr. Blvd. for Saints games only.', ['Saints']), '');
  assert.equal(eventSafeParkingNote('Parking is $40. Cash only. Arrive early.', []), 'Arrive early.');
  // Finding 4: more sentences that must go.
  for (const bad of ['Free parking is available in the North Lot.', 'Complimentary parking for premium members.', 'Lots open at 9:00 AM.', 'Lots open four hours before the opening faceoff.', 'Permit only on football Saturdays.', 'Prepaid passes are required during the playoffs.', 'Preseason and postseason rates differ.', 'Parking is 30 cash.', 'Flat rate of 25.00, credit only.']) assert.equal(eventSafeParkingNote(bad, []), '', bad);
  for (const bad of ['Complimentary shuttles run from the Park and Ride.', 'Ride at no charge with a ticket.', 'Trains run until midnight.', 'Service ends at noon on Sundays.', 'The last train leaves 45 minutes after the final whistle.', 'Extra trains run on hockey nights.']) assert.equal(eventSafeTransitNote(bad, []), '', bad);
  for (const bad of ['Gameday Lot B', 'Season Ticket Holder Lot', 'Tailgate Lot', 'Suite Lot', 'Club Lot 4', 'Permit Lot']) assert.equal(eventSafeLotName(bad, []), '', bad);
  assert.deepEqual(eventSafeTransitLines(['METRO Blue Line', 'Gameday Express', '', 42, 'Vikings Shuttle'], tenants), ['METRO Blue Line']);
  assert.deepEqual(eventSafeTransitLines('METRO Blue Line', tenants), [], 'a value that is not a list never throws');
  // Review 2026-11-18, finding 9: the sentences the first filter let through.
  const more = tenantNameWords(['Boston Red Sox', 'Minnesota United FC']);
  for (const bad of ['Lots open four hours before kick off.', 'Sox fans park in Lot B.', 'United supporters enter at Gate 3.', 'Pregame tailgating is allowed here.', 'Lots open three hours before tipoff.', 'Opens two hours before puck drop on matchdays.', 'Parking is 30 per car, cash only.', 'Twenty dollars per car.']) assert.equal(eventSafeParkingNote(bad, more), '', bad);
  // THE HIGH FINDING (review 2026-11-18): a lot tied to the home team or to a reserved class is LEFT OFF,
  // never listed by its bare name. Each case is a real lot from the venue hubs.
  const preds = tenantNameWords(['Nashville Predators']);
  assert.equal(eventLot({ name: 'Nissan Stadium Parking', notes: 'Complimentary parking in Lot R across the river for Predators home games. Lot R and the shuttle open 2 hours before every Predators game.' }, preds), null);
  assert.equal(eventLot({ name: 'Toyota Corolla Lot', notes: 'Avalanche Game: Permit only. Nuggets Game: Permit only.' }, tenantNameWords(['Colorado Avalanche', 'Denver Nuggets'])), null);
  assert.equal(eventLot({ name: 'Toyota Camry Lot (VIP)', notes: 'Located on the southwest side of Ball Arena. Avalanche Game: Permit only.' }, tenantNameWords(['Colorado Avalanche'])), null, 'a partly conditioned lot is left off too');
  assert.equal(eventLot({ name: 'Lot 4', notes: 'game-day ADA/disabled overflow parking, first come first serve' }, []), null);
  assert.equal(eventLot({ name: 'South Lot', notes: 'Accessible parking; a placard and, for Colts games, a Colts parking pass are required. Denison Parking operates ~2,000 spaces across multiple lots surrounding the stadium.' }, tenantNameWords(['Indianapolis Colts'])), null);
  for (const note of ['Suite parking', 'Club', 'Permit holders only.', 'Reserved for season ticket holders.']) assert.equal(eventLot({ name: 'Lot B', notes: note }, []), null, note);
  // A general lot keeps its name and what holds on an event day; a price sentence alone does not remove it.
  assert.deepEqual(eventLot({ name: 'Lot 1', notes: 'General' }, []), { name: 'Lot 1', note: 'General' });
  assert.deepEqual(eventLot({ name: 'Orange Lot', notes: 'Enter via Gate 1 (Friars Road). Bus and RV tailgate spots available; purchase in advance.' }, []), { name: 'Orange Lot', note: 'Enter via Gate 1 (Friars Road).' });
  assert.deepEqual(eventLot({ name: 'North Garage', notes: 'On 5th Street. Parking is $25.' }, []), { name: 'North Garage', note: 'On 5th Street.' });
  // Stored with a note and nothing survives: left off. Stored with NO note: the name alone.
  assert.equal(eventLot({ name: 'Big A Lot', notes: 'The only lot in which tailgating is permitted.' }, []), null);
  assert.deepEqual(eventLot({ name: 'Lot 9', notes: null }, []), { name: 'Lot 9', note: '' });
  assert.deepEqual(eventLot({ name: 'Lot 11', notes: '  ' }, []), { name: 'Lot 11', note: '' });
  // A lot NAME with a price or a tenant is not printed.
  assert.equal(eventSafeLotName('Lot 4', more), 'Lot 4');
  for (const bad of ['Lot 4 ($40)', 'Sox Players Lot', '', null]) assert.equal(eventSafeLotName(bad, more), '', String(bad));
});

test('transit notes: another event\'s trolley times, a fare offer and match-day service are cut; the stop itself stays', () => {
  // The Snapdragon Stadium note as the hub stores it (review 2026-11-18, finding 1).
  const note = 'The Green Line trolley stops at Stadium Station, beside the stadium. Pre-event Green Line trolleys depart stations starting at 4:14 PM every 15 minutes or better. Post-event trolleys depart Stadium Station starting at 8:37 PM. MTS increases Green Line frequency for matches. Family Weekend promo: on Saturdays and Sundays up to two kids (12 and under) ride free with a fare-paying adult on all MTS routes.';
  assert.equal(eventSafeTransitNote(note, ['San Diego FC']), 'The Green Line trolley stops at Stadium Station, beside the stadium.');
  for (const bad of ['Trains leave at 7 pm.', 'The fare is paid on board.', 'Kids ride free.', 'Extra service runs on game days.', 'Post-event buses load on 4th Street.', 'A $2.50 ticket covers the ride.']) assert.equal(eventSafeTransitNote(bad, []), '', bad);
  assert.equal(eventSafeTransitNote('Both light rail lines stop at U.S. Bank Stadium station. Buses serve downtown.', ['Vikings']), 'Both light rail lines stop at U.S. Bank Stadium station. Buses serve downtown.');
  assert.equal(eventSafeTransitNote(null, []), '');
});

test('several visits never read as one continuous run of dates', () => {
  const angel = ['2026-12-19', '2026-12-20', '2027-01-16', '2027-01-17', '2027-01-30', '2027-01-31', '2027-02-20', '2027-02-21'];
  assert.equal(showsPhrase(angel, 4), '8 shows between Dec 19, 2026 and Feb 21, 2027');
  assert.equal(showsPhrase(['2027-02-06', '2027-02-07', '2027-02-13'], 2), '3 shows between Feb 6 and Feb 13, 2027');
  // One visit keeps its days.
  assert.equal(showsPhrase(['2027-02-20', '2027-02-21'], 1), 'Sat, Feb 20 and Sun, Feb 21, 2027');
  assert.equal(showsPhrase([], 0), '');
  const d = stopDescription({ showName: 'Monster Jam', searchCity: 'Anaheim', venueName: 'Angel Stadium', dates: angel, visitCount: 4, bagRule: false, parking: true, transit: true, pitParty: false });
  assert.equal(d, 'Monster Jam has 8 shows between Dec 19, 2026 and Feb 21, 2027 at Angel Stadium in Anaheim. Showtimes and tickets, plus parking and transit.');
  // Nothing upcoming: the description promises nothing.
  assert.equal(stopDescription({ showName: 'Monster Jam', searchCity: 'Minneapolis', venueName: 'U.S. Bank Stadium', dates: [], bagRule: true, parking: true, transit: true, pitParty: false }), 'Monster Jam at U.S. Bank Stadium in Minneapolis. No upcoming dates are listed right now.');
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
  const pit = [{ visitId: '2027-02-20', performance: '2027-02-20T1700', start: '12:30', end: '15:30', sourceUrl: 'https://venue.example/news', observedAt: '2026-11-18T13:55:21.901Z' }];
  const faqs = stopFaqs({ showName: 'Monster Jam', searchCity: 'Minneapolis', venueName: 'U.S. Bank Stadium', upcoming, bag: bagBlockFor({ bagPolicy: { mode: 'pointer', sourceUrl: 'https://venue.example/bags' }, bagRules: [] }, 'U.S. Bank Stadium', ['2027-02-20']), pitParty: pit, gateTimes: [] });
  assert.deepEqual(faqs.map((f) => f.q), ['When is Monster Jam in Minneapolis?', 'When is the Pit Party at U.S. Bank Stadium?']);
  assert.equal(faqs[0].a, 'Saturday, February 20, 2027 at 5:00 PM and Sunday, February 21, 2027 at 3:00 PM, at U.S. Bank Stadium. Times are local to the venue.');
  assert.match(faqs[1].a, /Sat, Feb 20 \(5:00 PM show\): 12:30 PM to 3:30 PM/);
  const all = JSON.stringify(stopFaqs({ showName: 'Monster Jam', searchCity: 'Houston', venueName: 'NRG Stadium', upcoming, bag: null, pitParty: [], gateTimes: [{ visitId: '2027-02-20', performance: '2027-02-21T1500', opensAt: '13:30', sourceUrl: 'https://venue.example/e', observedAt: '2026-11-18T13:54:17.868Z' }] }));
  assert.match(all, /gates open at 1:30 PM/);
  for (const word of ['hour', 'loud', 'ear', 'stroller', 'toddler', 'under 2', 'ages', 'kids', 'children']) assert.equal(new RegExp(`\\b${word}`, 'i').test(all + JSON.stringify(faqs)), false, word);
  // A pointer is not an answer to "what is the bag policy".
  assert.equal(faqs.some((f) => /bag policy/i.test(f.q)), false);
  // Nothing upcoming, nothing stored: no questions at all.
  assert.deepEqual(stopFaqs({ showName: 'Monster Jam', searchCity: 'X', venueName: 'Y', upcoming: [], bag: null, pitParty: pit, gateTimes: [] }), []);
});
