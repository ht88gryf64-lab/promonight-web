import type { Team } from '@/lib/types';
import { iconFor, type RecurringDeal } from '@/lib/recurring-deals';

export function RecurringDealsSection({
  team,
  deals,
  venueName,
}: {
  team: Team;
  deals: RecurringDeal[];
  venueName: string | null;
}) {
  if (deals.length === 0) return null;

  return (
    <section className="py-10 px-6 border-t border-border-subtle">
      <div className="max-w-3xl mx-auto">
        <div className="mb-5">
          <span className="font-mono text-[10px] tracking-[1.5px] uppercase text-accent-red">
            Every home game
          </span>
          <h2 className="font-display text-3xl md:text-4xl tracking-[1px] mt-1">
            EVERY GAME DEALS
          </h2>
          <p className="text-text-secondary text-sm mt-2">
            Recurring food, drink, and family deals that happen at {team.name} home games{venueName ? ` at ${venueName}` : ''} — regardless of the promo calendar.
          </p>
        </div>

        <div className="grid gap-3 md:grid-cols-2">
          {deals.map((deal, i) => (
            <div
              key={i}
              className="bg-bg-card border border-border-subtle rounded-2xl p-4 md:p-5 flex gap-4"
            >
              <div className="flex-shrink-0 text-2xl leading-none pt-0.5" aria-hidden="true">
                {iconFor(deal.category)}
              </div>
              <div className="flex-1 min-w-0">
                <div className="text-white font-semibold text-base">{deal.title}</div>
                <div className="font-mono text-[10px] tracking-[0.5px] uppercase text-text-muted mt-1">
                  {deal.frequency}
                </div>
                {deal.description && (
                  <p className="text-text-secondary text-sm mt-2 leading-relaxed">
                    {deal.description}
                  </p>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
