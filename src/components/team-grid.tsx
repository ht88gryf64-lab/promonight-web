'use client';

import { useState } from 'react';
import { TeamCard } from './team-card';
import type { Team } from '@/lib/types';
import { LEAGUE_ORDER } from '@/lib/types';
import { track } from '@/lib/analytics';

interface TeamGridProps {
  teams: Team[];
  promoCounts?: Record<string, number>;
  limit?: number;
  // When set, the "All" tab is capped at this count while league-specific
  // tabs continue to show every team in the league. Lets the homepage show
  // a curated sample on All without truncating the per-league views.
  limitOnAll?: number;
  // Forwarded to each TeamCard. Default "promos" matches all-time counts;
  // pass "upcoming" when promoCounts come from a future-only fetch.
  countLabel?: string;
  // Surface for analytics. "homepage" today; "teams_page" reserved for when
  // /teams adopts this picker. Drives both team_picker_tab_change and the
  // surface field forwarded to each TeamCard's team_tile_tap.
  surface?: 'homepage' | 'teams_page';
}

export function TeamGrid({
  teams,
  promoCounts,
  limit,
  limitOnAll,
  countLabel,
  surface = 'homepage',
}: TeamGridProps) {
  const [activeLeague, setActiveLeague] = useState<string>('All');

  const filtered = activeLeague === 'All' ? teams : teams.filter((t) => t.league === activeLeague);
  const cap = activeLeague === 'All' && limitOnAll !== undefined ? limitOnAll : limit;
  const displayed = cap ? filtered.slice(0, cap) : filtered;

  const switchTab = (toLeague: string) => {
    if (toLeague === activeLeague) return;
    track('team_picker_tab_change', {
      surface,
      from_league: activeLeague,
      to_league: toLeague,
    });
    setActiveLeague(toLeague);
  };

  // The 12-team All-tab sample is only "the homepage sample" when (a) we're on
  // the homepage and (b) the All filter is active. Other tabs show the full
  // league list, not a curated sample.
  const isHomepageSample = surface === 'homepage' && activeLeague === 'All' && limitOnAll !== undefined;

  return (
    <div>
      {/* Filter tabs */}
      <div className="flex flex-wrap gap-2 mb-8">
        <button
          onClick={() => switchTab('All')}
          className={`px-4 py-1.5 rounded-full text-[11px] font-mono tracking-[0.5px] uppercase transition-colors border ${
            activeLeague === 'All'
              ? 'bg-accent-red text-white border-accent-red'
              : 'bg-transparent text-text-secondary border-border-subtle hover:border-border-hover'
          }`}
        >
          All
        </button>
        {LEAGUE_ORDER.map((league) => (
          <button
            key={league}
            onClick={() => switchTab(league)}
            className={`px-4 py-1.5 rounded-full text-[11px] font-mono tracking-[0.5px] uppercase transition-colors border ${
              activeLeague === league
                ? 'bg-accent-red text-white border-accent-red'
                : 'bg-transparent text-text-secondary border-border-subtle hover:border-border-hover'
            }`}
          >
            {league}
          </button>
        ))}
      </div>

      {/* Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
        {displayed.map((team) => (
          <TeamCard
            key={team.id}
            team={team}
            promoCount={promoCounts?.[team.id]}
            sourcePage="home"
            countLabel={countLabel}
            tileSurface={surface}
            fromTab={activeLeague}
            isHomepageSample={isHomepageSample}
          />
        ))}
      </div>
    </div>
  );
}
