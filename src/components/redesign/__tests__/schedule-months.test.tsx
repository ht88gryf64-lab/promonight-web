/* The MLB date list as collapsed month sections, and the four copy fixes.
 *
 * Rulings (2026-10-01) these tests hold:
 *  - native <details>/<summary>, one per month, ALL collapsed by default;
 *  - every regular-season row in the server HTML while collapsed;
 *  - header "{Month} {Year} · {N} games", N regular-season games only;
 *  - each month its own block inside page-content, units only BETWEEN months:
 *    no anchor ever inside a <details>, a game row or an expanded panel;
 *  - the intro says what the list is; postseason games stay off it; the Games
 *    tile counts the same population; no "open a row for tickets" over a
 *    fully played season. */
import { test } from 'node:test';
import assert from 'node:assert';
import { readFileSync } from 'node:fs';
import { renderToStaticMarkup } from 'react-dom/server';
import { ScheduleBlock } from '../ScheduleBlock';
import { GameExpand } from '../GameExpand';
import { regularSeasonContexts } from '@/lib/schedule-months';
import { TITLE_SEASON_YEAR } from '@/lib/title-treatment';
import type { GameContext } from '@/lib/data';
import { BRAVES, LIONS, METS, NFL_CONTEXTS, PHILLIES, mlbCtx, mlbGame } from './fixtures/schedule-fixtures';

// ── A minimal tree over React's static markup (no parser is installed) ──
type Node = { tag: string; attrs: string; children: Node[]; text: string; parent: Node | null };
const VOID = new Set(['br', 'img', 'hr', 'input', 'meta', 'link', 'source', 'wbr']);
function parse(html: string): Node {
  const root: Node = { tag: '#root', attrs: '', children: [], text: '', parent: null };
  let cur = root;
  const re = /<(\/?)([a-zA-Z][a-zA-Z0-9-]*)([^>]*)>|([^<]+)/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(html))) {
    if (m[4] !== undefined) { cur.text += m[4]; continue; }
    const [, close, tag, attrs] = m;
    if (close) { assert.equal(cur.tag, tag, `unbalanced </${tag}>`); cur = cur.parent!; continue; }
    const node: Node = { tag, attrs, children: [], text: '', parent: cur };
    cur.children.push(node);
    if (!VOID.has(tag) && !attrs.endsWith('/')) cur = node;
  }
  assert.equal(cur, root, 'document not closed');
  return root;
}
const all = (n: Node, pred: (x: Node) => boolean, out: Node[] = []): Node[] => {
  for (const c of n.children) { if (pred(c)) out.push(c); all(c, pred, out); }
  return out;
};
const textOf = (n: Node): string => n.text + n.children.map(textOf).join('');
const cls = (n: Node) => (/class="([^"]*)"/.exec(n.attrs)?.[1] ?? '').split(/\s+/);
const hasAncestor = (n: Node, pred: (x: Node) => boolean) => { for (let p = n.parent; p; p = p.parent) if (pred(p)) return true; return false; };
const isAnchorish = (n: Node) => cls(n).includes('page-content') || /adthrive|data-ad-|rd-weave/.test(n.attrs);

// ── A Braves-shaped season: 162 played games Mar 26 to Sep 27 with doubleheaders,
//    plus the docs that must stay off the list: 3 Wild Card games, 2 stale
//    postponed originals, 1 canceled game. ──
function season(): GameContext[] {
  const rows: GameContext[] = [];
  let day = Date.UTC(2026, 2, 26);
  let id = 5000;
  while (rows.length < 162) {
    const date = new Date(day).toISOString().slice(0, 10);
    day += 86_400_000;
    if (date.endsWith('-15')) continue; // an off day each month
    const opp = rows.length % 2 ? METS : PHILLIES;
    rows.push(mlbCtx(mlbGame(date, rows.length % 3 !== 0, opp, { mlbGameId: ++id }), opp));
    if (date === '2026-05-31' && rows.length < 162) rows.push(mlbCtx(mlbGame(date, true, opp, { mlbGameId: ++id, doubleheaderGame: 2 }), opp));
  }
  const reg = rows.slice();
  rows.push(mlbCtx(mlbGame('2026-07-28', false, METS, { status: 'scheduled', mlbGameId: reg[100].game.mlbGameId }), METS));
  rows.push(mlbCtx(mlbGame('2026-04-03', false, METS, { status: 'scheduled', mlbGameId: reg[5].game.mlbGameId }), METS));
  rows.push(mlbCtx(mlbGame('2026-09-28', false, METS, { status: 'canceled' }), METS));
  for (const d of ['2026-09-29', '2026-09-30', '2026-10-01']) rows.push(mlbCtx(mlbGame(d, true, PHILLIES, { isPostseason: true, status: 'scheduled' }), PHILLIES));
  return rows.sort((a, b) => a.game.date.localeCompare(b.game.date));
}
const SEASON = season();
const render = (contexts: GameContext[], today?: string) =>
  renderToStaticMarkup(<ScheduleBlock contexts={contexts} team={BRAVES} teamName="Atlanta Braves" today={today} />);
