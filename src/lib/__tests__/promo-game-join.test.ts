// The promo-to-game join (src/lib/promo-game-join.ts) and its data-layer
// wiring (withGameDisplay in data.ts).
//
// Rules under test:
//  - stored wins: a non-empty stored time / opponent is never replaced, and
//    the stored fields are never written;
//  - an empty slot takes the home game's value: venue-time clock, away-club
//    nickname;
//  - NBA rows gain an opponent only (the spine stores no tip-off);
//  - a timeTbd kickoff resolves to no time;
//  - a doubleheader resolves the opponent and never a time;
//  - no games league (MLS, WNBA) and no game on the date leave '' in place;
//  - withGameDisplay issues no games read when every row already carries both
//    values, and one read for the whole window otherwise.
import { test, mock } from 'node:test';
import assert from 'node:assert';
import type { Game, PromoWithTeam, Team } from '../types';

function team(id: string, name: string, league: string): Team {
  return { id, name, city: 'City', league, sportSlug: league.toLowerCase(), abbreviation: 'X', primaryColor: '#000', secondaryColor: '#fff', division: 'D' } as unknown as Team;
}
const WOLVES = team('minnesota-timberwolves', 'Timberwolves', 'NBA');
const CLIPPERS = team('la-clippers', 'Clippers', 'NBA');
const WILD = team('minnesota-wild', 'Wild', 'NHL');
const PENS = team('pittsburgh-penguins', 'Penguins', 'NHL');
const BILLS = team('buffalo-bills', 'Bills', 'NFL');
const RAVENS = team('baltimore-ravens', 'Ravens', 'NFL');
const YANKEES = team('new-york-yankees', 'Yankees', 'MLB');
const DODGERS = team('los-angeles-dodgers', 'Dodgers', 'MLB');
const RAPIDS = team('colorado-rapids', 'Rapids', 'MLS');
const TEAMS = new Map([WOLVES, CLIPPERS, WILD, PENS, BILLS, RAVENS, YANKEES, DODGERS, RAPIDS].map((t) => [t.id, t]));

function game(over: Partial<Game> & Pick<Game, 'league' | 'date' | 'homeTeamSlug' | 'awayTeamSlug'>): Game {
  return { id: `${over.league}-${over.date}-${over.awayTeamSlug}-at-${over.homeTeamSlug}${over.doubleheaderGame ? `-g${over.doubleheaderGame}` : ''}`, gameTime: '', gameTimeTz: '', venueName: 'Arena', status: 'scheduled', ...over };
}
function promo(t: Team, date: string, over: Partial<PromoWithTeam> = {}): PromoWithTeam {
  return { team: t, date, time: '', opponent: '', type: 'giveaway', title: 'Promo', description: '', highlight: false, icon: '', recurring: false, displayTime: '', displayOpponent: '', ...over };
}

const GAMES: Game[] = [
  // NHL: 7:00 PM Central at Xcel on 2026-10-30 (00:00Z on the 31st).
  game({ league: 'nhl', date: '2026-10-30', homeTeamSlug: WILD.id, awayTeamSlug: PENS.id, gameTime: '00:00', gameTimeTz: 'America/Chicago' }),
  // NBA: no tip-off by ruling (mapGameDoc blanks it).
  game({ league: 'nba', date: '2026-10-30', homeTeamSlug: WOLVES.id, awayTeamSlug: CLIPPERS.id, gameTime: '', gameTimeTz: '' }),
  // NFL: flex placeholder.
  game({ league: 'nfl', date: '2026-11-01', homeTeamSlug: BILLS.id, awayTeamSlug: RAVENS.id, gameTime: '05:00', gameTimeTz: 'America/New_York', timeTbd: true }),
  // MLB doubleheader.
  game({ league: 'mlb', date: '2026-07-19', homeTeamSlug: YANKEES.id, awayTeamSlug: DODGERS.id, gameTime: '16:35', gameTimeTz: 'America/New_York' }),
  game({ league: 'mlb', date: '2026-07-19', homeTeamSlug: YANKEES.id, awayTeamSlug: DODGERS.id, gameTime: '23:20', gameTimeTz: 'America/New_York', doubleheaderGame: 2 }),
];

