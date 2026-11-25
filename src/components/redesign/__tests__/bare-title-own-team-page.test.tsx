/* A CLUB'S OWN TEAM PAGE PRINTS THE STORED TITLE EVERYWHERE (ruling
 * 2026-11-25, src/lib/promo-display-title.ts, the ownTeamPage flag). A bare
 * item title ("Bobblehead Night", "Rally Towel") gets no club prefix in the
 * rows, the prose block, the FAQ or the share labels, so the page uses one
 * name. The same row on a cross-team card is prefixed. */
import { test, mock } from 'node:test';
import assert from 'node:assert/strict';
import type { Promo, Team } from '@/lib/types';

mock.timers.enable({ apis: ['Date'], now: new Date('2026-11-25T17:00:00Z') });
const emptyQuery: any = {
  where: () => emptyQuery, orderBy: () => emptyQuery, limit: () => emptyQuery, select: () => emptyQuery,
  doc: () => ({ get: async () => ({ exists: false, data: () => undefined }), collection: () => emptyQuery }),
  get: async () => ({ docs: [], empty: true, size: 0, forEach: () => {} }),
  count: () => ({ get: async () => ({ data: () => ({ count: 0 }) }) }),
};
mock.module('server-only', { namedExports: {} });
mock.module(new URL('../../../lib/firebase.ts', import.meta.url).href, {
  namedExports: { db: { collection: () => emptyQuery, collectionGroup: () => emptyQuery } },
});
mock.module(new URL('../fonts.ts', import.meta.url).href, { namedExports: { archivo: { variable: 'font-archivo' } } });

const TODAY = '2026-11-25';
const mk = (id: string, league: string, city: string, name: string): Team =>
  ({ id, league, city, name, abbreviation: name.slice(0, 3).toUpperCase(), primaryColor: '#123456', secondaryColor: '#654321', sportSlug: league.toLowerCase(), division: 'Test' }) as Team;
const CANADIENS = mk('montreal-canadiens', 'NHL', 'Montreal', 'Canadiens');
const KINGS = mk('los-angeles-kings', 'NHL', 'Los Angeles', 'Kings');
const promo = (date: string, title: string, over: Partial<Promo> = {}): Promo => ({
  date, time: '7:00 PM', opponent: 'Visitors', type: 'giveaway', title, description: 'Bobblehead giveaway. Presented by RONA.', highlight: true, icon: '', recurring: false, ...over,
});

async function html(el: React.ReactElement): Promise<string> {
  const { prerenderToNodeStream } = await import('react-dom/static');
  const { prelude } = await prerenderToNodeStream(el);
  let out = '';
  for await (const c of prelude) out += c;
  return out;
}
const text = (h: string) => h.replace(/<!-- -->/g, '').replace(/<script[\s\S]*?<\/script>/g, ' ').replace(/<[^>]+>/g, ' ').replace(/&#x27;/g, "'").replace(/&amp;/g, '&').replace(/\s+/g, ' ');

async function teamPage(team: Team, promos: Promo[]) {
  const { splitPromosByDate, countPromosByType, teamDisplayName } = await import('@/lib/promo-helpers');
  const { resolveClaimMode } = await import('@/lib/season-scope');
  const { RedesignTeamPage } = await import('../RedesignTeamPage');
  const { StarredTeamsProvider } = await import('@/hooks/use-starred-teams');
  const { upcoming } = splitPromosByDate(promos, TODAY);
  const h = await html(
    <StarredTeamsProvider><RedesignTeamPage team={team} coverage={{ teamCount: 169, leagueList: 'x', appLeagueList: 'y' } as never} venue={null} promos={promos}
      upcomingPromos={upcoming} upcomingCounts={countPromosByType(upcoming)} claim={resolveClaimMode(promos, team.league, TODAY)}
      displayName={teamDisplayName(team)} gameContexts={undefined} today={TODAY} recurringDeals={[]} playoffsActive={false}
      inPlayoffs={false} playoffPromos={[]} playoffRound="" playoffLastUpdated={null} /></StarredTeamsProvider>,
  );
  return { h, t: text(h) };
}

test('Canadiens team page: "Bobblehead Night" in every place, never "Canadiens Bobblehead Night"', async () => {
  const rows = ['2026-12-10', '2027-01-21', '2027-03-16', '2027-03-24'].map((d) => promo(d, 'Bobblehead Night'));
  const named = promo('2026-12-20', 'Cole Caufield Bobblehead');
  const { h, t } = await teamPage(CANADIENS, [...rows, named, promo('2026-11-01', 'Bobblehead Night')]);
  assert.ok((t.match(/Bobblehead Night/g) ?? []).length >= 4, 'the four upcoming rows are there');
  assert.doesNotMatch(t, /Canadiens Bobblehead Night/, 'no prefix anywhere on the club\'s own page');
  assert.doesNotMatch(h, /Canadiens Bobblehead Night/, 'not in a label, an attribute or the payload either');
  assert.match(t, /Cole Caufield Bobblehead/);
  assert.doesNotMatch(t, /Canadiens Cole Caufield/);
});

test('Kings team page: "Rally Towel" and "Mini Tote Bag" as stored', async () => {
  const { h, t } = await teamPage(KINGS, [promo('2027-01-02', 'Rally Towel', { description: 'Pride rally towel giveaway.' }), promo('2027-01-19', 'Mini Tote Bag', { description: 'Mini tote bag giveaway.' }), promo('2026-12-12', 'Anze Kopitar Bobblehead')]);
  assert.match(t, /Rally Towel/);
  assert.match(t, /Mini Tote Bag/);
  assert.doesNotMatch(h, /Kings Rally Towel|Kings Mini Tote Bag/);
});

test('the same rows on a cross-team surface are prefixed: the daily-board row and the rankings card', async () => {
  const { renderToStaticMarkup } = await import('react-dom/server');
  const { RedesignPromoRow } = await import('../RedesignPromoRow');
  const share = { teamName: 'Montreal Canadiens', teamSlug: CANADIENS.id, sport: 'nhl' } as never;
  // The daily board hands the row a promo that carries its own team.
  const board = renderToStaticMarkup(<RedesignPromoRow promo={{ ...promo('2026-12-10', 'Bobblehead Night'), team: CANADIENS } as never} share={share} href="/nhl/montreal-canadiens/promos/bobblehead-night" />);
  assert.match(board, />Canadiens Bobblehead Night</);
  // The team page hands it a plain promo and the page's team.
  const own = renderToStaticMarkup(<RedesignPromoRow promo={promo('2026-12-10', 'Bobblehead Night')} share={share} team={CANADIENS} />);
  assert.match(own, />Bobblehead Night</);
  assert.doesNotMatch(own, /Canadiens Bobblehead Night/);
});
