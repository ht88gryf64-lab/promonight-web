// What the two page bodies put in the HTML. These assert on the markup a
// crawler would receive from the server render, built from the captured
// documents through the real mapper and the real view builder.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import type { ReactNode } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { mapBracketDoc } from '../../../lib/postseason/map';
import { buildLeagueView, homeGamesThisWeek, nextHomeGames, type LeagueView } from '../../../lib/postseason/view';
import { CAPTURED_AT, FIXTURE, IN_GAME_AT, clubs, loadDoc, parks, rawText } from '../../../lib/postseason/__tests__/helpers';
import { PlayoffsHub, type HubLeague } from '../PlayoffsHub';
import { PlayoffsLeague, type LeagueBody } from '../PlayoffsLeague';
import { PREDICTIONS_COPY } from '../PredictionsCard';

type Doc = Record<string, unknown>;
type RawSeries = Doc & { games: Doc[]; higher: Doc; lower: Doc };

function view(name: string, now: Date = CAPTURED_AT, edit?: (d: Doc) => void): LeagueView {
  const d = loadDoc(name);
  if (edit) edit(d);
  const b = mapBracketDoc(d, { league: d.league as 'MLB' | 'WNBA', season: d.season as number });
  assert.ok(b);
  const v = buildLeagueView(b, clubs(), parks(), now);
  assert.ok(v);
  return v;
}

// Ticket buttons are rendered by the page and passed in. A marker stands in
// for them here; their own tagging is tested in tickets.test.tsx.
const stubTickets = (ids: string[]): Record<string, ReactNode> =>
  Object.fromEntries(ids.map((id) => [id, <span data-tickets-for={id}>tickets</span>]));

function leagueHtml(v: LeagueView, opts: { locked?: boolean; now?: Date; others?: { league: 'MLB' | 'WNBA'; href: string }[] } = {}): string {
  const weekGames = v.phase.kind === 'active' ? homeGamesThisWeek(v, opts.now ?? CAPTURED_AT) : [];
  const body: LeagueBody = { state: 'ok', view: v, predictionsLocked: opts.locked ?? true, weekGames };
  return renderToStaticMarkup(
    <PlayoffsLeague
      league={v.league}
      season={v.season}
      body={body}
      tickets={stubTickets(weekGames.map((g) => g.hostTeamId))}
      otherLeagues={opts.others ?? []}
    />,
  );
}

function hubHtml(leagues: HubLeague[]): string {
  const active = leagues.flatMap((l) => (l.state === 'ok' && l.view.phase.kind === 'active' ? [l.view] : []));
  const next = nextHomeGames(active, 8);
  return renderToStaticMarkup(
    <PlayoffsHub season={2026} leagues={leagues} nextGames={next} tickets={stubTickets(next.map((g) => g.hostTeamId))} />,
  );
}
const ok = (v: LeagueView, locked = true): HubLeague => ({
  state: 'ok',
  league: v.league,
  href: `/playoffs/${v.league.toLowerCase()}`,
  view: v,
  predictionsLocked: locked,
});

