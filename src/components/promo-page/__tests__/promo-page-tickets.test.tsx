// The promo page's ticket links (rulings 2026-11-02), in the server HTML:
//  - the primary "Get tickets" is TicketNetwork, wrapping the primary row's
//    event page when matched, else the team performer page; subId1
//    web_promo_page_{team};
//  - Ticketmaster is the secondary text link "Also on Ticketmaster";
//  - JSON-LD offers.url is the primary href;
//  - a series gives each date still to be played its own "Tickets" link.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { renderToStaticMarkup } from 'react-dom/server';
import { PromoPageView } from '../PromoPageView';
import type { PromoPage, PromoPageContext } from '../../../lib/promo-pages';
import type { PromoPageRow } from '../../../lib/promo-page-copy';
import type { Team } from '../../../lib/types';

const TEAM = { id: 'detroit-red-wings', name: 'Red Wings', city: 'Detroit', league: 'NHL', sportSlug: 'nhl', abbreviation: 'DET', primaryColor: '#000', secondaryColor: '#fff', division: 'Atlantic' } as unknown as Team;
const EV = (id: number, slug: string) => `https://www.ticketnetwork.com/tickets/${id}/${slug}`;
const BRUINS = EV(8138650, 'detroit-red-wings-vs-boston-bruins-tickets-wed-nov-18-2026-little-caesars-arena');
const HAWKS = EV(8138700, 'detroit-red-wings-vs-chicago-blackhawks-tickets-sat-dec-12-2026-little-caesars-arena');
const PREFIX = 'https://ticketnetwork.lusg.net/c/7236189/120057/2322';
// subId3 is the page slug (ruling 2026-11-04); every fixture below is original-six-matchup.
const tn = (landing: string, sub = 'web_promo_page_detroit-red-wings', slug = 'original-six-matchup') => `${PREFIX}?u=${encodeURIComponent(landing)}&partnerpropertyid=8313917&MediaPartnerPropertyId=8313917&subId1=${sub}&subId3=${slug}`;
const tnDate = (landing: string) => tn(landing, 'web_promo_date_detroit-red-wings');
const PERFORMER = 'https://www.ticketnetwork.com/e/performers/detroit-red-wings-tickets';

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
const CTX: PromoPageContext = { venue: null, hub: null, quickFacts: [], location: null, coords: null, formerNames: [], observedAt: null, alsoAtGame: [], nextTeamPromos: [], crossTeam: null, previousEdition: null, short: null };
const render = (rows: PromoPageRow[], today = '2026-11-02', team: Team = TEAM) => renderToStaticMarkup(<PromoPageView page={page(rows, today, team)} ctx={CTX} today={today} />).replace(/&amp;/g, '&');

function anchor(html: string, text: string): string {
  const at = html.indexOf(`>${text}</a>`);
  assert.ok(at >= 0, `an anchor reading "${text}"`);
  const open = html.lastIndexOf('<a ', at);
  return /href="([^"]+)"/.exec(html.slice(open, at))?.[1] as string;
}
const anchors = (html: string, text: string) => html.split(`>${text}</a>`).length - 1;
const eventOffers = (html: string) => {
  const out: [string, string][] = [];
  for (const m of html.matchAll(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/g)) {
    const d = JSON.parse(m[1]);
    if (d['@type'] === 'Event' && d.offers) out.push([d.startDate, d.offers.url]);
  }
  return out;
};
const offersUrl = (html: string) => eventOffers(html)[0]?.[1] ?? null;

test('matched single-date page: primary wraps the event, Ticketmaster is the secondary text link, offers.url follows', () => {
  const html = render([row({ tnEventUrl: BRUINS })]);
  assert.equal(anchor(html, 'Get tickets'), tn(BRUINS));
  assert.match(anchor(html, 'Also on Ticketmaster'), /ticketmaster\.com/);
  assert.equal(offersUrl(html), tn(BRUINS));
  assert.equal(anchors(html, 'Tickets'), 0); // a single date carries no per-date link
});

test('unmatched page: primary falls back to the team performer page', () => {
  const html = render([row({ tnEventUrl: null })]);
  assert.equal(anchor(html, 'Get tickets'), tn(PERFORMER));
  assert.equal(offersUrl(html), tn(PERFORMER));
  assert.equal(anchors(html, 'Also on Ticketmaster'), 1);
});

