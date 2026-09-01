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
//   4. A route renders an affiliate CTA but no AffiliateDisclosure anywhere in
//      its component tree. This is the FTC half of the same problem the first
//      three checks cover commercially: on 2026-09-01 a served-HTML audit found
//      318 affiliate links, 24% of the site's total, on seven routes carrying no
//      disclosure at all (/promos/today, /best-promos, /best-promos/bobbleheads,
//      /mlb, /mls, /wnba, /promos/bobbleheads). The cause was structural, not an
//      oversight: AffiliateDisclosure was imported per ROUTE while the CTAs
//      arrive inside shared components, so every new route that reused a CTA
//      component started out undisclosed and nothing said so.
//
// Absence on a NON-production build (preview/dev/local) is a loud warning,
// not a failure: as of 2026-08-14 the wrap var exists only in the Production
// env target (Gate 0 finding 0e), so an unconditional failure would break
// every preview deploy. Once the var is added to the Preview target this
// scope can be tightened to unconditional.
//
// The env value is never printed. Diagnostics name the defect (absent, empty,
// whitespace, wrong host, missing template slot), not the content.

import { existsSync, readdirSync, readFileSync, statSync } from 'fs';
import { dirname, join, relative, resolve } from 'path';
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

// ── 4. Disclosure coverage ─────────────────────────────────────────────────
//
// Static import-graph check, no build output and no network needed. For each
// App Router route (its page.tsx plus every ancestor layout.tsx, since a layout
// renders on every route beneath it) we walk the transitive closure of LOCAL
// imports. If that closure reaches an affiliate CTA emitter it must also reach
// AffiliateDisclosure.
//
// The check is deliberately an OVER-approximation: it fires on a route that
// imports a CTA component behind a condition that never becomes true. That is
// the safe direction. A missing disclosure ships undisclosed paid links; a
// spurious one costs an import line or a two-line justification. It cannot see
// through a dynamic import with a computed specifier, so those are reported as
// unresolvable rather than silently passing.

const SRC = resolve(__dirname, '..', 'src');
const APP = join(SRC, 'app');
const DISCLOSURE = join(SRC, 'components', 'affiliates', 'AffiliateDisclosure.tsx');

// Every module under components/affiliates/ is an emitter except the disclosure
// itself, plus the generic tracked link that the CFB and trip surfaces use
// directly. Derived from the directory rather than listed, so a new CTA
// component is covered the day it lands.
const AFFILIATE_DIR = join(SRC, 'components', 'affiliates');
const EMITTERS = new Set<string>([
  ...readdirSync(AFFILIATE_DIR)
    .filter((f) => f.endsWith('.tsx'))
    .map((f) => join(AFFILIATE_DIR, f)),
  join(SRC, 'components', 'tracked-affiliate-link.tsx'),
]);
EMITTERS.delete(DISCLOSURE);

const RESOLVE_EXTS = ['.tsx', '.ts', '/index.tsx', '/index.ts'];

function resolveImport(fromFile: string, spec: string): string | null {
  let base: string;
  if (spec.startsWith('@/')) base = join(SRC, spec.slice(2));
  else if (spec.startsWith('./') || spec.startsWith('../')) base = resolve(dirname(fromFile), spec);
  else return null; // node_modules or a bare specifier: not ours to walk.
  for (const ext of RESOLVE_EXTS) {
    const candidate = base + ext;
    if (existsSync(candidate) && statSync(candidate).isFile()) return candidate;
  }
  return existsSync(base) && statSync(base).isFile() ? base : null;
}

