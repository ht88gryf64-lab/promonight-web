/**
 * One-off test send of the weekly digest to a single address: all three
 * variants (personalized, generic, empty-window), each with and without a
 * hero, six sends (redesign 2026-11-05, docs/digest-redesign).
 *
 *   node scripts/send-test-digest.js you@example.com
 *
 * Standalone and deliberately isolated from the weekly cron:
 *   - It NEVER touches the `subscribers` collection. It does not import
 *     src/lib/subscribers.ts, so it cannot read a real subscriber, cannot
 *     write one, and cannot claim a digest run in `digestRuns`. A post-send
 *     assertion re-checks that nothing pulled that module in transitively.
 *   - It does not change the cron route or its schedule.
 *   - The recipient comes from a REQUIRED CLI arg. There is no default and no
 *     fallback to the real list, so a bare invocation sends nothing.
 *
 * Every message is built by the exact builders the cron uses
 * (buildPersonalizedDigest, buildGenericDigest, buildEmptyWindowDigest) over
 * the live window, so what lands is what subscribers would get. Only the
 * PROMO SET per case is chosen here, from the real window rows, so each case
 * shows what it is named for:
 *   personalized/hero     a team whose window has a tier 1 photo or exactly one promo
 *   personalized/no-hero  a team with two or more promos and no tier 1 photo
 *   generic/hero          the real featured set, a tier 1 row swapped in if it has none
 *   generic/no-hero       the real featured set without its tier 1 rows
 *   empty/hero            a quiet team the cascade resolves to team-proxy with a hero
 *   empty/no-hero         a quiet team on national-fallback (the hero never fires there)
 * The subject is the real one with a "[test: variant, hero]" prefix so the six
 * are told apart in the inbox. TICKETNETWORK_EMAIL_APPROVED is forced off, and
 * the script refuses to send a message carrying any partner domain.
 *
 * DIGEST_TEST_ONLY=empty/hero,generic/no-hero limits the SENDS to those
 * labels; every case is still built and its subject printed. empty/hero
 * prefers a quiet team whose proxy set holds a same-team same-date pair
 * (the collapse case), the Cardinals first.
 *
 * Requires RESEND_API_KEY and FIREBASE_SERVICE_ACCOUNT_KEY in .env.local.
 */

const path = require('path');
const crypto = require('crypto');
const { createRequire } = require('module');

const ROOT = path.join(__dirname, '..');

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

// The ticket gate stays off for a test send whatever .env.local says.
delete process.env.TICKETNETWORK_EMAIL_APPROVED;
// Promo pages are live in Production (PROMO_PAGES_LIVE, 2026-10-30) but the
// flag is absent from .env.local. Without it no promo carries a page slug, so
// every row falls back to its team page with no card, no hero and no "Coming
// up": not what subscribers receive. Mirror Production. Set before any module
// loads, since the mapper reads it per row.
process.env.PROMO_PAGES_LIVE = 'true';

const {
  digestWindow,
  fetchWindowPromos,
  fetchDigestContext,
  personalizedFor,
  genericFeatured,
} = require('../src/lib/digest.ts');
const {
  isSenderConfigured,
  sendEmail,
  buildPersonalizedDigest,
  buildGenericDigest,
  buildEmptyWindowDigest,
} = require('../src/lib/email.ts');
const { pickHero: pickHeroEntries, collapseEntries } = require('../src/lib/digest-email.ts');
// The hero rule runs on collapsed entries (one per team per date).
const pickHero = (promos) => pickHeroEntries(collapseEntries(promos));
const ONLY = (process.env.DIGEST_TEST_ONLY || '').split(',').map((x) => x.trim()).filter(Boolean);
const { getAllTeams, getTeamVenueCoords, getSchemaLocationsForTeams } = require('../src/lib/data.ts');
const { resolveLocalAnchor, buildTeamCityMap } = require('../src/lib/geo/local-promos.ts');
const { teamDisplayName } = require('../src/lib/team-display-name.ts');

const PARTNER_DOMAINS = ['lusg.net', 'evyy.net', 'spothero.com', 'expedia.com'];

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

function byTeam(rows) {
  const m = new Map();
  for (const p of rows) m.set(p.teamId, [...(m.get(p.teamId) ?? []), p]);
  return m;
}

