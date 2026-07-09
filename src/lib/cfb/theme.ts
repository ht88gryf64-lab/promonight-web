// CFB team theming (Phase 3 — immersive treatment, approved mockup). The mockup
// bleeds the FULL team color from above the hero fold into the dark base, uses a
// team-colored readable accent for text/labels, and a saturated primary gradient
// for the signature card. This module reproduces that look DETERMINISTICALLY and
// CONTRAST-SAFELY across all 86 palettes (colors are humanConfirmed=false):
//
//  - HERO WASH: a radial gradient of the team color, but the wash color is darkened
//    until white hero text holds even at full strength (a light maize primary
//    becomes a deep gold wash; a dark navy stays navy). The bright point sits above
//    the content (y≈-12%), so text lands in the faded zone.
//  - ACCENT: prefer a chromatic secondary readable on dark (Minnesota gold); else a
//    chromatic primary readable on dark (Michigan maize); else LIGHTEN the primary,
//    keeping its hue, until it reads (navy→light blue, purple→lavender) — never a
//    generic gold unless the palette is truly neutral (white/black).
//  - SIGNATURE CARD: the dark-safe wash colors as a gradient with white text.
//
// The mockup only shows Minnesota (maroon) and Penn State (navy); this must ALSO
// hold on white/light primaries, very dark primaries, and clashing hues.

const HEX = /^#?([0-9a-fA-F]{6})$/;

