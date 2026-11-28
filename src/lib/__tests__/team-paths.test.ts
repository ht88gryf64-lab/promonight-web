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

// MiLB G4b: the schedule collection.
test('milbGames: a top-level collection of its own, addressed in one place', async () => {
  const { MILB_GAMES_COLLECTION, milbGamesColRef } = await import('../team-paths');
  assert.equal(MILB_GAMES_COLLECTION, 'milbGames');
  assert.equal(milbGamesColRef().path, 'milbGames');
  assert.notEqual(MILB_GAMES_COLLECTION, 'games');
  // No file but team-paths.ts names the collection: every read goes through milbGamesColRef.
  const fs = await import('node:fs');
  const path = await import('node:path');
  const root = path.join(path.dirname(new URL(import.meta.url).pathname), '..', '..');
  const hits: string[] = [];
  const walk = (dir: string) => {
    for (const name of fs.readdirSync(dir)) {
      const p = path.join(dir, name);
      if (fs.statSync(p).isDirectory()) { if (name !== '__tests__' && name !== 'node_modules') walk(p); continue; }
      if (!/\.(ts|tsx)$/.test(name) || /\.test\.tsx?$/.test(name)) continue;
      const code = fs.readFileSync(p, 'utf8').split('\n').filter((l) => !/^\s*(\/\/|\*|\/\*)/.test(l)).join('\n');
      if (/['"`]milbGames['"`]/.test(code)) hits.push(path.relative(root, p));
    }
  };
  walk(root);
  assert.deepEqual(hits, ['lib/team-paths.ts']);
  // And exactly one reader calls it.
  const data = fs.readFileSync(path.join(root, 'lib', 'data.ts'), 'utf8');
  assert.equal((data.match(/milbGamesColRef\(\)/g) || []).length, 1);
});
