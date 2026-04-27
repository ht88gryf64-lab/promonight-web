'use client';

import { useMemo, useState } from 'react';
import type { Promo, PromoType, Team, Venue } from '@/lib/types';
import { PROMO_TYPE_COLORS, PROMO_TYPE_LABELS } from '@/lib/types';
import { PromoBadge } from './promo-badge';
import { TicketsBlock } from './affiliates/TicketsBlock';
import { ParkingCTA } from './affiliates/ParkingCTA';
import { HotelsCTA } from './affiliates/HotelsCTA';
import { normalizeSport, track } from '@/lib/analytics';
import { teamDisplayName, synthPromoId } from '@/lib/promo-helpers';
import type { GameContext } from '@/lib/data';
import { Modal } from './ui/modal';

interface TeamCalendarProps {
  promos: Promo[];
  teamName: string;
  teamSlug?: string;
  sport?: string;
  /** Full Team object — optional to preserve back-compat. When present, the
   *  selected-day detail renders per-promo Get-Tickets CTAs. */
  team?: Team;
  /** When supplied (MLB only today), the calendar renders every scheduled
   *  game — home and away — with away-game travel context. When absent,
   *  falls back to the legacy promo-only rendering. */
  gameContexts?: GameContext[];
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

function formatShortDate(dateStr: string): string {
  return new Date(dateStr + 'T12:00:00').toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
  });
}

function formatGameTime(tz: string, hhmm: string): string {
  if (!hhmm) return '';
  // Stored as UTC HH:MM — render the game start in the viewer's local tz so a
  // Kansas City fan sees 6:10 PM rather than 23:10. Good-enough approximation
  // until we store true home-venue local time.
  if (tz === 'UTC' && /^\d{2}:\d{2}$/.test(hhmm)) {
    const [h, m] = hhmm.split(':').map(Number);
    const d = new Date(Date.UTC(2026, 0, 1, h, m, 0));
    return d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
  }
  return hhmm;
}

