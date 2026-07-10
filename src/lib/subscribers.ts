import 'server-only';
import { createHash, randomBytes } from 'node:crypto';
import { FieldValue, Timestamp } from 'firebase-admin/firestore';
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
  // Approximate location captured from the Vercel edge geo headers at signup
  // (additive; absent on records created before geo capture). Powers the
  // empty-window digest's local section. null when not captured.
  geoCity: string | null;
  geoRegion: string | null;
  geoLat: number | null;
  geoLng: number | null;
}

const SUBSCRIBERS = 'subscribers';
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const TEAM_SLUG_RE = /^[a-z0-9-]+$/;
// Upper bound on stored teams. Past the practical ceiling (every team in a
// couple of leagues) but caps the write payload if a malformed client posts a
// huge array.
const MAX_TEAMS = 200;
// Per-email confirmation resend cooldown. A re-submit for the same pending /
// unsubscribed address within this window reuses the existing (still-valid)
// confirm token and does NOT resend, capping same-address confirmation-email
// bombing and Firestore write churn. This is one layer only: a per-IP / WAF
// rate limit is still required before sending goes live to stop multi-address
// floods (see the email.ts SENDER_FROM gate).
const RESEND_COOLDOWN_MS = 30_000;

function withinResendCooldown(updatedAt: unknown): boolean {
  if (updatedAt instanceof Timestamp) {
    return Date.now() - updatedAt.toMillis() < RESEND_COOLDOWN_MS;
  }
  return false;
}

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

// Approximate location from the Vercel edge geo headers, threaded from the
// subscribe route. All optional; captured only at first signup.
export interface SubscriberGeo {
  geoCity?: string | null;
  geoRegion?: string | null;
  geoLat?: number | null;
  geoLng?: number | null;
}

// Normalize untrusted geo into stored fields, all null when absent/invalid. A
// null-island (0,0) or a non-finite coord is dropped so it can never anchor a
// local section on the equator.
function sanitizeGeo(geo: SubscriberGeo | null | undefined): {
  geoCity: string | null;
  geoRegion: string | null;
  geoLat: number | null;
  geoLng: number | null;
} {
  const city =
    typeof geo?.geoCity === 'string' && geo.geoCity.trim().length > 0
      ? geo.geoCity.trim().slice(0, 120)
      : null;
  const region =
    typeof geo?.geoRegion === 'string' && geo.geoRegion.trim().length > 0
      ? geo.geoRegion.trim().slice(0, 40)
      : null;
  let lat = typeof geo?.geoLat === 'number' && Number.isFinite(geo.geoLat) ? geo.geoLat : null;
  let lng = typeof geo?.geoLng === 'number' && Number.isFinite(geo.geoLng) ? geo.geoLng : null;
  if (lat === 0 && lng === 0) {
    lat = null;
    lng = null;
  }
  return { geoCity: city, geoRegion: region, geoLat: lat, geoLng: lng };
}

export interface UpsertSubscriberInput {
  email: string;
  teams: string[];
  source: CaptureSurface | string;
  // Additive: stored only on a brand-new record (signup), never backfilled onto
  // an existing one.
  geo?: SubscriberGeo | null;
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
        // Captured once, at signup. Existing records are never backfilled.
        ...sanitizeGeo(input.geo),
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

    // pending or unsubscribed → re-arm confirmation, unless we just sent one to
    // this address moments ago. Within the cooldown, reuse the existing (still
    // valid) confirm token and suppress the resend so a rapid re-submit can't be
    // used to bomb the address; outside it, rotate the token and resend.
    const coolingDown =
      withinResendCooldown(data.updatedAt) &&
      typeof data.confirmToken === 'string' &&
      data.confirmToken.length > 0;
    const confirmToken = coolingDown ? (data.confirmToken as string) : newToken();
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
      needsConfirmation: !coolingDown,
      confirmToken,
      manageToken,
    };
  });
}

// ── Read + lifecycle by token (Phase B) ────────────────────────────────────
// confirmToken and manageToken are random base64url strings. Validate the
// shape before hitting Firestore so a malformed token short-circuits to
// not-found instead of issuing a pointless indexed query.
const TOKEN_RE = /^[A-Za-z0-9_-]{16,128}$/;

function tsToIso(v: unknown): string | null {
  if (!v) return null;
  if (v instanceof Timestamp) return v.toDate().toISOString();
  if (typeof v === 'string') return v;
  return null;
}

