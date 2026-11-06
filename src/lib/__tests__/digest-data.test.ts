// The digest's data layer (src/lib/digest.ts, redesign 2026-11-05): the REAL
// fetchWindowPromos join and the REAL upcomingLinks, over mocked reads. These
// are the producers the renderer trusts: the card key, image tier and theme
// come from the upcoming index matched on team, date and page slug; the
// building comes from the row's own single home game; the "Coming up" and
// "at other clubs" links are canonical-stamped and resolved through
// promoPageHref. Every read is best-effort, so a failed index or games read
// must cost the email its decoration, never the rows.
//
// Run with:
//   node --import tsx --experimental-test-module-mocks --test <this file>

import { test, mock, beforeEach } from 'node:test';
import assert from 'node:assert';
import type { Game, Promo, PromoWithTeam, Team } from '../types';
import type { IndexedPromo } from '../promo-pages';
import { promoPageHref } from '../promo-page-href';

process.env.PROMO_PAGES_LIVE = 'true';

const PANTHERS = { id: 'florida-panthers', city: 'Florida', name: 'Panthers', league: 'NHL', sportSlug: 'nhl' } as Team;
const HEAT = { id: 'miami-heat', city: 'Miami', name: 'Heat', league: 'NBA', sportSlug: 'nba' } as Team;
const TEAMS = [PANTHERS, HEAT];

let windowRows: PromoWithTeam[] = [];
let games: Game[] = [];
let index: IndexedPromo[] = [];
let indexThrows = false;
let gamesThrows = false;

mock.module('server-only', { namedExports: {} });
mock.module(new URL('../data.ts', import.meta.url).href, {
  namedExports: {
    getAllTeams: async () => TEAMS,
    getPromosInDateRange: async () => windowRows,
    getGamesInDateRange: async () => {
      if (gamesThrows) throw new Error('games down');
      return games;
    },
  },
});
mock.module(new URL('../promo-pages.ts', import.meta.url).href, {
  namedExports: {
    getUpcomingPromoIndex: async () => {
      if (indexThrows) throw new Error('index down');
      return index;
    },
  },
});

function row(team: Team, date: string, title: string, pageSlug: string | null, over: Partial<Promo> = {}): PromoWithTeam {
  const p = {
    date, title, type: 'theme', time: '7:30 PM', opponent: 'Bruins', description: '', highlight: false,
    icon: '', recurring: false, displayTime: '7:30 PM', displayOpponent: 'Bruins', ...over,
  } as PromoWithTeam;
  if (pageSlug) p.pageSlug = pageSlug;
  p.team = team;
  return p;
}
function idx(team: Team, date: string, title: string, pageSlug: string, over: Partial<IndexedPromo> = {}): IndexedPromo {
  return {
    teamId: team.id, promoId: `id-${pageSlug}-${date}`, date, title, type: 'theme', pageSlug, pageSeason: '2026-27',
    themeKey: null, imageTier: 3, updatedAt: '2026-11-01T00:00:00.000Z', ticketPackage: false, ...over,
  };
}
function game(team: Team, date: string, venueName: string, n = 1): Game {
  return { league: team.sportSlug, date, homeTeamSlug: team.id, awayTeamSlug: 'boston-bruins', venueName, status: 'scheduled', doubleheaderGame: n > 1 ? n : undefined } as unknown as Game;
}

beforeEach(() => {
  windowRows = [];
  games = [];
  index = [];
  indexThrows = false;
  gamesThrows = false;
});

// ── fetchWindowPromos ───────────────────────────────────────────────────────

test('a row matched in the index on team, date and slug carries its card key, tier and theme', async () => {
  const { fetchWindowPromos } = await import('../digest');
  windowRows = [row(PANTHERS, '2026-11-04', 'Star Wars Night', 'star-wars-night')];
  index = [idx(PANTHERS, '2026-11-04', 'Star Wars Night', 'star-wars-night', { imageTier: 1, themeKey: 'star-wars', promoId: 'abc123' })];
  const [p] = await fetchWindowPromos('2026-11-03', '2026-11-09');
  assert.strictEqual(p.hasPage, true);
  assert.strictEqual(p.href, promoPageHref(windowRows[0]));
  assert.strictEqual(p.promoId, 'abc123');
  assert.strictEqual(p.imageTier, 1);
  assert.strictEqual(p.themeKey, 'star-wars');
  assert.strictEqual(p.pageSlug, 'star-wars-night');
});

test('the join does not cross teams, dates or slugs', async () => {
  const { fetchWindowPromos } = await import('../digest');
  windowRows = [row(PANTHERS, '2026-11-04', 'Star Wars Night', 'star-wars-night')];
  index = [
    idx(HEAT, '2026-11-04', 'Star Wars Night', 'star-wars-night', { imageTier: 1 }),
    idx(PANTHERS, '2026-11-05', 'Star Wars Night', 'star-wars-night', { imageTier: 1 }),
    idx(PANTHERS, '2026-11-04', 'Other', 'other-night', { imageTier: 1 }),
  ];
  const [p] = await fetchWindowPromos('2026-11-03', '2026-11-09');
  assert.strictEqual(p.promoId, null);
  assert.strictEqual(p.imageTier, null);
});

test('a row with no page gets no card fields and links to its team page', async () => {
  const { fetchWindowPromos } = await import('../digest');
  windowRows = [row(PANTHERS, '2026-11-04', 'Pageless', null)];
  index = [];
  const [p] = await fetchWindowPromos('2026-11-03', '2026-11-09');
  assert.strictEqual(p.hasPage, false);
  assert.strictEqual(p.href, '/nhl/florida-panthers');
  assert.strictEqual(p.promoId, null);
  assert.strictEqual(p.pageSlug, null);
});

