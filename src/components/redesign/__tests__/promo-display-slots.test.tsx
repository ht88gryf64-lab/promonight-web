// The three card components read the display slots, and the schedule and
// World Cup rows label a doubleheader pair.
import { test } from 'node:test';
import assert from 'node:assert';
import { renderToStaticMarkup } from 'react-dom/server';
import { RedesignPromoRow } from '../RedesignPromoRow';
import { TicketStubCard } from '../TicketStubCard';
import { ScoredPromoCard } from '@/components/scoring/scored-promo-card';
import { ScheduleBlock } from '../ScheduleBlock';
import { WorldCupGameRows } from '@/components/world-cup/game-rows';
import type { PromoWithTeam, ScoredPromoWithTeam, Team } from '@/lib/types';
import { BRAVES, METS, mlbCtx, mlbGame } from './fixtures/schedule-fixtures';
import { StarredTeamsProvider } from '@/hooks/use-starred-teams';

const WILD = { id: 'minnesota-wild', name: 'Wild', city: 'Minnesota', league: 'NHL', sportSlug: 'nhl', abbreviation: 'MIN', primaryColor: '#154734', secondaryColor: '#A6192E', division: 'Central' } as unknown as Team;
const base: PromoWithTeam = { team: WILD, date: '2026-10-30', time: '', opponent: '', type: 'giveaway', title: 'Blaze Orange Hat', description: '', highlight: false, icon: '', recurring: false };
const joined: PromoWithTeam = { ...base, displayTime: '7:00 PM', displayOpponent: 'Penguins' };
const share = { teamName: 'Minnesota Wild', teamSlug: WILD.id, sport: 'nhl' };

test('RedesignPromoRow shows the joined time and opponent, and nothing when both are empty', () => {
  const html = renderToStaticMarkup(<RedesignPromoRow promo={joined} share={share} />);
  assert.ok(html.includes('>7:00 PM<'), 'joined time');
  assert.ok(html.includes('vs <!-- -->Penguins') || html.includes('vs Penguins'), 'joined opponent');
  const bare = renderToStaticMarkup(<RedesignPromoRow promo={base} share={share} />);
  assert.ok(!bare.includes('7:00 PM') && !bare.includes('Penguins'));
});

test('a fixture without display slots renders its stored values (fallback)', () => {
  const stored: PromoWithTeam = { ...base, time: '6:30 PM', opponent: 'Pens' };
  const html = renderToStaticMarkup(<RedesignPromoRow promo={stored} share={share} />);
  assert.ok(html.includes('6:30 PM') && html.includes('Pens'));
});

test('TicketStubCard and ScoredPromoCard show the joined slots; the scored card now renders a time', () => {
  const stub = renderToStaticMarkup(
    <StarredTeamsProvider>
      <TicketStubCard promo={joined} contexts={null} surface="web_home_tonight" starPlacement="homepage_this_week_inline" />
    </StarredTeamsProvider>,
  );
  assert.ok(stub.includes('7:00 PM') && stub.includes('Penguins'));
  const scored: ScoredPromoWithTeam = { ...joined, promoId: 'x', score: 10, scoreBreakdown: { baseType: 10 } as any, derivedSignals: { itemType: 'generic' } as any, scoredAt: '' };
  for (const redesign of [true, false]) {
    const html = renderToStaticMarkup(<ScoredPromoCard promo={scored} rank={1} surface="web_best_promos" redesign={redesign} />);
    assert.ok(html.includes('7:00 PM'), `time rendered (redesign=${redesign})`);
    assert.ok(html.includes('Penguins'), `opponent rendered (redesign=${redesign})`);
  }
});

test('ScheduleBlock labels an MLB doubleheader pair Game 1 / Game 2 and nothing else', () => {
  const single = mlbCtx(mlbGame('2026-07-18', true, METS, { mlbGameId: 1 }), METS);
  const g1 = mlbCtx(mlbGame('2026-07-19', true, METS, { mlbGameId: 2 }), METS);
  const g2 = mlbCtx(mlbGame('2026-07-19', true, METS, { mlbGameId: 3, doubleheaderGame: 2 }), METS);
  const html = renderToStaticMarkup(<ScheduleBlock contexts={[single, g1, g2]} team={BRAVES} teamName="Atlanta Braves" today="2026-07-01" />);
  assert.equal((html.match(/>Game 1</g) ?? []).length, 1);
  assert.equal((html.match(/>Game 2</g) ?? []).length, 1);
  const none = renderToStaticMarkup(<ScheduleBlock contexts={[single, g1]} team={BRAVES} teamName="Atlanta Braves" today="2026-07-01" />);
  assert.ok(!/Game [12]</.test(none));
});

test('WorldCupGameRows labels a doubleheader pair', () => {
  const g1 = mlbCtx(mlbGame('2026-07-19', true, METS, { mlbGameId: 2 }), METS);
  const g2 = mlbCtx(mlbGame('2026-07-19', true, METS, { mlbGameId: 3, doubleheaderGame: 2 }), METS);
  const html = renderToStaticMarkup(<WorldCupGameRows games={[g1, g2]} team={BRAVES} />);
  assert.ok(html.includes('>Game 1<') && html.includes('>Game 2<'));
  assert.ok(html.includes('vs Mets, Game 2'), 'aria-label carries the label');
});
