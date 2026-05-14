'use client';

import Link from 'next/link';
import type { Team } from '@/lib/types';
import { SPORT_ICONS } from '@/lib/types';
import { event, track } from '@/lib/analytics';
import { StarToggle } from './star-toggle';
import type { StarPlacement } from '@/hooks/use-starred-teams';

interface TeamCardProps {
  team: Team;
  promoCount?: number;
  sourcePage?: string;
  // Lets callers label the count to match the data source they're passing.
  // Default is "promos" (all-time, used on /teams). Homepage passes
  // "upcoming" because its count comes from the future-only fetch.
  countLabel?: string;
  // Analytics surface for the new team_tile_tap event. Optional — when
  // omitted, the new event does not fire and only the legacy event() emits.
  tileSurface?: 'homepage' | 'teams_page';
  fromTab?: string;
  isHomepageSample?: boolean;
  // Tier 1 StarToggle placement. Default matches the only current call
  // site (homepage Find Your Team grid) so /teams' new TeamsBrowser card
  // and any future caller can override without disturbing the homepage.
  starPlacement?: StarPlacement;
}

export function TeamCard({
  team,
  promoCount,
  sourcePage = 'unknown',
  countLabel = 'promos',
  tileSurface,
  fromTab,
  isHomepageSample,
  starPlacement = 'homepage_find_your_team',
}: TeamCardProps) {
  const handleClick = () => {
    // TRANSITIONAL: legacy GA4-only team_card_click fires alongside the new
    // dual-emit team_tile_tap. Drop legacy in follow-up PR after ~2 weeks
    // once dashboards confirmed migrated.
    event('team_card_click', { team_slug: team.id, sport: team.league, source_page: sourcePage });
    if (tileSurface) {
      track('team_tile_tap', {
        surface: tileSurface,
        team_id: team.id,
        league: team.league,
        from_tab: fromTab ?? 'unknown',
        is_homepage_sample: !!isHomepageSample,
      });
    }
  };

  // Restructured from `<Link>` to `<article>` + inner `<Link>` + sibling
  // `<StarToggle>` so the star button isn't nested inside an anchor.
  // Mirrors the pattern used by `<TeamBrowserCard>` on /teams.
  return (
    <article className="group relative bg-bg-card border border-border-subtle rounded-2xl transition-all hover:-translate-y-0.5 hover:border-border-hover">
      <Link
        href={`/${team.sportSlug}/${team.id}`}
        onClick={handleClick}
        className="block p-5 pr-12"
      >
        <div className="flex items-start justify-between mb-3">
          <span
            className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[10px] font-mono tracking-[1px] uppercase"
            style={{
              color: team.primaryColor,
              backgroundColor: `${team.primaryColor}15`,
              border: `1px solid ${team.primaryColor}30`,
            }}
          >
            {SPORT_ICONS[team.league]} {team.league}
          </span>
          {promoCount !== undefined && (
            <span className="text-text-dim text-[11px] font-mono">
              {promoCount} {countLabel}
            </span>
          )}
        </div>
        <div className="text-white font-body">
          <div className="text-text-secondary text-xs">{team.city}</div>
          <div className="text-lg font-bold group-hover:text-white transition-colors">
            {team.name}
          </div>
        </div>
        <div
          className="mt-3 h-0.5 rounded-full opacity-40 group-hover:opacity-70 transition-opacity"
          style={{ backgroundColor: team.primaryColor }}
        />
      </Link>
      <div className="absolute top-3 right-3 z-10">
        <StarToggle
          teamSlug={team.id}
          teamName={`${team.city} ${team.name}`}
          league={team.league}
          sport={team.sportSlug}
          placement={starPlacement}
          surface="dark"
        />
      </div>
    </article>
  );
}
