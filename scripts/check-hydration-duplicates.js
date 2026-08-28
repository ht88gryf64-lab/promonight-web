#!/usr/bin/env node
/**
 * Mode 2 check for the useSearchParams bailout (docs/known-issues.md entry 33).
 *
 * WHY THIS EXISTS. The bailout has two failure modes and they need different
 * checks. Mode 1, content missing from served HTML, is caught by counting rows
 * in a curl. Mode 2, content DUPLICATED after hydration, is invisible to that
 * curl because the served HTML is correct: the duplicate only appears once the
 * client re-renders a subtree the server already rendered. It is also invisible
 * to the build and to the type system.
 *
 * That left a manual browser session as the only detection, and a check that
 * depends on a browser session staying alive is a check that gets skipped. So
 * this is scriptable and gating: it exits non-zero on any hidden duplicate.
 *
 * SENSITIVITY, STATED HONESTLY. This script has NOT been shown to reproduce
 * the one historical case. On /team-rankings a real Chrome session reported 105
 * score badges (30 visible plus a hidden copy of 75) and three count lines on
 * the pre-fix deployment; running this script against that same deployment
 * afterwards reported 30 of 30 visible, zero hidden, at every timing tried.
 *
 * Two readings fit, and they cannot be separated without a real browser: either
 * headless does not reproduce that hydration path, or the original reading was
 * an artifact of the extension's evaluation context. Either way this check is
 * cheap and worth gating on, but treat a clean result as weak evidence, not
 * proof, and keep a real browser in the loop for anything load bearing.
 *
 * The fix that prompted it stands on its own terms regardless: a Suspense
 * boundary above a component that already owns one is redundant, and redundant
 * boundaries re-render subtrees for no reason.
 *
 * USAGE
 *   node scripts/check-hydration-duplicates.js <url> [--selector <css>] [--json]
 *     [--allow-zero] [--expect-selector <css>] [--expect-title <substring>]
 *
 *   A zero element count FAILS by default: it is indistinguishable from a clean
 *   pass, and a preview URL missing its _vercel_share token produces exactly
 *   that. Pass --allow-zero only when the surface genuinely has none.
 *
 *   # preview, share token goes in the URL as normal
 *   node scripts/check-hydration-duplicates.js \
 *     "https://<deployment>.vercel.app/team-rankings?_vercel_share=<token>"
 *
 *   # prod
 *   node scripts/check-hydration-duplicates.js https://www.getpromonight.com/best-promos
 *
 * A Vercel share token is consumed on the first navigation and stored as a
 * cookie on the browser context, so it keeps working across the follow-up
 * navigation this script performs to defeat caching.
 *
 * EXIT CODES
 *   0  no hidden duplicates
 *   1  hidden duplicates found, or the page could not be loaded
 *   2  bad invocation
 */

'use strict';

// Puppeteer is not a dependency of this repo. Resolve it wherever it exists
// rather than adding a heavy devDependency for one diagnostic, and fail with
// instructions rather than a stack trace when it is absent.
function loadPuppeteer() {
  const candidates = [
    'puppeteer',
    '/Users/mattkovalik/promonight/promo-pipeline/node_modules/puppeteer',
  ];
  for (const c of candidates) {
    try {
      return require(c);
    } catch {
      /* try the next one */
    }
  }
  console.error(
    'puppeteer not found. Install it here (npm i -D puppeteer) or run this from\n' +
      'a checkout that already has it. Tried: ' +
      candidates.join(', '),
  );
  process.exit(2);
}

/** The repeating element per surface. A page whose repeating unit is not listed
 *  can pass --selector explicitly. */
const SELECTORS = [
  { match: /\/team-rankings/, selector: '[aria-label^="Team promo score"]', countRe: 'teams? ranked' },
  { match: /\/best-promos/, selector: '[aria-label^="Promo score"]', countRe: 'promos? (?:match this filter|ranked from)' },
  { match: /\/teams\b/, selector: 'a[href^="/mlb/"], a[href^="/nfl/"]', countRe: 'teams?' },
];

function parseArgs(argv) {
  const args = { url: null, selector: null, json: false, allowZero: false, expectSelector: null, expectTitle: null };
  for (let i = 0; i < argv.length; i += 1) {
    const a = argv[i];
    if (a === '--selector') args.selector = argv[++i];
    else if (a === '--json') args.json = true;
    // A zero count is a FAILURE by default (see the floor below). Pass this only
    // for a surface that is legitimately expected to have none of the element,
    // e.g. a CFB page below the condensed block's minimum.
    else if (a === '--allow-zero') args.allowZero = true;
    else if (a === '--expect-selector') args.expectSelector = argv[++i];
    else if (a === '--expect-title') args.expectTitle = argv[++i];
    else if (!args.url) args.url = a;
  }
  return args;
}

/** Markers of an auth wall or an error page standing in for the real one. A
 *  Vercel preview without a valid share token serves an SSO page that has a
 *  200-ish shell and none of the app's elements, which is why a bare element
 *  count cannot tell "no duplicates" from "never loaded". */
const NOT_THE_PAGE = [
  /vercel\.com\/sso/i, /\/sso-api/i, /authentication required/i, /log in to vercel/i,
  /sign in to continue/i, /deployment protection/i, /access denied/i, /^\s*401\b/, /^\s*403\b/,
];

/** Throw unless we are actually on the page that was asked for. Checks the HTTP
 *  status, that we were not redirected to a different host or path, and that the
 *  document does not look like an auth or error interstitial. */
