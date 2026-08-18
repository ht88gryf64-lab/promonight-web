// JSON-LD builders for the rivalry family. The load-bearing invariant is the
// verify gate: kickoff time and broadcast reach the SportsEvent ONLY on a
// verified:true game — an unverified game emits a bare date and no network,
// never a placeholder, never a guessed time.

import test from 'node:test';
import assert from 'node:assert/strict';
import {
  buildRivalryIndexJsonLd,
  buildRivalryMatchupJsonLd,
  sportsEventStartDate,
} from '@/lib/cfb/rivalry-jsonld';
import type { MatchupPage } from '@/lib/cfb/matchups';
import type { RivalryIndexRow } from '@/lib/cfb/rivalry-index';

// ── fixtures ─────────────────────────────────────────────────────────────────

const kickoff = (time: string, tz: string, tbd = false) => ({ time, tz, tbd, windowFlex: null });

function game(over: Record<string, unknown> = {}) {
  return {
    id: 'g1',
    season: 2026,
    week: 12,
    date: '2026-11-27',
    status: 'scheduled',
    homeSchoolId: 'ole-miss',
    awaySchoolId: 'mississippi-state',
    neutralSite: false,
    venueId: '',
    kickoff: kickoff('TBD', 'TBD', true),
    broadcast: { network: 'TBD', confirmed: false },
    conferenceGame: true,
    rivalryId: 'mississippi-state--ole-miss',
    themeDesignations: [],
    source: '',
    confidence: 'HIGH',
    fetchedAt: '',
    verified: false,
    verification: null,
    ...over,
  } as unknown as NonNullable<MatchupPage['game']>;
}

const school = (id: string, name: string) =>
  ({ id, name, shortName: name, mascot: 'Mascots', primaryColor: '#123456', secondaryColor: '#654321' }) as unknown as MatchupPage['schools'][0];

function page(over: Partial<MatchupPage> = {}): MatchupPage {
  return {
    slug: 'egg-bowl',
    displayName: 'Egg Bowl',
    rivalry: {
      id: 'mississippi-state--ole-miss',
      name: 'Egg Bowl',
      schoolIds: ['mississippi-state', 'ole-miss'],
      trophy: 'Golden Egg',
      seriesStartYear: 1901,
      trophyCreatedYear: null,
      dormant: false,
      source: '',
      updatedAt: '',
    },
    game: game(),
    schools: [school('mississippi-state', 'Mississippi State'), school('ole-miss', 'Ole Miss')],
    venue: null,
    neutralVenueHubSlug: null,
    resolvedVenue: {
      name: 'Vaught-Hemingway Stadium',
      city: 'Oxford',
      state: 'MS',
      lat: 34.36,
      lng: -89.53,
      hubSlug: 'vaught-hemingway-stadium',
      hubIndexable: true,
      source: 'cfbVenues',
    },
    conference: 'SEC',
    rivalrySentence: null,
    siblings: [],
    siblingsAreSameWeek: false,
    ...over,
  } as MatchupPage;
}

const findType = (schemas: Record<string, unknown>[], type: string) =>
  schemas.find((s) => s['@type'] === type) as Record<string, unknown> | undefined;

// ── sportsEventStartDate: the verify gate ────────────────────────────────────

test('verified game with announced kickoff emits time with a DST-correct offset', () => {
  // Late November: Central is CST, UTC-6.
  assert.equal(
    sportsEventStartDate(game({ verified: true, kickoff: kickoff('11:00 AM', 'CT') })),
    '2026-11-27T11:00:00-06:00',
  );
  // September: Central is CDT, UTC-5.
  assert.equal(
    sportsEventStartDate(game({ verified: true, date: '2026-09-19', kickoff: kickoff('6:30 PM', 'CT') })),
    '2026-09-19T18:30:00-05:00',
  );
});

test('an IANA tz stored per the type contract also resolves', () => {
  assert.equal(
    sportsEventStartDate(game({ verified: true, date: '2026-11-28', kickoff: kickoff('12:00 PM', 'America/New_York') })),
    '2026-11-28T12:00:00-05:00',
  );
});

