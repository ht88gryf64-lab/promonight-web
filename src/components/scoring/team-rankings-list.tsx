'use client';

import { useSearchParams } from 'next/navigation';
import { useCallback, useMemo } from 'react';
import type { ScoredPromoWithTeam, TeamScoreWithTeam } from '@/lib/types';
import { track } from '@/lib/analytics';
import { TeamRankingRow } from './team-ranking-row';
import { LeagueFilter, type LeagueFilterValue } from './league-filter';

type TeamRankingsListProps = {
  teamScores: TeamScoreWithTeam[];
  // Map keyed by team.id. When a team has no upcoming scored promo (offseason
  // or all past), the entry is absent; TeamRankingRow renders without the
  // tease line in that case.
  topPromos: Record<string, ScoredPromoWithTeam>;
};

export function TeamRankingsList({
  teamScores,
  topPromos,
}: TeamRankingsListProps) {
  const searchParams = useSearchParams();
  const league = (searchParams.get('league') || 'All') as LeagueFilterValue;

  const filtered = useMemo(() => {
    if (league === 'All') return teamScores;
    return teamScores.filter((t) => t.league === league);
  }, [teamScores, league]);

  const handleLeagueChange = useCallback(
    (from: LeagueFilterValue, to: LeagueFilterValue) => {
      track('score_filter_changed', {
        surface: 'team_rankings',
        filter_type: 'league',
        from,
        to,
      });
    },
    [],
  );

  return (
    <div>
      <div className="mb-8">
        <div className="font-mono text-[10px] tracking-[1.5px] uppercase text-text-muted mb-2">
          Filter by league
        </div>
        <LeagueFilter onChange={handleLeagueChange} />
      </div>

      <p className="font-mono text-[11px] text-text-dim mb-4">
        {filtered.length} team{filtered.length === 1 ? '' : 's'} ranked
        {league !== 'All' ? ` in ${league}` : ''}
      </p>

      <div className="bg-bg-card border border-border-subtle rounded-2xl overflow-hidden">
        {filtered.map((teamScore, i) => (
          <TeamRankingRow
            key={teamScore.teamId}
            rank={i + 1}
            teamScore={teamScore}
            topPromo={topPromos[teamScore.teamId] ?? null}
          />
        ))}
      </div>

      {filtered.length === 0 && (
        <div className="bg-bg-card border border-border-subtle rounded-2xl p-10 text-center">
          <p className="text-text-secondary">
            No teams scored in this league yet.
          </p>
        </div>
      )}
    </div>
  );
}
