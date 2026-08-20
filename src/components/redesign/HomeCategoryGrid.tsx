import Link from 'next/link';
import {
  IconCalendar,
  IconCalendarWeek,
  IconGift,
  IconConfetti,
  IconShirt,
  IconBallFootball,
  IconCup,
} from '@tabler/icons-react';
import type { HomeCategoryTile } from './home-category-tiles';

// Presentational grid for the 7 aggregator-route tiles ("By What You Want" in
// the design target). Data (counts, filters, zero-drop) lives in
// home-category-tiles.ts; this file only renders what it is given and hides
// entirely when every tile was dropped. Tile labels are paragraphs, not
// headings, matching the ticket-stub ruling: the section h2 is the only
// heading, tiles are navigation items. Links are plain (no analytics events
// yet); event names are a wiring-time decision with the other new surfaces.

const TILE_ICONS: Record<string, typeof IconGift> = {
  today: IconCalendar,
  'this-week': IconCalendarWeek,
  bobbleheads: IconGift,
  'theme-nights': IconConfetti,
  'jersey-giveaways': IconShirt,
  'soccer-jerseys': IconBallFootball,
  'food-deals': IconCup,
};

export function HomeCategoryGrid({ tiles }: { tiles: HomeCategoryTile[] }) {
  if (tiles.length === 0) return null;

  return (
    <section className="mx-auto max-w-6xl px-6">
      <div className="mb-7">
        <div className="mb-2 flex items-center gap-2 font-mono text-[10.5px] font-semibold uppercase tracking-[0.22em] text-rd-ink-faint">
          <span aria-hidden className="h-1.5 w-1.5 flex-none rounded-full bg-rd-cat-giveaway" />
          Browse
        </div>
        <h2 className="rd-display text-3xl uppercase text-rd-ink md:text-4xl">By What You Want</h2>
        <p className="mt-2 max-w-md font-rd text-sm text-rd-ink-soft">
          Every upcoming promo by type, each in one list.
        </p>
      </div>

      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
        {tiles.map((t) => {
          const Icon = TILE_ICONS[t.key] ?? IconGift;
          return (
            <Link
              key={t.key}
              href={t.href}
              className="group flex flex-col rounded-xl border border-rd-line bg-rd-card p-5 transition-colors hover:border-rd-line-strong"
            >
              <span
                aria-hidden
                className="mb-4 inline-flex h-10 w-10 items-center justify-center rounded-lg"
                style={{ backgroundColor: `color-mix(in srgb, ${t.ink} 9%, transparent)`, color: t.ink }}
              >
                <Icon size={21} stroke={1.8} />
              </span>
              <p className="font-rd text-[17px] font-bold uppercase leading-tight text-rd-ink">
                {t.label}
              </p>
              <p className="mt-1.5 font-rd text-xs leading-snug text-rd-ink-soft">{t.blurb}</p>
              <p
                className="mt-3 font-mono text-[10.5px] font-semibold tracking-[0.08em]"
                style={{ color: t.ink }}
              >
                {t.count.toLocaleString()} promo{t.count === 1 ? '' : 's'}
              </p>
            </Link>
          );
        })}
      </div>
    </section>
  );
}
