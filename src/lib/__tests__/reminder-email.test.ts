// The day-before reminder email (renderPromoReminder, buildPromoReminder).
//
// The digest's rules apply to it (docs/digest-redesign/digest-redesign-spec.md):
// the button goes to the promo page, no partner domain appears while
// TICKETNETWORK_EMAIL_APPROVED is unset, the footer carries the manage and
// unsubscribe links and the postal address, and the send carries the RFC 8058
// one-click headers with the recipient's own manage token.
//
// Regenerate the golden on a deliberate change: UPDATE_REMINDER_GOLDEN=1 npm test
//
// Run with:
//   node --import tsx --experimental-test-module-mocks --test <this file>

import { test, mock } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

mock.module('server-only', { namedExports: {} });

const FIXTURES = join(dirname(fileURLToPath(import.meta.url)), '__fixtures__');
const PARTNER_DOMAINS = ['lusg.net', 'evyy.net', 'spothero.com', 'expedia.com', 'ticketnetwork.com', 'ticketmaster.com', 'stubhub.com', 'fubo.tv', 'ebay.com', 'pxf.io', 'sjv.io'];

const ARGS = {
  idempotencyKey: 'sub1_c7057219198efd77',
  email: 'fan@example.com',
  manageToken: 'seededManageToken0123456789abcde',
  team: { id: 'minnesota-wild', name: 'Minnesota Wild', short: 'Wild', sportSlug: 'nhl', league: 'NHL', ticketNetworkSlug: 'minnesota-wild-tickets' },
  teamName: 'Minnesota Wild',
  promo: {
    promoId: 'c7057219198efd77',
    title: 'Winter Beanie',
    typeLabel: 'Giveaway',
    date: '2026-12-05',
    time: '7:00 PM',
    opponent: 'Blackhawks',
    venueName: null,
    quantity: 'First 5,000 fans',
    href: '/nhl/minnesota-wild/promos/winter-beanie',
    pageSlug: 'winter-beanie',
    updatedAt: '2026-11-20T12:00:00.000Z',
  },
};

const hrefs = (html: string) => [...html.matchAll(/href="([^"]+)"/g)].map((m) => m[1].replace(/&amp;/g, '&'));

test('the reminder email: one promo, "See this game" to the promo page, zero partner domains, footer and headers as the digest', async () => {
  delete process.env.TICKETNETWORK_EMAIL_APPROVED;
  const { buildPromoReminder, SENDER_POSTAL_ADDRESS } = await import('../email');
  const b = buildPromoReminder(ARGS);

  const file = join(FIXTURES, 'reminder-email.html');
  if (process.env.UPDATE_REMINDER_GOLDEN === '1' || !existsSync(file)) {
    writeFileSync(file, b.html);
    if (process.env.UPDATE_REMINDER_GOLDEN !== '1') assert.fail(`wrote missing golden ${file}; review it and re-run`);
  }
  assert.equal(b.html, readFileSync(file, 'utf8'), 'the reminder email drifted from its golden file');

  assert.equal(b.subject, 'Tomorrow: Winter Beanie (Wild)');
  const page = 'https://www.getpromonight.com/nhl/minnesota-wild/promos/winter-beanie?subId1=web_email_reminder_minnesota-wild';
  assert.match(b.html, new RegExp(`<a href="${page.replace(/[.?]/g, '\\$&')}"[^>]*>See this game</a>`));
  assert.ok(b.text.includes(`See this game: ${page}`));

  // ZERO partner domains, in the html and in the text part.
  for (const d of PARTNER_DOMAINS) {
    assert.ok(!b.html.includes(d), `html carries ${d}`);
    assert.ok(!b.text.includes(d), `text carries ${d}`);
  }
  // Every link is the site's own.
  const links = hrefs(b.html);
  assert.ok(links.length >= 4);
  for (const l of links) assert.ok(l.startsWith('https://www.getpromonight.com/'), `off-site link ${l}`);
  // The hero image is the share card, the one the page's og:image uses.
  assert.match(b.html, /<img src="https:\/\/www\.getpromonight\.com\/api\/share-card\/c7057219198efd77\?team=minnesota-wild&amp;v=\d+" width="552" height="290" alt="Winter Beanie, Minnesota Wild, Sat Dec 5"/);
  // The game line, from stored fields only.
  assert.ok(b.html.includes('Sat Dec 5 · vs Blackhawks · 7:00 PM · First 5,000 fans'));

  // The digest's system: table markup, system fonts, the one accent.
  assert.ok(b.html.includes('background:#1D4ED8'), 'the accent on the button');
  assert.ok(!/<(div|section)[^>]*display:\s*flex/.test(b.html) && !b.html.includes('@font-face') && !b.html.includes('<style'));
  assert.ok(b.html.includes("-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif"));
  assert.ok(Buffer.byteLength(b.html) < 102 * 1024, 'under the Gmail clip');

  // CAN-SPAM footer and unsubscribe, as every other email.
  assert.ok(b.html.includes(SENDER_POSTAL_ADDRESS.replace(/&/g, '&amp;')) && b.text.includes(SENDER_POSTAL_ADDRESS));
  const manage = 'https://www.getpromonight.com/preferences?token=seededManageToken0123456789abcde';
  assert.ok(links.includes(manage), 'manage link');
  assert.ok(links.includes(`${manage}&unsub=1`), 'visible unsubscribe link');
  assert.ok(b.text.includes(`Unsubscribe: ${manage}&unsub=1`));
  assert.deepEqual(b.headers, {
    'List-Unsubscribe': '<https://www.getpromonight.com/api/unsubscribe?token=seededManageToken0123456789abcde>',
    'List-Unsubscribe-Post': 'List-Unsubscribe=One-Click',
  });

  // Copy rules: no em or en dash, no superlative, no count of promos.
  const words = `${b.subject}\n${b.text}\n${b.html.replace(/<[^>]+>/g, ' ')}`;
  assert.ok(!/[—–]/.test(words), 'no dash');
  assert.ok(!/\b(best|cheapest|lowest|biggest|hottest|every giveaway|all the)\b/i.test(words), 'no superlative or completeness claim');
});

