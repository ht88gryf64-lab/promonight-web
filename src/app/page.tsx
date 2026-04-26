import type { Metadata } from 'next';
import Link from 'next/link';
import {
  getAllTeams,
  getPlayoffPromosInDateRange,
  getPromoCount,
  getPromosFromDate,
  getPromosInDateRange,
} from '@/lib/data';
import type { PromoWithTeam, Team } from '@/lib/types';
import { TonightStrip, pickHeroBuckets } from '@/components/tonight-strip';
import { ThisWeekStrip } from '@/components/this-week-strip';
import { BrowseCollections, type CollectionTile } from '@/components/browse-collections';
import { TeamGrid } from '@/components/team-grid';
import { AppDownloadButtons } from '@/components/app-download-buttons';
import { IndieDeveloperBlock } from '@/components/indie-developer-block';
import { HomepageFAQ } from '@/components/homepage-faq';
import { HomepageJsonLd } from '@/components/homepage-json-ld';
import { TrackedTapLink } from '@/components/analytics/TrackedTapLink';
import { AdSlot } from '@/components/ads/AdSlot';
import { AD_SLOTS } from '@/lib/ads/slots';

// 1h — Tonight cards roll over daily, this section needs to be more time-sensitive
// than the team pages.
export const revalidate = 3600;

export const metadata: Metadata = {
  alternates: { canonical: 'https://www.getpromonight.com' },
};

// Date math anchored to America/Chicago so the homepage doesn't say "tonight"
// for a UTC-day-ahead date (cosmetic bug we hit on the team pages).
function chicagoTodayYMD(): string {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/Chicago',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(new Date());
  const part = (t: string) => parts.find((p) => p.type === t)?.value ?? '';
  return `${part('year')}-${part('month')}-${part('day')}`;
}

function plusDays(ymd: string, n: number): string {
  const [y, m, d] = ymd.split('-').map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d + n));
  return `${dt.getUTCFullYear()}-${String(dt.getUTCMonth() + 1).padStart(2, '0')}-${String(dt.getUTCDate()).padStart(2, '0')}`;
}

function formatChicagoLong(ymd: string): string {
  const [y, m, d] = ymd.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, d, 12)).toLocaleDateString('en-US', {
    timeZone: 'America/Chicago',
    month: 'long',
    day: 'numeric',
    year: 'numeric',
  });
}

const BOBBLEHEAD_RE = /bobblehead/i;
const JERSEY_RE = /\b(jersey|jerseys|cap|caps|hat|hats|jacket|jackets|shirt|shirts|hoodie|hoodies)\b/i;
const FIREWORKS_RE = /fireworks|postgame concert|post-game concert|pyro|light show/i;

function topExamples(
  pool: PromoWithTeam[],
  desired: number,
): { titles: string[]; total: number } {
  const seen = new Set<string>();
  const titles: string[] = [];
  const dated = [...pool].sort((a, b) => a.date.localeCompare(b.date));
  for (const p of dated) {
    if (!p.highlight) continue;
    if (seen.has(p.title)) continue;
    seen.add(p.title);
    titles.push(p.title);
    if (titles.length === desired) break;
  }
  if (titles.length < desired) {
    for (const p of dated) {
      if (seen.has(p.title)) continue;
      seen.add(p.title);
      titles.push(p.title);
      if (titles.length === desired) break;
    }
  }
  return { titles, total: pool.length };
}

