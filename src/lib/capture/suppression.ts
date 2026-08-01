// Why a prompt was not shown, as one deterministic reason.
//
// Several reasons routinely apply at once: a subscribed visitor who was already
// shown a prompt this session, on /follow, matches three. The reason that gets
// reported therefore has to be fixed rather than incidental, or the
// suppression_reason distribution is a chart of evaluation order rather than of
// user state.
//
// ORDER: DURABILITY FIRST. Checks run from the most durable and user-scoped to
// the most transient, and the FIRST match is reported. So "this person will
// never see this" beats "this person is not eligible right now", which is the
// more truthful attribution and the more useful chart. Putting
// session_already_shown before already_subscribed, for instance, would mask how
// much of the audience is already captured behind a per-session accident.

import {
  KEY_DISMISSED_AT,
  KEY_SESSION,
  KEY_SUBSCRIBED,
  type SafeStorage,
} from './storage';

export type SuppressionReason =
  | 'excluded_path'
  | 'storage_unavailable'
  | 'already_subscribed'
  | 'recently_dismissed'
  | 'session_signup'
  | 'session_already_shown';

/** Evaluation order. Exported so the test can assert it rather than restate it. */
export const SUPPRESSION_ORDER: readonly SuppressionReason[] = [
  'excluded_path',
  'storage_unavailable',
  'already_subscribed',
  'recently_dismissed',
  'session_signup',
  'session_already_shown',
];

export const DISMISSAL_WINDOW_MS = 30 * 24 * 60 * 60 * 1000;

// Routes where a capture prompt is either redundant or actively wrong. /follow
// and /preferences are the capture funnel itself; the rest are utility and
// legal pages where interrupting someone is indefensible.
export const EXCLUDED_PATHS: readonly string[] = [
  '/follow',
  '/preferences',
  '/download',
  '/privacy',
  '/terms',
  '/about',
];

export function isExcludedPath(pathname: string): boolean {
  // Prefix match so /preferences?token=... and any future subpath are covered,
  // while /aboutface or /downloads-guide are not.
  return EXCLUDED_PATHS.some((p) => pathname === p || pathname.startsWith(`${p}/`));
}

// ── Session state ───────────────────────────────────────────────────────────

export interface CaptureSession {
  /**
   * Whether a prompt has been SHOWN this session. Set at shown, never at
   * dismissed: a slow reader who navigates away mid-prompt has still seen it,
   * and must not be shown it again on the next pageview.
   */
  shown: boolean;
  /** Whether a signup was submitted this session. */
  signup: boolean;
}

const EMPTY_SESSION: CaptureSession = { shown: false, signup: false };

export function readSession(session: SafeStorage): CaptureSession {
  const raw = session.get(KEY_SESSION);
  if (!raw) return { ...EMPTY_SESSION };
  try {
    const parsed: unknown = JSON.parse(raw);
    if (typeof parsed !== 'object' || parsed === null) return { ...EMPTY_SESSION };
    const p = parsed as Partial<CaptureSession>;
    // Unknown keys are ignored rather than rejected, so a session written by the
    // pre-retune build (which carried a `pageviews` counter) still reads as a
    // valid session for the visitors who were mid-session at deploy time.
    return {
      shown: p.shown === true,
      signup: p.signup === true,
    };
  } catch {
    // Malformed, so treat the session as new rather than trusting a fragment.
    return { ...EMPTY_SESSION };
  }
}

export function writeSession(session: SafeStorage, next: CaptureSession): void {
  session.set(KEY_SESSION, JSON.stringify(next));
}

export function markShown(session: SafeStorage): void {
  writeSession(session, { ...readSession(session), shown: true });
}

export function markSignup(session: SafeStorage): void {
  writeSession(session, { ...readSession(session), signup: true });
}

// ── Individual checks ───────────────────────────────────────────────────────

export function isSubscribedLocally(local: SafeStorage): boolean {
  const v = local.get(KEY_SUBSCRIBED);
  return typeof v === 'string' && v.length > 0;
}

export function isRecentlyDismissed(local: SafeStorage, now: number): boolean {
  const raw = local.get(KEY_DISMISSED_AT);
  if (!raw) return false;
  const ts = Number.parseInt(raw, 10);
  // Unparseable is treated as NOT dismissed. The value is only ever written by
  // us as Date.now(), so corruption is remote, and permanently silencing a
  // visitor because of one bad byte is a worse failure than one extra prompt.
  if (!Number.isFinite(ts)) return false;
  // A future timestamp, from clock skew or a changed system clock, still
  // suppresses: now - ts is negative, which is inside the window. Erring toward
  // respecting a dismissal is the right direction.
  return now - ts < DISMISSAL_WINDOW_MS;
}

// ── The decision ────────────────────────────────────────────────────────────

export interface SuppressionInput {
  pathname: string;
  local: SafeStorage;
  session: SafeStorage;
  now: number;
}

/**
 * The reason a prompt must not be shown, or null when nothing suppresses it.
 * Null does NOT mean show: the caller still needs a crossed threshold and the
 * engaged-time floor. This answers only "is this visitor eligible".
 */
export function evaluateSuppression(input: SuppressionInput): SuppressionReason | null {
  const { pathname, local, session, now } = input;

  if (isExcludedPath(pathname)) return 'excluded_path';

  // Second, and before anything that reads a flag, because every check below
  // depends on storage telling the truth. Without it we cannot know whether the
  // visitor already dismissed or already subscribed, and showing a prompt to
  // someone who told us not to is worse than showing nothing.
  if (!local.available || !session.available) return 'storage_unavailable';

  if (isSubscribedLocally(local)) return 'already_subscribed';
  if (isRecentlyDismissed(local, now)) return 'recently_dismissed';

  const s = readSession(session);
  if (s.signup) return 'session_signup';
  if (s.shown) return 'session_already_shown';

  // REMOVED HERE: `first_pageview`, which suppressed anyone still on the first
  // pageview of their session, along with the per-session pageview counter that
  // existed only to feed it.
  //
  // WHY, from the first 19 hours of Phase 1 telemetry (2026-07-30 17:22:13Z
  // onward): 253 sessions, 352 pageviews, 1.39 pageviews per session. 29
  // evaluations met the gesture threshold and the engaged-time floor. 2 were
  // shown, 27 were suppressed, and ALL 27 were first_pageview. Zero came from
  // any other reason. That is a 0.8% fire rate against a 30-45% target, and one
  // of the 27 had been on the page for 816 seconds.
  //
  // Those are the internal-traffic-filtered figures, which is the view the
  // decision was made on. Re-querying that window in raw SQL gives 260 sessions,
  // 365 pageviews, 30 evaluations and 28 suppressions instead, because
  // execute-sql does not apply the project's test-account filter. Same
  // conclusion either way; the small gap is our own browsing, not a discrepancy.
  //
  // The rule was a proxy for "do not be load-adjacent", and at 1.39 pageviews
  // per session it is a proxy that eliminates 93% of everyone who qualifies. The
  // 45-second engaged-time floor plus the multi-gesture threshold measure the
  // same thing directly and far better: somebody who has spent 45 visible
  // seconds and made four deliberate taps is definitionally not experiencing a
  // load-triggered popup. The proxy was redundant with the real guard, so the
  // real guard is what remains.
  //
  // Nothing else read the pageview counter, so recordPageview() and the
  // CaptureSession.pageviews field went with it. `shown` and `signup` are now
  // the only session state, and the session key is written only when one of
  // those actually happens.

  return null;
}
