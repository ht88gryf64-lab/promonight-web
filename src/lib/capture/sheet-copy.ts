// Every string the capture sheet can render, and the rules that pick between
// them.
//
// WHY THE COPY LIVES HERE AND NOT IN THE JSX. Known issue 6: the repo has no
// render-test harness, so anything inside a component is unreachable from the
// suite. FollowForm's answer was to extract the BRANCHING into a pure
// successVariant() and leave the strings inline, which leaves the strings
// untested by design. This sheet has more branches than that card did (context
// splits the prompt, the success body and the confirmation line; two error kinds
// that must not borrow each other's wording), so the strings come with the
// branching. The test can then assert the sentence a state actually produces
// rather than only the label of the state.
//
// DOUBLE OPT-IN. Nothing here may promise the weekly email. The record is
// pending until the confirmation link is clicked, so every success body talks
// about the link and only the link.
//
// SuccessVariant is the vocabulary FollowForm already uses for these three API
// outcomes, read from the module it was extracted into. Matching it is
// deliberate: two surfaces describing the same three outcomes with two sets of
// names would be a second thing to keep in sync.

import type { SuccessVariant } from '@/lib/subscribe-outcome';

/**
 * Mirrors FollowForm's client-side shape check, plus the 254-character cap the
 * server applies in lib/subscribers.isValidEmail. Matching both means a shape
 * the client accepts is a shape the server accepts, so the sheet cannot show
 * "that did not go through" for an address it should have caught itself.
 */
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const EMAIL_MAX_LENGTH = 254;

export function isValidEmailShape(raw: string): boolean {
  const email = raw.trim();
  return email.length <= EMAIL_MAX_LENGTH && EMAIL_RE.test(email);
}

// ── Prompt ──────────────────────────────────────────────────────────────────

export interface PromptCopy {
  heading: string;
  body: string;
}

export const SUBMIT_LABEL = 'Get promos';
export const SUBMITTING_LABEL = 'Sending';

/**
 * Prompt copy. `teamName` is the full display name ("Cleveland Guardians") and
 * is null on aggregators, which have no page-level team. The aggregator variant
 * is not a fallback for a missing name, it is the copy for a page whose promise
 * is breadth rather than one club.
 */
export function promptCopy(teamName: string | null): PromptCopy {
  if (!teamName) {
    return {
      heading: 'Never miss a giveaway',
      body: 'Every bobblehead, jersey night and theme night across the leagues you follow. One email a week.',
    };
  }
  return {
    heading: `Get ${teamName} promos every week`,
    body: 'Bobbleheads, theme nights and giveaways, straight to your inbox. One email a week.',
  };
}

// ── Errors ──────────────────────────────────────────────────────────────────

/**
 * Two kinds, and they must not be confused. Validation means the address never
 * left the browser; network means it did and something after that went wrong.
 * Telling someone to fix their address when the request failed sends them
 * rewriting an address that was fine.
 */
export type CaptureErrorKind = 'validation' | 'network';

export const ERROR_COPY: Record<CaptureErrorKind, string> = {
  validation: 'That address is missing something after the @.',
  network: 'That did not go through. Try again.',
};

export interface SubmitErrorInput {
  email: string;
  /**
   * Whether the POST succeeded. null when no request has been made, which is
   * every pre-request evaluation.
   */
  requestOk: boolean | null;
  /** The `error` field the API returns on a rejection, when there was one. */
  serverError?: string | null;
}

/**
 * The error kind a submit attempt earns, or null when nothing is wrong.
 *
 * The shape check runs first and wins, so an address the browser can already see
 * is malformed never costs a request.
 *
 * `invalid_email` from the server is reported as VALIDATION rather than network,
 * even though it arrived on a failed request. The client and server checks are
 * kept identical above so this should be unreachable, but if they ever drift,
 * "try again" on an address the server will reject every time is an infinite
 * loop with no way out, and naming the address is the only exit.
 */
export function submitErrorKind(input: SubmitErrorInput): CaptureErrorKind | null {
  if (!isValidEmailShape(input.email)) return 'validation';
  if (input.requestOk === false) {
    return input.serverError === 'invalid_email' ? 'validation' : 'network';
  }
  return null;
}

