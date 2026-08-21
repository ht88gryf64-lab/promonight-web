import { IconArrowRight } from '@tabler/icons-react';
import type { PromoWithTeam, Team } from '@/lib/types';
import type { GameContext } from '@/lib/data';
import type { HeroBuckets } from '@/components/tonight-strip';
import type { VenueUtilityCounts } from '@/lib/venue-hub';

import { archivoHouse } from './fonts-house';
import { UpcomingPromoModalProvider } from './UpcomingPromoModal';
import { LightHomePromoCard } from './LightHomePromoCard';
import { HomeHero, type HomeHeroStat } from './HomeHero';
import { TonightRibbon } from './TonightRibbon';
import { StubRail } from './StubRail';
import { HomeCategoryGrid } from './HomeCategoryGrid';
import type { HomeCategoryTile } from './home-category-tiles';
import { GamedayUtilityGrid } from './GamedayUtilityGrid';
import { AppDownloadBlock } from './AppDownloadBlock';
import { FounderBlock } from './FounderBlock';

import { HomepageJsonLd, type HomepageCounts } from '@/components/homepage-json-ld';
import { TeamGrid } from '@/components/team-grid';
import { FollowCTA } from '@/components/follow/FollowCTA';
import { HomepageFAQ } from '@/components/homepage-faq';
import { TrackedTapLink } from '@/components/analytics/TrackedTapLink';
import { AdSlot } from '@/components/ads/AdSlot';
import { AD_SLOTS } from '@/lib/ads/slots';

// The assembled redesign homepage. COMPOSITION ONLY: every section below is an
// existing component rendered in the reviewed order, with one exception noted
// at the This Week block. Nothing here is wired into the live route yet; the
// swap happens in its own commit after this assembly is reviewed.
//
// Section order, as specified: hero, ribbon, tonight rail, ad slot A, this
// week, best promos rail, category grid, team finder, ad slot B, gameday grid,
// app block, newsletter strip, founder block, FAQ, adhesion footer slot.
//
// AD SLOTS, final: three, unchanged in count. HEADER_LEADERBOARD LEAVES IN
// PLACE. It already sat at the hero-to-next-section boundary; the tonight rail
// now occupies that gap, so the slot follows the rail without moving relative
// to the page structure. RECIRC_NATIVE is the one that moves, from above the
// team finder to below it. ADHESION_FOOTER is unchanged at the end.
//
// No registry row changes. docs/ad-slots-registry.md rows describe slot
// CONFIG (sizes, lazy, tier, status), not mount position, so a placement move
// is not representable as a row edit and the deprecate-only rule is moot here.
// The homepage placement order is recorded in that file as a note instead.

export interface HomePageV2Props {
  heroBuckets: HeroBuckets;
  weekPromos: PromoWithTeam[];
  /** Top-N future promos by stored score. Empty hides the rail. */
  bestPromos: PromoWithTeam[];
  categoryTiles: HomeCategoryTile[];
  teamsForGrid: Team[];
  teamPromoCounts: Record<string, number>;
  /** League tab order derived from live inventory, not a hardcoded list. */
  leagueOrder: string[];
  venueCounts: VenueUtilityCounts;
  /** Total pro teams, derived from getAllTeams().length. */
  teamCount: number;
  /** Distinct leagues among those teams, derived. */
  leagueCount: number;
  /** League names for the founder prose, ordered by the caller. */
  leagueNames: string[];
  heroStats: HomeHeroStat[];
  /** Derived coverage facts shared by the hero, the visible FAQ, and the
   *  FAQPage schema. */
  counts: HomepageCounts;
  resolvedContexts: Map<string, GameContext[]>;
}

