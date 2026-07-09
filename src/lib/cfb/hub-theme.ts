// CFB hub rivalry-block color math (§14b — the hub's signature treatment).
// Ported from the approved mockup (CfbHubFinal.jsx) so the divider/fallback
// decisions match the locked visual target exactly: the mockup's SIMPLE
// luminance (raw-channel, not gamma-linearized) and its tuned thresholds
// (0.7 too-light, 0.12 too-close). Do NOT swap in WCAG-linear luminance here —
// it would shift every threshold away from the approved look.
//
// Rules: HOME team = left (62/38 wedge); neutral-site → alphabetical. Each side
// fades primary→secondary top-to-bottom; too-light primary → secondary → #333;
// light secondary damped so the fade bottom doesn't wash out; a DIVIDER line
// fires at the seam when the two primaries are too close in luminance.

export interface SchoolColors {
  primaryColor?: string | null;
  secondaryColor?: string | null;
}

function norm(hex: string | null | undefined): string | null {
  if (!hex) return null;
  const m = hex.replace('#', '').match(/^([0-9a-fA-F]{6})$/);
  return m ? '#' + m[1] : null;
}
function lum(hex: string): number {
  const n = hex.replace('#', '');
  return (0.2126 * parseInt(n.slice(0, 2), 16) + 0.7152 * parseInt(n.slice(2, 4), 16) + 0.0722 * parseInt(n.slice(4, 6), 16)) / 255;
}
// too-light primary → secondary (if dark enough) → a dark neutral.
function prim(c: string, c2: string | null): string {
  return lum(c) > 0.7 ? (c2 && lum(c2) <= 0.7 ? c2 : '#333333') : c;
}
// secondary present + distinct from primary, else fall back to primary.
function sec(c2: string | null, p: string): string {
  return c2 && c2.toLowerCase() !== p.toLowerCase() ? c2 : p;
}
// §14b light-secondary damp: a near-white secondary would wash the fade bottom;
// pull it ~40% toward its own darkened self so it reads as a tint, not a blowout.
function damp(hex: string): string {
  if (lum(hex) <= 0.8) return hex;
  const n = hex.replace('#', '');
  const ch = (i: number) => Math.round(parseInt(n.slice(i, i + 2), 16) * 0.6);
  return '#' + [ch(0), ch(2), ch(4)].map((v) => v.toString(16).padStart(2, '0')).join('');
}
function close(a: string, b: string): boolean {
  return Math.abs(lum(a) - lum(b)) < 0.12;
}

export interface BlockColors {
  pa: string; // home primary (left wedge, dominant)
  pb: string; // away primary (right, dominant)
  sa: string; // home secondary (fade bottom)
  sb: string; // away secondary (fade bottom)
  divider: boolean; // seam divider when the two primaries are too close
}

const SAFE = '#333333';

/** Resolve the four-color, contrast-safe block colors. `a` = home (left), `b` = away. */
export function rivalryBlockColors(a: SchoolColors, b: SchoolColors): BlockColors {
  const ac = norm(a.primaryColor) ?? SAFE;
  const bc = norm(b.primaryColor) ?? SAFE;
  const ac2 = norm(a.secondaryColor);
  const bc2 = norm(b.secondaryColor);
  const pa = prim(ac, ac2);
  const pb = prim(bc, bc2);
  const sa = damp(sec(ac2, pa));
  const sb = damp(sec(bc2, pb));
  return { pa, pb, sa, sb, divider: close(pa, pb) };
}

/** Home team leads (left wedge). Neutral site → alphabetical by display name. */
export function orderRivalrySides<T extends { name: string; isHome?: boolean; neutral?: boolean }>(
  home: T,
  away: T,
  neutral: boolean,
): { a: T; b: T } {
  if (neutral) {
    return home.name.localeCompare(away.name) <= 0 ? { a: home, b: away } : { a: away, b: home };
  }
  return { a: home, b: away };
}
