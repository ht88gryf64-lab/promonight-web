// The words of the promo page's "Remind me" block (src/lib/promo-remind-copy.ts).
// The success line follows what /api/subscribe ANSWERED, never the mode the
// cached page rendered (Gate 1 ruling 2, 2026-11-26).
//
// Run with: node --import tsx --test <this file>

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { possessive, remindConsent, remindHeading, remindSubline, remindSuccessCopy, type RemindMode, type ReminderAnswer } from '../promo-remind-copy';
import type { SuccessVariant } from '../subscribe-outcome';

test('headings, subline and consent are the brief’s words', () => {
  assert.equal(remindHeading('reminder', 'Winter Beanie', 'Minnesota Wild'), 'Get a reminder for Winter Beanie');
  assert.equal(remindHeading('weekly', 'Winter Beanie', 'Minnesota Wild'), 'Get Minnesota Wild’s next promos');
  assert.equal(remindHeading('weekly', 'Kids Socks', 'Anaheim Ducks'), 'Get Anaheim Ducks’ next promos');
  assert.equal(possessive('Utah Jazz'), 'Utah Jazz’s');
  assert.equal(remindSubline('Minnesota Wild', 'Blackhawks', 'Saturday, Dec 5, 2026'), 'Minnesota Wild vs Blackhawks, Saturday, Dec 5, 2026');
  assert.equal(remindSubline('Minnesota Wild', '', 'Saturday, Dec 5, 2026'), 'Minnesota Wild, Saturday, Dec 5, 2026');
  assert.equal(remindConsent('reminder', 'Minnesota Wild'), 'We’ll email you the day before. You’ll also get the weekly Minnesota Wild promo email; unsubscribe anytime.');
  assert.equal(remindConsent('weekly', 'Minnesota Wild'), 'You’ll get the weekly Minnesota Wild promo email; unsubscribe anytime.');
});

const say = (mode: RemindMode, reminder: ReminderAnswer, outcome: SuccessVariant) => remindSuccessCopy({ mode, reminder, outcome, teamName: 'Minnesota Wild' });

test('a day-before email is promised only when the API scheduled one', () => {
  assert.ok(say('reminder', 'scheduled', 'confident').includes('we’ll email you the day before'));
  assert.ok(say('reminder', 'scheduled', 'already_subscribed').includes('We’ll email you the day before'));
  for (const outcome of ['confident', 'already_subscribed'] as const) {
    for (const reminder of ['too_late', 'none'] as const) {
      for (const mode of ['reminder', 'weekly'] as const) {
        assert.ok(!/day before,|email you the day before/.test(say(mode, reminder, outcome)), `${mode}/${reminder}/${outcome} promises a reminder`);
      }
    }
  }
});

test('too late from a stale page says so, and still confirms the weekly email', () => {
  const s = say('reminder', 'too_late', 'confident');
  assert.equal(s, 'It is too late for a day-before email for this game. Check your inbox for a confirmation link. Once you confirm, you’ll get the weekly Minnesota Wild promo email.');
  // `none` is neutral (Gate 2 ruling 3): a removed promo, a failed write and a
  // subscriber at the reminder cap all read the same, as the plain weekly line.
  assert.equal(say('reminder', 'none', 'confident'), say('weekly', 'none', 'confident'));
  assert.equal(say('reminder', 'none', 'already_subscribed'), say('weekly', 'none', 'already_subscribed'));
  for (const outcome of ['confident', 'already_subscribed'] as const) assert.ok(!/cap|limit|too many|could not|reminder/i.test(say('reminder', 'none', outcome)));
  // The weekly variant never mentions a reminder it did not offer.
  assert.equal(say('weekly', 'none', 'confident'), 'Check your inbox for a confirmation link. Once you confirm, you’ll get the weekly Minnesota Wild promo email.');
});

test('the confirmation link is promised only when one was sent', () => {
  assert.ok(say('reminder', 'scheduled', 'confident').startsWith('Check your inbox for a confirmation link.'));
  assert.ok(!say('reminder', 'scheduled', 'already_subscribed').includes('confirmation link'));
  assert.ok(!say('weekly', 'none', 'already_subscribed').includes('confirmation link'));
  assert.equal(say('reminder', 'scheduled', 'failed'), 'You are signed up, but the confirmation email did not send. Submit your address again to get the link.');
});

test('no em or en dash, no superlative, no count in any line', () => {
  const all: string[] = [];
  for (const mode of ['reminder', 'weekly'] as const) {
    all.push(remindHeading(mode, 'Winter Beanie', 'Minnesota Wild'), remindConsent(mode, 'Minnesota Wild'));
    for (const reminder of ['scheduled', 'too_late', 'none'] as const) for (const outcome of ['confident', 'failed', 'already_subscribed'] as const) all.push(say(mode, reminder, outcome));
  }
  for (const line of all) {
    assert.ok(!/[—–]/.test(line), `dash in: ${line}`);
    assert.ok(!/\b(best|every|all|cheapest|lowest|biggest|never miss|\d+)\b/i.test(line), `superlative, completeness claim or count in: ${line}`);
  }
});
