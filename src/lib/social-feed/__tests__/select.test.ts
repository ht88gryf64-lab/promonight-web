// Selection rules for the social RSS feed (/feeds/social.xml).
//
// Run with:
//   node --import tsx --test src/lib/social-feed/__tests__/select.test.ts

import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  applyCaps,
  feedWindow,
  FEED_CAP,
  orderPass1,
  orderPass2,
  selectFeedItems,
  type FeedCandidate,
} from '../select';

// 2026-09-25 12:00 CDT
const NOW = new Date('2026-09-25T17:00:00Z');
const WINDOW = feedWindow(NOW);

let seq = 0;
function promo(over: Partial<FeedCandidate> = {}): FeedCandidate {
  seq += 1;
  return {
    promoId: `p${String(seq).padStart(4, '0')}`,
    teamId: `team-${seq}`,
    date: '2026-09-26',
    title: `Promo ${seq}`,
    type: 'giveaway',
    score: 50,
    itemType: null,
    ...over,
  };
}
const unscored = (over: Partial<FeedCandidate> = {}) => promo({ score: undefined, ...over });

async function run(scored: FeedCandidate[], fallback: FeedCandidate[], now = NOW) {
  let fallbackCalls = 0;
  const sel = await selectFeedItems({
    now,
    loadScored: async () => scored,
    loadUnscored: async () => {
      fallbackCalls += 1;
      return fallback;
    },
  });
  return { ...sel, fallbackCalls };
}

test('window is today through today+7 in Central time, inclusive', () => {
  assert.deepEqual(WINDOW, { start: '2026-09-25', end: '2026-10-02' });
  const inside = [promo({ date: '2026-09-25' }), promo({ date: '2026-10-02' })];
  const outside = [promo({ date: '2026-09-24' }), promo({ date: '2026-10-03' })];
  const got = orderPass1([...inside, ...outside], WINDOW).map((p) => p.promoId);
  assert.deepEqual(got.sort(), inside.map((p) => p.promoId).sort());
});

test('window flips at midnight Central, not midnight UTC (CDT and CST)', () => {
  // 23:59:59 CDT on Sep 25 is already Sep 26 in UTC.
  assert.equal(feedWindow(new Date('2026-09-26T04:59:59Z')).start, '2026-09-25');
  assert.equal(feedWindow(new Date('2026-09-26T05:00:00Z')).start, '2026-09-26');
  // Winter: offset is 6 hours.
  assert.equal(feedWindow(new Date('2026-12-02T05:59:59Z')).start, '2026-12-01');
  assert.equal(feedWindow(new Date('2026-12-02T06:00:00Z')).start, '2026-12-02');
  // Month and year rollover on the end bound.
  assert.equal(feedWindow(new Date('2026-12-28T18:00:00Z')).end, '2027-01-04');
});

test('tombstoned, null-date, malformed-date, and non giveaway/theme promos are excluded', () => {
  const keep = [promo(), promo({ type: 'theme' })];
  const drop = [
    promo({ tombstoned: true }),
    promo({ date: null }),
    promo({ date: undefined }),
    promo({ date: '' }),
    promo({ date: '2026-9-26' }),
    promo({ type: 'food' }),
    promo({ type: 'kids' }),
    promo({ title: '<cite index="1"></cite>' }),
  ];
  const all = [...keep, ...drop];
  assert.deepEqual(
    orderPass1(all, WINDOW).map((p) => p.promoId).sort(),
    keep.map((p) => p.promoId).sort(),
  );
  const keepU = keep.map((p) => ({ ...p, score: undefined }));
  const dropU = drop.map((p) => ({ ...p, score: undefined }));
  assert.deepEqual(
    orderPass2([...keepU, ...dropU], WINDOW).map((p) => p.promoId).sort(),
    keepU.map((p) => p.promoId).sort(),
  );
});

test('pass 1 orders by score desc; pass 2 by date, giveaway before theme, promoId', () => {
  const a = promo({ score: 40 });
  const b = promo({ score: 90 });
  const c = promo({ score: 70 });
  assert.deepEqual(orderPass1([a, b, c], WINDOW).map((p) => p.score), [90, 70, 40]);

  const u1 = unscored({ promoId: 'b', date: '2026-09-27', type: 'giveaway' });
  const u2 = unscored({ promoId: 'z', date: '2026-09-26', type: 'theme' });
  const u3 = unscored({ promoId: 'y', date: '2026-09-26', type: 'giveaway' });
  const u4 = unscored({ promoId: 'a', date: '2026-09-26', type: 'theme' });
  assert.deepEqual(orderPass2([u1, u2, u3, u4], WINDOW).map((p) => p.promoId), ['y', 'a', 'z', 'b']);
});

test('per-team cap keeps at most 2 items per team', () => {
  const items = [1, 2, 3, 4].map((n) => promo({ teamId: 'twins', score: 100 - n }));
  const got = applyCaps(orderPass1(items, WINDOW));
  assert.equal(got.length, 2);
  assert.deepEqual(got.map((p) => p.score), [99, 98]);
});

