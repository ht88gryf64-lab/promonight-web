'use client';

import type { PromoWithTeam } from '@/lib/types';
import type { GameContext } from '@/lib/data';
import { teamDisplayName } from '@/lib/promo-helpers';
import { RD_CATEGORIES } from './categories';
import { useUpcomingPromoModal } from './UpcomingPromoModal';

// Hero "Tonight" teaser card. A tap opens the shared game modal (same body as
// the team-page calendar) instead of navigating to the team page. `className`
// lets the hero hide cards 3-4 below the desktop breakpoint (mobile shows 2).
export function HeroTonightCard({
  promo,
  contexts,
  className = '',
}: {
  promo: PromoWithTeam;
  contexts: GameContext[] | null;
  className?: string;
}) {
  const openModal = useUpcomingPromoModal();
  const meta = RD_CATEGORIES[promo.type];
  const teamName = teamDisplayName(promo.team);
  const open = () => openModal({ promo, contexts, surface: 'web_home_tonight' });

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
      className={`group block cursor-pointer rounded-2xl border border-white/10 bg-white/[0.06] p-4 transition-colors hover:border-white/20 hover:bg-white/[0.09] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rd-red focus-visible:ring-offset-2 focus-visible:ring-offset-[#1d1714] ${className}`}
    >
      <span
        className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-semibold"
        style={{ backgroundColor: `${meta.color}22`, color: meta.color }}
      >
        <meta.Icon size={12} stroke={2.25} />
        <span>{meta.label}</span>
      </span>
      <div className="mt-2 line-clamp-2 font-rd text-[15px] font-semibold leading-snug text-white">
        {promo.title}
      </div>
      <div className="mt-1 truncate font-rd text-xs text-white/55">
        {teamName}
        {promo.time ? ` · ${promo.time}` : ''}
      </div>
    </div>
  );
}
