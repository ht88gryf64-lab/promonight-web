// Lockstep guard for the useSearchParams prerender bailout (known-issues 33).
//
// WHY A TEST AND NOT A CONVENTION. Three components were quarantined correctly,
// two of them carrying comments that explained the trap, and a fourth shipped
// with the bug anyway: /team-rankings served zero of its 75 ranked rows to
// crawlers. Nothing errored, nothing warned, and the page looked right in a
// browser, because a browser runs the hydration a crawler does not. This repo
// already answers "hand-kept invariant drifted" with a build failure
// (KNOWN_SURFACES, the revalidate PATH_RE coupling test); this is the same
// shape.
//
// WHAT THIS TEST DOES NOT COVER, stated up front so nobody trusts it too far:
// it cannot see a Suspense boundary further up the tree. A page that wraps a
// self-bounded component in a plain <div> inside a <Suspense>, or a layout that
// adds a boundary above the page, produces the SAME duplicate-render defect and
// passes this test. That failure mode still needs a human loading the page and
// counting visible elements.

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

/** Strip line and block comments so a mention of the hook in prose is not
 *  mistaken for a call. Several files discuss this exact trap in comments. */
function stripComments(source: string): string {
  return source.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');
}

const files = walk(SRC);
const rel = (f: string) => f.slice(SRC.length + 1);

/** The one file that calls useSearchParams AND renders content without its own
 *  boundary. It is a real hazard, not an exemption: mounting URL-synced chips
 *  on an indexed route would reintroduce the bailout. It is safe today only
 *  because nothing reaches it, and the LAST TEST IN THIS FILE is what holds
 *  that: every caller uses the controlled, hook-free mode. If that test ever
 *  fails, this allowance becomes the hole it is protecting against. */
const KNOWN_UNBOUNDED_BUT_UNREACHED = ['components/scoring/filter-chips.tsx'];

/** Components that own their own Suspense boundary around a null-rendering
 *  reader. A page must NOT wrap these again: the redundant outer boundary is
 *  what produced the duplicate hidden copy of every row on /team-rankings. */
const SELF_BOUNDED = [
  'TeamRankingsList',
  'BestPromosBrowser',
  'TeamsBrowser',
];

test('every useSearchParams caller renders null or owns its own Suspense boundary', () => {
  const offenders: string[] = [];

  for (const file of files) {
    const source = stripComments(readFileSync(file, 'utf8'));
    if (!/\buseSearchParams\s*\(/.test(source)) continue;

    const rendersNull = /return\s+null\s*;/.test(source);
    const ownsBoundary = /<Suspense\b[^>]*fallback=\{null\}/.test(source);

    if (!rendersNull && !ownsBoundary && !KNOWN_UNBOUNDED_BUT_UNREACHED.includes(rel(file))) {
      offenders.push(rel(file));
    }
  }

  assert.deepEqual(
    offenders,
    [],
    `These files call useSearchParams but neither render null nor own a ` +
      `<Suspense fallback={null}> boundary, so a static route rendering them ` +
      `will drop their subtree from the served HTML. Isolate the read into a ` +
      `null-rendering child inside its own boundary. See known-issues 33.\n` +
      offenders.map((o) => `  - ${o}`).join('\n'),
  );
});

test('no page wraps a self-bounded component in a redundant Suspense', () => {
  const offenders: string[] = [];
  const appFiles = files.filter((f) => rel(f).startsWith('app/'));

  for (const file of appFiles) {
    const source = stripComments(readFileSync(file, 'utf8'));
    for (const component of SELF_BOUNDED) {
      // Direct wrap only: <Suspense ...> optionally with whitespace, then the
      // component tag. This is the exact shape that shipped on /team-rankings.
      const direct = new RegExp(`<Suspense\\b[^>]*>\\s*<${component}\\b`);
      if (direct.test(source)) {
        offenders.push(`${rel(file)} wraps <${component}>`);
      }
    }
  }

  assert.deepEqual(
    offenders,
    [],
    `These pages wrap a component that already owns its Suspense boundary. ` +
      `The redundant outer boundary re-renders the whole subtree on the client ` +
      `after hydration and leaves the server copy in the DOM as a hidden ` +
      `duplicate. Remove the wrapper. See known-issues 33.\n` +
      offenders.map((o) => `  - ${o}`).join('\n'),
  );
});

test('the self-bounded components still own a boundary and a null-rendering reader', () => {
  // The mirror of the test above: if one of these ever loses its own boundary,
  // the previous test's allowance for it becomes a hole rather than a rule.
  const missing: string[] = [];

  for (const component of SELF_BOUNDED) {
    const file = files.find((f) => new RegExp(`export function ${component}\\b`).test(readFileSync(f, 'utf8')));
    if (!file) {
      missing.push(`${component}: no file exports it (renamed or deleted?)`);
      continue;
    }
    const source = stripComments(readFileSync(file, 'utf8'));
    if (!/<Suspense\b[^>]*fallback=\{null\}/.test(source)) {
      missing.push(`${rel(file)}: ${component} no longer owns a Suspense boundary`);
    }
    if (!/return\s+null\s*;/.test(source)) {
      missing.push(`${rel(file)}: ${component} has no null-rendering reader`);
    }
  }

  assert.deepEqual(missing, [], missing.join('\n'));
});

test('the URL-synced chip mode stays unused in JSX', () => {
  // FilterChips reads useSearchParams and RENDERS CONTENT, so mounting it on an
  // indexed route reintroduces the bailout. Every current caller uses the
  // controlled mode (value + onSelect), which renders the hook-free
  // FilterChipsView. This asserts nobody reaches for the default mode again.
  const offenders: string[] = [];

  for (const file of files) {
    const source = stripComments(readFileSync(file, 'utf8'));
    for (const match of source.matchAll(/<(LeagueFilter|DateRangeFilter)\b([^>]*)>/g)) {
      if (!/\bvalue=/.test(match[2])) {
        offenders.push(`${rel(file)}: <${match[1]}> without a value prop`);
      }
    }
  }

  assert.deepEqual(
    offenders,
    [],
    `These render a filter in URL-synced mode, which mounts useSearchParams ` +
      `and renders content. Use the controlled mode (value + onSelect) and own ` +
      `the state in the parent. See known-issues 33.\n` +
      offenders.map((o) => `  - ${o}`).join('\n'),
  );
});
