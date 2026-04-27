import type { Team } from '@/lib/types';
import type { AnalyticsSurface } from '@/lib/analytics';
import { buildSeatGeekUrl, buildStubHubUrl } from '@/lib/affiliates';
import { TrackedAffiliateLink } from '@/components/tracked-affiliate-link';

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
  /** Optional SeatGeek event slug / StubHub event id — reserved for when
   *  per-event pages are wired; unused today. */
  event?: string;
  /** 'section' (default): full team-page section with eyebrow + h2 + buttons.
   *  'card': modal/playoffs row look — eyebrow + buttons only, no h2; the
   *  matchup/venue context is already supplied by the surrounding card. */
  variant?: 'section' | 'card';
};

const buttonBase =
  'flex items-center justify-between gap-2 rounded-xl font-bold transition-all hover:-translate-y-0.5';
// Subtle ~8% top-to-bottom darken on the primary button — accent-red →
// accent-red-dim — gives the fill a tactile depth without crossing into glossy.
const primaryFill =
  'bg-gradient-to-b from-accent-red to-accent-red-dim text-white hover:shadow-[0_0_30px_rgba(239,68,68,0.3)]';
const secondaryFill =
  'bg-bg-card border border-border-subtle text-white hover:border-border-hover';

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

export function TicketsBlock({
  team,
  surface,
  placement,
  promoId,
  event,
  variant = 'section',
}: TicketsBlockProps) {
  // Buttons render regardless of env-var state — the URL builders return a
  // bare partner URL when the affiliate ID is empty. Distribution and habit
  // formation outweigh commission recoupment during the pre-approval phase.
  // Tracking-active state is surfaced to PostHog via TrackedAffiliateLink.
  const seatgeekHref = buildSeatGeekUrl({
    team: team.id,
    event,
    surface,
    promoId,
  });
  const stubhubHref = buildStubHubUrl({
    teamSlug: team.id,
    surface,
    promoId,
  });

  if (variant === 'card') {
    return (
      <div className="flex flex-col items-stretch gap-2.5">
        <span className="inline-flex items-center gap-1.5 font-mono text-[10px] tracking-[1.5px] uppercase text-accent-red">
          <TicketIcon />
          Get tickets
        </span>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
          <TrackedAffiliateLink
            href={seatgeekHref}
            partner="seatgeek"
            teamId={team.id}
            sport={team.league}
            promoId={promoId}
            surface={surface}
            placement={placement}
            className={`${buttonBase} text-sm px-4 py-2.5 ${primaryFill}`}
          >
            <span>SeatGeek</span>
            <span aria-hidden="true" className="text-base leading-none opacity-70">›</span>
          </TrackedAffiliateLink>
          <TrackedAffiliateLink
            href={stubhubHref}
            partner="stubhub"
            teamId={team.id}
            sport={team.league}
            promoId={promoId}
            surface={surface}
            placement={placement}
            className={`${buttonBase} text-sm px-4 py-2.5 ${secondaryFill}`}
          >
            <span>StubHub</span>
            <span aria-hidden="true" className="text-base leading-none opacity-70">›</span>
          </TrackedAffiliateLink>
        </div>
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

        <div className="flex flex-wrap items-center gap-3">
          <TrackedAffiliateLink
            href={seatgeekHref}
            partner="seatgeek"
            teamId={team.id}
            sport={team.league}
            promoId={promoId}
            surface={surface}
            placement={placement}
            className={`${buttonBase} text-sm px-6 py-3 ${primaryFill} min-w-[180px] justify-center`}
          >
            Get Tickets · SeatGeek
          </TrackedAffiliateLink>
          <TrackedAffiliateLink
            href={stubhubHref}
            partner="stubhub"
            teamId={team.id}
            sport={team.league}
            promoId={promoId}
            surface={surface}
            placement={placement}
            className={`${buttonBase} text-sm px-6 py-3 ${secondaryFill} min-w-[180px] justify-center`}
          >
            Get Tickets · StubHub
          </TrackedAffiliateLink>
        </div>
      </div>
    </section>
  );
}