test('the ticket gate is the digest’s: with TICKETNETWORK_EMAIL_APPROVED the one button is the ticket link, the resale line follows, and the page link stays in the text', async () => {
  process.env.TICKETNETWORK_EMAIL_APPROVED = 'true';
  try {
    const { buildPromoReminder } = await import('../email');
    const b = buildPromoReminder(ARGS);
    const partner = hrefs(b.html).filter((l) => !l.startsWith('https://www.getpromonight.com/'));
    assert.equal(partner.length, 1, 'exactly one partner link');
    assert.ok(partner[0].includes('lusg.net') && partner[0].includes('subId1=web_email_reminder_minnesota-wild') && partner[0].includes('subId3=winter-beanie'));
    assert.match(b.html, />Get Tickets<\/a>/);
    assert.ok(b.html.includes('TicketNetwork is a resale marketplace.'));
    assert.ok(!b.html.includes('See this game'));
    // A club TicketNetwork does not list keeps the page button even with approval.
    const ontario = buildPromoReminder({ ...ARGS, team: { ...ARGS.team, tnHomeUnavailable: true as const } });
    assert.ok(!ontario.html.includes('lusg.net') && ontario.html.includes('See this game'));
  } finally {
    delete process.env.TICKETNETWORK_EMAIL_APPROVED;
  }
});

test('a promo with no opponent, time or quantity renders without empty separators, and titles are escaped', async () => {
  const { buildPromoReminder } = await import('../email');
  const b = buildPromoReminder({ ...ARGS, promo: { ...ARGS.promo, title: 'Kids <Run> & Fun', opponent: '', time: '', quantity: null } });
  assert.ok(b.html.includes('Kids &lt;Run&gt; &amp; Fun') && !b.html.includes('<Run>'));
  assert.ok(b.html.includes('>Sat Dec 5</div>'), 'the game line is the date alone');
  assert.ok(!/· ·|·\s*<\/div>/.test(b.html));
  assert.equal(b.subject, 'Tomorrow: Kids <Run> & Fun (Wild)');
});

test('the send carries the reminder id as Resend’s Idempotency-Key, so a retry after a timeout cannot mail twice; other emails send without one', async () => {
  process.env.RESEND_API_KEY = 'test-key';
  const seen: Array<Record<string, string>> = [];
  const realFetch = globalThis.fetch;
  globalThis.fetch = (async (_url: unknown, init?: { headers?: Record<string, string> }) => {
    seen.push(init?.headers ?? {});
    return new Response(JSON.stringify({ id: 'msg' }), { status: 200 });
  }) as typeof fetch;
  try {
    const { sendPromoReminder, sendConfirmationEmail } = await import('../email');
    await sendPromoReminder(ARGS);
    await sendPromoReminder(ARGS);
    await sendConfirmationEmail({ email: 'fan@example.com', confirmToken: 'c'.repeat(32), manageToken: 'm'.repeat(32) });
    assert.equal(seen[0]['Idempotency-Key'], 'promo-reminder/sub1_c7057219198efd77');
    assert.equal(seen[1]['Idempotency-Key'], seen[0]['Idempotency-Key'], 'the same key on a retry');
    assert.ok(!('Idempotency-Key' in seen[2]), 'the confirmation request is unchanged');
  } finally {
    globalThis.fetch = realFetch;
    delete process.env.RESEND_API_KEY;
  }
});
