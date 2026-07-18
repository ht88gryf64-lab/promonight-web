import type { PromoWithTeam, PromoType } from '@/lib/types';
import { categoryFor } from '@/components/redesign/categories';
import { TrackedTapLink } from '@/components/analytics/TrackedTapLink';
import type { AnalyticsSurface, CollectionTileTapProperties } from '@/lib/analytics';
import { IconArrowRight } from '@tabler/icons-react';

// A browse-by-promo-type tile, supplied per league by the hub page. Each links to
// an existing cross-league collection page (a strong internal link from the hub)
// and fires collection_tile_tap on the hub's promo-type surface. collection_count
// carries the number of matching promos in the current slate, for the analytics
// payload only (MLB: bobbleheads/jerseys/theme/this-week; WNBA:
// theme/jerseys/bobbleheads; MLS: soccer-jerseys/theme).
export type HubBrowseTile = {
  href: string;
  label: string;
  collectionName: CollectionTileTapProperties['collection_name'];
  accentType: PromoType;
};

export function HubBrowseByType({
  slate,
  tiles,
  sectionId,
  surface,
}: {
  slate: PromoWithTeam[];
  tiles: HubBrowseTile[];
  sectionId: string;
  surface: AnalyticsSurface;
}) {
  const countType = (t: PromoType) => slate.filter((p) => p.type === t).length;
  // "Everything this week" counts the whole slate; every type tile counts its type.
  const tileCount = (tile: HubBrowseTile) =>
    tile.collectionName === 'hot_this_week' ? slate.length : countType(tile.accentType);

  return (
    <section aria-labelledby={sectionId}>
      <h2 id={sectionId} className="rd-display text-2xl text-rd-ink md:text-3xl">
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
                surface,
                collection_name: tile.collectionName,
                collection_count: tileCount(tile),
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
