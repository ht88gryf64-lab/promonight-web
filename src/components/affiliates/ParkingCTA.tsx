import type { Team } from '@/lib/types';
import type { AnalyticsSurface } from '@/lib/analytics';
import { buildSpotHeroUrl } from '@/lib/affiliates';
import { TrackedAffiliateLink } from '@/components/tracked-affiliate-link';

type ParkingCTAProps = {
  team: Team;
  surface: AnalyticsSurface;
  /** Venue display name. If omitted, falls back to "[Team Name] Stadium" so the
   *  component still renders something sensible on routes without venue data. */
  venueName?: string;
  placement?: string;
  compact?: boolean;
};

export function ParkingCTA({
  team,
  surface,
  venueName,
  placement = 'team_page_inline',
  compact = false,
}: ParkingCTAProps) {
  const teamName = `${team.city} ${team.name}`;
  const destination = venueName || teamName;
  const href = buildSpotHeroUrl({ venue: destination, surface });

  if (compact) {
    return (
      <TrackedAffiliateLink
        href={href}
        partner="spothero"
        teamId={team.id}
        sport={team.league}
        surface={surface}
        placement={placement}
        className="inline-flex items-center gap-1 font-mono text-[11px] tracking-[0.08em] uppercase text-accent-red hover:text-white transition-colors"
      >
        Find Parking at {destination} →
      </TrackedAffiliateLink>
    );
  }

  return (
    <div className="bg-bg-card border border-border-subtle rounded-xl p-5 md:p-6">
      <div className="flex flex-wrap items-center gap-4 justify-between">
        <div>
          <span className="font-mono text-[10px] tracking-[1.5px] uppercase text-accent-red">
            Parking
          </span>
          <p className="text-white font-semibold text-sm mt-1">
            Going to the game? Reserve parking at {destination}.
          </p>
        </div>
        <TrackedAffiliateLink
          href={href}
          partner="spothero"
          teamId={team.id}
          sport={team.league}
          surface={surface}
          placement={placement}
          className="inline-flex items-center gap-2 bg-accent-red text-white font-bold text-xs px-5 py-2.5 rounded-xl transition-all hover:-translate-y-0.5 hover:shadow-[0_0_30px_rgba(239,68,68,0.3)]"
        >
          Find Parking at {destination}
        </TrackedAffiliateLink>
      </div>
    </div>
  );
}
