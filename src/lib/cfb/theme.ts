// CFB team theming (Phase 3, decision record — theming engine). Team colors are
// humanConfirmed=false, so render them but never treat as final. The load-bearing
// correctness concern (adversarial check #5): a WHITE or very light primary must
// not wash out against the dark PromoNight chrome. This resolves an accessible
// ACCENT deterministically — if the primary is too light for a dark base, fall
// back to the secondary, then to a safe default — so no page ships an unreadable
// accent regardless of the (unconfirmed) stored colors.

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
  return '#' + rgb.map((v) => Math.max(0, Math.min(255, v)).toString(16).padStart(2, '0')).join('').toUpperCase();
}

// Darken toward black by `amt` (0..1) — used to pull a light color onto a dark base.
function darken(rgb: [number, number, number], amt: number): [number, number, number] {
  return rgb.map((v) => Math.round(v * (1 - amt))) as [number, number, number];
}

export interface CfbTheme {
  primary: string; // as-stored (for chips/badges on light surfaces)
  secondary: string;
  accent: string; // readable accent on the dark PromoNight base
  accentOn: string; // text color to place ON the accent (#fff or #111)
  onDark: string; // a version of the team color guaranteed readable as text on dark chrome
}

const DARK_BASE: [number, number, number] = [17, 17, 17]; // PromoNight dark chrome (~#111)
const SAFE_ACCENT = '#E8A317'; // warm gold fallback (readable on dark, brand-neutral)
const MIN_ON_DARK = 3.0; // AA-large / UI-accent threshold against the dark base

/**
 * Resolve a contrast-safe theme from the school's (unconfirmed) colors. Never
 * returns an accent that washes out on the dark base — a white/very-light primary
 * falls back to the secondary, then a darkened variant, then a safe gold.
 */
export function resolveCfbTheme(primaryHex: string | null, secondaryHex: string | null): CfbTheme {
  const primary = parseHex(primaryHex);
  const secondary = parseHex(secondaryHex);
  const primaryStr = primary ? toHex(primary) : SAFE_ACCENT;
  const secondaryStr = secondary ? toHex(secondary) : '#FFFFFF';

  // pick the first candidate that clears the on-dark contrast floor
  const candidates: ([number, number, number] | null)[] = [primary, secondary, primary ? darken(primary, 0) : null];
  let onDarkRgb: [number, number, number] | null = null;
  for (const c of candidates) {
    if (c && contrastRatio(c, DARK_BASE) >= MIN_ON_DARK) { onDarkRgb = c; break; }
  }
  // still none? darken the primary until it clears (a light color pulled onto dark)
  if (!onDarkRgb && primary) {
    for (let amt = 0.15; amt <= 0.7; amt += 0.1) {
      const d = darken(primary, amt);
      if (contrastRatio(d, DARK_BASE) >= MIN_ON_DARK) { onDarkRgb = d; break; }
    }
  }
  const accent = onDarkRgb ? toHex(onDarkRgb) : SAFE_ACCENT;
  const accentRgb = onDarkRgb || parseHex(SAFE_ACCENT)!;
  const accentOn = contrastRatio(accentRgb, [255, 255, 255]) >= contrastRatio(accentRgb, [17, 17, 17]) ? '#FFFFFF' : '#111111';

  return { primary: primaryStr, secondary: secondaryStr, accent, accentOn, onDark: accent };
}

/** CSS custom properties for the route root (server-rendered; no flash). */
export function cfbThemeVars(theme: CfbTheme): Record<string, string> {
  return {
    '--cfb-primary': theme.primary,
    '--cfb-secondary': theme.secondary,
    '--cfb-accent': theme.accent,
    '--cfb-accent-on': theme.accentOn,
    '--cfb-on-dark': theme.onDark,
  };
}
