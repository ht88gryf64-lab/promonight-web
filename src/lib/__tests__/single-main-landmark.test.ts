import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync, existsSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';

// ONE <main> PER PAGE.
//
// Until 2026-09-14 the root layout rendered `<main class="relative z-[1]">` and
// eight page templates rendered a second <main> inside it, so 296 of 481 sitemap
// URLs served two main landmarks. Both were exposed: a CDP Accessibility
// .getFullAXTree read on Chrome 153 found two unignored role=main nodes at both
// 386px and 1440px, nested rather than sibling, and `display:contents` on the
// team page's weave shells did NOT remove them from the tree.
//
// The fix retagged the inner elements to <div>. That is a one-character-per-file
// change with no test behind it, and the ninth template would reintroduce the
// duplicate silently — nothing in the type system or the linter knows that <main>
// is spoken for. Hence this file.
//
// WHAT THIS PROVES: no template reintroduces a second <main> in source, and the
// selector-hook vocabulary stays closed. WHAT IT DOES NOT PROVE on its own: that
// the rendered DOM has one <main>, because these are async server components that
// read Firestore and this suite has no renderer. The third describe() block below
// closes that gap against real prerendered HTML whenever a build is present, and
// the served-HTML check at the gate covers production.

const SRC = join(process.cwd(), 'src');

// The ONLY files allowed to render a <main>.
//
//  - app/layout.tsx is the root landmark every page inherits. Its `relative z-[1]`
//    also lifts page content above the fixed `body::before` noise overlay at
//    z-index:0, so it is load-bearing beyond semantics — do not retag it.
//  - The three error/404 templates each have TWO branches. With the redesign gate
//    on — which is production, site-wide since 2026-06-06 — they return an
//    `rd-root` <div> and render NO <main>, so production 404s and error pages
//    already serve exactly one landmark (verified against .next/server/app/
//    _not-found.html, which contains only `<main class="relative z-[1]">`). The
//    <main> below line 40-odd in each file is the gate-OFF branch, which no
//    production request reaches. They are listed here because the source still
//    contains the tag, not because they nest in production. Removing one from
//    this list without retagging it will fail the first test, which is the point.
const ALLOWED_MAIN = new Set([
  'app/layout.tsx',
  'app/error.tsx',
  'app/not-found.tsx',
  'app/[sport]/[team]/not-found.tsx',
]);

const AD_REGIONS = new Set(['content']);
// Two tiers, deliberately. A CONTAINER is a top-level block of a page — the unit
// an ad can be placed BETWEEN. A LEAF is a repeating row or card inside one — the
// unit an ad can be placed AMONG. A leaf inside a container is the intended shape
// (a venue-card inside a hub-section, a promo inside an aggregator-row). Anything
// else nesting is a mistake, and the built-HTML test below enforces exactly that.
const AD_CONTAINER_ITEMS = new Set(['hub-section', 'cfb-section', 'rivalry-section', 'aggregator-row']);
const AD_LEAF_ITEMS = new Set(['promo', 'venue-card']);
const AD_ITEMS = new Set([...AD_CONTAINER_ITEMS, ...AD_LEAF_ITEMS]);

function walk(dir: string, out: string[] = []): string[] {
  for (const e of readdirSync(dir)) {
    const p = join(dir, e);
    if (statSync(p).isDirectory()) walk(p, out);
    else if (p.endsWith('.tsx')) out.push(p);
  }
  return out;
}

const tsxFiles = walk(SRC);

describe('one <main> per page', () => {
  test('only the root layout and the error/404 carve-out render a <main>', () => {
    const offenders: string[] = [];
    for (const file of tsxFiles) {
      const source = readFileSync(file, 'utf8');
      // `<main` followed by a tag boundary — not the word "main" in prose, and
      // not `<main>` inside a /* comment */, which is why we strip block comments.
      const stripped = source.replace(/\/\*[\s\S]*?\*\//g, '');
      if (!/<main[\s>]/.test(stripped)) continue;
      const rel = relative(SRC, file);
      if (!ALLOWED_MAIN.has(rel)) offenders.push(rel);
    }
    assert.deepEqual(
      offenders,
      [],
      `these templates render a <main> inside the root layout's <main>, which serves two ` +
        `main landmarks. Retag the inner element to <div>, preserving every class ` +
        `(on the team page, rd-weave-shell is load-bearing for the order floor):\n  ` +
        offenders.join('\n  '),
    );
  });

  test('every file the carve-out names still exists and still renders a <main>', () => {
    // Guards the inverse failure: someone fixes error.tsx but leaves it listed,
    // and the list silently starts excusing nothing.
    for (const rel of ALLOWED_MAIN) {
      const p = join(SRC, rel);
      assert.ok(existsSync(p), `${rel} is in ALLOWED_MAIN but does not exist`);
      const stripped = readFileSync(p, 'utf8').replace(/\/\*[\s\S]*?\*\//g, '');
      assert.ok(
        /<main[\s>]/.test(stripped),
        `${rel} is in ALLOWED_MAIN but no longer renders a <main> — drop it from the list`,
      );
    }
  });
});

describe('selector hook vocabulary', () => {
  test('every data-ad-region and data-ad-item uses a value from the closed set', () => {
    const bad: string[] = [];
    for (const file of tsxFiles) {
      const source = readFileSync(file, 'utf8');
      for (const m of source.matchAll(/data-ad-region="([^"]*)"/g)) {
        if (!AD_REGIONS.has(m[1])) bad.push(`${relative(SRC, file)}: region "${m[1]}"`);
      }
      for (const m of source.matchAll(/data-ad-item="([^"]*)"/g)) {
        if (!AD_ITEMS.has(m[1])) bad.push(`${relative(SRC, file)}: item "${m[1]}"`);
      }
    }
    assert.deepEqual(bad, [], `unknown selector-hook values:\n  ${bad.join('\n  ')}`);
  });
});