/** Visible text: tags out, entities back, whitespace collapsed. */
function textOf(html: string): string {
  return html
    .replace(/<[^>]+>/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&#x27;/g, "'")
    .replace(/&quot;/g, '"')
    .replace(/\s+/g, ' ')
    .trim();
}
const count = (html: string, needle: string) => html.split(needle).length - 1;

/** The element whose opening tag holds `marker`, from its "<" to its first
 *  closing tag. Only used on elements that nest none of their own kind. */
function element(html: string, marker: string): string {
  const at = html.indexOf(marker);
  assert.ok(at >= 0, `${marker} is in the markup`);
  const open = html.lastIndexOf('<', at);
  const tag = /^<([a-z0-9]+)/.exec(html.slice(open))?.[1];
  assert.ok(tag);
  const close = html.indexOf(`</${tag}>`, at);
  return html.slice(open, close + tag.length + 3);
}

/** The markup with every in-progress badge removed. What is left must not
 *  contain the word at all. */
const withoutBadges = (html: string) => html.replace(/<span data-game-state="live"[^>]*>Live<\/span>/g, '');

const FRESHNESS_WORDS = /\bhourly\b|\breal[- ]time\b|\blive\b|\bup to the minute\b|\bminute by minute\b/i;

const EVERY_VIEW: [string, () => LeagueView][] = [
  ['MLB live capture', () => view(FIXTURE.mlbLive)],
  ['MLB in-game capture', () => view(FIXTURE.mlbInGame, IN_GAME_AT)],
  ['WNBA live capture', () => view(FIXTURE.wnbaLive)],
  ['MLB 2025 final', () => view(FIXTURE.mlbFinal, new Date('2025-11-02T04:00:00Z'))],
  ['WNBA 2025 final', () => view(FIXTURE.wnbaFinal, new Date('2025-10-11T04:00:00Z'))],
  ['MLB 2025 mixed', () => view(FIXTURE.mlbMixed, new Date('2025-10-09T03:08:00Z'))],
  ['WNBA 2025 mixed', () => view(FIXTURE.wnbaMixed, new Date('2025-09-19T05:30:00Z'))],
];

// ---- The league page ----

test('LEAGUE: breadcrumb, heading, and the absolute change stamp', () => {
  const html = leagueHtml(view(FIXTURE.mlbLive));
  const text = textOf(html);
  assert.ok(html.includes('<nav aria-label="Breadcrumb">'));
  assert.ok(html.includes('<a class="text-rd-red transition-colors hover:text-rd-red-dark" href="/playoffs">Playoffs</a>'));
  assert.equal(count(html, '<h1'), 1);
  assert.match(html, /<h1[^>]*>2026 MLB Playoffs<\/h1>/);
  assert.ok(text.includes('Bracket updated Sep 29, 1:10 PM ET'));
  assert.equal(count(html, 'data-bracket-updated'), 1);
  assert.equal(count(html, 'data-lede'), 1);
});

test('LEAGUE: every round is a section under the document label, every series is in it', () => {
  const html = leagueHtml(view(FIXTURE.mlbLive));
  for (const [key, label] of [['wild_card', 'Wild Card Series'], ['division_series', 'Division Series'], ['championship_series', 'Championship Series'], ['world_series', 'World Series']]) {
    assert.ok(html.includes(`<section aria-labelledby="round-${key}" data-round="${key}"`), key);
    assert.match(html, new RegExp(`<h2 id="round-${key}"[^>]*>${label}</h2>`));
  }
  assert.equal(count(html, 'data-series="'), 11);
  for (const id of ['wild_card-1', 'wild_card-2', 'wild_card-3', 'wild_card-4', 'division_series-1', 'division_series-2', 'division_series-3', 'division_series-4', 'championship_series-1', 'championship_series-2', 'world_series-1']) {
    assert.equal(count(html, `data-series="${id}"`), 1, id);
  }
  // Rounds appear in the document's order.
  const at = (k: string) => html.indexOf(`data-round="${k}"`);
  assert.ok(at('wild_card') < at('division_series') && at('division_series') < at('championship_series') && at('championship_series') < at('world_series'));
  assert.equal(count(html, 'Current round'), 1);
});

test('LEAGUE: seeds, clubs linked to their team pages, and the next game', () => {
  const html = leagueHtml(view(FIXTURE.mlbLive));
  const text = textOf(html);
  assert.ok(html.includes('aria-label="Seed 3"'));
  assert.ok(html.includes('aria-label="Seed 6"'));
  assert.match(html, /<a [^>]*href="\/mlb\/houston-astros"[^>]*>Astros<\/a>/);
  assert.match(html, /<a [^>]*href="\/mlb\/chicago-white-sox"[^>]*>White Sox<\/a>/);
  assert.ok(text.includes('Next: Game 1 · Tue, Sep 29 · 5:00 PM ET'));
  assert.ok(text.includes('Host: Astros · Daikin Park'));
  assert.ok(text.includes('Best of 5 · 2-2-1'));
});

test('PLACEHOLDERS: a slot with no club is a dashed box holding the stored label, with no link', () => {
  const html = leagueHtml(view(FIXTURE.mlbLive));
  // 4 Division Series visitors, 4 Championship Series slots, 2 World Series slots.
  assert.equal(count(html, 'data-slot="placeholder"'), 10);
  assert.equal(count(html, 'data-slot="club"'), 12);
  for (const label of ['NYY/BOS', 'HOU/CWS', 'SD/CHC', 'ATL/PHI', 'AL Higher Seed', 'AL Lower Seed', 'NL Higher Seed', 'NL Lower Seed', 'Higher Seed League Champion', 'Lower Seed League Champion']) {
    assert.match(html, new RegExp(`<div data-slot="placeholder" class="[^"]*border-dashed[^"]*">(?:<span[^>]*>\\d+</span>)?<span class="min-w-0">${label}</span></div>`), label);
  }
  // The Division Series card for the Rays names the Rays and the stored
  // label, and no other club.
  const card = html.slice(html.indexOf('data-series="division_series-1"'), html.indexOf('data-series="division_series-2"'));
  assert.ok(card.includes('>Rays</a>'));
  assert.equal(count(card, '<a '), 1);
  assert.ok(!card.includes('Yankees') && !card.includes('Red Sox'));
});

test('OVERLAY: a published feeder pair renders the composed text, still unlinked and dashed', () => {
  const v = view(FIXTURE.mlbLive, CAPTURED_AT, (d) => {
    const s = (d.series as RawSeries[]).find((x) => x.seriesKey === 'AL-DS-A') as RawSeries;
    Object.assign(s.lower, { feederSeriesKey: 'AL-WC-B', candidates: ['new-york-yankees', 'boston-red-sox'] });
  });
  const html = leagueHtml(v);
  const card = html.slice(html.indexOf('data-series="division_series-1"'), html.indexOf('data-series="division_series-2"'));
  assert.ok(card.includes('<span class="min-w-0">Yankees / Red Sox winner</span>'));
  assert.ok(!card.includes('NYY/BOS'));
  assert.equal(count(card, '<a '), 1, 'only the Rays are linked');
});

test('TBD TIME: untimed games read "Time TBD" and the filler instant is nowhere', () => {
  const html = leagueHtml(view(FIXTURE.mlbLive));
  const text = textOf(html);
  // 41 of the 53 games in the capture carry no start time.
  const d = JSON.parse(rawText(FIXTURE.mlbLive)) as { series: { games: { startTimeTBD: boolean }[] }[] };
  const untimed = d.series.flatMap((s) => s.games).filter((g) => g.startTimeTBD).length;
  assert.equal(untimed, 41);
  assert.ok(count(text, 'Time TBD') >= untimed);
  assert.ok(!/\b3:33|\b7:33|\b11:33/.test(text));
});

test('SERIES SCORE: wins per side, the leader, and results', () => {
  const html = leagueHtml(view(FIXTURE.wnbaLive));
  const text = textOf(html);
  const card = html.slice(html.indexOf('data-series="first_round-1"'), html.indexOf('data-series="first_round-2"'));
  assert.ok(card.includes('data-series-status="live"'));
  assert.ok(card.includes('aria-label="0 wins"'));
  assert.ok(card.includes('aria-label="1 win"'));
  assert.ok(textOf(card).includes('NYL leads 1-0'));
  assert.ok(textOf(card).includes('Final: NYL 91, MIN 75'));
  assert.ok(textOf(card).includes('If necessary'));
  // An upcoming series shows no win counts at all.
  const mlb = leagueHtml(view(FIXTURE.mlbLive));
  assert.equal(count(mlb, 'aria-label="0 wins"'), 0);
  assert.ok(text.includes('Matchup to be decided'));
});

test('IN PROGRESS (captured): the league page and the hub mark the game under way, with no score', () => {
  const v = view(FIXTURE.mlbInGame, IN_GAME_AT);
  const page = leagueHtml(v, { now: IN_GAME_AT });
  // The card header and the game row, for the one game under way.
  assert.equal(count(page, 'data-game-state="live"'), 2);
  const card = page.slice(page.indexOf('data-series="wild_card-3"'), page.indexOf('data-series="wild_card-4"'));
  assert.equal(count(card, 'data-game-state="live"'), 2);
  assert.ok(card.includes('data-series-status="live"'));
  assert.ok(textOf(card).includes('Game 1 in progress · Host: Braves · Truist Park'));
  assert.ok(!textOf(card).includes('Final'));
  assert.ok(!/\b(PHI|ATL) 1\b/.test(textOf(card)), 'the score in progress is not shown');
  assert.ok(textOf(page).includes('Bracket updated Sep 29, 2:51 PM ET'));
  // The game under way is not sold as an upcoming one.
  assert.equal(count(page, 'data-home-game="MLB-wild_card-3-g1"'), 0);
  assert.equal(count(page, 'data-home-game="MLB-wild_card-3-g2"'), 1);

  const hub = hubHtml([ok(v)]);
  assert.equal(count(hub, 'data-game-state="live"'), 1);
  const line = element(hub, 'data-series="wild_card-3"');
  assert.ok(line.includes('data-game-state="live"'));
  assert.ok(textOf(line).includes('Braves vs Phillies'));
  assert.ok(textOf(line).includes('Game 1'));
});

test('IN PROGRESS: one badge per place a game is under way, and no score', () => {
  const v = view(FIXTURE.wnbaLive, CAPTURED_AT, (d) => {
    const g = ((d.series as RawSeries[]).find((x) => x.seriesKey === 'R1-1v8') as RawSeries).games[1];
    g.status = 'live';
    g.homeScore = 41;
    g.awayScore = 38;
  });
  const html = leagueHtml(v);
  // The card header and the game row.
  assert.equal(count(html, 'data-game-state="live"'), 2);
  const card = html.slice(html.indexOf('data-series="first_round-1"'), html.indexOf('data-series="first_round-2"'));
  assert.ok(textOf(card).includes('Game 2 in progress'));
  assert.ok(!/\b41\b/.test(textOf(card)) && !/\b38\b/.test(textOf(card)));
});

test('CONCLUDED: the champion is named, nothing is "next", no home games are offered', () => {
  const html = leagueHtml(view(FIXTURE.mlbFinal, new Date('2025-11-02T04:00:00Z')), { now: new Date('2025-11-02T04:00:00Z') });
  const text = textOf(html);
  assert.ok(html.includes('data-champion="los-angeles-dodgers"'));
  assert.ok(text.includes('2025 champion Los Angeles Dodgers Won the World Series 4-3'));
  assert.ok(!text.includes('Next:'));
  assert.ok(!text.includes('Home games this week'));
  assert.equal(count(html, 'Current round'), 0);
  assert.equal(count(html, 'data-series-status="final"'), 11);
});

test('UNAVAILABLE: a missing or unreadable document renders that, and no bracket', () => {
  for (const state of ['missing', 'unavailable'] as const) {
    const html = renderToStaticMarkup(
      <PlayoffsLeague league="MLB" season={2026} body={{ state }} tickets={{}} otherLeagues={[{ league: 'WNBA', href: '/playoffs/wnba' }]} />,
    );
    const text = textOf(html);
    assert.ok(html.includes('data-bracket-state="unavailable"'), state);
    assert.ok(text.includes('Bracket not available'));
    assert.match(html, /<h1[^>]*>2026 MLB Playoffs<\/h1>/);
    assert.equal(count(html, 'data-series="'), 0);
    assert.equal(count(html, 'data-round="'), 0);
    assert.equal(count(html, 'data-bracket-updated'), 0);
    assert.equal(count(html, 'data-lede'), 0, 'no description of a bracket that is not shown');
    assert.ok(!text.includes('every series'));
    assert.equal(count(html, 'data-predictions'), 0);
    assert.ok(!text.includes('Home games this week'));
    assert.ok(html.includes('href="/playoffs/wnba"'), 'the way to the other league still works');
  }
});

test('PREDICTIONS: shown only when the inputs are frozen, and it names no date', () => {
  const on = leagueHtml(view(FIXTURE.mlbLive), { locked: true });
  const off = leagueHtml(view(FIXTURE.mlbLive), { locked: false });
  assert.equal(count(on, 'data-predictions="locked"'), 1);
  assert.equal(count(off, 'data-predictions="locked"'), 0);
  assert.ok(!textOf(off).includes('Our Predictions'));
  const card = element(on, 'data-predictions="locked"');
  const section = textOf(card);
  assert.ok(section.includes('Our Predictions'));
  assert.ok(section.includes(PREDICTIONS_COPY));
  assert.ok(!/\d/.test(section), 'the predictions card holds no digit, so no date');
  assert.ok(!/\b(January|February|March|April|May|June|July|August|September|October|November|December|Jan|Feb|Mar|Apr|Jun|Jul|Aug|Sep|Sept|Oct|Nov|Dec|Monday|Tuesday|Wednesday|Thursday|Friday|Saturday|Sunday|tomorrow|tonight|today|week)\b/i.test(section));
  // The lock is an inline SVG.
  assert.match(card, /<svg[^>]*aria-hidden="true"[^>]*>/);
  assert.ok(!/[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}]/u.test(card), 'no emoji stands in for the lock');
});

