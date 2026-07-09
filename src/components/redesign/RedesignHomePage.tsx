import Link from 'next/link';
import {
  IconArrowRight,
  IconChevronRight,
  IconFlame,
  type Icon as TablerIcon,
} from '@tabler/icons-react';
import type { PromoType, PromoWithTeam, Team } from '@/lib/types';
import type { GameContext } from '@/lib/data';

import { archivoHouse } from './fonts-house';
import { RD_CATEGORIES } from './categories';
import { HeroTonightCard } from './HeroTonightCard';
import { LightHomePromoCard } from './LightHomePromoCard';
import { UpcomingPromoModalProvider } from './UpcomingPromoModal';

import type { HeroBuckets } from '@/components/tonight-strip';
import { HomepageJsonLd } from '@/components/homepage-json-ld';
import { TeamGrid } from '@/components/team-grid';
import { AppDownloadButtons } from '@/components/app-download-buttons';
import { FollowCTA } from '@/components/follow/FollowCTA';
import { IndieDeveloperBlock } from '@/components/indie-developer-block';
import { HomepageFAQ } from '@/components/homepage-faq';
import { TrackedTapLink } from '@/components/analytics/TrackedTapLink';
import { AdSlot } from '@/components/ads/AdSlot';
import { AD_SLOTS } from '@/lib/ads/slots';

// The redesign's consolidated Browse-Collections tile. `key` drives the color +
// Tabler icon (giveaway/theme/food reuse RD_CATEGORIES; hot is brand red + flame).
export interface RedesignCollectionTile {
  key: PromoType | 'hot';
  label: string;
  count: number;
  href: string;
  trackName: 'giveaways' | 'theme_nights' | 'food_deals' | 'hot_this_week';
}

export interface RedesignHomePageProps {
  heroBuckets: HeroBuckets;
  weekPromos: PromoWithTeam[];
  collectionTiles: RedesignCollectionTile[];
  teamsForGrid: Team[];
  teamPromoCounts: Record<string, number>;
  promoCount: number;
  /** Total pro teams, DERIVED from getAllTeams().length in page.tsx (never
   *  hardcoded) — the "N teams" headline. CFB is a separate stream and is not
   *  counted here. */
  teamCount: number;
  lastUpdated: string;
  /** Resolved home-game context(s) for the upcoming-promo cards, keyed
   *  `${team.id}:${date}`. Built server-side in page.tsx (MLB/NFL only); promos
   *  with no entry render the legacy promo detail in the modal. */
  resolvedContexts: Map<string, GameContext[]>;
}

const HERO_INK = '#1d1714'; // charcoal, matching the team-page hero base

function tileVisual(key: PromoType | 'hot'): { color: string; Icon: TablerIcon } {
  if (key === 'hot') return { color: '#da2d20', Icon: IconFlame };
  const meta = RD_CATEGORIES[key];
  return { color: meta.color, Icon: meta.Icon };
}

