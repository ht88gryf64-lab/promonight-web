'use client';

import { createContext, useCallback, useContext, useState } from 'react';
import type { PromoWithTeam } from '@/lib/types';
import type { GameContext } from '@/lib/data';
import { normalizeSport, track } from '@/lib/analytics';
import { synthPromoId, teamDisplayName } from '@/lib/promo-helpers';
import { Modal } from '@/components/ui/modal';
import { GameDayDetail, LegacyPromoDetail, dayHeader } from '@/components/shared/game-day-detail';

// Which homepage rail opened the modal — drives analytics `surface` and the
// affiliate-CTA attribution inside the reused modal body.
export type UpcomingPromoSurface = 'web_home_tonight' | 'web_home_this_week';

export type UpcomingPromoModalItem = {
  promo: PromoWithTeam;
  // Resolved home-game context(s) for MLB/NFL promos; null for game-less leagues
  // (NBA/NHL/MLS/WNBA) and dates with no matching home game — those render the
  // legacy promo detail, exactly as the team-page calendar does.
  contexts: GameContext[] | null;
  surface: UpcomingPromoSurface;
};

// Single shared modal for the whole homepage. Both card types (hero Tonight and
// the This Week list) call the `open` returned by useUpcomingPromoModal(); there
// is exactly one Modal instance and one piece of selected state, mirroring how
// TeamCalendar holds one Modal for the whole calendar.
const OpenContext = createContext<(item: UpcomingPromoModalItem) => void>(() => {});

export function useUpcomingPromoModal(): (item: UpcomingPromoModalItem) => void {
  return useContext(OpenContext);
}

export function UpcomingPromoModalProvider({ children }: { children: React.ReactNode }) {
  const [selected, setSelected] = useState<UpcomingPromoModalItem | null>(null);

  const open = useCallback((item: UpcomingPromoModalItem) => {
    setSelected(item);

    // Fire the SAME modal-open events the calendar fires (team-calendar.tsx
    // onCellClick), with the homepage surface. Home games only here, so no
    // away_game_expanded — matching the calendar's home-game branch.
    const { promo, contexts, surface } = item;
    const teamSlug = promo.team.id;
    const sport = normalizeSport(promo.team.league);
    if (contexts && contexts.length > 0) {
      for (const c of contexts) {
        track('game_tap', {
          surface,
          team_slug: teamSlug,
          sport,
          game_id: c.game.id,
          is_home: c.isHome,
          has_promo: c.promos.length > 0,
          opponent_slug: c.isHome ? c.game.awayTeamSlug : c.game.homeTeamSlug,
        });
      }
    } else {
      track('promo_card_tap', {
        surface,
        promo_id: synthPromoId(teamSlug, promo),
        team_slug: teamSlug,
        sport,
        promo_type: promo.type,
      });
    }
  }, []);

  const close = useCallback(() => setSelected(null), []);

  return (
    <OpenContext.Provider value={open}>
      {children}
      <Modal
        isOpen={!!selected}
        onClose={close}
        ariaLabel={selected ? `Game details for ${dayHeader(selected.promo.date)}` : 'Game details'}
      >
        {selected &&
          (selected.contexts && selected.contexts.length > 0 ? (
            <GameDayDetail
              dateStr={selected.promo.date}
              contexts={selected.contexts}
              team={selected.promo.team}
              teamSlug={selected.promo.team.id}
              teamName={teamDisplayName(selected.promo.team)}
              surface={selected.surface}
            />
          ) : (
            <LegacyPromoDetail
              dateStr={selected.promo.date}
              promos={[selected.promo]}
              team={selected.promo.team}
              teamSlug={selected.promo.team.id}
              surface={selected.surface}
            />
          ))}
      </Modal>
    </OpenContext.Provider>
  );
}