export function TeamCalendar({ promos, teamName, teamSlug, sport, team, gameContexts }: TeamCalendarProps) {
  const today = useMemo(() => {
    const d = new Date();
    return { year: d.getFullYear(), month: d.getMonth(), day: d.getDate() };
  }, []);
  const todayKey = `${today.year}-${String(today.month + 1).padStart(2, '0')}-${String(today.day).padStart(2, '0')}`;

  const promosByDate = useMemo(() => {
    const map = new Map<string, Promo[]>();
    for (const p of promos) {
      const list = map.get(p.date) ?? [];
      list.push(p);
      map.set(p.date, list);
    }
    return map;
  }, [promos]);

  // gameCtxsByDate: one entry per game on that date (doubleheaders → 2 entries).
  const gameCtxsByDate = useMemo(() => {
    const map = new Map<string, GameContext[]>();
    if (!gameContexts) return map;
    for (const c of gameContexts) {
      const list = map.get(c.game.date) ?? [];
      list.push(c);
      map.set(c.game.date, list);
    }
    return map;
  }, [gameContexts]);

  const hasGamesData = !!gameContexts && gameContexts.length > 0;

  // Months that have *something* to show — a promo (legacy) or a game (MLB).
  const monthsWithContent = useMemo(() => {
    const set = new Set<string>();
    for (const p of promos) {
      const { year, month } = parseYMD(p.date);
      set.add(monthKey(year, month));
    }
    if (gameContexts) {
      for (const c of gameContexts) {
        const { year, month } = parseYMD(c.game.date);
        set.add(monthKey(year, month));
      }
    }
    return set;
  }, [promos, gameContexts]);

  const [view, setView] = useState({ year: today.year, month: today.month });
  const [selectedDate, setSelectedDate] = useState<string | null>(null);

  const viewedMonthHasContent = monthsWithContent.has(monthKey(view.year, view.month));

  // Earliest upcoming signal — the next game (MLB) or next promo (legacy).
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
    const { year, month } = parseYMD(nextUpcomingKey);
    setSelectedDate(null);
    setView({ year, month });
  };

  const monthStart = new Date(view.year, view.month, 1);
  const monthEnd = new Date(view.year, view.month + 1, 0);
  const firstWeekday = monthStart.getDay();
  const daysInMonth = monthEnd.getDate();

  type Cell = {
    day: number;
    dateStr: string;
    promos: Promo[];
    gameCtxs: GameContext[];
  };
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

  const selectedPromos = selectedDate ? promosByDate.get(selectedDate) ?? [] : [];
  const selectedGameCtxs = selectedDate ? gameCtxsByDate.get(selectedDate) ?? [] : [];

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

  const onCellClick = (cell: Cell) => {
    const hasContent = cell.gameCtxs.length > 0 || cell.promos.length > 0;
    if (!hasContent) return;
    const isSelected = cell.dateStr === selectedDate;
    const shouldOpen = !isSelected;
    setSelectedDate(shouldOpen ? cell.dateStr : null);

    if (shouldOpen && teamSlug) {
      const normalizedSport = normalizeSport(sport);
      if (cell.gameCtxs.length > 0) {
        // MLB-path: fire game_tap per game; away_game_expanded separately.
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
        // Legacy path — promo_card_tap per promo (preserved behavior).
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

  return (
    <section className="py-10 px-6 border-t border-border-subtle">
      <div className="max-w-3xl mx-auto">
        <div className="mb-5">
          <span className="font-mono text-[10px] tracking-[1.5px] uppercase text-accent-red">
            Calendar
          </span>
          <h2 className="font-display text-3xl md:text-4xl tracking-[1px] mt-1">
            {teamName.toUpperCase()} {hasGamesData ? 'SEASON CALENDAR' : 'PROMO CALENDAR'}
          </h2>
          {hasGamesData && (
            <p className="text-text-muted text-xs font-mono tracking-[0.5px] mt-2">
              Every scheduled home and away game · promos overlaid
            </p>
          )}
        </div>

        <div className="bg-bg-card border border-border-subtle rounded-2xl p-4 md:p-6">
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

          {showEmptyMonthHint && nextUpcomingKey && (
            <button
              onClick={jumpToNext}
              className="w-full mb-4 flex items-center justify-between gap-3 rounded-lg border border-border-subtle bg-white/[0.03] hover:bg-white/[0.06] hover:border-border-hover transition-colors px-3 py-2 text-left"
            >
              <span className="text-xs text-text-secondary">
                {hasGamesData ? 'No games this month — next' : 'No promos this month — next promo'}{' '}
                <span className="text-white font-semibold">
                  {formatShortDate(nextUpcomingKey)}
                </span>
              </span>
              <span className="text-accent-red text-sm" aria-hidden="true">→</span>
            </button>
          )}

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

          <div className="grid grid-cols-7 gap-1">
            {cells.map((cell, i) => {
              if (!cell) return <div key={i} className="aspect-square" />;

              const isToday = cell.dateStr === todayKey;
              const isSelected = cell.dateStr === selectedDate;
              const hasPromos = cell.promos.length > 0;
              const hasHot = cell.promos.some((p) => p.highlight);
              const firstGame = cell.gameCtxs[0];
              const homeGame = firstGame?.isHome === true;
              const awayGame = firstGame?.isHome === false;
              const hasContent = hasGamesData ? !!firstGame : hasPromos;

              const typeColors = Array.from(
                new Set(cell.promos.map((p) => PROMO_TYPE_COLORS[p.type])),
              ).slice(0, 4);

              // Background + border for the cell varies by game context.
              let base = 'bg-transparent border border-transparent text-text-dim';
              if (hasContent) {
                if (homeGame) {
                  base = 'bg-accent-red/15 hover:bg-accent-red/25 border border-accent-red/40';
                } else if (awayGame) {
                  base = 'bg-white/[0.03] hover:bg-white/[0.08] border border-border-subtle';
                } else {
                  // Legacy promo-only cell (non-MLB).
                  base = 'bg-white/[0.03] hover:bg-white/[0.06] border border-border-subtle';
                }
              }
              const selectedClasses = isSelected
                ? 'bg-accent-red/30 border-accent-red'
                : '';

              return (
                <button
                  key={i}
                  onClick={() => onCellClick(cell)}
                  disabled={!hasContent}
                  className={`relative aspect-square rounded-lg flex flex-col items-center justify-center text-sm transition-colors ${base} ${selectedClasses} ${isToday ? 'ring-1 ring-white/40' : ''}`}
                >
                  <span className={`${hasContent ? 'text-white' : ''} font-mono text-[11px] leading-none`}>{cell.day}</span>

                  {/* Opponent abbreviation for MLB cells */}
                  {hasGamesData && firstGame?.opponentTeam && (
                    <span className="font-mono text-[8px] tracking-[0.5px] uppercase mt-0.5 leading-none text-text-secondary">
                      {firstGame.isHome ? 'vs' : 'at'} {firstGame.opponentTeam.abbreviation}
                      {cell.gameCtxs.length > 1 ? ' +1' : ''}
                    </span>
                  )}

                  {/* Promo dots (home-game promos or away-game promos at opp venue) */}
                  {(hasPromos || (firstGame && firstGame.promos.length > 0)) && (
                    <div className="absolute bottom-1 flex items-center gap-0.5">
                      {(hasPromos ? typeColors : Array.from(new Set((firstGame?.promos ?? []).map((p) => PROMO_TYPE_COLORS[p.type]))).slice(0, 4)).map((c, j) => (
                        <span
                          key={j}
                          className="w-1.5 h-1.5 rounded-full"
                          style={{ backgroundColor: c }}
                        />
                      ))}
                      {(hasHot || (firstGame?.promos ?? []).some((p) => p.highlight)) && (
                        <span className="w-1.5 h-1.5 rounded-full bg-accent-red ml-0.5 shadow-[0_0_6px_rgba(239,68,68,0.9)]" />
                      )}
                    </div>
                  )}
                </button>
              );
            })}
          </div>

          {/* Legend */}
          <div className="mt-5 flex flex-wrap gap-3 text-[10px] font-mono text-text-muted">
            {hasGamesData && (
              <>
                <span className="inline-flex items-center gap-1.5">
                  <span className="w-3 h-3 rounded-sm bg-accent-red/25 border border-accent-red/40" />
                  Home game
                </span>
                <span className="inline-flex items-center gap-1.5">
                  <span className="w-3 h-3 rounded-sm bg-white/[0.05] border border-border-subtle" />
                  Away game
                </span>
              </>
            )}
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

      </div>

      {/* Detail modal.
       *
       * Every game / promo day is SSR-rendered inside the dialog so crawlers
       * see the full content (opponent venues, promos, affiliate CTAs) in the
       * HTML source. The dialog is closed by default (UA display:none) and
       * each child is gated by the `hidden` attribute, so only the active
       * day is visible when the modal is open. Clicking a cell calls
       * showModal() on the dialog; the browser provides focus trap + focus
       * restore per spec. */}
      <Modal
        isOpen={!!selectedDate}
        onClose={() => setSelectedDate(null)}
        ariaLabel={selectedDate ? `Game details for ${dayHeader(selectedDate)}` : 'Game details'}
      >
        {hasGamesData
          ? [...gameCtxsByDate.entries()].map(([date, ctxs]) => (
              <div key={date} hidden={selectedDate !== date}>
                <GameDayDetail
                  dateStr={date}
                  contexts={ctxs}
                  team={team ?? null}
                  teamSlug={teamSlug}
                />
              </div>
            ))
          : [...promosByDate.entries()].map(([date, list]) => (
              <div key={date} hidden={selectedDate !== date}>
                <LegacyPromoDetail
                  dateStr={date}
                  promos={list}
                  team={team ?? null}
                  teamSlug={teamSlug}
                />
              </div>
            ))}
      </Modal>
    </section>
  );
}

function dayHeader(dateStr: string): string {
  return new Date(dateStr + 'T12:00:00').toLocaleDateString('en-US', {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
  });
}

function GameDayDetail({
  dateStr,
  contexts,
  team,
  teamSlug,
}: {
  dateStr: string;
  contexts: GameContext[];
  team: Team | null;
  teamSlug?: string;
}) {
  return (
    <div className="mt-4 space-y-4">
      {contexts.map((c, i) => (
        <GameDetailRow
          key={`${c.game.id}-${i}`}
          dateStr={dateStr}
          ctx={c}
          team={team}
          teamSlug={teamSlug}
          showDate={i === 0}
        />
      ))}
    </div>
  );
}

function GameDetailRow({
  dateStr,
  ctx,
  team,
  teamSlug,
  showDate,
}: {
  dateStr: string;
  ctx: GameContext;
  team: Team | null;
  teamSlug?: string;
  showDate: boolean;
}) {
  const { game, isHome, opponentTeam, opponentVenue, promos } = ctx;
  const timeLabel = formatGameTime(game.gameTimeTz, game.gameTime);
  const oppName = opponentTeam ? teamDisplayName(opponentTeam) : '';
  const oppSlug = isHome ? game.awayTeamSlug : game.homeTeamSlug;

  const placement = isHome ? 'home_game_card' : 'away_game_card';

  return (
    <div
      className={`bg-bg-card rounded-2xl p-5 ${isHome ? 'border border-accent-red/30' : 'border border-border-subtle'}`}
    >
      {showDate && (
        <div className="font-mono text-[10px] tracking-[1px] uppercase text-accent-red mb-3">
          {dayHeader(dateStr)}
          {game.doubleheaderGame && ` · Doubleheader Game ${game.doubleheaderGame}`}
          {game.status !== 'scheduled' && ` · ${game.status.toUpperCase()}`}
          {game.isPostseason && ` · Playoffs`}
        </div>
      )}

      <div className="flex items-start justify-between gap-3 mb-3">
        <div>
          <div className="font-mono text-[10px] tracking-[1.5px] uppercase text-text-muted">
            {isHome ? 'Home game' : `At ${opponentVenue?.name || 'opponent venue'}`}
          </div>
          <div className="font-display text-lg md:text-xl tracking-[0.5px] text-white mt-1">
            {isHome ? 'vs' : 'at'} {oppName}
          </div>
          {opponentVenue && !isHome && (
            <div className="text-text-secondary text-xs mt-1">
              {opponentVenue.name}
              {opponentVenue.address ? ` · ${opponentVenue.address.split(',').slice(-3, -2)[0]?.trim() || opponentVenue.address}` : ''}
            </div>
          )}
        </div>
        {timeLabel && (
          <div className="font-mono text-xs text-text-dim whitespace-nowrap">{timeLabel}</div>
        )}
      </div>

      {promos.length > 0 && (
        <div className="space-y-2 mb-4">
          {promos.map((p, i) => (
            <div
              key={i}
              className="flex gap-3"
              style={{ borderLeft: `3px solid ${PROMO_TYPE_COLORS[p.type]}`, paddingLeft: '12px' }}
            >
              <span className="text-xl" aria-hidden="true">{p.icon}</span>
              <div className="flex-1 min-w-0">
                <div className="flex flex-wrap items-center gap-2 mb-1">
                  <PromoBadge type={p.type} />
                  {p.highlight && (
                    <span className="inline-flex items-center gap-1 text-[10px] font-mono text-accent-red">
                      <span className="w-1.5 h-1.5 rounded-full bg-accent-red animate-pulse-dot" />
                      HOT
                    </span>
                  )}
                </div>
                <div className="text-white font-semibold text-sm">{p.title}</div>
                {p.description && (
                  <p className="text-text-secondary text-xs mt-0.5 leading-relaxed">
                    {p.description}
                  </p>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* CTA stack — tickets always; parking + hotels for away games where
       *  the user is travelling to the opponent's venue. All three sections
       *  use the polished `variant='card'` look so the modal reads as a
       *  uniform stack regardless of which CTAs apply. */}
      <div className="mt-4 space-y-4">
        {team && (
          <TicketsBlock
            team={team}
            surface="web_team_page"
            placement={placement}
            promoId={teamSlug ? `${teamSlug}:${game.date}:${game.id}` : undefined}
            variant="card"
          />
        )}
        {!isHome && opponentTeam && (
          <>
            <ParkingCTA
              team={opponentTeam}
              venue={opponentVenue}
              surface="web_team_page"
              placement={placement}
              compact
            />
            <HotelsCTA
              team={opponentTeam}
              venue={opponentVenue}
              surface="web_team_page"
              placement={placement}
              variant="modal-row"
            />
            <a
              href={`/${opponentTeam.sportSlug}/${opponentTeam.id}`}
              className="inline-flex items-center gap-1 text-[11px] font-mono tracking-[0.08em] uppercase text-text-secondary hover:text-white transition-colors"
            >
              View {oppName} full schedule →
            </a>
          </>
        )}
      </div>
    </div>
  );
}

function LegacyPromoDetail({
  dateStr,
  promos,
  team,
  teamSlug,
}: {
  dateStr: string;
  promos: Promo[];
  team: Team | null;
  teamSlug?: string;
}) {
  return (
    <div className="mt-4 bg-bg-card border border-accent-red/30 rounded-2xl p-5">
      <div className="font-mono text-[10px] tracking-[1px] uppercase text-accent-red mb-3">
        {dayHeader(dateStr)}
      </div>
      <div className="space-y-3">
        {promos.map((p, i) => (
          <div
            key={i}
            className="flex gap-3"
            style={{ borderLeft: `3px solid ${PROMO_TYPE_COLORS[p.type]}`, paddingLeft: '12px' }}
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
              {team && teamSlug && (
                <div className="mt-3">
                  <TicketsBlock
                    team={team}
                    surface="web_team_page"
                    placement="promo_card"
                    promoId={`${teamSlug}:${p.date}:${p.title}`}
                    variant="card"
                  />
                </div>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
