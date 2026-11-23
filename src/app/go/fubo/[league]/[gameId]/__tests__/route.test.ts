// GET /go/fubo/{league}/{gameId}?s={surface}&t={teamId}: the Fubo hop, with
// the game and team loaders mocked so the REAL route and the REAL builder run.
//
// Run with:
//   node --import tsx --experimental-test-module-mocks --test <this file>

import { test, mock } from 'node:test';
import assert from 'node:assert/strict';
import { NextRequest } from 'next/dist/server/web/spec-extension/request';
import { NextResponse } from 'next/dist/server/web/spec-extension/response';

const team = (id: string, city: string, name: string, sportSlug: string) => ({ id, city, name, sportSlug });
const teams = new Map(
  [
    team('baltimore-ravens', 'Baltimore', 'Ravens', 'nfl'),
    team('buffalo-bills', 'Buffalo', 'Bills', 'nfl'),
    team('montreal-canadiens', 'Montréal', 'Canadiens', 'nhl'),
    team('st-louis-blues', 'St. Louis', 'Blues', 'nhl'),
  ].map((t) => [t.id, t]),
);
const games = new Map<string, Record<string, unknown>>([
  ['nfl-2026-11-22-buffalo-bills-at-baltimore-ravens', { id: 'nfl-2026-11-22-buffalo-bills-at-baltimore-ravens', league: 'nfl', date: '2026-11-22', homeTeamSlug: 'baltimore-ravens', awayTeamSlug: 'buffalo-bills', status: 'scheduled', broadcast: { network: 'CBS', isPrimetime: false } }],
  ['nfl-2026-11-26-buffalo-bills-at-baltimore-ravens', { id: 'nfl-2026-11-26-buffalo-bills-at-baltimore-ravens', league: 'nfl', date: '2026-11-26', homeTeamSlug: 'baltimore-ravens', awayTeamSlug: 'buffalo-bills', status: 'scheduled', broadcast: { network: 'Prime Video', isPrimetime: true } }],
  ['nhl-2026-11-19-st-louis-blues-at-montreal-canadiens', { id: 'nhl-2026-11-19-st-louis-blues-at-montreal-canadiens', league: 'nhl', date: '2026-11-19', gameTimeTz: 'America/Toronto', homeTeamSlug: 'montreal-canadiens', awayTeamSlug: 'st-louis-blues', status: 'scheduled' }],
  ['2025020345', { id: '2025020345', league: 'nhl', date: '2026-11-24', homeTeamSlug: 'montreal-canadiens', awayTeamSlug: 'st-louis-blues', status: 'scheduled' }],
]);
let failRead = false;

// The site's clock, pinned: the fixtures' games are upcoming on this day.
mock.timers.enable({ apis: ['Date'], now: new Date('2026-11-20T17:00:00Z') });
mock.module('server-only', { namedExports: {} });
mock.module('next/server', { namedExports: { NextResponse, NextRequest } });
mock.module(new URL('../../../../../../lib/data.ts', import.meta.url).href, {
  namedExports: {
    getTeamBySlug: async (id: string) => teams.get(id) ?? null,
    getGameById: async (id: string) => {
      if (failRead) throw new Error('firestore down');
      return games.get(id) ?? null;
    },
  },
});

const ORIGIN = 'https://www.getpromonight.com';
const get = async (path: string, method: 'GET' | 'HEAD' = 'GET'): Promise<Response> => {
  const mod = await import('../route');
  const [, league, gameId] = path.match(/^\/go\/fubo\/([^/?]*)\/([^/?]*)/) as RegExpMatchArray;
  return mod[method](new NextRequest(`${ORIGIN}${path}`, { method }), { params: Promise.resolve({ league, gameId }) });
};
const loc = (res: Response) => res.headers.get('location') as string;

test('a home-side link: 307 to fubo.tv with irmp, irad, sharedid and {surface}_{team}; noindex, uncached', async () => {
  const res = await get('/go/fubo/nfl/nfl-2026-11-22-buffalo-bills-at-baltimore-ravens?s=web_today&t=baltimore-ravens');
  assert.equal(res.status, 307);
  assert.equal(
    loc(res),
    'https://www.fubo.tv/welcome/leagues/191277?irmp=7236189&irad=356362&sharedid=USA_Football_NFL_Buffalo-Bills-at-Baltimore-Ravens&subId1=web_today_baltimore-ravens',
  );
  assert.equal(res.headers.get('x-robots-tag'), 'noindex');
  assert.equal(res.headers.get('cache-control'), 'private, no-store');
});

