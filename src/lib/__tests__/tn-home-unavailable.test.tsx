// Clubs whose home building TicketNetwork lists no events for (Matt
// 2026-11-03: Maple Leafs, Raptors, Senators). One stored flag,
// tnTeamMap/{id}.tnHomeUnavailable, drives it:
//  1. loadTeams copies the flag onto the Team, and nothing else from the
//     mapping; an unflagged club carries no key; a failed mapping read flags
//     no club and still loads every team.
//  2. ticketNetworkForGame keys on the game's HOME club: a flagged club's
//     home game drops TicketNetwork, its away game at a US building keeps it,
//     another club's game at a flagged building drops it, a neutral-site game
//     keeps it.
//  3. The team-page game cards (GameExpand, GameDayDetail) follow it: the
//     Ticketmaster button stays, unchanged, and the TicketNetwork button goes.
//  4. Team-level CTAs (hero, sidebar) are Ticketmaster only for a flagged club
//     (Matt 2026-11-03); the call-site guard test holds every site to it.
//
// Run with: TSX_TSCONFIG_PATH=tsconfig.test.json node --import tsx --experimental-test-module-mocks --test src/lib/__tests__/tn-home-unavailable.test.tsx
import { test, mock } from 'node:test';
import assert from 'node:assert/strict';
import { renderToStaticMarkup } from 'react-dom/server';
import type { Game, Team } from '../types';
import type { GameContext } from '../data';

type Data = Record<string, unknown>;
const teamDocs: [string, Data][] = [
  ['toronto-maple-leafs', { league: 'NHL', city: 'Toronto', name: 'Maple Leafs', sportSlug: 'nhl', abbreviation: 'TOR', primaryColor: 1, secondaryColor: 2, division: 'Atlantic' }],
  ['boston-bruins', { league: 'NHL', city: 'Boston', name: 'Bruins', sportSlug: 'nhl', abbreviation: 'BOS', primaryColor: 1, secondaryColor: 2, division: 'Atlantic' }],
  ['ottawa-senators', { league: 'NHL', city: 'Ottawa', name: 'Senators', sportSlug: 'nhl', abbreviation: 'OTT', primaryColor: 1, secondaryColor: 2, division: 'Atlantic' }],
];
let mapDocs: [string, Data][] = [];
let mapReadFails = false;
const mapReads: string[] = [];
const snap = (rows: [string, Data][]) => ({ docs: rows.map(([id, d]) => ({ id, exists: true, data: () => d, get: (f: string) => d[f] })) });
const fakeDb = {
  collection(name: string): any {
    if (name === 'teams') return { get: async () => snap(teamDocs) };
    if (name === 'tnTeamMap') {
      return {
        where(field: string, op: string, value: unknown) {
          mapReads.push(`${field} ${op} ${String(value)}`);
          return {
            get: async () => {
              if (mapReadFails) throw new Error('UNAVAILABLE');
              return snap(mapDocs.filter(([, d]) => op === '==' && d[field] === value));
            },
          };
        },
        get: async () => { throw new Error('the whole mapping must not be read'); },
      };
    }
    throw new Error(`unexpected collection ${name}`);
  },
};
mock.module('server-only', { namedExports: {} });
mock.module(new URL('../firebase.ts', import.meta.url).href, { namedExports: { db: fakeDb } });
mock.timers.enable({ apis: ['Date'], now: new Date('2026-11-03T16:00:00Z') });
const quiet = mock.method(console, 'error', () => {});

const PREFIX = 'https://ticketnetwork.lusg.net/c/7236189/120057/2322';
const tnHrefs = (html: string) => [...html.matchAll(/href="([^"]+)"/g)].map((m) => m[1].replace(/&amp;/g, '&')).filter((h) => h.startsWith(PREFIX));
const tmHrefs = (html: string) => [...html.matchAll(/href="([^"]+)"/g)].map((m) => m[1].replace(/&amp;/g, '&')).filter((h) => /ticketmaster|impact|sjv\.io|tm7559/.test(h) && !h.startsWith(PREFIX));

