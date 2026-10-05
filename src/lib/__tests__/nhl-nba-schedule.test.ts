// NHL and NBA games on the team page (WEB6, 2026-10-05).
//
//  1. getGamesForTeam returns the NHL and NBA season spines, regular season
//     only, and still returns nothing for a league with no games data.
//  2. NHL game times are SHOWN, and they are right. Five games in five arena
//     zones were checked on 2026-10-05 against the NHL's own game record
//     (api-web.nhle.com/v1/gamecenter/{id}/landing: startTimeUTC plus
//     venueUTCOffset), and the Rangers game also against the club's page
//     ("Tuesday, October 13 | 7:15 PM ET", nhl.com/rangers/tickets/theme-nights).
//     The stored doc carries the UTC clock time and the venue zone, the same
//     convention as MLB, and formatGameTime converts it.
//  3. NBA game times are HIDDEN. The spine stores none, and the mapper blanks
//     any that a future ingest adds before it can reach a render site or the
//     RSC payload.
//
// Run with: node --import tsx --experimental-test-module-mocks --test <this file>
import { test, mock } from 'node:test';
import assert from 'node:assert';

type Data = Record<string, unknown>;
function fakeDoc(id: string, data: Data) {
  return { id, exists: true, data: () => data, get: (f: string) => data[f] };
}
function fakeSnap(docs: ReturnType<typeof fakeDoc>[]) {
  return { docs, empty: docs.length === 0, size: docs.length, forEach: (fn: (d: (typeof docs)[number]) => void) => docs.forEach(fn) };
}
function query(docs: ReturnType<typeof fakeDoc>[]): any {
  let filtered = docs;
  const q: any = {
    where: (field: string, op: string, value: unknown) => {
      if (op === '==') filtered = filtered.filter((d) => d.data()[field] === value);
      return q;
    },
    orderBy: () => q,
    limit: () => q,
    get: async () => fakeSnap(filtered),
  };
  return q;
}

// The five verified games, as stored in the NHL spine on 2026-10-05.
// `official` is the NHL record: startTimeUTC and venueUTCOffset.
const VERIFIED = [
  { id: 'nhl-2026-10-13-tampa-bay-lightning-at-new-york-rangers', date: '2026-10-13', gameTime: '23:15', gameTimeTz: 'America/New_York', home: 'new-york-rangers', away: 'tampa-bay-lightning', official: { startTimeUTC: '2026-10-13T23:15:00Z', venueUTCOffset: '-04:00' }, expect: '7:15 PM' },
  { id: 'nhl-2026-10-12-vegas-golden-knights-at-minnesota-wild', date: '2026-10-12', gameTime: '00:00', gameTimeTz: 'US/Central', home: 'minnesota-wild', away: 'vegas-golden-knights', official: { startTimeUTC: '2026-10-13T00:00:00Z', venueUTCOffset: '-05:00' }, expect: '7:00 PM' },
  { id: 'nhl-2026-10-10-toronto-maple-leafs-at-colorado-avalanche', date: '2026-10-10', gameTime: '23:00', gameTimeTz: 'America/Denver', home: 'colorado-avalanche', away: 'toronto-maple-leafs', official: { startTimeUTC: '2026-10-10T23:00:00Z', venueUTCOffset: '-06:00' }, expect: '5:00 PM' },
  { id: 'nhl-2026-10-08-toronto-maple-leafs-at-vegas-golden-knights', date: '2026-10-08', gameTime: '02:00', gameTimeTz: 'US/Pacific', home: 'vegas-golden-knights', away: 'toronto-maple-leafs', official: { startTimeUTC: '2026-10-09T02:00:00Z', venueUTCOffset: '-07:00' }, expect: '7:00 PM' },
  { id: 'nhl-2026-10-04-vegas-golden-knights-at-vancouver-canucks', date: '2026-10-04', gameTime: '01:00', gameTimeTz: 'America/Vancouver', home: 'vancouver-canucks', away: 'vegas-golden-knights', official: { startTimeUTC: '2026-10-05T01:00:00Z', venueUTCOffset: '-07:00' }, expect: '6:00 PM' },
];

const nhlDoc = (v: (typeof VERIFIED)[number], extra: Data = {}) =>
  fakeDoc(v.id, { id: v.id, league: 'nhl', season: 2026, seasonType: 'regular', date: v.date, gameTime: v.gameTime, gameTimeTz: v.gameTimeTz, homeTeamSlug: v.home, awayTeamSlug: v.away, venueName: 'Arena', status: 'scheduled', ...extra });

