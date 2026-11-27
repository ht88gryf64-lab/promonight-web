// MiLB G2b: the gate shut by an explicit milbLive: false. Own process.
import { test, mock } from 'node:test';
import assert from 'node:assert/strict';
import { makeFakeDb, stubSitemapSources } from './milb-gate-fixtures';

const fake = makeFakeDb({ milbDoc: { milbLive: false } });
mock.module('server-only', { namedExports: {} });
mock.module(new URL('../firebase.ts', import.meta.url).href, { namedExports: { db: fake.db } });
stubSitemapSources(mock, import.meta.url);

test('milbLive: false hides every MILB club from getAllTeams, getTeamBySlug, the readers and the sitemap, with no MILB read', async () => {
  const { getAllTeams, getTeamBySlug, getPromosFromDate } = await import('../data');
  assert.ok((await getAllTeams()).every((t) => t.league !== 'MILB'));
  assert.equal(await getTeamBySlug('durham-bulls'), null);
  assert.ok((await getPromosFromDate('2026-01-01')).every((p) => p.team.league !== 'MILB'));
  const sitemap = (await import('../../app/sitemap')).default;
  assert.ok(!(await sitemap()).some((e) => /durham-bulls|st-paul-saints|\/milb\//.test(e.url)));
  assert.deepEqual(fake.reads, { milbTeams: 0, milbPromos: 0 });
});
