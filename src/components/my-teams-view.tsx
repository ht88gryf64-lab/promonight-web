'use client';

import Link from 'next/link';
import { useEffect, useMemo, useRef, useState } from 'react';
import useSWR from 'swr';
import type { Team, Venue } from '@/lib/types';
import { PROMO_TYPE_COLORS, PROMO_TYPE_LABELS, SPORT_ICONS } from '@/lib/types';
import { useStarredTeams } from '@/hooks/use-starred-teams';
import { StarToggle } from './star-toggle';
import { track } from '@/lib/analytics';
import { getInStateTeamSlugs } from '@/lib/geo/state-to-teams';
import { TicketmasterCTA } from './affiliates/TicketmasterCTA';
import { FanaticsCTA } from './affiliates/FanaticsCTA';
import { SpotHeroCTA } from './affiliates/SpotHeroCTA';
import { BookingCTA } from './affiliates/BookingCTA';
import { AffiliateDisclosure } from './affiliates/AffiliateDisclosure';
import type {
  StarredPromo,
  StarredPromosResponse,
} from '@/app/api/my-teams/promos/route';

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
const PROMO_WINDOW_DAYS = 60;
const SWR_DEDUPE_MS = 5 * 60 * 1000;

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

function localYMD(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}

function addDaysYMD(base: Date, days: number): string {
  const d = new Date(base);
  d.setDate(d.getDate() + days);
  return localYMD(d);
}

function endOfMonthYMD(base: Date): string {
  const d = new Date(base.getFullYear(), base.getMonth() + 1, 0);
  return localYMD(d);
}

function daysBetweenYMD(from: string, to: string): number {
  const [fy, fm, fd] = from.split('-').map(Number);
  const [ty, tm, td] = to.split('-').map(Number);
  const f = Date.UTC(fy, fm - 1, fd);
  const t = Date.UTC(ty, tm - 1, td);
  return Math.round((t - f) / (24 * 60 * 60 * 1000));
}

async function promosFetcher(url: string): Promise<StarredPromosResponse> {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`status ${res.status}`);
  return (await res.json()) as StarredPromosResponse;
}

interface MyTeamsViewProps {
  teams: Team[];
}

export function MyTeamsView({ teams }: MyTeamsViewProps) {
  const { starred, isHydrated, count } = useStarredTeams();
  const [region, setRegion] = useState<string | null>(null);

  // Date stamps are computed once per render but kept stable across SWR
  // refetches by depending on `count`/`starred` only — the SWR key carries
  // the date strings, so a midnight crossover during a long-open session
  // would naturally refetch when the day changes anyway.
  const today = useMemo(() => new Date(), []);
  const todayYMD = useMemo(() => localYMD(today), [today]);
  const endYMD = useMemo(
    () => addDaysYMD(today, PROMO_WINDOW_DAYS),
    [today],
  );

  // Sorted slug key so equal starred sets share a cache entry regardless of
  // the order the user happened to star them in.
  const slugKey = useMemo(
    () => (count > 0 ? [...starred].sort().join(',') : ''),
    [starred, count],
  );

  const fetchUrl =
    isHydrated && count > 0
      ? `/api/my-teams/promos?teams=${slugKey}&start=${todayYMD}&end=${endYMD}`
      : null;

  const { data, error, isLoading } = useSWR<StarredPromosResponse>(
    fetchUrl,
    promosFetcher,
    {
      revalidateOnFocus: true,
      dedupingInterval: SWR_DEDUPE_MS,
    },
  );

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

  // Settled-state key. A view event fires once per distinct key — refetches
  // and focus revalidations don't re-emit. Loading transitions never fire.
  const stateKey = useMemo<'A' | 'B' | 'C' | 'loading' | null>(() => {
    if (!isHydrated) return null;
    if (count === 0) return 'A';
    if (isLoading && !data) return 'loading';
    if (error) return 'C';
    const promos = data?.promos ?? [];
    return promos.length > 0 ? 'B' : 'C';
  }, [isHydrated, count, isLoading, error, data]);

  const lastFiredState = useRef<string | null>(null);
  useEffect(() => {
    if (!stateKey || stateKey === 'loading') return;
    if (lastFiredState.current === stateKey + ':' + count) return;
    lastFiredState.current = stateKey + ':' + count;
    const promos = data?.promos ?? [];
    const hasTonight = promos.some((p) => p.date === todayYMD);
    track('my_teams_view', {
      starred_count: count,
      has_tonight_promo: hasTonight,
      state: stateKey,
    });
  }, [stateKey, count, data, todayYMD]);

  if (!isHydrated) return <LoadingShell />;
  if (count === 0) return <StateA teams={teams} region={region} />;

  const starredTeams = starred
    .map((slug) => teams.find((t) => t.id === slug))
    .filter((t): t is Team => !!t);

  if (stateKey === 'loading') {
    return <PopulatedLoadingShell starredCount={count} />;
  }

  if (error || !data) {
    return <StateC starredTeams={starredTeams} hadError />;
  }

  if (data.promos.length === 0) {
    return <StateC starredTeams={starredTeams} />;
  }

  return (
    <StateB
      starredTeams={starredTeams}
      promos={data.promos}
      venues={data.venues}
      todayYMD={todayYMD}
    />
  );
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

function PopulatedLoadingShell({ starredCount }: { starredCount: number }) {
  return (
    <div className="pt-28 pb-20 px-6" aria-busy="true">
      <div className="max-w-3xl mx-auto">
        <h1 className="font-outfit font-black text-[32px] tracking-[-0.5px] text-white leading-tight">
          Your Teams
        </h1>
        <p className="font-mono text-[10px] tracking-[1.5px] uppercase text-text-dim mt-2 mb-8">
          {starredCount} starred · Loading your calendar...
        </p>
        <div className="space-y-3">
          {[0, 1, 2, 3].map((i) => (
            <div
              key={i}
              className="h-16 bg-bg-card rounded-xl animate-pulse"
            />
          ))}
        </div>
      </div>
    </div>
  );
}

// ─── State A: Never Starred ────────────────────────────────────────────────

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
            <FeaturedTeamCard key={team.id} team={team} />
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

function FeaturedTeamCard({ team }: { team: Team }) {
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
          placement="my_teams_featured"
          surface="dark"
        />
      </div>
    </article>
  );
}