test('HOME GAMES: this week, each with its park and its ticket buttons', () => {
  const v = view(FIXTURE.mlbLive);
  const html = leagueHtml(v);
  const week = homeGamesThisWeek(v, CAPTURED_AT);
  assert.equal(count(html, 'data-home-game="'), week.length);
  const first = element(html, 'data-home-game="MLB-wild_card-3-g1"');
  const row = textOf(first);
  assert.ok(row.includes('Phillies at Braves'));
  assert.ok(row.includes('Wild Card Series · Game 1'));
  assert.ok(row.includes('Tue, Sep 29 · 2:00 PM ET'));
  assert.ok(row.includes('Truist Park'));
  assert.ok(first.includes('data-tickets-for="atlanta-braves"'));
});

test('CROSS LINK: only the leagues passed in are linked', () => {
  const v = view(FIXTURE.mlbLive);
  assert.ok(leagueHtml(v, { others: [{ league: 'WNBA', href: '/playoffs/wnba' }] }).includes('Open the WNBA bracket'));
  assert.ok(!leagueHtml(v, { others: [] }).includes('Open the WNBA bracket'));
});

// ---- The hub ----

test('HUB: header, one card per league, current round, a line per series, a link each', () => {
  const html = hubHtml([ok(view(FIXTURE.mlbLive)), ok(view(FIXTURE.wnbaLive))]);
  const text = textOf(html);
  assert.equal(count(html, '<h1'), 1);
  assert.match(html, /<h1[^>]*>Playoffs<\/h1>/);
  assert.ok(text.includes('Postseason 2026'));
  assert.equal(count(html, 'data-league-card="'), 2);
  const mlb = html.slice(html.indexOf('data-league-card="MLB"'), html.indexOf('data-league-card="WNBA"'));
  assert.ok(textOf(mlb).includes('Wild Card Series'));
  assert.equal(count(mlb, 'data-series="'), 4, 'the four series of the round being played');
  assert.ok(textOf(mlb).includes('Astros vs White Sox Game 1 · Tue, Sep 29 · 5:00 PM ET'));
  assert.ok(mlb.includes('href="/playoffs/mlb"'));
  assert.ok(textOf(mlb).includes('Open the MLB bracket'));
  const wnba = html.slice(html.indexOf('data-league-card="WNBA"'));
  assert.ok(textOf(wnba).includes('First Round'));
  assert.ok(textOf(wnba).includes('Lynx vs Liberty NYL leads 1-0'));
  assert.ok(wnba.includes('href="/playoffs/wnba"'));
  assert.equal(count(html, 'data-hub-state="offseason"'), 0);
  // Every status on a card is as of that bracket's own change stamp.
  assert.equal(count(html, 'data-bracket-updated'), 2);
  assert.ok(textOf(mlb).includes('Bracket updated Sep 29, 1:10 PM ET'));
  assert.ok(textOf(wnba).includes('Bracket updated Sep 28, 8:02 PM ET'));
});

