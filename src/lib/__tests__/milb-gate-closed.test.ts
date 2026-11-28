// KNOWN-BAD (c), MiLB G2b: the G1 gate-shut checks against the new paths.
// MILB clubs exist in milbTeams with promos in milbPromos, and there is no
// appConfig/milb doc. They must not appear in getAllTeams, resolve by slug,
// appear in the sitemap, count toward the promo total or come back from the
// my-teams API, and with the gate shut NO MILB PATH IS READ AT ALL. The real
// loaders, sitemap() and route run against a fake Firestore; only the sitemap's
// unrelated sources are stubbed. Own file: own process, cold team cache.
import { test, mock } from 'node:test';
import assert from 'node:assert/strict';
import { makeFakeDb, stubSitemapSources } from './milb-gate-fixtures';

const fake = makeFakeDb({ milbDoc: undefined, rogue: true });
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
  assert.equal(await getTeamBySlug('rogue-in-teams'), null, 'a teams doc claiming MILB is served by nobody');
  assert.equal((await getTeamBySlug('minnesota-twins'))?.league, 'MLB');
});

test('closed gate: the sitemap carries no MILB URL', async () => {
  const sitemap = (await import('../../app/sitemap')).default;
  const urls = (await sitemap()).map((e) => e.url);
  assert.ok(urls.includes('https://www.getpromonight.com/mlb/minnesota-twins'), 'MLB team present');
  assert.ok(urls.includes('https://www.getpromonight.com/nhl/toronto-maple-leafs'), 'NHL team present');
  assert.deepEqual(urls.filter((u) => /\/milb\/|durham-bulls|st-paul-saints|rogue/.test(u)), []);
});

test('closed gate: cross-team readers return no MILB row, and the promo count is the pro count', async () => {
  const { getPromosFromDate, getPromosInDateRange, getPromosForDate, getPromoCount, getTeamPromos } = await import('../data');
  const all = await getPromosFromDate('2026-01-01');
  assert.ok(all.length > 0);
  assert.ok(all.every((p) => p.team.league !== 'MILB'));
  assert.ok(!all.some((p) => /Gnomes|Rogue|Opening Night|Fireworks/.test(p.title)));
  assert.ok((await getPromosInDateRange('2027-05-01', '2027-06-30')).every((p) => p.team.id === 'minnesota-twins'));
  assert.deepEqual(await getPromosForDate('2027-05-21'), []);
  // A hidden slug resolves to the pro path (as any unknown slug always did):
  // none of the club's milbPromos rows can come back through it.
  assert.ok(!(await getTeamPromos('durham-bulls')).some((p) => /Gnomes|Opening Night/.test(p.title)));
  // 7 pro promos + the rogue doc in a promos collection (counted as any stray
  // promos doc always was); the 3 milbPromos docs are not counted.
  assert.equal(await getPromoCount(), 8);
});

test('closed gate: /api/my-teams/promos returns nothing for a MILB slug', async () => {
  const { NextRequest } = await import('next/server');
  const { GET } = await import('../../app/api/my-teams/promos/route');
  const res = await GET(new NextRequest('https://www.getpromonight.com/api/my-teams/promos?teams=st-paul-saints,durham-bulls,rogue-in-teams,minnesota-twins&start=2026-01-01&end=2027-12-31'));
  const body = (await res.json()) as { promos: { teamSlug: string; title: string }[] };
  assert.equal(body.promos.filter((p) => p.teamSlug === 'minnesota-twins').length, 4);
  assert.deepEqual(body.promos.filter((p) => p.teamSlug !== 'minnesota-twins'), []);
  // durham-bulls has a stray doc at teams/durham-bulls/promos (the rogue fixture):
  // a slug that is not a served team is answered with nothing, whatever sits there.
});

// KNOWN-BAD, MiLB G4b: milbGames holds eight docs for these clubs (the
// fixture), three of them mapped to TicketNetwork events. With the gate shut
// the schedule reader returns nothing for a MILB slug under any league string,
// and does not touch the collection.
test('closed gate: no MILB schedule and no MILB ticket link, for any slug or league string', async () => {
  const { getGamesForTeam } = await import('../data');
  for (const [slug, league] of [['durham-bulls', 'milb'], ['st-paul-saints', 'milb'], ['durham-bulls', 'mlb'], ['durham-bulls', 'MILB'], ['minnesota-twins', 'milb'], ['rogue-in-teams', 'milb']] as const) {
    assert.deepEqual(await getGamesForTeam(slug, league), [], `${slug} as ${league}`);
  }
});

test('closed gate: after all of the above, not one MILB path was read', () => {
  assert.deepEqual(fake.reads, { milbTeams: 0, milbPromos: 0, milbGames: 0 });
});
