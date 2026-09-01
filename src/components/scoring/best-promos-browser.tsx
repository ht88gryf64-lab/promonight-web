'use client';

import { usePathname, useSearchParams } from 'next/navigation';
import { Suspense, useCallback, useEffect, useMemo, useState } from 'react';
import type { ScoredPromoWithTeam } from '@/lib/types';
import { track, type AnalyticsSurface, type ScoringPageSurface } from '@/lib/analytics';
import { ScoredPromoCard } from './scored-promo-card';
import { LeagueFilter, LEAGUE_FILTER_VALUES, type LeagueFilterValue } from './league-filter';
import { DateRangeFilter, DATE_RANGE_FILTER_VALUES, type DateRangeFilterValue } from './date-range-filter';
import type { TicketsBlockPlacement } from '../affiliates/TicketsBlock';
import { AffiliateDisclosure } from '../affiliates/AffiliateDisclosure';

type InlineAnswerBlock = {
  // Position the H2 should appear at within the filtered visible list,
  // 0-indexed. A block placed at position 15 renders after the 15th card.
  afterPosition: number;
  question: string;
  answer: string;
};

type BestPromosBrowserProps = {
  initialPromos: ScoredPromoWithTeam[];
  // The YMD the page fetched against. The browser's date window is anchored
  // here rather than to a render-time clock so the prerendered HTML and the
  // hydration render agree byte-for-byte; ISR re-anchors it with the data.
  serverTodayYMD: string;
  ticketsPlacement: Extract<
    TicketsBlockPlacement,
    'best_promos_card' | 'best_promos_bobbleheads_card'
  >;
  // Event-level surface tag for the three new typed events fired from
  // this component (score_filter_changed, scored_promo_card_tap,
  // load_more_tap). Excludes 'team_rankings' since this component never
  // renders on that page.
  trackingSurface: Exclude<ScoringPageSurface, 'team_rankings'>;
  // Affiliate surface for the card's inline TicketsBlock, passed in from the
  // route so the two best-promos pages separate partner-side.
  ticketsSurface: Extract<AnalyticsSurface, 'web_best_promos' | 'web_best_promos_bobbleheads'>;
  // Inline question-based H2-with-answer blocks injected into the list per
  // the AI Citation Doctrine. Skipped at positions past the rendered count.
  inlineAnswers?: InlineAnswerBlock[];
  // 'dark' (default) byte-identical when the gate is off; 'light' is the
  // cream-house. All filters, events, scoring, and capsules are unchanged.
  variant?: 'dark' | 'light';
  /** Retrospective mode: the forward window yielded nothing, so initialPromos
   *  carry a COMPLETED season instead of upcoming dates. Skips the
   *  today-forward date filter that would discard every one of them, and hides
   *  the date-range chips, which are meaningless once the season is over.
   *  Driven by a real emptiness condition, never a date literal, so it
   *  switches back on its own the day new data lands. */
  retrospective?: boolean;
};

const PAGE_SIZE = 50;
const RANGE_DAYS: Record<DateRangeFilterValue, number> = {
  '30d': 30,
  '90d': 90,
  season: 180,
};

function addDaysToYMD(ymd: string, days: number): string {
  const [y, m, d] = ymd.split('-').map(Number);
  const next = new Date(y, m - 1, d + days);
  return `${next.getFullYear()}-${String(next.getMonth() + 1).padStart(2, '0')}-${String(next.getDate()).padStart(2, '0')}`;
}

// The ?league=/?range= subscription, quarantined in a null-rendering child
// so the useSearchParams static-generation bailout stops at ITS Suspense
// boundary instead of swallowing the browser: the ranked card list must
// stay in the prerendered HTML (the old page-level boundary left zero
// cards in served HTML). Reading window.location once on mount is not
// enough: back/forward and same-route client navigations never remount
// this tree, and the chips would desync from the URL.
function ScoreParamsReader({
  onParams,
}: {
  onParams: (league: string | null, range: string | null) => void;
}) {
  const searchParams = useSearchParams();
  const league = searchParams.get('league');
  const range = searchParams.get('range');
  useEffect(() => {
    onParams(league, range);
  }, [league, range, onParams]);
  return null;
}

