// The nightly Shorts sync against the fake Firestore, with the YouTube Data
// API answered by a fetcher of the test's own.
//
// Run with:
//   node --import tsx --experimental-test-module-mocks --test <this file>

import { test, mock, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { coll, fakeDb, resetFirestore, writesTo } from './support/fake-firestore';

mock.module('server-only', { namedExports: {} });
mock.module(new URL('../firebase.ts', import.meta.url).href, { namedExports: { db: fakeDb } });
mock.module(new URL('../data.ts', import.meta.url).href, { namedExports: { getAllTeams: async () => [{ id: 'new-york-islanders', sportSlug: 'nhl' }, { id: 'dallas-stars', sportSlug: 'nhl' }] } });
mock.module(new URL('../promo-pages.ts', import.meta.url).href, {
  namedExports: {
    isPromoPagesLive: () => true,
    getUpcomingPromoIndex: async () => [
      { teamId: 'new-york-islanders', promoId: '219f40551981491f', date: '2026-11-07', pageSlug: 'camo-hat' },
      { teamId: 'dallas-stars', promoId: 'abcdef0123456789', date: '2026-11-09', pageSlug: 'puck-night' },
    ],
  },
});

const page = (items: { id: string; promo: string | null; at: string }[], next?: string) => ({
  nextPageToken: next,
  items: items.map((i) => ({ snippet: { title: `Short ${i.id}`, publishedAt: i.at, description: i.promo ? `caption\n\npn:${i.promo}` : 'pn:game:x', resourceId: { videoId: i.id } } })),
});
const answer = (pages: Record<string, unknown>) => {
  const calls: string[] = [];
  const fetcher = async (url: string) => {
    calls.push(url);
    const token = new URL(url).searchParams.get('pageToken') ?? 'first';
    const body = pages[token];
    return { ok: body !== undefined, status: body === undefined ? 500 : 200, json: async () => body };
  };
  return { fetcher, calls };
};

beforeEach(() => resetFirestore());

test('a preview fixture lays over the stored map, and never in production', async () => {
  const { fixtureShortsMap } = await import('../youtube-shorts-store');
  const fixture = JSON.stringify({ '219f40551981491f': { videoId: 'SZVYd9awEow', title: 'fixture', publishedAt: '2026-10-25T17:00:00Z' }, bad: { videoId: 'x' } });
  assert.deepEqual(fixtureShortsMap({ VERCEL_ENV: 'preview', SOCIAL_VIDEOS_FIXTURE: fixture }), { '219f40551981491f': { videoId: 'SZVYd9awEow', title: 'fixture', publishedAt: '2026-10-25T17:00:00Z' } });
  assert.deepEqual(fixtureShortsMap({ VERCEL_ENV: 'production', SOCIAL_VIDEOS_FIXTURE: fixture }), {});
  assert.deepEqual(fixtureShortsMap({ VERCEL_ENV: 'preview', SOCIAL_VIDEOS_FIXTURE: 'not json' }), {});
  assert.deepEqual(fixtureShortsMap({ VERCEL_ENV: 'preview' }), {});
});

test('without a key the sync is skipped and nothing is written', async () => {
  const { syncYoutubeShorts, promoPagesWithNewShorts } = await import('../youtube-shorts-sync');
  const r = await syncYoutubeShorts(undefined);
  assert.equal(r.skipped, 'no_key');
  assert.equal(writesTo('socialVideos').length, 0);
  delete process.env.YOUTUBE_API_KEY;
  assert.deepEqual(await promoPagesWithNewShorts(), []);
});

test('the first sync writes the map from every page of uploads and names the changed promo pages', async () => {
  const { syncYoutubeShorts, promoPagePathsFor } = await import('../youtube-shorts-sync');
  const { fetcher, calls } = answer({
    first: page([{ id: 'KBrnKx2troc', promo: '219f40551981491f', at: '2026-11-06T10:00:00Z' }, { id: 'SZVYd9awEow', promo: null, at: '2026-11-06T11:00:00Z' }], 'p2'),
    p2: page([{ id: 'aaaaaaaaaaa', promo: 'abcdef0123456789', at: '2026-11-01T10:00:00Z' }]),
  });
  const r = await syncYoutubeShorts('KEY', fetcher);
  assert.equal(calls.length, 2);
  assert.ok(calls.every((u) => u.includes('key=KEY') && u.includes('playlistId=UURU8aBU0662tBrGAHg-OE7Q')));
  assert.equal(r.uploads, 3);
  assert.deepEqual(r.changedPromoIds, ['219f40551981491f', 'abcdef0123456789']);
  const [write] = writesTo('socialVideos');
  assert.equal(write.doc, 'youtube');
  assert.deepEqual(write.data.byPromo, {
    '219f40551981491f': { videoId: 'KBrnKx2troc', title: 'Short KBrnKx2troc', publishedAt: '2026-11-06T10:00:00Z' },
    abcdef0123456789: { videoId: 'aaaaaaaaaaa', title: 'Short aaaaaaaaaaa', publishedAt: '2026-11-01T10:00:00Z' },
  });
  assert.equal(write.data.uploadsSeen, 3);
  assert.deepEqual((await promoPagePathsFor(r.changedPromoIds)).sort(), ['/nhl/dallas-stars/promos/puck-night', '/nhl/new-york-islanders/promos/camo-hat']);
});

test('an unchanged map is not rewritten, a replaced video is, and a failed page keeps the stored videos it did not see', async () => {
  const { syncYoutubeShorts } = await import('../youtube-shorts-sync');
  coll('socialVideos').set('youtube', {
    byPromo: { '219f40551981491f': { videoId: 'KBrnKx2troc', title: 'old', publishedAt: '2026-11-06T10:00:00Z' }, abcdef0123456789: { videoId: 'aaaaaaaaaaa', title: 'stars', publishedAt: '2026-11-01T10:00:00Z' } },
    syncedAt: '2026-11-05T05:00:00Z',
    uploadsSeen: 2,
  });
  const same = await syncYoutubeShorts('KEY', answer({ first: page([{ id: 'KBrnKx2troc', promo: '219f40551981491f', at: '2026-11-06T10:00:00Z' }, { id: 'aaaaaaaaaaa', promo: 'abcdef0123456789', at: '2026-11-01T10:00:00Z' }]) }).fetcher);
  assert.deepEqual(same.changedPromoIds, []);
  assert.equal(writesTo('socialVideos').length, 0);

  const replaced = await syncYoutubeShorts('KEY', answer({ first: page([{ id: 'zzzzzzzzzzz', promo: '219f40551981491f', at: '2026-11-07T10:00:00Z' }, { id: 'aaaaaaaaaaa', promo: 'abcdef0123456789', at: '2026-11-01T10:00:00Z' }]) }).fetcher);
  assert.deepEqual(replaced.changedPromoIds, ['219f40551981491f']);
  assert.equal(writesTo('socialVideos').length, 1);

  const partial = await syncYoutubeShorts('KEY', answer({ first: page([{ id: 'zzzzzzzzzzz', promo: '219f40551981491f', at: '2026-11-07T10:00:00Z' }], 'p2') }).fetcher);
  assert.deepEqual(partial.changedPromoIds, []);
  assert.equal(partial.map.abcdef0123456789.videoId, 'aaaaaaaaaaa', 'the unseen promo keeps its video on a partial read');
});
