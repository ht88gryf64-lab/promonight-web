// Image-card resolution for /feeds/social/image/{teamId}~{promoId}.
//
// Run with:
//   node --import tsx --test src/lib/social-feed/__tests__/card.test.ts

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { resolveCard, type CardDeps, type CardPromoDoc } from '../card';
import { parseFeedKey } from '../select';

const TEAMS = {
  'new-york-city-fc': { id: 'new-york-city-fc', city: 'New York', name: 'New York City FC', sportSlug: 'mls' },
  'new-england-revolution': { id: 'new-england-revolution', city: 'New England', name: 'Revolution', sportSlug: 'mls' },
} as const;

// Same promo id under two teams, as legacy "p10" is in production.
const PROMOS: Record<string, CardPromoDoc> = {
  'new-york-city-fc/p10': { date: '2026-09-26', title: 'Pride Night', opponent: 'Revolution' },
  'new-england-revolution/p10': { date: '2026-10-17', title: 'Fan Appreciation', opponent: 'NYCFC' },
  'new-york-city-fc/gone': { date: '2026-09-27', title: 'Old Night', tombstoned: true },
  'new-york-city-fc/nodate': { date: null, title: 'Undated' },
};

function deps(reads: string[] = []): CardDeps {
  return {
    getPromo: async (t, p) => {
      reads.push(`${t}/${p}`);
      return PROMOS[`${t}/${p}`] ?? null;
    },
    getTeam: async (t) => (TEAMS as Record<string, (typeof TEAMS)[keyof typeof TEAMS]>)[t] ?? null,
    getVenueName: async (t) => (t === 'new-york-city-fc' ? 'Yankee Stadium' : 'Gillette Stadium'),
  };
}

test('each team-scoped key resolves its own team when two teams share a promoId', async () => {
  const reads: string[] = [];
  const nyc = await resolveCard('new-york-city-fc~p10', deps(reads));
  const ne = await resolveCard('new-england-revolution~p10', deps(reads));
  assert.equal(nyc?.teamName, 'New York City FC');
  assert.equal(nyc?.title, 'Pride Night');
  assert.equal(nyc?.venue, 'Yankee Stadium');
  assert.equal(ne?.teamName, 'New England Revolution');
  assert.equal(ne?.title, 'Fan Appreciation');
  assert.equal(ne?.venue, 'Gillette Stadium');
  // Exactly one document read per card, scoped to the key's team.
  assert.deepEqual(reads, ['new-york-city-fc/p10', 'new-england-revolution/p10']);
});

test('malformed or half-missing keys resolve to null (404) without a read', async () => {
  const reads: string[] = [];
  for (const key of [
    'p10',
    '~p10',
    'new-york-city-fc~',
    '',
    '~',
    'new-york-city-fc~p10~x',
    'new-york-city-fc~a.b',
    'new york~p10',
    '..~p10',
    '../teams~p10',
    'new-york-city-fc/p10',
    `new-york-city-fc~${'x'.repeat(129)}`,
  ]) {
    assert.equal(await resolveCard(key, deps(reads)), null, key);
  }
  assert.deepEqual(reads, []);
});

test('the key splits on the first "~" only', () => {
  assert.deepEqual(parseFeedKey('new-york-city-fc~p10'), { teamId: 'new-york-city-fc', promoId: 'p10' });
  // The remainder carries a second "~", which fails the promoId pattern.
  assert.equal(parseFeedKey('a~b~c'), null);
});

test('missing team, missing doc, tombstoned doc and undated doc resolve to null', async () => {
  assert.equal(await resolveCard('no-such-team~p10', deps()), null);
  assert.equal(await resolveCard('new-york-city-fc~missing', deps()), null);
  assert.equal(await resolveCard('new-york-city-fc~gone', deps()), null);
  assert.equal(await resolveCard('new-york-city-fc~nodate', deps()), null);
});
