'use client';

import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import type { Team } from '@/lib/types';
import { SPORT_ICONS } from '@/lib/types';
import { useStarredTeams } from '@/hooks/use-starred-teams';
import { StarToggle } from './star-toggle';
import { track } from '@/lib/analytics';
import { getInStateTeamSlugs } from '@/lib/geo/state-to-teams';

// Featured-six default mix used in State A's empty-state grid when geo
// reordering returns no in-state teams or hasn't loaded yet. Picked across
// the six supported leagues so a new visitor sees breadth, not depth.
const FEATURED_DEFAULTS: Array<{ name: string; league: string }> = [
  { name: 'Yankees', league: 'MLB' },
  { name: 'Twins', league: 'MLB' },
  { name: 'Lakers', league: 'NBA' },
  { name: 'Wild', league: 'NHL' },
  { name: 'Cowboys', league: 'NFL' },
  { name: 'LAFC', league: 'MLS' },
];

const FEATURED_LIMIT = 6;

// Mirrors team-grid.tsx so /my-teams uses the same cached region without a
// parallel fetch. 24h is well past the freshness any new-visitor session
// needs and keeps Edge calls off the critical path for repeat visitors.
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
    // Storage unavailable — proceed without caching.
  }
}

function pickFeatured(teams: Team[], region: string | null): Team[] {
  const byId = new Map(teams.map((t) => [t.id, t]));
  const result: Team[] = [];
  const seen = new Set<string>();

  for (const slug of getInStateTeamSlugs(region)) {
    if (result.length >= FEATURED_LIMIT) break;
    const t = byId.get(slug);
    if (t && !seen.has(t.id)) {
      result.push(t);
      seen.add(t.id);
    }
  }

  if (result.length < FEATURED_LIMIT) {
    for (const def of FEATURED_DEFAULTS) {
      if (result.length >= FEATURED_LIMIT) break;
      const t = teams.find(
        (x) => x.name === def.name && x.league === def.league,
      );
      if (t && !seen.has(t.id)) {
        result.push(t);
        seen.add(t.id);
      }
    }
  }

  return result;
}

interface MyTeamsViewProps {
  teams: Team[];
}

export function MyTeamsView({ teams }: MyTeamsViewProps) {
  const { starred, isHydrated, count } = useStarredTeams();
  const [region, setRegion] = useState<string | null>(null);

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
        // Geo fetch failed — stick with the static default. Nothing
        // user-facing breaks.
      });
    return () => {
      aborted = true;
    };
  }, []);

  // Step 4 only handles State A (count 0) and State C (count > 0). State B
  // requires Firestore promo aggregation, which lands in Step 5 — for now,
  // count > 0 always routes to C.
  useEffect(() => {
    if (!isHydrated) return;
    const state: 'A' | 'C' = count === 0 ? 'A' : 'C';
    track('my_teams_view', {
      starred_count: count,
      has_tonight_promo: false,
      state,
    });
  }, [isHydrated, count]);

  if (!isHydrated) {
    return <LoadingShell />;
  }

  if (count === 0) {
    return <StateA teams={teams} region={region} />;
  }

  const starredTeams = starred
    .map((slug) => teams.find((t) => t.id === slug))
    .filter((t): t is Team => !!t);

  return <StateC starredTeams={starredTeams} />;
}

function LoadingShell() {
  return (
    <div className="pt-28 pb-20 px-6 max-w-3xl mx-auto" aria-busy="true">
      <div className="h-3 w-24 bg-bg-card rounded animate-pulse mb-3" />
      <div className="h-10 w-60 bg-bg-card rounded animate-pulse mb-3" />
      <div className="h-4 w-80 bg-bg-card rounded animate-pulse" />
    </div>
  );
}

function StateA({ teams, region }: { teams: Team[]; region: string | null }) {
  const featured = useMemo(() => pickFeatured(teams, region), [teams, region]);

  return (
    <div className="pt-28 pb-20 px-6">
      <div className="max-w-3xl mx-auto">
        <div className="mb-8">
          <h1 className="font-outfit font-black text-[32px] tracking-[-0.5px] text-white leading-tight">
            Your Teams
          </h1>
          <p className="text-text-secondary text-sm mt-2">
            One calendar for every promo your teams have coming up.
          </p>
        </div>

        <HowItWorksCard />

        <div className="mb-3">
          <span className="font-mono text-[10px] tracking-[1.5px] uppercase text-text-dim">
            Popular teams · Tap a star to begin
          </span>
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 mb-8">
          {featured.map((team) => (
            <FeaturedTeamCard
              key={team.id}
              team={team}
              placement="my_teams_featured"
            />
          ))}
        </div>

        <Link
          href="/teams"
          className="block w-full text-center py-3 rounded-xl border border-border-subtle text-text-secondary text-sm font-mono tracking-[0.08em] uppercase hover:border-border-hover hover:text-white transition-colors"
        >
          Browse all 167 teams →
        </Link>
      </div>
    </div>
  );
}

function HowItWorksCard() {
  return (
    <div
      className="rounded-2xl border border-border-subtle px-4 py-4 mb-8"
      style={{
        background:
          'linear-gradient(135deg, rgba(239,68,68,0.06), rgba(255,255,255,0.02))',
      }}
    >
      <div className="space-y-3">
        <HowItWorksRow step="1" icon="⭐" text="Star teams from any league" />
        <HowItWorksRow
          step="2"
          icon="📅"
          text="Their promos land here automatically"
        />
        <HowItWorksRow
          step="3"
          icon="🎟️"
          text="Plan your night from one place"
        />
      </div>
    </div>
  );
}

