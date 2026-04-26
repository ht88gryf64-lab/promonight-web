import Link from 'next/link';
import type { PromoWithTeam } from '@/lib/types';
import { LEAGUE_ORDER } from '@/lib/types';
import { PromoBadge } from './promo-badge';
import { teamDisplayName, synthPromoId } from '@/lib/promo-helpers';
import { normalizeSport, type EyebrowState } from '@/lib/analytics';
import { TrackedTapLink } from './analytics/TrackedTapLink';

export interface HeroBuckets {
  tonight: PromoWithTeam[];
  weekend: PromoWithTeam[];
  comingUp: PromoWithTeam[];
  // True when Tonight has 5+ promos and other buckets are intentionally hidden
  // in favor of a "More upcoming" link to the dedicated this-week page.
  collapsedToTonight: boolean;
}

const TOTAL_CAP = 8;
const COLLAPSE_THRESHOLD = 5;

const LEAGUE_RANK: Record<string, number> = Object.fromEntries(
  LEAGUE_ORDER.map((l, i) => [l, i]),
);

function dayOfWeek(ymd: string): number {
  const [y, m, d] = ymd.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, d)).getUTCDay();
}

function plusDays(ymd: string, n: number): string {
  const [y, m, d] = ymd.split('-').map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d + n));
  return `${dt.getUTCFullYear()}-${String(dt.getUTCMonth() + 1).padStart(2, '0')}-${String(dt.getUTCDate()).padStart(2, '0')}`;
}

// Returns the YYYY-MM-DD strings that constitute "this weekend" relative to
// today, EXCLUDING today itself (today goes in the Tonight bucket). On
// Mon-Thu the next Sat + Sun are returned; on Fri the upcoming Sat + Sun;
// on Sat just the upcoming Sun; on Sun the bucket is empty.
function weekendDates(today: string): string[] {
  const dow = dayOfWeek(today);
  if (dow === 0) return [];
  if (dow === 5) return [plusDays(today, 1), plusDays(today, 2)];
  if (dow === 6) return [plusDays(today, 1)];
  const daysUntilSat = 6 - dow;
  return [plusDays(today, daysUntilSat), plusDays(today, daysUntilSat + 1)];
}

// Round-robin selector that pulls one promo at a time from each league in
// LEAGUE_ORDER until either the input is exhausted or `limit` cards are
// selected. Within each league, hot promos come first, then ascending date.
// This is what gives the bucket cross-league variety even when MLB's calendar
// is dense.
function orderByVariety(
  promos: PromoWithTeam[],
  limit: number,
): PromoWithTeam[] {
  if (limit <= 0) return [];
  const byLeague = new Map<string, PromoWithTeam[]>();
  for (const p of promos) {
    const arr = byLeague.get(p.team.league) ?? [];
    arr.push(p);
    byLeague.set(p.team.league, arr);
  }
  for (const [, arr] of byLeague) {
    arr.sort((a, b) => {
      if (a.highlight !== b.highlight) return a.highlight ? -1 : 1;
      if (a.date !== b.date) return a.date.localeCompare(b.date);
      return 0;
    });
  }
  const leagues = LEAGUE_ORDER.filter((l) => byLeague.has(l)) as string[];
  const result: PromoWithTeam[] = [];
  while (result.length < limit) {
    let took = 0;
    for (const l of leagues) {
      if (result.length >= limit) break;
      const arr = byLeague.get(l);
      if (arr && arr.length > 0) {
        result.push(arr.shift()!);
        took++;
      }
    }
    if (took === 0) break;
  }
  return result;
}

// Three-bucket hero picker. Tonight = today's promos. Weekend = the rest of
// the upcoming weekend (excluding today). Coming Up = next 7 days minus
// tonight + weekend. If Tonight has 5+ promos, only Tonight is rendered and a
// "More upcoming" link directs traffic to /promos/this-week.
export function pickHeroBuckets(
  windowPromos: PromoWithTeam[],
  todayYMD: string,
): HeroBuckets {
  const weekendSet = new Set(weekendDates(todayYMD));
  const next7 = new Set<string>();
  for (let i = 1; i <= 7; i++) next7.add(plusDays(todayYMD, i));

  const tonightPool: PromoWithTeam[] = [];
  const weekendPool: PromoWithTeam[] = [];
  const comingUpPool: PromoWithTeam[] = [];

  for (const p of windowPromos) {
    if (p.date === todayYMD) {
      tonightPool.push(p);
    } else if (weekendSet.has(p.date)) {
      weekendPool.push(p);
    } else if (next7.has(p.date)) {
      comingUpPool.push(p);
    }
  }

  if (tonightPool.length >= COLLAPSE_THRESHOLD) {
    return {
      tonight: orderByVariety(tonightPool, TOTAL_CAP),
      weekend: [],
      comingUp: [],
      collapsedToTonight: true,
    };
  }

  const tonight = orderByVariety(tonightPool, tonightPool.length);
  let remaining = TOTAL_CAP - tonight.length;
  const weekend = orderByVariety(weekendPool, Math.max(0, remaining));
  remaining -= weekend.length;
  const comingUp = orderByVariety(comingUpPool, Math.max(0, remaining));

  return { tonight, weekend, comingUp, collapsedToTonight: false };
}