test('HUB: next home games across leagues, with park and tickets', () => {
  const html = hubHtml([ok(view(FIXTURE.mlbLive)), ok(view(FIXTURE.wnbaLive))]);
  assert.equal(count(html, 'data-home-game="'), 8);
  const third = element(html, 'data-home-game="WNBA-first_round-3-g2"');
  const row = textOf(third);
  assert.ok(row.includes('Aces at Fever'));
  assert.ok(row.includes('WNBA'));
  assert.ok(row.includes('First Round · Game 2'));
  assert.ok(row.includes('Tue, Sep 29 · 6:30 PM ET'));
  assert.ok(row.includes('Gainbridge Fieldhouse'));
  assert.ok(third.includes('data-tickets-for="indiana-fever"'));
});

test('HUB: a concluded league shows its champion and offers no games', () => {
  const html = hubHtml([ok(view(FIXTURE.mlbFinal, new Date('2025-11-02T04:00:00Z')))]);
  const text = textOf(html);
  assert.ok(text.includes('2025 champion Los Angeles Dodgers Won the World Series 4-3'));
  assert.ok(html.includes('href="/mlb/los-angeles-dodgers"'));
  assert.ok(!text.includes('Next home games'));
  assert.equal(count(html, 'data-predictions'), 0, 'the locked card is for a postseason still being played');
});

