// Copy selection for the engagement capture sheet.
//
// The repo has no render harness (known issue 6), so the sheet itself is never
// rendered here. Unlike FollowForm, whose strings stay inline in the JSX, this
// sheet's strings live in the pure module under test, so these assertions cover
// the sentence a state actually produces rather than only the label of the
// state. That is the point of the split.
//
// Run with:
//   node --import tsx --experimental-test-module-mocks --test <this file>

import { test } from 'node:test';
import assert from 'node:assert';
import {
  ERROR_COPY,
  isValidEmailShape,
  joinTeamNames,
  promptCopy,
  submitErrorKind,
  successCopy,
} from '../sheet-copy';

// ── Prompt ──────────────────────────────────────────────────────────────────

test('a team page names the team in the heading', () => {
  const copy = promptCopy('Cleveland Guardians');
  assert.strictEqual(copy.heading, 'Get Cleveland Guardians promos every week');
  assert.match(copy.body, /^Bobbleheads, theme nights and giveaways/);
  assert.match(copy.body, /One email a week\.$/);
});

test('an aggregator gets its own copy, not a team page with the name removed', () => {
  const copy = promptCopy(null);
  assert.strictEqual(copy.heading, 'Never miss a giveaway');
  assert.match(copy.body, /across the leagues you follow/);
});

test('no prompt copy promises a day of the week', () => {
  // Double opt-in: the record is pending until the link is clicked, so nothing
  // may promise the Tuesday email.
  for (const copy of [promptCopy('Detroit Tigers'), promptCopy(null)]) {
    assert.doesNotMatch(`${copy.heading} ${copy.body}`, /tuesday/i);
  }
});

// ── Error kind ──────────────────────────────────────────────────────────────

test('a malformed address is a validation error before any request', () => {
  assert.strictEqual(submitErrorKind({ email: 'matt@', requestOk: null }), 'validation');
  assert.strictEqual(submitErrorKind({ email: 'matt', requestOk: null }), 'validation');
  assert.strictEqual(submitErrorKind({ email: 'matt@example', requestOk: null }), 'validation');
  assert.strictEqual(submitErrorKind({ email: '', requestOk: null }), 'validation');
});

test('a failed request on a well-formed address is a network error', () => {
  assert.strictEqual(
    submitErrorKind({ email: 'matt@example.com', requestOk: false }),
    'network',
  );
});

test('a failed request never borrows the validation copy', () => {
  // The whole point of two kinds: telling someone to fix an address that was
  // fine sends them rewriting it forever.
  const kind = submitErrorKind({ email: 'matt@example.com', requestOk: false });
  assert.notStrictEqual(ERROR_COPY[kind!], ERROR_COPY.validation);
  assert.strictEqual(ERROR_COPY[kind!], 'That did not go through. Try again.');
});

test('the shape check wins over a request outcome', () => {
  // A malformed address must never have produced a request at all, so if both
  // inputs are present the address is what to report.
  assert.strictEqual(submitErrorKind({ email: 'nope', requestOk: false }), 'validation');
});

test('a server invalid_email rejection is reported as validation, not network', () => {
  // Unreachable while the two checks agree, and the exit from an infinite retry
  // loop if they ever drift.
  assert.strictEqual(
    submitErrorKind({
      email: 'matt@example.com',
      requestOk: false,
      serverError: 'invalid_email',
    }),
    'validation',
  );
});

test('other server errors stay network errors', () => {
  for (const err of ['rate_limited', 'server_error', 'invalid_json']) {
    assert.strictEqual(
      submitErrorKind({ email: 'matt@example.com', requestOk: false, serverError: err }),
      'network',
    );
  }
});

test('a successful request produces no error', () => {
  assert.strictEqual(submitErrorKind({ email: 'matt@example.com', requestOk: true }), null);
});

test('the shape check mirrors the server length cap', () => {
  const long = `${'a'.repeat(250)}@example.com`;
  assert.ok(long.length > 254);
  assert.strictEqual(isValidEmailShape(long), false);
  assert.strictEqual(isValidEmailShape(' matt@example.com '), true);
});

// ── Team name joining ───────────────────────────────────────────────────────

test('team names join without an Oxford comma', () => {
  assert.strictEqual(joinTeamNames([]), '');
  assert.strictEqual(joinTeamNames(['Guardians']), 'Guardians');
  assert.strictEqual(joinTeamNames(['Guardians', 'Padres']), 'Guardians and Padres');
});

test('the list is capped at two names and then counts', () => {
  // Unbounded is the one input that can push the pinned container past its
  // budget, and a confirmation the visitor has to scroll to finish reading is
  // worse than one that summarises.
  assert.strictEqual(
    joinTeamNames(['Guardians', 'Padres', 'Tigers']),
    'Guardians, Padres and 1 more',
  );
  assert.strictEqual(
    joinTeamNames(['Guardians', 'Padres', 'Tigers', 'White Sox']),
    'Guardians, Padres and 2 more',
  );
});

test('the cap bounds width, which naming a third team would not', () => {
  // "and 1 more" is shorter than the longest nicknames in the league set, so a
  // special case for exactly three would reintroduce the variance the cap
  // exists to remove.
  const capped = joinTeamNames(['Golden Knights', 'Timberwolves', 'Diamondbacks']);
  assert.strictEqual(capped, 'Golden Knights, Timberwolves and 1 more');
  assert.ok(capped.length < 'Golden Knights, Timberwolves and Diamondbacks'.length);
});

