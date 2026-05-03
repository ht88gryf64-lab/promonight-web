import type { Team } from '@/lib/types';
import type { AnalyticsSurface } from '@/lib/analytics';
import { TicketmasterCTA } from './TicketmasterCTA';

export type TicketsBlockPlacement =
  | 'team_page_hero'
  | 'team_page_inline'
  | 'promo_card'
  | 'playoffs_hub'
  | 'home_game_card'
  | 'away_game_card';

type TicketsBlockProps = {
  team: Team;
  surface: AnalyticsSurface;
  placement: TicketsBlockPlacement;
  promoId?: string | null;
  /** Reserved for when per-event Ticketmaster URLs are wired; unused today. */
  event?: string;
  /** 'section' (default): full team-page section with eyebrow + h2 + CTA.
   *  'card': modal/playoffs row look — eyebrow + CTA only, no h2; matchup
   *  context is supplied by the surrounding card. */
  variant?: 'section' | 'card';
};

function TicketIcon() {
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
      <path d="M2 9V7a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v2a2 2 0 0 0 0 4v2a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2v-2a2 2 0 0 0 0-4z" />
      <path d="M13 5v14" strokeDasharray="2 2" />
    </svg>
  );
}

// Single-source Ticketmaster CTA. The previous SeatGeek + StubHub button pair
// was retired on 2026-05-03 — neither program had landed approval and the
// dual-CTA had become a high-intent leak. Ticketmaster is the operating brand
// across all surfaces; the underlying URL is wrap-resolved by
// buildTicketmasterUrl when NEXT_PUBLIC_TICKETMASTER_IMPACT_WRAP is set, with
// graceful pre-approval fallback to a bare ticketmaster.com link.
export function TicketsBlock({
  team,
  surface,
  placement,
  promoId,
  variant = 'section',
}: TicketsBlockProps) {
  if (variant === 'card') {
    return (
      <div className="flex flex-col items-stretch gap-2.5">
        <span className="inline-flex items-center gap-1.5 font-mono text-[10px] tracking-[1.5px] uppercase text-accent-red">
          <TicketIcon />
          Get tickets
        </span>
        <TicketmasterCTA
          team={team}
          surface={surface}
          placement={placement}
          promoId={promoId}
          size="compact"
        />
      </div>
    );
  }

  // Section variant — preserved team-page hero layout.
  const teamName = `${team.city} ${team.name}`;

  return (
    <section className="py-8 px-6 border-t border-border-subtle">
      <div className="max-w-3xl mx-auto">
        <div className="mb-4">
          <span className="font-mono text-[10px] tracking-[1.5px] uppercase text-accent-red">
            Get tickets
          </span>
          <h2 className="font-display text-2xl md:text-3xl tracking-[1px] mt-1">
            {teamName.toUpperCase()} TICKETS
          </h2>
        </div>

        <div className="max-w-md">
          <TicketmasterCTA
            team={team}
            surface={surface}
            placement={placement}
            promoId={promoId}
            size="full"
          />
        </div>
      </div>
    </section>
  );
}