test('resolveGameForPromo: venue-time clock and away nickname for a single home game', async () => {
  const { buildGameIndex, resolveGameForPromo } = await import('../promo-game-join');
  const index = buildGameIndex(GAMES);
  const r = resolveGameForPromo(promo(WILD, '2026-10-30'), index, TEAMS);
  assert.ok(r);
  assert.equal(r.time, '7:00 PM');
  assert.equal(r.opponent, 'Penguins');
  assert.equal(r.venueName, 'Arena');
  assert.equal(resolveGameForPromo(promo(WILD, '2026-10-31'), index, TEAMS), null, 'no game on the date');
  assert.equal(resolveGameForPromo(promo(RAPIDS, '2026-10-30'), index, TEAMS), null, 'no spine for the league');
});

test('resolveGameForPromo: NBA gives an opponent only, timeTbd gives no time, a doubleheader never gives a time', async () => {
  const { buildGameIndex, resolveGameForPromo } = await import('../promo-game-join');
  const index = buildGameIndex(GAMES);
  assert.deepEqual([resolveGameForPromo(promo(WOLVES, '2026-10-30'), index, TEAMS)!.time, resolveGameForPromo(promo(WOLVES, '2026-10-30'), index, TEAMS)!.opponent], ['', 'Clippers']);
  assert.deepEqual([resolveGameForPromo(promo(BILLS, '2026-11-01'), index, TEAMS)!.time, resolveGameForPromo(promo(BILLS, '2026-11-01'), index, TEAMS)!.opponent], ['', 'Ravens']);
  const dh = resolveGameForPromo(promo(YANKEES, '2026-07-19'), index, TEAMS)!;
  assert.equal(dh.time, '', 'two games on the date: the promo does not say which');
  assert.equal(dh.opponent, 'Dodgers');
  assert.equal(dh.games.length, 2);
  assert.equal(dh.games[1].doubleheaderGame, 2, 'doubleheader order');
});

test('applyGameDisplay: stored wins, empty fills, stored fields untouched, in place', async () => {
  const { buildGameIndex, applyGameDisplay } = await import('../promo-game-join');
  const index = buildGameIndex(GAMES);
  const stored = promo(WILD, '2026-10-30', { time: '6:30 PM', opponent: 'Pens' });
  const empty = promo(WILD, '2026-10-30');
  const halfEmpty = promo(WILD, '2026-10-30', { opponent: 'Penguins' });
  const rows = [stored, empty, halfEmpty];
  const out = applyGameDisplay(rows, index, TEAMS);
  assert.equal(out, rows, 'same array');
  assert.deepEqual([stored.displayTime, stored.displayOpponent], ['6:30 PM', 'Pens']);
  assert.deepEqual([stored.time, stored.opponent], ['6:30 PM', 'Pens'], 'stored untouched');
  assert.deepEqual([empty.displayTime, empty.displayOpponent], ['7:00 PM', 'Penguins']);
  assert.deepEqual([empty.time, empty.opponent], ['', ''], 'stored stays empty');
  assert.deepEqual([halfEmpty.displayTime, halfEmpty.displayOpponent], ['7:00 PM', 'Penguins']);
});

test('needsGameDisplay: only a games league with a slot its spine can fill', async () => {
  const { needsGameDisplay } = await import('../promo-game-join');
  assert.equal(needsGameDisplay(promo(RAPIDS, '2026-10-30')), false, 'MLS has no spine');
  assert.equal(needsGameDisplay(promo(WOLVES, '2026-10-30', { opponent: 'Clippers' })), false, 'NBA with an opponent: no time to gain');
  assert.equal(needsGameDisplay(promo(WOLVES, '2026-10-30')), true, 'NBA without an opponent');
  assert.equal(needsGameDisplay(promo(WILD, '2026-10-30', { opponent: 'Penguins' })), true, 'NHL without a time');
  assert.equal(needsGameDisplay(promo(WILD, '2026-10-30', { time: '7:00 PM', opponent: 'Penguins' })), false);
});

