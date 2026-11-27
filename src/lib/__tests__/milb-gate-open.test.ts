// MiLB G2b: the gate OPEN (appConfig/milb.milbLive === true), on the new
// paths. The same fake Firestore as the closed test, so this file is also its
// mutation check: with the flag flipped, the MILB clubs and their milbPromos
// rows are served. Plus the live rules: a zero-upcoming MILB club stays out of
// the sitemap, and a doc in the wrong home is served by nobody.
import { test, mock } from 'node:test';
import assert from 'node:assert/strict';
import { makeFakeDb, stubSitemapSources } from './milb-gate-fixtures';

const fake = makeFakeDb({ milbDoc: { milbLive: true }, rogue: true });
mock.module('server-only', { namedExports: {} });
mock.module(new URL('../firebase.ts', import.meta.url).href, { namedExports: { db: fake.db } });
stubSitemapSources(mock, import.meta.url);

test('open gate: MILB clubs are served from milbTeams, sorted by league then city like every club', async () => {
  const { getAllTeams, getTeamBySlug } = await import('../data');
  assert.deepEqual((await getAllTeams()).map((t) => t.id), ['durham-bulls', 'st-paul-saints', 'minnesota-twins', 'toronto-maple-leafs']);
  const d = await getTeamBySlug('durham-bulls');
  assert.equal(d?.league, 'MILB');
  assert.equal(d?.sportSlug, 'milb');
});

test('open gate: one club, one home. A teams doc claiming MILB and a milbTeams doc claiming MLB are served by nobody', async () => {
  const { getTeamBySlug } = await import('../data');
  assert.equal(await getTeamBySlug('rogue-in-teams'), null);
  assert.equal(await getTeamBySlug('rogue-in-milb'), null);
});

test('open gate: a MILB team page reads milbTeams/{id}/milbPromos', async () => {
  const { getTeamPromos } = await import('../data');
  const rows = await getTeamPromos('durham-bulls');
  assert.deepEqual(rows.map((p) => p.title), ['Opening Night', 'Mountain Gnomes']);
  assert.ok(!rows.some((p) => /Rogue/.test(p.title)), 'its doc in a promos collection is not its promo');
});

test('open gate: cross-team readers merge milbPromos in date order and drop a MILB doc found in a promos collection', async () => {
  const { getPromosFromDate, getPromosForDate, getPromoCount } = await import('../data');
  const rows = await getPromosFromDate('2027-01-01');
  assert.deepEqual(rows.map((p) => [p.date, p.team.id, p.title]), [['2027-05-21', 'durham-bulls', 'Mountain Gnomes'], ['2027-06-04', 'minnesota-twins', 'D']]);
  assert.deepEqual((await getPromosForDate('2027-05-22')).map((p) => p.title), [], 'the rogue promos-collection row is dropped');
  // promos group 8 (7 pro + the rogue doc) + milbPromos group 3.
  assert.equal(await getPromoCount(), 11);
});

test('open gate: a MILB club with an upcoming promo is in the sitemap; one with none is not', async () => {
  const sitemap = (await import('../../app/sitemap')).default;
  const urls = (await sitemap()).map((e) => e.url);
  assert.ok(urls.includes('https://www.getpromonight.com/milb/durham-bulls'));
  assert.ok(!urls.some((u) => u.includes('st-paul-saints')), 'zero-upcoming MILB club left out');
  assert.ok(urls.includes('https://www.getpromonight.com/mlb/minnesota-twins'));
  assert.ok(!urls.some((u) => u.includes('rogue')));
});

test('open gate: /api/my-teams/promos serves a MILB club from milbPromos', async () => {
  const { NextRequest } = await import('next/server');
  const { GET } = await import('../../app/api/my-teams/promos/route');
  const res = await GET(new NextRequest('https://www.getpromonight.com/api/my-teams/promos?teams=durham-bulls&start=2027-01-01&end=2027-12-31'));
  const body = (await res.json()) as { promos: { teamSlug: string; title: string }[] };
  assert.deepEqual(body.promos.map((p) => p.title), ['Mountain Gnomes']);
});

test('open gate: the MILB paths were read', () => {
  assert.ok(fake.reads.milbTeams > 0 && fake.reads.milbPromos > 0);
});
