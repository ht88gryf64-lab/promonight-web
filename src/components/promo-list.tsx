import Image from 'next/image';
import { PromoBadge } from './promo-badge';
import { TrackedAppLink } from './analytics-events';
import { ANDROID_APP_URL } from './app-download-buttons';
import type { Promo } from '@/lib/types';

function formatPromoDate(dateStr: string): { day: string; weekday: string; month: string } {
  const date = new Date(dateStr + 'T12:00:00');
  return {
    day: date.getDate().toString(),
    weekday: date.toLocaleDateString('en-US', { weekday: 'short' }).toUpperCase(),
    month: date.toLocaleDateString('en-US', { month: 'short' }).toUpperCase(),
  };
}

export function PromoList({
  promos,
  teamColor,
  teamSlug,
  teamName,
  totalPromoCount,
}: {
  promos: Promo[];
  teamColor: string;
  teamSlug: string;
  teamName: string;
  totalPromoCount: number;
}) {
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
        </div>

        {/* Promo list — max 3 */}
        <div className="space-y-3">
          {promos.map((promo, i) => {
            const { day, weekday, month } = formatPromoDate(promo.date);
            const typeColor =
              promo.type === 'giveaway' ? '#34d399' :
              promo.type === 'theme' ? '#a78bfa' :
              promo.type === 'kids' ? '#60a5fa' : '#fb923c';

            return (
              <div
                key={i}
                className="group bg-bg-card border border-border-subtle rounded-2xl p-4 md:p-5 transition-all hover:border-border-hover flex gap-4"
                style={{ borderLeftWidth: '3px', borderLeftColor: typeColor }}
              >
                {/* Date column */}
                <div className="flex-shrink-0 w-14 text-center">
                  <div className="font-mono text-[9px] tracking-[1px] text-text-muted">{month}</div>
                  <div className="font-display text-3xl leading-none">{day}</div>
                  <div className="font-mono text-[9px] tracking-[1px] text-text-dim">{weekday}</div>
                </div>

                {/* Content */}
                <div className="flex-1 min-w-0">
                  <div className="flex flex-wrap items-center gap-2 mb-1.5">
                    <span className="text-lg">{promo.icon}</span>
                    <PromoBadge type={promo.type} />
                    {promo.highlight && (
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
                    <p className="text-text-secondary text-xs md:text-sm mt-1 line-clamp-2">
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
          })}
        </div>

        {promos.length === 0 && (
          <div className="text-center py-12">
            <p className="text-text-muted text-lg">No upcoming promos yet</p>
            <p className="text-text-dim text-sm mt-1">Check back later for the latest schedule</p>
          </div>
        )}

        {/* See all promos CTA */}
        {totalPromoCount > promos.length && (
          <div className="mt-8 bg-bg-card border border-border-subtle rounded-2xl p-8 text-center">
            <p className="font-display text-2xl md:text-3xl tracking-[1px] mb-2">
              SEE ALL {totalPromoCount} PROMOS IN THE APP
            </p>
            <p className="text-text-secondary text-sm mb-6 max-w-md mx-auto">
              Get the full {teamName} promo calendar with push notifications, filters, and ticket links.
            </p>
            <div className="flex items-center justify-center gap-3 flex-wrap">
              <TrackedAppLink
                href="/download"
                platform="ios"
                section="promo_list_cta"
                page={`team/${teamSlug}`}
                teamSlug={teamSlug}
                className="inline-flex items-center gap-2 bg-accent-red text-white font-bold text-sm px-6 py-3 rounded-xl transition-all hover:-translate-y-0.5 hover:shadow-[0_0_30px_rgba(239,68,68,0.3)]"
              >
                <svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor"><path d="M18.71 19.5c-.83 1.24-1.71 2.45-3.05 2.47-1.34.03-1.77-.79-3.29-.79-1.53 0-2 .77-3.27.82-1.31.05-2.3-1.32-3.14-2.53C4.25 17 2.94 12.45 4.7 9.39c.87-1.52 2.43-2.48 4.12-2.51 1.28-.02 2.5.87 3.29.87.78 0 2.26-1.07 3.8-.91.65.03 2.47.26 3.64 1.98-.09.06-2.17 1.28-2.15 3.81.03 3.02 2.65 4.03 2.68 4.04-.03.07-.42 1.44-1.38 2.83M13 3.5c.73-.83 1.94-1.46 2.94-1.5.13 1.17-.34 2.35-1.04 3.19-.69.85-1.83 1.51-2.95 1.42-.15-1.15.41-2.35 1.05-3.11z"/></svg>
                Download for iOS
              </TrackedAppLink>
              <TrackedAppLink
                href={ANDROID_APP_URL}
                platform="android"
                section="promo_list_cta"
                page={`team/${teamSlug}`}
                teamSlug={teamSlug}
                className="inline-flex items-center transition-all hover:-translate-y-0.5"
              >
                <Image
                  src="/google-play-badge.png"
                  alt="Get it on Google Play"
                  width={44 * (646 / 250)}
                  height={44}
                  unoptimized
                />
              </TrackedAppLink>
            </div>
          </div>
        )}
      </div>
    </section>
  );
}
