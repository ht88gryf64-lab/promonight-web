import Link from 'next/link';

export interface CollectionTile {
  href: string;
  emoji: string;
  label: string;
  count: number;
  examples: string[];
  totalForOverflow: number;
  accentColor: string;
}

function summary(tile: CollectionTile): string {
  const overflow = Math.max(0, tile.totalForOverflow - tile.examples.length);
  const head = tile.examples.join(', ');
  if (!head) return overflow > 0 ? `${overflow} promos` : '';
  return overflow > 0 ? `${head} +${overflow} more` : head;
}

export function BrowseCollections({ tiles }: { tiles: CollectionTile[] }) {
  if (tiles.length === 0) return null;

  const yearSuffix = new Date().toLocaleDateString('en-US', {
    timeZone: 'America/Chicago',
    year: 'numeric',
  });

  return (
    <section className="py-16 px-6 border-t border-border-subtle">
      <div className="max-w-5xl mx-auto">
        <div className="mb-10">
          <span className="font-mono text-[10px] tracking-[1.5px] uppercase text-accent-red">
            Browse
          </span>
          <h2 className="font-display text-3xl md:text-4xl tracking-[1px] mt-2">
            BROWSE COLLECTIONS
          </h2>
          <p className="text-text-secondary text-sm md:text-base mt-3 max-w-2xl">
            Every promo across pro sports, sliced by what it is. Pick a category
            to see the full {yearSuffix} list.
          </p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
          {tiles.map((tile) => (
            <Link
              key={tile.href}
              href={tile.href}
              className="group relative bg-bg-card border border-border-subtle rounded-2xl p-6 transition-all hover:-translate-y-0.5 hover:border-border-hover overflow-hidden"
              style={{ borderLeftWidth: '3px', borderLeftColor: tile.accentColor }}
            >
              <div className="flex items-start justify-between gap-4 mb-4">
                <span className="text-3xl" aria-hidden="true">
                  {tile.emoji}
                </span>
                <span
                  className="inline-flex items-center px-2.5 py-1 rounded-full text-[10px] font-mono tracking-[0.5px] uppercase"
                  style={{
                    color: tile.accentColor,
                    backgroundColor: `${tile.accentColor}15`,
                    border: `1px solid ${tile.accentColor}30`,
                  }}
                >
                  {tile.count.toLocaleString()} in {yearSuffix}
                </span>
              </div>

              <h3 className="font-display text-xl md:text-2xl tracking-[0.5px] text-white group-hover:text-accent-red transition-colors mb-2">
                {tile.label.toUpperCase()}
              </h3>

              <p className="text-text-secondary text-sm leading-relaxed line-clamp-2">
                {summary(tile)}
              </p>

              <div className="mt-5 inline-flex items-center gap-1 text-accent-red text-xs font-mono">
                Browse all
                <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
                </svg>
              </div>
            </Link>
          ))}
        </div>
      </div>
    </section>
  );
}
