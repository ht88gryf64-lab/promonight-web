// eBay product images on bobblehead pages (step 5a, 2026-11-08): the guard,
// the picker and the call. Run with:
// TSX_TSCONFIG_PATH=tsconfig.test.json node --import tsx --experimental-test-module-mocks --test src/lib/__tests__/ebay-browse.test.ts
import { test, mock, beforeEach } from 'node:test';
import assert from 'node:assert/strict';

process.env.NEXT_PUBLIC_EBAY_CAMPID = '5339000000';
process.env.EBAY_CLIENT_ID = 'app-id';
process.env.EBAY_CLIENT_SECRET = 'cert-id';
mock.module('server-only', { namedExports: {} });

// The module under test is loaded after the mocks (tsx emits CJS here, so no
// top-level await): every test takes it from `load()`.
const load = () => import('../ebay-browse');
type Api = Awaited<ReturnType<typeof load>>;

const NETS = { id: 'brooklyn-nets', city: 'Brooklyn', name: 'Nets', abbreviation: 'BKN' };
const DUCKS = { id: 'anaheim-ducks', city: 'Anaheim', name: 'Ducks', abbreviation: 'ANA' };
const erving = { date: '2026-11-18', title: 'Julius Erving Bobblehead', type: 'giveaway' as const };

// ── the guard ────────────────────────────────────────────────────────────────

test('product tokens: the player surname and specific product words survive; category nouns, the club and years do not', async () => {
  const { IMAGE_TOKEN_STOPLIST, productTokens } = await load();
  assert.deepEqual(productTokens('Julius Erving Bobblehead', NETS), ['julius', 'erving']);
  assert.deepEqual(productTokens('Cutter Gauthier Bobblehead Giveaway', DUCKS), ['cutter', 'gauthier']);
  assert.deepEqual(productTokens('Peanuts Snoopy Bobblehead', { city: 'Pittsburgh', name: 'Penguins' }), ['peanuts', 'snoopy']);
  assert.deepEqual(productTokens('Alex Ovechkin Hometown Remix Bobblehead', { city: 'Washington', name: 'Capitals' }), ['alex', 'ovechkin']);
  assert.deepEqual(productTokens('Joakim Noah Statement Edition Bobblehead', { city: 'Chicago', name: 'Bulls' }), ['joakim', 'noah']);
  assert.deepEqual(productTokens('Golden Dubs Bobblehead', { city: 'Golden State', name: 'Warriors' }), ['dubs']);
  assert.deepEqual(productTokens('Stephen Curry Mini Bobblehead Blind Box', { city: 'Golden State', name: 'Warriors' }), ['stephen', 'curry']);
  // A letter-and-digit token is a product word at any length; "Dr. J" alone is not.
  assert.deepEqual(productTokens('R2-D2 Bobblehead', { city: 'San Francisco', name: 'Giants' }), ['r2', 'd2']);
  assert.deepEqual(productTokens('Dr. J Bobblehead', NETS), []);
  // Nothing specific: no token, so no block and no call.
  assert.deepEqual(productTokens('Mystery Bobblehead', { city: 'Ottawa', name: 'Senators' }), []);
  assert.deepEqual(productTokens('Bobblehead Night', { city: 'Montreal', name: 'Canadiens' }), []);
  assert.deepEqual(productTokens('2026 Ducks Bobblehead Giveaway', DUCKS), []);
  for (const w of ['bobblehead', 'giveaway', 'night', 'edition', 'statement', 'mini', 'sga', 'nhl', 'hockey']) assert.ok(IMAGE_TOKEN_STOPLIST.has(w), w);
});

