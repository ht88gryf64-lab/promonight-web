import { PROMO_TYPE_COLORS, PROMO_TYPE_LABELS, type PromoType } from '@/lib/types';

export function PromoBadge({ type }: { type: PromoType }) {
  const color = PROMO_TYPE_COLORS[type];
  const label = PROMO_TYPE_LABELS[type];

  return (
    <span
      className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-mono tracking-[0.5px] uppercase"
      style={{
        color,
        backgroundColor: `${color}15`,
        border: `1px solid ${color}30`,
      }}
    >
      <span
        className="w-1.5 h-1.5 rounded-full"
        style={{ backgroundColor: color }}
      />
      {label}
    </span>
  );
}
