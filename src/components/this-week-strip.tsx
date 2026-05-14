import type { PromoWithTeam } from '@/lib/types';
import { PromoBadge } from './promo-badge';
import { teamDisplayName, synthPromoId } from '@/lib/promo-helpers';
import { normalizeSport } from '@/lib/analytics';
import { TrackedTapLink } from './analytics/TrackedTapLink';
import { StarToggleInline } from './star-toggle';

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

// `today` is YYYY-MM-DD in America/Chicago, passed by the homepage so the
// strip can compute days_out without re-deriving "today" from a UTC clock.
export function ThisWeekStrip({ promos, today }: { promos: PromoWithTeam[]; today: string }) {
  if (promos.length === 0) return null;

  const daysBetween = (a: string, b: string): number => {
    const [ay, am, ad] = a.split('-').map(Number);
    const [by, bm, bd] = b.split('-').map(Number);
    const da = Date.UTC(ay, am - 1, ad);
    const db = Date.UTC(by, bm - 1, bd);
    return Math.round((db - da) / 86400000);
  };

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
          <TrackedTapLink
            href="/promos/this-week"
            trackEvent="this_week_see_all_tap"
            trackProps={{ surface: 'web_home' }}
            className="flex-shrink-0 inline-flex items-center gap-1 text-accent-red text-sm font-mono hover:underline"
          >
            See all
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
            </svg>
          </TrackedTapLink>
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
                    <TrackedTapLink
                      key={`${p.team.id}-${i}`}
                      href={`/${p.team.sportSlug}/${p.team.id}`}
                      trackEvent="this_week_card_tap"
                      trackProps={{
                        surface: 'web_home',
                        team_id: p.team.id,
                        sport: normalizeSport(p.team.league),
                        promo_id: synthPromoId(p.team.id, p),
                        promo_type: p.type,
                        is_highlight: p.highlight,
                        days_out: daysBetween(today, p.date),
                      }}
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
                        <div className="mt-0.5 flex items-center gap-1.5 min-w-0">
                          <StarToggleInline
                            teamSlug={p.team.id}
                            teamName={teamDisplayName(p.team)}
                            league={p.team.league}
                            sport={p.team.sportSlug}
                            placement="homepage_this_week_inline"
                          />
                          <div className="text-text-secondary text-xs truncate min-w-0">
                            {teamDisplayName(p.team)}
                            {p.opponent && (
                              <span className="text-text-dim"> vs {p.opponent}</span>
                            )}
                            <span className="text-text-dim"> · {p.team.league}</span>
                          </div>
                        </div>
                      </div>
                    </TrackedTapLink>
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
