// The GA4 payload split inside track(): the first-party attribution triplet
// (source / source_medium / source_campaign) must reach PostHog and the
// subscriber registry but must NEVER reach GA4, where an event parameter
// named `source` overrides native session attribution (the www.google.com /
// bare-direct pollution this split removes).
//
// Run with:
//   node --import tsx --experimental-test-module-mocks --test <this file>

import { test, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert';

type GtagCall = { args: unknown[] };
type CaptureCall = { name: string; props: Record<string, unknown> };

type W = {
  location: { pathname: string; search: string };
  innerWidth: number;
  gtag?: (...args: unknown[]) => void;
  posthog?: { capture: (name: string, props?: unknown) => void };
};

let gtagCalls: GtagCall[];
let captureCalls: CaptureCall[];

const ATTRIBUTION_COOKIE = encodeURIComponent(
  JSON.stringify({
    source: 'www.google.com',
    source_medium: 'organic',
    source_campaign: null,
    landed_at: '2026-08-01T00:00:00.000Z',
    landing_page: '/',
  }),
);

function installBrowser(): void {
  gtagCalls = [];
  captureCalls = [];
  (globalThis as unknown as { window?: W }).window = {
    location: { pathname: '/mlb/minnesota-twins', search: '' },
    innerWidth: 1200,
    gtag: (...args: unknown[]) => gtagCalls.push({ args }),
    posthog: {
      capture: (name: string, props?: unknown) =>
        captureCalls.push({ name, props: props as Record<string, unknown> }),
    },
  };
  (globalThis as unknown as { document?: { cookie: string } }).document = {
    cookie: `pn_attribution=${ATTRIBUTION_COOKIE}`,
  };
}

function removeBrowser(): void {
  delete (globalThis as unknown as { window?: W }).window;
  delete (globalThis as unknown as { document?: { cookie: string } }).document;
}

beforeEach(installBrowser);
afterEach(removeBrowser);

test('PostHog receives the attribution triplet; GA4 does not', async () => {
  const { track } = await import('../analytics');

  track('game_tap', {
    surface: 'web_team_page',
    team_slug: 'minnesota-twins',
    game_id: 'game-1',
    is_home: false,
    has_promo: true,
    opponent_slug: 'chicago-cubs',
  });

  assert.strictEqual(captureCalls.length, 1);
  const ph = captureCalls[0].props;
  assert.strictEqual(ph.source, 'www.google.com', 'PostHog keeps source');
  assert.strictEqual(ph.source_medium, 'organic', 'PostHog keeps source_medium');
  assert.strictEqual(ph.source_campaign, null, 'PostHog keeps source_campaign');

  assert.strictEqual(gtagCalls.length, 1);
  const [command, eventName, ga4] = gtagCalls[0].args as [
    string,
    string,
    Record<string, unknown>,
  ];
  assert.strictEqual(command, 'event');
  assert.strictEqual(eventName, 'game_tap');
  assert.ok(!('source' in ga4), 'GA4 payload must not carry source');
  assert.ok(!('source_medium' in ga4), 'GA4 payload must not carry source_medium');
  assert.ok(!('source_campaign' in ga4), 'GA4 payload must not carry source_campaign');
});

test('GA4 keeps every non-attribution key, byte-identical to the PostHog payload', async () => {
  const { track } = await import('../analytics');

  track('game_tap', {
    surface: 'web_team_page',
    team_slug: 'minnesota-twins',
    game_id: 'game-2',
    is_home: true,
    has_promo: false,
    opponent_slug: 'chicago-cubs',
  });

  const ph = captureCalls[0].props;
  const ga4 = gtagCalls[0].args[2] as Record<string, unknown>;
  const { source, source_medium, source_campaign, ...phWithoutTriplet } = ph;
  void source;
  void source_medium;
  void source_campaign;
  assert.deepStrictEqual(
    ga4,
    phWithoutTriplet,
    'the split removes the triplet and nothing else',
  );
  assert.strictEqual(ga4.page_path, '/mlb/minnesota-twins', 'enrichment survives');
  assert.strictEqual(ga4.device_class, 'desktop', 'enrichment survives');
});

test('a null cookie read no longer ships anything source-shaped to GA4', async () => {
  // gtag.js coerces a null param value to an empty string and still sends it,
  // which is where the empty-string session_medium buckets came from. With no
  // cookie the triplet is all null; the split must remove the keys entirely
  // rather than let them ride to GA4 as nulls.
  (globalThis as unknown as { document: { cookie: string } }).document.cookie = '';
  const { track } = await import('../analytics');

  track('game_tap', {
    surface: 'web_team_page',
    team_slug: 'minnesota-twins',
    game_id: 'game-3',
    is_home: false,
    has_promo: true,
    opponent_slug: 'chicago-cubs',
  });

  const ph = captureCalls[0].props;
  assert.strictEqual(ph.source, null, 'PostHog still records the null honestly');
  const ga4 = gtagCalls[0].args[2] as Record<string, unknown>;
  assert.ok(!('source' in ga4));
  assert.ok(!('source_medium' in ga4));
  assert.ok(!('source_campaign' in ga4));
});

test('subscribers still receive the full enriched payload including the triplet', async () => {
  const { track, subscribeToAnalytics } = await import('../analytics');
  const seen: Array<Record<string, unknown>> = [];
  const off = subscribeToAnalytics((_name, props) => seen.push(props));

  track('game_tap', {
    surface: 'web_team_page',
    team_slug: 'minnesota-twins',
    game_id: 'game-4',
    is_home: false,
    has_promo: true,
    opponent_slug: 'chicago-cubs',
  });

  assert.strictEqual(seen.length, 1);
  assert.strictEqual(seen[0].source, 'www.google.com', 'subscribers keep the triplet');
  assert.strictEqual(seen[0].game_id, 'game-4');
  off();
});
