import { Barlow_Condensed } from 'next/font/google';

// The rivalry-family condensed display face (visual pass): rivalry names and
// section headings on /cfb/rivalries and the matchup pages, always all-caps.
// Loaded via next/font (self-hosted, zero render-blocking link tags).
//
// OWN MODULE, not cfb/fonts.ts, and this matters: next/font preloads follow
// the IMPORT GRAPH, not usage — scoping the CSS variable to a page wrapper
// scopes rendering only (the fonts-house.ts precedent, and the exact leak the
// visual-pass review caught: co-locating this with instrumentSerif preloaded
// 4 Barlow woff2s onto the hub + 86 school pages and 2 Instrument Serif files
// onto the 33 rivalry URLs, none of which render those faces). Import this
// from the rivalry tree ONLY. Weights 600/700/800 — the only cuts the rivalry
// templates use (semibold/bold/extrabold); no 500.
export const barlowCondensed = Barlow_Condensed({
  weight: ['600', '700', '800'],
  subsets: ['latin'],
  variable: '--font-cfb-condensed',
  display: 'swap',
});
