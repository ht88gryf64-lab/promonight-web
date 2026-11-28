// MiLB G2b: the gate OPEN (appConfig/milb.milbLive === true), on the new
// paths. The same fake Firestore as the closed test, so this file is also its
// mutation check: with the flag flipped, the MILB clubs and their milbPromos
// rows are served. Plus the live rules: a zero-upcoming MILB club stays out of
// the sitemap, and a doc in the wrong home is served by nobody.
import { test, mock } from 'node:test';
import assert from 'node:assert/strict';
import { makeFakeDb, stubSitemapSources } from './milb-gate-fixtures';

const fake = makeFakeDb({ milbDoc: { milbLive: true }, rogue: true });
mock.module('server-only', { namedExports: {} });
mock.module(new URL('../firebase.ts', import.meta.url).href, { namedExports: { db: fake.db } });
stubSitemapSources(mock, import.meta.url);

test('open gate: MILB clubs are served from milbTeams, sorted by league then city like every club', async () => {
  const { getAllTeams, getTeamBySlug } = await import('../data');
  assert.deepEqual((await getAllTeams()).map((t) => t.id), ['durham-bulls', 'st-paul-saints', 'minnesota-twins', 'toronto-maple-leafs']);
  const d = await getTeamBySlug('durham-bulls');
  assert.equal(d?.league, 'MILB');
  assert.equal(d?.sportSlug, 'milb');
});

test('open gate: one club, one home. A teams doc claiming MILB and a milbTeams doc claiming MLB are served by nobody', async () => {
  const { getTeamBySlug } = await import('../data');
  assert.equal(await getTeamBySlug('rogue-in-teams'), null);
  assert.equal(await getTeamBySlug('rogue-in-milb'), null);
});

test('open gate: a MILB team page reads milbTeams/{id}/milbPromos', async () => {
  const { getTeamPromos } = await import('../data');
  const rows = await getTeamPromos('durham-bulls');
  assert.deepEqual(rows.map((p) => p.title), ['Opening Night', 'Mountain Gnomes']);
  assert.ok(!rows.some((p) => /Rogue/.test(p.title)), 'its doc in a promos collection is not its promo');
});

test('open gate: cross-team readers merge milbPromos in date order and drop a MILB doc found in a promos collection', async () => {
  const { getPromosFromDate, getPromosForDate, getPromoCount } = await import('../data');
  const rows = await getPromosFromDate('2027-01-01');
  assert.deepEqual(rows.map((p) => [p.date, p.team.id, p.title]), [['2027-05-21', 'durham-bulls', 'Mountain Gnomes'], ['2027-06-04', 'minnesota-twins', 'D']]);
  assert.deepEqual((await getPromosForDate('2027-05-22')).map((p) => p.title), [], 'the rogue promos-collection row is dropped');
  // promos group 8 (7 pro + the rogue doc) + milbPromos group 3.
  assert.equal(await getPromoCount(), 11);
});

test('open gate: a MILB club with an upcoming promo is in the sitemap; one with none is not', async () => {
  const sitemap = (await import('../../app/sitemap')).default;
  const urls = (await sitemap()).map((e) => e.url);
  assert.ok(urls.includes('https://www.getpromonight.com/milb/durham-bulls'));
  assert.ok(!urls.some((u) => u.includes('st-paul-saints')), 'zero-upcoming MILB club left out');
  assert.ok(urls.includes('https://www.getpromonight.com/mlb/minnesota-twins'));
  assert.ok(!urls.some((u) => u.includes('rogue')));
});

test('open gate: /api/my-teams/promos serves a MILB club from milbPromos', async () => {
  const { NextRequest } = await import('next/server');
  const { GET } = await import('../../app/api/my-teams/promos/route');
  const res = await GET(new NextRequest('https://www.getpromonight.com/api/my-teams/promos?teams=durham-bulls&start=2027-01-01&end=2027-12-31'));
  const body = (await res.json()) as { promos: { teamSlug: string; title: string }[] };
  assert.deepEqual(body.promos.map((p) => p.title), ['Mountain Gnomes']);
});

