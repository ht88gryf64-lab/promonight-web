/* eslint-disable no-console */
// Renders the playoffs pages in every state the bracket can be in, from the
// fixtures, into whole pages that can be measured in a browser.
//
// The ad placer sizes what it puts on a page by the article's height, and a
// bracket with nothing coming up is a short page unless its results are on
// it. That cannot be seen from the live document, which is in one state at a
// time; it has to be seen from the fixtures. Each state's article is
// rendered by the real components (the ones the routes render, with the real
// ticket buttons) and put into the shell of the served page (the real
// layout, styles and scripts), and measure-states.mjs then loads each page
// at phone width with every host but localhost refused.
//
//   BASE=http://localhost:3468 OUT=/tmp/states \
//     TSX_TSCONFIG_PATH=tsconfig.test.json npx tsx scripts/playoffs/render-states.tsx
//
// BASE is a running server of the build to measure, for the shell. OUT gets
// one HTML file per state and an index.json naming them and their floors.
import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { renderToStaticMarkup } from 'react-dom/server';
import { PlayoffsHub, type HubLeague } from '../../src/components/playoffs/PlayoffsHub';
import { PlayoffsLeague, type LeagueBody } from '../../src/components/playoffs/PlayoffsLeague';
import { seriesTickets, ticketButtons } from '../../src/components/playoffs/tickets';
import { mapBracketDoc } from '../../src/lib/postseason/map';
import { buildLeagueView, homeGamesWindow, type LeagueView } from '../../src/lib/postseason/view';
import { FIXTURE, buildWithPredictions, capturedTeams, clubs, decidedMlb, decidedWnba, loadDoc, parks, PREDICTED } from '../../src/lib/postseason/__tests__/helpers';
import type { LeaguePredictions } from '../../src/lib/postseason/predictions';
import type { Team } from '../../src/lib/types';

const BASE = (process.env.BASE || 'http://localhost:3468').replace(/\/$/, '');
const OUT = process.env.OUT;
if (!OUT) {
  console.error('Set OUT to a directory.');
  process.exit(2);
}

/** The floor at 390px, before any ad is placed. Below it the placer puts no
 *  in-content unit on the page. */
export const ARTICLE_FLOOR_PX = 1000;

// A doc is a fixture file, or one of the two brackets decided to the end
// from the 2026-10-01 captures (helpers.decidedWnba, helpers.decidedMlb).
const DECIDED: Record<string, () => Record<string, unknown>> = { 'decided:WNBA': decidedWnba, 'decided:MLB': decidedMlb };
const docOf = (name: string) => (DECIDED[name] ? DECIDED[name]() : loadDoc(name));

function view(name: string, now: Date): LeagueView {
  const d = docOf(name);
  const b = mapBracketDoc(d, { league: d.league as 'MLB' | 'WNBA', season: d.season as number });
  if (!b) throw new Error(`${name} does not map`);
  const v = buildLeagueView(b, clubs(), parks(), now);
  if (!v) throw new Error(`${name} does not build`);
  return v;
}

interface State {
  name: string;
  /** What the state is, for the report. */
  what: string;
  kind: 'league' | 'hub';
  /** Fixture files, one per league on the page. */
  docs: string[];
  now: string;
  /** False for a state that has not occurred and is measured for information only. */
  gated: boolean;
  /** The locked prediction for the page, a fixture file. Absent: none. */
  predicted?: string;
}

function predictionsFor(s: State, doc: string): LeaguePredictions | null {
  if (!s.predicted) return null;
  return buildWithPredictions(docOf(doc), s.predicted, new Date(s.now)).predictions;
}
const P_MLB = PREDICTED.mlb;
const P_WNBA = PREDICTED.wnba;