// ─── State C: Starred But Quiet ────────────────────────────────────────────

function StateC({
  starredTeams,
  hadError = false,
}: {
  starredTeams: Team[];
  hadError?: boolean;
}) {
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

        {isSingle && !hadError && (
          <div className="mb-6 inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-[rgba(52,211,153,0.08)] border border-[rgba(52,211,153,0.25)]">
            <span className="w-1.5 h-1.5 rounded-full bg-[#34d399]" />
            <span className="text-[#34d399] text-[11px] font-mono">
              1 team starred. Your calendar is building.
            </span>
          </div>
        )}

        {hadError && (
          <div className="mb-6 rounded-2xl border border-accent-red-border bg-accent-red-bg p-4">
            <p className="text-accent-red text-sm">
              Couldn&apos;t load your promos right now. Refresh to try again.
            </p>
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

// ─── State B: Populated ────────────────────────────────────────────────────

function StateB({
  starredTeams,
  promos,
  venues,
  todayYMD,
}: {
  starredTeams: Team[];
  promos: StarredPromo[];
  venues: Record<string, Venue | null>;
  todayYMD: string;
}) {
  const teamById = useMemo(
    () => new Map(starredTeams.map((t) => [t.id, t])),
    [starredTeams],
  );

  const endOfMonth = useMemo(
    () => endOfMonthYMD(new Date()),
    [],
  );

  const upcomingThisMonth = promos.filter(
    (p) => p.date >= todayYMD && p.date <= endOfMonth,
  ).length;

  const week7 = addDaysYMD(new Date(), 7);
  const tonight = promos.filter((p) => p.date === todayYMD);
  const thisWeek = promos.filter(
    (p) => p.date > todayYMD && p.date <= week7,
  );
  const comingUp = promos.filter((p) => p.date > week7);

  // Teams in the starred set that have zero promos in the 60-day window.
  const teamsWithPromos = new Set(promos.map((p) => p.teamSlug));
  const offseasonTeams = starredTeams.filter(
    (t) => !teamsWithPromos.has(t.id),
  );

  return (
    <div className="pt-28 pb-20 px-6">
      <div className="max-w-3xl mx-auto">
        <div className="flex items-start justify-between mb-8">
          <div>
            <h1 className="font-outfit font-black text-[32px] tracking-[-0.5px] text-white leading-tight">
              Your Teams
            </h1>
            <p className="font-mono text-[10px] tracking-[1.5px] uppercase text-text-dim mt-2">
              {starredTeams.length} starred · {upcomingThisMonth} upcoming this
              month
            </p>
          </div>
          <Link
            href="/teams"
            className="font-mono text-[10px] tracking-[1.5px] uppercase text-text-secondary hover:text-white transition-colors mt-2"
          >
            Manage →
          </Link>
        </div>

        <StarredChipsStrip teams={starredTeams} />

        {tonight.length > 0 && (
          <>
            <TonightSection
              promo={tonight[0]}
              team={teamById.get(tonight[0].teamSlug) ?? null}
              venue={venues[tonight[0].teamSlug] ?? null}
              todayYMD={todayYMD}
            />
            <AffiliateClusterSection
              team={teamById.get(tonight[0].teamSlug) ?? null}
              venue={venues[tonight[0].teamSlug] ?? null}
            />
          </>
        )}

        {thisWeek.length > 0 && (
          <ThisWeekSection
            promos={thisWeek}
            teamById={teamById}
            todayYMD={todayYMD}
          />
        )}

        {comingUp.length > 0 && (
          <ComingUpSection
            promos={comingUp}
            teamById={teamById}
            todayYMD={todayYMD}
          />
        )}

        {offseasonTeams.length > 0 && (
          <section className="mb-8">
            <div className="mb-3">
              <span className="font-mono text-[10px] tracking-[1.5px] uppercase text-text-dim">
                Tracking · Offseason
              </span>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {offseasonTeams.map((team) => (
                <OffseasonTeamCard key={team.id} team={team} />
              ))}
            </div>
          </section>
        )}
      </div>
    </div>
  );
}

function StarredChipsStrip({ teams }: { teams: Team[] }) {
  return (
    <div className="overflow-x-auto whitespace-nowrap mb-6 -mx-6 px-6 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
      <div className="inline-flex gap-2">
        {teams.map((team) => (
          <Link
            key={team.id}
            href={`/${team.sportSlug}/${team.id}`}
            className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full shrink-0"
            style={{
              background: `linear-gradient(90deg, ${team.primaryColor}, ${team.secondaryColor})`,
            }}
          >
            <span
              aria-hidden="true"
              className="inline-flex items-center justify-center w-5 h-5 rounded-full bg-black/30 text-[10px]"
            >
              {SPORT_ICONS[team.league]}
            </span>
            <span className="font-outfit font-extrabold text-[12px] text-white">
              {team.name}
            </span>
            <span className="font-mono text-[8px] text-white/70 tracking-[0.5px]">
              {team.league}
            </span>
          </Link>
        ))}
      </div>
    </div>
  );
}

function trackPromoTap(promo: StarredPromo, todayYMD: string): void {
  track('my_teams_promo_tap', {
    team_slug: promo.teamSlug,
    promo_id: promo.promoId,
    days_until: Math.max(0, daysBetweenYMD(todayYMD, promo.date)),
  });
}

function TonightSection({
  promo,
  team,
  todayYMD,
}: {
  promo: StarredPromo;
  team: Team | null;
  venue: Venue | null;
  todayYMD: string;
}) {
  if (!team) return null;

  const matchup = [
    promo.opponent ? `vs ${promo.opponent}` : null,
    promo.time || null,
  ]
    .filter(Boolean)
    .join(' · ');

  return (
    <section className="mb-6">
      <div className="flex items-center gap-2 mb-3">
        <span className="w-1.5 h-1.5 rounded-full bg-accent-red animate-pulse-dot" />
        <span className="font-mono text-[9px] tracking-[1.5px] uppercase text-accent-red">
          Tonight
        </span>
      </div>
      <Link
        href={`/${team.sportSlug}/${team.id}`}
        onClick={() => trackPromoTap(promo, todayYMD)}
        className="block relative rounded-2xl overflow-hidden border border-border-subtle"
        style={{
          background: `linear-gradient(135deg, ${team.primaryColor}, ${team.secondaryColor})`,
        }}
      >
        <div className="absolute inset-0 bg-black/45" aria-hidden="true" />
        <div className="relative p-5">
          <div className="flex items-start justify-between mb-4">
            {promo.highlight ? (
              <span className="inline-flex items-center px-2 py-0.5 rounded-full bg-accent-red text-white text-[9px] font-mono tracking-[1px] uppercase">
                Hot
              </span>
            ) : (
              <span />
            )}
            <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-black/40 text-white text-[10px] font-mono tracking-[0.5px]">
              {SPORT_ICONS[team.league]} {team.abbreviation} · {team.name}
            </span>
          </div>
          <div className="flex items-center gap-3 mb-4">
            <div
              aria-hidden="true"
              className="flex items-center justify-center w-[52px] h-[52px] rounded-2xl bg-black/45 text-3xl shrink-0"
            >
              {promo.icon}
            </div>
            <div className="min-w-0">
              <div className="font-outfit font-extrabold text-[19px] text-white leading-tight">
                {promo.title}
              </div>
              {matchup && (
                <div className="font-mono text-[10px] tracking-[0.5px] text-white/85 mt-1">
                  {matchup}
                </div>
              )}
            </div>
          </div>
        </div>
      </Link>
    </section>
  );
}

function ThisWeekSection({
  promos,
  teamById,
  todayYMD,
}: {
  promos: StarredPromo[];
  teamById: Map<string, Team>;
  todayYMD: string;
}) {
  return (
    <section className="mb-8">
      <div className="mb-3">
        <span className="font-mono text-[10px] tracking-[1.5px] uppercase text-text-dim">
          This week
        </span>
      </div>
      <div className="overflow-x-auto whitespace-nowrap -mx-6 px-6 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        <div className="inline-flex gap-3">
          {promos.map((promo) => {
            const team = teamById.get(promo.teamSlug);
            if (!team) return null;
            return (
              <Link
                key={`${promo.teamSlug}-${promo.promoId}`}
                href={`/${team.sportSlug}/${team.id}`}
                onClick={() => trackPromoTap(promo, todayYMD)}
                className="block relative w-[200px] rounded-2xl overflow-hidden border border-border-subtle shrink-0"
                style={{
                  background: `linear-gradient(135deg, ${team.primaryColor}, ${team.secondaryColor})`,
                }}
              >
                <div className="absolute inset-0 bg-black/45" aria-hidden="true" />
                <div className="relative p-3">
                  <span className="inline-flex items-center px-2 py-0.5 rounded-full bg-black/40 text-white text-[9px] font-mono tracking-[0.5px] mb-2">
                    {formatShortDate(promo.date)}
                  </span>
                  <div
                    aria-hidden="true"
                    className="text-2xl mb-1.5"
                  >
                    {promo.icon}
                  </div>
                  <div className="font-outfit font-extrabold text-[13px] text-white leading-tight whitespace-normal">
                    {promo.title}
                  </div>
                  <div className="flex items-center gap-1.5 mt-2">
                    <span
                      className="inline-block px-1.5 py-0.5 rounded text-[9px] font-mono uppercase tracking-[0.5px] text-white/90"
                      style={{
                        backgroundColor: PROMO_TYPE_COLORS[promo.type] + '30',
                      }}
                    >
                      {PROMO_TYPE_LABELS[promo.type]}
                    </span>
                    {promo.time && (
                      <span className="font-mono text-[9px] text-white/70">
                        {promo.time}
                      </span>
                    )}
                  </div>
                </div>
              </Link>
            );
          })}
        </div>
      </div>
    </section>
  );
}

function ComingUpSection({
  promos,
  teamById,
  todayYMD,
}: {
  promos: StarredPromo[];
  teamById: Map<string, Team>;
  todayYMD: string;
}) {
  // Group consecutive rows by date so the date column doesn't repeat on every
  // row when several teams share a date.
  let lastDate = '';
  return (
    <section className="mb-8">
      <div className="mb-3">
        <span className="font-mono text-[10px] tracking-[1.5px] uppercase text-text-dim">
          Coming up
        </span>
      </div>
      <div className="rounded-2xl border border-border-subtle bg-bg-card overflow-hidden">
        {promos.map((promo, i) => {
          const team = teamById.get(promo.teamSlug);
          if (!team) return null;
          const isNewDate = promo.date !== lastDate;
          lastDate = promo.date;
          return (
            <Link
              key={`${promo.teamSlug}-${promo.promoId}`}
              href={`/${team.sportSlug}/${team.id}`}
              onClick={() => trackPromoTap(promo, todayYMD)}
              className={`flex items-center gap-3 px-4 py-3 hover:bg-bg-card-hover transition-colors ${i > 0 && isNewDate ? 'border-t border-border-subtle' : ''}`}
            >
              <div className="w-[42px] shrink-0">
                {isNewDate ? (
                  <div>
                    <div className="font-mono text-[9px] tracking-[1px] uppercase text-text-dim">
                      {formatShortDate(promo.date).split(' ')[0]}
                    </div>
                    <div className="font-outfit font-extrabold text-[18px] text-white leading-none">
                      {formatShortDate(promo.date).split(' ')[1]}
                    </div>
                  </div>
                ) : null}
              </div>
              <div
                aria-hidden="true"
                className="flex items-center justify-center w-9 h-9 rounded-lg shrink-0 text-lg"
                style={{ backgroundColor: PROMO_TYPE_COLORS[promo.type] + '22' }}
              >
                {promo.icon}
              </div>
              <div className="flex-1 min-w-0">
                <div className="font-outfit font-bold text-[14px] text-white leading-tight truncate">
                  {promo.title}
                  {promo.highlight && (
                    <span className="ml-1.5 inline-flex items-center px-1 py-0 rounded bg-accent-red/20 text-accent-red text-[8px] font-mono tracking-[1px] uppercase align-middle">
                      Hot
                    </span>
                  )}
                </div>
                <div className="flex items-center gap-2 mt-0.5">
                  <span
                    className="font-mono text-[9px] uppercase tracking-[0.5px]"
                    style={{ color: PROMO_TYPE_COLORS[promo.type] }}
                  >
                    {PROMO_TYPE_LABELS[promo.type]}
                  </span>
                  <span className="text-text-dim text-[10px]">
                    {team.abbreviation} · {team.name}
                  </span>
                </div>
              </div>
              <span
                aria-hidden="true"
                className="text-text-dim text-lg shrink-0"
              >
                ›
              </span>
            </Link>
          );
        })}
      </div>
    </section>
  );
}

// ─── Affiliate cluster (TONIGHT only) ──────────────────────────────────────
// Reuses the existing team-page CTA components verbatim. surface tag is
// web_my_teams so the affiliate_click event payload carries the right
// attribution; placement strings distinguish the singular Get-Tickets hero
// from the Prepare-for-the-Game cluster on the dashboards.
//
// All four cards always render here. Per the affiliate gating audit, the
// team-page already renders SpotHero and Booking unconditionally with
// direct-URL fallbacks — there is no feature flag to bypass, so this
// page's behavior matches without a workaround. FanaticsCTA self-gates on
// team.fanaticsUrl/fanaticsPath presence (data-level, not feature-level);
// teams without those fields silently drop from the cluster, same as on
// team pages.
function AffiliateClusterSection({
  team,
  venue,
}: {
  team: Team | null;
  venue: Venue | null;
}) {
  if (!team) return null;
  const venueDisplay = venue?.name ?? null;

  return (
    <>
      <section className="mb-6">
        <div className="mb-3">
          <span className="font-mono text-[9px] tracking-[1.5px] uppercase text-text-dim">
            Get tickets
          </span>
        </div>
        <TicketmasterCTA
          team={team}
          surface="web_my_teams"
          placement="my_teams_tonight"
          size="full"
        />
      </section>

      <section className="mb-6">
        <div className="mb-3">
          <span className="font-mono text-[9px] tracking-[1.5px] uppercase text-text-dim">
            {venueDisplay
              ? `Prepare for the game at ${venueDisplay}`
              : 'Prepare for the game'}
          </span>
        </div>
        <div className="flex flex-col gap-2.5">
          <FanaticsCTA
            team={team}
            surface="web_my_teams"
            placement="my_teams_prepare"
          />
          <SpotHeroCTA
            team={team}
            surface="web_my_teams"
            placement="my_teams_prepare"
            venue={venue}
          />
          <BookingCTA
            team={team}
            surface="web_my_teams"
            placement="my_teams_prepare"
            venue={venue}
          />
        </div>
        <AffiliateDisclosure className="mt-3 text-center" />
      </section>
    </>
  );
}

function formatShortDate(ymd: string): string {
  const [y, m, d] = ymd.split('-').map(Number);
  const date = new Date(y, m - 1, d);
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}
