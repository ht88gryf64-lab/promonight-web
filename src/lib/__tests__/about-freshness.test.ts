// Lockstep guard for the /about editorial date (docs/known-issues.md entry 37).
//
// WHY. /about now renders a visible "Last reviewed" date and publishes the same
// value as AboutPage.dateModified and as the sitemap <lastmod> for that URL. A
// date is only worth publishing if it is true, and a hand-maintained date goes
// stale the first time someone edits the copy and forgets it. That failure is
// silent: the page still builds, the schema still validates, and the only
// symptom is a freshness claim that quietly stops being one.
//
// The house has been here before. src/components/json-ld.tsx:123 records why
// dateModified was REMOVED from 169 team pages: it was `new Date()` per ISR
// render, a synthetic always-now claim (entry 17). The lesson taken there was
// omit rather than synthesize. This page can do better than omit, because a
// human really does review this copy, but only if the date is held to it.
//
// HOW. src/lib/about-copy.ts carries the copy, the review date, and a SHA-256
// of its own contents with the fingerprint line removed. Change the copy
// without bumping both and this test fails with the value to paste in.
//
// WHAT THIS DOES NOT COVER. It proves the date moved when the copy moved. It
// cannot prove a human actually re-read the page, and it does not watch facts
// that live outside this file: a count derived from Firestore can change
// without any edit here, which is the intended design.

import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import {
  ABOUT_COPY_FINGERPRINT,
  ABOUT_LAST_REVIEWED,
  ABOUT_LAST_REVIEWED_LABEL,
} from '../about-copy';

const COPY_PATH = join(process.cwd(), 'src', 'lib', 'about-copy.ts');

/** The file as the fingerprint sees it: everything except the fingerprint's own
 *  assignment, which would otherwise be self-referential. */
function fingerprintSource(): string {
  return readFileSync(COPY_PATH, 'utf8')
    .split('\n')
    .filter((l) => !l.includes('ABOUT_COPY_FINGERPRINT'))
    .join('\n');
}

test('the /about copy fingerprint matches the copy', () => {
  const actual = createHash('sha256').update(fingerprintSource()).digest('hex');
  assert.equal(
    actual,
    ABOUT_COPY_FINGERPRINT,
    `The /about copy changed but ABOUT_COPY_FINGERPRINT did not.\n\n` +
      `This page publishes ABOUT_LAST_REVIEWED as a visible "Last reviewed" date, as\n` +
      `AboutPage.dateModified, and as the sitemap lastmod. If the words moved and the\n` +
      `date did not, all three are now claiming a review that did not happen.\n\n` +
      `Re-read the copy, then update BOTH constants in src/lib/about-copy.ts:\n` +
      `  ABOUT_LAST_REVIEWED       = '<today, YYYY-MM-DD>'\n` +
      `  ABOUT_LAST_REVIEWED_LABEL = '<the same date, spelled out>'\n` +
      `  ABOUT_COPY_FINGERPRINT    = '${actual}'\n`,
  );
});

test('the review date is a real, past, well-formed date', () => {
  assert.match(
    ABOUT_LAST_REVIEWED,
    /^\d{4}-\d{2}-\d{2}$/,
    `ABOUT_LAST_REVIEWED must be YYYY-MM-DD; it is published as a schema dateModified ` +
      `and as a sitemap lastmod, both of which require it.`,
  );
  const parsed = new Date(ABOUT_LAST_REVIEWED);
  assert.ok(!Number.isNaN(parsed.getTime()), `ABOUT_LAST_REVIEWED is not a parseable date`);
  // A future review date would be a claim about work not yet done. Allow a day
  // of slack so a timezone difference between author and CI cannot fail a build.
  const tomorrow = Date.now() + 24 * 60 * 60 * 1000;
  assert.ok(
    parsed.getTime() <= tomorrow,
    `ABOUT_LAST_REVIEWED (${ABOUT_LAST_REVIEWED}) is in the future, which claims a review that has not happened`,
  );
});

test('the visible label and the machine-readable date are the same day', () => {
  // The page renders the label to humans and the ISO value in `datetime` and in
  // schema. If they drift, the page shows one date and tells a crawler another.
  const iso = new Date(`${ABOUT_LAST_REVIEWED}T00:00:00Z`);
  const expected = iso.toLocaleDateString('en-US', {
    month: 'long',
    day: 'numeric',
    year: 'numeric',
    timeZone: 'UTC',
  });
  assert.equal(
    ABOUT_LAST_REVIEWED_LABEL,
    expected,
    `ABOUT_LAST_REVIEWED_LABEL must spell out ABOUT_LAST_REVIEWED exactly. ` +
      `Expected "${expected}".`,
  );
});

