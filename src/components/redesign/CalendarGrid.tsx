'use client';

import { useMemo, useState } from 'react';
import type { Promo, PromoType, Team } from '@/lib/types';
import type { GameContext } from '@/lib/data';
import { normalizeSport, track } from '@/lib/analytics';
import { synthPromoId } from '@/lib/promo-helpers';
import { IconChevronLeft, IconChevronRight, IconArrowRight, IconX } from '@tabler/icons-react';
import { RD_CATEGORIES } from './categories';
import { GameExpand, LegacyPromoExpand } from './GameExpand';

// Redesign v2 season calendar. A faithful fork of team-calendar.tsx:
//   - SAME data derivation (promosByDate, gameCtxsByDate, monthsWithContent,
//     nextUpcomingKey) and the SAME 30-day / 35-cap SSR prerender window.
//   - SAME analytics in onCellClick: the game path fires game_tap per game and
//     away_game_expanded for away games; the legacy path fires promo_card_tap.
//     Event names + payloads are byte-identical to the live calendar.
//   - SAME default month (current month) and the SAME jump-to-next button.
// Only the presentation is the new light theme, and the detail expands INLINE
// (within the card) instead of in a modal. The windowed detail blocks are still
// SSR-rendered (hidden) so crawlers see the schedule + promos + CTAs.

interface CalendarGridProps {
  promos: Promo[];
  teamName: string;
  teamSlug?: string;
  sport?: string;
  team?: Team;
  gameContexts?: GameContext[];
  /** Category filter from the chips; 'all' shows every category. */
  activeCategory?: PromoType | 'all';
}

function monthKey(year: number, month: number): string {
  return `${year}-${String(month + 1).padStart(2, '0')}`;
}

const YMD_RE = /^\d{4}-\d{2}-\d{2}$/;

// Null-safe: a promo or game can carry a null/blank/undated `date` (e.g. an
// undated recurring-style event). Such a record has no calendar cell, so this
// returns null and callers skip it, instead of crashing on null.split.
function parseYMD(dateStr: string | null | undefined): { year: number; month: number; day: number } | null {
  if (!dateStr || !YMD_RE.test(dateStr)) return null;
  const [y, m, d] = dateStr.split('-').map(Number);
  return { year: y, month: m - 1, day: d };
}

function formatMonthLabel(year: number, month: number): string {
  return new Date(year, month, 1).toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
}

