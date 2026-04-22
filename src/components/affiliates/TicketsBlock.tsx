import type { Team } from '@/lib/types';
import type { AnalyticsSurface } from '@/lib/analytics';
import { buildSeatGeekUrl, buildStubHubUrl } from '@/lib/affiliates';
import { TrackedAffiliateLink } from '@/components/tracked-affiliate-link';

export type TicketsBlockPlacement =
  | 'team_page_hero'
  | 'team_page_inline'
  | 'promo_card'
  | 'playoffs_hub';

type TicketsBlockProps = {
  team: Team;
  surface: AnalyticsSurface;
  placement: TicketsBlockPlacement;
  promoId?: string | null;
  /** Optional SeatGeek event slug / StubHub event id — reserved for when
   *  per-event pages are wired; unused today. */
  event?: string;
};

export function TicketsBlock({
  team,
  surface,
  placement,
  promoId,
  event,
}: TicketsBlockProps) {
  const teamName = `${team.city} ${team.name}`;
  const compact = placement === 'promo_card';

  const seatgeekHref = buildSeatGeekUrl({
    team: team.id,
    event,
    surface,
    promoId,
  });
  const stubhubHref = buildStubHubUrl({
    team: teamName,
    event,
    surface,
    promoId,
  });

  const buttonBase =
    'inline-flex items-center justify-center gap-2 rounded-xl font-bold transition-all hover:-translate-y-0.5';
  const buttonSize = compact
    ? 'text-xs px-4 py-2'
    : 'text-sm px-6 py-3';
  const primary = `${buttonBase} ${buttonSize} bg-accent-red text-white hover:shadow-[0_0_30px_rgba(239,68,68,0.3)]`;
  const secondary = `${buttonBase} ${buttonSize} bg-bg-card border border-border-subtle text-white hover:border-border-hover`;

  if (compact) {
    return (
      <div className="flex flex-wrap items-center gap-2 mt-3">
        <TrackedAffiliateLink
          href={seatgeekHref}
          partner="seatgeek"
          teamId={team.id}
          sport={team.league}
          promoId={promoId}
          surface={surface}
          placement={placement}
          className={primary}
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
          className={secondary}
        >
          StubHub
        </TrackedAffiliateLink>
      </div>
    );
  }

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
            className={`${primary} min-w-[180px]`}
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
            className={`${secondary} min-w-[180px]`}
          >
            Get Tickets · StubHub
          </TrackedAffiliateLink>
        </div>
      </div>
    </section>
  );
}