const OVER = render(SEASON, '2026-10-01');
const TREE = parse(OVER);
const details = all(TREE, (n) => n.tag === 'details');
const rowsLi = all(TREE, (n) => n.tag === 'li');

test('fixture sanity: 168 docs, 162 regular-season games', () => {
  assert.equal(SEASON.length, 168);
  assert.equal(regularSeasonContexts(SEASON).length, 162);
});

test('one native <details> per month, March to September, every one collapsed', () => {
  assert.equal(details.length, 7);
  for (const d of details) {
    assert.doesNotMatch(d.attrs, /\bopen\b/, 'a month rendered expanded by default');
    assert.equal(d.children[0].tag, 'summary', 'summary is the first child, so the platform owns toggle and state');
    assert.doesNotMatch(d.children[0].attrs, /\b(role|tabindex|aria-expanded|onclick)=/i, 'the summary keeps its native semantics');
    assert.doesNotMatch(d.children[0].attrs, /outline-none|outline-0/, 'focus ring not removed');
  }
  assert.doesNotMatch(OVER, /<details[^>]*\sopen/);
});

test('every regular-season row is in the server HTML while collapsed', () => {
  assert.equal(rowsLi.length, 162, 'row count equals the regular-season game count');
  for (const li of rowsLi) assert.ok(hasAncestor(li, (p) => p.tag === 'details'), 'every row sits inside a month');
});

test('month headers read "{Month} {Year} · {N} games", regular-season games only, and sum to the season', () => {
  const heads = details.map((d) => textOf(d.children[0]).trim());
  assert.deepStrictEqual(heads.map((h) => h.replace(/ · \d+ games?$/, '')), [
    'March 2026', 'April 2026', 'May 2026', 'June 2026', 'July 2026', 'August 2026', 'September 2026',
  ]);
  for (const h of heads) assert.match(h, /^[A-Z][a-z]+ 2026 · \d+ games?$/);
  const n = heads.map((h) => Number(/ · (\d+) games?$/.exec(h)![1]));
  details.forEach((d, i) => assert.equal(all(d, (x) => x.tag === 'li').length, n[i], `${heads[i]} counts its own rows`));
  assert.equal(n.reduce((a, b) => a + b, 0), 162);
  assert.doesNotMatch(heads.join(' '), /promo/i, 'no promo counts in a header');
});

test('ads: page-content holds one wrapper per month (all but the last), and nothing anchor-like sits inside a month', () => {
  const pcs = all(TREE, (n) => cls(n).includes('page-content'));
  assert.equal(pcs.length, 1, 'one page-content wrapper');
  const kids = pcs[0].children;
  assert.equal(kids.length, 6, 'all months but the last');
  for (const k of kids) {
    assert.equal(k.tag, 'div', 'a page-content child is a plain wrapper, never the <details> itself');
    assert.equal(k.children.length, 1);
    assert.equal(k.children[0].tag, 'details');
  }
  const last = details[details.length - 1];
  assert.ok(!hasAncestor(last, (p) => cls(p).includes('page-content')), 'the last month is outside the anchor wrapper');
  for (const d of details) assert.deepStrictEqual(all(d, isAnchorish), [], 'an anchor or ad hook inside a month');
  for (const li of rowsLi) assert.deepStrictEqual(all(li, isAnchorish), [], 'an anchor or ad hook inside a game row');
});

test('ads: an expanded panel carries no anchor (GameExpand, home and away)', () => {
  for (const c of [SEASON.find((x) => x.isHome)!, SEASON.find((x) => !x.isHome)!]) {
    const html = renderToStaticMarkup(
      <GameExpand dateStr={c.game.date} contexts={[c]} team={BRAVES} teamSlug="atlanta-braves" teamName="Atlanta Braves" />,
    );
    assert.ok(html.length > 0);
    assert.deepStrictEqual(all(parse(html), isAnchorish), []);
  }
});

test('a single month renders without an anchor wrapper', () => {
  const html = render(SEASON.filter((c) => c.game.date.startsWith('2026-04')), '2026-10-01');
  assert.equal((html.match(/<details/g) ?? []).length, 1);
  assert.doesNotMatch(html, /page-content/);
});

test('fix (a): the intro says what the list is, and never "week by week"', () => {
  assert.match(OVER, /Every game of the 2026 regular season, by month\./);
  assert.doesNotMatch(OVER, /week by week|Week \d/i);
});