function buildCollectionTiles(allFuture: PromoWithTeam[]): CollectionTile[] {
  const bobbleheads = allFuture.filter(
    (p) => BOBBLEHEAD_RE.test(p.title) || BOBBLEHEAD_RE.test(p.description),
  );
  const jerseys = allFuture.filter(
    (p) => JERSEY_RE.test(p.title) || JERSEY_RE.test(p.description),
  );
  const themes = allFuture.filter((p) => p.type === 'theme');
  const fireworks = themes.filter(
    (p) => FIREWORKS_RE.test(p.title) || FIREWORKS_RE.test(p.description),
  );

  const tiles: CollectionTile[] = [];

  if (bobbleheads.length > 0) {
    const { titles, total } = topExamples(bobbleheads, 3);
    tiles.push({
      href: '/promos/bobbleheads',
      emoji: '🎁',
      label: 'Bobbleheads',
      count: total,
      examples: titles,
      totalForOverflow: total,
      accentColor: '#34d399',
      trackName: 'bobbleheads',
    });
  }
  if (jerseys.length > 0) {
    const { titles, total } = topExamples(jerseys, 3);
    tiles.push({
      href: '/promos/jersey-giveaways',
      emoji: '👕',
      label: 'Jerseys & Apparel',
      count: total,
      examples: titles,
      totalForOverflow: total,
      accentColor: '#22d3ee',
      trackName: 'jerseys',
    });
  }
  if (themes.length > 0) {
    const { titles, total } = topExamples(themes, 3);
    tiles.push({
      href: '/promos/theme-nights',
      emoji: '🎉',
      label: 'Theme Nights',
      count: total,
      examples: titles,
      totalForOverflow: total,
      accentColor: '#a78bfa',
      trackName: 'theme_nights',
    });
  }
  if (fireworks.length > 0) {
    const { titles, total } = topExamples(fireworks, 3);
    tiles.push({
      href: '/promos/theme-nights',
      emoji: '💥',
      label: 'Fireworks Nights',
      count: total,
      examples: titles,
      totalForOverflow: total,
      accentColor: '#fb923c',
      trackName: 'fireworks',
    });
  }

  return tiles;
}

function pickThisWeek(
  windowPromos: PromoWithTeam[],
  startInclusive: string,
  endInclusive: string,
  limit: number,
): PromoWithTeam[] {
  return windowPromos
    .filter((p) => p.highlight && p.date >= startInclusive && p.date <= endInclusive)
    .sort((a, b) => a.date.localeCompare(b.date))
    .slice(0, limit);
}

// Ranks teams by future-promo count (not all-time). Drives the "popular"
// sample shown on the All tab. Intentionally seasonal: a team with 100 past
// promos but 0 upcoming won't appear here, since the homepage is forward-
// looking. In spring this skews MLB-heavy because MLB schedules are denser
// for the months ahead. If All-tab balance becomes a problem, options are
// (a) take top-2-per-league across 6 leagues for 12 total, or (b) switch to
// all-time totals via 167 separate getTeamPromos fetches.
function rankTeamsByFuturePromos(
  teams: Team[],
  allFuture: PromoWithTeam[],
): { sortedTeams: Team[]; counts: Record<string, number> } {
  const counts: Record<string, number> = {};
  for (const t of teams) counts[t.id] = 0;
  for (const p of allFuture) {
    if (counts[p.team.id] !== undefined) counts[p.team.id]++;
  }
  const sortedTeams = [...teams].sort((a, b) => {
    const diff = (counts[b.id] ?? 0) - (counts[a.id] ?? 0);
    if (diff !== 0) return diff;
    return a.city.localeCompare(b.city);
  });
  return { sortedTeams, counts };
}

