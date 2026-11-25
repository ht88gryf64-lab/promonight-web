// Where "Stream on Fubo" renders, and where it does not (2026-11-20, Gate 1
// rulings 1, 2, 7, 8):
//  - promo page: inside the CTA section, directly under "Also on Ticketmaster"
//    and above Parking (so no new article child), with the availability line;
//    not on an MLB page, a page with no single game id, a played date, or an
//    NFL game on Prime;
//  - team-page rows: away rows only, under the ticket card and above parking,
//    on the team-page surfaces only (not the homepage modal), not for a
//    played game;
//  - /promos/today: under the inline ticket row, only with a joined gameId;
//  - every link is the /go/fubo hop, text only, no price, never "free".
import { test, mock } from 'node:test';
import assert from 'node:assert/strict';
import { renderToStaticMarkup } from 'react-dom/server';
import type { GameContext } from '@/lib/data';
import type { Game, PromoWithTeam, Team } from '@/lib/types';
import type { PromoPage, PromoPageContext } from '@/lib/promo-pages';
import type { PromoPageRow } from '@/lib/promo-page-copy';

const emptyQuery: any = {
  where: () => emptyQuery,
  orderBy: () => emptyQuery,
  limit: () => emptyQuery,
  select: () => emptyQuery,
  doc: () => ({ get: async () => ({ exists: false, data: () => undefined }), collection: () => emptyQuery }),
  get: async () => ({ docs: [], empty: true, size: 0, forEach: () => {} }),
};
// The away-row tray reads the clock (fuboGamePlayed); pinned to the fixtures' week.
mock.timers.enable({ apis: ['Date'], now: new Date('2026-11-20T17:00:00Z') });
mock.module('server-only', { namedExports: {} });
mock.module(new URL('../../../lib/firebase.ts', import.meta.url).href, {
  namedExports: { db: { collection: () => emptyQuery, collectionGroup: () => emptyQuery } },
});

const mk = (id: string, league: string, city: string, name: string): Team =>
  ({ id, league, city, name, abbreviation: name.slice(0, 3).toUpperCase(), primaryColor: '#154734', secondaryColor: '#a6192e', sportSlug: league.toLowerCase(), division: 'Test' }) as Team;
const WILD = mk('minnesota-wild', 'NHL', 'Minnesota', 'Wild');
const HAWKS = mk('chicago-blackhawks', 'NHL', 'Chicago', 'Blackhawks');
const RAVENS = mk('baltimore-ravens', 'NFL', 'Baltimore', 'Ravens');
const BILLS = mk('buffalo-bills', 'NFL', 'Buffalo', 'Bills');
const TWINS = mk('minnesota-twins', 'MLB', 'Minnesota', 'Twins');

const amp = (h: string) => h.replace(/&amp;/g, '&');
const fuboLinks = (h: string) => [...amp(h).matchAll(/href="(\/go\/fubo\/[^"]+)"/g)].map((m) => m[1]);

function assertCopy(h: string) {
  const at = h.indexOf('data-fubo-cta');
  const block = h.slice(at, h.indexOf('</div>', at));
  assert.ok(block.includes('Stream on Fubo'), block);
  assert.ok(!/free/i.test(block), 'never free');
  assert.ok(!/[$€£]|\d+\.\d\d/.test(block), 'no price');
  assert.ok(!/<img|<svg/i.test(block), 'text only: no logo or wordmark');
}

// ── promo page ────────────────────────────────────────────────────────────

const TODAY = '2026-11-08';
const row = (over: Partial<PromoPageRow> = {}): PromoPageRow => ({
  promoId: 'p1', date: '2026-11-12', title: 'Winter Beanie', description: 'All fans receive a winter beanie.', type: 'giveaway',
  displayTime: '7:00 PM', displayOpponent: 'Blackhawks', highlight: false, attendanceCap: null, presentedBy: null,
  whileSuppliesLast: null, gateOpenTime: null, ageRestriction: null, redemptionLocation: null, ticketPackageRequired: null,
  ticketPackageName: null, sourceUrl: null, pageSlug: 'winter-beanie', pageSeason: '2026-27', themeKey: 'none',
  imageTier: null, imageRef: null, imageSourceUrl: null, imageCredit: null, updatedAt: null, tombstoned: false, tombstonedAt: null, tnEventUrl: null, ...over,
});
const page = (r: PromoPageRow, team: Team = WILD): PromoPage => ({ team, slug: r.pageSlug, season: '2026-27', rows: [r], removedRows: [], removedDates: [], state: 'live', primary: r, dates: [r.date], updatedAt: null, removedAt: null, canonicalSlug: null });
const pgGame = (over: Partial<NonNullable<PromoPageContext['game']>> = {}): PromoPageContext['game'] => ({
  date: '2026-11-12', opponentId: HAWKS.id, opponentName: 'Chicago Blackhawks', opponentHref: '/nhl/chicago-blackhawks', timeZone: 'America/Chicago',
  homeGameNumber: 5, homeGamesTotal: 41, seasonLabel: '2026-27', gameId: '2026020245', broadcastNetwork: null, ...over,
});
const pctx = (over: Partial<PromoPageContext> = {}): PromoPageContext => ({
  game: pgGame(), timeline: null, venueGiveaways: null, venue: null, hub: null,
  beforeYouGo: [], quickFacts: [], location: null, coords: { lat: 44.9448, lng: -93.101 }, roof: null, forecast: null, formerNames: [], observedAt: null,
  alsoAtGame: [], nextTeamPromos: [], crossTeam: null, previousEditions: [], previousEdition: null, nextEdition: null, short: null, ebayListings: [], ...over,
} as PromoPageContext);

