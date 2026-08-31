#!/usr/bin/env node
/**
 * Post-hydration visible-element check for the held-venue gate, on two pages.
 *
 * WHY. The served-HTML checks in verify-held-venue-claims.mjs prove what the
 * server sent. They cannot prove the page still stands up after the client
 * re-renders it. The change in this branch removes two cards and collapses a
 * grid column on held buildings, and the failure mode that would matter is a
 * gate that silences more than it should: an empty page, or a verified page
 * whose CTAs are in the markup but not actually visible.
 *
 * So the assertion is a NON-ZERO FLOOR on visible elements plus a handful of
 * targeted visible-text checks, on one held building and one verified one.
 *
 * SENSITIVITY, STATED HONESTLY. "Visible" here is
 * getBoundingClientRect().width > 0 && height > 0 with a non-none computed
 * display. That cannot distinguish a legitimately collapsed element from a
 * broken one, and it will not catch a subtle layout regression. It catches the
 * blunt failures: a blank page, a wiped subtree, a CTA that renders to zero
 * size. Treat a pass as evidence the gate did not overreach, not as a visual
 * review. Same caveat class as scripts/check-hydration-duplicates.js.
 *
 * The floor of 25 is deliberately not fitted to an observation: the shared
 * header and footer alone clear it on every page on the site, so the floor
 * fires only when something structural is gone.
 *
 * Usage: node audit/verify-held-venue-hydration.mjs <origin> [vercelShareToken]
 *
 * The project runs SSO deployment protection on everything except custom
 * domains. Unlike the fetch-based sibling script, Chrome keeps cookies, so the
 * share token is consumed by ONE warm-up navigation and the measured
 * navigations carry no token in their URL. Omit it against production.
 */
import puppeteer from 'puppeteer-core';

const ORIGIN = process.argv[2];
const SHARE = process.argv[3] ?? '';
if (!ORIGIN) {
  console.error('usage: node audit/verify-held-venue-hydration.mjs <origin> [vercelShareToken]');
  process.exit(2);
}

const CHROME = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const FLOOR = 25;

const CASES = [
  {
    slug: 'michigan-stadium',
    kind: 'held',
    mustBeVisible: ['still confirming gameday details', 'Know this building'],
    mustBeAbsent: ['Tickets &', 'Shop Fan Gear', 'Reserve Parking'],
  },
  {
    slug: 'american-family-field',
    kind: 'verified',
    mustBeVisible: ['Tickets &', 'Shop Fan Gear', 'Plan your visit'],
    mustBeAbsent: ['still confirming gameday details'],
  },
];

let failures = 0;
const check = (ok, label, detail) => {
  if (!ok) failures += 1;
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${label}${detail ? `\n        ${detail}` : ''}`);
};

const browser = await puppeteer.launch({
  headless: 'new',
  executablePath: CHROME,
  args: ['--no-sandbox'],
});

try {
  if (SHARE) {
    // One navigation to trade the share token for an auth cookie, so the
    // measured pages below are fetched exactly as a real visitor would.
    const warm = await browser.newPage();
    await warm.goto(`${ORIGIN}/?_vercel_share=${SHARE}`, { waitUntil: 'domcontentloaded', timeout: 90000 });
    await warm.close();
    console.log('share token consumed; auth cookie set');
  }

  for (const c of CASES) {
    const page = await browser.newPage();
    await page.setViewport({ width: 1280, height: 900 });
    const url = `${ORIGIN}/venues/${c.slug}?cb=hyd${Date.now()}`;
    const resp = await page.goto(url, { waitUntil: 'networkidle0', timeout: 90000 });
    console.log(`\n[${c.slug}] (${c.kind}) HTTP ${resp.status()}`);
    check(resp.status() === 200, `${c.slug}: 200`, `got ${resp.status()}`);

    const report = await page.evaluate(() => {
      const isVisible = (el) => {
        const r = el.getBoundingClientRect();
        if (r.width <= 0 || r.height <= 0) return false;
        return getComputedStyle(el).display !== 'none';
      };
      const all = Array.from(document.body.querySelectorAll('*'));
      const visible = all.filter(isVisible);
      const visibleText = visible.map((el) => el.textContent || '').join(' ').replace(/\s+/g, ' ');
      return { total: all.length, visible: visible.length, visibleText };
    });

    console.log(`        visible elements: ${report.visible} of ${report.total} in DOM`);
    check(report.visible >= FLOOR, `${c.slug}: visible-element count clears the floor of ${FLOOR}`, `saw ${report.visible}`);

    for (const s of c.mustBeVisible) {
      check(report.visibleText.includes(s), `${c.slug}: "${s}" is visible after hydration`);
    }
    for (const s of c.mustBeAbsent) {
      check(!report.visibleText.includes(s), `${c.slug}: "${s}" is not visible after hydration`);
    }
    await page.close();
  }
} finally {
  await browser.close();
}

console.log(`\n${failures === 0 ? 'ALL HYDRATION CHECKS PASSED' : `${failures} HYDRATION CHECK(S) FAILED`}`);
process.exit(failures === 0 ? 0 : 1);
