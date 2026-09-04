import { PROMO_TYPE_COLORS, PROMO_TYPE_LABELS, type PromoType } from '@/lib/types';
import { RD_TICKET_PACKAGE } from '@/components/redesign/categories';

/**
 * `gated` marks a promo whose own copy says a purchase is required. It renders
 * the neutral Ticket Package pill instead of the category pill, reusing the
 * colours the light variant already ships (RD_TICKET_PACKAGE) rather than
 * defining a second slate.
 *
 * The light path got this via categoryForPromo when the section-8 rule landed;
 * this branch did not, so the rollback-only dark template still dressed a
 * purchasable ticket package as a giveaway. The season-scope change publishes
 * giveaway counts that INCLUDE gated rows (count broad, label precisely), which
 * makes the row-level label load-bearing on both render paths.
 */
export function PromoBadge({ type, gated = false }: { type: PromoType; gated?: boolean }) {
  const color = gated ? RD_TICKET_PACKAGE.color : PROMO_TYPE_COLORS[type];
  const label = gated ? RD_TICKET_PACKAGE.label : PROMO_TYPE_LABELS[type];

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
