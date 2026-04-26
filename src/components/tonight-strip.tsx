import type { PromoWithTeam } from '@/lib/types';
import { LEAGUE_ORDER } from '@/lib/types';
import { PromoBadge } from './promo-badge';
import { teamDisplayName, synthPromoId } from '@/lib/promo-helpers';
import { normalizeSport, type EyebrowState } from '@/lib/analytics';
import { TrackedTapLink } from './analytics/TrackedTapLink';

export type TonightVariant = 'tonight' | 'tonight-tomorrow' | 'coming-up';

const EYEBROW: Record<TonightVariant, string> = {
  tonight: 'TONIGHT',
  'tonight-tomorrow': 'TONIGHT & TOMORROW',
  'coming-up': 'COMING UP',
};

// Variant -> snake-case state value plumbed into tonight_card_tap analytics.
const EYEBROW_STATE: Record<TonightVariant, EyebrowState> = {
  tonight: 'TONIGHT',
  'tonight-tomorrow': 'TONIGHT_AND_TOMORROW',
  'coming-up': 'COMING_UP',
};

const LEAGUE_RANK: Record<string, number> = Object.fromEntries(
  LEAGUE_ORDER.map((l, i) => [l, i]),
);

// Selects which promos to render under the Tonight rail and which eyebrow to
// stamp above them. Three rules, in priority order:
//   1. Today has 3+ promos          -> "TONIGHT"          (today only)
//   2. Today + tomorrow has 3+      -> "TONIGHT & TOMORROW" (both days)
//   3. Otherwise                    -> "COMING UP"        (next 4 dates with promos)
// `windowPromos` should be the next ~14 days of promos already loaded by the
// page; we partition in memory to avoid a second Firestore round-trip.
export function pickTonight(
  windowPromos: PromoWithTeam[],
  todayYMD: string,
  tomorrowYMD: string,
): { variant: TonightVariant; promos: PromoWithTeam[] } {
  const sorted = [...windowPromos].sort(comparePromos);
  const today = sorted.filter((p) => p.date === todayYMD);
  if (today.length >= 3) return { variant: 'tonight', promos: today.slice(0, 8) };

  const todayPlusTomorrow = sorted.filter(
    (p) => p.date === todayYMD || p.date === tomorrowYMD,
  );
  if (todayPlusTomorrow.length >= 3) {
    return { variant: 'tonight-tomorrow', promos: todayPlusTomorrow.slice(0, 8) };
  }

  const futureDates: string[] = [];
  for (const p of sorted) {
    if (p.date >= todayYMD && !futureDates.includes(p.date)) {
      futureDates.push(p.date);
      if (futureDates.length === 4) break;
    }
  }
  const next = sorted.filter((p) => futureDates.includes(p.date)).slice(0, 8);
  return { variant: 'coming-up', promos: next };
}

function comparePromos(a: PromoWithTeam, b: PromoWithTeam): number {
  if (a.date !== b.date) return a.date.localeCompare(b.date);
  const la = LEAGUE_RANK[a.team.league] ?? 99;
  const lb = LEAGUE_RANK[b.team.league] ?? 99;
  if (la !== lb) return la - lb;
  if (a.highlight !== b.highlight) return a.highlight ? -1 : 1;
  return 0;
}

function formatDateParts(dateStr: string) {
  const d = new Date(dateStr + 'T12:00:00');
  return {
    day: d.getDate().toString(),
    weekday: d.toLocaleDateString('en-US', { weekday: 'short' }).toUpperCase(),
    month: d.toLocaleDateString('en-US', { month: 'short' }).toUpperCase(),
  };
}

export function TonightStrip({
  promos,
  variant,
}: {
  promos: PromoWithTeam[];
  variant: TonightVariant;
}) {
  return (
    <div>
      <div className="flex items-center gap-2 mb-4">
        <span className="w-1.5 h-1.5 rounded-full bg-accent-red animate-pulse-dot" />
        <span className="font-mono text-[11px] tracking-[0.15em] uppercase text-accent-red">
          {EYEBROW[variant]}
        </span>
        <span className="font-mono text-[11px] tracking-[0.08em] text-text-dim">
          · {promos.length} promo{promos.length === 1 ? '' : 's'}
        </span>
      </div>

      {promos.length === 0 ? (
        <div className="bg-bg-card border border-border-subtle rounded-2xl p-6 text-text-secondary text-sm">
          No upcoming promos in the next two weeks. Check back tomorrow.
        </div>
      ) : (
        <div className="-mx-6 px-6 overflow-x-auto scrollbar-thin">
          <div className="flex gap-4 pb-2 snap-x snap-mandatory">
            {promos.map((promo, i) => {
              const { day, weekday, month } = formatDateParts(promo.date);
              const typeColor =
                promo.type === 'giveaway' ? '#34d399' :
                promo.type === 'theme' ? '#a78bfa' :
                promo.type === 'kids' ? '#60a5fa' : '#fb923c';
              return (
                <TrackedTapLink
                  key={`${promo.team.id}-${promo.date}-${i}`}
                  href={`/${promo.team.sportSlug}/${promo.team.id}`}
                  trackEvent="tonight_card_tap"
                  trackProps={{
                    surface: 'web_home',
                    team_id: promo.team.id,
                    sport: normalizeSport(promo.team.league),
                    promo_id: synthPromoId(promo.team.id, promo),
                    promo_type: promo.type,
                    is_highlight: promo.highlight,
                    eyebrow_state: EYEBROW_STATE[variant],
                  }}
                  className="group relative bg-bg-card border border-border-subtle rounded-2xl p-5 transition-all hover:-translate-y-0.5 hover:border-border-hover flex gap-4 overflow-hidden snap-start flex-shrink-0 w-[300px] md:w-[340px]"
                  style={{ borderLeftWidth: '3px', borderLeftColor: typeColor }}
                >
                  {promo.highlight && (
                    <div
                      className="absolute top-0 right-0 w-24 h-24 pointer-events-none"
                      style={{
                        background:
                          'radial-gradient(circle at top right, rgba(239,68,68,0.25) 0%, transparent 70%)',
                      }}
                      aria-hidden="true"
                    />
                  )}
                  <div className="flex-shrink-0 w-14 text-center">
                    <div className="font-mono text-[9px] tracking-[1px] text-text-muted">
                      {month}
                    </div>
                    <div className="font-display text-3xl leading-none mt-0.5">
                      {day}
                    </div>
                    <div className="font-mono text-[9px] tracking-[1px] text-text-dim mt-0.5">
                      {weekday}
                    </div>
                  </div>
                  <div className="flex-1 min-w-0 relative">
                    <div className="flex items-center gap-2 mb-2 flex-wrap">
                      <span className="text-lg">{promo.icon}</span>
                      <PromoBadge type={promo.type} />
                      {promo.highlight && (
                        <span className="text-[10px] font-mono text-accent-red">
                          HOT
                        </span>
                      )}
                    </div>
                    <div className="text-white font-semibold text-sm md:text-base leading-snug group-hover:text-accent-red transition-colors line-clamp-2">
                      {promo.title}
                    </div>
                    <div className="text-text-secondary text-xs mt-1.5 truncate">
                      {teamDisplayName(promo.team)}
                      {promo.opponent && (
                        <span className="text-text-dim"> vs {promo.opponent}</span>
                      )}
                    </div>
                  </div>
                </TrackedTapLink>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
