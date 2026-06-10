import type { Team, Venue, Promo, PromoType, PlayoffPromo } from '@/lib/types';
import type { GameContext } from '@/lib/data';
import type { PlayoffFAQContext } from '@/lib/promo-helpers';
import type { RecurringDeal } from '@/lib/recurring-deals';

import { archivo } from './fonts';
import { Hero } from './Hero';
import { StatScoreboard } from './StatScoreboard';
import { SeasonExplorer } from './SeasonExplorer';
import { AffiliateRail } from './AffiliateRail';
import { ExploreCard } from './ExploreCard';

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
import { FollowCTA } from '@/components/follow/FollowCTA';
import { AppPushPitch } from '@/components/app-push-pitch';

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
 * sections weave into one column (hero · calendar · affiliate stack · plan-your-
 * day venue · promos · recurring · explore · SEO block); on desktop the affiliate
 * stack + explore are the sticky-free right sidebar. The reused SEO/analytics surfaces (JsonLd,
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

      {/* Chrome (BrandBar + Footer) is rendered globally by app/layout.tsx when
          the gate is on — this component renders only its content sections. */}

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

      {/* Responsive weave — one DOM, two layouts.
       *
       *  DESKTOP (lg+): the exact two-column layout is unchanged. The
       *  <aside>/<main> wrappers are restored at lg (`lg:block`), so their
       *  children flow in source order inside the right sidebar / left main
       *  column and every `order-[n]` utility below goes INERT (order only
       *  affects flex/grid items). Source order == today's desktop order, so
       *  the desktop render is byte-for-byte identical.
       *
       *  MOBILE (<lg): both wrappers collapse to `display:contents`, so every
       *  section becomes a direct item of this single-column grid and the
       *  `order-[n]` values weave the sidebar pieces into the main flow:
       *    calendar · affiliate stack · plan-your-day venue · upcoming promos ·
       *    recurring deals · explore + browse · by-the-numbers · capsules · FAQ.
       *  DOM order is left untouched (sidebar grouped first, then main), so
       *  crawlers and screen readers still get the upcoming-promos and venue
       *  content in the body — never pushed to the end of the HTML.
       *
       *  Mobile row-gap is dropped (`gap-x-8` keeps only the desktop column
       *  gap) because each main section self-spaces with its own py-* ; the one
       *  exception is the affiliate stack, which gets `mt-10` to clear the
       *  calendar above it (reset to `lg:mt-0` back in the sidebar). */}
      <div className="mx-auto max-w-6xl px-6 pb-8">
        <div className="grid grid-cols-1 gap-x-8 lg:grid-cols-[1fr_336px] lg:items-start">
          <aside className="contents lg:block lg:space-y-6 lg:order-2 [&>*]:min-w-0">
            <AffiliateRail team={team} venue={venue} className="order-[20] mt-10 lg:mt-0" />
            <ExploreCard team={team} className="order-[60]" />
            <AdSlot config={AD_SLOTS.SIDEBAR_STICKY} pageType="team_page" className="order-[62]" />
          </aside>

          <main className="contents lg:block lg:min-w-0 lg:order-1 [&>*]:min-w-0">
            <div className="order-[30] pb-4">
              <AdSlot config={AD_SLOTS.TEAM_PAGE_AFTER_HERO} pageType="team_page" />
            </div>

            {/* NFL schedule-release video (light) — preserves cta_click. */}
            {team.league === 'NFL' && team.scheduleReleaseVideo && (
              <div className="order-[31]">
                <ScheduleReleaseVideoCard video={team.scheduleReleaseVideo} teamSlug={team.id} variant="light" />
              </div>
            )}

            {/* Playoffs (light), when active. */}
            {inPlayoffs && playoffPromos.length > 0 && (
              <div className="order-[32]">
                <PlayoffSection
                  team={team}
                  promos={playoffPromos}
                  round={playoffRound}
                  lastUpdated={playoffLastUpdated}
                  variant="light"
                />
              </div>
            )}

            <div className="order-[10]">
              <SeasonExplorer
                promos={promos}
                promoCounts={promoCounts}
                teamName={displayName}
                teamSlug={team.id}
                sport={team.league}
                team={team}
                gameContexts={gameContexts}
              />
            </div>

            {/* Full promo list — upcoming + completed, with show-all. */}
            <div className="order-[40]">
              <PromoList
                promos={promos}
                teamSlug={team.id}
                teamName={displayName}
                sport={team.sportSlug}
                primaryColor={team.primaryColor}
                venueName={venue?.name ?? null}
                variant="light"
                showAppPitch={false}
              />
            </div>

            <div className="order-[70]">
              <AuthorityStats
                team={team}
                promos={promos}
                promoCounts={promoCounts}
                venue={venue}
                teamName={displayName}
                variant="light"
              />
            </div>

            <div className="order-[50]">
              <RecurringDealsSection
                team={team}
                deals={recurringDeals}
                venueName={venue?.name ?? null}
                variant="light"
              />
            </div>

            <div className="order-[71]">
              <TeamContentSections
                team={team}
                promos={promos}
                venue={venue}
                promoCounts={promoCounts}
                variant="light"
              />
            </div>

            <div className="order-[61]">
              <TeamRelatedAggregators promos={promos} variant="light" />
            </div>

            {/* Email + app conversion pairing, lifted directly above the FAQ.
                Email first (pre-stars this team, tags web_team_page, fires
                email_cta_click), then the app push pitch moved out of PromoList. */}
            <div className="order-[72]">
              <div className="mx-auto max-w-3xl px-6 py-8">
                <FollowCTA surface="web_team_page" team={team} />
                <AppPushPitch variant="light" teamName={displayName} teamSlug={team.id} />
              </div>
            </div>

            <div className="order-[73]">
              <TeamFAQ
                team={team}
                promos={promos}
                venue={venue}
                promoCounts={promoCounts}
                playoffContext={playoffContext}
                variant="light"
              />
            </div>

            <div className="order-[80] py-6">
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
    </div>
  );
}
