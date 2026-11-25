// THE STOP PAGE'S PAST STATE, before the first real one (Anaheim, Dec 19 and
// 20, 2026). eventStopHead and the rendered EventStopView over a stop built
// through the real mappers: partly played, then fully played.
//
// Run with: TSX_TSCONFIG_PATH=tsconfig.test.json node --import tsx --experimental-test-module-mocks --test <this file>
import { test, mock } from 'node:test';
import assert from 'node:assert/strict';

mock.module('server-only', { namedExports: {} });
// No Firestore: the stop is built from raw documents by the real mapper.
mock.module(new URL('../../firebase.ts', import.meta.url).href, { namedExports: { db: {} } });

const rawPerf = (date: string, hhmm: string, offset: string, eventId: number) => ({
  id: `${date}T${hhmm.replace(':', '')}`,
  data: { date, startTime: hhmm, startsAt: `${date}T${hhmm}:00${offset}`, visitId: date <= '2026-12-20' ? '2026-12-19' : '2027-01-16', providerEvents: { ticketnetwork: { eventId, eventDate: date, status: 'onsale' } } },
});
const VISITS = [
  { id: '2026-12-19', data: { startDate: '2026-12-19', endDate: '2026-12-20' } },
  { id: '2027-01-16', data: { startDate: '2027-01-16', endDate: '2027-01-17' } },
];
const PERFS = [rawPerf('2026-12-19', '16:30', '-08:00', 9000001), rawPerf('2026-12-20', '14:30', '-08:00', 9000002), rawPerf('2027-01-16', '19:00', '-08:00', 9000003), rawPerf('2027-01-17', '15:00', '-08:00', 9000004)];
const HUB = { slug: 'angel-stadium', name: 'Angel Stadium', city: 'Anaheim', state: 'California', lat: null, lng: null, publicTransit: null, parkingLots: [], sources: {}, tenants: [] };

async function build() {
  const { mapEventStop } = await import('../event-stops');
  const stop = mapEventStop('monster-jam~angel-stadium', { show: 'monster-jam', venueHubId: 'angel-stadium', pageSlug: 'angel-stadium', searchCity: 'Anaheim', timezone: 'America/Los_Angeles' }, VISITS, PERFS);
  assert.ok(stop, 'the fixture is a real stop by the mapper');
  return stop!;
}
async function html(el: React.ReactElement): Promise<string> {
  const { prerenderToNodeStream } = await import('react-dom/static');
  const { prelude } = await prerenderToNodeStream(el);
  let out = '';
  for await (const c of prelude) out += c;
  return out;
}
const text = (h: string) => h.replace(/<!-- -->/g, '').replace(/<script[\s\S]*?<\/script>/g, '').replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ');

test('before the first show: the run crosses New Year, so the title says 2026-27', async () => {
  const { eventStopHead } = await import('../../../components/events/EventStopView');
  const head = eventStopHead(await build(), HUB as never, new Date('2026-11-25T18:00:00Z'));
  assert.equal(head.year, '2026-27');
  assert.match(head.title, /^Monster Jam Anaheim 2026-27: Dates(?:, Tickets and Bag Policy| and Tickets)$/);
  assert.equal(head.upcoming.length, 4);
  assert.equal(head.firstDate, '2026-12-19');
  assert.equal(head.indexable, true);
});

test('after the December shows: they are past by the clock, the title is the single year left, and the head still promises dates and tickets', async () => {
  const { eventStopHead } = await import('../../../components/events/EventStopView');
  // 2:31 PM Pacific on Dec 20: the last December show has just started.
  const head = eventStopHead(await build(), HUB as never, new Date('2026-12-20T22:31:00Z'));
  assert.deepEqual(head.upcoming.map((p) => p.date), ['2027-01-16', '2027-01-17']);
  assert.equal(head.year, '2027', 'the upcoming run is January alone');
  assert.match(head.title, /^Monster Jam Anaheim 2027: /);
  assert.equal(head.tl.lastVisit?.visit.visitId, '2026-12-19', 'December is now the last visit');
  assert.equal(head.firstDate, '2027-01-16');
});

test('everything played: no dates or tickets promised, no countdown, still indexable as a played stop', async () => {
  const { eventStopHead } = await import('../../../components/events/EventStopView');
  const stop = await build();
  const head = eventStopHead(stop, HUB as never, new Date('2027-01-18T08:00:00Z'));
  assert.equal(head.upcoming.length, 0);
  assert.equal(head.title, 'Monster Jam Anaheim at Angel Stadium', 'the head drops "Dates and Tickets" and the year');
  assert.doesNotMatch(head.title, /Tickets|Dates|20\d\d/);
  assert.equal(head.firstDate, null);
  assert.equal(head.countdown, null);
  assert.equal(head.tl.lastVisit?.visit.visitId, '2027-01-16');
  assert.equal(head.tl.returnsYear, null, 'no later visit is stored, so nothing says it returns');
  assert.equal(head.indexable, true);
  assert.doesNotMatch(head.description, /tickets/i);
});

test('rendered, everything played: no ticket link, no parking offer, and the last visit is shown', async () => {
  const { EventStopView } = await import('../../../components/events/EventStopView');
  const stop = await build();
  const played = await html(<EventStopView stop={stop} hub={HUB as never} now={new Date('2027-01-18T08:00:00Z')} teams={[]} otherStops={[]} floor={{ ok: true, bag: false, parking: false, transit: false }} />);
  assert.doesNotMatch(played, /ticketnetwork\.lusg\.net|ticketnetwork\.com\/tickets/, 'no ticket link for a show that has been played');
  assert.doesNotMatch(played, /spothero/i);
  assert.equal((played.match(/data-performance=/g) ?? []).length, 0, 'no performance rows offered');
  assert.match(text(played), /Last visit/i);
  // The same stop before its first show DOES offer all four.
  const before = await html(<EventStopView stop={stop} hub={HUB as never} now={new Date('2026-11-25T18:00:00Z')} teams={[]} otherStops={[]} floor={{ ok: true, bag: false, parking: false, transit: false }} />);
  assert.equal((before.match(/data-performance=/g) ?? []).length, 4);
  assert.equal((before.match(/ticketnetwork\.lusg\.net/g) ?? []).length >= 4, true);
  // Partly played: only January's two are offered.
  const mid = await html(<EventStopView stop={stop} hub={HUB as never} now={new Date('2026-12-20T22:31:00Z')} teams={[]} otherStops={[]} floor={{ ok: true, bag: false, parking: false, transit: false }} />);
  assert.deepEqual([...mid.matchAll(/data-performance="([^"]+)"/g)].map((m) => m[1]), ['2027-01-16T1900', '2027-01-17T1500']);
});
