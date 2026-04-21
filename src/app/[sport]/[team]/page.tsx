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
} from '@/lib/data';
import type { PromoType } from '@/lib/types';
import { TeamHero } from '@/components/team-hero';
import { TeamCalendar } from '@/components/team-calendar';
import { PromoList } from '@/components/promo-list';
import { TeamContentSections } from '@/components/team-content-sections';
import { TeamFAQ } from '@/components/team-faq';
import { TeamRelatedAggregators } from '@/components/team-related-aggregators';
import { JsonLd } from '@/components/json-ld';
import { PlayoffSection } from '@/components/playoff-section';
import { extractPlayoffOpponent } from '@/lib/promo-helpers';
import { TeamPageTracker, TrackedCTA, TrackedAppLink } from '@/components/analytics-events';

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
  const today = new Date().toISOString().split('T')[0];
  const upcoming = promos.filter((p) => p.date >= today);
  const giveaways = promos.filter((p) => p.type === 'giveaway').length;

  const year = new Date().getFullYear();
  const themes = promos.filter((p) => p.type === 'theme').length;
  const title = `${team.city} ${team.name} ${year} Promo Schedule — Giveaways, Theme Nights & Deals`;
  const description = `${team.city} ${team.name} ${year} promotional schedule: ${giveaways} giveaway night${giveaways !== 1 ? 's' : ''}, ${themes} theme night${themes !== 1 ? 's' : ''}, and food deals${venue ? ` at ${venue.name}` : ''}. See every bobblehead, jersey giveaway, and special event.`;

  return {
    title,
    description,
    openGraph: {
      title: `${team.city} ${team.name} ${year} Promo Schedule`,
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
      title: `${team.city} ${team.name} ${year} Promo Schedule`,
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

  const today = new Date().toISOString().split('T')[0];
  const upcoming = promos.filter((p) => p.date >= today);

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
        teamName={`${team.city} ${team.name}`}
        promoCount={promos.length}
      />

      <TeamHero
        team={team}
        venue={venue}
        promoCount={promos.length}
        promoCounts={promoCounts}
      />

      {inPlayoffs && playoffPromos.length > 0 && (
        <PlayoffSection
          team={team}
          promos={playoffPromos}
          round={playoffRound}
          lastUpdated={playoffConfig!.lastScanDate}
        />
      )}

      <TeamCalendar promos={promos} teamName={`${team.city} ${team.name}`} />

      <PromoList
        promos={upcoming.slice(0, 3)}
        teamColor={team.primaryColor}
        teamSlug={team.id}
        teamName={`${team.city} ${team.name}`}
        totalPromoCount={promos.length}
      />

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
              Track every {team.city} {team.name} giveaway, theme night, and food deal with push notifications and a personalized calendar.
            </p>
            <TrackedAppLink
              href="/download"
              platform="ios"
              section="team_cta"
              page={`team/${team.id}`}
              className="inline-flex items-center gap-2 bg-accent-red text-white font-bold text-sm px-7 py-3.5 rounded-xl transition-all hover:-translate-y-0.5 hover:shadow-[0_0_30px_rgba(239,68,68,0.3)]"
            >
              Download PromoNight
            </TrackedAppLink>
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
    </>
  );
}
