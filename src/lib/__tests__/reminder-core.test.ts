// The day-before reminder rules and the hourly run (src/lib/reminder-core.ts),
// against an in-memory store: no Firestore, no Resend, the clock handed in.
//
// The cases are the Gate 1 rulings of 2026-11-26 and the tests the brief
// names: the send moment and too late, idempotency, a tombstoned promo, a
// rescheduled promo, an unconfirmed subscriber, a late confirm, a followed
// row, an ambiguous series.
//
// Run with: node --import tsx --test <this file>

import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  REMINDER_RUN_CEILING,
  dueStage,
  gameDayStart,
  reconcile,
  reminderDocId,
  reminderOpen,
  reminderSendAt,
  reminderZone,
  runReminders,
  type Reminder,
  type ReminderDeps,
  type ReminderRow,
  type ReminderSubscriber,
} from '../reminder-core';

const CT = 'America/Chicago';
const GAME = '2026-12-05'; // a Saturday; the day before is Friday 2026-12-04

// ── the moment ───────────────────────────────────────────────────────────────

test('sendAt is 10:00 in the venue zone on the calendar day before the game', () => {
  assert.equal(reminderSendAt(GAME, CT).toISOString(), '2026-12-04T16:00:00.000Z'); // CST, UTC-6
  assert.equal(reminderSendAt(GAME, 'America/Los_Angeles').toISOString(), '2026-12-04T18:00:00.000Z');
  assert.equal(reminderSendAt('2026-07-10', CT).toISOString(), '2026-07-09T15:00:00.000Z'); // CDT, UTC-5
  // Phoenix keeps no daylight time.
  assert.equal(reminderSendAt('2026-07-10', 'America/Phoenix').toISOString(), '2026-07-09T17:00:00.000Z');
});

test('the zone chain ends at the site zone: an absent or unknown zone is America/New_York', () => {
  assert.equal(reminderZone(null), 'America/New_York');
  assert.equal(reminderZone('Not/AZone'), 'America/New_York');
  assert.equal(reminderZone('CST'), 'America/New_York');
  assert.equal(reminderSendAt(GAME, null).toISOString(), '2026-12-04T15:00:00.000Z'); // EST, UTC-5
});

test('a game on the day the clocks change still sends at 10:00 local the day before', () => {
  // US clocks go forward on Sunday 2027-03-14; the day before is still standard time.
  assert.equal(reminderSendAt('2027-03-14', CT).toISOString(), '2027-03-13T16:00:00.000Z');
  // A Monday game: the day before IS the change day, 10:00 CDT.
  assert.equal(reminderSendAt('2027-03-15', CT).toISOString(), '2027-03-14T15:00:00.000Z');
  assert.equal(gameDayStart('2027-03-15', CT).toISOString(), '2027-03-15T05:00:00.000Z');
});

test('too late: open until 10:00 venue time the day before, closed at that minute and after, closed on game day', () => {
  assert.equal(reminderOpen(new Date('2026-12-04T15:59:59Z'), GAME, CT), true);
  assert.equal(reminderOpen(new Date('2026-12-04T16:00:00Z'), GAME, CT), false, 'at 10:00 exactly');
  assert.equal(reminderOpen(new Date('2026-12-04T22:00:00Z'), GAME, CT), false);
  assert.equal(reminderOpen(new Date('2026-12-05T18:00:00Z'), GAME, CT), false, 'game day');
  assert.equal(reminderOpen(new Date('2026-12-01T00:00:00Z'), '', CT), false, 'no usable date');
  // The same instant is open in a zone further west.
  assert.equal(reminderOpen(new Date('2026-12-04T16:30:00Z'), GAME, 'America/Los_Angeles'), true);
});

test('dueStage: wait, then due from 10:00 the day before, then past from the start of game day', () => {
  assert.equal(dueStage(new Date('2026-12-04T15:59:00Z'), GAME, CT), 'wait');
  assert.equal(dueStage(new Date('2026-12-04T16:00:00Z'), GAME, CT), 'due');
  assert.equal(dueStage(new Date('2026-12-05T05:59:00Z'), GAME, CT), 'due', '23:59 the day before');
  assert.equal(dueStage(new Date('2026-12-05T06:00:00Z'), GAME, CT), 'past', 'midnight opening game day');
});

