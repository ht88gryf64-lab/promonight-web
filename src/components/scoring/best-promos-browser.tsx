'use client';

import { useSearchParams } from 'next/navigation';
import { useMemo, useState } from 'react';
import type { ScoredPromoWithTeam } from '@/lib/types';
import { ScoredPromoCard } from './scored-promo-card';
import { LeagueFilter, type LeagueFilterValue } from './league-filter';
import { DateRangeFilter, type DateRangeFilterValue } from './date-range-filter';
import type { TicketsBlockPlacement } from '../affiliates/TicketsBlock';

type InlineAnswerBlock = {
  // Position the H2 should appear at within the filtered visible list,
  // 0-indexed. A block placed at position 15 renders after the 15th card.
  afterPosition: number;
  question: string;
  answer: string;
};

type BestPromosBrowserProps = {
  initialPromos: ScoredPromoWithTeam[];
  ticketsPlacement: Extract<
    TicketsBlockPlacement,
    'best_promos_card' | 'best_promos_bobbleheads_card'
  >;
  // Inline question-based H2-with-answer blocks injected into the list per
  // the AI Citation Doctrine. Skipped at positions past the rendered count.
  inlineAnswers?: InlineAnswerBlock[];
};

const PAGE_SIZE = 50;
const RANGE_DAYS: Record<DateRangeFilterValue, number> = {
  '30d': 30,
  '90d': 90,
  season: 180,
};

function localYMD(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}
function addDaysYMD(base: Date, days: number): string {
  const d = new Date(base);
  d.setDate(d.getDate() + days);
  return localYMD(d);
}

export function BestPromosBrowser({
  initialPromos,
  ticketsPlacement,
  inlineAnswers = [],
}: BestPromosBrowserProps) {
  const searchParams = useSearchParams();
  const league = (searchParams.get('league') || 'All') as LeagueFilterValue;
  const range = (searchParams.get('range') || '90d') as DateRangeFilterValue;

  const [visibleCount, setVisibleCount] = useState(PAGE_SIZE);

  // Date stamps recomputed at render time. Stable enough across normal
  // session lengths; a session left open past midnight will re-derive on
  // the next interaction and shift the window forward.
  const filtered = useMemo(() => {
    const now = new Date();
    const startYMD = localYMD(now);
    const endYMD = addDaysYMD(now, RANGE_DAYS[range] ?? 90);

    return initialPromos.filter((p) => {
      if (league !== 'All' && p.team.league !== league) return false;
      if (p.date < startYMD) return false;
      if (p.date > endYMD) return false;
      return true;
    });
  }, [initialPromos, league, range]);

  // Reset visible count when filters change so the user doesn't see a tiny
  // visible window if they narrow filters with N previously loaded.
  const filterKey = `${league}|${range}`;
  const [lastFilterKey, setLastFilterKey] = useState(filterKey);
  if (filterKey !== lastFilterKey) {
    setLastFilterKey(filterKey);
    setVisibleCount(PAGE_SIZE);
  }

  const visible = filtered.slice(0, visibleCount);
  const remaining = Math.max(0, filtered.length - visible.length);
  const nextChunk = Math.min(PAGE_SIZE, remaining);

  // Sort answer blocks by position so we can interleave them as we walk
  // the visible list. Skip any block whose position is past `visible.length`.
  const sortedAnswers = useMemo(
    () => [...inlineAnswers].sort((a, b) => a.afterPosition - b.afterPosition),
    [inlineAnswers],
  );

  return (
    <div>
      <div className="mb-6">
        <div className="font-mono text-[10px] tracking-[1.5px] uppercase text-text-muted mb-2">
          Filter by league
        </div>
        <LeagueFilter />
      </div>

      <div className="mb-8">
        <div className="font-mono text-[10px] tracking-[1.5px] uppercase text-text-muted mb-2">
          Filter by date range
        </div>
        <DateRangeFilter />
      </div>

      <p className="font-mono text-[11px] text-text-dim mb-4">
        {filtered.length} promo{filtered.length === 1 ? '' : 's'} match this
        filter
      </p>

      <div className="space-y-3">
        {visible.map((promo, i) => {
          const answerHere = sortedAnswers.find((a) => a.afterPosition === i);
          return (
            <div key={`${promo.team.id}-${promo.promoId}`}>
              <ScoredPromoCard
                promo={promo}
                showTickets
                ticketsPlacement={ticketsPlacement}
              />
              {answerHere && (
                <section className="my-8 border-t border-border-subtle pt-6">
                  <h2 className="font-display text-2xl md:text-3xl tracking-[1px] text-white mb-3">
                    {answerHere.question}
                  </h2>
                  <p className="text-text-secondary text-sm leading-relaxed max-w-3xl">
                    {answerHere.answer}
                  </p>
                </section>
              )}
            </div>
          );
        })}
      </div>

      {visible.length === 0 && (
        <div className="bg-bg-card border border-border-subtle rounded-2xl p-10 text-center">
          <p className="text-text-secondary">
            No scored promos match this filter. Try a wider date range or a
            different league.
          </p>
        </div>
      )}

      {remaining > 0 && (
        <div className="mt-8 flex justify-center">
          <button
            type="button"
            onClick={() => setVisibleCount((v) => v + PAGE_SIZE)}
            className="px-6 py-3 rounded-full border border-border-subtle bg-bg-card text-white text-sm font-mono tracking-[1px] uppercase hover:border-accent-red hover:text-accent-red transition-colors"
          >
            Show {nextChunk} more · {remaining} remaining
          </button>
        </div>
      )}
    </div>
  );
}
