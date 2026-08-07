// The teardown transport branch inside track()'s PostHog sink. When the
// document is already hidden (the page_view flush fires from pagehide or the
// visibilitychange-to-hidden transition), posthog-js's own unload handler has
// already drained the batch queue, so a plain capture() would enqueue behind
// a flush timer a dying page never runs. track() must pass the
// batch-bypassing options in that state and must NOT pass them otherwise.
//
// Run with:
//   node --import tsx --experimental-test-module-mocks --test <this file>

import { test, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert';

type CaptureCall = { name: string; props: unknown; options: unknown };

type W = {
  location: { pathname: string; search: string };
  innerWidth: number;
  posthog?: { capture: (n: string, p?: unknown, o?: unknown) => void };
};

type D = { cookie: string; visibilityState: 'visible' | 'hidden' };

let captureCalls: CaptureCall[];
let fakeDocument: D;

function installBrowser(): void {
  captureCalls = [];
  (globalThis as unknown as { window?: W }).window = {
    location: { pathname: '/mlb/minnesota-twins', search: '' },
    innerWidth: 1200,
    posthog: {
      capture: (name: string, props?: unknown, options?: unknown) =>
        captureCalls.push({ name, props, options }),
    },
  };
  fakeDocument = { cookie: '', visibilityState: 'visible' };
  (globalThis as unknown as { document?: D }).document = fakeDocument;
}

function removeBrowser(): void {
  delete (globalThis as unknown as { window?: W }).window;
  delete (globalThis as unknown as { document?: D }).document;
}

beforeEach(installBrowser);
afterEach(removeBrowser);

const PROPS = {
  surface: 'web_team_page',
  team_slug: 'minnesota-twins',
  game_id: 'game-1',
  is_home: false,
  has_promo: true,
  opponent_slug: 'chicago-cubs',
} as const;

test('a visible-state capture carries no transport options', async () => {
  const { track } = await import('../analytics');
  track('game_tap', PROPS);

  assert.strictEqual(captureCalls.length, 1);
  assert.strictEqual(
    captureCalls[0].options,
    undefined,
    'ordinary events keep the default batched transport',
  );
});

test('a hidden-state capture bypasses the batch with sendBeacon', async () => {
  const { track } = await import('../analytics');
  fakeDocument.visibilityState = 'hidden';
  track('game_tap', PROPS);

  assert.strictEqual(captureCalls.length, 1);
  assert.deepStrictEqual(
    captureCalls[0].options,
    { transport: 'sendBeacon', send_instantly: true },
    'teardown emits must leave the page before it dies',
  );
});
