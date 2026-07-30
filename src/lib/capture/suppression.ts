// Why a prompt was not shown, as one deterministic reason.
//
// Several reasons routinely apply at once: a subscribed visitor on their first
// pageview of a session on /follow matches three. The reason that gets reported
// therefore has to be fixed rather than incidental, or the suppression_reason
// distribution is a chart of evaluation order rather than of user state.
//
// ORDER: DURABILITY FIRST. Checks run from the most durable and user-scoped to
// the most transient, and the FIRST match is reported. So "this person will
// never see this" beats "this person is not eligible yet", which is the more
// truthful attribution and the more useful chart. Putting first_pageview early,
// for instance, would mask already_subscribed on every first pageview and hide
// how much of the audience is already captured.

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
  | 'session_already_shown'
  | 'first_pageview';

/** Evaluation order. Exported so the test can assert it rather than restate it. */
export const SUPPRESSION_ORDER: readonly SuppressionReason[] = [
  'excluded_path',
  'storage_unavailable',
  'already_subscribed',
  'recently_dismissed',
  'session_signup',
  'session_already_shown',
  'first_pageview',
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
  /** Pageviews in this session, including the current one. */
  pageviews: number;
  /**
   * Whether a prompt has been SHOWN this session. Set at shown, never at
   * dismissed: a slow reader who navigates away mid-prompt has still seen it,
   * and must not be shown it again on the next pageview.
   */
  shown: boolean;
  /** Whether a signup was submitted this session. */
  signup: boolean;
}

const EMPTY_SESSION: CaptureSession = { pageviews: 0, shown: false, signup: false };

export function readSession(session: SafeStorage): CaptureSession {
  const raw = session.get(KEY_SESSION);
  if (!raw) return { ...EMPTY_SESSION };
  try {
    const parsed: unknown = JSON.parse(raw);
    if (typeof parsed !== 'object' || parsed === null) return { ...EMPTY_SESSION };
    const p = parsed as Partial<CaptureSession>;
    return {
      pageviews: typeof p.pageviews === 'number' && p.pageviews >= 0 ? p.pageviews : 0,
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

export function recordPageview(session: SafeStorage): CaptureSession {
  const current = readSession(session);
  const next = { ...current, pageviews: current.pageviews + 1 };
  writeSession(session, next);
  return next;
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
  // recordPageview runs before this, so the current pageview is included. One
  // means this is the session's first, and the first is never interrupted.
  if (s.pageviews <= 1) return 'first_pageview';

  return null;
}
