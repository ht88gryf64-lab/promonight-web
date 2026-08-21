import { notFound } from 'next/navigation';
import type { Metadata } from 'next';
import {
  getAllTeams,
  getPromoCount,
  getPromosFromDate,
  getPromosInDateRange,
  getPlayoffPromosInDateRange,
  getGamesForTeam,
  enrichGamesForTeam,
  type GameContext,
} from '@/lib/data';
import type { PromoWithTeam, Team } from '@/lib/types';
import { getVenueUtilityCounts } from '@/lib/venue-hub';
import { pickHeroBuckets } from '@/components/tonight-strip';
import { pickBestStubPromos } from '@/components/redesign/pick-best-stub-promos';
import { buildHomeCategoryTiles } from '@/components/redesign/home-category-tiles';
import { deriveLeagueOrder } from '@/components/redesign/derive-league-order';
import { HomePageV2 } from '@/components/redesign/HomePageV2';
import { homepageCountsFromTeams } from '@/components/homepage-json-ld';

// Full-page preview of the assembled redesign homepage, rendered from the same
// live data the real route uses. Separate from /dev/ticket-stub, which is the
// component gallery: this route exists to review the page AS A PAGE, with no
// dashed wrappers or captions.
//
// Gated on VERCEL_ENV, not NODE_ENV: preview deployments build with
// NODE_ENV=production and this page exists to be reviewed on a preview URL.
// Production serves 404.
export const metadata: Metadata = { robots: { index: false, follow: false } };
export const revalidate = 0;

function chicagoTodayYMD(): string {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/Chicago',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(new Date());
  const get = (t: string) => parts.find((p) => p.type === t)?.value ?? '';
  return `${get('year')}-${get('month')}-${get('day')}`;
}

function plusDays(ymd: string, n: number): string {
  const [y, m, d] = ymd.split('-').map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d + n));
  return `${dt.getUTCFullYear()}-${String(dt.getUTCMonth() + 1).padStart(2, '0')}-${String(dt.getUTCDate()).padStart(2, '0')}`;
}

// Mirrors the live page's pickThisWeek shape: the +2 to +7 window, capped.
function pickThisWeek(
  promos: PromoWithTeam[],
  start: string,
  end: string,
  cap: number,
): PromoWithTeam[] {
  return promos
    .filter((p) => p.date >= start && p.date <= end)
    .sort((a, b) => a.date.localeCompare(b.date))
    .slice(0, cap);
}

// Same resolution the live route performs, so the modal opens identically.
async function resolveCardContexts(
  promos: PromoWithTeam[],
): Promise<Map<string, GameContext[]>> {
  const result = new Map<string, GameContext[]>();
  const teams = new Map<string, Team>();
  for (const p of promos) {
    if (p.team.league === 'mlb' || p.team.league === 'nfl') teams.set(p.team.id, p.team);
  }
  if (teams.size === 0) return result;

  const gamesByTeam = new Map<string, Awaited<ReturnType<typeof getGamesForTeam>>>();
  await Promise.all(
    [...teams.values()].map(async (t) => {
      gamesByTeam.set(t.id, await getGamesForTeam(t.id, t.league));
    }),
  );

  const keys = new Map<string, { team: Team; date: string }>();
  for (const p of promos) {
    if (p.team.league !== 'mlb' && p.team.league !== 'nfl') continue;
    keys.set(`${p.team.id}:${p.date}`, { team: p.team, date: p.date });
  }

  await Promise.all(
    [...keys.entries()].map(async ([key, { team, date }]) => {
      const games = gamesByTeam.get(team.id) ?? [];
      const dayHomeGames = games.filter((g) => g.date === date && g.homeTeamSlug === team.id);
      if (dayHomeGames.length === 0) return;
      const dayPromos = promos.filter((p) => p.team.id === team.id && p.date === date);
      result.set(key, await enrichGamesForTeam(team.id, dayHomeGames, dayPromos));
    }),
  );

  return result;
}

export default async function AssembledHomePreview() {
  if (process.env.VERCEL_ENV === 'production') {
    notFound();
  }

  const today = chicagoTodayYMD();
  const weekStart = plusDays(today, 2);
  const weekEnd = plusDays(today, 7);
  const tonightWindowEnd = plusDays(today, 14);

  const [regularWindow, playoffWindow, allFuture, allTeams, promoCount, venueCounts] =
    await Promise.all([
      getPromosInDateRange(today, tonightWindowEnd),
      getPlayoffPromosInDateRange(today, tonightWindowEnd),
      getPromosFromDate(today),
      getAllTeams(),
      getPromoCount(),
      getVenueUtilityCounts(),
    ]);

  const tonightWindow = [...regularWindow, ...playoffWindow];
  const heroBuckets = pickHeroBuckets(tonightWindow, today);
  const weekPromos = pickThisWeek(tonightWindow, weekStart, weekEnd, 6);
  const bestPromos = pickBestStubPromos(allFuture, 8);

  const teamPromoCounts: Record<string, number> = {};
  for (const t of allTeams) teamPromoCounts[t.id] = 0;
  for (const p of allFuture) {
    if (teamPromoCounts[p.team.id] !== undefined) teamPromoCounts[p.team.id]++;
  }
  const teamsForGrid = [...allTeams].sort(
    (a, b) => (teamPromoCounts[b.id] ?? 0) - (teamPromoCounts[a.id] ?? 0),
  );

  const leagueCount = new Set(allTeams.map((t) => t.league)).size;
  const teamsPerLeague = new Map<string, number>();
  for (const t of allTeams) teamsPerLeague.set(t.league, (teamsPerLeague.get(t.league) ?? 0) + 1);
  const leagueNames = [...teamsPerLeague.keys()].sort(
    (a, b) => (teamsPerLeague.get(b) ?? 0) - (teamsPerLeague.get(a) ?? 0) || a.localeCompare(b),
  );

  const heroStats = [
    { value: promoCount.toLocaleString(), label: 'Promos tracked' },
    { value: String(allTeams.length), label: 'Teams' },
    { value: String(leagueCount), label: 'Leagues' },
    { value: String(venueCounts.verifiedTotal), label: 'Venue guides' },
  ];

  const resolvedContexts = await resolveCardContexts([...heroBuckets.tonight, ...weekPromos]);

  return (
    <HomePageV2
      heroBuckets={heroBuckets}
      weekPromos={weekPromos}
      bestPromos={bestPromos}
      categoryTiles={buildHomeCategoryTiles(allFuture, today)}
      teamsForGrid={teamsForGrid}
      teamPromoCounts={teamPromoCounts}
      leagueOrder={deriveLeagueOrder(allFuture)}
      venueCounts={venueCounts}
      teamCount={allTeams.length}
      leagueCount={leagueCount}
      leagueNames={leagueNames}
      heroStats={heroStats}
      counts={homepageCountsFromTeams(allTeams)}
      resolvedContexts={resolvedContexts}
    />
  );
}
