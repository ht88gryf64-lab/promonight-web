import type { ScoredPromoWithTeam, TeamScoreWithTeam } from '@/lib/types';
import { SPORT_ICONS } from '@/lib/types';
import { teamDisplayName } from '@/lib/promo-helpers';
import { TrackedTapLink } from '../analytics/TrackedTapLink';
import { ScoreBadge } from './score-badge';

type TeamRankingRowProps = {
  rank: number;
  teamScore: TeamScoreWithTeam;
  topPromo: ScoredPromoWithTeam | null;
};

// Single row in /team-rankings. Rank number + team-color accent bar +
// league/team-name stack + one-line top-promo tease + score badge. Whole
// row is the click target to the team page.
//
// When the team has no upcoming scored promos (offseason or all past),
// `topPromo` is null and the tease line is suppressed. The team itself
// still shows because the teamScore aggregate persists across the
// in-season / out-of-season boundary.
export function TeamRankingRow({ rank, teamScore, topPromo }: TeamRankingRowProps) {
  const { team } = teamScore;
  const teamName = teamDisplayName(team);
  const teamUrl = `/${team.sportSlug}/${team.id}`;

  return (
    <TrackedTapLink
      href={teamUrl}
      trackEvent="team_ranking_row_tap"
      trackProps={{
        surface: 'team_rankings',
        team_id: team.id,
        league: team.league,
        team_score: teamScore.teamScore,
        rank,
      }}
      className="group flex items-center gap-4 px-4 py-3 border-b border-border-subtle hover:bg-bg-card-hover transition-colors"
    >
      <span className="font-display text-2xl text-text-muted w-9 text-right shrink-0">
        {rank}
      </span>
      <div
        aria-hidden="true"
        className="shrink-0 w-1 h-12 rounded-full"
        style={{ backgroundColor: team.primaryColor }}
      />
      <div className="flex-1 min-w-0">
        <div className="font-mono text-[10px] tracking-[1px] uppercase text-text-muted">
          {SPORT_ICONS[team.league]} {team.league}
        </div>
        <div className="font-outfit font-extrabold text-base text-white group-hover:text-accent-red transition-colors leading-tight truncate">
          {teamName}
        </div>
        {topPromo && (
          <div className="text-text-secondary text-xs mt-0.5 truncate">
            Top: {topPromo.title}
            <span className="text-text-dim"> · score {topPromo.score}</span>
          </div>
        )}
      </div>
      <ScoreBadge score={teamScore.teamScore} size="md" />
    </TrackedTapLink>
  );
}
