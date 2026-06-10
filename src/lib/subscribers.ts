import 'server-only';
import { createHash, randomBytes } from 'node:crypto';
import { FieldValue } from 'firebase-admin/firestore';
import { db } from './firebase';
import { coerceCaptureSurface, type CaptureSurface } from './follow-surface';

// One Firestore record per subscriber, in the `subscribers` collection. An
// empty `teams` array means the generic weekly list; a non-empty array means a
// personalized digest. There is no separate generic-vs-personalized collection:
// the array length is the only branch, evaluated at send time. Saving at least
// one team flips a subscriber from generic to personalized with no move op.

export type SubscriberStatus = 'pending' | 'confirmed' | 'unsubscribed';

export interface Subscriber {
  // sha256(lowercased email), hex. Stable per email so a re-submit upserts the
  // same record instead of duplicating.
  id: string;
  email: string;
  teams: string[];
  status: SubscriberStatus;
  source: CaptureSurface;
  confirmToken: string;
  manageToken: string;
  // ISO strings at the read boundary (Firestore stores Timestamps). null until
  // the relevant lifecycle step lands.
  createdAt: string | null;
  confirmedAt: string | null;
  updatedAt: string | null;
}

const SUBSCRIBERS = 'subscribers';
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const TEAM_SLUG_RE = /^[a-z0-9-]+$/;
// Upper bound on stored teams. Past the practical ceiling (every team in a
// couple of leagues) but caps the write payload if a malformed client posts a
// huge array.
const MAX_TEAMS = 200;

export function normalizeEmail(raw: string): string {
  return raw.trim().toLowerCase();
}

export function isValidEmail(raw: string): boolean {
  const email = normalizeEmail(raw);
  return email.length <= 254 && EMAIL_RE.test(email);
}

// Doc id is the email hash, never the raw email: keeps PII out of the document
// path while staying deterministic so upserts are idempotent.
export function subscriberDocId(email: string): string {
  return createHash('sha256').update(normalizeEmail(email)).digest('hex');
}

function newToken(): string {
  // 24 random bytes → 32-char URL-safe string. Two independent tokens per
  // subscriber so the manage link can't be derived from the confirm link.
  return randomBytes(24).toString('base64url');
}

// Keep only well-formed, deduplicated slugs, order-stable, capped. Empty array
// is a valid input (generic subscriber).
export function sanitizeTeams(teams: unknown): string[] {
  if (!Array.isArray(teams)) return [];
  const seen = new Set<string>();
  const out: string[] = [];
  for (const raw of teams) {
    if (typeof raw !== 'string') continue;
    const slug = raw.trim().toLowerCase();
    if (!TEAM_SLUG_RE.test(slug) || seen.has(slug)) continue;
    seen.add(slug);
    out.push(slug);
    if (out.length >= MAX_TEAMS) break;
  }
  return out;
}

export interface UpsertSubscriberInput {
  email: string;
  teams: string[];
  source: CaptureSurface | string;
}

export interface UpsertSubscriberResult {
  id: string;
  email: string;
  status: SubscriberStatus;
  teams: string[];
  // True when the doc was newly created this call.
  created: boolean;
  // True when a (re)confirmation should be sent: a brand-new pending record, or
  // an existing non-confirmed record we just reset to pending with a fresh
  // token. Already-confirmed subscribers updating their teams return false so a
  // re-submit never un-confirms them or spams a confirmation email (Phase B).
  needsConfirmation: boolean;
  // The token Phase B's confirmation email links to. Always returned so the
  // caller doesn't need a second read.
  confirmToken: string;
  manageToken: string;
}

/**
 * Create or update a subscriber from a capture-form submit.
 *
 * - New email → pending record with fresh tokens.
 * - Existing non-confirmed (pending/unsubscribed) → teams merged, status reset
 *   to pending, confirmToken regenerated (re-trigger confirmation).
 * - Existing confirmed → teams merged in place, still confirmed, no new
 *   confirmation.
 *
 * Teams are MERGED (union), never replaced: the capture form is seeded from
 * entry context (often a single pre-starred team), so replacing would wipe a
 * returning subscriber's other teams. Authoritative replace (including removal,
 * and the generic↔personalized flip via an empty set) is the preferences
 * page's job in Phase B. Runs in a transaction so two first-time submits can't
 * double-create or mint duplicate tokens.
 */
export async function upsertSubscriber(
  input: UpsertSubscriberInput,
): Promise<UpsertSubscriberResult> {
  const email = normalizeEmail(input.email);
  const id = subscriberDocId(email);
  const source = coerceCaptureSurface(input.source);
  const submittedTeams = sanitizeTeams(input.teams);
  const ref = db.collection(SUBSCRIBERS).doc(id);

  return db.runTransaction(async (tx) => {
    const snap = await tx.get(ref);
    const now = FieldValue.serverTimestamp();

    if (!snap.exists) {
      const confirmToken = newToken();
      const manageToken = newToken();
      tx.set(ref, {
        email,
        teams: submittedTeams,
        status: 'pending',
        source,
        confirmToken,
        manageToken,
        createdAt: now,
        confirmedAt: null,
        updatedAt: now,
      });
      return {
        id,
        email,
        status: 'pending',
        teams: submittedTeams,
        created: true,
        needsConfirmation: true,
        confirmToken,
        manageToken,
      };
    }

    const data = snap.data() ?? {};
    const existingTeams = sanitizeTeams(data.teams);
    const mergedTeams = sanitizeTeams([...existingTeams, ...submittedTeams]);
    // Backfill a manageToken for any legacy record that somehow lacks one.
    const manageToken =
      typeof data.manageToken === 'string' && data.manageToken.length > 0
        ? data.manageToken
        : newToken();

    if (data.status === 'confirmed') {
      tx.update(ref, {
        teams: mergedTeams,
        manageToken,
        updatedAt: now,
      });
      return {
        id,
        email,
        status: 'confirmed',
        teams: mergedTeams,
        created: false,
        needsConfirmation: false,
        confirmToken: typeof data.confirmToken === 'string' ? data.confirmToken : newToken(),
        manageToken,
      };
    }

    // pending or unsubscribed → re-arm confirmation.
    const confirmToken = newToken();
    tx.update(ref, {
      teams: mergedTeams,
      status: 'pending',
      source: data.source ?? source,
      confirmToken,
      confirmedAt: null,
      manageToken,
      updatedAt: now,
    });
    return {
      id,
      email,
      status: 'pending',
      teams: mergedTeams,
      created: false,
      needsConfirmation: true,
      confirmToken,
      manageToken,
    };
  });
}