async function renderPromo(c: PromoPageContext, r = row(), team: Team = WILD, today = TODAY): Promise<string> {
  const { PromoPageView } = await import('../../promo-page/PromoPageView');
  return amp(renderToStaticMarkup(<PromoPageView page={page(r, team)} ctx={c} today={today} now={new Date(`${today}T16:00:00Z`)} />));
}

test('promo page: under "Also on Ticketmaster", above Parking, inside the CTA section; the hop carries surface and team', async () => {
  const h = await renderPromo(pctx());
  assert.deepEqual(fuboLinks(h), ['/go/fubo/nhl/2026020245?s=web_promo_page&t=minnesota-wild&subId3=winter-beanie']);
  // Sub-ID parity: the same subId3 as the page's TicketNetwork link.
  const tnHref = h.match(/href="(https:\/\/ticketnetwork\.lusg\.net\/[^"]+)"/)![1];
  assert.equal(new URL(tnHref).searchParams.get('subId3'), 'winter-beanie');
  const tn = h.indexOf('>Resale tickets<');
  const tm = h.indexOf('Also on Ticketmaster');
  const fubo = h.indexOf('data-fubo-cta');
  const parking = h.indexOf('>Parking<');
  assert.ok(tn > 0 && tn < tm && tm < fubo && fubo < parking, `order tn ${tn} < tm ${tm} < fubo ${fubo} < parking ${parking}`);
  // Same <section> as the ticket CTA: no </section> between Get tickets and the Fubo line.
  assert.ok(!h.slice(tn, fubo).includes('</section>'), 'inside the CTA section');
  assert.ok(h.slice(fubo, parking).includes('Availability varies by market.'));
  assert.match(h.slice(fubo, parking), /rel="noopener noreferrer sponsored"/);
  assertCopy(h);
});

test('promo page: the article gains no direct child (the ad anchors do not move)', async () => {
  const count = (h: string) => {
    // Direct children of <article ...page-content...>: count depth-1 opening tags.
    const start = h.indexOf('>', h.indexOf('<article')) + 1;
    const end = h.lastIndexOf('</article>');
    let depth = 0;
    let n = 0;
    const VOID = /^(img|br|hr|input|meta|link|source|wbr)$/i;
    for (const m of h.slice(start, end).matchAll(/<(\/?)([a-zA-Z][a-zA-Z0-9-]*)[^>]*?(\/?)>/g)) {
      const [, close, tag, selfClose] = m;
      if (close) depth -= 1;
      else {
        if (depth === 0) n += 1;
        if (!selfClose && !VOID.test(tag)) depth += 1;
      }
    }
    return n;
  };
  const withFubo = await renderPromo(pctx());
  const without = await renderPromo(pctx({ game: pgGame({ gameId: null }) }));
  assert.equal(fuboLinks(without).length, 0);
  assert.equal(count(withFubo), count(without));
});

test('promo page: no Fubo on MLB, without a single game id, on a played date, or on an NFL game on Prime', async () => {
  assert.equal(fuboLinks(await renderPromo(pctx(), row(), TWINS)).length, 0, 'MLB');
  assert.equal(fuboLinks(await renderPromo(pctx({ game: pgGame({ gameId: null }) }))).length, 0, 'no game id');
  assert.equal(fuboLinks(await renderPromo(pctx(), row(), WILD, '2026-11-13')).length, 0, 'played');
  assert.equal(fuboLinks(await renderPromo(pctx({ game: null }))).length, 0, 'no game');
  const nfl = pctx({ game: pgGame({ gameId: 'nfl-2026-11-12-buffalo-bills-at-baltimore-ravens', broadcastNetwork: 'Prime Video' }) });
  assert.equal(fuboLinks(await renderPromo(nfl, row(), RAVENS)).length, 0, 'NFL on Prime');
  const cbs = pctx({ game: pgGame({ gameId: 'nfl-2026-11-12-buffalo-bills-at-baltimore-ravens', broadcastNetwork: 'CBS' }) });
  assert.deepEqual(fuboLinks(await renderPromo(cbs, row(), RAVENS)), ['/go/fubo/nfl/nfl-2026-11-12-buffalo-bills-at-baltimore-ravens?s=web_promo_page&t=baltimore-ravens&subId3=winter-beanie']);
});

// ── team-page rows ───────────────────────────────────────────────────────

const game = (over: Partial<Game> = {}): Game =>
  ({ id: 'nfl-2026-11-22-buffalo-bills-at-baltimore-ravens', league: 'nfl', date: '2026-11-22', gameTime: '18:00', gameTimeTz: 'America/New_York', homeTeamSlug: RAVENS.id, awayTeamSlug: BILLS.id, venueName: 'M&T Bank Stadium', status: 'scheduled', ...over }) as Game;
