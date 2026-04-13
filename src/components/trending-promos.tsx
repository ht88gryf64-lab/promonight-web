import { PromoBadge } from './promo-badge';
import type { PromoWithTeam } from '@/lib/types';

function formatDate(dateStr: string): { day: string; weekday: string; month: string } {
  const date = new Date(dateStr + 'T12:00:00');
  return {
    day: date.getDate().toString(),
    weekday: date.toLocaleDateString('en-US', { weekday: 'short' }).toUpperCase(),
    month: date.toLocaleDateString('en-US', { month: 'short' }).toUpperCase(),
  };
}

export function TrendingPromos({ promos }: { promos: PromoWithTeam[] }) {
  if (promos.length === 0) return null;

  return (
    <section className="py-20 px-6">
      <div className="max-w-6xl mx-auto">
        <div className="text-center mb-12">
          <span className="font-mono text-[10px] tracking-[1.5px] uppercase text-accent-red">
            Trending
          </span>
          <h2 className="font-display text-4xl md:text-5xl tracking-[1px] mt-2">
            HOT UPCOMING PROMOS
          </h2>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {promos.map((promo, i) => {
            const { day, weekday, month } = formatDate(promo.date);
            return (
              <a
                key={i}
                href={`/${promo.team.sportSlug}/${promo.team.id}`}
                className="group bg-bg-card border border-border-subtle rounded-2xl p-5 transition-all hover:-translate-y-0.5 hover:border-border-hover flex gap-4"
              >
                {/* Date */}
                <div className="flex-shrink-0 w-14 text-center">
                  <div className="font-mono text-[9px] tracking-[1px] text-text-muted">{month}</div>
                  <div className="font-display text-3xl leading-none">{day}</div>
                  <div className="font-mono text-[9px] tracking-[1px] text-text-dim">{weekday}</div>
                </div>

                {/* Content */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1.5">
                    <span className="text-lg">{promo.icon}</span>
                    <PromoBadge type={promo.type} />
                    {promo.highlight && (
                      <span className="text-[10px] font-mono text-accent-red">HOT</span>
                    )}
                  </div>
                  <div className="text-white font-semibold text-sm truncate group-hover:text-accent-red transition-colors">
                    {promo.title}
                  </div>
                  <div className="text-text-secondary text-xs mt-0.5">
                    {promo.team.city} {promo.team.name}
                    {promo.opponent && <span className="text-text-dim"> vs {promo.opponent}</span>}
                  </div>
                </div>
              </a>
            );
          })}
        </div>
      </div>
    </section>
  );
}
