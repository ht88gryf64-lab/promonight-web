// Day-before promo reminders: the rules, with no Firestore, no clock and no
// env (Gate 1 rulings, 2026-11-26). The page, POST /api/subscribe and the
// hourly cron all decide through this file, so "is a reminder still possible"
// has one answer everywhere.
//
// THE MOMENT. A reminder goes out at 10:00 in the venue's zone on the calendar
// day before the game (ruling 6). The zone is the game's, else the building's,
// else the site's (America/New_York). A fixed hour, never "game time minus a
// day": many rows carry no game time.
//
// TOO LATE (ruling 2). From that moment on, a day-before email can no longer
// be promised: the page renders the weekly email only variant and the API
// answers `too_late`.
//
// PROMO IDENTITY. A promo's document id is a hash of team, date and title
// (promo-pipeline lib/scanner/promo-identity.js), so a rescheduled game is a
// tombstone plus a NEW document. What stays put is the page: team, pageSlug
// and pageSeason. `reconcile` follows a single-date page to its new row and
// cancels when the page is a series and the match would be a guess (ruling 4).

import { SITE_TIME_ZONE, addDaysYmd } from './site-today';
import { zoneOffsetAt } from './promo-page-time';
import { ymdInZone } from './promo-date-tile';

/** 10:00, venue local, the day before the game. */
export const REMINDER_SEND_HOUR = 10;
/** Most reminders one subscriber may have queued at a time (Gate 2 ruling 3):
 *  bounds what a third party who knows a confirmed address can queue for it. */
export const REMINDER_CAP_PER_SUBSCRIBER = 10;
/** Most reminder emails one cron run may send (the run aborts above it). */
export const REMINDER_RUN_CEILING = 500;

const YMD = /^\d{4}-\d{2}-\d{2}$/;

export function isYmd(v: unknown): v is string {
  return typeof v === 'string' && YMD.test(v);
}

/** A zone the runtime knows, else the site's. */
export function reminderZone(timeZone: string | null | undefined): string {
  if (timeZone && timeZone.includes('/') && zoneOffsetAt(timeZone, new Date(0)) !== null) return timeZone;
  return SITE_TIME_ZONE;
}

function offsetMinutes(tz: string, at: number): number {
  const m = /^([+-])(\d{2}):(\d{2})$/.exec(zoneOffsetAt(tz, new Date(at)) ?? '');
  if (!m) return 0;
  return (m[1] === '-' ? -1 : 1) * (Number(m[2]) * 60 + Number(m[3]));
}

/** The instant a wall clock in `timeZone` reads `hour`:00 on `ymd`. Two
 *  passes over the offset, so a day on which the clocks change still lands on
 *  the right side of the change. */
export function zonedInstant(ymd: string, hour: number, timeZone: string | null | undefined): Date {
  const tz = reminderZone(timeZone);
  const [y, m, d] = ymd.split('-').map(Number);
  const wall = Date.UTC(y, m - 1, d, hour);
  const first = wall - offsetMinutes(tz, wall) * 60_000;
  return new Date(wall - offsetMinutes(tz, first) * 60_000);
}

/** When the reminder for a game on `gameDate` goes out. */
export function reminderSendAt(gameDate: string, timeZone: string | null | undefined): Date {
  return zonedInstant(addDaysYmd(gameDate, -1), REMINDER_SEND_HOUR, timeZone);
}

/** Midnight opening the game's own day in the venue's zone: nothing is ever
 *  sent from here on. */
export function gameDayStart(gameDate: string, timeZone: string | null | undefined): Date {
  return zonedInstant(gameDate, 0, timeZone);
}

/** True while a day-before email can still be promised for this game. */
export function reminderOpen(now: Date, gameDate: string, timeZone: string | null | undefined): boolean {
  return isYmd(gameDate) && now.getTime() < reminderSendAt(gameDate, timeZone).getTime();
}

// ── the record ───────────────────────────────────────────────────────────────

export type ReminderState = 'scheduled' | 'sending' | 'sent' | 'cancelled' | 'superseded';

export type ReminderCancelReason =
  /** The promo was removed from the team's schedule and nothing replaced it. */
  | 'tombstoned'
  /** The row is gone and the page holds several dates: following would guess. */
  | 'ambiguous_series'
  /** Never confirmed by the start of game day. */
  | 'unconfirmed'
  | 'unsubscribed'
  | 'subscriber_missing'
  /** Confirmed, but the day before passed without a send (a run outage). */
  | 'expired'
  /** A second subscriber record that delivers to the same inbox. */
  | 'duplicate_inbox'
  /** The promo no longer has a page an email could link to. */
  | 'no_page';

