'use client';

import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import type { Team } from '@/lib/types';
import { LEAGUE_ORDER, SPORT_ICONS } from '@/lib/types';
import { track } from '@/lib/analytics';
import { useStarredTeams } from '@/hooks/use-starred-teams';
import { isCfbHubLive } from '@/lib/league-hubs';
import { CfbConferenceSubRow } from '@/components/cfb/CfbConferenceSubRow';
import { StarToggle } from './star-toggle';
import { TeamCard } from './team-card';

interface TeamsBrowserProps {
  teams: Team[];
  promoCounts: Record<string, number>;
  // 'dark' (default) is the live browser, byte-identical when the gate is off.
  // 'light' re-skins the pills + swaps in the homepage's light TeamCard. Same
  // geo/star logic + the same teams_browser_view / team_picker_tab_change events;
  // the light cards additionally fire team_tile_tap (surface 'teams_page').
  variant?: 'dark' | 'light';
}

const ALL = 'All' as const;
// 'CFB' is a college-hub entry point, not a pro league: selecting it reveals the
// conference sub-row (which routes to /cfb), never filters pro cards, and CFB is
// never in the "All" total. Gated on the same registry `live` flag as the nav.
const CFB_CHIP = 'CFB' as const;
type ActiveLeague = typeof ALL | (typeof LEAGUE_ORDER)[number] | typeof CFB_CHIP;

export function TeamsBrowser({ teams, promoCounts, variant = 'dark' }: TeamsBrowserProps) {
  const light = variant === 'light';
  const cfbLive = isCfbHubLive();
  const [active, setActive] = useState<ActiveLeague>(ALL);
  const { starred, isHydrated } = useStarredTeams();
  const starredSet = useMemo(() => new Set(starred), [starred]);

  // Fires once on initial mount so dashboards can attribute /teams page
  // views distinctly from /teams?league=X reloads. Subsequent filter changes
  // ride team_picker_tab_change, which already covers tab cadence.
  useEffect(() => {
    track('teams_browser_view', { league_filter: ALL });
  }, []);

  // Filter and partition:
  //
  // 1. Apply the active league filter.
  // 2. Partition the filtered set into starred + unstarred, preserving
  //    each team's index from `teams` (which getAllTeams() ships sorted
  //    by league then city). Concatenating the partitions yields the
  //    historical natural order for zero-star users and "starred-first,
  //    natural order within partition" for starred users.
  //
  // Pre-hydration the starred set is empty by definition, so everything
  // lands in `unstarred` and the SSR + first-client-render produce
  // identical HTML (no hydration mismatch). After hydration the
  // partition re-runs with the real starred set, briefly reflowing the
  // grid for starred users.
  const filtered = useMemo(() => {
    const base = active === ALL ? teams : teams.filter((t) => t.league === active);
    const starredPart: Team[] = [];
    const unstarredPart: Team[] = [];
    for (const t of base) {
      if (isHydrated && starredSet.has(t.id)) {
        starredPart.push(t);
      } else {
        unstarredPart.push(t);
      }
    }
    return [...starredPart, ...unstarredPart];
  }, [teams, active, isHydrated, starredSet]);

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
          light={light}
        />
        {LEAGUE_ORDER.map((league) => {
          const count = teams.filter((t) => t.league === league).length;
          return (
            <FilterPill
              key={league}
              label={`${league} (${count})`}
              active={active === league}
              onClick={() => switchTab(league)}
              light={light}
            />
          );
        })}
        {cfbLive && (
          <FilterPill
            label={CFB_CHIP}
            active={active === CFB_CHIP}
            onClick={() => switchTab(CFB_CHIP)}
            light={light}
          />
        )}
      </div>

      {active === CFB_CHIP ? (
        /* CFB: college-hub entry point (routes to /cfb), never inline pro cards. */
        <CfbConferenceSubRow surface="teams_page" light={light} />
      ) : (
        <>
          {/* Grid */}
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
            {filtered.map((team) =>
              light ? (
                <TeamCard
                  key={team.id}
                  team={team}
                  promoCount={promoCounts[team.id] ?? 0}
                  countLabel="promos"
                  tileSurface="teams_page"
                  fromTab={active}
                  starPlacement="teams_browser_card"
                  sourcePage="teams"
                  variant="light"
                />
              ) : (
                <TeamBrowserCard
                  key={team.id}
                  team={team}
                  promoCount={promoCounts[team.id] ?? 0}
                />
              ),
            )}
          </div>

          {filtered.length === 0 && (
            <div className="text-center py-16">
              <p className={light ? 'text-rd-ink-faint text-lg' : 'text-text-muted text-lg'}>No teams in this league.</p>
            </div>
          )}
        </>
      )}
    </div>
  );
}

function FilterPill({
  label,
  active,
  onClick,
  light = false,
}: {
  label: string;
  active: boolean;
  onClick: () => void;
  light?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={
        light
          ? `cursor-pointer rounded-full border px-4 py-1.5 font-rd text-[12px] font-semibold uppercase tracking-[0.08em] transition-colors ${
              active
                ? 'border-rd-ink bg-rd-ink text-white'
                : 'border-rd-line-strong bg-rd-card text-rd-ink-soft hover:border-rd-ink hover:text-rd-ink'
            }`
          : `cursor-pointer px-4 py-1.5 rounded-full text-[11px] font-mono tracking-[0.5px] uppercase transition-colors border ${
              active
                ? 'bg-accent-red text-white border-accent-red'
                : 'bg-transparent text-text-secondary border-border-subtle hover:border-border-hover'
            }`
      }
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