async function assertOnExpectedPage(page, requestedUrl, resp, label) {
  if (!resp) throw new Error(`${label}: no HTTP response`);
  const status = resp.status();
  if (status >= 400) throw new Error(`${label}: HTTP ${status} for ${requestedUrl}`);
  const want = new URL(requestedUrl);
  const got = new URL(page.url());
  if (got.host !== want.host) {
    throw new Error(`${label}: redirected off-host, asked for ${want.host}${want.pathname}, landed on ${got.host}${got.pathname}. A preview needs its _vercel_share token.`);
  }
  if (got.pathname.replace(/\/$/, '') !== want.pathname.replace(/\/$/, '')) {
    throw new Error(`${label}: redirected, asked for ${want.pathname}, landed on ${got.pathname}`);
  }
  const probe = await page.evaluate(() => ({
    title: document.title || '',
    head: (document.body ? document.body.innerText : '').slice(0, 400),
    bodyLen: (document.body ? document.body.innerText : '').length,
  }));
  const hay = `${page.url()} ${probe.title} ${probe.head}`;
  const hit = NOT_THE_PAGE.find((re) => re.test(hay));
  if (hit) throw new Error(`${label}: this is not the page, it matches ${hit}. Title: ${JSON.stringify(probe.title)}`);
  if (probe.bodyLen < 200) throw new Error(`${label}: body is ${probe.bodyLen} chars, the page did not render`);
  return probe;
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  if (!args.url) {
    console.error('usage: node scripts/check-hydration-duplicates.js <url> [--selector <css>] [--json] [--allow-zero] [--expect-selector <css>] [--expect-title <s>]');
    process.exit(2);
  }

  const known = SELECTORS.find((s) => s.match.test(args.url));
  const selector = args.selector || (known && known.selector);
  if (!selector) {
    console.error(
      `No known repeating element for ${args.url}. Pass --selector "<css>" for the element that repeats per row or card.`,
    );
    process.exit(2);
  }
  const countRe = (known && known.countRe) || '\\d+\\s';

  const puppeteer = loadPuppeteer();
  const browser = await puppeteer.launch({ headless: 'new', args: ['--no-sandbox'] });
  let failed = false;

  try {
    const page = await browser.newPage();
    // First navigation consumes any share token and sets the auth cookie.
    const resp1 = await page.goto(args.url, { waitUntil: 'networkidle0', timeout: 90000 });
    await assertOnExpectedPage(page, args.url, resp1, 'first navigation');

    // Second navigation with a cache buster, so a cached response cannot mask a
    // regression. The token is a cookie by now, so it can be dropped.
    const bust = new URL(args.url);
    bust.searchParams.delete('_vercel_share');
    bust.searchParams.set('cb', String(Date.now()));
    const resp2 = await page.goto(bust.toString(), { waitUntil: 'networkidle0', timeout: 90000 });
    // The share token was dropped here, so this is also where a preview whose
    // auth cookie did not stick redirects to SSO. Assert again rather than
    // counting elements on a login screen.
    const probe = await assertOnExpectedPage(page, bust.toString(), resp2, 'cache-busted navigation');
    if (args.expectTitle && !probe.title.includes(args.expectTitle)) {
      throw new Error(`expected title to contain ${JSON.stringify(args.expectTitle)}, got ${JSON.stringify(probe.title)}`);
    }
    if (args.expectSelector) {
      const n = await page.evaluate((sel) => document.querySelectorAll(sel).length, args.expectSelector);
      if (n === 0) throw new Error(`expected selector ${JSON.stringify(args.expectSelector)} matched nothing, so this is not the expected page`);
    }

    // Hydration is not an event we can await directly; give the client render a
    // moment to produce the duplicate if it is going to.
    await new Promise((r) => setTimeout(r, 2500));

    const result = await page.evaluate(
      (sel, countSrc) => {
        const re = new RegExp(countSrc);
        const all = Array.from(document.querySelectorAll(sel));
        const visible = all.filter((el) => el.getBoundingClientRect().height > 0);
        const countLines = Array.from(document.querySelectorAll('p'))
          .map((p) => (p.textContent || '').trim())
          .filter((t) => re.test(t));
        return { total: all.length, visible: visible.length, countLines };
      },
      selector,
      countRe,
    );

    const hidden = result.total - result.visible;

    // THE FLOOR. A run that matched nothing has measured nothing, and
    // total=0/visible=0/hidden=0 is byte-identical to a clean pass. Every entry
    // 33 check runs through this script, so a silent zero is a verification
    // hole, not a convenience. Fail unless the caller says zero is expected.
    if (result.total === 0 && !args.allowZero) {
      throw new Error(
        `selector ${JSON.stringify(selector)} matched 0 elements. Either the selector is wrong ` +
          `or the page did not render what was expected. A zero count proves nothing about ` +
          `hydration. Pass --allow-zero only if this surface genuinely has none of this element.`,
      );
    }

    failed = hidden > 0;

    if (args.json) {
      console.log(JSON.stringify({ url: bust.toString(), selector, ...result, hiddenDuplicates: hidden, ok: !failed }, null, 2));
    } else {
      console.log(`url       : ${bust.toString()}`);
      console.log(`selector  : ${selector}`);
      console.log(`total     : ${result.total}`);
      console.log(`visible   : ${result.visible}`);
      console.log(`hidden    : ${hidden}${hidden > 0 ? '   <-- HIDDEN DUPLICATES' : ''}`);
      console.log(`countLines: ${JSON.stringify(result.countLines)}`);
    }

    if (failed) {
      console.error(
        `\nFAIL: ${hidden} element(s) present in the DOM but not visible. That is the ` +
          `hydration double render: a redundant Suspense boundary above a component ` +
          `that already owns one leaves the server copy behind. See known-issues 33.`,
      );
    }
  } catch (err) {
    console.error(`FAIL: could not check ${args.url}: ${err.message}`);
    failed = true;
  } finally {
    await browser.close();
  }

  process.exit(failed ? 1 : 0);
}

main();
