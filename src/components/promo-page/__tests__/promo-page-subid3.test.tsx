// subId3 = the promo page's slug (ruling 2026-11-04). Impact links carry three
// slots, each with one owner:
//   subId1  {surface}_{team}, server-rendered, unchanged;
//   subId2  `share`, client-side in a shared-link session only, never served;
//   subId3  page.slug, server-rendered on every promo-page Impact link.
// This file pins:
//   - the served HTML (no share session): TicketNetwork (primary, per-date,
//     JSON-LD offers) and the Ticketmaster Impact wrap carry subId1 + subId3,
//     sharedid is untouched, and nothing carries subId2;
//   - a share-session click on the promo page: the href the browser opens and
//     the affiliate_click destination_url carry subId1, subId2=share and
//     subId3=slug together;
//   - SpotHero and Expedia are unchanged (no second slot, by ruling);
//   - the helper's cleaning and cap, and Fanatics through the same option.
//
// The share session is simulated by mocking promo-share-session's hook (the
// real one is null on the server by design, so a server render can never
// show a shared session). Everything else is the real page and the real
// TrackedAffiliateLink, so the href comes out of the production code path.
import { test, before, mock } from 'node:test';
import assert from 'node:assert/strict';
import type { ReactElement } from 'react';
import type { PromoPage, PromoPageContext } from '../../../lib/promo-pages';
import type { PromoPageRow } from '../../../lib/promo-page-copy';
import type { Team } from '../../../lib/types';
import type { ShareSession } from '../../../lib/promo-share-session';

// Shape of the production wrap (not its value). Read at module scope by
// affiliates.ts, so it is set before anything imports it.
const WRAP = 'https://ticketmaster.evyy.net/c/7236189/264167/4272?u={TARGET}&sharedid={SHARED_ID}';
process.env.NEXT_PUBLIC_TICKETMASTER_IMPACT_WRAP = WRAP;

let session: ShareSession | null = null;
mock.module(new URL('../../../lib/promo-share-session.ts', import.meta.url).href, {
  namedExports: {
    useShareSession: () => session,
    isSelfOpen: () => false,
    recordCreatedShare: () => {},
    setShareSession: () => {},
  },
});

type View = typeof import('../PromoPageView');
type Link = typeof import('../../tracked-affiliate-link');
type Aff = typeof import('../../../lib/affiliates');
let view: View;
let link: Link;
let aff: Aff;
let renderToStaticMarkup: typeof import('react-dom/server').renderToStaticMarkup;

before(async () => {
  view = await import('../PromoPageView');
  link = await import('../../tracked-affiliate-link');
  aff = await import('../../../lib/affiliates');
  ({ renderToStaticMarkup } = await import('react-dom/server'));
});

const SLUG = 'original-six-matchup';
const TEAM = { id: 'detroit-red-wings', name: 'Red Wings', city: 'Detroit', league: 'NHL', sportSlug: 'nhl', abbreviation: 'DET', primaryColor: '#000', secondaryColor: '#fff', division: 'Atlantic', ticketmasterSlug: 'detroit-red-wings', ticketmasterAttractionId: '805913' } as unknown as Team;
const BRUINS = 'https://www.ticketnetwork.com/tickets/8138650/detroit-red-wings-vs-boston-bruins-tickets-wed-nov-18-2026-little-caesars-arena';
const row = (over: Partial<PromoPageRow>): PromoPageRow => ({
  promoId: 'p1', date: '2026-11-18', title: 'Original Six Matchup', description: 'An Original Six night.', type: 'theme',
  displayTime: '7:30 PM', displayOpponent: 'Bruins', highlight: false, attendanceCap: null, presentedBy: null,
  whileSuppliesLast: null, gateOpenTime: null, ageRestriction: null, redemptionLocation: null, ticketPackageRequired: null,
  ticketPackageName: null, sourceUrl: null, pageSlug: SLUG, pageSeason: '2026-27', themeKey: 'none',
  imageTier: null, imageRef: null, imageSourceUrl: null, imageCredit: null, updatedAt: '2026-11-01T00:00:00.000Z',
  tombstoned: false, tombstonedAt: null, tnEventUrl: null, ...over,
});
// A series, so the per-date "Tickets" links render too.
const ROWS = [
  row({ promoId: 'w1', date: '2026-11-18', tnEventUrl: BRUINS }),
  row({ promoId: 'w2', date: '2026-12-11', displayOpponent: 'Rangers' }),
];
const TODAY = '2026-11-02';
const PAGE: PromoPage = { team: TEAM, slug: SLUG, season: '2026-27', rows: ROWS, removedRows: [], removedDates: [], state: 'live', primary: ROWS[0], dates: ROWS.map((r) => r.date), updatedAt: null, removedAt: null, canonicalSlug: null };
const CTX: PromoPageContext = { venue: { name: 'Little Caesars Arena', city: 'Detroit' } as never, hub: null, quickFacts: [], location: null, coords: { lat: 42.341, lng: -83.055 }, formerNames: [], observedAt: null, alsoAtGame: [], nextTeamPromos: [], crossTeam: null, previousEdition: null, short: null };

