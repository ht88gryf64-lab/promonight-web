'use client';

import { IconFlame } from '@tabler/icons-react';
import type { PromoWithTeam } from '@/lib/types';
import type { GameContext } from '@/lib/data';
import { teamDisplayName } from '@/lib/promo-helpers';
import { categoryFor } from './categories';
import { StarToggleInline } from '@/components/star-toggle';
import type { StarPlacement } from '@/hooks/use-starred-teams';
import { useUpcomingPromoModal, type UpcomingPromoSurface } from './UpcomingPromoModal';

// Light-house promo card for the redesigned homepage Tonight + This Week
// sections. Visually it matches the team-page RedesignPromoRow (date column,
// category pill, HOT tag, title) but it is a TAP target: tapping anywhere on the
// card opens the shared game modal (same body as the team-page calendar) instead
// of navigating to the team page. It carries the same StarToggleInline (same
// placement), which stops propagation so the star never opens the modal.
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
  const { color, label, Icon } = categoryFor(promo.type);
  const teamName = teamDisplayName(promo.team);
  const open = () => openModal({ promo, contexts, surface });

  return (
    <div
      role="button"
      tabIndex={0}
      onClick={open}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          open();
        }
      }}
      className="group relative flex cursor-pointer gap-4 rounded-2xl border border-rd-line bg-rd-card p-4 transition-colors hover:border-rd-line-strong focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rd-red focus-visible:ring-offset-2 md:p-5"
      style={{ borderLeftWidth: '3px', borderLeftColor: color }}
    >
      <div className="flex min-w-0 flex-1 gap-4 pr-8">
        <div className="w-14 flex-shrink-0 text-center">
          <div className="font-rd text-[10px] uppercase tracking-[0.1em] text-rd-ink-faint">{month}</div>
          <div className="rd-numerals text-3xl leading-none text-rd-ink">{day}</div>
          <div className="font-rd text-[10px] uppercase tracking-[0.1em] text-rd-ink-faint">{weekday}</div>
        </div>

        <div className="min-w-0 flex-1">
          <div className="mb-1.5 flex flex-wrap items-center gap-2">
            <span
              className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-semibold"
              style={{ backgroundColor: `${color}1a`, color }}
            >
              <Icon size={12} stroke={2.25} />
              <span>{label}</span>
            </span>
            {promo.highlight && (
              <span className="inline-flex items-center gap-0.5 font-rd text-[10px] font-semibold uppercase tracking-[0.05em] text-rd-red">
                <IconFlame size={12} stroke={2.25} />
                HOT
              </span>
            )}
            {promo.time && <span className="font-rd text-[10px] text-rd-ink-faint">{promo.time}</span>}
          </div>
          <div className="line-clamp-2 text-sm font-semibold text-rd-ink transition-colors group-hover:text-rd-red md:text-base">
            {promo.title}
          </div>
          <div className="mt-1 truncate font-rd text-xs text-rd-ink-soft">
            {teamName}
            {promo.opponent && <span className="text-rd-ink-faint"> vs {promo.opponent}</span>}
          </div>
        </div>
      </div>

      <div className="absolute right-2.5 top-2.5 z-10">
        <StarToggleInline
          teamSlug={promo.team.id}
          teamName={teamName}
          league={promo.team.league}
          sport={promo.team.sportSlug}
          placement={starPlacement}
        />
      </div>
    </div>
  );
}
