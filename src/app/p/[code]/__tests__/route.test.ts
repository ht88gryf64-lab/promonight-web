// GET /p/{code}: the social bridge's promo link, with the index and the team
// loader mocked so the REAL route and the REAL resolver run.
//
// Run with:
//   node --import tsx --experimental-test-module-mocks --test <this file>

import { test, mock, beforeEach } from 'node:test';
import assert from 'node:assert';
import { NextRequest } from 'next/dist/server/web/spec-extension/request';
import { NextResponse } from 'next/dist/server/web/spec-extension/response';

let upcoming: Array<{ teamId: string; promoId: string; date: string; pageSlug: string }> = [];
const teams = new Map([
  ['new-york-islanders', { id: 'new-york-islanders', sportSlug: 'nhl' }],
  ['dallas-stars', { id: 'dallas-stars', sportSlug: 'nhl' }],
]);

mock.module('server-only', { namedExports: {} });
mock.module('next/server', { namedExports: { NextResponse, NextRequest } });
mock.module(new URL('../../../../lib/promo-pages.ts', import.meta.url).href, {
  namedExports: {
    getUpcomingPromoIndex: async () => upcoming,
    isPromoPagesLive: () => process.env.PROMO_PAGES_LIVE === 'true',
  },
});
mock.module(new URL('../../../../lib/data.ts', import.meta.url).href, {
  namedExports: { getTeamBySlug: async (id: string) => teams.get(id) ?? null },
});
mock.module(new URL('../../../../lib/promo-helpers.ts', import.meta.url).href, {
  namedExports: { todayYmd: () => '2026-11-05' },
});

const get = async (path: string): Promise<Response> => {
  const { GET } = await import('../route');
  const [, code] = path.match(/^\/p\/([^/?]*)/) as RegExpMatchArray;
  return GET(new NextRequest(`https://www.getpromonight.com${path}`), { params: Promise.resolve({ code }) });
};

beforeEach(() => {
  process.env.PROMO_PAGES_LIVE = 'true';
  upcoming = [
    { teamId: 'new-york-islanders', promoId: '219f40551981491f', date: '2026-11-07', pageSlug: 'camo-hat-2026-11-07' },
    { teamId: 'dallas-stars', promoId: '219f40aa00000001', date: '2026-11-09', pageSlug: 'puck-night-2026-11-09' },
  ];
});

test('a caption link lands on the promo page with its UTMs intact', async () => {
  const res = await get('/p/219f40?utm_source=meta&utm_medium=social&utm_campaign=gameday&utm_content=219f40551981491f');
  assert.equal(res.status, 307);
  assert.equal(res.headers.get('location'), 'https://www.getpromonight.com/nhl/new-york-islanders/promos/camo-hat-2026-11-07?utm_source=meta&utm_medium=social&utm_campaign=gameday&utm_content=219f40551981491f');
  assert.equal(res.headers.get('x-robots-tag'), 'noindex');
  assert.equal(res.headers.get('cache-control'), 'private, no-store');
});

test('a code no upcoming promo carries, or one two promos share without the whole id, lands on today\'s board', async () => {
  for (const path of ['/p/ffffff?utm_source=tiktok', '/p/219f40?utm_source=tiktok', '/p/not-a-code', '/p/219f40551981491f']) {
    const res = await get(path);
    assert.equal(res.status, 307, path);
    const url = new URL(res.headers.get('location') as string);
    assert.equal(url.pathname, '/promos/today', path);
  }
  const res = await get('/p/ffffff?utm_source=tiktok&utm_medium=social');
  assert.equal(new URL(res.headers.get('location') as string).search, '?utm_source=tiktok&utm_medium=social');
});

test('with the promo pages switched off every code lands on today\'s board', async () => {
  process.env.PROMO_PAGES_LIVE = 'false';
  const res = await get('/p/219f40?utm_content=219f40551981491f');
  assert.equal(new URL(res.headers.get('location') as string).pathname, '/promos/today');
});

test('a promo whose team is unknown to the site lands on today\'s board rather than a broken page', async () => {
  upcoming = [{ teamId: 'ghost-team', promoId: 'abcdef0123456789', date: '2026-11-07', pageSlug: 'x' }];
  const res = await get('/p/abcdef');
  assert.equal(new URL(res.headers.get('location') as string).pathname, '/promos/today');
});
