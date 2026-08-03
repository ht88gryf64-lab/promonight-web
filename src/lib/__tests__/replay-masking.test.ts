// Session-replay masking of visitor-supplied values rendered as page text.
//
// WHY THIS IS A SOURCE SCAN AND NOT A RENDER TEST. The repo has no render
// harness (known issue 6) and these are all client components whose strings stay
// inline in the JSX, so there is no pure module to assert against the way
// capture/sheet-copy.ts gives one for the capture sheet. The choice was between
// scanning the source and testing nothing. The defect this guards is "someone
// adds a success state that reads back what the visitor typed and does not know
// the rule", which is a source-level mistake, so a source-level guard sits where
// the mistake happens.
//
// IT MATCHES PER OCCURRENCE, NOT PER LINE, and that is the whole difference
// between this and a guard that feels reassuring. A per-line check passes as soon
// as ANY masked thing appears on the line, so `<span className="ph-no-capture">
// {email}</span> ... {email}` would be waved through with the second one naked.
// Each occurrence is judged on the tag that opens immediately before it.
//
// WHAT IT CANNOT CATCH, stated so nobody trusts it further than it goes:
//   - MULTI-LINE JSX. If the opening tag and the interpolation land on different
//     lines, the wrapping tag is not visible to this check and the occurrence is
//     reported as unmasked. That direction is deliberate: a false failure sends
//     someone to read this file, a false pass sends an address to PostHog.
//   - ANCESTOR masking. The capture sheet masks a whole <p> and interpolates
//     nothing, so it is not scanned; if a future surface masks an ancestor rather
//     than the wrapping tag, this will flag it and the fix is to mask locally or
//     add the case here.
//   - A NEW FILE. FILES is a fixed list and nothing forces an addition.
//   - A DIFFERENT NAME. It matches `email`-shaped values, so `{address}` or
//     `{contact}` walks straight past.
// It is a tripwire for the known shape, not a proof.
//
// Run with:
//   node --import tsx --experimental-test-module-mocks --test <this file>

