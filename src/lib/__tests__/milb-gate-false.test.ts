// MiLB Phase 1: the gate shut by an explicit milbLive: false, and by a value
// that is truthy but not `true` is covered in milb-gate.test.ts. Own process.
import { test, mock } from 'node:test';
import assert from 'node:assert/strict';
import { makeFakeDb, stubSitemapSources } from './milb-gate-fixtures';

const fake = makeFakeDb({ milbDoc: { milbLive: false } });
mock.module('server-only', { namedExports: {} });
mock.module(new URL('../firebase.ts', import.meta.url).href, { namedExports: { db: fake.db } });
stubSitemapSources(mock, import.meta.url);

test('milbLive: false hides every MILB club from getAllTeams, getTeamBySlug and the sitemap', async () => {
  const { getAllTeams, getTeamBySlug } = await import('../data');
  assert.ok((await getAllTeams()).every((t) => t.league !== 'MILB'));
  assert.equal(await getTeamBySlug('durham-bulls'), null);
  const sitemap = (await import('../../app/sitemap')).default;
  assert.ok(!(await sitemap()).some((e) => /durham-bulls|st-paul-saints|\/milb\//.test(e.url)));
});