/** The six cases, each chosen from the live window so it shows its name. */
async function planCases(windowPromos, context) {
  const cases = [];
  const teams = byTeam(windowPromos);
  const ids = [...teams.keys()].sort();

  const heroTeam = ids.find((id) => pickHero(personalizedFor(windowPromos, [id]).promos));
  const plainTeam = ids.find((id) => {
    const { promos } = personalizedFor(windowPromos, [id]);
    return promos.length >= 2 && !pickHero(promos);
  });
  for (const [hero, id] of [[true, heroTeam], [false, plainTeam]]) {
    if (!id) { cases.push({ label: `personalized/${hero ? 'hero' : 'no-hero'}`, missing: 'no team in this window fits' }); continue; }
    const { promos, total } = personalizedFor(windowPromos, [id]);
    cases.push({ label: `personalized/${hero ? 'hero' : 'no-hero'}`, note: `seed team ${id}, ${total} promo(s)`, build: (token) => buildPersonalizedDigest({ email: TO, manageToken: token, promos, total, teamIds: [id], context }) });
  }

  const featured = genericFeatured(windowPromos);
  const tier1 = windowPromos.find((p) => p.imageTier === 1 && p.hasPage && p.promoId);
  let heroSet = featured;
  let heroNote = 'the real featured set';
  if (!pickHero(featured) && tier1) {
    heroSet = [...featured.slice(0, -1), tier1].sort((a, b) => a.date.localeCompare(b.date));
    heroNote = `featured set with tier 1 "${tier1.title}" (${tier1.teamId}) swapped in`;
  }
  const plainSet = featured.filter((p) => p.imageTier !== 1);
  cases.push(pickHero(heroSet)
    ? { label: 'generic/hero', note: heroNote, build: (token) => buildGenericDigest({ email: TO, manageToken: token, featured: heroSet, context }) }
    : { label: 'generic/hero', missing: 'no tier 1 promo with a page in this window' });
  cases.push({ label: 'generic/no-hero', note: `featured set without tier 1 rows, ${plainSet.length} promo(s)`, build: (token) => buildGenericDigest({ email: TO, manageToken: token, featured: plainSet, context }) });

  // Empty-window: quiet teams through the real cascade.
  const allTeams = await getAllTeams();
  const coords = await getTeamVenueCoords(allTeams);
  const cityByTeamId = buildTeamCityMap(allTeams, await getSchemaLocationsForTeams(allTeams));
  // Cardinals first (the review case), then alphabetical.
  const quiet = allTeams.filter((t) => !teams.has(t.id)).sort((a, b) => (a.id === 'arizona-cardinals' ? -1 : b.id === 'arizona-cardinals' ? 1 : a.id.localeCompare(b.id)));
  const hasPair = (rows) => collapseEntries(rows).length < rows.length;
  let proxyPick = null;
  let proxyPairPick = null;
  let nationalPick = null;
  for (const t of quiet) {
    const r = resolveLocalAnchor({ followedTeamIds: [t.id], windowPromos, coords, cityByTeamId });
    if (r.level === 'team-proxy' && pickHero(r.localPromos)) {
      if (!proxyPick) proxyPick = { t, r };
      if (!proxyPairPick && hasPair(r.localPromos)) proxyPairPick = { t, r };
    }
    if (!nationalPick && r.level === 'national-fallback') nationalPick = { t, r };
    if (proxyPairPick && nationalPick) break;
  }
  proxyPick = proxyPairPick || proxyPick;
  for (const [hero, pick] of [[true, proxyPick], [false, nationalPick]]) {
    const label = `empty/${hero ? 'hero' : 'no-hero'}`;
    if (!pick) { cases.push({ label, missing: `no quiet team resolves to ${hero ? 'team-proxy with a hero' : 'national-fallback'}` }); continue; }
    const { t, r } = pick;
    const pair = r.level === 'team-proxy' && hasPair(r.localPromos) ? ', has a same-team same-date pair' : '';
    cases.push({ label, note: `quiet team ${t.id}, ${r.level}, ${r.level === 'team-proxy' ? r.localPromos.length : featured.length} promo(s) in ${collapseEntries(r.level === 'team-proxy' ? r.localPromos : featured).length} entr(ies)${pair}`, build: (token) => buildEmptyWindowDigest({ email: TO, manageToken: token, teamIds: [t.id], teamNames: [teamDisplayName(t)], level: r.level, localPromos: r.localPromos, featured, context }) });
  }
  return cases;
}