function mapSubscriberDoc(doc: FirebaseFirestore.DocumentSnapshot): Subscriber {
  const d = doc.data() ?? {};
  const status: SubscriberStatus =
    d.status === 'confirmed' || d.status === 'unsubscribed' ? d.status : 'pending';
  return {
    id: doc.id,
    email: typeof d.email === 'string' ? d.email : '',
    teams: sanitizeTeams(d.teams),
    status,
    source: coerceCaptureSurface(d.source),
    confirmToken: typeof d.confirmToken === 'string' ? d.confirmToken : '',
    manageToken: typeof d.manageToken === 'string' ? d.manageToken : '',
    createdAt: tsToIso(d.createdAt),
    confirmedAt: tsToIso(d.confirmedAt),
    updatedAt: tsToIso(d.updatedAt),
    geoCity: typeof d.geoCity === 'string' ? d.geoCity : null,
    geoRegion: typeof d.geoRegion === 'string' ? d.geoRegion : null,
    geoLat: typeof d.geoLat === 'number' ? d.geoLat : null,
    geoLng: typeof d.geoLng === 'number' ? d.geoLng : null,
  };
}

async function findByToken(
  field: 'manageToken' | 'confirmToken',
  token: string,
): Promise<FirebaseFirestore.QueryDocumentSnapshot | null> {
  if (!TOKEN_RE.test(token)) return null;
  const snap = await db
    .collection(SUBSCRIBERS)
    .where(field, '==', token)
    .limit(1)
    .get();
  return snap.empty ? null : snap.docs[0];
}

export async function getSubscriberByManageToken(token: string): Promise<Subscriber | null> {
  const doc = await findByToken('manageToken', token);
  return doc ? mapSubscriberDoc(doc) : null;
}

export interface ConfirmResult {
  found: boolean;
  alreadyConfirmed: boolean;
  manageToken: string | null;
}

// Flip a subscriber to confirmed via their confirmToken. Idempotent: a second
// click on an already-confirmed record is a no-op success (and leaves the
// original confirmedAt untouched).
export async function confirmSubscriberByToken(token: string): Promise<ConfirmResult> {
  const doc = await findByToken('confirmToken', token);
  if (!doc) return { found: false, alreadyConfirmed: false, manageToken: null };
  const data = doc.data();
  const manageToken = typeof data.manageToken === 'string' ? data.manageToken : null;
  if (data.status === 'confirmed') {
    return { found: true, alreadyConfirmed: true, manageToken };
  }
  await doc.ref.update({
    status: 'confirmed',
    confirmedAt: FieldValue.serverTimestamp(),
    updatedAt: FieldValue.serverTimestamp(),
  });
  return { found: true, alreadyConfirmed: false, manageToken };
}

export interface SetTeamsResult {
  found: boolean;
  teams: string[];
}

// Preferences save. Unlike upsertSubscriber's capture-path MERGE, this SETS the
// teams array to exactly the submitted (sanitized) selection: removals persist,
// and an empty array is allowed and reverts the subscriber to the generic list.
// Status is untouched, so the generic <-> personalized distinction is purely the
// array length, evaluated at send time.
export async function setSubscriberTeamsByManageToken(
  token: string,
  teams: unknown,
): Promise<SetTeamsResult> {
  const doc = await findByToken('manageToken', token);
  if (!doc) return { found: false, teams: [] };
  // Never write team prefs onto an unsubscribed record (the page hides the form,
  // but the POST endpoint is reachable directly / from a stale tab). Treat it as
  // not-found so the route returns 404. Re-subscribing goes through /follow.
  if (doc.data().status === 'unsubscribed') return { found: false, teams: [] };
  const next = sanitizeTeams(teams);
  await doc.ref.update({ teams: next, updatedAt: FieldValue.serverTimestamp() });
  return { found: true, teams: next };
}

// Unsubscribe via manageToken. Idempotent. The weekly send (Phase C) iterates
// confirmed subscribers only, so flipping to unsubscribed removes them from all
// future sends.
export async function unsubscribeByManageToken(token: string): Promise<{ found: boolean }> {
  const doc = await findByToken('manageToken', token);
  if (!doc) return { found: false };
  await doc.ref.update({
    status: 'unsubscribed',
    updatedAt: FieldValue.serverTimestamp(),
  });
  return { found: true };
}

