import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import Link from 'next/link';
import { getAllTeams, getTeamBySlug, getTeamPromos, getVenueForTeam } from '@/lib/data';
import type { PromoType } from '@/lib/types';
import { TeamHero } from '@/components/team-hero';
import { PromoList } from '@/components/promo-list';
import { JsonLd } from '@/components/json-ld';
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

  const title = `${team.city} ${team.name} 2026 Promo Schedule — Giveaways, Theme Nights & Deals`;
  const description = `Full list of ${team.city} ${team.name} promotional events${venue ? ` at ${venue.name}` : ''} in 2026. ${promos.length} promos including ${giveaways} giveaways, ${upcoming.length} upcoming. Track them all free on PromoNight.`;

  return {
    title,
    description,
    openGraph: {
      title: `${team.city} ${team.name} 2026 Promo Schedule`,
      description,
      url: `https://getpromonight.com/${team.sportSlug}/${team.id}`,
      type: 'website',
      images: [`/api/og?team=${team.id}`],
    },
    twitter: {
      card: 'summary_large_image',
      title: `${team.city} ${team.name} 2026 Promo Schedule`,
      description,
      images: [`/api/og?team=${team.id}`],
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

  const [promos, venue] = await Promise.all([
    getTeamPromos(team.id),
    getVenueForTeam(team.id),
  ]);

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
      <JsonLd team={team} promos={promos} venue={venue} />
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

      <PromoList promos={promos} teamColor={team.primaryColor} teamSlug={team.id} />

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

      {/* SEO content block */}
      <section className="py-12 px-6 border-t border-border-subtle">
        <div className="max-w-3xl mx-auto text-text-secondary text-sm leading-relaxed space-y-4">
          <p>
            The {team.city} {team.name} have announced {promos.length} promotional events for the 2026 season
            {venue ? ` at ${venue.name}` : ''}. This includes {promoCounts.giveaway} giveaway night{promoCounts.giveaway !== 1 ? 's' : ''} featuring
            bobbleheads, replica jerseys, and collectible items, along with {promoCounts.theme} theme night{promoCounts.theme !== 1 ? 's' : ''} and {promoCounts.food} food
            deal{promoCounts.food !== 1 ? 's' : ''}.
          </p>
          <p>
            PromoNight tracks the complete {team.city} {team.name} promotional schedule so you never miss a giveaway or special event.
            From bobblehead nights to dollar hot dog deals, we keep you updated on every promotion{venue ? ` at ${venue.name}` : ''}.
            {upcoming.length > 0
              ? ` There are currently ${upcoming.length} upcoming promo${upcoming.length !== 1 ? 's' : ''} on the schedule.`
              : ''}
          </p>
          <p>
            Download the PromoNight app to get push notifications before your favorite {team.name} promos, browse a visual promo calendar,
            and discover the best games to attend this season. Available free on iOS.
          </p>
        </div>
      </section>
    </>
  );
}
