'use client';

import { useState } from 'react';
import type { Promo, PromoType, Team } from '@/lib/types';
import type { GameContext } from '@/lib/data';
import { CategoryChip } from './CategoryChip';
import { CalendarGrid } from './CalendarGrid';
import { RD_CATEGORY_ORDER } from './categories';

// Redesign v2 main-column cluster: the category filter chips + the season
// calendar. The chips filter the calendar dots. The full promo list (upcoming +
// completed) is rendered separately below by the light PromoList, so it is the
// complete, crawlable reference list rather than a truncated preview.

interface SeasonExplorerProps {
  promos: Promo[];
  promoCounts: Record<PromoType, number>;
  teamName: string;
  teamSlug: string;
  /** League string (e.g. "MLB") — normalized inside the calendar's analytics. */
  sport: string;
  team: Team;
  gameContexts?: GameContext[];
  /**
   * True when the hero above published a SEASON count. The chips and the
   * calendar they filter show UPCOMING promos on every path, so once the hero
   * carries season totals the chip numbers describe a different population than
   * the numbers directly above them. This renders the one line that says so.
   * Nothing else about the chips changes: they stay upcoming-scoped because the
   * calendar they drive is, and moving the calendar to the full season would
   * add a hidden detail block per past promo date on the game-less leagues.
   */
  seasonScoped?: boolean;
  /** Forwarded to the calendar: restrict its SSR prerender window to home days.
   *  Held on the same league date gate as the season claims, so MLB pages do
   *  not move mid-experiment. */
  homeOnlyPrerender?: boolean;
}

export function SeasonExplorer({
  promos,
  promoCounts,
  teamName,
  teamSlug,
  sport,
  team,
  gameContexts,
  seasonScoped = false,
  homeOnlyPrerender = false,
}: SeasonExplorerProps) {
  const [activeCategory, setActiveCategory] = useState<PromoType | 'all'>('all');

  return (
    <div className="space-y-6">
      {seasonScoped && (
        <p className="font-rd text-[11px] uppercase tracking-[0.14em] text-rd-ink-faint">
          Still to come
        </p>
      )}
      <div className="flex flex-wrap gap-2">
        <CategoryChip
          category="all"
          active={activeCategory === 'all'}
          onClick={() => setActiveCategory('all')}
        />
        {RD_CATEGORY_ORDER.map((c) => (
          <CategoryChip
            key={c}
            category={c}
            count={promoCounts[c]}
            active={activeCategory === c}
            onClick={() => setActiveCategory(c)}
          />
        ))}
      </div>

      <CalendarGrid
        promos={promos}
        teamName={teamName}
        teamSlug={teamSlug}
        sport={sport}
        team={team}
        gameContexts={gameContexts}
        activeCategory={activeCategory}
        homeOnlyPrerender={homeOnlyPrerender}
      />
    </div>
  );
}
