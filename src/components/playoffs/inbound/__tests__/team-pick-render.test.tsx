// The PromoNight Predicts line in the team-page module, the hub hero line and
// the final-bracket card, as HTML and as the element tree the RSC payload
// carries.
//
// BYTE IDENTITY. The golden is every club's module (80 of them, in four
// bracket states) and two hub heroes, rendered by main's own code at b880810
// with scripts/playoffs/byte-identity-golden.tsx. A module with no line and a
// hero with no notice must render to the same HTML and the same tree.
import { test, mock } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { renderToStaticMarkup } from 'react-dom/server';
import { clubPlayoffs, leagueFinalCard, leagueHeroLine } from '../../../../lib/postseason/inbound';
import { FIXTURE, PREDICTED, buildWithPredictions, clubs, loadDoc } from '../../../../lib/postseason/__tests__/helpers';
import { walk } from '../../../../lib/postseason/__tests__/element-tree';
import { teamPick, type TeamPickView } from '../../../../lib/postseason/team-pick';
import { TeamPlayoffsModule } from '../TeamPlayoffsModule';
import { LeagueFinalBracketCard, LeaguePlayoffsHeroLine } from '../LeaguePlayoffsCard';
import { HubHero } from '../../../hub/HubHero';
import { heroes, inboundOf, teamModules, type Rendered } from './byte-identity-cases';

mock.module('server-only', { namedExports: {} });
mock.module(new URL('../../../../lib/firebase.ts', import.meta.url).href, { namedExports: { db: {} } });

const GOLDEN = JSON.parse(readFileSync(new URL('../__fixtures__/byte-identity.main-b880810.json', import.meta.url), 'utf8')) as {
  teamModules: Record<string, Rendered>;
  heroes: Record<string, Rendered>;
};

