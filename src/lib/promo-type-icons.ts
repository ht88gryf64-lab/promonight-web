// The promo type icon set (docs/per-promo-pages-v2-spec.md, Visuals 5): one
// stroke glyph per kind of promotion, single colour (currentColor), drawn on
// the 24-unit grid at stroke 2 with round caps and joins, the convention of
// the Tabler set the site already uses. ONE SOURCE for every renderer: the
// web sprite and <use> icon (src/components/promo-icons/PromoTypeIcon.tsx),
// the standalone SVG string for email and cards (promoTypeIconSvg), and the
// review sheet. Eight glyphs are Tabler outline icons (MIT, @tabler/icons
// v3.44); bobblehead, hat and kids are drawn here (reviewed 2026-11-07).
//
// Plain module, client-safe: no fs, no React.

import type { PromoType } from './types';
import { BOBBLEHEAD_RE, FIREWORKS_RE, HAT_RE, JERSEY_RE } from './promo-helpers';

export type PromoIconKey =
  | 'bobblehead'
  | 'jersey'
  | 'hat'
  | 'fireworks'
  | 'food-deal'
  | 'kids'
  | 'heritage'
  | 'fan-appreciation'
  | 'ticket-package'
  | 'theme-night'
  | 'giveaway';

export interface PromoIcon {
  key: PromoIconKey;
  /** The accessible name and the sheet label. */
  title: string;
  /** Stroke paths on the 24-unit grid. */
  paths: string[];
  source: 'tabler' | 'promonight';
}

/** Review order: the spec's list, then the generic giveaway fallback. */
export const PROMO_ICONS: readonly PromoIcon[] = [
  {
    key: 'bobblehead',
    title: 'Bobblehead',
    // A head half the glyph tall on a narrow neck over a small base, two
    // short wobble arcs either side of the head.
    paths: ['M12 2.5a5.5 5.5 0 1 1 0 11a5.5 5.5 0 0 1 0 -11', 'M12 13.5v3.5', 'M8.5 17h7a1 1 0 0 1 1 1v3h-9v-3a1 1 0 0 1 1 -1', 'M4.75 4.6a8 8 0 0 0 0 6.8', 'M19.25 4.6a8 8 0 0 1 0 6.8'],
    source: 'promonight',
  },
  { key: 'jersey', title: 'Jersey', paths: ['M15 4l6 2v5h-3v8a1 1 0 0 1 -1 1h-10a1 1 0 0 1 -1 -1v-8h-3v-5l6 -2a3 3 0 0 0 6 0', 'M10.5 11h2.5l-1.5 5'], source: 'tabler' },
  {
    key: 'hat',
    title: 'Hat',
    // A cap in side profile: the crown rises steeply at the back to the
    // button and slopes forward, the band runs under it, and one bill with
    // its own thickness projects forward past the front.
    paths: ['M6 14c0 -5.5 .5 -9 3 -9c5.5 0 9 4 9 9', 'M9 5v-1.5', 'M6 14h12', 'M18 14h3c1.4 0 2.5 .8 2.5 1.8s-1.1 1.7 -2.5 1.7h-4'],
    source: 'promonight',
  },
  { key: 'fireworks', title: 'Fireworks', paths: ['M16 18a2 2 0 0 1 2 2a2 2 0 0 1 2 -2a2 2 0 0 1 -2 -2a2 2 0 0 1 -2 2m0 -12a2 2 0 0 1 2 2a2 2 0 0 1 2 -2a2 2 0 0 1 -2 -2a2 2 0 0 1 -2 2m-7 12a6 6 0 0 1 6 -6a6 6 0 0 1 -6 -6a6 6 0 0 1 -6 6a6 6 0 0 1 6 6'], source: 'tabler' },
  { key: 'food-deal', title: 'Food deal', paths: ['M5 11h14v-3h-14l0 3', 'M17.5 11l-1.5 10h-8l-1.5 -10', 'M6 8v-1a2 2 0 0 1 2 -2h8a2 2 0 0 1 2 2v1', 'M15 5v-2'], source: 'tabler' },
  {
    key: 'kids',
    title: 'Kids',
    // A balloon: the body an egg, the small knot under it, the string
    // trailing down and to the left.
    paths: ['M6 8a6 6 0 1 1 12 0c0 4.5 -2.7 8 -6 8s-6 -3.5 -6 -8', 'M11 16l1 1.5l1 -1.5', 'M12 17.5c-1 1 -2.5 1.5 -2.5 3.5'],
    source: 'promonight',
  },
  { key: 'heritage', title: 'Heritage night', paths: ['M5 5a5 5 0 0 1 7 0a5 5 0 0 0 7 0v9a5 5 0 0 1 -7 0a5 5 0 0 0 -7 0v-9', 'M5 21v-7'], source: 'tabler' },
  { key: 'fan-appreciation', title: 'Fan appreciation', paths: ['M19.5 12.572l-7.5 7.428l-7.5 -7.428a5 5 0 1 1 7.5 -6.566a5 5 0 1 1 7.5 6.572', 'M12 6l-3.293 3.293a1 1 0 0 0 0 1.414l.543 .543c.69 .69 1.81 .69 2.5 0l1 -1a3.182 3.182 0 0 1 4.5 0l2.25 2.25', 'M12.5 15.5l2 2', 'M15 13l2 2'], source: 'tabler' },
  { key: 'ticket-package', title: 'Ticket package', paths: ['M15 5l0 2', 'M15 11l0 2', 'M15 17l0 2', 'M5 5h14a2 2 0 0 1 2 2v3a2 2 0 0 0 0 4v3a2 2 0 0 1 -2 2h-14a2 2 0 0 1 -2 -2v-3a2 2 0 0 0 0 -4v-3a2 2 0 0 1 2 -2'], source: 'tabler' },
  { key: 'theme-night', title: 'Theme night', paths: ['M4 5h2', 'M5 4v2', 'M11.5 4l-.5 2', 'M18 5h2', 'M19 4v2', 'M15 9l-1 1', 'M18 13l2 -.5', 'M18 19h2', 'M19 18v2', 'M14 16.518l-6.518 -6.518l-4.39 9.58a1 1 0 0 0 1.329 1.329l9.579 -4.39'], source: 'tabler' },
  { key: 'giveaway', title: 'Giveaway', paths: ['M3 9a1 1 0 0 1 1 -1h16a1 1 0 0 1 1 1v2a1 1 0 0 1 -1 1h-16a1 1 0 0 1 -1 -1l0 -2', 'M12 8l0 13', 'M19 12v7a2 2 0 0 1 -2 2h-10a2 2 0 0 1 -2 -2v-7', 'M7.5 8a2.5 2.5 0 0 1 0 -5a4.8 8 0 0 1 4.5 5a4.8 8 0 0 1 4.5 -5a2.5 2.5 0 0 1 0 5'], source: 'tabler' },
];

