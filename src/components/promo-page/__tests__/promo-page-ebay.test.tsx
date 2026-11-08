// The eBay listings block on a bobblehead's page (spec Visuals 6, step 5a,
// 2026-11-08), in the server HTML: after This game, before the Fan guide (ruling
// 2026-11-08), on a bobblehead page with no
// tier 1 photo and on every played bobblehead page; never beside a tier 1
// photo on an upcoming page; nothing when the context holds no listing.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { renderToStaticMarkup } from 'react-dom/server';
import { PromoPageView } from '../PromoPageView';
import type { PromoPage, PromoPageContext } from '../../../lib/promo-pages';
import type { PromoPageRow } from '../../../lib/promo-page-copy';
import type { EbayListing } from '../../../lib/ebay-browse';
import type { Team } from '../../../lib/types';
import { AFFILIATE_DISCLOSURE_TEXT } from '../../affiliates/AffiliateDisclosure';

const NETS = { id: 'brooklyn-nets', name: 'Nets', city: 'Brooklyn', league: 'NBA', sportSlug: 'nba', abbreviation: 'BKN', primaryColor: '#000', secondaryColor: '#fff', division: 'Atlantic' } as unknown as Team;
const TODAY = '2026-11-02';

const row = (over: Partial<PromoPageRow>): PromoPageRow => ({
  promoId: 'e1', date: '2026-11-18', title: 'Julius Erving Bobblehead', description: 'The first 10,000 fans receive a Julius Erving bobblehead.', type: 'giveaway',
  displayTime: '7:30 PM', displayOpponent: 'Knicks', highlight: false, attendanceCap: 10000, presentedBy: null,
  whileSuppliesLast: null, gateOpenTime: null, ageRestriction: null, redemptionLocation: null, ticketPackageRequired: null,
  ticketPackageName: null, sourceUrl: 'https://www.nba.com/nets/promotions', pageSlug: 'julius-erving-bobblehead', pageSeason: '2026-27', themeKey: 'none',
  imageTier: 3, imageRef: null, imageSourceUrl: null, imageCredit: null, updatedAt: '2026-11-01T00:00:00.000Z',
  tombstoned: false, tombstonedAt: null, tnEventUrl: null, ...over,
});
const TIER1 = { imageTier: 1 as const, imageRef: 'promo-images/e1.png', imageSourceUrl: 'https://www.nba.com/nets/promotions', imageCredit: 'Image: Brooklyn Nets' };

function page(rows: PromoPageRow[], today = TODAY, state: PromoPage['state'] = 'live'): PromoPage {
  const primary = rows.find((r) => r.date >= today) ?? rows[rows.length - 1];
  const live = state === 'live';
  return { team: NETS, slug: rows[0].pageSlug, season: '2026-27', rows: live ? rows : [], removedRows: live ? [] : rows, removedDates: live ? [] : rows.map((r) => r.date), state, primary, dates: live ? rows.map((r) => r.date) : [], updatedAt: null, removedAt: live ? null : '2026-11-01T00:00:00.000Z', canonicalSlug: null };
}
const listing = (n: number): EbayListing => ({
  itemId: `v1|${n}|0`,
  title: `2026 Dr. J Julius Erving Brooklyn Nets Bobblehead no. ${n}`,
  imageUrl: `https://i.ebayimg.com/images/g/${n}/s-l400.webp`,
  price: `$${(50 + n).toFixed(2)}`,
  href: `https://www.ebay.com/itm/${n}?mkevt=1&mkcid=1&mkrid=711-53200-19255-0&campid=5339000000&customid=web_promo_page_x&toolid=10001`,
});
const ctx = (listings: EbayListing[]): PromoPageContext => ({ game: null, timeline: null, venueGiveaways: null, venue: null, hub: null, beforeYouGo: [], quickFacts: [], location: null, coords: null, formerNames: [], observedAt: null, alsoAtGame: [], nextTeamPromos: [], crossTeam: null, previousEdition: null, nextEdition: null, short: null, ebayListings: listings });
const render = (rows: PromoPageRow[], listings: EbayListing[], today = TODAY, state: PromoPage['state'] = 'live') =>
  renderToStaticMarkup(<PromoPageView page={page(rows, today, state)} ctx={ctx(listings)} today={today} now={new Date(`${today}T16:00:00Z`)} />).replace(/&amp;/g, '&');