// MiLB G4b: the schedule and the ticket link come from milbGames.
test('open gate: a MILB team page reads its schedule from milbGames: home and away, in order, tombstones dropped', async () => {
  const { getGamesForTeam } = await import('../data');
  const before = fake.reads.milbGames;
  const games = await getGamesForTeam('durham-bulls', 'milb');
  assert.ok(fake.reads.milbGames > before, 'milbGames was read');
  assert.deepEqual(games.map((g) => g.id), ['860001', '860002', '860003', '860004', '860006', '860008', '860007']);
  assert.ok(games.every((g) => g.league === 'milb' && g.venueName === ''));
  const by = Object.fromEntries(games.map((g) => [g.id, g]));
  // Home and away; the official date; the venue's clock from the official start; a start to be announced.
  assert.deepEqual([by['860001'].homeTeamSlug, by['860001'].awayTeamSlug, by['860004'].homeTeamSlug], ['durham-bulls', 'st-paul-saints', 'st-paul-saints']);
  assert.deepEqual([by['860001'].date, by['860001'].gameTime, by['860001'].gameTimeTz, by['860001'].gameTimeZoneAbbrev], ['2027-05-21', '23:05', 'America/New_York', 'EDT']);
  assert.deepEqual([by['860004'].timeTbd, by['860004'].gameTime], [true, '']);
  assert.deepEqual([by['860006'].status, by['860001'].status], ['postponed', 'scheduled']);
  // A doubleheader: game 1 before game 2, though game 2's UTC clock ("01:35") sorts first as text.
  assert.deepEqual([by['860008'].doubleheaderGame, by['860007'].doubleheaderGame, by['860001'].doubleheaderGame], [1, 2, undefined]);
});

test('open gate: the TicketNetwork link exists only when tnEventDate is the official date, and is built from the id alone', async () => {
  const { getGamesForTeam } = await import('../data');
  const by = Object.fromEntries((await getGamesForTeam('durham-bulls', 'milb')).map((g) => [g.id, g]));
  assert.equal(by['860001'].tnEventUrl, 'https://www.ticketnetwork.com/tickets/8000001');
  assert.equal(by['860002'].tnEventUrl, undefined, 'the game moved after it was mapped: no link');
  assert.equal(by['860003'].tnEventUrl, undefined, 'a stored tnEventUrl on a MILB doc is never read');
  assert.equal(by['860004'].tnEventUrl, undefined);
});

test('open gate: nothing of TicketNetwork or StubHub but that one URL reaches a Game (RSC payload rule)', async () => {
  const { getGamesForTeam } = await import('../data');
  const games = await getGamesForTeam('durham-bulls', 'milb');
  const json = JSON.stringify(games);
  assert.doesNotMatch(json, /tnEventId|tnEventDate|shEvent|stubhub|Wrong Park|tnVenueName|tnTime|venueId|homeId|awayId|statusCode/);
  const allowed = new Set(['id', 'league', 'date', 'gameTime', 'gameTimeTz', 'gameTimeZoneAbbrev', 'homeTeamSlug', 'awayTeamSlug', 'venueName', 'status', 'timeTbd', 'doubleheaderGame', 'tnEventUrl']);
  for (const g of games) for (const k of Object.keys(g)) assert.ok(allowed.has(k), `${g.id} carries ${k}`);
});

test('open gate: only a MILB club the gate serves reads milbGames; a pro club under "milb" and a MILB club under "mlb" do not', async () => {
  const { getGamesForTeam, mapMilbGameDoc } = await import('../data');
  const before = fake.reads.milbGames;
  assert.deepEqual(await getGamesForTeam('minnesota-twins', 'milb'), []);
  assert.deepEqual(await getGamesForTeam('rogue-in-teams', 'milb'), []);
  assert.deepEqual(await getGamesForTeam('durham-bulls', 'mlb'), [], 'the games collection holds no MILB game');
  assert.equal(fake.reads.milbGames, before);
  const snap = (data: Record<string, unknown> | undefined) => ({ id: '1', data: () => data }) as unknown as FirebaseFirestore.DocumentSnapshot;
  assert.equal(mapMilbGameDoc(snap(undefined)), null);
  assert.equal(mapMilbGameDoc(snap({ date: 'soon', homeTeamSlug: 'durham-bulls' })), null);
  assert.equal(mapMilbGameDoc(snap({ date: '2027-05-21' })), null);
  assert.equal(mapMilbGameDoc(snap({ date: '2027-05-21', homeTeamSlug: 'durham-bulls', tnEventId: '8000001', tnEventDate: '2027-05-21' }))?.tnEventUrl, undefined, 'an id that is not a number links nothing');
});

