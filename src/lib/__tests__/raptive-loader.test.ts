import { strict as assert } from 'node:assert';
import { readFileSync } from 'node:fs';
import { describe, it } from 'node:test';

const LAYOUT = 'src/app/layout.tsx';
const LOADER = 'src/components/ads/RaptiveLoader.tsx';

const stripComments = (src: string) =>
  src.replace(/\{\/\*[\s\S]*?\*\/\}|\/\*[\s\S]*?\*\/|^\s*\/\/.*$/gm, '');

/**
 * Known-issues entry 50. The ads.min.js loader was moved out of <head> and into
 * an effect because loading it before hydration let Raptive insert into DOM
 * React had not hydrated, and React rebuilt <main> without the ads. Every
 * assertion here is a way someone "tidying up" could quietly put the race back
 * or break what Raptive requires of the tag.
 */
describe('the head keeps only the Raptive stub', () => {
  const layout = readFileSync(LAYOUT, 'utf8');
  const code = stripComments(layout);

  it("keeps Raptive's four assignments, byte for byte", () => {
    for (const line of [
      '    w.adthrive = w.adthrive || {};',
      '    w.adthrive.cmd = w.adthrive.cmd || [];',
      "    w.adthrive.plugin = 'adthrive-ads-manual';",
      "    w.adthrive.host = 'ads.adthrive.com';",
    ]) {
      assert.equal(layout.split(line).length - 1, 1, `stub line missing or duplicated: ${line}`);
    }
    assert.match(layout, /\(function\(w, d\) \{\n/);
    assert.match(layout, /\}\)\(window, document\);`/);
  });

  it('keeps data-no-optimize and data-cfasync on the inline stub', () => {
    assert.match(code, /<script\s+data-no-optimize="1"\s+data-cfasync="false"/);
  });

  it('does not create the ads.min.js script from the head', () => {
    assert.doesNotMatch(code, /ads\.min\.js/, 'the loader is back in layout.tsx');
    assert.doesNotMatch(code, /createElement\('script'\)/);
  });

  it('mounts the loader exactly once, in the root layout', () => {
    assert.equal(code.split('<RaptiveLoader />').length - 1, 1);
  });
});

describe('the loader', () => {
  const src = readFileSync(LOADER, 'utf8');
  const code = stripComments(src);

  it('runs from an effect with no dependencies, and renders nothing', () => {
    assert.match(code, /'use client'/);
    assert.match(code, /useEffect\(\(\) => \{[\s\S]*\}, \[\]\);/);
    assert.match(code, /return null;/);
    assert.doesNotMatch(code, /useLayoutEffect/, 'a layout effect runs before paint, inside the commit');
  });

  it('cannot load the script twice: the flag is checked and set before any work', () => {
    const body = code.slice(code.indexOf('useEffect'));
    const check = body.indexOf('if (w.__pnRaptiveLoaderRan) return;');
    const set = body.indexOf('w.__pnRaptiveLoaderRan = true;');
    const create = body.indexOf("createElement('script')");
    assert.ok(check > -1 && set > check && create > set, 'guard must precede script creation');
  });

  it("builds the element the way Raptive's snippet did", () => {
    assert.match(code, /s\.async = true;/);
    assert.match(code, /referrerpolicy\s*=\s*'no-referrer-when-downgrade'/);
    assert.match(code, /'\/sites\/6a9989924f70265a058c50b1\/ads\.min\.js\?referrer=' \+/);
    assert.match(code, /w\.encodeURIComponent\(w\.location\.href\)/);
    assert.match(code, /'&cb=' \+\s*\(Math\.floor\(Math\.random\(\) \* 100\) \+ 1\)/);
    assert.match(code, /getElementsByTagName\('script'\)\[0\]/);
    assert.match(code, /insertBefore\(s, n\)/);
  });

  it('carries the optimizer opt-outs on the created element', () => {
    assert.match(code, /setAttribute\('data-no-optimize', '1'\)/);
    assert.match(code, /setAttribute\('data-cfasync', 'false'\)/);
  });

  it('never throws out of the effect', () => {
    assert.match(code, /try \{[\s\S]*\} catch \{/);
  });

  it('does not wait on any particular component', () => {
    assert.doesNotMatch(code, /querySelector|MutationObserver|requestIdleCallback|setTimeout|addEventListener/);
  });
});