// ── reconcile ────────────────────────────────────────────────────────────────

const row = (over: Partial<ReminderRow> = {}): ReminderRow => ({ promoId: 'p1', date: GAME, pageSlug: 'winter-beanie', pageSeason: '2026-27', tombstoned: false, ...over });
const subject = { promoId: 'p1', pageSlug: 'winter-beanie', pageSeason: '2026-27', gameDate: GAME, series: false };

test('reconcile: a live row on the same date is kept; the same row on another date moves', () => {
  assert.deepEqual(reconcile(subject, row(), [], '2026-11-26'), { action: 'keep' });
  assert.deepEqual(reconcile(subject, row({ date: '2026-12-12' }), [], '2026-11-26'), { action: 'move', gameDate: '2026-12-12' });
});

test('reconcile: a tombstoned row with nothing live on its page cancels as tombstoned', () => {
  assert.deepEqual(reconcile(subject, row({ tombstoned: true }), [row({ tombstoned: true })], '2026-11-26'), { action: 'cancel', reason: 'tombstoned' });
  assert.deepEqual(reconcile(subject, null, [], '2026-11-26'), { action: 'cancel', reason: 'tombstoned' }, 'a deleted document');
  // Live rows on OTHER pages, in another season, or already played do not count.
  const others = [row({ promoId: 'x', pageSlug: 'other-night' }), row({ promoId: 'y', pageSeason: '2025-26' }), row({ promoId: 'z', date: '2026-11-01' })];
  assert.deepEqual(reconcile(subject, row({ tombstoned: true }), others, '2026-11-26'), { action: 'cancel', reason: 'tombstoned' });
});

test('reconcile: a tombstone with ONE live row on the same page follows to the new id', () => {
  const next = row({ promoId: 'p2', date: '2026-12-12' });
  assert.deepEqual(reconcile(subject, row({ tombstoned: true }), [row({ tombstoned: true }), next], '2026-11-26'), { action: 'follow', row: next });
});

test('reconcile: an ambiguous series cancels, whether the page was a series at signup or holds several live rows now', () => {
  const a = row({ promoId: 'p2', date: '2026-12-12' });
  const b = row({ promoId: 'p3', date: '2026-12-19' });
  assert.deepEqual(reconcile(subject, row({ tombstoned: true }), [a, b], '2026-11-26'), { action: 'cancel', reason: 'ambiguous_series' });
  assert.deepEqual(reconcile({ ...subject, series: true }, row({ tombstoned: true }), [a], '2026-11-26'), { action: 'cancel', reason: 'ambiguous_series' }, 'one row left of a series is still a guess');
});

// ── the run, over memory ─────────────────────────────────────────────────────

interface World {
  reminders: Map<string, Reminder & { sentAt?: string; resendId?: string | null }>;
  rows: Map<string, ReminderRow>; // key team|promoId
  subscribers: Map<string, ReminderSubscriber>;
  sent: { reminderId: string; to: string }[];
  sendResult: { ok: boolean; id?: string; error?: string } | 'no_page' | 'held' | Error;
  /** Promo ids whose row read throws. */
  broken: Set<string>;
  writes: number;
}

function world(): World {
  return { reminders: new Map(), rows: new Map(), subscribers: new Map(), sent: [], sendResult: { ok: true, id: 'resend-1' }, writes: 0, broken: new Set() };
}

