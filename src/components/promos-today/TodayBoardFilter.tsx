'use client';

import { useRef, useState, type ReactNode } from 'react';
import { track, type AnalyticsSurface } from '@/lib/analytics';

// Client-side league filter for the /promos/today board. The sections are
// SERVER-rendered and passed as children (so SSR emits every card and crawlers
// see the full board); the pills only toggle a `hidden` class on the tagged
// wrappers — no fetch, no route, no scroll, no effect on ISR/caching. Mirrors the
// aggregator's chip philosophy.
//
// Each filterable wrapper in `children` carries:
//   data-filter-league="MLB"         the league it belongs to
//   data-filter-empty="true|false"   whether it is a "no promos" placeholder
// and the tomorrow-globally-empty pointer carries data-filter-pointer.
//
// "All": show real sections (empty placeholders hidden), pointer shown.
// A league L: show only L's wrappers (its real section on days it has promos, its
//   "no L promos [day]" placeholder on days it does not), pointer hidden.
//
// The imperative toggle is safe: the children's className props are static
// (server-rendered), so a React re-render never clobbers the class we add.

function Pill({
  label,
  active,
  onClick,
}: {
  label: string;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={[
        'shrink-0 rounded-full border px-4 py-1.5 font-rd text-[12px] font-semibold uppercase tracking-[0.08em] transition-colors',
        active
          ? 'border-rd-ink bg-rd-ink text-white'
          : 'border-rd-line-strong bg-rd-card text-rd-ink-soft hover:border-rd-ink hover:text-rd-ink',
      ].join(' ')}
    >
      {label}
    </button>
  );
}

export function TodayBoardFilter({
  leagues,
  surface,
  children,
}: {
  /** Union of today + tomorrow leagues, in registry order. */
  leagues: { league: string; label: string }[];
  surface: AnalyticsSurface;
  children: ReactNode;
}) {
  const [active, setActive] = useState<string>('all');
  const rootRef = useRef<HTMLDivElement>(null);

  const apply = (next: string) => {
    if (next === active) return;
    track('league_filter_change', {
      surface,
      collection: 'today',
      from_league: active,
      to_league: next,
    });
    setActive(next);
    const root = rootRef.current;
    if (!root) return;
    root.querySelectorAll<HTMLElement>('[data-filter-league]').forEach((el) => {
      const lg = el.dataset.filterLeague;
      const empty = el.dataset.filterEmpty === 'true';
      const show = next === 'all' ? !empty : lg === next;
      el.classList.toggle('hidden', !show);
    });
    root.querySelectorAll<HTMLElement>('[data-filter-pointer]').forEach((el) => {
      el.classList.toggle('hidden', next !== 'all');
    });
  };

  // Single-league boards get no pills (an "All + MLB" pair is pointless).
  const showPills = leagues.length >= 2;

  return (
    <div>
      {showPills && (
        <div
          className="mb-8 flex gap-2 overflow-x-auto pb-1 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
          role="group"
          aria-label="Filter promos by league"
        >
          <Pill label="All" active={active === 'all'} onClick={() => apply('all')} />
          {leagues.map((l) => (
            <Pill
              key={l.league}
              label={l.label}
              active={active === l.league}
              onClick={() => apply(l.league)}
            />
          ))}
        </div>
      )}

      <div ref={rootRef} className="flex flex-col gap-10">
        {children}
      </div>
    </div>
  );
}
