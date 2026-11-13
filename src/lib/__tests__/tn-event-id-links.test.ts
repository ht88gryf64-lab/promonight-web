// TicketNetwork event link from tnEventId (feature/tn-event-id-links, Gate 1
// ruling 2026-11-13). The stored tnEventUrl path is unchanged and first; only
// without it does the web build https://www.ticketnetwork.com/tickets/{id},
// and only when tnEventDate (the catalog event's UTC date) is the game date.
// Each guard below was run against its known-bad input with the guard removed
// (Gate 2 report). Through the real mapGameDoc over a fake Firestore, as in
// tn-game-gate.test.ts.
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

const SLUG_URL = 'https://www.ticketnetwork.com/tickets/8205317/minnesota-timberwolves-vs-chicago-bulls-tickets-sat-nov-14-2026-target-center';
const ID_URL = 'https://www.ticketnetwork.com/tickets/8205317';
const g = (id: string, date: string, over: Data) => fakeDoc(id, { league: 'nba', date, gameTime: '01:00', gameTimeTz: 'America/Chicago', homeTeamSlug: 'minnesota-timberwolves', awayTeamSlug: 'chicago-bulls', venueName: 'Target Center', status: 'scheduled', seasonType: 'regular', ...over });
const GAMES = [
  g('id-only', '2026-11-14', { tnEventId: 8205317, tnEventDate: '2026-11-14', tnEventIdSource: 'catalog' }),
  g('date-missing', '2026-11-16', { tnEventId: 8205322 }),
  g('date-off-by-one', '2026-11-17', { tnEventId: 8205323, tnEventDate: '2026-11-16' }),
  g('url-wins', '2026-11-14', { tnEventUrl: SLUG_URL, tnEventId: 9999999, tnEventDate: '2026-11-14' }),
  g('url-rejected', '2026-11-19', { tnEventUrl: SLUG_URL, tnEventId: 8205332, tnEventDate: '2026-11-19' }),
  g('stored-bare-url', '2026-11-21', { tnEventUrl: 'https://www.ticketnetwork.com/tickets/8205333' }),
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

test('tnEventDate missing: no link from the id', async () => {
  const { ticketNetworkEventLinkFor } = await import('../affiliates');
  assert.equal(ticketNetworkEventLinkFor({ tnEventId: 8205317 }, '2026-11-14'), null);
  assert.equal(ticketNetworkEventLinkFor({ tnEventId: 8205317, tnEventDate: undefined }, '2026-11-14'), null);
});

test('tnEventDate one day off (LaunchDate read in local time): no link', async () => {
  const { ticketNetworkEventLinkFor } = await import('../affiliates');
  // The catalog renders the 2026-11-14 game as "2026-11-13T18:00:00-06:00".
  assert.equal(ticketNetworkEventLinkFor({ tnEventId: 8205317, tnEventDate: '2026-11-13' }, '2026-11-14'), null);
  assert.equal(ticketNetworkEventLinkFor({ tnEventId: 8205317, tnEventDate: '2026-11-15' }, '2026-11-14'), null);
});

test('tnEventId present with no date anywhere (no tnEventDate, no game date): no link', async () => {
  const { ticketNetworkEventLinkFor } = await import('../affiliates');
  assert.equal(ticketNetworkEventLinkFor({ tnEventId: 8205317 }, undefined as unknown as string), null);
  assert.equal(ticketNetworkEventLinkFor({ tnEventId: 8205317, tnEventDate: '' }, ''), null);
  assert.equal(ticketNetworkEventLinkFor({ tnEventId: 8205317, tnEventDate: null }, null as unknown as string), null);
});

test('tnEventUrl present and valid still wins over the id', async () => {
  const { ticketNetworkEventLinkFor } = await import('../affiliates');
  assert.equal(ticketNetworkEventLinkFor({ tnEventUrl: SLUG_URL, tnEventId: 9999999, tnEventDate: '2026-11-14' }, '2026-11-14'), SLUG_URL);
});

test('the id path: a matching date builds /tickets/{id}; bad ids never do', async () => {
  const { ticketNetworkEventLinkFor, ticketNetworkEventUrlFor, isTicketNetworkEventUrl } = await import('../affiliates');
  assert.equal(ticketNetworkEventLinkFor({ tnEventId: 8205317, tnEventDate: '2026-11-14' }, '2026-11-14'), ID_URL);
  for (const bad of [0, -1, 1.5, '8205317', NaN, Number.MAX_SAFE_INTEGER + 2]) {
    assert.equal(ticketNetworkEventLinkFor({ tnEventId: bad, tnEventDate: '2026-11-14' }, '2026-11-14'), null, String(bad));
  }
  // A stored URL in the id-only form carries no date: the stored path refuses it.
  assert.equal(ticketNetworkEventUrlFor(ID_URL, '2026-11-14'), null);
  assert.ok(isTicketNetworkEventUrl(ID_URL));
  assert.ok(!isTicketNetworkEventUrl('https://www.ticketnetwork.com/tickets/0'));
  assert.ok(!isTicketNetworkEventUrl('https://www.ticketnetwork.com/tickets/8205317?x=1'));
});

test('the id link rides the same affiliate wrapper and subId scheme as a stored event URL', async () => {
  const { buildTicketNetworkLink, ticketNetworkLinkLevel } = await import('../affiliates');
  const team = { id: 'minnesota-timberwolves', ticketNetworkSlug: undefined } as never;
  const href = buildTicketNetworkLink({ team, surface: 'web_promo_page', eventUrl: ID_URL, pageSlug: 'bobblehead-night' }) as string;
  const u = new URL(href);
  assert.equal(u.origin + u.pathname, 'https://ticketnetwork.lusg.net/c/7236189/120057/2322');
  assert.equal(u.searchParams.get('u'), ID_URL);
  assert.equal(u.searchParams.get('subId1'), 'web_promo_page_minnesota-timberwolves');
  assert.equal(u.searchParams.get('subId3'), 'bobblehead-night');
  assert.equal(u.searchParams.get('partnerpropertyid'), '8313917');
  assert.equal(ticketNetworkLinkLevel(ID_URL), 'event');
  const slugHref = buildTicketNetworkLink({ team, surface: 'web_promo_page', eventUrl: SLUG_URL, pageSlug: 'bobblehead-night' }) as string;
  assert.equal(href.replace(encodeURIComponent(ID_URL), 'X'), slugHref.replace(encodeURIComponent(SLUG_URL), 'X'));
});

test('mapGameDoc: stored URL first, id only with a matching tnEventDate, and no tn* field but the URL reaches Game', async () => {
  const { getGamesForTeam, enrichGamesForTeam } = await import('../data');
  const games = await getGamesForTeam('minnesota-timberwolves', 'nba');
  const byId = new Map(games.map((x) => [x.id, x as unknown as Record<string, unknown>]));
  assert.equal(byId.get('id-only')?.tnEventUrl, ID_URL);
  assert.equal(byId.get('date-missing')?.tnEventUrl, undefined);
  assert.equal(byId.get('date-off-by-one')?.tnEventUrl, undefined);
  assert.equal(byId.get('url-wins')?.tnEventUrl, SLUG_URL);
  assert.equal(byId.get('url-rejected')?.tnEventUrl, 'https://www.ticketnetwork.com/tickets/8205332');
  assert.equal(byId.get('stored-bare-url')?.tnEventUrl, undefined);
  for (const x of games) for (const k of ['tnEventId', 'tnEventDate', 'tnEventIdSource', 'tnObservedAt', 'tnCheckedAt']) assert.ok(!(k in (x as object)), `${x.id} ${k}`);
  // The downstream gate keeps the id link on an upcoming single game.
  const ctx = await enrichGamesForTeam('minnesota-timberwolves', games, [], { today: '2026-11-13' });
  assert.equal(ctx.find((c) => c.game.id === 'id-only')?.game.tnEventUrl, ID_URL);
  const later = await enrichGamesForTeam('minnesota-timberwolves', games, [], { today: '2026-11-15' });
  assert.equal(later.find((c) => c.game.id === 'id-only')?.game.tnEventUrl, undefined);
});