test('the longest possible list stays bounded', () => {
  // Four teams is the ceiling: the page team plus the three-chip cap.
  const worst = joinTeamNames(['Trail Blazers', 'Golden Knights', 'Timberwolves', 'Diamondbacks']);
  assert.strictEqual(worst, 'Trail Blazers, Golden Knights and 2 more');
});

// ── Success ─────────────────────────────────────────────────────────────────

const BASE = {
  email: 'matt@example.com',
  teamName: 'Cleveland Guardians',
  starredNames: ['Guardians'],
} as const;

test('the confident team-page success points at the link and names the team', () => {
  const copy = successCopy({ ...BASE, variant: 'confident' });
  assert.strictEqual(copy.heading, 'Almost in');
  assert.strictEqual(
    copy.body,
    'Tap the link we just sent you to start getting Cleveland Guardians promos.',
  );
  assert.strictEqual(copy.starredLine, "We've added the Guardians to your teams here.");
});

test('the confident aggregator success sends them to the link to pick teams', () => {
  const copy = successCopy({
    variant: 'confident',
    email: 'matt@example.com',
    teamName: null,
    starredNames: [],
  });
  assert.strictEqual(
    copy.body,
    'Tap the link we just sent you. You can pick your teams from there.',
  );
  assert.strictEqual(copy.starredLine, null);
});

test('the confident bodies never echo the address', () => {
  // An address is an unbreakable token of unbounded length, so it alone decides
  // the line count, and it decides differently at every width. It is also the
  // only PII this card could put into a session recording. Both problems go away
  // by not printing it, rather than by masking it.
  for (const teamName of ['Cleveland Guardians', 'Portland Trail Blazers', null]) {
    const copy = successCopy({ ...BASE, variant: 'confident', teamName });
    assert.doesNotMatch(copy.body, /@/);
    assert.doesNotMatch(copy.body, /matt/);
  }
});

test('the failed body still names the address, deliberately', () => {
  // The exception, and the reason ph-no-capture stays on the body element: on a
  // failed send the address is the thing most likely to be wrong.
  assert.match(successCopy({ ...BASE, variant: 'failed' }).body, /matt@example\.com/);
});

test('a failed send does not render the confident copy', () => {
  const failed = successCopy({ ...BASE, variant: 'failed' });
  const confident = successCopy({ ...BASE, variant: 'confident' });
  assert.notStrictEqual(failed.body, confident.body);
  assert.match(failed.body, /may take a minute/);
  // Steers to wait, then resubmit. An immediate retry rotates the token and
  // kills a link that may already be in flight. Shorter than FollowForm's
  // wording because this container's height is pinned, but the steer, and its
  // order, are what the assertion is for.
  assert.match(failed.body, /submit again/);
  assert.ok(
    failed.body.indexOf('minute') < failed.body.indexOf('submit again'),
    'wait must come before retry',
  );
  // The longest of the three bodies still has to fit the pinned height.
  assert.ok(failed.body.length <= 100, `failed body too long: ${failed.body.length}`);
});

test('an already-confirmed resubmit promises no link at all', () => {
  const copy = successCopy({ ...BASE, variant: 'already_subscribed' });
  assert.strictEqual(copy.heading, "You're already subscribed");
  assert.doesNotMatch(copy.body, /link/i);
  // The local star still happened, so the line stays.
  assert.strictEqual(copy.starredLine, "We've added the Guardians to your teams here.");
});

test('no success copy promises the weekly email has been turned on', () => {
  // Double opt-in. Until the link is clicked the record is pending, so no
  // variant may say the emails have started.
  for (const variant of ['confident', 'failed', 'already_subscribed'] as const) {
    const copy = successCopy({ ...BASE, variant });
    assert.doesNotMatch(copy.body, /tuesday/i);
  }
});

test('the confirmation line rewrites as chips are tapped', () => {
  const one = successCopy({ ...BASE, variant: 'confident', starredNames: ['Guardians'] });
  const three = successCopy({
    ...BASE,
    variant: 'confident',
    starredNames: ['Guardians', 'Padres', 'Tigers'],
  });
  assert.strictEqual(one.starredLine, "We've added the Guardians to your teams here.");
  assert.strictEqual(
    three.starredLine,
    "We've added the Guardians, Padres and 1 more to your teams here.",
  );
  // Only the line changes. The heading and body are untouched, so the rewrite
  // cannot move anything above it.
  assert.strictEqual(one.heading, three.heading);
  assert.strictEqual(one.body, three.body);
});

test('an aggregator submit with chips tapped still names them', () => {
  const copy = successCopy({
    variant: 'confident',
    email: 'matt@example.com',
    teamName: null,
    starredNames: ['Tigers', 'Twins'],
  });
  assert.strictEqual(copy.starredLine, "We've added the Tigers and Twins to your teams here.");
});

test('no user-facing string carries an em dash', () => {
  const strings = [
    promptCopy('Cleveland Guardians'),
    promptCopy(null),
  ].flatMap((c) => [c.heading, c.body]);
  for (const variant of ['confident', 'failed', 'already_subscribed'] as const) {
    const copy = successCopy({ ...BASE, variant, starredNames: ['Guardians', 'Tigers'] });
    strings.push(copy.heading, copy.body, copy.starredLine ?? '');
  }
  strings.push(...Object.values(ERROR_COPY));
  for (const s of strings) assert.doesNotMatch(s, /—/);
});