// All confirmed subscribers, for the weekly send. Pending and unsubscribed are
// excluded by the status filter, so the send never reaches them. Single read:
// fine at the free-tier scale (~100/day); add pagination if the list ever grows
// past a few thousand.
export async function getConfirmedSubscribers(): Promise<Subscriber[]> {
  const snap = await db
    .collection(SUBSCRIBERS)
    .where('status', '==', 'confirmed')
    .get();
  return snap.docs.map(mapSubscriberDoc);
}

// ── Send-time inbox dedup ────────────────────────────────────────────────────
// Two DIFFERENT subscriber docs can still deliver to ONE inbox. The doc id is
// sha256(normalizeEmail), so case/whitespace variants already collapse to a
// single doc, but Gmail treats `john.doe+promos@gmail.com` and `johndoe@gmail.com`
// as the same mailbox and those hash differently, so they can persist as two
// docs. The digest send collapses the confirmed set to one record per delivering
// inbox so a duplicate can never produce two emails to the same person.

// Canonical delivery key for an address. Everything is trim+lowercased (via
// normalizeEmail); for gmail.com / googlemail.com ONLY, the local part also has
// any +suffix stripped and all dots removed, and googlemail folds to gmail, so
// every alias of one Gmail mailbox maps to one key. Other providers are left
// exact, since dots and +tags are not universally aliases elsewhere.
export function deliveryInboxKey(email: string): string {
  const e = normalizeEmail(email);
  const at = e.lastIndexOf('@');
  if (at <= 0) return e;
  let local = e.slice(0, at);
  let domain = e.slice(at + 1);
  if (domain === 'googlemail.com') domain = 'gmail.com';
  if (domain === 'gmail.com') {
    const plus = local.indexOf('+');
    if (plus >= 0) local = local.slice(0, plus);
    local = local.replace(/\./g, '');
  }
  return `${local}@${domain}`;
}

// Milliseconds for the recency tie-break; null/unparseable sort oldest.
function updatedAtMillis(sub: Subscriber): number {
  if (!sub.updatedAt) return -Infinity;
  const t = Date.parse(sub.updatedAt);
  return Number.isFinite(t) ? t : -Infinity;
}

// True when `candidate` should win its inbox group over the current `incumbent`.
// Precedence: a record WITH followed teams beats one without (so a personalized
// subscriber is never dropped in favor of an empty duplicate), then the most
// recently updated, then a stable lexicographic id tiebreak so the outcome is
// deterministic regardless of input order.
function preferSubscriber(candidate: Subscriber, incumbent: Subscriber): boolean {
  const cHasTeams = candidate.teams.length > 0 ? 1 : 0;
  const iHasTeams = incumbent.teams.length > 0 ? 1 : 0;
  if (cHasTeams !== iHasTeams) return cHasTeams > iHasTeams;
  const cUpdated = updatedAtMillis(candidate);
  const iUpdated = updatedAtMillis(incumbent);
  if (cUpdated !== iUpdated) return cUpdated > iUpdated;
  return candidate.id < incumbent.id;
}

// Collapse a subscriber set to one record per delivering inbox, applying the
// keep-rule above within each colliding group. First-seen inbox order is
// preserved. Pure and side-effect free: reads no Firestore and writes nothing,
// so it is safe to run on the dry-run path exactly as on the execute path.
export function dedupeByDeliveryInbox(subs: Subscriber[]): Subscriber[] {
  const best = new Map<string, Subscriber>();
  const order: string[] = [];
  for (const sub of subs) {
    const key = deliveryInboxKey(sub.email);
    const incumbent = best.get(key);
    if (!incumbent) {
      best.set(key, sub);
      order.push(key);
    } else if (preferSubscriber(sub, incumbent)) {
      best.set(key, sub);
    }
  }
  return order.map((key) => best.get(key)!);
}

// Atomically claim the weekly send for a window (keyed by its start date) so a
// second execute in the same window is a no-op rather than a duplicate blast.
// Returns true if THIS call won the claim (proceed to send), false if the window
// was already executed. `force` overrides for a deliberate operator re-run. The
// read-before-write transaction avoids the check-then-set race.
export async function claimDigestRun(windowStart: string, force = false): Promise<boolean> {
  const ref = db.collection('digestRuns').doc(windowStart);
  return db.runTransaction(async (tx) => {
    const snap = await tx.get(ref);
    if (snap.exists && snap.data()?.executedAt && !force) return false;
    tx.set(
      ref,
      { executedAt: FieldValue.serverTimestamp(), window: windowStart },
      { merge: true },
    );
    return true;
  });
}