test('loadTeams: the flag rides on flagged clubs only, nothing else from the mapping, one equality read', async () => {
  mapDocs = [
    ['toronto-maple-leafs', { tnHomeUnavailable: true, performerId: 1078, homeVenuePath: '/performers/x', status: 'unmapped' }],
    ['ottawa-senators', { tnHomeUnavailable: 'true', performerId: 780 }], // not the boolean: not flagged
    ['boston-bruins', { tnHomeUnavailable: false, performerId: 1, homeVenuePath: '/performers/b' }],
  ];
  const { getAllTeams, getTeamBySlug } = await import('../data');
  const teams = await getAllTeams();
  const leafs = teams.find((t) => t.id === 'toronto-maple-leafs')!;
  assert.equal(leafs.tnHomeUnavailable, true);
  for (const id of ['boston-bruins', 'ottawa-senators']) {
    const t = teams.find((x) => x.id === id)!;
    assert.equal('tnHomeUnavailable' in t, false, `${id} carries no key`);
  }
  for (const t of teams) {
    for (const k of ['performerId', 'homeVenuePath', 'status']) assert.equal(k in t, false, `${t.id} carries no mapping field ${k}`);
  }
  assert.equal((await getTeamBySlug('toronto-maple-leafs'))?.tnHomeUnavailable, true);
  assert.deepEqual(mapReads, ['tnHomeUnavailable == true']);
});

test('loadTeams: a failed mapping read keeps the last good flags, after one retry', async () => {
  mapReadFails = true;
  mapReads.length = 0;
  mock.timers.tick(6 * 60 * 1000); // past the 5-minute collection TTL
  const { getAllTeams } = await import('../data');
  const teams = await getAllTeams();
  assert.equal(teams.length, 3);
  assert.equal(teams.find((t) => t.id === 'toronto-maple-leafs')?.tnHomeUnavailable, true, 'the last good set');
  assert.equal(mapReads.length, 2, 'read, then one retry');
  assert.ok(quiet.mock.calls.some((c) => String(c.arguments[0]).includes('last good set')), 'the failure is logged');
  mapReadFails = false;
});

// The cold-process case (no good set yet) is tn-home-unavailable-cold.test.ts.

const team = (id: string, flagged = false): Team =>
  ({ id, name: id, city: id, league: 'NHL', sportSlug: 'nhl', abbreviation: 'X', primaryColor: '#000', secondaryColor: '#fff', division: 'A', ticketmasterSlug: id, ticketmasterAttractionId: '805974', ...(flagged ? { tnHomeUnavailable: true } : {}) }) as unknown as Team;
const LEAFS = team('toronto-maple-leafs', true);
const BRUINS = team('boston-bruins');
const EVENT = 'https://www.ticketnetwork.com/tickets/8138001/toronto-maple-leafs-at-boston-bruins-tickets-sat-nov-21-2026-td-garden';
const game = (home: string, away: string, over: Partial<Game> = {}): Game =>
  ({ id: `${home}-${away}`, league: 'nhl', date: '2026-11-21', gameTime: '00:00', gameTimeTz: 'America/New_York', homeTeamSlug: home, awayTeamSlug: away, venueName: 'Arena', status: 'scheduled', ...over }) as Game;
const ctx = (g: Game, isHome: boolean, opponentTeam: Team): GameContext => ({ game: g, isHome, opponentTeam, opponentVenue: null, promos: [] });

test('ticketNetworkForGame keys on the home club and spares neutral sites', async () => {
  const { ticketNetworkForGame } = await import('../affiliates');
  assert.equal(ticketNetworkForGame(game('toronto-maple-leafs', 'boston-bruins'), LEAFS), false);
  assert.equal(ticketNetworkForGame(game('boston-bruins', 'toronto-maple-leafs'), BRUINS), true);
  assert.equal(ticketNetworkForGame(game('toronto-maple-leafs', 'boston-bruins', { neutralSite: true }), LEAFS), true);
  assert.equal(ticketNetworkForGame(game('toronto-maple-leafs', 'boston-bruins', { isInternational: true }), LEAFS), true);
  assert.equal(ticketNetworkForGame(null, LEAFS), false);
  assert.equal(ticketNetworkForGame(null, BRUINS), true);
  assert.equal(ticketNetworkForGame(null, null), true);
});

const cardCases: [string, Team, GameContext, boolean][] = [
  ['Leafs page, home game', LEAFS, ctx(game('toronto-maple-leafs', 'boston-bruins'), true, BRUINS), false],
  ['Leafs page, away game at a US building, event matched', LEAFS, ctx(game('boston-bruins', 'toronto-maple-leafs', { tnEventUrl: EVENT }), false, BRUINS), true],
  ['Bruins page, away game at the Leafs building', BRUINS, ctx(game('toronto-maple-leafs', 'boston-bruins'), false, LEAFS), false],
  ['Bruins page, home game vs the Leafs, event matched', BRUINS, ctx(game('boston-bruins', 'toronto-maple-leafs', { tnEventUrl: EVENT }), true, LEAFS), true],
  ['Leafs page, neutral-site game', LEAFS, ctx(game('toronto-maple-leafs', 'boston-bruins', { neutralSite: true, venueName: 'Avicii Arena' }), true, BRUINS), true],
];

