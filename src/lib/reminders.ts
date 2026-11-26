import 'server-only';
import { FieldValue, Timestamp } from 'firebase-admin/firestore';
import { db } from './firebase';
import { getGamesForTeam, getTeamBySlug } from './data';
import { getVenueHub, getVenueHubForTeam } from './venue-hub';
import { resolvePromoPage } from './promo-pages';
import { cleanText, promoPagePath, quantityLine } from './promo-page-copy';
import { promoDisplayTitle } from './promo-display-title';
import { toDigestTeam } from './digest';
import { teamDisplayName } from './team-display-name';
import { PROMO_TYPE_LABELS, type Team } from './types';
import { siteTodayYmd } from './site-today';
import { ymdInZone } from './promo-date-tile';
import { deliveryInboxKey } from './subscribers';
import { sendPromoReminder, type ConfirmationReminder } from './email';
import {
  isYmd,
  reminderDocId,
  reminderOpen,
  reminderSendAt,
  reminderZone,
  type Reminder,
  type ReminderDeps,
  type ReminderRow,
  type ReminderState,
  type ReminderSubscriber,
} from './reminder-core';

// The Firestore and Resend side of the day-before reminders. The rules are in
// src/lib/reminder-core.ts; this file only reads and writes.
//
// COLLECTION `promoReminders`, one document per subscriber per promo:
//   id            `${subscriberId}_${promoId}`  (subscriberId is the sha256 of
//                 the address, so no email is in the path or on the document)
//   subscriberId, teamId, league, promoId, pageSlug, pageSeason
//   gameDate      YYYY-MM-DD, the promo's own date
//   timeZone      the venue's zone at signup (game, else building, else site)
//   sendAt        Timestamp while scheduled, null once settled
//   state         scheduled | sending | sent | cancelled | superseded
//   series        true when the page held several upcoming dates at signup
//   cancelReason, createdAt, updatedAt, sentAt, resendId
//
// The cron reads by `state == 'scheduled'`, a single-field equality: no
// composite index is needed.

const REMINDERS = 'promoReminders';
const SUBSCRIBERS = 'subscribers';

const str = (v: unknown): string | null => (typeof v === 'string' && v.trim() ? v.trim() : null);

/** The venue's zone for a team's home game on a date: the game's own zone,
 *  else the building's, else the site's (ruling 6). Never throws: a failed
 *  read falls down the chain. */
export async function reminderZoneFor(team: Pick<Team, 'id' | 'sportSlug'>, gameDate: string): Promise<string> {
  try {
    const games = await getGamesForTeam(team.id, team.sportSlug);
    const zone = games.find((g) => g.homeTeamSlug === team.id && g.date === gameDate && g.status !== 'postponed' && g.status !== 'canceled' && g.gameTimeTz && g.gameTimeTz.includes('/'))?.gameTimeTz;
    if (zone) return reminderZone(zone);
  } catch (e) {
    console.warn(`[reminders] games read failed for ${team.id}: ${e instanceof Error ? e.message : e}`);
  }
  try {
    const hub = await getVenueHubForTeam(team.id);
    const building = hub ? await getVenueHub(hub.slug) : null;
    if (building?.timezone) return reminderZone(building.timezone);
  } catch (e) {
    console.warn(`[reminders] venue read failed for ${team.id}: ${e instanceof Error ? e.message : e}`);
  }
  return reminderZone(null);
}

/** The promo's name as its page prints it (src/lib/promo-display-title.ts). */
function shownTitle(title: string, team: Team): string {
  return promoDisplayTitle(cleanText(title), team) || cleanText(title);
}

// ── signup ───────────────────────────────────────────────────────────────────

export type ReminderOutcome = 'scheduled' | 'too_late' | 'none';

export interface ScheduleResult {
  outcome: ReminderOutcome;
  /** Set with `scheduled`: what the confirmation email names. */
  promo?: ConfirmationReminder;
}

/**
 * Schedule the day-before reminder a promo-page signup asked for.
 *
 * Everything is derived on the server from the stored promo: the client sends
 * a team id and a promo id and nothing else. `too_late` when the reminder's
 * moment has passed (a cached page can still offer one, ruling 2); `none`
 * when the promo is unknown, removed or has no usable date.
 *
 * Idempotent: the document id is the subscriber plus the promo, so a second
 * submit finds the first and writes nothing. A reminder cancelled before it
 * was sent (the subscriber unsubscribed, or never confirmed an earlier
 * signup) is put back in line; one that was sent, followed or is being sent
 * is never touched.
 */
