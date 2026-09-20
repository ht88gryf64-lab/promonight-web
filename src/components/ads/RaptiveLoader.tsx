'use client';

import { useEffect } from 'react';

/**
 * Loads Raptive's ads.min.js AFTER hydration. Renders nothing.
 *
 * WHY THIS IS NOT IN THE HEAD ANY MORE. Raptive's stock head snippet creates
 * the ads.min.js <script> immediately. On a connection where that script beats
 * the app's own JavaScript, Raptive inserts its ad containers into DOM that
 * React has not hydrated yet. React then finds nodes the server never rendered,
 * throws minified error #418, discards the server DOM and rebuilds <main>, and
 * every ad unit is deleted with it. Raptive does not place them again. That is
 * known-issues entry 50, reproduced on every template, and the
 * `hydration_mismatch` event measured it at 10 of the first 45 pageviews.
 *
 * An effect in the root layout cannot run until React has committed the
 * hydrated tree, so the loader cannot start the race it used to lose. The cost
 * is that ads start later by roughly the hydration time.
 *
 * WHAT RAPTIVE REQUIRES, AND WHY THIS STILL MEETS IT. The tag must run once per
 * document load and must NOT re-run on client-side route changes; their code
 * detects route changes itself. The root layout persists across App Router
 * navigations, so this effect runs once per document. The window flag covers
 * the cases where React runs an effect twice anyway (Strict Mode, a remount
 * after an error boundary resets).
 *
 * THE SPLIT. The head keeps Raptive's stub, the four lines that set
 * window.adthrive, .cmd, .plugin and .host. Their runtime reads those on load
 * and other code may push to cmd early, so they stay first in the document.
 * Only the script-element creation moved here, and it is their code line for
 * line: same src, same async, same referrerpolicy line, same cb param, same
 * insertBefore-the-first-script. Do not "tidy" it.
 *
 * Two things that look like mistakes and are not:
 *  - `s.referrerpolicy = ...` is lowercase, exactly as Raptive wrote it. It
 *    sets an expando, not the referrerPolicy attribute. Reproduced rather than
 *    corrected, because correcting it would change what referrer their script
 *    request carries compared with every other Raptive site.
 *  - data-no-optimize and data-cfasync sat on the inline <script> tag, not on
 *    the element it created. They are set on this element as well so that
 *    Cloudflare and optimizer plugins leave the loader alone wherever it lives.
 */

// `typeof globalThis` because their snippet calls w.encodeURIComponent, which
// lib.dom does not declare on Window.
type RaptiveWindow = Window & typeof globalThis & {
  adthrive?: { host?: string };
  __pnRaptiveLoaderRan?: boolean;
};

export function RaptiveLoader() {
  useEffect(() => {
    const w = window as RaptiveWindow;
    if (w.__pnRaptiveLoaderRan) return;
    w.__pnRaptiveLoaderRan = true;

    try {
      const d = document;
      // The head stub always sets host. The literal is only a floor so a
      // missing stub degrades to "ads load" rather than to a thrown effect.
      const host = w.adthrive?.host ?? 'ads.adthrive.com';

      const s = d.createElement('script');
      s.async = true;
      (s as HTMLScriptElement & { referrerpolicy?: string }).referrerpolicy =
        'no-referrer-when-downgrade';
      s.setAttribute('data-no-optimize', '1');
      s.setAttribute('data-cfasync', 'false');
      s.src =
        'https://' +
        host +
        '/sites/6a9989924f70265a058c50b1/ads.min.js?referrer=' +
        w.encodeURIComponent(w.location.href) +
        '&cb=' +
        (Math.floor(Math.random() * 100) + 1);
      const n = d.getElementsByTagName('script')[0];
      n.parentNode?.insertBefore(s, n);
    } catch {
      // An ad loader must never take the page down with it.
    }
  }, []);

  return null;
}
