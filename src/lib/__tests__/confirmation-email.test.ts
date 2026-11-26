// The confirmation email, with and without a reminder (Gate 1 ruling 3,
// 2026-11-26).
//
// WITHOUT a reminder the whole Resend payload (subject, html, text, headers)
// is compared byte for byte against a golden recorded from main before the
// reminder sentence existed, so a signup that carries no reminder sends what
// it always sent. WITH a reminder exactly one sentence is added, naming the
// promo, the team and the date, in the html and in the text part.
//
// Regenerate the golden only on a deliberate copy change:
//   UPDATE_CONFIRMATION_GOLDEN=1 npm test
//
// Run with:
//   node --import tsx --experimental-test-module-mocks --test <this file>

import { test, mock, beforeEach } from 'node:test';
import assert from 'node:assert';
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

mock.module('server-only', { namedExports: {} });

const GOLDEN = join(dirname(fileURLToPath(import.meta.url)), '__fixtures__', 'confirmation-email.json');

type Payload = { from: string; to: string; subject: string; html: string; text: string; headers: Record<string, string> };
let sent: Payload[] = [];

const SUB = {
  email: 'fan@example.com',
  confirmToken: 'seededConfirmToken0123456789abcd',
  manageToken: 'seededManageToken0123456789abcde',
};

beforeEach(() => {
  sent = [];
  process.env.RESEND_API_KEY = 'test-key';
  globalThis.fetch = (async (_url: unknown, init?: { body?: string }) => {
    sent.push(JSON.parse(init?.body ?? '{}') as Payload);
    return new Response(JSON.stringify({ id: 'msg' }), { status: 200 });
  }) as typeof fetch;
});

test('without a reminder the confirmation email is byte-identical to the recorded one', async () => {
  const { sendConfirmationEmail } = await import('../email');
  const res = await sendConfirmationEmail(SUB);
  assert.strictEqual(res.ok, true);
  assert.strictEqual(sent.length, 1);
  const body = `${JSON.stringify(sent[0], null, 2)}\n`;
  if (process.env.UPDATE_CONFIRMATION_GOLDEN === '1' || !existsSync(GOLDEN)) {
    writeFileSync(GOLDEN, body);
    if (process.env.UPDATE_CONFIRMATION_GOLDEN !== '1') assert.fail(`wrote missing golden ${GOLDEN}; review it and re-run`);
  }
  assert.strictEqual(body, readFileSync(GOLDEN, 'utf8'), 'the confirmation email drifted from its golden file');
});

test('with a reminder one sentence names the promo, the team and the date', async () => {
  const { sendConfirmationEmail } = await import('../email');
  await sendConfirmationEmail(SUB);
  await sendConfirmationEmail({ ...SUB, reminder: { title: 'Blaze Orange Hat', teamName: 'Minnesota Wild', date: '2026-12-05' } });
  const [plain, withReminder] = sent;
  const sentence = 'Confirming also sets your reminder for Blaze Orange Hat (Minnesota Wild, Saturday, December 5): we will email you the day before.';
  assert.ok(withReminder.html.includes(sentence), 'the sentence is in the html');
  assert.ok(withReminder.text.includes(sentence), 'the sentence is in the text part');
  assert.strictEqual(withReminder.html.split(sentence).length, 2, 'once in the html');
  assert.strictEqual(withReminder.text.split(sentence).length, 2, 'once in the text part');
  assert.ok(!plain.html.includes('reminder') && !plain.text.includes('reminder'), 'no reminder wording without one');
  // Everything else is the plain email: removing the added block gives it back.
  assert.strictEqual(withReminder.subject, plain.subject);
  assert.deepStrictEqual(withReminder.headers, plain.headers);
  assert.ok(withReminder.html.length > plain.html.length && withReminder.text.length > plain.text.length);
  assert.ok(!/[—–]/.test(withReminder.html + withReminder.text), 'no em or en dash');
});

test('a promo title is escaped in the html sentence', async () => {
  const { sendConfirmationEmail } = await import('../email');
  await sendConfirmationEmail({ ...SUB, reminder: { title: 'Kids <b>Run</b> & Fun', teamName: 'A "B" Team', date: '2026-12-05' } });
  assert.ok(sent[0].html.includes('Kids &lt;b&gt;Run&lt;/b&gt; &amp; Fun (A &quot;B&quot; Team, Saturday, December 5)'));
  assert.ok(sent[0].text.includes('Kids <b>Run</b> & Fun (A "B" Team, Saturday, December 5)'));
});