function deps(w: World): ReminderDeps {
  return {
    listScheduled: async () => [...w.reminders.values()].filter((r) => r.state === 'scheduled').map((r) => ({ ...r })),
    countSending: async () => [...w.reminders.values()].filter((r) => r.state === 'sending').length,
    getRow: async (teamId, promoId) => {
      if (w.broken.has(promoId)) throw new Error('DEADLINE_EXCEEDED');
      return w.rows.get(`${teamId}|${promoId}`) ?? null;
    },
    getTeamRows: async (teamId) => [...w.rows.entries()].filter(([k]) => k.startsWith(`${teamId}|`)).map(([, v]) => v),
    zoneFor: async () => CT,
    getSubscriber: async (id) => w.subscribers.get(id) ?? null,
    inboxKey: (email) => email.toLowerCase().replace(/\+[^@]*@/, '@'),
    createIfAbsent: async (r) => {
      if (w.reminders.has(r.id)) return false;
      w.writes += 1;
      w.reminders.set(r.id, { ...r });
      return true;
    },
    update: async (id, patch) => {
      w.writes += 1;
      const cur = w.reminders.get(id);
      assert.ok(cur, `update of a missing reminder ${id}`);
      const { sentAt, ...rest } = patch;
      w.reminders.set(id, { ...cur, ...rest, ...(sentAt ? { sentAt: 'now' } : {}) });
    },
    claim: async (id) => {
      const cur = w.reminders.get(id);
      if (!cur || cur.state !== 'scheduled') return false;
      w.writes += 1;
      w.reminders.set(id, { ...cur, state: 'sending' });
      return true;
    },
    send: async (reminder, subscriber) => {
      if (w.sendResult instanceof Error) throw w.sendResult;
      if (w.sendResult !== 'no_page' && w.sendResult !== 'held' && w.sendResult.ok) w.sent.push({ reminderId: reminder.id, to: subscriber.email });
      return w.sendResult;
    },
  };
}

/** Signup as src/lib/reminders.ts does it: create-if-absent on the id. */
async function signup(w: World, subscriberId: string, promoId = 'p1', over: Partial<Reminder> = {}): Promise<boolean> {
  const r: Reminder = {
    id: reminderDocId(subscriberId, promoId),
    subscriberId,
    teamId: 'minnesota-wild',
    league: 'NHL',
    promoId,
    pageSlug: 'winter-beanie',
    pageSeason: '2026-27',
    gameDate: GAME,
    timeZone: CT,
    sendAt: reminderSendAt(GAME, CT).toISOString(),
    state: 'scheduled',
    series: false,
    ...over,
  };
  return deps(w).createIfAbsent(r);
}

function seed(): World {
  const w = world();
  w.rows.set('minnesota-wild|p1', row());
  w.subscribers.set('sub1', { status: 'confirmed', email: 'fan@example.com', manageToken: 'tok1' });
  return w;
}

const BEFORE = new Date('2026-12-03T18:00:00Z'); // two days out
const DUE = new Date('2026-12-04T16:05:00Z'); // 10:05 CT the day before
const LATER = new Date('2026-12-04T23:05:00Z'); // 17:05 CT the day before
const GAME_DAY = new Date('2026-12-05T06:05:00Z'); // 00:05 CT on game day

test('idempotency: a double submit is one reminder, and it is sent once however many runs follow', async () => {
  const w = seed();
  assert.equal(await signup(w, 'sub1'), true);
  assert.equal(await signup(w, 'sub1'), false, 'the second submit creates nothing');
  assert.equal(w.reminders.size, 1);
  const first = await runReminders(deps(w), { now: DUE, execute: true });
  assert.equal(first.sent, 1);
  const second = await runReminders(deps(w), { now: LATER, execute: true });
  assert.equal(second.scheduled, 0);
  assert.equal(second.sent, 0);
  assert.equal(w.sent.length, 1, 'one email, ever');
  // A third submit after the send still creates nothing.
  assert.equal(await signup(w, 'sub1'), false);
  assert.equal(w.reminders.get('sub1_p1')?.state, 'sent');
  assert.equal(w.reminders.get('sub1_p1')?.sendAt, null);
  assert.equal(w.reminders.get('sub1_p1')?.resendId, 'resend-1');
});

test('nothing is sent before the moment, and a dry run reads but never writes or sends', async () => {
  const w = seed();
  await signup(w, 'sub1');
  const early = await runReminders(deps(w), { now: BEFORE, execute: true });
  assert.deepEqual([early.scheduled, early.due, early.toSend, early.sent], [1, 0, 0, 0]);
  const writesBefore = w.writes;
  const dry = await runReminders(deps(w), { now: DUE, execute: false });
  assert.equal(dry.mode, 'dry-run');
  assert.deepEqual([dry.scheduled, dry.due, dry.toSend, dry.sent], [1, 1, 1, 0], 'the plan says one would send');
  assert.equal(w.writes, writesBefore, 'no write on a dry run');
  assert.equal(w.sent.length, 0, 'no send on a dry run');
  assert.equal(w.reminders.get('sub1_p1')?.state, 'scheduled');
});