export function HomePageV2({
  heroBuckets,
  weekPromos,
  bestPromos,
  categoryTiles,
  teamsForGrid,
  teamPromoCounts,
  leagueOrder,
  venueCounts,
  teamCount,
  leagueCount,
  leagueNames,
  heroStats,
  counts,
  resolvedContexts,
}: HomePageV2Props) {
  const contextsFor = (p: PromoWithTeam): GameContext[] | null =>
    resolvedContexts.get(`${p.team.id}:${p.date}`) ?? null;

  const tonight = heroBuckets.tonight;

  // This Week grouped by date. This block is the one piece carried over as
  // markup rather than as a component, because it only ever existed inline in
  // RedesignHomePage. The copy in that file goes dead at the swap commit.
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
        <HomepageJsonLd counts={counts} />

        <HomeHero teamCount={teamCount} leagueCount={leagueCount} stats={heroStats} />

        {/* Decorative, aria-hidden, hides when tonight is empty, suppressed
            entirely under prefers-reduced-motion. */}
        <TonightRibbon items={tonight} />

        <section className="px-6 pt-14">
          <StubRail
            eyebrow="Happening now"
            dotColor="var(--color-rd-red)"
            heading="Tonight"
            lede={`${tonight.length} promo${tonight.length === 1 ? '' : 's'} at games starting today.`}
            seeAllHref="/promos/today"
            seeAllLabel="All tonight's promos"
            items={tonight.map((p) => ({ promo: p, contexts: contextsFor(p) }))}
            surface="web_home_tonight"
            starPlacement="homepage_this_week_inline"
          />
        </section>

        <div className="mx-auto max-w-6xl px-6 pt-8">
          <AdSlot config={AD_SLOTS.HEADER_LEADERBOARD} pageType="homepage" />
        </div>

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

        <section className="px-6 py-4">
          <StubRail
            eyebrow="Worth planning around"
            dotColor="var(--color-rd-cat-giveaway)"
            heading="Best Promos"
            lede="The giveaways fans line up early for."
            seeAllHref="/best-promos"
            seeAllLabel="Full rankings"
            items={bestPromos.map((p) => ({ promo: p, contexts: contextsFor(p) }))}
            surface="web_home_best"
            starPlacement="homepage_this_week_inline"
            withRank
          />
        </section>

        <section className="py-16">
          <HomeCategoryGrid tiles={categoryTiles} />
        </section>

        <section className="px-6 py-16">
          <div className="mx-auto max-w-6xl">
            <div className="mb-7">
              <div className="mb-2 flex items-center gap-2 font-mono text-[10.5px] font-semibold uppercase tracking-[0.22em] text-rd-ink-faint">
                <span aria-hidden className="h-1.5 w-1.5 flex-none rounded-full bg-rd-red" />
                Explore
              </div>
              <h2 className="rd-display text-3xl uppercase text-rd-ink md:text-4xl">
                Find Your Team
              </h2>
              <p className="mt-2 max-w-md font-rd text-sm text-rd-ink-soft">
                Full promo calendars for all {teamCount} teams.
              </p>
            </div>
            <TeamGrid
              teams={teamsForGrid}
              promoCounts={teamPromoCounts}
              limitOnAll={12}
              countLabel="upcoming"
              surface="homepage"
              variant="light"
              leagueOrder={leagueOrder}
            />
          </div>
        </section>

        <div className="mx-auto max-w-6xl px-6 py-2">
          <AdSlot config={AD_SLOTS.RECIRC_NATIVE} pageType="homepage" />
        </div>

        <section className="py-16">
          <GamedayUtilityGrid counts={venueCounts} />
        </section>

        <section className="py-6">
          <AppDownloadBlock />
        </section>

        <section className="px-6 py-10">
          <div className="mx-auto max-w-6xl">
            <FollowCTA surface="web_homepage" layout="split" />
          </div>
        </section>

        <section className="py-16">
          <FounderBlock teamCount={teamCount} leagues={leagueNames} />
        </section>

        <HomepageFAQ variant="light" layout="card" counts={counts} />

        <div className="mx-auto max-w-6xl px-6 py-4">
          <AdSlot config={AD_SLOTS.ADHESION_FOOTER} pageType="homepage" />
        </div>
      </div>
    </UpcomingPromoModalProvider>
  );
}
