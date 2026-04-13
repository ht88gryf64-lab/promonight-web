'use client';

import { useState, useEffect } from 'react';
import { TeamCard } from './team-card';
import type { Team } from '@/lib/types';
import { LEAGUE_ORDER } from '@/lib/types';
import { event } from '@/lib/analytics';

interface TeamSearchProps {
  teams: Team[];
  promoCounts: Record<string, number>;
  initialLeague?: string;
}

export function TeamSearch({ teams, promoCounts, initialLeague }: TeamSearchProps) {
  const [query, setQuery] = useState('');
  const [activeLeague, setActiveLeague] = useState<string>(initialLeague || 'All');

  const filtered = teams.filter((t) => {
    const matchesLeague = activeLeague === 'All' || t.league === activeLeague;
    const matchesQuery =
      !query ||
      `${t.city} ${t.name}`.toLowerCase().includes(query.toLowerCase()) ||
      t.abbreviation.toLowerCase().includes(query.toLowerCase());
    return matchesLeague && matchesQuery;
  });

  // Debounced search tracking
  useEffect(() => {
    if (!query) return;
    const timer = setTimeout(() => {
      event('team_search', { query, result_count: filtered.length });
    }, 500);
    return () => clearTimeout(timer);
  }, [query, filtered.length]);

  return (
    <div>
      {/* Search */}
      <div className="relative mb-6">
        <svg
          className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-text-dim"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          strokeWidth={2}
        >
          <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
        </svg>
        <input
          type="text"
          placeholder="Search teams..."
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          className="w-full bg-bg-card border border-border-subtle rounded-xl pl-11 pr-4 py-3 text-sm text-white placeholder:text-text-dim focus:outline-none focus:border-border-hover transition-colors"
        />
      </div>

      {/* League filters */}
      <div className="flex flex-wrap gap-2 mb-8">
        <button
          onClick={() => setActiveLeague('All')}
          className={`px-4 py-1.5 rounded-full text-[11px] font-mono tracking-[0.5px] uppercase transition-colors border ${
            activeLeague === 'All'
              ? 'bg-accent-red text-white border-accent-red'
              : 'bg-transparent text-text-secondary border-border-subtle hover:border-border-hover'
          }`}
        >
          All ({teams.length})
        </button>
        {LEAGUE_ORDER.map((league) => {
          const count = teams.filter((t) => t.league === league).length;
          return (
            <button
              key={league}
              onClick={() => setActiveLeague(league)}
              className={`px-4 py-1.5 rounded-full text-[11px] font-mono tracking-[0.5px] uppercase transition-colors border ${
                activeLeague === league
                  ? 'bg-accent-red text-white border-accent-red'
                  : 'bg-transparent text-text-secondary border-border-subtle hover:border-border-hover'
              }`}
            >
              {league} ({count})
            </button>
          );
        })}
      </div>

      {/* Results count */}
      <p className="text-text-dim text-xs font-mono mb-4">
        {filtered.length} team{filtered.length !== 1 ? 's' : ''}
      </p>

      {/* Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
        {filtered.map((team) => (
          <TeamCard
            key={team.id}
            team={team}
            promoCount={promoCounts[team.id]}
            sourcePage="teams"
          />
        ))}
      </div>

      {filtered.length === 0 && (
        <div className="text-center py-16">
          <p className="text-text-muted text-lg">No teams found</p>
          <p className="text-text-dim text-sm mt-1">Try a different search or filter</p>
        </div>
      )}
    </div>
  );
}