test('a listing is confirmed by a whole-word match on a product token, never by a category noun or a prefix', async () => {
  const { listingConfirmed, productTokens, titleYears, tokenize } = await load();
  const tokens = productTokens('Ilya Sorokin Bobblehead Night', { city: 'New York', name: 'Islanders' });
  assert.deepEqual(tokens, ['ilya', 'sorokin']);
  const g = { tokens, year: 2026 };
  assert.ok(listingConfirmed('2026 Ilya Sorokin New York Islanders Bobblehead SGA 11/27', g));
  assert.ok(listingConfirmed("Sorokin's Islanders bobblehead, sealed", g), 'possessive');
  assert.ok(!listingConfirmed('New York Islanders Bobblehead Night 2026 SGA', g), 'category nouns and the club never confirm');
  assert.ok(!listingConfirmed('Sorokinsky figure', g), 'no prefix match');
  assert.ok(!listingConfirmed('Anything', { tokens: [], year: 2026 }), 'no tokens, nothing confirms');
  // Another edition's year is out; the season's neighbouring years and a
  // title with no year are in (ux-review D2).
  assert.ok(!listingConfirmed('2012-13 Ilya Sorokin Bobblehead Toyota Mini Series SGA NIB', g), 'another year');
  assert.ok(listingConfirmed('2026-27 Sorokin Islanders bobblehead', g));
  assert.ok(listingConfirmed('Sorokin 2025 Islanders bobblehead presale', g), 'the season spans the year before');
  assert.ok(listingConfirmed('Sorokin bobblehead 2027 game', g), 'and the year after');
  assert.ok(listingConfirmed("Sorokin 80's style bobblehead 11/27 for 76ers fans", g), 'no four-digit year');
  assert.ok(listingConfirmed('2012 Sorokin bobblehead', { tokens, year: null }), 'no promo year, no year rule');
  assert.deepEqual(titleYears('2012-13 Julius Erving Bobblehead Philadelphia 76ers 11/18'), [2012, 2013]);
  assert.deepEqual(titleYears('2026 Dr. J Nets SGA'), [2026]);
  assert.deepEqual(titleYears("80's ABA 11/18"), []);
  // The heading word (ruling 2026-11-08): the token the most listings matched
  // on, a tie to the later token, spelled as the promo title spells it.
  const { ebayHeading, ebayHeadingWord } = await load();
  const nets = { city: 'Brooklyn', name: 'Nets' };
  assert.equal(ebayHeadingWord('Julius Erving Bobblehead', nets, ['PRESALE 2026 Dr. J Julius Erving Brooklyn Nets SGA Bobblehead', '2026 Dr. J Julius Erving Nets Bobblehead', "Dr J Black Panther Bobblehead Marvel's Brooklyn Nets Julius Erving SGA"]), 'Erving');
  assert.equal(ebayHeadingWord('Julius Erving Bobblehead', nets, ['Julius bobblehead', 'Julius again']), 'Julius', 'the token the listings matched on');
  assert.equal(ebayHeadingWord('Peanuts Snoopy Bobblehead', { city: 'Pittsburgh', name: 'Penguins' }, ['Snoopy Penguins bobblehead 2026']), 'Snoopy');
  assert.equal(ebayHeadingWord('R2-D2 Bobblehead', { city: 'San Francisco', name: 'Giants' }, ['2026 Giants R2-D2 bobblehead SGA']), 'R2-D2', 'the hyphenated word as the title spells it');
  assert.equal(ebayHeadingWord("Ovechkin's Hometown Remix Bobblehead", { city: 'Washington', name: 'Capitals' }, ["Ovechkin's bobblehead"]), 'Ovechkin', 'the possessive dropped');
  assert.equal(ebayHeadingWord('Mystery Bobblehead', { city: 'Ottawa', name: 'Senators' }, ['Senators mystery bobblehead']), null);
  assert.equal(ebayHeadingWord('Julius Erving Bobblehead', nets, []), null, 'no listings, no word');
  assert.equal(ebayHeading('Erving'), 'Erving bobbleheads on eBay');
  assert.equal(ebayHeading(null), 'Bobbleheads on eBay');
  assert.deepEqual(tokenize("Dr. J's Nets Bobblehead (NIB)"), ['dr', 'j', 'nets', 'bobblehead', 'nib']);
});

test('the price prints as the site prints money; the query is the search link’s own', async () => {
  const { ebayListingsQuery, formatPrice } = await load();
  assert.equal(formatPrice('24.99', 'USD'), '$24.99');
  assert.equal(formatPrice('65', 'USD'), '$65.00');
  assert.equal(formatPrice('30.5', 'CAD'), '30.50 CAD');
  assert.equal(formatPrice('', 'USD'), null);
  assert.equal(formatPrice('free', 'USD'), null);
  assert.equal(ebayListingsQuery({ promo: erving, team: NETS }), '2026 Nets Julius Erving bobblehead');
});

const summary = (id: string, title: string, over: Record<string, unknown> = {}) => ({
  itemId: `v1|${id}|0`,
  title,
  image: { imageUrl: `https://i.ebayimg.com/images/g/${id}/s-l500.webp` },
  price: { value: '59.99', currency: 'USD' },
  itemWebUrl: `https://www.ebay.com/itm/${id}`,
  itemAffiliateWebUrl: `https://www.ebay.com/itm/${id}?mkevt=1&mkcid=1&mkrid=711-53200-19255-0&campid=5339000000&customid=web_promo_page_x&toolid=10001`,
  ...over,
});

