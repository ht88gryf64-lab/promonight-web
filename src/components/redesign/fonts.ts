import { Archivo } from 'next/font/google';

// Redesign v2 display + body face.
//
// Loaded as the VARIABLE Archivo (no `weight` → full 100–900 wght range) with
// the width axis enabled via `axes: ['wdth']` (62–125). There is no separate
// "Archivo Expanded" family on Google Fonts — the expanded display cut is the
// same family at `font-stretch: 125%`, which `axes: ['wdth']` makes available.
//
// Body and headers use weight 400–800 at the default width; lockups, scoreboard
// numerals, and featured headlines use weight 800–900 with `font-stretch: 125%`
// (see the `.rd-display` / `.rd-numerals` utilities in globals.css).
//
// The CSS variable is attached to a wrapper INSIDE the team page (not the root
// layout's <html>), so the global layout's font vars stay untouched.
export const archivo = Archivo({
  subsets: ['latin'],
  axes: ['wdth'],
  variable: '--font-archivo',
  display: 'swap',
});

// NOTE: the preload:false sibling for the global chrome + redesign homepage lives
// in its OWN module (./fonts-house) ON PURPOSE. next/font preloads a font on every
// route that can REACH it in the module graph, so if the preload:false instance
// shared this file, importing it would also pull THIS preload:true `archivo` into
// the chrome/homepage graph and re-add an Archivo preload to gate-off pages.