export async function scheduleReminderForSignup(input: { subscriberId: string; teamId: string; promoId: string; now: Date }): Promise<ScheduleResult> {
  const team = await getTeamBySlug(input.teamId);
  if (!team) return { outcome: 'none' };
  const snap = await db.collection('teams').doc(team.id).collection('promos').doc(input.promoId).get();
  const data = snap.exists ? snap.data() : undefined;
  const pageSlug = str(data?.pageSlug);
  if (!data || data.tombstoned === true || data.isPostseason === true || !pageSlug) return { outcome: 'none' };

  // The page as the site serves it: the live rows under the slug, display
  // slots filled. The reminder must be for a row the page itself shows.
  const page = await resolvePromoPage(team, pageSlug, siteTodayYmd(input.now));
  const row = page?.state === 'live' ? page.rows.find((r) => r.promoId === input.promoId) : undefined;
  if (!page || !row || !isYmd(row.date)) return { outcome: 'none' };

  const timeZone = await reminderZoneFor(team, row.date);
  if (!reminderOpen(input.now, row.date, timeZone)) return { outcome: 'too_late' };

  const venueToday = ymdInZone(input.now, timeZone);
  const id = reminderDocId(input.subscriberId, input.promoId);
  const ref = db.collection(REMINDERS).doc(id);
  const sendAt = Timestamp.fromDate(reminderSendAt(row.date, timeZone));
  await db.runTransaction(async (tx) => {
    const existing = await tx.get(ref);
    const now = FieldValue.serverTimestamp();
    if (!existing.exists) {
      tx.set(ref, {
        subscriberId: input.subscriberId,
        teamId: team.id,
        league: team.league,
        promoId: input.promoId,
        pageSlug,
        pageSeason: row.pageSeason ?? null,
        gameDate: row.date,
        timeZone,
        sendAt,
        state: 'scheduled' satisfies ReminderState,
        series: page.dates.filter((d) => d >= venueToday).length > 1,
        cancelReason: null,
        createdAt: now,
        updatedAt: now,
        sentAt: null,
        resendId: null,
      });
      return;
    }
    if (existing.data()?.state === 'cancelled') {
      tx.update(ref, { state: 'scheduled' satisfies ReminderState, cancelReason: null, gameDate: row.date, timeZone, sendAt, updatedAt: now });
    }
  });
  return { outcome: 'scheduled', promo: { title: shownTitle(row.title, team), teamName: teamDisplayName(team), date: row.date } };
}

// ── the cron's store ─────────────────────────────────────────────────────────

function toReminder(doc: FirebaseFirestore.QueryDocumentSnapshot | FirebaseFirestore.DocumentSnapshot): Reminder | null {
  const d = doc.data();
  if (!d) return null;
  const subscriberId = str(d.subscriberId);
  const teamId = str(d.teamId);
  const promoId = str(d.promoId);
  const pageSlug = str(d.pageSlug);
  if (!subscriberId || !teamId || !promoId || !pageSlug || !isYmd(d.gameDate)) return null;
  return {
    id: doc.id,
    subscriberId,
    teamId,
    league: str(d.league) ?? '',
    promoId,
    pageSlug,
    pageSeason: str(d.pageSeason),
    gameDate: d.gameDate,
    timeZone: reminderZone(str(d.timeZone)),
    sendAt: d.sendAt instanceof Timestamp ? d.sendAt.toDate().toISOString() : null,
    state: d.state as ReminderState,
    series: d.series === true,
    cancelReason: d.cancelReason ?? null,
  };
}

function toRow(id: string, d: FirebaseFirestore.DocumentData): ReminderRow {
  return {
    promoId: id,
    date: typeof d.date === 'string' ? d.date : '',
    pageSlug: str(d.pageSlug) ?? '',
    pageSeason: str(d.pageSeason),
    // A postseason row is invisible to every regular reader, the page included.
    tombstoned: d.tombstoned === true || d.isPostseason === true,
  };
}

/** Reminder fields as Firestore stores them. */
function toStored(patch: Partial<Reminder> & { sentAt?: 'now'; resendId?: string | null }): Record<string, unknown> {
  const { id: _id, sendAt, sentAt, ...rest } = patch;
  return {
    ...rest,
    ...(sendAt !== undefined ? { sendAt: sendAt === null ? null : Timestamp.fromDate(new Date(sendAt)) } : {}),
    ...(sentAt === 'now' ? { sentAt: FieldValue.serverTimestamp() } : {}),
    updatedAt: FieldValue.serverTimestamp(),
  };
}