test('an away-row link carries the shared away token (ruling 7); accents and periods leave the sharedid', async () => {
  const res = await get('/go/fubo/nhl/2025020345?s=web_team_page&t=st-louis-blues');
  assert.equal(
    loc(res),
    'https://www.fubo.tv/stream/nhl/?irmp=7236189&irad=409363&sharedid=USA_Hockey_NHL_St-Louis-Blues-at-Montreal-Canadiens&subId1=web_away_game_st-louis-blues_at_montreal-canadiens',
  );
});

test('HEAD answers the same 307 (curl -sI)', async () => {
  const res = await get('/go/fubo/nhl/2025020345?s=web_promo_page&t=montreal-canadiens', 'HEAD');
  assert.equal(res.status, 307);
  assert.ok(loc(res).includes('subId1=web_promo_page_montreal-canadiens'));
});

test('bad input lands on the homepage: league not live or mismatched, surface off the allowlist, a team not in the game, an NFL game on Prime', async () => {
  const cases = [
    '/go/fubo/mls/2025020345?s=web_today&t=montreal-canadiens',
    '/go/fubo/mlb/2025020345?s=web_today&t=montreal-canadiens',
    '/go/fubo/NHL/2025020345?s=web_today&t=montreal-canadiens',
    '/go/fubo/nfl/2025020345?s=web_today&t=montreal-canadiens',
    '/go/fubo/nhl/2025020345?s=web_home_tonight&t=montreal-canadiens',
    '/go/fubo/nhl/2025020345?t=montreal-canadiens',
    '/go/fubo/nhl/2025020345?s=web_today',
    '/go/fubo/nhl/2025020345?s=web_today&t=baltimore-ravens',
    '/go/fubo/nfl/nfl-2026-11-26-buffalo-bills-at-baltimore-ravens?s=web_today&t=baltimore-ravens',
  ];
  for (const path of cases) {
    const res = await get(path);
    assert.equal(res.status, 307, path);
    assert.equal(loc(res), `${ORIGIN}/`, path);
    assert.equal(res.headers.get('x-robots-tag'), 'noindex', path);
  }
});

test('a missing or unreadable game doc still lands tagged: the league landing, no sharedid', async () => {
  const gone = await get('/go/fubo/nhl/2025029999?s=web_today&t=montreal-canadiens');
  assert.equal(gone.status, 307);
  assert.equal(loc(gone), 'https://www.fubo.tv/stream/nhl/?irmp=7236189&irad=409363&subId1=web_today_montreal-canadiens');
  failRead = true;
  try {
    const down = await get('/go/fubo/nfl/nfl-2026-11-22-buffalo-bills-at-baltimore-ravens?s=web_promo_page&t=baltimore-ravens');
    assert.equal(loc(down), 'https://www.fubo.tv/welcome/leagues/191277?irmp=7236189&irad=356362&subId1=web_promo_page_baltimore-ravens');
    // ...but only for a real team of that league.
    const junk = await get('/go/fubo/nfl/x?s=web_today&t=montreal-canadiens');
    assert.equal(loc(junk), `${ORIGIN}/`);
  } finally {
    failRead = false;
  }
});

test('a played game (status still "scheduled", date before today in its zone) lands on the link team\'s page on our domain, no affiliate parameters', async () => {
  for (const [t, page] of [['st-louis-blues', '/nhl/st-louis-blues'], ['montreal-canadiens', '/nhl/montreal-canadiens']]) {
    const res = await get(`/go/fubo/nhl/nhl-2026-11-19-st-louis-blues-at-montreal-canadiens?s=web_team_page&t=${t}`);
    assert.equal(res.status, 307);
    assert.equal(loc(res), `${ORIGIN}${page}`, t);
    assert.ok(!/irmp|irad|sharedid|subId|fubo\.tv|[?]/.test(loc(res)), 'no affiliate parameters, no query string');
    assert.equal(res.headers.get('x-robots-tag'), 'noindex');
    assert.equal(res.headers.get('cache-control'), 'private, no-store');
  }
});
