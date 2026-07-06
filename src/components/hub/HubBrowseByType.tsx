import type { PromoWithTeam, PromoType } from '@/lib/types';
import { categoryFor } from '@/components/redesign/categories';
import { TrackedTapLink } from '@/components/analytics/TrackedTapLink';
import { IconArrowRight } from '@tabler/icons-react';

// Browse-by-promo-type tiles. Each links to an existing cross-league collection
// page (a strong internal link from the hub) and fires collection_tile_tap on
// the web_mlb_hub_promo_type surface. collection_count carries the number of
// matching promos in the current MLB slate, for the analytics payload only.
type Tile = {
  href: string;
  label: string;
  collectionName: 'bobbleheads' | 'jerseys' | 'theme_nights' | 'hot_this_week';
  accentType: PromoType;
  count: number;
};

export function HubBrowseByType({ slate }: { slate: PromoWithTeam[] }) {
  const countType = (t: PromoType) => slate.filter((p) => p.type === t).length;

  const tiles: Tile[] = [
    {
      href: '/promos/bobbleheads',
      label: 'Bobblehead giveaways',
      collectionName: 'bobbleheads',
      accentType: 'giveaway',
      count: countType('giveaway'),
    },
    {
      href: '/promos/jersey-giveaways',
      label: 'Jersey giveaways',
      collectionName: 'jerseys',
      accentType: 'giveaway',
      count: countType('giveaway'),
    },
    {
      href: '/promos/theme-nights',
      label: 'Theme nights',
      collectionName: 'theme_nights',
      accentType: 'theme',
      count: countType('theme'),
    },
    {
      href: '/promos/this-week',
      label: 'Everything this week',
      collectionName: 'hot_this_week',
      accentType: 'giveaway',
      count: slate.length,
    },
  ];

  return (
    <section aria-labelledby="mlb-browse-type">
      <h2 id="mlb-browse-type" className="rd-display text-2xl text-rd-ink md:text-3xl">
        Browse by promo type
      </h2>
      <div className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {tiles.map((tile) => {
          const cat = categoryFor(tile.accentType);
          return (
            <TrackedTapLink
              key={tile.href}
              href={tile.href}
              trackEvent="collection_tile_tap"
              trackProps={{
                surface: 'web_mlb_hub_promo_type',
                collection_name: tile.collectionName,
                collection_count: tile.count,
              }}
              className="group flex items-center justify-between rounded-2xl border border-rd-line bg-rd-card p-5 transition-colors hover:border-rd-line-strong"
            >
              <span className="flex items-center gap-2.5">
                <span
                  className="grid h-9 w-9 shrink-0 place-items-center rounded-full"
                  style={{ backgroundColor: `${cat.color}1a` }}
                >
                  <cat.Icon size={18} stroke={2} style={{ color: cat.color }} />
                </span>
                <span className="font-rd font-semibold text-rd-ink">{tile.label}</span>
              </span>
              <IconArrowRight
                size={16}
                stroke={2}
                className="shrink-0 text-rd-ink-faint transition-colors group-hover:text-rd-red"
              />
            </TrackedTapLink>
          );
        })}
      </div>
    </section>
  );
}
