'use client';

import { useState } from 'react';
import { PromoBadge } from './promo-badge';
import type { Promo, PromoType } from '@/lib/types';
import { PROMO_TYPE_LABELS } from '@/lib/types';
import { event } from '@/lib/analytics';

function formatPromoDate(dateStr: string): { day: string; weekday: string; month: string; full: string } {
  const date = new Date(dateStr + 'T12:00:00');
  return {
    day: date.getDate().toString(),
    weekday: date.toLocaleDateString('en-US', { weekday: 'short' }).toUpperCase(),
    month: date.toLocaleDateString('en-US', { month: 'short' }).toUpperCase(),
    full: date.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' }),
  };
}

const FILTER_TYPES: (PromoType | 'all')[] = ['all', 'giveaway', 'theme', 'food', 'kids'];

export function PromoList({ promos, teamColor, teamSlug }: { promos: Promo[]; teamColor: string; teamSlug?: string }) {
  const [filter, setFilter] = useState<PromoType | 'all'>('all');
  const [showPast, setShowPast] = useState(false);

  const today = new Date().toISOString().split('T')[0];

  const filtered = promos.filter((p) => {
    if (filter !== 'all' && p.type !== filter) return false;
    if (!showPast && p.date < today) return false;
    return true;
  });

  const upcomingCount = promos.filter((p) => p.date >= today).length;
  const pastCount = promos.filter((p) => p.date < today).length;

  return (
    <section className="py-12 px-6">
      <div className="max-w-5xl mx-auto">
        <div className="flex items-end justify-between mb-6">
          <div>
            <span className="font-mono text-[10px] tracking-[1.5px] uppercase text-accent-red">
              Schedule
            </span>
            <h2 className="font-display text-3xl md:text-4xl tracking-[1px] mt-1">
              {showPast ? 'PAST' : 'UPCOMING'} PROMOS
            </h2>
          </div>
          <button
            onClick={() => setShowPast(!showPast)}
            className="text-text-muted text-xs font-mono hover:text-white transition-colors"
          >
            {showPast ? `Show Upcoming (${upcomingCount})` : `Show Past (${pastCount})`}
          </button>
        </div>

        {/* Type filters */}
        <div className="flex flex-wrap gap-2 mb-8">
          {FILTER_TYPES.map((type) => {
            const count =
              type === 'all'
                ? filtered.length
                : promos.filter((p) => p.type === type && (showPast || p.date >= today)).length;
            return (
              <button
                key={type}
                onClick={() => { setFilter(type); if (teamSlug) event('promo_filter_used', { filter_type: type, team_slug: teamSlug }); }}
                className={`px-4 py-1.5 rounded-full text-[11px] font-mono tracking-[0.5px] uppercase transition-colors border ${
                  filter === type
                    ? 'bg-accent-red text-white border-accent-red'
                    : 'bg-transparent text-text-secondary border-border-subtle hover:border-border-hover'
                }`}
              >
                {type === 'all' ? 'All' : PROMO_TYPE_LABELS[type]} ({count})
              </button>
            );
          })}
        </div>

        {/* Promo list */}
        <div className="space-y-3">
          {filtered.map((promo, i) => {
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

        {filtered.length === 0 && (
          <div className="text-center py-16">
            <p className="text-text-muted text-lg">No promos found</p>
            <p className="text-text-dim text-sm mt-1">
              {showPast ? 'No past promos match this filter' : 'Check back later for upcoming promos'}
            </p>
          </div>
        )}
      </div>
    </section>
  );
}
