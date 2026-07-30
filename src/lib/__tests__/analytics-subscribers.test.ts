// The analytics subscriber registry, which is how the capture trigger observes
// engagement without a single call-site edit.
//
// Two properties matter more than the happy path. It must be CLIENT ONLY, so a
// subscriber can never run during SSR and can never cause a hydration
// divergence. And a subscriber must be ISOLATED, because an observer that can
// throw its way into the analytics pipeline would break the reporting it exists
// to read.
//
// Run with:
//   node --import tsx --experimental-test-module-mocks --test <this file>

import { test, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert';

// analytics.ts is client-usable and imports no server-only module, so nothing
// needs mocking here. Only the browser globals track() reads are stubbed.

type W = { location: { pathname: string; search: string }; innerWidth: number };

function installBrowser(): void {
  (globalThis as unknown as { window?: W }).window = {
    location: { pathname: '/mlb/minnesota-twins', search: '' },
    innerWidth: 1200,
  };
  (globalThis as unknown as { document?: { cookie: string } }).document = { cookie: '' };
}

function removeBrowser(): void {
  delete (globalThis as unknown as { window?: W }).window;
  delete (globalThis as unknown as { document?: { cookie: string } }).document;
}

beforeEach(installBrowser);
afterEach(removeBrowser);

test('a subscriber receives every tracked event with its enriched props', async () => {
  const { track, subscribeToAnalytics } = await import('../analytics');
  const seen: Array<{ name: string; props: Record<string, unknown> }> = [];
  const off = subscribeToAnalytics((name, props) => seen.push({ name, props }));

  track('game_tap', {
    surface: 'web_team_page',
    team_slug: 'minnesota-twins',
    game_id: 'game-1',
    is_home: false,
    has_promo: true,
    opponent_slug: 'chicago-cubs',
  });

  assert.strictEqual(seen.length, 1);
  assert.strictEqual(seen[0].name, 'game_tap');
  assert.strictEqual(seen[0].props.game_id, 'game-1', 'the trigger needs game_id for dedupe');
  assert.strictEqual(seen[0].props.page_path, '/mlb/minnesota-twins', 'enrichment is included');
  off();
});

test('unsubscribe stops delivery', async () => {
  const { track, subscribeToAnalytics } = await import('../analytics');
  let count = 0;
  const off = subscribeToAnalytics(() => {
    count += 1;
  });

  track('promo_card_tap', {
    surface: 'web_team_page',
    promo_id: 'p1',
    team_slug: 'minnesota-twins',
    promo_type: 'bobblehead',
  });
  assert.strictEqual(count, 1);

  off();
  track('promo_card_tap', {
    surface: 'web_team_page',
    promo_id: 'p2',
    team_slug: 'minnesota-twins',
    promo_type: 'bobblehead',
  });
  assert.strictEqual(count, 1, 'no delivery after unsubscribe');
});

test('a throwing subscriber does not stop the others and does not break track()', async () => {
  const { track, subscribeToAnalytics } = await import('../analytics');
  let reached = 0;
  const offBad = subscribeToAnalytics(() => {
    throw new Error('observer blew up');
  });
  const offGood = subscribeToAnalytics(() => {
    reached += 1;
  });

  assert.doesNotThrow(() =>
    track('away_game_expanded', {
      surface: 'web_team_page',
      team_slug: 'minnesota-twins',
      game_id: 'g1',
      opponent_slug: 'chicago-cubs',
      has_promo: false,
    }),
  );
  assert.strictEqual(reached, 1, 'the healthy subscriber still ran');

  offBad();
  offGood();
});

test('nothing is delivered during SSR, so a subscriber cannot cause hydration drift', async () => {
  const { track, subscribeToAnalytics } = await import('../analytics');
  let count = 0;
  const off = subscribeToAnalytics(() => {
    count += 1;
  });

  removeBrowser(); // simulate the server
  track('game_tap', {
    surface: 'web_team_page',
    team_slug: 'minnesota-twins',
    game_id: 'g1',
    is_home: true,
    has_promo: false,
    opponent_slug: 'chicago-cubs',
  });

  assert.strictEqual(count, 0, 'track() early-returns before notifying');
  installBrowser();
  off();
});

test('multiple subscribers all receive the same event', async () => {
  const { track, subscribeToAnalytics } = await import('../analytics');
  const hits: string[] = [];
  const a = subscribeToAnalytics(() => hits.push('a'));
  const b = subscribeToAnalytics(() => hits.push('b'));

  track('promo_card_tap', {
    surface: 'web_team_page',
    promo_id: 'p1',
    team_slug: 'minnesota-twins',
    promo_type: 'bobblehead',
  });

  assert.deepStrictEqual(hits.sort(), ['a', 'b']);
  a();
  b();
});