// The five states the floor is required in, plus the ones between them and
// one that has not occurred (a bracket set days before its first game).
export const STATES: State[] = [
  { name: 'league-live-mlb', what: 'MLB, first round being played, a game in progress', kind: 'league', docs: [FIXTURE.mlbInGame], now: '2026-09-29T19:09:00Z', gated: true, predicted: P_MLB },
  { name: 'league-live-wnba', what: 'WNBA, first round being played', kind: 'league', docs: [FIXTURE.wnbaFields], now: '2026-09-29T20:08:00Z', gated: true, predicted: P_WNBA },
  { name: 'league-between-rounds-mlb', what: 'MLB, Wild Card done, Division Series tomorrow', kind: 'league', docs: ['MLB_2025.replay-step-11.json'], now: '2025-10-03T14:00:00Z', gated: true },
  { name: 'league-between-rounds-wnba', what: 'WNBA, semifinals done, Finals three days out (no home game in the window)', kind: 'league', docs: ['WNBA_2025.replay-step-20.json'], now: '2025-10-01T12:00:00Z', gated: true },
  { name: 'league-one-round-left-mlb', what: 'MLB, only the World Series left, four days out', kind: 'league', docs: ['MLB_2025.replay-step-40.json'], now: '2025-10-21T12:00:00Z', gated: true },
  { name: 'league-finished-mlb', what: 'MLB, finished', kind: 'league', docs: [FIXTURE.mlbFinal], now: '2025-11-03T12:00:00Z', gated: true },
  { name: 'league-finished-wnba', what: 'WNBA, finished', kind: 'league', docs: [FIXTURE.wnbaFinal], now: '2025-10-12T12:00:00Z', gated: true },
  { name: 'hub-live', what: 'hub, both leagues being played', kind: 'hub', docs: [FIXTURE.mlbFields, FIXTURE.wnbaFields], now: '2026-09-29T20:08:00Z', gated: true, predicted: 'both' },
  { name: 'hub-between-rounds', what: 'hub, MLB between rounds, WNBA semifinals done', kind: 'hub', docs: ['MLB_2025.replay-step-11.json', 'WNBA_2025.replay-step-20.json'], now: '2025-10-03T14:00:00Z', gated: true },
  { name: 'hub-no-home-games', what: 'hub, World Series four days out, WNBA finished: no home game in the window', kind: 'hub', docs: ['MLB_2025.replay-step-40.json', FIXTURE.wnbaFinal], now: '2025-10-21T12:00:00Z', gated: true },
  { name: 'hub-finished', what: 'hub, both leagues finished', kind: 'hub', docs: [FIXTURE.mlbFinal, FIXTURE.wnbaFinal], now: '2025-11-03T12:00:00Z', gated: true },
  { name: 'league-lynx-out-wnba', what: 'WNBA, the Lynx out, three first-round series live, with the PromoNight Predicts bracket', kind: 'league', docs: [FIXTURE.wnbaLynxOut], now: '2026-10-01T00:17:37Z', gated: true, predicted: P_WNBA },
  { name: 'league-wild-card-mlb', what: 'MLB, all four Wild Card series live, with the PromoNight Predicts bracket', kind: 'league', docs: [FIXTURE.mlbWildCard], now: '2026-10-01T00:17:37Z', gated: true, predicted: P_MLB },
  { name: 'league-decided-wnba', what: 'WNBA, decided to the end (built from the 10-01 capture), with the final scorecard', kind: 'league', docs: ['decided:WNBA'], now: '2026-11-05T12:00:00Z', gated: true, predicted: P_WNBA },
  { name: 'league-decided-mlb', what: 'MLB, decided to the end (built from the 10-01 capture), with the final scorecard', kind: 'league', docs: ['decided:MLB'], now: '2026-11-05T12:00:00Z', gated: true, predicted: P_MLB },
  { name: 'hub-lynx-out', what: 'hub, both leagues live on 10-01, with the predictions card', kind: 'hub', docs: [FIXTURE.mlbWildCard, FIXTURE.wnbaLynxOut], now: '2026-10-01T00:17:37Z', gated: true, predicted: 'both' },
  { name: 'league-set-early-mlb', what: 'MLB, bracket set five days before its first game (has not occurred)', kind: 'league', docs: [FIXTURE.mlbLive], now: '2026-09-24T12:00:00Z', gated: false, predicted: P_MLB },
  // Two states the reviewer measured below the floor. Neither is reachable
  // while both 2026 documents exist; both become reachable the day the season
  // constant is bumped and before the new documents are created.
  { name: 'hub-one-bracket-between-rounds', what: 'hub with one bracket only, WNBA between rounds with no home game in the window (not reachable this season)', kind: 'hub', docs: ['WNBA_2025.replay-step-11.json'], now: '2025-09-19T06:00:00Z', gated: false },
  { name: 'hub-empty', what: 'hub with no bracket at all, the offseason (not reachable this season)', kind: 'hub', docs: [], now: '2026-01-15T12:00:00Z', gated: false },
];

