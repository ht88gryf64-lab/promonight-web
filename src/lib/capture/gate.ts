// Kill switch for the engagement capture trigger.
//
// Same shape as src/lib/redesign.ts, and for the same reason: a server reader
// and a client mirror that compute the SAME answer, so a server component and
// the client tree it renders cannot disagree about whether the feature exists.
// A gate read only on the client would render nothing on the server and then
// mount on hydration, which is a hydration divergence; one read only on the
// server could not be consulted by a client component at all.
//
// ON in every non-production environment (preview deploys and local dev) so the
// work is testable without setting anything, and OFF in production until
// NEXT_PUBLIC_CAPTURE_TRIGGER is explicitly 'true'. That flag is the production
// launch switch, flipped in the Vercel dashboard and NOT here. It is
// NEXT_PUBLIC and carries no secret.
//
// OFF means the counter does not mount at all: no subscriber registered, no
// timer running, no storage touched, no events emitted. Not "mounts and stays
// quiet". That is what makes this a kill switch rather than a feature flag.

/**
 * Server-side gate. Reads the server-only `VERCEL_ENV`. Use in Server
 * Components deciding whether to render the trigger.
 */
export function isCaptureTriggerEnabled(): boolean {
  return (
    process.env.VERCEL_ENV !== 'production' ||
    process.env.NEXT_PUBLIC_CAPTURE_TRIGGER === 'true'
  );
}

/**
 * Client-side equivalent. Reads `NEXT_PUBLIC_VERCEL_ENV`, mirrored from
 * `VERCEL_ENV` in next.config.ts, so the client computes the same result as the
 * server. Locally and on previews that value is '' so this returns true,
 * matching the server's `VERCEL_ENV !== 'production'`.
 */
export function isCaptureTriggerEnabledClient(): boolean {
  return (
    process.env.NEXT_PUBLIC_VERCEL_ENV !== 'production' ||
    process.env.NEXT_PUBLIC_CAPTURE_TRIGGER === 'true'
  );
}
