'use client';

import { createContext, useCallback, useContext, useState } from 'react';
import type { PromoWithTeam } from '@/lib/types';
import type { GameContext } from '@/lib/data';
import { normalizeSport, track } from '@/lib/analytics';
import { synthPromoId, teamDisplayName } from '@/lib/promo-helpers';
import { Modal } from '@/components/ui/modal';
import { GameExpand, LegacyPromoExpand } from './GameExpand';

// Which surface opened the modal — drives analytics `surface` and the affiliate
// attribution inside the shared body. Homepage rails + the team-page list all
// feed this one provider.
export type UpcomingPromoSurface =
  | 'web_home_tonight'
  | 'web_home_this_week'
  | 'web_team_page_promolist';

export type UpcomingPromoModalItem = {
  promo: PromoWithTeam;
  // Resolved home-game context(s) for MLB/NFL promos; null for game-less leagues
  // (NBA/NHL/MLS/WNBA) and dates with no matching home game — those render the
  // legacy promo detail, exactly as the redesign calendar does.
  contexts: GameContext[] | null;
  surface: UpcomingPromoSurface;
};

// Light date header for the dialog's accessible name. Inlined so the homepage /
// team-page modal does not import anything from the legacy game-day-detail.tsx.
function dayHeader(dateStr: string): string {
  return new Date(dateStr + 'T12:00:00').toLocaleDateString('en-US', {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
  });
}

// One shared modal per page. Every opener (hero Tonight card, This Week card,
// team-page promo row) calls the `open` from useUpcomingPromoModal(); there is
// exactly one Modal instance and one piece of selected state, mirroring how the
// calendar holds one expand for the whole grid. It renders the SAME redesign
// body (GameExpand / LegacyPromoExpand) the calendar uses inline.
const OpenContext = createContext<(item: UpcomingPromoModalItem) => void>(() => {});

export function useUpcomingPromoModal(): (item: UpcomingPromoModalItem) => void {
  return useContext(OpenContext);
}

export function UpcomingPromoModalProvider({
  children,
  showTeamLink = false,
}: {
  children: React.ReactNode;
  /** When true, the body renders a "View full schedule" link to the team's own
   *  page. Set true OFF the team page (homepage); false on the team-page list
   *  (the user is already there). Explicit, not inferred from surface. */
  showTeamLink?: boolean;
}) {
  const [selected, setSelected] = useState<UpcomingPromoModalItem | null>(null);

  const open = useCallback((item: UpcomingPromoModalItem) => {
    setSelected(item);

    // Fire the SAME modal-open events the calendar fires (CalendarGrid
    // onCellClick), with this surface. Home games only here, so no
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
        variant="light"
        size="fit"
        ariaLabel={selected ? `Game details for ${dayHeader(selected.promo.date)}` : 'Game details'}
      >
        {selected &&
          (selected.contexts && selected.contexts.length > 0 ? (
            <GameExpand
              dateStr={selected.promo.date}
              contexts={selected.contexts}
              team={selected.promo.team}
              teamSlug={selected.promo.team.id}
              teamName={teamDisplayName(selected.promo.team)}
              surface={selected.surface}
              showTeamLink={showTeamLink}
            />
          ) : (
            <LegacyPromoExpand
              dateStr={selected.promo.date}
              promos={[selected.promo]}
              team={selected.promo.team}
              teamSlug={selected.promo.team.id}
              surface={selected.surface}
              showTeamLink={showTeamLink}
            />
          ))}
      </Modal>
    </OpenContext.Provider>
  );
}
