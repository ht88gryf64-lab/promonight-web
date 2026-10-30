'use client';

import type { ReactNode } from 'react';
import Link from 'next/link';
import { IconFlame } from '@tabler/icons-react';
import { ShareButton, formatShareDate, type ShareItem } from '@/components/share';
import { categoryForPromo } from './categories';
import type { Promo, Team } from '@/lib/types';
import type { GameContext } from '@/lib/data';
import { useUpcomingPromoModal, type UpcomingPromoSurface } from './UpcomingPromoModal';
import { isPurchaseGated, promoDisplayOpponent, promoDisplayTime, synthPromoId } from '@/lib/promo-helpers';
import { promoPageHref } from '@/lib/promo-page-href';
import { PromoPageLink } from '@/components/promo-page-link';
import type { AnalyticsSurface } from '@/lib/analytics';

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
  href,
  adItem,
  linkSurface,
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
  /** When set, the whole row becomes a link to this href via a stretched
   *  pseudo-overlay (used by /promos/today to deep-link each card to its team
   *  page promo anchor). Takes precedence over `interactive` (no modal). The
   *  ShareButton stays above the overlay, so sharing still works; any appended
   *  CTA row is rendered outside the row and is unaffected. */
  href?: string;
  /** The surface promo_link_click reports when the title (or, in `href` mode,
   *  the overlay) leads to the promo's own page (Phase 3c). Defaults to
   *  `surface`, the team-page list; the cross-team hosts name their own. */
  linkSurface?: AnalyticsSurface;
  /** Ad-placement item type, supplied by the host page. Only the hosts inside
   * the selector-hook scope pass it (team page promo list, /promos/today), so
   * the venue-hub and home-page rows get no item without an enclosing region. */
  adItem?: string;
}) {
  const openModal = useUpcomingPromoModal();
  const { day, weekday, month } = formatPromoDate(promo.date);
  const { color, label, Icon, ink } = categoryForPromo(promo);
  // The slots show the stored value or, when that is empty, the home game's
  // (src/lib/promo-game-join.ts). Falls back to the stored field for objects
  // that never passed through mapPromoDoc.
  const displayTime = promoDisplayTime(promo);
  const displayOpponent = promoDisplayOpponent(promo);

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

  // `href` (deep-link) takes precedence over the modal: a linked row navigates
  // instead of opening the game modal.
  const openable = interactive && !!team && !href;
  const open = () => {
    if (team) openModal({ promo: { ...promo, team }, contexts: contexts ?? null, surface });
  };

  // The promo's own page (Phase 3c), through the one helper. Null while the
  // flag is off or the row may not be linked, and then nothing below changes.
  // In `href` mode the host passes the same value as `href` (or its team
  // anchor fallback), so the overlay is the page link; otherwise the title is.
  const pageHref = promoPageHref(promo, { id: share.teamSlug, sportSlug: share.sport });
  const overlayIsPage = !!href && href === pageHref;
  const titleIsPage = !href && !!pageHref;
  const clickSurface: AnalyticsSurface = linkSurface ?? surface;
  const promoKey = synthPromoId(share.teamSlug, promo);

  const interactiveProps = openable
    ? {
        role: 'button' as const,
        tabIndex: 0,
        onClick: open,
        onKeyDown: (e: React.KeyboardEvent) => {
          // Keydowns from the title link bubble here; Enter on it must follow
          // the link, not open the modal (LightHomePromoCard's guard).
          if (e.target !== e.currentTarget) return;
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
      data-ad-item={adItem}
      className={[
        'group relative flex scroll-mt-24 gap-4 rounded-2xl border border-rd-line bg-rd-card p-4 transition-colors md:p-5',
        // No opacity on completed rows. The completed state is already
        // signalled three ways: position under its own heading, an explicit
        // Completed chip, and the muted tokens. The fade was the only one that
        // cost contrast and the only one not machine-readable, and it dragged
        // the whole row under AA: body 2.92:1, meta 1.89:1, and the Completed
        // chip itself 1.89:1, which is the element carrying the meaning.
        completed ? '' : 'hover:border-rd-line-strong',
        openable ? 'cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rd-red focus-visible:ring-offset-2' : '',
        href ? 'cursor-pointer' : '',
      ]
        .filter(Boolean)
        .join(' ')}
      style={{ borderLeftWidth: '3px', borderLeftColor: color }}
    >
      {/* Stretched deep-link overlay. Positioned first in DOM so the ShareButton
          (a later positioned sibling) paints above it and stays clickable; the
          static row content sits below it, so a body tap navigates. */}
      {href && overlayIsPage ? (
        <PromoPageLink
          href={href}
          surface={clickSurface}
          teamSlug={share.teamSlug}
          promoId={promoKey}
          className="absolute inset-0 rounded-2xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rd-red focus-visible:ring-offset-2"
        >
          {/* The promo name as the anchor text (the inbound-link rule), read
              by crawlers and by assistive tech alike; visually the overlay
              stays empty. */}
          <span className="sr-only">{promo.title}</span>
        </PromoPageLink>
      ) : href ? (
        <Link
          href={href}
          aria-label={promo.title}
          className="absolute inset-0 rounded-2xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rd-red focus-visible:ring-offset-2"
        />
      ) : null}
      <ShareButton
        item={shareItem}
        placement="promo_card"
        className="absolute right-2.5 top-2.5 inline-flex h-8 w-8 items-center justify-center rounded-full text-rd-ink-decor transition-colors hover:bg-rd-cream hover:text-rd-ink active:bg-rd-line"
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
            style={{ backgroundColor: `${color}1a`, color: ink }}
          >
            <Icon size={12} stroke={2.25} />
            <span>{label}</span>
          </span>
          {completed && (
            <span className="inline-flex items-center gap-1 rounded-full border border-rd-line px-2 py-0.5 font-rd text-[10px] uppercase tracking-[0.05em] text-rd-ink-faint">
              Completed
            </span>
          )}
          {!completed && promo.highlight && !isPurchaseGated(promo) && (
            <span className="inline-flex items-center gap-0.5 font-rd text-[10px] font-semibold uppercase tracking-[0.05em] text-rd-red">
              <IconFlame size={12} stroke={2.25} />
              HOT
            </span>
          )}
          {displayTime && (
            <span className="font-rd text-[10px] text-rd-ink-faint">{displayTime}</span>
          )}
        </div>
        {titleIsPage ? (
          <div className="text-sm font-semibold text-rd-ink md:text-base">
            {/* The title is the link (anchor text = the promo name); the
                click stops here so the row's modal does not open under it. */}
            <PromoPageLink
              href={pageHref}
              surface={clickSurface}
              teamSlug={share.teamSlug}
              promoId={promoKey}
              onClick={(e) => e.stopPropagation()}
              className="transition-colors hover:text-rd-red focus-visible:outline-none focus-visible:underline"
            >
              {promo.title}
            </PromoPageLink>
          </div>
        ) : (
          <div className="text-sm font-semibold text-rd-ink md:text-base">{promo.title}</div>
        )}
        {promo.description && (
          <p className="mt-1 text-xs text-rd-ink-soft md:text-sm">{promo.description}</p>
        )}
        {displayOpponent && (
          <div className="mt-2 inline-flex items-center gap-1.5 font-rd text-[10px] uppercase tracking-[0.05em] text-rd-ink-faint">
            vs {displayOpponent}
          </div>
        )}
        {resaleSlot && <div>{resaleSlot}</div>}
      </div>
    </div>
  );
}