export interface Reminder {
  /** `${subscriberId}_${promoId}`: one per subscriber per promo, ever. */
  id: string;
  subscriberId: string;
  teamId: string;
  league: string;
  promoId: string;
  pageSlug: string;
  pageSeason: string | null;
  /** YYYY-MM-DD, the game's calendar day as stored on the promo. */
  gameDate: string;
  timeZone: string;
  /** ISO instant while scheduled; null once the reminder is settled. */
  sendAt: string | null;
  state: ReminderState;
  /** True when the page held more than one upcoming date at signup. */
  series: boolean;
  cancelReason?: ReminderCancelReason | null;
}

export function reminderDocId(subscriberId: string, promoId: string): string {
  return `${subscriberId}_${promoId}`;
}

/** A promo document as the reminder rules read it. */
export interface ReminderRow {
  promoId: string;
  date: string;
  pageSlug: string;
  pageSeason: string | null;
  tombstoned: boolean;
}

export type Reconciled =
  | { action: 'keep' }
  /** Same document, another date (a hand edit: the id is date-derived). */
  | { action: 'move'; gameDate: string }
  /** The row was replaced: carry the reminder to the page's one live row. */
  | { action: 'follow'; row: ReminderRow }
  | { action: 'cancel'; reason: ReminderCancelReason };

/** What a scheduled reminder should become, given its promo's row today and
 *  the team's other rows. `teamRows` is read only when the own row is gone.
 *  `venueToday` is the calendar day in the reminder's zone. */
export function reconcile(reminder: Pick<Reminder, 'promoId' | 'pageSlug' | 'pageSeason' | 'gameDate' | 'series'>, own: ReminderRow | null, teamRows: readonly ReminderRow[], venueToday: string): Reconciled {
  if (own && !own.tombstoned && isYmd(own.date)) {
    return own.date === reminder.gameDate ? { action: 'keep' } : { action: 'move', gameDate: own.date };
  }
  const live = teamRows.filter(
    (r) => r.promoId !== reminder.promoId && !r.tombstoned && isYmd(r.date) && r.date >= venueToday && r.pageSlug === reminder.pageSlug && (r.pageSeason ?? null) === (reminder.pageSeason ?? null),
  );
  if (live.length === 0) return { action: 'cancel', reason: 'tombstoned' };
  if (reminder.series || live.length > 1) return { action: 'cancel', reason: 'ambiguous_series' };
  return { action: 'follow', row: live[0] };
}

export type DueStage = 'wait' | 'due' | 'past';

/** Before 10:00 the day before: wait. From then until the game's day begins:
 *  due. After that: past, and nothing is sent. */
export function dueStage(now: Date, gameDate: string, timeZone: string): DueStage {
  const t = now.getTime();
  if (t >= gameDayStart(gameDate, timeZone).getTime()) return 'past';
  return t >= reminderSendAt(gameDate, timeZone).getTime() ? 'due' : 'wait';
}

// ── the run ──────────────────────────────────────────────────────────────────

export interface ReminderSubscriber {
  status: 'pending' | 'confirmed' | 'unsubscribed';
  email: string;
  manageToken: string;
}

export interface ReminderSendResult {
  ok: boolean;
  id?: string;
  error?: string;
  skipped?: boolean;
}

/** Everything the run touches, so the rules run against memory in tests and
 *  against Firestore and Resend in the route (src/lib/reminders.ts). */
export interface ReminderDeps {
  listScheduled(): Promise<Reminder[]>;
  /** Reminders claimed by an earlier run that never settled. */
  countSending(): Promise<number>;
  getRow(teamId: string, promoId: string): Promise<ReminderRow | null>;
  getTeamRows(teamId: string): Promise<ReminderRow[]>;
  zoneFor(teamId: string, gameDate: string): Promise<string>;
  getSubscriber(id: string): Promise<ReminderSubscriber | null>;
  /** One key per delivering inbox (subscribers.ts deliveryInboxKey). */
  inboxKey(email: string): string;
  /** Creates the reminder unless its id exists. True when it was created. */
  createIfAbsent(reminder: Reminder): Promise<boolean>;
  update(id: string, patch: Partial<Reminder> & { sentAt?: 'now'; resendId?: string | null }): Promise<void>;
  /** scheduled -> sending, atomically. False when another run holds it. */
  claim(id: string): Promise<boolean>;
  /** Builds and sends the email. `no_page` when the promo cannot be linked;
   *  `held` when the game is postponed or canceled on the schedule (nothing
   *  is sent and the reminder stays in line for its new date). A retry of
   *  the same reminder must be safe to repeat (the adapter sends with an
   *  idempotency key), because a timeout cannot tell "sent" from "not".
   *
   *  `already_sent` is Resend refusing the idempotency key because the body
   *  differs from the one it accepted under that key: an email for this
   *  reminder went out earlier and this attempt would have been a second,
   *  different one. The reminder is marked sent (its Resend id is unknown)
   *  and never retried (Gate 2 ruling 2). */
  send(reminder: Reminder, subscriber: ReminderSubscriber): Promise<ReminderSendResult | 'no_page' | 'held' | 'already_sent'>;
}

