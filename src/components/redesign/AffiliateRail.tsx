import type { Team, Venue } from '@/lib/types';
import { IconClock } from '@tabler/icons-react';
import { SpotHeroCTA } from '@/components/affiliates/SpotHeroCTA';
import { BookingCTA } from '@/components/affiliates/BookingCTA';
import { FanaticsCTA } from '@/components/affiliates/FanaticsCTA';

// AffiliateRail — the "plan your visit" affiliate row on the redesigned
// team page (parking, hotels, fan gear, plus a non-affiliate gate-time chip).
//
// Affiliate tracking is preserved by REUSE: SpotHeroCTA / BookingCTA /
// FanaticsCTA each render a TrackedAffiliateLink that fires the
// `affiliate_click` analytics event on mousedown internally. This component
// only lays them out — it does NOT build affiliate URLs or tracking. The
// surface is fixed to "web_team_page" and the placement to
// "team_page_prepare" so reporting stays consistent with the live page.

export interface AffiliateRailProps {
  team: Team;
  venue: Venue | null;
  className?: string;
}

export function AffiliateRail({ team, venue, className }: AffiliateRailProps) {
  const gatesOpen = venue?.gatesOpen;

  return (
    <section className={className}>
      <h2 className="font-rd uppercase tracking-wide text-rd-ink-faint text-[11px] font-semibold mb-4">
        Plan your visit
      </h2>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
        {/* Parking — tracked SpotHero affiliate CTA */}
        <SpotHeroCTA
          team={team}
          venue={venue}
          surface="web_team_page"
          placement="team_page_prepare"
        />

        {/* Hotels — tracked Booking.com affiliate CTA */}
        <BookingCTA
          team={team}
          venue={venue}
          surface="web_team_page"
          placement="team_page_prepare"
        />

        {/* Fan gear — tracked Fanatics affiliate CTA (self-gates on
            team.fanaticsUrl and may render null) */}
        <FanaticsCTA
          team={team}
          surface="web_team_page"
          placement="team_page_prepare"
        />

        {/* Gate time — NON-affiliate info chip, only when gatesOpen is set */}
        {gatesOpen ? (
          <div className="bg-rd-card rounded-2xl border border-rd-line p-5 flex items-start gap-3">
            <IconClock
              size={22}
              stroke={1.75}
              className="text-rd-ink-soft shrink-0 mt-0.5"
            />
            <div className="min-w-0">
              <div className="font-rd uppercase text-[11px] tracking-[0.14em] text-rd-ink-faint">
                Gate time
              </div>
              <div className="font-rd text-rd-ink mt-1">
                Gates open {gatesOpen}
              </div>
            </div>
          </div>
        ) : null}
      </div>
    </section>
  );
}
