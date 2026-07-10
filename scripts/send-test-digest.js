/**
 * One-off test send of BOTH digest emails to a single address.
 *
 *   node scripts/send-test-digest.js you@example.com
 *
 * Standalone and deliberately isolated from the weekly cron:
 *   - It NEVER touches the `subscribers` collection. It does not import
 *     src/lib/subscribers.ts, so it cannot read a real subscriber, cannot
 *     write one, and cannot claim a digest run in `digestRuns`. A post-send
 *     assertion re-checks that nothing pulled that module in transitively.
 *   - It does not change the cron route or its schedule. The Vercel cron stays
 *     on the dry-run bare path.
 *   - The recipient comes from a REQUIRED CLI arg. There is no default and no
 *     fallback to the real list, so a bare invocation sends nothing.
 *
 * What it does send, to the CLI address only:
 *   1. The PERSONALIZED digest, seeded with teams = ["minnesota-twins"], built
 *      from real getPromosInDateRange data over the live 7-day window.
 *   2. The GENERIC hot-promos digest, built from the same window data.
 * Both go through the exact builders the cron uses (sendPersonalizedDigest and
 * sendGenericDigest), so what lands in the inbox is what subscribers would get.
 *
 * Requires RESEND_API_KEY and FIREBASE_SERVICE_ACCOUNT_KEY in .env.local.
 */

const path = require('path');
const crypto = require('crypto');
const { createRequire } = require('module');

const ROOT = path.join(__dirname, '..');
const SEED_TEAM = 'minnesota-twins';

// ── Recipient: required, no default ─────────────────────────────────────────
// Parsed and validated BEFORE any module loading or Firestore connection, so a
// bad invocation costs nothing and reaches no network.
function resolveRecipient(argv) {
  const arg = argv[2];
  if (!arg || arg.trim() === '') {
    return { error: 'No recipient given. Pass exactly one address: node scripts/send-test-digest.js you@example.com' };
  }
  if (argv.length > 3) {
    return { error: `Expected exactly one recipient, got ${argv.length - 2}. This script sends to one address only.` };
  }
  const to = arg.trim();
  // Reject a comma list outright. Resend would treat "a@x.com,b@y.com" as a
  // single malformed address, but refusing is clearer than relying on that.
  if (to.includes(',') || to.includes(';')) {
    return { error: 'Multiple recipients are not allowed. Pass one address.' };
  }
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(to)) {
    return { error: `"${to}" does not look like an email address.` };
  }
  return { to };
}

const parsed = resolveRecipient(process.argv);
if (parsed.error) {
  console.error(`[send-test-digest] ${parsed.error}`);
  console.error('[send-test-digest] Nothing was sent.');
  process.exit(1);
}
const TO = parsed.to;

// ── Environment + module loading ────────────────────────────────────────────
// .env.local must load before src/lib/firebase.ts is required, because that
// module calls initializeApp() at import time off FIREBASE_SERVICE_ACCOUNT_KEY.
try {
  process.loadEnvFile(path.join(ROOT, '.env.local'));
} catch (e) {
  console.error(`[send-test-digest] Could not load .env.local: ${e.message}`);
  process.exit(1);
}

if (!process.env.RESEND_API_KEY) {
  // sendEmail() no-ops with a warning when the key is absent, which would look
  // like a successful run that sent nothing. Fail loudly instead.
  console.error('[send-test-digest] RESEND_API_KEY is not set. Add it to .env.local. Nothing was sent.');
  process.exit(1);
}
if (!process.env.FIREBASE_SERVICE_ACCOUNT_KEY) {
  console.error('[send-test-digest] FIREBASE_SERVICE_ACCOUNT_KEY is not set. Nothing was sent.');
  process.exit(1);
}

// Same preload the package.json script entries use: neutralize the `server-only`
// guard so these Next server modules can be required from a plain Node process.
require('./stub-server-only.cjs');
// Project-rooted require so tsx resolves through its package exports.
const projectRequire = createRequire(path.join(ROOT, 'package.json'));
projectRequire('tsx/cjs/api').register();

const {
  digestWindow,
  fetchWindowPromos,
  personalizedFor,
  genericFeatured,
  DIGEST_COLLECTIONS,
} = require('../src/lib/digest.ts');
const { isSenderConfigured, sendGenericDigest, sendPersonalizedDigest } = require('../src/lib/email.ts');