test('the building comes from the one home game that day, never a doubleheader guess', async () => {
  const { fetchWindowPromos } = await import('../digest');
  windowRows = [row(PANTHERS, '2026-11-04', 'A', 'a'), row(HEAT, '2026-11-06', 'B', 'b'), row(PANTHERS, '2026-11-08', 'C', 'c')];
  games = [game(PANTHERS, '2026-11-04', 'Amerant Bank Arena'), game(HEAT, '2026-11-06', 'Kaseya Center', 1), game(HEAT, '2026-11-06', 'Kaseya Center', 2)];
  const out = await fetchWindowPromos('2026-11-03', '2026-11-09');
  assert.deepStrictEqual(out.map((p) => p.venueName), ['Amerant Bank Arena', null, null]);
});

test('quantity reads the cap, then while-supplies-last', async () => {
  const { fetchWindowPromos } = await import('../digest');
  windowRows = [
    row(PANTHERS, '2026-11-04', 'A', 'a', { attendanceCap: 10000 }),
    row(PANTHERS, '2026-11-05', 'B', 'b', { whileSuppliesLast: true }),
    row(PANTHERS, '2026-11-06', 'C', 'c'),
  ];
  const out = await fetchWindowPromos('2026-11-03', '2026-11-09');
  assert.deepStrictEqual(out.map((p) => p.quantity), ['First 10,000 fans', 'While supplies last', null]);
});

test('failed index and games reads cost the decoration, never the rows', async () => {
  const { fetchWindowPromos } = await import('../digest');
  windowRows = [row(PANTHERS, '2026-11-04', 'A', 'a')];
  index = [idx(PANTHERS, '2026-11-04', 'A', 'a', { imageTier: 1 })];
  games = [game(PANTHERS, '2026-11-04', 'Amerant Bank Arena')];
  indexThrows = true;
  gamesThrows = true;
  const out = await fetchWindowPromos('2026-11-03', '2026-11-09');
  assert.strictEqual(out.length, 1);
  assert.strictEqual(out[0].title, 'A');
  assert.strictEqual(out[0].hasPage, true, 'the page link does not depend on the index');
  assert.strictEqual(out[0].promoId, null);
  assert.strictEqual(out[0].venueName, null);
});

// ── upcomingLinks / fetchDigestContext ──────────────────────────────────────

test('upcoming links are canonical-stamped: a loser links to its winner and twins collapse', async () => {
  const { upcomingLinks } = await import('../digest');
  const teams = new Map(TEAMS.map((t) => [t.id, t]));
  // Same team, same date: a tier 1 giveaway beats the theme row (canonicalGroups).
  const theme = idx(PANTHERS, '2026-11-20', 'Star Wars Night', 'star-wars-night', { type: 'theme' });
  const give = idx(PANTHERS, '2026-11-20', 'Star Wars Night Bobblehead', 'star-wars-night-bobblehead', { type: 'giveaway', imageTier: 1 });
  const out = upcomingLinks([theme, give], teams);
  // The theme row is the canonical loser: its page points at the giveaway's,
  // so the pair is ONE link, to the winner, never two links to one game.
  assert.deepStrictEqual(out.map((u) => u.href), ['/nhl/florida-panthers/promos/star-wars-night-bobblehead']);
  assert.strictEqual(out[0].pageSlug, 'star-wars-night-bobblehead', 'subId3 uses the page the link lands on');
});

test('upcoming links leave out special-ticket rows, unknown teams and sort by date', async () => {
  const { upcomingLinks } = await import('../digest');
  const teams = new Map(TEAMS.map((t) => [t.id, t]));
  const out = upcomingLinks([
    idx(HEAT, '2026-12-01', 'Late', 'late'),
    idx(PANTHERS, '2026-11-15', 'Package', 'package', { ticketPackage: true }),
    { ...idx(PANTHERS, '2026-11-10', 'Ghost', 'ghost'), teamId: 'no-such-team' },
    idx(PANTHERS, '2026-11-12', 'Early', 'early'),
  ], teams);
  assert.deepStrictEqual(out.map((u) => u.title), ['Early', 'Late']);
  assert.deepStrictEqual(out.map((u) => u.href), ['/nhl/florida-panthers/promos/early', '/nba/miami-heat/promos/late']);
});

test('fetchDigestContext: names every team and survives a failed index read', async () => {
  const { fetchDigestContext } = await import('../digest');
  index = [idx(PANTHERS, '2026-11-12', 'Military Appreciation Night', 'military-appreciation-night')];
  windowRows = [
    row(PANTHERS, '2026-11-04', 'Star Wars Night', 'star-wars-night'),
    row(PANTHERS, '2026-11-04', 'Star Wars Bobblehead', 'star-wars-bobblehead', { type: 'giveaway' }),
    row(HEAT, '2026-11-06', 'Heat Night', 'heat-night'),
  ];
  const ok = await fetchDigestContext({ start: '2026-11-03', end: '2026-11-09' }, await (await import('../digest')).fetchWindowPromos('2026-11-03', '2026-11-09'));
  assert.strictEqual(ok.windowEntries, 2, 'one entry per team per date');
  assert.strictEqual(ok.windowGiveawayEntries, 1);
  assert.strictEqual(ok.teams.get('florida-panthers')?.name, 'Florida Panthers');
  assert.strictEqual(ok.teams.get('florida-panthers')?.short, 'Panthers');
  assert.deepStrictEqual(ok.upcoming.map((u) => u.href), ['/nhl/florida-panthers/promos/military-appreciation-night']);
  indexThrows = true;
  const down = await fetchDigestContext({ start: '2026-11-03', end: '2026-11-09' }, []);
  assert.deepStrictEqual(down.upcoming, []);
  assert.strictEqual(down.teams.size, 2);
});