test('a tombstoned promo sends nothing and the reminder is cancelled', async () => {
  const w = seed();
  await signup(w, 'sub1');
  w.rows.set('minnesota-wild|p1', row({ tombstoned: true }));
  const run = await runReminders(deps(w), { now: DUE, execute: true });
  assert.equal(run.sent, 0);
  assert.equal(w.sent.length, 0);
  assert.deepEqual(run.cancelled, { tombstoned: 1 });
  assert.equal(w.reminders.get('sub1_p1')?.state, 'cancelled');
  assert.equal(w.reminders.get('sub1_p1')?.cancelReason, 'tombstoned');
  assert.equal(w.reminders.get('sub1_p1')?.sendAt, null);
});

test('a rescheduled promo moves sendAt: the tombstone with one live row on the same page follows to the new id, and the email goes the day before the NEW date', async () => {
  const w = seed();
  await signup(w, 'sub1');
  // The club moves the game a week: the pipeline tombstones p1 and writes p2.
  w.rows.set('minnesota-wild|p1', row({ tombstoned: true }));
  w.rows.set('minnesota-wild|p2', row({ promoId: 'p2', date: '2026-12-12' }));
  const onOldDay = await runReminders(deps(w), { now: DUE, execute: true });
  assert.equal(onOldDay.followed, 1);
  assert.equal(onOldDay.sent, 0, 'nothing on the day before the OLD date');
  assert.equal(w.reminders.get('sub1_p1')?.state, 'superseded');
  const moved = w.reminders.get('sub1_p2');
  assert.ok(moved, 'a reminder under the new id');
  assert.equal(moved.state, 'scheduled');
  assert.equal(moved.gameDate, '2026-12-12');
  assert.equal(moved.sendAt, '2026-12-11T16:00:00.000Z');
  // Signing up again on the rescheduled page is the same reminder.
  assert.equal(await signup(w, 'sub1', 'p2'), false);
  const onNewDay = await runReminders(deps(w), { now: new Date('2026-12-11T16:05:00Z'), execute: true });
  assert.equal(onNewDay.sent, 1);
  assert.deepEqual(w.sent, [{ reminderId: 'sub1_p2', to: 'fan@example.com' }]);
});

test('a date edited on the same document moves sendAt in place', async () => {
  const w = seed();
  await signup(w, 'sub1');
  w.rows.set('minnesota-wild|p1', row({ date: '2026-12-08' }));
  const run = await runReminders(deps(w), { now: DUE, execute: true });
  assert.equal(run.moved, 1);
  assert.equal(run.sent, 0);
  assert.equal(w.reminders.get('sub1_p1')?.gameDate, '2026-12-08');
  assert.equal(w.reminders.get('sub1_p1')?.sendAt, '2026-12-07T16:00:00.000Z');
});

test('never a second email after a send: a game rescheduled after its reminder went out is not followed', async () => {
  const w = seed();
  await signup(w, 'sub1');
  await runReminders(deps(w), { now: DUE, execute: true });
  assert.equal(w.sent.length, 1);
  w.rows.set('minnesota-wild|p1', row({ tombstoned: true }));
  w.rows.set('minnesota-wild|p2', row({ promoId: 'p2', date: '2026-12-12' }));
  const later = await runReminders(deps(w), { now: new Date('2026-12-11T16:05:00Z'), execute: true });
  assert.equal(later.scheduled, 0);
  assert.equal(later.followed, 0);
  assert.equal(w.sent.length, 1);
  assert.equal(w.reminders.has('sub1_p2'), false);
});

test('an ambiguous series cancels and sends nothing', async () => {
  const w = seed();
  await signup(w, 'sub1', 'p1', { series: true });
  w.rows.set('minnesota-wild|p1', row({ tombstoned: true }));
  w.rows.set('minnesota-wild|p2', row({ promoId: 'p2', date: '2026-12-12' }));
  w.rows.set('minnesota-wild|p3', row({ promoId: 'p3', date: '2026-12-19' }));
  const run = await runReminders(deps(w), { now: DUE, execute: true });
  assert.deepEqual(run.cancelled, { ambiguous_series: 1 });
  assert.equal(run.followed, 0);
  assert.equal(w.sent.length, 0);
  assert.equal(w.reminders.get('sub1_p1')?.cancelReason, 'ambiguous_series');
  assert.equal(w.reminders.size, 1, 'no reminder was created for either date');
});

