// The package-page disclosure under "Get tickets" (Gate 3 follow-up, ruling
// 2026-11-10; resolves known-issues 97), in the server HTML:
//  - a special-ticket package page (NHL, NBA, the stored flag) carries the
//    disclosure directly under the CTA, inside the CTA block, plus the team
//    site link when the row stores a source URL (as stored, no tagging);
//  - "Get tickets" and its TicketNetwork tagging are unchanged on both;
//  - a non-package page's CTA block is exactly what it was.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { renderToStaticMarkup } from 'react-dom/server';
import { PromoPageView } from '../PromoPageView';
import type { PromoPage, PromoPageContext } from '../../../lib/promo-pages';
import type { PromoPageRow } from '../../../lib/promo-page-copy';
import type { Team } from '../../../lib/types';
import { PACKAGE_CTA_DISCLOSURE, PACKAGE_SOURCE_LINK_LABEL, TICKET_PACKAGE_ROW_NOTE } from '../../../lib/ticket-packages';

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
const CTX: PromoPageContext = { game: null, timeline: null, venueGiveaways: null, venue: null, hub: null, beforeYouGo: [], quickFacts: [], location: null, coords: null, roof: null, forecast: null, formerNames: [], observedAt: null, alsoAtGame: [], nextTeamPromos: [], crossTeam: null, previousEditions: [], previousEdition: null, nextEdition: null, short: null, ebayListings: [] };
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

/** The CTA block: the <section> that holds "Get tickets". */
function ctaBlock(html: string): string {
  const at = html.indexOf('>Get tickets</a>');
  assert.ok(at >= 0, 'a Get tickets anchor');
  const open = html.lastIndexOf('<section', at);
  return html.slice(open, html.indexOf('</section>', at) + '</section>'.length);
}
const DISCLOSURE_RE = /<div data-package-disclosure=""[^>]*>[\s\S]*?<\/div>/;
const TEAM_SITE = 'https://www.nhl.com/redwings/tickets/theme-nights';

test('package page: the disclosure and the team site link sit inside the CTA block, directly under Get tickets', () => {
  const html = render([row({ tnEventUrl: BRUINS, ticketPackageRequired: true, ticketPackageName: 'Original Six Package', sourceUrl: TEAM_SITE })]);
  const cta = ctaBlock(html);
  assert.ok(cta.includes(PACKAGE_CTA_DISCLOSURE), 'disclosure in the CTA block');
  assert.ok(cta.indexOf(PACKAGE_CTA_DISCLOSURE) > cta.indexOf('>Get tickets</a>'), 'under the CTA');
  assert.ok(cta.indexOf(PACKAGE_CTA_DISCLOSURE) < cta.indexOf('>Also on Ticketmaster</a>'), 'before the secondary link');
  assert.equal(anchor(html, PACKAGE_SOURCE_LINK_LABEL), TEAM_SITE, 'the stored URL exactly, no affiliate parameters');
  assert.match(cta, new RegExp(`<a href="${TEAM_SITE.replace(/[./]/g, '\\$&')}" target="_blank" rel="noopener nofollow"`));
  // Get tickets is unchanged: TicketNetwork, subId1 and subId3 exactly as before, no subId2.
  assert.equal(anchor(html, 'Get tickets'), tn(BRUINS));
  assert.equal(new URL(anchor(html, 'Get tickets')).searchParams.get('subId2'), null);
  // The card line still says it, and the disclosure says the same thing.
  assert.ok(html.includes(TICKET_PACKAGE_ROW_NOTE));
});

test('package page with no stored source URL: the disclosure alone, never a guessed link', () => {
  const html = render([row({ tnEventUrl: BRUINS, ticketPackageRequired: true, sourceUrl: null })]);
  assert.ok(ctaBlock(html).includes(PACKAGE_CTA_DISCLOSURE));
  assert.equal(anchors(html, PACKAGE_SOURCE_LINK_LABEL), 0);
  // A stored value that is not a web URL is no URL either.
  assert.equal(anchors(render([row({ ticketPackageRequired: true, sourceUrl: 'nhl.com/redwings' })]), PACKAGE_SOURCE_LINK_LABEL), 0);
});

test('non-package page: no disclosure, and the CTA block is exactly the package page block less the disclosure', () => {
  const plain = render([row({ tnEventUrl: BRUINS, sourceUrl: TEAM_SITE })]);
  const pkg = render([row({ tnEventUrl: BRUINS, sourceUrl: TEAM_SITE, ticketPackageRequired: true })]);
  assert.ok(!plain.includes(PACKAGE_CTA_DISCLOSURE));
  assert.ok(!plain.includes('data-package-disclosure'));
  assert.equal(anchors(plain, PACKAGE_SOURCE_LINK_LABEL), 0);
  assert.equal(anchor(plain, 'Get tickets'), tn(BRUINS));
  // The only CTA difference a package row makes is the disclosure block: the
  // rest of the block (Get tickets, Share, Also on Ticketmaster, parking and
  // hotels, every href and attribute) is byte for byte the same.
  assert.equal(ctaBlock(pkg).replace(DISCLOSURE_RE, ''), ctaBlock(plain));
});

test('the flag outside NHL and NBA is not read: no disclosure on an MLB, MLS, WNBA or NFL row that stores it', () => {
  for (const league of ['MLB', 'MLS', 'WNBA', 'NFL']) {
    const team = { ...TEAM, league, sportSlug: league.toLowerCase() } as unknown as Team;
    const html = render([row({ tnEventUrl: BRUINS, ticketPackageRequired: true, sourceUrl: TEAM_SITE })], '2026-11-02', team);
    assert.ok(!html.includes(PACKAGE_CTA_DISCLOSURE), league);
  }
});

test('the disclosure copy: no em or en dash, and no claim beyond the card line', () => {
  assert.doesNotMatch(PACKAGE_CTA_DISCLOSURE + PACKAGE_SOURCE_LINK_LABEL, /[\u2013\u2014]/);
  assert.equal(PACKAGE_CTA_DISCLOSURE, 'This promo comes with a special ticket package from the team. Tickets bought through us may not include it.');
  assert.equal(PACKAGE_SOURCE_LINK_LABEL, 'See the package on the team site');
});
