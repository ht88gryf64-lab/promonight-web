'use client';

import Link from 'next/link';
import type { Team } from '@/lib/types';
import { SPORT_ICONS } from '@/lib/types';
import { event, track } from '@/lib/analytics';

interface TeamCardProps {
  team: Team;
  promoCount?: number;
  sourcePage?: string;
  // Lets callers label the count to match the data source they're passing.
  // Default is "promos" (all-time, used on /teams). Homepage passes
  // "upcoming" because its count comes from the future-only fetch.
  countLabel?: string;
  // Analytics surface for the new team_tile_tap event. Optional — when
  // omitted (e.g. /teams page using TeamCard directly via TeamSearch) the
  // new event does not fire and only the legacy event() emits.
  tileSurface?: 'homepage' | 'teams_page';
  fromTab?: string;
  isHomepageSample?: boolean;
}

export function TeamCard({
  team,
  promoCount,
  sourcePage = 'unknown',
  countLabel = 'promos',
  tileSurface,
  fromTab,
  isHomepageSample,
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

  return (
    <Link
      href={`/${team.sportSlug}/${team.id}`}
      onClick={handleClick}
      className="group block bg-bg-card border border-border-subtle rounded-2xl p-5 transition-all hover:-translate-y-0.5 hover:border-border-hover"
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
  );
}
