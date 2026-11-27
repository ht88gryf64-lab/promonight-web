// MiLB Phase 1: the gate OPEN (appConfig/milb.milbLive === true). The same
// fake Firestore as the closed test, so this file is also the closed test's
// mutation check: with the flag flipped, the MILB clubs do appear. And the live
// rule: a MILB club with no upcoming promotion stays out of the sitemap.
// Its own file (own process, cold team cache).
import { test, mock } from 'node:test';
import assert from 'node:assert/strict';
import { makeFakeDb, stubSitemapSources } from './milb-gate-fixtures';

const fake = makeFakeDb({ milbDoc: { milbLive: true } });
mock.module('server-only', { namedExports: {} });
mock.module(new URL('../firebase.ts', import.meta.url).href, { namedExports: { db: fake.db } });
stubSitemapSources(mock, import.meta.url);

test('open gate: MILB clubs are served, sorted by league then city like every club', async () => {
  const { getAllTeams, getTeamBySlug, getGateHiddenTeamIds } = await import('../data');
  assert.deepEqual((await getAllTeams()).map((t) => t.id), ['durham-bulls', 'st-paul-saints', 'minnesota-twins', 'toronto-maple-leafs']);
  const d = await getTeamBySlug('durham-bulls');
  assert.equal(d?.league, 'MILB');
  assert.equal(d?.sportSlug, 'milb');
  assert.deepEqual(await getGateHiddenTeamIds(), []);
});

test('open gate: a MILB club with an upcoming promo is in the sitemap; one with none is not', async () => {
  const sitemap = (await import('../../app/sitemap')).default;
  const urls = (await sitemap()).map((e) => e.url);
  assert.ok(urls.includes('https://www.getpromonight.com/milb/durham-bulls'));
  assert.ok(!urls.some((u) => u.includes('st-paul-saints')), 'zero-upcoming MILB club left out');
  assert.ok(urls.includes('https://www.getpromonight.com/mlb/minnesota-twins'), 'non-MILB club with no upcoming promo is unaffected');
});

test('open gate: nothing is subtracted from the promo count', async () => {
  const { getPromoCount } = await import('../data');
  assert.equal(await getPromoCount(), 10);
});