for (const [name, pageTeam, c, tnExpected] of cardCases) {
  test(`game cards: ${name}: Ticketmaster stays, TicketNetwork ${tnExpected ? 'stays' : 'goes'}`, async () => {
    const { GameExpand } = await import('../../components/redesign/GameExpand');
    const { GameDayDetail } = await import('../../components/shared/game-day-detail');
    const props = { dateStr: c.game.date, contexts: [c], team: pageTeam, teamSlug: pageTeam.id, teamName: pageTeam.name };
    for (const html of [renderToStaticMarkup(<GameExpand {...props} />), renderToStaticMarkup(<GameDayDetail {...props} />)]) {
      assert.equal(tmHrefs(html).length, 1, 'one Ticketmaster button');
      const tn = tnHrefs(html);
      if (!tnExpected) {
        assert.deepEqual(tn, []);
        assert.equal(html.includes('TicketNetwork'), false, 'no TicketNetwork label either');
      } else {
        assert.equal(tn.length, 1);
        if (c.game.tnEventUrl) assert.ok(tn[0].includes(encodeURIComponent(c.game.tnEventUrl)), 'the event link, as today');
        assert.ok(tn[0].startsWith(PREFIX));
      }
    }
    // The Ticketmaster href is the one an unflagged render gives (tagging unchanged).
    const unflag = (t: Team | null) => (t ? ({ ...t, tnHomeUnavailable: undefined }) as Team : t);
    const plain = { ...props, team: unflag(pageTeam), contexts: [{ ...c, opponentTeam: unflag(c.opponentTeam) }] };
    assert.deepEqual(tmHrefs(renderToStaticMarkup(<GameExpand {...props} />)), tmHrefs(renderToStaticMarkup(<GameExpand {...plain} />)));
  });
}

test('legacy promo-only cards: the flagged club drops TicketNetwork, another club keeps it', async () => {
  const { LegacyPromoExpand } = await import('../../components/redesign/GameExpand');
  const { LegacyPromoDetail } = await import('../../components/shared/game-day-detail');
  const promos = [{ date: '2026-11-21', title: 'Hat Night', type: 'giveaway', description: '', highlight: false, icon: '' }] as never;
  for (const Comp of [LegacyPromoExpand, LegacyPromoDetail] as any[]) {
    const leafs = renderToStaticMarkup(<Comp dateStr="2026-11-21" promos={promos} team={LEAFS} teamSlug={LEAFS.id} teamName="Maple Leafs" />);
    assert.deepEqual(tnHrefs(leafs), []);
    assert.equal(tmHrefs(leafs).length, 1);
    const bruins = renderToStaticMarkup(<Comp dateStr="2026-11-21" promos={promos} team={BRUINS} teamSlug={BRUINS.id} teamName="Bruins" />);
    assert.equal(tnHrefs(bruins).length, 1);
  }
});

test('team-level CTA (hero, sidebar; Matt 2026-11-03): Ticketmaster only for a flagged club, both buttons for any other', async () => {
  const { TicketmasterCTA } = await import('../../components/affiliates/TicketmasterCTA');
  const { ticketNetworkForGame } = await import('../affiliates');
  const leafs = renderToStaticMarkup(<TicketmasterCTA team={LEAFS} surface="web_team_page" placement="team_page_sidebar" ticketNetwork={ticketNetworkForGame(null, LEAFS)} />);
  assert.deepEqual(tnHrefs(leafs), []);
  assert.equal(leafs.includes('TicketNetwork'), false);
  assert.equal(tmHrefs(leafs).length, 1);
  const bruins = renderToStaticMarkup(<TicketmasterCTA team={BRUINS} surface="web_team_page" placement="team_page_sidebar" ticketNetwork={ticketNetworkForGame(null, BRUINS)} />);
  assert.equal(tnHrefs(bruins).length, 1);
  assert.equal(tmHrefs(bruins).length, 1);
  // The Ticketmaster href is the one an unflagged render gives.
  const plain = renderToStaticMarkup(<TicketmasterCTA team={{ ...LEAFS, tnHomeUnavailable: undefined } as Team} surface="web_team_page" placement="team_page_sidebar" />);
  assert.deepEqual(tmHrefs(leafs), tmHrefs(plain));
});