test('the picker keeps confirmed listings with an image and a price, in order, at most three, one per item, image at 400px, the API’s affiliate link first', async () => {
  const { pickListings, productTokens } = await load();
  const tokens = productTokens(erving.title, NETS);
  const guard = { tokens, year: 2026 };
  const picked = pickListings(
    [
      summary('1', 'PRESALE 2026 Dr. J Julius Erving Brooklyn Nets SGA Bobblehead 11/18'),
      summary('2', 'Brooklyn Nets 2026 Bobblehead Night SGA'), // the club and the kind only
      summary('3', '2026 Dr. J Julius Erving Brooklyn Nets Bobblehead', { image: null, thumbnailImages: [{ imageUrl: 'https://i.ebayimg.com/images/g/3/s-l225.jpg' }] }),
      summary('4', 'Julius Erving Bobblehead 76ers Toyota Mini Series', { price: { value: '', currency: 'USD' } }), // no price
      summary('7', '2012-13 Julius Erving Bobblehead Philadelphia 76ers Toyota Mini Series SGA NIB'), // another edition's year
      summary('5', 'Dr J Black Panther Bobblehead Marvel Brooklyn Nets Julius Erving SGA', { itemAffiliateWebUrl: undefined }),
      summary('1', 'PRESALE 2026 Dr. J Julius Erving Brooklyn Nets SGA Bobblehead 11/18'), // repeated
      summary('6', 'Erving 2026 Nets bobblehead'),
    ],
    guard,
    'web_promo_page_brooklyn_nets_2026_11_18_Julius_Erving_Bobblehead',
  );
  assert.deepEqual(picked.map((l) => l.itemId), ['v1|1|0', 'v1|3|0', 'v1|5|0']);
  assert.equal(picked[0].imageUrl, 'https://i.ebayimg.com/images/g/1/s-l400.webp');
  assert.equal(picked[1].imageUrl, 'https://i.ebayimg.com/images/g/3/s-l400.jpg', 'the thumbnail when the image is missing');
  assert.equal(picked[0].price, '$59.99');
  assert.equal(picked[0].href, summary('1', '').itemAffiliateWebUrl, 'the API’s affiliate link');
  // Without one, the item link carries the search link's parameters.
  const u = new URL(picked[2].href);
  assert.equal(u.origin + u.pathname, 'https://www.ebay.com/itm/5');
  assert.equal(u.searchParams.get('campid'), '5339000000');
  assert.equal(u.searchParams.get('customid'), 'web_promo_page_brooklyn_nets_2026_11_18_Julius_Erving_Bobblehead');
  assert.equal(u.searchParams.get('mkrid'), '711-53200-19255-0');
  assert.equal(u.searchParams.get('toolid'), '10001');
  assert.deepEqual(pickListings(undefined, guard, 'x'), []);
  assert.deepEqual(pickListings([summary('9', 'Julius Erving bobblehead', { itemWebUrl: 'https://evil.example/itm/9' })], guard, 'x'), [], 'only ebay.com item links');
});

// ── the call ─────────────────────────────────────────────────────────────────

type Handler = (url: string, init?: RequestInit) => Promise<Response> | Response;
let handler: Handler = () => new Response('', { status: 500 });
const calls: { url: string; headers: Headers }[] = [];
globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
  const url = String(input instanceof Request ? input.url : input);
  calls.push({ url, headers: new Headers(init?.headers) });
  return handler(url, init);
}) as typeof fetch;

const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } });
const TOKEN = 'https://api.ebay.com/identity/v1/oauth2/token';
const SEARCH = 'https://api.ebay.com/buy/browse/v1/item_summary/search';
const okHandler = (summaries: unknown[]): Handler => (url) => {
  if (url === TOKEN) return json({ access_token: 'tok', expires_in: 7200, token_type: 'Application Access Token' });
  if (url.startsWith(SEARCH)) return json({ itemSummaries: summaries, total: summaries.length });
  return new Response('', { status: 404 });
};

let warns: string[] = [];
let api: Api;
beforeEach(async () => {
  api = await load();
  api._resetEbayBrowseForTests();
  calls.length = 0;
  warns = [];
  process.env.EBAY_CLIENT_ID = 'app-id';
  process.env.EBAY_CLIENT_SECRET = 'cert-id';
  mock.method(console, 'warn', (...args: unknown[]) => { warns.push(args.map(String).join(' ')); });
});

const input = { promo: erving, team: NETS, pageKey: '/nba/brooklyn-nets/promos/julius-erving-bobblehead' };

