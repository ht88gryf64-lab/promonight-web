// The forecast row (step 5b, rulings 2026-11-08) in the served HTML: inside
// Before you go (or the quick-facts fallback), the label by roof, the
// retractable note, nothing when the context holds no forecast.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { renderToStaticMarkup } from 'react-dom/server';
import { PromoPageView } from '../PromoPageView';
import type { PromoPage, PromoPageContext } from '../../../lib/promo-pages';
import type { PromoPageRow } from '../../../lib/promo-page-copy';
import type { GameForecast, VenueRoof } from '../../../lib/forecast-label';
import type { BeforeYouGoRow } from '../../../lib/before-you-go';
import type { Team } from '../../../lib/types';

const WILD = { id: 'minnesota-wild', name: 'Wild', city: 'Minnesota', league: 'NHL', sportSlug: 'nhl', abbreviation: 'MIN', primaryColor: '#154734', secondaryColor: '#a6192e', division: 'Central' } as unknown as Team;
const TODAY = '2026-11-08';
const row = (over: Partial<PromoPageRow> = {}): PromoPageRow => ({
  promoId: 'p1', date: '2026-11-12', title: 'Winter Beanie', description: 'All fans receive a winter beanie.', type: 'giveaway',
  displayTime: '7:00 PM', displayOpponent: 'Blackhawks', highlight: false, attendanceCap: null, presentedBy: null,
  whileSuppliesLast: null, gateOpenTime: null, ageRestriction: null, redemptionLocation: null, ticketPackageRequired: null,
  ticketPackageName: null, sourceUrl: null, pageSlug: 'winter-beanie', pageSeason: '2026-27', themeKey: 'none',
  imageTier: null, imageRef: null, imageSourceUrl: null, imageCredit: null, updatedAt: null, tombstoned: false, tombstonedAt: null, tnEventUrl: null, ...over,
});
const page = (r: PromoPageRow): PromoPage => ({ team: WILD, slug: r.pageSlug, season: '2026-27', rows: [r], removedRows: [], removedDates: [], state: 'live', primary: r, dates: [r.date], updatedAt: null, removedAt: null, canonicalSlug: null });
const FORECAST: GameForecast = { condition: 'Mostly Clear', icon: 'moon', high: 41, low: 28, temperature: null, unit: 'F', precipChance: 10, updatedAt: '2026-11-08T19:06:26+00:00' };
const BAG: BeforeYouGoRow = { key: 'bag', label: 'Bag policy', text: 'Bags up to 12" x 12" x 6".', observedAt: '2026-10-07T14:30:16.621Z', observedOn: 'Oct 7, 2026', sourceUrl: 'https://x/bag', sourceHost: 'x' };
const ctx = (over: Partial<PromoPageContext>): PromoPageContext => ({
  game: { date: '2026-11-12', opponentId: null, opponentName: 'Chicago Blackhawks', opponentHref: null, timeZone: 'America/Chicago', homeGameNumber: 5, homeGamesTotal: 41, seasonLabel: '2026-27' } as PromoPageContext['game'],
  timeline: null, venueGiveaways: null, venue: null,
  hub: { slug: 'xcel-energy-center', displayName: 'Grand Casino Arena', city: 'St Paul', indexable: true } as PromoPageContext['hub'],
  beforeYouGo: [BAG], quickFacts: [], location: null, coords: { lat: 44.9448, lng: -93.101 }, roof: null, forecast: FORECAST, formerNames: [], observedAt: null,
  alsoAtGame: [], nextTeamPromos: [], crossTeam: null, previousEditions: [], previousEdition: null, nextEdition: null, short: null, ebayListings: [], ...over,
});
const render = (c: PromoPageContext, r = row()) => renderToStaticMarkup(<PromoPageView page={page(r)} ctx={c} today={TODAY} now={new Date(`${TODAY}T16:00:00Z`)} />).replace(/&amp;/g, '&');
const forecastRow = (html: string) => { const at = html.indexOf('data-forecast-row'); return at < 0 ? '' : html.slice(html.lastIndexOf('<div', at), html.indexOf('</div>', html.indexOf('</dd>', at))); };

test('the row sits inside Before you go after the provenance rows: label, glyph, summary, the weather.gov line with the update time in the venue zone', () => {
  const html = render(ctx({}));
  const r = forecastRow(html);
  assert.ok(r, 'the row renders');
  assert.ok(html.indexOf('id="before-you-go"') < html.indexOf('data-forecast-row'), 'inside Before you go');
  assert.ok(html.indexOf('Bag policy') < html.indexOf('data-forecast-row'), 'after the bag row');
  assert.match(r, /<dt[^>]*>Forecast<\/dt>/, 'no roof flag: the generic label');
  assert.match(r, /data-forecast-icon="moon"/);
  assert.ok(r.includes('Mostly Clear, high 41° low 28°, 10% chance of precipitation'), r);
  assert.ok(!r.includes('retractable'));
  assert.ok(r.includes('Forecast from weather.gov, updated Nov 8, 1:06 PM CT'), r);
});

test('the label by roof: open and retractable say Game-time forecast, retractable adds its note; fixed says Outside at puck drop on an NHL page', () => {
  const labels: Record<string, VenueRoof | null> = { 'Game-time forecast': 'open', 'Outside at puck drop': 'fixed', Forecast: null };
  for (const [label, roof] of Object.entries(labels)) {
    const r = forecastRow(render(ctx({ roof })));
    assert.match(r, new RegExp(`<dt[^>]*>${label}</dt>`), String(roof));
    assert.ok(!r.includes('retractable roof'), String(roof));
  }
  const retractable = forecastRow(render(ctx({ roof: 'retractable' })));
  assert.match(retractable, /<dt[^>]*>Game-time forecast<\/dt>/);
  assert.ok(retractable.includes('10% chance of precipitation · retractable roof'), 'the note after the summary');
  // fixed, by league: an NBA club says tip-off.
  const suns = { ...WILD, id: 'phoenix-suns', league: 'NBA', sportSlug: 'nba', name: 'Suns', city: 'Phoenix' } as unknown as Team;
  const html = renderToStaticMarkup(<PromoPageView page={{ ...page(row()), team: suns }} ctx={ctx({ roof: 'fixed' })} today={TODAY} />);
  assert.match(forecastRow(html), /<dt[^>]*>Outside at tip-off<\/dt>/);
});

test('no forecast in the context, no row; a single-period forecast prints its one temperature; the quick-facts fallback carries the row too', () => {
  assert.ok(!render(ctx({ forecast: null })).includes('data-forecast-row'));
  const single = forecastRow(render(ctx({ forecast: { ...FORECAST, high: null, low: null, temperature: 48, condition: 'Chance Rain', icon: 'rain' } })));
  assert.ok(single.includes('Chance Rain, 48°, 10% chance of precipitation'));
  assert.match(single, /data-forecast-icon="rain"/);
  const fallback = render(ctx({ beforeYouGo: [], quickFacts: [{ key: 'bag', label: 'Bags', text: 'Up to 12" x 12" x 6".', href: null, hrefLabel: null } as PromoPageContext['quickFacts'][number]] }));
  assert.ok(!fallback.includes('id="before-you-go"'), 'no Before you go block');
  assert.ok(fallback.includes('quick facts'), 'the fallback card');
  assert.match(forecastRow(fallback), /<dt[^>]*>Forecast<\/dt>/, 'the row inside the fallback');
  assert.ok(fallback.includes('<div class="col-span-2"><div data-forecast-row'), 'full width under the grid');
});