test('fix (b): postseason games, stale originals and the canceled game are off the list', () => {
  const labels = rowsLi.map((li) => textOf(li));
  for (const d of ['Sep 29', 'Sep 30', 'Oct 1', 'Sep 28']) assert.ok(!labels.some((t) => t.includes(d)), `${d} listed`);
  assert.doesNotMatch(OVER, /October 2026/);
  assert.equal(labels.filter((t) => t.includes('Jul 28')).length, 1, 'the stale 07-28 original does not double the date');
});

test("fix (c): the Games tile reads the list's population", () => {
  // The tile is fed by RedesignTeamPage; pin the call so it cannot drift back
  // to the raw doc count while the helper's own tests pass.
  const page = readFileSync('src/components/redesign/RedesignTeamPage.tsx', 'utf8');
  assert.match(page, /const regularGames = gameContexts \? regularSeasonContexts\(gameContexts, today\) : undefined;/);
  assert.match(page, /gamesCount=\{regularGames\?\.length\}/);
  assert.doesNotMatch(page, /gamesCount=\{gameContexts\?\.length\}/);
  // The schedule is gated on the same population, so the slot cannot render empty.
  assert.match(page, /const showSchedule = hasNoUpcoming && \(regularGames\?\.length \?\? 0\) > 0;/);
  // And the page's one clock read reaches the list, or the invitation could never return in season.
  assert.match(page, /<ScheduleBlock contexts=\{gameContexts\} team=\{team\} teamName=\{displayName\} today=\{today\} \/>/);
  assert.equal(regularSeasonContexts(SEASON).length, rowsLi.length, 'tile population equals the list');
});

test('fix (d): no ticket invitation over a fully played season; it returns while a game remains', () => {
  assert.doesNotMatch(OVER, /tickets/i);
  assert.match(OVER, /Open a month to see its games\./);
  // Mid-season: games from today on are still scheduled.
  const midSeason = render(SEASON.map((c) => (c.game.date >= '2026-06-01' && !c.game.isPostseason ? { ...c, game: { ...c.game, status: 'scheduled' as const } } : c)), '2026-06-01');
  assert.match(midSeason, /Open a month to see its games, and a game for tickets, parking and hotels on the road\./);
  assert.doesNotMatch(render(SEASON), /tickets/i, 'no clock read means no claim');
  // A postseason doc in the future must not revive the invitation.
  assert.doesNotMatch(render(SEASON, '2026-09-29'), /tickets/i);
});

test('fix (d): a game played today does not keep the invitation; a game still scheduled today does', () => {
  const last = SEASON.filter((c) => !c.game.isPostseason && c.game.status === 'completed').at(-1)!;
  assert.doesNotMatch(render(SEASON, last.game.date), /tickets/i, 'completed today, nothing left');
  const tonight = SEASON.map((c) => (c === last ? { ...c, game: { ...c.game, status: 'scheduled' as const } } : c));
  assert.match(render(tonight, last.game.date), /tickets/i, 'scheduled today is still ahead');
});

test('a 2027 doc landing in January joins neither the list nor the header counts', () => {
  const html = render([...SEASON, mlbCtx(mlbGame('2027-03-25', true, METS, { status: 'scheduled' }), METS)], '2027-01-10');
  assert.doesNotMatch(html, /2027 ·|March 2027/);
  assert.equal((html.match(/<li class="overflow-hidden/g) ?? []).length, 162);
  assert.doesNotMatch(html, /tickets/i);
});

test('month sections are MLB only: an NFL slate missing a week keeps main\'s flat list', () => {
  const weekless = NFL_CONTEXTS.map((c, i) => (i === 3 ? { ...c, game: { ...c.game, week: undefined } } : c));
  const html = renderToStaticMarkup(<ScheduleBlock contexts={weekless} team={LIONS} teamName="Detroit Lions" today="2026-09-01" />);
  assert.doesNotMatch(html, /<details|page-content|by month/);
  assert.match(html, /week by week/);
});

test('the MLB copy and the population share one season constant', () => {
  assert.equal(TITLE_SEASON_YEAR, 2026, 'bump this test with the constant, deliberately');
  assert.match(OVER, new RegExp(`${TITLE_SEASON_YEAR} season</div>`));
  assert.match(OVER, new RegExp(`Atlanta Braves ${TITLE_SEASON_YEAR} Game Schedule</h2>`));
  const src = readFileSync('src/components/redesign/ScheduleBlock.tsx', 'utf8');
  const dateList = src.slice(src.indexOf('function DateListSchedule'));
  assert.doesNotMatch(dateList.replace(/\{\/\*[\s\S]*?\*\/\}|\/\/.*$/gm, ''), /\b2026\b/, 'no hardcoded year in the MLB branch');
});

test('the month uses a named group, so hover inside an open row cannot reach month styles or the reverse', () => {
  for (const d of details) {
    assert.match(d.attrs, /class="group\/month"/);
    assert.doesNotMatch(d.attrs, /class="(?:[^"]* )?group(?: [^"]*)?"/);
  }
});
