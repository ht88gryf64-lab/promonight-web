// Lockstep guard for --color-rd-ink-decor (known-issues entry 35).
//
// WHY. ink-faint used to do two jobs under one name, text a user reads and
// decoration allowed to recede, and it failed AA at both. The split fixed the
// values, but a split only holds if the muted token stays out of text. The
// failure mode is silent: nothing errors, the type system has no opinion about
// a Tailwind class, and the page looks fine to anyone who is not measuring.
// This repo has already learned that a convention living only in comments does
// not survive contact with a new component (see entry 33), so the rule is a
// build failure instead.
//
// THE RULE. ink-decor is #9a9081, which fails 4.5:1 on both grounds and fails
// even the 3.0:1 non-text bar on the cream page. It may only be applied to:
//   - background-color (bg-rd-ink-decor), for fills like the drag handle
//   - color on an element whose entire visible content is an aria-hidden glyph
// It may never carry text, and never a glyph a sighted user needs to read.
//
// WHAT THIS DOES NOT COVER: it reads class strings and their immediate JSX
// context, so a color inherited through several layers of children, or applied
// via a computed className, can escape it. It narrows the failure; it does not
// close it.

import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';

const SRC = join(process.cwd(), 'src');

function walk(dir: string, out: string[] = []): string[] {
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) {
      if (entry === '__tests__' || entry === 'node_modules') continue;
      walk(full, out);
    } else if (/\.tsx?$/.test(entry)) {
      out.push(full);
    }
  }
  return out;
}

const files = walk(SRC);
const rel = (f: string) => f.slice(SRC.length + 1);

/** Every site allowed to put ink-decor on `color`. Each is an element whose
 *  entire visible content is an aria-hidden glyph. Adding to this list is a
 *  deliberate act: verify the element carries no readable text first. */
const GLYPH_ALLOWLIST = new Set([
  'app/promos/soccer-jersey-nights/page.tsx',
  'app/venues/bag-policies/page.tsx',
  'components/capture/CaptureSheet.tsx',
  'components/hub/HubBrowseByType.tsx',
  'components/my-teams-view.tsx',
  'components/redesign/ExploreCard.tsx',
  'components/redesign/RedesignPromoRow.tsx',
  'components/redesign/ScheduleRow.tsx',
  'components/team-related-aggregators.tsx',
  'components/venue-hub/HubTeamLink.tsx',
  'components/venue-hub/VenueHubLink.tsx',
]);

/** Text that would be READ if it inherited the decor color.
 *
 *  Three things had to be stripped before this stopped producing false
 *  positives, and each one caught a real site: HTML entities (&rsaquo; matched
 *  as the word "rsaquo"), JSX expressions, and nested tags including their
 *  attributes. Self-closing elements are handled by the caller, since they
 *  have no children at all. */
function hasReadableText(fragment: string): boolean {
  const withoutEntities = fragment.replace(/&[a-zA-Z]+;|&#\d+;/g, ' ');
  const withoutTags = withoutEntities.replace(/<[^>]*>/g, ' ');
  const withoutExpressions = withoutTags.replace(/\{[^}]*\}/g, ' ');
  return /[A-Za-z]{2,}/.test(withoutExpressions);
}

/** The element's own children, or null when it is self-closing. Deliberately
 *  conservative: when the shape cannot be determined, return null and let the
 *  site pass rather than reporting a failure we cannot stand behind. */
function childrenOf(lines: string[], start: number): string | null {
  const window = lines.slice(start, start + 12).join('\n');
  const selfClosing = window.match(/^[\s\S]*?\/>/);
  const openEnd = window.indexOf('>');
  if (openEnd === -1) return null;
  if (selfClosing && selfClosing[0].length <= openEnd + 1) return null;
  const body = window.slice(openEnd + 1);
  const close = body.search(/<\/(?:span|div|p|a|button|li)>/);
  return close === -1 ? null : body.slice(0, close);
}

test('text-rd-ink-decor never sits on an element carrying readable text', () => {
  const offenders: string[] = [];

  for (const file of files) {
    const source = readFileSync(file, 'utf8');
    if (!source.includes('text-rd-ink-decor')) continue;
    const lines = source.split('\n');

    lines.forEach((line, i) => {
      if (!line.includes('text-rd-ink-decor')) return;
      // Look at the element this class opens, through to its close or the next
      // 6 lines, whichever comes first.
      const children = childrenOf(lines, i);
      if (children !== null && hasReadableText(children)) {
        offenders.push(`${rel(file)}:${i + 1}`);
      }
    });
  }

  assert.deepEqual(
    offenders,
    [],
    `ink-decor is the muted, NON-TEXT tone: it fails 4.5:1 on both grounds and ` +
      `fails 3.0:1 on cream. These sites put it on an element that renders ` +
      `readable text. Use text-rd-ink-faint, which is the compliant caption ` +
      `tone. See known-issues 35.\n` +
      offenders.map((o) => `  - ${o}`).join('\n'),
  );
});