import { test } from 'node:test';
import assert from 'node:assert';
import { readFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';

// process.cwd(), not import.meta.dirname: tsx's transform leaves the latter
// undefined here. The npm test script runs from the repo root, and the coverage
// assertion below fails loudly rather than passing on an empty scan.
const ROOT = process.cwd();

/** Surfaces known to render a subscriber address into the DOM as text. */
const FILES = [
  'src/components/follow/FollowForm.tsx',
  'src/components/follow/PreferencesForm.tsx',
  'src/app/preferences/page.tsx',
];

/** `{email}` or `{subscriber.email}`, anywhere. */
const INTERPOLATION = /\{\s*(?:subscriber\.)?email\s*\}/g;

/**
 * The ONLY two attributes that make an occurrence safe, and the reason is narrow:
 * maskAllInputs masks the VALUE OF A FORM FIELD. It does not mask any other
 * attribute. `placeholder`, `aria-label`, `title` and `alt` are all serialized by
 * rrweb verbatim, so they are deliberately NOT on this list — if an address ever
 * lands in one, this should flag it.
 */
const MASKED_ATTRIBUTES = /(?:^|\s)(?:value|defaultValue)=$/;

/**
 * A prop being threaded into a component, e.g. `<PreferencesForm email={email}>`.
 * That never reaches the DOM on its own; the component it lands in is scanned
 * separately.
 */
const PROP_PASS = /(?:^|\s)email=$/;

interface Occurrence {
  line: number;
  text: string;
  masked: boolean;
  exempt: boolean;
}

function scan(source: string): Occurrence[] {
  const out: Occurrence[] = [];
  // Block-comment state has to be tracked across lines, not sniffed per line.
  // The rule comment in FollowForm.tsx quotes `<p>{email}</p>` as the example of
  // the bad pattern, and a first-line-only heuristic flagged the documentation
  // for documenting the thing it warns about.
  let inBlock = false;

  source.split('\n').forEach((line, i) => {
    const trimmed = line.trim();

    const opens = trimmed.includes('{/*') || trimmed.includes('/*');
    const closes = trimmed.includes('*/');
    const wasInBlock = inBlock;
    if (opens && !closes) inBlock = true;
    else if (closes) inBlock = false;
    // Comments state the rule and quote the pattern; they render nothing.
    if (wasInBlock || opens || trimmed.startsWith('//') || trimmed.startsWith('*')) return;

    INTERPOLATION.lastIndex = 0;
    let m: RegExpExecArray | null;
    while ((m = INTERPOLATION.exec(line)) !== null) {
      const before = line.slice(0, m.index);
      if (MASKED_ATTRIBUTES.test(before) || PROP_PASS.test(before)) {
        out.push({ line: i + 1, text: trimmed, masked: true, exempt: true });
        continue;
      }
      // The tag that opens immediately before this occurrence is the one that
      // has to carry the class. Anything earlier on the line is a different
      // element and does not protect this one.
      const lastOpen = before.lastIndexOf('<');
      const wrappingTag = lastOpen === -1 ? '' : before.slice(lastOpen);
      out.push({
        line: i + 1,
        text: trimmed,
        masked: wrappingTag.includes('ph-no-capture'),
        exempt: false,
      });
    }
  });
  return out;
}

test('the scanned files exist and still render an address, so this suite cannot pass vacuously', () => {
  for (const rel of FILES) {
    const path = join(ROOT, rel);
    assert.ok(existsSync(path), `${rel} is missing. If it moved, update FILES.`);
    const found = scan(readFileSync(path, 'utf8'));
    assert.ok(
      found.length > 0,
      `${rel} no longer interpolates an address anywhere. Either the render moved ` +
        `to a file not in FILES — in which case add it — or the surface was ` +
        `removed and this entry should go. Passing on zero occurrences is the one ` +
        `way this guard lies.`,
    );
  }
});

for (const rel of FILES) {
  test(`${rel}: every rendered address carries ph-no-capture`, () => {
    const unmasked = scan(readFileSync(join(ROOT, rel), 'utf8'))
      .filter((o) => !o.exempt && !o.masked)
      .map((o) => `  ${rel}:${o.line}  ${o.text}`);

    assert.deepStrictEqual(
      unmasked,
      [],
      `Visitor email rendered as DOM text without ph-no-capture on its wrapping tag.\n` +
        `Session replay runs with maskAllInputs only, which masks form FIELDS and not ` +
        `rendered text, so these are captured verbatim in recordings.\n` +
        `Put ph-no-capture on the smallest element wrapping the value. See the rule ` +
        `in src/components/follow/FollowForm.tsx.\n` +
        `(If the tag and the value are on different lines, put them on one — this ` +
        `check reads a single line.)\n\n` +
        unmasked.join('\n'),
    );
  });
}

test('the capture sheet still carries ph-no-capture in a className, not just in prose', () => {
  // Narrow on purpose. The COPY asymmetry — confident and almost echo nothing,
  // failed names the address deliberately because that is the path where it is
  // most likely wrong — is already asserted properly against the pure module in
  // src/lib/capture/__tests__/sheet-copy.test.ts, and duplicating it weakly here
  // would be worse than not having it. What that file does NOT cover is the class
  // surviving on the element, which is the thing someone applying this file's rule
  // uniformly might "tidy up".
  const card = readFileSync(join(ROOT, 'src/components/capture/CaptureCard.tsx'), 'utf8');
  const inClassName = /className="[^"]*\bph-no-capture\b/.test(card);
  assert.ok(
    inClassName,
    'CaptureCard.tsx no longer has ph-no-capture in a className. Its failed variant ' +
      'names the address deliberately, so the class is load-bearing there. See ' +
      'src/lib/capture/sheet-copy.ts and its test before removing it.',
  );
});
