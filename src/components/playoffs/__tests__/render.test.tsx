// What the two page bodies put in the HTML. These assert on the markup the
// server render produces, built from the captured documents through the real
// mapper and the real view builder. Nothing here runs a script: what passes
// is what a reader with scripts off, or a crawler, receives.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import type { ReactNode } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { mapBracketDoc } from '../../../lib/postseason/map';
import { buildLeagueView, homeGamesWindow, type LeagueView } from '../../../lib/postseason/view';
import { CAPTURED_AT, FIELDS_AT, FIXTURE, IN_GAME_AT, LYNX_OUT_AT, buildWithPredictions, clubs, decide, decidedWnba, loadDoc, parks, rawText, seriesKeyIn, PREDICTED } from '../../../lib/postseason/__tests__/helpers';
import type { HubPredictionLine, LeaguePredictions } from '../../../lib/postseason/predictions';
import { PlayoffsHub, type HubLeague } from '../PlayoffsHub';
import { PlayoffsLeague, type LeagueBody } from '../PlayoffsLeague';

type Doc = Record<string, unknown>;
type RawSeries = Doc & { games: Doc[]; higher: Doc; lower: Doc };
type Edit = (d: Doc) => void;

const MIXED_AT = new Date('2025-10-09T03:08:00Z');

function view(name: string, now: Date = CAPTURED_AT, edit?: Edit): LeagueView {
  const d = loadDoc(name);
  if (edit) edit(d);
  const b = mapBracketDoc(d, { league: d.league as 'MLB' | 'WNBA', season: d.season as number });
  assert.ok(b, `${name} maps`);
  const v = buildLeagueView(b, clubs(), parks(), now);
  assert.ok(v, `${name} builds`);
  return v;
}
const raw = (d: Doc, key: string): RawSeries => (d.series as RawSeries[]).find((s) => s.seriesKey === key) as RawSeries;

// Ticket buttons and blocks are rendered by the page and passed in. Markers
// stand in for them here; the real ones are tested through the real pages in
// routes.test.tsx.
const rowTickets = (ids: string[]): Record<string, ReactNode> =>
  Object.fromEntries(ids.map((id) => [id, <span data-tickets-for={id}>ticket</span>]));
function panelTickets(v: LeagueView): Record<string, ReactNode> {
  const out: Record<string, ReactNode> = {};
  for (const r of v.rounds) for (const g of r.groups) for (const s of g.series) {
    if (s.next && s.next.state === 'scheduled' && s.next.hostTeamId) out[s.id] = <span data-panel-tickets={s.next.hostTeamId}>tickets</span>;
  }
  return out;
}

function leagueHtml(
  v: LeagueView,
  opts: { predictions?: LeaguePredictions | null; now?: Date; others?: { league: 'MLB' | 'WNBA'; href: string }[]; standing?: string | null } = {},
): string {
  const homeGames = v.phase.kind === 'active' ? homeGamesWindow([v], opts.now ?? CAPTURED_AT) : { primary: [], rest: [] };
  const body: LeagueBody = { state: 'ok', view: v, predictions: opts.predictions ?? null, homeGames, standing: opts.standing ?? null };
  return renderToStaticMarkup(
    <PlayoffsLeague
      league={v.league}
      season={v.season}
      body={body}
      tickets={rowTickets([...homeGames.primary, ...homeGames.rest].map((g) => g.hostTeamId))}
      panelTickets={panelTickets(v)}
      otherLeagues={opts.others ?? []}
    />,
  );
}

function hubHtml(leagues: HubLeague[], now: Date = CAPTURED_AT): string {
  const active = leagues.flatMap((l) => (l.state === 'ok' && l.view.phase.kind === 'active' ? [l.view] : []));
  const next = homeGamesWindow(active, now);
  return renderToStaticMarkup(
    <PlayoffsHub season={2026} leagues={leagues} nextGames={next} tickets={rowTickets([...next.primary, ...next.rest].map((g) => g.hostTeamId))} />,
  );
}
const ok = (v: LeagueView, predictions: HubPredictionLine | null = null): HubLeague => ({
  state: 'ok',
  league: v.league,
  href: `/playoffs/${v.league.toLowerCase()}`,
  view: v,
  predictions,
});

/** Visible text: style and script out, tags out, entities back. */
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
const count = (html: string, needle: string) => html.split(needle).length - 1;

/** The element whose opening tag holds `marker`, from its "<" to the close
 *  that balances it. */
