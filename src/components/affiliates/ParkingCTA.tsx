import type { Team, Venue } from '@/lib/types';
import type { AnalyticsSurface } from '@/lib/analytics';
import { buildSpotHeroUrl } from '@/lib/affiliates';
import { TrackedAffiliateLink } from '@/components/tracked-affiliate-link';

type ParkingCTAProps = {
  team: Team;
  surface: AnalyticsSurface;
  /** Venue for the team. When supplied with valid lat/lng, SpotHero routes
   *  via coordinate search (stadium-area parking listings). Fallback below. */
  venue?: Venue | null;
  placement?: string;
  /** When true, render the polished card row used in the game modal and on
   *  /playoffs cards: small eyebrow + primary partner button. When false,
   *  render the team-page bordered card with the descriptive sentence. */
  compact?: boolean;
};

function hasCoords(v: Venue | null | undefined): v is Venue {
  if (!v) return false;
  const { lat, lng } = v;
  return (
    typeof lat === 'number' &&
    typeof lng === 'number' &&
    Number.isFinite(lat) &&
    Number.isFinite(lng) &&
    lat !== 0 &&
    lng !== 0
  );
}

function ParkingIcon() {
  return (
    <svg
      width="13"
      height="13"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <rect x="3" y="3" width="18" height="18" rx="3" />
      <path d="M9 17V7h4a3 3 0 0 1 0 6H9" />
    </svg>
  );
}

const buttonBase =
  'inline-flex items-center justify-between gap-2 rounded-xl font-bold transition-all hover:-translate-y-0.5';
const primaryFill =
  'bg-gradient-to-b from-accent-red to-accent-red-dim text-white hover:shadow-[0_0_30px_rgba(239,68,68,0.3)]';

export function ParkingCTA({
  team,
  surface,
  venue,
  placement = 'team_page_inline',
  compact = false,
}: ParkingCTAProps) {
  // Button renders regardless of SpotHero env state — bare URL fallback
  // routes the user to SpotHero's coordinate search even pre-approval.
  // Tracking-active state is surfaced to PostHog via TrackedAffiliateLink.
  const teamName = `${team.city} ${team.name}`;
  // Label prefers the venue name so "Find Parking at Rogers Centre" beats
  // "Find Parking at Toronto Blue Jays". Falls back to team name when we
  // have no venue doc (all MLS today, most NBA, most WNBA).
  const label = venue?.name || teamName;

  const href = hasCoords(venue)
    ? buildSpotHeroUrl({
        latitude: venue.lat,
        longitude: venue.lng,
        surface,
      })
    : buildSpotHeroUrl({ surface });

  if (compact) {
    return (
      <div className="space-y-2.5">
        <span className="inline-flex items-center gap-1.5 font-mono text-[10px] tracking-[1.5px] uppercase text-accent-red">
          <ParkingIcon />
          Find parking
        </span>
        <TrackedAffiliateLink
          href={href}
          partner="spothero"
          teamId={team.id}
          sport={team.league}
          surface={surface}
          placement={placement}
          className={`${buttonBase} text-sm px-4 py-2.5 ${primaryFill} w-full sm:w-auto sm:min-w-[200px]`}
        >
          <span>SpotHero</span>
          <span aria-hidden="true" className="text-base leading-none opacity-70">›</span>
        </TrackedAffiliateLink>
      </div>
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
            Going to the game? Reserve parking at {label}.
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
          Find Parking at {label}
        </TrackedAffiliateLink>
      </div>
    </div>
  );
}
