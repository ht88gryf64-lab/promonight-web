// What the MLS playoffs pages and modules put in the HTML, from the four MLS
// fixtures through the real mapper, view and components. What passes is what
// a reader with scripts off, or a crawler, receives.
import { test, mock } from 'node:test';
import assert from 'node:assert/strict';
import type { ReactNode } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { mapBracketDoc } from '../../../lib/postseason/map';
import { buildLeagueView, homeGamesWindow, type LeagueView } from '../../../lib/postseason/view';
import { gameStarts, standingLine } from '../../../lib/postseason/standing';
import { clubPlayoffs, leagueCard, venueGames, type InboundLeague } from '../../../lib/postseason/inbound';
import { FIXTURE, MLS_AT, MLS_FIXTURE, clubs, loadDoc, mlsClubs, mlsParks, parks, rawText, seriesKeyIn } from '../../../lib/postseason/__tests__/helpers';
import type { Bracket } from '../../../lib/postseason/types';
import { PlayoffsHub, type HubLeague } from '../PlayoffsHub';
import { PlayoffsLeague, type LeagueBody } from '../PlayoffsLeague';
import { TeamPlayoffsModule } from '../inbound/TeamPlayoffsModule';
import { LeaguePlayoffsCard } from '../inbound/LeaguePlayoffsCard';

// The venue card imports the venue page's server-only parts.
mock.module('server-only', { namedExports: {} });
mock.module(new URL('../../../lib/firebase.ts', import.meta.url).href, { namedExports: { db: {} } });
const venueModule = () => import('../inbound/VenuePostseasonGames');

type Doc = Record<string, unknown>;
type RawSeries = Doc & { seriesKey: string; games: Doc[] };
const raw = (d: Doc, key: string): RawSeries => (d.series as RawSeries[]).find((s) => s.seriesKey === key) as RawSeries;

function build(name: string, now: Date, edit?: (d: Doc) => void): { b: Bracket; v: LeagueView } {
  const d = loadDoc(name);
  if (edit) edit(d);
  const b = mapBracketDoc(d, { league: 'MLS', season: 2026 });
  assert.ok(b, name);
  const v = buildLeagueView(b, mlsClubs(), mlsParks(), now);
  assert.ok(v, name);
  return { b, v };
}
const rowTickets = (ids: string[]): Record<string, ReactNode> => Object.fromEntries(ids.map((id) => [id, <span data-tickets-for={id}>ticket</span>]));

