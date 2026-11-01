'use client';

import { useEffect } from 'react';

// Deep-link arrival effect for team-page promo rows. When the page loads (or the
// hash changes) with a #promo-… fragment — e.g. arriving from a /promos/today
// card or a venue hub "Promos this week" card at
// /[sport]/[team]#promo-2026-07-18-slider-bobblehead — scroll the matching
// RedesignPromoRow into view and flash a brand-red ring so the visitor sees they
// landed on the right promo.
//
// ONE LOOKUP (since 2026-10-31). Every upcoming row is server-rendered, the
// ones past UPCOMING_VISIBLE inside a closed <details>, so the row is in the
// DOM when the visitor arrives: find it, open its <details> if it sits in one,
// flash it. The earlier second stage (click the lazy "show all" expander and
// retry while React mounted the rows) went with the lazy mount. A stale link
// that matches no row is a no-op: the page looks as it would with no hash.

export function PromoArrivalHighlight() {
  useEffect(() => {
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
      // A row past the first few sits in a closed <details>: the upcoming
      // promos past UPCOMING_VISIBLE (PromoList, data-promo-anchors) or the
      // ticket packages past the first four (TicketPackageList). Open that one
      // group, and only that one: no other <details> on a team page is touched
      // by an arrival.
      const group = el.closest<HTMLDetailsElement>('details[data-promo-anchors], details[data-ticket-packages]');
      if (group && !group.open) group.open = true;
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
      // Every row a deep link can target is server-rendered (the upcoming rows
      // since 2026-10-31; the completed rows carry no anchor), so one lookup
      // is the whole job. A stale link that matches no row changes nothing.
      tryFlash(id);
    };

    // Defer one frame so the target row is in the DOM and layout has settled.
    const t = window.setTimeout(flash, 80);
    window.addEventListener('hashchange', flash);
    return () => {
      window.clearTimeout(t);
      window.removeEventListener('hashchange', flash);
    };
  }, []);

  return null;
}
