// MiLB Phase 1: the gate's read (fail closed), its pure rules, the MiLB
// display label, and the MILB season window the team page needs to render.
import { test, mock } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

let doc: unknown = undefined;
const fakeDb = {
  collection: () => ({
    doc: () => ({
      get: async () => {
        if (doc instanceof Error) throw doc;
        return doc === undefined ? { exists: false, data: () => undefined } : { exists: true, data: () => doc };
      },
    }),
  }),
};
mock.module('server-only', { namedExports: {} });
mock.module(new URL('../firebase.ts', import.meta.url).href, { namedExports: { db: fakeDb } });
mock.method(console, 'error', () => {});

test('readMilbLive fails closed: only an explicit true opens the gate', async () => {
  const { readMilbLive } = await import('../milb-gate');
  for (const [d, want] of [[undefined, false], [{}, false], [{ milbLive: false }, false], [{ milbLive: 'true' }, false], [{ milbLive: 1 }, false], [new Error('UNAVAILABLE'), false], [{ milbLive: true }, true]] as const) {
    doc = d;
    assert.equal(await readMilbLive(), want, JSON.stringify(d instanceof Error ? 'error' : d));
  }
});

test('teamVisibleUnderGate and milbTeamIndexable touch MILB only', async () => {
  const { teamVisibleUnderGate, milbTeamIndexable } = await import('../milb-gate');
  for (const lg of ['MLB', 'NBA', 'NFL', 'NHL', 'MLS', 'WNBA']) {
    assert.equal(teamVisibleUnderGate(lg, false), true, lg);
    assert.equal(milbTeamIndexable(lg, 0), true, lg);
  }
  assert.equal(teamVisibleUnderGate('MILB', false), false);
  assert.equal(teamVisibleUnderGate('MILB', true), true);
  assert.equal(milbTeamIndexable('MILB', 0), false);
  assert.equal(milbTeamIndexable('MILB', 1), true);
});

test('leagueLabel: MILB renders MiLB; every other code is returned unchanged', async () => {
  const { leagueLabel } = await import('../league-label');
  assert.equal(leagueLabel('MILB'), 'MiLB');
  for (const lg of ['MLB', 'NBA', 'NFL', 'NHL', 'MLS', 'WNBA', 'CFB', 'All', '']) assert.equal(leagueLabel(lg), lg);
  assert.equal(leagueLabel('constructor'), 'constructor');
});

test('coverage copy names MiLB, never MILB, and is unchanged without it', async () => {
  const { coverageFromTeams, leagueSplit } = await import('../coverage-counts');
  const t = (league: string, id: string) => ({ id, league }) as never;
  const pro = coverageFromTeams([t('MLB', 'a'), t('NBA', 'b')], 0);
  assert.equal(pro.leagueList, 'MLB, and NBA', 'pro-only copy is byte-identical (joinList shape)');
  const withMilb = coverageFromTeams([t('MLB', 'a'), t('MILB', 'c'), t('MILB', 'd')], 0);
  assert.ok(withMilb.leagueList.includes('MiLB') && !withMilb.leagueList.includes('MILB'), withMilb.leagueList);
  assert.ok(withMilb.leagueNamesBySize.includes('MiLB') && !withMilb.leagueNamesBySize.includes('MILB'));
  assert.equal(leagueSplit([['MILB', 120]]), '120 MiLB teams');
  assert.deepEqual(withMilb.leagues.filter((l) => l === 'MILB'), ['MILB'], 'the code stays the key');
});

test('windows.json: MILB 2027 exists, so a MILB page can name its season (labeledSeason throws on an unknown league)', async () => {
  const { labeledSeason } = await import('../seasons/season-window');
  assert.equal(labeledSeason('MILB', '2026-12-01').season, '2027');
  assert.equal(labeledSeason('MILB', '2027-06-01').season, '2027');
});

test('team page: robots noindex for a zero-upcoming MILB page is wired through milbTeamIndexable', () => {
  const src = readFileSync(join(process.cwd(), 'src', 'app', '[sport]', '[team]', 'page.tsx'), 'utf8');
  assert.match(src, /const milbIndexable = milbTeamIndexable\(team\.league, promos\.filter\(\(p\) => isUpcomingPromo\(p, todayStr\)\)\.length\);/);
  assert.match(src, /\.\.\.\(milbIndexable \? \{\} : \{ robots: \{ index: false, follow: true \} \}\),/);
});