/** The run's dependencies over Firestore and Resend. `now` is the run's one
 *  clock read (the email's page is resolved on that day). */
export function firestoreReminderDeps(now: Date): ReminderDeps {
  const teams = new Map<string, Promise<Team | null>>();
  const team = (id: string) => {
    let t = teams.get(id);
    if (!t) {
      t = getTeamBySlug(id);
      teams.set(id, t);
    }
    return t;
  };
  return {
    async listScheduled() {
      const snap = await db.collection(REMINDERS).where('state', '==', 'scheduled').get();
      const out: Reminder[] = [];
      for (const doc of snap.docs) {
        const r = toReminder(doc);
        if (r) out.push(r);
        else console.error(`[reminders] malformed reminder ${doc.id}, skipped`);
      }
      return out;
    },
    async countSending() {
      const snap = await db.collection(REMINDERS).where('state', '==', 'sending').get();
      return snap.size;
    },
    async getRow(teamId, promoId) {
      const doc = await db.collection('teams').doc(teamId).collection('promos').doc(promoId).get();
      const d = doc.exists ? doc.data() : undefined;
      return d ? toRow(doc.id, d) : null;
    },
    async getTeamRows(teamId) {
      const snap = await db.collection('teams').doc(teamId).collection('promos').get();
      return snap.docs.map((d) => toRow(d.id, d.data()));
    },
    async zoneFor(teamId, gameDate) {
      const t = await team(teamId);
      return t ? reminderZoneFor(t, gameDate) : reminderZone(null);
    },
    async getSubscriber(id): Promise<ReminderSubscriber | null> {
      const doc = await db.collection(SUBSCRIBERS).doc(id).get();
      const d = doc.exists ? doc.data() : undefined;
      const email = str(d?.email);
      const manageToken = str(d?.manageToken);
      if (!d || !email || !manageToken) return null;
      return { status: d.status === 'confirmed' || d.status === 'unsubscribed' ? d.status : 'pending', email, manageToken };
    },
    inboxKey: deliveryInboxKey,
    async createIfAbsent(reminder) {
      const ref = db.collection(REMINDERS).doc(reminder.id);
      return db.runTransaction(async (tx) => {
        if ((await tx.get(ref)).exists) return false;
        const { id: _id, ...fields } = reminder;
        tx.set(ref, { ...toStored(fields), createdAt: FieldValue.serverTimestamp(), sentAt: null, resendId: null });
        return true;
      });
    },
    async update(id, patch) {
      await db.collection(REMINDERS).doc(id).update(toStored(patch));
    },
    async claim(id) {
      const ref = db.collection(REMINDERS).doc(id);
      return db.runTransaction(async (tx) => {
        const snap = await tx.get(ref);
        if (!snap.exists || snap.data()?.state !== 'scheduled') return false;
        tx.update(ref, { state: 'sending' satisfies ReminderState, updatedAt: FieldValue.serverTimestamp() });
        return true;
      });
    },
    async send(reminder, subscriber) {
      const t = await team(reminder.teamId);
      if (!t) return 'no_page';
      const page = await resolvePromoPage(t, reminder.pageSlug, siteTodayYmd(now));
      const row = page?.state === 'live' ? page.rows.find((r) => r.promoId === reminder.promoId) : undefined;
      if (!page || !row || !row.title.trim()) return 'no_page';
      return sendPromoReminder({
        email: subscriber.email,
        manageToken: subscriber.manageToken,
        team: toDigestTeam(t),
        teamName: teamDisplayName(t),
        promo: {
          promoId: row.promoId,
          title: shownTitle(row.title, t),
          typeLabel: PROMO_TYPE_LABELS[row.type] ?? 'Promo',
          date: row.date,
          time: row.displayTime,
          opponent: row.displayOpponent,
          // Never the team's default building: a neutral-site game would name
          // the wrong one (the digest's rule). The promo page names it.
          venueName: null,
          quantity: quantityLine(row),
          href: promoPagePath(t.sportSlug, t.id, page.canonicalSlug ?? page.slug),
          pageSlug: page.canonicalSlug ?? page.slug,
          updatedAt: page.updatedAt ?? row.updatedAt,
        },
      });
    },
  };
}