export default async function HomePage() {
  const today = chicagoTodayYMD();
  const weekStart = plusDays(today, 2);
  const weekEnd = plusDays(today, 7);
  const tonightWindowEnd = plusDays(today, 14);

  const [regularWindow, playoffWindow, allFuture, allTeams, promoCount] =
    await Promise.all([
      getPromosInDateRange(today, tonightWindowEnd),
      getPlayoffPromosInDateRange(today, tonightWindowEnd),
      getPromosFromDate(today),
      getAllTeams(),
      getPromoCount(),
    ]);

  // Merge playoff promos into the hero stream. Both arrays are PromoWithTeam
  // shape; pickHeroBuckets/pickThisWeek sort by date + league rank, so dedupe
  // is not needed (playoff and regular promos live in disjoint Firestore
  // collections).
  const tonightWindow = [...regularWindow, ...playoffWindow];

  const heroBuckets = pickHeroBuckets(tonightWindow, today);
  const weekPromos = pickThisWeek(tonightWindow, weekStart, weekEnd, 6);
  const collectionTiles = buildCollectionTiles(allFuture);
  const { sortedTeams, counts: teamPromoCounts } = rankTeamsByFuturePromos(
    allTeams,
    allFuture,
  );

  // Order for league tabs: keep alphabetic-by-city within each league so the
  // grid reads naturally. The "All" tab uses `sortedTeams` (popularity) by
  // virtue of TeamGrid taking the prop's order on the All filter.
  const teamsForGrid: Team[] = sortedTeams;

  const lastUpdated = formatChicagoLong(today);

  return (
    <>
      <HomepageJsonLd />

      {/* Hero */}
      <section className="relative pt-28 pb-12 md:pb-16 px-6 overflow-hidden">
        <div
          className="absolute top-[-10%] left-1/2 -translate-x-1/2 w-[800px] h-[500px] bg-[radial-gradient(circle,rgba(239,68,68,0.08)_0%,transparent_70%)] pointer-events-none"
          aria-hidden="true"
        />

        <div className="relative max-w-5xl mx-auto">
          <h1 className="font-display text-[clamp(40px,7vw,72px)] leading-[0.95] tracking-[1px] mb-4 max-w-3xl">
            EVERY PROMO AT EVERY GAME.
          </h1>
          <p className="text-text-secondary text-lg md:text-xl leading-relaxed max-w-2xl mb-4">
            167 teams, 6 leagues, updated daily. Find tonight&apos;s giveaways,
            theme nights, and food deals.
          </p>
          <p className="font-mono text-[11px] tracking-[0.08em] uppercase text-text-muted mb-10">
            {promoCount.toLocaleString()} promos tracked · Last updated {lastUpdated}
          </p>

          <TonightStrip buckets={heroBuckets} />

          <div className="mt-8">
            <TrackedTapLink
              href="/teams"
              trackEvent="browse_all_teams_tap"
              trackProps={{ surface: 'hero' }}
              className="inline-flex items-center gap-1.5 text-text-secondary hover:text-white text-sm font-mono tracking-[0.05em] transition-colors"
            >
              Browse all 167 teams
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
              </svg>
            </TrackedTapLink>
          </div>
        </div>
      </section>

      <section className="px-6 py-4">
        <AdSlot config={AD_SLOTS.HEADER_LEADERBOARD} pageType="homepage" />
      </section>

      {/* This Week */}
      <ThisWeekStrip promos={weekPromos} today={today} />

      {/* Browse Collections */}
      <BrowseCollections tiles={collectionTiles} />

      <section className="px-6 py-6 border-t border-border-subtle">
        <AdSlot config={AD_SLOTS.RECIRC_NATIVE} pageType="homepage" />
      </section>

      {/* Find Your Team */}
      <section className="py-16 px-6 border-t border-border-subtle">
        <div className="max-w-6xl mx-auto">
          <div className="flex items-end justify-between mb-8 gap-4">
            <div>
              <span className="font-mono text-[10px] tracking-[1.5px] uppercase text-accent-red">
                Find your team
              </span>
              <h2 className="font-display text-3xl md:text-4xl tracking-[1px] mt-2">
                167 TEAMS ACROSS 6 LEAGUES
              </h2>
            </div>
            <Link
              href="/teams"
              className="hidden md:inline-flex items-center gap-1 text-accent-red text-sm font-mono hover:underline flex-shrink-0"
            >
              View all 167 teams
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
              </svg>
            </Link>
          </div>

          <TeamGrid
            teams={teamsForGrid}
            promoCounts={teamPromoCounts}
            limitOnAll={12}
            countLabel="upcoming"
            surface="homepage"
          />

          <div className="mt-8 text-center md:hidden">
            <Link
              href="/teams"
              className="inline-flex items-center gap-1 text-accent-red text-sm font-mono hover:underline"
            >
              View all 167 teams
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
              </svg>
            </Link>
          </div>
        </div>
      </section>

      {/* Built by Matt */}
      <IndieDeveloperBlock />

      {/* App download — single small section */}
      <section className="py-16 px-6 border-t border-border-subtle">
        <div className="max-w-4xl mx-auto">
          <div className="bg-bg-card border border-border-subtle rounded-2xl p-8 md:p-10">
            <span className="font-mono text-[10px] tracking-[1.5px] uppercase text-accent-red">
              Promo push
            </span>
            <h2 className="font-display text-2xl md:text-3xl tracking-[1px] mt-2 mb-4">
              WANT NOTIFICATIONS THE MORNING OF EVERY PROMO?
            </h2>
            <p className="text-text-secondary text-sm md:text-base leading-relaxed max-w-2xl mb-6">
              The PromoNight app sends a push the morning of every promo for
              your starred teams. Free to download. Web has everything else.
            </p>
            <AppDownloadButtons section="homepage_app_section" page="home" />
          </div>
        </div>
      </section>

      {/* FAQ */}
      <HomepageFAQ />

      <section className="px-6 py-4">
        <AdSlot config={AD_SLOTS.ADHESION_FOOTER} pageType="homepage" />
      </section>
    </>
  );
}