test('no new bare text-rd-ink-decor outside the glyph allowlist', () => {
  const offenders: string[] = [];

  for (const file of files) {
    const source = readFileSync(file, 'utf8');
    if (!source.includes('text-rd-ink-decor')) continue;
    if (!GLYPH_ALLOWLIST.has(rel(file))) {
      offenders.push(rel(file));
    }
  }

  assert.deepEqual(
    offenders,
    [],
    `These files apply text-rd-ink-decor but are not on the glyph allowlist. ` +
      `Either the element is a genuine aria-hidden glyph, in which case add it ` +
      `to GLYPH_ALLOWLIST in this test after checking it carries no readable ` +
      `text, or it should use text-rd-ink-faint. See known-issues 35.\n` +
      offenders.map((o) => `  - ${o}`).join('\n'),
  );
});

test('the allowlist has no stale entries', () => {
  // A file that stops using the token should leave the allowlist, otherwise the
  // list slowly becomes a blanket exemption for files that once qualified.
  const stale: string[] = [];
  for (const entry of GLYPH_ALLOWLIST) {
    const full = join(SRC, entry);
    let source: string;
    try {
      source = readFileSync(full, 'utf8');
    } catch {
      stale.push(`${entry} (file no longer exists)`);
      continue;
    }
    if (!source.includes('text-rd-ink-decor')) {
      stale.push(`${entry} (no longer uses the token)`);
    }
  }
  assert.deepEqual(stale, [], `Remove these from GLYPH_ALLOWLIST:\n${stale.join('\n')}`);
});

test('the ink ramp values are the ones the contrast work established', () => {
  // Guards the values themselves, so a future palette edit cannot quietly undo
  // the AA work. Ratios are recomputed rather than trusted from a comment.
  const css = readFileSync(join(process.cwd(), 'src', 'app', 'globals.css'), 'utf8');
  const tokenOf = (name: string) => {
    const m = css.match(new RegExp(`--color-rd-${name}:\\s*(#[0-9a-fA-F]{6})`));
    return m ? m[1].toLowerCase() : null;
  };

  const srgb = (c: number) => {
    const x = c / 255;
    return x <= 0.03928 ? x / 12.92 : ((x + 0.055) / 1.055) ** 2.4;
  };
  const lum = (hex: string) => {
    const h = hex.replace('#', '');
    const [r, g, b] = [0, 2, 4].map((i) => parseInt(h.slice(i, i + 2), 16));
    return 0.2126 * srgb(r) + 0.7152 * srgb(g) + 0.0722 * srgb(b);
  };
  const ratio = (a: string, b: string) => {
    const [hi, lo] = [lum(a), lum(b)].sort((x, y) => y - x);
    return (hi + 0.05) / (lo + 0.05);
  };

  const white = tokenOf('card');
  const cream = tokenOf('cream');
  const ink = tokenOf('ink');
  const soft = tokenOf('ink-soft');
  const faint = tokenOf('ink-faint');
  const decor = tokenOf('ink-decor');
  assert.ok(white && cream && ink && soft && faint && decor, 'all ink tokens resolve');

  for (const [name, value] of [['ink', ink], ['ink-soft', soft], ['ink-faint', faint]] as const) {
    for (const [groundName, ground] of [['white card', white!], ['cream page', cream!]] as const) {
      const r = ratio(value!, ground);
      assert.ok(
        r >= 4.5,
        `${name} (${value}) is ${r.toFixed(2)}:1 on the ${groundName}, under the 4.5:1 text floor`,
      );
    }
  }

  // THE RAMP MUST READ AS THREE STEPS, NOT TWO.
  //
  // Both ends are pinned: ink is the brand charcoal and ink-faint sits on the
  // 4.5:1 floor for cream. So the total span is fixed and the two steps
  // multiply to it, which means they trade one for one. A future edit that
  // "improves" one step is silently taking it from the other, and the bar
  // below is what makes that visible instead of shipping.
  const top = ratio(ink!, soft!);
  const bottom = ratio(soft!, faint!);
  const span = ratio(ink!, faint!);

  assert.ok(
    Math.abs(top * bottom - span) < 0.01,
    `the two steps must multiply to the span: ${top.toFixed(3)} x ${bottom.toFixed(3)} = ` +
      `${(top * bottom).toFixed(3)}, span is ${span.toFixed(3)}. If this fails the contrast ` +
      `math itself is wrong, not the palette.`,
  );

  for (const [name, value] of [['ink to ink-soft', top], ['ink-soft to ink-faint', bottom]] as const) {
    assert.ok(
      value >= 1.7,
      `${name} separation is ${value.toFixed(2)}:1, under the 1.70 bar. The span is fixed at ` +
        `${span.toFixed(2)}:1, so this step was almost certainly narrowed to widen the other one. ` +
        `The even split is ${Math.sqrt(span).toFixed(2)}:1 each and there is no room for both ` +
        `steps to be generous. See the ramp comment in globals.css.`,
    );
  }

  // Shape: the top step stays the larger of the two. Darkening ink-soft past
  // the even-split point inverts the ramp, making the heading-to-body step
  // weaker than the body-to-caption step.
  assert.ok(
    top >= bottom,
    `the ramp has inverted: ink to ink-soft is ${top.toFixed(2)}:1 but ink-soft to ink-faint is ` +
      `${bottom.toFixed(2)}:1. ink-soft has been darkened past the even-split point of ` +
      `${Math.sqrt(span).toFixed(2)}:1.`,
  );
});
