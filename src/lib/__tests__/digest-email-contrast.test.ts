// The redesigned digest's palette (src/lib/digest-email.ts, spec 2026-11-05)
// is separate from the confirmation email's ramp in email.ts, which
// email-contrast.test.ts guards. Same standard here: every text tone clears
// WCAG 1.4.3 (4.5:1) on each ground it renders on, and no color is a loose
// literal that this check cannot see.

import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const source = readFileSync(join(process.cwd(), 'src', 'lib', 'digest-email.ts'), 'utf8');

function srgb(c: number): number {
  const x = c / 255;
  return x <= 0.03928 ? x / 12.92 : ((x + 0.055) / 1.055) ** 2.4;
}
function luminance(hex: string): number {
  const h = hex.replace('#', '');
  const [r, g, b] = [0, 2, 4].map((i) => parseInt(h.slice(i, i + 2), 16));
  return 0.2126 * srgb(r) + 0.7152 * srgb(g) + 0.0722 * srgb(b);
}
function ratio(a: string, b: string): number {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
}
function constValue(name: string): string {
  const m = source.match(new RegExp(`const ${name} = '(#[0-9a-fA-F]{6})'`));
  assert.ok(m, `${name} is not declared in digest-email.ts as a 6-digit hex literal`);
  return m![1];
}

// [text tone, ground] pairs that occur in the markup.
const PAIRS: [string, string][] = [
  ['DIGEST_INK', 'DIGEST_WHITE'],
  ['DIGEST_MUTED', 'DIGEST_WHITE'],
  ['DIGEST_BODY', 'DIGEST_WHITE'],
  ['DIGEST_ACCENT', 'DIGEST_WHITE'],
  ['DIGEST_INK', 'DIGEST_PANEL'],
  ['DIGEST_MUTED', 'DIGEST_PANEL'],
  ['DIGEST_WHITE', 'DIGEST_ACCENT'],
];

test('every digest text tone clears 4.5:1 on the ground it renders on', () => {
  const failures = PAIRS.map(([t, g]) => [t, g, ratio(constValue(t), constValue(g))] as const)
    .filter(([, , r]) => r < 4.5)
    .map(([t, g, r]) => `${t} on ${g}: ${r.toFixed(2)}:1`);
  assert.deepEqual(failures, []);
});

test('the palette is the spec palette', () => {
  assert.equal(constValue('DIGEST_INK'), '#141413');
  assert.equal(constValue('DIGEST_MUTED'), '#6B6861');
  assert.equal(constValue('DIGEST_BODY'), '#3D3B37');
  assert.equal(constValue('DIGEST_RULE'), '#E6E3DC');
  assert.equal(constValue('DIGEST_PANEL'), '#F3F2EE');
  assert.equal(constValue('DIGEST_ACCENT'), '#1D4ED8');
});

test('no color is a loose literal in the markup', () => {
  const literals = [...source.matchAll(/(?:color|background|bgcolor)[:=]"?(#[0-9a-fA-F]{3,6})/g)].map((m) => m[1]);
  assert.deepEqual(literals, []);
});
