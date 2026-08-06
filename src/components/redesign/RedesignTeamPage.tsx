import type { Team, Venue, Promo, PromoType, PlayoffPromo } from '@/lib/types';
import type { GameContext } from '@/lib/data';
import type { PlayoffFAQContext } from '@/lib/promo-helpers';
import type { RecurringDeal } from '@/lib/recurring-deals';

import Link from 'next/link';
import { getLeagueHub } from '@/lib/league-hubs';
import { archivo } from './fonts';
import { Hero } from './Hero';
import { StatScoreboard } from './StatScoreboard';
import { SeasonExplorer } from './SeasonExplorer';
import { ScheduleBlock } from './ScheduleBlock';
import { DivisionRivals } from './DivisionRivals';
import { getDivisionRivals } from '@/lib/division-rivals';
import { UpcomingPromoModalProvider } from './UpcomingPromoModal';
import { AffiliateRail } from './AffiliateRail';
import { ExploreCard } from './ExploreCard';

// Reused components — light variant (default 'dark' is the untouched gate-off
// path). SEO + analytics preserved; restyled into the cream flow (no dark band).
import { JsonLd } from '@/components/json-ld';
import { TeamPageTracker } from '@/components/analytics-events';
import { EngagementTracker } from '@/components/analytics/EngagementTracker';
import { CaptureTriggerHost } from '@/components/capture/CaptureTriggerHost';
import { isCaptureTriggerEnabled } from '@/lib/capture/gate';
import { TeamContentSections } from '@/components/team-content-sections';
import { TeamFAQ } from '@/components/team-faq';
import { AuthorityStats } from '@/components/authority-stats';
import { RecurringDealsSection } from '@/components/recurring-deals-section';
import { TeamRelatedAggregators } from '@/components/team-related-aggregators';
import { PromoList } from '@/components/promo-list';
import { ZeroPromoFallback } from '@/components/zero-promo-fallback';
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
  // The league segment links up to the league hub, but ONLY when that hub is
  // live, so the team page and its hub form a reciprocal loop (hub links down to
  // teams, team links up to hub). The `?.live` gate is load-bearing: WNBA/MLS
  // (and every future league) already sit in LEAGUE_HUB_REGISTRY, so linking
  // without it would point published team pages at routes before they exist.
  // Gating on `live` ties every league's up-link to the same one-line flag flip
  // that lights the nav. Leagues whose hub is not live keep a plain-text league
  // segment so there is never a dead link.
  const leagueHub = getLeagueHub(team.league);
  const leagueHubHref = leagueHub?.live ? leagueHub.href : null;

  // Zero-promo gates. Two, not one: 38 team pages hold no promos at all, but
  // only the 32 NFL ones have schedule data behind them (getGamesForTeam returns
  // an empty array for every league but mlb and nfl), so gating the schedule on
  // the promo condition alone would render an empty shell on the other six.
  // Both gates are false on all 131 populated pages, which is what keeps their
  // markup on the existing code path.
  const hasNoPromos =
    promoCounts.giveaway === 0 &&
    promoCounts.theme === 0 &&
    promoCounts.food === 0 &&
    promoCounts.kids === 0;
  const showSchedule = hasNoPromos && (gameContexts?.length ?? 0) > 0;

  // Same-division rivals, free from gameContexts (opponent Team docs are
  // already fetched by enrichGamesForTeam). Empty on leagues without game
  // docs, and the block below is gated on length so those pages carry no
  // stray wrapper div.
  const rivals = getDivisionRivals(team, gameContexts);
  const eyebrow = (
    <>
      {leagueHubHref ? (
        <Link
          href={leagueHubHref}
          aria-label={`${team.league} promotions and giveaways hub`}
          className="underline-offset-2 transition-colors hover:text-white hover:underline"
        >
          {team.league}
        </Link>
      ) : (
        team.league
      )}
      {team.division ? <> · {team.division}</> : null}
    </>
  );

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
      {/* Engagement capture trigger. Renders the capture sheet for every
          qualifying visitor. The team and the schedule are threaded from here
          because no page-level client context holds either, and the host resolves
          the chip candidates from them server-side. Gated so OFF means it never
          enters the tree at all. NOTE this whole template is behind
          isRedesignEnabled(), so the trigger does not exist on the legacy
          team-page branch. */}
      {isCaptureTriggerEnabled() && (
        <CaptureTriggerHost pageType="team_page" team={team} gameContexts={gameContexts} />
      )}

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
            {/* mt-10 exists to clear the calendar above it on mobile. On the
                zero-promo schedule pages the calendar is gone and ScheduleBlock
                sits there instead, carrying its own py-12, so the extra margin
                would double the gap. Gated rather than deleted: the populated
                branch emits the identical class string it always has. */}
            <AffiliateRail
              team={team}
              venue={venue}
              className={showSchedule ? 'order-[20] lg:mt-0' : 'order-[20] mt-10 lg:mt-0'}
            />
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

            {/* Season slot. ONE wrapper holding exactly one of two mutually
                exclusive blocks, because under supersede they are mutually
                exclusive by definition. Two separate conditionals would encode
                that as a coincidence rather than a fact, and would also emit an
                extra serialized `false` child into the RSC payload of all 131
                populated pages, shifting every sibling's internal reference path
                by one index. Inert, but not byte-identical, and there is no
                reason to accept it.

                order-[11] on the schedule puts it exactly where the calendar it
                supersedes sat. The calendar held order-[10], the lowest value in
                the weave, so anything higher would silently promote
                AffiliateRail (order-[20]) to first in the mobile column and land
                a visitor arriving from a promo query on an affiliate stack
                before any content. The after-hero ad slot at order-[30] is
                demoted on those 32 pages, which costs nothing today: AdSlot
                returns null while the ad network is unset.

                The calendar is superseded rather than stacked because with no
                promos its category chips are inert in every month, its grid
                renders a disabled cell for every day, and its empty-month hint
                prints "No games this month" underneath a stat band reading 17
                Games. Rendering both would also put two emitters of
                away_game_expanded on one page with identical payloads, which
                cannot be untangled after ingestion. */}
            <div className={showSchedule ? 'order-[11]' : 'order-[10]'}>
              {showSchedule && gameContexts ? (
                <ScheduleBlock contexts={gameContexts} team={team} teamName={displayName} />
              ) : (
                <SeasonExplorer
                  promos={promos}
                  promoCounts={promoCounts}
                  teamName={displayName}
                  teamSlug={team.id}
                  sport={team.league}
                  team={team}
                  gameContexts={gameContexts}
                />
              )}
            </div>

            {/* Full promo list — upcoming + completed, with show-all. The
                upcoming rows open the shared game modal (same body the calendar
                expands inline); the provider holds one Modal for the list.
                showTeamLink defaults false — the user is already on this team's
                page. */}
            <div className="order-[40]">
              {hasNoPromos ? (
                /* League-contextual copy REPLACES the list on the 38 zero-promo
                   pages. Replace rather than sit alongside: both blocks render
                   the same "Coming up" eyebrow and a competing H2 about the same
                   absent thing, and the branch being replaced is the dead-end
                   "No upcoming promos yet". It also means promo-list.tsx is not
                   edited at all, and that file serves all 131 populated pages.
                   PromoArrivalHighlight goes with it, which is inert here: it is
                   a deep-link scroll effect with no promo rows to anchor to. */
                <ZeroPromoFallback
                  team={team}
                  venue={venue}
                  teamName={displayName}
                  variant="light"
                />
              ) : (
                <UpcomingPromoModalProvider>
                  <PromoList
                    promos={promos}
                    teamSlug={team.id}
                    teamName={displayName}
                    teamNickname={team.name}
                    sport={team.sportSlug}
                    primaryColor={team.primaryColor}
                    venueName={venue?.name ?? null}
                    variant="light"
                    showAppPitch={false}
                    team={team}
                    gameContexts={gameContexts}
                  />
                </UpcomingPromoModalProvider>
              )}
            </div>

            {/* Email + app conversion pairing, sitting immediately after the
                completed-promos list and immediately before By the Numbers, on
                both the desktop source order and the mobile order weave (the
                pairing is order-[41], By the Numbers is order-[42], both right
                after PromoList's order-[40]). Email first (pre-stars this team,
                tags web_team_page, fires email_cta_click), then the app push
                pitch moved out of PromoList. */}
            <div className="order-[41]">
              <div className="mx-auto max-w-3xl px-6 py-8">
                <FollowCTA surface="web_team_page" team={team} />
                <AppPushPitch variant="light" teamName={displayName} teamSlug={team.id} />
              </div>
            </div>

            <div className="order-[42]">
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

            {/* Cross-team rivals grid. order-[55] weaves it after recurring
                deals and before the sidebar's Explore card on mobile; on
                desktop (order utilities inert) this source position puts it
                between recurring deals and the SEO capsules. MLB + NFL only
                today: rivals derive from gameContexts, so leagues without
                game docs render nothing here. */}
            {rivals.length > 0 && (
              <div className="order-[55]">
                <DivisionRivals team={team} rivals={rivals} />
              </div>
            )}

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

            <div className="order-[72]">
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
