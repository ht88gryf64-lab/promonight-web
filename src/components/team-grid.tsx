'use client';

import { useState } from 'react';
import { TeamCard } from './team-card';
import type { Team } from '@/lib/types';
import { LEAGUE_ORDER } from '@/lib/types';

interface TeamGridProps {
  teams: Team[];
  promoCounts?: Record<string, number>;
  limit?: number;
}

export function TeamGrid({ teams, promoCounts, limit }: TeamGridProps) {
  const [activeLeague, setActiveLeague] = useState<string>('All');

  const filtered = activeLeague === 'All' ? teams : teams.filter((t) => t.league === activeLeague);
  const displayed = limit ? filtered.slice(0, limit) : filtered;

  return (
    <div>
      {/* Filter tabs */}
      <div className="flex flex-wrap gap-2 mb-8">
        <button
          onClick={() => setActiveLeague('All')}
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
            onClick={() => setActiveLeague(league)}
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
          />
        ))}
      </div>
    </div>
  );
}
