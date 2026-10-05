/* MLB AND NFL ARE BYTE-IDENTICAL TO MAIN (WEB6, 2026-10-05).
 *
 * Renders every component WEB6 touched (PromoList light and dark, the content
 * sections, the FAQ in all three claim modes, AuthorityStats, the zero-promo
 * fallback, the MLB month list and the NFL week grid) over five promo shapes,
 * and compares a sha256 of the static HTML AND of the returned element tree to
 * hashes recorded from origin/main 329c7da. The tree is what catches a change
 * the HTML cannot see: 2026 and "2026" render the same text but serialize
 * differently in the RSC payload.
 *
 * ONE SHAPE DIFFERS BY RULING and is pinned separately: an archive of an
 * earlier calendar year (2025 rows only) no longer says "this season" in any
 * league. No MLB or NFL page on production has that shape (2026-10-05 survey:
 * every MLB and NFL archive is 2026).
 *
 * MLS and WNBA are rendered too and held to the same hashes.
 *
 * Re-record ONLY from main, never from a branch:
 *   GOLDEN_RECORD=<file> node --import tsx --experimental-test-module-mocks --test <this file>
 */
import { test, mock } from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFileSync, writeFileSync } from 'node:fs';
import { renderToStaticMarkup } from 'react-dom/server';
import { PromoList } from '@/components/promo-list';
import { ZeroPromoFallback } from '@/components/zero-promo-fallback';
import { TeamContentSections } from '@/components/team-content-sections';
import { TeamFAQ } from '@/components/team-faq';
import { AuthorityStats } from '@/components/authority-stats';
import { ScheduleBlock } from '@/components/redesign/ScheduleBlock';
import { resolveClaimMode } from '@/lib/season-scope';
import { generateTeamFAQs, splitPromosByDate, countPromosByType } from '@/lib/promo-helpers';
import { BRAVES, NFL_CONTEXTS, LIONS, mlbCtx, mlbGame } from './fixtures/schedule-fixtures';

mock.timers.enable({ apis: ['Date'], now: new Date('2026-10-05T12:00:00Z') });

const TODAY = '2026-10-05';
const mk = (id: string, league: string, city: string, name: string) => ({ id, league, city, name, abbreviation: name.slice(0, 3).toUpperCase(), primaryColor: '#123456', secondaryColor: '#654321', sportSlug: league.toLowerCase(), division: 'Test' }) as any;
const TEAMS = { MLB: mk('atlanta-braves', 'MLB', 'Atlanta', 'Braves'), NFL: mk('detroit-lions', 'NFL', 'Detroit', 'Lions'), MLS: mk('houston-dynamo', 'MLS', 'Houston', 'Dynamo'), WNBA: mk('seattle-storm', 'WNBA', 'Seattle', 'Storm') };
const P = (date: string, title: string, type = 'theme', over: any = {}) => ({ date, time: '7:05 PM', opponent: 'Visitors', type, title, description: `${title} desc`, highlight: false, icon: '', recurring: false, ...over });
const many = (n: number, start: string, step: number, prefix: string) => Array.from({ length: n }, (_, i) => { const d = new Date(Date.parse(start + 'T12:00:00Z') + i * step * 86400000).toISOString().slice(0, 10); return P(d, `${prefix} ${i}`, ['giveaway', 'theme', 'food', 'kids'][i % 4], i % 5 === 0 ? { title: `${prefix} ${i} Bobblehead` } : {}); });
const SHAPES: Record<string, any[]> = {
  seasonComplete2026: many(22, '2026-04-01', 7, 'Done'),
  upcomingPlusPast2026: [...many(10, '2026-08-01', 5, 'Past'), ...many(9, '2026-10-10', 9, 'Ahead')],
  empty: [],
  past2025only: many(6, '2025-05-01', 20, 'Old'),
  crossing: [...many(6, '2025-10-01', 15, 'Old'), ...many(18, '2026-03-01', 12, 'Now')],
  // Upcoming rows on a population that does not resolve to one calendar year
  // (an NFL club whose slate runs into January): the "remaining" claim with
  // live sections, so the headings print the year as a JSX child.
  remainingWithUpcoming: [...many(4, '2025-11-01', 10, 'Old'), ...many(16, '2026-10-10', 7, 'Live')],
};
const venue = { id: 'v', name: 'Test Park', address: '1 Main St, Atlanta, GA 30315', team: 'x' } as any;
const coverage = { teamCount: 169, leagueList: 'MLB, NBA, NFL, NHL, MLS, and WNBA', appLeagueList: 'MLB, NBA, NHL, and MLS' } as any;

function ser(x: any): any {
  return JSON.stringify(x, (k, v) => (typeof v === 'function' ? `fn:${v.displayName || v.name}` : typeof v === 'symbol' ? String(v) : k === '_owner' || k === '_store' || k === '_debugInfo' || k === '_debugStack' || k === '_debugTask' ? undefined : v));
}
const out: Record<string, { html: string; tree: string }> = {};
const add = (key: string, el: any, fn?: () => any) => { out[key] = { html: renderToStaticMarkup(el), tree: fn ? ser(fn()) : '' }; };