function leagueArticle(s: State, teams: Map<string, Team>): string {
  const v = view(s.docs[0], new Date(s.now));
  const homeGames = v.phase.kind === 'active' ? homeGamesWindow([v], new Date(s.now)) : { primary: [], rest: [] };
  const body: LeagueBody = { state: 'ok', view: v, predictions: predictionsFor(s, s.docs[0]), homeGames };
  const tickets = ticketButtons([...homeGames.primary, ...homeGames.rest].map((g) => g.hostTeamId), teams, 'web_playoffs_league', 'playoffs_league');
  const upcoming = v.rounds.flatMap((r) => r.groups.flatMap((g) => g.series.map((x) => ({ id: x.id, hostTeamId: x.next && x.next.state === 'scheduled' ? x.next.hostTeamId : null }))));
  const panelTickets = seriesTickets(upcoming, teams, 'web_playoffs_league', 'playoffs_league');
  return renderToStaticMarkup(<PlayoffsLeague league={v.league} season={v.season} body={body} tickets={tickets} panelTickets={panelTickets} otherLeagues={[]} />);
}

function hubArticle(s: State, teams: Map<string, Team>): string {
  const now = new Date(s.now);
  const leagues: HubLeague[] = s.docs.map((d) => {
    const v = view(d, now);
    const predicted = s.predicted ? (v.league === 'MLB' ? P_MLB : P_WNBA) : null;
    const line = predicted ? buildWithPredictions(docOf(d), predicted, now).predictions.hub : null;
    return { state: 'ok', league: v.league, href: `/playoffs/${v.league.toLowerCase()}`, view: v, predictions: line };
  });
  const active = leagues.flatMap((l) => (l.view.phase.kind === 'active' ? [l.view] : []));
  const next = homeGamesWindow(active, now);
  const tickets = ticketButtons([...next.primary, ...next.rest].map((g) => g.hostTeamId), teams, 'web_playoffs', 'playoffs_hub');
  return renderToStaticMarkup(<PlayoffsHub season={leagues[0]?.view.season ?? 2026} leagues={leagues} nextGames={next} tickets={tickets} />);
}

/** The served page with its article swapped for `article`. Everything else,
 *  the layout, the stylesheet links, the scripts, is the build's own. */
function intoShell(shell: string, article: string): string {
  const open = shell.indexOf('<article class="page-content"');
  const close = shell.indexOf('</article>', open);
  if (open < 0 || close < 0) throw new Error('the shell has no playoffs article');
  const a0 = article.indexOf('<article class="page-content"');
  const a1 = article.indexOf('</article>', a0) + '</article>'.length;
  if (a0 < 0) throw new Error('the rendered state has no article');
  // The page's scripts are removed. They carry the flight payload of the
  // shell's own article, and hydrating from it would put that article back
  // in place of this one. What is measured is the article as the server
  // sends it, styled by the build's stylesheet, which is what the ad placer
  // finds before it places anything: its units come after hydration, and
  // hydration changes no height here (the bracket's state is in the markup).
  const page = shell.slice(0, open) + article.slice(a0, a1) + shell.slice(close + '</article>'.length);
  return page.replace(/<script\b[^>]*>[\s\S]*?<\/script>/g, '');
}

async function main() {
  mkdirSync(OUT as string, { recursive: true });
  const shells: Record<'league' | 'hub', string> = { league: '', hub: '' };
  for (const [kind, path] of [['league', '/playoffs/mlb'], ['hub', '/playoffs']] as const) {
    const res = await fetch(`${BASE}${path}`);
    if (res.status !== 200) throw new Error(`${path} answered ${res.status}`);
    shells[kind] = await res.text();
  }
  const teams = new Map(capturedTeams().map((t) => [t.id, t]));
  const index: { name: string; what: string; kind: string; file: string; gated: boolean; floor: number }[] = [];
  for (const s of STATES) {
    const article = s.kind === 'league' ? leagueArticle(s, teams) : hubArticle(s, teams);
    const html = intoShell(shells[s.kind], article);
    const file = `${s.name}.html`;
    writeFileSync(join(OUT as string, file), html);
    index.push({ name: s.name, what: s.what, kind: s.kind, file, gated: s.gated, floor: ARTICLE_FLOOR_PX });
    console.log(`${s.name}: ${html.length} bytes`);
  }
  writeFileSync(join(OUT as string, 'index.json'), JSON.stringify(index, null, 2));
}

main().catch((e) => {
  console.error(e instanceof Error ? e.stack : e);
  process.exit(1);
});
