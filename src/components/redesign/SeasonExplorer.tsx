'use client';

import { useState } from 'react';
import type { Promo, PromoType, Team } from '@/lib/types';
import type { GameContext } from '@/lib/data';
import { CategoryChip } from './CategoryChip';
import { CalendarGrid } from './CalendarGrid';
import { UpcomingList } from './UpcomingList';
import { RD_CATEGORY_ORDER } from './categories';

// Redesign v2 main-column cluster: the category filter chips + the season
// calendar + the upcoming-promos list, sharing one `activeCategory` filter so a
// chip filters BOTH the calendar dots and the upcoming list. The calendar owns
// its own month + selected-date state (faithful to the live calendar); this
// only lifts the category filter.

interface SeasonExplorerProps {
  promos: Promo[];
  promoCounts: Record<PromoType, number>;
  teamName: string;
  teamSlug: string;
  /** League string (e.g. "MLB") — normalized inside the calendar's analytics. */
  sport: string;
  team: Team;
  gameContexts?: GameContext[];
}

export function SeasonExplorer({
  promos,
  promoCounts,
  teamName,
  teamSlug,
  sport,
  team,
  gameContexts,
}: SeasonExplorerProps) {
  const [activeCategory, setActiveCategory] = useState<PromoType | 'all'>('all');

  return (
    <div className="space-y-6">
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
      />

      <div>
        <div className="mb-3 flex items-baseline justify-between gap-3">
          <h2 className="rd-display text-2xl text-rd-ink uppercase">Upcoming promos</h2>
          <span className="font-rd text-[11px] uppercase tracking-[0.14em] text-rd-ink-faint">
            {teamName}
          </span>
        </div>
        <UpcomingList promos={promos} activeCategory={activeCategory} />
      </div>
    </div>
  );
}