function HowItWorksRow({
  step,
  icon,
  text,
}: {
  step: string;
  icon: string;
  text: string;
}) {
  return (
    <div className="flex items-center gap-3">
      <div
        aria-hidden="true"
        className="flex items-center justify-center w-9 h-9 rounded-lg bg-bg-card text-lg shrink-0"
      >
        {icon}
      </div>
      <div className="flex-1 min-w-0">
        <div className="font-mono text-[9px] tracking-[1.5px] uppercase text-text-dim">
          Step {step}
        </div>
        <div className="text-white text-sm">{text}</div>
      </div>
    </div>
  );
}

function FeaturedTeamCard({
  team,
  placement,
}: {
  team: Team;
  placement: 'my_teams_featured';
}) {
  const teamFullName = `${team.city} ${team.name}`;
  return (
    <article className="relative bg-bg-card border border-border-subtle rounded-2xl overflow-hidden">
      <div
        className="h-[3px]"
        style={{
          background: `linear-gradient(90deg, ${team.primaryColor}, ${team.secondaryColor})`,
        }}
        aria-hidden="true"
      />
      <div className="p-3 pr-12">
        <div className="font-mono text-[9px] tracking-[1px] uppercase text-text-dim mb-1">
          {SPORT_ICONS[team.league]} {team.league}
        </div>
        <div className="text-text-secondary text-[11px]">{team.city}</div>
        <div className="font-outfit font-extrabold text-[15px] text-white leading-tight">
          {team.name}
        </div>
      </div>
      <div className="absolute top-2 right-2">
        <StarToggle
          teamSlug={team.id}
          teamName={teamFullName}
          league={team.league}
          sport={team.sportSlug}
          placement={placement}
          surface="dark"
        />
      </div>
    </article>
  );
}

function StateC({ starredTeams }: { starredTeams: Team[] }) {
  const isSingle = starredTeams.length === 1;
  return (
    <div className="pt-28 pb-20 px-6">
      <div className="max-w-3xl mx-auto">
        <div className="flex items-start justify-between mb-8">
          <div>
            <h1 className="font-outfit font-black text-[32px] tracking-[-0.5px] text-white leading-tight">
              Your Teams
            </h1>
            <p className="font-mono text-[10px] tracking-[1.5px] uppercase text-text-dim mt-2">
              {starredTeams.length} starred · No promos coming up yet
            </p>
          </div>
          <Link
            href="/teams"
            className="font-mono text-[10px] tracking-[1.5px] uppercase text-text-secondary hover:text-white transition-colors mt-2"
          >
            Manage →
          </Link>
        </div>

        {isSingle && (
          <div className="mb-6 inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-[rgba(52,211,153,0.08)] border border-[rgba(52,211,153,0.25)]">
            <span className="w-1.5 h-1.5 rounded-full bg-[#34d399]" />
            <span className="text-[#34d399] text-[11px] font-mono">
              1 team starred. Your calendar is building.
            </span>
          </div>
        )}

        <div className="rounded-2xl border border-border-subtle bg-bg-card p-5 mb-8">
          <p className="text-text-secondary text-sm leading-relaxed">
            Nothing in the next 60 days. Your teams are tracked and the
            calendar will populate the moment promos are announced.
          </p>
        </div>

        <div className="mb-3">
          <span className="font-mono text-[10px] tracking-[1.5px] uppercase text-text-dim">
            Tracking
          </span>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-8">
          {starredTeams.map((team) => (
            <OffseasonTeamCard key={team.id} team={team} />
          ))}
        </div>

        <Link
          href="/teams"
          className="block w-full text-center py-3 rounded-xl border border-border-subtle text-text-secondary text-sm font-mono tracking-[0.08em] uppercase hover:border-border-hover hover:text-white transition-colors"
        >
          Browse other teams →
        </Link>
      </div>
    </div>
  );
}

function OffseasonTeamCard({ team }: { team: Team }) {
  const teamFullName = `${team.city} ${team.name}`;
  return (
    <article className="relative bg-bg-card border border-border-subtle rounded-2xl overflow-hidden">
      <div
        className="h-[3px]"
        style={{
          background: `linear-gradient(90deg, ${team.primaryColor}, ${team.secondaryColor})`,
        }}
        aria-hidden="true"
      />
      <div className="p-3 pr-12">
        <div className="font-mono text-[9px] tracking-[1px] uppercase text-text-dim mb-1">
          {SPORT_ICONS[team.league]} {team.league} · Offseason
        </div>
        <Link href={`/${team.sportSlug}/${team.id}`} className="block group">
          <div className="text-text-secondary text-[11px]">{team.city}</div>
          <div className="font-outfit font-extrabold text-[15px] text-white leading-tight group-hover:text-white transition-colors">
            {team.name}
          </div>
        </Link>
      </div>
      <div className="absolute top-2 right-2">
        <StarToggle
          teamSlug={team.id}
          teamName={teamFullName}
          league={team.league}
          sport={team.sportSlug}
          placement="my_teams_featured"
          surface="dark"
        />
      </div>
    </article>
  );
}