test('series: primary is the next upcoming date; every upcoming date links its own event, unmatched dates the performer page, played dates none', () => {
  const rows = [
    row({ promoId: 'a', date: '2026-10-20', displayOpponent: 'Rangers', tnEventUrl: EV(1, 'played') }),
    row({ promoId: 'b', date: '2026-11-18', tnEventUrl: BRUINS }),
    row({ promoId: 'c', date: '2026-12-12', displayOpponent: 'Blackhawks', tnEventUrl: HAWKS }),
    row({ promoId: 'd', date: '2027-01-30', displayOpponent: 'Maple Leafs', tnEventUrl: null }),
  ];
  const html = render(rows);
  assert.equal(anchor(html, 'Get tickets'), tn(BRUINS));
  const perDate = [...html.matchAll(/<a [^>]*href="([^"]+)"[^>]*>Tickets<\/a>/g)].map((m) => m[1]);
  assert.deepEqual(perDate, [tnDate(BRUINS), tnDate(HAWKS), tnDate(PERFORMER)]);
  assert.ok(!html.includes(`<a href="${tnDate(EV(1, 'played'))}`));
  // Each date's Event offers its own game, never another date's.
  assert.deepEqual(eventOffers(html).filter(([d]) => d >= '2026-11-02'), [['2026-11-18', tn(BRUINS)], ['2026-12-12', tn(HAWKS)], ['2027-01-30', tn(PERFORMER)]]);
});

// ── subId1 on every TicketNetwork href (ruling 2026-11-02, before merge) ────

const STARS = { ...TEAM, id: 'dallas-stars', name: 'Stars', city: 'Dallas', abbreviation: 'DAL', division: 'Central' } as unknown as Team;
const CELTICS = { ...TEAM, id: 'boston-celtics', name: 'Celtics', city: 'Boston', league: 'NBA', sportSlug: 'nba', abbreviation: 'BOS' } as unknown as Team;
const FIXTURES: [string, Team, PromoPageRow[]][] = [
  ['Stars, Esa Lindell (event link)', STARS, [row({ promoId: 's1', date: '2026-11-15', title: 'Esa Lindell Bobblehead', type: 'giveaway', displayOpponent: 'Panthers', pageSlug: 'esa-lindell-bobblehead', tnEventUrl: EV(8139510, 'dallas-stars-vs-florida-panthers-tickets-sun-nov-15-2026-american-airlines-center') })]],
  ['Red Wings, Original Six (per-date links)', TEAM, [
    row({ promoId: 'w1', date: '2026-11-18', tnEventUrl: BRUINS }),
    row({ promoId: 'w2', date: '2026-12-11', displayOpponent: 'Rangers', tnEventUrl: EV(8138675, 'detroit-red-wings-vs-new-york-rangers-tickets-fri-dec-11-2026-little-caesars-arena') }),
    row({ promoId: 'w3', date: '2027-01-27', displayOpponent: 'Maple Leafs', tnEventUrl: null }),
  ]],
  ['Celtics, Neemias Queta (performer fallback)', CELTICS, [row({ promoId: 'c1', date: '2027-01-27', title: 'Neemias Queta Bobblehead', type: 'giveaway', displayOpponent: 'Clippers', pageSlug: 'neemias-queta-bobblehead', tnEventUrl: null })]],
];
const SUBID_RE = /^[a-z0-9_-]{1,64}$/;