// ── data-layer wiring over a fake Firestore ─────────────────────────────────
type Data = Record<string, unknown>;
function fakeDoc(id: string, data: Data, teamId?: string) {
  return { id, exists: true, data: () => data, ref: { parent: { parent: teamId ? { id: teamId } : null } } };
}
function fakeSnap(docs: ReturnType<typeof fakeDoc>[]) {
  return { docs, empty: docs.length === 0, size: docs.length, forEach: (fn: (d: (typeof docs)[number]) => void) => docs.forEach(fn), data: () => ({ count: docs.length }) };
}
let gamesReads = 0;
function query(snap: ReturnType<typeof fakeSnap>, onGet?: () => void): any {
  const q: any = { where: () => q, orderBy: () => q, limit: () => q, count: () => ({ get: async () => snap }), get: async () => { onGet?.(); return snap; } };
  return q;
}
const teamDoc = (t: Team) => fakeDoc(t.id, { league: t.league, city: t.city, name: t.name, abbreviation: 'X', primaryColor: 4278190080, secondaryColor: 4278190080, division: 'D' });
const PROMO = (over: Data): Data => ({ date: '2026-10-30', title: 'Promo', type: 'giveaway', description: 'd', time: '', opponent: '', ...over });
const promoDocs = [
  fakeDoc('p-empty', PROMO({ title: 'Empty Slots' }), WILD.id),
  fakeDoc('p-stored', PROMO({ title: 'Stored', time: '6:30 PM', opponent: 'Pens' }), WILD.id),
];
const gameDocs = GAMES.map((g) => fakeDoc(g.id, g as unknown as Data));
const fakeDb = {
  collection(name: string): any {
    if (name === 'teams') return { get: async () => fakeSnap([teamDoc(WILD), teamDoc(PENS)]), doc: () => ({ get: async () => ({ exists: false, data: () => undefined }), collection: () => query(fakeSnap(promoDocs)) }) };
    if (name === 'games') return query(fakeSnap(gameDocs), () => { gamesReads++; });
    return query(fakeSnap([]));
  },
  collectionGroup(name: string): any {
    if (name === 'promos') return query(fakeSnap(promoDocs));
    return query(fakeSnap([]));
  },
};
mock.module('server-only', { namedExports: {} });
mock.module(new URL('../firebase.ts', import.meta.url).href, { namedExports: { db: fakeDb } });

test('withGameDisplay through getPromosInDateRange: one games read, empty slots filled, stored kept', async () => {
  const { getPromosInDateRange, withGameDisplay, mapPromoDoc } = await import('../data');
  const mapped = mapPromoDoc(promoDocs[1] as any);
  assert.deepEqual([mapped.displayTime, mapped.displayOpponent], ['6:30 PM', 'Pens'], 'mapPromoDoc seeds the slots from the stored values');
  gamesReads = 0;
  const rows = await getPromosInDateRange('2026-10-30', '2026-10-30');
  assert.equal(gamesReads, 1, 'one games read for the window');
  const byTitle = new Map(rows.map((r) => [r.title, r]));
  assert.deepEqual([byTitle.get('Empty Slots')!.displayTime, byTitle.get('Empty Slots')!.displayOpponent], ['7:00 PM', 'Penguins']);
  assert.deepEqual([byTitle.get('Empty Slots')!.time, byTitle.get('Empty Slots')!.opponent], ['', ''], 'stored fields untouched');
  assert.deepEqual([byTitle.get('Stored')!.displayTime, byTitle.get('Stored')!.displayOpponent], ['6:30 PM', 'Pens']);
  gamesReads = 0;
  await withGameDisplay([promo(WILD, '2026-10-30', { time: '7:00 PM', opponent: 'Penguins' })]);
  assert.equal(gamesReads, 0, 'no read when nothing can be filled');
});

test('applyGameDisplayForTeam: fills from the page\'s own home contexts, away contexts ignored, stored kept', async () => {
  const { applyGameDisplayForTeam } = await import('../promo-game-join');
  const homeCtx = { game: GAMES[0], isHome: true, opponentTeam: PENS, opponentVenue: null, promos: [] };
  // An away game the same night elsewhere must not feed the join.
  const awayCtx = { game: game({ league: 'nhl', date: '2026-10-31', homeTeamSlug: PENS.id, awayTeamSlug: WILD.id, gameTime: '23:00', gameTimeTz: 'America/New_York' }), isHome: false, opponentTeam: PENS, opponentVenue: null, promos: [] };
  const empty = { ...promo(WILD, '2026-10-30') } as any; delete empty.team;
  const awayNight = { ...promo(WILD, '2026-10-31') } as any; delete awayNight.team;
  const stored = { ...promo(WILD, '2026-10-30', { time: '6:30 PM', opponent: 'Pens' }) } as any; delete stored.team;
  const rows = applyGameDisplayForTeam([empty, awayNight, stored], WILD, [homeCtx, awayCtx] as any);
  assert.equal(rows.length, 3);
  assert.deepEqual([empty.displayTime, empty.displayOpponent], ['7:00 PM', 'Penguins']);
  assert.deepEqual([awayNight.displayTime, awayNight.displayOpponent], ['', ''], 'no home game that night');
  assert.deepEqual([stored.displayTime, stored.displayOpponent, stored.time, stored.opponent], ['6:30 PM', 'Pens', '6:30 PM', 'Pens']);
});