test('HUB: no league at all is the offseason state, with no date in it', () => {
  const html = hubHtml([]);
  const text = textOf(html);
  assert.equal(count(html, 'data-hub-state="offseason"'), 1);
  assert.ok(text.includes('No postseason is underway'));
  assert.equal(count(html, 'data-league-card="'), 0);
  assert.ok(!text.includes('Next home games'));
  const block = textOf(element(html, 'data-hub-state="offseason"'));
  assert.ok(block.includes('No postseason is underway'));
  assert.ok(element(html, 'data-hub-state="offseason"').includes('href="/teams"'));
  assert.ok(!/\d/.test(block), 'the offseason state holds no digit, so no date');
});

test('HUB: an unreadable league gets a card that says so, and the hub does not claim an offseason', () => {
  const html = hubHtml([{ state: 'unavailable', league: 'MLB', href: '/playoffs/mlb' }]);
  const text = textOf(html);
  assert.equal(count(html, 'data-league-card="MLB"'), 1);
  assert.ok(text.includes('The MLB bracket is not available right now.'));
  assert.equal(count(html, 'data-hub-state="offseason"'), 0);
  assert.ok(!text.includes('No postseason is underway'));
  assert.equal(count(html, 'data-bracket-updated'), 0, 'a bracket that was not read has no stamp to show');
  // Beside a league that did load, the loaded one is unaffected.
  const both = hubHtml([{ state: 'unavailable', league: 'MLB', href: '/playoffs/mlb' }, ok(view(FIXTURE.wnbaLive))]);
  assert.equal(count(both, 'data-league-card="'), 2);
  assert.ok(textOf(both).includes('Lynx vs Liberty NYL leads 1-0'));
});