const render = () => renderToStaticMarkup(<view.PromoPageView page={PAGE} ctx={CTX} today={TODAY} />).replace(/&amp;/g, '&');
function anchor(html: string, text: string): string {
  const at = html.indexOf(`>${text}</a>`);
  assert.ok(at >= 0, `an anchor reading "${text}"`);
  return /href="([^"]+)"/.exec(html.slice(html.lastIndexOf('<a ', at), at))?.[1] as string;
}
const hrefsOn = (html: string, host: string) => [...html.matchAll(/href="([^"]+)"/g)].map((m) => m[1]).filter((h) => new URL(h, 'https://x').hostname === host);
const sp = (u: string) => new URL(u).searchParams;

test('served HTML: every Impact link carries subId1 and subId3=slug; the Ticketmaster wrap keeps sharedid; no subId2 anywhere', () => {
  session = null;
  const html = render();
  assert.ok(!/subId2/i.test(html), 'no subId2 in served HTML');

  const tn = hrefsOn(html, 'ticketnetwork.lusg.net');
  assert.equal(tn.length, 3, 'Get tickets + two per-date Tickets links');
  for (const h of tn) {
    assert.match(sp(h).get('subId1') as string, /^web_promo_(page|date)_detroit-red-wings$/, h);
    assert.equal(sp(h).get('subId3'), SLUG, h);
  }
  assert.equal(sp(anchor(html, 'Get tickets')).get('subId1'), 'web_promo_page_detroit-red-wings');
  // The JSON-LD offers follow the anchors.
  for (const m of html.matchAll(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/g)) {
    const d = JSON.parse(m[1]);
    if (d['@type'] === 'Event' && d.offers) assert.equal(sp(d.offers.url).get('subId3'), SLUG, d.offers.url);
  }

  const tm = anchor(html, 'Also on Ticketmaster');
  assert.ok(tm.startsWith('https://ticketmaster.evyy.net/c/7236189/264167/4272?'), tm);
  assert.equal(sp(tm).get('sharedid'), 'web_promo_page_detroit-red-wings', 'sharedid is the subId1 equivalent, unchanged');
  assert.equal(sp(tm).get('subId3'), SLUG, 'appended to the wrap, not folded into sharedid');

  // SpotHero (HasOffers, aff_sub only) and Expedia (pubref only): unchanged.
  const sh = anchor(html, 'Parking');
  assert.equal(sp(sh).get('aff_sub'), 'web_promo_page_detroit-red-wings');
  assert.ok(!/subId|aff_sub2|aff_sub3/i.test(sh), sh);
  const ex = anchor(html, 'Hotels');
  assert.equal(sp(ex).get('pubref'), 'web_promo_page_detroit-red-wings');
  assert.ok(!/subId/i.test(ex), ex);
});

