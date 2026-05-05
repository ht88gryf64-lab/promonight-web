import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import Link from 'next/link';
import {
  getAllTeams,
  getTeamBySlug,
  getTeamPromos,
  getVenueForTeam,
  getPlayoffConfig,
  getPlayoffPromosForTeam,
  getGamesForTeam,
  enrichGamesForTeam,
} from '@/lib/data';
import type { PromoType } from '@/lib/types';
import { TeamHero } from '@/components/team-hero';
import { TeamCalendar } from '@/components/team-calendar';
import { PromoList } from '@/components/promo-list';
import { RecurringDealsSection } from '@/components/recurring-deals-section';
import { getRecurringDealsForTeam } from '@/lib/recurring-deals';
import { ZeroPromoFallback } from '@/components/zero-promo-fallback';
import { VenueInfoBlock } from '@/components/venue-info-block';
import { AuthorityStats } from '@/components/authority-stats';
import { TeamContentSections } from '@/components/team-content-sections';
import { TeamFAQ } from '@/components/team-faq';
import { TeamRelatedAggregators } from '@/components/team-related-aggregators';
import { JsonLd } from '@/components/json-ld';
import { PlayoffSection } from '@/components/playoff-section';
import { extractPlayoffOpponent, teamDisplayName } from '@/lib/promo-helpers';
import { TeamPageTracker, TrackedCTA } from '@/components/analytics-events';
import { AppDownloadButtons } from '@/components/app-download-buttons';
import { EngagementTracker } from '@/components/analytics/EngagementTracker';
import { TicketsBlock } from '@/components/affiliates/TicketsBlock';
import { ParkingCTA } from '@/components/affiliates/ParkingCTA';
import { HotelsCTA } from '@/components/affiliates/HotelsCTA';
import { FanGearCTA } from '@/components/affiliates/FanGearCTA';
import { AffiliateDisclosure } from '@/components/affiliates/AffiliateDisclosure';
import { AdSlot } from '@/components/ads/AdSlot';
import { AD_SLOTS } from '@/lib/ads/slots';

export const revalidate = 21600;

export async function generateStaticParams() {
  const teams = await getAllTeams();
  return teams.map((t) => ({
    sport: t.sportSlug,
    team: t.id,
  }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ sport: string; team: string }>;
}): Promise<Metadata> {
  const { team: teamSlug } = await params;
  const team = await getTeamBySlug(teamSlug);
  if (!team) return {};

  const promos = await getTeamPromos(team.id);
  const venue = await getVenueForTeam(team.id);
  const giveaways = promos.filter((p) => p.type === 'giveaway').length;
  const themes = promos.filter((p) => p.type === 'theme').length;
  const kids = promos.filter((p) => p.type === 'kids').length;
  const food = promos.filter((p) => p.type === 'food').length;

  const year = new Date().getFullYear();
  const displayName = teamDisplayName(team);
  const title = `${displayName} Promo Schedule ${year}`;
  const plural = (n: number, s: string) => `${n} ${s}${n === 1 ? '' : 's'}`;
  const venueClause = venue ? ` at ${venue.name}` : '';
  const description = `All ${year} ${displayName} ${team.league} promo nights${venueClause}: ${plural(giveaways, 'giveaway')}, ${plural(themes, 'theme night')}, ${plural(kids, 'kids day')}, and ${plural(food, 'food deal')}. Updated weekly.`;

  return {
    title,
    description,
    alternates: {
      canonical: `https://www.getpromonight.com/${team.sportSlug}/${team.id}`,
    },
    openGraph: {
      title: `${displayName} ${year} Promo Schedule`,
      description,
      url: `https://www.getpromonight.com/${team.sportSlug}/${team.id}`,
      type: 'website',
      images: [
        {
          url: '/og-image.png',
          width: 1200,
          height: 630,
          alt: 'PromoNight — Every giveaway, every team',
        },
      ],
    },
    twitter: {
      card: 'summary_large_image',
      site: '@promo_night_app',
      creator: '@promo_night_app',
      title: `${displayName} ${year} Promo Schedule`,
      description,
      images: ['/og-image.png'],
    },
  };
}

