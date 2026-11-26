// The Firestore side of the day-before reminders (src/lib/reminders.ts): the
// REAL scheduleReminderForSignup, cancelRemindersForSubscriber and the cron's
// store (claim, createIfAbsent, send), over an in-memory Firestore that
// understands document paths, equality queries and transactions. The page
// resolver, the games spine, the building and the sender are stood in.
//
// Run with:
//   node --import tsx --experimental-test-module-mocks --test <this file>

import { test, mock, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { Timestamp } from 'firebase-admin/firestore';

type Data = Record<string, unknown>;
const store = new Map<string, Data>();
let writes = 0;

function ref(path: string) {
  return {
    path,
    id: path.split('/').pop() as string,
    collection: (name: string) => col(`${path}/${name}`),
    get: async () => snap(path),
    update: async (d: Data) => {
      if (!store.has(path)) throw new Error(`NOT_FOUND ${path}`);
      writes += 1;
      store.set(path, { ...store.get(path), ...d });
    },
    set: async (d: Data) => {
      writes += 1;
      store.set(path, { ...d });
    },
  };
}
function snap(path: string) {
  const d = store.get(path);
  return { id: path.split('/').pop() as string, exists: d !== undefined, data: () => d, ref: ref(path) };
}
function col(path: string) {
  const docs = () => [...store.keys()].filter((k) => k.startsWith(`${path}/`) && !k.slice(path.length + 1).includes('/'));
  return {
    doc: (id: string) => ref(`${path}/${id}`),
    where: (field: string, _op: string, value: unknown) => ({
      get: async () => {
        const hit = docs().filter((k) => store.get(k)?.[field] === value).map(snap);
        return { docs: hit, size: hit.length, empty: hit.length === 0 };
      },
    }),
    get: async () => ({ docs: docs().map(snap) }),
  };
}
const db = {
  collection: (name: string) => col(name),
  runTransaction: async <T,>(fn: (tx: { get: (r: { path: string }) => Promise<ReturnType<typeof snap>>; set: (r: { path: string }, d: Data) => void; update: (r: { path: string }, d: Data) => void }) => Promise<T>): Promise<T> =>
    fn({
      get: async (r) => snap(r.path),
      set: (r, d) => {
        writes += 1;
        store.set(r.path, { ...d });
      },
      update: (r, d) => {
        writes += 1;
        store.set(r.path, { ...store.get(r.path), ...d });
      },
    }),
};

const WILD = { id: 'minnesota-wild', sportSlug: 'nhl', league: 'NHL', city: 'Minnesota', name: 'Wild' };
type Row = { promoId: string; date: string; title: string; type: string; displayTime: string; displayOpponent: string; pageSeason: string | null; updatedAt: string | null; attendanceCap: number | null; whileSuppliesLast: boolean | null };
let pageRows: Row[] = [];
let pageState: 'live' | 'removed' = 'live';
let games: Array<{ homeTeamSlug: string; date: string; status: string; gameTimeTz?: string }> = [];
let buildingZone: string | null = null;
let sends: Array<{ email: string; idempotencyKey: string; promo: { title: string; href: string; date: string } }> = [];

mock.module('server-only', { namedExports: {} });
mock.module(new URL('../firebase.ts', import.meta.url).href, { namedExports: { db } });
mock.module(new URL('../data.ts', import.meta.url).href, {
  namedExports: {
    getTeamBySlug: async (id: string) => (id === WILD.id ? WILD : null),
    getGamesForTeam: async () => games,
  },
});
mock.module(new URL('../venue-hub.ts', import.meta.url).href, {
  namedExports: {
    getVenueHubForTeam: async () => (buildingZone ? { slug: 'grand-casino-arena' } : null),
    getVenueHub: async () => ({ timezone: buildingZone }),
  },
});
mock.module(new URL('../promo-pages.ts', import.meta.url).href, {
  namedExports: {
    resolvePromoPage: async (_team: unknown, slug: string) =>
      slug === 'winter-beanie' && pageRows.length ? { slug, state: pageState, rows: pageRows, dates: pageRows.map((r) => r.date), canonicalSlug: null, updatedAt: '2026-11-20T00:00:00.000Z' } : null,
  },
});
mock.module(new URL('../digest.ts', import.meta.url).href, {
  namedExports: { toDigestTeam: (t: typeof WILD) => ({ id: t.id, name: 'Minnesota Wild', short: 'Wild', sportSlug: t.sportSlug, league: t.league }) },
});
mock.module(new URL('../subscribers.ts', import.meta.url).href, { namedExports: { deliveryInboxKey: (e: string) => e.toLowerCase() } });
mock.module(new URL('../email.ts', import.meta.url).href, {
  namedExports: {
    sendPromoReminder: async (a: (typeof sends)[number]) => {
      sends.push(a);
      return { ok: true, id: 'resend-1' };
    },
  },
});

const GAME = '2026-12-05';
const row = (over: Partial<Row> = {}): Row => ({ promoId: 'p1', date: GAME, title: 'Winter Beanie', type: 'giveaway', displayTime: '7:00 PM', displayOpponent: 'Blackhawks', pageSeason: '2026-27', updatedAt: null, attendanceCap: 5000, whileSuppliesLast: null, ...over });
const promoDoc = (over: Data = {}) => ({ title: 'Winter Beanie', date: GAME, pageSlug: 'winter-beanie', pageSeason: '2026-27', ...over });
const OPEN = new Date('2026-12-01T18:00:00Z');
const CLOSED = new Date('2026-12-04T16:00:00Z'); // 10:00 Central the day before
const ask = (now = OPEN, subscriberId = 'sub1', promoId = 'p1') => ({ subscriberId, teamId: WILD.id, promoId, now });
const reminder = (id = 'sub1_p1') => store.get(`promoReminders/${id}`);

beforeEach(() => {
  store.clear();
  writes = 0;
  sends = [];
  pageRows = [row()];
  pageState = 'live';
  games = [{ homeTeamSlug: WILD.id, date: GAME, status: 'scheduled', gameTimeTz: 'America/Chicago' }];
  buildingZone = 'America/Chicago';
  store.set('teams/minnesota-wild/promos/p1', promoDoc());
});

test('a signup schedules one reminder from the stored promo: 10:00 venue time the day before, the page identity, no address on the document', async () => {
  const { scheduleReminderForSignup } = await import('../reminders');
  const res = await scheduleReminderForSignup(ask());
  assert.deepEqual(res, { outcome: 'scheduled', promo: { title: 'Winter Beanie', teamName: 'Minnesota Wild', date: GAME } });
  const r = reminder();
  assert.ok(r);
  assert.equal(r.state, 'scheduled');
  assert.equal((r.sendAt as Timestamp).toDate().toISOString(), '2026-12-04T16:00:00.000Z');
  assert.deepEqual([r.subscriberId, r.teamId, r.league, r.promoId, r.pageSlug, r.pageSeason, r.gameDate, r.timeZone, r.series], ['sub1', 'minnesota-wild', 'NHL', 'p1', 'winter-beanie', '2026-27', GAME, 'America/Chicago', false]);
  assert.ok(!JSON.stringify(r).includes('@'), 'no email on the reminder');
});

test('idempotency: a double submit is ONE document and the second writes nothing', async () => {
  const { scheduleReminderForSignup } = await import('../reminders');
  await scheduleReminderForSignup(ask());
  const after = writes;
  const again = await scheduleReminderForSignup(ask());
  assert.equal(again.outcome, 'scheduled');
  assert.equal(writes, after, 'no write on the second submit');
  assert.equal([...store.keys()].filter((k) => k.startsWith('promoReminders/')).length, 1);
  // Another subscriber, or another promo, is its own reminder.
  await scheduleReminderForSignup(ask(OPEN, 'sub2'));
  assert.equal([...store.keys()].filter((k) => k.startsWith('promoReminders/')).length, 2);
});

test('too late on the server: at 10:00 venue time the day before, and after, nothing is written', async () => {
  const { scheduleReminderForSignup } = await import('../reminders');
  assert.deepEqual(await scheduleReminderForSignup(ask(CLOSED)), { outcome: 'too_late' });
  assert.deepEqual(await scheduleReminderForSignup(ask(new Date('2026-12-05T20:00:00Z'))), { outcome: 'too_late' });
  assert.equal(reminder(), undefined);
  assert.equal(writes, 0);
  // One minute earlier it is still open.
  assert.equal((await scheduleReminderForSignup(ask(new Date('2026-12-04T15:59:00Z')))).outcome, 'scheduled');
});

test('the zone chain: the game, else the building, else the site', async () => {
  const { scheduleReminderForSignup } = await import('../reminders');
  games = [{ homeTeamSlug: WILD.id, date: GAME, status: 'scheduled', gameTimeTz: 'America/Los_Angeles' }];
  await scheduleReminderForSignup(ask(OPEN, 'a'));
  assert.equal(reminder('a_p1')?.timeZone, 'America/Los_Angeles');
  games = [];
  await scheduleReminderForSignup(ask(OPEN, 'b'));
  assert.equal(reminder('b_p1')?.timeZone, 'America/Chicago', 'the building');
  buildingZone = null;
  await scheduleReminderForSignup(ask(OPEN, 'c'));
  assert.equal(reminder('c_p1')?.timeZone, 'America/New_York', 'the site');
  assert.equal((reminder('c_p1')?.sendAt as Timestamp).toDate().toISOString(), '2026-12-04T15:00:00.000Z');
});

test('none: an unknown team, an unknown, tombstoned, postseason or slugless promo, a removed page, a row the page does not show', async () => {
  const { scheduleReminderForSignup } = await import('../reminders');
  assert.equal((await scheduleReminderForSignup({ ...ask(), teamId: 'no-such-team' })).outcome, 'none');
  assert.equal((await scheduleReminderForSignup(ask(OPEN, 'sub1', 'nope'))).outcome, 'none');
  for (const over of [{ tombstoned: true }, { isPostseason: true }, { pageSlug: '' }]) {
    store.set('teams/minnesota-wild/promos/p1', promoDoc(over));
    assert.equal((await scheduleReminderForSignup(ask())).outcome, 'none', JSON.stringify(over));
  }
  store.set('teams/minnesota-wild/promos/p1', promoDoc());
  pageState = 'removed';
  assert.equal((await scheduleReminderForSignup(ask())).outcome, 'none');
  pageState = 'live';
  pageRows = [row({ promoId: 'other' })];
  assert.equal((await scheduleReminderForSignup(ask())).outcome, 'none');
  pageRows = [row({ date: '' })];
  assert.equal((await scheduleReminderForSignup(ask())).outcome, 'none');
  assert.equal(writes, 0);
});

test('a page with several upcoming dates marks the reminder as a series; a played date does not count', async () => {
  const { scheduleReminderForSignup } = await import('../reminders');
  pageRows = [row({ promoId: 'old', date: '2026-11-01' }), row()];
  await scheduleReminderForSignup(ask(OPEN, 'a'));
  assert.equal(reminder('a_p1')?.series, false);
  pageRows = [row(), row({ promoId: 'p2', date: '2026-12-12' })];
  await scheduleReminderForSignup(ask(OPEN, 'b'));
  assert.equal(reminder('b_p1')?.series, true);
});

test('unsubscribe cancels what is queued and nothing else; a later signup puts a cancelled reminder back in line', async () => {
  const { scheduleReminderForSignup, cancelRemindersForSubscriber } = await import('../reminders');
  await scheduleReminderForSignup(ask());
  store.set('promoReminders/sub1_sent', { subscriberId: 'sub1', state: 'sent' });
  store.set('promoReminders/sub2_p1', { subscriberId: 'sub2', state: 'scheduled' });
  assert.equal(await cancelRemindersForSubscriber('sub1'), 1);
  assert.deepEqual([reminder()?.state, reminder()?.cancelReason, reminder()?.sendAt], ['cancelled', 'unsubscribed', null]);
  assert.equal(reminder('sub1_sent')?.state, 'sent', 'a sent reminder is left alone');
  assert.equal(reminder('sub2_p1')?.state, 'scheduled', 'another subscriber is untouched');
  // They sign up again on the same promo page.
  assert.equal((await scheduleReminderForSignup(ask())).outcome, 'scheduled');
  assert.deepEqual([reminder()?.state, reminder()?.cancelReason], ['scheduled', null]);
  assert.ok(reminder()?.sendAt instanceof Timestamp);
});

test('a reminder already sent, being sent or carried to another document is never re-armed, and the answer promises nothing', async () => {
  const { scheduleReminderForSignup } = await import('../reminders');
  for (const state of ['sent', 'sending', 'superseded']) {
    store.set('promoReminders/sub1_p1', { subscriberId: 'sub1', state, sendAt: null });
    const before = writes;
    assert.deepEqual(await scheduleReminderForSignup(ask()), { outcome: 'too_late' }, state);
    assert.equal(reminder()?.state, state);
    assert.equal(writes, before);
  }
});

test('the cron store: claim is scheduled to sending exactly once; createIfAbsent never overwrites', async () => {
  const { scheduleReminderForSignup, firestoreReminderDeps } = await import('../reminders');
  await scheduleReminderForSignup(ask());
  const deps = firestoreReminderDeps(CLOSED);
  const [listed] = await deps.listScheduled();
  assert.deepEqual([listed.id, listed.sendAt, listed.gameDate, listed.series], ['sub1_p1', '2026-12-04T16:00:00.000Z', GAME, false]);
  assert.equal(await deps.claim('sub1_p1'), true);
  assert.equal(await deps.claim('sub1_p1'), false, 'a second run cannot claim it');
  assert.equal(await deps.claim('missing'), false);
  assert.equal(await deps.countSending(), 1);
  assert.equal((await deps.listScheduled()).length, 0);
  assert.equal(await deps.createIfAbsent({ ...listed, state: 'scheduled' }), false);
  assert.equal(reminder()?.state, 'sending', 'not overwritten');
  assert.equal(await deps.createIfAbsent({ ...listed, id: 'sub1_p2', promoId: 'p2' }), true);
  assert.ok(reminder('sub1_p2')?.sendAt instanceof Timestamp);
});

test('the cron store: the send names the promo as its page does, links the page, carries the reminder id as the idempotency key; a called-off game is held; a promo with no live page is no_page', async () => {
  const { scheduleReminderForSignup, firestoreReminderDeps } = await import('../reminders');
  await scheduleReminderForSignup(ask());
  const deps = firestoreReminderDeps(CLOSED);
  const [r] = await deps.listScheduled();
  const sub = { status: 'confirmed' as const, email: 'fan@example.com', manageToken: 'tok' };
  assert.deepEqual(await deps.send(r, sub), { ok: true, id: 'resend-1' });
  assert.equal(sends.length, 1);
  assert.equal(sends[0].idempotencyKey, 'sub1_p1');
  assert.deepEqual([sends[0].promo.title, sends[0].promo.href, sends[0].promo.date], ['Winter Beanie', '/nhl/minnesota-wild/promos/winter-beanie', GAME]);
  // Postponed on the schedule, the promo row not yet re-read.
  games = [{ homeTeamSlug: WILD.id, date: GAME, status: 'postponed', gameTimeTz: 'America/Chicago' }];
  assert.equal(await deps.send(r, sub), 'held');
  games = [];
  assert.notEqual(await deps.send(r, sub), 'held', 'no game on the spine is not called off');
  pageState = 'removed';
  assert.equal(await deps.send(r, sub), 'no_page');
  pageState = 'live';
  pageRows = [];
  assert.equal(await deps.send(r, sub), 'no_page');
  assert.equal(sends.length, 2);
});

test('the cron store reads subscribers and promo rows as the rules need them', async () => {
  const { firestoreReminderDeps } = await import('../reminders');
  const deps = firestoreReminderDeps(OPEN);
  store.set('subscribers/sub1', { email: 'fan@example.com', manageToken: 'tok', status: 'confirmed' });
  store.set('subscribers/sub2', { email: 'x@example.com', manageToken: 'tok2', status: 'weird' });
  store.set('subscribers/sub3', { email: 'y@example.com' });
  assert.deepEqual(await deps.getSubscriber('sub1'), { status: 'confirmed', email: 'fan@example.com', manageToken: 'tok' });
  assert.equal((await deps.getSubscriber('sub2'))?.status, 'pending', 'an unknown status is never confirmed');
  assert.equal(await deps.getSubscriber('sub3'), null, 'no manage token, no send');
  assert.equal(await deps.getSubscriber('nobody'), null);
  store.set('teams/minnesota-wild/promos/post', promoDoc({ isPostseason: true }));
  assert.deepEqual(await deps.getRow('minnesota-wild', 'p1'), { promoId: 'p1', date: GAME, pageSlug: 'winter-beanie', pageSeason: '2026-27', tombstoned: false });
  assert.equal((await deps.getRow('minnesota-wild', 'post'))?.tombstoned, true, 'a postseason row is not a live row');
  assert.equal(await deps.getRow('minnesota-wild', 'gone'), null);
  assert.equal((await deps.getTeamRows('minnesota-wild')).length, 2);
});