// Static `import ... from 'x'`, side-effect `import 'x'`, `export ... from 'x'`
// and `import('x')` with a literal specifier. A computed specifier has no
// literal to capture and is counted as unresolvable below.
const SPEC_RE = /(?:\bfrom\s*|\bimport\s*\(\s*|\bimport\s+)['"]([^'"]+)['"]/g;
const DYNAMIC_COMPUTED_RE = /\bimport\s*\(\s*[^'")]/;

function closureOf(entries: string[]): { modules: Set<string>; computed: string[] } {
  const seen = new Set<string>();
  const computed: string[] = [];
  const queue = [...entries];
  while (queue.length > 0) {
    const file = queue.pop() as string;
    if (seen.has(file)) continue;
    seen.add(file);
    let source: string;
    try {
      source = readFileSync(file, 'utf8');
    } catch {
      continue;
    }
    if (DYNAMIC_COMPUTED_RE.test(source)) computed.push(relative(SRC, file));
    for (const m of source.matchAll(SPEC_RE)) {
      const target = resolveImport(file, m[1]);
      if (target && !seen.has(target)) queue.push(target);
    }
  }
  return { modules: seen, computed };
}

// src/app/dev/* is excluded: every one of those routes calls notFound() when
// the environment is production (three on NODE_ENV, capture-probe on
// VERCEL_ENV), so they cannot serve an affiliate link to a reader. The
// exclusion is by directory and is the ONLY exemption; if a dev route ever
// stops 404ing in production it needs a disclosure like any other page.
const EXCLUDED_ROUTE_DIRS = [join(APP, 'dev')];

function routeFiles(dir: string, acc: string[] = []): string[] {
  if (EXCLUDED_ROUTE_DIRS.some((d) => resolve(dir) === d || resolve(dir).startsWith(d + '/'))) {
    return acc;
  }
  for (const entry of readdirSync(dir)) {
    const p = join(dir, entry);
    if (statSync(p).isDirectory()) routeFiles(p, acc);
    else if (entry === 'page.tsx') acc.push(p);
  }
  return acc;
}

// The URL path a page.tsx serves, for diagnostics only. Route groups such as
// (marketing) do not appear in the URL.
function routePath(pageFile: string): string {
  const rel = relative(APP, dirname(pageFile));
  const segments = rel === '' ? [] : rel.split(/[\\/]/).filter((s) => !s.startsWith('('));
  return '/' + segments.join('/');
}

// Ancestor layouts render around the page, so they belong in its closure.
function layoutsFor(pageFile: string): string[] {
  const layouts: string[] = [];
  let dir = dirname(pageFile);
  for (;;) {
    const l = join(dir, 'layout.tsx');
    if (existsSync(l)) layouts.push(l);
    if (resolve(dir) === APP) break;
    const parent = dirname(dir);
    if (parent === dir) break;
    dir = parent;
  }
  return layouts;
}

let routesChecked = 0;
let routesWithCtas = 0;
for (const pageFile of routeFiles(APP).sort()) {
  routesChecked += 1;
  const { modules, computed } = closureOf([pageFile, ...layoutsFor(pageFile)]);
  const emitters = [...modules].filter((m) => EMITTERS.has(m));
  if (emitters.length === 0) continue;
  routesWithCtas += 1;
  if (modules.has(DISCLOSURE)) continue;
  const named = emitters.map((m) => relative(SRC, m)).sort().join(', ');
  const computedNote =
    computed.length > 0
      ? ` (note: ${computed.length} module(s) in this route use a computed dynamic import, which this ` +
        `check cannot follow: ${computed.slice(0, 3).join(', ')})`
      : '';
  failures.push(
    `Undisclosed affiliate CTAs on route ${routePath(pageFile)}: its component tree reaches ` +
      `${named} but never AffiliateDisclosure. Render <AffiliateDisclosure /> from the component ` +
      `that emits the CTAs where that component appears at most once per page (HubThisWeek, ` +
      `PastBobbleheadsSection and BestPromosBrowser do this); wire it into the route only when the ` +
      `emitter repeats per row, as ${relative(SRC, join(APP, 'promos', 'today', 'page.tsx'))} does.` +
      computedNote,
  );
}

if (failures.length > 0) {
  console.error('[verify-affiliate-tracking] BUILD BLOCKED: affiliate tracking would be broken or unattributed.');
  for (const f of failures) console.error(`  - ${f}`);
  process.exit(1);
}

console.log(
  `[verify-affiliate-tracking] OK: ${Object.keys(BLESSED).length} hardcoded tracking constants match; ` +
    `Ticketmaster wrap ${wrap ? 'present and well-formed' : 'absent (tolerated on this non-production target)'}; ` +
    `${routesWithCtas} of ${routesChecked} routes render affiliate CTAs and every one reaches AffiliateDisclosure.`,
);
