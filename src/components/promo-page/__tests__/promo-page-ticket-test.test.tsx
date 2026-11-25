// TICKET PARTNER TEST on the promo page (src/lib/ticket-test-link.ts; Gate 0
// rulings 1, 3 and 4): the route passes the page team's resolution; the
// primary button and the per-date links follow it, "Also on Ticketmaster" is
// gone on both arms, one shared line sits under the button.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { renderToStaticMarkup } from 'react-dom/server';
import { PromoPageView } from '../PromoPageView';
import type { PromoPage, PromoPageContext } from '../../../lib/promo-pages';
import type { PromoPageRow } from '../../../lib/promo-page-copy';
import type { Team } from '../../../lib/types';
import type { TicketTestResolution } from '../../../lib/ticket-test-link';

const TEAM = { id: 'detroit-red-wings', name: 'Red Wings', city: 'Detroit', league: 'NHL', sportSlug: 'nhl', abbreviation: 'DET', primaryColor: '#000', secondaryColor: '#fff', division: 'Atlantic' } as unknown as Team;
const EV = (id: number, slug: string) => `https://www.ticketnetwork.com/tickets/${id}/${slug}`;

const row = (over: Partial<PromoPageRow>): PromoPageRow => ({
  promoId: 'p1', date: '2026-11-18', title: 'Original Six Matchup', description: 'An Original Six night.', type: 'theme',
  displayTime: '7:30 PM', displayOpponent: 'Bruins', highlight: false, attendanceCap: null, presentedBy: null,
  whileSuppliesLast: null, gateOpenTime: null, ageRestriction: null, redemptionLocation: null, ticketPackageRequired: null,
  ticketPackageName: null, sourceUrl: null, pageSlug: 'original-six-matchup', pageSeason: '2026-27', themeKey: 'none',
  imageTier: null, imageRef: null, imageSourceUrl: null, imageCredit: null, updatedAt: '2026-11-01T00:00:00.000Z',
  tombstoned: false, tombstonedAt: null, tnEventUrl: null, ...over,
});

function page(rows: PromoPageRow[], today: string, team: Team = TEAM): PromoPage {
  const primary = rows.find((r) => r.date >= today) ?? rows[rows.length - 1];
  return { team, slug: rows[0].pageSlug, season: '2026-27', rows, removedRows: [], removedDates: [], state: 'live', primary, dates: rows.map((r) => r.date), updatedAt: null, removedAt: null, canonicalSlug: null };
}
const CTX: PromoPageContext = { game: null, timeline: null, venueGiveaways: null, venue: null, hub: null, beforeYouGo: [], quickFacts: [], location: null, coords: null, roof: null, forecast: null, formerNames: [], observedAt: null, alsoAtGame: [], nextTeamPromos: [], crossTeam: null, previousEditions: [], previousEdition: null, nextEdition: null, short: null, ebayListings: [] };

const SH = (m: number, d: number, id: number) => `https://www.stubhub.com/detroit-red-wings-detroit-tickets-${m}-${d}-2026/event/${id}/`;
const SH_NOV = SH(11, 18, 161328900);
const SH_DEC = SH(12, 12, 161328926);
const HAWKS = EV(8138700, 'detroit-red-wings-vs-chicago-blackhawks-tickets-sat-dec-12-2026-little-caesars-arena');
const NOTE = 'PromoNight may earn a commission on ticket purchases made through these links. Resale prices may differ from face value.';
const SH_DAY: TicketTestResolution = { partner: 'stubhub', phase: 'a', pairId: 'nhl-01', arm: 'stubhub_first', league: 'nhl', pubref: 'web-nhl-a' };
const TN_DAY: TicketTestResolution = { ...SH_DAY, partner: 'ticketnetwork', phase: 'b', pubref: 'web-nhl-b' };
const partnerize = (u: string, pubref = 'web-nhl-a') => `https://stubhub.prf.hn/click/camref:1101l6zbdB/pubref:${pubref}/destination:${encodeURIComponent(u)}`;

