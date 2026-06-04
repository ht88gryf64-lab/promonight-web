'use client';

import { useState } from 'react';
import type { Promo } from '@/lib/types';
import { RedesignPromoRow, type PromoRowShare } from './RedesignPromoRow';

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
}: {
  promos: Promo[];
  share: PromoRowShare;
  completed?: boolean;
  showLabel: string;
  hideLabel: string;
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
            <RedesignPromoRow key={i} promo={promo} share={share} completed={completed} />
          ))}
        </div>
      )}
    </div>
  );
}
