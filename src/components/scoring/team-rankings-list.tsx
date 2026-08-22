'use client';

import { usePathname, useSearchParams } from 'next/navigation';
import { Suspense, useCallback, useEffect, useMemo, useState } from 'react';
import type { ScoredPromoWithTeam, TeamScoreWithTeam } from '@/lib/types';
import { track } from '@/lib/analytics';
import { TeamRankingRow } from './team-ranking-row';
import {
  LeagueFilter,
  LEAGUE_FILTER_VALUES,
  type LeagueFilterValue,
} from './league-filter';

type TeamRankingsListProps = {
  teamScores: TeamScoreWithTeam[];
  // Map keyed by team.id. When a team has no upcoming scored promo (offseason
  // or all past), the entry is absent; TeamRankingRow renders without the
  // tease line in that case.
  topPromos: Record<string, ScoredPromoWithTeam>;
  variant?: 'dark' | 'light';
};

// The ?league= subscription, quarantined in a null-rendering child so the
// useSearchParams static-generation bailout stops at ITS Suspense boundary
// instead of swallowing the table.
//
// This component previously called useSearchParams at its top level while the
// page wrapped the WHOLE list in one Suspense boundary, so the bailout took
// the entire ranking with it: served HTML carried zero of the 75 rows, on a
// page whose only purpose is that ranking. The sibling best-promos browser
// already solved this the same way, and served 50 rows while this page served
// none.
//
// Reading window.location once on mount is not enough: back/forward and
// same-route client navigations never remount this tree, and the chips would
// desync from the URL.
function LeagueParamReader({ onParam }: { onParam: (league: string | null) => void }) {
  const searchParams = useSearchParams();
  const league = searchParams.get('league');
  useEffect(() => {
    onParam(league);
  }, [league, onParam]);
  return null;
}

export function TeamRankingsList({
  teamScores,
  topPromos,
  variant = 'dark',
}: TeamRankingsListProps) {
  const light = variant === 'light';
  const pathname = usePathname();

  // Defaults to 'All' so the server renders every row. The reader above
  // corrects it after hydration when the URL carries a league.
  const [league, setLeague] = useState<LeagueFilterValue>('All');

  const handleParam = useCallback((raw: string | null) => {
    const next = (raw ?? 'All') as LeagueFilterValue;
    setLeague(LEAGUE_FILTER_VALUES.includes(next) ? next : 'All');
  }, []);

  const filtered = useMemo(() => {
    if (league === 'All') return teamScores;
    return teamScores.filter((t) => t.league === league);
  }, [teamScores, league]);

  // Chip taps own the URL here, because the chips render in controlled mode
  // with no URL hooks. Same contract the URL-synced pages get from
  // FilterChips: the default value is removed for a clean URL, unrelated
  // params are preserved, and replaceState keeps the back stack clean. Next
  // syncs replaceState into useSearchParams, which echoes back through the
  // reader as a no-op state set.
  const handleLeagueSelect = useCallback(
    (next: LeagueFilterValue) => {
      if (next === league) return;
      track('score_filter_changed', {
        surface: 'team_rankings',
        filter_type: 'league',
        from: league,
        to: next,
      });
      setLeague(next);
      const params = new URLSearchParams(window.location.search);
      if (next === 'All') params.delete('league');
      else params.set('league', next);
      const qs = params.toString();
      window.history.replaceState(null, '', qs ? `${pathname}?${qs}` : pathname);
    },
    [league, pathname],
  );

  return (
    <div>
      <Suspense fallback={null}>
        <LeagueParamReader onParam={handleParam} />
      </Suspense>

      <div className="mb-8">
        <div className={light ? 'font-rd text-[10px] tracking-[0.1em] uppercase text-rd-ink-faint mb-2' : 'font-mono text-[10px] tracking-[1.5px] uppercase text-text-muted mb-2'}>
          Filter by league
        </div>
        <LeagueFilter value={league} onSelect={handleLeagueSelect} variant={variant} />
      </div>

      <p className={light ? 'font-rd text-[11px] text-rd-ink-faint mb-4' : 'font-mono text-[11px] text-text-dim mb-4'}>
        {filtered.length} team{filtered.length === 1 ? '' : 's'} ranked
        {league !== 'All' ? ` in ${league}` : ''}
      </p>

      <div className={light ? 'bg-rd-card border border-rd-line rounded-2xl overflow-hidden' : 'bg-bg-card border border-border-subtle rounded-2xl overflow-hidden'}>
        {filtered.map((teamScore, i) => (
          <TeamRankingRow
            key={teamScore.teamId}
            rank={i + 1}
            teamScore={teamScore}
            topPromo={topPromos[teamScore.teamId] ?? null}
            variant={variant}
          />
        ))}
      </div>

      {filtered.length === 0 && (
        <div className={light ? 'bg-rd-card border border-rd-line rounded-2xl p-10 text-center' : 'bg-bg-card border border-border-subtle rounded-2xl p-10 text-center'}>
          <p className={light ? 'text-rd-ink-soft' : 'text-text-secondary'}>
            No teams scored in this league yet.
          </p>
        </div>
      )}
    </div>
  );
}