test('verified:false emits the bare date even when a time is stored', () => {
  assert.equal(
    sportsEventStartDate(game({ verified: false, kickoff: kickoff('11:00 AM', 'CT') })),
    '2026-11-27',
  );
});

test('verified:true with tbd kickoff, unparseable time, or unknown tz emits the bare date', () => {
  assert.equal(sportsEventStartDate(game({ verified: true })), '2026-11-27'); // tbd:true fixture default
  assert.equal(sportsEventStartDate(game({ verified: true, kickoff: kickoff('noon-ish', 'CT') })), '2026-11-27');
  assert.equal(sportsEventStartDate(game({ verified: true, kickoff: kickoff('11:00 AM', 'XX') })), '2026-11-27');
});

test('an invalid slash-containing tz degrades to the bare date instead of crashing the render', () => {
  assert.equal(sportsEventStartDate(game({ verified: true, kickoff: kickoff('11:00 AM', 'Bad/Zone') })), '2026-11-27');
});

// ── buildRivalryMatchupJsonLd ────────────────────────────────────────────────

test('BreadcrumbList backs the visual breadcrumb: /cfb, /cfb/rivalries, then the page', () => {
  const bc = findType(buildRivalryMatchupJsonLd(page()), 'BreadcrumbList')!;
  const items = bc.itemListElement as Array<Record<string, unknown>>;
  assert.equal(items.length, 3);
  assert.deepEqual(items.map((i) => i.name), ['College Football', 'Rivalries', 'Egg Bowl 2026']);
  assert.equal(items[0].item, 'https://www.getpromonight.com/cfb');
  assert.equal(items[1].item, 'https://www.getpromonight.com/cfb/rivalries');
  assert.equal('item' in items[2], false); // final crumb carries no URL
});

test('unverified game: SportsEvent has a bare-date startDate and no broadcast', () => {
  const ev = findType(buildRivalryMatchupJsonLd(page()), 'SportsEvent')!;
  assert.equal(ev.startDate, '2026-11-27');
  assert.equal('subjectOf' in ev, false);
  assert.equal(ev.eventStatus, 'https://schema.org/EventScheduled');
});

test('verified game with confirmed network emits kickoff and BroadcastEvent', () => {
  const p = page({
    game: game({ verified: true, kickoff: kickoff('11:00 AM', 'CT'), broadcast: { network: 'ABC', confirmed: true } }),
  });
  const ev = findType(buildRivalryMatchupJsonLd(p), 'SportsEvent')!;
  assert.equal(ev.startDate, '2026-11-27T11:00:00-06:00');
  const subjectOf = ev.subjectOf as Record<string, unknown>;
  assert.equal(subjectOf['@type'], 'BroadcastEvent');
  assert.deepEqual(subjectOf.publishedOn, { '@type': 'BroadcastService', name: 'ABC' });
});

test('the verify gate covers the description too: an unverified stored time never rides into the SportsEvent prose', () => {
  // verified:false with a CONCRETE stored time (the flagged-date-error pipeline
  // state, distinct from the tbd:true coincidence in today's corpus).
  const p = page({ game: game({ verified: false, kickoff: kickoff('11:00 AM', 'CT') }) });
  const ev = findType(buildRivalryMatchupJsonLd(p), 'SportsEvent')!;
  // The builder's TBA tiers phrase it as either "Kickoff time is not announced
  // yet." or the shorter "Kickoff time TBA." depending on length fit.
  assert.match(ev.description as string, /not announced yet|Kickoff time TBA/);
  assert.equal(/11:00/.test(ev.description as string), false);
  // The same time on a verified game DOES reach the prose.
  const pv = page({ game: game({ verified: true, kickoff: kickoff('11:00 AM', 'CT') }) });
  const evv = findType(buildRivalryMatchupJsonLd(pv), 'SportsEvent')!;
  assert.match(evv.description as string, /11:00 AM CT/);
});

