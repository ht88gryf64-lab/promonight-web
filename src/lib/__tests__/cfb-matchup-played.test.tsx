// THE RIVALRY PAGE'S PLAYED STATE (2026-11 fix round). After its game a
// rivalry page says the game has been played, turns its lede and description
// to the past tense, and drops the trip section with its ticket, hotel and
// parking links. Its SportsEvent stays EventScheduled with no offers. The
// index tags a played game beside its date.
//
// Run with: TSX_TSCONFIG_PATH=tsconfig.test.json node --import tsx --experimental-test-module-mocks --test <this file>
import { test, mock } from 'node:test';
import assert from 'node:assert/strict';

mock.module('server-only', { namedExports: {} });
mock.module(new URL('../firebase.ts', import.meta.url).href, { namedExports: { db: {} } });
mock.module(new URL('../../components/cfb/rivalry/fonts.ts', import.meta.url).href, { namedExports: { barlowCondensed: { variable: 'font-cfb-condensed' } } });

const school = (id: string, name: string) => ({ id, name, shortName: name, primaryColor: '#0021A5', secondaryColor: '#FA4616', city: 'Gainesville', state: 'FL', conference: {}, ticketSlug: id });
function page(gameDate: string | null) {
  return {
    slug: 'florida-georgia',
    displayName: 'Florida vs Georgia',
    rivalry: { id: 'florida--georgia', name: 'Okefenokee Oar', schoolIds: ['florida', 'georgia'], trophy: 'Okefenokee Oar', seriesStartYear: 1915, trophyCreatedYear: 2009, dormant: false, source: 'https://example.com/source', updatedAt: '2026-08-01' },
    game: gameDate ? { id: 'g1', season: 2026, week: 9, date: gameDate, status: 'scheduled', homeSchoolId: 'florida', awaySchoolId: 'georgia', neutralSite: true, venueId: 'everbank', kickoff: { time: '3:30 PM', tz: 'ET', tbd: false }, broadcast: { network: 'CBS' }, verified: true } : null,
    schools: [school('florida', 'Florida'), school('georgia', 'Georgia')],
    venue: null,
    neutralVenueHubSlug: 'everbank-stadium',
    resolvedVenue: { name: 'EverBank Stadium', city: 'Jacksonville', state: 'FL', lat: 30.3239, lng: -81.6373, hubSlug: 'everbank-stadium', hubIndexable: true, source: 'venueHubs' },
    venueZone: 'America/New_York',
    siblings: [],
    siblingsAreSameWeek: false,
    conference: null,
    rivalrySentence: null,
  } as never;
}
async function html(el: React.ReactElement): Promise<string> {
  const { prerenderToNodeStream } = await import('react-dom/static');
  const { prelude } = await prerenderToNodeStream(el);
  let out = '';
  for await (const c of prelude) out += c;
  return out;
}
const text = (h: string) => h.replace(/<!-- -->/g, '').replace(/<[^>]+>/g, ' ').replace(/&#x27;/g, "'").replace(/\s+/g, ' ');
const AT = (iso: string) => mock.timers.enable({ apis: ['Date'], now: new Date(iso) });

test('matchupPlayed: the game day is before today; a missing or malformed date is never played', async () => {
  const { matchupPlayed } = await import('../cfb/matchup-description');
  assert.equal(matchupPlayed('2026-10-31', '2026-11-25'), true);
  assert.equal(matchupPlayed('2026-11-25', '2026-11-25'), false, 'game day itself is not played');
  assert.equal(matchupPlayed('2026-11-27', '2026-11-25'), false);
  for (const d of [null, undefined, '', '2026-10-3x', 'TBD']) assert.equal(matchupPlayed(d as never, '2026-11-25'), false);
});

test('the played read is the venue day, from the one function the head, the body and the JSON-LD share', async () => {
  const { matchupIsPlayed } = await import('../cfb/metadata');
  // 11:30 PM Pacific on game day is already tomorrow in UTC and Eastern: still not played at a Pacific venue.
  const pacific = { game: { date: '2026-11-21' }, venueZone: 'America/Los_Angeles' } as never;
  assert.equal(matchupIsPlayed(pacific, new Date('2026-11-22T07:30:00Z')), false);
  assert.equal(matchupIsPlayed(pacific, new Date('2026-11-22T08:30:00Z')), true, 'after midnight Pacific');
  assert.equal(matchupIsPlayed({ game: null, venueZone: null } as never, new Date('2026-11-25T12:00:00Z')), false);
});

test('description: past tense with the place, no kickoff time and no "tickets" once played', async () => {
  const { buildMatchupDescription } = await import('../cfb/matchup-description');
  const base = { displayName: 'Florida vs Georgia', schoolA: 'Florida', schoolB: 'Georgia', date: '2026-10-31', kickoff: '3:30 PM ET', venueName: 'EverBank Stadium', venueCity: 'Jacksonville' };
  const before = buildMatchupDescription(base);
  assert.match(before, /^Florida vs Georgia is Saturday, October 31, 2026\. Kickoff 3:30 PM ET/);
  const after = buildMatchupDescription({ ...base, played: true });
  assert.match(after, /^Florida vs Georgia was played Saturday, October 31, 2026 at EverBank Stadium in Jacksonville\./);
  assert.doesNotMatch(after, /Kickoff|3:30|[Tt]ickets|hotels|parking| is Saturday/);
  assert.ok(after.length <= 155, `${after.length} characters`);
  // A long pairing still fits, falling to a shorter tier, never cut mid-word.
  const long = buildMatchupDescription({ displayName: "Deep South's Oldest Rivalry", schoolA: 'Mississippi State', schoolB: 'North Carolina State', date: '2026-11-14', kickoff: null, venueName: 'Davis Wade Stadium at Scott Field', venueCity: 'Starkville', played: true });
  assert.ok(long.length <= 155 && /was played Saturday, November 14, 2026/.test(long) && /\.$/.test(long), long);
  // No date: there is nothing to have been played.
  assert.match(buildMatchupDescription({ ...base, date: null, played: true }), /No \d{4} meeting is scheduled|no scheduled \d{4} meeting/);
});

test('rendered, PLAYED (Florida vs Georgia, 2026-10-31, read on 2026-11-25): the line, the past tense, and no ticket, hotel or parking link', async () => {
  AT('2026-11-25T17:00:00Z');
  try {
    const { RivalryMatchupPage } = await import('../../components/cfb/rivalry/RivalryMatchupPage');
    const h = await html(<RivalryMatchupPage data={page('2026-10-31')} />);
    const t = text(h);
    assert.match(t, /This game has been played/);
    assert.equal((h.match(/data-matchup-played/g) ?? []).length, 1);
    assert.match(t, /Florida vs Georgia was played Saturday, October 31, 2026/);
    assert.doesNotMatch(t, /is Saturday, October 31/);
    assert.doesNotMatch(t, /Plan the trip|Find tickets|Find hotels|Reserve parking/);
    assert.doesNotMatch(h, /ticketnetwork|lusg\.net|spothero|expedia|hotels\.com/i, 'no affiliate destination anywhere in the markup');
    assert.doesNotMatch(t, /may earn a commission/i, 'no affiliate disclosure without affiliate links');
    assert.doesNotMatch(t, /Kickoff TBA|3:30 PM/);
    // What stays: the heading, both schools, the date, the stadium, the trophy.
    assert.match(t, /FLORIDA VS GEORGIA 2026|Florida vs Georgia 2026/i);
    assert.match(t, /EverBank Stadium/);
    assert.match(t, /Okefenokee Oar/);
  } finally { mock.timers.reset(); }
});

test('rendered, UPCOMING (the same page read on 2026-10-20): the trip section and its links are there, and no played line', async () => {
  AT('2026-10-20T17:00:00Z');
  try {
    const { RivalryMatchupPage } = await import('../../components/cfb/rivalry/RivalryMatchupPage');
    const h = await html(<RivalryMatchupPage data={page('2026-10-31')} />);
    const t = text(h);
    assert.doesNotMatch(t, /This game has been played/);
    assert.match(t, /Florida vs Georgia is Saturday, October 31, 2026/);
    assert.match(t, /Plan the trip/);
    assert.match(t, /Find tickets/);
    assert.match(h, /ticketnetwork/i);
    assert.match(t, /may earn a commission/i);
  } finally { mock.timers.reset(); }
});

test('JSON-LD: a played game stays EventScheduled, carries no offers, and its description is the past-tense one', async () => {
  AT('2026-11-25T17:00:00Z');
  try {
    const { buildRivalryMatchupJsonLd } = await import('../cfb/rivalry-jsonld');
    const schemas = buildRivalryMatchupJsonLd(page('2026-10-31')) as Array<Record<string, unknown>>;
    const event = schemas.find((s) => s['@type'] === 'SportsEvent')!;
    assert.ok(event, 'the SportsEvent is still emitted');
    assert.equal(event.eventStatus, 'https://schema.org/EventScheduled');
    assert.equal('offers' in event, false);
    assert.doesNotMatch(JSON.stringify(schemas), /"offers"/);
    assert.match(String(event.description), /was played Saturday, October 31, 2026/);
    const { buildCfbMatchupMetadata } = await import('../cfb/metadata');
    const md = buildCfbMatchupMetadata(page('2026-10-31'));
    assert.equal(md.description, event.description, 'the head and the schema give the one description');
    assert.deepEqual(md.title, { absolute: 'Florida vs Georgia 2026 | PromoNight' });
  } finally { mock.timers.reset(); }
});
