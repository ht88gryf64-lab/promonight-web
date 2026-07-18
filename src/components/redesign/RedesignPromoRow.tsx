'use client';

import type { ReactNode } from 'react';
import { IconFlame } from '@tabler/icons-react';
import { ShareButton, formatShareDate, type ShareItem } from '@/components/share';
import { categoryFor } from './categories';
import type { Promo, Team } from '@/lib/types';
import type { GameContext } from '@/lib/data';
import { useUpcomingPromoModal, type UpcomingPromoSurface } from './UpcomingPromoModal';

// One light-theme promo row (used by the gate-on PromoList for both the
// server-rendered visible rows and the client lazy-mounted hidden rows). Keeps
// the promo_card ShareButton so share_initiated is preserved on every rendered
// row.
//
// When `interactive` (the upcoming-promos list, wired with a `team`), the whole
// row opens the shared game modal — same body the calendar uses inline. The
// ShareButton stops propagation, so it never opens the modal. Non-interactive
// rows (completed list) render exactly as before.
export type PromoRowShare = {
  teamName: string;
  teamSlug: string;
  sport: string;
  primaryColor?: string;
  venueName?: string | null;
};

function formatPromoDate(dateStr: string): { day: string; weekday: string; month: string } {
  const date = new Date(dateStr + 'T12:00:00');
  return {
    day: date.getDate().toString(),
    weekday: date.toLocaleDateString('en-US', { weekday: 'short' }).toUpperCase(),
    month: date.toLocaleDateString('en-US', { month: 'short' }).toUpperCase(),
  };
}

export function RedesignPromoRow({
  promo,
  share,
  completed = false,
  resaleSlot,
  team,
  contexts,
  interactive = false,
  surface = 'web_team_page_promolist',
  anchorId,
}: {
  promo: Promo;
  share: PromoRowShare;
  completed?: boolean;
  /** Optional trailing CTA (e.g. the eBay resale link on lifted completed
   *  bobblehead rows). Rendered after the opponent line; undefined leaves the
   *  row byte-identical to before the slot existed. */
  resaleSlot?: ReactNode;
  /** Full team object — required for the modal opener (the shared body's
   *  ticket CTA). Present only on the interactive upcoming rows. */
  team?: Team;
  /** Resolved home-game context(s) for this row's date; null/absent → the modal
   *  renders the legacy promo body (game-less leagues / no home game). */
  contexts?: GameContext[] | null;
  /** When true (and `team` present), the whole row opens the shared game modal. */
  interactive?: boolean;
  surface?: UpcomingPromoSurface;
  /** DOM id for deep-linking (e.g. "promo-2026-07-18-slider-bobblehead"). When a
   *  /promos/today card links to /[sport]/[team]#promo-…, the arrival highlighter
   *  scrolls to and flashes this row. Undefined leaves the row id-less as before. */
  anchorId?: string;
}) {
  const openModal = useUpcomingPromoModal();
  const { day, weekday, month } = formatPromoDate(promo.date);
  const { color, label, Icon } = categoryFor(promo.type);

  const shareItem: ShareItem = {
    icon: promo.icon,
    promoTitle: promo.title,
    teamName: share.teamName,
    date: formatShareDate(promo.date),
    venue: share.venueName ?? null,
    sport: share.sport,
    teamSlug: share.teamSlug,
    promoType: promo.type,
    primaryColor: share.primaryColor ?? null,
  };

  const openable = interactive && !!team;
  const open = () => {
    if (team) openModal({ promo: { ...promo, team }, contexts: contexts ?? null, surface });
  };

  const interactiveProps = openable
    ? {
        role: 'button' as const,
        tabIndex: 0,
        onClick: open,
        onKeyDown: (e: React.KeyboardEvent) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            open();
          }
        },
      }
    : {};

  return (
    <div
      {...interactiveProps}
      id={anchorId}
      className={[
        'group relative flex scroll-mt-24 gap-4 rounded-2xl border border-rd-line bg-rd-card p-4 transition-colors md:p-5',
        completed ? 'opacity-60 hover:opacity-80' : 'hover:border-rd-line-strong',
        openable ? 'cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rd-red focus-visible:ring-offset-2' : '',
      ]
        .filter(Boolean)
        .join(' ')}
      style={{ borderLeftWidth: '3px', borderLeftColor: color }}
    >
      <ShareButton
        item={shareItem}
        placement="promo_card"
        className="absolute right-2.5 top-2.5 inline-flex h-8 w-8 items-center justify-center rounded-full text-rd-ink-faint transition-colors hover:bg-rd-cream hover:text-rd-ink active:bg-rd-line"
        label={`Share ${promo.title}`}
      />
      <div className="w-14 flex-shrink-0 text-center">
        <div className="font-rd text-[10px] uppercase tracking-[0.1em] text-rd-ink-faint">{month}</div>
        <div className="rd-numerals text-3xl leading-none text-rd-ink">{day}</div>
        <div className="font-rd text-[10px] uppercase tracking-[0.1em] text-rd-ink-faint">{weekday}</div>
      </div>

      <div className="min-w-0 flex-1 pr-8">
        <div className="mb-1.5 flex flex-wrap items-center gap-2">
          <Icon size={18} stroke={2} className="shrink-0" style={{ color }} aria-hidden />
          <span
            className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-semibold"
            style={{ backgroundColor: `${color}1a`, color }}
          >
            <Icon size={12} stroke={2.25} />
            <span>{label}</span>
          </span>
          {completed && (
            <span className="inline-flex items-center gap-1 rounded-full border border-rd-line px-2 py-0.5 font-rd text-[10px] uppercase tracking-[0.05em] text-rd-ink-faint">
              Completed
            </span>
          )}
          {!completed && promo.highlight && (
            <span className="inline-flex items-center gap-0.5 font-rd text-[10px] font-semibold uppercase tracking-[0.05em] text-rd-red">
              <IconFlame size={12} stroke={2.25} />
              HOT
            </span>
          )}
          {promo.time && (
            <span className="font-rd text-[10px] text-rd-ink-faint">{promo.time}</span>
          )}
        </div>
        <div className="text-sm font-semibold text-rd-ink md:text-base">{promo.title}</div>
        {promo.description && (
          <p className="mt-1 text-xs text-rd-ink-soft md:text-sm">{promo.description}</p>
        )}
        {promo.opponent && (
          <div className="mt-2 inline-flex items-center gap-1.5 font-rd text-[10px] uppercase tracking-[0.05em] text-rd-ink-faint">
            vs {promo.opponent}
          </div>
        )}
        {resaleSlot && <div>{resaleSlot}</div>}
      </div>
    </div>
  );
}