test('HUB: the locked card needs a league that is both playing and frozen', () => {
  const v = view(FIXTURE.mlbLive);
  assert.equal(count(hubHtml([ok(v, true)]), 'data-predictions="locked"'), 1);
  assert.equal(count(hubHtml([ok(v, false)]), 'data-predictions="locked"'), 0);
  const html = hubHtml([ok(v, true)]);
  const section = textOf(element(html, 'data-predictions="locked"'));
  assert.ok(section.includes('Predictions are locked'));
  assert.ok(!/\d/.test(section));
});

// ---- The feeder key, and every other pipeline series key ----
//
// OVERLAY. The ruling of 2026-09-29: a slot with a feeder key and no
// candidates renders its stored label, and the key appears nowhere in the HTML.
test('FEEDER KEY: a slot with feederSeriesKey "AL-WC-B" and no candidates renders its label, and "AL-WC-B" is nowhere', () => {
  for (const extra of [{ feederSeriesKey: 'AL-WC-B', candidates: null }, { feederSeriesKey: 'AL-WC-B' }]) {
    const v = view(FIXTURE.mlbLive, CAPTURED_AT, (d) => {
      const s = (d.series as RawSeries[]).find((x) => x.seriesKey === 'AL-DS-A') as RawSeries;
      Object.assign(s.lower, extra);
    });
    const page = leagueHtml(v);
    const card = element(page, 'data-series="division_series-1"');
    assert.match(card, /<div data-slot="placeholder" class="[^"]*border-dashed[^"]*"><span class="min-w-0">NYY\/BOS<\/span><\/div>/);
    assert.equal(count(page, 'AL-WC-B'), 0, 'the feeder key is in the league page');
    assert.equal(count(hubHtml([ok(v)]), 'AL-WC-B'), 0, 'the feeder key is in the hub');
  }
});

