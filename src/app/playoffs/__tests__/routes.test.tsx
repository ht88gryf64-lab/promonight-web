// The two routes, end to end on the server side: a fake Firestore serving the
// captured documents, the real data module, the real pages, the real ticket
// buttons. Only the fonts, the team list and the venue lookup are stood in.
import { test, mock } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { renderToStaticMarkup } from 'react-dom/server';
import { FIXTURE, capturedTeams, fakeFirestore, loadDoc, parkNames, seriesKeyIn, venuePages } from '../../../lib/postseason/__tests__/helpers';

type Fake = ReturnType<typeof fakeFirestore>;
const current: { db: Fake } = { db: fakeFirestore({}) };
const db = {
  collection: (name: string) => current.db.collection(name),
  getAll: (...args: unknown[]) => current.db.getAll(...args),
};

mock.module('server-only', { namedExports: {} });
mock.module(new URL('../../../lib/firebase.ts', import.meta.url).href, { namedExports: { db } });
mock.module(new URL('../../../lib/data.ts', import.meta.url).href, {
  namedExports: {
    getAllTeams: async () => capturedTeams(),
    getVenueForTeam: async (id: string) => {
      const name = parkNames().get(id);
      return name ? { name } : null;
    },
  },
});
mock.module(new URL('../../../lib/venue-hub.ts', import.meta.url).href, {
  namedExports: { getTeamVenueHubMap: async () => venuePages() },
});
// next/font needs the Next compiler. The pages only read `.variable`.
mock.module(new URL('../../../components/cfb/rivalry/fonts.ts', import.meta.url).href, {
  namedExports: { barlowCondensed: { variable: 'font-condensed-var' } },
});
mock.module(new URL('../../../components/redesign/fonts-house.ts', import.meta.url).href, {
  namedExports: { archivoHouse: { variable: 'font-archivo-var' } },
});

const hub = () => import('../page');
const league = () => import('../[league]/page');

const FROZEN = { frozenAt: { toDate: () => new Date('2026-09-29T01:05:52.350Z') } };
const BOTH = () => ({
  'postseasonBrackets/MLB_2026': loadDoc(FIXTURE.mlbLive),
  'postseasonBrackets/WNBA_2026': loadDoc(FIXTURE.wnbaLive),
  'predictionInputs/MLB_2026': FROZEN,
  'predictionInputs/WNBA_2026': FROZEN,
});
const quiet = async <T,>(fn: () => Promise<T>): Promise<T> => {
  const original = console.error;
  console.error = () => {};
  try {
    return await fn();
  } finally {
    console.error = original;
  }
};
const count = (html: string, needle: string) => html.split(needle).length - 1;
const params = (slug: string) => ({ params: Promise.resolve({ league: slug }) });

test('ROUTE /playoffs/[league]: an unknown league is a 404, before any read', async () => {
  const { default: Page } = await league();
  for (const slug of ['nba', 'nhl', 'MLB', 'mlb-2026', 'x']) {
    current.db = fakeFirestore(BOTH());
    await assert.rejects(
      () => Page(params(slug)),
      (err: unknown) => String((err as { digest?: string }).digest ?? '').includes('404'),
      slug,
    );
    assert.deepEqual(current.db.reads, [], `${slug} read nothing`);
  }
});

test('ROUTE /playoffs/[league]: mlb and wnba render their brackets', async () => {
  const { default: Page } = await league();
  current.db = fakeFirestore(BOTH());
  const mlb = renderToStaticMarkup(await Page(params('mlb')));
  assert.match(mlb, /<h1[^>]*>2026 MLB Playoffs<\/h1>/);
  assert.equal(count(mlb, 'data-series="'), 11);
  assert.ok(mlb.includes('Open the WNBA bracket'));
  assert.ok(mlb.includes('font-condensed-var') && mlb.includes('font-archivo-var') && mlb.includes('rd-root'));
  const wnba = renderToStaticMarkup(await Page(params('wnba')));
  assert.match(wnba, /<h1[^>]*>2026 WNBA Playoffs<\/h1>/);
  assert.equal(count(wnba, 'data-series="'), 7);
  assert.ok(wnba.includes('Open the MLB bracket'));
});

