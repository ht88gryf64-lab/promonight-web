import { IconCalendarEvent } from '@tabler/icons-react';
import type { PromoType } from '@/lib/types';
import { RD_CATEGORIES, RD_CATEGORY_ORDER } from './categories';

// Redesign v2 hero scoreboard. The four category counts (giveaway, theme, food,
// kids) plus an optional "Games" tile, rendered as translucent panels that sit
// on the DARK hero. Presentational and static — no state, no events.
//
// TWO DEGENERATE SHAPES EXIST AND BOTH ARE INTENTIONAL. Neither was overlooked.
//
//   Shape A, the 32 NFL zero-promo pages: four zeros plus a Games tile reading
//   17. The Games number is deliberately NOT relabelled to home games and NOT
//   reduced. The page renders the full 18-week slate, home and away, so 17 is
//   the count of game rows the reader can see and the tile agrees with them. A
//   home-only count would disagree with the list and would also move all 30 MLB
//   pages, which is a separate change with its own gate.
//
//   Shape B, the 6 non-NFL zero-promo pages (4 NBA, 1 NHL, 1 MLS): four zeros
//   and no Games tile at all, because getGamesForTeam short-circuits for every
//   league but mlb and nfl, so gameContexts is undefined. The grid then holds 4
//   tiles in a lg:grid-cols-5 track and leaves one column empty. HANDLING SHAPE
//   B MEANS DELIBERATELY DOING NOTHING: that 4-in-5 layout is already the
//   shipping status quo on all 101 populated non-MLB, non-NFL team pages.
//
// The Games tile is guarded on a POSITIVE count, not merely on the value being
// a number. Today gamesCount cannot be 0 (the page passes gameContexts?.length,
// and gameContexts is undefined rather than [] when a team has no games), so
// the guard is a no-op on all 169 pages. It exists so a future caller that
// passes an empty array cannot produce a five-zero band, which would read as
// broken rather than as empty.

export interface StatScoreboardProps {
  counts: Record<PromoType, number>; // promoCounts from the page
  gamesCount?: number; // optional total scheduled games
  /**
   * The sentence that names the population the tiles count, e.g.
   * "98 promotions in the 2026 season, 19 still to come".
   *
   * REQUIRED WHENEVER THE TILES CARRY SEASON COUNTS, and that is the whole
   * reason it exists. The tiles are four bare numerals with a category word
   * under each; nothing in them says which population they describe, so the
   * band read as "what is on next" while carrying season totals would be the
   * same label-versus-population defect in a new place. Omitted on the
   * fallback path, where the tiles keep their upcoming-only counts and the
   * "Coming up" promo list directly below them supplies the label.
   */
  note?: string;
  className?: string;
}

interface TileProps {
  count: number;
  label: string;
  color: string;
  Icon: typeof IconCalendarEvent;
}

function StatTile({ count, label, color, Icon }: TileProps) {
  return (
    <div
      className="relative overflow-hidden rounded-xl border border-white/10 bg-white/10 px-4 py-3"
      style={{ borderTopColor: color, borderTopWidth: 2 }}
    >
      <Icon size={18} stroke={2.25} style={{ color }} />
      <div className="rd-numerals mt-1 text-3xl leading-none text-white">{count}</div>
      <div className="mt-1.5 font-rd text-[11px] uppercase tracking-wide text-white/55">
        {label}
      </div>
    </div>
  );
}

export function StatScoreboard({ counts, gamesCount, note, className = '' }: StatScoreboardProps) {
  // NO NOTE, NO WRAPPER. The note only ever accompanies season counts, so on
  // every held or fallback page this must emit exactly the markup it emitted
  // before: one grid div carrying the merged class string. An always-on wrapper
  // would change the DOM of the 30 MLB pages the rollout hold exists to freeze.
  const grid = (
    <div
      className={[
        'grid grid-cols-2 gap-2.5 sm:grid-cols-4 lg:grid-cols-5',
        note ? '' : className,
      ]
        .filter(Boolean)
        .join(' ')}
    >
        {RD_CATEGORY_ORDER.map((key) => {
          const meta = RD_CATEGORIES[key];
          return (
            <StatTile
              key={key}
              count={counts[key] ?? 0}
              label={meta.label}
              color={meta.color}
              Icon={meta.Icon}
            />
          );
        })}
        {typeof gamesCount === 'number' && gamesCount > 0 && (
          <StatTile
            count={gamesCount}
            label="Games"
            color="#ffffff"
            Icon={IconCalendarEvent}
          />
        )}
    </div>
  );

  if (!note) return grid;

  return (
    <div className={className}>
      {grid}
      <p className="mt-3 font-rd text-[13px] text-white/70">{note}</p>
    </div>
  );
}
