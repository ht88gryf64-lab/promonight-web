import type { Team, Venue, Promo, PromoType, PlayoffPromo } from '@/lib/types';
import type { GameContext } from '@/lib/data';
import type { PlayoffFAQContext } from '@/lib/promo-helpers';
import type { RecurringDeal } from '@/lib/recurring-deals';

import { archivo } from './fonts';
import { BrandBar } from './BrandBar';
import { Hero } from './Hero';
import { StatScoreboard } from './StatScoreboard';
import { SeasonExplorer } from './SeasonExplorer';
import { AffiliateRail } from './AffiliateRail';
import { ExploreCard } from './ExploreCard';
import { Footer } from './Footer';

// Reused components — light variant (default 'dark' is the untouched gate-off
// path). SEO + analytics preserved; restyled into the cream flow (no dark band).
import { JsonLd } from '@/components/json-ld';
import { TeamPageTracker } from '@/components/analytics-events';
import { EngagementTracker } from '@/components/analytics/EngagementTracker';
import { TeamContentSections } from '@/components/team-content-sections';
import { TeamFAQ } from '@/components/team-faq';
import { AuthorityStats } from '@/components/authority-stats';
import { RecurringDealsSection } from '@/components/recurring-deals-section';
import { TeamRelatedAggregators } from '@/components/team-related-aggregators';
import { PromoList } from '@/components/promo-list';
import { PlayoffSection } from '@/components/playoff-section';
import { ScheduleReleaseVideoCard } from '@/components/ScheduleReleaseVideoCard';
import { AffiliateDisclosure } from '@/components/affiliates/AffiliateDisclosure';
import { AdSlot } from '@/components/ads/AdSlot';
import { AD_SLOTS } from '@/lib/ads/slots';

export interface RedesignTeamPageProps {
  team: Team;
  venue: Venue | null;
  promos: Promo[];
  promoCounts: Record<PromoType, number>;
  displayName: string;
  gameContexts?: GameContext[];
  recurringDeals: RecurringDeal[];
  playoffsActive: boolean;
  inPlayoffs: boolean;
  playoffPromos: PlayoffPromo[];
  playoffRound: string;
  playoffLastUpdated: string | null;
  playoffContext?: PlayoffFAQContext;
}

/**
 * Gate-ON team page. Everything lives in the light "house" (cream surface, white
 * cards, warm-charcoal ink) — no dark content band. The single tickets CTA is in
 * the affiliate stack (the hero Get Tickets button was removed). On mobile the
 * affiliate stack sits directly below the hero (above the calendar); on desktop
 * it is the sticky-free right sidebar. The reused SEO/analytics surfaces (JsonLd,
 * trackers, TeamContentSections question-H2s, TeamFAQ, the five AdSlots, the full
 * PromoList) are preserved and rendered in their light variants.
 */