export function RedesignHomePage({
  heroBuckets,
  weekPromos,
  collectionTiles,
  teamsForGrid,
  teamPromoCounts,
  promoCount,
  teamCount,
  lastUpdated,
  resolvedContexts,
}: RedesignHomePageProps) {
  const contextsFor = (p: PromoWithTeam): GameContext[] | null =>
    resolvedContexts.get(`${p.team.id}:${p.date}`) ?? null;
  const tonight = heroBuckets.tonight;
  // Up to 4 tonight promos in the hero. Cards 3-4 are hidden below `lg`, so
  // mobile/tablet shows the same 2 cards as before; desktop shows a 2x2 grid.
  const heroTonight = tonight.slice(0, 4);

  // This Week grouped by date (mirrors the live strip's structure).
  const weekByDate = new Map<string, PromoWithTeam[]>();
  for (const p of weekPromos) {
    const list = weekByDate.get(p.date) ?? [];
    list.push(p);
    weekByDate.set(p.date, list);
  }
  const weekGroups = Array.from(weekByDate.entries()).sort(([a], [b]) => a.localeCompare(b));
  const dayLabel = (d: string) =>
    new Date(d + 'T12:00:00').toLocaleDateString('en-US', {
      weekday: 'long',
      month: 'long',
      day: 'numeric',
    });

  return (
    <UpcomingPromoModalProvider showTeamLink>
    <div className={`${archivoHouse.variable} rd-root min-h-screen`}>
      <HomepageJsonLd />

      {/* HERO — dark charcoal house, no team tint */}
      <section className="relative overflow-hidden text-white" style={{ backgroundColor: HERO_INK }}>
        <div
          aria-hidden
          className="absolute inset-0 z-0 opacity-60"
          style={{
            backgroundImage:
              'radial-gradient(120% 80% at 100% 0%, rgba(218,45,32,0.18) 0%, transparent 60%)',
          }}
        />
        <div className="relative z-10 mx-auto max-w-6xl px-6 pb-12 pt-16 md:pb-16 md:pt-20">
          <h1 className="rd-display text-4xl uppercase leading-[0.95] text-white md:text-6xl">
            Every promo at every game.
          </h1>
          <p className="mt-4 max-w-2xl font-rd text-lg text-white/70">
            {teamCount} teams · 6 leagues · updated daily. Find tonight&apos;s giveaways, theme
            nights, and food deals.
          </p>
          <p className="mt-3 font-rd text-[11px] uppercase tracking-[0.12em] text-white/45">
            {promoCount.toLocaleString()} promos tracked · Last updated {lastUpdated}
          </p>

          {heroTonight.length > 0 && (
            <>
              <div className="mt-8 flex items-center gap-2">
                <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-rd-red" />
                <span className="font-rd text-[11px] font-semibold uppercase tracking-[0.15em] text-white/70">
                  Tonight
                </span>
              </div>
              <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2">
                {heroTonight.map((promo, i) => (
                  <HeroTonightCard
                    key={`${promo.team.id}-${i}`}
                    promo={promo}
                    contexts={contextsFor(promo)}
                    className={i >= 2 ? 'hidden lg:block' : ''}
                  />
                ))}
              </div>
              <TrackedTapLink
                href="/promos/this-week"
                trackEvent="this_week_see_all_tap"
                trackProps={{ surface: 'web_home' }}
                className="mt-4 inline-flex items-center gap-1.5 font-rd text-[12px] font-semibold uppercase tracking-[0.1em] text-rd-red transition-opacity hover:opacity-80"
              >
                See all {tonight.length} promo{tonight.length === 1 ? '' : 's'} tonight
                <IconArrowRight size={15} stroke={2.25} />
              </TrackedTapLink>
            </>
          )}

          <div className="mt-6">
            <TrackedTapLink
              href="/teams"
              trackEvent="browse_all_teams_tap"
              trackProps={{ surface: 'hero' }}
              className="inline-flex items-center gap-1.5 font-rd text-sm text-white/65 transition-colors hover:text-white"
            >
              Browse all {teamCount} teams
              <IconArrowRight size={15} stroke={2} />
            </TrackedTapLink>
          </div>
        </div>
      </section>

      <div className="mx-auto max-w-6xl px-6 pt-6">
        <AdSlot config={AD_SLOTS.HEADER_LEADERBOARD} pageType="homepage" />
      </div>

      {/* BROWSE COLLECTIONS — light, 4 category tiles */}
      <section className="py-16 px-6">
        <div className="mx-auto max-w-5xl">
          <span className="font-rd text-[11px] uppercase tracking-[0.14em] text-rd-ink-faint">
            Browse
          </span>
          <h2 className="rd-display mt-1 text-3xl text-rd-ink md:text-4xl">COLLECTIONS</h2>

          <div className="mt-8 grid grid-cols-1 gap-4 sm:grid-cols-2">
            {collectionTiles.map((tile) => {
              const { color, Icon } = tileVisual(tile.key);
              return (
                <TrackedTapLink
                  key={tile.trackName}
                  href={tile.href}
                  trackEvent="collection_tile_tap"
                  trackProps={{
                    surface: 'web_home',
                    collection_name: tile.trackName,
                    collection_count: tile.count,
                  }}
                  className="group flex items-center justify-between gap-4 rounded-2xl bg-rd-card p-5 transition-colors"
                  style={{ border: `2px solid ${color}` }}
                >
                  <div className="flex items-center gap-4">
                    <span
                      className="grid h-11 w-11 shrink-0 place-items-center rounded-xl"
                      style={{ backgroundColor: `${color}14` }}
                    >
                      <Icon size={22} stroke={2} style={{ color }} />
                    </span>
                    <div>
                      <div className="rd-display text-lg uppercase text-rd-ink">{tile.label}</div>
                      <div className="font-rd text-xs text-rd-ink-faint">
                        {tile.count.toLocaleString()} {tile.count === 1 ? 'promo' : 'promos'}
                      </div>
                    </div>
                  </div>
                  <IconChevronRight
                    size={20}
                    stroke={2}
                    className="shrink-0 text-rd-ink-faint transition-transform group-hover:translate-x-0.5"
                  />
                </TrackedTapLink>
              );
            })}
          </div>
        </div>
      </section>

      {/* The body "Live tonight" list was removed: the hero now carries tonight on
          both viewports (up to 4 cards), so the block was redundant. Hero cards open
          the shared game modal (no tonight_card_tap; game_tap/promo_card_tap fire on
          open). The crawl path to the full tonight list is preserved via the hero
          "See all" link to this-week (now this_week_see_all_tap). */}

      {/* THIS WEEK */}
      {weekGroups.length > 0 && (
        <section className="px-6 py-16">
          <div className="mx-auto max-w-5xl">
            <div className="mb-8 flex items-end justify-between gap-4">
              <div>
                <span className="font-rd text-[11px] uppercase tracking-[0.14em] text-rd-ink-faint">
                  Coming up
                </span>
                <h2 className="rd-display mt-1 text-3xl text-rd-ink md:text-4xl">THIS WEEK</h2>
              </div>
              <TrackedTapLink
                href="/promos/this-week"
                trackEvent="this_week_see_all_tap"
                trackProps={{ surface: 'web_home' }}
                className="inline-flex shrink-0 items-center gap-1 font-rd text-sm font-semibold text-rd-red hover:underline"
              >
                See all
                <IconArrowRight size={15} stroke={2.25} />
              </TrackedTapLink>
            </div>

            <div className="space-y-8">
              {weekGroups.map(([date, list]) => (
                <div key={date}>
                  <h3 className="mb-3 font-rd text-[11px] uppercase tracking-[0.1em] text-rd-ink-faint">
                    {dayLabel(date)}
                  </h3>
                  <div className="grid grid-cols-1 gap-2.5 lg:grid-cols-2">
                    {list.map((promo, i) => (
                      <LightHomePromoCard
                        key={`${promo.team.id}-w-${i}`}
                        promo={promo}
                        contexts={contextsFor(promo)}
                        surface="web_home_this_week"
                        starPlacement="homepage_this_week_inline"
                      />
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>
      )}

      <div className="mx-auto max-w-6xl px-6 py-2">
        <AdSlot config={AD_SLOTS.RECIRC_NATIVE} pageType="homepage" />
      </div>

      {/* FIND YOUR TEAM */}
      <section className="px-6 py-16">
        <div className="mx-auto max-w-6xl">
          <div className="mb-8 flex items-end justify-between gap-4">
            <div>
              <span className="font-rd text-[11px] uppercase tracking-[0.14em] text-rd-ink-faint">
                Explore
              </span>
              <h2 className="rd-display mt-1 text-3xl text-rd-ink md:text-4xl">FIND YOUR TEAM</h2>
            </div>
            <Link
              href="/teams"
              className="hidden shrink-0 items-center gap-1 font-rd text-sm font-semibold text-rd-red hover:underline md:inline-flex"
            >
              View all {teamCount} teams
              <IconArrowRight size={15} stroke={2.25} />
            </Link>
          </div>

          <TeamGrid
            teams={teamsForGrid}
            promoCounts={teamPromoCounts}
            limitOnAll={12}
            countLabel="upcoming"
            surface="homepage"
            variant="light"
          />
        </div>
      </section>

      {/* EMAIL CAPTURE: primary web conversion; tags the funnel web_homepage. */}
      <section className="px-6 pb-4">
        <div className="mx-auto max-w-3xl">
          <FollowCTA surface="web_homepage" />
        </div>
      </section>

      {/* BUILT BY MATT */}
      <IndieDeveloperBlock variant="light" />

      {/* APP DOWNLOAD — small, secondary */}
      <section className="border-t border-rd-line px-6 py-14">
        <div className="mx-auto max-w-3xl text-center">
          <span className="font-rd text-[11px] uppercase tracking-[0.14em] text-rd-ink-faint">
            Promo push
          </span>
          <h2 className="rd-display mx-auto mt-1 max-w-xl text-2xl text-rd-ink md:text-3xl">
            NOTIFICATIONS THE MORNING OF EVERY PROMO
          </h2>
          <p className="mx-auto mt-3 max-w-xl font-rd text-sm text-rd-ink-soft">
            The free PromoNight app pushes the morning of every promo for your starred
            teams. The web has everything else.
          </p>
          <div className="mt-6 flex justify-center">
            <AppDownloadButtons section="homepage_app_section" page="home" variant="compact" />
          </div>
        </div>
      </section>

      {/* FAQ */}
      <HomepageFAQ variant="light" />

      <div className="mx-auto max-w-6xl px-6 py-4">
        <AdSlot config={AD_SLOTS.ADHESION_FOOTER} pageType="homepage" />
      </div>
    </div>
    </UpcomingPromoModalProvider>
  );
}
