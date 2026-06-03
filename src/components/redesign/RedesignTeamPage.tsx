import type { Team, Venue, Promo, PromoType, PlayoffPromo } from '@/lib/types';
import type { GameContext } from '@/lib/data';
import type { PlayoffFAQContext } from '@/lib/promo-helpers';

import { archivo } from './fonts';
import { BrandBar } from './BrandBar';
import { Hero } from './Hero';
import { StatScoreboard } from './StatScoreboard';
import { SeasonExplorer } from './SeasonExplorer';
import { AffiliateRail } from './AffiliateRail';
import { ExploreCard } from './ExploreCard';
import { Footer } from './Footer';

// Reused verbatim from the live template so SEO + analytics are preserved.
import { JsonLd } from '@/components/json-ld';
import { TeamPageTracker } from '@/components/analytics-events';
import { EngagementTracker } from '@/components/analytics/EngagementTracker';
import { TeamContentSections } from '@/components/team-content-sections';
import { TeamFAQ } from '@/components/team-faq';
import { PlayoffSection } from '@/components/playoff-section';
import { AffiliateDisclosure } from '@/components/affiliates/AffiliateDisclosure';
import { TicketmasterCTA } from '@/components/affiliates/TicketmasterCTA';
import { AdSlot } from '@/components/ads/AdSlot';
import { AD_SLOTS } from '@/lib/ads/slots';

export interface RedesignTeamPageProps {
  team: Team;
  venue: Venue | null;
  promos: Promo[];
  promoCounts: Record<PromoType, number>;
  displayName: string;
  gameContexts?: GameContext[];
  playoffsActive: boolean;
  inPlayoffs: boolean;
  playoffPromos: PlayoffPromo[];
  playoffRound: string;
  playoffLastUpdated: string | null;
  playoffContext?: PlayoffFAQContext;
}

/**
 * Gate-ON team page. Assembles the new light template from the redesign
 * components, fed by the SAME data the page already fetched. The SEO + analytics
 * surfaces (JsonLd, TeamPageTracker, EngagementTracker, TeamContentSections,
 * TeamFAQ, the five AdSlots) are reused verbatim so their output is equivalent
 * to the live page. The dark-styled reused content (question-H2s, FAQ) is housed
 * in a charcoal band so it renders readable on the otherwise-light page.
 */
export function RedesignTeamPage({
  team,
  venue,
  promos,
  promoCounts,
  displayName,
  gameContexts,
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
      {/* SEO + analytics — reused verbatim, invisible chrome. */}
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

      {/* Header leaderboard ad (page_type team_page → ad_slot_viewed preserved). */}
      <div className="mx-auto max-w-6xl px-6 pt-4">
        <AdSlot config={AD_SLOTS.HEADER_LEADERBOARD} pageType="team_page" />
      </div>

      <Hero
        tint={team.primaryColor}
        eyebrow={eyebrow}
        title={displayName.toUpperCase()}
        subtitle="Promos & Giveaways 2026"
        venueLine={venue?.name ?? undefined}
        primaryCta={
          <TicketmasterCTA
            team={team}
            surface="web_team_page"
            placement="team_page_hero"
            size="full"
          />
        }
        scoreboard={
          <StatScoreboard counts={promoCounts} gamesCount={gameContexts?.length} />
        }
      />

      <div className="mx-auto max-w-6xl px-6 py-4">
        <AdSlot config={AD_SLOTS.TEAM_PAGE_AFTER_HERO} pageType="team_page" />
      </div>

      {/* Two-column on desktop; single column on mobile. */}
      <div className="mx-auto max-w-6xl px-6 pb-12">
        <div className="grid grid-cols-1 lg:grid-cols-[1fr_336px] gap-8">
          <main className="min-w-0 space-y-8">
            <SeasonExplorer
              promos={promos}
              promoCounts={promoCounts}
              teamName={displayName}
              teamSlug={team.id}
              sport={team.league}
              team={team}
              gameContexts={gameContexts}
            />
            <AdSlot config={AD_SLOTS.IN_CONTENT_1} pageType="team_page" />
          </main>

          <aside className="space-y-6 lg:sticky lg:top-20 self-start">
            {/* Tickets */}
            <div className="rounded-2xl border border-rd-line bg-rd-card p-5">
              <div className="font-rd text-[11px] uppercase tracking-[0.14em] text-rd-ink-faint mb-3">
                Tickets
              </div>
              <TicketmasterCTA
                team={team}
                surface="web_team_page"
                placement="team_page_sidebar"
                size="full"
              />
            </div>

            {/* Plan your visit (parking / hotels / fan gear / gate time) */}
            <AffiliateRail team={team} venue={venue} />

            <ExploreCard team={team} />

            <AdSlot config={AD_SLOTS.SIDEBAR_STICKY} pageType="team_page" />
          </aside>
        </div>
      </div>

      {/* Dark content band — reused dark-styled SEO content (question-H2s, FAQ,
       *  playoff section) rendered verbatim so its output is equivalent to the
       *  live page; the charcoal backing makes the light-on-dark text readable. */}
      <div className="bg-rd-ink text-white">
        {inPlayoffs && playoffPromos.length > 0 && (
          <PlayoffSection
            team={team}
            promos={playoffPromos}
            round={playoffRound}
            lastUpdated={playoffLastUpdated}
          />
        )}
        <TeamContentSections
          team={team}
          promos={promos}
          venue={venue}
          promoCounts={promoCounts}
        />
        <TeamFAQ
          team={team}
          promos={promos}
          venue={venue}
          promoCounts={promoCounts}
          playoffContext={playoffContext}
        />
        <div className="py-8 px-6">
          <div className="max-w-3xl mx-auto">
            <AffiliateDisclosure />
          </div>
        </div>
      </div>

      <div className="mx-auto max-w-6xl px-6 py-4">
        <AdSlot config={AD_SLOTS.ADHESION_FOOTER} pageType="team_page" />
      </div>

      <Footer />
    </div>
  );
}
