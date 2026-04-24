import { PromoBadge } from './promo-badge';
import { AppDownloadButtons } from './app-download-buttons';
import type { Promo, PromoType } from '@/lib/types';

function formatPromoDate(dateStr: string): { day: string; weekday: string; month: string } {
  const date = new Date(dateStr + 'T12:00:00');
  return {
    day: date.getDate().toString(),
    weekday: date.toLocaleDateString('en-US', { weekday: 'short' }).toUpperCase(),
    month: date.toLocaleDateString('en-US', { month: 'short' }).toUpperCase(),
  };
}

const TYPE_COLORS: Record<PromoType, string> = {
  giveaway: '#34d399',
  theme: '#a78bfa',
  kids: '#60a5fa',
  food: '#fb923c',
};

function PromoRow({ promo, completed = false }: { promo: Promo; completed?: boolean }) {
  const { day, weekday, month } = formatPromoDate(promo.date);
  const typeColor = TYPE_COLORS[promo.type];

  return (
    <div
      className={`group bg-bg-card border border-border-subtle rounded-2xl p-4 md:p-5 transition-all flex gap-4 ${
        completed
          ? 'opacity-60 hover:opacity-80'
          : 'hover:border-border-hover'
      }`}
      style={{ borderLeftWidth: '3px', borderLeftColor: typeColor }}
    >
      <div className="flex-shrink-0 w-14 text-center">
        <div className="font-mono text-[9px] tracking-[1px] text-text-muted">{month}</div>
        <div className="font-display text-3xl leading-none">{day}</div>
        <div className="font-mono text-[9px] tracking-[1px] text-text-dim">{weekday}</div>
      </div>

      <div className="flex-1 min-w-0">
        <div className="flex flex-wrap items-center gap-2 mb-1.5">
          <span className="text-lg" aria-hidden="true">{promo.icon}</span>
          <PromoBadge type={promo.type} />
          {completed && (
            <span className="inline-flex items-center gap-1 text-[10px] font-mono tracking-[0.5px] uppercase text-text-dim border border-border-subtle rounded-full px-2 py-0.5">
              Completed
            </span>
          )}
          {!completed && promo.highlight && (
            <span className="inline-flex items-center gap-1 text-[10px] font-mono text-accent-red">
              <span className="w-1.5 h-1.5 rounded-full bg-accent-red animate-pulse-dot" />
              HOT
            </span>
          )}
          {promo.time && (
            <span className="text-text-dim text-[10px] font-mono">{promo.time}</span>
          )}
        </div>
        <div className="text-white font-semibold text-sm md:text-base">
          {promo.title}
        </div>
        {promo.description && (
          <p className="text-text-secondary text-xs md:text-sm mt-1">
            {promo.description}
          </p>
        )}
        {promo.opponent && (
          <div className="mt-2 inline-flex items-center gap-1.5 text-text-dim text-[10px] font-mono tracking-[0.5px] uppercase">
            vs {promo.opponent}
          </div>
        )}
      </div>
    </div>
  );
}

export function PromoList({
  promos,
  teamSlug,
  teamName,
}: {
  promos: Promo[];
  teamSlug: string;
  teamName: string;
}) {
  const today = new Date().toISOString().split('T')[0];
  const upcoming = promos.filter((p) => p.date >= today);
  const past = promos.filter((p) => p.date < today).reverse(); // most-recent-first

  // Split past into "recent" (≤30 days ago, visible) and "earlier" (wrapped in <details>).
  const thirtyDaysAgo = new Date(Date.now() - 30 * 86400_000).toISOString().split('T')[0];
  const recentPast = past.filter((p) => p.date >= thirtyDaysAgo);
  const earlierPast = past.filter((p) => p.date < thirtyDaysAgo);

  return (
    <section className="py-12 px-6">
      <div className="max-w-5xl mx-auto">
        <div className="mb-6">
          <span className="font-mono text-[10px] tracking-[1.5px] uppercase text-accent-red">
            Coming up
          </span>
          <h2 className="font-display text-3xl md:text-4xl tracking-[1px] mt-1">
            UPCOMING PROMOS
          </h2>
          {upcoming.length > 0 && (
            <p className="text-text-muted text-xs font-mono tracking-[0.5px] mt-2">
              {upcoming.length} upcoming {upcoming.length === 1 ? 'event' : 'events'} · full schedule below
            </p>
          )}
        </div>

        {upcoming.length > 0 ? (
          <div className="space-y-3">
            {upcoming.map((promo, i) => (
              <PromoRow key={`u-${i}`} promo={promo} />
            ))}
          </div>
        ) : past.length === 0 ? (
          <div className="text-center py-12">
            <p className="text-text-muted text-lg">No upcoming promos yet</p>
            <p className="text-text-dim text-sm mt-1">Check back later for the latest schedule</p>
          </div>
        ) : (
          <div className="text-center py-8">
            <p className="text-text-muted text-sm">
              No upcoming {teamName} promos scheduled right now. See completed {new Date().getFullYear()} promos below.
            </p>
          </div>
        )}

        {past.length > 0 && (
          <div className="mt-12">
            <div className="mb-4">
              <span className="font-mono text-[10px] tracking-[1.5px] uppercase text-text-dim">
                Already happened
              </span>
              <h3 className="font-display text-2xl md:text-3xl tracking-[1px] mt-1 text-text-secondary">
                COMPLETED {new Date().getFullYear()} PROMOS
              </h3>
              <p className="text-text-muted text-xs font-mono tracking-[0.5px] mt-2">
                {past.length} completed {past.length === 1 ? 'event' : 'events'} this season
              </p>
            </div>

            {recentPast.length > 0 && (
              <div className="space-y-3">
                {recentPast.map((promo, i) => (
                  <PromoRow key={`rp-${i}`} promo={promo} completed />
                ))}
              </div>
            )}

            {earlierPast.length > 0 && (
              <details className="mt-4 group">
                <summary className="cursor-pointer list-none inline-flex items-center gap-2 text-text-secondary text-sm font-mono tracking-[0.5px] uppercase hover:text-white transition-colors">
                  <span className="inline-block transition-transform group-open:rotate-90" aria-hidden="true">▸</span>
                  Show earlier completed promos ({earlierPast.length})
                </summary>
                <div className="mt-4 space-y-3">
                  {earlierPast.map((promo, i) => (
                    <PromoRow key={`ep-${i}`} promo={promo} completed />
                  ))}
                </div>
              </details>
            )}
          </div>
        )}

        {/* Soft app pitch — no paywall */}
        <div className="mt-10 bg-bg-card/50 border border-border-subtle rounded-2xl p-6 text-center">
          <p className="text-text-secondary text-sm mb-1">
            Want push notifications the morning of every {teamName} promo?
          </p>
          <p className="text-text-muted text-xs mb-5">
            The free PromoNight app sends alerts for giveaways, theme nights, and food deals — optional, not required to use this site.
          </p>
          <AppDownloadButtons
            section="promo_list_app_pitch"
            page={`team/${teamSlug}`}
            teamSlug={teamSlug}
            variant="compact"
          />
        </div>
      </div>
    </section>
  );
}