const GAMES = [
  ...VERIFIED.map((v) => nhlDoc(v)),
  // A preseason game: off the list on every league, as on NFL.
  fakeDoc('nhl-pre', { id: 'nhl-pre', league: 'nhl', season: 2026, seasonType: 'preseason', date: '2026-09-22', gameTime: '23:00', gameTimeTz: 'America/New_York', homeTeamSlug: 'new-york-rangers', awayTeamSlug: 'new-york-islanders', status: 'scheduled' }),
  // NBA: as stored (no time), and a hypothetical future doc that carries one.
  fakeDoc('nba-1', { id: 'nba-1', league: 'nba', season: 2026, seasonType: 'regular', date: '2026-10-21', homeTeamSlug: 'new-york-knicks', awayTeamSlug: 'boston-celtics', venueName: 'Madison Square Garden', status: 'scheduled' }),
  fakeDoc('nba-2', { id: 'nba-2', league: 'nba', season: 2026, seasonType: 'regular', date: '2026-10-24', gameTime: '23:30', gameTimeTz: 'America/New_York', homeTeamSlug: 'new-york-knicks', awayTeamSlug: 'chicago-bulls', venueName: 'Madison Square Garden', status: 'scheduled' }),
  fakeDoc('nba-pre', { id: 'nba-pre', league: 'nba', season: 2026, seasonType: 'preseason', date: '2026-10-08', homeTeamSlug: 'new-york-knicks', awayTeamSlug: 'washington-wizards', status: 'scheduled' }),
  // An MLS-shaped doc: MLS has no games data path and must stay empty.
  fakeDoc('mls-1', { id: 'mls-1', league: 'mls', date: '2026-10-10', homeTeamSlug: 'inter-miami-cf', awayTeamSlug: 'orlando-city-sc', status: 'scheduled' }),
];

const fakeDb = {
  collection(name: string): any {
    if (name === 'games') return query(GAMES);
    return query([]);
  },
  collectionGroup(): any {
    return query([]);
  },
};
mock.module('server-only', { namedExports: {} });
mock.module(new URL('../firebase.ts', import.meta.url).href, { namedExports: { db: fakeDb } });

/** The official local clock time, computed from the NHL record alone. */
function officialLocal(o: { startTimeUTC: string; venueUTCOffset: string }): string {
  const m = /^([+-])(\d{2}):(\d{2})$/.exec(o.venueUTCOffset)!;
  const offMin = (m[1] === '-' ? -1 : 1) * (Number(m[2]) * 60 + Number(m[3]));
  const local = new Date(Date.parse(o.startTimeUTC) + offMin * 60_000);
  const h = local.getUTCHours();
  const min = String(local.getUTCMinutes()).padStart(2, '0');
  return `${h % 12 === 0 ? 12 : h % 12}:${min} ${h < 12 ? 'AM' : 'PM'}`;
}

test('the fixture is the NHL record: each expected time is what startTimeUTC plus the arena offset says', () => {
  for (const v of VERIFIED) assert.equal(officialLocal(v.official), v.expect, v.id);
  // Five different arena zones.
  assert.equal(new Set(VERIFIED.map((v) => v.gameTimeTz)).size, 5);
});

test('NHL: getGamesForTeam returns the spine, regular season only, times kept, rendered as the NHL schedule says', async () => {
  const { getGamesForTeam } = await import('../data');
  const { formatGameTime } = await import('../format-game-time');
  for (const v of VERIFIED) {
    const games = await getGamesForTeam(v.home, 'nhl');
    const g = games.find((x) => x.id === v.id);
    assert.ok(g, `${v.id} returned`);
    assert.equal(g.gameTime, v.gameTime, 'NHL time kept');
    assert.equal(g.gameTimeTz, v.gameTimeTz);
    const shown = formatGameTime(g.gameTimeTz, g.gameTime, g.date, g.gameTimeZoneAbbrev);
    assert.ok(shown.startsWith(v.expect), `${v.id}: shows "${shown}", NHL record says ${v.expect}`);
  }
  const rangers = await getGamesForTeam('new-york-rangers', 'nhl');
  assert.ok(!rangers.some((g) => g.id === 'nhl-pre'), 'preseason off the list');
  // The away side sees the same game.
  const leafs = await getGamesForTeam('toronto-maple-leafs', 'nhl');
  assert.deepEqual(leafs.map((g) => g.id).sort(), [VERIFIED[2].id, VERIFIED[3].id].sort());
});

test('NBA: getGamesForTeam returns the spine with every time blanked at the mapper', async () => {
  const { getGamesForTeam } = await import('../data');
  const { formatGameTime } = await import('../format-game-time');
  const games = await getGamesForTeam('new-york-knicks', 'nba');
  assert.deepEqual(games.map((g) => g.id), ['nba-1', 'nba-2'], 'regular season only, date order');
  for (const g of games) {
    assert.equal(g.gameTime, '', `${g.id}: no time`);
    assert.equal(g.gameTimeTz, '', `${g.id}: no zone`);
    assert.equal(g.gameTimeZoneAbbrev, undefined, `${g.id}: no zone label`);
    assert.equal(formatGameTime(g.gameTimeTz, g.gameTime, g.date, g.gameTimeZoneAbbrev), '', `${g.id}: renders no time`);
  }
});

test('a league with no games data still returns nothing', async () => {
  const { getGamesForTeam } = await import('../data');
  assert.deepEqual(await getGamesForTeam('inter-miami-cf', 'mls'), []);
});