function formatDateParts(dateStr: string) {
  const d = new Date(dateStr + 'T12:00:00');
  return {
    day: d.getDate().toString(),
    weekday: d.toLocaleDateString('en-US', { weekday: 'short' }).toUpperCase(),
    month: d.toLocaleDateString('en-US', { month: 'short' }).toUpperCase(),
  };
}

interface BucketSectionProps {
  title: string;
  promos: PromoWithTeam[];
  eyebrowState: EyebrowState;
  isFirst?: boolean;
}

function BucketSection({ title, promos, eyebrowState, isFirst }: BucketSectionProps) {
  if (promos.length === 0) return null;
  return (
    <div className={isFirst ? '' : 'mt-8'}>
      <div className="flex items-center gap-2 mb-4">
        {isFirst && (
          <span className="w-1.5 h-1.5 rounded-full bg-accent-red animate-pulse-dot" />
        )}
        <span
          className={`font-mono text-[11px] tracking-[0.15em] uppercase ${
            isFirst ? 'text-accent-red' : 'text-text-muted'
          }`}
        >
          {title}
        </span>
        <span className="font-mono text-[11px] tracking-[0.08em] text-text-dim">
          · {promos.length} promo{promos.length === 1 ? '' : 's'}
        </span>
      </div>
      <div className="-mx-6 px-6 overflow-x-auto scrollbar-thin">
        <div className="flex gap-4 pb-2 snap-x snap-mandatory">
          {promos.map((promo, i) => {
            const { day, weekday, month } = formatDateParts(promo.date);
            const typeColor =
              promo.type === 'giveaway'
                ? '#34d399'
                : promo.type === 'theme'
                ? '#a78bfa'
                : promo.type === 'kids'
                ? '#60a5fa'
                : '#fb923c';
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
                  eyebrow_state: eyebrowState,
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
    </div>
  );
}

export function TonightStrip({ buckets }: { buckets: HeroBuckets }) {
  const { tonight, weekend, comingUp, collapsedToTonight } = buckets;
  const totalCards = tonight.length + weekend.length + comingUp.length;

  if (totalCards === 0) {
    return (
      <div>
        <div className="flex items-center gap-2 mb-4">
          <span className="w-1.5 h-1.5 rounded-full bg-accent-red animate-pulse-dot" />
          <span className="font-mono text-[11px] tracking-[0.15em] uppercase text-accent-red">
            COMING UP
          </span>
        </div>
        <div className="bg-bg-card border border-border-subtle rounded-2xl p-6 text-text-secondary text-sm">
          No upcoming promos in the next two weeks. Check back tomorrow.
        </div>
      </div>
    );
  }

  return (
    <div>
      <BucketSection
        title="TONIGHT"
        promos={tonight}
        eyebrowState="TONIGHT"
        isFirst
      />
      <BucketSection
        title="THIS WEEKEND"
        promos={weekend}
        eyebrowState="WEEKEND"
        isFirst={tonight.length === 0}
      />
      <BucketSection
        title="COMING UP"
        promos={comingUp}
        eyebrowState="COMING_UP"
        isFirst={tonight.length === 0 && weekend.length === 0}
      />

      {collapsedToTonight && (
        <div className="mt-4">
          <Link
            href="/promos/this-week"
            className="inline-flex items-center gap-1.5 text-text-secondary hover:text-white text-sm font-mono tracking-[0.05em] transition-colors"
          >
            More upcoming this week
            <svg
              className="w-4 h-4"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={2}
            >
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
            </svg>
          </Link>
        </div>
      )}
    </div>
  );
}
