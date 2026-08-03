// The manage-token session cookie.
//
// WHY THIS EXISTS. The manage token used to travel as `/preferences?token=...`,
// which put a permanent bearer credential in the browser URL bar. That is not a
// cosmetic problem: PostHog receives it five ways (page_path on every event,
// the same page_path forwarded to GA4, PostHog's own $current_url, $pageleave,
// and rrweb's Meta href, which is what the replay player's URL bar displays),
// and it resolves back to the subscriber's email address. See
// docs/known-issues.md and the audit that produced this branch.
//
// The exchange happens in middleware, NOT in the page, for one specific reason:
// a Server Component cannot set a cookie, and any client-side fix (history
// .replaceState and friends) runs too late. rrweb takes its first DOM snapshot,
// including the href, before application code gets a turn. Middleware runs
// before a single byte of HTML is produced, so the document the browser loads
// has never had the token in its URL.
//
// WHAT THIS DOES NOT DO, and must not be described as doing: it does not touch
// mail transit. The token is still in the body and the List-Unsubscribe header
// of every email we send, so it still passes through mail providers, link
// scanners and forwarded messages. This closes the browser, analytics and replay
// surface only. Closing the rest needs a short-lived mailed credential with
// rotation on use, which is deliberately NOT built here.

/** Cookie carrying the manage token for the life of a preferences visit. */
export const MANAGE_COOKIE = 'pn_manage';

/**
 * Cookie carrying the CONFIRM token between the emailed link and the
 * interstitial that asks a human to press the button.
 *
 * Separate from MANAGE_COOKIE because they are separate credentials with
 * separate powers: the confirm token opts a record in, the manage token reads
 * the address and edits the subscription. subscribers.ts mints them
 * independently so the manage link cannot be derived from the confirm link, and
 * collapsing them into one cookie here would quietly undo that.
 */
export const CONFIRM_COOKIE = 'pn_confirm';

/**
 * Thirty minutes. Long enough to read the page, pick teams and save; short
 * enough that a shared device does not hand the next person a live session. The
 * MAILED token is unchanged and permanent, so this bounds the session and not
 * the credential. Bounding the credential is the next step, not this one.
 */
export const MANAGE_COOKIE_MAX_AGE = 30 * 60;

/**
 * Same shape check `findByToken` applies before it will touch Firestore. Used in
 * middleware so a malformed token never becomes a cookie.
 */
export const MANAGE_TOKEN_RE = /^[A-Za-z0-9_-]{16,128}$/;

/**
 * sameSite 'lax' is doing real work here, not boilerplate. Both token
 * authenticated writes previously had NO CSRF defence of any kind: no token, no
 * Origin or Referer check, and middleware excludes `api/` so nothing covered
 * them. A lax cookie is not sent on a cross-site POST, so moving the credential
 * into this cookie removes the cross-site write path as a side effect.
 *
 * path '/' rather than a narrower scope because two different prefixes need it,
 * `/preferences` and `/api/`, and a cookie carries exactly one path.
 */
export function manageCookieOptions(secure: boolean) {
  return {
    httpOnly: true,
    secure,
    sameSite: 'lax' as const,
    path: '/',
    maxAge: MANAGE_COOKIE_MAX_AGE,
  };
}
