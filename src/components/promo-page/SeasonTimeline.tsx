'use client';

import { useState } from 'react';
import Link from 'next/link';
import type { PromoType } from '@/lib/types';
import { formatMonDay } from '@/lib/promo-page-copy';

// The season timeline (docs/per-promo-pages-v2-spec.md, Visuals 4): one bar
// across the team's home schedule, a tick per home game, a dot per promo in
// one muted ink tone (ruling 2026-11-07: no category colours), this game
// ringed in the team accent. Hover or keyboard focus on a dot (or a click)
// names the promo on the line under the bar and links to its page.
// DERIVED FROM SCHEDULE DATA ONLY: the games are the spine's home games of
// the season, the promos are the team's rows on those dates; a promo on a
// date with no home game is not on the bar. The server renders nothing below
// three home games (src/lib/promo-pages.ts), so this component never sees
// that case. A client component for the tap state; every prop is page
// content (dates, names, page hrefs), nothing more reaches the payload.

export interface TimelineGame {
  date: string;
}
export interface TimelinePromo {
  date: string;
  title: string;
  href: string;
  type: PromoType;
}

const W = 600;
const H = 40;
const PAD = 10;
const BAR_Y = 22;

export function SeasonTimeline({ games, promos, thisDate, thisHref, teamName }: { games: readonly TimelineGame[]; promos: readonly TimelinePromo[]; thisDate: string; /** This page's own path: its dot is the one named by default. */ thisHref?: string; teamName: string }) {
  const xOf = (date: string) => {
    const i = games.findIndex((g) => g.date === date);
    return i < 0 ? null : PAD + (i * (W - 2 * PAD)) / Math.max(1, games.length - 1);
  };
  const onBar = promos.filter((p) => xOf(p.date) !== null);
  const byHref = thisHref ? onBar.findIndex((p) => p.href === thisHref) : -1;
  const thisIndex = Math.max(0, byHref >= 0 ? byHref : onBar.findIndex((p) => p.date === thisDate));
  const [active, setActive] = useState(thisIndex);
  const current = onBar[active] ?? null;
  // Several promos on one date fan out so each dot stays distinct: the first
  // on the tick, the rest 13 units to either side.
  const offsets = new Map<string, number>();
  const placed = onBar.map((p) => {
    const n = offsets.get(p.date) ?? 0;
    offsets.set(p.date, n + 1);
    return { ...p, x: (xOf(p.date) ?? 0) + (n === 0 ? 0 : n % 2 ? 13 * Math.ceil(n / 2) : -13 * (n / 2)) };
  });
  if (games.length < 3 || onBar.length === 0) return null;
  const thisX = xOf(thisDate);
  return (
    <div className="mt-1">
      <svg viewBox={`0 0 ${W} ${H}`} width="100%" height={H} className="block" role="group" aria-label={`${teamName} home schedule, ${games.length} games, ${onBar.length} promos`}>
        <line x1={PAD} y1={BAR_Y} x2={W - PAD} y2={BAR_Y} stroke="var(--color-rd-line-strong)" strokeWidth="2" strokeLinecap="round" />
        {games.map((g, i) => (
          <line key={g.date} x1={PAD + (i * (W - 2 * PAD)) / Math.max(1, games.length - 1)} y1={BAR_Y - 3} x2={PAD + (i * (W - 2 * PAD)) / Math.max(1, games.length - 1)} y2={BAR_Y + 3} stroke="var(--color-rd-line-strong)" strokeWidth="1" />
        ))}
        {thisX !== null ? <circle cx={thisX} cy={BAR_Y} r="9" fill="none" stroke="var(--pp-accent)" strokeWidth="2" /> : null}
        {placed.map((p, i) => (
          <g
            key={`${p.href}-${p.date}`}
            role="button"
            tabIndex={0}
            aria-label={`${formatMonDay(p.date)}: ${p.title}`}
            aria-pressed={i === active}
            className="cursor-pointer outline-none"
            onClick={() => setActive(i)}
            onMouseEnter={() => setActive(i)}
            onFocus={() => setActive(i)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                setActive(i);
              }
            }}
          >
            <title>{`${formatMonDay(p.date)}: ${p.title}`}</title>
            <circle cx={p.x} cy={BAR_Y} r={i === active ? 6 : 5} fill="var(--color-rd-ink)" fillOpacity={i === active ? 0.7 : 0.4} stroke="var(--color-rd-card)" strokeWidth="2" />
          </g>
        ))}
      </svg>
      {current ? (
        <p className="m-0 mt-1 font-rd text-[12px] text-rd-ink-soft">
          <span className="text-rd-ink-faint">{`${formatMonDay(current.date)} · `}</span>
          {current.href === thisHref ? <span className="font-semibold text-rd-ink">{current.title}</span> : <Link href={current.href} className="font-semibold text-rd-red no-underline hover:underline">{current.title}</Link>}
          <span className="text-rd-ink-faint">{` · home game ${games.findIndex((g) => g.date === current.date) + 1} of ${games.length}`}</span>
        </p>
      ) : null}
    </div>
  );
}
