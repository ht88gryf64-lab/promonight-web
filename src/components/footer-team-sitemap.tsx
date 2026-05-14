'use client';

import Link from 'next/link';
import { useState } from 'react';
import type { Team } from '@/lib/types';
import { LEAGUE_ORDER } from '@/lib/types';
import { StarToggleInline } from './star-toggle';

export function FooterTeamSitemap({ teams }: { teams: Team[] }) {
  const [open, setOpen] = useState(false);
  const [activeLeague, setActiveLeague] =
    useState<(typeof LEAGUE_ORDER)[number]>('MLB');

  const byLeague = new Map<string, Team[]>();
  for (const t of teams) {
    const list = byLeague.get(t.league) ?? [];
    list.push(t);
    byLeague.set(t.league, list);
  }
  for (const list of byLeague.values()) {
    list.sort((a, b) => a.city.localeCompare(b.city));
  }

  const activeList = byLeague.get(activeLeague) ?? [];

  return (
    <div className="border-t border-border-subtle pt-8 mt-8">
      <button
        onClick={() => setOpen((v) => !v)}
        className="w-full flex items-center justify-between text-left"
        aria-expanded={open}
      >
        <h4 className="font-mono text-[10px] tracking-[1.5px] uppercase text-accent-red">
          All 167 teams
        </h4>
        <span className="text-text-muted text-xs font-mono">
          {open ? 'Hide' : 'Expand'}
          <svg
            className={`inline-block w-3 h-3 ml-1 transition-transform ${open ? 'rotate-180' : ''}`}
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth={2}
          >
            <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
          </svg>
        </span>
      </button>

      {open && (
        <div className="mt-5">
          <div className="flex flex-wrap gap-2 mb-5">
            {LEAGUE_ORDER.map((league) => (
              <button
                key={league}
                onClick={() => setActiveLeague(league)}
                className={`px-3 py-1 rounded-full text-[10px] font-mono tracking-[0.5px] uppercase border transition-colors ${
                  activeLeague === league
                    ? 'bg-accent-red text-white border-accent-red'
                    : 'bg-transparent text-text-secondary border-border-subtle hover:border-border-hover'
                }`}
              >
                {league} ({byLeague.get(league)?.length ?? 0})
              </button>
            ))}
          </div>
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-x-4 gap-y-1.5">
            {activeList.map((t) => (
              <div key={t.id} className="flex items-center gap-1.5 min-w-0">
                <StarToggleInline
                  teamSlug={t.id}
                  teamName={`${t.city} ${t.name}`}
                  league={t.league}
                  sport={t.sportSlug}
                  placement="footer_team_list"
                  size={12}
                />
                <Link
                  href={`/${t.sportSlug}/${t.id}`}
                  className="text-text-secondary text-sm hover:text-white transition-colors truncate min-w-0"
                >
                  {t.city} {t.name}
                </Link>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