test('ROUTE /playoffs/[league]: never reads the fields the web must not publish', async () => {
  const { default: Page } = await league();
  current.db = fakeFirestore(BOTH());
  await Page(params('mlb'));
  for (const r of current.db.reads) {
    // The promotion rows are whole documents of the promos subcollection,
    // read by an equality on isPostseason; what leaves them is decided by
    // postseasonPromoRow, tested in promos.test.ts.
    if (/^teams\/[^/]+\/promos$/.test(r.path)) continue;
    assert.ok(r.fieldMask, `${r.path} was read with a mask`);
    for (const f of r.fieldMask) {
      assert.ok(['league', 'season', 'series', 'lastChangedAt', 'frozenAt'].includes(f), `${r.path} asked for ${f}`);
    }
  }
  assert.ok(current.db.reads.some((r) => r.path === 'postseasonBrackets/MLB_2026'));
  assert.ok(current.db.reads.some((r) => r.path === 'teams/houston-astros/promos'), 'the host clubs are asked for their postseason promotions');
});

// NOTHING IS EVER SERVED AS "NOT AVAILABLE". A league with no document is a
// 404, which is not indexable and not cached as a page. A read that fails,
// and a document the web cannot read, throw out of the render: ISR then
// keeps the last good page instead of replacing it for ten minutes with a
// page that says the bracket is unavailable, under a title that promises it.
test('ROUTE /playoffs/[league]: no document is a 404; a failed read throws', async () => {
  const { default: Page, generateMetadata } = await league();
  current.db = fakeFirestore({ 'postseasonBrackets/WNBA_2026': loadDoc(FIXTURE.wnbaLive) });
  await assert.rejects(() => Page(params('mlb')), (e: unknown) => /NEXT_NOT_FOUND|NEXT_HTTP_ERROR_FALLBACK;404/.test(String((e as { digest?: string }).digest ?? e)));
  assert.deepEqual(await generateMetadata(params('mlb')), {}, 'no head of its own for a 404');

  current.db = fakeFirestore({ 'postseasonBrackets/MLB_2026': new Error('UNAVAILABLE'), 'postseasonBrackets/WNBA_2026': new Error('UNAVAILABLE') });
  await assert.rejects(() => Page(params('mlb')), /UNAVAILABLE/);
  await assert.rejects(() => generateMetadata(params('mlb')), /UNAVAILABLE/);

  // A document the web cannot read is the same: nothing renders.
  const bad = loadDoc(FIXTURE.mlbLive);
  (bad.series as Record<string, unknown>[])[0].status = 'paused';
  current.db = fakeFirestore({ 'postseasonBrackets/MLB_2026': bad });
  await assert.rejects(() => Page(params('mlb')), /not in a shape the web reads/);
});

test('ROUTE /playoffs/[league]: the cross link names only a league whose read succeeded and whose postseason is underway', async () => {
  const { default: Page } = await league();
  current.db = fakeFirestore({ 'postseasonBrackets/MLB_2026': loadDoc(FIXTURE.mlbLive), 'postseasonBrackets/WNBA_2026': loadDoc(FIXTURE.wnbaLive) });
  assert.ok(renderToStaticMarkup(await Page(params('mlb'))).includes('Open the WNBA bracket'));
  current.db = fakeFirestore({ 'postseasonBrackets/MLB_2026': loadDoc(FIXTURE.mlbLive) });
  assert.ok(!renderToStaticMarkup(await Page(params('mlb'))).includes('Open the WNBA bracket'), 'no link to a league with no document');
  // The other league's read failing costs the link and never the page:
  // this page is about its own document, and that one was read.
  current.db = fakeFirestore({ 'postseasonBrackets/MLB_2026': loadDoc(FIXTURE.mlbLive), 'postseasonBrackets/WNBA_2026': new Error('UNAVAILABLE') });
  const alone = renderToStaticMarkup(await quiet(() => Page(params('mlb'))));
  assert.ok(!alone.includes('Open the WNBA bracket'), 'no link to a league that could not be read');
  assert.equal(count(alone, 'data-series="'), 11, 'the page itself is whole');
});