const render = (rows: PromoPageRow[], ticketTest: TicketTestResolution | null | undefined, today = '2026-11-02') =>
  renderToStaticMarkup(<PromoPageView page={page(rows, today)} ctx={CTX} today={today} {...(ticketTest === undefined ? {} : { ticketTest })} />).replace(/&amp;/g, '&');
const ticketHrefs = (h: string) => [...h.matchAll(/<a ([^>]*)>Get Tickets<\/a>/g)].map((m) => /href="([^"]+)"/.exec(m[1])![1]);
const jsonLd = (h: string) => [...h.matchAll(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/g)].map((m) => m[1]).join('\n');
const SERIES = [row({ promoId: 'p1', date: '2026-11-18', shEventUrl: SH_NOV }), row({ promoId: 'p2', date: '2026-12-12', displayOpponent: 'Blackhawks', tnEventUrl: HAWKS, shEventUrl: SH_DEC })];

test('no test: the page is byte for byte the page without the prop, with "Also on Ticketmaster" and no StubHub link, whatever the rows carry', () => {
  const plain = render(SERIES, undefined);
  assert.equal(plain, render(SERIES, null));
  assert.ok(plain.includes('>Also on Ticketmaster</a>') && !plain.includes(NOTE));
  assert.doesNotMatch(plain, /stubhub/i, 'a stored StubHub event is never linked or printed outside the test');
});

test('StubHub day: the primary and every per-date link are Partnerize links to that date\'s event; no other marketplace; the shared line', () => {
  const h = render(SERIES, SH_DAY);
  assert.deepEqual(ticketHrefs(h).sort(), [partnerize(SH_NOV), partnerize(SH_NOV), partnerize(SH_DEC)].sort(), 'the primary (next date) and one link per date');
  assert.doesNotMatch(h, /Also on Ticketmaster|ticketnetwork\.lusg\.net|ticketmaster\.com|TicketNetwork is a resale marketplace|resold by other sellers/);
  assert.equal(h.split(NOTE).length - 1, 1);
  assert.match(h, /aria-label="Get Tickets for [^"]* on StubHub"/);
  assert.doesNotMatch(jsonLd(h), /stubhub|prf\.hn|lusg\.net/, 'no affiliate or partner URL in structured data');
  assert.doesNotMatch(h, /\$\d/);
});

test('TicketNetwork day: the TicketNetwork links as before, no "Also on Ticketmaster", the same shared line, no StubHub link', () => {
  const before = render(SERIES, null);
  const h = render(SERIES, TN_DAY);
  const tnBefore = ticketHrefs(before);
  assert.deepEqual(ticketHrefs(h), tnBefore, 'exactly the TicketNetwork links the page carried');
  assert.ok(tnBefore.every((u) => u.startsWith('https://ticketnetwork.lusg.net/')));
  assert.doesNotMatch(h, /Also on Ticketmaster|stubhub|TicketNetwork is a resale marketplace|resold by other sellers/);
  assert.equal(h.split(NOTE).length - 1, 1);
});

test('StubHub day, one date unmatched: that date falls back to its TicketNetwork link, the matched date stays StubHub', () => {
  const rows = [row({ promoId: 'p1', date: '2026-11-18' }), row({ promoId: 'p2', date: '2026-12-12', displayOpponent: 'Blackhawks', tnEventUrl: HAWKS, shEventUrl: SH_DEC })];
  const hrefs = ticketHrefs(render(rows, SH_DAY));
  assert.equal(hrefs.filter((u) => u === partnerize(SH_DEC)).length, 1);
  assert.equal(hrefs.filter((u) => u.startsWith('https://ticketnetwork.lusg.net/')).length, 2, 'the primary (the unmatched next date) and its per-date link');
  assert.doesNotMatch(render(rows, SH_DAY), /Also on Ticketmaster/);
});

test('StubHub day, a played date: its event is not linked', () => {
  const h = render(SERIES, SH_DAY, '2026-11-20');
  assert.deepEqual([...new Set(ticketHrefs(h))], [partnerize(SH_DEC)]);
});
