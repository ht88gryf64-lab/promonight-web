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
const tn = (landing: string) => `${PREFIX}?u=${encodeURIComponent(landing)}&partnerpropertyid=8313917&MediaPartnerPropertyId=8313917&subId1=web_promo_page_detroit-red-wings`;
const PERFORMER = 'https://www.ticketnetwork.com/e/performers/detroit-red-wings-tickets';

const row = (over: Partial<PromoPageRow>): PromoPageRow => ({
  promoId: 'p1', date: '2026-11-18', title: 'Original Six Matchup', description: 'An Original Six night.', type: 'theme',
  displayTime: '7:30 PM', displayOpponent: 'Bruins', highlight: false, attendanceCap: null, presentedBy: null,
  whileSuppliesLast: null, gateOpenTime: null, ageRestriction: null, redemptionLocation: null, ticketPackageRequired: null,
  ticketPackageName: null, sourceUrl: null, pageSlug: 'original-six-matchup', pageSeason: '2026-27', themeKey: 'none',
  imageTier: null, imageRef: null, imageSourceUrl: null, imageCredit: null, updatedAt: '2026-11-01T00:00:00.000Z',
  tombstoned: false, tombstonedAt: null, tnEventUrl: null, ...over,
});

function page(rows: PromoPageRow[], today: string): PromoPage {
  const primary = rows.find((r) => r.date >= today) ?? rows[rows.length - 1];
  return { team: TEAM, slug: rows[0].pageSlug, season: '2026-27', rows, removedRows: [], removedDates: [], state: 'live', primary, dates: rows.map((r) => r.date), updatedAt: null, removedAt: null, canonicalSlug: null };
}
const CTX: PromoPageContext = { venue: null, hub: null, quickFacts: [], location: null, coords: null, formerNames: [], observedAt: null, alsoAtGame: [], nextTeamPromos: [], crossTeam: null, previousEdition: null };
const render = (rows: PromoPageRow[], today = '2026-11-02') => renderToStaticMarkup(<PromoPageView page={page(rows, today)} ctx={CTX} today={today} />).replace(/&amp;/g, '&');

function anchor(html: string, text: string): string {
  const at = html.indexOf(`>${text}</a>`);
  assert.ok(at >= 0, `an anchor reading "${text}"`);
  const open = html.lastIndexOf('<a ', at);
  return /href="([^"]+)"/.exec(html.slice(open, at))?.[1] as string;
}
const anchors = (html: string, text: string) => html.split(`>${text}</a>`).length - 1;
const offersUrl = (html: string) => {
  for (const m of html.matchAll(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/g)) {
    const s = JSON.stringify(JSON.parse(m[1]));
    const o = /"offers":\{[^}]*"url":"([^"]+)"/.exec(s);
    if (o) return o[1];
  }
  return null;
};

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
  assert.deepEqual(perDate, [tn(BRUINS), tn(HAWKS), tn(PERFORMER)]);
  assert.ok(!html.includes(encodeURIComponent(EV(1, 'played'))));
});
