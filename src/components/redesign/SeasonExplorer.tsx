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
      {/* Horizontal scroller rather than a wrapping row, and the reason is CLS.
       *
       *  Wrapping made this row's HEIGHT a function of its text WIDTH, and text
       *  width is not stable across the font swap. Archivo is `display: swap`
       *  and next/font's size-adjusted fallback matches vertical metrics but
       *  cannot match horizontal advance widths, so every chip gets ~3px wider
       *  when the real face lands. At 412px the container is 364px and row one
       *  packs All + Giveaways + Theme Nights: 358px on the fallback, 369px on
       *  Archivo. Teams whose giveaway AND theme counts are both two digits sit
       *  astride that boundary, so the swap pushed a chip onto a third line and
       *  translated everything below it down 41.5px. Measured 0.0688 on
       *  /nhl/dallas-stars and 0.0594 on /nhl/los-angeles-kings, reproducible to
       *  four decimals across four capture runs; 10 of 169 team pages met the
       *  condition, and membership moves as upcoming counts change.
       *
       *  A scroller makes height independent of content width, so the swap can
       *  widen the chips all it likes and nothing moves. `shrink-0` is
       *  load-bearing: without it flex would compress the chips to fit instead
       *  of overflowing, the labels would wrap, and the height would move again.
       *
       *  Same pattern as the CFB rivalry rail (CfbSchoolPage) and StubRail:
       *  no-scrollbar because the global webkit thumb is #333 on a dark track
       *  and reads as a design bar on cream (NflWeekContainer's note), with the
       *  clipped chip at the right edge carrying the affordance instead.
       *
       *  `pb-1 -mb-1` rather than the rail's bare `pb-1`: overflow-x:auto makes
       *  overflow-y computed `auto` too, which would clip the buttons' focus
       *  ring, so the padding is real; the negative margin cancels its effect on
       *  layout so this fix changes no geometry at any width. Desktop has 78px
       *  of slack and rendered one row before and after regardless. */}
      <div className="no-scrollbar flex gap-2 overflow-x-auto pb-1 -mb-1">
        <CategoryChip
          category="all"
          active={activeCategory === 'all'}
          onClick={() => setActiveCategory('all')}
          className="shrink-0 whitespace-nowrap"
        />
        {RD_CATEGORY_ORDER.map((c) => (
          <CategoryChip
            key={c}
            category={c}
            count={promoCounts[c]}
            active={activeCategory === c}
            onClick={() => setActiveCategory(c)}
            className="shrink-0 whitespace-nowrap"
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
