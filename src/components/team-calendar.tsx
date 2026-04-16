'use client';

import { useMemo, useState } from 'react';
import type { Promo, PromoType } from '@/lib/types';
import { PROMO_TYPE_COLORS, PROMO_TYPE_LABELS } from '@/lib/types';
import { PromoBadge } from './promo-badge';

interface TeamCalendarProps {
  promos: Promo[];
  teamName: string;
}

function monthKey(year: number, month: number): string {
  return `${year}-${String(month + 1).padStart(2, '0')}`;
}

function parseYMD(dateStr: string): { year: number; month: number; day: number } {
  const [y, m, d] = dateStr.split('-').map(Number);
  return { year: y, month: m - 1, day: d };
}

function formatMonthLabel(year: number, month: number): string {
  return new Date(year, month, 1).toLocaleDateString('en-US', {
    month: 'long',
    year: 'numeric',
  });
}

export function TeamCalendar({ promos, teamName }: TeamCalendarProps) {
  const today = useMemo(() => {
    const d = new Date();
    return { year: d.getFullYear(), month: d.getMonth(), day: d.getDate() };
  }, []);
  const todayKey = `${today.year}-${String(today.month + 1).padStart(2, '0')}-${String(today.day).padStart(2, '0')}`;

  // Index promos by YYYY-MM-DD
  const promosByDate = useMemo(() => {
    const map = new Map<string, Promo[]>();
    for (const p of promos) {
      const list = map.get(p.date) ?? [];
      list.push(p);
      map.set(p.date, list);
    }
    return map;
  }, [promos]);

  // Months that have any promo
  const monthsWithPromos = useMemo(() => {
    const set = new Set<string>();
    for (const p of promos) {
      const { year, month } = parseYMD(p.date);
      set.add(monthKey(year, month));
    }
    return set;
  }, [promos]);

  // Default month: current month if it has promos, otherwise the next upcoming month
  const defaultMonth = useMemo(() => {
    if (monthsWithPromos.has(monthKey(today.year, today.month))) {
      return { year: today.year, month: today.month };
    }
    const upcoming = promos.find((p) => p.date >= todayKey);
    if (upcoming) {
      const { year, month } = parseYMD(upcoming.date);
      return { year, month };
    }
    if (promos.length > 0) {
      const { year, month } = parseYMD(promos[0].date);
      return { year, month };
    }
    return { year: today.year, month: today.month };
  }, [monthsWithPromos, promos, today.year, today.month, todayKey]);

  const [view, setView] = useState(defaultMonth);
  const [selectedDate, setSelectedDate] = useState<string | null>(null);

  const monthStart = new Date(view.year, view.month, 1);
  const monthEnd = new Date(view.year, view.month + 1, 0);
  const firstWeekday = monthStart.getDay(); // 0 = Sun
  const daysInMonth = monthEnd.getDate();

  const cells: ({ day: number; dateStr: string; promos: Promo[] } | null)[] = [];
  for (let i = 0; i < firstWeekday; i++) cells.push(null);
  for (let d = 1; d <= daysInMonth; d++) {
    const dateStr = `${view.year}-${String(view.month + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
    cells.push({ day: d, dateStr, promos: promosByDate.get(dateStr) ?? [] });
  }
  while (cells.length % 7 !== 0) cells.push(null);

  const selectedPromos = selectedDate ? promosByDate.get(selectedDate) ?? [] : [];

  const goPrev = () => {
    setSelectedDate(null);
    setView((v) => {
      const m = v.month - 1;
      return m < 0 ? { year: v.year - 1, month: 11 } : { year: v.year, month: m };
    });
  };
  const goNext = () => {
    setSelectedDate(null);
    setView((v) => {
      const m = v.month + 1;
      return m > 11 ? { year: v.year + 1, month: 0 } : { year: v.year, month: m };
    });
  };

  return (
    <section className="py-10 px-6 border-t border-border-subtle">
      <div className="max-w-3xl mx-auto">
        <div className="mb-5">
          <span className="font-mono text-[10px] tracking-[1.5px] uppercase text-accent-red">
            Calendar
          </span>
          <h2 className="font-display text-3xl md:text-4xl tracking-[1px] mt-1">
            {teamName.toUpperCase()} PROMO CALENDAR
          </h2>
        </div>

        <div className="bg-bg-card border border-border-subtle rounded-2xl p-4 md:p-6">
          {/* Month header */}
          <div className="flex items-center justify-between mb-4">
            <button
              onClick={goPrev}
              aria-label="Previous month"
              className="w-9 h-9 flex items-center justify-center rounded-lg border border-border-subtle text-text-secondary hover:text-white hover:border-border-hover transition-colors"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" /></svg>
            </button>
            <div className="font-display text-xl md:text-2xl tracking-[1px]">
              {formatMonthLabel(view.year, view.month).toUpperCase()}
            </div>
            <button
              onClick={goNext}
              aria-label="Next month"
              className="w-9 h-9 flex items-center justify-center rounded-lg border border-border-subtle text-text-secondary hover:text-white hover:border-border-hover transition-colors"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" /></svg>
            </button>
          </div>

          {/* Weekday header */}
          <div className="grid grid-cols-7 gap-1 mb-2">
            {['S', 'M', 'T', 'W', 'T', 'F', 'S'].map((d, i) => (
              <div
                key={i}
                className="text-center font-mono text-[10px] tracking-[1px] text-text-dim py-1"
              >
                {d}
              </div>
            ))}
          </div>

          {/* Day grid */}
          <div className="grid grid-cols-7 gap-1">
            {cells.map((cell, i) => {
              if (!cell) return <div key={i} className="aspect-square" />;

              const isToday = cell.dateStr === todayKey;
              const isSelected = cell.dateStr === selectedDate;
              const hasPromos = cell.promos.length > 0;
              const hasHot = cell.promos.some((p) => p.highlight);

              const typeColors = Array.from(
                new Set(cell.promos.map((p) => PROMO_TYPE_COLORS[p.type])),
              ).slice(0, 4);

              return (
                <button
                  key={i}
                  onClick={() =>
                    setSelectedDate(hasPromos && !isSelected ? cell.dateStr : null)
                  }
                  disabled={!hasPromos}
                  className={`relative aspect-square rounded-lg flex flex-col items-center justify-center text-sm transition-colors ${
                    isSelected
                      ? 'bg-accent-red/20 border border-accent-red'
                      : hasPromos
                      ? 'bg-white/[0.03] hover:bg-white/[0.06] border border-border-subtle'
                      : 'bg-transparent border border-transparent text-text-dim'
                  } ${isToday ? 'ring-1 ring-white/40' : ''}`}
                >
                  <span className={`${hasPromos ? 'text-white' : ''} font-mono`}>{cell.day}</span>
                  {hasPromos && (
                    <div className="absolute bottom-1 flex items-center gap-0.5">
                      {typeColors.map((c, j) => (
                        <span
                          key={j}
                          className="w-1.5 h-1.5 rounded-full"
                          style={{ backgroundColor: c }}
                        />
                      ))}
                      {hasHot && (
                        <span
                          className="w-1.5 h-1.5 rounded-full bg-accent-red ml-0.5 shadow-[0_0_6px_rgba(239,68,68,0.9)]"
                        />
                      )}
                    </div>
                  )}
                </button>
              );
            })}
          </div>

          {/* Legend */}
          <div className="mt-5 flex flex-wrap gap-3 text-[10px] font-mono text-text-muted">
            {(Object.keys(PROMO_TYPE_COLORS) as PromoType[]).map((t) => (
              <span key={t} className="inline-flex items-center gap-1.5">
                <span
                  className="w-1.5 h-1.5 rounded-full"
                  style={{ backgroundColor: PROMO_TYPE_COLORS[t] }}
                />
                {PROMO_TYPE_LABELS[t]}
              </span>
            ))}
            <span className="inline-flex items-center gap-1.5">
              <span className="w-1.5 h-1.5 rounded-full bg-accent-red shadow-[0_0_6px_rgba(239,68,68,0.9)]" />
              Hot
            </span>
          </div>
        </div>

        {/* Selected day detail */}
        {selectedDate && selectedPromos.length > 0 && (
          <div className="mt-4 bg-bg-card border border-accent-red/30 rounded-2xl p-5">
            <div className="font-mono text-[10px] tracking-[1px] uppercase text-accent-red mb-3">
              {new Date(selectedDate + 'T12:00:00').toLocaleDateString('en-US', {
                weekday: 'long',
                month: 'long',
                day: 'numeric',
              })}
            </div>
            <div className="space-y-3">
              {selectedPromos.map((p, i) => (
                <div
                  key={i}
                  className="flex gap-3"
                  style={{
                    borderLeft: `3px solid ${PROMO_TYPE_COLORS[p.type]}`,
                    paddingLeft: '12px',
                  }}
                >
                  <span className="text-xl">{p.icon}</span>
                  <div className="flex-1 min-w-0">
                    <div className="flex flex-wrap items-center gap-2 mb-1">
                      <PromoBadge type={p.type} />
                      {p.highlight && (
                        <span className="inline-flex items-center gap-1 text-[10px] font-mono text-accent-red">
                          <span className="w-1.5 h-1.5 rounded-full bg-accent-red animate-pulse-dot" />
                          HOT
                        </span>
                      )}
                      {p.time && (
                        <span className="text-text-dim text-[10px] font-mono">{p.time}</span>
                      )}
                    </div>
                    <div className="text-white font-semibold text-sm">{p.title}</div>
                    {p.description && (
                      <p className="text-text-secondary text-xs mt-0.5 leading-relaxed">
                        {p.description}
                      </p>
                    )}
                    {p.opponent && (
                      <div className="text-text-dim text-[10px] font-mono mt-1 uppercase tracking-[0.5px]">
                        vs {p.opponent}
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </section>
  );
}
