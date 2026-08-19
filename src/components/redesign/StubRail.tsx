'use client';

import Link from 'next/link';
import { IconArrowRight } from '@tabler/icons-react';
import type { PromoWithTeam } from '@/lib/types';
import type { GameContext } from '@/lib/data';
import type { StarPlacement } from '@/hooks/use-starred-teams';
import type { UpcomingPromoSurface } from './UpcomingPromoModal';
import { TicketStubCard } from './TicketStubCard';

// Horizontally scrolling ticket-stub rail section for the homepage redesign
// (docs/homepage-redesign-target.html): eyebrow, section h2, lede, see-all
// link, then a scroll-snap rail of TicketStubCards. One shell serves both the
// Tonight rail and the Best Promos rail (withRank). Presentational: the
// caller shapes the items, picks the surface, and owns the section backdrop
// (pass notchBg to match it). Renders NOTHING when items is empty, matching
// the live hero's behavior of hiding the tonight block on empty days: an
// empty rail is a worse signal than no rail.
//
// Heading order: the section heading here is the page's h2; card titles are
// paragraphs by design, so the document runs h1 to h2 and nothing lower.
//
// The see-all is a plain Link with no analytics event yet: event naming for
// rail see-alls is a homepage-wiring decision, recorded in the Phase 2 gate
// report, not something this isolated component should invent.

export interface StubRailItem {
  promo: PromoWithTeam;
  contexts: GameContext[] | null;
}

export function StubRail({
  eyebrow,
  dotColor,
  heading,
  lede,
  seeAllHref,
  seeAllLabel,
  items,
  surface,
  starPlacement,
  withRank = false,
  notchBg,
}: {
  eyebrow: string;
  /** Color of the eyebrow dot; use a house token value. */
  dotColor: string;
  heading: string;
  lede?: string;
  seeAllHref: string;
  seeAllLabel: string;
  items: StubRailItem[];
  surface: UpcomingPromoSurface;
  starPlacement: StarPlacement;
  /** Best-promos presentation: oversized rank watermark per card. */
  withRank?: boolean;
  /** Passed through to the cards' punched notches; must match the section
   *  background behind the rail. */
  notchBg?: string;
}) {
  if (items.length === 0) return null;

  return (
    <div>
      <div className="mb-7 flex flex-wrap items-end justify-between gap-x-6 gap-y-3">
        <div>
          <div className="mb-2 flex items-center gap-2 font-mono text-[10.5px] font-semibold uppercase tracking-[0.22em] text-rd-ink-faint">
            <span aria-hidden className="h-1.5 w-1.5 flex-none rounded-full" style={{ background: dotColor }} />
            {eyebrow}
          </div>
          <h2 className="rd-display text-3xl uppercase text-rd-ink md:text-4xl">{heading}</h2>
          {lede && <p className="mt-2 max-w-md font-rd text-sm text-rd-ink-soft">{lede}</p>}
        </div>
        <Link
          href={seeAllHref}
          className="inline-flex items-center gap-1.5 pb-1 font-mono text-xs font-semibold uppercase tracking-[0.06em] text-rd-red-dark transition-colors hover:text-rd-red"
        >
          {seeAllLabel}
          <IconArrowRight size={13} stroke={2.5} />
        </Link>
      </div>

      <div className="no-scrollbar flex gap-5 overflow-x-auto px-1 py-2" style={{ scrollSnapType: 'x mandatory' }}>
        {items.map((item, i) => (
          <div
            key={`${item.promo.team.id}-${item.promo.date}-${item.promo.title}`}
            className="w-[274px] flex-none"
            style={{ scrollSnapAlign: 'start' }}
          >
            <TicketStubCard
              promo={item.promo}
              contexts={item.contexts}
              surface={surface}
              starPlacement={starPlacement}
              rank={withRank ? i + 1 : undefined}
              notchBg={notchBg}
            />
          </div>
        ))}
      </div>
    </div>
  );
}
