import Link from 'next/link';
import type { PromoWithTeam } from '@/lib/types';
import { PromoBadge } from './promo-badge';
import { teamDisplayName } from '@/lib/promo-helpers';

function formatDayLabel(dateStr: string): string {
  return new Date(dateStr + 'T12:00:00').toLocaleDateString('en-US', {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
  });
}

function formatDateParts(dateStr: string) {
  const d = new Date(dateStr + 'T12:00:00');
  return {
    day: d.getDate().toString(),
    weekday: d.toLocaleDateString('en-US', { weekday: 'short' }).toUpperCase(),
    month: d.toLocaleDateString('en-US', { month: 'short' }).toUpperCase(),
  };
}

export function ThisWeekStrip({ promos }: { promos: PromoWithTeam[] }) {
  if (promos.length === 0) return null;

  const byDate = new Map<string, PromoWithTeam[]>();
  for (const p of promos) {
    const list = byDate.get(p.date) ?? [];
    list.push(p);
    byDate.set(p.date, list);
  }
  const groups = Array.from(byDate.entries()).sort(([a], [b]) => a.localeCompare(b));

  return (
    <section className="py-16 px-6 border-t border-border-subtle">
      <div className="max-w-5xl mx-auto">
        <div className="flex items-end justify-between mb-8 gap-4">
          <div>
            <span className="font-mono text-[10px] tracking-[1.5px] uppercase text-accent-red">
              This week
            </span>
            <h2 className="font-display text-3xl md:text-4xl tracking-[1px] mt-2">
              MARQUEE PROMOS IN THE NEXT 7 DAYS
            </h2>
          </div>
          <Link
            href="/promos/this-week"
            className="flex-shrink-0 inline-flex items-center gap-1 text-accent-red text-sm font-mono hover:underline"
          >
            See all
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
            </svg>
          </Link>
        </div>

        <div className="space-y-8">
          {groups.map(([date, list]) => (
            <div key={date}>
              <h3 className="font-mono text-[10px] tracking-[1.5px] uppercase text-text-muted mb-3">
                {formatDayLabel(date)}
              </h3>
              <div className="space-y-2">
                {list.map((p, i) => {
                  const { day, weekday, month } = formatDateParts(p.date);
                  return (
                    <Link
                      key={`${p.team.id}-${i}`}
                      href={`/${p.team.sportSlug}/${p.team.id}`}
                      className="group bg-bg-card border border-border-subtle rounded-xl p-4 flex items-center gap-4 hover:border-border-hover transition-colors"
                    >
                      <div className="flex-shrink-0 w-14 text-center">
                        <div className="font-mono text-[9px] tracking-[1px] text-text-muted">
                          {month}
                        </div>
                        <div className="font-display text-2xl leading-none">
                          {day}
                        </div>
                        <div className="font-mono text-[9px] tracking-[1px] text-text-dim">
                          {weekday}
                        </div>
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex flex-wrap items-center gap-2 mb-1">
                          <span className="text-base">{p.icon}</span>
                          <PromoBadge type={p.type} />
                          {p.highlight && (
                            <span className="text-[10px] font-mono text-accent-red">HOT</span>
                          )}
                        </div>
                        <div className="text-white font-semibold text-sm group-hover:text-accent-red transition-colors truncate">
                          {p.title}
                        </div>
                        <div className="text-text-secondary text-xs mt-0.5 truncate">
                          {teamDisplayName(p.team)}
                          {p.opponent && (
                            <span className="text-text-dim"> vs {p.opponent}</span>
                          )}
                          <span className="text-text-dim"> · {p.team.league}</span>
                        </div>
                      </div>
                    </Link>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
