'use client';

import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import type { Team } from '@/lib/types';
import { LEAGUE_ORDER, SPORT_ICONS } from '@/lib/types';
import { track } from '@/lib/analytics';
import { StarToggle } from './star-toggle';

interface TeamsBrowserProps {
  teams: Team[];
  promoCounts: Record<string, number>;
}

const ALL = 'All' as const;
type ActiveLeague = typeof ALL | (typeof LEAGUE_ORDER)[number];

export function TeamsBrowser({ teams, promoCounts }: TeamsBrowserProps) {
  const [active, setActive] = useState<ActiveLeague>(ALL);

  // Fires once on initial mount so dashboards can attribute /teams page
  // views distinctly from /teams?league=X reloads. Subsequent filter changes
  // ride team_picker_tab_change, which already covers tab cadence.
  useEffect(() => {
    track('teams_browser_view', { league_filter: ALL });
  }, []);

  const filtered = useMemo(
    () => (active === ALL ? teams : teams.filter((t) => t.league === active)),
    [teams, active],
  );

  const switchTab = (next: ActiveLeague) => {
    if (next === active) return;
    track('team_picker_tab_change', {
      surface: 'teams_page',
      from_league: active,
      to_league: next,
    });
    setActive(next);
  };

  return (
    <div>
      {/* League filter pills */}
      <div className="flex flex-wrap gap-2 mb-8">
        <FilterPill
          label={`All (${teams.length})`}
          active={active === ALL}
          onClick={() => switchTab(ALL)}
        />
        {LEAGUE_ORDER.map((league) => {
          const count = teams.filter((t) => t.league === league).length;
          return (
            <FilterPill
              key={league}
              label={`${league} (${count})`}
              active={active === league}
              onClick={() => switchTab(league)}
            />
          );
        })}
      </div>

      {/* Grid */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
        {filtered.map((team) => (
          <TeamBrowserCard
            key={team.id}
            team={team}
            promoCount={promoCounts[team.id] ?? 0}
          />
        ))}
      </div>

      {filtered.length === 0 && (
        <div className="text-center py-16">
          <p className="text-text-muted text-lg">No teams in this league.</p>
        </div>
      )}
    </div>
  );
}

function FilterPill({
  label,
  active,
  onClick,
}: {
  label: string;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={`px-4 py-1.5 rounded-full text-[11px] font-mono tracking-[0.5px] uppercase transition-colors border ${
        active
          ? 'bg-accent-red text-white border-accent-red'
          : 'bg-transparent text-text-secondary border-border-subtle hover:border-border-hover'
      }`}
    >
      {label}
    </button>
  );
}

function TeamBrowserCard({
  team,
  promoCount,
}: {
  team: Team;
  promoCount: number;
}) {
  const hasPromos = promoCount > 0;
  const teamFullName = `${team.city} ${team.name}`;

  return (
    <article className="relative group bg-bg-card border border-border-subtle rounded-2xl overflow-hidden transition-all hover:-translate-y-0.5 hover:border-border-hover">
      <div
        className="h-[3px]"
        style={{
          background: `linear-gradient(90deg, ${team.primaryColor}, ${team.secondaryColor})`,
        }}
        aria-hidden="true"
      />
      <Link
        href={`/${team.sportSlug}/${team.id}`}
        className="block p-4 pr-12"
        aria-label={`${teamFullName} promo schedule`}
      >
        <div className="mb-3">
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
        </div>
        <div>
          <div className="text-text-secondary text-xs">{team.city}</div>
          <div className="font-outfit font-extrabold text-[17px] text-white leading-tight mt-0.5">
            {team.name}
          </div>
        </div>
        <div className="mt-3 text-[11px] font-mono">
          {hasPromos ? (
            <span className="text-[#34d399]">
              {promoCount} {promoCount === 1 ? 'promo' : 'promos'}
            </span>
          ) : (
            <span className="text-text-dim">No promos posted yet</span>
          )}
        </div>
      </Link>
      <div className="absolute top-2.5 right-2.5 z-10">
        <StarToggle
          teamSlug={team.id}
          teamName={teamFullName}
          league={team.league}
          sport={team.sportSlug}
          placement="teams_browser_card"
          surface="dark"
        />
      </div>
    </article>
  );
}
