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

export function HotPromosHero({ promos }: { promos: PromoWithTeam[] }) {
  if (promos.length === 0) return null;

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 md:gap-5">
      {promos.map((promo, i) => {
        const { day, weekday, month } = formatDate(promo.date);
        const typeColor =
          promo.type === 'giveaway' ? '#34d399' :
          promo.type === 'theme' ? '#a78bfa' :
          promo.type === 'kids' ? '#60a5fa' : '#fb923c';

        return (
          <a
            key={i}
            href={`/${promo.team.sportSlug}/${promo.team.id}`}
            className="group relative bg-bg-card border border-border-subtle rounded-2xl p-5 md:p-6 transition-all hover:-translate-y-0.5 hover:border-border-hover flex gap-5 overflow-hidden"
            style={{ borderLeftWidth: '3px', borderLeftColor: typeColor }}
          >
            {promo.highlight && (
              <div
                className="absolute top-0 right-0 w-24 h-24 pointer-events-none"
                style={{
                  background: 'radial-gradient(circle at top right, rgba(239,68,68,0.25) 0%, transparent 70%)',
                }}
              />
            )}

            <div className="flex-shrink-0 w-16 md:w-20 text-center">
              <div className="font-mono text-[9px] md:text-[10px] tracking-[1px] text-text-muted">{month}</div>
              <div className="font-display text-4xl md:text-5xl leading-none mt-0.5">{day}</div>
              <div className="font-mono text-[9px] md:text-[10px] tracking-[1px] text-text-dim mt-0.5">{weekday}</div>
            </div>

            <div className="flex-1 min-w-0 relative">
              <div className="flex items-center gap-2 mb-2 flex-wrap">
                <span className="text-xl">{promo.icon}</span>
                <PromoBadge type={promo.type} />
                {promo.highlight && (
                  <span className="inline-flex items-center gap-1 text-[10px] font-mono text-accent-red">
                    <span className="w-1.5 h-1.5 rounded-full bg-accent-red animate-pulse-dot" />
                    HOT
                  </span>
                )}
              </div>
              <div className="text-white font-semibold text-base md:text-lg leading-snug group-hover:text-accent-red transition-colors">
                {promo.title}
              </div>
              <div className="text-text-secondary text-xs md:text-sm mt-1.5">
                {promo.team.city} {promo.team.name}
                {promo.opponent && <span className="text-text-dim"> vs {promo.opponent}</span>}
              </div>
            </div>
          </a>
        );
      })}
    </div>
  );
}
