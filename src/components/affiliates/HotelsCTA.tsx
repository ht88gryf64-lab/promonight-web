import type { ReactNode } from 'react';
import type { Team, Venue } from '@/lib/types';
import type { AnalyticsSurface } from '@/lib/analytics';
import { resolveHotelLink } from '@/lib/hotel-link';
import { TrackedAffiliateLink } from '@/components/tracked-affiliate-link';
import { teamDisplayName } from '@/lib/promo-helpers';

// PromoNight hotel CTA, fulfilled by Expedia (Partnerize). Purple promo-palette
// accent + a small "via Expedia" tag — reads as a PromoNight CTA, not an
// Expedia ad. Server-rendered (no client widget); the click instrumentation
// rides on the client <TrackedAffiliateLink> child.

type HotelsCTAProps = {
  team: Team;
  surface: AnalyticsSurface;
  /** Venue for the team. Valid lat/lng -> precise stadium-area search; absent
   *  -> city-level search (never a broken button). */
  venue?: Venue | null;
  /** Away-game date (YYYY-MM-DD). Present -> dated single-night search +
   *  web_away_game pubref. Absent -> undated search + {surface} pubref. */
  gameDate?: string | null;
  placement?: string;
  /** 'modal-row': polished modal row (eyebrow + button), away-game module.
   *  'card': descriptor card with team identity (/playoffs trip grid).
   *  'section': full team-page section with prose. */
  variant?: 'modal-row' | 'card' | 'section';
};

function BedIcon() {
  return (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M2 4v16" />
      <path d="M2 8h18a2 2 0 0 1 2 2v10" />
      <path d="M2 17h20" />
      <path d="M6 8v3" />
    </svg>
  );
}

function fmtShort(iso: string): string {
  return new Date(`${iso}T12:00:00Z`).toLocaleDateString('en-US', { month: 'short', day: 'numeric', timeZone: 'UTC' });
}

const buttonBase =
  'flex items-center justify-between gap-2 rounded-xl font-bold transition-all hover:-translate-y-0.5';
// Promo-palette purple (the promo-dot theme color #a78bfa), NOT a partner brand color.
const primaryFill =
  'bg-promo-theme text-white hover:shadow-[0_0_30px_rgba(167,139,250,0.35)]';

export function HotelsCTA({
  team,
  surface,
  venue,
  gameDate,
  placement = 'team_page_footer',
  variant = 'section',
}: HotelsCTAProps) {
  const link = resolveHotelLink({ team, venue, surface, gameDate });
  // Hide rather than render a broken button when there's neither coords nor a
  // resolvable city (same spirit as the Game Day no-data state).
  if (!link) return null;

  const { href, venueName, checkIn, checkOut } = link;
  const meta = checkIn && checkOut ? `${fmtShort(checkIn)}–${fmtShort(checkOut)} · 2 guests` : '2 guests';

  const tracked = (className: string, children: ReactNode) => (
    <TrackedAffiliateLink
      href={href}
      partner="expedia"
      teamId={team.id}
      sport={team.league}
      surface={surface}
      placement={placement}
      className={className}
    >
      {children}
    </TrackedAffiliateLink>
  );

  if (variant === 'modal-row') {
    return (
      <div className="flex flex-col items-start gap-2.5">
        <span className="inline-flex items-center gap-1.5 font-mono text-[10px] tracking-[1.5px] uppercase text-promo-theme">
          <BedIcon />
          Book a hotel
        </span>
        {tracked(
          `${buttonBase} text-sm px-4 py-2.5 ${primaryFill} w-full sm:w-auto sm:min-w-[220px]`,
          <>
            <span className="flex flex-col items-start leading-tight text-left">
              <span>Find hotels near {venueName}</span>
              <span className="text-[10px] font-medium opacity-85">{meta} · via Expedia</span>
            </span>
            <span aria-hidden="true" className="text-base leading-none opacity-70">›</span>
          </>,
        )}
      </div>
    );
  }

  if (variant === 'card') {
    return (
      <div className="bg-bg-card border border-border-subtle rounded-xl p-5">
        <h3 className="font-display text-lg tracking-[0.5px] mb-1">{teamDisplayName(team)}</h3>
        <p className="text-text-secondary text-xs mb-4">Traveling for a {team.name} game? Find a hotel near {venueName}.</p>
        {tracked(
          'inline-flex flex-col items-start gap-0.5 bg-bg-card border border-promo-theme/40 text-white font-semibold text-xs px-4 py-2.5 rounded-xl transition-all hover:-translate-y-0.5 hover:border-promo-theme',
          <>
            <span>Find hotels near {venueName} →</span>
            <span className="text-[10px] font-medium text-text-secondary">{meta} · via Expedia</span>
          </>,
        )}
      </div>
    );
  }

  return (
    <section className="py-12 px-6 border-t border-border-subtle">
      <div className="max-w-3xl mx-auto">
        <span className="font-mono text-[10px] tracking-[1.5px] uppercase text-promo-theme">Visiting fans</span>
        <h2 className="font-display text-2xl md:text-3xl tracking-[1px] mt-1 mb-3">PLAN YOUR TRIP</h2>
        <p className="text-text-secondary text-sm leading-relaxed mb-5 max-w-xl">
          Traveling to see the {teamDisplayName(team)}? Find a hotel near {venueName} and stay near the action.
        </p>
        {tracked(
          `${buttonBase} inline-flex text-sm px-6 py-3 ${primaryFill}`,
          <>
            <span className="flex flex-col items-start leading-tight text-left">
              <span>Find hotels near {venueName}</span>
              <span className="text-[10px] font-medium opacity-85">{meta} · via Expedia</span>
            </span>
          </>,
        )}
      </div>
    </section>
  );
}
