// The team-page away-row Fubo block, mounted in a real DOM (FuboTrayCTA):
// absent from the server render, present after hydration with no mismatch,
// under the ticket card and above parking, and gone for a played game, a home
// row, the homepage modal's surface, an NFL game on Prime, and MLB.
//
// Harness: happy-dom as the global DOM (the promo-row-click harness), React's
// act(). Run on its own with
//   TSX_TSCONFIG_PATH=tsconfig.test.json node --import tsx \
//     --experimental-test-module-mocks --test <this file>
import { GlobalRegistrator } from '@happy-dom/global-registrator';
import { test, mock, after } from 'node:test';
import assert from 'node:assert/strict';
import type { ReactElement } from 'react';
import type { GameContext } from '@/lib/data';
import type { Game, Team } from '@/lib/types';

GlobalRegistrator.register({ url: 'https://www.getpromonight.com/nfl/buffalo-bills', width: 390, height: 844 });
(globalThis as Record<string, unknown>).IS_REACT_ACT_ENVIRONMENT = true;
// The clock the played check reads: the fixtures' week.
mock.timers.enable({ apis: ['Date'], now: new Date('2026-11-20T17:00:00Z') });
mock.module('server-only', { namedExports: {} });

const mk = (id: string, league: string, city: string, name: string): Team =>
  ({ id, league, city, name, abbreviation: name.slice(0, 3).toUpperCase(), primaryColor: '#123456', secondaryColor: '#654321', sportSlug: league.toLowerCase(), division: 'Test' }) as Team;
const RAVENS = mk('baltimore-ravens', 'NFL', 'Baltimore', 'Ravens');
const BILLS = mk('buffalo-bills', 'NFL', 'Buffalo', 'Bills');
const WILD = mk('minnesota-wild', 'NHL', 'Minnesota', 'Wild');
const HAWKS = mk('chicago-blackhawks', 'NHL', 'Chicago', 'Blackhawks');
const TWINS = mk('minnesota-twins', 'MLB', 'Minnesota', 'Twins');
const SOX = mk('chicago-white-sox', 'MLB', 'Chicago', 'White Sox');

const game = (over: Partial<Game> = {}): Game =>
  ({ id: 'nfl-2026-11-22-buffalo-bills-at-baltimore-ravens', league: 'nfl', date: '2026-11-22', gameTime: '18:00', gameTimeTz: 'America/New_York', homeTeamSlug: RAVENS.id, awayTeamSlug: BILLS.id, venueName: 'M&T Bank Stadium', status: 'scheduled', ...over }) as Game;
const ctx = (g: Game, isHome: boolean, opponentTeam: Team): GameContext => ({ game: g, isHome, opponentTeam, opponentVenue: null, promos: [] });

const roots: Array<{ unmount: () => void }> = [];
async function row(c: GameContext, team: Team, surface?: 'web_team_page' | 'web_team_page_promolist' | 'web_home_tonight'): Promise<ReactElement> {
  const { GameExpand } = await import('../../redesign/GameExpand');
  return <GameExpand dateStr={c.game.date} contexts={[c]} team={team} teamSlug={team.id} teamName={team.name} surface={surface} />;
}
async function mount(ui: ReactElement): Promise<HTMLElement> {
  const { createRoot } = await import('react-dom/client');
  const { act } = await import('react');
  const container = document.createElement('div');
  document.body.appendChild(container);
  const root = createRoot(container);
  await act(async () => root.render(ui));
  roots.push(root);
  return container;
}
const fuboHrefs = (el: Element) => [...el.querySelectorAll('[data-fubo-cta] a')].map((a) => a.getAttribute('href'));
after(async () => {
  const { act } = await import('react');
  await act(async () => roots.forEach((r) => r.unmount()));
  await GlobalRegistrator.unregister();
});