test('the sitemap binds /about lastmod to the same constant', () => {
  // Guards the binding itself. Every other sitemap entry uses the build clock,
  // so the easy regression is someone "tidying" this one back to `now`, which
  // would tell Google the page changed on every deploy and disagree with the
  // date printed on it.
  const sitemap = readFileSync(join(process.cwd(), 'src', 'app', 'sitemap.ts'), 'utf8');
  assert.ok(
    sitemap.includes('ABOUT_LAST_REVIEWED'),
    `src/app/sitemap.ts no longer reads ABOUT_LAST_REVIEWED. The /about entry must bind ` +
      `lastModified to the editorial constant, not to the build clock, or the sitemap and ` +
      `the visible date will disagree.`,
  );
  const aboutEntry = sitemap.slice(sitemap.indexOf('/about`'), sitemap.indexOf('/about`') + 400);
  assert.ok(
    !/lastModified:\s*now/.test(aboutEntry),
    `The /about sitemap entry is back on the build clock (lastModified: now).`,
  );
});

// ── the scanner club counts, against the pipeline's own config ──────────────
//
// about-copy.ts states how many NHL clubs and NBA teams the weekly scan checks.
// The figures live in the pipeline (team-configs/nhl.js, team-configs/nba.js:
// every entry that is not `active: false`). Typed into copy they went stale
// (27 of 32 and 20 of 30 on the page, 29 and 28 in the config, 2026-11-25).
// Absent the pipeline checkout this skips in red; it never passes by default.
test('the scanner club counts on /about match the pipeline team configs', async (t) => {
  const { existsSync } = await import('node:fs');
  const { createRequire } = await import('node:module');
  const { resolve } = await import('node:path');
  const { SCANNER_CLUBS } = await import('../about-copy');
  const dir = process.env.PROMO_PIPELINE_DIR || '../promonight/promo-pipeline';
  const file = (lg: string) => resolve(join(dir, 'team-configs', `${lg}.js`));
  if (!existsSync(file('nhl')) || !existsSync(file('nba'))) {
    process.stderr.write(`\x1b[31mSKIPPED /about scanner-count test: ${file('nhl')} is absent; set PROMO_PIPELINE_DIR to the promo-pipeline checkout (CLAUDE.md, worktrees)\x1b[0m\n`);
    t.skip(`PROMO_PIPELINE_DIR absent (${dir})`);
    return;
  }
  const req = createRequire(import.meta.url);
  for (const [league, lg] of [['NHL', 'nhl'], ['NBA', 'nba']] as const) {
    const mod = req(file(lg)) as unknown;
    const raw = Array.isArray(mod) ? mod : Object.values(mod as Record<string, unknown>).find(Array.isArray) ?? Object.values(mod as Record<string, unknown>);
    const clubs = (raw as Array<{ active?: boolean; teamSlug?: string }>).filter((c) => c && typeof c === 'object' && typeof c.teamSlug === 'string');
    assert.ok(clubs.length >= 30, `${league}: the config read as ${clubs.length} clubs`);
    assert.deepEqual(
      { checked: clubs.filter((c) => c.active !== false).length, total: clubs.length },
      { ...SCANNER_CLUBS[league] },
      `${league}: update SCANNER_CLUBS in src/lib/about-copy.ts (and the review date) to the pipeline's team-configs/${lg}.js`,
    );
  }
});

test('the copy prints the scanner counts from the constant and no league state of its own', () => {
  // Code only: the file's history comments quote the retired sentences.
  const src = readFileSync(COPY_PATH, 'utf8').split('\n').filter((l) => !/^\s*(\/\/|\*|\/\*)/.test(l)).join('\n');
  assert.match(src, /\$\{SCANNER_CLUBS\.NHL\.checked\} of the \$\{SCANNER_CLUBS\.NHL\.total\} NHL clubs and \$\{SCANNER_CLUBS\.NBA\.checked\} of the \$\{SCANNER_CLUBS\.NBA\.total\} NBA teams/);
  assert.doesNotMatch(src, /27 of the 32|20 of the 30|posting theirs now|still waiting on team announcements/);
  assert.match(src, /\$\{leagueState \? `\$\{leagueState\} ` : ''\}\[Browse every team\]/);
});

