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
    </div>
  );
}