test('server render has no Fubo; hydration adds it with no mismatch (CalendarGrid prerender path)', async () => {
  const { renderToString } = await import('react-dom/server');
  const { hydrateRoot } = await import('react-dom/client');
  const { act } = await import('react');
  const ui = await row(ctx(game(), false, RAVENS), BILLS);
  const html = renderToString(ui);
  assert.ok(!html.includes('data-fubo-cta'), 'not in the server render');
  const container = document.createElement('div');
  container.innerHTML = html;
  document.body.appendChild(container);
  const errors: unknown[] = [];
  const origError = console.error;
  // Node prints its module-mocking ExperimentalWarning through console.error; that one line is not React's.
  console.error = (...a: unknown[]) => void (String(a[0]).includes('ExperimentalWarning') ? null : errors.push(a));
  try {
    await act(async () => {
      roots.push(hydrateRoot(container, ui, { onRecoverableError: (e) => void errors.push(e) }));
    });
  } finally {
    console.error = origError;
  }
  assert.deepEqual(errors, [], 'no hydration error');
  assert.deepEqual(fuboHrefs(container), ['/go/fubo/nfl/nfl-2026-11-22-buffalo-bills-at-baltimore-ravens?s=web_team_page&t=buffalo-bills']);
});

test('mounted: under the ticket card, above parking, with its eyebrow and availability line', async () => {
  const el = await mount(await row(ctx(game(), false, RAVENS), BILLS));
  const html = el.innerHTML;
  const tickets = html.indexOf('TicketNetwork Get Tickets');
  const fubo = html.indexOf('data-fubo-cta');
  assert.ok(tickets > 0 && tickets < fubo, 'below the ticket card');
  const parking = html.search(/SpotHero|[Pp]arking/);
  assert.ok(parking < 0 || fubo < parking, 'above parking');
  const block = el.querySelector('[data-fubo-cta]')!;
  assert.match(block.textContent ?? '', /^Stream the gameStream on Fubo→Availability varies by market\.$/);
  assert.equal(block.querySelectorAll('svg, img, picture').length, 0, 'text only');
  const modal = await mount(await row(ctx(game(), false, RAVENS), BILLS, 'web_team_page_promolist'));
  assert.deepEqual(fuboHrefs(modal), ['/go/fubo/nfl/nfl-2026-11-22-buffalo-bills-at-baltimore-ravens?s=web_team_page_promolist&t=buffalo-bills']);
});

test('mounted: nothing on a home row, the homepage surface, a played game (status still "scheduled"), a completed game, Prime, or MLB; tonight counts', async () => {
  const none = async (ui: Promise<ReactElement>, why: string) => assert.equal(fuboHrefs(await mount(await ui)).length, 0, why);
  await none(row(ctx(game(), true, BILLS), RAVENS), 'home row');
  await none(row(ctx(game(), false, RAVENS), BILLS, 'web_home_tonight'), 'homepage modal');
  await none(row(ctx(game({ id: 'nhl-p', league: 'nhl', date: '2026-11-12', gameTimeTz: 'America/Chicago', homeTeamSlug: HAWKS.id, awayTeamSlug: WILD.id }), false, HAWKS), WILD), 'played, still scheduled');
  await none(row(ctx(game({ status: 'completed' }), false, RAVENS), BILLS), 'completed');
  await none(row(ctx(game({ broadcast: { network: 'Prime Video', isPrimetime: true } }), false, RAVENS), BILLS), 'Prime');
  await none(row(ctx(game({ id: 'mlb-x', league: 'mlb', homeTeamSlug: SOX.id, awayTeamSlug: TWINS.id }), false, SOX), TWINS), 'MLB');
  const tonight = await mount(await row(ctx(game({ id: '2026020201', league: 'nhl', date: '2026-11-20', gameTimeTz: 'America/Chicago', homeTeamSlug: HAWKS.id, awayTeamSlug: WILD.id }), false, HAWKS), WILD));
  assert.deepEqual(fuboHrefs(tonight), ['/go/fubo/nhl/2026020201?s=web_team_page&t=minnesota-wild']);
});