function leagueHtml(name: string, now: Date, edit?: (d: Doc) => void): string {
  const { b, v } = build(name, now, edit);
  const homeGames = v.phase.kind === 'active' ? homeGamesWindow([v], now) : { primary: [], rest: [] };
  const body: LeagueBody = { state: 'ok', view: v, predictions: null, homeGames, standing: standingLine(v, gameStarts(b), now) };
  return renderToStaticMarkup(
    <PlayoffsLeague league="MLS" season={2026} body={body} tickets={rowTickets([...homeGames.primary, ...homeGames.rest].map((g) => g.hostTeamId))} panelTickets={{}} otherLeagues={[]} />,
  );
}
function textOf(html: string): string {
  return html
    .replace(/<(style|script|noscript)\b[\s\S]*?<\/\1>/g, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&#x27;/g, "'")
    .replace(/&quot;/g, '"')
    .replace(/\s+/g, ' ')
    .trim();
}
function element(html: string, marker: string): string {
  const at = html.indexOf(marker);
  assert.ok(at >= 0, `${marker} is in the markup`);
  const open = html.lastIndexOf('<', at);
  const tag = /^<([a-z0-9]+)/.exec(html.slice(open))?.[1] as string;
  const re = new RegExp(`<${tag}\\b[^>]*>|</${tag}>`, 'g');
  re.lastIndex = open;
  let depth = 0;
  for (let m = re.exec(html); m; m = re.exec(html)) {
    if (m[0].startsWith('</')) depth -= 1;
    else if (!m[0].endsWith('/>')) depth += 1;
    if (depth === 0) return html.slice(open, m.index + m[0].length);
  }
  assert.fail(`${marker}: the element never closes`);
}

const STATES: [string, string, Date][] = [
  ['decision day', MLS_FIXTURE.decisionDay, MLS_AT.decisionDay],
  ['early', MLS_FIXTURE.early, MLS_AT.early],
  ['round one', MLS_FIXTURE.roundOne, MLS_AT.roundOne],
  ['semifinals done', MLS_FIXTURE.semisDone, MLS_AT.semisDone],
  ['final', MLS_FIXTURE.final, MLS_AT.final],
];
const KEYS = ['E-WC', 'W-WC', 'E-R1-1', 'E-R1-2', 'E-R1-3', 'E-R1-4', 'W-R1-1', 'W-R1-2', 'W-R1-3', 'W-R1-4', 'E-SF-A', 'E-SF-B', 'W-SF-A', 'W-SF-B', 'E-CF', 'W-CF', 'CUP'];

function assertClean(html: string, fixture: string, where: string) {
  const text = textOf(html);
  assert.equal(seriesKeyIn(html), null, `${where}: ${seriesKeyIn(html)}`);
  for (const k of KEYS) {
    assert.ok(!html.includes(`"${k}"`) && !html.includes(`#${k}"`), `${where}: key ${k}`);
    if (k.length >= 4) assert.ok(!html.includes(k), `${where}: key ${k}`);
  }
  assert.ok(!/(^| )CUP( |$)/.test(text), `${where}: CUP as text`);
  for (const id of (rawText(fixture).match(/"gameId": "(\d+)"/g) ?? []).map((m) => m.split('"')[3])) assert.ok(!html.includes(id), `${where}: game id ${id}`);
  for (const leak of ['fixture-run', 'f1x7ure', 'Fixture Author', 'feederSeriesKey', 'writerVersion', 'decidedBy', 'homeShootout', 'Winner of']) assert.ok(!html.includes(leak), `${where}: ${leak}`);
  // No freshness claim of any kind, and no badge.
  assert.ok(!/\blive\b|in progress|under way|real[- ]time|\bhourly\b/i.test(text), `${where}: ${(/.{40}(\blive\b|in progress).{20}/i.exec(text) ?? [''])[0]}`);
  assert.ok(!html.includes('data-game-state'), `${where}: a badge`);
  // Single-game wording, and no predictions or promotions.
  assert.ok(!/Best of 1\b|won 1-0\b|Won the [^.]* 1-0\b/.test(text), where);
  assert.ok(!/PromoNight Predicts|predictions|simulation|PromoNight's pick/i.test(text), `${where}: predictions`);
  assert.ok(!html.includes('data-predictions') && !html.includes('data-game-promo'), `${where}: predictions or promo markup`);
  // No bare "TBD" slot, and no seed beside a slot with no club.
  assert.ok(!/(?<!Time |Date )\bTBD\b/.test(text), `${where}: TBD`);
  assert.ok(!/Seed \d+ (TBD|To be decided)/.test(text), `${where}: a seed on an empty slot`);
  // No article before an MLS club name.
  assert.ok(!/\bthe (Minnesota|Seattle|Vancouver|LAFC|Inter Miami|Philadelphia|San Diego|Chicago Fire|FC |New York City|Charlotte|Columbus|Nashville|Portland|Austin|Orlando|Real Salt)/.test(text), `${where}: ${(/.{30}\bthe (Minnesota|Seattle|Vancouver|LAFC|Inter Miami|Philadelphia|San Diego).{20}/.exec(text) ?? [''])[0]}`);
}

for (const [name, fixture, now] of STATES) {
  test(`LEAGUE PAGE, ${name}: no key, id, live claim, predictions, promotion or "Best of 1"`, () => {
    const html = leagueHtml(fixture, now);
    assertClean(html, fixture, name);
    const text = textOf(html);
    assert.ok(text.includes('2026 MLS Playoffs'));
    assert.ok(text.includes('The 2026 MLS postseason bracket: every matchup, seed and result, with game times in Eastern.'));
    assert.ok(html.includes('data-bracket-updated'), 'the bracket change stamp stays');
    assert.ok(text.includes('Single game'));
  });
}

test('NO "live" ANYWHERE: the MLS page markup, the view and the series index (the client payload) never carry the word, as copy or as a token', () => {
  const liveWord = (x: string) => /.{0,40}\blive\b.{0,20}/i.exec(x.replace(/aria-live="[a-z]+"/g, ''));
  for (const [name, fixture, now] of STATES) {
    const html = leagueHtml(fixture, now);
    const hit = liveWord(html);
    assert.equal(hit, null, `${name}: ${hit?.[0]}`);
    const { v } = build(fixture, now);
    // What the client components are handed: the rounds, and the index the
    // controls are built from (PlayoffsLeague's seriesIndex).
    const payload = JSON.stringify([v, v.rounds.flatMap((r) => r.groups.flatMap((g) => g.series.map((x) => ({ id: x.id, round: x.round, conference: x.conference, status: x.status }))))]);
    const p = liveWord(payload.replace(/"liveLabel":null/g, ''));
    assert.equal(p, null, `${name} payload: ${p?.[0]}`);
  }
  // Round One mid-series is "underway".
  assert.ok(leagueHtml(MLS_FIXTURE.roundOne, MLS_AT.roundOne).includes('data-series-status="underway"'));
});

test('LEAGUE PAGE: a one-game round has no win count and no "G1"; Round One keeps both', () => {
  const html = leagueHtml(MLS_FIXTURE.semisDone, MLS_AT.semisDone);
  const single = element(html, 'data-series-panel="conference_semifinals-4"');
  assert.ok(!/>G<!-- -->1<|>G1</.test(single), 'no G1 in the single game row');
  assert.ok(textOf(single).includes('Final: VAN 2, LAFC 2, VAN won 4-3 on penalties'), textOf(single));
  assert.ok(textOf(single).includes('Vancouver Whitecaps beat LAFC 4-3 on penalties after a 2-2 draw'));
  const singleCard = element(html, 'data-series="conference_semifinals-4"');
  assert.ok(!/ wins?<\/span>/.test(singleCard), 'no win count on a one-game card');
  const r1Card = element(html, 'data-series="round_one-8"');
  assert.ok(/ wins?<\/span>/.test(r1Card), 'Round One shows its wins');
  const r1 = element(html, 'data-series-panel="round_one-8"');
  assert.ok(/G1/.test(textOf(r1).replace(/\s/g, '')));
  assert.ok(textOf(r1).includes('Final: MIN 3, SEA 3, MIN won 7-6 on penalties'));
  assert.ok(!textOf(r1).includes('If necessary'), 'a played Game 3 is not "if necessary"');
  // The results section: the one-game round's result without a G1.
  const results = element(html, 'data-result="conference_semifinals-4"');
  assert.ok(!/G1/.test(textOf(results)));
});

test('LEAGUE PAGE: a game under way shows only its scheduled time, nowhere a live state', () => {
  const now = new Date('2026-11-22T03:00:00Z');
  const html = leagueHtml(MLS_FIXTURE.roundOne, now, (d) => {
    const s = raw(d, 'W-SF-B');
    s.status = 'live';
    Object.assign(s.games[0], { status: 'live', homeScore: 1, awayScore: 0 });
  });
  assertClean(html, MLS_FIXTURE.roundOne, 'in progress');
  const p = element(html, 'data-series-panel="conference_semifinals-4"');
  assert.ok(textOf(p).includes('Sat, Nov 21 · 9:30 PM ET'));
  assert.ok(!/Final|1-0|VAN 1/.test(textOf(p)), textOf(p));
});

test('LEAGUE PAGE: the article children are the ad contract\'s, and nothing ad-like sits inside the bracket or a details element', () => {
  for (const [name, fixture, now] of STATES) {
    const html = leagueHtml(fixture, now);
    const article = element(html, 'data-playoffs-article=');
    const bracket = element(article, 'data-bracket-child');
    for (const inside of [bracket, ...(article.match(/<details\b[\s\S]*?<\/details>/g) ?? [])]) {
      assert.ok(!/data-ad|adthrive|raptive|AdSlot|ad-slot/i.test(inside), `${name}: an ad marker inside`);
    }
    const standing = /<p data-standing[\s\S]*?<\/p>/.exec(article)?.[0] ?? '';
    assert.ok(!/data-ad/.test(standing));
    assert.equal(article.split('<article').length - 1, 1);
  }
});

test('HUB: MLB and WNBA finished, MLS being played: three cards, MLS first, no predictions line for MLS', () => {
  const now = MLS_AT.roundOne;
  const mlb = buildLeagueView(mapBracketDoc({ ...loadDoc(FIXTURE.mlbFinal), season: 2026 }, { league: 'MLB', season: 2026 })!, clubs(), parks(), now)!;
  const wnba = buildLeagueView(mapBracketDoc({ ...loadDoc(FIXTURE.wnbaFinal), season: 2026 }, { league: 'WNBA', season: 2026 })!, clubs(), parks(), now)!;
  const m = build(MLS_FIXTURE.roundOne, now).v;
  const ok = (v: LeagueView): HubLeague => ({ state: 'ok', league: v.league, href: `/playoffs/${v.league.toLowerCase()}`, view: v, predictions: null });
  const leagues = [ok(mlb), ok(wnba), ok(m)];
  const next = homeGamesWindow([m], now);
  const html = renderToStaticMarkup(<PlayoffsHub season={2026} leagues={leagues} nextGames={next} tickets={rowTickets([...next.primary, ...next.rest].map((g) => g.hostTeamId))} />);
  const order = [...html.matchAll(/data-league-card="([A-Z]+)"/g)].map((x) => x[1]);
  assert.deepEqual(order, ['MLS', 'MLB', 'WNBA']);
  const mlsCard = element(html, 'data-league-card="MLS"');
  assert.ok(textOf(mlsCard).includes('Minnesota United vs Seattle Sounders'));
  assert.ok(textOf(mlsCard).includes('Minnesota United leads the series 1-0'));
  assert.ok(!/\blive\b|in progress/i.test(textOf(mlsCard)));
  assert.ok(!html.includes('data-predictions-league="mls"'));
  assert.equal(seriesKeyIn(html), null);
});

const inbound = (b: Bracket, v: LeagueView): InboundLeague[] => [{ league: 'MLS', href: '/playoffs/mls', view: v, bracket: b }];

test('TEAM MODULE: MLS clubs by their short brand; "See the matchup" for a one-game round, "See the series" for Round One', () => {
  const { b, v } = build(MLS_FIXTURE.roundOne, MLS_AT.roundOne);
  const L = inbound(b, v);
  const min = renderToStaticMarkup(<TeamPlayoffsModule club={clubPlayoffs(L, 'minnesota-united')!} teamId="minnesota-united" teamName="Minnesota United" />);
  assert.ok(textOf(min).includes('Minnesota United vs Seattle Sounders'));
  assert.ok(textOf(min).includes('See the series'));
  assert.ok(textOf(min).includes('Minnesota United leads the series 1-0'));
  const van = renderToStaticMarkup(<TeamPlayoffsModule club={clubPlayoffs(L, 'vancouver-whitecaps')!} teamId="vancouver-whitecaps" teamName="Vancouver Whitecaps" />);
  assert.ok(textOf(van).includes('Vancouver Whitecaps vs LAFC'));
  assert.ok(textOf(van).includes('See the matchup'));
  assert.ok(!textOf(van).includes('series'));
  assert.ok(!van.includes('data-team-pick'));
  const chi = renderToStaticMarkup(<TeamPlayoffsModule club={clubPlayoffs(L, 'chicago-fire')!} teamId="chicago-fire" teamName="Chicago Fire" />);
  assert.ok(textOf(chi).includes('Season over'));
  assert.ok(textOf(chi).includes('Round One: lost to Philadelphia Union 2-0 in the series'));
  for (const html of [min, van, chi]) assertClean(html, MLS_FIXTURE.roundOne, 'team module');
});

test('/mls CARD and VENUE: one-game rows read "Conference Finals", never "Conference Finals · " or "Game 1"', async () => {
  const { VenuePostseasonGames } = await venueModule();
  const { b, v } = build(MLS_FIXTURE.semisDone, MLS_AT.semisDone);
  const L = inbound(b, v);
  const card = renderToStaticMarkup(<LeaguePlayoffsCard card={leagueCard(L, 'MLS')!} surface="web_mls_hub" />);
  assert.ok(textOf(card).includes('New York City FC vs Inter Miami') || textOf(card).includes('Inter Miami vs New York City FC'));
  const venue = renderToStaticMarkup(<VenuePostseasonGames games={venueGames(L, ['inter-miami'])!} buildingSlug="nu-stadium" />);
  const t = textOf(venue);
  assert.ok(t.includes('Conference Finals'), t);
  assert.ok(!/Conference Finals ·\s*(Sat|$)|Game 1/.test(t), t);
  for (const html of [card, venue]) assertClean(html, MLS_FIXTURE.semisDone, 'inbound');
});