test('share-session click on a promo page: the opened href and affiliate_click destination_url carry subId1, subId2=share and subId3=slug together', () => {
  session = { shareId: 'ab12cd34', channel: 'sms', promoId: 'w1', selfOpen: false, at: Date.now(), sid: '' };
  try {
    const html = render();
    const cases: [string, string][] = [
      ['Get tickets', 'web_promo_page_detroit-red-wings'],
      ['Tickets', 'web_promo_date_detroit-red-wings'],
    ];
    for (const [text, sub1] of cases) {
      const h = anchor(html, text);
      assert.equal(sp(h).get('subId1'), sub1, h);
      assert.equal(sp(h).get('subId2'), 'share', h);
      assert.equal(sp(h).get('subId3'), SLUG, h);
    }
    const tm = anchor(html, 'Also on Ticketmaster');
    assert.equal(sp(tm).get('sharedid'), 'web_promo_page_detroit-red-wings');
    assert.equal(sp(tm).get('subId2'), 'share');
    assert.equal(sp(tm).get('subId3'), SLUG);
    // Not Impact: never touched, share session or not.
    assert.ok(!/subId/i.test(anchor(html, 'Parking')));
    assert.ok(!/subId/i.test(anchor(html, 'Hotels')));

    // The click itself: the real TrackedAffiliateLink with the page's own
    // server-built href, its mousedown fired (it must not throw; track() is a
    // no-op without a window). The element's href is what the browser opens,
    // and destination_url is set from the same taggedHref
    // (tracked-affiliate-link.tsx), so the href carries both answers.
    const built = aff.buildTicketNetworkLink({ team: TEAM, surface: view.PROMO_PAGE_SURFACE, eventUrl: BRUINS, pageSlug: SLUG })!;
    assert.ok(!built.includes('subId2'), 'the server-built href has no subId2');
    const el = link.TrackedAffiliateLink({ href: built, partner: 'ticketnetwork', teamId: TEAM.id, sport: 'NHL', promoId: 'w1', surface: view.PROMO_PAGE_SURFACE, children: 'Get tickets' }) as ReactElement<{ href: string; onMouseDown: () => void }>;
    el.props.onMouseDown();
    const clicked = el.props.href;
    assert.equal(sp(clicked).get('subId1'), 'web_promo_page_detroit-red-wings');
    assert.equal(sp(clicked).get('subId2'), 'share');
    assert.equal(sp(clicked).get('subId3'), SLUG);
    assert.equal(clicked, `${built}&subId2=share`, 'share appends subId2 after subId3; nothing else changes');
  } finally {
    session = null;
  }
});

test('a self-open share session adds no subId2; subId3 stays', () => {
  session = { shareId: 'ab12cd34', channel: 'copy', promoId: 'w1', selfOpen: true, at: Date.now(), sid: '' };
  try {
    const h = anchor(render(), 'Get tickets');
    assert.equal(sp(h).get('subId2'), null);
    assert.equal(sp(h).get('subId3'), SLUG);
  } finally {
    session = null;
  }
});

test('the helper: cleaned like subId1, capped at 64, idempotent, before a fragment; no slug leaves the link byte-identical', () => {
  assert.equal(aff.pageSubId3('Star Wars Night 2026!'), 'star-wars-night-2026');
  assert.equal(aff.pageSubId3(''), null);
  assert.equal(aff.pageSubId3('!!!'), null);
  assert.equal(aff.pageSubId3(null), null);
  const long = 'a'.repeat(40) + '-' + 'b'.repeat(40);
  const capped = aff.pageSubId3(long)!;
  assert.ok(capped.length <= 64 && /^[a-z0-9_-]+$/.test(capped) && !/[-_]$/.test(capped), capped);
  assert.equal(aff.withPageSubId3('https://h/c/1/2/3?a=1#x', 'slug'), 'https://h/c/1/2/3?a=1&subId3=slug#x');
  assert.equal(aff.withPageSubId3('https://h/c/1/2/3?a=1&subId3=slug', 'slug'), 'https://h/c/1/2/3?a=1&subId3=slug');

  const team = { id: 'detroit-red-wings', ticketNetworkSlug: undefined, fanaticsUrl: 'https://www.fanatics.com/nhl/detroit-red-wings/o-1234+t-5678', fanaticsPath: undefined } as never;
  // Every other surface passes no slug: byte-identical to before.
  assert.equal(aff.buildTicketNetworkLink({ team, surface: 'web_team_page' }), 'https://ticketnetwork.lusg.net/c/7236189/120057/2322?u=https%3A%2F%2Fwww.ticketnetwork.com%2Fe%2Fperformers%2Fdetroit-red-wings-tickets&partnerpropertyid=8313917&MediaPartnerPropertyId=8313917&subId1=web_team_page_detroit-red-wings');
  const fanBefore = aff.buildFanaticsUrl({ team, surface: 'web_team_page' });
  assert.ok(!fanBefore.includes('subId3'));
  // Fanatics through the same option: subId1 and the deep link unchanged.
  const fan = aff.buildFanaticsUrl({ team, surface: 'web_promo_page', pageSlug: SLUG });
  assert.equal(sp(fan).get('subId1'), 'web_promo_page_detroit-red-wings');
  assert.equal(sp(fan).get('subId3'), SLUG);
  assert.equal(sp(fan).get('u'), sp(fanBefore).get('u'));
  // Ticketmaster: no slug, the wrap is exactly as before.
  const tm = aff.buildTicketmasterUrl({ teamSlug: 'detroit-red-wings', ticketmasterSlug: 'detroit-red-wings', ticketmasterAttractionId: '805913', surface: 'web_team_page' });
  assert.ok(tm.endsWith('&sharedid=web_team_page_detroit-red-wings'), tm);
});
