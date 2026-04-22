import type { Team } from '@/lib/types';
import type { AnalyticsSurface } from '@/lib/analytics';
import { buildBookingUrl } from '@/lib/affiliates';
import { VENUE_CITY_OVERRIDES } from '@/lib/venue-cities';
import { TrackedAffiliateLink } from '@/components/tracked-affiliate-link';

type HotelsCTAProps = {
  team: Team;
  surface: AnalyticsSurface;
  /** Optional explicit city. Overrides both the VENUE_CITY_OVERRIDES table
   *  and Team.city — use when a caller has first-hand venue-city data. */
  city?: string;
  placement?: string;
  variant?: 'card' | 'section';
};

export function HotelsCTA({
  team,
  surface,
  city,
  placement = 'team_page_footer',
  variant = 'section',
}: HotelsCTAProps) {
  // Priority: explicit prop > stadium-city override table > team brand city.
  const resolvedCity = city ?? VENUE_CITY_OVERRIDES[team.id] ?? team.city;
  const href = buildBookingUrl({ location: resolvedCity, surface });

  if (variant === 'card') {
    return (
      <div className="bg-bg-card border border-border-subtle rounded-xl p-5">
        <h3 className="font-display text-lg tracking-[0.5px] mb-1">
          {team.city} {team.name}
        </h3>
        <p className="text-text-secondary text-xs mb-4">
          Traveling for a {team.name} game? Find a hotel in {resolvedCity}.
        </p>
        <TrackedAffiliateLink
          href={href}
          partner="booking"
          teamId={team.id}
          sport={team.league}
          surface={surface}
          placement={placement}
          className="inline-flex items-center gap-2 bg-bg-card border border-border-subtle text-white font-semibold text-xs px-4 py-2 rounded-xl transition-all hover:-translate-y-0.5 hover:border-border-hover"
        >
          Find Hotels in {resolvedCity} →
        </TrackedAffiliateLink>
      </div>
    );
  }

  return (
    <section className="py-12 px-6 border-t border-border-subtle">
      <div className="max-w-3xl mx-auto">
        <span className="font-mono text-[10px] tracking-[1.5px] uppercase text-accent-red">
          Visiting fans
        </span>
        <h2 className="font-display text-2xl md:text-3xl tracking-[1px] mt-1 mb-3">
          PLAN YOUR TRIP
        </h2>
        <p className="text-text-secondary text-sm leading-relaxed mb-5 max-w-xl">
          Traveling to see the {team.city} {team.name}? Find a hotel in {resolvedCity} and stay near the action.
        </p>
        <TrackedAffiliateLink
          href={href}
          partner="booking"
          teamId={team.id}
          sport={team.league}
          surface={surface}
          placement={placement}
          className="inline-flex items-center gap-2 bg-accent-red text-white font-bold text-sm px-6 py-3 rounded-xl transition-all hover:-translate-y-0.5 hover:shadow-[0_0_30px_rgba(239,68,68,0.3)]"
        >
          Find Hotels in {resolvedCity}
        </TrackedAffiliateLink>
      </div>
    </section>
  );
}
