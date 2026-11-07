// Team-color theming for the promo page (docs/per-promo-pages-v2-spec.md,
// Visuals 1). ONE SOURCE: the team doc's primaryColor and secondaryColor, as
// mapTeamDoc (src/lib/data.ts) turns them into hex, the same two values the
// tier 3 card route and the share card read. Nothing here reads the venues
// collection's own colour copy.
//
// THE GATE. A candidate colour is used only when text on it clears WCAG AA
// (4.5:1 for white or for the house ink, whichever is higher) AND it clears
// 3:1 against the page ground, so a thin band or a badge is visible on the
// cream surface (a white or cream secondary never passes). Primary first,
// then secondary, else the house red. Text IN the colour on the ground
// (the date numeral) is the colour only when it clears 4.5:1 there; the
// house ink otherwise. Pure, no React.

import { relLuminance } from './chip-contrast';

export const HOUSE_RED = '#da2d20'; // --color-rd-red
export const HOUSE_INK = '#211d18'; // --color-rd-ink
export const PAGE_GROUND = '#f7f3ea'; // --color-rd-cream
const WHITE = '#ffffff';
export const AA_TEXT = 4.5;
export const AA_UI = 3;

const HEX_RE = /^#[0-9a-f]{6}$/i;

export function isHex(v: unknown): v is string {
  return typeof v === 'string' && HEX_RE.test(v);
}

export function contrastRatio(a: string, b: string): number {
  const la = relLuminance(a);
  const lb = relLuminance(b);
  return (Math.max(la, lb) + 0.05) / (Math.min(la, lb) + 0.05);
}

/** White or the house ink, whichever reads better on `bg`, when either clears
 *  AA text contrast; null when neither does. */
export function inkFor(bg: string): string | null {
  const w = contrastRatio(bg, WHITE);
  const d = contrastRatio(bg, HOUSE_INK);
  const best = w >= d ? [WHITE, w] : [HOUSE_INK, d];
  return (best[1] as number) >= AA_TEXT ? (best[0] as string) : null;
}

export interface PromoPageTheme {
  /** The accent: badge and CTA ground, the band, the section rules. */
  accent: string;
  /** Text on the accent. */
  accentInk: string;
  /** The accent as text on the page ground, or the house ink when it fails. */
  accentText: string;
  source: 'primary' | 'secondary' | 'house';
}

export function promoPageTheme(team: { primaryColor?: string | null; secondaryColor?: string | null }): PromoPageTheme {
  const candidates: [unknown, PromoPageTheme['source']][] = [
    [team.primaryColor, 'primary'],
    [team.secondaryColor, 'secondary'],
  ];
  for (const [c, source] of candidates) {
    if (!isHex(c)) continue;
    const ink = inkFor(c);
    if (!ink) continue;
    if (contrastRatio(c, PAGE_GROUND) < AA_UI) continue;
    const accent = c.toLowerCase();
    return { accent, accentInk: ink, accentText: contrastRatio(accent, PAGE_GROUND) >= AA_TEXT ? accent : HOUSE_INK, source };
  }
  return { accent: HOUSE_RED, accentInk: WHITE, accentText: contrastRatio(HOUSE_RED, PAGE_GROUND) >= AA_TEXT ? HOUSE_RED : HOUSE_INK, source: 'house' };
}

/** The CSS custom properties the page sets on its article; the classes read
 *  them (bg-[var(--pp-accent)] and so on). */
export function themeStyle(t: PromoPageTheme): Record<`--${string}`, string> {
  return { '--pp-accent': t.accent, '--pp-accent-ink': t.accentInk, '--pp-accent-text': t.accentText };
}
