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
