import Link from 'next/link';
import { PromoTypeIcon } from '@/components/promo-icons/PromoTypeIcon';
import type { PromoRailItem } from '@/lib/promo-rail';

// The promo rail (docs/per-promo-pages-v2-spec.md, Visuals 3): a horizontal
// scroll of cards, each the type icon, the name and a mini date tile, each
// card ONE Link to the promo's page with no handler of its own (the row
// click rule, src/components/redesign/__tests__/promo-row-click.test.tsx).
// Server component: strings and a Link, nothing to hydrate. The items come
// from promoRailItems (src/lib/promo-rail.ts), which also feeds the email
// digest's renderer, so the two show the same cards. Renders nothing below
// two cards (the shaper returns []): one card is a line, not a rail.
//
// The icon strokes currentColor: text-[var(--pp-accent-text)] on the promo
// page is the team accent where it reads on the ground, the ink otherwise.
// The sprite (PromoTypeSprite) must be on the page once.

export function PromoRail({ items, label }: { items: readonly PromoRailItem[]; label: string }) {
  if (items.length < 2) return null;
  return (
    <div className="no-scrollbar -mx-4 flex snap-x snap-mandatory gap-2.5 overflow-x-auto px-4 pb-1" role="list" aria-label={label}>
      {items.map((it) => (
        <Link key={it.href} href={it.href} role="listitem" className="flex w-[150px] shrink-0 snap-start flex-col rounded-xl border border-rd-line bg-rd-card p-3 text-rd-ink no-underline transition-colors hover:border-rd-line-strong focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rd-red focus-visible:ring-offset-2">
          <span className="flex items-start justify-between gap-2">
            <span className="leading-none">
              <span className="block font-rd text-[10px] uppercase tracking-[0.1em] text-rd-ink-faint">{`${it.weekday} ${it.month}`}</span>
              <span className="rd-numerals block text-[26px] text-rd-ink">{it.day}</span>
            </span>
            <PromoTypeIcon icon={it.icon} size={18} className="mt-0.5 shrink-0 text-[var(--pp-accent-text)]" />
          </span>
          <span className="mt-2 line-clamp-2 text-[14px] font-semibold leading-[1.25]">{it.title}</span>
        </Link>
      ))}
    </div>
  );
}
