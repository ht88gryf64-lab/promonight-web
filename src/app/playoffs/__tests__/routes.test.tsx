// The two routes, end to end on the server side: a fake Firestore serving the
// captured documents, the real data module, the real pages, the real ticket
// buttons. Only the fonts, the team list and the venue lookup are stood in.
import { test, mock } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { renderToStaticMarkup } from 'react-dom/server';
import { FIXTURE, capturedTeams, fakeFirestore, loadDoc, parks } from '../../../lib/postseason/__tests__/helpers';

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
      const name = parks().get(id);
      return name ? { name } : null;
    },
  },
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
    assert.ok(r.fieldMask, `${r.path} was read with a mask`);
    for (const f of r.fieldMask) {
      assert.ok(['league', 'season', 'series', 'lastChangedAt', 'frozenAt'].includes(f), `${r.path} asked for ${f}`);
    }
  }
  assert.ok(current.db.reads.some((r) => r.path === 'postseasonBrackets/MLB_2026'));
});

test('ROUTE /playoffs/[league]: a missing document and a failed read both render "not available"', async () => {
  const { default: Page } = await league();
  current.db = fakeFirestore({ 'postseasonBrackets/WNBA_2026': loadDoc(FIXTURE.wnbaLive) });
  const missing = renderToStaticMarkup(await Page(params('mlb')));
  assert.ok(missing.includes('data-bracket-state="unavailable"'));
  assert.equal(count(missing, 'data-series="'), 0);
  assert.ok(missing.includes('Open the WNBA bracket'));

  current.db = fakeFirestore({ 'postseasonBrackets/MLB_2026': new Error('UNAVAILABLE'), 'postseasonBrackets/WNBA_2026': new Error('UNAVAILABLE') });
  const failed = renderToStaticMarkup(await quiet(() => Page(params('mlb'))));
  assert.ok(failed.includes('data-bracket-state="unavailable"'));
  assert.equal(count(failed, 'data-series="'), 0);
  assert.ok(!failed.includes('Open the WNBA bracket'), 'no link to a league that could not be read');
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

test('ROUTE /playoffs: both leagues, the next home games, hub-tagged ticket links', async () => {
  const { default: Page } = await hub();
  current.db = fakeFirestore(BOTH());
  const html = renderToStaticMarkup(await Page());
  assert.match(html, /<h1[^>]*>Playoffs<\/h1>/);
  assert.equal(count(html, 'data-league-card="'), 2);
  assert.equal(count(html, 'data-home-game="'), 8);
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

test('ROUTE /playoffs: no documents is the offseason state; a failed read is not', async () => {
  const { default: Page } = await hub();
  current.db = fakeFirestore({});
  const off = renderToStaticMarkup(await Page());
  assert.equal(count(off, 'data-hub-state="offseason"'), 1);
  assert.equal(count(off, 'data-league-card="'), 0);

  current.db = fakeFirestore({ 'postseasonBrackets/MLB_2026': new Error('UNAVAILABLE') });
  const failed = renderToStaticMarkup(await quiet(() => Page()));
  assert.equal(count(failed, 'data-hub-state="offseason"'), 0);
  assert.equal(count(failed, 'data-league-card="MLB"'), 1);
  assert.ok(failed.includes('The MLB bracket is not available right now.'));
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

test('the old flag no longer gates the Playoffs link', () => {
  const layout = readFileSync(new URL('../../layout.tsx', import.meta.url), 'utf8');
  assert.ok(/isPlayoffsLinkActive/.test(layout));
  assert.ok(!/getPlayoffConfig/.test(layout), 'the layout no longer reads appConfig/playoffs');
  assert.match(layout, /playoffsActive = await isPlayoffsLinkActive\(\)/);
  // Fail-closed: the read sits in a try, and the default is false.
  assert.match(layout, /let playoffsActive = false;\s*try \{\s*playoffsActive = await isPlayoffsLinkActive\(\);\s*\} catch/);
});
