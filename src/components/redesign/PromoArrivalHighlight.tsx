'use client';

import { useEffect } from 'react';

// Deep-link arrival effect for team-page promo rows. When the page loads (or the
// hash changes) with a #promo-… fragment — e.g. arriving from a /promos/today
// card or a venue hub "Promos this week" card at
// /[sport]/[team]#promo-2026-07-18-slider-bobblehead — scroll the matching
// RedesignPromoRow into view and flash a brand-red ring so the visitor sees they
// landed on the right promo.
//
// TWO-STAGE LOOKUP. Stage 1 is the original behavior: find the row by id and
// flash it. Stage 2 exists because the team page only server-renders anchor ids
// for the first UPCOMING_VISIBLE upcoming rows; every row past that is
// client-mounted behind the "show all upcoming" expander and is simply not in the
// DOM when the visitor arrives. A link into a heavy week therefore missed and
// dumped the visitor at the top of the page — the earlier assumption that
// today/tomorrow promos are always inside the visible set does not generalize to
// a 7-day window (a 15-promo week at one ballpark is enough to break it). On a
// miss we now open that expander, the same button a user would click, and retry
// the lookup while React commits the rows.
//
// Both stages are gated on an UNMATCHED #promo- hash: a page load with no promo
// hash, or an arrival at a row that is already in the DOM, returns before any of
// this and never touches the expander. The aria-expanded check means an
// already-open list is never toggled shut. If the row is still missing after
// expanding — a genuinely absent promo, e.g. a stale link to something past or
// tombstoned — we collapse the list again and fall back to the original graceful
// no-op, so the visitor lands at the top of a page that looks exactly as it
// would have with no hash at all. The brief expand/collapse is confined to that
// error path; a permanently expanded list on every stale deep link would be the
// worse trade.

// ~30 frames (half a second at 60fps) is far more than a client re-render needs,
// and it costs nothing when the row appears on the first retry.
const MAX_RETRY_FRAMES = 30;

export function PromoArrivalHighlight() {
  useEffect(() => {
    let raf = 0;

    const highlight = (el: HTMLElement) => {
      el.scrollIntoView({ behavior: 'smooth', block: 'center' });
      el.classList.remove('promo-arrival-flash');
      // Force reflow so re-adding the class restarts the animation on repeat taps.
      void el.offsetWidth;
      el.classList.add('promo-arrival-flash');
      window.setTimeout(() => el.classList.remove('promo-arrival-flash'), 3000);
    };

    const tryFlash = (id: string): boolean => {
      const el = document.getElementById(id);
      if (!el) return false;
      highlight(el);
      return true;
    };

    const flash = () => {
      const hash = window.location.hash;
      if (!hash.startsWith('#promo-')) return;
      let id: string;
      try {
        id = decodeURIComponent(hash.slice(1));
      } catch {
        id = hash.slice(1);
      }

      // Stage 1 — the row is server-rendered. Unchanged from before.
      if (tryFlash(id)) return;

      // Stage 2 — the row may be a lazy-mounted upcoming row. Only the group
      // that carries anchor ids is tagged, so the completed-promos expander is
      // never opened by an arrival.
      const expander = document.querySelector<HTMLButtonElement>('button[data-promo-anchors]');
      if (!expander || expander.getAttribute('aria-expanded') !== 'false') return;
      expander.click();

      let frames = 0;
      const retry = () => {
        // Found: leave the list open. The visitor is looking at a row inside it.
        if (tryFlash(id)) return;
        if (++frames > MAX_RETRY_FRAMES) {
          // Genuinely absent. Put the list back the way we found it: a failed
          // lookup the visitor never asked for must leave no trace, and a stale
          // link should show the team page in its normal collapsed state rather
          // than silently expanded to every upcoming promo.
          expander.click();
          return;
        }
        raf = window.requestAnimationFrame(retry);
      };
      raf = window.requestAnimationFrame(retry);
    };

    // Defer one frame so the target row is in the DOM and layout has settled.
    const t = window.setTimeout(flash, 80);
    window.addEventListener('hashchange', flash);
    return () => {
      window.clearTimeout(t);
      if (raf) window.cancelAnimationFrame(raf);
      window.removeEventListener('hashchange', flash);
    };
  }, []);

  return null;
}