test('ROUTE /playoffs/[league]: ticket links carry the league surface in their sub-ID', async () => {
  const { default: Page } = await league();
  current.db = fakeFirestore(BOTH());
  const html = renderToStaticMarkup(await Page(params('mlb')));
  assert.ok(count(html, 'data-tickets-for="houston-astros"') > 0);
  const links = [...html.matchAll(/<a [^>]*href="([^"]+)"[^>]*rel="noopener noreferrer sponsored"/g)].map((m) => m[1].replace(/&amp;/g, '&'));
  assert.ok(links.length > 0, 'ticket links are in the markup');
  assert.ok(links.every((h) => /^https:\/\//.test(h)));
  assert.ok(links.some((h) => h.includes('web_playoffs_league_houston-astros')), 'the sub-ID names the league surface and the host');
  assert.ok(!links.some((h) => /web_playoffs_(?!league_)/.test(h)), 'no link from a league page is tagged as the hub');
});

test('ROUTE /playoffs/[league]: a home games row carries ONE ticket button, the partner that leads the stack', async () => {
  const { default: Page } = await league();
  current.db = fakeFirestore(BOTH());
  const html = renderToStaticMarkup(await Page(params('mlb')));
  const rows = [...html.matchAll(/<li data-home-game="[^"]+"[\s\S]*?<\/li>/g)].map((m) => m[0]);
  assert.ok(rows.length > 8, 'the short list and the rest of the week');
  for (const row of rows) {
    assert.equal(count(row, 'rel="noopener noreferrer sponsored"'), 1, 'one ticket link to a row');
    assert.equal(count(row, 'aria-label="Get tickets on TicketNetwork"'), 1);
    assert.equal(count(row, 'aria-label="Get tickets on Ticketmaster"'), 0);
  }
  // The series detail keeps the full block: both partners, for one host.
  const panel = /<section id="wild_card-1"[\s\S]*?<\/section>/.exec(html)?.[0] ?? '';
  assert.equal(count(panel, 'aria-label="Get tickets on TicketNetwork"'), 1);
  assert.equal(count(panel, 'aria-label="Get tickets on Ticketmaster"'), 1);
  assert.ok(panel.includes('web_playoffs_league_houston-astros'));
});

test('ROUTE /playoffs/[league]: every internal link is there in the server HTML, to the right place', async () => {
  const { default: Page } = await league();
  current.db = fakeFirestore(BOTH());
  const html = renderToStaticMarkup(await Page(params('mlb')));
  for (const href of ['/playoffs', '/playoffs/wnba', '/mlb/houston-astros', '/mlb/chicago-white-sox', '/venues/daikin-park', '/venues/truist-park', '#wild_card-1', '#world_series-1']) {
    assert.ok(html.includes(`href="${href}"`), href);
  }
  // No link on the page points at a series by the pipeline's key.
  assert.ok(![...html.matchAll(/href="([^"]*)"/g)].some((m) => seriesKeyIn(m[1].split('?')[0]) !== null || /#[A-Z]/.test(m[1])));
});

test('ROUTE /playoffs: both leagues, the next home games, hub-tagged ticket links', async () => {
  const { default: Page } = await hub();
  current.db = fakeFirestore(BOTH());
  const html = renderToStaticMarkup(await Page());
  assert.match(html, /<h1[^>]*>Playoffs<\/h1>/);
  assert.equal(count(html, 'data-league-card="'), 2);
  const short = /<ul data-home-games-list="primary"[\s\S]*?<\/ul>/.exec(html)?.[0] ?? '';
  assert.equal(count(short, 'data-home-game="'), 8);
  assert.equal(count(short, 'rel="noopener noreferrer sponsored"'), 8, 'one ticket link to a row');
  assert.ok(html.includes('href="/playoffs/mlb#wild_card-1"'));
  assert.ok(html.includes('href="/playoffs/wnba#first_round-1"'));
  assert.equal(count(html, 'data-predictions="locked"'), 1);
  const links = [...html.matchAll(/<a [^>]*href="([^"]+)"[^>]*rel="noopener noreferrer sponsored"/g)].map((m) => m[1].replace(/&amp;/g, '&'));
  assert.ok(links.some((h) => h.includes('web_playoffs_atlanta-braves')));
  assert.ok(!links.some((h) => h.includes('web_playoffs_league')), 'no link from the hub is tagged as a league page');
});

test('FEEDER KEY: through the real pages, the label renders and "AL-WC-B" is nowhere in the HTML', async () => {
  const { default: League } = await league();
  const { default: Hub } = await hub();
  type Raw = { seriesKey: string; lower: Record<string, unknown> };
  for (const extra of [
    { feederSeriesKey: 'AL-WC-B', candidates: null },
    { feederSeriesKey: 'AL-WC-B' },
    { feederSeriesKey: 'AL-WC-B', candidates: ['new-york-yankees', 'boston-red-sox'] },
  ]) {
    const docs = BOTH();
    const mlb = docs['postseasonBrackets/MLB_2026'] as { series: Raw[] };
    Object.assign((mlb.series.find((x) => x.seriesKey === 'AL-DS-A') as Raw).lower, extra);
    current.db = fakeFirestore(docs);
    const page = renderToStaticMarkup(await League(params('mlb')));
    const text = extra.candidates ? 'Yankees / Red Sox winner' : 'NYY/BOS';
    assert.ok(page.includes(`<span class="min-w-0">${text}</span>`), JSON.stringify(extra));
    assert.equal(count(page, 'AL-WC-B'), 0, `league page, ${JSON.stringify(extra)}`);
    assert.equal(count(renderToStaticMarkup(await League(params('wnba'))), 'AL-WC-B'), 0);
    assert.equal(count(renderToStaticMarkup(await Hub()), 'AL-WC-B'), 0, `hub, ${JSON.stringify(extra)}`);
  }
});

test('ROUTE /playoffs: no documents is the offseason state; a failed read throws', async () => {
  const { default: Page, generateMetadata } = await hub();
  current.db = fakeFirestore({});
  const off = renderToStaticMarkup(await Page());
  assert.equal(count(off, 'data-hub-state="offseason"'), 1);
  assert.equal(count(off, 'data-league-card="'), 0);

  current.db = fakeFirestore({ 'postseasonBrackets/MLB_2026': new Error('UNAVAILABLE') });
  await assert.rejects(() => Page(), /UNAVAILABLE/);
  await assert.rejects(() => generateMetadata(), /UNAVAILABLE/);
});

test('ROUTE /playoffs/[league]: static params are the leagues that have a document', async () => {
  // Read through the uncached function: the cached one is process wide.
  const { readLeaguesWithBracket } = await import('../../../lib/postseason/data');
  current.db = fakeFirestore({ 'postseasonBrackets/WNBA_2026': loadDoc(FIXTURE.wnbaLive) });
  assert.deepEqual((await readLeaguesWithBracket()).map((l) => ({ league: l.toLowerCase() })), [{ league: 'wnba' }]);
  const src = readFileSync(new URL('../[league]/page.tsx', import.meta.url), 'utf8');
  assert.match(src, /generateStaticParams[\s\S]*getLeaguesWithBracket\(\)[\s\S]*league: l\.toLowerCase\(\)/);
});

// ---- Source-level rules the pages must keep ----

const HUB_SRC = readFileSync(new URL('../page.tsx', import.meta.url), 'utf8');
const LEAGUE_SRC = readFileSync(new URL('../[league]/page.tsx', import.meta.url), 'utf8');

test('a page that mounts rd-root binds the Archivo variable rd-root reads', () => {
  for (const [name, src] of [['hub', HUB_SRC], ['league', LEAGUE_SRC]] as const) {
    assert.ok(/\brd-root\b/.test(src), `${name} mounts rd-root`);
    assert.ok(/archivoHouse\.variable/.test(src), `${name} binds --font-archivo`);
    assert.ok(/fonts-house/.test(src), `${name} takes it from the preload:false instance`);
    assert.ok(/barlowCondensed\.variable/.test(src), `${name} binds the display face`);
  }
});

test('the pages take no font of their own and no palette of their own', () => {
  for (const src of [HUB_SRC, LEAGUE_SRC]) {
    assert.ok(!/next\/font/.test(src), 'no new font module');
    assert.ok(!/#[0-9a-fA-F]{6}\b/.test(src), 'no hex color in a page');
  }
});

// ---- The head says what the body says ----

type Meta = { title?: unknown; description?: unknown; alternates?: { canonical?: unknown }; openGraph?: { url?: unknown; images?: { url: string; alt: string }[] }; robots?: unknown };

test('HEAD /playoffs/[league]: title, description, canonical and a complete openGraph, from the body\'s own read', async () => {
  const { generateMetadata, default: Page } = await league();
  current.db = fakeFirestore(BOTH());
  const meta = (await generateMetadata(params('mlb'))) as Meta;
  assert.equal(meta.title, '2026 MLB Playoffs Bracket, Schedule and Scores');
  assert.equal(meta.description, 'The 2026 MLB postseason bracket. Current round: Wild Card Series. Every series, seed and result, with game times in Eastern and the home games coming up.');
  assert.equal(meta.alternates?.canonical, 'https://www.getpromonight.com/playoffs/mlb');
  assert.equal(meta.openGraph?.url, 'https://www.getpromonight.com/playoffs/mlb', 'og:url is the canonical, not the homepage');
  assert.equal(meta.openGraph?.images?.length, 1);
  assert.equal(meta.openGraph?.images?.[0].url, '/og-image.png');
  const { OG_IMAGE_ALT } = await import('../../../lib/og');
  assert.equal(meta.openGraph?.images?.[0].alt, OG_IMAGE_ALT);
  assert.ok(OG_IMAGE_ALT.startsWith('PromoNight: '));
  // The body agrees with it.
  const html = renderToStaticMarkup(await Page(params('mlb')));
  assert.ok(html.includes('Current round'));
  assert.ok(html.includes('Wild Card Series'));
});

test('HEAD /playoffs/[league]: a route outside the table, and a league with no document, get no head of their own', async () => {
  const { generateMetadata } = await league();
  current.db = fakeFirestore({});
  assert.deepEqual(await generateMetadata(params('mlb')), {}, 'no document: the page is a 404');
  assert.deepEqual(await generateMetadata(params('nba')), {}, 'a league outside the route table gets no head of its own; the page is a 404');
});

test('HEAD /playoffs: the three states of the hub', async () => {
  const { generateMetadata } = await hub();
  current.db = fakeFirestore(BOTH());
  const playing = (await generateMetadata()) as Meta;
  assert.equal(playing.title, '2026 Playoffs: MLB and WNBA Brackets');
  assert.equal(playing.description, 'The 2026 postseason brackets for MLB and WNBA, series by series, with Eastern game times and the next home games. MLB: Wild Card Series. WNBA: First Round.');
  assert.equal(playing.alternates?.canonical, 'https://www.getpromonight.com/playoffs');
  assert.equal(playing.openGraph?.url, 'https://www.getpromonight.com/playoffs');
  assert.equal(playing.openGraph?.images?.[0].url, '/og-image.png');

  current.db = fakeFirestore({});
  assert.equal(((await generateMetadata()) as Meta).description, "No postseason is underway. The MLB and WNBA brackets appear here once each league's postseason begins.");

  // A finished postseason is the third state: complete, with each champion.
  const finalMlb = loadDoc(FIXTURE.mlbFinal);
  const finalWnba = loadDoc(FIXTURE.wnbaFinal);
  current.db = fakeFirestore({ 'postseasonBrackets/MLB_2026': { ...finalMlb, season: 2026 }, 'postseasonBrackets/WNBA_2026': { ...finalWnba, season: 2026 } });
  const done = (await generateMetadata()) as Meta;
  assert.equal(done.description, 'The 2026 MLB and WNBA postseason is complete. The final brackets, round by round, with each champion.');
});

test('JSON-LD in the page: a WebPage and a BreadcrumbList on each route, and no Event', async () => {
  const { default: League } = await league();
  const { default: Hub } = await hub();
  current.db = fakeFirestore(BOTH());
  for (const [name, html, crumbs] of [
    ['mlb', renderToStaticMarkup(await League(params('mlb'))), 3],
    ['wnba', renderToStaticMarkup(await League(params('wnba'))), 3],
    ['hub', renderToStaticMarkup(await Hub()), 2],
  ] as const) {
    const blocks = [...html.matchAll(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/g)].map((m) => JSON.parse(m[1]) as Record<string, unknown>);
    assert.deepEqual(blocks.map((b) => b['@type']), ['WebPage', 'BreadcrumbList'], name);
    assert.equal((blocks[1].itemListElement as unknown[]).length, crumbs, name);
    assert.equal(typeof blocks[0].dateModified, 'string', name);
    assert.ok(!/"@type":"(Sports)?Event"/.test(html), `${name}: Event markup`);
    assert.ok(!/startDate|"location"|"offers"/.test(html), name);
    assert.equal(seriesKeyIn(blocks.map((b) => JSON.stringify(b)).join('')), null, name);
  }
});

test('ARTICLE through the real pages: one article, which is the page-content wrapper, on each route', async () => {
  const { default: League } = await league();
  const { default: Hub } = await hub();
  current.db = fakeFirestore(BOTH());
  for (const [name, html] of [['mlb', renderToStaticMarkup(await League(params('mlb')))], ['wnba', renderToStaticMarkup(await League(params('wnba')))], ['hub', renderToStaticMarkup(await Hub())]] as const) {
    assert.equal(count(html, '<article'), 1, name);
    assert.match(html, /<article class="page-content" data-ad-region="content" data-playoffs-article="(league|hub)">/, name);
    assert.equal(count(html, 'class="page-content"'), 1, name);
    assert.equal(count(html, '<aside'), 0, name);
    // With no ad network set, a slot renders nothing: no empty box is a
    // child of the article.
    assert.equal(count(html, 'data-ad-slot'), 0, name);
  }
});

test('the sitemap lists the playoffs pages under the same gate as the link', () => {
  const sitemap = readFileSync(new URL('../../sitemap.ts', import.meta.url), 'utf8');
  assert.match(sitemap, /getPlayoffsSitemapEntries\(now\)/);
  assert.ok(!/url: `\$\{BASE_URL\}\/playoffs`/.test(sitemap), 'the hardcoded /playoffs entry is gone');
  assert.ok(!/changeFrequency: 'hourly'/.test(sitemap), 'no cadence is claimed that nothing proves');
  // A failed read throws. It is not swallowed into a sitemap without the pages.
  assert.match(sitemap, /getPlayoffsSitemapEntries\(now\)\.catch\(\(err\) => \{[\s\S]*?throw err;/);
});

test('the old flag no longer gates the Playoffs link', () => {
  const layout = readFileSync(new URL('../../layout.tsx', import.meta.url), 'utf8');
  assert.ok(/isPlayoffsLinkActive/.test(layout));
  assert.ok(!/getPlayoffConfig/.test(layout), 'the layout no longer reads appConfig/playoffs');
  assert.match(layout, /playoffsActive = await isPlayoffsLinkActive\(\)/);
  // Fail-closed: the read sits in a try, and the default is false.
  assert.match(layout, /let playoffsActive = false;\s*try \{\s*playoffsActive = await isPlayoffsLinkActive\(\);\s*\} catch/);
});