test('open gate: a doc with no zone shows no clock, and the status follows the Stats API code', async () => {
  const { mapMilbGameDoc } = await import('../data');
  const snap = (data: Record<string, unknown>) => ({ id: '1', data: () => ({ date: '2027-05-21', homeTeamSlug: 'durham-bulls', ...data }) }) as unknown as FirebaseFirestore.DocumentSnapshot;
  const noZone = mapMilbGameDoc(snap({ startTimeUtc: '2027-05-21T23:05:00.000Z', timeZone: null }));
  assert.deepEqual([noZone?.gameTime, noZone?.gameTimeTz, noZone?.gameTimeZoneAbbrev], ['', '', undefined]);
  const st = (statusCode: unknown, status: unknown) => mapMilbGameDoc(snap({ statusCode, status }))?.status;
  assert.deepEqual([st('S', 'Scheduled'), st('P', 'Pre-Game'), st('I', 'In Progress'), st('T', 'Suspended')], ['scheduled', 'scheduled', 'scheduled', 'scheduled']);
  assert.deepEqual([st('DR', 'Postponed'), st('DI', 'Postponed'), st('DD', 'Postponed: Rain')], ['postponed', 'postponed', 'postponed']);
  assert.deepEqual([st('CR', 'Cancelled'), st('CO', 'Cancelled: Other')], ['canceled', 'canceled']);
  assert.deepEqual([st('F', 'Final'), st('FR', 'Completed Early'), st('O', 'Game Over'), st('FT', 'Final: Tied')], ['completed', 'completed', 'completed', 'completed']);
  // No code on the doc: the wording decides, as before.
  assert.deepEqual([st(undefined, 'Cancelled'), st(undefined, 'Completed Early'), st(undefined, 'Something New')], ['canceled', 'completed', 'scheduled']);
});

test('the schedule list rules for MILB: the named season only, canceled games dropped, a lone postponed game only while the season is live', async () => {
  const { regularSeasonContexts } = await import('../schedule-months');
  const ctx = (id: string, date: string, status: string, league = 'milb') => ({ game: { id, league, date, gameTime: '23:05', gameTimeTz: 'America/New_York', homeTeamSlug: 'durham-bulls', awayTeamSlug: 'st-paul-saints', venueName: '', status }, isHome: true, opponentTeam: null, promos: [] }) as never;
  const all = [ctx('a', '2027-04-06', 'completed'), ctx('b', '2027-05-21', 'scheduled'), ctx('c', '2027-06-01', 'canceled'), ctx('d', '2027-06-03', 'postponed'), ctx('e', '2028-04-04', 'scheduled')];
  const ids = (today?: string) => regularSeasonContexts(all, today).map((c: { game: { id: string } }) => c.game.id);
  assert.deepEqual(ids('2027-05-01'), ['a', 'b', 'd'], 'in season: canceled and next season dropped, the postponed game kept');
  assert.deepEqual(ids('2027-10-01'), ['a', 'b'], 'season over: the lone postponed game is dropped too');
  // An MLB list is what it was: the MILB rules key on the league string.
  const mlb = [ctx('m1', '2026-06-01', 'completed', 'mlb'), ctx('m2', '2026-06-02', 'canceled', 'mlb')];
  assert.deepEqual(regularSeasonContexts(mlb, '2026-06-10').map((c: { game: { id: string } }) => c.game.id), ['m1']);
});

test('open gate: the MILB paths were read', () => {
  assert.ok(fake.reads.milbTeams > 0 && fake.reads.milbPromos > 0 && fake.reads.milbGames > 0);
});