const ctx = (g: Game, isHome: boolean, opponentTeam: Team): GameContext => ({ game: g, isHome, opponentTeam, opponentVenue: null, promos: [] });

async function renderRow(c: GameContext, team: Team, surface?: Parameters<typeof import('../../redesign/GameExpand').GameExpand>[0]['surface']): Promise<string> {
  const { GameExpand } = await import('../../redesign/GameExpand');
  return amp(renderToStaticMarkup(<GameExpand dateStr={c.game.date} contexts={[c]} team={team} teamSlug={team.id} teamName={team.name} surface={surface} />));
}

test('team page: the served HTML never carries the tray Fubo link, for any away row (ruling 3; adversarial finding 1)', async () => {
  // CalendarGrid server-renders hidden GameExpands for windowed dates; the
  // Fubo block mounts on the client only (FuboTrayCTA). The mounted behaviour
  // is in fubo-tray.test.tsx.
  const nhl = game({ id: '2026020300', league: 'nhl', homeTeamSlug: HAWKS.id, awayTeamSlug: WILD.id });
  for (const [c, team, surface] of [
    [ctx(game(), false, RAVENS), BILLS, undefined],
    [ctx(game(), false, RAVENS), BILLS, 'web_team_page_promolist'],
    [ctx(nhl, false, HAWKS), WILD, undefined],
  ] as const) {
    const h = await renderRow(c, team, surface);
    assert.equal(fuboLinks(h).length, 0);
    assert.ok(!h.includes('data-fubo-cta'));
    assert.ok(h.includes('TicketNetwork Resale tickets'), 'the tray itself did render');
  }
});

// ── /promos/today ────────────────────────────────────────────────────────

const todayPromo = (team: Team, over: Partial<PromoWithTeam> = {}): PromoWithTeam =>
  ({ date: '2026-11-22', time: '1:00 PM', opponent: 'Bills', type: 'giveaway', title: 'Rally Towel', description: '', highlight: false, icon: '', recurring: false, displayTime: '1:00 PM', displayOpponent: 'Bills', team, ...over }) as PromoWithTeam;

async function renderCard(p: PromoWithTeam): Promise<string> {
  const { TodayPromoCard } = await import('../../promos-today/TodayPromoCard');
  return amp(renderToStaticMarkup(<TodayPromoCard promo={p} venue={null} surface="web_today" />));
}

test('/promos/today: under the inline ticket row, keyed to the host club', async () => {
  const h = await renderCard(todayPromo(RAVENS, { gameId: 'nfl-2026-11-22-buffalo-bills-at-baltimore-ravens', gameNetwork: 'CBS' }));
  assert.deepEqual(fuboLinks(h), ['/go/fubo/nfl/nfl-2026-11-22-buffalo-bills-at-baltimore-ravens?s=web_today&t=baltimore-ravens']);
  const row = h.indexOf('data-cta-row');
  const rowEnd = h.indexOf('data-fubo-cta');
  assert.ok(row > 0 && row < rowEnd, 'after the ticket row');
  assert.ok(h.slice(row, rowEnd).includes('TicketNetwork Resale tickets'), 'the ticket row precedes it');
  assert.ok(h.includes('Availability varies by market.'));
  assertCopy(h);
});

test('/promos/today: nothing without a joined game id, on Prime, or on MLB', async () => {
  assert.equal(fuboLinks(await renderCard(todayPromo(RAVENS))).length, 0, 'no gameId');
  assert.equal(fuboLinks(await renderCard(todayPromo(RAVENS, { gameId: 'nfl-x', gameNetwork: 'Prime Video' }))).length, 0, 'Prime');
  assert.equal(fuboLinks(await renderCard(todayPromo(TWINS, { gameId: 'mlb-x' }))).length, 0, 'MLB');
});

test('/promos/today: a dimmed (Tomorrow) card inks the Fubo link and line in rd-ink, which holds contrast under opacity-70 (ux-review N1)', async () => {
  const { TodayPromoCard } = await import('../../promos-today/TodayPromoCard');
  const p = todayPromo(RAVENS, { gameId: 'nfl-2026-11-22-buffalo-bills-at-baltimore-ravens' });
  const dim = amp(renderToStaticMarkup(<TodayPromoCard promo={p} venue={null} surface="web_today" dimmed />));
  const block = dim.slice(dim.indexOf('data-fubo-cta'));
  assert.ok(dim.includes('opacity-70'));
  assert.match(block, /<a [^>]*class="[^"]*text-rd-ink[ "][^"]*"[^>]*>Stream on Fubo/);
  assert.ok(!/<a [^>]*text-rd-link[^>]*>Stream on Fubo/.test(block));
  assert.match(block, /<p class="[^"]*text-rd-ink"[^>]*>Availability varies by market\.<\/p>/);
  const lit = await renderCard(p);
  assert.match(lit.slice(lit.indexOf('data-fubo-cta')), /<a [^>]*text-rd-link[^>]*>Stream on Fubo/, 'today cards keep the link red');
});
