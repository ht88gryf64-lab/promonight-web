// CI TRIPWIRE. Asserts that no file under src/ sets a prefetch prop on a Link.
//
// WHY THIS EXISTS, in full, because a bare assertion failure would just get
// deleted by whoever hits it:
//
// The server-truth request counter separates prefetches from real navigations
// using the `next-router-prefetch` request header. Next only sends that header
// for PrefetchKind.AUTO. A Link with the DEFAULT prefetch prop resolves to
// AUTO, so today every prefetch on this site is correctly identifiable.
//
// Setting the prefetch prop to true resolves to PrefetchKind.FULL instead
// (next/dist/esm/client/app-dir/link.js, getFetchStrategyFromPrefetchProp),
// and FULL does NOT send `next-router-prefetch`
// (next/dist/esm/client/components/router-reducer/fetch-server-response.js:54).
// Those prefetches then arrive at middleware looking exactly like real soft
// navigations, so they get counted as soft_nav.
//
// The damage is silent. Nothing breaks, no error is logged, and the counter
// keeps reporting confident numbers. The soft_nav bucket quietly inflates,
// human_document is unaffected but the class totals stop reconciling, and
// nobody finds out until someone questions a dashboard weeks later. That is
// why this is a build-time failure and not a monitoring alert.
//
// Setting the prop to false is HARMLESS on its own: it only disables
// prefetching for that Link, which removes requests rather than mislabeling
// them. The ban is blanket anyway, because a blanket rule is enforceable by a
// grep and a nuanced one is not, and because a false today is easily flipped
// to true tomorrow by someone who never reads this file.
//
// KNOWN LIMIT OF THIS GUARD. It is a line-by-line text scan, so it cannot see
// a prop reached indirectly, e.g. building an object elsewhere and spreading it
// (`const p = { prefetch: someFlag }` then spreading p into a Link). The needle
// below covers every direct spelling including the boolean shorthand, but
// indirection is enforced by convention only.
//
// IF YOU ARE HERE BECAUSE THIS TEST FAILED, the options are, in order:
//   1. Remove the prop and let the Link use the default. Almost always right.
//   2. If a full prefetch is genuinely required, the counter needs a different
//      separator FIRST. Read the header comment on
//      src/lib/analytics/traffic-classifier.ts (classifyRequestType), decide
//      the new separator, then relax this test in the same commit.
// Deleting the test without doing 1 or 2 silently corrupts the traffic data.

import { test } from 'node:test';
import assert from 'node:assert';
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { dirname, join, resolve, sep } from 'node:path';

// Locate src/ by walking up from the working directory to the repo root.
// import.meta.dirname is NOT usable here: the test runner loads this file
// through tsx, which transpiles to CJS, leaving import.meta empty.
function findSrcDir(): string {
  let dir = resolve(process.cwd());
  for (let i = 0; i < 10; i++) {
    if (existsSync(join(dir, 'package.json')) && existsSync(join(dir, 'src'))) {
      return join(dir, 'src');
    }
    const parent = dirname(dir);
    if (parent === dir) break;
    dir = parent;
  }
  throw new Error(`could not locate the repo src/ directory from ${process.cwd()}`);
}

const SRC = findSrcDir();

// Built from parts so the literal never appears in this file's own source.
// Without that, this test would flag itself and every explanatory comment
// above would have to be rewritten around its own needle.
//
// The alternatives, and why each is here. The JSX boolean shorthand
// `<Link prefetch>` is IDENTICAL to writing the prop as true, so a needle that
// only looked for an equals sign would catch the harmless spelling and miss the
// single form that actually corrupts the counter. That was the first version of
// this test and it was wrong.
//   =                     the prop written with a value
//   /?>                   shorthand closing the tag, bare or self-closing
//   }                     shorthand as the last entry in a spread object
//   $                     shorthand left alone on its own line by a formatter
//   :\s*true              a prop object, e.g. { prefetch: true }
//   <ident>\s*=           shorthand followed by another JSX attribute
// The lookbehind keeps `next-router-prefetch` (the header name, which appears
// in prose in several files) from matching, and the lookahead stops the needle
// from firing on any longer identifier that merely starts with the word.
const NEEDLE = new RegExp(
  '(?<![\\w-])' +
    'prefetch' +
    '(?![\\w-])\\s*(?:=|/?>|\\}|$|:\\s*true|[a-zA-Z$_][\\w$]*\\s*=)',
  'i',
);

// This file names the hazard in prose throughout, so it must exempt itself.
// Matched on the path suffix rather than import.meta.filename, for the CJS
// reason above.
const SELF_SUFFIX = join('__tests__', 'no-link-prefetch-prop.test.ts');

function walk(dir: string, out: string[] = []): string[] {
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) {
      walk(full, out);
      continue;
    }
    if (/\.tsx?$/.test(entry)) out.push(full);
  }
  return out;
}

test('no Link in src sets a prefetch prop (request-counter prefetch separator)', () => {
  const files = walk(SRC).filter((f) => !f.endsWith(SELF_SUFFIX));
  assert.ok(files.length > 100, `sanity: expected to scan many files, scanned ${files.length}`);

  const offenders: string[] = [];
  for (const file of files) {
    const lines = readFileSync(file, 'utf8').split('\n');
    lines.forEach((line, i) => {
      if (NEEDLE.test(line)) {
        const rel = file.slice(SRC.length + 1).split(sep).join('/');
        offenders.push(`  src/${rel}:${i + 1}  ${line.trim()}`);
      }
    });
  }

  assert.strictEqual(
    offenders.length,
    0,
    [
      '',
      'A prefetch prop was found on a Link (or somewhere that looks like one):',
      ...offenders,
      '',
      'THIS BREAKS THE SERVER-TRUTH REQUEST COUNTER.',
      '',
      'The counter separates prefetches from real navigations using the',
      'next-router-prefetch request header. Next sends that header ONLY for',
      'PrefetchKind.AUTO, which is what a Link with the DEFAULT prefetch prop',
      'resolves to. Setting the prop to true resolves to PrefetchKind.FULL,',
      'which does NOT send the header, so those prefetches silently start',
      'counting as soft_nav instead of prefetch. Nothing errors; the numbers',
      'just quietly stop being true.',
      '',
      'Fix: remove the prop and use the default. If a full prefetch is truly',
      'required, change the counter\'s separator first. Read the header comments',
      'on src/lib/analytics/traffic-classifier.ts (classifyRequestType) and on',
      'src/lib/analytics/__tests__/no-link-prefetch-prop.test.ts before touching',
      'either.',
      '',
    ].join('\n'),
  );
});