export function RedesignTeamPage({
  team,
  venue,
  promos,
  promoCounts,
  displayName,
  gameContexts,
  recurringDeals,
  playoffsActive,
  inPlayoffs,
  playoffPromos,
  playoffRound,
  playoffLastUpdated,
  playoffContext,
}: RedesignTeamPageProps) {
  const eyebrow = [team.league, team.division].filter(Boolean).join(' · ');

  return (
    <div className={`${archivo.variable} rd-root min-h-screen`}>
      {/* SEO + analytics — reused verbatim, invisible. */}
      <JsonLd
        team={team}
        promos={promos}
        venue={venue}
        promoCounts={promoCounts}
        playoffPromos={inPlayoffs ? playoffPromos : undefined}
        playoffContext={playoffContext}
      />
      <TeamPageTracker
        teamSlug={team.id}
        sport={team.league}
        teamName={displayName}
        promoCount={promos.length}
      />
      <EngagementTracker teamSlug={team.id} sport={team.league} />

      <BrandBar playoffsActive={playoffsActive} />

      <div className="mx-auto max-w-6xl px-6 pt-4">
        <AdSlot config={AD_SLOTS.HEADER_LEADERBOARD} pageType="team_page" />
      </div>

      {/* Hero — no Get Tickets button (the affiliate stack is the single tickets CTA). */}
      <Hero
        tint={team.primaryColor}
        eyebrow={eyebrow}
        title={displayName.toUpperCase()}
        subtitle="Promos & Giveaways 2026"
        venueLine={venue?.name ?? undefined}
        scoreboard={<StatScoreboard counts={promoCounts} gamesCount={gameContexts?.length} />}
      />

      <div className="mx-auto max-w-6xl px-6 py-4">
        <AdSlot config={AD_SLOTS.TEAM_PAGE_AFTER_HERO} pageType="team_page" />
      </div>

      {/* NFL schedule-release video (light) — preserves cta_click. */}
      {team.league === 'NFL' && team.scheduleReleaseVideo && (
        <div className="mx-auto max-w-6xl px-6">
          <ScheduleReleaseVideoCard video={team.scheduleReleaseVideo} teamSlug={team.id} variant="light" />
        </div>
      )}

      {/* Playoffs (light), full-width when active. */}
      {inPlayoffs && playoffPromos.length > 0 && (
        <div className="mx-auto max-w-6xl px-6">
          <PlayoffSection
            team={team}
            promos={playoffPromos}
            round={playoffRound}
            lastUpdated={playoffLastUpdated}
            variant="light"
          />
        </div>
      )}

      {/* Two-column. Mobile order: affiliate stack first (directly below hero,
       *  so tickets stay near the top), then the main column. Desktop: main on
       *  the left, affiliate stack + explore on the right. */}
      <div className="mx-auto max-w-6xl px-6 pb-8">
        <div className="grid grid-cols-1 gap-8 lg:grid-cols-[1fr_336px] lg:items-start">
          <aside className="order-1 space-y-6 lg:order-2">
            <AffiliateRail team={team} venue={venue} />
            <ExploreCard team={team} />
            <AdSlot config={AD_SLOTS.SIDEBAR_STICKY} pageType="team_page" />
          </aside>

          <main className="order-2 min-w-0 lg:order-1">
            <SeasonExplorer
              promos={promos}
              promoCounts={promoCounts}
              teamName={displayName}
              teamSlug={team.id}
              sport={team.league}
              team={team}
              gameContexts={gameContexts}
            />

            {/* Full promo list — upcoming + completed, with show-all. */}
            <PromoList
              promos={promos}
              teamSlug={team.id}
              teamName={displayName}
              sport={team.sportSlug}
              primaryColor={team.primaryColor}
              venueName={venue?.name ?? null}
              variant="light"
            />

            <AuthorityStats
              team={team}
              promos={promos}
              promoCounts={promoCounts}
              venue={venue}
              teamName={displayName}
              variant="light"
            />

            <RecurringDealsSection
              team={team}
              deals={recurringDeals}
              venueName={venue?.name ?? null}
              variant="light"
            />

            <TeamContentSections
              team={team}
              promos={promos}
              venue={venue}
              promoCounts={promoCounts}
              variant="light"
            />

            <TeamRelatedAggregators promos={promos} variant="light" />

            <TeamFAQ
              team={team}
              promos={promos}
              venue={venue}
              promoCounts={promoCounts}
              playoffContext={playoffContext}
              variant="light"
            />

            <div className="py-6">
              <AdSlot config={AD_SLOTS.IN_CONTENT_1} pageType="team_page" />
            </div>
          </main>
        </div>
      </div>

      {/* Fine print — minimal treatment in the cream flow (reads fine at #444). */}
      <div className="mx-auto max-w-6xl px-6 pb-8">
        <AffiliateDisclosure className="text-center" />
      </div>

      <div className="mx-auto max-w-6xl px-6 py-4">
        <AdSlot config={AD_SLOTS.ADHESION_FOOTER} pageType="team_page" />
      </div>

      <Footer />
    </div>
  );
}
