import type { Team, Venue } from '@/lib/types';
import { TicketmasterCTA } from '@/components/affiliates/TicketmasterCTA';
import { SpotHeroCTA } from '@/components/affiliates/SpotHeroCTA';
import { BookingCTA } from '@/components/affiliates/BookingCTA';
import { FanaticsCTA } from '@/components/affiliates/FanaticsCTA';
import { VenueInfoBlock } from '@/components/venue-info-block';

// AffiliateRail — the "plan your visit" module. The single tickets CTA lives
// here now (the hero Get Tickets button was removed), so this is the one place
// tickets are offered on the gate-on page.
//
// The four affiliate CTAs are already full-width white-card rows (icon · label ·
// arrow); they are stacked VERTICALLY full-width (not in a grid). Affiliate
// tracking is preserved by reuse — each fires `affiliate_click` on mousedown via
// tracked-affiliate-link. Surface stays "web_team_page". Below the buttons, the
// full VenueInfoBlock (light) extends downward with gate times, parking,
// transit, bag policy, etc.
export interface AffiliateRailProps {
  team: Team;
  venue: Venue | null;
  className?: string;
}

export function AffiliateRail({ team, venue, className }: AffiliateRailProps) {
  return (
    <section className={className}>
      <h2 className="mb-3 font-rd text-[11px] font-semibold uppercase tracking-[0.14em] text-rd-ink-faint">
        Plan your visit
      </h2>

      <div className="flex flex-col gap-2.5">
        {/* Tickets — the single tickets CTA (locked team_page_sidebar placement) */}
        <TicketmasterCTA team={team} surface="web_team_page" placement="team_page_sidebar" size="full" />
        {/* Parking */}
        <SpotHeroCTA team={team} venue={venue} surface="web_team_page" placement="team_page_prepare" />
        {/* Hotels */}
        <BookingCTA team={team} venue={venue} surface="web_team_page" placement="team_page_prepare" />
        {/* Fan gear — self-gates on team.fanaticsUrl, may render null */}
        <FanaticsCTA team={team} surface="web_team_page" placement="team_page_prepare" />
      </div>

      {/* Full venue & game-day detail flows below the buttons */}
      {venue && (
        <div className="mt-6">
          <VenueInfoBlock venue={venue} league={team.league} variant="light" />
        </div>
      )}
    </section>
  );
}
