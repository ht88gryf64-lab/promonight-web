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
import { TeamPageTracker } from '@/components/analytics-events';
import { EngagementTracker } from '@/components/analytics/EngagementTracker';
import { TicketmasterCTA } from '@/components/affiliates/TicketmasterCTA';
import { FanaticsCTA } from '@/components/affiliates/FanaticsCTA';
import { SpotHeroCTA } from '@/components/affiliates/SpotHeroCTA';
import { BookingCTA } from '@/components/affiliates/BookingCTA';
import { AffiliateDisclosure } from '@/components/affiliates/AffiliateDisclosure';
import { FANATICS_CTA_ENABLED } from '@/lib/affiliates';
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

      {/* GET TICKETS hero — hand-rolled section so the section H2 picks up
       *  the new Outfit hero typography (TicketsBlock kept for /playoffs and
       *  the team-calendar modal where the existing display-font H2 reads
       *  fine). */}
      <section className="py-8 px-6 border-t border-border-subtle">
        <div className="max-w-3xl mx-auto">
          <div className="mb-4">
            <span className="font-mono text-[10px] tracking-[1.5px] uppercase text-accent-red">
              Get tickets
            </span>
            <h2 className="font-outfit font-black text-[22px] tracking-[-0.5px] text-white mt-1.5">
              {displayName.toUpperCase()} TICKETS
            </h2>
          </div>
          <div className="max-w-md">
            <TicketmasterCTA
              team={team}
              surface="web_team_page"
              placement="team_page_hero"
              size="full"
            />
          </div>
        </div>
      </section>

      {/* PREPARE FOR THE GAME cluster — Fanatics, SpotHero, Booking. The
       *  branded cards replace the previous red-gradient inline parking CTA
       *  + footer "PLAN YOUR TRIP" + footer "SHOP OFFICIAL GEAR" sections.
       *  AT line is omitted when venue is null (no fabricated stadium
       *  fallback). Cluster placement = "team_page_prepare" gives PostHog a
       *  clean filter for cluster CTR vs the hero CTR. */}
      <section className="py-8 px-6 border-t border-border-subtle">
        <div className="max-w-3xl mx-auto">
          <div className="mb-4">
            <span className="font-mono text-[10px] tracking-[1.5px] uppercase text-accent-red">
              Prepare for the game
            </span>
            {venue && (
              <h2 className="font-outfit font-black text-[22px] tracking-[-0.5px] text-white mt-1.5 mb-1">
                AT {venue.name.toUpperCase()}
              </h2>
            )}
            <p className="font-sans text-[13px] text-[#888] leading-[1.5] mt-2">
              Going to the game? Reserve parking, book a hotel, or grab fan gear.
            </p>
          </div>
          <div className="max-w-md flex flex-col gap-2.5">
            {/* Fanatics CTA is gated on NEXT_PUBLIC_FANATICS_CTA_ENABLED.
             *  Off today: Impact deep linking is disabled at the program
             *  level so both wrap and direct-SSAID URLs land on the
             *  fanatics.com homepage. Showing a "Shop Fan Gear" card that
             *  homepages every click is bad UX, so we hide the card until
             *  Impact confirms deep linking. URL builder logic stays in
             *  place — flipping the flag without code change re-enables
             *  the card with whichever URL pattern is active. */}
            {FANATICS_CTA_ENABLED && (
              <FanaticsCTA
                team={team}
                surface="web_team_page"
                placement="team_page_prepare"
              />
            )}
            <SpotHeroCTA
              team={team}
              surface="web_team_page"
              placement="team_page_prepare"
              venue={venue}
            />
            <BookingCTA
              team={team}
              surface="web_team_page"
              placement="team_page_prepare"
              venue={venue}
            />
          </div>
        </div>
      </section>

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
