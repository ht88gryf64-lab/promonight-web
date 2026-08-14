// Build-time affiliate tracking guard (Gate 2 of the affiliate attribution
// fixes; see audit/affiliate-attribution-audit.md, ranked item 7).
//
// Runs from the npm `prebuild` hook, so it executes before `next build` on
// every Vercel deploy and every local production build. It fails the build,
// loudly, when:
//
//   1. NEXT_PUBLIC_TICKETMASTER_IMPACT_WRAP is absent or empty on a
//      PRODUCTION-target build (VERCEL_ENV === 'production'). Without it,
//      buildTicketmasterUrl silently reverts every Ticketmaster CTA sitewide
//      to a bare unattributed ticketmaster.com URL with no signal anywhere.
//   2. The wrap var is SET but does not match the expected Impact evyy.net
//      /c/ template shape, in ANY environment. The shape check rejects all
//      whitespace anywhere in the value, so a trailing newline from a bad
//      env write fails it too.
//   3. Any hardcoded tracking constant in src/lib/affiliates.ts (TicketNetwork
//      lusg.net prefix, Fanatics 93n6tx.net origin/account/campaign, SpotHero
//      aff_c tracker + aff_id, Expedia camref family) drifts from the blessed
//      values duplicated below. The duplication is the point: an edit must
//      touch both files, in different terms, to ship.
//
// Absence on a NON-production build (preview/dev/local) is a loud warning,
// not a failure: as of 2026-08-14 the wrap var exists only in the Production
// env target (Gate 0 finding 0e), so an unconditional failure would break
// every preview deploy. Once the var is added to the Preview target this
// scope can be tightened to unconditional.
//
// The env value is never printed. Diagnostics name the defect (absent, empty,
// whitespace, wrong host, missing template slot), not the content.

import { existsSync, readFileSync } from 'fs';
import { join } from 'path';
import { AFFILIATE_TRACKING_CONSTANTS } from '../src/lib/affiliates';

// Mirror `next build`'s env loading for the one var this guard shape-checks:
// prebuild runs under bare tsx (which does NOT read .env.local), but the
// subsequent `next build` DOES and would inline whatever .env.local holds.
// Without this fallback a malformed .env.local value sails past the guard
// (the absence branch wins) and still ships in the local build. Real process
// env always wins, matching Next's precedence. One layer of matching quotes
// is stripped the way dotenv parsing does; any interior/trailing whitespace
// survives and fails the shape check.
function envLocalValue(key: string): string | undefined {
  const p = join(__dirname, '..', '.env.local');
  if (!existsSync(p)) return undefined;
  for (const line of readFileSync(p, 'utf8').split('\n')) {
    if (!line.startsWith(`${key}=`)) continue;
    let v = line.slice(key.length + 1).replace(/\r$/, '');
    if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) {
      v = v.slice(1, -1);
    }
    return v;
  }
  return undefined;
}

// ASCII printable, no whitespace of any kind anywhere in the value.
const PRINTABLE_RE = /^[!-~]+$/;

// Expected Impact wrap template shape: the evyy.net /c/ click redirect under
// publisher account 7236189, a query string, and both substitution slots.
// (?=[!-~]+$) rejects whitespace anywhere, including a trailing newline; JS's
// non-multiline $ also refuses to match before a final newline.
const WRAP_RE =
  /^(?=[!-~]+$)(?=.*\{TARGET\})(?=.*\{SHARED_ID\})https:\/\/ticketmaster\.evyy\.net\/c\/7236189\/\d+\/\d+\?.+$/;

// Blessed values for the hardcoded constants. Independent copies, NOT imports
// of the same literal: comparing a value against itself would verify nothing.
const BLESSED: Record<keyof typeof AFFILIATE_TRACKING_CONSTANTS, string> = {
  ticketNetworkPrefix: 'https://ticketnetwork.lusg.net/c/7236189/120057/2322',
  ticketNetworkPropertyId: '8313917',
  fanaticsOrigin: 'https://fanatics.93n6tx.net',
  fanaticsAccount: '7236189',
  fanaticsCampaignId: '9663',
  spotHeroTracker: 'https://tracking.spothero.com/aff_c',
  spotHeroAffId: '2427',
  expediaBase: 'https://www.expedia.com/affiliate',
  expediaCamref: '1011l5KcC9',
  expediaCreativeref: '1100l68075',
  expediaAdref: 'PZPbSQWcB2',
};

