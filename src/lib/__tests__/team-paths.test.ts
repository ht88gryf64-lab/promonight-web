// MiLB G2b: the path module (src/lib/team-paths.ts). The six pro leagues keep
// teams / promos / recurringDeals byte for byte; MILB lives in milbTeams with
// milbPromos, so no app query (collection('teams'), collectionGroup('promos'))
// can reach it.
import { test, mock } from 'node:test';
import assert from 'node:assert/strict';

const col = (path: string): any => ({ path, doc: (id: string) => ({ path: `${path}/${id}`, collection: (c: string) => col(`${path}/${id}/${c}`) }) });
mock.module('server-only', { namedExports: {} });
mock.module(new URL('../firebase.ts', import.meta.url).href, { namedExports: { db: { collection: (c: string) => col(c) } } });

test('the six pro leagues (and an unknown or absent league) keep teams / promos / recurringDeals', async () => {
  const { pathsForLeague, teamDocRef, promosColRef, recurringColRef } = await import('../team-paths');
  for (const lg of ['MLB', 'NBA', 'NFL', 'NHL', 'MLS', 'WNBA', '', undefined, null, 'CFB']) {
    assert.deepEqual({ ...pathsForLeague(lg) }, { teams: 'teams', promos: 'promos', recurring: 'recurringDeals' }, String(lg));
  }
  for (const lg of ['MLB', 'NBA', 'NFL', 'NHL', 'MLS', 'WNBA']) {
    assert.equal(teamDocRef(lg, 'x').path, 'teams/x');
    assert.equal(promosColRef(lg, 'x').path, 'teams/x/promos');
    assert.equal(recurringColRef(lg, 'x').path, 'teams/x/recurringDeals');
  }
});

test('MILB: milbTeams/{slug}, milbTeams/{slug}/milbPromos, milbTeams/{slug}/recurringDeals; no segment named teams or promos', async () => {
  const { teamDocRef, promosColRef, recurringColRef } = await import('../team-paths');
  assert.equal(teamDocRef('MILB', 'durham-bulls').path, 'milbTeams/durham-bulls');
  assert.equal(promosColRef('MILB', 'durham-bulls').path, 'milbTeams/durham-bulls/milbPromos');
  assert.equal(recurringColRef('MILB', 'durham-bulls').path, 'milbTeams/durham-bulls/recurringDeals');
  for (const p of [teamDocRef('MILB', 'a').path, promosColRef('MILB', 'a').path, recurringColRef('MILB', 'a').path]) {
    assert.ok(!p.split('/').includes('teams') && !p.split('/').includes('promos'), p);
  }
});

test('promoDocBelongs: a promos doc is a pro team\'s, a milbPromos doc a MILB team\'s, never crossed', async () => {
  const { promoDocBelongs } = await import('../team-paths');
  const d = (c: string) => ({ ref: { parent: { id: c } } });
  assert.equal(promoDocBelongs(d('promos'), 'MLB'), true);
  assert.equal(promoDocBelongs(d('milbPromos'), 'MILB'), true);
  assert.equal(promoDocBelongs(d('promos'), 'MILB'), false);
  assert.equal(promoDocBelongs(d('milbPromos'), 'NHL'), false);
  // A doc with no readable parent id (older test doubles) is a pro doc, as it always was.
  assert.equal(promoDocBelongs({ ref: {} }, 'MLB'), true);
  assert.equal(promoDocBelongs({ ref: {} }, 'MILB'), false);
});
