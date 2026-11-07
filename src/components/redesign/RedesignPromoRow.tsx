'use client';

import type { MouseEvent, ReactNode } from 'react';
import Link from 'next/link';
import { IconFlame, IconTicket } from '@tabler/icons-react';
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
// server-rendered visible rows and the client lazy-mounted hidden rows, and
// reused as-is by /promos/today and the venue hub in `href` mode). Keeps the
// promo_card ShareButton so share_initiated is preserved on every rendered
// row.
//
// THE CLICK RULE (docs/per-promo-pages-v2-spec.md, Prerequisite, 2026-11-07):
// the row navigates; the ticket modal opens only from the explicit Tickets
// button. The date block and the body (category, title, description,
// opponent) are the children of ONE Link to the promo's page, with no onClick
// of their own, so a tap anywhere a thumb lands is a navigation, for a human
// exactly as for a crawler. The controls that must not navigate (Share, the
// eBay resale link, Tickets) are siblings of that Link, never its children: an
// <a> or a <button> may not nest in an <a>. Before this the row was a
// role=button whose onClick opened the modal, with only the title text itself
// an anchor, which is why team page to promo page produced no pageviews
// (src/components/redesign/__tests__/promo-row-click.test.tsx holds the rule).
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

const LINK_CLASS =
  'flex gap-4 rounded-xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rd-red focus-visible:ring-offset-2';

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
   *  bobblehead rows). Rendered under the body, outside the row's link (it is
   *  an anchor of its own); undefined adds nothing. */
  resaleSlot?: ReactNode;
  /** Full team object — required for the Tickets button (the shared modal
   *  body's ticket CTA). Present only on the interactive upcoming rows. */
  team?: Team;
  /** Resolved home-game context(s) for this row's date; null/absent → the modal
   *  renders the legacy promo body (game-less leagues / no home game). */
  contexts?: GameContext[] | null;
  /** When true (and `team` present), the row carries the Tickets button that
   *  opens the shared game modal. The row body never opens it. */
  interactive?: boolean;
  surface?: UpcomingPromoSurface;
  /** DOM id for deep-linking (e.g. "promo-2026-07-18-slider-bobblehead"). When a
   *  /promos/today card links to /[sport]/[team]#promo-…, the arrival highlighter
   *  scrolls to and flashes this row. Undefined leaves the row id-less as before. */
  anchorId?: string;
  /** When set, the row links here instead of to the promo's page (used by
   *  /promos/today and the venue hub, which pass the page href when the promo
   *  has one and their team-page anchor fallback otherwise). The ShareButton
   *  stays outside the link, so sharing still works; any appended CTA row is
   *  rendered outside the row and is unaffected. */
  href?: string;
  /** The surface promo_link_click reports when the row leads to the promo's
   *  own page (Phase 3c). Defaults to `surface`, the team-page list; the
   *  cross-team hosts name their own. */
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

  // The promo's own page (Phase 3c), through the one helper. Null while the
  // flag is off or the row may not be linked.
  const pageHref = promoPageHref(promo, { id: share.teamSlug, sportSlug: share.sport });
  // Where the row goes: the host's `href` when it passes one, else the page.
  // Null leaves the row inert: nowhere to go, and a body tap never opens the
  // modal either way.
  const linkHref = href ?? pageHref;
  const linkIsPage = !!linkHref && linkHref === pageHref;
  const clickSurface: AnalyticsSurface = linkSurface ?? surface;
  const promoKey = synthPromoId(share.teamSlug, promo);

  // The Tickets button: the ONE opener of the shared game modal, on the
  // interactive upcoming rows (wired with a `team`). It is a sibling of the
  // row's link, so it stops nothing of the row's own; stopPropagation keeps a
  // host wrapper's click handler (VenueHubPromoCard counts anchor taps from
  // its wrapper) from reading a Tickets tap as a row tap.
  const showTickets = interactive && !!team;
  const openTickets = (e: MouseEvent<HTMLButtonElement>) => {
    e.stopPropagation();
    e.preventDefault();
    if (team) openModal({ promo: { ...promo, team }, contexts: contexts ?? null, surface });
  };

  // The link's children: the date block and the body. Strings and glyphs
  // only, no handlers, no controls.
  const content = (
    <>
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
        {/* The title reddens on hover of the whole row, since the whole row is
            the link (LightHomePromoCard's pattern). */}
        <div className={`text-sm font-semibold text-rd-ink md:text-base ${linkHref ? 'transition-colors group-hover:text-rd-red' : ''}`}>
          {promo.title}
        </div>
        {promo.description && (
          <p className="mt-1 text-xs text-rd-ink-soft md:text-sm">{promo.description}</p>
        )}
        {displayOpponent && (
          <div className="mt-2 inline-flex items-center gap-1.5 font-rd text-[10px] uppercase tracking-[0.05em] text-rd-ink-faint">
            vs {displayOpponent}
          </div>
        )}
      </div>
    </>
  );

  return (
    <div
      id={anchorId}
      data-ad-item={adItem}
      className={[
        'group relative scroll-mt-24 rounded-2xl border border-rd-line bg-rd-card p-4 transition-colors md:p-5',
        // No opacity on completed rows. The completed state is already
        // signalled three ways: position under its own heading, an explicit
        // Completed chip, and the muted tokens. The fade was the only one that
        // cost contrast and the only one not machine-readable, and it dragged
        // the whole row under AA: body 2.92:1, meta 1.89:1, and the Completed
        // chip itself 1.89:1, which is the element carrying the meaning.
        completed ? '' : 'hover:border-rd-line-strong',
      ]
        .filter(Boolean)
        .join(' ')}
      style={{ borderLeftWidth: '3px', borderLeftColor: color }}
    >
      {linkHref && linkIsPage ? (
        // The promo name is inside the anchor (the inbound-link rule), with
        // the date and the rest of the row beside it.
        <PromoPageLink href={linkHref} surface={clickSurface} teamSlug={share.teamSlug} promoId={promoKey} className={LINK_CLASS}>
          {content}
        </PromoPageLink>
      ) : linkHref ? (
        <Link href={linkHref} className={LINK_CLASS}>
          {content}
        </Link>
      ) : (
        <div className="flex gap-4">{content}</div>
      )}

      {/* A positioned sibling of the link, so it paints above it and a tap on
          it is never a tap on the row. Its own handler stops propagation. */}
      <ShareButton
        item={shareItem}
        placement="promo_card"
        className="absolute right-2.5 top-2.5 inline-flex h-8 w-8 items-center justify-center rounded-full text-rd-ink-decor transition-colors hover:bg-rd-cream hover:text-rd-ink active:bg-rd-line"
        label={`Share ${promo.title}`}
      />

      {/* Under the body, aligned with it (the date column is w-14 + gap-4 =
          72px): the controls that are anchors or buttons of their own. */}
      {(resaleSlot || showTickets) && (
        <div className="mt-2 flex flex-wrap items-center gap-2 pl-[72px]">
          {resaleSlot}
          {showTickets && (
            <button
              type="button"
              onClick={openTickets}
              className="inline-flex items-center gap-1 rounded-full border border-rd-line bg-rd-card px-2.5 py-1 font-rd text-[11px] font-semibold uppercase tracking-[0.08em] text-rd-ink-soft transition-colors hover:border-rd-line-strong hover:text-rd-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rd-red focus-visible:ring-offset-2"
            >
              <IconTicket size={13} stroke={2} aria-hidden />
              Tickets
            </button>
          )}
        </div>
      )}
    </div>
  );
}