export default async function TeamPage({
  params,
}: {
  params: Promise<{ sport: string; team: string }>;
}) {
  const { sport, team: teamSlug } = await params;
  const team = await getTeamBySlug(teamSlug);

  if (!team || team.sportSlug !== sport) {
    notFound();
  }

  // TEMPORARY: skip playoff config lookup entirely for MLB teams. MLB
  // playoffs are not yet supported by the scanner pipeline, so there is
  // nothing for them in appConfig/playoffs — saves one Firestore read
  // per MLB team-page revalidation. Remove this guard when MLB joins.
  const shouldCheckPlayoffs = team.league !== 'MLB';

  const [promos, venue, playoffConfig] = await Promise.all([
    getTeamPromos(team.id),
    getVenueForTeam(team.id),
    shouldCheckPlayoffs ? getPlayoffConfig() : Promise.resolve(null),
  ]);

  const inPlayoffs =
    !!playoffConfig?.playoffsActive &&
    playoffConfig.activeTeamIds.includes(team.id);
  const playoffPromos = inPlayoffs
    ? await getPlayoffPromosForTeam(team.id)
    : [];
  const playoffRound = inPlayoffs
    ? team.league === 'NBA'
      ? playoffConfig!.nbaRound
      : team.league === 'NHL'
        ? playoffConfig!.nhlRound
        : ''
    : '';

  const playoffContext = inPlayoffs && playoffPromos.length > 0
    ? {
        promos: playoffPromos,
        round: playoffRound,
        opponent: extractPlayoffOpponent(playoffPromos),
      }
    : undefined;

  const promoCounts: Record<PromoType, number> = { giveaway: 0, theme: 0, kids: 0, food: 0 };
  for (const p of promos) {
    if (promoCounts[p.type] !== undefined) {
      promoCounts[p.type]++;
    }
  }

  const displayName = teamDisplayName(team);
  const recurringDeals = getRecurringDealsForTeam(team.id);

  // MLB-only for now: full schedule overlays onto the calendar. Other leagues
  // fall through to the legacy promo-only rendering inside TeamCalendar.
  const games = await getGamesForTeam(team.id, team.sportSlug);
  const gameContexts = games.length > 0
    ? await enrichGamesForTeam(team.id, games, promos)
    : undefined;

  return (
    <>
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

      <section className="px-6 pt-24 pb-2">
        <AdSlot config={AD_SLOTS.HEADER_LEADERBOARD} pageType="team_page" />
      </section>

      <TeamHero
        team={team}
        venue={venue}
        promoCount={promos.length}
        promoCounts={promoCounts}
      />

      <section className="px-6 py-4">
        <AdSlot config={AD_SLOTS.TEAM_PAGE_AFTER_HERO} pageType="team_page" />
      </section>

      {inPlayoffs && playoffPromos.length > 0 && (
        <PlayoffSection
          team={team}
          promos={playoffPromos}
          round={playoffRound}
          lastUpdated={playoffConfig!.lastScanDate}
        />
      )}

      <TicketsBlock
        team={team}
        surface="web_team_page"
        placement="team_page_hero"
      />

      {venue && (
        <section className="py-8 px-6 border-t border-border-subtle">
          <div className="max-w-3xl mx-auto">
            <ParkingCTA
              team={team}
              venue={venue}
              surface="web_team_page"
              placement="team_page_inline"
            />
          </div>
        </section>
      )}

      {venue && <VenueInfoBlock venue={venue} league={team.league} />}

      <TeamCalendar
        promos={promos}
        teamName={displayName}
        teamSlug={team.id}
        sport={team.league}
        team={team}
        gameContexts={gameContexts}
      />

      <RecurringDealsSection
        team={team}
        deals={recurringDeals}
        venueName={venue?.name ?? null}
      />

      <AuthorityStats
        team={team}
        promos={promos}
        promoCounts={promoCounts}
        venue={venue}
        teamName={displayName}
      />

      {promos.length === 0 ? (
        <ZeroPromoFallback team={team} venue={venue} teamName={displayName} />
      ) : (
        <PromoList
          promos={promos}
          teamSlug={team.id}
          teamName={displayName}
        />
      )}

      <TeamRelatedAggregators promos={promos} />

      {/* App CTA */}
      <TrackedCTA teamSlug={team.id}>
        <section className="py-16 px-6 border-t border-border-subtle text-center">
          <div className="max-w-xl mx-auto">
            <span className="font-mono text-[10px] tracking-[1.5px] uppercase text-accent-red">
              Get the app
            </span>
            <h2 className="font-display text-3xl md:text-4xl tracking-[1px] mt-2 mb-4">
              GET THE FULL {team.name.toUpperCase()} PROMO CALENDAR
            </h2>
            <p className="text-text-secondary text-sm mb-8">
              Track every {displayName} giveaway, theme night, and food deal with push notifications and a personalized calendar.
            </p>
            <AppDownloadButtons
              section="team_cta"
              page={`team/${team.id}`}
              teamSlug={team.id}
            />
          </div>
        </section>
      </TrackedCTA>

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

      <section className="px-6 py-6 border-t border-border-subtle">
        <AdSlot config={AD_SLOTS.IN_CONTENT_1} pageType="team_page" />
      </section>

      <section className="px-6 py-6 border-t border-border-subtle">
        <AdSlot config={AD_SLOTS.SIDEBAR_STICKY} pageType="team_page" />
      </section>

      <HotelsCTA
        team={team}
        venue={venue}
        surface="web_team_page"
        placement="team_page_footer"
      />

      <FanGearCTA
        team={team}
        surface="web_team_page"
        placement="team_page_footer"
      />

      <section className="py-6 px-6 border-t border-border-subtle">
        <div className="max-w-3xl mx-auto">
          <AffiliateDisclosure />
        </div>
      </section>

      <section className="px-6 py-4">
        <AdSlot config={AD_SLOTS.ADHESION_FOOTER} pageType="team_page" />
      </section>
    </>
  );
}
