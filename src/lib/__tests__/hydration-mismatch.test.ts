import { strict as assert } from 'node:assert';
import { readFileSync } from 'node:fs';
import { describe, it } from 'node:test';

import {
  AD_NODE_SELECTOR,
  buildHydrationMismatchSnapshot,
  isHydrationMismatchMessage,
  viewportDevice,
} from '../hydration-mismatch';

const LISTENER = 'src/instrumentation-client.ts';
const PROVIDER = 'src/components/analytics/AnalyticsProvider.tsx';

/** The exact string a production build reported, captured 2026-09-20. */
const REAL_418 =
  'Uncaught Error: Minified React error #418; visit https://react.dev/errors/418?args[]=HTML&args[]= for the full message or use the non-minified dev environment for full errors and additional helpful warnings.';

describe('isHydrationMismatchMessage', () => {
  it('matches the production #418 string, with and without the Uncaught prefix', () => {
    assert.equal(isHydrationMismatchMessage(REAL_418), true);
    assert.equal(isHydrationMismatchMessage(REAL_418.replace('Uncaught Error: ', '')), true);
  });

  it('does not match other minified React errors', () => {
    for (const n of [419, 421, 422, 423, 425, 4180, 1418]) {
      const msg = `Minified React error #${n}; visit https://react.dev/errors/${n}`;
      assert.equal(isHydrationMismatchMessage(msg), false, `#${n} must not match`);
    }
  });

  it('does not match the development wording, by design', () => {
    assert.equal(
      isHydrationMismatchMessage(
        "Hydration failed because the server rendered HTML didn't match the client.",
      ),
      false,
    );
  });

  it('is total: non-strings are false, never a throw', () => {
    for (const v of [undefined, null, 418, {}, [], new Error(REAL_418)]) {
      assert.equal(isHydrationMismatchMessage(v), false);
    }
  });
});

describe('viewportDevice', () => {
  it("uses Raptive's breakpoints, 768 and 1024", () => {
    assert.equal(viewportDevice(386), 'phone');
    assert.equal(viewportDevice(767), 'phone');
    assert.equal(viewportDevice(768), 'tablet');
    assert.equal(viewportDevice(1023), 'tablet');
    assert.equal(viewportDevice(1024), 'desktop');
    assert.equal(viewportDevice(1350), 'desktop');
  });
});

describe('buildHydrationMismatchSnapshot', () => {
  it('carries exactly the four props, with a whole non-negative offset', () => {
    const s = buildHydrationMismatchSnapshot({
      pathname: '/promos/today',
      innerWidth: 1350,
      adNodeSeen: true,
      nowMs: 816.4,
    });
    assert.deepEqual(s, {
      route: '/promos/today',
      viewport_device: 'desktop',
      adthrive_present: true,
      ms_since_navigation_start: 816,
    });
    assert.equal(
      buildHydrationMismatchSnapshot({ pathname: '/', innerWidth: 400, adNodeSeen: false, nowMs: -3 })
        .ms_since_navigation_start,
      0,
    );
  });
});

describe('AD_NODE_SELECTOR', () => {
  it('excludes <html> and <body>, where Raptive only writes a class', () => {
    assert.match(AD_NODE_SELECTOR, /:not\(html\):not\(body\)/);
    assert.match(AD_NODE_SELECTOR, /\[id\^="AdThrive_"\]/);
  });
});

/**
 * The properties that make this safe to ship are structural, so they are
 * asserted against the source. Each one is a way this instrument could start
 * causing or hiding the thing it measures.
 */
describe('the listener only listens', () => {
  const src = readFileSync(LISTENER, 'utf8');
  const code = src.replace(/\/\*[\s\S]*?\*\/|\/\/.*$/gm, '');

  it('never swallows the error', () => {
    assert.doesNotMatch(code, /preventDefault|stopPropagation|stopImmediatePropagation/);
    assert.doesNotMatch(code, /window\.onerror\s*=/);
  });

  it('is not a component: no JSX, no React import, no use client', () => {
    assert.doesNotMatch(code, /from 'react'|from "react"|use client|<\/?[A-Za-z]/);
  });

  it('keeps analytics.ts out of the main chunk with a dynamic import', () => {
    assert.match(code, /import\('@\/lib\/analytics'\)/);
    assert.doesNotMatch(code, /^import .*from '@\/lib\/analytics'/m);
  });

  it('writes nothing to the DOM', () => {
    assert.doesNotMatch(
      code,
      /appendChild|insertBefore|innerHTML|setAttribute|classList|\.style\b|createElement/,
    );
  });
});

describe('exception autocapture stays off', () => {
  it('AnalyticsProvider does not enable it', () => {
    const src = readFileSync(PROVIDER, 'utf8');
    assert.doesNotMatch(src, /capture_exceptions\s*:\s*true|autocapture_exceptions/);
  });
});
