import type { CSSProperties } from 'react';

// Visual-pass primitives for the rivalry cards (index rows + sibling rail),
// translated from the approved mockup (docs/cfb-rivalries-mockup.html, not
// committed) into the site's token system. Server-rendered, decorative only.
// Colors are the two schools' STORED primaryColor values passed per card as
// CSS custom properties; a missing side (untracked school, absent field)
// falls back to a single neutral spine in the existing border token. No color
// inference, ever. Raw team color as a decorative fill carries no contrast
// requirement (the SchoolCard precedent in RivalryMatchupPage).

/** Mockup gold, the rivalry-family accent for trophies and day labels. */
export const GOLD = '#d9a441';
/** Site CFB accent red (src/app/cfb/page.tsx RED) — where the mockup says
 *  "red", the site's own token wins over the mockup's ad-hoc #e5484d. */
export const RED = '#e0492e';
/** Condensed display stack for rivalry names and section headings. Barlow
 *  Condensed loads via next/font (fonts.ts), scoped to the rivalry pages'
 *  wrappers; zero render-blocking link tags. */
export const CONDENSED = 'var(--font-cfb-condensed), var(--font-outfit-sans), system-ui, sans-serif';

/** Card-level style carrying the two spine colors as custom properties
 *  (mockup: `style="--c1:…; --c2:…"`). Empty when either side is missing so
 *  the fallback spine inherits nothing. */
export function spineVars(colors: [string | null, string | null]): CSSProperties {
  const [a, b] = colors;
  if (!a || !b) return {};
  return { '--spine-a': a, '--spine-b': b } as CSSProperties;
}

/** 5px left spine, diagonal two-color split — the mockup's exact geometry:
 *  `linear-gradient(160deg, c1 0 48%, c2 52% 100%)` (a 4% blend band, no
 *  seam). The host card must be `relative overflow-hidden` so the spine
 *  clips to the rounded corner. */
export function Spine({ colors }: { colors: [string | null, string | null] }) {
  const [a, b] = colors;
  const split = !!a && !!b;
  return (
    <span
      aria-hidden
      className="pointer-events-none absolute inset-y-0 left-0 w-[5px]"
      style={
        split
          ? { background: 'linear-gradient(160deg, var(--spine-a) 0% 48%, var(--spine-b) 52% 100%)' }
          : { background: 'rgba(255,255,255,0.10)' }
      }
    />
  );
}

/** The Rivalry Week card wash — the mockup's ::after, verbatim: two fixed
 *  120x80px corner radials at 14% color-mix. Renders nothing unless both
 *  colors exist. Content spans must be `relative` so they paint above it. */
export function RivalryWash({ colors }: { colors: [string | null, string | null] }) {
  const [a, b] = colors;
  if (!a || !b) return null;
  return (
    <span
      aria-hidden
      className="pointer-events-none absolute inset-0"
      style={{
        background:
          'radial-gradient(120px 80px at 0% 0%, color-mix(in srgb, var(--spine-a) 14%, transparent), transparent 70%), radial-gradient(120px 80px at 100% 100%, color-mix(in srgb, var(--spine-b) 14%, transparent), transparent 70%)',
      }}
    />
  );
}