export interface ReminderRunSummary {
  mode: 'execute' | 'dry-run';
  scheduled: number;
  /** Past 10:00 the day before and not yet game day, before any filtering. */
  due: number;
  /** Emails this run sends (execute) or would send (dry run). */
  toSend: number;
  sent: number;
  failed: number;
  /** Due, but the game is postponed or canceled on the schedule. */
  held: number;
  /** Marked sent because Resend reported the key used with another body. */
  alreadySent: number;
  /** Reminders whose reconcile threw: skipped this run, the rest went on. */
  errored: number;
  moved: number;
  followed: number;
  /** Due, but the subscriber has not confirmed yet: retried next hour. */
  waitingUnconfirmed: number;
  cancelled: Partial<Record<ReminderCancelReason, number>>;
  stuckSending: number;
  ceiling: number;
  withinCeiling: boolean;
  /** Set when an execute run stopped before sending. */
  aborted?: 'exceeds_send_ceiling';
}

/**
 * One pass over every scheduled reminder: reconcile each against its promo,
 * then send what is due.
 *
 * A dry run reads and writes nothing; its counts are what an execute run at
 * the same instant would do. An execute run writes the reconciliation as it
 * goes (a moved date, a followed row, a cancel are each simply true) and
 * sends only after the ceiling check, each send claimed first so a second run
 * can never send the same reminder.
 */