// ── Throwaway token ─────────────────────────────────────────────────────────
// Both digest builders take a single manageToken and derive every recipient
// link from it: the visible "manage"/"unsubscribe" footer links (preferencesUrl)
// and the RFC 8058 one-click List-Unsubscribe header (unsubscribeUrl). Handing
// them a random token makes those links and headers RENDER exactly as they do
// in production without reading or writing a subscriber doc. The token resolves
// to no subscriber, so clicking the links will fail: that is intended for a test
// send, and it is the reason this script never has to touch the collection.
function throwawayManageToken() {
  return crypto.randomBytes(24).toString('hex');
}

// Guard: prove that nothing we loaded reached the subscribers module. Cheap, and
// it turns the "does not touch subscribers" claim into something enforced rather
// than merely intended.
function assertSubscribersUntouched() {
  const leaked = Object.keys(require.cache).filter((m) => /[\\/]lib[\\/]subscribers\.ts$/.test(m));
  if (leaked.length > 0) {
    throw new Error(`subscribers module was loaded, which this script must never do: ${leaked.join(', ')}`);
  }
}

function describe(label, result) {
  if (result.skipped) return `${label}: SKIPPED (no RESEND_API_KEY)`;
  if (!result.ok) return `${label}: FAILED (${result.error ?? 'unknown error'})`;
  return `${label}: SENT (resend id ${result.id ?? 'none returned'})`;
}

async function main() {
  if (!isSenderConfigured()) {
    console.error('[send-test-digest] SENDER_FROM is still a placeholder. Nothing was sent.');
    process.exit(1);
  }

  const { start, end } = digestWindow(new Date());
  const windowPromos = await fetchWindowPromos(start, end);

  const { promos, total } = personalizedFor(windowPromos, [SEED_TEAM]);
  const featured = genericFeatured(windowPromos);

  assertSubscribersUntouched();

  console.log('[send-test-digest] ---------------- plan ----------------');
  console.log(`[send-test-digest] recipient:      ${TO}`);
  console.log(`[send-test-digest] window:         ${start} to ${end} (7 days, inclusive)`);
  console.log(`[send-test-digest] window promos:  ${windowPromos.length}`);
  console.log(`[send-test-digest] personalized:   seed team "${SEED_TEAM}", ${total} promo(s), ${promos.length} rendered`);
  console.log(`[send-test-digest] generic:        ${featured.length} featured promo(s), ${DIGEST_COLLECTIONS.length} collection links`);
  if (total === 0) {
    // The cron SKIPS a subscriber whose window is empty rather than sending a
    // hollow email. Surfaced here because the test send does not skip.
    console.warn(`[send-test-digest] WARNING: "${SEED_TEAM}" has no promos in this window. The cron would skip this subscriber; this test will send an empty personalized digest anyway.`);
  }
  console.log('[send-test-digest] --------------------------------------');

  const results = [];

  const personalizedToken = throwawayManageToken();
  console.log(`[send-test-digest] sending personalized digest (throwaway token ${personalizedToken.slice(0, 8)}...)`);
  const personalizedResult = await sendPersonalizedDigest({
    email: TO,
    manageToken: personalizedToken,
    promos,
    total,
  });
  results.push({ label: 'personalized', result: personalizedResult });

  const genericToken = throwawayManageToken();
  console.log(`[send-test-digest] sending generic digest (throwaway token ${genericToken.slice(0, 8)}...)`);
  const genericResult = await sendGenericDigest({
    email: TO,
    manageToken: genericToken,
    featured,
    collections: DIGEST_COLLECTIONS,
  });
  results.push({ label: 'generic', result: genericResult });

  assertSubscribersUntouched();

  const sent = results.filter((r) => r.result.ok).length;
  const failed = results.length - sent;

  console.log('[send-test-digest] ---------------- sent ----------------');
  console.log(`[send-test-digest] to: ${TO}`);
  for (const { label, result } of results) {
    console.log(`[send-test-digest] ${describe(label, result)}`);
  }
  console.log(`[send-test-digest] ${sent} sent, ${failed} failed`);
  console.log('[send-test-digest] subscribers collection: not read, not written');
  console.log('[send-test-digest] --------------------------------------');

  // firebase-admin keeps gRPC handles open, so exit explicitly.
  process.exit(failed === 0 ? 0 : 1);
}

main().catch((e) => {
  console.error('[send-test-digest] fatal:', e instanceof Error ? e.message : e);
  process.exit(1);
});