test('an unconfirmed subscriber gets no send, stays in line through the day before, and is cancelled at game-day start', async () => {
  const w = seed();
  w.subscribers.set('sub1', { status: 'pending', email: 'fan@example.com', manageToken: 'tok1' });
  await signup(w, 'sub1');
  const due = await runReminders(deps(w), { now: DUE, execute: true });
  assert.deepEqual([due.due, due.toSend, due.sent, due.waitingUnconfirmed], [1, 0, 0, 1]);
  assert.equal(w.reminders.get('sub1_p1')?.state, 'scheduled', 'left in line');
  const evening = await runReminders(deps(w), { now: LATER, execute: true });
  assert.equal(evening.waitingUnconfirmed, 1);
  assert.equal(w.reminders.get('sub1_p1')?.state, 'scheduled');
  const gameDay = await runReminders(deps(w), { now: GAME_DAY, execute: true });
  assert.deepEqual(gameDay.cancelled, { unconfirmed: 1 });
  assert.equal(w.reminders.get('sub1_p1')?.state, 'cancelled');
  assert.equal(w.reminders.get('sub1_p1')?.cancelReason, 'unconfirmed');
  assert.equal(w.sent.length, 0, 'never sent');
});

test('a late confirm on the day before still sends, on the next hourly run', async () => {
  const w = seed();
  w.subscribers.set('sub1', { status: 'pending', email: 'fan@example.com', manageToken: 'tok1' });
  await signup(w, 'sub1');
  await runReminders(deps(w), { now: DUE, execute: true });
  assert.equal(w.sent.length, 0);
  // They click the confirmation link that afternoon.
  w.subscribers.set('sub1', { status: 'confirmed', email: 'fan@example.com', manageToken: 'tok1' });
  const run = await runReminders(deps(w), { now: LATER, execute: true });
  assert.equal(run.sent, 1);
  assert.deepEqual(w.sent, [{ reminderId: 'sub1_p1', to: 'fan@example.com' }]);
});

test('a confirm on game day is too late: nothing is ever sent on or after game day', async () => {
  const w = seed();
  w.subscribers.set('sub1', { status: 'confirmed', email: 'fan@example.com', manageToken: 'tok1' });
  await signup(w, 'sub1');
  // Every run the day before was missed (an outage).
  const run = await runReminders(deps(w), { now: GAME_DAY, execute: true });
  assert.equal(run.sent, 0);
  assert.deepEqual(run.cancelled, { expired: 1 });
  assert.equal(w.sent.length, 0);
});

test('an unsubscribed or deleted subscriber is cancelled, never mailed', async () => {
  const w = seed();
  w.subscribers.set('sub1', { status: 'unsubscribed', email: 'fan@example.com', manageToken: 'tok1' });
  await signup(w, 'sub1');
  await signup(w, 'ghost');
  const run = await runReminders(deps(w), { now: DUE, execute: true });
  assert.deepEqual(run.cancelled, { unsubscribed: 1, subscriber_missing: 1 });
  assert.equal(w.sent.length, 0);
});

test('two subscriber records that deliver to one inbox get one email for the same promo', async () => {
  const w = seed();
  w.subscribers.set('sub2', { status: 'confirmed', email: 'fan+promos@example.com', manageToken: 'tok2' });
  await signup(w, 'sub1');
  await signup(w, 'sub2');
  const run = await runReminders(deps(w), { now: DUE, execute: true });
  assert.equal(run.sent, 1);
  assert.deepEqual(run.cancelled, { duplicate_inbox: 1 });
});

test('a failed send goes back in line and is retried the next hour; a send that throws does too', async () => {
  const w = seed();
  await signup(w, 'sub1');
  w.sendResult = { ok: false, error: 'resend_500' };
  const failed = await runReminders(deps(w), { now: DUE, execute: true });
  assert.deepEqual([failed.sent, failed.failed], [0, 1]);
  assert.equal(w.reminders.get('sub1_p1')?.state, 'scheduled');
  w.sendResult = new Error('socket hang up');
  const threw = await runReminders(deps(w), { now: DUE, execute: true });
  assert.deepEqual([threw.sent, threw.failed], [0, 1]);
  assert.equal(w.reminders.get('sub1_p1')?.state, 'scheduled');
  w.sendResult = { ok: true, id: 'resend-2' };
  const ok = await runReminders(deps(w), { now: LATER, execute: true });
  assert.equal(ok.sent, 1);
  assert.equal(w.sent.length, 1);
});

