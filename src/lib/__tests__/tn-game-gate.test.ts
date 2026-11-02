// Review round 2 (feature/tn-event-links): a single-game surface links a game's
// TicketNetwork event page only when that game is still to be played. Through
// the real mapGameDoc (getGamesForTeam) and enrichGamesForTeam, over a fake
// Firestore: a played, postponed, doubleheader or other-date event never
// reaches a GameContext, and no clock read means no event link at all.
import { test, mock } from 'node:test';
import assert from 'node:assert/strict';

type Data = Record<string, unknown>;
const fakeDoc = (id: string, data: Data) => ({ id, exists: true, data: () => data, get: (f: string) => data[f], ref: { parent: { parent: null } } });
type Doc = ReturnType<typeof fakeDoc>;
function query(docs: Doc[]): any {
  let rows = docs;
  const q: any = {
    where: (field: string, op: string, value: any) => {
      const v = (d: Doc) => d.data()[field] as any;
      if (op === '==') rows = rows.filter((d) => v(d) === value);
      if (op === '>=') rows = rows.filter((d) => v(d) >= value);
      if (op === '<=') rows = rows.filter((d) => v(d) <= value);
      if (op === 'in') rows = rows.filter((d) => (value as unknown[]).includes(v(d)));
      return q;
    },
    orderBy: () => q,
    limit: () => q,
    get: async () => ({ docs: rows, empty: rows.length === 0, size: rows.length, forEach: (fn: (d: Doc) => void) => rows.forEach(fn) }),
  };
  return q;
}

const EV = (id: number, dow: string, mon: string, d: number, y: number) => `https://www.ticketnetwork.com/tickets/${id}/dallas-stars-vs-x-tickets-${dow}-${mon}-${d}-${y}-american-airlines-center`;
const g = (id: string, date: string, over: Data) => fakeDoc(id, { league: 'nhl', date, gameTime: '01:00', gameTimeTz: 'America/Chicago', homeTeamSlug: 'dallas-stars', awayTeamSlug: 'florida-panthers', venueName: 'AAC', status: 'scheduled', seasonType: 'regular', ...over });
const GAMES = [
  g('upcoming', '2026-11-15', { tnEventUrl: EV(1, 'sun', 'nov', 15, 2026), tnEventId: 1, tnObservedAt: 'x', tnCheckedAt: 'y' }),
  g('played', '2026-10-20', { tnEventUrl: EV(2, 'tue', 'oct', 20, 2026) }),
  g('postponed', '2026-11-20', { status: 'postponed', tnEventUrl: EV(3, 'fri', 'nov', 20, 2026) }),
  g('dh', '2026-11-22', { doubleheaderGame: 1, tnEventUrl: EV(4, 'sun', 'nov', 22, 2026) }),
  g('otherdate', '2026-11-25', { tnEventUrl: EV(5, 'thu', 'nov', 26, 2026) }), // a rescheduled game's leftover
  g('away', '2026-11-28', { homeTeamSlug: 'florida-panthers', awayTeamSlug: 'dallas-stars', tnEventUrl: EV(6, 'sat', 'nov', 28, 2026).replace('dallas-stars-vs-x', 'florida-panthers-vs-dallas-stars') }),
];
const fakeDb = {
  collection(name: string): any {
    if (name === 'games') return query(GAMES);
    if (name === 'teams') return { ...query([]), doc: () => ({ get: async () => ({ exists: false, data: () => undefined }), collection: () => query([]) }) };
    return query([]);
  },
  collectionGroup(): any {
    return query([]);
  },
};
mock.module('server-only', { namedExports: {} });
mock.module(new URL('../firebase.ts', import.meta.url).href, { namedExports: { db: fakeDb } });

test('mapGameDoc exposes tnEventUrl only, and only when its slug date is the game date', async () => {
  const { getGamesForTeam } = await import('../data');
  const games = await getGamesForTeam('dallas-stars', 'nhl');
  const byId = new Map(games.map((x) => [x.id, x as unknown as Record<string, unknown>]));
  assert.equal(byId.get('upcoming')?.tnEventUrl, EV(1, 'sun', 'nov', 15, 2026));
  for (const x of games) for (const k of ['tnEventId', 'tnObservedAt', 'tnCheckedAt']) assert.ok(!(k in (x as object)), `${x.id} ${k}`);
  assert.equal(byId.get('otherdate')?.tnEventUrl, undefined);
});

test('enrichGamesForTeam keeps an event link only on an upcoming, scheduled, single game', async () => {
  const { getGamesForTeam, enrichGamesForTeam } = await import('../data');
  const games = await getGamesForTeam('dallas-stars', 'nhl');
  const ctx = await enrichGamesForTeam('dallas-stars', games, [], { today: '2026-11-02' });
  const linked = ctx.filter((c) => c.game.tnEventUrl).map((c) => c.game.id).sort();
  assert.deepEqual(linked, ['away', 'upcoming']);
  // The shared Game objects are not mutated: the next reader still sees the field.
  assert.ok(games.find((x) => x.id === 'played')?.tnEventUrl);
  // No clock read, no event links.
  const none = await enrichGamesForTeam('dallas-stars', games, []);
  assert.equal(none.filter((c) => c.game.tnEventUrl).length, 0);
  // The day after the game, it no longer links.
  const later = await enrichGamesForTeam('dallas-stars', games, [], { today: '2026-11-16' });
  assert.ok(!later.find((c) => c.game.id === 'upcoming')?.game.tnEventUrl);
});

test('gameEventLinkUrl and ticketNetworkEventUrlFor', async () => {
  const { gameEventLinkUrl } = await import('../promo-game-join');
  const { ticketNetworkEventUrlFor, ticketNetworkEventDate } = await import('../affiliates');
  const url = EV(1, 'sun', 'nov', 15, 2026);
  const base = { date: '2026-11-15', status: 'scheduled' as const, tnEventUrl: url };
  assert.equal(gameEventLinkUrl(base, '2026-11-15'), url);
  assert.equal(gameEventLinkUrl(base, '2026-11-16'), null);
  assert.equal(gameEventLinkUrl({ ...base, status: 'completed' }, '2026-11-01'), null);
  assert.equal(gameEventLinkUrl({ ...base, doubleheaderGame: 2 }, '2026-11-01'), null);
  assert.equal(gameEventLinkUrl(base, null), null);
  assert.equal(ticketNetworkEventDate(url), '2026-11-15');
  assert.equal(ticketNetworkEventUrlFor(url, '2026-11-15'), url);
  assert.equal(ticketNetworkEventUrlFor(url, '2026-11-16'), null);
  assert.equal(ticketNetworkEventUrlFor('https://www.ticketnetwork.com/tickets/9/no-date-here', '2026-11-15'), null);
});
