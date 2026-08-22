// Lockstep guard for the email text ramp (docs/known-issues.md entry 36).
//
// WHY. The digest goes out weekly to real subscribers, and two of its text
// tones had drifted under WCAG AA without anyone noticing: #8a8276 at 3.79:1
// carried the date column, the team meta line and every footer and unsubscribe
// link, and #a39b8d at 2.75:1 carried the CAN-SPAM postal address. Nothing
// caught it because the colors were 28 inline literals scattered through
// template strings, there is no rendering test for this file, and email is the
// one surface nobody opens in a browser devtools pane.
//
// The site's ramp cannot help here. Email cannot read CSS custom properties, so
// email.ts will always carry its own literal hexes. What it CAN share is the
// standard, and this test is where that standard lives.
//
// WHAT THIS DOES NOT COVER. It reads declared values, so it proves the palette
// is compliant, not that a given string is painted on the ground this test
// assumes. It also cannot see what a client does to the colors: Gmail and Apple
// Mail dark mode may invert or shift a light palette, and no static check
// reaches that.

import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const EMAIL_SRC = join(process.cwd(), 'src', 'lib', 'email.ts');
const source = readFileSync(EMAIL_SRC, 'utf8');

function srgb(c: number): number {
  const x = c / 255;
  return x <= 0.03928 ? x / 12.92 : ((x + 0.055) / 1.055) ** 2.4;
}
function luminance(hex: string): number {
  let h = hex.replace('#', '');
  if (h.length === 3) h = h.split('').map((c) => c + c).join('');
  const [r, g, b] = [0, 2, 4].map((i) => parseInt(h.slice(i, i + 2), 16));
  return 0.2126 * srgb(r) + 0.7152 * srgb(g) + 0.0722 * srgb(b);
}
function ratio(a: string, b: string): number {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
}

/** Reads a `const NAME = '#hex';` declaration out of email.ts. */
function constValue(name: string): string | null {
  const m = source.match(new RegExp(`const ${name} = '(#[0-9a-fA-F]{3,6})'`));
  return m ? m[1].toLowerCase() : null;
}

/** The only ground any text in email.ts renders on. The beige frame is a
 *  gutter and the dark bar carries only the wordmark, which is checked
 *  separately below. */
const CARD = '#ffffff';
const DARK_BAR = '#1d1714';

/** Every tone that carries readable text, and what it is for. Adding a color to
 *  email.ts means adding it here too, which the last test enforces. */
const TEXT_TONES = [
  { name: 'EMAIL_INK', role: 'headings and promo titles' },
  { name: 'EMAIL_INK_BODY', role: 'body prose' },
  { name: 'EMAIL_INK_SOFT', role: 'sub-headlines and overflow lines' },
  { name: 'EMAIL_INK_FAINT', role: 'dates, meta, footers, postal line' },
  { name: 'EMAIL_RED', role: 'links and the CTA fill' },
];

test('every email text tone clears 4.5:1 on the card it renders on', () => {
  const failures: string[] = [];

  for (const { name, role } of TEXT_TONES) {
    const value = constValue(name);
    assert.ok(value, `${name} is not declared in email.ts as a plain hex literal`);
    const r = ratio(value!, CARD);
    if (r < 4.5) {
      failures.push(`${name} (${value}, ${role}) is ${r.toFixed(2)}:1 on ${CARD}`);
    }
  }

  assert.deepEqual(
    failures,
    [],
    `These email text tones are under WCAG 1.4.3 normal text. This email is sent ` +
      `weekly to real subscribers and email clients render on white by default, so ` +
      `a tone under 4.5:1 here is a live accessibility failure, not a staging one. ` +
      `The site's quietest readable tier is #786e60 at 5.00:1 on white and is the ` +
      `floor to reach for. See known-issues 36.\n` +
      failures.map((f) => `  - ${f}`).join('\n'),
  );
});

test('the wordmark tones clear 4.5:1 on the dark bar', () => {
  // These two are the exception: they are the only text on a dark ground, so
  // they are measured against the bar rather than the card. On the card they
  // would fail, which is correct and is why they are named for their ground.
  for (const name of ['EMAIL_ON_DARK', 'EMAIL_ACCENT_ON_DARK']) {
    const value = constValue(name);
    assert.ok(value, `${name} is not declared in email.ts`);
    const r = ratio(value!, DARK_BAR);
    assert.ok(
      r >= 4.5,
      `${name} (${value}) is ${r.toFixed(2)}:1 on the dark bar ${DARK_BAR}, under 4.5:1`,
    );
  }
});

test('no color is hardcoded past the ramp constants', () => {
  // The drift happened because the values were 28 scattered literals. If a new
  // literal appears in a style attribute, the tests above cannot see it, so the
  // guard has to insist every text color goes through a named constant.
  const literals = [...source.matchAll(/color:(#[0-9a-fA-F]{3,6})/g)].map((m) => m[1]);

  assert.deepEqual(
    literals,
    [],
    `These text colors are inline literals rather than one of the EMAIL_* ramp ` +
      `constants, so the contrast assertions above do not cover them. Add the ` +
      `value to the ramp block at the top of email.ts and reference it. See ` +
      `known-issues 36.\n` +
      [...new Set(literals)].map((l) => `  - color:${l}`).join('\n'),
  );
});

test('the quietest email tier matches the site ink-faint value', () => {
  // Not a style rule, a drift alarm. The two palettes are deliberately separate
  // because email cannot read CSS variables, but the quietest READABLE tier is
  // the same job on both surfaces and sits on the same 4.5:1 floor. If the site
  // moves its floor and email does not, that is worth a deliberate decision
  // rather than silence.
  const css = readFileSync(join(process.cwd(), 'src', 'app', 'globals.css'), 'utf8');
  const siteFaint = (css.match(/--color-rd-ink-faint:\s*(#[0-9a-fA-F]{6})/) || [])[1]?.toLowerCase();
  const emailFaint = constValue('EMAIL_INK_FAINT');

  assert.equal(
    emailFaint,
    siteFaint,
    `EMAIL_INK_FAINT (${emailFaint}) has drifted from --color-rd-ink-faint ` +
      `(${siteFaint}). Both are the quietest readable tier on their surface and ` +
      `both sit on the 4.5:1 floor. If the divergence is intended, change this ` +
      `assertion and say why in known-issues 36; do not just re-sync the values ` +
      `without deciding.`,
  );
});