const failures: string[] = [];

for (const key of Object.keys(BLESSED) as Array<keyof typeof BLESSED>) {
  const actual = AFFILIATE_TRACKING_CONSTANTS[key];
  if (actual !== BLESSED[key]) {
    failures.push(
      `Hardcoded constant drift: ${key} in src/lib/affiliates.ts no longer matches the ` +
        `blessed value in scripts/verify-affiliate-tracking.ts. If the change is ` +
        `deliberate, update BOTH files in the same commit. ` +
        `expected=${JSON.stringify(BLESSED[key])} actual=${JSON.stringify(actual)}`,
    );
  } else if (!PRINTABLE_RE.test(actual)) {
    failures.push(`Hardcoded constant ${key} contains whitespace or non-printable characters.`);
  }
}

const wrap =
  process.env.NEXT_PUBLIC_TICKETMASTER_IMPACT_WRAP ??
  envLocalValue('NEXT_PUBLIC_TICKETMASTER_IMPACT_WRAP');
const isProductionTarget = process.env.VERCEL_ENV === 'production';

if (wrap === undefined || wrap === '') {
  const message =
    'NEXT_PUBLIC_TICKETMASTER_IMPACT_WRAP is ' +
    (wrap === '' ? 'set but EMPTY' : 'absent') +
    ': every Ticketmaster CTA sitewide will silently revert to a bare, unattributed ' +
    'ticketmaster.com URL (src/lib/affiliates.ts pre-approval fallback).';
  if (isProductionTarget) {
    // The empty-on-production case has a known benign-LOOKING cause that is
    // still a real hazard: `vercel env pull` writes this Encrypted var as an
    // empty string (it does not decrypt; docs/ticketmaster-impact-attribution-
    // conflict.md), so a LOCAL `vercel build --prod` lands here. That failure
    // is by design: a `vercel deploy --prebuilt` from that directory would
    // genuinely ship unattributed links. Real Vercel deploy builds receive the
    // decrypted value and pass.
    const pullNote =
      wrap === ''
        ? ' If this is a local `vercel build --prod` after `vercel env pull`, the empty value is ' +
          'the pull writing the Encrypted var as ""; do NOT weaken this guard, and do not deploy ' +
          'a locally prebuilt output. Vercel-hosted production builds get the real value and pass.'
        : '';
    failures.push(message + ' This is a hard failure on production-target builds.' + pullNote);
  } else {
    console.warn(
      `[verify-affiliate-tracking] WARNING: ${message} This build target ` +
        `(${process.env.VERCEL_ENV ?? 'local'}) tolerates absence for now because the var ` +
        'only exists in the Production env target; add it to Preview/Development and this ' +
        'guard can be tightened to fail everywhere.',
    );
  }
} else if (!WRAP_RE.test(wrap)) {
  // Diagnose without printing the value.
  const diagnostics: string[] = [];
  if (/\s/.test(wrap)) diagnostics.push('contains whitespace (a trailing newline fails the check)');
  if (!wrap.startsWith('https://ticketmaster.evyy.net/c/7236189/')) {
    diagnostics.push('does not start with the Impact evyy.net /c/7236189/ redirect prefix');
  }
  if (!wrap.includes('{TARGET}')) diagnostics.push('is missing the {TARGET} slot');
  if (!wrap.includes('{SHARED_ID}')) diagnostics.push('is missing the {SHARED_ID} slot');
  if (diagnostics.length === 0) diagnostics.push('does not match the expected template shape');
  failures.push(
    'NEXT_PUBLIC_TICKETMASTER_IMPACT_WRAP is set but malformed (value withheld): ' +
      `it ${diagnostics.join('; ')}. Expected shape: ` +
      'https://ticketmaster.evyy.net/c/7236189/<ad>/<campaign>?...{TARGET}...{SHARED_ID}..., ' +
      'no whitespace anywhere. Malformed values fail the build in EVERY environment.',
  );
}

if (failures.length > 0) {
  console.error('[verify-affiliate-tracking] BUILD BLOCKED: affiliate tracking would be broken or unattributed.');
  for (const f of failures) console.error(`  - ${f}`);
  process.exit(1);
}

console.log(
  `[verify-affiliate-tracking] OK: ${Object.keys(BLESSED).length} hardcoded tracking constants match; ` +
    `Ticketmaster wrap ${wrap ? 'present and well-formed' : 'absent (tolerated on this non-production target)'}.`,
);
