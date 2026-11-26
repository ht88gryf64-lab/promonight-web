// Every word of the promo page's "Remind me" block (Gate 1 rulings,
// 2026-11-26), in one pure file so the server-rendered heading, the client
// form and the tests read the same strings.
//
// THE RULES. No counts, no completeness claims, no superlatives, no em
// dashes. The consent line under the button says exactly what the address
// will receive. The success copy is chosen from what /api/subscribe ANSWERED
// (`reminder`, and whether a confirmation email went out), never from the
// mode the cached page rendered.

import type { SuccessVariant } from './subscribe-outcome';

export const REMIND_SURFACE = 'web_promo_page' as const;

/** What the page offers: a day-before reminder plus the weekly email, or the
 *  weekly email only (a played game, or too late for a day-before email). */
export type RemindMode = 'reminder' | 'weekly';

/** POST /api/subscribe's `reminder` field. */
export type ReminderAnswer = 'scheduled' | 'too_late' | 'none';

/** "Minnesota Wild’s", "Anaheim Ducks’". */
export function possessive(name: string): string {
  return /s$/i.test(name.trim()) ? `${name.trim()}’` : `${name.trim()}’s`;
}

export function remindHeading(mode: RemindMode, promoName: string, teamName: string): string {
  return mode === 'reminder' ? `Get a reminder for ${promoName}` : `Get ${possessive(teamName)} next promos`;
}

/** "Minnesota Wild vs Winnipeg Jets, Saturday, December 5, 2026". Reminder
 *  mode only. A promo page is the home team's, so the word is always "vs". */
export function remindSubline(teamName: string, opponent: string, longDate: string): string {
  return `${teamName}${opponent ? ` vs ${opponent}` : ''}, ${longDate}`;
}

export function remindConsent(mode: RemindMode, teamName: string): string {
  return mode === 'reminder'
    ? `We’ll email you the day before. You’ll also get the weekly ${teamName} promo email; unsubscribe anytime.`
    : `You’ll get the weekly ${teamName} promo email; unsubscribe anytime.`;
}

/**
 * The line that replaces the form after a successful submit.
 *
 * `reminder` decides whether a day-before email is promised; `outcome` (from
 * the confirmation email's fate, src/lib/subscribe-outcome.ts) decides whether
 * the reader is told to look for a confirmation link. A reminder the page
 * offered but the server could not schedule is said plainly, so the reader is
 * never left expecting an email that will not come.
 */
export function remindSuccessCopy(input: { mode: RemindMode; reminder: ReminderAnswer; outcome: SuccessVariant; teamName: string }): string {
  const { mode, reminder, outcome, teamName } = input;
  const weekly = `the weekly ${teamName} promo email`;
  const missed =
    mode === 'reminder' && reminder === 'too_late'
      ? 'It is too late for a day-before email for this game. '
      : mode === 'reminder' && reminder === 'none'
        ? 'We could not set a reminder for this game. '
        : '';
  if (outcome === 'failed') {
    return 'You are signed up, but the confirmation email did not send. Submit your address again to get the link.';
  }
  if (outcome === 'already_subscribed') {
    return reminder === 'scheduled'
      ? `You’re set. We’ll email you the day before, and ${teamName} is on your weekly email.`
      : `${missed}You’re already subscribed, and ${teamName} is on your weekly email.`;
  }
  return reminder === 'scheduled'
    ? `Check your inbox for a confirmation link. Once you confirm, we’ll email you the day before, and you’ll get ${weekly}.`
    : `${missed}Check your inbox for a confirmation link. Once you confirm, you’ll get ${weekly}.`;
}
