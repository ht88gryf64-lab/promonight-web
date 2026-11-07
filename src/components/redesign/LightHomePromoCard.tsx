'use client';

import type { MouseEvent } from 'react';
import { IconFlame, IconTicket } from '@tabler/icons-react';
import type { PromoWithTeam } from '@/lib/types';
import type { GameContext } from '@/lib/data';
import { teamDisplayName, promoDisplayOpponent, promoDisplayTime } from '@/lib/promo-helpers';
import { categoryForPromo } from './categories';
import { StarToggleInline } from '@/components/star-toggle';
import type { StarPlacement } from '@/hooks/use-starred-teams';
import { useUpcomingPromoModal, type UpcomingPromoSurface } from './UpcomingPromoModal';
import { isPurchaseGated, synthPromoId } from '@/lib/promo-helpers';
import { promoPageHref } from '@/lib/promo-page-href';
import { PromoPageLink } from '@/components/promo-page-link';

// Light-house promo card for the redesigned homepage This Week section.
// Visually it matches the team-page RedesignPromoRow (date column, category
// pill, HOT tag, title) and it follows the same click rule
// (docs/per-promo-pages-v2-spec.md, Prerequisite, 2026-11-07): the date block
// and the body are the children of ONE Link to the promo's page, with no
// onClick of their own, and the shared game modal opens only from the
// explicit Tickets button. The star and the Tickets button are positioned
// siblings of the link, never its children. Before this the whole card was a
// role=button that opened the modal, with only the title text an anchor.
//
// Unlike RedesignPromoRow it shows the TEAM NAME (the homepage is cross-team).

function dateParts(dateStr: string): { day: string; weekday: string; month: string } {
  const d = new Date(dateStr + 'T12:00:00');
  return {
    day: d.getDate().toString(),
    weekday: d.toLocaleDateString('en-US', { weekday: 'short' }).toUpperCase(),
    month: d.toLocaleDateString('en-US', { month: 'short' }).toUpperCase(),
  };
}

const LINK_CLASS =
  'flex min-w-0 flex-1 gap-4 rounded-xl pr-8 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rd-red focus-visible:ring-offset-2';

export function LightHomePromoCard({
  promo,
  contexts,
  surface,
  starPlacement,
}: {
  promo: PromoWithTeam;
  contexts: GameContext[] | null;
  surface: UpcomingPromoSurface;
  starPlacement: StarPlacement;
}) {
  const openModal = useUpcomingPromoModal();
  const { day, weekday, month } = dateParts(promo.date);
  const { color, ink, label, Icon } = categoryForPromo(promo);
  const teamName = teamDisplayName(promo.team);
  // The promo's own page (Phase 3c). Null leaves the card body inert: nowhere
  // to go, and a body tap never opens the modal either way.
  const pageHref = promoPageHref(promo);
  const openTickets = (e: MouseEvent<HTMLButtonElement>) => {
    e.stopPropagation();
    e.preventDefault();
    openModal({ promo, contexts, surface });
  };

  const content = (
    <>
      <div className="w-14 flex-shrink-0 text-center">
        <div className="font-rd text-[10px] uppercase tracking-[0.1em] text-rd-ink-faint">{month}</div>
        <div className="rd-numerals text-3xl leading-none text-rd-ink">{day}</div>
        <div className="font-rd text-[10px] uppercase tracking-[0.1em] text-rd-ink-faint">{weekday}</div>
      </div>

      <div className="min-w-0 flex-1">
        <div className="mb-1.5 flex flex-wrap items-center gap-2">
          <span
            className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-semibold"
            style={{ backgroundColor: `${color}1a`, color: ink }}
          >
            <Icon size={12} stroke={2.25} />
            <span>{label}</span>
          </span>
          {promo.highlight && !isPurchaseGated(promo) && (
            <span className="inline-flex items-center gap-0.5 font-rd text-[10px] font-semibold uppercase tracking-[0.05em] text-rd-red">
              <IconFlame size={12} stroke={2.25} />
              HOT
            </span>
          )}
          {promoDisplayTime(promo) && <span className="font-rd text-[10px] text-rd-ink-faint">{promoDisplayTime(promo)}</span>}
        </div>
        <div className="line-clamp-2 text-sm font-semibold text-rd-ink transition-colors group-hover:text-rd-red md:text-base">
          {promo.title}
        </div>
        {/* pr-14 keeps the truncated line clear of the Tickets button, which
            sits over this card's bottom-right corner. */}
        <div className="mt-1 truncate pr-14 font-rd text-xs text-rd-ink-soft">
          {teamName}
          {promoDisplayOpponent(promo) && <span className="text-rd-ink-faint"> vs {promoDisplayOpponent(promo)}</span>}
        </div>
      </div>
    </>
  );

  return (
    <div
      className="group relative flex rounded-2xl border border-rd-line bg-rd-card p-4 transition-colors hover:border-rd-line-strong md:p-5"
      style={{ borderLeftWidth: '3px', borderLeftColor: color }}
    >
      {pageHref ? (
        <PromoPageLink
          href={pageHref}
          surface={surface}
          teamSlug={promo.team.id}
          promoId={synthPromoId(promo.team.id, promo)}
          className={LINK_CLASS}
        >
          {content}
        </PromoPageLink>
      ) : (
        <div className={LINK_CLASS}>{content}</div>
      )}

      {/* Positioned siblings of the link: a tap on either is never a tap on
          the card. The star stops propagation of its own click. */}
      <div className="absolute right-2.5 top-2.5 z-10">
        <StarToggleInline
          teamSlug={promo.team.id}
          teamName={teamName}
          league={promo.team.league}
          sport={promo.team.sportSlug}
          placement={starPlacement}
        />
      </div>
      <button
        type="button"
        onClick={openTickets}
        className="absolute bottom-2.5 right-2.5 z-10 inline-flex items-center gap-1 rounded-full border border-rd-line bg-rd-card px-2.5 py-0.5 font-rd text-[11px] font-semibold uppercase tracking-[0.08em] text-rd-ink-soft transition-colors hover:border-rd-line-strong hover:text-rd-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rd-red focus-visible:ring-offset-2"
      >
        <IconTicket size={13} stroke={2} aria-hidden />
        Tickets
      </button>
    </div>
  );
}