const BY_KEY = new Map(PROMO_ICONS.map((i) => [i.key, i]));

export function promoIcon(key: PromoIconKey): PromoIcon {
  return BY_KEY.get(key) ?? BY_KEY.get('giveaway')!;
}

/** The sprite symbol id of a key; the <use> href is "#" + this. */
export const promoIconId = (key: PromoIconKey): string => `pn-icon-${key}`;

/** Theme keys that are a heritage night: the groups' own keys end in
 *  -heritage; the named nights are the ones the pipeline keys differently. */
const HERITAGE_RE = /-heritage$|^(black-history|dia-de-los-muertos|lunar-new-year|noche-latina)$/;

export interface PromoIconSubject {
  type: PromoType;
  title: string;
  themeKey?: string | null;
  /** An NHL or NBA special-ticket row. */
  ticketPackage?: boolean | null;
}

/** The icon for a promo: the package first, then the theme the pipeline
 *  keyed (fan appreciation, a heritage night), fireworks on any night, the
 *  item of a gate giveaway, else the kind of night. Every promo gets one. */
export function promoIconKey(p: PromoIconSubject): PromoIconKey {
  if (p.ticketPackage === true) return 'ticket-package';
  const theme = p.themeKey && p.themeKey !== 'none' ? p.themeKey : null;
  if (theme === 'fan-appreciation') return 'fan-appreciation';
  if (theme && HERITAGE_RE.test(theme)) return 'heritage';
  if (FIREWORKS_RE.test(p.title)) return 'fireworks';
  if (p.type === 'giveaway') {
    if (BOBBLEHEAD_RE.test(p.title)) return 'bobblehead';
    if (JERSEY_RE.test(p.title)) return 'jersey';
    if (HAT_RE.test(p.title)) return 'hat';
    return 'giveaway';
  }
  if (p.type === 'theme') return 'theme-night';
  if (p.type === 'food') return 'food-deal';
  if (p.type === 'kids') return 'kids';
  return 'giveaway';
}

/** A standalone inline SVG of one icon, for email, cards and the review
 *  sheet: no sprite needed, the colour baked in. */
export function promoTypeIconSvg(key: PromoIconKey, opts: { size?: number; color?: string; strokeWidth?: number; title?: boolean } = {}): string {
  const icon = promoIcon(key);
  const size = opts.size ?? 24;
  const color = opts.color ?? 'currentColor';
  const sw = opts.strokeWidth ?? 2;
  const title = opts.title ? `<title>${icon.title}</title>` : '';
  const aria = opts.title ? ` role="img" aria-label="${icon.title}"` : ' aria-hidden="true"';
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="${color}" stroke-width="${sw}" stroke-linecap="round" stroke-linejoin="round"${aria}>${title}${icon.paths.map((d) => `<path d="${d}"/>`).join('')}</svg>`;
}

/** The whole set as one sprite document (symbols), for the review sheet and
 *  any static host; the page renders the same symbols through
 *  PromoTypeSprite. */
export function promoTypeSpriteSvg(): string {
  return `<svg xmlns="http://www.w3.org/2000/svg" width="0" height="0" style="position:absolute" aria-hidden="true">${PROMO_ICONS.map((i) => `<symbol id="${promoIconId(i.key)}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">${i.paths.map((d) => `<path d="${d}"/>`).join('')}</symbol>`).join('')}</svg>`;
}
