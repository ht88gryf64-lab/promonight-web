'use client';

import { useEffect, useMemo, useState } from 'react';
import { TeamCard } from './team-card';
import type { Team } from '@/lib/types';
import { LEAGUE_ORDER } from '@/lib/types';
import { track } from '@/lib/analytics';
import { getInStateTeamSlugs } from '@/lib/geo/state-to-teams';
import { useStarredTeams } from '@/hooks/use-starred-teams';

// localStorage key + TTL for the cached visitor region. Region rarely
// changes for a given device; refreshing daily is plenty. Storing only the
// region code (not the IP) keeps this within the privacy posture stated in
// the API route.
const GEO_CACHE_KEY = 'pn:geo:v1';
const GEO_CACHE_TTL_MS = 24 * 60 * 60 * 1000;

interface GeoCache {
  region: string | null;
  ts: number;
}

function readGeoCache(): GeoCache | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = window.localStorage.getItem(GEO_CACHE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as GeoCache;
    if (typeof parsed.ts !== 'number') return null;
    if (Date.now() - parsed.ts > GEO_CACHE_TTL_MS) return null;
    return parsed;
  } catch {
    return null;
  }
}

function writeGeoCache(region: string | null): void {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(
      GEO_CACHE_KEY,
      JSON.stringify({ region, ts: Date.now() } satisfies GeoCache),
    );
  } catch {
    // Storage unavailable (private browsing, quota) — silently fall back to
    // alphabetical-by-rank for this session.
  }
}

function reorderByRegion(teams: Team[], region: string | null): Team[] {
  const inStateSlugs = getInStateTeamSlugs(region);
  if (inStateSlugs.length === 0) return teams;
  const teamById = new Map(teams.map((t) => [t.id, t]));
  const inState: Team[] = [];
  for (const slug of inStateSlugs) {
    const t = teamById.get(slug);
    if (t) inState.push(t);
  }
  if (inState.length === 0) return teams;
  const inStateIds = new Set(inState.map((t) => t.id));
  const rest = teams.filter((t) => !inStateIds.has(t.id));
  return [...inState, ...rest];
}

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
  // Starts null on the server and on initial client render to keep the
  // hydrated markup identical to the SSR output (alphabetical-by-rank).
  // Populated in useEffect once the region is known, triggering a reorder.
  const [region, setRegion] = useState<string | null>(null);
  const { starred, isHydrated } = useStarredTeams();
  const starredSet = useMemo(() => new Set(starred), [starred]);

  useEffect(() => {
    const cached = readGeoCache();
    if (cached) {
      setRegion(cached.region);
      return;
    }
    let aborted = false;
    fetch('/api/geo-region', { cache: 'no-store' })
      .then((r) => (r.ok ? r.json() : null))
      .then((data: { region?: string | null } | null) => {
        if (aborted) return;
        const r = data?.region ?? null;
        writeGeoCache(r);
        setRegion(r);
      })
      .catch(() => {
        // Network failure -> stick with alphabetical order; nothing user-facing.
      });
    return () => {
      aborted = true;
    };
  }, []);

  const orderedTeams = useMemo(() => {
    // Geo reorder first, then partition starred → unstarred. Within each
    // partition the geo-reordered (or natural) order is preserved so a
    // starred user from MN still sees Twins-then-Wild-then-Vikings ordering
    // among their starred set, not an arbitrary one. Pre-hydration the
    // starred set is empty so SSR and first-client-render produce the
    // same DOM — no hydration mismatch.
    const reordered = region ? reorderByRegion(teams, region) : teams;
    if (!isHydrated || starredSet.size === 0) return reordered;
    const starredPart: Team[] = [];
    const unstarredPart: Team[] = [];
    for (const t of reordered) {
      if (starredSet.has(t.id)) starredPart.push(t);
      else unstarredPart.push(t);
    }
    return [...starredPart, ...unstarredPart];
  }, [teams, region, isHydrated, starredSet]);

  const filtered =
    activeLeague === 'All'
      ? orderedTeams
      : orderedTeams.filter((t) => t.league === activeLeague);
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