test('a promo with no page to link is cancelled as no_page, not mailed', async () => {
  const w = seed();
  await signup(w, 'sub1');
  w.sendResult = 'no_page';
  const run = await runReminders(deps(w), { now: DUE, execute: true });
  assert.equal(run.sent, 0);
  assert.deepEqual(run.cancelled, { no_page: 1 });
  assert.equal(w.reminders.get('sub1_p1')?.state, 'cancelled');
});

test('a reminder another run already claimed is not sent again, and is reported as stuck', async () => {
  const w = seed();
  await signup(w, 'sub1');
  w.reminders.set('sub1_p1', { ...w.reminders.get('sub1_p1')!, state: 'sending' });
  const run = await runReminders(deps(w), { now: DUE, execute: true });
  assert.equal(run.scheduled, 0);
  assert.equal(run.stuckSending, 1);
  assert.equal(w.sent.length, 0);
});

test('the per-run ceiling: an execute run over it sends nothing unless overCap is passed', async () => {
  const w = seed();
  for (let i = 0; i < 3; i++) {
    w.subscribers.set(`s${i}`, { status: 'confirmed', email: `fan${i}@example.com`, manageToken: `t${i}` });
    await signup(w, `s${i}`);
  }
  assert.equal(REMINDER_RUN_CEILING, 500);
  const blocked = await runReminders(deps(w), { now: DUE, execute: true, ceiling: 2 });
  assert.equal(blocked.aborted, 'exceeds_send_ceiling');
  assert.deepEqual([blocked.toSend, blocked.sent, blocked.withinCeiling], [3, 0, false]);
  assert.equal(w.sent.length, 0);
  const forced = await runReminders(deps(w), { now: DUE, execute: true, ceiling: 2, overCap: true });
  assert.equal(forced.sent, 3);
});

test('a game called off on the schedule is held: nothing sent, the reminder stays in line', async () => {
  const w = seed();
  await signup(w, 'sub1');
  w.sendResult = 'held';
  const run = await runReminders(deps(w), { now: DUE, execute: true });
  assert.deepEqual([run.sent, run.failed, run.held], [0, 0, 1]);
  assert.equal(w.reminders.get('sub1_p1')?.state, 'scheduled');
  assert.equal(w.sent.length, 0);
});

test('one reminder that cannot be read does not stop the others', async () => {
  const w = seed();
  w.rows.set('minnesota-wild|bad', row({ promoId: 'bad' }));
  await signup(w, 'sub1', 'bad');
  w.subscribers.set('sub2', { status: 'confirmed', email: 'other@example.com', manageToken: 'tok2' });
  await signup(w, 'sub2');
  w.broken.add('bad');
  const run = await runReminders(deps(w), { now: DUE, execute: true });
  assert.deepEqual([run.errored, run.sent], [1, 1]);
  assert.deepEqual(w.sent, [{ reminderId: 'sub2_p1', to: 'other@example.com' }]);
  assert.equal(w.reminders.get('sub1_bad')?.state, 'scheduled', 'left for the next run');
});

test('a run that is still sending when game day starts stops sending: the check is made again at each send', async () => {
  const w = seed();
  w.subscribers.set('sub2', { status: 'confirmed', email: 'other@example.com', manageToken: 'tok2' });
  await signup(w, 'sub1');
  await signup(w, 'sub2');
  // The run begins at 23:59 venue time; the first send is on time, the clock
  // then passes midnight before the second.
  const ticks = [new Date('2026-12-05T05:59:30Z'), new Date('2026-12-05T06:00:30Z')];
  const run = await runReminders(deps(w), { now: new Date('2026-12-05T05:59:00Z'), execute: true, clock: () => ticks.shift() ?? new Date('2026-12-05T06:01:00Z') });
  assert.deepEqual([run.toSend, run.sent], [2, 1]);
  assert.equal(w.sent.length, 1);
  assert.equal(w.reminders.get('sub2_p1')?.state, 'scheduled', 'not claimed; the next run cancels it as past');
});