test('a successful call: the token once, the search with the query and the EPN header, three confirmed listings back', async () => {
  handler = okHandler([summary('1', 'Julius Erving Nets bobblehead'), summary('2', 'Nets bobblehead night'), summary('3', 'Dr J Erving bobble'), summary('4', 'Erving SGA'), summary('5', 'Erving again')]);
  const got = await api.ebayListingsFor(input);
  assert.deepEqual(got.map((l) => l.itemId), ['v1|1|0', 'v1|3|0', 'v1|4|0']);
  assert.equal(calls.length, 2);
  assert.equal(calls[0].url, TOKEN);
  assert.match(calls[0].headers.get('authorization') ?? '', /^Basic /);
  const search = new URL(calls[1].url);
  assert.equal(search.searchParams.get('q'), '2026 Nets Julius Erving bobblehead');
  assert.equal(calls[1].headers.get('authorization'), 'Bearer tok');
  assert.equal(calls[1].headers.get('x-ebay-c-marketplace-id'), 'EBAY_US');
  assert.equal(calls[1].headers.get('x-ebay-c-enduserctx'), 'affiliateCampaignId=5339000000,affiliateReferenceId=web_promo_page_brooklyn_nets_2026_11_18_Julius_Erving_Bobblehead');
  assert.deepEqual(warns, []);
  // The token is kept: a second page makes one call.
  await api.ebayListingsFor({ ...input, pageKey: '/other' });
  assert.equal(calls.length, 3);
  assert.equal(calls[2].url.startsWith(SEARCH), true);
});

test('zero confirmed listings is an empty result and no failure; not a bobblehead or nothing to confirm asks eBay nothing', async () => {
  handler = okHandler([summary('1', 'Brooklyn Nets 2026 bobblehead night SGA'), summary('2', 'Kevin Durant Nets bobblehead')]);
  assert.deepEqual(await api.ebayListingsFor(input), []);
  assert.equal(calls.length, 2);
  assert.deepEqual(warns, []);
  calls.length = 0;
  assert.deepEqual(await api.ebayListingsFor({ ...input, promo: { ...erving, type: 'theme' } }), []);
  assert.deepEqual(await api.ebayListingsFor({ ...input, promo: { ...erving, title: 'Mystery Bobblehead' } }), []);
  assert.equal(calls.length, 0, 'no call');
});

test('an API error, a rate limit and a bad token body each render nothing, log once per page per window, and never throw', async () => {
  handler = (url) => (url === TOKEN ? json({ access_token: 'tok', expires_in: 7200 }) : new Response('slow down', { status: 429 }));
  assert.deepEqual(await api.ebayListingsFor(input), []);
  assert.deepEqual(await api.ebayListingsFor(input), [], 'the second call in the window');
  assert.equal(warns.length, 1, 'logged once for the page');
  assert.match(warns[0], /\/nba\/brooklyn-nets\/promos\/julius-erving-bobblehead: no block \(rate limited \(429\)\)/);
  assert.deepEqual(await api.ebayListingsFor({ ...input, pageKey: '/nba/brooklyn-nets/promos/other' }), []);
  assert.equal(warns.length, 2, 'another page logs its own line');

  api._resetEbayBrowseForTests();
  handler = (url) => (url === TOKEN ? json({ access_token: 'tok', expires_in: 7200 }) : new Response('', { status: 500 }));
  assert.deepEqual(await api.ebayListingsFor(input), []);
  assert.match(warns[2], /search HTTP 500/);

  api._resetEbayBrowseForTests();
  handler = () => new Response('', { status: 401 });
  assert.deepEqual(await api.ebayListingsFor(input), []);
  assert.match(warns[3], /token HTTP 401/);

  api._resetEbayBrowseForTests();
  handler = () => { throw new TypeError('fetch failed'); };
  assert.deepEqual(await api.ebayListingsFor(input), []);
  assert.match(warns[4], /fetch failed/);

  api._resetEbayBrowseForTests();
  handler = (url) => (url === TOKEN ? json({ access_token: 'tok', expires_in: 7200 }) : new Response('not json', { status: 200 }));
  assert.deepEqual(await api.ebayListingsFor(input), []);
  assert.equal(warns.length, 6);
});

test('a call past 800ms is abandoned: nothing rendered, the timeout logged', async () => {
  handler = (url, init) =>
    new Promise<Response>((resolve, reject) => {
      if (url === TOKEN) return resolve(json({ access_token: 'tok', expires_in: 7200 }));
      init?.signal?.addEventListener('abort', () => reject(new DOMException('aborted', 'AbortError')));
    });
  const t0 = Date.now();
  assert.deepEqual(await api.ebayListingsFor(input), []);
  const took = Date.now() - t0;
  assert.ok(took >= api.EBAY_TIMEOUT_MS - 50 && took < api.EBAY_TIMEOUT_MS + 700, `took ${took}ms`);
  assert.equal(warns.length, 1);
  assert.match(warns[0], /timeout past 800ms/);
});

test('missing credentials render nothing, log once, and make no call', async () => {
  handler = okHandler([summary('1', 'Julius Erving Nets bobblehead')]);
  process.env.EBAY_CLIENT_SECRET = '';
  assert.deepEqual(await api.ebayListingsFor(input), []);
  assert.deepEqual(await api.ebayListingsFor(input), []);
  assert.equal(calls.length, 0);
  assert.equal(warns.length, 1);
  assert.match(warns[0], /missing credentials/);
});