test('variety cap: max 2 per real itemType', () => {
  const items = [1, 2, 3].map((n) => promo({ itemType: 'bobblehead', score: 100 - n }));
  const got = applyCaps(orderPass1(items, WINDOW));
  assert.equal(got.length, 2);
});

test('null and generic itemTypes are exempt from the variety cap, and so are unscored promos', () => {
  const nulls = [1, 2, 3, 4].map(() => promo({ itemType: null }));
  const generics = [1, 2, 3, 4].map(() => promo({ itemType: 'generic' }));
  assert.equal(applyCaps(orderPass1([...nulls, ...generics], WINDOW)).length, 8);
  // An unscored promo with a stray itemType is still exempt.
  const stray = [1, 2, 3].map(() => unscored({ itemType: 'bobblehead' }));
  assert.equal(applyCaps(orderPass2(stray, WINDOW)).length, 3);
});

test('total cap is 25', () => {
  const items = Array.from({ length: 40 }, () => promo());
  assert.equal(applyCaps(orderPass1(items, WINDOW)).length, FEED_CAP);
  assert.equal(FEED_CAP, 25);
});

test('duplicates by promoId or by team + date + title are dropped', () => {
  const a = promo({ teamId: 't1', title: 'Bobblehead Night' });
  const sameId = { ...a, score: 10 };
  const sameContent = promo({ teamId: 't1', title: '  bobblehead   night ', score: 5 });
  assert.equal(applyCaps(orderPass1([a, sameId, sameContent], WINDOW)).length, 1);
});

test('pass 2 does not run when pass 1 fills the feed', async () => {
  const scored = Array.from({ length: 25 }, () => promo());
  const r = await run(scored, [unscored()]);
  assert.equal(r.fallbackCalls, 0);
  assert.equal(r.usedFallback, false);
  assert.equal(r.items.length, 25);
  assert.equal(r.pass1Count, 25);
});

test('pass 2 runs when pass 1 yields fewer than 25 after caps', async () => {
  // 30 scored, but all one team: caps leave 2.
  const scored = Array.from({ length: 30 }, () => promo({ teamId: 'twins' }));
  const fallback = Array.from({ length: 5 }, () => unscored());
  const r = await run(scored, fallback);
  assert.equal(r.fallbackCalls, 1);
  assert.equal(r.usedFallback, true);
  assert.equal(r.pass1Count, 2);
  assert.equal(r.items.length, 7);
  assert.deepEqual(r.items.slice(0, 2).map((p) => p.teamId), ['twins', 'twins']);
});

test('pass 2 respects caps already used by pass 1 and dedupes across passes', async () => {
  const s1 = promo({ teamId: 'twins' });
  const s2 = promo({ teamId: 'twins' });
  const u1 = unscored({ teamId: 'twins' });
  const dupe = { ...s1, score: undefined };
  const u2 = unscored({ teamId: 'cubs' });
  const r = await run([s1, s2], [u1, dupe, u2]);
  assert.deepEqual(r.items.map((p) => p.promoId), [s1.promoId, s2.promoId, u2.promoId]);
});

test('a window with zero scored items still returns unscored items', async () => {
  const fallback = [unscored({ date: '2026-09-30' }), unscored({ date: '2026-09-28', type: 'theme' })];
  const r = await run([], fallback);
  assert.equal(r.pass1Count, 0);
  assert.equal(r.items.length, 2);
  assert.deepEqual(r.items.map((p) => p.date), ['2026-09-28', '2026-09-30']);
});

test('pass 2 fills up to 25 in total', async () => {
  const scored = Array.from({ length: 10 }, () => promo());
  const fallback = Array.from({ length: 40 }, () => unscored());
  const r = await run(scored, fallback);
  assert.equal(r.items.length, 25);
  assert.equal(r.pass1Count, 10);
});

test('a doc with a score that the scored reader left out still reaches pass 2, unranked and itemType-exempt', async () => {
  // e.g. score present but no derivedSignals, so fetchScoredPromos skipped it.
  const orphans = [1, 2, 3].map(() => promo({ score: 80, itemType: 'bobblehead' }));
  const r = await run([], orphans);
  assert.equal(r.items.length, 3);
  assert.ok(r.items.every((p) => p.score === null && p.itemType === null));
});

test('a pass-1 source row never re-enters through pass 2', async () => {
  const s = [1, 2, 3].map(() => promo({ teamId: 'twins' }));
  const twin = { ...s[2], score: undefined };
  const r = await run(s, [twin]);
  assert.deepEqual(r.items.map((p) => p.promoId), [s[0].promoId, s[1].promoId]);
});

test('ids the image route cannot resolve are excluded', () => {
  const bad = [promo({ promoId: 'a.b' }), promo({ promoId: 'a b' }), promo({ promoId: 'x'.repeat(129) }), promo({ promoId: '' })];
  const good = promo({ promoId: '2026-09-26-fan-appreciation' });
  assert.deepEqual(orderPass1([...bad, good], WINDOW).map((p) => p.promoId), [good.promoId]);
});