function element(html: string, marker: string): string {
  const at = html.indexOf(marker);
  assert.ok(at >= 0, `${marker} is in the markup`);
  const open = html.lastIndexOf('<', at);
  const tag = /^<([a-z0-9]+)/.exec(html.slice(open))?.[1];
  assert.ok(tag);
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
const card = (html: string, id: string) => element(html, `data-series="${id}"`);
const panel = (html: string, id: string) => element(html, `data-series-panel="${id}"`);

/** The markup with every in-progress badge removed. What is left must not
 *  contain the word at all. */
const withoutBadges = (html: string) => html.replace(/<span data-game-state="live"[^>]*>Live<\/span>/g, '');
const FRESHNESS_WORDS = /\bhourly\b|\breal[- ]time\b|\blive\b|\bup to the minute\b|\bminute by minute\b/i;

// A pipeline series key, by the exact forms the documents use (see
// SERIES_KEY_SHAPES), and then by name for every key of the fixture. The
// page's own ids are lowercase (wild_card-2) and match none of these.
function assertNoSeriesKey(html: string, keys: readonly string[], where: string) {
  assert.equal(seriesKeyIn(html), null, `${where}: ${seriesKeyIn(html)} has the form of a series key`);
  for (const key of keys) {
    assert.ok(!html.includes(`"${key}"`), `${where}: series key ${key} is an attribute value`);
    assert.ok(!html.includes(`#${key}"`), `${where}: series key ${key} is a link target`);
    if (key.length >= 4) assert.ok(!html.includes(key), `${where}: series key ${key} is in the markup`);
    else assert.ok(!new RegExp(`(^| )${key}( |$)`).test(textOf(html)), `${where}: series key ${key} is text`);
  }
}
// A bracket document lists its series under `series`, a predicted one under `rounds`.
const keysOf = (name: string) => {
  const d = JSON.parse(rawText(name)) as { series?: { seriesKey: string }[]; rounds?: { seriesKey: string }[] };
  return (d.series ?? d.rounds ?? []).map((s) => s.seriesKey);
};

const EVERY_VIEW: [string, string, () => LeagueView, Date][] = [
  ['MLB live capture', FIXTURE.mlbLive, () => view(FIXTURE.mlbLive), CAPTURED_AT],
  ['MLB in-game capture', FIXTURE.mlbInGame, () => view(FIXTURE.mlbInGame, IN_GAME_AT), IN_GAME_AT],
  ['WNBA live capture', FIXTURE.wnbaLive, () => view(FIXTURE.wnbaLive), CAPTURED_AT],
  ['MLB capture, writer version 2', FIXTURE.mlbFields, () => view(FIXTURE.mlbFields, FIELDS_AT), FIELDS_AT],
  ['WNBA capture, writer version 2', FIXTURE.wnbaFields, () => view(FIXTURE.wnbaFields, FIELDS_AT), FIELDS_AT],
  ['MLB 2025 final', FIXTURE.mlbFinal, () => view(FIXTURE.mlbFinal, new Date('2025-11-02T04:00:00Z')), new Date('2025-11-02T04:00:00Z')],
  ['WNBA 2025 final', FIXTURE.wnbaFinal, () => view(FIXTURE.wnbaFinal, new Date('2025-10-11T04:00:00Z')), new Date('2025-10-11T04:00:00Z')],
  ['MLB 2025 mixed', FIXTURE.mlbMixed, () => view(FIXTURE.mlbMixed, MIXED_AT), MIXED_AT],
  ['WNBA 2025 mixed', FIXTURE.wnbaMixed, () => view(FIXTURE.wnbaMixed, new Date('2025-09-19T05:30:00Z')), new Date('2025-09-19T05:30:00Z')],
];

// ---- The league page: head of the page ----

test('LEAGUE: breadcrumb, heading, lede, and the absolute change stamp', () => {
  const html = leagueHtml(view(FIXTURE.mlbLive));
  const text = textOf(html);
  assert.ok(html.includes('<nav aria-label="Breadcrumb">'));
  assert.match(html, /<a [^>]*href="\/playoffs"[^>]*>Playoffs<\/a>/);
  assert.equal(count(html, '<h1'), 1);
  assert.match(html, /<h1[^>]*>2026 MLB Playoffs<\/h1>/);
  assert.ok(text.includes('Bracket updated Sep 29, 1:10 PM ET'));
  assert.equal(count(html, 'data-bracket-updated'), 1);
  assert.equal(count(html, 'data-lede'), 1);
});

// ---- The bracket: everything is in the server HTML ----

test('BRACKET: every round is a section under the document label, in its order', () => {
  const html = leagueHtml(view(FIXTURE.mlbLive));
  const rounds = element(html, 'data-rounds');
  for (const [key, label] of [['wild_card', 'Wild Card Series'], ['division_series', 'Division Series'], ['championship_series', 'Championship Series'], ['world_series', 'World Series']]) {
    assert.match(rounds, new RegExp(`<section aria-labelledby="round-${key}" data-round="${key}"`), key);
    assert.match(rounds, new RegExp(`<h2 id="round-${key}"[^>]*>${label}</h2>`));
  }
  const at = (k: string) => rounds.indexOf(`<section aria-labelledby="round-${k}"`);
  assert.ok(at('wild_card') < at('division_series') && at('division_series') < at('championship_series') && at('championship_series') < at('world_series'));
  assert.equal(count(rounds, '<section '), 4);
});

test('BRACKET: every series of BOTH conferences is in the HTML, whatever the toggle shows', () => {
  const html = leagueHtml(view(FIXTURE.mlbLive));
  const rounds = element(html, 'data-rounds');
  assert.equal(count(rounds, 'data-series="'), 11);
  for (const id of ['wild_card-1', 'wild_card-2', 'wild_card-3', 'wild_card-4', 'division_series-1', 'division_series-2', 'division_series-3', 'division_series-4', 'championship_series-1', 'championship_series-2', 'world_series-1']) {
    assert.equal(count(rounds, `data-series="${id}"`), 1, id);
  }
  // Three rounds split by conference: AL shown, NL in the HTML and not shown.
  assert.equal(count(rounds, 'data-conf="AL" data-shown="true"'), 3);
  assert.equal(count(rounds, 'data-conf="NL" data-shown="false"'), 3);
  // The last round belongs to no conference and is always shown.
  const ws = element(rounds, 'data-round="world_series"');
  assert.equal(count(ws, 'data-conf='), 0);
  assert.equal(count(ws, 'data-shown="true"'), 1);
  // The NL series are there to be read.
  assert.ok(textOf(element(rounds, 'data-series="wild_card-3"')).includes('Braves'));
});

test('BRACKET: state is never carried by the hidden attribute', () => {
  // Tailwind's preflight makes [hidden] display:none !important in a layer.
  // Neither the desktop layout nor the no-script rule could undo it.
  for (const [name, , make] of EVERY_VIEW) {
    assert.ok(!/<[^>]+\shidden(=""|\s|>)/.test(leagueHtml(make())), name);
  }
  assert.ok(!/<[^>]+\shidden(=""|\s|>)/.test(hubHtml([ok(view(FIXTURE.mlbLive)), ok(view(FIXTURE.wnbaLive))])));
});

test('BRACKET: with scripts off, both conferences show and the dead controls go', () => {
  const html = leagueHtml(view(FIXTURE.mlbLive));
  const bracket = element(html, 'data-bracket="MLB"');
  assert.match(bracket, /<noscript><style>[^<]*\.po-bracket \[data-conf\]\[data-shown='false'\]\{display:revert!important\}[^<]*\.po-controls\{display:none!important\}[^<]*<\/style><\/noscript>/);
  // The sticky bar and every Close button are controls.
  assert.ok(count(bracket, 'po-controls') >= 1 + 11);
  // The stylesheet holds the rules the markup relies on.
  const css = readFileSync(new URL('../../../app/globals.css', import.meta.url), 'utf8');
  assert.match(css, /@media \(max-width: 1023\.98px\) \{\s*\.po-bracket \[data-conf\]\[data-shown='false'\],\s*\.po-picks \[data-conf\]\[data-shown='false'\] \{\s*display: none;/);
  assert.match(css, /\.po-panel \{\s*display: none;\s*\}/);
  assert.match(css, /\.po-panel\[data-open='true'\] \{\s*display: block;/);
  assert.match(css, /\.po-more\[data-open='false'\] \{\s*display: none;/);
});

// ---- Controls ----

test('CONTROLS: real buttons with aria-pressed, the round being played pressed', () => {
  const html = leagueHtml(view(FIXTURE.mlbMixed, MIXED_AT), { now: MIXED_AT });
  const pills = element(html, 'data-control="round"');
  assert.match(pills, /^<div role="group" aria-label="Round"/);
  assert.equal(count(pills, '<button type="button"'), 4);
  assert.equal(count(pills, '<button'), 4);
  for (const [key, label, pressed] of [['wild_card', 'Wild Card Series', 'false'], ['division_series', 'Division Series', 'true'], ['championship_series', 'Championship Series', 'false'], ['world_series', 'World Series', 'false']]) {
    assert.match(pills, new RegExp(`<button type="button" aria-pressed="${pressed}" data-round-option="${key}"[^>]*>${label}</button>`), key);
  }
  assert.match(html, /data-bracket="MLB" data-round="division_series" data-conference="AL"/);
});

test('CONTROLS: the conference toggle, from the document, for a league that has conferences', () => {
  const mlb = leagueHtml(view(FIXTURE.mlbLive));
  const toggle = element(mlb, 'data-control="conference"');
  assert.match(toggle, /^<div role="group" aria-label="AL or NL"/);
  assert.match(toggle, /<button type="button" aria-pressed="true" data-conference-option="AL"[^>]*>AL<\/button>/);
  assert.match(toggle, /<button type="button" aria-pressed="false" data-conference-option="NL"[^>]*>NL<\/button>/);
  assert.equal(count(toggle, '<button'), 2);
  // The WNBA document names no conference, so there is nothing to toggle.
  const wnba = leagueHtml(view(FIXTURE.wnbaLive));
  assert.equal(count(wnba, 'data-control="conference"'), 0);
  assert.equal(count(wnba, 'data-conf='), 0);
  assert.equal(count(element(wnba, 'data-control="round"'), '<button'), 3);
});

test('CONTROLS: the toggle is gone on a round that no conference splits', () => {
  // A concluded bracket opens on its last round, the World Series.
  const html = leagueHtml(view(FIXTURE.mlbFinal, new Date('2025-11-02T04:00:00Z')));
  assert.match(html, /data-bracket="MLB" data-round="world_series"/);
  assert.equal(count(html, 'data-control="conference"'), 0);
  assert.match(element(html, 'data-control="round"'), /aria-pressed="true" data-round-option="world_series"/);
});

test('CAPTURED: pills carry the document short labels, headings the full ones', () => {
  const mlb = leagueHtml(view(FIXTURE.mlbFields, FIELDS_AT), { now: FIELDS_AT });
  const pills = element(mlb, 'data-control="round"');
  for (const [key, short, full] of [['wild_card', 'Wild Card', 'Wild Card Series'], ['division_series', 'Division', 'Division Series'], ['championship_series', 'LCS', 'Championship Series'], ['world_series', 'World Series', 'World Series']]) {
    assert.match(pills, new RegExp(`data-round-option="${key}"[^>]*>${short}</button>`), key);
    assert.match(mlb, new RegExp(`<h2 id="round-${key}"[^>]*>${full}</h2>`), key);
  }
  const wnba = leagueHtml(view(FIXTURE.wnbaFields, FIELDS_AT), { now: FIELDS_AT });
  assert.match(element(wnba, 'data-control="round"'), /data-round-option="finals"[^>]*>Finals<\/button>/);
  assert.match(wnba, /<h2 id="round-finals"[^>]*>WNBA Finals<\/h2>/);
  // The hub's round badge is a heading, not a pill: the full label.
  assert.ok(textOf(element(hubHtml([ok(view(FIXTURE.mlbFields, FIELDS_AT))], FIELDS_AT), 'data-league-card="MLB"')).includes('Wild Card Series'));
});

test('CAPTURED: a feeder being played, with candidates, renders "<A> / <B> winner" in a dashed slot', () => {
  const html = leagueHtml(view(FIXTURE.mlbFields, FIELDS_AT), { now: FIELDS_AT });
  for (const [id, text] of [['division_series-1', 'Yankees / Red Sox winner'], ['division_series-2', 'Astros / White Sox winner'], ['division_series-3', 'Padres / Cubs winner'], ['division_series-4', 'Braves / Phillies winner']]) {
    assert.match(card(html, id), new RegExp(`<span data-slot="placeholder" class="[^"]*border-dashed[^"]*"><span class="min-w-0">${text}</span></span>`), id);
  }
  for (const stored of ['NYY/BOS', 'HOU/CWS', 'SD/CHC', 'ATL/PHI']) assert.equal(count(html, stored), 0, stored);
  // The candidates are named, and not linked: neither has the slot yet.
  const p = panel(html, 'division_series-4');
  assert.ok(textOf(p).includes('Dodgers vs Braves / Phillies winner'));
  assert.equal(count(p, 'data-club-link="'), 1);
  assert.match(p, /data-club-link="los-angeles-dodgers"/);
});

test('CONTROLS: pills use the short label when the document has one; headings keep the full one', () => {
  // OVERLAY: no stored document carries shortLabel yet.
  const v = view(FIXTURE.mlbLive, CAPTURED_AT, (d) => {
    for (const s of d.series as RawSeries[]) if (s.round === 'division_series') s.shortLabel = 'Division';
  });
  const html = leagueHtml(v);
  const pills = element(html, 'data-control="round"');
  assert.match(pills, /data-round-option="division_series"[^>]*>Division<\/button>/);
  assert.match(pills, /data-round-option="wild_card"[^>]*>Wild Card Series<\/button>/);
  assert.match(html, /<h2 id="round-division_series"[^>]*>Division Series<\/h2>/);
});

test('CONTROLS: the bar sticks below the brand bar and is off at desktop width', () => {
  const html = leagueHtml(view(FIXTURE.mlbLive));
  const bar = /<div class="(po-controls sticky[^"]*)"/.exec(html)?.[1] ?? '';
  assert.ok(bar.split(' ').includes('top-14'), 'the brand bar above it is 56px tall and sticky');
  assert.ok(bar.split(' ').includes('lg:hidden'));
});

// ---- Series cards ----

test('SERIES CARD: a link to its own detail, with seeds, clubs and the next game', () => {
  const html = leagueHtml(view(FIXTURE.mlbLive));
  const c = card(html, 'wild_card-1');
  assert.match(c, /<a href="#wild_card-1" aria-expanded="false" aria-controls="wild_card-1"/);
  assert.equal(count(c, '<a '), 1, 'the card is one link and holds no other');
  const text = textOf(c);
  assert.ok(text.includes('Seed 3 Astros'));
  assert.ok(text.includes('Seed 6 White Sox'));
  assert.ok(text.includes('Next: Game 1 · Tue, Sep 29 · 5:00 PM ET'));
  assert.ok(text.includes('Host: Astros · Daikin Park'));
  assert.ok(textOf(card(html, 'division_series-1')).includes('Best of 5 · 2-2-1'));
  assert.ok(c.includes('data-series-status="upcoming"'));
});

test('SERIES CARD: wins per side and the leader, only once a series has started', () => {
  const html = leagueHtml(view(FIXTURE.wnbaLive));
  const c = card(html, 'first_round-1');
  assert.ok(c.includes('data-series-status="live"'));
  assert.ok(textOf(c).includes('Lynx 0 wins'));
  assert.ok(textOf(c).includes('Liberty 1 win'));
  assert.ok(textOf(c).includes('NYL leads 1-0'));
  assert.ok(!/ wins?\b/.test(textOf(card(leagueHtml(view(FIXTURE.mlbLive)), 'wild_card-1'))), 'an upcoming series shows no win count');
  assert.ok(textOf(card(html, 'semifinals-1')).includes('Matchup to be decided'));
});

test('PLACEHOLDERS: a slot with no club is a dashed box holding the stored label', () => {
  const html = leagueHtml(view(FIXTURE.mlbLive));
  const rounds = element(html, 'data-rounds');
  // 4 Division Series visitors, 4 Championship Series slots, 2 World Series slots.
  assert.equal(count(rounds, 'data-slot="placeholder"'), 10);
  assert.equal(count(rounds, 'data-slot="club"'), 12);
  for (const label of ['NYY/BOS', 'HOU/CWS', 'SD/CHC', 'ATL/PHI', 'AL Higher Seed', 'AL Lower Seed', 'NL Higher Seed', 'NL Lower Seed', 'Higher Seed League Champion', 'Lower Seed League Champion']) {
    assert.match(rounds, new RegExp(`<span data-slot="placeholder" class="[^"]*border-dashed[^"]*">(?:<span[^>]*>.*?</span>)?<span class="min-w-0">${label}</span></span>`), label);
  }
  const c = card(html, 'division_series-1');
  assert.ok(textOf(c).includes('Rays'));
  assert.ok(!c.includes('Yankees') && !c.includes('Red Sox'));
});

// ---- Placeholder resolution, in the HTML ----
//
// OVERLAY: no stored document carries feederSeriesKey or candidates yet.

test('RESOLUTION 1: a decided feeder renders its winner by name, as a club, with its seed', () => {
  const v = view(FIXTURE.mlbMixed, MIXED_AT, (d) => {
    Object.assign(raw(d, 'AL-CS').higher, { feederSeriesKey: 'AL-DS-A' });
  });
  const html = leagueHtml(v, { now: MIXED_AT });
  const c = card(html, 'championship_series-1');
  assert.equal(count(c, 'data-slot="club"'), 1);
  assert.equal(count(c, 'data-slot="placeholder"'), 1);
  assert.ok(textOf(c).includes('Seed 1 Blue Jays'));
  assert.ok(textOf(c).includes('AL Lower Seed'));
  assert.ok(!textOf(c).includes('AL Higher Seed'));
  // And in its detail: the club is linked, the park is the winner's.
  const p = panel(html, 'championship_series-1');
  assert.match(p, /<a [^>]*href="\/mlb\/toronto-blue-jays"[^>]*>Toronto Blue Jays promotions<\/a>/);
  assert.ok(textOf(p).includes('Blue Jays vs AL Lower Seed'));
  assert.ok(textOf(p).includes('Host: Blue Jays · Rogers Centre'));
});

test('RESOLUTION 2: a feeder still being played, with candidates, renders "<A> / <B> winner"', () => {
  const v = view(FIXTURE.mlbMixed, MIXED_AT, (d) => {
    Object.assign(raw(d, 'AL-CS').lower, { feederSeriesKey: 'AL-DS-B', candidates: ['seattle-mariners', 'detroit-tigers'] });
  });
  const c = card(leagueHtml(v, { now: MIXED_AT }), 'championship_series-1');
  assert.match(c, /<span data-slot="placeholder" class="[^"]*border-dashed[^"]*"><span class="min-w-0">Mariners \/ Tigers winner<\/span><\/span>/);
  assert.ok(!c.includes('AL Lower Seed'));
});

test('RESOLUTION 3: with neither, the stored label', () => {
  for (const extra of [{}, { feederSeriesKey: 'AL-DS-B' }, { feederSeriesKey: 'AL-DS-B', candidates: null }]) {
    const v = view(FIXTURE.mlbMixed, MIXED_AT, (d) => {
      Object.assign(raw(d, 'AL-CS').lower, extra);
    });
    const c = card(leagueHtml(v, { now: MIXED_AT }), 'championship_series-1');
    assert.match(c, /<span class="min-w-0">AL Lower Seed<\/span>/, JSON.stringify(extra));
  }
});

// ---- Series detail ----

test('SERIES DETAIL: one for every series, in the HTML, closed, and addressable by its id', () => {
  const html = leagueHtml(view(FIXTURE.mlbLive));
  const panels = element(html, 'data-series-panels');
  assert.equal(count(panels, 'data-series-panel="'), 11);
  assert.equal(count(panels, 'data-open="false"'), 11);
  assert.equal(count(panels, 'data-open="true"'), 0);
  for (const id of ['wild_card-1', 'division_series-3', 'world_series-1']) {
    // The id is the fragment: /playoffs/mlb#division_series-3 lands here.
    assert.match(panels, new RegExp(`<section id="${id}" tabindex="-1" aria-labelledby="${id}-title" data-series-panel="${id}" data-open="false" class="po-panel `), id);
    assert.equal(count(html, `id="${id}"`), 1, 'an id names one element');
  }
});

test('SERIES DETAIL: round, matchup, format, every game, park, result', () => {
  const html = leagueHtml(view(FIXTURE.wnbaLive));
  const p = panel(html, 'first_round-1');
  const text = textOf(p);
  assert.ok(text.startsWith('First Round Lynx vs Liberty Best of 3 · 1-1-1'));
  assert.equal(count(p, 'data-game="'), 3);
  assert.ok(textOf(element(p, 'data-game="1"')).includes('G1 Sun, Sep 27 · 2:00 PM ET Host: Lynx · Target Center Final: NYL 91, MIN 75'));
  assert.ok(textOf(element(p, 'data-game="2"')).includes('G2 Tue, Sep 29 · 8:30 PM ET Host: Liberty · Barclays Center'));
  assert.ok(textOf(element(p, 'data-game="3"')).includes('If necessary'));
  assert.ok(text.includes('NYL leads 1-0'));
  // A series with no games says so and lists none.
  const empty = panel(html, 'semifinals-1');
  assert.equal(count(empty, 'data-game="'), 0);
  assert.ok(textOf(empty).includes('No games are listed for this series yet.'));
});

test('SERIES DETAIL: club names link to /{sport}/{team}; a slot with no club links nowhere', () => {
  const html = leagueHtml(view(FIXTURE.mlbLive));
  const p = panel(html, 'wild_card-1');
  assert.match(p, /<a [^>]*data-club-link="houston-astros"[^>]*href="\/mlb\/houston-astros"|<a [^>]*href="\/mlb\/houston-astros"[^>]*data-club-link="houston-astros"/);
  assert.match(p, /href="\/mlb\/chicago-white-sox"/);
  assert.equal(count(p, 'data-club-link="'), 2);
  assert.equal(count(panel(html, 'division_series-1'), 'data-club-link="'), 1, 'the Rays, and not the slot beside them');
  assert.equal(count(panel(html, 'world_series-1'), 'data-club-link="'), 0);
  const wnba = panel(leagueHtml(view(FIXTURE.wnbaLive)), 'first_round-1');
  assert.match(wnba, /href="\/wnba\/minnesota-lynx"/);
  assert.match(wnba, /href="\/wnba\/new-york-liberty"/);
});

test('SERIES DETAIL: the park links to its page on this site; a park without one is plain text', () => {
  const html = leagueHtml(view(FIXTURE.mlbLive));
  const g = element(panel(html, 'wild_card-1'), 'data-game="1"');
  assert.match(g, /<a data-park-link="daikin-park"[^>]*href="\/venues\/daikin-park"[^>]*>Daikin Park<\/a>|<a [^>]*href="\/venues\/daikin-park"[^>]*data-park-link="daikin-park"[^>]*>Daikin Park<\/a>/);
  // No page for the park: the name, and no link.
  const b = mapBracketDoc(loadDoc(FIXTURE.mlbLive), { league: 'MLB', season: 2026 });
  assert.ok(b);
  const some = parks();
  some.set('houston-astros', { name: 'Daikin Park', page: null });
  const v = buildLeagueView(b, clubs(), some, CAPTURED_AT);
  assert.ok(v);
  const plain = element(panel(leagueHtml(v), 'wild_card-1'), 'data-game="1"');
  assert.ok(textOf(plain).includes('Host: Astros · Daikin Park'));
  assert.equal(count(plain, '<a '), 0);
  assert.equal(count(plain, 'data-park-link'), 0);
});

test('SERIES DETAIL: tickets for the host of the next game still to be played', () => {
  const html = leagueHtml(view(FIXTURE.mlbLive));
  assert.ok(panel(html, 'wild_card-1').includes('data-panel-tickets="houston-astros"'));
  assert.ok(panel(html, 'division_series-1').includes('data-panel-tickets="tampa-bay-rays"'));
  // A series whose host is an unfilled slot sells nothing.
  assert.equal(count(panel(html, 'championship_series-1'), 'data-panel-tickets'), 0);
  // Nor does a decided one.
  const done = leagueHtml(view(FIXTURE.mlbFinal, new Date('2025-11-02T04:00:00Z')));
  assert.equal(count(done, 'data-panel-tickets'), 0);
});

test('SERIES DETAIL: a Close button that is a real button', () => {
  const p = panel(leagueHtml(view(FIXTURE.mlbLive)), 'wild_card-1');
  assert.match(p, /<button type="button" data-panel-close="wild_card-1" class="po-controls [^"]*">Close<\/button>/);
});

test('DEEP LINK: the fragment selects the series with no script, and steps aside once hydrated', () => {
  const css = readFileSync(new URL('../../../app/globals.css', import.meta.url), 'utf8');
  assert.match(css, /\.po-bracket:not\(\[data-hydrated\]\) \.po-panel:target \{\s*display: block;/);
  const html = leagueHtml(view(FIXTURE.mlbLive));
  // The server HTML is not hydrated, so the rule applies to it.
  assert.ok(!/data-hydrated/.test(html));
  // Every card's link names a panel that exists, so every fragment the page
  // itself produces resolves.
  const targets = [...html.matchAll(/<a href="#([^"]+)" aria-expanded/g)].map((m) => m[1]);
  assert.equal(targets.length, 11);
  for (const id of targets) assert.equal(count(html, `<section id="${id}" `), 1, id);
  // An id the bracket does not have names nothing: the page stays as it is.
  for (const unknown of ['wild_card-9', 'AL-WC-B', 'x']) assert.equal(count(html, `id="${unknown}"`), 0, unknown);
});

// ---- A game in progress ----

test('IN PROGRESS (captured): the card, the detail and the hub mark the game under way, with no score', () => {
  const v = view(FIXTURE.mlbInGame, IN_GAME_AT);
  const page = leagueHtml(v, { now: IN_GAME_AT });
  // The card, the detail's status line, and the game row.
  assert.equal(count(page, 'data-game-state="live"'), 3);
  const c = card(page, 'wild_card-3');
  assert.equal(count(c, 'data-game-state="live"'), 1);
  assert.ok(c.includes('data-series-status="live"'));
  assert.ok(textOf(c).includes('Game 1 in progress · Host: Braves · Truist Park'));
  const p = panel(page, 'wild_card-3');
  assert.equal(count(p, 'data-game-state="live"'), 2);
  assert.ok(!textOf(p).includes('Final'));
  assert.ok(!/\b(PHI|ATL) 1\b/.test(textOf(p)), 'the score in progress is not shown');
  assert.equal(count(p, 'data-panel-tickets'), 0, 'no tickets are sold for a game under way');
  assert.ok(textOf(page).includes('Bracket updated Sep 29, 2:51 PM ET'));
  assert.equal(count(page, 'data-home-game="MLB-wild_card-3-g1"'), 0);
  assert.equal(count(page, 'data-home-game="MLB-wild_card-3-g2"'), 1);

  const hub = hubHtml([ok(v)], IN_GAME_AT);
  assert.equal(count(hub, 'data-game-state="live"'), 1);
  const line = element(hub, 'data-series="wild_card-3"');
  assert.ok(line.includes('data-game-state="live"'));
  assert.ok(textOf(line).includes('Braves vs Phillies'));
  assert.ok(textOf(line).includes('Game 1'));
});

// ---- Concluded, unavailable ----

test('CONCLUDED: the champion is named, nothing is "next", no home games are offered', () => {
  const now = new Date('2025-11-02T04:00:00Z');
  const html = leagueHtml(view(FIXTURE.mlbFinal, now), { now });
  const text = textOf(html);
  assert.ok(html.includes('data-champion="los-angeles-dodgers"'));
  assert.ok(text.includes('2025 champion Los Angeles Dodgers Won the World Series 4-3'));
  assert.ok(!text.includes('Next:'));
  assert.ok(!text.includes('Upcoming playoff games'));
  assert.equal(count(element(html, 'data-rounds'), 'data-series-status="final"'), 11);
});

// There is no "unavailable" state to render: a league with no document is a
// 404 and a read that fails throws, so the page always has a bracket. The
// type says so (LeagueBody has one member) and routes.test.tsx proves both.

// ---- PromoNight Predicts: see predictions-render.test.tsx ----

// ---- The article: what the ad placer reads ----

/** The direct children of the article, as "tag" or "tag[marker]". */
function articleChildren(html: string): string[] {
  const article = element(html, 'data-playoffs-article=');
  const inner = article.slice(article.indexOf('>') + 1, article.lastIndexOf('</article>'));
  const out: string[] = [];
  const re = /<([a-z0-9]+)\b([^>]*)>|<\/([a-z0-9]+)>/g;
  // The void elements of HTML, and nothing else. React writes every SVG
  // child with a closing tag, so none of them belongs here.
  const VOID = new Set(['area', 'base', 'br', 'col', 'embed', 'hr', 'img', 'input', 'link', 'meta', 'source', 'track', 'wbr']);
  let depth = 0;
  for (let m = re.exec(inner); m; m = re.exec(inner)) {
    if (m[3]) {
      depth -= 1;
      continue;
    }
    const selfClosing = m[2].endsWith('/') || VOID.has(m[1]);
    if (depth === 0) {
      const mark = /data-(page-intro|bracket-child|home-games|predictions-methodology|predictions|series-results|hub-results)\b/.exec(m[2]);
      out.push(mark ? `${m[1]}[${mark[1]}]` : m[1] === 'section' && /aria-label="Leagues"/.test(m[2]) ? 'section[leagues]' : m[1]);
    }
    if (!selfClosing) depth += 1;
  }
  return out;
}

test('WHERE THINGS STAND: inside the introduction above the bracket, beside the bracket stamp; never a child of the article; absent renders nothing', () => {
  const v = view(FIXTURE.mlbFields, FIELDS_AT);
  const line = 'Wild Card Series: the Astros and the White Sox have not completed a game.';
  const html = leagueHtml(v, { now: FIELDS_AT, standing: line });
  const intro = element(html, 'data-page-intro');
  assert.equal(count(html, 'data-standing'), 1);
  assert.ok(intro.includes('data-standing'));
  assert.equal(textOf(element(intro, 'data-standing')), line);
  // Directly before the bracket's own change stamp.
  assert.match(intro, /data-standing[^>]*>[^<]*<\/p><p data-bracket-updated/);
  assert.ok(html.indexOf('data-standing') < html.indexOf('data-bracket-child'));
  assert.deepEqual(articleChildren(html), ['header', 'div[page-intro]', 'div[bracket-child]', 'section[home-games]']);
  const none = leagueHtml(v, { now: FIELDS_AT, standing: null });
  assert.equal(count(none, 'data-standing'), 0);
  assert.equal(none, leagueHtml(v, { now: FIELDS_AT }), 'no line, no trace');
});

// WCAG 2 relative luminance and contrast, for the TBD slot test.
function luminance(hex: string): number {
  const c = [0, 2, 4].map((i) => parseInt(hex.slice(1 + i, 3 + i), 16) / 255).map((x) => (x <= 0.03928 ? x / 12.92 : ((x + 0.055) / 1.055) ** 2.4));
  return 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2];
}
const contrast = (a: string, b: string) => {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
};
function mix(fg: string, bg: string, alpha: number): string {
  const ch = (h: string, i: number) => parseInt(h.slice(1 + i, 3 + i), 16);
  return `#${[0, 2, 4].map((i) => Math.round(ch(fg, i) * alpha + ch(bg, i) * (1 - alpha)).toString(16).padStart(2, '0')).join('')}`;
}

test('TBD SLOTS: dashed outline on a light cream fill, same box as a club slot row, text at WCAG AA or better', () => {
  const html = leagueHtml(view(FIXTURE.mlbFields, FIELDS_AT), { now: FIELDS_AT });
  const slots = [...html.matchAll(/<span data-slot="placeholder" class="([^"]+)"/g)].map((m) => m[1]);
  assert.ok(slots.length > 0);
  const css = readFileSync(new URL('../../../app/globals.css', import.meta.url), 'utf-8');
  const token = (name: string) => {
    const m = new RegExp(`--color-${name}:\\s*(#[0-9a-f]{6})`, 'i').exec(css);
    assert.ok(m, name);
    return m[1].toLowerCase();
  };
  for (const cls of slots) {
    const c = cls.split(' ');
    for (const k of ['border-dashed', 'px-2.5', 'py-2', 'text-[14px]', 'rounded-md']) assert.ok(c.includes(k), `${k} in ${cls}`);
    const fill = /^bg-(rd-[a-z-]+)\/(\d+)$/.exec(c.find((x) => x.startsWith('bg-')) ?? '');
    const ink = /^text-(rd-ink[a-z-]*)$/.exec(c.find((x) => /^text-rd-/.test(x)) ?? '');
    assert.ok(fill && ink, cls);
    // The slot sits on the white card.
    const bg = mix(token(fill[1]), token('rd-card'), Number(fill[2]) / 100);
    const ratio = contrast(token(ink[1]), bg);
    assert.ok(ratio >= 4.5, `${ink[1]} on ${fill[1]}/${fill[2]}: ${ratio.toFixed(2)}:1`);
  }
});

test('ARTICLE, league page: an article that is the page-content wrapper, children in the order the ad rule needs', () => {
  const html = leagueHtml(view(FIXTURE.mlbFields, FIELDS_AT), { now: FIELDS_AT });
  assert.equal(count(html, '<article'), 1);
  assert.match(html, /<article class="page-content" data-ad-region="content" data-playoffs-article="league">/);
  assert.equal(count(html, 'page-content'), 1, 'one wrapper, so one set of anchors');
  // The heading and the introduction take the two skips. The first unit can
  // follow the third child, which is the bracket.
  assert.deepEqual(articleChildren(html), ['header', 'div[page-intro]', 'div[bracket-child]', 'section[home-games]']);
  const article = element(html, 'data-playoffs-article=');
  assert.equal(count(article, '<h1'), 1, 'the heading is inside the article it names');
  assert.ok(element(article, 'data-bracket-child').includes('data-bracket="MLB"'));
});

test('ARTICLE, league page: no child is ever empty, in any state', () => {
  for (const [name, , make, now] of EVERY_VIEW) {
    {
      const html = leagueHtml(make(), { now });
      const kids = articleChildren(html);
      assert.ok(kids.length >= 3, `${name}: ${kids.join(' ')}`);
      assert.deepEqual(kids.slice(0, 3), ['header', 'div[page-intro]', 'div[bracket-child]'], name);
      // With no locked prediction, no predictions child at all.
      assert.ok(!kids.some((k) => k.includes('predictions')), `${name}: a predictions child with nothing in it`);
      // Nothing that renders as an empty element.
      assert.ok(!/<(div|section|p|span)[^>]*><\/\1>/.test(element(html, 'data-playoffs-article=').replace(/<span aria-hidden="true"[^>]*><\/span>/g, '')), `${name}: an empty element inside the article`);
    }
  }
});

test('ARTICLE, league page: what must stay out of it, stays out', () => {
  const html = leagueHtml(view(FIXTURE.mlbFields, FIELDS_AT), { now: FIELDS_AT, others: [{ league: 'WNBA', href: '/playoffs/wnba' }] });
  const article = element(html, 'data-playoffs-article=');
  // The notes, the disclosure and the cross link sit after the article, so
  // no unit is placed against the site footer.
  assert.ok(!article.includes('<footer'));
  assert.ok(!article.includes('Open the WNBA bracket'));
  assert.ok(!article.includes('PromoNight may earn a commission'));
  assert.ok(html.indexOf('<footer') > html.indexOf('</article>'));
  assert.ok(html.indexOf('Open the WNBA bracket') > html.indexOf('</article>'));
  // No second wrapper and no aside anywhere in the page body.
  assert.equal(count(html, '<aside'), 0);
  assert.equal(count(html, 'data-ad-region'), 1);
});

test('ARTICLE, league page, finished: the results carry the page', () => {
  const now = new Date('2025-11-02T04:00:00Z');
  const html = leagueHtml(view(FIXTURE.mlbFinal, now), { now });
  // No home games once the bracket is finished; the results are the child
  // that gives the article its height. (2025 has no locked prediction.)
  assert.deepEqual(articleChildren(html), ['header', 'div[page-intro]', 'div[bracket-child]', 'section[series-results]']);
});

test('ARTICLE, hub: the same wrapper, with the league cards as the third child', () => {
  const line = (league: 'MLB' | 'WNBA'): HubPredictionLine => ({ league, href: `/playoffs/${league.toLowerCase()}#predictions`, championName: 'A Club', championStatus: 'alive', record: '0 for 1' });
  const html = hubHtml([ok(view(FIXTURE.mlbFields, FIELDS_AT), line('MLB')), ok(view(FIXTURE.wnbaFields, FIELDS_AT), line('WNBA'))], FIELDS_AT);
  assert.equal(count(html, '<article'), 1);
  assert.match(html, /<article class="page-content" data-ad-region="content" data-playoffs-article="hub">/);
  assert.equal(count(html, 'page-content'), 1);
  assert.deepEqual(articleChildren(html), ['header', 'div[page-intro]', 'section[leagues]', 'section[home-games]', 'section[predictions]']);
  const article = element(html, 'data-playoffs-article=');
  assert.equal(count(article, '<h1'), 1);
  assert.ok(!article.includes('<footer'));
  assert.ok(html.indexOf('<footer') > html.indexOf('</article>'));
  assert.equal(count(html, '<aside'), 0);
});

test('ARTICLE, hub in the offseason, and hub with both leagues finished', () => {
  const off = hubHtml([]);
  assert.deepEqual(articleChildren(off), ['header', 'div[page-intro]']);
  assert.ok(element(off, 'data-page-intro').includes('data-hub-state="offseason"'));
  const now = new Date('2025-11-03T12:00:00Z');
  const done = hubHtml([ok(view(FIXTURE.mlbFinal, now)), ok(view(FIXTURE.wnbaFinal, now))], now);
  assert.deepEqual(articleChildren(done), ['header', 'div[page-intro]', 'section[leagues]', 'section[hub-results]']);
});

test('SCROLLERS: each one is the containing block for what it scrolls', () => {
  // Screen-reader-only text is absolutely positioned. Inside a scroller that
  // is not positioned it escapes the clip and widens the document.
  const html = leagueHtml(view(FIXTURE.mlbFields, FIELDS_AT), { now: FIELDS_AT });
  const scrollers = [...html.matchAll(/<[a-z]+[^>]*class="([^"]*\boverflow-x-auto\b[^"]*)"[^>]*>/g)];
  assert.equal(scrollers.length, 2, 'the round pills and the rounds');
  for (const m of scrollers) assert.match(m[1], /(^| )relative( |$)/, m[0].slice(0, 120));
  assert.ok(count(element(html, 'data-rounds'), 'sr-only') > 0, 'the rounds do hold such text, so the rule has something to protect');
});

// ---- Results: every decided series with every game score ----

test('RESULTS, finished: every series of every round, each with all of its game scores, linking to its panel', () => {
  const now = new Date('2025-11-02T04:00:00Z');
  const v = view(FIXTURE.mlbFinal, now);
  const html = leagueHtml(v, { now });
  const section = element(html, 'data-series-results=');
  assert.ok(section.includes('data-series-results="4"'), 'four rounds have decided series');
  assert.equal(count(section, 'data-result="'), 11, 'every series');
  const all = v.rounds.flatMap((r) => r.groups.flatMap((g) => g.series));
  const played = all.flatMap((s) => s.games.filter((g) => g.state === 'final' && g.result));
  assert.equal(count(section, 'data-result-game='), played.length, 'every game that was played');
  const text = textOf(section);
  assert.ok(text.startsWith('Results '));
  for (const s of all) {
    assert.ok(text.includes(`${s.higher.label} vs ${s.lower.label}`), s.id);
    assert.ok(text.includes(s.scoreLine as string), s.scoreLine as string);
    assert.ok(section.includes(`href="#${s.id}"`), `a link to ${s.id}`);
    for (const g of s.games) if (g.result) assert.ok(text.includes(g.result), g.result);
  }
  // Every round label, in document order.
  assert.deepEqual([...section.matchAll(/data-results-round="([^"]+)"/g)].map((m) => m[1]), v.rounds.map((r) => r.key));
  // Nothing in it that is not a result: no time still to come, no ticket.
  assert.ok(!text.includes('Next:') && !section.includes('data-tickets-for'));
});

test('RESULTS, being played: "Results so far" with the decided series only; none decided means no section', () => {
  const v = view(FIXTURE.mlbMixed, MIXED_AT);
  const html = leagueHtml(v, { now: MIXED_AT });
  const section = element(html, 'data-series-results=');
  assert.ok(textOf(section).startsWith('Results so far '));
  const decided = v.rounds.flatMap((r) => r.groups.flatMap((g) => g.series.filter((s) => s.status === 'final')));
  assert.equal(count(section, 'data-result="'), decided.length);
  assert.ok(decided.length > 0);
  const undecided = v.rounds.flatMap((r) => r.groups.flatMap((g) => g.series.filter((s) => s.status !== 'final')));
  for (const s of undecided) assert.ok(!section.includes(`data-result="${s.id}"`), `${s.id} is not decided`);
  // Nothing decided yet: no section at all, so no empty child in the article.
  const fresh = leagueHtml(view(FIXTURE.mlbLive), { now: CAPTURED_AT });
  assert.equal(count(fresh, 'data-series-results='), 0);
  assert.ok(!textOf(fresh).includes('Results'));
});

test('HUB CARD: only series still being played; a decided series of the round is in the results and nowhere else', () => {
  // Replay step 24: the Wild Card round and ONE Division Series are final,
  // three Division Series are being played.
  const v = view(FIXTURE.mlbMixed, MIXED_AT);
  const html = hubHtml([ok(v)], MIXED_AT);
  const card = element(html, 'data-league-card="MLB"');
  const current = v.rounds.find((r) => r.key === (v.phase.kind === 'active' ? v.phase.roundKey : ''));
  assert.ok(current);
  const all = current.groups.flatMap((g) => g.series);
  const playing = all.filter((s) => s.status !== 'final');
  const decided = all.filter((s) => s.status === 'final');
  assert.equal(decided.length, 1, 'the fixture holds one decided series in the round being played');
  assert.equal(count(card, 'data-series="'), playing.length);
  for (const s of playing) assert.ok(card.includes(`data-series="${s.id}"`), s.id);
  for (const s of decided) {
    assert.ok(!card.includes(`data-series="${s.id}"`), `${s.id} is decided, not on the card`);
    assert.ok(!textOf(card).includes(`${s.higher.label} vs ${s.lower.label}`), s.id);
    const results = element(html, 'data-hub-results=');
    assert.ok(results.includes(`data-result="${s.id}"`), `${s.id} is in the results`);
  }
  // The card is never empty while the league is being played: the round
  // being played is the first with a series not yet final.
  assert.ok(playing.length > 0);
});

test('HUB RESULTS: each league with a decided series lists them with the round and the score, linking to the league page', () => {
  const now = new Date('2025-10-21T12:00:00Z');
  const mlb = view('MLB_2025.replay-step-40.json', now);
  const wnba = view(FIXTURE.wnbaFinal, now);
  const html = hubHtml([ok(mlb), ok(wnba)], now);
  const section = element(html, 'data-hub-results=');
  assert.ok(section.includes('data-hub-results="2"'));
  assert.ok(textOf(section).startsWith('Results so far MLB '), 'MLB is still being played');
  assert.equal(count(element(section, 'data-results-league="MLB"'), 'data-result="'), 10);
  assert.equal(count(element(section, 'data-results-league="WNBA"'), 'data-result="'), 7);
  assert.ok(section.includes('href="/playoffs/mlb#championship_series-1"'));
  assert.ok(textOf(section).includes('World Series') === false, 'the World Series is not decided');
  assert.ok(textOf(section).includes('Championship Series ·'));
  // With everything finished the heading is "Results".
  const done = hubHtml([ok(view(FIXTURE.mlbFinal, now)), ok(wnba)], now);
  assert.ok(textOf(element(done, 'data-hub-results=')).startsWith('Results MLB '));
  // Nothing decided anywhere: no section.
  assert.equal(count(hubHtml([ok(view(FIXTURE.mlbLive)), ok(view(FIXTURE.wnbaLive))]), 'data-hub-results='), 0);
});

// ---- Home games ----

test('HOME GAMES: the next three days, eight rows at most, one ticket button a row', () => {
  const v = view(FIXTURE.mlbLive);
  const html = leagueHtml(v);
  const w = homeGamesWindow([v], CAPTURED_AT);
  const list = element(html, 'data-home-games-list="primary"');
  assert.equal(count(list, 'data-home-game="'), 8);
  assert.equal(w.primary.length, 8);
  assert.equal(count(list, 'data-tickets-for="'), 8, 'one to a row');
  const first = element(list, 'data-home-game="MLB-wild_card-3-g1"');
  const row = textOf(first);
  assert.ok(row.includes('Phillies at Braves'));
  assert.ok(row.includes('Wild Card Series · Game 1'));
  assert.ok(row.includes('Tue, Sep 29 · 2:00 PM ET'));
  assert.ok(row.includes('Truist Park'));
  assert.equal(count(first, 'data-tickets-for="atlanta-braves"'), 1);
  assert.match(first, /href="\/venues\/truist-park"[^>]*>Truist Park<\/a>|data-park-link="truist-park"[^>]*>Truist Park<\/a>/);
  // Nothing in the short list is later than Oct 1.
  assert.ok(![...list.matchAll(/· (\w{3}, \w{3} \d+) ·|>(\w{3}, \w{3} \d+) · /g)].some((m) => /Oct [2-9]/.test(m[0])));
});

test('HOME GAMES: "Show all" is a real button, and the rest of the week is in the HTML behind it', () => {
  const v = view(FIXTURE.mlbLive);
  const html = leagueHtml(v);
  const w = homeGamesWindow([v], CAPTURED_AT);
  const section = element(html, 'data-home-games="home-games-this-week"');
  assert.match(section, /<h2[^>]*>Upcoming playoff games<\/h2>/);
  assert.ok(!/\bhome games?\b/i.test(textOf(element(html, 'data-playoffs-article='))), 'nothing on the league page calls them home games');
  assert.match(
    section,
    new RegExp(`<button type="button" data-show-all="home-games-this-week-more" aria-expanded="false" aria-controls="home-games-this-week-more" class="po-more-button [^"]*"[^>]*>Show all ${w.primary.length + w.rest.length} upcoming playoff games</button>`),
  );
  assert.match(section, /<div id="home-games-this-week-more" class="po-more [^"]*" data-open="false">/);
  const rest = element(section, 'data-home-games-list="rest"');
  assert.equal(count(rest, 'data-home-game="'), w.rest.length);
  assert.ok(w.rest.length > 0);
  assert.equal(count(section, 'data-home-game="'), w.primary.length + w.rest.length);
  // No game is listed twice.
  const keys = [...section.matchAll(/data-home-game="([^"]+)"/g)].map((m) => m[1]);
  assert.equal(new Set(keys).size, keys.length);
  // With scripts off the rows show and the button goes.
  assert.match(section, /<noscript><style>#home-games-this-week-more\.po-more\{display:block!important\}\[data-show-all="home-games-this-week-more"\]\{display:none!important\}<\/style><\/noscript>/);
});

test('HOME GAMES: nothing behind the button means no button', () => {
  // The MLB capture holds twelve timed games in three days: eight show, four
  // are behind the button.
  const v = view(FIXTURE.mlbLive);
  const w = homeGamesWindow([v], CAPTURED_AT);
  const html = leagueHtml(v);
  const BUTTON = '<button type="button" data-show-all=';
  assert.equal(w.rest.length, 4);
  assert.equal(count(html, BUTTON), 1);
  // The WNBA capture holds eight home games in the week, two of them "Time
  // TBD". The six with a time all fall in three days: no button.
  const wv = view(FIXTURE.wnbaLive);
  const ww = homeGamesWindow([wv], CAPTURED_AT);
  assert.deepEqual([wv.homeGames.length, ww.primary.length, ww.rest.length], [8, 6, 0]);
  assert.equal(count(leagueHtml(wv), BUTTON), 0);
  assert.ok(!textOf(element(leagueHtml(wv), 'data-home-games=')).includes('Time TBD'));
  // The mixed 2025 document on Oct 10: three home games left in its week,
  // on Oct 10 and 11, all inside three days; one is "Time TBD", so two list.
  const oct10 = new Date('2025-10-10T16:00:00Z');
  const few = view(FIXTURE.mlbMixed, oct10);
  const fw = homeGamesWindow([few], oct10);
  assert.equal(few.homeGames.filter((g) => g.day >= '2025-10-10' && g.day <= '2025-10-12').length, 3);
  assert.deepEqual([fw.primary.length, fw.rest.length], [2, 0]);
  const none = leagueHtml(few, { now: oct10 });
  assert.equal(count(none, BUTTON), 0);
  assert.equal(count(none, 'po-more'), 0);
  assert.equal(count(none, 'data-home-games-list="rest"'), 0);
  assert.equal(count(element(none, 'data-home-games-list="primary"'), 'data-home-game="'), 2);
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
  const mlb = element(html, 'data-league-card="MLB"');
  assert.ok(textOf(mlb).includes('Wild Card Series'));
  assert.equal(count(mlb, 'data-series="'), 4, 'the four series of the round being played');
  assert.ok(textOf(mlb).includes('Astros vs White Sox Game 1 · Tue, Sep 29 · 5:00 PM ET'));
  assert.ok(textOf(mlb).includes('Open the MLB bracket'));
  assert.ok(textOf(mlb).includes('Bracket updated Sep 29, 1:10 PM ET'));
  const wnba = element(html, 'data-league-card="WNBA"');
  assert.ok(textOf(wnba).includes('First Round'));
  assert.ok(textOf(wnba).includes('Lynx vs Liberty NYL leads 1-0'));
  assert.ok(textOf(wnba).includes('Bracket updated Sep 28, 8:02 PM ET'));
  assert.equal(count(html, 'data-hub-state="offseason"'), 0);
  assert.equal(count(html, 'data-bracket-updated'), 2);
});

test('HUB: each series line links to that series on the league page', () => {
  const html = hubHtml([ok(view(FIXTURE.mlbLive)), ok(view(FIXTURE.wnbaLive))]);
  assert.match(element(html, 'data-series="wild_card-1"'), /<a [^>]*href="\/playoffs\/mlb#wild_card-1"/);
  assert.match(element(html, 'data-series="wild_card-4"'), /<a [^>]*href="\/playoffs\/mlb#wild_card-4"/);
  assert.match(element(html, 'data-series="first_round-2"'), /<a [^>]*href="\/playoffs\/wnba#first_round-2"/);
  // And every one of them is a fragment the league page has a panel for.
  const league = leagueHtml(view(FIXTURE.mlbLive));
  for (const m of html.matchAll(/href="\/playoffs\/mlb#([^"]+)"/g)) assert.equal(count(league, `<section id="${m[1]}" `), 1, m[1]);
  assert.equal(count(element(html, 'data-league-card="MLB"'), 'href="/playoffs/mlb"'), 2, 'the heading and the footer link');
});

test('HUB: next home games across leagues: three days, eight rows, one button a row, the week behind "Show all"', () => {
  const views = [view(FIXTURE.mlbLive), view(FIXTURE.wnbaLive)];
  const w = homeGamesWindow(views, CAPTURED_AT);
  const html = hubHtml(views.map((v) => ok(v)));
  const list = element(html, 'data-home-games-list="primary"');
  assert.equal(count(list, 'data-home-game="'), 8);
  assert.equal(count(list, 'data-tickets-for="'), 8);
  const third = element(list, 'data-home-game="WNBA-first_round-3-g2"');
  const row = textOf(third);
  assert.ok(row.includes('Aces at Fever'));
  assert.ok(row.includes('WNBA'));
  assert.ok(row.includes('First Round · Game 2'));
  assert.ok(row.includes('Tue, Sep 29 · 6:30 PM ET'));
  assert.ok(row.includes('Gainbridge Fieldhouse'));
  assert.ok(third.includes('data-tickets-for="indiana-fever"'));
  assert.match(third, /href="\/venues\/gainbridge-fieldhouse"/);
  const section = element(html, 'data-home-games="next-home-games"');
  assert.match(section, /<h2[^>]*>Upcoming playoff games<\/h2>/);
  assert.ok(!/\bhome games?\b/i.test(textOf(element(html, 'data-playoffs-article='))), 'nothing on the hub calls them home games');
  assert.match(section, new RegExp(`aria-expanded="false" aria-controls="next-home-games-more"[^>]*>Show all ${w.primary.length + w.rest.length} upcoming playoff games</button>`));
  assert.equal(count(element(section, 'data-home-games-list="rest"'), 'data-home-game="'), w.rest.length);
});

test('HUB: a concluded league shows its champion and offers no games', () => {
  const html = hubHtml([ok(view(FIXTURE.mlbFinal, new Date('2025-11-02T04:00:00Z')))], new Date('2025-11-02T04:00:00Z'));
  const text = textOf(html);
  assert.ok(text.includes('2025 champion Los Angeles Dodgers Won the World Series 4-3'));
  assert.ok(html.includes('href="/mlb/los-angeles-dodgers"'));
  assert.ok(!text.includes('Upcoming playoff games'));
  assert.equal(count(html, 'data-predictions'), 0, 'the locked card is for a postseason still being played');
});

test('HUB: no league at all is the offseason state, with no date in it', () => {
  const html = hubHtml([]);
  const text = textOf(html);
  assert.equal(count(html, 'data-hub-state="offseason"'), 1);
  assert.ok(text.includes('No postseason is underway'));
  assert.equal(count(html, 'data-league-card="'), 0);
  assert.ok(!text.includes('Upcoming playoff games'));
  const block = element(html, 'data-hub-state="offseason"');
  assert.ok(!/\d/.test(textOf(block)), 'the offseason state holds no digit, so no date');
  assert.ok(block.includes('href="/teams"'));
});

test('HUB: finished leagues are not the offseason; nothing above their cards says no postseason is underway', () => {
  const now = new Date('2025-11-03T12:00:00Z');
  const html = hubHtml([ok(view(FIXTURE.mlbFinal, now)), ok(view(FIXTURE.wnbaFinal, now))], now);
  const text = textOf(html);
  assert.equal(count(html, 'data-league-card="'), 2);
  assert.equal(count(html, 'data-hub-state="offseason"'), 0);
  assert.ok(!text.includes('No postseason is underway'));
  assert.ok(!text.includes('A league appears here once'));
  assert.ok(text.includes('Los Angeles Dodgers'));
  assert.ok(text.includes('Las Vegas Aces'));
  // Only with no bracket at all is it the offseason.
  assert.equal(count(hubHtml([]), 'data-hub-state="offseason"'), 1);
});

test('HUB: the line never says an eliminated champion pick will win it all', () => {
  const base: HubPredictionLine = { league: 'MLB', href: '/playoffs/mlb#predictions', championName: 'Milwaukee Brewers', championStatus: 'alive', record: '3 for 7' };
  const text = (l: HubPredictionLine) => textOf(element(hubHtml([ok(view(FIXTURE.mlbFields, FIELDS_AT), l)], FIELDS_AT), 'data-predictions-league="mlb"'));
  assert.equal(text(base), 'PromoNight Predicts: Milwaukee Brewers win it all · 3 for 7');
  assert.equal(text({ ...base, championStatus: 'out' }), 'PromoNight Predicts picked Milwaukee Brewers to win it all · 3 for 7');
  assert.equal(text({ ...base, championStatus: 'won' }), 'PromoNight Predicts picked Milwaukee Brewers to win it all, and they did · 3 for 7');
});

test('HUB: the champion state reaches the hub line from the data, in each state', () => {
  // Still alive: the live Wild Card capture.
  const alive = buildWithPredictions(FIXTURE.mlbWildCard, PREDICTED.mlb, LYNX_OUT_AT).predictions.hub;
  assert.equal(alive.championStatus, 'alive');
  // Out: the Brewers knocked out in the Division Series, the World Series not played.
  const d = loadDoc(FIXTURE.mlbWildCard);
  decide(d, 'NL-WC-B', { winner: 'san-diego-padres' });
  decide(d, 'NL-DS-A', { winner: 'san-diego-padres' });
  const out = buildWithPredictions(d, PREDICTED.mlb, LYNX_OUT_AT).predictions.hub;
  assert.equal(out.championStatus, 'out');
  const outHtml = hubHtml([ok(view(FIXTURE.mlbFields, FIELDS_AT), out)], FIELDS_AT);
  assert.match(textOf(element(outHtml, 'data-predictions-league="mlb"')), /^PromoNight Predicts picked Milwaukee Brewers to win it all · \d+ for \d+$/);
  // Won: the WNBA bracket decided with the Valkyries champions.
  const won = buildWithPredictions(decidedWnba(), PREDICTED.wnba, new Date('2026-11-05T12:00:00Z')).predictions.hub;
  assert.equal(won.championStatus, 'won');
});

test('HUB: the predictions card, one line per playing league with a locked bracket, each linking to its section', () => {
  const built = buildWithPredictions(FIXTURE.wnbaLynxOut, PREDICTED.wnba, LYNX_OUT_AT);
  const mlb = buildWithPredictions(FIXTURE.mlbWildCard, PREDICTED.mlb, LYNX_OUT_AT);
  const html = hubHtml([ok(mlb.view, mlb.predictions.hub), ok(built.view, built.predictions.hub)], LYNX_OUT_AT);
  const section = element(html, 'data-predictions="locked"');
  assert.ok(textOf(section).includes('Predictions are locked'));
  assert.match(section, /<a [^>]*href="\/playoffs\/wnba#predictions"[^>]*>PromoNight Predicts: Golden State Valkyries win it all <span class="whitespace-nowrap">· 0 for 1<\/span><\/a>/);
  assert.match(section, /<a [^>]*href="\/playoffs\/mlb#predictions"[^>]*>PromoNight Predicts: Milwaukee Brewers win it all <span class="whitespace-nowrap">· no series decided yet<\/span><\/a>/);
  assert.ok(!/publish soon/i.test(html));
  assert.ok(!/[0-9a-f]{40,}/.test(html), 'no fingerprint on the hub');
  // Only leagues being played, and only with a locked bracket.
  assert.equal(count(hubHtml([ok(mlb.view)], LYNX_OUT_AT), 'data-predictions'), 0);
  const now = new Date('2025-11-03T12:00:00Z');
  assert.equal(count(hubHtml([ok(view(FIXTURE.mlbFinal, now), mlb.predictions.hub)], now), 'data-predictions'), 0, 'a finished league adds no line');
});

// ---- No series key, anywhere ----

for (const [name, fixture, make, now] of EVERY_VIEW) {
  test(`NO SERIES KEY (${name}): none in the league page or the hub, by shape or by name`, () => {
    const v = make();
    assertNoSeriesKey(leagueHtml(v, { now }), keysOf(fixture), 'league page');
    assertNoSeriesKey(hubHtml([ok(v)], now), keysOf(fixture), 'hub');
  });
}

test('STORED LABEL "Winner of AL-WC-B": renders "To be decided", and no key, feeder decided or not', () => {
  // Feeder still being played.
  const live = view(FIXTURE.mlbLive, CAPTURED_AT, (d) => {
    raw(d, 'AL-DS-A').lower = { placeholder: 'Winner of AL-WC-B', seed: null };
    for (const g of raw(d, 'AL-DS-A').games) if (g.away === 'NYY/BOS') g.away = 'Winner of AL-WC-B';
  });
  const page = leagueHtml(live);
  assertNoSeriesKey(page, keysOf(FIXTURE.mlbLive), 'league page, feeder live');
  assertNoSeriesKey(hubHtml([ok(live)]), keysOf(FIXTURE.mlbLive), 'hub, feeder live');
  assert.match(card(page, 'division_series-1'), /<span data-slot="placeholder" class="[^"]*border-dashed[^"]*"><span class="min-w-0">To be decided<\/span><\/span>/);
  assert.ok(textOf(panel(page, 'division_series-1')).includes('Rays vs To be decided'));

  // Feeder decided, which is when the pipeline writes this label. It is
  // still a dashed slot with no club in it.
  const decided = view(FIXTURE.mlbMixed, MIXED_AT, (d) => {
    raw(d, 'AL-CS').higher = { placeholder: 'Winner of AL-DS-A', seed: null };
    for (const g of raw(d, 'AL-CS').games) if (g.home === 'AL Higher Seed') g.home = 'Winner of AL-DS-A';
  });
  const done = leagueHtml(decided, { now: MIXED_AT });
  assertNoSeriesKey(done, keysOf(FIXTURE.mlbMixed), 'league page, feeder decided');
  const c = card(done, 'championship_series-1');
  assert.equal(count(c, 'data-slot="placeholder"'), 2);
  assert.equal(count(c, 'data-slot="club"'), 0);
  assert.ok(textOf(c).includes('To be decided'));
  assert.ok(!textOf(c).includes('Blue Jays'), 'no club was read out of the label');
  assert.equal(count(panel(done, 'championship_series-1'), 'data-club-link="'), 0);
});

test('THE FIELD RESOLVES: the same label beside feederSeriesKey renders the winner as a club', () => {
  const v = view(FIXTURE.mlbMixed, MIXED_AT, (d) => {
    raw(d, 'AL-CS').higher = { placeholder: 'Winner of AL-DS-A', seed: null, feederSeriesKey: 'AL-DS-A' };
    for (const g of raw(d, 'AL-CS').games) if (g.home === 'AL Higher Seed') g.home = 'Winner of AL-DS-A';
  });
  const html = leagueHtml(v, { now: MIXED_AT });
  assertNoSeriesKey(html, keysOf(FIXTURE.mlbMixed), 'league page');
  const c = card(html, 'championship_series-1');
  assert.equal(count(c, 'data-slot="club"'), 1);
  assert.ok(textOf(c).includes('Seed 1 Blue Jays'));
  assert.match(panel(html, 'championship_series-1'), /href="\/mlb\/toronto-blue-jays"/);
});

test('NO SERIES KEY: a feeder key on a slot puts no key in the HTML, in any of the three outcomes', () => {
  const runs: [string, Date, string, 'higher' | 'lower', Doc][] = [
    [FIXTURE.mlbMixed, MIXED_AT, 'AL-CS', 'higher', { feederSeriesKey: 'AL-DS-A' }],
    [FIXTURE.mlbMixed, MIXED_AT, 'AL-CS', 'lower', { feederSeriesKey: 'AL-DS-B', candidates: ['seattle-mariners', 'detroit-tigers'] }],
    [FIXTURE.mlbMixed, MIXED_AT, 'AL-CS', 'lower', { feederSeriesKey: 'AL-DS-B' }],
    [FIXTURE.mlbLive, CAPTURED_AT, 'AL-DS-A', 'lower', { feederSeriesKey: 'AL-WC-B', candidates: null }],
    [FIXTURE.wnbaMixed, new Date('2025-09-19T05:30:00Z'), 'SF-A', 'higher', { feederSeriesKey: 'R1-1v8' }],
    [FIXTURE.wnbaMixed, new Date('2025-09-19T05:30:00Z'), 'F', 'higher', { feederSeriesKey: 'SF-A' }],
  ];
  for (const [fixture, now, key, which, extra] of runs) {
    const v = view(fixture, now, (d) => {
      Object.assign(raw(d, key)[which], extra);
    });
    assertNoSeriesKey(leagueHtml(v, { now }), keysOf(fixture), `league page ${JSON.stringify(extra)}`);
    assertNoSeriesKey(hubHtml([ok(v)], now), keysOf(fixture), `hub ${JSON.stringify(extra)}`);
  }
});

test('the key scan would catch a key, were one there', () => {
  // Guards the scans above against a pattern that matches nothing.
  for (const leaked of ['<li data-series="AL-WC-B">', '<a href="#NL-DS-A">', '<span>Winner of AL-CS</span>', '<span>R1-1v8</span>', '<i>SF-A</i>', '<b>WS</b>', '<li data-k="F">']) {
    assert.throws(() => assertNoSeriesKey(leaked, ['AL-WC-B', 'NL-DS-A', 'AL-CS', 'WS', 'R1-1v8', 'SF-A', 'F'], 'probe'), assert.AssertionError, leaked);
  }
  assert.doesNotThrow(() => assertNoSeriesKey('<li data-series="wild_card-2"><a href="#world_series-1">NYY/BOS</a> SF/LAD</li>', ['AL-WC-B', 'WS', 'F'], 'probe'));
});

test('the key scan passes what is not a key: a sponsor, a score, a date, an id', () => {
  for (const fine of [
    'Presented by H-E-B.',
    '"sponsor":"H-E-B"',
    'T-Mobile Park',
    'Coca-Cola',
    'A-B-C',
    'X-Y-Z1',
    'U-S-A chant night',
    'NYL leads 1-0',
    'Best of 5 · 2-2-1',
    'data-series="division_series-3"',
    'href="/playoffs/wnba#first_round-1"',
    'SF/LAD',
    'AL Higher Seed',
    'R1 results',
  ]) {
    assert.equal(seriesKeyIn(fine), null, fine);
  }
  // And catches every form the documents use.
  for (const key of ['AL-WC-A', 'AL-WC-B', 'NL-WC-A', 'NL-DS-B', 'AL-DS-A', 'AL-CS', 'NL-CS', 'R1-1v8', 'R1-4v5', 'SF-A', 'SF-B']) {
    assert.equal(seriesKeyIn(`Winner of ${key}`), key, key);
  }
  // Every key of every fixture is either caught by form or checked by name.
  for (const f of [...Object.values(FIXTURE), ...Object.values(PREDICTED)]) for (const key of keysOf(f)) assert.ok(seriesKeyIn(key) === key || key === 'WS' || key === 'F', `${f}: ${key}`);
});

// ---- Properties of every page ----

for (const [name, fixture, make, now] of EVERY_VIEW) {
  test(`CLAIMS (${name}): no freshness wording, and "live" only as a game state`, () => {
    const v = make();
    for (const html of [leagueHtml(v, { now }), hubHtml([ok(v)], now)]) {
      const text = textOf(withoutBadges(html));
      assert.ok(!FRESHNESS_WORDS.test(text), `found ${text.match(FRESHNESS_WORDS)?.[0]}`);
      assert.ok(!/\bupdated (every|each)\b/i.test(text));
    }
  });

  test(`LEAKS (${name}): no operator value, no empty rendering, no aside`, () => {
    const v = make();
    const d = JSON.parse(rawText(fixture)) as Doc & { seeds: Doc; source: { urls: string[] }; series: RawSeries[] };
    for (const html of [leagueHtml(v, { now }), hubHtml([ok(v)], now)]) {
      for (const secret of [d.runId, d.bracketSha256, d.lastRevalidatedSha256, d.validatedSeedSha256, d.seeds.authoredBy, d.seeds.file, ...d.source.urls]) {
        if (typeof secret !== 'string') continue;
        assert.ok(!html.includes(secret), `${secret.slice(0, 24)} is in the markup`);
      }
      for (const s of d.series) for (const g of s.games) assert.ok(!html.includes(String(g.gameId)), `feed game id ${g.gameId} is in the markup`);
      const text = textOf(html);
      assert.ok(!/\b(undefined|null|NaN|\[object Object\])\b/.test(text));
      assert.ok(!/[\u2014\u2013]/.test(html), 'an em or en dash is in the markup');
      assert.ok(!/<aside\b/.test(html), 'an aside would be taken for the ad sidebar');
      assert.ok(!/<a [^>]*>(?:(?!<\/a>)[\s\S])*<a /.test(html), 'a link inside a link');
      assert.ok(!/<button [^>]*>(?:(?!<\/button>)[\s\S])*<(a|button) /.test(html), 'a control inside a button');
    }
  });
}