// ── Success ─────────────────────────────────────────────────────────────────

export interface SuccessCopy {
  heading: string;
  body: string;
  /**
   * The line naming what is now in My Teams, or null when nothing was starred
   * (an aggregator submit with no chips tapped).
   */
  starredLine: string | null;
}

/** Names spelled out before the tail becomes a count. */
export const MAX_NAMED_TEAMS = 2;

/**
 * "Guardians", "Guardians and Padres", "Guardians, Padres and 2 more". Short
 * names, no Oxford comma, matching the house voice in the prompt body above.
 *
 * CAPPED AT TWO NAMES, AND THE CAP IS THE POINT. This line is rewritten in
 * place inside a container whose height is pinned, so an unbounded list is the
 * one input that can push it past its budget: four teams named in full is a
 * sentence long enough to need a scrollbar, and a confirmation the visitor has
 * to scroll to finish reading is worse than a confirmation that summarises.
 *
 * The cap also bounds the WIDTH, which naming a third team would not. "and 1
 * more" is shorter than "and Diamondbacks" and shorter than "and Trail
 * Blazers", so spelling out a third name when there are exactly three would
 * reintroduce the variance this exists to remove. One rule for every count,
 * predictable at any team-name length.
 */
export function joinTeamNames(names: readonly string[]): string {
  if (names.length === 0) return '';
  if (names.length === 1) return names[0];
  if (names.length === 2) return `${names[0]} and ${names[1]}`;
  const named = names.slice(0, MAX_NAMED_TEAMS).join(', ');
  return `${named} and ${names.length - MAX_NAMED_TEAMS} more`;
}

export interface SuccessCopyInput {
  variant: SuccessVariant;
  email: string;
  /** Full display name of the page team, null on aggregators. */
  teamName: string | null;
  /**
   * SHORT names of every team now starred by this sheet, page team first, then
   * chips in tap order. Short because this line is rewritten in place inside a
   * container whose height is fixed at the prompt state's height, and three full
   * display names do not fit that budget.
   */
  starredNames: readonly string[];
}

export function successCopy(input: SuccessCopyInput): SuccessCopy {
  const { variant, email, teamName, starredNames } = input;

  const starredLine =
    starredNames.length > 0
      ? `We've added the ${joinTeamNames(starredNames)} to your teams here.`
      : null;

  // A send that did not go out. Same steer as FollowForm's failure card and for
  // the same reason spelled out there: the dominant failure is an abort that can
  // land AFTER the message was accepted, so copy that reads as outright failure
  // pushes the visitor into an immediate retry that rotates the token and kills
  // the link about to arrive. Wait first, resubmit only if nothing comes.
  if (variant === 'failed') {
    return {
      heading: 'Almost in',
      // TIGHTER THAN FollowForm's WORDING, AND IT HAS TO BE. This is the
      // longest of the three bodies, the container height is pinned to what the
      // prompt rendered at, and at full length it pushes the confirmation line
      // below into a scroll on a 390px screen. The steer is what matters and it
      // is preserved exactly: wait first, resubmit only if nothing arrives.
      body: `Your link for ${email} may take a minute. If it does not arrive, submit again.`,
      starredLine,
    };
  }

  // Already confirmed. Nothing was sent and nothing needs to be, so there is no
  // link to point at. The star still happened locally, so the line stays.
  if (variant === 'already_subscribed') {
    return {
      heading: "You're already subscribed",
      body: "We've got your teams saved. Your next promo email is on its way as usual.",
      starredLine,
    };
  }

  // Confident: a link is live and usable, sent on this request or already
  // delivered for the token the record still holds.
  if (!teamName) {
    return {
      heading: 'Almost in',
      body: `Tap the link we sent to ${email}. You can pick your teams from there.`,
      starredLine,
    };
  }
  return {
    heading: 'Almost in',
    body: `Tap the link we sent to ${email} to start getting ${teamName} promos.`,
    starredLine,
  };
}