for (const [name, team, rows] of FIXTURES) {
  test(`every TicketNetwork href on ${name} carries a valid subId1`, () => {
    const html = render(rows, '2026-11-02', team);
    const hrefs = [...html.matchAll(/https:\/\/ticketnetwork\.lusg\.net\/c\/[^"\s]+/g)].map((m) => m[0]);
    assert.ok(hrefs.length >= 2, 'the anchor and the JSON-LD offer at least');
    for (const h of hrefs) {
      const sub = new URL(h).searchParams.get('subId1');
      assert.ok(sub, `subId1 present: ${h}`);
      assert.match(sub as string, SUBID_RE, h);
      assert.ok(sub === `web_promo_page_${team.id}` || sub === `web_promo_date_${team.id}`, sub as string);
      // subId3 = the page slug on every one (ruling 2026-11-04); never subId2 server-side.
      assert.equal(new URL(h).searchParams.get('subId3'), rows[0].pageSlug, h);
      assert.equal(new URL(h).searchParams.get('subId2'), null, h);
    }
    assert.equal(new URL(anchor(html, 'Get tickets')).searchParams.get('subId1'), `web_promo_page_${team.id}`);
    for (const m of html.matchAll(/<a [^>]*href="([^"]+)"[^>]*>Tickets<\/a>/g)) assert.equal(new URL(m[1]).searchParams.get('subId1'), `web_promo_date_${team.id}`);
    // The Ticketmaster secondary link is still there, untouched.
    assert.match(anchor(html, 'Also on Ticketmaster'), /^https:\/\/www\.ticketmaster\.com\//);
    // Without the Impact wrap it is a bare link, so no subId3 (not an Impact link).
    assert.ok(!anchor(html, 'Also on Ticketmaster').includes('subId3'));
  });
}

test('a page whose dates have all been played links no event: primary and offers fall back to the performer page', () => {
  const html = render([row({ date: '2026-10-20', tnEventUrl: EV(2, 'detroit-red-wings-vs-x-tickets-tue-oct-20-2026-little-caesars-arena') })], '2026-11-02');
  assert.equal(anchor(html, 'Get tickets'), tn(PERFORMER));
  assert.equal(offersUrl(html), tn(PERFORMER));
  assert.ok(!html.includes(encodeURIComponent('tue-oct-20-2026')));
  assert.equal(anchors(html, 'Also on Ticketmaster'), 1);
});

test('a series links no played date in its JSON-LD offers', () => {
  const html = render([row({ promoId: 'a', date: '2026-10-20', tnEventUrl: EV(1, 'played') }), row({ promoId: 'b', date: '2026-11-18', tnEventUrl: BRUINS })]);
  assert.deepEqual(eventOffers(html), [['2026-10-20', tn(PERFORMER)], ['2026-11-18', tn(BRUINS)]]);
});

// ── tnHomeUnavailable (2026-11-03): TicketNetwork lists no events at the
// club's building (Maple Leafs, Raptors, Senators). Ticketmaster is the
// primary, with the tagging an unflagged page gives its secondary link; no
// "Also on" line, no per-date link, no TicketNetwork href anywhere (JSON-LD
// included). The flag wins over a stored event link.

const LEAFS = { ...TEAM, id: 'toronto-maple-leafs', name: 'Maple Leafs', city: 'Toronto', abbreviation: 'TOR', tnHomeUnavailable: true } as unknown as Team;
const LEAFS_PLAIN = { ...LEAFS, tnHomeUnavailable: undefined } as unknown as Team;
const leafsRow = (over: Partial<PromoPageRow>) => row({ displayOpponent: 'Bruins', pageSlug: 'hockey-fights-cancer', title: 'Hockey Fights Cancer', ...over });

test('flagged club, single date: Ticketmaster is the primary with the unflagged secondary tagging, no TicketNetwork anywhere', () => {
  const rows = [leafsRow({ date: '2026-11-21' })];
  const html = render(rows, '2026-11-02', LEAFS);
  const plain = render(rows, '2026-11-02', LEAFS_PLAIN);
  const tm = anchor(plain, 'Also on Ticketmaster');
  assert.match(tm, /^https:\/\/www\.ticketmaster\.com\//);
  assert.equal(anchor(html, 'Get tickets'), tm);
  assert.equal(anchors(html, 'Also on Ticketmaster'), 0);
  assert.equal(anchors(html, 'Tickets'), 0);
  assert.equal(offersUrl(html), tm);
  assert.ok(!/ticketnetwork/i.test(html), 'no TicketNetwork href, label or offer');
  assert.ok(html.includes('on Ticketmaster"'), 'the primary is labelled for Ticketmaster');
});

test('flagged club, series: no per-date links, every Event offers Ticketmaster', () => {
  const rows = [
    leafsRow({ promoId: 'a', date: '2026-10-20', displayOpponent: 'Rangers' }),
    leafsRow({ promoId: 'b', date: '2026-11-21' }),
    leafsRow({ promoId: 'c', date: '2026-12-12', displayOpponent: 'Blackhawks' }),
  ];
  const html = render(rows, '2026-11-02', LEAFS);
  const tm = anchor(render(rows, '2026-11-02', LEAFS_PLAIN), 'Also on Ticketmaster');
  assert.equal(anchor(html, 'Get tickets'), tm);
  assert.equal(anchors(html, 'Tickets'), 0);
  assert.deepEqual(eventOffers(html), [['2026-10-20', tm], ['2026-11-21', tm], ['2026-12-12', tm]]);
  assert.ok(!/ticketnetwork/i.test(html));
});

test('flagged club with a stored event link: the flag wins, Ticketmaster stays primary', () => {
  const html = render([leafsRow({ date: '2026-11-21', tnEventUrl: EV(9000001, 'toronto-maple-leafs-vs-boston-bruins-tickets-sat-nov-21-2026-scotiabank-arena') })], '2026-11-02', LEAFS);
  assert.match(anchor(html, 'Get tickets'), /^https:\/\/www\.ticketmaster\.com\//);
  assert.ok(!/ticketnetwork/i.test(html));
});