test('FEEDER KEY: with candidates the composed text renders, and "AL-WC-B" is still nowhere', () => {
  const v = view(FIXTURE.mlbLive, CAPTURED_AT, (d) => {
    const s = (d.series as RawSeries[]).find((x) => x.seriesKey === 'AL-DS-A') as RawSeries;
    Object.assign(s.lower, { feederSeriesKey: 'AL-WC-B', candidates: ['new-york-yankees', 'boston-red-sox'] });
  });
  const page = leagueHtml(v);
  assert.ok(page.includes('<span class="min-w-0">Yankees / Red Sox winner</span>'));
  assert.equal(count(page, 'AL-WC-B'), 0);
  assert.equal(count(hubHtml([ok(v)]), 'AL-WC-B'), 0);
});

// ---- Properties of every page ----

for (const [name, make] of EVERY_VIEW) {
  test(`CLAIMS (${name}): no freshness wording, and "live" only as a game state`, () => {
    const v = make();
    const now = v.updatedLabel ? undefined : CAPTURED_AT;
    for (const html of [leagueHtml(v, { now }), hubHtml([ok(v)])]) {
      const text = textOf(withoutBadges(html));
      assert.ok(!FRESHNESS_WORDS.test(text), `found ${text.match(FRESHNESS_WORDS)?.[0]}`);
      assert.ok(!/\bupdated (every|each)\b/i.test(text));
    }
  });

  test(`LEAKS (${name}): no operator value, no raw slug, no empty rendering`, () => {
    const v = make();
    const fixture = { 'MLB live capture': FIXTURE.mlbLive, 'MLB in-game capture': FIXTURE.mlbInGame, 'WNBA live capture': FIXTURE.wnbaLive, 'MLB 2025 final': FIXTURE.mlbFinal, 'WNBA 2025 final': FIXTURE.wnbaFinal, 'MLB 2025 mixed': FIXTURE.mlbMixed, 'WNBA 2025 mixed': FIXTURE.wnbaMixed }[name] as string;
    const d = JSON.parse(rawText(fixture)) as Doc & { seeds: Doc; source: { urls: string[] }; series: RawSeries[] };
    for (const html of [leagueHtml(v), hubHtml([ok(v)])]) {
      for (const secret of [d.runId, d.bracketSha256, d.lastRevalidatedSha256, d.validatedSeedSha256, d.seeds.authoredBy, d.seeds.file, ...d.source.urls]) {
        if (typeof secret !== 'string') continue;
        assert.ok(!html.includes(secret), `${secret.slice(0, 24)} is in the markup`);
      }
      for (const s of d.series) for (const g of s.games) assert.ok(!html.includes(String(g.gameId)), `feed game id ${g.gameId} is in the markup`);
      // No pipeline series key, as an attribute value or as text. "F" and
      // "WS" are too short to search for bare, so the short ones are
      // checked where a key would sit: quoted, or as a whole word of text.
      for (const s of d.series) {
        const key = s.seriesKey as string;
        assert.ok(!html.includes(`"${key}"`), `series key ${key} is an attribute value in the markup`);
        if (key.length >= 4) assert.ok(!html.includes(key), `series key ${key} is in the markup`);
        else assert.ok(!new RegExp(`(^| )${key}( |$)`).test(textOf(html)), `series key ${key} is text in the markup`);
      }
      const text = textOf(html);
      assert.ok(!/\b(undefined|null|NaN|\[object Object\])\b/.test(text));
      assert.ok(!/[\u2014\u2013]/.test(html), 'an em or en dash is in the markup');
      assert.ok(!/<aside\b/.test(html), 'an aside would be taken for the ad sidebar');
    }
  });
}