export async function runReminders(deps: ReminderDeps, opts: { now: Date; execute: boolean; overCap?: boolean; ceiling?: number; clock?: () => Date }): Promise<ReminderRunSummary> {
  const { now, execute } = opts;
  // The instant each send is re-checked against. The route passes the wall
  // clock; without one the run's own `now` stands (tests, dry runs).
  const clock = opts.clock ?? (() => now);
  const ceiling = opts.ceiling ?? REMINDER_RUN_CEILING;
  const scheduled = await deps.listScheduled();
  const summary: ReminderRunSummary = {
    mode: execute ? 'execute' : 'dry-run',
    scheduled: scheduled.length,
    due: 0,
    toSend: 0,
    sent: 0,
    failed: 0,
    held: 0,
    alreadySent: 0,
    errored: 0,
    moved: 0,
    followed: 0,
    waitingUnconfirmed: 0,
    cancelled: {},
    stuckSending: await deps.countSending(),
    ceiling,
    withinCeiling: true,
  };

  const cancel = async (r: Reminder, reason: ReminderCancelReason) => {
    summary.cancelled[reason] = (summary.cancelled[reason] ?? 0) + 1;
    if (execute) await deps.update(r.id, { state: 'cancelled', cancelReason: reason, sendAt: null });
  };

  const teamRowsCache = new Map<string, ReminderRow[]>();
  const teamRows = async (teamId: string) => {
    let rows = teamRowsCache.get(teamId);
    if (!rows) {
      rows = await deps.getTeamRows(teamId);
      teamRowsCache.set(teamId, rows);
    }
    return rows;
  };
  const venueDay = (tz: string) => ymdInZone(now, reminderZone(tz));

  const sends: { reminder: Reminder; subscriber: ReminderSubscriber }[] = [];
  const inboxes = new Set<string>();

  // Each reminder is isolated: one document that cannot be read or written
  // is counted and skipped, and every other reminder still goes out.
  const consider = async (original: Reminder): Promise<void> => {
    let r = original;
    const own = await deps.getRow(r.teamId, r.promoId);
    const needsTeam = !(own && !own.tombstoned && isYmd(own.date));
    const rec = reconcile(r, own, needsTeam ? await teamRows(r.teamId) : [], venueDay(r.timeZone));

    if (rec.action === 'cancel') {
      await cancel(r, rec.reason);
      return;
    }
    if (rec.action === 'move') {
      const timeZone = await deps.zoneFor(r.teamId, rec.gameDate);
      r = { ...r, gameDate: rec.gameDate, timeZone, sendAt: reminderSendAt(rec.gameDate, timeZone).toISOString() };
      summary.moved += 1;
      if (execute) await deps.update(r.id, { gameDate: r.gameDate, timeZone: r.timeZone, sendAt: r.sendAt });
    }
    if (rec.action === 'follow') {
      const timeZone = await deps.zoneFor(r.teamId, rec.row.date);
      const next: Reminder = {
        ...r,
        id: reminderDocId(r.subscriberId, rec.row.promoId),
        promoId: rec.row.promoId,
        gameDate: rec.row.date,
        timeZone,
        sendAt: reminderSendAt(rec.row.date, timeZone).toISOString(),
        state: 'scheduled',
        cancelReason: null,
      };
      summary.followed += 1;
      if (execute) {
        const created = await deps.createIfAbsent(next);
        await deps.update(r.id, { state: 'superseded', sendAt: null });
        // The new id already exists (the subscriber signed up again on the
        // rescheduled page): that record is handled on its own, here or in a
        // later run, and whatever state it is in stands.
        if (!created) return;
      }
      r = next;
    }

    const stage = dueStage(now, r.gameDate, r.timeZone);
    if (stage === 'wait') return;
    summary.due += 1;

    const subscriber = await deps.getSubscriber(r.subscriberId);
    if (!subscriber) {
      await cancel(r, 'subscriber_missing');
      return;
    }
    if (subscriber.status === 'unsubscribed') {
      await cancel(r, 'unsubscribed');
      return;
    }
    if (stage === 'past') {
      await cancel(r, subscriber.status === 'pending' ? 'unconfirmed' : 'expired');
      return;
    }
    if (subscriber.status !== 'confirmed') {
      // Not confirmed yet. Left scheduled: a confirm later today still gets
      // the email on the next hourly run, until game day starts.
      summary.waitingUnconfirmed += 1;
      return;
    }
    const inbox = `${deps.inboxKey(subscriber.email)}|${r.promoId}`;
    if (inboxes.has(inbox)) {
      await cancel(r, 'duplicate_inbox');
      return;
    }
    inboxes.add(inbox);
    sends.push({ reminder: r, subscriber });
  };
  for (const original of scheduled) {
    try {
      await consider(original);
    } catch (e) {
      summary.errored += 1;
      console.error(`[reminders] reconcile threw reminder=${original.id}: ${e instanceof Error ? e.message : e}`);
    }
  }

  summary.toSend = sends.length;
  summary.withinCeiling = sends.length <= ceiling;
  if (!execute) return summary;
  if (!summary.withinCeiling && !opts.overCap) {
    summary.aborted = 'exceeds_send_ceiling';
    return summary;
  }

  // Sequential, each isolated: one bad row fails alone.
  for (const { reminder, subscriber } of sends) {
    // True once Resend accepted the email. A failure after that point must
    // never put the reminder back in line: a record stuck in `sending` is
    // reported (stuckSending), a second email to the same person is not
    // recoverable.
    let delivered = false;
    let claimed = false;
    try {
      // Re-checked at the moment of sending: a long run that began on the day
      // before must not mail once game day has started.
      if (dueStage(clock(), reminder.gameDate, reminder.timeZone) !== 'due') continue;
      claimed = await deps.claim(reminder.id);
      if (!claimed) continue;
      const res = await deps.send(reminder, subscriber);
      if (res === 'held') {
        summary.held += 1;
        await deps.update(reminder.id, { state: 'scheduled' });
      } else if (res === 'already_sent') {
        delivered = true;
        summary.alreadySent += 1;
        await deps.update(reminder.id, { state: 'sent', sendAt: null, sentAt: 'now', resendId: null });
      } else if (res === 'no_page') {
        summary.cancelled.no_page = (summary.cancelled.no_page ?? 0) + 1;
        await deps.update(reminder.id, { state: 'cancelled', cancelReason: 'no_page', sendAt: null });
      } else if (res.ok) {
        delivered = true;
        summary.sent += 1;
        await deps.update(reminder.id, { state: 'sent', sendAt: null, sentAt: 'now', resendId: res.id ?? null });
      } else {
        // Not delivered: back to scheduled, so the next hourly run retries
        // while it is still the day before.
        summary.failed += 1;
        await deps.update(reminder.id, { state: 'scheduled' });
      }
    } catch (e) {
      if (!delivered) summary.failed += 1;
      console.error(`[reminders] send threw reminder=${reminder.id} delivered=${delivered}: ${e instanceof Error ? e.message : e}`);
      if (claimed && !delivered) {
        try {
          await deps.update(reminder.id, { state: 'scheduled' });
        } catch {
          /* left in `sending`; the next run reports it */
        }
      }
    }
  }
  return summary;
}