async function main() {
  if (!isSenderConfigured()) {
    console.error('[send-test-digest] SENDER_FROM is still a placeholder. Nothing was sent.');
    process.exit(1);
  }

  const { start, end } = digestWindow(new Date());
  const windowPromos = await fetchWindowPromos(start, end);
  const context = await fetchDigestContext({ start, end }, windowPromos);
  const cases = await planCases(windowPromos, context);

  assertSubscribersUntouched();

  console.log('[send-test-digest] ---------------- plan ----------------');
  console.log(`[send-test-digest] recipient:      ${TO}`);
  console.log(`[send-test-digest] window:         ${start} to ${end} (7 days, inclusive)`);
  console.log(`[send-test-digest] window promos:  ${windowPromos.length} (${windowPromos.filter((p) => p.promoId).length} with a card, ${windowPromos.filter((p) => p.imageTier === 1).length} tier 1, ${windowPromos.filter((p) => p.venueName).length} with a building)`);
  console.log(`[send-test-digest] upcoming links: ${context.upcoming.length}`);
  for (const c of cases) console.log(`[send-test-digest] ${c.label.padEnd(22)} ${c.missing ? `NOT POSSIBLE: ${c.missing}` : c.note}`);
  console.log('[send-test-digest] ---------------- subjects ----------------');
  const builtByLabel = new Map();
  for (const c of cases) {
    if (c.missing) continue;
    const b = c.build(throwawayManageToken());
    builtByLabel.set(c.label, b);
    console.log(`[send-test-digest] ${c.label.padEnd(22)} "${b.subject}"`);
  }
  // Two shapes no single-team case shows, from the same live window.
  const twoTeams = [...byTeam(windowPromos).keys()].sort().slice(0, 2);
  const two = personalizedFor(windowPromos, twoTeams);
  console.log(`[send-test-digest] ${'personalized/2 teams'.padEnd(22)} "${buildPersonalizedDigest({ email: TO, manageToken: 'x', promos: two.promos, total: two.total, teamIds: twoTeams, context }).subject}" (${twoTeams.join(' + ')})`);
  console.log(`[send-test-digest] ${'no-promo week'.padEnd(22)} "${buildEmptyWindowDigest({ email: TO, manageToken: 'x', teamIds: ['x'], teamNames: [], level: 'national-fallback', localPromos: [], featured: [], context }).subject}" / generic "${buildGenericDigest({ email: TO, manageToken: 'x', featured: [], context }).subject}"`);
  console.log('[send-test-digest] --------------------------------------');

  const results = [];
  for (const c of cases) {
    if (ONLY.length && !ONLY.includes(c.label)) continue;
    if (c.missing) { results.push({ label: c.label, result: { ok: false, error: `not sent: ${c.missing}` } }); continue; }
    const b = builtByLabel.get(c.label);
    const leaked = PARTNER_DOMAINS.filter((d) => b.html.includes(d) || b.text.includes(d));
    if (leaked.length) throw new Error(`${c.label} carries partner domain(s) ${leaked.join(', ')}; refusing to send`);
    const expectHero = c.label.endsWith('/hero');
    if (!!b.hero !== expectHero) throw new Error(`${c.label} rendered ${b.hero ? 'a' : 'no'} hero; the case is mislabelled`);
    const bytes = Buffer.byteLength(b.html, 'utf8');
    console.log(`[send-test-digest] sending ${c.label} (${bytes} bytes HTML, ${Buffer.byteLength(b.text, 'utf8')} bytes text${b.hero ? `, hero "${b.hero.title}"` : ''})`);
    const result = await sendEmail({ to: TO, subject: `[test: ${c.label.replace('/', ', ')}] ${b.subject}`, html: b.html, text: b.text, headers: b.headers });
    results.push({ label: c.label, result, bytes });
  }

  assertSubscribersUntouched();

  const sent = results.filter((r) => r.result.ok).length;
  const failed = results.length - sent;

  console.log('[send-test-digest] ---------------- sent ----------------');
  console.log(`[send-test-digest] to: ${TO}`);
  for (const { label, result } of results) console.log(`[send-test-digest] ${describe(label, result)}`);
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
