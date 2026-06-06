import { IconLayoutGrid } from '@tabler/icons-react';
import type { PromoType } from '@/lib/types';
import { RD_CATEGORIES } from './categories';

// Redesign v2 category filter chip. Presentational: the consuming client
// component owns selection state and passes `active` + `onClick`. When active,
// the chip fills with the category color (ink for the "All" chip); inactive
// chips are white with a hairline border and the icon tinted by category color.

interface CategoryChipProps {
  /** Category key, or 'all' for the reset chip. */
  category: PromoType | 'all';
  active?: boolean;
  count?: number;
  onClick?: () => void;
  className?: string;
}

export function CategoryChip({ category, active = false, count, onClick, className = '' }: CategoryChipProps) {
  const isAll = category === 'all';
  const meta = isAll ? null : RD_CATEGORIES[category];
  const Icon = isAll ? IconLayoutGrid : meta!.Icon;
  const label = isAll ? 'All' : meta!.label;
  const color = isAll ? '#211d18' : meta!.color;

  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={[
        'inline-flex items-center gap-1.5 rounded-full font-rd font-semibold',
        'text-[13px] tracking-[-0.01em] px-3.5 py-1.5 border transition-colors',
        active
          ? 'text-white border-transparent'
          : 'bg-rd-card text-rd-ink-soft border-rd-line-strong hover:border-rd-ink hover:text-rd-ink',
        className,
      ].join(' ')}
      style={active ? { backgroundColor: color, borderColor: color } : undefined}
    >
      <Icon size={15} stroke={2.25} style={!active ? { color } : undefined} />
      <span>{label}</span>
      {typeof count === 'number' && (
        <span
          className={`text-[11px] font-bold tabular-nums ${active ? 'text-white/80' : 'text-rd-ink-faint'}`}
        >
          {count}
        </span>
      )}
    </button>
  );
}
