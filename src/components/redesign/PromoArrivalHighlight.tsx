'use client';

import { useEffect } from 'react';

// Deep-link arrival effect for team-page promo rows. When the page loads (or the
// hash changes) with a #promo-… fragment — e.g. arriving from a /promos/today
// card link /[sport]/[team]#promo-2026-07-18-slider-bobblehead — scroll the
// matching RedesignPromoRow into view and flash a brand-red ring so the visitor
// sees they landed on the right promo. No-op when there is no promo hash or no
// matching element (server-rendered visible rows carry the id; today/tomorrow
// promos are always the earliest upcoming, so they are in that set).
export function PromoArrivalHighlight() {
  useEffect(() => {
    const flash = () => {
      const hash = window.location.hash;
      if (!hash.startsWith('#promo-')) return;
      let id: string;
      try {
        id = decodeURIComponent(hash.slice(1));
      } catch {
        id = hash.slice(1);
      }
      const el = document.getElementById(id);
      if (!el) return;
      el.scrollIntoView({ behavior: 'smooth', block: 'center' });
      el.classList.remove('promo-arrival-flash');
      // Force reflow so re-adding the class restarts the animation on repeat taps.
      void el.offsetWidth;
      el.classList.add('promo-arrival-flash');
      window.setTimeout(() => el.classList.remove('promo-arrival-flash'), 3000);
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