function parseHex(c: string | null | undefined): [number, number, number] | null {
  if (!c) return null;
  const m = c.match(HEX);
  if (!m) return null;
  const n = parseInt(m[1], 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

// Relative luminance (WCAG). 0 = black, 1 = white.
function luminance(rgb: [number, number, number]): number {
  const [r, g, b] = rgb.map((v) => {
    const s = v / 255;
    return s <= 0.03928 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4);
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

function contrastRatio(a: [number, number, number], b: [number, number, number]): number {
  const la = luminance(a) + 0.05;
  const lb = luminance(b) + 0.05;
  return la > lb ? la / lb : lb / la;
}

function toHex(rgb: [number, number, number]): string {
  return '#' + rgb.map((v) => Math.max(0, Math.min(255, Math.round(v))).toString(16).padStart(2, '0')).join('').toUpperCase();
}

// Darken toward black by `amt` (0..1).
function darken(rgb: [number, number, number], amt: number): [number, number, number] {
  return rgb.map((v) => Math.round(v * (1 - amt))) as [number, number, number];
}
// Lighten toward white by `amt` (0..1).
function lighten(rgb: [number, number, number], amt: number): [number, number, number] {
  return rgb.map((v) => Math.round(v + (255 - v) * amt)) as [number, number, number];
}
// Chroma proxy — max-min channel spread. Low = near-neutral (white/gray/black).
function chroma(rgb: [number, number, number]): number {
  return Math.max(...rgb) - Math.min(...rgb);
}
function isNearNeutral(rgb: [number, number, number]): boolean {
  return chroma(rgb) < 26;
}
// Darken until luminance drops to/under `maxL` (bounded iterations).
function darkenToLuma(rgb: [number, number, number], maxL: number): [number, number, number] {
  let c = rgb;
  for (let i = 0; i < 18 && luminance(c) > maxL; i++) c = darken(c, 0.1);
  return c;
}
// Lighten (toward white) until the color reads on `base` at `min` contrast. Used
// for card-safe label text (readability > vividness for tiny text).
function lightenToContrast(rgb: [number, number, number], base: [number, number, number], min: number): [number, number, number] {
  let c = rgb;
  for (let i = 0; i < 18 && contrastRatio(c, base) < min; i++) c = lighten(c, 0.12);
  return c;
}

function rgbToHsl([r, g, b]: [number, number, number]): [number, number, number] {
  r /= 255; g /= 255; b /= 255;
  const max = Math.max(r, g, b), min = Math.min(r, g, b);
  let h = 0, s = 0; const l = (max + min) / 2; const d = max - min;
  if (d) {
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
    switch (max) {
      case r: h = (g - b) / d + (g < b ? 6 : 0); break;
      case g: h = (b - r) / d + 2; break;
      default: h = (r - g) / d + 4;
    }
    h /= 6;
  }
  return [h, s, l];
}
function hslToRgb([h, s, l]: [number, number, number]): [number, number, number] {
  if (!s) { const v = Math.round(l * 255); return [v, v, v]; }
  const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
  const p = 2 * l - q;
  const hk = (t: number) => {
    if (t < 0) t += 1; if (t > 1) t -= 1;
    if (t < 1 / 6) return p + (q - p) * 6 * t;
    if (t < 1 / 2) return q;
    if (t < 2 / 3) return p + (q - p) * (2 / 3 - t) * 6;
    return p;
  };
  return [Math.round(hk(h + 1 / 3) * 255), Math.round(hk(h) * 255), Math.round(hk(h - 1 / 3) * 255)] as [number, number, number];
}
// Lift a too-dark team color into a VIVID readable accent, keeping its hue and
// boosting saturation (navy→sky blue, purple→lavender) instead of graying it
// toward white. Raises lightness until it clears `min` contrast on `base`.
function vividAccent(rgb: [number, number, number], base: [number, number, number], min: number): [number, number, number] {
  const [h, s0] = rgbToHsl(rgb);
  const s = Math.min(1, Math.max(s0, 0.55));
  let out = hslToRgb([h, s, 0.62]);
  for (let l = 0.55; l <= 0.9; l += 0.04) {
    out = hslToRgb([h, s, l]);
    if (contrastRatio(out, base) >= min) break;
  }
  return out;
}
const rgba = (c: [number, number, number], a: number) => `rgba(${c[0]}, ${c[1]}, ${c[2]}, ${a})`;

export interface CfbTheme {
  primary: string; // raw team primary (solid fills, date chips)
  primaryDeep: string; // darkened primary (depth)
  accent: string; // team-colored, readable-on-dark accent (text/labels/tags)
  accentInk: string; // text ON the accent when used as a fill
  accentCard: string; // accent lifted to read on the (saturated) signature-card gradient
  heroWash: string; // full radial-gradient() — the immersive primary wash
  heroGlow: string; // full radial-gradient() — the accent glow
  cardFrom: string; // signature-card gradient start (dark-safe)
  cardTo: string; // signature-card gradient end
  onPrimary: string; // text on the signature card (white — cardFrom is dark-safe)
  tint: string; // rgba(primary, low) — schedule rivalry-row wash
  rivalryFrom: string; // rgba(primary, low) — rivalry-card gradient start
  rivalryBorder: string; // rgba(primary, mid) — rivalry-card border
}

const DARK_BASE: [number, number, number] = [17, 17, 17]; // conservative floor base
const SAFE_ACCENT = '#E8A317'; // warm gold fallback for truly neutral palettes
const MIN_ACCENT = 4.5; // accent doubles as small mono-label text → AA (4.5:1) on dark
const ACCENT_VIVID = 5.2; // lifted-hue accents aim above the floor → vivid, not slate-on-the-line
const WASH_MAX_LUMA = 0.13; // wash top color ceiling → white hero text holds (~5.8:1)

/**
 * Resolve a contrast-safe, mockup-accurate immersive theme from the school's
 * (unconfirmed) colors.
 */
export function resolveCfbTheme(primaryHex: string | null, secondaryHex: string | null): CfbTheme {
  const primary = parseHex(primaryHex);
  const secondary = parseHex(secondaryHex);
  const pRgb = primary || parseHex(SAFE_ACCENT)!;
  const sRgb = secondary;

  // ── ACCENT — team-colored, readable on dark (the mockup's accentReadable) ──
  let accentRgb: [number, number, number];
  if (sRgb && !isNearNeutral(sRgb) && contrastRatio(sRgb, DARK_BASE) >= MIN_ACCENT) {
    accentRgb = sRgb; // chromatic secondary that already reads (Minnesota gold)
  } else if (!isNearNeutral(pRgb) && contrastRatio(pRgb, DARK_BASE) >= MIN_ACCENT) {
    accentRgb = pRgb; // chromatic primary that reads (Michigan maize)
  } else if (!isNearNeutral(pRgb)) {
    accentRgb = vividAccent(pRgb, DARK_BASE, ACCENT_VIVID); // lift primary hue, vivid (navy→sky, purple→lavender)
  } else if (sRgb && !isNearNeutral(sRgb)) {
    accentRgb = vividAccent(sRgb, DARK_BASE, ACCENT_VIVID); // lift secondary hue, vivid
  } else {
    accentRgb = parseHex(SAFE_ACCENT)!; // truly neutral palette (white/black)
  }
  const accent = toHex(accentRgb);
  const accentInk = contrastRatio(accentRgb, [255, 255, 255]) >= contrastRatio(accentRgb, [17, 17, 17]) ? '#FFFFFF' : '#111111';

  // ── HERO WASH — immersive, dark-safe. The wash HUE cascades like the accent so a
  //    neutral (white/black) primary with a chromatic secondary still carries a team
  //    color instead of collapsing to gray; only a fully-neutral palette goes gray.
  //    The wash COLOR is then darkened for light primaries so white hero text holds. ──
  const washSource = !isNearNeutral(pRgb) ? pRgb : (sRgb && !isNearNeutral(sRgb) ? sRgb : pRgb);
  const washTop = darkenToLuma(washSource, WASH_MAX_LUMA);
  const washDeep = darken(washTop, 0.5);
  // Accent lifted to read as small text ON the saturated card gradient (accent on
  // a bright-primary card can dip below AA; this variant never does).
  const accentCard = toHex(lightenToContrast(accentRgb, washTop, MIN_ACCENT + 0.1));
  const heroWash = `radial-gradient(ellipse 92% 72% at 28% -12%, ${toHex(washTop)} 0%, ${rgba(washDeep, 0.87)} 34%, transparent 76%)`;
  const heroGlow = `radial-gradient(ellipse 60% 50% at 86% 8%, ${rgba(accentRgb, 0.16)} 0%, transparent 60%)`;

  // ── SIGNATURE CARD — deep team gradient, white text (washTop is dark-safe) ──
  const cardFrom = toHex(washTop);
  const cardTo = toHex(washDeep);
  const onPrimary = '#FFFFFF';

  return {
    primary: toHex(pRgb),
    primaryDeep: toHex(darken(pRgb, 0.55)),
    accent,
    accentInk,
    accentCard,
    heroWash,
    heroGlow,
    cardFrom,
    cardTo,
    onPrimary,
    tint: rgba(pRgb, 0.12),
    rivalryFrom: rgba(pRgb, 0.16),
    rivalryBorder: rgba(pRgb, 0.4),
  };
}

/** CSS custom properties for the route root (server-rendered; no flash). */
export function cfbThemeVars(theme: CfbTheme): Record<string, string> {
  return {
    '--cfb-primary': theme.primary,
    '--cfb-primary-deep': theme.primaryDeep,
    '--cfb-accent': theme.accent,
    '--cfb-accent-ink': theme.accentInk,
    '--cfb-accent-card': theme.accentCard,
    '--cfb-accent-on': theme.accentInk, // legacy alias (contribute flow)
    '--cfb-hero-wash': theme.heroWash,
    '--cfb-hero-glow': theme.heroGlow,
    '--cfb-card-from': theme.cardFrom,
    '--cfb-card-to': theme.cardTo,
    '--cfb-on-primary': theme.onPrimary,
    '--cfb-tint': theme.tint,
    '--cfb-rivalry-from': theme.rivalryFrom,
    '--cfb-rivalry-border': theme.rivalryBorder,
  };
}
