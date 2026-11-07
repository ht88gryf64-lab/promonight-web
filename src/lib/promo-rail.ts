// The promo rail's data (docs/per-promo-pages-v2-spec.md, Visuals 3): the
// team's next promos as cards, each with its type icon, its name and a mini
// date tile, linking through the promo page href. ONE shaper for both
// renderers: the web rail (src/components/promo-rail/PromoRail.tsx) and the
// email digest (promoRailEmailHtml, inline-styled table HTML in the digest's
// own idiom, src/lib/digest-email.ts). Pure, client-safe.

import type { PromoType } from './types';
import { dateBlock } from './promo-page-copy';
import { promoIconKey, promoTypeIconSvg, type PromoIconKey } from './promo-type-icons';

export interface PromoRailSource {
  /** The promo page href (src/lib/promo-page-href.ts promoPageHref, or the
   *  server loader's link()); a source without one is not a card. */
  href: string | null;
  title: string;
  date: string;
  type: PromoType;
  themeKey?: string | null;
  ticketPackage?: boolean | null;
}

export interface PromoRailItem {
  href: string;
  title: string;
  date: string;
  icon: PromoIconKey;
  month: string;
  day: string;
  weekday: string;
}

export const RAIL_MAX = 5;
/** Below this many cards the rail is not a rail and renders nothing. */
export const RAIL_MIN = 2;

/** The cards, in the order given, up to RAIL_MAX; an empty list below RAIL_MIN. */
export function promoRailItems(sources: readonly PromoRailSource[], max: number = RAIL_MAX): PromoRailItem[] {
  const items: PromoRailItem[] = [];
  for (const s of sources) {
    if (!s.href || !s.title.trim() || !/^\d{4}-\d{2}-\d{2}$/.test(s.date)) continue;
    const d = dateBlock(s.date);
    items.push({ href: s.href, title: s.title.trim(), date: s.date, icon: promoIconKey({ type: s.type, title: s.title, themeKey: s.themeKey, ticketPackage: s.ticketPackage }), month: d.month, day: String(Number(d.day)), weekday: d.weekday });
    if (items.length >= max) break;
  }
  return items.length >= RAIL_MIN ? items : [];
}

const escapeHtml = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

/** The rail as email HTML: one table, one cell per card, inline styles only,
 *  the icon inline (clients that drop SVG show the name and the date, which
 *  is the card). `toUrl` makes each href absolute (and tagged) the way the
 *  digest does. Empty string below RAIL_MIN, like the web rail. */
export function promoRailEmailHtml(items: readonly PromoRailItem[], opts: { toUrl: (href: string) => string; font?: string; ink?: string; muted?: string; accent?: string; line?: string }): string {
  if (items.length < RAIL_MIN) return '';
  const font = opts.font ?? 'Helvetica Neue, Helvetica, Arial, sans-serif';
  const ink = opts.ink ?? '#211d18';
  const muted = opts.muted ?? '#786e60';
  const accent = opts.accent ?? '#da2d20';
  const line = opts.line ?? '#e6e0d4';
  const cells = items
    .map((it) => {
      const url = escapeHtml(opts.toUrl(it.href));
      return `<td valign="top" style="padding:0 8px 0 0;"><table role="presentation" cellpadding="0" cellspacing="0" border="0" style="border-collapse:collapse;width:150px;"><tr><td bgcolor="#ffffff" style="background:#ffffff;border:1px solid ${line};border-radius:12px;padding:10px 12px;font-family:${font};"><a href="${url}" style="text-decoration:none;color:${ink};display:block;"><div style="font-size:10px;letter-spacing:0.1em;line-height:14px;color:${muted};">${it.weekday} ${it.month}</div><div style="font-size:26px;font-weight:700;line-height:28px;color:${ink};">${it.day}</div><div style="margin-top:8px;color:${accent};line-height:0;">${promoTypeIconSvg(it.icon, { size: 16, color: accent })}</div><div style="margin-top:6px;font-size:14px;font-weight:600;line-height:18px;color:${ink};">${escapeHtml(it.title)}</div></a></td></tr></table></td>`;
    })
    .join('');
  return `<table role="presentation" cellpadding="0" cellspacing="0" border="0" style="border-collapse:collapse;"><tr>${cells}</tr></table>`;
}