test('broadcast is withheld when unconfirmed, when TBD, or when the game is unverified', () => {
  const cases = [
    game({ verified: true, broadcast: { network: 'ABC', confirmed: false } }),
    game({ verified: true, broadcast: { network: 'TBD', confirmed: true } }),
    game({ verified: false, broadcast: { network: 'ABC', confirmed: true } }),
  ];
  for (const g of cases) {
    const ev = findType(buildRivalryMatchupJsonLd(page({ game: g })), 'SportsEvent')!;
    assert.equal('subjectOf' in ev, false);
  }
});

test('home and away teams resolve tracked names and prettify untracked ids', () => {
  const p = page({ schools: [null, school('ole-miss', 'Ole Miss')] });
  const ev = findType(buildRivalryMatchupJsonLd(p), 'SportsEvent')!;
  assert.deepEqual(ev.homeTeam, { '@type': 'SportsTeam', name: 'Ole Miss' });
  assert.deepEqual(ev.awayTeam, { '@type': 'SportsTeam', name: 'Mississippi State' });
});

test('location carries Place + PostalAddress; address is dropped when city and state are both absent', () => {
  const ev = findType(buildRivalryMatchupJsonLd(page()), 'SportsEvent')!;
  assert.deepEqual(ev.location, {
    '@type': 'Place',
    name: 'Vaught-Hemingway Stadium',
    address: { '@type': 'PostalAddress', addressLocality: 'Oxford', addressRegion: 'MS', addressCountry: 'US' },
  });

  const bare = page();
  bare.resolvedVenue = { ...bare.resolvedVenue!, city: null, state: null };
  const ev2 = findType(buildRivalryMatchupJsonLd(bare), 'SportsEvent')!;
  assert.deepEqual(ev2.location, { '@type': 'Place', name: 'Vaught-Hemingway Stadium' });
});

test('a dormant rivalry (no game) emits only the BreadcrumbList', () => {
  const schemas = buildRivalryMatchupJsonLd(page({ game: null }));
  assert.equal(schemas.length, 1);
  assert.equal(schemas[0]['@type'], 'BreadcrumbList');
});

test('a canceled game maps to EventCancelled, never silently EventScheduled', () => {
  const ev = findType(buildRivalryMatchupJsonLd(page({ game: game({ status: 'canceled' }) })), 'SportsEvent')!;
  assert.equal(ev.eventStatus, 'https://schema.org/EventCancelled');
});

// ── buildRivalryIndexJsonLd ──────────────────────────────────────────────────

const row = (slug: string, date: string | null): RivalryIndexRow =>
  ({ slug, name: slug, date, matchup: 'A vs B', venueName: null, trophy: null, colors: [null, null] });

test('ItemList mirrors the ordered rows exactly: count, positions and URLs', () => {
  const rows = [row('iron-bowl', '2026-11-28'), row('egg-bowl', '2026-11-27'), row('dormant', null)];
  const list = findType(buildRivalryIndexJsonLd(rows, []), 'ItemList')!;
  assert.equal(list.numberOfItems, 3);
  const items = list.itemListElement as Array<Record<string, unknown>>;
  assert.deepEqual(items.map((i) => i.position), [1, 2, 3]);
  assert.equal(items[0].url, 'https://www.getpromonight.com/cfb/rivalries/iron-bowl');
  assert.equal(items[0].name, 'iron-bowl 2026');
});

test('CollectionPage carries the WebSite isPartOf and the canonical url', () => {
  const cp = findType(buildRivalryIndexJsonLd([], []), 'CollectionPage')!;
  assert.equal(cp.url, 'https://www.getpromonight.com/cfb/rivalries');
  assert.deepEqual(cp.isPartOf, { '@type': 'WebSite', name: 'PromoNight', url: 'https://www.getpromonight.com' });
});

test('FAQPage mirrors the faqs and is omitted when there are none', () => {
  const faqs = [{ question: 'Q1?', answer: 'A1.' }];
  const withFaq = buildRivalryIndexJsonLd([], faqs);
  const fp = findType(withFaq, 'FAQPage')!;
  assert.deepEqual(fp.mainEntity, [
    { '@type': 'Question', name: 'Q1?', acceptedAnswer: { '@type': 'Answer', text: 'A1.' } },
  ]);
  assert.equal(findType(buildRivalryIndexJsonLd([], []), 'FAQPage'), undefined);
});
