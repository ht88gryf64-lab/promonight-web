import { IconCalendarEvent } from '@tabler/icons-react';
import type { PromoType } from '@/lib/types';
import { RD_CATEGORIES, RD_CATEGORY_ORDER } from './categories';

// Redesign v2 hero scoreboard. The four category counts (giveaway, theme, food,
// kids) plus an optional "Games" tile, rendered as translucent panels that sit
// on the DARK hero. Presentational and static — no state, no events.

export interface StatScoreboardProps {
  counts: Record<PromoType, number>; // promoCounts from the page
  gamesCount?: number; // optional total scheduled games
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

export function StatScoreboard({ counts, gamesCount, className = '' }: StatScoreboardProps) {
  return (
    <div
      className={[
        'grid grid-cols-2 gap-2.5 sm:grid-cols-4 lg:grid-cols-5',
        className,
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
      {typeof gamesCount === 'number' && (
        <StatTile
          count={gamesCount}
          label="Games"
          color="#ffffff"
          Icon={IconCalendarEvent}
        />
      )}
    </div>
  );
}
