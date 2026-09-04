// Pure-logic coverage for the /venues index grouping and the league-hub venue
// link selection (src/lib/venue-index.ts). No firebase / server-only mocks
// needed: the module is deliberately free of those imports. Run with:
//   node --import tsx --experimental-test-module-mocks --test <this file>

import { test } from 'node:test';
import assert from 'node:assert';
import {
  groupVenueIndexEntries,
  collectVenueLinksForTeams,
  VENUE_INDEX_SECTIONS,
  type VenueIndexEntry,
  type HubVenueLinkSource,
} from '../venue-index';

const entry = (over: Partial<VenueIndexEntry>): VenueIndexEntry => ({
  slug: 'x',
  name: 'X',
  city: null,
  state: null,
  topics: [],
  leagues: [],
  ...over,
});

test('groupVenueIndexEntries: multi-league building appears once per hosting league section', () => {
  const sections = groupVenueIndexEntries([
    entry({ slug: 'crypto-com-arena', name: 'Crypto.com Arena', leagues: ['NBA', 'NHL', 'WNBA'] }),
    entry({ slug: 'dodger-stadium', name: 'Dodger Stadium', leagues: ['MLB'] }),
  ]);
  const byLeague = new Map(sections.map((s) => [s.league, s.venues.map((v) => v.slug)]));
  assert.deepStrictEqual(byLeague.get('MLB'), ['dodger-stadium']);
  assert.deepStrictEqual(byLeague.get('NBA'), ['crypto-com-arena']);
  assert.deepStrictEqual(byLeague.get('NHL'), ['crypto-com-arena']);
  assert.deepStrictEqual(byLeague.get('WNBA'), ['crypto-com-arena']);
});

test('groupVenueIndexEntries: empty sections are dropped and order follows VENUE_INDEX_SECTIONS', () => {
  const sections = groupVenueIndexEntries([
    entry({ slug: 'lambeau-field', name: 'Lambeau Field', leagues: ['NFL'] }),
    entry({ slug: 'fenway-park', name: 'Fenway Park', leagues: ['MLB'] }),
  ]);
  assert.deepStrictEqual(sections.map((s) => s.league), ['MLB', 'NFL']);
  const order = VENUE_INDEX_SECTIONS.map((s) => s.league);
  assert.ok(order.indexOf('MLB') < order.indexOf('NFL'));
});

test('groupVenueIndexEntries: sections sort by name; unknown/empty leagues land in the catch-all', () => {
  const sections = groupVenueIndexEntries([
    entry({ slug: 'wrigley-field', name: 'Wrigley Field', leagues: ['MLB'] }),
    entry({ slug: 'camden-yards', name: 'Camden Yards', leagues: ['MLB'] }),
    entry({ slug: 'mystery-dome', name: 'Mystery Dome', leagues: ['XFL'] }),
    entry({ slug: 'tenantless-park', name: 'Tenantless Park', leagues: [] }),
  ]);
  const mlb = sections.find((s) => s.league === 'MLB');
  assert.deepStrictEqual(mlb?.venues.map((v) => v.slug), ['camden-yards', 'wrigley-field']);
  const other = sections.find((s) => s.league === 'OTHER');
  assert.deepStrictEqual(other?.venues.map((v) => v.slug), ['mystery-dome', 'tenantless-park']);
  // The catch-all is last.
  assert.strictEqual(sections[sections.length - 1].league, 'OTHER');
});

const src = (over: Partial<HubVenueLinkSource>): HubVenueLinkSource => ({
  slug: 'x',
  displayName: 'X',
  indexable: true,
  city: null,
  ...over,
});

test('collectVenueLinksForTeams: dedupes shared buildings and drops below-floor + unknown teams', () => {
  const metlife = src({ slug: 'metlife-stadium', displayName: 'MetLife Stadium', city: 'East Rutherford' });
  const held = src({ slug: 'highmark-stadium', displayName: 'Highmark Stadium', indexable: false });
  const map = new Map<string, HubVenueLinkSource>([
    ['new-york-giants', metlife],
    ['new-york-jets', metlife],
    ['buffalo-bills', held],
    ['dallas-cowboys', src({ slug: 'att-stadium', displayName: 'AT&T Stadium', city: 'Arlington' })],
  ]);
  const links = collectVenueLinksForTeams(map, [
    'new-york-giants',
    'new-york-jets',
    'buffalo-bills',
    'dallas-cowboys',
    'team-with-no-hub',
  ]);
  // Sorted by name, MetLife once, no held building, no phantom team.
  assert.deepStrictEqual(links.map((l) => l.slug), ['att-stadium', 'metlife-stadium']);
  assert.strictEqual(links[1].city, 'East Rutherford');
});

test('collectVenueLinksForTeams: empty team list yields empty output', () => {
  assert.deepStrictEqual(collectVenueLinksForTeams(new Map(), []), []);
});
