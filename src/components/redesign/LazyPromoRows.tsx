'use client';

import { useState } from 'react';
import type { Promo, Team } from '@/lib/types';
import type { GameContext } from '@/lib/data';
import { RedesignPromoRow, type PromoRowShare } from './RedesignPromoRow';
import type { UpcomingPromoSurface } from './UpcomingPromoModal';

// Lazy-mounts the hidden ("show all") promo rows. The rows are passed as DATA
// and rendered client-side only after the toggle is opened, so they are NOT in
// the server HTML — this keeps data-rich MLB pages under Bing's 1 MB ceiling
// (the same lazy-mount strategy the calendar uses for games outside its window).
// The visible rows are still server-rendered (crawlable); these hidden rows are
// mostly completed/past promos with low SEO value.
export function LazyPromoRows({
  promos,
  share,
  completed = false,
  showLabel,
  hideLabel,
  team,
  contexts,
  interactive = false,
  surface,
}: {
  promos: Promo[];
  share: PromoRowShare;
  completed?: boolean;
  showLabel: string;
  hideLabel: string;
  /** Forwarded to the rows when they should open the shared game modal. */
  team?: Team;
  /** Per-row resolved contexts, parallel to `promos`. */
  contexts?: (GameContext[] | null)[];
  interactive?: boolean;
  surface?: UpcomingPromoSurface;
}) {
  const [open, setOpen] = useState(false);

  return (
    <div className="mt-3">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        className="inline-flex cursor-pointer items-center gap-2 rounded-full border border-rd-line bg-rd-card px-5 py-2.5 font-rd text-[11px] uppercase tracking-[0.1em] text-rd-ink-soft transition-colors hover:border-rd-line-strong hover:text-rd-ink"
      >
        <span className={`inline-block transition-transform ${open ? 'rotate-90' : ''}`} aria-hidden="true">▸</span>
        {open ? hideLabel : showLabel}
      </button>
      {open && (
        <div className="mt-4 space-y-3">
          {promos.map((promo, i) => (
            <RedesignPromoRow
              key={i}
              promo={promo}
              share={share}
              completed={completed}
              team={team}
              contexts={contexts?.[i] ?? null}
              interactive={interactive}
              surface={surface}
            />
          ))}
        </div>
      )}
    </div>
  );
}