function formatShortDate(dateStr: string): string {
  return new Date(dateStr + 'T12:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

export function CalendarGrid({
  promos,
  teamName,
  teamSlug,
  sport,
  team,
  gameContexts,
  activeCategory = 'all',
}: CalendarGridProps) {
  const today = useMemo(() => {
    const d = new Date();
    return { year: d.getFullYear(), month: d.getMonth(), day: d.getDate() };
  }, []);
  const todayKey = `${today.year}-${String(today.month + 1).padStart(2, '0')}-${String(today.day).padStart(2, '0')}`;

  const promosByDate = useMemo(() => {
    const map = new Map<string, Promo[]>();
    for (const p of promos) {
      if (!p.date || !YMD_RE.test(p.date)) continue; // undated event: no calendar cell
      const list = map.get(p.date) ?? [];
      list.push(p);
      map.set(p.date, list);
    }
    return map;
  }, [promos]);

  const gameCtxsByDate = useMemo(() => {
    const map = new Map<string, GameContext[]>();
    if (!gameContexts) return map;
    for (const c of gameContexts) {
      if (!c.game.date || !YMD_RE.test(c.game.date)) continue; // undated game: no calendar cell
      const list = map.get(c.game.date) ?? [];
      list.push(c);
      map.set(c.game.date, list);
    }
    return map;
  }, [gameContexts]);

  const hasGamesData = !!gameContexts && gameContexts.length > 0;

  // SSR prerender window — identical to the live calendar: only the next 30 days
  // of upcoming games (hard cap 35) get a prerendered detail block; the rest
  // lazy-mount on click. Keeps large MLB pages under Bing's 1MB HTML ceiling.
  const PRERENDER_WINDOW_DAYS = 30;
  const PRERENDER_MAX = 35;
  const prerenderedDates = useMemo(() => {
    if (!hasGamesData) return null;
    const startMs = Date.UTC(today.year, today.month, today.day);
    const endMs = startMs + PRERENDER_WINDOW_DAYS * 86_400_000;
    const upcoming: string[] = [];
    for (const date of gameCtxsByDate.keys()) {
      const ymd = parseYMD(date);
      if (!ymd) continue;
      const ms = Date.UTC(ymd.year, ymd.month, ymd.day);
      if (ms >= startMs && ms <= endMs) upcoming.push(date);
    }
    upcoming.sort();
    return new Set(upcoming.slice(0, PRERENDER_MAX));
  }, [hasGamesData, gameCtxsByDate, today]);

  const monthsWithContent = useMemo(() => {
    const set = new Set<string>();
    for (const p of promos) {
      const ymd = parseYMD(p.date);
      if (!ymd) continue;
      set.add(monthKey(ymd.year, ymd.month));
    }
    if (gameContexts) {
      for (const c of gameContexts) {
        const ymd = parseYMD(c.game.date);
        if (!ymd) continue;
        set.add(monthKey(ymd.year, ymd.month));
      }
    }
    return set;
  }, [promos, gameContexts]);

  const [view, setView] = useState({ year: today.year, month: today.month });
  const [selectedDate, setSelectedDate] = useState<string | null>(null);

  const viewedMonthHasContent = monthsWithContent.has(monthKey(view.year, view.month));

  const nextUpcomingKey = useMemo(() => {
    let best: string | null = null;
    if (hasGamesData && gameContexts) {
      for (const c of gameContexts) {
        if (c.game.date >= todayKey && (best === null || c.game.date < best)) best = c.game.date;
      }
    } else {
      for (const p of promos) {
        if (p.date >= todayKey && (best === null || p.date < best)) best = p.date;
      }
    }
    return best;
  }, [promos, gameContexts, hasGamesData, todayKey]);

  const showEmptyMonthHint = !viewedMonthHasContent && nextUpcomingKey !== null;

  const jumpToNext = () => {
    if (!nextUpcomingKey) return;
    const ymd = parseYMD(nextUpcomingKey);
    if (!ymd) return;
    setSelectedDate(null);
    setView({ year: ymd.year, month: ymd.month });
  };

  const monthStart = new Date(view.year, view.month, 1);
  const monthEnd = new Date(view.year, view.month + 1, 0);
  const firstWeekday = monthStart.getDay();
  const daysInMonth = monthEnd.getDate();

  type Cell = { day: number; dateStr: string; promos: Promo[]; gameCtxs: GameContext[] };
  const cells: (Cell | null)[] = [];
  for (let i = 0; i < firstWeekday; i++) cells.push(null);
  for (let d = 1; d <= daysInMonth; d++) {
    const dateStr = `${view.year}-${String(view.month + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
    cells.push({
      day: d,
      dateStr,
      promos: promosByDate.get(dateStr) ?? [],
      gameCtxs: gameCtxsByDate.get(dateStr) ?? [],
    });
  }
  while (cells.length % 7 !== 0) cells.push(null);

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

  // Analytics — copied VERBATIM from team-calendar.tsx. Do not alter event names
  // or payloads: game_tap + away_game_expanded (game path), promo_card_tap
  // (legacy path).
  const onCellClick = (cell: Cell) => {
    const hasContent = cell.gameCtxs.length > 0 || cell.promos.length > 0;
    if (!hasContent) return;
    const isSelected = cell.dateStr === selectedDate;
    const shouldOpen = !isSelected;
    setSelectedDate(shouldOpen ? cell.dateStr : null);

    if (shouldOpen && teamSlug) {
      const normalizedSport = normalizeSport(sport);
      if (cell.gameCtxs.length > 0) {
        for (const c of cell.gameCtxs) {
          track('game_tap', {
            surface: 'web_team_page',
            team_slug: teamSlug,
            sport: normalizedSport,
            game_id: c.game.id,
            is_home: c.isHome,
            has_promo: c.promos.length > 0,
            opponent_slug: c.isHome ? c.game.awayTeamSlug : c.game.homeTeamSlug,
          });
          if (!c.isHome) {
            track('away_game_expanded', {
              surface: 'web_team_page',
              team_slug: teamSlug,
              sport: normalizedSport,
              game_id: c.game.id,
              opponent_slug: c.game.homeTeamSlug,
              has_promo: c.promos.length > 0,
            });
          }
        }
      } else {
        for (const p of cell.promos) {
          track('promo_card_tap', {
            surface: 'web_team_page',
            promo_id: synthPromoId(teamSlug, p),
            team_slug: teamSlug,
            sport: normalizedSport,
            promo_type: p.type,
          });
        }
      }
    }
  };

  // Distinct promo categories on a cell, after the active-category filter.
  const cellCategories = (cellPromos: Promo[]): PromoType[] => {
    const wanted = cellPromos.filter((p) => activeCategory === 'all' || p.type === activeCategory);
    return Array.from(new Set(wanted.map((p) => p.type))).slice(0, 3);
  };

  return (
    <div>
      <div className="bg-rd-card border border-rd-line rounded-2xl p-4 md:p-6">
        {/* Month nav */}
        <div className="flex items-center justify-between mb-4">
          <button
            onClick={goPrev}
            aria-label="Previous month"
            className="w-9 h-9 grid place-items-center rounded-lg border border-rd-line text-rd-ink-soft hover:text-rd-ink hover:border-rd-line-strong transition-colors"
          >
            <IconChevronLeft size={18} stroke={2} />
          </button>
          <div className="rd-display text-xl md:text-2xl text-rd-ink uppercase">
            {formatMonthLabel(view.year, view.month)}
          </div>
          <button
            onClick={goNext}
            aria-label="Next month"
            className="w-9 h-9 grid place-items-center rounded-lg border border-rd-line text-rd-ink-soft hover:text-rd-ink hover:border-rd-line-strong transition-colors"
          >
            <IconChevronRight size={18} stroke={2} />
          </button>
        </div>

        {/* Empty-month hint → jump to next upcoming */}
        {showEmptyMonthHint && nextUpcomingKey && (
          <button
            onClick={jumpToNext}
            className="w-full mb-4 flex items-center justify-between gap-3 rounded-lg border border-rd-line bg-rd-cream hover:border-rd-line-strong transition-colors px-3 py-2 text-left"
          >
            <span className="text-xs text-rd-ink-soft font-rd">
              {hasGamesData ? 'No games this month — next' : 'No promos this month — next promo'}{' '}
              <span className="text-rd-ink font-semibold">{formatShortDate(nextUpcomingKey)}</span>
            </span>
            <IconArrowRight size={15} stroke={2} className="text-rd-red" />
          </button>
        )}

        {/* Weekday header */}
        <div className="grid grid-cols-7 gap-1 mb-2">
          {['S', 'M', 'T', 'W', 'T', 'F', 'S'].map((d, i) => (
            <div key={i} className="text-center font-rd text-[10px] tracking-[1px] text-rd-ink-faint py-1">
              {d}
            </div>
          ))}
        </div>

        {/* Grid */}
        <div className="grid grid-cols-7 gap-1">
          {cells.map((cell, i) => {
            if (!cell) return <div key={i} className="aspect-square" />;

            const isToday = cell.dateStr === todayKey;
            const isSelected = cell.dateStr === selectedDate;
            const firstGame = cell.gameCtxs[0];
            const homeGame = firstGame?.isHome === true;
            const awayGame = firstGame?.isHome === false;
            const hasPromos = cell.promos.length > 0;
            const hasContent = hasGamesData ? !!firstGame : hasPromos;
            const hasHot =
              cell.promos.some((p) => p.highlight) ||
              (firstGame?.promos ?? []).some((p) => p.highlight);

            // Promo categories shown on the cell (own promos for legacy / home,
            // game-attached promos for the game path), filtered by activeCategory.
            const sourcePromos = hasGamesData ? firstGame?.promos ?? [] : cell.promos;
            const cats = cellCategories(sourcePromos);

            let base = 'border border-transparent text-rd-ink-faint';
            if (hasContent) {
              if (homeGame) base = 'bg-rd-red/[0.06] hover:bg-rd-red/[0.12] border-rd-red/30 text-rd-ink';
              else if (awayGame) base = 'bg-black/[0.025] hover:bg-black/[0.05] border-rd-line text-rd-ink';
              else base = 'bg-black/[0.025] hover:bg-black/[0.05] border-rd-line text-rd-ink';
            }
            const selectedClasses = isSelected ? 'bg-rd-red/[0.14] border-rd-red ring-1 ring-rd-red' : '';
            const todayRing = isToday && !isSelected ? 'ring-1 ring-rd-ink/25' : '';

            return (
              <button
                key={i}
                onClick={() => onCellClick(cell)}
                disabled={!hasContent}
                aria-label={hasContent ? `${cell.dateStr} details` : undefined}
                className={`relative aspect-square rounded-lg flex flex-col items-center justify-center transition-colors ${base} ${selectedClasses} ${todayRing}`}
              >
                <span className={`font-rd ${hasContent ? 'font-semibold' : ''} text-[11px] leading-none`}>
                  {cell.day}
                </span>

                {/* NFL week label */}
                {firstGame?.game.league === 'nfl' && firstGame.game.week != null && (
                  <span className="hidden md:block font-rd text-[7px] tracking-[0.5px] uppercase mt-0.5 leading-none text-rd-ink-faint">
                    WK {firstGame.game.week}
                  </span>
                )}

                {/* Opponent abbreviation — desktop only ("richer cells") */}
                {hasGamesData && firstGame?.opponentTeam && (
                  <span className="hidden md:block font-rd text-[8px] tracking-[0.5px] uppercase mt-0.5 leading-none text-rd-ink-soft">
                    {firstGame.isHome ? 'vs' : 'at'} {firstGame.opponentTeam.abbreviation}
                    {cell.gameCtxs.length > 1 ? ' +1' : ''}
                  </span>
                )}

                {/* NFL international badge */}
                {firstGame?.game.league === 'nfl' && firstGame.game.isInternational && firstGame.game.internationalLocation && (
                  <span className="hidden md:block font-rd text-[7px] tracking-[0.5px] uppercase mt-0.5 leading-none text-rd-red">
                    {firstGame.game.internationalLocation}
                  </span>
                )}

                {/* Category indicators: dot-only on mobile, colored pills on desktop */}
                {(cats.length > 0 || hasHot) && (
                  <div className="absolute bottom-1 flex items-center gap-0.5">
                    {cats.map((t) => (
                      <span key={t}>
                        {/* mobile dot */}
                        <span
                          className="md:hidden block w-1.5 h-1.5 rounded-full"
                          style={{ backgroundColor: RD_CATEGORIES[t].color }}
                        />
                        {/* desktop pill */}
                        <span
                          className="hidden md:block w-4 h-1.5 rounded-full"
                          style={{ backgroundColor: RD_CATEGORIES[t].color }}
                        />
                      </span>
                    ))}
                    {hasHot && (activeCategory === 'all' || activeCategory === 'giveaway' || cats.length > 0) && (
                      <span className="block w-1.5 h-1.5 rounded-full bg-rd-red shadow-[0_0_6px_rgba(218,45,32,0.8)]" />
                    )}
                  </div>
                )}
              </button>
            );
          })}
        </div>

        {/* Legend */}
        <div className="mt-5 flex flex-wrap gap-3 text-[10px] font-rd text-rd-ink-soft">
          {hasGamesData && (
            <>
              <span className="inline-flex items-center gap-1.5">
                <span className="w-3 h-3 rounded-sm bg-rd-red/[0.12] border border-rd-red/30" />
                Home
              </span>
              <span className="inline-flex items-center gap-1.5">
                <span className="w-3 h-3 rounded-sm bg-black/[0.04] border border-rd-line" />
                Away
              </span>
            </>
          )}
          {(Object.keys(RD_CATEGORIES) as PromoType[]).map((t) => (
            <span key={t} className="inline-flex items-center gap-1.5">
              <span className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: RD_CATEGORIES[t].color }} />
              {RD_CATEGORIES[t].label}
            </span>
          ))}
          <span className="inline-flex items-center gap-1.5">
            <span className="w-1.5 h-1.5 rounded-full bg-rd-red shadow-[0_0_6px_rgba(218,45,32,0.8)]" />
            Hot
          </span>
        </div>

        {/* In-place detail. Every windowed game day (and every legacy promo day)
         *  is SSR-rendered here, hidden until selected, so crawlers see the full
         *  schedule + promos + CTAs. Closed by default (selectedDate null). */}
        <div className="mt-4">
          {selectedDate && (
            <div className="mb-2 flex items-center justify-end">
              <button
                onClick={() => setSelectedDate(null)}
                className="inline-flex items-center gap-1 text-[11px] font-rd uppercase tracking-[0.08em] text-rd-ink-faint hover:text-rd-ink transition-colors"
                aria-label="Close details"
              >
                Close <IconX size={13} stroke={2} />
              </button>
            </div>
          )}

          {hasGamesData ? (
            <>
              {[...gameCtxsByDate.entries()]
                .filter(([date]) => prerenderedDates!.has(date))
                .map(([date, ctxs]) => (
                  <div key={date} hidden={selectedDate !== date}>
                    <GameExpand
                      dateStr={date}
                      contexts={ctxs}
                      team={team ?? null}
                      teamSlug={teamSlug}
                      teamName={teamName}
                    />
                  </div>
                ))}
              {/* Lazy-mount: dates outside the window render only on click. SSR
               *  and client first-render agree on omitting these (selectedDate
               *  starts null) → no hydration mismatch. */}
              {selectedDate && !prerenderedDates!.has(selectedDate) && gameCtxsByDate.has(selectedDate) && (
                <GameExpand
                  dateStr={selectedDate}
                  contexts={gameCtxsByDate.get(selectedDate)!}
                  team={team ?? null}
                  teamSlug={teamSlug}
                  teamName={teamName}
                />
              )}
            </>
          ) : (
            [...promosByDate.entries()].map(([date, list]) => (
              <div key={date} hidden={selectedDate !== date}>
                <LegacyPromoExpand dateStr={date} promos={list} team={team ?? null} teamSlug={teamSlug} />
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