const TODAY_AT = new Date('2026-10-01T16:25:27Z');
const TODAY = () => [loadDoc('MLB_2026.live-20261001T1625Z.json'), loadDoc('WNBA_2026.live-20261001T1625Z.json')];
const textOf = (html: string) => html.replace(/<[^>]+>/g, ' ').replace(/&#x27;/g, "'").replace(/&amp;/g, '&').replace(/\s+/g, ' ').trim();

// ---- Byte identity ----

test('BYTE IDENTITY: every module with no line renders the HTML and the tree main rendered', () => {
  const now = teamModules();
  assert.equal(Object.keys(now).length, 80);
  assert.deepEqual(Object.keys(now).sort(), Object.keys(GOLDEN.teamModules).sort());
  for (const [k, v] of Object.entries(now)) {
    assert.equal(v.html, GOLDEN.teamModules[k].html, `${k}: html`);
    assert.deepEqual(v.tree, GOLDEN.teamModules[k].tree, `${k}: tree`);
  }
});

test('BYTE IDENTITY: a hub hero with no notice renders the HTML and the tree main rendered', () => {
  const now = heroes();
  for (const [k, v] of Object.entries(now)) {
    assert.equal(v.html, GOLDEN.heroes[k].html, `${k}: html`);
    assert.deepEqual(v.tree, GOLDEN.heroes[k].tree, `${k}: tree`);
  }
});

// ---- The line in the module ----

/** Each club's module on today's brackets, with its line. */
function withLines(): { slug: string; pick: TeamPickView; html: string; tree: unknown; golden: Rendered }[] {
  const inbound = inboundOf(TODAY(), TODAY_AT);
  const out = [];
  for (const [league, predicted] of [['MLB', PREDICTED.mlb], ['WNBA', PREDICTED.wnba]] as const) {
    const l = inbound.find((x) => x.league === league)!;
    const built = buildWithPredictions(league === 'MLB' ? TODAY()[0] : TODAY()[1], predicted, TODAY_AT);
    for (const slug of new Set(built.predicted.series.flatMap((s) => [s.higher.slug, s.lower.slug]))) {
      const pick = teamPick(l.bracket, built.predicted, slug, clubs());
      assert.ok(typeof pick !== 'string', slug);
      const club = clubPlayoffs(inbound, slug)!;
      const el = <TeamPlayoffsModule club={club} teamId={slug} teamName={clubs().get(slug)!.name} pick={pick} />;
      out.push({ slug, pick, html: renderToStaticMarkup(el), tree: walk(el), golden: GOLDEN.teamModules[`today-1625Z/${slug}`] });
    }
  }
  return out;
}

test('WITH A LINE: the module is main\'s module plus one last child, and nothing else changes', () => {
  const rows = withLines();
  assert.equal(rows.length, 20);
  for (const r of rows) {
    // HTML: main's markup with the line inserted before the section closes.
    assert.ok(r.html.endsWith('</div></section>'), r.slug);
    const at = r.html.lastIndexOf('<div data-team-pick=');
    assert.equal(r.html.slice(0, at) + '</section>', r.golden.html, `${r.slug}: everything but the line is main's`);
    // Tree: the same section, with the same children, and one more.
    const t = r.tree as { $: string; props: { children: unknown[] } };
    const g = r.golden.tree as { $: string; props: { children: unknown[] } };
    assert.equal(t.$, 'section');
    assert.deepEqual({ ...t, props: { ...t.props, children: t.props.children.slice(0, -1) } }, g, `${r.slug}: tree`);
    assert.equal(t.props.children.length, g.props.children.length + 1);
  }
});

test('WITH A LINE: eyebrow, the pick, the status, one link to the league page\'s predictions', () => {
  for (const r of withLines()) {
    const block = r.html.slice(r.html.lastIndexOf('<div data-team-pick='));
    assert.match(block, new RegExp(`^<div data-team-pick="${r.pick.kind}"`));
    const text = textOf(block);
    assert.ok(text.startsWith('PromoNight Predicts '), text);
    assert.ok(text.includes(r.pick.pickLine), text);
    assert.ok(text.includes(r.pick.statusLine), text);
    assert.ok(text.endsWith('See every PromoNight Predicts pick'), text);
    const links = [...block.matchAll(/<a [^>]*href="([^"]+)"/g)].map((m) => m[1]);
    assert.deepEqual(links, [r.pick.href]);
    assert.match(r.pick.href, /^\/playoffs\/(mlb|wnba)#predictions$/);
  }
});

test('WITH A LINE: no ad container, no aside, no article, no dash, no "live", no "computer", no id', () => {
  for (const r of withLines()) {
    const block = r.html.slice(r.html.lastIndexOf('<div data-team-pick='));
    assert.ok(!/<aside\b|<article\b|adthrive|data-ad-|page-content/.test(block), r.slug);
    assert.ok(!/[\u2014\u2013]/.test(block), r.slug);
    assert.ok(!/\blive\b/i.test(textOf(block)), r.slug);
    assert.ok(!/computer/i.test(block), r.slug);
    assert.ok(!/[A-Z]{2}-(WC|DS|CS)|R1-\dv\d|SF-[AB]|[0-9a-f]{16}/.test(block), r.slug);
  }
});

test('WITH A LINE: today\'s five states are all there', () => {
  const kinds = new Set(withLines().map((r) => r.pick.kind));
  assert.deepEqual([...kinds].sort(), ['alive', 'busted', 'correct', 'decides']);
  const busted = withLines().filter((r) => r.pick.kind === 'busted').map((r) => r.pick.statusLine);
  assert.ok(busted.some((l) => l.includes('went out earlier than picked')));
  assert.ok(busted.some((l) => l.includes('went further than picked')));
});

// ---- The hub hero line ----

test('HERO LINE: the real bracket\'s current round, the league page, while the league is being played', () => {
  const inbound = inboundOf(TODAY(), TODAY_AT);
  assert.deepEqual(leagueHeroLine(inbound, 'MLB'), { league: 'MLB', href: '/playoffs/mlb', text: '2026 MLB Playoffs: Wild Card Series. Open the bracket' });
  assert.deepEqual(leagueHeroLine(inbound, 'WNBA'), { league: 'WNBA', href: '/playoffs/wnba', text: '2026 WNBA Playoffs: First Round. Open the bracket' });
});

test('HERO LINE: with no round to name, the line without one', () => {
  const inbound = inboundOf(TODAY(), TODAY_AT);
  for (const blank of ['', '   ']) {
    const l = inbound.find((x) => x.league === 'MLB')!;
    const edited = [{ ...l, view: { ...l.view, phase: { kind: 'active' as const, roundKey: 'wild_card', roundLabel: blank } } }];
    assert.equal(leagueHeroLine(edited, 'MLB')?.text, '2026 MLB Playoffs. Open the bracket');
  }
});

test('HERO LINE: none for a finished bracket, none for a league not in the list, none after the window', () => {
  const DAY = 24 * 60 * 60 * 1000;
  const ended = Date.parse('2025-10-11T00:00:00Z');
  const done = inboundOf([loadDoc(FIXTURE.wnbaFinal)], new Date(ended + 2 * DAY));
  assert.ok(done.length === 1 && done[0].view.phase.kind === 'concluded');
  assert.equal(leagueHeroLine(done, 'WNBA'), null);
  assert.equal(leagueHeroLine(inboundOf(TODAY(), TODAY_AT), 'NHL'), null);
  assert.equal(leagueHeroLine([], 'MLB'), null);
});

test('HERO LINE in the hero: one link, after the freshness line and before the stat bar, and the hero is otherwise main\'s', () => {
  const line = leagueHeroLine(inboundOf(TODAY(), TODAY_AT), 'MLB')!;
  const el = (
    <HubHero
      eyebrow="MLB League Hub"
      title="MLB PROMOTIONS 2026"
      subtitle="Sub"
      freshness="Fresh"
      accent="#7c4a3a"
      notice={<LeaguePlayoffsHeroLine line={line} surface="web_mlb_hub" />}
    >
      <div data-stats>stats</div>
    </HubHero>
  );
  const html = renderToStaticMarkup(el);
  const notice = /<p data-playoffs-hero[^>]*><a [^>]*href="\/playoffs\/mlb"[^>]*>2026 MLB Playoffs: Wild Card Series\. Open the bracket<\/a><\/p>/;
  assert.match(html, notice);
  assert.ok(html.indexOf('Fresh') < html.search(notice) && html.search(notice) < html.indexOf('data-stats'));
  assert.equal(html.replace(notice, ''), GOLDEN.heroes.full.html, 'everything but the line is main\'s hero');
  assert.ok(!/adthrive|data-ad-|page-content|<aside|<article/.test(html));
});

// ---- The final-bracket card ----

test('FINAL CARD: a finished bracket inside the window gets "final bracket", linked to its page; gone after the window', () => {
  const DAY = 24 * 60 * 60 * 1000;
  // The WNBA's last 2025 final game started 2025-10-10T00:30Z, about.
  const doc = () => loadDoc(FIXTURE.wnbaFinal);
  const inside = inboundOf([doc()], new Date(Date.parse('2025-10-11T00:00:00Z') + 3 * DAY));
  const card = leagueFinalCard(inside, 'WNBA');
  assert.deepEqual(card, { league: 'WNBA', href: '/playoffs/wnba', text: '2025 WNBA Playoffs: final bracket' });
  const html = renderToStaticMarkup(<LeagueFinalBracketCard card={card!} surface="web_wnba_hub" />);
  assert.match(html, /data-playoffs-state="final"/);
  assert.match(html, /<a [^>]*href="\/playoffs\/wnba"[^>]*>2025 WNBA Playoffs: final bracket<\/a>/);
  assert.ok(!/<aside|<article|adthrive|[\u2014\u2013]/.test(html));
  // After the window the gate gives the hub nothing at all.
  const after = inboundOf([doc()], new Date(Date.parse('2025-10-11T00:00:00Z') + 30 * DAY));
  assert.deepEqual(after, []);
  assert.equal(leagueFinalCard(after, 'WNBA'), null);
});

test('FINAL CARD: none while the league is being played (it has the full card), none for a league not in the list', () => {
  const inbound = inboundOf(TODAY(), TODAY_AT);
  assert.equal(leagueFinalCard(inbound, 'MLB'), null);
  assert.equal(leagueFinalCard(inbound, 'WNBA'), null);
  assert.equal(leagueFinalCard(inbound, 'NBA'), null);
});

test('FINAL CARD: one league finished while the other plays on (the link still shows): the finished one gets its card', () => {
  const inbound = inboundOf([loadDoc(FIXTURE.mlbMixed), loadDoc(FIXTURE.wnbaFinal)], new Date('2025-10-12T00:00:00Z'));
  assert.equal(inbound.length, 2);
  assert.equal(leagueFinalCard(inbound, 'WNBA')?.text, '2025 WNBA Playoffs: final bracket');
  assert.equal(leagueFinalCard(inbound, 'MLB'), null);
  assert.ok(leagueHeroLine(inbound, 'MLB'));
});
