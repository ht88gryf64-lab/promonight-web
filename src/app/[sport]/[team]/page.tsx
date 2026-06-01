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
  getStillAlivePlayoffTeamIds,
} from '@/lib/data';
import type { PromoType } from '@/lib/types';
import { TeamHero } from '@/components/team-hero';
import { TeamCalendar } from '@/components/team-calendar';
import { ScheduleReleaseVideoCard } from '@/components/ScheduleReleaseVideoCard';
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

// Trim a string back to the last word boundary at or before `max` so a long
// {team}+{venue} description never cuts a word in half when it overflows the
// meta-description budget. Returns the string unchanged when it already fits.
function truncateAtWord(s: string, max: number): string {
  if (s.length <= max) return s;
  const slice = s.slice(0, max);
  const lastSpace = slice.lastIndexOf(' ');
  return (lastSpace > 0 ? slice.slice(0, lastSpace) : slice).trimEnd();
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ sport: string; team: string }>;
}): Promise<Metadata> {
  const { team: teamSlug } = await params;
  const team = await getTeamBySlug(teamSlug);
  if (!team) return {};

  const [venue, promos] = await Promise.all([
    getVenueForTeam(team.id),
    getTeamPromos(team.id),
  ]);

  // Hardcoded, NOT new Date().getFullYear(): an auto-rolling year would flip
  // every title to "...2027" at midnight on Jan 1 — before the 2027 promo data
  // exists and before the season starts — misleading users and search engines.
  // Bumping the season year is a deliberate edit made when 2027 content is ready.
  const year = 2026;
  const displayName = teamDisplayName(team);

  // The root layout's title.template ("%s | PromoNight") appends the brand to
  // every string title, so this bare value renders as
  // `${displayName} Promos & Giveaways ${year} | PromoNight` — the 60-char SEO
  // target. Do NOT add "| PromoNight" here or it doubles.
  const title = `${displayName} Promos & Giveaways ${year}`;

  // OG/Twitter titles are NOT processed by the layout title.template, so spell
  // the "| PromoNight" suffix out here to match the rendered <title> byte-for-
  // byte and keep the brand on shared social cards.
  const socialTitle = `${title} | PromoNight`;

  // Meta description: front-load the next upcoming promos so the Google
  // snippet stays fresh on every ISR revalidation. Built from getTeamPromos
  // (date-ascending). Capped at 250 chars; the "See the full schedule" closer
  // is appended only when it fits, and a promo is dropped rather than cut
  // mid-title (two clean names beat three with the third truncated). `year`
  // stays hardcoded (never getFullYear()) — same rationale as the title above.
  // Falls back to an evergreen sentence when there are no upcoming promos (or,
  // defensively, when not even the first promo fits the budget).
  const DESC_MAX = 250;
  const todayStr = new Date().toISOString().split('T')[0];
  const monthDay = (d: string) =>
    new Date(d + 'T12:00:00').toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
    });

  const fallbackDescription = venue
    ? `${displayName} ${year} promotional schedule — bobbleheads, giveaways, theme nights, and food deals at ${venue.name}. Updated weekly.`
    : `${displayName} ${year} promotional schedule — bobbleheads, giveaways, theme nights, and food deals. Updated weekly.`;

  const upcomingForDesc = promos
    .filter((p) => p.date >= todayStr)
    .sort((a, b) => a.date.localeCompare(b.date))
    .slice(0, 3);

  let rawDescription = fallbackDescription;
  if (upcomingForDesc.length > 0) {
    const prefix = `Upcoming ${displayName} promos: `;
    const closer = ` See the full ${year} schedule at PromoNight.`;
    const fits: string[] = [];
    let len = prefix.length;
    for (const p of upcomingForDesc) {
      const entry = `${monthDay(p.date)} — ${p.title}`;
      const sep = fits.length === 0 ? '' : ', ';
      // +1 reserves the period that closes the promo list; a promo that would
      // push past DESC_MAX is dropped, not truncated mid-title.
      if (len + sep.length + entry.length + 1 > DESC_MAX) break;
      fits.push(entry);
      len += sep.length + entry.length;
    }
    if (fits.length > 0) {
      const listBody = `${prefix}${fits.join(', ')}.`;
      rawDescription =
        (listBody + closer).length <= DESC_MAX ? listBody + closer : listBody;
    }
  }
  const description = truncateAtWord(rawDescription, DESC_MAX);

  return {
    title,
    description,
    alternates: {
      canonical: `https://www.getpromonight.com/${team.sportSlug}/${team.id}`,
    },
    openGraph: {
      title: socialTitle,
      description,
      siteName: 'PromoNight',
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
      title: socialTitle,
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
    getStillAlivePlayoffTeamIds(playoffConfig).includes(team.id);
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

  // MLB + NFL today: full schedule overlays onto the calendar. Other leagues
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
            {/* FanaticsCTA self-gates on team.fanaticsUrl presence (legacy
             *  team.fanaticsPath accepted as a fallback) — returns null for
             *  any team without a populated canonical URL (zero teams after
             *  the migration, but defense-in-depth for future Firestore docs
             *  added before coverage catches up). Naive URLs like
             *  fanatics.com/{league}/{slug} 404, so unpopulated teams must
             *  not render. */}
            <FanaticsCTA
              team={team}
              surface="web_team_page"
              placement="team_page_prepare"
            />
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

      {/* NFL-only: official team schedule release video. Render gate is
       *  field presence on the team doc; MLB / NBA / NHL / MLS / WNBA
       *  Team docs never carry scheduleReleaseVideo so they skip this
       *  card naturally. Defensive league check belt-and-braces. */}
      {team.league === 'NFL' && team.scheduleReleaseVideo && (
        <ScheduleReleaseVideoCard video={team.scheduleReleaseVideo} teamSlug={team.id} />
      )}

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
          sport={team.sportSlug}
          primaryColor={team.primaryColor}
          venueName={venue?.name ?? null}
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