const BLOCK = />On eBay<\/h2>/;
const ebayAnchors = (html: string) => [...html.matchAll(/<a href="(https:\/\/www\.ebay\.com\/itm\/[^"]+)" target="_blank" rel="sponsored noopener"/g)].map((m) => m[1]);
const section = (html: string) => {
  const h2 = html.search(BLOCK);
  if (h2 < 0) return '';
  const start = html.lastIndexOf('<section', h2);
  return html.slice(start, html.indexOf('</section>', h2) + '</section>'.length);
};

test('a tier 1 upcoming bobblehead page renders nothing from eBay, whatever the context holds', () => {
  const html = render([row(TIER1)], [listing(1), listing(2), listing(3)]);
  assert.doesNotMatch(html, BLOCK);
  assert.deepEqual(ebayAnchors(html), []);
  assert.ok(!html.includes('i.ebayimg.com'));
  assert.ok(html.includes('<figure'), 'the photo is there');
});

test('no block when no listing passed the guard (an empty context), on an upcoming page without a photo and on a played one', () => {
  for (const html of [render([row({})], []), render([row({ date: '2026-10-20' })], [])]) {
    assert.doesNotMatch(html, BLOCK);
    assert.deepEqual(ebayAnchors(html), []);
  }
});

test('an upcoming bobblehead page without a photo: the block after This game with one, two or three listings, image, price and sponsored link each, the disclosure under it', () => {
  for (const n of [1, 2, 3]) {
    const listings = Array.from({ length: n }, (_, i) => listing(i + 1));
    const html = render([row({})], listings);
    assert.match(html, BLOCK, `${n} listings`);
    const s = section(html);
    assert.equal(ebayAnchors(s).length, n, `${n} sponsored anchors`);
    assert.equal((s.match(/<img /g) ?? []).length, n);
    for (const l of listings) {
      // alt "" (the title beside it is the same words, ux-review D5); the clamp class with no `block` beside it (D1).
      assert.ok(s.includes(`<img src="${l.imageUrl}" alt="" width="400" height="400" loading="lazy" decoding="async"`), l.imageUrl);
      assert.ok(s.includes(`<span class="line-clamp-2 text-[12px] leading-[1.35] text-rd-ink-soft">${l.title}</span>`), 'the clamped title');
      assert.ok(s.includes(`title="${l.title}"`), 'the anchor tooltip carries the full title');
      assert.ok(s.includes(`>${l.price}</span>`), l.price);
      assert.ok(s.includes(`href="${l.href}"`));
    }
    assert.ok(s.includes('Current listings for this bobblehead.'));
    assert.ok(s.endsWith(`${AFFILIATE_DISCLOSURE_TEXT}</p></section>`), 'the disclosure line closes the block');
    // After This game, before the Fan guide and the rest (ruling 2026-11-08).
    const thisGame = html.indexOf('>This game</h2>');
    const at = html.search(BLOCK);
    assert.ok(thisGame > 0 && thisGame < at, 'This game first');
    const guide = html.indexOf('>Fan guide</p>');
    assert.ok(guide > at, 'the Fan guide follows the block');
    assert.ok(at < html.indexOf('>Questions</h2>'));
    assert.equal((html.slice(thisGame, at).match(/<h2/g) ?? []).length, 1, 'no heading between This game and the block');
  }
});

test('a played bobblehead page gets the block even with a tier 1 photo, with the resale line; the page still sells nothing else', () => {
  const html = render([row({ ...TIER1, date: '2026-10-20' })], [listing(1), listing(2)]);
  assert.match(html, BLOCK);
  assert.ok(html.includes('This game has been played'));
  assert.ok(html.includes('<figure'), 'the photo stays on a played page');
  const s = section(html);
  assert.equal(ebayAnchors(s).length, 2);
  assert.ok(s.includes('Missed it? Resale listings for this bobblehead.'));
  assert.ok(!html.includes('>Get tickets</a>'));
  assert.ok(!html.includes('ticketnetwork.lusg.net'));
  // The listing links are the only sponsored anchors on the page.
  assert.equal((html.match(/rel="sponsored/g) ?? []).length, 2);
});

test('a removed page renders no eBay block', () => {
  const html = render([row({ date: '2026-10-20', tombstoned: true, tombstonedAt: '2026-11-01T00:00:00.000Z' })], [listing(1)], TODAY, 'removed');
  assert.doesNotMatch(html, BLOCK);
});
