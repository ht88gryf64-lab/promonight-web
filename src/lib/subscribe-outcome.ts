// What /api/subscribe reported, and which success copy that earns.
//
// EXTRACTED FROM FollowForm, unchanged. It lived there because that card was the
// only reader; the engagement capture sheet is the second, and a client
// component importing another client component just to reach one pure function
// would have pulled FollowForm, TeamStarPicker and the whole 169-team picker
// into the bundle of every team page the sheet can fire on.
//
// FollowForm re-exports both names so nothing that imported them from there had
// to change, including the existing test, which keeps exercising this logic
// through the path it always did.

/** What /api/subscribe reports about the confirmation email. */
export type ConfirmationOutcome = 'sent' | 'not_needed' | 'failed';

/**
 * Which success copy to render. A failed send is NOT an error state: the request
 * succeeded and the record exists, so it is a variant of success.
 */
export type SuccessVariant = 'confident' | 'failed' | 'already_subscribed';

/**
 * Pick the success copy from what the API reported.
 *
 * 'not_needed' splits on status, which the response already carries:
 *   pending   a suppressed re-submit. A link was delivered for the token the
 *             record still holds (both suppressors now require that), so it is
 *             live and usable and the confident copy is true.
 *   confirmed nothing was sent and nothing needs to be. Promising a link here
 *             is false in every clause, which is what this split fixes.
 *
 * An unknown or missing value falls back to 'confident', which is exactly
 * today's behavior, so a client running against an older deploy degrades to what
 * it did before rather than to a wrong failure message.
 */
export function successVariant(
  confirmation: ConfirmationOutcome | undefined,
  status: string | undefined,
): SuccessVariant {
  if (confirmation === 'failed') return 'failed';
  if (confirmation === 'not_needed' && status === 'confirmed') return 'already_subscribed';
  return 'confident';
}
