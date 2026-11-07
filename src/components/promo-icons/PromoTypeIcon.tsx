import { PROMO_ICONS, promoIconId, type PromoIconKey } from '@/lib/promo-type-icons';

// The web half of the type icon set (src/lib/promo-type-icons.ts holds the
// glyphs). The sprite renders the symbols ONCE per page, zero-sized and
// aria-hidden, and every icon is a <use> of ~90 bytes, so a page of icons
// costs the sprite plus a few bytes per icon rather than a path set each.
// Single colour: the glyphs stroke currentColor, so a class or a parent's
// colour (the team accent on the promo page) is the icon's colour.
//
// Placement: the sprite is a positioned, zero-sized <svg>; never a direct
// child of a page-content article (it would count as an ad anchor there).

export function PromoTypeSprite() {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" width="0" height="0" className="absolute" aria-hidden="true">
      {PROMO_ICONS.map((i) => (
        <symbol key={i.key} id={promoIconId(i.key)} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          {i.paths.map((d) => (
            <path key={d} d={d} />
          ))}
        </symbol>
      ))}
    </svg>
  );
}

export function PromoTypeIcon({ icon, size = 16, className }: { icon: PromoIconKey; size?: number; className?: string }) {
  return (
    <svg width={size} height={size} className={className} aria-hidden="true">
      <use href={`#${promoIconId(icon)}`} />
    </svg>
  );
}
