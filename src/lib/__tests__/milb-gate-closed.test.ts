// MiLB Phase 1, KNOWN-BAD (b): a MILB team doc exists in Firestore while the
// gate is shut (no appConfig/milb doc at all). It must not appear in
// getAllTeams, must not resolve by slug (so its team, promo and archive pages
// 404), must not appear in the sitemap, and its promos must not count toward
// the site-wide promo total. The real loaders and the real sitemap() run
// against a fake Firestore; only the sitemap's unrelated sources are stubbed.
// Its own file: node --test runs each file in its own process, so the team
// loader's cache starts cold with this file's gate state.
import { test, mock } from 'node:test';
import assert from 'node:assert/strict';
import { makeFakeDb, stubSitemapSources } from './milb-gate-fixtures';

const fake = makeFakeDb({ milbDoc: undefined });
mock.module('server-only', { namedExports: {} });
mock.module(new URL('../firebase.ts', import.meta.url).href, { namedExports: { db: fake.db } });
stubSitemapSources(mock, import.meta.url);

test('closed gate: no MILB team in getAllTeams; every other team still there, in the shipped order', async () => {
  const { getAllTeams } = await import('../data');
  const teams = await getAllTeams();
  assert.deepEqual(teams.map((t) => t.id), ['minnesota-twins', 'toronto-maple-leafs']);
  assert.ok(teams.every((t) => t.league !== 'MILB'));
});

test('closed gate: a MILB slug does not resolve, so its pages 404', async () => {
  const { getTeamBySlug } = await import('../data');
  assert.equal(await getTeamBySlug('durham-bulls'), null);
  assert.equal(await getTeamBySlug('st-paul-saints'), null);
  assert.equal((await getTeamBySlug('minnesota-twins'))?.league, 'MLB');
});

test('closed gate: the sitemap carries no MILB URL', async () => {
  const sitemap = (await import('../../app/sitemap')).default;
  const urls = (await sitemap()).map((e) => e.url);
  assert.ok(urls.includes('https://www.getpromonight.com/mlb/minnesota-twins'), 'MLB team present');
  assert.ok(urls.includes('https://www.getpromonight.com/nhl/toronto-maple-leafs'), 'NHL team present');
  const milb = urls.filter((u) => /\/milb\/|durham-bulls|st-paul-saints/.test(u));
  assert.deepEqual(milb, []);
  assert.equal(fake.milbPromoReads(), 0, 'a shut gate reads no MILB promos for the sitemap');
});

test('closed gate: the hidden clubs are reported and their promos come off the site-wide count', async () => {
  const { getGateHiddenTeamIds, getPromoCount } = await import('../data');
  assert.deepEqual((await getGateHiddenTeamIds()).sort(), ['durham-bulls', 'st-paul-saints']);
  // collectionGroup count 10 = 7 pro + 2 durham + 1 st-paul; hidden 3 subtracted.
  assert.equal(await getPromoCount(), 7);
});

test('closed gate (review 2): /api/my-teams/promos drops a MILB slug before any read', async () => {
  const { NextRequest } = await import('next/server');
  const { GET } = await import('../../app/api/my-teams/promos/route');
  const before = fake.milbPromoReads();
  const res = await GET(new NextRequest('https://www.getpromonight.com/api/my-teams/promos?teams=durham-bulls,minnesota-twins&start=2026-01-01&end=2027-12-31'));
  const body = (await res.json()) as { promos: { teamSlug: string }[]; venues: Record<string, unknown> };
  assert.ok(!body.promos.some((p) => p.teamSlug === 'durham-bulls'), 'no MILB promo served');
  assert.ok(!('durham-bulls' in body.venues), 'the MILB slug is not echoed back');
  assert.ok('minnesota-twins' in body.venues, 'a pro slug is served as before');
  assert.equal(fake.milbPromoReads(), before, 'no MILB promo read');
  assert.equal(fake.milbTeamDocReads(), 0, 'no MILB team doc read');
});