export function BestPromosBrowser({
  initialPromos,
  serverTodayYMD,
  ticketsPlacement,
  trackingSurface,
  ticketsSurface,
  inlineAnswers = [],
  variant = 'dark',
  retrospective = false,
}: BestPromosBrowserProps) {
  const light = variant === 'light';
  const labelClass = light
    ? 'font-rd text-[10px] tracking-[0.1em] uppercase text-rd-ink-faint mb-2'
    : 'font-mono text-[10px] tracking-[1.5px] uppercase text-text-muted mb-2';
  const pathname = usePathname();

  // SSR and the first client render stay on the defaults so hydration
  // matches and the default ranked list stays in the prerendered HTML; a
  // valid URL param flips the chips right after via ScoreParamsReader.
  const [league, setLeague] = useState<LeagueFilterValue>('All');
  const [range, setRange] = useState<DateRangeFilterValue>('90d');

  const syncFromParams = useCallback(
    (leagueParam: string | null, rangeParam: string | null) => {
      setLeague(
        leagueParam && (LEAGUE_FILTER_VALUES as readonly string[]).includes(leagueParam)
          ? (leagueParam as LeagueFilterValue)
          : 'All',
      );
      setRange(
        rangeParam && (DATE_RANGE_FILTER_VALUES as readonly string[]).includes(rangeParam)
          ? (rangeParam as DateRangeFilterValue)
          : '90d',
      );
    },
    [],
  );

  const [visibleCount, setVisibleCount] = useState(PAGE_SIZE);

  const filtered = useMemo(() => {
    const endYMD = addDaysToYMD(serverTodayYMD, RANGE_DAYS[range] ?? 90);
    return initialPromos.filter((p) => {
      if (league !== 'All' && p.team.league !== league) return false;
      // Retrospective rows are all in the past by definition, so the
      // today-forward window would discard every one of them.
      if (!retrospective && p.date < serverTodayYMD) return false;
      if (!retrospective && p.date > endYMD) return false;
      return true;
    });
  }, [initialPromos, serverTodayYMD, league, range, retrospective]);

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

  // Chip taps own the URL here (the chips render in controlled mode with
  // no URL hooks). Same contract FilterChips implements for the URL-synced
  // pages: default values are removed for clean URLs, unrelated params
  // (utm etc.) are preserved, and replaceState (not push) keeps the back
  // stack clean. Next syncs replaceState into useSearchParams, which
  // echoes through ScoreParamsReader as a no-op state set.
  const applyFilterParam = useCallback(
    (paramKey: 'league' | 'range', next: string, defaultValue: string) => {
      const params = new URLSearchParams(window.location.search);
      if (next === defaultValue) {
        params.delete(paramKey);
      } else {
        params.set(paramKey, next);
      }
      const qs = params.toString();
      window.history.replaceState(null, '', qs ? `${pathname}?${qs}` : pathname);
    },
    [pathname],
  );

  // Both handlers fire `score_filter_changed` with the surface +
  // filter_type before the URL update. The from/to values carry the chip
  // transition. The URL-echo path (ScoreParamsReader) never tracks: it is
  // not a user tap.
  const handleLeagueSelect = useCallback(
    (next: LeagueFilterValue) => {
      if (next === league) return;
      track('score_filter_changed', {
        surface: trackingSurface,
        filter_type: 'league',
        from: league,
        to: next,
      });
      setLeague(next);
      applyFilterParam('league', next, 'All');
    },
    [league, trackingSurface, applyFilterParam],
  );
  const handleRangeSelect = useCallback(
    (next: DateRangeFilterValue) => {
      if (next === range) return;
      track('score_filter_changed', {
        surface: trackingSurface,
        filter_type: 'range',
        from: range,
        to: next,
      });
      setRange(next);
      applyFilterParam('range', next, '90d');
    },
    [range, trackingSurface, applyFilterParam],
  );

  const handleLoadMore = () => {
    track('load_more_tap', {
      surface: trackingSurface,
      current_count: visibleCount,
    });
    setVisibleCount((v) => v + PAGE_SIZE);
  };

  return (
    <div>
      <Suspense fallback={null}>
        <ScoreParamsReader onParams={syncFromParams} />
      </Suspense>

      <div className="mb-6">
        <div className={labelClass}>Filter by league</div>
        <LeagueFilter value={league} onSelect={handleLeagueSelect} variant={variant} />
      </div>

      {!retrospective && (
        <div className="mb-8">
          <div className={labelClass}>Filter by date range</div>
          <DateRangeFilter value={range} onSelect={handleRangeSelect} variant={variant} />
        </div>
      )}

      <p className={light ? 'font-rd text-[11px] text-rd-ink-faint mb-4' : 'font-mono text-[11px] text-text-dim mb-4'}>
        {filtered.length} promo{filtered.length === 1 ? '' : 's'}{' '}
        {retrospective ? 'ranked from the completed season' : 'match this filter'}
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
                trackingSurface={trackingSurface}
                ticketsSurface={ticketsSurface}
                variant={variant}
              />
              {answerHere && (
                <section className={light ? 'my-8 border-t border-rd-line pt-6' : 'my-8 border-t border-border-subtle pt-6'}>
                  <h2 className={light ? 'rd-display text-2xl md:text-3xl uppercase text-rd-ink mb-3' : 'font-display text-2xl md:text-3xl tracking-[1px] text-white mb-3'}>
                    {answerHere.question}
                  </h2>
                  <p className={light ? 'text-rd-ink-soft text-sm leading-relaxed max-w-3xl' : 'text-text-secondary text-sm leading-relaxed max-w-3xl'}>
                    {answerHere.answer}
                  </p>
                </section>
              )}
            </div>
          );
        })}
      </div>

      {visible.length === 0 && (
        <div className={light ? 'bg-rd-card border border-rd-line rounded-2xl p-10 text-center' : 'bg-bg-card border border-border-subtle rounded-2xl p-10 text-center'}>
          <p className={light ? 'text-rd-ink-soft' : 'text-text-secondary'}>
            {retrospective
              ? 'No scored promos in this league for the 2026 season.'
              : 'No scored promos match this filter. Try a wider date range or a different league.'}
          </p>
        </div>
      )}

      {remaining > 0 && (
        <div className="mt-8 flex justify-center">
          <button
            type="button"
            onClick={handleLoadMore}
            className={
              light
                ? 'rounded-full border border-rd-line-strong bg-rd-card px-6 py-3 font-rd text-sm font-semibold uppercase tracking-[0.08em] text-rd-ink-soft transition-colors hover:border-rd-ink hover:text-rd-ink'
                : 'px-6 py-3 rounded-full border border-border-subtle bg-bg-card text-white text-sm font-mono tracking-[1px] uppercase hover:border-accent-red hover:text-accent-red transition-colors'
            }
          >
            Show {nextChunk} more · {remaining} remaining
          </button>
        </div>
      )}

      {/* Every visible ScoredPromoCard renders a TicketsBlock, and this browser
          is the only affiliate emitter on /best-promos and
          /best-promos/bobbleheads, so the disclosure lives with the cards.
          Gated on the same `visible` list the CTAs come from: filtering down to
          an empty result set removes the links and the claim together. */}
      {visible.length > 0 && (
        <AffiliateDisclosure className="mt-10 text-center" tone={light ? 'light' : 'dark'} />
      )}
    </div>
  );
}