// ── Rendered output ─────────────────────────────────────────────────────────
// The source tests above cannot see the DOM. These read the prerendered HTML
// Next.js writes during `next build` and assert on real markup. They SKIP when
// no build is present so `npm test` stays fast and buildless locally; CI runs
// them for real because it builds first.
const APP_BUILD = join(process.cwd(), '.next', 'server', 'app');

function prerenderedHtml(): string[] {
  if (!existsSync(APP_BUILD)) return [];
  const out: string[] = [];
  const rec = (dir: string) => {
    for (const e of readdirSync(dir)) {
      const p = join(dir, e);
      if (statSync(p).isDirectory()) rec(p);
      else if (p.endsWith('.html')) out.push(p);
    }
  };
  rec(APP_BUILD);
  return out;
}

describe('rendered output has exactly one <main>', () => {
  const files = prerenderedHtml();

  test('every prerendered page renders exactly one <main>', { skip: files.length === 0 && 'no build present (.next/server/app) — run `npm run build` first' }, () => {
    const bad: string[] = [];
    for (const f of files) {
      // Strip <script> so the RSC flight payload cannot be miscounted as markup.
      const html = readFileSync(f, 'utf8').replace(/<script\b[\s\S]*?<\/script>/gi, '');
      // `<html id="__next_error__">` is the shell Next writes for a route that
      // calls notFound() during prerender — /dev/ad-slots and /dev/venue-promos
      // both do, in production. It is not a rendered page and has no landmark.
      if (html.includes('__next_error__')) continue;
      const opens = (html.match(/<main[\s>]/g) ?? []).length;
      if (opens !== 1) bad.push(`${relative(APP_BUILD, f)}: ${opens}`);
    }
    assert.deepEqual(bad, [], `prerendered pages with a <main> count other than 1:\n  ${bad.join('\n  ')}`);
  });

  test('item nesting is container -> leaf only', { skip: files.length === 0 && 'no build present' }, () => {
    // Overlapping items would hand an ad placer ambiguous targets.
    const bad: string[] = [];
    for (const f of files) {
      const html = readFileSync(f, 'utf8').replace(/<script\b[\s\S]*?<\/script>/gi, '');
      let depth = 0;
      // The open data-ad-item we are currently inside, if any.
      let open: { depth: number; type: string } | null = null;
      for (const m of html.matchAll(/<(\/?)([a-z][a-z0-9]*)\b([^>]*)>/gi)) {
        const closing = m[1] === '/';
        const attrs = m[3] ?? '';
        const selfClosing = attrs.trimEnd().endsWith('/');
        const isVoid = /^(area|base|br|col|embed|hr|img|input|link|meta|source|track|wbr)$/i.test(m[2]);
        if (isVoid || selfClosing) continue;
        if (closing) {
          depth--;
          if (open && depth < open.depth) open = null;
          continue;
        }
        depth++;
        const item = /data-ad-item="([^"]*)"/.exec(attrs);
        if (!item) continue;
        const type = item[1];
        if (open) {
          // Only container -> leaf is legal, and only one level deep.
          const legal = AD_CONTAINER_ITEMS.has(open.type) && AD_LEAF_ITEMS.has(type);
          if (!legal) {
            bad.push(`${relative(APP_BUILD, f)}: "${type}" nested inside "${open.type}"`);
            break;
          }
          continue; // leaf inside container: do not re-open, leaves hold nothing
        }
        open = { depth, type };
      }
    }
    assert.deepEqual(bad, [], `illegal data-ad-item nesting (only container -> leaf is allowed):\n  ${bad.join('\n  ')}`);
  });

  test('every data-ad-item sits inside a data-ad-region', { skip: files.length === 0 && 'no build present' }, () => {
    const bad: string[] = [];
    for (const f of files) {
      const html = readFileSync(f, 'utf8').replace(/<script\b[\s\S]*?<\/script>/gi, '');
      if (!html.includes('data-ad-item=')) continue;
      const regionAt = html.indexOf('data-ad-region=');
      if (regionAt === -1) { bad.push(`${relative(APP_BUILD, f)}: items but no region`); continue; }
      const firstItem = html.indexOf('data-ad-item=');
      if (firstItem < regionAt) bad.push(`${relative(APP_BUILD, f)}: an item precedes the region`);
    }
    assert.deepEqual(bad, [], `items outside a region:\n  ${bad.join('\n  ')}`);
  });
});