for (const [lg, team] of Object.entries(TEAMS)) {
  for (const [shape, promos] of Object.entries(SHAPES)) {
    const claim = resolveClaimMode(promos as any, team.league, TODAY);
    const { upcoming } = splitPromosByDate(promos as any) as { upcoming: any[] };
    const counts = countPromosByType(upcoming);
    const seasonScoped = claim.kind === 'season';
    for (const variant of ['light', 'dark'] as const) {
      const props = { promos, teamSlug: team.id, teamName: `${team.city} ${team.name}`, league: team.league, sport: team.sportSlug, variant, showAppPitch: false, seasonScoped, scopeLive: true, team } as any;
      add(`${lg}/${shape}/PromoList/${variant}`, <PromoList {...props} />, () => (PromoList as any)(props));
      const tprops = { team, promos: upcoming, venue, promoCounts: counts, claim, variant } as any;
      add(`${lg}/${shape}/TeamContentSections/${variant}`, <TeamContentSections {...tprops} />, () => (TeamContentSections as any)(tprops));
      const fprops = { team, upcomingPromos: upcoming, venue, upcomingCounts: counts, coverage, claim, variant } as any;
      add(`${lg}/${shape}/TeamFAQ/${variant}`, <TeamFAQ {...fprops} />, () => (TeamFAQ as any)(fprops));
      const aprops = { team, promos: upcoming, promoCounts: counts, claim, venue, teamName: `${team.city} ${team.name}`, variant } as any;
      add(`${lg}/${shape}/AuthorityStats/${variant}`, <AuthorityStats {...aprops} />, () => (AuthorityStats as any)(aprops));
      out[`${lg}/${shape}/faqs/${variant}`] = { html: JSON.stringify(generateTeamFAQs(team, upcoming, venue, counts, coverage, undefined, claim)), tree: '' };
    }
    {
      const fprops = { team, upcomingPromos: upcoming, venue, upcomingCounts: counts, coverage, claim: { kind: 'held' }, variant: 'light' } as any;
      add(`${lg}/${shape}/TeamFAQ/held`, <TeamFAQ {...fprops} />, () => (TeamFAQ as any)(fprops));
    }
  }
  for (const variant of ['light', 'dark'] as const) {
    const zprops = { team, venue, teamName: `${team.city} ${team.name}`, variant } as any;
    add(`${lg}/ZeroPromoFallback/${variant}`, <ZeroPromoFallback {...zprops} />, () => (ZeroPromoFallback as any)(zprops));
  }
}
// Schedules: MLB date list (a few months) and the NFL week grid.
const METS = mk('new-york-mets', 'MLB', 'New York', 'Mets');
const mlbCtxs = Array.from({ length: 40 }, (_, i) => { const d = new Date(Date.parse('2026-03-26T12:00:00Z') + i * 5 * 86400000).toISOString().slice(0, 10); return mlbCtx(mlbGame(d, i % 2 === 0, METS, { status: d < TODAY ? 'completed' : 'scheduled', mlbGameId: 900000 + i }), METS); });
for (const today of [TODAY, '2026-06-01']) {
  const sp = { contexts: mlbCtxs, team: BRAVES, teamName: 'Atlanta Braves', today } as any;
  add(`MLB/ScheduleBlock/${today}`, <ScheduleBlock {...sp} />, () => (ScheduleBlock as any)(sp));
}
const np = { contexts: NFL_CONTEXTS, team: LIONS, teamName: 'Detroit Lions', today: TODAY } as any;
add('NFL/ScheduleBlock', <ScheduleBlock {...np} />, () => (ScheduleBlock as any)(np));

const h = (s: string) => createHash('sha256').update(s).digest('hex').slice(0, 16);
const hashes: Record<string, string> = Object.fromEntries(Object.entries(out).map(([k, v]) => [k, h(v.html) + ':' + h(v.tree)]));
const FIXTURE = new URL('./fixtures/mlb-nfl-golden-hashes.json', import.meta.url);

if (process.env.GOLDEN_RECORD) {
  writeFileSync(process.env.GOLDEN_RECORD, JSON.stringify(hashes, null, 1) + '\n');
} else {
  const golden: Record<string, string> = JSON.parse(readFileSync(FIXTURE, 'utf-8'));
  // Both shapes whose archive holds only 2025 rows.
  const RULED = (k: string) => /\/(past2025only|remainingWithUpcoming)\/PromoList\//.test(k);

  test('every case recorded from main is rendered here', () => {
    assert.deepEqual(Object.keys(hashes).sort(), Object.keys(golden).sort());
  });

  test('MLB, NFL, MLS and WNBA: HTML and element tree identical to main on every shape production serves', () => {
    const moved = Object.keys(golden).filter((k) => !RULED(k) && golden[k] !== hashes[k]);
    assert.deepEqual(moved, []);
  });

  test('the ruled shape: an earlier-year archive moved, and only its "this season" line', () => {
    for (const k of Object.keys(golden).filter(RULED)) {
      assert.notEqual(golden[k], hashes[k], k);
      assert.doesNotMatch(out[k].html, /this season/, k);
      assert.match(out[k].html, /\d+ completed events, [A-Z][a-z]+ 2025 to [A-Z][a-z]+ 2025/, k);
    }
  });
}
